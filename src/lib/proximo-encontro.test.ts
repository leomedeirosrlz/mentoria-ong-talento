import { describe, expect, it } from "vitest";
import { encontrosPrevistos } from "./proximo-encontro";
import type { EncontroStatus } from "./types";

// ---------- encontrosPrevistos — a régua única do "próximo encontro" ----------
// Regressão da QA 25/11: card, lista, home e ficha mostravam quatro
// próximos diferentes porque cada superfície ordenava do seu jeito.

const AGORA = new Date("2026-11-25T15:00:00-03:00");

const enc = (
  numero: number | null,
  data_hora: string | null,
  status: EncontroStatus = "agendado",
  extra: Record<string, unknown> = {}
) => ({ numero, data_hora, status, ...extra });

describe("ordenação pela data, nunca pelo número", () => {
  it("o 6º em 01/12 vem antes do 5º em 03/12 — a data manda", () => {
    const lista = encontrosPrevistos(
      [
        enc(5, "2026-12-03T19:00:00-03:00"),
        enc(6, "2026-12-01T19:00:00-03:00"),
      ],
      AGORA
    );
    expect(lista.map((e) => e.numero)).toEqual([6, 5]);
  });

  it("marca adiantado quando a data cruza o número", () => {
    const lista = encontrosPrevistos(
      [
        enc(5, "2026-12-03T19:00:00-03:00"),
        enc(6, "2026-12-01T19:00:00-03:00"),
      ],
      AGORA
    );
    expect(lista.find((e) => e.numero === 6)?.adiantado).toBe(true);
    expect(lista.find((e) => e.numero === 5)?.adiantado).toBe(false);
  });

  it("ordem alinhada (5º antes do 6º nas duas réguas) não marca nada", () => {
    const lista = encontrosPrevistos(
      [
        enc(5, "2026-11-27T19:00:00-03:00"),
        enc(6, "2026-12-01T19:00:00-03:00"),
      ],
      AGORA
    );
    expect(lista.every((e) => !e.adiantado)).toBe(true);
  });
});

describe("o que entra e o que fica de fora", () => {
  it("só agendado/remarcado com data futura — realizado, cancelado, vencido e sem data ficam fora", () => {
    const lista = encontrosPrevistos(
      [
        enc(4, "2026-11-20T19:00:00-03:00", "realizado"),
        enc(5, "2026-11-24T19:00:00-03:00"), // agendado vencido (limbo)
        enc(6, "2026-12-01T19:00:00-03:00", "remarcado"),
        enc(7, "2026-12-08T19:00:00-03:00", "cancelado"),
        enc(8, null),
        enc(9, "2026-12-02T19:00:00-03:00", "nao_aconteceu"),
      ],
      AGORA
    );
    expect(lista.map((e) => e.numero)).toEqual([6]);
  });
});

describe("adiantado com pendente sem data", () => {
  it("passo oficial sem row conta pendente — o agendado de número maior furou a fila", () => {
    const lista = encontrosPrevistos(
      [enc(6, "2026-12-01T19:00:00-03:00")],
      AGORA,
      { numerosOficiais: () => [5, 6] }
    );
    expect(lista[0]?.adiantado).toBe(true);
  });

  it("oficial já realizado não é pendente", () => {
    const lista = encontrosPrevistos(
      [
        enc(5, "2026-11-20T19:00:00-03:00", "realizado"),
        enc(6, "2026-12-01T19:00:00-03:00"),
      ],
      AGORA,
      { numerosOficiais: () => [5, 6] }
    );
    expect(lista[0]?.adiantado).toBe(false);
  });

  it("row fechada (não aconteceu) sem nova data segue pendente", () => {
    const lista = encontrosPrevistos(
      [
        enc(5, "2026-11-20T19:00:00-03:00", "nao_aconteceu"),
        enc(6, "2026-12-01T19:00:00-03:00"),
      ],
      AGORA
    );
    expect(lista[0]?.adiantado).toBe(true);
  });
});

describe("filas separadas (o jovem junta trilhas)", () => {
  it("a pendência de uma dupla não marca o encontro da outra", () => {
    const lista = encontrosPrevistos(
      [
        enc(5, "2026-12-03T19:00:00-03:00", "agendado", { dupla: "dpp" }),
        enc(3, "2026-11-28T19:00:00-03:00", "agendado", { dupla: "esp" }),
        enc(6, "2026-12-01T19:00:00-03:00", "agendado", { dupla: "dpp" }),
      ],
      AGORA,
      { fila: (e) => String((e as { dupla?: string }).dupla ?? "") }
    );
    expect(lista.map((e) => e.numero)).toEqual([3, 6, 5]);
    expect(lista.find((e) => e.numero === 6)?.adiantado).toBe(true);
    // a sessão 3 é a única da fila dela — nada a cruzar
    expect(lista.find((e) => e.numero === 3)?.adiantado).toBe(false);
  });
});
