"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CircleNotch, Trash } from "@phosphor-icons/react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export function ConfirmDeleteButton({
  titulo,
  descricao,
  onConfirm,
  trigger,
  open,
  onOpenChange,
  sucesso = "Excluído.",
  acao = "Excluir",
  dica,
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
  /** tooltip no gatilho — só quando o trigger é o botão-ícone padrão ou um
   *  trigger próprio simples (não funciona com gatilhos compostos) */
  dica?: string;
}) {
  const [interno, setInterno] = useState(false);
  const [pending, start] = useTransition();
  const router = useRouter();
  const isOpen = open ?? interno;
  const setOpen = onOpenChange ?? setInterno;

  const gatilho = trigger ?? (
    <Button variant="ghost" size="icon" aria-label="Excluir">
      <Trash size={15} />
    </Button>
  );

  return (
    <Tooltip>
      <Dialog open={isOpen} onOpenChange={setOpen}>
      {open === undefined && (
        <DialogTrigger
          render={
            dica ? <TooltipTrigger render={gatilho} /> : gatilho
          }
        />
      )}
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{titulo}</DialogTitle>
        </DialogHeader>
        <DialogDescription className="leading-relaxed">{descricao}</DialogDescription>
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
                  toast.error("Sem conexão. Tente de novo.");
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
      {dica && <TooltipContent>{dica}</TooltipContent>}
    </Tooltip>
  );
}
