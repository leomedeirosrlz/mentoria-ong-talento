"use client";

import { useEffect } from "react";
import Link from "next/link";
import { CheckCircle } from "@phosphor-icons/react";

/** Confirmação do remanejo na ficha sucessora. A action redireciona pra
 *  `/duplas/<nova>?remanejada=1` e o NEXT_REDIRECT corta o cliente do
 *  dialog antes de qualquer toast — a confirmação mora aqui, no 1º render
 *  do servidor. O parâmetro é one-shot: o efeito tira da URL com
 *  replaceState nativo (router.replace re-renderizaria a ficha inteira),
 *  então refresh e link copiado não repetem o aviso. */
export function RemanejoFlash({ origemId }: { origemId: string | null }) {
  useEffect(() => {
    const url = new URL(window.location.href);
    if (!url.searchParams.has("remanejada")) return;
    url.searchParams.delete("remanejada");
    window.history.replaceState(
      null,
      "",
      `${url.pathname}${url.search}${url.hash}`
    );
  }, []);

  return (
    <div
      role="status"
      className="rounded-xl border border-[var(--ok)]/40 bg-[var(--ok)]/5 px-4 py-3 text-sm"
    >
      <p className="flex items-center gap-1.5 font-medium text-[var(--ok-text)]">
        <CheckCircle size={15} aria-hidden />
        Dupla remanejada
      </p>
      <p className="mt-0.5 text-muted-foreground">
        A ficha nova já está com o histórico.
        {origemId && (
          <>
            {" "}
            <Link
              href={`/duplas/${origemId}`}
              className="rounded-sm font-medium text-foreground underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              Ver a ficha de origem
            </Link>
          </>
        )}
      </p>
    </div>
  );
}
