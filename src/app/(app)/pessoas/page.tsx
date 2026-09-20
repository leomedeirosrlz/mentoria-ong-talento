import { redirect } from "next/navigation";
import type { Metadata } from "next";
import {
  getDuplasResumo,
  getDuplasResumoTodas,
  getMe,
  getMentorados,
  getMentorProfiles,
  getPessoas,
  type MentorProfile,
} from "@/lib/queries";
import { NovaPessoaDialog, NovoMentoradoDialog } from "@/components/pessoas-dialogs";
import { ImportarCsvDialog } from "@/components/importar-csv-dialog";
import { PessoasListas } from "@/components/pessoas-listas";

export const metadata: Metadata = {
  title: "Pessoas · Realiza.vc",
};

export default async function PessoasPage() {
  const me = await getMe();
  if (me?.role !== "coordenacao") redirect("/");

  const [pessoas, mentorados, duplas, todasDuplas, perfisMentor] = await Promise.all([
    getPessoas(),
    getMentorados(),
    getDuplasResumo(),
    getDuplasResumoTodas(),
    getMentorProfiles(),
  ]);

  const comDupla = new Set(
    duplas
      .flatMap((d) => [d.mentor_id, d.mentorado_id, d.supervisor_id])
      .filter((id): id is string => Boolean(id))
  );

  // delete guard: servidor bloqueia qualquer dupla (inclusive encerrada)
  const comQualquerDupla = new Set(
    todasDuplas
      .flatMap((d) => [d.mentor_id, d.mentorado_id, d.supervisor_id])
      .filter((id): id is string => Boolean(id))
  );

  // matching board: vagas ocupadas por mentor (duplas não-encerradas)
  // e capacidade/prontidão de cada um, indexados por profile_id
  const contagemPorMentor: Record<string, number> = {};
  for (const d of duplas) {
    contagemPorMentor[d.mentor_id] = (contagemPorMentor[d.mentor_id] ?? 0) + 1;
  }
  const mentorProfiles: Record<string, MentorProfile> = {};
  for (const mp of perfisMentor) {
    mentorProfiles[mp.profile_id] = mp;
  }

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Pessoas</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Mentores, supervisores e equipe com acesso à plataforma
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <ImportarCsvDialog />
          <NovoMentoradoDialog />
          <NovaPessoaDialog />
        </div>
      </header>

      <PessoasListas
        pessoas={pessoas}
        mentorados={mentorados}
        comDupla={[...comDupla]}
        comQualquerDupla={[...comQualquerDupla]}
        mentorProfiles={mentorProfiles}
        contagemPorMentor={contagemPorMentor}
      />
    </div>
  );
}
