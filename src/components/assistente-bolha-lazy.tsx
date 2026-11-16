"use client";

import dynamic from "next/dynamic";
import { LizaFabShell } from "@/components/assistente-bolha-shell";

/** AssistenteBolha sob demanda: a cadeia bolha→conversa→genui→config
 *  (~3,2k linhas) sai do chunk inicial do app. ssr:false porque a bolha é
 *  um overlay pós-hidratação (FAB fixo) — o gate IA_BOLHA no layout segue
 *  decidindo se ela entra na árvore. O loading é a Liza dormindo: o FAB
 *  entra com a página e "acorda" quando o chunk chega (a troca é invisível
 *  — mesma posição, mesma bolha). */
export const AssistenteBolhaLazy = dynamic(
  () =>
    import("@/components/assistente-bolha").then((m) => m.AssistenteBolha),
  { ssr: false, loading: () => <LizaFabShell /> }
);
