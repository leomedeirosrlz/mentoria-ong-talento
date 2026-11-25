import type { CSSProperties } from "react";
import type { GradeCoorte } from "@/lib/adocao";
import { cn } from "@/lib/utils";

/* Mesma família sequencial do MapaCalor (--brand-lime sobre --card): a
 * gramática do kit é uma cor por pergunta, e "quanto fica" aqui é a mesma
 * pergunta "quanto usa" do mapa — uma segunda cor seria decoração, não
 * informação. Diferença de escala: a intensidade é o PRÓPRIO pct (0..1,
 * absoluto e compartilhado por todas as células), não normalizada pelo
 * máximo — 82% é o mesmo verde em qualquer grade, o que permite comparar
 * janelas e coortes entre si. O clamp é defesa de render: pct>1 (dado
 * impossível que ainda chegou) gerava color-mix inválido e a célula
 * ficava nua — quem corrige o número exibido é a camada de dados. */
const PREENCHIMENTO = (pct: number) =>
  `color-mix(in oklab, var(--brand-lime) ${Math.round(10 + Math.min(1, Math.max(0, pct)) * 85)}%, var(--card))`;

/* Acima do limiar o número vira tinta da marca (fill já é majoritariamente
 * lima nos dois temas — o par ink-sobre-lima é o do botão primary). */
const LIMIAR_TINTA = 0.6;

const PCT_TXT = (p: number) => `${Math.round(p * 100)}%`;

/** Grade triangular de retenção por coorte — a variante "o uso fica?" do
 *  MapaCalor. Linhas = semanas de entrada (coortes, mais nova em cima),
 *  colunas = semana 0..N depois do primeiro uso. A célula imprime a %
 *  de pessoas da coorte ativas naquela semana sobre o total DA coorte —
 *  denominador por linha declarado no cabeçalho.
 *
 *  Triângulo honesto: célula de semana que ainda não chegou não renderiza
 *  — nenhum zero inventado pra coorte nova. As células faltantes são
 *  sempre as últimas da linha, então a omissão preserva o alinhamento.
 *
 *  É <table> de verdade (scope row/col): a leitura "coorte sem 04/11,
 *  semana 2: 64%" sai pela estrutura. O caption resume e a nota embaixo
 *  declara o que a % responde. */
export function CoorteGrade({
  grade,
  animate = false,
  i = 0,
  className,
}: {
  /** saída de coorteParaGrade — linhas desc por data, semanas 0..N e o
   *  mapa de % por coorte (ausente = semana ainda não chegou) */
  grade: GradeCoorte;
  /** entrada animada uma vez (fade+rise) — reduced-motion zera */
  animate?: boolean;
  /** índice do stagger na página (alimenta --i) */
  i?: number;
  className?: string;
}) {
  if (grade.linhas.length === 0 || grade.semanas <= 0) {
    return (
      <p className={cn("text-sm text-muted-foreground", className)}>
        Ainda não há coortes suficientes pra medir retorno.
      </p>
    );
  }

  const semanas = Array.from({ length: grade.semanas }, (_, s) => s);

  return (
    <div
      className={cn(animate && "animate-enter", className)}
      style={animate ? ({ "--i": i } as CSSProperties) : undefined}
    >
      <div
        role="region"
        aria-label="Grade de retenção por coorte. Role horizontalmente"
        tabIndex={0}
        className="scroll-fina overflow-x-auto focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <table className="w-full border-separate border-spacing-0">
          <caption className="sr-only">
            Retenção semanal por coorte: para cada semana de entrada, a % de
            pessoas ativas nas semanas seguintes sobre o total da coorte.
            Células ausentes são semanas que ainda não chegaram.
          </caption>
          <thead>
            <tr>
              <th
                scope="col"
                className="sticky left-0 z-10 border-r border-border/60 bg-card py-1 pr-2 text-left text-xs font-medium text-muted-foreground"
              >
                coorte
              </th>
              {semanas.map((s) => (
                <th
                  key={s}
                  scope="col"
                  aria-label={s === 0 ? "semana 0" : `semana ${s}`}
                  className="px-0.5 py-1 text-center text-xs font-medium text-muted-foreground"
                >
                  {s === 0 ? "sem 0" : `+${s}`}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {grade.linhas.map((l) => {
              const porSemana = grade.pct.get(l.coorte);
              return (
                <tr key={l.coorte} className="group/tr">
                  <th
                    scope="row"
                    className="sticky left-0 z-10 border-r border-border/60 bg-card py-0.5 pr-2 text-left whitespace-nowrap transition-colors group-hover/tr:bg-muted"
                  >
                    <span className="block text-xs font-medium">{l.rotulo}</span>
                    {/* o denominador da linha — toda % da coorte é sobre ele */}
                    <span className="block text-[10px] font-normal tabular-nums text-muted-foreground">
                      {l.total} {l.total === 1 ? "pessoa" : "pessoas"}
                    </span>
                  </th>
                  {semanas.map((s) => {
                    const pct = porSemana?.get(s);
                    // célula futura não existe — sem zero inventado
                    if (pct == null) return null;
                    return (
                      <td key={s} className="group/cel p-0.5 text-center">
                        <span
                          title={`${l.rotulo}, semana ${s}: ${PCT_TXT(pct)} ativas`}
                          className={cn(
                            // 10 colunas em ~500px: px-1 e 11px no desktop
                            // fecham a conta; no mobile o piso de 12px
                            // fica e o overflow-x-auto resolve
                            "block rounded-[5px] px-1 py-1 text-xs tabular-nums sm:text-[11px]",
                            "transition-shadow group-hover/cel:ring-1 group-hover/cel:ring-inset group-hover/cel:ring-foreground/25",
                            pct > 0 ? "font-semibold" : "text-muted-foreground/60"
                          )}
                          style={
                            pct > 0
                              ? {
                                  background: PREENCHIMENTO(pct),
                                  color:
                                    pct >= LIMIAR_TINTA
                                      ? "var(--brand-ink)"
                                      : undefined,
                                }
                              : undefined
                          }
                        >
                          {PCT_TXT(pct)}
                        </span>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {/* idem MapaCalor: a faixa gradiente declara piso→teto da rampa —
          aria-hidden porque o número impresso em cada célula já é o dado */}
      <p
        aria-hidden
        className="mt-2 flex items-center gap-1.5 text-[10px] text-muted-foreground"
      >
        menos
        <span
          className="h-2 w-16 rounded-sm"
          style={{
            background: `linear-gradient(90deg, ${PREENCHIMENTO(0)}, ${PREENCHIMENTO(0.25)}, ${PREENCHIMENTO(0.5)}, ${PREENCHIMENTO(0.75)}, ${PREENCHIMENTO(1)})`,
          }}
        />
        mais
      </p>
      <p className="mt-2 text-xs text-muted-foreground">
        % de pessoas de cada coorte ativas na semana; colunas vazias são
        semanas que ainda não chegaram.
      </p>
    </div>
  );
}
