"use client";

import { type CSSProperties, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowUpRight,
  Binoculars,
  CalendarPlus,
  ChatsCircle,
  CheckCircle,
  ClockCounterClockwise,
  Eye,
  Flag,
  GraduationCap,
  PauseCircle,
  Sparkle,
  Users,
  VideoCamera,
  Warning,
  WarningOctagon,
} from "@phosphor-icons/react";
import { AgendarEncontroDialog } from "@/components/agendar-encontro-dialog";
import { Avatar } from "@/components/avatar";
import { Button, buttonVariants } from "@/components/ui/button";
import { filterChipCls } from "@/components/ui/filter-chip";
import { avatarPublicUrl } from "@/lib/avatar";
import {
  deriveAgendaMinha,
  filtraAgenda,
  primeiroNomeDaDupla,
  type AgendaItem,
  type AgendaMinhaDerivada,
  type AvisoAgenda,
  type EscopoAgenda,
  type AgendaSecao,
} from "@/lib/agenda-minha";
import type {
  CicloEvento,
  Cronograma,
  Dupla,
  Supervisao,
  TrilhaJovem,
} from "@/lib/types";
import { cn } from "@/lib/utils";

// ---------- peças visuais ----------

const TOM_TAG: Record<string, string> = {
  ok: "bg-[var(--ok)]/10 text-[var(--ok-text)]",
  warn: "bg-[var(--warn)]/12 text-[var(--warn-text)]",
  danger: "bg-destructive/10 text-destructive",
  info: "bg-[var(--info-bg)] text-[var(--info-text)]",
  muted: "bg-muted text-muted-foreground",
};

function Tag({ tom, children }: { tom?: string | null; children: React.ReactNode }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
        tom ? TOM_TAG[tom] : "bg-muted text-muted-foreground"
      )}
    >
      {children}
    </span>
  );
}

const ICONE_TIPO = {
  encontro: Users,
  sessao_esp: Sparkle,
  supervisao: ChatsCircle,
  programa: Flag,
  a_agendar: CalendarPlus,
} as const;

function iconeDoItem(item: AgendaItem): React.ReactNode {
  // formação tem ícone próprio — o resto dos "programa" é evento oficial
  const Icone =
    item.tipo === "programa" && item.rotulo.startsWith("Formação")
      ? GraduationCap
      : ICONE_TIPO[item.tipo];
  return <Icone size={13} aria-hidden className="shrink-0" />;
}

/** Ações do item — decodifica os marcadores declarativos da derivação nos
 *  controles reais: link de chamada, deep-link de registro e o mesmo
 *  AgendarEncontroDialog da ficha/agenda semanal (nada de fluxo paralelo). */
function AcoesItem({ item, dupla }: { item: AgendaItem; dupla: Dupla | undefined }) {
  if (item.acoes.length === 0) return null;
  const jovemNome = dupla ? primeiroNomeDaDupla(dupla) : undefined;
  return (
    <div className="mt-2.5 flex flex-wrap items-center gap-2">
      {item.acoes.includes("entrar") && item.link && (
        <a
          href={item.link}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-[var(--ok)]/40 bg-[var(--ok)]/10 px-2.5 text-xs font-medium text-[var(--ok-text)] transition-colors hover:bg-[var(--ok)]/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:min-h-9"
        >
          <VideoCamera size={14} aria-hidden />
          Entrar na chamada
          <span className="sr-only"> (abre em nova aba)</span>
        </a>
      )}
      {item.acoes.includes("registrar") && item.encontro && item.duplaId && (
        <Link
          href={`/duplas/${item.duplaId}#registrar-${item.encontro.id}`}
          className={buttonVariants({ variant: "default", size: "sm" })}
        >
          Registrar como foi
        </Link>
      )}
      {item.acoes.includes("remarcar") && item.encontro && item.duplaId && (
        <AgendarEncontroDialog
          duplaId={item.duplaId}
          numero={item.encontro.numero}
          atual={item.encontro}
          piso={dupla?.iniciada_em ?? undefined}
          jovemNome={jovemNome}
          trigger={
            <Button variant="outline" size="sm">
              <CalendarPlus size={14} aria-hidden />
              Remarcar
            </Button>
          }
        />
      )}
      {item.acoes.includes("agendar") && item.duplaId && item.numero != null && (
        <AgendarEncontroDialog
          duplaId={item.duplaId}
          numero={item.numero}
          atual={null}
          sugerido={item.sugeridoDia ?? undefined}
          piso={dupla?.iniciada_em ?? undefined}
          jovemNome={jovemNome}
          trigger={
            <Button size="sm">
              <CalendarPlus size={14} aria-hidden />
              Agendar
            </Button>
          }
        />
      )}
    </div>
  );
}

function LinhaItem({
  item,
  dupla,
  indice,
}: {
  item: AgendaItem;
  dupla: Dupla | undefined;
  indice: number;
}) {
  return (
    <li
      className="animate-enter"
      style={{ "--i": Math.min(indice, 10) } as CSSProperties}
    >
      <article
        className={cn(
          "rounded-xl border bg-card px-3.5 py-3",
          (item.convidado || item.tipo === "a_agendar") && "border-dashed",
          item.convidado && "bg-[var(--warn)]/[0.03]"
        )}
      >
        <div className="flex gap-3">
          {/* coluna de horário — itens por dia (supervisão, programa, "a
              agendar") não fingem hora que o domínio não tem */}
          <div className="w-12 shrink-0 pt-0.5 text-right">
            {item.hora ? (
              <>
                <span className="block text-sm font-semibold tabular-nums">
                  {item.hora}
                </span>
                {item.fim && (
                  <span className="block text-xs leading-tight text-muted-foreground tabular-nums">
                    até {item.fim}
                  </span>
                )}
              </>
            ) : (
              <span aria-hidden className="text-xs text-muted-foreground">
                —
              </span>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs font-medium text-muted-foreground">
              {iconeDoItem(item)}
              {item.rotulo}
            </p>
            <h3 className="mt-0.5 text-sm font-semibold leading-snug">
              {item.titulo}
            </h3>
            <div className="mt-1 flex flex-wrap items-center gap-1.5">
              {item.estado && <Tag tom={item.tom}>{item.estado}</Tag>}
              {item.notaConvidado && (
                <Tag tom="warn">
                  <Eye size={11} aria-hidden />
                  {item.notaConvidado}
                </Tag>
              )}
            </div>
            {item.meta.length > 0 && (
              <div className="mt-1 space-y-0.5">
                {item.meta.map((m) => (
                  <p key={m} className="text-xs leading-snug text-muted-foreground">
                    {m}
                  </p>
                ))}
              </div>
            )}
            <AcoesItem item={item} dupla={dupla} />
          </div>
        </div>
      </article>
    </li>
  );
}

/** Warnrow do topo do "Hoje" — a pendência é tarefa do mentor (registrar o
 *  encontro, resolver o combinado), não só um evento do dia. Limbo traz
 *  "Remarcar" além do registro porque a pergunta real é "rolou?". */
function LinhaAviso({ aviso, dupla }: { aviso: AvisoAgenda; dupla: Dupla | undefined }) {
  const limbo = aviso.remarcar;
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-[var(--warn)]/40 bg-[var(--warn)]/[0.07] px-3.5 py-3">
      <ClockCounterClockwise
        size={20}
        aria-hidden
        className="shrink-0 text-[var(--warn-text)]"
      />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold leading-snug">{aviso.titulo}</p>
        <p className="text-xs leading-snug text-muted-foreground">{aviso.detalhe}</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Link
          href={aviso.href}
          className={buttonVariants({ variant: "default", size: "sm" })}
        >
          {limbo ? "Registrar como foi" : aviso.cta}
        </Link>
        {limbo && aviso.encontro && (
          <AgendarEncontroDialog
            duplaId={aviso.duplaId}
            numero={aviso.encontro.numero}
            atual={aviso.encontro}
            piso={dupla?.iniciada_em ?? undefined}
            jovemNome={dupla ? primeiroNomeDaDupla(dupla) : undefined}
            trigger={
              <Button variant="outline" size="sm">
                <CalendarPlus size={14} aria-hidden />
                Remarcar
              </Button>
            }
          />
        )}
      </div>
    </div>
  );
}

function Secao({
  secao,
  avisos,
  duplasPorId,
}: {
  secao: AgendaSecao;
  /** warnrows — só a seção "hoje" as recebe; as outras passam []. */
  avisos: AvisoAgenda[];
  duplasPorId: Map<string, Dupla>;
}) {
  const vazia = secao.grupos.length === 0;
  return (
    <section aria-label={`Agenda de ${secao.titulo.toLowerCase()}`}>
      <div className="flex items-baseline gap-2.5">
        <h2 className="text-base font-semibold">{secao.titulo}</h2>
        {secao.sub && (
          <p className="text-xs text-muted-foreground">{secao.sub}</p>
        )}
      </div>
      <div className="mt-2.5 space-y-2">
        {avisos.map((av) => (
          <LinhaAviso key={av.id} aviso={av} dupla={duplasPorId.get(av.duplaId)} />
        ))}
        {vazia && avisos.length === 0 && (
          <p className="rounded-xl border border-dashed px-3.5 py-3 text-sm text-muted-foreground">
            {secao.id === "hoje"
              ? "Nada para hoje."
              : secao.id === "amanha"
                ? "Nada para amanhã."
                : "Nada marcado depois de amanhã."}
          </p>
        )}
        {secao.grupos.map((g) => (
          <div key={g.dia ?? "sem-data"}>
            {g.rotulo && (
              <h3 className="mb-1.5 mt-4 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                {g.rotulo}
              </h3>
            )}
            <ul className="space-y-2">
              {g.itens.map((item, i) => (
                <LinhaItem
                  key={item.id}
                  item={item}
                  dupla={item.duplaId ? duplasPorId.get(item.duplaId) : undefined}
                  indice={i}
                />
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}

// ---------- rail ----------

const SEMAFORO = {
  ok: { Icon: CheckCircle, cls: "text-[var(--ok-text)]", tag: "ok" },
  atencao: { Icon: Warning, cls: "text-[var(--warn-text)]", tag: "warn" },
  risco: { Icon: WarningOctagon, cls: "text-destructive", tag: "danger" },
} as const;

function Rail({ agenda }: { agenda: AgendaMinhaDerivada }) {
  const { semana, duplasRail } = agenda;
  const nadaNaSemana =
    semana.encontros === 0 &&
    semana.sessoesEsp === 0 &&
    semana.supervisoes === 0 &&
    semana.programas === 0 &&
    semana.pendencias === 0;
  return (
    <aside className="space-y-4 lg:pt-1" aria-label="Resumo da agenda">
      <section className="rounded-xl border bg-card p-4">
        <h2 className="text-sm font-semibold">Esta semana</h2>
        <div className="mt-2.5 space-y-2.5 text-xs">
          {nadaNaSemana && (
            <p className="text-muted-foreground">Semana livre por aqui.</p>
          )}
          {semana.encontros > 0 && (
            <p className="flex items-start gap-2">
              <Users size={15} aria-hidden className="mt-0.5 shrink-0 text-muted-foreground" />
              <span>
                <b className="font-medium">
                  {semana.encontros}{" "}
                  {semana.encontros === 1 ? "encontro" : "encontros"}
                </b>
                {semana.encontrosDetalhe ? ` — ${semana.encontrosDetalhe}` : ""}
                {semana.realizados > 0 && (
                  <span className="text-[var(--ok-text)]">
                    {" "}
                    · {semana.realizados}{" "}
                    {semana.realizados === 1 ? "realizado" : "realizados"}
                  </span>
                )}
              </span>
            </p>
          )}
          {semana.sessoesEsp > 0 && (
            <p className="flex items-start gap-2">
              <Sparkle size={15} aria-hidden className="mt-0.5 shrink-0 text-muted-foreground" />
              <span>
                <b className="font-medium">
                  {semana.sessoesEsp}{" "}
                  {semana.sessoesEsp === 1 ? "sessão de especialista" : "sessões de especialista"}
                </b>
                {semana.sessoesEspDetalhe ? ` — ${semana.sessoesEspDetalhe}` : ""}{" "}
                <span className="text-muted-foreground">(você acompanha)</span>
              </span>
            </p>
          )}
          {semana.supervisoes > 0 && (
            <p className="flex items-start gap-2">
              <Binoculars size={15} aria-hidden className="mt-0.5 shrink-0 text-muted-foreground" />
              <span>
                <b className="font-medium">
                  {semana.supervisoes}{" "}
                  {semana.supervisoes === 1 ? "supervisão" : "supervisões"}
                </b>
              </span>
            </p>
          )}
          {semana.programas > 0 && (
            <p className="flex items-start gap-2">
              <Flag size={15} aria-hidden className="mt-0.5 shrink-0 text-muted-foreground" />
              <span>
                <b className="font-medium">
                  {semana.programas}{" "}
                  {semana.programas === 1 ? "evento do programa" : "eventos do programa"}
                </b>
              </span>
            </p>
          )}
          {semana.pendencias > 0 && (
            <p className="flex items-start gap-2 text-[var(--warn-text)]">
              <Warning size={15} aria-hidden className="mt-0.5 shrink-0" />
              <span>
                <b className="font-medium">
                  {semana.pendencias}{" "}
                  {semana.pendencias === 1 ? "pendência" : "pendências"}
                </b>{" "}
                — {semana.pendencias === 1 ? "está" : "estão"} no topo de hoje
              </span>
            </p>
          )}
        </div>
      </section>

      <section className="rounded-xl border bg-card p-4">
        <h2 className="text-sm font-semibold">Suas duplas</h2>
        <ul className="mt-2 space-y-1">
          {duplasRail.map((d) => {
            const foraDaRegua = d.status !== "ativa";
            const sem = SEMAFORO[d.saude.semaforo];
            const Icon = foraDaRegua ? PauseCircle : sem.Icon;
            return (
              <li key={d.id}>
                <Link
                  href={`/duplas/${d.id}`}
                  className="group flex min-h-11 items-center gap-2.5 rounded-lg px-1.5 py-1.5 transition-colors hover:bg-muted/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <Avatar
                    nome={d.nome}
                    src={
                      d.avatarPath ? avatarPublicUrl(d.avatarPath) : undefined
                    }
                    papel="mentorado"
                    size={30}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">
                      {d.nome}{" "}
                      <span className="text-xs font-normal text-muted-foreground">
                        · {d.turma}
                      </span>
                    </span>
                    <span
                      className={cn(
                        "mt-0.5 flex items-center gap-1 text-xs",
                        foraDaRegua ? "text-muted-foreground" : sem.cls
                      )}
                    >
                      <Icon size={12} aria-hidden className="shrink-0" />
                      {d.saude.motivo}
                      {d.proximoTexto ? ` · ${d.proximoTexto}` : ""}
                    </span>
                  </span>
                  <ArrowUpRight
                    size={13}
                    aria-hidden
                    className="shrink-0 text-muted-foreground transition-colors group-hover:text-foreground"
                  />
                </Link>
              </li>
            );
          })}
        </ul>
      </section>
    </aside>
  );
}

// ---------- componente ----------

export type AgendaMinhaProps = {
  /** Só as duplas DPP do mentor — a page já filtra `trilha !== "especialista"`. */
  duplas: Dupla[];
  /** Trilhas de especialista dos jovens por dupla DPP — projeção de leitura
   *  (sem link de chamada: o mentor acompanha, não participa). */
  trilhas: Record<string, TrilhaJovem[]>;
  eventos: CicloEvento[];
  cronogramas: Cronograma[];
  supervisoes: Supervisao[];
  /** profile_id do mentor — separa supervisão recebida da conduzida. */
  meuId: string;
  /** "YYYY-MM-DD" — a page resolve no server; aqui o valor ancora os buckets. */
  hoje: string;
  /** epoch ms — o mesmo instante que gerou `hoje` no server. Sem ele o memo
   *  usaria Date.now() no cliente e SSR×hidratação podiam discordar na
   *  janela de 15min do "Entrar" (hydration mismatch). */
  agora: number;
};

export function AgendaMinha({
  duplas,
  trilhas,
  eventos,
  cronogramas,
  supervisoes,
  meuId,
  hoje,
  agora,
}: AgendaMinhaProps) {
  const [escopo, setEscopo] = useState<EscopoAgenda>("tudo");
  const agenda = useMemo(
    () =>
      deriveAgendaMinha({
        duplas,
        trilhas,
        eventos,
        cronogramas,
        supervisoes,
        meuId,
        hoje,
        agora,
      }),
    [duplas, trilhas, eventos, cronogramas, supervisoes, meuId, hoje, agora]
  );
  const { avisos, secoes } = useMemo(
    () => filtraAgenda(agenda, escopo),
    [agenda, escopo]
  );
  const duplasPorId = useMemo(
    () => new Map(duplas.map((d) => [d.id, d])),
    [duplas]
  );

  if (duplas.length === 0) {
    return (
      <div className="rounded-xl bg-card px-5 py-10 text-center shadow-[var(--shadow-border)]">
        <p className="text-sm text-muted-foreground">
          Você ainda não está em nenhuma dupla. Quando a coordenação formar
          uma, seus encontros aparecem aqui — junto com a agenda que seu
          mentorado tem com os especialistas.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* escopo interno — estado local, nunca URL: é um recorte de leitura,
          não um endereço compartilhável */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <span className="text-xs font-medium text-muted-foreground">
          Agenda de:
        </span>
        <div role="group" aria-label="Escopo da agenda" className="flex flex-wrap gap-1.5">
          {agenda.chips.map((chip) => (
            <button
              key={chip.id}
              type="button"
              aria-pressed={escopo === chip.id}
              onClick={() => setEscopo(chip.id)}
              className={filterChipCls(escopo === chip.id)}
            >
              {chip.rotulo}
            </button>
          ))}
        </div>
      </div>
      <p className="text-xs leading-relaxed text-muted-foreground">
        “Tudo” inclui o que seus jovens têm marcado — itens que não são seus
        vêm sinalizados “você não participa”.
      </p>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_290px]">
        <div className="min-w-0 space-y-6">
          {secoes.map((s) => (
            <Secao
              key={s.id}
              secao={s}
              avisos={s.id === "hoje" ? avisos : []}
              duplasPorId={duplasPorId}
            />
          ))}
        </div>
        <Rail agenda={agenda} />
      </div>
    </div>
  );
}
