"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { CaretRight, FunnelX } from "@phosphor-icons/react";
import type { Material } from "@/lib/types";
import { cn } from "@/lib/utils";
import { filterChipCls } from "@/components/ui/filter-chip";
import {
  CoberturaTrilha,
  EncontroDetails,
  TransversaisMateriais,
  type GuiaPapel,
} from "@/components/materiais-hub";

// REALIZA-184 — o hub da biblioteca como dashboard: faixa de KPIs, trilha
// de cobertura, filtros leves por audiência/tipo (chips, client-side — mesmo
// idioma do filterChipCls de /pessoas) e as listas agrupadas em <details>
// nativos com contagem. Continua SSR: client component renderiza HTML no
// server igual; o estado só entra depois da hidratação (chips e toggles).

export type EncontroGrupo = {
  n: number;
  titulo?: string;
  itens: Material[];
};

export type TransversalGrupo = {
  tipo: Material["tipo"];
  itens: Material[];
};

/** Números da faixa de stats — calculados na page (server), já no escopo do
 *  papel (`visiveis`): o mentor vê os números do que chega até ele. */
export type MateriaisStats = {
  /** encontros com ao menos um material com destino real ("coberto" da trilha). */
  cobertos: number;
  /** teto do cronograma (1..N da trilha). */
  teto: number;
  /** materiais com arquivo ou link válido. */
  publicados: number;
  /** materiais sem destino ainda — o "em breve" legítimo. */
  emBreve: number;
  /** "12 de nov." — max(created_at) da lista; null quando a coluna não veio. */
  ultimo: string | null;
};

type AudienciaFiltro = "todas" | Material["audiencia"];
type TipoFiltro = "todos" | Material["tipo"];

/** Fade lateral dos trilhos de chips — só quando de fato rola (no wrap do
 *  sm+ o conteúdo cabe e a máscara sai; o ResizeObserver decide sem media
 *  query). mask-image inline porque utilidade nova em globals é fora de
 *  escopo — mesmo padrão do scroller da semana-do-programa. */
const FADE_CHIPS =
  "linear-gradient(to right, transparent, black 20px, black calc(100% - 20px), transparent)";

function useFadeQuandoRola<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const aplicar = () => {
      if (el.scrollWidth > el.clientWidth + 1) {
        el.style.setProperty("-webkit-mask-image", FADE_CHIPS);
        el.style.setProperty("mask-image", FADE_CHIPS);
      } else {
        el.style.removeProperty("-webkit-mask-image");
        el.style.removeProperty("mask-image");
      }
    };
    aplicar();
    const ro = new ResizeObserver(aplicar);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return ref;
}

const AUD_ORDEM: Material["audiencia"][] = [
  "todos",
  "dpp",
  "especialista",
  "coordenacao",
];
const AUD_CHIP: Record<Material["audiencia"], string> = {
  todos: "Para todos",
  dpp: "Mentores DPP",
  especialista: "Especialistas",
  coordenacao: "Coordenação",
};
const TIPO_ORDEM: Material["tipo"][] = ["guia", "template", "conteudo", "link"];
const TIPO_CHIP: Record<Material["tipo"], string> = {
  guia: "Guias",
  template: "Modelos",
  conteudo: "Conteúdos",
  link: "Links",
};

/** Stat compacto da faixa — número à frente, rótulo colado (dd antes de dt
 *  no flex visual; no DOM o dt vem primeiro pro pareamento correto). */
function Kpi({ valor, rotulo }: { valor: string; rotulo: string }) {
  return (
    <div className="flex items-baseline gap-1.5">
      <dt className="order-2 text-xs text-muted-foreground">{rotulo}</dt>
      <dd className="order-1 text-base font-semibold leading-none tabular-nums">
        {valor}
      </dd>
    </div>
  );
}

/** Summary de grupo — mesma gramática do EncontroDetails (caret + heading
 *  de verdade pro leitor de tela + contagem à direita), com alvo de 44px no
 *  toque. `grupo` casa com a classe group/<nome> do <details> pai — nomeado
 *  porque o caret não pode reagir ao open dos <details> de encontro
 *  aninhados. A variante precisa ficar literal no fonte (o scanner do
 *  Tailwind não vê classe montada em runtime). */
function GrupoSummary({
  grupo,
  titulo,
  children,
}: {
  grupo: "genc" | "gtr";
  titulo: string;
  children?: ReactNode;
}) {
  return (
    <summary className="flex min-h-11 cursor-pointer list-none items-center gap-x-2 rounded-lg px-1.5 select-none marker:hidden transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:min-h-9 [&::-webkit-details-marker]:hidden">
      <CaretRight
        size={14}
        weight="bold"
        aria-hidden
        className={cn(
          "shrink-0 text-muted-foreground transition-transform",
          grupo === "genc"
            ? "group-open/genc:rotate-90"
            : "group-open/gtr:rotate-90"
        )}
      />
      <span role="heading" aria-level={2} className="text-[13px] font-semibold">
        {titulo}
      </span>
      <span className="ml-auto shrink-0 pl-2 text-xs tabular-nums text-muted-foreground">
        {children}
      </span>
    </summary>
  );
}

export function MateriaisBiblioteca({
  stats,
  encontros,
  transversais,
  ehCoord,
  maxEncontro,
  encontroAtual,
  mobile,
  guiaPapel,
}: {
  stats: MateriaisStats;
  /** encontros 1..N já com título do calendário e itens — inclui os vazios
   *  (a trilha e a linha "sem material ainda" dependem deles). */
  encontros: EncontroGrupo[];
  transversais: TransversalGrupo[];
  ehCoord: boolean;
  maxEncontro: number;
  /** encontro vigente do calendário — vem aberto e marcado "semana atual". */
  encontroAtual: number | null;
  /** UA sniff da page (default-hint, não regra): mobile fecha o grupo "Por
   *  encontro" por padrão — a lista de 16 linhas é o maior scroll da tela.
   *  Trilha e Transversais seguem abertas (o mapa e o Guia do Mentor). */
  mobile: boolean;
  /** quem lê a nota do guia dentro de cada encontro (v5c): "staff" lê
   *  "o que o encontro cobre", "mentor" lê "como conduzir"; null some
   *  (especialista — a trilha dele não passa pelas janelas DPP). */
  guiaPapel?: GuiaPapel | null;
}) {
  const [aud, setAud] = useState<AudienciaFiltro>("todas");
  const [tipoF, setTipoF] = useState<TipoFiltro>("todos");
  const filtrando = aud !== "todas" || tipoF !== "todos";
  const refAud = useFadeQuandoRola<HTMLDivElement>();
  const refTipo = useFadeQuandoRola<HTMLDivElement>();

  const todos = useMemo(
    () => [
      ...encontros.flatMap((e) => e.itens),
      ...transversais.flatMap((g) => g.itens),
    ],
    [encontros, transversais]
  );
  // a trilha é o mapa global — sempre lê o conjunto inteiro, nunca o filtro
  const mapaPorEncontro = useMemo(
    () => new Map(encontros.map((e) => [e.n, e.itens])),
    [encontros]
  );

  const matchAud = (m: Material) => aud === "todas" || m.audiencia === aud;
  const matchTipo = (m: Material) => tipoF === "todos" || m.tipo === tipoF;

  const auds = useMemo(
    () => AUD_ORDEM.filter((a) => todos.some((m) => m.audiencia === a)),
    [todos]
  );
  const tipos = useMemo(
    () => TIPO_ORDEM.filter((t) => todos.some((m) => m.tipo === t)),
    [todos]
  );

  // contagens facetadas: o chip de audiência já desconta o filtro de tipo
  // ativo (e vice-versa) — o número antecipa o que o toque revela
  const contaAud = (a: Material["audiencia"]) =>
    todos.filter((m) => matchTipo(m) && m.audiencia === a).length;
  const contaTipo = (t: Material["tipo"]) =>
    todos.filter((m) => matchAud(m) && m.tipo === t).length;

  const match = (m: Material) => matchAud(m) && matchTipo(m);
  const encontrosF = encontros.map((e) => ({
    ...e,
    visiveis: filtrando ? e.itens.filter(match) : e.itens,
  }));
  const transversaisF = transversais.map((g) => ({
    ...g,
    itens: filtrando ? g.itens.filter(match) : g.itens,
  }));
  const totEnc = encontros.reduce((s, e) => s + e.itens.length, 0);
  const totEncF = encontrosF.reduce((s, e) => s + e.visiveis.length, 0);
  const totTr = transversais.reduce((s, g) => s + g.itens.length, 0);
  const totTrF = transversaisF.reduce((s, g) => s + g.itens.length, 0);
  const totalFiltrado = totEncF + totTrF;

  // filtro ativo: os grupos fechados por padrão (mobile) abrem sozinhos pra
  // o recorte aparecer; ao limpar, só o que o filtro abriu volta a fechar —
  // o que o usuário abriu/fechou à mão não é desfeito nunca
  const rootRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    rootRef.current
      ?.querySelectorAll<HTMLDetailsElement>("details[data-grupo]")
      .forEach((g) => {
        if (filtrando) {
          if (!g.open) {
            g.setAttribute("open", "");
            g.dataset.filtroAbriu = "1";
          }
        } else if (g.dataset.filtroAbriu) {
          g.removeAttribute("open");
          delete g.dataset.filtroAbriu;
        }
      });
  }, [filtrando]);

  function chip(
    ativo: boolean,
    onClick: () => void,
    rotulo: string,
    contagem: number
  ) {
    return (
      <button
        key={rotulo}
        type="button"
        aria-pressed={ativo}
        onClick={onClick}
        className={cn(filterChipCls(ativo), "shrink-0")}
      >
        {rotulo}
        <span
          className={cn(
            "font-mono text-[11px] tabular-nums",
            ativo ? "text-background/70" : "text-muted-foreground/70"
          )}
        >
          {contagem}
        </span>
      </button>
    );
  }

  return (
    <div ref={rootRef} className="space-y-5">
      {/* faixa de KPIs — um retrato da biblioteca, não hero: mesma leitura
          pros papéis de leitura, escopo = o que cada um vê */}
      <section
        aria-label="Resumo da biblioteca"
        className="animate-enter rounded-xl bg-card px-4 py-3.5 shadow-[var(--shadow-border)] sm:px-5"
      >
        <dl className="grid grid-cols-2 gap-x-4 gap-y-2.5 sm:flex sm:flex-wrap sm:gap-x-8">
          <Kpi
            valor={`${stats.cobertos}/${stats.teto}`}
            rotulo="encontros com material"
          />
          <Kpi
            valor={String(stats.publicados)}
            rotulo={
              stats.publicados === 1
                ? "material publicado"
                : "materiais publicados"
            }
          />
          <Kpi valor={String(stats.emBreve)} rotulo="em breve" />
          {stats.ultimo != null && (
            <Kpi valor={stats.ultimo} rotulo="último item" />
          )}
        </dl>
      </section>

      {/* trilha — o mapa de navegação; fora do filtro e sempre aberta */}
      {encontros.length > 0 && (
        <CoberturaTrilha
          porEncontro={mapaPorEncontro}
          nums={encontros.map((e) => e.n)}
        />
      )}

      {/* chips de filtro — um eixo só aparece quando tem o que separar
          (biblioteca de um valor só não ganha chip) */}
      {(auds.length > 1 || tipos.length > 1) && (
        <div
          role="group"
          aria-label="Filtrar materiais"
          className="animate-enter flex flex-wrap items-center gap-x-5 gap-y-2"
        >
          {auds.length > 1 && (
            // v5c — no mobile os chips ficam numa linha só com scroll
            // lateral (o bleed -mx/px deixa o último chip respirar na borda
            // e o fade de borda anuncia que há mais); a partir de sm volta
            // a quebrar normalmente — scroll-fina afina o trilho
            <div
              ref={refAud}
              role="group"
              aria-label="Filtrar por audiência"
              className="scroll-fina -mx-4 flex flex-nowrap items-center gap-1.5 overflow-x-auto px-4 pb-0.5 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0"
            >
              <span className="shrink-0 text-xs font-medium text-muted-foreground">
                Audiência
              </span>
              {chip(aud === "todas", () => setAud("todas"), "Todas", todos.filter(matchTipo).length)}
              {auds.map((a) =>
                chip(aud === a, () => setAud(a), AUD_CHIP[a], contaAud(a))
              )}
            </div>
          )}
          {tipos.length > 1 && (
            <div
              ref={refTipo}
              role="group"
              aria-label="Filtrar por tipo"
              className="scroll-fina -mx-4 flex flex-nowrap items-center gap-1.5 overflow-x-auto px-4 pb-0.5 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0"
            >
              <span className="shrink-0 text-xs font-medium text-muted-foreground">
                Tipo
              </span>
              {chip(tipoF === "todos", () => setTipoF("todos"), "Todos", todos.filter(matchAud).length)}
              {tipos.map((t) =>
                chip(tipoF === t, () => setTipoF(t), TIPO_CHIP[t], contaTipo(t))
              )}
            </div>
          )}
        </div>
      )}

      {/* nada cruzou os dois eixos — mensagem + escape na hora */}
      {filtrando && totalFiltrado === 0 && (
        <div className="flex flex-col items-center gap-1.5 rounded-xl bg-card px-5 py-8 text-center shadow-[var(--shadow-border)]">
          <p className="text-sm font-medium">
            Nenhum material com esses filtros
          </p>
          <p className="text-sm text-muted-foreground">
            Tente outra combinação de audiência e tipo.
          </p>
          <button
            type="button"
            onClick={() => {
              setAud("todas");
              setTipoF("todos");
            }}
            className={cn(filterChipCls(false), "mt-2")}
          >
            <FunnelX size={15} aria-hidden />
            Limpar filtros
          </button>
        </div>
      )}

      {/* grupo "Por encontro" — fechado por padrão no mobile (é o maior
          bloco da página); a célula da trilha e o filtro reabrem sozinhos */}
      {encontros.length > 0 && (
        <details
          id="mat-grupo-encontros"
          data-grupo
          open={!mobile}
          className="group/genc"
        >
          <GrupoSummary grupo="genc" titulo="Por encontro">
            {filtrando ? `${totEncF} de ${totEnc}` : totEnc}{" "}
            {totEnc === 1 ? "material" : "materiais"}
          </GrupoSummary>
          <div className="mt-1 space-y-2">
            {encontrosF.map((e, i) => (
              <EncontroDetails
                key={e.n}
                n={e.n}
                titulo={e.titulo}
                itens={e.visiveis}
                total={e.itens.length}
                ehCoord={ehCoord}
                maxEncontro={maxEncontro}
                indice={i}
                aberto={e.n === encontroAtual}
                atual={e.n === encontroAtual}
                oculto={filtrando && e.visiveis.length === 0}
                guiaPapel={guiaPapel}
              />
            ))}
          </div>
        </details>
      )}

      {/* grupo "Transversais" — aberto em todo viewport: o Guia do Mentor
          é o material mais acessado da página (decisão do hub original) */}
      {transversais.length > 0 && (
        <details
          id="mat-grupo-transversais"
          data-grupo
          open
          className="group/gtr"
        >
          <GrupoSummary grupo="gtr" titulo="Transversais">
            {filtrando ? `${totTrF} de ${totTr}` : totTr}{" "}
            {totTr === 1 ? "item" : "itens"}
          </GrupoSummary>
          <div className="mt-1">
            {totTrF > 0 ? (
              <TransversaisMateriais
                grupos={transversaisF}
                ehCoord={ehCoord}
                maxEncontro={maxEncontro}
              />
            ) : (
              <p className="px-1.5 py-1 text-sm text-muted-foreground">
                Nada transversal com esses filtros.
              </p>
            )}
          </div>
        </details>
      )}
    </div>
  );
}
