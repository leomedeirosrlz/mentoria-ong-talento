import { FlagCheckered } from "@phosphor-icons/react/dist/ssr";
import { formatDate } from "@/lib/ciclo";
import type { SolicitacaoEspecialista } from "@/lib/types";

/** Devolutivas das trilhas de especialista na ficha da dupla DPP — o que cada
 *  mentoria especializada devolveu pro PDM do jovem (guia: metas alcançadas,
 *  encaminhamentos em aberto, recomendações). Um mentorado pode passar por
 *  mais de uma trilha no ciclo — cada solicitação fechada vira um bloco com
 *  especialista, data e texto. Vem da view do mural: o mentor DPP não lê a
 *  dupla de especialista, lê a solicitação que ele abriu. */
export function DevolutivaEspecialista({
  solicitacoes,
}: {
  solicitacoes: SolicitacaoEspecialista[];
}) {
  const devolutivas = solicitacoes.filter((s) => s.devolutiva_pdm);
  if (!devolutivas.length) return null;
  return (
    <section className="rounded-xl bg-card p-4 text-sm space-y-4 shadow-[var(--shadow-border)]">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          {devolutivas.length > 1
            ? "Devolutivas de especialistas"
            : "Devolutiva do especialista"}
        </h2>
        <FlagCheckered
          size={14}
          aria-hidden
          className="text-[var(--ok-text)]"
        />
      </div>
      {devolutivas.map((s) => (
        <div key={s.id} className="space-y-2">
          <p className="text-xs text-muted-foreground">
            <span className="font-medium text-foreground">
              {s.especialista?.nome ?? "O especialista"}
            </span>{" "}
            fechou a trilha
            {s.trilha_encerrada_em &&
              ` em ${formatDate(s.trilha_encerrada_em)}`}
            . É o que segue pro PDM:
          </p>
          <blockquote className="rounded-lg border-l-2 border-[var(--brand-lime)] bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
            <p className="whitespace-pre-line">{s.devolutiva_pdm}</p>
          </blockquote>
        </div>
      ))}
    </section>
  );
}
