import { Fragment, type CSSProperties } from "react";
import Link from "next/link";
import { ArrowCounterClockwise, ArrowRight } from "@phosphor-icons/react/dist/ssr";
import {
  cronogramaVigente,
  eventoDaSemana,
  eventosDoCronograma,
  formatDiaMes,
  formatDiaSemana,
  formatDateTime,
  resumoSemanaDe,
  rotuloCronograma,
  saudadeDaDupla,
  semanaBounds,
  textoResumoSemana,
  totalDaTrilha,
  TRILHA_LABEL,
  ultimoRegistro,
  type DuplaSaude,
  type Semaforo,
  ORDEM_SEMAFORO,
} from "@/lib/ciclo";
import type { CicloEvento, Comunicado, Cronograma, Dupla, SolicitacaoEspecialista, Supervisao } from "@/lib/types";
import type { Interacao } from "@/lib/interacoes";
import type { SupervisaoAlvo } from "@/lib/queries-supervisao";
import { AvaliacaoBadge, SemaforoDot } from "@/components/semaforo";
import { DuplaAvatares } from "@/components/dupla-avatares";
import { SetupChecklist } from "@/components/setup-checklist";
import { NudgeButton } from "@/components/nudge-button";
import { CopiarResumoButton } from "@/components/copiar-resumo-button";
import { DuplaNomes } from "@/components/dupla-nomes";
import { AvisosSection } from "@/components/avisos-section";
import { SolicitacoesCoordCard } from "@/components/solicitacoes-coord-card";
import { SupervisaoDialog } from "@/components/supervisao-dialog";
import { SupervisoesSection } from "@/components/supervisoes-section";
import { WhatsAppRapido, type DestinoWA } from "@/components/whatsapp-rapido";
import { msgsContato } from "@/lib/whatsapp-msgs";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { filterChipCls } from "@/components/ui/filter-chip";
import { cn } from "@/lib/utils";



type LinhaSaude = { dupla: Dupla; saude: DuplaSaude };

/** Filtros dos chips do card-saúde — cada chip filtra a lista pra mostrar só
 *  as duplas que o número resume (resumo → itens). "Todas" é a visão cheia
 *  do radar; os demais alternam a lente (risco, atenção, registro pendente). */
const FILTROS = {
  risco: {
    rotulo: "em risco",
    teste: (s: LinhaSaude) => s.saude.semaforo === "risco",
  },
  atencao: {
    rotulo: "em atenção",
    teste: (s: LinhaSaude) => s.saude.semaforo === "atencao",
  },
  pendentes: {
    rotulo: "com registro pendente",
    teste: (s: LinhaSaude) => s.saude.registroPendente,
  },
} as const;

type FiltroPainel = keyof typeof FILTROS;

/** Rótulos dos grupos do radar — os headers que separam as faixas do semáforo
 *  quando a lista está sem filtro. Com filtro ativo a lista é homogênea e o
 *  "Mostrando só N…" do topo já cobre o contexto. */
const GRUPO_SEMAFORO: Record<Semaforo, string> = {
  risco: "Em risco",
  atencao: "Em atenção",
  ok: "Em dia",
};

export function DashboardCoordenacao({
  duplas,
  eventos,
  cronogramas = [],
  agora,
  origem,
  interacoes,
  pessoas = 0,
  supervisor = false,
  avisos = [],
  solicitacoes = [],
  filtro,
  supervisaoItens = [],
  supervisaoAlvos = [],
  meuNome,
}: {
  duplas: Dupla[];
  eventos: CicloEvento[];
  /** Cronogramas (0061) — a faixa "Semana do Nº" ancora no vigente; sem eles
   *  o painel cairia na união de calendários e misturaria turmas. */
  cronogramas?: Cronograma[];
  /** ISO timestamp vindo do server — o mesmo instante pra toda a página. */
  agora: string;
  /** origem pública do app (proto://host) — monta o link direto do nudge. */
  origem: string;
  /** Último contato registrado por dupla — "último nudge dd/mm por alguém". */
  interacoes: Record<string, Interacao>;
  /** profiles + mentorados — primeiro passo do checklist de setup (só coordenação passa). */
  pessoas?: number;
  supervisor?: boolean;
  /** Primeiro nome de quem está logado — assina a mensagem pro mentorado
   *  no WhatsApp rápido do card ("Aqui é Fulana, da equipe…"). */
  meuNome?: string;
  /** avisos da coordenação já filtrados por audiência (RLS). */
  avisos?: Comunicado[];
  /** demandas de especialista visíveis ao papel — só a coordenação monitora
   *  o mural; supervisor não pede nem gerencia especialista. */
  solicitacoes?: SolicitacaoEspecialista[];
  /** valor cru de ?filtro= — validado contra FILTROS; desconhecido = visão cheia. */
  filtro?: string;
  /** sessões de supervisão recentes + mentores elegíveis — só a home do
   *  supervisor passa (o ritual supervisor ↔ mentor do guia, 0041). */
  supervisaoItens?: Supervisao[];
  supervisaoAlvos?: SupervisaoAlvo[];
}) {
  const hoje = new Date(agora);
  // um resumo por cronograma ATIVO que tem encontro — com duas turmas, uma
  // faixa só misturaria os dois calendários nos dois sentidos (spec F1).
  // Sem ativo cai no vigente (encerrado mais recente); sem cronograma
  // nenhum (base pré-0061) mede a lista inteira, como antes.
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

  const saude = duplas
    .map((d) => ({ dupla: d, saude: saudadeDaDupla(d, eventos, hoje) }))
    // pedido de apoio fura o congelamento da pausada/encerrada — não pode sumir do radar
    .filter(({ dupla, saude }) => dupla.status === "ativa" || saude.pediuApoio)
    .sort((a, b) => ORDEM_SEMAFORO[a.saude.semaforo] - ORDEM_SEMAFORO[b.saude.semaforo]);

  const filtroAtivo: FiltroPainel | null =
    filtro === "risco" || filtro === "atencao" || filtro === "pendentes"
      ? filtro
      : null;
  const visiveis = filtroAtivo ? saude.filter(FILTROS[filtroAtivo].teste) : saude;

  const ativas = saude.filter((s) => s.dupla.status === "ativa").length;
  const risco = saude.filter((s) => s.saude.semaforo === "risco").length;
  const atencao = saude.filter((s) => s.saude.semaforo === "atencao").length;
  const emDia = saude.filter((s) => s.saude.semaforo === "ok").length;
  const semRegistro = saude.filter((s) => s.saude.registroPendente).length;
  const pedidosApoio = saude.filter((s) => s.saude.pediuApoio).length;
  const emRisco = saude
    .filter((s) => s.saude.semaforo === "risco")
    .map(
      ({ dupla, saude }) =>
        `${primeiroNome(dupla.mentor.nome)} & ${primeiroNome(dupla.mentorado.nome)} (${motivoCurto(saude)})`
    );

  // rail vazio some junto com a coluna: pra coordenação o card de avisos
  // sempre existe (o convite de publicar), pro supervisor o rail só nasce
  // se houver aviso — sem o guard o template lg reservava ~340px de faixa
  // morta. O resumo não conta: é faixa larga acima do grid.
  const temRail = !supervisor || avisos.length > 0;

  return (
    <div className="space-y-8">
      {/* saudação, igual à home do mentor — o contexto da semana mora no
          card-resumo abaixo, não em linhas auxiliares do header */}
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

      {/* faixa larga acima do grid — uma por cronograma ativo, sempre
          empilhada. O fechamento da semana virou frase-fato + barra
          segmentada (a gramática do ResumoEncontrosDupla da agenda): cor →
          significado → número na legenda nomeada, sem dl de números crus */}
      {resumos.map(({ cronograma, resumo }) => {
        // "sem encontro" desconta quem repôs outro encontro na mesma semana
        // — ela se encontrou, só não o oficial (mesma conta do resumo antigo)
        const semEncontro = resumo.naoAconteceram - resumo.reposicao;
        return (
          <section
            key={cronograma?.id ?? "todos"}
            aria-label={`Semana do ${resumo.evento.numero}º encontro${cronograma ? ` — ${cronograma.turma}` : ""}`}
            className="animate-enter rounded-xl bg-card px-4 py-4 shadow-[var(--shadow-border)] sm:px-5"
          >
            {/* turma é contexto tipográfico (overline), não pill — e só faz
                falta quando há mais de um cronograma disputando o olhar;
                o valor é o mesmo do seletor "Turma" da agenda */}
            {multiplos && cronograma && (
              <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                {cronograma.turma}
              </p>
            )}
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1.5">
              <h2 className="text-base font-semibold tracking-tight sm:text-lg">
                Semana do {resumo.evento.numero}º encontro
              </h2>
              <div className="flex items-center gap-2">
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
                <CopiarResumoButton
                  texto={textoResumoSemana(
                    resumo,
                    emRisco,
                    multiplos && cronograma
                      ? rotuloCronograma(cronograma)
                      : undefined
                  )}
                />
              </div>
            </div>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {resumo.evento.titulo}
              {resumo.evento.fase ? ` · ${resumo.evento.fase}` : ""} ·{" "}
              {formatDiaSemana(resumo.evento.data)},{" "}
              {formatDiaMes(resumo.evento.data)}
            </p>
            <p className="mt-3 text-sm text-muted-foreground">
              <span className="font-medium text-foreground">
                {resumo.realizaram} de {resumo.total}
              </span>{" "}
              duplas realizaram
              {resumo.comRegistro > 0 &&
                ` · ${resumo.comRegistro} ${resumo.comRegistro === 1 ? "registro entregue" : "registros entregues"}`}
            </p>
            <div
              role="img"
              aria-label={`${resumo.comRegistro} com registro, ${resumo.aguardandoRegistro} aguardando registro, ${resumo.reposicao} em reposição, ${semEncontro} sem encontro`}
              className="mt-2 flex h-2.5 w-full overflow-hidden rounded-full bg-muted"
            >
              <Seg n={resumo.comRegistro} total={resumo.total} cls="bg-[var(--ok)]" />
              <Seg n={resumo.aguardandoRegistro} total={resumo.total} cls="bg-[var(--warn)]" />
              <Seg n={resumo.reposicao} total={resumo.total} cls="bg-[var(--brand-lime)]" />
              <Seg n={semEncontro} total={resumo.total} cls="bg-muted-foreground/40" />
            </div>
            {resumo.total > 0 && (
              <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                {resumo.comRegistro > 0 && (
                  <span className="inline-flex items-center gap-1">
                    <span aria-hidden className="size-2 rounded-full bg-[var(--ok)]" />
                    {resumo.comRegistro} com registro
                  </span>
                )}
                {resumo.aguardandoRegistro > 0 && (
                  <span className="inline-flex items-center gap-1">
                    <span aria-hidden className="size-2 rounded-full bg-[var(--warn)]" />
                    {resumo.aguardandoRegistro} aguardando registro
                  </span>
                )}
                {resumo.reposicao > 0 && (
                  <span className="inline-flex items-center gap-1">
                    <span aria-hidden className="size-2 rounded-full bg-[var(--brand-lime)]" />
                    {resumo.reposicao} em reposição
                  </span>
                )}
                {semEncontro > 0 && (
                  <span className="inline-flex items-center gap-1">
                    <span aria-hidden className="size-2 rounded-full bg-muted-foreground/40" />
                    {semEncontro} sem encontro
                  </span>
                )}
              </p>
            )}
            {resumo.reposicao > 0 && (
              // o significado de "em reposição" fica visível — tooltip/title
              // não existe no toque
              <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
                <ArrowCounterClockwise size={12} aria-hidden />
                {resumo.reposicao} em reposição —{" "}
                {resumo.reposicao === 1
                  ? "encontro de outra semana feito nesta."
                  : "encontros de outras semanas feitos nesta."}
              </p>
            )}
          </section>
        );
      })}

      {/* lg+: coluna principal de trabalho (banner → saúde → radar →
          supervisões) + rail lateral de contexto (avisos → solicitações).
          Nested columns: cada lado flui independente — nenhum gap quando o
          rail é mais alto que os primeiros blocos da main. No mobile a
          leitura é a ordem do DOM: avisos e solicitações voltam pra depois
          do radar (o radar é o driver diário; avisos pra coord são posts
          dela mesma). Rail abre em lg, mesma régua da agenda */}
      <div
        className={cn(
          "space-y-8",
          temRail &&
            "lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(300px,340px)] lg:items-start lg:gap-8 lg:space-y-0"
        )}
      >
        <div className="min-w-0 space-y-8">
          {pedidosApoio > 0 && (
            <div className="rounded-xl border border-[var(--danger)]/40 bg-[var(--danger)]/5 px-4 py-3 text-sm">
              <span className="font-medium">
                {pedidosApoio} {pedidosApoio === 1 ? "pedido" : "pedidos"} de apoio
              </span>
              <span className="text-muted-foreground">
                {pedidosApoio === 1
                  ? " sinalizado por um mentor no registro."
                  : " sinalizados por mentores nos registros."}
              </span>
            </div>
          )}

          {/* saúde das duplas — o headline + a proporção do semáforo numa
              barra segmentada + os filtros como chips (mesma idiom de
              filterChipCls): substitui os 4 stat-cards de peso idêntico */}
          <section
            aria-label="Saúde das duplas"
            className="animate-enter rounded-xl bg-card px-4 py-4 shadow-[var(--shadow-border)] sm:px-5"
          >
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <h2 className="text-base font-semibold tracking-tight">
                Duplas ativas
              </h2>
              <p className="font-mono text-3xl font-semibold leading-none tabular-nums">
                {ativas}
              </p>
            </div>
            <div
              role="img"
              aria-label={`${emDia} em dia, ${atencao} em atenção, ${risco} em risco`}
              className="mt-3 flex h-2.5 overflow-hidden rounded-full bg-muted"
            >
              <Seg n={emDia} total={saude.length} cls="bg-[var(--ok)]" />
              <Seg n={atencao} total={saude.length} cls="bg-[var(--warn)]" />
              <Seg n={risco} total={saude.length} cls="bg-[var(--danger)]" />
            </div>
            {saude.length > 0 && (
              <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                {emDia > 0 && (
                  <span className="inline-flex items-center gap-1">
                    <span aria-hidden className="size-2 rounded-full bg-[var(--ok)]" />
                    {emDia} em dia
                  </span>
                )}
                {atencao > 0 && (
                  <span className="inline-flex items-center gap-1">
                    <span aria-hidden className="size-2 rounded-full bg-[var(--warn)]" />
                    {atencao} em atenção
                  </span>
                )}
                {risco > 0 && (
                  <span className="inline-flex items-center gap-1">
                    <span aria-hidden className="size-2 rounded-full bg-[var(--danger)]" />
                    {risco} em risco
                  </span>
                )}
              </p>
            )}
            {/* chips são links de verdade — Cmd+click, back/forward e
                aria-current de graça; o dot interno fala a língua do
                semáforo (pendente é oco: "falta algo") */}
            <div
              role="group"
              aria-label="Filtrar lista de duplas"
              className="mt-3 flex flex-wrap gap-2"
            >
              <Link
                href="/"
                className={filterChipCls(!filtroAtivo)}
                aria-current={!filtroAtivo ? "page" : undefined}
              >
                Todas
              </Link>
              <Link
                href="/?filtro=risco"
                className={filterChipCls(filtroAtivo === "risco")}
                aria-current={filtroAtivo === "risco" ? "page" : undefined}
              >
                <span aria-hidden className="size-2 rounded-full bg-[var(--danger)]" />
                Em risco <span className="tabular-nums">{risco}</span>
              </Link>
              <Link
                href="/?filtro=atencao"
                className={filterChipCls(filtroAtivo === "atencao")}
                aria-current={filtroAtivo === "atencao" ? "page" : undefined}
              >
                <span aria-hidden className="size-2 rounded-full bg-[var(--warn)]" />
                Em atenção <span className="tabular-nums">{atencao}</span>
              </Link>
              <Link
                href="/?filtro=pendentes"
                className={filterChipCls(filtroAtivo === "pendentes")}
                aria-current={filtroAtivo === "pendentes" ? "page" : undefined}
              >
                <span aria-hidden className="size-2 rounded-full ring-1 ring-[var(--warn)]" />
                Registro pendente <span className="tabular-nums">{semRegistro}</span>
              </Link>
            </div>
          </section>

          {/* radar depois do pulso: resumo da semana e saúde vêm acima; a
              lista de duplas é o bloco de trabalho — avisos e solicitações
              ficam no rail */}
          <section className="space-y-3" aria-labelledby="duplas-radar-titulo">
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
              <h2
                id="duplas-radar-titulo"
                className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground"
              >
                {supervisor ? "Suas duplas" : "Duplas"}
              </h2>
              {filtroAtivo && saude.length > 0 && visiveis.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  Mostrando só{" "}
                  {visiveis.length === 1
                    ? "1 dupla"
                    : `${visiveis.length} duplas`}{" "}
                  {FILTROS[filtroAtivo].rotulo} ·{" "}
                  <Link
                    href="/"
                    className="font-medium text-foreground underline underline-offset-2"
                  >
                    Ver todas
                  </Link>
                </p>
              )}
            </div>

            {saude.length === 0 && (
              <Card>
                <CardContent className="py-10 text-center">
                  {/* glifo da marca no lugar do ícone genérico: os dois discos
                      sobrepostos da dupla (precedente DuplaAvatares) */}
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
            )}

            {saude.length > 0 && filtroAtivo && visiveis.length === 0 && (
              <Card>
                <CardContent className="py-10 text-center">
                  <span aria-hidden className="mx-auto inline-flex">
                    <span className="size-8 rounded-full bg-[var(--brand-lime)] ring-2 ring-card" />
                    <span className="-ml-2.5 size-8 rounded-full bg-[var(--role-mentorado)] ring-2 ring-card" />
                  </span>
                  <p className="mt-3 font-medium text-foreground">
                    Nenhuma dupla {FILTROS[filtroAtivo].rotulo}.
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    <Link href="/" className="underline underline-offset-2">
                      Ver todas as duplas
                    </Link>
                  </p>
                </CardContent>
              </Card>
            )}

            {/* entrada escalonada — o stagger revela a ordem risco→ok. Sem
                filtro, um overline de grupo marca a virada de faixa do
                semáforo (dot + nome + count); com filtro a lista é
                homogênea e o "Mostrando só N…" acima já cobre o contexto */}
            {visiveis.map(({ dupla, saude }, i) => {
              const anterior = i > 0 ? visiveis[i - 1].saude.semaforo : null;
              const novoGrupo = !filtroAtivo && saude.semaforo !== anterior;
              return (
                <Fragment key={dupla.id}>
                  {novoGrupo && (
                    <h3 className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                      <SemaforoDot nivel={saude.semaforo} />
                      {GRUPO_SEMAFORO[saude.semaforo]}{" "}
                      <span className="tabular-nums">
                        {saude.semaforo === "risco"
                          ? risco
                          : saude.semaforo === "atencao"
                            ? atencao
                            : emDia}
                      </span>
                    </h3>
                  )}
                  <DuplaCard
                    dupla={dupla}
                    saude={saude}
                    eventos={eventos}
                    origem={origem}
                    interacoes={interacoes}
                    hoje={hoje}
                    i={i}
                    meuNome={meuNome}
                  />
                </Fragment>
              );
            })}
          </section>

          {/* ritual supervisor ↔ mentor do guia (0041): registrar a conversa e
              reler as últimas. Sem dupla supervisionada nem sessão no histórico,
              o cartão some — a lista de duplas vazia já carrega a explicação */}
          {supervisor &&
            (supervisaoItens.length > 0 || supervisaoAlvos.length > 0) && (
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
            )}
        </div>

        {temRail && (
          // coluna lateral de contexto: animate-enter-x é a entrada pensada
          // pra rails (globals.css)
          <aside className="animate-enter-x min-w-0 space-y-8">
            <AvisosSection avisos={avisos} souCoord={!supervisor} />

            {/* mural de demandas entre mentores — a coordenação observa e
                gerencia; o fluxo em si é DPP → especialista, sem coordenação
                no caminho */}
            {!supervisor && <SolicitacoesCoordCard solicitacoes={solicitacoes} />}
          </aside>
        )}
      </div>
    </div>
  );
}

/** Versão curta do motivo — usada na linha "Em risco" do resumo copiável.
 *  Risco só vem de: pedido de apoio, ≥2 atrasos, avaliação baixa + dificuldade. */
function motivoCurto(s: DuplaSaude): string {
  if (s.pediuApoio) return "pediu apoio";
  const atraso = s.esperado - s.feitos;
  if (atraso >= 2) return `${atraso} atrasos`;
  return "avaliação baixa + dificuldade";
}

/** Segmento proporcional das barras-resumo (semana e saúde das duplas) —
 *  some quando zero (a legenda nomeada também omite zeros); denominador 0
 *  deixa a faixa só no track muted. Gramática do ResumoEncontrosDupla da
 *  agenda: width percentual, sem rótulo interno — o número mora na legenda. */
function Seg({ n, total, cls }: { n: number; total: number; cls: string }) {
  if (n <= 0 || total <= 0) return null;
  return <span className={cls} style={{ width: `${(n / total) * 100}%` }} />;
}

function DuplaCard({
  dupla,
  saude,
  eventos,
  origem,
  interacoes,
  hoje,
  i,
  meuNome,
}: {
  dupla: Dupla;
  saude: ReturnType<typeof saudadeDaDupla>;
  /** calendário global — o denominador sai do recorte do cronograma da dupla */
  eventos: CicloEvento[];
  origem: string;
  interacoes: Record<string, Interacao>;
  hoje: Date;
  /** posição na lista — alimenta o stagger do animate-enter (cap 10) */
  i: number;
  /** primeiro nome de quem envia — assina a msg pro mentorado */
  meuNome?: string;
}) {
  // denominador = nº de encontros do cronograma da dupla (duas turmas podem
  // ter totais diferentes); especialista e sem-vínculo caem no teto canônico
  const total = totalDaTrilha(
    dupla.trilha,
    eventosDoCronograma(eventos, dupla.cronograma_id)
  );
  const encontroAtual = dupla.encontros.filter((e) => e.status === "realizado").length;
  const ultimoReg = ultimoRegistro(dupla);
  // pendência de registro mais antiga — realizado sem registro ou agendado
  // já vencido (pode ter rolado): é pra ela que o link aponta
  const pendente = [...dupla.encontros]
    .sort((a, b) => a.numero - b.numero)
    .find(
      (e) =>
        !e.registro &&
        (e.status === "realizado" ||
          (e.status === "agendado" &&
            e.data_hora != null &&
            new Date(e.data_hora) < hoje))
    );
  const linkRegistro = pendente ? `${origem}/duplas/${dupla.id}#registrar-${pendente.id}` : null;
  const atraso = saude.esperado - saude.feitos;
  const caso = saude.pediuApoio
    ? "Vi seu pedido de apoio no registro. O que está rolando? Pode contar comigo."
    : pendente?.status === "agendado"
      ? `O ${pendente.numero}º encontro estava agendado e já passou. Rolou? Se rolou, o registro é por aqui: ${linkRegistro}`
      : saude.registroPendente
        ? `Vi que o último encontro rolou, mas ainda falta o registro. Consegue preencher hoje?${linkRegistro ? ` É direto por aqui: ${linkRegistro}` : ""}`
        : atraso > 0
          ? "Os encontros estão atrasados. Posso ajudar a replanejar?"
          : saude.semaforo !== "ok"
            ? "Vi que o último encontro teve pontos de atenção. Posso ajudar em algo?"
            : "Como estão os próximos encontros?";
  // msgs prontas pras duas pontas: o mentor recebe o caso contextual; o
  // mentorado recebe um check-in gentil assinado por quem envia — os dois
  // destinos aparecem juntos no WhatsApp rápido quando o semáforo pede
  const msgs = msgsContato(
    {
      eu: meuNome,
      mentorNome: primeiroNome(dupla.mentor.nome),
      mentoradoNome: primeiroNome(dupla.mentorado.nome),
    },
    { casoMentor: caso }
  );
  const msg = msgs.mentor ?? "";
  const msgMentorado = msgs.mentorado ?? "";
  const destinosWa: DestinoWA[] = [
    {
      rotulo: `Mentor · ${primeiroNome(dupla.mentor.nome)}`,
      telefone: dupla.mentor.whatsapp,
      mensagem: msg,
      t: "nudge",
    },
    {
      rotulo: `Mentorado · ${primeiroNome(dupla.mentorado.nome)}`,
      telefone: dupla.mentorado.whatsapp,
      mensagem: msgMentorado,
      t: "contato",
    },
  ];
  const ultimoNudge = interacoes[dupla.id];
  const progresso = total > 0 ? Math.min(encontroAtual / total, 1) : 0;
  // superfície carrega o semáforo: o card inteiro sinaliza risco/atenção,
  // não só o dot — mesma gramática do banner de pedidos de apoio acima
  const superficie =
    saude.semaforo === "risco"
      ? "border-[var(--danger)]/40 bg-[var(--danger)]/5"
      : saude.semaforo === "atencao"
        ? "border-[var(--warn)]/40 bg-[var(--warn)]/8"
        : "border-transparent bg-card";

  return (
    <div
      style={{ "--i": Math.min(i, 10) } as CSSProperties}
      className={cn(
        "animate-enter relative rounded-xl border p-4 shadow-[var(--shadow-border)] transition-[border-color,box-shadow,translate] ease-snappy hover:-translate-y-px hover:border-[var(--brand-lime)]/60 hover:shadow-[var(--shadow-border-hover)]",
        superficie
      )}
    >
      <Link
        href={`/duplas/${dupla.id}`}
        aria-label={`Dupla ${dupla.mentor.nome} e ${dupla.mentorado.nome}`}
        className="absolute inset-0 rounded-xl focus-visible:ring-2 focus-visible:ring-ring"
      />
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
            <SemaforoDot nivel={saude.semaforo} />
            <DuplaAvatares mentor={dupla.mentor} mentorado={dupla.mentorado} size={32} />
            <p className="flex min-w-0 flex-1 items-center gap-1 font-semibold">
              <DuplaNomes truncar mentor={dupla.mentor.nome} mentorado={dupla.mentorado.nome} />
            </p>
            {dupla.trilha === "especialista" && (
              <Badge variant="secondary" className="font-normal shrink-0">
                {TRILHA_LABEL[dupla.trilha]}
              </Badge>
            )}
          </div>
          <p className="mt-1.5 text-sm text-muted-foreground">
            {saude.motivo}
            {dupla.status === "pausada" && saude.pediuApoio && " · dupla pausada"}
            {saude.proximo && saude.semaforo !== "ok" && (
              <> · próximo: {formatDateTime(saude.proximo.data_hora)}</>
            )}
          </p>
        </div>
        {/* coluna de progresso com largura estável — w-full dentro de
            items-end herdava a largura do filho mais largo (~90px
            acidentais); trilha merece presença fixa */}
        <div className="relative flex w-20 shrink-0 flex-col items-end gap-2 sm:w-24">
          <span className="text-xs text-muted-foreground">
            <span className="font-mono tabular-nums">{encontroAtual}/{total}</span>{" "}
            encontros
          </span>
          <div
            role="progressbar"
            aria-valuenow={encontroAtual}
            aria-valuemin={0}
            aria-valuemax={total}
            aria-label={`${encontroAtual} de ${total} encontros`}
            className="h-1 w-full overflow-hidden rounded-full bg-muted"
          >
            {/* fill-grow lê o --i herdado do card: a barra enche uma vez,
                logo depois da entrada do card, sem reflow de width */}
            <span
              className="fill-grow block h-full rounded-full bg-[var(--brand-lime)]"
              style={{ width: `${progresso * 100}%` }}
            />
          </div>
          {ultimoReg?.avaliacao && <AvaliacaoBadge avaliacao={ultimoReg.avaliacao} />}
        </div>
      </div>
      {/* a ação (WhatsApp) não é o destino do card (ficha) — a zona do
          lembrete é um poço na base do card, mesma gramática do CardFooter
          (-m cobre o p-4, inset muted + divisor /60); a anotação "último
          lembrete" mora junto da ação (GG-3). relative: o Link stretched
          cobre o card inteiro — sem ele o botão ficava sob a camada de clique */}
      <div className="relative -mx-4 -mb-4 mt-3 flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5 rounded-b-xl border-t border-border/60 bg-muted/50 px-4 pb-3 pt-2.5">
        <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
          {ultimoNudge && (
            <>
              Último lembrete {formatDiaMes(ultimoNudge.created_at)}
              {ultimoNudge.autor?.nome ? ` por ${ultimoNudge.autor.nome}` : ""}
            </>
          )}
        </span>
        {/* fora do verde a coordenação escolhe a ponta: nudge pro mentor ou
            check-in direto com o mentorado; no ok segue o nudge de rotina */}
        {saude.semaforo !== "ok" ? (
          <WhatsAppRapido duplaId={dupla.id} destinos={destinosWa} compacto />
        ) : (
          <NudgeButton
            telefone={dupla.mentor.whatsapp}
            mensagem={msg}
            label="Chamar no WhatsApp"
            duplaId={dupla.id}
          />
        )}
      </div>
    </div>
  );
}

function primeiroNome(nome: string) {
  return nome.split(" ")[0];
}
