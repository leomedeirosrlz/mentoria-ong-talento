"use client";

import dynamic from "next/dynamic";

/** AssistenteBolha sob demanda: a cadeia bolha→conversa→genui→config
 *  (~3,2k linhas) sai do chunk inicial do app. ssr:false porque a bolha é
 *  um overlay pós-hidratação (FAB fixo) — o gate IA_BOLHA no layout segue
 *  decidindo se ela entra na árvore. */
export const AssistenteBolhaLazy = dynamic(
  () =>
    import("@/components/assistente-bolha").then((m) => m.AssistenteBolha),
  { ssr: false }
);
