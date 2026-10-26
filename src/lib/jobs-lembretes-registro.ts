// Job do tick (REALIZA-214): lembretes de registro pendente — 24h e 72h
// depois do encontro, fire-once por (encontro, marco) via ledger
// registro_lembretes (0122). O ping não muda status: leva o mentor à aba
// de registro da ficha (#registrar-<encontro>).
//
// A lógica mora toda na RPC processar_lembretes_registro (varredura +
// dedup + cap de nudge da coordenação + notificações) — o job só passa o
// "agora" de cada dia do contexto (e itera o range quando o tick roda com
// ?desde=, igual ao backfill dos outros jobs: marcos que seriam devidos
// em dias passados disparam como se o job tivesse rodado diário —
// idempotente pelo ledger).

import { createAdminClient } from "@/lib/supabase/admin";
import { diasDoRange, type JobContext, type JobResult } from "./jobs";

type RetornoRpc = {
  ok?: boolean;
  avaliados?: number;
  enviados?: number;
  lembretes?: { marco: string; n: number }[];
};

export async function rodarLembretesRegistro(
  ctx: JobContext
): Promise<JobResult> {
  const admin = createAdminClient();
  const dias = diasDoRange(ctx.desde ?? ctx.hoje, ctx.hoje);
  const erros: { dia: string; erro: string }[] = [];
  let avaliados = 0;
  let enviados = 0;
  const lembretes: NonNullable<RetornoRpc["lembretes"]> = [];
  for (const dia of dias) {
    // hoje usa o instante real; dias de backfill ganham um "agora" estável
    // (meio-dia BRT — a mesma âncora do diasDoRange): o marco é por hora,
    // não por dia civil, então o dia sozinho não basta como referência
    const p_agora =
      dia === ctx.hoje
        ? new Date().toISOString()
        : `${dia}T12:00:00-03:00`;
    const { data, error } = await admin.rpc("processar_lembretes_registro", {
      p_agora,
    });
    if (error) {
      // falha de um dia não aborta o backfill — ok=false sinaliza o tick
      erros.push({ dia, erro: error.message });
      continue;
    }
    const r = (data ?? {}) as RetornoRpc;
    avaliados += r.avaliados ?? 0;
    enviados += r.enviados ?? 0;
    if (r.lembretes?.length) lembretes.push(...r.lembretes);
  }
  return {
    ok: erros.length === 0,
    dias: dias.length,
    avaliados,
    enviados,
    ...(lembretes.length ? { lembretes } : {}),
    ...(erros.length ? { erros } : {}),
  };
}
