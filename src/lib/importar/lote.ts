// Lote + auditoria da importação assistida (REALIZA-180).
//
// `lote` é o uuid gerado no client ao abrir o dialog de import: todo evento
// de IA daquela importação o carrega em args->>'lote', então "o que a IA
// fez nesta importação" é um filtro só em ia_eventos — sem tabela nova.
// A escrita é exclusiva das RPCs definer (registrar_ia_eventos_lote, 0160);
// args carregam metadados da chamada (tamanhos, contagens), nunca o
// conteúdo do documento nem a resposta do modelo.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { EventoIa } from "../ia/tools";

/** Teto de chamadas de IA por lote (REALIZA-180): match_semantico e, nas
 *  fases seguintes, interpretar_revisao. MAX_IMPORT já limita as linhas;
 *  o cap evita varrer um lote enorme no automático — o que passar do teto
 *  cai na revisão manual de sempre. */
export const MAX_CHAMADAS_IA_LOTE = 30;

/** Id do lote no client (dialog) — um por sessão de importação. */
export function novoLoteId(): string {
  return crypto.randomUUID();
}

/** Args do evento match_semantico — metadados da chamada, sem conteúdo:
 *  `n` = quantas candidatas o modelo recebeu, `txtLen` = tamanho dos dois
 *  textos de entrada (mentorTxt + mentoradoTxt). */
export function argsMatchSemantico(
  lote: string,
  n: number,
  txtLen: number
): Record<string, unknown> {
  return { lote, n, txtLen };
}

/** Grava os eventos do canal 'importacao' num insert só (a RPC valida o
 *  canal item a item — sem a 0193 ela levanta 'canal inválido' e a falha
 *  vira log, nunca quebra a importação). */
export async function registrarEventosImportacao(
  supabase: SupabaseClient,
  eventos: EventoIa[]
): Promise<void> {
  if (!eventos.length) return;
  try {
    const { error } = await supabase.rpc("registrar_ia_eventos_lote", {
      p_eventos: eventos,
    });
    if (error) console.error("registrar_ia_eventos_lote:", error);
  } catch (e) {
    console.error("registrar_ia_eventos_lote:", e);
  }
}
