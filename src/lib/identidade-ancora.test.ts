import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { ANCORAS } from "./identidade-ancora";

// REALIZA-16 — a matriz de âncora é exercitada contra o database.types.ts
// gerado: remover/renomear uma coluna de âncora no schema reprova aqui
// (e no tsc — o helper `ancora()` typechecka `colunas` contra o Row) sem
// precisar de banco. Mesmo parser Row do scripts/check-schema-contract.mjs.

function colunasDe(tabela: string): Set<string> {
  const src = readFileSync(
    fileURLToPath(new URL("./database.types.ts", import.meta.url)),
    "utf8"
  );
  const publicStart = src.indexOf("  public: {");
  const tablesStart = src.indexOf("Tables: {", publicStart);
  const tablesEnd = src.indexOf("\n    Views:", tablesStart);
  const tablesBlock = src.slice(tablesStart, tablesEnd > 0 ? tablesEnd : undefined);
  const m = tablesBlock.match(new RegExp(`^ {6}${tabela}: \\{`, "m"));
  if (!m) return new Set();
  const resto = tablesBlock.slice(m.index!);
  const rowM = resto.match(/Row: \{([\s\S]*?)\n        \}/);
  if (!rowM) return new Set();
  const cols = new Set<string>();
  for (const linha of rowM[1].split("\n")) {
    const cm = linha.match(/^\s*("?[\w]+"?)\??:/);
    if (cm) cols.add(cm[1].replaceAll('"', ""));
  }
  return cols;
}

describe("matriz de âncora (REALIZA-16)", () => {
  it("toda entrada declara pelo menos uma coluna e uma via", () => {
    for (const e of ANCORAS) {
      expect(e.colunas.length, e.tabela).toBeGreaterThan(0);
      expect(e.via.trim(), e.tabela).not.toBe("");
    }
  });

  for (const e of ANCORAS) {
    it(`${e.tabela} mantém as colunas de âncora no schema gerado`, () => {
      const cols = colunasDe(e.tabela);
      expect(cols.size, `tabela ${e.tabela} ausente`).toBeGreaterThan(0);
      for (const c of e.colunas) {
        expect(cols.has(c), `${e.tabela}.${c}`).toBe(true);
      }
    });
  }

  it("a única isenção documentada é a do link de campanha (intake)", () => {
    const comIsencao = ANCORAS.filter((e) => e.isencao);
    expect(comIsencao.map((e) => e.tabela)).toEqual(["formulario_links"]);
  });
});
