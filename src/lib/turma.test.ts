import { describe, expect, it } from "vitest";
import type { Cronograma } from "./types";
import { resolveTurmaFoco, turmasDisponiveis } from "./turma-contexto";
import { turmaDaDupla, turmaLonga } from "./turma";

// REALIZA-223/225 — o rename de turma congelava o selo `duplas.turma` e o
// filtro casava label-com-label: a turma renomeada aparecia vazia. A 0127
// propaga o selo (trigger) e o app resolve o rótulo VIVO pelo
// `cronograma_id`; estes testes prendem a regra do lado puro.

const crono = (id: string, turma: string, status: Cronograma["status"] = "ativo"): Cronograma => ({
  id,
  nome: `Cronograma ${id}`,
  turma,
  trilha: "dpp",
  inicio_em: null,
  fim_em: null,
  encontros_esperados: null,
  status,
  created_by: null,
  created_at: "2026-01-01T00:00:00Z",
});

const CRONOS = [
  crono("c1", "Turma Aberta - Jovens de ONGs"),
  crono("c2", "Turma Exclusiva - Cidadão Pró-Mundo"),
  crono("c3", "Turma E2E", "rascunho"),
  crono("c4", "2025/2026", "encerrado"),
];

describe("turmaDaDupla — o selo não manda quando o cronograma fala", () => {
  it("devolve o label vivo do cronograma, não o selo congelado", () => {
    expect(
      turmaDaDupla({ cronograma_id: "c1", turma: "2026/2027" }, CRONOS)
    ).toBe("Turma Aberta - Jovens de ONGs");
  });

  it("sem o cronograma na lista recebida, cai no selo (nunca perde o dado)", () => {
    expect(turmaDaDupla({ cronograma_id: "sumiu", turma: "2026/2027" }, CRONOS)).toBe(
      "2026/2027"
    );
  });

  it("dupla de trilha especialista (sem cronograma_id) usa o selo", () => {
    expect(turmaDaDupla({ cronograma_id: null, turma: "Turma E2E" }, CRONOS)).toBe(
      "Turma E2E"
    );
  });

  it("sem selo e sem cronograma devolve null", () => {
    expect(turmaDaDupla({ cronograma_id: null, turma: null }, CRONOS)).toBeNull();
  });
});

describe("resolveTurmaFoco — param por label novo, label velho e id", () => {
  it("resolve o label vivo", () => {
    const foco = resolveTurmaFoco(
      "Turma Aberta - Jovens de ONGs",
      undefined,
      CRONOS
    );
    expect(foco.turma).toBe("Turma Aberta - Jovens de ONGs");
    expect(foco.origem).toBe("param");
    expect(foco.cronogramas.map((c) => c.id)).toEqual(["c1"]);
  });

  it("resolve pelo cronograma_id (o /registros fala em id)", () => {
    const foco = resolveTurmaFoco("c2", undefined, CRONOS);
    expect(foco.turma).toBe("Turma Exclusiva - Cidadão Pró-Mundo");
    expect(foco.origem).toBe("param");
  });

  it("label que não existe em nenhum cronograma falha fechado em 'todas'", () => {
    const foco = resolveTurmaFoco("2026/2027", undefined, CRONOS);
    expect(foco.turma).toBeNull();
    expect(foco.origem).toBe("invalido");
  });

  it("turma encerrada segue endereçável pelo label", () => {
    const foco = resolveTurmaFoco("2025/2026", undefined, CRONOS);
    expect(foco.origem).toBe("param");
    expect(foco.cronogramas.map((c) => c.id)).toEqual(["c4"]);
  });

  it("cookie obsoleto é tratado como ausente, sem apagar a preferência", () => {
    const foco = resolveTurmaFoco(undefined, encodeURIComponent("2026/2027"), CRONOS);
    expect(foco.turma).toBeNull();
    expect(foco.origem).toBe("padrao");
  });

  it("cookie com label vivo resolve", () => {
    const foco = resolveTurmaFoco(
      undefined,
      encodeURIComponent("Turma E2E"),
      CRONOS
    );
    expect(foco.turma).toBe("Turma E2E");
    expect(foco.origem).toBe("cookie");
  });
});

describe("turmasDisponiveis — o seletor", () => {
  it("oferece ativo e rascunho, sem duplicar label nem listar encerrada", () => {
    expect(turmasDisponiveis(CRONOS)).toEqual([
      "Turma Aberta - Jovens de ONGs",
      "Turma E2E",
      "Turma Exclusiva - Cidadão Pró-Mundo",
    ]);
  });

  it("dois cronogramas com o mesmo label viram uma entrada (o foco devolve os dois)", () => {
    const dois = [...CRONOS, crono("c5", "Turma Aberta - Jovens de ONGs")];
    expect(turmasDisponiveis(dois)).toEqual([
      "Turma Aberta - Jovens de ONGs",
      "Turma E2E",
      "Turma Exclusiva - Cidadão Pró-Mundo",
    ]);
    expect(resolveTurmaFoco("Turma Aberta - Jovens de ONGs", undefined, dois).cronogramas)
      .toHaveLength(2);
  });

  it("supervisor sem escopo falha fechado (nenhuma turma nomeada)", () => {
    expect(turmasDisponiveis(CRONOS, { papel: "supervisor" })).toEqual([]);
  });

  it("supervisor vê só o escopo dele", () => {
    expect(
      turmasDisponiveis(CRONOS, { papel: "supervisor", escopoTurmas: ["Turma E2E"] })
    ).toEqual(["Turma E2E"]);
  });

  it("mentor não tem contexto de turma", () => {
    expect(turmasDisponiveis(CRONOS, { papel: "mentor_dpp" })).toEqual([]);
  });
});

describe("rótulo de exibição", () => {
  it("o label livre não é reescrito à força", () => {
    expect(turmaLonga("Turma Aberta - Jovens de ONGs")).toBe(
      "Turma Aberta - Jovens de ONGs"
    );
  });
});
