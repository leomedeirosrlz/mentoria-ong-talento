import Link from "next/link";
import { ArrowUpRight } from "@phosphor-icons/react/dist/ssr";
import {
  alvoAgendamento,
  formatDateTime,
  jornadaDaDupla,
  linkSeguro,
  passosDaTrilha,
} from "@/lib/ciclo";
import type { Dupla, Encontro, EspecialistaEvento } from "@/lib/types";
import { DuplaNomes } from "@/components/dupla-nomes";
import { TrilhaJornada } from "@/components/trilha-jornada";
import { AgendarEncontroDialog } from "@/components/agendar-encontro-dialog";
import { RegistrarRetroativoDialog } from "@/components/registrar-retroativo-dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { VideoCamera } from "@phosphor-icons/react/dist/ssr";

const STATUS_LABEL: Record<Encontro["status"], string> = {
  agendado: "agendado",
  remarcado: "remarcado",
  realizado: "realizado",
  nao_aconteceu: "não aconteceu",
  cancelado: "cancelado",
};

/** Agenda da trilha especialista: sem calendário oficial — os encontros são
 *  combinados pela dupla dentro dos ~3 meses. O que a página mostra é a fila
 *  real da dupla (agendados e realizados) + o próximo passo da trilha. */
export function AgendaEspecialista({
  duplas,
  espEventos,
}: {
  duplas: Dupla[];
  espEventos: EspecialistaEvento[];
}) {
  const agora = new Date();
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Agenda</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Mentoria especializada · até 5 encontros de 1h em até 3 meses — as
          datas são combinadas por vocês, sem terça oficial.
        </p>
      </header>

      {duplas.map((dupla) => {
        const jornada = jornadaDaDupla(
          dupla,
          passosDaTrilha("especialista", [], espEventos),
          agora
        );
        const { proximoNumero, encontroAlvo, faltantes, cicloCompleto } =
          alvoAgendamento(dupla, [], agora);
        const ativa = dupla.status === "ativa";
        // fila cronológica: próximos primeiro (os já passados ficam abaixo,
        // mais recente primeiro — é o histórico, não a fila)
        const porVir = dupla.encontros
          .filter(
            (e) =>
              (e.status === "agendado" || e.status === "remarcado") &&
              e.data_hora != null &&
              e.data_hora >= agora.toISOString()
          )
          .sort((a, b) => (a.data_hora ?? "").localeCompare(b.data_hora ?? ""));
        const passados = dupla.encontros
          .filter((e) => !porVir.includes(e))
          .sort((a, b) => (b.data_hora ?? "").localeCompare(a.data_hora ?? ""));

        return (
          <Card key={dupla.id} className="animate-enter overflow-hidden">
            <CardHeader className="border-b bg-muted/30">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                    Mentoria especializada
                  </p>
                  <CardTitle className="mt-1 text-lg font-semibold">
                    <DuplaNomes mentor="Você" mentorado={dupla.mentorado.nome} />
                  </CardTitle>
                </div>
                <span className="font-mono text-sm tabular-nums text-muted-foreground">
                  {jornada.feitos}/{jornada.total} encontros
                </span>
              </div>
            </CardHeader>
            <CardContent className="space-y-5 pt-5">
              <TrilhaJornada
                jornada={jornada}
                statusDupla={dupla.status}
                inicioDupla={dupla.iniciada_em}
                duplaId={dupla.id}
              />

              {porVir.length > 0 && (
                <div>
                  <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                    Próximos
                  </p>
                  <ul className="divide-y divide-border rounded-lg border border-border">
                    {porVir.map((e) => (
                      <LinhaEncontro key={e.id} e={e} duplaId={dupla.id} />
                    ))}
                  </ul>
                </div>
              )}

              {passados.length > 0 && (
                <div>
                  <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                    Já passaram
                  </p>
                  <ul className="divide-y divide-border rounded-lg border border-border">
                    {passados.map((e) => (
                      <LinhaEncontro key={e.id} e={e} duplaId={dupla.id} />
                    ))}
                  </ul>
                </div>
              )}

              {ativa && !cicloCompleto && (
                <div className="flex flex-wrap items-center gap-2 border-t border-border pt-4">
                  <AgendarEncontroDialog
                    duplaId={dupla.id}
                    numero={proximoNumero}
                    atual={encontroAlvo}
                    piso={dupla.iniciada_em ?? undefined}
                  />
                  {faltantes.length > 0 && (
                    <RegistrarRetroativoDialog
                      duplaId={dupla.id}
                      faltantes={faltantes}
                      trigger={
                        <Button variant="outline" size="sm">
                          Registrar encontro já realizado
                        </Button>
                      }
                    />
                  )}
                </div>
              )}
              {cicloCompleto && (
                <p className="border-t border-border pt-4 text-sm text-muted-foreground">
                  Jornada concluída — os 5 encontros foram realizados.
                </p>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

function LinhaEncontro({ e, duplaId }: { e: Encontro; duplaId: string }) {
  const link = linkSeguro(e.link);
  return (
    <li className="flex items-center gap-3 px-3 py-2.5">
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">
          {e.numero}º encontro
        </span>
        <span className="block truncate text-xs text-muted-foreground">
          {STATUS_LABEL[e.status]}
          {e.data_hora ? ` · ${formatDateTime(e.data_hora)}` : " · data a definir"}
          {e.status === "realizado" &&
            (e.registro ? " · registro entregue" : " · registro pendente")}
        </span>
      </span>
      {link && (e.status === "agendado" || e.status === "remarcado") && (
        <a
          href={link}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-[var(--ok)]/40 bg-[var(--ok)]/10 px-2.5 text-xs font-medium text-[var(--ok-text)] transition-colors hover:bg-[var(--ok)]/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <VideoCamera size={14} aria-hidden />
          Chamada
        </a>
      )}
      <Link
        href={`/duplas/${duplaId}`}
        aria-label="Abrir a dupla"
        className="grid size-9 shrink-0 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <ArrowUpRight size={15} aria-hidden />
      </Link>
    </li>
  );
}
