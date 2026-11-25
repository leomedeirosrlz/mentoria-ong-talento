import { describe, expect, it } from "vitest";
import {
  avaliarRubrica,
  casosDoPapel,
  listarCasosLive,
} from "@/lib/ia/evals";

describe("evals — corpus", () => {
  it("casos live existem e carregam id + papel", () => {
    const casos = listarCasosLive();
    expect(casos.length).toBeGreaterThan(0);
    for (const c of casos) {
      expect(c.id).toBeTruthy();
      expect(["qualquer", "staff", "mentorado"]).toContain(c.papel_esperado);
      expect(c.msg.length).toBeGreaterThan(2);
    }
  });

  it("casosDoPapel: mentorado vê os dele + 'qualquer', nunca os de staff", () => {
    const doJovem = casosDoPapel("mentorado");
    expect(
      doJovem.every(
        (c) => c.papel_esperado === "mentorado" || c.papel_esperado === "qualquer"
      )
    ).toBe(true);
    const doStaff = casosDoPapel("staff");
    expect(doStaff.some((c) => c.papel_esperado === "staff")).toBe(true);
  });

  it("casosDoPapel honra o subconjunto casoIds", () => {
    const todos = casosDoPapel("staff");
    const um = casosDoPapel("staff", [todos[0].id]);
    expect(um).toHaveLength(1);
    expect(um[0].id).toBe(todos[0].id);
    expect(casosDoPapel("staff", ["nao-existe"])).toHaveLength(0);
  });
});

describe("evals — avaliarRubrica (mesma regra do eval-ia.mjs)", () => {
  const rubrica = {
    tools_esperadas: ["resumo_semana", "ficha_dupla"],
    tools_nao_pode: ["abrir_chamado"],
    resposta_contem: ["dupla"],
    resposta_nao_contem: ["semáforo"],
  };

  it("passa quando tools certas vieram e o texto obedece", () => {
    const r = avaliarRubrica(
      rubrica,
      ["resumo_semana"],
      "Temos 3 duplas em atenção.",
      true,
      null
    );
    expect(r.pass).toBe(true);
    expect(r.detalhe).toBeNull();
  });

  it("falha quando a tool esperada não veio", () => {
    const r = avaliarRubrica(rubrica, ["meu_progresso"], "dupla", true, null);
    expect(r.pass).toBe(false);
    expect(r.detalhe).toContain("nenhuma tool");
  });

  it("falha quando uma tool proibida vazou", () => {
    const r = avaliarRubrica(
      rubrica,
      ["resumo_semana", "abrir_chamado"],
      "dupla",
      true,
      null
    );
    expect(r.pass).toBe(false);
    expect(r.detalhe).toContain("tool proibida");
  });

  it("falha com regex proibida no texto e com stream cortado", () => {
    const r1 = avaliarRubrica(rubrica, ["resumo_semana"], "dupla no semáforo", true, null);
    expect(r1.detalhe).toContain("resposta COM");
    const r2 = avaliarRubrica(rubrica, ["resumo_semana"], "dupla", false, null);
    expect(r2.detalhe).toContain("stream sem done");
    const r3 = avaliarRubrica(rubrica, ["resumo_semana"], "dupla", true, "boom");
    expect(r3.detalhe).toContain("erro no stream");
  });
});
