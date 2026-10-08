import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { getCicloEventos, getCronogramas, getMe } from "@/lib/queries";
import { getVinculosCronogramas } from "@/lib/queries-cronogramas";
import { demoAtivo } from "@/lib/demo/mode";
import { eventosDoCronograma, formatDiaMes, rotuloCronograma } from "@/lib/ciclo";
import { PageHeader } from "@/components/page-header";
import { VoltarLink } from "@/components/voltar-link";
import {
  CronogramaAcoes,
  CronogramaDuplas,
  CronogramaEventos,
  StatusBadge,
} from "@/components/cronograma-editor";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const cronograma = (await getCronogramas()).find((c) => c.id === id);
  return { title: cronograma ? rotuloCronograma(cronograma) : "Turma" };
}

export default async function TurmaPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const me = await getMe();
  if (me?.role !== "coordenacao") redirect("/");

  const [cronogramas, eventos, vinculos, demo] = await Promise.all([
    getCronogramas(),
    getCicloEventos(),
    getVinculosCronogramas(),
    demoAtivo(),
  ]);
  const cronograma = cronogramas.find((c) => c.id === id);
  if (!cronograma) notFound();

  // o recorte é sempre por cronograma_id — a agenda e o semáforo medem a
  // dupla contra o calendário DELA; a lista global nunca se mistura
  const evs = eventosDoCronograma(eventos, id);
  const vinc = vinculos.filter((v) => v.cronogramaId === id);
  const vivas = vinc.filter(
    (v) => v.status === "ativa" || v.status === "pausada"
  ).length;
  const encontros = evs.filter((e) => e.tipo === "encontro").length;

  return (
    <div className="space-y-6">
      <PageHeader
        kicker={<VoltarLink fallback="/turmas" />}
        title={
          <>
            {rotuloCronograma(cronograma)}
            <StatusBadge status={cronograma.status} />
          </>
        }
        meta={
          cronograma.inicio_em
            ? `${formatDiaMes(cronograma.inicio_em)} → ${formatDiaMes(cronograma.fim_em)} · ${encontros} encontros oficiais · ${vinc.length === 0 ? "nenhuma dupla" : `${vinc.length} ${vinc.length === 1 ? "dupla" : "duplas"}`}`
            : `${encontros} encontros oficiais · ${vinc.length === 0 ? "nenhuma dupla" : `${vinc.length} ${vinc.length === 1 ? "dupla" : "duplas"}`}`
        }
        actions={
          <CronogramaAcoes
            cronograma={cronograma}
            vinculadas={vivas}
            totalVinculos={vinc.length}
            readOnly={demo}
          />
        }
      />

      {demo && (
        <p className="rounded-lg bg-muted/60 px-4 py-2.5 text-sm text-muted-foreground">
          Modo demonstração — este cronograma é só leitura.
        </p>
      )}

      <CronogramaDuplas vinculos={vinc} />
      <CronogramaEventos
        cronograma={cronograma}
        eventos={evs}
        vinculadas={vivas}
        readOnly={demo}
      />
    </div>
  );
}
