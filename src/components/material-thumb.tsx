"use client";

import { FileText } from "@phosphor-icons/react";
import type { Material } from "@/lib/types";
import {
  useMontarQuandoPerto,
  usePdfEmbute,
} from "@/components/material-preview-pdf";
import { cn } from "@/lib/utils";

// Capa CURTA do material (rodada feedback-ux-2026-10, materiais-coord.md
// item 7) — a versão compacta e estática do material-preview-pdf: só o
// topo da 1ª página, ≤96px de altura, sem scroll interno, título
// discernível. Global por contrato — acervo do jovem (REALIZA-194),
// biblioteca da coord e a ficha da dupla usam a mesma thumb; o preview
// grande (h-36) continua existindo pra superfícies de leitura.

// mesmos allowlists do preview — a coluna é escrita só pelo app
const EXT_PDF = /\.pdf$/i;
const EXT_IMG = /\.(png|jpe?g|webp|gif|avif|svg)$/i;

/** Recorte do topo da 1ª página do PDF (≤96px): o iframe é ~16px mais
 *  largo que a caixa — a barra de rolagem INTERNA do viewer nasce na
 *  borda direita dele, fora da área visível, então a capa não ganha o
 *  trilho de scroll que o feedback marcou ("scrollável dentro do card").
 *  `scrollbar=0` cobre os viewers que honram o parâmetro de abertura;
 *  a largura extra cobre os que não honram. `view=FitH` ancora a página
 *  pela largura — o que aparece é o topo, onde mora o título. O ícone
 *  fica montado atrás: placeholder durante a carga e o estado final de
 *  quem não embute PDF (Android/iOS — usePdfEmbute), sem regressão.
 *  Decorativo: aria-hidden + pointer-events-none + tabIndex -1. */
export function ThumbPdf({
  src,
  className,
  icone = 26,
}: {
  src: string;
  className?: string;
  /** tamanho do ícone-placeholder */
  icone?: number;
}) {
  const embute = usePdfEmbute();
  const { ref, perto } = useMontarQuandoPerto();

  return (
    <div
      ref={ref}
      aria-hidden
      className={cn("relative h-24 overflow-hidden bg-muted/60", className)}
    >
      <span className="grid h-full place-items-center text-muted-foreground">
        <FileText size={icone} weight="duotone" aria-hidden />
      </span>
      {embute && perto && (
        <iframe
          src={`${src}#page=1&toolbar=0&navpanes=0&scrollbar=0&view=FitH`}
          title=""
          tabIndex={-1}
          loading="lazy"
          className="pointer-events-none absolute inset-y-0 left-0 w-[calc(100%+16px)] border-0"
        />
      )}
    </div>
  );
}

/** Capa curta do arquivo do material — mesmo dispatch do PreviewMaterial,
 *  na régua da thumb: PDF vira o recorte da 1ª página (lazy por IO),
 *  imagem vira <img> object-top. Sem path ou extensão sem preview cai no
 *  `fallback` (ícone do tipo, "em breve" — decisão do caller). A URL é a
 *  assinada do /api/material/[id], igual ao preview grande. */
export function MaterialThumb({
  m,
  className,
  icone,
  fallback = null,
}: {
  m: Material;
  className?: string;
  icone?: number;
  fallback?: React.ReactNode;
}) {
  if (m.path) {
    const src = `/api/material/${m.id}`;
    if (EXT_PDF.test(m.path))
      return <ThumbPdf src={src} className={className} icone={icone} />;
    if (EXT_IMG.test(m.path)) {
      return (
        <div
          aria-hidden
          className={cn("h-24 overflow-hidden bg-muted/60", className)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={src}
            alt=""
            loading="lazy"
            decoding="async"
            className="pointer-events-none h-full w-full object-cover object-top"
          />
        </div>
      );
    }
  }
  return <>{fallback}</>;
}
