"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft } from "@phosphor-icons/react";

/** "Voltar" contextual: volta no histórico quando a página foi aberta de
 *  dentro do app (a origem muda por papel — coord vem de /pessoas, mentor da
 *  ficha da dupla); aberta direta (link colado) cai no `fallback`. */
export function VoltarLink({ fallback }: { fallback: string }) {
  const router = useRouter();
  return (
    <button
      type="button"
      onClick={() => {
        if (document.referrer.startsWith(window.location.origin)) router.back();
        else router.push(fallback);
      }}
      className="inline-flex min-h-11 items-center gap-1.5 rounded-md text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:min-h-0"
    >
      <ArrowLeft size={14} aria-hidden /> Voltar
    </button>
  );
}
