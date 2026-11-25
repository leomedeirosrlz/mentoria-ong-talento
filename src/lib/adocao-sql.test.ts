import { describe, expect, it } from "vitest";
import {
  CONSULTAS_PRESET,
  LIMITE_LINHAS,
  fmtCelula,
  sqlComLimite,
  sqlSomenteLeitura,
} from "./adocao-sql";

describe("sqlSomenteLeitura", () => {
  it("aceita SELECT simples e tira o ponto e vírgula do fim", () => {
    const r = sqlSomenteLeitura("  select * from eventos;  ");
    expect(r).toEqual({ ok: true, sql: "select * from eventos" });
  });

  it("aceita WITH ... SELECT", () => {
    expect(sqlSomenteLeitura("with t as (select 1) select * from t").ok).toBe(
      true
    );
  });

  it("aceita select após comentário inicial", () => {
    expect(
      sqlSomenteLeitura("-- nota\nselect 1").ok
    ).toBe(true);
    expect(
      sqlSomenteLeitura("/* nota */ select 1").ok
    ).toBe(true);
  });

  it("rejeita vazio", () => {
    expect(sqlSomenteLeitura("   ").ok).toBe(false);
    expect(sqlSomenteLeitura(";").ok).toBe(false);
  });

  it("rejeita mais de uma declaração", () => {
    const r = sqlSomenteLeitura("select 1; select 2");
    expect(r.ok).toBe(false);
  });

  it("rejeita o que não começa em select", () => {
    for (const sql of [
      "delete from eventos",
      "drop table eventos",
      "insert into eventos values (1)",
      "attach 'x.db'",
      "copy eventos to 'x.csv'",
      "install httpfs",
      "pragma show_tables",
      "show tables",
      "explain select 1",
      "set x=1",
    ]) {
      expect(sqlSomenteLeitura(sql).ok).toBe(false);
    }
  });

  it("rejeita verbo escondido depois do WITH", () => {
    expect(
      sqlSomenteLeitura(
        "with t as (select 1) insert into eventos select * from t"
      ).ok
    ).toBe(false);
    // create dentro da query
    expect(
      sqlSomenteLeitura("select * from eventos; create table x (a int)").ok
    ).toBe(false);
  });

  it("não bane palavra que só é pedaço de identificador", () => {
    // 'update' dentro de string literal ainda é flag — comportamento
    // documentado; mas identificadores com prefixo/sufixo passam
    expect(
      sqlSomenteLeitura("select updated_at from eventos").ok
    ).toBe(true);
    expect(
      sqlSomenteLeitura("select * from preset_x").ok
    ).toBe(true);
  });
});

describe("sqlComLimite", () => {
  it("embrulha com uma linha a mais que o teto", () => {
    const sql = sqlComLimite("select * from eventos");
    expect(sql).toContain(`limit ${LIMITE_LINHAS + 1}`);
    expect(sql).toContain("select * from eventos");
  });
});

describe("presets", () => {
  it("todos passam no guard de leitura", () => {
    for (const p of CONSULTAS_PRESET) {
      expect(sqlSomenteLeitura(p.sql).ok, p.id).toBe(true);
    }
  });
});

describe("fmtCelula", () => {
  it("null e undefined viram vazio", () => {
    expect(fmtCelula(null)).toBe("");
    expect(fmtCelula(undefined)).toBe("");
  });
  it("data vira dd/mm/aa hh:mm", () => {
    expect(fmtCelula(new Date("2026-11-10T14:30:00Z"))).toMatch(
      /^\d{2}\/\d{2}\/\d{2}/
    );
  });
  it("bigint e number viram número pt-BR", () => {
    expect(fmtCelula(1234)).toBe((1234).toLocaleString("pt-BR"));
    expect(fmtCelula(BigInt(1234567890123))).toMatch(/^1\.234/);
  });
  it("objeto vira json", () => {
    expect(fmtCelula({ a: 1 })).toBe('{"a":1}');
    expect(fmtCelula([1, 2])).toBe("[1,2]");
  });
});
