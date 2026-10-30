// smoke do genUI v2 do assistente — renderToStaticMarkup (node, sem DOM):
// prova que os 6 tipos do ```grafico renderizam sem explodir e com a
// semântica certa (role="img" + resumo textual, valor nunca só na cor)
import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { CodeBlock, GraficoBloco } from "../src/components/assistente-genui";
import type { Grafico } from "../src/lib/ia/render";

const base = (tipo: Grafico["tipo"], extra: Partial<Grafico> = {}): Grafico => ({
  tipo,
  titulo: "Teste",
  dados: [
    { rotulo: "em risco", valor: 3, tom: "danger" },
    { rotulo: "em dia", valor: 9, tom: "ok" },
    { rotulo: "sem tom", valor: 5 },
  ],
  ...extra,
});

describe("GraficoBloco — render sem explodir", () => {
  it("barras desenha rect por dado + role img com o resumo", () => {
    const html = renderToStaticMarkup(
      createElement(GraficoBloco, { g: base("barras") })
    );
    expect(html).toContain("<rect");
    expect(html).toContain('role="img"');
    expect(html).toContain("em risco 3");
    expect(html).toContain("var(--danger)"); // tom semântico vira cor
    expect(html).toContain("ia-barra"); // animação de entrada aplicada
  });

  it("barras-h vira linhas HTML com rótulo, trilho e valor", () => {
    const html = renderToStaticMarkup(
      createElement(GraficoBloco, { g: base("barras-h") })
    );
    expect(html).toContain('role="img"');
    expect(html).toContain("ia-barra-h");
    expect(html).toContain(">3</span>"); // valor nomeado à direita
  });

  it("barras com >6 itens cai na horizontal automaticamente", () => {
    const muitos: Grafico = {
      tipo: "barras",
      dados: Array.from({ length: 8 }, (_, i) => ({
        rotulo: `r${i}`,
        valor: i + 1,
      })),
    };
    const html = renderToStaticMarkup(
      createElement(GraficoBloco, { g: muitos })
    );
    expect(html).toContain("ia-barra-h");
    expect(html).not.toContain("ia-barra\""); // sem barra vertical
  });

  it("linha desenha polyline + dots; area adiciona gradiente", () => {
    const linha = renderToStaticMarkup(
      createElement(GraficoBloco, { g: base("linha") })
    );
    expect(linha).toContain("<polyline");
    expect(linha).toContain("ia-traco");
    expect(linha).not.toContain("linearGradient");

    const area = renderToStaticMarkup(
      createElement(GraficoBloco, { g: base("area") })
    );
    expect(area).toContain("linearGradient");
  });

  it("rosca desenha um arco por fatia + legenda nomeada + total", () => {
    const html = renderToStaticMarkup(
      createElement(GraficoBloco, { g: base("rosca") })
    );
    expect(html).toContain('role="img"');
    expect(html).toContain("ia-arco");
    expect(html).toContain(">em risco<"); // legenda com nome, não só cor
    expect(html).toContain(">total<"); // centro nomeado (o número faz count-up)
    expect(html).toContain('var(--chart-3)'); // fatia sem tom cai na série
  });

  it("progresso mostra % grande + fração n/m explícita", () => {
    const html = renderToStaticMarkup(
      createElement(GraficoBloco, {
        g: base("progresso", {
          total: 16,
          dados: [{ rotulo: "encontros realizados", valor: 12 }],
        }),
      })
    );
    expect(html).toContain("%"); // destaque percentual
    expect(html).toContain("12 de 16"); // denominador honesto
    expect(html).toContain("fill-grow");
  });
});

describe("CodeBlock", () => {
  it("header com a linguagem + botão copiar habilitado", () => {
    const html = renderToStaticMarkup(
      createElement(CodeBlock, { codigo: "select 1;", linguagem: "sql" })
    );
    expect(html).toContain(">sql<");
    expect(html).toContain("select 1;");
    expect(html).toContain("Copiar");
    expect(html).not.toContain('disabled=""');
  });

  it("fence ainda aberto (stream): copiar sai desabilitado", () => {
    const html = renderToStaticMarkup(
      createElement(CodeBlock, { codigo: "x = 1", pronto: false })
    );
    expect(html).toContain('disabled=""');
    expect(html).toContain(">código<"); // sem linguagem vira "código"
  });
});
