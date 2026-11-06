// Pill de status do cronograma — usada pelo editor (/turmas/[id]) e pelos
// cards/hub de turma; antes morava no cronograma-editor e a home puxava o
// editor inteiro só pra badge.

import type { Cronograma } from "@/lib/types";
import { Badge } from "@/components/ui/badge";

export const CRONOGRAMA_STATUS_LABEL: Record<Cronograma["status"], string> = {
  rascunho: "Rascunho",
  ativo: "Ativo",
  encerrado: "Encerrado",
};

const STATUS_BADGE: Record<Cronograma["status"], string> = {
  rascunho: "border-dashed",
  ativo: "",
  encerrado: "",
};

export function StatusBadge({ status }: { status: Cronograma["status"] }) {
  return (
    <Badge
      variant={status === "ativo" ? "secondary" : "outline"}
      className={STATUS_BADGE[status]}
    >
      {CRONOGRAMA_STATUS_LABEL[status]}
    </Badge>
  );
}
