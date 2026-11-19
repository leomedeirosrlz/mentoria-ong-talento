import { Check, LockSimple } from "@phosphor-icons/react/dist/ssr";
import { Badge } from "@/components/ui/badge";
import type { EstacaoPainelEstado } from "@/lib/jornada";

// Badge do estado de uma estação por dupla — compartilhado entre a página
// por instrumento (linhas) e os cards da régua do mentor (REALIZA-440),
// pra que "respondido"/"link enviado"/"link expirado" leiam igual nas
// duas superfícies. Server-safe (Badge + ícones ssr).

export function BadgeEstado({ estado }: { estado: EstacaoPainelEstado }) {
  switch (estado) {
    case "respondido":
      return (
        <Badge className="bg-[var(--ok)]/15 text-[var(--ok-text)]">
          <Check size={11} weight="bold" data-icon="inline-start" aria-hidden />
          respondido
        </Badge>
      );
    case "pendente":
      return (
        <Badge className="bg-[var(--warn)]/15 text-[var(--warn-text)]">
          link enviado
        </Badge>
      );
    case "expirado":
      return <Badge variant="secondary">link expirado</Badge>;
    case "trancada":
      return (
        <Badge
          variant="outline"
          className="bg-muted text-xs font-medium text-muted-foreground"
        >
          <LockSimple size={11} data-icon="inline-start" aria-hidden />
          ainda não abriu
        </Badge>
      );
    default:
      return <Badge variant="secondary">não enviado</Badge>;
  }
}
