// Rate limit da camada de IA (sdd §3): conta os ia_eventos do PRÓPRIO
// profile nos últimos 60s — o ledger já é a tabela de auditoria, não
// precisa de estrutura nova. O eq(profile_id) é o que mantém o recorte
// próprio também pra coordenação (que pela policy lê o rastro de todos).

import type { SupabaseClient } from "@supabase/supabase-js";

/** true = estourou o teto (o chamador responde 429). Falha na contagem
 *  loga e BLOQUEIA (fail-closed): em serverless não existe estado local
 *  confiável pra provar baixa atividade, e liberar com o DB degradado
 *  abre custo de LLM sem teto justo quando a infra já está ruim.
 *  Custo ilimitado pesa mais que UX degradada temporária — o 429 é
 *  recuperável com retry do cliente (o componente já trata). */
export async function checarLimiteIa(
  supabase: SupabaseClient,
  profileId: string,
  limite = 20
): Promise<boolean> {
  const { count, error } = await supabase
    .from("ia_eventos")
    .select("id", { count: "exact", head: true })
    .eq("profile_id", profileId)
    .gte("created_at", new Date(Date.now() - 60_000).toISOString());
  if (error) {
    console.error("checarLimiteIa:", error);
    return true;
  }
  return (count ?? 0) >= limite;
}
