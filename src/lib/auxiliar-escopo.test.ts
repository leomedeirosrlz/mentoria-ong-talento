import { describe, expect, it } from "vitest";
import {
  duplaSupervisionada,
  escopoAuxiliarDe,
  type PapelEscopo,
} from "./auxiliar-escopo";

// REALIZA-32: a lista de entrada já vem escopada pela RLS (duplas que o
// auxiliar supervisiona direto + as da turma dele + as que ele mentora).
// A regra tira o lado mentor e mantém o resto — o que a ficha, a lista de
// duplas e a agenda da auxiliar usam.
const ME = "sup-1";

const dupla = (
  supervisor: string | null,
  mentor: string
): { supervisor: { id: string } | null; mentor: { id: string } } => ({
  supervisor: supervisor ? { id: supervisor } : null,
  mentor: { id: mentor },
});

describe("duplaSupervisionada", () => {
  it("mantém a supervisionada direta (supervisor_id = eu)", () => {
    expect(duplaSupervisionada(dupla(ME, "mentor-1"), ME)).toBe(true);
  });

  it("mantém a dupla da turma (nem supervisão direta nem mentoria minha)", () => {
    expect(duplaSupervisionada(dupla("sup-2", "mentor-1"), ME)).toBe(true);
    expect(duplaSupervisionada(dupla(null, "mentor-1"), ME)).toBe(true);
  });

  it("tira a dupla que eu mentoro (vive na visão de mentor)", () => {
    expect(duplaSupervisionada(dupla("sup-2", ME), ME)).toBe(false);
    expect(duplaSupervisionada(dupla(null, ME), ME)).toBe(false);
  });

  it("mantém a dupla em que sou mentor E supervisor_id", () => {
    expect(duplaSupervisionada(dupla(ME, ME), ME)).toBe(true);
  });
});

describe("escopoAuxiliarDe", () => {
  const sup = (escopo: string | null, turma: string | null): PapelEscopo => ({
    papel: "supervisor",
    escopo_supervisao: escopo,
    escopo_turma: turma,
  });

  it("sem papel supervisor é o padrão 'duplas'", () => {
    expect(escopoAuxiliarDe([])).toEqual({ modo: "duplas", turma: null });
    expect(
      escopoAuxiliarDe([
        { papel: "mentor_dpp", escopo_supervisao: "turma", escopo_turma: "T1" },
      ])
    ).toEqual({ modo: "duplas", turma: null });
  });

  it("supervisor global 'duplas' é o padrão", () => {
    expect(escopoAuxiliarDe([sup("duplas", null)])).toEqual({
      modo: "duplas",
      turma: null,
    });
  });

  it("grant de turma liga o modo 'turma' com o label", () => {
    expect(
      escopoAuxiliarDe([sup("duplas", null), sup("turma", "2026/2027")])
    ).toEqual({ modo: "turma", turma: "2026/2027" });
  });

  it("papel supervisor escopado em turma sem grant segue 'duplas'", () => {
    expect(escopoAuxiliarDe([sup("duplas", "T1")])).toEqual({
      modo: "duplas",
      turma: null,
    });
  });

  it("'turma' sem escopo_turma não vale (régua do banco)", () => {
    expect(escopoAuxiliarDe([sup("turma", null)])).toEqual({
      modo: "duplas",
      turma: null,
    });
  });
});
