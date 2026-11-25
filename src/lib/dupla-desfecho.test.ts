import { describe, expect, it } from "vitest";
import {
  ehConcluida,
  ehDesistente,
  situacaoDaDupla,
  desfechoLegacy,
  desfechoValido,
  DESFECHO_MOTIVOS,
  DESFECHO_LABEL,
  SITUACAO_DUPLA_LABEL,
  type DuplaDesfecho,
  type SituacaoDupla,
} from "./dupla-desfecho";

describe("dupla-desfecho", () => {
  it("ehConcluida: só o desfecho 'concluida'", () => {
    expect(ehConcluida({ desfecho: "concluida" })).toBe(true);
    expect(ehConcluida({ desfecho: "desistencia_jovem" })).toBe(false);
    expect(ehConcluida({ desfecho: null })).toBe(false);
    expect(ehConcluida(null)).toBe(false);
  });

  it("ehDesistente: só desistencia_* ou encerrada legada sem desfecho", () => {
    expect(ehDesistente({ desfecho: "desistencia_jovem" })).toBe(true);
    expect(ehDesistente({ desfecho: "desistencia_mentor" })).toBe(true);
    // encerramento formal da coordenação NÃO é desistência
    expect(ehDesistente({ desfecho: "remanejada" })).toBe(false);
    expect(ehDesistente({ desfecho: "outro" })).toBe(false);
    expect(ehDesistente({ desfecho: "concluida" })).toBe(false);
    // legado: encerrada sem desfecho segue lendo "Desistente"
    expect(ehDesistente({ desfecho: null, status: "encerrada" })).toBe(true);
    expect(ehDesistente({ desfecho: null, status: "ativa" })).toBe(false);
    expect(ehDesistente(null)).toBe(false);
  });

  it("situacaoDaDupla: o mapa canônico de status + desfecho", () => {
    const casos: [Parameters<typeof situacaoDaDupla>[0], SituacaoDupla][] = [
      [{ status: "ativa" }, "andamento"],
      [{ status: "pausada" }, "pausada"],
      [{ status: "concluida" }, "concluida"],
      [{ status: "encerrada", desfecho: "concluida" }, "concluida"],
      [{ status: "encerrada", desfecho: "desistencia_jovem" }, "desistente"],
      [{ status: "encerrada", desfecho: "desistencia_mentor" }, "desistente"],
      [{ status: "encerrada", desfecho: null }, "desistente"], // legado
      [{ status: "encerrada", desfecho: "remanejada" }, "encerrada"],
      [{ status: "encerrada", desfecho: "outro" }, "encerrada"],
      [{ status: "encerrada" }, "desistente"], // desfecho ausente = legado
      // desfecho terminal vale mesmo fora de status='encerrada'
      [{ status: "ativa", desfecho: "remanejada" }, "encerrada"],
      [null, "andamento"],
      [{ status: "algo_novo" }, "andamento"],
    ];
    for (const [d, esperada] of casos) {
      expect(situacaoDaDupla(d)).toBe(esperada);
      expect(SITUACAO_DUPLA_LABEL[esperada]).toBeTruthy();
    }
  });

  it("desfechoLegacy", () => {
    expect(desfechoLegacy("concluida")).toBe("concluida");
    expect(desfechoLegacy("encerrada")).toBe("outro");
    expect(desfechoLegacy("ativa")).toBeNull();
    expect(desfechoLegacy(null)).toBeNull();
  });

  it("desfechoValido exige motivo em todo não-concluida — 'outro' incluso, obs nunca exigida", () => {
    expect(desfechoValido({ desfecho: null })).not.toBeNull();
    expect(desfechoValido({ desfecho: "concluida" })).toBeNull();
    expect(desfechoValido({ desfecho: "desistencia_jovem" })).not.toBeNull();
    expect(desfechoValido({ desfecho: "desistencia_jovem", motivo: "x" })).toBeNull();
    // 'outro' exige o MOTIVO em texto livre, não a observação — a obs
    // voltou a ser opcional em qualquer desfecho (REALIZA-392)
    expect(desfechoValido({ desfecho: "outro" })).not.toBeNull();
    expect(desfechoValido({ desfecho: "outro", obs: "y" })).not.toBeNull();
    expect(desfechoValido({ desfecho: "outro", motivo: "x" })).toBeNull();
    expect(desfechoValido({ desfecho: "outro", motivo: "x", obs: "y" })).toBeNull();
  });

  it("DESFECHO_LABEL/DESFECHO_MOTIVOS cobrem todos os desfechos", () => {
    for (const d of ["concluida", "desistencia_jovem", "desistencia_mentor", "remanejada", "outro"] as DuplaDesfecho[]) {
      expect(DESFECHO_LABEL[d]).toBeTruthy();
      expect(DESFECHO_MOTIVOS[d]).toBeDefined();
    }
  });

  it("vocabulário dos motivos (REALIZA-392): abandono/nunca-iniciou por lado, rompimento nos dois", () => {
    expect(DESFECHO_MOTIVOS.desistencia_mentor).toContain("Abandono (sumiu, não responde)");
    expect(DESFECHO_MOTIVOS.desistencia_mentor).toContain("Nunca iniciou (não compareceu)");
    expect(DESFECHO_MOTIVOS.desistencia_mentor).toContain("Rompimento da relação (conflito/perda de confiança)");
    expect(DESFECHO_MOTIVOS.desistencia_jovem).toContain("Nunca iniciou");
    expect(DESFECHO_MOTIVOS.desistencia_jovem).toContain("Rompimento da relação (conflito/perda de confiança)");
    // 'outro' segue sem opções: motivo em texto livre (o dialog rende input)
    expect(DESFECHO_MOTIVOS.outro).toHaveLength(0);
    // motivo nunca se repete dentro da mesma lista
    for (const lista of Object.values(DESFECHO_MOTIVOS)) {
      expect(new Set(lista).size).toBe(lista.length);
    }
  });
});
