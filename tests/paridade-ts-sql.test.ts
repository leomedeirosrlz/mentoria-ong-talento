// Paridade TS × SQL dos vocabulários fechados — a divergência passa em
// build e some com o dado: uma `acao` nova em AcaoProduto sem a linha na
// whitelist da RPC é descartada em silêncio pelo `where e.acao in (...)`;
// uma audiência nova no TS que o check do banco não conhece vira material
// invisível pra todo mundo (a RLS não sabe ler o valor). Este spec amarra
// os dois lados comparando CONJUNTOS: o TS é importado de verdade onde é
// const (AUDIENCIAS, ROLES_POR_AUDIENCIA) e parseado onde é tipo
// (AcaoProduto); o SQL é sempre a ÚLTIMA migration que define a peça —
// o ledger é imutável, a vigente é a que manda.
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { AUDIENCIAS } from "@/lib/materiais";
import { ROLES_POR_AUDIENCIA } from "@/lib/email";

const ROOT = process.cwd();
const MIG = path.join(ROOT, "supabase", "migrations");
const arquivos = readdirSync(MIG).filter((f) => f.endsWith(".sql")).sort();

const sqlDe = (nome: string) =>
  readFileSync(path.join(MIG, nome), "utf8").replace(/--[^\n]*/g, " ");

/** Última migration (ordem do ledger) cujo conteúdo satisfaz o predicado
 *  — é ela que o remoto tem hoje, não a mais antiga. */
function vigente(pred: (sql: string) => boolean): { nome: string; sql: string } {
  const achadas = arquivos.filter((f) => pred(sqlDe(f)));
  if (!achadas.length) throw new Error("nenhuma migration vigente achada");
  const nome = achadas[achadas.length - 1];
  return { nome, sql: sqlDe(nome) };
}

const literais = (s: string) => [...s.matchAll(/'([^']+)'/g)].map((m) => m[1]);
const mesmoConjunto = (a: readonly string[], b: readonly string[]) =>
  expect([...a].sort()).toEqual([...b].sort());

describe("produto_eventos — acao do TS é a whitelist da RPC vigente", () => {
  it("AcaoProduto e o `where e.acao in` dizem a mesma lista", () => {
    const ts = readFileSync(
      path.join(ROOT, "src", "lib", "produto-eventos.ts"),
      "utf8"
    );
    const uniao = /export type AcaoProduto =([\s\S]*?);/.exec(ts);
    expect(uniao, "união AcaoProduto não achada").toBeTruthy();
    const acoesTs = [...uniao![1].matchAll(/"([^"]+)"/g)].map((m) => m[1]);
    expect(acoesTs.length).toBeGreaterThan(0);

    const { nome, sql } = vigente((s) =>
      /function\s+public\.registrar_produto_eventos\b/i.test(s)
    );
    const lista = /e\.acao\s+in\s*\(([^)]*)\)/i.exec(sql);
    expect(lista, `whitelist não achada em ${nome}`).toBeTruthy();
    mesmoConjunto(acoesTs, literais(lista![1]));
  });
});

describe("materiais — AUDIENCIAS do TS é o check e os ramos da 0139", () => {
  const { nome, sql } = vigente((s) => /materiais_audiencias_check/i.test(s));

  it("toda audiência do TS está no array do constraint — e nada a mais", () => {
    const arr = /audiencias\s*<@\s*array\[([^\]]*)\]/i.exec(sql);
    expect(arr, `array do check não achado em ${nome}`).toBeTruthy();
    mesmoConjunto(AUDIENCIAS, literais(arr![1]));
  });

  it.each([
    ["materiais_select", "RLS da tabela"],
    ["materiais_storage_select", "RLS do storage"],
  ])("cada audiência tem ramo na policy %s (%s)", (policy) => {
    const bloco = new RegExp(`create policy ${policy}\\b([\\s\\S]*?);`, "i").exec(
      sql
    );
    expect(bloco, `policy ${policy} não achada em ${nome}`).toBeTruthy();
    for (const a of AUDIENCIAS) {
      expect(
        bloco![1].includes(`'${a}'`),
        `audiência '${a}' sem ramo em ${policy} — valor que o banco não sabe ler`
      ).toBe(true);
    }
  });
});

describe("e-mail — ROLES_POR_AUDIENCIA cobre o check de comunicados", () => {
  it("as chaves da matriz são exatamente as audiências do check vigente", () => {
    const { nome, sql } = vigente((s) =>
      /add\s+constraint\s+comunicados_audiencia_check/i.test(s)
    );
    const lista = /audiencia\s+in\s*\(([^)]*)\)/i.exec(sql);
    expect(lista, `check de audiencia não achado em ${nome}`).toBeTruthy();
    mesmoConjunto(Object.keys(ROLES_POR_AUDIENCIA), literais(lista![1]));
  });
});
