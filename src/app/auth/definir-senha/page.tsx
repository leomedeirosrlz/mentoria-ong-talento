import { Suspense } from "react";
import type { Metadata } from "next";
import { CircleNotch } from "@phosphor-icons/react/dist/ssr";
import { DefinirSenhaForm } from "./definir-senha-form";
import { Logo } from "@/components/logo";

export const metadata: Metadata = {
  title: "Criar senha",
};

// primeiro acesso é esta página — sem fallback o HTML estático sairia em
// branco até hidratar. O skeleton espelha a anatomia real: header (logo +
// título do fluxo comum) e o card da fase "carregando", que é o que o form
// pinta logo em seguida enquanto confere a sessão.
function DefinirSenhaFallback() {
  return (
    <div
      role="status"
      aria-label="Carregando"
      className="min-h-[100dvh] grid place-items-center bg-background px-4 pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))]"
    >
      <div className="w-full max-w-sm">
        <div className="mb-8">
          <Logo size="xl" />
          <h1 className="text-lg font-semibold tracking-tight mt-3">
            Crie sua senha
          </h1>
        </div>
        <div className="rounded-xl bg-card shadow-[var(--shadow-border)] p-6">
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <CircleNotch size={14} className="animate-spin shrink-0" aria-hidden="true" />
            Confirmando acesso…
          </p>
        </div>
      </div>
    </div>
  );
}

export default function DefinirSenhaPage() {
  return (
    <Suspense fallback={<DefinirSenhaFallback />}>
      <DefinirSenhaForm />
    </Suspense>
  );
}
