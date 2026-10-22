// Infra dos jobs agendados + o job do semáforo (REALIZA-182).
//
// Não existe scheduler no ambiente (sem pg_cron/pg_net na Supabase, sem Edge
// Functions): o agendador é o Vercel Cron chamando /api/jobs/tick 1×/dia — o
// plano Hobby permite poucos crons, então UM tick orquestra todos os jobs.
// Cada issue nova (lembretes 168/169, digest 178…) registra a sua função no
// JOBS da route em vez de abrir cron próprio. /api/jobs/* é pública no
// middleware (cron não tem sessão) — a autenticação é o bearer CRON_SECRET
// aqui, respondendo 401/503 em JSON, nunca redirect de login.
//
// O semáforo NÃO é reimplementado: chama saudadeDaDupla (ciclo.ts), a mesma
// função pura das telas, sobre a mesma carga do DUPLA_SELECT. A escrita
// passa pela RPC gravar_saude_snapshots (0107) — a tabela não tem grant nem
// policy de escrita pra authenticated.

import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  diffDias,
  saudadeDaDupla,
  toDateStr,
  type DuplaSaude,
  type Semaforo,
  type Sinal,
} from "./ciclo";
import { DUPLA_SELECT } from "./queries";
import type { CicloEvento, Dupla, DuplaStatus } from "./types";

// ---------- convenção /api/jobs/* ----------

export type JobContext = {
  /** "hoje" civil em America/Sao_Paulo (YYYY-MM-DD) — o dia-alvo do run. */
  hoje: string;
  /** Backfill: primeiro dia a recalcular. Ausente = só hoje. */
  desde?: string;
  /** Trava de segurança: backfill >60 dias só passa pela rota com confirm=1. */
  confirm: boolean;
};

export type JobResult = {
  ok: boolean;
  /** Motivo agregado quando ok=false — vai pro log do tick e pro JSON. */
  error?: string;
  [extra: string]: unknown;
};

const DATA_RE = /^\d{4}-\d{2}-\d{2}$/;
const BACKFILL_LIMITE_DIAS = 60;

/** Gate do bearer CRON_SECRET — o padrão do Vercel Cron (a Vercel injeta
 *  `Authorization: Bearer <secret>` quando a env existe). Retorna null se
 *  autorizado; senão a resposta pronta: 503 sem a env (não roda "aberto"),
 *  401 bearer ausente/errado — sempre JSON. */
export function autorizarCron(request: Request): NextResponse | null {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "CRON_SECRET não configurado — job desligado, nada rodou." },
      { status: 503 }
    );
  }
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }
  return null;
}

/** Valida os params compartilhados do tick (?desde=YYYY-MM-DD, ?confirm=1)
 *  e devolve o JobContext pronto — ou a resposta 400. `hoje` é o dia civil
 *  BRT (nunca toISOString, que é UTC e erra o dia entre 21h e 00h). */
export function paramsDoTick(
  sp: URLSearchParams
):
  | { ok: true; ctx: JobContext }
  | { ok: false; resposta: NextResponse } {
  const hoje = toDateStr(new Date());
  const desde = sp.get("desde");
  const confirm = sp.get("confirm") === "1";
  if (desde != null) {
    if (!DATA_RE.test(desde) || desde > hoje) {
      return {
        ok: false,
        resposta: NextResponse.json(
          { error: "desde inválido — use YYYY-MM-DD até hoje (BRT)." },
          { status: 400 }
        ),
      };
    }
    if (diffDias(hoje, desde) > BACKFILL_LIMITE_DIAS && !confirm) {
      return {
        ok: false,
        resposta: NextResponse.json(
          {
            error: `Backfill de mais de ${BACKFILL_LIMITE_DIAS} dias exige &confirm=1.`,
          },
          { status: 400 }
        ),
      };
    }
  }
  return {
    ok: true,
    ctx: { hoje, ...(desde ? { desde } : {}), confirm },
  };
}

/** Range inclusivo de dias civis [desde..hoje] em YYYY-MM-DD. */
export function diasDoRange(desde: string, hoje: string): string[] {
  const dias: string[] = [];
  // âncora meio-dia: "T00:00:00" pode virar o dia anterior no fuso de SP
  const d = new Date(`${desde}T12:00:00`);
  const fim = new Date(`${hoje}T12:00:00`);
  while (d.getTime() <= fim.getTime()) {
    dias.push(toDateStr(d));
    d.setDate(d.getDate() + 1);
  }
  return dias;
}

// ---------- dupla_saude_snapshots ----------

export type SaudeFonte = "cron" | "lazy" | "backfill";

/** Row persistida — o recorte de DuplaSaude que virou coluna (0107).
 *  `proximo` e `motivo` ficam de fora de propósito: proximo estale rápido e
 *  motivo = motivos[0]. Os textos de motivos/sinais são contagens, ordinais,
 *  datas e labels de enum — sem nome de pessoa (verificação LGPD do PR). */
export type SaudeSnapshotRow = {
  dupla_id: string;
  dia: string;
  semaforo: Semaforo;
  motivos: string[];
  sinais: Sinal[];
  esperado: number;
  feitos: number;
  registro_pendente: boolean;
  pediu_apoio: boolean;
  apoio_jovem: boolean;
  avaliacao_jovem_pendente: number;
  fonte: SaudeFonte;
};

// concluída/encerrada não ganha snapshot novo — o semáforo delas é congelado
// e a última row viva já registra o fechamento (sdd §3)
const STATUS_SNAPSHOT: readonly DuplaStatus[] = ["ativa", "pausada"];
const LOTE_RPC = 400;

/** DuplaSaude → row. Mapeamento único: a RPC só recebe estas chaves — o TS
 *  é quem projeta o objeto de domínio nas colunas do banco. */
export function saudeParaRow(
  duplaId: string,
  dia: string,
  saude: DuplaSaude,
  fonte: SaudeFonte
): SaudeSnapshotRow {
  return {
    dupla_id: duplaId,
    dia,
    semaforo: saude.semaforo,
    motivos: saude.motivos,
    sinais: saude.sinais,
    esperado: saude.esperado,
    feitos: saude.feitos,
    registro_pendente: saude.registroPendente,
    pediu_apoio: saude.pediuApoio,
    apoio_jovem: saude.apoioJovem,
    avaliacao_jovem_pendente: saude.avaliacaoJovemPendente,
    fonte,
  };
}

/** Job do tick: 1 snapshot por dupla ativa/pausada por dia civil BRT, upsert
 *  idempotente via RPC (a unique(dupla_id,dia) torna retry/re-run inócuo —
 *  o último cálculo do dia ganha). `ctx.desde` liga o backfill: recalcula
 *  dias passados com os dados ATUAIS — aproximação honesta, não replay
 *  point-in-time (registros/encontros não são versionados); as rows
 *  retroativas saem com fonte='backfill', a de hoje com 'cron'.
 *
 *  Falha parcial não aborta o run: erro de cálculo numa dupla ou de um lote
 *  da RPC é coletado em `erros[]` — um registro ruim não deixa o dia em
 *  branco, e ok=false sinaliza o tick (500) sem esconder o restante. */
export async function rodarSaudeSnapshots(ctx: JobContext): Promise<JobResult> {
  const admin = createAdminClient();
  const dias = diasDoRange(ctx.desde ?? ctx.hoje, ctx.hoje);
  const [duplasRes, eventosRes] = await Promise.all([
    admin
      .from("duplas")
      .select(DUPLA_SELECT)
      .in("status", [...STATUS_SNAPSHOT])
      .order("created_at", { ascending: true }),
    admin
      .from("ciclo_eventos")
      .select("*")
      .order("ordem", { ascending: true }),
  ]);
  if (duplasRes.error)
    return { ok: false, error: `duplas: ${duplasRes.error.message}` };
  if (eventosRes.error)
    return { ok: false, error: `ciclo_eventos: ${eventosRes.error.message}` };
  const duplas = (duplasRes.data ?? []) as unknown as Dupla[];
  const eventos = (eventosRes.data ?? []) as CicloEvento[];

  const erros: { dia: string; alvo: string; erro: string }[] = [];
  let upserts = 0;
  for (const dia of dias) {
    // meio-dia evita edge de fuso — o semáforo é por dia civil, não instante
    const ref = new Date(`${dia}T12:00:00`);
    const fonte: SaudeFonte = dia === ctx.hoje ? "cron" : "backfill";
    const rows: SaudeSnapshotRow[] = [];
    for (const d of duplas) {
      try {
        rows.push(saudeParaRow(d.id, dia, saudadeDaDupla(d, eventos, ref), fonte));
      } catch (e) {
        erros.push({
          dia,
          alvo: d.id,
          erro: e instanceof Error ? e.message : String(e),
        });
      }
    }
    for (let i = 0; i < rows.length; i += LOTE_RPC) {
      const lote = rows.slice(i, i + LOTE_RPC);
      const { data, error } = await admin.rpc("gravar_saude_snapshots", {
        p_rows: lote,
      });
      if (error) {
        erros.push({ dia, alvo: `lote ${i / LOTE_RPC}`, erro: error.message });
      } else {
        upserts += typeof data === "number" ? data : lote.length;
      }
    }
  }
  return {
    ok: erros.length === 0,
    duplas: duplas.length,
    dias: dias.length,
    upserts,
    ...(erros.length ? { erros } : {}),
  };
}

/** Captura lazy (passo 4 do plano — opcional): chamada fire-and-forget
 *  (`void snapshotDuplaHoje(id).catch()`) pelos writes quentes que mudam o
 *  semáforo — salvarRegistro, resolver apoio, encerramento — pra o dia ganhar
 *  snapshot na hora do evento, não só no tick das 03h. Mesma RPC e mesma
 *  unique(dupla_id,dia): reescrever é inócuo. Nunca chamar de dentro de
 *  query (queries.ts é React.cache + RLS do caller — escrita só via action
 *  ou service role). */
export async function snapshotDuplaHoje(
  duplaId: string,
  fonte: SaudeFonte = "lazy"
): Promise<JobResult> {
  const admin = createAdminClient();
  const hoje = toDateStr(new Date());
  const [{ data: dupla, error: dErr }, { data: evData, error: eErr }] =
    await Promise.all([
      admin
        .from("duplas")
        .select(DUPLA_SELECT)
        .eq("id", duplaId)
        .maybeSingle(),
      admin
        .from("ciclo_eventos")
        .select("*")
        .order("ordem", { ascending: true }),
    ]);
  if (dErr) return { ok: false, error: `dupla: ${dErr.message}` };
  if (eErr) return { ok: false, error: `ciclo_eventos: ${eErr.message}` };
  const d = dupla as unknown as Dupla | null;
  // fora da régua não ganha snapshot — mesma regra do tick
  if (!d || !STATUS_SNAPSHOT.includes(d.status)) return { ok: true, pulado: true };
  // instante real (não meio-dia): a captura acontece "agora" — a row do dia
  // reflete o que a tela mostra neste momento
  const saude = saudadeDaDupla(d, (evData ?? []) as CicloEvento[], new Date());
  const { error: upErr } = await admin.rpc("gravar_saude_snapshots", {
    p_rows: [saudeParaRow(d.id, hoje, saude, fonte)],
  });
  if (upErr) return { ok: false, error: `upsert: ${upErr.message}` };
  return { ok: true, dia: hoje, semaforo: saude.semaforo };
}
