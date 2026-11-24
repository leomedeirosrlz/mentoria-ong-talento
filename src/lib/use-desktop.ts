"use client";

import { useSyncExternalStore } from "react";

// Mesma régua do `md:` do Tailwind. O padrão já vivia copiado em
// combinar-plano.tsx e seletor-dia-hora.tsx — extraído quando a "superfície
// única por viewport" (Dialog no desktop / Sheet no mobile) virou
// convenção dos forms densos (spec 022).
const MQ_DESKTOP = "(min-width: 768px)";
const assinaDesktop = (cb: () => void) => {
  const mq = window.matchMedia(MQ_DESKTOP);
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
};
const medeDesktop = () => window.matchMedia(MQ_DESKTOP).matches;

/** true em viewport ≥768px. SSR e a 1ª hidratação leem desktop — em
 *  superfícies condicionais por viewport isso pode pintar o desktop no
 *  mobile por um frame; quem monta sob demanda (dialog/sheet) não sente. */
export function useDesktop(): boolean {
  return useSyncExternalStore(assinaDesktop, medeDesktop, () => true);
}
