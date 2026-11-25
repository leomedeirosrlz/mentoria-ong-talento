import Link from "next/link";
import { CaretRight } from "@phosphor-icons/react/dist/ssr";
import { buttonVariants } from "@/components/ui/button";
import type { ItemPrecisaDeVoce } from "@/lib/sua-semana";
import { cn } from "@/lib/utils";

/** "O que precisa de você" (REALIZA-520) — a fila do staff que cruza
 *  plano e recesso: uma linha por dupla, o motivo antes de qualquer
 *  rótulo, e a saída é a ficha já no lugar do gesto. Não é uma lista de
 *  "planos em risco": o auxiliar cobra e aponta o caminho, não responde
 *  pela dupla. Sem itens, a seção não existe (a home fica quieta). */
export function PrecisaDeVoce({
  itens,
  total,
}: {
  itens: ItemPrecisaDeVoce[];
  /** total derivado antes do corte — quando passa dos itens mostrados,
   *  a saída é o panorama das duplas */
  total?: number;
}) {
  if (itens.length === 0) return null;
  const restantes = (total ?? itens.length) - itens.length;
  return (
    <section aria-labelledby="precisa-voce-titulo" className="space-y-3">
      <h2 id="precisa-voce-titulo" className="text-base font-semibold">
        O que precisa de você
      </h2>
      <ul className="space-y-2">
        {itens.map((i) => (
          <li
            key={i.duplaId}
            className="animate-enter flex flex-wrap items-center justify-between gap-x-3 gap-y-2 rounded-xl bg-card px-4 py-3 shadow-[var(--shadow-border)]"
          >
            <p className="min-w-0 text-sm">
              <Link
                href={i.href}
                className="rounded-sm font-semibold underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {i.nomes}
              </Link>
              <span className="text-muted-foreground"> · {i.motivo.texto}</span>
            </p>
            <Link
              href={i.href}
              className={cn(
                buttonVariants({ variant: "outline", size: "sm" }),
                "group min-h-11 sm:min-h-8"
              )}
            >
              {i.acao}
              <CaretRight
                aria-hidden
                className="transition-transform group-hover:translate-x-0.5"
              />
            </Link>
          </li>
        ))}
      </ul>
      {restantes > 0 && (
        <p className="text-sm text-muted-foreground">
          Mais {restantes} {restantes === 1 ? "dupla pede" : "duplas pedem"}{" "}
          atenção.{" "}
          <Link
            href="/duplas"
            className="inline-flex min-h-11 items-center rounded-sm font-semibold underline underline-offset-2 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:min-h-0"
          >
            Ver o panorama
          </Link>
          .
        </p>
      )}
    </section>
  );
}
