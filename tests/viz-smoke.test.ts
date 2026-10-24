// smoke temporário do kit viz/ — renderToStaticMarkup (node, sem DOM)
import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { BarraSegmentada } from "../src/components/viz/barra-segmentada";
import { Sparkline } from "../src/components/viz/sparkline";
import { Donut } from "../src/components/viz/donut";

describe("viz kit — render sem explodir", () => {
  it("BarraSegmentada desenha fração literal do denominador + neutro", () => {
    const html = renderToStaticMarkup(
      createElement(BarraSegmentada, {
        segmentos: [
          { valor: 4, rotulo: "realizaram", cls: "bg-[var(--ok)]" },
          { valor: 2, rotulo: "sem data" },
        ],
        denominador: 10,
        legenda: true,
      })
    );
    expect(html).toContain('width:40%'); // 4/10 = barra 40% — o bug morto
    expect(html).toContain("viz-hatch"); // "sem data" vira hatch neutro
    expect(html).toContain("4 realizaram");
    expect(html).toContain("2 sem data");
    expect(html).toContain('role="img"');
  });

  it("BarraSegmentada com denominador 0 mostra só o trilho", () => {
    const html = renderToStaticMarkup(
      createElement(BarraSegmentada, {
        segmentos: [{ valor: 3, rotulo: "x", cls: "bg-[var(--ok)]" }],
        denominador: 0,
      })
    );
    expect(html).not.toContain("width:");
  });

  it("Sparkline renderiza dots, quebra em null e marca atenção", () => {
    const html = renderToStaticMarkup(
      createElement(Sparkline, {
        series: [
          { rotulo: "T1", valores: [4.4, 4.6, null, 3.6], cor: "var(--chart-1)" },
        ],
        labelsX: ["1º", "2º", "3º", "4º"],
        atencaoAbaixoDe: 4,
        min: 1,
        max: 5,
      })
    );
    expect(html).toContain("<polyline");
    expect(html).toContain("var(--warn)"); // ponto de atenção
    expect(html).toContain('role="img"');
    expect(html).toContain("sem dado"); // buraco narrado no aria-label
  });

  it("Donut renderiza fatias + total no centro + legenda com zeros", () => {
    const html = renderToStaticMarkup(
      createElement(Donut, {
        fatias: [
          { valor: 19, rotulo: "em andamento", cor: "var(--ok)" },
          { valor: 0, rotulo: "com apoio aberto", cor: "var(--info)" },
          { valor: 2, rotulo: "em risco", cor: "var(--danger)" },
        ],
        rotuloCentro: "duplas",
      })
    );
    expect(html).toContain("stroke-dasharray");
    expect(html).toContain(">21<"); // total no centro
    expect(html).toContain("com apoio aberto"); // zero fica na legenda
    expect(html).toContain("Rosca:");
  });
});
