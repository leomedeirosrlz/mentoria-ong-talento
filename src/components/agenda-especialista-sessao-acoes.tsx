"use client";

import { useState } from "react";
import { PencilSimple } from "@phosphor-icons/react";
import { AcoesMenu } from "@/components/acoes-menu";
import { EditarLinkDialog } from "@/components/editar-link-dialog";

/** ⋯ da linha de sessão de especialista (QA 25/11): paridade com as
 *  sessões de mentor — o gesto de trocar só o link morava fora da
 *  agenda. Dialog fora do popup e controlado: fechar o menu não
 *  desmonta e o foco volta pro ⋯ (mesmo padrão do AcoesItem). */
export function SessaoEspAcoes({
  encontroId,
  linkAtual,
}: {
  encontroId: string;
  linkAtual: string | null;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <AcoesMenu
        itens={[
          {
            id: "editar-link",
            rotulo: "Editar link da chamada",
            icone: (
              <PencilSimple
                aria-hidden
                className="size-4 shrink-0 text-muted-foreground"
              />
            ),
            onEscolher: () => setOpen(true),
          },
        ]}
        label="Ações da sessão"
      />
      <EditarLinkDialog
        encontroId={encontroId}
        linkAtual={linkAtual}
        trigger={null}
        open={open}
        onOpenChange={setOpen}
      />
    </>
  );
}
