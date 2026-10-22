import { Suspense } from "react";
import type { Metadata } from "next";
import { CircleNotch } from "@phosphor-icons/react/dist/ssr";
import { LinkLanding } from "./link-landing";

export const metadata: Metadata = {
  title: "Entrando",
};

export default function LinkPage() {
  return (
    // fallback = o estado de trabalho da própria página (o LinkLanding renderiza
    // exatamente este status enquanto consome o link) — sem ele o HTML
    // estático sairia em branco até hidratar
    <Suspense
      fallback={
        <div className="min-h-[100dvh] grid place-items-center bg-background px-4 pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))]">
          <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground">
            <CircleNotch size={16} className="animate-spin" aria-hidden="true" />
            Confirmando…
          </p>
        </div>
      }
    >
      <LinkLanding />
    </Suspense>
  );
}
