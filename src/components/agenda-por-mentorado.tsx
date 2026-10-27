import type { ReactNode } from "react";
import Link from "next/link";
import {
  ArrowRight,
  CalendarDots,
  CalendarX,
  CaretDown,
  Check,
  ClipboardText,
  Clock,
  Eye,
  FlagCheckered,
  HandHeart,
  LockSimple,
  Paperclip,
  Plus,
  Sparkle,
} from "@phosphor-icons/react/dist/ssr";
import {
  alvoAgendamento,
  AVALIACAO_LABEL,
  comparaNome,
  DIFICULDADE_LABEL,
  diffDias,
  eventosDoCronograma,
  formatDate,
  formatDiaHora,
  formatDiaMes,
  formatDiaSemanaMes,
  jornadaDaDupla,
  lembreteBloqueadoAte,
  linkSeguro,
  ORDEM_SEMAFORO,
  passoEsp,
  passosDaTrilha,
  PROXIMO_PASSO_LABEL,
  rotuloSlot,
  saudadeDaDupla,
  SITUACAO_MENTORADO_LABEL,
  toDateStr,
  TRILHA_LEN,
  foraDoPrograma,
} from "@/lib/ciclo";
import { turmaCurta, turmaLonga } from "@/lib/turma";
import type {
  CicloEvento,
  Cronograma,
  Dificuldade,
  Dupla,
  Encontro,
  SolicitacaoEspecialista,
  SolicitacaoEspecialistaStatus,
  Supervisao,
  TrilhaJovem,
  TrilhaJovemRegistro,
  TrilhaJovemSessao,
} from "@/lib/types";
import {
  ehPendenciaRegistro,
  limboAberto,
  type AgendaItem,
} from "@/lib/agenda-minha";
import type { Interacao } from "@/lib/interacoes";
import { msgsContato } from "@/lib/whatsapp-msgs";
import { cn } from "@/lib/utils";
import { avatarPublicUrl } from "@/lib/avatar";
import { Avatar } from "@/components/avatar";
import { AgendaSuaSemana } from "@/components/agenda-sua-semana";
import { LembreteButton } from "@/components/lembrete-button";
import { dowCurto, Tag } from "@/components/agenda-partes";
import { Estrelas } from "@/components/estrelas";
import { SemaforoBadge } from "@/components/semaforo";
import { SolicitacaoStatusChip } from "@/components/solicitacao-status-chip";
import { SugerirEspecialistaDialog } from "@/components/sugerir-especialista-dialog";
import { TrilhaPrazoBadge } from "@/components/trilha-prazo-badge";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";

export type AgendaPorMentoradoProps = {
  duplas: Dupla[];
  trilhas: Record<string, TrilhaJovem[]>;
  solicitacoes: Record<string, SolicitacaoEspecialista[]>;
  especialistas: { id: string; nome: string }[];
  eventos: CicloEvento[];
  cronogramas: Cronograma[];
  /** Sessões do mentor — conduzidas + recebidas; "Do programa" filtra as
   *  recebidas (mentor_id === meuId) e o strip usa todas. */
  supervisoes: Supervisao[];
  /** Último contato por dupla — o "Lembrar o jovem" só conta tipo nudge. */
  nudges: Record<string, Interacao>;
  /** ids das duplas com rito de encerramento aberto
   *  (getEncerramentosPendentes). Só a concluída cobra. */
  encerramentosPendentes: string[];
  /** Os MESMOS itens da Minha agenda — o strip "Sua semana" os condensa. */
  itensSemana: AgendaItem[];
  /** staff+mentor e DPP+esp chegam via ?visao=dpp — o strip repassa ao
   *  deep-link do dia (mesma regra do AbasAgendaMentor). */
  hibrido?: boolean;
  meuId: string;
  /** Primeiro nome do mentor — assina o check-in do Lembrar. */
  meuNome: string;
  hoje: string;
  /** epoch ms do mesmo "agora" da page — semáforo/limbo/cap ancoram no
   *  snapshot do request, não num segundo `new Date()` do RSC. */
  agora: number;
};

/** Aba "Por mentorado" da agenda DPP (WP3, mock v6) — um card por jovem com
 *  progresso DPP, próximo encontro, a trilha de especialista em modo
 *  "acompanha, não participa", pendências acionáveis e o estado do pedido
 *  quando ainda não há trilha. Ordena por urgência (semáforo) e desempata
 *  pelo nome do jovem.
 *
 *  Decisões de desenho:
 *  - RSC sem "use client": todas as expansões são <details> nativas; o
 *    único pedaço interativo é o SugerirEspecialistaDialog (client por
 *    conta própria), instanciado aqui como boundary.
 *  - As 5 sessões NÃO usam TrilhaJornada: ela espera um JornadaDupla
 *    derivado de uma Dupla completa, e TrilhaJovem é a projeção da RPC
 *    trilha_do_jovem (0092) — outro shape, com registro integral, ★ do
 *    jovem por sessão e sem `link` (nunca participa → nunca renderiza).
 *  - Tentativa→passo segue a mesma regra do domínio: `numero` da sessão é
 *    o ordinal da tentativa e o passo do guia é o rank entre realizadas
 *    (passoEsp); um nao_aconteceu não queima passo. `encontroDoPassoEsp`
 *    pede Encontro[] completo, então a seleção do representante é
 *    reimplementada aqui sobre TrilhaJovemSessao. */
export function AgendaPorMentorado({
  duplas,
  trilhas,
  solicitacoes,
  especialistas,
  eventos,
  cronogramas,
  supervisoes,
  nudges,
  encerramentosPendentes,
  itensSemana,
  hibrido = false,
  meuId,
  meuNome,
  hoje,
  agora: agoraMs,
}: AgendaPorMentoradoProps) {
  const agora = new Date(agoraMs);
  // o dialog pede areas:string[]|null — a página projeta só {id,nome}; o
  // select dele já cai no ramo sem áreas quando null
  const especialistasDialog = especialistas.map((e) => ({
    ...e,
    areas: null as string[] | null,
  }));

  const saudePorDupla = new Map(
    duplas.map((d) => [d.id, saudadeDaDupla(d, eventos, agora)])
  );
  const nomeDaDupla = (d: Dupla) =>
    d.mentorado.nome_social || d.mentorado.nome;
  // risco → atenção → ok; dentro da mesma faixa, alfabética do jovem
  const duplasOrdenadas = [...duplas].sort(
    (a, b) =>
      ORDEM_SEMAFORO[saudePorDupla.get(a.id)!.semaforo] -
        ORDEM_SEMAFORO[saudePorDupla.get(b.id)!.semaforo] ||
      comparaNome(nomeDaDupla(a), nomeDaDupla(b))
  );

  if (duplas.length === 0) {
    return (
      <div className="rounded-xl bg-card px-5 py-10 text-center shadow-[var(--shadow-border)]">
        <span aria-hidden className="mx-auto inline-flex">
          <span className="size-8 rounded-full bg-[var(--brand-lime)] ring-2 ring-card" />
          <span className="-ml-2.5 size-8 rounded-full bg-[var(--role-mentorado)] ring-2 ring-card" />
        </span>
        <p className="mt-3 font-medium text-foreground">
          Você ainda não está em nenhuma dupla.
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          A coordenação forma as duplas. Quando a sua estiver pronta, o
          acompanhamento por mentorado aparece aqui.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* o strip da semana só aparece quando tem o que condensar — sem
          itens derivados ele seria 7 "livre" sem utilidade */}
      {itensSemana.length > 0 && (
        <AgendaSuaSemana itens={itensSemana} hoje={hoje} hibrido={hibrido} />
      )}
      {/* >1 dupla: cards em 2 colunas em xl (mesma régua da home do
          mentor); com 1 só, a coluna única mantém a leitura confortável */}
      <div className={cn("grid gap-6", duplas.length > 1 && "xl:grid-cols-2")}>
        {duplasOrdenadas.map((dupla) => (
          <CardMentorado
            key={dupla.id}
            dupla={dupla}
            saude={saudePorDupla.get(dupla.id)!}
            trilhas={trilhas[dupla.id] ?? []}
            solicitacoes={solicitacoes[dupla.id] ?? []}
            especialistas={especialistasDialog}
            eventos={eventos}
            cronogramas={cronogramas}
            nudge={
              nudges[dupla.id]?.tipo === "nudge" ? nudges[dupla.id] : null
            }
            encerramentoPendente={
              dupla.status === "concluida" &&
              encerramentosPendentes.includes(dupla.id)
            }
            meuNome={meuNome}
            agora={agora}
            agoraMs={agoraMs}
            hoje={hoje}
          />
        ))}
      </div>
      <DoPrograma
        supervisoes={supervisoes}
        eventos={eventos}
        duplas={duplas}
        meuId={meuId}
        hoje={hoje}
      />
    </div>
  );
}

// ---------- card por jovem ----------

function CardMentorado({
  dupla,
  saude,
  trilhas,
  solicitacoes,
  especialistas,
  eventos,
  cronogramas,
  nudge,
  encerramentoPendente,
  meuNome,
  agora,
  agoraMs,
  hoje,
}: {
  dupla: Dupla;
  saude: ReturnType<typeof saudadeDaDupla>;
  trilhas: TrilhaJovem[];
  solicitacoes: SolicitacaoEspecialista[];
  especialistas: { id: string; nome: string; areas: string[] | null }[];
  eventos: CicloEvento[];
  cronogramas: Cronograma[];
  /** Último `interacoes` tipo nudge da dupla — alimenta o cap de 48h. */
  nudge: Interacao | null;
  /** Rito aberto desta dupla (só concluída) — a decisão é da coordenação. */
  encerramentoPendente: boolean;
  /** Primeiro nome do mentor — assina o check-in do Lembrar. */
  meuNome: string;
  agora: Date;
  agoraMs: number;
  hoje: string;
}) {
  const nome = dupla.mentorado.nome_social || dupla.mentorado.nome;
  const primeiroNome = nome.split(" ")[0];
  // o calendário é SEMPRE o do cronograma da dupla — a união das turmas
  // mentiria progresso e sugestão (0061)
  const eventosDaDupla = eventosDoCronograma(eventos, dupla.cronograma_id);
  const cronograma = cronogramas.find((c) => c.id === dupla.cronograma_id);
  const jornada = jornadaDaDupla(
    dupla,
    passosDaTrilha("dpp", eventosDaDupla),
    agora
  );
  const alvo = alvoAgendamento(dupla, eventos, agora);
  const total = jornada.total || TRILHA_LEN.dpp;
  const feitos = jornada.feitos;
  const pct = total > 0 ? Math.round((feitos / total) * 100) : 0;

  // agendado/remarcado futuro — saude.proximo só cobre 'agendado'; o
  // remarcado é a mesma intenção viva nos buckets do domínio
  const proximo =
    dupla.encontros
      .filter(
        (e) =>
          (e.status === "agendado" || e.status === "remarcado") &&
          e.data_hora != null &&
          new Date(e.data_hora) >= agora
      )
      .sort(
        (a, b) =>
          new Date(a.data_hora!).getTime() - new Date(b.data_hora!).getTime()
      )[0] ?? null;
  const limbo =
    dupla.encontros
      .filter((e) => limboAberto(e, agoraMs))
      .sort((a, b) => a.numero - b.numero)[0] ?? null;

  // pendências do MENTOR nesta dupla: registro por entregar — MESMO
  // predicado da Minha agenda (limbo fechado ou realizado >24h sem
  // registro, cobrindo "remarcado" legado) — e combinados com prazo vencido
  const registrosPendentes = dupla.encontros
    .filter((e) => ehPendenciaRegistro(e, agoraMs))
    .sort((a, b) => a.numero - b.numero);
  const combinadosVencidos = dupla.encaminhamentos
    .filter((t) => t.status === "pendente" && t.prazo != null && t.prazo < hoje)
    .sort((a, b) => a.prazo!.localeCompare(b.prazo!));
  const semPendencia =
    registrosPendentes.length === 0 &&
    combinadosVencidos.length === 0 &&
    !encerramentoPendente;

  // trilhas: ativa/pausada rendem bloco aberto; concluída/encerrada viram
  // histórico colapsado (até 3 por jovem no domínio — a lista cabe)
  const trilhasVivas = trilhas.filter(
    (t) => t.status === "ativa" || t.status === "pausada"
  );
  const trilhasAnteriores = trilhas
    .filter((t) => t.status === "concluida" || t.status === "encerrada")
    .sort((a, b) =>
      (b.encerrada_em ?? "").localeCompare(a.encerrada_em ?? "")
    );

  // pedido em voo = ainda pode virar trilha; um pedido que JÁ virou trilha
  // (aceita com dupla_id coberto por uma trilha projetada) não repete bloco
  const efetivo = (s: SolicitacaoEspecialista) => s.status_efetivo ?? s.status;
  const duplaDasTrilhas = new Set(trilhas.map((t) => t.dupla_id));
  const EM_VOO: SolicitacaoEspecialistaStatus[] = [
    "sugerida",
    "aberta",
    "aguardando_coord",
    "contra_proposta",
    "aceita",
  ];
  const pedidosEmVoo = solicitacoes.filter(
    (s) =>
      EM_VOO.includes(efetivo(s)) &&
      !(efetivo(s) === "aceita" && s.dupla_id && duplaDasTrilhas.has(s.dupla_id))
  );
  const pedidoEmVoo = pedidosEmVoo[0] ?? null; // a query já vem desc por created_at
  const pedidosHistoricos = solicitacoes.filter(
    (s) =>
      !pedidosEmVoo.includes(s) &&
      !(efetivo(s) === "aceita" && s.dupla_id != null)
  );

  const mentoradoFora = foraDoPrograma(dupla.mentorado);

  return (
    <article className="flex flex-col gap-4 rounded-xl bg-card p-5 shadow-[var(--shadow-border)]">
      {/* header: identidade + saúde da dupla — o texto do semáforo carrega
          o estado (cor nunca é o único canal, PV-2) */}
      <div className="flex flex-wrap items-start gap-3">
        <Avatar
          papel="mentorado"
          nome={nome}
          size={44}
          src={
            dupla.mentorado.avatar_path
              ? avatarPublicUrl(dupla.mentorado.avatar_path)
              : null
          }
        />
        <div className="min-w-28 flex-1">
          <h3 className="flex flex-wrap items-center gap-x-2 gap-y-1 font-semibold leading-snug">
            <span className="truncate">{nome}</span>
            <Badge variant="secondary">{turmaLonga(dupla.turma)}</Badge>
            {dupla.status !== "ativa" && (
              <Badge variant="outline" className="text-muted-foreground">
                {dupla.status === "pausada"
                  ? "pausada"
                  : dupla.status === "concluida"
                    ? "concluída"
                    : "encerrada"}
              </Badge>
            )}
            {mentoradoFora && (
              <Badge variant="outline" className="text-muted-foreground">
                {SITUACAO_MENTORADO_LABEL[dupla.mentorado.situacao!] ??
                  dupla.mentorado.situacao}
              </Badge>
            )}
          </h3>
          {cronograma && (
            <p className="mt-0.5 text-xs text-muted-foreground">
              {cronograma.nome}
            </p>
          )}
        </div>
        <SemaforoBadge nivel={saude.semaforo} motivo={saude.motivo} />
      </div>

      {/* progresso DPP: "encontro N de 16" é o passo corrente; a barra
          mede o que já aconteceu de verdade (realizados) */}
      <div>
        <div className="flex items-baseline justify-between gap-2 text-sm">
          <p className="font-medium">
            {jornada.completa
              ? `${total} de ${total} encontros`
              : `Encontro ${alvo.proximoNumero} de ${total}`}
            <span className="text-muted-foreground">
              {" "}
              · {turmaCurta(dupla.turma)}
            </span>
          </p>
          <span className="tabular-nums text-muted-foreground">{pct}%</span>
        </div>
        <div
          role="progressbar"
          aria-valuenow={feitos}
          aria-valuemin={0}
          aria-valuemax={total}
          aria-label={`${feitos} de ${total} encontros realizados`}
          className="mt-1.5 h-2 overflow-hidden rounded-full bg-muted"
        >
          <div
            className="h-full rounded-full bg-[var(--ok)] transition-[width]"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      <ProximoEncontro
        dupla={dupla}
        proximo={proximo}
        limbo={limbo}
        alvo={alvo}
        jornadaCompleta={jornada.completa}
        feitos={feitos}
        total={total}
        hoje={hoje}
      />

      {/* trilha(s) de especialista — leitura total, ação zero */}
      {trilhasVivas.map((trilha) => (
        <TrilhaBlock
          key={trilha.dupla_id}
          trilha={trilha}
          primeiroNome={primeiroNome}
          agoraMs={agoraMs}
        />
      ))}

      {/* sem trilha viva: o pedido em voo vira stepper; sem nada em voo,
          a porta de entrada honesta é sugerir (passa pelo jovem) */}
      {pedidoEmVoo && (
        <PedidoEspecialistaBlock
          solicitacao={pedidoEmVoo}
          primeiroNome={primeiroNome}
          hoje={hoje}
        />
      )}
      {/* a porta de entrada "sugerir" só faz sentido com a jornada viva —
          concluída/encerrada não abre trilha nova (a pendência que resta é
          o rito, já cobrido acima) */}
      {dupla.status === "ativa" &&
        trilhasVivas.length === 0 &&
        !pedidoEmVoo && (
          <SemTrilhaBlock
            dupla={dupla}
            especialistas={especialistas}
            primeiroNome={primeiroNome}
            tinhaHistorico={trilhasAnteriores.length > 0}
          />
        )}
      {pedidosHistoricos.length > 0 && (
        <PedidosAnterioresLine solicitacoes={pedidosHistoricos} />
      )}
      {trilhasAnteriores.length > 0 && (
        <TrilhasAnteriores trilhas={trilhasAnteriores} />
      )}

      {/* pendências acionáveis — deep link direto pro ponto da ficha */}
      <section aria-label="Pendências da dupla" className="space-y-2">
        <h4 className="text-xs sm:text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          Pendências da dupla
        </h4>
        {semPendencia ? (
          <p className="text-sm text-muted-foreground">
            Nada pendente. A dupla está em dia.
          </p>
        ) : (
          <ul className="space-y-1.5">
            {registrosPendentes.map((e) => {
              const noLimbo = limboAberto(e, agoraMs);
              return (
                <li
                  key={e.id}
                  className="flex flex-wrap items-center gap-3 rounded-lg bg-[var(--warn)]/8 px-3 py-2.5"
                >
                  <Clock
                    size={18}
                    aria-hidden
                    className="shrink-0 text-[var(--warn-text)]"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">
                      Registro do encontro {e.numero}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {noLimbo
                        ? `estava agendado ${formatDiaHora(e.data_hora)} · aconteceu? registre ou remarque`
                        : "encontro realizado sem registro: atividades, avaliação e próximo passo"}
                    </p>
                  </div>
                  <Link
                    href={`/duplas/${dupla.id}#registrar-${e.id}`}
                    className={buttonVariants({ variant: "outline", size: "sm" })}
                  >
                    Preencher
                  </Link>
                </li>
              );
            })}
            {combinadosVencidos.map((t) => (
              <li
                key={t.id}
                className="flex flex-wrap items-center gap-3 rounded-lg bg-[var(--warn)]/8 px-3 py-2.5"
              >
                <ClipboardText
                  size={18}
                  aria-hidden
                  className="shrink-0 text-[var(--warn-text)]"
                />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">Combinado vencido</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {t.descricao} · prazo era {formatDate(t.prazo)}
                  </p>
                </div>
                <Link
                  href={`/duplas/${dupla.id}#combinados`}
                  className={buttonVariants({ variant: "outline", size: "sm" })}
                >
                  Ver na ficha
                </Link>
              </li>
            ))}
            {/* rito de encerramento aberto (REALIZA-172): a jornada concluiu
                mas o fechamento não — a decisão é da coordenação, na ficha
                da dupla */}
            {encerramentoPendente && (
              <li className="flex flex-wrap items-center gap-3 rounded-lg bg-[var(--warn)]/8 px-3 py-2.5">
                <FlagCheckered
                  size={18}
                  aria-hidden
                  className="shrink-0 text-[var(--warn-text)]"
                />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">
                    Rito de encerramento pendente
                  </p>
                  <p className="text-xs text-muted-foreground">
                    A coordenação conclui o rito na ficha da dupla.
                  </p>
                </div>
                <Link
                  href={`/duplas/${dupla.id}`}
                  className={buttonVariants({ variant: "outline", size: "sm" })}
                >
                  Abrir ficha
                </Link>
              </li>
            )}
          </ul>
        )}
      </section>

      {/* uma saída nomeada pro trabalho real — agendar/remarcar acontece na
          ficha, que é onde a dupla agenda (o mentor DPP não marca sessão
          de especialista nem recebe CTA dela aqui). O "Lembrar" (D5) é o
          canal leve com o jovem — notificação + WhatsApp, nunca cobrança */}
      <div className="mt-auto flex flex-wrap gap-2 border-t border-border/60 pt-4">
        <Link
          href={`/duplas/${dupla.id}`}
          className={buttonVariants({ variant: "outline", size: "sm" })}
        >
          Abrir ficha da dupla
          <ArrowRight size={14} />
        </Link>
        {dupla.status === "ativa" && (
          <LembreteButton
            duplaId={dupla.id}
            destino="mentorado"
            rotulo={`Lembrar ${primeiroNome}`}
            telefone={dupla.mentorado.whatsapp ?? null}
            titulo="Lembrete do seu mentor"
            corpo={
              msgsContato(
                {
                  eu: meuNome,
                  mentorNome: meuNome,
                  mentoradoNome: primeiroNome,
                },
                {
                  casoMentorado:
                    "Passando pra ver como você está e se precisa de algo por aqui. Os encontros seguem abertos pra vocês marcarem quando couber.",
                }
              ).mentorado ?? ""
            }
            href="/jovem/agenda"
            bloqueadoAte={lembreteBloqueadoAte(nudge, agora)}
          />
        )}
      </div>
    </article>
  );
}

// ---------- próximo encontro ----------

function ProximoEncontro({
  dupla,
  proximo,
  limbo,
  alvo,
  jornadaCompleta,
  feitos,
  total,
  hoje,
}: {
  dupla: Dupla;
  proximo: Encontro | null;
  limbo: Encontro | null;
  alvo: ReturnType<typeof alvoAgendamento>;
  jornadaCompleta: boolean;
  feitos: number;
  total: number;
  hoje: string;
}) {
  let titulo: ReactNode;
  let detalhe: ReactNode = null;

  if (dupla.status === "pausada") {
    titulo = "Dupla pausada · encontros congelados por ora";
  } else if (dupla.status === "concluida") {
    titulo = "Jornada concluída";
    detalhe = `${feitos} de ${total} encontros realizados`;
  } else if (dupla.status === "encerrada") {
    titulo = "Dupla encerrada";
    detalhe = `${feitos} de ${total} encontros realizados`;
  } else if (limbo) {
    // limbo é honesto: a plataforma não sabe se rolou — a pergunta é da
    // dupla, a correção acontece na ficha (remarcar/registrar). O CTA é a
    // pill outline sm dos outros cartões de pendência — um link inline de
    // texto tinha ~20px de alvo no toque.
    titulo = `Estava agendado ${formatDiaHora(limbo.data_hora)}`;
    detalhe = (
      <>
        <span className="block">
          não aconteceu? Se rolou, o registro também é na ficha
        </span>
        <Link
          href={`/duplas/${dupla.id}`}
          className={cn(
            buttonVariants({ variant: "outline", size: "sm" }),
            "mt-2"
          )}
        >
          Remarcar na ficha
        </Link>
      </>
    );
  } else if (proximo?.data_hora) {
    const dias = diffDias(toDateStr(new Date(proximo.data_hora)), hoje);
    const hora = new Date(proximo.data_hora).toLocaleTimeString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "America/Sao_Paulo",
    });
    const quando =
      dias === 0
        ? `Hoje, ${hora}`
        : dias === 1
          ? `Amanhã, ${hora}`
          : formatDiaHora(proximo.data_hora);
    titulo = `Encontro ${proximo.numero} · ${quando}`;
    // "online" quando há link da dupla; duração só quando foge do 1h
    // padrão — o número 60 vira ruído em todo card
    detalhe =
      [
        linkSeguro(proximo.link) ? "online" : null,
        proximo.duracao_min && proximo.duracao_min !== 60
          ? `${proximo.duracao_min} min`
          : null,
      ]
        .filter(Boolean)
        .join(" · ") || null;
  } else if (jornadaCompleta || alvo.cicloCompleto) {
    titulo = "Jornada completa";
    detalhe = `${feitos} de ${total} encontros realizados`;
  } else {
    // ninguém agendou — a sugestão é a data oficial do PDF; quem marca é a
    // dupla na ficha, nunca este card (por isso texto, não botão)
    titulo = "A agendar pela dupla";
    detalhe = `encontro ${alvo.proximoNumero}${
      alvo.sugeridoProximo
        ? ` sugerido ${formatDiaSemanaMes(alvo.sugeridoProximo)}`
        : ""
    } · o agendamento é na ficha`;
  }

  return (
    <div className="flex items-start gap-3 rounded-lg bg-muted/50 px-4 py-3 shadow-[var(--shadow-inset)]">
      <CalendarDots
        size={20}
        aria-hidden
        className={cn(
          "mt-0.5 shrink-0",
          limbo ? "text-[var(--warn-text)]" : "text-muted-foreground"
        )}
      />
      <div className="min-w-0">
        <p className="text-xs sm:text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
          Próximo encontro
        </p>
        <p className="mt-0.5 text-sm font-medium">{titulo}</p>
        {detalhe && (
          <p className="text-xs text-muted-foreground">{detalhe}</p>
        )}
      </div>
    </div>
  );
}

// ---------- trilha de especialista (acompanha, não participa) ----------

/** A tentativa que representa um passo do guia — o realizado que o cobriu,
 *  senão a tentativa mais recente mirando nele (mesma regra de
 *  encontroDoPassoEsp, reescrita pro shape da projeção). */
function sessaoDoPasso(
  sessoes: TrilhaJovemSessao[],
  passo: number
): TrilhaJovemSessao | null {
  let alvo: TrilhaJovemSessao | null = null;
  for (const s of sessoes) {
    if (passoEsp(s, sessoes) !== passo) continue;
    if (
      !alvo ||
      s.status === "realizado" ||
      (alvo.status !== "realizado" && s.numero > alvo.numero)
    ) {
      alvo = s;
    }
  }
  return alvo;
}

function TrilhaBlock({
  trilha,
  primeiroNome,
  agoraMs,
}: {
  trilha: TrilhaJovem;
  primeiroNome: string;
  agoraMs: number;
}) {
  const totalEsp = TRILHA_LEN.especialista;
  const sessoes = [...trilha.sessoes].sort((a, b) => a.numero - b.numero);
  const feitos = sessoes.filter((s) => s.status === "realizado").length;
  const passoAtual = Math.min(feitos + 1, totalEsp);
  const nomeEsp = trilha.especialista_nome ?? "especialista a definir";

  return (
    <section
      aria-label={`Trilha de especialista · ${nomeEsp}`}
      className="space-y-3 rounded-lg border border-dashed border-[var(--warn)]/50 bg-[var(--warn)]/8 p-4"
    >
      <header className="flex items-start gap-2.5">
        <Eye
          size={18}
          aria-hidden
          className="mt-0.5 shrink-0 text-[var(--warn-text)]"
        />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">Você acompanha, não participa</p>
          <p className="text-xs text-muted-foreground">
            Trilha com {nomeEsp}
            {trilha.demanda && (
              <>
                {" · "}
                <span className="italic">{trilha.demanda}</span>
              </>
            )}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
          <TrilhaPrazoBadge
            dupla={{
              iniciada_em: trilha.iniciada_em,
              encerrada_em: trilha.encerrada_em,
              status: trilha.status,
            }}
          />
          <Badge
            variant="outline"
            className="border-[var(--warn)]/60 text-[var(--warn-text)]"
          >
            {feitos >= totalEsp
              ? "5 de 5 sessões"
              : `sessão ${passoAtual} de ${totalEsp}`}
          </Badge>
          {trilha.status === "pausada" && (
            <Badge variant="outline" className="text-muted-foreground">
              pausada
            </Badge>
          )}
        </div>
      </header>

      {/* 5 passos do guia, sempre: cada linha conta o estado REAL da
          tentativa que mira aquele passo — nunca inventa sessão */}
      <ol className="space-y-1">
        {Array.from({ length: totalEsp }, (_, i) => i + 1).map((passo) => (
          <SessaoRow
            key={passo}
            passo={passo}
            rep={sessaoDoPasso(sessoes, passo)}
            passoAtual={passoAtual}
            primeiroNome={primeiroNome}
            nomeEsp={nomeEsp}
            agoraMs={agoraMs}
          />
        ))}
      </ol>

      {trilha.devolutiva_pdm && (
        <div className="rounded-md border-l-2 border-[var(--brand-lime)] bg-card/70 px-3 py-2">
          <p className="flex items-center gap-1.5 text-xs font-semibold text-[var(--ok-text)]">
            <FlagCheckered size={13} aria-hidden />
            Devolutiva final: segue pro PDM de {primeiroNome}
          </p>
          <p className="mt-1 whitespace-pre-line break-words text-sm text-muted-foreground">
            {trilha.devolutiva_pdm}
          </p>
        </div>
      )}

      {trilha.devolutivas.length > 0 && (
        <details className="group/dev">
          <summary className="inline-flex min-h-11 cursor-pointer list-none items-center gap-1.5 rounded-md text-xs font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:min-h-8 [&::-webkit-details-marker]:hidden">
            <CaretDown
              size={13}
              aria-hidden
              className="transition-transform group-open/dev:-rotate-90"
            />
            Devolutivas ({trilha.devolutivas.length})
          </summary>
          <ul className="mt-1 space-y-2">
            {trilha.devolutivas.map((d, i) => (
              <li
                key={i}
                className="rounded-md bg-card/70 px-3 py-2 text-sm"
              >
                <p className="whitespace-pre-line break-words">{d.texto}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {d.autor_nome ?? "Especialista"} · {formatDate(d.created_at)}
                </p>
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}

function SessaoRow({
  passo,
  rep,
  passoAtual,
  primeiroNome,
  nomeEsp,
  agoraMs,
}: {
  passo: number;
  rep: TrilhaJovemSessao | null;
  passoAtual: number;
  primeiroNome: string;
  nomeEsp: string;
  agoraMs: number;
}) {
  // estado honesto da linha: realizado vence sempre (é o que cobre o
  // passo); sem realizado, a última tentativa conta a história como ela é
  let titulo: string;
  let detalhe: ReactNode = null;
  let icone: ReactNode;
  let tom: "done" | "lime" | "warn" | "muted";
  let registroDaSessao: TrilhaJovemRegistro | null = null;

  const repEmLimbo =
    rep != null &&
    (rep.status === "agendado" || rep.status === "remarcado") &&
    rep.data_hora != null &&
    new Date(rep.data_hora).getTime() < agoraMs;

  if (rep?.status === "realizado") {
    titulo = "Concluída";
    const quando = rep.realizado_em ?? rep.data_hora;
    detalhe = (
      <>
        {quando ? `${formatDate(quando)} · ` : ""}
        {rep.registro ? "registro entregue" : "registro pendente"}
        {rep.estrelas != null && (
          <>
            {" · "}
            {primeiroNome} avaliou{" "}
            <Estrelas n={rep.estrelas} size={12} className="inline-flex align-[-1px]" />
          </>
        )}
      </>
    );
    icone = <Check size={14} weight="bold" aria-hidden />;
    tom = "done";
    registroDaSessao = rep.registro;
  } else if (
    rep != null &&
    (rep.status === "agendado" || rep.status === "remarcado") &&
    !repEmLimbo &&
    rep.data_hora != null
  ) {
    titulo = "Confirmada";
    detalhe = `${formatDiaHora(rep.data_hora)}${
      rep.duracao_min ? ` · ${rep.duracao_min} min` : ""
    }`;
    icone = <Clock size={14} aria-hidden />;
    tom = "lime";
  } else if (repEmLimbo) {
    // sessão marcada já passou e ninguém confirmou — a plataforma não
    // sabe se rolou; afirmar "concluída" mentiria
    titulo = "A confirmar";
    detalhe = `estava marcada ${formatDiaHora(rep!.data_hora)} · ${nomeEsp} confirma se aconteceu · sem ação sua`;
    icone = <Clock size={14} aria-hidden />;
    tom = "warn";
  } else if (
    rep != null &&
    (rep.status === "nao_aconteceu" || rep.status === "cancelado")
  ) {
    // tentativa morta como representante do passo: ela morreu, o passo
    // segue aberto — a remarcação é entre os dois, nunca do mentor
    titulo = rep.status === "cancelado" ? "Cancelada" : "Não aconteceu";
    detalhe = `remarcação entre ${primeiroNome} e ${nomeEsp} · o passo não se perde · sem ação sua`;
    icone = <CalendarX size={14} aria-hidden />;
    tom = "muted";
  } else if (rep != null) {
    // agendada/remarcada ainda sem data_hora — existe a intenção, falta
    // o quando; mesma gramática do "sem horário", mas sem fingir que a
    // tentativa não existe
    titulo = "Sem horário";
    detalhe = `${primeiroNome} ainda não propôs · sem ação sua`;
    icone = <Plus size={14} aria-hidden />;
    tom = "muted";
  } else if (passo === passoAtual) {
    titulo = "Sem horário";
    detalhe = `${primeiroNome} ainda não propôs · sem ação sua`;
    icone = <Plus size={14} aria-hidden />;
    tom = "muted";
  } else if (passo < passoAtual) {
    // passo anterior sem realizada nem tentativa — só acontece se o dado
    // vier cortado; honesto mesmo assim (não é "futuro" nem "feito")
    titulo = "Sem sessão registrada";
    detalhe = "sem ação sua";
    icone = <Plus size={14} aria-hidden />;
    tom = "muted";
  } else {
    titulo = "Ainda não liberada";
    detalhe = `abre após a sessão ${passo - 1}`;
    icone = <LockSimple size={14} aria-hidden />;
    tom = "muted";
  }

  return (
    <li className="rounded-md px-2 py-1.5">
      <div className="flex items-start gap-2.5">
        <span
          aria-hidden
          className={cn(
            "mt-0.5 grid size-6 shrink-0 place-items-center rounded-full",
            tom === "done" && "bg-[var(--ok)]/15 text-[var(--ok-text)]",
            tom === "lime" && "bg-[var(--brand-lime)]/25 text-foreground",
            tom === "warn" && "bg-[var(--warn)]/20 text-[var(--warn-text)]",
            tom === "muted" &&
              "border border-dashed border-border text-muted-foreground"
          )}
        >
          {icone}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm">
            <span className="font-medium">Sessão {passo}</span>
            <span className="text-muted-foreground"> · {titulo}</span>
          </p>
          {detalhe && (
            <p className="text-xs text-muted-foreground">{detalhe}</p>
          )}
          {registroDaSessao && (
            <details className="group/reg mt-1">
              <summary className="inline-flex min-h-11 cursor-pointer list-none items-center gap-1.5 rounded-md text-xs font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:min-h-7 [&::-webkit-details-marker]:hidden">
                <CaretDown
                  size={13}
                  aria-hidden
                  className="transition-transform group-open/reg:-rotate-90"
                />
                Ver registro da sessão
              </summary>
              <RegistroSessao registro={registroDaSessao} />
            </details>
          )}
        </div>
      </div>
    </li>
  );
}

/** Registro integral da sessão do especialista (decisão D2/WP3: o DPP lê
 *  tudo do registro — texto, avaliação, anexos por nome — menos os campos
 *  da avaliação DO JOVEM que a identificariam além da nota). */
function RegistroSessao({ registro }: { registro: TrilhaJovemRegistro }) {
  const linhas: [string, ReactNode][] = [];
  if (registro.tema) linhas.push(["Tema", registro.tema]);
  if (registro.ferramenta) linhas.push(["Ferramenta", registro.ferramenta]);
  if (registro.atividades?.length)
    linhas.push(["Atividades", registro.atividades.join(" · ")]);
  if (registro.avaliacao)
    linhas.push([
      "Avaliação",
      AVALIACAO_LABEL[registro.avaliacao] ?? registro.avaliacao,
    ]);
  if (registro.dificuldade && registro.dificuldade !== "nenhuma")
    linhas.push([
      "Dificuldade",
      `${
        DIFICULDADE_LABEL[registro.dificuldade as Dificuldade] ??
        registro.dificuldade
      }${registro.dificuldade_detalhe ? `: ${registro.dificuldade_detalhe}` : ""}`,
    ]);
  if (registro.reflexoes) linhas.push(["Reflexões", registro.reflexoes]);
  if (registro.observacoes)
    linhas.push(["Observações", registro.observacoes]);
  if (registro.proximo_passo)
    linhas.push([
      "Próximo passo",
      `${
        PROXIMO_PASSO_LABEL[registro.proximo_passo] ??
        registro.proximo_passo
      }${registro.proximo_passo_detalhe ? `: ${registro.proximo_passo_detalhe}` : ""}`,
    ]);

  return (
    <div className="mt-1.5 space-y-2 rounded-md bg-card/70 px-3 py-2.5">
      {registro.precisa_apoio && (
        <p className="flex items-center gap-1.5 rounded-md bg-[var(--warn)]/10 px-2.5 py-1.5 text-xs font-medium text-[var(--warn-text)]">
          <HandHeart size={14} aria-hidden />
          Especialista pediu apoio à equipe
        </p>
      )}
      {linhas.length > 0 && (
        <dl className="grid grid-cols-[6.5rem_1fr] gap-x-3 gap-y-1.5 text-xs">
          {linhas.map(([k, v]) => (
            <div key={k} className="contents">
              <dt className="font-medium text-muted-foreground">{k}</dt>
              <dd className="min-w-0 whitespace-pre-line break-words">{v}</dd>
            </div>
          ))}
        </dl>
      )}
      {registro.anexos.length > 0 && (
        <p className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
          <Paperclip size={13} aria-hidden />
          {registro.anexos.length}{" "}
          {registro.anexos.length === 1 ? "anexo" : "anexos"}
          <span className="min-w-0">
            · {registro.anexos.map((a) => a.nome).join(", ")}
          </span>
        </p>
      )}
      <p className="text-xs text-muted-foreground/80">
        registrado em {formatDate(registro.created_at)}
      </p>
    </div>
  );
}

// ---------- trilhas anteriores (histórico colapsado) ----------

function TrilhasAnteriores({ trilhas }: { trilhas: TrilhaJovem[] }) {
  return (
    <details className="group/hist rounded-lg border border-border/70 bg-muted/30 px-4 py-2.5">
      <summary className="flex min-h-11 cursor-pointer list-none items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:min-h-9 [&::-webkit-details-marker]:hidden">
        <CaretDown
          size={13}
          aria-hidden
          className="transition-transform group-open/hist:-rotate-90"
        />
        Trilhas anteriores ({trilhas.length})
      </summary>
      <ul className="mt-1 space-y-3 pb-1.5">
        {trilhas.map((t) => {
          const feitas = t.sessoes.filter(
            (s) => s.status === "realizado"
          ).length;
          return (
            <li key={t.dupla_id} className="text-sm">
              <p className="font-medium">
                {t.especialista_nome ?? "Especialista"}
                {t.demanda && (
                  <span className="font-normal text-muted-foreground">
                    {" · "}
                    <span className="italic">{t.demanda}</span>
                  </span>
                )}
              </p>
              <p className="text-xs text-muted-foreground">
                {feitas} de {TRILHA_LEN.especialista} sessões
                {t.iniciada_em && ` · iniciada ${formatDate(t.iniciada_em)}`}
                {t.encerrada_em &&
                  ` · ${
                    t.status === "concluida" ? "concluída" : "encerrada"
                  } ${formatDate(t.encerrada_em)}`}
                {t.motivo_encerramento && ` · ${t.motivo_encerramento}`}
              </p>
              {t.devolutiva_pdm && (
                <p className="mt-1.5 whitespace-pre-line break-words rounded-md border-l-2 border-[var(--brand-lime)] bg-card/70 px-3 py-2 text-sm text-muted-foreground">
                  {t.devolutiva_pdm}
                </p>
              )}
            </li>
          );
        })}
      </ul>
    </details>
  );
}

// ---------- pedido em voo (sem trilha ainda) ----------

const PASSOS_PEDIDO = ["Pedido", "Mural", "Aceite", "Trilha"] as const;

function PedidoEspecialistaBlock({
  solicitacao,
  primeiroNome,
  hoje,
}: {
  solicitacao: SolicitacaoEspecialista;
  primeiroNome: string;
  hoje: string;
}) {
  const s = solicitacao;
  const efetivo = s.status_efetivo ?? s.status;
  const quem =
    s.especialista?.nome ?? s.especialista_nome ?? s.desejado?.nome ?? null;
  const diasNoMural = diffDias(hoje, toDateStr(new Date(s.created_at)));
  const tema = s.demanda ?? s.motivo;

  // cada passo: [estado, legenda] — o estado diz onde a bola está SEM
  // inventar prazo; "X dias" vem do created_at real do pedido
  type Estado = "done" | "current" | "open";
  let passos: [Estado, string][];
  switch (efetivo) {
    case "sugerida":
      passos = [
        [
          "current",
          `sugestão sua aguardando ${primeiroNome} confirmar · ainda não virou pedido`,
        ],
        ["open", "a coordenação libera pro mural"],
        ["open", "um especialista aceita e a trilha começa"],
        ["open", "5 sessões em ~3 meses"],
      ];
      break;
    case "aguardando_coord":
      passos = [
        ["done", `pedido registrado em ${formatDate(s.created_at)}`],
        ["current", "com a coordenação · ainda não foi pro mural"],
        ["open", "um especialista aceita e a trilha começa"],
        ["open", "5 sessões em ~3 meses"],
      ];
      break;
    case "contra_proposta":
      passos = [
        ["done", `pedido de ${formatDate(s.created_at)}`],
        ["done", "engajou um especialista"],
        [
          "current",
          `negociação de horário${
            s.slot_proposto
              ? `: ${quem ?? "o especialista"} propôs ${rotuloSlot(s.slot_proposto)}`
              : ""
          } · a resposta é dos dois`,
        ],
        ["open", "5 sessões em ~3 meses"],
      ];
      break;
    case "aceita":
      passos = [
        ["done", `pedido de ${formatDate(s.created_at)}`],
        ["done", "aceito no mural"],
        ["done", `${quem ?? "o especialista"} assumiu`],
        ["current", "a trilha está nascendo · aparece aqui quando abrir"],
      ];
      break;
    default: // "aberta" e qualquer estado novo que o banco aprender
      passos = [
        ["done", `pedido de ${formatDate(s.created_at)}`],
        [
          "current",
          diasNoMural <= 0
            ? "no mural desde hoje · nenhum especialista aceitou ainda"
            : `no mural há ${diasNoMural} ${
                diasNoMural === 1 ? "dia" : "dias"
              } · nenhum especialista aceitou ainda`,
        ],
        ["open", "um especialista aceita e a trilha começa"],
        ["open", "5 sessões em ~3 meses"],
      ];
  }

  return (
    <section
      aria-label="Pedido de especialista em andamento"
      className="space-y-3 rounded-lg border border-dashed border-[var(--warn)]/50 bg-[var(--warn)]/8 p-4"
    >
      <header className="flex items-start gap-2.5">
        <Eye
          size={18}
          aria-hidden
          className="mt-0.5 shrink-0 text-[var(--warn-text)]"
        />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">Você acompanha, não participa</p>
          <p className="text-xs text-muted-foreground">
            {primeiroNome} ainda <b>não tem trilha</b>
            {tema && (
              <>
                {" · "}
                <span className="italic">{tema}</span>
              </>
            )}
          </p>
        </div>
        <SolicitacaoStatusChip solicitacao={s} />
      </header>

      <ol className="space-y-1">
        {passos.map(([estado, legenda], i) => (
          <li key={i} className="flex items-start gap-2.5 rounded-md px-2 py-1.5">
            <span
              aria-hidden
              className={cn(
                "mt-0.5 grid size-6 shrink-0 place-items-center rounded-full text-xs font-semibold",
                estado === "done" &&
                  "bg-[var(--ok)]/15 text-[var(--ok-text)]",
                estado === "current" &&
                  "border-2 border-[var(--warn)] text-[var(--warn-text)]",
                estado === "open" &&
                  "border border-dashed border-border text-muted-foreground"
              )}
            >
              {estado === "done" ? (
                <Check size={13} weight="bold" />
              ) : (
                i + 1
              )}
            </span>
            <div className="min-w-0">
              <p
                className={cn(
                  "text-sm",
                  estado === "open"
                    ? "text-muted-foreground"
                    : "font-medium"
                )}
              >
                {PASSOS_PEDIDO[i]}
              </p>
              <p className="text-xs text-muted-foreground">{legenda}</p>
            </div>
          </li>
        ))}
      </ol>
      <p className="px-2 text-xs leading-relaxed text-muted-foreground">
        Horários nascem dentro da trilha, na agenda do especialista. O
        mentor acompanha daqui.
      </p>
    </section>
  );
}

/** Sem trilha e sem pedido em voo — a única ação do mentor aqui é sugerir;
 *  a sugestão passa pelo jovem antes de virar pedido (origem 'mentor'). */
function SemTrilhaBlock({
  dupla,
  especialistas,
  primeiroNome,
  tinhaHistorico,
}: {
  dupla: Dupla;
  especialistas: { id: string; nome: string; areas: string[] | null }[];
  primeiroNome: string;
  tinhaHistorico: boolean;
}) {
  return (
    <section
      aria-label="Trilha de especialista"
      className="flex flex-wrap items-center gap-3 rounded-lg border border-dashed border-border px-4 py-3"
    >
      <Sparkle
        size={18}
        aria-hidden
        className="shrink-0 text-muted-foreground"
      />
      <p className="min-w-0 flex-1 text-sm text-muted-foreground">
        {tinhaHistorico
          ? `Nenhuma trilha de especialista ativa. As anteriores ficam no histórico abaixo.`
          : `${primeiroNome} ainda não tem trilha de especialista.`}
        {" Se fizer sentido pro PDM, você pode sugerir. "}
        {primeiroNome} confirma antes de virar pedido.
      </p>
      <SugerirEspecialistaDialog
        mentoradoId={dupla.mentorado.id}
        duplaDppId={dupla.id}
        especialistas={especialistas}
        nomeJovem={dupla.mentorado.nome_social || dupla.mentorado.nome}
        trigger={
          <Button variant="outline" size="sm">
            <Sparkle size={16} />
            Sugerir especialista
          </Button>
        }
      />
    </section>
  );
}

// ---------- "Do programa" ----------

/** O que a equipe faz COM o mentor — supervisões recebidas ("por Paula
 *  Nunes") e as formações do calendário oficial das turmas dele. Vai no
 *  fim: é contexto, não ação do dia. Sem itens a seção some (estado vazio
 *  aqui é só ausência, não defeito). */
function DoPrograma({
  supervisoes,
  eventos,
  duplas,
  meuId,
  hoje,
}: {
  supervisoes: Supervisao[];
  eventos: CicloEvento[];
  duplas: Dupla[];
  meuId: string;
  hoje: string;
}) {
  const recebidas = supervisoes
    .filter((s) => s.mentor_id === meuId)
    .slice(0, 3);
  const cronosDasDuplas = new Set(
    duplas.map((d) => d.cronograma_id).filter(Boolean)
  );
  const formacoes = eventos
    .filter(
      (e) =>
        e.tipo === "formacao" &&
        e.data != null &&
        e.data >= hoje &&
        e.cronograma_id != null &&
        cronosDasDuplas.has(e.cronograma_id)
    )
    .sort((a, b) => a.data!.localeCompare(b.data!))
    .slice(0, 3);

  const itens = [
    ...recebidas.map((s) => ({
      key: `sup-${s.id}`,
      data: s.data,
      titulo: `Supervisão com ${s.supervisor?.nome ?? "auxiliar executivo"}`,
      detalhe: s.dupla?.mentorado?.nome
        ? `sobre a dupla com ${s.dupla.mentorado.nome}`
        : "sessão geral",
    })),
    ...formacoes.map((e) => ({
      key: `for-${e.id}`,
      data: e.data!,
      titulo: "Formação de mentores",
      detalhe: [e.titulo, e.observacao].filter(Boolean).join(" · "),
    })),
    // cronológico desc — supervisão (já aconteceu) e formação (vai acontecer)
    // na mesma linha do tempo; concatenar deixava a mais recente embaixo
  ].sort((a, b) => b.data.localeCompare(a.data));
  if (itens.length === 0) return null;

  return (
    <section aria-label="Do programa" className="space-y-2">
      <h2 className="text-base font-semibold">Do programa</h2>
      <ul className="divide-y divide-border/60 overflow-hidden rounded-xl border bg-card">
        {itens.map((it) => (
          <li key={it.key} className="flex flex-wrap items-center gap-3 px-4 py-3">
            <div className="w-12 shrink-0 text-center">
              <b className="block text-lg font-bold leading-none tabular-nums">
                {Number(it.data.slice(8, 10))}
              </b>
              <i className="text-xs font-medium not-italic text-muted-foreground">
                {dowCurto(it.data)}
              </i>
            </div>
            <div className="min-w-0 flex-1 basis-52">
              <p className="text-sm font-semibold leading-snug">{it.titulo}</p>
              {it.detalhe && (
                <p className="mt-0.5 text-xs leading-snug text-muted-foreground">
                  {it.detalhe}
                </p>
              )}
            </div>
            <Tag tom={it.data === hoje ? "warn" : "muted"}>
              {it.data === hoje ? "hoje" : formatDiaMes(it.data)}
            </Tag>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Pedidos encerrados (recusado/expirado/cancelado) — histórico, não
 *  progresso: uma linha quieta que responde "o que houve da última vez". */
function PedidosAnterioresLine({
  solicitacoes,
}: {
  solicitacoes: SolicitacaoEspecialista[];
}) {
  const visiveis = solicitacoes.slice(0, 2);
  return (
    <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
      Pedido{solicitacoes.length > 1 ? "s" : ""} anterior
      {solicitacoes.length > 1 ? "es" : ""}:
      {visiveis.map((s) => (
        <span key={s.id} className="inline-flex items-center gap-1.5">
          <SolicitacaoStatusChip solicitacao={s} />
          {(s.status_efetivo ?? s.status) === "cancelada" && (
            <Badge variant="outline" className="text-muted-foreground">
              Pedido cancelado
            </Badge>
          )}
          <span>{formatDate(s.created_at)}</span>
        </span>
      ))}
      {solicitacoes.length > 2 && `+${solicitacoes.length - 2} mais antigos`}
    </p>
  );
}
