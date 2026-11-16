/** Mini-kit de visualização da casa — SVG/div puros com os tokens do app
 *  (sem lib de chart). Gramática das referências: número sempre com
 *  denominador ou escala, legenda nomeada, buraco visível ("sem data"),
 *  status nunca só por cor, entrada animada opcional (animate) coberta
 *  pelo guard global de prefers-reduced-motion. */
export { BarraSegmentada, SEGMENTO_NEUTRO, type SegmentoBarra } from "./barra-segmentada";
export { Sparkline, type SerieSpark } from "./sparkline";
export { GraficoTempo, type PontoGrafico, type FormatoEixo } from "./grafico-tempo";
export { MetricTile, type DeltaBom } from "./metrica-tile";
export { MapaCalor } from "./mapa-calor";
export { FunilEtapas } from "./funil-etapas";
export { CoorteGrade } from "./coorte-grade";
export { CaminhosFluxo } from "./caminhos-fluxo";
