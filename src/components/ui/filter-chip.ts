import { cn } from "cn"

/* Chip de filtro: um idioma só pra toggles de lista. Ativo = pill escuro
   (lime fica reservado a aria-current/navegação); min-h-11 no toque,
   sm:min-h-8 no desktop. Dots de status e contagens vivem dentro do chip. */
export const filterChipCls = (ativo: boolean) =>
  cn(
    "inline-flex min-h-11 items-center gap-1.5 rounded-full border px-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:min-h-8",
    ativo
      ? "border-foreground bg-foreground text-background"
      : "border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground"
  )
