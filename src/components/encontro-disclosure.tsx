"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useSyncExternalStore,
} from "react";
import { Collapsible } from "@base-ui/react/collapsible";

/** Assina as três formas de o hash mudar: hashchange nativo, popstate e o
 *  `realiza:hash` que quem navega por pushState dispara. */
export function assinarHash(cb: () => void) {
  window.addEventListener("hashchange", cb);
  window.addEventListener("popstate", cb);
  window.addEventListener("realiza:hash", cb);
  return () => {
    window.removeEventListener("hashchange", cb);
    window.removeEventListener("popstate", cb);
    window.removeEventListener("realiza:hash", cb);
  };
}

type EncontroDisclosureEstado = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
};

const EncontroDisclosureContext =
  createContext<EncontroDisclosureEstado | null>(null);

/** Provider dos disclosures do MESMO encontro (registro + avaliação do
 *  jovem): segura UM estado pros dois — um clique em qualquer trigger
 *  abre (e fecha) os dois lados juntos, e o deep link `#registrar-{id}`
 *  segue revelando o encontro inteiro. O `forcado` aqui é a escolha local
 *  compartilhada; um hash novo zera e devolve o controle ao hash. Linha
 *  com um disclosure só também pode entrar — o provider é inofensivo. */
export function EncontroDisclosurePar({
  encontroId,
  children,
}: {
  encontroId: string;
  children: React.ReactNode;
}) {
  const alvo = `#registrar-${encontroId}`;
  // null = segue hash/default · true/false = escolha local até o hash mudar
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

  return (
    <EncontroDisclosureContext.Provider
      value={{ open: forcado ?? hashBate, onOpenChange: setForcado }}
    >
      {children}
    </EncontroDisclosureContext.Provider>
  );
}

/** Disclosure de um bloco do encontro (registro do mentor, avaliação do
 *  jovem) com a linha-resumo sempre visível. Fechado por padrão nos dois
 *  blocos: a ficha volta a ser índice, e o que abre é o gesto ou o hash.
 *
 *  O hash `#registrar-{id}` abre TODOS os blocos daquele encontro — os deep
 *  links antigos revelam o registro inteiro, não uma metade. Dentro de um
 *  `EncontroDisclosurePar` os irmãos dividem um estado só (um gesto abre
 *  os dois); standalone cada um carrega o próprio forcado/hashBate —
 *  comportamento original. `open`/`onOpenChange` nas props tornam
 *  controlado e vencem os dois caminhos. A escolha local vale até o
 *  próximo hashchange. */
export function EncontroDisclosure({
  encontroId,
  className,
  summary,
  children,
  open,
  onOpenChange,
}: {
  encontroId: string;
  className?: string;
  /** Linha-resumo dentro do trigger — spans/badges (phrasing content, é um button). */
  summary: React.ReactNode;
  children: React.ReactNode;
  /** Controlado quando `open` chega — par e hash deixam de mandar. */
  open?: boolean;
  onOpenChange?: (v: boolean) => void;
}) {
  const alvo = `#registrar-${encontroId}`;
  // estado standalone (sem provider, sem props): idêntico ao original —
  // cada bloco lê o próprio forcado/hashBate de `#registrar-{id}`
  const [forcado, setForcado] = useState<boolean | null>(null);
  const hashBate = useSyncExternalStore(
    assinarHash,
    () => window.location.hash === alvo,
    () => false
  );
  useEffect(() => assinarHash(() => setForcado(null)), []);
  const par = useContext(EncontroDisclosureContext);
  // prop controlada > par (estado único do encontro) > próprio
  const aberto = open ?? par?.open ?? forcado ?? hashBate;
  const mudar = onOpenChange ?? par?.onOpenChange ?? setForcado;

  return (
    <Collapsible.Root
      open={aberto}
      onOpenChange={(o) => mudar(o)}
      className={className}
    >
      {/* linha toda é o alvo; o caret dos filhos gira via
          group-data-[panel-open] */}
      <Collapsible.Trigger className="group flex min-h-11 w-full cursor-pointer items-center gap-2.5 px-4 py-2.5 text-left transition-colors hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring">
        {summary}
      </Collapsible.Trigger>
      <Collapsible.Panel className="h-[var(--collapsible-panel-height)] overflow-hidden transition-[height] duration-150 data-ending-style:h-0 data-starting-style:h-0 [&[hidden]:not([hidden='until-found'])]:hidden">
        {children}
      </Collapsible.Panel>
    </Collapsible.Root>
  );
}
