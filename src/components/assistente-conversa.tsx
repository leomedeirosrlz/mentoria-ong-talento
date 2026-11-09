"use client";

// Corpo do assistente (transcript + composer) — embutido no painel da
// AssistenteBolha (Popover no desktop, Sheet bottom no mobile).
// REALIZA-244: lê o SSE de /api/ia/chat com getReader+TextDecoder —
// tokens chegam por rAF-batched setState (um render por frame, não por
// delta), status das tool rounds vira linha "consultando dados…", stop
// aborta o fetch no meio e retry reenvia a última pergunta. Transcript
// só na ABA: sessionStorage mantém a conversa entre abrir/fechar do
// painel, mas morre com a aba (LGPD — nada vai pro servidor; o que fica
// é a ação em ia_eventos).

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import {
  ArrowClockwise,
  ArrowDown,
  ArrowRight,
  BookOpen,
  Check,
  Copy,
  MagnifyingGlass,
  PaperPlaneRight,
  Square,
  ThumbsDown,
  ThumbsUp,
  Trash,
} from "@phosphor-icons/react";
import { toast } from "sonner";
import { extrairAcoes, montarEnvioChat, msgAmigavel } from "@/lib/ia/mensagens";
import { deveMostrarFeedback, temLinkMarkdown } from "@/lib/ia/feedback";
import { metaFonte, rotuloTool, type FonteIa } from "@/lib/ia/fontes";
import { extrairFontesTexto } from "@/lib/ia/render";
import { juntarUi, type UiBloco } from "@/lib/ia/ui";
import { responderDemoIa } from "@/lib/demo/ia";
import {
  analisarResposta,
  ehRica,
  RespostaMd,
} from "@/components/assistente-md";
import { Sugestoes } from "@/components/assistente-blocos";
import { UiCard } from "@/components/assistente-cards";
import { T } from "@/components/motion";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { AppRole } from "@/lib/types";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { novoUuid } from "@/lib/uuid";

type Msg = {
  role: "user" | "assistant";
  content: string;
  estado?: "stream" | "erro";
  tools?: string[];
  em?: number;
  acoes?: { rotulo: string; href: string }[];
  fontes?: FonteIa[];
  /** cards da genUI direta (evento `ui` da rota) — acima do texto */
  ui?: UiBloco[];
  /** ms entre o envio e a resposta pronta — "Consultou … em 3 s" */
  dur?: number;
  /** x-ia-request-id of the response — ties the thumbs vote to the
   *  round logged in ia_eventos; absent on demo/error/interrupted */
  reqId?: string;
};

/** Estado que a bolha traduz em expressão do mascote. */
export type EstadoConversa = "parado" | "consultando" | "escrevendo" | "erro";

const primeiroNome = (nome?: string) => nome?.trim().split(/\s+/)[0];

// focar o composer só em viewport de desktop — no mobile focar sobe o
// teclado sem o usuário pedir (o toque no campo já faz isso)
const focarComposer = (el: HTMLTextAreaElement | null) => {
  if (el && matchMedia("(min-width: 768px)").matches) el.focus();
};

const hhmm = (em?: number) =>
  em ? new Date(em).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : "";

// fora do componente: Date.now é impuro pro linter do compiler — a hora
// só é lida em handler de evento, nunca durante render
const agora = () => Date.now();

// o dreno só existe pra animar — reduced-motion dispensa e em aba oculta
// o rAF não roda; nos dois casos a fila despeja direto em vez de travar
// a bolha esperando um frame que não vem
const semAnimacao = () =>
  matchMedia("(prefers-reduced-motion: reduce)").matches ||
  document.visibilityState === "hidden";

// conversas ficam no aparelho (localStorage, client-side — LGPD igual ao
// sessionStorage anterior, mas sobrevivem ao fechamento). A mais recente
// reabre como conversa ativa; a lista completa vira a visão "histórico".
const STORAGE_MSGS = "assistente:msgs"; // legado — migrado pro histórico
const STORAGE_CONVERSAS = "assistente:conversas";
const MAX_CONVERSAS = 12;
const MAX_MSGS = 20;

type Conversa = { id: string; titulo: string; em: number; msgs: Msg[] };

function lerConversas(): Conversa[] {
  try {
    const raw = localStorage.getItem(STORAGE_CONVERSAS);
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    // TTL 30d (sdd D3): conversa com nomes/notas de menores não vive pra
    // sempre no aparelho — minimização LGPD alinhada à decisão do storage
    const piso = Date.now() - 30 * 24 * 60 * 60 * 1000;
    return Array.isArray(parsed)
      ? (parsed.filter(
          (c): c is Conversa =>
            !!c &&
            typeof c === "object" &&
            "id" in c &&
            Array.isArray((c as Conversa).msgs) &&
            typeof (c as Conversa).em === "number" &&
            (c as Conversa).em > piso
        ) as Conversa[])
      : [];
  } catch {
    return [];
  }
}

function gravarConversas(lista: Conversa[]) {
  try {
    if (lista.length) localStorage.setItem(STORAGE_CONVERSAS, JSON.stringify(lista));
    else localStorage.removeItem(STORAGE_CONVERSAS);
  } catch {
    // storage indisponível (modo privado): histórico só na memória
  }
}

// título = primeira pergunta do usuário, uma linha, truncada — mesmo
// padrão do ChatGPT; msgs sem pergunta (só resposta demo?) ficam genéricas
const tituloDa = (ms: Msg[]) => {
  const primeira = ms.find((m) => m.role === "user")?.content ?? "Conversa";
  const linha = primeira.replace(/\s+/g, " ").trim();
  return linha.length > 52 ? `${linha.slice(0, 52).trimEnd()}…` : linha;
};

const normalizar = (t: string) =>
  t.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

/** Hoje / Ontem / Últimos 7 dias / Antes — a lista já vem do mais recente
 *  pro mais antigo, então cada grupo herda a ordem. Hoje e ontem mostram
 *  a hora; os mais antigos, a data. */
function agruparConversas(lista: Conversa[]) {
  const d0 = new Date();
  d0.setHours(0, 0, 0, 0);
  const hoje = d0.getTime();
  const dia = 86_400_000;
  const faixas = [
    { rotulo: "Hoje", hora: true, desde: hoje },
    { rotulo: "Ontem", hora: true, desde: hoje - dia },
    { rotulo: "Últimos 7 dias", hora: false, desde: hoje - 7 * dia },
    { rotulo: "Antes", hora: false, desde: -Infinity },
  ];
  return faixas
    .map((f, i) => ({
      ...f,
      itens: lista.filter(
        (c) => c.em >= f.desde && (i === 0 || c.em < faixas[i - 1].desde)
      ),
    }))
    .filter((g) => g.itens.length);
}

const DEMO_FALLBACK =
  "Na demonstração a Liza tem respostas de exemplo. No ambiente real ela responde com os seus dados e os guias oficiais.";

const FALHA =
  "Não consegui responder agora. Tente de novo em instantes.";

// o dataset demo é evergreen — as respostas enlatadas falam dele sem
// precisar de números fixos (sdd §8: honesto, sem fingir LLM)
const DEMO_RESPOSTAS: [RegExp, string][] = [
  [
    /resumo|semana/i,
    "Na demonstração o resumo sai de exemplo: há duplas em dia, uma pedindo apoio e outra com encontro atrasado. No ambiente real esta resposta vem dos seus dados.",
  ],
  [
    /aguardando|par|fila/i,
    "Na demonstração a fila mostra um jovem esperando par e uma mentora com vaga livre. No ambiente real é a fila de verdade.",
  ],
  [
    /capacidade|mentores/i,
    "Na demonstração cada mentor ativo tem 1 ou 2 vagas conforme a trilha. No ambiente real a ocupação sai do cadastro.",
  ],
  [
    /dupla|encontro|registro|agenda/i,
    "Na demonstração a sua dupla de exemplo tem encontros marcados e registros em dia. No ambiente real o assistente consulta a sua dupla.",
  ],
];

function respostaDemo(texto: string): string {
  return DEMO_RESPOSTAS.find(([re]) => re.test(texto))?.[1] ?? DEMO_FALLBACK;
}

/** Sugestões por papel e pela página aberta — caminhos que as tools
 *  respondem de fato (dados via registry; guias via guia_consulta). A
 *  página entra primeiro: na ficha da dupla a pergunta mais provável é
 *  sobre ela (o prompt recebe a rota e resolve "esta dupla"). */
export function sugestoes(papeis: AppRole[], pagina: string): string[] {
  const staff = papeis.some((p) => p === "coordenacao" || p === "supervisor");
  const soJovem = papeis.length > 0 && papeis.every((p) => p === "mentorado");
  if (soJovem) {
    if (pagina.startsWith("/jovem/agenda"))
      return ["Quando é o próximo encontro?", "Tive encontro essa semana?", "O que é o PDM?"];
    if (pagina.startsWith("/jovem/especialistas"))
      return ["E meu pedido de especialista?", "Como funciona o especialista?", "Como tá minha jornada?"];
    if (pagina.startsWith("/jovem/materiais"))
      return ["O que é o PDM?", "O que tenho pra fazer?", "Como tá minha jornada?"];
    return ["O que tenho pra fazer?", "Como tá minha jornada?", "Quem é meu mentor?"];
  }
  if (/^\/duplas\/[0-9a-f-]{36}/.test(pagina))
    // ficha de staff — híbrido (mentorado + papel de equipe) lê chips de
    // equipe; mentorado puro nunca alcança esta rota
    return ["Resuma esta dupla", "O que falta registrar?", "Escreva um lembrete pra dupla"];
  if (pagina.startsWith("/agenda") && !papeis.includes("mentorado"))
    return ["Encontros desta semana", "Alguém sem encontro marcado?", "Escreva um lembrete pra dupla"];
  if (pagina.startsWith("/duplas") && staff)
    return ["Quem está em risco?", "Quem pediu apoio?", "Resumo da semana"];
  if (pagina.startsWith("/materiais"))
    return ["O que diz o guia sobre a Roda da Vida?", "Como dar um feedback construtivo?", "O que é o PDM?"];
  if (papeis.includes("coordenacao"))
    return [
      "Resumo da semana",
      "Quem está aguardando par?",
      "O que diz o guia sobre a Roda da Vida?",
      "Encontros desta semana",
    ];
  if (papeis.includes("supervisor"))
    return [
      "Resumo da semana",
      "Alguma dupla minha pede atenção?",
      "Encontros desta semana",
    ];
  return [
    "Como está minha dupla?",
    "O que é o PDM?",
    "Próximos encontros",
  ];
}

// ---------- conversa ----------

export function AssistenteConversa({
  papeis,
  demo,
  configurado,
  autoFocus,
  aberto,
  nome,
  registrarNova,
  registrarHistorico,
  registrarEnviar,
  onNavegarInterno,
  onEstado,
  onRespostaPronta,
  Avatar,
}: {
  papeis: AppRole[];
  demo: boolean;
  configurado: boolean;
  /** a bolha já foca o textarea ao abrir — autoFocus cobre o caso direto */
  autoFocus?: boolean;
  /** painel visível — com keepMounted a conversa monta fechada, então o
   *  foco do composer vem da abertura, não do autoFocus (REALIZA-332) */
  aberto?: boolean;
  /** primeiro nome pro empty state ("Oi, X!") — sem ele, genérico */
  nome?: string;
  /** a bolha expõe "Nova conversa" no header — registra a ação aqui */
  registrarNova?: (fn: () => void) => void;
  /** idem pro botão de histórico — alterna transcript ↔ lista de conversas */
  registrarHistorico?: (fn: () => void) => void;
  /** idem pra enviar uma pergunta de fora: o chip do balão de fala da
   *  Liza (painel fechado) abre e já pergunta */
  registrarEnviar?: (fn: (pergunta: string) => void) => void;
  /** link interno clicado (ação/fonte/inline) — a bolha fecha pra navegar */
  onNavegarInterno?: () => void;
  /** a bolha anima o mascote pelo estado da rodada */
  onEstado?: (e: EstadoConversa) => void;
  /** resposta terminou bem — a bolha avisa no FAB se o painel está fechado */
  onRespostaPronta?: () => void;
  /** mascote no tamanho pedido — a bolha é dona do componente e do estado
   *  ("aberto" saúda no empty state; "pronto" comemora a resposta que
   *  acabou de fechar) */
  Avatar: (p: {
    tamanho: number;
    estado: EstadoConversa | "aberto" | "pronto";
  }) => React.ReactNode;
}) {
  const pagina = usePathname();
  const supabase = createClient();
  const [msgs, setMsgs] = useState<Msg[]>([]);
  // id da conversa ativa no histórico — criado no 1º envio, zerado em
  // "Nova conversa"; estado (não ref) porque a lista o lê durante render
  const [conversaId, setConversaId] = useState<string | null>(null);
  const [restaurada, setRestaurada] = useState(false);
  const [conversas, setConversas] = useState<Conversa[]>([]);
  const [visao, setVisao] = useState<"chat" | "historico">("chat");
  const [texto, setTexto] = useState("");
  const [pending, setPending] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [copiado, setCopiado] = useState<number | null>(null);
  // thumbs votes keyed by request_id — a Map, not a Set: the direction
  // fills the voted thumb, not just "already voted"
  const [votos, setVotos] = useState(() => new Map<string, 1 | -1>());
  // request_id whose "Valeu pelo retorno!" is still up (~2s, then just
  // the filled thumb remains)
  const [agradecimento, setAgradecimento] = useState<string | null>(null);
  // espelho renderizável do pertoDoFim ref — a pill "ir ao fim" precisa de
  // estado porque evento de scroll não dispara render por si só
  const [longeDoFim, setLongeDoFim] = useState(false);
  const logRef = useRef<HTMLDivElement>(null);
  const pertoDoFim = useRef(true);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  // espelhos pro cleanup de desmonte — setState não roda em cleanup e o
  // effect de persistência não dispara de novo, então a escrita do
  // parcial é manual via refs (REALIZA-332)
  const msgsRef = useRef<Msg[]>(msgs);
  const conversaIdRef = useRef(conversaId);
  useEffect(() => {
    msgsRef.current = msgs;
    conversaIdRef.current = conversaId;
  }, [msgs, conversaId]);
  // tokens acumulam num ref e descem pro estado uma vez por frame —
  // SSE manda deltas pequenos demais pra re-render por delta
  const tokensRef = useRef("");
  const flushRef = useRef(0);
  // marca do último crescimento da fila — o dreno tem ~700ms a partir
  // dele pra esvaziar, então nem backlog nem o fim da resposta despejam
  // de uma vez
  const filaDesdeRef = useRef(0);
  // fechamento adiado: done/erro chegou com a fila ainda escorrendo —
  // o dreno termina (curto) e o fechar roda no fim dele
  const fecharRef = useRef<{
    estado: "ok" | "erro" | "interrompido";
    extra?: {
      tools?: string[];
      erro?: string;
      fontes?: FonteIa[];
      reqId?: string;
    };
  } | null>(null);
  const chips = sugestoes(papeis, pagina);
  const [busca, setBusca] = useState("");
  // topo anterior do log — o detach por direção compara gesto, não
  // distância (programático só empurra pra baixo, usuário sobe)
  const ultimoTopRef = useRef(0);
  // links dos cards apontam pras telas do jovem quando ele é só mentorado
  const soJovem = papeis.length > 0 && papeis.every((p) => p === "mentorado");
  // início da rodada (handler de evento) — vira o "em N s" da meta
  const inicioRef = useRef(0);

  // estado da rodada pra fora (mascote): status de tool = consultando,
  // token chegando = escrevendo, bolha de erro = erro
  const ultimaMsg = msgs[msgs.length - 1];
  const estado: EstadoConversa = pending
    ? status || !ultimaMsg?.content
      ? "consultando"
      : "escrevendo"
    : ultimaMsg?.estado === "erro"
      ? "erro"
      : "parado";
  useEffect(() => onEstado?.(estado), [estado, onEstado]);

  // a resposta que acabou de fechar comemora uma vez — o mascote ao lado
  // dela pula ("pronto"), depois volta pro repouso. Evento, não estado
  const [celebra, setCelebra] = useState(false);
  useEffect(() => {
    if (!celebra) return;
    const t = setTimeout(() => setCelebra(false), 1600);
    return () => clearTimeout(t);
  }, [celebra]);

  // REALIZA-332: um desmonte de verdade não deve órfanar o stream —
  // aborta o fetch (o req.signal do servidor para de gerar na hora) e
  // grava o parcial direto no storage: setMsgs aqui é no-op e o effect de
  // persistência não dispara de novo, então a escrita final é manual.
  // Cobre os desmontes que o keepMounted não cobre: troca de braço
  // Popover↔Sheet (768px) e saída do grupo (app).
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      if (flushRef.current) {
        cancelAnimationFrame(flushRef.current);
        flushRef.current = 0;
      }
      const atuais = msgsRef.current;
      const ultima = atuais[atuais.length - 1];
      if (!ultima || ultima.role !== "assistant" || ultima.estado !== "stream")
        return;
      const content = ultima.content + tokensRef.current;
      const finais = [
        ...atuais.slice(0, -1),
        {
          role: "assistant" as const,
          content: content || "Resposta interrompida.",
          ui: ultima.ui,
          em: agora(),
        },
      ]
        .filter((m) => m.content)
        .slice(-MAX_MSGS);
      const id = conversaIdRef.current;
      if (!id || !finais.length) return;
      const lista = lerConversas();
      gravarConversas(
        [
          {
            id,
            titulo:
              lista.find((c) => c.id === id)?.titulo ?? tituloDa(finais),
            em: finais[finais.length - 1].em ?? agora(),
            msgs: finais,
          },
          ...lista.filter((c) => c.id !== id),
        ].slice(0, MAX_CONVERSAS)
      );
    };
  }, []);

  const rolarFim = (forca = false) => {
    const el = logRef.current;
    if (el && (forca || pertoDoFim.current)) el.scrollTop = el.scrollHeight;
  };
  useEffect(() => rolarFim(), [msgs, pending, status]);

  // foco na abertura — com keepMounted a conversa monta fechada e o
  // autoFocus do textarea não dispara; o effect cobre false→true
  useEffect(() => {
    if (aberto) focarComposer(inputRef.current);
  }, [aberto]);

  // restaura o histórico do aparelho (o storage sobrevive ao painel e à
  // aba — continuidade entre sessões e entre desmontes de braço/config).
  // Migra o sessionStorage antigo como a conversa ativa. rAF: setState
  // fora do corpo do effect (regra react-hooks), mesmo padrão da bolha
  useEffect(() => {
    const id = requestAnimationFrame(() => {
      const lista = lerConversas();
      try {
        const salvo = sessionStorage.getItem(STORAGE_MSGS);
        sessionStorage.removeItem(STORAGE_MSGS);
        const antigas = salvo ? (JSON.parse(salvo) as Msg[]) : [];
        if (Array.isArray(antigas) && antigas.length) {
          const limpas = antigas.filter((m) => m.role && m.content).slice(-MAX_MSGS);
          const ativa: Conversa = {
            id: novoUuid(),
            titulo: tituloDa(limpas),
            em: limpas[limpas.length - 1]?.em ?? agora(),
            msgs: limpas,
          };
          const prox = [ativa, ...lista].slice(0, MAX_CONVERSAS);
          gravarConversas(prox);
          setMsgs(limpas);
          setConversaId(ativa.id);
          setRestaurada(true);
          return;
        }
      } catch {
        // storage indisponível ou legado corrompido: segue com o histórico
      }
      if (lista.length) {
        setMsgs(lista[0].msgs);
        setConversaId(lista[0].id);
      }
      setRestaurada(true);
    });
    return () => cancelAnimationFrame(id);
  }, []);

  // persiste a conversa ativa no histórico — sem bolha de stream
  // intermediária nem campo de UI que o payload strict rejeitaria
  // (montarEnvioChat já garante o segundo; o primeiro poluiria o estado
  // restaurado). Upsert por id, mais recente primeiro, cap de 12. Escreve
  // só no storage: a lista visível carrega ao abrir a visão histórico.
  useEffect(() => {
    if (!restaurada || !conversaId) return;
    const limpas = msgs
      .filter((m) => m.content && m.estado !== "stream")
      .slice(-MAX_MSGS);
    if (!limpas.length) return;
    const id = conversaId;
    const lista = lerConversas();
    gravarConversas(
      [
        {
          id,
          titulo:
            lista.find((c) => c.id === id)?.titulo ?? tituloDa(limpas),
          em: limpas[limpas.length - 1].em ?? agora(),
          msgs: limpas,
        },
        ...lista.filter((c) => c.id !== id),
      ].slice(0, MAX_CONVERSAS)
    );
  }, [msgs, restaurada, conversaId]);

  /** limpa a conversa ativa (a anterior já está gravada no histórico) —
   *  o header oferece "Nova conversa" */
  function novaConversa() {
    abortRef.current?.abort();
    setConversaId(null);
    setMsgs([]);
    setTexto("");
    setVisao("chat");
    focarComposer(inputRef.current);
  }
  useEffect(() => registrarNova?.(novaConversa), [registrarNova]);
  /** botão do header: transcript ↔ histórico — a lista recarrega do
   *  storage a cada abertura (a persistência mora no effect de msgs) */
  function alternarHistorico() {
    setConversas(lerConversas());
    setVisao((v) => (v === "chat" ? "historico" : "chat"));
  }
  useEffect(
    () => registrarHistorico?.(alternarHistorico),
    [registrarHistorico]
  );
  // enviar fecha sobre msgs/pending do render — a bolha chama a versão
  // mais nova pelo ref (registrada uma vez, lida só no clique)
  const enviarRef = useRef<(t: string) => void>(() => {});
  useEffect(() => {
    enviarRef.current = (t) => void enviar(t);
  });
  useEffect(
    () => registrarEnviar?.((t) => enviarRef.current(t)),
    [registrarEnviar]
  );

  /** troca pra uma conversa do histórico — aborta um stream em andamento
   *  (os tokens já gravados ficam na conversa de origem) */
  function abrirConversa(c: Conversa) {
    abortRef.current?.abort();
    if (flushRef.current) {
      cancelAnimationFrame(flushRef.current);
      flushRef.current = 0;
    }
    tokensRef.current = "";
    fecharRef.current = null;
    setConversaId(c.id);
    setMsgs(c.msgs);
    setPending(false);
    setStatus(null);
    setVisao("chat");
    pertoDoFim.current = true;
  }

  /** remove uma conversa do histórico — se for a ativa, limpa a tela */
  function apagarConversa(id: string) {
    setConversas((prev) => {
      const prox = prev.filter((c) => c.id !== id);
      gravarConversas(prox);
      return prox;
    });
    if (conversaId === id) {
      abortRef.current?.abort();
      if (flushRef.current) {
        cancelAnimationFrame(flushRef.current);
        flushRef.current = 0;
      }
      tokensRef.current = "";
      fecharRef.current = null;
      setConversaId(null);
      setMsgs([]);
      setPending(false);
      setStatus(null);
      setVisao("chat");
    }
  }

  function flushTokens() {
    flushRef.current = 0;
    const pend = tokensRef.current;
    if (!pend) return;
    // dreno com teto (pacote nov/2026): cada quadro tira o suficiente
    // pra esvaziar a fila em ~700ms desde o último crescimento dela —
    // backlog grande acelera (nunca fica pra trás) e o fim da resposta
    // escorre curto em vez de despejar de uma vez
    const restantes = Math.max(
      1,
      Math.ceil((700 - (agora() - filaDesdeRef.current)) / (1000 / 60))
    );
    let fatia = Math.max(2, Math.ceil(pend.length / restantes));
    // nunca corta no meio de um par surrogate — emoji/acento fora do BMP
    // piscaria como "�" por um quadro antes da metade chegar
    if (
      fatia < pend.length &&
      pend.charCodeAt(fatia - 1) >= 0xd800 &&
      pend.charCodeAt(fatia - 1) <= 0xdbff
    )
      fatia += 1;
    tokensRef.current = pend.slice(fatia);
    const sai = pend.slice(0, fatia);
    setMsgs((ms) =>
      ms.map((m, i) =>
        i === ms.length - 1 && m.estado === "stream"
          ? { ...m, content: m.content + sai }
          : m
      )
    );
    // ainda tem fila → agenda o próximo dreno; sem fila o cursor para
    if (tokensRef.current) {
      flushRef.current = requestAnimationFrame(flushTokens);
    } else if (fecharRef.current) {
      // a rodada já encerrou no servidor e a fila esvaziou no ritmo —
      // fecha a bolha agora, não num despejo
      const f = fecharRef.current;
      fecharRef.current = null;
      fechar(f.estado, f.extra);
    }
  }

  /** card da genUI direta chegou: entra já na bolha que está sendo
   *  escrita (antes do texto da rodada seguinte) */
  function receberUi(b: UiBloco) {
    setMsgs((ms) =>
      ms.map((m, i) =>
        i === ms.length - 1 && m.estado === "stream"
          ? { ...m, ui: juntarUi(m.ui ?? [], b) }
          : m
      )
    );
  }

  function enfileirarToken(t: string) {
    tokensRef.current += t;
    filaDesdeRef.current = agora();
    // token novo do servidor depois de um status de tool: a tool acabou —
    // o status sai aqui, na chegada. Antes o dreno apagava no quadro
    // seguinte e um status chegando com texto escorrendo ficava invisível
    setStatus(null);
    if (!flushRef.current)
      flushRef.current = requestAnimationFrame(flushTokens);
  }

  /** reset do stream: a rota refez a rodada em JSON (fallback pós-falha
   *  de stream) — a geração nova não tem prefixo comum, então a bolha
   *  zera e reimprime em vez de emendar textos diferentes */
  function resetarStream() {
    if (flushRef.current) {
      cancelAnimationFrame(flushRef.current);
      flushRef.current = 0;
    }
    tokensRef.current = "";
    fecharRef.current = null;
    setMsgs((ms) =>
      ms.map((m, i) =>
        i === ms.length - 1 && m.estado === "stream" ? { ...m, content: "" } : m
      )
    );
  }

  /** Fecha a rodada: com fila ainda escorrendo e a animação ligada, o
   *  dreno termina (curto — o teto de ~700ms já corre desde o último
   *  token) e o fechar roda no fim dele; com reduced-motion ou aba
   *  oculta não há dreno que valha a espera — despeja direto. */
  function finalizar(
    estado: "ok" | "erro" | "interrompido",
    extra?: {
      tools?: string[];
      erro?: string;
      fontes?: FonteIa[];
      reqId?: string;
    }
  ) {
    const pend = tokensRef.current;
    // "parar" é parar: interrompido nunca escorre o resto da fila
    if (pend && estado !== "interrompido" && !semAnimacao()) {
      fecharRef.current = { estado, extra };
      if (!flushRef.current)
        flushRef.current = requestAnimationFrame(flushTokens);
      return;
    }
    if (flushRef.current) {
      cancelAnimationFrame(flushRef.current);
      flushRef.current = 0;
    }
    tokensRef.current = "";
    fecharRef.current = null;
    fechar(estado, extra, pend);
  }

  /** O fechamento em si: `pend` é o que sobrou da fila no despejo direto
   *  (reduced-motion, aba oculta ou fila já vazia) — no caminho animado
   *  o dreno já imprimiu tudo e `pend` chega "". Marca o estado final da
   *  bolha: ok vira ausência de estado; erro ganha retry. */
  function fechar(
    estado: "ok" | "erro" | "interrompido",
    extra?: {
      tools?: string[];
      erro?: string;
      fontes?: FonteIa[];
      reqId?: string;
    },
    pend = ""
  ) {
    setMsgs((ms) => {
      const ultima = ms[ms.length - 1];
      if (!ultima || ultima.role !== "assistant") return ms;
      const content = ultima.content + pend;
      if (estado === "erro")
        return [
          ...ms.slice(0, -1),
          {
            role: "assistant",
            content: content || extra?.erro || FALHA,
            estado: "erro",
            ui: ultima.ui,
          },
        ];
      return [
        ...ms.slice(0, -1),
        {
          role: "assistant",
          content:
            content ||
            (estado === "interrompido" ? "Resposta interrompida." : FALHA),
          tools: extra?.tools?.length ? extra.tools : undefined,
          acoes: estado === "ok" ? extrairAcoes(content) : undefined,
          fontes: extra?.fontes?.length ? extra.fontes : undefined,
          reqId: extra?.reqId,
          ui: ultima.ui,
          em: agora(),
          dur: inicioRef.current ? agora() - inicioRef.current : undefined,
        },
      ];
    });
    setPending(false);
    setStatus(null);
    abortRef.current = null;
    if (estado === "ok") {
      onRespostaPronta?.();
      setCelebra(true);
    }
    focarComposer(inputRef.current);
  }

  function parar() {
    abortRef.current?.abort();
  }

  /** POST + leitura do SSE até done/erro/fechamento — único caminho de
   *  resposta real (envio normal e retry compartilham). Falha de rede ou
   *  provider fora tenta uma vez de novo sozinho (REALIZA-284). */
  async function rodar(base: Msg[], tentativas = 0) {
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    // body strict na rota: campos de UI (estado, tools) ou >20 mensagens
    // derrubam o parse com "Pedido inválido" — montarEnvioChat saneia
    const envio = montarEnvioChat(base);
    let statusHttp = 0;
    try {
      const res = await fetch("/api/ia/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // a rota aceita só o path (regex no Body) — rota de demo/teste
        // fora do padrão simplesmente não manda
        body: JSON.stringify({
          messages: envio,
          ...(/^\/[\w\-/]*$/.test(pagina) ? { pagina } : {}),
        }),
        signal: ctrl.signal,
      });
      statusHttp = res.status;
      // ties this response to the round logged in ia_eventos — becomes
      // the bubble's reqId at close (feedback gate + vote key)
      const reqId = res.headers.get("x-ia-request-id") ?? undefined;
      const tipo = res.headers.get("content-type") ?? "";
      // gates pré-stream respondem JSON (401/429/503) ou redirect (307→
      // página de login em HTML) — qualquer um deles vira erro legível
      if (!res.ok || !res.body || !tipo.includes("text/event-stream")) {
        const data = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        // redirect silencioso pro login = sessão caída, não falha do provider
        if (res.redirected && res.ok)
          throw new Error("Sua sessão expirou. Entre de novo pelo login.");
        throw new Error(data?.error ?? FALHA);
      }

      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = "";
      let tools: string[] | undefined;
      let fontes: FonteIa[] | undefined;
      let falha: string | null = null;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        let corte: number;
        while ((corte = buf.indexOf("\n\n")) !== -1) {
          const evento = buf.slice(0, corte);
          buf = buf.slice(corte + 2);
          for (const linha of evento.split("\n")) {
            if (!linha.startsWith("data:")) continue;
            let ev: { type?: string } | null = null;
            try {
              ev = JSON.parse(linha.slice(5));
            } catch {
              // comentário/linha não-JSON: ignora
            }
            if (!ev) continue;
            if (ev.type === "token") enfileirarToken((ev as { c: string }).c);
            else if (ev.type === "reset") resetarStream();
            else if (ev.type === "status") setStatus((ev as { t: string }).t);
            else if (ev.type === "ui") receberUi((ev as { b: UiBloco }).b);
            else if (ev.type === "done") {
              const d = ev as { tools?: string[]; fontes?: FonteIa[] };
              tools = d.tools;
              fontes = d.fontes;
            }
            else if (ev.type === "error") falha = (ev as { e: string }).e;
          }
        }
      }
      if (falha) finalizar("erro", { erro: falha });
      // stream fechou sem done (rede caiu no fim): finaliza com o que tem
      else finalizar("ok", { tools, fontes, reqId });
    } catch (e) {
      if (ctrl.signal.aborted) {
        finalizar("interrompido");
        return;
      }
      // rede ou provider fora: uma retentativa automática (a bolha de
      // espera mostra "Reconectando…") — validação/auth não repetem
      if (tentativas === 0 && (e instanceof TypeError || statusHttp === 503)) {
        setStatus("Reconectando…");
        await new Promise((r) => setTimeout(r, 1200));
        if (ctrl.signal.aborted) {
          finalizar("interrompido");
          return;
        }
        return rodar(base, tentativas + 1);
      }
      finalizar("erro", { erro: msgAmigavel(e, statusHttp, FALHA) });
    }
  }

  async function enviar(conteudo: string) {
    const limpo = conteudo.trim();
    if (!limpo || pending) return;
    if (!conversaId) setConversaId(novoUuid());
    setVisao("chat");
    const novas: Msg[] = [
      ...msgs,
      { role: "user", content: limpo, em: agora() },
    ];
    setMsgs([...novas, { role: "assistant", content: "", estado: "stream" }]);
    setTexto("");
    setPending(true);
    setStatus(null);
    inicioRef.current = agora();
    pertoDoFim.current = true;
    requestAnimationFrame(() => rolarFim(true));

    if (demo) await rodarDemo(limpo);
    else await rodar(novas);
  }

  /** Demo: sem provider nem API, mas com o mesmo ritmo da rota real —
   *  status da "tool", card chegando antes do texto e texto em stream
   *  (o server action monta os cards pelo dataset de exemplo; intenção
   *  que ele não cobre cai na resposta enlatada honesta). */
  async function rodarDemo(pergunta: string) {
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    const espera = (ms: number) => new Promise((r) => setTimeout(r, ms));
    try {
      const r = await responderDemoIa(pergunta).catch(() => null);
      if (r?.ui.length) {
        setStatus("Consultando os dados de exemplo…");
        await espera(450);
        if (ctrl.signal.aborted) return finalizar("interrompido");
        r.ui.forEach(receberUi);
        await espera(250);
      }
      const content = r?.content ?? respostaDemo(pergunta);
      // fatias de ~4 palavras a cada 28ms — o mesmo fade por fatia do stream
      for (const pedaco of content.match(/(\S+\s*){1,4}|\s+/g) ?? []) {
        if (ctrl.signal.aborted) return finalizar("interrompido");
        enfileirarToken(pedaco);
        await espera(28);
      }
      finalizar("ok");
    } catch {
      finalizar("erro");
    }
  }

  function tentarDeNovo() {
    const ultima = msgs[msgs.length - 1];
    if (!ultima || ultima.estado !== "erro") return;
    // remove a bolha de erro e repete o envio — a msg do usuário segue no
    // histórico (não duplica)
    const base = msgs.slice(0, -1);
    setMsgs([...base, { role: "assistant", content: "", estado: "stream" }]);
    setPending(true);
    setStatus(null);
    inicioRef.current = agora();
    void rodar(base);
  }

  async function copiar(i: number, content: string) {
    try {
      await navigator.clipboard.writeText(content);
      setCopiado(i);
      setTimeout(() => setCopiado(null), 1600);
    } catch {
      toast.error("Não consegui copiar.");
    }
  }

  /** Thumbs vote — one per answer (keyed by request_id; a retry gets a
   *  fresh id, so a re-asked question can be rated again). Postgrest
   *  RPCs are lazy: only .then() actually sends, and a telemetry failure
   *  must never surface in the chat — rejection handler stays empty. */
  function avaliar(m: Msg, nota: 1 | -1) {
    const reqId = m.reqId;
    if (!reqId || votos.has(reqId)) return;
    setVotos((prev) => new Map(prev).set(reqId, nota));
    setAgradecimento(reqId);
    setTimeout(
      () => setAgradecimento((atual) => (atual === reqId ? null : atual)),
      2200
    );
    void supabase
      .rpc("registrar_ia_eventos_lote", {
        p_eventos: [
          {
            canal: "chat",
            tool: "avaliacao",
            args: { nota, request_id: reqId },
            ok: true,
            duracao_ms: 0,
            request_id: reqId,
          },
        ],
      })
      .then(
        ({ error }) => {
          if (error) console.error("liza feedback:", error.message);
        },
        () => {}
      );
  }

  /** remove do histórico com "Desfazer" no toast — apagar por engano numa
   *  lista de toque é fácil, e a conversa só existe neste aparelho */
  function apagarComDesfazer(c: Conversa) {
    const antes = conversas;
    apagarConversa(c.id);
    toast("Conversa apagada.", {
      action: {
        label: "Desfazer",
        onClick: () => {
          gravarConversas(antes);
          setConversas(antes);
        },
      },
    });
  }

  const grupos = agruparConversas(
    busca.trim()
      ? conversas.filter((c) =>
          normalizar(c.titulo).includes(normalizar(busca.trim()))
        )
      : conversas
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <AnimatePresence mode="popLayout" initial={false}>
      {visao === "historico" ? (
        /* histórico do aparelho: lista de conversas salvas agrupada por
           data — tocar abre de volta na transcript; lixeira apaga só a
           dela (com desfazer). Entra pela direita, a conversa pela
           esquerda: continuidade espacial de "camada por cima" */
        <motion.div
          key="historico"
          initial={{ opacity: 0, x: 16 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 16 }}
          transition={T.panel}
          className="relative min-h-0 flex-1"
        >
          <div className="scroll-fina h-full overflow-y-auto px-4 py-4">
            {conversas.length > 4 && (
              <label className="relative mb-3 block">
                <span className="sr-only">Buscar conversa</span>
                <MagnifyingGlass
                  aria-hidden
                  className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                />
                <Input
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  placeholder="Buscar conversa"
                  className="h-9 pl-8 md:h-8"
                />
              </label>
            )}
            {conversas.length === 0 ? (
              <p className="py-10 text-center text-sm text-muted-foreground">
                Nenhuma conversa salva ainda. Elas ficam só neste aparelho.
              </p>
            ) : grupos.length === 0 ? (
              <p className="py-10 text-center text-sm text-muted-foreground">
                Nenhuma conversa com esse termo.
              </p>
            ) : (
              <div className="space-y-4">
                {grupos.map((g) => (
                  <section key={g.rotulo} aria-label={g.rotulo}>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                      {g.rotulo}
                    </p>
                    <ul className="mt-1.5 space-y-1.5">
                      {g.itens.map((c, i) => (
                        <li
                          key={c.id}
                          className="animate-enter flex items-stretch gap-1.5"
                          style={{ "--i": Math.min(i, 8) } as CSSProperties}
                        >
                          <Button
                            variant="ghost"
                            onClick={() => abrirConversa(c)}
                            aria-current={c.id === conversaId || undefined}
                            className={cn(
                              "h-auto min-w-0 flex-1 flex-col items-stretch gap-0.5 rounded-xl border px-3 py-2.5 text-left shadow-[var(--shadow-border)]",
                              c.id === conversaId
                                ? "border-foreground/25 bg-card"
                                : "border-border bg-card hover:border-foreground/25"
                            )}
                          >
                            <span className="block truncate text-sm font-medium" title={c.titulo}>
                              {c.titulo}
                            </span>
                            <span className="block text-xs font-normal text-muted-foreground">
                              {g.hora
                                ? hhmm(c.em)
                                : new Date(c.em).toLocaleDateString("pt-BR", {
                                    day: "numeric",
                                    month: "short",
                                  })}{" "}
                              · {c.msgs.length}{" "}
                              {c.msgs.length === 1 ? "mensagem" : "mensagens"}
                            </span>
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => apagarComDesfazer(c)}
                            aria-label={`Apagar conversa "${c.titulo}"`}
                            title="Apagar conversa"
                            className="h-auto w-9 shrink-0 rounded-xl text-muted-foreground hover:text-foreground"
                          >
                            <Trash size={15} aria-hidden />
                          </Button>
                        </li>
                      ))}
                    </ul>
                  </section>
                ))}
              </div>
            )}
          </div>
        </motion.div>
      ) : (
      <motion.div
        key="chat"
        initial={{ opacity: 0, x: -16 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: -16 }}
        transition={T.panel}
        className="flex min-h-0 flex-1 flex-col"
      >
      {demo && (
        <p className="mx-4 mt-3 rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">
          Na demonstração, a Liza responde com dados de exemplo.
        </p>
      )}

      {/* empty state (REALIZA-289): mascote + saudação + sugestões da
          página — some na primeira mensagem e não volta. Mutuamente
          exclusivo com o transcript: os dois com flex-1 dividiam a altura
          e o conteúdo centralizado transbordava pra cima do header */}
      {restaurada && msgs.length === 0 ? (
        <div className="scroll-fina flex min-h-0 flex-1 flex-col overflow-y-auto px-6 py-8">
          {/* a Liza senta no canto superior esquerdo — mascote de verdade,
              não ícone decorativo centralizado */}
          <div className="animate-enter flex items-start gap-4">
            <div className="shrink-0">
              <Avatar tamanho={96} estado={aberto ? "aberto" : "parado"} />
            </div>
            <div className="min-w-0 pt-4 text-left">
              <p className="text-base font-semibold text-balance">
                {primeiroNome(nome) ? `Oi, ${primeiroNome(nome)}! Eu sou a Liza.` : "Oi! Eu sou a Liza."}
              </p>
              <p className="mt-1 text-sm text-pretty text-muted-foreground">
                {soJovem
                  ? "Posso ajudar com a sua mentoria ou com o que dizem os guias do programa."
                  : "Posso ajudar com a sua operação ou com o que dizem os guias do programa."}
              </p>
            </div>
          </div>
          <div className="mt-5 flex max-w-80 flex-wrap gap-2">
            {chips.map((s, i) => (
              <button
                key={s}
                type="button"
                disabled={pending || (!configurado && !demo)}
                onClick={() => enviar(s)}
                style={{ "--i": i + 2 } as CSSProperties}
                className="animate-enter min-h-9 rounded-full border border-border bg-card px-3 py-1.5 text-xs text-muted-foreground shadow-[var(--shadow-border)] transition-[color,border-color,transform] duration-150 ease-snappy hover:border-foreground/25 hover:text-foreground active:scale-[0.97] disabled:opacity-50"
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      ) : (
      /* transcript — role=log; a rolagem só segue o fim quando o usuário
          já está perto dele. scroll-fina = scrollbar thin muted
          (REALIZA-282); fade no topo emoldura o topo do log quando rolado */
      <div
        className="relative min-h-0 flex-1"
        onClick={(e) => {
          // link interno (ação, fonte ou inline do markdown) → a bolha
          // fecha pra navegação aparecer; externo abre aba e o painel fica
          const a = (e.target as HTMLElement).closest("a[href]");
          if (a?.getAttribute("href")?.startsWith("/")) onNavegarInterno?.();
        }}
      >
        <div
          ref={logRef}
          onScroll={() => {
            const el = logRef.current;
            if (el) {
              // detach por direção: qualquer scroll pra CIMA é gesto do
              // usuário querendo ler — solta na hora, mesmo a 20px do
              // fundo (o limiar de 96px de "perto" puxava de volta a cada
              // token durante o stream). Re-atacha só chegando ao fundo
              // de verdade; scroll pra baixo no meio nunca vira "perto"
              const subiu = el.scrollTop < ultimoTopRef.current - 1;
              ultimoTopRef.current = el.scrollTop;
              if (subiu) pertoDoFim.current = false;
              else if (
                el.scrollHeight - el.scrollTop - el.clientHeight < 32
              )
                pertoDoFim.current = true;
              setLongeDoFim(!pertoDoFim.current);
            }
          }}
          role="log"
          aria-live="off"
          aria-label="Conversa com a Liza"
          className="scroll-fina @container h-full space-y-5 overflow-y-auto overscroll-contain px-4 py-4"
        >
          {/* role=log seria live por definição (ARIA 1.2) — aria-live=off
              silencia a rajada de tokens; a região sr-only anuncia só as
              bordas (começou/terminou) e a resposta fica no log */}
          <div aria-live="polite" className="sr-only">
            {pending
              ? "A Liza está respondendo…"
              : ultimaMsg?.role === "assistant"
                ? ultimaMsg.estado === "erro"
                  ? // frase fixa: no erro o content pode ser a resposta
                    // parcial inteira, longa demais pra um anúncio
                    "A Liza não conseguiu responder."
                  : "A Liza respondeu."
                : ""}
          </div>
          {msgs.map((m, i) => {
            if (m.role === "user")
              return (
                <div
                  key={i}
                  className="flex animate-in justify-end fade-in-0 slide-in-from-bottom-2 duration-200"
                >
                  <div className="max-w-[85%]">
                    <div className="whitespace-pre-wrap break-words rounded-2xl rounded-br-md bg-[var(--brand-lime)] px-4 py-2.5 text-sm text-[var(--brand-ink)]">
                      {m.content}
                    </div>
                    {m.em ? (
                      <p className="mt-1 pr-1 text-right text-xs text-muted-foreground sm:text-[11px]">
                        {hhmm(m.em)}
                      </p>
                    ) : null}
                  </div>
                </div>
              );

            const streaming = m.estado === "stream";
            const analise = analisarResposta(m.content, streaming);
            const ui = m.ui ?? [];
            const rica = ehRica(analise, ui.length > 0);
            const proxima = msgs[i + 1];
            const ctx = {
              onEnviar: enviar,
              respondida: i < msgs.length - 1,
              resposta: proxima?.role === "user" ? proxima.content : undefined,
              streaming,
            };
            const ultimaDaConversa = i === msgs.length - 1;
            // mascote da mensagem: durante o stream ele encena a rodada
            // (consultando → escrevendo); fechada, a última comemora uma
            // vez e a de erro guarda a careta — as demais ficam em repouso
            const estadoAvatar: EstadoConversa | "aberto" | "pronto" =
              streaming
                ? estado
                : ultimaDaConversa && celebra
                  ? "pronto"
                  : m.estado === "erro"
                    ? "erro"
                    : "parado";
            // indicador pré-token: status da tool (shimmer) ou a onda de
            // pontos — dentro da própria resposta, nunca bolha de espera dupla
            const esperando = streaming && !analise.textoSemBloco && !analise.stats.length;
            const indicador = esperando ? (
              status ? (
                <p className="ia-shimmer text-xs" role="status">
                  {status}
                </p>
              ) : (
                <div
                  aria-label="A Liza está escrevendo"
                  role="status"
                  className="flex items-center gap-1.5 py-1"
                >
                  {[0, 1, 2].map((d) => (
                    <span
                      key={d}
                      className="ia-digitando size-1.5 rounded-full bg-muted-foreground/70"
                      style={{ animationDelay: `${d * 160}ms` }}
                    />
                  ))}
                </div>
              )
            ) : null;
            const corpo = (
              <>
                {ui.length ? (
                  <div className="space-y-2.5">
                    {ui.map((b) => (
                      <UiCard key={b.kind} bloco={b} jovem={soJovem} />
                    ))}
                  </div>
                ) : null}
                {esperando ? (
                  indicador
                ) : (
                  <RespostaMd analise={analise} ctx={ctx} />
                )}
                {/* status de tool round no meio do stream (texto já
                    chegou e o modelo foi consultar de novo) */}
                {streaming && status && !esperando && (
                  <p className="ia-shimmer text-xs" role="status">
                    {status}
                  </p>
                )}
              </>
            );
            // fontes: as estruturadas do done (guia_consulta) + as citadas
            // inline no markdown (/materiais/*), dedup por slug. Com o card
            // de trechos dos guias na resposta, as do done já estão nele
            const temCardFontes = ui.some((b) => b.kind === "fontes");
            const fontesDone = temCardFontes ? [] : (m.fontes ?? []);
            const inline = m.estado
              ? []
              : extrairFontesTexto(m.content).filter(
                  (ft) => !m.fontes?.some((f) => f.guia === ft.slug)
                );
            // thumbs only on a closed (done), complex, sampled answer —
            // the gate is deterministic by request_id (lib/ia/feedback)
            const voto = m.reqId ? votos.get(m.reqId) : undefined;
            const mostrarFeedback =
              !!m.reqId &&
              !m.estado &&
              deveMostrarFeedback(m.reqId, {
                tools: m.tools?.length,
                contentLen: m.content.length,
                hasLink: temLinkMarkdown(m.content),
              });
            return (
              <div
                key={i}
                className={cn(
                  "group animate-in fade-in-0 slide-in-from-bottom-2 duration-200",
                  // a resposta entra 80ms depois da pergunta — lê como
                  // resposta chegando, não como montagem simultânea
                  streaming && "[animation-delay:80ms]"
                )}
              >
                {rica ? (
                  /* resposta rica: prosa na largura do painel, sem balão —
                     card, gráfico e tabela precisam de largura */
                  <div className="space-y-2.5 text-sm">
                    <div className="flex items-center gap-2">
                      <Avatar tamanho={22} estado={estadoAvatar} />
                      <span className="text-xs font-semibold">Liza</span>
                    </div>
                    <div
                      className={cn(
                        "space-y-2.5",
                        m.estado === "erro" &&
                          "rounded-xl border border-[var(--warn-border)] px-3 py-2.5"
                      )}
                    >
                      {corpo}
                    </div>
                  </div>
                ) : (
                  <div className="flex items-end gap-2">
                    <span className="mb-0.5 shrink-0">
                      <Avatar tamanho={24} estado={estadoAvatar} />
                    </span>
                    <div
                      className={cn(
                        "max-w-[85%] space-y-2 rounded-2xl rounded-bl-md bg-muted/60 px-4 py-2.5 text-sm text-foreground shadow-[var(--shadow-border)]",
                        m.estado === "erro" && "border border-[var(--warn-border)]"
                      )}
                    >
                      {corpo}
                    </div>
                  </div>
                )}

                <div className={cn("space-y-1.5", rica ? "mt-2" : "mt-1.5 pl-8")}>
                  {/* ações extraídas dos links internos da resposta */}
                  {m.acoes?.length ? (
                    <div className="flex flex-wrap gap-1.5">
                      {m.acoes.map((a, j) => (
                        <Link
                          key={a.href}
                          href={a.href}
                          style={{ "--i": j } as CSSProperties}
                          className="animate-enter inline-flex min-h-8 items-center gap-1 rounded-full border border-border bg-card px-2.5 py-1 text-xs font-medium text-muted-foreground shadow-[var(--shadow-border)] transition-[color,border-color,transform] duration-150 ease-snappy hover:border-foreground/25 hover:text-foreground active:scale-[0.97] sm:text-[11px]"
                        >
                          {a.rotulo}
                          <ArrowRight size={11} aria-hidden />
                        </Link>
                      ))}
                    </div>
                  ) : null}
                  {fontesDone.length || inline.length ? (
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                        <BookOpen size={11} aria-hidden /> Fontes
                      </span>
                      {inline.map((ft, j) => (
                        <Link
                          key={`i|${ft.slug}`}
                          href={ft.href}
                          style={{ "--i": j } as CSSProperties}
                          className="animate-enter inline-flex min-h-8 max-w-full items-center gap-1 truncate rounded-full border border-border bg-card px-2.5 py-1 text-xs font-medium text-muted-foreground shadow-[var(--shadow-border)] transition-colors hover:border-foreground/25 hover:text-foreground sm:text-[11px]"
                        >
                          {ft.rotulo}
                        </Link>
                      ))}
                      {fontesDone.map((f, j) => {
                        const meta = metaFonte(f.guia, soJovem, f);
                        // seção pode chegar a 200 chars no chunk — corta pra
                        // não estourar o chip (o inteiro vai no title);
                        // o travessão do título vira dois-pontos (copy)
                        const secaoCurta =
                          f.secao && f.secao.length > 60
                            ? `${f.secao.slice(0, 60).trimEnd()}…`
                            : f.secao;
                        const secaoTxt = secaoCurta?.replace(/\s+—\s+/g, ": ");
                        const rotulo = secaoTxt
                          ? `${meta.rotulo} · ${secaoTxt}`
                          : meta.rotulo;
                        const title = f.secao ? `${meta.rotulo}, ${f.secao}` : meta.rotulo;
                        const cls =
                          "animate-enter inline-flex min-h-8 max-w-full items-center truncate rounded-full border px-2.5 py-1 text-xs sm:text-[11px]";
                        return meta.href ? (
                          <Link
                            key={`${f.guia}|${f.secao ?? ""}`}
                            href={meta.href}
                            title={title}
                            style={{ "--i": inline.length + j } as CSSProperties}
                            className={cn(
                              cls,
                              "border-border bg-card font-medium text-muted-foreground shadow-[var(--shadow-border)] transition-colors hover:border-foreground/25 hover:text-foreground"
                            )}
                          >
                            {rotulo}
                          </Link>
                        ) : (
                          <span
                            key={`${f.guia}|${f.secao ?? ""}`}
                            title={title}
                            style={{ "--i": inline.length + j } as CSSProperties}
                            className={cn(cls, "border-border/60 text-muted-foreground")}
                          >
                            {rotulo}
                          </span>
                        );
                      })}
                    </div>
                  ) : null}
                  {/* continuação sugerida (```sugestoes) — só na última
                      resposta: nas antigas a conversa já seguiu */}
                  {ultimaDaConversa && !streaming && analise.sugestoes.length ? (
                    <Sugestoes
                      itens={analise.sugestoes}
                      onEnviar={enviar}
                      desabilitado={pending}
                    />
                  ) : null}
                  {/* meta: hora + o que consultou + copy/retry — discreto,
                      sempre no ar (touch não tem hover) */}
                  {!streaming && (m.content || m.estado === "erro") && (
                    <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 pl-0.5">
                      {m.em && (
                        <span className="text-xs text-muted-foreground sm:text-[11px]">
                          {hhmm(m.em)}
                        </span>
                      )}
                      {m.tools?.length ? (
                        <span className="text-xs text-muted-foreground sm:text-[11px]">
                          Consultou {m.tools.map(rotuloTool).filter((t, k, a) => a.indexOf(t) === k).join(", ")}
                          {m.dur ? ` em ${Math.max(1, Math.round(m.dur / 1000))} s` : ""}
                        </span>
                      ) : null}
                      {m.content && !m.estado && (
                        <button
                          type="button"
                          onClick={() => copiar(i, m.content)}
                          aria-label="Copiar resposta"
                          className="inline-flex min-h-8 items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground sm:text-[11px]"
                        >
                          {copiado === i ? (
                            <Check size={12} className="animate-in zoom-in-50 text-[var(--ok-text)] duration-150" />
                          ) : (
                            <Copy size={12} />
                          )}
                          {copiado === i ? "Copiado" : "Copiar"}
                        </button>
                      )}
                      {m.estado === "erro" && (
                        <button
                          type="button"
                          onClick={tentarDeNovo}
                          className="inline-flex min-h-8 items-center gap-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground sm:text-[11px]"
                        >
                          <ArrowClockwise size={12} />
                          Tentar de novo
                        </button>
                      )}
                      {mostrarFeedback && m.reqId ? (
                        voto === undefined ? (
                          <span
                            role="group"
                            aria-label="Avaliar resposta"
                            className="ml-auto inline-flex items-center gap-0.5"
                          >
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => avaliar(m, 1)}
                              aria-label="Resposta foi útil"
                              className="size-9 text-muted-foreground hover:text-primary"
                            >
                              <ThumbsUp size={16} aria-hidden />
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => avaliar(m, -1)}
                              aria-label="Resposta não foi útil"
                              className="size-9 text-muted-foreground hover:text-primary"
                            >
                              <ThumbsDown size={16} aria-hidden />
                            </Button>
                          </span>
                        ) : (
                          /* voted: the pair leaves, the filled thumb and
                             the ~2s "thanks" stay */
                          <span className="ml-auto inline-flex items-center gap-1.5 text-xs text-muted-foreground sm:text-[11px]">
                            {agradecimento === m.reqId && (
                              <span className="animate-in fade-in-0 duration-200">
                                Valeu pelo retorno!
                              </span>
                            )}
                            {voto === 1 ? (
                              <ThumbsUp
                                size={16}
                                weight="fill"
                                aria-hidden
                                className="text-foreground"
                              />
                            ) : (
                              <ThumbsDown
                                size={16}
                                weight="fill"
                                aria-hidden
                                className="text-foreground"
                              />
                            )}
                          </span>
                        )
                      ) : null}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        {/* fade do topo — emoldura o log rolado (sai do bg do painel) */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-6 bg-gradient-to-b from-popover to-transparent"
        />
        {/* "ir ao fim": o scroll para de seguir quando o usuário sobe —
            a pill devolve pro fundo com um toque (msg nova não rouba a
            posição de quem está lendo) */}
        <AnimatePresence>
          {longeDoFim && (
            <motion.div
              initial={{ opacity: 0, y: 6, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 6, scale: 0.96, transition: T.micro }}
              transition={T.enter}
              className="absolute bottom-2 left-1/2 -translate-x-1/2"
            >
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  pertoDoFim.current = true;
                  setLongeDoFim(false);
                  rolarFim(true);
                }}
                className="h-auto gap-1.5 rounded-full bg-card px-3 py-1.5 text-[11px] font-medium text-muted-foreground shadow-[var(--shadow-overlay)] hover:text-foreground"
              >
                <ArrowDown size={12} aria-hidden />
                Ver recentes
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      )}

      {/* composer — pb com safe-area: no Sheet mobile o composer não cola
          na home indicator */}
      <div className="space-y-2 border-t border-border/60 px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-3">
        {!configurado && !demo ? (
          <Card className="px-4 py-3 text-sm text-muted-foreground">
            A Liza está indisponível no momento. Tente de novo em instantes.
          </Card>
        ) : (
          <>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                enviar(texto);
              }}
              className="flex items-end gap-2"
            >
              <Textarea
                ref={inputRef}
                value={texto}
                autoFocus={autoFocus}
                maxLength={4000}
                onChange={(e) => setTexto(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    enviar(texto);
                  }
                }}
                placeholder="Pergunte à Liza…"
                aria-label="Mensagem pra Liza"
                rows={1}
                className="max-h-32 min-h-11 flex-1 resize-none"
              />
              {/* enviar ↔ parar: o mesmo lugar troca de papel com crossfade
                  + giro curto do ícone (continuidade, não dois botões) */}
              <Button
                type={pending ? "button" : "submit"}
                size="icon"
                variant={pending ? "outline" : "default"}
                onClick={pending ? parar : undefined}
                disabled={!pending && !texto.trim()}
                aria-label={pending ? "Parar resposta" : "Enviar mensagem"}
                className="relative overflow-hidden"
              >
                <AnimatePresence mode="popLayout" initial={false}>
                  <motion.span
                    key={pending ? "parar" : "enviar"}
                    initial={{ opacity: 0, scale: 0.6, rotate: pending ? -45 : 45 }}
                    animate={{ opacity: 1, scale: 1, rotate: 0 }}
                    exit={{ opacity: 0, scale: 0.6, transition: T.micro }}
                    transition={T.enter}
                    className="grid place-items-center"
                  >
                    {pending ? <Square weight="fill" /> : <PaperPlaneRight />}
                  </motion.span>
                </AnimatePresence>
              </Button>
            </form>
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs text-muted-foreground sm:text-[11px]">
                A Liza é uma IA e pode errar. Confirme informações críticas.
              </p>
              {texto.length > 3600 && (
                <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
                  {texto.length}/4000
                </span>
              )}
            </div>
          </>
        )}
      </div>
      </motion.div>
      )}
      </AnimatePresence>
    </div>
  );
}
