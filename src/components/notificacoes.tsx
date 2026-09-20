"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import {
  Bell,
  Check,
  CheckCircle,
  HandHeart,
  Megaphone,
  UsersThree,
} from "@phosphor-icons/react";
import {
  listarNotificacoes,
  marcarNotificacaoLida,
  marcarTodasNotificacoesLidas,
} from "@/lib/actions";
import { Popover, PopoverContent, PopoverTitle, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import type { Notificacao } from "@/lib/types";

type Estado = { itens: Notificacao[]; naoLidas: number };

type Ctx = Estado & {
  marcar: (id: string) => void;
  marcarTodas: () => void;
  recarregar: () => void;
};

const NotificacoesCtx = createContext<Ctx | null>(null);

const POLL_MS = 60_000;

/** Um provider por shell — as duas instâncias do sino (top bar mobile e
 *  sidebar desktop) compartilham estado e um único poll. Leituras são
 *  otimistas: nada de router.refresh() re-renderizando a página inteira. */
export function NotificacoesProvider({
  inicial,
  children,
}: {
  inicial: Estado;
  children: React.ReactNode;
}) {
  const [estado, setEstado] = useState<Estado>(inicial);
  // navegação traz dados frescos do SSR — ajusta durante o render (padrão
  // oficial pra "props mudaram"), sem efeito cascata
  const [ultimoInicial, setUltimoInicial] = useState(inicial);
  if (inicial !== ultimoInicial) {
    setUltimoInicial(inicial);
    setEstado(inicial);
  }

  const recarregar = useCallback(async () => {
    const r = await listarNotificacoes();
    if (r.ok) setEstado({ itens: r.itens ?? [], naoLidas: r.naoLidas ?? 0 });
  }, []);

  useEffect(() => {
    const t = setInterval(recarregar, POLL_MS);
    const onVis = () => {
      if (document.visibilityState === "visible") recarregar();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      clearInterval(t);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [recarregar]);

  const marcar = useCallback((id: string) => {
    setEstado((s) => {
      const alvo = s.itens.find((i) => i.id === id);
      if (!alvo || alvo.lida_em) return s;
      return {
        itens: s.itens.map((i) =>
          i.id === id ? { ...i, lida_em: new Date().toISOString() } : i
        ),
        naoLidas: Math.max(0, s.naoLidas - 1),
      };
    });
    void marcarNotificacaoLida(id);
  }, []);

  const marcarTodas = useCallback(() => {
    setEstado((s) => ({
      itens: s.itens.map((i) => ({ ...i, lida_em: i.lida_em ?? new Date().toISOString() })),
      naoLidas: 0,
    }));
    void marcarTodasNotificacoesLidas();
  }, []);

  return (
    <NotificacoesCtx.Provider value={{ ...estado, marcar, marcarTodas, recarregar }}>
      {children}
    </NotificacoesCtx.Provider>
  );
}

const ICONE: Record<Notificacao["tipo"], typeof Bell> = {
  comunicado: Megaphone,
  pedido_apoio: HandHeart,
  apoio_resolvido: CheckCircle,
  dupla_formada: UsersThree,
};

export function NotificacoesBell({
  side,
  align,
}: {
  side: "bottom" | "right";
  align: "start" | "end" | "center";
}) {
  const ctx = useContext(NotificacoesCtx);
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  if (!ctx) return null;
  const { itens, naoLidas, marcar, marcarTodas, recarregar } = ctx;

  return (
    <Popover
      open={aberto}
      onOpenChange={(o) => {
        setAberto(o);
        if (o) recarregar();
      }}
    >
      <PopoverTrigger
        aria-label={
          naoLidas > 0
            ? `Notificações, ${naoLidas} não ${naoLidas === 1 ? "lida" : "lidas"}`
            : "Notificações"
        }
        className="relative grid size-11 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      >
        <Bell size={20} weight={naoLidas > 0 ? "fill" : "regular"} aria-hidden />
        {naoLidas > 0 && (
          <span
            aria-hidden
            className="absolute right-1 top-1 grid min-w-4 place-items-center rounded-full bg-[var(--danger)] px-1 text-[10px] font-semibold leading-4 text-white tabular-nums"
          >
            {naoLidas > 9 ? "9+" : naoLidas}
          </span>
        )}
      </PopoverTrigger>
      <PopoverContent
        side={side}
        align={align}
        sideOffset={8}
        className="w-80 max-w-[calc(100vw-2rem)] p-0"
      >
        <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
          <PopoverTitle className="text-sm">Notificações</PopoverTitle>
          {naoLidas > 0 && (
            <button
              type="button"
              onClick={marcarTodas}
              className="text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              Marcar todas como lidas
            </button>
          )}
        </div>
        {itens.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
            <Bell size={24} className="text-muted-foreground/50" aria-hidden />
            <p className="text-sm text-muted-foreground">Nenhuma notificação ainda.</p>
          </div>
        ) : (
          <ul className="scroll-fina max-h-96 divide-y divide-border/60 overflow-y-auto">
            {itens.map((n) => {
              const Icone = ICONE[n.tipo] ?? Bell;
              const lida = !!n.lida_em;
              return (
                <li key={n.id} className={cn("flex items-stretch", !lida && "bg-muted/40")}>
                  <button
                    type="button"
                    onClick={() => {
                      if (!lida) marcar(n.id);
                      setAberto(false);
                      if (n.href) router.push(n.href);
                    }}
                    className="flex min-w-0 flex-1 items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/60"
                  >
                    <span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-full bg-muted text-muted-foreground">
                      <Icone size={14} aria-hidden />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline gap-2">
                        <span className={cn("truncate text-sm", !lida && "font-medium")}>
                          {n.titulo}
                        </span>
                        <span className="ml-auto shrink-0 text-[11px] text-muted-foreground">
                          {tempoRelativo(n.created_at)}
                        </span>
                      </span>
                      {n.corpo && (
                        <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                          {n.corpo}
                        </span>
                      )}
                    </span>
                  </button>
                  {!lida && (
                    <button
                      type="button"
                      onClick={() => marcar(n.id)}
                      aria-label="Marcar como lida"
                      title="Marcar como lida"
                      className="grid w-9 shrink-0 place-items-center text-muted-foreground transition-colors hover:text-foreground"
                    >
                      <Check size={14} aria-hidden />
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </PopoverContent>
    </Popover>
  );
}

function tempoRelativo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60_000);
  if (min < 1) return "agora";
  if (min < 60) return `há ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `há ${h} h`;
  const d = Math.floor(h / 24);
  if (d === 1) return "ontem";
  if (d < 7) return `há ${d} d`;
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "numeric",
    month: "short",
    timeZone: "America/Sao_Paulo",
  });
}
