// metricasIa — agregação pura do painel /ia. Fixture cobre os 3 papéis de
// evento (mensagem/resposta/tool call) e prova: contagem por papel, soma
// de tokens/custo só na resposta, latência média+p95, agrupamentos por
// modelo/tier/canal, top tools com erroRate, por pessoa, série com dia
// zerado preenchido e dia civil em America/Sao_Paulo (não UTC).
// filtrarEventosIa — o recorte ?canal/&modelo da página: o modelo casa a
// request inteira pelo request_id da resposta, não o campo por evento.

import { describe, expect, it } from "vitest";
import { toDateStr } from "@/lib/ciclo";
import {
  filtrarEventosIa,
  metricasIa,
  type IaEventoRow,
} from "@/lib/ia/metricas";

const base = {
  profile_id: "p-1",
  canal: "chat",
  request_id: null,
  ok: true,
  args: {},
  duracao_ms: null,
  modelo: null,
  tier: null,
  tokens_in: null,
  tokens_out: null,
  tokens_reasoning: null,
  cache_read: null,
  custo_usd: null,
  allowance_usd: null,
  billing_source: null,
  iteracoes: null,
};
const hoje = new Date().toISOString().slice(0, 10);
const ontem = new Date(Date.now() - 86400_000).toISOString().slice(0, 10);

const ev = (o: Partial<IaEventoRow>): IaEventoRow => ({
  ...base,
  created_at: `${hoje}T12:00:00Z`,
  ...o,
} as IaEventoRow);

describe("metricasIa", () => {
  it("separa mensagem/resposta/tool: contagem, tokens e custo só na resposta", () => {
    const m = metricasIa(
      [
        ev({ tool: "mensagem" }),
        ev({ tool: "mensagem" }),
        ev({ tool: "resumo_semana", duracao_ms: 300 }),
        ev({
          tool: "resposta",
          modelo: "m-a",
          tier: "balanceado",
          tokens_in: 1000,
          tokens_out: 200,
          custo_usd: 0.01,
          allowance_usd: 0.01,
          duracao_ms: 5000,
          iteracoes: 2,
        }),
      ],
      7
    );
    expect(m.mensagens).toBe(2);
    expect(m.respostas).toBe(1);
    expect(m.respostasOk).toBe(1);
    expect(m.tokensIn).toBe(1000);
    expect(m.tokensOut).toBe(200);
    expect(m.custoUsd).toBeCloseTo(0.01);
    expect(m.erroRate).toBe(0);
  });

  it("latência: média aritmética e p95 sobre duracao_ms das respostas", () => {
    const lats = [1000, 2000, 3000, 4000, 10000];
    const m = metricasIa(
      lats.map((d) => ev({ tool: "resposta", duracao_ms: d, ok: true })),
      7
    );
    expect(m.msMedio).toBe(4000);
    // p95 = topo do conjunto (5 amostras → índice 4)
    expect(m.msP95).toBe(10000);
  });

  it("agrupa por modelo/tier/canal e ranqueia por volume", () => {
    const m = metricasIa(
      [
        ev({ tool: "mensagem", canal: "chat" }),
        ev({ tool: "mensagem", canal: "chat" }),
        ev({ tool: "mensagem", canal: "mcp" }),
        ev({ tool: "resposta", modelo: "b", tier: "forte", duracao_ms: 100 }),
        ev({ tool: "resposta", modelo: "a", tier: "balanceado", duracao_ms: 200 }),
        ev({ tool: "resposta", modelo: "a", tier: "balanceado", duracao_ms: 400 }),
      ],
      7
    );
    expect(m.porModelo[0]).toMatchObject({ modelo: "a", respostas: 2, msMedio: 300 });
    expect(m.porModelo[1]).toMatchObject({ modelo: "b", respostas: 1 });
    expect(m.porTier[0]).toEqual({ tier: "balanceado", respostas: 2 });
    expect(m.porCanal).toEqual([
      { canal: "chat", mensagens: 2 },
      { canal: "mcp", mensagens: 1 },
    ]);
  });

  it("top tools: chamadas, erroRate e msMedio — 'mensagem'/'resposta' não entram", () => {
    const m = metricasIa(
      [
        ev({ tool: "mensagem" }),
        ev({ tool: "ficha_dupla", duracao_ms: 100 }),
        ev({ tool: "ficha_dupla", duracao_ms: 300, ok: false }),
        ev({ tool: "guia_consulta", duracao_ms: 900 }),
      ],
      7
    );
    expect(m.topTools).toHaveLength(2);
    expect(m.topTools[0]).toMatchObject({
      tool: "ficha_dupla",
      chamadas: 2,
      erroRate: 0.5,
      msMedio: 200,
    });
  });

  it("por pessoa soma mensagens + tokens da resposta no mesmo profile", () => {
    const m = metricasIa(
      [
        ev({ tool: "mensagem", profile_id: "p-a" }),
        ev({ tool: "mensagem", profile_id: "p-a" }),
        ev({ tool: "mensagem", profile_id: "p-b" }),
        ev({ tool: "resposta", profile_id: "p-a", tokens_out: 150, custo_usd: 0.02 }),
      ],
      7
    );
    expect(m.porPessoa[0]).toMatchObject({ profileId: "p-a", mensagens: 2, tokensOut: 150 });
    expect(m.porPessoa[1]).toMatchObject({ profileId: "p-b", mensagens: 1, tokensOut: 0 });
  });

  it("série diária preenche dias sem mensagem com zero", () => {
    const m = metricasIa(
      [ev({ tool: "mensagem", created_at: `${ontem}T10:00:00Z` })],
      3
    );
    expect(m.serie).toHaveLength(3);
    const porDia = Object.fromEntries(m.serie.map((p) => [p.dia, p.mensagens]));
    expect(porDia[ontem]).toBe(1);
    // os outros dois dias do recorte existem com 0, não buracos no eixo
    expect(m.serie.filter((p) => p.mensagens === 0)).toHaveLength(2);
  });

  it("dia civil é o de Brasília: evento das 23h30 SP cai no próprio dia, não no UTC seguinte", () => {
    const agora = Date.now();
    const spOntem = toDateStr(new Date(agora - 86400_000));
    // 23h30 em America/Sao_Paulo = 02h30 UTC do dia seguinte — o corte
    // UTC antigo jogava a mensagem um dia pra frente
    const m = metricasIa(
      [ev({ tool: "mensagem", created_at: `${spOntem}T23:30:00-03:00` })],
      2
    );
    const porDia = Object.fromEntries(m.serie.map((p) => [p.dia, p.mensagens]));
    expect(porDia[spOntem]).toBe(1);
    expect(porDia[toDateStr(new Date(agora))]).toBe(0);
  });

  it("recorte vazio não quebra: zeros e nulls, não NaN", () => {
    const m = metricasIa([], 7);
    expect(m.mensagens).toBe(0);
    expect(m.erroRate).toBe(0);
    expect(m.msMedio).toBeNull();
    expect(m.msP95).toBeNull();
    expect(m.iterMedia).toBeNull();
    expect(m.serie).toHaveLength(7);
  });
});

describe("filtrarEventosIa", () => {
  const cadeia = (requestId: string, modelo: string): IaEventoRow[] => [
    ev({ tool: "mensagem", request_id: requestId }),
    ev({ tool: "ficha_dupla", request_id: requestId }),
    ev({ tool: "resposta", request_id: requestId, modelo }),
  ];

  it("modelo mantém a cadeia inteira do request_id: mensagem, tools e resposta", () => {
    const eventos = [...cadeia("r1", "m-a"), ...cadeia("r2", "m-b")];
    const f = filtrarEventosIa(eventos, "todos", "m-a");
    expect(f.map((e) => e.tool)).toEqual([
      "mensagem",
      "ficha_dupla",
      "resposta",
    ]);
    expect(f.every((e) => e.request_id === "r1")).toBe(true);
  });

  it("sem modelo devolve só o recorte do canal", () => {
    const eventos = [
      ev({ tool: "mensagem", canal: "chat", request_id: "r1" }),
      ev({ tool: "mensagem", canal: "mcp", request_id: "r2" }),
      ev({ tool: "guia_consulta", canal: "mcp", request_id: "r2" }),
    ];
    expect(filtrarEventosIa(eventos, "mcp", null)).toHaveLength(2);
    expect(filtrarEventosIa(eventos, "todos", null)).toHaveLength(3);
  });

  it("canal e modelo combinam: request_id de outro canal não entra", () => {
    // mesma situação real: resposta do modelo só existe no chat; uma
    // mensagem mcp com request_id próprio não casa com ele
    const eventos = [
      ...cadeia("r-chat", "m-a"),
      ev({ tool: "mensagem", canal: "mcp", request_id: "r-mcp" }),
    ];
    const f = filtrarEventosIa(eventos, "mcp", "m-a");
    expect(f).toHaveLength(0);
  });

  it("evento sem request_id sai do recorte filtrado por modelo", () => {
    const eventos = [
      ev({ tool: "mensagem", request_id: null }),
      ev({ tool: "resposta", request_id: "r1", modelo: "m-a" }),
    ];
    const f = filtrarEventosIa(eventos, "todos", "m-a");
    expect(f).toHaveLength(1);
    expect(f[0].tool).toBe("resposta");
  });
});
