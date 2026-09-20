import Link from "next/link";
import { Compass } from "@phosphor-icons/react/dist/ssr";

export default function NotFound() {
  return (
    <div className="min-h-[100dvh] grid place-items-center px-4">
      <div className="max-w-sm rounded-xl bg-card shadow-[var(--shadow-border)] p-6 text-center">
        <Compass size={32} className="mx-auto text-muted-foreground" />
        <p className="mt-2 font-medium">Página não encontrada</p>
        <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
          O endereço que você tentou abrir não existe ou foi movido.
        </p>
        <Link
          href="/"
          className="mt-4 inline-block text-sm underline text-muted-foreground hover:text-foreground transition-colors"
        >
          Voltar para o início
        </Link>
      </div>
    </div>
  );
}
