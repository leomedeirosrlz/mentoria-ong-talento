import Link from "next/link";
import { CalendarPlus, Flag, Warning } from "@phosphor-icons/react/dist/ssr";
import { formatDate, formatDateTime } from "@/lib/ciclo";
import type { PlanoEmDia } from "@/lib/plano-em-dia";
import type { Dupla } from "@/lib/types";
import { cn } from "@/lib/utils";
import { AgendarEncontroDialog } from "@/components/agendar-encontro-dialog";
import { Button, buttonVariants } from "@/components/ui/button";

/** "Para ficar em dia" card (REALIZA-397) — the plan's decision layer on the
 *  Agora tab. It's journey, not alert: lives on `--destaque` tint and each
 *  step carries the plan's suggested date. The mentor schedules/reschedules
 *  inline (the dialog already validates reason and rescheduling); coordination
 *  and supervision read the same plan with no CTA — the pair schedules, staff
 *  follows up and nudges. */
export function PlanoEmDiaCard({
  plano,
  dupla,
  souMentor,
  jovemNome,
}: {
  plano: Extract<PlanoEmDia, { aplicavel: true }>;
  dupla: Dupla;
  souMentor: boolean;
  jovemNome: string;
}) {
  const podeAgendar = souMentor && dupla.status === "ativa";

  return (
    <section
      aria-labelledby="plano-em-dia"
      className="rounded-xl border border-[var(--destaque)]/50 bg-[var(--destaque)]/[0.06] p-4 shadow-[var(--shadow-border)]"
    >
      <h2 id="plano-em-dia" className="text-base font-semibold">
        Para ficar em dia
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Plano sugerido: dois encontros na mesma semana quando couber, com
        pelo menos dois dias entre eles. As datas são sugestões, vocês
        ajustam na hora de marcar.
      </p>

      {plano.pendenciasRegistro.length > 0 && (
        <div className="mt-3 rounded-lg bg-card px-3.5 py-3 shadow-[var(--shadow-inset)]">
          <p className="text-xs font-semibold text-foreground">
            Antes de seguir o plano
          </p>
          <ul className="mt-1.5 space-y-1.5">
            {plano.pendenciasRegistro.map((p) => (
              <li
                key={p.encontroId}
                className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm"
              >
                <span className="text-muted-foreground">
                  {p.numero}º encontro{" "}
                  {p.estado === "limbo"
                    ? `marcado pra ${formatDateTime(p.dataHora)}, ainda sem confirmação`
                    : "realizado, ainda sem registro"}
                  .
                </span>
                {podeAgendar && (
                  <Link
                    href={`?aba=encontros#registrar-${p.encontroId}`}
                    className={buttonVariants({ variant: "outline", size: "sm" })}
                  >
                    {p.estado === "limbo" ? "Confirmar" : "Registrar"}
                  </Link>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      <ol className="mt-3 space-y-2.5">
        {plano.passos.map((p) => {
          const encontro = p.encontroId
            ? (dupla.encontros.find((e) => e.id === p.encontroId) ?? null)
            : null;
          return (
            <li key={p.numero} className="flex items-start gap-3">
              <span
                aria-hidden
                className={cn(
                  "grid size-8 shrink-0 place-items-center rounded-full font-mono text-xs font-semibold tabular-nums",
                  p.acao === "travado"
                    ? "bg-[var(--brand-lime)]/20 text-foreground ring-1 ring-[var(--brand-lime)]/60"
                    : "bg-[var(--destaque)]/25 text-foreground"
                )}
              >
                {p.numero}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline gap-x-2">
                  <p className="text-sm font-semibold">{p.titulo}</p>
                  <p className="text-xs text-muted-foreground">
                    {p.acao === "travado" ? (
                      <>marcado pra {formatDate(p.data)}</>
                    ) : (
                      <>
                        sugestão {formatDate(p.data)}
                        {p.dataOficial !== p.data && (
                          <> · oficial era {formatDate(p.dataOficial)}</>
                        )}
                      </>
                    )}
                  </p>
                </div>
                {p.precondicao && (
                  <p className="mt-0.5 flex items-start gap-1 text-xs text-muted-foreground">
                    <Flag size={12} aria-hidden className="mt-0.5 shrink-0" />
                    Precisa antes: {p.precondicao}
                  </p>
                )}
                {p.aviso && (
                  <p className="mt-0.5 flex items-start gap-1 text-xs text-muted-foreground">
                    <Warning size={12} aria-hidden className="mt-0.5 shrink-0" />
                    {p.aviso}
                  </p>
                )}
              </div>
              {p.acao !== "travado" && podeAgendar && (
                <AgendarEncontroDialog
                  duplaId={dupla.id}
                  numero={p.numero}
                  atual={encontro}
                  sugerido={p.acao === "agendar" ? p.data : undefined}
                  proposta={p.acao === "remarcar" ? p.data : undefined}
                  piso={dupla.iniciada_em ?? undefined}
                  jovemNome={jovemNome}
                  trigger={
                    <Button
                      variant="outline"
                      size="sm"
                      className="min-h-11 sm:min-h-0"
                    >
                      <CalendarPlus aria-hidden />
                      {p.acao === "remarcar" ? "Remarcar" : "Agendar"}
                    </Button>
                  }
                />
              )}
            </li>
          );
        })}
      </ol>

      {plano.dataRecuperacao && (
        <p className="mt-3 border-t border-[var(--destaque)]/30 pt-3 text-sm">
          Com esse plano, vocês ficam em dia em{" "}
          <strong>{formatDate(plano.dataRecuperacao)}</strong>.
        </p>
      )}
      {plano.avisos.length > 0 && (
        <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
          {plano.avisos.map((a) => (
            <li key={a} className="flex items-start gap-1.5">
              <Warning size={14} aria-hidden className="mt-0.5 shrink-0" />
              {a}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
