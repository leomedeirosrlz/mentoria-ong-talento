"use client";

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { AnimatePresence, motion } from "motion/react";
import { CaretDown } from "@phosphor-icons/react";
import { buttonVariants } from "@/components/ui/button";
import { T } from "@/components/motion";
import { assinarHash } from "@/components/encontro-disclosure";
import { abrirAncoraRegistro } from "@/lib/ancora-registro";
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
  // o hash é store externo: lido por useSyncExternalStore, e não por um
  // efeito de montagem. O efeito re-roda quando o React reexibe uma árvore
  // escondida por Suspense, e zerar ali fechava o card recém-aberto
  const hashBate = useSyncExternalStore(
    assinarHash,
    () => window.location.hash === alvo,
    () => false
  );
  // só um hash novo de fato devolve o controle ao hash
  useEffect(() => assinarHash(() => setForcado(null)), []);

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

/** CTA da linha — link pra âncora `#registrar-{id}` do próprio card. O clique
 *  vai pelo pushState patcheado do Next (e não pela navegação nativa do
 *  <a>) pra o router aprender o hash no canonicalUrl — a âncora nativa morria
 *  no write do refresh pós-action e o painel fechava sozinho. Já aberto,
 *  fecha no lugar (o href só rolaria de novo). */
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
        e.preventDefault();
        if (aberto) {
          alternar(false);
        } else {
          // a abertura segue o hash como num deep link — rola o card e foca
          // o primeiro campo (o realiza:hash do helper acorda o painel)
          abrirAncoraRegistro(encontroId);
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
          // empty:hidden cobre o form que se recusa a renderizar (encontro
          // já registrado — o RegistroDetails exibe o salvo): sem ele a
          // área abriria uma faixa vazia
          className={cn(className, "empty:hidden")}
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
