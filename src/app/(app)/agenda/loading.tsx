import { Skeleton } from "@/components/ui/skeleton";

// Espelho da aterrissagem de /agenda (v8b): header + tabs de modo
// (minha/por-mentorado/calendário no mentor, monitoramento/calendário na
// coord, por-turma/consolidada no auxiliar), a faixa "Semana do programa"
// (scroller de cards) e o corpo em duas colunas — feed de seções à
// esquerda, rail "Sua semana" à direita em lg. O calendário mensal fica
// atrás de ?aba=calendario — o esqueleto cobre a superfície default, não
// a aba (um grid de mês aqui seria layout morto pro mentor/auxiliar).
export default function Loading() {
  return (
    <div role="status" aria-label="Carregando" className="space-y-6">
      {/* header — título + subtítulo estático */}
      <header>
        <Skeleton className="h-8 w-44" />
        <Skeleton className="mt-2 h-4 w-72 max-w-full" />
      </header>

      {/* barra de modos — UM tablist (AbasAgenda: container muted com p-1 e
          tabs de 44px no mobile / 32 no desktop, sem quebra) */}
      <div className="flex w-fit items-center gap-1 rounded-lg bg-muted p-1">
        <Skeleton className="h-11 w-28 rounded-md sm:h-8" />
        <Skeleton className="h-11 w-32 rounded-md sm:h-8" />
        <Skeleton className="h-11 w-24 rounded-md sm:h-8" />
      </div>

      {/* faixa "Semana do programa" — heading + caption + cards em scroll
          lateral (w-[236px], borda-t colorida por tipo) */}
      <div>
        <Skeleton className="h-5 w-44" />
        <Skeleton className="mt-1.5 h-3 w-72 max-w-full" />
        <div className="mt-3 flex gap-3 overflow-hidden">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="w-[236px] shrink-0 rounded-xl border border-t-2 bg-card p-3.5"
            >
              <div className="flex items-center gap-1.5">
                <Skeleton className="h-5 w-14 rounded-md" />
                <Skeleton className="h-5 w-20 rounded-md" />
              </div>
              <Skeleton className="mt-2 h-4 w-4/5" />
              <Skeleton className="mt-1.5 h-3 w-3/5" />
            </div>
          ))}
        </div>
      </div>

      {/* chips de escopo — "Agenda de: Tudo · <dupla>" (só no mentor) */}
      <div className="flex items-center gap-1.5">
        <Skeleton className="h-3 w-16" />
        <Skeleton className="h-8 w-16 rounded-full" />
        <Skeleton className="h-8 w-24 rounded-full" />
      </div>

      {/* corpo — feed cronológico + rail lateral "Sua semana" (lg) */}
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_290px] lg:items-start">
        <div className="min-w-0 space-y-6">
          {["Hoje", "Esta semana"].map((rotulo, s) => (
            <section key={rotulo} aria-label={`Agenda de ${rotulo.toLowerCase()}`}>
              <div className="flex items-baseline gap-2.5">
                <Skeleton className="h-5 w-24" />
                <Skeleton className="h-3 w-20" />
              </div>
              <div className="mt-2.5 space-y-2">
                {(s === 0 ? [0, 1] : [0, 1, 2]).map((i) => (
                  <div
                    key={i}
                    className="flex gap-3 rounded-xl bg-card p-3.5 shadow-[var(--shadow-border)]"
                  >
                    {/* rail do dia — dd/mm + dow */}
                    <div className="w-12 shrink-0 space-y-1">
                      <Skeleton className="h-4 w-8" />
                      <Skeleton className="h-3 w-10" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <Skeleton className="h-4 w-3/5" />
                      <Skeleton className="mt-1.5 h-3 w-2/5" />
                      <div className="mt-2 flex gap-1.5">
                        <Skeleton className="h-5 w-20 rounded-4xl" />
                        <Skeleton className="h-5 w-16 rounded-4xl" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>

        {/* rail "Sua semana" — números da semana + próximos itens */}
        <aside className="hidden space-y-4 lg:block">
          <div className="rounded-xl bg-card p-4 shadow-[var(--shadow-border)]">
            <Skeleton className="h-4 w-28" />
            <div className="mt-3 grid grid-cols-3 gap-2">
              {[0, 1, 2].map((i) => (
                <div key={i}>
                  <Skeleton className="h-6 w-8" />
                  <Skeleton className="mt-1 h-3 w-full" />
                </div>
              ))}
            </div>
            <div className="mt-4 space-y-2 border-t border-border/60 pt-3">
              {[0, 1, 2].map((i) => (
                <div key={i} className="flex items-center gap-2">
                  <Skeleton className="size-2 shrink-0 rounded-full" />
                  <Skeleton className="h-3.5 flex-1" />
                </div>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
