"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { demoAtivo } from "./demo/mode";

/** Declara a decisão da dupla sobre um recesso do cronograma (REALIZA-462,
 *  0218): usa=true "vamos usar o recesso" (default de sempre), usa=false
 *  "vamos seguir nos encontrando". A RPC `declarar_recesso` é a única
 *  porta de escrita — valida papel (coord ou o mentor da dupla), dupla
 *  DPP ativa e o evento sendo recesso do cronograma dela. Redeclarar
 *  atualiza a mesma linha: a última decisão vale, com a data da mudança. */
export async function declararRecesso(
  duplaId: string,
  cicloEventoId: string,
  usa: boolean
): Promise<{ ok: true; demo?: boolean } | { error: string }> {
  if (await demoAtivo()) return { ok: true, demo: true };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("declarar_recesso", {
    p_dupla: duplaId,
    p_evento: cicloEventoId,
    p_usa: usa,
  });
  if (error) {
    console.error("declararRecesso:", error);
    return { error: "Não consegui salvar a decisão agora." };
  }
  const r = data as { ok?: boolean; error?: string } | null;
  if (r?.error) return { error: r.error };
  revalidatePath(`/duplas/${duplaId}`);
  return { ok: true };
}
