// Leituras da área /turmas (REALIZA-103) — o que /turmas precisa além do
// getCronogramas/getCicloEventos genéricos: quais duplas seguem cada
// cronograma (o selo "N duplas" da lista e a régua de segurança do editor).
// Cacheada por request como as demais queries; demo resolvida do dataset.

import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { demoRole } from "./demo/mode";
import { getDemoData } from "./demo/data";
import type { DuplaStatus } from "./types";

/** Dupla vinculada a um cronograma — o mínimo pro contador da lista e pra
 *  lista de "quem segue" no detalhe. */
export type VinculoCronograma = {
  duplaId: string;
  cronogramaId: string;
  status: DuplaStatus;
  mentorNome: string;
  mentoradoNome: string;
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
        }));
    }
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("duplas")
      .select(
        `id, cronograma_id, status,
         mentor:profiles!duplas_mentor_id_fkey(nome),
         mentorado:mentorados!duplas_mentorado_id_fkey(nome)`
      )
      .not("cronograma_id", "is", null);
    if (error) throw error;
    type Row = {
      id: string;
      cronograma_id: string | null;
      status: DuplaStatus;
      mentor: { nome: string } | null;
      mentorado: { nome: string } | null;
    };
    return ((data ?? []) as unknown as Row[])
      .filter((d) => d.cronograma_id != null)
      .map((d) => ({
        duplaId: d.id,
        cronogramaId: d.cronograma_id!,
        status: d.status,
        mentorNome: d.mentor?.nome ?? "—",
        mentoradoNome: d.mentorado?.nome ?? "—",
      }));
  }
);
