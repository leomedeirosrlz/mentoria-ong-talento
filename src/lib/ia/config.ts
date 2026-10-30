// Resolução da configuração viva do assistente (ia_config, 0148).
// Lida uma vez por request na rota — uma query de 3 linhas numa tabela
// de 3 chaves; sem cache de módulo porque a coordenação espera que o
// ajuste na aba valha na pergunta seguinte, não "depois do deploy".
// Qualquer chave ausente/malformada cai no default — provider e tiers
// mudam rápido e um valor quebrado não pode derrubar o assistente.

import type { SupabaseClient } from "@supabase/supabase-js";

export type EsforcoIa = "baixo" | "medio" | "alto";
export type TierIa = "rapido" | "balanceado" | "forte";

export type IaConfig = {
  modelos: Partial<Record<TierIa, string>> & {
    /** cadeia ordenada por tier: [0] é a 1ª tentativa após o primário;
     *  o formato legado (array solto) vale pros três tiers na mesma ordem */
    fallbacks?: Partial<Record<TierIa, string[]>> | string[];
  };
  /** esforço por tier (controle granular): chave ausente cai em "medio";
   *  a chave `esforco` no banco aceita objeto por-tier ou string legada
   *  (mesmo nível pros três — formato do seed da 0148) */
  esforco: Record<TierIa, EsforcoIa>;
  roteamento: boolean;
};

const PADRAO: IaConfig = {
  modelos: {},
  esforco: { rapido: "medio", balanceado: "medio", forte: "medio" },
  roteamento: true,
};

const ESFORCOS = new Set<EsforcoIa>(["baixo", "medio", "alto"]);
const TIERS: readonly TierIa[] = ["rapido", "balanceado", "forte"];

export async function getIaConfig(supabase: SupabaseClient): Promise<IaConfig> {
  const { data, error } = await supabase
    .from("ia_config")
    .select("chave, valor");
  if (error || !data) return PADRAO;

  const cfg: IaConfig = { ...PADRAO, modelos: {}, esforco: { ...PADRAO.esforco } };
  for (const row of data as { chave: string; valor: unknown }[]) {
    if (row.chave === "modelos" && row.valor && typeof row.valor === "object") {
      const m = row.valor as Record<string, unknown>;
      cfg.modelos = {
        rapido: typeof m.rapido === "string" ? m.rapido : undefined,
        balanceado: typeof m.balanceado === "string" ? m.balanceado : undefined,
        forte: typeof m.forte === "string" ? m.forte : undefined,
        fallbacks: (() => {
          const f = m.fallbacks;
          const strs = (v: unknown) =>
            Array.isArray(v) ? v.filter((s): s is string => typeof s === "string") : [];
          if (Array.isArray(f)) return strs(f); // legado: mesma ordem pros 3 tiers
          if (f && typeof f === "object") {
            const o = f as Record<string, unknown>;
            return { rapido: strs(o.rapido), balanceado: strs(o.balanceado), forte: strs(o.forte) };
          }
          return {};
        })(),
      };
    } else if (row.chave === "esforco") {
      if (typeof row.valor === "string") {
        // formato legado ("medio" pra todos) — ainda aceito, a UI
        // converte pra objeto no primeiro toque por tier
        const v = row.valor as EsforcoIa;
        if (ESFORCOS.has(v)) for (const t of TIERS) cfg.esforco[t] = v;
      } else if (row.valor && typeof row.valor === "object") {
        const e = row.valor as Record<string, unknown>;
        for (const t of TIERS) {
          const v = e[t] as EsforcoIa;
          if (ESFORCOS.has(v)) cfg.esforco[t] = v;
        }
      }
    } else if (row.chave === "roteamento" && typeof row.valor === "boolean") {
      cfg.roteamento = row.valor;
    }
  }
  return cfg;
}

/** Tier → slug concreto: config vazia cai no IA_MODEL do ambiente —
 *  o env continua sendo o piso que garante o assistente de pé. */
export function modeloDoTier(cfg: IaConfig, tier: TierIa): string {
  const slug = cfg.modelos[tier];
  return slug && slug.trim() ? slug : (process.env.IA_MODEL ?? "");
}

/** Tier → nível de esforço: granular por tier, default "medio". */
export function esforcoDoTier(cfg: IaConfig, tier: TierIa): EsforcoIa {
  return cfg.esforco[tier] ?? "medio";
}

/** Tier → cadeia de fallback ordenada, sem o primário e sem repetição. */
export function fallbacksDoTier(cfg: IaConfig, tier: TierIa): string[] {
  const f = cfg.modelos.fallbacks;
  const lista = Array.isArray(f) ? f : (f?.[tier] ?? []);
  const primario = cfg.modelos[tier];
  return [...new Set(lista)].filter((s) => s && s !== primario);
}
