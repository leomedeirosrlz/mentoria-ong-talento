import type { CSSProperties, ReactNode } from "react";
import Link from "next/link";
import { ArrowCounterClockwise, ArrowRight, CaretDown } from "@phosphor-icons/react/dist/ssr";
import {
  cronogramaVigente,
  eventoDaSemana,
  eventosDoCronograma,
  resumoSemanaDe,
  rotuloCronograma,
  saudadeDaDupla,
  semanaBounds,
  textoResumoSemana,
  totalDaTrilha,
  TRILHA_LABEL,
  type DuplaSaude,
} from "@/lib/ciclo";
import { paraAcompanhar, saudeDoRecorte } from "@/lib/agenda-coordenacao";
import { painelTrilhasCoord, type AlertaPedido } from "@/lib/trilhas-coord";
import { lembreteDaDupla } from "@/components/agenda-partes";
import { turmaCurta, turmaLonga } from "@/lib/turma";
import { cn } from "@/lib/utils";
import type { CicloEvento, Comunicado, Cronograma, Dupla, SolicitacaoEspecialista, Supervisao } from "@/lib/types";
import type { Interacao } from "@/lib/interacoes";
import type { SupervisaoAlvo } from "@/lib/queries-supervisao";
import { AvisosSection } from "@/components/avisos-section";
import { CopiarResumoButton } from "@/components/copiar-resumo-button";
import {
  DuplaLinha,
  type PessoaLinha,
  type ProgressoDupla,
  type TomSituacao,
} from "@/components/dupla-linha";
import { LembreteButton } from "@/components/lembrete-button";
import { SaudePrograma } from "@/components/saude-programa";
import { SetupChecklist } from "@/components/setup-checklist";
import { SolicitacoesCoordCard } from "@/components/solicitacoes-coord-card";
import { SupervisaoDialog } from "@/components/supervisao-dialog";
import { SupervisoesSection } from "@/components/supervisoes-section";
import { TrilhasCoordPanel } from "@/components/trilhas-coord-panel";
import { BarraSegmentada } from "@/components/viz";
import { Card, CardContent } from "@/components/ui/card";

/** Limite do pedido de especialista parado — o mesmo do painel de trilhas
 *  (TrilhasCoordPanel). Acima disso, o pedido entra em "Precisa de você hoje". */
const LIMITE_PEDIDO_DIAS = 5;

/** Quem pediu apoio, na linguagem da linha (pill "Apoio pedido"). */
const ORIGEM_APOIO: Record<string, string> = {
  mentor: "pedido do mentor",
  mentorado: "pedido do jovem",
  ambos: "pedido do mentor e do jovem",
};

/** Uma linha da fila de exceções já resolvida: o que a DuplaLinha desenha. */
type LinhaDupla = {
  mentor: PessoaLinha;
  mentorado: PessoaLinha;
  situacao: { rotulo: string; tom: TomSituacao };
  apoio: { detalhe: string } | null;
  meta: string | null;
  motivo: string | null;
  progresso: ProgressoDupla;
  acao: ReactNode;
};

/** A fila "Precisa de você hoje": dupla (linha canônica) ou pedido de
 *  especialista parado (linha própria, sem dupla ainda). `rank` é a urgência
 *  — menor sobe. */
type Excecao =
  | {
      tipo: "dupla";
      chave: string;
      rank: number;
      ordem: number;
      duplaId: string;
      fichaNome: string;
      linha: LinhaDupla;
    }
  | { tipo: "pedido"; chave: string; rank: number; alerta: AlertaPedido };

export function DashboardCoordenacao({
  duplas,
  eventos,
  cronogramas = [],
  agora,
  interacoes,
  pessoas = 0,
  supervisor = false,
  avisos = [],
  solicitacoes = [],
  turmas = [],
  supervisaoItens = [],
  supervisaoAlvos = [],
  encerramentos = new Set<string>(),
  meuNome,
  termo,
}: {
  duplas: Dupla[];
  eventos: CicloEvento[];
  /** Cronogramas (0061) — a faixa "Semana do Nº" ancora no vigente; sem eles
   *  o painel cairia na união de calendários e misturaria turmas. */
  cronogramas?: Cronograma[];
  /** ISO timestamp vindo do server — o mesmo instante pra toda a página. */
  agora: string;
  /** Último contato registrado por dupla (nudge) — alimenta o cap do lembrete. */
  interacoes: Record<string, Interacao>;
  /** profiles + mentorados — primeiro passo do checklist de setup (só coordenação passa). */
  pessoas?: number;
  supervisor?: boolean;
  /** Primeiro nome de quem está logado — assina os lembretes. */
  meuNome?: string;
  /** avisos da coordenação já filtrados por audiência (RLS). */
  avisos?: Comunicado[];
  /** pedidos de especialista visíveis ao papel — só a coordenação monitora. */
  solicitacoes?: SolicitacaoEspecialista[];
  /** labels de turma pra triagem dos pedidos do jovem sem dupla DPP. */
  turmas?: string[];
  /** sessões de supervisão recentes + mentores elegíveis — só a home do supervisor. */
  supervisaoItens?: Supervisao[];
  supervisaoAlvos?: SupervisaoAlvo[];
  /** dupla_ids com rito de encerramento aberto (concluídas sem decisão). */
  encerramentos?: ReadonlySet<string>;
  /** faixa do termo de adesão pendente — entra depois do primeiro bloco de trabalho. */
  termo?: ReactNode;
}) {
  const hoje = new Date(agora);
  // um resumo por cronograma ATIVO que tem encontro — com duas turmas, uma
  // faixa só misturaria os dois calendários nos dois sentidos (spec F1).
  const ativos = cronogramas.filter((c) => c.status === "ativo");
  const alvosResumo: (Cronograma | null)[] = ativos.length
    ? ativos
    : cronogramas.length
      ? [cronogramaVigente(cronogramas, hoje)]
      : [null];
  const resumos = alvosResumo.flatMap((c) => {
    const evento = eventoDaSemana(
      c ? eventosDoCronograma(eventos, c.id) : eventos,
      hoje
    );
    if (!evento) return [];
    const resumo = resumoSemanaDe(duplas, evento, semanaBounds(hoje));
    return resumo ? [{ cronograma: c, resumo }] : [];
  });
  const multiplos = resumos.length > 1;

  // a mesma contagem de /duplas e da agenda: nenhum número é contado aqui
  const situacao = saudeDoRecorte(duplas, eventos, hoje);

  // o pedido parado é o mesmo cálculo do painel de trilhas (lib)
  const alertas =
    !supervisor && solicitacoes.length
      ? painelTrilhasCoord({
          duplas,
          solicitacoes,
          hoje,
          limiteDiasAlerta: LIMITE_PEDIDO_DIAS,
        })
      : null;

  const precisa = montarPrecisa({
    duplas,
    eventos,
    hoje,
    interacoes,
    encerramentos,
    alertas: alertas?.alertas ?? [],
    meuNome,
  });

  const emRisco = duplas
    .map((d) => ({ dupla: d, saude: saudadeDaDupla(d, eventos, hoje) }))
    .filter(({ dupla, saude }) => dupla.status === "ativa" && saude.semaforo === "risco")
    .map(
      ({ dupla, saude }) =>
        `${primeiroNome(dupla.mentor.nome)} & ${primeiroNome(dupla.mentorado.nome)} (${motivoCurto(saude)})`
    );

  const pedidosAbertos = solicitacoes.filter((s) =>
    ["aberta", "contra_proposta", "aguardando_coord"].includes(s.status_efetivo ?? s.status)
  ).length;

  return (
    <div className="space-y-6">
      {/* saudação, igual à home do mentor */}
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">
          {meuNome ? `Olá, ${meuNome}` : "Visão geral"}
        </h1>
      </header>

      {!supervisor && (
        <SetupChecklist
          pessoas={pessoas}
          duplas={duplas.length}
          encontros={duplas.reduce((n, d) => n + d.encontros.length, 0)}
          registros={duplas.reduce((n, d) => n + d.encontros.filter((e) => e.registro).length, 0)}
        />
      )}

      {/* situação das duplas: a régua do programa, a mesma de /duplas */}
      <div className="animate-enter rounded-xl bg-card px-4 py-4 shadow-[var(--shadow-border)] sm:px-5">
        <SaudePrograma saude={situacao} />
      </div>

      <div
        className={cn(
          "grid gap-6",
          "lg:grid-cols-[minmax(0,1fr)_minmax(300px,340px)] lg:items-start lg:gap-8"
        )}
      >
        <div className="min-w-0 space-y-6">
          {duplas.length === 0 ? (
            <Card>
              <CardContent className="py-10 text-center">
                <span aria-hidden className="mx-auto inline-flex">
                  <span className="size-8 rounded-full bg-[var(--brand-lime)] ring-2 ring-card" />
                  <span className="-ml-2.5 size-8 rounded-full bg-[var(--role-mentorado)] ring-2 ring-card" />
                </span>
                <p className="mt-3 font-medium text-foreground">
                  {supervisor
                    ? "Nenhuma dupla atribuída a você ainda."
                    : "Nenhuma dupla ativa ainda."}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {supervisor ? (
                    "Quando a coordenação atribuir duplas, elas aparecem aqui."
                  ) : (
                    <>
                      <Link href="/pessoas" className="underline underline-offset-2">
                        Cadastre pessoas
                      </Link>{" "}
                      e{" "}
                      <Link href="/duplas" className="underline underline-offset-2">
                        monte as duplas
                      </Link>{" "}
                      do programa.
                    </>
                  )}
                </p>
              </CardContent>
            </Card>
          ) : (
            <section aria-labelledby="precisa-titulo" className="@container space-y-3">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                <h2 id="precisa-titulo" className="text-base font-semibold">
                  Precisa de você hoje
                </h2>
                {precisa.length > 0 && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    {precisa.length > 5 && (
                      <span className="tabular-nums">{precisa.length} no total</span>
                    )}
                    <Link
                      href="/duplas"
                      className="group inline-flex min-h-11 items-center gap-1 rounded-md px-1.5 font-medium text-foreground underline underline-offset-2 md:min-h-8"
                    >
                      Ver todas
                      <ArrowRight
                        size={13}
                        aria-hidden
                        className="transition-transform group-hover:translate-x-0.5"
                      />
                    </Link>
                  </div>
                )}
              </div>

              {precisa.length === 0 ? (
                <p className="rounded-xl border border-[var(--destaque-borda)] bg-[var(--destaque-suave)] px-4 py-3 text-sm text-foreground">
                  Nenhuma dupla precisa de você hoje.
                </p>
              ) : (
                <ul className="space-y-2 @4xl:space-y-0 @4xl:divide-y @4xl:divide-border/60 @4xl:overflow-hidden @4xl:rounded-xl @4xl:bg-card @4xl:shadow-[var(--shadow-border)]">
                  {precisa.slice(0, 5).map((e, i) => (
                    <li key={e.chave}>
                      {e.tipo === "dupla" ? (
                        <DuplaLinha
                          {...e.linha}
                          fichaHref={`/duplas/${e.duplaId}`}
                          fichaNome={e.fichaNome}
                          i={i}
                        />
                      ) : (
                        <PedidoParadoLinha alerta={e.alerta} i={i} />
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}

          {termo}

          {/* esta semana: uma linha por turma — o fechamento do encontro com
              a barra fina. "registraram" conta quem entregou o registro */}
          <section aria-labelledby="semana-titulo" className="space-y-3">
            <h2 id="semana-titulo" className="text-base font-semibold">
              Esta semana
            </h2>
            {resumos.length === 0 ? (
              <p className="rounded-xl bg-card px-4 py-3 text-sm text-muted-foreground shadow-[var(--shadow-border)]">
                Nenhum encontro previsto para esta semana.
              </p>
            ) : (
              <ul className="space-y-3">
                {resumos.map(({ cronograma, resumo }, i) => {
                  // "sem encontro" desconta quem repôs outro encontro na mesma semana
                  const semEncontro = resumo.naoAconteceram - resumo.reposicao;
                  const rotuloTurma = cronograma ? turmaLonga(cronograma.turma) : "Programa";
                  return (
                    <li
                      key={cronograma?.id ?? "todos"}
                      style={{ "--i": Math.min(i, 10) } as CSSProperties}
                      className="animate-enter rounded-xl bg-card px-4 py-3 shadow-[var(--shadow-border)] sm:px-5"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
                        <p className="min-w-0 text-sm">
                          <span className="font-semibold">{rotuloTurma}</span>
                          <span className="text-muted-foreground">
                            {" "}· encontro {resumo.evento.numero} ·{" "}
                          </span>
                          <span className="font-semibold tabular-nums">
                            {resumo.comRegistro} de {resumo.total}
                          </span>{" "}
                          <span className="text-muted-foreground">registraram</span>
                        </p>
                        <div className="flex items-center gap-1">
                          <Link
                            href={`/registros?encontro=${resumo.evento.numero}`}
                            className="group inline-flex min-h-11 items-center gap-1 rounded-md px-1.5 text-xs font-medium underline underline-offset-2 transition-colors hover:text-foreground md:min-h-8"
                          >
                            Ver registros
                            <ArrowRight
                              size={13}
                              aria-hidden
                              className="transition-transform group-hover:translate-x-0.5"
                            />
                          </Link>
                          <span className="[&_button]:min-h-11 sm:[&_button]:min-h-8">
                            <CopiarResumoButton
                              texto={textoResumoSemana(
                                resumo,
                                emRisco,
                                multiplos && cronograma ? rotuloCronograma(cronograma) : undefined
                              )}
                            />
                          </span>
                        </div>
                      </div>
                      <BarraSegmentada
                        altura="sm"
                        segmentos={[
                          { valor: resumo.comRegistro, rotulo: "com registro", cls: "bg-[var(--ok)]" },
                          { valor: resumo.aguardandoRegistro, rotulo: "aguardando registro", cls: "bg-[var(--warn)]" },
                          { valor: resumo.reposicao, rotulo: "em reposição", cls: "bg-[var(--brand-lime)]" },
                          { valor: semEncontro, rotulo: "sem encontro", cls: "bg-muted-foreground/40" },
                        ]}
                        denominador={resumo.total}
                        ariaLabel={`${resumo.comRegistro} com registro, ${resumo.aguardandoRegistro} aguardando registro, ${resumo.reposicao} em reposição, ${semEncontro} sem encontro`}
                        className="mt-2.5"
                      />
                      {resumo.reposicao > 0 && (
                        <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
                          <ArrowCounterClockwise size={12} aria-hidden />
                          {resumo.reposicao} em reposição:{" "}
                          {resumo.reposicao === 1
                            ? "encontro de outra semana feito nesta."
                            : "encontros de outras semanas feitos nesta."}
                        </p>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>

        <aside className="min-w-0 space-y-2">
          <AvisosSection avisos={avisos} souCoord={!supervisor} />

          {/* pedidos de especialista e trilhas: só a coordenação monitora.
              Recolhidos com contador; o pedido parado aponta pra cá */}
          {!supervisor && (
            <Recolhido id="pedidos-especialista" titulo="Pedidos de especialista" contagem={pedidosAbertos}>
              <SolicitacoesCoordCard solicitacoes={solicitacoes} turmas={turmas} />
            </Recolhido>
          )}
          {!supervisor && (
            <Recolhido id="trilhas-especialista" titulo="Trilhas de especialista" contagem={alertas?.kpis.trilhasAtivas ?? 0}>
              <TrilhasCoordPanel duplas={duplas} solicitacoes={solicitacoes} hoje={hoje} />
            </Recolhido>
          )}

          {/* ritual supervisor ↔ mentor do guia (0041): registrar a conversa e
              reler as últimas. Sem dupla supervisionada nem sessão no histórico,
              o bloco some */}
          {supervisor && (supervisaoItens.length > 0 || supervisaoAlvos.length > 0) && (
            <Recolhido id="supervisoes" titulo="Supervisões" contagem={supervisaoItens.length}>
              <SupervisoesSection
                itens={supervisaoItens}
                visao="supervisor"
                descricao="As conversas de supervisão com seus mentores: o ritual de acompanhamento do guia."
                acao={
                  supervisaoAlvos.length > 0 ? (
                    <SupervisaoDialog alvos={supervisaoAlvos} />
                  ) : undefined
                }
              />
            </Recolhido>
          )}
        </aside>
      </div>
    </div>
  );
}

/** Bloco recolhido da home: título com contador, seta no toque. Sem superfície
 *  própria, pra não virar card dentro de card — o conteúdo traz o seu. */
function Recolhido({
  id,
  titulo,
  contagem,
  children,
}: {
  id: string;
  titulo: string;
  contagem: number;
  children: ReactNode;
}) {
  return (
    <details id={id} className="group scroll-mt-20">
      <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-lg py-2 pr-1 outline-none focus-visible:ring-3 focus-visible:ring-ring/50 [&::-webkit-details-marker]:hidden">
        <h2 className="text-base font-semibold">
          {titulo}{" "}
          <span className="text-sm font-normal tabular-nums text-muted-foreground">({contagem})</span>
        </h2>
        <CaretDown
          size={14}
          aria-hidden
          className="ms-auto shrink-0 text-muted-foreground transition-transform duration-200 group-open:rotate-180"
        />
      </summary>
      <div className="mt-2">{children}</div>
    </details>
  );
}

/** Pedido de especialista parado — linha própria (não é dupla ainda). A ação
 *  leva ao bloco de pedidos da própria home, que abre pelo fragmento. */
function PedidoParadoLinha({ alerta, i }: { alerta: AlertaPedido; i: number }) {
  const onde =
    alerta.onde === "triagem"
      ? "em triagem"
      : alerta.onde === "expirada"
        ? "com horário expirado"
        : "no mural";
  return (
    <div
      style={{ "--i": Math.min(i, 10) } as CSSProperties}
      className="animate-enter flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-border bg-card p-3 @4xl:rounded-none @4xl:border-0 @4xl:bg-transparent @4xl:px-5 @4xl:py-3"
    >
      <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-[var(--warn-border)] bg-[var(--warn-bg)] px-2.5 py-1 text-[11px] font-semibold leading-none text-[var(--warn-text)]">
        Pedido parado
      </span>
      <div className="min-w-0 basis-full @4xl:basis-auto @4xl:flex-1">
        <p className="text-sm font-semibold leading-snug">
          {alerta.jovemNome}
          {alerta.turma ? ` · ${turmaCurta(alerta.turma)}` : ""}
        </p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {alerta.demanda ? corta(alerta.demanda) : "Sem demanda descrita"} · {alerta.diasParado}{" "}
          {alerta.diasParado === 1 ? "dia" : "dias"} {onde} (limite de {LIMITE_PEDIDO_DIAS} dias)
        </p>
      </div>
      <Link
        href="#pedidos-especialista"
        className="ml-auto inline-flex min-h-11 items-center rounded-lg px-2 text-sm font-medium underline underline-offset-2 md:min-h-8"
      >
        Ver pedido
      </Link>
    </div>
  );
}

/** A fila "Precisa de você hoje": junta as exceções de todas as fontes numa
 *  lista só, na ordem de urgência. Regra de dupla é a da fila de acompanhamento
 *  (`paraAcompanhar`); o pedido parado é o `painelTrilhasCoord`. Nada disso é
 *  recalculado aqui — a tela só escolhe a ação de cada linha.
 *
 *  Urgência (menor sobe):
 *    0 apoio aberto (do jovem ou do mentor)
 *    1 em risco com ação pendente
 *    2 pedido de especialista parado há mais do limite
 *    3 em atenção com ação pendente
 *    4 rito de encerramento para concluir na ficha */
function montarPrecisa({
  duplas,
  eventos,
  hoje,
  interacoes,
  encerramentos,
  alertas,
  meuNome,
}: {
  duplas: Dupla[];
  eventos: CicloEvento[];
  hoje: Date;
  interacoes: Record<string, Interacao>;
  encerramentos: ReadonlySet<string>;
  alertas: AlertaPedido[];
  meuNome?: string;
}): Excecao[] {
  const acompanhar = paraAcompanhar(duplas, eventos, interacoes, hoje, encerramentos);
  const itemPorDupla = new Map(acompanhar.map((it) => [it.duplaId, it]));
  const ordemFila = new Map(acompanhar.map((it, n) => [it.duplaId, n]));
  const out: Excecao[] = [];

  for (const d of duplas) {
    const saude: DuplaSaude = saudadeDaDupla(d, eventos, hoje);
    const item = itemPorDupla.get(d.id);
    const pedeApoio = saude.apoio.aberto;
    const encerra = item?.motivos.includes("encerramento") ?? false;
    const pedeAcao = item != null && saude.semaforo !== "ok";
    if (!pedeApoio && !encerra && !pedeAcao) continue;

    const rank = pedeApoio ? 0 : encerra ? 4 : saude.semaforo === "risco" ? 1 : 3;
    const total = totalDaTrilha(d.trilha, eventosDoCronograma(eventos, d.cronograma_id));
    const realizados = d.encontros.filter((e) => e.status === "realizado").map((e) => e.numero);
    const progresso: ProgressoDupla = {
      total,
      realizados,
      esperado: d.status === "ativa" && !encerra ? saude.esperado : null,
      legenda: encerra
        ? "jornada fechada"
        : d.status === "pausada"
          ? "em pausa"
          : `esperado ${saude.esperado}`,
    };

    const acao: ReactNode = pedeApoio ? (
      <Link href="/chamados" className={BOTAO_ACAO}>
        Abrir apoio
      </Link>
    ) : encerra ? (
      <Link href={`/duplas/${d.id}`} className={BOTAO_ACAO}>
        Concluir rito
      </Link>
    ) : item ? (
      // a mesma régua de lembrete da fila: o caso decisório é registro >
      // limbo > atraso > sem data, e o cap de 48h vem do server. O wrapper
      // leva o alvo a 44px no celular sem mexer no botão compartilhado
      <div className="[&_button]:min-h-11 md:[&_button]:min-h-8">
        <LembreteButton
          duplaId={d.id}
          destino="mentor"
          rotulo={item.rotuloLembrete}
          telefone={d.mentor?.whatsapp ?? null}
          {...lembreteDoItem(d, item, eventos, meuNome, hoje)}
          href={`/duplas/${d.id}`}
          bloqueadoAte={item.bloqueadoAte}
        />
      </div>
    ) : null;

    const meta = [
      turmaLonga(d.turma),
      d.trilha === "especialista" ? TRILHA_LABEL[d.trilha] : null,
      item?.bloqueadoAte ? "lembrete enviado, aguardando a dupla" : null,
    ]
      .filter(Boolean)
      .join(" · ");

    out.push({
      tipo: "dupla",
      chave: `d-${d.id}`,
      rank,
      ordem: ordemFila.get(d.id) ?? Number.MAX_SAFE_INTEGER,
      duplaId: d.id,
      fichaNome: primeiroNome(d.mentorado.nome),
      linha: {
        mentor: pessoaLinha(d.mentor),
        mentorado: pessoaLinha(d.mentorado),
        situacao: situacaoDaDupla(d, saude),
        apoio: pedeApoio ? { detalhe: ORIGEM_APOIO[saude.apoio.origem ?? "mentor"] } : null,
        meta: meta || null,
        motivo: item ? item.contextoPartes.join(" · ") : saude.motivo,
        progresso,
        acao,
      },
    });
  }

  for (const a of alertas) {
    out.push({ tipo: "pedido", chave: `p-${a.solicitacaoId}`, rank: 2, alerta: a });
  }

  return out.sort((a, b) => {
    if (a.rank !== b.rank) return a.rank - b.rank;
    if (a.tipo === "pedido" && b.tipo === "pedido") return b.alerta.diasParado - a.alerta.diasParado;
    if (a.tipo === "dupla" && b.tipo === "dupla") return a.ordem - b.ordem;
    return 0;
  });
}

/** Texto do lembrete da linha — o mesmo caso decisório da agenda. */
function lembreteDoItem(
  d: Dupla,
  item: ItemFila,
  eventos: CicloEvento[],
  meuNome: string | undefined,
  hoje: Date
): { titulo: string; corpo: string } {
  const caso = item.motivos.includes("registro_pendente")
    ? "registro_pendente"
    : item.motivos.includes("limbo")
      ? "limbo"
      : item.motivos.includes("atraso")
        ? "atraso"
        : "sem_data";
  return lembreteDaDupla(d, caso, eventos, meuNome, hoje);
}

type ItemFila = ReturnType<typeof paraAcompanhar>[number];

function situacaoDaDupla(d: Dupla, saude: DuplaSaude): { rotulo: string; tom: TomSituacao } {
  if (d.status === "concluida" || d.status === "encerrada") return { rotulo: "Concluída", tom: "pausa" };
  if (d.status === "pausada") return { rotulo: "Pausada", tom: "pausa" };
  if (saude.semaforo === "risco") return { rotulo: "Em risco", tom: "risco" };
  if (saude.semaforo === "atencao") return { rotulo: "Atenção", tom: "atencao" };
  return { rotulo: "Em dia", tom: "neutro" };
}

function pessoaLinha(p: { id: string; nome: string; avatar_path?: string | null }): PessoaLinha {
  return { id: p.id, nome: p.nome, avatar_path: p.avatar_path ?? null };
}

const BOTAO_ACAO =
  "inline-flex min-h-11 items-center whitespace-nowrap rounded-lg border border-border bg-card px-3 text-sm font-medium transition-colors hover:bg-muted md:min-h-8 md:px-2.5 md:text-xs";

/** Versão curta do motivo — usada na linha "Em risco" do resumo copiável. */
function motivoCurto(s: DuplaSaude): string {
  const risco = s.sinais.find((x) => x.tom === "risco");
  if (!risco) return s.motivo;
  if (risco.tipo === "atraso") return `${s.esperado - s.feitos} atrasos`;
  return "avaliação baixa + dificuldade";
}

function corta(texto: string, max = 110): string {
  return texto.length > max ? `${texto.slice(0, max).trimEnd()}…` : texto;
}

function primeiroNome(nome: string) {
  return nome.split(" ")[0];
}

