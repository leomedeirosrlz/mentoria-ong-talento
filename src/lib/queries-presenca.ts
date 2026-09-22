import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { demoRole } from "./demo/mode";
import {
  demoPessoas,
  demoPresencas,
  demoResumoFormacao,
} from "./demo/queries";
import type { AppRole, Presenca, Profile } from "./types";

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
  /** encontros de formação do ciclo vigente com presença marcada */
  presentes: number;
  /** encontros de formação no ciclo vigente */
  total: number;
};

/** "N de M encontros de formação" do mentor pra ficha (/pessoas/[id]) —
 *  derivado de presencas. O denominador é o ciclo vigente = o ciclo do evento
 *  de formação mais recente do calendário (evento anterior de outro ciclo não
 *  infla a conta). RLS: coord lê a de todos; supervisor, a dos supervisionados. */
export const getResumoFormacao = cache(
  async (profileId: string): Promise<ResumoFormacao> => {
    const demo = await demoRole();
    // demo: conta sobre a fixture — a agenda cobre o calendário inteiro,
    // então o "ciclo vigente" da real equivale a todos os eventos formacao
    if (demo) return demoResumoFormacao(demo, profileId);
    const supabase = await createClient();
    const { data: evs, error } = await supabase
      .from("ciclo_eventos")
      .select("id, ciclo, data")
      .eq("tipo", "formacao")
      .order("data", { ascending: true });
    if (error) {
      console.error("getResumoFormacao:", error);
      return { presentes: 0, total: 0 };
    }
    const vigente = evs?.at(-1)?.ciclo ?? null;
    const ids = (evs ?? []).filter((e) => e.ciclo === vigente).map((e) => e.id);
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
