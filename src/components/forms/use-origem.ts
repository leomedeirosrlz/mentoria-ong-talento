import { useSyncExternalStore } from "react";

/** Origem do deploy (window.location.origin) — "" no SSR e no primeiro
 *  render do client (getServerSnapshot), o absoluto entra na re-render que
 *  o useSyncExternalStore dispara depois da hidratação. SSR e hidratação
 *  produzem a mesma mensagem/href sem setState em effect.
 *  Separado de link-shared.ts: hooks não podem morar em módulo importado
 *  por Server Component. */
export function useOrigem(): string {
  return useSyncExternalStore(
    // a origem nunca muda em runtime — subscribe é no-op de propósito
    () => () => {},
    () => window.location.origin,
    () => ""
  );
}
