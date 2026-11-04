"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Deep link sem `?aba=` (home do mentor, e-mails, WhatsApp): o servidor
 *  não enxerga o fragmento, então a ficha abre na aba Agora e este
 *  componente troca pra aba onde o alvo está montado —
 *  `#registrar-<encontro>` e `#combinados-<nº>` (aviso "Combinados em
 *  aberto" da agenda; `#intencoes-<nº>` é o link antigo) → Encontros; `#instrumentos` → Instrumentos (o hash acompanha
 *  a navegação e o browser rola pra seção quando ela monta). */
export function AbaPorHash() {
  const router = useRouter();

  useEffect(() => {
    const url = new URL(window.location.href);
    if (url.searchParams.has("aba")) return;
    const aba =
      url.hash.startsWith("#registrar-") ||
      url.hash.startsWith("#combinados-") ||
      url.hash.startsWith("#intencoes") ||
      url.hash.startsWith("#encontro-")
        ? "encontros"
        : url.hash === "#instrumentos"
          ? "instrumentos"
          : null;
    if (!aba) return;
    url.searchParams.set("aba", aba);
    router.replace(`${url.pathname}${url.search}${url.hash}`, {
      // todo hash mapeado é âncora de leitura: o router rola pro alvo e,
      // no caso #registrar-, o RegistroInline ainda abre o form por cima
      // (scroll extra pro mesmo lugar, sem custo)
      scroll: true,
    });
  }, [router]);

  return null;
}
