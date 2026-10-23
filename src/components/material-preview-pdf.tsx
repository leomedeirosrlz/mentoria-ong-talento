"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { ArrowSquareOut, FileText } from "@phosphor-icons/react";
import { linkSeguro } from "@/lib/ciclo";
import type { Material } from "@/lib/types";
import { cn } from "@/lib/utils";

const vazio = () => () => {};

/** O browser embute PDF no iframe? Android/iOS não (`pdfViewerEnabled`
 *  false) — lido via useSyncExternalStore: SSR hidrata no ícone (server
 *  snapshot = false), sem mismatch. Compartilhado pelo preview grande e
 *  pela thumb curta (material-thumb). */
export function usePdfEmbute(): boolean {
  return useSyncExternalStore(
    vazio,
    () => navigator.pdfViewerEnabled,
    () => false
  );
}

// extensões com capa — espelho do allowlist do upload (material-actions):
// PDF embute no viewer do browser, imagem vira <img>. O que escapar disso
// cai no fallback do tipo (não deveria existir — a coluna é escrita só pelo app)
const EXT_PDF = /\.pdf$/i;
const EXT_IMG = /\.(png|jpe?g|webp|gif|avif|svg)$/i;

/** IntersectionObserver com rootMargin generoso: uma lista longa de
 *  materiais × viewer de PDF embutido pesa — o iframe só monta quando a
 *  capa chega perto do viewport (e <details> fechado nunca "chega": abrir
 *  o encontro é o que monta os iframes dele). Uma vez montado não desmonta
 *  — o custo já foi pago e esconder/mostrar recarregaria o documento a
 *  cada scroll. Sem IO (browser antigo) monta direto — comportamento de
 *  antes, degradado e não quebrado. */
export function useMontarQuandoPerto() {
  const ref = useRef<HTMLDivElement>(null);
  const [perto, setPerto] = useState(false);
  useEffect(() => {
    if (perto) return;
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") {
      setPerto(true);
      return;
    }
    const io = new IntersectionObserver(
      (entradas) => {
        if (entradas.some((e) => e.isIntersecting)) {
          setPerto(true);
          io.disconnect();
        }
      },
      { rootMargin: "600px 0px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [perto]);
  return { ref, perto };
}

/** Capa borda-a-borda do PDF (1ª página) no card/linha do material. O
 *  browser decide se embute PDF — Android e amigos não: lê
 *  `pdfViewerEnabled` via useSyncExternalStore (SSR hidrata no ícone, sem
 *  mismatch) e cai pro ícone quando não embute. O src é /api/material/[id]
 *  (302 → signed URL); o frame-src do CSP cobre os dois hops. O ícone fica
 *  montado atrás do iframe — placeholder enquanto o viewer carrega e o
 *  estado final onde PDF não embute. Decorativo: aria-hidden +
 *  pointer-events-none + tabIndex -1 — o gesto é o link da linha abaixo. */
export function PreviewPdf({
  src,
  className,
  icone = 28,
}: {
  src: string;
  className?: string;
  /** tamanho do ícone-placeholder — menor no thumbnail de lista */
  icone?: number;
}) {
  const embute = usePdfEmbute();
  const { ref, perto } = useMontarQuandoPerto();

  return (
    <div
      ref={ref}
      aria-hidden
      className={cn("relative h-36 overflow-hidden bg-muted/60", className)}
    >
      <span className="grid h-full place-items-center text-muted-foreground">
        <FileText size={icone} weight="duotone" aria-hidden />
      </span>
      {embute && perto && (
        <iframe
          src={`${src}#page=1&toolbar=0&navpanes=0&view=FitH`}
          title=""
          tabIndex={-1}
          loading="lazy"
          className="pointer-events-none absolute inset-0 h-full w-full border-0"
        />
      )}
    </div>
  );
}

/** Capa do arquivo do material: PDF vira a 1ª página embutida (lazy por
 *  IntersectionObserver), imagem vira <img> object-cover. Sem path ou com
 *  extensão sem preview renderiza o `fallback` (o ícone do tipo — ou nada).
 *  A URL assinada vem do /api/material/[id] de sempre. */
export function PreviewMaterial({
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
      return <PreviewPdf src={src} className={className} icone={icone} />;
    if (EXT_IMG.test(m.path)) {
      return (
        <div
          aria-hidden
          className={cn("h-36 overflow-hidden bg-muted/60", className)}
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

/** Faixa de "capa" do material que é só link externo — sem arquivo pra
 *  embutir, a band mostra o destino (domínio) em vez de um ícone solto.
 *  Sem url segura (o CHECK exige http(s); o guard cobre escrita fora do
 *  app) não renderiza — o estado "em breve" continua sendo do caller. */
export function PreviewLink({
  m,
  className,
}: {
  m: Material;
  className?: string;
}) {
  const urlOk = linkSeguro(m.url);
  if (!urlOk) return null;
  let host = urlOk;
  try {
    host = new URL(urlOk).hostname.replace(/^www\./, "");
  } catch {
    // URL inválida não devia passar do linkSeguro — cai no texto cru
  }
  return (
    <div
      aria-hidden
      className={cn(
        "grid h-24 place-items-center bg-muted/60 text-muted-foreground",
        className
      )}
    >
      <span className="flex flex-col items-center gap-1.5">
        <ArrowSquareOut size={20} weight="duotone" aria-hidden />
        <span className="max-w-48 truncate text-[11px] font-medium">
          {host}
        </span>
      </span>
    </div>
  );
}
