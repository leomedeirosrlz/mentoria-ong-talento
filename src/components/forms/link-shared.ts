import { useSyncExternalStore } from "react";

// Miolo compartilhado dos fluxos de link de formulário — o dialog em massa
// (app/(app)/formularios/formulario-links) e o da ficha da dupla
// (components/enviar-formulario-dialog) usavam cópias que já tinham
// divergido; a fonte única mora aqui.

export const VALIDADE_OPCOES = [
  { v: "0", l: "Sem validade" },
  { v: "7", l: "Expira em 7 dias" },
  { v: "15", l: "Expira em 15 dias" },
  { v: "30", l: "Expira em 30 dias" },
  { v: "60", l: "Expira em 60 dias" },
] as const;

export function primeiroNome(nome: string | null | undefined): string {
  return nome?.split(" ")[0] ?? "";
}

/** Origem do deploy (window.location.origin) — "" no SSR e no primeiro
 *  render do client (getServerSnapshot), o absoluto entra na re-render que
 *  o useSyncExternalStore dispara depois da hidratação. SSR e hidratação
 *  produzem a mesma mensagem/href sem setState em effect. */
export function useOrigem(): string {
  return useSyncExternalStore(
    // a origem nunca muda em runtime — subscribe é no-op de propósito
    () => () => {},
    () => window.location.origin,
    () => ""
  );
}

/** URL do link público — montada no client porque o servidor não sabe a
 *  origem de deploy. Regra: quem chama NO RENDER passa `origem` (de
 *  useOrigem) pra SSR não quebrar (window não existe lá); em handler
 *  (click/copiar) pode omitir — window já está disponível. */
export function urlPublica(token: string, origem?: string | null): string {
  const base =
    origem ?? (typeof window === "undefined" ? "" : window.location.origin);
  return `${base}/f/${token}`;
}

/** Convite único pros dois pontos de envio — o WhatsApp abre com o mesmo
 *  texto vindo da lista de links, do dialog em massa e da ficha da dupla.
 *  `origem` idem urlPublica. */
export function msgLinkWhatsApp(
  formularioTitulo: string,
  nome: string | null | undefined,
  token: string,
  origem?: string | null
): string {
  const p = primeiroNome(nome);
  return `Olá${p ? `, ${p}` : ""}! A equipe Realiza.vc te convida pra responder "${formularioTitulo}". Leva poucos minutos: ${urlPublica(token, origem)}`;
}
