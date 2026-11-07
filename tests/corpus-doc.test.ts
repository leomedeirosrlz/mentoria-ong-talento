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
  jornadaCorpus,
  listarDocsCorpus,
  montarDocCorpus,
  tomSemantico,
} from "@/lib/materiais/corpus-doc";
import { CorpusDocBody } from "@/components/corpus-documento";
import {
  itensDoc,
  linhasDoc,
} from "@/lib/materiais-documentos";
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

  it("o card renderiza âncora, eyebrow, tarefa e o chip-link do roteiro", () => {
    const html = renderToStaticMarkup(createElement(CorpusDocBody, { doc }));
    expect(html).toContain('id="fase-1-chegada-1-encontro-acordos-e-vinculo"');
    expect(html).toContain("1º encontro");
    expect(html).toContain("Acordos e vínculo");
    expect(html).toContain("preencher a ficha");
    expect(html).toContain(
      'href="/materiais/documento/roteiro-encontro-01"'
    );
    expect(html).toContain("Roteiro do 1º encontro");
    // o slot "Passo a passo" virou pill âmbar com o aria-label do slot
    expect(html).toContain('aria-label="Passo a passo: Roteiro do 1º encontro"');
    expect(html).toContain("rounded-full");
  });
});

const FIXTURE_FASES = `---
fonte: fases
titulo: Fases
material: fases
natureza: consolidado
---

# Fases

## Os 16 encontros

Abertura da jornada.

## Encontros 1 a 4 · Fase um

Intro da fase um.

### 1º encontro · Um

Corpo um.

### 2º encontro · Dois

Corpo dois.

## Seção neutra

Texto neutro.

## Encontros 5 e 6 · Fase dois

### 5º encontro · Cinco

Corpo cinco.

### 6º encontro · Seis

Corpo seis.
`;

describe("fases (bandas do PDF)", () => {
  const doc = montarDocCorpus("fases", FIXTURE_FASES)!;
  const grupos = gruposCorpus(doc.secoes);

  it("## que casa FASE_RE numera a fase na ordem do doc", () => {
    expect(grupos.map((g) => [g.titulo, g.fase])).toEqual([
      ["Os 16 encontros", 0],
      ["Encontros 1 a 4 · Fase um", 1],
      ["Seção neutra", null],
      // ## sem intro: a fase implícita conta no ponto em que o grupo aparece
      ["Encontros 5 e 6 · Fase dois", 2],
    ]);
    // a flag fica na seção de nível 2; ### nunca é fase
    expect(doc.secoes.find((s) => s.titulo === "Os 16 encontros")?.fase).toBe(0);
    expect(
      doc.secoes.every((s) => s.nivel === 2 || s.fase === null)
    ).toBe(true);
  });

  it("banda renderiza o tom rotacionado (lima → destaque → info)", () => {
    const html = renderToStaticMarkup(createElement(CorpusDocBody, { doc }));
    expect(html).toContain("bg-[var(--brand-lime)]/16"); // Os 16 → lima
    expect(html).toContain("bg-[var(--destaque-suave)]"); // 1 a 4 → âmbar
    expect(html).toContain("bg-[var(--info)]/12"); // 5 e 6 → teal
    // seção neutra segue com a regra lima, sem banda
    expect(html).toMatch(
      /<h2 id="secao-neutra"[\s\S]*?border-\[var\(--brand-lime\)\]/
    );
  });
});

describe("jornadaCorpus + trilha", () => {
  const doc = montarDocCorpus("fases", FIXTURE_FASES)!;
  const jornada = jornadaCorpus(gruposCorpus(doc.secoes))!;

  it("agrupa os cards com âncora por fase, na cor da banda", () => {
    expect(jornada.total).toBe(4);
    expect(jornada.home).toBe("os-16-encontros");
    expect(jornada.inicio).toBe("encontros-1-a-4-fase-um");
    expect(jornada.fases.map((f) => [f.rotulo, f.tom])).toEqual([
      ["Encontros 1 a 4", "destaque"],
      ["Encontros 5 e 6", "info"],
    ]);
    expect(jornada.fases[0].pontos.map((p) => p.numero)).toEqual(["1", "2"]);
    // o dot linka a âncora do próprio card — a mesma da citação
    expect(jornada.fases[0].pontos[0].anchor).toBe(
      doc.secoes.find((s) => s.titulo === "1º encontro · Um")?.anchor
    );
  });

  it("a trilha renderiza dots linkados sob o grupo 'Os 16 encontros'", () => {
    const html = renderToStaticMarkup(createElement(CorpusDocBody, { doc }));
    expect(html).toContain('aria-label="Mapa dos 4 encontros"');
    for (const f of jornada.fases) {
      for (const p of f.pontos) {
        expect(html).toContain(`href="#${p.anchor}"`);
        expect(html).toContain(`>${p.numero}</a>`);
      }
    }
  });

  it("menos de 4 dots ou cards sem âncora → sem trilha", () => {
    // fixture de 1 card ancorado + inline: total abaixo do mínimo
    const curto = montarDocCorpus("enc", FIXTURE_ENC)!;
    expect(jornadaCorpus(gruposCorpus(curto.secoes))).toBeNull();
  });
});

describe("itensDoc / linhasDoc (grade e e-mail)", () => {
  const par = { kind: "par", html: "x" } as DocBloco;
  const numero = (n: string) =>
    ({ kind: "numero", numero: n, titulo: `T${n}`, html: "y" }) as DocBloco;

  it("sequências de numero viram um único grupo de grade", () => {
    expect(itensDoc([par, numero("1"), numero("2"), par])).toEqual([
      par,
      { kind: "nums", itens: [numero("1"), numero("2")] },
      par,
    ]);
  });

  it("subj abre o card de e-mail com o corpo até o próximo subj ou fim", () => {
    const subj = (t: string) => ({ kind: "subj", texto: t }) as DocBloco;
    const linhas = linhasDoc([par, subj("A"), par, par, subj("B"), par]);
    expect(linhas).toEqual([
      { kind: "item", item: par },
      { kind: "email", assunto: "A", corpo: [par, par] },
      { kind: "email", assunto: "B", corpo: [par] },
    ]);
  });

  it("a grade e o card renderizam com chip do tom semântico e header Assunto", () => {
    const raw = `---\nfonte: x\ntitulo: X\nmaterial: x\nnatureza: consolidado\n---\n\n# X\n\n## As nove funções: trabalho e carreira\n\n**1. Uma.** Texto um.\n\n**2. Duas.** Texto dois.\n\n## Modelo\n\n**Assunto:** Assunto de teste\n\nCorpo do e-mail.\n`;
    const doc = montarDocCorpus("x", raw)!;
    const html = renderToStaticMarkup(createElement(CorpusDocBody, { doc }));
    expect(html).toContain("sm:grid-cols-2");
    // "trabalho e carreira" → teal/info no chip
    expect(html).toContain("bg-[var(--info)] text-[var(--status-foreground)]");
    // card de e-mail: barra lima + header Assunto
    expect(html).toContain("border-l-4 border-[var(--brand-lime)]");
    expect(html).toContain("<b class=\"font-semibold\">Assunto:</b>");
    expect(html).toContain("Assunto de teste");
    expect(html).toContain("Corpo do e-mail.");
  });

  it("tomSemantico mapeia a dimensão do título (e null fora do mapa)", () => {
    expect(tomSemantico("As nove funções: trabalho e carreira")).toBe("info");
    expect(tomSemantico("As nove funções: apoio socioemocional")).toBe(
      "destaque"
    );
    expect(tomSemantico("As nove funções: função modelar")).toBe("lima");
    expect(tomSemantico("Perguntas Eficazes")).toBeNull();
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

  it("guia DPP: as 8 bandas de fase e a trilha dos 16 encontros", async () => {
    const doc = await carregarDocCorpus("guia-mentor-dpp");
    const grupos = gruposCorpus(doc!.secoes);
    // Os 16 + os 6 grupos de mês + Modelos e instrumentos = 8 bandas
    const bandas = grupos.filter((g) => g.fase != null);
    expect(bandas.map((g) => [g.titulo.split(" ·")[0], g.fase])).toEqual([
      ["Os 16 encontros", 0],
      ["Encontros 1 a 4", 1],
      ["Encontros 5 a 7", 2],
      ["Encontros 8 e 9", 3],
      ["Encontros 10 e 11", 4],
      ["Encontros 12 a 14", 5],
      ["Encontros 15 e 16", 6],
      ["Modelos e instrumentos citados no guia", 7],
    ]);

    const jornada = jornadaCorpus(grupos)!;
    expect(jornada.total).toBe(16);
    expect(jornada.home).toBe("os-16-encontros");
    // os 6 grupos de mês herdam a cor da própria banda (fases 1..6)
    expect(jornada.fases.map((f) => f.tom)).toEqual([
      "destaque",
      "info",
      "lima",
      "destaque",
      "info",
      "lima",
    ]);
    expect(
      jornada.fases.flatMap((f) => f.pontos.map((p) => p.numero))
    ).toEqual(Array.from({ length: 16 }, (_, i) => `${i + 1}`));

    const html = renderToStaticMarkup(
      createElement(CorpusDocBody, { doc: doc! })
    );
    expect(html).toContain('aria-label="Mapa dos 16 encontros"');
    // um dot aria-label por encontro + cada um linka a âncora do card
    expect(html.match(/aria-label="\d+º encontro · /g)).toHaveLength(16);
    for (const f of jornada.fases)
      for (const p of f.pontos) expect(html).toContain(`href="#${p.anchor}"`);
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
