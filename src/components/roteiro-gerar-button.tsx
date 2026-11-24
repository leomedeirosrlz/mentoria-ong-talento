"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { FilePlus, SpinnerGap } from "@phosphor-icons/react";
import { toast } from "@/lib/toast";
import { gerarRoteiroSemana } from "@/lib/actions-roteiros";
import { Button } from "@/components/ui/button";

/** "Gerar rascunho" — a equipe nasce a semana sob demanda (020 FR-004);
 *  o rascunho abre no editor da mesma página depois do refresh. */
export function GerarRoteiroButton({
  duplaId,
  numero,
}: {
  duplaId: string;
  numero: number;
}) {
  const router = useRouter();
  const [pendente, iniciar] = useTransition();
  return (
    <Button
      size="sm"
      disabled={pendente}
      className="min-h-11 sm:min-h-8"
      onClick={() =>
        iniciar(async () => {
          const r = await gerarRoteiroSemana(duplaId, numero);
          if ("error" in r && r.error) {
            toast.error(r.error);
            return;
          }
          toast.success("Rascunho gerado. Revise e publique.");
          router.refresh();
        })
      }
    >
      {pendente ? (
        <SpinnerGap aria-hidden className="animate-spin" />
      ) : (
        <FilePlus aria-hidden />
      )}
      Gerar rascunho desta semana
    </Button>
  );
}
