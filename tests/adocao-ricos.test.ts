// REALIZA-453/454 — derivações puras dos painéis ricos e a régua dos
// gestos novos. O que este spec amarra porque o erro é silencioso:
// marcoRolagem decide O gesto que sai da estadia (marco errado distorce
// o painel inteiro); as derivações são a mesma conta dos presets do
// explorador — divergir deles é responder pergunta diferente na fixa.
import { describe, expect, it } from "vitest";
import {
  heatmapCliques,
  pessoasAtivas,
  profundidadeRolagem,
  tempoPorTela,
  trilhaPessoa,
  type EventoCru,
} from "@/lib/adocao";
import { marcoRolagem } from "@/lib/produto-eventos";
import { dadosEventosRicosDemo } from "@/lib/relatorios/adocao";
import { getDemoData } from "@/lib/demo/data";

const cru = (
  acao: string,
  superficie = "duplas",
  meta: Record<string, unknown> | null = {},
  profile_id = "p1",
  created_at = "2026-02-01T10:00:00Z"
): EventoCru => ({
  profile_id,
  papel: "mentor_dpp",
  superficie,
  acao,
  meta,
  created_at,
});

describe("marcoRolagem — a régua de emissão da estadia", () => {
  it.each([
    [0, 0],
    [0.1, 0],
    [0.249, 0],
    [0.25, 25],
    [0.4, 25],
    [0.5, 50],
    [0.74, 50],
    [0.75, 75],
    [0.9, 75],
    // o fundo vale a partir de 98% — scrollY fracionário quase nunca
    // bate 1.0 no rodapé (pinch, DPR)
    [0.98, 100],
    [0.999, 100],
    [1, 100],
  ])("fração %s vira marco %s", (frac, esperado) => {
    expect(marcoRolagem(frac)).toBe(esperado);
  });

  it("fora da régua clampa, NaN não vira gesto mentiroso", () => {
    expect(marcoRolagem(2)).toBe(100);
    expect(marcoRolagem(-0.5)).toBe(0);
    expect(marcoRolagem(Number.NaN)).toBe(0);
  });
});

describe("heatmapCliques — grade 10×10 do preset, em TS", () => {
  it("normaliza pela viewport do próprio gesto e soma por célula", () => {
    const h = heatmapCliques([
      // canto superior esquerdo em tela 400×800 → fx=0, fy=0
      cru("clique", "duplas", { x: 30, y: 60, vw: 400, vh: 800 }),
      // mesmo ponto proporcional em tela 1200×800 → mesma célula
      cru("clique", "duplas", { x: 90, y: 60, vw: 1200, vh: 800 }),
      // canto inferior direito → fx=9, fy=9
      cru("clique", "duplas", { x: 1199, y: 799, vw: 1200, vh: 800 }, "p2"),
    ]);
    const g = h.get("duplas")!;
    expect(g.grade[0]![0]).toBe(2);
    expect(g.grade[9]![9]).toBe(1);
    expect(g.toques).toBe(3);
    expect(g.pessoas).toBe(2);
  });

  it("toque fora da tela clampa na borda; meta incompleto fica de fora", () => {
    const h = heatmapCliques([
      cru("clique", "home", { x: -5, y: 4000, vw: 400, vh: 800 }),
      cru("clique", "home", { x: 30, y: 60 }), // sem vw/vh — não normaliza
      cru("clique", "home", null),
      cru("pageview", "home", {}),
    ]);
    const g = h.get("home")!;
    expect(g.grade[9]![0]).toBe(1); // clampado, não descartado
    expect(g.toques).toBe(1);
  });
});

describe("tempoPorTela — mediana honesta por estadia", () => {
  it("mediana + faixa p25–p75, denominador = estadias", () => {
    const t = tempoPorTela([
      cru("permanencia", "agenda", { dur_ms: 60_000 }),
      cru("permanencia", "agenda", { dur_ms: 120_000 }),
      cru("permanencia", "agenda", { dur_ms: 180_000 }),
      // a aba esquecida aberta 2h não derruba a mediana
      cru("permanencia", "agenda", { dur_ms: 7_200_000 }),
    ]);
    const agenda = t.find((x) => x.superficie === "agenda")!;
    expect(agenda.estadias).toBe(4);
    expect(agenda.mediana_ms).toBe(150_000);
    expect(agenda.p25_ms).toBeLessThanOrEqual(agenda.mediana_ms);
    expect(agenda.p75_ms).toBeGreaterThanOrEqual(agenda.mediana_ms);
  });

  it("duração inválida/ausente não entra no denominador", () => {
    const t = tempoPorTela([
      cru("permanencia", "home", { dur_ms: 0 }),
      cru("permanencia", "home", { dur_ms: -5 }),
      cru("permanencia", "home", {}),
      cru("permanencia", "home", { dur_ms: 45_000 }),
    ]);
    const home = t.find((x) => x.superficie === "home")!;
    expect(home.estadias).toBe(1);
    expect(home.mediana_ms).toBe(45_000);
  });
});

describe("profundidadeRolagem — marco atingido implica os anteriores", () => {
  it("prof=75 conta 25, 50 e 75; denominador = visitas roláveis", () => {
    const p = profundidadeRolagem([
      cru("rolagem", "materiais", { prof: 100 }),
      cru("rolagem", "materiais", { prof: 75 }),
      cru("rolagem", "materiais", { prof: 25 }),
      cru("rolagem", "materiais", { prof: 0 }), // rolável, não passou de 25
    ]);
    const m = p.find((x) => x.superficie === "materiais")!;
    expect(m.visitas).toBe(4);
    expect(m.pct[25]).toBeCloseTo(3 / 4);
    expect(m.pct[50]).toBeCloseTo(2 / 4);
    expect(m.pct[75]).toBeCloseTo(2 / 4);
    expect(m.pct[100]).toBeCloseTo(1 / 4);
  });

  it("gesto sem prof e ação alheia ficam de fora", () => {
    const p = profundidadeRolagem([
      cru("rolagem", "home", {}),
      cru("rolagem", "home", null),
      cru("clique", "home", { prof: 100 }),
    ]);
    expect(p.find((x) => x.superficie === "home")).toBeUndefined();
  });
});

describe("pessoasAtivas + trilhaPessoa — o drill da jornada", () => {
  it("ordena por gestos, respeita o limite e resolve o nome", () => {
    const eventos = [
      ...Array.from({ length: 3 }, () => cru("pageview", "home", {}, "p1")),
      cru("pageview", "home", {}, "p2"),
      ...Array.from({ length: 5 }, () => cru("clique", "duplas", {}, "p3")),
    ];
    const pessoas = pessoasAtivas(eventos, new Map([["p3", "Ana"]]), 2);
    expect(pessoas.map((p) => p.profile_id)).toEqual(["p3", "p1"]);
    expect(pessoas[0]!.nome).toBe("Ana");
    expect(pessoas[0]!.gestos).toBe(5);
  });

  it("a trilha sai em ordem cronológica, só da pessoa, com detalhe", () => {
    const eventos = [
      cru("clique", "duplas", { alvo: "nova-dupla" }, "p1", "2026-02-01T10:02:00Z"),
      cru("permanencia", "home", { dur_ms: 90_000 }, "p1", "2026-02-01T10:01:00Z"),
      cru("rolagem", "materiais", { prof: 50 }, "p1", "2026-02-01T10:03:00Z"),
      cru("pageview", "home", {}, "outra", "2026-02-01T10:00:30Z"),
    ];
    const trilha = trilhaPessoa(eventos, "p1");
    expect(trilha.map((g) => g.acao)).toEqual([
      "permanencia",
      "clique",
      "rolagem",
    ]);
    expect(trilha[0]!.detalhe).toBe("1min 30s");
    expect(trilha[1]!.detalhe).toBe("nova-dupla");
    expect(trilha[2]!.detalhe).toBe("50% da página");
  });
});

describe("demo — o cru fabricado cobre os gestos ricos", () => {
  it("permanencia/rolagem/alvo saem com meta válida pra os painéis falarem", () => {
    const d = getDemoData();
    const { eventos } = dadosEventosRicosDemo(d, 30, null);
    expect(eventos.length).toBeGreaterThan(50);

    const perms = eventos.filter((e) => e.acao === "permanencia");
    expect(perms.length).toBeGreaterThan(0);
    for (const e of perms) {
      const dur = e.meta?.dur_ms;
      expect(typeof dur).toBe("number");
      expect(dur as number).toBeGreaterThan(0);
    }

    const rols = eventos.filter((e) => e.acao === "rolagem");
    expect(rols.length).toBeGreaterThan(0);
    for (const e of rols) {
      expect([0, 25, 50, 75, 100]).toContain(e.meta?.prof);
    }

    const comAlvo = eventos.filter((e) => e.acao === "clique" && e.meta?.alvo);
    expect(comAlvo.length).toBeGreaterThan(0);
    for (const e of comAlvo) {
      // alvo é rótulo semântico curto — o corte de 48c do beacon
      expect(String(e.meta!.alvo).length).toBeLessThanOrEqual(48);
      expect(String(e.meta!.alvo)).toMatch(/^[a-z-]+$/);
    }
  });

  it("o recorte de papel filtra o cru demo como a régua filtra o real", () => {
    const d = getDemoData();
    const { eventos } = dadosEventosRicosDemo(d, 30, "coordenacao");
    expect(eventos.length).toBeGreaterThan(0);
    for (const e of eventos) expect(e.papel).toBe("coordenacao");
  });
});
