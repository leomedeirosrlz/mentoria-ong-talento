"use client";

import { useState } from "react";
import { Check, CopySimple } from "@phosphor-icons/react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { NudgeButton } from "@/components/nudge-button";
import { CopiarLink } from "./copiar-link";
import { urlPublica } from "./link-shared";

/** Item do painel "links prontos" — nome e mensagem já resolvem no caller
 *  (a ficha conhece a dupla; o dialog em massa cruza com a lista de
 *  destinatários). */
export type LinkProntoItem = {
  key: string;
  nome: string;
  token: string;
  whatsapp: string | null;
  mensagem: string;
  /** "até 12 mar" — validade já formatada, quando houver */
  validade?: string | null;
  /** com duplaId o nudge passa por /api/nudge e loga o contato na dupla */
  duplaId?: string;
  t?: string;
};

/** Estado pós-gerar dos dialogs de envio: cada destinatário sai com o link
 *  pronto pra copiar ou mandar no WhatsApp — sem caçar a linha na lista. */
export function LinksProntos({
  itens,
  onOutros,
}: {
  itens: LinkProntoItem[];
  onOutros: () => void;
}) {
  const [copiouTodos, setCopiouTodos] = useState(false);

  // "Nome — URL" por linha: a coord cola no grupo de WhatsApp/e-mail e cada
  // pessoa acha o seu endereço pelo nome
  async function copiarTodos() {
    const texto = itens
      .map((l) => `${l.nome} — ${urlPublica(l.token)}`)
      .join("\n");
    try {
      await navigator.clipboard.writeText(texto);
      setCopiouTodos(true);
      setTimeout(() => setCopiouTodos(false), 2000);
    } catch {
      toast.error("Não consegui copiar — copie os links um a um.");
    }
  }

  return (
    <div className="space-y-3">
      <ul className="scroll-fina max-h-72 space-y-2 overflow-y-auto pr-1">
        {itens.map((l) => (
          <li
            key={l.key}
            className="rounded-lg border border-input px-3 py-2.5"
          >
            <div className="flex items-center gap-2">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{l.nome}</p>
                <p className="truncate font-mono text-xs text-muted-foreground">
                  /f/{l.token.slice(0, 14)}…
                  {l.validade && <span className="font-sans"> · {l.validade}</span>}
                </p>
              </div>
              <CopiarLink token={l.token} />
            </div>
            <div className="mt-2">
              <NudgeButton
                telefone={l.whatsapp}
                mensagem={l.mensagem}
                duplaId={l.duplaId}
                t={l.t}
                label="Enviar no WhatsApp"
              />
            </div>
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={copiarTodos}
        >
          {copiouTodos ? (
            <Check aria-hidden className="text-[var(--ok)]" />
          ) : (
            <CopySimple aria-hidden />
          )}
          {copiouTodos ? "Copiados" : "Copiar todos"}
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={onOutros}>
          Gerar outros links
        </Button>
      </div>
    </div>
  );
}
