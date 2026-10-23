import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Fatia do Donut — uma categoria nomeada do total. */
export type FatiaDonut = {
  /** valor absoluto — o total vem de `total` (ou da soma das fatias) */
  valor: number;
  /** nome na legenda e no aria-label — "em andamento", "pausada" */
  rotulo: string;
  /** cor da fatia — var(--ok), var(--warn), var(--pausa), var(--chart-N)… */
  cor: string;
  /** sufixo discreto no item da legenda ("— agir hoje") — contexto de
   *  ação, não metadado decorativo */
  obs?: ReactNode;
};

/** raio do anel no viewBox 42×42 — com pathLength=100 os dasharray saem
 *  direto em percentual do arco, sem conta de circunferência */
const R = 15.9155;

/** Donut — rosca SVG com o total no centro + legenda arejada (ref:
 *  mockups/registros/v2.html). A rosca responde num relance ("como está o
 *  conjunto?"), a legenda nomeia cada fatia com contagem e % — status
 *  nunca só por cor. Fatias zero não desenham arco mas PERMANECEM na
 *  legenda ("0 com apoio aberto" é informação — quem procura acha).
 *
 *  Sem lib de chart: círculos SVG com pathLength=100, transform rotate
 *  no <g> e overlay HTML pro total — a mesma técnica da roda da vida. */
export function Donut({
  fatias,
  rotuloCentro,
  total,
  legenda = true,
  mostrarPct = true,
  tamanho = 144,
  espessura = 7.5,
  notaLegenda,
  animate = false,
  ariaLabel,
  className,
}: {
  /** fatias em ordem de pintura a partir do topo (sentido horário) */
  fatias: FatiaDonut[];
  /** legenda do número central — "duplas", "respostas" */
  rotuloCentro?: string;
  /** denominador — default: soma das fatias. Só declare quando o total
   *  real for outro (fatias que não cobrem o universo inteiro) */
  total?: number;
  /** legenda nomeada ao lado (dot + nome + "N · P%") — quebra pra baixo
   *  do anel quando a faixa aperta */
  legenda?: boolean;
  /** "N · P%" na legenda; false mostra só a contagem */
  mostrarPct?: boolean;
  /** lado do anel em px (mock: 168 registros, 126 agenda) */
  tamanho?: number;
  /** grossura do traço em unidades do viewBox (42×42) */
  espessura?: number;
  /** nota de rodapé da legenda — ex.: "Semáforo das duplas, não contagem
   *  de registros." (o .obs full-width do mock) */
  notaLegenda?: ReactNode;
  /** entrada animada uma vez (fade+rise) — reduced-motion zera */
  animate?: boolean;
  /** leitura completa pro role="img" — default: "Rosca: N rótulo, … —
   *  T duplas" */
  ariaLabel?: string;
  className?: string;
}) {
  const t = total ?? fatias.reduce((s, f) => s + Math.max(f.valor, 0), 0);
  const validas = fatias.filter((f) => f.valor > 0 && t > 0);
  const pcts = validas.map((f) => (f.valor / t) * 100);
  // offset = soma prefixada dos percentuais anteriores — posição inicial do
  // arco (o primeiro começa em 0); reduzido puro pra não mutar em render
  const offsets = pcts.map((_, i) =>
    pcts.slice(0, i).reduce((s, p) => s + p, 0)
  );
  const arcos = validas.map((f, i) => ({
    ...f,
    pct: pcts[i],
    offset: offsets[i],
  }));
  const rotulo =
    ariaLabel ??
    `Rosca: ${fatias
      .map((f) => `${f.valor} ${f.rotulo}`)
      .join(", ")} — ${t} ${rotuloCentro ?? "no total"}`;

  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-5",
        animate && "animate-enter",
        className
      )}
    >
      <div
        role="img"
        aria-label={rotulo}
        className="relative mx-auto shrink-0"
        style={{ width: tamanho, height: tamanho }}
      >
        <svg viewBox="0 0 42 42" className="h-full w-full" aria-hidden="true">
          <g transform="rotate(-90 21 21)">
            <circle
              cx="21"
              cy="21"
              r={R}
              fill="none"
              stroke="var(--muted)"
              strokeWidth={espessura}
            />
            {arcos.map((f) => (
              <circle
                key={f.rotulo}
                cx="21"
                cy="21"
                r={R}
                fill="none"
                stroke={f.cor}
                strokeWidth={espessura}
                pathLength={100}
                strokeDasharray={`${f.pct} ${100 - f.pct}`}
                strokeDashoffset={-f.offset}
                // update de dados interpola o arco (refresh/filtro) em vez
                // de repaint seco — reduced-motion zera pelo guard global
                className="transition-[stroke-dashoffset,stroke-dasharray] duration-500 ease-snappy"
              />
            ))}
          </g>
        </svg>
        <span className="absolute inset-0 flex flex-col items-center justify-center text-center">
          <b className="font-mono text-3xl font-semibold leading-none tabular-nums">
            {t}
          </b>
          {rotuloCentro && (
            <small className="mt-1 text-[11px] font-medium text-muted-foreground">
              {rotuloCentro}
            </small>
          )}
        </span>
      </div>
      {legenda && (
        <ul className="grid min-w-[170px] flex-1 gap-2 text-[13px]">
          {fatias.map((f) => (
            <li key={f.rotulo} className="flex items-baseline gap-2">
              <span
                aria-hidden
                className="size-2.5 shrink-0 self-center rounded-[3px]"
                style={{ backgroundColor: f.cor }}
              />
              <b className="font-semibold">{f.rotulo}</b>
              {f.obs != null && (
                <span className="text-muted-foreground">{f.obs}</span>
              )}
              <span className="ml-auto pl-2 tabular-nums text-muted-foreground">
                {f.valor}
                {mostrarPct &&
                  t > 0 &&
                  ` · ${Math.round((f.valor / t) * 100)}%`}
              </span>
            </li>
          ))}
          {notaLegenda != null && (
            <li className="text-[11px] leading-relaxed text-muted-foreground">
              {notaLegenda}
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
