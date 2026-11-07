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
import {
  JANELA_5H,
  JANELA_SEMANA,
  tetoDoModelo,
  type PlanoIa,
} from "@/lib/ia/config";

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
  tokensIn: number;
  tokensOut: number;
  custo: number;
  allowance: number;
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
  allowance: number;
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

  const porModeloMap = new Map<string, LinhaModelo & { _lat: number[] }>();
  for (const r of respostas) {
    const m = r.modelo ?? "desconhecido";
    const l =
      porModeloMap.get(m) ??
      { modelo: m, respostas: 0, tokensIn: 0, tokensOut: 0, custo: 0, allowance: 0, msMedio: null, _lat: [] };
    l.respostas++;
    l.tokensIn += num(r.tokens_in);
    l.tokensOut += num(r.tokens_out);
    l.custo += num(r.custo_usd);
    l.allowance += num(r.allowance_usd);
    if (r.duracao_ms != null) l._lat.push(r.duracao_ms);
    porModeloMap.set(m, l);
  }
  const porModelo = [...porModeloMap.values()]
    .map(({ _lat, ...l }) => ({ ...l, msMedio: media(_lat) }))
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
      { profileId: m.profile_id, mensagens: 0, tokensOut: 0, custo: 0, allowance: 0 };
    l.mensagens++;
    pessoaMap.set(m.profile_id, l);
  }
  // tokens/custo por pessoa chegam via request_id — a resposta não carrega
  // profile_id legível? carrega sim (mesmo dono); soma direto nela
  for (const r of respostas) {
    if (!r.profile_id) continue;
    const l =
      pessoaMap.get(r.profile_id) ??
      { profileId: r.profile_id, mensagens: 0, tokensOut: 0, custo: 0, allowance: 0 };
    l.tokensOut += num(r.tokens_out);
    l.custo += num(r.custo_usd);
    l.allowance += num(r.allowance_usd);
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

// ---------- uso ao longo do tempo (gráficos da /ia) ----------

/** Um ponto dos gráficos: um dia civil (SP) ou uma semana no recorte de
 *  90d. Médias por requisição são null quando o ponto não teve requisição:
 *  buraco honesto no gráfico, nunca zero inventado. */
export type PontoUso = {
  /** primeiro e último dia civil do ponto (iguais no modo diário) */
  inicio: string;
  fim: string;
  /** dias cobertos (a semana mais antiga do 90d pode ser parcial) */
  dias: number;
  requisicoes: number;
  /** requisições por dia: no diário é a própria contagem; na semana é a
   *  média dos dias dela (mesma unidade do eixo nos dois modos) */
  reqPorDia: number;
  /** entrada + saída por requisição */
  tokensPorReq: number | null;
  raciocinioPorReq: number | null;
  /** allowance do Go descontado por requisição (US$) */
  planoPorReq: number | null;
  /** custo cobrado (usage.cost) e preço de tabela por requisição (US$) */
  custoPorReq: number | null;
  tabelaPorReq: number | null;
};

export type SerieUso = {
  agrupamento: "dia" | "semana";
  pontos: PontoUso[];
  requisicoes: number;
  /** médias do período inteiro: requisições/dia sobre todos os dias do
   *  período; as por-requisição são ponderadas (total ÷ requisições),
   *  não média das médias diárias */
  medias: {
    reqPorDia: number;
    tokensPorReq: number | null;
    raciocinioPorReq: number | null;
    planoPorReq: number | null;
    custoPorReq: number | null;
    tabelaPorReq: number | null;
  };
  /** índice do ponto de pico de cada métrica; null sem pico (menos de
   *  dois pontos com dado ou tudo zero) */
  picos: {
    reqPorDia: number | null;
    tokensPorReq: number | null;
    planoPorReq: number | null;
  };
};

/** Acima disso o gráfico agrupa por semana: 90 barras diárias viram fios
 *  ilegíveis no celular. */
const DIAS_AGRUPA_SEMANA = 45;

function pico(valores: (number | null)[]): number | null {
  let idx: number | null = null;
  let max = 0;
  let comDado = 0;
  valores.forEach((v, i) => {
    if (v == null) return;
    comDado++;
    if (v > max) {
      max = v;
      idx = i;
    }
  });
  return comDado >= 2 ? idx : null;
}

/** Série dos gráficos sobre as respostas do recorte. Requisição = evento
 *  'resposta' (o que de fato chamou o modelo e consumiu o plano). Dias
 *  sem requisição entram com zero na contagem e null nas médias. */
export function serieUsoIa(
  eventos: IaEventoRow[],
  dias: number,
  agora: number = Date.now()
): SerieUso {
  type Soma = { n: number; tok: number; rac: number; plano: number; custo: number; tabela: number };
  const vazio = (): Soma => ({ n: 0, tok: 0, rac: 0, plano: 0, custo: 0, tabela: 0 });
  const porDia = new Map<string, Soma>();
  const total = vazio();
  for (const r of eventos) {
    if (r.tool !== "resposta") continue;
    const dia = toDateStr(new Date(r.created_at));
    const s = porDia.get(dia) ?? vazio();
    for (const alvo of [s, total]) {
      alvo.n++;
      alvo.tok += num(r.tokens_in) + num(r.tokens_out);
      alvo.rac += num(r.tokens_reasoning);
      alvo.plano += num(r.allowance_usd);
      alvo.custo += num(r.custo_usd);
      alvo.tabela += num(r.args?.list_cost);
    }
    porDia.set(dia, s);
  }

  const diasLista: string[] = [];
  for (let i = dias - 1; i >= 0; i--) diasLista.push(toDateStr(new Date(agora - i * 86400_000)));

  // semanas contadas de hoje pra trás: a última termina hoje e a mais
  // antiga fica com o resto (90 = 6 + 12×7)
  const agrupamento = dias > DIAS_AGRUPA_SEMANA ? "semana" : "dia";
  const grupos: string[][] = [];
  if (agrupamento === "dia") for (const d of diasLista) grupos.push([d]);
  else
    for (let fim = diasLista.length; fim > 0; fim -= 7)
      grupos.unshift(diasLista.slice(Math.max(0, fim - 7), fim));

  const por = (v: number, n: number) => (n ? v / n : null);
  const pontos: PontoUso[] = grupos.map((g) => {
    const s = vazio();
    for (const d of g) {
      const x = porDia.get(d);
      if (!x) continue;
      s.n += x.n;
      s.tok += x.tok;
      s.rac += x.rac;
      s.plano += x.plano;
      s.custo += x.custo;
      s.tabela += x.tabela;
    }
    return {
      inicio: g[0],
      fim: g[g.length - 1],
      dias: g.length,
      requisicoes: s.n,
      reqPorDia: s.n / g.length,
      tokensPorReq: por(s.tok, s.n),
      raciocinioPorReq: por(s.rac, s.n),
      planoPorReq: por(s.plano, s.n),
      custoPorReq: por(s.custo, s.n),
      tabelaPorReq: por(s.tabela, s.n),
    };
  });

  return {
    agrupamento,
    pontos,
    requisicoes: total.n,
    medias: {
      reqPorDia: dias ? total.n / dias : 0,
      tokensPorReq: por(total.tok, total.n),
      raciocinioPorReq: por(total.rac, total.n),
      planoPorReq: por(total.plano, total.n),
      custoPorReq: por(total.custo, total.n),
      tabelaPorReq: por(total.tabela, total.n),
    },
    picos: {
      reqPorDia: pico(pontos.map((p) => (p.requisicoes ? p.reqPorDia : null))),
      tokensPorReq: pico(pontos.map((p) => p.tokensPorReq)),
      planoPorReq: pico(pontos.map((p) => p.planoPorReq)),
    },
  };
}

// ---------- previsão do plano Go ----------

/** Linha mínima pra previsão: só o que a query enxuta traz. */
export type ConsumoPlanoRow = {
  modelo: string | null;
  allowance_usd: number | null;
  created_at: string;
};

/** Ciclo sem dia de renovação informado: olha os últimos 30 dias. */
export const CICLO_PADRAO_DIAS = 30;
/** Ritmo = média por dia dos últimos 7 dias (o uso recente pesa mais que
 *  o começo do ciclo, e é a mesma janela do limite semanal). */
export const RITMO_DIAS = 7;
/** Projeção ≥ 80% do teto (ou janela curta ≥ 80% do limite) = atenção. */
export const LIMIAR_ATENCAO = 0.8;

const DIA_MS = 86400_000;

function ultimoDiaDoMes(ano: number, mes: number): number {
  return new Date(Date.UTC(ano, mes, 0)).getUTCDate();
}
const iso = (ano: number, mes: number, dia: number) =>
  `${ano}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;

/** Início e próxima renovação do ciclo mensal (dias civis). Mês curto
 *  renova no último dia: dia 31 em fevereiro vira 28/29. */
export function cicloDoPlano(
  diaRenovacao: number,
  hoje: string
): { inicio: string; renovacao: string } {
  const [a, m, d] = hoje.split("-").map(Number);
  const diaNoMes = (ano: number, mes: number) =>
    Math.min(diaRenovacao, ultimoDiaDoMes(ano, mes));
  const anterior = m === 1 ? [a - 1, 12] : [a, m - 1];
  const proximo = m === 12 ? [a + 1, 1] : [a, m + 1];
  if (d >= diaNoMes(a, m))
    return {
      inicio: iso(a, m, diaNoMes(a, m)),
      renovacao: iso(proximo[0], proximo[1], diaNoMes(proximo[0], proximo[1])),
    };
  return {
    inicio: iso(anterior[0], anterior[1], diaNoMes(anterior[0], anterior[1])),
    renovacao: iso(a, m, diaNoMes(a, m)),
  };
}

/** Meia-noite de Brasília do dia civil (sem horário de verão desde 2019).
 *  O horário real da renovação não é publicado: meia-noite é a hipótese. */
export function inicioDoDiaSp(dia: string): number {
  return new Date(`${dia}T00:00:00-03:00`).getTime();
}

/** Desde quando a previsão precisa de eventos: o começo do ciclo ou 7
 *  dias atrás (o que vier antes) — o ritmo olha 7 dias mesmo no começo
 *  do ciclo. Sem dia de renovação: 30 dias. */
export function inicioConsultaPlano(
  diaRenovacao: number | null,
  agora: number = Date.now()
): number {
  const seteDias = agora - RITMO_DIAS * DIA_MS;
  if (diaRenovacao == null) return Math.min(agora - CICLO_PADRAO_DIAS * DIA_MS, seteDias);
  const { inicio } = cicloDoPlano(diaRenovacao, toDateStr(new Date(agora)));
  return Math.min(inicioDoDiaSp(inicio), seteDias);
}

export type StatusPlano = "folga" | "atencao" | "estoura" | "sem_teto";

export type UsoJanela = { usado: number; limite: number | null };

export type PrevisaoModelo = {
  modelo: string;
  teto: number | null;
  janela5h: UsoJanela;
  semana: UsoJanela;
  ciclo: UsoJanela;
  /** US$/dia nos últimos 7 dias e desde o começo do ciclo */
  ritmo: number;
  ritmoCiclo: number;
  /** consumo previsto no fim do ciclo (ou em 30 dias, sem dia definido) */
  projecao: number;
  /** dias até o teto mensal acabar no ritmo atual; null = ritmo zero ou
   *  sem teto; 0 = já acabou */
  diasRestantes: number | null;
  /** dia civil em que o teto acaba no ritmo atual (null como acima) */
  esgotaEm: string | null;
  status: StatusPlano;
};

export type PrevisaoPlano = {
  /** false = dia de renovação não informado (ciclo = últimos 30 dias) */
  cicloConhecido: boolean;
  inicio: string;
  renovacao: string | null;
  /** dias (fracionários) até a renovação; null sem dia definido */
  diasAteRenovar: number | null;
  modelos: PrevisaoModelo[];
};

/** Previsão por modelo contra o teto do plano. Regras (as mesmas do
 *  "Como calculamos" da /ia):
 *   - ciclo: do último dia de renovação até o próximo; sem dia, os
 *     últimos 30 dias e a projeção vira "quanto gasta em 30 dias";
 *   - janelas curtas: soma das últimas 5h e dos últimos 7 dias contra
 *     20% e 50% do teto (a doc não diz se as janelas são móveis ou fixas;
 *     móvel é a leitura conservadora);
 *   - ritmo: allowance dos últimos 7 dias ÷ 7; projeção = usado no ciclo
 *     + ritmo × dias até renovar;
 *   - status: "estoura" se já usou o teto ou a projeção passa dele;
 *     "atencao" se a projeção chega a 80% do teto ou uma janela curta já
 *     passou de 80% do limite; senão "folga". Sem teto = "sem_teto". */
export function previsaoPlano(
  rows: ConsumoPlanoRow[],
  plano: PlanoIa,
  agora: number = Date.now()
): PrevisaoPlano {
  const hoje = toDateStr(new Date(agora));
  const conhecido = plano.diaRenovacao != null;
  const ciclo = conhecido ? cicloDoPlano(plano.diaRenovacao!, hoje) : null;
  const inicioMs = ciclo ? inicioDoDiaSp(ciclo.inicio) : agora - CICLO_PADRAO_DIAS * DIA_MS;
  const diasAteRenovar = ciclo ? Math.max(0, (inicioDoDiaSp(ciclo.renovacao) - agora) / DIA_MS) : null;
  const decorridos = Math.max(1, (agora - inicioMs) / DIA_MS);
  const desde5h = agora - 5 * 3600_000;
  const desde7d = agora - RITMO_DIAS * DIA_MS;

  const soma = new Map<string, { h5: number; d7: number; ciclo: number }>();
  for (const r of rows) {
    if (!r.modelo) continue;
    const t = new Date(r.created_at).getTime();
    if (t > agora) continue;
    const v = num(r.allowance_usd);
    const s = soma.get(r.modelo) ?? { h5: 0, d7: 0, ciclo: 0 };
    if (t >= desde5h) s.h5 += v;
    if (t >= desde7d) s.d7 += v;
    if (t >= inicioMs) s.ciclo += v;
    soma.set(r.modelo, s);
  }

  const modelos: PrevisaoModelo[] = [...soma.entries()].map(([modelo, s]) => {
    const teto = tetoDoModelo(plano, modelo);
    const ritmo = s.d7 / RITMO_DIAS;
    const projecao = s.ciclo + ritmo * (diasAteRenovar ?? CICLO_PADRAO_DIAS);
    const lim5h = teto == null ? null : teto * JANELA_5H;
    const limSem = teto == null ? null : teto * JANELA_SEMANA;
    let diasRestantes: number | null = null;
    let esgotaEm: string | null = null;
    if (teto != null) {
      if (s.ciclo >= teto) diasRestantes = 0;
      else if (ritmo > 0) diasRestantes = (teto - s.ciclo) / ritmo;
      if (diasRestantes != null) esgotaEm = toDateStr(new Date(agora + diasRestantes * DIA_MS));
    }
    let status: StatusPlano = "sem_teto";
    if (teto != null) {
      const curtaAlta =
        s.h5 >= LIMIAR_ATENCAO * lim5h! || s.d7 >= LIMIAR_ATENCAO * limSem!;
      status =
        s.ciclo >= teto || projecao >= teto
          ? "estoura"
          : projecao >= LIMIAR_ATENCAO * teto || curtaAlta
            ? "atencao"
            : "folga";
    }
    return {
      modelo,
      teto,
      janela5h: { usado: s.h5, limite: lim5h },
      semana: { usado: s.d7, limite: limSem },
      ciclo: { usado: s.ciclo, limite: teto },
      ritmo,
      ritmoCiclo: s.ciclo / decorridos,
      projecao,
      diasRestantes,
      esgotaEm,
      status,
    };
  });

  // mais apertado primeiro; sem teto no fim
  const aperto = (m: PrevisaoModelo) => (m.teto ? m.projecao / m.teto : -1);
  modelos.sort((a, b) => aperto(b) - aperto(a) || b.ciclo.usado - a.ciclo.usado);

  return {
    cicloConhecido: conhecido,
    inicio: ciclo ? ciclo.inicio : toDateStr(new Date(inicioMs)),
    renovacao: ciclo ? ciclo.renovacao : null,
    diasAteRenovar,
    modelos,
  };
}

const RISCO: Record<StatusPlano, number> = { estoura: 0, atencao: 1, folga: 2, sem_teto: 3 };

/** Divide a previsão pro painel: `alerta` (estoura e atenção, nessa
 *  ordem, cada grupo mantendo o aperto da previsão) ganha card inteiro;
 *  `tranquilos` (com folga e sem teto) vira a lista compacta. */
export function separarPorRisco(modelos: PrevisaoModelo[]): {
  alerta: PrevisaoModelo[];
  tranquilos: PrevisaoModelo[];
} {
  const ordem = [...modelos].sort((a, b) => RISCO[a.status] - RISCO[b.status]);
  return {
    alerta: ordem.filter((m) => m.status === "estoura" || m.status === "atencao"),
    tranquilos: ordem.filter((m) => m.status === "folga" || m.status === "sem_teto"),
  };
}
