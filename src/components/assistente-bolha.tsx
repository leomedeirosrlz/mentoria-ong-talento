"use client";

// AssistenteBolha (REALIZA-243): o assistente sai do nav e vira um FAB fixo
// no canto inferior direito do AppShell. Desktop = drop-up ancorado no
// botão (Popover não-modal — Esc e clique fora fecham); mobile = Sheet de
// rodapé (backdrop, focus trap, cobre a bottom-nav pelo z-50). O painel é o
// mesmo AssistenteConversa nos dois. Estado aberto persiste em
// sessionStorage (a aba lembra; outra aba, outro painel) — leitura em
// useEffect pós-hidratação pra não divergir do SSR. Guard global de
// prefers-reduced-motion já zera as animações — nada por componente.

import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { ClockCounterClockwise, Plus, Sparkle, X } from "@phosphor-icons/react";
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
  "flex h-[min(70dvh,640px)] w-[min(24rem,calc(100vw-2rem))] max-h-(--available-height) flex-col overflow-hidden rounded-2xl p-0 duration-200";

function subscribeDesktop(cb: () => void) {
  const mq = matchMedia("(min-width: 768px)");
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
}

function Cabecalho({
  onFechar,
  onNovaConversa,
  onHistorico,
}: {
  onFechar: () => void;
  onNovaConversa?: () => void;
  onHistorico?: () => void;
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
      {onHistorico && (
        <Button
          variant="ghost"
          size="icon"
          aria-label="Histórico de conversas"
          title="Histórico de conversas"
          onClick={onHistorico}
          className="shrink-0 text-muted-foreground"
        >
          <ClockCounterClockwise aria-hidden />
        </Button>
      )}
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

  // "Nova conversa" e "Histórico" moram na conversa (dona do estado) — as
  // ações são registradas aqui pros botões do header alcançarem
  const novaConversaRef = useRef<(() => void) | null>(null);
  const historicoRef = useRef<(() => void) | null>(null);
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
      registrarHistorico={(fn) => {
        historicoRef.current = fn;
      }}
    />
  );
  const novaConversa = () => novaConversaRef.current?.();
  const alternarHistorico = () => historicoRef.current?.();

  // teclado do celular (iOS Safari): a viewport visual encolhe mas a layout
  // não — visualViewport mede a diferença e a sheet sobe junto. Android já
  // cobre via interactive-widget=resizes-content no meta (kb≈0 lá).
  const [kb, setKb] = useState(0);
  useEffect(() => {
    if (desktop || !aberto) return;
    const vv = window.visualViewport;
    if (!vv) return;
    const medir = () => {
      const diff = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
      setKb(Math.round(diff));
    };
    medir();
    vv.addEventListener("resize", medir);
    vv.addEventListener("scroll", medir);
    return () => {
      vv.removeEventListener("resize", medir);
      vv.removeEventListener("scroll", medir);
    };
  }, [desktop, aberto]);

  // arrastar p/ baixo fecha — a alça no topo da sheet rastreia o dedo 1:1
  // via transform (compositor, 60fps); >88px confirma, senão snap de volta.
  // Só toque/stylus: mouse usa X/Esc/backdrop como sempre.
  const popupRef = useRef<HTMLDivElement | null>(null);
  const arrastoRef = useRef<{ y0: number; dy: number } | null>(null);
  const iniciarArrasto = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.pointerType === "mouse") return;
    arrastoRef.current = { y0: e.clientY, dy: 0 };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const moverArrasto = (e: ReactPointerEvent<HTMLDivElement>) => {
    const a = arrastoRef.current;
    const el = popupRef.current;
    if (!a || !el) return;
    a.dy = Math.max(0, e.clientY - a.y0);
    el.style.transform = `translateY(${a.dy}px)`;
  };
  const soltarArrasto = () => {
    const a = arrastoRef.current;
    arrastoRef.current = null;
    const el = popupRef.current;
    if (!a || !el) return;
    el.style.transform = "";
    if (a.dy > 88) {
      mudar(false); // a saída animada do Sheet termina o gesto
    } else {
      el.style.transition = "transform 180ms cubic-bezier(0.2,0,0,1)";
      setTimeout(() => {
        if (el.isConnected) el.style.transition = "";
      }, 200);
    }
  };

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
          <Cabecalho
            onFechar={() => mudar(false)}
            onNovaConversa={novaConversa}
            onHistorico={alternarHistorico}
          />
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
          ref={popupRef}
          id="painel-assistente"
          side="bottom"
          showCloseButton={false}
          style={{
            // teclado iOS: a sheet sobe inteira acima dele e encolhe pra
            // não estourar o topo — bottom (offset) não briga com o
            // transform do arrasto
            bottom: kb || undefined,
            maxHeight: kb ? `calc(100dvh - ${kb}px)` : undefined,
          }}
          className="h-[min(88dvh,760px)] gap-0 overflow-hidden bg-popover text-popover-foreground duration-300"
        >
          <SheetTitle className="sr-only">Assistente</SheetTitle>
          {/* alça de arrasto: affordance de sheet nativa + gesto p/ fechar
              (decorativa — X, backdrop e Esc fecham acessível) */}
          <div
            onPointerDown={iniciarArrasto}
            onPointerMove={moverArrasto}
            onPointerUp={soltarArrasto}
            onPointerCancel={soltarArrasto}
            className="grid h-6 shrink-0 cursor-grab touch-none place-items-center pt-1.5"
            aria-hidden
          >
            <span className="h-1 w-10 rounded-full bg-muted-foreground/30" />
          </div>
          <Cabecalho
            onFechar={() => mudar(false)}
            onNovaConversa={novaConversa}
            onHistorico={alternarHistorico}
          />
          {conversa}
        </SheetContent>
      </Sheet>
    </>
  );
}
