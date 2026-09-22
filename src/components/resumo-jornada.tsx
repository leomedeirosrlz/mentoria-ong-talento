import { AVALIACAO_LABEL, formatDate, TRILHA_LABEL } from "@/lib/ciclo";
import { mediaAvaliacaoLabel, type ResumoJornada } from "@/lib/encerramento";
import { ImprimirButton } from "@/components/imprimir-button";
import type { Encerramento } from "@/lib/types";

/** "Resumo da jornada" — o bloco print-friendly da ficha, gerado dos dados
 *  (não é campo livre): mentor/mentorado, encontros realizados vs. esperados,
 *  avaliação média, últimos registros e combinados. É a base do relatório
 *  final do guia — no print o CSS isola este bloco. */
export function ResumoJornadaSection({
  resumo,
  encerramento,
}: {
  resumo: ResumoJornada;
  /** Quando já decidido, carimba quem fechou e quando. */
  encerramento: Encerramento | null;
}) {
  return (
    <section
      aria-label="Resumo da jornada"
      className="resumo-jornada rounded-xl bg-card p-4 shadow-[var(--shadow-border)] print:shadow-none"
    >
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          Resumo da jornada
        </h2>
        <ImprimirButton />
      </div>

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

      <dl className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
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
            Avaliação média
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
      </dl>

      {resumo.ultimosRegistros.length > 0 && (
        <ul className="mt-3 space-y-1 border-t pt-3 text-xs text-muted-foreground">
          {resumo.ultimosRegistros.map((u) => (
            <li key={u.numero} className="flex flex-wrap items-baseline gap-x-2">
              <span className="font-mono tabular-nums">{u.numero}º</span>
              <span>{formatDate(u.data)}</span>
              {u.tema && <span className="min-w-0 flex-1">— {u.tema}</span>}
              {u.avaliacao && (
                <span>· avaliação {AVALIACAO_LABEL[u.avaliacao].toLowerCase()}</span>
              )}
            </li>
          ))}
        </ul>
      )}

      <p className="mt-3 text-xs text-muted-foreground">
        {encerramento?.tipo
          ? `Encerramento registrado por ${encerramento.decidido?.nome ?? "a coordenação"} em ${formatDate(encerramento.created_at)} — este resumo foi gerado dos dados da jornada.`
          : "Gerado dos dados da jornada — serve de base pro relatório final do ciclo."}
      </p>
    </section>
  );
}
