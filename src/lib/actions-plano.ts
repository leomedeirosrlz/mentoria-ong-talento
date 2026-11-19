"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { demoAtivo } from "./demo/mode";
import { emitirProdutoEvento } from "./produto-eventos-server";
import type { ChamadoCategoria } from "./types";

type Resultado =
  | { ok: true; demo?: boolean }
  | { error: string };

/** Lê o contrato {error} das RPCs definer do plano (0219/0220) — a
 *  mensagem pt-BR do banco sobe intacta; PostgREST vira genérica. */
function lerRpc(data: unknown, error: { message: string } | null): Resultado {
  if (error) {
    console.error("actions-plano:", error);
    return { error: "Não consegui concluir agora." };
  }
  const r = data as { error?: string } | null;
  if (r?.error) return { error: r.error };
  return { ok: true };
}

/** Resposta da dupla ao plano "ficar em dia" (0219 — REALIZA-459): o
 *  mentor e o jovem usam a MESMA RPC — quem contesta encerra o plano de
 *  vez (terminal), um acordo novo nasce por plano_propor como versão
 *  nova. Aceitar de novo é idempotente no banco. */
export async function responderPlano(
  planoId: string,
  acao: "aceitar" | "contestar",
  motivo?: string,
  duplaId?: string
): Promise<Resultado> {
  if (await demoAtivo()) return { ok: true, demo: true };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("plano_responder", {
    p_plano: planoId,
    p_acao: acao,
    p_motivo: motivo ?? null,
  });
  const r = lerRpc(data, error);
  if ("error" in r) return r;
  await emitirProdutoEvento(supabase, {
    superficie: "ficha_dupla",
    acao: acao === "aceitar" ? "plano_aceito" : "plano_contestado",
    meta: { plano_id: planoId, dupla_id: duplaId ?? null },
  });
  if (duplaId) revalidatePath(`/duplas/${duplaId}`);
  revalidatePath("/jovem/agenda");
  return r;
}

/** Aplica um passo do plano aceito (0219): grava a data combinada e o
 *  ledger atômico na mesma RPC — vale pra ficha do mentor e pra agenda
 *  do jovem, porque o combinado é dos dois. Repetir é idempotente. */
export async function aplicarPassoPlano(
  planoId: string,
  numero: number,
  dataHora: string,
  link?: string,
  motivo?: string,
  duplaId?: string
): Promise<Resultado> {
  if (await demoAtivo()) return { ok: true, demo: true };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("plano_aplicar_passo", {
    p_plano: planoId,
    p_numero: numero,
    p_data_hora: dataHora,
    p_link: link?.trim() || null,
    p_motivo: motivo ?? null,
    p_via: "app",
  });
  const r = lerRpc(data, error);
  if ("error" in r) return r;
  await emitirProdutoEvento(supabase, {
    superficie: "ficha_dupla",
    acao: "plano_passo",
    meta: { plano_id: planoId, dupla_id: duplaId ?? null, numero },
  });
  if (duplaId) revalidatePath(`/duplas/${duplaId}`);
  revalidatePath("/jovem/agenda");
  return r;
}

/** Ajuste do guia de um encontro (0220): substitui a lista inteira do
 *  número — cada ajuste ancora no guia base (sugestão + justificativa). */
export async function salvarGuiaAjuste(
  duplaId: string,
  numero: number,
  ajustes: { sugestao: string; justificativa: string }[]
): Promise<Resultado> {
  if (await demoAtivo()) return { ok: true, demo: true };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("guia_ajuste_salvar", {
    p_dupla: duplaId,
    p_numero: numero,
    p_ajustes: ajustes,
    p_via: "app",
  });
  const r = lerRpc(data, error);
  if ("error" in r) return r;
  await emitirProdutoEvento(supabase, {
    superficie: "ficha_dupla",
    acao: "plano_guia",
    meta: { dupla_id: duplaId, numero },
  });
  revalidatePath(`/duplas/${duplaId}`);
  return r;
}

/** "Voltar ao guia" (0220): apaga os ajustes do encontro — o oficial
 *  passa a valer sozinho de novo. */
export async function limparGuiaAjuste(
  duplaId: string,
  numero: number
): Promise<Resultado> {
  if (await demoAtivo()) return { ok: true, demo: true };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("guia_ajuste_limpar", {
    p_dupla: duplaId,
    p_numero: numero,
  });
  const r = lerRpc(data, error);
  if ("error" in r) return r;
  await emitirProdutoEvento(supabase, {
    superficie: "ficha_dupla",
    acao: "plano_guia",
    meta: { dupla_id: duplaId, numero, limpar: true },
  });
  revalidatePath(`/duplas/${duplaId}`);
  return r;
}

/** Encaminha ou descarta uma intervenção sugerida (0220): saida
 *  'mensagem' marca como tratada por conversa, 'descartada' arquiva com
 *  o motivo. A saída real é humana — a ação só fecha a sugestão. */
export async function fecharIntervencao(
  intervencaoId: string,
  duplaId: string,
  saida: "mensagem" | "descartada",
  motivo?: string
): Promise<Resultado> {
  if (await demoAtivo()) return { ok: true, demo: true };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("intervencao_fechar", {
    p_intervencao: intervencaoId,
    p_saida: saida,
    p_motivo: motivo ?? null,
  });
  const r = lerRpc(data, error);
  if ("error" in r) return r;
  await emitirProdutoEvento(supabase, {
    superficie: "ficha_dupla",
    acao: "plano_intervencao",
    meta: { dupla_id: duplaId, saida },
  });
  revalidatePath(`/duplas/${duplaId}`);
  return r;
}

/** Intervenção → chamado (0220): abre o chamado com origem 'liza' e já
 *  marca a intervenção como encaminhada — o mesmo movimento do card. */
export async function abrirChamadoIntervencao(
  intervencaoId: string,
  duplaId: string,
  categoria: ChamadoCategoria,
  assunto: string,
  mensagem?: string
): Promise<Resultado> {
  if (await demoAtivo()) return { ok: true, demo: true };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("intervencao_abrir_chamado", {
    p_intervencao: intervencaoId,
    p_categoria: categoria,
    p_assunto: assunto,
    p_mensagem: mensagem ?? null,
    p_descricao_outro: null,
  });
  const r = lerRpc(data, error);
  if ("error" in r) return r;
  await emitirProdutoEvento(supabase, {
    superficie: "ficha_dupla",
    acao: "plano_intervencao",
    meta: { dupla_id: duplaId, saida: "chamado" },
  });
  revalidatePath(`/duplas/${duplaId}`);
  return r;
}
