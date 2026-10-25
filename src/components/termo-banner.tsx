import Link from "next/link";
import { ArrowRight, Signature } from "@phosphor-icons/react/dist/ssr";

/** Faixa do termo de adesão pendente — a página decide quando mostrar
 *  (assinatura null ou ≠ 'assinado'); aqui é só o visual. Uma linha só, alvo
 *  de 44px: é um passo de cadastro, não o assunto da tela. A faixa inteira é
 *  o link, então há uma ação só. Cor de pendência acompanhável (warn), nos
 *  tokens -bg/-border/-text — discreta, sem tingir a tela. */
export function TermoBanner() {
  return (
    <Link
      href="/assinar"
      className="flex min-h-11 items-center gap-2 rounded-lg border border-[var(--warn-border)] bg-[var(--warn-bg)] px-4 text-sm text-[var(--warn-text)] transition-colors hover:bg-[var(--warn)]/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <Signature size={15} aria-hidden className="shrink-0" />
      <span className="min-w-0 flex-1 truncate">
        <span className="font-medium">Assine o termo de adesão</span>
        <span className="hidden sm:inline">
          {" "}· pendente para completar o cadastro
        </span>
      </span>
      <ArrowRight size={14} aria-hidden className="shrink-0" />
    </Link>
  );
}
