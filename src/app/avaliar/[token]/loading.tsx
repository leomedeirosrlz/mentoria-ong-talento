import { Skeleton } from "@/components/ui/skeleton";
import { SiteFooter } from "@/components/site-footer";

// Espelho de /avaliar/[token] (público — a tela mais mobile do app, aberta
// via WhatsApp): mesmo shell das irmãs + a anatomia do form de avaliação —
// linha de contexto, card de título com faixa lime, card das estrelas e
// cards de pergunta.
export default function Loading() {
  return (
    <div
      role="status"
      aria-label="Carregando"
      className="flex min-h-[100dvh] flex-col"
    >
      <main className="flex flex-1 flex-col px-4 py-10 pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))]">
        <div className="m-auto w-full max-w-xl">
          <header className="mb-6">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/logo-realiza.png"
              alt="Realiza.vc"
              width={1920}
              height={262}
              className="h-7 w-auto"
            />
            <p className="mt-1.5 text-xs text-muted-foreground">
              Programa de Mentoria Social
            </p>
          </header>

          {/* linha de contexto ("Encontro N com Fulano · data") */}
          <Skeleton className="mx-auto mb-4 h-3 w-52 max-w-full" />

          {/* card de título — a faixa lime é real, como no form */}
          <div className="overflow-hidden rounded-xl bg-card shadow-[var(--shadow-border)]">
            <div aria-hidden className="h-1.5 bg-[var(--brand-lime)]" />
            <div className="p-5 sm:p-7">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="mt-2 h-7 w-3/5 max-w-full" />
              <Skeleton className="mt-2 h-3 w-44" />
              <Skeleton className="mt-3 h-3.5 w-full" />
              <Skeleton className="mt-1.5 h-3.5 w-4/5" />
            </div>
          </div>

          {/* estrelas — a fileira de 5 é a assinatura visual do form */}
          <div className="mt-3 rounded-xl bg-card p-4 shadow-[var(--shadow-border)] sm:p-5">
            <Skeleton className="h-4 w-1/2" />
            <div className="mt-3 flex gap-1">
              {[0, 1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="size-11 rounded-lg" />
              ))}
            </div>
          </div>

          {/* perguntas seguintes — chips e grade de 3 botões */}
          <div className="mt-3 rounded-xl bg-card p-4 shadow-[var(--shadow-border)] sm:p-5">
            <Skeleton className="h-4 w-2/5" />
            <div className="mt-3 flex flex-wrap gap-1.5">
              <Skeleton className="h-11 w-28 rounded-full" />
              <Skeleton className="h-11 w-32 rounded-full" />
              <Skeleton className="h-11 w-24 rounded-full" />
            </div>
          </div>
          <div className="mt-3 rounded-xl bg-card p-4 shadow-[var(--shadow-border)] sm:p-5">
            <Skeleton className="h-4 w-3/5" />
            <Skeleton className="mt-3 h-11 w-full rounded-xl" />
          </div>

          <Skeleton className="mt-3 h-11 w-full rounded-lg" />
          <SiteFooter className="mt-8" />
        </div>
      </main>
    </div>
  );
}
