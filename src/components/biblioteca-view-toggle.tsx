"use client";

import { useCallback, useSyncExternalStore } from "react";
import { List, SquaresFour } from "@phosphor-icons/react";
import { filterChipCls } from "@/components/ui/filter-chip";

// Alternador Cartões/Lista da biblioteca (spec 029): o mesmo controle
// serve jovem, mentor e coordenação. A preferência é por SUPERFÍCIE e
// vive no aparelho (localStorage — nunca cookie nem banco); sem
// preferência explícita o default vem do viewport: <768px lista (evita
// a estante de iframes no celular), ≥768px o comportamento de sempre da
// superfície (jovem cartões, staff lista). SSR renderiza "list" — é o
// default barato e seguro; a preferência/desktop resolve na hidratação
// via useSyncExternalStore, sem mismatch nem iframe em HTML de servidor.
// O efeito visível assumido (a spec sanciona "resolvido após mount"): no
// desktop do jovem a primeira pintura é Lista e troca pra Cartões — a
// remontagem entra pelo mesmo animate-enter de sempre.

export type ViewBiblioteca = "cards" | "list";
export type SuperficieBiblioteca = "jovem" | "staff";

const CHAVE_VIEW: Record<SuperficieBiblioteca, string> = {
  jovem: "biblioteca:view:jovem",
  staff: "biblioteca:view:staff",
};

const MQ_DESKTOP = "(min-width: 768px)";

const ouvintes = new Set<() => void>();

/** Preferência explícita salva; valor corrompido cai no default como se
 *  não existisse (localStorage de modo privado também pode negar a
 *  leitura — mesmo destino). */
function preferida(superficie: SuperficieBiblioteca): ViewBiblioteca | null {
  try {
    const salva = localStorage.getItem(CHAVE_VIEW[superficie]);
    return salva === "cards" || salva === "list" ? salva : null;
  } catch {
    return null;
  }
}

function padrao(superficie: SuperficieBiblioteca): ViewBiblioteca {
  if (!window.matchMedia(MQ_DESKTOP).matches) return "list";
  return superficie === "jovem" ? "cards" : "list";
}

function assinar(aoMudar: () => void) {
  ouvintes.add(aoMudar);
  // resize sem preferência salva re-resolve o default pelo viewport;
  // "storage" cobre a troca feita em outra aba do mesmo navegador
  const mq = window.matchMedia(MQ_DESKTOP);
  mq.addEventListener("change", aoMudar);
  window.addEventListener("storage", aoMudar);
  return () => {
    ouvintes.delete(aoMudar);
    mq.removeEventListener("change", aoMudar);
    window.removeEventListener("storage", aoMudar);
  };
}

export function useViewBiblioteca(
  superficie: SuperficieBiblioteca
): [ViewBiblioteca, (v: ViewBiblioteca) => void] {
  const medir = useCallback(
    () => preferida(superficie) ?? padrao(superficie),
    [superficie]
  );
  const view = useSyncExternalStore<ViewBiblioteca>(
    assinar,
    medir,
    () => "list"
  );
  const trocar = useCallback(
    (v: ViewBiblioteca) => {
      try {
        localStorage.setItem(CHAVE_VIEW[superficie], v);
      } catch {
        // modo privado sem storage: a troca vale só nesta montagem
      }
      for (const f of ouvintes) f();
    },
    [superficie]
  );
  return [view, trocar];
}

const VIEW_LABEL: Record<ViewBiblioteca, string> = {
  cards: "Cartões",
  list: "Lista",
};

/** Controle Cartões/Lista. O grupo tem nome ("Modo de visualização") e
 *  cada botão é aria-pressed; a região de status anuncia modo + total
 *  quando mudam (live region — o texto inicial não é lido). Visual: o idioma
 *  canônico de toggle de lista (filterChipCls — pill escuro ativo,
 *  min-h-11 no toque / sm:min-h-8 no desktop), não um segmentado novo.
 *  528: abaixo de sm o rótulo some do layout (sr-only sm:not-sr-only) —
 *  o controle encolhe pra dois ícones e o nome acessível continua no
 *  botão. */
export function BibliotecaViewToggle({
  superficie,
  total,
}: {
  superficie: SuperficieBiblioteca;
  /** total de itens da biblioteca — anunciado junto do modo. */
  total?: number;
}) {
  const [view, trocar] = useViewBiblioteca(superficie);
  const opcoes: { id: ViewBiblioteca; rotulo: string; Icone: typeof List }[] = [
    { id: "cards", rotulo: "Cartões", Icone: SquaresFour },
    { id: "list", rotulo: "Lista", Icone: List },
  ];
  return (
    <div
      role="group"
      aria-label="Modo de visualização"
      className="flex shrink-0 items-center gap-1.5"
    >
      {opcoes.map(({ id, rotulo, Icone }) => (
        <button
          key={id}
          type="button"
          aria-pressed={view === id}
          onClick={() => trocar(id)}
          className={filterChipCls(view === id)}
        >
          <Icone size={15} aria-hidden />
          <span className="sr-only sm:not-sr-only">{rotulo}</span>
        </button>
      ))}
      <span role="status" className="sr-only">
        {VIEW_LABEL[view]}
        {total != null ? ` · ${total} ${total === 1 ? "item" : "itens"}` : ""}
      </span>
    </div>
  );
}
