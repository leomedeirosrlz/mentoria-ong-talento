import { describe, expect, it } from "vitest";
import { fuzzyMatch, fuzzyTrechos } from "@/lib/fuzzy";

// REALIZA-391 — o matcher compartilhado das buscas: normalizado (caixa/
// acento), tokens em qualquer ordem, subsequência com letras puladas e 1
// edição leve em palavra ≥4; score com match exato na frente, e `trechos`
// em índices do texto ORIGINAL pro <mark> do HighlightText.

describe("fuzzyMatch", () => {
  it("casa substring ignorando caixa e acento", () => {
    expect(fuzzyMatch("maria", "Maria Silva")).not.toBeNull();
    expect(fuzzyMatch("JOAO", "joão")).not.toBeNull();
    expect(fuzzyMatch("acao", "Ação social")).not.toBeNull();
  });

  it("match exato vale mais que subsequência", () => {
    const exato = fuzzyMatch("ana", "Ana Paula")!;
    const sub = fuzzyMatch("ana", "Amanda Nogueira")!;
    expect(exato.score).toBeGreaterThan(sub.score);
  });

  it("tokens batem em qualquer ordem (cada um em algum lugar)", () => {
    expect(fuzzyMatch("silva maria", "Maria Silva")).not.toBeNull();
    expect(fuzzyMatch("souza ana", "Ana Beatriz de Souza")).not.toBeNull();
  });

  it("qualquer token sem match derruba o item", () => {
    expect(fuzzyMatch("maria carlos", "Maria Silva")).toBeNull();
    expect(fuzzyMatch("xyz", "Maria Silva")).toBeNull();
  });

  it("subsequência com letras puladas", () => {
    // "mra" acha "Maria"; iniciais compostas acham "João Silva"
    expect(fuzzyMatch("mra", "Maria")).not.toBeNull();
    expect(fuzzyMatch("js", "João Silva")).not.toBeNull();
  });

  it("tolera 1 edição leve em token ≥4 letras", () => {
    // transposição de vizinhos, letra a menos e letra trocada
    expect(fuzzyMatch("marai", "Maria")).not.toBeNull();
    expect(fuzzyMatch("vitora", "Vitória")).not.toBeNull();
    expect(fuzzyMatch("francsico", "Francisco")).not.toBeNull();
  });

  it("erro grande demais não casa", () => {
    expect(fuzzyMatch("maxixe", "Maria")).toBeNull();
    // token curto não ganha tolerância de typo E subsequência exige a
    // ordem das letras — "iri" não é caminho em "maria"
    expect(fuzzyMatch("iri", "Maria")).toBeNull();
  });

  it("substring ganha de typo na disputa interna", () => {
    const sub = fuzzyMatch("maria", "Mariana")!;
    const typo = fuzzyMatch("marians", "Mariana")!;
    expect(sub.score).toBeGreaterThan(typo.score);
  });

  it("vazio ou só espaços não casa", () => {
    expect(fuzzyMatch("", "Maria")).toBeNull();
    expect(fuzzyMatch("   ", "Maria")).toBeNull();
  });
});

describe("trechos (ranges no texto original)", () => {
  it("substring marca a faixa exata do original", () => {
    const hit = fuzzyMatch("sil", "Maria Silva")!;
    const marcado = hit.trechos
      .map(([i, f]) => "Maria Silva".slice(i, f))
      .join("");
    expect(marcado).toBe("Sil");
  });

  it("acento no original mapeia pro glifo inteiro", () => {
    const hit = fuzzyMatch("joao", "João Silva")!;
    const marcado = hit.trechos
      .map(([i, f]) => "João Silva".slice(i, f))
      .join("");
    expect(marcado).toBe("João");
  });

  it("tokens separados geram faixas separadas", () => {
    const hit = fuzzyMatch("ma si", "Maria Silva")!;
    expect(hit.trechos).toEqual([
      [0, 2],
      [6, 8],
    ]);
  });

  it("fuzzyTrechos marca só os tokens que bateram NESTE texto", () => {
    // "maria" casou em outro campo do item; aqui só "silva" marca
    const t = fuzzyTrechos("maria silva", "João Silva");
    const marcado = t.map(([i, f]) => "João Silva".slice(i, f)).join("");
    expect(marcado).toBe("Silva");
    expect(fuzzyTrechos("maria", "João Silva")).toEqual([]);
  });
});
