"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { PencilSimple } from "@phosphor-icons/react";
import { toast } from "sonner";
import { salvarLinkEncontro } from "@/lib/actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/** Troca SÓ o link da chamada de um encontro agendado — o gesto morava
 *  enterrado no fluxo de remarcar, que pede motivo quando a data muda. Aqui
 *  a data não se mexe, então motivo nunca é cobrado. "Remover link" (ghost)
 *  só aparece quando há link gravado — esvaziar o campo também remove.
 *  Trigger default: lápis ghost size-11 sm:size-8, a mesma gramática de
 *  slot de linha do CopiarChamada icone. */
export function EditarLinkDialog({
  encontroId,
  linkAtual,
  trigger,
  onSaved,
}: {
  encontroId: string;
  /** Link gravado — o campo abre preenchido; null = ainda não tem link. */
  linkAtual: string | null;
  /** Elemento do trigger — default é o lápis ghost pra fileira de chips. */
  trigger?: React.ReactElement;
  /** Chamado depois do refresh — a agenda usa pra re-render local se precisar. */
  onSaved?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const router = useRouter();

  function salvar(link: string | null) {
    start(async () => {
      try {
        const res = await salvarLinkEncontro(encontroId, link);
        if (res?.error) {
          toast.error(res.error);
          return;
        }
        toast.success(link ? "Link atualizado." : "Link removido.");
        setOpen(false);
        router.refresh();
        onSaved?.();
      } catch {
        toast.error("Sem conexão. Tente de novo.");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          trigger ?? (
            <button
              type="button"
              aria-label="Editar link da chamada"
              title="Editar link da chamada"
              className="grid size-11 shrink-0 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:size-8"
            >
              <PencilSimple size={16} aria-hidden />
            </button>
          )
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar link da chamada</DialogTitle>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            const link = String(
              new FormData(e.currentTarget).get("link") ?? ""
            ).trim();
            salvar(link || null);
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="link">Link da chamada</Label>
            <Input
              id="link"
              name="link"
              type="url"
              placeholder="https://meet.google.com/…"
              defaultValue={linkAtual ?? ""}
            />
            <p className="text-xs text-muted-foreground">
              O horário continua o mesmo — só o link muda.
            </p>
          </div>
          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? "Salvando…" : "Salvar"}
          </Button>
          {/* remover é legítimo: a dupla pode ter migrado a chamada pra fora
              — some quando não há o que remover */}
          {linkAtual && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="w-full text-muted-foreground"
              disabled={pending}
              onClick={() => salvar(null)}
            >
              Remover link
            </Button>
          )}
        </form>
      </DialogContent>
    </Dialog>
  );
}
