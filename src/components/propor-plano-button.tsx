"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Handshake } from "@phosphor-icons/react";
import { proporPlano } from "@/lib/actions-plano";
import { toast } from "@/lib/toast";
import { Button } from "@/components/ui/button";

/** "Propor o plano" (513): grava o escopo que a ficha acabou de mostrar
 *  via plano_propor — a RPC revalida papel, datas e recesso. Quem pode
 *  propor (mentor da dupla, supervisor ou coordenação) decide na tela só
 *  SE o botão aparece; a permissão mora no banco. */
export function ProporPlanoButton({
  duplaId,
  ritmo,
}: {
  duplaId: string;
  /** Ritmo devolvido pelo planner — a RPC grava verbatim. */
  ritmo: number;
}) {
  const router = useRouter();
  const [pendente, iniciar] = useTransition();
  return (
    <Button
      size="sm"
      disabled={pendente}
      onClick={() =>
        iniciar(async () => {
          try {
            const r = await proporPlano(duplaId, ritmo);
            if ("error" in r) {
              toast.error(r.error);
              return;
            }
            toast.success(
              r.demo
                ? "Modo demo: nada é gravado de verdade."
                : "Plano proposto. Ele começa a valer quando os dois lados aceitarem."
            );
            router.refresh();
          } catch {
            toast.error("Sem conexão. Tente de novo.");
          }
        })
      }
    >
      <Handshake aria-hidden />
      Propor o plano pra dupla
    </Button>
  );
}
