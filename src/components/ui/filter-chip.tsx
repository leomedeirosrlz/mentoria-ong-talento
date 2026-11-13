import type { HTMLAttributes, ReactNode } from "react"
import { cn } from "cn"
import { FadeX } from "@/components/fade-x"

/* Chip de filtro: um idioma só pra toggles de lista. Ativo = pill escuro
   (lime fica reservado a aria-current/navegação); min-h-11 no toque,
   sm:min-h-8 no desktop. Dots de status e contagens vivem dentro do chip. */
export const filterChipCls = (ativo: boolean) =>
  cn(
    "inline-flex min-h-11 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:min-h-8",
    ativo
      ? "border-foreground bg-foreground text-background"
      : "border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground"
  )

/* Régua de pills de filtro: nunca quebra pra segunda linha — o overflow
   vira scroll horizontal com fade na ponta (o fade é a affordance, a
   barra fica escondida). Mesma regra no mobile e no desktop.
   -my-1/py-1: overflow-x-auto computa overflow-y:auto e cliparia o
   focus-visible:ring dos chips. min-w-0 deixa a régua encolher dentro de
   um flex pai em vez de estourar a linha. */
export function FilterChipRow({
  tag,
  className,
  children,
  ...rest
}: {
  /** semântica do scrollport — "ul" quando os chips são <li>. */
  tag?: "div" | "nav" | "ul" | "ol";
  children: ReactNode;
} & HTMLAttributes<HTMLElement>) {
  return (
    <FadeX
      tag={tag}
      className={cn(
        "-my-1 flex min-w-0 flex-nowrap items-center gap-2 overflow-x-auto overscroll-x-contain py-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
        className
      )}
      {...rest}
    >
      {children}
    </FadeX>
  )
}
