"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, MagnifyingGlass, X } from "@phosphor-icons/react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { FiltrosButton } from "@/components/ui/filtros-button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AVALIACAO_LABEL,
  DIFICULDADE_LABEL,
} from "@/lib/ciclo";
import {
  PERIODO_REGISTROS_OPCOES,
  type GrupoRegistros,
} from "@/lib/registros";
import { turmaCurta } from "@/lib/turma";
import type { DuplaOpcao, FiltrosRegistro } from "@/lib/queries";
import type { Cronograma, Dificuldade } from "@/lib/types";
import { cn } from "@/lib/utils";

const TODAS = "todas";

/** Ordenação da timeline — "recentes" é o default e não viaja na URL. */
export type OrdemRegistros = "recentes" | "prioridade" | "antigas";

/** Estado rascunho do modal — aplica tudo de uma vez no "Aplicar". */
type Draft = {
  encontro: string;
  avaliacao: string;
  dificuldade: string;
  dupla: string;
  apoio: boolean;
  tardio: boolean;
  ordem: OrdemRegistros;
};

function draftDe(f: FiltrosRegistro, ordem: OrdemRegistros): Draft {
  return {
    encontro: f.encontro ? String(f.encontro) : TODAS,
    avaliacao: f.avaliacao ?? TODAS,
    dificuldade: f.dificuldade ?? TODAS,
    dupla: f.dupla ?? TODAS,
    apoio: !!f.apoio,
    tardio: !!f.tardio,
    ordem,
  };
}

const OVERLINE =
  "text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground sm:text-[11px]";

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

/** Barra de /registros: busca direta + modal de filtros (padrão marketplace —
 *  todas as dimensões juntas, contador de ativos no botão, aplica de uma vez). */
export function RegistrosFiltros({
  filtros,
  duplas,
  turmas = [],
  maxEncontro,
  encontrosComRegistro = [],
  ordem = "recentes",
  grupo = "dupla",
}: {
  filtros: FiltrosRegistro;
  duplas: DuplaOpcao[];
  /** cronogramas do recorte `?turma=` — alimenta o chip removível. */
  turmas?: Cronograma[];
  maxEncontro: number;
  /** nºs de encontro que TÊM registro no escopo do papel — pílula sem
   *  registro não filtra nada e não renderiza (regra de silêncio). */
  encontrosComRegistro?: number[];
  /** `?ordem=` não faz parte de FiltrosRegistro; a prop mantém o modo
   *  ligado quando a coord aplica/limpa um filtro. */
  ordem?: OrdemRegistros;
  /** `?grupo=` idem — o agrupamento da lista sobrevive a aplicar filtro,
   *  tirar chip e limpar tudo. */
  grupo?: GrupoRegistros;
}) {
  const router = useRouter();
  const [q, setQ] = useState(filtros.q ?? "");
  const timer = useRef<ReturnType<typeof setTimeout>>(null);
  // filtros da prop congelam no render que armou o timer — o debounce leria
  // valores velhos e reverteria um filtro aplicado dentro dos 350ms
  const filtrosRef = useRef(filtros);
  const ordemRef = useRef(ordem);
  const grupoRef = useRef(grupo);
  useEffect(() => {
    filtrosRef.current = filtros;
    ordemRef.current = ordem;
    grupoRef.current = grupo;
  });

  const [aberto, setAberto] = useState(false);
  const [draft, setDraft] = useState<Draft>(() => draftDe(filtros, ordem));

  // qualquer mudança de filtro (modal, chip de triagem, limpar, debounce)
  // resincroniza o estado local — draft re-semeia na próxima abertura
  const assinatura = JSON.stringify([
    filtros.encontro,
    filtros.avaliacao,
    filtros.apoio,
    filtros.tardio,
    filtros.dificuldade,
    filtros.dupla,
    filtros.turma,
    filtros.periodo,
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
      // recorte do panorama é filtro de verdade — sobrevive a busca/modal/
      // chip como qualquer outro param
      turma: f.turma,
      periodo: f.periodo,
      q: f.q,
      ordem: ordemRef.current !== "recentes" ? ordemRef.current : undefined,
      grupo: grupoRef.current !== "dupla" ? grupoRef.current : undefined,
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

  // turma/período contam no selo: são chips de verdade e o número do
  // botão precisa bater com o que aparece na linha de filtros ativos
  const ativos =
    (filtros.encontro ? 1 : 0) +
    (filtros.avaliacao ? 1 : 0) +
    (filtros.dificuldade ? 1 : 0) +
    (filtros.dupla ? 1 : 0) +
    (filtros.turma ? 1 : 0) +
    (filtros.periodo ? 1 : 0) +
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
    // recorte do panorama não mora no modal, mas é filtro de verdade —
    // "Aplicar" não pode jogar fora o que as pills montaram
    if (filtrosRef.current.turma) p.set("turma", filtrosRef.current.turma);
    if (filtrosRef.current.periodo) p.set("periodo", filtrosRef.current.periodo);
    if (filtrosRef.current.q) p.set("q", filtrosRef.current.q);
    if (draft.ordem !== "recentes") p.set("ordem", draft.ordem);
    if (grupoRef.current !== "dupla") p.set("grupo", grupoRef.current);
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
      turma: filtros.turma,
      periodo: filtros.periodo,
      q: filtros.q,
      ordem: ordem !== "recentes" ? ordem : undefined,
      grupo: grupo !== "dupla" ? grupo : undefined,
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
  if (filtros.turma) {
    const t = turmas.find((x) => x.id === filtros.turma);
    chips.push({
      rotulo: `Turma: ${t ? turmaCurta(t.turma) : "selecionada"}`,
      href: sem("turma"),
    });
  }
  if (filtros.periodo)
    chips.push({
      rotulo:
        PERIODO_REGISTROS_OPCOES.find((o) => o.valor === filtros.periodo)
          ?.rotulo ?? "Período",
      href: sem("periodo"),
    });
  if (filtros.apoio) chips.push({ rotulo: "Apoio em aberto", href: sem("apoio") });
  if (filtros.tardio) chips.push({ rotulo: "Registros tardios", href: sem("tardio") });
  if (filtros.q) chips.push({ rotulo: `Busca: “${filtros.q}”`, href: sem("q") });

  // "Limpar tudo" zera filtros mas mantém os controles de visão (ordem +
  // agrupamento) — são preferência de leitura, não filtro
  const hrefLimpo = (() => {
    const p = new URLSearchParams();
    if (ordem !== "recentes") p.set("ordem", ordem);
    if (grupo !== "dupla") p.set("grupo", grupo);
    const qs = p.toString();
    return `/registros${qs ? `?${qs}` : ""}`;
  })();

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
          <FiltrosButton
            ativos={ativos}
            onClick={() => {
              setDraft(draftDe(filtrosRef.current, ordemRef.current));
              setAberto(true);
            }}
          />
        </div>

        {chips.length > 0 && (
          <ul className="flex flex-wrap items-center gap-1.5" aria-label="Filtros ativos">
            {chips.map((c) => (
              <li key={c.rotulo}>
                <Link
                  href={c.href}
                  scroll={false}
                  aria-label={`Remover filtro ${c.rotulo}`}
                  className="inline-flex min-h-11 items-center gap-1 rounded-full border bg-card px-3 text-xs font-semibold transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)] sm:min-h-7"
                >
                  {c.rotulo}
                  <X size={12} aria-hidden className="text-muted-foreground" />
                </Link>
              </li>
            ))}
            <li>
              <Link
                href={hrefLimpo}
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
        {/* md, não lg: o corpo são pílulas, checks e um select em coluna —
            acima de md sobrava fundo ocioso; o scroll interno já vem do
            DialogContent */}
        <DialogContent size="md">
          <DialogHeader>
            <DialogTitle>Filtros</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
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

            {/* sem encontro com registro o fieldset só teria "Todos" —
                critério sem opção útil não renderiza (o nº ativo fica pra
                não prender a pessoa num filtro sem saída) */}
            {(encontrosComRegistro.length > 0 ||
              draft.encontro !== TODAS) && (
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
                    (n) =>
                      encontrosComRegistro.includes(n) ||
                      draft.encontro === String(n) ? (
                        <OpcaoPilula
                          key={n}
                          nome="flt-encontro"
                          valor={String(n)}
                          atual={draft.encontro}
                          onSelect={sel("encontro")}
                        >
                          {n}º
                        </OpcaoPilula>
                      ) : null
                  )}
                </div>
              </fieldset>
            )}

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
              {/* mesma gramática das outras dimensões — a lista de linhas
                  ocupava oito fileiras; os rótulos são fragmentos
                  ("aprendizagem"), então a pílula mostra a inicial maiúscula */}
              <div className="mt-1.5 grid grid-cols-2 gap-1.5">
                <OpcaoPilula
                  nome="flt-dificuldade"
                  valor={TODAS}
                  atual={draft.dificuldade}
                  onSelect={sel("dificuldade")}
                >
                  Todas
                </OpcaoPilula>
                <OpcaoPilula
                  nome="flt-dificuldade"
                  valor="com"
                  atual={draft.dificuldade}
                  onSelect={sel("dificuldade")}
                >
                  Qualquer dificuldade
                </OpcaoPilula>
                {Object.entries(DIFICULDADE_LABEL).map(([v, l]) => (
                  <OpcaoPilula
                    key={v}
                    nome="flt-dificuldade"
                    valor={v}
                    atual={draft.dificuldade}
                    onSelect={sel("dificuldade")}
                  >
                    {l.charAt(0).toUpperCase() + l.slice(1)}
                  </OpcaoPilula>
                ))}
              </div>
            </fieldset>

            {/* "Todas" + 1 dupla = 1 opção útil — select de uma dupla só
                não renderiza (o valor ativo mantém o controle visível) */}
            {(duplas.length >= 2 || draft.dupla !== TODAS) && (
            <fieldset>
              <legend id="flt-dupla-label" className={OVERLINE}>Dupla</legend>
              {/* lista longa demais pra pílula — o Select do kit rola no
                  popup em vez de criar scroll dentro do scroll do dialog */}
              <div className="mt-1.5">
                <Select
                  value={draft.dupla}
                  onValueChange={(v) => sel("dupla")(v ?? TODAS)}
                  items={{
                    [TODAS]: "Todas as duplas",
                    ...Object.fromEntries(
                      duplas.map((d) => [
                        d.id,
                        `${d.mentor?.nome ?? "—"} e ${d.mentorado?.nome ?? "—"}`,
                      ])
                    ),
                  }}
                >
                  <SelectTrigger
                    id="flt-dupla-select"
                    aria-labelledby="flt-dupla-label flt-dupla-select"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={TODAS}>Todas as duplas</SelectItem>
                    {duplas.map((d) => (
                      <SelectItem key={d.id} value={d.id}>
                        {d.mentor?.nome ?? "—"} e {d.mentorado?.nome ?? "—"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </fieldset>
            )}

            {/* ordenar não é filtro — não entra no contador de ativos nem
                é desfeito pelo "Limpar" */}
            <fieldset>
              <legend className={OVERLINE}>Ordenar</legend>
              <div className="mt-1.5 grid grid-cols-3 gap-1.5">
                <OpcaoPilula
                  nome="flt-ordem"
                  valor="recentes"
                  atual={draft.ordem}
                  onSelect={sel("ordem")}
                >
                  Mais recentes
                </OpcaoPilula>
                <OpcaoPilula
                  nome="flt-ordem"
                  valor="prioridade"
                  atual={draft.ordem}
                  onSelect={sel("ordem")}
                >
                  Prioridade
                </OpcaoPilula>
                <OpcaoPilula
                  nome="flt-ordem"
                  valor="antigas"
                  atual={draft.ordem}
                  onSelect={sel("ordem")}
                >
                  Mais antigas
                </OpcaoPilula>
              </div>
            </fieldset>
          </div>

          {/* sticky no pé da área rolante do DialogContent — em tela
              baixa o "Aplicar" não fica escondido abaixo da lista */}
          <DialogFooter sticky>
            <Button
              type="button"
              variant="ghost"
              className="sm:me-auto"
              disabled={draftAtivos === 0}
              onClick={() =>
                setDraft((d) => ({
                  encontro: TODAS,
                  avaliacao: TODAS,
                  dificuldade: TODAS,
                  dupla: TODAS,
                  apoio: false,
                  tardio: false,
                  // ordenar não é filtro — o Limpar preserva a escolha
                  ordem: d.ordem,
                }))
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
