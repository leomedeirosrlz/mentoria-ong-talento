"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { MOTIVOS_REAGENDAMENTO, inicioDefaultDupla } from "@/lib/ciclo";
import {
  emailValido,
  mapRole,
  normEmail,
  normNome,
  normWhatsapp,
  type LinhaImportada,
} from "@/lib/importar";

/** Traduz erro do Postgres/PostgREST pra mensagem de UI (sem vazar schema nem inglês). */
function erroAmigavel(e: { message: string; code?: string }): string {
  // exceções de domínio levantadas por trigger já chegam em pt-BR
  if (/apenas a coordenacao resolve pedidos/i.test(e.message)) {
    return "Somente a coordenação pode atender um pedido de apoio.";
  }
  if (e.code === "23505" || /duplicate key/i.test(e.message)) {
    // e-mail é a identidade do magic link — o constraint "..._email_key" diz qual coluna conflitou
    if (/email/i.test(e.message)) return "Esse e-mail já está cadastrado.";
    return "Já existe um cadastro com esses dados.";
  }
  if (e.code === "42501" || /row-level security|row level security/i.test(e.message)) {
    return "Você não tem permissão para essa ação.";
  }
  if (e.code === "23514" || /check constraint|invalid input value/i.test(e.message)) {
    return "Valor inválido para um dos campos.";
  }
  if (e.code === "23503" || /foreign key/i.test(e.message)) {
    return "Esse registro está vinculado a outros dados.";
  }
  return "Não foi possível concluir. Tente de novo.";
}

async function me() {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const { data } = await supabase
    .from("profiles")
    .select("id, role, nome")
    .eq("user_id", (claimsData?.claims?.sub as string) ?? "")
    .single();
  return { supabase, me: data };
}

const FOTO_TIPOS = ["image/png", "image/jpeg", "image/webp"];
const FOTO_MAX = 2 * 1024 * 1024;

type Supa = Awaited<ReturnType<typeof createClient>>;

/** Fan-out de notificações in-app — um insert em lote. A RLS escopa pelo
 *  papel do destinatário (coord → qualquer um; demais → só staff). Falha vira
 *  console.error, não erro da ação: a notificação é complemento, e o autor
 *  nunca se auto-notifica. */
async function notificar(
  supabase: Supa,
  rows: {
    profile_id: string | null | undefined;
    tipo: string;
    titulo: string;
    corpo?: string | null;
    href?: string | null;
    comunicado_id?: string | null;
  }[],
  autorId: string
) {
  const limpos = rows
    .filter((r): r is typeof r & { profile_id: string } => !!r.profile_id)
    .filter((r) => r.profile_id !== autorId);
  if (!limpos.length) return;
  const { error } = await supabase
    .from("notificacoes")
    .insert(limpos.map((r) => ({ ...r, created_by: autorId })));
  if (error) console.error("notificar: falha ao gravar notificações", error);
}

/** Foto opcional vinda do FormData — sobe pro bucket `avatares` na pasta do
 *  dono (`<id>/<uuid>.<ext>`) e devolve o path. Falha de upload não derruba
 *  o cadastro: vira `aviso` pro caller anexar ao toast. */
async function subirFoto(
  supabase: Supa,
  pasta: string,
  formData: FormData
): Promise<{ path?: string; aviso?: string }> {
  const foto = formData.get("foto");
  if (!(foto instanceof File) || foto.size === 0) return {};
  if (!FOTO_TIPOS.includes(foto.type)) {
    return { aviso: "A foto não entrou — use PNG, JPG ou WebP." };
  }
  if (foto.size > FOTO_MAX) {
    return { aviso: "A foto não entrou — use uma imagem de até 2 MB." };
  }
  const ext = foto.name.split(".").pop()?.toLowerCase() ?? "png";
  const path = `${pasta}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage
    .from("avatares")
    .upload(path, foto, { contentType: foto.type });
  if (error) return { aviso: "Cadastro salvo, mas a foto não subiu — tente na edição." };
  return { path };
}

// ---------- pessoas & duplas (coordenação) ----------

const ROLES = ["coordenacao", "supervisor", "mentor_dpp", "mentor_especialista"] as const;

export async function createPessoa(formData: FormData) {
  const { supabase, me: eu } = await me();
  if (!eu) return { error: "Sessão expirada — entre de novo." };
  const role = String(formData.get("role") ?? "");
  const nome = String(formData.get("nome") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const whatsappRaw = String(formData.get("whatsapp") ?? "");
  const whatsapp = normWhatsapp(whatsappRaw);
  if (!nome || !email) return { error: "Nome e e-mail são obrigatórios." };
  if (!emailValido(email)) return { error: "E-mail inválido." };
  if (whatsappRaw.trim() && !whatsapp) return { error: "WhatsApp inválido." };
  if (!(ROLES as readonly string[]).includes(role)) return { error: "Papel inválido." };

  const { data: profile, error } = await supabase
    .from("profiles")
    .insert({ nome, email, whatsapp: whatsapp || null, role })
    .select("id")
    .single();
  if (error) return { error: erroAmigavel(error) };

  // foto opcional — depois do insert, porque a pasta é o id novo da pessoa
  let aviso: string | undefined;
  const foto = await subirFoto(supabase, profile.id, formData);
  if (foto.path) {
    const { error: avErr } = await supabase
      .from("profiles").update({ avatar_path: foto.path }).eq("id", profile.id);
    if (avErr) aviso = "Cadastro salvo, mas a foto não subiu — tente na edição.";
  } else {
    aviso = foto.aviso;
  }

  if (role === "mentor_dpp" || role === "mentor_especialista") {
    const capacidade = Number(formData.get("capacidade") || 1);
    if (!Number.isInteger(capacidade) || capacidade < 1) {
      return { error: "Capacidade inválida." };
    }
    // o profile já foi gravado — se isso falhar, o mentor fica sem perfil de
    // mentor e o erro precisa aparecer (não engolir como antes)
    const { error: mpErr } = await supabase.from("mentor_profiles").insert({
      profile_id: profile.id,
      tipo: role === "mentor_dpp" ? "dpp" : "especialista",
      capacidade,
    });
    if (mpErr) return { error: erroAmigavel(mpErr) };
  }
  revalidatePath("/pessoas");
  revalidatePath(`/pessoas/${profile.id}`);
  return { ok: true, aviso };
}

export async function createMentorado(formData: FormData) {
  const { supabase, me: eu } = await me();
  if (!eu) return { error: "Sessão expirada — entre de novo." };
  const nome = normNome(String(formData.get("nome") ?? ""));
  if (!nome) return { error: "Nome é obrigatório." };
  const email = normEmail(String(formData.get("email") ?? ""));
  if (email && !emailValido(email)) return { error: "E-mail inválido." };
  // lixo digitado não pode zerar o campo silenciosamente
  const whatsappRaw = String(formData.get("whatsapp") ?? "");
  const whatsapp = normWhatsapp(whatsappRaw);
  if (whatsappRaw.trim() && !whatsapp) return { error: "WhatsApp inválido." };
  const { data: mentorado, error } = await supabase.from("mentorados").insert({
    nome,
    email: email || null,
    whatsapp: whatsapp || null,
    ong_origem: String(formData.get("ong_origem") ?? "").trim() || null,
    notas: String(formData.get("notas") ?? "").trim() || null,
  }).select("id").single();
  if (error) return { error: erroAmigavel(error) };

  let aviso: string | undefined;
  const foto = await subirFoto(supabase, mentorado.id, formData);
  if (foto.path) {
    const { error: avErr } = await supabase
      .from("mentorados").update({ avatar_path: foto.path }).eq("id", mentorado.id);
    if (avErr) aviso = "Cadastro salvo, mas a foto não subiu — tente na edição.";
  } else {
    aviso = foto.aviso;
  }
  revalidatePath("/pessoas");
  revalidatePath(`/pessoas/${mentorado.id}`);
  return { ok: true, aviso };
}

export async function createDupla(formData: FormData) {
  const { supabase, me: eu } = await me();
  if (!eu) return { error: "Sessão expirada — entre de novo." };
  const mentor_id = String(formData.get("mentor_id") ?? "");
  const mentorado_id = String(formData.get("mentorado_id") ?? "");
  const supervisor_id = String(formData.get("supervisor_id") || "") || null;
  if (!mentor_id || !mentorado_id) return { error: "Escolha mentor e mentorado." };
  const { data: mentor } = await supabase
    .from("profiles").select("role").eq("id", mentor_id).single();
  if (mentor?.role !== "mentor_dpp" && mentor?.role !== "mentor_especialista") {
    return { error: "A pessoa escolhida como mentor não tem papel de mentor." };
  }
  if (supervisor_id) {
    const { data: supervisor } = await supabase
      .from("profiles").select("role").eq("id", supervisor_id).single();
    if (supervisor?.role !== "supervisor") {
      return { error: "A pessoa escolhida como supervisor não tem esse papel." };
    }
  }
  // um mentorado só ocupa uma vaga por vez — dupla pausada segue contando
  const { data: emDupla } = await supabase
    .from("duplas").select("id")
    .eq("mentorado_id", mentorado_id)
    .in("status", ["ativa", "pausada"])
    .limit(1);
  if (emDupla?.length) {
    return { error: "Esse mentorado já está em uma dupla ativa." };
  }
  // mentor sem linha em mentor_profiles vale capacidade 1
  const [{ data: doMentor }, { data: mp }] = await Promise.all([
    supabase.from("duplas").select("id")
      .eq("mentor_id", mentor_id).in("status", ["ativa", "pausada"]),
    supabase.from("mentor_profiles").select("capacidade")
      .eq("profile_id", mentor_id).maybeSingle(),
  ]);
  if ((doMentor?.length ?? 0) >= (mp?.capacidade ?? 1)) {
    return { error: "Esse mentor já está com a capacidade cheia." };
  }
  const iniciadaRaw = String(formData.get("iniciada_em") || "").trim();
  if (iniciadaRaw && !/^\d{4}-\d{2}-\d{2}$/.test(iniciadaRaw)) {
    return { error: "Data de início inválida." };
  }
  // sem data informada, a dupla nasce uma semana antes do 1º encontro oficial
  // do ciclo — coord cadastra a dupla depois dela existir de fato, e "hoje"
  // apagaria os encontros já passados do semáforo. Sem ciclo, cai em hoje.
  let iniciada_em = iniciadaRaw;
  if (!iniciada_em) {
    const { data: primeiroEv } = await supabase
      .from("ciclo_eventos").select("data")
      .eq("tipo", "encontro").order("data", { ascending: true }).limit(1).maybeSingle();
    iniciada_em = primeiroEv
      ? inicioDefaultDupla([{ tipo: "encontro", data: primeiroEv.data }])!
      : new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
  }
  const { data: novaDupla, error } = await supabase.from("duplas").insert({
    mentor_id,
    mentorado_id,
    supervisor_id,
    iniciada_em,
  }).select("id").single();
  if (error) return { error: erroAmigavel(error) };
  // avisa o mentor — o pareamento é a notícia que muda a rotina dele
  const { data: md } = await supabase
    .from("mentorados").select("nome").eq("id", mentorado_id).single();
  const hrefDupla = novaDupla?.id ? `/duplas/${novaDupla.id}` : "/duplas";
  await notificar(supabase, [
    {
      profile_id: mentor_id,
      tipo: "dupla_formada",
      titulo: "Sua dupla foi formada",
      corpo: md?.nome ? `Você e ${md.nome} — combinem o 1º encontro.` : null,
      href: hrefDupla,
    },
    {
      profile_id: supervisor_id,
      tipo: "dupla_formada",
      titulo: "Nova dupla sob sua supervisão",
      corpo: md?.nome ? `${md.nome} — acompanhe a ficha da dupla.` : null,
      href: hrefDupla,
    },
  ], eu.id);
  revalidatePath("/duplas");
  revalidatePath("/");
  return { ok: true };
}

export async function setPessoaRole(profileId: string, role: string | null) {
  const { supabase, me: eu } = await me();
  if (!eu) return { error: "Sessão expirada — entre de novo." };
  if (profileId === eu.id) {
    return { error: "Não é possível alterar o próprio cadastro." };
  }
  const novoRole = role && (ROLES as readonly string[]).includes(role) ? role : null;
  const { data, error } = await supabase
    .from("profiles")
    .update({ role: novoRole })
    .eq("id", profileId)
    .select("id");
  if (error) return { error: erroAmigavel(error) };
  // RLS esconde a linha → 0 rows sem erro; não pode fingir que salvou
  if (!data?.length) {
    return { error: "Não foi possível concluir. Recarregue a página e tente de novo." };
  }

  // mentor_profiles acompanha o papel: mentor tem linha (upsert preserva
  // capacidade/areas/validações existentes), qualquer outro papel remove a linha
  if (novoRole === "mentor_dpp" || novoRole === "mentor_especialista") {
    const { error: mpErr } = await supabase.from("mentor_profiles").upsert({
      profile_id: profileId,
      tipo: novoRole === "mentor_dpp" ? "dpp" : "especialista",
    });
    if (mpErr) return { error: erroAmigavel(mpErr) };
  } else {
    const { error: mpErr } = await supabase
      .from("mentor_profiles").delete().eq("profile_id", profileId);
    if (mpErr) return { error: erroAmigavel(mpErr) };
  }
  revalidatePath("/pessoas");
  return { ok: true };
}

// ---------- gestao ----------

export async function updatePessoa(profileId: string, formData: FormData) {
  const { supabase, me: eu } = await me();
  if (!eu) return { error: "Sessão expirada — entre de novo." };
  const nome = normNome(String(formData.get("nome") ?? ""));
  const whatsappRaw = String(formData.get("whatsapp") ?? "");
  const whatsapp = normWhatsapp(whatsappRaw);
  const email = normEmail(String(formData.get("email") ?? ""));
  if (!nome) return { error: "Nome é obrigatório." };
  // lixo digitado não pode zerar o campo silenciosamente
  if (whatsappRaw.trim() && !whatsapp) return { error: "WhatsApp inválido." };
  if (email && !emailValido(email)) return { error: "E-mail inválido." };
  // valida antes de qualquer escrita — "abc" virava NaN e 0 gravava;
  // campo presente mas apagado não pode virar 1 silenciosamente
  const capacidadeRaw = String(formData.get("capacidade") ?? "").trim();
  if (formData.has("capacidade") && !capacidadeRaw) {
    return { error: "Informe a capacidade." };
  }
  const capacidade = Number(capacidadeRaw || 1);
  if (formData.has("capacidade") && (!Number.isInteger(capacidade) || capacidade < 1)) {
    return { error: "Capacidade inválida." };
  }

  // e-mail = identidade do link de acesso; só muda enquanto a pessoa nunca entrou
  const { data: atual } = await supabase
    .from("profiles").select("user_id, role").eq("id", profileId).single();
  const patch: Record<string, unknown> = { nome, whatsapp: whatsapp || null };
  if (email && !atual?.user_id) patch.email = email;

  const { data, error } = await supabase
    .from("profiles").update(patch).eq("id", profileId).select("id");
  if (error) return { error: erroAmigavel(error) };
  if (!data?.length) {
    return { error: "Não foi possível concluir. Recarregue a página e tente de novo." };
  }

  // foto nova: sobe na pasta do dono, troca o path e remove o arquivo antigo
  let aviso: string | undefined;
  const foto = await subirFoto(supabase, profileId, formData);
  if (foto.path) {
    const { data: atualAv } = await supabase
      .from("profiles").select("avatar_path").eq("id", profileId).single();
    const { error: avErr } = await supabase
      .from("profiles").update({ avatar_path: foto.path }).eq("id", profileId);
    if (avErr) {
      aviso = "Dados salvos, mas a foto não subiu — tente de novo.";
    } else if (atualAv?.avatar_path) {
      await supabase.storage.from("avatares").remove([atualAv.avatar_path]);
    }
  } else {
    aviso = foto.aviso;
  }

  // só mexe no mentor_profile quando o form trouxe os campos — se o fetch do
  // dialog falhou, salvar sem eles não pode zerar capacidade/areas/checklists
  if ((atual?.role === "mentor_dpp" || atual?.role === "mentor_especialista") && formData.has("capacidade")) {
    const areas = String(formData.get("areas") ?? "")
      .split(",").map((s) => s.trim()).filter(Boolean);
    const { error: mpErr } = await supabase.from("mentor_profiles").upsert({
      profile_id: profileId,
      tipo: atual.role === "mentor_dpp" ? "dpp" : "especialista",
      capacidade,
      areas,
      termo_ok: formData.get("termo_ok") === "on",
      formacao_ok: formData.get("formacao_ok") === "on",
    });
    if (mpErr) return { error: erroAmigavel(mpErr) };
  }
  revalidatePath("/pessoas");
  revalidatePath(`/pessoas/${profileId}`);
  return { ok: true, aviso };
}

export async function setPessoaAtivo(profileId: string, ativo: boolean) {
  const { supabase, me: eu } = await me();
  if (!eu) return { error: "Sessão expirada — entre de novo." };
  if (profileId === eu.id) {
    return { error: "Não é possível alterar o próprio cadastro." };
  }
  const { data, error } = await supabase
    .from("profiles").update({ ativo }).eq("id", profileId).select("id");
  if (error) return { error: erroAmigavel(error) };
  if (!data?.length) {
    return { error: "Não foi possível concluir. Recarregue a página e tente de novo." };
  }
  revalidatePath("/pessoas");
  revalidatePath("/");
  return { ok: true };
}

export async function deletePessoa(profileId: string) {
  const { supabase, me: eu } = await me();
  if (!eu) return { error: "Sessão expirada — entre de novo." };
  const { data: duplas } = await supabase
    .from("duplas").select("id")
    .or(`mentor_id.eq.${profileId},supervisor_id.eq.${profileId}`).limit(1);
  if (duplas?.length)
    return { error: "Essa pessoa tem dupla vinculada. Desative em vez de excluir." };
  const { data: p } = await supabase
    .from("profiles").select("user_id, documento_path").eq("id", profileId).single();
  if (p?.user_id)
    return { error: "Essa pessoa já entrou na plataforma. Desative em vez de excluir." };
  // limpa o documento do bucket pra não deixar objeto órfão (best-effort:
  // a row é a referência; falha aqui não deve impedir excluir o cadastro)
  if (p?.documento_path) {
    await supabase.storage.from("documentos").remove([p.documento_path]);
  }
  const { data, error } = await supabase
    .from("profiles").delete().eq("id", profileId).select("id");
  if (error) return { error: erroAmigavel(error) };
  if (!data?.length) {
    return { error: "Não foi possível concluir. Recarregue a página e tente de novo." };
  }
  revalidatePath("/pessoas");
  return { ok: true };
}

export async function updateMentorado(id: string, formData: FormData) {
  const { supabase, me: eu } = await me();
  if (!eu) return { error: "Sessão expirada — entre de novo." };
  const nome = normNome(String(formData.get("nome") ?? ""));
  const email = normEmail(String(formData.get("email") ?? ""));
  if (!nome) return { error: "Nome é obrigatório." };
  if (email && !emailValido(email)) return { error: "E-mail inválido." };
  // lixo digitado não pode zerar o campo silenciosamente
  const whatsappRaw = String(formData.get("whatsapp") ?? "");
  const whatsapp = normWhatsapp(whatsappRaw);
  if (whatsappRaw.trim() && !whatsapp) return { error: "WhatsApp inválido." };
  const { data, error } = await supabase.from("mentorados").update({
    nome,
    email: email || null,
    whatsapp: whatsapp || null,
    ong_origem: String(formData.get("ong_origem") ?? "").trim() || null,
    notas: String(formData.get("notas") ?? "").trim() || null,
  }).eq("id", id).select("id");
  if (error) return { error: erroAmigavel(error) };
  if (!data?.length) {
    return { error: "Não foi possível concluir. Recarregue a página e tente de novo." };
  }

  // foto nova na edição: sobe, troca o path e remove o arquivo antigo do bucket
  let aviso: string | undefined;
  const foto = await subirFoto(supabase, id, formData);
  if (foto.path) {
    const { data: atual } = await supabase
      .from("mentorados").select("avatar_path").eq("id", id).single();
    const { error: avErr } = await supabase
      .from("mentorados").update({ avatar_path: foto.path }).eq("id", id);
    if (avErr) {
      aviso = "Dados salvos, mas a foto não subiu — tente de novo.";
    } else if (atual?.avatar_path) {
      await supabase.storage.from("avatares").remove([atual.avatar_path]);
    }
  } else {
    aviso = foto.aviso;
  }
  revalidatePath("/pessoas");
  revalidatePath(`/pessoas/${id}`);
  return { ok: true, aviso };
}

export async function deleteMentorado(id: string) {
  const { supabase, me: eu } = await me();
  if (!eu) return { error: "Sessão expirada — entre de novo." };
  const { data: duplas } = await supabase
    .from("duplas").select("id").eq("mentorado_id", id).limit(1);
  if (duplas?.length)
    return { error: "O mentorado tem dupla. Encerre a dupla antes de excluir." };
  const { data: m } = await supabase
    .from("mentorados").select("documento_path").eq("id", id).single();
  // mesmo cuidado do delete de pessoa: remove o objeto do bucket antes da row
  if (m?.documento_path) {
    await supabase.storage.from("documentos").remove([m.documento_path]);
  }
  const { data, error } = await supabase
    .from("mentorados").delete().eq("id", id).select("id");
  if (error) return { error: erroAmigavel(error) };
  if (!data?.length) {
    return { error: "Não foi possível concluir. Recarregue a página e tente de novo." };
  }
  revalidatePath("/pessoas");
  return { ok: true };
}

export async function updateDupla(duplaId: string, formData: FormData) {
  const { supabase, me: eu } = await me();
  if (!eu) return { error: "Sessão expirada — entre de novo." };
  const mentor_id = String(formData.get("mentor_id") ?? "");
  const mentorado_id = String(formData.get("mentorado_id") ?? "");
  const supervisor_id = String(formData.get("supervisor_id") || "") || null;
  const iniciada_em = String(formData.get("iniciada_em") || "").trim();
  const status = String(formData.get("status") || "ativa");
  if (!mentor_id || !mentorado_id) return { error: "Escolha mentor e mentorado." };
  if (!["ativa", "pausada", "encerrada"].includes(status)) return { error: "Status inválido." };
  if (iniciada_em && !/^\d{4}-\d{2}-\d{2}$/.test(iniciada_em)) {
    return { error: "Data de início inválida." };
  }
  const { data: mentor } = await supabase
    .from("profiles").select("role").eq("id", mentor_id).single();
  if (mentor?.role !== "mentor_dpp" && mentor?.role !== "mentor_especialista") {
    return { error: "A pessoa escolhida como mentor não tem papel de mentor." };
  }
  if (supervisor_id) {
    const { data: supervisor } = await supabase
      .from("profiles").select("role").eq("id", supervisor_id).single();
    if (supervisor?.role !== "supervisor") {
      return { error: "A pessoa escolhida como supervisor não tem esse papel." };
    }
  }
  // dupla ativa/pausada ocupa vaga do mentor e do mentorado; encerrada não ocupa,
  // então só valida quando o novo status volta a contar. A própria dupla sai da
  // conta (.neq) pra edição simples não brigar com ela mesma
  const { data: atualDupla } = await supabase
    .from("duplas").select("mentor_id, mentorado_id, supervisor_id, status").eq("id", duplaId).single();
  if (atualDupla && status !== "encerrada") {
    // encerrada voltando a ativa/pausada precisa revalidar — a vaga pode ter sido
    // ocupada por outra dupla enquanto estava encerrada
    const voltando = atualDupla.status === "encerrada";
    if (voltando || mentorado_id !== atualDupla.mentorado_id) {
      const { data: emDupla } = await supabase
        .from("duplas").select("id")
        .eq("mentorado_id", mentorado_id)
        .in("status", ["ativa", "pausada"])
        .neq("id", duplaId)
        .limit(1);
      if (emDupla?.length) {
        return { error: "Esse mentorado já está em uma dupla ativa." };
      }
    }
    if (voltando || mentor_id !== atualDupla.mentor_id) {
      const [{ data: doMentor }, { data: mp }] = await Promise.all([
        supabase.from("duplas").select("id")
          .eq("mentor_id", mentor_id)
          .in("status", ["ativa", "pausada"])
          .neq("id", duplaId),
        supabase.from("mentor_profiles").select("capacidade")
          .eq("profile_id", mentor_id).maybeSingle(),
      ]);
      if ((doMentor?.length ?? 0) >= (mp?.capacidade ?? 1)) {
        return { error: "Esse mentor já está com a capacidade cheia." };
      }
    }
  }
  // iniciada_em em branco preserva a data atual — zerar mudaria a base do semáforo
  const patch: Record<string, unknown> = {
    mentor_id,
    mentorado_id,
    supervisor_id,
    status,
  };
  if (iniciada_em) patch.iniciada_em = iniciada_em;
  const { data, error } = await supabase.from("duplas").update(patch).eq("id", duplaId).select("id");
  if (error) return { error: erroAmigavel(error) };
  if (!data?.length) {
    return { error: "Não foi possível concluir. Recarregue a página e tente de novo." };
  }
  // troca de mentor/supervisor notifica o novo responsável — ele precisa saber
  // que a dupla passou pra ele sem a coord mandar mensagem à parte
  if (atualDupla && (mentor_id !== atualDupla.mentor_id || supervisor_id !== atualDupla.supervisor_id)) {
    const { data: mdTroca } = await supabase
      .from("mentorados").select("nome").eq("id", mentorado_id).single();
    await notificar(supabase, [
      mentor_id !== atualDupla.mentor_id ? {
        profile_id: mentor_id,
        tipo: "dupla_formada",
        titulo: "Você assumiu uma dupla",
        corpo: mdTroca?.nome ? `Você e ${mdTroca.nome} — vejam onde a jornada está.` : null,
        href: `/duplas/${duplaId}`,
      } : null,
      supervisor_id && supervisor_id !== atualDupla.supervisor_id ? {
        profile_id: supervisor_id,
        tipo: "dupla_formada",
        titulo: "Nova dupla sob sua supervisão",
        corpo: mdTroca?.nome ? `${mdTroca.nome} — acompanhe a ficha da dupla.` : null,
        href: `/duplas/${duplaId}`,
      } : null,
    ].filter((r): r is NonNullable<typeof r> => r !== null), eu.id);
  }
  revalidatePath("/");
  revalidatePath("/duplas");
  revalidatePath(`/duplas/${duplaId}`);
  return { ok: true };
}

export async function deleteDupla(duplaId: string) {
  const { supabase, me: eu } = await me();
  if (!eu) return { error: "Sessão expirada — entre de novo." };
  // cascata remove encontros, registros e encaminhamentos da dupla
  const { data, error } = await supabase
    .from("duplas").delete().eq("id", duplaId).select("id");
  if (error) return { error: erroAmigavel(error) };
  if (!data?.length) {
    return { error: "Não foi possível concluir. Recarregue a página e tente de novo." };
  }
  revalidatePath("/");
  revalidatePath("/duplas");
  return { ok: true };
}

export async function deleteMaterial(id: string) {
  const { supabase, me: eu } = await me();
  if (!eu) return { error: "Sessão expirada — entre de novo." };
  const { data, error } = await supabase
    .from("materiais").delete().eq("id", id).select("id");
  if (error) return { error: erroAmigavel(error) };
  if (!data?.length) {
    return { error: "Não foi possível concluir. Recarregue a página e tente de novo." };
  }
  revalidatePath("/materiais");
  return { ok: true };
}

// ---------- importação ----------

export async function importPessoas(rows: LinhaImportada[]) {
  const { supabase, me: eu } = await me();
  if (!eu) return { error: "Sessão expirada — entre de novo." };
  const { data: existentes } = await supabase.from("profiles").select("email");
  const noBanco = new Set((existentes ?? []).map((p) => p.email.toLowerCase()));
  const vistos = new Set<string>();
  const validas: { nome: string; email: string; whatsapp: string | null; role: string }[] = [];
  const puladas: string[] = [];

  for (const r of rows) {
    const nome = normNome(r.nome);
    const email = normEmail(r.email);
    const whatsapp = normWhatsapp(r.whatsapp);
    // papel em branco cai no default mentor_dpp; preenchido mas irreconhecível pula a linha
    const papelPreenchido = String(r.papel ?? "").trim() !== "";
    const role = papelPreenchido ? mapRole(r.papel) : ("mentor_dpp" as const);
    if (!nome || !emailValido(email)) { puladas.push(`${r.nome || r.email || "?"}: nome ou e-mail inválido`); continue; }
    // whatsapp preenchido mas ilegível pula a linha — antes caía como null silenciosamente
    if (r.whatsapp.trim() && !whatsapp) { puladas.push(`${nome}: whatsapp inválido`); continue; }
    if (role === null) { puladas.push(`${nome}: papel não reconhecido`); continue; }
    if (noBanco.has(email) || vistos.has(email)) { puladas.push(`${email}: já existe`); continue; }
    vistos.add(email);
    validas.push({ nome, email, whatsapp, role });
  }
  if (!validas.length) return { ok: true, criados: 0, puladas };

  const { data: inseridas, error } = await supabase
    .from("profiles").insert(validas).select("id, role");
  if (error) return { error: erroAmigavel(error) };

  const mentores = (inseridas ?? [])
    .filter((p) => p.role === "mentor_dpp" || p.role === "mentor_especialista")
    .map((p) => ({
      profile_id: p.id,
      tipo: p.role === "mentor_dpp" ? "dpp" : "especialista",
    }));
  if (mentores.length) {
    const { error: mpErr } = await supabase.from("mentor_profiles").insert(mentores);
    if (mpErr) {
      puladas.push("Aviso: perfis de mentor não foram criados para alguns importados.");
    }
  }

  revalidatePath("/pessoas");
  return { ok: true, criados: inseridas?.length ?? 0, puladas };
}

export async function importMentorados(rows: LinhaImportada[]) {
  const { supabase, me: eu } = await me();
  if (!eu) return { error: "Sessão expirada — entre de novo." };
  const { data: existentes } = await supabase.from("mentorados").select("nome, whatsapp");
  const nomes = new Set((existentes ?? []).map((m) => normNome(m.nome).toLowerCase()));
  const was = new Set(
    (existentes ?? []).map((m) => normWhatsapp(m.whatsapp ?? "")).filter(Boolean)
  );
  const vistos = new Set<string>();
  const vistosWa = new Set<string>();
  const validas: Record<string, unknown>[] = [];
  const puladas: string[] = [];

  for (const r of rows) {
    const nome = normNome(r.nome);
    const whatsapp = normWhatsapp(r.whatsapp);
    const email = normEmail(r.email);
    if (!nome) { puladas.push("linha sem nome"); continue; }
    if (email && !emailValido(email)) { puladas.push(`${nome}: e-mail inválido`); continue; }
    // whatsapp preenchido mas ilegível pula a linha — antes caía como null silenciosamente
    if (r.whatsapp.trim() && !whatsapp) { puladas.push(`${nome}: whatsapp inválido`); continue; }
    const chave = nome.toLowerCase();
    // vistosWa: mesmo whatsapp com nome diferente no arquivo também é duplicado
    if (nomes.has(chave) || (whatsapp && was.has(whatsapp)) ||
        vistos.has(chave) || (whatsapp && vistosWa.has(whatsapp))) {
      puladas.push(`${nome}: já existe`); continue;
    }
    vistos.add(chave);
    if (whatsapp) vistosWa.add(whatsapp);
    validas.push({
      nome,
      email: email || null,
      whatsapp,
      ong_origem: String(r.ong ?? "").trim() || null,
      notas: String(r.notas ?? "").trim() || null,
    });
  }
  if (!validas.length) return { ok: true, criados: 0, puladas };

  const { error } = await supabase.from("mentorados").insert(validas);
  if (error) return { error: erroAmigavel(error) };
  revalidatePath("/pessoas");
  return { ok: true, criados: validas.length, puladas };
}

// ---------- encontros (mentor da dupla) ----------

const ORIGENS = ["plataforma", "externo"] as const;

/** URL só http/https — javascript:/data: armazenável renderiza <a href> direto. */
function urlOk(s: string): boolean {
  try { return ["http:", "https:"].includes(new URL(s).protocol); } catch { return false; }
}

/** Aceita os dois formatos que o client manda: ISO com fuso ("...Z" / "+03:00")
 *  vira Date direto; `datetime-local` naïve ("YYYY-MM-DDTHH:mm", sem offset) é
 *  interpretado como horário de São Paulo (-03:00 fixo, sem horário de verão). */
function parseDataHora(s: string): Date | null {
  const d = new Date(/Z|[+-]\d{2}:?\d{2}$/.test(s) ? s : `${s}-03:00`);
  return isNaN(d.getTime()) ? null : d;
}

export async function agendarEncontro(formData: FormData) {
  const { supabase, me: eu } = await me();
  if (!eu) return { error: "Sessão expirada — entre de novo." };
  const dupla_id = String(formData.get("dupla_id") ?? "");
  const numero = Number(formData.get("numero"));
  const data_hora = String(formData.get("data_hora") ?? "");
  const link = String(formData.get("link") ?? "").trim() || null;
  const origem = String(formData.get("origem") || "plataforma");
  const motivo = String(formData.get("motivo") ?? "").trim();
  const motivoOutro = String(formData.get("motivo_outro") ?? "").trim();
  if (!dupla_id || !numero || !data_hora) return { error: "Data e horário são obrigatórios." };
  const { data: d } = await supabase.from("duplas").select("status").eq("id", dupla_id).single();
  if (d && d.status !== "ativa") return { error: "Essa dupla não está ativa." };
  const quando = parseDataHora(data_hora);
  if (!quando) return { error: "Data inválida." };

  // não derruba um encontro já realizado (re-agendar apagaria o "realizado")
  const { data: existente } = await supabase
    .from("encontros").select("id, status, data_hora").eq("dupla_id", dupla_id).eq("numero", numero).maybeSingle();
  if (existente?.status === "realizado") {
    return { error: "Esse encontro já foi realizado e não dá pra remarcar." };
  }

  // agendamento é sempre pra frente — encontro que já aconteceu entra pelo fluxo
  // retroativo (grava realizado_em); mover um agendado pro passado esconderia
  // atraso. A mensagem aponta o controle que EXISTE, por contexto.
  if (quando.getTime() <= Date.now()) {
    return {
      error: existente
        ? "Essa data já passou — se o encontro aconteceu, registre como foi ou marque 'não aconteceu' na ficha da dupla."
        : "Essa data já passou — use 'Registrar passado' na ficha da dupla ou na agenda do dia.",
    };
  }
  if (link && !urlOk(link)) return { error: "Link inválido." };
  if (!(ORIGENS as readonly string[]).includes(origem)) return { error: "Origem inválida." };

  const { data: maxEv } = await supabase
    .from("ciclo_eventos").select("numero")
    .eq("tipo", "encontro").order("numero", { ascending: false }).limit(1).maybeSingle();
  const maxNum = maxEv?.numero ?? 16;
  if (!Number.isInteger(numero) || numero < 1 || numero > maxNum) {
    return { error: "Número de encontro inválido." };
  }

  // remarcação de verdade = a data mudou; salvar de novo com a mesma data
  // (só pra trocar o link, p.ex.) não exige motivo nem mexe no já registrado.
  // compara o instante, não a string — PostgREST devolve "+00:00", toISOString "Z"
  const ehReagendamento =
    existente != null &&
    existente.data_hora != null &&
    new Date(existente.data_hora).getTime() !== quando.getTime();
  let motivoReagendamento: string | null = null;
  if (ehReagendamento) {
    if (!motivo) return { error: "Conte o motivo do reagendamento." };
    if (motivo === "outro") {
      if (motivoOutro.length < 2 || motivoOutro.length > 140) {
        return { error: "Descreva o motivo do reagendamento (2 a 140 caracteres)." };
      }
      motivoReagendamento = motivoOutro;
    } else {
      const preset = MOTIVOS_REAGENDAMENTO.find((m) => m.value === motivo);
      if (!preset) return { error: "Motivo de reagendamento inválido." };
      motivoReagendamento = preset.label;
    }
  }

  // update preserva created_by; insert é a primeira vez do encontro.
  // motivo_reagendamento só entra no payload quando houve remarcação — edição
  // que não muda a data não pode sobrescrever o motivo já auditado
  const payload = {
    data_hora: quando.toISOString(),
    link,
    origem,
    status: "agendado" as const,
    ...(motivoReagendamento ? { motivo_reagendamento: motivoReagendamento } : {}),
  };
  const { error } = existente
    ? await supabase.from("encontros").update(payload).eq("id", existente.id)
    : await supabase.from("encontros").insert({ ...payload, dupla_id, numero, created_by: eu.id });
  if (error) return { error: erroAmigavel(error) };
  revalidatePath("/");
  revalidatePath("/duplas");
  revalidatePath("/agenda");
  revalidatePath(`/duplas/${dupla_id}`);
  return { ok: true };
}

export async function marcarNaoAconteceu(encontroId: string, duplaId: string) {
  const { supabase, me: eu } = await me();
  if (!eu) return { error: "Sessão expirada — entre de novo." };
  // só encontro já passado de dupla ativa — UI esconde o botão, a action garante
  const { data: enc } = await supabase
    .from("encontros").select("data_hora, duplas(status)").eq("id", encontroId).single();
  if (enc && new Date(enc.data_hora).getTime() > Date.now()) {
    return { error: "Esse encontro ainda não aconteceu." };
  }
  const dupla = Array.isArray(enc?.duplas) ? enc?.duplas[0] : enc?.duplas;
  if (dupla && dupla.status !== "ativa") return { error: "Essa dupla não está ativa." };
  const { data, error } = await supabase
    .from("encontros")
    .update({ status: "nao_aconteceu" })
    .eq("id", encontroId)
    .eq("status", "agendado")
    .select("id");
  if (error) return { error: erroAmigavel(error) };
  if (!data?.length) return { error: "Esse encontro não está mais agendado." };
  revalidatePath("/");
  revalidatePath("/duplas");
  revalidatePath("/agenda");
  revalidatePath(`/duplas/${duplaId}`);
  return { ok: true };
}

export async function desfazerNaoAconteceu(encontroId: string, duplaId: string) {
  const { supabase, me: eu } = await me();
  if (!eu) return { error: "Sessão expirada — entre de novo." };
  const { data, error } = await supabase
    .from("encontros")
    .update({ status: "agendado" })
    .eq("id", encontroId)
    .eq("status", "nao_aconteceu")
    .select("id");
  if (error) return { error: erroAmigavel(error) };
  if (!data?.length) return { error: "Esse encontro não está marcado como não realizado." };
  revalidatePath("/");
  revalidatePath("/duplas");
  revalidatePath("/agenda");
  revalidatePath(`/duplas/${duplaId}`);
  return { ok: true };
}

/**
 * Encontro que já aconteceu sem agendamento prévio (combinado fora da
 * plataforma). Nasce direto como realizado — sem ele, a dupla ficava "em
 * atraso" no semáforo mesmo tendo se encontrado.
 */
export async function registrarEncontroRetroativo(
  duplaId: string,
  numero: number,
  dataHora: string,
): Promise<{ error?: string; ok?: boolean; encontroId?: string }> {
  const { supabase, me: eu } = await me();
  if (!eu) return { error: "Sessão expirada — entre de novo." };
  if (!duplaId || !numero || !dataHora) return { error: "Encontro e data são obrigatórios." };

  const { data: d } = await supabase
    .from("duplas").select("status, iniciada_em").eq("id", duplaId).single();
  if (!d) return { error: "Dupla não encontrada." };
  if (d.status === "encerrada") return { error: "Essa dupla está encerrada." };

  const quando = parseDataHora(dataHora);
  if (!quando) return { error: "Data inválida." };
  if (quando.getTime() > Date.now()) {
    return { error: "A data precisa ser de quando o encontro já aconteceu." };
  }

  // o ciclo real define o teto de numero e o piso de data (início da dupla ou do ciclo)
  const { data: evs } = await supabase
    .from("ciclo_eventos").select("numero, data")
    .eq("tipo", "encontro").order("numero", { ascending: true });
  const maxNum = evs?.at(-1)?.numero ?? 16;
  if (!Number.isInteger(numero) || numero < 1 || numero > maxNum) {
    return { error: "Número de encontro inválido." };
  }
  const piso = d.iniciada_em ?? evs?.[0]?.data ?? null;
  if (piso && quando < new Date(`${piso}T00:00:00-03:00`)) {
    return { error: "A data não pode ser antes do início da mentoria." };
  }

  // unique(dupla_id, numero) — check explícito pra mensagem clara antes do 23505
  const { data: existente } = await supabase
    .from("encontros").select("id").eq("dupla_id", duplaId).eq("numero", numero).maybeSingle();
  if (existente) return { error: "Já existe um encontro com esse número." };

  const { data: novo, error } = await supabase
    .from("encontros")
    .insert({
      dupla_id: duplaId,
      numero,
      data_hora: quando.toISOString(),
      realizado_em: quando.toISOString(),
      status: "realizado",
      origem: "externo",
      created_by: eu.id,
    })
    .select("id")
    .single();
  if (error) {
    if (error.code === "23505") return { error: "Já existe um encontro com esse número." };
    return { error: erroAmigavel(error) };
  }
  revalidatePath("/");
  revalidatePath("/duplas");
  revalidatePath("/agenda");
  revalidatePath(`/duplas/${duplaId}`);
  return { ok: true, encontroId: novo.id };
}

// ---------- registro (follow-up) ----------

const AVALIACOES = ["excelente", "boa", "regular", "baixa"] as const;
const DIFICULDADES = ["nenhuma", "aprendizagem", "participacao", "comportamental", "organizacao", "outro"] as const;
const PROXIMOS_PASSOS = ["continuar", "reforcar", "novo_feedback", "acompanhar_de_perto", "conversa_individual", "outro"] as const;

export async function salvarRegistro(formData: FormData) {
  const { supabase, me: eu } = await me();
  if (!eu) return { error: "Sessão expirada — entre de novo." };
  const encontro_id = String(formData.get("encontro_id") ?? "");
  const dupla_id = String(formData.get("dupla_id") ?? "");
  if (!encontro_id) return { error: "Encontro inválido." };

  // enums têm check constraint no banco — valida aqui pra erro claro em vez de 23514
  const avaliacao = String(formData.get("avaliacao") || "") || null;
  const dificuldade = String(formData.get("dificuldade") || "") || null;
  const proximoPasso = String(formData.get("proximo_passo") || "") || null;
  if ((avaliacao && !(AVALIACOES as readonly string[]).includes(avaliacao)) ||
      (dificuldade && !(DIFICULDADES as readonly string[]).includes(dificuldade)) ||
      (proximoPasso && !(PROXIMOS_PASSOS as readonly string[]).includes(proximoPasso))) {
    return { error: "Valor inválido em um dos campos do registro." };
  }

  const { data: d } = await supabase.from("duplas").select("status").eq("id", dupla_id).single();
  if (d && d.status !== "ativa") return { error: "Essa dupla não está ativa." };

  // só registra encontro da própria dupla que já aconteceu (ou foi marcado realizado)
  const { data: encDb } = await supabase
    .from("encontros")
    .select("dupla_id, numero, status, data_hora, realizado_em")
    .eq("id", encontro_id)
    .single();
  if (!encDb || encDb.dupla_id !== dupla_id) return { error: "Encontro inválido." };
  const jaPassou = encDb.data_hora != null && new Date(encDb.data_hora) <= new Date();
  if (encDb.status !== "realizado" && !jaPassou) {
    return { error: "Esse encontro ainda não aconteceu." };
  }

  const atividades = formData.getAll("atividade").map(String);
  const atividadeOutro = String(formData.get("atividade_outro") ?? "").trim();
  if (atividadeOutro) atividades.push(atividadeOutro);

  // update preserva created_by de quem registrou primeiro; insert marca o autor
  const { data: regExistente } = await supabase
    .from("registros").select("id, precisa_apoio").eq("encontro_id", encontro_id).maybeSingle();
  // pedido de apoio novo nessa gravação dispara aviso pra coordenação —
  // edição que mantém o flag não repete a notificação
  const novoApoio =
    !regExistente?.precisa_apoio && formData.get("precisa_apoio") === "on";
  const payload = {
    tema: String(formData.get("tema") ?? "").trim() || null,
    ferramenta: String(formData.get("ferramenta") ?? "").trim() || null,
    reflexoes: String(formData.get("reflexoes") ?? "").trim() || null,
    observacoes: String(formData.get("observacoes") ?? "").trim() || null,
    // pedido de apoio é "sticky": editar o registro não desmarca — só a
    // coordenação resolve (resolverApoio), então update faz OR com o que já está
    precisa_apoio:
      Boolean(regExistente?.precisa_apoio) || formData.get("precisa_apoio") === "on",
    atividades,
    avaliacao,
    dificuldade,
    dificuldade_detalhe: String(formData.get("dificuldade_detalhe") ?? "").trim() || null,
    proximo_passo: proximoPasso,
    proximo_passo_detalhe: String(formData.get("proximo_passo_detalhe") ?? "").trim() || null,
  };
  const { data: registro, error } = regExistente
    ? await supabase.from("registros").update(payload).eq("id", regExistente.id).select("id").single()
    : await supabase
        .from("registros").insert({ ...payload, encontro_id, created_by: eu.id }).select("id").single();
  if (error) return { error: erroAmigavel(error) };

  // realizado_em = quando aconteceu de fato; preserva data informada no
  // registro retroativo e cai em data_hora no fluxo normal agendado→realizado
  const { data: encOk, error: encErr } = await supabase
    .from("encontros")
    .update({ status: "realizado", realizado_em: encDb.realizado_em ?? encDb.data_hora })
    .eq("id", encontro_id).select("id");
  if (encErr) return { error: erroAmigavel(encErr) };
  if (!encOk?.length) {
    return { error: "Não foi possível concluir. Recarregue a página e tente de novo." };
  }

  // encaminhamentos vêm como JSON por linha (descrição pode ter qualquer caractere)
  const enc = formData
    .getAll("encaminhamento")
    .map(String)
    .flatMap((line) => {
      try {
        const t = JSON.parse(line);
        const descricao = String(t.descricao ?? "").trim();
        if (!descricao) return [];
        return [{
          descricao,
          responsavel: t.responsavel === "mentor" ? "mentor" : "mentorado",
          prazo: t.prazo || null,
        }];
      } catch {
        return [];
      }
    });
  if (enc.length) {
    // re-submit (aba duplicada) não duplica o que já existe nesse registro
    const { data: existentes } = await supabase
      .from("encaminhamentos")
      .select("descricao, responsavel, prazo")
      .eq("registro_id", registro.id);
    const jaTem = new Set(
      (existentes ?? []).map((e) => `${e.descricao}|${e.responsavel}|${e.prazo ?? ""}`)
    );
    const rows = enc
      .filter((t) => !jaTem.has(`${t.descricao}|${t.responsavel}|${t.prazo ?? ""}`))
      .map((t) => ({ dupla_id, registro_id: registro.id, ...t }));
    if (rows.length) {
      const { error: encErr } = await supabase.from("encaminhamentos").insert(rows);
      if (encErr) return { error: erroAmigavel(encErr) };
    }
  }

  // combinados de encontros anteriores marcados como feitos neste registro —
  // best-effort: o registro já está salvo e falha aqui não o reverte; o form
  // avisa no toast (dupla_id no where impede concluir item de outra dupla)
  const concluirIds = [
    ...new Set(formData.getAll("concluir_encaminhamento").map(String).filter(Boolean)),
  ];
  let concluidos = 0;
  let aviso: string | undefined;
  if (concluirIds.length) {
    const { data: feitos, error: concErr } = await supabase
      .from("encaminhamentos")
      .update({ status: "feito" })
      .in("id", concluirIds)
      .eq("dupla_id", dupla_id)
      .select("id");
    if (concErr) {
      aviso = "Não foi possível marcar os combinados anteriores como feitos. Marque na lista de combinados.";
    } else {
      concluidos = feitos?.length ?? 0;
      if (concluidos < concluirIds.length) {
        aviso = `Só ${concluidos} de ${concluirIds.length} combinados foram marcados como feitos. Confira a lista de combinados.`;
      }
    }
  }

  if (novoApoio) {
    // coordenação toda + o supervisor dessa dupla (não todos os supervisores)
    const [{ data: equipe }, { data: dApoio }] = await Promise.all([
      supabase.from("profiles").select("id").eq("role", "coordenacao").eq("ativo", true),
      supabase.from("duplas").select("supervisor_id").eq("id", dupla_id).single(),
    ]);
    await notificar(supabase, [
      ...(equipe ?? []).map((p) => p.id),
      dApoio?.supervisor_id,
    ].map((pid) => ({
      profile_id: pid,
      tipo: "pedido_apoio",
      titulo: "Pedido de apoio",
      corpo: `${eu.nome} sinalizou no registro do ${encDb.numero}º encontro.`,
      href: `/duplas/${dupla_id}`,
    })), eu.id);
  }

  revalidatePath("/");
  revalidatePath("/duplas");
  revalidatePath("/agenda");
  revalidatePath(`/duplas/${dupla_id}`);
  return { ok: true, concluidos, aviso };
}

// ---------- notas do mentor (plano de aula / lembretes pré-encontro) ----------

/** Autosave do NotaEncontro — texto vazio apaga a row ("tem anotação" = row
 *  existe). Chave (dupla_id, numero): a nota precede o agendamento e segue o
 *  nº do encontro na remarcação. */
export async function salvarNotaEncontro(duplaId: string, numero: number, texto: string) {
  const { supabase, me: eu } = await me();
  if (!eu) return { error: "Sessão expirada — entre de novo." };
  if (eu.role !== "coordenacao" && eu.role !== "mentor_dpp" && eu.role !== "mentor_especialista") {
    return { error: "Você não tem permissão para essa ação." };
  }

  const { data: maxEv } = await supabase
    .from("ciclo_eventos").select("numero")
    .eq("tipo", "encontro").order("numero", { ascending: false }).limit(1).maybeSingle();
  const maxNum = maxEv?.numero ?? 16;
  if (!Number.isInteger(numero) || numero < 1 || numero > maxNum) {
    return { error: "Número de encontro inválido." };
  }

  const { data: d } = await supabase.from("duplas").select("status").eq("id", duplaId).single();
  if (d && d.status !== "ativa") return { error: "Essa dupla não está ativa." };

  const limpo = texto.trim();
  if (limpo.length > 10000) return { error: "Anotação muito longa (máx. 10.000 caracteres)." };

  if (!limpo) {
    const { error } = await supabase
      .from("encontro_notas").delete().eq("dupla_id", duplaId).eq("numero", numero);
    if (error) return { error: erroAmigavel(error) };
  } else {
    // update preserva created_by de quem anotou primeiro; insert marca o autor
    const { data: existente } = await supabase
      .from("encontro_notas").select("id").eq("dupla_id", duplaId).eq("numero", numero).maybeSingle();
    const { error } = existente
      ? await supabase.from("encontro_notas").update({ texto: limpo }).eq("id", existente.id)
      : await supabase.from("encontro_notas").insert({ dupla_id: duplaId, numero, texto: limpo, created_by: eu.id });
    if (error) return { error: erroAmigavel(error) };
  }

  revalidatePath("/agenda");
  revalidatePath(`/duplas/${duplaId}`);
  return { ok: true };
}

// ---------- mural de notas do perfil (/pessoas/[id]) ----------

/** Publica nota individual no mural da pessoa. O RLS faz o escopo pesado:
 *  staff em qualquer perfil; mentor só no mentorado da própria dupla.
 *  `.select("id")` detecta escrita bloqueada silenciosamente pela policy. */
export async function addPessoaNota({
  profileId,
  mentoradoId,
  texto,
}: {
  profileId?: string;
  mentoradoId?: string;
  texto: string;
}) {
  const { supabase, me: eu } = await me();
  if (!eu) return { error: "Sessão expirada — entre de novo." };
  const limpo = texto.trim();
  if (!limpo) return { error: "Escreva algo antes de publicar." };
  if (limpo.length > 10000) return { error: "Nota muito longa (máx. 10.000 caracteres)." };
  if (!profileId && !mentoradoId) return { error: "Pessoa inválida." };

  const { data, error } = await supabase
    .from("pessoa_notas")
    .insert({
      profile_id: profileId ?? null,
      mentorado_id: mentoradoId ?? null,
      texto: limpo,
      created_by: eu.id,
    })
    .select("id");
  if (error) return { error: erroAmigavel(error) };
  if (!data?.length) {
    return { error: "Você não tem permissão para anotar nesse perfil." };
  }
  revalidatePath(`/pessoas/${profileId ?? mentoradoId}`);
  return { ok: true };
}

/** Remove nota do mural — o autor ou a coordenação (policy garante). */
export async function deletePessoaNota(notaId: string, pessoaId: string) {
  const { supabase, me: eu } = await me();
  if (!eu) return { error: "Sessão expirada — entre de novo." };
  const { data, error } = await supabase
    .from("pessoa_notas").delete().eq("id", notaId).select("id");
  if (error) return { error: erroAmigavel(error) };
  if (!data?.length) {
    return { error: "Não foi possível apagar. Recarregue a página e tente de novo." };
  }
  revalidatePath(`/pessoas/${pessoaId}`);
  return { ok: true };
}

export async function toggleEncaminhamento(id: string, feito: boolean, duplaId: string) {
  const { supabase, me: eu } = await me();
  if (!eu) return { error: "Sessão expirada — entre de novo." };
  const { data, error } = await supabase
    .from("encaminhamentos")
    .update({ status: feito ? "feito" : "pendente" })
    .eq("id", id)
    .select("id");
  if (error) return { error: erroAmigavel(error) };
  if (!data?.length) {
    return { error: "Não foi possível concluir. Recarregue a página e tente de novo." };
  }
  revalidatePath("/");
  revalidatePath("/duplas");
  revalidatePath(`/duplas/${duplaId}`);
  return { ok: true };
}

export async function resolverApoio(registroId: string, duplaId: string) {
  const { supabase, me: eu } = await me();
  if (!eu) return { error: "Sessão expirada — entre de novo." };
  const { data, error } = await supabase
    .from("registros")
    .update({ precisa_apoio: false })
    .eq("id", registroId)
    .select("id, created_by");
  if (error) return { error: erroAmigavel(error) };
  if (!data?.length) {
    return { error: "Não foi possível concluir. Recarregue a página e tente de novo." };
  }
  // o mentor fica sabendo que o pedido foi visto — fecha o ciclo do pedido
  const { data: dApoio } = await supabase
    .from("duplas").select("mentor_id").eq("id", duplaId).single();
  await notificar(supabase, [{
    profile_id: data[0].created_by ?? dApoio?.mentor_id,
    tipo: "apoio_resolvido",
    titulo: "Pedido de apoio atendido",
    corpo: "A coordenação marcou seu pedido como atendido.",
    href: `/duplas/${duplaId}`,
  }], eu.id);
  revalidatePath("/");
  revalidatePath("/duplas");
  revalidatePath(`/duplas/${duplaId}`);
  return { ok: true };
}

// ---------- materiais ----------

const TIPOS_MATERIAL = ["guia", "template", "conteudo", "link"] as const;
const AUDIENCIAS_MATERIAL = ["todos", "dpp", "especialista", "coordenacao"] as const;

/** Path do arquivo oficial — gerado no client como `materiais/{uuid}-{nome-saneado}`. */
const MATERIAL_PATH_RE = /^materiais\/[0-9a-f-]{36}-[a-zA-Z0-9._-]+$/;

export async function salvarMaterial(formData: FormData) {
  const { supabase, me: eu } = await me();
  if (!eu) return { error: "Sessão expirada — entre de novo." };
  const titulo = String(formData.get("titulo") ?? "").trim();
  if (!titulo) return { error: "Título é obrigatório." };
  const tipo = String(formData.get("tipo") || "link");
  const audiencia = String(formData.get("audiencia") || "todos");
  if (!(TIPOS_MATERIAL as readonly string[]).includes(tipo) ||
      !(AUDIENCIAS_MATERIAL as readonly string[]).includes(audiencia)) {
    return { error: "Valor inválido para um dos campos." };
  }
  const url = String(formData.get("url") ?? "").trim() || null;
  if (url && !urlOk(url)) return { error: "Link inválido." };
  // a row precisa nascer já com path: a policy de INSERT do storage exige a row
  // com path = name. Com path, o arquivo é o destino (a url fica de lado).
  const path = String(formData.get("path") ?? "").trim() || null;
  if (path && !MATERIAL_PATH_RE.test(path)) {
    return { error: "Valor inválido para um dos campos." };
  }
  const encontroRaw = String(formData.get("encontro_num") ?? "").trim();
  const encontroNum = encontroRaw ? Number(encontroRaw) : null;
  const { data: maxEv } = await supabase
    .from("ciclo_eventos").select("numero")
    .eq("tipo", "encontro").order("numero", { ascending: false }).limit(1).maybeSingle();
  if (
    encontroRaw &&
    (!Number.isInteger(encontroNum) ||
      encontroNum! < 1 ||
      (maxEv?.numero != null && encontroNum! > maxEv.numero))
  ) {
    return { error: "Número de encontro inválido." };
  }
  const { data: novo, error } = await supabase.from("materiais").insert({
    titulo,
    descricao: String(formData.get("descricao") ?? "").trim() || null,
    tipo,
    url,
    path,
    audiencia,
    encontro_num: encontroNum,
  }).select("id").single();
  if (error) return { error: erroAmigavel(error) };
  revalidatePath("/materiais");
  // id volta pro client poder desfazer a row se o upload do arquivo falhar
  return { ok: true, id: novo.id as string };
}

/** Anexa arquivo a material existente: grava o path na row (o upload vem depois,
 *  via client — a policy do storage só aceita objeto com row path = name). */
export async function anexarArquivoMaterial(id: string, path: string) {
  const { supabase, me: eu } = await me();
  if (!eu) return { error: "Sessão expirada — entre de novo." };
  if (!MATERIAL_PATH_RE.test(path)) {
    return { error: "Valor inválido para um dos campos." };
  }
  const { data, error } = await supabase
    .from("materiais").update({ path }).eq("id", id).select("id");
  if (error) return { error: erroAmigavel(error) };
  if (!data?.length) {
    return { error: "Não foi possível concluir. Recarregue a página e tente de novo." };
  }
  revalidatePath("/materiais");
  return { ok: true };
}

/** Desfaz o vínculo do arquivo (path -> null). O objeto no storage é removido
 *  pelo client ANTES de chamar — aqui só zera a referência. */
export async function removerArquivoMaterial(id: string) {
  const { supabase, me: eu } = await me();
  if (!eu) return { error: "Sessão expirada — entre de novo." };
  const { data, error } = await supabase
    .from("materiais").update({ path: null }).eq("id", id).select("id");
  if (error) return { error: erroAmigavel(error) };
  if (!data?.length) {
    return { error: "Não foi possível concluir. Recarregue a página e tente de novo." };
  }
  revalidatePath("/materiais");
  return { ok: true };
}

// ---------- documentos oficiais ----------

/** Path do documento oficial — gerado no client como `documentos/{uuid}-{nome-saneado}`. */
const DOCUMENTO_PATH_RE = /^documentos\/[0-9a-f-]{36}-[a-zA-Z0-9._-]+$/;

/** Anexa o documento oficial à pessoa (termo do mentor, autorização do
 *  mentorado): grava documento_path na row — o upload vem depois, via client,
 *  e a policy do storage só aceita objeto com row documento_path = name.
 *  Documento sensível: só a coordenação (a RLS já barra, mas a checagem aqui
 *  devolve erro claro em vez de "0 rows"). */
export async function definirDocumentoPessoa(
  tipo: "profile" | "mentorado",
  id: string,
  path: string
) {
  const { supabase, me: eu } = await me();
  if (!eu) return { error: "Sessão expirada — entre de novo." };
  if (eu.role !== "coordenacao") {
    return { error: "Você não tem permissão para essa ação." };
  }
  if (!DOCUMENTO_PATH_RE.test(path)) {
    return { error: "Valor inválido para um dos campos." };
  }
  const { data, error } = await supabase
    .from(tipo === "mentorado" ? "mentorados" : "profiles")
    .update({ documento_path: path })
    .eq("id", id)
    .select("id");
  if (error) return { error: erroAmigavel(error) };
  if (!data?.length) {
    return { error: "Não foi possível concluir. Recarregue a página e tente de novo." };
  }
  revalidatePath("/pessoas");
  return { ok: true };
}

/** Desfaz o vínculo do documento (documento_path -> null). O objeto no storage
 *  é removido pelo client ANTES de chamar — aqui só zera a referência. */
export async function removerDocumentoPessoa(
  tipo: "profile" | "mentorado",
  id: string
) {
  const { supabase, me: eu } = await me();
  if (!eu) return { error: "Sessão expirada — entre de novo." };
  if (eu.role !== "coordenacao") {
    return { error: "Você não tem permissão para essa ação." };
  }
  const { data, error } = await supabase
    .from(tipo === "mentorado" ? "mentorados" : "profiles")
    .update({ documento_path: null })
    .eq("id", id)
    .select("id");
  if (error) return { error: erroAmigavel(error) };
  if (!data?.length) {
    return { error: "Não foi possível concluir. Recarregue a página e tente de novo." };
  }
  revalidatePath("/pessoas");
  return { ok: true };
}

// ---------- meu perfil (self-service) ----------

export async function updateMeuPerfil(formData: FormData) {
  const { supabase, me: eu } = await me();
  if (!eu) return { error: "Sessão expirada — entre de novo." };
  const nome = normNome(String(formData.get("nome") ?? ""));
  const whatsappRaw = String(formData.get("whatsapp") ?? "");
  const whatsapp = normWhatsapp(whatsappRaw);
  if (!nome) return { error: "Informe seu nome." };
  if (whatsappRaw.trim() && !whatsapp) return { error: "WhatsApp inválido." };

  // role/ativo/user_id ficam fora do patch — profiles_self_update também
  // barra role no banco, mas nem depende disso: a coluna nem é enviada
  const { error } = await supabase
    .from("profiles")
    .update({ nome, whatsapp: whatsapp || null })
    .eq("id", eu.id);
  if (error) return { error: erroAmigavel(error) };
  revalidatePath("/", "layout");
  return { ok: true };
}

/** path novo já subiu no bucket `avatares` pelo client — aqui persiste a
 *  referência e remove o arquivo antigo (pasta <profile_id>/ é só dele). */
export async function setAvatarPath(path: string | null) {
  const { supabase, me: eu } = await me();
  if (!eu) return { error: "Sessão expirada — entre de novo." };
  if (path != null && !path.startsWith(`${eu.id}/`)) {
    return { error: "Arquivo inválido." };
  }

  const { data: atual } = await supabase
    .from("profiles")
    .select("avatar_path")
    .eq("id", eu.id)
    .single();
  const { error } = await supabase
    .from("profiles")
    .update({ avatar_path: path })
    .eq("id", eu.id);
  if (error) return { error: erroAmigavel(error) };

  const antigo = atual?.avatar_path;
  if (antigo && antigo !== path) {
    await supabase.storage.from("avatares").remove([antigo]);
  }
  revalidatePath("/", "layout");
  return { ok: true };
}

// ---------- auth ----------

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

// ---------- comunicados & notificações ----------

const AUDIENCIAS_COMUNICADO = ["todos", "dpp", "especialista", "coordenacao"] as const;
const ROLES_POR_AUDIENCIA: Record<string, string[]> = {
  todos: ["coordenacao", "supervisor", "mentor_dpp", "mentor_especialista"],
  dpp: ["mentor_dpp"],
  especialista: ["mentor_especialista"],
  coordenacao: ["coordenacao"],
};

/** Aviso geral da coordenação — grava o comunicado e cria a notificação de
 *  cada destinatário da audiência (o autor não se notifica do próprio aviso). */
export async function publicarComunicado(formData: FormData) {
  const { supabase, me: eu } = await me();
  if (!eu) return { error: "Sessão expirada — entre de novo." };
  if (eu.role !== "coordenacao") return { error: "Só a coordenação publica avisos." };
  const titulo = String(formData.get("titulo") ?? "").trim();
  const corpo = String(formData.get("corpo") ?? "").trim();
  const audiencia = String(formData.get("audiencia") ?? "todos");
  if (titulo.length < 2 || titulo.length > 140) {
    return { error: "O título precisa de 2 a 140 caracteres." };
  }
  if (corpo.length < 2 || corpo.length > 5000) {
    return { error: "O texto precisa de 2 a 5000 caracteres." };
  }
  if (!(AUDIENCIAS_COMUNICADO as readonly string[]).includes(audiencia)) {
    return { error: "Audiência inválida." };
  }

  const { data: aviso, error } = await supabase
    .from("comunicados")
    .insert({ titulo, corpo, audiencia, created_by: eu.id })
    .select("id").single();
  if (error) return { error: erroAmigavel(error) };

  const { data: dests } = await supabase
    .from("profiles").select("id")
    .in("role", ROLES_POR_AUDIENCIA[audiencia]).eq("ativo", true);
  const resumo = corpo.length > 180 ? `${corpo.slice(0, 177)}…` : corpo;
  await notificar(supabase, (dests ?? []).map((p) => ({
    profile_id: p.id,
    tipo: "comunicado",
    titulo,
    corpo: resumo,
    href: "/#avisos",
    comunicado_id: aviso?.id,
  })), eu.id);

  revalidatePath("/");
  return { ok: true };
}

export async function excluirComunicado(id: string) {
  const { supabase, me: eu } = await me();
  if (!eu) return { error: "Sessão expirada — entre de novo." };
  const { data, error } = await supabase
    .from("comunicados").delete().eq("id", id).select("id");
  if (error) return { error: erroAmigavel(error) };
  if (!data?.length) {
    return { error: "Não foi possível excluir. Recarregue a página e tente de novo." };
  }
  revalidatePath("/");
  return { ok: true };
}

/** Poll do sino — mesma leitura de getNotificacoes, mas como action pra rodar
 *  no intervalo do client sem navegação. */
export async function listarNotificacoes() {
  const { supabase, me: eu } = await me();
  if (!eu) return { error: "Sessão expirada — entre de novo." };
  const [{ data }, { count }] = await Promise.all([
    supabase
      .from("notificacoes")
      .select("id, tipo, titulo, corpo, href, lida_em, created_at")
      .order("created_at", { ascending: false })
      .limit(15),
    supabase
      .from("notificacoes")
      .select("*", { count: "exact", head: true })
      .eq("profile_id", eu.id)
      .is("lida_em", null),
  ]);
  return { ok: true, itens: data ?? [], naoLidas: count ?? 0 };
}

export async function marcarNotificacaoLida(id: string) {
  const { supabase, me: eu } = await me();
  if (!eu) return { error: "Sessão expirada — entre de novo." };
  const { error } = await supabase
    .from("notificacoes")
    .update({ lida_em: new Date().toISOString() })
    .eq("id", id)
    .eq("profile_id", eu.id)
    .is("lida_em", null);
  if (error) return { error: "Não foi possível marcar como lida." };
  return { ok: true };
}

export async function marcarTodasNotificacoesLidas() {
  const { supabase, me: eu } = await me();
  if (!eu) return { error: "Sessão expirada — entre de novo." };
  const { error } = await supabase
    .from("notificacoes")
    .update({ lida_em: new Date().toISOString() })
    .eq("profile_id", eu.id)
    .is("lida_em", null);
  if (error) return { error: "Não foi possível marcar como lidas." };
  return { ok: true };
}
