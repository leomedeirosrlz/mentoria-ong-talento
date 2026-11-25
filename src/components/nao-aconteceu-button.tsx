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
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle>O encontro não aconteceu?</DialogTitle>
        </DialogHeader>
        <DialogDescription className="leading-relaxed">
          O encontro fica marcado como não feito. Se foi engano, é só desfazer depois.
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
                    toast.success("Encontro marcado como não aconteceu.");
                    setOpen(false);
                    router.refresh();
                  }
                } catch {
                  toast.error("Sem conexão. Tente de novo.");
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
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle>Desfazer a marcação?</DialogTitle>
        </DialogHeader>
        <DialogDescription className="leading-relaxed">
          O encontro volta para a data que estava marcada.
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
                    toast.success("Pronto. O encontro voltou para a data marcada.");
                    setOpen(false);
                    router.refresh();
                  }
                } catch {
                  toast.error("Sem conexão. Tente de novo.");
                }
              })
            }
          >
            {pending ? "Salvando…" : "Sim, desfazer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
