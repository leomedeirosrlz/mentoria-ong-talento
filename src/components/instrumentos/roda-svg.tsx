import {
  lePonteiro,
  pontoEixo,
  pontosPoligono,
  quebraRotuloEixo,
  rotuloQuadrante,
  RODA_CX,
  RODA_CY,
  RODA_RAIO,
  RODA_ROTULO_GAP,
} from "@/lib/forms/instrumentos";
import type { RodaDaVida } from "@/lib/forms/schema";
import { cn } from "@/lib/utils";

// Desenho da Roda da Vida — o mesmo SVG pra leitura (ficha da dupla, tela
// de sucesso) e pro preenchimento (arrastar os eixos no /f/<token>). Sem
// hooks nem estado: com `onMudanca` o ponteiro move eixos; sem ele é
// imagem estática — por isso o arquivo não leva "use client" e pode ser
// renderizado por server component.
//
// Duas molduras: a compacta (viewBox 0 0 320 320, números 1–16 + nome de
// quadrante no aro) e a rotulada (`rotuloEixos`, viewBox expandido — a
// coroa com o nome das áreas substitui os números; variante A decidida
// em docs/planos/issues/_decisoes.md, REALIZA-143). O chamador monta a
// responsividade com CSS: um render `lg:hidden` (compacta) + um
// `hidden lg:block` (rotulada) — só o visível entra na árvore de a11y.

const ANEIS = [2, 4, 6, 8, 10];

/** Moldura da roda compacta (a original) × rotulada: a geometria interna
 *  é sempre 0–320 centrada em (160,160); a rotulada só acrescenta margem
 *  pra coroa de texto — "Independência" à direita é o label mais largo
 *  (~80px de tinta a partir de x≈284) e fica dentro de x≤368. */
const VB_COMPACTA = { x: 0, y: 0, w: 320, h: 320 };
const VB_ROTULADA = { x: -48, y: -10, w: 416, h: 330 };

/** Entrelinha dos rótulos externos (font-size 10px em unidades do viewBox). */
const ROTULO_LH = 11.5;

export function RodaSvg({
  roda,
  ativo = null,
  onMudanca,
  onFim,
  rotuloEixos = false,
  className,
}: {
  roda: RodaDaVida;
  /** índice do eixo em edição — ganha o destaque lime */
  ativo?: number | null;
  /** presente = roda interativa: o arraste converte ângulo→eixo, raio→nota */
  onMudanca?: (indice: number, nota: number) => void;
  /** fim do gesto (pointerup/cancel) — o caller decide avançar de eixo */
  onFim?: () => void;
  /** desktop: os nomes das áreas coroam a roda no lugar dos números —
   *  viewBox maior; usar num render separado `hidden lg:block` */
  rotuloEixos?: boolean;
  className?: string;
}) {
  const areas = roda.quadrantes.flatMap((q) => q.areas);
  const total = areas.length;
  if (!total) return null;

  const vb = rotuloEixos ? VB_ROTULADA : VB_COMPACTA;
  const dados = pontosPoligono(
    total,
    areas.map((a) => (a.nota ?? 0) / 10)
  );

  // nome do quadrante no meio do arco dele (fora do aro) — o índice de
  // início avança sobre TODOS os quadrantes, com nome ou sem. Só no modo
  // compacto: na coroa rotulada os nomes de área ocupam essa faixa.
  let ini = 0;
  const rotulos: { nome: string; x: number; y: number }[] = [];
  if (!rotuloEixos)
    for (const q of roda.quadrantes) {
      if (q.nome)
        rotulos.push({
          nome: q.nome,
          ...rotuloQuadrante(ini, q.areas.length, total, 16),
        });
      ini += q.areas.length;
    }

  function aplicaPonteiro(e: React.PointerEvent<SVGSVGElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = vb.x + ((e.clientX - rect.left) / rect.width) * vb.w;
    const y = vb.y + ((e.clientY - rect.top) / rect.height) * vb.h;
    const alvo = lePonteiro(x, y, total);
    onMudanca?.(alvo.indice, alvo.nota);
  }

  const interativo = Boolean(onMudanca);

  return (
    <svg
      viewBox={`${vb.x} ${vb.y} ${vb.w} ${vb.h}`}
      {...(interativo
        ? {
            // a lista de eixos (role=slider) carrega a acessibilidade —
            // a roda é o gesto, não o controle
            "aria-hidden": true,
          }
        : {
            role: "img",
            "aria-label": `Roda da Vida: média ${roda.media?.toLocaleString("pt-BR") ?? "sem notas"} em ${total} áreas`,
          })}
      onPointerDown={
        interativo
          ? (e) => {
              e.currentTarget.setPointerCapture(e.pointerId);
              aplicaPonteiro(e);
            }
          : undefined
      }
      // e.buttons&1 cobre o arrasto sem estado: pointer capture segura o
      // gesto mesmo quando o dedo sai do quadrado do svg
      onPointerMove={
        interativo
          ? (e) => {
              if (e.buttons & 1) aplicaPonteiro(e);
            }
          : undefined
      }
      onPointerUp={interativo ? () => onFim?.() : undefined}
      onPointerCancel={interativo ? () => onFim?.() : undefined}
      className={cn(
        "mx-auto w-full max-w-[300px] shrink-0 select-none sm:max-w-[320px]",
        interativo && "cursor-crosshair touch-none",
        className
      )}
    >
      <g className="roda-entra">
        {ANEIS.map((nivel) => (
          <polygon
            key={nivel}
            points={pontosPoligono(total, areas.map(() => nivel / 10))}
            fill="none"
            className="stroke-border"
            strokeWidth={nivel === 10 ? 1.4 : 0.7}
          />
        ))}
        {areas.map((a, i) => {
          const p = pontoEixo(i, total, 1);
          return (
            <line
              key={a.id}
              x1={RODA_CX}
              y1={RODA_CY}
              x2={p.x}
              y2={p.y}
              strokeWidth={i === ativo ? 1.8 : 0.7}
              className={
                i === ativo ? "stroke-[var(--ok-text)]" : "stroke-border"
              }
            />
          );
        })}
        <polygon
          points={dados}
          className="fill-[var(--brand-lime)]/25 stroke-[var(--ok-text)] transition-all duration-150"
          strokeWidth={1.8}
          strokeLinejoin="round"
        />
        {areas.map((a, i) => {
          const p = pontoEixo(i, total, (a.nota ?? 0) / 10);
          const ehAtivo = i === ativo;
          return (
            <circle
              key={a.id}
              cx={p.x}
              cy={p.y}
              r={ehAtivo ? 6 : 3}
              className={cn(
                "roda-ponto",
                ehAtivo
                  ? "fill-[var(--brand-lime)] stroke-[var(--brand-ink)]"
                  : a.nota == null
                    ? "fill-muted-foreground/50"
                    : "fill-[var(--ok-text)]"
              )}
              strokeWidth={ehAtivo ? 1.2 : 0}
            />
          );
        })}
        {rotuloEixos ? (
          /* a coroa do desktop (variante A): nome da área fora do aro,
             âncora por hemisfério, até 2 linhas crescendo pra fora do
             raio-âncora, nota atual fechando a última linha. Decorativo:
             a lista de sliders carrega o nome acessível. */
          <g aria-hidden>
            {areas.map((a, i) => {
              const ang = -Math.PI / 2 + (i * 2 * Math.PI) / total;
              const cos = Math.cos(ang);
              const sin = Math.sin(ang);
              const p = pontoEixo(
                i,
                total,
                (RODA_RAIO + RODA_ROTULO_GAP) / RODA_RAIO
              );
              const linhas = quebraRotuloEixo(a.label);
              const anchor =
                cos > 0.3 ? "start" : cos < -0.3 ? "end" : "middle";
              // o bloco cresce pra fora: a aresta interna fica no
              // raio-âncora (o centro sobe/desce meia altura de bloco no
              // eixo do seno — técnica do mock instrumentos/v1)
              const meio = p.y + (sin * linhas.length * ROTULO_LH) / 2;
              const y0 = meio - ((linhas.length - 1) * ROTULO_LH) / 2;
              const ehAtivo = i === ativo;
              return (
                <text
                  key={`r-${a.id}`}
                  textAnchor={anchor}
                  className={cn(
                    "text-[10px]",
                    ehAtivo
                      ? "fill-foreground font-bold"
                      : "fill-muted-foreground font-medium"
                  )}
                >
                  {linhas.map((l, j) => (
                    <tspan
                      key={j}
                      x={p.x}
                      y={y0 + j * ROTULO_LH}
                      dominantBaseline="middle"
                    >
                      {l}
                      {j === linhas.length - 1 && a.nota != null && (
                        /* NBSP: espaço simples no início do tspan é
                           stripado pelo processamento XML e a nota
                           colaria no rótulo */
                        <tspan className="fill-[var(--ok-text)] font-bold">
                          {"\u00A0"}
                          {a.nota}
                        </tspan>
                      )}
                    </tspan>
                  ))}
                </text>
              );
            })}
          </g>
        ) : (
          <>
            {/* número do eixo na ponta — a ponte roda ↔ lista de áreas (o
                mesmo número nas duas) */}
            {areas.map((a, i) => {
              const p = pontoEixo(i, total, 1.09);
              return (
                <text
                  key={`n-${a.id}`}
                  x={p.x}
                  y={p.y}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  className={cn(
                    "text-[8px] font-semibold tabular-nums",
                    i === ativo ? "fill-foreground" : "fill-muted-foreground"
                  )}
                >
                  {i + 1}
                </text>
              );
            })}
            {rotulos.map((q) => (
              <text
                key={q.nome}
                x={q.x}
                y={q.y}
                textAnchor="middle"
                dominantBaseline="middle"
                className="fill-muted-foreground text-[10px] font-medium"
              >
                {q.nome}
              </text>
            ))}
          </>
        )}
      </g>
    </svg>
  );
}
