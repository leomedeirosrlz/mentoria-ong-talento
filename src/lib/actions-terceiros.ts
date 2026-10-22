"use server";

import { createClient } from "@/lib/supabase/server";
import { demoAtivo } from "./demo/mode";
import { DEMO_MSG } from "./demo/shared";
import { erroAmigavel } from "./utils";
import { normWhatsapp } from "./importar";

// Actions da avaliação por terceiros (0103 — guia DPP semana 1→2).
// O respondente externo submete por bearer token + RPC definer; dentro da
// app, contato se cadastra por INSERT direto (token se auto-minta) e tudo
// que mexe em status/token sai só pelas RPCs — o grant de coluna e a RLS
// são a fronteira, o precheck de papel é só pra erro amigável.

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TOKEN_RE = /^[A-Za-z0-9_-]{20,128}$/;
const VINCULOS = new Set(["amigo", "familiar", "colega", "outro"]);

async function meEDupla(duplaId: string) {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const { data: eu } = await supabase
    .from("profiles")
    .select("id, role")
    .eq("user_id", (claimsData?.claims?.sub as string) ?? "")
    .maybeSingle();
  if (!eu) return { supabase, error: "Sessão expirada. Entre de novo." as const };
  const { data: dupla } = await supabase
    .from("duplas")
    .select("id, mentor_id, trilha, status")
    .eq("id", duplaId)
    .maybeSingle();
  if (!dupla) return { supabase, error: "Dupla não encontrada." as const };
  if (dupla.trilha !== "dpp")
    return { supabase, error: "Avaliação por terceiros é da trilha DPP." as const };
  const pode =
    eu.role === "coordenacao" || dupla.mentor_id === eu.id;
  if (!pode)
    return {
      supabase,
      error: "Só o mentor da dupla e a coordenação mexem aqui." as const,
    };
  return { supabase, dupla, eu };
}

function saneiaNome(v: unknown): string | null {
  const s = String(v ?? "").replace(/\s+/g, " ").trim();
  return s.length >= 2 && s.length <= 120 ? s : null;
}

/** null = limpa o campo; undefined = inválido. Normaliza pro formato
 *  55DDDNUMERO que waLink espera — sem isso "11999998888" abria wa.me
 *  como número +1 (EUA). */
function saneiaWhatsapp(v: unknown): string | null | undefined {
  if (v == null || String(v).trim() === "") return null;
  return normWhatsapp(String(v)) ?? undefined;
}

function traduzErro(message: string): string {
  if (/9 pessoas/.test(message))
    return "O guia prevê até 9 pessoas indicadas (3 amigos, 3 familiares, 3 colegas).";
  if (/3 pessoas por vínculo/.test(message))
    return "O guia prevê até 3 pessoas por vínculo — distribua entre amigos, familiares e colegas.";
  if (/usado ou expirou/.test(message))
    return "Este link já foi respondido ou expirou.";
  if (/antes de publicar/.test(message))
    return "Escreva a consolidação antes de publicar.";
  if (/convite não encontrado/.test(message))
    return "Convite não encontrado — recarregue a página.";
  if (/não encontrada|not found/i.test(message)) return "Dupla não encontrada.";
  if (/pontos fortes|a melhorar|aspectos/i.test(message)) return message;
  return erroAmigavel({ message } as never);
}

/** Cadastra a pessoa indicada — o token se auto-minta no insert e volta
 *  pronto pra copiar/mandar no WhatsApp. Cap 9 dispara no banco. */
export async function criarContatoTerceiro(
  duplaId: string,
  dados: { nome: string; vinculo: string; whatsapp?: string | null }
) {
  if (await demoAtivo()) return { error: DEMO_MSG };
  if (!UUID_RE.test(duplaId)) return { error: "Dados inválidos." };
  const nome = saneiaNome(dados?.nome);
  if (!nome) return { error: "Informe o nome da pessoa (2 a 120 letras)." };
  if (!VINCULOS.has(dados?.vinculo))
    return { error: "Escolha o vínculo: amigo, familiar, colega ou outro." };
  const whatsapp = saneiaWhatsapp(dados?.whatsapp);
  if (whatsapp === undefined)
    return { error: "WhatsApp inválido — use o número com DDD." };

  const ctx = await meEDupla(duplaId);
  if ("error" in ctx) return { error: ctx.error };
  const { error, data } = await ctx.supabase
    .from("terceiros_contatos")
    .insert({ dupla_id: duplaId, nome, vinculo: dados.vinculo, whatsapp })
    .select("id, token")
    .single();
  if (error) return { error: traduzErro(error.message) };
  return { ok: true as const, id: data.id, token: data.token };
}

/** Edita o cadastro (nome/whatsapp/vínculo) — colunas de lifecycle ficam
 *  fora do grant de update, então aqui não chega status nem token. */
export async function atualizarContatoTerceiro(
  contatoId: string,
  dados: { nome?: string; vinculo?: string; whatsapp?: string | null }
) {
  if (await demoAtivo()) return { error: DEMO_MSG };
  if (!UUID_RE.test(contatoId)) return { error: "Dados inválidos." };
  const patch: Record<string, unknown> = {};
  if (dados?.nome !== undefined) {
    const nome = saneiaNome(dados.nome);
    if (!nome) return { error: "Nome inválido (2 a 120 letras)." };
    patch.nome = nome;
  }
  if (dados?.vinculo !== undefined) {
    if (!VINCULOS.has(dados.vinculo)) return { error: "Vínculo inválido." };
    patch.vinculo = dados.vinculo;
  }
  if (dados?.whatsapp !== undefined) {
    const w = saneiaWhatsapp(dados.whatsapp);
    if (w === undefined) return { error: "WhatsApp inválido — use o número com DDD." };
    patch.whatsapp = w;
  }
  if (!Object.keys(patch).length) return { error: "Nada pra atualizar." };

  const supabase = await createClient();
  const { error, count } = await supabase
    .from("terceiros_contatos")
    .update(patch, { count: "exact" })
    .eq("id", contatoId);
  if (error) return { error: traduzErro(error.message) };
  if (!count)
    return { error: "Só dá pra editar convite pendente ou expirado da sua dupla." };
  return { ok: true as const };
}

/** Cancela o convite — a policy só deleta 'pendente' da dupla em escopo:
 *  respondido é dado e nunca sai. */
export async function cancelarContatoTerceiro(contatoId: string) {
  if (await demoAtivo()) return { error: DEMO_MSG };
  if (!UUID_RE.test(contatoId)) return { error: "Dados inválidos." };
  const supabase = await createClient();
  const { error, count } = await supabase
    .from("terceiros_contatos")
    .delete({ count: "exact" })
    .eq("id", contatoId);
  if (error) return { error: traduzErro(error.message) };
  if (!count)
    return { error: "Só dá pra cancelar convite pendente da sua dupla." };
  return { ok: true as const };
}

/** Reemite convite: pendente devolve o mesmo link (pra mandar de novo);
 *  expirado ganha token + prazo novos e o anterior morre. */
export async function reemitirConviteTerceiro(contatoId: string) {
  if (await demoAtivo()) return { error: DEMO_MSG };
  if (!UUID_RE.test(contatoId)) return { error: "Dados inválidos." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("reemitir_convite_terceiro", {
    p_contato_id: contatoId,
  });
  if (error) return { error: traduzErro(error.message) };
  const d = data as { token?: string; reutilizado?: boolean } | null;
  if (!d?.token) return { error: "Não foi possível reemitir. Tente de novo." };
  return {
    ok: true as const,
    token: d.token,
    reutilizado: d.reutilizado === true,
  };
}

/** Salva/publica a consolidação curada — publish é explícito: o jovem só
 *  lê depois de publicado_em marcado (e nunca vê quem respondeu o quê). */
export async function salvarConsolidadoTerceiros(
  duplaId: string,
  consolidado: string,
  publicar: boolean
) {
  if (await demoAtivo()) return { error: DEMO_MSG };
  if (!UUID_RE.test(duplaId)) return { error: "Dados inválidos." };
  const texto = String(consolidado ?? "");
  if (texto.length > 8000)
    return { error: "A consolidação passou de 8000 caracteres." };
  if (publicar && !texto.trim())
    return { error: "Escreva a consolidação antes de publicar." };

  const ctx = await meEDupla(duplaId);
  if ("error" in ctx) return { error: ctx.error };
  const { error } = await ctx.supabase.rpc("salvar_consolidado_terceiros", {
    p_dupla_id: duplaId,
    p_consolidado: texto,
    p_publicar: publicar === true,
  });
  if (error) return { error: traduzErro(error.message) };
  return { ok: true as const };
}

// ---------- público (/t/<token>) ----------

export async function submeterRespostaTerceiro(
  token: string,
  pontosFortes: string,
  aMelhorar: string,
  honeypot: string
) {
  if (await demoAtivo()) return { error: DEMO_MSG };
  // honeypot: bot preencheu o campo invisível — finge sucesso e não grava
  if (honeypot && honeypot.trim()) return { ok: true as const };
  if (!token || !TOKEN_RE.test(token))
    return { error: "Este link não é válido." };
  if (String(pontosFortes ?? "").length > 4000 || String(aMelhorar ?? "").length > 4000)
    return { error: "Resposta longa demais — até 4000 caracteres por campo." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("submeter_resposta_terceiro", {
    p_token: token,
    p_pontos_fortes: String(pontosFortes ?? ""),
    p_a_melhorar: String(aMelhorar ?? ""),
  });
  if (error) return { error: traduzErro(error.message) };
  return { ok: true as const };
}
