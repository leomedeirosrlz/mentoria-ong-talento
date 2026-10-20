import Link from "next/link";
import {
  ArrowsClockwise,
  CalendarPlus,
  ChatsCircle,
  Eye,
  Flag,
  Sparkle,
  Users,
  Warning,
} from "@phosphor-icons/react/dist/ssr";
import {
  contextoDuplaAux,
  duplasPorTurma,
  itensConsolidados,
  type ItemConsolidado,
} from "@/lib/agenda-auxiliar";
import {
  lembreteBloqueadoAte,
  saudadeDaDupla,
  semanaBounds,
  toDateStr,
  type DuplaSaude,
  type Semaforo,
} from "@/lib/ciclo";
import {
  primeiroNomeDaDupla,
  rotuloDiaAgenda,
} from "@/lib/agenda-minha";
import type { Interacao } from "@/lib/interacoes";
import type { SupervisaoAlvo } from "@/lib/queries-supervisao";
import type {
  CicloEvento,
  Cronograma,
  Dupla,
  Supervisao,
} from "@/lib/types";
import { avatarPublicUrl } from "@/lib/avatar";
import { cn } from "@/lib/utils";
import { Avatar } from "@/components/avatar";
import { LembreteButton } from "@/components/lembrete-button";
import { SupervisaoDialog } from "@/components/supervisao-dialog";
import { Button } from "@/components/ui/button";
import {
  lembreteDaDupla,
  mesLongo,
  PillTurma,
  semanaIso,
  Tag,
  type TomTag,
} from "@/components/agenda-partes";

const fmtHoraMin = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "America/Sao_Paulo",
  hour: "2-digit",
  minute: "2-digit",
});

/** Agenda do auxiliar executivo (WP5 · mock v6): supervisiona, não agenda —
 *  nenhuma superfície aqui marca encontro de dupla. Duas abas (por
 *  `?aba=` como o resto da agenda): "Por turma" agrupa as supervisionadas
 *  pelo calendário delas e "Consolidada" vira a agenda única da pessoa —
 *  encontros das duplas, as supervisões dela, eventos oficiais e sessões
 *  esp em modo convidado ("só acompanhamento"). Derivações todas em
 *  lib/agenda-auxiliar (pura). */
export function AgendaAuxiliar({
  duplas,
  eventos,
  cronogramas,
  supervisoes,
  alvos,
  nudges,
  meuNome,
  hoje,
  consolidada,
}: {
  /** Só as duplas que eu supervisiono (a página filtra). */
  duplas: Dupla[];
  eventos: CicloEvento[];
  cronogramas: Cronograma[];
  /** getSupervisoesDaPessoa(me.id) — conduzidas por mim sobre mentores. */
  supervisoes: Supervisao[];
  /** Alvos do dialog de supervisão (escopo do RLS). */
  alvos: SupervisaoAlvo[];
  /** getUltimasInteracoes — pro cap de 48h do Lembrar. */
  nudges: Record<string, Interacao>;
  /** Primeiro nome — assina a mensagem do lembrete. */
  meuNome: string;
  /** "YYYY-MM-DD" de hoje (São Paulo). */
  hoje: string;
  /** Aba ativa — default "Por turma". */
  consolidada: boolean;
}) {
  const agora = new Date();
  const { seg, dom } = semanaBounds(agora);
  const grupos = duplasPorTurma(duplas, cronogramas, eventos, agora);
  const itens = itensConsolidados(duplas, supervisoes, eventos, agora);
  const saudePorId = new Map(
    duplas.map((d) => [d.id, saudadeDaDupla(d, eventos, agora)])
  );
  const duplasPorId = new Map(duplas.map((d) => [d.id, d]));
  // a lista só exibe ativa/pausada (mesmo filtro da lib) — encerradas entram
  // na supervisão histórica mas não na agenda; o cabeçalho conta as duas
  // coisas separadas pra não prometer card que não renderiza
  const correndo = duplas.filter(
    (d) => d.status === "ativa" || d.status === "pausada"
  );
  const encerradas = duplas.length - correndo.length;
  const turmas = [...new Set(correndo.map((d) => d.turma))];
  // a explicação do desencontro só cita turmas com encontro vigente —
  // trilhas de especialista não têm cronograma e cairiam como "—"
  const gruposTurma = grupos.filter((g) => g.encontroVigente != null);
  const desencontro = gruposTurma.length > 1;

  // coorte "sem encontro agendado" — as duplas atrás dos itens a_agendar
  // da consolidada (uma por dupla, na ordem da fila)
  const semAgenda = [
    ...new Map(
      itens
        .filter((i) => i.tipo === "a_agendar" && i.duplaId != null)
        .map((i) => {
          const d = duplasPorId.get(i.duplaId!);
          return [
            i.duplaId!,
            d
              ? `${primeiroNomeDaDupla(d) || d.mentorado.nome.split(" ")[0]} (${d.turma})`
              : null,
          ] as const;
        })
        .filter((x): x is readonly [string, string] => x[1] != null)
    ).values(),
  ];

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">
          Agenda das minhas duplas
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {correndo.length}{" "}
          {correndo.length === 1 ? "dupla supervisionada" : "duplas supervisionadas"}
          {encerradas > 0 &&
            ` · ${encerradas} encerrada${encerradas === 1 ? "" : "s"}`}
          {turmas.length > 0 ? ` · ${turmas.join(" e ")}` : ""}
          {correndo.length > 0 &&
            ` · semana ${semanaIso(hoje)}, ${Number(seg.slice(8, 10))} a ${Number(dom.slice(8, 10))} de ${mesLongo(dom)}`}
        </p>
      </header>

      <AbasAuxiliar consolidada={consolidada} />

      {!consolidada ? (
        <div className="space-y-6">
          {desencontro && (
            <p className="flex max-w-[78ch] items-start gap-2 text-xs leading-relaxed text-muted-foreground">
              <ArrowsClockwise
                size={16}
                aria-hidden
                className="mt-0.5 shrink-0"
              />
              <span>
                As turmas não começaram juntas — na mesma semana,{" "}
                {gruposTurma.map((g, i) => (
                  <span key={g.cronogramaId ?? g.turma}>
                    {i > 0 && (i === gruposTurma.length - 1 ? " e " : ", ")}
                    <b className="font-medium text-foreground">
                      {g.turma} está no encontro {g.encontroVigente ?? "—"}
                    </b>
                  </span>
                ))}
                . Nunca compare os números sem a turma.
              </span>
            </p>
          )}

          {grupos.length === 0 ? (
            <p className="rounded-xl border border-dashed px-4 py-3 text-sm text-muted-foreground">
              Você ainda não supervisiona nenhuma dupla — quando a coordenação
              atribuir, elas aparecem aqui por turma.
            </p>
          ) : (
            grupos.map((g) => {
              // grupo sem cronograma = trilhas esp supervisionadas — "Sem
              // turma" mentiria; quando toda a dupla é trilha, nomeia o tipo
              const rotuloGrupo =
                g.cronogramaId == null &&
                g.duplas.every((d) => d.trilha === "especialista")
                  ? "Trilhas de especialista"
                  : g.rotulo;
              return (
              <section
                key={g.cronogramaId ?? "sem-turma"}
                aria-label={`Duplas da ${g.turma || "trilha de especialista"}`}
                className="space-y-3"
              >
                <div className="flex flex-wrap items-center gap-2.5">
                  {g.turma && <PillTurma turma={g.turma} />}
                  <h2 className="text-lg font-bold">{rotuloGrupo}</h2>
                </div>
                <div className="grid items-start gap-4 lg:grid-cols-2">
                  {g.duplas.map((d) => (
                    <CardDuplaAux
                      key={d.id}
                      dupla={d}
                      saude={saudePorId.get(d.id)!}
                      contexto={contextoDuplaAux(d, eventos, agora)}
                      alvo={
                        alvos.find((a) => a.dupla_id === d.id) ?? null
                      }
                      nudge={
                        nudges[d.id]?.tipo === "nudge" ? nudges[d.id] : null
                      }
                      eventos={eventos}
                      meuNome={meuNome}
                      agora={agora}
                    />
                  ))}
                </div>
              </section>
              );
            })
          )}

          {semAgenda.length > 0 && (
            <div className="flex items-start gap-3 rounded-xl border border-dashed border-[var(--warn)]/60 bg-[var(--warn)]/[0.07] p-4">
              <Warning
                size={20}
                aria-hidden
                className="mt-0.5 shrink-0 text-[var(--warn-text)]"
              />
              <div>
                <p className="text-sm font-semibold">
                  Sem encontro agendado ({semAgenda.length})
                </p>
                <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                  {semAgenda.join(", ")}. Use{" "}
                  <b className="font-medium text-foreground">Lembrar</b> —
                  quem agenda é a dupla.
                </p>
              </div>
            </div>
          )}
        </div>
      ) : (
        <ConsolidadaAux
          itens={itens}
          alvos={alvos}
          duplasPorId={duplasPorId}
          nudges={nudges}
          eventos={eventos}
          meuNome={meuNome}
          hoje={hoje}
        />
      )}
    </div>
  );
}

// ---------- abas ----------

function AbasAuxiliar({ consolidada }: { consolidada: boolean }) {
  return (
    <div
      role="tablist"
      aria-label="Modos da agenda"
      className="flex w-fit items-center gap-1 rounded-lg bg-muted p-1"
    >
      {(
        [
          ["turma", "Por turma", "/agenda"],
          ["consolidada", "Consolidada", "/agenda?aba=consolidada"],
        ] as const
      ).map(([v, label, href]) => (
        <Link
          key={v}
          role="tab"
          aria-selected={
            (v === "consolidada") === consolidada
          }
          href={href}
          className={cn(
            "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
            (v === "consolidada") === consolidada
              ? "bg-card text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          {label}
        </Link>
      ))}
    </div>
  );
}

// ---------- card da dupla (aba Por turma) ----------

const SEM_CARD: Record<Semaforo, { tom: TomTag; rotulo: string }> = {
  ok: { tom: "ok", rotulo: "Em dia" },
  atencao: { tom: "warn", rotulo: "Atenção" },
  risco: { tom: "danger", rotulo: "Risco" },
};

const ROTULO_STATUS: Record<Dupla["status"], string> = {
  ativa: "",
  pausada: "Pausada",
  concluida: "Concluída",
  encerrada: "Encerrada",
};

/** O sinal mais grave que um lembrete endereça — o primeiro da fila do
 *  semáforo já vem na ordem de prioridade; o mapa traduz pro caso do
 *  catálogo (preventivo/estagnacao/avaliações caem no lembrete-padrão de
 *  marcar o encontro). */
function casoLembreteAux(
  saude: DuplaSaude
): "limbo" | "registro_pendente" | "atraso" | "sem_data" {
  const t = saude.sinais[0]?.tipo;
  if (t === "limbo") return "limbo";
  if (t === "registro_pendente") return "registro_pendente";
  if (t === "atraso") return "atraso";
  return "sem_data";
}

function CardDuplaAux({
  dupla: d,
  saude,
  contexto,
  alvo,
  nudge,
  eventos,
  meuNome,
  agora,
}: {
  dupla: Dupla;
  saude: DuplaSaude;
  contexto: { texto: string; problema: boolean };
  alvo: SupervisaoAlvo | null;
  nudge: Interacao | null;
  eventos: CicloEvento[];
  meuNome: string;
  agora: Date;
}) {
  const nome =
    d.mentorado?.nome_social || d.mentorado?.nome || "Jovem";
  const tag =
    d.status !== "ativa"
      ? { tom: "muted" as TomTag, rotulo: ROTULO_STATUS[d.status] }
      : SEM_CARD[saude.semaforo];
  // Lembrar existe quando há pendência apontável — em dia não leva nudge
  const lembrete =
    d.status === "ativa" && saude.sinais.length > 0
      ? lembreteDaDupla(d, casoLembreteAux(saude), eventos, meuNome, agora)
      : null;
  return (
    <article className="rounded-xl border bg-card p-4">
      <div className="flex items-center gap-2.5">
        <Avatar
          papel="mentorado"
          nome={nome}
          size={40}
          src={
            d.mentorado?.avatar_path
              ? avatarPublicUrl(d.mentorado.avatar_path)
              : null
          }
        />
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-2 text-sm font-semibold leading-snug">
            {nome}
            <PillTurma turma={d.turma} />
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            mentor: {d.mentor?.nome}
          </p>
        </div>
        <Tag tom={tag.tom}>{tag.rotulo}</Tag>
      </div>
      <p
        className={cn(
          "mt-2.5 text-sm leading-snug",
          contexto.problema
            ? "font-medium text-destructive"
            : "text-muted-foreground"
        )}
      >
        {contexto.texto}
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {alvo && (
          <SupervisaoDialog
            alvos={[alvo]}
            trigger={
              <Button variant="outline" size="sm">
                <ChatsCircle size={14} aria-hidden />
                Registrar supervisão
              </Button>
            }
          />
        )}
        <Link
          href={`/duplas/${d.id}`}
          className="inline-flex min-h-9 items-center rounded-lg px-2 text-xs font-semibold text-foreground/80 transition-colors hover:bg-muted hover:text-foreground"
        >
          Ver ficha ›
        </Link>
        {lembrete && (
          <LembreteButton
            duplaId={d.id}
            destino="mentor"
            rotulo="Lembrar"
            telefone={d.mentor?.whatsapp ?? null}
            titulo={lembrete.titulo}
            corpo={lembrete.corpo}
            href={`/duplas/${d.id}`}
            bloqueadoAte={lembreteBloqueadoAte(nudge, agora)}
          />
        )}
      </div>
    </article>
  );
}

// ---------- aba Consolidada ----------

const ICONE_TIPO: Record<ItemConsolidado["tipo"], typeof ChatsCircle> = {
  supervisao: ChatsCircle,
  encontro: Users,
  sessao_esp: Sparkle,
  oficial: Flag,
  a_agendar: CalendarPlus,
};

const ROTULO_TIPO: Record<ItemConsolidado["tipo"], string> = {
  supervisao: "Supervisão",
  encontro: "Encontro",
  sessao_esp: "Trilha de especialista",
  oficial: "Evento oficial",
  a_agendar: "A agendar",
};

function ConsolidadaAux({
  itens,
  alvos,
  duplasPorId,
  nudges,
  eventos,
  meuNome,
  hoje,
}: {
  itens: ItemConsolidado[];
  alvos: SupervisaoAlvo[];
  duplasPorId: Map<string, Dupla>;
  nudges: Record<string, Interacao>;
  eventos: CicloEvento[];
  meuNome: string;
  hoje: string;
}) {
  // UTC-noon — meio-dia local anda um dia em fusos a frente de SP
  const amanha = toDateStr(
    new Date(Date.parse(`${hoje}T12:00:00Z`) + 86_400_000)
  );
  const gruposDia = new Map<string, ItemConsolidado[]>();
  for (const i of itens) gruposDia.set(i.diaKey, [...(gruposDia.get(i.diaKey) ?? []), i]);
  const dias = [...gruposDia.keys()].sort();
  const rotulo = (dia: string) => {
    const r = rotuloDiaAgenda(dia);
    const prefixo = dia === hoje ? "Hoje · " : dia === amanha ? "Amanhã · " : "";
    return prefixo + (prefixo ? r.charAt(0).toLowerCase() + r.slice(1) : r);
  };

  return (
    <div className="space-y-5">
      <p className="max-w-[78ch] text-xs leading-relaxed text-muted-foreground">
        Uma só lista, em ordem de data. Cada item mostra <b>turma</b> e{" "}
        <b>dupla</b> — o número do encontro é sempre “enc. N · turma”.
      </p>
      {dias.length === 0 ? (
        <p className="rounded-xl border border-dashed px-4 py-3 text-sm text-muted-foreground">
          Semana vazia por aqui — nada nas duplas que você supervisiona
          nem no calendário do programa.
        </p>
      ) : (
        dias.map((dia) => (
          <section key={dia} aria-label={rotulo(dia)}>
            <h3 className="text-sm font-semibold">{rotulo(dia)}</h3>
            <ul className="mt-2 space-y-2">
              {gruposDia.get(dia)!.map((item) => (
                <LinhaConsolidada
                  key={item.id}
                  item={item}
                  alvos={alvos}
                  dupla={
                    item.duplaId != null
                      ? duplasPorId.get(item.duplaId)
                      : undefined
                  }
                  nudge={
                    item.duplaId != null &&
                    nudges[item.duplaId]?.tipo === "nudge"
                      ? nudges[item.duplaId]
                      : null
                  }
                  eventos={eventos}
                  meuNome={meuNome}
                />
              ))}
            </ul>
          </section>
        ))
      )}
    </div>
  );
}

function LinhaConsolidada({
  item,
  alvos,
  dupla,
  nudge,
  eventos,
  meuNome,
}: {
  item: ItemConsolidado;
  alvos: SupervisaoAlvo[];
  dupla: Dupla | undefined;
  nudge: Interacao | null;
  eventos: CicloEvento[];
  meuNome: string;
}) {
  const Icone = ICONE_TIPO[item.tipo];
  // o dialog nasce com a dupla do item quando existe — o select abre já no
  // contexto certo; sessão "geral" fica a escolha explícita de sempre
  const alvosItem = item.duplaId
    ? alvos.filter((a) => a.dupla_id === item.duplaId)
    : alvos;
  const lembrete =
    item.tipo === "a_agendar" && dupla
      ? lembreteDaDupla(dupla, "sem_data", eventos, meuNome)
      : null;
  return (
    <li>
      <article
        className={cn(
          "rounded-xl border bg-card px-3.5 py-3",
          (item.convidado || item.tipo === "a_agendar") && "border-dashed",
          item.convidado &&
            "border-[var(--warn)]/60 bg-[var(--warn)]/[0.04]"
        )}
      >
        <div className="flex gap-3">
          <div className="w-12 shrink-0 pt-0.5 text-right">
            <span className="block text-sm font-semibold tabular-nums">
              {/* inicio é ISO instante (encontro) ou "YYYY-MM-DD" (supervisão,
                  oficial, a_agendar — sem hora honesta pra mostrar) */}
              {item.inicio.includes("T")
                ? fmtHoraMin
                    .format(new Date(item.inicio))
                    .replace(":", "h")
                    .replace(/h00$/, "h")
                : "—"}
            </span>
          </div>
          <div className="min-w-0 flex-1">
            <p className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs font-medium text-muted-foreground">
              <Icone size={13} aria-hidden className="shrink-0" />
              {ROTULO_TIPO[item.tipo]}
              {item.pill && <PillTurma turma={item.pill} />}
            </p>
            <h3 className="mt-0.5 text-sm font-semibold leading-snug">
              {item.titulo}
            </h3>
            {item.detalhe && (
              <p className="mt-0.5 text-xs leading-snug text-muted-foreground">
                {item.detalhe}
              </p>
            )}
            {item.convidado ? (
              <p className="mt-1.5">
                <Tag tom="warn">
                  <Eye size={11} aria-hidden />
                  só acompanhamento
                </Tag>
              </p>
            ) : (
              <div className="mt-2 flex flex-wrap items-center gap-2">
                {item.tipo === "supervisao" && alvosItem.length > 0 && (
                  <SupervisaoDialog
                    alvos={alvosItem}
                    trigger={
                      <Button variant="outline" size="sm">
                        <ChatsCircle size={14} aria-hidden />
                        Registrar supervisão
                      </Button>
                    }
                  />
                )}
                {item.tipo === "encontro" && item.href && (
                  <Link
                    href={item.href}
                    className="inline-flex min-h-9 items-center rounded-lg px-2 text-xs font-semibold text-foreground/80 transition-colors hover:bg-muted hover:text-foreground"
                  >
                    Ver ficha ›
                  </Link>
                )}
                {lembrete && item.duplaId && (
                  <LembreteButton
                    duplaId={item.duplaId}
                    destino="mentor"
                    rotulo="Lembrar"
                    telefone={dupla?.mentor?.whatsapp ?? null}
                    titulo={lembrete.titulo}
                    corpo={lembrete.corpo}
                    href={item.href ?? `/duplas/${item.duplaId}`}
                    bloqueadoAte={lembreteBloqueadoAte(nudge)}
                  />
                )}
              </div>
            )}
          </div>
        </div>
      </article>
    </li>
  );
}
