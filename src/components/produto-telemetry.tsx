"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { demoRoleClient } from "@/lib/demo/shared";
import { dispositivoAtual } from "@/lib/dispositivo";
import {
  superficieDoPath,
  type AcaoProduto,
  type EventoProduto,
} from "@/lib/produto-eventos";

// REALIZA-417 — beacon de adoção (~1KB de lógica): fila em memória + flush
// batelado (8s, ou imediato em pagehide/visibilidade oculta via sendBeacon).
// O usePathname + dedupe cobre "superfície × papel" sem tocar cada tela:
// navegar pra outra área emite um pageview; re-render na mesma superfície,
// não. Sem PII — papel chega pelo JWT no servidor, a meta leva só ids e
// números de tela (REALIZA-433: vw/vh/dev no pageview, x/y no clique).
// Demo não emite (persona fake não tem profile real — o RPC barraria, e a
// coleta dela não responde nada).

const FLUSH_MS = 8000;
const FILA_MAX = 20;
// clique: no máximo 1 gesto por janela — double-click e dedo trêmulo não
// podem encher a fila de 20 (ela é dividida com todos os outros gestos)
const CLIQUE_MIN_MS = 500;
// teto do rótulo opt-in data-telemetry-alvo — o atributo é escrito por
// dev no JSX, mas o corte defende o lote de um valor acidental longo
const ALVO_MAX = 48;

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
  // ts do client em meta: o lote grava num statement só e created_at=
  // transaction_timestamp() empataria os 20 eventos do flush — sem o
  // ts a RPC não tem como ordenar (sessionização dos caminhos depende)
  fila.push({ superficie: sup, acao, meta: { ...meta, ts: Date.now() } });
  if (fila.length >= FILA_MAX) flush();
}

export function ProdutoTelemetry() {
  const pathname = usePathname();

  // um pageview por troca de superfície (dedupe por sup — navegar entre
  // telas da mesma área não re-emite: ficha A → ficha B conta zero, o
  // que conta é entrar numa superfície nova; re-render não conta nada)
  useEffect(() => {
    if (demoRoleClient()) return;
    const sup = superficieDoPath(pathname);
    if (sup === ultimaSup) return;
    ultimaSup = sup;
    fila.push({
      superficie: sup,
      acao: "pageview",
      // vw/vh/dev medem a tela no momento do gesto — o pageview é o
      // ponto de amostragem do parque de dispositivos (REALIZA-433); o
      // clique carrega o próprio vw/vh pra normalizar x/y por gesto
      meta: {
        ts: Date.now(),
        vw: window.innerWidth,
        vh: window.innerHeight,
        dev: dispositivoAtual(),
      },
    });
    if (fila.length >= FILA_MAX) flush();
  }, [pathname]);

  // REALIZA-433 — heatmap de toque: um gesto 'clique' por pointerdown
  // real. capture pega o gesto antes de qualquer stopPropagation de
  // componente; passive garante que o listener nunca atrasa o toque.
  // meta deliberadamente numérica/enum — nada de seletor CSS nem texto
  // do elemento (PII indireta não entra no evento).
  useEffect(() => {
    if (demoRoleClient()) return;
    let ultimo = 0;
    const onDown = (e: PointerEvent) => {
      // só o gesto primário — botão direito/auxiliar não mede uso
      if (e.pointerType === "mouse" && e.button !== 0) return;
      const alvo = e.target;
      if (!(alvo instanceof Element)) return;
      // digitação não é clique útil: tocar num campo pra focar não diz
      // nada sobre a interface — o gesto que informa é o texto
      if (
        alvo.closest("input, textarea, select") ||
        (alvo instanceof HTMLElement && alvo.isContentEditable)
      ) {
        return;
      }
      // pointerdown na calha da régua de scroll nativa chega com target
      // html/body — é gesto de rolagem, não interação com a página.
      // clientWidth/clientHeight do <html> já descontam a régua.
      if (
        (alvo === document.documentElement || alvo === document.body) &&
        (e.clientX >= document.documentElement.clientWidth ||
          e.clientY >= document.documentElement.clientHeight)
      ) {
        return;
      }
      const agora = Date.now();
      if (agora - ultimo < CLIQUE_MIN_MS) return;
      ultimo = agora;
      // alvo opt-in: o componente marca data-telemetry-alvo="nome"
      // quando o ponto de toque tem nome próprio (cta, fab) — sem o
      // atributo o gesto vai só com a geometria
      const marcado = alvo
        .closest("[data-telemetry-alvo]")
        ?.getAttribute("data-telemetry-alvo")
        ?.slice(0, ALVO_MAX);
      trackProduto("clique", {
        x: Math.round(e.clientX),
        y: Math.round(e.clientY),
        vw: window.innerWidth,
        vh: window.innerHeight,
        ...(marcado ? { alvo: marcado } : {}),
      });
    };
    document.addEventListener("pointerdown", onDown, {
      capture: true,
      passive: true,
    });
    return () =>
      document.removeEventListener("pointerdown", onDown, {
        capture: true,
      });
  }, []);

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
