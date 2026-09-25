import type { CSSProperties } from "react";
import Link from "next/link";
import { ArrowUpRight, BookOpen, CalendarPlus, ClipboardText, HandHeart, VideoCamera } from "@phosphor-icons/react/dist/ssr";
import {
  alvoAgendamento,
  eventoDaSemana,
  formatDate,
  formatDateTime,
  jornadaDaDupla,
  linkSeguro,
  maxEncontros,
  passosDaTrilha,
  saudadeDaDupla,
  toDateStr,
} from "@/lib/ciclo";
import type {
  CicloEvento,
  Dupla,
  EspecialistaEvento,
  Profile,
} from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { AgendarEncontroDialog } from "@/components/agendar-encontro-dialog";
import { DuplaNomes } from "@/components/dupla-nomes";
import { RegistrarRetroativoDialog } from "@/components/registrar-retroativo-dialog";
import { TrilhaJornada } from "@/components/trilha-jornada";
import { MarcoNotifier } from "@/components/marco-notifier";

export function MentorHome({
  duplas,
  eventos,
  espEventos = [],
  me,
}: {
  duplas: Dupla[];
  /** Calendário oficial DPP — a trilha especialista não o usa. */
  eventos: CicloEvento[];
  /** Passos da trilha especialista — alimenta a jornada das duplas dela. */
  espEventos?: EspecialistaEvento[];
  me: Profile;
}) {
  const hoje = new Date();
  const eventoSemana = eventoDaSemana(eventos, hoje);
  // "Semana do Nº encontro" é o calendário DPP — pra especialista a faixa é
  // um dado alheio, tenha ele dupla ou não (every em [] = true cobre o caso
  // de ainda não pareado; um DPP sem dupla segue vendo a semana do ciclo)
  const soEspecialista =
    me.role === "mentor_especialista" &&
    duplas.every((d) => d.trilha === "especialista");

  return (
    // >1 dupla: em xl os cards abrem 2 colunas — a 1280px o card cheio deixa
    // os sub-painéis internos (sm:grid-cols-2) largos demais pra leitura.
    // gap-8 no lugar de space-y-8 mantém o ritmo vertical idêntico; header e
    // empty state cravam col-span-2 pra continuar full-width no xl
    <div className={cn("grid gap-8", duplas.length > 1 && "xl:grid-cols-2")}>
      <header className={duplas.length > 1 ? "xl:col-span-2" : undefined}>
        <h1 className="text-2xl font-semibold tracking-tight">Olá, {me.nome.split(" ")[0]}</h1>
        {eventoSemana && !soEspecialista && (
          <p className="text-sm text-muted-foreground mt-1 flex items-center gap-1.5">
            <span aria-hidden className="size-2 shrink-0 rounded-full bg-[var(--brand-lime)]" />
            <span>
              <span className="font-medium text-foreground">
                Semana do {eventoSemana.numero}º encontro
              </span>
              {eventoSemana.fase ? ` · ${eventoSemana.fase}` : ""}
            </span>
          </p>
        )}
      </header>

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
              A coordenação forma as duplas. Assim que a sua estiver pronta, ela aparece aqui.
            </p>
          </CardContent>
        </Card>
      )}

      {duplas.map((dupla, i) => {
        const ativa = dupla.status === "ativa";
        const ehEsp = dupla.trilha === "especialista";
        // saude.proximo já vem ordenado por data_hora — o find sem sort podia
        // pegar um encontro agendado mais distante que outro agendado antes
        const saude = saudadeDaDupla(dupla, eventos, hoje);
        const feitos = saude.feitos;
        const totalDupla = maxEncontros(dupla.trilha);
        const proximoAgendado = saude.proximo;
        const {
          proximoNumero, encontroAlvo, sugeridoProximo, faltantes, cicloCompleto,
        } = alvoAgendamento(dupla, eventos, hoje);
        const jornada = jornadaDaDupla(
          dupla,
          passosDaTrilha(dupla.trilha, eventos, espEventos),
          hoje
        );
        // pendência de registro mais antiga — realizado sem registro ou
        // agendado cuja data já passou (pode ter rolado: o mentor resolve
        // registrando, remarcando ou marcando não-aconteceu)
        const semRegistro = [...dupla.encontros]
          .sort((a, b) => a.numero - b.numero)
          .find(
            (e) =>
              !e.registro &&
              (e.status === "realizado" ||
                (e.status === "agendado" &&
                  e.data_hora != null &&
                  new Date(e.data_hora) < hoje))
          );
        const pendentes = dupla.encaminhamentos.filter((t) => t.status === "pendente");
        const hojeStr = toDateStr(hoje);

        // máquina de estados do painel "O que fazer agora" — um primário por
        // dupla: pendência de registro vem antes de qualquer agendamento (a
        // dupla resolve o passado, depois o futuro). saude.proximo só cobre
        // "agendado" futuro; uma row "remarcado" com data futura é o mesmo
        // caso na prática e trata como agendado aqui.
        const agendado =
          proximoAgendado ??
          (encontroAlvo?.data_hora && new Date(encontroAlvo.data_hora) > hoje
            ? encontroAlvo
            : null);
        // "Agendar próximo" no estado quieto: primeiro número livre depois
        // do agendado — livre = sem row realizada/agendada/remarcada
        // (nao_aconteceu e cancelado voltam a ser agendáveis; o dialog
        // recebe a row em `atual` e edita em vez de criar duplicata)
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
          for (let n = agendado.numero + 1; n <= totalDupla; n++) {
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
            ? eventos.find(
                (e) => e.tipo === "encontro" && e.numero === seguinteNumero
              )?.data
            : undefined;

        return (
          <Card
            key={dupla.id}
            style={{ "--i": Math.min(i, 10) } as CSSProperties}
            className="animate-enter overflow-hidden"
          >
            {/* -mt cobre o py do Card — o banner ink encosta no topo;
                pt/pb devolvem o respiro interno; a keyline lime na base é
                a única faixa de marca da tela (uma por tela) */}
            <CardHeader className="-mt-(--card-spacing) border-b-2 border-[var(--brand-lime)] bg-[var(--brand-ink)] pb-(--card-spacing) pt-(--card-spacing) text-white">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-white/50">Sua dupla</p>
                  <CardTitle className="text-lg font-semibold mt-1">
                    <DuplaNomes mentor="Você" mentorado={dupla.mentorado.nome} onDark />
                  </CardTitle>
                  <p className="mt-1 text-xs text-white/60">
                    Vocês marcam o encontro; depois registram aqui como foi.
                  </p>
                </div>
                <div className="flex flex-col items-end gap-0.5 text-right">
                  <span className="text-sm text-[var(--brand-lime)]">
                    <span className="font-mono tabular-nums">{feitos}/{totalDupla}</span>{" "}
                    encontros
                  </span>
                  {ehEsp && (
                    <span className="text-[11px] uppercase tracking-wider text-white/50">
                      Mentoria especializada
                    </span>
                  )}
                  {!ativa && (
                    <span className="text-[11px] uppercase tracking-wider text-white/50">
                      {dupla.status === "pausada"
                        ? "Pausada"
                        : dupla.status === "concluida"
                          ? "Concluída"
                          : "Encerrada"}
                    </span>
                  )}
                  {/* o card todo não é link — a saída pra ficha precisa de
                      affordance própria, visível mesmo sem pendência */}
                  <Link
                    href={`/duplas/${dupla.id}`}
                    className="group inline-flex min-h-11 items-center gap-1 rounded-lg px-2 text-xs font-medium text-white/70 transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-lime)] md:min-h-7"
                  >
                    Abrir dupla
                    <ArrowUpRight
                      size={13}
                      aria-hidden
                      className="transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
                    />
                  </Link>
                </div>
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
              {/* a trilha é o mapa do card inteiro — a pendência de registro
                  embaixo já explica o nó âmbar */}
              <TrilhaJornada
                jornada={jornada}
                statusDupla={dupla.status}
                inicioDupla={dupla.iniciada_em}
                duplaId={dupla.id}
              />
              <MarcoNotifier duplaId={dupla.id} feitos={jornada.feitos} total={jornada.total} />
              <div className="grid gap-4 sm:grid-cols-2">
                {/* um primário por dupla — a máquina de estados acima decide
                    qual é o próximo passo; o resto fica quieto ou some */}
                <div
                  className={cn(
                    "rounded-lg p-4",
                    semRegistro && ativa
                      ? "border border-[var(--warn)]/50 bg-[var(--warn)]/8"
                      : "bg-muted/50 shadow-[var(--shadow-inset)]"
                  )}
                >
                  <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground mb-1">O que fazer agora</p>
                  {!ativa ? (
                    <p className="font-medium text-muted-foreground">
                      {dupla.status === "pausada"
                        ? "Dupla pausada. A coordenação retoma quando for a hora."
                        : dupla.status === "concluida"
                          ? "Jornada concluída. Agradecemos pelo ciclo!"
                          : "Dupla encerrada. Agradecemos pela jornada!"}
                    </p>
                  ) : semRegistro ? (
                    <>
                      <p className="font-medium">
                        {semRegistro.status === "agendado"
                          ? `O ${semRegistro.numero}º encontro estava agendado e já passou.`
                          : `O ${semRegistro.numero}º encontro aconteceu.`}
                      </p>
                      <p className="text-sm text-muted-foreground mt-0.5">
                        {semRegistro.status === "agendado"
                          ? "Se rolou, conte como foi."
                          : "Falta só o registro de como foi."}
                      </p>
                      <div className="mt-3">
                        <Link
                          href={`/duplas/${dupla.id}#registrar-${semRegistro.id}`}
                          className={buttonVariants({ size: "sm" })}
                        >
                          <ClipboardText size={16} />
                          Registrar como foi
                        </Link>
                      </div>
                    </>
                  ) : cicloCompleto ? (
                    <p className="font-medium">
                      {totalDupla} encontros concluídos.
                    </p>
                  ) : agendado ? (
                    <>
                      <p className="font-medium">
                        {agendado.numero}º encontro agendado
                      </p>
                      <p className="text-sm text-muted-foreground mt-0.5">
                        {formatDateTime(agendado.data_hora)}
                      </p>
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        {/* na hora do encontro o link da chamada é a ação nº1 —
                            chip próprio, não texto corrido (mesmo fix do CC-1) */}
                        {linkSeguro(agendado.link) && (
                          <a
                            href={linkSeguro(agendado.link)!}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-[var(--ok)]/40 bg-[var(--ok)]/10 px-2.5 text-sm font-medium text-[var(--ok-text)] transition-colors hover:bg-[var(--ok)]/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:min-h-7"
                          >
                            <VideoCamera size={16} aria-hidden />
                            Entrar na chamada
                            <span className="sr-only"> (abre em nova aba)</span>
                          </a>
                        )}
                        {seguinteNumero != null && (
                          <AgendarEncontroDialog
                            duplaId={dupla.id}
                            numero={seguinteNumero}
                            atual={encontroSeguinte}
                            sugerido={sugeridoSeguinte}
                            piso={dupla.iniciada_em ?? undefined}
                            trigger={
                              <Button variant="outline" size="sm">
                                <CalendarPlus size={16} />
                                Agendar próximo
                              </Button>
                            }
                          />
                        )}
                      </div>
                    </>
                  ) : encontroAlvo ? (
                    // a row existe mas o horário já passou ou não aconteceu —
                    // nunca "ainda não agendado"
                    <>
                      <p className="font-medium">
                        {encontroAlvo.numero}º encontro{" "}
                        {encontroAlvo.status === "nao_aconteceu" ||
                        encontroAlvo.status === "cancelado"
                          ? "não aconteceu."
                          : "já passou."}
                      </p>
                      <p className="text-sm text-muted-foreground mt-0.5">
                        {encontroAlvo.status === "nao_aconteceu" ||
                        encontroAlvo.status === "cancelado"
                          ? "Remarque quando puder."
                          : "Se rolou, registre na ficha da dupla; se não, remarque."}
                      </p>
                      <div className="mt-3">
                        <AgendarEncontroDialog
                          duplaId={dupla.id}
                          numero={proximoNumero}
                          atual={encontroAlvo}
                          sugerido={sugeridoProximo}
                          piso={dupla.iniciada_em ?? undefined}
                          trigger={
                            <Button size="sm">
                              <CalendarPlus size={16} />
                              Remarcar
                            </Button>
                          }
                        />
                      </div>
                    </>
                  ) : (
                    <>
                      <p className="font-medium">{proximoNumero}º encontro ainda não agendado</p>
                      <p className="text-sm text-muted-foreground mt-0.5">
                        {sugeridoProximo
                          ? `Sugerido: ${formatDate(sugeridoProximo)}`
                          : "Data a combinar"}
                      </p>
                      <div className="mt-3">
                        <AgendarEncontroDialog
                          duplaId={dupla.id}
                          numero={proximoNumero}
                          atual={encontroAlvo}
                          sugerido={sugeridoProximo}
                          piso={dupla.iniciada_em ?? undefined}
                        />
                      </div>
                    </>
                  )}
                  {ativa && !cicloCompleto && faltantes.length > 0 && (
                    <p className="mt-3 text-xs text-muted-foreground">
                      Encontraram-se sem agendar?{" "}
                      <RegistrarRetroativoDialog
                        duplaId={dupla.id}
                        faltantes={faltantes}
                        trigger={
                          <button
                            type="button"
                            className="inline-flex min-h-11 items-center rounded-sm underline underline-offset-2 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:min-h-0"
                          >
                            Registre aqui.
                          </button>
                        }
                      />
                    </p>
                  )}
                </div>

                <div className="rounded-lg bg-muted/50 p-4 shadow-[var(--shadow-inset)]">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground mb-2">Combinados abertos</p>
                  {pendentes.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Nenhum pendente.</p>
                  ) : (
                    <ul className="space-y-1.5">
                      {pendentes.slice(0, 4).map((t) => {
                        // vencido repete a gramática do EncaminhamentosList —
                        // cor nunca é o único canal (PV-2)
                        const vencido = t.prazo != null && t.prazo < hojeStr;
                        return (
                          <li key={t.id} className="text-sm flex items-start gap-2">
                            <span
                              aria-hidden
                              className={
                                "mt-1.5 size-1.5 rounded-full shrink-0 " +
                                (vencido ? "bg-[var(--danger)]" : "bg-[var(--warn)]")
                              }
                            />
                            <span>
                              {t.descricao}
                              {t.prazo && (
                                <span
                                  className={
                                    vencido ? "font-medium text-[var(--danger)]" : "text-muted-foreground"
                                  }
                                >
                                  {" "}· até {formatDate(t.prazo)}
                                  {vencido ? " (vencido)" : ""}
                                </span>
                              )}
                            </span>
                          </li>
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
              </div>

              {/* um caminho nomeado pra ficha por card: "Abrir dupla" já mora
                  no header — aqui só saidas que a ficha não dá (o PDM é link
                  externo preenchido na dupla; o mentor edita na ficha via RPC
                  definir_pdm_url ou a coordenação no dialog de edição) */}
              {linkSeguro(dupla.pdm_url) && (
                <div className="flex flex-wrap items-center gap-3">
                  <a
                    href={linkSeguro(dupla.pdm_url)!}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={buttonVariants({ variant: "outline", size: "sm" })}
                  >
                    <BookOpen size={16} />
                    Abrir PDM
                  </a>
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
