"use client";

import { useEffect } from "react";
import type { ReactNode } from "react";
import { marcarMaterialLido } from "@/lib/actions";
import { trackProduto } from "@/components/produto-telemetry";

/** Marca o documento como lido na montagem (0196) — cobre todo caminho de
 *  entrada (card, biblioteca, deep link, reload), não só o clique. */
export function RegistrarMaterialLido({
  materialRef,
}: {
  materialRef: string;
}) {
  useEffect(() => {
    void marcarMaterialLido(materialRef);
  }, [materialRef]);
  return null;
}

/** Âncora de material que marca a leitura no clique (0196) — o arquivo já
 *  marca na rota /api/material e o doc na montagem da página; o clique cobre
 *  o link externo e dá feedback imediato nos outros caminhos (upsert
 *  idempotente, sem custo de dupla marcação). */
export function LinkComLeitura({
  materialRef,
  href,
  externo = false,
  className,
  children,
}: {
  materialRef: string;
  href: string;
  externo?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <a
      href={href}
      {...(externo ? { target: "_blank", rel: "noopener noreferrer" } : {})}
      className={className}
      onClick={() => {
        trackProduto("material_aberto", { ref: materialRef });
        void marcarMaterialLido(materialRef);
      }}
    >
      {children}
    </a>
  );
}
