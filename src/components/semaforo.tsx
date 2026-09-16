import { cn } from "@/lib/utils";
import type { Semaforo } from "@/lib/ciclo";

const CORES: Record<Semaforo, string> = {
  ok: "bg-[var(--ok)]",
  atencao: "bg-[var(--warn)]",
  risco: "bg-[var(--danger)]",
};

const ROTULOS: Record<Semaforo, string> = {
  ok: "Em dia",
  atencao: "Atencao",
  risco: "Risco",
};

export function SemaforoDot({ nivel, className }: { nivel: Semaforo; className?: string }) {
  return (
    <span
      className={cn("inline-block size-2.5 rounded-full shrink-0", CORES[nivel], className)}
      aria-label={ROTULOS[nivel]}
      title={ROTULOS[nivel]}
    />
  );
}

export function SemaforoBadge({ nivel, motivo }: { nivel: Semaforo; motivo?: string }) {
  return (
    <span className="inline-flex items-center gap-2 text-sm">
      <SemaforoDot nivel={nivel} />
      <span className="font-medium">{ROTULOS[nivel]}</span>
      {motivo && <span className="text-muted-foreground">{motivo}</span>}
    </span>
  );
}
