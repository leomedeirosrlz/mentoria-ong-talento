// Agregações do painel /ia (sdd D4, pacote liza nov/2026): puro sobre as
// linhas de ia_eventos — a página traz os eventos do período e este módulo
// resume. Sem query aqui: dá pra testar com fixture e o demo reuse o mesmo
// caminho.
//
// Três papéis de evento (0159):
//   'mensagem'  — reserva do rate limit, uma por request aceita (request_id)
//   'resposta'  — resumo da request: modelo efetivo, tier, tokens por tipo,
//                 custo/allowance do Go, duração real, iterações
//   <tool>      — execução de ferramenta, com duração e ok

import { toDateStr } from "@/lib/ciclo";

export type IaEventoRow = {
  profile_id: string | null;
  canal: string;
  tool: string;
  request_id: string | null;
  ok: boolean;
  args: Record<string, unknown> | null;
  duracao_ms: number | null;
  modelo: string | null;
  tier: string | null;
  tokens_in: number | null;
  tokens_out: number | null;
  tokens_reasoning: number | null;
  cache_read: number | null;
  custo_usd: number | null;
  allowance_usd: number | null;
  billing_source: string | null;
  iteracoes: number | null;
  created_at: string;
};

export type LinhaModelo = {
  modelo: string;
  respostas: number;
  tokensOut: number;
  custo: number;
  msMedio: number | null;
};
export type LinhaTool = {
  tool: string;
  chamadas: number;
  erroRate: number;
  msMedio: number | null;
};
export type LinhaPessoa = {
  profileId: string;
  mensagens: number;
  tokensOut: number;
  custo: number;
};
export type PontoSerie = { dia: string; mensagens: number };

export type IaMetricas = {
  mensagens: number;
  respostas: number;
  respostasOk: number;
  erroRate: number;
  abortadas: number;
  tokensIn: number;
  tokensOut: number;
  tokensReasoning: number;
  cacheRead: number;
  custoUsd: number;
  allowanceUsd: number;
  listCostUsd: number;
  msMedio: number | null;
  msP95: number | null;
  iterMedia: number | null;
  porModelo: LinhaModelo[];
  porTier: { tier: string; respostas: number }[];
  porCanal: { canal: string; mensagens: number }[];
  topTools: LinhaTool[];
  porPessoa: LinhaPessoa[];
  serie: PontoSerie[];
};

function media(nums: number[]): number | null {
  return nums.length ? Math.round(nums.reduce((a, b) => a + b, 0) / nums.length) : null;
}

function percentil(nums: number[], p: number): number | null {
  if (!nums.length) return null;
  const s = [...nums].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.ceil((p / 100) * s.length) - 1)];
}

function num(v: unknown): number {
  return typeof v === "number" && Number.isFinite(v) ? v : 0;
}

/** Recorte da página /ia por canal + modelo. O canal vale pra todo evento;
 *  o modelo casa pela request: `modelo` só existe no evento 'resposta', e
 *  mensagem/tools da mesma request dividem o request_id com ela — filtrar
 *  `e.modelo` direto deixava a pergunta órfã e apagava as tools. Evento
 *  sem request_id não tem como provar a cadeia e sai do recorte. */
export function filtrarEventosIa(
  eventos: IaEventoRow[],
  canal: string,
  modelo: string | null
): IaEventoRow[] {
  const porCanal =
    canal === "todos" ? eventos : eventos.filter((e) => e.canal === canal);
  if (!modelo) return porCanal;
  const requestIds = new Set(
    porCanal
      .filter(
        (e) => e.tool === "resposta" && e.modelo === modelo && e.request_id
      )
      .map((e) => e.request_id as string)
  );
  return porCanal.filter(
    (e) => e.request_id != null && requestIds.has(e.request_id)
  );
}

/** Agrega os eventos do recorte. `dias` só serve pra completar os dias sem
 *  movimento na série (zero, não buraco). */
export function metricasIa(eventos: IaEventoRow[], dias: number): IaMetricas {
  const mensagens = eventos.filter((e) => e.tool === "mensagem");
  const respostas = eventos.filter((e) => e.tool === "resposta");
  const toolCalls = eventos.filter((e) => e.tool !== "mensagem" && e.tool !== "resposta");

  const latencias = respostas.map((r) => r.duracao_ms).filter((v): v is number => v != null);
  const iters = respostas.map((r) => r.iteracoes).filter((v): v is number => v != null);

  const porModeloMap = new Map<string, LinhaModelo>();
  for (const r of respostas) {
    const m = r.modelo ?? "desconhecido";
    const l =
      porModeloMap.get(m) ??
      { modelo: m, respostas: 0, tokensOut: 0, custo: 0, msMedio: null, _lat: [] as number[] };
    l.respostas++;
    l.tokensOut += num(r.tokens_out);
    l.custo += num(r.custo_usd);
    (l as { _lat: number[] })._lat.push(...(r.duracao_ms != null ? [r.duracao_ms] : []));
    porModeloMap.set(m, l);
  }
  const porModelo = [...porModeloMap.values()]
    .map((l) => ({ ...l, msMedio: media((l as { _lat?: number[] })._lat ?? []) }))
    .sort((a, b) => b.respostas - a.respostas);

  const porTierMap = new Map<string, number>();
  for (const r of respostas) {
    const t = r.tier ?? "legado";
    porTierMap.set(t, (porTierMap.get(t) ?? 0) + 1);
  }
  const porTier = [...porTierMap.entries()]
    .map(([tier, respostas]) => ({ tier, respostas }))
    .sort((a, b) => b.respostas - a.respostas);

  const porCanalMap = new Map<string, number>();
  for (const m of mensagens) {
    porCanalMap.set(m.canal, (porCanalMap.get(m.canal) ?? 0) + 1);
  }
  const porCanal = [...porCanalMap.entries()]
    .map(([canal, mensagens]) => ({ canal, mensagens }))
    .sort((a, b) => b.mensagens - a.mensagens);

  const toolMap = new Map<string, { chamadas: number; erros: number; lat: number[] }>();
  for (const t of toolCalls) {
    const l = toolMap.get(t.tool) ?? { chamadas: 0, erros: 0, lat: [] };
    l.chamadas++;
    if (!t.ok) l.erros++;
    if (t.duracao_ms != null) l.lat.push(t.duracao_ms);
    toolMap.set(t.tool, l);
  }
  const topTools = [...toolMap.entries()]
    .map(([tool, l]) => ({
      tool,
      chamadas: l.chamadas,
      erroRate: l.chamadas ? l.erros / l.chamadas : 0,
      msMedio: media(l.lat),
    }))
    .sort((a, b) => b.chamadas - a.chamadas);

  const pessoaMap = new Map<string, LinhaPessoa>();
  for (const m of mensagens) {
    if (!m.profile_id) continue;
    const l =
      pessoaMap.get(m.profile_id) ??
      { profileId: m.profile_id, mensagens: 0, tokensOut: 0, custo: 0 };
    l.mensagens++;
    pessoaMap.set(m.profile_id, l);
  }
  // tokens/custo por pessoa chegam via request_id — a resposta não carrega
  // profile_id legível? carrega sim (mesmo dono); soma direto nela
  for (const r of respostas) {
    if (!r.profile_id) continue;
    const l =
      pessoaMap.get(r.profile_id) ??
      { profileId: r.profile_id, mensagens: 0, tokensOut: 0, custo: 0 };
    l.tokensOut += num(r.tokens_out);
    l.custo += num(r.custo_usd);
    pessoaMap.set(r.profile_id, l);
  }
  const porPessoa = [...pessoaMap.values()]
    .sort((a, b) => b.mensagens - a.mensagens)
    .slice(0, 10);

  // série diária: um ponto por dia do período, zero onde não houve mensagem.
  // O dia é civil em America/Sao_Paulo (toDateStr do ciclo) — o corte UTC
  // jogava evento das 21h-23h59 de Brasília pro dia seguinte. O eixo anda
  // em saltos de 24h: sem DST no fuso, o dia SP do instante-i é o SP de hoje
  // menos i dias, sem precisar de setDate no fuso local do servidor.
  const porDia = new Map<string, number>();
  for (const m of mensagens) {
    const dia = toDateStr(new Date(m.created_at));
    porDia.set(dia, (porDia.get(dia) ?? 0) + 1);
  }
  const serie: PontoSerie[] = [];
  const agora = Date.now();
  for (let i = dias - 1; i >= 0; i--) {
    const iso = toDateStr(new Date(agora - i * 86400_000));
    serie.push({ dia: iso, mensagens: porDia.get(iso) ?? 0 });
  }

  const respostasOk = respostas.filter((r) => r.ok).length;
  return {
    mensagens: mensagens.length,
    respostas: respostas.length,
    respostasOk,
    erroRate: respostas.length ? (respostas.length - respostasOk) / respostas.length : 0,
    abortadas: respostas.filter((r) => !r.ok && r.args && (r.args as { erro?: string }).erro === "abort").length,
    tokensIn: respostas.reduce((s, r) => s + num(r.tokens_in), 0),
    tokensOut: respostas.reduce((s, r) => s + num(r.tokens_out), 0),
    tokensReasoning: respostas.reduce((s, r) => s + num(r.tokens_reasoning), 0),
    cacheRead: respostas.reduce((s, r) => s + num(r.cache_read), 0),
    custoUsd: respostas.reduce((s, r) => s + num(r.custo_usd), 0),
    allowanceUsd: respostas.reduce((s, r) => s + num(r.allowance_usd), 0),
    listCostUsd: respostas.reduce((s, r) => s + num(r.args?.list_cost), 0),
    msMedio: media(latencias),
    msP95: percentil(latencias, 95),
    iterMedia: iters.length ? Math.round((iters.reduce((a, b) => a + b, 0) / iters.length) * 10) / 10 : null,
    porModelo,
    porTier,
    porCanal,
    topTools,
    porPessoa,
    serie,
  };
}
