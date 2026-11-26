import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Destino contextual do estado terminal de uma resposta — montado no
 *  server component, que sabe papel e origem; o client só renderiza. */
export type DestinoPosResposta = {
  href: string;
  label: string;
};

/** Único CTA primário do sucesso pós-resposta. Anônimo não recebe botão:
 *  num link público não há destino honesto pra inventar. */
export function CtaPosResposta({
  destino,
}: {
  destino?: DestinoPosResposta | null;
}) {
  if (!destino) return null;
  return (
    <Link
      href={destino.href}
      className={cn(buttonVariants(), "mt-5")}
    >
      {destino.label}
    </Link>
  );
}
