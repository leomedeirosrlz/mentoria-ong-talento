// Resolução da configuração viva do assistente (ia_config, 0148).
// Lida uma vez por request na rota — uma query de 3 linhas numa tabela
// de 3 chaves; sem cache de módulo porque a coordenação espera que o
// ajuste na aba valha na pergunta seguinte, não "depois do deploy".
// Qualquer chave ausente/malformada cai no default — provider e tiers
// mudam rápido e um valor quebrado não pode derrubar o assistente.

import type { SupabaseClient } from "@supabase/supabase-js";

export type EsforcoIa = "baixo" | "medio" | "alto";

export type IaConfig = {
  modelos: { rapido?: string; balanceado?: string; forte?: string; fallbacks?: string[] };
  esforco: EsforcoIa;
  roteamento: boolean;
};

const PADRAO: IaConfig = {
  modelos: {},
  esforco: "medio",
  roteamento: true,
};

const ESFORCOS = new Set<EsforcoIa>(["baixo", "medio", "alto"]);

export async function getIaConfig(supabase: SupabaseClient): Promise<IaConfig> {
  const { data, error } = await supabase
    .from("ia_config")
    .select("chave, valor");
  if (error || !data) return PADRAO;

  const cfg: IaConfig = { ...PADRAO, modelos: {} };
  for (const row of data as { chave: string; valor: unknown }[]) {
    if (row.chave === "modelos" && row.valor && typeof row.valor === "object") {
      const m = row.valor as Record<string, unknown>;
      cfg.modelos = {
        rapido: typeof m.rapido === "string" ? m.rapido : undefined,
        balanceado: typeof m.balanceado === "string" ? m.balanceado : undefined,
        forte: typeof m.forte === "string" ? m.forte : undefined,
        fallbacks: Array.isArray(m.fallbacks)
          ? m.fallbacks.filter((f): f is string => typeof f === "string")
          : [],
      };
    } else if (row.chave === "esforco" && typeof row.valor === "string") {
      const v = row.valor as EsforcoIa;
      if (ESFORCOS.has(v)) cfg.esforco = v;
    } else if (row.chave === "roteamento" && typeof row.valor === "boolean") {
      cfg.roteamento = row.valor;
    }
  }
  return cfg;
}

/** Tier → slug concreto: config vazia cai no IA_MODEL do ambiente —
 *  o env continua sendo o piso que garante o assistente de pé. */
export function modeloDoTier(
  cfg: IaConfig,
  tier: "rapido" | "balanceado" | "forte"
): string {
  const slug = cfg.modelos[tier];
  return slug && slug.trim() ? slug : (process.env.IA_MODEL ?? "");
}
