"use client";

// Corpo do assistente (transcript + composer) — embutido no painel da
// AssistenteBolha (Popover no desktop, Sheet bottom no mobile).
// REALIZA-244: lê o SSE de /api/ia/chat com getReader+TextDecoder —
// tokens chegam por rAF-batched setState (um render por frame, não por
// delta), status das tool rounds vira linha "consultando dados…", stop
// aborta o fetch no meio e retry reenvia a última pergunta. Transcript
// só em useState: refresh limpa de propósito (LGPD — a conversa não
// persiste; o que fica é a ação em ia_eventos).

import { useEffect, useRef, useState } from "react";
import {
  ArrowClockwise,
  Check,
  Copy,
  PaperPlaneRight,
  Sparkle,
  Square,
} from "@phosphor-icons/react";
import { toast } from "sonner";
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
};

const BOAS_VINDAS =
  "Oi! Sou o assistente do Realiza. Posso ajudar com a sua operação ou com o que dizem os guias do programa.";

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
  const flush = (key: number) => {
    if (!lista?.length) return;
    const items = lista.map((l, i) => (
      <li key={i}>
        <Inline texto={l} />
      </li>
    ));
    blocos.push(
      listaOrd ? (
        <ol key={key} className="list-decimal space-y-1 pl-5">
          {items}
        </ol>
      ) : (
        <ul key={key} className="list-disc space-y-1 pl-5 marker:text-muted-foreground">
          {items}
        </ul>
      )
    );
    lista = null;
  };
  linhas.forEach((linha, i) => {
    const bullet = /^\s*[-*•]\s+(.+)$/.exec(linha);
    const num = /^\s*\d+[.)]\s+(.+)$/.exec(linha);
    if (bullet || num) {
      if (!lista || listaOrd !== Boolean(num)) {
        flush(i * 2);
        lista = [];
        listaOrd = Boolean(num);
      }
      lista.push((bullet ?? num)![1]);
      return;
    }
    flush(i * 2);
    if (!linha.trim()) return;
    blocos.push(
      <p key={i * 2 + 1}>
        <Inline texto={linha} />
      </p>
    );
  });
  flush(linhas.length * 2);
  return <div className="space-y-2">{blocos}</div>;
}

// ---------- conversa ----------

export function AssistenteConversa({
  papeis,
  demo,
  configurado,
  autoFocus,
}: {
  papeis: AppRole[];
  demo: boolean;
  configurado: boolean;
  /** a bolha já foca o textarea ao abrir — autoFocus cobre o caso direto */
  autoFocus?: boolean;
}) {
  const [msgs, setMsgs] = useState<Msg[]>([
    { role: "assistant", content: BOAS_VINDAS },
  ]);
  const [texto, setTexto] = useState("");
  const [pending, setPending] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [copiado, setCopiado] = useState<number | null>(null);
  const logRef = useRef<HTMLDivElement>(null);
  const pertoDoFim = useRef(true);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  // tokens acumulam num ref e descem pro estado uma vez por frame —
  // SSE manda deltas pequenos demais pra re-render por delta
  const tokensRef = useRef("");
  const flushRef = useRef(0);
  const primeiraMsg = !msgs.some((m) => m.role === "user");
  const chips = sugestoes(papeis);

  const rolarFim = (forca = false) => {
    const el = logRef.current;
    if (el && (forca || pertoDoFim.current)) el.scrollTop = el.scrollHeight;
  };
  useEffect(() => rolarFim(), [msgs, pending, status]);

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
    extra?: { tools?: string[]; erro?: string }
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
   *  resposta real (envio normal e retry compartilham). */
  async function rodar(base: Msg[]) {
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    try {
      const res = await fetch("/api/ia/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: base }),
        signal: ctrl.signal,
      });
      const tipo = res.headers.get("content-type") ?? "";
      // gates pré-stream respondem JSON (401/429/503) ou redirect (307→
      // página de login em HTML) — qualquer um deles vira erro legível
      if (!res.ok || !res.body || !tipo.includes("text/event-stream")) {
        const data = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(data?.error ?? FALHA);
      }

      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = "";
      let tools: string[] | undefined;
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
            else if (ev.type === "done")
              tools = (ev as { tools?: string[] }).tools;
            else if (ev.type === "error") falha = (ev as { e: string }).e;
          }
        }
      }
      if (falha) finalizar("erro", { erro: falha });
      // stream fechou sem done (rede caiu no fim): finaliza com o que tem
      else finalizar("ok", { tools });
    } catch (e) {
      if (ctrl.signal.aborted) {
        finalizar("interrompido");
        return;
      }
      const msg = e instanceof Error && e.message ? e.message : FALHA;
      finalizar("erro", { erro: msg });
      toast.error(msg);
    }
  }

  async function enviar(conteudo: string) {
    const limpo = conteudo.trim();
    if (!limpo || pending) return;
    const novas: Msg[] = [...msgs, { role: "user", content: limpo }];
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
            ? { role: "assistant" as const, content: respostaDemo(limpo) }
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
      {demo && (
        <p className="mx-4 mt-3 rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">
          Na demonstração, o assistente responde com exemplos fixos.
        </p>
      )}

      {/* transcript — role=log + aria-live pra resposta nova; a rolagem só
          segue o fim quando o usuário já está perto dele */}
      <div
        ref={logRef}
        onScroll={() => {
          const el = logRef.current;
          if (el)
            pertoDoFim.current =
              el.scrollHeight - el.scrollTop - el.clientHeight < 96;
        }}
        role="log"
        aria-live="polite"
        aria-label="Conversa com o assistente"
        className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4"
      >
        {msgs.map((m, i) => (
          <div
            key={i}
            className={cn(
              "group flex",
              m.role === "user" ? "justify-end" : "justify-start"
            )}
          >
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
                  <MdLite texto={m.content || "…"} />
                ) : (
                  m.content
                )}
              </div>
              {/* ferramentas usadas + copy/retry — discretos, sempre no ar
                  (touch não tem hover) */}
              {m.role === "assistant" && m.content && !m.estado && (
                <div className="mt-1 flex items-center gap-2 pl-1">
                  <button
                    type="button"
                    onClick={() => copiar(i, m.content)}
                    aria-label="Copiar resposta"
                    className="inline-flex items-center gap-1 text-[11px] text-muted-foreground transition-colors hover:text-foreground"
                  >
                    {copiado === i ? <Check size={12} /> : <Copy size={12} />}
                    {copiado === i ? "Copiado" : "Copiar"}
                  </button>
                  {m.tools?.length ? (
                    <span className="text-[11px] text-muted-foreground/70">
                      fontes: {m.tools.join(", ")}
                    </span>
                  ) : null}
                </div>
              )}
              {m.estado === "erro" && (
                <div className="mt-1 pl-1">
                  <button
                    type="button"
                    onClick={tentarDeNovo}
                    className="inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground transition-colors hover:text-foreground"
                  >
                    <ArrowClockwise size={12} />
                    Tentar de novo
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}

        {/* bolha de espera: dots até o 1º token; linha de status durante
            as rodadas de tool */}
        {pending && (
          <div className="flex justify-start">
            <div className="rounded-2xl rounded-bl-md bg-muted/60 px-4 py-3 shadow-[var(--shadow-border)]">
              {status ? (
                <p className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="size-1.5 animate-pulse rounded-full bg-[var(--brand-lime-deep)]" />
                  {status}
                </p>
              ) : (
                <div
                  aria-label="O assistente está escrevendo"
                  className="flex items-center gap-1.5"
                >
                  {[0, 1, 2].map((d) => (
                    <span
                      key={d}
                      className="size-1.5 animate-pulse rounded-full bg-muted-foreground/60"
                      style={{ animationDelay: `${d * 180}ms` }}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* chips só antes da primeira pergunta — depois disso viram ruído */}
      <div className="space-y-2 px-4 pb-4 pt-1">
        {!configurado && !demo ? (
          <Card className="px-4 py-3 text-sm text-muted-foreground">
            O assistente está indisponível no momento — tente de novo em
            instantes.
          </Card>
        ) : (
          <>
            {primeiraMsg && (
              <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
                {chips.map((s) => (
                  <Button
                    key={s}
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={pending}
                    onClick={() => enviar(s)}
                    className="shrink-0 rounded-full text-xs font-normal text-muted-foreground"
                  >
                    {s}
                  </Button>
                ))}
              </div>
            )}
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
            <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <Sparkle aria-hidden />
              Respostas geradas por IA podem errar — confirme informações
              críticas.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
