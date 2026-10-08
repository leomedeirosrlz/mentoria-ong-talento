import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { CalendarBlank, Plus } from "@phosphor-icons/react/dist/ssr";
import { getCicloEventos, getCronogramas, getMe } from "@/lib/queries";
import { getVinculosCronogramas } from "@/lib/queries-cronogramas";
import { demoAtivo } from "@/lib/demo/mode";
import { eventosDoCronograma, formatDiaMes, rotuloCronograma } from "@/lib/ciclo";
import type { Cronograma } from "@/lib/types";
import { buttonVariants } from "@/components/ui/button";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/cronograma-editor";

export const metadata: Metadata = { title: "Turmas" };

/** Ordem de leitura da operação: o que está rodando primeiro, depois o que
 *  está sendo preparado, encerrados por último — dentro do grupo, turma/nome. */
const ORDEM_STATUS: Record<Cronograma["status"], number> = {
  ativo: 0,
  rascunho: 1,
  encerrado: 2,
};

export default async function TurmasPage() {
  const me = await getMe();
  if (me?.role !== "coordenacao") redirect("/");

  const [cronogramas, eventos, vinculos, demo] = await Promise.all([
    getCronogramas(),
    getCicloEventos(),
    getVinculosCronogramas(),
    demoAtivo(),
  ]);

  const ordenados = [...cronogramas].sort(
    (a, b) =>
      ORDEM_STATUS[a.status] - ORDEM_STATUS[b.status] ||
      a.turma.localeCompare(b.turma, "pt-BR") ||
      a.nome.localeCompare(b.nome, "pt-BR")
  );

  return (
    <div className="space-y-6">
      <PageHeader
        kicker="Operação"
        title="Turmas e cronogramas"
        meta="O calendário oficial de cada turma — encontros, preparação e encerramento"
        actions={
          !demo && (
            <Link
              href="/turmas/novo"
              className={buttonVariants({ variant: "default", size: "sm" })}
            >
              <Plus aria-hidden />
              Novo cronograma
            </Link>
          )
        }
      />

      {demo && (
        <p className="rounded-lg bg-muted/60 px-4 py-2.5 text-sm text-muted-foreground">
          Modo demonstração — os cronogramas de exemplo são só leitura.
        </p>
      )}

      {ordenados.length === 0 ? (
        <div className="flex flex-col items-center rounded-xl bg-card px-6 py-10 text-center shadow-[var(--shadow-border)]">
          <div className="grid size-11 place-items-center rounded-full bg-muted text-muted-foreground">
            <CalendarBlank size={18} aria-hidden />
          </div>
          <p className="mt-3 font-medium">Nenhum cronograma ainda.</p>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">
            Crie o calendário oficial da turma: os encontros do guia DPP, as
            etapas de preparação e o encerramento.
          </p>
          {!demo && (
            <Link
              href="/turmas/novo"
              className={
                buttonVariants({ variant: "outline", size: "sm" }) + " mt-4"
              }
            >
              <Plus aria-hidden />
              Criar o primeiro
            </Link>
          )}
        </div>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {ordenados.map((c) => {
            const evs = eventosDoCronograma(eventos, c.id);
            const encontros = evs.filter((e) => e.tipo === "encontro").length;
            const vinc = vinculos.filter((v) => v.cronogramaId === c.id);
            const vivas = vinc.filter(
              (v) => v.status === "ativa" || v.status === "pausada"
            ).length;
            return (
              <li key={c.id}>
                <Link
                  href={`/turmas/${c.id}`}
                  className="flex h-full flex-col rounded-xl bg-card p-4 shadow-[var(--shadow-border)] transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:p-5"
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="min-w-0 text-sm font-semibold leading-snug">
                      {rotuloCronograma(c)}
                    </p>
                    <StatusBadge status={c.status} />
                  </div>
                  <p className="mt-1.5 text-sm text-muted-foreground">
                    {c.inicio_em
                      ? `${formatDiaMes(c.inicio_em)} → ${formatDiaMes(c.fim_em)}`
                      : "Sem datas definidas"}
                  </p>
                  <p className="mt-auto pt-3 text-xs text-muted-foreground">
                    {encontros}{" "}
                    {encontros === 1 ? "encontro oficial" : "encontros oficiais"}
                    {" · "}
                    {evs.length} {evs.length === 1 ? "evento" : "eventos"}
                    {" · "}
                    {vinc.length === 0
                      ? "nenhuma dupla"
                      : `${vinc.length} ${vinc.length === 1 ? "dupla" : "duplas"}` +
                        (vivas < vinc.length ? ` (${vivas} no ciclo)` : "")}
                  </p>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
