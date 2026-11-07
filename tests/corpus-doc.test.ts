// Guia nativo: âncoras de seção + loader/render do corpus (docs/rag/*.md).
// montarDocCorpus é puro (slug + raw) e recebe fixture inline; os loaders
// (carregar/listar) rodam contra o corpus real — docs/rag está no repo.
import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { secaoAnchor } from "@/lib/materiais/corpus-anchor";
import {
  carregarDocCorpus,
  corpusServeJovem,
  corpusServePapel,
  gruposCorpus,
  listarDocsCorpus,
  montarDocCorpus,
} from "@/lib/materiais/corpus-doc";
import { CorpusDocBody } from "@/components/corpus-documento";
import type { DocBloco } from "@/lib/materiais-documentos";

describe("secaoAnchor", () => {
  it("slugifica o caminho de seção do contrato", () => {
    expect(secaoAnchor("PDM › Onde fica na plataforma")).toBe(
      "pdm-onde-fica-na-plataforma"
    );
  });

  it("tira diacríticos via NFD", () => {
    expect(secaoAnchor("Declaração de Visão")).toBe("declaracao-de-visao");
    expect(secaoAnchor("Avaliação · Histórias & Fechamento")).toBe(
      "avaliacao-historias-fechamento"
    );
  });

  it("colapsa pontuação e espaços em um hífen só", () => {
    expect(secaoAnchor("1º encontro · Ficha do encontro")).toBe(
      "1-encontro-ficha-do-encontro"
    );
    expect(secaoAnchor("  — A/B (teste)!!  ")).toBe("a-b-teste");
    expect(secaoAnchor("")).toBe("");
  });
});

const FIXTURE = `---
fonte: fixture-doc
titulo: "Documento de Teste"
material: fixture-doc
tipo: conteudo
natureza: consolidado
audiencia: [dpp, mentorado]
versao: vigente
origem: fixture de teste em
  duas linhas dobradas
---

# Documento de Teste

Introdução do doc com **negrito** e um & comercial.

## Seção Um

Corpo da seção um.

- item a
- item b

## Seção Dois

### Sub A

Texto da sub.

1. primeiro
2. segundo

### Sub B

*(Nota editorial do corpus.)*

| Col A | Col B |
|---|---|
| x | **y** |

## Modelo

**Assunto:** linha de assunto do e-mail

## Blocos do guia

**1. Orientação.** Você oferece suporte na construção do projeto de vida.

*(Dica: adapte o ritmo à realidade do(a) jovem.)*

*(Sem palavra-chave, só a reflexão.)*

Texto que termina em nota. *(Atualização: a plataforma vigente mudou.)*

*"Se quer ir rápido, vá sozinho." (Provérbio africano)*
`;

describe("montarDocCorpus", () => {
  const doc = montarDocCorpus("fixture-doc", FIXTURE)!;

  it("monta lede, meta e seções ##/### no formato ## › ###", () => {
    expect(doc.titulo).toBe("Documento de Teste");
    expect(doc.audiencia).toEqual(["mentor_dpp", "mentorado"]);
    expect(doc.origem).toBe("fixture de teste em duas linhas dobradas");
    expect(doc.ledeAnchor).toBe("documento-de-teste");
    expect(doc.lede[0]).toEqual({
      kind: "par",
      html: "Introdução do doc com <b>negrito</b> e um &amp; comercial.",
    });
    expect(doc.secoes.map((s) => s.secao)).toEqual([
      "Seção Um",
      "Seção Dois › Sub A",
      "Seção Dois › Sub B",
      "Modelo",
      "Blocos do guia",
    ]);
    expect(doc.secoes.map((s) => s.anchor)).toEqual([
      "secao-um",
      "secao-dois-sub-a",
      "secao-dois-sub-b",
      "modelo",
      "blocos-do-guia",
    ]);
  });

  it("mapeia o corpo pra blocos: par, lista (ol/ul), callout, tabela, subj", () => {
    const [um, subA, subB, modelo] = doc.secoes;
    expect(um.blocos).toEqual([
      { kind: "par", html: "Corpo da seção um." },
      { kind: "lista", itens: ["item a", "item b"], ordenada: false },
    ]);
    expect(subA.blocos[1]).toEqual({
      kind: "lista",
      itens: ["primeiro", "segundo"],
      ordenada: true,
    });
    // whole *(Nota …)* → callout; the "Nota" keyword gives the info tone
    // (no colon after the keyword → no bold label)
    expect(subB.blocos[0]).toEqual({
      kind: "callout",
      tom: "info",
      html: "Nota editorial do corpus.",
    });
    expect(subB.blocos[1]).toMatchObject({
      kind: "tabela",
      cabecalho: ["Col A", "Col B"],
      linhas: [["x", "<b>y</b>"]],
    });
    expect(modelo.blocos[0]).toEqual({
      kind: "subj",
      texto: "linha de assunto do e-mail",
    });
  });

  it("numero, callout por tom, quote e nota final separada do parágrafo", () => {
    const blocos = doc.secoes[4].blocos;
    // "**N. Título.** rest" → numbered item with highlighted digit
    expect(blocos[0]).toEqual({
      kind: "numero",
      numero: "1",
      titulo: "Orientação",
      html: "Você oferece suporte na construção do projeto de vida.",
    });
    // the keyword at the start of *(…)* sets the tone
    expect(blocos[1]).toEqual({
      kind: "callout",
      tom: "tip",
      html: "<b>Dica:</b> adapte o ritmo à realidade do(a) jovem.",
    });
    // no keyword → editorial reflection
    expect(blocos[2]).toEqual({
      kind: "callout",
      tom: "note",
      html: "Sem palavra-chave, só a reflexão.",
    });
    // *(…)* at the END of a paragraph splits into par + callout (Atualização→info)
    expect(blocos[3]).toEqual({ kind: "par", html: "Texto que termina em nota." });
    expect(blocos[4]).toEqual({
      kind: "callout",
      tom: "info",
      html: "<b>Atualização:</b> a plataforma vigente mudou.",
    });
    // *"…" (source)* → blockquote
    expect(blocos[5]).toEqual({
      kind: "quote",
      html: '"Se quer ir rápido, vá sozinho."',
      fonte: "Provérbio africano",
    });
  });

  it("agrupa ### sob o ## pai (intro ausente → heading implícito)", () => {
    const grupos = gruposCorpus(doc.secoes);
    expect(grupos.map((g) => g.titulo)).toEqual([
      "Seção Um",
      "Seção Dois",
      "Modelo",
      "Blocos do guia",
    ]);
    expect(grupos[1].intro).toBeNull();
    expect(grupos[1].subs.map((s) => s.titulo)).toEqual(["Sub A", "Sub B"]);
    expect(grupos[1].anchor).toBe("secao-dois");
  });
});

const FIXTURE_ENC = `---
fonte: enc
titulo: Encontros
material: enc
natureza: consolidado
---

# Encontros

## Fase 1 · Chegada

### 1º encontro · Acordos e vínculo

Texto do encontro; a tarefa é preencher a ficha. Passo a passo: Roteiro do 1º encontro.

## Trilha

**3º ENCONTRO: Olhar e ouvir.** Texto do encontro especialista.
`;

describe("blocos de encontro", () => {
  const doc = montarDocCorpus("enc", FIXTURE_ENC)!;
  const encontro = (b: DocBloco) =>
    b as Extract<DocBloco, { kind: "encontro" }>;

  it("### Nº encontro · Título vira card com âncora e slots finais", () => {
    const s = doc.secoes[0];
    // a âncora segue o caminho "## › ###" — a mesma chave que a citação usa
    expect(s.anchor).toBe("fase-1-chegada-1-encontro-acordos-e-vinculo");
    expect(s.blocos).toHaveLength(1);
    const b = encontro(s.blocos[0]);
    expect(b).toMatchObject({
      kind: "encontro",
      numero: "1",
      titulo: "Acordos e vínculo",
      anchor: s.anchor,
      tarefa: "preencher a ficha",
      roteiro: { slug: "roteiro-encontro-01", rotulo: "Roteiro do 1º encontro" },
    });
    // os slots saem do corpo — o que sobra é o texto do encontro
    expect(b.corpo).toEqual([{ kind: "par", html: "Texto do encontro." }]);
  });

  it("**Nº ENCONTRO: T.** inline vira card sem âncora nem slots", () => {
    const b = encontro(doc.secoes[1].blocos[0]);
    expect(b).toMatchObject({
      kind: "encontro",
      numero: "3",
      titulo: "Olhar e ouvir",
      corpo: [{ kind: "par", html: "Texto do encontro especialista." }],
    });
    expect(b.anchor).toBeUndefined();
    expect(b.tarefa).toBeUndefined();
    expect(b.roteiro).toBeUndefined();
  });

  it("o card renderiza âncora, eyebrow, tarefa e o link do roteiro", () => {
    const html = renderToStaticMarkup(createElement(CorpusDocBody, { doc }));
    expect(html).toContain('id="fase-1-chegada-1-encontro-acordos-e-vinculo"');
    expect(html).toContain("1º encontro");
    expect(html).toContain("Acordos e vínculo");
    expect(html).toContain("preencher a ficha");
    expect(html).toContain(
      'href="/materiais/documento/roteiro-encontro-01"'
    );
    expect(html).toContain("Roteiro do 1º encontro");
  });
});

describe("carregarDocCorpus (corpus real)", () => {
  it("resolve pelo material do frontmatter", async () => {
    const doc = await carregarDocCorpus("instrumento-pdm");
    expect(doc?.titulo).toBe("PDM: Plano de Desenvolvimento do Mentorado");
    expect(doc?.secoes).toHaveLength(7);
    expect(
      doc?.secoes.find((s) => s.secao === "PDM · Onde fica na plataforma")
        ?.anchor
    ).toBe("pdm-onde-fica-na-plataforma");
  });

  it("resolve slug de material ≠ nome de arquivo e fallback por arquivo", async () => {
    const porMaterial = await carregarDocCorpus("ciclo-cronograma");
    const porArquivo = await carregarDocCorpus("ciclo-2026-2027");
    expect(porMaterial?.slug).toBe("ciclo-cronograma");
    expect(porArquivo?.slug).toBe("ciclo-cronograma");
  });

  it("devolve null pra slug fora do corpus", async () => {
    expect(await carregarDocCorpus("nao-existe")).toBeNull();
  });

  it("tabela só com coluna de texto vira ficha de marcação (checkbox)", async () => {
    const doc = await carregarDocCorpus("checklist-competencias");
    const tabela = doc!.secoes
      .flatMap((s) => s.blocos)
      .find((b) => b.kind === "tabela");
    expect(tabela).toMatchObject({ kind: "tabela", marcacao: true });
  });

  it("âncoras são únicas dentro de cada doc", async () => {
    const doc = await carregarDocCorpus("guia-mentor-dpp");
    const anchors = doc!.secoes.map((s) => s.anchor);
    expect(new Set(anchors).size).toBe(anchors.length);
    expect(doc!.secoes.length).toBeGreaterThan(50);
  });

  it("guia DPP: os 16 encontros viram cards linkados pro roteiro", async () => {
    const doc = await carregarDocCorpus("guia-mentor-dpp");
    const encs = doc!.secoes
      .flatMap((s) => s.blocos)
      .filter((b) => b.kind === "encontro") as Extract<
      DocBloco,
      { kind: "encontro" }
    >[];
    expect(encs).toHaveLength(16);
    const [e1, , , , , , , , , , , , , , , e16] = encs;
    expect(e1).toMatchObject({
      numero: "1",
      titulo: "Boas-vindas, histórias de vida e abertura do PDM",
      roteiro: { slug: "roteiro-encontro-01" },
    });
    expect(e1.tarefa).toContain("Construindo a sua Visão");
    // encontro sem tarefa no corpo segue sem o slot (o 5º não tem "Tarefa:")
    expect(encs.find((b) => b.numero === "5")!.tarefa).toBeUndefined();
    expect(e16.numero).toBe("16");
    expect(e16.roteiro?.slug).toBe("roteiro-encontro-16");
    // o 16º fecha com a nota de atualização dentro do card
    expect(e16.corpo.some((b) => b.kind === "callout")).toBe(true);
    // toda âncora de card é a da seção — a mesma que a citação resolve
    for (const b of encs) expect(b.anchor).toMatch(/encontro-/);
  });

  it("guia especialista: os 5 encontros inline viram cards sem âncora", async () => {
    const doc = await carregarDocCorpus("guia-mentor-especialista");
    const encs = doc!.secoes
      .flatMap((s) => s.blocos)
      .filter((b) => b.kind === "encontro") as Extract<
      DocBloco,
      { kind: "encontro" }
    >[];
    expect(encs.map((b) => b.numero)).toEqual(["1", "2", "3", "4", "5"]);
    expect(encs.every((b) => b.anchor === undefined)).toBe(true);
    expect(encs[0].titulo).toBe(
      "Acolhimento, vínculo e identificação da demanda"
    );
  });

  it("listarDocsCorpus cobre os 36 arquivos do corpus", async () => {
    const docs = await listarDocsCorpus();
    expect(docs.length).toBe(36);
    expect(docs.map((d) => d.slug)).toContain("guia-mentor-especialista");
  });
});

describe("corpusServeJovem", () => {
  const fake = (audiencia: string[]) =>
    ({ audiencia }) as Parameters<typeof corpusServeJovem>[0];

  it("só serve audiência que cubra o jovem", async () => {
    expect(corpusServeJovem(fake(["todos"]))).toBe(true);
    expect(corpusServeJovem(fake(["mentorado"]))).toBe(true);
    expect(corpusServeJovem(fake([]))).toBe(true);
    expect(corpusServeJovem(fake(["mentor_dpp", "coordenacao"]))).toBe(false);
    const feedback = await carregarDocCorpus("feedback-construtivo");
    const guia = await carregarDocCorpus("guia-mentor-dpp");
    expect(corpusServeJovem(feedback!)).toBe(true);
    expect(corpusServeJovem(guia!)).toBe(false);
  });
});

describe("corpusServePapel", () => {
  const fake = (audiencia: string[]) =>
    ({ audiencia }) as Parameters<typeof corpusServePapel>[0];

  it("espelha a regra do catálogo: coordenação vê tudo, todos/aberto serve", async () => {
    const termo = await carregarDocCorpus("termo-mentorando"); // [coordenacao]
    const feedback = await carregarDocCorpus("feedback-construtivo"); // [todos]
    const mentor = { role: "mentor_dpp" as const };
    const coord = { role: "coordenacao" as const };
    expect(corpusServePapel(termo!, mentor)).toBe(false);
    expect(corpusServePapel(termo!, coord)).toBe(true);
    expect(corpusServePapel(feedback!, mentor)).toBe(true);
    expect(corpusServePapel(fake([]), null)).toBe(true); // audiência ausente serve
  });
});

describe("CorpusDocBody (render)", () => {
  it("renderiza seção com heading ancorado, lista e nota", () => {
    const doc = montarDocCorpus("fixture-doc", FIXTURE)!;
    const html = renderToStaticMarkup(createElement(CorpusDocBody, { doc }));
    expect(html).toContain('id="secao-um"');
    expect(html).toContain('id="secao-dois-sub-b"');
    expect(html).toContain('href="#secao-dois-sub-b"');
    expect(html).toContain("<h2");
    expect(html).toContain("<h3");
    expect(html).toContain("<ul");
    expect(html).toContain("<ol");
    expect(html).toContain("<table");
    // callout info: borda+fundo teal dos tokens de status
    expect(html).toContain("--info");
    // sem sumário: só 5 seções (limite é 8)
    expect(html).not.toContain("Neste documento");
  });

  it("liga o sumário colapsável em doc com mais de 8 seções", () => {
    const raw = `---\nfonte: longo\ntitulo: Longo\nmaterial: longo\nnatureza: consolidado\n---\n\n# Longo\n\n${Array.from(
      { length: 9 },
      (_, i) => `## Capítulo ${i + 1}\n\nTexto do capítulo ${i + 1}.`
    ).join("\n\n")}\n`;
    const doc = montarDocCorpus("longo", raw)!;
    expect(doc.secoes).toHaveLength(9);
    const html = renderToStaticMarkup(createElement(CorpusDocBody, { doc }));
    expect(html).toContain("Neste documento");
    expect(html).toContain("9 seções");
    expect(html).toContain('href="#capitulo-5"');
  });
});
