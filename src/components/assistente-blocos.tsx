"use client";

// genUI v3 do assistente: os blocos interativos dos fences da convenção 5
// (spec/parse em lib/ia/render.ts).
//
//   Sugestoes      chips de continuação no fim da resposta (tocar envia)
//   Escolha        pergunta de esclarecimento com 2–5 opções
//   Rascunho       mensagem pronta, editável, com Copiar / Abrir no canal
//   Passos         roteiro com checkboxes locais e progresso "n de m"
//   Destaque       callout de dica / atenção / informação
//   BlocoSkeleton  placeholder do fence ainda aberto no stream, no
//                  tamanho do resultado (sem salto de layout ao fechar)
//   BlocoView      dispatcher de BlocoMd (gráfico reusa o GraficoBloco)
//
// Largura: a bolha vai de ~240px a ~640px (painel redimensionável), então
// cada bloco é @container e troca de layout pelo espaço real, não pela tela.
// Movimento: .animate-enter (stagger por --i) e transições de cor/scale;
// o guard global de reduced-motion zera tudo sem media query por aqui.

import {
  useEffect,
  useId,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
} from "react";
import Link from "next/link";
import {
  ArrowBendDownRight,
  ArrowCounterClockwise,
  BookOpen,
  ChatText,
  Check,
  CheckCircle,
  Copy,
  EnvelopeSimple,
  Info,
  Lightbulb,
  PencilSimple,
  WarningCircle,
  WhatsappLogo,
  type Icon,
} from "@phosphor-icons/react";
import { toast } from "sonner";
import type {
  BlocoDestaque,
  BlocoEscolha,
  BlocoKind,
  BlocoMd,
  BlocoPassos,
  BlocoRascunho,
} from "@/lib/ia/render";
import { waLink } from "@/lib/ciclo";
import { GraficoBloco } from "@/components/assistente-genui";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

const stagger = (i: number) => ({ "--i": i }) as CSSProperties;

// cartão-base dos blocos dentro da bolha (mesmo do GraficoBloco)
const CARD =
  "rounded-xl border border-border/70 bg-card shadow-[var(--shadow-border)]";

// mesma robustez do CodeBlock (assistente-genui): clipboard API e, sem
// permissão (webview/http), textarea + execCommand
async function copiarTexto(t: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(t);
    return true;
  } catch {
    try {
      const ta = document.createElement("textarea");
      ta.value = t;
      ta.style.cssText = "position:fixed;inset:0 auto auto 0;opacity:0";
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand("copy");
      ta.remove();
      return ok;
    } catch {
      return false;
    }
  }
}

// ---------- sugestões ----------

/** Chips de continuação no fim da resposta. Cada um envia o próprio texto;
 *  com a resposta ainda em stream ficam desabilitados (não dá pra mandar
 *  pergunta nova no meio). Raio de 1rem: pílula em uma linha, cantos
 *  suaves quando o texto quebra no estreito. */
export function Sugestoes({
  itens,
  onEnviar,
  desabilitado = false,
}: {
  itens: string[];
  onEnviar: (texto: string) => void;
  desabilitado?: boolean;
}) {
  if (!itens.length) return null;
  return (
    <div
      role="group"
      aria-label="Sugestões para continuar"
      className="flex flex-wrap gap-1.5"
    >
      {itens.map((t, i) => (
        <Button
          key={i}
          type="button"
          variant="outline"
          disabled={desabilitado}
          onClick={() => onEnviar(t)}
          style={stagger(i + 1)}
          className="animate-enter group/sug h-auto min-h-10 max-w-full justify-start gap-1.5 rounded-[1rem] bg-card py-1.5 pr-3 pl-2.5 text-left text-xs font-normal whitespace-normal text-muted-foreground shadow-[var(--shadow-border)] hover:border-foreground/25 hover:bg-card md:h-auto md:min-h-8"
        >
          <ArrowBendDownRight
            size={13}
            aria-hidden
            className="shrink-0 transition-transform duration-150 ease-snappy group-hover/sug:translate-x-0.5"
          />
          <span className="min-w-0">{t}</span>
        </Button>
      ))}
    </div>
  );
}

// ---------- escolha ----------

const igual = (a: string, b: string) =>
  a.trim().toLocaleLowerCase("pt-BR") === b.trim().toLocaleLowerCase("pt-BR");

/** Pergunta de esclarecimento: tocar numa opção envia `valor ?? rotulo`.
 *  Depois da escolha (ou com `respondida`, quando a conversa já seguiu) o
 *  bloco fecha: a opção marcada fica destacada e as outras desabilitadas.
 *  `resposta` (a mensagem do usuário que veio depois) reacende a marcação
 *  ao reabrir uma conversa salva, quando a escolha local já se perdeu.
 *  Estreito empilha as opções em largura cheia; com espaço, ficam em linha. */
export function Escolha({
  b,
  onEnviar,
  respondida = false,
  resposta,
  desabilitado = false,
}: {
  b: BlocoEscolha;
  onEnviar: (texto: string) => void;
  respondida?: boolean;
  resposta?: string;
  desabilitado?: boolean;
}) {
  const [escolhida, setEscolhida] = useState<number | null>(null);
  const idPergunta = useId();
  const valorDe = (o: BlocoEscolha["opcoes"][number]) => o.valor ?? o.rotulo;
  const marcada =
    escolhida ??
    (resposta
      ? b.opcoes.findIndex(
          (o) => igual(valorDe(o), resposta) || igual(o.rotulo, resposta)
        )
      : -1);
  const fechada = respondida || escolhida !== null;

  return (
    <div className="animate-enter @container">
      <p id={idPergunta} className="text-sm font-medium">
        {b.pergunta}
      </p>
      <div
        role="group"
        aria-labelledby={idPergunta}
        className="mt-2 flex flex-col gap-1.5 @sm:flex-row @sm:flex-wrap"
      >
        {b.opcoes.map((o, i) => {
          const sel = i === marcada;
          return (
            <Button
              key={i}
              type="button"
              variant="outline"
              disabled={fechada || desabilitado}
              aria-pressed={fechada ? sel : undefined}
              onClick={() => {
                setEscolhida(i);
                onEnviar(valorDe(o));
              }}
              style={stagger(i + 1)}
              className={cn(
                "animate-enter h-auto min-h-10 justify-start gap-2 px-3 py-1.5 text-left font-normal whitespace-normal md:h-auto md:min-h-8",
                sel
                  ? "border-primary bg-primary/10 font-medium text-foreground disabled:opacity-100"
                  : fechada
                    ? "border-border/60 bg-transparent text-muted-foreground disabled:opacity-60"
                    : "bg-card shadow-[var(--shadow-border)] hover:border-foreground/25 hover:bg-card"
              )}
            >
              {sel && (
                <Check
                  size={14}
                  weight="bold"
                  aria-hidden
                  className="shrink-0 animate-in zoom-in-50 duration-150"
                />
              )}
              <span className="min-w-0">{o.rotulo}</span>
            </Button>
          );
        })}
      </div>
    </div>
  );
}

// ---------- rascunho ----------

const CANAL: Record<
  BlocoRascunho["canal"],
  { Icone: Icon; rotulo: string }
> = {
  whatsapp: { Icone: WhatsappLogo, rotulo: "WhatsApp" },
  email: { Icone: EnvelopeSimple, rotulo: "E-mail" },
  texto: { Icone: ChatText, rotulo: "Mensagem" },
};

/** Link de envio do canal com o texto editado. WhatsApp sem número abre o
 *  compartilhar do wa.me (a pessoa escolhe o contato lá); e-mail só leva
 *  destinatário quando `para` é um endereço (o modelo costuma mandar nome). */
function linkCanal(
  b: BlocoRascunho,
  texto: string,
  assunto: string,
  telefone?: string | null
): string | null {
  if (b.canal === "whatsapp")
    return (
      waLink(telefone ?? b.numero, texto) ??
      `https://wa.me/?text=${encodeURIComponent(texto)}`
    );
  if (b.canal === "email") {
    const para = b.para?.includes("@") ? b.para : "";
    const q = [
      assunto && `subject=${encodeURIComponent(assunto)}`,
      `body=${encodeURIComponent(texto)}`,
    ]
      .filter(Boolean)
      .join("&");
    return `mailto:${encodeURIComponent(para)}?${q}`;
  }
  return null;
}

/** Mensagem pronta pra mandar. "Editar" troca a prévia por um textarea
 *  que cresce com o texto (cópia local; o original volta com "Desfazer").
 *  Um botão cheio por cartão: o envio pelo canal, ou Copiar no canal
 *  "texto". Escape no textarea sai da edição e devolve o foco. */
export function Rascunho({
  b,
  telefone,
}: {
  b: BlocoRascunho;
  /** WhatsApp do destinatário, quando a tela sabe (senão abre o compartilhar) */
  telefone?: string | null;
}) {
  const [texto, setTexto] = useState(b.texto);
  const [assunto, setAssunto] = useState(b.assunto ?? "");
  const [editando, setEditando] = useState(false);
  const [copiado, setCopiado] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const campo = useRef<HTMLTextAreaElement>(null);
  const botaoEditar = useRef<HTMLButtonElement>(null);
  const idTitulo = useId();

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    []
  );

  // entrar na edição: foco com o cursor no fim (autoFocus deixa no início)
  useEffect(() => {
    const el = campo.current;
    if (!editando || !el) return;
    el.focus();
    el.setSelectionRange(el.value.length, el.value.length);
  }, [editando]);

  const { Icone, rotulo } = CANAL[b.canal];
  const vazio = !texto.trim();
  const editado = texto !== b.texto || assunto !== (b.assunto ?? "");
  const href = vazio ? null : linkCanal(b, texto.trim(), assunto.trim(), telefone);
  const semNumero =
    b.canal === "whatsapp" && !waLink(telefone ?? b.numero, "x");

  async function copiar() {
    const ok = await copiarTexto(texto.trim());
    if (!ok) {
      toast.error("Não consegui copiar. Selecione o texto e copie à mão.");
      return;
    }
    setCopiado(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopiado(false), 1600);
  }

  function sairDaEdicao() {
    setEditando(false);
    botaoEditar.current?.focus();
  }

  // Escape sai só da edição: stopPropagation segura o Escape antes de
  // chegar no painel/sheet do assistente (que fecharia junto)
  function escapeSai(e: KeyboardEvent) {
    if (e.key !== "Escape") return;
    e.preventDefault();
    e.stopPropagation();
    sairDaEdicao();
  }

  return (
    <section
      aria-labelledby={idTitulo}
      className={cn("animate-enter @container overflow-hidden", CARD)}
    >
      <header className="flex items-start gap-2.5 px-3 pt-2.5">
        <span
          aria-hidden
          className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground"
        >
          <Icone size={16} />
        </span>
        <div className="min-w-0 flex-1">
          <p id={idTitulo} className="text-sm font-semibold">
            {b.para ? `Rascunho para ${b.para}` : "Rascunho de mensagem"}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {rotulo}
            {semNumero && " · você escolhe o contato ao abrir"}
            {editado && " · editado"}
          </p>
        </div>
        <Button
          ref={botaoEditar}
          type="button"
          variant="ghost"
          aria-pressed={editando}
          onClick={() => (editando ? sairDaEdicao() : setEditando(true))}
          className="-mr-1 text-muted-foreground"
        >
          {editando ? (
            <Check weight="bold" aria-hidden />
          ) : (
            <PencilSimple aria-hidden />
          )}
          {editando ? "Concluir" : "Editar"}
        </Button>
      </header>

      <div className="space-y-2 px-3 pt-2 pb-3">
        {b.canal === "email" && (assunto || editando) ? (
          editando ? (
            <Input
              aria-label="Assunto do e-mail"
              placeholder="Assunto"
              value={assunto}
              onChange={(e) => setAssunto(e.target.value)}
              onKeyDown={escapeSai}
            />
          ) : (
            <p className="text-sm">
              <span className="mr-1.5 text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
                Assunto
              </span>
              <span className="font-medium">{assunto}</span>
            </p>
          )
        ) : null}
        {editando ? (
          <Textarea
            ref={campo}
            aria-label="Texto da mensagem"
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            onKeyDown={escapeSai}
            className="scroll-fina max-h-80 leading-relaxed"
          />
        ) : (
          // prévia legível da mensagem: quebras do modelo preservadas
          <p className="text-sm leading-relaxed whitespace-pre-wrap [overflow-wrap:anywhere]">
            {texto || (
              <span className="text-muted-foreground">Mensagem vazia.</span>
            )}
          </p>
        )}
      </div>

      {/* estreito: botões em largura cheia, o cheio em cima (col-reverse);
          com espaço: linha à direita, o cheio por último */}
      <footer className="flex flex-col-reverse gap-1.5 border-t border-border/60 px-3 py-2.5 @xs:flex-row @xs:items-center @xs:justify-end">
        {editado && (
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              setTexto(b.texto);
              setAssunto(b.assunto ?? "");
            }}
            className="text-muted-foreground @xs:mr-auto"
          >
            <ArrowCounterClockwise aria-hidden />
            Desfazer edição
          </Button>
        )}
        <Button
          type="button"
          variant={b.canal === "texto" ? "default" : "outline"}
          disabled={vazio}
          onClick={copiar}
          aria-label={copiado ? "Copiado" : "Copiar mensagem"}
        >
          {copiado ? (
            <Check
              weight="bold"
              aria-hidden
              className={cn(
                "animate-in zoom-in-50 duration-150",
                b.canal !== "texto" && "text-[var(--ok)]"
              )}
            />
          ) : (
            <Copy aria-hidden />
          )}
          {copiado ? "Copiado" : "Copiar"}
        </Button>
        {b.canal !== "texto" && (
          <a
            href={href ?? undefined}
            aria-disabled={!href || undefined}
            {...(b.canal === "whatsapp"
              ? { target: "_blank", rel: "noopener noreferrer" }
              : {})}
            className={cn(
              buttonVariants({ variant: "default" }),
              !href && "pointer-events-none opacity-50"
            )}
          >
            <Icone aria-hidden />
            {b.canal === "whatsapp" ? "Abrir no WhatsApp" : "Abrir no e-mail"}
          </a>
        )}
        <span aria-live="polite" className="sr-only">
          {copiado ? "Mensagem copiada" : ""}
        </span>
      </footer>
    </section>
  );
}

// ---------- passos ----------

/** Roteiro dos guias com checkbox por passo (estado local, não persiste).
 *  O quadrado mostra o número do passo e vira check ao marcar; feito fica
 *  riscado e esmaecido, sem sumir. Tudo feito: o cartão ganha o amarelo
 *  de celebração da marca e uma linha curta, sem festa. */
export function Passos({ b }: { b: BlocoPassos }) {
  const [feitos, setFeitos] = useState<boolean[]>(() =>
    b.itens.map(() => false)
  );
  const idTitulo = useId();
  const n = feitos.filter(Boolean).length;
  const m = b.itens.length;
  const completo = n === m;

  return (
    <section
      aria-labelledby={idTitulo}
      className={cn(
        "animate-enter overflow-hidden transition-[background-color,border-color] duration-300 ease-snappy",
        CARD,
        completo && "border-[var(--destaque-borda)] bg-[var(--destaque-suave)]"
      )}
    >
      <header className="px-3 pt-2.5">
        <div className="flex items-baseline justify-between gap-3">
          <p id={idTitulo} className="text-sm font-semibold">
            {b.titulo ?? "Passo a passo"}
          </p>
          <p className="shrink-0 text-xs text-muted-foreground tabular-nums">
            {n} de {m}
            <span className="sr-only"> passos feitos</span>
          </p>
        </div>
        <div
          aria-hidden
          className="mt-2 h-1 overflow-hidden rounded-full bg-muted"
        >
          {/* scaleX em vez de width: sem reflow a cada marcação */}
          <div
            className="h-full origin-left rounded-full bg-[var(--ok)] transition-transform duration-300 ease-snappy"
            style={{ transform: `scaleX(${n / m})` }}
          />
        </div>
      </header>

      <ol className="mt-1 divide-y divide-border/60 px-3">
        {b.itens.map((p, i) => {
          const feito = feitos[i];
          return (
            <li key={i} className="animate-enter" style={stagger(i + 1)}>
              {/* checkbox nativo + label: teclado e clique no texto de graça;
                  o quadrado é só a representação (padrão do jovem-combinados) */}
              <label className="group/passo flex min-h-10 cursor-pointer items-start gap-2.5 py-2.5">
                <input
                  type="checkbox"
                  className="peer sr-only"
                  checked={feito}
                  onChange={() =>
                    setFeitos((f) => f.map((v, j) => (j === i ? !v : v)))
                  }
                />
                <span
                  aria-hidden
                  className={cn(
                    "mt-px grid size-5 shrink-0 place-items-center rounded-md border text-[11px] font-semibold tabular-nums transition-[color,background-color,border-color] duration-150 ease-snappy peer-focus-visible:ring-2 peer-focus-visible:ring-ring peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-card",
                    feito
                      ? "border-[var(--ok-text)] bg-[var(--ok-text)] text-[var(--status-foreground)]"
                      : "border-muted-foreground/40 text-muted-foreground group-hover/passo:border-foreground group-hover/passo:text-foreground"
                  )}
                >
                  {feito ? (
                    <Check
                      size={12}
                      weight="bold"
                      className="animate-in zoom-in-50 duration-150"
                    />
                  ) : (
                    i + 1
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span
                    className={cn(
                      "block text-sm transition-colors duration-150",
                      feito &&
                        "text-muted-foreground line-through decoration-muted-foreground/50"
                    )}
                  >
                    {p.texto}
                  </span>
                  {p.detalhe && (
                    <span className="mt-0.5 block text-xs text-muted-foreground">
                      {p.detalhe}
                    </span>
                  )}
                </span>
              </label>
            </li>
          );
        })}
      </ol>

      {completo && (
        <p className="animate-enter flex items-center gap-1.5 border-t border-[var(--destaque-borda)]/60 px-3 py-2 text-xs font-medium">
          <CheckCircle
            size={15}
            weight="fill"
            aria-hidden
            className="shrink-0 text-[var(--ok-text)]"
          />
          Tudo feito. Bom trabalho!
        </p>
      )}
      <span aria-live="polite" className="sr-only">
        {completo ? "Todos os passos feitos" : ""}
      </span>
    </section>
  );
}

// ---------- destaque ----------

const TOM: Record<
  BlocoDestaque["tom"],
  { Icone: Icon; rotulo: string; caixa: string; disco: string; titulo: string }
> = {
  // amarelo = dica/próximo passo, nunca alerta; o disco cheio usa a tinta
  // constante (--destaque-foreground), legível nos dois temas
  dica: {
    Icone: Lightbulb,
    rotulo: "Dica",
    caixa: "border-[var(--destaque-borda)] bg-[var(--destaque-suave)]",
    disco: "bg-[var(--destaque)] text-[var(--destaque-foreground)]",
    titulo: "text-foreground",
  },
  atencao: {
    Icone: WarningCircle,
    rotulo: "Atenção",
    caixa: "border-[var(--warn-border)] bg-[var(--warn-bg)]",
    disco: "bg-[var(--warn)] text-[var(--status-foreground)]",
    titulo: "text-[var(--warn-text)]",
  },
  info: {
    Icone: Info,
    rotulo: "Informação",
    caixa: "border-[var(--info-border)] bg-[var(--info-bg)]",
    disco: "bg-[var(--info)] text-[var(--status-foreground)]",
    titulo: "text-[var(--info-text)]",
  },
};

/** Callout de dica / atenção / informação. O tom nunca fica só na cor:
 *  ícone próprio + rótulo (visível como título quando o modelo não manda
 *  um; sr-only antes do título quando manda). Fonte = guia em /materiais. */
export function Destaque({ b }: { b: BlocoDestaque }) {
  const t = TOM[b.tom];
  return (
    <aside
      role="note"
      className={cn(
        "animate-enter flex items-start gap-2.5 rounded-xl border px-3 py-2.5",
        t.caixa
      )}
    >
      <span
        aria-hidden
        className={cn(
          "mt-px grid size-6 shrink-0 place-items-center rounded-full",
          t.disco
        )}
      >
        <t.Icone size={14} weight="bold" />
      </span>
      <div className="min-w-0 flex-1">
        <p className={cn("text-sm font-semibold", t.titulo)}>
          {b.titulo ? (
            <>
              <span className="sr-only">{t.rotulo}: </span>
              {b.titulo}
            </>
          ) : (
            t.rotulo
          )}
        </p>
        <p className="mt-0.5 text-sm leading-relaxed text-foreground">
          {b.texto}
        </p>
        {b.fonte && (
          <Link
            href={b.fonte.href}
            className="mt-1.5 inline-flex items-center gap-1 text-xs font-medium text-foreground underline decoration-foreground/30 underline-offset-2 transition-[text-decoration-color] hover:decoration-foreground"
          >
            <BookOpen size={13} aria-hidden className="shrink-0" />
            {b.fonte.rotulo}
          </Link>
        )}
      </div>
    </aside>
  );
}

// ---------- skeleton ----------

// alturas casam com o resultado: Button/chip = h-10 no toque, h-8 no md
const SK_BOTAO = "h-10 md:h-8";

/** Placeholder do fence ainda aberto no stream. Cada forma aproxima a
 *  altura final do bloco pra que o resultado entre sem empurrar a bolha.
 *  Shimmer do Skeleton (loading transitório, único loop permitido); com
 *  reduced-motion o guard global deixa o placeholder parado. */
export function BlocoSkeleton({ kind }: { kind: BlocoKind }) {
  return (
    <div role="status" className="@container">
      <span className="sr-only">Montando conteúdo…</span>
      <div aria-hidden>{formaSkeleton(kind)}</div>
    </div>
  );
}

function formaSkeleton(kind: BlocoKind) {
  switch (kind) {
    case "stats":
      // mesmo grid do StatCards da bolha
      return (
        <div className="grid grid-cols-[repeat(auto-fit,minmax(7rem,1fr))] gap-1.5">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-[60px] rounded-lg" />
          ))}
        </div>
      );
    case "sugestoes":
      return (
        <div className="flex flex-wrap gap-1.5">
          <Skeleton className={cn(SK_BOTAO, "w-36 rounded-[1rem]")} />
          <Skeleton className={cn(SK_BOTAO, "w-44 rounded-[1rem]")} />
        </div>
      );
    case "grafico":
      // proporção do viewBox das barras (300×148): acompanha a largura
      return (
        <div className={cn(CARD, "px-3 py-2.5")}>
          <Skeleton className="h-3 w-28" />
          <div className="mt-2 flex aspect-[300/148] items-end gap-[6%] px-[5%] pb-[7%]">
            {[45, 75, 55, 90, 35].map((h, i) => (
              <Skeleton
                key={i}
                className="flex-1 rounded-sm"
                style={{ height: `${h}%` }}
              />
            ))}
          </div>
        </div>
      );
    case "escolha":
      return (
        <div>
          <Skeleton className="h-4 w-3/4" />
          <div className="mt-2 flex flex-col gap-1.5 @sm:flex-row">
            {["@sm:w-28", "@sm:w-24", "@sm:w-32"].map((w, i) => (
              <Skeleton key={i} className={cn(SK_BOTAO, "rounded-lg", w)} />
            ))}
          </div>
        </div>
      );
    case "rascunho":
      return (
        <div className={cn(CARD, "overflow-hidden")}>
          <div className="flex items-start gap-2.5 px-3 pt-2.5">
            <Skeleton className="mt-0.5 size-8 rounded-lg" />
            <div className="flex-1 space-y-1.5 pt-0.5">
              <Skeleton className="h-3.5 w-40 max-w-full" />
              <Skeleton className="h-3 w-20" />
            </div>
          </div>
          <div className="space-y-2 px-3 pt-3.5 pb-4">
            {["w-full", "w-11/12", "w-full", "w-2/3"].map((w, i) => (
              <Skeleton key={i} className={cn("h-3", w)} />
            ))}
          </div>
          <div className="flex flex-col gap-1.5 border-t border-border/60 px-3 py-2.5 @xs:flex-row @xs:justify-end">
            <Skeleton className={cn(SK_BOTAO, "rounded-lg @xs:w-24")} />
            <Skeleton className={cn(SK_BOTAO, "rounded-lg @xs:w-40")} />
          </div>
        </div>
      );
    case "passos":
      return (
        <div className={cn(CARD, "px-3 pt-2.5 pb-1")}>
          <div className="flex justify-between gap-3">
            <Skeleton className="h-3.5 w-32" />
            <Skeleton className="h-3 w-10" />
          </div>
          <Skeleton className="mt-2.5 h-1 rounded-full" />
          <div className="mt-1 divide-y divide-border/60">
            {["w-4/5", "w-3/5", "w-2/3"].map((w, i) => (
              <div key={i} className="flex items-center gap-2.5 py-3">
                <Skeleton className="size-5 rounded-md" />
                <Skeleton className={cn("h-3", w)} />
              </div>
            ))}
          </div>
        </div>
      );
    case "destaque":
      return (
        <div className="flex items-start gap-2.5 rounded-xl border border-border/60 px-3 py-2.5">
          <Skeleton className="size-6 rounded-full" />
          <div className="flex-1 space-y-2 pt-1">
            <Skeleton className="h-3.5 w-24" />
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-3/5" />
          </div>
        </div>
      );
  }
}

// ---------- dispatcher ----------

/** Um bloco inline (MARCA_BLOCO) da resposta. `respondida` = já existe
 *  mensagem do usuário depois desta resposta; `streaming` = a resposta
 *  ainda está chegando (Escolha fica desabilitada até fechar). */
export function BlocoView({
  bloco,
  onEnviar,
  respondida = false,
  streaming = false,
  resposta,
  telefone,
}: {
  bloco: BlocoMd;
  onEnviar: (texto: string) => void;
  respondida?: boolean;
  streaming?: boolean;
  /** conteúdo da mensagem do usuário seguinte (marca a opção escolhida) */
  resposta?: string;
  /** WhatsApp do destinatário do rascunho, quando conhecido */
  telefone?: string | null;
}) {
  switch (bloco.kind) {
    case "grafico":
      return <GraficoBloco g={bloco.g} />;
    case "escolha":
      return (
        <Escolha
          b={bloco.b}
          onEnviar={onEnviar}
          respondida={respondida}
          resposta={resposta}
          desabilitado={streaming}
        />
      );
    case "rascunho":
      return <Rascunho b={bloco.b} telefone={telefone} />;
    case "passos":
      return <Passos b={bloco.b} />;
    case "destaque":
      return <Destaque b={bloco.b} />;
  }
}
