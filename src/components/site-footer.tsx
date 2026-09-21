import Link from "next/link";

/** Rodapé institucional — usado dentro do app e nas páginas públicas. */
export function SiteFooter({ className }: { className?: string }) {
  return (
    <footer className={className}>
      <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span>Realiza.vc — Programa de Mentoria Social</span>
        <span aria-hidden className="text-border">·</span>
        <Link href="/privacidade" className="underline-offset-2 transition-colors hover:text-foreground hover:underline">
          Privacidade e LGPD
        </Link>
        <span aria-hidden className="text-border">·</span>
        <a href="mailto:contato@realiza.vc" className="underline-offset-2 transition-colors hover:text-foreground hover:underline">
          contato@realiza.vc
        </a>
      </div>
    </footer>
  );
}
