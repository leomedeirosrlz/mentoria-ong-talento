// Job do tick (REALIZA-169): lembretes do prazo de 3 meses da trilha de
// especialista — 15d, 7d e vencida, fire-once por (dupla, marco, destino)
// via ledger trilha_lembretes (0108). Nenhum encerramento automático: o
// ping leva ao rito humano (encerrar_trilha_especialista + avaliação §13).
//
// A lógica mora toda na RPC processar_lembretes_trilha (varredura + dedup +
// notificações) — o job só passa o dia civil BRT do contexto (e itera o
// range quando o tick roda com ?desde=, igual ao backfill dos snapshots:
// marcos que seriam devidos em dias passados disparam como se o job tivesse
// rodado diário — idempotente pelo ledger).

import { createAdminClient } from "@/lib/supabase/admin";
import { diasDoRange, type JobContext, type JobResult } from "./jobs";

type RetornoRpc = {
  ok?: boolean;
  avaliadas?: number;
  enviados?: number;
  lembretes?: { marco: string; destino: string; n: number }[];
};

export async function rodarLembretesTrilha(
  ctx: JobContext
): Promise<JobResult> {
  const admin = createAdminClient();
  const dias = diasDoRange(ctx.desde ?? ctx.hoje, ctx.hoje);
  const erros: { dia: string; erro: string }[] = [];
  let avaliadas = 0;
  let enviados = 0;
  const lembretes: NonNullable<RetornoRpc["lembretes"]> = [];
  for (const dia of dias) {
    const { data, error } = await admin.rpc("processar_lembretes_trilha", {
      p_hoje: dia,
    });
    if (error) {
      // falha de um dia não aborta o backfill — ok=false sinaliza o tick
      erros.push({ dia, erro: error.message });
      continue;
    }
    const r = (data ?? {}) as RetornoRpc;
    avaliadas += r.avaliadas ?? 0;
    enviados += r.enviados ?? 0;
    if (r.lembretes?.length) lembretes.push(...r.lembretes);
  }
  return {
    ok: erros.length === 0,
    dias: dias.length,
    avaliadas,
    enviados,
    ...(lembretes.length ? { lembretes } : {}),
    ...(erros.length ? { erros } : {}),
  };
}
