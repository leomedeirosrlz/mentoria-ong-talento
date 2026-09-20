import type { Metadata } from "next";
import { getCicloEventos, getDuplas, getMe } from "@/lib/queries";
import { eventoDaSemana, toDateStr, totalEncontros } from "@/lib/ciclo";
import { AgendaCalendario } from "@/components/agenda-calendario";

export const metadata: Metadata = { title: "Agenda do ciclo" };

export default async function AgendaPage({
  searchParams,
}: {
  searchParams: Promise<{ dia?: string }>;
}) {
  // ?dia=YYYY-MM-DD abre a agenda já no dia (deep-link da ficha/notificações)
  const { dia } = await searchParams;
  const diaInicial = dia && /^\d{4}-\d{2}-\d{2}$/.test(dia) ? dia : null;

  // getDuplas vem no escopo do RLS: mentor→a própria, supervisor→supervisionadas, coord→todas
  const [eventos, me, duplas] = await Promise.all([
    getCicloEventos(),
    getMe(),
    getDuplas(),
  ]);
  const agora = new Date();
  const hoje = toDateStr(agora);
  const semana = eventoDaSemana(eventos, agora);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Agenda do ciclo</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Ciclo 2026/2027 · {totalEncontros(eventos)} encontros das duplas, sempre às terças-feiras
          </p>
        </div>
        {semana?.numero != null && (
          <p className="mt-1.5 flex items-center gap-2 text-sm font-medium">
            <span
              aria-hidden
              className="size-2 rounded-full bg-[var(--brand-lime)]"
            />
            Semana do {semana.numero}º encontro
          </p>
        )}
      </header>

      {eventos.length === 0 ? (
        <div className="rounded-xl bg-card px-5 py-10 text-center shadow-[var(--shadow-border)]">
          <p className="text-sm text-muted-foreground">
            A agenda do ciclo ainda não foi publicada pela coordenação.
          </p>
        </div>
      ) : (
        <AgendaCalendario
          eventos={eventos}
          hoje={hoje}
          semanaId={semana?.id ?? null}
          diaInicial={diaInicial}
          duplas={duplas}
          role={me?.role ?? null}
        />
      )}
    </div>
  );
}
