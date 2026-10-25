import { describe, expect, it } from "vitest";
import {
  faixa,
  horaCurta,
  resumoExcecao,
  resumoGrade,
} from "../src/lib/horarios-especialista";

describe("horários do especialista em frases", () => {
  it("hora curta sem minutos zerados", () => {
    expect(horaCurta("18:00:00")).toBe("18h");
    expect(horaCurta("18:30:00")).toBe("18h30");
    expect(horaCurta("09:00")).toBe("9h");
    expect(faixa("18:00:00", "20:00:00")).toBe("18h–20h");
  });

  it("agrupa por dia, segunda primeiro e domingo por último", () => {
    expect(
      resumoGrade([
        { id: "a", dia_semana: 0, hora_inicio: "10:00:00", hora_fim: "12:00:00" },
        { id: "b", dia_semana: 6, hora_inicio: "14:00:00", hora_fim: "16:00:00" },
        { id: "c", dia_semana: 2, hora_inicio: "18:00:00", hora_fim: "20:00:00" },
        { id: "d", dia_semana: 6, hora_inicio: "09:00:00", hora_fim: "12:00:00" },
      ])
    ).toEqual([
      "Terças 18h–20h",
      "Sábados 9h–12h e 14h–16h",
      "Domingos 10h–12h",
    ]);
  });

  it("três faixas no mesmo dia usam vírgula e 'e'", () => {
    expect(
      resumoGrade([
        { id: "a", dia_semana: 1, hora_inicio: "08:00:00", hora_fim: "09:00:00" },
        { id: "b", dia_semana: 1, hora_inicio: "12:00:00", hora_fim: "13:00:00" },
        { id: "c", dia_semana: 1, hora_inicio: "18:00:00", hora_fim: "19:30:00" },
      ])
    ).toEqual(["Segundas 8h–9h, 12h–13h e 18h–19h30"]);
  });

  it("grade vazia não gera linha", () => {
    expect(resumoGrade([])).toEqual([]);
  });

  it("exceções em frase", () => {
    expect(
      resumoExcecao({ id: "x", data: "2026-11-12", hora_inicio: "18:00:00", hora_fim: "20:00:00", tipo: "bloqueio" })
    ).toBe("Não atende em 12/11, 18h–20h");
    expect(
      resumoExcecao({ id: "y", data: "2026-11-15", hora_inicio: "09:00:00", hora_fim: "12:00:00", tipo: "extra" })
    ).toBe("Atende também em 15/11, 9h–12h");
  });
});
