import Link from "next/link";
import type { Metadata } from "next";
import { Compass } from "@phosphor-icons/react/dist/ssr";

export const metadata: Metadata = {
  title: "Página não encontrada",
};

export default function NotFound() {
  return (
    <div className="min-h-[100dvh] grid place-items-center px-4 pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))]">
      <div className="max-w-sm rounded-xl bg-card shadow-[var(--shadow-border)] p-6 text-center">
        <Compass size={32} className="mx-auto text-muted-foreground" />
        <p className="mt-2 font-medium">Página não encontrada</p>
        <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
          O endereço que você tentou abrir não existe ou foi movido.
        </p>
        <Link
          href="/"
          className="mt-4 inline-flex min-h-11 sm:min-h-8 items-center rounded-sm px-3 text-sm underline underline-offset-2 text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          Voltar para o início
        </Link>
      </div>
    </div>
  );
}
