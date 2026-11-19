"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { demoRoleClient } from "@/lib/demo/shared";
import { dispositivoAtual } from "@/lib/dispositivo";
import {
  marcoRolagem,
  superficieDoPath,
  type AcaoProduto,
  type EventoProduto,
  type MarcoRolagem,
} from "@/lib/produto-eventos";

// REALIZA-417 — beacon de adoção (~1KB de lógica): fila em memória + flush
// batelado (8s, ou imediato em pagehide/visibilidade oculta via sendBeacon).
// O usePathname + dedupe cobre "superfície × papel" sem tocar cada tela:
// navegar pra outra área emite um pageview; re-render na mesma superfície,
// não. Sem PII — papel chega pelo JWT no servidor, a meta leva só ids e
// números de tela (REALIZA-433: vw/vh/dev no pageview, x/y no clique).
// Demo não emite (persona fake não tem profile real — o RPC barraria, e a
// coleta dela não responde nada).
//
// REALIZA-453 — gestos ricos na mesma régua:
//   permanencia: um gesto por saída da superfície com dur_ms da estadia
//   (troca de área, aba oculta, pagehide) — a última tela finalmente conta.
//   rolagem: um gesto por saída com o MAIOR marco alcançado (0/25/50/75/100)
//   — nunca por evento de scroll. Página que não rolava não emite, e o 0
//   vira o denominador limpo do "quem lê o fim".

const FLUSH_MS = 8000;
const FILA_MAX = 30;
// clique: no máximo 1 gesto por janela — double-click e dedo trêmulo não
// podem encher a fila (ela é dividida com todos os outros gestos)
const CLIQUE_MIN_MS = 500;
// teto do rótulo opt-in data-telemetry-alvo — o atributo é escrito por
// dev no JSX, mas o corte defende o lote de um valor acidental longo
const ALVO_MAX = 48;
// "rolável" = sobra real de conteúdo além da viewport — páginas que
// cabem na tela não emitem rolagem (não existe "fim" a alcançar)
const FOLGA_ROLAVEL_PX = 48;

const fila: EventoProduto[] = [];
let ultimaSup = "";
// estadia aberta da superfície atual — entrouEm=0 sem estadia (primeiro
// mount e logo após cada saída)
let entrouEm = 0;
// maior marco de rolagem alcançado na estadia + se a página rolava —
// "null" e "false" se distinguem: rolável sem scroll emite prof=0
let rolagemMax: MarcoRolagem | null = null;
let paginaRolava = false;

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

/** Fecha a estadia atual: permanencia com a duração e rolagem com o
 *  marco máximo — nessa ordem, antes do pageview da superfície nova (a
 *  fila já é a trilha cronológica, sem custo de reordenação). */
function sairDaSuperficie(agora: number) {
  if (entrouEm <= 0 || !ultimaSup) return;
  // a saída mede uma vez: página rolável sem nenhum scroll ainda emite
  // prof=0 — é o denominador limpo do "ninguém chegou ao fim"
  medirRolagem();
  const dur = agora - entrouEm;
  if (dur > 0) {
    fila.push({
      superficie: ultimaSup,
      acao: "permanencia",
      meta: { ts: agora, dur_ms: dur },
    });
  }
  if (paginaRolava) {
    fila.push({
      superficie: ultimaSup,
      acao: "rolagem",
      meta: { ts: agora, prof: rolagemMax ?? 0 },
    });
  }
  entrouEm = 0;
  rolagemMax = null;
  paginaRolava = false;
}

/** Abre estadia nova: volta de aba oculta conta como estadia própria —
 *  o tempo escondido não é uso. Mesma superfície, duas permanencias no
 *  dia: a mediana do painel lê "estadias", não "sessões". */
function entrarNaSuperficie(sup: string, agora: number) {
  if (entrouEm > 0) return;
  ultimaSup = sup;
  entrouEm = agora;
  rolagemMax = null;
  paginaRolava = false;
}

/** Mede a profundidade atual e marca a página como rolável. Chamado a
 *  cada scroll (com throttle rAF) e uma vez na saída — a saída é quem
 *  decide o "rolava" quando a pessoa nunca tocou na régua. */
function medirRolagem() {
  if (!ultimaSup) return;
  const doc = document.documentElement;
  const sobra = doc.scrollHeight - window.innerHeight;
  if (sobra <= FOLGA_ROLAVEL_PX) return;
  paginaRolava = true;
  const m = marcoRolagem(window.scrollY / sobra);
  if (rolagemMax === null || m > rolagemMax) rolagemMax = m;
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
  // transaction_timestamp() empataria os eventos do flush — sem o
  // ts a RPC não tem como ordenar (sessionização dos caminhos depende)
  fila.push({ superficie: sup, acao, meta: { ...meta, ts: Date.now() } });
  if (fila.length >= FILA_MAX) flush();
}

export function ProdutoTelemetry() {
  const pathname = usePathname();

  // um pageview por troca de superfície (dedupe por sup — navegar entre
  // telas da mesma área não re-emite: ficha A → ficha B conta zero, o
  // que conta é entrar numa superfície nova; re-render não conta nada).
  // A troca FECHA a estadia anterior primeiro: a fila sai com
  // permanencia/rolagem de N-1 antes do pageview de N.
  useEffect(() => {
    if (demoRoleClient()) return;
    const sup = superficieDoPath(pathname);
    if (sup === ultimaSup) {
      // mesma superfície não conta pageview — mas se a estadia fechou
      // (aba oculta) ela reabre quieta: o dedupe por sup não muda
      if (entrouEm === 0) entrarNaSuperficie(sup, Date.now());
      return;
    }
    const agora = Date.now();
    sairDaSuperficie(agora);
    entrarNaSuperficie(sup, agora);
    fila.push({
      superficie: sup,
      acao: "pageview",
      // vw/vh/dev medem a tela no momento do gesto — o pageview é o
      // ponto de amostragem do parque de dispositivos (REALIZA-433); o
      // clique carrega o próprio vw/vh pra normalizar x/y por gesto
      meta: {
        ts: agora,
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

  // rolagem por marcos: a medição é contínua mas a EMISSÃO não — só o
  // maior marco da estadia sai, na saída. rAF throttle porque scroll
  // dispara por frame; o gesto nunca espera o listener (passive).
  useEffect(() => {
    if (demoRoleClient()) return;
    let agendado = false;
    const onScroll = () => {
      if (agendado) return;
      agendado = true;
      requestAnimationFrame(() => {
        agendado = false;
        medirRolagem();
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (demoRoleClient()) return;
    const timer = setInterval(flush, FLUSH_MS);
    const onHide = () => {
      sairDaSuperficie(Date.now());
      flush();
    };
    const onVis = () => {
      const agora = Date.now();
      if (document.visibilityState === "hidden") {
        sairDaSuperficie(agora);
        flush();
      } else {
        // voltou da aba oculta: estadia nova, mesmo lugar
        entrarNaSuperficie(ultimaSup, agora);
      }
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
