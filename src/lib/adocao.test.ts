import { describe, expect, it } from "vitest";
import {
  coorteParaGrade,
  deltaPct,
  intensidades,
  JANELA_DEFAULT,
  janelaDeParam,
  matrizParaGrade,
  papelDeParam,
  SUPERFICIES,
  type CelulaMatriz,
  type GradeMatriz,
  type LinhaCoorte,
} from "./adocao";

const cel = (
  superficie: string,
  papel: string,
  pessoas: number,
  gestos = pessoas
): CelulaMatriz => ({ superficie, papel, pessoas, gestos });

// grade de referência:
//   pessoas — home=11 (mentor_dpp 9+1, coord 1) · agenda=5 · wiki_velha=3
//   gestos  — home=26 · agenda=60 · wiki_velha=9
const CELULAS: CelulaMatriz[] = [
  cel("home", "mentor_dpp", 9, 20),
  cel("home", "mentor_dpp", 1, 1),
  cel("home", "coordenacao", 1, 5),
  cel("agenda", "coordenacao", 5, 60),
  cel("wiki_velha", "mentorado", 3, 9), // superfície fora do catálogo
  cel("materiais", "mentor_dpp", 0, 0), // zerada — não abre linha
];

describe("deltaPct", () => {
  it("janela anterior zerada ou negativa volta null (÷0 não vira ∞%)", () => {
    expect(deltaPct(50, 0)).toBeNull();
    expect(deltaPct(0, 0)).toBeNull();
    expect(deltaPct(50, -10)).toBeNull();
  });

  it("subida, descida e empate voltam como fração", () => {
    expect(deltaPct(110, 100)).toBeCloseTo(0.1);
    expect(deltaPct(90, 100)).toBeCloseTo(-0.1);
    expect(deltaPct(100, 100)).toBe(0);
    expect(deltaPct(0, 100)).toBe(-1);
  });
});

describe("janelaDeParam", () => {
  it("aceita só os chips 7/30/90", () => {
    expect(janelaDeParam("7")).toBe(7);
    expect(janelaDeParam("30")).toBe(30);
    expect(janelaDeParam("90")).toBe(90);
  });

  it("valor estranho ou ausente cai no default", () => {
    expect(janelaDeParam("abc")).toBe(JANELA_DEFAULT);
    expect(janelaDeParam("31")).toBe(JANELA_DEFAULT);
    expect(janelaDeParam("")).toBe(JANELA_DEFAULT);
    expect(janelaDeParam(undefined)).toBe(JANELA_DEFAULT);
  });
});

describe("papelDeParam", () => {
  it("papel da whitelist passa como filtro", () => {
    expect(papelDeParam("coordenacao")).toBe("coordenacao");
    expect(papelDeParam("mentor_dpp")).toBe("mentor_dpp");
    expect(papelDeParam("mentorado")).toBe("mentorado");
    expect(papelDeParam("desconhecido")).toBe("desconhecido");
  });

  it("string fora da whitelist vira null (não filtra nem quebra)", () => {
    expect(papelDeParam("admin")).toBeNull();
    expect(papelDeParam("mentor")).toBeNull();
    expect(papelDeParam("")).toBeNull();
    expect(papelDeParam(undefined)).toBeNull();
  });
});

describe("matrizParaGrade", () => {
  it("linhas: com evento por total desc, paradas zeradas, desconhecidas no fim", () => {
    const g = matrizParaGrade(CELULAS, "pessoas");
    expect(g.linhas[0]).toEqual({ id: "home", rotulo: "Home", total: 11 });
    expect(g.linhas[1]).toEqual({ id: "agenda", rotulo: "Agenda", total: 5 });

    const ids = g.linhas.map((l) => l.id);
    // a canônica sem evento é a parada explícita — total 0, antes das
    // desconhecidas; a célula zerada (materiais) também segue parada
    const iJovem = ids.indexOf("jovem");
    const iDesconhecida = ids.indexOf("wiki_velha");
    expect(iDesconhecida).toBe(ids.length - 1);
    expect(iJovem).toBeGreaterThan(1);
    expect(iJovem).toBeLessThan(iDesconhecida);
    expect(g.linhas[iJovem]).toEqual({
      id: "jovem",
      rotulo: "Área do jovem",
      total: 0,
    });
    expect(ids.indexOf("materiais")).toBeGreaterThan(1);
    expect(ids.indexOf("materiais")).toBeLessThan(iDesconhecida);

    // desconhecida entra com o próprio id de rótulo e o total dela
    expect(g.linhas.at(-1)).toEqual({
      id: "wiki_velha",
      rotulo: "wiki_velha",
      total: 3,
    });
    expect(g.linhas).toHaveLength(SUPERFICIES.length + 1);
  });

  it("colunas ficam na ordem PAPEIS_ADOCAO e só com papel que tem valor", () => {
    const g = matrizParaGrade(CELULAS, "pessoas");
    // mentor_dpp (10) > coordenacao (6): a ordem é a do catálogo, não a do total
    expect(g.colunas.map((c) => c.id)).toEqual([
      "coordenacao",
      "mentor_dpp",
      "mentorado",
    ]);
    expect(g.colunas.map((c) => c.total)).toEqual([6, 10, 3]);
  });

  it("células somam repetições e o ausente é o zero (o vazio é o dado)", () => {
    const g = matrizParaGrade(CELULAS, "pessoas");
    expect(g.celulas.get("home")?.get("mentor_dpp")).toBe(10); // 9+1
    expect(g.celulas.get("home")?.get("coordenacao")).toBe(1);
    expect(g.celulas.get("agenda")?.get("coordenacao")).toBe(5);
    expect(g.celulas.get("wiki_velha")?.get("mentorado")).toBe(3);
    expect(g.celulas.get("home")?.get("supervisor")).toBeUndefined();
    expect(g.celulas.get("jovem")).toBeUndefined(); // parada não abre mapa
  });

  it("medida gestos troca os valores e a ordenação da grade", () => {
    const g = matrizParaGrade(CELULAS, "gestos");
    expect(g.linhas[0]).toMatchObject({ id: "agenda", total: 60 });
    expect(g.linhas[1]).toMatchObject({ id: "home", total: 26 });
    expect(g.celulas.get("agenda")?.get("coordenacao")).toBe(60);
    expect(g.celulas.get("home")?.get("mentor_dpp")).toBe(21);
    expect(g.colunas.map((c) => c.total)).toEqual([65, 21, 9]);
  });
});

describe("intensidades", () => {
  it("a célula mais densa vira 1 e as demais escalam em 0..1", () => {
    const inten = intensidades(matrizParaGrade(CELULAS, "pessoas"));
    expect(inten.get("home")?.get("mentor_dpp")).toBe(1); // max = 10
    expect(inten.get("agenda")?.get("coordenacao")).toBeCloseTo(0.5);
    expect(inten.get("home")?.get("coordenacao")).toBeCloseTo(0.1);
    expect(inten.get("wiki_velha")?.get("mentorado")).toBeCloseTo(0.3);
    for (const [, cols] of inten)
      for (const [, v] of cols) {
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(1);
      }
  });

  it("grade toda zerada: intensidade 0 sem NaN (max=0 não divide)", () => {
    const zerada: GradeMatriz = {
      linhas: [],
      colunas: [],
      celulas: new Map([["home", new Map([["coordenacao", 0]])]]),
    };
    const inten = intensidades(zerada);
    expect(inten.get("home")?.get("coordenacao")).toBe(0);
  });

  it("grade sem células devolve mapa vazio", () => {
    const vazia: GradeMatriz = { linhas: [], colunas: [], celulas: new Map() };
    expect(intensidades(vazia).size).toBe(0);
  });
});

const LINHAS_COORTE: LinhaCoorte[] = [
  { coorte: "2026-01-05", semana: 0, ativas: 10, total: 10 },
  { coorte: "2026-01-05", semana: 1, ativas: 6, total: 10 },
  { coorte: "2026-01-05", semana: 2, ativas: 4, total: 10 },
  { coorte: "2026-01-12", semana: 0, ativas: 8, total: 8 },
  { coorte: "2026-01-12", semana: 1, ativas: 5, total: 8 },
];

describe("coorteParaGrade", () => {
  it("uma linha por coorte, mais nova em cima, rótulo 'sem dd/mm'", () => {
    const g = coorteParaGrade(LINHAS_COORTE, 10);
    expect(g.semanas).toBe(10);
    expect(g.linhas.map((l) => l.coorte)).toEqual([
      "2026-01-12",
      "2026-01-05",
    ]);
    expect(g.linhas[0]).toMatchObject({ rotulo: "sem 12/01", total: 8 });
    expect(g.linhas[1]).toMatchObject({ rotulo: "sem 05/01", total: 10 });
  });

  it("pct = ativas/total da própria linha; total 0 não quebra", () => {
    const g = coorteParaGrade(
      [
        ...LINHAS_COORTE,
        { coorte: "2026-01-19", semana: 0, ativas: 0, total: 0 },
      ],
      10
    );
    expect(g.pct.get("2026-01-05")?.get(0)).toBe(1);
    expect(g.pct.get("2026-01-05")?.get(2)).toBeCloseTo(0.4);
    expect(g.pct.get("2026-01-12")?.get(1)).toBeCloseTo(0.625);
    expect(g.pct.get("2026-01-19")?.get(0)).toBe(0);
    expect(g.linhas.find((l) => l.coorte === "2026-01-19")?.total).toBe(0);
  });

  it("total da coorte é o máximo entre as linhas dela", () => {
    const g = coorteParaGrade(
      [
        { coorte: "2026-01-05", semana: 0, ativas: 9, total: 9 },
        { coorte: "2026-01-05", semana: 1, ativas: 2, total: 7 },
      ],
      6
    );
    expect(g.linhas[0].total).toBe(9);
    // e a % usa o total DA LINHA, não o máximo da coorte
    expect(g.pct.get("2026-01-05")?.get(1)).toBeCloseTo(2 / 7);
  });
});
