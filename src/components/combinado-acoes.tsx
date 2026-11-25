"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  DotsThreeVertical,
  PencilSimple,
  Trash,
} from "@phosphor-icons/react";
import { toast } from "sonner";
import type { Encaminhamento } from "@/lib/types";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { ConfirmDeleteButton } from "@/components/confirm-delete-button";
import { cn } from "@/lib/utils";

/** Menu ⋯ do combinado — Editar e Excluir. O mesmo nas duas superfícies do
 *  combinado: a aba Agora (EncaminhamentosList) e o card do encontro
 *  (CombinadosEncontro). Renderizar só quando o visitante pode editar —
 *  quem só marca feito (coordenação) não vê o ⋯. */
export function CombinadoMenu({
  descricao,
  onEditar,
  onExcluir,
  className,
}: {
  /** Vai no aria-label do trigger — distingue os itens pra leitor de tela. */
  descricao: string;
  onEditar: () => void;
  onExcluir: () => void;
  className?: string;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={`Ações do combinado "${descricao}"`}
        className={cn(
          buttonVariants({ variant: "ghost", size: "icon" }),
          className
        )}
      >
        <DotsThreeVertical size={18} weight="bold" aria-hidden />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuItem onClick={onEditar}>
          <PencilSimple size={16} data-icon="inline-start" aria-hidden />{" "}
          Editar
        </DropdownMenuItem>
        <DropdownMenuItem variant="destructive" onClick={onExcluir}>
          <Trash size={16} data-icon="inline-start" aria-hidden />{" "}
          Excluir
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Form do dialog — desmonta por item (key={id} no pai): o contador de
 *  caracteres e os defaults recomeçam junto. */
function FormEditarCombinado({
  editando,
  pending,
  onSubmit,
}: {
  editando: Encaminhamento;
  pending: boolean;
  onSubmit: (fd: FormData) => void;
}) {
  const [descLen, setDescLen] = useState(editando.descricao.length);
  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(new FormData(e.currentTarget));
      }}
    >
      <div className="space-y-2">
        <div className="flex items-baseline justify-between gap-2">
          <Label htmlFor="enc-descricao">O que ficou combinado</Label>
          <span aria-hidden className="text-xs tabular-nums text-muted-foreground">
            {descLen}/500
          </span>
        </div>
        <Input
          id="enc-descricao"
          name="descricao"
          required
          maxLength={500}
          defaultValue={editando.descricao}
          onChange={(e) => setDescLen(e.target.value.length)}
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label id="enc-resp-label">Quem faz</Label>
          <Select name="responsavel" defaultValue={editando.responsavel}>
            <SelectTrigger aria-labelledby="enc-resp-label"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="mentorado">Mentorado</SelectItem>
              <SelectItem value="mentor">Mentor</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="enc-prazo">Prazo</Label>
          <Input id="enc-prazo" name="prazo" type="date" defaultValue={editando.prazo ?? ""} />
        </div>
      </div>
      <DialogFooter>
        <Button type="submit" disabled={pending}>
          {pending ? "Salvando…" : "Salvar"}
        </Button>
      </DialogFooter>
    </form>
  );
}

/** Dialog de edição do combinado — um por lista; os defaults vêm do item
 *  alvo. A mutação é do chamador (server action ou estado local na demo):
 *  {error} mantém aberto com o toast; {ok} fecha, celebra e dá refresh. */
export function EditarCombinadoDialog({
  editando,
  onOpenChange,
  onSalvar,
}: {
  editando: Encaminhamento | null;
  onOpenChange: (open: boolean) => void;
  onSalvar: (fd: FormData) => Promise<{ error?: string; ok?: boolean }>;
}) {
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <Dialog open={editando !== null} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>Editar combinado</DialogTitle>
          <DialogDescription>
            O que ficou combinado, quem faz e até quando.
          </DialogDescription>
        </DialogHeader>
        {editando && (
          <FormEditarCombinado
            key={editando.id}
            editando={editando}
            pending={pending}
            onSubmit={(fd) =>
              start(async () => {
                try {
                  const res = await onSalvar(fd);
                  if (res?.error) toast.error(res.error);
                  else {
                    toast.success("Combinado atualizado.");
                    onOpenChange(false);
                    router.refresh();
                  }
                } catch {
                  toast.error("Sem conexão. Tente de novo.");
                }
              })
            }
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

/** Confirmação de exclusão — mesma copy nas duas superfícies. onConfirm
 *  devolve o resultado da mutação do chamador (action ou estado local). */
export function ExcluirCombinadoConfirm({
  excluindo,
  onOpenChange,
  onConfirm,
}: {
  excluindo: Encaminhamento | null;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => Promise<{ error?: string; ok?: boolean }>;
}) {
  return (
    <ConfirmDeleteButton
      open={excluindo !== null}
      onOpenChange={onOpenChange}
      titulo="Excluir combinado?"
      descricao={
        excluindo
          ? `"${excluindo.descricao}" sai da lista da dupla.`
          : ""
      }
      sucesso="Combinado excluído."
      onConfirm={onConfirm}
    />
  );
}
