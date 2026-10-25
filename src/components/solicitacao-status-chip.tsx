import { Badge } from "@/components/ui/badge";
import type { SolicitacaoEspecialista } from "@/lib/types";

/** Chip do header da ficha DPP: onde a solicitação de especialista está.
 *  Os estados pedem resposta honesta — "aberta" pede atenção (ninguém
 *  assumiu), "aguardando_coord" diz com quem a bola está, "contra_proposta"
 *  avisa que há horário na mesa, "aceita" informa quem assumiu — sem link,
 *  porque a dupla de especialista é do especialista e a RLS não deixa o
 *  mentor DPP abri-la. Quando a trilha fecha, o chip conta que a devolutiva
 *  chegou — o texto mora na lateral da ficha. "cancelada" (e a ausência de
 *  solicitação) não renderizam; "recusada"/"expirada" contam o que houve
 *  porque o pedido pode merecer nova tentativa. */
export function SolicitacaoStatusChip({
  solicitacao,
}: {
  solicitacao: SolicitacaoEspecialista | null;
}) {
  if (!solicitacao) return null;
  const efetivo = solicitacao.status_efetivo ?? solicitacao.status;
  if (efetivo === "cancelada") return null;

  const quem =
    solicitacao.especialista?.nome ??
    solicitacao.desejado?.nome ??
    "a definir";

  // a trilha fechou → a devolutiva chegou ao PDM; vale pro status aceita
  if (efetivo === "aceita" && solicitacao.trilha_encerrada_em) {
    return (
      <Badge
        variant="outline"
        className="border-[var(--ok)]/60 text-[var(--ok-text)]"
      >
        Especialista: {quem} · trilha encerrada
      </Badge>
    );
  }

  switch (efetivo) {
    case "aberta":
      return (
        <Badge
          variant="outline"
          className="border-[var(--warn)]/60 text-[var(--warn-text)]"
        >
          {solicitacao.origem === "jovem"
            ? "Especialista pedido pelo jovem"
            : "Especialista solicitado"}
        </Badge>
      );
    case "sugerida":
      // WP6: a sugestão do mentor espera a resposta do jovem — ainda não é
      // pedido (não entra na mesa nem nos tetos). Neutro: é espera, não
      // alerta — laranja fica pra atenção da dupla
      return (
        <Badge
          variant="outline"
          className="border-[var(--pausa-border)] bg-[var(--pausa-bg)] text-[var(--pausa-text)]"
        >
          Sugestão com o jovem
        </Badge>
      );
    case "aguardando_coord":
      return (
        <Badge
          variant="outline"
          className="border-[var(--warn)]/60 text-[var(--warn-text)]"
        >
          Pedido com a coordenação
        </Badge>
      );
    case "contra_proposta":
      return (
        <Badge
          variant="outline"
          className="border-[var(--warn)]/60 text-[var(--warn-text)]"
        >
          Negociando horário{quem !== "a definir" ? ` com ${quem}` : ""}
        </Badge>
      );
    case "aceita":
      return (
        <Badge
          variant="outline"
          className="border-[var(--ok)]/60 text-[var(--ok-text)]"
        >
          Especialista: {quem}
        </Badge>
      );
    case "recusada":
      return (
        <Badge variant="outline" className="text-muted-foreground">
          Pedido recusado{quem !== "a definir" ? ` por ${quem}` : ""}
        </Badge>
      );
    case "expirada":
      return (
        <Badge variant="outline" className="text-muted-foreground">
          Horário expirado
        </Badge>
      );
    default:
      return null;
  }
}
