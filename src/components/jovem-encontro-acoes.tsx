"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  desmarcarEncontro,
  marcarAconteceuJovem,
  marcarNaoAconteceuJovem,
} from "@/lib/actions";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";

/** "Aconteceu" do jovem (0121) — o encontro que já passou vira realizado
 *  pela ponta dele: a avaliação abre na hora e o próximo passo da jornada
 *  libera sem esperar o registro do mentor (que é avisado). Um toque, sem
 *  dialog: confirmar um fato bom não pede fricção. */
export function AconteceuJovem({ encontroId }: { encontroId: string }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <Button
      size="sm"
      disabled={pending}
      onClick={() =>
        start(async () => {
          try {
            const res = await marcarAconteceuJovem(encontroId);
            if (res?.error) toast.error(res.error);
            else {
              toast.success("Encontro confirmado. Conta pra gente como foi.");
              router.refresh();
            }
          } catch {
            toast.error("Sem conexão. Tente de novo.");
          }
        })
      }
    >
      {pending ? "Salvando…" : "Aconteceu"}
    </Button>
  );
}

/** "Não aconteceu" do jovem (0072) — encontro agendado já passado, qualquer
 *  trilha da dupla ativa. A cópia não promete desfazer: quem reverte a
 *  marcação é o mentor (o jovem não tem update em encontros). */
export function NaoAconteceuJovem({ encontroId }: { encontroId: string }) {
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
          O encontro ficará marcado como não realizado. Se rolou de verdade
          ou foi engano, seu mentor registra como foi na ficha dele.
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
                  const res = await marcarNaoAconteceuJovem(encontroId);
                  if (res?.error) toast.error(res.error);
                  else {
                    toast.success("Encontro marcado como não realizado.");
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

/** "Desmarcar" do jovem (0072) — tira o agendado FUTURO da agenda; a RPC é
 *  bilateral, então o gesto vale pra dupla inteira (o mentor é avisado pelo
 *  sino). Passado não se desmarca — vira "não aconteceu". */
export function DesmarcarEncontroJovem({ encontroId }: { encontroId: string }) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const router = useRouter();

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={
        <Button variant="ghost" size="sm">
          Desmarcar
        </Button>
      } />
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle>Desmarcar o encontro?</DialogTitle>
        </DialogHeader>
        <DialogDescription className="leading-relaxed">
          O encontro sai da agenda de vocês dois e pode ser marcado de novo
          quando combinarem uma nova data.
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
                  const res = await desmarcarEncontro(encontroId);
                  if (res?.error) toast.error(res.error);
                  else {
                    toast.success("Encontro desmarcado.");
                    setOpen(false);
                    router.refresh();
                  }
                } catch {
                  toast.error("Sem conexão. Tente de novo.");
                }
              })
            }
          >
            {pending ? "Salvando…" : "Desmarcar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
