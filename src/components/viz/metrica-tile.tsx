import type { CSSProperties } from "react";
import { cn } from "@/lib/utils";
import { Sparkline } from "./sparkline";

/** Direção que conta como "boa" pro delta do tile. "neutro" = a métrica não
 *  tem lado bom (ex.: gestos sobem por curiosidade, não necessariamente
 *  adoção) — a variação aparece sem tinta de status. */
export type DeltaBom = "sobe" | "desce" | "neutro";

/** "%" do delta com honestidade de arredondamento: 0,4% não vira "0%"
 *  (leria como "nada mudou" quando mudou) — vira "menos de 1%". */
function textoDelta(delta: number): string {
  const abs = Math.abs(delta) * 100;
  const arred = Math.round(abs);
  return arred === 0 && abs > 0 ? "menos de 1%" : `${arred}%`;
}

/** Tile de KPI da régua — a peça do "de relance" da aba. O número chega
 *  pronto (o servidor formata: "3,4 mil", "14 de 17"); o delta chega como
 *  fração e é narrado com seta + texto + referência — nunca só cor.
 *
 *  Semântica do delta: `deltaBom` declara qual direção é notícia boa —
 *  default "sobe" (ativas, resposta). "desce" pra métricas de custo/fila.
 *  "neutro" não colore nada: variação informada sem julgamento (gestos).
 *  `delta` null = período anterior zerado (a conta não existe, não é 0%)
 *  e a linha diz isso por extenso. Delta 0 = estabilidade: seta "→" sem
 *  tinta, porque nem sobe nem desce carrega signo. */
export function MetricTile({
  rotulo,
  valor,
  delta,
  deltaRotulo,
  deltaVazio,
  deltaBom = "sobe",
  nota,
  spark,
  destaque = false,
  animate = false,
  i = 0,
  className,
}: {
  /** kicker de grupo — "Pessoas ativas", "Gestos por dia" */
  rotulo: string;
  /** valor principal já formatado ("148", "3,4 mil", "14 de 17", "68%") */
  valor: string;
  /** fração do deltaPct (0.12 = "+12%"); null = sem comparável */
  delta: number | null;
  /** a referência do delta — "vs. os 30 dias anteriores" */
  deltaRotulo: string;
  /** o que a linha do delta diz quando `delta` é null — o default cobre
   *  o caso do deltaPct (período anterior zerado); métricas sem nenhum
   *  comparável passam o motivo real ("sem dado do período anterior") */
  deltaVazio?: string;
  /** qual direção é boa notícia — ver doc do componente */
  deltaBom?: DeltaBom;
  /** contexto pequeno sob o delta ("3 paradas há mais de 14 dias") */
  nota?: string;
  /** série opcional pro rodapé do tile — a spark compacta ocupa o espaço
   *  morto do herói (sem eixo, sem label de último ponto); null = buraco
   *  honesto, a linha quebra e retoma */
  spark?: (number | null)[];
  /** o tile-herói da régua (Pessoas ativas, topo-esquerda do F-pattern) */
  destaque?: boolean;
  /** entrada animada uma vez (fade+rise) — reduced-motion zera */
  animate?: boolean;
  /** índice do stagger na régua (alimenta --i) */
  i?: number;
  className?: string;
}) {
  const direcao = delta != null && delta !== 0 ? (delta > 0 ? "sobe" : "desce") : "igual";
  const seta = direcao === "sobe" ? "↑" : direcao === "desce" ? "↓" : "→";
  // a cor só entra quando a direção é julgável — seta e número carregam o
  // sinal, a tinta reforça (nunca é o único canal)
  const corDelta =
    deltaBom === "neutro" || direcao === "igual"
      ? "text-foreground"
      : direcao === deltaBom
        ? "text-[var(--ok-text)]"
        : "text-[var(--danger-text)]";

  return (
    <div
      className={cn(animate && "animate-enter", className)}
      style={animate ? ({ "--i": i } as CSSProperties) : undefined}
    >
      <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
        {rotulo}
      </p>
      <p
        className={cn(
          "mt-1 font-semibold tabular-nums tracking-tight",
          destaque ? "text-4xl sm:text-6xl" : "text-3xl sm:text-4xl"
        )}
      >
        {valor}
      </p>
      <p className="mt-1.5 text-xs">
        {delta == null ? (
          // ÷0 não vira "∞%" nem se esconde: diz por que não compara
          <span className="text-muted-foreground">
            {deltaVazio ?? "sem comparação (período anterior zerado)"}
          </span>
        ) : (
          <>
            <span className={cn("font-semibold tabular-nums", corDelta)}>
              {seta} {textoDelta(delta)}
            </span>{" "}
            <span className="text-muted-foreground">{deltaRotulo}</span>
          </>
        )}
      </p>
      {nota && <p className="mt-1 text-xs text-muted-foreground">{nota}</p>}
      {spark && (
        <Sparkline
          series={[{ valores: spark, rotulo }]}
          min={0}
          max={Math.max(1, ...spark.map((v) => v ?? 0))}
          eixo={false}
          compacto
          altura={36}
          // slots sem labelsX: a enumeração padrão ("1º: N…") diria pouco —
          // o número e o delta acima já carregam o dado do tile
          ariaLabel={`${rotulo}: evolução no período`}
          className="mt-3"
        />
      )}
    </div>
  );
}
