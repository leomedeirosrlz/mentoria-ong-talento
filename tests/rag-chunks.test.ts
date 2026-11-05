// Recorte do corpus RAG (scripts/lib/rag-chunks.mjs): ### vira seção
// própria ("<##> › <###>"), a linha de título não se repete no texto, o
// fatiamento corta em fim de frase (nunca no meio de palavra) e o
// overlap é a última frase completa do chunk anterior (P2–P5 da
// auditoria em .auditoria-rag/A-pipeline.md).

import { describe, expect, it } from "vitest";
import { fatiar, MAX, OVERLAP, parseDoc } from "../scripts/lib/rag-chunks.mjs";

const FM = `---
fonte: doc-teste
titulo: Documento de teste
material: doc-teste
natureza: consolidado
---

`;

describe("parseDoc", () => {
  it("## sem ### vira uma seção, e o texto não embute a linha de título", () => {
    const doc = parseDoc(
      "t.md",
      `${FM}# Doc\n\nPreamb.\n\n## Secao A\n\nCorpo de A.\n\nSegundo parágrafo de A.`
    );
    expect(doc.secoes.map((s) => s.secao)).toEqual(["Doc", "Secao A"]);
    const a = doc.secoes[1];
    expect(a.texto).toBe("Corpo de A.\n\nSegundo parágrafo de A.");
    expect(a.texto.startsWith("Secao A")).toBe(false);
  });

  it("## com intro curta e dois ### vira 'A › B' e 'A › C', com a intro de contexto", () => {
    const doc = parseDoc(
      "t.md",
      `${FM}# Doc\n\n## A\n\nIntro de A.\n\n### B\n\nCorpo de B.\n\n### C\n\nCorpo de C.`
    );
    // h1 sem corpo não vira seção (chunk só com o título do doc); a intro
    // curta vai como contexto na frente de cada ###
    expect(doc.secoes.map((s) => s.secao)).toEqual(["A › B", "A › C"]);
    expect(doc.secoes[0].texto).toBe("Intro de A.\n\nCorpo de B.");
    expect(doc.secoes[1].texto).toBe("Intro de A.\n\nCorpo de C.");
  });

  it("intro longa de um ## com ### segue como seção própria", () => {
    const intro = "Frase longa da introdução do capítulo. ".repeat(10).trim();
    const doc = parseDoc("t.md", `${FM}## A\n\n${intro}\n\n### B\n\nCorpo de B.`);
    expect(doc.secoes).toEqual([
      { secao: "A", texto: intro },
      { secao: "A › B", texto: "Corpo de B." },
    ]);
  });

  it("### de corpo vazio é descartado e intro vazia não gera seção", () => {
    const doc = parseDoc(
      "t.md",
      `${FM}# Doc\n\n## A\n\n### B\n\n### C\n\nCorpo de C.`
    );
    // intro entre "## A" e "### B" é vazia → sem seção "A"; ### B sem corpo
    expect(doc.secoes.map((s) => s.secao)).toEqual(["A › C"]);
    expect(doc.secoes[0].texto).toBe("Corpo de C.");
  });

  it("doc que começa direto em ## (sem h1) segue o mesmo recorte", () => {
    const doc = parseDoc("t.md", `${FM}## A\n\nCorpo de A.`);
    expect(doc.secoes).toEqual([{ secao: "A", texto: "Corpo de A." }]);
  });

  it("mantém o shape {fonte, titulo, material, natureza, secoes}", () => {
    const doc = parseDoc("t.md", `${FM}# Doc\n\n## A\n\nCorpo.`);
    expect(doc).toMatchObject({
      fonte: "doc-teste",
      titulo: "Documento de teste",
      material: "doc-teste",
      natureza: "consolidado",
    });
  });

  it("recusa front-matter sem 'natureza' com a mensagem de sempre", () => {
    const sem = FM.replace("natureza: consolidado\n", "");
    expect(() => parseDoc("t.md", sem)).toThrow(
      "t.md: frontmatter sem 'natureza'"
    );
  });
});

describe("fatiar", () => {
  it("seção até MAX devolve um único chunk igual ao texto", () => {
    const t = "Texto curto da seção. Duas frases só.";
    expect(fatiar(t)).toEqual([t]);
  });

  it("parágrafo ~2500 chars: chunks ≤MAX, sem meia palavra, sem '… ' no 1º", () => {
    const frase = (i: number) =>
      `Frase ${i} do texto longo, com palavras e vírgulas para encher o parágrafo inteiro de conteúdo realista.`;
    const p = Array.from({ length: 30 }, (_, i) => frase(i)).join(" ");
    expect(p.length).toBeGreaterThan(2400);
    const chunks = fatiar(p);
    expect(chunks.length).toBeGreaterThanOrEqual(3);
    for (const c of chunks) {
      expect(c.length).toBeLessThanOrEqual(MAX);
      expect(c.endsWith(" ")).toBe(false);
      expect(/[.!?]$/.test(c)).toBe(true); // fecha em fim de frase
    }
    expect(chunks[0].startsWith("… ")).toBe(false);
    expect(chunks[1].startsWith("… ")).toBe(true);
  });

  it("overlap: o 2º chunk abre com '… ' + a última frase completa do 1º", () => {
    const p1 =
      "Primeiro parágrafo com frases introdutórias para dar volume ao chunk e empurrar a soma dos dois parágrafos acima do limite máximo. " +
      "Frase do meio bem comprida, cheia de palavras e conectivos para ocupar ainda mais espaço do que o necessário aqui dentro. " +
      "Última frase marcada para o teste de overlap.";
    const p2 =
      "Segundo parágrafo, também grande: " +
      "conteúdo de preenchimento ".repeat(24) +
      "fim.";
    const chunks = fatiar(`${p1}\n\n${p2}`);
    expect(chunks.length).toBe(2);
    expect(chunks[0]).toBe(p1);
    expect(chunks[1].startsWith("… Última frase marcada para o teste de overlap.")).toBe(
      true
    );
  });

  it("sem overlap quando a última frase passa de 2×OVERLAP", () => {
    const p1 =
      "Frase curta. " +
      `Frase enorme sem pontuação interna ${"que segue ".repeat(32)}até o fim`;
    const p2 = "Segundo parágrafo. " + "Mais texto ".repeat(50) + "fim.";
    const chunks = fatiar(`${p1}\n\n${p2}`);
    expect(chunks[0]).toBe(p1);
    expect(chunks[1]).toBe(p2); // última frase do p1 > 240 chars → sem "… "
  });

  it("lista longa fatia por item '- ', sem partir item no meio", () => {
    const item = (i: number) =>
      `- Item ${i} da lista com uma descrição suficientemente longa para ocupar um bom espaço`;
    const p = Array.from({ length: 20 }, (_, i) => item(i)).join("\n");
    expect(p.length).toBeGreaterThan(MAX);
    const chunks = fatiar(p);
    for (const c of chunks) {
      expect(c.length).toBeLessThanOrEqual(MAX);
      // cada linha do chunk é um item inteiro (a 1ª pode ser overlap "… -")
      for (const l of c.split("\n")) expect(l.startsWith("- ") || l.startsWith("… - ")).toBe(true);
    }
    // nenhum item aberto no meio: todo "- Item N" do original aparece inteiro
    const todo = chunks.join("\n").replace(/… - /g, "- ");
    for (let i = 0; i < 20; i++) expect(todo).toContain(item(i));
  });

  it("frase única >MAX é cortada no último espaço antes de MAX", () => {
    const p = "palavra ".repeat(140).trimEnd() + " fim"; // ~1130 chars, sem pontuação
    expect(p.length).toBeGreaterThan(MAX);
    const chunks = fatiar(p);
    expect(chunks.length).toBe(2);
    for (const c of chunks) expect(c.length).toBeLessThanOrEqual(MAX);
    // sem palavra partida e sem "… " (corte no meio da frase não carrega overlap)
    expect(chunks.join(" ").replace(/\s+/g, " ")).toBe(p);
    expect(chunks[1].startsWith("… ")).toBe(false);
  });

  it("parágrafo gigante não zera o overlap do chunk seguinte", () => {
    const frase = (i: number) =>
      `Frase ${i} do parágrafo gigante com bastante conteúdo e palavras variadas para passar do alvo.`;
    const p1 = Array.from({ length: 20 }, (_, i) => frase(i)).join(" ");
    const p2 = "Parágrafo normal depois do gigante. " + "Complemento ".repeat(20) + "fim.";
    const chunks = fatiar(`${p1}\n\n${p2}`);
    const ultimo = chunks[chunks.length - 1];
    // o último chunk (que traz p2) abre com overlap da frase anterior
    expect(ultimo.startsWith("… ")).toBe(true);
    expect(ultimo).toContain("Parágrafo normal depois do gigante.");
  });
});
