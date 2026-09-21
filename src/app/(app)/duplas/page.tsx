import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { DownloadSimple } from "@phosphor-icons/react/dist/ssr";
import { getCicloEventos, getDuplas, getMe, getMinhasDuplas } from "@/lib/queries";
import { DuplasLista } from "@/components/duplas-lista";
import { buttonVariants } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Duplas",
};

export default async function DuplasPage() {
  const me = await getMe();
  // mentor também entra — a RLS já limita a lista às próprias duplas
  const mentor = me?.role === "mentor_dpp" || me?.role === "mentor_especialista";
  if (me?.role !== "coordenacao" && me?.role !== "supervisor" && !mentor)
    redirect("/");

  // coord vê tudo; supervisor/mentor já vêm escopados da query (uma leitura,
  // sem baixar o ciclo inteiro pra filtrar em JS)
  const [lista, eventos] = await Promise.all([
    me.role === "coordenacao" ? getDuplas() : getMinhasDuplas(),
    getCicloEventos(),
  ]);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Duplas</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {lista.length} {lista.length === 1 ? "dupla" : "duplas"} no programa 2026/2027
          </p>
        </div>
        {me.role === "coordenacao" && (
          <a
            href="/api/export"
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            <DownloadSimple />
            Exportar CSV
          </a>
        )}
      </header>

      <DuplasLista
        lista={lista}
        eventos={eventos}
        agora={new Date().toISOString()}
        podeCriar={me.role === "coordenacao"}
        mostrarSupervisor={me.role === "coordenacao"}
        paraMentor={mentor}
      />
    </div>
  );
}
