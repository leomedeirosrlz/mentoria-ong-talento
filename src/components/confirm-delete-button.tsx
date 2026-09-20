"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CircleNotch, Trash } from "@phosphor-icons/react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";

export function ConfirmDeleteButton({
  titulo,
  descricao,
  onConfirm,
  trigger,
  open,
  onOpenChange,
  sucesso = "Excluído.",
  acao = "Excluir",
}: {
  titulo: string;
  descricao: string;
  onConfirm: () => Promise<{ error?: string; ok?: boolean }>;
  trigger?: React.ReactElement;
  /** controlado externamente (ex.: aberto via dropdown) */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** toast de sucesso — nomeie a entidade ("Cadastro de X excluído.") */
  sucesso?: string;
  /** verbo do botão de confirmação — "Desativar", "Excluir" (default)… */
  acao?: string;
}) {
  const [interno, setInterno] = useState(false);
  const [pending, start] = useTransition();
  const router = useRouter();
  const isOpen = open ?? interno;
  const setOpen = onOpenChange ?? setInterno;

  return (
    <Dialog open={isOpen} onOpenChange={setOpen}>
      {open === undefined && (
        <DialogTrigger
          render={
            trigger ?? (
              <Button variant="ghost" size="icon" aria-label="Excluir">
                <Trash size={15} />
              </Button>
            )
          }
        />
      )}
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{titulo}</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground leading-relaxed">{descricao}</p>
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
                  const res = await onConfirm();
                  if (res?.error) toast.error(res.error);
                  else {
                    toast.success(sucesso);
                    setOpen(false);
                    router.refresh();
                  }
                } catch {
                  toast.error("Sem conexão — tente de novo.");
                }
              })
            }
          >
            {pending && <CircleNotch className="animate-spin" />}
            {pending ? `${acao.replace(/r$/, "")}ndo…` : acao}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
