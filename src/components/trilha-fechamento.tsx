import Link from "next/link";
import { FlagCheckered, Star } from "@phosphor-icons/react/dist/ssr";
import { formatDateTime } from "@/lib/ciclo";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import type { Dupla } from "@/lib/types";
import type { AvaliacaoEspDupla } from "@/lib/queries-especialista";

/** Fechamento registrado da trilha de especialista — motivo + devolutiva pro
 *  PDM + carimbo. Visível pra quem abre a ficha da dupla de especialista
 *  (o próprio especialista e a coordenação — o mentor DPP lê a devolutiva
 *  pela solicitação, na ficha da dupla dele). */
export function TrilhaFechamento({
  dupla,
  avaliacao,
}: {
  dupla: Pick<
    Dupla,
    "status" | "encerrada_em" | "motivo_encerramento" | "devolutiva_pdm"
  >;
  /** estado do link da avaliação geral (0104) — token só presente pro
   *  especialista da trilha; a coord recebe o status. */
  avaliacao?: AvaliacaoEspDupla | null;
}) {
  if (!dupla.encerrada_em) return null;
  return (
    <section className="rounded-xl bg-card p-4 text-sm space-y-3 shadow-[var(--shadow-border)]">
      <div className="flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          <span aria-hidden className="size-1.5 rounded-full bg-[var(--info)]" />
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
      {/* avaliação geral (0104): a notificação pode se perder — a ficha é o
          caminho de volta pro link (token só vem pro especialista) e o
          estado visível pra coord */}
      {avaliacao &&
        (avaliacao.respondido ? (
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Star size={12} weight="fill" className="text-[var(--warn)]" aria-hidden />
            Avaliação geral respondida em {formatDateTime(avaliacao.respondido_em)}
          </p>
        ) : avaliacao.token ? (
          <Link
            href={`/f/${avaliacao.token}`}
            className={buttonVariants({ size: "sm" })}
          >
            <Star size={14} aria-hidden />
            Responder a avaliação geral
          </Link>
        ) : (
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Star size={12} className="text-muted-foreground" aria-hidden />
            Avaliação geral do especialista: pendente — o link seguiu por
            notificação
          </p>
        ))}
      <p className="text-xs text-muted-foreground">
        Registrado em {formatDateTime(dupla.encerrada_em)}
      </p>
    </section>
  );
}
