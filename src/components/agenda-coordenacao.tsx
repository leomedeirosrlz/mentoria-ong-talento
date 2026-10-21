import Link from "next/link";
import { Eye } from "@phosphor-icons/react/dist/ssr";
import {
  itensDaSemanaPrograma,
  paraAcompanhar,
  resumosPorCronograma,
  sinteseMonitoramento,
  type ItemPrograma,
  type MotivoAcompanhar,
  type ResumoTurmaCard,
} from "@/lib/agenda-coordenacao";
import { formatMesAbrev, semanaBounds } from "@/lib/ciclo";
import { rotuloDiaAgenda } from "@/lib/agenda-minha";
import { msgsContato } from "@/lib/whatsapp-msgs";
import type { Interacao } from "@/lib/interacoes";
import type { CicloEvento, Cronograma, Dupla, Supervisao } from "@/lib/types";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { FilaAcompanhar, type LinhaFila } from "@/components/fila-acompanhar";
import {
  dowCurto,
  lembreteDaDupla,
  mesLongo,
  PillTurma,
  semanaIso,
  Tag,
} from "@/components/agenda-partes";

/** Visão "Monitoramento" da coordenação (WP5 · mock v6 → dashboard
 *  REALIZA-161): faixa de síntese no topo (a leitura de 2s da fila), resumo
 *  da semana por cronograma (nunca misturado — cada turma corre o seu
 *  calendário) com a régua oficial linkada pro dia, e a fila "Para
 *  acompanhar" — badges por dimensão (vermelho só no acompanhamento),
 *  filtros/busca/grupos no client (fila-acompanhar) e o Lembrar universal.
 *  A coordenação NÃO agenda por ninguém: a única ação sobre dupla aqui é o
 *  nudge. Toda a derivação mora em lib/agenda-coordenacao (pura); a página
 *  é quem busca os dados — este componente só compõe e renderiza. */
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
  const sintese =
    acompanhar.length > 0
      ? sinteseMonitoramento(acompanhar, resumos, duplas, eventos, agora)
      : null;
  // as linhas saem daqui já prontas pra boundary client da fila: destino,
  // rótulo, texto do lembrete e telefone resolvem no server — Dupla/
  // CicloEvento não cruzam pra lá
  const linhas: LinhaFila[] = acompanhar.map((item) => {
    const dupla = duplasPorId.get(item.duplaId);
    // o caso que assina a mensagem: registro > limbo > atraso > sem data —
    // prioridade própria do lembrete, não a ordem que a lib escolheu
    const caso: MotivoAcompanhar = item.motivos.includes("registro_pendente")
      ? "registro_pendente"
      : item.motivos.includes("limbo")
        ? "limbo"
        : item.motivos.includes("atraso")
          ? "atraso"
          : "sem_data";
    // pedido de apoio que partiu do JOVEM: o domínio diz "chamar o jovem,
    // nunca o mentor" — pode ser sobre o próprio mentor. Destino, rótulo
    // ("Chamar", não cobrança), texto e telefone trocam de ponta.
    const apoioDoJovem =
      item.saude.apoio.aberto &&
      (item.saude.apoio.origem === "mentorado" ||
        item.saude.apoio.origem === "ambos");
    return {
      item,
      destino: apoioDoJovem ? "mentorado" : "mentor",
      rotulo: apoioDoJovem ? "Chamar" : item.rotuloLembrete,
      lembrete: apoioDoJovem
        ? {
            titulo: "A equipe quer te ouvir",
            corpo:
              msgsContato("apoio_jovem", {
                mentoradoNome:
                  dupla?.mentorado?.nome_social || dupla?.mentorado?.nome,
                autorNome: meuNome,
              }).mentorado ?? "",
          }
        : dupla
          ? lembreteDaDupla(dupla, caso, eventos, meuNome)
          : { titulo: "Lembrete da equipe", corpo: "" },
      telefone: apoioDoJovem
        ? (dupla?.mentorado?.whatsapp ?? null)
        : (dupla?.mentor?.whatsapp ?? null),
    };
  });

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

      {/* faixa de síntese — leitura de 2s do estado da fila antes dos cards.
          Só existe com fila viva (o empty state lá embaixo já cobre o "tudo
          em dia"); o único número com peso é o de críticas */}
      {sintese && (
        <p
          role="note"
          aria-label="Síntese do monitoramento"
          className="text-xs leading-relaxed text-muted-foreground"
        >
          <b className="font-semibold text-foreground">
            {sintese.total} para acompanhar
          </b>
          {" · "}
          <b
            className={
              sintese.criticas > 0
                ? "font-semibold text-destructive"
                : "font-medium"
            }
          >
            {sintese.criticas}{" "}
            {sintese.criticas === 1 ? "crítica" : "críticas"}
          </b>
          {sintese.atencao > 0 && ` · ${sintese.atencao} atenção`}
          {/* "sem agendamento" aqui = denominador dos cards (semAgendamento),
              não o motivo sem_data da fila — o rótulo casa com a legenda da
              barra hatch pra não parecer o mesmo número do chip do filtro */}
          {sintese.semData > 0 && ` · ${sintese.semData} sem agendamento`}
          {sintese.registrosPendentes > 0 &&
            ` · ${sintese.registrosPendentes} ${
              sintese.registrosPendentes === 1
                ? "registro pendente"
                : "registros pendentes"
            }`}
          {sintese.lembretesEm48h > 0 &&
            ` · ${sintese.lembretesEm48h} ${
              sintese.lembretesEm48h === 1 ? "lembrete" : "lembretes"
            } em 48h`}
          {/* pedidos de apoio contam TODAS as duplas vivas — o sinal mais
              urgente da tela, e a fila dele é /chamados (uma dupla "em
              dia" com pedido aberto não aparece em "para acompanhar") */}
          {sintese.apoioAberto > 0 && (
            <>
              {" · "}
              <Link
                href="/chamados"
                className="font-medium text-foreground underline decoration-muted-foreground/40 underline-offset-2 transition-colors hover:text-primary"
              >
                {sintese.apoioAberto}{" "}
                {sintese.apoioAberto === 1
                  ? "pedido de apoio"
                  : "pedidos de apoio"}
              </Link>
            </>
          )}
        </p>
      )}

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
          <FilaAcompanhar linhas={linhas} />
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
          <PillTurma turma={r.meta ? `${r.turma} · ${r.meta}` : r.turma} />
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
          lime, feito em ok, futuro em traço. Cada círculo datado é link pro
          dia no calendário (?aba=calendario&dia=) — o li segue wrapper pra
          a contagem/estado continuar na régua */}
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
            {p.data != null ? (
              <Link
                href={`/agenda?aba=calendario&dia=${p.data}`}
                aria-label={`encontro ${p.numero} · ${r.turma} — abrir o dia no calendário`}
                className="grid size-full place-items-center rounded-full"
              >
                {p.numero}
              </Link>
            ) : (
              p.numero
            )}
          </li>
        ))}
      </ol>
      {/* legenda da régua — os swatches repetem os estados dos círculos
          (ok, tinta+anel, contorno) */}
      <p
        role="note"
        aria-label="Legenda da régua"
        className="mt-2 flex items-center gap-3 text-[11px] text-muted-foreground"
      >
        <span className="inline-flex items-center gap-1">
          <i aria-hidden className="size-2.5 rounded-full bg-[var(--ok)]" />
          feito
        </span>
        <span className="inline-flex items-center gap-1">
          <i
            aria-hidden
            className="size-2.5 rounded-full bg-foreground ring-1 ring-[var(--brand-lime)]"
          />
          atual
        </span>
        <span className="inline-flex items-center gap-1">
          <i aria-hidden className="size-2.5 rounded-full border border-border" />
          futuro
        </span>
      </p>
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
