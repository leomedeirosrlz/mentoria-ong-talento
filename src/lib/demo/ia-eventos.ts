// Dataset demo da /ia: eventos de ia_eventos plausíveis e determinísticos —
// a mesma renderização em /demo mostra sempre o mesmo recorte (seed por dia).
// Perfis: Marina (coord, uid 0001), Paulo (supervisor 0002), Ricardo
// (mentor_dpp 0003) e Sofia (especialista 0004) — os mesmos do dataset demo.

import type { IaEventoRow } from "@/lib/ia/metricas";

const uid = (n: number): string =>
  `de000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

const PESSOAS = [uid(1), uid(2), uid(3), uid(4)];
export const DEMO_IA_NOMES = new Map<string, string>([
  [uid(1), "Marina Duarte"],
  [uid(2), "Paulo Serra"],
  [uid(3), "Ricardo Tavares"],
  [uid(4), "Sofia Nogueira"],
]);

const MODELOS = [
  { slug: "deepseek-v4.1-flash", peso: 0.62, ms: [4200, 7800] },
  { slug: "glm-4.6", peso: 0.26, ms: [5500, 9800] },
  { slug: "qwen3-32b", peso: 0.12, ms: [8800, 14000] },
] as const;
const TIERS = [
  { t: "balanceado", peso: 0.55 },
  { t: "rapido", peso: 0.3 },
  { t: "forte", peso: 0.15 },
] as const;
const TOOLS = [
  { t: "resumo_semana", peso: 0.3 },
  { t: "ficha_dupla", peso: 0.25 },
  { t: "guia_consulta", peso: 0.2 },
  { t: "chamados_resumo", peso: 0.15 },
  { t: "agenda_do_periodo", peso: 0.1 },
] as const;

/** PRNG determinístico (mulberry32) — mesma seed, mesma sequência. */
function rng(seed: number) {
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
  for (let i = 0; i < dias; i++) {
    const d = new Date(hoje);
    d.setDate(d.getDate() - i);
    const iso = d.toISOString().slice(0, 10);
    const diaNum = Number(iso.replace(/-/g, ""));
    const r = rng(diaNum);
    // fim de semana quase não tem uso; dia útil varia 2-9 mensagens
    const dow = d.getDay();
    const n = dow === 0 || dow === 6 ? Math.floor(r() * 2) : 2 + Math.floor(r() * 8);
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
      eventos.push({
        profile_id: pessoa, canal, tool: "mensagem", request_id: requestId,
        ok: true, args: { n_mensagens: 1 }, duracao_ms: 0,
        modelo: null, tier: null, tokens_in: null, tokens_out: null,
        tokens_reasoning: null, cache_read: null, custo_usd: null,
        allowance_usd: null, billing_source: null, iteracoes: null,
        created_at: base.toISOString(),
      });
      const m = pick(r, [...MODELOS]);
      const t = pick(r, [...TIERS]);
      const ms = Math.round(m.ms[0] + r() * (m.ms[1] - m.ms[0]));
      const tin = Math.round(3000 + r() * 14000);
      const tout = Math.round(80 + r() * 500);
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
      if (canal === "chat")
      eventos.push({
        profile_id: pessoa, canal, tool: "resposta", request_id: requestId,
        ok: !falhou, args: { tools: toolsUsadas, list_cost: tout * 0.000009 },
        duracao_ms: ms, modelo: m.slug, tier: t.t,
        tokens_in: tin, tokens_out: tout,
        tokens_reasoning: t.t === "forte" ? Math.round(200 + r() * 900) : null,
        cache_read: Math.round(tin * r() * 0.4),
        custo_usd: tout * 0.0000075, allowance_usd: tout * 0.0000075,
        billing_source: "go", iteracoes: nTools + 1,
        created_at: new Date(base.getTime() + ms).toISOString(),
      });
    }
  }
  return eventos.sort((a, b) => b.created_at.localeCompare(a.created_at));
}
