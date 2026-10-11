import type { Icon } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";

/** Cartão de estado terminal das páginas públicas por token — módulo sem
 *  "use client" de propósito: a página server renderiza os estados
 *  estáticos e o AvaliarTokenFlow (client) reusa o mesmo card pro "já
 *  registrada" que a revalidação pós-submit manda de volta. */
export function EstadoCard({
  icon: Icon,
  titulo,
  acao,
  ok,
  children,
}: {
  icon: Icon;
  titulo: string;
  /** saída do beco — mailto pra equipe ou retry do mesmo link */
  acao?: { href: string; label: string };
  /** tom de sucesso — círculo lime pro estado "já respondida" */
  ok?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl bg-card p-6 text-center shadow-[var(--shadow-border)] sm:p-8">
      <div
        className={cn(
          "mx-auto grid size-12 place-items-center rounded-full",
          ok
            ? "bg-[var(--brand-lime)] text-[var(--brand-ink)]"
            : "bg-muted text-muted-foreground"
        )}
      >
        <Icon size={24} weight={ok ? "bold" : "regular"} aria-hidden />
      </div>
      <h1 className="mt-4 text-lg font-semibold">{titulo}</h1>
      <div className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">
        {children}
      </div>
      {acao && (
        <p className="mt-5">
          <a
            href={acao.href}
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            {acao.label}
          </a>
        </p>
      )}
    </div>
  );
}
