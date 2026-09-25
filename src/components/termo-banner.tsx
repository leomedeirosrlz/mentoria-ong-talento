import Link from "next/link";
import { ArrowRight, Signature } from "@phosphor-icons/react/dist/ssr";

/** Faixa "termo de adesão pendente" do home dos mentores — a página decide
 *  quando mostrar (assinatura null ou ≠ 'assinado'); aqui é só o visual.
 *  Clica o card inteiro: uma ação só, sem CTA competindo dentro do link. */
export function TermoBanner() {
  return (
    <Link
      href="/assinar"
      className="flex items-center gap-3 rounded-xl border border-[var(--warn)]/50 bg-[var(--warn)]/8 px-4 py-3 text-sm transition-colors hover:bg-[var(--warn)]/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <Signature
        size={18}
        aria-hidden
        className="shrink-0 text-[var(--warn-text)]"
      />
      <span className="min-w-0 flex-1">
        <span className="font-medium">Termo de adesão pendente</span>
        <span className="text-muted-foreground">
          {" "}
          · leia e assine pra completar seu cadastro.
        </span>
      </span>
      <ArrowRight
        size={15}
        aria-hidden
        className="shrink-0 text-muted-foreground"
      />
    </Link>
  );
}
