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
  it("título nomeia a dimensão e recorte traduz os filtros aplicados", () => {
    const out = agregarPessoasBi(pessoas, "estado", { papel: "mentorado", uf: "sp" }, 8, ref);
    expect(out.titulo).toBe("Pessoas por estado (UF)");
    expect(out.recorte).toBe("Mentorado · SP");
    expect(agregarPessoasBi(pessoas, "genero", {}, 8, ref).recorte).toBe("");
  });
  it("faixa segue a ordem da idade, não o tamanho da fatia", () => {
    const base: PessoaBi[] = [
      { id: "a", nome: "V", papel: "mentor_dpp", papeis: ["mentor_dpp"], trilhas: [], uf: null, genero: null, data_nascimento: "1970-01-01" },
      { id: "b", nome: "V", papel: "mentor_dpp", papeis: ["mentor_dpp"], trilhas: [], uf: null, genero: null, data_nascimento: "1971-01-01" },
      { id: "c", nome: "V", papel: "mentor_dpp", papeis: ["mentor_dpp"], trilhas: [], uf: null, genero: null, data_nascimento: "2009-01-01" },
    ];
    const out = agregarPessoasBi(base, "faixa_idade", {}, 8, ref);
    // 35+ tem 2 e ate_17 tem 1 — contagem perderia pra ordem da idade
    expect(out.grupos.map((g) => g.chave)).toEqual(["ate_17", "35_mais"]);
  });
  it("trilha segue o vocabulário (dpp, especialista, sem trilha)", () => {
    const out = agregarPessoasBi(pessoas, "trilha", {}, 8, ref);
    expect(out.grupos.map((g) => g.chave)).toEqual(["dpp", "especialista"]);
    expect(out.grupos.map((g) => g.rotulo)).toEqual(["DPP", "Especialista"]);
  });
  it("o buraco 'não informado' fecha a lista, mesmo sendo o maior", () => {
    const base: PessoaBi[] = [
      { id: "a", nome: "V", papel: "mentor_dpp", papeis: ["mentor_dpp"], trilhas: [], uf: null, genero: null, data_nascimento: null },
      { id: "b", nome: "V", papel: "mentor_dpp", papeis: ["mentor_dpp"], trilhas: [], uf: null, genero: null, data_nascimento: null },
      { id: "c", nome: "V", papel: "mentor_dpp", papeis: ["mentor_dpp"], trilhas: [], uf: "BA", genero: null, data_nascimento: null },
    ];
    const out = agregarPessoasBi(base, "estado", {}, 8, ref);
    expect(out.grupos.map((g) => g.chave)).toEqual(["BA", "__nao_informado"]);
    expect(out.grupos[1].rotulo).toBe("Não informado");
  });
  it("gênero nulo também vira 'não informado', nunca chave crua", () => {
    const out = agregarPessoasBi(pessoas, "genero", {}, 8, ref);
    const buraco = out.grupos.find((g) => g.chave === "__nao_informado");
    expect(buraco?.rotulo).toBe("Não informado");
    expect(buraco?.pessoas).toBe(1);
  });
  it("filtro por trilha usa as trilhas vivas, não o papel nominal", () => {
    const out = agregarPessoasBi(pessoas, "estado", { trilha: "especialista" }, 8, ref);
    // só a Cris participa de especialista — os dois jovens são DPP
    expect(out.total_pessoas).toBe(1);
    expect(out.grupos[0].chave).toBe("RJ");
  });
  it("linhas de exemplo não levam contato nem data, só rótulos", () => {
    const out = agregarPessoasBi(pessoas, "estado", {}, 8, ref);
    expect(out.linhas).toHaveLength(3);
    const linha = out.linhas.find((l) => l.nome === "Cris");
    expect(linha?.papel).toBe("Mentor DPP + especialista");
    expect(linha?.faixa_idade).toBe("Não informada");
    expect(JSON.stringify(out.linhas)).not.toMatch(/\d{4}-\d{2}-\d{2}/);
  });
  it("universo muda com incluir_inativas", () => {
    expect(agregarPessoasBi(pessoas, "estado", {}, 8, ref).universo).toBe("pessoas ativas");
    expect(
      agregarPessoasBi(pessoas, "estado", { incluir_inativas: true }, 8, ref).universo
    ).toBe("pessoas cadastradas");
  });
});
