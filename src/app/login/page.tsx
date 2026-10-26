import { Suspense } from "react";
import type { Metadata } from "next";
import { sharedOg } from "@/lib/og";
import { Skeleton } from "@/components/ui/skeleton";
import { SiteFooter } from "@/components/site-footer";
import { LoginForm } from "./login-form";
import { Logo } from "@/components/logo";

export const metadata: Metadata = {
  title: "Entrar",
  // canonical consolida as variantes ?next=… que o middleware propaga
  alternates: { canonical: "/login" },
  openGraph: { ...sharedOg, url: "/login" },
};

// useSearchParams no LoginForm tira a página do prerender — sem fallback o
// primeiro paint sai em branco até hidratar. O skeleton espelha a anatomia do form: header real
// (logo + título são estáticos, zero CLS), o seletor de modo h-11, o campo
// de e-mail e o CTA w-full; o rodapé real fecha o quadro.
function LoginFallback() {
  return (
    <div
      role="status"
      aria-label="Carregando"
      className="flex min-h-[100dvh] flex-col bg-background lg:pl-[50%]"
    >
      {/* espelha o LoginHero: painel ink fixo ocupando a metade esquerda em
          lg+ — wordmark real centralizado, glow lime, headline e a mesma
          colagem de 4 fotos em skeleton */}
      <aside
        aria-hidden="true"
        className="fixed inset-y-0 left-0 hidden w-1/2 flex-col overflow-hidden bg-[var(--brand-ink)] p-10 lg:flex xl:p-14"
      >
        <div className="pointer-events-none absolute left-1/2 top-4 size-80 -translate-x-1/2 rounded-full bg-[var(--brand-lime)]/15 blur-3xl" />
        <div className="relative mt-3 text-center">
          <p className="text-4xl font-black italic tracking-tight xl:text-5xl">
            <span className="text-white">REALIZA</span>
            <span className="text-[var(--role-mentorado)]">.</span>
            <span className="text-[var(--brand-lime)]">VC</span>
          </p>
          <Skeleton className="mx-auto mt-3 h-4 w-52 bg-white/10" />
          <Skeleton className="mx-auto mt-6 h-7 w-3/5 bg-white/10" />
        </div>
        <div className="relative mt-4 min-h-0 flex-1">
          <Skeleton className="absolute left-0 top-[2%] aspect-[16/10] w-[44%] rotate-[-4deg] rounded-2xl bg-white/10" />
          <Skeleton className="absolute right-[1%] top-0 aspect-[3/4] w-[29%] rotate-[3deg] rounded-2xl bg-white/10" />
          <Skeleton className="absolute bottom-[10%] left-[4%] aspect-[3/4] w-[30%] rotate-[2.5deg] rounded-2xl bg-white/10" />
          <Skeleton className="absolute bottom-0 right-[5%] aspect-[16/10] w-[57%] rotate-[-2.5deg] rounded-2xl bg-white/10" />
        </div>
        <div className="mt-8 flex flex-wrap justify-center gap-2">
          <Skeleton className="h-7 w-24 rounded-full bg-white/10" />
          <Skeleton className="h-7 w-20 rounded-full bg-white/10" />
          <Skeleton className="h-7 w-16 rounded-full bg-white/10" />
        </div>
      </aside>
      {/* banda mobile: mesmo gradiente ink→verde, wordmark real e a
          colagem de 3 fotos em skeleton */}
      <div className="relative overflow-hidden bg-[linear-gradient(165deg,var(--brand-ink),color-mix(in_srgb,var(--brand-ink)_80%,var(--brand-lime)))] px-6 pb-10 pt-[calc(2.5rem+env(safe-area-inset-top))] text-center lg:hidden">
        <div
          aria-hidden
          className="pointer-events-none absolute -top-12 left-1/2 size-72 -translate-x-1/2 rounded-full bg-[var(--brand-lime)]/20 blur-3xl"
        />
        <p className="relative text-3xl font-black italic tracking-tight">
          <span className="text-white">REALIZA</span>
          <span className="text-[var(--role-mentorado)]">.</span>
          <span className="text-[var(--brand-lime)]">VC</span>
        </p>
        <h1 className="relative mt-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/60">
          Programa de Mentoria Social
        </h1>
        <div className="relative mt-6 flex items-end justify-center gap-3">
          <Skeleton className="aspect-[4/3] w-[46%] rotate-[-2deg] rounded-2xl bg-white/10" />
          <Skeleton className="aspect-[3/4] w-[27%] rotate-[2.5deg] rounded-2xl bg-white/10" />
          <Skeleton className="aspect-[3/4] w-[27%] rotate-[-3deg] rounded-2xl bg-white/10" />
        </div>
      </div>
      <div className="m-auto w-full max-w-sm pb-[calc(1.5rem+env(safe-area-inset-bottom))] pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))] pt-6 lg:max-w-md lg:pt-0">
        <div className="mb-8 hidden lg:block">
          <Logo size="xl" />
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
    <Suspense fallback={<LoginFallback />}>
      <LoginForm />
    </Suspense>
  );
}
