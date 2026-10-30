"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Deep link sem `?aba=` (home do mentor, e-mails, WhatsApp): o servidor
 *  não enxerga o fragmento, então a ficha abre na aba Agora e este
 *  componente troca pra aba onde o alvo está montado —
 *  `#registrar-<encontro>` → Encontros (o RegistroInline rola e foca o
 *  form no mount); `#instrumentos` → Instrumentos (o hash acompanha a
 *  navegação e o browser rola pra seção quando ela monta). */
export function AbaPorHash() {
  const router = useRouter();

  useEffect(() => {
    const url = new URL(window.location.href);
    if (url.searchParams.has("aba")) return;
    const aba = url.hash.startsWith("#registrar-")
      ? "encontros"
      : url.hash === "#instrumentos"
        ? "instrumentos"
        : null;
    if (!aba) return;
    url.searchParams.set("aba", aba);
    router.replace(`${url.pathname}${url.search}${url.hash}`, {
      scroll: aba === "instrumentos",
    });
  }, [router]);

  return null;
}
