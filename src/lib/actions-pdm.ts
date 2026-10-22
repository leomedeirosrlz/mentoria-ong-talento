"use server";

import { createClient } from "./supabase/server";
import { demoAtivo } from "./demo/mode";

// Server actions do PDM vivo (REALIZA-181): casca fina sobre as RPCs
// escopadas — quem decide permissão, caps e carimbos é o banco; aqui só a
// higiene dos parâmetros e o erro amigável, no padrão das outras actions.
// A dupla revalida via router.refresh() no cliente (mesmo padrão das
// seções da ficha — sem cache de página explícito).

const DEMO_MSG = "No modo demonstração as alterações não são salvas.";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function erroAmigavel(e: { message?: string; code?: string } | null): string {
  const msg = e?.message ?? "";
  if (msg.includes("máximo 10 metas"))
    return "O PDM comporta no máximo 10 metas — descarte uma antes de criar outra.";
  if (msg.includes("máximo 20 subitens"))
    return "O PDM comporta no máximo 20 subitens no total — descarte ou conclua alguns antes de criar novos.";
  if (msg.includes("sem permissão"))
    return "Você não pode editar o PDM desta dupla.";
  if (msg.includes("mesmo nível"))
    return "A ordem não pôde ser salva — a lista mudou em outra tela. Atualize a página.";
  if (e?.code === "23514") return "Valor fora do permitido — revise os campos.";
  if (e?.code === "23503") return "Item pai não encontrado neste PDM.";
  return "Não foi possível salvar. Tente de novo.";
}

type Resultado<T = undefined> =
  | { error: string }
  | (T extends undefined ? { ok: true } : { ok: true; data: T });

/** Cria/edita a Declaração de Visão do documento. */
export async function pdmSalvarVisao(
  duplaId: string,
  visao: string
): Promise<Resultado> {
  if (await demoAtivo()) return { error: DEMO_MSG };
  if (!UUID_RE.test(duplaId)) return { error: "Dupla inválida." };
  if (visao.length > 2000)
    return { error: "A Declaração de Visão comporta até 2.000 caracteres." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("pdm_salvar_visao", {
    p_dupla_id: duplaId,
    p_visao: visao,
  });
  if (error) return { error: erroAmigavel(error) };
  return { ok: true };
}

export type PdmItemInput = {
  itemId: string | null;
  parentId: string | null;
  titulo: string;
  porque: string | null;
  indicador: string | null;
  areaVida: string | null;
  prazoAlvo: string | null;
};

/** Cria (itemId null) ou edita um item. Devolve o id do item salvo. */
export async function pdmSalvarItem(
  duplaId: string,
  input: PdmItemInput
): Promise<Resultado<string>> {
  if (await demoAtivo()) return { error: DEMO_MSG };
  if (!UUID_RE.test(duplaId)) return { error: "Dupla inválida." };
  if (!input.titulo.trim()) return { error: "O item precisa de um título." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("pdm_salvar_item", {
    p_dupla_id: duplaId,
    p_item_id: input.itemId,
    p_parent_id: input.parentId,
    p_titulo: input.titulo,
    p_porque: input.porque,
    p_indicador: input.indicador,
    p_area_vida: input.areaVida,
    p_prazo_alvo: input.prazoAlvo,
  });
  if (error) return { error: erroAmigavel(error) };
  return { ok: true, data: data as string };
}

/** Marca atingida/em andamento/descartada — o carimbo atingida_em é do
 *  banco (atingida carimba agora, ativa limpa, descartada preserva). */
export async function pdmStatusItem(
  duplaId: string,
  itemId: string,
  status: "ativa" | "atingida" | "descartada"
): Promise<Resultado> {
  if (await demoAtivo()) return { error: DEMO_MSG };
  if (!UUID_RE.test(duplaId) || !UUID_RE.test(itemId))
    return { error: "Item inválido." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("pdm_status_item", {
    p_dupla_id: duplaId,
    p_item_id: itemId,
    p_status: status,
  });
  if (error) return { error: erroAmigavel(error) };
  return { ok: true };
}

/** Apaga o item e os descendentes (a cascata é do FK). */
export async function pdmRemoverItem(
  duplaId: string,
  itemId: string
): Promise<Resultado> {
  if (await demoAtivo()) return { error: DEMO_MSG };
  if (!UUID_RE.test(duplaId) || !UUID_RE.test(itemId))
    return { error: "Item inválido." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("pdm_remover_item", {
    p_dupla_id: duplaId,
    p_item_id: itemId,
  });
  if (error) return { error: erroAmigavel(error) };
  return { ok: true };
}

/** Reordena um nível inteiro — itemIds na nova prioridade. A RPC exige a
 *  lista completa de irmãos: a UI sempre manda o nível visível inteiro. */
export async function pdmReordenar(
  duplaId: string,
  parentId: string | null,
  itemIds: string[]
): Promise<Resultado> {
  if (await demoAtivo()) return { error: DEMO_MSG };
  if (!UUID_RE.test(duplaId) || !itemIds.every((id) => UUID_RE.test(id)))
    return { error: "Item inválido." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("pdm_reordenar", {
    p_dupla_id: duplaId,
    p_parent_id: parentId,
    p_item_ids: itemIds,
  });
  if (error) return { error: erroAmigavel(error) };
  return { ok: true };
}
