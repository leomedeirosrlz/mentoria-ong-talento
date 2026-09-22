import { FlagCheckered } from "@phosphor-icons/react/dist/ssr";
import { formatDate } from "@/lib/ciclo";
import type { SolicitacaoEspecialista } from "@/lib/types";

/** Devolutiva da trilha de especialista na ficha da dupla DPP — o que a
 *  mentoria especializada devolve pro PDM do jovem (guia: metas alcançadas,
 *  encaminhamentos em aberto, recomendações). Vem da view do mural: o mentor
 *  DPP não lê a dupla de especialista, lê a solicitação que ele abriu. */
export function DevolutivaEspecialista({
  solicitacao,
}: {
  solicitacao: SolicitacaoEspecialista | null;
}) {
  if (!solicitacao?.devolutiva_pdm) return null;
  return (
    <section className="rounded-xl bg-card p-4 text-sm space-y-2 shadow-[var(--shadow-border)]">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          Devolutiva do especialista
        </h2>
        <FlagCheckered
          size={14}
          aria-hidden
          className="text-[var(--ok-text)]"
        />
      </div>
      <p className="text-xs text-muted-foreground">
        {solicitacao.especialista?.nome ?? "O especialista"} fechou a trilha
        {solicitacao.trilha_encerrada_em &&
          ` em ${formatDate(solicitacao.trilha_encerrada_em)}`}{" "}
        — é o que segue pro PDM de {solicitacao.mentorado?.nome ?? "o jovem"}:
      </p>
      <blockquote className="rounded-lg border-l-2 border-[var(--brand-lime)] bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
        <p className="whitespace-pre-line">{solicitacao.devolutiva_pdm}</p>
      </blockquote>
    </section>
  );
}
