"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CircleNotch, HandHeart } from "@phosphor-icons/react";
import { toast } from "sonner";
import { pedirApoio } from "@/lib/actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

/** Pedido de apoio direto, sem depender do registro semanal — o mentor
 *  sinaliza quando precisa (não só depois de um encontro). A coordenação e o
 *  supervisor da dupla recebem notificação na hora; a mensagem é opcional,
 *  mas um contexto curto ajuda quem atende. */
export function PedirApoioDialog({
  duplaId,
  trigger,
}: {
  duplaId: string;
  /** Elemento do trigger — cada ponto da UI escolhe a aparência. */
  trigger: React.ReactElement;
}) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const router = useRouter();

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const mensagem = String(new FormData(e.currentTarget).get("mensagem") ?? "");
    start(async () => {
      try {
        const res = await pedirApoio(duplaId, mensagem);
        if (res?.error) {
          toast.error(res.error);
        } else {
          toast.success("Pedido enviado — a coordenação recebeu o aviso.");
          setOpen(false);
          router.refresh();
        }
      } catch {
        toast.error("Sem conexão. Tente de novo.");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Pedir apoio à coordenação</DialogTitle>
        </DialogHeader>
        <DialogDescription className="leading-relaxed">
          A coordenação e o supervisor da dupla recebem um aviso na hora e
          entram em contato com você.
        </DialogDescription>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="apoio-mensagem">
              O que está rolando? <span className="font-normal text-muted-foreground">(opcional)</span>
            </Label>
            <Textarea
              id="apoio-mensagem"
              name="mensagem"
              rows={3}
              maxLength={500}
              placeholder="Ex.: o mentorado não responde há duas semanas"
            />
          </div>
          <Button type="submit" className="w-full" disabled={pending} aria-busy={pending}>
            {pending ? (
              <CircleNotch size={16} className="animate-spin" aria-hidden />
            ) : (
              <HandHeart size={16} aria-hidden />
            )}
            {pending ? "Enviando…" : "Enviar pedido"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
