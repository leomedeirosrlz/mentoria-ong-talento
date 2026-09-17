import Link from "next/link";
import { CalendarPlus, CheckCircle, ClipboardText, Warning } from "@phosphor-icons/react/dist/ssr";
import { eventoDaSemana, formatDate, formatDateTime, toDateStr } from "@/lib/ciclo";
import type { CicloEvento, Dupla, Profile } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AgendarEncontroDialog } from "@/components/agendar-encontro-dialog";

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
  const esperado = eventos.filter((e) => e.tipo === "encontro" && e.data <= toDateStr(hoje)).length;

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Ola, {me.nome.split(" ")[0]}</h1>
        {eventoSemana && (
          <p className="text-sm text-muted-foreground mt-1">
            Semana do <span className="font-medium text-foreground">{eventoSemana.numero}o encontro</span>
            {eventoSemana.fase ? ` · ${eventoSemana.fase}` : ""}
          </p>
        )}
      </header>

      {duplas.length === 0 && (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            Voce ainda nao esta em nenhuma dupla. A coordenacao forma as duplas no matching.
          </CardContent>
        </Card>
      )}

      {duplas.map((dupla) => {
        const feitos = dupla.encontros.filter((e) => e.status === "realizado").length;
        const proximoNumero = Math.min(feitos + 1, 16);
        const proximoAgendado = dupla.encontros.find(
          (e) => e.status === "agendado" && e.data_hora && new Date(e.data_hora) >= hoje
        );
        const semRegistro = dupla.encontros.find((e) => e.status === "realizado" && !e.registro);
        const pendentes = dupla.encaminhamentos.filter((t) => t.status === "pendente");
        const eventoProximo = eventos.find((e) => e.tipo === "encontro" && e.numero === proximoNumero);

        return (
          <Card key={dupla.id} className="overflow-hidden">
            <CardHeader className="border-b bg-[var(--brand-ink)] text-white">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.14em] text-white/50">Sua dupla</p>
                  <CardTitle className="text-lg mt-1">Voce e {dupla.mentorado.nome}</CardTitle>
                </div>
                <span className="font-mono text-sm text-[var(--brand-lime)]">
                  {feitos}/16 encontros
                </span>
              </div>
            </CardHeader>

            <CardContent className="pt-5 space-y-5">
              {semRegistro && (
                <Link
                  href={`/duplas/${dupla.id}#registrar-${semRegistro.id}`}
                  className="flex items-center gap-3 rounded-lg border border-[var(--warn)]/50 bg-[var(--warn)]/8 px-4 py-3 text-sm transition-colors hover:bg-[var(--warn)]/15"
                >
                  <Warning size={18} className="text-[var(--warn)] shrink-0" />
                  <span>
                    O {semRegistro.numero}o encontro aconteceu e ainda nao tem registro.{" "}
                    <span className="font-medium underline">Registrar agora</span>
                  </span>
                </Link>
              )}

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-lg border p-4">
                  <p className="text-xs text-muted-foreground mb-1">Proximo encontro</p>
                  {proximoAgendado ? (
                    <>
                      <p className="font-medium">
                        {proximoAgendado.numero}o · {formatDateTime(proximoAgendado.data_hora)}
                      </p>
                      {proximoAgendado.link && (
                        <a
                          href={proximoAgendado.link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-[oklch(0.55_0.12_165)] underline"
                        >
                          Abrir link da chamada
                        </a>
                      )}
                    </>
                  ) : (
                    <>
                      <p className="font-medium">{proximoNumero}o encontro ainda nao agendado</p>
                      <p className="text-sm text-muted-foreground mt-0.5">
                        sugerido: {eventoProximo ? formatDate(eventoProximo.data) : "a combinar"}
                      </p>
                    </>
                  )}
                  <div className="mt-3">
                    <AgendarEncontroDialog
                      duplaId={dupla.id}
                      numero={proximoAgendado?.numero ?? proximoNumero}
                      atual={proximoAgendado ?? null}
                    />
                  </div>
                </div>

                <div className="rounded-lg border p-4">
                  <p className="text-xs text-muted-foreground mb-2">Encaminhamentos abertos</p>
                  {pendentes.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Nenhum pendente.</p>
                  ) : (
                    <ul className="space-y-1.5">
                      {pendentes.slice(0, 4).map((t) => (
                        <li key={t.id} className="text-sm flex items-start gap-2">
                          <span
                            className={
                              "mt-1.5 size-1.5 rounded-full shrink-0 " +
                              (t.prazo && t.prazo < toDateStr(hoje) ? "bg-[var(--danger)]" : "bg-[var(--brand-amber)]")
                            }
                          />
                          <span>
                            {t.descricao}
                            {t.prazo && (
                              <span className="text-muted-foreground"> · ate {formatDate(t.prazo)}</span>
                            )}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Link
                  href={`/duplas/${dupla.id}`}
                  className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-transform active:translate-y-px"
                >
                  <ClipboardText size={16} />
                  Ver timeline da dupla
                </Link>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
