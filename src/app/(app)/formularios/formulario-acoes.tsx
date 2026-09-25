"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CircleNotch, Pause, Play, Trash } from "@phosphor-icons/react";
import { excluirFormulario, setFormularioAtivo } from "@/lib/forms/actions";
import { ConfirmDeleteButton } from "@/components/confirm-delete-button";
import { Button } from "@/components/ui/button";

/** Ação do header da ficha: encerrar/reativar o form (links existentes
 *  param de aceitar resposta). */
export function FormularioAcoes({
  id,
  ativo,
}: {
  id: string;
  ativo: boolean;
}) {
  const [pending, start] = useTransition();
  const router = useRouter();

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const r = await setFormularioAtivo(id, !ativo);
          if (r.error) {
            toast.error(r.error);
            return;
          }
          toast.success(
            ativo
              ? "Formulário encerrado. Links existentes param de aceitar resposta."
              : "Formulário reativado."
          );
          router.refresh();
        })
      }
    >
      {pending ? (
        <CircleNotch className="animate-spin" aria-hidden />
      ) : ativo ? (
        <Pause aria-hidden />
      ) : (
        <Play aria-hidden />
      )}
      {ativo ? "Encerrar" : "Reativar"}
    </Button>
  );
}

/** Excluir mora na zona de perigo no fim da ficha — destrutivo não é CTA
 *  de primeiro nível (o cascade apaga links e respostas; o dialog avisa).
 *  Form oficial (sistema, 0042) nem renderiza isto: o trigger do banco
 *  barra mesmo, esconder evita o beco sem saída. */
export function FormularioExcluir({
  id,
  titulo,
}: {
  id: string;
  titulo: string;
}) {
  return (
    <ConfirmDeleteButton
      titulo={`Excluir "${titulo}"?`}
      descricao="Apaga o formulário junto com todos os links e todas as respostas recebidas. Não dá pra desfazer."
      sucesso="Formulário excluído."
      acao="Excluir"
      onConfirm={() => excluirFormulario(id)}
      trigger={
        <Button variant="outline" size="sm" className="text-destructive">
          <Trash aria-hidden />
          Excluir formulário
        </Button>
      }
    />
  );
}
