"use client";

// Detalhe do chamado (o artigo master-detail): cabeçalho com a ação do
// estado, trilha da conversa e composers da equipe e do autor. Extraído do
// chamados-app pra que a ficha do jovem (jovem-chamados) não baixe a fila
// inteira do staff.

import {
  Fragment,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  useTransition,
  type ChangeEvent,
  type KeyboardEvent,
} from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  ArrowLeft,
  ArrowSquareOut,
  CaretDown,
  Check,
  CheckCircle,
  CircleNotch,
  DotsThreeVertical,
  Lock,
  Paperclip,
  Sparkle,
  X,
} from "@phosphor-icons/react";
import { toast } from "sonner";
import type {
  ChamadoAnexo,
  ChamadoFilaItem,
  ChamadoTimelineItem,
} from "@/lib/types";
import { formatDiaMes, formatTamanho, papelLabel } from "@/lib/ciclo";
import {
  acrescentarInfoChamado,
  assumirChamado,
  atribuirChamado,
  comentarChamado,
  devolverChamadoFila,
  pedirReaberturaChamado,
  publicarAtualizacaoChamado,
  reabrirChamado,
  resolverChamado,
} from "@/lib/actions-chamados";
import { cn, normaliza } from "@/lib/utils";
import { EASE } from "@/components/motion";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Avatar } from "@/components/avatar";
import {
  AnexoThumb,
  AnexosPendentes,
  ChamadoAnexos,
  ROTULO_ANEXO,
  tipoAnexo,
  useAnexosPendentes,
} from "@/components/chamado-anexos";
import {
  ChamadoStatusBadge,
  UrgenciaMarca,
  primeiroNome,
  relTempo,
  type Equipe,
  type EquipeLinha,
} from "@/components/chamados-shared";

type Papel = string;

const ITEM_MENU = "min-h-11 px-2.5 md:min-h-8";

export function ChamadoDetalhe({
  papel,
  meuId,
  chamado,
  timeline,
  equipe,
  onVoltar,
  voltarDesktop,
}: {
  papel: Papel;
  meuId: string;
  meuNome: string;
  chamado: ChamadoFilaItem;
  timeline: ChamadoTimelineItem[];
  equipe: Equipe;
  onVoltar: () => void;
  /** O voltar some no desktop quando a lista continua visível ao lado
   *  (master-detail do staff). Onde o detalhe SUBSTITUI a lista (autor),
   *  ele fica sempre — senão vira beco sem saída. */
  voltarDesktop?: boolean;
}) {
  const [pending, start] = useTransition();
  const staff = papel === "coordenacao" || papel === "supervisor";
  const coord = papel === "coordenacao";
  const souDono = chamado.atribuido_a === meuId;
  const resolvido = chamado.status === "resolvido";
  const podeTratar = !chamado.restrito && !resolvido;
  const [resolveOpen, setResolveOpen] = useState(false);
  const [atribuirOpen, setAtribuirOpen] = useState(false);
  const [resumo, setResumo] = useState("");
  const [para, setPara] = useState<string>(chamado.atribuido_a ?? "");
  /** "acabou de chegar" por identidade, não por janela de relógio: no envio
   *  a gente fotografa os ids da trilha — o que volta da action com id fora
   *  da foto (o item postado, ou algo que chegou junto) entra com animação
   *  + chip "agora". A foto expira em ~5s pra não eternizar. */
  const [fotoTrilha, setFotoTrilha] = useState<Set<string> | null>(null);
  const timerMarca = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (timerMarca.current) clearTimeout(timerMarca.current);
    },
    []
  );

  function registrarEnvio() {
    setFotoTrilha(new Set(timeline.map((t) => t.item.id)));
    if (timerMarca.current) clearTimeout(timerMarca.current);
    timerMarca.current = setTimeout(() => setFotoTrilha(null), 5000);
  }

  // as actions revalidam /chamados (e o perfil do jovem): a resposta já
  // traz a página re-renderizada, sem router.refresh() extra
  function acao(fn: () => Promise<{ ok?: boolean; error?: string }>, okMsg: string) {
    start(async () => {
      const r = await fn();
      if (r.error) toast.error(r.error);
      else toast.success(okMsg);
    });
  }

  const autorPrimeiro = chamado.autor_nome
    ? primeiroNome(chamado.autor_nome)
    : null;

  // uma ação principal por estado; o resto mora no ⋯
  type Acao = { rotulo: string; run: () => void };
  const assumir: Acao = {
    rotulo: chamado.atribuido_nome && !souDono
      ? `Assumir de ${primeiroNome(chamado.atribuido_nome)}`
      : "Assumir",
    run: () => acao(() => assumirChamado(chamado.id), "Chamado assumido. Agora é com você."),
  };
  const resolver: Acao = { rotulo: "Resolver", run: () => setResolveOpen(true) };
  const reabrir: Acao = {
    rotulo: "Reabrir",
    run: () => acao(() => reabrirChamado(chamado.id), "Chamado reaberto."),
  };
  const atribuir: Acao = { rotulo: "Atribuir…", run: () => setAtribuirOpen(true) };
  const devolver: Acao = {
    rotulo: "Devolver à fila",
    run: () => acao(() => devolverChamadoFila(chamado.id), "Chamado devolvido à fila."),
  };

  let principal: Acao | null = null;
  const extras: Acao[] = [];
  if (staff && !chamado.restrito) {
    if (resolvido) {
      principal = reabrir;
    } else {
      const podeResolver = souDono || coord;
      if (!chamado.atribuido_a) principal = assumir;
      else if (podeResolver) principal = resolver;
      else if (coord) principal = assumir;
      if (coord && chamado.atribuido_a && !souDono && principal !== assumir)
        extras.push(assumir);
      if (podeResolver && principal !== resolver) extras.push(resolver);
      if (coord) extras.push(atribuir);
      if ((souDono || coord) && chamado.atribuido_a) extras.push(devolver);
    }
  }

  const meta = [
    staff ? chamado.autor_nome : null,
    // pro jovem a dupla é ele mesmo, o contexto só repetiria o nome dele
    papel === "mentorado" ? null : chamado.contexto,
    `aberto ${formatDiaMes(chamado.created_at)}`,
    chamado.numero,
  ].filter(Boolean);

  return (
    <article className="min-w-0 overflow-hidden rounded-xl bg-card shadow-[var(--shadow-border)]">
      <header className="border-b border-border px-4 pb-4 pt-3 sm:px-5">
        <div className="flex min-h-11 items-center gap-2 md:min-h-9">
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={onVoltar}
            aria-label="Voltar para a lista"
            className={cn(
              "-ml-2 shrink-0 text-muted-foreground",
              voltarDesktop ? "" : "lg:hidden"
            )}
          >
            <ArrowLeft aria-hidden />
          </Button>
          <ChamadoStatusBadge
            status={chamado.status}
            dono={chamado.restrito ? null : chamado.atribuido_nome}
            souDono={souDono}
            restrito={chamado.restrito}
            visao={staff ? "staff" : "autor"}
          />
          {chamado.categoria === "urgencia" && <UrgenciaMarca />}
          <div className="ml-auto flex shrink-0 items-center gap-1">
            {principal && (
              <Button
                size="sm"
                // reabrir é exceção, não o próximo passo: sem lima
                variant={principal === reabrir ? "outline" : "default"}
                disabled={pending}
                onClick={principal.run}
              >
                {pending && <CircleNotch className="animate-spin" aria-hidden />}
                {principal.rotulo}
              </Button>
            )}
            {extras.length > 0 && (
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Mais ações"
                      disabled={pending}
                      className="text-muted-foreground"
                    />
                  }
                >
                  <DotsThreeVertical weight="bold" aria-hidden />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  {extras.map((a) => (
                    <DropdownMenuItem
                      key={a.rotulo}
                      className={ITEM_MENU}
                      onClick={a.run}
                    >
                      {a.rotulo}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>
        <h2 className="mt-2 break-words text-lg font-semibold leading-snug tracking-tight text-balance">
          {chamado.restrito ? "Restrito à coordenação" : chamado.assunto}
        </h2>
        <p className="mt-1 text-xs text-muted-foreground">
          {meta.map((m, i) => (
            <Fragment key={i}>
              {i > 0 && " · "}
              <span className="whitespace-nowrap">{m}</span>
            </Fragment>
          ))}
        </p>
      </header>

      {chamado.restrito ? (
        <p className="flex items-start gap-2 px-4 py-6 text-sm text-muted-foreground sm:px-5">
          <Lock size={15} aria-hidden className="mt-0.5 shrink-0" />
          Chamados de plataforma ficam só com a coordenação.
        </p>
      ) : (
        <Trilha
          chamado={chamado}
          timeline={timeline}
          meuId={meuId}
          staff={staff}
          fotoTrilha={fotoTrilha}
        />
      )}

      {/* resolução visível pra todos — a resposta final fecha a conversa */}
      {resolvido && chamado.resolucao_resumo && (
        <div className="border-t border-border bg-[var(--ok)]/10 px-4 py-3.5 text-sm sm:px-5">
          <p className="flex items-center gap-1.5 font-medium text-[var(--ok-text)]">
            <CheckCircle size={15} aria-hidden />
            Resolvido
            {chamado.resolvido_em && (
              <span className="font-normal text-muted-foreground">
                · {formatDiaMes(chamado.resolvido_em)}
              </span>
            )}
          </p>
          <p className="mt-1 break-words leading-relaxed">{chamado.resolucao_resumo}</p>
        </div>
      )}

      {staff && podeTratar && (
        <ChamadoComposer
          chamadoId={chamado.id}
          equipe={equipe}
          meuId={meuId}
          autorId={chamado.autor_id}
          autorPrimeiro={autorPrimeiro}
          pending={pending}
          onEnviou={registrarEnvio}
        />
      )}
      {!staff &&
        (resolvido ? (
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border px-4 py-3.5 sm:px-5">
            <p className="text-sm text-muted-foreground">
              Ainda precisa de ajuda com isso?
            </p>
            <Button
              variant="outline"
              size="sm"
              disabled={pending}
              onClick={() =>
                acao(
                  () => pedirReaberturaChamado(chamado.id),
                  "Pedido enviado. A equipe retoma o chamado."
                )
              }
            >
              Pedir reabertura
            </Button>
          </div>
        ) : (
          <AutorComposer
            chamadoId={chamado.id}
            meuId={meuId}
            pending={pending}
            onEnviou={registrarEnvio}
          />
        ))}

      <Dialog
        open={resolveOpen}
        onOpenChange={(o) => {
          setResolveOpen(o);
          if (!o) setResumo(""); // fechar (ou resolver) larga o rascunho
        }}
      >
        <DialogContent size="md">
          <DialogHeader>
            <DialogTitle>Resolver chamado</DialogTitle>
            <DialogDescription>
              {autorPrimeiro
                ? `${autorPrimeiro} recebe este resumo como resposta final.`
                : "O autor recebe este resumo como resposta final."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="resumo-resolucao">Resumo</Label>
            <Textarea
              id="resumo-resolucao"
              value={resumo}
              onChange={(e) => setResumo(e.target.value)}
              rows={3}
              maxLength={1000}
              placeholder="Ex.: conversei com o mentor e o encontro foi para quinta."
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResolveOpen(false)}>
              Cancelar
            </Button>
            <Button
              disabled={pending || resumo.trim().length < 2}
              onClick={() => {
                acao(() => resolverChamado(chamado.id, resumo), "Chamado resolvido.");
                setResolveOpen(false);
              }}
            >
              Marcar como resolvido
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={atribuirOpen}
        onOpenChange={(o) => {
          setAtribuirOpen(o);
          // abre espelhando o dono real, não uma seleção abandonada
          setPara(chamado.atribuido_a ?? "");
        }}
      >
        <DialogContent size="md">
          <DialogHeader>
            <DialogTitle>Atribuir chamado</DialogTitle>
          </DialogHeader>
          <Select
            value={para}
            items={Object.fromEntries(equipe.map((p) => [p.id, p.nome_social || p.nome]))}
            onValueChange={(v) => setPara(v ?? "")}
          >
            <SelectTrigger aria-label="Responsável" className="w-full">
              <SelectValue placeholder="Escolha quem vai cuidar" />
            </SelectTrigger>
            <SelectContent>
              {equipe.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.nome_social || p.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAtribuirOpen(false)}>
              Cancelar
            </Button>
            <Button
              disabled={pending || !para || para === chamado.atribuido_a}
              onClick={() => {
                acao(() => atribuirChamado(chamado.id, para), "Chamado atribuído.");
                setAtribuirOpen(false);
              }}
            >
              Atribuir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </article>
  );
}

// ---------- trilha ----------

type BlocoTrilha =
  | { tipo: "item"; entry: ChamadoTimelineItem }
  | { tipo: "eventos"; entries: ChamadoTimelineItem[] };

/** Eventos automáticos seguidos viram um bloco só ("3 atualizações") — a
 *  conversa humana fica em primeiro plano. Um evento sozinho segue inline. */
function agrupar(timeline: ChamadoTimelineItem[]): BlocoTrilha[] {
  const out: BlocoTrilha[] = [];
  let run: ChamadoTimelineItem[] = [];
  const fecha = () => {
    if (run.length >= 2) out.push({ tipo: "eventos", entries: run });
    else if (run.length === 1) out.push({ tipo: "item", entry: run[0] });
    run = [];
  };
  for (const t of timeline) {
    if (t.tipo === "sistema") run.push(t);
    else {
      fecha();
      out.push({ tipo: "item", entry: t });
    }
  }
  fecha();
  return out;
}

function Trilha({
  chamado,
  timeline,
  meuId,
  staff,
  fotoTrilha,
}: {
  chamado: ChamadoFilaItem;
  timeline: ChamadoTimelineItem[];
  meuId: string;
  staff: boolean;
  fotoTrilha: Set<string> | null;
}) {
  const blocos = useMemo(() => {
    // a caixa verde de resolução já mostra "Resolvido" + o resumo — o
    // evento de sistema que a RPC grava ("Chamado resolvido — …") sai da
    // conversa pra não contar duas vezes. Só o mais recente: uma
    // resolução anterior de ciclo reaberto segue no histórico.
    let tl = timeline;
    if (chamado.status === "resolvido" && chamado.resolucao_resumo) {
      for (let i = tl.length - 1; i >= 0; i--) {
        const t = tl[i];
        if (t.tipo === "sistema" && t.item.texto.startsWith("Chamado resolvido")) {
          tl = [...tl.slice(0, i), ...tl.slice(i + 1)];
          break;
        }
      }
    }
    return agrupar(tl);
  }, [timeline, chamado.status, chamado.resolucao_resumo]);
  const recente = (id: string) => fotoTrilha !== null && !fotoTrilha.has(id);
  const vazio = !chamado.mensagem && blocos.length === 0;

  return (
    <ol className="space-y-4 px-4 py-4 sm:px-5" aria-label="Conversa">
      {/* o pedido que abriu o chamado é a primeira mensagem da conversa */}
      {chamado.mensagem && (
        <li>
          <Mensagem
            autor={chamado.autor_nome ?? "Autor"}
            souEu={!!chamado.autor_id && chamado.autor_id === meuId}
            quando={chamado.created_at}
            texto={chamado.mensagem}
          />
        </li>
      )}
      {blocos.map((b) =>
        b.tipo === "eventos" ? (
          <GrupoEventos
            key={`g-${b.entries[0].item.id}`}
            entries={b.entries}
            recente={recente}
          />
        ) : (
          <TimelineItem
            key={`${b.entry.tipo}-${b.entry.item.id}`}
            entry={b.entry}
            meuId={meuId}
            staff={staff}
            recente={recente(b.entry.item.id)}
          />
        )
      )}
      {vazio && (
        <li className="py-4 text-center text-sm text-muted-foreground">
          A conversa começa quando a equipe responder.
        </li>
      )}
    </ol>
  );
}

function GrupoEventos({
  entries,
  recente,
}: {
  entries: ChamadoTimelineItem[];
  recente: (id: string) => boolean;
}) {
  const [aberto, setAberto] = useState(false);
  const id = useId();
  const ultimo = entries[entries.length - 1];
  return (
    <li>
      <Button
        variant="ghost"
        size="sm"
        aria-expanded={aberto}
        aria-controls={id}
        onClick={() => setAberto((v) => !v)}
        className="-ml-2.5 text-xs font-normal text-muted-foreground"
      >
        <Sparkle aria-hidden />
        {entries.length} atualizações
        <span aria-hidden>·</span>
        <time dateTime={ultimo.item.created_at}>{relTempo(ultimo.item.created_at)}</time>
        <CaretDown
          aria-hidden
          className={cn("transition-transform", aberto && "rotate-180")}
        />
      </Button>
      {aberto && (
        <ol id={id} className="mt-1 space-y-2 border-l border-border pl-3">
          {entries.map((t, i) => (
            <li
              key={t.item.id}
              className="animate-enter"
              style={{ "--i": i } as React.CSSProperties}
            >
              {t.tipo === "sistema" && (
                <EventoLinha entry={t} agora={recente(t.item.id)} />
              )}
            </li>
          ))}
        </ol>
      )}
    </li>
  );
}

function EventoLinha({
  entry,
  agora,
}: {
  entry: Extract<ChamadoTimelineItem, { tipo: "sistema" | "publica" }>;
  agora?: boolean;
}) {
  return (
    <div className="flex items-start gap-2 text-xs text-muted-foreground">
      <Sparkle size={13} aria-hidden className="mt-0.5 shrink-0" />
      <span className="min-w-0 flex-1 break-words">{entry.item.texto}</span>
      {agora && <ChipAgora />}
      <time dateTime={entry.item.created_at} className="shrink-0">
        {relTempo(entry.item.created_at)}
      </time>
    </div>
  );
}

function ChipAgora() {
  return (
    <span className="inline-flex shrink-0 items-center rounded-full bg-[var(--ok)]/15 px-1.5 py-px text-[10px] font-bold uppercase tracking-wider text-[var(--ok-text)]">
      agora
    </span>
  );
}

/** Mensagem da conversa: o pedido original, respostas públicas e notas
 *  internas usam o mesmo desenho; a nota interna ganha borda tracejada,
 *  fundo e o único selo ("Interna") da trilha. */
function Mensagem({
  autor,
  souEu,
  quando,
  texto,
  interna,
  agora,
}: {
  autor: string;
  souEu: boolean;
  quando: string;
  texto: string;
  interna?: boolean;
  agora?: boolean;
}) {
  return (
    <div
      className={cn(
        interna &&
          "rounded-lg border border-dashed border-[var(--warn)]/50 bg-[var(--warn)]/8 px-3 py-2.5"
      )}
    >
      <div className="flex items-center gap-2">
        <Avatar nome={autor} size={22} />
        <span className="min-w-0 truncate text-sm font-medium">
          {souEu ? "Você" : autor}
        </span>
        {interna && (
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-dashed border-[var(--warn)]/60 px-1.5 py-px text-[11px] font-medium text-[var(--warn-text)]">
            <Lock size={10} aria-hidden />
            Interna
          </span>
        )}
        {agora && <ChipAgora />}
        <time
          dateTime={quando}
          className="ml-auto shrink-0 text-xs text-muted-foreground"
        >
          {relTempo(quando)}
        </time>
      </div>
      <p className="mt-1 whitespace-pre-line break-words text-sm sm:pl-[30px] leading-relaxed">
        {texto}
      </p>
    </div>
  );
}

function TimelineItem({
  entry,
  meuId,
  staff,
  recente,
}: {
  entry: ChamadoTimelineItem;
  meuId: string;
  staff: boolean;
  /** acabou de chegar por envio meu — entra animado com halo + chip "agora" */
  recente?: boolean;
}) {
  const reduz = useReducedMotion();
  // scroll pro item novo uma vez só: effect + flag, não callback-ref (que
  // re-disparava em qualquer re-render do detalhe)
  const liRef = useRef<HTMLLIElement | null>(null);
  const rolouRef = useRef(false);
  useEffect(() => {
    if (!recente || rolouRef.current) return;
    rolouRef.current = true;
    liRef.current?.scrollIntoView({
      block: "nearest",
      behavior: reduz ? "auto" : "smooth",
    });
  }, [recente, reduz]);

  if (entry.tipo === "sistema") {
    return (
      <ItemTrilha recente={recente} refEl={liRef}>
        <EventoLinha entry={entry} agora={recente} />
      </ItemTrilha>
    );
  }
  if (entry.tipo === "anexo") {
    const a = entry.item as ChamadoAnexo;
    const href = `/api/chamado-anexo/${a.id}`;
    const tipo = tipoAnexo(a.mime);
    return (
      <ItemTrilha recente={recente} refEl={liRef}>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Paperclip size={13} aria-hidden className="shrink-0" />
          <span className="min-w-0 flex-1 truncate">
            {a.created_by === meuId ? "Você" : (a.autor_nome ?? "Equipe")} anexou
          </span>
          {staff && a.interno && (
            <span className="shrink-0 rounded-full border border-dashed border-[var(--warn)]/60 px-1.5 py-px text-[11px] font-medium text-[var(--warn-text)]">
              Interna
            </span>
          )}
          {recente && <ChipAgora />}
          <time dateTime={a.created_at} className="shrink-0">
            {relTempo(a.created_at)}
          </time>
        </div>
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-1.5 flex w-full max-w-md min-w-0 items-center gap-2.5 rounded-lg border border-border bg-muted/30 p-2 transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <AnexoThumb src={href} mime={a.mime} />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium">{a.nome}</span>
            <span className="block truncate text-xs text-muted-foreground">
              {ROTULO_ANEXO[tipo]}
              {a.tamanho ? ` · ${formatTamanho(a.tamanho)}` : ""}
            </span>
          </span>
          <ArrowSquareOut size={14} aria-label="Abre em nova aba" className="shrink-0 text-muted-foreground" />
        </a>
      </ItemTrilha>
    );
  }
  const autor = "autor_nome" in entry.item ? entry.item.autor_nome : null;
  const souEu = "autor_id" in entry.item && entry.item.autor_id === meuId;
  return (
    <ItemTrilha recente={recente} refEl={liRef}>
      <Mensagem
        autor={autor ?? "Equipe"}
        souEu={souEu}
        quando={entry.item.created_at}
        texto={entry.item.texto}
        interna={entry.tipo === "interno"}
        agora={recente}
      />
    </ItemTrilha>
  );
}

/** <li> da trilha que vira motion.li quando `recente` — entrada ~300ms com
 *  halo verde evaporando (o "acabou de chegar"). */
function ItemTrilha({
  recente,
  refEl,
  children,
}: {
  recente?: boolean;
  refEl: React.RefObject<HTMLLIElement | null>;
  children: React.ReactNode;
}) {
  if (recente) {
    return (
      <motion.li
        ref={refEl}
        className="relative"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.28, ease: EASE }}
      >
        <motion.span
          aria-hidden
          className="pointer-events-none absolute -inset-x-2 -inset-y-1 rounded-lg bg-[var(--ok)]/10"
          initial={{ opacity: 1 }}
          animate={{ opacity: 0 }}
          transition={{ duration: 0.7, delay: 0.2, ease: EASE }}
        />
        {children}
      </motion.li>
    );
  }
  return <li>{children}</li>;
}

// ---------- botão de envio com confirmação ----------

function BotaoEnviar({
  rotulo,
  rotuloOk,
  enviado,
  busy,
  disabled,
  onClick,
}: {
  rotulo: string;
  rotuloOk: string;
  enviado: boolean;
  busy: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <Button
      size="sm"
      disabled={!enviado && disabled}
      onClick={onClick}
      className={cn(
        "transition-colors",
        // o ✓ ficaria disabled (campo limpo): fora do disabled e sem o
        // opacity-50, senão o verde de sucesso sai apagado
        enviado &&
          "bg-[var(--ok)] text-[var(--status-foreground)] hover:bg-[var(--ok)] disabled:opacity-100"
      )}
    >
      <AnimatePresence mode="wait" initial={false}>
        {enviado ? (
          <motion.span
            key="ok"
            className="flex items-center gap-1.5"
            initial={{ opacity: 0, scale: 0.85 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.85 }}
            transition={{ duration: 0.15, ease: EASE }}
          >
            <Check size={14} weight="bold" aria-hidden />
            {rotuloOk}
          </motion.span>
        ) : (
          <motion.span
            key="idle"
            className="flex items-center gap-1.5"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.12, ease: EASE }}
          >
            {busy && <CircleNotch size={14} className="animate-spin" aria-hidden />}
            {rotulo}
          </motion.span>
        )}
      </AnimatePresence>
    </Button>
  );
}

/** Caixa do composer: campo sem borda própria + barra com clipe e envio,
 *  tudo num contorno só — o botão fica colado no que se escreve. */
const CAIXA =
  "relative rounded-lg border bg-card transition-[border-color,box-shadow] focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50";
const CAMPO =
  "min-h-20 resize-none rounded-b-none border-0 bg-transparent px-3 pt-2.5 focus-visible:border-0 focus-visible:ring-0";

// ---------- composer da equipe ----------

type Mencao = { id: string; nome: string; token: string | null };

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** "@prefixo" imediatamente antes do cursor → {inicio, prefixo}. O @ precisa
 *  estar no início do texto ou depois de espaço — e-mail (a@b) não dispara. */
function consultaMencao(
  valor: string,
  caret: number
): { inicio: number; prefixo: string } | null {
  const antes = valor.slice(0, caret);
  const ultimo = antes.lastIndexOf("@");
  if (ultimo === -1) return null;
  if (ultimo > 0 && !/[\s(]/.test(antes[ultimo - 1])) return null;
  const prefixo = antes.slice(ultimo + 1);
  if (/[\s@]/.test(prefixo)) return null;
  return { inicio: ultimo, prefixo };
}

// rótulo do papel na equipe — papelLabel, a fonte única ("Auxiliar
// executivo", nunca "supervisor" na superfície)
const rotuloEquipe = papelLabel;

/** Composer da equipe: nota interna × resposta ao autor. Abre em "Nota
 *  interna" de propósito: uma nota que vaza pro autor não tem volta. O "@"
 *  abre autocomplete da equipe (listbox); quem é marcado vira chip removível
 *  e recebe notificação no app, nunca por e-mail. O autor do chamado e quem
 *  escreve não entram como alvo. */
function ChamadoComposer({
  chamadoId,
  equipe,
  meuId,
  autorId,
  autorPrimeiro,
  pending,
  onEnviou,
}: {
  chamadoId: string;
  equipe: Equipe;
  meuId: string;
  autorId: string | null;
  autorPrimeiro: string | null;
  pending: boolean;
  onEnviou?: () => void;
}) {
  const router = useRouter();
  const [busy, start] = useTransition();
  const [modo, setModo] = useState<"interno" | "publico">("interno");
  const [texto, setTexto] = useState("");
  const [mencoes, setMencoes] = useState<Mencao[]>([]);
  const [consulta, setConsulta] = useState<{
    inicio: number;
    prefixo: string;
  } | null>(null);
  const [ativo, setAtivo] = useState(0);
  const [enviado, setEnviado] = useState(false);
  const anexos = useAnexosPendentes(chamadoId, meuId);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const timerOk = useRef<ReturnType<typeof setTimeout> | null>(null);
  const listaId = useId();
  useEffect(
    () => () => {
      if (timerOk.current) clearTimeout(timerOk.current);
    },
    []
  );

  const interno = modo === "interno";
  const destino = autorPrimeiro ?? "autor";
  const nomeDe = (p: EquipeLinha) => p.nome_social || p.nome;
  const marcadasIds = useMemo(
    () => new Set(mencoes.map((m) => m.id)),
    [mencoes]
  );

  /** linhas do listbox: equipe filtrada pelo prefixo — eu, o autor e quem já
   *  está marcada entram desabilitadas (o "por que não dá") em vez de sumir. */
  const linhasMencao = useMemo(() => {
    if (!consulta || !interno) return [];
    const q = normaliza(consulta.prefixo);
    return equipe
      .filter((p) => normaliza(nomeDe(p)).includes(q))
      .map((p) => ({
        pessoa: p,
        estado:
          p.id === meuId
            ? ("voce" as const)
            : p.id === autorId
              ? ("autor" as const)
              : marcadasIds.has(p.id)
                ? ("marcada" as const)
                : ("livre" as const),
      }));
  }, [consulta, interno, equipe, meuId, autorId, marcadasIds]);

  const selecionaveis = linhasMencao.filter((l) => l.estado === "livre");
  const ativoOk = Math.min(ativo, Math.max(0, selecionaveis.length - 1));
  const popAberto = consulta !== null && interno && equipe.length > 0;

  /** Fim de token: espaço, fim do texto OU pontuação que fecha a menção —
   *  "@Paula)," e "@Paula." mantêm o chip. */
  function tokenPresente(t: string, token: string) {
    return new RegExp(`${escapeRe(token)}(?=[\\s.,;:!?)]|$)`).test(t);
  }

  function marcar(p: EquipeLinha) {
    if (p.id === meuId || p.id === autorId || marcadasIds.has(p.id)) return;
    const nome = nomeDe(p);
    const el = taRef.current;
    const caret = el?.selectionStart ?? texto.length;
    const c = consulta ?? consultaMencao(texto, caret);
    const token = `@${nome}`;
    let novo: string;
    let novoCaret: number;
    if (c) {
      novo = texto.slice(0, c.inicio) + token + " " + texto.slice(caret);
      novoCaret = c.inicio + token.length + 1;
    } else {
      const base = texto.replace(/\s+$/, "");
      novo = base ? `${base} ${token} ` : `${token} `;
      novoCaret = novo.length;
    }
    setTexto(novo);
    setMencoes((m) => [...m, { id: p.id, nome, token }]);
    setConsulta(null);
    requestAnimationFrame(() => {
      const el2 = taRef.current;
      if (!el2) return;
      el2.focus();
      el2.setSelectionRange(novoCaret, novoCaret);
    });
  }

  function desmarcar(id: string) {
    const token = mencoes.find((x) => x.id === id)?.token;
    if (token) {
      // flag global: tirar todas as ocorrências garante chip e texto iguais
      setTexto((t) =>
        t.replace(new RegExp(`${escapeRe(token)}(?=[\\s.,;:!?)]|$)`, "g"), "")
      );
    }
    setMencoes((l) => l.filter((x) => x.id !== id));
  }

  function mudarTexto(e: ChangeEvent<HTMLTextAreaElement>) {
    const v = e.target.value;
    setTexto(v);
    // token apagado no texto desmarca a pessoa
    setMencoes((l) => l.filter((m) => !m.token || tokenPresente(v, m.token)));
    const c = consultaMencao(v, e.target.selectionStart ?? v.length);
    setConsulta(interno ? c : null);
    if (c) setAtivo(0);
  }

  function teclaTexto(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (!popAberto) return;
    if (e.key === "ArrowDown" && selecionaveis.length) {
      e.preventDefault();
      setAtivo((i) => (i + 1) % selecionaveis.length);
    } else if (e.key === "ArrowUp" && selecionaveis.length) {
      e.preventDefault();
      setAtivo((i) => (i - 1 + selecionaveis.length) % selecionaveis.length);
    } else if (e.key === "Enter" && selecionaveis[ativoOk]) {
      e.preventDefault();
      marcar(selecionaveis[ativoOk].pessoa);
    } else if (e.key === "Escape") {
      e.preventDefault();
      setConsulta(null);
    }
  }

  function aoMoverCursor(e: React.SyntheticEvent<HTMLTextAreaElement>) {
    const el = e.currentTarget;
    const c = consultaMencao(el.value, el.selectionStart ?? 0);
    if ((c === null) !== (consulta === null) || c?.prefixo !== consulta?.prefixo) {
      setConsulta(interno ? c : null);
    }
  }

  function enviar() {
    const t = texto.trim();
    if (!t && anexos.pendentes.length === 0) return;
    start(async () => {
      let falhou = false;
      let saiu = false;
      let subiuAnexo = false;
      if (t) {
        const r = interno
          ? await comentarChamado(chamadoId, t, mencoes.map((m) => m.id))
          : await publicarAtualizacaoChamado(chamadoId, t);
        if (r.error) {
          toast.error(r.error);
          falhou = true;
        } else {
          saiu = true;
          // o texto já publicou: se um anexo falhar, o retry manda só o
          // arquivo (antes repostava o comentário)
          setTexto("");
          setMencoes([]);
          setConsulta(null);
        }
      }
      if (!falhou && anexos.pendentes.length) {
        const falhas = await anexos.enviar(interno);
        if (falhas) {
          toast.error(
            falhas === 1
              ? "Um anexo não subiu. Ele continua na lista para tentar de novo."
              : `${falhas} anexos não subiram. Eles continuam na lista para tentar de novo.`
          );
          falhou = true;
        }
        if (falhas < anexos.pendentes.length) {
          saiu = true;
          subiuAnexo = true;
        }
      }
      if (saiu) onEnviou?.();
      // texto sai por server action (que já revalida); anexo sobe direto do
      // browser pro storage, então só ele precisa pedir a trilha nova
      if (subiuAnexo) router.refresh();
      if (falhou) return;
      toast.success(
        interno ? "Nota salva. Só a equipe vê." : `Enviado a ${destino}.`
      );
      setEnviado(true);
      if (timerOk.current) clearTimeout(timerOk.current);
      timerOk.current = setTimeout(() => setEnviado(false), 1600);
    });
  }

  return (
    <div
      className={cn(
        "border-t px-4 py-4 sm:px-5",
        interno ? "border-[var(--warn)]/40 bg-[var(--warn)]/[0.05]" : "border-border"
      )}
    >
      <div
        role="radiogroup"
        aria-label="Tipo de mensagem"
        className="mb-2.5 inline-flex max-w-full rounded-lg bg-muted p-0.5"
      >
        {(
          [
            ["interno", "Nota interna"],
            ["publico", `Responder a ${destino}`],
          ] as const
        ).map(([v, l]) => (
          <Button
            key={v}
            variant="ghost"
            role="radio"
            aria-checked={modo === v}
            onClick={() => {
              setModo(v);
              setConsulta(null);
            }}
            className={cn(
              "h-auto min-h-11 min-w-0 rounded-md px-3 md:min-h-7",
              modo === v
                ? "bg-foreground text-background hover:bg-foreground hover:text-background"
                : "text-muted-foreground"
            )}
          >
            <span className="truncate">{l}</span>
          </Button>
        ))}
      </div>

      {interno && mencoes.length > 0 && (
        <div
          role="group"
          className="mb-2 flex flex-wrap items-center gap-1.5"
          aria-label="Pessoas marcadas"
        >
          {mencoes.map((m) => (
            <span
              key={m.id}
              className="inline-flex items-center gap-1 rounded-full border border-[var(--warn)]/50 bg-card py-0.5 pl-1.5 pr-1 text-xs"
            >
              <Avatar nome={m.nome} size={18} />
              <span className="font-medium">{m.nome}</span>
              <Button
                variant="ghost"
                size="icon-xs"
                onClick={() => desmarcar(m.id)}
                aria-label={`Remover marcação de ${m.nome}`}
                className="-my-2.5 -mr-1 rounded-full text-muted-foreground md:-my-1"
              >
                <X aria-hidden />
              </Button>
            </span>
          ))}
          <span className="text-xs text-[var(--warn-text)]">
            {mencoes.length === 1
              ? "1 pessoa será notificada no app"
              : `${mencoes.length} pessoas serão notificadas no app`}
          </span>
        </div>
      )}

      <div
        className={cn(
          CAIXA,
          interno ? "border-dashed border-[var(--warn)]/60" : "border-input"
        )}
      >
        <Textarea
          ref={taRef}
          value={texto}
          onChange={mudarTexto}
          onKeyDown={teclaTexto}
          onSelect={aoMoverCursor}
          onClick={aoMoverCursor}
          onBlur={() => setConsulta(null)}
          rows={2}
          maxLength={4000}
          aria-label={interno ? "Nota interna" : `Resposta a ${destino}`}
          aria-expanded={popAberto}
          aria-controls={popAberto ? listaId : undefined}
          aria-autocomplete="list"
          aria-activedescendant={
            popAberto && selecionaveis[ativoOk]
              ? `${listaId}-${selecionaveis[ativoOk].pessoa.id}`
              : undefined
          }
          placeholder={
            interno ? "Nota para a equipe. Use @ para marcar" : `Responder a ${destino}…`
          }
          className={CAMPO}
        />
        {/* listbox do "@" — ancorado acima do campo */}
        {popAberto && (
          <div className="absolute bottom-full left-0 z-10 mb-1.5 w-full min-w-0 max-w-80">
            <ul
              role="listbox"
              id={listaId}
              aria-label="Marcar alguém da equipe"
              className="overflow-hidden rounded-lg border border-border bg-popover py-1 shadow-[var(--shadow-overlay)]"
            >
              {linhasMencao.map((l) => {
                const nome = nomeDe(l.pessoa);
                const idxSel =
                  l.estado === "livre"
                    ? selecionaveis.findIndex((s) => s.pessoa.id === l.pessoa.id)
                    : -1;
                const desabilitada = l.estado !== "livre";
                return (
                  <li
                    key={l.pessoa.id}
                    id={idxSel >= 0 ? `${listaId}-${l.pessoa.id}` : undefined}
                    role="option"
                    aria-selected={idxSel === ativoOk && idxSel >= 0}
                    aria-disabled={desabilitada || undefined}
                    onMouseDown={(e) => e.preventDefault()} // clique não tira o foco do campo
                    onClick={() => !desabilitada && marcar(l.pessoa)}
                    className={cn(
                      "flex min-h-11 cursor-pointer items-center gap-2 px-3 py-1.5 text-sm md:min-h-9",
                      idxSel === ativoOk && idxSel >= 0 && "bg-muted",
                      desabilitada ? "cursor-default opacity-55" : "hover:bg-muted"
                    )}
                  >
                    <Avatar nome={nome} size={20} />
                    <span className="min-w-0 flex-1 truncate font-medium">
                      {nome}
                    </span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {l.estado === "voce"
                        ? "você"
                        : l.estado === "autor"
                          ? "autor(a) do chamado"
                          : l.estado === "marcada"
                            ? "marcada"
                            : rotuloEquipe(l.pessoa.role)}
                    </span>
                  </li>
                );
              })}
              {linhasMencao.length === 0 && (
                <li
                  role="option"
                  aria-selected={false}
                  aria-disabled="true"
                  className="px-3 py-2 text-xs text-muted-foreground"
                >
                  Ninguém da equipe com esse nome.
                </li>
              )}
            </ul>
          </div>
        )}
        <div className="px-2">
          <AnexosPendentes
            itens={anexos.pendentes}
            interno={interno}
            onRemover={anexos.remover}
          />
        </div>
        <div className="flex items-center justify-between gap-2 p-1.5">
          <ChamadoAnexos
            compacto
            onArquivo={anexos.adicionar}
            disabled={busy || pending}
          />
          <BotaoEnviar
            rotulo={interno ? "Salvar nota" : `Enviar a ${destino}`}
            rotuloOk={interno ? "Nota salva" : "Enviado"}
            enviado={enviado}
            busy={busy}
            disabled={
              busy ||
              pending ||
              (!texto.trim() && anexos.pendentes.length === 0) ||
              anexos.pendentes.some((a) => a.status === "enviando")
            }
            onClick={enviar}
          />
        </div>
      </div>
    </div>
  );
}

/** Composer do autor: escreve pra equipe na trilha pública — sem menções
 *  (o @ é instrumento da equipe); anexos chegam públicos pro staff. */
function AutorComposer({
  chamadoId,
  meuId,
  pending,
  onEnviou,
}: {
  chamadoId: string;
  meuId: string;
  pending: boolean;
  onEnviou?: () => void;
}) {
  const router = useRouter();
  const [busy, start] = useTransition();
  const [texto, setTexto] = useState("");
  const [enviado, setEnviado] = useState(false);
  const anexos = useAnexosPendentes(chamadoId, meuId);
  const timerOk = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (timerOk.current) clearTimeout(timerOk.current);
    },
    []
  );

  function enviar() {
    const t = texto.trim();
    if (!t && anexos.pendentes.length === 0) return;
    start(async () => {
      let falhou = false;
      let saiu = false;
      let subiuAnexo = false;
      if (t) {
        const r = await acrescentarInfoChamado(chamadoId, t);
        if (r.error) {
          toast.error(r.error);
          falhou = true;
        } else {
          saiu = true;
          // saiu: o retry de um anexo falho não reposta o texto
          setTexto("");
        }
      }
      if (!falhou && anexos.pendentes.length) {
        const falhas = await anexos.enviar(false);
        if (falhas) {
          toast.error(
            falhas === 1
              ? "Um anexo não subiu. Ele continua na lista para tentar de novo."
              : `${falhas} anexos não subiram. Eles continuam na lista para tentar de novo.`
          );
          falhou = true;
        }
        if (falhas < anexos.pendentes.length) {
          saiu = true;
          subiuAnexo = true;
        }
      }
      if (saiu) onEnviou?.();
      // anexo sobe direto pro storage, fora de server action
      if (subiuAnexo) router.refresh();
      if (falhou) return;
      toast.success("Enviado à equipe.");
      setEnviado(true);
      if (timerOk.current) clearTimeout(timerOk.current);
      timerOk.current = setTimeout(() => setEnviado(false), 1600);
    });
  }

  return (
    <div className="border-t border-border px-4 py-4 sm:px-5">
      <div className={cn(CAIXA, "border-input")}>
        <Textarea
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          rows={2}
          maxLength={4000}
          aria-label="Mensagem para a equipe"
          placeholder="Escreva para a equipe…"
          className={CAMPO}
        />
        <div className="px-2">
          <AnexosPendentes
            itens={anexos.pendentes}
            interno={false}
            visaoAutor
            onRemover={anexos.remover}
          />
        </div>
        <div className="flex items-center justify-between gap-2 p-1.5">
          <ChamadoAnexos
            compacto
            onArquivo={anexos.adicionar}
            disabled={busy || pending}
          />
          <BotaoEnviar
            rotulo="Enviar"
            rotuloOk="Enviado"
            enviado={enviado}
            busy={busy}
            disabled={
              busy ||
              pending ||
              (!texto.trim() && anexos.pendentes.length === 0) ||
              anexos.pendentes.some((a) => a.status === "enviando")
            }
            onClick={enviar}
          />
        </div>
      </div>
    </div>
  );
}
