"use client";

import { useState } from "react";
import { Check, CopySimple } from "@phosphor-icons/react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { urlPublica } from "./link-shared";

/** Copia a URL pública do link — /f/<token> por default; `caminho` troca o
 *  prefixo ("/assinar" pros termos). Vira "Copiado" por 2s; a falha avisa
 *  em toast (clipboard pode estar indisponível fora de contexto seguro). */
export function CopiarLink({
  token,
  caminho,
}: {
  token: string;
  caminho?: string;
}) {
  const [copiado, setCopiado] = useState(false);
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(urlPublica(token, undefined, caminho));
          setCopiado(true);
          setTimeout(() => setCopiado(false), 2000);
        } catch {
          toast.error("Não consegui copiar. Selecione o link manualmente.");
        }
      }}
    >
      {copiado ? (
        <Check aria-hidden className="text-[var(--ok)]" />
      ) : (
        <CopySimple aria-hidden />
      )}
      {copiado ? "Copiado" : "Copiar"}
    </Button>
  );
}
