"use client";

import { toast as sonner } from "sonner";
import { DEMO_MSG } from "./demo/shared";

// REALIZA-495 — no modo demo toda mutation responde `{ error: DEMO_MSG }`
// ("nada foi gravado") e as telas chamam toast.error() com ela: o usuário
// via um toast vermelho de erro pra um aviso neutro. São 300+ call sites,
// então o desvio mora aqui: só a mensagem exata da demo sai como info.

/** Tipo visual do toast de erro: DEMO_MSG é info (aviso de demonstração);
 *  qualquer mensagem de verdade segue error. Puro, coberto por tests/toast. */
export function tipoDoToast(mensagem: unknown): "info" | "error" {
  return mensagem === DEMO_MSG ? "info" : "error";
}

type Params = Parameters<typeof sonner>;

/** O `toast` do Sonner inteiro, com um único desvio: `.error(DEMO_MSG)`
 *  vira `.info`. Todo o resto — success, warning, info, message, promise,
 *  loading, custom, dismiss, getHistory/getToasts e a chamada direta — é o
 *  objeto original copiado prop a prop: opções (description, duration, id,
 *  action) e o id retornado passam iguais. */
export const toast: typeof sonner = Object.assign(
  (mensagem: Params[0], data?: Params[1]) => sonner(mensagem, data),
  sonner,
  {
    error: (mensagem: Params[0], data?: Params[1]) =>
      tipoDoToast(mensagem) === "info"
        ? sonner.info(mensagem, data)
        : sonner.error(mensagem, data),
  }
);
