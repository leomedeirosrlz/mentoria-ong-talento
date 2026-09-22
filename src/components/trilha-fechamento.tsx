import { FlagCheckered } from "@phosphor-icons/react/dist/ssr";
import { formatDateTime } from "@/lib/ciclo";
import { Badge } from "@/components/ui/badge";
import type { Dupla } from "@/lib/types";

/** Fechamento registrado da trilha de especialista — motivo + devolutiva pro
 *  PDM + carimbo. Visível pra quem abre a ficha da dupla de especialista
 *  (o próprio especialista e a coordenação — o mentor DPP lê a devolutiva
 *  pela solicitação, na ficha da dupla dele). */
export function TrilhaFechamento({
  dupla,
}: {
  dupla: Pick<
    Dupla,
    "status" | "encerrada_em" | "motivo_encerramento" | "devolutiva_pdm"
  >;
}) {
  if (!dupla.encerrada_em) return null;
  return (
    <section className="rounded-xl bg-card p-4 text-sm space-y-3 shadow-[var(--shadow-border)]">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          Fechamento da trilha
        </h2>
        <Badge
          variant="outline"
          className={
            dupla.status === "concluida"
              ? "border-[var(--ok)]/60 text-[var(--ok-text)]"
              : "border-[var(--warn)]/60 text-[var(--warn-text)]"
          }
        >
          <FlagCheckered size={12} aria-hidden />
          {dupla.status === "concluida" ? "Trilha concluída" : "Trilha encerrada"}
        </Badge>
      </div>
      {dupla.motivo_encerramento && (
        <p className="text-xs text-muted-foreground">
          <span className="font-medium text-foreground">Motivo: </span>
          {dupla.motivo_encerramento}
        </p>
      )}
      {dupla.devolutiva_pdm && (
        <blockquote className="rounded-lg border-l-2 border-[var(--brand-lime)] bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
          <p className="mb-1 font-medium text-foreground">Devolutiva pro PDM</p>
          <p className="whitespace-pre-line">{dupla.devolutiva_pdm}</p>
        </blockquote>
      )}
      <p className="text-xs text-muted-foreground">
        Registrado em {formatDateTime(dupla.encerrada_em)}
      </p>
    </section>
  );
}
