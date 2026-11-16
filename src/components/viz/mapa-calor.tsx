import type { CSSProperties } from "react";
import { Button as ButtonPrimitive } from "@base-ui/react/button";
import { intensidades, type GradeMatriz } from "@/lib/adocao";
import { cn } from "@/lib/utils";

const FMT_INT = new Intl.NumberFormat("pt-BR");

/* Piso e teto do preenchimento sequencial: 10% garante que "1 pessoa" já
 * leia como presença (só o zero é vazio — o buraco honesto); 95% preserva
 * respiro pro número. O matiz é um só (--brand-lime): escala sequencial
 * nunca é arco-íris. */
const PREENCHIMENTO = (i: number) =>
  `color-mix(in oklab, var(--brand-lime) ${Math.round(10 + i * 85)}%, var(--card))`;

/* Acima desta intensidade o número troca pra tinta da marca — o fill já é
 * majoritariamente lima nos dois temas (lima é constante de marca) e o par
 * ink-sobre-lima é o mesmo do botão primary. Abaixo fica --foreground, que
 * acompanha o tema sobre o fundo próximo do card. */
const LIMIAR_TINTA = 0.6;

/** O número da célula com a tinta certa pro fill atrás dele — é o miolo
 *  da td: quando `onCelula` existe o ButtonPrimitive vira a área clicável
 *  inteira da célula (teclado + toque de graça), senão um span quieto. */
function Numero({
  valor,
  intensidade,
}: {
  valor: number;
  intensidade: number;
}) {
  if (valor <= 0) {
    // o zero fica visível mas quieto — a célula existe (buraco honesto),
    // o apagado diz "nada aqui" sem ocupar a leitura
    return <span className="text-muted-foreground/60">0</span>;
  }
  return (
    <span
      className="font-semibold tabular-nums"
      style={intensidade >= LIMIAR_TINTA ? { color: "var(--brand-ink)" } : undefined}
    >
      {FMT_INT.format(valor)}
    </span>
  );
}

/** Mapa de calor superfície × papel — o painel central da aba. É uma
 *  <table> de verdade: heatmap é tabela com preenchimento, então a leitura
 *  de célula (linha × coluna) sai de graça via scope, sem hack de canvas.
 *
 *  Escala: `intensidades(grade)` normaliza pelo máximo da grade (o topo é
 *  sempre a célula mais densa); a cor é UMA família sequencial de
 *  --brand-lime misturada ao --card — nada de arco-íris. O número impresso
 *  dentro da célula é o dado; o fill só reforça (mesma regra do semáforo).
 *
 *  Célula zero = trilho vazio com "0" apagado: a linha/coluna existe no
 *  mapa e o vazio É o dado (superfície morta, papel ausente). Linhas
 *  paradas (total 0) mantêm o nome na linha, mais quietas.
 *
 *  `onCelula` liga o drill: cada célula vira um button real cobrindo a td.
 *  Componente sem estado — server-safe: prop de função só pode vir de
 *  árvore client (boundary do RSC não serializa handler), então render
 *  server-side sempre sai como tabela estática, sem custo de JS.
 *
 *  Cabeçalho de coluna traz rótulo + total; coluna "total" à direita e
 *  linha "total" no <tfoot> — os três denominadores à vista. */
export function MapaCalor({
  grade,
  medida,
  medidaRotulo,
  onCelula,
  contexto,
  animate = false,
  i = 0,
  className,
}: {
  /** saída de matrizParaGrade — linhas ordenadas por uso, colunas só com
   *  papéis que têm evento; a grade carrega os totais de linha e coluna */
  grade: GradeMatriz;
  /** unidade da célula — guia o singular do aria ("1 pessoa única"/"1 gesto") */
  medida: "pessoas" | "gestos";
  /** rótulo plural da medida — "pessoas únicas", "gestos" */
  medidaRotulo: string;
  /** drill por célula (superfície, papel) — só em árvore client */
  onCelula?: (superficie: string, papel: string) => void;
  /** janela/escopo declarado pra compor o caption — "nos últimos 30 dias" */
  contexto?: string;
  /** entrada animada uma vez (fade+rise) — reduced-motion zera */
  animate?: boolean;
  /** índice do stagger na página (alimenta --i) */
  i?: number;
  className?: string;
}) {
  const inten = intensidades(grade);
  const totalGeral = grade.linhas.reduce((s, l) => s + l.total, 0);
  const top = grade.linhas.find((l) => l.total > 0);
  const unidade = (n: number) =>
    medida === "pessoas"
      ? n === 1
        ? "pessoa única"
        : "pessoas únicas"
      : n === 1
        ? "gesto"
        : "gestos";

  if (grade.colunas.length === 0) {
    return (
      <p className={cn("text-sm text-muted-foreground", className)}>
        {medida === "pessoas"
          ? "Nenhuma pessoa ativa no período."
          : "Nenhum gesto no período."}
      </p>
    );
  }

  const conteudo = (linha: (typeof grade.linhas)[number], papel: string) => {
    const valor = grade.celulas.get(linha.id)?.get(papel) ?? 0;
    const iCel = inten.get(linha.id)?.get(papel) ?? 0;
    const estilo: CSSProperties | undefined =
      valor > 0 ? { background: PREENCHIMENTO(iCel) } : undefined;
    const rotuloCelula = `${linha.rotulo}, ${
      grade.colunas.find((c) => c.id === papel)?.rotulo ?? papel
    }: ${valor} ${unidade(valor)}`;
    const cls =
      "block w-full rounded-[5px] px-1.5 py-1 text-center text-xs tabular-nums";
    return onCelula ? (
      <ButtonPrimitive
        type="button"
        aria-label={rotuloCelula}
        className={cn(
          cls,
          "cursor-pointer outline-none transition-[filter] duration-150 ease-snappy hover:brightness-95 focus-visible:ring-2 focus-visible:ring-ring"
        )}
        style={estilo}
        onClick={() => onCelula(linha.id, papel)}
      >
        <Numero valor={valor} intensidade={iCel} />
      </ButtonPrimitive>
    ) : (
      <span className={cls} style={estilo} title={rotuloCelula}>
        <Numero valor={valor} intensidade={iCel} />
      </span>
    );
  };

  const caption =
    `${FMT_INT.format(totalGeral)} ${medidaRotulo} por superfície e papel` +
    `${contexto ? ` ${contexto}` : ""}.` +
    (top
      ? ` Superfície mais usada: ${top.rotulo} com ${FMT_INT.format(top.total)} ${unidade(top.total)}.`
      : "");

  return (
    <div className={cn(animate && "animate-enter", className)} style={animate ? ({ "--i": i } as CSSProperties) : undefined}>
      <div
        role="region"
        aria-label="Mapa de calor de uso por superfície e papel. Role horizontalmente"
        tabIndex={0}
        className="scroll-fina overflow-x-auto focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <table className="w-full">
          <caption className="sr-only">{caption}</caption>
          <thead>
            <tr>
              <th
                scope="col"
                className="py-1 pr-2 text-left text-xs font-medium text-muted-foreground"
              >
                superfície
              </th>
              {grade.colunas.map((c) => (
                <th
                  key={c.id}
                  scope="col"
                  className="px-0.5 py-1 text-center font-medium"
                >
                  <span className="block text-xs text-muted-foreground">{c.rotulo}</span>
                  <span className="block text-[10px] tabular-nums text-muted-foreground">
                    {FMT_INT.format(c.total)}
                  </span>
                </th>
              ))}
              <th
                scope="col"
                className="py-1 pl-2 text-right text-xs font-semibold"
              >
                total
              </th>
            </tr>
          </thead>
          <tbody>
            {grade.linhas.map((l) => {
              const parada = l.total === 0;
              return (
                <tr key={l.id}>
                  <th
                    scope="row"
                    className={cn(
                      "py-0.5 pr-2 text-left text-xs font-medium whitespace-nowrap",
                      // parada segue nomeada, só mais quieta — a linha zerada
                      // é exatamente o que a aba existe pra mostrar
                      parada ? "text-muted-foreground" : "text-foreground"
                    )}
                  >
                    {l.rotulo}
                  </th>
                  {grade.colunas.map((c) => (
                    <td key={c.id} className="p-0.5">
                      {conteudo(l, c.id)}
                    </td>
                  ))}
                  <td
                    className={cn(
                      "py-0.5 pl-2 text-right text-xs font-semibold tabular-nums",
                      parada && "font-medium text-muted-foreground/60"
                    )}
                  >
                    {FMT_INT.format(l.total)}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr>
              <th
                scope="row"
                className="border-t-2 border-border py-1.5 pr-2 text-left text-xs font-semibold"
              >
                total
              </th>
              {grade.colunas.map((c) => (
                <td
                  key={c.id}
                  className="border-t-2 border-border px-0.5 py-1.5 text-center text-xs font-semibold tabular-nums"
                >
                  {FMT_INT.format(c.total)}
                </td>
              ))}
              <td className="border-t-2 border-border py-1.5 pl-2 text-right text-xs font-semibold tabular-nums">
                {FMT_INT.format(totalGeral)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
