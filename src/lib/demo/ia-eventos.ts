// Dataset demo da /ia: eventos de ia_eventos plausíveis e determinísticos:
// a mesma renderização em /demo mostra sempre o mesmo recorte (seed por dia),
// com dois picos e um modelo apertando o teto do plano.
// Perfis: Marina (coord, uid 0001), Paulo (supervisor 0002), Ricardo
// (mentor_dpp 0003) e Sofia (especialista 0004) — os mesmos do dataset demo.

import type { IaEventoRow } from "@/lib/ia/metricas";
import type { IaConfig, PlanoIa } from "@/lib/ia/config";

export const uid = (n: number): string =>
  `de000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

const PESSOAS = [uid(1), uid(2), uid(3), uid(4)];
export const DEMO_IA_NOMES = new Map<string, string>([
  [uid(1), "Marina Duarte"],
  [uid(2), "Paulo Serra"],
  [uid(3), "Ricardo Tavares"],
  [uid(4), "Sofia Nogueira"],
]);

// tier → modelo como no seed da 0148 (rápido glm-5.3-flash, balanceado
// deepseek-v4.1-flash, forte deepseek-v4-pro) + um fallback ocasional do
// balanceado. Preço por milhão de tokens (US$) é o que vira allowance:
// dentro do Go o custo cobrado é ~0 e o plano desconta o preço de tabela.
// O forte lê contexto longo (análises): é ele que aperta o teto de US$ 15
// e fica em "atenção" na previsão.
const TIERS = [
  {
    t: "rapido", peso: 0.27, slug: "glm-5.3-flash", ms: [1800, 4200],
    tin: [1800, 5000], tout: [60, 260], preco: { in: 0.1, out: 0.4 },
  },
  {
    t: "balanceado", peso: 0.45, slug: "deepseek-v4.1-flash", ms: [4200, 7800],
    tin: [6000, 18000], tout: [180, 700], preco: { in: 0.14, out: 0.28 },
  },
  {
    t: "forte", peso: 0.28, slug: "deepseek-v4-pro", ms: [9000, 16000],
    tin: [30000, 72000], tout: [600, 1800], preco: { in: 4, out: 16 },
  },
] as const;
const FALLBACK = { slug: "mimo-v2.6-flash", ms: [8800, 14000], preco: { in: 0.1, out: 0.3 } } as const;

/** Dias de pico (contados de hoje pra trás): fechamento de relatório e
 *  véspera de encontro de formação. Evergreen: sempre a 3 e a 17 dias. */
const PICOS: Record<number, number> = { 3: 2.4, 17: 2 };
const TOOLS = [
  { t: "resumo_semana", peso: 0.3 },
  { t: "ficha_dupla", peso: 0.25 },
  { t: "guia_consulta", peso: 0.2 },
  { t: "chamados_resumo", peso: 0.15 },
  { t: "agenda_do_periodo", peso: 0.1 },
] as const;

/** PRNG determinístico (mulberry32) — mesma seed, mesma sequência.
 *  Exportado pros datasets irmãos (evals demo) derivarem do mesmo motor. */
export function demoRng(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick<T extends { peso: number }>(r: () => number, xs: readonly T[]): T {
  let acc = 0;
  const v = r();
  for (const x of xs) {
    acc += x.peso;
    if (v <= acc) return x;
  }
  return xs[xs.length - 1];
}

/** Gera os eventos do recorte: por dia, N mensagens de pessoas variadas,
 *  cada uma com a resposta-resumo (modelo/tier/tokens/custo realistas) e
 *  algumas tool calls. `dias` = tamanho da janela (o caller passa o filtro). */
export function demoIaEventos(dias: number): IaEventoRow[] {
  const eventos: IaEventoRow[] = [];
  const hoje = new Date();
  const agora = hoje.getTime();
  for (let i = 0; i < dias; i++) {
    const d = new Date(hoje);
    d.setDate(d.getDate() - i);
    const iso = d.toISOString().slice(0, 10);
    const diaNum = Number(iso.replace(/-/g, ""));
    const r = demoRng(diaNum);
    // fim de semana quase não tem uso; dia útil varia 8-19 perguntas e
    // os dias de pico multiplicam
    const dow = d.getDay();
    const fds = dow === 0 || dow === 6;
    const n = Math.round(
      (fds ? Math.floor(r() * 3) : 8 + Math.floor(r() * 12)) * (PICOS[i] ?? 1)
    );
    for (let j = 0; j < n; j++) {
      const pessoa = PESSOAS[Math.floor(r() * (PESSOAS.length - (dow === 0 ? 2 : 0)))];
      const base = new Date(d);
      base.setHours(8 + Math.floor(r() * 11), Math.floor(r() * 60), 0, 0);
      // canal por "conversa" inteira (mensagem→tools→resposta): no real o
      // MCP nunca emite resposta — só mensagem + tool calls (mcp/route).
      // O request_id correla os eventos da conversa (o filtro ?modelo= da
      // /ia casa a cadeia inteira por ele, como no real)
      const canal = r() < 0.9 ? "chat" : "mcp";
      const requestId = uid(5000 + i * 100 + j);
      const t = pick(r, [...TIERS]);
      const fb = t.t === "balanceado" && r() < 0.06;
      const m = fb ? { ...FALLBACK } : { slug: t.slug, ms: t.ms, preco: t.preco };
      const ms = Math.round(m.ms[0] + r() * (m.ms[1] - m.ms[0]));
      // pergunta que ainda não "aconteceu" hoje fica de fora
      if (base.getTime() + ms > agora) continue;
      eventos.push({
        profile_id: pessoa, canal, tool: "mensagem", request_id: requestId,
        ok: true, args: { n_mensagens: 1 }, duracao_ms: 0,
        modelo: null, tier: null, tokens_in: null, tokens_out: null,
        tokens_reasoning: null, cache_read: null, custo_usd: null,
        allowance_usd: null, billing_source: null, iteracoes: null,
        created_at: base.toISOString(),
      });
      const tin = Math.round(t.tin[0] + r() * (t.tin[1] - t.tin[0]));
      const tout = Math.round(t.tout[0] + r() * (t.tout[1] - t.tout[0]));
      const falhou = r() < 0.04;
      const nTools = falhou ? 0 : r() < 0.4 ? 0 : r() < 0.8 ? 1 : 2;
      const toolsUsadas: string[] = [];
      for (let k = 0; k < nTools; k++) {
        const tool = pick(r, [...TOOLS]).t;
        toolsUsadas.push(tool);
        eventos.push({
          profile_id: pessoa, canal, tool, request_id: requestId,
          ok: r() > 0.06, args: {}, duracao_ms: Math.round(180 + r() * 1400),
          modelo: null, tier: null, tokens_in: null, tokens_out: null,
          tokens_reasoning: null, cache_read: null, custo_usd: null,
          allowance_usd: null, billing_source: null, iteracoes: null,
          created_at: new Date(base.getTime() + 200 + k * 900).toISOString(),
        });
      }
      const reasoning = t.t === "forte" ? Math.round(300 + r() * 1200) : null;
      const allowance =
        (tin * m.preco.in + (tout + (reasoning ?? 0)) * m.preco.out) / 1e6;
      if (canal === "chat")
      eventos.push({
        profile_id: pessoa, canal, tool: "resposta", request_id: requestId,
        ok: !falhou, args: { tools: toolsUsadas, list_cost: allowance },
        duracao_ms: ms, modelo: m.slug, tier: t.t,
        tokens_in: tin, tokens_out: tout,
        tokens_reasoning: reasoning,
        cache_read: Math.round(tin * r() * 0.4),
        // dentro do Go o cobrado fica ~0; o plano desconta o de tabela
        custo_usd: 0, allowance_usd: allowance,
        billing_source: "go", iteracoes: nTools + 1,
        created_at: new Date(base.getTime() + ms).toISOString(),
      });
    }
  }
  return eventos.sort((a, b) => b.created_at.localeCompare(a.created_at));
}

/** Plano da demo: Go com renovação 12 dias atrás (ciclo no meio, data
 *  evergreen); dia ≤ 28 pra não cair na regra de mês curto. */
export function demoIaPlano(): PlanoIa {
  const d = new Date();
  d.setDate(d.getDate() - 12);
  return { plano: "go", diaRenovacao: Math.min(d.getDate(), 28), tetos: {} };
}

/** Config viva da demo — o que a aba de ajustes da bolha mostra quando
 *  `demo` (REALIZA-382). Espelha o seed da 0148 com um toque de uso: o
 *  balanceado já tem um fallback configurado e o esforço está ajustado
 *  por tier, então cada controle do painel aparece com valor de exemplo
 *  (o seed cru deixaria os três em "medio" e as cadeias vazias). */
export function demoIaConfig(): IaConfig {
  return {
    modelos: {
      rapido: "glm-5.3-flash",
      balanceado: "deepseek-v4.1-flash",
      forte: "deepseek-v4-pro",
      fallbacks: {
        rapido: [],
        balanceado: ["mimo-v2.6-flash"],
        forte: [],
      },
    },
    esforco: { rapido: "baixo", balanceado: "medio", forte: "alto" },
    roteamento: true,
    busca: "hibrida",
    plano: demoIaPlano(),
  };
}

/** Catálogo de slugs que a aba de ajustes lista em demo — recorte da
 *  tabela do plano (os usados nos eventos + vizinhos prováveis). */
export const DEMO_IA_CATALOGO: string[] = [
  "claude-haiku-5-5",
  "deepseek-v4-pro",
  "deepseek-v4.1-flash",
  "gemini-4-argon",
  "glm-5.2",
  "glm-5.3-flash",
  "gpt-6-luna",
  "kimi-k3",
  "longcat-2.0",
  "mimo-v2.5",
  "mimo-v2.6-flash",
  "mimo-v2.6-pro",
  "minimax-m3.1-flash",
  "qwen3.8-flash",
];

/** Probe de saúde por slug em demo — os três tiers sadios nos tempos que
 *  o seed da 0148 registra (~0,9s / ~2,2s / ~2,4s) e o fallback lento
 *  (ttft ~10s no eval de out/2026) marcando âmbar de propósito. */
export const DEMO_IA_SAUDE: Record<
  string,
  { ok: boolean; ms: number; status: number }
> = {
  "glm-5.3-flash": { ok: true, ms: 890, status: 200 },
  "deepseek-v4.1-flash": { ok: true, ms: 2180, status: 200 },
  "deepseek-v4-pro": { ok: true, ms: 2410, status: 200 },
  "mimo-v2.6-flash": { ok: true, ms: 9820, status: 200 },
};
