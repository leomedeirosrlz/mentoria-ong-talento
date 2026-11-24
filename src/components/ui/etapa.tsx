"use client";

/* Gramática de movimento entre etapas e estados (spec 028) — o kit inteiro
 * mora aqui pra nenhum idioma paralelo nascer nas superfícies:
 *
 *  - NAVEGAÇÃO DE ETAPA (wizard, fluxo de perguntas): <Etapa> +
 *    useTrocaDeEtapa — slide direcional curto (≤8px) via .animate-enter-x +
 *    var --dir. Avançar entra pela direita, voltar pela esquerda. O padrão é
 *    etapas montadas: a inativa leva `hidden`, então inputs não-controlados
 *    seguem no FormData e no rascunho — desmontar perderia a digitação no
 *    Voltar. Remount só onde o estado já é controlado e a superfície opta
 *    explicitamente (os onboardings remontam por FormData por passo).
 *  - TROCA DE ESTADO no mesmo lugar (form → resultado/sucesso): <FadeTroca>
 *    — crossfade ~180ms, sem direção, com o painel entrante recebendo foco.
 *  - REVELAÇÃO progressiva dentro de uma tela (não é navegação): cascata
 *    .animate-enter + --i direto no JSX — fora do escopo daqui.
 *
 *  Reduced-motion é o guard global do globals.css + o MotionConfig
 *  reducedMotion="user" do layout — nada aqui consulta media query. */

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ComponentPropsWithoutRef,
  type CSSProperties,
  type FormEvent,
  type KeyboardEvent,
  type ReactNode,
  type Ref,
} from "react";
import { AnimatePresence, motion } from "motion/react";
import { CaretLeft, CaretRight, type Icon } from "@phosphor-icons/react";
import { fade, T } from "@/components/motion";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { DialogFooter } from "@/components/ui/dialog";

/** +1 = avançou (entra pela direita), -1 = voltou (entra pela esquerda) */
export type DirecaoEtapa = 1 | -1;

/** Alvo do foco pós-commit:
 *  - "titulo" (padrão): o heading da etapa nova — leitor de tela anuncia
 *    onde a pessoa está;
 *  - função: alvo sob medida (ex.: o campo que segurou a validação);
 *  - null: sem foco — a superfície tem contrato próprio (o /f rola e foca
 *    a seção, o onboarding rola e foca o balão). */
type AlvoFoco = "titulo" | (() => void) | null;

type ControleInvalido =
  | HTMLInputElement
  | HTMLSelectElement
  | HTMLTextAreaElement;

/** Motor da troca de etapa: índice clampado, direção do slide e a agenda
 *  de foco pós-commit (foco pedido no gesto, entregue quando a etapa alvo
 *  já saiu do `hidden` e é focável — focar no handler do clique pegaria a
 *  etapa ainda escondida). T = tipo do elemento que recebe o foco de
 *  "titulo" (heading no wizard, painel nos fluxos por fase).
 *  `direcaoInicial` vale no mount: o pai que remonta a superfície (o flow
 *  que traz o builder de volta) passa a direção da NAVEGAÇÃO dele — sem
 *  isso o remount sempre deslizaria "pra frente", até num Voltar. */
export function useTrocaDeEtapa<T extends HTMLElement = HTMLElement>(
  total: number,
  direcaoInicial: DirecaoEtapa = 1
) {
  const [etapaBruta, setEtapaBruta] = useState(0);
  const [direcao, setDirecao] = useState<DirecaoEtapa>(direcaoInicial);
  const tituloEtapaRef = useRef<T>(null);
  const focoPendente = useRef<AlvoFoco>(null);
  // controle inválido a reportar quando a etapa dele ficar visível —
  // reportValidity num passo `hidden` falha calado (controle infocável)
  const invalidoPendente = useRef<ControleInvalido | null>(null);

  // clamp em render ("adjust state"): a lista de etapas pode encolher com a
  // superfície montada (passo condicional que some) — o índice recua junto,
  // sem efeito extra
  const ultima = Math.max(0, total - 1);
  const etapa = Math.min(Math.max(0, etapaBruta), ultima);
  if (etapa !== etapaBruta) setEtapaBruta(etapa);

  function resolverPendentes() {
    const alvo = focoPendente.current;
    const invalido = invalidoPendente.current;
    if (alvo == null && invalido == null) return;
    focoPendente.current = null;
    invalidoPendente.current = null;
    if (typeof alvo === "function") alvo();
    else if (alvo === "titulo") tituloEtapaRef.current?.focus();
    // reportValidity por último: ele mesmo foca o controle — um foco depois
    // dele roubaria o anúncio do campo inválido
    invalido?.reportValidity();
  }

  // sem array de deps de propósito: roda depois de TODO commit — a agenda
  // só pode disparar quando a etapa alvo já está fora do `hidden`
  useEffect(resolverPendentes);

  /** Navega pro índice `proxima` — marca a direção do slide e agenda o foco
   *  pro commit seguinte. Destino clampado aos limites; ir pro índice em que
   *  já está resolve o pendente na hora (não há commit novo pra efeito). */
  function irPara(proxima: number, alvo: AlvoFoco = "titulo") {
    focoPendente.current = alvo;
    const destino = Math.min(Math.max(0, proxima), ultima);
    if (destino === etapa) {
      resolverPendentes();
      return;
    }
    setDirecao(destino > etapa ? 1 : -1);
    setEtapaBruta(destino);
  }

  /** Volta ao início sem agenda de foco — reabrir a superfície (ou restaurar
   *  um rascunho) recomeça em direção de avanço. */
  function reiniciar(proxima = 0) {
    focoPendente.current = null;
    invalidoPendente.current = null;
    setDirecao(1);
    setEtapaBruta(proxima);
  }

  /** Troca de "fase" dirigida por dado (importadores, cronograma — não há
   *  índice de etapa): marca só a direção do slide + o foco pro commit que
   *  já vem a seguir no mesmo gesto. */
  function assinalar(dir: DirecaoEtapa, alvo: AlvoFoco = "titulo") {
    focoPendente.current = alvo;
    setDirecao(dir);
  }

  /** O controle inválido mora numa etapa escondida: marca ANTES de irPara —
   *  o reportValidity sai depois do commit que tirou o `hidden`. */
  function marcarInvalido(controle: ControleInvalido) {
    invalidoPendente.current = controle;
  }

  return {
    etapa,
    direcao,
    irPara,
    reiniciar,
    assinalar,
    marcarInvalido,
    tituloEtapaRef,
  };
}

/** Painel de uma etapa — o único lugar onde o idioma `hidden` +
 *  .animate-enter-x + --dir é escrito. Modo montado: a superfície renderiza
 *  todas as etapas e alterna `ativa` (a inativa sai da ordem de tab e da
 *  árvore de acessibilidade, mas os inputs seguem no FormData). Modo
 *  remount: a superfície renderiza só a etapa ativa (key pelo id da etapa)
 *  — mesma assinatura de movimento, opt-in explícito pra estado controlado. */
export function Etapa({
  ativa = true,
  direcao,
  className,
  style,
  ref,
  children,
  ...rest
}: Omit<ComponentPropsWithoutRef<"div">, "hidden" | "ref"> & {
  /** false = a etapa segue montada sob `hidden` */
  ativa?: boolean;
  direcao: DirecaoEtapa;
  ref?: Ref<HTMLDivElement>;
}) {
  return (
    <div
      ref={ref}
      hidden={!ativa}
      className={cn("animate-enter-x", className)}
      style={{ ...style, "--dir": `${direcao * 8}px` } as CSSProperties}
      {...rest}
    >
      {children}
    </div>
  );
}

/** Crossfade pra troca de estado no mesmo lugar — form vira resultado,
 *  carregando vira conteúdo. É a camada "estado" da gramática: navegação
 *  de etapa é a <Etapa> direcional, não isso aqui.
 *
 *  `foco`: o painel entrante recebe focus() depois do primeiro mount (a
 *  pintura inicial não é troca). Quem dispara a troca (o submit) costuma
 *  desmontar junto — sem isso o foco caía no <body>, órfão. Um boolean
 *  calculado (`foco={fase !== "form"}`) exclui painéis com foco próprio
 *  (um campo com autoFocus dentro). `centralizar` rola o painel pro centro
 *  antes — páginas roláveis onde o submit acontece lá embaixo. */
export function FadeTroca({
  chave,
  foco = false,
  centralizar = false,
  className,
  children,
}: {
  chave: string | number;
  foco?: boolean;
  centralizar?: boolean;
  className?: string;
  children: ReactNode;
}) {
  // com mode="wait" o painel entrante monta só DEPOIS do exit do anterior
  // — um efeito por [chave] dispararia com o ref ainda no painel que sai
  // (e o foco morreria com ele no unmount). O ref callback dispara quando
  // o nó entrante existe de verdade; `visto` distingue a 1ª pintura (que
  // não é troca) da montagem pós-exit.
  const visto = useRef(chave);
  const painelRef = useCallback(
    (el: HTMLDivElement | null) => {
      if (!el) return;
      if (foco && visto.current !== chave) {
        if (centralizar) el.scrollIntoView({ block: "center" });
        el.focus({ preventScroll: centralizar });
      }
      visto.current = chave;
    },
    [chave, foco, centralizar]
  );

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={chave}
        ref={painelRef}
        {...fade}
        transition={T.enter}
        tabIndex={foco ? -1 : undefined}
        className={cn(foco && "outline-none", className)}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}

/** Um passo do WizardPassos — `conteudo` fica montado o tempo todo (o passo
 *  inativo leva `hidden`, então os inputs seguem no FormData e nos
 *  defaults; desmontar perderia os valores não-controlados). */
export type PassoWizard = {
  /** título da seção — o que aparece no heading "Passo N de M · título" */
  titulo: string;
  /** símbolo da seção no stepper — a nav é visual, o nome legível fica no
   *  heading da etapa ativa e no aria-label do círculo */
  icone: Icon;
  conteudo: ReactNode;
};

/** Wizard de etapas pros dialogs de cadastro/edição — stepper de círculos
 *  com símbolo por seção + heading "Passo N de M · título": os círculos
 *  navegam direto (trás livre, pra frente com a etapa atual válida), todos
 *  os passos ficam montados (`hidden` nos inativos) e o rodapé sticky tem
 *  Voltar/Avançar/Salvar com alvos de toque de verdade. O form fica aqui
 *  dentro: Enter antes do último passo avança, não salva. Com
 *  `saveAnywhere` o Salvar fica sempre à mão — o FormData viaja inteiro de
 *  qualquer etapa porque nada desmonta. */
export function WizardPassos({
  passos,
  pending,
  submitLabel,
  pendingLabel = "Salvando…",
  saveAnywhere = false,
  onSubmit,
}: {
  passos: PassoWizard[];
  pending: boolean;
  submitLabel: string;
  pendingLabel?: string;
  /** edição: salva sem chegar no último passo — a ação vive no rodapé em
   *  todas as etapas (edição é patch, cada save leva o form todo) */
  saveAnywhere?: boolean;
  onSubmit: (e: FormEvent<HTMLFormElement>) => void;
}) {
  const { etapa, direcao, irPara, marcarInvalido, tituloEtapaRef } =
    useTrocaDeEtapa<HTMLHeadingElement>(passos.length);
  const passosRef = useRef<(HTMLDivElement | null)[]>([]);
  const ultima = passos.length - 1;

  /** Primeiro controle inválido da etapa — input `required` num passo
   *  `hidden` falha calado no Chrome (controle infocável), então quem chama
   *  decide: reportar na hora (etapa visível) ou navegar primeiro. */
  function primeiroInvalido(
    passo: HTMLDivElement | null | undefined
  ): ControleInvalido | null {
    if (!passo) return null;
    for (const c of passo.querySelectorAll("input, select, textarea")) {
      if (
        (c instanceof HTMLInputElement ||
          c instanceof HTMLSelectElement ||
          c instanceof HTMLTextAreaElement) &&
        !c.checkValidity()
      ) {
        return c;
      }
    }
    return null;
  }

  /** Os campos do passo visível precisam valer antes de avançar — a
   *  checagem roda com o campo ainda visível pro reportValidity aparecer. */
  function passoValido(): boolean {
    const c = primeiroInvalido(passosRef.current[etapa]);
    if (!c) return true;
    c.reportValidity();
    return false;
  }

  /** O save cobre TODAS as etapas, não só a atual — pode vir de qualquer
   *  uma (saveAnywhere) e a barra de etapas pula sem checar o meio. Ao
   *  achar um inválido escondido, vai até a etapa dele e reporta lá. */
  function todasEtapasValidas(): boolean {
    for (let i = 0; i < passos.length; i++) {
      const c = primeiroInvalido(passosRef.current[i]);
      if (c) {
        // inválido na etapa atual: reporta na hora — o campo já está
        // visível e o foco não deve passear pelo título primeiro
        if (i === etapa) {
          c.reportValidity();
          return false;
        }
        marcarInvalido(c);
        irPara(i);
        return false;
      }
    }
    return true;
  }

  function avancar() {
    if (!passoValido()) return;
    irPara(etapa + 1);
  }

  /** Barra de etapas: pra trás é livre; pra frente a etapa atual tem que
   *  valer (o que faltar no meio o save cobra na validação inteira). */
  function pularPara(i: number) {
    if (i === etapa) return;
    if (i > etapa && !passoValido()) return;
    irPara(i);
  }

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    // submit sem botão marcado (Enter implícito, requestSubmit) antes do
    // último passo avança; o clique no Salvar grava de qualquer etapa —
    // o FormData sempre tem tudo porque os passos seguem montados
    const sub = (e.nativeEvent as SubmitEvent).submitter;
    const salvar =
      sub instanceof HTMLElement && sub.hasAttribute("data-salvar");
    if (etapa < ultima && !salvar) {
      avancar();
      return;
    }
    if (!todasEtapasValidas()) return;
    onSubmit(e);
  }

  function onEnterKey(e: KeyboardEvent<HTMLFormElement>) {
    // Enter num input avança etapa; botões/links/textareas não entram e o
    // Enter próprio do TagInput já vem preventDefault — respeitar
    if (
      e.key !== "Enter" ||
      e.defaultPrevented ||
      etapa >= ultima ||
      !(e.target instanceof HTMLInputElement) ||
      e.target.type === "hidden" ||
      e.target.type === "file"
    ) {
      return;
    }
    e.preventDefault();
    avancar();
  }

  return (
    <form onSubmit={handleSubmit} onKeyDown={onEnterKey} className="space-y-4">
      {/* cabeçalho do wizard — stepper visual na linguagem da trilha
          (trilha-jornada): círculo com o símbolo da seção, conectores que
          preenchem o percorrido e o nome legível no heading (âncora de
          foco a cada troca). Cada círculo navega direto pra etapa (trás
          livre, pra frente com a atual válida); os nomes ficam no
          aria-label e no title */}
      <div className="space-y-2.5">
        <ol className="flex items-center" aria-label="Etapas">
          {passos.map((p, i) => {
            const Icone = p.icone;
            const atual = i === etapa;
            return (
              <li
                key={p.titulo}
                className={cn("flex items-center", i > 0 && "min-w-0 flex-1")}
              >
                {i > 0 && (
                  <span
                    aria-hidden
                    className={cn(
                      // o conector encolhe até sumir antes dos círculos se
                      // tocarem — em 320px o alvo de toque segue garantido
                      "h-0.5 min-w-0 flex-1 rounded-full transition-colors",
                      i <= etapa ? "bg-primary/60" : "bg-muted"
                    )}
                  />
                )}
                <button
                  type="button"
                  onClick={() => pularPara(i)}
                  aria-current={atual ? "step" : undefined}
                  aria-label={`Etapa ${i + 1} de ${passos.length}: ${p.titulo}`}
                  title={p.titulo}
                  // 40px de alvo (eram barras de ~14px de hit) — em telas
                  // muito estreitas o círculo encolhe até o disco (32px)
                  // em vez de cortar a última etapa
                  className="group grid size-10 shrink min-w-8 place-items-center rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring/50 sm:size-11"
                >
                  <span
                    className={cn(
                      "grid size-8 place-items-center rounded-full transition-[color,background-color,transform] group-hover:scale-105",
                      atual
                        ? "bg-primary text-primary-foreground"
                        : i < etapa
                          ? "bg-primary/25 text-foreground group-hover:bg-primary/40"
                          : "bg-muted text-muted-foreground group-hover:bg-muted-foreground/25"
                    )}
                  >
                    <Icone
                      size={16}
                      weight={atual ? "fill" : "regular"}
                      aria-hidden
                    />
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
        <h3 ref={tituloEtapaRef} tabIndex={-1} className="text-sm font-medium outline-none">
          Passo {etapa + 1} de {passos.length} · {passos[etapa]?.titulo}
        </h3>
      </div>

      {passos.map((p, i) => (
        <Etapa
          key={p.titulo}
          ativa={i === etapa}
          direcao={direcao}
          ref={(el) => {
            passosRef.current[i] = el;
          }}
        >
          <div className="space-y-4">{p.conteudo}</div>
        </Etapa>
      ))}

      {/* rodapé do wizard — Avançar e Salvar ficam montados o tempo todo
          (`hidden` alterna): um botão que VIRASSE submit no mesmo clique
          disparava o form — o default action do clique é avaliado depois
          do re-render, então o último "Avançar" já salvava e a etapa da
          foto/consentimento era pulada. O Salvar leva formNoValidate: a
          validação inteira é manual (todasEtapasValidas), senão um
          required escondido bloqueava o submit sem aviso */}
      <DialogFooter sticky>
        {etapa > 0 && (
          <Button
            type="button"
            variant="ghost"
            size="lg"
            // alvo de 48px + texto maior no toque — botão fino era o bug
            // do mobile; no md+ volta pro degrau lg do sistema
            className="h-12 text-base sm:me-auto md:text-sm"
            onClick={() => irPara(etapa - 1)}
          >
            <CaretLeft /> Voltar
          </Button>
        )}
        <Button
          type="button"
          size="lg"
          className="h-12 flex-1 text-base md:text-sm"
          hidden={etapa >= ultima}
          onClick={avancar}
        >
          Avançar <CaretRight />
        </Button>
        <Button
          type="submit"
          formNoValidate
          data-salvar
          size="lg"
          className="h-12 flex-1 text-base md:text-sm"
          variant={etapa >= ultima ? "default" : "outline"}
          hidden={etapa < ultima && !saveAnywhere}
          disabled={pending}
        >
          {pending ? pendingLabel : submitLabel}
        </Button>
      </DialogFooter>
    </form>
  );
}
