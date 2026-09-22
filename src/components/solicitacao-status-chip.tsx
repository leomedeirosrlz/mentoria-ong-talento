import { Badge } from "@/components/ui/badge";
import type { SolicitacaoEspecialista } from "@/lib/types";

/** Chip do header da ficha DPP: onde a solicitação de especialista está.
 *  "aberta" pede atenção (ninguém assumiu ainda); "aceita" informa quem
 *  assumiu — sem link, porque a dupla de especialista é do especialista e a
 *  RLS não deixa o mentor DPP abri-la. Quando a trilha fecha, o chip conta
 *  que a devolutiva chegou — o texto mora na lateral da ficha. "cancelada"
 *  (e a ausência de solicitação) não renderizam: passado não é status. */
export function SolicitacaoStatusChip({
  solicitacao,
}: {
  solicitacao: SolicitacaoEspecialista | null;
}) {
  if (!solicitacao || solicitacao.status === "cancelada") return null;
  if (solicitacao.status === "aberta") {
    return (
      <Badge
        variant="outline"
        className="border-[var(--warn)]/60 text-[var(--warn-text)]"
      >
        Especialista solicitado
      </Badge>
    );
  }
  if (solicitacao.trilha_encerrada_em) {
    return (
      <Badge
        variant="outline"
        className="border-[var(--ok)]/60 text-[var(--ok-text)]"
      >
        Especialista: {solicitacao.especialista?.nome ?? "a definir"} · trilha
        encerrada
      </Badge>
    );
  }
  return (
    <Badge
      variant="outline"
      className="border-[var(--ok)]/60 text-[var(--ok-text)]"
    >
      Especialista: {solicitacao.especialista?.nome ?? "a definir"}
    </Badge>
  );
}
