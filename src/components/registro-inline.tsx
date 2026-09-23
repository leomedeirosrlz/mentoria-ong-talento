"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
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

  return (
    <RegistroInlineCtx.Provider
      value={{ aberto: forcado ?? hashBate, alternar: setForcado }}
    >
      {children}
    </RegistroInlineCtx.Provider>
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
