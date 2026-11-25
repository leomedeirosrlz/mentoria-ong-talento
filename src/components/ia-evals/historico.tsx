"use client";

// Run history: a pass-rate sparkline over time (the eval's health) plus
// selectable cards. The open run renders a pixel thumbnail of its loaded
// items (4px per item, live); the rest show the BarraSegmentada built
// from the persisted resumo. Each card offers "Repetir esta grade" and,
// for unfinished runs, "Continuar".

import { useState } from "react";
import {
  ArrowCounterClockwise,
  CircleNotch,
  Play,
  Trash,
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
import { BarraSegmentada, Sparkline } from "@/components/viz";
import {
  CELULA,
  dataCurta,
  diaCurta,
  ms,
  stagger,
  STATUS_RUN,
  usd,
  type Item,
  type Run,
  type RunDetalhe,
} from "./tipos";

/** Flat pixel strip of the loaded items in claim order — reads as a
 *  squashed matrix (contiguous blocks per caso) at any item count. */
function MiniMatriz({ itens }: { itens: Item[] }) {
  return (
    <span
      role="img"
      aria-label={`${itens.length} itens: ${itens.filter((i) => i.status === "ok").length} passaram`}
      className="flex max-h-14 flex-wrap content-start gap-[3px] overflow-hidden"
    >
      {itens.map((i) => (
        <span
          key={i.id}
          title={`${i.caso_id} · ${i.modelo} rep ${i.repeticao}`}
          className={cn("size-1.5 shrink-0 rounded-[2px]", CELULA[i.status])}
        />
      ))}
    </span>
  );
}

export function HistoricoRuns({
  runs,
  detalhe,
  driving,
  limpando,
  onLimpar,
  onAbrir,
  onContinuar,
  onRepetir,
}: {
  runs: Run[];
  detalhe: { run: RunDetalhe; itens: Item[] } | null;
  driving: string | null;
  limpando: boolean;
  onLimpar: () => Promise<boolean>;
  onAbrir: (id: string) => void;
  onContinuar: (id: string) => void;
  onRepetir: (id: string) => void;
}) {
  const [confirmando, setConfirmando] = useState(false);
  // the API returns desc — the time axis grows to the right, so flip it
  const ultimos = runs.slice(0, 14).reverse();
  const serie = ultimos.map((r) =>
    r.resumo && r.resumo.total > 0
      ? Math.round((r.resumo.ok / r.resumo.total) * 100)
      : null
  );
  const passoRotulo = Math.max(1, Math.ceil(ultimos.length / 7));
  const labelsX = ultimos.map((r, i) =>
    i % passoRotulo === 0 || i === ultimos.length - 1 ? diaCurta(r.created_at) : ""
  );
  return (
    <div className="rounded-xl border border-border bg-card p-4 sm:p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-base font-semibold">Runs recentes</h3>
        <div className="flex items-center gap-1">
          <span className="text-xs tabular-nums text-muted-foreground">
            {runs.length} {runs.length === 1 ? "run" : "runs"}
          </span>
          <Dialog open={confirmando} onOpenChange={setConfirmando}>
            <DialogTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Limpar histórico de runs"
                  disabled={limpando || driving !== null}
                  className="size-7 text-muted-foreground hover:text-[var(--danger-text)]"
                >
                  {limpando ? (
                    <CircleNotch aria-hidden className="animate-spin" />
                  ) : (
                    <Trash aria-hidden />
                  )}
                </Button>
              }
            />
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Limpar histórico de runs?</DialogTitle>
                <DialogDescription>
                  Apaga os {runs.length}{" "}
                  {runs.length === 1 ? "run" : "runs"} e todos os itens.
                  Resultados antigos não se misturam com a próxima rodada.
                  Não dá pra desfazer.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button variant="outline" onClick={() => setConfirmando(false)}>
                  Cancelar
                </Button>
                <Button
                  variant="destructive"
                  disabled={limpando}
                  onClick={() => {
                    void onLimpar().then((ok) => ok && setConfirmando(false));
                  }}
                >
                  {limpando ? "Limpando…" : "Limpar tudo"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {ultimos.length > 1 && serie.some((v) => v != null) && (
        <div className="mt-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            Pass rate ao longo do tempo
          </p>
          <Sparkline
            className="mt-1"
            series={[
              { valores: serie, rotulo: "pass rate", cor: "var(--chart-1)" },
            ]}
            min={0}
            max={100}
            labelsX={labelsX}
            atencaoAbaixoDe={50}
            altura={90}
            formatarValor={(v) => `${Math.round(v)}%`}
          />
        </div>
      )}

      <ul className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {runs.map((r, idx) => {
          const sel = r.id === detalhe?.run.id;
          const res = r.resumo;
          const naFila = res ? res.total - res.ok - res.falhas - res.erros : 0;
          const aberto = sel ? detalhe : null;
          return (
            <li
              key={r.id}
              style={stagger(idx)}
              className={cn(
                "animate-enter flex flex-col overflow-hidden rounded-xl border bg-card transition-[border-color,box-shadow] duration-200 ease-snappy",
                sel ? "border-transparent ring-2 ring-ring" : "border-border"
              )}
            >
              <Button
                type="button"
                variant="ghost"
                onClick={() => onAbrir(r.id)}
                aria-current={sel || undefined}
                className="h-auto w-full flex-1 flex-col items-stretch gap-1.5 rounded-none px-3 py-2.5 text-left font-normal whitespace-normal hover:bg-muted/40"
              >
                <span className="flex items-baseline justify-between gap-2">
                  <span className="text-sm font-medium">
                    {dataCurta(r.created_at)}
                  </span>
                  <span className="shrink-0 text-[11px] text-muted-foreground">
                    {r.ambiente} · {r.papel === "staff" ? "Staff" : "Mentorado"}
                  </span>
                </span>
                <span
                  className="truncate text-xs text-muted-foreground"
                  title={r.modelos.join(", ")}
                >
                  {r.modelos.join(", ")} · {r.repeticoes}× por caso
                </span>
                {aberto ? (
                  <MiniMatriz itens={aberto.itens} />
                ) : res ? (
                  <BarraSegmentada
                    className="mt-0.5"
                    altura="sm"
                    denominador={res.total}
                    segmentos={[
                      { valor: res.ok, rotulo: "passou", cls: "bg-[var(--ok)]" },
                      {
                        valor: res.falhas,
                        rotulo: "falhou",
                        cls: "bg-[var(--danger)]",
                      },
                      { valor: res.erros, rotulo: "erro", cls: "bg-[var(--warn)]" },
                      { valor: naFila, rotulo: "na fila" },
                    ]}
                  />
                ) : (
                  <span className="mt-0.5 flex items-center gap-1.5">
                    <span
                      className={cn(
                        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium",
                        STATUS_RUN[r.status].cls
                      )}
                    >
                      {r.status === "rodando" && (
                        <CircleNotch
                          size={11}
                          aria-hidden
                          className="animate-spin"
                        />
                      )}
                      {STATUS_RUN[r.status].rotulo}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      sem resumo ainda
                    </span>
                  </span>
                )}
                {res && (
                  <span className="mt-1 flex items-baseline justify-between gap-2">
                    <span className="text-sm font-semibold tabular-nums">
                      {res.total > 0
                        ? `${Math.round((res.ok / res.total) * 100)}%`
                        : "—"}
                      <span className="ml-1 text-xs font-normal text-muted-foreground">
                        passou
                      </span>
                    </span>
                    <span className="text-xs tabular-nums text-muted-foreground">
                      {ms(res.latencia_media_ms)} · {usd(res.custo_usd)}
                    </span>
                  </span>
                )}
              </Button>
              <div className="flex items-center border-t border-border/60 px-2 py-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => onRepetir(r.id)}
                  className="flex-1 text-xs"
                >
                  <ArrowCounterClockwise aria-hidden />
                  Repetir grade
                </Button>
                {r.status !== "concluido" &&
                  (driving === r.id ? (
                    <span
                      role="status"
                      className="flex min-h-7 flex-1 items-center justify-center gap-1.5 text-xs font-medium text-[var(--info-text)]"
                    >
                      <CircleNotch
                        size={12}
                        aria-hidden
                        className="animate-spin"
                      />
                      rodando…
                    </span>
                  ) : (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={driving !== null}
                      onClick={() => onContinuar(r.id)}
                      className="flex-1 text-xs"
                    >
                      <Play aria-hidden />
                      Continuar
                    </Button>
                  ))}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
