// REALIZA-452 — guard do explorador DuckDB × CSP. A classe de bug "request
// novo dentro do worker vs. connect-src" passa em build e teste de domínio
// e só explode no browser: parquet_scan autoloadeia parquet
// .duckdb_extension.wasm de {repo}/{versão do engine}/{plataforma}/ via
// XHR no worker. A correção vendora a extensão em public/ e aponta o repo
// same-origin via SET custom_extension_repository — sem origem nova no
// CSP. Este teste trava os três lados que precisam andar juntos:
//   1. o bootstrap declara o SET e o repo é path-absolute (same-origin,
//      coberto pelo connect-src 'self' — nunca host externo);
//   2. o layout vendored casa com a versão do engine embutida no pacote
//      instalado — bump do @duckdb/duckdb-wasm exige re-vendor;
//   3. o CSP não ganha origem de CDN de extensão (a tentação de "destravar
//      rápido" reabre a dependência externa que a correção removeu).
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = process.cwd();
const require = createRequire(import.meta.url);

const SRC = readFileSync(path.join(ROOT, "src", "lib", "adocao-duckdb.ts"), "utf8");
const NEXT_CFG = readFileSync(path.join(ROOT, "next.config.ts"), "utf8");

const repoMatch = /REPO_EXTENSAO\s*=\s*"([^"]+)"/.exec(SRC);
const PUBLIC_REPO = path.join(
  ROOT,
  "public",
  (repoMatch?.[1] ?? "").replace(/^\//, "")
);

type Bindings = {
  instantiate: () => Promise<Bindings>;
  getVersion: () => string;
};

/** Versão do engine embutida no pacote instalado — lida do wasm de
 *  verdade (bindings node-blocking), não parseada de string solta. */
async function versaoDoEngine(): Promise<string> {
  const duckdb = require(
    "@duckdb/duckdb-wasm/dist/duckdb-node-blocking.cjs"
  ) as {
    createDuckDB: (
      bundles: unknown,
      logger: unknown,
      runtime: unknown
    ) => Promise<Bindings>;
    VoidLogger: new () => unknown;
    NODE_RUNTIME: unknown;
  };
  const wasm = require.resolve("@duckdb/duckdb-wasm/dist/duckdb-mvp.wasm");
  const db = await duckdb.createDuckDB(
    { mvp: { mainModule: wasm } },
    new duckdb.VoidLogger(),
    duckdb.NODE_RUNTIME
  );
  return (await db.instantiate()).getVersion();
}

describe("explorador DuckDB — repositório de extensão same-origin", () => {
  it("o bootstrap SETa custom_extension_repository apontando pra /duckdb-ext", () => {
    expect(repoMatch, "constante REPO_EXTENSAO não achada no bootstrap").toBeTruthy();
    // path-absolute resolve contra a origem em qualquer contexto de
    // fetch — 'self' do connect-src cobre; um http(s) aqui seria host
    // externo novo e a mesma classe de bug do CDN
    expect(repoMatch![1]).toMatch(/^\/[a-z0-9\-/]+$/);
    expect(SRC).toMatch(/custom_extension_repository/);
    // absoluta porque o XHR roda no worker (base = script do worker)
    expect(SRC).toMatch(/new URL\(REPO_EXTENSAO, location\.origin\)/);
  });

  it("nada no bootstrap nem no CSP aponta pro CDN de extensões", () => {
    // fora de comentário: documentar o CDN no código vale, referenciar
    // não — o domínio só pode aparecer em prosa
    const semComentario = (s: string) => s.replace(/\/\/[^\n]*/g, " ");
    expect(semComentario(SRC)).not.toMatch(/duckdb\.org/);
    expect(semComentario(NEXT_CFG)).not.toMatch(/duckdb\.org/);
    // 'self' é a única fonte de connect-src que o explorador precisa —
    // a linha inteira fica nela mais os hosts supabase já declarados
    expect(NEXT_CFG).toMatch(/connect-src 'self'/);
  });
});

describe("explorador DuckDB — layout vendored casa com o engine", () => {
  it("public/{repo}/{versão}/{wasm_eh,wasm_mvp}/parquet.duckdb_extension.wasm existe e é wasm", async () => {
    expect(repoMatch, "constante REPO_EXTENSAO não achada no bootstrap").toBeTruthy();
    const versao = await versaoDoEngine(); // ex.: "v1.5.4"

    // pasta vendored é exatamente a do engine instalado: versão velha
    // acumulada falha aqui (re-vendor ou prune — não convivem dois layouts)
    const pastas = readdirSync(PUBLIC_REPO).sort();
    expect(
      pastas,
      `pasta(s) vendored ${pastas.join(", ")} ≠ engine ${versao} — ` +
        `re-vendor: baixe https://extensions.duckdb.org/${versao}/{wasm_eh,wasm_mvp}/parquet.duckdb_extension.wasm`
    ).toEqual([versao]);

    for (const plat of ["wasm_eh", "wasm_mvp"] as const) {
      const arq = path.join(PUBLIC_REPO, versao, plat, "parquet.duckdb_extension.wasm");
      expect(
        existsSync(arq),
        `extensão ausente: ${path.relative(ROOT, arq)} — baixe ` +
          `https://extensions.duckdb.org/${versao}/${plat}/parquet.duckdb_extension.wasm`
      ).toBe(true);
      const buf = readFileSync(arq);
      // magic \0asm + peso real: uma página de erro do CDN passaria no
      // existsSync — o binário da extensão tem ~3MB e embute a versão
      expect(Array.from(buf.subarray(0, 4))).toEqual([0, 0x61, 0x73, 0x6d]);
      expect(buf.length).toBeGreaterThan(1_000_000);
      expect(buf.includes(versao), `${plat}: binário sem a versão ${versao} embutida`).toBe(true);
    }
  });
});
