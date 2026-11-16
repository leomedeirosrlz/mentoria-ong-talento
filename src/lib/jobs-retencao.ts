import { createAdminClient } from "@/lib/supabase/admin";
import type { JobResult } from "./jobs";

/** Retenção de produto_eventos (REALIZA-417 fase B): a RPC
 *  produto_eventos_reter (0201) fecha o rollup diário em
 *  produto_eventos_dia e apaga o cru além da janela — 90d cobre a maior
 *  régua da aba Adoção com folga. Idempotente: o upsert do rollup é
 *  auto-curativo e o delete re-run não acha nada. `desde`/backfill do
 *  tick não se aplicam — o alvo é sempre "agora". */
export async function rodarRetencaoProduto(): Promise<JobResult> {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("produto_eventos_reter", {
    p_dias: 90,
  });
  if (error) return { ok: false, error: `reter: ${error.message}` };
  return { ok: true, ...(data as Record<string, unknown> | null) };
}
