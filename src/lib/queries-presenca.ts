import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { getCicloEventos, getCronogramas } from "./queries";
import { demoRole } from "./demo/mode";
import {
  demoPessoas,
  demoPresencas,
  demoResumoFormacao,
} from "./demo/queries";
import type { AppRole, CicloEvento, Cronograma, Presenca, Profile } from "./types";

// a collation do banco ordena acentos depois de Z — a ordenação final é
// sempre pt-BR no app (mesma convenção de queries.ts)
const porNome = (a: { nome: string }, b: { nome: string }) =>
  a.nome.localeCompare(b.nome, "pt-BR");

const ROLES_MENTOR: readonly AppRole[] = ["mentor_dpp", "mentor_especialista"];

/** Linha da chamada de formação — o mínimo que a lista precisa renderizar. */
export type MentorChamada = Pick<Profile, "id" | "nome" | "role" | "avatar_path">;

/** Mentores ativos do ciclo — a lista da chamada (só coordenação chama; a
 *  exigência de formação é dos mentores, então coord/supervisor não entram).
 *  Colunas dentro do grant público da 0026 — sem view de contato aqui. */
export const getMentoresChamada = cache(async (): Promise<MentorChamada[]> => {
  const demo = await demoRole();
  if (demo)
    return demoPessoas(demo).filter(
      (p) => p.ativo && p.role != null && ROLES_MENTOR.includes(p.role)
    );
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("id, nome, role, avatar_path")
    .in("role", ROLES_MENTOR)
    .eq("ativo", true)
    .order("nome");
  if (error) throw error;
  return ((data ?? []) as MentorChamada[]).sort(porNome);
});

/** Presenças marcadas nos eventos dados — a RLS escopa (coordenação lê tudo;
 *  a pessoa lê a própria linha; supervisor lê a dos mentores que supervisiona).
 *  A chamada consome com os ids dos eventos de formação do ciclo.
 *  Degrada pra [] com log: sem a 0040 aplicada a agenda segue de pé e a
 *  chamada simplesmente abre zerada. */
export const getPresencas = cache(
  async (eventoIds: string[]): Promise<Presenca[]> => {
    if (eventoIds.length === 0) return [];
    // modo demo: a chamada abre com a fixture marcada (chamada completa no
    // 1º dia, falta do João Pedro no 2º); marcar responde DEMO_MSG na action
    const demo = await demoRole();
    if (demo) return demoPresencas(demo, eventoIds);
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("presencas")
      .select("id, ciclo_evento_id, profile_id, presente, marcado_por, marcado_em")
      .in("ciclo_evento_id", eventoIds);
    if (error) {
      console.error("getPresencas:", error);
      return [];
    }
    return (data ?? []) as Presenca[];
  }
);

export type ResumoFormacao = {
  /** encontros de formação da turma do mentor com presença marcada */
  presentes: number;
  /** encontros de formação na turma */
  total: number;
};

/** "N de M encontros de formação" do mentor pra ficha (/pessoas/[id]) —
 *  derivado de presencas. Formação é da TURMA (0061): o denominador são os
 *  eventos 'formacao' dos cronogramas da turma do mentor (a das duplas dele
 *  — publicar a formação da T2 não pode zerar a conta de quem é da T1).
 *  Mentor em duas turmas fica com a mais recente; sem dupla, com a formação
 *  mais recente publicada. RLS: coord lê a de todos; supervisor, a dos
 *  supervisionados. */
export const getResumoFormacao = cache(
  async (profileId: string): Promise<ResumoFormacao> => {
    const demo = await demoRole();
    if (demo) return demoResumoFormacao(demo, profileId);
    const supabase = await createClient();
    // ciclo_eventos/cronogramas vêm dos getters com unstable_cache — os 2
    // selects diretos repetiam o que o cache compartilhado já resolve. O
    // catch mantém o degrade do select antigo (erro -> {0,0}, sem derrubar
    // a ficha da pessoa)
    let evs: CicloEvento[];
    let crons: Cronograma[];
    let duplasRes: { data: { cronograma_id: string | null }[] | null };
    try {
      [evs, crons, duplasRes] = await Promise.all([
        getCicloEventos().then((l) =>
          l
            .filter((e) => e.tipo === "formacao" && e.data != null)
            .sort((a, b) => (a.data ?? "").localeCompare(b.data ?? ""))
        ),
        getCronogramas(),
        supabase
          .from("duplas")
          .select("cronograma_id")
          .eq("mentor_id", profileId)
          .not("cronograma_id", "is", null),
      ]);
    } catch (err) {
      console.error("getResumoFormacao:", err);
      return { presentes: 0, total: 0 };
    }
    const turmaPorCron = new Map(crons.map((c) => [c.id, c.turma]));
    // turma do mentor: a do cronograma mais recente dentre as suas duplas
    const cronsDoMentor = new Set(
      (duplasRes.data ?? []).map((d) => d.cronograma_id as string)
    );
    const maisRecente = crons
      .filter((c) => cronsDoMentor.has(c.id))
      .sort((a, b) => (b.inicio_em ?? "").localeCompare(a.inicio_em ?? ""))[0];
    const vigente =
      maisRecente?.turma ??
      turmaPorCron.get(evs.at(-1)?.cronograma_id ?? "");
    const ids = evs
      .filter((e) => turmaPorCron.get(e.cronograma_id) === vigente)
      .map((e) => e.id);
    if (ids.length === 0) return { presentes: 0, total: 0 };
    const { data: prs, error: e2 } = await supabase
      .from("presencas")
      .select("ciclo_evento_id")
      .eq("profile_id", profileId)
      .eq("presente", true)
      .in("ciclo_evento_id", ids);
    if (e2) {
      console.error("getResumoFormacao:", e2);
      return { presentes: 0, total: ids.length };
    }
    return { presentes: prs?.length ?? 0, total: ids.length };
  }
);
