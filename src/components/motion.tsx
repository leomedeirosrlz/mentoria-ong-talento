"use client";

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
