import type { ReactNode } from "react";
import { Collapsible } from "@base-ui/react/collapsible";
import {
  CaretDown,
  CheckCircle,
  FlagCheckered,
  SealCheck,
} from "@phosphor-icons/react/dist/ssr";
import {
  AVALIACAO_LABEL,
  estrelasTexto,
  formatDate,
  TEMA_AVALIACAO_LABEL,
  TRILHA_LABEL,
} from "@/lib/ciclo";
import { mediaAvaliacaoLabel } from "@/lib/encerramento";
import { extraiRodaDaVida } from "@/lib/forms/schema";
import type { DadosRetrospectiva, RetroEncontro } from "@/lib/retrospectiva";
import { ImprimirButton } from "@/components/imprimir-button";
import { Badge } from "@/components/ui/badge";
import {
  BarraSegmentada,
  Sparkline,
} from "@/components/viz";
import {
  CompetenciasResultado,
} from "@/components/instrumento-resultado";
import { RodaComparada } from "@/components/instrumentos/roda-comparada";
import { RodaSvg } from "@/components/instrumentos/roda-svg";
import { cn } from "@/lib/utils";

// REALIZA-359 — a retrospectiva da jornada: tela derivada (nada se edita,
// nada se gera) que abre quando o 16º encontro é realizado ou a dupla já
// fechou. É o bloco de celebração do ciclo — REALIZA-378 deu a ele o
// desenho de destaque (faixa amarela da marca, a tira de encontros, a
// trajetória em estrelas) e recolheu os blocos longos de texto atrás de
// disclosures: a história inteira fica a um toque, sem mural de parágrafos.
// `dados` já vem recortado por papel (dadosRetrospectiva): a versão da
// jovem chega sem campos internos e o caller esconde o checklist.

/** Mesma escala do SemaforoDot/TrajetoriaAvaliacoes: verde → lima → âmbar →
 *  vermelho, por avaliação do mentor. */
const COR_AVALIACAO: Record<string, string> = {
  excelente: "bg-[var(--ok)] text-[var(--status-foreground)]",
  // sobre o lima a tinta é a --brand-ink, nunca branco (regra do token)
  boa: "bg-[var(--brand-lime)] text-[var(--brand-ink)]",
  regular: "bg-[var(--warn)] text-[var(--status-foreground)]",
  baixa: "bg-[var(--danger)] text-[var(--status-foreground)]",
};

/** Escala de estrelas do jovem (1–5) traduzida pra mesma gramática —
 *  usada no recorte dela, onde não há avaliação do mentor pra colorir. */
const COR_ESTRELA = (n: number): string =>
  n >= 5
    ? "bg-[var(--ok)] text-[var(--status-foreground)]"
    : n === 4
      ? "bg-[var(--brand-lime)] text-[var(--brand-ink)]"
      : n === 3
        ? "bg-[var(--warn)] text-[var(--status-foreground)]"
        : "bg-[var(--danger)] text-[var(--status-foreground)]";

function Secao({
  titulo,
  children,
  className,
}: {
  titulo: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("space-y-2.5", className)}>
      <h3 className="text-sm font-semibold">{titulo}</h3>
      {children}
    </section>
  );
}

/** Seção recolhida — os blocos longos da retrospectiva (linha a linha,
 *  excertos, checklist) dormem atrás do disclosure pra não empilhar scroll;
 *  hiddenUntilFound mantém o conteúdo achável por Cmd+F. */
function SecaoRecolhida({
  titulo,
  contagem,
  children,
}: {
  titulo: string;
  contagem?: number;
  children: ReactNode;
}) {
  return (
    <Collapsible.Root>
      <h3 className="text-sm font-semibold">
        <Collapsible.Trigger className="group flex min-h-11 w-full cursor-pointer items-center justify-between gap-2 rounded-lg text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <span className="min-w-0">
            {titulo}
            {contagem != null && (
              <span className="ml-1.5 font-normal text-muted-foreground">
                ({contagem})
              </span>
            )}
          </span>
          <CaretDown
            size={14}
            aria-hidden
            className="shrink-0 text-muted-foreground transition-transform group-data-[panel-open]:rotate-180"
          />
        </Collapsible.Trigger>
      </h3>
      <Collapsible.Panel
        hiddenUntilFound
        className="h-[var(--collapsible-panel-height)] overflow-hidden transition-[height] duration-150 data-ending-style:h-0 data-starting-style:h-0 [&[hidden]:not([hidden='until-found'])]:hidden"
      >
        <div className="pb-1">{children}</div>
      </Collapsible.Panel>
    </Collapsible.Root>
  );
}

/** Um bloco por encontro da trilha — a tira que resume a jornada de uma
 *  vez: cheio = realizado (cor da avaliação do mentor, ou da estrela da
 *  jovem no recorte dela), contorno = não realizado. */
function TiraEncontros({
  encontros,
  total,
  starSeries,
}: {
  encontros: RetroEncontro[];
  total: number;
  starSeries: (number | null)[] | null;
}) {
  const porNumero = new Map(encontros.map((e) => [e.numero, e]));
  const a11y = encontros
    .map(
      (e) =>
        `${e.numero}º` +
        (e.avaliacao
          ? ` ${AVALIACAO_LABEL[e.avaliacao]?.toLowerCase() ?? e.avaliacao}`
          : starSeries?.[e.numero - 1] != null
            ? ` ${estrelasTexto(starSeries[e.numero - 1]!)}`
            : "")
    )
    .join(", ");
  return (
    <ol
      role="img"
      aria-label={`Encontros realizados: ${a11y || "nenhum"}`}
      title={`Encontros realizados: ${a11y || "nenhum"}`}
      className="flex flex-wrap gap-1"
    >
      {Array.from({ length: total }, (_, i) => {
        const numero = i + 1;
        const e = porNumero.get(numero);
        const estrelas = starSeries?.[i] ?? null;
        return (
          <li
            key={numero}
            title={
              `Encontro ${numero}` +
              (e
                ? `${e.data ? ` · ${formatDate(e.data)}` : ""}` +
                  (e.avaliacao
                    ? ` · avaliação ${AVALIACAO_LABEL[e.avaliacao]?.toLowerCase() ?? e.avaliacao}`
                    : estrelas != null
                      ? ` · ${estrelasTexto(estrelas)}`
                      : " · sem avaliação")
                : " · não realizado")
            }
            className={cn(
              "grid size-7 place-items-center rounded-md text-[11px] font-semibold tabular-nums sm:size-8",
              e == null
                ? "bg-muted text-muted-foreground shadow-[inset_0_0_0_1px_var(--border)]"
                : e.avaliacao
                  ? COR_AVALIACAO[e.avaliacao]
                  : estrelas != null
                    ? COR_ESTRELA(estrelas)
                    : "bg-muted-foreground/45 text-foreground"
            )}
          >
            {numero}
          </li>
        );
      })}
    </ol>
  );
}

export function RetrospectivaJornada({
  dados,
  mostrarChecklist = false,
}: {
  dados: DadosRetrospectiva;
  /** recorte mentor/staff — a autoavaliação do mentor nunca sai pra jovem */
  mostrarChecklist?: boolean;
}) {
  if (!dados.desbloqueada) return null;
  const { resumo } = dados;
  const combinadosFeitos = dados.combinados.filter(
    (c) => c.status === "feito"
  ).length;
  const jovem = resumo.avaliacaoJovem;

  const rodaInicial = dados.roda?.inicial
    ? extraiRodaDaVida(dados.roda.campos, dados.roda.inicial.respostas)
    : null;
  const rodaFormal = dados.roda?.formal
    ? extraiRodaDaVida(dados.roda.campos, dados.roda.formal.respostas)
    : null;
  const rodaUnica = rodaFormal ?? rodaInicial;
  const encontrosComTrecho = dados.encontros.filter(
    (e) => e.trechos.length > 0
  );
  // a tira precisa de um slot por encontro da trilha — dupla histórica sem
  // cronograma (passos vazio) usa o maior nº realizado como denominador
  const totalSlots = Math.max(
    resumo.total,
    ...dados.encontros.map((e) => e.numero),
    0
  );
  const temAvaliacao = dados.encontros.some((e) => e.avaliacao != null);
  const temEstrela = dados.starSeries?.some((s) => s != null) ?? false;

  return (
    <section
      aria-label="Retrospectiva da jornada"
      className="animate-enter overflow-hidden rounded-xl bg-card shadow-[var(--shadow-border)]"
    >
      {/* a faixa de celebração — o amarelo da marca é jornada/fechamento,
          nunca alerta: aqui é o momento de chegar */}
      <div className="border-b border-[var(--destaque-borda)] bg-[var(--destaque-suave)] px-4 py-4 sm:px-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="flex items-center gap-2 text-base font-semibold">
              <FlagCheckered
                size={17}
                aria-hidden
                className="shrink-0 text-[var(--brand-lime)]"
              />
              Retrospectiva da jornada
            </h2>
            <p className="mt-1 text-sm font-medium">
              {resumo.mentorNome} e {resumo.mentoradoNome}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Trilha {TRILHA_LABEL[resumo.trilha]} · início{" "}
              {formatDate(resumo.inicio)}
              {resumo.fim
                ? ` · encerramento ${formatDate(resumo.fim)}`
                : resumo.status === "concluida" || resumo.status === "encerrada"
                  ? " · jornada fechada"
                  : ""}
            </p>
          </div>
          <ImprimirButton />
        </div>

        <p className="mt-3">
          <span className="text-3xl font-bold tabular-nums">
            {resumo.realizados}
          </span>
          <span className="ml-1.5 text-sm font-semibold text-muted-foreground">
            de {totalSlots}{" "}
            {totalSlots === 1 ? "encontro realizado" : "encontros realizados"}
            {resumo.esperados != null &&
              resumo.esperados !== resumo.realizados &&
              ` · ${resumo.esperados} esperados até hoje`}
          </span>
        </p>
        {totalSlots > 0 && (
          <div className="mt-2.5">
            <TiraEncontros
              encontros={dados.encontros}
              total={totalSlots}
              starSeries={dados.starSeries}
            />
            <p className="mt-1.5 text-xs text-muted-foreground">
              Um bloco por encontro
              {temAvaliacao && temEstrela
                ? " · a cor é a avaliação do mentor ou a estrela do jovem"
                : temAvaliacao
                  ? " · a cor é a avaliação do mentor"
                  : temEstrela
                    ? " · a cor é a estrela do jovem"
                    : ""}
              {dados.encontros.length < totalSlots
                ? " · contorno = não realizado"
                : ""}
            </p>
          </div>
        )}
      </div>

      <div className="space-y-5 p-4 sm:p-5">
        <dl className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {[
            [
              "Combinados",
              `${combinadosFeitos} de ${dados.combinados.length}`,
              "cumpridos",
            ],
            [
              "Avaliação do mentor",
              resumo.mediaAvaliacao != null
                ? `${resumo.mediaAvaliacao.toFixed(1)}/4`
                : "—",
              resumo.mediaAvaliacao != null
                ? mediaAvaliacaoLabel(resumo.mediaAvaliacao).toLowerCase()
                : null,
            ],
            [
              "Metas do PDM",
              dados.pdm ? `${dados.pdm.atingidas} de ${dados.pdm.total}` : "—",
              dados.pdm ? "atingidas" : null,
            ],
          ].map(([rotulo, valor, sub]) => (
            <div
              key={rotulo as string}
              className="rounded-lg bg-muted/40 px-3 py-2.5"
            >
              <dt className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                {rotulo}
              </dt>
              <dd className="mt-0.5 text-sm font-semibold tabular-nums">
                {valor}
              </dd>
              {sub && (
                <dd className="text-xs text-muted-foreground">{sub}</dd>
              )}
            </div>
          ))}
        </dl>

        {/* a voz dela — série em estrelas quando o recorte carrega os
            pontos (staff/jovem); pro mentor DPP o resumo quantizado basta */}
        {jovem && (
          <Secao titulo="Avaliação do jovem">
            {dados.starSeries != null && (
              <Sparkline
                series={[
                  { valores: dados.starSeries, rotulo: "Estrelas do jovem" },
                ]}
                labelsX={dados.starSeries.map((_, i) => `${i + 1}º`)}
                min={1}
                max={5}
                altura={110}
                area
              />
            )}
            <p className="text-sm">
              <span className="font-mono tabular-nums">
                {jovem.media != null
                  ? `${jovem.media.toFixed(1)}/5`
                  : `${jovem.n}×`}
              </span>{" "}
              <span className="text-xs text-muted-foreground">
                {jovem.media != null
                  ? `média de ${jovem.n} ${
                      jovem.n === 1 ? "avaliação" : "avaliações"
                    }`
                  : "média a partir de 3 avaliações"}
              </span>
            </p>
            {jovem.trajetoria && (
              <p className="text-xs text-muted-foreground">
                1º→último: {jovem.trajetoria.primeiro}★ →{" "}
                {jovem.trajetoria.ultimo}★
              </p>
            )}
            {jovem.temasTop.length > 0 && (
              <p className="flex flex-wrap gap-1">
                {jovem.temasTop.map((t) => (
                  <Badge key={t} variant="outline" className="text-[10px]">
                    {TEMA_AVALIACAO_LABEL[t] ?? t}
                  </Badge>
                ))}
              </p>
            )}
          </Secao>
        )}

        {/* encontro a encontro — a tira acima já conta a história; o detalhe
            (data, tema, avaliação) fica sob disclosure */}
        {dados.encontros.length > 0 && (
          <SecaoRecolhida
            titulo="Encontro a encontro"
            contagem={dados.encontros.length}
          >
            <ol className="divide-y divide-border/60">
              {dados.encontros.map((e) => (
                <li
                  key={e.numero}
                  className="flex items-baseline gap-3 py-1.5 text-sm"
                >
                  <span className="w-10 shrink-0 text-xs font-semibold tabular-nums text-muted-foreground">
                    {e.numero}º
                  </span>
                  <span className="min-w-0 flex-1">
                    {e.tema ?? "Encontro"}
                    <span className="block text-xs tabular-nums text-muted-foreground">
                      {formatDate(e.data)}
                    </span>
                  </span>
                  {e.avaliacao && (
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {AVALIACAO_LABEL[e.avaliacao] ?? e.avaliacao}
                    </span>
                  )}
                </li>
              ))}
            </ol>
          </SecaoRecolhida>
        )}

        {dados.combinados.length > 0 && (
          <Secao titulo="Os combinados">
            <ul className="space-y-1.5">
              {dados.combinados.map((c, i) => (
                <li key={i} className="flex items-start gap-2 text-sm">
                  {c.status === "feito" ? (
                    <CheckCircle
                      size={15}
                      weight="fill"
                      aria-hidden
                      className="mt-0.5 shrink-0 text-[var(--ok-text)]"
                    />
                  ) : (
                    <span
                      aria-hidden
                      className="mt-1 size-3.5 shrink-0 rounded-full border border-muted-foreground/50"
                    />
                  )}
                  <span className="min-w-0 flex-1 leading-snug">
                    {c.descricao}
                    <span className="mt-0.5 block text-xs text-muted-foreground">
                      {c.responsavel
                        ? `${c.responsavel === "mentor" ? "Mentor" : "Mentorado(a)"} · `
                        : ""}
                      {c.numero != null ? `encontro ${c.numero} · ` : ""}
                      {c.status === "feito"
                        ? c.feitoEm
                          ? `feito em ${formatDate(c.feitoEm)}`
                          : "feito"
                        : c.prazo
                          ? `até ${formatDate(c.prazo)}`
                          : "em aberto"}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </Secao>
        )}

        {rodaUnica && dados.roda && (
          <Secao titulo="A Roda da Vida, antes e depois">
            {rodaInicial && rodaFormal ? (
              <RodaComparada
                rodaAtual={rodaFormal}
                rodaAnterior={rodaInicial}
                reflexao={
                  (dados.roda.formal!.respostas["reflexao"] as string) || null
                }
              />
            ) : (
              <div className="text-center">
                <RodaSvg roda={rodaUnica} className="max-w-[280px]" />
                <p className="mt-1 text-xs text-muted-foreground">
                  {rodaFormal
                    ? "Aplicação formal — a leitura inicial não chegou a ser respondida."
                    : "Leitura inicial — a aplicação formal ainda não aconteceu."}
                </p>
              </div>
            )}
          </Secao>
        )}

        {dados.pdm && dados.pdm.total > 0 && (
          <Secao titulo="O plano, no fim">
            <BarraSegmentada
              segmentos={[
                {
                  valor: dados.pdm.atingidas,
                  rotulo:
                    dados.pdm.atingidas === 1
                      ? "meta atingida"
                      : "metas atingidas",
                  cls: "bg-[var(--ok)]",
                },
              ]}
              denominador={dados.pdm.total}
              legenda
              ariaLabel={`${dados.pdm.atingidas} de ${dados.pdm.total} metas do PDM atingidas`}
            />
            {dados.pdm.atingidasLista.length > 0 && (
              <ul className="space-y-1">
                {dados.pdm.atingidasLista.map((m, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm">
                    <SealCheck
                      size={15}
                      aria-hidden
                      className="mt-0.5 shrink-0 text-[var(--ok-text)]"
                    />
                    <span className="min-w-0 leading-snug">
                      {m.titulo}
                      {m.atingidaEm && (
                        <span className="block text-xs tabular-nums text-muted-foreground">
                          {formatDate(m.atingidaEm)}
                        </span>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Secao>
        )}

        {/* excertos dos registros (o que o mentor anotou e pode ser
            mostrado no recorte — jovem vê só o que não é interno) */}
        {encontrosComTrecho.length > 0 && (
          <SecaoRecolhida
            titulo="Dos registros"
            contagem={encontrosComTrecho.length}
          >
            <div className="space-y-3">
              {encontrosComTrecho.map((e) => (
                <div key={e.numero}>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                    {e.numero}º encontro
                  </p>
                  <dl className="mt-1 space-y-1.5">
                    {e.trechos.map((t) => (
                      <div key={t.rotulo}>
                        <dt className="text-xs font-medium text-muted-foreground">
                          {t.rotulo}
                        </dt>
                        <dd className="text-sm leading-relaxed whitespace-pre-wrap">
                          {t.texto}
                        </dd>
                      </div>
                    ))}
                  </dl>
                </div>
              ))}
            </div>
          </SecaoRecolhida>
        )}

        {/* checklist do mentor (recorte staff: nunca pra jovem) */}
        {mostrarChecklist && dados.checklist && (
          <SecaoRecolhida titulo="Competências do mentor, do início ao fim">
            <CompetenciasResultado
              campos={dados.checklist.campos}
              respostas={
                dados.checklist.final?.respostas ??
                dados.checklist.inicio!.respostas
              }
              respostasInicio={
                dados.checklist.final
                  ? (dados.checklist.inicio?.respostas ?? null)
                  : null
              }
            />
          </SecaoRecolhida>
        )}
      </div>
    </section>
  );
}
