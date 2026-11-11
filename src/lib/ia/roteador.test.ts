import { describe, expect, it } from "vitest";
import { papelDecisivo, rotearTier, tarefaDaPergunta } from "./roteador";

describe("tarefaDaPergunta", () => {
  it("saudação curta e mensagem curta fora de domínio viram saudacao", () => {
    expect(tarefaDaPergunta("oi")).toBe("saudacao");
    expect(tarefaDaPergunta("obrigado!")).toBe("saudacao");
    expect(tarefaDaPergunta("fala ai po")).toBe("saudacao");
  });

  it("pergunta comum sem padrão analítico é leitura", () => {
    expect(tarefaDaPergunta("como está minha dupla?")).toBe("leitura");
    expect(tarefaDaPergunta("encontro 12")).toBe("leitura");
    expect(tarefaDaPergunta("tudo bem?")).toBe("leitura");
  });

  it("padrão complexo ou mensagem longa viram analise", () => {
    expect(tarefaDaPergunta("analise as duplas em risco")).toBe("analise");
    expect(tarefaDaPergunta("cruza os atrasos com as notas")).toBe("analise");
    expect(tarefaDaPergunta("x".repeat(301))).toBe("analise");
  });

  it("pós-tool é sintese independente do texto", () => {
    expect(tarefaDaPergunta("ok", { posTool: true })).toBe("sintese");
    expect(tarefaDaPergunta("oi", { posTool: true })).toBe("sintese");
  });
});

describe("papelDecisivo", () => {
  it("staff primeiro — é o papel que libera o forte", () => {
    expect(papelDecisivo(["mentor_dpp", "coordenacao"])).toBe("coordenacao");
    expect(papelDecisivo(["mentorado", "supervisor"])).toBe("supervisor");
  });

  it("sem staff vale o primeiro papel da lista", () => {
    expect(papelDecisivo(["mentor_dpp", "mentor_especialista"])).toBe(
      "mentor_dpp"
    );
    expect(papelDecisivo("mentorado")).toBe("mentorado");
  });

  it("ausente/vazio devolve null (não-staff)", () => {
    expect(papelDecisivo(null)).toBeNull();
    expect(papelDecisivo(undefined)).toBeNull();
    expect(papelDecisivo([])).toBeNull();
  });
});

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

  it("pedido analítico de staff vai pro forte", () => {
    for (const papel of ["coordenacao", "supervisor"] as const) {
      expect(
        rotearTier("analise as duplas em risco e me dê um diagnóstico", {
          papel,
        })
      ).toBe("forte");
      expect(rotearTier("compare a evolução das turmas", { papel })).toBe(
        "forte"
      );
      expect(
        rotearTier("por que a dupla da Maria tá atrasada?", { papel })
      ).toBe("forte");
    }
  });

  it("analise de mentor/jovem capa no balanceado — não-staff nunca sobe a forte", () => {
    const msg = "analise as duplas em risco e me dê um diagnóstico";
    for (const papel of [
      "mentor_dpp",
      "mentor_especialista",
      "mentorado",
    ] as const) {
      expect(rotearTier(msg, { papel })).toBe("balanceado");
    }
  });

  it("sem papel, analise cai no balanceado (fail-closed)", () => {
    const msg = "analise as duplas em risco e me dê um diagnóstico";
    expect(rotearTier(msg)).toBe("balanceado");
    expect(rotearTier(msg, { papel: null })).toBe("balanceado");
    expect(rotearTier(msg, { papel: [] })).toBe("balanceado");
  });

  it("híbrido com staff no array libera o forte", () => {
    expect(
      rotearTier("analise as duplas em risco", {
        papel: ["mentor_dpp", "coordenacao"],
      })
    ).toBe("forte");
  });

  it("mensagem longa de staff sinaliza contexto rico → forte", () => {
    const longa = `Preciso que você olhe a dupla do João com a Maria. Eles tiveram
      três encontros seguidos com dificuldade, o último registro fala de conflito
      de agenda e a jovem pediu apoio no formulário de sexta. Quero entender se
      compensa remarcar ou trocar o horário fixo deles de vez.`.repeat(2);
    expect(longa.length).toBeGreaterThan(300);
    expect(rotearTier(longa, { papel: "coordenacao" })).toBe("forte");
    expect(rotearTier(longa, { papel: "mentorado" })).toBe("balanceado");
  });

  it("pós-tool nunca desce pro raso — síntese pede pelo menos balanceado", () => {
    expect(rotearTier("oi", { posTool: true })).toBe("balanceado");
    expect(rotearTier("oi", { posTool: true, papel: "coordenacao" })).toBe(
      "balanceado"
    );
    expect(rotearTier("oi", { posTool: true, papel: "mentorado" })).toBe(
      "balanceado"
    );
  });

  it("piso pós-tool vale até com tarefa explícita contraditória", () => {
    expect(
      rotearTier("oi", { posTool: true, tarefa: "saudacao" })
    ).toBe("balanceado");
  });

  it("tarefa explícita do caller ganha da derivação por formato", () => {
    // mensagem comum mas o caller marcou analise
    expect(
      rotearTier("quais duplas tem essa semana", {
        papel: "coordenacao",
        tarefa: "analise",
      })
    ).toBe("forte");
    // texto analítico mas o caller marcou leitura
    expect(
      rotearTier("analise as duplas em risco", {
        papel: "coordenacao",
        tarefa: "leitura",
      })
    ).toBe("balanceado");
    // analise explícita de não-staff segue capada
    expect(
      rotearTier("oi", { papel: "mentorado", tarefa: "analise" })
    ).toBe("balanceado");
  });
});
