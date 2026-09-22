import { describe, expect, it } from "vitest";
import { gravatarUrl, iniciais } from "@/lib/avatar";
import {
  dadosAutorizacaoDe,
  dadosCivisDe,
  dataPorExtenso,
  enderecoLinha,
  preambuloAutorizacao,
} from "@/lib/documentos/texto";
import type { Assinatura, DadosAutorizacao, DadosCivis, Endereco } from "@/lib/types";

describe("iniciais", () => {
  it("primeira + última palavra; nome único pega 2 letras", () => {
    expect(iniciais("Thiago Costa")).toBe("TC");
    expect(iniciais("madalena")).toBe("MA");
    expect(iniciais("Ana Maria de Souza")).toBe("AS");
    expect(iniciais("   ")).toBe("?");
    expect(iniciais("")).toBe("?");
  });
});

describe("gravatarUrl", () => {
  it("md5 do e-mail normalizado + fallback 404", () => {
    const url = gravatarUrl("ANA@X.COM ");
    expect(url).toMatch(/^https:\/\/www\.gravatar\.com\/avatar\/[0-9a-f]{32}\?s=128&d=404$/);
    // trim + lowercase: mesma hash do e-mail limpo
    expect(gravatarUrl(" ana@x.com")).toBe(gravatarUrl("ana@x.com"));
    expect(gravatarUrl("a@b.com", 256)).toContain("s=256");
  });
});

describe("documentos/texto — helpers de snapshot", () => {
  const endereco: Endereco = {
    logradouro: "Rua dos Pinheiros",
    numero: "706",
    complemento: "Casa 6",
    bairro: "Pinheiros",
    cidade: "São Paulo",
    uf: "SP",
    cep: "05422900",
  };

  it("enderecoLinha formata com complemento e CEP mascarado", () => {
    expect(enderecoLinha(endereco)).toBe(
      "Rua dos Pinheiros 706 Casa 6 - Pinheiros - São Paulo - SP - CEP 05422-900"
    );
    expect(enderecoLinha({ ...endereco, complemento: null })).toBe(
      "Rua dos Pinheiros 706 - Pinheiros - São Paulo - SP - CEP 05422-900"
    );
  });

  it("dataPorExtenso fixa São Paulo e o mês por extenso", () => {
    expect(dataPorExtenso("2025-10-14T15:00:00-03:00")).toBe(
      "São Paulo, 14 de outubro de 2025"
    );
  });

  it("dadosCivisDe / dadosAutorizacaoDe discriminam o snapshot", () => {
    const civis: DadosCivis = {
      nome_civil: "Maria Silva",
      rg: "12.345.678-9",
      cpf: "11144477735",
      data_nascimento: "1990-01-01",
      endereco,
    };
    const autorizacao: DadosAutorizacao = {
      mentorado_nome: "João",
      responsavel: { ...civis, parentesco: "mãe" },
    };
    const aCivis = { dados_snapshot: civis } as Assinatura;
    const aAuto = { dados_snapshot: autorizacao } as Assinatura;
    const aVazia = { dados_snapshot: null } as Assinatura;

    expect(dadosCivisDe(aCivis)?.nome_civil).toBe("Maria Silva");
    expect(dadosCivisDe(aAuto)).toBeNull(); // snapshot de autorização não é civis
    expect(dadosAutorizacaoDe(aAuto)?.responsavel.parentesco).toBe("mãe");
    expect(dadosAutorizacaoDe(aCivis)).toBeNull();
    expect(dadosCivisDe(aVazia)).toBeNull();
  });

  it("preambuloAutorizacao põe nomes em caixa alta e o parentesco", () => {
    const d: DadosAutorizacao = {
      mentorado_nome: "joão souza",
      responsavel: {
        nome_civil: "maria silva",
        rg: "123",
        cpf: "11144477735",
        data_nascimento: null,
        endereco,
        parentesco: "mãe",
      },
    };
    const [p1] = preambuloAutorizacao(d);
    expect(p1).toContain("MARIA SILVA");
    expect(p1).toContain("JOÃO SOUZA");
    expect(p1).toContain("111.444.777-35"); // CPF mascarado
  });
});
