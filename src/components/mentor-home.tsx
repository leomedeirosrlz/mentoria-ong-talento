import { Fragment, type CSSProperties, type ReactNode } from "react";
import Link from "next/link";
import {
  CalendarCheck,
  CalendarPlus,
  CaretRight,
  CheckCircle,
  ClipboardText,
  HandHeart,
  PauseCircle,
  VideoCamera,
} from "@phosphor-icons/react/dist/ssr";
import {
  alvoAgendamento,
  cronogramaVigente,
  eventoDaSemana,
  eventosDoCronograma,
  formatDate,
  formatDateTime,
  jornadaDaDupla,
  linkSeguro,
  passosDaTrilha,
  saudadeDaDupla,
  toDateStr,
  totalDaTrilha,
} from "@/lib/ciclo";
import { limboFechado } from "@/lib/agenda-minha";
import { temPapel } from "@/lib/types";
import type {
  CicloEvento,
  Cronograma,
  Dupla,
  Encontro,
  EspecialistaEvento,
  Profile,
} from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { AgendarEncontroDialog } from "@/components/agendar-encontro-dialog";
import { CombinadoCheck } from "@/components/combinado-check";
import { DuplaNomes } from "@/components/dupla-nomes";
import { RegistrarRetroativoDialog } from "@/components/registrar-retroativo-dialog";
import { TrilhaJornada } from "@/components/trilha-jornada";
import { TrilhaPrazoBadge } from "@/components/trilha-prazo-badge";
import { MarcoNotifier } from "@/components/marco-notifier";

/** Ações do painel "Próximo passo": no celular empilham em largura total (alvo
 *  de 44px, polegar); do sm em diante voltam pra linha à direita. */
const ACOES =
  "mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end [&>*]:h-11 [&>*]:w-full sm:[&>*]:h-8 sm:[&>*]:w-auto";

/** Ciclo que já não pede ação: sai da lista de ativas e vai pro bloco final. */
const finalizada = (d: Dupla) => d.status === "concluida" || d.status === "encerrada";

export function MentorHome({
  duplas,
  eventos,
  espEventos = [],
  cronogramas = [],
  me,
  termo,
}: {
  duplas: Dupla[];
  /** Calendário oficial DPP — a trilha especialista não o usa. */
  eventos: CicloEvento[];
  /** Passos da trilha especialista — alimenta a jornada das duplas dela. */
  espEventos?: EspecialistaEvento[];
  /** Cronogramas ativos/encerrados — resolve o vigente quando o mentor ainda
   *  não tem dupla DPP (o banner da semana continua fazendo sentido pra ele). */
  cronogramas?: Cronograma[];
  me: Profile;
  /** Faixa de pendência (ex.: termo de adesão) em largura total — entra logo
   *  abaixo do cabeçalho, antes dos cards de dupla, nunca dentro da grade. */
  termo?: ReactNode;
}) {
  const hoje = new Date();
  // "Semana do Nº" é do cronograma da dupla DPP do mentor (0061) — mentor com
  // duplas em duas turmas vê a da primeira ativa; sem dupla DPP, o vigente
  // global segue valendo como contexto
  const cronDaHome =
    duplas.find((d) => d.trilha !== "especialista" && d.status === "ativa")
      ?.cronograma_id ??
    duplas.find((d) => d.trilha !== "especialista")?.cronograma_id ??
    cronogramaVigente(cronogramas, hoje)?.id ??
    null;
  const eventoSemana = eventoDaSemana(
    eventosDoCronograma(eventos, cronDaHome),
    hoje
  );
  // "Semana do Nº encontro" é o calendário DPP — pra especialista a faixa é
  // um dado alheio, tenha ele dupla ou não (every em [] = true cobre o caso
  // de ainda não pareado; um DPP sem dupla segue vendo a semana do ciclo)
  const soEspecialista =
    temPapel(me, "mentor_especialista") &&
    !temPapel(me, "mentor_dpp") &&
    duplas.every((d) => d.trilha === "especialista");

  // com N duplas (mentor_especialista pode carregar várias trilhas) a mais
  // acionável vem primeiro — o semáforo da saúde já destila registro
  // pendente e atraso (pedido de apoio é eixo separado: o mentor sabe do
  // próprio chamado, não ordena por ele); a ordenação é estável, então
  // duplas no mesmo estado mantêm a ordem em que vieram
  const saudes = new Map(
    duplas.map((d) => [d.id, saudadeDaDupla(d, eventos, hoje)])
  );
  const rankSemaforo = { risco: 0, atencao: 1, ok: 2 } as const;
  const duplasOrdenadas = [...duplas].sort(
    (a, b) =>
      rankSemaforo[saudes.get(a.id)!.semaforo] -
      rankSemaforo[saudes.get(b.id)!.semaforo]
  );
  const ativas = duplasOrdenadas.filter((d) => !finalizada(d));
  const concluidas = duplasOrdenadas.filter(finalizada);

  return (
    // >1 dupla: em xl os cards abrem 2 colunas — a 1280px o card cheio deixa
    // os sub-painéis internos (sm:grid-cols-2) largos demais pra leitura.
    // gap-8 no lugar de space-y-8 mantém o ritmo vertical idêntico; o grupo
    // do cabeçalho e o empty state cravam col-span-2 pra continuar full-width
    <div className={cn("grid gap-8", duplas.length > 1 && "xl:grid-cols-2")}>
      {/* cabeçalho + faixa de pendência formam um grupo só: a faixa é linha
          única de largura total logo abaixo da "Semana do Nº", nunca célula
          da grade (em xl ela esticava na altura do 1º card) */}
      <div className={cn("space-y-4", duplas.length > 1 && "xl:col-span-2")}>
        <header>
          <h1 className="text-2xl font-semibold tracking-tight">Olá, {(me.nome_social ?? me.nome).split(" ")[0]}</h1>
          {eventoSemana && !soEspecialista && (
            <p className="text-sm text-muted-foreground mt-1 flex items-start gap-1.5">
              <span aria-hidden className="mt-1.5 size-2 shrink-0 rounded-full bg-[var(--brand-lime)]" />
              <span>
                <span className="font-medium text-foreground">
                  Semana do {eventoSemana.numero}º encontro
                </span>
                {eventoSemana.fase ? ` · ${eventoSemana.fase}` : ""}
              </span>
            </p>
          )}
        </header>
        {termo}
      </div>

      {duplas.length === 0 && (
        <Card>
          <CardContent className="py-10 text-center">
            {/* glifo da marca no lugar do ícone genérico: os dois discos
                sobrepostos da dupla (precedente DuplaAvatares) */}
            <span aria-hidden className="mx-auto inline-flex">
              <span className="size-8 rounded-full bg-[var(--brand-lime)] ring-2 ring-card" />
              <span className="-ml-2.5 size-8 rounded-full bg-[var(--role-mentorado)] ring-2 ring-card" />
            </span>
            <p className="mt-3 font-medium text-foreground">
              Você ainda não está em nenhuma dupla.
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              A coordenação monta as duplas. Quando a sua estiver pronta, ela aparece aqui.
            </p>
          </CardContent>
        </Card>
      )}

      {ativas.map((dupla, i) => {
        const ativa = dupla.status === "ativa";
        const ehEsp = dupla.trilha === "especialista";
        // saude.proximo já vem ordenado por data_hora — o find sem sort podia
        // pegar um encontro agendado mais distante que outro agendado antes
        const saude = saudes.get(dupla.id)!;
        const feitos = saude.feitos;
        // calendário da dupla (0061) — teto, trilha e sugestões saem do
        // cronograma dela, nunca da união das turmas
        const eventosDaDupla = eventosDoCronograma(
          eventos,
          dupla.cronograma_id
        );
        const totalDupla = totalDaTrilha(dupla.trilha, eventosDaDupla);
        const proximoAgendado = saude.proximo;
        const {
          proximoNumero, encontroAlvo, sugeridoProximo, faltantes, cicloCompleto,
        } = alvoAgendamento(dupla, eventos, hoje);
        const jornada = jornadaDaDupla(
          dupla,
          passosDaTrilha(dupla.trilha, eventosDaDupla, espEventos),
          hoje
        );
        // pendência de registro mais antiga — realizado sem registro ou
        // limbo fechado: agendado/remarcado cujo horário previsto (início
        // + duração) já passou. Enquanto a chamada rola o encontro ainda
        // não é cobrança — a régua é a mesma `limboFechado` da agenda
        const semRegistro = [...dupla.encontros]
          .sort((a, b) => a.numero - b.numero)
          .find(
            (e) =>
              !e.registro &&
              (e.status === "realizado" ||
                limboFechado(e, hoje.getTime()))
          );
        // chamada no ar: começou mas o fim previsto ainda não passou —
        // conta como "agendado agora" (Entrar), não como limbo
        const rolandoAgora = (e: Encontro | null | undefined) =>
          !!e &&
          e.data_hora != null &&
          new Date(e.data_hora) <= hoje &&
          !limboFechado(e, hoje.getTime());
        const pendentes = dupla.encaminhamentos
          .filter((t) => t.status === "pendente")
          // vencido primeiro, depois o prazo mais próximo — a mesma ordem
          // da lista na ficha, pra home não esconder urgente no "+N mais"
          .sort((a, b) =>
            (a.prazo ?? "9999").localeCompare(b.prazo ?? "9999")
          );
        const hojeStr = toDateStr(hoje);

        // máquina de estados do painel "O que fazer agora" — um primário por
        // dupla: pendência de registro vem antes de qualquer agendamento (a
        // dupla resolve o passado, depois o futuro). saude.proximo só cobre
        // "agendado" futuro; uma row "remarcado" com data futura é o mesmo
        // caso na prática e trata como agendado aqui.
        const agendado =
          (rolandoAgora(encontroAlvo) ? encontroAlvo : null) ??
          proximoAgendado ??
          (encontroAlvo?.data_hora && new Date(encontroAlvo.data_hora) > hoje
            ? encontroAlvo
            : null);
        // "Agendar próximo encontro" no estado quieto: primeiro número
        // PENDENTE do ciclo — livre = sem row realizada/agendada/remarcada
        // (nao_aconteceu e cancelado voltam a ser agendáveis; o dialog
        // recebe a row em `atual` e edita em vez de criar duplicata).
        // Antes era o primeiro livre DEPOIS do agendado: com um buraco
        // atrás (9º marcado, 8º pulado) a home sugeria pular adiante pro
        // 10º — divergia do "resolve na ordem" das outras superfícies
        const numerosOcupados = new Set(
          dupla.encontros
            .filter(
              (e) =>
                e.status === "realizado" ||
                e.status === "agendado" ||
                e.status === "remarcado"
            )
            .map((e) => e.numero)
        );
        let seguinteNumero: number | null = null;
        if (agendado) {
          // mesmo piso do alvoAgendamento (ciclo.ts): quem entrou a meio do
          // ciclo não tem buraco antes da entrada — sem o piso o nº1 era
          // sugerido e virava row fantasma
          const inicioSeg = dupla.iniciada_em;
          const pisoSeguinte = inicioSeg
            ? (eventosDaDupla.find(
                (e) => e.tipo === "encontro" && e.numero != null && e.data != null && e.data >= inicioSeg
              )?.numero ?? 1)
            : 1;
          for (let n = pisoSeguinte; n <= totalDupla; n++) {
            if (!numerosOcupados.has(n)) {
              seguinteNumero = n;
              break;
            }
          }
        }
        const encontroSeguinte =
          seguinteNumero != null
            ? (dupla.encontros.find((e) => e.numero === seguinteNumero) ?? null)
            : null;
        const sugeridoSeguinte =
          seguinteNumero != null && !ehEsp
            ? (eventosDaDupla.find(
                (e) => e.tipo === "encontro" && e.numero === seguinteNumero
              )?.data ?? undefined)
            : undefined;

        // ícone do painel: a situação é lida antes do texto
        const PassoIcone = !ativa
          ? PauseCircle
          : semRegistro
            ? ClipboardText
            : cicloCompleto
              ? CheckCircle
              : agendado
                ? CalendarCheck
                : CalendarPlus;

        // --card-spacing=5 no sm+: padding uniforme p-4→sm:p-5 no card
        // inteiro via a var (header, content e gap vertical seguem juntos)
        const card = (
          <Card
            style={{ "--i": Math.min(i, 10) } as CSSProperties}
            className="animate-enter overflow-hidden sm:[--card-spacing:--spacing(5)]"
          >
            {/* -mt cobre o py do Card — o banner ink encosta no topo;
                pt/pb devolvem o respiro interno; a keyline lime na base é
                a única faixa de marca da tela (uma por tela) */}
            <CardHeader className="-mt-(--card-spacing) border-b-2 border-[var(--brand-lime)] bg-[var(--brand-ink)] pb-(--card-spacing) pt-(--card-spacing) text-white">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  {(ehEsp || !ativa) && (
                    <p className="text-xs font-semibold uppercase tracking-[0.08em] text-white/70">
                      {!ativa ? "Pausada" : "Mentoria especializada"}
                    </p>
                  )}
                  <CardTitle className="text-lg font-semibold">
                    <DuplaNomes
                      mentor="Você"
                      mentorado={dupla.mentorado.nome_social ?? dupla.mentorado.nome}
                      onDark
                    />
                  </CardTitle>
                  {/* auxiliar executivo: meta discreto sob o lockup; white/70
                      mantém o nome legível no ink */}
                  {dupla.supervisor && (
                    <p className="mt-0.5 text-xs text-white/70">
                      Auxiliar executivo:{" "}
                      {dupla.supervisor.nome_social ?? dupla.supervisor.nome}
                    </p>
                  )}
                  {/* prazo de 3 meses da trilha especialista — retintado pro ink */}
                  {ehEsp && (
                    <div className="mt-2 [&>span]:border-white/25 [&>span]:text-white/70">
                      <TrilhaPrazoBadge dupla={dupla} />
                    </div>
                  )}
                </div>
                {/* o card todo não é link — a saída pra ficha tem affordance
                    própria; no celular vira só a seta (44px), sem espremer o nome */}
                <Link
                  href={`/duplas/${dupla.id}`}
                  aria-label="Abrir a ficha da dupla"
                  className={cn(
                    buttonVariants({ variant: "ghost", size: "sm" }),
                    "group -mr-2 h-11 w-11 shrink-0 px-0 text-white/80 sm:w-auto sm:px-2.5 hover:bg-white/10 hover:text-white focus-visible:ring-[var(--brand-lime)] sm:h-8"
                  )}
                >
                  <span className="hidden sm:inline">Abrir dupla</span>
                  <CaretRight
                    aria-hidden
                    size={18}
                    className="transition-transform group-hover:translate-x-0.5"
                  />
                </Link>
              </div>
              {/* progresso em barra: "quanto já andamos" lido sem contar bolinhas */}
              <div className="mt-3">
                <div
                  role="progressbar"
                  aria-label="Encontros realizados"
                  aria-valuemin={0}
                  aria-valuemax={totalDupla}
                  aria-valuenow={feitos}
                  className="h-2 overflow-hidden rounded-full bg-white/15"
                >
                  <div
                    className="h-full rounded-full bg-[var(--brand-lime)]"
                    style={{ width: `${totalDupla ? Math.min(100, (feitos / totalDupla) * 100) : 0}%` }}
                  />
                </div>
                <p className="mt-1.5 text-sm text-white">
                  <span className="font-semibold tabular-nums">{feitos} de {totalDupla}</span>{" "}
                  encontros feitos
                </p>
              </div>
            </CardHeader>

            <CardContent className="pt-5 space-y-5">
              {/* pedido de apoio feito pelo próprio mentor: confirma recebimento
                  em tom de acolhida — não o semáforo de risco da coordenação */}
              {saude.pediuApoio && dupla.status !== "encerrada" && dupla.status !== "concluida" && (
                <p className="flex items-start gap-2.5 rounded-lg border border-[var(--warn)]/40 bg-[var(--warn)]/8 px-4 py-3 text-sm">
                  <HandHeart
                    size={18}
                    aria-hidden
                    className="mt-0.5 shrink-0 text-[var(--warn-text)]"
                  />
                  <span>
                    <span className="font-medium">Apoio solicitado.</span>{" "}
                    A coordenação já foi avisada e vai entrar em contato com você.
                  </span>
                </p>
              )}
              {/* o que fazer agora: o próximo passo é o destaque da marca
                  (amarelo), não alerta. Mesmo cartão, separado por divisória */}
              <section
                aria-labelledby={`fazer-${dupla.id}`}
                className={cn(
                  "rounded-lg p-4",
                  ativa
                    ? "bg-[var(--destaque-suave)] border border-[var(--destaque-borda)]"
                    : "bg-muted/50"
                )}
              >
                <h3
                  id={`fazer-${dupla.id}`}
                  className="flex items-center gap-2.5 text-sm font-semibold"
                >
                  <span
                    aria-hidden
                    className={cn(
                      "grid size-9 shrink-0 place-items-center rounded-full",
                      ativa
                        ? "bg-[var(--destaque)] text-[var(--destaque-foreground)]"
                        : "bg-muted text-muted-foreground"
                    )}
                  >
                    <PassoIcone size={20} weight="bold" />
                  </span>
                  Próximo passo
                </h3>
                <div className="mt-3">
                  {!ativa ? (
                    <p className="font-medium text-muted-foreground">
                      {dupla.status === "pausada"
                        ? "Dupla pausada. A coordenação retoma quando for a hora."
                        : "Dupla encerrada. Agradecemos pela jornada!"}
                    </p>
                  ) : semRegistro ? (
                    <>
                      <p className="text-base font-semibold leading-snug">
                        {semRegistro.status !== "realizado"
                          ? `O ${semRegistro.numero}º encontro estava marcado, mas a data já passou.`
                          : `O ${semRegistro.numero}º encontro aconteceu.`}
                      </p>
                      <p className="text-sm text-muted-foreground mt-0.5">
                        {semRegistro.status !== "realizado"
                          ? "Se rolou, conte como foi."
                          : "Falta só o registro."}
                      </p>
                      {/* ação do painel sempre à direita — mesma régua do
                          "n de N" da Jornada e do "Abrir dupla" no header.
                          No limbo a pergunta "rolou?" tem duas saídas —
                          registrar (se sim) ou remarcar (se não) */}
                      <div className={ACOES}>
                        <Link
                          href={`/duplas/${dupla.id}?aba=encontros#registrar-${semRegistro.id}`}
                          className={buttonVariants({ size: "sm" })}
                        >
                          <ClipboardText size={16} />
                          Registrar como foi
                        </Link>
                        {semRegistro.status !== "realizado" && (
                          <Link
                            href={`/duplas/${dupla.id}?aba=encontros#encontro-${semRegistro.id}`}
                            className={buttonVariants({ variant: "outline", size: "sm" })}
                          >
                            <CalendarPlus size={16} />
                            Remarcar na ficha
                          </Link>
                        )}
                      </div>
                    </>
                  ) : cicloCompleto ? (
                    <p className="text-base font-semibold leading-snug">
                      Todos os {totalDupla} encontros já aconteceram.
                    </p>
                  ) : agendado ? (
                    <>
                      <p className="text-base font-semibold leading-snug">
                        {agendado.numero}º encontro agendado
                      </p>
                      <p className="text-sm text-muted-foreground mt-0.5">
                        {formatDateTime(agendado.data_hora)}
                      </p>
                      <div className={ACOES}>
                        {/* na hora do encontro o link da chamada é a ação nº1 —
                            chip próprio, não texto corrido (mesmo fix do CC-1) */}
                        {linkSeguro(agendado.link) && (
                          <a
                            href={linkSeguro(agendado.link)!}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={buttonVariants({ variant: "outline", size: "sm" })}
                          >
                            <VideoCamera aria-hidden />
                            Entrar na chamada
                            <span className="sr-only"> (abre em nova aba)</span>
                          </a>
                        )}
                        {/* sessão de especialista nunca nasce por aqui — só
                            de um pedido aceito (a action recusa a criação);
                            mostrar o dialog era um CTA com erro garantido */}
                        {seguinteNumero != null && !ehEsp && (
                          <AgendarEncontroDialog
                            duplaId={dupla.id}
                            numero={seguinteNumero}
                            atual={encontroSeguinte}
                            sugerido={sugeridoSeguinte}
                            piso={dupla.iniciada_em ?? undefined}
                            jovemNome={
                              (dupla.mentorado.nome_social ?? dupla.mentorado.nome).split(" ")[0]
                            }
                            trigger={
                              <Button variant="outline" size="sm">
                                <CalendarPlus size={16} />
                                Marcar o próximo encontro
                              </Button>
                            }
                          />
                        )}
                      </div>
                    </>
                  ) : encontroAlvo ? (
                    // a row existe mas o horário já passou ou não aconteceu —
                    // nunca "ainda não agendado". "não aconteceu" é marcação
                    // de alguém (até do jovem) — o texto aponta o desfazer
                    <>
                      <p className="text-base font-semibold leading-snug">
                        {encontroAlvo.numero}º encontro{" "}
                        {encontroAlvo.status === "nao_aconteceu" ||
                        encontroAlvo.status === "cancelado"
                          ? "não aconteceu."
                          : "já passou."}
                      </p>
                      <p className="text-sm text-muted-foreground mt-0.5">
                        {encontroAlvo.status === "nao_aconteceu"
                          ? "Remarque quando puder, ou desfaça na ficha se rolou."
                          : encontroAlvo.status === "cancelado"
                            ? "Remarque quando puder, ou registre como foi na ficha se rolou."
                            : "Se rolou, registre na ficha da dupla; se não, remarque."}
                      </p>
                      <div className={ACOES}>
                        {/* nao_aconteceu tem o Desfazer na ficha (undo da
                            marcação); pro cancelado e pro passado o caminho
                            é o registro — o salvarRegistro corrige o status */}
                        {encontroAlvo.status !== "nao_aconteceu" && (
                            <Link
                              href={`/duplas/${dupla.id}?aba=encontros#registrar-${encontroAlvo.id}`}
                              className={buttonVariants({ variant: "outline", size: "sm" })}
                            >
                              <ClipboardText size={16} />
                              Registrar como foi
                            </Link>
                          )}
                        <AgendarEncontroDialog
                          duplaId={dupla.id}
                          numero={proximoNumero}
                          atual={encontroAlvo}
                          sugerido={sugeridoProximo}
                          piso={dupla.iniciada_em ?? undefined}
                          jovemNome={
                            (dupla.mentorado.nome_social ?? dupla.mentorado.nome).split(" ")[0]
                          }
                          trigger={
                            <Button size="sm">
                              <CalendarPlus size={16} />
                              Remarcar
                            </Button>
                          }
                        />
                      </div>
                    </>
                  ) : ehEsp ? (
                    // na trilha especialista não existe "agendar o próximo":
                    // toda sessão nasce de um pedido aceito (jovem ou staff)
                    // — o dialog daqui criaria a row que a action recusa
                    <p className="text-base font-semibold leading-snug">
                      Sessão nova nasce de um pedido aceito: do jovem ou da
                      coordenação.
                    </p>
                  ) : (
                    <>
                      <p className="text-base font-semibold leading-snug">O {proximoNumero}º encontro ainda não tem data</p>
                      <p className="text-sm text-muted-foreground mt-0.5">
                        {sugeridoProximo
                          ? `Sugerido: ${formatDate(sugeridoProximo)}`
                          : "Data a combinar"}
                      </p>
                      <div className={ACOES}>
                        <AgendarEncontroDialog
                          duplaId={dupla.id}
                          numero={proximoNumero}
                          atual={encontroAlvo}
                          sugerido={sugeridoProximo}
                          piso={dupla.iniciada_em ?? undefined}
                          jovemNome={
                            (dupla.mentorado.nome_social ?? dupla.mentorado.nome).split(" ")[0]
                          }
                        />
                      </div>
                    </>
                  )}
                  {ativa && !cicloCompleto && faltantes.length > 0 && (
                    <p className="mt-3 text-xs text-muted-foreground">
                      Tiveram encontros sem marcar aqui?{" "}
                      <RegistrarRetroativoDialog
                        duplaId={dupla.id}
                        faltantes={faltantes}
                        trigger={
                          <button
                            type="button"
                            className="inline-flex min-h-11 items-center rounded-sm underline underline-offset-2 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:min-h-0"
                          >
                            Registrar como foi.
                          </button>
                        }
                      />
                    </p>
                  )}
                </div>
              </section>

              {/* combinados: mesma superfície, separados por divisória —
                  pt-5 espelha o space-y-5 acima dela (a régua fica centrada
                  no mesmo respiro de 20px que separa os blocos) */}
              <section className="border-t border-border/60 pt-5">
                <h3 className="flex flex-wrap items-center gap-2 text-sm font-semibold">
                  Combinados da dupla
                  {pendentes.length > 0 && (
                    <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium tabular-nums">
                      {pendentes.length} em aberto
                    </span>
                  )}
                </h3>
                <div className="mt-2">
                  {pendentes.length === 0 ? (
                    <p className="flex items-center gap-2 text-sm text-muted-foreground">
                      <CheckCircle size={20} weight="fill" aria-hidden className="text-[var(--ok-text)]" />
                      Tudo em dia por aqui.
                    </p>
                  ) : (
                    <ul className="space-y-1.5">
                      {pendentes.slice(0, 4).map((t) => {
                        // vencido repete a gramática do EncaminhamentosList —
                        // cor nunca é o único canal (PV-2). O item marca feito
                        // aqui mesmo — a ficha fica a um toque pelo link
                        const vencido = t.prazo != null && t.prazo < hojeStr;
                        return (
                          <CombinadoCheck
                            key={t.id}
                            id={t.id}
                            duplaId={dupla.id}
                            descricao={t.descricao}
                            prazoLabel={t.prazo ? `até ${formatDate(t.prazo)}` : null}
                            vencido={vencido}
                          />
                        );
                      })}
                      {/* cap em 4 — o sufixo declara o overflow e leva à ficha (PD-2) */}
                      {pendentes.length > 4 && (
                        <li>
                          <Link
                            href={`/duplas/${dupla.id}#combinados`}
                            className="flex min-h-11 items-center gap-2 rounded-md text-sm font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:min-h-8"
                          >
                            <span aria-hidden className="size-1.5 shrink-0 rounded-full bg-muted-foreground/40" />
                            +{pendentes.length - 4} mais · ver todos
                          </Link>
                        </li>
                      )}
                    </ul>
                  )}
                </div>
              </section>

              {/* o mapa do ciclo fecha o card: contexto, não ação */}
              <div className="border-t border-border/60 pt-5">
                <TrilhaJornada
                  jornada={jornada}
                  enxuta
                  statusDupla={dupla.status}
                  inicioDupla={dupla.iniciada_em}
                  duplaId={dupla.id}
                />
                <MarcoNotifier duplaId={dupla.id} feitos={jornada.feitos} total={jornada.total} />
              </div>
            </CardContent>
          </Card>
        );
        return <Fragment key={dupla.id}>{card}</Fragment>;
      })}

      {concluidas.length > 0 && (
        <section aria-labelledby="ciclos-concluidos" className="xl:col-span-2 space-y-3">
          <h2 id="ciclos-concluidos" className="text-base font-semibold">
            Jornadas concluídas
          </h2>
          {concluidas.map((dupla) => {
            const saude = saudes.get(dupla.id)!;
            const totalDupla = totalDaTrilha(
              dupla.trilha,
              eventosDoCronograma(eventos, dupla.cronograma_id)
            );
            return (
              <div
                key={dupla.id}
                className="rounded-xl bg-card p-4 shadow-[var(--shadow-border)]"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold">
                      <DuplaNomes
                        mentor="Você"
                        mentorado={dupla.mentorado.nome_social ?? dupla.mentorado.nome}
                      />
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {dupla.status === "concluida" ? "Concluída" : "Encerrada"} ·{" "}
                      <span className="tabular-nums">
                        {saude.feitos}/{totalDupla}
                      </span>{" "}
                      encontros
                    </p>
                  </div>
                  <Link
                    href={`/duplas/${dupla.id}`}
                    className={cn(
                      buttonVariants({ variant: "ghost", size: "sm" }),
                      "group text-muted-foreground"
                    )}
                  >
                    Abrir dupla
                    <CaretRight
                      aria-hidden
                      className="transition-transform group-hover:translate-x-0.5"
                    />
                  </Link>
                </div>
                <p className="mt-3 rounded-lg border border-[var(--destaque-borda)] bg-[var(--destaque-suave)] px-3 py-2 text-sm">
                  {dupla.status === "concluida"
                    ? "Jornada concluída. Agradecemos pelo ciclo!"
                    : "Dupla encerrada. Agradecemos pela jornada!"}
                </p>
              </div>
            );
          })}
        </section>
      )}
    </div>
  );
}
