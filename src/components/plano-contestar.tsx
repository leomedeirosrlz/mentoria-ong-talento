"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { X } from "@phosphor-icons/react";
import { responderPlano } from "@/lib/actions-plano";
import { toast } from "@/lib/toast";
import { Button } from "@/components/ui/button";

/** "Não serve pra mim" das homes (REALIZA-520): o mesmo gesto do card da
 *  ficha — um toque, a contestação encerra o plano e um acordo novo pode
 *  nascer por plano_propor. Outline pra não competir com o CTA primário. */
export function PlanoContestarButton({
  planoId,
  duplaId,
}: {
  planoId: string;
  duplaId?: string | null;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();

  return (
    <Button
      variant="ghost"
      size="sm"
      className="min-h-11 px-2 text-muted-foreground sm:min-h-8"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const r = await responderPlano(
            planoId,
            "contestar",
            undefined,
            duplaId ?? undefined
          );
          if ("error" in r) {
            toast.error(r.error);
            return;
          }
          toast.success("Combinado contestado. A equipe foi avisada.");
          router.refresh();
        })
      }
    >
      <X aria-hidden />
      Não serve pra mim
    </Button>
  );
}
