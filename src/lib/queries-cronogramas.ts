// Leituras da área /turmas (REALIZA-103) — o que /turmas precisa além do
// getCronogramas/getCicloEventos genéricos: quais duplas seguem cada
// cronograma (o selo "N duplas" da lista e a régua de segurança do editor)
// e, desde a REALIZA-200, o numero×status dos encontros da dupla — é o que
// alimenta o "N de M com encontro agendado" do bloco funcional no card v1a.
// Cacheada por request como as demais queries; demo resolvida do dataset.

import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { demoRole } from "./demo/mode";
import { getDemoData } from "./demo/data";
import type { DuplaStatus, EncontroStatus } from "./types";

/** Dupla vinculada a um cronograma — o mínimo pro contador da lista, pra
 *  lista de "quem segue" no detalhe e pro resumo da semana do encontro. */
export type VinculoCronograma = {
  duplaId: string;
  cronogramaId: string;
  status: DuplaStatus;
  mentorNome: string;
  mentoradoNome: string;
  /** numero × status dos encontros da dupla — só esses dois campos bastam
   *  pra contar "com encontro agendado" na semana vigente. */
  encontros: { numero: number | null; status: EncontroStatus }[];
};

export const getVinculosCronogramas = cache(
  async (): Promise<VinculoCronograma[]> => {
    const demo = await demoRole();
    if (demo) {
      return getDemoData()
        .duplas.filter((d) => d.cronograma_id != null)
        .map((d) => ({
          duplaId: d.id,
          cronogramaId: d.cronograma_id!,
          status: d.status,
          mentorNome: d.mentor?.nome ?? "—",
          mentoradoNome: d.mentorado?.nome ?? "—",
          encontros: (d.encontros ?? []).map((e) => ({
            numero: e.numero,
            status: e.status,
          })),
        }));
    }
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("duplas")
      .select(
        `id, cronograma_id, status,
         mentor:profiles!duplas_mentor_id_fkey(nome),
         mentorado:mentorados!duplas_mentorado_id_fkey(nome),
         encontros(numero, status)`
      )
      .not("cronograma_id", "is", null);
    if (error) throw error;
    type Row = {
      id: string;
      cronograma_id: string | null;
      status: DuplaStatus;
      mentor: { nome: string } | null;
      mentorado: { nome: string } | null;
      encontros: { numero: number | null; status: EncontroStatus }[] | null;
    };
    return ((data ?? []) as unknown as Row[])
      .filter((d) => d.cronograma_id != null)
      .map((d) => ({
        duplaId: d.id,
        cronogramaId: d.cronograma_id!,
        status: d.status,
        mentorNome: d.mentor?.nome ?? "—",
        mentoradoNome: d.mentorado?.nome ?? "—",
        encontros: d.encontros ?? [],
      }));
  }
);
