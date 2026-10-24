import Link from "next/link";
import {
  ArrowsClockwise,
  ArrowUpRight,
  VideoCamera,
} from "@phosphor-icons/react/dist/ssr";
import type { SessaoEntrada } from "@/lib/agenda-especialista";
import {
  alvoAgendamento,
  formatDateTime,
  jornadaDaDupla,
  linkSeguro,
  passoEsp,
  passosDaTrilha,
} from "@/lib/ciclo";
import type {
  Dupla,
  Encontro,
  EspecialistaEvento,
  ExcecaoEspecialista,
  GradeJanela,
} from "@/lib/types";
import { AgendaDisponibilidade } from "@/components/agenda-disponibilidade";
import { DuplaNomes } from "@/components/dupla-nomes";
import { TrilhaJornada } from "@/components/trilha-jornada";
import { TrilhaPrazoBadge } from "@/components/trilha-prazo-badge";
import { EncerrarTrilhaDialog } from "@/components/encerrar-trilha-dialog";
import { AgendarEncontroDialog } from "@/components/agendar-encontro-dialog";
import { RegistrarRetroativoDialog } from "@/components/registrar-retroativo-dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const STATUS_LABEL: Record<Encontro["status"], string> = {
  agendado: "agendado",
  remarcado: "remarcado",
  realizado: "realizado",
  nao_aconteceu: "não aconteceu",
  cancelado: "cancelado",
};

/** Agenda da trilha especialista: sem calendário oficial — cada sessão
 *  nasce de um pedido aceito (0074), combinado pelo jovem/coord com a
 *  agenda do especialista. O que a página mostra é a disponibilidade que o
 *  especialista oferece (0073) + a fila real da dupla (agendados e
 *  realizados) + o próximo passo da trilha. */
export function AgendaEspecialista({
  duplas,
  espEventos,
  grade,
  excecoes,
  slots,
  sessoes,
  hojeIso,
  agoraMs,
}: {
  duplas: Dupla[];
  espEventos: EspecialistaEvento[];
  grade: GradeJanela[];
  excecoes: ExcecaoEspecialista[];
  slots: string[];
  /** Blocos de sessão pra grade visual — a página faz o flatten de TODAS as
   *  duplas do mentor (esp + DPP do híbrido pinta como "compromisso DPP"). */
  sessoes: SessaoEntrada[];
  /** "YYYY-MM-DD" âncora da semana que a grade desenha. */
  hojeIso: string;
  /** epoch ms do `agora` da página — jornada/fila leem o MESMO snapshot do
   *  request, não um segundo `new Date()` do RSC. */
  agoraMs: number;
}) {
  const agora = new Date(agoraMs);
  return (
    // >1 dupla: em xl os cards abrem 2 colunas, como na home do mentor — o
    // header e o card de disponibilidade cravam col-span-2 pra seguir full-width
    <div className={cn("grid gap-6", duplas.length > 1 && "xl:grid-cols-2")}>
      <header className={duplas.length > 1 ? "xl:col-span-2" : undefined}>
        <h1 className="text-2xl font-semibold tracking-tight">Agenda</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Mentoria especializada · até 5 sessões de 1h em até 3 meses. Cada
          sessão nasce de um pedido aceito — sem terça oficial.
        </p>
      </header>

      <div className={duplas.length > 1 ? "xl:col-span-2" : undefined}>
        <AgendaDisponibilidade
          grade={grade}
          excecoes={excecoes}
          slots={slots}
          sessoes={sessoes}
          hojeIso={hojeIso}
        />
      </div>

      {duplas.map((dupla) => {
        const jornada = jornadaDaDupla(
          dupla,
          passosDaTrilha("especialista", [], espEventos),
          agora
        );
        const { faltantes, cicloCompleto } = alvoAgendamento(
          dupla,
          [],
          agora
        );
        const ativa = dupla.status === "ativa";
        // a única coisa editável por aqui é a tentativa já marcada —
        // sessão nova não se cria na agenda (nasce do pedido aceito)
        const tentativaAgendada =
          dupla.encontros
            .filter((e) => e.status === "agendado" || e.status === "remarcado")
            .sort((a, b) => a.numero - b.numero)[0] ?? null;
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
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                    Mentoria especializada
                  </p>
                  <CardTitle className="mt-1 text-lg font-semibold">
                    <DuplaNomes mentor="Você" mentorado={dupla.mentorado.nome} />
                  </CardTitle>
                </div>
                <span className="flex flex-wrap items-center justify-end gap-2">
                  {/* marco de 3 meses do guia — indicador, não prazo: ao
                      completar vira warn sugerindo o fechamento */}
                  <TrilhaPrazoBadge dupla={dupla} />
                  <span className="font-mono text-sm tabular-nums text-muted-foreground">
                    {jornada.feitos}/{jornada.total} sessões
                  </span>
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
                      <LinhaEncontro
                        key={e.id}
                        e={e}
                        duplaId={dupla.id}
                        encontros={dupla.encontros}
                      />
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
                      <LinhaEncontro
                        key={e.id}
                        e={e}
                        duplaId={dupla.id}
                        encontros={dupla.encontros}
                      />
                    ))}
                  </ul>
                </div>
              )}

              {ativa && !cicloCompleto && (
                <div className="flex flex-wrap items-center gap-2 border-t border-border pt-4">
                  {tentativaAgendada ? (
                    // a tentativa existente se move — numero é o ordinal da
                    // tentativa, não o passo (0074)
                    <AgendarEncontroDialog
                      duplaId={dupla.id}
                      numero={tentativaAgendada.numero}
                      atual={tentativaAgendada}
                      piso={dupla.iniciada_em ?? undefined}
                      jovemNome={dupla.mentorado.nome.split(" ")[0]}
                      rotulo="sessão de especialista"
                    />
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      Sessão nova nasce de um pedido aceito — do jovem ou da
                      coordenação. Quando um chegar, ela aparece aqui.
                    </p>
                  )}
                  {faltantes.length > 0 && (
                    <RegistrarRetroativoDialog
                      duplaId={dupla.id}
                      faltantes={faltantes}
                      esp
                      trigger={
                        <Button variant="outline" size="sm">
                          Registrar sessão já realizada
                        </Button>
                      }
                    />
                  )}
                  {/* a conversa de horário mora na ficha — lá vivem a
                      tentativa agendada (remarcar) e o histórico */}
                  <Link
                    href={`/duplas/${dupla.id}`}
                    className={buttonVariants({ variant: "outline", size: "sm" })}
                  >
                    <ArrowsClockwise aria-hidden />
                    Propor outro horário
                  </Link>
                </div>
              )}
              {cicloCompleto && (
                <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-4">
                  <p className="text-sm text-muted-foreground">
                    {dupla.encerrada_em
                      ? "Trilha fechada. A devolutiva já seguiu pro PDM."
                      : "As 5 sessões aconteceram. Falta o fechamento com a devolutiva pro PDM."}
                  </p>
                  {!dupla.encerrada_em && (
                    <EncerrarTrilhaDialog duplaId={dupla.id} />
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

function LinhaEncontro({
  e,
  duplaId,
  encontros,
}: {
  e: Encontro;
  duplaId: string;
  /** histórico da mesma dupla — o passo do guia é o rank entre realizados
   *  (0074): sessão 3 pode cobrir o passo 2 */
  encontros: Encontro[];
}) {
  const link = linkSeguro(e.link);
  const passo = passoEsp(e, encontros);
  return (
    <li className="flex items-center gap-3 px-3 py-2.5">
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">
          Passo {passo} · sessão {e.numero}
        </span>
        <span className="block truncate text-xs text-muted-foreground">
          {STATUS_LABEL[e.status]}
          {e.data_hora ? ` · ${formatDateTime(e.data_hora)}` : " · data a definir"}
          {e.origem === "externo" && " · registrado depois"}
          {e.status === "realizado" &&
            (e.registro ? " · registro entregue" : " · registro pendente")}
        </span>
      </span>
      {link && (e.status === "agendado" || e.status === "remarcado") && (
        <a
          href={link}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-[var(--ok)]/40 bg-[var(--ok)]/10 px-2.5 text-xs font-medium text-[var(--ok-text)] transition-colors hover:bg-[var(--ok)]/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:min-h-9"
        >
          <VideoCamera size={14} aria-hidden />
          Chamada
        </a>
      )}
      <Link
        href={`/duplas/${duplaId}`}
        aria-label="Abrir a dupla"
        className="grid size-11 shrink-0 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:size-9"
      >
        <ArrowUpRight size={15} aria-hidden />
      </Link>
    </li>
  );
}
