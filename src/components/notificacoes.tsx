"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import Link from "next/link";
import {
  Bell,
  Check,
  CheckCircle,
  HandHeart,
  Megaphone,
  UsersThree,
} from "@phosphor-icons/react";
import { toast } from "sonner";
import {
  listarNotificacoes,
  marcarNotificacaoLida,
  marcarTodasNotificacoesLidas,
} from "@/lib/actions";
import { Popover, PopoverContent, PopoverTitle, PopoverTrigger } from "@/components/ui/popover";
import { cn, pathInterno } from "@/lib/utils";
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
  // ids marcados localmente — o poll/refetch nunca reverte lida_em pra null
  // (resposta emitida antes do UPDATE commitar chegaria com o item não-lido)
  const marcadas = useRef(new Set<string>());
  const emVoo = useRef(false);
  const ultimoAnunciado = useRef(inicial.naoLidas);
  const [anuncio, setAnuncio] = useState("");

  // navegação traz dados frescos do SSR — ajusta durante o render (padrão
  // oficial pra "props mudaram"), sem efeito cascata
  const [ultimoInicial, setUltimoInicial] = useState(inicial);
  if (inicial !== ultimoInicial) {
    setUltimoInicial(inicial);
    // preserva marcações locais ainda não confirmadas pelo server — senão um
    // refresh chegando entre o clique e o commit reverteria o item pra não-lido
    setEstado((s) => {
      const lidaLocal = (id: string) =>
        s.itens.find((i) => i.id === id)?.lida_em;
      const locais = inicial.itens.filter(
        (n) => !n.lida_em && lidaLocal(n.id)
      ).length;
      return {
        itens: inicial.itens.map((n) =>
          !n.lida_em && lidaLocal(n.id)
            ? { ...n, lida_em: lidaLocal(n.id)! }
            : n
        ),
        naoLidas: Math.max(0, inicial.naoLidas - locais),
      };
    });
  }

  const recarregar = useCallback(async () => {
    if (emVoo.current) return;
    emVoo.current = true;
    try {
      const r = await listarNotificacoes();
      if (r.ok) {
        const raw = r.itens ?? [];
        const locais = raw.filter(
          (n) => !n.lida_em && marcadas.current.has(n.id)
        ).length;
        const itens = raw.map((n) =>
          !n.lida_em && marcadas.current.has(n.id)
            ? { ...n, lida_em: new Date().toISOString() }
            : n
        );
        setEstado({
          itens,
          naoLidas: Math.max(0, (r.naoLidas ?? 0) - locais),
        });
      }
    } catch (e) {
      console.error("notificacoes poll:", e);
    } finally {
      emVoo.current = false;
    }
  }, []);

  // aria-live: anuncia só quando a contagem sobe — decremento é ação do próprio
  // usuário (já tem feedback no clique), não precisa de live region
  useEffect(() => {
    if (estado.naoLidas > ultimoAnunciado.current) {
      setAnuncio(
        estado.naoLidas === 1
          ? "1 notificação não lida"
          : `${estado.naoLidas} notificações não lidas`
      );
      // esvazia depois de anunciar — texto idêntico não re-anuncia na live
      // region, então "3 não lidas" → lê → 3 novas precisa do reset pra soar
      const t = setTimeout(() => setAnuncio(""), 2000);
      return () => clearTimeout(t);
    }
    ultimoAnunciado.current = estado.naoLidas;
  }, [estado.naoLidas]);

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
    marcadas.current.add(id);
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
    void marcarNotificacaoLida(id).then((r) => {
      if (r?.error) {
        marcadas.current.delete(id);
        toast.error(r.error);
        void recarregar();
      }
    });
  }, [recarregar]);

  const marcarTodas = useCallback(() => {
    setEstado((s) => {
      s.itens.forEach((i) => marcadas.current.add(i.id));
      return {
        itens: s.itens.map((i) => ({
          ...i,
          lida_em: i.lida_em ?? new Date().toISOString(),
        })),
        naoLidas: 0,
      };
    });
    void marcarTodasNotificacoesLidas().then((r) => {
      if (r?.error) {
        marcadas.current.clear();
        toast.error(r.error);
        void recarregar();
      }
    });
  }, [recarregar]);

  return (
    <NotificacoesCtx.Provider
      value={{ ...estado, marcar, marcarTodas, recarregar }}
    >
      {children}
      <p aria-live="polite" className="sr-only">
        {anuncio}
      </p>
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
        {/* lime, não danger — contagem não-lida não é alerta; o vermelho
            fica reservado a apoio/risco */}
        {naoLidas > 0 && (
          <span
            aria-hidden
            className="absolute right-1 top-1 grid min-w-4 place-items-center rounded-full bg-[var(--brand-lime)] px-1 text-[11px] font-semibold leading-4 text-[var(--brand-ink)] tabular-nums"
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
              className="-my-2 rounded-md px-3 py-2.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground min-h-11 sm:min-h-0 sm:py-2"
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
          <ul className="scroll-fina max-h-[min(24rem,var(--available-height,24rem))] divide-y divide-border/60 overflow-y-auto">
            {itens.map((n) => {
              const Icone = ICONE[n.tipo] ?? Bell;
              const lida = !!n.lida_em;
              return (
                <li key={n.id} className={cn("flex items-stretch", !lida && "bg-muted/40")}>
                  {(() => {
                    // com href é navegação real → <a>: Cmd+click, nova aba e
                    // preview de URL funcionam; sem href continua botão
                    const hrefOk = pathInterno(n.href);
                    const conteudo = (
                      <>
                        <span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-full bg-muted text-muted-foreground">
                          <Icone size={14} aria-hidden />
                        </span>
                        <span className="min-w-0 flex-1">
                          {!lida && <span className="sr-only">Não lida · </span>}
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
                      </>
                    );
                    const classe =
                      "flex min-w-0 flex-1 items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/60";
                    const aoClicar = () => {
                      if (!lida) marcar(n.id);
                      setAberto(false);
                    };
                    return hrefOk ? (
                      <Link href={hrefOk} onClick={aoClicar} className={classe}>
                        {conteudo}
                      </Link>
                    ) : (
                      <button type="button" onClick={aoClicar} className={classe}>
                        {conteudo}
                      </button>
                    );
                  })()}
                  {!lida && (
                    <button
                      type="button"
                      onClick={() => marcar(n.id)}
                      aria-label="Marcar como lida"
                      title="Marcar como lida"
                      className="grid w-11 shrink-0 place-items-center text-muted-foreground transition-colors hover:text-foreground"
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
