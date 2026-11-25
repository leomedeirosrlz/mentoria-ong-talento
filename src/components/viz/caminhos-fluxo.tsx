import type { CSSProperties } from "react";
import { ROTULO_SUPERFICIE, type Caminho } from "@/lib/adocao";
import { cn } from "@/lib/utils";

const FMT_INT = new Intl.NumberFormat("pt-BR");

/** Nome da superfície na voz da casa; id fora da lista canônica aparece
 *  cru — superfície desconhecida é dado honesto (ela sumiu do app ou é
 *  ralo novo), nunca silenciada. */
const nomeSuperficie = (id: string) => ROTULO_SUPERFICIE.get(id) ?? id;

/** Top sequências de navegação — a resposta "como as pessoas andam pelo
 *  app" sem sankey: nesta escala (~15 superfícies) a cadeia nomeada é
 *  mais legível que nós e arestas.
 *
 *  É um <ol> porque é literalmente um ranking — posição, total e ordem
 *  saem de graça pro leitor de tela. Cada item: chips das superfícies
 *  ligados por "→" + "N pessoas" + barra fina proporcional ao caminho
 *  mais percorrido (proporcional ao TOPO, não a um denominador — é
 *  comparação entre caminhos, então a barra não finge fração de nada).
 *
 *  A barra é reforço visual (aria-hidden): o número já diz tudo. */
export function CaminhosFluxo({
  caminhos,
  animate = false,
  i = 0,
  className,
}: {
  /** saída de dadosAdocaoCaminhos — o componente ordena desc por
   *  segurança (o ranking é responsabilidade dele, não do fetch) */
  caminhos: Caminho[];
  /** entrada animada uma vez (fade+rise no bloco, fill-grow nas barras
   *  com stagger via --i) — reduced-motion zera */
  animate?: boolean;
  /** índice base do stagger quando o bloco entra numa sequência */
  i?: number;
  className?: string;
}) {
  const linhas = [...caminhos].sort((a, b) => b.pessoas - a.pessoas);
  const max = Math.max(0, ...linhas.map((c) => c.pessoas));

  if (linhas.length === 0 || max === 0) {
    return (
      <p className={cn("text-sm text-muted-foreground", className)}>
        Nenhuma sequência percorrida no período.
      </p>
    );
  }

  return (
    <ol
      className={cn("space-y-3", animate && "animate-enter", className)}
      style={animate ? ({ "--i": i } as CSSProperties) : undefined}
    >
      {linhas.map((c, idx) => {
        const trechos = [c.de, c.meio, c.para];
        const caminhoTxt = trechos.map(nomeSuperficie).join(" → ");
        return (
          // o respiro negativo dá corpo ao hover sem mudar o ritmo vertical
          <li
            key={`${c.de}>${c.meio}>${c.para}`}
            className="-mx-1.5 rounded-md px-1.5 transition-colors hover:bg-muted/50"
          >
            <div className="flex items-center justify-between gap-3">
              <p className="flex min-w-0 flex-wrap items-center gap-1">
                {trechos.map((sup, t) => (
                  <span key={t} className="inline-flex items-center gap-1">
                    {t > 0 && (
                      <span aria-hidden className="text-muted-foreground">
                        →
                      </span>
                    )}
                    {/* rounded-md+borda: é dado, não chip clicável — o
                        title repete o caminho inteiro em cada trecho */}
                    <span
                      title={caminhoTxt}
                      className="rounded-md border border-border/70 bg-muted/50 px-2 py-0.5 text-[11px] font-medium whitespace-nowrap"
                    >
                      {nomeSuperficie(sup)}
                    </span>
                  </span>
                ))}
              </p>
              <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                {FMT_INT.format(c.pessoas)}{" "}
                {c.pessoas === 1 ? "pessoa" : "pessoas"}
              </span>
            </div>
            {/* barra de reforço — proporcional ao caminho mais percorrido;
                trilho fino e quieto: 100% do trilho lia como "meta" */}
            <div
              aria-hidden
              className="mt-1.5 h-[3px] w-full overflow-hidden rounded-full bg-muted/50"
            >
              <span
                className={cn(
                  "block h-full w-full origin-left rounded-full transition-transform duration-500 ease-snappy",
                  animate && "fill-grow"
                )}
                style={
                  {
                    transform: `scaleX(${c.pessoas / max})`,
                    backgroundColor: "var(--chart-2)",
                    ...(animate ? { "--i": idx } : {}),
                  } as CSSProperties
                }
              />
            </div>
          </li>
        );
      })}
    </ol>
  );
}
