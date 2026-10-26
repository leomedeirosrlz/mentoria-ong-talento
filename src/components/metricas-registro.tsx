import { fmtDuracaoMs, type MetricasRegistro } from "@/lib/metricas-registro";

/** Telemetria do form de registro (REALIZA-217, fase 1 — medir antes de
 *  redesenhar): a coordenação lê aqui quanto tempo o preenchimento leva e
 *  quantas sessões morrem no meio, nos últimos 30 dias. Só renderiza com
 *  dados — página ainda sem telemetria não ganha cromo. */
export function MetricasRegistroCard({
  metricas,
}: {
  metricas: MetricasRegistro;
}) {
  const { total, pctConcluidas, medianaMs, pctMobile } = metricas;
  if (total === 0) return null;
  return (
    <section
      aria-label="Tempo de preenchimento do registro"
      className="rounded-xl bg-card px-4 py-3.5 shadow-[var(--shadow-border)]"
    >
      <h2 className="text-sm font-semibold">
        Tempo de preenchimento{" "}
        <span className="font-normal text-muted-foreground">
          · últimos 30 dias
        </span>
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        {medianaMs != null && (
          <>
            mediana{" "}
            <b className="font-semibold text-foreground tabular-nums">
              {fmtDuracaoMs(medianaMs)}
            </b>
            {" · "}
          </>
        )}
        {pctConcluidas != null && (
          <>
            <b className="font-semibold text-foreground tabular-nums">
              {pctConcluidas}%
            </b>{" "}
            concluídos
            {" · "}
          </>
        )}
        {total} {total === 1 ? "tentativa" : "tentativas"}
        {pctMobile != null && (
          <>
            {" · "}
            <b className="font-semibold text-foreground tabular-nums">
              {pctMobile}%
            </b>{" "}
            no celular
          </>
        )}
      </p>
    </section>
  );
}
