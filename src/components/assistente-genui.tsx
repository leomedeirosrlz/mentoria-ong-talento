"use client";

// genUI v2 do assistente — os blocos ricos que a bolha renderiza:
//
//   CodeBlock    fence ```lang do markdown-lite: header fino com o
//                rótulo da linguagem + copiar (Copy→Check ~1,6s).
//   GraficoBloco dispatcher dos tipos do ```grafico (spec/parse em
//                lib/ia/render.ts): barras, barras-h, linha, area, rosca
//                e progresso — SVG inline, escala nos próprios dados.
//
// Paleta: tom semântico (--danger/--warn/--ok/--info/--pausa) quando o
// dado carrega `tom`; série única sem tom fica na tinta (foreground) e a
// rosca usa a sequência categórica --chart-N do kit viz/. Cor nunca fica
// sem rótulo: valor em cima da barra, legenda nomeada, "N de M" no
// progresso e <title> por fatia.
//
// Movimento: as classes ia-* do globals.css animam só transform/opacity
// e stroke-dash* (paint). Os keyframes são "from" + fill both, então o
// desenho final é sempre o estilo natural do elemento — reduced-motion
// (o guard global zera a animação) já cai no gráfico pronto. A exceção
// JS é o useCountUp, que checa prefers-reduced-motion e pula pro alvo.

import {
  useEffect,
  useId,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { Check, Copy } from "@phosphor-icons/react";
import { toast } from "sonner";
import type { Grafico, GraficoDado, GraficoTom } from "@/lib/ia/render";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const TOM_FILL: Record<GraficoTom, string> = {
  danger: "var(--danger)",
  warn: "var(--warn)",
  ok: "var(--ok)",
  info: "var(--info)",
  pausa: "var(--pausa)",
};

// série categórica do kit viz/ — fatias sem tom semântico se distinguem
// pela sequência (rosca); série única fica neutra na tinta
const SEQ = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
];

const corUnica = (d: GraficoDado) =>
  d.tom ? TOM_FILL[d.tom] : "var(--foreground)";
const corFatia = (d: GraficoDado, i: number) =>
  d.tom ? TOM_FILL[d.tom] : SEQ[i % SEQ.length];

const fmt = (v: number) =>
  v.toLocaleString("pt-BR", { maximumFractionDigits: 1 });

const trunca = (t: string, max: number) =>
  t.length > max ? `${t.slice(0, max - 1).trimEnd()}…` : t;

/** Resumo textual do gráfico — o role="img" lê o dado inteiro, o status
 *  nunca fica só na cor. */
function resumo(g: Grafico): string {
  if (g.tipo === "progresso" && g.dados.length === 1) {
    const d = g.dados[0];
    const total = g.total && g.total > 0 ? g.total : undefined;
    const pct = Math.min(
      100,
      Math.max(0, total ? (d.valor / total) * 100 : d.valor)
    );
    return `${g.titulo ?? d.rotulo}: ${fmt(d.valor)}${
      total ? ` de ${fmt(total)}` : ""
    } (${Math.round(pct)}%)`;
  }
  const partes = g.dados.map(
    (d) =>
      `${d.rotulo} ${fmt(d.valor)}${d.detalhe ? ` (${d.detalhe})` : ""}`
  );
  return `${g.titulo ?? "Gráfico"}: ${partes.join(", ")}`;
}

/** Count-up de entrada (~480ms) via rAF — roda uma vez por valor-alvo.
 *  Reduced-motion pula direto pro alvo (o guard de CSS não cobre JS);
 *  setState só dentro de rAF, regra react-hooks do projeto. */
function useCountUp(alvo: number, dur = 480): number {
  const [v, setV] = useState(0);
  useEffect(() => {
    let raf = 0;
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
      raf = requestAnimationFrame(() => setV(alvo));
      return () => cancelAnimationFrame(raf);
    }
    const t0 = performance.now();
    const tick = (t: number) => {
      const p = Math.min(1, (t - t0) / dur);
      setV(alvo * (1 - (1 - p) ** 3)); // ease-out cúbico
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [alvo, dur]);
  return v;
}

async function copiarTexto(t: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(t);
    return true;
  } catch {
    // webview/http sem permissão de clipboard: textarea + execCommand
    try {
      const ta = document.createElement("textarea");
      ta.value = t;
      ta.style.cssText = "position:fixed;inset:0 auto auto 0;opacity:0";
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand("copy");
      ta.remove();
      return ok;
    } catch {
      return false;
    }
  }
}

/** Fence ``` do markdown-lite: header fino com a linguagem (ou "código")
 *  e o botão de copiar com feedback. Com o fence ainda aberto no stream
 *  o botão fica desabilitado — habilitar ao fechar é o sinal de que o
 *  bloco terminou de chegar. */
export function CodeBlock({
  codigo,
  linguagem,
  pronto = true,
}: {
  codigo: string;
  linguagem?: string;
  /** false = fence ainda aberto (stream) — copiar fica desabilitado */
  pronto?: boolean;
}) {
  const [copiado, setCopiado] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    []
  );

  async function copiar() {
    const ok = await copiarTexto(codigo);
    if (!ok) {
      toast.error("Não consegui copiar.");
      return;
    }
    setCopiado(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopiado(false), 1600);
  }

  return (
    <div className="overflow-hidden rounded-lg border border-border/70 bg-muted/70">
      <div className="flex items-center justify-between gap-2 border-b border-border/50 py-0.5 pl-2.5 pr-1">
        <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          {linguagem || "código"}
        </span>
        <Button
          type="button"
          variant="ghost"
          size="xs"
          disabled={!pronto}
          onClick={copiar}
          aria-label={copiado ? "Copiado" : "Copiar código"}
          className="text-muted-foreground"
        >
          {copiado ? (
            <Check
              weight="bold"
              aria-hidden
              className="animate-in text-[var(--ok)] zoom-in-50 duration-150"
            />
          ) : (
            <Copy aria-hidden />
          )}
          {copiado ? "Copiado" : "Copiar"}
        </Button>
        {/* anuncia a troca Copy→Check sem depender do label visível */}
        <span aria-live="polite" className="sr-only">
          {copiado ? "Código copiado" : ""}
        </span>
      </div>
      <pre className="scroll-fina max-h-56 overflow-auto px-3 py-2 font-mono text-[0.85em] leading-relaxed">
        <code>{codigo}</code>
      </pre>
    </div>
  );
}

// ---------- gráficos ----------

/** Barras verticais: escala no maior valor, valor em cima da barra e
 *  rótulo embaixo (truncate, o completo fica no <title> do grupo). A
 *  coluna transparente atrás da barra é o alvo de hover — a barra fina
 *  sozinha seria um alvo ruim. */
function Barras({ g }: { g: Grafico }) {
  const W = 300,
    H = 148,
    padX = 8,
    padTopo = 16,
    padBase = 20;
  const n = g.dados.length;
  const max = Math.max(...g.dados.map((d) => d.valor), 0) || 1;
  const yBase = H - padBase;
  const hMax = yBase - padTopo;
  const slot = (W - 2 * padX) / n;
  const bw = Math.min(slot * 0.62, 42);
  const fsValor = n > 7 ? 8.5 : 10;
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="ia-graf block h-auto w-full"
      role="img"
      aria-label={resumo(g)}
    >
      <line
        x1={padX}
        x2={W - padX}
        y1={yBase}
        y2={yBase}
        stroke="var(--border)"
      />
      {g.dados.map((d, i) => {
        const hpx = Math.max(
          (d.valor / max) * hMax,
          d.valor > 0 ? 1.5 : 0 // sliver mínimo — valor pequeno não some
        );
        const cx = padX + slot * i + slot / 2;
        return (
          <g key={i} className="ia-fatia">
            <title>
              {`${d.rotulo}: ${fmt(d.valor)}${
                d.detalhe ? ` — ${d.detalhe}` : ""
              }`}
            </title>
            <rect
              x={padX + slot * i}
              y={2}
              width={slot}
              height={H - 4}
              fill="transparent"
            />
            <rect
              className="ia-barra"
              style={{ "--i": i } as CSSProperties}
              x={cx - bw / 2}
              y={yBase - hpx}
              width={bw}
              height={hpx}
              rx={3}
              fill={corUnica(d)}
            />
            <text
              className="ia-aparece"
              style={{ "--ini": `${160 + i * 55}ms` } as CSSProperties}
              x={cx}
              y={yBase - hpx - 5}
              textAnchor="middle"
              fontSize={fsValor}
              fontWeight={600}
              fill="var(--foreground)"
            >
              {fmt(d.valor)}
            </text>
            <text
              x={cx}
              y={yBase + 13}
              textAnchor="middle"
              fontSize={9}
              fill="var(--muted-foreground)"
            >
              {trunca(d.rotulo, n > 4 ? 8 : 11)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

/** Barras horizontais: rótulo à esquerda, trilho cheio e valor à direita —
 *  a gramática da BarraSegmentada do kit viz/ (linhas HTML, não SVG, pra
 *  truncate e title de graça). Usada no tipo barras-h e quando o modelo
 *  manda barras com >6 categorias. */
function BarrasH({ g }: { g: Grafico }) {
  const max = Math.max(...g.dados.map((d) => d.valor), 0) || 1;
  return (
    <div role="img" aria-label={resumo(g)} className="ia-graf space-y-1.5">
      {g.dados.map((d, i) => (
        <div
          key={i}
          className="ia-fatia flex items-center gap-2"
          title={`${d.rotulo}: ${fmt(d.valor)}${
            d.detalhe ? ` — ${d.detalhe}` : ""
          }`}
        >
          <span className="w-20 shrink-0 truncate text-[11px] text-muted-foreground">
            {d.rotulo}
          </span>
          <span className="h-[18px] min-w-0 flex-1 overflow-hidden rounded-[5px] bg-muted/80">
            <span
              className="ia-barra-h block h-full rounded-[5px]"
              style={
                {
                  width: `${Math.max(
                    (d.valor / max) * 100,
                    d.valor > 0 ? 2 : 0
                  )}%`,
                  backgroundColor: corUnica(d),
                  "--i": i,
                } as CSSProperties
              }
            />
          </span>
          <span
            className="ia-aparece w-9 shrink-0 text-right text-[11px] font-semibold tabular-nums"
            style={{ "--ini": `${160 + i * 55}ms` } as CSSProperties}
          >
            {fmt(d.valor)}
          </span>
        </div>
      ))}
    </div>
  );
}

/** Linha/área: polyline desenhada por dashoffset, dots que "popam" com
 *  stagger depois do traço e (tipo area) um preenchimento em gradiente
 *  que aparece por último. Gridlines discretas marcam topo e meio da
 *  escala — profundidade sem eixo pesado. */
function Linha({ g, area }: { g: Grafico; area: boolean }) {
  const gid = useId().replace(/:/g, ""); // url(#id) não aceita ":" crua
  const W = 300,
    H = 132,
    padX = 16,
    padTopo = 12,
    padBase = 20;
  const dados = g.dados;
  const n = dados.length;
  const max = Math.max(...dados.map((d) => d.valor), 0) || 1;
  const yBase = H - padBase;
  const plotH = yBase - padTopo;
  const x = (i: number) =>
    n === 1 ? W / 2 : padX + (i * (W - 2 * padX)) / (n - 1);
  const y = (v: number) => yBase - (v / max) * plotH;
  const pts = dados.map((d, i) => `${x(i)},${y(d.valor)}`);
  // comprimento real do traço — a animação "desenha" a linha da esquerda
  // pra direita zerando o dashoffset
  let traco = 0;
  for (let i = 1; i < n; i++)
    traco += Math.hypot(
      x(i) - x(i - 1),
      y(dados[i].valor) - y(dados[i - 1].valor)
    );
  const tracoPx = Math.ceil(traco) + 4;
  // série única: a tinta manda; o traço só ganha cor quando TODOS os
  // pontos dividem o mesmo tom (misto → neutro, o ponto de atenção fica
  // no dot que já recebe o tom do próprio dado)
  const cor =
    new Set(dados.map((d) => d.tom)).size === 1
      ? corUnica(dados[0])
      : "var(--foreground)";
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="ia-graf block h-auto w-full"
      role="img"
      aria-label={resumo(g)}
    >
      {[1, 0.5].map((f) => (
        <line
          key={f}
          x1={padX}
          x2={W - padX}
          y1={y(max * f)}
          y2={y(max * f)}
          stroke="var(--border)"
          strokeDasharray="3 4"
          strokeOpacity={0.8}
        />
      ))}
      <line
        x1={padX}
        x2={W - padX}
        y1={yBase}
        y2={yBase}
        stroke="var(--border)"
      />
      {area && n > 1 && (
        <polygon
          className="ia-aparece"
          style={{ "--ini": "420ms" } as CSSProperties}
          points={`${pts.join(" ")} ${x(n - 1)},${yBase} ${x(0)},${yBase}`}
          fill={`url(#${gid})`}
        />
      )}
      {n > 1 && (
        <polyline
          className="ia-traco"
          style={{ "--traco": tracoPx } as CSSProperties}
          strokeDasharray={tracoPx}
          points={pts.join(" ")}
          fill="none"
          stroke={cor}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}
      {dados.map((d, i) => (
        <g key={i} className="ia-fatia">
          <title>
            {`${d.rotulo}: ${fmt(d.valor)}${
              d.detalhe ? ` — ${d.detalhe}` : ""
            }`}
          </title>
          {/* alvo de hover generoso — o dot visível é miúdo */}
          <circle cx={x(i)} cy={y(d.valor)} r={9} fill="transparent" />
          <circle
            className="ia-pop"
            style={{ "--ini": `${380 + i * 70}ms` } as CSSProperties}
            cx={x(i)}
            cy={y(d.valor)}
            r={3}
            fill={corUnica(d)}
            stroke="var(--card)"
            strokeWidth={1.5}
          />
        </g>
      ))}
      {dados.map((d, i) => (
        <text
          key={i}
          x={x(i)}
          y={H - 6}
          textAnchor="middle"
          fontSize={9}
          fill="var(--muted-foreground)"
        >
          {trunca(d.rotulo, n > 6 ? 5 : 10)}
        </text>
      ))}
      {area && n > 1 && (
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={cor} stopOpacity={0.16} />
            <stop offset="100%" stopColor={cor} stopOpacity={0} />
          </linearGradient>
        </defs>
      )}
    </svg>
  );
}

/** Rosca: um <circle> por fatia na técnica dasharray (`seg C`, offset
 *  acumulado) — a varredura é sequencial via --ini (cada fatia espera a
 *  anterior terminar). O centro mostra o total com count-up; a legenda
 *  nomeada ao lado repete cada número em texto. */
function Rosca({ g }: { g: Grafico }) {
  const soma = g.dados.reduce((a, d) => a + d.valor, 0) || 1;
  const total = useCountUp(soma);
  const R = 36,
    C = 2 * Math.PI * R; // circunferência ≈ 226,2
  const inteiro = Number.isInteger(soma);
  // offset/dasharray/atraso de cada fatia — acumulado num loop simples do
  // corpo (a regra react-hooks/immutability barra mutação dentro de map)
  const fatias = (() => {
    const lista: {
      d: GraficoDado;
      cor: string;
      vis: number;
      offset: number;
      ini: number;
    }[] = [];
    let acc = 0,
      ini = 120; // respiro inicial depois da entrada do card
    for (let i = 0; i < g.dados.length; i++) {
      const d = g.dados[i];
      const seg = (d.valor / soma) * C;
      // vão de 1,2px entre fatias — polimento, nunca separação
      const gap = g.dados.length > 1 && seg > 4 ? 1.2 : 0;
      lista.push({
        d,
        cor: corFatia(d, i),
        // fatia zero não desenha (o "0" segue nomeado na legenda)
        vis: seg > 0 ? Math.max(seg - gap, 0.4) : 0,
        offset: -acc + gap / 2,
        ini,
      });
      acc += seg;
      // a fatia i+1 entra quando a i terminou de varrer
      ini += Math.round((seg / C) * 460);
    }
    return lista;
  })();
  return (
    <div className="flex items-center gap-3">
      <svg
        viewBox="0 0 100 100"
        className="ia-graf size-[104px] shrink-0"
        role="img"
        aria-label={resumo(g)}
      >
        <circle
          cx={50}
          cy={50}
          r={R}
          fill="none"
          stroke="var(--muted)"
          strokeWidth={15}
        />
        <g transform="rotate(-90 50 50)">
          {fatias.map((f, i) => (
            <g key={i} className="ia-fatia">
              <title>
                {`${f.d.rotulo}: ${fmt(f.d.valor)}${
                  f.d.detalhe ? ` — ${f.d.detalhe}` : ""
                }`}
              </title>
              <circle
                className="ia-arco"
                style={{ "--ini": `${f.ini}ms` } as CSSProperties}
                cx={50}
                cy={50}
                r={R}
                fill="none"
                stroke={f.cor}
                strokeWidth={15}
                // vão maior que a circunferência = a fatia seguinte do
                // padrão nunca aparece; o keyframe anima só o 1º valor
                strokeDasharray={`${f.vis} ${C}`}
                strokeDashoffset={f.offset}
              />
            </g>
          ))}
        </g>
        <text
          x={50}
          y={47}
          textAnchor="middle"
          dominantBaseline="central"
          fontSize={15}
          fontWeight={700}
          fill="var(--foreground)"
          className="tabular-nums"
        >
          {fmt(inteiro ? Math.round(total) : total)}
        </text>
        <text
          x={50}
          y={59}
          textAnchor="middle"
          fontSize={8.5}
          fill="var(--muted-foreground)"
        >
          total
        </text>
      </svg>
      <ul className="min-w-0 flex-1 space-y-1">
        {g.dados.map((d, i) => (
          <li
            key={i}
            className="animate-enter flex min-w-0 items-center gap-1.5 text-[11px]"
            style={{ "--i": i + 2 } as CSSProperties}
            title={d.detalhe}
          >
            <span
              aria-hidden
              className="size-2 shrink-0 rounded-full"
              style={{ backgroundColor: corFatia(d, i) }}
            />
            <span className="truncate text-muted-foreground">
              {d.rotulo}
            </span>
            <span className="ml-auto shrink-0 font-semibold tabular-nums">
              {fmt(d.valor)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Progresso "n de m": barra única com o % em destaque (count-up) e o
 *  denominador explícito embaixo — a mesma honestidade do kit viz/. Sem
 *  `total` o valor é lido como percentual direto. */
function ProgressoHero({ d, total, titulo }: {
  d: GraficoDado;
  total?: number;
  titulo?: string;
}) {
  const pct = Math.min(
    100,
    Math.max(0, total ? (d.valor / total) * 100 : d.valor)
  );
  const exib = useCountUp(pct);
  return (
    <div role="img" aria-label={resumo({
      tipo: "progresso",
      titulo,
      dados: [d],
      total,
    })}>
      <div className="flex items-baseline justify-between gap-2">
        <span
          className="min-w-0 truncate text-[11px] font-medium text-muted-foreground"
          title={d.rotulo}
        >
          {d.rotulo}
        </span>
        <span className="shrink-0 text-xl font-bold leading-none tabular-nums">
          {Math.round(exib)}%
        </span>
      </div>
      <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-muted">
        <div
          className="fill-grow h-full rounded-full"
          style={{
            width: `${pct}%`,
            backgroundColor: corUnica(d),
          }}
        />
      </div>
      {total || d.detalhe ? (
        <p className="mt-1.5 text-[11px] text-muted-foreground">
          {total ? `${fmt(d.valor)} de ${fmt(total)}` : null}
          {d.detalhe ? `${total ? " — " : ""}${d.detalhe}` : null}
        </p>
      ) : null}
    </div>
  );
}

/** Vários itens de progresso: uma mini-barra por rótulo, todas contra o
 *  mesmo denominador (o `total` do bloco ou o maior valor). */
function Progresso({ g }: { g: Grafico }) {
  if (g.dados.length === 1)
    return (
      <ProgressoHero d={g.dados[0]} total={g.total} titulo={g.titulo} />
    );
  const denom =
    g.total && g.total > 0
      ? g.total
      : Math.max(...g.dados.map((d) => d.valor), 0) || 1;
  return (
    <div role="img" aria-label={resumo(g)} className="space-y-1.5">
      {g.dados.map((d, i) => {
        const pct = Math.min(100, Math.max(0, (d.valor / denom) * 100));
        return (
          <div key={i} className="flex items-center gap-2" title={d.detalhe}>
            <span className="w-20 shrink-0 truncate text-[11px] text-muted-foreground">
              {d.rotulo}
            </span>
            <span className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-muted/80">
              <span
                className="fill-grow block h-full rounded-full"
                style={
                  {
                    width: `${pct}%`,
                    backgroundColor: corUnica(d),
                    "--i": i,
                  } as CSSProperties
                }
              />
            </span>
            <span className="w-14 shrink-0 text-right text-[11px] font-semibold tabular-nums">
              {g.total ? `${fmt(d.valor)}/${fmt(denom)}` : `${Math.round(pct)}%`}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/** Um ```grafico válido: cartão leve dentro da bolha com o título no
 *  padrão "rótulo de grupo". barras com >6 itens cai na horizontal —
 *  legibilidade no estreito. */
export function GraficoBloco({ g }: { g: Grafico }) {
  const corpo =
    g.tipo === "rosca" ? (
      <Rosca g={g} />
    ) : g.tipo === "linha" || g.tipo === "area" ? (
      <Linha g={g} area={g.tipo === "area"} />
    ) : g.tipo === "progresso" ? (
      <Progresso g={g} />
    ) : g.tipo === "barras-h" || g.dados.length > 6 ? (
      <BarrasH g={g} />
    ) : (
      <Barras g={g} />
    );
  return (
    <figure className="animate-enter rounded-xl border border-border/70 bg-card px-3 py-2.5 shadow-[var(--shadow-border)]">
      {g.titulo ? (
        <figcaption className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          {g.titulo}
        </figcaption>
      ) : null}
      <div className={cn(g.titulo && "mt-2")}>{corpo}</div>
    </figure>
  );
}
