// Bloco "Leitura" das abas de relatório (REALIZA-455): a régua
// determinística em prosa, com métrica+denominador e intervenção por
// achado. Server component puro — os achados chegam prontos.

import Link from "next/link";
import { cn } from "@/lib/utils";
import type { Achado, TomAchado } from "@/lib/relatorios/leituras";

const TOM: Record<TomAchado, { rotulo: string; cls: string }> = {
  risco: {
    rotulo: "Urgente",
    cls: "bg-[var(--danger)]/12 text-[var(--danger)]",
  },
  atencao: {
    rotulo: "Atenção",
    cls: "bg-[var(--warn)]/15 text-[var(--warn-text,var(--warn))]",
  },
  info: {
    rotulo: "Fique de olho",
    cls: "bg-[var(--info,var(--primary))]/12 text-[var(--info-text,var(--primary))]",
  },
  ok: { rotulo: "Em dia", cls: "bg-[var(--ok)]/12 text-[var(--ok)]" },
};

export function LeituraPainel({
  achados,
  comoLer,
}: {
  achados: Achado[];
  /** frase curta que ancora a régua — "a mesma régua dos cards abaixo" */
  comoLer: string;
}) {
  return (
    <section
      aria-label="Leitura da seção"
      className="rounded-xl bg-card p-4 shadow-[var(--shadow-border)] sm:p-5"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h3 className="text-base font-semibold">Leitura</h3>
        <p className="text-xs text-muted-foreground">{comoLer}</p>
      </div>
      <ol className="mt-3 space-y-3">
        {achados.map((a, i) => (
          <li key={i} className="flex gap-3">
            <span
              className={cn(
                "mt-0.5 h-fit shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium",
                TOM[a.tom].cls
              )}
            >
              {TOM[a.tom].rotulo}
            </span>
            <div className="min-w-0 text-sm">
              <p>
                <span className="font-medium">{a.titulo}</span>
                <span className="text-muted-foreground"> · {a.metrica}</span>
              </p>
              <p className="mt-0.5 text-muted-foreground">
                {a.porque}. {a.intervencao}.
                {a.acao && (
                  <>
                    {" "}
                    <Link
                      href={a.acao.href}
                      className="font-medium text-foreground underline underline-offset-3 hover:text-foreground/80"
                    >
                      {a.acao.rotulo}
                    </Link>
                  </>
                )}
              </p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
