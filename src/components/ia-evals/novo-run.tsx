"use client";

// "Novo run" dialog — the grade form stopped being an eternal card and
// lives behind the section's lime button. Same fields as before plus a
// miniature preview of the grid about to be born and an estimate drawn
// from the last concluded run's rhythm ("~N min · ~US$ X").

import { CaretDown } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { filterChipCls } from "@/components/ui/filter-chip";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import {
  dataCurta,
  grupoDoCaso,
  usd,
  type Caso,
  type Run,
} from "./tipos";

export type FormGrade = {
  ambiente: string;
  papel: "staff" | "mentorado";
  modelos: string[];
  repeticoes: number;
  /** null = every case of the chosen papel */
  casoIds: string[] | null;
  modeloInput: string;
};

const AMBIENTES = ["local", "staging", "preview", "prod"];
/** per-item overhead beyond the model's latency (claim + login + POST) */
const OVERHEAD_MS = 2500;
const MAX_PREVIEW_LINHAS = 12;

function Chip({
  ativo,
  onClick,
  acao,
  children,
}: {
  ativo?: boolean;
  onClick?: () => void;
  /** action chips (e.g. "Remover x") announce the action, not a toggle */
  acao?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      {...(acao ? { "aria-label": acao } : { "aria-pressed": !!ativo })}
      onClick={onClick}
      className={cn(filterChipCls(!!ativo), "px-3 text-xs sm:min-h-7")}
    >
      {children}
    </button>
  );
}

function Rotulo({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
      {children}
    </p>
  );
}

/** Miniature of the grid about to be born — rows are the chosen cases,
 *  columns the models, each cell the repetições as queue-dashed pips.
 *  Capped at MAX_PREVIEW_LINHAS with an honest "+N casos" tail. */
function PreviaGrade({
  casos,
  modelos,
  repeticoes,
}: {
  casos: { id: string; msg: string }[];
  modelos: string[];
  repeticoes: number;
}) {
  const linhas = casos.slice(0, MAX_PREVIEW_LINHAS);
  const restantes = casos.length - linhas.length;
  return (
    <div className="scroll-fina max-h-44 overflow-y-auto rounded-lg border border-border bg-muted/30">
      <table className="w-full border-separate [border-spacing:0_2px] px-1 py-1">
        <thead>
          <tr>
            <th className="w-24 px-1.5 py-0.5 text-left align-bottom text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              caso
            </th>
            {modelos.map((m) => (
              <th
                key={m}
                title={m}
                className="px-1 py-0.5 text-center align-bottom text-[10px] font-semibold text-muted-foreground"
              >
                <span className="mx-auto block max-w-24 truncate">{m}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {linhas.map((c) => (
            <tr key={c.id}>
              <th
                scope="row"
                title={`${c.id} · ${c.msg}`}
                className="px-1.5 py-0.5 text-left align-middle"
              >
                <span className="block max-w-28 truncate text-[11px] font-medium">
                  {c.id}
                </span>
              </th>
              {modelos.map((m) => (
                <td key={m} className="px-1 py-0.5 text-center align-middle">
                  <span className="inline-flex items-center gap-0.5">
                    {Array.from({ length: repeticoes }, (_, r) => (
                      <span
                        key={r}
                        aria-hidden
                        className="size-2 rounded-[2px] border border-dashed border-muted-foreground/50"
                      />
                    ))}
                  </span>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {restantes > 0 && (
        <p className="border-t border-border/60 px-2.5 py-1 text-[11px] text-muted-foreground">
          + {restantes} {restantes === 1 ? "caso" : "casos"}
        </p>
      )}
    </div>
  );
}

export function NovoRunDialog({
  open,
  onOpenChange,
  form,
  onForm,
  casos,
  modelosSugeridos,
  ultimoComResumo,
  criando,
  bloqueado,
  onCriar,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  form: FormGrade;
  onForm: (f: FormGrade) => void;
  casos: Caso[] | null;
  modelosSugeridos: string[];
  /** most recent concluded run — paces the time/cost estimate */
  ultimoComResumo: Run | null;
  criando: boolean;
  bloqueado: boolean;
  onCriar: () => void;
}) {
  const casosFiltrados = (casos ?? []).filter(
    (c) => c.papel_esperado === "qualquer" || c.papel_esperado === form.papel
  );
  const casosEscolhidos = form.casoIds ?? casosFiltrados.map((c) => c.id);
  const totalGrade =
    casosEscolhidos.length * form.modelos.length * form.repeticoes;
  const gruposDeCasos = casosFiltrados.reduce<[string, Caso[]][]>(
    (grupos, c) => {
      const grupo = grupoDoCaso(c.id);
      const g = grupos.find(([nome]) => nome === grupo);
      if (g) g[1].push(c);
      else grupos.push([grupo, [c]]);
      return grupos;
    },
    []
  );

  // estimate paced by the last concluded run: per-item latency + overhead
  const res = ultimoComResumo?.resumo ?? null;
  const estimativa =
    res && res.total > 0 && totalGrade > 0
      ? {
          min: Math.max(
            1,
            Math.round(
              (totalGrade * ((res.latencia_media_ms ?? 0) + OVERHEAD_MS)) /
                60000
            )
          ),
          custo: totalGrade * (res.custo_usd / res.total),
          de: ultimoComResumo!,
        }
      : null;

  const set = (patch: Partial<FormGrade>) => onForm({ ...form, ...patch });
  const casosPreview = casosFiltrados.filter((c) =>
    casosEscolhidos.includes(c.id)
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="2xl">
        <DialogHeader>
          <DialogTitle>Novo run</DialogTitle>
          <DialogDescription>
            A grade casos × modelos × repetições começa a executar na hora,
            um item por vez. Dá pra pausar e retomar depois.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Rotulo>Ambiente</Rotulo>
            <div className="flex flex-wrap gap-1.5">
              {AMBIENTES.map((a) => (
                <Chip
                  key={a}
                  ativo={form.ambiente === a}
                  onClick={() => set({ ambiente: a })}
                >
                  {a}
                </Chip>
              ))}
            </div>
          </div>
          <div className="space-y-1.5">
            <Rotulo>Papel da conta de teste</Rotulo>
            <div className="flex flex-wrap gap-1.5">
              {(["staff", "mentorado"] as const).map((p) => (
                <Chip
                  key={p}
                  ativo={form.papel === p}
                  onClick={() => set({ papel: p })}
                >
                  {p === "staff" ? "Staff" : "Mentorado"}
                </Chip>
              ))}
            </div>
            <p className="text-[11px] text-muted-foreground">
              conta do env:{" "}
              {form.papel === "mentorado" ? "EVAL_EMAIL_JOVEM" : "EVAL_EMAIL"}
            </p>
          </div>
          <div className="space-y-1.5">
            <Rotulo>Repetições por caso</Rotulo>
            <Input
              aria-label="Repetições por caso"
              type="number"
              min={1}
              max={10}
              value={form.repeticoes}
              onChange={(e) =>
                set({
                  repeticoes: Math.max(
                    1,
                    Math.min(10, Number(e.target.value) || 1)
                  ),
                })
              }
              className="h-11 w-24 rounded-md border border-border bg-background px-3 text-base sm:h-9 sm:text-sm"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Rotulo>Modelos</Rotulo>
          <div className="flex flex-wrap items-center gap-1.5">
            {form.modelos.map((m) => (
              <Chip
                key={m}
                ativo
                acao={`Remover ${m}`}
                onClick={() =>
                  set({ modelos: form.modelos.filter((x) => x !== m) })
                }
              >
                {m} ×
              </Chip>
            ))}
            <Input
              aria-label="Adicionar modelo"
              value={form.modeloInput}
              onChange={(e) => set({ modeloInput: e.target.value })}
              onKeyDown={(e) => {
                if (e.key !== "Enter") return;
                e.preventDefault();
                const m = form.modeloInput.trim();
                if (m && !form.modelos.includes(m))
                  set({ modelos: [...form.modelos, m], modeloInput: "" });
              }}
              placeholder="slug do modelo + Enter"
              className="h-11 min-w-44 flex-1 rounded-md border border-border bg-background px-3 text-base sm:h-9 sm:flex-none sm:text-sm"
            />
          </div>
          {modelosSugeridos.filter((m) => !form.modelos.includes(m)).length >
            0 && (
            <div className="flex flex-wrap gap-1.5 pt-1">
              {modelosSugeridos
                .filter((m) => !form.modelos.includes(m))
                .map((m) => (
                  <Button
                    key={m}
                    type="button"
                    variant="outline"
                    onClick={() => set({ modelos: [...form.modelos, m] })}
                    className="min-h-11 rounded-md border-dashed px-2 text-[11px] font-normal text-muted-foreground sm:min-h-7"
                  >
                    + {m}
                  </Button>
                ))}
            </div>
          )}
        </div>

        <div className="space-y-1.5">
          <Rotulo>Casos</Rotulo>
          {casos === null ? (
            <Skeleton className="h-11 w-56" />
          ) : !casosFiltrados.length ? (
            <p className="text-sm text-muted-foreground">
              Nenhum caso live pro papel {form.papel} no corpus
              (tests/evals/casos.json).
            </p>
          ) : (
            <Popover>
              <PopoverTrigger className="inline-flex min-h-11 items-center gap-2 rounded-md border border-border bg-card px-3 text-sm font-medium hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:min-h-9">
                {casosEscolhidos.length === casosFiltrados.length
                  ? `Todos os ${casosFiltrados.length} casos`
                  : `${casosEscolhidos.length} de ${casosFiltrados.length} casos`}
                <CaretDown
                  size={14}
                  aria-hidden
                  className="text-muted-foreground"
                />
              </PopoverTrigger>
              <PopoverContent
                align="start"
                className="scroll-fina max-h-80 w-[min(26rem,calc(100vw-2rem))] overflow-y-auto p-0"
              >
                <div className="sticky top-0 flex items-center justify-between gap-2 border-b border-border/60 bg-popover px-3 py-2">
                  <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
                    {casosEscolhidos.length} de {casosFiltrados.length}
                  </span>
                  <span className="flex gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() =>
                        set({ casoIds: casosFiltrados.map((c) => c.id) })
                      }
                      className="min-h-9 px-2 text-xs sm:min-h-7"
                    >
                      Todas
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => set({ casoIds: [] })}
                      className="min-h-9 px-2 text-xs sm:min-h-7"
                    >
                      Nenhuma
                    </Button>
                  </span>
                </div>
                {gruposDeCasos.map(([grupo, itens]) => (
                  <div key={grupo}>
                    <p className="px-3 pt-2.5 pb-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                      {grupo}
                    </p>
                    <ul>
                      {itens.map((c) => {
                        const marcado = casosEscolhidos.includes(c.id);
                        return (
                          <li key={c.id}>
                            <label className="flex min-h-11 cursor-pointer items-center gap-3 px-3 py-1.5 hover:bg-muted/50">
                              <input
                                type="checkbox"
                                checked={marcado}
                                onChange={() => {
                                  const sel = new Set(casosEscolhidos);
                                  if (marcado) sel.delete(c.id);
                                  else sel.add(c.id);
                                  set({ casoIds: [...sel] });
                                }}
                                className="size-4 shrink-0 accent-primary"
                              />
                              <span className="min-w-0 flex-1">
                                <span className="block truncate text-sm font-medium">
                                  {c.msg}
                                </span>
                                <span className="text-[11px] text-muted-foreground">
                                  {c.id}
                                  {c.pagina && ` · ${c.pagina}`}
                                </span>
                              </span>
                            </label>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ))}
              </PopoverContent>
            </Popover>
          )}
        </div>

        <div className="space-y-1.5">
          <div className="flex items-baseline justify-between gap-2">
            <Rotulo>Prévia da grade</Rotulo>
            <p className="text-sm font-medium tabular-nums">
              {totalGrade || "—"} execuções
              <span className="ml-1 text-xs font-normal text-muted-foreground">
                ({casosEscolhidos.length} × {form.modelos.length || 0} ×{" "}
                {form.repeticoes})
              </span>
            </p>
          </div>
          {form.modelos.length && casosPreview.length ? (
            <PreviaGrade
              casos={casosPreview}
              modelos={form.modelos}
              repeticoes={form.repeticoes}
            />
          ) : (
            <p className="rounded-lg border border-dashed border-border px-3 py-2.5 text-sm text-muted-foreground">
              {casos === null
                ? "Carregando o corpus…"
                : !form.modelos.length
                  ? "Escolha ao menos um modelo pra ver a grade."
                  : "Marque ao menos um caso pra ver a grade."}
            </p>
          )}
          {estimativa && (
            <p className="text-xs text-muted-foreground">
              No ritmo do último run ({dataCurta(estimativa.de.created_at)}): ~
              {estimativa.min} min · ~{usd(estimativa.custo)}
            </p>
          )}
        </div>

        <DialogFooter sticky>
          <Button
            onClick={onCriar}
            disabled={criando || !totalGrade || bloqueado}
          >
            {criando ? "Criando…" : "Rodar eval"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
