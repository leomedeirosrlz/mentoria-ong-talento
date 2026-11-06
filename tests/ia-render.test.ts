import { describe, expect, it } from "vitest";
import {
  ehTabelaMd,
  extrairBlocos,
  extrairFontesTexto,
  extrairGraficos,
  extrairStats,
  MARCA_BLOCO,
  MARCA_GRAFICO,
  MARCA_PENDENTE,
  parseTabelaMd,
  segurarParcial,
} from "@/lib/ia/render";

// REALIZA-281/302 — convenções de UI generativa do markdown do assistente.
// A regra de ouro: conteúdo nunca some — o que não valida fica no texto e
// renderiza como markdown comum (code block, parágrafo com pipes).
// Exceção do ```grafico (genUI v2): spec de gráfico é JSON de
// visualização, não conteúdo — inválido sai do texto sem deixar marca.

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
      alinhamento: ["esq", "dir"],
      numerica: [false, true],
    });
  });

  it("cabeçalho + separador sem corpo é tabela válida vazia", () => {
    expect(parseTabelaMd(["| a | b |", "|-|-|"])).toEqual({
      cab: ["a", "b"],
      linhas: [],
      alinhamento: ["esq", "esq"],
      // sem célula no corpo não há o que provar: coluna não é numérica
      numerica: [false, false],
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

// ---------- bloco ```grafico (genUI v2) ----------

const G_VALIDO =
  '{"tipo":"barras","titulo":"Encontros","dados":[' +
  '{"rotulo":"S1","valor":12,"tom":"ok"},' +
  '{"rotulo":"S2","valor":9}]}';

describe("extrairGraficos", () => {
  it("extrai bloco válido e deixa a marca na posição original", () => {
    const texto =
      `Olha o ritmo:\n\n\`\`\`grafico\n${G_VALIDO}\n\`\`\`\n\nContinua caindo.`;
    const { graficos, textoSemBloco } = extrairGraficos(texto);
    expect(graficos).toEqual([
      {
        tipo: "barras",
        titulo: "Encontros",
        dados: [
          { rotulo: "S1", valor: 12, tom: "ok" },
          { rotulo: "S2", valor: 9 },
        ],
      },
    ]);
    // a linha-marca ocupa o lugar do bloco — o texto em volta fica intacto
    expect(textoSemBloco).toBe(
      "Olha o ritmo:\n\n\u0000grafico:0\u0000\n\nContinua caindo."
    );
    // e a marca é a linha que o MdLite reconhece
    expect(
      textoSemBloco.split("\n").some((l) => MARCA_GRAFICO.test(l))
    ).toBe(true);
  });

  it("marca graficos[i] na ordem dos blocos — dois blocos, duas marcas", () => {
    const texto =
      `\`\`\`grafico\n${G_VALIDO}\n\`\`\`\n\nmeio\n\n` +
      '```grafico\n{"tipo":"rosca","dados":[{"rotulo":"a","valor":3}]}\n```';
    const { graficos, textoSemBloco } = extrairGraficos(texto);
    expect(graficos.map((g) => g.tipo)).toEqual(["barras", "rosca"]);
    expect(textoSemBloco).toBe(
      "\u0000grafico:0\u0000\n\nmeio\n\n\u0000grafico:1\u0000"
    );
  });

  it("campos opcionais: total do progresso e detalhe do item passam", () => {
    const { graficos } = extrairGraficos(
      '```grafico\n{"tipo":"progresso","titulo":"Jornada","total":16,' +
        '"dados":[{"rotulo":"realizados","valor":12,"detalhe":"faltam 4"}]}\n```'
    );
    expect(graficos).toEqual([
      {
        tipo: "progresso",
        titulo: "Jornada",
        total: 16,
        dados: [{ rotulo: "realizados", valor: 12, detalhe: "faltam 4" }],
      },
    ]);
  });

  it("chaves a mais no JSON são ignoradas; sem título/tom vira default", () => {
    const { graficos } = extrairGraficos(
      '```grafico\n{"tipo":"linha","cor":"azul","dados":[' +
        '{"rotulo":"a","valor":1,"extra":true}]}\n```'
    );
    expect(graficos).toEqual([
      { tipo: "linha", dados: [{ rotulo: "a", valor: 1 }] },
    ]);
  });

  it("JSON quebrado: o bloco SOME do texto e nenhum gráfico sai", () => {
    const texto =
      'antes\n\n```grafico\n{"tipo":"barras", quebrado\n```\n\ndepois';
    const { graficos, textoSemBloco } = extrairGraficos(texto);
    expect(graficos).toEqual([]);
    // diferente do stats: spec cru não fica visível — some por completo
    expect(textoSemBloco).toBe("antes\n\ndepois");
  });

  it("schema fora do contrato: tipo inválido, sem dados, 11 itens, valor negativo", () => {
    const casos = [
      '{"tipo":"pizza","dados":[{"rotulo":"a","valor":1}]}',
      '{"tipo":"barras","dados":[]}',
      `{"tipo":"barras","dados":[${Array.from(
        { length: 11 },
        (_, i) => `{"rotulo":"r${i}","valor":${i}}`
      ).join(",")}]}`,
      '{"tipo":"barras","dados":[{"rotulo":"a","valor":-3}]}',
      '{"tipo":"barras","dados":[{"rotulo":"a","valor":"12"}]}',
      '{"tipo":"barras","dados":[{"rotulo":"a","valor":1,"tom":"vermelho"}]}',
      '["não é objeto"]',
    ];
    for (const json of casos) {
      const texto = `antes\n\n\`\`\`grafico\n${json}\n\`\`\`\n\ndepois`;
      const { graficos, textoSemBloco } = extrairGraficos(texto);
      expect(graficos).toEqual([]);
      expect(textoSemBloco).toBe("antes\n\ndepois");
    }
  });

  it("misto: bloco válido deixa marca, bloco inválido some", () => {
    const texto =
      `\`\`\`grafico\n${G_VALIDO}\n\`\`\`\n\n` +
      "meio\n\n" +
      '```grafico\n{"tipo":}\n```';
    const { graficos, textoSemBloco } = extrairGraficos(texto);
    expect(graficos).toHaveLength(1);
    expect(textoSemBloco).toBe("\u0000grafico:0\u0000\n\nmeio");
  });

  it("fence grafico sem fechar some com o rabo (stream parcial)", () => {
    const texto = `texto\n\n\`\`\`grafico\n${G_VALIDO.slice(0, 20)}`;
    const { graficos, textoSemBloco } = extrairGraficos(texto);
    expect(graficos).toEqual([]);
    expect(textoSemBloco).toBe("texto");
  });

  it("```grafico dentro de um fence comum não vira gráfico", () => {
    const texto = `\`\`\`\n\`\`\`grafico\n${G_VALIDO}\n\`\`\``;
    const { graficos, textoSemBloco } = extrairGraficos(texto);
    expect(graficos).toEqual([]);
    expect(textoSemBloco).toBe(texto);
  });

  it("tag grafico aceita caixa alta e espaços em volta", () => {
    const { graficos, textoSemBloco } = extrairGraficos(
      `resumo:\n\n  \`\`\`GRAFICO  \n${G_VALIDO}\n\`\`\`\n`
    );
    expect(graficos).toHaveLength(1);
    expect(textoSemBloco).toBe("resumo:\n\n\u0000grafico:0\u0000");
  });

  it("fence sem a tag grafico não é tocado", () => {
    const texto =
      `\`\`\`json\n${G_VALIDO}\n\`\`\`\n\n` +
      `\`\`\`\n${G_VALIDO}\n\`\`\``;
    const { graficos, textoSemBloco } = extrairGraficos(texto);
    expect(graficos).toEqual([]);
    expect(textoSemBloco).toBe(texto);
  });
});

// ---------- alinhamento e coluna numérica da tabela ----------

describe("parseTabelaMd — alinhamento e numerica", () => {
  it("alinhamento sai do separador: :--, --:, :-: e sem dois-pontos", () => {
    const t = parseTabelaMd([
      "| a | b | c | d |",
      "|:---|---:|:-:|---|",
      "| x | y | z | w |",
    ]);
    expect(t?.alinhamento).toEqual(["esq", "dir", "centro", "esq"]);
  });

  it("numerica reconhece inteiro, decimal pt-BR/en, milhar, %, fração e moeda", () => {
    const t = parseTabelaMd([
      "| int | dec | mil | pct | frac | moeda | en |",
      "|---|---|---|---|---|---|---|",
      "| 12 | 3,5 | 1.200 | 45% | 3/16 | R$ 10,00 | 1,200.50 |",
      "| -2 | 0,75 | 12.345.678 | 7,5 % | 12 / 16 | R$ 1.250,90 | 3.14 |",
    ]);
    expect(t?.numerica).toEqual([true, true, true, true, true, true, true]);
  });

  it("uma célula de texto desqualifica a coluna; vazia e travessão não contam", () => {
    const t = parseTabelaMd([
      "| nome | n | misto | vazia |",
      "|---|---|---|---|",
      "| Ana | 4 | 3 |  |",
      "| Bia |  | três |  |",
      "| Caio | — | 2 |  |",
    ]);
    expect(t?.numerica).toEqual([false, true, false, false]);
  });

  it("número com ênfase markdown ainda é numérico; '12 duplas' não é", () => {
    const t = parseTabelaMd([
      "| a | b |",
      "|---|---|",
      "| **12** | 12 duplas |",
      "| `3` | 4 |",
    ]);
    expect(t?.numerica).toEqual([true, false]);
  });
});

// ---------- extrairBlocos (genUI v3) ----------

const ESCOLHA =
  '{"pergunta":"Por onde começo?","opcoes":[{"rotulo":"Risco"},' +
  '{"rotulo":"Atrasos","valor":"Mostre as duplas atrasadas"}]}';
const RASCUNHO =
  '{"canal":"whatsapp","para":"Ana","texto":"Oi Ana, tudo bem? Bora marcar o encontro 5?"}';
const PASSOS =
  '{"titulo":"Antes do encontro","itens":[{"texto":"Revisar o guia"},' +
  '{"texto":"Mandar a pauta","detalhe":"um dia antes"}]}';
const DESTAQUE =
  '{"tom":"dica","texto":"Comece pelo vínculo.",' +
  '"fonte":{"rotulo":"Guia do mentor","href":"/materiais/documento/guia"}}';
const STATS = '[{"valor":"12","rotulo":"duplas em risco","tom":"danger"}]';

const fence = (tag: string, json: string) => `\`\`\`${tag}\n${json}\n\`\`\``;

describe("extrairBlocos — blocos válidos", () => {
  it("escolha vira marca inline com uma linha em branco de cada lado", () => {
    const { blocos, textoSemBloco } = extrairBlocos(
      `Posso seguir de dois jeitos:\n\n\n${fence("escolha", ESCOLHA)}\n\n\nOu me diga outro.`
    );
    expect(blocos).toEqual([
      {
        kind: "escolha",
        b: {
          pergunta: "Por onde começo?",
          opcoes: [
            { rotulo: "Risco" },
            { rotulo: "Atrasos", valor: "Mostre as duplas atrasadas" },
          ],
        },
      },
    ]);
    expect(textoSemBloco).toBe(
      "Posso seguir de dois jeitos:\n\n\u0000bloco:0\u0000\n\nOu me diga outro."
    );
  });

  it("marca colada no texto (sem linha em branco) ganha a separação", () => {
    const { textoSemBloco } = extrairBlocos(
      `antes\n${fence("passos", PASSOS)}\ndepois`
    );
    expect(textoSemBloco).toBe("antes\n\n\u0000bloco:0\u0000\n\ndepois");
  });

  it("rascunho válido vira bloco; canal omitido cai em texto", () => {
    const { blocos } = extrairBlocos(fence("rascunho", RASCUNHO));
    expect(blocos).toEqual([
      {
        kind: "rascunho",
        b: {
          canal: "whatsapp",
          para: "Ana",
          texto: "Oi Ana, tudo bem? Bora marcar o encontro 5?",
        },
      },
    ]);
    const { blocos: semCanal } = extrairBlocos(
      fence("rascunho", '{"texto":"Oi, tudo bem?"}')
    );
    expect(semCanal).toEqual([
      { kind: "rascunho", b: { canal: "texto", texto: "Oi, tudo bem?" } },
    ]);
  });

  it("passos válido vira bloco", () => {
    const { blocos, textoSemBloco } = extrairBlocos(fence("passos", PASSOS));
    expect(blocos).toEqual([
      {
        kind: "passos",
        b: {
          titulo: "Antes do encontro",
          itens: [
            { texto: "Revisar o guia" },
            { texto: "Mandar a pauta", detalhe: "um dia antes" },
          ],
        },
      },
    ]);
    expect(textoSemBloco).toBe("\u0000bloco:0\u0000");
  });

  it("destaque válido vira bloco; tom omitido cai em info", () => {
    const { blocos } = extrairBlocos(fence("destaque", DESTAQUE));
    expect(blocos).toEqual([
      {
        kind: "destaque",
        b: {
          tom: "dica",
          texto: "Comece pelo vínculo.",
          fonte: { rotulo: "Guia do mentor", href: "/materiais/documento/guia" },
        },
      },
    ]);
    const { blocos: semTom } = extrairBlocos(
      fence("destaque", '{"texto":"Lembre do registro."}')
    );
    expect(semTom).toEqual([
      { kind: "destaque", b: { tom: "info", texto: "Lembre do registro." } },
    ]);
  });

  it("grafico entra na fila comum como {kind:'grafico', g}", () => {
    const { blocos, textoSemBloco } = extrairBlocos(
      `Ritmo:\n\n${fence("grafico", G_VALIDO)}`
    );
    expect(blocos).toEqual([
      {
        kind: "grafico",
        g: {
          tipo: "barras",
          titulo: "Encontros",
          dados: [
            { rotulo: "S1", valor: 12, tom: "ok" },
            { rotulo: "S2", valor: 9 },
          ],
        },
      },
    ]);
    // a marca é a de bloco, não a do extrairGraficos
    expect(textoSemBloco).toBe("Ritmo:\n\n\u0000bloco:0\u0000");
    expect(textoSemBloco.split("\n").some((l) => MARCA_GRAFICO.test(l))).toBe(
      false
    );
  });

  it("stats saem pro topo sem marca e concatenam", () => {
    const { stats, blocos, textoSemBloco } = extrairBlocos(
      `Resumo:\n\n${fence("stats", STATS)}\n\nmeio\n\n` +
        fence("stats", '[{"valor":3,"rotulo":"atrasadas"}]')
    );
    expect(stats).toEqual([
      { valor: "12", rotulo: "duplas em risco", tom: "danger" },
      { valor: "3", rotulo: "atrasadas", tom: "neutro" },
    ]);
    expect(blocos).toEqual([]);
    expect(textoSemBloco).toBe("Resumo:\n\nmeio");
  });

  it("vários blocos: índices na ordem do texto, stats e sugestoes fora da fila", () => {
    const texto = [
      "Panorama:",
      fence("stats", STATS),
      fence("grafico", G_VALIDO),
      "Sugiro começar assim.",
      fence("passos", PASSOS),
      fence("destaque", DESTAQUE),
      "E se quiser já mandar:",
      fence("rascunho", RASCUNHO),
      fence("escolha", ESCOLHA),
      fence("sugestoes", '["Ver duplas em risco"]'),
    ].join("\n\n");
    const { stats, blocos, sugestoes, textoSemBloco } = extrairBlocos(texto);
    expect(stats).toHaveLength(1);
    expect(sugestoes).toEqual(["Ver duplas em risco"]);
    expect(blocos.map((b) => b.kind)).toEqual([
      "grafico",
      "passos",
      "destaque",
      "rascunho",
      "escolha",
    ]);
    expect(textoSemBloco).toBe(
      [
        "Panorama:",
        "\u0000bloco:0\u0000",
        "Sugiro começar assim.",
        "\u0000bloco:1\u0000",
        "\u0000bloco:2\u0000",
        "E se quiser já mandar:",
        "\u0000bloco:3\u0000",
        "\u0000bloco:4\u0000",
      ].join("\n\n")
    );
    // cada marca resolve o próprio bloco pelo índice
    const marcas = textoSemBloco
      .split("\n")
      .map((l) => MARCA_BLOCO.exec(l)?.[1])
      .filter((m): m is string => m !== undefined)
      .map(Number);
    expect(marcas).toEqual([0, 1, 2, 3, 4]);
  });

  it("tag aceita caixa alta e espaços em volta", () => {
    const { blocos, textoSemBloco } = extrairBlocos(
      `  \`\`\`  ESCOLHA  \n${ESCOLHA}\n\`\`\``
    );
    expect(blocos).toHaveLength(1);
    expect(textoSemBloco).toBe("\u0000bloco:0\u0000");
  });
});

describe("extrairBlocos — sugestoes", () => {
  it("saem do texto sem marca e vão pra lista", () => {
    const { sugestoes, textoSemBloco } = extrairBlocos(
      'Feito.\n\n```sugestoes\n["Ver a agenda","Quem está em risco?"]\n```'
    );
    expect(sugestoes).toEqual(["Ver a agenda", "Quem está em risco?"]);
    expect(textoSemBloco).toBe("Feito.");
  });

  it("dedup (caixa e espaço não contam) e no máximo 3 no total", () => {
    const { sugestoes, textoSemBloco } = extrairBlocos(
      `${fence("sugestoes", '["Ver a agenda","ver a  AGENDA","Quem está em risco?"]')}\n\n` +
        "meio\n\n" +
        fence("sugestoes", '["Abrir registros","Mandar lembrete"]')
    );
    expect(sugestoes).toEqual([
      "Ver a agenda",
      "Quem está em risco?",
      "Abrir registros",
    ]);
    expect(textoSemBloco).toBe("meio");
  });

  it("inválida (4 itens, curta demais, não-array) some sem deixar rastro", () => {
    const casos = [
      '["a1","b2","c3","d4"]',
      '["x"]',
      '{"sugestoes":["Ver a agenda"]}',
      '["Ver a agenda", quebrado',
    ];
    for (const json of casos) {
      const { sugestoes, textoSemBloco } = extrairBlocos(
        `antes\n\n${fence("sugestoes", json)}\n\ndepois`
      );
      expect(sugestoes).toEqual([]);
      expect(textoSemBloco).toBe("antes\n\ndepois");
    }
  });
});

describe("extrairBlocos — inválidos", () => {
  it("escolha/passos/destaque/grafico inválidos somem sem marca", () => {
    const casos: [string, string][] = [
      ["escolha", '{"pergunta":"Qual?","opcoes":[{"rotulo":"só uma"}]}'],
      ["escolha", '{"pergunta":"Qual?", quebrado'],
      ["passos", '{"itens":[{"texto":"um só"}]}'],
      ["destaque", '{"texto":"x","fonte":{"rotulo":"site","href":"https://x.com"}}'],
      ["destaque", '{"tom":"perigo","texto":"x"}'],
      ["grafico", '{"tipo":"pizza","dados":[{"rotulo":"a","valor":1}]}'],
    ];
    for (const [tag, json] of casos) {
      const { blocos, textoSemBloco } = extrairBlocos(
        `antes\n\n${fence(tag, json)}\n\ndepois`
      );
      expect(blocos).toEqual([]);
      expect(textoSemBloco).toBe("antes\n\ndepois");
    }
  });

  it("rascunho inválido FICA como code block (a mensagem é informação)", () => {
    const casos = [
      '{"canal":"sms","texto":"Oi Ana"}',
      '{"texto":"Oi Ana, quebrado',
      '{"para":"Ana"}',
    ];
    for (const json of casos) {
      const texto = `antes\n\n${fence("rascunho", json)}\n\ndepois`;
      const { blocos, textoSemBloco } = extrairBlocos(texto);
      expect(blocos).toEqual([]);
      expect(textoSemBloco).toBe(texto);
    }
  });

  it("stats inválido fica como código, igual ao extrairStats", () => {
    const texto = `antes\n\n${fence("stats", '[{"valor":}]')}\n\ndepois`;
    const { stats, textoSemBloco } = extrairBlocos(texto);
    expect(stats).toEqual([]);
    expect(textoSemBloco).toBe(texto);
  });

  it("inválido não consome índice: o válido seguinte é bloco 0", () => {
    const { blocos, textoSemBloco } = extrairBlocos(
      `${fence("passos", "[]")}\n\n${fence("escolha", ESCOLHA)}`
    );
    expect(blocos.map((b) => b.kind)).toEqual(["escolha"]);
    expect(textoSemBloco).toBe("\u0000bloco:0\u0000");
  });
});

describe("extrairBlocos — fence comum passa intacto", () => {
  it("tag conhecida dentro de um fence comum não é lida como bloco", () => {
    // pela regra do MdLite a linha ```grafico FECHA o ```md aberto — o
    // JSON vira texto e o ``` seguinte abre fence comum; nada é bloco
    const texto = `\`\`\`md\nexemplo:\n${fence("grafico", G_VALIDO)}`;
    const { blocos, textoSemBloco } = extrairBlocos(texto);
    expect(blocos).toEqual([]);
    expect(textoSemBloco).toBe(texto);
  });

  it("conteúdo de fence comum (sql, json) não é tocado, nem em streaming", () => {
    const texto =
      "```sql\nselect 1;\n\n\n```\n\n" +
      `\`\`\`json\n${ESCOLHA}\n\`\`\`\n\n` +
      "```\n```sugestoes";
    expect(extrairBlocos(texto).textoSemBloco).toBe(texto);
    expect(extrairBlocos(texto, { streaming: true }).textoSemBloco).toBe(texto);
  });

  it("tag desconhecida (```escolhas, ```grafico x) é fence comum", () => {
    const texto =
      `\`\`\`escolhas\n${ESCOLHA}\n\`\`\`\n\n` + `\`\`\`grafico x\n${G_VALIDO}\n\`\`\``;
    const { blocos, textoSemBloco } = extrairBlocos(texto);
    expect(blocos).toEqual([]);
    expect(textoSemBloco).toBe(texto);
  });
});

describe("extrairBlocos — fence sem fechar", () => {
  const TAGS = [
    ["stats", STATS],
    ["grafico", G_VALIDO],
    ["sugestoes", '["Ver a agenda"]'],
    ["escolha", ESCOLHA],
    ["rascunho", RASCUNHO],
    ["passos", PASSOS],
    ["destaque", DESTAQUE],
  ] as const;

  it("streaming: qualquer tag vira marca de pendente e o JSON cru some", () => {
    for (const [tag, json] of TAGS) {
      const parcial = json.slice(0, Math.floor(json.length / 2));
      const res = extrairBlocos(`Olha só:\n\n\n\`\`\`${tag}\n${parcial}`, {
        streaming: true,
      });
      expect(res.textoSemBloco).toBe(`Olha só:\n\n\u0000pendente:${tag}\u0000`);
      // nada do JSON parcial vaza pro texto (o bug do stats no stream)
      expect(res.textoSemBloco).not.toContain(parcial);
      expect(res.textoSemBloco).not.toContain("```");
      expect(res.blocos).toEqual([]);
      expect(res.stats).toEqual([]);
      expect(res.sugestoes).toEqual([]);
      const ultima = res.textoSemBloco.split("\n").at(-1) ?? "";
      expect(MARCA_PENDENTE.exec(ultima)?.[1]).toBe(tag);
    }
  });

  it("streaming: só a linha da tag (JSON ainda nem começou) já é pendente", () => {
    const { textoSemBloco } = extrairBlocos("```stats", { streaming: true });
    expect(textoSemBloco).toBe("\u0000pendente:stats\u0000");
  });

  it("streaming: blocos fechados antes continuam valendo e o pendente vem no fim", () => {
    const { stats, blocos, textoSemBloco } = extrairBlocos(
      `${fence("stats", STATS)}\n\nTexto.\n\n${fence("passos", PASSOS)}\n\n` +
        '```escolha\n{"pergunta":"Qual',
      { streaming: true }
    );
    expect(stats).toHaveLength(1);
    expect(blocos.map((b) => b.kind)).toEqual(["passos"]);
    expect(textoSemBloco).toBe(
      "Texto.\n\n\u0000bloco:0\u0000\n\n\u0000pendente:escolha\u0000"
    );
  });

  it("sem streaming: stats e rascunho ficam como código, o resto some", () => {
    for (const [tag, json] of TAGS) {
      const texto = `antes\n\n\`\`\`${tag}\n${json}`;
      const { blocos, textoSemBloco } = extrairBlocos(texto);
      expect(blocos).toEqual([]);
      if (tag === "stats" || tag === "rascunho") {
        expect(textoSemBloco).toBe(texto);
      } else {
        expect(textoSemBloco).toBe("antes");
      }
    }
  });
});

// ---------- segurarParcial (stream) ----------

describe("segurarParcial", () => {
  it("texto comum e vazio passam intactos", () => {
    for (const t of [
      "",
      "Oi, tudo bem?",
      "Linha 1\n\nLinha 2\n",
      "use a | b pra comparar",
      "uma crase `no meio` da linha",
    ]) {
      expect(segurarParcial(t)).toBe(t);
    }
  });

  it("cabeçalho sozinho (com ou sem pipe final, com ou sem quebra) espera", () => {
    expect(segurarParcial("Veja:\n\n| Dupla | Encontros |")).toBe("Veja:");
    expect(segurarParcial("Veja:\n\n| Dupla | Encon")).toBe("Veja:");
    expect(segurarParcial("Veja:\n\n| Dupla | Encontros |\n")).toBe("Veja:");
    expect(segurarParcial("| a | b |")).toBe("");
  });

  it("cabeçalho + separador em andamento espera", () => {
    expect(segurarParcial("Veja:\n\n| a | b |\n|")).toBe("Veja:");
    expect(segurarParcial("Veja:\n\n| a | b |\n|---|--")).toBe("Veja:");
    expect(segurarParcial("Veja:\n\n| a | b |\n|:--|")).toBe("Veja:");
  });

  it("tabela completa fica intacta (com ou sem corpo, com quebra no fim)", () => {
    const completas = [
      "| a | b |\n|---|---|",
      "| a | b |\n|---|---|\n| 1 | 2 |",
      "Veja:\n\n| a | b |\n|---|---:|\n| 1 | 2 |\n| 3 | 4 |\n",
      "| a | b |\n|---|---|\n| 1 | 2 |\n\nDepois da tabela.",
    ];
    for (const t of completas) expect(segurarParcial(t)).toBe(t);
  });

  it("linha de corpo ainda sem o pipe final espera; a tabela fica", () => {
    expect(segurarParcial("| a | b |\n|---|---|\n| 1 | 2 |\n| 3 | 4")).toBe(
      "| a | b |\n|---|---|\n| 1 | 2 |"
    );
  });

  it("linhas com pipe que já não são tabela seguem como texto", () => {
    const textos = [
      // separador inválido com a linha já fechada
      "| a | b |\n|---|\n",
      // segunda linha é corpo, não separador
      "| a | b |\n| 1 | 2 |",
      // linha em branco depois do cabeçalho encerra o bloco
      "| a | b |\n\n",
      // pipe solto seguido de texto comum
      "| nota\nsegue o texto",
    ];
    for (const t of textos) expect(segurarParcial(t)).toBe(t);
  });

  it("abertura de fence sendo digitada some; tag conhecida inteira fica", () => {
    expect(segurarParcial("Olha:\n\n```gra")).toBe("Olha:");
    expect(segurarParcial("Olha:\n\n```")).toBe("Olha:");
    expect(segurarParcial("Olha:\n\n``")).toBe("Olha:");
    expect(segurarParcial("Olha:\n\n`")).toBe("Olha:");
    expect(segurarParcial("Olha:\n\n```sq")).toBe("Olha:");
    // tag conhecida completa: o extrairBlocos já desenha o pendente
    expect(segurarParcial("Olha:\n\n```grafico")).toBe("Olha:\n\n```grafico");
    // com a quebra de linha a abertura chegou inteira
    expect(segurarParcial("Olha:\n\n```sql\n")).toBe("Olha:\n\n```sql\n");
  });

  it("fechamento de fence e conteúdo de fence não são tocados", () => {
    const textos = [
      "```sql\nselect 1;\n```",
      "```sql\nselect 1;\n``",
      "```\n| a | b |",
      "```stats\n[{\"valor\":\"1\"",
    ];
    for (const t of textos) expect(segurarParcial(t)).toBe(t);
  });

  it("encadeado com extrairBlocos no stream não mostra cru nem pisca", () => {
    const { textoSemBloco } = extrairBlocos(
      segurarParcial("Resumo:\n\n```stats\n[{\"valor\":\"1"),
      { streaming: true }
    );
    expect(textoSemBloco).toBe("Resumo:\n\n\u0000pendente:stats\u0000");
  });
});
