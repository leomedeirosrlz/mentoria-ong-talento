import { describe, expect, it } from "vitest";
import { visivelMentor } from "../scripts/seed-visibilidade.mjs";

// 027 (FR-002) — o mix determinístico da seed: toda 3ª avaliação respondida
// fica fora da visão do mentor. Os encontros avaliáveis da seed são
// i%5!==4 (−avalPendente): {1,2,3,5,6}∩feitos. A regra garante ao menos um
// false em qualquer dupla com ≥3 respostas (a d1 mostra os dois estados).

const avaliados = (feitos: number, avalPendente?: number) =>
  Array.from({ length: feitos }, (_, i) => i + 1).filter(
    (i) => i % 5 !== 4 && i !== avalPendente
  );

describe("seed — mix avaliacao_visivel_mentor", () => {
  it("é determinístico por número do encontro: a cada 3 respostas, uma oculta", () => {
    const visiveis = [1, 2, 5].map(visivelMentor);
    const ocultas = [3, 6, 9].map(visivelMentor);
    expect(visiveis).toEqual([true, true, true]);
    expect(ocultas).toEqual([false, false, false]);
  });

  it("d1 (Ana × Otávio, B′: feitos 5 + avalPendente 5) mostra os dois estados", () => {
    const flags = avaliados(5, 5).map(visivelMentor); // encontros 1,2,3
    expect(flags).toContain(true);
    expect(flags).toContain(false);
    // a oculta é a resposta do encontro 3 — a mais recente respondida
    expect(visivelMentor(3)).toBe(false);
  });

  it("toda dupla com ≥3 respostas tem ao menos uma linha false", () => {
    // os planos reais: feitos ∈ {2,3,5,6} e avalPendente ∈ {5,6,undefined}
    for (const feitos of [2, 3, 5, 6]) {
      for (const avalPendente of [undefined, 5, 6]) {
        const numeros = avaliados(feitos, avalPendente);
        if (numeros.length < 3) continue;
        const flags = numeros.map(visivelMentor);
        expect(
          flags,
          `feitos=${feitos} avalPendente=${avalPendente} → ${numeros}`
        ).toContain(false);
      }
    }
  });
});
