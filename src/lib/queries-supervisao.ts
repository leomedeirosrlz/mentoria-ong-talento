import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { demoRole } from "./demo/mode";
import {
  demoMinhasDuplas,
  demoSupervisoesDaDupla,
  demoSupervisoesDaPessoa,
  demoSupervisoesRecentes,
} from "./demo/queries";
import { getMe } from "./queries";
import type { Supervisao } from "./types";

// ---------- sessões de supervisão (0041) ----------
// Leituras complementares: falha degrada pra lista vazia com log (padrão
// getComunicados/getEncerramentoDaDupla) — a seção some em vez de derrubar
// a página. O escopo é sempre o da RLS: coord lê tudo, supervisor as
// próprias + as das duplas que supervisiona, mentor as sobre ele.

/** Alvo do dialog de supervisão — uma dupla ativa/pausada que o supervisor
 *  acompanha. A sessão também pode ser "geral" (sem dupla): o que a action
 *  exige é o mentor estar numa dessas duplas. */
export type SupervisaoAlvo = {
  dupla_id: string;
  mentor_id: string;
  mentor_nome: string;
  mentorado_nome: string;
};

/** embed to-one pode voltar como array no tipo do supabase-js */
const norm = <T>(v: T | T[] | null | undefined): T | null =>
  Array.isArray(v) ? (v[0] ?? null) : (v ?? null);

const SUPERVISAO_SELECT = `
  id, supervisor_id, mentor_id, dupla_id, data, resumo, created_by, created_at,
  supervisor:profiles!supervisoes_supervisor_id_fkey(id, nome),
  mentor:profiles!supervisoes_mentor_id_fkey(id, nome),
  dupla:duplas!supervisoes_dupla_id_fkey(
    id, mentorado:mentorados!duplas_mentorado_id_fkey(nome)
  )
`;

function normSupervisao(row: Record<string, unknown>): Supervisao {
  const dupla = norm(row.dupla as Supervisao["dupla"] | Supervisao["dupla"][]);
  return {
    ...(row as unknown as Supervisao),
    supervisor: norm(row.supervisor as Supervisao["supervisor"] | Supervisao["supervisor"][]),
    mentor: norm(row.mentor as Supervisao["mentor"] | Supervisao["mentor"][]),
    dupla: dupla
      ? { ...dupla, mentorado: norm(dupla.mentorado) }
      : null,
  };
}

/** Duplas ativas/pausadas supervisionadas por mim — os selects do dialog.
 *  Só supervisor tem alvos: a policy de insert é dele; pros demais papéis
 *  volta [] e o botão nem aparece. */
export const getSupervisaoAlvos = cache(async (): Promise<SupervisaoAlvo[]> => {
  // modo demo: deriva das duplas mockadas da persona — o dialog abre e
  // mostra as opções de verdade (o submit cai no DEMO_MSG da action)
  const demo = await demoRole();
  if (demo) {
    if (demo !== "supervisor") return [];
    return demoMinhasDuplas(demo)
      .filter((d) => d.status === "ativa" || d.status === "pausada")
      .map((d) => ({
        dupla_id: d.id,
        mentor_id: d.mentor.id,
        mentor_nome: d.mentor.nome,
        mentorado_nome: d.mentorado.nome,
      }));
  }
  const me = await getMe();
  if (me?.role !== "supervisor") return [];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("duplas")
    .select(
      `id,
       mentor:profiles!duplas_mentor_id_fkey(id, nome),
       mentorado:mentorados!duplas_mentorado_id_fkey(nome)`
    )
    .eq("supervisor_id", me.id)
    .in("status", ["ativa", "pausada"])
    .order("created_at", { ascending: true });
  if (error) {
    console.error("getSupervisaoAlvos:", error);
    return [];
  }
  type Row = {
    id: string;
    mentor: { id: string; nome: string } | { id: string; nome: string }[] | null;
    mentorado: { nome: string } | { nome: string }[] | null;
  };
  return ((data ?? []) as Row[]).flatMap((d) => {
    const mentor = norm(d.mentor);
    const mentorado = norm(d.mentorado);
    return mentor && mentorado
      ? [{
          dupla_id: d.id,
          mentor_id: mentor.id,
          mentor_nome: mentor.nome,
          mentorado_nome: mentorado.nome,
        }]
      : [];
  });
});

/** Sessões mais recentes no escopo do papel — alimenta o cartão da home do
 *  supervisor (a RLS já devolve só as dele). */
export const getSupervisoesRecentes = cache(
  async (limite = 6): Promise<Supervisao[]> => {
    // modo demo: sessões da fixture no escopo do papel (RLS replicada em
    // demoSupervisoesEscopo — mentor vê as dele, supervisor as suas)
    const demo = await demoRole();
    if (demo) return demoSupervisoesRecentes(demo, limite);
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("supervisoes")
      .select(SUPERVISAO_SELECT)
      .order("data", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(limite);
    if (error) {
      console.error("getSupervisoesRecentes:", error);
      return [];
    }
    return ((data ?? []) as Record<string, unknown>[]).map(normSupervisao);
  }
);

/** Sessões da dupla + as "gerais" do mentor dela — a ficha da dupla é a
 *  superfície onde o mentor lê tudo que foi registrado sobre ele (a sessão
 *  geral aparece com o selo "sessão geral", não some por falta de vínculo). */
export const getSupervisoesDaDupla = cache(
  async (duplaId: string, mentorId: string): Promise<Supervisao[]> => {
    const demo = await demoRole();
    if (demo) return demoSupervisoesDaDupla(demo, duplaId, mentorId);
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("supervisoes")
      .select(SUPERVISAO_SELECT)
      .or(`dupla_id.eq.${duplaId},and(mentor_id.eq.${mentorId},dupla_id.is.null)`)
      .order("data", { ascending: false });
    if (error) {
      console.error("getSupervisoesDaDupla:", error);
      return [];
    }
    return ((data ?? []) as Record<string, unknown>[]).map(normSupervisao);
  }
);

/** Sessões da pessoa: conduzidas (profile de supervisor) ou recebidas
 *  (profile de mentor). A RLS escopa — quem vê a ficha de outra pessoa
 *  recebe só o que pode ler. */
export const getSupervisoesDaPessoa = cache(
  async (profileId: string): Promise<Supervisao[]> => {
    const demo = await demoRole();
    if (demo) return demoSupervisoesDaPessoa(demo, profileId);
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("supervisoes")
      .select(SUPERVISAO_SELECT)
      .or(`supervisor_id.eq.${profileId},mentor_id.eq.${profileId}`)
      .order("data", { ascending: false })
      .limit(30);
    if (error) {
      console.error("getSupervisoesDaPessoa:", error);
      return [];
    }
    return ((data ?? []) as Record<string, unknown>[]).map(normSupervisao);
  }
);
