import {
  lePonteiro,
  pontoEixo,
  pontosPoligono,
  rotuloQuadrante,
  RODA_CX,
  RODA_CY,
} from "@/lib/forms/instrumentos";
import type { RodaDaVida } from "@/lib/forms/schema";
import { cn } from "@/lib/utils";

// Desenho da Roda da Vida — o mesmo SVG pra leitura (ficha da dupla, tela
// de sucesso) e pro preenchimento (arrastar os eixos no /f/<token>). Sem
// hooks nem estado: com `onMudanca` o ponteiro move eixos; sem ele é
// imagem estática — por isso o arquivo não leva "use client" e pode ser
// renderizado por server component.

const ANEIS = [2, 4, 6, 8, 10];

export function RodaSvg({
  roda,
  ativo = null,
  onMudanca,
  onFim,
  className,
}: {
  roda: RodaDaVida;
  /** índice do eixo em edição — ganha o destaque lime */
  ativo?: number | null;
  /** presente = roda interativa: o arraste converte ângulo→eixo, raio→nota */
  onMudanca?: (indice: number, nota: number) => void;
  /** fim do gesto (pointerup/cancel) — o caller decide avançar de eixo */
  onFim?: () => void;
  className?: string;
}) {
  const areas = roda.quadrantes.flatMap((q) => q.areas);
  const total = areas.length;
  if (!total) return null;

  const dados = pontosPoligono(
    total,
    areas.map((a) => (a.nota ?? 0) / 10)
  );

  // nome do quadrante no meio do arco dele (fora do aro) — o índice de
  // início avança sobre TODOS os quadrantes, com nome ou sem
  let ini = 0;
  const rotulos: { nome: string; x: number; y: number }[] = [];
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
    const x = ((e.clientX - rect.left) / rect.width) * 320;
    const y = ((e.clientY - rect.top) / rect.height) * 320;
    const alvo = lePonteiro(x, y, total);
    onMudanca?.(alvo.indice, alvo.nota);
  }

  const interativo = Boolean(onMudanca);

  return (
    <svg
      viewBox="0 0 320 320"
      {...(interativo
        ? {
            // a lista de eixos (role=slider) carrega a acessibilidade —
            // a roda é o gesto, não o controle
            "aria-hidden": true,
          }
        : {
            role: "img",
            "aria-label": `Roda da Vida — média ${roda.media?.toLocaleString("pt-BR") ?? "sem notas"} em ${total} áreas`,
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
      </g>
    </svg>
  );
}
