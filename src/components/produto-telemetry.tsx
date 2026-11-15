"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { demoRoleClient } from "@/lib/demo/shared";
import {
  superficieDoPath,
  type AcaoProduto,
  type EventoProduto,
} from "@/lib/produto-eventos";

// REALIZA-417 — beacon de adoção (~1KB de lógica): fila em memória + flush
// batelado (8s, ou imediato em pagehide/visibilidade oculta via sendBeacon).
// O usePathname + dedupe cobre "superfície × papel" sem tocar cada tela:
// navegar pra outra área emite um pageview; re-render na mesma superfície,
// não. Sem PII — papel chega pelo JWT no servidor, a meta leva só ids.
// Demo não emite (persona fake não tem profile real — o RPC barraria, e a
// coleta dela não responde nada).

const FLUSH_MS = 8000;
const FILA_MAX = 20;

const fila: EventoProduto[] = [];
let ultimaSup = "";

function flush() {
  if (fila.length === 0) return;
  const lote = fila.splice(0, FILA_MAX);
  const body = JSON.stringify(lote);
  // sendBeacon sobrevive ao unload; fora dele (suporte ou lote grande),
  // fetch keepalive cobre — falha de rede só perde o lote, nunca a página
  if (
    typeof navigator === "undefined" ||
    !navigator.sendBeacon(
      "/api/produto-eventos",
      new Blob([body], { type: "application/json" })
    )
  ) {
    void fetch("/api/produto-eventos", {
      method: "POST",
      body,
      keepalive: true,
      headers: { "content-type": "application/json" },
    }).catch(() => {});
  }
}

/** Emite um gesto de produto pra fila do beacon. `superficie` omitida =
 *  a da rota atual (o tracker sabe onde está). */
export function trackProduto(
  acao: AcaoProduto,
  meta?: Record<string, unknown>,
  superficie?: string
) {
  if (demoRoleClient()) return;
  const sup =
    superficie ??
    (typeof window !== "undefined"
      ? superficieDoPath(window.location.pathname)
      : "outros");
  fila.push({ superficie: sup, acao, meta });
  if (fila.length >= FILA_MAX) flush();
}

export function ProdutoTelemetry() {
  const pathname = usePathname();

  // um pageview por troca de superfície (dedupe por sup — trocar de ficha
  // dentro da mesma área conta uma nova página, re-render não conta nada)
  useEffect(() => {
    if (demoRoleClient()) return;
    const sup = superficieDoPath(pathname);
    if (sup === ultimaSup) return;
    ultimaSup = sup;
    fila.push({ superficie: sup, acao: "pageview" });
    if (fila.length >= FILA_MAX) flush();
  }, [pathname]);

  useEffect(() => {
    if (demoRoleClient()) return;
    const timer = setInterval(flush, FLUSH_MS);
    const onHide = () => flush();
    const onVis = () => {
      if (document.visibilityState === "hidden") flush();
    };
    window.addEventListener("pagehide", onHide);
    document.addEventListener("visibilitychange", onVis);
    return () => {
      clearInterval(timer);
      window.removeEventListener("pagehide", onHide);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  return null;
}
