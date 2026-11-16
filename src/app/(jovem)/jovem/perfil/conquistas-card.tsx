import {
  Flag,
  FlagCheckered,
  Medal,
  Trophy,
} from "@phosphor-icons/react/dist/ssr";
import { cn } from "@/lib/utils";
import type { MarcoJornada } from "@/lib/ciclo";

/** Conquistas do jovem no perfil (REALIZA-427) — os 4 marcos da jornada,
 *  mesma gramática de ícones e nomes da trilha (ICONE_MARCO/MARCO_SR de
 *  trilha-jornada). Derivação pura: os marcos cruzados vêm de
 *  marcosEntre(0, feitos, total) — nada persiste, nada compete: é a régua
 *  individual da própria jornada, sem streak nem ranking. */

const ORDEM: MarcoJornada[] = ["primeiro", "metade", "reta_final", "completo"];

const ICONE = {
  primeiro: Flag,
  metade: Medal,
  reta_final: FlagCheckered,
  completo: Trophy,
} as const;

const ROTULO: Record<MarcoJornada, string> = {
  primeiro: "Primeiro encontro",
  metade: "Metade do caminho",
  reta_final: "Reta final",
  completo: "Jornada completa",
};

export function ConquistasCard({
  marcos,
  stats,
}: {
  /** marcos já cruzados (marcosEntre) — o resto renderiza travado */
  marcos: MarcoJornada[];
  /** linha de stats da jornada — ex.: "8 de 16 com seu mentor · 7 avaliações" */
  stats: string;
}) {
  const ganhos = new Set(marcos);
  const total = ORDEM.length;
  const feitos = ORDEM.filter((m) => ganhos.has(m)).length;

  return (
    <section className="rounded-xl bg-card p-5 shadow-[var(--shadow-border)] sm:p-6">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-base font-semibold">Suas conquistas</h2>
        <span className="text-xs text-muted-foreground">
          {feitos} de {total}
        </span>
      </div>
      <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {ORDEM.map((marco) => {
          const Icone = ICONE[marco];
          const ganho = ganhos.has(marco);
          return (
            <li
              key={marco}
              title={ganho ? ROTULO[marco] : `${ROTULO[marco]}, a desbloquear`}
              className="flex flex-col items-center gap-1.5 rounded-lg border border-border/60 px-2 py-3 text-center"
            >
              <span
                aria-hidden
                className={cn(
                  "grid size-9 place-items-center rounded-full",
                  ganho
                    ? "bg-[var(--brand-lime)] text-[var(--brand-ink)]"
                    : "bg-muted text-muted-foreground/60"
                )}
              >
                <Icone size={18} />
              </span>
              <span
                className={cn(
                  "text-xs font-medium leading-tight",
                  !ganho && "text-muted-foreground/70"
                )}
              >
                {ROTULO[marco]}
              </span>
            </li>
          );
        })}
      </ul>
      <p className="mt-4 text-xs text-muted-foreground">{stats}</p>
    </section>
  );
}
