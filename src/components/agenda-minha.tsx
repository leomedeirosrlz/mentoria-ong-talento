"use client";

import { type CSSProperties, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowUpRight,
  CalendarPlus,
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
import { AcoesMenu, type AcaoMenuItem } from "@/components/acoes-menu";
import { Avatar } from "@/components/avatar";
import { Button, buttonVariants } from "@/components/ui/button";
import { FilterChipRow, filterChipCls } from "@/components/ui/filter-chip";
import { avatarPublicUrl } from "@/lib/avatar";
import {
  deriveAgendaMinha,
  filtraAgenda,
  primeiroNomeDaDupla,
  type AgendaAcaoTipo,
  type AgendaItem,
  type AgendaMinhaDerivada,
  type AvisoAgenda,
  type EscopoAgenda,
  type AgendaSecao,
} from "@/lib/agenda-minha";
import { turmaCurta } from "@/lib/turma";
import { ocupadosAgendados } from "@/lib/sugestoes-encontro";
import type {
  CicloEvento,
  Cronograma,
  Dupla,
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
  programa: Flag,
  a_agendar: CalendarPlus,
} as const;

/** Ícone do tipo — a coluna de horário o usa quando o item é por dia
 *  (programa, "a agendar") e não finge hora que o domínio não
 *  tem. Formação tem ícone próprio; o resto dos "programa" é evento
 *  oficial. */
function iconeDoItem(
  item: AgendaItem,
  size: number,
  className?: string
): React.ReactNode {
  const Icone =
    item.tipo === "programa" && item.rotulo.startsWith("Formação")
      ? GraduationCap
      : ICONE_TIPO[item.tipo];
  return <Icone size={size} aria-hidden className={className} />;
}

// tamanho e cor explícitos nos ícones do ⋯ — é o que alinha o texto do
// item com o da linha (mesma norma do ICONE do DuplaLinhaMenu)
const ICONE_MENU = "size-4 shrink-0 text-muted-foreground";

type DialogoItem = "agendar" | "remarcar";

// ordem fixa de urgência do "1 primário + ⋯" — a 1ª ação presente fica
// visível, o resto recolhe pro menu (remarcar é ajuste, nunca a decisão)
const ORDEM_ACOES: AgendaAcaoTipo[] = [
  "entrar",
  "registrar",
  "agendar",
  "remarcar",
];

/** Ações do item — "1 primário + ⋯": a derivação manda marcadores e aqui
 *  eles viram controles reais numa ordem fixa de urgência (entrar na
 *  chamada rolando → registrar → agendar → remarcar). Só a PRIMEIRA sai
 *  como controle visível; as demais recolhem pro AcoesMenu — a linha que
 *  chegava a 4 botões agora respira a 390px. `primario` vem da página:
 *  só UM CTA decisivo por agenda fica preenchido (o warnrow do topo tem
 *  precedência) — vale pro Registrar/Agendar quando eles são o visível.
 *
 *  Os AgendarEncontroDialog (mesmos da ficha/agenda semanal — nada de
 *  fluxo paralelo) ficam fora do popup, controlados por `dialogo`: fechar
 *  o menu não desmonta e o foco volta pro ⋯. A coluna é o 3º trilho da
 *  grade da linha — w-full no celular joga os controles pra uma linha
 *  própria, indentada sob o texto (ps = trilho w-14 + gap-x-3, mesmo
 *  alinhamento do EncontroLinha); em sm+ encolhe pro conteúdo e se
 *  centraliza na altura da linha. */
function AcoesItem({
  item,
  dupla,
  primario,
}: {
  item: AgendaItem;
  dupla: Dupla | undefined;
  primario: boolean;
}) {
  const [dialogo, setDialogo] = useState<DialogoItem | null>(null);
  const jovemNome = dupla ? primeiroNomeDaDupla(dupla) : undefined;
  const ocupadosDupla = ocupadosAgendados(dupla?.encontros ?? [], (e) => {
    const esp = dupla?.trilha === "especialista";
    const n = esp ? `${e.numero}ª sessão` : `${e.numero}º encontro`;
    return { rotulo: n, rotuloArtigo: esp ? `a ${n}` : `o ${n}` };
  });

  // filtrada pelas mesmas condições que cada controle exigia solto —
  // a 1ª que sobra é a visível
  const acoes = ORDEM_ACOES.filter((a) => item.acoes.includes(a)).filter((a) => {
    switch (a) {
      case "entrar":
        return item.link != null;
      case "registrar":
      case "remarcar":
        return item.encontro != null && item.duplaId != null;
      case "agendar":
        return item.duplaId != null && item.numero != null;
    }
  });
  const [primaria, ...resto] = acoes;
  if (item.acoes.length === 0 || primaria == null) return null;

  const itensMenu: AcaoMenuItem[] = resto
    .filter((a) => a !== "entrar")
    .map((a) => {
      switch (a) {
        case "registrar":
          return {
            id: a,
            rotulo: "Registrar como foi",
            icone: <CheckCircle aria-hidden className={ICONE_MENU} />,
            href: `/duplas/${item.duplaId}#registrar-${item.encontro!.id}`,
          };
        case "agendar":
          return {
            id: a,
            rotulo: "Agendar",
            icone: <CalendarPlus aria-hidden className={ICONE_MENU} />,
            onEscolher: () => setDialogo("agendar"),
          };
        default:
          // "remarcar" — único sobrando além dos de cima
          return {
            id: a,
            rotulo: "Remarcar",
            icone: <CalendarPlus aria-hidden className={ICONE_MENU} />,
            onEscolher: () => setDialogo("remarcar"),
          };
      }
    });

  return (
    <>
      <div className="flex w-full flex-wrap items-center justify-start gap-2 ps-[4.25rem] sm:ms-auto sm:w-auto sm:shrink-0 sm:justify-end sm:self-center sm:ps-0">
        {primaria === "entrar" && item.link && (
          <a
            href={item.link}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(
              buttonVariants({ variant: "outline", size: "sm" }),
              "border-[var(--ok)]/40 bg-[var(--ok)]/10 text-[var(--ok-text)] hover:bg-[var(--ok)]/15 hover:text-[var(--ok-text)]"
            )}
          >
            <VideoCamera aria-hidden />
            Entrar na chamada
            <span className="sr-only"> (abre em nova aba)</span>
          </a>
        )}
        {primaria === "registrar" && item.encontro && item.duplaId && (
          <Link
            href={`/duplas/${item.duplaId}#registrar-${item.encontro.id}`}
            className={buttonVariants({
              variant: primario ? "default" : "outline",
              size: "sm",
            })}
          >
            Registrar como foi
          </Link>
        )}
        {primaria === "agendar" && (
          <Button
            variant={primario ? "default" : "outline"}
            size="sm"
            onClick={() => setDialogo("agendar")}
          >
            <CalendarPlus aria-hidden />
            Agendar
          </Button>
        )}
        {primaria === "remarcar" && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setDialogo("remarcar")}
          >
            <CalendarPlus aria-hidden />
            Remarcar
          </Button>
        )}
        <AcoesMenu itens={itensMenu} label="Ações" />
      </div>

      {/* fora do popup, controlados — fechar o menu não desmonta o dialog
          e o foco volta pro ⋯ ao sair */}
      {item.acoes.includes("remarcar") && item.encontro && item.duplaId && (
        <AgendarEncontroDialog
          ocupados={ocupadosDupla}
          duplaId={item.duplaId}
          numero={item.encontro.numero}
          atual={item.encontro}
          piso={dupla?.iniciada_em ?? undefined}
          jovemNome={jovemNome}
          trigger={null}
          open={dialogo === "remarcar"}
          onOpenChange={(o) => setDialogo(o ? "remarcar" : null)}
        />
      )}
      {item.acoes.includes("agendar") &&
        item.duplaId &&
        item.numero != null && (
          <AgendarEncontroDialog
            duplaId={item.duplaId}
            numero={item.numero}
            atual={null}
            sugerido={item.sugeridoDia ?? undefined}
            piso={dupla?.iniciada_em ?? undefined}
            jovemNome={jovemNome}
            trigger={null}
            open={dialogo === "agendar"}
            onOpenChange={(o) => setDialogo(o ? "agendar" : null)}
          />
        )}
    </>
  );
}

function LinhaItem({
  item,
  dupla,
  indice,
  primario,
}: {
  item: AgendaItem;
  dupla: Dupla | undefined;
  indice: number;
  primario: boolean;
}) {
  return (
    <li
      className="animate-enter"
      style={{ "--i": Math.min(indice, 10) } as CSSProperties}
    >
      <article
        className={cn(
          "rounded-xl border bg-card px-4 py-3 sm:px-5",
          // convidado/a_agendar: tracejada é o marcador — "você não
          // participa" é info, não alerta (warn mentia urgência)
          (item.convidado || item.tipo === "a_agendar") && "border-dashed"
        )}
      >
        <div className="flex flex-wrap items-start gap-x-3 gap-y-2.5 sm:flex-nowrap sm:gap-x-4">
          {/* coluna de horário de largura fixa — itens por dia (programa,
              "a agendar") não fingem hora que o domínio não tem:
              o ícone do tipo ocupa o mesmo trilho, centralizado. No
              celular o trilho afunila (w-14) pra linha respirar; a partir
              do sm volta ao w-18 — e a linha de ações indenta sob o
              texto com ps = trilho + gap */}
          <div className="w-14 shrink-0 pt-0.5 text-center sm:w-18">
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
              iconeDoItem(item, 18, "inline text-muted-foreground")
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium text-muted-foreground">
              {item.rotulo}
            </p>
            <h3 className="mt-0.5 text-sm font-semibold leading-snug">
              {item.titulo}
            </h3>
            {item.meta.length > 0 && (
              <div className="mt-1 space-y-0.5">
                {item.meta.map((m) => (
                  <p key={m} className="text-xs leading-snug text-muted-foreground">
                    {m}
                  </p>
                ))}
              </div>
            )}
            {(item.estado || item.notaConvidado) && (
              <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                {item.estado && <Tag tom={item.tom}>{item.estado}</Tag>}
                {item.notaConvidado && (
                  <Tag tom="info">
                    <Eye size={11} aria-hidden />
                    {item.notaConvidado}
                  </Tag>
                )}
              </div>
            )}
          </div>
          <AcoesItem item={item} dupla={dupla} primario={primario} />
        </div>
      </article>
    </li>
  );
}

/** Warnrow do topo do "Hoje" — a pendência é tarefa do mentor (registrar o
 *  encontro, resolver o combinado), não só um evento do dia. Limbo traz
 *  "Remarcar" além do registro porque a pergunta real é "rolou?". Mesma
 *  grade de 3 colunas das linhas comuns; `destaque` = só o 1º aviso carrega
 *  o CTA preenchido (um lima por contexto — o resto fica em outline). */
function LinhaAviso({
  aviso,
  dupla,
  destaque,
}: {
  aviso: AvisoAgenda;
  dupla: Dupla | undefined;
  destaque: boolean;
}) {
  const [remarcarAberto, setRemarcarAberto] = useState(false);
  const limbo = aviso.remarcar;
  return (
    <div className="flex flex-wrap items-start gap-x-3 gap-y-2.5 rounded-xl border border-[var(--warn)]/40 bg-[var(--warn)]/[0.07] px-4 py-3 sm:flex-nowrap sm:px-5">
      <div className="w-18 shrink-0 pt-0.5 text-center">
        <ClockCounterClockwise
          size={20}
          aria-hidden
          className="inline text-[var(--warn-text)]"
        />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold leading-snug">{aviso.titulo}</p>
        <p className="mt-0.5 text-xs leading-snug text-muted-foreground">
          {aviso.detalhe}
        </p>
      </div>
      {/* "1 primário + ⋯": o registro é a resposta decisiva; a remarcação
          recolhe pro menu — mesmo padrão das linhas comuns */}
      <div className="flex w-full flex-wrap items-center justify-end gap-2 sm:w-auto sm:shrink-0 sm:self-center">
        <Link
          href={aviso.href}
          className={buttonVariants({
            variant: destaque ? "default" : "outline",
            size: "sm",
          })}
        >
          {limbo ? "Registrar como foi" : aviso.cta}
        </Link>
        {limbo && aviso.encontro && (
          <AcoesMenu
            label="Ações"
            itens={[
              {
                id: "remarcar",
                rotulo: "Remarcar",
                icone: <CalendarPlus aria-hidden className={ICONE_MENU} />,
                onEscolher: () => setRemarcarAberto(true),
              },
            ]}
          />
        )}
      </div>
      {/* fora do popup, controlado — fechar o menu não desmonta o dialog
          e o foco volta pro ⋯ ao sair */}
      {limbo && aviso.encontro && (
        <AgendarEncontroDialog
          ocupados={ocupadosAgendados(dupla?.encontros ?? [], (e) => ({
            rotulo: `${e.numero}º encontro`,
            rotuloArtigo: `o ${e.numero}º encontro`,
          }))}
          duplaId={aviso.duplaId}
          numero={aviso.encontro.numero}
          atual={aviso.encontro}
          piso={dupla?.iniciada_em ?? undefined}
          jovemNome={dupla ? primeiroNomeDaDupla(dupla) : undefined}
          trigger={null}
          open={remarcarAberto}
          onOpenChange={setRemarcarAberto}
        />
      )}
    </div>
  );
}

function Secao({
  secao,
  avisos,
  duplasPorId,
  primarioId,
}: {
  secao: AgendaSecao;
  /** warnrows — só a seção "hoje" as recebe; as outras passam []. */
  avisos: AvisoAgenda[];
  duplasPorId: Map<string, Dupla>;
  /** id do item que renderiza o CTA decisivo preenchido — null quando um
   *  warnrow já carrega o lima da agenda (o destaque é um por contexto). */
  primarioId: string | null;
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
        {avisos.map((av, i) => (
          <LinhaAviso
            key={av.id}
            aviso={av}
            dupla={duplasPorId.get(av.duplaId)}
            destaque={i === 0}
          />
        ))}
        {vazia && avisos.length === 0 && (
          <p className="rounded-xl border border-dashed px-4 py-3 text-sm text-muted-foreground sm:px-5">
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
                  primario={item.id === primarioId}
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
    semana.programas === 0 &&
    semana.pendencias === 0;
  return (
    <aside className="space-y-4 lg:pt-1" aria-label="Resumo da agenda">
      <section className="rounded-xl border bg-card p-4">
        <h2 className="font-semibold">Esta semana</h2>
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
                {semana.encontrosDetalhe ? ` · ${semana.encontrosDetalhe}` : ""}
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
                {semana.sessoesEspDetalhe ? ` · ${semana.sessoesEspDetalhe}` : ""}{" "}
                <span className="text-muted-foreground">(você acompanha)</span>
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
                {semana.pendencias === 1 ? "está" : "estão"} no topo de hoje
              </span>
            </p>
          )}
        </div>
      </section>

      <section className="rounded-xl border bg-card p-4">
        <h2 className="font-semibold">Suas duplas</h2>
        <ul className="mt-2.5 space-y-1">
          {duplasRail.map((d) => {
            const foraDaRegua = d.status !== "ativa";
            const sem = SEMAFORO[d.saude.semaforo];
            const Icon = foraDaRegua ? PauseCircle : sem.Icon;
            return (
              <li key={d.id}>
                <Link
                  href={`/duplas/${d.id}`}
                  prefetch={false}
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
                        · {turmaCurta(d.turma)}
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
        hoje,
        agora,
      }),
    [duplas, trilhas, eventos, cronogramas, hoje, agora]
  );
  const { avisos, secoes } = useMemo(
    () => filtraAgenda(agenda, escopo),
    [agenda, escopo]
  );
  const duplasPorId = useMemo(
    () => new Map(duplas.map((d) => [d.id, d])),
    [duplas]
  );
  // o CTA preenchido (lima) é um por agenda: o 1º warnrow do "Hoje" leva —
  // sem warnrow, o destaque cai na 1ª ação decisiva da lista (registrar ou
  // agendar). Tudo o mais renderiza outline.
  const primarioAcaoId = useMemo(() => {
    if (avisos.length > 0) return null;
    for (const s of secoes)
      for (const g of s.grupos)
        for (const i of g.itens)
          if (i.acoes.includes("registrar") || i.acoes.includes("agendar"))
            return i.id;
    return null;
  }, [avisos, secoes]);

  if (duplas.length === 0) {
    return (
      <div className="rounded-xl bg-card px-5 py-10 text-center shadow-[var(--shadow-border)]">
        <p className="text-sm text-muted-foreground">
          Você ainda não está em nenhuma dupla. Quando a coordenação formar
          uma, seus encontros aparecem aqui, junto com a agenda que seu
          mentorado tem com os especialistas.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* escopo interno — estado local, nunca URL: é um recorte de leitura,
          não um endereço compartilhável. O "você não participa" dos itens
          convidados já explica o recorte — sem parágrafo de legenda */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <span className="text-xs font-medium text-muted-foreground">
          Agenda de:
        </span>
        <FilterChipRow role="group" aria-label="Escopo da agenda" className="gap-1.5">
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
        </FilterChipRow>
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_290px]">
        <div className="min-w-0 space-y-6">
          {secoes.map((s) => (
            <Secao
              key={s.id}
              secao={s}
              avisos={s.id === "hoje" ? avisos : []}
              duplasPorId={duplasPorId}
              primarioId={primarioAcaoId}
            />
          ))}
        </div>
        <Rail agenda={agenda} />
      </div>
    </div>
  );
}
