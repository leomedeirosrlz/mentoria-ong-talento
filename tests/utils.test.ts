import { describe, expect, it } from "vitest";
import {
  cpfValido,
  erroAmigavel,
  normaliza,
  pathInterno,
} from "@/lib/utils";

describe("normaliza", () => {
  it("minúsculas e sem acentos — 'João' casa com 'joao'", () => {
    expect(normaliza("João Vilaça")).toBe("joao vilaca");
    expect(normaliza("ÇÃO ÉRIKA")).toBe("cao erika");
  });

  it("null/undefined viram string vazia", () => {
    expect(normaliza(null)).toBe("");
    expect(normaliza(undefined)).toBe("");
  });
});

describe("pathInterno — guarda contra open redirect", () => {
  it("aceita só '/' e '/caminho' com segundo char válido", () => {
    expect(pathInterno("/")).toBe("/");
    expect(pathInterno("/duplas/123")).toBe("/duplas/123");
    expect(pathInterno("/login?next=/agenda")).toBe("/login?next=/agenda");
  });

  it("'//host' e '/\\host' são externos — null", () => {
    expect(pathInterno("//evil.com")).toBeNull();
    expect(pathInterno("/\\evil.com")).toBeNull();
    expect(pathInterno("https://x.com")).toBeNull();
    expect(pathInterno("")).toBeNull();
    expect(pathInterno(null)).toBeNull();
  });
});

describe("erroAmigavel — tradução de erros do Postgres pra UI", () => {
  it("P0001 conhecido do domínio vira copy própria (não o texto cru do trigger)", () => {
    expect(
      erroAmigavel({ code: "P0001", message: "apenas a coordenacao resolve pedidos de apoio" })
    ).toBe("Somente a coordenação pode atender um pedido de apoio.");
    expect(
      erroAmigavel({ code: "P0001", message: "capacidade do mentor excedida" })
    ).toBe("Esse mentor já atingiu o número máximo de duplas.");
    expect(erroAmigavel({ code: "P0001", message: "autoria forjada" })).toBe(
      "Não foi possível concluir. Recarregue a página e tente de novo."
    );
    expect(
      erroAmigavel({ code: "P0001", message: "created_by não pode ser forjado" })
    ).toBe("Não foi possível concluir. Recarregue a página e tente de novo.");
  });

  it("23505 (unique) especializa por coluna: e-mail e whatsapp", () => {
    expect(
      erroAmigavel({
        code: "23505",
        message: 'duplicate key value violates unique constraint "profiles_email_key"',
      })
    ).toBe("Esse e-mail já está cadastrado.");
    expect(
      erroAmigavel({
        code: "23505",
        message: 'duplicate key value violates unique constraint "profiles_whatsapp_key"',
      })
    ).toBe("Esse WhatsApp já está cadastrado em outra pessoa.");
    // sem a coluna na mensagem, cai no genérico — inclusive quando só o texto veio
    expect(
      erroAmigavel({ message: "duplicate key value violates unique constraint" })
    ).toBe("Já existe um cadastro com esses dados.");
    expect(erroAmigavel({ code: "23505", message: "uq_duvidoso" })).toBe(
      "Já existe um cadastro com esses dados."
    );
  });

  it("42501 / row-level security → permissão", () => {
    expect(erroAmigavel({ code: "42501", message: "x" })).toBe(
      "Você não tem permissão para essa ação."
    );
    expect(
      erroAmigavel({ message: "new row violates row-level security policy" })
    ).toBe("Você não tem permissão para essa ação.");
  });

  it("23514 / check constraint / invalid input → revise os campos", () => {
    const msg = "Revise os campos: um dos valores não é válido.";
    expect(erroAmigavel({ code: "23514", message: "x" })).toBe(msg);
    expect(erroAmigavel({ message: "violates check constraint" })).toBe(msg);
    expect(erroAmigavel({ message: 'invalid input value for enum' })).toBe(msg);
  });

  it("23503 / foreign key → vinculado a outros dados", () => {
    const msg =
      "Esse cadastro está vinculado a outros dados. Remova os vínculos antes de excluir.";
    expect(erroAmigavel({ code: "23503", message: "x" })).toBe(msg);
    expect(erroAmigavel({ message: "violates foreign key constraint" })).toBe(msg);
  });

  it("erro desconhecido cai no fallback genérico", () => {
    expect(erroAmigavel({ code: "XX000", message: "connection lost" })).toBe(
      "Não foi possível concluir. Tente de novo."
    );
    expect(erroAmigavel({ message: "P0001 sem código", code: undefined })).toBe(
      "Não foi possível concluir. Tente de novo."
    );
  });
});

describe("cpfValido", () => {
  it("aceita CPF válido com ou sem máscara", () => {
    expect(cpfValido("111.444.777-35")).toBe(true);
    expect(cpfValido("11144477735")).toBe(true);
    expect(cpfValido("529.982.247-25")).toBe(true); // caso clássico de DV
  });

  it("rejeita dígitos repetidos, tamanho errado e DV incorreto", () => {
    expect(cpfValido("111.111.111-11")).toBe(false);
    expect(cpfValido("123.456.789-00")).toBe(false);
    expect(cpfValido("123456789")).toBe(false);
    expect(cpfValido("")).toBe(false);
  });
});
