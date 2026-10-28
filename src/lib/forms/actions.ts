"use server";

import { randomBytes } from "crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { demoAtivo } from "../demo/mode";
import { DEMO_MSG } from "../demo/shared";
import {
  INSTRUMENTOS_SISTEMA,
  validaCampos,
  type FormularioCampo,
  type FormularioSistema,
  type RespostaValor,
} from "./schema";
import { erroAmigavel as erroAmigavelBase } from "../utils";
import type { CorRaca, Genero, PrefGeneroPar } from "../types";

// Actions da engine de formulários (0034).
// · coordenação: salvar/ativar/excluir forms, gerar e revogar links
// · público: submeterRespostaFormulario — vai pela RPC security definer (o
//   token é o fator de posse; validação real mora no banco)

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** base64url de 24 bytes = 32 chars; aceita folga pra esquemas futuros e os
 *  tokens legíveis da demo */
const TOKEN_RE = /^[A-Za-z0-9_-]{20,128}$/;

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

type EuCoord = { id: string; role: string; nome: string };

async function meCoord(): Promise<
  | { supabase: Awaited<ReturnType<typeof createClient>>; eu: EuCoord; error: null }
  | { supabase: Awaited<ReturnType<typeof createClient>>; eu: null; error: string }
> {
  const { supabase, me: eu } = await me();
  if (!eu)
    return { supabase, eu: null, error: "Sessão expirada. Entre de novo." };
  if (eu.role !== "coordenacao")
    return { supabase, eu: null, error: "Só a coordenação gerencia formulários." };
  return { supabase, eu, error: null };
}

/** Erro de UI do motor de formulários — P0001 = raise exception de trigger
 *  de domínio (ex.: guard de formulário oficial, 0042): a mensagem já é pt-BR
 *  pensada pra UI e passa direto; o resto segue a tradução comum. */
function erroAmigavel(e: { message: string; code?: string }): string {
  if (e.code === "P0001" && e.message) return e.message;
  return erroAmigavelBase(e);
}

// ---------- formulários ----------

export async function salvarFormulario(input: {
  id?: string;
  titulo: string;
  descricao: string | null;
  campos: unknown;
}): Promise<{ error: string } | { ok: true; id: string }> {
  if (await demoAtivo()) return { error: DEMO_MSG };
  const { supabase, eu, error } = await meCoord();
  if (error || !eu) return { error: error! };

  const titulo = String(input.titulo ?? "").trim();
  if (titulo.length < 3 || titulo.length > 140)
    return { error: "O título precisa ter entre 3 e 140 caracteres." };
  const descricao = String(input.descricao ?? "").trim() || null;
  if (descricao && descricao.length > 2000)
    return { error: "A descrição passa de 2.000 caracteres." };

  const campos = validaCampos(input.campos);
  if (!Array.isArray(campos)) return campos;
  const camposOk: FormularioCampo[] = campos;

  if (!input.id) {
    const { data, error: insErr } = await supabase
      .from("formularios")
      .insert({ titulo, descricao, campos: camposOk, created_by: eu.id })
      .select("id")
      .single();
    if (insErr) return { error: erroAmigavel(insErr) };
    revalidatePath("/formularios");
    return { ok: true, id: data.id };
  }

  // edição: compara campos pra subir a versão — resposta antiga guarda só o
  // id do campo; a versão na row diz que a definição mudou
  const { data: atual, error: getErr } = await supabase
    .from("formularios")
    .select("id, campos, versao")
    .eq("id", input.id)
    .maybeSingle();
  if (getErr) return { error: erroAmigavel(getErr) };
  if (!atual) return { error: "Formulário não encontrado." };

  const mudouCampos =
    JSON.stringify(atual.campos) !== JSON.stringify(camposOk);
  const { data, error: upErr } = await supabase
    .from("formularios")
    .update({
      titulo,
      descricao,
      campos: camposOk,
      ...(mudouCampos ? { versao: (atual.versao as number) + 1 } : {}),
    })
    .eq("id", input.id)
    .select("id");
  if (upErr) return { error: erroAmigavel(upErr) };
  if (!data?.length) return { error: "Formulário não encontrado." };
  revalidatePath("/formularios");
  revalidatePath(`/formularios/${input.id}`);
  return { ok: true, id: input.id };
}

export async function setFormularioAtivo(id: string, ativo: boolean) {
  if (await demoAtivo()) return { error: DEMO_MSG };
  const { supabase, error } = await meCoord();
  if (error) return { error };
  const { data, error: upErr } = await supabase
    .from("formularios")
    .update({ ativo })
    .eq("id", id)
    .select("id");
  if (upErr) return { error: erroAmigavel(upErr) };
  if (!data?.length) return { error: "Formulário não encontrado." };
  revalidatePath("/formularios");
  revalidatePath(`/formularios/${id}`);
  return { ok: true };
}

export async function excluirFormulario(id: string) {
  if (await demoAtivo()) return { error: DEMO_MSG };
  const { supabase, error } = await meCoord();
  if (error) return { error };
  // cascade apaga links e respostas — é a única forma de remover respostas
  const { error: delErr } = await supabase
    .from("formularios")
    .delete()
    .eq("id", id);
  if (delErr) return { error: erroAmigavel(delErr) };
  revalidatePath("/formularios");
  redirect("/formularios");
}

// ---------- links ----------

// REALIZA-16: o destino é sempre nominado — "generico" saiu do union na
// mesma mudança em que o banco passou a exigir âncora (0116). Divulgação
// aberta usa o link de inscrição (origem='intake', multi_uso) dos forms
// oficiais — é o único genérico que continua existindo, com reconciliação
// por promoção em vez de identidade no link.
export type DestinoLink =
  | { tipo: "profile"; id: string }
  | { tipo: "mentorado"; id: string };

/** Dupla de contexto do destinatário — a resposta sabe a quem/a qual dupla
 *  pertence sem o coordenador precisar informar. Mentor → sua dupla ativa;
 *  mentorado → a dele. Sem dupla ativa, fica null mesmo.
 *  Sempre a dupla DPP: um mentorado com trilha de especialista ativa tinha
 *  o link (ex.: 360º do encerramento) carimbado nela — e a resposta caía
 *  numa dupla que nenhuma superfície de jornada enxerga. */
async function duplaDoDestino(
  supabase: Awaited<ReturnType<typeof createClient>>,
  dest: DestinoLink
): Promise<string | null> {
  const col = dest.tipo === "profile" ? "mentor_id" : "mentorado_id";
  const { data } = await supabase
    .from("duplas")
    .select("id")
    .eq(col, dest.id)
    .neq("trilha", "especialista")
    .in("status", ["ativa", "pausada"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data?.id ?? null;
}

const VALIDADES_DIAS = new Set([7, 15, 30, 60]);

/** Link vigente devolvido pela geração — criado agora ou pendente
 *  reutilizado; alimenta o estado "links prontos" dos dialogs (e o
 *  auto-copiar do genérico). */
export type LinkEmitido = {
  id: string;
  tipo: "profile" | "mentorado" | "generico";
  dest_id: string | null;
  token: string;
  expira_em: string | null;
};

export async function gerarLinksFormulario(input: {
  formularioId: string;
  destinos: DestinoLink[];
  diasValidade?: number | null;
}) {
  if (await demoAtivo()) return { error: DEMO_MSG };
  const { supabase, eu, error } = await meCoord();
  if (error || !eu) return { error: error! };

  if (!UUID_RE.test(input.formularioId))
    return { error: "Formulário inválido." };
  // payload arbitrário: um "generico" solto (client antigo, POST manual)
  // erra cedo com copy clara — o banco rejeitaria pelo check de âncora de
  // qualquer jeito (0116), mas a explicação mora aqui, não no 23514
  if (
    (input.destinos ?? []).some(
      (d) => (d as { tipo?: string })?.tipo === "generico"
    )
  )
    return {
      error:
        "Links genéricos não são mais aceitos — escolha um destinatário. Pra divulgação aberta, use o link de inscrição do formulário oficial de intake.",
    };
  const destinos = (input.destinos ?? []).filter(
    (d): d is DestinoLink =>
      !!d &&
      (d.tipo === "profile" || d.tipo === "mentorado") &&
      UUID_RE.test(d.id)
  );
  // dedupe do pedido — a UI manda Set, mas o payload é arbitrário: dois
  // destinos iguais no mesmo lote inseririam dois links vivos
  const chavesVistas = new Set<string>();
  const unicos = destinos.filter((d) => {
    const k = `${d.tipo}:${d.id}`;
    if (chavesVistas.has(k)) return false;
    chavesVistas.add(k);
    return true;
  });
  if (!unicos.length) return { error: "Escolha ao menos um destinatário." };
  if (unicos.length > 200)
    return { error: "Gere os links em lotes de até 200 destinatários." };
  const dias =
    input.diasValidade && VALIDADES_DIAS.has(input.diasValidade)
      ? input.diasValidade
      : null;
  const expira_em = dias
    ? new Date(Date.now() + dias * 24 * 3600 * 1000).toISOString()
    : null;

  const { data: form, error: fErr } = await supabase
    .from("formularios")
    .select("id, sistema")
    .eq("id", input.formularioId)
    .maybeSingle();
  if (fErr) return { error: erroAmigavel(fErr) };
  if (!form) return { error: "Formulário não encontrado." };
  // os 4 instrumentos de jornada têm via própria (RPC emitir_link_instrumento
  // pela seção Instrumentos da ficha — o mentor entrega no tempo do guia e o
  // link já nasce com o contexto certo). O caminho genérico geraria um link
  // de fora da trilha. 360º segue por aqui mesmo.
  // A avaliação da trilha de especialista (0104) é emitida sozinha pelo
  // encerramento — um link manual pra mesma (form, dest, dupla) seria
  // absorvido pelo dedup da RPC e a notificação não sairia.
  if (
    (INSTRUMENTOS_SISTEMA as readonly string[]).includes(
      (form.sistema as FormularioSistema | null) ?? ""
    )
  )
    return {
      error:
        "Instrumento de jornada se emite pela ficha da dupla (Instrumentos → Enviar link).",
    };
  if (form.sistema === "avaliacao_especialista")
    return {
      error:
        "A avaliação geral da trilha é emitida sozinha quando a trilha de especialista é encerrada.",
    };

  // links pendentes já emitidos — reenviar pro mesmo destinatário reutiliza o
  // token existente (evita dois links válidos pra mesma pessoa). O genérico
  // legado (pré-0116) segue mapeado em "generico" — só pra não colidir com
  // ninguém; nenhum destino novo chega com essa chave.
  const { data: existentes, error: exErr } = await supabase
    .from("formulario_links")
    .select("id, token, dest_profile_id, dest_mentorado_id, usado_em, expira_em")
    .eq("formulario_id", input.formularioId)
    .is("usado_em", null);
  if (exErr) return { error: erroAmigavel(exErr) };
  const agora = Date.now();
  const pendentePorDest = new Map<string, string>();
  for (const l of existentes ?? []) {
    if (l.expira_em && new Date(l.expira_em).getTime() < agora) continue;
    const key = l.dest_profile_id ?? l.dest_mentorado_id ?? "generico";
    pendentePorDest.set(key, l.id);
  }

  let criados = 0;
  let reutilizados = 0;
  for (const dest of unicos) {
    if (pendentePorDest.has(dest.id)) {
      reutilizados++;
      continue;
    }
    const dupla_id = await duplaDoDestino(supabase, dest);
    const { error: insErr } = await supabase.from("formulario_links").insert({
      formulario_id: input.formularioId,
      token: randomBytes(24).toString("base64url"),
      dest_profile_id: dest.tipo === "profile" ? dest.id : null,
      dest_mentorado_id: dest.tipo === "mentorado" ? dest.id : null,
      dupla_id,
      expira_em,
      created_by: eu.id,
    });
    if (insErr) return { error: erroAmigavel(insErr) };
    criados++;
  }

  // relê os vigentes destes destinos — criados agora + pendentes reutilizados
  // voltam pro caller exibir/copiar sem perseguir a lista (ordem do pedido)
  const { data: vigentes } = await supabase
    .from("formulario_links")
    .select("id, token, dest_profile_id, dest_mentorado_id, expira_em")
    .eq("formulario_id", input.formularioId)
    .is("usado_em", null);
  const agora2 = Date.now();
  const vigentesDestes = (vigentes ?? []).filter(
    (l) => !l.expira_em || new Date(l.expira_em).getTime() > agora2
  );
  const links: LinkEmitido[] = [];
  const vistos = new Set<string>();
  for (const dest of unicos) {
    const l = vigentesDestes.find(
      (v) =>
        v.dest_profile_id === (dest.tipo === "profile" ? dest.id : null) &&
        v.dest_mentorado_id === (dest.tipo === "mentorado" ? dest.id : null)
    );
    if (!l || vistos.has(l.id)) continue;
    vistos.add(l.id);
    links.push({
      id: l.id,
      tipo: l.dest_profile_id
        ? "profile"
        : l.dest_mentorado_id
          ? "mentorado"
          : "generico",
      dest_id: l.dest_profile_id ?? l.dest_mentorado_id,
      token: l.token,
      expira_em: l.expira_em,
    });
  }

  revalidatePath(`/formularios/${input.formularioId}`);
  return { ok: true, criados, reutilizados, links };
}

/** Reemissão de link expirado: mesmo destinatário e dupla, token novo — o
 *  token velho (já morto) morre de vez. A janela de validade original se
 *  repete (created_at→expira_em do link vencido vira agora→novo prazo); link
 *  que venceu sem validade volta sem validade. */
export async function reemitirLinkFormulario(linkId: string, formularioId: string) {
  if (await demoAtivo()) return { error: DEMO_MSG };
  const { supabase, error } = await meCoord();
  if (error) return { error };
  if (!UUID_RE.test(linkId)) return { error: "Link inválido." };
  const { data: link, error: getErr } = await supabase
    .from("formulario_links")
    .select("id, usado_em, expira_em, created_at")
    .eq("id", linkId)
    .maybeSingle();
  if (getErr) return { error: erroAmigavel(getErr) };
  if (!link) return { error: "Link não encontrado." };
  if (link.usado_em)
    return { error: "Esse link já foi respondido. Não dá pra reemitir." };
  const agora = Date.now();
  if (!link.expira_em || new Date(link.expira_em).getTime() > agora)
    return { error: "Só dá pra reemitir link expirado. Este ainda vale." };

  const expira_em = new Date(
    agora +
      (new Date(link.expira_em).getTime() - new Date(link.created_at).getTime())
  ).toISOString();

  const token = randomBytes(24).toString("base64url");
  // .is("usado_em", null) trava a corrida com uma resposta que chegue entre
  // a leitura e o update — link respondido nunca troca de token
  const { data: atualizado, error: upErr } = await supabase
    .from("formulario_links")
    .update({ token, expira_em })
    .eq("id", linkId)
    .is("usado_em", null)
    .select("id");
  if (upErr) return { error: erroAmigavel(upErr) };
  if (!atualizado?.length)
    return { error: "Esse link acabou de ser respondido. Não dá pra reemitir." };
  revalidatePath(`/formularios/${formularioId}`);
  return { ok: true, token };
}

/** Remove um link ainda não respondido — o cascade levaria a resposta junto,
 *  então link usado é protegido (pra apagar resposta, exclui-se o form). */
export async function excluirLinkFormulario(linkId: string, formularioId: string) {
  if (await demoAtivo()) return { error: DEMO_MSG };
  const { supabase, error } = await meCoord();
  if (error) return { error };
  if (!UUID_RE.test(linkId)) return { error: "Link inválido." };
  const { data, error: delErr } = await supabase
    .from("formulario_links")
    .delete()
    .eq("id", linkId)
    .is("usado_em", null)
    .select("id");
  if (delErr) return { error: erroAmigavel(delErr) };
  if (!data?.length)
    return { error: "Esse link já foi respondido. A resposta iria junto." };
  revalidatePath(`/formularios/${formularioId}`);
  return { ok: true };
}

/** Reconciliação retroativa (REALIZA-16, plano B): um link genérico legado
 *  (manual, sem as três âncoras — só existem os emitidos antes do check de
 *  0116) ganha `dest_mentorado_id` + a dupla DPP dele quando houver — a
 *  resposta passa a contar na jornada dessa pessoa. A trilha de quem
 *  vinculou fica na timeline da dupla (interacoes 'vinculo_resposta') ou,
 *  sem dupla, na caderneta da pessoa (pessoa_notas) — autor e timestamp em
 *  qualquer caso. A resposta de intake não entra aqui: ela vira cadastro
 *  pela promoção (promoverRespostaIntake). */
export async function vincularRespostaOrfa(linkId: string, mentoradoId: string) {
  if (await demoAtivo()) return { error: DEMO_MSG };
  const { supabase, eu, error } = await meCoord();
  if (error || !eu) return { error: error! };
  if (!UUID_RE.test(linkId)) return { error: "Link inválido." };
  if (!UUID_RE.test(mentoradoId)) return { error: "Mentorado inválido." };

  const { data: link, error: lErr } = await supabase
    .from("formulario_links")
    .select(
      `id, formulario_id, dest_profile_id, dest_mentorado_id, dupla_id,
       multi_uso, origem,
       formulario:formularios(titulo)`
    )
    .eq("id", linkId)
    .maybeSingle();
  if (lErr) return { error: erroAmigavel(lErr) };
  if (!link) return { error: "Link não encontrado." };
  if (link.multi_uso || link.origem === "intake")
    return {
      error:
        "Resposta de inscrição não se vincula assim — ela vira cadastro pela revisão (Revisar e cadastrar).",
    };
  if (link.dest_profile_id || link.dest_mentorado_id || link.dupla_id)
    return { error: "Esse link já está vinculado." };

  const { data: m, error: mErr } = await supabase
    .from("mentorados")
    .select("id, nome")
    .eq("id", mentoradoId)
    .maybeSingle();
  if (mErr) return { error: erroAmigavel(mErr) };
  if (!m) return { error: "Mentorado não encontrado." };

  const dupla_id = await duplaDoDestino(supabase, {
    tipo: "mentorado",
    id: mentoradoId,
  });
  // guards `.is null` nas três âncoras: dois coordenadores vinculando ao
  // mesmo tempo não se sobrescrevem — o segundo re-lê a linha vazia
  const { data: vinculado, error: upErr } = await supabase
    .from("formulario_links")
    .update({ dest_mentorado_id: mentoradoId, dupla_id })
    .eq("id", linkId)
    .is("dest_profile_id", null)
    .is("dest_mentorado_id", null)
    .is("dupla_id", null)
    .select("id");
  if (upErr) return { error: erroAmigavel(upErr) };
  if (!vinculado?.length)
    return { error: "Esse link acabou de ser vinculado por outra pessoa." };

  const formTitulo = Array.isArray(link.formulario)
    ? link.formulario[0]?.titulo
    : (link.formulario as { titulo?: string } | null)?.titulo;
  let aviso: string | null = null;
  if (dupla_id) {
    const { error: logErr } = await supabase.from("interacoes").insert({
      dupla_id,
      autor_id: eu.id,
      canal: "in_app",
      tipo: "vinculo_resposta",
      nota: `Resposta de "${formTitulo ?? "formulário"}" vinculada retroativamente a ${m.nome}.`,
    });
    if (logErr) aviso = "Vinculado, mas o registro na timeline da dupla falhou.";
  } else {
    const { error: notaErr } = await supabase.from("pessoa_notas").insert({
      mentorado_id: mentoradoId,
      created_by: eu.id,
      texto: `Resposta de "${formTitulo ?? "formulário"}" vinculada retroativamente a esta pessoa.`,
    });
    if (notaErr)
      aviso = "Vinculado, mas o registro de auditoria na ficha falhou.";
  }

  revalidatePath(`/formularios/${link.formulario_id}`);
  revalidatePath(`/pessoas/${mentoradoId}`);
  if (dupla_id) revalidatePath(`/duplas/${dupla_id}`);
  return { ok: true, aviso };
}

// ---------- público: envio de resposta ----------

/** Mensagens levantadas pelas RPCs chegam em error.message — as de domínio
 *  são pt-BR e nomeiam a pergunta, então passam direto; o resto vira copy
 *  genérica (não vaza detalhe de infra). */
function traduzErroSubmit(message: string): string {
  if (/link inválido/i.test(message))
    return "Este link não é válido. Confira o endereço ou peça um novo à equipe Realiza.vc.";
  if (/link expirado/i.test(message))
    return "Este link expirou. Peça um novo à equipe Realiza.vc.";
  if (/formulário encerrado/i.test(message))
    return "Este formulário não está recebendo respostas no momento.";
  if (/outra pessoa/i.test(message))
    return "Este link é de outra pessoa. Saia da conta atual e abra o link de novo.";
  if (
    /^(Responda|Escolha|Marque|Opção inválida|Formato inválido|Use uma data|Anexe|Este link atingiu|Recebemos muitas)/i.test(
      message
    )
  )
    return message;
  return "Não foi possível enviar sua resposta. Tente de novo.";
}

export async function submeterRespostaFormulario(
  token: string,
  respostas: Record<string, RespostaValor>,
  honeypot: string
) {
  if (await demoAtivo()) return { error: DEMO_MSG };
  // honeypot: bot preencheu o campo invisível — finge sucesso e não grava
  if (honeypot && honeypot.trim()) return { ok: true };
  if (!token || !TOKEN_RE.test(token))
    return { error: "Este link não é válido." };
  if (!respostas || typeof respostas !== "object" || Array.isArray(respostas))
    return { error: "Respostas inválidas." };
  // teto de payload — jsonb arbitrário não pode entrar solto
  let serializado: string;
  try {
    serializado = JSON.stringify(respostas);
  } catch {
    return { error: "Respostas inválidas." };
  }
  if (serializado.length > 200_000)
    return { error: "Sua resposta ficou grande demais. Resuma os textos." };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("submeter_resposta_formulario", {
    p_token: token,
    p_respostas: respostas,
  });
  if (error) return { error: traduzErroSubmit(error.message) };
  if (!data) return { error: "Não foi possível enviar. Tente de novo." };
  return { ok: true };
}

// ---------- público: upload de anexo (intake, 0115) ----------

/** Upload de arquivo do form público — dois passos: o RPC form_anexo_put
 *  (security definer) valida o token vivo, confere que o campo é 'arquivo'
 *  na definição e o mime/tamanho contra ela, e registra os metadados; só
 *  então o service client grava o objeto no bucket privado. O anon nunca
 *  ganha write no storage — a policy do bucket é coord-read apenas. */
export async function subirAnexoFormulario(
  token: string,
  campoId: string,
  fd: FormData
) {
  if (await demoAtivo()) return { error: DEMO_MSG };
  if (!token || !TOKEN_RE.test(token))
    return { error: "Este link não é válido." };
  if (!campoId || campoId.length > 60)
    return { error: "Campo inválido." };
  const file = fd.get("file");
  if (!(file instanceof File) || file.size === 0)
    return { error: "Escolha um arquivo pra enviar." };
  if (file.size > 20 * 1024 * 1024)
    return { error: "O arquivo passa de 20 MB." };
  const nome = (file.name || "anexo").slice(0, 200);
  const ext = nome.toLowerCase().match(/\.([a-z0-9]+)$/)?.[1] ?? "";
  if (["exe", "svg", "js", "html", "htm", "bat", "cmd", "sh"].includes(ext))
    return { error: "Tipo de arquivo não aceito." };

  const supabase = await createClient();
  const { data: put, error: putErr } = await supabase.rpc("form_anexo_put", {
    p_token: token,
    p_campo_id: campoId,
    p_nome: nome,
    p_mime: file.type || "application/octet-stream",
    p_tamanho: file.size,
  });
  if (putErr || !put?.path)
    return {
      error:
        putErr?.code === "P0001" && putErr.message
          ? putErr.message
          : "Não foi possível enviar o arquivo. Tente de novo.",
    };

  const { createAdminClient } = await import("@/lib/supabase/admin");
  const admin = createAdminClient();
  const { error: upErr } = await admin.storage
    .from("form-anexos")
    .upload(put.path, file, { contentType: file.type, upsert: false });
  if (upErr) {
    // a linha de metadados órfã some junto — a resposta apontaria pra um
    // objeto que não existe (o sanitizer confere a linha, não o objeto)
    await admin.from("formulario_anexos").delete().eq("id", put.id);
    return { error: "Não foi possível enviar o arquivo. Tente de novo." };
  }
  return {
    ok: true,
    arquivo: { path: put.path as string, nome, tamanho: file.size },
  };
}

// ---------- link de inscrição (intake, 0115) ----------

const SISTEMAS_INTAKE = new Set(["intake_mentor", "intake_mentorado"]);

/** O link de inscrição do form oficial: UM link reutilizável por formulário
 *  (origem='intake', multi_uso). Vigente = não expirado; a desativação é
 *  expira_em=now() e gerar de novo cria um endereço novo. Devolve o token
 *  — a URL pública é /f/<token>. */
export async function gerarLinkIntake(formularioId: string) {
  if (await demoAtivo()) return { error: DEMO_MSG };
  const { supabase, eu, error } = await meCoord();
  if (error || !eu) return { error: error! };
  if (!UUID_RE.test(formularioId)) return { error: "Formulário inválido." };

  const { data: form, error: fErr } = await supabase
    .from("formularios")
    .select("id, sistema")
    .eq("id", formularioId)
    .maybeSingle();
  if (fErr) return { error: erroAmigavel(fErr) };
  if (!form) return { error: "Formulário não encontrado." };
  if (!SISTEMAS_INTAKE.has(form.sistema ?? ""))
    return { error: "Link de inscrição só existe nos formulários oficiais de intake." };

  const agora = new Date().toISOString();
  const { data: vigente, error: vErr } = await supabase
    .from("formulario_links")
    .select("id, token")
    .eq("formulario_id", formularioId)
    .eq("origem", "intake")
    .or(`expira_em.is.null,expira_em.gt.${agora}`)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (vErr) return { error: erroAmigavel(vErr) };
  if (vigente) return { ok: true, token: vigente.token, id: vigente.id };

  const { data: criado, error: insErr } = await supabase
    .from("formulario_links")
    .insert({
      formulario_id: formularioId,
      token: randomBytes(24).toString("base64url"),
      multi_uso: true,
      origem: "intake",
      created_by: eu.id,
    })
    .select("id, token")
    .single();
  if (insErr) return { error: erroAmigavel(insErr) };
  revalidatePath(`/formularios/${formularioId}`);
  return { ok: true, token: criado.token, id: criado.id };
}

/** Desativa o link de inscrição — o token morre na hora (o público cai no
 *  card de link expirado). Sem coluna `ativo`: expira_em=now() é o jeito
 *  que o schema já suporta; gerar de novo cria endereço novo. */
export async function desativarLinkIntake(linkId: string, formularioId: string) {
  if (await demoAtivo()) return { error: DEMO_MSG };
  const { supabase, error } = await meCoord();
  if (error) return { error };
  if (!UUID_RE.test(linkId)) return { error: "Link inválido." };
  const { data, error: upErr } = await supabase
    .from("formulario_links")
    .update({ expira_em: new Date().toISOString() })
    .eq("id", linkId)
    .eq("origem", "intake")
    .select("id");
  if (upErr) return { error: erroAmigavel(upErr) };
  if (!data?.length) return { error: "Link de inscrição não encontrado." };
  revalidatePath(`/formularios/${formularioId}`);
  return { ok: true };
}

// ---------- promoção: resposta → prefill do cadastro ----------

/** Lê a resposta do intake e devolve o mapa de campos pra abrir o cadastro
 *  de pessoa já preenchido (papel mentor_dpp). Não grava nada — o carimbo
 *  promovido_profile_id só acontece depois que a pessoa é criada de fato
 *  (createPessoa → finalizarPromocaoIntake). */
export async function promoverRespostaIntake(respostaId: string) {
  if (await demoAtivo()) return { error: DEMO_MSG };
  const { supabase, error } = await meCoord();
  if (error) return { error };
  if (!UUID_RE.test(respostaId)) return { error: "Resposta inválida." };

  const { data: r, error: rErr } = await supabase
    .from("formulario_respostas")
    .select(
      `id, respostas, promovido_profile_id, promovido_mentorado_id,
       link:formulario_links!inner(origem, multi_uso,
         formulario:formularios!inner(sistema))`
    )
    .eq("id", respostaId)
    .maybeSingle();
  if (rErr) return { error: erroAmigavel(rErr) };
  if (!r) return { error: "Resposta não encontrada." };
  const link = Array.isArray(r.link) ? r.link[0] : r.link;
  const form = Array.isArray(link?.formulario)
    ? link.formulario[0]
    : link?.formulario;
  if (link?.origem !== "intake" || link?.multi_uso !== true)
    return { error: "Só respostas do link de inscrição viram cadastro por aqui." };
  if (r.promovido_profile_id || r.promovido_mentorado_id)
    return { error: "Essa resposta já foi promovida a cadastro." };

  const { prefillDoIntake } = await import("./intake");
  const prefill = prefillDoIntake(
    (r.respostas as Record<string, RespostaValor>) ?? {}
  );
  if (!prefill.nome || !prefill.email)
    return {
      error:
        "A resposta não tem nome e e-mail preenchidos — cadastre pela ficha manual.",
    };
  // o sistema do form confirma a via de promoção — as duas vias de intake
  // (mentores e mentorados) usam o mesmo shape de resposta e prefill
  if (form?.sistema !== "intake_mentor" && form?.sistema !== "intake_mentorado")
    return { error: "Esse formulário não é um intake oficial." };
  return { ok: true, prefill, sistema: form.sistema as string };
}

/** Confirmação final da promoção (REALIZA-70): depois que a coordenação
 *  revisa o prefill (promoverRespostaIntake) e confirma, a pessoa é criada
 *  de verdade por aqui — profile mentor_dpp + mentor_profiles, ou
 *  mentorado na via da 69. Tudo é re-derivado no servidor: o client só
 *  manda o id da resposta, nunca os dados. O carimbo `promovido_*` é guard
 *  único (.is null) — duas confirmações simultâneas não criam duas pessoas:
 *  a segunda desfaz o insert e avisa. */
export async function finalizarPromocaoIntake(respostaId: string) {
  if (await demoAtivo()) return { error: DEMO_MSG };
  const { supabase, error } = await meCoord();
  if (error) return { error };
  if (!UUID_RE.test(respostaId)) return { error: "Resposta inválida." };

  const { data: r, error: rErr } = await supabase
    .from("formulario_respostas")
    .select(
      `id, respostas, promovido_profile_id, promovido_mentorado_id,
       link:formulario_links!inner(origem, multi_uso, formulario_id,
         formulario:formularios!inner(sistema, campos))`
    )
    .eq("id", respostaId)
    .maybeSingle();
  if (rErr) return { error: erroAmigavel(rErr) };
  if (!r) return { error: "Resposta não encontrada." };
  const link = Array.isArray(r.link) ? r.link[0] : r.link;
  const form = Array.isArray(link?.formulario)
    ? link.formulario[0]
    : link?.formulario;
  if (link?.origem !== "intake" || link?.multi_uso !== true)
    return { error: "Só respostas do link de inscrição viram cadastro por aqui." };
  if (r.promovido_profile_id || r.promovido_mentorado_id)
    return { error: "Essa resposta já foi promovida a cadastro." };
  const sistema = form?.sistema;
  const formularioId = link?.formulario_id as string | undefined;
  if (sistema !== "intake_mentor" && sistema !== "intake_mentorado")
    return { error: "Esse formulário não é um intake oficial." };

  const { prefillDoIntake, camposArquivo } = await import("./intake");
  const respostas = (r.respostas as Record<string, RespostaValor>) ?? {};
  const prefill = prefillDoIntake(respostas);
  if (!prefill.nome || !prefill.email)
    return {
      error:
        "A resposta não tem nome e e-mail preenchidos — cadastre pela ficha manual.",
    };

  const { createAdminClient } = await import("@/lib/supabase/admin");
  const admin = createAdminClient();
  // a origem diz de qual campanha a pessoa veio — o texto fixo do prefill
  // fala de mentores; a via de mentorado tem nome próprio (REALIZA-229)
  const origem =
    sistema === "intake_mentorado"
      ? "Inscrição pública (Matching de Mentorados)"
      : prefill.origem;
  const ficha = {
    nome_social: prefill.nome_social || null,
    data_nascimento: prefill.data_nascimento || null,
    genero: (prefill.genero || null) as Genero | null,
    cor_raca: (prefill.cor_raca || null) as CorRaca | null,
    cidade: prefill.cidade || null,
    uf: prefill.uf || null,
    pref_genero_par: (prefill.pref_genero_par || null) as PrefGeneroPar | null,
    origem,
  };

  let pessoaId: string | null = null;
  let pessoaTabela: "profiles" | "mentorados" = "profiles";
  if (sistema === "intake_mentor") {
    const { data: p, error: insErr } = await supabase
      .from("profiles")
      .insert({
        nome: prefill.nome,
        email: prefill.email,
        whatsapp: prefill.whatsapp || null,
        role: "mentor_dpp",
        cargo: prefill.cargo || null,
        empresa: prefill.empresa || null,
        motivacao: prefill.motivacao || null,
        ...ficha,
      })
      .select("id")
      .single();
    if (insErr || !p) {
      return { error: erroAmigavel(insErr ?? { message: "Falha no cadastro." }) };
    }
    pessoaId = p.id;
    const { error: mpErr } = await supabase.from("mentor_profiles").insert({
      profile_id: p.id,
      tipo: "dpp",
      capacidade: 1,
      experiencia_previa: prefill.experiencia_previa || null,
      formacao_externa: prefill.formacao_externa || null,
      disponibilidade: prefill.disponibilidade,
    });
    if (mpErr) {
      await supabase.from("profiles").delete().eq("id", p.id);
      return { error: erroAmigavel(mpErr) };
    }
  } else {
    pessoaTabela = "mentorados";
    const { data: m, error: insErr } = await supabase
      .from("mentorados")
      .insert({
        nome: prefill.nome,
        email: prefill.email || null,
        whatsapp: prefill.whatsapp || null,
        objetivos: prefill.motivacao || null,
        disponibilidade: prefill.disponibilidade,
        ...ficha,
      })
      .select("id")
      .single();
    if (insErr || !m) {
      return { error: erroAmigavel(insErr ?? { message: "Falha no cadastro." }) };
    }
    pessoaId = m.id;
  }

  // foto da inscrição vira avatar — copia bucket privado → avatares
  // (admin: anon não lê form-anexos). Falha aqui não derruba a promoção:
  // a ficha abre sem foto, o original segue na resposta.
  let aviso: string | null = null;
  const campoFoto = camposArquivo(
    (form?.campos as FormularioCampo[]) ?? []
  ).find((c) => c.id === "foto");
  const fotoVal = campoFoto ? respostas[campoFoto.id] : undefined;
  const foto =
    fotoVal && typeof fotoVal === "object" && !Array.isArray(fotoVal)
      ? (fotoVal as { path?: string; nome?: string })
      : null;
  if (foto?.path) {
    const { data: blob, error: dlErr } = await admin.storage
      .from("form-anexos")
      .download(foto.path);
    if (!dlErr && blob) {
      const ext =
        (foto.nome ?? "").toLowerCase().match(/\.([a-z0-9]+)$/)?.[1] ?? "jpg";
      const destino = `${pessoaId}/${crypto.randomUUID()}.${ext}`;
      const { error: upErr } = await admin.storage
        .from("avatares")
        .upload(destino, blob, { upsert: false });
      if (!upErr) {
        const { error: avErr } = await supabase
          .from(pessoaTabela)
          .update({ avatar_path: destino })
          .eq("id", pessoaId);
        if (avErr) aviso = "Cadastro feito, mas a foto não entrou. Suba na edição.";
      } else {
        aviso = "Cadastro feito, mas a foto não entrou. Suba na edição.";
      }
    } else {
      aviso = "Cadastro feito, mas a foto não entrou. Suba na edição.";
    }
  }

  // carimbo único: ganha quem chegar primeiro; o perdedor desfaz a pessoa
  // recém-criada pra não deixar cadastro órfão da resposta. Cada via tem a
  // própria coluna (profile × mentorado) porque a FK aponta pra tabelas
  // diferentes — gravar id de mentorado em promovido_profile_id violava a
  // FK e derrubava a promoção (REALIZA-229).
  const carimbo =
    sistema === "intake_mentorado"
      ? "promovido_mentorado_id"
      : "promovido_profile_id";
  const { data: marcada, error: markErr } = await admin
    .from("formulario_respostas")
    .update({ [carimbo]: pessoaId })
    .eq("id", respostaId)
    .is(carimbo, null)
    .select("id");
  if (markErr) {
    await supabase.from(pessoaTabela).delete().eq("id", pessoaId);
    return { error: erroAmigavel(markErr) };
  }
  if (!marcada?.length) {
    await supabase.from(pessoaTabela).delete().eq("id", pessoaId);
    return { error: "Essa resposta acabou de ser promovida em outra aba." };
  }

  revalidatePath(`/formularios/${formularioId}`);
  revalidatePath("/pessoas");
  return { ok: true, aviso, pessoaId, url: `/pessoas/${pessoaId}` };
}
