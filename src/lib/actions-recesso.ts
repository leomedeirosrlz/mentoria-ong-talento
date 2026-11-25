"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { demoAtivo } from "./demo/mode";

/** Declara a decisão da dupla sobre um recesso do cronograma (REALIZA-462/518,
 *  0218/0225): usa=true = os encontros pausam no período (default de
 *  sempre), usa=false = a dupla segue se encontrando. A RPC
 *  `declarar_recesso` é a única
 *  porta de escrita — a 0225 restringiu a decisão aos dois lados da dupla
 *  (mentor e mentorado; a equipe vê e cobra, não responde por eles), dupla
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
  // a decisão também mora na agenda do jovem — o recorte do
  // jovem_recessos/jovem_plano precisa revalidar junto
  revalidatePath("/jovem");
  revalidatePath("/jovem/agenda");
  return { ok: true };
}
