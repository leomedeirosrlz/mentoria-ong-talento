import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { getCicloEventos, getCronogramas, getMe } from "@/lib/queries";
import { getVinculosCronogramas } from "@/lib/queries-cronogramas";
import { demoAtivo } from "@/lib/demo/mode";
import { eventosDoCronograma, formatDiaMes, rotuloCronograma } from "@/lib/ciclo";
import { turmaAno, turmaLonga } from "@/lib/turma";
import { VoltarLink } from "@/components/voltar-link";
import {
  linhaDadosTurma,
  SiglaTurma,
  TurmaBanner,
} from "@/components/turma-card";
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
  // "Turma 1 · Calendário oficial" — a forma narrativa (rotuloCronograma já
  // passa pela gramática canônica, nunca o cru "T1 · 2026/2027")
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
  const hoje = new Date();
  const ano = turmaAno(cronograma.turma);

  return (
    <div className="space-y-6">
      <VoltarLink fallback="/turmas" />

      {/* perfil da turma — a mesma capa de identidade do card (REALIZA-200):
          banner ink + nome canônico + metadados; o nome do calendário fica
          na linha de meta porque a entidade exibida é a turma */}
      <section className="animate-enter overflow-hidden rounded-xl bg-card shadow-[var(--shadow-border)]">
        <TurmaBanner
          cronograma={cronograma}
          dados={linhaDadosTurma(cronograma, evs, hoje)}
        />
        <div className="flex flex-wrap items-start justify-between gap-3 px-4 py-4 sm:px-6 sm:py-5">
          <div className="min-w-0">
            <h1 className="flex flex-wrap items-center gap-x-2 gap-y-1 text-2xl font-bold tracking-tight">
              {turmaLonga(cronograma.turma)}
              <SiglaTurma turma={cronograma.turma} />
              <StatusBadge status={cronograma.status} />
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {cronograma.nome}
              {ano && ` · Ciclo ${ano}`}
              {cronograma.inicio_em
                ? ` · ${formatDiaMes(cronograma.inicio_em)} → ${formatDiaMes(cronograma.fim_em)}`
                : " · sem datas definidas"}
              {` · ${encontros} ${encontros === 1 ? "encontro oficial" : "encontros oficiais"} · `}
              {vinc.length === 0
                ? "nenhuma dupla"
                : `${vinc.length} ${vinc.length === 1 ? "dupla" : "duplas"}`}
            </p>
          </div>
          <CronogramaAcoes
            cronograma={cronograma}
            vinculadas={vivas}
            totalVinculos={vinc.length}
            readOnly={demo}
          />
        </div>
      </section>

      {demo && (
        <p className="rounded-lg bg-muted/60 px-4 py-2.5 text-sm text-muted-foreground">
          Modo demonstração: este cronograma é só leitura.
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
