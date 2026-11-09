// Peças compartilhadas do módulo de chamados: a fila (chamados-app), o
// detalhe (chamado-detalhe) e os cards reutilizam pills e helpers daqui —
// antes moravam no chamados-app e a home do mentor baixava as ~2,1k
// linhas dele só pro badge de status.

import type { ComponentType } from "react";
import {
  CalendarBlank,
  CheckCircle,
  Clock,
  GraduationCap,
  Lightning,
  Lock,
  Monitor,
  Tag,
  WarningCircle,
} from "@phosphor-icons/react";
import type {
  ChamadoCategoria,
  ChamadoStatus,
  Profile,
} from "@/lib/types";
import {
  CHAMADO_CATEGORIA_LABEL,
  CHAMADO_STATUS_LABEL,
  formatDiaMes,
} from "@/lib/ciclo";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

export type Equipe = Pick<Profile, "id" | "nome" | "nome_social" | "role">[];
export type EquipeLinha = Pick<Profile, "id" | "nome" | "nome_social" | "role">;

// ---------- escala semântica de status ----------
// A cor do status mora SÓ nas pills/ícones — card e superfície ficam neutros
// (o mock reserva tinta de status pra badge/stepper). Ícone + texto sempre:
// cor sozinha não carrega o significado.
const STATUS_ICON: Record<
  ChamadoStatus,
  ComponentType<{ size?: number | string; className?: string; "aria-hidden"?: boolean | "true" | "false" }>
> = {
  aberto: WarningCircle,
  em_atendimento: Clock,
  resolvido: CheckCircle,
};

const STATUS_TOM: Record<ChamadoStatus, string> = {
  aberto: "border-destructive/40 bg-destructive/10 text-destructive",
  em_atendimento:
    "border-[var(--warn)]/50 bg-[var(--warn)]/10 text-[var(--warn-text)]",
  resolvido: "border-[var(--ok)]/50 bg-[var(--ok)]/10 text-[var(--ok-text)]",
};

const primeiroNome = (n: string) => n.split(" ")[0];

/** Pill de status do chamado. `visao` muda a fala: pra equipe o aberto sem
 *  dono é "Sem dono" (a fila é o trabalho dela); pro autor é "Aguardando a
 *  equipe" e o atendimento ganha nome ("Marina está cuidando"). Chamado
 *  restrito vira pill neutra: quem vê a máscara não confere o dono. */
export function ChamadoStatusBadge({
  status,
  dono,
  souDono,
  restrito,
  visao,
  className,
}: {
  status: ChamadoStatus;
  dono?: string | null;
  /** o dono é quem está vendo: "Com você" em vez do próprio nome */
  souDono?: boolean;
  restrito?: boolean;
  visao: "staff" | "autor";
  className?: string;
}) {
  const Icone = STATUS_ICON[status];
  if (restrito) {
    return (
      <Badge
        variant="outline"
        className={cn(
          "border-dashed border-border font-normal text-muted-foreground",
          className
        )}
      >
        <Lock size={11} aria-hidden />
        {CHAMADO_STATUS_LABEL[status]}
      </Badge>
    );
  }
  let texto = CHAMADO_STATUS_LABEL[status];
  if (status !== "resolvido") {
    if (!dono) {
      texto = visao === "staff" ? "Sem dono" : "Aguardando a equipe";
    } else if (visao === "staff") {
      texto = souDono ? "Com você" : `Com ${primeiroNome(dono)}`;
    } else {
      texto = `${primeiroNome(dono)} está cuidando`;
    }
  }
  return (
    <Badge
      variant="outline"
      className={cn("font-normal", STATUS_TOM[status], className)}
    >
      <Icone size={11} aria-hidden />
      {texto}
    </Badge>
  );
}

/** Marca de urgência: a categoria que importa ver de longe. Ícone + rótulo,
 *  nunca só a cor. */
export function UrgenciaMarca({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-0.5 text-xs font-medium text-destructive",
        className
      )}
    >
      <Lightning size={13} weight="fill" aria-hidden />
      Urgência
    </span>
  );
}

// ---------- categoria ----------
// Urgência carrega o sinal no ÍCONE (raio vermelho) — pill neutra evita dois
// vermelhos lado a lado quando o chamado urgente também está "aberto".
export const CAT_ICON: Record<ChamadoCategoria, ComponentType<{ size?: number | string; className?: string; weight?: "regular" | "fill" | "bold"; "aria-hidden"?: boolean | "true" | "false" }>> = {
  urgencia: Lightning,
  agenda: CalendarBlank,
  metodologia: GraduationCap,
  plataforma: Monitor,
  outro: Tag,
};

export function CategoriaBadge({ categoria }: { categoria: ChamadoCategoria }) {
  const Icone = CAT_ICON[categoria];
  return (
    <Badge
      variant="outline"
      className="border-border bg-muted/60 font-normal text-muted-foreground"
    >
      {Icone && (
        <Icone
          size={11}
          aria-hidden
          className={categoria === "urgencia" ? "text-destructive" : undefined}
        />
      )}
      {CHAMADO_CATEGORIA_LABEL[categoria]}
    </Badge>
  );
}

export { primeiroNome };

export function relTempo(iso: string): string {
  const t = new Date(iso).getTime();
  const diff = Date.now() - t;
  const min = Math.floor(diff / 60000);
  if (min < 60) return `há ${Math.max(1, min)}min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `há ${h}h`;
  const d = Math.floor(h / 24);
  if (d === 1) return "ontem";
  if (d < 7) return `há ${d}d`;
  return formatDiaMes(iso);
}
