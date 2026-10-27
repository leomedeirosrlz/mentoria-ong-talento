"use client";

import { Eye } from "@phosphor-icons/react";
import type { FormularioCampo, FormularioSistema } from "@/lib/forms/schema";
import { FormularioPublico } from "@/app/f/[token]/formulario-publico";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

/** Pré-visualização do form público na ficha — o coord manda links pra
 *  dezenas de pessoas sem nunca ter visto a página. Renderiza o próprio
 *  FormularioPublico com `preview` (campos vivos, envio desligado) num
 *  dialog com a largura da página /f/<token>. */
export function FormularioPreview({
  titulo,
  descricao,
  campos,
  sistema,
}: {
  titulo: string;
  descricao: string | null;
  campos: FormularioCampo[];
  sistema?: FormularioSistema | null;
}) {
  return (
    <Dialog>
      <DialogTrigger
        render={
          <Button variant="outline" size="sm">
            <Eye aria-hidden />
            Pré-visualizar
          </Button>
        }
      />
      <DialogContent size="xl">
        <DialogHeader>
          <DialogTitle>Pré-visualização</DialogTitle>
          <DialogDescription>
            É assim que a página aparece pra quem recebe o link. Os campos
            respondem, mas o envio fica desligado nesta prévia.
          </DialogDescription>
        </DialogHeader>
        {/* @container + min-w-0: o conteúdo do instrumento se mede pelo
            espaço do dialog, não pela viewport (o popup é grid — sem o
            min-w-0 o item adota o min-content do texto e estoura a 390px).
            O form público é o mesmo do /f, que também é container. */}
        <div className="@container min-w-0">
          <FormularioPublico
            token="preview"
            titulo={titulo}
            descricao={descricao}
            campos={campos}
            // nome de exemplo pra saudação "Olá, …" aparecer como no link real
            destinatario="Ana"
            sistema={sistema}
            preview
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
