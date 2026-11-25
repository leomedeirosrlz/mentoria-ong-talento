"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { X } from "@phosphor-icons/react";
import { responderPlano } from "@/lib/actions-plano";
import { toast } from "@/lib/toast";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/** "Não serve pra mim" das homes (REALIZA-520): o mesmo gesto do card da
 *  ficha — a contestação encerra o plano e um acordo novo pode nascer
 *  por plano_propor. Outline pra não competir com o CTA primário.
 *  QA 25/11: como o gesto encerra o combinado, pede confirmação antes
 *  do POST — mesmo diálogo do card. */
export function PlanoContestarButton({
  planoId,
  duplaId,
}: {
  planoId: string;
  duplaId?: string | null;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [confirmando, setConfirmando] = useState(false);
  // resposta dada nesta sessão trava o botão — o revalidate demora um
  // tiquinho e o gesto não pode viajar duplicado
  const [respondido, setRespondido] = useState(false);

  const responder = () =>
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
      setRespondido(true);
      toast.success("Combinado contestado. A equipe foi avisada.");
      router.refresh();
    });

  if (respondido) return null;

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        className="min-h-11 px-2 text-muted-foreground sm:min-h-8"
        disabled={pending}
        onClick={() => setConfirmando(true)}
      >
        <X aria-hidden />
        Não serve pra mim
      </Button>
      <Dialog open={confirmando} onOpenChange={setConfirmando}>
        <DialogContent size="sm">
          <DialogHeader>
            <DialogTitle>O plano não serve pra você?</DialogTitle>
          </DialogHeader>
          <DialogDescription className="leading-relaxed">
            A contestação encerra esse combinado. A equipe é avisada e um
            plano novo pode nascer da conversa de vocês.
          </DialogDescription>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setConfirmando(false)}
            >
              Voltar
            </Button>
            <Button
              variant="destructive"
              disabled={pending}
              onClick={() => {
                setConfirmando(false);
                responder();
              }}
            >
              Sim, não serve pra mim
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
