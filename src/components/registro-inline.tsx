"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Collapsible } from "@base-ui/react/collapsible";
import { CaretDown } from "@phosphor-icons/react";
import { buttonVariants } from "@/components/ui/button";
import { T } from "@/components/motion";
import { cn } from "@/lib/utils";

/** Form de registro por card, um aberto por vez. O hash `#registrar-{id}` é a
 *  fonte de verdade do "qual está aberto": o CTA da linha É a âncora (mesmo
 *  destino dos deep-links de nudge/home/agenda/retroativo), então abrir um
 *  fecha os demais automaticamente.
 *  `realiza:hash` cobre navegação por pushState (router.push não dispara
 *  hashchange) — quem navega pra âncora via router dispara o evento. */
const RegistroInlineCtx = createContext<{
  aberto: boolean;
  alternar: (abrir: boolean) => void;
} | null>(null);

export function RegistroInline({
  encontroId,
  children,
}: {
  encontroId: string;
  children: React.ReactNode;
}) {
  const alvo = `#registrar-${encontroId}`;
  // null = segue o hash · true/false = escolha local até o hash mudar de novo
  // (fecha este e abre outro card, ou deep-link chegando de fora)
  const [forcado, setForcado] = useState<boolean | null>(null);
  const [hashBate, setHashBate] = useState(false);

  useEffect(() => {
    const sync = () => {
      setHashBate(window.location.hash === alvo);
      setForcado(null);
    };
    sync();
    window.addEventListener("hashchange", sync);
    window.addEventListener("popstate", sync);
    window.addEventListener("realiza:hash", sync);
    return () => {
      window.removeEventListener("hashchange", sync);
      window.removeEventListener("popstate", sync);
      window.removeEventListener("realiza:hash", sync);
    };
  }, [alvo]);

  const aberto = forcado ?? hashBate;
  // abriu pelo hash (deep link ou navegação de fora), não por clique local
  const abriuPeloHash = forcado === null && hashBate;
  const abertoAnt = useRef(aberto);

  // O clique no CTA também dispara hashchange depois de abrir localmente; a
  // transição só conta quando `aberto` vai de falso pra verdadeiro e veio do
  // hash, então esse eco não rola a página de novo.
  useEffect(() => {
    const abriu = aberto && !abertoAnt.current;
    abertoAnt.current = aberto;
    if (!abriu || !abriuPeloHash) return;
    // rAF: o form monta no mesmo commit, mas o alvo só ganha altura depois
    const frame = requestAnimationFrame(() => {
      const card = document.getElementById(`registrar-${encontroId}`);
      if (!card) return;
      const reduzir = window.matchMedia(
        "(prefers-reduced-motion: reduce)"
      ).matches;
      card.scrollIntoView({
        block: "start",
        behavior: reduzir ? "auto" : "smooth",
      });
      primeiroCampo(
        document.getElementById(`registro-form-${encontroId}`)
      )?.focus({ preventScroll: true });
    });
    // StrictMode roda o efeito duas vezes: desfazer a marca deixa a 2ª passada
    // enxergar a abertura de novo
    return () => {
      cancelAnimationFrame(frame);
      abertoAnt.current = false;
    };
  }, [aberto, abriuPeloHash, encontroId]);

  return (
    <RegistroInlineCtx.Provider
      value={{ aberto, alternar: setForcado }}
    >
      {children}
    </RegistroInlineCtx.Provider>
  );
}

/** Primeiro campo que o mentor consegue preencher: pula os steps ocultos
 *  (`hidden`) e os controles fora da ordem de Tab. */
function primeiroCampo(painel: HTMLElement | null): HTMLElement | null {
  const campos = painel?.querySelectorAll<HTMLElement>(
    'input:not([type="hidden"]), textarea, select, [role="combobox"]'
  );
  if (!campos) return null;
  return (
    Array.from(campos).find(
      (el) => !el.closest("[hidden]") && el.getAttribute("tabindex") !== "-1"
    ) ?? null
  );
}

/** CTA da linha — link pra âncora `#registrar-{id}` do próprio card: clicar
 *  rola até o card e abre o form; já aberto, fecha no lugar (o href só
 *  rolaria de novo). */
export function RegistroInlineTrigger({
  encontroId,
  primario = true,
}: {
  encontroId: string;
  /** Pendência dominante é CTA primário; "não aconteceu" o registro é secundário. */
  primario?: boolean;
}) {
  const ctx = useContext(RegistroInlineCtx);
  if (!ctx) return null;
  const { aberto, alternar } = ctx;
  return (
    <a
      href={`#registrar-${encontroId}`}
      aria-expanded={aberto}
      aria-controls={`registro-form-${encontroId}`}
      onClick={(e) => {
        if (aberto) {
          e.preventDefault();
          alternar(false);
        } else {
          // hash já neste card não dispara hashchange — abre pelo estado local
          alternar(true);
        }
      }}
      className={buttonVariants({
        variant: primario ? "default" : "outline",
        size: "sm",
      })}
    >
      {aberto ? "Fechar" : "Registrar"}
      <CaretDown className={cn("transition-transform", aberto && "rotate-180")} />
    </a>
  );
}

/** Corpo colapsável — fechado desmonta o form (o rascunho local é gravado no
 *  desmonte, então recolher não perde o que já foi digitado). O AnimatePresence
 *  segura o subtree montado até o fim do exit, então o flush do rascunho-
 *  autosave continua rodando no cleanup do form — só ~220ms depois. */
export function RegistroInlinePanel({
  encontroId,
  className,
  children,
}: {
  encontroId: string;
  className?: string;
  children: React.ReactNode;
}) {
  const ctx = useContext(RegistroInlineCtx);
  const aberto = !!ctx?.aberto;
  return (
    <AnimatePresence initial={false}>
      {aberto && (
        <motion.div
          id={`registro-form-${encontroId}`}
          className={className}
          // continuidade espacial: o card cresce pra revelar o form em vez de
          // teleportar (spec §2)
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={T.panel}
          // clip recorta a animação sem criar scrollport — deixa o sticky
          // do rodapé do form valer (com hidden o botão sumia no scroll)
          style={{ overflow: "clip" }}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/** Registro salvo na ficha da dupla: Collapsible com a linha-resumo sempre
 *  visível e o corpo sob disclosure (a página abre por padrão só os mais
 *  recentes). O hash `#registrar-{id}` abre o corpo — mesmo alvo dos deep
 *  links de /registros e dos nudges; a escolha local vale até o próximo
 *  hashchange (espelha o RegistroInline). */
export function RegistroDetails({
  encontroId,
  aberto = false,
  className,
  summary,
  children,
}: {
  encontroId: string;
  /** Nasce aberto — os registros mais recentes da lista (SSR já renderiza o painel). */
  aberto?: boolean;
  className?: string;
  /** Linha-resumo dentro do trigger — spans/badges (phrasing content, é um button). */
  summary: React.ReactNode;
  children: React.ReactNode;
}) {
  const alvo = `#registrar-${encontroId}`;
  // null = segue hash/default · true/false = escolha local até o hash mudar
  const [forcado, setForcado] = useState<boolean | null>(null);
  const [hashBate, setHashBate] = useState(false);

  useEffect(() => {
    const sync = () => {
      setHashBate(window.location.hash === alvo);
      setForcado(null);
    };
    sync();
    window.addEventListener("hashchange", sync);
    window.addEventListener("popstate", sync);
    window.addEventListener("realiza:hash", sync);
    return () => {
      window.removeEventListener("hashchange", sync);
      window.removeEventListener("popstate", sync);
      window.removeEventListener("realiza:hash", sync);
    };
  }, [alvo]);

  return (
    <Collapsible.Root
      open={forcado ?? (hashBate || aberto)}
      onOpenChange={(o) => setForcado(o)}
      className={className}
    >
      {/* mesma gramática do summary anterior: linha toda é o alvo; o caret
          dos filhos gira via group-data-[panel-open] */}
      <Collapsible.Trigger className="group flex min-h-11 w-full cursor-pointer items-center gap-2.5 px-4 py-2.5 text-left transition-colors hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring">
        {summary}
      </Collapsible.Trigger>
      <Collapsible.Panel className="h-[var(--collapsible-panel-height)] overflow-hidden transition-[height] duration-150 data-ending-style:h-0 data-starting-style:h-0 [&[hidden]:not([hidden='until-found'])]:hidden">
        {children}
      </Collapsible.Panel>
    </Collapsible.Root>
  );
}
