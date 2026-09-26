"use server";

import { createClient } from "@/lib/supabase/server";
import { enviarEmailsLote, ROLES_POR_AUDIENCIA, SITE_URL } from "@/lib/email";
import { emailAviso, emailMaterial } from "@/lib/email-templates";
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
}: {
  tipo: "comunicado" | "material";
  refId?: string | null;
  assunto: string;
  html: string;
  audiencias: string[];
  autorId: string;
  supabase: Supa;
}): Promise<ResumoEnvioEmail> {
  const roles = [
    ...new Set(audiencias.flatMap((a) => ROLES_POR_AUDIENCIA[a] ?? [])),
  ];
  try {
    // e-mail/whatsapp saíram do grant de coluna de profiles (0026): os
    // endereços vêm da view profiles_contato, que pra coordenação devolve
    // todo mundo — role/ativo continuam na tabela base (grant público)
    const { data: pessoas, error: errPessoas } = await supabase
      .from("profiles")
      .select("id")
      .in("role", roles)
      .eq("ativo", true);
    if (errPessoas) console.error("dispararParaRoles: profiles", errPessoas);
    const ids = (pessoas ?? []).map((p) => p.id);

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
}: {
  supabase: Supa;
  material: MaterialEmail;
  audiencias: string[];
  autorId: string;
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
