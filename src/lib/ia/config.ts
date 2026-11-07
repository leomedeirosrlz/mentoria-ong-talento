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
  /** chave "plano": assinatura do opencode Go + dia de renovação +
   *  tetos por modelo sobrescritos pela coordenação (painel /ia) */
  plano: PlanoIa;
};

export type PlanoGo = "go" | "go_plus" | "go_teams";

export type PlanoIa = {
  plano: PlanoGo;
  /** dia do mês em que o ciclo renova (1..31; mês curto usa o último
   *  dia). null = não informado: a previsão cai nos últimos 30 dias */
  diaRenovacao: number | null;
  /** slug → teto mensal em US$ — só os que a coordenação sobrescreveu;
   *  o resto vem da tabela do plano (tetoDoModelo) */
  tetos: Record<string, number>;
};

export const PLANOS_GO: { chave: PlanoGo; rotulo: string }[] = [
  { chave: "go", rotulo: "Go" },
  { chave: "go_plus", rotulo: "Go Plus" },
  { chave: "go_teams", rotulo: "Go Teams" },
];

/** Teto mensal por modelo no plano Go (US$), da doc oficial
 *  (opencode.ai/docs/go, conferida em 06/11/2026), indexado pelo slug que
 *  o endpoint /models devolve e que fica em ia_eventos.modelo. A janela
 *  de 5h vale 20% disso e a semanal 50%. Modelo fora da tabela = sem teto
 *  conhecido (os *-free, por exemplo). mimo-v2.5 e mimo-v2.5-pro não
 *  aparecem no /models de hoje: slug deduzido do padrão dos irmãos. */
export const TETOS_GO_USD: Readonly<Record<string, number>> = {
  "glm-5.3-flash": 60,
  "glm-5.3": 15,
  "glm-5.2": 60,
  "kimi-k3.1-pro": 15,
  "kimi-k3": 15,
  "kimi-k2.7-code": 60,
  "longcat-2.0": 60,
  "step-5-preview": 15,
  "mimo-v2.6-flash": 60,
  "mimo-v2.6-pro": 15,
  "mimo-v2.5": 60,
  "mimo-v2.5-pro": 15,
  "minimax-m3.1-flash": 20,
  "minimax-m3": 60,
  "muse-spark-1.3-contributor": 60,
  "muse-spark-1.2-contributor": 60,
  "qwen3.8-max": 15,
  "qwen3.8-flash": 30,
  "qwen3.7-plus": 60,
  "deepseek-v4.1-flash": 100,
  "deepseek-v4-pro": 15,
  hy4: 60,
  "hy4-preview": 30,
  hy3: 60,
  "grok-4.7": 15,
  "gpt-6-luna": 15,
  "gpt-5.6-luna": 15,
  "claude-haiku-5-5": 15,
  "gemini-4-argon": 30,
};

/** Teto mensal por modelo no Go Plus (US$), mesma página da doc
 *  (opencode.ai/docs/go, conferida em 06/11/2026) e mesmos slugs da
 *  tabela do Go. As janelas de 5h e da semana seguem 20% e 50%. */
export const TETOS_GO_PLUS_USD: Readonly<Record<string, number>> = {
  "glm-5.3-flash": 180,
  "glm-5.3": 120,
  "glm-5.2": 180,
  "kimi-k3.1-pro": 60,
  "kimi-k3": 60,
  "kimi-k2.7-code": 180,
  "longcat-2.0": 240,
  "step-5-preview": 60,
  "mimo-v2.6-flash": 120,
  "mimo-v2.6-pro": 60,
  "mimo-v2.5": 120,
  "mimo-v2.5-pro": 60,
  "minimax-m3.1-flash": 80,
  "minimax-m3": 180,
  "muse-spark-1.3-contributor": 120,
  "muse-spark-1.2-contributor": 120,
  "qwen3.8-max": 60,
  "qwen3.8-flash": 90,
  "qwen3.7-plus": 180,
  "deepseek-v4.1-flash": 200,
  "deepseek-v4-pro": 60,
  hy4: 240,
  "hy4-preview": 120,
  hy3: 240,
  "grok-4.7": 60,
  "gpt-6-luna": 60,
  "gpt-5.6-luna": 60,
  "claude-haiku-5-5": 60,
  "gemini-4-argon": 120,
};

/** Fração do teto mensal em cada janela curta do Go. */
export const JANELA_5H = 0.2;
export const JANELA_SEMANA = 0.5;

/** Teto mensal do slug no plano: o valor sobrescrito pela coordenação
 *  ganha; senão a tabela do plano (Go, Go Plus, ou Go Teams = Go +
 *  US$ 5 por modelo). null = sem teto conhecido. Prefixo de provider
 *  ("x/slug") é ignorado. */
export function tetoDoModelo(plano: PlanoIa, slug: string): number | null {
  const s = slug.includes("/") ? slug.slice(slug.lastIndexOf("/") + 1) : slug;
  const manual = plano.tetos[slug] ?? plano.tetos[s];
  if (manual != null) return manual;
  if (plano.plano === "go_plus") return TETOS_GO_PLUS_USD[s] ?? null;
  const go = TETOS_GO_USD[s];
  if (go == null) return null;
  return plano.plano === "go_teams" ? go + 5 : go;
}

/** Valor cru da chave "plano" → PlanoIa com defaults seguros: plano
 *  desconhecido vira "go", dia fora de 1..31 vira null, teto que não é
 *  número positivo some. */
export function lerPlanoIa(valor: unknown): PlanoIa {
  const o =
    valor && typeof valor === "object" && !Array.isArray(valor)
      ? (valor as Record<string, unknown>)
      : {};
  const plano = PLANOS_GO.some((p) => p.chave === o.plano)
    ? (o.plano as PlanoGo)
    : "go";
  const d = o.dia_renovacao;
  const diaRenovacao =
    typeof d === "number" && Number.isInteger(d) && d >= 1 && d <= 31 ? d : null;
  const tetos: Record<string, number> = {};
  if (o.tetos && typeof o.tetos === "object" && !Array.isArray(o.tetos)) {
    for (const [slug, v] of Object.entries(o.tetos as Record<string, unknown>))
      if (typeof v === "number" && Number.isFinite(v) && v > 0) tetos[slug] = v;
  }
  return { plano, diaRenovacao, tetos };
}

/** PlanoIa → valor gravado na chave "plano" (snake_case do banco). */
export function planoParaJson(p: PlanoIa) {
  return { plano: p.plano, dia_renovacao: p.diaRenovacao, tetos: p.tetos };
}

const PADRAO: IaConfig = {
  modelos: {},
  esforco: { rapido: "medio", balanceado: "medio", forte: "medio" },
  roteamento: true,
  busca: "hibrida",
  plano: { plano: "go", diaRenovacao: null, tetos: {} },
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
    } else if (row.chave === "plano") {
      cfg.plano = lerPlanoIa(row.valor);
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
