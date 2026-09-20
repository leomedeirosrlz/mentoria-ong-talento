import { cn } from "@/lib/utils";
import { AVALIACAO_LABEL, type Semaforo } from "@/lib/ciclo";
import { Badge } from "@/components/ui/badge";

const CORES: Record<Semaforo, string> = {
  ok: "bg-[var(--ok)]",
  atencao: "bg-[var(--warn)]",
  risco: "bg-[var(--danger)]",
};

const ROTULOS: Record<Semaforo, string> = {
  ok: "Em dia",
  atencao: "Atenção",
  risco: "Risco",
};

export function SemaforoDot({ nivel, className }: { nivel: Semaforo; className?: string }) {
  return (
    <span
      role="img"
      className={cn("relative inline-block size-2.5 rounded-full shrink-0", CORES[nivel], className)}
      aria-label={ROTULOS[nivel]}
      title={ROTULOS[nivel]}
    >
      {/* risco: um único ping no mount chama atenção pro problema — nunca loop infinito */}
      {nivel === "risco" && (
        <span
          aria-hidden
          className="animate-ping-once pointer-events-none absolute inset-0 rounded-full bg-[var(--danger)]"
        />
      )}
    </span>
  );
}

export function SemaforoBadge({ nivel, motivo }: { nivel: Semaforo; motivo?: string }) {
  return (
    <span className="inline-flex items-center gap-2 text-sm">
      <SemaforoDot nivel={nivel} />
      <span className="font-medium">{ROTULOS[nivel]}</span>
      {/* motivo "Em dia" do ok-sem-pendência repetiria o rótulo — suprime */}
      {motivo && motivo !== ROTULOS[nivel] && (
        <span className="text-muted-foreground">{motivo}</span>
      )}
    </span>
  );
}

export function AvaliacaoBadge({ avaliacao }: { avaliacao: string }) {
  return (
    <Badge
      variant="outline"
      className={cn(
        "text-xs",
        avaliacao === "baixa"
          ? "border-[var(--danger)]/60 text-[var(--danger)]"
          : avaliacao === "regular"
            ? "border-[var(--warn)]/60 text-[var(--warn-text)]"
            : "border-[var(--ok)]/60 text-[var(--ok-text)]"
      )}
    >
      {AVALIACAO_LABEL[avaliacao] ?? avaliacao}
    </Badge>
  );
}
