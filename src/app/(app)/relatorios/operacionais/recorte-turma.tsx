import Link from "next/link";
import { cn } from "@/lib/utils";

/** Filtro de turma do hub operacional — chips que são links (?turma=),
 *  não um select com JS: a página segue 100% server e o recorte é
 *  deep-linkável. Preserva aba e cronograma ativos na query de cada chip. */
export function RecorteTurma({
  aba,
  turmas,
  ativa,
  cronograma,
}: {
  aba: string;
  turmas: string[];
  /** Turma ativa; undefined = "todas". */
  ativa?: string;
  cronograma?: string;
}) {
  if (turmas.length < 2) return null;
  const href = (turma?: string) => {
    const q = new URLSearchParams({ aba });
    if (turma) q.set("turma", turma);
    if (cronograma) q.set("cronograma", cronograma);
    return `/relatorios/operacionais?${q.toString()}`;
  };
  const chip = (rotulo: string, turma?: string) => {
    const on = ativa === turma || (!ativa && !turma);
    return (
      <Link
        key={rotulo}
        href={href(turma)}
        scroll={false}
        aria-current={on ? "true" : undefined}
        className={cn(
          "inline-flex min-h-9 items-center rounded-full border px-3 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          on
            ? "border-[var(--brand-lime)] bg-[var(--brand-lime)]/15 text-foreground"
            : "border-border text-muted-foreground hover:text-foreground"
        )}
      >
        {rotulo}
      </Link>
    );
  };
  return (
    <div
      role="group"
      aria-label="Recorte por turma"
      className="flex flex-wrap items-center gap-1.5"
    >
      {chip("Todas as turmas")}
      {turmas.map((t) => chip(t, t))}
    </div>
  );
}
