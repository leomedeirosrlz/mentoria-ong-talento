import { describe, expect, it } from "vitest";
import { evalCsv, evalJson, evalMarkdown } from "./exportar";
import type { Item, RunDetalhe } from "./tipos";

const run: RunDetalhe = {
  id: "12345678-abcd-0000-0000-000000000000",
  created_at: "2026-11-08T22:05:00Z",
  status: "concluido",
  ambiente: "staging",
  papel: "staff",
  modelos: ["beam-free", "gpt-6-luna"],
  repeticoes: 1,
  resumo: null,
  casos: [],
};

const item = (over: Partial<Item>): Item => ({
  id: over.id ?? "i1",
  caso_id: "live-hist-taxa",
  msg: "qual a taxa de realização?",
  pagina: "/duplas",
  modelo: "beam-free",
  repeticao: 1,
  status: "ok",
  rubrica: null,
  request_id: "r1",
  latencia_ms: 1234,
  tokens_in: 100,
  tokens_out: 50,
  custo_usd: 0.001,
  modelo_usado: "beam-free",
  tools_usadas: ["duplas_risco"],
  resposta_trecho: "a taxa é 80%",
  detalhe: null,
  executado_em: "2026-11-08T22:06:00Z",
  ...over,
});

describe("evalJson", () => {
  it("serializa run + itens com carimbo", () => {
    const j = JSON.parse(evalJson(run, [item({})]));
    expect(j.run.id).toBe(run.id);
    expect(j.itens).toHaveLength(1);
    expect(j.exportado_em).toBeTruthy();
  });
});

describe("evalCsv", () => {
  it("uma linha por item com cabeçalho", () => {
    const csv = evalCsv(run, [item({}), item({ id: "i2", modelo: "gpt-6-luna" })]);
    const linhas = csv.trim().split("\n");
    expect(linhas).toHaveLength(3);
    expect(linhas[0]).toContain("caso_id");
    expect(linhas[1]).toContain("live-hist-taxa");
  });

  it("escapa aspas e vírgulas no conteúdo", () => {
    const csv = evalCsv(run, [
      item({ msg: 'diz "oi", depois', detalhe: "resposta sem /x/" }),
    ]);
    const campo = csv.trim().split("\n")[1];
    expect(campo).toContain('"diz ""oi"", depois"');
  });
});

describe("evalMarkdown", () => {
  it("monta a tabela caso × modelo com glifos", () => {
    const md = evalMarkdown(run, [
      item({ modelo: "beam-free" }),
      item({ id: "i2", modelo: "gpt-6-luna", status: "falhou", detalhe: "resposta sem /x/" }),
    ]);
    expect(md).toContain("| Caso | beam-free | gpt-6-luna |");
    expect(md).toContain("| qual a taxa de realização? | ✓ | ✗ |");
    expect(md).toContain("## Itens pra revisar");
    expect(md).toContain("resposta sem /x/");
  });

  it("escapa pipe dentro da mensagem", () => {
    const md = evalMarkdown(run, [item({ msg: "a | b" })]);
    expect(md).toContain("a \\| b");
  });
});
