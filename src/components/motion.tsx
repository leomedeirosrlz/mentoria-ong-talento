"use client";

import type { ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";

/** Vocabulário de motion do app (lib `motion` v13). Divisão de trabalho com o
 *  CSS: shared-element (layoutId), exit e height:"auto" moram aqui; hover,
 *  enter-stagger e dialogs seguem em CSS. Toda aplicação leva comentário com a
 *  função (feedback / continuidade espacial / atenção) — spec §2. */

export const EASE = [0.2, 0, 0, 1] as const; // = --ease-snappy

export const T = {
  micro: { duration: 0.15, ease: EASE }, // hover/cor — prefira CSS
  enter: { duration: 0.18, ease: EASE }, // entrada de painel/card
  panel: { duration: 0.22, ease: EASE }, // height:"auto", crossfade
  pill: { type: "spring", duration: 0.3, bounce: 0 }, // layoutId — bounce SEMPRE 0
} as const;

export const fade = {
  initial: { opacity: 0, y: 4 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -3, transition: T.micro }, // saída mais curta e sutil
};

/** Par pra saída animada em listas mutáveis (wave C — continuidade espacial:
 *  a linha sai colapsando em vez de teleportar). `<ExitList>` é o
 *  AnimatePresence (initial={false}: a lista pintada no SSR não entra
 *  animando; quem chega depois — add otimista ou refresh — entra). `<ExitItem>`
 *  é o motion.* com a coreografia de exit.
 *  Funciona dentro de server components: os dois são client boundaries com
 *  props serializáveis — a remoção pode vir de estado local (useOptimistic)
 *  ou de props novas do router.refresh(); o AnimatePresence segura o subtree
 *  montado até o fim do exit nas duas vias. */
export function ExitList({ children }: { children: ReactNode }) {
  return <AnimatePresence initial={false}>{children}</AnimatePresence>;
}

const EXIT_TAG = {
  li: motion.li,
  div: motion.div,
  article: motion.article,
} as const;

export function ExitItem({
  tag = "li",
  className,
  children,
}: {
  /** tag semântica do item — li dentro de <ul>/<ol>, article/div soltos */
  tag?: keyof typeof EXIT_TAG;
  className?: string;
  children: ReactNode;
}) {
  const Comp = EXIT_TAG[tag] as typeof motion.div;
  return (
    <Comp
      className={className}
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      // padding/margem zeram junto: border-box não encolhe além deles — sem
      // isso um item com py (ou margin do space-y) deixava faixa residual
      // visível durante o collapse
      exit={{
        opacity: 0,
        height: 0,
        paddingTop: 0,
        paddingBottom: 0,
        marginTop: 0,
        marginBottom: 0,
      }}
      transition={T.panel}
      // clip recorta a animação sem criar scrollport — mesma razão do
      // RegistroInlinePanel
      style={{ overflow: "clip" }}
    >
      {children}
    </Comp>
  );
}
