// Sleeping-Liza state (REALIZA-363): the honest face of provider-side
// exhaustion — rate limit/quota, provider 5xx, persistent timeout, or the
// provider being off entirely. The mascot already owns the "sonolento"
// pose (closed-eye fenda, heavy breathing loop); this card adds the moon
// badge and the warm copy. Server-safe on purpose (no "use client",
// Phosphor via dist/ssr): it renders on the /ia page and inside the
// client bubble alike. The `--pausa` palette is the canonical "pausada"
// status — sleeping is exactly that, not an error (no --warn).

import { Moon } from "@phosphor-icons/react/dist/ssr";
import { LizaBlob } from "@/components/liza/liza-blob";
import { cn } from "@/lib/utils";

export function LizaDormindo({
  compacto,
  titulo = "A Liza está dormindo",
  detalhe,
  className,
  children,
}: {
  /** smaller footprint — chat bubbles, per-model cards */
  compacto?: boolean;
  /** "Este modelo dormiu" on the per-model cards of /ia */
  titulo?: string;
  /** one extra muted line — operational context for the coord page */
  detalhe?: string;
  className?: string;
  /** CTA slot — whatever "come back later" means on the surface */
  children?: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-xl border border-[var(--pausa-border)] bg-[var(--pausa-bg)] text-[var(--pausa-text)]",
        compacto ? "px-3 py-2.5" : "px-4 py-3",
        className
      )}
    >
      <span className="relative grid shrink-0 place-items-center">
        <LizaBlob tamanho={compacto ? 40 : 56} estado="sonolento" />
        <span
          aria-hidden
          className="absolute -right-1 -top-0.5 grid size-5 place-items-center rounded-full border border-border/60 bg-popover text-muted-foreground shadow-[var(--shadow-border)]"
        >
          <Moon size={11} weight="fill" />
        </span>
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-foreground">{titulo}</p>
        <p
          className={cn(
            "mt-0.5 leading-relaxed text-muted-foreground",
            compacto ? "text-xs" : "text-sm"
          )}
        >
          Ajudou tanta gente por aqui que acabou ficando exausta. Volte mais
          tarde que ela já deve estar de pé.
        </p>
        {detalhe ? (
          <p className="mt-1 text-xs text-muted-foreground sm:text-[11px]">
            {detalhe}
          </p>
        ) : null}
        {children ? <div className="mt-2">{children}</div> : null}
      </div>
    </div>
  );
}
