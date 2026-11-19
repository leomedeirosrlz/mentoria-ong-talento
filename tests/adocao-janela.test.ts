// Janela da aba Adoção × retenção do cru — produto_eventos vive 90d e o
// rollup diário (produto_eventos_dia, 0201) é o que sobra pra história.
// As duas pontas que este spec amarra, porque o erro nos dois lados é
// silencioso: um chip de janela maior que a retenção mostraria dias
// zerados (o cru já foi apagado); e se uma RPC adocao_* ou o export
// passar a ler o rollup "pra otimizar", os números dobram (cru +
// agregado do mesmo período) ou mudam de significado sem ninguém ver.
// Painéis e export leem SÓ o cru — o rollup fica pra consulta histórica
// fora do app.
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { JANELAS } from "@/lib/adocao";

const ROOT = process.cwd();
const MIG = path.join(ROOT, "supabase", "migrations");
const arquivos = readdirSync(MIG).filter((f) => f.endsWith(".sql")).sort();

describe("janela máxima cabe na retenção do cru", () => {
  it("o maior chip de JANELAS não passa do p_dias do job de retenção", () => {
    const job = readFileSync(
      path.join(ROOT, "src", "lib", "jobs-retencao.ts"),
      "utf8"
    );
    const pDias = Number(/p_dias:\s*(\d+)/.exec(job)?.[1]);
    expect(pDias, "p_dias não achado em jobs-retencao.ts").toBeGreaterThan(0);
    // folga obrigatória: no limite, um chip de N dias no dia N+1 ainda lê
    // cru vivo — passar dele é pedir dias zerados na régua
    expect(Math.max(...JANELAS)).toBeLessThanOrEqual(pDias);
  });
});

describe("RPCs adocao_* não leem o rollup", () => {
  it("nenhuma definição adocao_* menciona produto_eventos_dia", () => {
    const blocos: string[] = [];
    for (const nome of arquivos) {
      const sql = readFileSync(path.join(MIG, nome), "utf8").replace(
        /--[^\n]*/g,
        " "
      );
      for (const bloco of sql.split(
        /(?=create\s+(?:or\s+replace\s+)?function\s+public\.)/i
      )) {
        if (/function\s+public\.adocao_\w+/i.test(bloco)) blocos.push(bloco);
      }
    }
    expect(blocos.length, "nenhuma RPC adocao_* no ledger").toBeGreaterThan(0);
    for (const b of blocos) {
      expect(
        /produto_eventos_dia/i.test(b),
        "RPC adocao_* lendo o rollup — cru+agregado dobraria os números"
      ).toBe(false);
    }
  });
});

describe("o export sai do cru", () => {
  const route = readFileSync(
    path.join(ROOT, "src", "app", "api", "adocao", "export", "route.ts"),
    "utf8"
  );
  // o próprio arquivo comenta que o rollup fica de fora — a asserção
  // negativa corre no código, não no comentário
  const codigo = route.replace(/\/\/[^\n]*/g, " ");

  it("lê produto_eventos e nunca o rollup", () => {
    expect(codigo).toContain('.from("produto_eventos")');
    expect(codigo).not.toContain("produto_eventos_dia");
  });

  it("as colunas do parquet são exatamente o select do cru", () => {
    const select = /\.from\("produto_eventos"\)\s*\.select\("([^"]+)"\)/.exec(
      route.replace(/\s+/g, " ")
    );
    expect(select, "select do cru não achado").toBeTruthy();
    const colsSelect = select![1].split(",").map((s) => s.trim());
    const colsParquet = [...route.matchAll(/\{ name: "(\w+)", type:/g)].map(
      (m) => m[1]
    );
    expect(colsParquet).toEqual(colsSelect);
  });
});
