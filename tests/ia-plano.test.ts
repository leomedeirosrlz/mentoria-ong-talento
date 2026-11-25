// Plano do opencode Go no painel /ia: leitura da chave "plano" (defaults
// seguros), teto por modelo (tabela, Teams +5, sobrescrita), ciclo mensal
// com mês curto, previsão por modelo (janelas 5h/7d, ritmo, projeção,
// status) e a série dos gráficos (médias ponderadas, buracos, picos,
// agrupamento semanal no 90d).

import { describe, expect, it } from "vitest";
import {
  lerPlanoIa,
  tetoDoModelo,
  TETOS_GO_PLUS_USD,
  TETOS_GO_USD,
  type PlanoIa,
} from "@/lib/ia/config";
import {
  cicloDoPlano,
  inicioConsultaPlano,
  inicioDoDiaSp,
  previsaoPlano,
  separarPorRisco,
  serieUsoIa,
  type ConsumoPlanoRow,
  type IaEventoRow,
  type PrevisaoModelo,
} from "@/lib/ia/metricas";
import { toDateStr } from "@/lib/ciclo";

const H = 3600_000;
const D = 24 * H;

describe("lerPlanoIa", () => {
  it("valor ausente ou quebrado cai no Go sem dia e sem tetos", () => {
    for (const v of [null, undefined, "go", 3, [], { plano: "ouro", dia_renovacao: 40 }])
      expect(lerPlanoIa(v)).toEqual({ plano: "go", diaRenovacao: null, tetos: {} });
  });
  it("aceita plano, dia 1..31 inteiro e só tetos numéricos positivos", () => {
    expect(
      lerPlanoIa({
        plano: "go_teams",
        dia_renovacao: 31,
        tetos: { a: 20, b: -1, c: "15", d: 0, e: 7.5 },
      })
    ).toEqual({ plano: "go_teams", diaRenovacao: 31, tetos: { a: 20, e: 7.5 } });
    expect(lerPlanoIa({ dia_renovacao: 2.5 }).diaRenovacao).toBeNull();
  });
});

describe("tetoDoModelo", () => {
  const go: PlanoIa = { plano: "go", diaRenovacao: null, tetos: {} };
  it("usa a tabela do Go pelo slug do /models", () => {
    expect(tetoDoModelo(go, "deepseek-v4.1-flash")).toBe(100);
    expect(tetoDoModelo(go, "deepseek-v4-pro")).toBe(15);
    expect(tetoDoModelo(go, "claude-haiku-5-5")).toBe(15);
    expect(tetoDoModelo(go, "opencode/glm-5.3-flash")).toBe(60);
  });
  it("modelo fora da tabela não tem teto; Teams soma 5 ao Go", () => {
    expect(tetoDoModelo(go, "beam-free")).toBeNull();
    expect(tetoDoModelo({ ...go, plano: "go_teams" }, "glm-5.3")).toBe(20);
  });
  it("Go Plus tem tabela própria, com os mesmos slugs do Go", () => {
    const plus: PlanoIa = { ...go, plano: "go_plus" };
    expect(tetoDoModelo(plus, "glm-5.3")).toBe(120);
    expect(tetoDoModelo(plus, "deepseek-v4.1-flash")).toBe(200);
    expect(tetoDoModelo(plus, "opencode/longcat-2.0")).toBe(240);
    expect(tetoDoModelo(plus, "minimax-m3.1-flash")).toBe(80);
    expect(tetoDoModelo(plus, "beam-free")).toBeNull();
    expect(tetoDoModelo({ ...plus, tetos: { "glm-5.3": 80 } }, "glm-5.3")).toBe(80);
    expect(Object.keys(TETOS_GO_PLUS_USD).sort()).toEqual(Object.keys(TETOS_GO_USD).sort());
  });
});

describe("cicloDoPlano", () => {
  it("antes do dia: ciclo começou no mês anterior", () => {
    expect(cicloDoPlano(20, "2026-11-06")).toEqual({ inicio: "2026-10-20", renovacao: "2026-11-20" });
  });
  it("no próprio dia: o ciclo novo começa hoje", () => {
    expect(cicloDoPlano(6, "2026-11-06")).toEqual({ inicio: "2026-11-06", renovacao: "2026-12-06" });
  });
  it("dia 31 em mês curto renova no último dia; virada de ano", () => {
    expect(cicloDoPlano(31, "2027-02-10")).toEqual({ inicio: "2027-01-31", renovacao: "2027-02-28" });
    expect(cicloDoPlano(31, "2028-02-29")).toEqual({ inicio: "2028-02-29", renovacao: "2028-03-31" });
    expect(cicloDoPlano(15, "2026-12-20")).toEqual({ inicio: "2026-12-15", renovacao: "2027-01-15" });
    expect(cicloDoPlano(15, "2027-01-03")).toEqual({ inicio: "2026-12-15", renovacao: "2027-01-15" });
  });
});

describe("previsaoPlano", () => {
  // 06/11/2026 12:00 em Brasília
  const agora = new Date("2026-11-06T12:00:00-03:00").getTime();
  const row = (modelo: string, usd: number, atras: number): ConsumoPlanoRow => ({
    modelo,
    allowance_usd: usd,
    created_at: new Date(agora - atras).toISOString(),
  });
  const plano = (dia: number | null): PlanoIa => ({ plano: "go", diaRenovacao: dia, tetos: {} });

  it("janelas de 5h e 7 dias contra 20% e 50% do teto; ciclo desde a renovação", () => {
    const p = previsaoPlano(
      [row("deepseek-v4-pro", 1, 2 * H), row("deepseek-v4-pro", 2, 3 * D), row("deepseek-v4-pro", 4, 10 * D), row("deepseek-v4-pro", 8, 25 * D)],
      plano(20),
      agora
    );
    expect(p.cicloConhecido).toBe(true);
    expect(p.inicio).toBe("2026-10-20");
    expect(p.renovacao).toBe("2026-11-20");
    const m = p.modelos[0];
    expect(m.teto).toBe(15);
    expect(m.janela5h).toEqual({ usado: 1, limite: 3 });
    expect(m.semana).toEqual({ usado: 3, limite: 7.5 });
    // 25 dias atrás é antes do dia 20/10: fora do ciclo
    expect(m.ciclo).toEqual({ usado: 7, limite: 15 });
    expect(m.ritmo).toBeCloseTo(3 / 7);
  });

  it("projeção = usado + ritmo × dias até renovar; status por faixa", () => {
    const diasAteRenovar = (inicioDoDiaSp("2026-11-20") - agora) / D; // 13,5
    // folga: 0,7 no ciclo, ritmo 0,1/dia → 2,05 de 15
    const folga = previsaoPlano([row("deepseek-v4-pro", 0.7, 2 * D)], plano(20), agora).modelos[0];
    expect(folga.projecao).toBeCloseTo(0.7 + 0.1 * diasAteRenovar);
    expect(folga.status).toBe("folga");
    // estoura: 6 fora dos 7d + 3,5 nos 7d (ritmo 0,5) → 9,5 + 0,5 × 13,5 = 16,25
    const estoura = previsaoPlano(
      [row("deepseek-v4-pro", 6, 10 * D), row("deepseek-v4-pro", 3.5, 2 * D)],
      plano(20),
      agora
    ).modelos[0];
    expect(estoura.status).toBe("estoura");
    expect(estoura.esgotaEm).toBe(toDateStr(new Date(agora + ((15 - 9.5) / 0.5) * D)));
    expect(estoura.diasRestantes).toBeCloseTo(11);
    const atencao = previsaoPlano(
      [row("deepseek-v4-pro", 4.5, 10 * D), row("deepseek-v4-pro", 3.5, 2 * D)],
      plano(20),
      agora
    ).modelos[0];
    // 8 + 0,5 × 13,5 = 14,75 → 98% do teto
    expect(atencao.projecao).toBeCloseTo(14.75);
    expect(atencao.status).toBe("atencao");
  });

  it("janela curta acima de 80% vira atenção mesmo com projeção baixa", () => {
    const m = previsaoPlano([row("glm-5.3", 2.5, 1 * H)], plano(1), agora).modelos[0];
    // teto 15: 5h = 3; 2,5 ≥ 2,4
    expect(m.status).toBe("atencao");
  });

  it("teto esgotado: dias restantes 0 e estoura", () => {
    const m = previsaoPlano([row("deepseek-v4-pro", 15.2, 3 * D)], plano(20), agora).modelos[0];
    expect(m.diasRestantes).toBe(0);
    expect(m.status).toBe("estoura");
  });

  it("sem dia de renovação: últimos 30 dias e projeção de 30 dias no ritmo", () => {
    const p = previsaoPlano(
      [row("deepseek-v4-pro", 7, 1 * D), row("deepseek-v4-pro", 5, 20 * D), row("deepseek-v4-pro", 9, 40 * D)],
      plano(null),
      agora
    );
    expect(p.cicloConhecido).toBe(false);
    expect(p.renovacao).toBeNull();
    expect(p.diasAteRenovar).toBeNull();
    const m = p.modelos[0];
    expect(m.ciclo.usado).toBe(12);
    expect(m.projecao).toBeCloseTo(12 + 1 * 30);
    expect(m.status).toBe("estoura");
  });

  it("modelo sem teto conhecido fica por último e não ganha status de risco", () => {
    const p = previsaoPlano(
      [row("beam-free", 50, 1 * D), row("deepseek-v4.1-flash", 1, 1 * D)],
      plano(20),
      agora
    );
    expect(p.modelos.map((m) => [m.modelo, m.status])).toEqual([
      ["deepseek-v4.1-flash", "folga"],
      ["beam-free", "sem_teto"],
    ]);
    expect(p.modelos[1].diasRestantes).toBeNull();
  });

  it("consulta começa no início do ciclo ou 7 dias atrás, o que vier antes", () => {
    expect(inicioConsultaPlano(20, agora)).toBe(inicioDoDiaSp("2026-10-20"));
    expect(inicioConsultaPlano(5, agora)).toBe(agora - 7 * D);
    expect(inicioConsultaPlano(null, agora)).toBe(agora - 30 * D);
  });
});

describe("separarPorRisco", () => {
  const m = (modelo: string, status: PrevisaoModelo["status"]) => ({ modelo, status }) as PrevisaoModelo;
  it("estoura antes de atenção, preservando a ordem de aperto; folga e sem teto vão pra lista", () => {
    const r = separarPorRisco([
      m("a", "atencao"),
      m("b", "folga"),
      m("c", "estoura"),
      m("d", "sem_teto"),
      m("e", "atencao"),
      m("f", "folga"),
    ]);
    expect(r.alerta.map((x) => x.modelo)).toEqual(["c", "a", "e"]);
    expect(r.tranquilos.map((x) => x.modelo)).toEqual(["b", "f", "d"]);
  });
  it("tudo com folga: nenhum card de alerta", () => {
    expect(separarPorRisco([m("a", "folga")]).alerta).toEqual([]);
  });
});

describe("serieUsoIa", () => {
  const agora = new Date("2026-11-06T15:00:00-03:00").getTime();
  const resp = (atrasDias: number, o: Partial<IaEventoRow> = {}): IaEventoRow => ({
    profile_id: "p",
    canal: "chat",
    tool: "resposta",
    request_id: null,
    ok: true,
    args: { list_cost: 0.02 },
    duracao_ms: 1000,
    modelo: "m",
    tier: "balanceado",
    tokens_in: 1000,
    tokens_out: 200,
    tokens_reasoning: null,
    cache_read: null,
    custo_usd: 0,
    allowance_usd: 0.01,
    billing_source: "go",
    iteracoes: 1,
    created_at: new Date(agora - atrasDias * D).toISOString(),
    ...o,
  });

  it("um ponto por dia; dia sem requisição tem zero na contagem e null nas médias", () => {
    const s = serieUsoIa(
      [resp(0), resp(0, { tokens_in: 3000, allowance_usd: 0.03 }), resp(2), { ...resp(0), tool: "mensagem" }],
      3,
      agora
    );
    expect(s.agrupamento).toBe("dia");
    expect(s.pontos.map((p) => p.inicio)).toEqual(["2026-11-04", "2026-11-05", "2026-11-06"]);
    expect(s.pontos.map((p) => p.requisicoes)).toEqual([1, 0, 2]);
    expect(s.pontos[1].tokensPorReq).toBeNull();
    expect(s.pontos[2].tokensPorReq).toBe((1200 + 3200) / 2);
    expect(s.pontos[2].planoPorReq).toBeCloseTo(0.02);
    // médias do período ponderadas pelas requisições
    expect(s.requisicoes).toBe(3);
    expect(s.medias.reqPorDia).toBe(1);
    expect(s.medias.tokensPorReq).toBeCloseTo((1200 + 3200 + 1200) / 3);
    expect(s.medias.tabelaPorReq).toBeCloseTo(0.02);
    expect(s.picos.reqPorDia).toBe(2);
  });

  it("pico só existe com dois pontos com dado", () => {
    const s = serieUsoIa([resp(0)], 7, agora);
    expect(s.picos).toEqual({ reqPorDia: null, tokensPorReq: null, planoPorReq: null });
  });

  it("90 dias agrupa por semana, a mais antiga parcial, média por dia da semana", () => {
    const s = serieUsoIa([resp(0), resp(1), resp(3), resp(10)], 90, agora);
    expect(s.agrupamento).toBe("semana");
    expect(s.pontos).toHaveLength(13);
    expect(s.pontos[0].dias).toBe(6);
    expect(s.pontos.slice(1).every((p) => p.dias === 7)).toBe(true);
    const ultima = s.pontos[12];
    expect(ultima.fim).toBe("2026-11-06");
    expect(ultima.inicio).toBe("2026-10-31");
    expect(ultima.requisicoes).toBe(3);
    expect(ultima.reqPorDia).toBeCloseTo(3 / 7);
    expect(s.medias.reqPorDia).toBeCloseTo(4 / 90);
  });

  it("recorte vazio: sem NaN", () => {
    const s = serieUsoIa([], 30, agora);
    expect(s.requisicoes).toBe(0);
    expect(s.medias.reqPorDia).toBe(0);
    expect(s.medias.tokensPorReq).toBeNull();
    expect(s.pontos.every((p) => p.reqPorDia === 0)).toBe(true);
  });
});
