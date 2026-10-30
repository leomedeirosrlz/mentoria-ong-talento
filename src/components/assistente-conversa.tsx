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

import { useEffect, useRef, useState } from "react";
import {
  ArrowClockwise,
  ArrowDown,
  ArrowRight,
  BookOpen,
  Check,
  Copy,
  PaperPlaneRight,
  Sparkle,
  Square,
  Trash,
} from "@phosphor-icons/react";
import { toast } from "sonner";
import { extrairAcoes, montarEnvioChat, msgAmigavel } from "@/lib/ia/mensagens";
import { metaFonte, type FonteIa } from "@/lib/ia/fontes";
import {
  ehTabelaMd,
  extrairFontesTexto,
  extrairStats,
  parseTabelaMd,
  type Stat,
  type StatTom,
  type TabelaMd,
} from "@/lib/ia/render";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import type { AppRole } from "@/lib/types";
import { cn } from "@/lib/utils";

type Msg = {
  role: "user" | "assistant";
  content: string;
  estado?: "stream" | "erro";
  tools?: string[];
  em?: number;
  acoes?: { rotulo: string; href: string }[];
  fontes?: FonteIa[];
};

const primeiroNome = (nome?: string) => nome?.trim().split(/\s+/)[0];

const hhmm = (em?: number) =>
  em ? new Date(em).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : "";

// fora do componente: Date.now é impuro pro linter do compiler — a hora
// só é lida em handler de evento, nunca durante render
const agora = () => Date.now();

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
    return Array.isArray(parsed)
      ? (parsed.filter(
          (c): c is Conversa =>
            !!c && typeof c === "object" && "id" in c && Array.isArray((c as Conversa).msgs)
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

const DEMO_FALLBACK =
  "Na demonstração o assistente tem respostas de exemplo — no ambiente real ele responde com seus dados e guias oficiais.";

const FALHA =
  "Não consegui responder agora — tente de novo em instantes.";

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

/** Sugestões por papel — caminhos que as tools respondem de fato
 *  (dados via registry; guias via guia_consulta). */
function sugestoes(papeis: AppRole[]): string[] {
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

// ---------- markdown-lite ----------
// bold, listas, links e código — sem parser pesado: blocos por linha,
// inline por regex. O modelo só emite esse subconjunto (system prompt).

const INLINE = /(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\([^)\s]+\))/g;

function Inline({ texto }: { texto: string }) {
  return (
    <>
      {texto.split(INLINE).map((parte, i) => {
        if (parte.startsWith("**") && parte.endsWith("**"))
          return <strong key={i}>{parte.slice(2, -2)}</strong>;
        if (parte.startsWith("`") && parte.endsWith("`"))
          return (
            <code
              key={i}
              className="rounded bg-muted px-1 py-0.5 text-[0.85em] font-mono"
            >
              {parte.slice(1, -1)}
            </code>
          );
        const link = /^\[([^\]]+)\]\(([^)\s]+)\)$/.exec(parte);
        if (link) {
          const [, rotulo, href] = link;
          // link seguro: http(s) ou interno — javascript:/data: viram texto
          if (/^(https?:|\/)/.test(href))
            return (
              <a
                key={i}
                href={href}
                target={href.startsWith("/") ? undefined : "_blank"}
                rel="noopener noreferrer"
                className="underline underline-offset-2 decoration-muted-foreground/50 hover:decoration-foreground"
              >
                {rotulo}
              </a>
            );
        }
        return parte;
      })}
    </>
  );
}

function MdLite({ texto }: { texto: string }) {
  const linhas = texto.split("\n");
  const blocos: React.ReactNode[] = [];
  let lista: string[] | null = null;
  let listaOrd = false;
  let emCodigo = false;
  let codigo: string[] = [];
  let key = 0;
  const flush = () => {
    if (!lista?.length) return;
    const items = lista.map((l, i) => (
      <li key={i}>
        <Inline texto={l} />
      </li>
    ));
    blocos.push(
      listaOrd ? (
        <ol key={key++} className="list-decimal space-y-1 pl-5">
          {items}
        </ol>
      ) : (
        <ul key={key++} className="list-disc space-y-1 pl-5 marker:text-muted-foreground">
          {items}
        </ul>
      )
    );
    lista = null;
  };
  let pularAte = -1;
  linhas.forEach((linha, idx) => {
    if (idx <= pularAte) return;
    // fenced code: tudo entre ``` vira bloco monoespaçado, sem inline
    if (emCodigo) {
      if (/^\s*```/.test(linha)) {
        blocos.push(
          <pre
            key={key++}
            className="overflow-x-auto rounded-lg bg-muted px-3 py-2 text-[0.85em] font-mono"
          >
            <code>{codigo.join("\n")}</code>
          </pre>
        );
        emCodigo = false;
        codigo = [];
      } else codigo.push(linha);
      return;
    }
    if (/^\s*```/.test(linha)) {
      flush();
      emCodigo = true;
      return;
    }
    // pipe-table GFM (REALIZA-281): linha com pipes externos tenta virar
    // tabela de verdade — não validou, segue como texto comum
    if (ehTabelaMd(linha)) {
      const t = parseTabelaMd(linhas.slice(idx));
      if (t) {
        flush();
        pularAte = idx + 1 + t.linhas.length;
        blocos.push(<Tabela key={key++} t={t} />);
        return;
      }
    }
    const bullet = /^\s*[-*•]\s+(.+)$/.exec(linha);
    const num = /^\s*\d+[.)]\s+(.+)$/.exec(linha);
    if (bullet || num) {
      if (!lista || listaOrd !== Boolean(num)) {
        flush();
        lista = [];
        listaOrd = Boolean(num);
      }
      lista.push((bullet ?? num)![1]);
      return;
    }
    flush();
    if (!linha.trim()) return;
    const h = /^#{1,3}\s+(.+)$/.exec(linha);
    if (h) {
      blocos.push(
        <p key={key++} className="font-semibold">
          <Inline texto={h[1]} />
        </p>
      );
      return;
    }
    const quote = /^>\s?(.*)$/.exec(linha);
    if (quote) {
      blocos.push(
        <blockquote
          key={key++}
          className="border-l-2 border-border pl-3 text-muted-foreground"
        >
          <Inline texto={quote[1]} />
        </blockquote>
      );
      return;
    }
    blocos.push(
      <p key={key++}>
        <Inline texto={linha} />
      </p>
    );
  });
  flush();
  // fence aberto no fim do stream: mostra o que chegou
  if (emCodigo && codigo.length)
    blocos.push(
      <pre
        key={key++}
        className="overflow-x-auto rounded-lg bg-muted px-3 py-2 text-[0.85em] font-mono"
      >
        <code>{codigo.join("\n")}</code>
      </pre>
    );
  return <div className="space-y-2">{blocos}</div>;
}

/** Tabela pipe → <table> de verdade (REALIZA-281): células passam pelo
 *  inline pra manter negrito/código/link; rolagem horizontal no estreito. */
function Tabela({ t }: { t: TabelaMd }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full text-left text-[0.9em]">
        <thead>
          <tr className="border-b border-border bg-muted/50">
            {t.cab.map((c, i) => (
              <th key={i} className="px-2.5 py-1.5 font-semibold">
                <Inline texto={c} />
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border/60">
          {t.linhas.map((l, i) => (
            <tr key={i}>
              {l.map((c, j) => (
                <td key={j} className="px-2.5 py-1.5 align-top">
                  <Inline texto={c} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Cartões do bloco ```stats (REALIZA-281): fileira compacta de
 *  indicadores com o tom semântico do dado — mesmo mapa do semáforo. */
const TOM_STAT: Record<StatTom, string> = {
  danger: "text-[var(--danger-text)]",
  warn: "text-[var(--warn-text)]",
  ok: "text-[var(--ok-text)]",
  info: "text-[var(--info-text)]",
  neutro: "text-foreground",
};

function StatCards({ stats }: { stats: Stat[] }) {
  return (
    <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
      {stats.slice(0, 4).map((s, i) => (
        <div
          key={i}
          className="rounded-lg border border-border bg-card px-2.5 py-2 shadow-[var(--shadow-border)]"
        >
          <p className={cn("text-base font-semibold leading-tight", TOM_STAT[s.tom])}>
            {s.valor}
          </p>
          <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">
            {s.rotulo}
          </p>
          {s.detalhe ? (
            <p className="mt-0.5 text-[10px] leading-snug text-muted-foreground/70">
              {s.detalhe}
            </p>
          ) : null}
        </div>
      ))}
    </div>
  );
}

/** Resposta do assistente: extrai o bloco ```stats (vira cartões) e
 *  renderiza o resto no MdLite. Bloco inválido/parcial fica no texto e
 *  renderiza como código — conteúdo nunca some. */
function BolhaMd({ texto }: { texto: string }) {
  const { stats, textoSemBloco } = extrairStats(texto);
  return (
    <>
      {stats.length ? <StatCards stats={stats} /> : null}
      {textoSemBloco ? <MdLite texto={textoSemBloco} /> : null}
    </>
  );
}

// ---------- conversa ----------

export function AssistenteConversa({
  papeis,
  demo,
  configurado,
  autoFocus,
  nome,
  registrarNova,
  registrarHistorico,
}: {
  papeis: AppRole[];
  demo: boolean;
  configurado: boolean;
  /** a bolha já foca o textarea ao abrir — autoFocus cobre o caso direto */
  autoFocus?: boolean;
  /** primeiro nome pro empty state ("Oi, X!") — sem ele, genérico */
  nome?: string;
  /** a bolha expõe "Nova conversa" no header — registra a ação aqui */
  registrarNova?: (fn: () => void) => void;
  /** idem pro botão de histórico — alterna transcript ↔ lista de conversas */
  registrarHistorico?: (fn: () => void) => void;
}) {
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [restaurada, setRestaurada] = useState(false);
  const [conversas, setConversas] = useState<Conversa[]>([]);
  const [visao, setVisao] = useState<"chat" | "historico">("chat");
  const [texto, setTexto] = useState("");
  const [pending, setPending] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [copiado, setCopiado] = useState<number | null>(null);
  // espelho renderizável do pertoDoFim ref — a pill "ir ao fim" precisa de
  // estado porque evento de scroll não dispara render por si só
  const [longeDoFim, setLongeDoFim] = useState(false);
  const logRef = useRef<HTMLDivElement>(null);
  const pertoDoFim = useRef(true);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  // tokens acumulam num ref e descem pro estado uma vez por frame —
  // SSE manda deltas pequenos demais pra re-render por delta
  const tokensRef = useRef("");
  const flushRef = useRef(0);
  // id da conversa ativa no histórico — criado no 1º envio, zerado em
  // "Nova conversa"; estado (não ref) porque a lista o lê durante render
  const [conversaId, setConversaId] = useState<string | null>(null);
  const chips = sugestoes(papeis);

  const rolarFim = (forca = false) => {
    const el = logRef.current;
    if (el && (forca || pertoDoFim.current)) el.scrollTop = el.scrollHeight;
  };
  useEffect(() => rolarFim(), [msgs, pending, status]);

  // restaura o histórico do aparelho (Pop/Sheet desmontam o painel ao
  // fechar e o storage sobrevive à aba — continuidade entre sessões).
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
            id: crypto.randomUUID(),
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
    inputRef.current?.focus();
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

  /** troca pra uma conversa do histórico — aborta um stream em andamento
   *  (os tokens já gravados ficam na conversa de origem) */
  function abrirConversa(c: Conversa) {
    abortRef.current?.abort();
    if (flushRef.current) {
      cancelAnimationFrame(flushRef.current);
      flushRef.current = 0;
    }
    tokensRef.current = "";
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
    tokensRef.current = "";
    setMsgs((ms) =>
      ms.map((m, i) =>
        i === ms.length - 1 && m.estado === "stream"
          ? { ...m, content: m.content + pend }
          : m
      )
    );
  }

  function enfileirarToken(t: string) {
    tokensRef.current += t;
    if (!flushRef.current)
      flushRef.current = requestAnimationFrame(flushTokens);
  }

  /** Fecha a rodada: flush dos tokens pendentes + marca o estado final da
   *  bolha (ok vira ausência de estado; erro ganha retry). */
  function finalizar(
    estado: "ok" | "erro" | "interrompido",
    extra?: { tools?: string[]; erro?: string; fontes?: FonteIa[] }
  ) {
    if (flushRef.current) {
      cancelAnimationFrame(flushRef.current);
      flushRef.current = 0;
    }
    const pend = tokensRef.current;
    tokensRef.current = "";
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
          em: agora(),
        },
      ];
    });
    setPending(false);
    setStatus(null);
    abortRef.current = null;
    inputRef.current?.focus();
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
        body: JSON.stringify({ messages: envio }),
        signal: ctrl.signal,
      });
      statusHttp = res.status;
      const tipo = res.headers.get("content-type") ?? "";
      // gates pré-stream respondem JSON (401/429/503) ou redirect (307→
      // página de login em HTML) — qualquer um deles vira erro legível
      if (!res.ok || !res.body || !tipo.includes("text/event-stream")) {
        const data = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        // redirect silencioso pro login = sessão caída, não falha do provider
        if (res.redirected && res.ok)
          throw new Error("Sua sessão expirou — entre de novo pelo login.");
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
            else if (ev.type === "status") setStatus((ev as { t: string }).t);
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
      else finalizar("ok", { tools, fontes });
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
    if (!conversaId) setConversaId(crypto.randomUUID());
    setVisao("chat");
    const novas: Msg[] = [
      ...msgs,
      { role: "user", content: limpo, em: agora() },
    ];
    setMsgs([...novas, { role: "assistant", content: "", estado: "stream" }]);
    setTexto("");
    setPending(true);
    setStatus(null);
    pertoDoFim.current = true;
    requestAnimationFrame(() => rolarFim(true));

    if (demo) {
      // demo não chama provider nem API — resposta enlatada honesta
      await new Promise((r) => setTimeout(r, 500));
      setMsgs((ms) =>
        ms.map((m, i) =>
          i === ms.length - 1
            ? {
                role: "assistant" as const,
                content: respostaDemo(limpo),
                em: agora(),
              }
            : m
        )
      );
      setPending(false);
      inputRef.current?.focus();
      return;
    }

    await rodar(novas);
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

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {visao === "historico" ? (
        /* histórico do aparelho (REALIZA-xxx): lista de conversas salvas —
           tocar abre de volta na transcript; lixeira apaga só a dela */
        <div className="relative min-h-0 flex-1">
          <div className="scroll-fina h-full overflow-y-auto px-4 py-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              Conversas neste aparelho
            </p>
            {conversas.length === 0 ? (
              <p className="py-10 text-center text-sm text-muted-foreground">
                Nenhuma conversa salva ainda. Elas ficam só neste aparelho.
              </p>
            ) : (
              <ul className="mt-2 space-y-1.5">
                {conversas.map((c) => (
                  <li key={c.id} className="flex items-stretch gap-1.5">
                    <Button
                      variant="ghost"
                      onClick={() => abrirConversa(c)}
                      className={cn(
                        "h-auto min-w-0 flex-1 flex-col items-stretch gap-0.5 rounded-xl border px-3 py-2.5 text-left shadow-[var(--shadow-border)]",
                        c.id === conversaId
                          ? "border-foreground/25 bg-card"
                          : "border-border bg-card hover:border-foreground/25"
                      )}
                    >
                      <span className="block truncate text-sm font-medium">
                        {c.titulo}
                      </span>
                      <span className="block text-[11px] font-normal text-muted-foreground">
                        {new Date(c.em).toLocaleDateString("pt-BR", {
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
                      onClick={() => apagarConversa(c.id)}
                      aria-label={`Apagar conversa "${c.titulo}"`}
                      title="Apagar conversa"
                      className="h-auto w-9 shrink-0 rounded-xl text-muted-foreground hover:text-foreground"
                    >
                      <Trash size={15} aria-hidden />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      ) : (
      <>
      {demo && (
        <p className="mx-4 mt-3 rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">
          Na demonstração, o assistente responde com exemplos fixos.
        </p>
      )}

      {/* empty state (REALIZA-289): avatar + saudação + sugestões — some
          na primeira mensagem e não volta. Mutuamente exclusivo com o
          transcript: os dois com flex-1 dividiam a altura e o conteúdo
          centralizado transbordava pra cima do header no mobile. */}
      {msgs.length === 0 ? (
        <div className="scroll-fina flex min-h-0 flex-1 animate-in flex-col items-center justify-center gap-3 overflow-y-auto px-6 py-8 text-center fade-in-0 duration-300">
          <span className="grid size-12 place-items-center rounded-2xl bg-[var(--brand-lime)] text-[var(--brand-ink)] shadow-[var(--shadow-overlay)]">
            <Sparkle size={22} weight="fill" aria-hidden />
          </span>
          <div>
            <p className="text-base font-semibold">
              {primeiroNome(nome) ? `Oi, ${primeiroNome(nome)}!` : "Oi!"}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Posso ajudar com a sua operação ou com o que dizem os guias do
              programa.
            </p>
          </div>
          <div className="mt-1 flex max-w-72 flex-wrap justify-center gap-2">
            {chips.map((s) => (
              <button
                key={s}
                type="button"
                disabled={pending || (!configurado && !demo)}
                onClick={() => enviar(s)}
                className="rounded-full border border-border bg-card px-3 py-1.5 text-xs text-muted-foreground shadow-[var(--shadow-border)] transition-colors hover:border-foreground/25 hover:text-foreground disabled:opacity-50"
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      ) : (
      /* transcript — role=log + aria-live pra resposta nova; a rolagem só
          segue o fim quando o usuário já está perto dele. scroll-fina =
          scrollbar thin muted (REALIZA-282); fade no topo emoldura o topo
          do log quando rolado */
      <div className="relative min-h-0 flex-1">
        <div
          ref={logRef}
          onScroll={() => {
            const el = logRef.current;
            if (el) {
              pertoDoFim.current =
                el.scrollHeight - el.scrollTop - el.clientHeight < 96;
              setLongeDoFim(!pertoDoFim.current);
            }
          }}
          role="log"
          aria-live="polite"
          aria-label="Conversa com o assistente"
          className="scroll-fina h-full space-y-3 overflow-y-auto overscroll-contain px-4 py-4"
        >
          {msgs.map((m, i) => (
            <div
              key={i}
              className={cn(
                "group flex animate-in items-end gap-2 fade-in-0 slide-in-from-bottom-2 duration-200",
                m.role === "user" ? "justify-end" : "justify-start",
                // a bolha do assistente entra 80ms depois da pergunta —
                // lê como resposta chegando, não como montagem simultânea
                m.estado === "stream" && "[animation-delay:80ms]"
              )}
            >
              {m.role === "assistant" && (
                <span
                  aria-hidden
                  className="mb-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-[var(--brand-lime)]/15 text-[var(--brand-lime-deep)]"
                >
                  <Sparkle size={12} weight="fill" />
                </span>
              )}
              <div className="max-w-[85%]">
                <div
                  className={cn(
                    "rounded-2xl px-4 py-2.5 text-sm",
                    m.role === "user"
                      ? "rounded-br-md bg-[var(--brand-lime)] text-[var(--brand-ink)] whitespace-pre-wrap"
                      : "rounded-bl-md bg-muted/60 text-foreground shadow-[var(--shadow-border)]",
                    m.estado === "erro" && "border border-[var(--warn)]/40"
                  )}
                >
                  {m.role === "assistant" ? (
                    m.estado === "stream" && !m.content ? (
                      /* pré-token: UM indicador dentro da própria bolha —
                         shimmer de status se uma tool está rodando, senão
                         a onda de 3 pontos. Nada de bolha de espera dupla. */
                      status ? (
                        <p className="ia-shimmer flex items-center gap-2 text-xs">
                          <Sparkle
                            size={12}
                            weight="fill"
                            className="text-[var(--brand-lime-deep)]"
                            aria-hidden
                          />
                          {status}
                        </p>
                      ) : (
                        <div
                          aria-label="O assistente está escrevendo"
                          role="status"
                          className="flex items-center gap-1.5 py-0.5"
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
                    ) : (
                      <>
                        <BolhaMd texto={m.content || "…"} />
                        {/* cursor do stream (REALIZA-280): blink de caret seco
                            (~530ms/fase) no fim enquanto o token chega */}
                        {m.estado === "stream" && (
                          <span
                            aria-hidden
                            className="ia-cursor ml-0.5 inline-block h-[1em] w-[3px] translate-y-0.5 rounded-full bg-foreground/70"
                          />
                        )}
                      </>
                    )
                  ) : (
                    m.content
                  )}
                </div>
                {/* ações extraídas dos links internos da resposta */}
                {m.acoes?.length ? (
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {m.acoes.map((a) => (
                      <Link
                        key={a.href}
                        href={a.href}
                        className="inline-flex items-center gap-1 rounded-full border border-border bg-card px-2.5 py-1 text-[11px] font-medium text-muted-foreground shadow-[var(--shadow-border)] transition-colors hover:border-foreground/25 hover:text-foreground"
                      >
                        {a.rotulo}
                        <ArrowRight size={11} aria-hidden />
                      </Link>
                    ))}
                  </div>
                ) : null}
                {/* fontes: as estruturadas do done (guia_consulta) + as
                    citadas inline no markdown (/materiais/*), dedup por
                    slug — REALIZA-281/302 */}
                {(() => {
                  const inline = m.estado
                    ? []
                    : extrairFontesTexto(m.content).filter(
                        (ft) => !m.fontes?.some((f) => f.guia === ft.slug)
                      );
                  return m.fontes?.length || inline.length ? (
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-[0.08em] text-muted-foreground/70">
                        <BookOpen size={11} aria-hidden /> Fontes
                      </span>
                      {inline.map((ft) => (
                        <Link
                          key={`i|${ft.slug}`}
                          href={ft.href}
                          className="inline-flex max-w-full items-center gap-1 truncate rounded-full border border-border bg-card px-2.5 py-1 text-[11px] font-medium text-muted-foreground shadow-[var(--shadow-border)] transition-colors hover:border-foreground/25 hover:text-foreground"
                        >
                          {ft.rotulo}
                        </Link>
                      ))}
                      {m.fontes?.map((f) => {
                      const meta = metaFonte(f.guia);
                      // seção pode chegar a 200 chars no chunk — corta pra
                      // não estourar o chip (o inteiro vai no title)
                      const secaoCurta =
                        f.secao && f.secao.length > 60
                          ? `${f.secao.slice(0, 60).trimEnd()}…`
                          : f.secao;
                      const rotulo = secaoCurta
                        ? `${meta.rotulo} · ${secaoCurta}`
                        : meta.rotulo;
                      const title = f.secao
                        ? `${meta.rotulo} — ${f.secao}`
                        : meta.rotulo;
                      return meta.href ? (
                        <Link
                          key={`${f.guia}|${f.secao ?? ""}`}
                          href={meta.href}
                          title={title}
                          className="inline-flex max-w-full items-center gap-1 truncate rounded-full border border-border bg-card px-2.5 py-1 text-[11px] font-medium text-muted-foreground shadow-[var(--shadow-border)] transition-colors hover:border-foreground/25 hover:text-foreground"
                        >
                          {rotulo}
                        </Link>
                      ) : (
                        <span
                          key={`${f.guia}|${f.secao ?? ""}`}
                          title={title}
                          className="inline-flex max-w-full items-center truncate rounded-full border border-border/60 px-2.5 py-1 text-[11px] text-muted-foreground"
                        >
                          {rotulo}
                        </span>
                      );
                    })}
                    </div>
                  ) : null;
                })()}
                {/* meta: hora + copy/retry — discreto, sempre no
                    ar (touch não tem hover) */}
                {(m.em || (m.role === "assistant" && (m.content || m.estado === "erro"))) && (
                  <div
                    className={cn(
                      "mt-1 flex items-center gap-2",
                      m.role === "user" ? "justify-end pr-1" : "pl-1"
                    )}
                  >
                    {m.em && (
                      <span className="text-[10px] text-muted-foreground/70">
                        {hhmm(m.em)}
                      </span>
                    )}
                    {m.role === "assistant" && m.content && !m.estado && (
                      <button
                        type="button"
                        onClick={() => copiar(i, m.content)}
                        aria-label="Copiar resposta"
                        className="inline-flex items-center gap-1 text-[11px] text-muted-foreground transition-colors hover:text-foreground"
                      >
                        {copiado === i ? <Check size={12} /> : <Copy size={12} />}
                        {copiado === i ? "Copiado" : "Copiar"}
                      </button>
                    )}
                    {m.tools?.length ? (
                      <span className="text-[11px] text-muted-foreground/70">
                        fontes: {m.tools.join(", ")}
                      </span>
                    ) : null}
                    {m.estado === "erro" && (
                      <button
                        type="button"
                        onClick={tentarDeNovo}
                        className="inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground transition-colors hover:text-foreground"
                      >
                        <ArrowClockwise size={12} />
                        Tentar de novo
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}

          {/* status de tool round DURANTE o stream: a bolha da resposta já
              tem conteúdo+cursor — a linha de status vem embaixo (pré-token
              o status mora dentro da bolha, sem duplicar) */}
          {pending && status && msgs[msgs.length - 1]?.content ? (
            <div className="flex animate-in items-end justify-start gap-2 fade-in-0 duration-200">
              <span
                aria-hidden
                className="mb-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-[var(--brand-lime)]/15 text-[var(--brand-lime-deep)]"
              >
                <Sparkle size={12} weight="fill" />
              </span>
              <div className="rounded-2xl rounded-bl-md bg-muted/60 px-4 py-2.5 shadow-[var(--shadow-border)]">
                <p className="ia-shimmer flex items-center gap-2 text-xs">
                  {status}
                </p>
              </div>
            </div>
          ) : null}
        </div>
        {/* fade do topo — aparece só quando o log rolou (o gradiente sai
            do bg do painel, não de uma cor fixa) */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-6 bg-gradient-to-b from-popover to-transparent"
        />
        {/* "ir ao fim": o scroll para de seguir quando o usuário sobe —
            a pill devolve pro fundo com um toque (msg nova não rouba a
            posição de quem está lendo) */}
        {longeDoFim && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              pertoDoFim.current = true;
              setLongeDoFim(false);
              rolarFim(true);
            }}
            className="absolute bottom-2 left-1/2 h-auto -translate-x-1/2 animate-in gap-1.5 rounded-full bg-card px-3 py-1.5 text-[11px] font-medium text-muted-foreground shadow-[var(--shadow-overlay)] duration-200 fade-in-0 zoom-in-95 hover:text-foreground"
          >
            <ArrowDown size={12} aria-hidden />
            Ver recentes
          </Button>
        )}
      </div>
      )}

      {/* composer — os chips moram no empty state agora. pb com safe-area:
          no Sheet mobile o composer não cola na home indicator */}
      <div className="space-y-2 border-t border-border/60 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3">
        {!configurado && !demo ? (
          <Card className="px-4 py-3 text-sm text-muted-foreground">
            O assistente está indisponível no momento — tente de novo em
            instantes.
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
                placeholder="Pergunte sobre a operação…"
                aria-label="Mensagem pro assistente"
                rows={1}
                className="max-h-32 min-h-11 flex-1 resize-none"
              />
              {pending ? (
                <Button
                  type="button"
                  size="icon"
                  variant="outline"
                  onClick={parar}
                  aria-label="Parar resposta"
                >
                  <Square weight="fill" />
                </Button>
              ) : (
                <Button
                  type="submit"
                  size="icon"
                  disabled={!texto.trim()}
                  aria-label="Enviar mensagem"
                >
                  <PaperPlaneRight />
                </Button>
              )}
            </form>
            <div className="flex items-center justify-between gap-2">
              <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <Sparkle aria-hidden />
                Respostas geradas por IA podem errar — confirme informações
                críticas.
              </p>
              {texto.length > 3600 && (
                <span className="shrink-0 text-[10px] tabular-nums text-muted-foreground">
                  {texto.length}/4000
                </span>
              )}
            </div>
          </>
        )}
      </div>
      </>
      )}
    </div>
  );
}
