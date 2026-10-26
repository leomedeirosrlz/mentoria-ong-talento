"use server";

import { createClient } from "@/lib/supabase/server";
import {
  EMAIL_ENVIO_LIBERADO,
  enviarEmailsIndividuais,
  enviarEmailsLote,
  rolesParaAudiencias,
  SITE_URL,
} from "@/lib/email";
import {
  emailAviso,
  emailDesfechoJovem,
  emailDesfechoRepasseMentor,
  emailInstrumentoJovem,
  emailInstrumentoRepasseMentor,
  emailMaterial,
} from "@/lib/email-templates";
import { primeiroNome } from "@/components/forms/link-shared";
import {
  INSTRUMENTO_INFO,
  INSTRUMENTOS_SISTEMA,
  type InstrumentoSistema,
} from "@/lib/forms/schema";
import { erroAmigavel } from "@/lib/utils";
import { demoAtivo } from "./demo/mode";
import { DEMO_MSG } from "./demo/shared";
import type { ComunicadoPrioridade } from "@/lib/types";

type Supa = Awaited<ReturnType<typeof createClient>>;

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

/** Resumo de um disparo — também é o que vai pro log `emails_enviados`. */
export type ResumoEnvioEmail = {
  destinatarios: number;
  enviados: number;
  falhas: string[];
  /** Falha de configuração (ex.: sem RESEND_API_KEY) — nada foi tentado. */
  error?: string;
};

const AUDIENCIAS_EMAIL = [
  "todos",
  "dpp",
  "especialista",
  "equipe",
  "coordenacao",
] as const;

const TIPO_LABEL_MATERIAL: Record<string, string> = {
  guia: "Guia",
  template: "Modelo",
  conteudo: "Conteúdo",
  link: "Link",
};

/** Resolve os e-mails da audiência, dispara em lotes e grava o log em
 *  `emails_enviados`. Nunca lança — e-mail é complemento da ação principal;
 *  quem chama decide se o resumo vira toast, nota no retorno ou silêncio. */
export async function dispararParaRoles({
  tipo,
  refId,
  assunto,
  html,
  audiencias,
  autorId,
  supabase,
  excluirRoles,
}: {
  tipo: "comunicado" | "material";
  refId?: string | null;
  assunto: string;
  html: string;
  audiencias: string[];
  autorId: string;
  supabase: Supa;
  /** papéis a tirar do fan-out mesmo constando na audiência — o material
   *  com liberação programada (REALIZA-160) não vaza pro jovem por e-mail */
  excluirRoles?: string[];
}): Promise<ResumoEnvioEmail> {
  const roles = rolesParaAudiencias(audiencias, excluirRoles);
  try {
    // e-mail/whatsapp saíram do grant de coluna de profiles (0026): os
    // endereços vêm da view profiles_contato, que pra coordenação devolve
    // todo mundo. O filtro por papel vai no !inner de profile_papeis
    // (0085): a audiência vale pros papéis EFETIVOS, não só pro primário —
    // senão o híbrido via in-app (has_papel) mas o e-mail não chegaria
    const { data: pessoas, error: errPessoas } = await supabase
      .from("profiles")
      .select("id, profile_papeis!inner(papel)")
      .in("profile_papeis.papel", roles)
      .eq("ativo", true);
    if (errPessoas) console.error("dispararParaRoles: profiles", errPessoas);
    // !inner devolve o profile uma vez por linha de papel — dedupe por id
    const ids = [...new Set((pessoas ?? []).map((p) => p.id))];

    let emails: string[] = [];
    if (ids.length) {
      const { data: contatos, error: errContatos } = await supabase
        .from("profiles_contato")
        .select("id, email")
        .in("id", ids)
        .not("email", "is", null);
      if (errContatos) console.error("dispararParaRoles: contatos", errContatos);
      emails = [
        ...new Set(
          (contatos ?? [])
            .map((c) => c.email)
            .filter((e): e is string => !!e)
        ),
      ];
    }

    const envio = emails.length
      ? await enviarEmailsLote({ para: emails, assunto, html })
      : { enviados: 0, falhas: [] as string[] };
    const resumo: ResumoEnvioEmail = {
      destinatarios: emails.length,
      enviados: envio.enviados,
      falhas: envio.falhas,
      ...(envio.error ? { error: envio.error } : {}),
    };

    // o log é memória do disparo — falha nele não afeta o envio já feito
    const { error: errLog } = await supabase.from("emails_enviados").insert({
      autor_id: autorId,
      tipo,
      ref_id: refId ?? null,
      assunto,
      audiencia: audiencias,
      destinatarios: resumo.destinatarios,
      enviados: resumo.enviados,
      falhas: resumo.falhas,
    });
    if (errLog) console.error("dispararParaRoles: log", errLog);

    return resumo;
  } catch (e) {
    console.error("dispararParaRoles:", e);
    return {
      destinatarios: 0,
      enviados: 0,
      falhas: [],
      error: "Não foi possível enviar o e-mail.",
    };
  }
}

type AvisoEmail = {
  id: string;
  titulo: string;
  corpo: string;
  prioridade: ComunicadoPrioridade;
  audiencia: string;
};

/** E-mail do comunicado — assunto leva a prioridade quando ela pede atenção
 *  (normal entra limpo). Hook do publicarComunicado e base do reenvio. */
export async function dispararComunicadoEmail({
  supabase,
  aviso,
  autorId,
}: {
  supabase: Supa;
  aviso: AvisoEmail;
  autorId: string;
}): Promise<ResumoEnvioEmail> {
  const assunto =
    aviso.prioridade === "normal"
      ? aviso.titulo
      : `[${aviso.prioridade === "urgente" ? "Urgente" : "Importante"}] ${aviso.titulo}`;
  const html = emailAviso({
    titulo: aviso.titulo,
    corpo: aviso.corpo,
    prioridade: aviso.prioridade,
    ctaHref: `${SITE_URL}/#avisos`,
  });
  return dispararParaRoles({
    tipo: "comunicado",
    refId: aviso.id,
    assunto,
    html,
    audiencias: [aviso.audiencia],
    autorId,
    supabase,
  });
}

type MaterialEmail = {
  id: string;
  titulo: string;
  descricao: string | null;
  tipo: string;
  url: string | null;
  path: string | null;
};

/** E-mail de material — o CTA aponta pro destino real: arquivo passa pela
 *  rota /api/material que emite a signed URL (pede login se a sessão não
 *  estiver aberta); link externo vai direto. Hook do salvarMaterial e base
 *  do envio manual. */
export async function dispararMaterialEmail({
  supabase,
  material,
  audiencias,
  autorId,
  excluirRoles,
}: {
  supabase: Supa;
  material: MaterialEmail;
  audiencias: string[];
  autorId: string;
  excluirRoles?: string[];
}): Promise<ResumoEnvioEmail> {
  // mesma regra da página de materiais: path ganha da url; sem nenhum dos
  // dois o material está "a caminho" e o CTA cai na biblioteca
  const destino = material.path
    ? `${SITE_URL}/api/material/${material.id}`
    : (material.url ?? `${SITE_URL}/materiais`);
  const html = emailMaterial({
    titulo: material.titulo,
    descricao: material.descricao,
    tipoLabel: TIPO_LABEL_MATERIAL[material.tipo] ?? "Material",
    ctaHref: destino,
  });
  return dispararParaRoles({
    tipo: "material",
    refId: material.id,
    assunto: `Novo material: ${material.titulo}`,
    html,
    audiencias,
    autorId,
    supabase,
    excluirRoles,
  });
}

/** Traduz o resumo do disparo pro contrato dos actions — { error } ou
 *  { ok, enviados, destinatarios, falhas } pro caller montar o toast. */
function resumoParaResposta(resumo: ResumoEnvioEmail) {
  if (resumo.error) return { error: resumo.error };
  if (!resumo.destinatarios) {
    return { error: "Nenhum e-mail cadastrado nesse grupo." };
  }
  if (!resumo.enviados) {
    return { error: "Não foi possível enviar. Tente de novo." };
  }
  return {
    ok: true,
    enviados: resumo.enviados,
    destinatarios: resumo.destinatarios,
    falhas: resumo.falhas,
  };
}

/** Envio manual de material pela coordenação — o dialog marca os grupos de
 *  destinatários (independe da audiência do material: dá pra avisar a trilha
 *  DPP de um material de especialista, por exemplo). */
export async function enviarMaterialEmail(formData: FormData) {
  if (await demoAtivo()) return { error: DEMO_MSG };
  const { supabase, me: eu } = await me();
  if (!eu) return { error: "Sessão expirada. Entre de novo." };
  if (eu.role !== "coordenacao") {
    return { error: "Só a coordenação dispara e-mails." };
  }

  const materialId = String(formData.get("material_id") ?? "");
  const audiencias = [
    ...new Set(formData.getAll("audiencia").map(String)),
  ].filter((a) => (AUDIENCIAS_EMAIL as readonly string[]).includes(a));
  if (!materialId) return { error: "Material não encontrado." };
  if (!audiencias.length) return { error: "Escolha quem recebe o e-mail." };

  const { data: materialRaw, error } = await supabase
    .from("materiais")
    .select("id, titulo, descricao, tipo, url, path")
    .eq("id", materialId)
    .maybeSingle();
  if (error) return { error: erroAmigavel(error) };
  const material = materialRaw as MaterialEmail | null;
  if (!material) return { error: "Material não encontrado." };

  const resumo = await dispararMaterialEmail({
    supabase,
    material,
    audiencias,
    autorId: eu.id,
  });
  return resumoParaResposta(resumo);
}

/** Reenvio manual de um aviso já publicado — resolve a audiência do próprio
 *  comunicado (o automático sai na publicação; aqui é pra quem entrou depois
 *  ou perdeu o primeiro envio). */
export async function reenviarComunicadoEmail(formData: FormData) {
  if (await demoAtivo()) return { error: DEMO_MSG };
  const { supabase, me: eu } = await me();
  if (!eu) return { error: "Sessão expirada. Entre de novo." };
  if (eu.role !== "coordenacao") {
    return { error: "Só a coordenação dispara e-mails." };
  }

  const comunicadoId = String(formData.get("comunicado_id") ?? "");
  if (!comunicadoId) return { error: "Aviso não encontrado." };
  const { data: avisoRaw, error } = await supabase
    .from("comunicados")
    .select("id, titulo, corpo, prioridade, audiencia")
    .eq("id", comunicadoId)
    .maybeSingle();
  if (error) return { error: erroAmigavel(error) };
  const aviso = avisoRaw as AvisoEmail | null;
  if (!aviso) return { error: "Aviso não encontrado." };

  const resumo = await dispararComunicadoEmail({
    supabase,
    aviso,
    autorId: eu.id,
  });
  return resumoParaResposta(resumo);
}

// ---------- REALIZA-51 — disparo em lote do instrumento da jornada ----------
// A RPC emitir_instrumento_lote (0114) emite/reusa os links em transação e
// devolve o relatório por dupla com os destinatários; aqui o Resend faz o
// fan-out individual (um e-mail por link — o token é dele) e o log por
// destinatário vai pra emails_enviados tipo 'instrumento'.

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Linha do relatório da RPC — os e-mails/whatsapp ficam server-side: a
 *  action os usa pro disparo e devolve só status/motivo (PII de contato
 *  não atravessa pro client-state — revisão de segurança da issue). */
type LinhaRpcLote = {
  dupla_id: string;
  ok: boolean;
  motivo?: string;
  erro?: string;
  link_id?: string;
  token?: string;
  reutilizado?: boolean;
  jovem?: { nome: string | null; email: string | null; whatsapp: string | null } | null;
  mentor?: { nome: string | null; email: string | null; whatsapp: string | null } | null;
};

export type LoteInstrumentoStatus =
  | "enviado"
  | "falha"
  | "pulado"
  | "envio_desligado"
  | "simulado";

/** O que o dialog de lote recebe por dupla — sem e-mails nem nomes de
 *  destinatário (o client já tem os nomes da dupla pelas props do painel). */
export type LoteInstrumentoLinha = {
  duplaId: string;
  status: LoteInstrumentoStatus;
  /** quem recebeu o e-mail — null quando nada foi disparado */
  via: "jovem" | "mentor" | null;
  /** motivo em pt-BR, pronto pra renderizar */
  motivo: string | null;
  /** o link já existia e foi reaproveitado (idempotência do core) */
  reutilizado: boolean;
  /** só nas linhas não-enviadas com link vivo — fallback WhatsApp manual */
  token: string | null;
  waFone: string | null;
  waNome: string | null;
};

const MOTIVO_LOTE: Record<string, string> = {
  dupla_nao_encontrada: "dupla não encontrada",
  trilha_especialista: "trilha de especialista não usa os instrumentos da jornada",
  dupla_encerrada: "jornada encerrada",
  dupla_nao_concluida: "jornada ainda não concluiu",
  ja_respondido: "já respondeu este instrumento",
  emit_falhou: "não foi possível emitir o link",
  sem_email: "sem e-mail do jovem nem do mentor — entregue à mão",
  email_falhou: "o provedor não aceitou este endereço",
  simulado: "modo demonstração — nada é emitido nem enviado",
};

export async function enviarInstrumentoLote(input: {
  sistema: string;
  duplaIds: string[];
}): Promise<
  | { error: string }
  | {
      ok: true;
      enviados: number;
      falhas: number;
      pulados: number;
      envioLiberado: boolean;
      linhas: LoteInstrumentoLinha[];
    }
> {
  const sistema = String(input?.sistema ?? "");
  if (!(INSTRUMENTOS_SISTEMA as readonly string[]).includes(sistema))
    return { error: "Instrumento inválido." };
  const ids = [
    ...new Set(
      (Array.isArray(input?.duplaIds) ? input.duplaIds : [])
        .map(String)
        .filter((id) => UUID_RE.test(id))
    ),
  ];
  if (!ids.length) return { error: "Nenhuma dupla válida selecionada." };
  if (ids.length > 100) return { error: "O lote aceita até 100 duplas." };

  // demo: relatório fake — o dialog abre, o fluxo se mostra, nada sai
  if (await demoAtivo()) {
    return {
      ok: true,
      enviados: 0,
      falhas: 0,
      pulados: 0,
      envioLiberado: false,
      linhas: ids.map((duplaId) => ({
        duplaId,
        status: "simulado" as const,
        via: null,
        motivo: MOTIVO_LOTE.simulado,
        reutilizado: false,
        token: null,
        waFone: null,
        waNome: null,
      })),
    };
  }

  const { supabase, me: eu } = await me();
  if (!eu) return { error: "Sessão expirada. Entre de novo." };
  if (eu.role !== "coordenacao")
    return { error: "Só a coordenação dispara o lote." };

  const { data, error } = await supabase.rpc("emitir_instrumento_lote", {
    p_sistema: sistema,
    p_dupla_ids: ids,
  });
  if (error) return { error: erroAmigavel(error) };

  const titulo = INSTRUMENTO_INFO[sistema as InstrumentoSistema].titulo;
  const linhas: LoteInstrumentoLinha[] = [];
  const mensagens: {
    to: string;
    subject: string;
    html: string;
    linha: LoteInstrumentoLinha;
    linkId: string | null;
    via: "jovem" | "mentor";
  }[] = [];

  for (const r of (data ?? []) as LinhaRpcLote[]) {
    if (!r.ok) {
      if (r.motivo === "emit_falhou")
        console.error("emitir_instrumento_lote:", r.dupla_id, r.erro);
      linhas.push({
        duplaId: r.dupla_id,
        status: "pulado",
        via: null,
        motivo:
          (r.motivo ? MOTIVO_LOTE[r.motivo] : null) ??
          "não elegível pro lote",
        reutilizado: false,
        token: null,
        waFone: null,
        waNome: null,
      });
      continue;
    }

    // destinatário (decisão da issue): o e-mail é do jovem; sem
    // mentorados.email cai pro mentor com copy de repasse. Sem os dois,
    // a linha sai "pulada" — o link emitido segue útil pra WhatsApp manual.
    const emailJovem = r.jovem?.email?.trim() || null;
    const emailMentor = r.mentor?.email?.trim() || null;
    const via = emailJovem ? ("jovem" as const) : emailMentor ? ("mentor" as const) : null;
    const waJovem = r.jovem?.whatsapp?.trim() || null;
    const waMentor = r.mentor?.whatsapp?.trim() || null;
    const waFone = waJovem ?? waMentor;
    const waNome = waJovem
      ? primeiroNome(r.jovem?.nome)
      : primeiroNome(r.mentor?.nome);

    if (!via) {
      linhas.push({
        duplaId: r.dupla_id,
        status: "pulado",
        via: null,
        motivo: MOTIVO_LOTE.sem_email,
        reutilizado: r.reutilizado === true,
        token: r.token ?? null,
        waFone,
        waNome,
      });
      continue;
    }

    const link = `${SITE_URL}/f/${r.token}`;
    const nomeDestino =
      via === "jovem" ? primeiroNome(r.jovem?.nome) : primeiroNome(r.mentor?.nome);
    const subject =
      via === "jovem"
        ? `${titulo} — chegou a sua vez na jornada`
        : `${titulo} — link de ${primeiroNome(r.jovem?.nome) || "sua jovem"}`;
    const html =
      via === "jovem"
        ? emailInstrumentoJovem({
            primeiroNome: nomeDestino,
            instrumento: titulo,
            link,
          })
        : emailInstrumentoRepasseMentor({
            mentorNome: r.mentor?.nome ?? "",
            jovemNome: r.jovem?.nome ?? "",
            instrumento: titulo,
            link,
          });
    const linha: LoteInstrumentoLinha = {
      duplaId: r.dupla_id,
      status: "enviado",
      via,
      motivo: null,
      reutilizado: r.reutilizado === true,
      token: null, // enviado não precisa do bearer no client-state
      waFone: null,
      waNome: null,
    };
    linhas.push(linha);
    mensagens.push({
      to: via === "jovem" ? emailJovem! : emailMentor!,
      subject,
      html,
      linha,
      linkId: r.link_id ?? null,
      via,
    });
  }

  const envio = mensagens.length
    ? await enviarEmailsIndividuais({ mensagens })
    : { enviados: 0, falhas: [] as string[] };

  // linha não-enviada ganha o kit do fallback manual — token do link já
  // emitido + o melhor wa pra mandar à mão (jovem primeiro, senão mentor)
  const kitFallback = (linha: LoteInstrumentoLinha) => {
    const rpc = (data as LinhaRpcLote[]).find(
      (x) => x.dupla_id === linha.duplaId
    );
    linha.token = rpc?.token ?? null;
    linha.waFone =
      rpc?.jovem?.whatsapp?.trim() || rpc?.mentor?.whatsapp?.trim() || null;
    linha.waNome = rpc?.jovem?.whatsapp?.trim()
      ? primeiroNome(rpc.jovem?.nome)
      : primeiroNome(rpc?.mentor?.nome);
  };

  // kill-switch/config: nada foi tentado — marca envio_desligado e devolve
  // o kit manual (design: o lote emite mesmo desligado)
  if (envio.error) {
    for (const m of mensagens) {
      m.linha.status = "envio_desligado";
      m.linha.motivo = envio.error;
      kitFallback(m.linha);
    }
  } else {
    const falhou = new Set(envio.falhas);
    for (const m of mensagens) {
      if (falhou.has(m.to)) {
        m.linha.status = "falha";
        m.linha.motivo = MOTIVO_LOTE.email_falhou;
        kitFallback(m.linha);
      }
    }
  }

  // log por destinatário — memória do disparo (sem endereço nem token:
  // ref_id é o uuid do link; falha registra o papel, não o e-mail)
  if (mensagens.length && !envio.error) {
    const falhou = new Set(envio.falhas);
    const { error: errLog } = await supabase.from("emails_enviados").insert(
      mensagens.map((m) => ({
        autor_id: eu.id,
        tipo: "instrumento",
        ref_id: m.linkId,
        assunto: m.subject,
        audiencia: [m.via === "jovem" ? "mentorado" : "mentor"],
        destinatarios: 1,
        enviados: falhou.has(m.to) ? 0 : 1,
        falhas: falhou.has(m.to)
          ? [`${m.via === "jovem" ? "mentorado" : "mentor"}: endereço recusado pelo provedor`]
          : null,
      }))
    );
    if (errLog) console.error("enviarInstrumentoLote: log", errLog);
  }

  return {
    ok: true,
    enviados: linhas.filter((l) => l.status === "enviado").length,
    falhas: linhas.filter((l) => l.status === "falha").length,
    pulados: linhas.filter((l) => l.status === "pulado").length,
    envioLiberado: EMAIL_ENVIO_LIBERADO,
    linhas,
  };
}

// ---------- REALIZA-216 — lote do "Depois da mentoria · 6 meses" ----------
// Mesma mecânica do lote de instrumento: a RPC emitir_desfecho_6m_lote
// (0124) emite/reusa os links com contexto.momento='6m' e devolve os
// destinatários; aqui o Resend faz o fan-out individual com a copy do
// desfecho (não é exercício da jornada — é a pergunta do 6 meses). O
// disparo é gesto humano da coordenação, nunca automático.

const DESFECHO_TITULO = "Depois da mentoria";

export async function enviarDesfechoLote(input: {
  duplaIds: string[];
}): Promise<
  | { error: string }
  | {
      ok: true;
      enviados: number;
      falhas: number;
      pulados: number;
      envioLiberado: boolean;
      linhas: LoteInstrumentoLinha[];
    }
> {
  const ids = [
    ...new Set(
      (Array.isArray(input?.duplaIds) ? input.duplaIds : [])
        .map(String)
        .filter((id) => UUID_RE.test(id))
    ),
  ];
  if (!ids.length) return { error: "Nenhuma dupla válida selecionada." };
  if (ids.length > 100) return { error: "O lote aceita até 100 duplas." };

  // demo: relatório fake — o dialog abre, o fluxo se mostra, nada sai
  if (await demoAtivo()) {
    return {
      ok: true,
      enviados: 0,
      falhas: 0,
      pulados: 0,
      envioLiberado: false,
      linhas: ids.map((duplaId) => ({
        duplaId,
        status: "simulado" as const,
        via: null,
        motivo: MOTIVO_LOTE.simulado,
        reutilizado: false,
        token: null,
        waFone: null,
        waNome: null,
      })),
    };
  }

  const { supabase, me: eu } = await me();
  if (!eu) return { error: "Sessão expirada. Entre de novo." };
  if (eu.role !== "coordenacao")
    return { error: "Só a coordenação dispara o lote." };

  const { data, error } = await supabase.rpc("emitir_desfecho_6m_lote", {
    p_dupla_ids: ids,
  });
  if (error) return { error: erroAmigavel(error) };

  const linhas: LoteInstrumentoLinha[] = [];
  const mensagens: {
    to: string;
    subject: string;
    html: string;
    linha: LoteInstrumentoLinha;
    linkId: string | null;
    via: "jovem" | "mentor";
  }[] = [];

  for (const r of (data ?? []) as LinhaRpcLote[]) {
    if (!r.ok) {
      if (r.motivo === "emit_falhou")
        console.error("emitir_desfecho_6m_lote:", r.dupla_id, r.erro);
      linhas.push({
        duplaId: r.dupla_id,
        status: "pulado",
        via: null,
        motivo:
          (r.motivo ? MOTIVO_LOTE[r.motivo] : null) ??
          "não elegível pro lote",
        reutilizado: false,
        token: null,
        waFone: null,
        waNome: null,
      });
      continue;
    }

    // mesma régua do lote de instrumento: e-mail do jovem primeiro;
    // sem mentorados.email cai pro mentor com copy de repasse
    const emailJovem = r.jovem?.email?.trim() || null;
    const emailMentor = r.mentor?.email?.trim() || null;
    const via = emailJovem
      ? ("jovem" as const)
      : emailMentor
        ? ("mentor" as const)
        : null;
    const waJovem = r.jovem?.whatsapp?.trim() || null;
    const waMentor = r.mentor?.whatsapp?.trim() || null;
    const waFone = waJovem ?? waMentor;
    const waNome = waJovem
      ? primeiroNome(r.jovem?.nome)
      : primeiroNome(r.mentor?.nome);

    if (!via) {
      linhas.push({
        duplaId: r.dupla_id,
        status: "pulado",
        via: null,
        motivo: MOTIVO_LOTE.sem_email,
        reutilizado: r.reutilizado === true,
        token: r.token ?? null,
        waFone,
        waNome,
      });
      continue;
    }

    const link = `${SITE_URL}/f/${r.token}`;
    const nomeDestino =
      via === "jovem"
        ? primeiroNome(r.jovem?.nome)
        : primeiroNome(r.mentor?.nome);
    const subject =
      via === "jovem"
        ? `${DESFECHO_TITULO} — como você está?`
        : `${DESFECHO_TITULO} — link de ${primeiroNome(r.jovem?.nome) || "sua jovem"}`;
    const html =
      via === "jovem"
        ? emailDesfechoJovem({ primeiroNome: nomeDestino, link })
        : emailDesfechoRepasseMentor({
            mentorNome: r.mentor?.nome ?? "",
            jovemNome: r.jovem?.nome ?? "",
            link,
          });
    const linha: LoteInstrumentoLinha = {
      duplaId: r.dupla_id,
      status: "enviado",
      via,
      motivo: null,
      reutilizado: r.reutilizado === true,
      token: null, // enviado não precisa do bearer no client-state
      waFone: null,
      waNome: null,
    };
    linhas.push(linha);
    mensagens.push({
      to: via === "jovem" ? emailJovem! : emailMentor!,
      subject,
      html,
      linha,
      linkId: r.link_id ?? null,
      via,
    });
  }

  const envio = mensagens.length
    ? await enviarEmailsIndividuais({ mensagens })
    : { enviados: 0, falhas: [] as string[] };

  // linha não-enviada ganha o kit do fallback manual — token do link já
  // emitido + o melhor wa pra mandar à mão (jovem primeiro, senão mentor)
  const kitFallback = (linha: LoteInstrumentoLinha) => {
    const rpc = (data as LinhaRpcLote[]).find(
      (x) => x.dupla_id === linha.duplaId
    );
    linha.token = rpc?.token ?? null;
    linha.waFone =
      rpc?.jovem?.whatsapp?.trim() || rpc?.mentor?.whatsapp?.trim() || null;
    linha.waNome = rpc?.jovem?.whatsapp?.trim()
      ? primeiroNome(rpc.jovem?.nome)
      : primeiroNome(rpc?.mentor?.nome);
  };

  // kill-switch/config: nada foi tentado — marca envio_desligado e devolve
  // o kit manual (design: o lote emite mesmo desligado)
  if (envio.error) {
    for (const m of mensagens) {
      m.linha.status = "envio_desligado";
      m.linha.motivo = envio.error;
      kitFallback(m.linha);
    }
  } else {
    const falhou = new Set(envio.falhas);
    for (const m of mensagens) {
      if (falhou.has(m.to)) {
        m.linha.status = "falha";
        m.linha.motivo = MOTIVO_LOTE.email_falhou;
        kitFallback(m.linha);
      }
    }
  }

  // log por destinatário — memória do disparo (sem endereço nem token:
  // ref_id é o uuid do link; falha registra o papel, não o e-mail)
  if (mensagens.length && !envio.error) {
    const falhou = new Set(envio.falhas);
    const { error: errLog } = await supabase.from("emails_enviados").insert(
      mensagens.map((m) => ({
        autor_id: eu.id,
        tipo: "instrumento",
        ref_id: m.linkId,
        assunto: m.subject,
        audiencia: [m.via === "jovem" ? "mentorado" : "mentor"],
        destinatarios: 1,
        enviados: falhou.has(m.to) ? 0 : 1,
        falhas: falhou.has(m.to)
          ? [`${m.via === "jovem" ? "mentorado" : "mentor"}: endereço recusado pelo provedor`]
          : null,
      }))
    );
    if (errLog) console.error("enviarDesfechoLote: log", errLog);
  }

  return {
    ok: true,
    enviados: linhas.filter((l) => l.status === "enviado").length,
    falhas: linhas.filter((l) => l.status === "falha").length,
    pulados: linhas.filter((l) => l.status === "pulado").length,
    envioLiberado: EMAIL_ENVIO_LIBERADO,
    linhas,
  };
}
