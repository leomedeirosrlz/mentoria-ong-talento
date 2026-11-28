"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useSyncExternalStore,
} from "react";
import { Collapsible } from "@base-ui/react/collapsible";
import { CaretDown } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";

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

/** Seção recolhível da home do jovem: nasce fechada (a pendência crítica já
 *  está no "Para fazer agora") e abre sozinha quando a âncora dela chega na
 *  URL — `/jovem#combinados-titulo` vindo de pendência, e-mail ou notificação
 *  nunca cai num painel trancado. Mesma máquina de estado do
 *  EncontroDisclosure: hash assina hashchange/popstate/realiza:hash e a
 *  escolha local (abrir/fechar no dedo) vale até o hash mudar. O clique num
 *  `<a href="…#ancora">` também abre — a navegação de fragmento do router
 *  não dispara hashchange (o motivo de existir o realiza:hash). */
export function JovemSecaoRecolhivel({
  ancora,
  titulo,
  icone,
  resumo,
  children,
  className,
}: {
  /** id da âncora e do h2 da seção (ex.: "combinados-titulo"). */
  ancora: string;
  titulo: React.ReactNode;
  icone?: React.ReactNode;
  /** Resumo sempre visível no header — "3 em aberto", "1 pendente". */
  resumo?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  const alvo = `#${ancora}`;
  const [forcado, setForcado] = useState<boolean | null>(null);
  const hashBate = useSyncExternalStore(
    assinarHash,
    () => window.location.hash === alvo,
    () => false
  );
  useEffect(() => {
    // hash novo zera a escolha local e devolve o controle ao hash
    const desinscreve = assinarHash(() => setForcado(null));
    const porLink = (e: MouseEvent) => {
      const a = (e.target as Element | null)?.closest?.("a[href]");
      if (a?.getAttribute("href")?.endsWith(alvo)) setForcado(true);
    };
    document.addEventListener("click", porLink);
    return () => {
      desinscreve();
      document.removeEventListener("click", porLink);
    };
  }, [alvo]);
  // o refresh depois de um gesto (marcar combinado, avaliar) não pode
  // fechar a seção que o hash abriu: uma vez aberta por âncora, fica aberta
  const [jaAbriu, setJaAbriu] = useState(false);
  useEffect(() => {
    // abre por âncora no load: fixa fora do ciclo de render (microtask)
    if (window.location.hash === alvo) queueMicrotask(() => setJaAbriu(true));
  }, [alvo]);
  const aberto = forcado ?? (hashBate || jaAbriu);

  return (
    <section aria-labelledby={ancora} className={className}>
      <Collapsible.Root open={aberto} onOpenChange={setForcado}>
        <h2 id={ancora} className="scroll-mt-20 font-semibold">
          <Collapsible.Trigger className="group flex min-h-11 w-full items-center gap-2 rounded-md text-left outline-none transition-colors focus-visible:ring-3 focus-visible:ring-ring/50">
            {icone}
            <span>{titulo}</span>
            {resumo != null && (
              <span className="ms-auto shrink-0 text-sm font-normal text-muted-foreground">
                {resumo}
              </span>
            )}
            <CaretDown
              size={16}
              aria-hidden
              className={cn(
                "shrink-0 text-muted-foreground transition-transform group-aria-expanded:rotate-180",
                resumo == null && "ms-auto"
              )}
            />
          </Collapsible.Trigger>
        </h2>
        {/* hiddenUntilFound: montado com hidden="until-found" — o painel
            fechado segue achável por busca na página e por fragmento
            interno (spec 028: a transição de height é a exceção
            documentada do Collapsible) */}
        <Collapsible.Panel
          hiddenUntilFound
          className="h-[var(--collapsible-panel-height)] overflow-hidden transition-[height] duration-150 data-ending-style:h-0 data-starting-style:h-0 [&[hidden]:not([hidden='until-found'])]:hidden"
        >
          {children}
        </Collapsible.Panel>
      </Collapsible.Root>
    </section>
  );
}
