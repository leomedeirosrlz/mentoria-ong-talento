"use client";

import { Checkbox as CheckboxPrimitive } from "@base-ui/react/checkbox";
import { Check, type Icon } from "@phosphor-icons/react";
import { cn } from "cn";

/** Caixa de seleção em card — declarações do onboarding (voluntário, LGPD).
 *  O card inteiro é o controle (clique/teclado via primitive), com tile de
 *  ícone, título + descrição e indicador que marca animado. Diferente do
 *  checkbox nativo enxuto dos forms internos: aqui a escolha é o conteúdo
 *  da tela, não um campo a mais. */
function CaixaSelecao({
  icon: Icon,
  titulo,
  descricao,
  className,
  ...props
}: CheckboxPrimitive.Root.Props & {
  icon: Icon;
  titulo: string;
  descricao: string;
}) {
  // contents não gera caixa própria — o wrapper só existe pra seletor
  // alcançar o <input type=checkbox> que o primitive renderiza como
  // IRMÃO do controle estilizado (form participation), escondendo-o
  return (
    <div className="contents [&_input]:hidden">
      <CheckboxPrimitive.Root
        data-slot="caixa-selecao"
        className={cn(
          "group flex w-full cursor-pointer items-center gap-3.5 rounded-2xl border border-border bg-card p-4 text-left transition-colors outline-none select-none hover:border-foreground/25 focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-default disabled:opacity-70 data-checked:border-primary/60 data-checked:bg-primary/[0.05]",
          className
        )}
        {...props}
      >
      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-muted text-muted-foreground transition-colors group-data-checked:bg-[var(--brand-lime)] group-data-checked:text-[var(--brand-ink)]">
        <Icon size={18} weight="fill" aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium">{titulo}</span>
        <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">
          {descricao}
        </span>
      </span>
      <span className="grid size-5 shrink-0 place-items-center rounded-md border border-border bg-background transition-colors group-data-checked:border-primary group-data-checked:bg-primary">
        <CheckboxPrimitive.Indicator
          keepMounted
          className="grid place-items-center text-white transition-transform duration-150 ease-snappy data-unchecked:scale-50 data-unchecked:opacity-0"
        >
          <Check size={13} weight="bold" aria-hidden />
        </CheckboxPrimitive.Indicator>
      </span>
      </CheckboxPrimitive.Root>
    </div>
  );
}

export { CaixaSelecao };
