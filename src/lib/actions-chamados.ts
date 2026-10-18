"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { enviarEmailsLote, SITE_URL } from "@/lib/email";
import {
  emailChamadoAtualizacao,
  emailChamadoUrgencia,
} from "@/lib/email-templates";
import { demoRole } from "./demo/mode";
import { DEMO_MSG } from "./demo/shared";

// Server actions dos chamados unificados (0084). Toda transição vai pras
// RPCs definer — o banco é quem decide papel, dono e transição válida; aqui
// fica validação de entrada, erro pt-BR e os efeitos colaterais (e-mail).

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

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CATEGORIAS = ["agenda", "metodologia", "plataforma", "urgencia", "outro"];

/** O erro da RPC chega como { message } — P0001 com texto pt-BR passa direto
 *  (molde marcarCombinadoFeito). */
function erroRpc(error: { message?: string } | null): string {
  return error?.message || "Não foi possível concluir. Tente de novo.";
}

function revalidaChamado(extra?: string) {
  revalidatePath("/chamados");
  revalidatePath("/"); // badge/cards das homes
  revalidatePath("/jovem");
  revalidatePath("/jovem/perfil");
  if (extra) revalidatePath(extra);
}

export type AbrirChamadoInput = {
  categoria: string;
  assunto: string;
  mensagem?: string;
  descricaoOutro?: string;
  duplaId?: string;
};

export async function abrirChamado(
  input: AbrirChamadoInput
): Promise<{ ok?: boolean; id?: string; numero?: string; error?: string }> {
  if (await demoRole()) return { error: DEMO_MSG };
  const { supabase, me: profile } = await me();
  if (!profile) return { error: "Sem sessão ativa. Entre de novo." };
  if (!CATEGORIAS.includes(input.categoria)) {
    return { error: "Escolha uma categoria válida." };
  }
  const assunto = input.assunto?.trim() ?? "";
  if (assunto.length < 2 || assunto.length > 200) {
    return { error: "O assunto precisa ter entre 2 e 200 caracteres." };
  }
  if ((input.mensagem?.length ?? 0) > 5000) {
    return { error: "A mensagem passa de 5000 caracteres." };
  }
  if (
    input.categoria === "outro" &&
    (input.descricaoOutro?.trim().length ?? 0) < 2
  ) {
    return { error: "Descreva em poucas palavras o assunto do chamado." };
  }
  if (input.duplaId && !UUID_RE.test(input.duplaId)) {
    return { error: "Dupla inválida." };
  }

  const { data, error } = await supabase.rpc("abrir_chamado", {
    p_categoria: input.categoria,
    p_assunto: assunto,
    p_mensagem: input.mensagem?.trim() || null,
    p_descricao_outro: input.descricaoOutro?.trim() || null,
    p_dupla_id: input.duplaId ?? null,
  });
  if (error) return { error: erroRpc(error) };

  const ret = data as {
    id?: string;
    numero?: string;
    destinatarios?: { email?: string | null; nome?: string | null }[];
  };

  // urgência e chamado do jovem → e-mail redundante pro staff (nunca bloqueia)
  const dests = ret?.destinatarios ?? [];
  const emails = dests
    .map((d) => d.email)
    .filter((e): e is string => !!e);
  if (emails.length) {
    const html = emailChamadoUrgencia({
      numero: ret.numero ?? "",
      assunto,
      categoria: input.categoria,
      autorNome: profile.nome,
      href: `${SITE_URL}/chamados?c=${ret.id}`,
    });
    const envio = await enviarEmailsLote({
      para: emails,
      assunto: `Chamado ${ret.numero ?? ""} — ${assunto}`,
      html,
    });
    // log via RPC definer — policy de emails_enviados é coord-only
    const { error: errLog } = await supabase.rpc("registrar_email_chamado", {
      p_chamado_id: ret.id,
      p_assunto: `Chamado ${ret.numero ?? ""} — ${assunto}`,
      p_destinatarios: emails.length,
      p_enviados: envio.enviados,
      p_falhas: envio.falhas,
    });
    if (errLog) console.error("abrirChamado: log email", errLog);
  }

  revalidaChamado();
  return { ok: true, id: ret?.id, numero: ret?.numero };
}

async function rpcSimples(
  nome: string,
  args: Record<string, unknown>,
  extraPath?: string
): Promise<{ ok?: boolean; error?: string }> {
  if (await demoRole()) return { error: DEMO_MSG };
  const { supabase, me: profile } = await me();
  if (!profile) return { error: "Sem sessão ativa. Entre de novo." };
  if (!UUID_RE.test(String(args.p_id ?? ""))) {
    return { error: "Chamado não encontrado." };
  }
  const { error } = await supabase.rpc(nome, args);
  if (error) return { error: erroRpc(error) };
  revalidaChamado(extraPath);
  return { ok: true };
}

export async function assumirChamado(id: string) {
  return rpcSimples("assumir_chamado", { p_id: id });
}

export async function devolverChamadoFila(id: string) {
  return rpcSimples("devolver_chamado_fila", { p_id: id });
}

export async function reabrirChamado(id: string) {
  return rpcSimples("reabrir_chamado", { p_id: id });
}

export async function pedirReaberturaChamado(id: string) {
  return rpcSimples("pedir_reabertura_chamado", { p_id: id });
}

export async function resolverChamado(id: string, resumo: string) {
  if (!resumo?.trim()) return { error: "Escreva um resumo da resolução." };
  return rpcSimples("resolver_chamado", { p_id: id, p_resumo: resumo.trim() });
}

export async function atribuirChamado(id: string, responsavelId: string | null) {
  if (responsavelId && !UUID_RE.test(responsavelId)) {
    return { error: "Responsável inválido." };
  }
  if (await demoRole()) return { error: DEMO_MSG };
  const { supabase, me: profile } = await me();
  if (!profile) return { error: "Sem sessão ativa. Entre de novo." };
  if (!UUID_RE.test(id)) return { error: "Chamado não encontrado." };
  const { error } = await supabase.rpc("atribuir_chamado", {
    p_id: id,
    p_para: responsavelId,
  });
  if (error) return { error: erroRpc(error) };
  revalidaChamado();
  return { ok: true };
}

export async function publicarAtualizacaoChamado(id: string, texto: string) {
  if (await demoRole()) return { error: DEMO_MSG };
  const { supabase, me: profile } = await me();
  if (!profile) return { error: "Sem sessão ativa. Entre de novo." };
  if (!UUID_RE.test(id)) return { error: "Chamado não encontrado." };
  if (!texto?.trim() || texto.length > 4000) {
    return { error: "Escreva a atualização (até 4000 caracteres)." };
  }
  const { data, error } = await supabase.rpc("publicar_atualizacao_chamado", {
    p_id: id,
    p_texto: texto.trim(),
  });
  if (error) return { error: erroRpc(error) };

  // e-mail redundante pro autor — molde do apoio_jovem; nunca bloqueia
  const autor = (data as { autor?: { email?: string | null; nome?: string | null; profile_id?: string } | null })
    ?.autor;
  if (autor?.email) {
    const html = emailChamadoAtualizacao({
      autorNome: autor.nome ?? "",
      texto: texto.trim(),
      href: `${SITE_URL}/chamados?c=${id}`,
    });
    const envio = await enviarEmailsLote({
      para: [autor.email],
      assunto: "Atualização no seu pedido de apoio",
      html,
    });
    const { error: errLog } = await supabase.rpc("registrar_email_chamado", {
      p_chamado_id: id,
      p_assunto: "Atualização no seu pedido de apoio",
      p_destinatarios: 1,
      p_enviados: envio.enviados,
      p_falhas: envio.falhas,
    });
    if (errLog) console.error("publicarAtualizacaoChamado: log", errLog);
  }
  revalidaChamado();
  return { ok: true };
}

export async function comentarChamado(
  id: string,
  texto: string,
  mencionados?: string[]
) {
  if (!texto?.trim() || texto.length > 4000) {
    return { error: "Escreva o comentário (até 4000 caracteres)." };
  }
  const validos = (mencionados ?? []).filter((m) => UUID_RE.test(m));
  return rpcSimples("comentar_chamado", {
    p_id: id,
    p_texto: texto.trim(),
    p_mencionados: validos,
  });
}

export async function acrescentarInfoChamado(id: string, texto: string) {
  if (!texto?.trim() || texto.length > 4000) {
    return { error: "Escreva a informação (até 4000 caracteres)." };
  }
  return rpcSimples("acrescentar_info_chamado", {
    p_id: id,
    p_texto: texto.trim(),
  });
}

/** Botão "marcar como atendido" da ficha do registro — resolve o chamado
 *  correspondente e limpa a flag na mesma transação (RPC). */
export async function resolverApoioChamado(
  origem: { registroId?: string; avaliacaoId?: string },
  resumo?: string
) {
  if (await demoRole()) return { error: DEMO_MSG };
  const { supabase, me: profile } = await me();
  if (!profile) return { error: "Sem sessão ativa. Entre de novo." };
  const { error } = await supabase.rpc("resolver_chamado_por_origem", {
    p_registro_id: origem.registroId ?? null,
    p_avaliacao_id: origem.avaliacaoId ?? null,
    p_resumo: resumo?.trim() || null,
  });
  if (error) return { error: erroRpc(error) };
  revalidaChamado();
  return { ok: true };
}
