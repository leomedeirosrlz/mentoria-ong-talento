"use client";

import type { ReactNode } from "react";
import { Checkbox as CheckboxPrimitive } from "@base-ui/react/checkbox";
import { Check, Minus } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";

// A checkbox de linha do kit (025): um desenho só pros usos que eram
// `accent-*` nativo ou `peer sr-only` + span. O primitive é um span
// role=checkbox focável de verdade (Tab/Espaço de graça, focus-visible
// visível) e emite um input escondido ao lado — form nativo segue
// mandando name/value. Exceções declaradas na spec, que NÃO usam este
// componente: material-documento (affordance de doc/impressão),
// CaixaSelecao (card de onboarding) e filtro-opcoes (chip de filtro).

type CheckboxProps = CheckboxPrimitive.Root.Props & {
  /** "warn" cobre os usos que eram accent-[var(--warn)] — "Preciso de
   *  apoio"/"Preciso de ajuda". Default "ok". */
  tom?: "ok" | "warn";
};

function Checkbox({ className, tom = "ok", ...props }: CheckboxProps) {
  return (
    // contents não gera caixa própria — o wrapper só existe pra o input
    // que o primitive renderiza como IRMÃO do controle não virar item
    // de flex/grid no pai. Nada de display:none nele: o primitive já
    // esconde via clip e um required display:none quebra a validação
    // nativa do form ("control is not focusable" no Chrome)
    <span className="contents">
      <CheckboxPrimitive.Root
        data-slot="checkbox"
        className={cn(
          "group grid size-4.5 shrink-0 cursor-pointer place-items-center rounded-md border bg-card outline-none transition-colors select-none",
          "border-muted-foreground/40 hover:border-foreground",
          "focus-visible:ring-3 focus-visible:ring-ring/50",
          "aria-invalid:border-[var(--danger)]",
          "data-disabled:cursor-default data-disabled:opacity-60",
          tom === "warn"
            ? "data-checked:border-[var(--warn)] data-checked:bg-[var(--warn)] data-indeterminate:border-[var(--warn)] data-indeterminate:bg-[var(--warn)]"
            : "data-checked:border-[var(--ok)] data-checked:bg-[var(--ok)] data-indeterminate:border-[var(--ok)] data-indeterminate:bg-[var(--ok)]",
          className
        )}
        {...props}
      >
        <CheckboxPrimitive.Indicator
          keepMounted
          className="grid place-items-center text-[var(--status-foreground)] transition-transform duration-150 ease-snappy data-unchecked:scale-50 data-unchecked:opacity-0"
        >
          <Check
            size={13}
            weight="bold"
            aria-hidden
            className="col-start-1 row-start-1 group-data-indeterminate:hidden"
          />
          <Minus
            size={13}
            weight="bold"
            aria-hidden
            className="col-start-1 row-start-1 hidden group-data-indeterminate:block"
          />
        </CheckboxPrimitive.Indicator>
      </CheckboxPrimitive.Root>
    </span>
  );
}

/** Linha-rótulo (o caso dominante): o <label> abraça a caixa e o
 *  conteúdo livre — o input escondido dentro dele recebe o clique e
 *  vira o labeled control, então a linha toda alterna. Alvo >=44px. */
function CheckboxLinha({
  className,
  boxClassName,
  tom,
  children,
  ...props
}: CheckboxProps & {
  boxClassName?: string;
  children: ReactNode;
}) {
  return (
    <label
      className={cn(
        "flex min-h-11 cursor-pointer items-start gap-3 select-none",
        "has-data-disabled:cursor-default",
        className
      )}
    >
      <Checkbox
        tom={tom}
        className={cn("mt-px", boxClassName)}
        {...props}
      />
      <span className="min-w-0 flex-1">{children}</span>
    </label>
  );
}

export { Checkbox, CheckboxLinha };
