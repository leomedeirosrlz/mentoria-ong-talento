import Link from "next/link";
import { ArrowUpRight, ClipboardText, Users, VideoCamera, Warning } from "@phosphor-icons/react/dist/ssr";
import {
  alvoAgendamento,
  eventoDaSemana,
  formatDate,
  formatDateTime,
  jornadaDaDupla,
  saudadeDaDupla,
  toDateStr,
  totalEncontros,
} from "@/lib/ciclo";
import type { CicloEvento, Dupla, Profile } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { AgendarEncontroDialog } from "@/components/agendar-encontro-dialog";
import { DuplaNomes } from "@/components/dupla-nomes";
import { RegistrarRetroativoDialog } from "@/components/registrar-retroativo-dialog";
import { TrilhaJornada } from "@/components/trilha-jornada";
import { MarcoNotifier } from "@/components/marco-notifier";

export function MentorHome({
  duplas,
  eventos,
  me,
}: {
  duplas: Dupla[];
  eventos: CicloEvento[];
  me: Profile;
}) {
  const hoje = new Date();
  const eventoSemana = eventoDaSemana(eventos, hoje);
  const total = totalEncontros(eventos);

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Olá, {me.nome.split(" ")[0]}</h1>
        {eventoSemana && (
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
            <Users
              aria-hidden
              size={32}
              weight="regular"
              className="mx-auto text-muted-foreground"
            />
            <p className="mt-3 font-medium text-foreground">
              Você ainda não está em nenhuma dupla.
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              A coordenação forma as duplas no matching.
            </p>
          </CardContent>
        </Card>
      )}

      {duplas.map((dupla) => {
        const ativa = dupla.status === "ativa";
        // saude.proximo já vem ordenado por data_hora — o find sem sort podia
        // pegar um encontro agendado mais distante que outro agendado antes
        const saude = saudadeDaDupla(dupla, eventos, hoje);
        const feitos = saude.feitos;
        const proximoAgendado = saude.proximo;
        const {
          proximoNumero, encontroAlvo, sugeridoProximo, faltantes, cicloCompleto,
        } = alvoAgendamento(dupla, eventos, hoje);
        const jornada = jornadaDaDupla(dupla, eventos, hoje);
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

        return (
          <Card key={dupla.id} className="animate-enter overflow-hidden">
            {/* -mt cobre o py do Card — o banner ink encosta no topo;
                pt devolve o respiro interno que o -mt tirou;
                overflow-hidden + rounded-t-xl já clipam os cantos */}
            <CardHeader className="-mt-(--card-spacing) border-b bg-[var(--brand-ink)] pt-(--card-spacing) text-white">
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
                  <span className="font-mono text-sm tabular-nums text-[var(--brand-lime)]">
                    {feitos}/{total} encontros
                  </span>
                  {!ativa && (
                    <span className="text-[11px] uppercase tracking-wider text-white/50">
                      {dupla.status === "pausada" ? "Pausada" : "Encerrada"}
                    </span>
                  )}
                  {/* o card todo não é link — a saída pra ficha precisa de
                      affordance própria, visível mesmo sem pendência */}
                  <Link
                    href={`/duplas/${dupla.id}`}
                    className="inline-flex min-h-11 items-center gap-1 rounded-lg px-2 text-xs font-medium text-white/70 transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-lime)] md:min-h-7"
                  >
                    Abrir dupla
                    <ArrowUpRight size={13} aria-hidden />
                  </Link>
                </div>
              </div>
            </CardHeader>

            <CardContent className="pt-5 space-y-5">
              {/* a trilha é o mapa do card inteiro — a pendência de registro
                  embaixo já explica o nó âmbar */}
              <TrilhaJornada
                jornada={jornada}
                statusDupla={dupla.status}
                inicioDupla={dupla.iniciada_em}
                duplaId={dupla.id}
              />
              <MarcoNotifier duplaId={dupla.id} feitos={jornada.feitos} total={jornada.total} />
              {semRegistro && ativa && (
                <Link
                  href={`/duplas/${dupla.id}#registrar-${semRegistro.id}`}
                  className="flex items-center gap-3 rounded-lg border border-[var(--warn)]/50 bg-[var(--warn)]/8 px-4 py-3 text-sm transition-colors hover:bg-[var(--warn)]/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                >
                  <Warning size={18} aria-hidden className="text-[var(--warn-text)] shrink-0" />
                  {semRegistro.status === "agendado" ? (
                    <span>
                      O {semRegistro.numero}º encontro estava agendado — aconteceu?{" "}
                      <span className="font-medium underline">Registre como foi</span>
                    </span>
                  ) : (
                    <span>
                      O {semRegistro.numero}º encontro aconteceu e ainda não tem registro.{" "}
                      <span className="font-medium underline">Registrar agora</span>
                    </span>
                  )}
                </Link>
              )}

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-lg bg-muted/40 p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground mb-1">Próximo encontro</p>
                  {!ativa ? (
                    <p className="font-medium text-muted-foreground">
                      {dupla.status === "pausada"
                        ? "Dupla pausada. A coordenação retoma quando for a hora."
                        : "Ciclo encerrado. Agradecemos pela jornada!"}
                    </p>
                  ) : cicloCompleto ? (
                    <p className="font-medium">{total} encontros do ciclo concluídos.</p>
                  ) : proximoAgendado ? (
                    <>
                      <p className="font-medium">
                        {proximoAgendado.numero}º · {formatDateTime(proximoAgendado.data_hora)}
                      </p>
                      {/* na hora do encontro o link da chamada é a ação nº1 —
                          chip próprio, não texto corrido (mesmo fix do CC-1) */}
                      {proximoAgendado.link && (
                        <a
                          href={proximoAgendado.link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-2 inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-[var(--ok)]/40 bg-[var(--ok)]/10 px-2.5 text-sm font-medium text-[var(--ok-text)] transition-colors hover:bg-[var(--ok)]/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:min-h-7"
                        >
                          <VideoCamera size={16} aria-hidden />
                          Entrar na chamada
                          <span className="sr-only"> (abre em nova aba)</span>
                        </a>
                      )}
                    </>
                  ) : encontroAlvo ? (
                    // a row existe mas o horário já passou ou não aconteceu —
                    // nunca "ainda não agendado"
                    <>
                      <p className="font-medium">
                        {encontroAlvo.numero}º · {formatDateTime(encontroAlvo.data_hora)}
                      </p>
                      <p className="text-sm text-muted-foreground mt-0.5">
                        {encontroAlvo.status === "nao_aconteceu"
                          ? "não aconteceu — remarque quando puder"
                          : "já passou — registre como foi ou remarque"}
                      </p>
                    </>
                  ) : (
                    <>
                      {/* "encontro" não repete — o rótulo do bloco já é
                          "Próximo encontro" (mesma elipse do "nº · data") */}
                      <p className="font-medium">{proximoNumero}º ainda não agendado</p>
                      <p className="text-sm text-muted-foreground mt-0.5">
                        sugerido: {sugeridoProximo ? formatDate(sugeridoProximo) : "a combinar"}
                      </p>
                    </>
                  )}
                  {ativa && !cicloCompleto && (
                    <div className="mt-3">
                      <AgendarEncontroDialog
                        duplaId={dupla.id}
                        numero={proximoNumero}
                        atual={encontroAlvo}
                        sugerido={sugeridoProximo}
                        piso={dupla.iniciada_em ?? undefined}
                      />
                    </div>
                  )}
                  {ativa && faltantes.length > 0 && (
                    <p className="mt-3 text-xs text-muted-foreground">
                      Encontraram-se sem agendar?{" "}
                      <RegistrarRetroativoDialog
                        duplaId={dupla.id}
                        faltantes={faltantes}
                        trigger={
                          <button
                            type="button"
                            className="rounded-sm underline underline-offset-2 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          >
                            Registre aqui.
                          </button>
                        }
                      />
                    </p>
                  )}
                </div>

                <div className="rounded-lg bg-muted/40 p-4">
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
                            href={`/duplas/${dupla.id}#encaminhamentos`}
                            className="flex min-h-11 items-center gap-2 rounded-md text-sm font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:min-h-8"
                          >
                            <span aria-hidden className="size-1.5 shrink-0 rounded-full bg-muted-foreground/40" />
                            +{pendentes.length - 4} mais — ver todos
                          </Link>
                        </li>
                      )}
                    </ul>
                  )}
                </div>
              </div>

              {/* navegação secundária — fecha o fluxo de leitura sem disputar
                  o lime com o próximo passo (agendar / registrar / chamada) */}
              <div className="flex items-center gap-3">
                <Link
                  href={`/duplas/${dupla.id}`}
                  className={buttonVariants({ variant: "outline", size: "sm" })}
                >
                  <ClipboardText size={16} />
                  Ver histórico da dupla
                </Link>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
