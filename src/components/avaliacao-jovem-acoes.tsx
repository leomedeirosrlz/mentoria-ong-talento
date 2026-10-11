"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, HandHeart, LinkSimple } from "@phosphor-icons/react";
import { toast } from "sonner";
import { resolverApoioJovem } from "@/lib/actions-avaliacao";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const EASE = "ease-[cubic-bezier(0.2,0,0,1)]";

/** Copia o link público /avaliar/<token> pra coord repassar ao jovem sem
 *  login — mesmo feedback do CopiarChamada (LinkSimple → Check ~1,6s).
 *  O token é um fator de posse: o botão só existe pra quem a policy
 *  avaliacao_links deixa ler (coordenação). */
export function CopiarLinkAvaliacao({ url }: { url: string }) {
  const [copiado, setCopiado] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    []
  );

  async function copiar() {
    if (!navigator.clipboard?.writeText) {
      toast.error("Não consegui copiar o link da avaliação.");
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopiado(true);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopiado(false), 1600);
    } catch {
      toast.error("Não consegui copiar o link da avaliação.");
    }
  }

  return (
    <Button type="button" variant="outline" size="sm" onClick={copiar}>
      <span
        aria-hidden="true"
        className="relative inline-flex size-3.5 items-center justify-center"
      >
        <LinkSimple
          className={cn(
            `transition-all duration-150 ${EASE}`,
            copiado && "scale-25 opacity-0 blur-[4px]"
          )}
        />
        <Check
          weight="bold"
          className={cn(
            `absolute text-[var(--ok)] transition-all duration-150 ${EASE}`,
            copiado
              ? "scale-100 opacity-100 blur-[0px]"
              : "scale-25 opacity-0 blur-[4px]"
          )}
        />
      </span>
      <span className="grid">
        <span
          aria-hidden={copiado}
          className={cn(
            `col-start-1 row-start-1 transition-opacity duration-150 ${EASE}`,
            copiado && "opacity-0"
          )}
        >
          Copiar link da avaliação
        </span>
        <span
          aria-hidden={!copiado}
          className={cn(
            `col-start-1 row-start-1 transition-opacity duration-150 ${EASE}`,
            copiado ? "opacity-100" : "opacity-0"
          )}
        >
          Copiado
        </span>
      </span>
    </Button>
  );
}

/** "Pedido de ajuda atendido" — o par do ResolverApoioButton do mentor,
 *  mas no canal do jovem (avaliacoes_encontro.pedir_apoio, 0071). Quem
 *  respondeu sem login (respondido_por null) recebe o cuidado por
 *  WhatsApp da coordenação; quem tem login recebe o sino "foi visto". */
export function ResolverApoioJovemButton({
  avaliacaoId,
  duplaId,
}: {
  avaliacaoId: string;
  duplaId: string;
}) {
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <Button
      size="sm"
      variant="outline"
      className="shrink-0 border-[var(--danger)]/50 text-[var(--danger)]"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const res = await resolverApoioJovem(avaliacaoId, duplaId);
          if (res?.error) toast.error(res.error);
          else {
            toast.success("Pedido de ajuda atendido.");
            router.refresh();
          }
        })
      }
    >
      <HandHeart size={14} /> Marcar ajuda como atendida
    </Button>
  );
}
