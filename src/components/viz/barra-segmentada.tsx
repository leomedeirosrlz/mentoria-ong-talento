import type { CSSProperties } from "react";
import { cn } from "@/lib/utils";

/** Segmento da BarraSegmentada — uma fatia nomeada do denominador.
 *  Sem `cls` o segmento desenha o hatch neutro (.viz-hatch): a posição
 *  existe no total mas ainda não é mensurável ("sem data", "a fazer") —
 *  o buraco fica visível e nomeado, nunca some do trilho. */
export type SegmentoBarra = {
  /** valor absoluto — o MESMO denominador do "N/M" exibido ao lado */
  valor: number;
  /** nome que a legenda e o aria-label leem — "com registro", "sem data" */
  rotulo: string;
  /** preenchimento do segmento (cor, anel…) — ex.: "bg-[var(--ok)]",
   *  "bg-[var(--info)]", "bg-muted-foreground/40". Omitir = neutro hatch. */
  cls?: string;
};

/** Preenchimento neutro de "sem dado" — hatch definido em globals.css
 *  (.viz-hatch). Exportado pra legendas/swatches fora do componente. */
export const SEGMENTO_NEUTRO = "viz-hatch";

const ALTURA = {
  sm: "h-2",
  md: "h-2.5",
  lg: "h-3.5",
} as const;

/** Barra horizontal segmentada — a "barra honesta" da casa. Regra central:
 *  cada segmento é uma fração LITERAL de `denominador` (width = valor /
 *  denominador), nunca normalizada pela soma dos segmentos — é o modo
 *  `denominador` que matou o bug "4/10 com barra ~90% cheia": a proporção
 *  desenhada é a mesma do número ao lado, e quem não tem dado aparece como
 *  vazio de trilho ou segmento neutro nomeado.
 *
 *  Elevada do `Seg` privado de dashboard-coordenacao.tsx (que por sua vez
 *  seguia a gramática do ResumoEncontrosDupla da agenda e do Primer
 *  ProgressBar): um denominador só, número na legenda, nunca dentro da
 *  barra; segmentos zero não desenham nem entram na legenda.
 *
 *  Acessível: o conjunto vira `role="img"` com aria-label de números
 *  completos ("3 com registro, 2 sem data — total 10") — status nunca
 *  depende só de cor; a legenda nomeada repete o mesmo dado em texto. */
export function BarraSegmentada({
  segmentos,
  denominador,
  legenda = false,
  altura = "md",
  animate = false,
  i = 0,
  ariaLabel,
  className,
}: {
  /** fatias em ordem de pintura (esquerda → direita). Valor 0 não desenha
   *  nem entra na legenda. Soma > denominador é cortada pelo overflow —
   *  é bug de dado do chamador, não se normaliza (mentiria de novo). */
  segmentos: SegmentoBarra[];
  /** o M do "N/M" — o número ao lado e a barra respondem a mesma pergunta.
   *  Soma dos segmentos < denominador deixa o resto do trilho muted à
   *  vista (o buraco honesto); 0 desenha só o trilho vazio. */
  denominador: number;
  /** legenda nomeada embaixo — dot + "N rótulo" por segmento não-zero */
  legenda?: boolean;
  /** sm = h-2 (linhas de lista), md = h-2.5 (cards/resumos),
   *  lg = h-3.5 (faixas-herói, a .hbar da agenda) */
  altura?: keyof typeof ALTURA;
  /** entrada animada uma vez — scaleX da esquerda (.fill-grow do globals);
   *  o guard global de prefers-reduced-motion zera */
  animate?: boolean;
  /** índice do stagger quando a barra entra numa sequência (alimenta --i) */
  i?: number;
  /** leitura completa pro role="img" — default: gerada dos segmentos
   *  não-zero + total ("3 com registro, 2 sem data — total 10") */
  ariaLabel?: string;
  className?: string;
}) {
  const total = Math.max(denominador, 0);
  const descricao = segmentos
    .filter((s) => s.valor > 0)
    .map((s) => `${s.valor} ${s.rotulo}`)
    .join(", ");
  const rotulo =
    ariaLabel ??
    (total > 0
      ? `${descricao || "nenhum"} — total ${total}`
      : descricao || "sem dados");
  return (
    <div className={className}>
      <div
        role="img"
        aria-label={rotulo}
        className={cn(
          "flex w-full overflow-hidden rounded-full bg-muted",
          ALTURA[altura],
          animate && "fill-grow"
        )}
        style={animate ? ({ "--i": i } as CSSProperties) : undefined}
      >
        {total > 0 &&
          segmentos.map(
            (s, idx) =>
              s.valor > 0 && (
                <span
                  key={`${idx}-${s.rotulo}`}
                  // title com o número completo: hover no desktop repete a
                  // legenda (no toque a legenda nomeada já cobre)
                  title={`${s.valor} ${s.rotulo}`}
                  // transition-[width]: update de dados (refresh/filtro)
                  // interpola em vez de repaint seco — reduced-motion zera
                  className={cn(
                    "transition-[width] duration-500 ease-snappy",
                    s.cls ?? SEGMENTO_NEUTRO
                  )}
                  style={{ width: `${(s.valor / total) * 100}%` }}
                />
              )
          )}
      </div>
      {legenda && total > 0 && (
        <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          {segmentos.map(
            (s, idx) =>
              s.valor > 0 && (
                <span
                  key={`${idx}-${s.rotulo}`}
                  className="inline-flex items-center gap-1"
                >
                  <span
                    aria-hidden
                    className={cn(
                      "size-2 rounded-full",
                      s.cls ?? SEGMENTO_NEUTRO
                    )}
                  />
                  {s.valor} {s.rotulo}
                </span>
              )
          )}
        </p>
      )}
    </div>
  );
}
