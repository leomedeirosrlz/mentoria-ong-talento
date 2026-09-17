import { getCicloEventos } from "@/lib/queries";
import { formatDate, toDateStr } from "@/lib/ciclo";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export default async function AgendaPage() {
  const eventos = await getCicloEventos();
  const hoje = toDateStr(new Date());

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Agenda do ciclo</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Ciclo 2026/2027 · 16 encontros das duplas, sempre as tercas-feiras
        </p>
      </header>

      <div className="rounded-xl border bg-card divide-y divide-border overflow-hidden">
        {eventos.map((e) => {
          const passou = e.data < hoje;
          const corrente = e.tipo === "encontro" && e.data <= hoje && diffDias(e.data, hoje) <= 7;
          return (
            <div
              key={e.id}
              className={cn(
                "flex items-center gap-4 px-5 py-3.5",
                passou && "opacity-55",
                corrente && "bg-[var(--brand-lime)]/10"
              )}
            >
              <span className="w-24 shrink-0 font-mono text-xs text-muted-foreground">
                {formatDate(e.data)}
                {e.data_fim && ` - ${formatDate(e.data_fim)}`}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">
                  {e.numero ? `${e.numero}o encontro · ` : ""}
                  {e.titulo}
                </p>
                {e.fase && (
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {e.fase}
                    {e.instrumentos.length > 0 && ` · ${e.instrumentos.join(", ")}`}
                  </p>
                )}
              </div>
              {corrente && (
                <Badge className="bg-[var(--brand-lime)] text-[var(--primary-foreground)] shrink-0">
                  esta semana
                </Badge>
              )}
              {e.tipo === "recesso" && (
                <Badge variant="outline" className="shrink-0">recesso</Badge>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function diffDias(a: string, b: string): number {
  return Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86400000);
}
