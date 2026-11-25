// Integridade estrutural do banco (supabase/migrations): o repo é um ledger
// e o Postgres remoto só conhece o que já foi aplicado — nada aqui pode ser
// "consertado" depois. Este spec trava as regras que um agente sem contexto
// quebra em silêncio: reuso de número (o `db push` ignora o arquivo e o
// código passa a usar coluna inexistente), tabela criada sem RLS (aberta no
// PostgREST), `security definer` sem `search_path` (função sequestrável) e
// stub de reconciliação carregando DDL.
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const DIR = path.join(process.cwd(), "supabase", "migrations");
const arquivos = readdirSync(DIR).filter((f) => f.endsWith(".sql")).sort();

// lacunas de numeração conhecidas e intencionais — não existem 0039, 0113,
// 0184 nem 0189. 0223/0224 já estão na integração; lacuna nova é erro.
const LACUNAS_CONHECIDAS = [39, 113, 184, 189];

function semComentarios(sql: string): string {
  return sql.replace(/--[^\n]*/g, " ").replace(/\/\*[\s\S]*?\*\//g, " ");
}

describe("migrations — numeração e stubs", () => {
  it("todo arquivo é NNNN_snake_case.sql ou stub de reconciliação", () => {
    const fora = arquivos.filter(
      (f) =>
        !/^\d{4}_[a-z0-9_]+\.sql$/.test(f) && !/^\d{14}_mcp_apply_migration\.sql$/.test(f)
    );
    expect(fora, `nome fora da convenção: ${fora.join(", ")}`).toEqual([]);
  });

  it("prefixo numérico é único e as lacunas são só as conhecidas", () => {
    const numeros = arquivos
      .map((f) => /^(\d{4})_/.exec(f))
      .filter((m): m is RegExpExecArray => m !== null)
      .map((m) => Number(m[1]));
    const repetidos = numeros.filter((n, i) => numeros.indexOf(n) !== i);
    expect(repetidos, "número de migration repetido").toEqual([]);

    const max = Math.max(...numeros);
    const lacunas = [...Array(max).keys()]
      .map((i) => i + 1)
      .filter((n) => !numeros.includes(n));
    // lacuna nova = alguém pulou número sem querer; lacuna fechada = alguém
    // reusou número já aplicado. As duas são erro.
    expect(lacunas).toEqual(LACUNAS_CONHECIDAS);
  });

  it("stub de reconciliação não carrega DDL", () => {
    const stubs = arquivos.filter((f) => /^\d{14}_mcp_apply_migration\.sql$/.test(f));
    for (const f of stubs) {
      const sql = semComentarios(readFileSync(path.join(DIR, f), "utf8"));
      expect(
        sql.replace(/\s+/g, " ").trim(),
        `${f} deveria ser begin; commit; vazio`
      ).toMatch(/^begin\s*;\s*commit\s*;$/i);
    }
  });
});

describe("migrations — RLS e definer", () => {
  const sqlPorArquivo = arquivos.map((f) => ({
    nome: f,
    sql: semComentarios(readFileSync(path.join(DIR, f), "utf8")),
  }));

  it("toda tabela criada tem enable row level security", () => {
    const criadas = new Set<string>();
    const protegidas = new Set<string>();
    for (const { sql } of sqlPorArquivo) {
      for (const m of sql.matchAll(
        /create\s+(?:or\s+replace\s+)?table\s+(?:if\s+not\s+exists\s+)?public\.(\w+)/gi
      ))
        criadas.add(m[1].toLowerCase());
      for (const m of sql.matchAll(
        /alter\s+table\s+public\.(\w+)\s+enable\s+row\s+level\s+security/gi
      ))
        protegidas.add(m[1].toLowerCase());
    }
    const abertas = [...criadas].filter((t) => !protegidas.has(t));
    expect(
      abertas,
      `tabela sem RLS — criar em migration nova, nunca editar a antiga: ${abertas.join(", ")}`
    ).toEqual([]);
  });

  it("nenhuma função security definer fica sem search_path", () => {
    const ruins: string[] = [];
    for (const { nome, sql } of sqlPorArquivo) {
      const blocos = sql.split(/(?=create\s+(?:or\s+replace\s+)?function\b)/i);
      for (const bloco of blocos) {
        if (/security\s+definer/i.test(bloco) && !/search_path/i.test(bloco))
          ruins.push(nome);
      }
    }
    expect(ruins, "função definer sem search_path fixado").toEqual([]);
  });
});
