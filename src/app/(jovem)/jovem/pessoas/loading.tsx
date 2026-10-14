import { Skeleton } from "@/components/ui/skeleton";

// Espelho do diretório do jovem (grid gap-8): header + grupos por cargo
// (overline com ícone + card de contatos: avatar, nome e chips de contato)
// + colegas da turma com a nota de rodapé.
const GRUPOS = [
  { linhas: 2, botoes: 2 },
  { linhas: 1, botoes: 2 },
  { linhas: 1, botoes: 2 },
  { linhas: 1, botoes: 2 },
];

export default function Loading() {
  return (
    <div role="status" aria-label="Carregando" className="grid gap-8">
      <header>
        <Skeleton className="h-8 w-28" />
        <Skeleton className="mt-1 h-4 w-72 max-w-full" />
      </header>

      {GRUPOS.map((g, i) => (
        <section key={i}>
          <div className="mb-3 flex items-center gap-2">
            <Skeleton className="size-4.5 rounded" />
            <Skeleton className="h-5 w-28" />
          </div>
          <div className="rounded-xl bg-card px-5 py-4 shadow-[var(--shadow-border)]">
            <ul className="divide-y divide-border/60">
              {Array.from({ length: g.linhas }, (_, j) => (
                <li key={j} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                  <Skeleton className="size-10 shrink-0 rounded-full" />
                  <div className="min-w-0 flex-1">
                    <Skeleton className="h-4 w-2/5" />
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    {Array.from({ length: g.botoes }, (_, b) => (
                      <Skeleton key={b} className="h-8 w-20 rounded-lg" />
                    ))}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </section>
      ))}

      {/* Colegas da turma — nome + chips de interesse + nota explicativa */}
      <section>
        <div className="mb-3 flex items-center gap-2">
          <Skeleton className="size-4.5 rounded" />
          <Skeleton className="h-5 w-36" />
        </div>
        <div className="rounded-xl bg-card px-5 py-4 shadow-[var(--shadow-border)]">
          <ul className="divide-y divide-border/60">
            {[0, 1].map((i) => (
              <li key={i} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                <Skeleton className="size-10 shrink-0 rounded-full" />
                <div className="min-w-0 flex-1">
                  <Skeleton className="h-4 w-2/5" />
                  <Skeleton className="mt-1.5 h-5 w-3/5 rounded-full" />
                </div>
                <Skeleton className="h-8 w-24 shrink-0 rounded-lg" />
              </li>
            ))}
          </ul>
        </div>
        <Skeleton className="mt-3 h-3 w-full" />
        <Skeleton className="mt-1.5 h-3 w-3/5" />
      </section>
    </div>
  );
}
