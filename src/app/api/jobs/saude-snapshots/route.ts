import { NextResponse, type NextRequest } from "next/server";
import { autorizarCron, paramsDoTick, rodarSaudeSnapshots } from "@/lib/jobs";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** GET /api/jobs/saude-snapshots — endpoint dedicado do job de snapshots
 *  (nome documentado nos specs da REALIZA-182). Mesmo bearer CRON_SECRET e
 *  mesmo runner do tick: existe pra disparo manual e backfill sem tocar nos
 *  demais jobs — o agendamento diário é o /api/jobs/tick (único cron do
 *  vercel.json). Equivale a `/api/jobs/tick?job=saude_snapshots`.
 *
 *    ?desde=YYYY-MM-DD  backfill (rows retroativas com fonte='backfill')
 *    &confirm=1         obrigatório pra varrer mais de 60 dias
 */
async function run(request: NextRequest): Promise<NextResponse> {
  const negado = autorizarCron(request);
  if (negado) return negado;

  const p = paramsDoTick(request.nextUrl.searchParams);
  if (!p.ok) return p.resposta;

  const resultado = await rodarSaudeSnapshots(p.ctx);
  console.info(`jobs/saude-snapshots ${JSON.stringify(resultado)}`);
  return NextResponse.json(
    { ok: resultado.ok, hoje: p.ctx.hoje, job: "saude_snapshots", resultado },
    { status: resultado.ok ? 200 : 500 }
  );
}

export const GET = run;
export const POST = run;
