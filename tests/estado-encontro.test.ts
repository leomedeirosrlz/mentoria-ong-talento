import { describe, expect, it } from "vitest";
import { estadoDaSemana, estadoDoEncontro } from "@/lib/estado-encontro";
import { cobertosDaDupla } from "@/lib/ciclo";
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

const REGISTRO = { id: "r1", tema: "Escuta ativa" } as unknown as Encontro["registro"];
/** Registro legado salvo só com os defaults do form. */
const REGISTRO_VAZIO = {
  id: "r0",
  tema: null,
  reflexoes: null,
  observacoes: null,
  atividades: [],
} as unknown as Encontro["registro"];

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
  it("registro legado sem conteúdo não conta como registrado", () => {
    expect(
      estadoDoEncontro(
        mk({ status: "realizado", data_hora: ONTEM, registro: REGISTRO_VAZIO }),
        AGORA
      )
    ).toBe("pendente");
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
  it("realizado com registro vazio legado ainda é pendente na semana", () => {
    expect(
      estadoDaSemana(
        [mk({ status: "realizado", data_hora: ONTEM, registro: REGISTRO_VAZIO })],
        true,
        AGORA
      )
    ).toBe("pendente");
  });
  it("o pior estado entre as duplas manda", () => {
    const registrado = mk({ status: "realizado", data_hora: ONTEM, registro: REGISTRO });
    expect(estadoDaSemana([registrado, mk({})], true, AGORA)).toBe("agendado");
    expect(estadoDaSemana([registrado, null], true, AGORA)).toBe("pendente");
  });
});

describe("sessão combinada (018) — encontro coberto pela âncora", () => {
  // âncora 5 realizado com o registro da sessão cobrindo o 6; o 6
  // realizado sem row própria — o conteúdo chega via cobertosDaDupla
  const ANCORA = mk({
    id: "e5",
    numero: 5,
    status: "realizado",
    data_hora: ONTEM,
    registro: { ...REGISTRO, cobertura: [5, 6] } as Encontro["registro"],
  });
  const COBERTO = mk({
    id: "e6",
    numero: 6,
    status: "realizado",
    data_hora: ONTEM,
  });
  const MAPA = cobertosDaDupla([ANCORA, COBERTO]);

  it("o mapa liga o coberto na âncora", () => {
    expect(MAPA.get(6)).toBe(5);
    expect(MAPA.has(5)).toBe(false); // âncora não entra como coberta
  });

  it("o coberto lê 'registrado'; sem o mapa ele lê 'pendente' (a falha)", () => {
    expect(estadoDoEncontro(COBERTO, AGORA, MAPA)).toBe("registrado");
    expect(estadoDoEncontro(COBERTO, AGORA)).toBe("pendente");
  });

  it("estadoDaSemana recebe um mapa por posição de dupla", () => {
    expect(estadoDaSemana([COBERTO], true, AGORA, [MAPA])).toBe("registrado");
    expect(estadoDaSemana([COBERTO], true, AGORA)).toBe("pendente");
  });

  it("encontro fora da cobertura segue pendente", () => {
    const fora = mk({ id: "e7", numero: 7, status: "realizado", data_hora: ONTEM });
    expect(estadoDoEncontro(fora, AGORA, MAPA)).toBe("pendente");
  });
});
