"use client";

// The open run: hero strip (progress + composition), the live theater
// (in-flight cell, item/min + ETA + running cost, result ticker), four
// KPIs counting up item by item, a close-out moment when the loop drains
// the queue, and — with >1 model — the comparison block (pass rate /
// latency / cost side by side + divergent cases that focus the matrix).

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowsClockwise,
  CaretDown,
  CircleNotch,
  FileCsv,
  FileJs,
  FileText,
  Pause,
  Play,
  Trash,
  Trophy,
  X,
} from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { BarraSegmentada } from "@/components/viz";
import { MatrizCasos } from "./matriz";
import { NumeroVivo } from "./numero-vivo";
import { baixarArquivo, evalCsv, evalJson, evalMarkdown } from "./exportar";
import {
  compacto,
  dataCurta,
  ms,
  stagger,
  STATUS_ITEM,
  STATUS_RUN,
  usd,
  type FiltroItem,
  type Item,
  type ProximoItem,
  type RunDetalhe,
} from "./tipos";

/** KPI card — the big number is a NumeroVivo so every landed item eases
 *  it to the new value instead of snapping. */
function Kpi({
  rotulo,
  valor,
  formato,
  meta,
  i,
}: {
  rotulo: string;
  valor: number | null;
  formato?: (v: number) => string;
  meta?: string;
  i: number;
}) {
  return (
    <div
      className="animate-enter rounded-xl border border-border bg-card p-3 sm:p-4"
      style={stagger(i)}
    >
      <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
        {rotulo}
      </p>
      <p className="mt-1 text-xl font-semibold tabular-nums tracking-tight sm:text-2xl">
        {valor == null ? "—" : <NumeroVivo valor={valor} formato={formato} />}
      </p>
      {meta && <p className="mt-0.5 text-xs text-muted-foreground">{meta}</p>}
    </div>
  );
}

/** Ticker chip of a finished item — enters from the right. */
function ChipFeed({ item }: { item: Item }) {
  const s = STATUS_ITEM[item.status];
  return (
    <span
      className="animate-enter-x inline-flex shrink-0 items-center gap-1.5 rounded-full border border-border bg-background px-2 py-1 text-[11px] text-muted-foreground"
      title={`${item.caso_id} · ${item.modelo} rep ${item.repeticao}: ${s.rotulo}`}
    >
      <span
        aria-hidden
        className={cn(
          "size-1.5 rounded-full",
          item.status === "ok"
            ? "bg-[var(--ok)]"
            : item.status === "falhou"
              ? "bg-[var(--danger)]"
              : "bg-[var(--warn)]"
        )}
      />
      <span className="max-w-36 truncate font-medium text-foreground">
        {item.caso_id}
      </span>
      <span className="max-w-28 truncate">{item.modelo}</span>
      <span className="tabular-nums">{ms(item.latencia_ms)}</span>
    </span>
  );
}

/** Close-out moment: the surface and the icon follow the outcome (ok
 *  green when clean, warn when there are items to review), the number
 *  carries the weight — and the next step sits on the right. */
function Fechamento({
  stats,
  onVerFalhas,
  onReexecutar,
  reexecutando,
}: {
  stats: { total: number; ok: number; falhas: number; erros: number };
  onVerFalhas: () => void;
  onReexecutar: () => void;
  reexecutando: boolean;
}) {
  const pct = stats.total ? Math.round((stats.ok / stats.total) * 100) : 0;
  const revisar = stats.falhas + stats.erros;
  const limpo = revisar === 0;
  const tom = limpo ? "ok" : "warn";
  return (
    <div
      className={cn(
        "animate-enter flex flex-wrap items-center gap-3 rounded-xl border p-4",
        limpo
          ? "border-[var(--ok-border)] bg-[var(--ok-bg)]"
          : "border-[var(--warn-border)] bg-[var(--warn-bg)]",
      )}
    >
      <svg viewBox="0 0 52 52" className="size-10 shrink-0" aria-hidden>
        <circle
          cx="26"
          cy="26"
          r="25"
          fill={`var(--${tom})`}
          className="confirm-pop"
        />
        {limpo ? (
          <path
            d="M15 27l7.5 7.5L37 19"
            fill="none"
            stroke="var(--status-foreground)"
            strokeWidth="4"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="confirm-draw"
          />
        ) : (
          <>
            <path
              d="M26 16v15"
              fill="none"
              stroke="var(--status-foreground)"
              strokeWidth="4"
              strokeLinecap="round"
              className="confirm-draw"
            />
            <circle cx="26" cy="37" r="2.6" fill="var(--status-foreground)" />
          </>
        )}
      </svg>
      <div className="min-w-0 flex-1">
        <p
          className={cn(
            "text-sm font-semibold",
            limpo ? "text-[var(--ok-text)]" : "text-[var(--warn-text)]",
          )}
        >
          {limpo
            ? "Fechou verde"
            : `Fechou com ${revisar} ${revisar === 1 ? "item pra revisar" : "itens pra revisar"}`}
        </p>
        <p
          className={cn(
            "mt-0.5 text-xs",
            limpo ? "text-[var(--ok-text)]/75" : "text-[var(--warn-text)]/75",
          )}
        >
          <span className="text-sm font-semibold tabular-nums">{pct}%</span>
          {` passou · ${stats.ok} de ${stats.total} itens`}
          {stats.falhas > 0 &&
            ` · ${stats.falhas} ${stats.falhas === 1 ? "falha" : "falhas"} de rubrica`}
          {stats.erros > 0 &&
            ` · ${stats.erros} ${stats.erros === 1 ? "erro" : "erros"} de infra`}
        </p>
      </div>
      {revisar > 0 && (
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={onVerFalhas}>
            Ver só as falhas
          </Button>
          <Button size="sm" onClick={onReexecutar} disabled={reexecutando}>
            <ArrowsClockwise
              aria-hidden
              className={reexecutando ? "animate-spin" : undefined}
            />
            {reexecutando ? "Reagendando…" : "Reexecutar falhas"}
          </Button>
        </div>
      )}
    </div>
  );
}

/** Side-by-side model comparison: pass-rate bars + mean latency + cost,
 *  winner gets a subtle ring; divergent cases focus the matrix. */
function Comparativo({
  run,
  itens,
  casoFoco,
  onCasoFoco,
}: {
  run: RunDetalhe;
  itens: Item[];
  casoFoco: string | null;
  onCasoFoco: (id: string | null) => void;
}) {
  const porModelo = useMemo(() => {
    const acc = new Map<
      string,
      { n: number; feitos: number; ok: number; lats: number[]; custo: number }
    >();
    for (const m of run.modelos) {
      acc.set(m, { n: 0, feitos: 0, ok: 0, lats: [], custo: 0 });
    }
    for (const i of itens) {
      const e = acc.get(i.modelo) ?? { n: 0, feitos: 0, ok: 0, lats: [], custo: 0 };
      e.n++;
      if (i.status === "ok") {
        e.ok++;
        e.feitos++;
      } else if (i.status === "falhou" || i.status === "erro") e.feitos++;
      if (i.latencia_ms != null) e.lats.push(i.latencia_ms);
      e.custo += i.custo_usd ?? 0;
      acc.set(i.modelo, e);
    }
    return acc;
  }, [itens, run.modelos]);

  const divergentes = useMemo(() => {
    const porCaso = new Map<string, Map<string, string>>();
    for (const i of itens) {
      const feito =
        i.status === "ok" || i.status === "falhou" || i.status === "erro";
      if (!feito) continue;
      const m = porCaso.get(i.caso_id) ?? new Map<string, string>();
      const cur = m.get(i.modelo) ?? "";
      m.set(i.modelo, cur ? `${cur},${i.status}` : i.status);
      porCaso.set(i.caso_id, m);
    }
    const msg = new Map<string, string>();
    for (const i of itens) if (!msg.has(i.caso_id)) msg.set(i.caso_id, i.msg);
    const lista: { id: string; msg: string; res: Map<string, string> }[] = [];
    for (const [casoId, res] of porCaso) {
      // divergent = models disagree on the sorted outcome multiset and
      // every model already judged at least one rep
      const assinaturas = new Set(
        [...res.entries()].map(
          ([, v]) => v.split(",").sort().join(",")
        )
      );
      if (assinaturas.size > 1 && res.size >= run.modelos.length) {
        lista.push({ id: casoId, msg: msg.get(casoId) ?? casoId, res });
      }
    }
    return lista;
  }, [itens, run.modelos]);

  const linhas = run.modelos.map((m) => {
    const e = porModelo.get(m);
    const rate = e && e.feitos ? e.ok / e.feitos : null;
    const lat = e?.lats.length
      ? e.lats.reduce((a, b) => a + b, 0) / e.lats.length
      : null;
    return { modelo: m, e, rate, lat };
  });
  const melhor = linhas.reduce<(typeof linhas)[number] | null>((b, l) => {
    if (l.rate == null) return b;
    if (!b || (b.rate ?? 0) < l.rate) return l;
    if (
      b.rate === l.rate &&
      l.lat != null &&
      (b.lat == null || l.lat < b.lat)
    )
      return l;
    return b;
  }, null);

  return (
    <div
      className="animate-enter rounded-xl border border-border bg-card p-4 sm:p-5"
      style={stagger(4)}
    >
      <h3 className="text-base font-semibold">Comparando modelos</h3>
      <ul className="mt-3 space-y-2.5">
        {linhas.map((l, idx) => {
          const venceu = melhor?.modelo === l.modelo && linhas.length > 1;
          return (
            <li
              key={l.modelo}
              style={stagger(idx)}
              className={cn(
                "animate-enter flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-lg border px-3 py-2",
                venceu
                  ? "border-[var(--ok-border)] ring-1 ring-[var(--ok-border)]"
                  : "border-border/70"
              )}
            >
              <span className="flex min-w-0 flex-1 items-center gap-1.5">
                <span className="truncate text-sm font-medium" title={l.modelo}>
                  {l.modelo}
                </span>
                {venceu && (
                  <Trophy
                    size={13}
                    weight="fill"
                    aria-label="Melhor do run"
                    className="shrink-0 text-[var(--ok-text)]"
                  />
                )}
              </span>
              <span
                role="img"
                aria-label={`${l.e?.ok ?? 0} de ${l.e?.feitos ?? 0} itens julgados passaram`}
                className="h-2 w-24 shrink-0 overflow-hidden rounded-full bg-muted sm:w-32"
              >
                <span
                  className="block h-full rounded-full bg-[var(--ok)] transition-[width] duration-500 ease-snappy"
                  style={{ width: `${((l.rate ?? 0) * 100).toFixed(1)}%` }}
                />
              </span>
              <span className="w-14 shrink-0 text-right text-sm font-semibold tabular-nums">
                {l.rate == null ? "—" : `${Math.round(l.rate * 100)}%`}
              </span>
              <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                {l.e ? `${l.e.ok}/${l.e.feitos}` : "0/0"} · {ms(l.lat)} ·{" "}
                {usd(l.e?.custo ?? 0)}
              </span>
            </li>
          );
        })}
      </ul>
      {divergentes.length > 0 && (
        <div className="mt-3 border-t border-border/60 pt-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            {divergentes.length}{" "}
            {divergentes.length === 1 ? "caso divergente" : "casos divergentes"}
          </p>
          <ul className="mt-1.5 flex flex-wrap gap-1.5">
            {divergentes.map((d) => (
              <li key={d.id}>
                <button
                  type="button"
                  aria-pressed={casoFoco === d.id}
                  onClick={() => onCasoFoco(casoFoco === d.id ? null : d.id)}
                  title={d.msg}
                  className={cn(
                    "inline-flex min-h-9 items-center gap-1.5 rounded-full border px-2.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:min-h-7",
                    casoFoco === d.id
                      ? "border-foreground bg-foreground text-background"
                      : "border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  <span className="max-w-44 truncate">{d.msg}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export function DetalheRun({
  run,
  itens,
  driving,
  bloqueado,
  atual,
  feed,
  celebrar,
  reexecutando,
  apagando,
  onContinuar,
  onPausar,
  onReexecutar,
  onApagar,
  onFechar,
}: {
  run: RunDetalhe;
  itens: Item[];
  driving: boolean;
  bloqueado: boolean;
  atual: ProximoItem | null;
  feed: Item[];
  celebrar: boolean;
  reexecutando: boolean;
  apagando: boolean;
  onContinuar: () => void;
  onPausar: () => void;
  onReexecutar: () => void;
  onApagar: () => Promise<boolean> | void;
  onFechar: () => void;
}) {
  const [filtro, setFiltro] = useState<FiltroItem>("todos");
  const [casoFoco, setCasoFoco] = useState<string | null>(null);
  const [confirmApagar, setConfirmApagar] = useState(false);
  const matrizRef = useRef<HTMLDivElement>(null);
  const [ritmo, setRitmo] = useState<{
    porMin: number | null;
    etaMs: number;
  } | null>(null);
  const sessao = useRef<{ t0: number; feitos: number } | null>(null);

  const stats = useMemo(() => {
    const por = (s: Item["status"]) =>
      itens.filter((i) => i.status === s).length;
    const lats = itens
      .map((i) => i.latencia_ms)
      .filter((v): v is number => v != null)
      .sort((a, b) => a - b);
    const soma = (k: "tokens_in" | "tokens_out" | "custo_usd") =>
      itens.reduce((acc, i) => acc + (i[k] ?? 0), 0);
    return {
      total: itens.length,
      ok: por("ok"),
      falhas: por("falhou"),
      erros: por("erro"),
      rodando: por("rodando"),
      naFila: por("pendente"),
      latMedia: lats.length
        ? lats.reduce((a, b) => a + b, 0) / lats.length
        : null,
      p95: lats.length
        ? lats[Math.min(lats.length - 1, Math.ceil(lats.length * 0.95) - 1)]
        : null,
      tokensIn: soma("tokens_in"),
      tokensOut: soma("tokens_out"),
      custo: soma("custo_usd"),
    };
  }, [itens]);

  const feitos = stats.ok + stats.falhas + stats.erros;
  const revisar = stats.falhas + stats.erros;
  const pct = stats.total ? Math.round((stats.ok / stats.total) * 100) : 0;

  const exportar = (fmt: "json" | "csv" | "md") => {
    const base = `eval-${run.id.slice(0, 8)}-${run.created_at.slice(0, 10)}`;
    if (fmt === "json")
      baixarArquivo(`${base}.json`, evalJson(run, itens), "application/json");
    else if (fmt === "csv")
      baixarArquivo(`${base}.csv`, evalCsv(run, itens), "text/csv");
    else baixarArquivo(`${base}.md`, evalMarkdown(run, itens), "text/markdown");
  };

  // Live pace: items/min of this drive session → ETA, falling back to the
  // run's own mean latency (+ per-item overhead) before the first item
  // lands. The 1s interval keeps it honest between items; `feitos` in the
  // deps re-baselines the math whenever an item lands — `sessao` stays the
  // session start.
  useEffect(() => {
    if (!driving) {
      sessao.current = null;
      return;
    }
    sessao.current ??= { t0: Date.now(), feitos };
    const calc = () => {
      const s = sessao.current;
      if (!s) return;
      const decorrido = Date.now() - s.t0;
      const feitosSessao = feitos - s.feitos;
      const restantes = stats.total - feitos;
      setRitmo(
        restantes <= 0
          ? { porMin: null, etaMs: 0 }
          : {
              porMin:
                feitosSessao > 0 ? (feitosSessao / decorrido) * 60000 : null,
              etaMs:
                restantes *
                (feitosSessao > 0
                  ? decorrido / feitosSessao
                  : (stats.latMedia ?? 8000) + 2500),
            }
      );
    };
    const t = setInterval(calc, 800);
    return () => {
      clearInterval(t);
      setRitmo(null);
    };
  }, [driving, feitos, stats.total, stats.latMedia]);

  const etaRotulo = (etaMs: number) =>
    etaMs >= 90000
      ? `~${Math.round(etaMs / 60000)} min`
      : `~${Math.max(1, Math.round(etaMs / 1000))} s`;

  const verFalhas = () => {
    setFiltro("falhou");
    matrizRef.current?.scrollIntoView({ block: "start" });
  };

  return (
    <div className="space-y-3">
      {/* ---------- hero ---------- */}
      <div className="animate-enter rounded-xl border border-border bg-card p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="min-w-0">
            <h3 className="text-base font-semibold">
              Run de {dataCurta(run.created_at)}
              <span className="font-normal text-muted-foreground">
                {" "}
                · {run.ambiente} ·{" "}
                {run.papel === "staff" ? "Staff" : "Mentorado"}
              </span>
            </h3>
            <p
              className="mt-0.5 truncate text-xs text-muted-foreground"
              title={run.modelos.join(", ")}
            >
              {run.modelos.join(", ")} · {run.repeticoes}× por caso
            </p>
          </div>
          <div className="flex items-center gap-2">
            {run.status === "concluido" && (
              <span
                className={cn(
                  "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold tabular-nums",
                  revisar === 0
                    ? "border-[var(--ok-border)] bg-[var(--ok-bg)] text-[var(--ok-text)]"
                    : "border-[var(--warn-border)] bg-[var(--warn-bg)] text-[var(--warn-text)]",
                )}
              >
                {pct}% passou
              </span>
            )}
            <span
              role="status"
              aria-live="polite"
              className="flex items-center gap-1.5 text-xs tabular-nums text-muted-foreground"
            >
              {driving && (
                <CircleNotch size={12} aria-hidden className="animate-spin" />
              )}
              {feitos}/{stats.total}
              {driving
                ? " · rodando…"
                : run.status !== "concluido"
                  ? ` · ${STATUS_RUN[run.status].rotulo}`
                  : ""}
            </span>
            {driving ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onPausar}
              >
                <Pause aria-hidden />
                Pausar
              </Button>
            ) : (
              run.status !== "concluido" && (
                <Button
                  type="button"
                  size="sm"
                  onClick={onContinuar}
                  disabled={bloqueado}
                >
                  <Play aria-hidden />
                  {stats.rodando > 0 || stats.naFila > 0
                    ? "Continuar"
                    : "Executar"}
                </Button>
              )
            )}
            {!driving && (stats.falhas > 0 || stats.erros > 0) && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onReexecutar}
                disabled={reexecutando || bloqueado}
              >
                <ArrowsClockwise
                  aria-hidden
                  className={reexecutando ? "animate-spin" : undefined}
                />
                Reexecutar falhas
              </Button>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={!itens.length}
                  >
                    <FileJs aria-hidden />
                    Exportar
                    <CaretDown size={12} aria-hidden />
                  </Button>
                }
              />
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuItem onClick={() => exportar("json")}>
                  <FileJs aria-hidden />
                  JSON
                  <span className="ml-auto text-xs text-muted-foreground">
                    dados completos
                  </span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => exportar("csv")}>
                  <FileCsv aria-hidden />
                  CSV
                  <span className="ml-auto text-xs text-muted-foreground">
                    planilha
                  </span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => exportar("md")}>
                  <FileText aria-hidden />
                  Markdown
                  <span className="ml-auto text-xs text-muted-foreground">
                    relatório
                  </span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Dialog open={confirmApagar} onOpenChange={setConfirmApagar}>
              <DialogTrigger
                render={
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Apagar este run"
                    disabled={driving || apagando}
                    className="text-muted-foreground hover:text-[var(--danger-text)]"
                  >
                    {apagando ? (
                      <CircleNotch aria-hidden className="animate-spin" />
                    ) : (
                      <Trash aria-hidden />
                    )}
                  </Button>
                }
              />
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Apagar este run?</DialogTitle>
                  <DialogDescription>
                    Apaga o run de {dataCurta(run.created_at)} e os{" "}
                    {stats.total} itens dele. Não dá pra desfazer.
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => setConfirmApagar(false)}
                  >
                    Cancelar
                  </Button>
                  <Button
                    variant="destructive"
                    disabled={apagando}
                    onClick={() => {
                      void Promise.resolve(onApagar()).then(
                        (ok) => ok !== false && setConfirmApagar(false)
                      );
                    }}
                  >
                    {apagando ? "Apagando…" : "Apagar run"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Fechar detalhe do run"
              disabled={driving}
              onClick={onFechar}
            >
              <X aria-hidden />
            </Button>
          </div>
        </div>

        <div
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={stats.total}
          aria-valuenow={feitos}
          aria-label="Itens executados"
          className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted"
        >
          <div
            className="relative h-full bg-primary transition-[width] duration-500 ease-snappy"
            style={{
              width: `${stats.total ? (feitos / stats.total) * 100 : 0}%`,
            }}
          >
            {driving && (
              <span
                aria-hidden
                className="absolute inset-0 animate-shimmer bg-[linear-gradient(90deg,transparent_30%,hsl(0_0%_100%/0.5)_50%,transparent_70%)] bg-[length:200%_100%]"
              />
            )}
          </div>
        </div>

        <BarraSegmentada
          className="mt-3"
          altura="lg"
          legenda
          animate
          denominador={stats.total}
          segmentos={[
            { valor: stats.ok, rotulo: "passou", cls: "bg-[var(--ok)]" },
            { valor: stats.falhas, rotulo: "falhou", cls: "bg-[var(--danger)]" },
            { valor: stats.erros, rotulo: "erro", cls: "bg-[var(--warn)]" },
            { valor: stats.rodando, rotulo: "rodando", cls: "bg-[var(--info)]" },
            { valor: stats.naFila, rotulo: "na fila" },
          ]}
        />

        {/* ---------- ao vivo ---------- */}
        {(driving || feed.length > 0) && (
          <div className="mt-4 border-t border-border/60 pt-3">
            <div
              role="status"
              aria-live="polite"
              className="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-xs text-muted-foreground"
            >
              {atual && driving && (
                <span className="min-w-0">
                  <span className="font-medium text-foreground">
                    {atual.caso_id}
                  </span>
                  {" → "}
                  {atual.modelo} · rep {atual.repeticao}
                  <span className="hidden sm:inline"> · {atual.msg}</span>
                </span>
              )}
              <span className="ml-auto tabular-nums">
                {ritmo?.porMin != null && (
                  <>
                    {ritmo.porMin.toFixed(1).replace(".", ",")} itens/min ·{" "}
                  </>
                )}
                {ritmo && ritmo.etaMs > 0 && <>faltam {etaRotulo(ritmo.etaMs)} · </>}
                <NumeroVivo valor={stats.custo} formato={usd} /> até aqui
              </span>
            </div>
            {feed.length > 0 && (
              <ul
                aria-hidden
                className="mt-2 flex gap-1.5 overflow-hidden [mask-image:linear-gradient(to_left,transparent,black_24px)]"
              >
                {feed.map((i) => (
                  <li key={i.id} className="shrink-0">
                    <ChipFeed item={i} />
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      {/* ---------- fechamento ---------- */}
      {celebrar && (
        <Fechamento
          stats={stats}
          onVerFalhas={verFalhas}
          onReexecutar={onReexecutar}
          reexecutando={reexecutando}
        />
      )}

      {/* ---------- KPIs ---------- */}
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        <Kpi
          i={1}
          rotulo="Pass rate"
          valor={feitos ? (stats.ok / feitos) * 100 : null}
          formato={(v) => `${Math.round(v)}%`}
          meta={`${stats.ok} de ${feitos} julgados`}
        />
        <Kpi
          i={2}
          rotulo="Latência média"
          valor={stats.latMedia}
          formato={ms}
          meta={stats.p95 != null ? `p95 ${ms(stats.p95)}` : undefined}
        />
        <Kpi
          i={3}
          rotulo="Tokens"
          valor={stats.tokensIn + stats.tokensOut}
          formato={(v) => compacto.format(v)}
          meta={`${compacto.format(stats.tokensIn)} entrada · ${compacto.format(stats.tokensOut)} saída`}
        />
        <Kpi
          i={4}
          rotulo="Custo"
          valor={stats.custo}
          formato={usd}
          meta={feitos > 0 ? `${usd(stats.custo / feitos)} por item` : undefined}
        />
      </div>

      {/* ---------- comparativo ---------- */}
      {run.modelos.length > 1 && (
        <Comparativo
          run={run}
          itens={itens}
          casoFoco={casoFoco}
          onCasoFoco={setCasoFoco}
        />
      )}

      {/* ---------- matriz ---------- */}
      <div ref={matrizRef} className="scroll-mt-4">
        <MatrizCasos
          run={run}
          itens={itens}
          filtro={filtro}
          onFiltro={setFiltro}
          casoFoco={casoFoco}
          onCasoFoco={setCasoFoco}
          latMedia={stats.latMedia}
        />
      </div>
    </div>
  );
}
