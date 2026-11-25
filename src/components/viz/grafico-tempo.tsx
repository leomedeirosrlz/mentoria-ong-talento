"use client";

import { useId, useState, type KeyboardEvent, type PointerEvent } from "react";
import { cn } from "@/lib/utils";

/** Um slot do eixo do tempo. O servidor manda os textos prontos (a página
 *  é server component e não passa formatador): `rotulo` é o nome longo do
 *  slot ("ter, 04/11" ou "27/10 a 02/11"), `valorFmt` a leitura com
 *  unidade ("14 requisições", "sem requisições"). */
export type PontoGrafico = {
  chave: string;
  /** rótulo curto do eixo X ("04/11") */
  rotuloEixo: string;
  rotulo: string;
  /** null = sem dado (buraco honesto: a linha quebra, a barra não sobe) */
  valor: number | null;
  valorFmt: string;
  /** leitura sem arredondamento de exibição ("US$ 0,0042" onde
   *  `valorFmt` diz "< US$ 0,01"): vai na tabela; ausente = `valorFmt` */
  valorExato?: string;
};

export type FormatoEixo = "inteiro" | "decimal" | "tokens" | "usd";

const ALTURA_PLOT = 150;

const FMT: Record<FormatoEixo, Intl.NumberFormat> = {
  inteiro: new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 }),
  decimal: new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 }),
  tokens: new Intl.NumberFormat("pt-BR", { notation: "compact", maximumFractionDigits: 1 }),
  usd: new Intl.NumberFormat("pt-BR", { maximumSignificantDigits: 2 }),
};

/** Teto "bonito" da escala e o passo: 1, 2, 2,5 ou 5 × 10^k, ~4 faixas.
 *  Inteiros nunca ganham passo fracionário (meia requisição não existe). */
function escala(max: number, inteiro: boolean): { teto: number; passo: number } {
  if (max <= 0) return { teto: 1, passo: 1 };
  const bruto = max / 4;
  const mag = 10 ** Math.floor(Math.log10(bruto));
  const passo0 = [1, 2, 2.5, 5, 10].map((f) => f * mag).find((p) => p >= bruto) ?? 10 * mag;
  const passo = inteiro ? Math.max(1, Math.ceil(passo0)) : passo0;
  return { teto: Math.ceil(max / passo - 1e-9) * passo, passo };
}

/** Gráfico de série temporal da casa (barras ou linha) com eixo, grade,
 *  linha de média e pico marcado com rótulo. Leitura de um ponto por
 *  hover, toque (arrastar percorre os dias) ou teclado (setas, Home,
 *  End): a faixa inteira do plot é o alvo, então o toque nunca depende
 *  de acertar uma barra de 8px. O valor lido aparece na linha de leitura
 *  acima do plot (aria-live), não em tooltip. A tabela em <details>
 *  entrega o mesmo dado pra quem não usa o gráfico. */
export function GraficoTempo({
  pontos,
  tipo = "barras",
  formato,
  media,
  pico,
  cor = "var(--chart-2)",
  ariaLabel,
  rotuloTempo,
  rotuloValor,
  className,
}: {
  pontos: PontoGrafico[];
  tipo?: "barras" | "linha";
  /** formatação dos rótulos da escala */
  formato: FormatoEixo;
  /** média do período: linha tracejada (o valor fica no cabeçalho do
   *  card, aqui só o rótulo "média" pra não cobrir os pontos recentes) */
  media: number | null;
  /** índice do pico (recebe rótulo); null = sem pico */
  pico: number | null;
  cor?: string;
  /** resumo completo pro leitor de tela (média, pico, período) */
  ariaLabel: string;
  /** cabeçalhos da tabela: "Dia"/"Semana" e o nome do valor */
  rotuloTempo: string;
  rotuloValor: string;
  className?: string;
}) {
  const id = useId();
  const [sel, setSel] = useState<number | null>(null);
  const n = pontos.length;
  const valores = pontos.map((p) => p.valor ?? 0);
  const { teto, passo } = escala(Math.max(0, ...valores, media ?? 0), formato === "inteiro");
  const ticks: number[] = [];
  for (let v = 0; v <= teto + passo / 2; v += passo) ticks.push(v);
  const fmt = FMT[formato];
  // gutter cabe o maior rótulo da escala (~6px por caractere a 10px)
  const gutter = Math.max(...ticks.map((t) => fmt.format(t).length)) * 6 + 8;
  const y = (v: number) => (1 - v / teto) * 100; // % do topo
  const x = (i: number) => ((i + 0.5) / n) * 100;

  // até 5 rótulos no eixo X contados do último (hoje) pra trás; o
  // primeiro só entra se couber sem encostar no vizinho
  const passoX = Math.max(1, Math.ceil(n / 5));
  const comRotulo = new Set<number>();
  for (let i = n - 1; i >= 0; i -= passoX) comRotulo.add(i);
  if (n > 0 && !comRotulo.has(0) && Math.min(...comRotulo) >= passoX) comRotulo.add(0);

  const indiceDoPonteiro = (e: PointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    return Math.min(n - 1, Math.max(0, Math.floor(((e.clientX - r.left) / r.width) * n)));
  };
  const teclar = (e: KeyboardEvent<HTMLDivElement>) => {
    const atual = sel ?? pico ?? n - 1;
    const prox =
      e.key === "ArrowRight" ? Math.min(n - 1, atual + 1)
      : e.key === "ArrowLeft" ? Math.max(0, atual - 1)
      : e.key === "Home" ? 0
      : e.key === "End" ? n - 1
      : e.key === "Escape" ? null
      : undefined;
    if (prox === undefined) return;
    e.preventDefault();
    setSel(prox);
  };

  const lido = sel ?? pico;
  const leitura =
    lido != null && pontos[lido]
      ? `${sel == null ? "Pico: " : ""}${pontos[lido].rotulo}, ${pontos[lido].valorFmt}`
      : "Toque ou passe o mouse para ler um dia";

  // trechos contíguos com dado (linha): null quebra o traço
  const trechos: number[][] = [];
  if (tipo === "linha") {
    let atual: number[] = [];
    pontos.forEach((p, i) => {
      if (p.valor == null) {
        if (atual.length) trechos.push(atual);
        atual = [];
      } else atual.push(i);
    });
    if (atual.length) trechos.push(atual);
  }

  return (
    <div className={className}>
      <p
        id={`${id}-leitura`}
        aria-live="polite"
        className="line-clamp-2 min-h-8 text-xs text-muted-foreground"
      >
        {lido != null && pontos[lido] ? (
          <>
            {sel == null && "Pico: "}
            {pontos[lido].rotulo},{" "}
            <span className="font-semibold text-foreground">{pontos[lido].valorFmt}</span>
          </>
        ) : (
          leitura
        )}
      </p>
      <div className="relative mt-5" style={{ height: ALTURA_PLOT, paddingLeft: gutter }}>
        {/* escala na gutter, alinhada às linhas de grade pelo mesmo y() */}
        {ticks.map((t) => (
          <span
            key={t}
            aria-hidden
            className="absolute left-0 -translate-y-1/2 text-[10px] font-medium tabular-nums text-muted-foreground"
            style={{ top: `${y(t)}%` }}
          >
            {fmt.format(t)}
          </span>
        ))}
        <div className="relative h-full">
          {ticks.map((t) => (
            <span
              key={t}
              aria-hidden
              className={cn(
                "absolute inset-x-0 border-t",
                t === 0 ? "border-border" : "border-dashed border-border/70"
              )}
              style={{ top: `${y(t)}%` }}
            />
          ))}

          {sel != null && (
            <span
              aria-hidden
              className="absolute inset-y-0 rounded-sm bg-muted"
              style={{ left: `${(sel / n) * 100}%`, width: `${100 / n}%` }}
            />
          )}

          {tipo === "barras" ? (
            <div aria-hidden className="absolute inset-0 flex items-end">
              {pontos.map((p, i) => (
                <div key={p.chave} className="flex h-full min-w-0 flex-1 items-end justify-center">
                  <span
                    className="block w-[72%] max-w-7 rounded-t-[3px] transition-[height,opacity] duration-300 ease-snappy"
                    style={{
                      height: p.valor ? `${Math.max(1.5, 100 - y(p.valor))}%` : 0,
                      backgroundColor: cor,
                      opacity: i === pico || i === sel ? 1 : 0.62,
                    }}
                  />
                </div>
              ))}
            </div>
          ) : (
            <>
              <svg
                aria-hidden
                className="absolute inset-0 h-full w-full overflow-visible"
                viewBox="0 0 100 100"
                preserveAspectRatio="none"
              >
                {trechos.map((t) =>
                  t.length > 1 ? (
                    <polyline
                      key={t[0]}
                      points={t.map((i) => `${x(i)},${y(pontos[i].valor!)}`).join(" ")}
                      fill="none"
                      stroke={cor}
                      strokeWidth={2}
                      strokeLinejoin="round"
                      strokeLinecap="round"
                      vectorEffect="non-scaling-stroke"
                    />
                  ) : null
                )}
              </svg>
              {pontos.map((p, i) =>
                p.valor == null ? null : (
                  <span
                    key={p.chave}
                    aria-hidden
                    className={cn(
                      "absolute -translate-x-1/2 -translate-y-1/2 rounded-full",
                      i === pico || i === sel
                        ? "size-[11px] border-[2.5px] border-card"
                        : n > 40 ? "size-1" : "size-[7px]"
                    )}
                    style={{
                      left: `${x(i)}%`,
                      top: `${y(p.valor)}%`,
                      backgroundColor: cor,
                      boxShadow: i === pico || i === sel ? `0 0 0 1.5px ${cor}` : undefined,
                    }}
                  />
                )
              )}
            </>
          )}

          {media != null && media > 0 && (
            <span
              aria-hidden
              className="absolute inset-x-0 border-t-[1.5px] border-dashed border-foreground/55"
              style={{ top: `${y(media)}%` }}
            >
              <span className="absolute right-0 -translate-y-full rounded-sm bg-card/90 px-1 text-[10px] font-semibold text-foreground">
                média
              </span>
            </span>
          )}

          {pico != null && pontos[pico]?.valor != null && (
            <span
              aria-hidden
              className={cn(
                "absolute -translate-y-full whitespace-nowrap pb-1.5 text-[10px] font-bold tabular-nums text-foreground",
                // perto das bordas o rótulo ancora pro lado de dentro
                x(pico) < 15 ? "" : x(pico) > 85 ? "-translate-x-full" : "-translate-x-1/2"
              )}
              style={{ left: `${x(pico)}%`, top: `${y(pontos[pico].valor!)}%` }}
            >
              pico {fmt.format(pontos[pico].valor!)}
            </span>
          )}

          {/* alvo de leitura: a faixa inteira do plot. pan-y deixa a página
              rolar na vertical; arrastar na horizontal percorre os dias */}
          <div
            role="img"
            tabIndex={0}
            aria-label={ariaLabel}
            aria-describedby={`${id}-leitura`}
            className="absolute inset-0 cursor-crosshair touch-pan-y rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card"
            onPointerMove={(e) => setSel(indiceDoPonteiro(e))}
            onPointerDown={(e) => setSel(indiceDoPonteiro(e))}
            onPointerLeave={(e) => {
              if (e.pointerType === "mouse") setSel(null);
            }}
            onKeyDown={teclar}
            onBlur={() => setSel(null)}
          />
        </div>
      </div>
      <div aria-hidden className="relative mt-1.5 h-4" style={{ marginLeft: gutter }}>
        {[...comRotulo].map((i) => (
          <span
            key={i}
            className={cn(
              "absolute whitespace-nowrap text-[10px] font-medium tabular-nums text-muted-foreground",
              i === 0 && n > 1 ? "" : i === n - 1 && n > 1 ? "-translate-x-full" : "-translate-x-1/2"
            )}
            style={{ left: i === 0 && n > 1 ? 0 : i === n - 1 && n > 1 ? "100%" : `${x(i)}%` }}
          >
            {pontos[i].rotuloEixo}
          </span>
        ))}
      </div>
      <details className="mt-2 text-xs text-muted-foreground">
        <summary className="inline-flex min-h-11 cursor-pointer items-center font-semibold text-foreground underline-offset-4 hover:underline sm:min-h-8">
          ver dados em tabela
        </summary>
        <div
          role="region"
          aria-label={`${rotuloValor} em tabela`}
          tabIndex={0}
          className="scroll-fina mt-2 max-h-72 overflow-y-auto focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <table className="w-full text-left tabular-nums">
            <thead>
              <tr className="text-muted-foreground">
                <th scope="col" className="py-1 pr-3 font-medium">{rotuloTempo}</th>
                <th scope="col" className="py-1 text-right font-medium">{rotuloValor}</th>
              </tr>
            </thead>
            <tbody>
              {pontos.map((p, i) => (
                <tr key={p.chave} className="border-t border-border/50">
                  <td className="py-1 pr-3">
                    {p.rotulo}
                    {i === pico && <span className="ml-1.5 font-semibold text-foreground">(pico)</span>}
                  </td>
                  <td className="py-1 text-right font-medium text-foreground">{p.valorExato ?? p.valorFmt}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}
