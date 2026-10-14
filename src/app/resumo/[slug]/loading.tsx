import { Skeleton } from "@/components/ui/skeleton";
import { SiteFooter } from "@/components/site-footer";

// Espelho de /resumo/[slug] (público, fora do shell): logo + título do
// recorte e a grade do relatório na faixa border-y — mesma anatomia do
// canvas real (gutter de nº + colunas de largura fixa).
const COLS = ["w-44", "w-40", "w-36", "w-44", "w-28"];

export default function Loading() {
  return (
    <div
      role="status"
      aria-label="Carregando"
      className="flex min-h-[100dvh] flex-col"
    >
      <main className="flex flex-1 flex-col px-4 py-8 pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))]">
        <div className="w-full">
          <header className="mx-auto max-w-6xl">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/logo-realiza.png"
              alt="Realiza.vc"
              width={1920}
              height={262}
              className="h-7 w-auto"
            />
            <Skeleton className="mt-1.5 h-3 w-44" />
          </header>

          <div className="mx-auto mt-6 max-w-6xl">
            <Skeleton className="h-7 w-64 max-w-full" />
            <Skeleton className="mt-1 h-4 w-96 max-w-full" />
            <Skeleton className="mt-1 h-4 w-72 max-w-full" />
          </div>

          <div className="mt-5 border-y border-border bg-card/40 py-3 sm:-mx-4 sm:px-4">
            <div className="mx-auto max-w-6xl overflow-hidden">
              <div className="flex bg-muted">
                <div className="w-10 shrink-0 px-2 py-1.5" />
                {COLS.map((c, i) => (
                  <div key={i} className={`${c} shrink-0 px-2.5 py-1.5`}>
                    <Skeleton className="h-3.5 w-3/5" />
                  </div>
                ))}
              </div>
              {Array.from({ length: 9 }, (_, i) => (
                <div key={i} className="flex border-t border-border/60">
                  <div className="w-10 shrink-0 px-2 py-1.5">
                    <Skeleton className="mx-auto h-3.5 w-4" />
                  </div>
                  {COLS.map((c, j) => (
                    <div key={j} className={`${c} shrink-0 px-2.5 py-1.5`}>
                      <Skeleton
                        className={`h-3.5 ${j % 2 === 0 ? "w-3/4" : "w-1/2"}`}
                      />
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
