import { NextResponse, type NextRequest } from "next/server";
import {
  autorizarCron,
  paramsDoTick,
  rodarSaudeSnapshots,
  type JobContext,
  type JobResult,
} from "@/lib/jobs";
import { rodarLembretesRegistro } from "@/lib/jobs-lembretes-registro";
import { rodarLembretesTrilha } from "@/lib/jobs-lembretes-trilha";

export const dynamic = "force-dynamic";
// o diário cabe folgado; a folga é pro backfill (dias corridos × duplas)
export const maxDuration = 60;

/** GET /api/jobs/tick — ÚNICO cron do vercel.json. O plano Hobby limita a
 *  quantidade de schedules do projeto, então um disparo diário (06:00 UTC =
 *  03:00 BRT, fora de uso e antes do dia útil) orquestra todos os jobs: os
 *  próximos (lembretes 168/169, digest 178) se registram no JOBS abaixo —
 *  uma linha cada — em vez de abrir cron próprio.
 *
 *  Auth: `Authorization: Bearer $CRON_SECRET` (a Vercel injeta quando a env
 *  existe). Sem env → 503; bearer errado/ausente → 401 JSON — nunca
 *  redirect: /api/jobs/* é pública no middleware de propósito.
 *
 *  Params:
 *    ?job=<nome>          roda um job só (disparo manual)
 *    ?desde=YYYY-MM-DD    backfill a partir do dia (≤60d sem confirm)
 *    &confirm=1           destrava backfill >60d
 */
const JOBS: Record<string, (ctx: JobContext) => Promise<JobResult>> = {
  saude_snapshots: rodarSaudeSnapshots,
  // REALIZA-169 — lembretes do prazo de 3 meses da trilha especialista
  // (15d/7d/vencida; ledger 0108 torna o re-run inócuo)
  lembretes_trilha: rodarLembretesTrilha,
  // REALIZA-214 — lembretes de registro pendente (24h/72h; ledger 0122)
  lembretes_registro: rodarLembretesRegistro,
};

async function tick(request: NextRequest): Promise<NextResponse> {
  const negado = autorizarCron(request);
  if (negado) return negado;

  const p = paramsDoTick(request.nextUrl.searchParams);
  if (!p.ok) return p.resposta;

  const soJob = request.nextUrl.searchParams.get("job");
  const alvos = Object.entries(JOBS).filter(
    ([nome]) => !soJob || nome === soJob
  );
  if (soJob && alvos.length === 0) {
    return NextResponse.json(
      { error: `Job desconhecido: ${soJob}`, jobs: Object.keys(JOBS) },
      { status: 404 }
    );
  }

  const jobs: Record<string, JobResult> = {};
  let ok = true;
  // sequencial de propósito: jobs dividem o mesmo banco free-tier — um burst
  // paralelo diário não compra nada e complica o log
  for (const [nome, run] of alvos) {
    try {
      const r = await run(p.ctx);
      jobs[nome] = r;
      if (!r.ok) ok = false;
    } catch (e) {
      ok = false;
      jobs[nome] = {
        ok: false,
        error: e instanceof Error ? e.message : String(e),
      };
      console.error(`jobs/tick ${nome}:`, e);
    }
  }
  console.info(`jobs/tick hoje=${p.ctx.hoje} ok=${ok} ${JSON.stringify(jobs)}`);
  // 500 quando algum job falhou: o run aparece como falho no dashboard da
  // Vercel (e o retry/re-disparo manual é inócuo — os jobs são idempotentes)
  return NextResponse.json(
    { ok, hoje: p.ctx.hoje, jobs },
    { status: ok ? 200 : 500 }
  );
}

// GET = chamada do Vercel Cron; POST = disparo manual com o mesmo bearer
export const GET = tick;
export const POST = tick;
