import { cn } from "@/lib/utils";

/** Série da Sparkline — uma linha fina por turma/recorte. */
export type SerieSpark = {
  /** um valor por slot do eixo X; `null` = buraco (o encontro ainda não
   *  aconteceu / não tem dado — a linha quebra e retoma, nunca liga o
   *  buraco com um traço mentiroso) */
  valores: (number | null)[];
  /** nome da série pra legenda/aria — "T1 · terças" */
  rotulo: string;
  /** cor do traço e dos dots — CSS color (var(--chart-N), var(--ok)…).
   *  Default: var(--chart-1)…var(--chart-5) pelo índice da série. */
  cor?: string;
};

/** paleta categórica default por índice de série — os mesmos --chart-N dos
 *  tokens (chart-1×chart-2 = gramática T1×T2 dos mocks aprovados) */
const CORES_SERIE = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
];

/** respiro vertical do plot (%) — o traço nunca encosta nas bordas; as
 *  gridlines do eixo caem nos mesmos pontos */
const PAD_Y = 8;
/** largura da gutter esquerda quando o eixo está visível (px) — os rótulos
 *  de escala ("5", "1") moram fora da área do traço */
const GUTTER = 26;

/** ticks "bonitos" do eixo: ≤5 marcas em passos inteiros entre min e max.
 *  Na escala 1–5 sai [5,4,3,2,1]; ranges maiores pulam de 2 em 2 etc. */
function ticksEixo(min: number, max: number): number[] {
  const span = max - min;
  if (span <= 0) return [max];
  const passo = Math.max(1, Math.ceil(span / 4));
  const ticks: number[] = [];
  for (let v = max; v >= min; v -= passo) ticks.push(v);
  if (ticks[ticks.length - 1] !== min) ticks.push(min);
  return ticks;
}

/** quebra a série em trechos contíguos sem null — cada trecho vira um
 *  polyline próprio (trecho de 1 ponto desenha só o dot) */
function trechos(valores: (number | null)[]): { de: number; ate: number }[] {
  const lista: { de: number; ate: number }[] = [];
  let de = -1;
  for (let i = 0; i <= valores.length; i++) {
    if (i < valores.length && valores[i] != null) {
      if (de < 0) de = i;
    } else if (de >= 0) {
      lista.push({ de, ate: i - 1 });
      de = -1;
    }
  }
  return lista;
}

/** Sparkline — a "linha tamanho-palavra" do kit: traço fino + dots, sem
 *  rótulo em todo ponto (só nos pontos-chave: o último de cada série e os
 *  pontos de atenção abaixo de `atencaoAbaixoDe`). A escala é
 *  parametrizável (1–5 das estrelas do jovem, 0–100, etc.) e declarada —
 *  toda medida responde "comparado a quê?" (Few/Tufte).
 *
 *  Renderização: polyline SVG em viewBox 100×100 preserveAspectRatio=none
 *  (largura fluida) + dots como spans posicionados (labels HTML de graça,
 *  circulo nítido sem distorção de aspecto). Pontos `null` viram buracos —
 *  encontro que ainda não aconteceu não entra na série nem liga a linha.
 *
 *  Acessível: role="img" com a série inteira no aria-label (valores
 *  formatados, incluindo "sem dado" nos buracos); os pontos de atenção são
 *  nomeados no texto, não só pintados de âmbar. */
export function Sparkline({
  series,
  min = 1,
  max = 5,
  labelsX,
  atencaoAbaixoDe,
  area = false,
  eixo = true,
  altura = 120,
  formatarValor = (v) =>
    v.toLocaleString("pt-BR", { maximumFractionDigits: 1 }),
  ariaLabel,
  animate = false,
  className,
}: {
  /** 1..N séries no mesmo eixo — cada uma com sua cor (default --chart-N) */
  series: SerieSpark[];
  /** piso e teto da escala — default 1–5 (a régua das estrelas do jovem) */
  min?: number;
  max?: number;
  /** rótulos dos slots do eixo X ("1º", "2º"…) — 1:1 com os valores */
  labelsX?: string[];
  /** ponto abaixo deste valor vira "ponto de atenção": dot âmbar com label
   *  embaixo (a gramática do 3,6 no mock registros v2) */
  atencaoAbaixoDe?: number;
  /** área sutil sob o traço (mesma cor a ~7% — volume, não preenchimento) */
  area?: boolean;
  /** gridlines tracejadas + rótulos de escala na gutter esquerda */
  eixo?: boolean;
  /** altura do plot em px */
  altura?: number;
  /** formatador dos valores (default pt-BR, ≤1 casa — "4,2") */
  formatarValor?: (v: number) => string;
  /** leitura completa pro role="img" — default: série por série com todos
   *  os pontos + os pontos de atenção nomeados */
  ariaLabel?: string;
  /** entrada animada uma vez (fade+rise) — reduced-motion zera */
  animate?: boolean;
  className?: string;
}) {
  const n = Math.max(
    ...series.map((s) => s.valores.length),
    labelsX?.length ?? 0,
    1
  );
  const span = max - min || 1;
  // y do valor no plot (0–100 do viewBox/da caixa, com respiro PAD_Y):
  // v=max → topo (PAD_Y), v=min → base (100-PAD_Y); fora da escala, clampa
  const y = (v: number) =>
    PAD_Y +
    (1 - (Math.min(Math.max(v, min), max) - min) / span) * (100 - 2 * PAD_Y);
  const x = (i: number) => ((i + 0.5) / n) * 100;
  const base = 100 - PAD_Y;
  const ticks = eixo ? ticksEixo(min, max) : [];
  const nomeSlot = (i: number) => labelsX?.[i] ?? `${i + 1}º`;

  // pontos-chave: último válido da série (label acima) e abaixo da régua
  // de atenção (dot âmbar + label embaixo — nunca só a cor mudando)
  const atencios: { serie: string; slot: string; v: number }[] = [];
  const descricao = series
    .map((s) => {
      const pontos = s.valores
        .map((v, i) =>
          v == null
            ? `${nomeSlot(i)}: sem dado`
            : `${nomeSlot(i)}: ${formatarValor(v)}`
        )
        .join(", ");
      s.valores.forEach((v, i) => {
        if (v != null && atencaoAbaixoDe != null && v < atencaoAbaixoDe)
          atencios.push({ serie: s.rotulo, slot: nomeSlot(i), v });
      });
      return `${s.rotulo} — ${pontos}`;
    })
    .join(". ");
  const rotulo =
    ariaLabel ??
    `Linha ${descricao}${
      atencios.length
        ? `. Atenção: ${atencios
            .map((a) => `${formatarValor(a.v)} em ${a.slot} (${a.serie})`)
            .join(", ")}`
        : ""
    }`;

  return (
    <div className={cn(animate && "animate-enter", className)}>
      <div
        role="img"
        aria-label={rotulo}
        className="relative"
        style={{ height: altura }}
      >
        {/* área do plot: tudo dentro dela é posicionado em % — gridlines,
            traço e dots dividem a mesma régua */}
        <div
          className="absolute inset-y-0 right-0"
          style={{ left: eixo ? GUTTER : 0 }}
        >
          {ticks.map((t) => (
            <span
              key={t}
              aria-hidden
              className="absolute inset-x-0 border-t border-dashed border-border"
              style={{ top: `${y(t)}%` }}
            />
          ))}
          <svg
            className="absolute inset-0 h-full w-full overflow-visible"
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            {series.map((s, si) => {
              const cor = s.cor ?? CORES_SERIE[si % CORES_SERIE.length];
              return trechos(s.valores).flatMap(({ de, ate }) => {
                const pts = s.valores
                  .slice(de, ate + 1)
                  .map((v, i) => `${x(de + i)},${y(v ?? min)}`)
                  .join(" ");
                return [
                  area && (
                    <polygon
                      key={`a-${si}-${de}`}
                      points={`${pts} ${x(ate)},${base} ${x(de)},${base}`}
                      fill={cor}
                      fillOpacity={0.07}
                    />
                  ),
                  ate > de && (
                    <polyline
                      key={`l-${si}-${de}`}
                      points={pts}
                      fill="none"
                      stroke={cor}
                      strokeWidth={2}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      vectorEffect="non-scaling-stroke"
                    />
                  ),
                ];
              });
            })}
          </svg>
          {/* dots HTML — circulo nítido + label onde o SVG distorceria;
              transition-[left,top] interpola mudanças de dado */}
          {series.map((s, si) => {
            const cor = s.cor ?? CORES_SERIE[si % CORES_SERIE.length];
            let ultimo = -1;
            for (let i = s.valores.length - 1; i >= 0; i--)
              if (s.valores[i] != null) {
                ultimo = i;
                break;
              }
            return s.valores.map((v, i) => {
              if (v == null) return null;
              const baixo = atencaoAbaixoDe != null && v < atencaoAbaixoDe;
              const chave = i === ultimo;
              const marcado = baixo || chave;
              const corDot = baixo ? "var(--warn)" : cor;
              return (
                <span
                  key={`${si}-${i}`}
                  aria-hidden="true"
                  title={`${nomeSlot(i)} · ${s.rotulo}: ${formatarValor(v)}`}
                  className={cn(
                    "absolute -translate-x-1/2 -translate-y-1/2 rounded-full transition-[left,top] duration-300 ease-snappy",
                    marcado ? "size-[11px] border-[2.5px] border-card" : "size-[7px]"
                  )}
                  style={{
                    left: `${x(i)}%`,
                    top: `${y(v)}%`,
                    backgroundColor: corDot,
                    boxShadow: marcado
                      ? `0 0 0 1.5px ${corDot}`
                      : undefined,
                  }}
                >
                  {marcado && (
                    <em
                      className={cn(
                        "absolute left-1/2 -translate-x-1/2 whitespace-nowrap text-[10px] font-extrabold not-italic",
                        // label em cima no último ponto; embaixo nos pontos
                        // de atenção (e quando os dois colidem — o alerta
                        // tem prioridade de posição)
                        baixo ? "top-3.5" : "bottom-3.5"
                      )}
                      style={{
                        color: baixo ? "var(--warn-text)" : "var(--foreground)",
                      }}
                    >
                      {formatarValor(v)}
                    </em>
                  )}
                </span>
              );
            });
          })}
        </div>
        {/* rótulos da escala na gutter — fora do trilho, alinhados às
            gridlines pelo mesmo y() */}
        {ticks.map((t) => (
          <span
            key={t}
            aria-hidden="true"
            className="absolute left-0 -translate-y-1/2 text-[9.5px] font-semibold tabular-nums text-muted-foreground"
            style={{ top: `${y(t)}%` }}
          >
            {formatarValor(t)}
          </span>
        ))}
      </div>
      {labelsX && (
        <div
          aria-hidden="true"
          className="mt-2 flex"
          style={{ paddingLeft: eixo ? GUTTER : 0 }}
        >
          {Array.from({ length: n }, (_, i) => (
            <span
              key={i}
              className="min-w-0 flex-1 truncate text-center text-[10px] font-medium text-muted-foreground"
            >
              {labelsX[i] ?? ""}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
