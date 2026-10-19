import Link from "next/link";
import { Eye } from "@phosphor-icons/react/dist/ssr";
import {
  itensDaSemanaPrograma,
  paraAcompanhar,
  resumosPorCronograma,
  type ItemParaAcompanhar,
  type ItemPrograma,
  type ResumoTurmaCard,
} from "@/lib/agenda-coordenacao";
import { formatMesAbrev, semanaBounds } from "@/lib/ciclo";
import { rotuloDiaAgenda } from "@/lib/agenda-minha";
import type { Interacao } from "@/lib/interacoes";
import type { CicloEvento, Cronograma, Dupla, Supervisao } from "@/lib/types";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { LembreteButton } from "@/components/lembrete-button";
import {
  dowCurto,
  lembreteDaDupla,
  mesLongo,
  PillTurma,
  semanaIso,
  Tag,
  type TomTag,
} from "@/components/agenda-partes";

/** Visão "Monitoramento" da coordenação (WP5 · mock v6): resumo da semana
 *  por cronograma (nunca misturado — cada turma corre o seu calendário), a
 *  fila "Para acompanhar" com o Lembrar universal e os itens oficiais da
 *  semana. A coordenação NÃO agenda por ninguém: a única ação sobre dupla
 *  aqui é o nudge. Toda a derivação mora em lib/agenda-coordenacao (pura);
 *  a página é quem busca os dados — este componente só compõe e renderiza. */
export function AgendaCoordenacao({
  duplas,
  eventos,
  cronogramas,
  nudges,
  supervisoes,
  meuNome,
  hoje,
}: {
  /** Todas as duplas do ciclo (RLS da coordenação). */
  duplas: Dupla[];
  eventos: CicloEvento[];
  cronogramas: Cronograma[];
  /** getUltimasInteracoes — a lib filtra a tipo 'nudge' pro cap de 48h. */
  nudges: Record<string, Interacao>;
  /** Supervisões recentes — a lib recorta a semana corrente. */
  supervisoes: Supervisao[];
  meuNome?: string;
  /** "YYYY-MM-DD" de hoje em São Paulo. */
  hoje: string;
}) {
  const agora = new Date();
  const { seg, dom } = semanaBounds(agora);
  const resumos = resumosPorCronograma(duplas, cronogramas, eventos, agora);
  const acompanhar = paraAcompanhar(duplas, eventos, nudges, agora);
  const programa = itensDaSemanaPrograma(
    eventos,
    cronogramas,
    supervisoes,
    agora
  );
  const duplasPorId = new Map(duplas.map((d) => [d.id, d]));
  const rotuloHoje = rotuloDiaAgenda(hoje);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Agenda do programa
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Semana {semanaIso(hoje)} · {Number(seg.slice(8, 10))} a{" "}
            {Number(dom.slice(8, 10))} de {mesLongo(dom)} · hoje,{" "}
            {rotuloHoje.charAt(0).toLowerCase() + rotuloHoje.slice(1)}
          </p>
        </div>
        {/* o sbox "Você vê/NÃO vê" do mock foi cortado no desenho — fica
            só a etiqueta discreta da postura */}
        <p className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground">
          <Eye size={14} aria-hidden />
          Monitoramento — a agenda de cada dupla é da dupla
        </p>
      </header>

      {/* ---- Semana do encontro, por cronograma ---- */}
      <section aria-label="Semana do encontro por cronograma">
        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
          <h2 className="text-base font-semibold">
            Semana do encontro, por cronograma
          </h2>
          <Tag>resumo por turma — nunca global</Tag>
        </div>
        {resumos.length > 1 && (
          <p className="mt-1.5 max-w-[78ch] text-xs leading-relaxed text-muted-foreground">
            As turmas não começaram juntas — na mesma semana,{" "}
            {resumos.map((r, i) => (
              <span key={r.cronogramaId}>
                {i > 0 && (i === resumos.length - 1 ? " e " : ", ")}
                <b className="font-medium text-foreground">
                  {r.turma} está no encontro {r.eventoNumero ?? "—"}
                </b>
              </span>
            ))}
            . Por isso o “X de Y realizaram” é por turma, nunca misturado.
          </p>
        )}
        {resumos.length === 0 ? (
          <p className="mt-3 rounded-xl border border-dashed px-4 py-3 text-sm text-muted-foreground">
            Nenhum cronograma com duplas em curso — quando uma turma entrar,
            o resumo dela aparece aqui.
          </p>
        ) : (
          <div className="mt-3 grid items-start gap-4 lg:grid-cols-2">
            {resumos.map((r) => (
              <CardResumo key={r.cronogramaId} r={r} dom={dom} />
            ))}
          </div>
        )}
      </section>

      {/* ---- Para acompanhar ---- */}
      <section aria-label="Duplas para acompanhar">
        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
          <h2 className="text-base font-semibold">Para acompanhar</h2>
          <Tag>
            {acompanhar.length}{" "}
            {acompanhar.length === 1 ? "dupla" : "duplas"}
          </Tag>
        </div>
        <p className="mt-1.5 max-w-[78ch] text-xs leading-relaxed text-muted-foreground">
          Sem agendamento ou atrasadas.{" "}
          <b className="font-medium text-foreground">Lembrar</b> envia um
          aviso à dupla (notificação + WhatsApp se houver) — a coordenação
          não marca o encontro por ela.
        </p>
        {acompanhar.length === 0 ? (
          <p className="mt-3 rounded-xl border border-dashed px-4 py-3 text-sm text-muted-foreground">
            Tudo em dia — nenhuma dupla pede atenção.
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-border/60 overflow-hidden rounded-xl border bg-card">
            {acompanhar.map((item) => (
              <LinhaAcompanhar
                key={item.duplaId}
                item={item}
                dupla={duplasPorId.get(item.duplaId)}
                eventos={eventos}
                meuNome={meuNome}
              />
            ))}
          </ul>
        )}
      </section>

      {/* ---- Semana no programa ---- */}
      <section aria-label="Semana no programa">
        <h2 className="text-base font-semibold">Semana no programa</h2>
        {programa.length === 0 ? (
          <p className="mt-3 rounded-xl border border-dashed px-4 py-3 text-sm text-muted-foreground">
            Semana sem eventos oficiais no calendário.
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-border/60 overflow-hidden rounded-xl border bg-card">
            {programa.map((it) => (
              <LinhaPrograma key={it.id} item={it} hoje={hoje} />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

// ---------- card "Encontro N · Tx" ----------

const SEMAFORO_ROW: Record<
  ItemParaAcompanhar["saude"]["semaforo"],
  { tom: TomTag; rotulo: string }
> = {
  ok: { tom: "muted", rotulo: "Em andamento" },
  atencao: { tom: "warn", rotulo: "Atenção" },
  risco: { tom: "danger", rotulo: "Risco" },
};

function CardResumo({ r, dom }: { r: ResumoTurmaCard; dom: string }) {
  const comData = r.regua.filter((p) => p.data != null);
  const primeiro = comData[0];
  const atual = r.regua.find((p) => p.estado === "atual") ?? null;
  const ultimo = comData.at(-1);
  const dm = (iso: string) =>
    `${Number(iso.slice(8, 10))} ${formatMesAbrev(iso)}`;
  return (
    <article className="rounded-xl border bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <PillTurma>
            {r.turma}
            {r.meta ? ` · ${r.meta}` : ""}
          </PillTurma>
          <h3 className="mt-1.5 text-lg font-bold leading-snug">
            {r.eventoNumero != null
              ? `Encontro ${r.eventoNumero} · ${r.turma}`
              : `Semana sem encontro oficial · ${r.turma}`}
          </h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {r.eventoData
              ? `${dowCurto(r.eventoData)} ${Number(
                  r.eventoData.slice(8, 10)
                )} de ${mesLongo(r.eventoData)} · `
              : ""}
            {r.ativas} {r.ativas === 1 ? "dupla ativa" : "duplas ativas"}
            {r.pausadas > 0
              ? ` (+${r.pausadas} ${r.pausadas === 1 ? "pausada" : "pausadas"})`
              : ""}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-3xl font-bold leading-none tabular-nums">
            {r.realizaram}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            de {r.ativas} realizaram
          </p>
        </div>
      </div>

      {/* barra 3 segmentos: fez / marcou / sem data — o tracejado danger é
          o irmão do hatch-recesso do calendário */}
      <div
        role="img"
        aria-label={`${r.realizaram} realizaram, ${r.agendadas} agendadas, ${r.semAgendamento} sem agendamento`}
        className="mt-3 flex h-3 gap-0.5 overflow-hidden rounded-full bg-muted"
      >
        {r.realizaram > 0 && (
          <i
            className="min-w-1 bg-[var(--ok)]"
            style={{ flexGrow: r.realizaram }}
          />
        )}
        {r.agendadas > 0 && (
          <i
            className="min-w-1 bg-[var(--brand-lime)]/60"
            style={{ flexGrow: r.agendadas }}
          />
        )}
        {r.semAgendamento > 0 && (
          <i
            className="hatch-danger min-w-1"
            style={{ flexGrow: r.semAgendamento }}
          />
        )}
      </div>
      <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <li className="flex items-center gap-1.5">
          <i aria-hidden className="size-2.5 rounded-[3px] bg-[var(--ok)]" />
          {r.realizaram} realizaram
        </li>
        <li className="flex items-center gap-1.5">
          <i
            aria-hidden
            className="size-2.5 rounded-[3px] bg-[var(--brand-lime)]/60"
          />
          {r.agendadas} agendadas até {dowCurto(dom)}{" "}
          {Number(dom.slice(8, 10))}
        </li>
        <li className="flex items-center gap-1.5">
          <i
            aria-hidden
            className="hatch-danger size-2.5 rounded-[3px] ring-1 ring-inset ring-[var(--danger)]/30"
          />
          {r.semAgendamento} sem agendamento
        </li>
      </ul>

      {/* régua oficial: círculos numerados — atual sai em tinta com anel
          lime, feito em ok, futuro em traço */}
      <ol
        className="mt-3 flex flex-wrap gap-1"
        aria-label={`Calendário oficial ${r.turma}: ${r.regua.length} encontros`}
      >
        {r.regua.map((p) => (
          <li
            key={p.numero}
            title={`encontro ${p.numero} · ${r.turma}`}
            className={cn(
              "grid size-6 place-items-center rounded-full border text-[11px] font-semibold tabular-nums",
              p.estado === "feito" &&
                "border-transparent bg-[var(--ok)] text-white",
              p.estado === "atual" &&
                "border-transparent bg-foreground text-background ring-2 ring-[var(--brand-lime)] ring-offset-2 ring-offset-card",
              p.estado === "futuro" && "border-border text-muted-foreground"
            )}
          >
            {p.numero}
          </li>
        ))}
      </ol>
      {primeiro && ultimo && (
        <p className="mt-2 flex justify-between gap-2 text-xs text-muted-foreground">
          <span>
            enc. {primeiro.numero} · {dm(primeiro.data!)}
          </span>
          {/* o vigente já aparece como 1º/último quando é ponta — sem dupla
              etiqueta idêntica ("enc. 1" duas vezes na turma nova) */}
          {atual?.data &&
            atual.numero !== primeiro.numero &&
            atual.numero !== ultimo.numero && (
              <span>
                enc. {atual.numero} · {dm(atual.data)}
              </span>
            )}
          <span>
            enc. {ultimo.numero} · {dm(ultimo.data!)}
          </span>
        </p>
      )}
    </article>
  );
}

// ---------- fila "Para acompanhar" ----------

function LinhaAcompanhar({
  item,
  dupla,
  eventos,
  meuNome,
}: {
  item: ItemParaAcompanhar;
  dupla: Dupla | undefined;
  eventos: CicloEvento[];
  meuNome: string | undefined;
}) {
  const st = SEMAFORO_ROW[item.saude.semaforo];
  // o caso que assina a mensagem: registro > limbo > atraso > sem data —
  // o primeiro motivo da lista já vem na ordem do severo, mas o mapa
  // explícito não depende da ordem que a lib escolheu
  const caso = item.motivos.includes("registro_pendente")
    ? "registro_pendente"
    : item.motivos.includes("limbo")
      ? "limbo"
      : item.motivos.includes("atraso")
        ? "atraso"
        : "sem_data";
  const lembrete = dupla
    ? lembreteDaDupla(dupla, caso, eventos, meuNome)
    : { titulo: "Lembrete da equipe", corpo: "" };
  return (
    <li className="flex flex-wrap items-center gap-3 px-4 py-3">
      <div className="min-w-0 flex-1 basis-56">
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm font-semibold">
          {item.nomes}
          <PillTurma>{item.turma}</PillTurma>
        </p>
        <p className="mt-0.5 text-xs leading-snug text-muted-foreground">
          {item.contexto}
        </p>
      </div>
      <Tag tom={st.tom}>{st.rotulo}</Tag>
      <LembreteButton
        duplaId={item.duplaId}
        destino="mentor"
        rotulo={item.rotuloLembrete}
        telefone={dupla?.mentor?.whatsapp ?? null}
        titulo={lembrete.titulo}
        corpo={lembrete.corpo}
        href={`/duplas/${item.duplaId}`}
        bloqueadoAte={item.bloqueadoAte}
      />
      <Link
        href={`/duplas/${item.duplaId}`}
        className="inline-flex min-h-9 items-center rounded-lg px-2 text-xs font-semibold text-foreground/80 transition-colors hover:bg-muted hover:text-foreground"
      >
        Ver ficha ›
      </Link>
    </li>
  );
}

// ---------- "Semana no programa" ----------

function LinhaPrograma({ item, hoje }: { item: ItemPrograma; hoje: string }) {
  // a chamada da formação mora no painel do dia do calendário — o botão
  // só aparece no dia certo (link direto, não ação nova)
  const chamadaHoje = item.tipo === "formacao" && item.diaKey === hoje;
  return (
    <li className="flex flex-wrap items-center gap-3 px-4 py-3">
      <div className="w-12 shrink-0 text-center">
        <b className="block text-lg font-bold leading-none tabular-nums">
          {Number(item.diaKey.slice(8, 10))}
        </b>
        <i className="text-xs font-medium not-italic text-muted-foreground">
          {dowCurto(item.diaKey)}
        </i>
      </div>
      <div className="min-w-0 flex-1 basis-52">
        <p className="text-sm font-semibold leading-snug">{item.titulo}</p>
        {item.detalhe && (
          <p className="mt-0.5 text-xs leading-snug text-muted-foreground">
            {item.detalhe}
          </p>
        )}
      </div>
      {chamadaHoje ? (
        <Link
          href={`/agenda?aba=calendario&dia=${item.diaKey}`}
          className={buttonVariants({ size: "sm" })}
        >
          Abrir chamada
        </Link>
      ) : (
        <Tag tom={item.etiqueta === "hoje" ? "warn" : "muted"}>
          {item.etiqueta}
        </Tag>
      )}
    </li>
  );
}
