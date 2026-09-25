import type { ReactNode } from "react";

/** Cabeçalho de página: kicker → título → meta, com ações à direita.
 *  `kicker` em texto vira overline; em nó (VoltarLink) renderiza como veio —
 *  o overline não vaza pro link. Badges podem ir dentro de `title`: o h1 é
 *  flex-wrap e alinha os selos na mesma linha. `media` ancora um avatar à
 *  esquerda do bloco de texto; `children` entra na coluna de texto, abaixo
 *  do meta (chips de contato, por exemplo). */
export function PageHeader({
  kicker,
  title,
  meta,
  actions,
  media,
  children,
  className,
}: {
  kicker?: ReactNode;
  title: ReactNode;
  meta?: ReactNode;
  actions?: ReactNode;
  media?: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <header className={className}>
      {kicker != null &&
        (typeof kicker === "string" ? (
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            {kicker}
          </p>
        ) : (
          kicker
        ))}
      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-3">
        {media}
        <div className="min-w-0 flex-1">
          <h1 className="flex flex-wrap items-center gap-2 text-2xl font-semibold tracking-tight text-balance">
            {title}
          </h1>
          {meta != null && (
            <div className="mt-1.5 text-sm text-muted-foreground">{meta}</div>
          )}
          {children}
        </div>
        {actions != null && (
          // self-start: botões ficam na linha do título mesmo com meta alta
          <div className="flex flex-wrap items-center gap-2 self-start">
            {actions}
          </div>
        )}
      </div>
    </header>
  );
}
