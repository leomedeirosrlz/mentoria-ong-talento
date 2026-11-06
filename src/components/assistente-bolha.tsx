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
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type PointerEvent as ReactPointerEvent,
} from "react";
import {
  ArrowsIn,
  ArrowsOut,
  ClockCounterClockwise,
  Gear,
  Plus,
  X,
} from "@phosphor-icons/react";
import { usePathname } from "next/navigation";
import { AssistenteConfig } from "@/components/assistente-config";
import {
  AssistenteConversa,
  sugestoes,
} from "@/components/assistente-conversa";
// conceito escolhido: Blob — os três protótipos dividem o contrato
// LizaProps (liza/tipos.ts), então trocar de conceito é trocar o import
import { LizaBlob } from "@/components/liza/liza-blob";
import { LizaFala, LizaRotulo } from "@/components/liza/liza-fala";
import type { LizaEstado } from "@/components/liza/tipos";
import { useMomento } from "@/components/liza/use-olhar";
import {
  Popover,
  PopoverContent,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import {
  APRESENTACOES_MAX,
  DURACAO_FALA,
  FALA_PRONTO,
  proximaFala,
  type FalaLiza,
  type MemoriaFalas,
} from "@/lib/liza-falas";
import type { AppRole } from "@/lib/types";
import { cn } from "@/lib/utils";

// acima da bottom-nav (~57px + safe-area): o toaster usa 4.5rem, a pill da
// demo 4.75rem — mesma faixa. z-40: fica sob sheet/dialog/popover (z-50) e
// infinitamente sob o toaster (o sonner não dá pra superar — e não deve)
const FAB_POS =
  "fixed z-40 right-[max(1rem,env(safe-area-inset-right))] bottom-[calc(4.5rem+env(safe-area-inset-bottom))] md:bottom-6";

const FAB_CLS =
  "group/fab grid size-12 md:size-14 place-items-center rounded-full bg-[var(--brand-lime)] text-[var(--brand-ink)] shadow-[var(--shadow-overlay)] outline-none transition-[transform,box-shadow] duration-200 ease-[cubic-bezier(0.2,0,0,1)] hover:scale-105 hover:shadow-[var(--shadow-modal)] active:scale-95 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:ring-offset-2";

// tamanho vem de --painel-w/--painel-h (inline, redimensionável); o min()
// segura viewport estreita e o --available-height do positioner segura
// o topo. A transição de tamanho só liga no toggle Expandir — no arrasto
// o data-redimensionando desliga pra seguir o ponteiro 1:1. O zoom-90 (no
// lugar do -95 padrão) dá mais viagem à entrada: o painel "nasce" da bolha
// — a origem é o canto ancorado no FAB (transform-origin do positioner)
const PAINEL_CLS =
  "relative flex h-[min(var(--painel-h),calc(100dvh-7rem))] w-[min(var(--painel-w),calc(100vw-2rem))] max-h-(--available-height) flex-col overflow-hidden rounded-2xl p-0 duration-200 transition-[width,height] ease-[cubic-bezier(0.2,0,0,1)] data-[redimensionando]:transition-none data-open:zoom-in-90 data-closed:zoom-out-90";

// px — padrão = o painel de sempre; expandido = leitura confortável de
// gráfico e tabela; os limites seguram o mínimo legível e o máximo útil
const TAM_PADRAO = { w: 384, h: 640 };

// mascote da conversa — a bolha é dona do componente; o estado chega por
// render-prop porque a conversa é quem conhece a rodada (stream/erro).
// "escrevendo" (stream saindo) o rosto mostra como "falando": a boca
// tagarela enquanto ela despeja a resposta
const falando = (e: LizaEstado): LizaEstado =>
  e === "escrevendo" ? "falando" : e;
const AvatarLiza = (p: { tamanho: number; estado: LizaEstado }) => (
  <LizaBlob tamanho={p.tamanho} estado={falando(p.estado)} />
);
const TAM_EXPANDIDO = { w: 640, h: 820 };
const TAM_MIN = { w: 352, h: 440 };
const TAM_MAX = { w: 960, h: 1000 };
const STORAGE_TAM = "assistente:tamanho";
const ehExpandido = (t: { w: number }) => t.w >= 560;
// ociosa demais com o painel fechado, a Liza cochila ("sonolento") —
// qualquer gesto acorda. Soninho é charme, mas o wait não pode virar
// queda de atenção: ~20s parada já bastam pra ela começar a pesar
const SONO_MS = 20_000;

const limitar = (t: { w: number; h: number }) => ({
  w: Math.round(Math.min(TAM_MAX.w, Math.max(TAM_MIN.w, t.w))),
  h: Math.round(Math.min(TAM_MAX.h, Math.max(TAM_MIN.h, t.h))),
});

/** Alças de redimensionar do painel ancorado embaixo à direita: ele cresce
 *  pra cima e pra esquerda, então as alças moram na borda esquerda, no topo
 *  e no canto superior esquerdo. O arrasto escreve as CSS vars direto no
 *  elemento (sem render por frame); soltar grava o tamanho e o estado. */
function AlcasRedimensionar({
  painelRef,
  tamanho,
  onSoltar,
}: {
  painelRef: React.RefObject<HTMLDivElement | null>;
  tamanho: { w: number; h: number };
  onSoltar: (t: { w: number; h: number }) => void;
}) {
  const arrasto = useRef<{
    x0: number;
    y0: number;
    w0: number;
    h0: number;
    eixo: "x" | "y" | "xy";
    atual: { w: number; h: number };
  } | null>(null);

  const iniciar = (
    eixo: "x" | "y" | "xy",
    e: ReactPointerEvent<HTMLDivElement>
  ) => {
    const el = painelRef.current;
    if (!el || e.button !== 0) return;
    e.preventDefault();
    const r = el.getBoundingClientRect();
    arrasto.current = {
      x0: e.clientX,
      y0: e.clientY,
      w0: r.width,
      h0: r.height,
      eixo,
      atual: { w: r.width, h: r.height },
    };
    el.dataset.redimensionando = "";
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const mover = (e: ReactPointerEvent<HTMLDivElement>) => {
    const a = arrasto.current;
    const el = painelRef.current;
    if (!a || !el) return;
    const t = limitar({
      w: a.eixo === "y" ? a.w0 : a.w0 + (a.x0 - e.clientX),
      h: a.eixo === "x" ? a.h0 : a.h0 + (a.y0 - e.clientY),
    });
    a.atual = t;
    el.style.setProperty("--painel-w", `${t.w}px`);
    el.style.setProperty("--painel-h", `${t.h}px`);
  };
  const soltar = () => {
    const a = arrasto.current;
    arrasto.current = null;
    const el = painelRef.current;
    if (!a || !el) return;
    delete el.dataset.redimensionando;
    onSoltar(a.atual);
  };
  // props explícitas nas alças (o lint de refs não enxerga o spread de
  // um factory e acusa leitura de ref no render — nos handlers o .current
  // só é lido no gesto) — duplo clique volta ao tamanho padrão, saída
  // rápida de um arrasto ruim
  const propsArrasto = {
    onPointerMove: mover,
    onPointerUp: soltar,
    onPointerCancel: soltar,
    onDoubleClick: () => onSoltar(TAM_PADRAO),
  };
  return (
    <>
      <div
        aria-hidden
        onPointerDown={(e) => iniciar("x", e)}
        {...propsArrasto}
        className="absolute inset-y-4 left-0 z-10 w-1.5 cursor-ew-resize"
      />
      <div
        aria-hidden
        onPointerDown={(e) => iniciar("y", e)}
        {...propsArrasto}
        className="absolute inset-x-4 top-0 z-10 h-1.5 cursor-ns-resize"
      />
      {/* canto: a única alça visível (affordance), as bordas são invisíveis */}
      <div
        aria-hidden
        onPointerDown={(e) => iniciar("xy", e)}
        {...propsArrasto}
        title={`Arraste pra redimensionar (${tamanho.w} × ${tamanho.h})`}
        className="group/alca absolute left-0 top-0 z-20 grid size-5 cursor-nwse-resize place-items-center"
      >
        <svg
          viewBox="0 0 10 10"
          className="size-2.5 text-muted-foreground/40 transition-colors group-hover/alca:text-muted-foreground"
        >
          <path
            d="M1 7 L7 1 M1 10 L10 1"
            stroke="currentColor"
            strokeWidth="1.2"
            strokeLinecap="round"
            fill="none"
            transform="translate(0 -0.5)"
          />
        </svg>
      </div>
    </>
  );
}

function subscribeDesktop(cb: () => void) {
  const mq = matchMedia("(min-width: 768px)");
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
}

function Cabecalho({
  onFechar,
  onNovaConversa,
  onHistorico,
  onConfig,
  expandido,
  onExpandir,
  estado,
}: {
  onFechar: () => void;
  onNovaConversa?: () => void;
  onHistorico?: () => void;
  onConfig?: () => void;
  /** só desktop — o painel mobile já é a sheet quase cheia */
  expandido?: boolean;
  onExpandir?: () => void;
  /** a Liza mora no header: saúda na abertura e acompanha a rodada */
  estado: LizaEstado;
}) {
  return (
    <div className="flex shrink-0 items-center gap-2.5 border-b border-border px-4 py-3">
      <span className="grid size-8 shrink-0 place-items-center">
        <LizaBlob tamanho={34} estado={estado} />
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
      {onConfig && (
        <Button
          variant="ghost"
          size="icon"
          aria-label="Ajustes do assistente"
          title="Ajustes do assistente"
          onClick={onConfig}
          className="shrink-0 text-muted-foreground"
        >
          <Gear aria-hidden />
        </Button>
      )}
      {onExpandir && (
        <Button
          variant="ghost"
          size="icon"
          aria-label={expandido ? "Reduzir painel" : "Expandir painel"}
          aria-pressed={expandido}
          title={expandido ? "Reduzir painel" : "Expandir painel"}
          onClick={onExpandir}
          className="shrink-0 text-muted-foreground"
        >
          {expandido ? <ArrowsIn aria-hidden /> : <ArrowsOut aria-hidden />}
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

// memória dos balões de fala (lib/liza-falas.ts): aparelho no localStorage,
// "já falou nesta aba" no sessionStorage. Storage indisponível (modo
// privado) → a Liza se apresenta e pronto; nunca quebra o FAB
const FALAS_LS = "liza:falas";
const FALAS_SS = "liza:falou";
// a fala espera a página assentar antes de aparecer (não disputa a
// atenção com o carregamento nem com o onboarding que abre por cima)
const FALA_ATRASO_MS = 1800;
// a boca tagarela só enquanto o balão "sai" — depois ela fica atenta
const FALA_BOCA_MS = 1400;

type MemoriaAparelho = Omit<MemoriaFalas, "falouNaSessao">;

function lerMemoria(): MemoriaFalas {
  const vazia = { apresentacoes: 0, abriu: false, dicasDispensadas: 0 };
  try {
    const m = { ...vazia, ...JSON.parse(localStorage.getItem(FALAS_LS) ?? "{}") };
    return { ...m, falouNaSessao: sessionStorage.getItem(FALAS_SS) === "1" };
  } catch {
    return { ...vazia, falouNaSessao: false };
  }
}

function gravarMemoria(muda: (m: MemoriaAparelho) => MemoriaAparelho) {
  try {
    const { apresentacoes, abriu, dicasDispensadas } = lerMemoria();
    localStorage.setItem(
      FALAS_LS,
      JSON.stringify(muda({ apresentacoes, abriu, dicasDispensadas }))
    );
  } catch {}
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
  // aberto "agora", fora do ciclo de render: o chip do balão abre e envia
  // no mesmo gesto, e a resposta (rápida na demo) pode fechar antes do
  // re-render — o callback leria o `aberto` velho e acenderia o aviso
  const abertoRef = useRef(false);
  const [pronto, setPronto] = useState(false);

  // mascote Liza: a conversa reporta a rodada (onEstado) e o fim de
  // resposta (onRespostaPronta) — com o painel fechado isso vira o pulo
  // de "pronto" + o ponto de aviso no FAB; hover/foco no FAB acende
  // "atento" e o cochilo vira "sonolento" depois de SONO_MS quieta
  const [estadoLiza, setEstadoLiza] = useState<LizaEstado>("parado");
  const [respostaPronta, setRespostaPronta] = useState(false);
  const [aviso, setAviso] = useState(false);
  const [atento, setAtento] = useState(false);
  const [sonolento, setSonolento] = useState(false);

  // balão de fala com o painel fechado (apresentação, dica da página,
  // "respondi") — `falandoBoca` é o instante em que o balão sai e a boca
  // mexe; `pausada` segura o relógio enquanto o ponteiro/foco está nele
  const pagina = usePathname();
  const [fala, setFala] = useState<FalaLiza | null>(null);
  const [falandoBoca, setFalandoBoca] = useState(false);
  const [pausada, setPausada] = useState(false);

  // a Liza só dorme quieta: painel fechado, sem rodada, sem aviso e sem o
  // dedo/foco em cima. Mudou qualquer condição → acorda; a flag limpa na
  // própria render (padrão "estado derivado da anterior") sem setState
  // em effect
  const ociosa =
    !aberto && !atento && !respostaPronta && !fala && estadoLiza === "parado";
  const [eraOciosa, setEraOciosa] = useState(ociosa);
  if (eraOciosa !== ociosa) {
    setEraOciosa(ociosa);
    if (sonolento) setSonolento(false);
  }

  // a vigia do cochilo: intervalo barato por aba, só enquanto ociosa —
  // pointermove renova o relógio sem render (só flag local), acordar de
  // verdade custa um setState
  useEffect(() => {
    if (!ociosa) return;
    let ultimo = Date.now();
    let dormindo = false;
    const acordar = () => {
      ultimo = Date.now();
      if (dormindo) {
        dormindo = false;
        setSonolento(false);
      }
    };
    const id = setInterval(() => {
      if (dormindo || document.hidden) return;
      if (Date.now() - ultimo > SONO_MS) {
        dormindo = true;
        setSonolento(true);
      }
    }, 4000);
    window.addEventListener("pointermove", acordar, { passive: true });
    window.addEventListener("pointerdown", acordar, { passive: true });
    window.addEventListener("keydown", acordar);
    return () => {
      clearInterval(id);
      window.removeEventListener("pointermove", acordar);
      window.removeEventListener("pointerdown", acordar);
      window.removeEventListener("keydown", acordar);
    };
  }, [ociosa]);

  // tamanho do painel desktop — preferência do aparelho (localStorage)
  const [tamanho, setTamanho] = useState(TAM_PADRAO);
  const painelRef = useRef<HTMLDivElement | null>(null);
  const gravarTamanho = useCallback((t: { w: number; h: number }) => {
    // o arrasto já escreveu as mesmas vars inline que o estado vai
    // renderizar — o React não precisa reescrever e nada pisca
    const v = limitar(t);
    setTamanho(v);
    try {
      localStorage.setItem(STORAGE_TAM, JSON.stringify(v));
    } catch {}
  }, []);
  const alternarExpandido = () =>
    gravarTamanho(ehExpandido(tamanho) ? TAM_PADRAO : TAM_EXPANDIDO);

  // restaura a sessão após hidratar — fora do render pra não divergir do
  // SSR; o rAF tira o setState do corpo do effect (regra react-hooks)
  useEffect(() => {
    const id = requestAnimationFrame(() => {
      try {
        if (sessionStorage.getItem("assistente:aberto") === "1") {
          abertoRef.current = true;
          setAberto(true);
        }
        const t = JSON.parse(localStorage.getItem(STORAGE_TAM) ?? "null");
        if (t && typeof t.w === "number" && typeof t.h === "number")
          setTamanho(limitar(t));
      } catch {
        // storage indisponível (modo privado): painel simplesmente abre fechado
      }
      setPronto(true);
    });
    return () => cancelAnimationFrame(id);
  }, []);

  // offset do teclado iOS — declarado antes de mudar (que o zera ao fechar)
  const [kb, setKb] = useState(0);
  const mudar = useCallback((v: boolean) => {
    abertoRef.current = v;
    setAberto(v);
    // abrir consome os avisos — a resposta já está visível no painel
    if (v) {
      setRespostaPronta(false);
      setAviso(false);
      // abriu uma vez: ela já se apresentou de verdade
      setFala(null);
      gravarMemoria((m) => ({ ...m, abriu: true }));
    }
    // fecha com offset zerado — sem isso uma reabertura herda o último kb
    // por um frame (flash de bottom: N antes da primeira medição)
    if (!v) setKb(0);
    try {
      sessionStorage.setItem("assistente:aberto", v ? "1" : "0");
    } catch {}
  }, []);

  // o pulo de "pronto" é um evento — volta sozinho pro estado da rodada
  useEffect(() => {
    if (!respostaPronta) return;
    const t = setTimeout(() => setRespostaPronta(false), 2400);
    return () => clearTimeout(t);
  }, [respostaPronta]);

  // decide a fala da página depois que ela assenta. Uma por aba: a
  // apresentação (até abrir a Liza uma vez) ou uma dica de página; troca
  // de rota re-avalia enquanto a aba ainda não falou
  useEffect(() => {
    if (!pronto || aberto) return;
    const t = setTimeout(() => {
      const memoria = lerMemoria();
      const nova = proximaFala({
        memoria,
        pagina,
        papeis,
        nome,
        perguntaPadrao: sugestoes(papeis, pagina)[0],
      });
      if (!nova) return;
      try {
        sessionStorage.setItem(FALAS_SS, "1");
      } catch {}
      if (nova.tipo === "apresentacao")
        gravarMemoria((m) => ({ ...m, apresentacoes: m.apresentacoes + 1 }));
      setFala((atual) => atual ?? nova);
      setFalandoBoca(true);
    }, FALA_ATRASO_MS);
    return () => clearTimeout(t);
  }, [pronto, aberto, pagina, papeis, nome]);

  // a boca mexe só na saída do balão (liga junto com a fala, em
  // mostrarFala; aqui só o relógio que desliga)
  useEffect(() => {
    if (!falandoBoca) return;
    const t = setTimeout(() => setFalandoBoca(false), FALA_BOCA_MS);
    return () => clearTimeout(t);
  }, [falandoBoca]);

  // some sozinho (menos o "Respondi"); ponteiro/foco em cima segura
  useEffect(() => {
    const ms = fala ? DURACAO_FALA[fala.tipo] : null;
    if (!ms || pausada) return;
    const t = setTimeout(() => setFala(null), ms);
    return () => clearTimeout(t);
  }, [fala, pausada]);

  const dispensarFala = () => {
    if (fala?.tipo === "apresentacao")
      gravarMemoria((m) => ({ ...m, apresentacoes: APRESENTACOES_MAX }));
    if (fala?.tipo === "dica")
      gravarMemoria((m) => ({ ...m, dicasDispensadas: m.dicasDispensadas + 1 }));
    setFala(null);
    setPausada(false);
  };

  // voltar do sistema (gesto/botão Android) fecha a sheet: empurra um
  // state na abertura e escuta popstate. Fechando por X/backdrop/arrasto,
  // o cleanup desfaz o state empurrado (history.back sem listener é
  // silencioso). Só no mobile — desktop fecha por Esc/outside do Popover.
  useEffect(() => {
    if (desktop || !aberto) return;
    history.pushState({ assistenteSheet: true }, "");
    const aoVoltar = () => mudar(false);
    window.addEventListener("popstate", aoVoltar);
    return () => {
      window.removeEventListener("popstate", aoVoltar);
      if (history.state?.assistenteSheet) history.back();
    };
  }, [desktop, aberto, mudar]);

  // "Nova conversa" e "Histórico" moram na conversa (dona do estado) — as
  // ações são registradas aqui pros botões do header alcançarem
  const novaConversaRef = useRef<(() => void) | null>(null);
  const historicoRef = useRef<(() => void) | null>(null);
  const enviarRef = useRef<((pergunta: string) => void) | null>(null);
  const conversa = (
    <AssistenteConversa
      papeis={papeis}
      demo={demo}
      configurado={configurado}
      // autoFocus só no desktop — no mobile focar na abertura abre o
      // teclado durante a animação da sheet (flicker + metade da tela
      // tomada); lá o foco vem do toque do usuário e o gate de viewport
      // do focarComposer segura o teclado. Com keepMounted o mount é no
      // load, então a conversa reage quando `aberto` liga — `aberto` real
      // nos dois braços: no mobile a mascote também ganha o sorriso de
      // boas-vindas do estado "aberto"
      autoFocus={desktop}
      aberto={aberto}
      nome={nome}
      registrarNova={(fn) => {
        novaConversaRef.current = fn;
      }}
      registrarHistorico={(fn) => {
        historicoRef.current = fn;
      }}
      registrarEnviar={(fn) => {
        enviarRef.current = fn;
      }}
      onNavegarInterno={() => mudar(false)}
      onEstado={setEstadoLiza}
      onRespostaPronta={() => {
        // só avisa no FAB quando o painel está fora de vista — aberto,
        // a resposta já se anuncia sozinha (e a mascote da mensagem
        // comemora lá dentro)
        if (!abertoRef.current) {
          setRespostaPronta(true);
          setAviso(true);
          // o balão "Respondi" toma o lugar de qualquer outra fala (é o
          // único que espera a abertura)
          setFala(FALA_PRONTO);
          setFalandoBoca(true);
        }
      }}
      Avatar={AvatarLiza}
    />
  );
  const novaConversa = () => novaConversaRef.current?.();
  // chip do balão: abre e pergunta (a conversa fica montada fechada —
  // keepMounted — então o envio já tem pra onde ir)
  const perguntarDoBalao = (pergunta: string) => {
    mudar(true);
    enviarRef.current?.(pergunta);
  };
  const alternarHistorico = () => historicoRef.current?.();

  // aba de ajustes (REALIZA-328): view-stack aqui na bolha — a conversa
  // continua montada por baixo (estado do chat e do stream preservados:
  // um swap de elemento desmontava e órfanava a resposta — REALIZA-332),
  // o painel de config cobre. contents deixa a bolha filha direta do flex;
  // hidden esconde sem desmontar. Só coordenação fora da demo (a RLS fecha
  // a escrita de qualquer jeito — o botão é só cortesia de não mostrar o
  // que nega)
  const [viewConfig, setViewConfig] = useState(false);
  const onConfig = papeis.includes("coordenacao") && !demo
    ? () => setViewConfig(true)
    : undefined;
  const corpo = (
    <>
      <div className={viewConfig ? "hidden" : "contents"}>{conversa}</div>
      {viewConfig && (
        <AssistenteConfig onVoltar={() => setViewConfig(false)} />
      )}
    </>
  );

  // arrastar p/ baixo fecha — a alça no topo da sheet rastreia o dedo 1:1
  // via transform (compositor, 60fps); >88px confirma, senão snap de volta.
  // Só toque/stylus: mouse usa X/Esc/backdrop como sempre. Os refs ficam
  // antes do effect do teclado (o lint proíbe mutar ref lido em effect).
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

  // teclado do celular (iOS Safari): a viewport visual encolhe mas a layout
  // não — visualViewport mede a diferença e a sheet sobe junto. Android já
  // cobre via interactive-widget=resizes-content no meta (kb≈0 lá).
  useEffect(() => {
    if (desktop || !aberto) return;
    const vv = window.visualViewport;
    if (!vv) return;
    let raf = 0;
    const medir = () => {
      // o iOS reporta valores intermediários durante a animação do
      // teclado — coalescer pra um setState por frame evita rajada de
      // re-layout na sheet
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const diff = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
        // teclado de verdade só quando o composer está focado e a diferença
        // passa de 100px — movimentos de URL bar / scroll-lock (~60px) são
        // ruído que pulava a sheet no fim da animação
        const focoDentro = !!popupRef.current?.contains(document.activeElement);
        setKb(diff > 100 && focoDentro ? Math.round(diff) : 0);
      });
    };
    medir();
    vv.addEventListener("resize", medir);
    vv.addEventListener("scroll", medir);
    return () => {
      cancelAnimationFrame(raf);
      vv.removeEventListener("resize", medir);
      vv.removeEventListener("scroll", medir);
    };
  }, [desktop, aberto]);

  // o FAB é a Liza em si. Com o painel aberto ela atende — alerta e de
  // olho no cursor (e a rodada sobe pro rosto do FAB também:
  // consultando/escrevendo/erro); fechada, o pulo de "pronto" com o
  // ponto de aviso, o hover/foco de "atento" e o cochilo do "sonolento"
  // se revezam. Aberto, o FAB troca a mascote por um X de fechar
  const estadoFab: LizaEstado = aberto
    ? estadoLiza === "parado"
      ? "atento"
      : estadoLiza
    : respostaPronta
      ? "pronto"
      : fala && falandoBoca
        ? "falando"
        : atento
        ? "atento"
        : sonolento
          ? "sonolento"
          : estadoLiza;
  // painel aberto: a Liza do FAB vira um X — fecha a bolha no mesmo lugar
  // onde ela abriu e evita três mascotes simultâneas na tela (o X do
  // cabeçalho continua pra quem já está com a mão dentro do painel). O
  // press amassa só o conteúdo — a bolha de fundo segue o scale-95 do FAB
  const icons = (
    <span className="pointer-events-none grid place-items-center transition-transform duration-150 group-active/fab:scale-x-110 group-active/fab:scale-y-[.8] [transform-origin:50%_100%]">
      {aberto ? (
        <X
          size={24}
          weight="bold"
          className="animate-in zoom-in-50 spin-in-45 duration-200"
        />
      ) : (
        // mobile enche o botão (a bolha é da mesma lima do FAB — só a
        // cara cresce); desktop fica com o respiro de 44 dentro de 56
        <LizaBlob
          tamanho={desktop ? 44 : 48}
          estado={falando(estadoFab)}
          className="animate-in zoom-in-50 spin-in-[-45deg] duration-200"
        />
      )}
    </span>
  );

  // a Liza do header saúda na abertura (o momento "aberto" do mascote) e
  // depois acompanha a rodada — a mesma persona do FAB, agora no painel
  const recemAberto = useMomento(aberto ? "aberto" : "parado");
  const estadoCab: LizaEstado = recemAberto ? "aberto" : estadoLiza;

  // ponto de resposta pronta no canto do FAB: halo ping-once na chegada,
  // depois o sólido espera a abertura (amarelo da marca = próximo passo)
  const pontoAviso = aviso && (
    <span
      aria-hidden
      className="pointer-events-none absolute -right-0.5 -top-0.5"
    >
      <span className="absolute inset-0 block size-3 animate-[ping-once_0.6s_ease-out_120ms_both] rounded-full bg-[var(--destaque)]" />
      <span className="block size-3 animate-in zoom-in-50 rounded-full bg-[var(--destaque)] shadow-[0_0_0_2px_var(--background)] duration-150" />
    </span>
  );
  // balão de fala e rótulo do hover moram no container fixo do FAB
  const balao = !aberto && fala ? (
    <LizaFala
      key={fala.tipo}
      fala={fala}
      onPergunta={perguntarDoBalao}
      onAbrir={() => mudar(true)}
      onDispensar={dispensarFala}
      onPausar={setPausada}
    />
  ) : null;
  const rotuloHover = desktop && atento && !aberto && !fala ? <LizaRotulo /> : null;
  const rotuloFab = aberto
    ? "Fechar assistente"
    : aviso
      ? "Abrir assistente, a Liza respondeu"
      : "Abrir assistente";

  if (desktop) {
    return (
      <Popover open={aberto} onOpenChange={mudar}>
        <div className={cn(FAB_POS, pronto && "animate-in fade-in-0 zoom-in-75 duration-300")}>
          <PopoverTrigger
            aria-label={rotuloFab}
            aria-expanded={aberto}
            aria-controls="painel-assistente"
            onPointerEnter={() => setAtento(true)}
            onPointerLeave={() => setAtento(false)}
            // foco de teclado merece a mesma atenção do hover
            onFocus={() => setAtento(true)}
            onBlur={() => setAtento(false)}
            className={FAB_CLS}
          >
            {icons}
          </PopoverTrigger>
          {pontoAviso}
          {balao}
          {rotuloHover}
        </div>
        <PopoverContent
          id="painel-assistente"
          side="top"
          align="end"
          sideOffset={12}
          // keepMounted: fechar esconde mas não desmonta — o stream segue
          // rodando e a resposta não se perde (REALIZA-332). O Base UI
          // aplica inert no fechado (sem foco/interação/árvore a11y)
          keepMounted
          ref={painelRef}
          className={PAINEL_CLS}
          style={
            {
              "--painel-w": `${tamanho.w}px`,
              "--painel-h": `${tamanho.h}px`,
            } as React.CSSProperties
          }
        >
          <AlcasRedimensionar
            painelRef={painelRef}
            tamanho={tamanho}
            onSoltar={gravarTamanho}
          />
          <Cabecalho
            onFechar={() => mudar(false)}
            onNovaConversa={novaConversa}
            onHistorico={alternarHistorico}
            onConfig={onConfig}
            expandido={ehExpandido(tamanho)}
            onExpandir={alternarExpandido}
            estado={falando(estadoCab)}
          />
          <PopoverTitle className="sr-only">Assistente</PopoverTitle>
          {corpo}
        </PopoverContent>
      </Popover>
    );
  }

  return (
    <>
      <div className={cn(FAB_POS, pronto && "animate-in fade-in-0 zoom-in-75 duration-300")}>
        <Button
          aria-label={rotuloFab}
          aria-expanded={aberto}
          aria-controls="painel-assistente"
          onPointerEnter={() => setAtento(true)}
          onPointerLeave={() => setAtento(false)}
          onFocus={() => setAtento(true)}
          onBlur={() => setAtento(false)}
          onClick={() => mudar(true)}
          className={FAB_CLS}
        >
          {icons}
        </Button>
        {pontoAviso}
        {balao}
      </div>
      <Sheet open={aberto} onOpenChange={mudar}>
        <SheetContent
          ref={popupRef}
          id="painel-assistente"
          side="bottom"
          showCloseButton={false}
          // idem PopoverContent acima — fechar não órfana o stream
          keepMounted
          style={{
            // teclado iOS: a sheet sobe inteira acima dele e encolhe pra
            // não estourar o topo — bottom (offset) não briga com o
            // transform do arrasto
            bottom: kb || undefined,
            maxHeight: kb ? `calc(100svh - ${kb}px)` : undefined,
          }}
          // svh (não dvh): altura estável — dvh re-resolve quando a URL bar
          // do iOS se move com o scroll-lock do dialog, e a sheet pulava
          // no fim da animação de abrir/fechar
          className="h-[min(88svh,760px)] gap-0 overflow-hidden bg-popover text-popover-foreground duration-300"
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
            onConfig={onConfig}
            estado={falando(estadoCab)}
          />
          {corpo}
        </SheetContent>
      </Sheet>
    </>
  );
}
