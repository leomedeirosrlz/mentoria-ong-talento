import { describe, expect, it } from "vitest";
import { cepNormalizado, parseViaCep } from "@/lib/viacep";

// REALIZA-37 — o parser puro do ViaCEP: a whitelist de campos é a fronteira
// entre "payload do correio" e "o que o formulário aceita".

describe("cepNormalizado", () => {
  it("aceita 8 dígitos, com ou sem máscara", () => {
    expect(cepNormalizado("01310100")).toBe("01310100");
    expect(cepNormalizado("01310-100")).toBe("01310100");
  });

  it("rejeita incompleto, longo demais, letras e vazio", () => {
    for (const v of ["0131010", "013101000", "abcdefgh", "", null, undefined]) {
      expect(cepNormalizado(v)).toBeNull();
    }
  });
});

describe("parseViaCep", () => {
  it("resposta ok mapeia localidade→cidade e normaliza UF", () => {
    expect(
      parseViaCep({
        logradouro: "Avenida Paulista",
        bairro: "Bela Vista",
        localidade: "São Paulo",
        uf: "sp",
        complemento: "lado ímpar",
        ibge: "3550308",
      })
    ).toEqual({
      kind: "ok",
      endereco: {
        logradouro: "Avenida Paulista",
        bairro: "Bela Vista",
        cidade: "São Paulo",
        uf: "SP",
      },
    });
  });

  it("{erro:true} é não encontrado, não falha", () => {
    expect(parseViaCep({ erro: true })).toEqual({ kind: "nao_encontrado" });
  });

  it("CEP de cidade única (sem logradouro/bairro) é ok com campos vazios", () => {
    expect(
      parseViaCep({ logradouro: "", bairro: "", localidade: "São Luís", uf: "MA" })
    ).toEqual({
      kind: "ok",
      endereco: { logradouro: "", bairro: "", cidade: "São Luís", uf: "MA" },
    });
  });

  it("resposta malformada ou sem cidade/UF é erro, nunca ok de mentira", () => {
    for (const json of [
      null,
      "qualquer coisa",
      {},
      { localidade: "São Paulo" }, // sem UF
      { uf: "SP" }, // sem cidade
      { localidade: "X", uf: "XYZ" }, // UF fora do formato
    ]) {
      expect(parseViaCep(json).kind).toBe("erro");
    }
  });
});
