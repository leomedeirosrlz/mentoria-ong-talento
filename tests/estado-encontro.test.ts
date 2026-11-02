import { describe, expect, it } from "vitest";
import { estadoDaSemana, estadoDoEncontro } from "@/lib/estado-encontro";
import type { Encontro } from "@/lib/types";

// quarta 07/10/2026, 20h (instantes com offset explícito)
const AGORA = Date.parse("2026-10-07T20:00:00-03:00");
const ONTEM = "2026-10-06T19:00:00-03:00";
const AMANHA = "2026-10-08T19:00:00-03:00";

function mk(over: Partial<Encontro>): Encontro {
  return {
    id: "e1",
    dupla_id: "d1",
    numero: 5,
    data_hora: AMANHA,
    duracao_min: 60,
    status: "agendado",
    origem: "plataforma",
    link: null,
    created_by: null,
    created_at: ONTEM,
    realizado_em: null,
    motivo_reagendamento: null,
    registro: null,
    ...over,
  } as Encontro;
}

const REGISTRO = { id: "r1" } as Encontro["registro"];

describe("estadoDoEncontro", () => {
  it("agendado no futuro é agendado", () => {
    expect(estadoDoEncontro(mk({}), AGORA)).toBe("agendado");
  });
  it("agendado vencido sem registro (limbo) é pendente", () => {
    expect(estadoDoEncontro(mk({ data_hora: ONTEM }), AGORA)).toBe("pendente");
  });
  it("realizado sem registro é pendente; com registro, registrado", () => {
    expect(estadoDoEncontro(mk({ status: "realizado", data_hora: ONTEM }), AGORA)).toBe(
      "pendente"
    );
    expect(
      estadoDoEncontro(mk({ status: "realizado", data_hora: ONTEM, registro: REGISTRO }), AGORA)
    ).toBe("registrado");
  });
  it("não aconteceu e cancelado", () => {
    expect(estadoDoEncontro(mk({ status: "nao_aconteceu" }), AGORA)).toBe("nao_aconteceu");
    expect(estadoDoEncontro(mk({ status: "cancelado" }), AGORA)).toBe("nao_aconteceu");
  });
});

describe("estadoDaSemana", () => {
  it("sem duplas fica neutro", () => {
    expect(estadoDaSemana([], true, AGORA)).toBeNull();
  });
  it("semana começada sem encontro marcado é pendente; futura é por vir", () => {
    expect(estadoDaSemana([null], true, AGORA)).toBe("pendente");
    expect(estadoDaSemana([null], false, AGORA)).toBe("por_vir");
  });
  it("não aconteceu segue devendo reposição", () => {
    expect(estadoDaSemana([mk({ status: "nao_aconteceu" })], true, AGORA)).toBe("pendente");
  });
  it("agendado e registrado", () => {
    expect(estadoDaSemana([mk({})], true, AGORA)).toBe("agendado");
    expect(
      estadoDaSemana(
        [mk({ status: "realizado", data_hora: ONTEM, registro: REGISTRO })],
        true,
        AGORA
      )
    ).toBe("registrado");
  });
  it("o pior estado entre as duplas manda", () => {
    const registrado = mk({ status: "realizado", data_hora: ONTEM, registro: REGISTRO });
    expect(estadoDaSemana([registrado, mk({})], true, AGORA)).toBe("agendado");
    expect(estadoDaSemana([registrado, null], true, AGORA)).toBe("pendente");
  });
});
