"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { demoAtivo } from "./demo/mode";
import { DEMO_MSG } from "./demo/shared";
import { erroAmigavel as erroAmigavelBase } from "./utils";

/** Erro de UI da chamada — duplicidade e FK têm copy própria (a presença
 *  é insert-only); o resto segue a tradução comum de utils. */
function erroAmigavel(e: { message: string; code?: string }): string {
  if (e.code === "23505" || /duplicate key/i.test(e.message)) {
    return "Presença já registrada. Recarregue a página.";
  }
  if (e.code === "23503" || /foreign key/i.test(e.message)) {
    return "Evento ou pessoa não encontrados. Recarregue a página.";
  }
  return erroAmigavelBase(e);
}

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

type Supa = Awaited<ReturnType<typeof createClient>>;

/** A chamada existe só nos encontros de formação — escopo decidido: marco
 *  presencial e encontro oficial não têm lista de presença nesta versão. */
async function ehEventoFormacao(supabase: Supa, cicloEventoId: string) {
  const { data } = await supabase
    .from("ciclo_eventos")
    .select("tipo")
    .eq("id", cicloEventoId)
    .maybeSingle();
  return data?.tipo === "formacao";
}

/** Marca/desmarca a presença de uma pessoa num encontro de formação. A row
 *  fica (upsert): presente=false é ausência explícita, não esquecimento. */
export async function marcarPresenca(
  cicloEventoId: string,
  profileId: string,
  presente: boolean
) {
  if (await demoAtivo()) return { error: DEMO_MSG };
  const { supabase, me: eu } = await me();
  if (!eu) return { error: "Sessão expirada. Entre de novo." };
  if (eu.role !== "coordenacao") return { error: "Só a coordenação faz a chamada." };
  if (!(await ehEventoFormacao(supabase, cicloEventoId)))
    return { error: "A chamada só existe nos encontros de formação." };

  const { error } = await supabase.from("presencas").upsert(
    { ciclo_evento_id: cicloEventoId, profile_id: profileId, presente },
    { onConflict: "ciclo_evento_id,profile_id" }
  );
  if (error) return { error: erroAmigavel(error) };
  // /pessoas também: a cobertura completa pode ter acendido formacao_ok via
  // trigger — a badge "formação pendente" da lista depende dele
  revalidatePath("/agenda");
  revalidatePath("/pessoas");
  revalidatePath(`/pessoas/${profileId}`);
  return { ok: true };
}

/** Chamada inteira de uma vez ("marcar todas as presenças") — um upsert em
 *  lote em vez de N chamadas. `itens` é a lista completa do evento. */
export async function marcarPresencas(
  cicloEventoId: string,
  itens: { profileId: string; presente: boolean }[]
) {
  if (await demoAtivo()) return { error: DEMO_MSG };
  const { supabase, me: eu } = await me();
  if (!eu) return { error: "Sessão expirada. Entre de novo." };
  if (eu.role !== "coordenacao") return { error: "Só a coordenação faz a chamada." };
  if (itens.length === 0) return { ok: true };
  if (!(await ehEventoFormacao(supabase, cicloEventoId)))
    return { error: "A chamada só existe nos encontros de formação." };

  const { error } = await supabase.from("presencas").upsert(
    itens.map((i) => ({
      ciclo_evento_id: cicloEventoId,
      profile_id: i.profileId,
      presente: i.presente,
    })),
    { onConflict: "ciclo_evento_id,profile_id" }
  );
  if (error) return { error: erroAmigavel(error) };
  revalidatePath("/agenda");
  revalidatePath("/pessoas");
  for (const i of itens) revalidatePath(`/pessoas/${i.profileId}`);
  return { ok: true };
}
