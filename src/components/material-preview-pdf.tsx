"use client";

import { useSyncExternalStore } from "react";
import { FileText } from "@phosphor-icons/react";

const vazio = () => () => {};

/** Capa borda-a-borda do PDF (1ª página) no card do material. O browser
 *  decide se embute PDF — Android e amigos não: lê `pdfViewerEnabled` via
 *  useSyncExternalStore (SSR hidrata no ícone, sem mismatch) e cai pro
 *  ícone quando não embute. O src é /api/material/[id] (302 → signed URL);
 *  o frame-src do CSP cobre os dois hops. Decorativo: aria-hidden +
 *  pointer-events-none + tabIndex -1 — o gesto é o link da linha abaixo. */
export function PreviewPdf({ src }: { src: string }) {
  const embute = useSyncExternalStore(
    vazio,
    () => navigator.pdfViewerEnabled,
    () => false
  );

  return (
    <div aria-hidden className="h-36 overflow-hidden bg-muted/60">
      {embute ? (
        <iframe
          src={`${src}#page=1&toolbar=0&navpanes=0&view=FitH`}
          title=""
          tabIndex={-1}
          loading="lazy"
          className="pointer-events-none h-full w-full border-0"
        />
      ) : (
        <span className="grid h-full place-items-center text-muted-foreground">
          <FileText size={28} weight="duotone" aria-hidden />
        </span>
      )}
    </div>
  );
}
