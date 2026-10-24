// Gramática de labels de turma (src/lib/turma.ts) + as puras do card v1a
// (tintaTurma, linhaDadosTurma — exportadas de components/turma-card.tsx).
// O valor cru de `turma` nunca é reescrito: estas funções só derivam rótulo
// de exibição — os testes travam exatamente esse contrato.
import { describe, expect, it } from "vitest";
import {
  partesTurma,
  turmaAno,
  turmaCurta,
  turmaLonga,
  turmaNumero,
} from "@/lib/turma";
import { linhaDadosTurma, tintaTurma } from "@/components/turma-card";
import { CICLO_16, dt, mkCronograma, mkEvento } from "./helpers";

describe("partesTurma — o padrão 'T<N> · <período>'", () => {
  it("T1/T2 com período → nome forte + ano", () => {
    expect(partesTurma("T1 · 2026/2027")).toEqual({
      nome: "Turma 1",
      ano: "2026/2027",
    });
    expect(partesTurma("T2 · 2026/2027")).toEqual({
      nome: "Turma 2",
      ano: "2026/2027",
    });
  });

  it("aceita os separadores alternativos e a sigla sem espaço", () => {
    expect(partesTurma("T3-2027")).toEqual({ nome: "Turma 3", ano: "2027" });
    expect(partesTurma("T4.2028")).toEqual({ nome: "Turma 4", ano: "2028" });
    expect(partesTurma("T1·2026")).toEqual({ nome: "Turma 1", ano: "2026" });
  });

  it("sigla solta ('T1') vira 'Turma 1' sem ano", () => {
    expect(partesTurma("T1")).toEqual({ nome: "Turma 1", ano: null });
    expect(partesTurma("t2")).toEqual({ nome: "Turma 2", ano: null });
  });

  it("legado e texto livre devolvem o valor cru como nome", () => {
    expect(partesTurma("2025/2026")).toEqual({
      nome: "2025/2026",
      ano: null,
    });
    expect(partesTurma("2026/2027")).toEqual({
      nome: "2026/2027",
      ano: null,
    });
    expect(partesTurma("E2E Turma de teste")).toEqual({
      nome: "E2E Turma de teste",
      ano: null,
    });
  });
});

describe("derived labels — curta/longa/ano/numero", () => {
  it("turmaCurta pega a sigla; turmaLonga faz o round-trip", () => {
    expect(turmaCurta("T1 · 2026/2027")).toBe("T1");
    expect(turmaLonga(turmaCurta("T1 · 2026/2027"))).toBe("Turma 1");
    expect(turmaAno("T1 · 2026/2027")).toBe("2026/2027");
  });

  it("null/vazio → string vazia / null, nunca exceção", () => {
    expect(turmaCurta(null)).toBe("");
    expect(turmaCurta(undefined)).toBe("");
    expect(turmaLonga(null)).toBe("");
    expect(turmaAno(null)).toBeNull();
    expect(turmaNumero(null)).toBe("");
  });

  it("turmaNumero só tira o prefixo T — fora do padrão devolve a si mesmo", () => {
    expect(turmaNumero("T2 · 2026/2027")).toBe("2");
    expect(turmaNumero("t1 · 2026/2027")).toBe("1");
    expect(turmaNumero("T01 · 2027")).toBe("01");
    expect(turmaNumero("E2E Turma de teste")).toBe("E2E Turma de teste");
  });
});

describe("tintaTurma — identidade visual por turma", () => {
  const LIMA = "var(--brand-lime)";
  const AMBAR = "var(--role-mentorado)";
  const EXTRAS = [
    "hsl(207 82% 45%)",
    "hsl(262 45% 48%)",
    "hsl(174 62% 32%)",
  ];

  it("T1 lima, T2 âmbar — o par fixo da gramática", () => {
    expect(tintaTurma("T1 · 2026/2027").tt).toBe(LIMA);
    expect(tintaTurma("T2 · 2026/2027").tt).toBe(AMBAR);
  });

  it("T3+ alterna a paleta extra na ordem", () => {
    expect(tintaTurma("T3 · 2026/2027").tt).toBe(EXTRAS[0]);
    expect(tintaTurma("T4 · 2026/2027").tt).toBe(EXTRAS[1]);
    expect(tintaTurma("T5 · 2026/2027").tt).toBe(EXTRAS[2]);
    expect(tintaTurma("T6 · 2026/2027").tt).toBe(EXTRAS[0]); // wrap
  });

  it("variantes de digitação da sigla caem na mesma tinta", () => {
    expect(tintaTurma("T01 · 2027").tt).toBe(LIMA);
    expect(tintaTurma("t1 · 2027").tt).toBe(LIMA);
    expect(tintaTurma("T02").tt).toBe(AMBAR);
  });

  it("texto livre distribui por hash — nunca recicla lima/âmbar", () => {
    for (const livre of ["E2E Turma de teste", "2025/2026", "Turma livre", ""]) {
      const tt = tintaTurma(livre).tt;
      expect(EXTRAS).toContain(tt);
      expect(tt).not.toBe(LIMA);
      expect(tt).not.toBe(AMBAR);
    }
    // estável: mesmo label, mesma tinta
    expect(tintaTurma("E2E Turma de teste")).toBe(tintaTurma("E2E Turma de teste"));
  });
});

describe("linhaDadosTurma — a linha mono do banner", () => {
  const c = mkCronograma({ turma: "T1 · 2026/2027", nome: "Calendário oficial" });
  const HOJE = dt("2025-11-05"); // quarta — semana do enc. 5 (terça 04/11)

  it("ano + nome + dia modal + semana vigente", () => {
    // CICLO_16 = 16 terças — o dow modal é "Terças"
    expect(linhaDadosTurma(c, CICLO_16, HOJE)).toBe(
      "Ciclo 2026/2027 · Calendário oficial · Terças · Semana do enc. 5/16"
    );
  });

  it("sem dia modal (datas espalhadas, <2 por dow) o trecho some", () => {
    const evs = [mkEvento(1, "2025-10-07"), mkEvento(2, "2025-10-09")]; // ter + qui
    const linha = linhaDadosTurma(c, evs, dt("2025-10-01"));
    expect(linha).toBe(
      "Ciclo 2026/2027 · Calendário oficial · Semana do enc. 1/2"
    );
    expect(linha).not.toMatch(/Terças|Quintas/);
  });

  it("sem evento cai no total ('N encontros')", () => {
    expect(linhaDadosTurma(c, [], HOJE)).toBe(
      "Ciclo 2026/2027 · Calendário oficial · 0 encontros"
    );
  });

  it("rascunho/encerrado substituem a régua da semana", () => {
    expect(
      linhaDadosTurma(mkCronograma({ ...c, status: "rascunho" }), CICLO_16, HOJE)
    ).toContain("Em preparação");
    expect(
      linhaDadosTurma(mkCronograma({ ...c, status: "encerrado" }), CICLO_16, HOJE)
    ).toContain("Encerrado");
  });

  it("turma fora do padrão: sem ano, o próprio label abre a linha", () => {
    expect(
      linhaDadosTurma(
        mkCronograma({ turma: "E2E Turma de teste" }),
        CICLO_16,
        HOJE
      )
    ).toBe(
      "E2E Turma de teste · Calendário oficial · Terças · Semana do enc. 5/16"
    );
  });
});
