import type { Metadata } from "next";
import {
  CalendarBlank,
  CheckCircle,
  VideoCamera,
  XCircle,
} from "@phosphor-icons/react/dist/ssr";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { formatDateTime, linkSeguro } from "@/lib/ciclo";
import { getJovemEncontros } from "@/lib/queries-jovem";
import type { JovemEncontro } from "@/lib/queries-jovem";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Agenda" };

/** Agenda do jovem (REALIZA-108) — a agenda DELE: os encontros das duplas
 *  dele, lidos por projeção explícita (RLS escopa; registros/notas do mentor
 *  nunca entram). v1 é leitura: agendar pelo app é D3 — hoje o combinado de
 *  data continua saindo do papo com o mentor. */

const STATUS = {
  agendado: { rotulo: "Agendado", cls: "border-border text-muted-foreground" },
  remarcado: {
    rotulo: "Remarcado",
    cls: "border-[var(--warn)]/50 text-[var(--warn-text)]",
  },
  realizado: {
    rotulo: "Aconteceu",
    cls: "border-[var(--ok)]/50 text-[var(--ok-text)]",
  },
  nao_aconteceu: {
    rotulo: "Não aconteceu",
    cls: "border-border text-muted-foreground",
  },
  cancelado: { rotulo: "Cancelado", cls: "border-border text-muted-foreground" },
} as const;

export default async function JovemAgenda() {
  const encontros = await getJovemEncontros();
  const agora = new Date().getTime();

  // futuros = agendado/remarcado com data pra frente; o resto é histórico
  // (inclui agendado já passado — "estava marcado e não rolou" é histórico,
  // não futuro)
  const futuros = encontros
    .filter(
      (e) =>
        (e.status === "agendado" || e.status === "remarcado") &&
        e.data_hora != null &&
        new Date(e.data_hora).getTime() >= agora
    )
    .sort(
      (a, b) =>
        new Date(a.data_hora!).getTime() - new Date(b.data_hora!).getTime()
    );
  const passados = encontros
    .filter((e) => !futuros.includes(e))
    .sort(
      (a, b) =>
        new Date(b.realizado_em ?? b.data_hora ?? 0).getTime() -
        new Date(a.realizado_em ?? a.data_hora ?? 0).getTime()
    );

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Agenda</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Os encontros das suas mentorias — você e seu mentor combinam as
          datas juntos.
        </p>
      </header>

      {encontros.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2.5 py-10 text-center text-sm text-muted-foreground">
            <span className="grid size-11 place-items-center rounded-full bg-muted text-muted-foreground">
              <CalendarBlank size={18} aria-hidden />
            </span>
            <p>
              Nenhum encontro por aqui ainda. Quando a dupla marcar o
              primeiro, ele aparece nesta agenda.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {futuros.length > 0 && (
            <section aria-labelledby="agenda-proximos" className="space-y-2">
              <h2 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                Próximos
              </h2>
              <Card>
                <CardContent className="divide-y divide-border/60 p-0">
                  {futuros.map((e) => (
                    <EncontroLinha key={e.id} e={e} futuro />
                  ))}
                </CardContent>
              </Card>
            </section>
          )}
          {passados.length > 0 && (
            <section aria-labelledby="agenda-historico" className="space-y-2">
              <h2 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                Histórico
              </h2>
              <Card>
                <CardContent className="divide-y divide-border/60 p-0">
                  {passados.map((e) => (
                    <EncontroLinha key={e.id} e={e} />
                  ))}
                </CardContent>
              </Card>
            </section>
          )}
        </>
      )}
    </div>
  );
}

function EncontroLinha({ e, futuro = false }: { e: JovemEncontro; futuro?: boolean }) {
  const st = STATUS[e.status];
  const quando = e.status === "realizado" && e.realizado_em ? e.realizado_em : e.data_hora;
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-5 py-3.5">
      <span
        aria-hidden
        className={cn(
          "grid size-9 shrink-0 place-items-center rounded-full",
          e.status === "realizado"
            ? "bg-[var(--ok)]/15 text-[var(--ok-text)]"
            : e.status === "nao_aconteceu" || e.status === "cancelado"
              ? "bg-muted text-muted-foreground"
              : "bg-[var(--role-mentorado)]/25 text-[var(--brand-ink)]"
        )}
      >
        {e.status === "realizado" ? (
          <CheckCircle size={16} aria-hidden />
        ) : e.status === "nao_aconteceu" || e.status === "cancelado" ? (
          <XCircle size={16} aria-hidden />
        ) : (
          <CalendarBlank size={16} aria-hidden />
        )}
      </span>
      <div className="min-w-0 flex-1 basis-48">
        <p className="text-sm font-medium">
          {e.numero}º encontro
        </p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {quando ? formatDateTime(quando) : "data a combinar"}
        </p>
        {e.motivo_reagendamento && (
          <p className="mt-0.5 text-xs text-muted-foreground">
            Por que mudou: {e.motivo_reagendamento}
          </p>
        )}
      </div>
      <div className="ms-auto flex items-center gap-2">
        {futuro && linkSeguro(e.link) && (
          <a
            href={linkSeguro(e.link)!}
            target="_blank"
            rel="noopener noreferrer"
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            <VideoCamera size={15} aria-hidden />
            Entrar
            <span className="sr-only"> na chamada (abre em nova aba)</span>
          </a>
        )}
        <Badge variant="outline" className={st.cls}>
          {st.rotulo}
        </Badge>
      </div>
    </div>
  );
}
