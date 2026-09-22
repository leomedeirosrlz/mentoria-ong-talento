import { formatDate } from "@/lib/ciclo";
import type { Supervisao } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { SupervisaoDeleteButton } from "./supervisao-delete-button";

/** Lista de sessões de supervisão — a gramática das seções de ficha (card +
 *  overline). `visao` decide quem a linha nomeia: "supervisor" lê "com
 *  {mentor}" (home do supervisor, ficha de supervisor); "mentor" lê "por
 *  {supervisor}" (ficha da dupla, ficha do mentor). `duplaAtualId` suprime o
 *  selo de contexto quando a sessão já é da dupla que a página mostra —
 *  sessão sem vínculo carrega "sessão geral". */
export function SupervisoesSection({
  itens,
  visao,
  duplaAtualId,
  titulo = "Supervisão",
  descricao,
  acao,
  podeExcluir = false,
}: {
  itens: Supervisao[];
  visao: "supervisor" | "mentor";
  /** Id da dupla da página — o selo de contexto só aparece pra OUTRA dupla. */
  duplaAtualId?: string;
  titulo?: string;
  descricao?: string;
  /** Ação no topo da seção — o dialog de registro, quando cabe ao papel. */
  acao?: React.ReactNode;
  /** coordenação modera — o delete é só dela (RLS). */
  podeExcluir?: boolean;
}) {
  return (
    <section className="rounded-xl bg-card p-4 text-sm shadow-[var(--shadow-border)]">
      <div className="mb-1 flex items-center justify-between gap-2">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          {titulo}
        </h2>
        {acao}
      </div>
      {descricao && (
        <p className="mb-2 text-xs text-muted-foreground">{descricao}</p>
      )}
      {itens.length === 0 ? (
        <p className="text-muted-foreground">Nenhuma sessão registrada ainda.</p>
      ) : (
        <ul className="divide-y divide-border/60">
          {itens.map((s) => {
            const contexto =
              s.dupla_id == null
                ? "sessão geral"
                : s.dupla_id !== duplaAtualId && s.dupla?.mentorado?.nome
                  ? `dupla com ${s.dupla.mentorado.nome}`
                  : null;
            return (
              <li key={s.id} className="py-2.5 first:pt-1.5 last:pb-0">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-medium">{formatDate(s.data)}</p>
                  <span className="flex items-center gap-1.5">
                    {contexto && (
                      <Badge variant="secondary" className="font-normal">
                        {contexto}
                      </Badge>
                    )}
                    {podeExcluir && <SupervisaoDeleteButton id={s.id} />}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  {visao === "supervisor"
                    ? `com ${s.mentor?.nome ?? "mentor"}`
                    : `por ${s.supervisor?.nome ?? "supervisor"}`}
                </p>
                <p className="mt-1 whitespace-pre-line text-muted-foreground">
                  {s.resumo}
                </p>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
