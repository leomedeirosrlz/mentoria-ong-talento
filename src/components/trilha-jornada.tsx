"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { Flag, FlagCheckered, Medal, Trophy } from "@phosphor-icons/react";
import {
  formatDate,
  formatDateTime,
  type EstadoNoJornada,
  type JornadaDupla,
  type MarcoJornada,
  type NoJornada,
} from "@/lib/ciclo";
import type { DuplaStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

const ICONE_MARCO: Record<MarcoJornada, typeof Flag> = {
  primeiro: Flag,
  metade: Medal,
  reta_final: FlagCheckered,
  completo: Trophy,
};

const MARCO_SR: Record<MarcoJornada, string> = {
  primeiro: "primeiro encontro",
  metade: "metade do caminho",
  reta_final: "reta final",
  completo: "último encontro",
};

/** Disco do passo — mesma gramática dos dots da agenda: fill = aconteceu,
 *  lime de contorno = compromisso firmado (agendado/remarcado), anel warn =
 *  incerteza, apagado = não rolou ou passo do guia sem data. O "passo atual"
 *  não muda a cor do disco: ganha um anel lime por fora (posição ≠ situação). */
const DISCO: Record<EstadoNoJornada, string> = {
  realizado_completo: "bg-[var(--brand-lime)] text-[var(--brand-ink)]",
  pendente_registro: "bg-[var(--warn)] text-[var(--brand-ink)]",
  limbo: "ring-2 ring-inset ring-[var(--warn)]/70 text-[var(--warn-text)]",
  agendado:
    "bg-[var(--brand-lime)]/20 text-foreground ring-1 ring-inset ring-[var(--brand-lime)]/60",
  nao_aconteceu: "bg-muted text-muted-foreground/60 line-through",
  futuro: "bg-muted text-muted-foreground",
};

/** Legenda visível só com o que o mentor precisa ler: feito, pendente e o
 *  próximo passo. Os demais estados (agendado, a confirmar, não aconteceu,
 *  a caminho) seguem no aria-label/title de cada bolinha. */
function chaveDot(estado: "realizado_completo" | "pendente_registro" | "proximo"): React.ReactNode {
  switch (estado) {
    case "realizado_completo":
      return <span aria-hidden className="size-2 rounded-full bg-[var(--brand-lime)]" />;
    case "pendente_registro":
      return <span aria-hidden className="size-2 rounded-full bg-[var(--warn)]" />;
    case "proximo":
      return <span aria-hidden className="size-2 rounded-full ring-2 ring-[var(--brand-lime)]" />;
  }
}

/** Label falado do passo — o número sozinho não carrega a situação. */
function rotuloNo(no: NoJornada, atual: boolean): string {
  const n = `${no.numero}º encontro`;
  const quandoReal = no.encontro?.realizado_em ?? no.encontro?.data_hora;
  let base: string;
  switch (no.estado) {
    case "realizado_completo":
      base = `${n}, realizado em ${formatDate(quandoReal)}, registro entregue`;
      break;
    case "pendente_registro":
      base = `${n}, realizado em ${formatDate(quandoReal)}, registro pendente`;
      break;
    case "limbo":
      base = `${n}, agendado para ${formatDate(no.encontro?.data_hora)}, já passou, falta confirmar`;
      break;
    case "agendado":
      base = `${n}, agendado para ${formatDate(no.encontro?.data_hora)}`;
      break;
    case "nao_aconteceu":
      base = `${n}, não aconteceu`;
      break;
    case "futuro":
      base = no.evento.data
        ? `${n}, a realizar, sugerido ${formatDate(no.evento.data)}`
        : `${n}, a realizar, data a combinar`;
      break;
  }
  if (atual) base += " · próximo passo";
  if (no.marco) base += ` · marco: ${MARCO_SR[no.marco]}`;
  return base;
}

/** Caption do passo atual: o que falta fazer, em texto — cor nunca é o único
 *  canal, e a legenda pequena não carrega ação. */
function textoProximo(no: NoJornada | undefined): string | null {
  if (!no) return null;
  if (no.estado === "limbo")
    return `Próximo: ${no.numero}º · agendado ${formatDate(no.encontro?.data_hora)}, falta confirmar`;
  if (no.estado === "agendado")
    return `Próximo: ${no.numero}º · agendado ${formatDateTime(no.encontro?.data_hora)}`;
  if (no.estado === "nao_aconteceu")
    return `Próximo: ${no.numero}º · não aconteceu, remarcar`;
  return no.evento.data
    ? `Próximo: ${no.numero}º · sugerido ${formatDate(no.evento.data)}`
    : `Próximo: ${no.numero}º · data a combinar`;
}

/** Mapa do ciclo da dupla: os encontros oficiais da janela como trilha de
 *  passos. Cada nó linka pro card do encontro na ficha — lá o mentor edita o
 *  registro ou completa o que falta; nó sem encontro (futuro) cai na ficha.
 *  O anel marca "você está aqui"; a cor de cada disco diz o que falta. */
export function TrilhaJornada({
  jornada,
  statusDupla,
  inicioDupla,
  duplaId,
}: {
  jornada: JornadaDupla;
  statusDupla: DuplaStatus;
  inicioDupla?: string | null;
  duplaId: string;
}) {
  const refAtual = useRef<HTMLLIElement | null>(null);
  const refStrip = useRef<HTMLOListElement | null>(null);

  // fade de 16px nas bordas do scroll horizontal — só quando há overflow de
  // fato (mobile: os 16 nós não cabem); no sm+ a trilha preenche o card sem
  // rolar e a máscara sai, senão esmaecia os nós das pontas
  useEffect(() => {
    const el = refStrip.current;
    if (!el) return;
    const MASCARA =
      "linear-gradient(to right, transparent, black 16px, black calc(100% - 16px), transparent)";
    const aplicar = () => {
      const rola = el.scrollWidth > el.clientWidth + 1;
      if (rola) {
        el.style.setProperty("-webkit-mask-image", MASCARA);
        el.style.setProperty("mask-image", MASCARA);
      } else {
        el.style.removeProperty("-webkit-mask-image");
        el.style.removeProperty("mask-image");
      }
    };
    aplicar();
    const ro = new ResizeObserver(aplicar);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // strip rola horizontal só no mobile (16 alvos de 44px ≈ 800px > 375px) —
  // sem o scroll o passo atual sairia da tela; mesmo padrão do rail da
  // agenda. Rola o ol direto (nunca o documento): scrollIntoView agiria no
  // scrollport mais próximo, que é a página inteira — ela descia até o nó
  // ao carregar
  useEffect(() => {
    const el = refAtual.current;
    const strip = el?.closest("ol");
    if (!el || !strip) return;
    // o li inclui o conector flex-1 — centraliza no disco (o link), não na linha
    const disco = el.querySelector<HTMLElement>("a") ?? el;
    const reduz = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const alvo =
      strip.scrollLeft +
      disco.getBoundingClientRect().left -
      strip.getBoundingClientRect().left -
      (strip.clientWidth - disco.clientWidth) / 2;
    strip.scrollTo({ left: alvo, behavior: reduz ? "auto" : "smooth" });
  }, []);

  if (jornada.nos.length < 2) return null;

  const noAtual = jornada.nos.find((n) => n.numero === jornada.proximoNumero);
  const estadosPresentes = new Set(jornada.nos.map((n) => n.estado));
  const legenda: { chave: "realizado_completo" | "pendente_registro" | "proximo"; texto: string }[] = [
    ...(estadosPresentes.has("realizado_completo")
      ? [{ chave: "realizado_completo" as const, texto: "feito" }]
      : []),
    ...(estadosPresentes.has("pendente_registro")
      ? [{ chave: "pendente_registro" as const, texto: "pendente" }]
      : []),
    ...(noAtual ? [{ chave: "proximo" as const, texto: "próximo" }] : []),
  ];
  const percorrido = (n: NoJornada) =>
    n.estado === "realizado_completo" ||
    n.estado === "pendente_registro" ||
    n.estado === "limbo";

  const caption =
    statusDupla === "pausada"
      ? "Jornada pausada. Ela retoma de onde a dupla parou."
      : statusDupla === "concluida"
        ? "Jornada concluída. A dupla fechou o ciclo."
        : statusDupla === "encerrada"
          ? "Dupla encerrada. A jornada guarda o que aconteceu."
          : jornada.completa
            ? `Jornada concluída: ${jornada.total} encontros realizados.`
            : null;

  return (
    <section aria-label="Jornada da dupla">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-base font-semibold">Jornada</h2>
        <p className="text-xs font-medium text-muted-foreground tabular-nums">
          {jornada.feitos} de {jornada.total}
        </p>
      </div>

      {/* pt-2.5 abre espaço pro marcador de marco que flutua acima do disco.
          Barra oculta sempre: quando rola (mobile) a máscara de fade é o
          indicador de continuação, não a barra */}
      <ol
        ref={refStrip}
        className="mt-1 flex items-center overflow-x-auto pt-2.5 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {jornada.nos.map((no, i) => {
          const atual = no.numero === jornada.proximoNumero;
          const viradaFase = i > 0 && no.evento.fase !== jornada.nos[i - 1].evento.fase;
          const rotulo = rotuloNo(no, atual);
          const IconeMarco = no.marco ? ICONE_MARCO[no.marco] : null;
          return (
            <li
              key={no.evento.id}
              ref={atual ? refAtual : undefined}
              className={cn("flex items-center", i > 0 ? "flex-1" : "shrink-0")}
            >
              {i > 0 && (
                <span
                  aria-hidden
                  className={cn(
                    "h-px flex-1",
                    // gap maior na virada de fase — os grupos ficam implícitos,
                    // o nome da fase corrente vive na caption. No sm+ o mínimo
                    // encolhe: 16 nós de 24px + mínimos precisam caber no card
                    // de ~448px (xl com 2 colunas) sem rolar
                    viradaFase ? "min-w-3 sm:min-w-2" : "min-w-1.5 sm:min-w-0.5",
                    percorrido(jornada.nos[i - 1]) && percorrido(no)
                      ? "bg-[var(--brand-lime)]"
                      : "bg-border"
                  )}
                />
              )}
                {/* size-11→sm:size-6 = hit area de 44px (mobile, por isso a
                    trilha rola) / 24px (sm+, mínimo de alvo pointer — assim os
                    16 nós cabem no card sem rolagem). Tocar o passo abre o
                    card dele na ficha */}
                <Link
                  // o nó abre a aba Encontros; com encontro, leva ao card dele
                  href={
                    no.encontro
                      ? `/duplas/${duplaId}?aba=encontros#registrar-${no.encontro.id}`
                      : `/duplas/${duplaId}?aba=encontros`
                  }
                  aria-label={rotulo}
                  title={rotulo}
                  aria-current={atual ? "step" : undefined}
                  className="group grid size-11 place-items-center rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring sm:size-6"
                >
                  <span className="relative">
                    {atual && (
                      <>
                        <span
                          aria-hidden
                          className="absolute -inset-1 rounded-full ring-2 ring-[var(--brand-lime)]"
                        />
                        <span
                          aria-hidden
                          className="absolute -inset-1 rounded-full bg-[var(--brand-lime)] animate-ping-once"
                        />
                      </>
                    )}
                    <span
                      className={cn(
                        "relative grid size-6 place-items-center rounded-full font-mono text-[11px] font-semibold leading-none tabular-nums transition-transform group-hover:scale-110",
                        DISCO[no.estado]
                      )}
                    >
                      {no.numero}
                    </span>
                    {/* o marco só é desenhado depois de atingido — nada de
                        cadeado (framing de falta é anti-motivacional) */}
                    {IconeMarco && (
                      <IconeMarco
                        aria-hidden
                        size={13}
                        weight="fill"
                        className="absolute -top-2.5 left-1/2 -translate-x-1/2 text-[var(--warn-text)]"
                      />
                    )}
                  </span>
                </Link>
            </li>
          );
        })}
      </ol>

      <p className="mt-1 text-xs text-muted-foreground">
        {caption ?? (
          <>
            {jornada.faseAtual && (
              <>
                Fase {jornada.faseAtual.indice} de {jornada.faseAtual.total}:{" "}
                {jornada.faseAtual.nome} ·{" "}
              </>
            )}
            {textoProximo(noAtual)}
          </>
        )}
        {jornada.janelaCortada && (
          <>
            {" "}
            · a contagem começa no início da dupla
            {inicioDupla ? ` (${formatDate(inicioDupla)})` : ""}
          </>
        )}
      </p>

      {/* mini-chave junto dos dots — só os estados presentes na jornada:
          trilha no início não fala de pendência, trilha limpa não fala de
          "não aconteceu" (chave explica o que existe, não o universo) */}
      {legenda.length > 0 && (
        <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          {legenda.map((item) => (
            <span key={item.chave} className="flex items-center gap-1.5">
              {chaveDot(item.chave)}
              {item.texto}
            </span>
          ))}
        </p>
      )}
    </section>
  );
}
