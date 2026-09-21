"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Funnel, MagnifyingGlass } from "@phosphor-icons/react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AVALIACAO_LABEL,
  DIFICULDADE_LABEL,
} from "@/lib/ciclo";
import type { DuplaOpcao, FiltrosRegistro } from "@/lib/queries";
import { cn } from "@/lib/utils";

const TODAS = "todas";

/** Estado rascunho do modal — aplica tudo de uma vez no "Aplicar". */
type Draft = {
  encontro: string;
  avaliacao: string;
  dificuldade: string;
  dupla: string;
  apoio: boolean;
};

function draftDe(f: FiltrosRegistro): Draft {
  return {
    encontro: f.encontro ? String(f.encontro) : TODAS,
    avaliacao: f.avaliacao ?? TODAS,
    dificuldade: f.dificuldade ?? TODAS,
    dupla: f.dupla ?? TODAS,
    apoio: !!f.apoio,
  };
}

const OVERLINE =
  "text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground";

/** Opção compacta (grade de encontros / avaliações) — radio nativo sr-only
 *  mantém setas do teclado e leitura de tela de graça. */
function OpcaoPilula({
  nome,
  valor,
  atual,
  onSelect,
  children,
  className,
}: {
  nome: string;
  valor: string;
  atual: string;
  onSelect: (v: string) => void;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label
      className={cn(
        "flex min-h-9 cursor-pointer items-center justify-center rounded-lg border px-2.5 text-sm transition-colors",
        "hover:bg-muted has-checked:border-foreground has-checked:bg-foreground has-checked:font-medium has-checked:text-background",
        "has-focus-visible:ring-2 has-focus-visible:ring-ring has-focus-visible:ring-offset-2 has-focus-visible:ring-offset-background",
        className
      )}
    >
      <input
        type="radio"
        name={nome}
        value={valor}
        checked={atual === valor}
        onChange={() => onSelect(valor)}
        className="sr-only"
      />
      {children}
    </label>
  );
}

/** Opção em linha (listas longas) — check aparece só no selecionado. */
function OpcaoLinha({
  nome,
  valor,
  atual,
  onSelect,
  children,
}: {
  nome: string;
  valor: string;
  atual: string;
  onSelect: (v: string) => void;
  children: React.ReactNode;
}) {
  return (
    <label
      className={cn(
        "flex min-h-10 cursor-pointer items-center gap-2.5 rounded-lg px-3 text-sm transition-colors",
        "hover:bg-muted has-checked:bg-muted has-checked:font-medium",
        "has-focus-visible:ring-2 has-focus-visible:ring-ring"
      )}
    >
      <input
        type="radio"
        name={nome}
        value={valor}
        checked={atual === valor}
        onChange={() => onSelect(valor)}
        className="sr-only"
      />
      <Check
        size={15}
        weight="bold"
        aria-hidden
        className={cn(
          "shrink-0 transition-opacity",
          atual === valor ? "opacity-100" : "opacity-0"
        )}
      />
      <span className="min-w-0 flex-1 truncate">{children}</span>
    </label>
  );
}

/** Barra de /registros: busca direta + modal de filtros (padrão marketplace —
 *  todas as dimensões juntas, contador de ativos no botão, aplica de uma vez). */
export function RegistrosFiltros({
  filtros,
  duplas,
  maxEncontro,
}: {
  filtros: FiltrosRegistro;
  duplas: DuplaOpcao[];
  maxEncontro: number;
}) {
  const router = useRouter();
  const [q, setQ] = useState(filtros.q ?? "");
  const timer = useRef<ReturnType<typeof setTimeout>>(null);
  // filtros da prop congelam no render que armou o timer — o debounce leria
  // valores velhos e reverteria um filtro aplicado dentro dos 350ms
  const filtrosRef = useRef(filtros);
  useEffect(() => {
    filtrosRef.current = filtros;
  });

  const [aberto, setAberto] = useState(false);
  const [draft, setDraft] = useState<Draft>(() => draftDe(filtros));

  // qualquer mudança de filtro (modal, chip de triagem, limpar, debounce)
  // resincroniza o estado local — draft re-semeia na próxima abertura
  const assinatura = JSON.stringify([
    filtros.encontro,
    filtros.avaliacao,
    filtros.apoio,
    filtros.dificuldade,
    filtros.dupla,
    filtros.q,
  ]);
  const [sync, setSync] = useState(assinatura);
  if (assinatura !== sync) {
    setSync(assinatura);
    setQ(filtros.q ?? "");
  }

  function aplicar(patch: Record<string, string | null>) {
    const f = filtrosRef.current;
    const p = new URLSearchParams();
    const atual: Record<string, string | undefined> = {
      encontro: f.encontro ? String(f.encontro) : undefined,
      avaliacao: f.avaliacao,
      apoio: f.apoio ? "1" : undefined,
      dificuldade: f.dificuldade,
      dupla: f.dupla,
      q: f.q,
      ...patch,
    };
    for (const [k, v] of Object.entries(atual)) if (v) p.set(k, v);
    const qs = p.toString();
    router.replace(`/registros${qs ? `?${qs}` : ""}`, { scroll: false });
  }

  useEffect(() => {
    if (q === (filtros.q ?? "")) return;
    timer.current = setTimeout(() => {
      aplicar({ q: q || null });
    }, 350);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- aplicar depende dos filtros; só q dispara
  }, [q]);

  const ativos =
    (filtros.encontro ? 1 : 0) +
    (filtros.avaliacao ? 1 : 0) +
    (filtros.dificuldade ? 1 : 0) +
    (filtros.dupla ? 1 : 0) +
    (filtros.apoio ? 1 : 0);
  const draftAtivos =
    (draft.encontro !== TODAS ? 1 : 0) +
    (draft.avaliacao !== TODAS ? 1 : 0) +
    (draft.dificuldade !== TODAS ? 1 : 0) +
    (draft.dupla !== TODAS ? 1 : 0) +
    (draft.apoio ? 1 : 0);

  function aplicarDraft() {
    const p = new URLSearchParams();
    if (draft.encontro !== TODAS) p.set("encontro", draft.encontro);
    if (draft.avaliacao !== TODAS) p.set("avaliacao", draft.avaliacao);
    if (draft.dificuldade !== TODAS) p.set("dificuldade", draft.dificuldade);
    if (draft.dupla !== TODAS) p.set("dupla", draft.dupla);
    if (draft.apoio) p.set("apoio", "1");
    if (filtrosRef.current.q) p.set("q", filtrosRef.current.q);
    const qs = p.toString();
    router.replace(`/registros${qs ? `?${qs}` : ""}`, { scroll: false });
    setAberto(false);
  }

  const sel = (k: keyof Omit<Draft, "apoio">) => (v: string) =>
    setDraft((d) => ({ ...d, [k]: v }));

  return (
    <>
      <div
        role="search"
        aria-label="Filtrar registros"
        className="flex items-end gap-2"
      >
        <div className="min-w-0 flex-1 space-y-1.5 sm:max-w-md">
          <label htmlFor="flt-busca" className={cn("block", OVERLINE)}>
            Busca
          </label>
          <div className="relative">
            <MagnifyingGlass
              size={15}
              aria-hidden
              className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              id="flt-busca"
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Tema, reflexão ou observação"
              className="pl-8"
            />
          </div>
        </div>
        <Button
          type="button"
          variant={ativos > 0 ? "default" : "outline"}
          onClick={() => {
            setDraft(draftDe(filtrosRef.current));
            setAberto(true);
          }}
          aria-label={
            ativos > 0 ? `Filtros — ${ativos} ativos` : "Filtros"
          }
        >
          <Funnel size={16} aria-hidden />
          Filtros
          {ativos > 0 && (
            <span
              aria-hidden
              className="grid size-5 place-items-center rounded-full bg-[var(--brand-lime)] text-[11px] font-bold text-[var(--brand-ink)]"
            >
              {ativos}
            </span>
          )}
        </Button>
      </div>

      <Dialog open={aberto} onOpenChange={setAberto}>
        <DialogContent className="sm:max-w-lg" aria-label="Filtros de registros">
          <DialogHeader>
            <DialogTitle>Filtros</DialogTitle>
            <DialogDescription>
              Refine a lista por sinal, encontro, avaliação, dificuldade ou dupla.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5">
            <fieldset>
              <legend className={OVERLINE}>Sinal</legend>
              <label
                className={cn(
                  "mt-1.5 flex min-h-10 cursor-pointer items-center gap-2.5 rounded-lg px-3 text-sm transition-colors",
                  "hover:bg-muted has-checked:bg-muted",
                  "has-focus-visible:ring-2 has-focus-visible:ring-ring"
                )}
              >
                <input
                  type="checkbox"
                  checked={draft.apoio}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, apoio: e.target.checked }))
                  }
                  className="sr-only"
                />
                <span
                  aria-hidden
                  className={cn(
                    "grid size-4.5 shrink-0 place-items-center rounded-[5px] border transition-colors",
                    draft.apoio
                      ? "border-foreground bg-foreground text-background"
                      : "border-input bg-card"
                  )}
                >
                  <Check
                    size={11}
                    weight="bold"
                    className={draft.apoio ? "opacity-100" : "opacity-0"}
                  />
                </span>
                <span className="flex-1">
                  Somente pedidos de apoio em aberto
                </span>
              </label>
            </fieldset>

            <fieldset>
              <legend className={OVERLINE}>Encontro</legend>
              <div className="mt-1.5 grid grid-cols-4 gap-1.5 sm:grid-cols-6">
                <OpcaoPilula
                  nome="flt-encontro"
                  valor={TODAS}
                  atual={draft.encontro}
                  onSelect={sel("encontro")}
                  className="col-span-2"
                >
                  Todos
                </OpcaoPilula>
                {Array.from({ length: maxEncontro }, (_, i) => i + 1).map(
                  (n) => (
                    <OpcaoPilula
                      key={n}
                      nome="flt-encontro"
                      valor={String(n)}
                      atual={draft.encontro}
                      onSelect={sel("encontro")}
                    >
                      {n}º
                    </OpcaoPilula>
                  )
                )}
              </div>
            </fieldset>

            <fieldset>
              <legend className={OVERLINE}>Avaliação do encontro</legend>
              <div className="mt-1.5 grid grid-cols-2 gap-1.5 sm:grid-cols-5">
                <OpcaoPilula
                  nome="flt-avaliacao"
                  valor={TODAS}
                  atual={draft.avaliacao}
                  onSelect={sel("avaliacao")}
                >
                  Todas
                </OpcaoPilula>
                {Object.entries(AVALIACAO_LABEL).map(([v, l]) => (
                  <OpcaoPilula
                    key={v}
                    nome="flt-avaliacao"
                    valor={v}
                    atual={draft.avaliacao}
                    onSelect={sel("avaliacao")}
                  >
                    {l}
                  </OpcaoPilula>
                ))}
              </div>
            </fieldset>

            <fieldset>
              <legend className={OVERLINE}>Dificuldade sinalizada</legend>
              <div className="mt-1.5 -mx-1 space-y-0.5">
                <OpcaoLinha
                  nome="flt-dificuldade"
                  valor={TODAS}
                  atual={draft.dificuldade}
                  onSelect={sel("dificuldade")}
                >
                  Todas
                </OpcaoLinha>
                <OpcaoLinha
                  nome="flt-dificuldade"
                  valor="com"
                  atual={draft.dificuldade}
                  onSelect={sel("dificuldade")}
                >
                  Qualquer dificuldade
                </OpcaoLinha>
                {Object.entries(DIFICULDADE_LABEL).map(([v, l]) => (
                  <OpcaoLinha
                    key={v}
                    nome="flt-dificuldade"
                    valor={v}
                    atual={draft.dificuldade}
                    onSelect={sel("dificuldade")}
                  >
                    {l}
                  </OpcaoLinha>
                ))}
              </div>
            </fieldset>

            <fieldset>
              <legend className={OVERLINE}>Dupla</legend>
              <div className="scroll-fina mt-1.5 -mx-1 max-h-52 space-y-0.5 overflow-y-auto">
                <OpcaoLinha
                  nome="flt-dupla"
                  valor={TODAS}
                  atual={draft.dupla}
                  onSelect={sel("dupla")}
                >
                  Todas as duplas
                </OpcaoLinha>
                {duplas.map((d) => (
                  <OpcaoLinha
                    key={d.id}
                    nome="flt-dupla"
                    valor={d.id}
                    atual={draft.dupla}
                    onSelect={sel("dupla")}
                  >
                    {d.mentor?.nome ?? "—"} e {d.mentorado?.nome ?? "—"}
                  </OpcaoLinha>
                ))}
              </div>
            </fieldset>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              className="sm:me-auto"
              disabled={draftAtivos === 0}
              onClick={() =>
                setDraft({
                  encontro: TODAS,
                  avaliacao: TODAS,
                  dificuldade: TODAS,
                  dupla: TODAS,
                  apoio: false,
                })
              }
            >
              Limpar
            </Button>
            <Button type="button" onClick={aplicarDraft}>
              Aplicar{draftAtivos > 0 ? ` (${draftAtivos})` : ""}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
