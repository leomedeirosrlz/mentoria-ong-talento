"use server";

// Actions do pareamento semântico (REALIZA-338) — o que o client precisa
// do matching_perfis: a ORDEM dos candidatos (nunca a similaridade
// crua) e os temas canônicos de cada lado (a camada explicável do card).
// Coord-only duas vezes: a action checa o papel e a policy da tabela só
// libera SELECT pra coordenação — fora dela a RPC devolve [], o que a
// UI trata como "sem vetores" e segue na ordem determinística.

import { createClient } from "@/lib/supabase/server";
import { demoAtivo } from "./demo/mode";
import type { DonoTipo } from "./matching";

type Supa = Awaited<ReturnType<typeof createClient>>;

async function meCoord(supabase: Supa) {
  const { data: claimsData } = await supabase.auth.getClaims();
  const { data } = await supabase
    .from("profiles")
    .select("id, role, profile_papeis(papel)")
    .eq("user_id", (claimsData?.claims?.sub as string) ?? "")
    .single();
  const papeis = new Set(
    [data?.role, ...(data?.profile_papeis ?? []).map((r) => r.papel)].filter(
      Boolean
    )
  );
  return papeis.has("coordenacao") ? data : null;
}

export type RankCandidato = { id: string; similaridade: number };

/** Ranking semântico do pool oposto pra pessoa selecionada no Parear.
 *  Devolve só ids + score pra ordenação/selo — doc e vetor ficam no
 *  banco. Falha/ausência vira rank vazio (a coluna fica na ordem atual). */
export async function ranquearCandidatosMatching(
  tipo: DonoTipo,
  id: string
): Promise<{ rank: RankCandidato[] }> {
  if (await demoAtivo()) return { rank: [] };
  const supabase = await createClient();
  if (!(await meCoord(supabase))) return { rank: [] };
  const outroTipo = tipo === "mentor" ? "mentorado" : "mentor";
  const { data, error } = await supabase.rpc("matching_ranquear", {
    p_tipo: tipo,
    p_id: id,
    p_outro_tipo: outroTipo,
  });
  if (error) return { rank: [] };
  return {
    rank: (data ?? []).map((r: { dono_id: string; similaridade: number }) => ({
      id: r.dono_id,
      similaridade: r.similaridade,
    })),
  };
}

/** Temas canônicos dos dois lados selecionados — insumo do "temas em
 *  comum" do card de afinidade. */
export async function temasMatchingPar(
  mentorId: string,
  mentoradoId: string
): Promise<{ mentor: string[]; mentorado: string[] }> {
  const vazio: { mentor: string[]; mentorado: string[] } = {
    mentor: [],
    mentorado: [],
  };
  if (await demoAtivo()) return vazio;
  const supabase = await createClient();
  if (!(await meCoord(supabase))) return vazio;
  const { data, error } = await supabase
    .from("matching_perfis")
    .select("dono_tipo, temas")
    .in("dono_tipo", ["mentor", "mentorado"])
    .in(
      "dono_id",
      [mentorId, mentoradoId].filter(Boolean)
    );
  if (error) return vazio;
  const porTipo = new Map(
    (data ?? []).map((r: { dono_tipo: string; temas: string[] }) => [
      r.dono_tipo,
      r.temas ?? [],
    ])
  );
  // duas linhas podem existir pro mesmo dono_id em tipos distintos — o
  // filtro por tipo garante o par certo mesmo com ids iguais entre
  // profiles e mentorados (improvável, mas o map por tipo fecha a porta)
  return {
    mentor: (porTipo.get("mentor") as string[] | undefined) ?? [],
    mentorado: (porTipo.get("mentorado") as string[] | undefined) ?? [],
  };
}
