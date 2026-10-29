"use client";

// AssistenteBolha (REALIZA-243): o assistente sai do nav e vira um FAB fixo
// no canto inferior direito do AppShell. Desktop = drop-up ancorado no
// botão (Popover não-modal — Esc e clique fora fecham); mobile = Sheet de
// rodapé (backdrop, focus trap, cobre a bottom-nav pelo z-50). O painel é o
// mesmo AssistenteConversa nos dois. Estado aberto persiste em
// sessionStorage (a aba lembra; outra aba, outro painel) — leitura em
// useEffect pós-hidratação pra não divergir do SSR. Guard global de
// prefers-reduced-motion já zera as animações — nada por componente.

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Plus, Sparkle, X } from "@phosphor-icons/react";
import { AssistenteConversa } from "@/components/assistente-conversa";
import {
  Popover,
  PopoverContent,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import type { AppRole } from "@/lib/types";
import { cn } from "@/lib/utils";

// acima da bottom-nav (~57px + safe-area): o toaster usa 4.5rem, a pill da
// demo 4.75rem — mesma faixa. z-40: fica sob sheet/dialog/popover (z-50) e
// infinitamente sob o toaster (o sonner não dá pra superar — e não deve)
const FAB_POS =
  "fixed z-40 right-[max(1rem,env(safe-area-inset-right))] bottom-[calc(4.5rem+env(safe-area-inset-bottom))] md:bottom-6";

const FAB_CLS =
  "grid size-12 md:size-14 place-items-center rounded-full bg-[var(--brand-lime)] text-[var(--brand-ink)] shadow-[var(--shadow-overlay)] outline-none transition-[transform,box-shadow] duration-200 ease-[cubic-bezier(0.2,0,0,1)] hover:scale-105 hover:shadow-[var(--shadow-modal)] active:scale-95 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:ring-offset-2";

const PAINEL_CLS =
  "flex h-[min(70dvh,640px)] w-[min(24rem,calc(100vw-2rem))] max-h-(--available-height) flex-col overflow-hidden rounded-2xl p-0";

function subscribeDesktop(cb: () => void) {
  const mq = matchMedia("(min-width: 768px)");
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
}

function Cabecalho({
  onFechar,
  onNovaConversa,
}: {
  onFechar: () => void;
  onNovaConversa?: () => void;
}) {
  return (
    <div className="flex shrink-0 items-center gap-2.5 border-b border-border px-4 py-3">
      <span className="grid size-8 shrink-0 place-items-center rounded-full bg-[var(--brand-lime)] text-[var(--brand-ink)]">
        <Sparkle size={15} weight="fill" aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-1.5 text-sm font-semibold">
          Assistente
          <span
            aria-hidden
            className="size-1.5 rounded-full bg-[var(--ok-text)]"
          />
        </p>
        <p className="text-[11px] text-muted-foreground">
          Operação e guias do programa
        </p>
      </div>
      {onNovaConversa && (
        <Button
          variant="ghost"
          size="icon"
          aria-label="Nova conversa"
          title="Nova conversa"
          onClick={onNovaConversa}
          className="shrink-0 text-muted-foreground"
        >
          <Plus aria-hidden />
        </Button>
      )}
      <Button
        variant="ghost"
        size="icon"
        aria-label="Fechar assistente"
        onClick={onFechar}
        className="shrink-0 text-muted-foreground"
      >
        <X aria-hidden />
      </Button>
    </div>
  );
}

export function AssistenteBolha({
  papeis,
  demo,
  configurado,
  nome,
}: {
  papeis: AppRole[];
  demo: boolean;
  configurado: boolean;
  nome?: string;
}) {
  // SSR/hidratação renderiza o braço desktop (server snapshot true) — o
  // painel só existe aberto, então a escolha errada nunca aparece na tela
  const desktop = useSyncExternalStore(
    subscribeDesktop,
    () => matchMedia("(min-width: 768px)").matches,
    () => true
  );
  const [aberto, setAberto] = useState(false);
  const [pronto, setPronto] = useState(false);

  // restaura a sessão após hidratar — fora do render pra não divergir do
  // SSR; o rAF tira o setState do corpo do effect (regra react-hooks)
  useEffect(() => {
    const id = requestAnimationFrame(() => {
      try {
        if (sessionStorage.getItem("assistente:aberto") === "1") setAberto(true);
      } catch {
        // storage indisponível (modo privado): painel simplesmente abre fechado
      }
      setPronto(true);
    });
    return () => cancelAnimationFrame(id);
  }, []);

  const mudar = (v: boolean) => {
    setAberto(v);
    try {
      sessionStorage.setItem("assistente:aberto", v ? "1" : "0");
    } catch {}
  };

  // "Nova conversa" mora na conversa (dona do estado) — a ação é
  // registrada aqui pro botão do header alcançar
  const novaConversaRef = useRef<(() => void) | null>(null);
  const conversa = (
    <AssistenteConversa
      papeis={papeis}
      demo={demo}
      configurado={configurado}
      autoFocus
      nome={nome}
      registrarNova={(fn) => {
        novaConversaRef.current = fn;
      }}
    />
  );
  const novaConversa = () => novaConversaRef.current?.();

  const icons = (
    <span className="relative grid size-6 place-items-center">
      <Sparkle
        size={22}
        weight="fill"
        aria-hidden
        className={cn(
          "absolute transition-all duration-200 ease-[cubic-bezier(0.2,0,0,1)]",
          aberto ? "scale-50 rotate-90 opacity-0" : "scale-100 rotate-0 opacity-100"
        )}
      />
      <X
        size={20}
        weight="bold"
        aria-hidden
        className={cn(
          "transition-all duration-200 ease-[cubic-bezier(0.2,0,0,1)]",
          aberto ? "scale-100 rotate-0 opacity-100" : "-rotate-90 scale-50 opacity-0"
        )}
      />
    </span>
  );

  if (desktop) {
    return (
      <Popover open={aberto} onOpenChange={mudar}>
        <div className={cn(FAB_POS, pronto && "animate-in fade-in-0 zoom-in-75 duration-300")}>
          <PopoverTrigger
            aria-label={aberto ? "Fechar assistente" : "Abrir assistente"}
            aria-expanded={aberto}
            aria-controls="painel-assistente"
            className={FAB_CLS}
          >
            {icons}
          </PopoverTrigger>
        </div>
        <PopoverContent
          id="painel-assistente"
          side="top"
          align="end"
          sideOffset={12}
          className={PAINEL_CLS}
        >
          <Cabecalho onFechar={() => mudar(false)} onNovaConversa={novaConversa} />
          <PopoverTitle className="sr-only">Assistente</PopoverTitle>
          {conversa}
        </PopoverContent>
      </Popover>
    );
  }

  return (
    <>
      <div className={cn(FAB_POS, pronto && "animate-in fade-in-0 zoom-in-75 duration-300")}>
        <Button
          aria-label={aberto ? "Fechar assistente" : "Abrir assistente"}
          aria-expanded={aberto}
          aria-controls="painel-assistente"
          onClick={() => mudar(true)}
          className={FAB_CLS}
        >
          {icons}
        </Button>
      </div>
      <Sheet open={aberto} onOpenChange={mudar}>
        <SheetContent
          id="painel-assistente"
          side="bottom"
          showCloseButton={false}
          className="gap-0 overflow-hidden bg-popover text-popover-foreground"
        >
          <SheetTitle className="sr-only">Assistente</SheetTitle>
          <Cabecalho onFechar={() => mudar(false)} onNovaConversa={novaConversa} />
          {conversa}
        </SheetContent>
      </Sheet>
    </>
  );
}
