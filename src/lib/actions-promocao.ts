"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "./supabase/server";
import { demoAtivo } from "./demo/mode";
import { DEMO_MSG } from "./demo/shared";
import { erroAmigavel } from "./utils";

// Promoção de ex-mentorado a mentor (REALIZA-159). Casca fina sobre a RPC
// promover_mentorado_mentor (0112) — quem decide elegibilidade, identidade
// e papéis é o banco, na mesma transação; aqui fica a higiene dos
// parâmetros e o erro em pt-BR. Não usa setPessoaRole: aquilo gerencia
// papéis de staff sobre um profile existente, a promoção nasce da
// identidade de jovem (mentorados.profile_id) e pode CRIAR o profile.

async function me() {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const { data } = await supabase
    .from("profiles")
    .select("id, role")
    .eq("user_id", (claimsData?.claims?.sub as string) ?? "")
    .single();
  return { supabase, me: data };
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const PAPEIS_MENTOR = ["mentor_dpp", "mentor_especialista"] as const;
export type PapelMentorAlvo = (typeof PAPEIS_MENTOR)[number];

type Resultado =
  | { ok: true; profileId: string }
  | { error: string };

/** Promove um mentorado concluído a mentor de jornada (DPP, com turma de
 *  escopo) ou especialista (pool global — turma ignorada). Devolve o
 *  profile_id resultante pra UI linkar a ficha nova da pessoa. */
export async function promoverMentorado(
  mentoradoId: string,
  papel: PapelMentorAlvo,
  turma: string | null,
  obs: string | null
): Promise<Resultado> {
  if (await demoAtivo()) return { error: DEMO_MSG };
  const { supabase, me: eu } = await me();
  if (!eu) return { error: "Sessão expirada. Entre de novo." };
  if (eu.role !== "coordenacao") {
    return { error: "Só a coordenação promove ex-mentorados a mentor." };
  }
  if (!UUID_RE.test(mentoradoId)) return { error: "Mentorado inválido." };
  if (!(PAPEIS_MENTOR as readonly string[]).includes(papel)) {
    return { error: "Escolha entre mentor de jornada ou especialista." };
  }
  const escopo = papel === "mentor_dpp" ? (turma ?? "").trim() : null;
  if (papel === "mentor_dpp" && !escopo) {
    return { error: "Escolha a turma de escopo do mentor de jornada." };
  }
  if (obs && obs.length > 2000) {
    return { error: "Observação muito longa (máx. 2.000 caracteres)." };
  }

  const { data: profileId, error } = await supabase.rpc(
    "promover_mentorado_mentor",
    {
      p_mentorado_id: mentoradoId,
      p_papel: papel,
      p_turma: escopo,
      p_obs: obs?.trim() || null,
    }
  );
  if (error) {
    // raise exception da RPC chega P0001 já em pt-BR — repassa direto;
    // o resto segue a tradução comum (mesmo desenho dos actions-* irmãos)
    return {
      error:
        error.code === "P0001" && error.message
          ? error.message
          : erroAmigavel(error),
    };
  }

  revalidatePath("/pessoas");
  revalidatePath("/duplas"); // entra no pool de mentores do pareamento
  revalidatePath(`/pessoas/${mentoradoId}`);
  revalidatePath(`/pessoas/${profileId as string}`);
  return { ok: true, profileId: profileId as string };
}
