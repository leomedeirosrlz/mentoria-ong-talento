"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { marcarNaoAconteceu, desfazerNaoAconteceu } from "@/lib/actions";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";

export function NaoAconteceuButton({
  encontroId,
  duplaId,
}: {
  encontroId: string;
  duplaId: string;
}) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const router = useRouter();

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={
        <Button variant="ghost" size="sm">
          Não aconteceu
        </Button>
      } />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>O encontro não aconteceu?</DialogTitle>
        </DialogHeader>
        <DialogDescription className="leading-relaxed">
          O encontro ficará marcado como não realizado. Se foi um engano, você pode desfazer depois.
        </DialogDescription>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button
            variant="destructive"
            disabled={pending}
            onClick={() =>
              start(async () => {
                try {
                  const res = await marcarNaoAconteceu(encontroId, duplaId);
                  if (res?.error) toast.error(res.error);
                  else {
                    toast.success("Encontro marcado como não realizado.");
                    setOpen(false);
                    router.refresh();
                  }
                } catch {
                  toast.error("Sem conexão — tente de novo.");
                }
              })
            }
          >
            {pending ? "Salvando…" : "Sim, não aconteceu"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function DesfazerNaoAconteceuButton({
  encontroId,
  duplaId,
}: {
  encontroId: string;
  duplaId: string;
}) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const router = useRouter();

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={
        <Button variant="outline" size="sm">
          Desfazer
        </Button>
      } />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Desfazer &ldquo;não realizado&rdquo;?</DialogTitle>
        </DialogHeader>
        <DialogDescription className="leading-relaxed">
          O encontro voltará a ficar agendado na data original.
        </DialogDescription>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button
            disabled={pending}
            onClick={() =>
              start(async () => {
                try {
                  const res = await desfazerNaoAconteceu(encontroId, duplaId);
                  if (res?.error) toast.error(res.error);
                  else {
                    toast.success("O encontro voltou a ficar agendado.");
                    setOpen(false);
                    router.refresh();
                  }
                } catch {
                  toast.error("Sem conexão — tente de novo.");
                }
              })
            }
          >
            {pending ? "Salvando…" : "Voltar para agendado"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
