"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, Funnel, MagnifyingGlass, X } from "@phosphor-icons/react";
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
import type { Dificuldade } from "@/lib/types";
import { cn } from "@/lib/utils";

const TODAS = "todas";

/** Estado rascunho do modal — aplica tudo de uma vez no "Aplicar". */
type Draft = {
  encontro: string;
  avaliacao: string;
  dificuldade: string;
  dupla: string;
  apoio: boolean;
  tardio: boolean;
};

function draftDe(f: FiltrosRegistro): Draft {
  return {
    encontro: f.encontro ? String(f.encontro) : TODAS,
    avaliacao: f.avaliacao ?? TODAS,
    dificuldade: f.dificuldade ?? TODAS,
    dupla: f.dupla ?? TODAS,
    apoio: !!f.apoio,
    tardio: !!f.tardio,
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
        "flex min-h-11 cursor-pointer items-center justify-center rounded-lg border px-2.5 text-sm transition-colors sm:min-h-9",
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

/** Checkbox do fieldset Sinal — mesmo truque do radio: input sr-only dentro
 *  do label, estilo via has-checked. */
function OpcaoCheck({
  marcado,
  onChange,
  children,
}: {
  marcado: boolean;
  onChange: (v: boolean) => void;
  children: React.ReactNode;
}) {
  return (
    <label
      className={cn(
        "flex min-h-11 cursor-pointer items-center gap-2.5 rounded-lg px-3 text-sm transition-colors sm:min-h-10",
        "hover:bg-muted has-checked:bg-muted",
        "has-focus-visible:ring-2 has-focus-visible:ring-ring"
      )}
    >
      <input
        type="checkbox"
        checked={marcado}
        onChange={(e) => onChange(e.target.checked)}
        className="sr-only"
      />
      <span
        aria-hidden
        className={cn(
          "grid size-4.5 shrink-0 place-items-center rounded-[5px] border transition-colors",
          marcado
            ? "border-foreground bg-foreground text-background"
            : "border-input bg-card"
        )}
      >
        <Check
          size={11}
          weight="bold"
          className={marcado ? "opacity-100" : "opacity-0"}
        />
      </span>
      <span className="flex-1">{children}</span>
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
        "flex min-h-11 cursor-pointer items-center gap-2.5 rounded-lg px-3 text-sm transition-colors sm:min-h-10",
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
  porPrioridade = false,
}: {
  filtros: FiltrosRegistro;
  duplas: DuplaOpcao[];
  maxEncontro: number;
  /** `?ordem=prioridade` não faz parte de FiltrosRegistro; o hidden input
   *  mantém o modo ligado quando a coord aplica/limpa um filtro. */
  porPrioridade?: boolean;
}) {
  const router = useRouter();
  const [q, setQ] = useState(filtros.q ?? "");
  const timer = useRef<ReturnType<typeof setTimeout>>(null);
  // filtros da prop congelam no render que armou o timer — o debounce leria
  // valores velhos e reverteria um filtro aplicado dentro dos 350ms
  const filtrosRef = useRef(filtros);
  const ordemRef = useRef(porPrioridade);
  useEffect(() => {
    filtrosRef.current = filtros;
    ordemRef.current = porPrioridade;
  });

  const [aberto, setAberto] = useState(false);
  const [draft, setDraft] = useState<Draft>(() => draftDe(filtros));

  // qualquer mudança de filtro (modal, chip de triagem, limpar, debounce)
  // resincroniza o estado local — draft re-semeia na próxima abertura
  const assinatura = JSON.stringify([
    filtros.encontro,
    filtros.avaliacao,
    filtros.apoio,
    filtros.tardio,
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
      tardio: f.tardio ? "1" : undefined,
      dificuldade: f.dificuldade,
      dupla: f.dupla,
      q: f.q,
      ordem: ordemRef.current ? "prioridade" : undefined,
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
    (filtros.apoio ? 1 : 0) +
    (filtros.tardio ? 1 : 0);
  const draftAtivos =
    (draft.encontro !== TODAS ? 1 : 0) +
    (draft.avaliacao !== TODAS ? 1 : 0) +
    (draft.dificuldade !== TODAS ? 1 : 0) +
    (draft.dupla !== TODAS ? 1 : 0) +
    (draft.apoio ? 1 : 0) +
    (draft.tardio ? 1 : 0);

  function aplicarDraft() {
    const p = new URLSearchParams();
    if (draft.encontro !== TODAS) p.set("encontro", draft.encontro);
    if (draft.avaliacao !== TODAS) p.set("avaliacao", draft.avaliacao);
    if (draft.dificuldade !== TODAS) p.set("dificuldade", draft.dificuldade);
    if (draft.dupla !== TODAS) p.set("dupla", draft.dupla);
    if (draft.apoio) p.set("apoio", "1");
    if (draft.tardio) p.set("tardio", "1");
    if (filtrosRef.current.q) p.set("q", filtrosRef.current.q);
    if (ordemRef.current) p.set("ordem", "prioridade");
    const qs = p.toString();
    router.replace(`/registros${qs ? `?${qs}` : ""}`, { scroll: false });
    setAberto(false);
  }

  // chips removíveis sob a barra — cada um limpa um param e mantém os demais
  const sem = (k: string) => {
    const p = new URLSearchParams();
    const atual: Record<string, string | undefined> = {
      encontro: filtros.encontro ? String(filtros.encontro) : undefined,
      avaliacao: filtros.avaliacao,
      apoio: filtros.apoio ? "1" : undefined,
      tardio: filtros.tardio ? "1" : undefined,
      dificuldade: filtros.dificuldade,
      dupla: filtros.dupla,
      q: filtros.q,
      ordem: porPrioridade ? "prioridade" : undefined,
    };
    delete atual[k];
    for (const [chave, v] of Object.entries(atual)) if (v) p.set(chave, v);
    const qs = p.toString();
    return `/registros${qs ? `?${qs}` : ""}`;
  };
  const chips: { rotulo: string; href: string }[] = [];
  if (filtros.encontro)
    chips.push({ rotulo: `Encontro: ${filtros.encontro}º`, href: sem("encontro") });
  if (filtros.avaliacao)
    chips.push({
      rotulo: `Avaliação: ${AVALIACAO_LABEL[filtros.avaliacao]}`,
      href: sem("avaliacao"),
    });
  if (filtros.dificuldade)
    chips.push({
      rotulo:
        filtros.dificuldade === "com"
          ? "Dificuldade sinalizada"
          : `Dificuldade: ${DIFICULDADE_LABEL[filtros.dificuldade as Dificuldade] ?? filtros.dificuldade}`,
      href: sem("dificuldade"),
    });
  if (filtros.dupla) {
    const d = duplas.find((x) => x.id === filtros.dupla);
    chips.push({
      rotulo: `Dupla: ${d ? `${d.mentor?.nome ?? "—"} e ${d.mentorado?.nome ?? "—"}` : "selecionada"}`,
      href: sem("dupla"),
    });
  }
  if (filtros.apoio) chips.push({ rotulo: "Apoio em aberto", href: sem("apoio") });
  if (filtros.tardio) chips.push({ rotulo: "Registros tardios", href: sem("tardio") });
  if (filtros.q) chips.push({ rotulo: `Busca: “${filtros.q}”`, href: sem("q") });

  const sel = (k: keyof Omit<Draft, "apoio" | "tardio">) => (v: string) =>
    setDraft((d) => ({ ...d, [k]: v }));

  return (
    <>
      <div className="space-y-2.5">
        <div
          role="search"
          aria-label="Filtrar registros"
          className="flex items-center gap-2"
        >
          {/* placeholder + ícone já comunicam o campo — sem label visual;
              aria-label mantém o nome acessível */}
          <div className="relative min-w-0 flex-1 sm:max-w-md">
            <MagnifyingGlass
              size={15}
              aria-hidden
              className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              type="search"
              aria-label="Buscar nos registros"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar nos registros"
              className="pl-8"
            />
          </div>
          <Button
            type="button"
            variant={ativos > 0 ? "default" : "outline"}
            onClick={() => {
              setDraft(draftDe(filtrosRef.current));
              setAberto(true);
            }}
            aria-label={
              ativos > 0 ? `Filtros, ${ativos} ativos` : "Filtros"
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

        {chips.length > 0 && (
          <ul className="flex flex-wrap items-center gap-1.5" aria-label="Filtros ativos">
            {chips.map((c) => (
              <li key={c.rotulo}>
                <Link
                  href={c.href}
                  scroll={false}
                  aria-label={`Remover filtro ${c.rotulo}`}
                  className="inline-flex min-h-11 items-center gap-1 rounded-full border bg-card px-3 text-xs font-medium transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)] sm:min-h-7"
                >
                  {c.rotulo}
                  <X size={12} aria-hidden className="text-muted-foreground" />
                </Link>
              </li>
            ))}
            <li>
              <Link
                href={porPrioridade ? "/registros?ordem=prioridade" : "/registros"}
                scroll={false}
                className="inline-flex min-h-11 items-center px-2 text-xs text-muted-foreground underline-offset-2 transition-colors hover:text-foreground hover:underline sm:min-h-7"
              >
                Limpar tudo
              </Link>
            </li>
          </ul>
        )}
      </div>

      <Dialog open={aberto} onOpenChange={setAberto}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Filtros</DialogTitle>
            <DialogDescription>
              Refine a lista por sinal, encontro, avaliação, dificuldade ou dupla.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5">
            <fieldset>
              <legend className={OVERLINE}>Sinal</legend>
              <div className="mt-1.5 -mx-1 space-y-0.5">
                <OpcaoCheck
                  marcado={draft.apoio}
                  onChange={(v) => setDraft((d) => ({ ...d, apoio: v }))}
                >
                  Somente pedidos de apoio em aberto
                </OpcaoCheck>
                <OpcaoCheck
                  marcado={draft.tardio}
                  onChange={(v) => setDraft((d) => ({ ...d, tardio: v }))}
                >
                  Somente registros tardios
                </OpcaoCheck>
              </div>
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
                  tardio: false,
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
