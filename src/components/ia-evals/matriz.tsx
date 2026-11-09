"use client";

// The case × model heatmap. Rows follow the corpus order (run.casos
// snapshot — item ids alone would scramble it), columns follow
// run.modelos. Cells: ≤3 reps draw individual pips, >3 a segmented
// micro-bar; a rich Popover per cell previews reps and the dossier opens
// inline below the row. Hovering a cell lights its row + column. Under
// `sm` the matrix becomes per-case cards — a different paradigm, not a
// shrunken table.

import { Fragment, useId, useMemo, useState } from "react";
import { CaretDown } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { filterChipCls } from "@/components/ui/filter-chip";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { DossieItem } from "./dossie";
import {
  CELULA,
  CELULA_BARRA,
  descItem,
  grupoDoCaso,
  ms,
  num,
  stagger,
  STATUS_ITEM,
  usd,
  type FiltroItem,
  type Item,
  type RunDetalhe,
} from "./tipos";

type CasoLinha = { id: string; msg: string; pagina: string | null };
type CelulaKey = { caso: string; modelo: string };
type Hover = { caso: string; modelo: string } | null;

/** Pips (≤3 reps) or segmented micro-bar (>3) — the cell's visual. The
 *  status filter already removed non-matching items upstream. */
function RepsVisuais({ its }: { its: Item[] }) {
  if (its.length <= 3) {
    return (
      <span className="inline-flex items-center gap-1">
        {its.map((i) => (
          <span
            // key on id:status — only the rep that changed remounts and
            // plays its ia-pop; the rest transition color in place
            key={`${i.id}:${i.status}`}
            aria-hidden
            className={cn(
              "ia-pop inline-flex size-5 items-center justify-center rounded-[5px] text-[10px] leading-none font-bold transition-[background-color,border-color] duration-300",
              CELULA[i.status]
            )}
          >
            {its.length > 1 ? i.repeticao : ""}
          </span>
        ))}
      </span>
    );
  }
  return (
    <span className="flex h-2 w-full items-stretch gap-px overflow-hidden rounded-full">
      {its.map((i) => (
        <span
          key={`${i.id}:${i.status}`}
          aria-hidden
          className={cn(
            "ia-pop min-w-1 flex-1 transition-[background-color] duration-300",
            CELULA_BARRA[i.status]
          )}
        />
      ))}
    </span>
  );
}

/** Rich per-cell popover: every rep's status/latency/tokens/cost plus the
 *  answer excerpt — and the doorway into the inline dossier. */
function PopoverCelula({
  its,
  caso,
  modelo,
  onAbrirDossie,
}: {
  its: Item[];
  caso: CasoLinha;
  modelo: string;
  onAbrirDossie: () => void;
}) {
  const trecho = [...its].reverse().find((i) => i.resposta_trecho);
  return (
    <PopoverContent
      side="top"
      align="center"
      className="w-[min(19rem,calc(100vw-2rem))] p-0"
    >
      <div className="border-b border-border/60 px-3 py-2">
        <p className="truncate text-xs font-semibold" title={caso.msg}>
          {caso.msg}
        </p>
        <p className="truncate text-[11px] text-muted-foreground">
          {caso.id} · {modelo}
        </p>
      </div>
      <ul className="max-h-44 divide-y divide-border/60 overflow-y-auto px-3">
        {its.map((i) => (
          <li key={i.id} className="flex items-center gap-2 py-1.5">
            <span
              aria-hidden
              className={cn("size-2 shrink-0 rounded-full", CELULA[i.status])}
            />
            <span className="text-xs font-medium">rep {i.repeticao}</span>
            <span className="text-[11px] text-muted-foreground">
              {STATUS_ITEM[i.status].rotulo}
            </span>
            <span className="ml-auto text-[11px] tabular-nums text-muted-foreground">
              {ms(i.latencia_ms)} · {num.format((i.tokens_in ?? 0) + (i.tokens_out ?? 0))}{" "}
              tok · {usd(i.custo_usd)}
            </span>
          </li>
        ))}
      </ul>
      {trecho?.resposta_trecho && (
        <p className="border-t border-border/60 px-3 py-2 text-[11px] leading-relaxed text-muted-foreground line-clamp-3">
          “{trecho.resposta_trecho}”
        </p>
      )}
      <div className="border-t border-border/60 p-1.5">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onAbrirDossie}
          className="w-full text-xs"
        >
          Abrir dossiê
        </Button>
      </div>
    </PopoverContent>
  );
}

function CelulaMatriz({
  its,
  caso,
  modelo,
  fila,
  expandida,
  onToggle,
  onHover,
}: {
  its: Item[];
  caso: CasoLinha;
  modelo: string;
  /** row dimmed by the divergent-case focus */
  fila: boolean;
  expandida: boolean;
  onToggle: () => void;
  onHover: (h: Hover) => void;
}) {
  const [pop, setPop] = useState(false);
  // re-keying the wrapper by the status signature replays animate-flash-ok
  // on every item that lands inside the cell
  const assinatura = its.map((i) => i.status).join();
  if (!its.length) {
    return (
      <span aria-hidden className="block text-center text-muted-foreground/30">
        ·
      </span>
    );
  }
  return (
    <Popover open={pop} onOpenChange={setPop}>
      <PopoverTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            // the popover owns aria-expanded now — the dossier opened via
            // "Abrir dossiê" is a second, deeper step
            aria-label={`${caso.id}, modelo ${modelo}: ${its
              .map((i) => `rep ${i.repeticao} ${STATUS_ITEM[i.status].rotulo}`)
              .join(", ")}`}
            title={its.map(descItem).join("\n")}
            onMouseEnter={() => onHover({ caso: caso.id, modelo })}
            onFocus={() => onHover({ caso: caso.id, modelo })}
            className={cn(
              "h-auto min-h-9 w-full justify-center rounded-md px-1 py-1",
              fila && "opacity-30",
              expandida && "bg-muted shadow-[inset_0_0_0_1px_var(--ring)]"
            )}
          >
            <span
              key={assinatura}
              className={cn(
                "animate-flash-ok w-full rounded-md p-0.5",
                its.length > 3 && "px-1.5"
              )}
            >
              <RepsVisuais its={its} />
            </span>
          </Button>
        }
      />
      <PopoverCelula
        its={its}
        caso={caso}
        modelo={modelo}
        onAbrirDossie={() => {
          setPop(false);
          onToggle();
        }}
      />
    </Popover>
  );
}

/** Dossier list of the open cell — one block per rep. */
function PainelDossie({
  painelId,
  caso,
  modelo,
  its,
  latMedia,
}: {
  painelId: string;
  caso: CasoLinha;
  modelo: string;
  its: Item[];
  latMedia: number | null;
}) {
  return (
    <div
      id={painelId}
      role="region"
      aria-label={`Dossiê: ${modelo} em ${caso.id}`}
      className="animate-enter rounded-lg border border-border/70 bg-muted/30 px-3 py-2.5"
    >
      <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
        {modelo} · {caso.msg}
      </p>
      <ul className="mt-2 space-y-3">
        {its.map((i) => (
          <li
            key={i.id}
            className="border-t border-border/50 pt-2.5 first:border-t-0 first:pt-0"
          >
            <DossieItem item={i} latMedia={latMedia} />
          </li>
        ))}
      </ul>
    </div>
  );
}

export function MatrizCasos({
  run,
  itens,
  filtro,
  onFiltro,
  casoFoco,
  onCasoFoco,
  latMedia,
}: {
  run: RunDetalhe;
  itens: Item[];
  filtro: FiltroItem;
  onFiltro: (f: FiltroItem) => void;
  casoFoco: string | null;
  onCasoFoco: (id: string | null) => void;
  latMedia: number | null;
}) {
  const painelId = useId();
  const [aberto, setAberto] = useState<CelulaKey | null>(null);
  const [hover, setHover] = useState<Hover>(null);

  // corpus order from the run's snapshot; items of unknown casos trail
  const casosOrdem = useMemo(() => {
    const porId = new Map<string, Item>();
    for (const i of itens) if (!porId.has(i.caso_id)) porId.set(i.caso_id, i);
    const vistos = new Set<string>();
    const lista: CasoLinha[] = [];
    for (const c of run.casos ?? []) {
      vistos.add(c.id);
      lista.push({
        id: c.id,
        msg: c.msg ?? porId.get(c.id)?.msg ?? c.id,
        pagina: c.pagina ?? porId.get(c.id)?.pagina ?? null,
      });
    }
    for (const i of itens) {
      if (!vistos.has(i.caso_id)) {
        vistos.add(i.caso_id);
        lista.push({ id: i.caso_id, msg: i.msg, pagina: i.pagina });
      }
    }
    return lista;
  }, [run.casos, itens]);

  const modelosOrdem = useMemo(() => {
    const vistos = new Set(run.modelos ?? []);
    const extra = [...new Set(itens.map((i) => i.modelo))].filter(
      (m) => !vistos.has(m)
    );
    return [...(run.modelos ?? []), ...extra];
  }, [run.modelos, itens]);

  const grade = useMemo(() => {
    const m = new Map<string, Item[]>();
    for (const i of itens) {
      const k = `${i.caso_id}§${i.modelo}`;
      const arr = m.get(k) ?? [];
      arr.push(i);
      m.set(k, arr);
    }
    for (const arr of m.values()) arr.sort((a, b) => a.repeticao - b.repeticao);
    return m;
  }, [itens]);

  const grupos = useMemo(() => {
    const g: { grupo: string; casos: CasoLinha[] }[] = [];
    for (const c of casosOrdem) {
      const nome = grupoDoCaso(c.id);
      const ultimo = g[g.length - 1];
      if (ultimo?.grupo === nome) ultimo.casos.push(c);
      else g.push({ grupo: nome, casos: [c] });
    }
    return g;
  }, [casosOrdem]);

  const stats = useMemo(() => {
    const por = (s: Item["status"]) => itens.filter((i) => i.status === s).length;
    return {
      total: itens.length,
      ok: por("ok"),
      falhas: por("falhou"),
      erros: por("erro"),
    };
  }, [itens]);

  const celula = (casoId: string, modelo: string) =>
    grade.get(`${casoId}§${modelo}`) ?? [];
  const bate = (i: Item) => filtro === "todos" || i.status === filtro;
  // true filter: non-matching items leave the cell, rows with nothing
  // left leave the table — no dimmed "disabled" leftovers
  const celulaVis = (casoId: string, modelo: string) =>
    filtro === "todos" ? celula(casoId, modelo) : celula(casoId, modelo).filter(bate);
  const algumaLinha = filtro === "todos" || itens.some(bate);
  const multiplosGrupos = grupos.length > 1;
  const casoAberto = aberto ? casosOrdem.find((c) => c.id === aberto.caso) : null;

  if (!casosOrdem.length) {
    return (
      <div className="animate-enter rounded-xl border border-border bg-card p-4 sm:p-5">
        <h3 className="text-base font-semibold">Casos × modelos</h3>
        <p className="mt-3 text-sm text-muted-foreground">Sem itens neste run.</p>
      </div>
    );
  }

  return (
    <div
      className="animate-enter rounded-xl border border-border bg-card p-4 sm:p-5"
      style={stagger(5)}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-baseline gap-2">
          <h3 className="text-base font-semibold">Casos × modelos</h3>
          {casoFoco && (
            <button
              type="button"
              onClick={() => onCasoFoco(null)}
              className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-foreground transition-colors hover:bg-muted-foreground/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              foco: {casoFoco} ×
            </button>
          )}
        </div>
        <div
          className="flex flex-wrap gap-1.5"
          role="group"
          aria-label="Filtrar itens por status"
        >
          {(
            [
              ["todos", "Todos", stats.total],
              ["ok", "Passou", stats.ok],
              ["falhou", "Falhou", stats.falhas],
              ["erro", "Erro", stats.erros],
            ] as const
          )
            // zero-count statuses hide — the active one stays so the
            // applied filter remains visible even emptied
            .filter(([f, , n]) => f === "todos" || n > 0 || filtro === f)
            .map(([f, rotulo, n]) => (
              <button
                key={f}
                type="button"
                aria-pressed={filtro === f}
                onClick={() => onFiltro(f)}
                className={filterChipCls(filtro === f)}
              >
                {rotulo} <span className="tabular-nums">{n}</span>
              </button>
            ))}
        </div>
      </div>

      {/* ---------- matriz desktop ---------- */}
      <div
        className="scroll-fina -mx-4 mt-2 hidden overflow-x-auto px-4 pb-1 sm:-mx-5 sm:block sm:px-5"
        onMouseLeave={() => setHover(null)}
      >
        <table className="w-full min-w-[34rem] border-separate [border-spacing:0_4px]">
          <thead>
            <tr>
              <th
                scope="col"
                className="sticky left-0 z-10 w-[12rem] min-w-[12rem] max-w-[12rem] bg-card py-1 pr-3 text-left align-bottom text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground"
              >
                caso
              </th>
              {modelosOrdem.map((m) => (
                <th
                  key={m}
                  scope="col"
                  title={m}
                  className={cn(
                    "min-w-[4.5rem] rounded-t-md py-1 text-center align-bottom text-[11px] font-semibold transition-colors duration-150",
                    hover?.modelo === m
                      ? "bg-muted text-foreground"
                      : "text-muted-foreground"
                  )}
                >
                  <span className="mx-auto block max-w-[9rem] truncate">
                    {m}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          {/* re-key on filter: the swap remounts the rows and replays the
              enter stagger — never a dry full-table repaint */}
          <tbody key={filtro}>
            {grupos.map(({ grupo, casos: lista }) => (
              <Fragment key={grupo}>
                {multiplosGrupos && (
                  <tr aria-hidden>
                    <td
                      colSpan={modelosOrdem.length + 1}
                      className="pt-3 pb-0.5"
                    >
                      <span className="flex items-center gap-2">
                        <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                          {grupo}
                        </span>
                        <span className="h-px flex-1 bg-border/60" />
                      </span>
                    </td>
                  </tr>
                )}
                {lista.map((c, ri) => {
                  const algumBate = itens.some(
                    (i) => i.caso_id === c.id && bate(i)
                  );
                  // the filter unmounts empty cases instead of dimming
                  if (filtro !== "todos" && !algumBate) return null;
                  const foraDeFoco = casoFoco != null && casoFoco !== c.id;
                  return (
                    <Fragment key={c.id}>
                      <tr
                        className="animate-enter transition-opacity duration-300"
                        style={stagger(ri)}
                      >
                        <th
                          scope="row"
                          className={cn(
                            "sticky left-0 z-10 py-1 pr-3 text-left align-middle transition-[opacity,background-color] duration-200",
                            hover?.caso === c.id ? "bg-muted" : "bg-card",
                            foraDeFoco && "opacity-40"
                          )}
                        >
                          <span
                            className="block truncate text-xs font-medium"
                            title={c.msg}
                          >
                            {c.msg}
                          </span>
                          <span className="block truncate text-[11px] text-muted-foreground">
                            {c.id}
                          </span>
                        </th>
                        {modelosOrdem.map((m) => (
                          <td
                            key={m}
                            className={cn(
                              "p-0 align-middle transition-colors duration-150",
                              (hover?.caso === c.id ||
                                hover?.modelo === m) &&
                                "bg-muted/60"
                            )}
                          >
                            <CelulaMatriz
                              its={celulaVis(c.id, m)}
                              caso={c}
                              modelo={m}
                              fila={foraDeFoco}
                              expandida={
                                aberto?.caso === c.id && aberto?.modelo === m
                              }
                              onToggle={() =>
                                setAberto(
                                  aberto?.caso === c.id && aberto?.modelo === m
                                    ? null
                                    : { caso: c.id, modelo: m }
                                )
                              }
                              onHover={setHover}
                            />
                          </td>
                        ))}
                      </tr>
                      {aberto?.caso === c.id && casoAberto && (
                        <tr>
                          <td
                            colSpan={modelosOrdem.length + 1}
                            className="p-0 pb-1"
                          >
                            <PainelDossie
                              painelId={painelId}
                              caso={casoAberto}
                              modelo={aberto.modelo}
                              its={celulaVis(aberto.caso, aberto.modelo)}
                              latMedia={latMedia}
                            />
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>

      {/* ---------- mobile cards: one card per case ---------- */}
      <div className="mt-2 space-y-2 sm:hidden">
        {grupos.map(({ grupo, casos: lista }) => (
          <div key={grupo} className="space-y-2">
            {multiplosGrupos && (
              <p className="pt-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                {grupo}
              </p>
            )}
            {lista.map((c, ri) => {
              if (
                filtro !== "todos" &&
                !itens.some((i) => i.caso_id === c.id && bate(i))
              )
                return null;
              return (
              <div
                key={c.id}
                style={stagger(ri)}
                className={cn(
                  "animate-enter rounded-xl border border-border bg-card transition-opacity duration-300",
                  casoFoco != null && casoFoco !== c.id && "opacity-40"
                )}
              >
                <div className="px-3 pt-2.5">
                  <p className="text-sm font-medium" title={c.msg}>
                    {c.msg}
                  </p>
                  <p className="truncate text-[11px] text-muted-foreground">
                    {c.id}
                    {c.pagina && ` · ${c.pagina}`}
                  </p>
                </div>
                <ul className="mt-1 divide-y divide-border/60">
                  {modelosOrdem.map((m) => {
                    const its = celulaVis(c.id, m);
                    const expandida =
                      aberto?.caso === c.id && aberto?.modelo === m;
                    if (!its.length) return null;
                    return (
                      <li key={m}>
                        <button
                          type="button"
                          aria-expanded={expandida}
                          onClick={() =>
                            setAberto(
                              expandida ? null : { caso: c.id, modelo: m }
                            )
                          }
                          className="flex min-h-11 w-full items-center gap-2.5 px-3 py-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          <span
                            className="min-w-0 flex-1 truncate text-xs font-medium"
                            title={m}
                          >
                            {m}
                          </span>
                          <RepsVisuais its={its} />
                          <CaretDown
                            size={13}
                            aria-hidden
                            className={cn(
                              "shrink-0 text-muted-foreground transition-transform duration-200",
                              expandida && "rotate-180"
                            )}
                          />
                        </button>
                        {expandida && (
                          <div className="px-3 pb-3">
                            <PainelDossie
                              // both the table and the cards stay mounted
                              // (CSS hides one) — the mobile panel needs a
                              // distinct id or aria-controls would fork
                              painelId={`${painelId}-m`}
                              caso={c}
                              modelo={m}
                              its={its}
                              latMedia={latMedia}
                            />
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
              );
            })}
          </div>
        ))}
      </div>

      {!algumaLinha && (
        <p className="mt-3 text-sm text-muted-foreground">
          Nenhum item com esse status neste run.
        </p>
      )}
    </div>
  );
}
