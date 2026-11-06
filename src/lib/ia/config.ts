// Resolução da configuração viva do assistente (ia_config, 0148).
// Cache de 30s por instância (cache.ts): a rota e a guia_consulta liam a
// tabela a cada mensagem e a cada busca. 30s é o atraso máximo pra um
// ajuste da coordenação valer — "na pergunta seguinte" na prática, sem
// uma query por mensagem. O editor grava direto pelo client do browser,
// então não há ponto no servidor pra invalidar antes do TTL.
// Qualquer chave ausente/malformada cai no default — provider e tiers
// mudam rápido e um valor quebrado não pode derrubar o assistente.

import type { SupabaseClient } from "@supabase/supabase-js";
import { CacheTtl } from "./cache";

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
  /** chave "busca": "fts" desliga o braço vetorial (nenhuma pergunta vai
   *  pra API de embedding); qualquer outro valor = híbrida */
  busca: "fts" | "hibrida";
};

const PADRAO: IaConfig = {
  modelos: {},
  esforco: { rapido: "medio", balanceado: "medio", forte: "medio" },
  roteamento: true,
  busca: "hibrida",
};

const CONFIG_TTL_MS = 30_000;
const cacheConfig = new CacheTtl<IaConfig>(CONFIG_TTL_MS, 1);

/** Testes e scripts: começa do zero (o cache é por módulo). */
export function limparCacheIaConfig() {
  cacheConfig.limpar();
}

const ESFORCOS = new Set<EsforcoIa>(["baixo", "medio", "alto"]);
const TIERS: readonly TierIa[] = ["rapido", "balanceado", "forte"];

/** Config viva — global (igual pra todo mundo), por isso cacheável. Erro
 *  de leitura cai no padrão e NÃO é guardado: a próxima chamada relê. */
export async function getIaConfig(supabase: SupabaseClient): Promise<IaConfig> {
  let falhou = false;
  return cacheConfig.obter(
    "cfg",
    async () => {
      const r = await lerIaConfig(supabase);
      falhou = r === null;
      return r ?? PADRAO;
    },
    () => !falhou
  );
}

async function lerIaConfig(
  supabase: SupabaseClient
): Promise<IaConfig | null> {
  const { data, error } = await supabase
    .from("ia_config")
    .select("chave, valor");
  if (error || !data) return null;

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
    } else if (row.chave === "busca") {
      cfg.busca = row.valor === "fts" ? "fts" : "hibrida";
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
