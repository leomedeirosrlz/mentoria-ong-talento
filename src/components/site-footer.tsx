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
            {/* glifo da marca: os dois discos sobrepostos da dupla
                (precedente DuplaAvatares) */}
            <span aria-hidden className="inline-flex">
              <span className="size-2.5 rounded-full bg-[var(--brand-lime)]" />
              <span className="-ml-1 size-2.5 rounded-full bg-[var(--role-mentorado)]" />
            </span>
            <span className="text-sm font-semibold tracking-tight text-white">
              Realiza.vc
            </span>
            <span className="text-xs text-white/50">
              Programa de Mentoria Social
            </span>
          </p>
          <nav
            aria-label="Rodapé"
            className="flex items-center gap-x-4 text-xs text-white/60"
          >
            {/* --ring padrão falha sobre ink — o ring do foco usa lime */}
            <Link
              href="/privacidade"
              className="rounded-sm underline-offset-2 outline-none transition-colors hover:text-white hover:underline focus-visible:ring-2 focus-visible:ring-[var(--brand-lime)]"
            >
              Privacidade e LGPD
            </Link>
            <a
              href="mailto:mentoria@realiza.vc"
              className="rounded-sm underline-offset-2 outline-none transition-colors hover:text-white hover:underline focus-visible:ring-2 focus-visible:ring-[var(--brand-lime)]"
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
      <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span>Realiza.vc · Programa de Mentoria Social</span>
        <span aria-hidden className="text-border">·</span>
        <Link href="/privacidade" className="underline-offset-2 transition-colors hover:text-foreground hover:underline">
          Privacidade e LGPD
        </Link>
        <span aria-hidden className="text-border">·</span>
        <a href="mailto:mentoria@realiza.vc" className="underline-offset-2 transition-colors hover:text-foreground hover:underline">
          mentoria@realiza.vc
        </a>
      </div>
    </footer>
  );
}
