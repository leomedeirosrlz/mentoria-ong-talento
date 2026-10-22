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
import { semanaBounds } from "@/lib/ciclo";
import { rotuloDiaAgenda } from "@/lib/agenda-minha";
import { msgsContato } from "@/lib/whatsapp-msgs";
import type { Interacao } from "@/lib/interacoes";
import type { CicloEvento, Cronograma, Dupla, Supervisao } from "@/lib/types";
import { buttonVariants } from "@/components/ui/button";
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
 *  REALIZA-161 → densidade REALIZA-176): faixa de síntese no topo (a
 *  leitura de 2s da fila) e depois a ordem operacional — 1º "Para
 *  acompanhar" (a resposta dos 5s: badges por dimensão — vermelho só no
 *  acompanhamento — filtros/busca/grupos no client e o Lembrar universal),
 *  2º "Semana no programa" (o que o calendário oficial impõe) e 3º "Semana
 *  do encontro" (o resumo por turma — nunca misturado — compactado em uma
 *  linha por cronograma com a barra única lime/muted da casa). A
 *  coordenação NÃO agenda por ninguém: a única ação sobre dupla aqui é o
 *  nudge. Toda a derivação mora em lib/agenda-coordenacao (pura); a página
 *  é quem busca os dados — este componente só compõe e renderiza. */
export function AgendaCoordenacao({
  duplas,
  eventos,
  cronogramas,
  nudges,
  supervisoes,
  encerramentosPendentes,
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
  /** dupla_ids com rito de encerramento aberto (getEncerramentosPendentes)
   *  — a dupla concluída vira linha "concluir na ficha" na fila. */
  encerramentosPendentes: ReadonlySet<string>;
  meuNome?: string;
  /** "YYYY-MM-DD" de hoje em São Paulo. */
  hoje: string;
}) {
  const agora = new Date();
  const { seg, dom } = semanaBounds(agora);
  const resumos = resumosPorCronograma(duplas, cronogramas, eventos, agora);
  const acompanhar = paraAcompanhar(
    duplas,
    eventos,
    nudges,
    agora,
    encerramentosPendentes
  );
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
    // encerramento pendente: a pendência é da coordenação — a fila desenha
    // o CTA "Concluir rito" (link pra ficha) no lugar do LembreteButton
    const acaoFicha = item.motivos.includes("encerramento");
    return {
      item,
      destino: apoioDoJovem ? "mentorado" : "mentor",
      rotulo: apoioDoJovem ? "Chamar" : item.rotuloLembrete,
      lembrete: acaoFicha
        ? { titulo: "", corpo: "" } // sem nudge — o CTA é o link da ficha
        : apoioDoJovem
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
      acao: acaoFicha ? ("ficha" as const) : ("lembrete" as const),
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
          {/* "sem agendamento" aqui = denominador das linhas-resumo
              (semAgendamento), não o motivo sem_data da fila — o rótulo
              casa com o "N sem agendamento" delas pra não parecer o mesmo
              número do chip do filtro */}
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

      {/* ---- Para acompanhar (1º — a pergunta dos 5s: quem pede ação?) ---- */}
      <section aria-label="Duplas para acompanhar">
        <h2 className="text-base font-semibold">
          Para acompanhar{" "}
          <span className="font-normal text-muted-foreground">
            · {acompanhar.length}
          </span>
        </h2>
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

      {/* ---- Semana no programa (2º — o que o calendário oficial cobra) ---- */}
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

      {/* ---- Semana do encontro, por cronograma (3º — contexto compacto) ---- */}
      <section aria-label="Semana do encontro por cronograma">
        <h2 className="text-base font-semibold">
          Semana do encontro, por cronograma
        </h2>
        <p className="mt-1.5 max-w-[78ch] text-xs leading-relaxed text-muted-foreground">
          {resumos.length > 1 ? (
            <>
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
            </>
          ) : (
            "Resumo por turma — cada uma no seu encontro."
          )}
        </p>
        {resumos.length === 0 ? (
          <p className="mt-3 rounded-xl border border-dashed px-4 py-3 text-sm text-muted-foreground">
            Nenhum cronograma com duplas em curso — quando uma turma entrar,
            o resumo dela aparece aqui.
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-border/60 overflow-hidden rounded-xl border bg-card">
            {resumos.map((r) => (
              <LinhaResumo key={r.cronogramaId} r={r} />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

// ---------- linha "Turma · Encontro N · dd/mm · X/Y" ----------

/** Uma linha por cronograma ativo (REALIZA-176): a mesma anatomia da
 *  LinhaPrograma — pill da turma, título com o deep-link pro dia oficial
 *  no calendário, sublinha com a contagem de duplas — e "X de Y
 *  realizaram" com a barra única lime/muted (a gramática do progresso dos
 *  outros painéis; "sem data" é fundo neutro, não erro). */
function LinhaResumo({ r }: { r: ResumoTurmaCard }) {
  const pct =
    r.ativas > 0 ? Math.min((r.realizaram / r.ativas) * 100, 100) : 0;
  const titulo =
    r.eventoNumero != null
      ? `Encontro ${r.eventoNumero}`
      : "Semana sem encontro oficial";
  return (
    <li className="flex flex-wrap items-center gap-3 px-4 py-3">
      {/* a "terças 19h" da meta é quando a turma se encontra — fica na
          pill, junto do nome (meta "—" = semana sem evento oficial) */}
      <PillTurma
        turma={
          r.meta && r.meta !== "—" ? `${r.turma} · ${r.meta}` : r.turma
        }
      />
      <div className="min-w-0 flex-1 basis-52">
        <p className="text-sm font-semibold leading-snug">
          {r.eventoData != null ? (
            <Link
              href={`/agenda?aba=calendario&dia=${r.eventoData}`}
              aria-label={`${titulo} · ${r.turma} — abrir o dia no calendário`}
              className="rounded-sm underline-offset-2 transition-colors hover:text-primary hover:underline"
            >
              {titulo}
              <span className="font-normal text-muted-foreground">
                {" "}
                · {dowCurto(r.eventoData)}{" "}
                {Number(r.eventoData.slice(8, 10))}/
                {Number(r.eventoData.slice(5, 7))}
              </span>
            </Link>
          ) : (
            titulo
          )}
        </p>
        <p className="mt-0.5 text-xs leading-snug text-muted-foreground">
          {r.ativas} {r.ativas === 1 ? "dupla ativa" : "duplas ativas"}
          {r.pausadas > 0 &&
            ` (+${r.pausadas} ${r.pausadas === 1 ? "pausada" : "pausadas"})`}
          {r.agendadas > 0 &&
            ` · ${r.agendadas} ${
              r.agendadas === 1 ? "agendada" : "agendadas"
            }`}
          {r.semAgendamento > 0 && ` · ${r.semAgendamento} sem agendamento`}
        </p>
      </div>
      <div className="flex items-center gap-2.5">
        <p className="text-sm font-semibold tabular-nums">
          {r.realizaram} de {r.ativas}
          <span className="ml-1 text-xs font-normal text-muted-foreground">
            realizaram
          </span>
        </p>
        <div
          role="progressbar"
          aria-valuenow={r.realizaram}
          aria-valuemin={0}
          aria-valuemax={Math.max(r.ativas, 1)}
          aria-label={`${r.turma}: ${r.realizaram} realizaram, ${r.agendadas} agendadas, ${r.semAgendamento} sem agendamento`}
          className="h-1.5 w-20 overflow-hidden rounded-full bg-muted sm:w-28"
        >
          <div
            className="fill-grow h-full rounded-full bg-[var(--brand-lime)] transition-[width] duration-500 ease-snappy"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
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
