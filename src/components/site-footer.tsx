import Link from "next/link";
import { cn } from "@/lib/utils";

/** Rodapé institucional. `light` (padrão): hairline + muted, usado nas
 *  páginas públicas (login, /f, /assinar/[token], /privacidade). `ink`:
 *  faixa escura full-bleed com filete lime no topo — marca o fim da página
 *  no app-shell; o max-w do conteúdo e o padding-bottom mobile (a faixa
 *  escura encosta na bottom-nav) moram dentro do próprio bloco. */
export function SiteFooter({
  className,
  tone = "light",
}: {
  className?: string;
  tone?: "light" | "ink";
}) {
  if (tone === "ink") {
    return (
      <footer
        className={cn(
          "border-t-2 border-[var(--brand-lime)] bg-[var(--brand-ink)]",
          className
        )}
      >
        <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center justify-between gap-x-6 gap-y-2 px-4 pb-[calc(5.5rem+env(safe-area-inset-bottom))] pt-4 sm:px-6 md:pb-6 xl:max-w-6xl 2xl:max-w-7xl">
          <p className="flex items-center gap-2.5">
            {/* wordmark em texto puro — a mesma construção do header dos
                e-mails e do /logo-realiza.png da sidebar (REALIZA claro +
                ponto amarelo + VC lime) */}
            <span className="text-sm font-black italic tracking-tight">
              <span className="text-white">REALIZA</span>
              <span className="text-[var(--role-mentorado)]">.</span>
              <span className="text-[var(--brand-lime)]">VC</span>
            </span>
            <span className="text-xs not-italic text-white/50">
              Programa de Mentoria Social
            </span>
          </p>
          <nav
            aria-label="Rodapé"
            className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-white/60"
          >
            {/* --ring padrão falha sobre ink — o ring do foco usa lime.
                min-h-11 mobile / min-h-8 desktop: o link text-xs sozinho
                ficava abaixo até do mínimo AA (24px, WCAG 2.5.8) */}
            <Link
              href="/privacidade"
              className="inline-flex min-h-11 sm:min-h-8 items-center rounded-sm underline-offset-2 outline-none transition-colors hover:text-white hover:underline focus-visible:ring-2 focus-visible:ring-[var(--brand-lime)]"
            >
              Privacidade e LGPD
            </Link>
            <a
              href="mailto:mentoria@realiza.vc"
              className="inline-flex min-h-11 sm:min-h-8 items-center rounded-sm underline-offset-2 outline-none transition-colors hover:text-white hover:underline focus-visible:ring-2 focus-visible:ring-[var(--brand-lime)]"
            >
              mentoria@realiza.vc
            </a>
          </nav>
        </div>
      </footer>
    );
  }

  return (
    <footer className={className}>
      <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-xs text-muted-foreground">
        <span>Realiza.vc · Programa de Mentoria Social</span>
        <span aria-hidden className="text-border">·</span>
        {/* min-h-11 mobile / min-h-8 desktop: os links text-xs ficavam
            abaixo até do mínimo AA (24px) — e a variante light não tinha
            anel de foco explícito */}
        <Link href="/privacidade" className="inline-flex min-h-11 sm:min-h-8 items-center rounded-sm underline-offset-2 outline-none transition-colors hover:text-foreground hover:underline focus-visible:ring-3 focus-visible:ring-ring/50">
          Privacidade e LGPD
        </Link>
        <span aria-hidden className="text-border">·</span>
        <a href="mailto:mentoria@realiza.vc" className="inline-flex min-h-11 sm:min-h-8 items-center rounded-sm underline-offset-2 outline-none transition-colors hover:text-foreground hover:underline focus-visible:ring-3 focus-visible:ring-ring/50">
          mentoria@realiza.vc
        </a>
      </div>
    </footer>
  );
}
