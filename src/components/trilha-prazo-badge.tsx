import { CalendarCheck, HourglassMedium } from "@phosphor-icons/react/dist/ssr";
import { formatDate } from "@/lib/ciclo";
import { prazoTrilhaEspecialista } from "@/lib/encerramento";
import { Badge } from "@/components/ui/badge";
import type { Dupla } from "@/lib/types";

/** Marco de 3 meses da trilha de especialista (0073). Não é prazo de
 *  execução: completar 3 meses não trava agenda nem encerra a trilha — é
 *  o ponto do guia em que faz sentido fechar quando o foco foi cumprido
 *  (a estagnação real acende no semáforo). Em curso mostra "Nº mês de 3";
 *  passado o marco vira warn sugerindo o fechamento; trilha fechada mostra
 *  o carimbo. Sem iniciada_em não renderiza — não inventa marco. */
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
  if (prazo.estado === "passou") {
    return (
      <Badge
        variant="outline"
        className="border-[var(--warn)]/60 text-[var(--warn-text)]"
        title="O guia prevê ~3 meses de trilha — se o foco já foi cumprido, é hora de fechar com devolutiva."
      >
        <CalendarCheck size={12} aria-hidden />
        3 meses completos · guia sugere fechar
      </Badge>
    );
  }
  const mes = Math.min(3, Math.floor(prazo.diasDecorridos / 30) + 1);
  return (
    <Badge variant="outline" className="border-border text-muted-foreground">
      <HourglassMedium size={12} aria-hidden />
      {mes}º mês de 3
    </Badge>
  );
}
