"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Deep link `#registrar-<encontro>` sem `?aba=` (home do mentor, e-mails,
 *  WhatsApp): o servidor não enxerga o fragmento, então a ficha abre na
 *  aba Agora e este componente troca pra Encontros, onde o card com o id
 *  está montado. O RegistroInline rola e foca o form no mount. */
export function AbaPorHash() {
  const router = useRouter();

  useEffect(() => {
    const url = new URL(window.location.href);
    if (url.searchParams.has("aba")) return;
    if (!url.hash.startsWith("#registrar-")) return;
    url.searchParams.set("aba", "encontros");
    router.replace(`${url.pathname}${url.search}${url.hash}`, { scroll: false });
  }, [router]);

  return null;
}
