"use client";

import { Trash } from "@phosphor-icons/react";
import { excluirSupervisao } from "@/lib/actions-supervisao";
import { ConfirmDeleteButton } from "./confirm-delete-button";
import { Button } from "./ui/button";

/** Moderação da coordenação — a policy de delete é só dela. Sem edição no
 *  sistema: correção é apagar e re-registrar (a descrição já diz isso). */
export function SupervisaoDeleteButton({ id }: { id: string }) {
  return (
    <ConfirmDeleteButton
      titulo="Excluir sessão de supervisão?"
      descricao="Apaga o registro da sessão. Essa ação não tem volta — pra corrigir um detalhe, exclua e registre de novo."
      sucesso="Sessão de supervisão excluída."
      onConfirm={() => excluirSupervisao(id)}
      trigger={
        <Button
          variant="ghost"
          size="icon"
          className="size-7 text-muted-foreground hover:text-destructive"
          aria-label="Excluir sessão de supervisão"
        >
          <Trash size={13} />
        </Button>
      }
    />
  );
}
