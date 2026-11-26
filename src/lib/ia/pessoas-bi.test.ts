import { describe, expect, it } from "vitest";
import { agregarPessoasBi, faixaIdadeDe, type PessoaBi } from "./pessoas-bi";

const ref = new Date("2026-11-25T12:00:00Z");
const pessoas: PessoaBi[] = [
  { id: "1", nome: "Ana", papel: "mentorado", papeis: ["mentorado"], trilhas: ["dpp"], uf: "SP", genero: "feminino", data_nascimento: "2008-11-26" },
  { id: "2", nome: "Beto", papel: "mentorado", papeis: ["mentorado"], trilhas: ["dpp"], uf: "SP", genero: "masculino", data_nascimento: "2007-11-25" },
  { id: "3", nome: "Cris", papel: "mentor_dpp", papeis: ["mentor_dpp", "mentor_especialista"], trilhas: ["dpp", "especialista"], uf: "RJ", genero: null, data_nascimento: null },
];

describe("pessoas BI", () => {
  it("calcula faixas no aniversário e não expõe data no payload", () => {
    expect(faixaIdadeDe("2008-11-26", ref)).toBe("ate_17");
    expect(faixaIdadeDe("2007-11-25", ref)).toBe("18_24");
    const out = agregarPessoasBi(pessoas, "faixa_idade", {}, 8, ref);
    expect(out.total_pessoas).toBe(3);
    expect(JSON.stringify(out)).not.toMatch(/\d{4}-\d{2}-\d{2}/);
  });
  it("filtra combinação simples jovens de SP por idade", () => {
    const out = agregarPessoasBi(pessoas, "faixa_idade", { papel: "mentorado", uf: "sp" as never }, 8, ref);
    expect(out.total_pessoas).toBe(2);
    expect(out.grupos.find((g) => g.chave === "18_24")?.pessoas).toBe(1);
  });
  it("papel e trilha são participação múltipla, com top N e outros", () => {
    const out = agregarPessoasBi(pessoas, "trilha", {}, 1, ref);
    expect(out.participacao_multipla).toBe(true);
    expect(out.grupos).toHaveLength(1);
    expect(out.outros?.pessoas).toBeGreaterThan(0);
  });
});
