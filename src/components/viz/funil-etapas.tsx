import type { CSSProperties } from "react";
import { CaretRight } from "@phosphor-icons/react/dist/ssr";
import type { FunilInstrumento } from "@/lib/relatorios/adocao";
import { cn } from "@/lib/utils";
import { BarraSegmentada, SEGMENTO_NEUTRO } from "./barra-segmentada";

const FMT_INT = new Intl.NumberFormat("pt-BR");

/** Resumo da linha — o mesmo texto vai pro aria-label da barra e pra
 *  leitura visível ao lado: número, denominador e janela declarados.
 *  Campanha não tem denominador observável — lê o que o dado é de
 *  verdade (respostas recebidas), sem % fingida. */
function resumoLinha(f: FunilInstrumento, janelaDias: number): string {
  if (f.campanha) {
    const verbo = f.respondidos === 1 ? "resposta recebida" : "respostas recebidas";
    return `${FMT_INT.format(f.respondidos)} ${verbo} no período`;
  }
  const pct = f.emitidos > 0 ? Math.round((f.respondidos / f.emitidos) * 100) : 0;
  const verbo = f.respondidos === 1 ? "respondeu" : "responderam";
  return `${FMT_INT.format(f.respondidos)} de ${FMT_INT.format(f.emitidos)} ${verbo} (${pct}%) em até ${janelaDias} dias`;
}

/** Funil emitido → respondido por instrumento, em barras da casa.
 *
 *  Duas proporções honestas por linha: a LARGURA da barra é proporcional
 *  a `emitidos` (a maior linha ocupa 100% — compara o volume entre
 *  instrumentos) e os SEGMENTOS dentro dela são frações literais do
 *  próprio `emitidos` via BarraSegmentada (compara o destino dentro da
 *  linha). Sem trilho até 100%: o máximo não é meta, é só a régua.
 *
 *  Semântica dos segmentos: respondidos = --ok cheio; tardios = --ok/50
 *  (responderam, só que depois da janela — meia vitória, não pendente);
 *  expirados = muted-foreground/40 (oportunidade perdida, não alerta
 *  ativo); aguardando = hatch neutro (SEGMENTO_NEUTRO: a posição existe
 *  no denominador e ainda pode virar). Linha de campanha = só a barra
 *  cheia + nota — link aberto não tem denominador.
 *
 *  A conversão sempre declara a janela ("em até N dias") — % sem janela
 *  é número solto. A leitura por linha vai no role="img" da barra e no
 *  texto ao lado; o <details> entrega a tabela completa. */
export function FunilEtapas({
  instrumentos,
  janelaDias = 14,
  animate = false,
  i = 0,
  className,
}: {
  /** saída de dadosFunilInstrumentos — já ordenada por emitidos desc;
   *  o componente reordena por segurança sem custo */
  instrumentos: FunilInstrumento[];
  /** janela de conversão declarada — "em até 14 dias" */
  janelaDias?: number;
  /** entrada animada uma vez: cada barra cresce da esquerda (fill-grow
   *  com stagger via --i) — reduced-motion zera */
  animate?: boolean;
  /** índice base do stagger quando o bloco entra numa sequência */
  i?: number;
  className?: string;
}) {
  const linhas = [...instrumentos].sort((a, b) => b.emitidos - a.emitidos);
  const maxEmit = Math.max(0, ...linhas.map((l) => l.emitidos));

  if (linhas.length === 0 || maxEmit === 0) {
    return (
      <p className={cn("text-sm text-muted-foreground", className)}>
        Nenhum instrumento emitido no período.
      </p>
    );
  }

  return (
    <div className={cn(animate && "animate-enter", className)} style={animate ? ({ "--i": i } as CSSProperties) : undefined}>
      <ul className="space-y-4">
        {linhas.map((f, idx) => (
          <li key={f.instrumento}>
            <div className="flex flex-wrap items-baseline justify-between gap-x-3">
              <p className="text-sm font-medium">
                {f.instrumento}
                {f.campanha && (
                  <span className="ml-2 text-xs font-normal text-muted-foreground">
                    campanha aberta
                  </span>
                )}
              </p>
              {/* ml-auto: quando o nome quebra linha (campanha traz a tag
                  ao lado), o resumo continua à direita como as demais */}
              <p className="ml-auto text-xs tabular-nums text-muted-foreground">
                {f.emitidos > 0 ? resumoLinha(f, janelaDias) : "nenhum emitido"}
              </p>
            </div>
            {f.emitidos > 0 && (
              // a largura carrega a comparação entre linhas; dentro, a
              // barra segmentada carrega a composição (denominador literal).
              // Sem piso de largura: uma linha miúda é miúda de verdade.
              // cursor-help + brightness: sinaliza que há detalhe (o title
              // de cada segmento) sem mentir clique
              <div
                className="mt-1.5 cursor-help transition-[filter] hover:brightness-[0.97]"
                style={{ width: `${(f.emitidos / maxEmit) * 100}%` }}
              >
                <BarraSegmentada
                  segmentos={[
                    {
                      valor: f.respondidos,
                      rotulo: "responderam",
                      cls: "bg-[var(--ok)]",
                    },
                    // respondeu, mas depois da janela — meia vitória
                    {
                      valor: f.tardios,
                      rotulo: "responderam após o prazo",
                      cls: "bg-[var(--ok)]/50",
                    },
                    {
                      valor: f.expirados,
                      rotulo: "expiraram sem responder",
                      cls: "bg-muted-foreground/40",
                    },
                    // pendente ainda pode virar — neutro nomeado, não ausência
                    { valor: f.pendentes, rotulo: "aguardando resposta" },
                  ]}
                  denominador={f.emitidos}
                  altura="lg"
                  animate={animate}
                  i={idx}
                  ariaLabel={`${f.instrumento}: ${resumoLinha(f, janelaDias)}${f.tardios > 0 ? `; ${FMT_INT.format(f.tardios)} responderam após o prazo` : ""}; ${FMT_INT.format(f.expirados)} expiraram sem responder; ${FMT_INT.format(f.pendentes)} aguardando`}
                />
              </div>
            )}
          </li>
        ))}
      </ul>
      {/* legenda nomeada única — os destinos valem pro conjunto todo */}
      <p className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <span aria-hidden className="size-2 rounded-full bg-[var(--ok)]" />
          responderam
        </span>
        <span className="inline-flex items-center gap-1">
          <span aria-hidden className="size-2 rounded-full bg-[var(--ok)]/50" />
          responderam após o prazo
        </span>
        <span className="inline-flex items-center gap-1">
          <span aria-hidden className="size-2 rounded-full bg-muted-foreground/40" />
          expiraram sem responder
        </span>
        <span className="inline-flex items-center gap-1">
          {/* hatch em 8px vira borrão — o swatch retangular (mesmo padrão
              do recesso do cronograma) mostra o ritmo das listras */}
          <span
            aria-hidden
            className={cn("h-2 w-4 rounded-sm ring-1 ring-inset ring-border", SEGMENTO_NEUTRO)}
          />
          aguardando resposta
        </span>
      </p>
      <details className="group mt-2 text-xs text-muted-foreground">
        <summary className="inline-flex min-h-11 cursor-pointer items-center gap-1 font-semibold text-foreground underline-offset-4 hover:underline sm:min-h-8">
          <CaretRight className="size-3.5 transition-transform duration-150 ease-snappy group-open:rotate-90" />
          ver dados em tabela
        </summary>
        <div
          role="region"
          aria-label="Funil de instrumentos em tabela. Role horizontalmente"
          tabIndex={0}
          className="scroll-fina mt-2 max-h-72 overflow-x-auto overflow-y-auto focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <table className="w-full border-separate border-spacing-0 text-left tabular-nums">
            <thead>
              <tr className="text-muted-foreground">
                <th scope="col" className="sticky left-0 z-10 border-r border-border/60 bg-card py-1 pr-3 font-medium">instrumento</th>
                <th scope="col" className="py-1 px-2 text-right font-medium">emitidos</th>
                <th scope="col" className="py-1 px-2 text-right font-medium">responderam</th>
                <th scope="col" className="py-1 px-2 text-right font-medium">após prazo</th>
                <th scope="col" className="py-1 px-2 text-right font-medium">expiraram</th>
                <th scope="col" className="py-1 text-right font-medium">aguardando</th>
              </tr>
            </thead>
            {/* border-separate ignora borda em tr — as divisórias de
                linha vivem nas células (o sticky da 1ª coluna exige o
                modelo separado pra borda/bg acompanharem) */}
            <tbody className="[&_td]:border-t [&_td]:border-border/50">
              {linhas.map((f) => (
                <tr key={f.instrumento}>
                  <td className="sticky left-0 z-10 border-r border-border/60 bg-card py-1 pr-3">
                    {f.instrumento}
                    {f.campanha && " (campanha)"}
                  </td>
                  <td className="py-1 px-2 text-right font-medium text-foreground">
                    {f.campanha ? "—" : FMT_INT.format(f.emitidos)}
                  </td>
                  <td className="py-1 px-2 text-right font-medium text-foreground">
                    {FMT_INT.format(f.respondidos)}
                    {!f.campanha &&
                      f.emitidos > 0 &&
                      ` (${Math.round((f.respondidos / f.emitidos) * 100)}%)`}
                  </td>
                  <td className="py-1 px-2 text-right font-medium text-foreground">
                    {FMT_INT.format(f.tardios)}
                  </td>
                  <td className="py-1 px-2 text-right font-medium text-foreground">
                    {FMT_INT.format(f.expirados)}
                  </td>
                  <td className="py-1 text-right font-medium text-foreground">
                    {FMT_INT.format(f.pendentes)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}
