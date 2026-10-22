import { Skeleton } from "@/components/ui/skeleton";

// Espelho do ChamadosApp na visão da equipe: fila (contagem + chips de
// visão + filtros + cards) e, em lg, o detalhe ao lado (cabeçalho com
// badges, stepper de 3 passos, barra de ações, conversa, composer).
// No mobile só a lista aparece — o detalhe exige tocar num chamado, e a
// moldura sem `?c=` real é o estado vazio tracejado. A visão do mentor
// é mais simples, mas staff é o caso comum desta rota.
export default function Loading() {
  return (
    <div
      role="status"
      aria-label="Carregando"
      className="mx-auto w-full max-w-6xl"
    >
      {/* header — título + subtítulo */}
      <header className="mb-5">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="mt-2 h-4 w-80 max-w-full" />
      </header>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)] lg:items-start">
        {/* ===== fila ===== */}
        <section>
          <div className="mb-3 space-y-2.5">
            {/* "N na fila · mais antigo…" */}
            <Skeleton className="h-4 w-52" />
            {/* chips de visão (Todos · Na fila · Meus · Resolvidos) */}
            <div className="flex flex-wrap gap-1.5">
              {["w-16", "w-20", "w-16", "w-24"].map((w, i) => (
                <Skeleton key={i} className={`h-11 rounded-full md:h-8 ${w}`} />
              ))}
            </div>
            {/* selects de categoria/estado + busca */}
            <div className="flex flex-wrap gap-2">
              <Skeleton className="h-11 w-36 md:h-8" />
              <Skeleton className="h-11 w-36 md:h-8" />
              <Skeleton className="h-11 w-full md:h-8 md:max-w-52" />
            </div>
          </div>
          {/* "Abrir chamado" alinhado à direita */}
          <div className="mb-3 flex justify-end">
            <Skeleton className="h-9 w-32 rounded-lg" />
          </div>
          {/* rows: linha de badges + assunto + meta, caret à direita */}
          <ul className="space-y-2">
            {["w-3/4", "w-2/3", "w-4/5", "w-1/2", "w-3/5"].map((w, i) => (
              <li
                key={i}
                className="flex items-center gap-3 rounded-xl border border-transparent bg-card px-4 py-3.5 shadow-[var(--shadow-border)]"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-3 w-14" />
                    <Skeleton className="h-4.5 w-16 rounded-full" />
                    <Skeleton className="h-4.5 w-20 rounded-full" />
                  </div>
                  <Skeleton className={`mt-2 h-4 ${w}`} />
                  <Skeleton className="mt-1.5 h-3 w-2/5" />
                </div>
                <Skeleton className="h-3 w-10 shrink-0" />
              </li>
            ))}
          </ul>
        </section>

        {/* ===== detalhe — no mobile só existe depois de escolher um
            chamado; em lg o painel ocupa a segunda coluna ===== */}
        <section className="hidden lg:block">
          <article className="overflow-hidden rounded-xl bg-card shadow-[var(--shadow-border)]">
            {/* cabeçalho: badges + assunto + meta + stepper */}
            <div className="border-b border-border px-4 py-3.5 sm:px-5">
              <div className="flex items-center gap-2">
                <Skeleton className="h-3 w-14" />
                <Skeleton className="h-4.5 w-16 rounded-full" />
                <Skeleton className="h-4.5 w-24 rounded-full" />
                <Skeleton className="h-3 w-16" />
              </div>
              <Skeleton className="mt-2.5 h-5 w-2/3" />
              <Skeleton className="mt-2 h-3 w-4/5" />
              {/* stepper — disco + rótulo + conector */}
              <ol className="mt-4 flex items-center gap-2">
                {[0, 1, 2].map((i) => (
                  <li key={i} className="flex flex-1 items-center gap-2">
                    <Skeleton className="size-5 shrink-0 rounded-full" />
                    <Skeleton className="h-3 w-16" />
                    {i < 2 && (
                      <span
                        aria-hidden
                        className="h-px min-w-3 flex-1 bg-border"
                      />
                    )}
                  </li>
                ))}
              </ol>
            </div>
            {/* barra de ações da equipe */}
            <div className="flex items-center gap-2 border-b border-border bg-muted/30 px-4 py-2.5 sm:px-5">
              <Skeleton className="h-8 w-24 rounded-lg" />
              <Skeleton className="h-8 w-20 rounded-lg" />
              <Skeleton className="h-8 w-20 rounded-lg" />
            </div>
            {/* conversa — autor + tempo no topo, texto em 2 linhas */}
            <ol className="divide-y divide-border/60 px-4 sm:px-5">
              {["w-4/5", "w-3/5", "w-2/3"].map((w, i) => (
                <li key={i} className="py-3.5">
                  <div className="flex items-baseline gap-2">
                    <Skeleton className="h-4 w-16" />
                    <Skeleton className="ml-auto h-3 w-10" />
                  </div>
                  <Skeleton className={`mt-2 h-3.5 ${w}`} />
                  <Skeleton className="mt-1.5 h-3.5 w-1/2" />
                </li>
              ))}
            </ol>
            {/* composer — toggle de modo + textarea + enviar */}
            <div className="border-t border-border px-4 py-4 sm:px-5">
              <Skeleton className="h-9 w-72 max-w-full rounded-lg" />
              <Skeleton className="mt-3 h-20 w-full rounded-lg" />
              <div className="mt-3 flex justify-end">
                <Skeleton className="h-9 w-24 rounded-lg" />
              </div>
            </div>
          </article>
        </section>
      </div>
    </div>
  );
}
