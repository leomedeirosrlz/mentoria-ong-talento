// REALIZA-387: the terceiros ruler copy asks a suggested floor of 3 and
// presents the guide's mix as suggestion — the per-vínculo prescription
// must never come back as a requirement in displayed strings.
import { describe, expect, it } from "vitest";
import {
  descricaoIndicacao,
  RESUMO_TERCEIROS,
  TERCEIROS_MAX,
  TERCEIROS_PISO_SUGERIDO,
  vagasTerceiros,
} from "@/lib/terceiros/regua";

describe("vagasTerceiros", () => {
  it("counts down from the total cap and clamps at zero", () => {
    expect(vagasTerceiros(0)).toBe(TERCEIROS_MAX);
    expect(vagasTerceiros(4)).toBe(TERCEIROS_MAX - 4);
    expect(vagasTerceiros(TERCEIROS_MAX)).toBe(0);
    expect(vagasTerceiros(TERCEIROS_MAX + 3)).toBe(0);
  });
});

describe("régua copy", () => {
  const textos = [RESUMO_TERCEIROS, descricaoIndicacao(5)];

  it("asks the suggested floor and keeps the total cap", () => {
    for (const t of textos) {
      expect(t).toContain(`pelo menos ${TERCEIROS_PISO_SUGERIDO}`);
      expect(t).toContain(`até ${TERCEIROS_MAX}`);
    }
  });

  it("presents amigos/familiares/colegas as suggestion, not prescription", () => {
    for (const t of textos) {
      expect(t).toContain("sugere");
      expect(t).toMatch(/amigos, familiares e colegas/);
      // the old rule read as a numeric requirement per vínculo
      expect(t).not.toMatch(/3 amigos|3 familiares|3 colegas/);
      expect(t).not.toMatch(/prevê/);
    }
  });

  it("interpolates the remaining slots in the dialog text", () => {
    expect(descricaoIndicacao(7)).toContain("(restam 7)");
    expect(descricaoIndicacao(0)).toContain("(restam 0)");
  });

  it("stays travessão-free (project copy rule)", () => {
    for (const t of textos) {
      expect(t).not.toContain("—");
      expect(t).not.toContain("–");
    }
  });
});
