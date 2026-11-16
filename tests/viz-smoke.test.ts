// smoke temporário do kit viz/ — renderToStaticMarkup (node, sem DOM)
import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { BarraSegmentada } from "../src/components/viz/barra-segmentada";
import { Sparkline } from "../src/components/viz/sparkline";
import { MetricTile } from "../src/components/viz/metrica-tile";
import { MapaCalor } from "../src/components/viz/mapa-calor";
import { FunilEtapas } from "../src/components/viz/funil-etapas";
import { CoorteGrade } from "../src/components/viz/coorte-grade";
import { CaminhosFluxo } from "../src/components/viz/caminhos-fluxo";
import { coorteParaGrade, matrizParaGrade } from "../src/lib/adocao";

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
});

describe("viz kit — aba Adoção (REALIZA-417)", () => {
  it("MetricTile narra delta com seta e referência", () => {
    const html = renderToStaticMarkup(
      createElement(MetricTile, {
        rotulo: "Pessoas ativas",
        valor: "148",
        delta: 0.12,
        deltaRotulo: "vs. os 30 dias anteriores",
      })
    );
    expect(html).toContain("↑ 12%");
    expect(html).toContain("vs. os 30 dias anteriores");
    expect(html).toContain("var(--ok-text)");
  });

  it("MetricTile null declara o porquê; neutro não colore", () => {
    const sem = renderToStaticMarkup(
      createElement(MetricTile, {
        rotulo: "x",
        valor: "10",
        delta: null,
        deltaRotulo: "vs. antes",
      })
    );
    expect(sem).toContain("sem comparação");
    const neutro = renderToStaticMarkup(
      createElement(MetricTile, {
        rotulo: "x",
        valor: "10",
        delta: -0.5,
        deltaRotulo: "vs. antes",
        deltaBom: "neutro",
      })
    );
    expect(neutro).toContain("↓ 50%");
    expect(neutro).not.toContain("--danger-text");
    expect(neutro).not.toContain("--ok-text");
  });

  it("MapaCalor é table real com totais e buraco", () => {
    const grade = matrizParaGrade(
      [
        { superficie: "ficha_dupla", papel: "mentor_dpp", pessoas: 48, gestos: 400 },
        { superficie: "agenda", papel: "coordenacao", pessoas: 30, gestos: 120 },
      ],
      "pessoas"
    );
    const html = renderToStaticMarkup(
      createElement(MapaCalor, {
        grade,
        medida: "pessoas",
        medidaRotulo: "pessoas únicas",
        contexto: "nos últimos 30 dias",
      })
    );
    expect(html).toContain("<table");
    expect(html).toContain("<caption");
    expect(html).toContain("Superfície mais usada");
    expect(html).toContain("color-mix(in oklab, var(--brand-lime)");
    expect(html).toContain(">0<"); // célula vazia imprime o zero quieto
    expect(html).toContain("<tfoot");
  });

  it("FunilEtapas dá largura proporcional e legenda nomeada", () => {
    const html = renderToStaticMarkup(
      createElement(FunilEtapas, {
        instrumentos: [
          { instrumento: "Avaliação do encontro", emitidos: 96, respondidos: 61, tardios: 8, expirados: 21, pendentes: 14 },
          { instrumento: "Intake", emitidos: 48, respondidos: 40, tardios: 0, expirados: 2, pendentes: 6 },
        ],
      })
    );
    expect(html).toContain("61 de 96 responderam (64%) em até 14 dias");
    expect(html).toContain('role="img"');
    expect(html).toContain("width:50%"); // 48/96 = metade do topo
    expect(html).toContain("ver dados em tabela");
    expect(html).toContain("aguardando resposta");
  });

  it("CoorteGrade renderiza triângulo sem célula futura", () => {
    const grade = coorteParaGrade(
      [
        { coorte: "2025-11-03", semana: 0, ativas: 10, total: 10 },
        { coorte: "2025-11-03", semana: 1, ativas: 8, total: 10 },
        { coorte: "2025-11-10", semana: 0, ativas: 12, total: 12 },
      ],
      4
    );
    const html = renderToStaticMarkup(
      createElement(CoorteGrade, { grade })
    );
    expect(html).toContain("80%");
    expect(html).toContain("semana 1");
    expect(html).toContain("sem 10/11");
  });

  it("CaminhosFluxo é ol ranqueado com chips nomeados", () => {
    const html = renderToStaticMarkup(
      createElement(CaminhosFluxo, {
        caminhos: [
          { de: "home", meio: "agenda", para: "ficha_dupla", pessoas: 41 },
          { de: "jovem", meio: "x_desconhecida", para: "materiais", pessoas: 9 },
        ],
      })
    );
    expect(html).toContain("<ol");
    expect(html).toContain("Ficha da dupla");
    expect(html).toContain("41");
    expect(html).toContain("pessoas");
    expect(html).toContain("x_desconhecida"); // id cru quando não há rótulo
  });
});
