import { Suspense } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { LoginForm } from "./login-form";

export const metadata: Metadata = {
  title: "Entrar",
};

export default function LoginPage() {
  return (
    <>
      <Suspense>
        <LoginForm />
      </Suspense>
      {/* canto inferior direito — o conteúdo da página é centralizado, então a
          quina nunca colide com o card nem com o SiteFooter */}
      <Link
        href="/demo"
        className="fixed right-4 bottom-[calc(1rem+env(safe-area-inset-bottom))] z-10 flex min-h-11 items-center rounded-lg px-3 text-sm text-muted-foreground underline-offset-4 outline-none transition-colors hover:text-foreground hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        Ver a demonstração
      </Link>
    </>
  );
}
