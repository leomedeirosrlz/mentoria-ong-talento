import { describe, expect, it } from "vitest";
import { rotearTier } from "./roteador";

describe("rotearTier", () => {
  it("saudação curta vai pro raso", () => {
    for (const p of ["oi", "fala ai po", "obrigado!", "bom dia"]) {
      expect(rotearTier(p)).toBe("rapido");
    }
  });

  it("curta com interrogação não é saudação — vai pro balanceado", () => {
    expect(rotearTier("tudo bem?")).toBe("balanceado");
    expect(rotearTier("eai?")).toBe("balanceado");
  });

  it("pergunta comum do dia a dia vai pro balanceado", () => {
    expect(rotearTier("como está minha dupla?")).toBe("balanceado");
    expect(rotearTier("quais encontros tem essa semana")).toBe("balanceado");
    expect(rotearTier("o que acontece na semana 3 da trilha dpp?")).toBe(
      "balanceado"
    );
  });

  it("pedido analítico vai pro forte", () => {
    expect(
      rotearTier("analise as duplas em risco e me dê um diagnóstico")
    ).toBe("forte");
    expect(rotearTier("compare a evolução das turmas")).toBe("forte");
    expect(rotearTier("por que a dupla da Maria tá atrasada?")).toBe("forte");
  });

  it("mensagem longa sinaliza contexto rico → forte", () => {
    const longa = `Preciso que você olhe a dupla do João com a Maria. Eles tiveram
      três encontros seguidos com dificuldade, o último registro fala de conflito
      de agenda e a jovem pediu apoio no formulário de sexta. Quero entender se
      compensa remarcar ou trocar o horário fixo deles de vez.`.repeat(2);
    expect(longa.length).toBeGreaterThan(300);
    expect(rotearTier(longa)).toBe("forte");
  });

  it("pós-tool nunca desce pro raso — síntese pede pelo menos balanceado", () => {
    expect(rotearTier("oi", { posTool: true })).toBe("balanceado");
  });
});
