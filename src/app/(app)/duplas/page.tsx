import Link from "next/link";
import { redirect } from "next/navigation";
import { getCicloEventos, getDuplas, getMe } from "@/lib/queries";
import { saudadeDaDupla } from "@/lib/ciclo";
import { SemaforoDot } from "@/components/semaforo";
import { NovaDuplaDialog } from "@/components/nova-dupla-dialog";

export default async function DuplasPage() {
  const me = await getMe();
  if (me?.role !== "coordenacao" && me?.role !== "supervisor") redirect("/");

  const [duplas, eventos] = await Promise.all([getDuplas(), getCicloEventos()]);

  const lista =
    me.role === "supervisor" ? duplas.filter((d) => d.supervisor?.id === me.id) : duplas;

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Duplas</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {lista.length} dupla(s) no ciclo 2026/2027
          </p>
        </div>
        {me.role === "coordenacao" && <NovaDuplaDialog />}
      </header>

      <div className="rounded-xl border bg-card divide-y divide-border overflow-hidden">
        {lista.length === 0 && (
          <p className="py-10 text-center text-sm text-muted-foreground">
            Nenhuma dupla formada ainda.
          </p>
        )}
        {lista.map((d) => {
          const saude = saudadeDaDupla(d, eventos);
          const feitos = d.encontros.filter((e) => e.status === "realizado").length;
          return (
            <Link
              key={d.id}
              href={`/duplas/${d.id}`}
              className="flex items-center gap-4 px-5 py-4 transition-colors hover:bg-muted/50"
            >
              <SemaforoDot nivel={saude.semaforo} />
              <div className="min-w-0 flex-1">
                <p className="font-medium truncate">
                  {d.mentor.nome} <span className="text-muted-foreground font-normal">e</span>{" "}
                  {d.mentorado.nome}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {d.supervisor ? `Supervisor: ${d.supervisor.nome} · ` : ""}
                  {saude.motivo}
                </p>
              </div>
              <span className="font-mono text-xs text-muted-foreground shrink-0">
                {feitos}/16
              </span>
              <span className="text-xs text-muted-foreground capitalize shrink-0 w-16 text-right">
                {d.status}
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
