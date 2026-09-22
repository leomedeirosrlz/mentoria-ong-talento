import { CalendarX, HourglassMedium } from "@phosphor-icons/react/dist/ssr";
import { formatDate } from "@/lib/ciclo";
import { prazoTrilhaEspecialista } from "@/lib/encerramento";
import { Badge } from "@/components/ui/badge";
import type { Dupla } from "@/lib/types";

/** Prazo da trilha de especialista — 3 meses a partir do início da dupla
 *  (iniciada_em, carimbada no aceite — não existe campo de aceite separado).
 *  Urgência (<2 semanas) vira warn; prazo estourado vira danger; trilha
 *  fechada mostra o carimbo. Sem iniciada_em não renderiza — não inventa prazo. */
export function TrilhaPrazoBadge({
  dupla,
}: {
  dupla: Pick<Dupla, "iniciada_em" | "encerrada_em" | "status">;
}) {
  if (dupla.encerrada_em) {
    return (
      <Badge
        variant="outline"
        className="border-border text-muted-foreground"
      >
        trilha encerrada em {formatDate(dupla.encerrada_em)}
      </Badge>
    );
  }
  const prazo = prazoTrilhaEspecialista(dupla.iniciada_em);
  if (!prazo) return null;
  if (prazo.estado === "vencido") {
    return (
      <Badge
        variant="outline"
        className="border-[var(--danger)]/60 text-[var(--danger)]"
      >
        <CalendarX size={12} aria-hidden />
        prazo de 3 meses venceu {formatDate(prazo.fim)}
      </Badge>
    );
  }
  if (prazo.estado === "urgente") {
    return (
      <Badge
        variant="outline"
        className="border-[var(--warn)]/60 text-[var(--warn-text)]"
      >
        <HourglassMedium size={12} aria-hidden />
        {prazo.diasRestantes}d pra fechar — até {formatDate(prazo.fim)}
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="border-border text-muted-foreground">
      <HourglassMedium size={12} aria-hidden />
      até {formatDate(prazo.fim)}
    </Badge>
  );
}
