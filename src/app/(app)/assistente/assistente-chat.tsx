"use client";

// Chat do assistente (design §1): transcript em useState — refresh limpa
// de propósito (LGPD: a conversa não persiste, o que fica é a ação em
// ia_eventos). Uma página própria, não drawer — Sheet não existe na lib.

import { useEffect, useRef, useState } from "react";
import { PaperPlaneRight, Sparkle } from "@phosphor-icons/react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import type { AppRole } from "@/lib/types";
import { cn } from "@/lib/utils";

type Msg = { role: "user" | "assistant"; content: string };

const BOAS_VINDAS =
  "Oi! Sou o assistente do Realiza. Posso ajudar com a sua operação ou com o que dizem os guias do programa.";

const DEMO_FALLBACK =
  "Na demonstração o assistente tem respostas de exemplo — no ambiente real ele responde com seus dados e guias oficiais.";

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
  return (
    DEMO_RESPOSTAS.find(([re]) => re.test(texto))?.[1] ?? DEMO_FALLBACK
  );
}

/** Sugestões por papel — só caminhos que as tools de hoje respondem
 *  (guias chegam com a fase RAG; sugerir antes disso é promessa quebrada). */
function sugestoes(papeis: AppRole[]): string[] {
  if (papeis.includes("coordenacao"))
    return [
      "Resumo da semana",
      "Quem está aguardando par?",
      "Capacidade dos mentores",
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
    "Minha dupla tem registros pendentes?",
    "Próximos encontros",
  ];
}

export function AssistenteChat({
  papeis,
  demo,
  configurado,
}: {
  papeis: AppRole[];
  demo: boolean;
  configurado: boolean;
}) {
  const [msgs, setMsgs] = useState<Msg[]>([
    { role: "assistant", content: BOAS_VINDAS },
  ]);
  const [texto, setTexto] = useState("");
  const [pending, setPending] = useState(false);
  const fimRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const chips = sugestoes(papeis);

  // rola pro fim a cada mensagem nova
  useEffect(() => {
    fimRef.current?.scrollIntoView({ block: "end" });
  }, [msgs, pending]);

  async function enviar(conteudo: string) {
    const limpo = conteudo.trim();
    if (!limpo || pending) return;
    const novas: Msg[] = [...msgs, { role: "user", content: limpo }];
    setMsgs(novas);
    setTexto("");
    setPending(true);

    if (demo) {
      // demo não chama provider nem API — resposta enlatada honesta
      await new Promise((r) => setTimeout(r, 500));
      setMsgs([...novas, { role: "assistant", content: respostaDemo(limpo) }]);
      setPending(false);
      inputRef.current?.focus();
      return;
    }

    try {
      const res = await fetch("/api/ia/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: novas }),
      });
      const data = (await res.json().catch(() => null)) as {
        message?: string;
        error?: string;
      } | null;
      const resposta =
        data?.message ??
        data?.error ??
        "Não consegui responder agora — tente de novo em instantes.";
      setMsgs([...novas, { role: "assistant", content: resposta }]);
      if (!res.ok) toast.error(resposta);
    } catch {
      const resposta =
        "Não consegui responder agora — tente de novo em instantes.";
      setMsgs([...novas, { role: "assistant", content: resposta }]);
      toast.error(resposta);
    }
    setPending(false);
    inputRef.current?.focus();
  }

  return (
    <div className="mt-5 flex min-h-0 flex-1 flex-col">
      {demo && (
        <p className="mb-3 rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">
          Na demonstração, o assistente responde com exemplos fixos.
        </p>
      )}

      {/* transcript — role=log + aria-live pro leitor de tela anunciar a
          resposta nova; a rolagem acompanha o fim */}
      <div
        role="log"
        aria-live="polite"
        aria-label="Conversa com o assistente"
        className="space-y-3"
      >
        {msgs.map((m, i) => (
          <div
            key={i}
            className={cn(
              "flex",
              m.role === "user" ? "justify-end" : "justify-start"
            )}
          >
            <div
              className={cn(
                "max-w-[75ch] rounded-2xl px-4 py-2.5 text-sm whitespace-pre-wrap",
                m.role === "user"
                  ? "rounded-br-md bg-[var(--brand-lime)] text-[var(--brand-ink)]"
                  : "rounded-bl-md bg-card text-card-foreground shadow-[var(--shadow-border)]"
              )}
            >
              {m.content}
            </div>
          </div>
        ))}
        {pending && (
          <div className="flex justify-start">
            <div
              aria-label="O assistente está escrevendo"
              className="flex items-center gap-1.5 rounded-2xl rounded-bl-md bg-card px-4 py-3 shadow-[var(--shadow-border)]"
            >
              {[0, 1, 2].map((d) => (
                <span
                  key={d}
                  className="size-1.5 animate-pulse rounded-full bg-muted-foreground/60"
                  style={{ animationDelay: `${d * 180}ms` }}
                />
              ))}
            </div>
          </div>
        )}
        <div ref={fimRef} />
      </div>

      <div className="flex-1" />

      {/* composer + chips — sticky acima da bottom-nav no mobile */}
      <div className="sticky bottom-0 mt-4 space-y-3 bg-background pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] md:bottom-4">
        {!configurado && !demo ? (
          <Card className="px-4 py-3 text-sm text-muted-foreground">
            O assistente está indisponível no momento — tente de novo em
            instantes.
          </Card>
        ) : (
          <>
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
                className="max-h-36 min-h-11 flex-1 resize-none"
              />
              <Button
                type="submit"
                size="icon"
                disabled={pending || !texto.trim()}
                aria-label="Enviar mensagem"
              >
                <PaperPlaneRight />
              </Button>
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
