import { Collapsible } from "@base-ui/react/collapsible";
import { CaretDown } from "@phosphor-icons/react/dist/ssr";
import {
  AVALIACAO_LABEL,
  formatDate,
  TEMA_AVALIACAO_LABEL,
  TRILHA_LABEL,
} from "@/lib/ciclo";
import {
  encerramentoDecidido,
  mediaAvaliacaoLabel,
  type ResumoJornada,
} from "@/lib/encerramento";
import { ImprimirButton } from "@/components/imprimir-button";
import { Badge } from "@/components/ui/badge";
import type { Encerramento } from "@/lib/types";

/** "Resumo da jornada" — o bloco print-friendly da ficha, gerado dos dados
 *  (não é campo livre): mentor/mentorado, encontros realizados vs. esperados,
 *  avaliação média, últimos registros e combinados. É a base do relatório
 *  final do guia — no print o CSS isola este bloco.
 *
 *  `compacta` (REALIZA-378): quando a retrospectiva está aberta na mesma
 *  superfície, o resumo vira o relatório sob disclosure — cabeçalho + meta
 *  visíveis, o corpo completo (tiles, listas, carimbo) a um toque. No print
 *  o CSS força o painel aberto, então o relatório sai íntegro. */
export function ResumoJornadaSection({
  resumo,
  encerramento,
  compacta = false,
}: {
  resumo: ResumoJornada;
  /** Quando já decidido, carimba quem fechou e quando. */
  encerramento: Encerramento | null;
  /** modo enxuto pra quando a retrospectiva ocupa o papel de destaque */
  compacta?: boolean;
}) {
  const cabecalho = (
    <>
      <p className="mt-2 text-sm font-medium">
        {resumo.mentorNome} e {resumo.mentoradoNome}
      </p>
      <p className="text-xs text-muted-foreground">
        Trilha {TRILHA_LABEL[resumo.trilha]} · início{" "}
        {formatDate(resumo.inicio)}
        {resumo.fim
          ? ` · encerramento ${formatDate(resumo.fim)}`
          : resumo.status === "concluida" || resumo.status === "encerrada"
            ? " · jornada fechada"
            : " · em andamento"}
      </p>
    </>
  );

  const corpo = (
    <>
      <dl className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-5">
        <div className="rounded-lg bg-muted/40 px-3 py-2.5">
          <dt className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            Encontros
          </dt>
          <dd className="mt-0.5 font-mono text-sm tabular-nums">
            {resumo.realizados} de {resumo.total}
          </dd>
          {resumo.esperados != null && (
            <dd className="text-xs text-muted-foreground">
              esperados: {resumo.esperados}
            </dd>
          )}
        </div>
        <div className="rounded-lg bg-muted/40 px-3 py-2.5">
          <dt className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            Avaliação do mentor
          </dt>
          <dd className="mt-0.5 font-mono text-sm tabular-nums">
            {resumo.mediaAvaliacao != null
              ? `${resumo.mediaAvaliacao.toFixed(1)}/4`
              : "—"}
          </dd>
          {resumo.mediaAvaliacao != null && (
            <dd className="text-xs text-muted-foreground">
              {mediaAvaliacaoLabel(resumo.mediaAvaliacao).toLowerCase()}
            </dd>
          )}
        </div>
        {/* young-person tile (REALIZA-71): media+n in print; temas and
            trajectory are qualitative — screen only, off the report */}
        {resumo.avaliacaoJovem && (
          <div className="rounded-lg bg-muted/40 px-3 py-2.5">
            <dt className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              Avaliação do jovem
            </dt>
            <dd className="mt-0.5 font-mono text-sm tabular-nums">
              {resumo.avaliacaoJovem.media != null
                ? `${resumo.avaliacaoJovem.media.toFixed(1)}/5`
                : `${resumo.avaliacaoJovem.n}×`}
            </dd>
            <dd className="text-xs text-muted-foreground">
              {resumo.avaliacaoJovem.media != null
                ? `média de ${resumo.avaliacaoJovem.n} ${
                    resumo.avaliacaoJovem.n === 1
                      ? "avaliação"
                      : "avaliações"
                  }`
                : "média a partir de 3 avaliações"}
            </dd>
            {resumo.avaliacaoJovem.trajetoria && (
              <dd className="text-xs text-muted-foreground print:hidden">
                1º→último: {resumo.avaliacaoJovem.trajetoria.primeiro}★ →{" "}
                {resumo.avaliacaoJovem.trajetoria.ultimo}★
              </dd>
            )}
            {resumo.avaliacaoJovem.temasTop.length > 0 && (
              <dd className="mt-1 flex flex-wrap gap-1 print:hidden">
                {resumo.avaliacaoJovem.temasTop.map((t) => (
                  <Badge key={t} variant="outline" className="text-[10px]">
                    {TEMA_AVALIACAO_LABEL[t] ?? t}
                  </Badge>
                ))}
              </dd>
            )}
          </div>
        )}
        <div className="rounded-lg bg-muted/40 px-3 py-2.5">
          <dt className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            Combinados
          </dt>
          <dd className="mt-0.5 font-mono text-sm tabular-nums">
            {resumo.combinadosFeitos} de {resumo.combinadosTotal}
          </dd>
          <dd className="text-xs text-muted-foreground">cumpridos</dd>
        </div>
        <div className="rounded-lg bg-muted/40 px-3 py-2.5">
          <dt className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            Registros
          </dt>
          <dd className="mt-0.5 font-mono text-sm tabular-nums">
            {resumo.ultimosRegistros.length}
            {resumo.realizados > resumo.ultimosRegistros.length &&
              ` de ${resumo.realizados}`}
          </dd>
          <dd className="text-xs text-muted-foreground">últimos abaixo</dd>
        </div>
        {resumo.pdm && (
          <div className="rounded-lg bg-muted/40 px-3 py-2.5">
            <dt className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              Metas do PDM
            </dt>
            <dd className="mt-0.5 font-mono text-sm tabular-nums">
              {resumo.pdm.atingidas} de {resumo.pdm.total}
            </dd>
            <dd className="text-xs text-muted-foreground">atingidas</dd>
          </div>
        )}
      </dl>

      {resumo.pdm && resumo.pdm.atingidasLista.length > 0 && (
        <ul className="mt-3 space-y-1 border-t pt-3 text-xs text-muted-foreground">
          {resumo.pdm.atingidasLista.map((m, i) => (
            <li key={i} className="flex flex-wrap items-baseline gap-x-2">
              <span aria-hidden className="text-[var(--ok)]">✓</span>
              <span className="min-w-0 flex-1">{m.titulo}</span>
              {m.atingidaEm && (
                <span>atingida em {formatDate(m.atingidaEm)}</span>
              )}
            </li>
          ))}
        </ul>
      )}

      {resumo.ultimosRegistros.length > 0 && (
        <ul className="mt-3 space-y-1 border-t pt-3 text-xs text-muted-foreground">
          {resumo.ultimosRegistros.map((u) => (
            <li key={u.numero} className="flex flex-wrap items-baseline gap-x-2">
              <span className="font-mono tabular-nums">{u.numero}º</span>
              <span>{formatDate(u.data)}</span>
              {u.tema && <span className="min-w-0 flex-1">· {u.tema}</span>}
              {u.avaliacao && (
                <span>· avaliação {AVALIACAO_LABEL[u.avaliacao].toLowerCase()}</span>
              )}
            </li>
          ))}
        </ul>
      )}

      <p className="mt-3 text-xs text-muted-foreground">
        {encerramento && encerramentoDecidido(encerramento)
          ? `Encerramento registrado por ${encerramento.decidido?.nome ?? "a coordenação"} em ${formatDate(encerramento.created_at)}. Este resumo foi gerado dos dados da jornada.`
          : "Gerado dos dados da jornada. Serve de base pro relatório final do ciclo."}
      </p>
    </>
  );

  if (compacta) {
    return (
      <section
        aria-label="Resumo da jornada"
        className="resumo-jornada rounded-xl bg-card p-4 shadow-[var(--shadow-border)] print:shadow-none"
      >
        <Collapsible.Root>
          <div className="flex items-center justify-between gap-2">
            <h2 className="flex items-center gap-2 text-base font-semibold">
              <span aria-hidden className="size-1.5 rounded-full bg-[var(--brand-lime)]" />
              Resumo da jornada
            </h2>
            <ImprimirButton />
          </div>
          <p className="mt-1.5 text-xs text-muted-foreground">
            {resumo.mentorNome} e {resumo.mentoradoNome} · Trilha{" "}
            {TRILHA_LABEL[resumo.trilha]} · início {formatDate(resumo.inicio)}
            {resumo.fim
              ? ` · encerramento ${formatDate(resumo.fim)}`
              : resumo.status === "concluida" || resumo.status === "encerrada"
                ? " · jornada fechada"
                : " · em andamento"}
          </p>
          <Collapsible.Trigger className="group -mx-2 mt-1 flex min-h-11 w-[calc(100%+1rem)] cursor-pointer items-center gap-1.5 rounded-lg px-2 py-2 text-left text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring print:hidden">
            Ver os dados completos
            <CaretDown
              size={14}
              aria-hidden
              className="transition-transform group-data-[panel-open]:rotate-180"
            />
          </Collapsible.Trigger>
          <Collapsible.Panel
            hiddenUntilFound
            className="h-[var(--collapsible-panel-height)] overflow-hidden transition-[height] duration-150 data-ending-style:h-0 data-starting-style:h-0 [&[hidden]:not([hidden='until-found'])]:hidden"
          >
            {corpo}
          </Collapsible.Panel>
        </Collapsible.Root>
      </section>
    );
  }

  return (
    <section
      aria-label="Resumo da jornada"
      className="resumo-jornada rounded-xl bg-card p-4 shadow-[var(--shadow-border)] print:shadow-none"
    >
      <div className="flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-base font-semibold">
          <span aria-hidden className="size-1.5 rounded-full bg-[var(--brand-lime)]" />
          Resumo da jornada
        </h2>
        <ImprimirButton />
      </div>
      {cabecalho}
      {corpo}
    </section>
  );
}
