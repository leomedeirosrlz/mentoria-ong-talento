import { describe, expect, it } from "vitest";
import {
  ehTabelaMd,
  extrairFontesTexto,
  extrairStats,
  parseTabelaMd,
} from "@/lib/ia/render";

// REALIZA-281/302 — convenções de UI generativa do markdown do assistente.
// A regra de ouro: conteúdo nunca some — o que não valida fica no texto e
// renderiza como markdown comum (code block, parágrafo com pipes).

describe("extrairStats", () => {
  it("extrai bloco válido e remove o fence do texto", () => {
    const texto =
      "A situação da turma:\n\n```stats\n" +
      '[{"valor":"12","rotulo":"duplas em risco","tom":"danger"},' +
      '{"valor":"34","rotulo":"em dia","tom":"ok","detalhe":"sob controle"}]\n' +
      "```\n\nQuer detalhar por mentor?";
    const { stats, textoSemBloco } = extrairStats(texto);
    expect(stats).toEqual([
      { valor: "12", rotulo: "duplas em risco", tom: "danger" },
      {
        valor: "34",
        rotulo: "em dia",
        tom: "ok",
        detalhe: "sob controle",
      },
    ]);
    // o fence some e o texto em volta fica separado por uma linha em branco
    expect(textoSemBloco).toBe(
      "A situação da turma:\n\nQuer detalhar por mentor?"
    );
  });

  it("tom omitido vira neutro e valor numérico é coagido pra string", () => {
    const { stats } = extrairStats(
      '```stats\n[{"valor":12,"rotulo":"duplas"}]\n```'
    );
    expect(stats).toEqual([{ valor: "12", rotulo: "duplas", tom: "neutro" }]);
  });

  it("JSON quebrado: stats vazio e o bloco FICA como code no texto", () => {
    const texto = '```stats\n[{"valor":"12", quebrado\n```';
    const { stats, textoSemBloco } = extrairStats(texto);
    expect(stats).toEqual([]);
    expect(textoSemBloco).toBe(texto); // nada é removido — vira code block
  });

  it("schema fora do contrato: tom inválido, 5 itens, vazio, não-objeto", () => {
    const casos = [
      '[{"valor":"1","rotulo":"x","tom":"vermelho"}]',
      '[{"valor":"1","rotulo":"a"},{"valor":"2","rotulo":"b"},' +
        '{"valor":"3","rotulo":"c"},{"valor":"4","rotulo":"d"},' +
        '{"valor":"5","rotulo":"e"}]',
      "[]",
      '["duplas em risco: 12"]',
      '{"valor":"12","rotulo":"não é array"}',
    ];
    for (const json of casos) {
      const texto = `antes\n\n\`\`\`stats\n${json}\n\`\`\`\n\ndepois`;
      const { stats, textoSemBloco } = extrairStats(texto);
      expect(stats).toEqual([]);
      expect(textoSemBloco).toBe(texto); // inválido permanece no texto
    }
  });

  it("misto: bloco válido sai, bloco inválido fica como código", () => {
    const texto =
      '```stats\n[{"valor":"3","rotulo":"atrasadas"}]\n```\n\n' +
      "meio\n\n" +
      '```stats\n[{"valor":}]\n```';
    const { stats, textoSemBloco } = extrairStats(texto);
    expect(stats).toEqual([
      { valor: "3", rotulo: "atrasadas", tom: "neutro" },
    ]);
    expect(textoSemBloco).toBe(
      "meio\n\n```stats\n[{\"valor\":}]\n```"
    );
  });

  it("dois blocos válidos concatenam preservando a ordem", () => {
    const texto =
      '```stats\n[{"valor":"1","rotulo":"a"}]\n```\n\n' +
      '```stats\n[{"valor":"2","rotulo":"b"}]\n```';
    const { stats, textoSemBloco } = extrairStats(texto);
    expect(stats.map((s) => s.valor)).toEqual(["1", "2"]);
    expect(textoSemBloco).toBe("");
  });

  it("fence sem a tag stats não é tocado", () => {
    const texto =
      '```json\n[{"valor":"12","rotulo":"duplas"}]\n```\n\n' +
      '```\n[{"valor":"5","rotulo":"x"}]\n```';
    const { stats, textoSemBloco } = extrairStats(texto);
    expect(stats).toEqual([]);
    expect(textoSemBloco).toBe(texto);
  });

  it("fence stats sem fechar fica como código (stream parcial)", () => {
    const texto = 'texto\n\n```stats\n[{"valor":"1","rotulo":"a"}]';
    const { stats, textoSemBloco } = extrairStats(texto);
    expect(stats).toEqual([]);
    expect(textoSemBloco).toBe(texto);
  });

  it("```stats dentro de um fence comum não vira stats", () => {
    // pela regra do MdLite a linha ```stats FECHA o fence aberto — o resto
    // é texto; nada disso pode ser lido como bloco stats
    const texto =
      '```\n```stats\n[{"valor":"1","rotulo":"a"}]\n```';
    const { stats, textoSemBloco } = extrairStats(texto);
    expect(stats).toEqual([]);
    expect(textoSemBloco).toBe(texto);
  });

  it("tag stats aceita caixa alta e espaços em volta", () => {
    const { stats, textoSemBloco } = extrairStats(
      'resumo:\n\n  ```STATS  \n[{"valor":"9","rotulo":"total"}]\n```\n'
    );
    expect(stats).toHaveLength(1);
    expect(textoSemBloco).toBe("resumo:");
  });
});

// ---------- tabela pipe ----------

describe("ehTabelaMd", () => {
  it("reconhece linhas com pipes externos", () => {
    expect(ehTabelaMd("| a | b |")).toBe(true);
    expect(ehTabelaMd("|---|---|")).toBe(true);
    expect(ehTabelaMd("  | a |  ")).toBe(true);
    expect(ehTabelaMd("|a|")).toBe(true);
  });

  it("rejeita texto comum, pipe solto e linha vazia", () => {
    expect(ehTabelaMd("a | b")).toBe(false);
    expect(ehTabelaMd("|")).toBe(false);
    expect(ehTabelaMd("| abre sem fechar")).toBe(false);
    expect(ehTabelaMd("")).toBe(false);
    expect(ehTabelaMd("use a | b pra comparar |")).toBe(false);
  });
});

describe("parseTabelaMd", () => {
  it("parseia tabela bem formada", () => {
    const t = parseTabelaMd([
      "| Dupla | Encontros |",
      "|---|---:|",
      "| Ana / Bia | 4 |",
      "| Caio / Davi | 2 |",
    ]);
    expect(t).toEqual({
      cab: ["Dupla", "Encontros"],
      linhas: [
        ["Ana / Bia", "4"],
        ["Caio / Davi", "2"],
      ],
    });
  });

  it("cabeçalho + separador sem corpo é tabela válida vazia", () => {
    expect(parseTabelaMd(["| a | b |", "|-|-|"])).toEqual({
      cab: ["a", "b"],
      linhas: [],
    });
  });

  it("separador com alinhamento (:---, ---:, :-:) vale", () => {
    const t = parseTabelaMd(["| a | b | c |", "|:---|---:|:-:|", "| 1 | 2 | 3 |"]);
    expect(t?.cab).toEqual(["a", "b", "c"]);
    expect(t?.linhas).toEqual([["1", "2", "3"]]);
  });

  it("mal formada: sem separador, separador furado ou linha única → null", () => {
    expect(parseTabelaMd(["| a | b |", "| 1 | 2 |"])).toBeNull();
    expect(parseTabelaMd(["| a | b |", "|---|"])).toBeNull(); // faltou célula
    expect(parseTabelaMd(["| a | b |", "|---|---|---|"])).toBeNull(); // sobrou
    expect(parseTabelaMd(["| a | b |", "|xx|---|"])).toBeNull(); // separador não é -+
    expect(parseTabelaMd(["| a | b |"])).toBeNull();
    expect(parseTabelaMd([])).toBeNull();
  });

  it("linha de corpo é ajustada ao cabeçalho: trunca a mais, completa a menos", () => {
    const t = parseTabelaMd([
      "| a | b |",
      "|---|---|",
      "| 1 | 2 | 3 |",
      "| 4 |",
    ]);
    expect(t?.linhas).toEqual([
      ["1", "2"],
      ["4", ""],
    ]);
  });

  it("para na primeira linha não-pipe e preserva a ordem das linhas", () => {
    const t = parseTabelaMd([
      "| a |",
      "|-|",
      "| 1 |",
      "texto solto",
      "| 2 |",
    ]);
    expect(t?.linhas).toEqual([["1"]]);
  });

  it("pipe escapado (\\|) dentro da célula não quebra coluna", () => {
    const t = parseTabelaMd(["| a |", "|-|", "| x \\| y |"]);
    expect(t?.linhas).toEqual([["x | y"]]);
  });
});

// ---------- fontes inline ----------

describe("extrairFontesTexto", () => {
  it("extrai links /materiais/ como fontes com slug do path", () => {
    const fontes = extrairFontesTexto(
      "Conforme o [Guia do mentor](/materiais/documento/guia-mentor-dpp), " +
        "veja também a [biblioteca](/materiais/biblioteca)."
    );
    expect(fontes).toEqual([
      { slug: "guia-mentor-dpp", rotulo: "Guia do mentor", href: "/materiais/documento/guia-mentor-dpp" },
      { slug: "biblioteca", rotulo: "biblioteca", href: "/materiais/biblioteca" },
    ]);
  });

  it("ações comuns e links externos não viram fonte", () => {
    const fontes = extrairFontesTexto(
      "[ficha](/duplas/1) [site](https://x.com/materiais/doc) " +
        "[agenda](/agenda) [doc](/materiais/documento/guia)"
    );
    expect(fontes).toEqual([
      { slug: "guia", rotulo: "doc", href: "/materiais/documento/guia" },
    ]);
  });

  it("deduplica por slug e preserva a ordem de citação", () => {
    const fontes = extrairFontesTexto(
      "[a](/materiais/documento/g2) [b](/materiais/documento/g1) " +
        "[de novo](/materiais/documento/g2)"
    );
    expect(fontes.map((f) => f.slug)).toEqual(["g2", "g1"]);
    expect(fontes[0].rotulo).toBe("a"); // fica o primeiro rótulo citado
  });

  it("ignora query, hash e barra final no slug", () => {
    const fontes = extrairFontesTexto(
      "[doc](/materiais/documento/guia/?aba=jornada#topo)"
    );
    expect(fontes).toEqual([
      {
        slug: "guia",
        rotulo: "doc",
        href: "/materiais/documento/guia/?aba=jornada#topo",
      },
    ]);
  });
});
