import { describe, expect, it } from "vitest";
import { msgPlanoCombinado } from "./whatsapp-msgs";

// O aviso do plano é o único link que sai do app: quem aperta "Avisar por
// WhatsApp" é o próprio mentor, então a frase tem que falar em primeira
// pessoa; staff avisando em nome de outro continua nomeando quem propôs.
describe("msgPlanoCombinado", () => {
  const href = "https://staging.realiza.vc/jovem/combinado";

  it("mentor mandando o próprio convite fala em primeira pessoa", () => {
    const txt = msgPlanoCombinado({ paraNome: "Bia", href });
    expect(txt).toContain("eu combinei um plano de encontros");
    expect(txt).not.toContain("combinou um plano");
    expect(txt).toContain(href);
  });

  it("staff avisando em nome de outra pessoa mantém o nome", () => {
    const txt = msgPlanoCombinado({ paraNome: "Bia", quem: "Liza", href });
    expect(txt).toContain("Liza combinou um plano de encontros");
  });
});
