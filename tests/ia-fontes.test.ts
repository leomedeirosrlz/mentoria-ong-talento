// limparTrecho (lib/ia/fontes.ts): o `trecho` do match_ia_chunks chega
// sujo — ts_headline traz <b>, o chunk tem markdown cru (**, |, -, ---)
// e o corte de 40 palavras/220 chars parte a frase no meio. O card de
// "Trechos dos guias" e o contexto do modelo recebem a versão limpa:
// texto corrido, ponta de chunk aparada e corte no fim de frase.

import { describe, expect, it } from "vitest";
import { limparTrecho } from "@/lib/ia/fontes";

describe("limparTrecho", () => {
  it("tira as marcas <b> do ts_headline e o negrito markdown", () => {
    expect(
      limparTrecho(
        "Leitura da <b>Roda</b> da <b>Vida</b> - **Fase:** 5º mês",
        600
      )
    ).toBe("Leitura da Roda da Vida · Fase: 5º mês");
  });

  it("achata tabela pipe sem deixar o separador |---|", () => {
    expect(
      limparTrecho(
        "| Etapa | Encontros | |---|---| | Abertura | 1º | Apresentações |",
        600
      )
    ).toBe("Etapa · Encontros · Abertura · 1º · Apresentações");
  });

  it("apara a ponta do chunk (reticências e marcador de lista)", () => {
    expect(limparTrecho("… desenvolvimento e da aplicação do PDM", 600)).toBe(
      "desenvolvimento e da aplicação do PDM"
    );
    expect(limparTrecho("### 7. Roda da Vida: roteiro", 600)).toBe(
      "7. Roda da Vida: roteiro"
    );
    expect(limparTrecho("- item solto", 600)).toBe("item solto");
  });

  it("travessão do documento vira vírgula (regra de copy)", () => {
    expect(limparTrecho("12º encontro — Leitura da Roda da Vida", 600)).toBe(
      "12º encontro, Leitura da Roda da Vida"
    );
  });

  it("corta no fim da última frase completa, não no meio", () => {
    const longo =
      "Primeira frase inteira. Segunda frase inteira. " +
      "Terceira frase muito comprida que não cabe no limite de forma alguma.";
    const t = limparTrecho(longo, 90);
    expect(t).toBe("Primeira frase inteira. Segunda frase inteira.");
    expect(t).not.toContain("…");
  });

  it("sem frase completa no limite, corta em palavra e fecha com …", () => {
    const t = limparTrecho("palavra ".repeat(60), 100);
    expect(t.endsWith("…")).toBe(true);
    expect(t.length).toBeLessThanOrEqual(100);
    expect(t).not.toMatch(/palavra palav…$/); // não partiu palavra
  });

  it("entrada vazia devolve vazio", () => {
    expect(limparTrecho(null, 320)).toBe("");
    expect(limparTrecho(undefined, 320)).toBe("");
    expect(limparTrecho("", 320)).toBe("");
  });
});
