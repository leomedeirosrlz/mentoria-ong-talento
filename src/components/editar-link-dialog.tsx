"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { PencilSimple } from "@phosphor-icons/react";
import { toast } from "@/lib/toast";
import { salvarLinkEncontro } from "@/lib/actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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
  open: openProp,
  onOpenChange,
}: {
  encontroId: string;
  /** Link gravado — o campo abre preenchido; null = ainda não tem link. */
  linkAtual: string | null;
  /** Elemento do trigger — default é o lápis ghost pra fileira de chips.
   *  `null` suprime (o ⋯ da linha abre o dialog controlado). */
  trigger?: React.ReactElement | null;
  /** Chamado depois do refresh — a agenda usa pra re-render local se precisar. */
  onSaved?: () => void;
  /** Modo controlado (opcional) — o menu de ações abre o dialog direto. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const [openInterno, setOpenInterno] = useState(false);
  const open = openProp ?? openInterno;
  const [pending, start] = useTransition();
  const router = useRouter();

  function mudaOpen(o: boolean) {
    setOpenInterno(o);
    onOpenChange?.(o);
  }

  function salvar(link: string | null) {
    start(async () => {
      try {
        const res = await salvarLinkEncontro(encontroId, link);
        if (res?.error) {
          toast.error(res.error);
          return;
        }
        toast.success(link ? "Link atualizado." : "Link removido.");
        mudaOpen(false);
        router.refresh();
        onSaved?.();
      } catch {
        toast.error("Sem conexão. Tente de novo.");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={mudaOpen}>
      {trigger !== null && (
        <DialogTrigger
          render={
            trigger ?? (
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label="Editar link da chamada"
                title="Editar link da chamada"
                className="shrink-0 text-muted-foreground"
              >
                <PencilSimple aria-hidden />
              </Button>
            )
          }
        />
      )}
      <DialogContent size="md">
        <DialogHeader>
          <DialogTitle>Editar link da chamada</DialogTitle>
          <DialogDescription>
            O link da videochamada que a dupla usa pra entrar no encontro.
          </DialogDescription>
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
              placeholder="Meet, Teams, Zoom…"
              defaultValue={linkAtual ?? ""}
            />
            <p className="text-xs text-muted-foreground">
              O horário continua o mesmo. Só o link muda.
            </p>
          </div>
          <DialogFooter>
            {/* remover é legítimo: a dupla pode ter migrado a chamada pra
                fora — some quando não há o que remover. Fica à esquerda do
                footer: ação terciária, longe do submit */}
            {linkAtual && (
              <Button
                type="button"
                variant="ghost"
                className="text-muted-foreground sm:me-auto"
                disabled={pending}
                onClick={() => salvar(null)}
              >
                Remover link
              </Button>
            )}
            <Button
              type="button"
              variant="outline"
              onClick={() => mudaOpen(false)}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Salvando…" : "Salvar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
