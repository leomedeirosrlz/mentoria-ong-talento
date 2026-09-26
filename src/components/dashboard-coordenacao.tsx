import type { CSSProperties } from "react";
import Link from "next/link";
import { ArrowCounterClockwise, ArrowRight } from "@phosphor-icons/react/dist/ssr";
import {
  eventoDaSemana,
  formatDiaMes,
  formatDateTime,
  maxEncontros,
  resumoSemana,
  saudadeDaDupla,
  textoResumoSemana,
  TRILHA_LABEL,
  ultimoRegistro,
  type DuplaSaude,
  ORDEM_SEMAFORO,
} from "@/lib/ciclo";
import type { CicloEvento, Comunicado, Dupla, SolicitacaoEspecialista, Supervisao } from "@/lib/types";
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
import { cn } from "@/lib/utils";



type LinhaSaude = { dupla: Dupla; saude: DuplaSaude };

/** Filtros dos stat-cards — cada stat filtra a lista pra mostrar só as duplas
 *  que o seu número resume (resumo → itens). "Duplas ativas" é a visão cheia
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

export function DashboardCoordenacao({
  duplas,
  eventos,
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
  const evento = eventoDaSemana(eventos, hoje);
  const resumo = resumoSemana(duplas, eventos, hoje);

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
  // se houver aviso — sem o guard o template xl reservava ~340px de faixa
  // morta. O resumo não conta: agora é faixa larga acima dos stats.
  const temRail = !supervisor || avisos.length > 0;

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Visão geral</h1>
        {evento && (
          <p className="text-sm text-muted-foreground mt-1 flex items-center gap-1.5">
            <span aria-hidden className="size-2 shrink-0 rounded-full bg-[var(--brand-lime)]" />
            <span>
              <span className="font-medium text-foreground">
                Semana do {evento.numero}º encontro
              </span>
              {evento.fase ? ` · ${evento.fase}` : ""} · {evento.titulo}
            </span>
          </p>
        )}
      </header>

      {!supervisor && (
        <SetupChecklist
          pessoas={pessoas}
          duplas={duplas.length}
          encontros={duplas.reduce((n, d) => n + d.encontros.length, 0)}
          registros={duplas.reduce((n, d) => n + d.encontros.filter((e) => e.registro).length, 0)}
        />
      )}

      {/* faixa larga acima dos stats: o fechamento da semana em números
          rotulados, com as ações (registros, copiar) no cabeçalho do bloco.
          Fora do grid xl — era o último item do rail e sumia espremido em
          340px; o dl abre em linha a partir de sm */}
      {resumo && (
        <section
          aria-labelledby="resumo-semana-titulo"
          className="animate-enter rounded-xl bg-card px-4 py-3 text-sm shadow-[var(--shadow-border)] sm:px-5"
        >
          <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5">
            {/* o nº do encontro já está no cabeçalho ("Semana do Nº encontro") —
                aqui a data é o fato novo */}
            <h2 id="resumo-semana-titulo" className="font-semibold">
              Esta semana · {formatDiaMes(resumo.evento.data)}
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
                texto={textoResumoSemana(resumo, emRisco)}
              />
            </div>
          </div>
          <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3 border-t border-border/60 pt-3 sm:grid-cols-4">
            <div>
              <dt className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Realizaram o encontro</dt>
              <dd className="mt-0.5 font-mono text-xl font-semibold tabular-nums">
                {resumo.realizaram}
                <span className="font-normal text-muted-foreground">
                  /{resumo.total}
                </span>
              </dd>
            </div>
            <div>
              <dt className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Registros entregues</dt>
              <dd className="mt-0.5 font-mono text-xl font-semibold tabular-nums">
                {resumo.comRegistro}
              </dd>
            </div>
            <div>
              <dt className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Aguardando registro</dt>
              <dd className="mt-0.5 font-mono text-xl font-semibold tabular-nums">
                {resumo.aguardandoRegistro}
              </dd>
            </div>
            <div>
              <dt className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Sem encontro</dt>
              <dd className="mt-0.5 font-mono text-xl font-semibold tabular-nums">
                {resumo.naoAconteceram - resumo.reposicao}
              </dd>
            </div>
          </dl>
          {resumo.reposicao > 0 && (
            // o significado de "em reposição" fica visível — tooltip/title
            // não existe no toque
            <p className="mt-3 flex flex-wrap items-center gap-x-1.5 gap-y-1 border-t border-border/60 pt-2.5 text-xs text-muted-foreground">
              <Badge variant="outline" className="text-muted-foreground">
                <ArrowCounterClockwise data-icon="inline-start" />
                <span className="font-mono">{resumo.reposicao}</span> em reposição
              </Badge>
              <span>
                {resumo.reposicao === 1
                  ? "encontro de outra semana feito nesta"
                  : "encontros de outras semanas feitos nesta"}
              </span>
            </p>
          )}
        </section>
      )}

      {/* xl+: trabalho na coluna principal (stats + radar), contexto no rail
          da direita — mesmo modelo do aside da ficha de dupla. O rail vem
          depois no DOM: no mobile a leitura segue stats → radar → contexto
          sem precisar de order-* */}
      <div
        className={cn(
          "grid gap-8",
          temRail && "xl:grid-cols-[minmax(0,1fr)_minmax(300px,340px)]"
        )}
      >
        <div className="min-w-0 space-y-8">
          <div
            role="group"
            aria-label="Filtrar lista de duplas"
            className="grid grid-cols-2 gap-3 xl:grid-cols-4"
          >
            <Stat i={0} label="Duplas ativas" valor={ativas} href="/" ativo={!filtroAtivo} />
            <Stat
              i={1}
              label="Em risco"
              valor={risco}
              destaque={risco > 0 ? "danger" : undefined}
              href="/?filtro=risco"
              ativo={filtroAtivo === "risco"}
            />
            <Stat
              i={2}
              label="Em atenção"
              valor={atencao}
              destaque={atencao > 0 ? "warn" : undefined}
              href="/?filtro=atencao"
              ativo={filtroAtivo === "atencao"}
            />
            <Stat
              i={3}
              label="Registros pendentes"
              valor={semRegistro}
              destaque={semRegistro > 0 ? "warn" : undefined}
              href="/?filtro=pendentes"
              ativo={filtroAtivo === "pendentes"}
            />
          </div>

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

          {/* radar depois do pulso: resumo da semana e stats vêm acima; a
              lista de duplas é o bloco de trabalho — solicitações e avisos
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

            {/* entrada escalonada — o stagger revela a ordem risco→ok (spec §2) */}
            {visiveis.map(({ dupla, saude }, i) => (
              <DuplaCard
                key={dupla.id}
                dupla={dupla}
                saude={saude}
                origem={origem}
                interacoes={interacoes}
                hoje={hoje}
                i={i}
                meuNome={meuNome}
              />
            ))}
          </section>

          {/* ritual supervisor ↔ mentor do guia (0041): registrar a conversa e
              reler as últimas. Sem dupla supervisionada nem sessão no histórico,
              o cartão some — a lista de duplas vazia já carrega a explicação */}
          {supervisor && (supervisaoItens.length > 0 || supervisaoAlvos.length > 0) && (
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

/** Stat = número-resumo + link-filtro: o clique mostra na lista só as duplas
 *  que o número resume. Ativo ganha borda lime (mesmo "ativo" da nav) +
 *  aria-current; superfície e hover seguem a gramática dos cards clicáveis —
 *  mesma cara, mesmo comportamento. */
function Stat({
  i,
  label,
  valor,
  destaque,
  href,
  ativo,
}: {
  /** posição no grupo — alimenta o stagger do animate-enter */
  i: number;
  label: string;
  valor: number;
  destaque?: "warn" | "danger";
  href: string;
  ativo?: boolean;
}) {
  return (
    <Link
      href={href}
      aria-current={ativo ? "true" : undefined}
      style={{ "--i": i } as CSSProperties}
      className={cn(
        "animate-enter rounded-xl border bg-card px-4 py-3 shadow-[var(--shadow-border)] transition-[border-color,box-shadow,translate] ease-snappy",
        "hover:-translate-y-px hover:border-[var(--brand-lime)]/60 hover:shadow-[var(--shadow-border-hover)] focus-visible:ring-2 focus-visible:ring-ring",
        ativo ? "border-[var(--brand-lime)]" : "border-transparent"
      )}
    >
      <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
        {destaque && (
          <span
            aria-hidden
            className={cn(
              "size-2 rounded-full",
              destaque === "danger" ? "bg-[var(--danger)]" : "bg-[var(--warn)]"
            )}
          />
        )}
        {label}
      </p>
      <p
        className={
          "mt-1 font-mono text-3xl font-semibold tracking-tight tabular-nums " +
          (destaque === "danger" ? "text-[var(--danger)]" : destaque === "warn" ? "text-[var(--warn-text)]" : "")
        }
      >
        {valor}
      </p>
    </Link>
  );
}

function DuplaCard({
  dupla,
  saude,
  origem,
  interacoes,
  hoje,
  i,
  meuNome,
}: {
  dupla: Dupla;
  saude: ReturnType<typeof saudadeDaDupla>;
  origem: string;
  interacoes: Record<string, Interacao>;
  hoje: Date;
  /** posição na lista — alimenta o stagger do animate-enter (cap 10) */
  i: number;
  /** primeiro nome de quem envia — assina a msg pro mentorado */
  meuNome?: string;
}) {
  // denominador e saúde seguem a trilha da dupla — 16 no DPP, 5 no especialista
  const total = maxEncontros(dupla.trilha);
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
        <div className="relative flex shrink-0 flex-col items-end gap-2">
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
