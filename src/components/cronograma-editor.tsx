"use client";

// Editor do cronograma (/turmas/[id], REALIZA-103): metadados da turma,
// transições de status, e a lista oficial de eventos — adicionar, editar,
// remover e reordenar (setas gravam `ordem` explícita; a sequência do PDF não
// depende de data, então etapas concluídas sem data ficam onde devem).
// Com duplas vinculadas o aviso lembra que editar mexe no semáforo delas.

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ArrowDown,
  ArrowUp,
  CheckCircle,
  CircleNotch,
  Flag,
  GraduationCap,
  PencilSimple,
  Plus,
  Trash,
  UsersThree,
  Warning,
} from "@phosphor-icons/react";
import {
  atualizarCronograma,
  excluirCronograma,
  excluirEvento,
  moverEvento,
  salvarEventoCronograma,
} from "@/lib/actions-cronogramas";
import {
  normalizaEvento,
  type EventoRascunho,
  type TipoEvento,
} from "@/lib/gerador-cronograma";
import { formatDiaSemanaMes } from "@/lib/ciclo";
import type { VinculoCronograma } from "@/lib/queries-cronogramas";
import type { CicloEvento, Cronograma, DuplaStatus } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDeleteButton } from "@/components/confirm-delete-button";
import { EventoCronogramaDialog } from "@/components/evento-cronograma-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

const STATUS_LABEL: Record<Cronograma["status"], string> = {
  rascunho: "Rascunho",
  ativo: "Ativo",
  encerrado: "Encerrado",
};

const STATUS_BADGE: Record<Cronograma["status"], string> = {
  rascunho: "border-dashed",
  ativo: "",
  encerrado: "",
};

export function StatusBadge({ status }: { status: Cronograma["status"] }) {
  return (
    <Badge
      variant={status === "ativo" ? "secondary" : "outline"}
      className={STATUS_BADGE[status]}
    >
      {STATUS_LABEL[status]}
    </Badge>
  );
}

function rascunhoDe(e: CicloEvento): EventoRascunho {
  return {
    tipo: e.tipo,
    numero: e.numero,
    data: e.data,
    data_fim: e.data_fim,
    titulo: e.titulo,
    fase: e.fase,
    instrumentos: e.instrumentos,
    status: e.status,
    observacao: e.observacao,
  };
}

const rascunhoNovo = (proximoNumero: number): EventoRascunho => ({
  tipo: "encontro",
  numero: proximoNumero,
  data: null,
  data_fim: null,
  titulo: "",
  fase: null,
  instrumentos: [],
  status: "pendente",
  observacao: null,
});

// ---------- ações do cabeçalho ----------

/** Confirm de intenção não-destrutiva (Ativar/Encerrar/Reabrir) — o
 *  ConfirmDeleteButton do projeto é vermelho por desenho; aqui o botão de
 *  confirmação segue a variante default. */
function ConfirmarAcao({
  trigger,
  titulo,
  descricao,
  acao,
  onConfirm,
}: {
  trigger: React.ReactElement;
  titulo: string;
  descricao: string;
  acao: string;
  onConfirm: () => Promise<{ error?: string; ok?: boolean }>;
}) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{titulo}</DialogTitle>
        </DialogHeader>
        <DialogDescription className="leading-relaxed">
          {descricao}
        </DialogDescription>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button
            disabled={pending}
            onClick={() =>
              start(async () => {
                try {
                  const res = await onConfirm();
                  if ("error" in res && res.error) toast.error(res.error);
                  else {
                    toast.success("Pronto.");
                    setOpen(false);
                    router.refresh();
                  }
                } catch {
                  toast.error("Sem conexão. Tente de novo.");
                }
              })
            }
          >
            {pending && <CircleNotch className="animate-spin" />}
            {acao}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Ações do cabeçalho do detalhe: status, metadados e exclusão. */
export function CronogramaAcoes({
  cronograma,
  vinculadas,
  totalVinculos,
  readOnly,
}: {
  cronograma: Cronograma;
  /** duplas ativas+pausadas que seguem este calendário */
  vinculadas: number;
  /** todas as duplas vinculadas — a exclusão só é liberada com zero */
  totalVinculos: number;
  readOnly: boolean;
}) {
  const router = useRouter();
  const [metaOpen, setMetaOpen] = useState(false);
  const [pending, start] = useTransition();
  const [statusSel, setStatusSel] = useState(cronograma.status);

  if (readOnly) return null;

  const avisoDuplas =
    vinculadas > 0
      ? ` ${vinculadas} ${vinculadas === 1 ? "dupla segue" : "duplas seguem"} este calendário — mudanças de datas e números mexem no semáforo delas.`
      : "";

  return (
    <>
      {cronograma.status === "rascunho" && (
        <ConfirmarAcao
          trigger={
            <Button size="sm">Ativar cronograma</Button>
          }
          titulo="Ativar este cronograma?"
          descricao={`Ele passa a aparecer como calendário vigente e pode ser escolhido ao parear novas duplas.${avisoDuplas}`}
          acao="Ativar"
          onConfirm={() => atualizarCronograma(cronograma.id, { status: "ativo" })}
        />
      )}
      {cronograma.status === "ativo" && (
        <ConfirmarAcao
          trigger={
            <Button size="sm" variant="outline">
              Encerrar cronograma
            </Button>
          }
          titulo="Encerrar este cronograma?"
          descricao={`Ele sai do lugar de calendário vigente — a agenda das duplas continua apontando pra ele, mas novas duplas não devem mais entrar. Reabrir é possível depois.${avisoDuplas}`}
          acao="Encerrar"
          onConfirm={() => atualizarCronograma(cronograma.id, { status: "encerrado" })}
        />
      )}
      {cronograma.status === "encerrado" && (
        <ConfirmarAcao
          trigger={
            <Button size="sm" variant="outline">
              Reabrir como ativo
            </Button>
          }
          titulo="Reabrir este cronograma?"
          descricao="Ele volta a participar da disputa de calendário vigente."
          acao="Reabrir"
          onConfirm={() => atualizarCronograma(cronograma.id, { status: "ativo" })}
        />
      )}

      {/* metadados */}
      <Dialog
        open={metaOpen}
        onOpenChange={(o) => {
          setMetaOpen(o);
          if (o) setStatusSel(cronograma.status);
        }}
      >
        <DialogTrigger
          render={
            <Button size="sm" variant="outline" aria-label="Editar dados do cronograma">
              <PencilSimple aria-hidden />
              Editar dados
            </Button>
          }
        />
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Dados do cronograma</DialogTitle>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              start(async () => {
                try {
                  const res = await atualizarCronograma(cronograma.id, {
                    nome: String(fd.get("nome") ?? ""),
                    turma: String(fd.get("turma") ?? ""),
                    status: statusSel,
                  });
                  if ("error" in res && res.error) toast.error(res.error);
                  else {
                    toast.success("Cronograma atualizado.");
                    setMetaOpen(false);
                    router.refresh();
                  }
                } catch {
                  toast.error("Sem conexão. Tente de novo.");
                }
              });
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="cg-nome">Nome do cronograma</Label>
              <Input
                id="cg-nome"
                name="nome"
                required
                maxLength={120}
                defaultValue={cronograma.nome}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cg-turma">Turma</Label>
              <Input
                id="cg-turma"
                name="turma"
                required
                maxLength={80}
                defaultValue={cronograma.turma}
              />
              {vinculadas > 0 && (
                <p className="text-xs text-muted-foreground">
                  As {vinculadas} {vinculadas === 1 ? "dupla vinculada guarda" : "duplas vinculadas guardam"} a
                  label de turma gravada no pareamento — renomear aqui não
                  reescreve a ficha delas.
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label id="cg-status-label">Status</Label>
              <Select
                value={statusSel}
                items={STATUS_LABEL}
                onValueChange={(v) => setStatusSel(v as Cronograma["status"])}
              >
                <SelectTrigger aria-labelledby="cg-status-label">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(STATUS_LABEL).map(([v, l]) => (
                    <SelectItem key={v} value={v}>
                      {l}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button type="submit" disabled={pending}>
                {pending && <CircleNotch className="animate-spin" />}
                {pending ? "Salvando…" : "Salvar"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDeleteButton
        dica="Excluir cronograma"
        titulo={`Excluir "${cronograma.nome}"?`}
        descricao={
          totalVinculos > 0
            ? `A exclusão só é liberada sem duplas vinculadas — e ${totalVinculos === 1 ? "há 1 dupla" : `há ${totalVinculos} duplas`} apontando pra este calendário. Remaneje as duplas ou encerre o cronograma.`
            : "O cronograma e todos os eventos saem do calendário oficial. A exclusão é definitiva."
        }
        sucesso="Cronograma excluído."
        onConfirm={async () => {
          const res = await excluirCronograma(cronograma.id);
          if ("ok" in res) router.push("/turmas");
          return res;
        }}
        trigger={
          <Button
            size="icon"
            variant="ghost"
            aria-label="Excluir cronograma"
            className="text-destructive hover:text-destructive"
          >
            <TrashIcon />
          </Button>
        }
      />
    </>
  );
}

function TrashIcon() {
  return <Trash size={15} aria-hidden />;
}

// ---------- lista de eventos ----------

/** Seção do PDF pela posição na sequência: tudo antes do 1º encontro é
 *  preparação; `evento_encerramento` é encerramento; o meio é mentoria. */
function secaoDe(i: number, e: CicloEvento, primeiroEncontro: number): string {
  if (e.tipo === "evento_encerramento") return "Encerramento";
  if (primeiroEncontro >= 0 && i >= primeiroEncontro) return "Mentoria ativa";
  return "Preparação";
}

/** Marcador tipográfico do tipo — mesmo vocabulário visual da agenda
 *  (dot de cor + palavra discreta, não pill). */
function MarcadorTipo({ tipo }: { tipo: TipoEvento }) {
  const cls = "inline-flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground";
  switch (tipo) {
    case "encontro":
      return (
        <span className={cls}>
          <span aria-hidden className="size-1.5 rounded-full bg-[var(--brand-lime)]" />
          encontro
        </span>
      );
    case "formacao":
      return (
        <span className={cls}>
          <GraduationCap aria-hidden size={13} weight="bold" className="text-[var(--warn-text)]" />
          formação
        </span>
      );
    case "recesso":
      return (
        <span className={cls}>
          <span aria-hidden className="hatch-recesso h-2.5 w-4 rounded-[3px] ring-1 ring-inset ring-border" />
          recesso
        </span>
      );
    case "etapa_preparacao":
      return (
        <span className={cls}>
          <CheckCircle aria-hidden size={13} weight="bold" />
          etapa
        </span>
      );
    case "evento_encerramento":
      return (
        <span className={cls}>
          <Flag aria-hidden size={13} weight="fill" className="text-[var(--ok-text)]" />
          encerramento
        </span>
      );
  }
}

function dataFormatada(e: CicloEvento): string {
  if (!e.data) return "a definir";
  const ini = formatDiaSemanaMes(e.data);
  if (e.data_fim && e.data_fim !== e.data)
    return `${ini} → ${formatDiaSemanaMes(e.data_fim)}`;
  return ini;
}

export function CronogramaEventos({
  cronograma,
  eventos,
  vinculadas,
  readOnly,
}: {
  cronograma: Cronograma;
  /** já ordenado por `ordem` (eventosDoCronograma no server) */
  eventos: CicloEvento[];
  vinculadas: number;
  readOnly: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [editando, setEditando] = useState<CicloEvento | null>(null);
  const [novoAberto, setNovoAberto] = useState(false);
  const [posicao, setPosicao] = useState<string>("fim");

  const proximoNumero = useMemo(
    () =>
      eventos.reduce(
        (m, e) => (e.tipo === "encontro" && e.numero != null ? Math.max(m, e.numero) : m),
        0
      ) + 1,
    [eventos]
  );

  const primeiroEncontro = eventos.findIndex((e) => e.tipo === "encontro");

  /** Wrapper comum das mutations de evento: toast + refresh; devolve se
   *  deu certo pro caller fechar o dialog. */
  function agir(
    fn: () => Promise<{ error?: string; ok?: boolean }>,
    ok: string
  ): Promise<boolean> {
    return new Promise((resolve) =>
      start(async () => {
        try {
          const res = await fn();
          if ("error" in res && res.error) {
            toast.error(res.error);
            resolve(false);
          } else {
            toast.success(ok);
            router.refresh();
            resolve(true);
          }
        } catch {
          toast.error("Sem conexão. Tente de novo.");
          resolve(false);
        }
      })
    );
  }

  const opcoesPosicao = useMemo(() => {
    const m: Record<string, string> = { fim: "No fim da sequência" };
    eventos.forEach((e, i) => {
      m[`apos:${i}`] = `Depois de ${i + 1}. ${e.titulo}`;
    });
    return m;
  }, [eventos]);

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold">
          Calendário oficial
          <span className="ml-2 font-normal text-muted-foreground">
            {eventos.length} {eventos.length === 1 ? "evento" : "eventos"} na
            sequência do guia
          </span>
        </h2>
        {!readOnly && (
          <div className="flex items-center gap-2">
            <Select
              value={posicao}
              items={opcoesPosicao}
              onValueChange={(v) => v && setPosicao(v)}
            >
              <SelectTrigger
                size="sm"
                aria-label="Posição do novo evento na sequência"
                className="max-w-56"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(opcoesPosicao).map(([v, l]) => (
                  <SelectItem key={v} value={v}>
                    {l}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              size="sm"
              variant="outline"
              disabled={pending}
              onClick={() => setNovoAberto(true)}
            >
              <Plus aria-hidden />
              Adicionar evento
            </Button>
          </div>
        )}
      </div>

      {vinculadas > 0 && !readOnly && (
        <p className="flex items-start gap-2 rounded-lg bg-muted/60 px-4 py-2.5 text-sm text-muted-foreground">
          <Warning aria-hidden size={16} className="mt-0.5 shrink-0 text-[var(--warn-text)]" />
          <span>
            {vinculadas} {vinculadas === 1 ? "dupla segue" : "duplas seguem"} este
            calendário — mudar datas, números ou remover encontros altera o
            semáforo e a trilha delas.
          </span>
        </p>
      )}

      {eventos.length === 0 ? (
        <div className="rounded-xl bg-card px-6 py-10 text-center shadow-[var(--shadow-border)]">
          <p className="font-medium">Nenhum evento ainda.</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {readOnly
              ? "O calendário desta turma está vazio."
              : "Adicione o primeiro evento — ou apague o rascunho e crie de novo pelo builder."}
          </p>
        </div>
      ) : (
        <ol className="overflow-hidden rounded-xl bg-card shadow-[var(--shadow-border)]">
          {eventos.map((e, i) => {
            const secao = secaoDe(i, e, primeiroEncontro);
            const anterior = i > 0 ? secaoDe(i - 1, eventos[i - 1], primeiroEncontro) : null;
            return (
              <li key={e.id}>
                {secao !== anterior && (
                  <div
                    className={cn(
                      "px-4 pb-1 pt-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground sm:px-5",
                      i > 0 && "border-t"
                    )}
                  >
                    {secao}
                  </div>
                )}
                <div
                  className={cn(
                    "flex items-start gap-2 px-3 py-2.5 sm:items-center sm:gap-3 sm:px-5",
                    i > 0 && secao === anterior && "border-t border-border/50"
                  )}
                >
                  <span className="w-5 shrink-0 pt-0.5 text-right text-xs tabular-nums text-muted-foreground sm:pt-0">
                    {i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                      {e.tipo === "encontro" && e.numero != null && (
                        <span className="text-sm font-semibold tabular-nums">
                          {e.numero}º
                        </span>
                      )}
                      <span className="text-sm font-medium">{e.titulo}</span>
                      <MarcadorTipo tipo={e.tipo} />
                      {e.tipo === "etapa_preparacao" && e.status === "concluida" && (
                        <Badge variant="secondary">concluída</Badge>
                      )}
                    </div>
                    <div className="mt-0.5 flex flex-wrap items-baseline gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                      <span className="tabular-nums">{dataFormatada(e)}</span>
                      {e.fase && <span>{e.fase}</span>}
                      {e.instrumentos.length > 0 && (
                        <span>{e.instrumentos.join(" · ")}</span>
                      )}
                      {e.observacao && <span className="italic">{e.observacao}</span>}
                    </div>
                  </div>
                  {!readOnly && (
                    <div className="flex shrink-0 items-center">
                      <Tooltip>
                        <TooltipTrigger
                          render={
                            <Button
                              variant="ghost"
                              size="icon"
                              aria-label={`Editar "${e.titulo}"`}
                              disabled={pending}
                              onClick={() => setEditando(e)}
                            >
                              <PencilSimple size={15} />
                            </Button>
                          }
                        />
                        <TooltipContent>Editar evento</TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger
                          render={
                            <Button
                              variant="ghost"
                              size="icon"
                              aria-label={`Mover "${e.titulo}" para cima`}
                              disabled={pending || i === 0}
                              onClick={() =>
                                agir(
                                  () => moverEvento(cronograma.id, e.id, -1),
                                  "Evento movido."
                                )
                              }
                            >
                              <ArrowUp size={15} />
                            </Button>
                          }
                        />
                        <TooltipContent>Mover para cima</TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger
                          render={
                            <Button
                              variant="ghost"
                              size="icon"
                              aria-label={`Mover "${e.titulo}" para baixo`}
                              disabled={pending || i === eventos.length - 1}
                              onClick={() =>
                                agir(
                                  () => moverEvento(cronograma.id, e.id, 1),
                                  "Evento movido."
                                )
                              }
                            >
                              <ArrowDown size={15} />
                            </Button>
                          }
                        />
                        <TooltipContent>Mover para baixo</TooltipContent>
                      </Tooltip>
                      <ConfirmDeleteButton
                        dica="Excluir evento"
                        titulo={`Excluir "${e.titulo}"?`}
                        descricao={
                          e.tipo === "encontro"
                            ? "O encontro oficial sai do calendário da turma — o semáforo das duplas recalcula sem ele. A exclusão é definitiva."
                            : "O evento sai do calendário oficial da turma. A exclusão é definitiva."
                        }
                        sucesso={`"${e.titulo}" removido do cronograma.`}
                        onConfirm={() => excluirEvento(cronograma.id, e.id)}
                      />
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      )}

      {editando && (
        <EventoCronogramaDialog
          open
          onOpenChange={(o) => !o && setEditando(null)}
          inicial={rascunhoDe(editando)}
          titulo={`Editar "${editando.titulo}"`}
          pending={pending}
          onSalvar={(r) =>
            agir(
              () =>
                salvarEventoCronograma({
                  id: editando.id,
                  cronograma_id: cronograma.id,
                  rascunho: r,
                }),
              "Evento atualizado."
            ).then((ok) => ok && setEditando(null))
          }
        />
      )}

      <EventoCronogramaDialog
        open={novoAberto}
        onOpenChange={setNovoAberto}
        inicial={rascunhoNovo(proximoNumero)}
        titulo="Novo evento no cronograma"
        pending={pending}
        onSalvar={(r) =>
          agir(() => {
            const p = posicao.startsWith("apos:")
              ? Number(posicao.slice(5)) + 1
              : undefined;
            return salvarEventoCronograma({
              cronograma_id: cronograma.id,
              rascunho: normalizaEvento(r),
              posicao: p,
            });
          }, "Evento adicionado.").then((ok) => ok && setNovoAberto(false))
        }
      />
    </section>
  );
}

// ---------- duplas vinculadas ----------

const DUPLA_STATUS_LABEL: Record<DuplaStatus, string> = {
  ativa: "ativa",
  pausada: "pausada",
  concluida: "concluída",
  encerrada: "encerrada",
};

export function CronogramaDuplas({ vinculos }: { vinculos: VinculoCronograma[] }) {
  if (!vinculos.length) return null;
  return (
    <section className="space-y-3">
      <h2 className="flex items-center gap-2 text-sm font-semibold">
        <UsersThree aria-hidden size={16} className="text-muted-foreground" />
        {vinculos.length} {vinculos.length === 1 ? "dupla segue" : "duplas seguem"}{" "}
        este calendário
      </h2>
      <ul className="divide-y overflow-hidden rounded-xl bg-card shadow-[var(--shadow-border)]">
        {vinculos.map((v) => (
          <li key={v.duplaId}>
            <Link
              href={`/duplas/${v.duplaId}`}
              className="flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-muted/50 sm:px-5"
            >
              <span className="min-w-0 flex-1 truncate text-sm">
                {v.mentoradoNome} <span className="text-muted-foreground">com</span>{" "}
                {v.mentorNome}
              </span>
              <Badge variant={v.status === "ativa" ? "secondary" : "outline"}>
                {DUPLA_STATUS_LABEL[v.status]}
              </Badge>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
