import { headers } from "next/headers";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  superficieDoPath,
  type EventoProduto,
} from "./produto-eventos";

// REALIZA-417 (fase 2) — emissor server-side de gestos de produto: a mesma
// RPC do beacon (registrar_produto_eventos, 0197) — profile/papel saem do
// JWT do client do caller, nunca service role nem payload. Server-only:
// lê next/headers — não importar de client components (o client-only
// produto-eventos.ts é o módulo compartilhado entre os dois lados).
//
// Fire-and-forget como o endpoint do beacon: erro vira console.error e
// nunca propaga — telemetria não derruba ação.

/** pathname do Referer → superfície estável (mesmo mapeamento do beacon).
 *  Server actions POSTam da página e o browser manda o referer dela;
 *  sem ele (ou URL inválida) cai no "outros", fallback do beacon. */
export function superficieDeReferer(referer: string | null): string {
  if (!referer) return "outros";
  try {
    return superficieDoPath(new URL(referer).pathname);
  } catch {
    return "outros";
  }
}

/** Superfície da origem da action/route lida do header Referer — cobre
 *  todos os callers sem parâmetro novo (o gesto vale na página onde a
 *  pessoa clicou, não onde a action mora). */
export async function superficieDaOrigem(): Promise<string> {
  return superficieDeReferer((await headers()).get("referer"));
}

/** Emite um gesto de produto via RPC — o lote da RPC é array; aqui sempre
 *  um evento por chamada (os pontos server-side não batelam). */
export async function emitirProdutoEvento(
  supabase: SupabaseClient,
  evento: EventoProduto
): Promise<void> {
  try {
    const { error } = await supabase.rpc("registrar_produto_eventos", {
      p_eventos: [evento],
    });
    if (error) console.error("emitirProdutoEvento:", error);
  } catch (e) {
    console.error("emitirProdutoEvento:", e);
  }
}
