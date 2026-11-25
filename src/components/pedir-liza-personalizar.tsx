"use client";

import { ChatText } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { pedirALiza } from "@/lib/liza-pedido";

// CTA dos templates de mensagem (REALIZA-388): o documento segue verbatim
// — quem personaliza é a Liza. O clique dispara o evento que a bolha
// escuta (abre o painel + envia a pergunta com o slug); o rascunho
// personalizado sai no bloco editável da conversa.
export function PedirLizaPersonalizar({ pergunta }: { pergunta: string }) {
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border-l-4 border-[var(--brand-lime)] bg-muted/60 px-4 py-3.5 shadow-[var(--shadow-border)] print:hidden">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold">
          Quer a mensagem pronta, com os nomes de verdade?
        </p>
        <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
          A Liza preenche o modelo com os dados da dupla e entrega o texto
          pronto pra editar, copiar ou abrir no WhatsApp.
        </p>
      </div>
      <Button
        type="button"
        size="sm"
        className="shrink-0"
        onClick={() => pedirALiza(pergunta)}
      >
        <ChatText size={15} aria-hidden />
        Pedir pra Liza personalizar
      </Button>
    </div>
  );
}
