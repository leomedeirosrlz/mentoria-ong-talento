import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { CalendarBlank } from "@phosphor-icons/react/dist/ssr";
import { getCicloEventos, getCronogramas, getMe } from "@/lib/queries";
import { demoAtivo } from "@/lib/demo/mode";
import { PageHeader } from "@/components/page-header";
import { VoltarLink } from "@/components/voltar-link";
import { CronogramaBuilder } from "@/components/cronograma-builder";

export const metadata: Metadata = { title: "Nova turma" };

export default async function NovaTurmaPage() {
  const me = await getMe();
  if (me?.role !== "coordenacao") redirect("/");

  const demo = await demoAtivo();
  const [cronogramas, eventos] = await Promise.all([
    getCronogramas(),
    getCicloEventos(),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        kicker={<VoltarLink fallback="/turmas" />}
        title="Nova turma"
        meta="Monte o calendário oficial: parâmetros primeiro, prévia editável antes de gravar"
      />

      {demo ? (
        <div className="flex flex-col items-center rounded-xl bg-card px-6 py-10 text-center shadow-[var(--shadow-border)]">
          <div className="grid size-11 place-items-center rounded-full bg-muted text-muted-foreground">
            <CalendarBlank size={18} aria-hidden />
          </div>
          <p className="mt-3 font-medium">A demo é só leitura.</p>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">
            No ambiente real o builder gera o calendário oficial da turma — os
            encontros, a preparação e o encerramento — editável antes de gravar.
          </p>
        </div>
      ) : (
        <CronogramaBuilder cronogramas={cronogramas} eventos={eventos} />
      )}
    </div>
  );
}
