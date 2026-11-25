import { Skeleton } from "@/components/ui/skeleton";

// Espelho do ChamadosApp na visão da equipe (o caso comum desta rota):
// barra de busca + filtros + "Novo chamado", abas de recorte, linhas da
// fila e, em lg, o painel do detalhe ao lado com a mesma silhueta do
// esqueleto que o ChamadosApp usa ao trocar de chamado. Só aparece na
// entrada da rota: trocar `?c=` é transição e mantém a tela anterior.
export default function Loading() {
  return (
    <div
      role="status"
      aria-label="Carregando"
      className="mx-auto w-full max-w-6xl"
    >
      <header className="mb-5">
        <Skeleton className="h-7 w-40 sm:h-8" />
      </header>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)] lg:items-start">
        {/* ===== fila ===== */}
        <section className="min-w-0">
          {/* busca + filtros; "Novo chamado" só a partir de md (no celular
              ele flutua na zona do polegar) */}
          <div className="mb-3 flex items-center gap-2">
            <Skeleton className="h-11 min-w-0 flex-1 rounded-lg md:h-9" />
            <Skeleton className="size-11 shrink-0 rounded-lg md:size-9" />
            <Skeleton className="h-9 w-36 shrink-0 rounded-lg max-md:hidden" />
          </div>
          {/* abas Sem dono · Meus · Todos */}
          <div className="mb-3 flex gap-0.5 rounded-lg bg-muted p-0.5">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="flex min-h-11 flex-1 items-center justify-center md:min-h-8"
              >
                <Skeleton className="h-3.5 w-16 bg-background/70" />
              </div>
            ))}
          </div>
          {/* linhas: assunto + meta com o status à direita */}
          <ul className="space-y-1.5">
            {["w-3/4", "w-2/3", "w-4/5", "w-1/2", "w-3/5", "w-2/3"].map(
              (w, i) => (
                <li
                  key={i}
                  className="rounded-xl bg-card px-4 py-3 shadow-[var(--shadow-border)]"
                >
                  <Skeleton className={`h-4 ${w}`} />
                  <div className="mt-1.5 flex items-center gap-2">
                    <Skeleton className="h-3 w-2/5" />
                    <Skeleton className="ml-auto h-5 w-20 shrink-0 rounded-full" />
                  </div>
                </li>
              )
            )}
          </ul>
        </section>

        {/* ===== detalhe: no mobile só existe depois de escolher um
            chamado; em lg o painel ocupa a segunda coluna ===== */}
        <section className="hidden min-w-0 lg:block">
          <div className="overflow-hidden rounded-xl bg-card shadow-[var(--shadow-border)]">
            <div className="space-y-3 border-b border-border px-4 py-4 sm:px-5">
              <div className="flex items-center gap-2">
                <Skeleton className="h-5 w-28 rounded-full" />
                <Skeleton className="ml-auto h-8 w-24" />
              </div>
              <Skeleton className="h-6 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
            </div>
            <div className="space-y-5 px-4 py-5 sm:px-5">
              {[0, 1].map((i) => (
                <div key={i} className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Skeleton className="size-6 rounded-full" />
                    <Skeleton className="h-4 w-32" />
                  </div>
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-2/3" />
                </div>
              ))}
            </div>
            <div className="border-t border-border px-4 py-4 sm:px-5">
              <Skeleton className="h-24 w-full rounded-lg" />
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
