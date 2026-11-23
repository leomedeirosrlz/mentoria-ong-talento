import { describe, expect, it } from "vitest";
import { feriadoNacional } from "@/lib/feriados";

describe("feriadoNacional (513)", () => {
  it.each([
    ["2026-12-25", "Natal"],
    ["2027-01-01", "Confraternização Universal"],
    ["2026-11-20", "Consciência Negra"],
    ["2026-11-15", "Proclamação da República"],
    // Páscoa 2027 = 28/03: Carnaval 08 e 09/02, Sexta-feira Santa 26/03
    ["2027-02-08", "Carnaval"],
    ["2027-02-09", "Carnaval"],
    ["2027-03-26", "Sexta-feira Santa"],
    // Páscoa 2026 = 05/04: Carnaval 16 e 17/02
    ["2026-02-17", "Carnaval"],
  ])("%s é %s", (iso, nome) => {
    expect(feriadoNacional(iso)).toBe(nome);
  });

  it("dia comum e entrada inválida não são feriado", () => {
    expect(feriadoNacional("2026-11-24")).toBeNull();
    // 08/12 é municipal em algumas cidades: o plano não trata
    expect(feriadoNacional("2026-12-08")).toBeNull();
    expect(feriadoNacional("24/12/2026")).toBeNull();
  });
});
