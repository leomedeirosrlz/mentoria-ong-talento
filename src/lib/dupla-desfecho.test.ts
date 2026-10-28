import { describe, expect, it } from "vitest";
import {
  ehConcluida,
  ehDesistente,
  desfechoLegacy,
  desfechoValido,
  DESFECHO_MOTIVOS,
  DESFECHO_LABEL,
  type DuplaDesfecho,
} from "./dupla-desfecho";

describe("dupla-desfecho", () => {
  it("ehConcluida: só o desfecho 'concluida'", () => {
    expect(ehConcluida({ desfecho: "concluida" })).toBe(true);
    expect(ehConcluida({ desfecho: "desistencia_jovem" })).toBe(false);
    expect(ehConcluida({ desfecho: null })).toBe(false);
    expect(ehConcluida(null)).toBe(false);
  });

  it("ehDesistente: qualquer desfecho != concluida, ou encerrada legada", () => {
    expect(ehDesistente({ desfecho: "desistencia_jovem" })).toBe(true);
    expect(ehDesistente({ desfecho: "remanejada" })).toBe(true);
    expect(ehDesistente({ desfecho: "outro" })).toBe(true);
    expect(ehDesistente({ desfecho: "concluida" })).toBe(false);
    expect(ehDesistente({ desfecho: null, status: "encerrada" })).toBe(true);
    expect(ehDesistente({ desfecho: null, status: "ativa" })).toBe(false);
  });

  it("desfechoLegacy", () => {
    expect(desfechoLegacy("concluida")).toBe("concluida");
    expect(desfechoLegacy("encerrada")).toBe("outro");
    expect(desfechoLegacy("ativa")).toBeNull();
    expect(desfechoLegacy(null)).toBeNull();
  });

  it("desfechoValido exige motivo (exceto concluida) e obs (outro)", () => {
    expect(desfechoValido({ desfecho: null })).not.toBeNull();
    expect(desfechoValido({ desfecho: "concluida" })).toBeNull();
    expect(desfechoValido({ desfecho: "desistencia_jovem" })).not.toBeNull();
    expect(desfechoValido({ desfecho: "desistencia_jovem", motivo: "x" })).toBeNull();
    expect(desfechoValido({ desfecho: "outro", motivo: "x" })).not.toBeNull();
    expect(desfechoValido({ desfecho: "outro", motivo: "x", obs: "y" })).toBeNull();
  });

  it("DESFECHO_LABEL/DESFECHO_MOTIVOS cobrem todos os desfechos", () => {
    for (const d of ["concluida", "desistencia_jovem", "desistencia_mentor", "remanejada", "outro"] as DuplaDesfecho[]) {
      expect(DESFECHO_LABEL[d]).toBeTruthy();
      expect(DESFECHO_MOTIVOS[d]).toBeDefined();
    }
  });
});
