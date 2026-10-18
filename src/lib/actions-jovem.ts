"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { parseDisponibilidade } from "./ciclo";
import { getSlotsLivres } from "./queries-especialista";
import { demoAtivo } from "./demo/mode";
import { DEMO_MSG } from "./demo/shared";
import { erroAmigavel as erroAmigavelBase } from "./utils";
import type { Disponibilidade, SolicitacaoEspecialistaStatus } from "./types";

// Writes do jovem (REALIZA-112 PR2) — o pedido de especialista vai direto
// por RPC definer: a 0074 já valida tudo no servidor (teto de trilhas,
// dedup por par, slot dentro da grade real, gate da demanda) e levanta os
// erros em pt-BR (P0001) que passam direto pro toast. O mentorado_id NUNCA
// sai do cliente — a RPC deriva por my_mentorado_id().

/** Erro de UI do pedido do jovem — mesma convenção do actions-especialista:
 *  P0001 já chega pt-BR do banco; o resto traduz pela tabela comum. */
function erroAmigavel(e: { message: string; code?: string }): string {
  if (e.code === "P0001" && e.message) return e.message;
  return erroAmigavelBase(e);
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

/** Opt-in colega↔colega da 0076 — liga/desliga a exibição do WhatsApp do
 *  cadastro pros colegas de turma com conta (view mentorados_turma). O
 *  banco rejeita quem não é o próprio jovem; no demo a preferência é
 *  fixa pra continuar ilustrando os dois estados dos colegas. */
export async function setContatoCompartilhado(ligado: boolean) {
  if (await demoAtivo()) return { error: DEMO_MSG };
  const { supabase, me: eu } = await me();
  if (!eu) return { error: "Sessão expirada. Entre de novo." };
  if (eu.role !== "mentorado") {
    return { error: "Essa escolha é só do jovem." };
  }
  const { error } = await supabase.rpc("set_contato_compartilhado", {
    p_ligado: ligado,
  });
  if (error) return { error: erroAmigavel(error) };
  revalidatePath("/jovem/perfil");
  revalidatePath("/jovem/pessoas");
  return { ok: true };
}

/** Grade semanal do próprio jovem (REALIZA-114) — escrita via RPC definer
 *  set_disponibilidade_mentorado (0078): mentorados não tem UPDATE pro
 *  papel, então a escrita deriva a ficha por my_mentorado_id() no banco.
 *  A grade chega como objeto tipado do client; o parse revalida o
 *  vocabulário do CHECK antes de mandar (grade vazia vira null). Serve o
 *  wizard de primeiro acesso e a edição do /jovem/perfil. */
export async function salvarDisponibilidadeJovem(
  grade: Disponibilidade | null
) {
  if (await demoAtivo()) return { error: DEMO_MSG };
  const { supabase, me: eu } = await me();
  if (!eu) return { error: "Sessão expirada. Entre de novo." };
  if (eu.role !== "mentorado") {
    return { error: "Só o próprio jovem informa a disponibilidade dele." };
  }
  // round-trip pelo parser do domínio: filtra qualquer valor fora do
  // vocabulário antes do jsonb — a RPC revalida de novo no servidor
  const parsed = parseDisponibilidade(JSON.stringify(grade ?? null));
  if (parsed && "error" in parsed) return { error: parsed.error };
  const { error } = await supabase.rpc("set_disponibilidade_mentorado", {
    p_grade: parsed,
  });
  if (error) return { error: erroAmigavel(error) };
  revalidatePath("/jovem");
  revalidatePath("/jovem/perfil");
  return { ok: true };
}

/** O jovem pede uma sessão de especialista (pedir_especialista_jovem,
 *  0074): direcionado (com slot opcional da grade real dele) ou broadcast
 *  pro mural. Sem dupla DPP ativa o pedido entra na triagem da coordenação
 *  ('aguardando_coord') — devolvemos o status pra UI contar certo, sem
 *  prometer sessão marcada (ela só nasce no aceite). */
export async function pedirEspecialistaJovem(input: {
  especialistaId: string | null;
  slot: string | null;
  demanda: string | null;
  motivo: string | null;
}): Promise<{
  ok?: true;
  status?: SolicitacaoEspecialistaStatus;
  error?: string;
}> {
  if (await demoAtivo()) return { error: DEMO_MSG };
  const { supabase, me: eu } = await me();
  if (!eu) return { error: "Sessão expirada. Entre de novo." };
  if (eu.role !== "mentorado") {
    return { error: "Só jovens mentorados podem pedir um especialista." };
  }

  const especialistaId = input.especialistaId || null;
  const slot = input.slot || null;
  const demanda = input.demanda?.trim() || null;
  const motivo = input.motivo?.trim() || null;

  // saneamento de forma — o domínio (gate, dedup, teto, grade) a RPC valida
  if (demanda && (demanda.length < 10 || demanda.length > 1000)) {
    return { error: "Conta um pouco mais — entre 10 e 1.000 caracteres." };
  }
  if (motivo && (motivo.length < 3 || motivo.length > 500)) {
    return { error: "O motivo precisa ter entre 3 e 500 caracteres." };
  }
  if (slot) {
    if (!especialistaId) {
      return { error: "Escolha um especialista pra propor um horário." };
    }
    if (Number.isNaN(Date.parse(slot))) {
      return { error: "Escolha um horário válido." };
    }
  }

  const { data: id, error } = await supabase.rpc("pedir_especialista_jovem", {
    p_especialista_id: especialistaId ?? undefined,
    p_demanda: demanda ?? undefined,
    p_motivo: motivo ?? undefined,
    p_slot: slot ?? undefined,
  });
  if (error) return { error: erroAmigavel(error) };
  if (!id) return { error: "Não foi possível enviar o pedido. Tente de novo." };

  // a linha nasce 'aberta' (com dupla DPP) ou 'aguardando_coord' (sem —
  // a triagem libera); o jovem lê a própria solicitação pelo sol_select
  const { data: sol } = await supabase
    .from("solicitacoes_especialista")
    .select("status")
    .eq("id", id)
    .single();

  // o pedido muda a home do jovem, a agenda (dedup por especialista) e o
  // mural de quem atende (especialista/coordenação na home staff)
  revalidatePath("/jovem");
  revalidatePath("/jovem/agenda");
  revalidatePath("/");
  return {
    ok: true,
    status: (sol?.status ?? "aberta") as SolicitacaoEspecialistaStatus,
  };
}

/** Leitura embrulhada em action pro dialog client: os slots livres do
 *  especialista escolhido (mesma projeção definer da /jovem/agenda —
 *  especialista_slots_livres é pública pra autenticado). No demo devolve a
 *  projeção do dataset — leitura não é write, não leva DEMO_MSG. */
export async function buscarSlotsEspecialista(
  especialistaId: string
): Promise<{ slots: string[] }> {
  if (!especialistaId) return { slots: [] };
  return { slots: await getSlotsLivres(especialistaId) };
}

/** WP6 — o jovem confirma a sugestão que o mentor DPP registrou (status
 *  'sugerida' → 'aberta', virando pedido de verdade). Pode ajustar o
 *  especialista-destino, a demanda e o objetivo antes de mandar — a RPC
 *  refaz os tetos de pedidos em aberto e o dedup por especialista. */
export async function confirmarSugestaoEspecialista(input: {
  id: string;
  especialistaId?: string | null;
  demanda?: string | null;
  objetivo?: string | null;
}): Promise<{ ok?: true; error?: string }> {
  if (await demoAtivo()) return { error: DEMO_MSG };
  const { supabase, me: eu } = await me();
  if (!eu) return { error: "Sessão expirada. Entre de novo." };
  if (eu.role !== "mentorado") {
    return { error: "Só o jovem mentorado confirma a sugestão." };
  }
  if (!input.id) return { error: "Sugestão não encontrada." };
  const demanda = input.demanda?.trim() || null;
  const objetivo = input.objetivo?.trim() || null;
  if (demanda && (demanda.length < 10 || demanda.length > 1000)) {
    return { error: "A demanda precisa ter entre 10 e 1.000 caracteres." };
  }
  if (objetivo && (objetivo.length < 3 || objetivo.length > 500)) {
    return { error: "O objetivo precisa ter entre 3 e 500 caracteres." };
  }
  const { error } = await supabase.rpc("confirmar_sugestao_especialista", {
    p_id: input.id,
    p_demanda: demanda ?? undefined,
    p_objetivo: objetivo ?? undefined,
    p_especialista_id: input.especialistaId ?? undefined,
  });
  if (error) return { error: erroAmigavel(error) };
  revalidatePath("/jovem");
  revalidatePath("/jovem/agenda");
  revalidatePath("/jovem/especialistas");
  revalidatePath("/");
  return { ok: true };
}

/** WP6 — o jovem dispensa a sugestão do mentor (vira 'cancelada' e sai de
 *  vista). A decisão é dele — a demanda pertence a quem vive o tema. */
export async function dispensarSugestaoEspecialista(
  id: string
): Promise<{ ok?: true; error?: string }> {
  if (await demoAtivo()) return { error: DEMO_MSG };
  const { supabase, me: eu } = await me();
  if (!eu) return { error: "Sessão expirada. Entre de novo." };
  if (eu.role !== "mentorado") {
    return { error: "Só o jovem mentorado responde à sugestão." };
  }
  if (!id) return { error: "Sugestão não encontrada." };
  const { error } = await supabase.rpc("dispensar_sugestao_especialista", {
    p_id: id,
  });
  if (error) return { error: erroAmigavel(error) };
  revalidatePath("/jovem");
  revalidatePath("/jovem/especialistas");
  revalidatePath("/");
  return { ok: true };
}
