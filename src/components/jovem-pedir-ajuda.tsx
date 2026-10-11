"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CircleNotch, HandHeart } from "@phosphor-icons/react";
import { toast } from "sonner";
import { pedirAjudaJovem } from "@/lib/actions";
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

/** "Preciso de ajuda" do jovem (REALIZA-108) — canal de segurança de menor,
 *  sempre à mão na home. O pedido é uma notificação `pedido_apoio` pros
 *  adultos dele (coordenação + mentor/supervisor das duplas — destinatário
 *  validado pela policy da 0069 contra jovem_contatos). Copy honesta: a
 *  equipe é avisada e entra em contato; urgência vai pelo WhatsApp direto. */
export function PedirAjudaDialog({
  trigger,
}: {
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
        const res = await pedirAjudaJovem(mensagem);
        if (res?.error) {
          toast.error(res.error);
        } else {
          toast.success("Pedido enviado — a equipe foi avisada e fala com você.");
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
          <DialogTitle>Pedir ajuda</DialogTitle>
        </DialogHeader>
        <DialogDescription className="leading-relaxed">
          A coordenação e os adultos da sua mentoria recebem um aviso na hora
          e entram em contato com você. Se for urgente, fale direto com eles
          pelo WhatsApp.
        </DialogDescription>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="ajuda-mensagem">
              O que está rolando?{" "}
              <span className="font-normal text-muted-foreground">(opcional)</span>
            </Label>
            <Textarea
              id="ajuda-mensagem"
              name="mensagem"
              rows={3}
              maxLength={500}
              placeholder="Ex.: estou com dificuldade de falar com meu mentor"
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
