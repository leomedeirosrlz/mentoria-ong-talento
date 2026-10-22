import { Suspense } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { sharedOg } from "@/lib/og";
import { Skeleton } from "@/components/ui/skeleton";
import { SiteFooter } from "@/components/site-footer";
import { LoginForm } from "./login-form";

export const metadata: Metadata = {
  title: "Entrar",
  // canonical consolida as variantes ?next=… que o middleware propaga
  alternates: { canonical: "/login" },
  openGraph: { ...sharedOg, url: "/login" },
};

// useSearchParams no LoginForm tira a página do prerender — sem fallback o
// HTML estático sai só com o link fixo e o primeiro paint é página em
// branco até hidratar. O skeleton espelha a anatomia do form: header real
// (logo + título são estáticos, zero CLS), o seletor de modo h-11, o campo
// de e-mail e o CTA w-full; o rodapé real fecha o quadro.
function LoginFallback() {
  return (
    <div
      role="status"
      aria-label="Carregando"
      className="flex min-h-[100dvh] flex-col bg-background pb-[calc(4rem+env(safe-area-inset-bottom))] pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))]"
    >
      <div className="m-auto w-full max-w-sm">
        <div className="mb-8">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-realiza.png" alt="Realiza.vc" className="h-8 w-auto" />
          <h1 className="text-lg font-semibold tracking-tight mt-3">
            Programa de Mentoria Social
          </h1>
        </div>
        <div className="rounded-xl bg-card shadow-[var(--shadow-border)] p-6">
          <Skeleton className="h-11 w-full rounded-xl md:h-10" />
          <div className="mt-5 space-y-4">
            <div className="space-y-2">
              <Skeleton className="h-4 w-14" />
              <Skeleton className="h-11 w-full md:h-8" />
            </div>
            <Skeleton className="h-11 w-full rounded-lg md:h-8" />
          </div>
        </div>
        <SiteFooter className="mt-10" />
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <>
      <Suspense fallback={<LoginFallback />}>
        <LoginForm />
      </Suspense>
      {/* canto inferior direito — o conteúdo da página é centralizado, então a
          quina nunca colide com o card nem com o SiteFooter; o form reserva
          pb no fluxo pra viewport baixo (teclado/zoom) não colocar a última
          linha do rodapé sob o link */}
      <Link
        href="/demo"
        className="fixed right-[max(1rem,env(safe-area-inset-right))] bottom-[calc(1rem+env(safe-area-inset-bottom))] z-10 flex min-h-11 items-center rounded-lg px-3 text-sm text-muted-foreground underline-offset-4 outline-none transition-colors hover:text-foreground hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        Ver a demonstração
      </Link>
    </>
  );
}
