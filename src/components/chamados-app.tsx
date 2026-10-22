"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  CaretRight,
  ChatCircleText,
  CircleNotch,
  Clock,
  Lifebuoy,
  Lock,
  Paperclip,
  PaperPlaneRight,
  Plus,
  Warning,
} from "@phosphor-icons/react";
import { toast } from "sonner";
import type {
  ChamadoCategoria,
  ChamadoFilaItem,
  ChamadoStatus,
  ChamadoTimelineItem,
  Profile,
} from "@/lib/types";
import {
  CHAMADO_CATEGORIA_LABEL,
  CHAMADO_ORIGEM_LABEL,
  CHAMADO_STATUS_LABEL,
  formatDiaMes,
} from "@/lib/ciclo";
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
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { NovoChamadoDialog } from "@/components/novo-chamado-dialog";
import { ChamadoAnexos } from "@/components/chamado-anexos";

type Papel = string;
type Equipe = Pick<Profile, "id" | "nome" | "nome_social" | "role">[];

const STATUS_TOM: Record<ChamadoStatus, string> = {
  aberto: "border-[var(--warn)]/50 bg-[var(--warn)]/10 text-[var(--warn-text)]",
  em_atendimento:
    "border-[var(--brand-lime)]/50 bg-[var(--brand-lime)]/10 text-foreground",
  resolvido: "border-border bg-muted text-muted-foreground",
};

const CAT_TOM: Record<ChamadoCategoria, string> = {
  urgencia: "border-destructive/40 bg-destructive/10 text-destructive",
  plataforma: "border-border bg-muted text-muted-foreground",
  agenda: "border-border bg-muted text-muted-foreground",
  metodologia: "border-border bg-muted text-muted-foreground",
  outro: "border-border bg-muted text-muted-foreground",
};

function relTempo(iso: string): string {
  const t = new Date(iso).getTime();
  const diff = Date.now() - t;
  const min = Math.floor(diff / 60000);
  if (min < 60) return `há ${Math.max(1, min)}min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `há ${h}h`;
  const d = Math.floor(h / 24);
  if (d === 1) return "ontem";
  if (d < 7) return `há ${d}d`;
  return formatDiaMes(iso);
}

function idadeAberto(iso: string): string {
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (d <= 0) return "hoje";
  if (d === 1) return "há 1 dia";
  return `há ${d} dias`;
}

export function ChamadosApp({
  papel,
  meuId,
  meuNome,
  itens,
  selecionadoInicial,
  detalheInicial,
}: {
  papel: Papel;
  meuId: string;
  meuNome: string;
  itens: ChamadoFilaItem[];
  selecionadoInicial: string | null;
  detalheInicial: {
    chamado: ChamadoFilaItem;
    timeline: ChamadoTimelineItem[];
    equipe: Equipe;
  } | null;
}) {
  const router = useRouter();
  const staff = papel === "coordenacao" || papel === "supervisor";
  const [busca, setBusca] = useState("");
  const [fFila, setFFila] = useState<"todos" | "fila" | "meus" | "resolvidos">(
    "todos"
  );
  const [fCategoria, setFCategoria] = useState<string>("todas");
  const [fStatus, setFStatus] = useState<string>("todos");

  const filtrados = useMemo(() => {
    let l = itens;
    if (staff) {
      if (fFila === "fila") l = l.filter((c) => c.status === "aberto");
      if (fFila === "meus")
        l = l.filter((c) => c.atribuido_a === meuId && c.status !== "resolvido");
      if (fFila === "resolvidos") l = l.filter((c) => c.status === "resolvido");
      if (fCategoria !== "todas")
        l = l.filter((c) => c.categoria === fCategoria);
      if (fStatus !== "todos") l = l.filter((c) => c.status === fStatus);
    }
    const q = busca.trim().toLowerCase();
    if (q) {
      l = l.filter(
        (c) =>
          c.numero.toLowerCase().includes(q) ||
          (c.assunto ?? "").toLowerCase().includes(q) ||
          (c.autor_nome ?? "").toLowerCase().includes(q)
      );
    }
    return l;
  }, [itens, staff, fFila, fCategoria, fStatus, busca, meuId]);

  const naFila = itens.filter((c) => c.status === "aberto" && !c.restrito);
  const maisAntigo = naFila.length
    ? naFila.reduce((a, b) =>
        new Date(a.created_at) < new Date(b.created_at) ? a : b
      )
    : null;

  const sel = selecionadoInicial;
  const detalhe = detalheInicial;

  function abrir(id: string) {
    router.push(`/chamados?c=${id}`);
  }
  function fechar() {
    router.push("/chamados");
  }

  // mobile: lista OU detalhe; desktop: lado a lado
  return (
    <div
      className={cn(
        "grid gap-4",
        staff && "lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)] lg:items-start"
      )}
    >
      <section
        aria-label={staff ? "Fila de chamados" : "Seus chamados"}
        className={cn(sel && staff ? "hidden lg:block" : undefined)}
      >
        {staff && (
          <div className="mb-3 space-y-2.5">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Lifebuoy size={15} aria-hidden className="shrink-0" />
              <span>
                <strong className="text-foreground">{naFila.length}</strong> na
                fila
                {maisAntigo && (
                  <>
                    {" "}· mais antigo {idadeAberto(maisAntigo.created_at)}
                  </>
                )}
              </span>
            </div>
            <div
              role="group"
              aria-label="Filtrar por fila"
              className="flex flex-wrap gap-1.5"
            >
              {(
                [
                  ["todos", "Todos"],
                  ["fila", "Na fila"],
                  ["meus", "Meus"],
                  ["resolvidos", "Resolvidos"],
                ] as const
              ).map(([v, l]) => (
                <button
                  key={v}
                  onClick={() => setFFila(v)}
                  aria-pressed={fFila === v}
                  className={cn(
                    "min-h-11 rounded-full border px-3 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:min-h-8",
                    fFila === v
                      ? "border-transparent bg-foreground text-background"
                      : "border-border bg-card text-muted-foreground hover:bg-muted"
                  )}
                >
                  {l}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              <Select
                value={fCategoria}
                onValueChange={(v) => setFCategoria(v ?? "todas")}
              >
                <SelectTrigger
                  className="h-11 w-auto min-w-32 max-w-48 text-xs md:h-8"
                  aria-label="Filtrar por categoria"
                >
                  <SelectValue placeholder="Categoria" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todas">Todas as categorias</SelectItem>
                  {Object.entries(CHAMADO_CATEGORIA_LABEL).map(([v, l]) => (
                    <SelectItem key={v} value={v}>
                      {l}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={fStatus}
                onValueChange={(v) => setFStatus(v ?? "todos")}
              >
                <SelectTrigger
                  className="h-11 w-auto min-w-32 max-w-48 text-xs md:h-8"
                  aria-label="Filtrar por estado"
                >
                  <SelectValue placeholder="Estado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos os estados</SelectItem>
                  {Object.entries(CHAMADO_STATUS_LABEL).map(([v, l]) => (
                    <SelectItem key={v} value={v}>
                      {l}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar nº, assunto ou autor…"
                aria-label="Buscar chamado"
                className="h-11 w-full text-sm md:h-8 md:max-w-52"
              />
            </div>
          </div>
        )}
        {!staff && (
          <div className="mb-3 flex items-center justify-between gap-3">
            <Input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar nos seus chamados…"
              aria-label="Buscar chamado"
              className="h-11 max-w-72 text-sm md:h-9"
            />
            <NovoChamadoDialog
              papel={papel}
              trigger={
                <Button size="sm">
                  <Plus size={15} aria-hidden />
                  Novo pedido
                </Button>
              }
            />
          </div>
        )}
        {staff && (
          <div className="mb-3 flex justify-end">
            <NovoChamadoDialog
              papel={papel}
              trigger={
                <Button variant="outline" size="sm">
                  <Plus size={15} aria-hidden />
                  Abrir chamado
                </Button>
              }
            />
          </div>
        )}
        <ul className="space-y-2">
          {filtrados.length === 0 && (
            <li className="rounded-xl border border-dashed border-border px-5 py-8 text-center text-sm text-muted-foreground">
              {staff
                ? "Nenhum chamado nessa visão. Bom trabalho de fila!"
                : "Você ainda não abriu nenhum pedido. Se precisar, é só tocar em “Novo pedido”."}
            </li>
          )}
          {filtrados.map((c) => (
            <li key={c.id}>
              <button
                onClick={() => abrir(c.id)}
                aria-current={sel === c.id ? "true" : undefined}
                className={cn(
                  "flex w-full items-center gap-3 rounded-xl border bg-card px-4 py-3.5 text-left shadow-[var(--shadow-border)] transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  sel === c.id ? "border-foreground/30 ring-1 ring-foreground/20" : "border-transparent"
                )}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="font-mono text-xs text-muted-foreground">
                      {c.numero}
                    </span>
                    <Badge
                      variant="outline"
                      className={cn("text-[11px] font-normal", CAT_TOM[c.categoria])}
                    >
                      {c.categoria === "urgencia" && (
                        <Warning size={11} aria-hidden />
                      )}
                      {CHAMADO_CATEGORIA_LABEL[c.categoria]}
                    </Badge>
                    <Badge
                      variant="outline"
                      className={cn("text-[11px] font-normal", STATUS_TOM[c.status])}
                    >
                      {CHAMADO_STATUS_LABEL[c.status]}
                    </Badge>
                  </div>
                  <p className="mt-1 truncate text-sm font-medium">
                    {c.restrito
                      ? "Chamado restrito à coordenação"
                      : c.assunto}
                  </p>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">
                    {c.restrito
                      ? "Assunto e autor visíveis só pra coordenação."
                      : [
                          c.autor_nome && staff
                            ? `por ${c.autor_nome}`
                            : null,
                          staff && CHAMADO_ORIGEM_LABEL[c.origem],
                          c.contexto,
                          c.atribuido_nome
                            ? `com ${c.atribuido_nome}`
                            : staff && c.status === "aberto"
                              ? "sem dono"
                              : null,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground">
                  <time dateTime={c.created_at}>{relTempo(c.created_at)}</time>
                  <CaretRight size={14} aria-hidden />
                </div>
              </button>
            </li>
          ))}
        </ul>
      </section>

      {staff && (
        <section aria-label="Detalhe do chamado" className={cn(!sel && "hidden lg:block")}>
          {detalhe ? (
            <ChamadoDetalhe
              papel={papel}
              meuId={meuId}
              meuNome={meuNome}
              chamado={detalhe.chamado}
              timeline={detalhe.timeline}
              equipe={detalhe.equipe}
              onVoltar={fechar}
            />
          ) : (
            <div className="flex min-h-64 flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border px-6 py-10 text-center text-sm text-muted-foreground">
              <ChatCircleText size={28} aria-hidden />
              Selecione um chamado da fila pra ver a conversa.
            </div>
          )}
        </section>
      )}
      {!staff && sel && detalhe && (
        <section aria-label="Detalhe do pedido">
          <ChamadoDetalhe
            papel={papel}
            meuId={meuId}
            meuNome={meuNome}
            chamado={detalhe.chamado}
            timeline={detalhe.timeline}
            equipe={detalhe.equipe}
            onVoltar={fechar}
          />
        </section>
      )}
    </div>
  );
}

export function ChamadoDetalhe({
  papel,
  meuId,
  meuNome,
  chamado,
  timeline,
  equipe,
  onVoltar,
}: {
  papel: Papel;
  meuId: string;
  meuNome: string;
  chamado: ChamadoFilaItem;
  timeline: ChamadoTimelineItem[];
  equipe: Equipe;
  onVoltar: () => void;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const staff = papel === "coordenacao" || papel === "supervisor";
  const souDono = chamado.atribuido_a === meuId;
  const podeTratar = !chamado.restrito && chamado.status !== "resolvido";
  const [resolveOpen, setResolveOpen] = useState(false);
  const [atribuirOpen, setAtribuirOpen] = useState(false);
  const [resumo, setResumo] = useState("");
  const [para, setPara] = useState<string>(chamado.atribuido_a ?? "");

  function acao(fn: () => Promise<{ ok?: boolean; error?: string }>, okMsg: string) {
    start(async () => {
      const r = await fn();
      if (r.error) toast.error(r.error);
      else {
        toast.success(okMsg);
        router.refresh();
      }
    });
  }

  const passos: { rotulo: string; feito: boolean; atual: boolean }[] = [
    {
      rotulo: "Aberto",
      feito: true,
      atual: chamado.status === "aberto",
    },
    {
      rotulo: "Em atendimento",
      feito: chamado.status !== "aberto",
      atual: chamado.status === "em_atendimento",
    },
    {
      rotulo: "Resolvido",
      feito: chamado.status === "resolvido",
      atual: chamado.status === "resolvido",
    },
  ];

  return (
    <article className="overflow-hidden rounded-xl bg-card shadow-[var(--shadow-border)]">
      <div className="border-b border-border px-4 py-3.5 sm:px-5">
        <div className="flex items-start gap-3">
          <button
            onClick={onVoltar}
            aria-label="Voltar pra lista"
            className="grid size-11 shrink-0 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:hidden md:size-8"
          >
            <ArrowLeft size={17} aria-hidden />
          </button>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="font-mono text-xs text-muted-foreground">
                {chamado.numero}
              </span>
              <Badge variant="outline" className={cn("text-[11px] font-normal", CAT_TOM[chamado.categoria])}>
                {CHAMADO_CATEGORIA_LABEL[chamado.categoria]}
              </Badge>
              <Badge variant="outline" className={cn("text-[11px] font-normal", STATUS_TOM[chamado.status])}>
                {CHAMADO_STATUS_LABEL[chamado.status]}
              </Badge>
              {staff && (
                <span className="text-xs text-muted-foreground">
                  {CHAMADO_ORIGEM_LABEL[chamado.origem]}
                </span>
              )}
            </div>
            <h2 className="mt-1.5 text-base font-semibold leading-snug sm:text-lg">
              {chamado.restrito ? "Chamado restrito à coordenação" : chamado.assunto}
            </h2>
            {!chamado.restrito && (
              <p className="mt-1 text-xs text-muted-foreground">
                {[
                  chamado.autor_nome && staff ? `Autor: ${chamado.autor_nome}` : null,
                  chamado.contexto,
                  `aberto ${relTempo(chamado.created_at)}`,
                  chamado.atribuido_nome
                    ? `Responsável: ${chamado.atribuido_nome}`
                    : staff && chamado.status === "aberto"
                      ? "Sem responsável"
                      : null,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            )}
          </div>
        </div>
        {/* stepper do autor — replica o "seu pedido" do mock */}
        <ol className="mt-4 flex items-center gap-2" aria-label="Situação do pedido">
          {passos.map((p, i) => (
            <li key={p.rotulo} className="flex flex-1 items-center gap-2">
              <span
                aria-current={p.atual ? "step" : undefined}
                className={cn(
                  "grid size-5 shrink-0 place-items-center rounded-full border text-[10px] font-semibold",
                  p.feito || p.atual
                    ? "border-[var(--brand-lime)] bg-[var(--brand-lime)]/20 text-foreground"
                    : "border-border text-muted-foreground"
                )}
              >
                {i + 1}
              </span>
              <span
                className={cn(
                  // rótulo quebra em 2 linhas em tela estreita — truncar
                  // cortava "Em atendimento" no mobile
                  "whitespace-normal text-xs leading-tight",
                  p.atual ? "font-medium text-foreground" : "text-muted-foreground"
                )}
              >
                {p.rotulo}
              </span>
              {i < passos.length - 1 && (
                <span className="h-px min-w-3 flex-1 bg-border" aria-hidden />
              )}
            </li>
          ))}
        </ol>
      </div>

      {/* ações da equipe */}
      {staff && !chamado.restrito && (
        <div className="flex flex-wrap items-center gap-2 border-b border-border bg-muted/30 px-4 py-2.5 sm:px-5">
          {chamado.status !== "resolvido" && (
            <>
              {(!chamado.atribuido_a || papel === "coordenacao") && !souDono && (
                <Button
                  size="sm"
                  disabled={pending}
                  onClick={() => acao(() => assumirChamado(chamado.id), "Chamado assumido — é com você.")}
                >
                  {chamado.atribuido_nome
                    ? `Assumir de ${chamado.atribuido_nome}`
                    : "Assumir"}
                </Button>
              )}
              {(souDono || papel === "coordenacao") && (
                <Button
                  variant="outline"
                  size="sm"
                  disabled={pending}
                  onClick={() => setResolveOpen(true)}
                >
                  Resolver
                </Button>
              )}
              {papel === "coordenacao" && (
                <Button
                  variant="outline"
                  size="sm"
                  disabled={pending}
                  onClick={() => setAtribuirOpen(true)}
                >
                  Atribuir
                </Button>
              )}
              {(souDono || papel === "coordenacao") && chamado.atribuido_a && (
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={pending}
                  onClick={() => acao(() => devolverChamadoFila(chamado.id), "Chamado devolvido à fila.")}
                >
                  Devolver à fila
                </Button>
              )}
            </>
          )}
          {chamado.status === "resolvido" && (
            <Button
              variant="outline"
              size="sm"
              disabled={pending}
              onClick={() => acao(() => reabrirChamado(chamado.id), "Chamado reaberto.")}
            >
              Reabrir
            </Button>
          )}
        </div>
      )}
      {staff && chamado.restrito && (
        <div className="flex items-center gap-2 border-b border-border bg-muted/30 px-4 py-3 text-sm text-muted-foreground sm:px-5">
          <Lock size={15} aria-hidden />
          Chamados de plataforma são tratados pela coordenação.
        </div>
      )}

      {/* linha do tempo — restrito (plataforma pro auxiliar) não revela nem
          a existência da conversa: no banco a RLS já devolve vazio */}
      {!chamado.restrito && (
        <ol className="divide-y divide-border/60 px-4 sm:px-5" aria-label="Conversa">
          {timeline.map((t) => (
            <TimelineItem key={`${t.tipo}-${t.item.id}`} entry={t} meuId={meuId} />
          ))}
          {timeline.length === 0 && (
            <li className="py-6 text-center text-sm text-muted-foreground">
              A conversa começa quando a equipe responder.
            </li>
          )}
        </ol>
      )}

      {/* resolução visível pra todos */}
      {chamado.status === "resolvido" && chamado.resolucao_resumo && (
        <div className="border-t border-border bg-[var(--brand-lime)]/10 px-4 py-3.5 text-sm sm:px-5">
          <strong>Resolvido</strong>
          {chamado.resolvido_em && (
            <span className="text-muted-foreground">
              {" "}· {formatDiaMes(chamado.resolvido_em)}
            </span>
          )}
          <p className="mt-1 leading-relaxed">{chamado.resolucao_resumo}</p>
        </div>
      )}

      {/* composer */}
      {staff && podeTratar && (
        <ChamadoComposer chamadoId={chamado.id} equipe={equipe} meuId={meuId} pending={pending} />
      )}
      {!staff && (
        <div className="border-t border-border px-4 py-4 sm:px-5">
          {chamado.status === "resolvido" ? (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Ainda precisa de ajuda com isso? Peça a reabertura — a equipe é
                avisada e o chamado volta pra fila.
              </p>
              <Button
                variant="outline"
                size="sm"
                disabled={pending}
                onClick={() =>
                  acao(() => pedirReaberturaChamado(chamado.id), "Pedido enviado — a equipe retoma o chamado.")
                }
              >
                Pedir reabertura
              </Button>
            </div>
          ) : (
            <AutorComposer chamadoId={chamado.id} meuNome={meuNome} pending={pending} />
          )}
        </div>
      )}

      {/* dialog resolver */}
      <Dialog open={resolveOpen} onOpenChange={setResolveOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Resolver {chamado.numero}</DialogTitle>
            <DialogDescription>
              O resumo vai pro autor como resposta final e fica na trilha do
              chamado.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="resumo-resolucao">Resumo da resolução</Label>
            <Textarea
              id="resumo-resolucao"
              value={resumo}
              onChange={(e) => setResumo(e.target.value)}
              rows={3}
              maxLength={1000}
              placeholder="Ex.: conversei com o mentor e o encontro foi reagendado pra quinta."
            />
          </div>
          <DialogFooter>
            <Button
              disabled={pending || resumo.trim().length < 2}
              onClick={() => {
                acao(
                  () => resolverChamado(chamado.id, resumo),
                  "Chamado resolvido."
                );
                setResolveOpen(false);
              }}
            >
              Marcar como resolvido
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* dialog atribuir */}
      <Dialog open={atribuirOpen} onOpenChange={setAtribuirOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Atribuir {chamado.numero}</DialogTitle>
            <DialogDescription>
              Quem assumir trata. Auxiliar executivo só recebe chamado não
              técnico.
            </DialogDescription>
          </DialogHeader>
          <Select value={para} onValueChange={(v) => setPara(v ?? "")}>
            <SelectTrigger aria-label="Responsável">
              <SelectValue placeholder="Escolha o responsável" />
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
            <Button
              variant="outline"
              disabled={pending || !chamado.atribuido_a}
              onClick={() => {
                acao(() => atribuirChamado(chamado.id, null), "Chamado devolvido à fila.");
                setAtribuirOpen(false);
              }}
            >
              Tirar responsável
            </Button>
            <Button
              disabled={pending || !para}
              onClick={() => {
                acao(
                  () => atribuirChamado(chamado.id, para),
                  "Chamado atribuído."
                );
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

function TimelineItem({
  entry,
  meuId,
}: {
  entry: ChamadoTimelineItem;
  meuId: string;
}) {
  const quando = (
    <time
      dateTime={entry.item.created_at}
      className="shrink-0 text-[11px] text-muted-foreground"
    >
      {relTempo(entry.item.created_at)}
    </time>
  );
  if (entry.tipo === "sistema") {
    return (
      <li className="flex items-center gap-2.5 py-3 text-xs text-muted-foreground">
        <Clock size={13} aria-hidden className="shrink-0" />
        <span className="flex-1">{entry.item.texto}</span>
        {quando}
      </li>
    );
  }
  if (entry.tipo === "anexo") {
    const a = entry.item as import("@/lib/types").ChamadoAnexo;
    return (
      <li className="flex items-center gap-2.5 py-3 text-sm">
        <Paperclip size={15} aria-hidden className="shrink-0 text-muted-foreground" />
        <span className="min-w-0 flex-1 truncate">
          <a
            href={`/api/chamado-anexo/${a.id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {a.nome}
          </a>
          <span className="text-muted-foreground">
            {a.autor_nome ? ` · ${a.autor_nome}` : ""}
            {a.interno ? " · interno" : ""}
          </span>
        </span>
        {quando}
      </li>
    );
  }
  const interno = entry.tipo === "interno";
  const autor =
    "autor_nome" in entry.item ? entry.item.autor_nome : null;
  const souEu = "autor_id" in entry.item && entry.item.autor_id === meuId;
  return (
    <li
      className={cn(
        "py-3.5",
        interno && "rounded-lg border border-[var(--warn)]/40 bg-[var(--warn)]/8 px-3.5 my-1"
      )}
    >
      <div className="flex items-baseline gap-2">
        <span className="text-sm font-medium">
          {souEu ? "Você" : (autor ?? "Equipe")}
        </span>
        {interno && (
          <Badge
            variant="outline"
            className="border-[var(--warn)]/50 text-[10px] font-normal text-[var(--warn-text)]"
          >
            <Lock size={10} aria-hidden /> interno
          </Badge>
        )}
        <span className="ml-auto">{quando}</span>
      </div>
      <p className="mt-1 whitespace-pre-line break-words text-sm leading-relaxed text-foreground/90">
        {entry.item.texto}
      </p>
    </li>
  );
}

/** Composer da equipe: comentário interno vs. atualização pública + menções
 *  e anexos. */
function ChamadoComposer({
  chamadoId,
  equipe,
  meuId,
  pending,
}: {
  chamadoId: string;
  equipe: Equipe;
  meuId: string;
  pending: boolean;
}) {
  const router = useRouter();
  const [busy, start] = useTransition();
  const [modo, setModo] = useState<"interno" | "publico">("interno");
  const [texto, setTexto] = useState("");
  const [mencionados, setMencionados] = useState<string[]>([]);
  const outrasPessoas = equipe.filter((p) => p.id !== meuId);

  function enviar() {
    start(async () => {
      const r =
        modo === "interno"
          ? await comentarChamado(chamadoId, texto, mencionados)
          : await publicarAtualizacaoChamado(chamadoId, texto);
      if (r.error) toast.error(r.error);
      else {
        toast.success(
          modo === "interno" ? "Comentário registrado." : "Atualização enviada ao autor."
        );
        setTexto("");
        setMencionados([]);
        router.refresh();
      }
    });
  }

  return (
    <div className="border-t border-border px-4 py-4 sm:px-5">
      <div
        role="group"
        aria-label="Tipo de mensagem"
        className="mb-3 inline-flex rounded-lg border border-border bg-muted/40 p-0.5"
      >
        {(
          [
            ["interno", "Comentário interno", Lock],
            ["publico", "Resposta ao autor", PaperPlaneRight],
          ] as const
        ).map(([v, l, Icone]) => (
          <button
            key={v}
            onClick={() => setModo(v)}
            aria-pressed={modo === v}
            className={cn(
              "flex min-h-11 items-center gap-1.5 rounded-md px-3 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:min-h-7",
              modo === v
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Icone size={13} aria-hidden />
            {l}
          </button>
        ))}
      </div>
      {modo === "publico" && (
        <p className="mb-2 text-xs text-muted-foreground">
          O autor vê esta mensagem na trilha dele e recebe por e-mail.
        </p>
      )}
      <Textarea
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        rows={3}
        maxLength={4000}
        aria-label={modo === "interno" ? "Comentário interno" : "Resposta ao autor"}
        placeholder={
          modo === "interno"
            ? "Nota interna — o autor não vê. Use @ pra marcar alguém da equipe."
            : "Escreva a resposta que vai pro autor…"
        }
      />
      {modo === "interno" && outrasPessoas.length > 0 && (
        <fieldset className="mt-2.5">
          <legend className="text-xs font-medium text-muted-foreground">
            Marcar alguém da equipe (opcional)
          </legend>
          <div className="mt-1.5 flex flex-wrap gap-2">
            {outrasPessoas.map((p) => (
              <label
                key={p.id}
                className="flex min-h-11 cursor-pointer items-center gap-1.5 rounded-full border border-border bg-card px-3 text-xs md:min-h-8"
              >
                <input
                  type="checkbox"
                  checked={mencionados.includes(p.id)}
                  onChange={(e) =>
                    setMencionados(
                      e.target.checked
                        ? [...mencionados, p.id]
                        : mencionados.filter((m) => m !== p.id)
                    )
                  }
                  className="size-3.5 accent-[var(--brand-lime)]"
                />
                {p.nome_social || p.nome}
              </label>
            ))}
          </div>
        </fieldset>
      )}
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <ChamadoAnexos chamadoId={chamadoId} interno={modo === "interno"} />
        <Button size="sm" disabled={busy || pending || !texto.trim()} onClick={enviar}>
          {busy && <CircleNotch size={14} className="animate-spin" aria-hidden />}
          {modo === "interno" ? "Comentar" : "Enviar ao autor"}
        </Button>
      </div>
    </div>
  );
}

/** Composer do autor: acrescenta informação à trilha pública. */
function AutorComposer({
  chamadoId,
  meuNome,
  pending,
}: {
  chamadoId: string;
  meuNome: string;
  pending: boolean;
}) {
  const router = useRouter();
  const [busy, start] = useTransition();
  const [texto, setTexto] = useState("");
  return (
    <div>
      <Label htmlFor="autor-info" className="text-sm font-medium">
        Acrescentar informação
      </Label>
      <Textarea
        id="autor-info"
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        rows={3}
        maxLength={4000}
        className="mt-1.5"
        placeholder={`${meuNome.split(" ")[0]}, conte pra equipe se algo mudou ou se faltou detalhe…`}
      />
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <ChamadoAnexos chamadoId={chamadoId} interno={false} />
        <Button
          size="sm"
          disabled={busy || pending || !texto.trim()}
          onClick={() =>
            start(async () => {
              const r = await acrescentarInfoChamado(chamadoId, texto);
              if (r.error) toast.error(r.error);
              else {
                toast.success("Informação enviada à equipe.");
                setTexto("");
                router.refresh();
              }
            })
          }
        >
          {busy && <CircleNotch size={14} className="animate-spin" aria-hidden />}
          Enviar
        </Button>
      </div>
    </div>
  );
}

export type EquipeLinha = Pick<Profile, "id" | "nome" | "nome_social" | "role">;
