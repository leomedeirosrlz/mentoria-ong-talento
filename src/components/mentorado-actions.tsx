"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { DotsThree, PencilSimple, Trash } from "@phosphor-icons/react";
import { toast } from "sonner";
import { deleteMentorado, updateMentorado } from "@/lib/actions";
import { avatarPublicUrl } from "@/lib/avatar";
import { FotoField } from "@/components/foto-field";
import type { Mentorado } from "@/lib/types";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ConfirmDeleteButton } from "@/components/confirm-delete-button";
import { DocumentoPessoa } from "@/components/documento-pessoa";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export function MentoradoActions({ mentorado, temDupla }: { mentorado: Mentorado; temDupla: boolean }) {
  const [editOpen, setEditOpen] = useState(false);
  const [delOpen, setDelOpen] = useState(false);
  const [pending, start] = useTransition();
  const router = useRouter();
  const primeiroNome = mentorado.nome.split(" ")[0];

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    start(async () => {
      try {
        const res = await updateMentorado(mentorado.id, new FormData(e.currentTarget));
        if (res?.error) toast.error(res.error);
        else {
          toast.success(`Cadastro de ${primeiroNome} atualizado.`);
          if (res?.aviso) toast.warning(res.aviso);
          setEditOpen(false);
          router.refresh();
        }
      } catch {
        toast.error("Sem conexão — tente de novo.");
      }
    });
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button variant="ghost" size="icon" aria-label="Ações">
              <DotsThree size={18} weight="bold" />
            </Button>
          }
        />
        <DropdownMenuContent align="end" className="w-44">
          <DropdownMenuItem onClick={() => setEditOpen(true)}>
            <PencilSimple /> Editar
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            variant="destructive"
            disabled={temDupla}
            onClick={() => setDelOpen(true)}
          >
            <Trash /> Excluir
          </DropdownMenuItem>
          {temDupla && (
            <p className="px-2 pb-1 text-[11px] leading-snug text-muted-foreground">
              Tem dupla no histórico — cadastro vinculado a uma dupla (mesmo encerrada) não pode ser excluído.
            </p>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Editar {primeiroNome}</DialogTitle>
          </DialogHeader>
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="em_nome">Nome</Label>
              <Input id="em_nome" name="nome" required defaultValue={mentorado.nome} />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="em_whatsapp">WhatsApp</Label>
                <Input
                  id="em_whatsapp" name="whatsapp"
                  type="tel" inputMode="tel" autoComplete="tel"
                  defaultValue={mentorado.whatsapp ?? ""}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="em_ong">ONG de origem</Label>
                <Input id="em_ong" name="ong_origem" defaultValue={mentorado.ong_origem ?? ""} />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="em_email">E-mail</Label>
              <Input id="em_email" name="email" type="email" defaultValue={mentorado.email ?? ""} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="em_notas">Notas / referência da anamnese</Label>
              <Textarea id="em_notas" name="notas" rows={2} defaultValue={mentorado.notas ?? ""} />
            </div>
            <FotoField
              id="em_foto"
              defaultUrl={mentorado.avatar_path ? avatarPublicUrl(mentorado.avatar_path) : null}
            />
            <DocumentoPessoa
              tipo="mentorado"
              id={mentorado.id}
              documentoPath={mentorado.documento_path}
            />
            <Button type="submit" className="w-full" disabled={pending}>
              {pending ? "Salvando…" : "Salvar"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDeleteButton
        open={delOpen}
        onOpenChange={setDelOpen}
        titulo={`Excluir ${mentorado.nome}?`}
        descricao="Remove o cadastro do mentorado. Só é possível excluir quem nunca teve dupla — o vínculo fica no histórico mesmo depois de encerrada."
        sucesso={`Cadastro de ${mentorado.nome} excluído.`}
        onConfirm={() => deleteMentorado(mentorado.id)}
      />
    </>
  );
}
