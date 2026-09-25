"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { toDateStr } from "./ciclo";
import { notificar } from "./notificar";
import { demoAtivo } from "./demo/mode";
import { DEMO_MSG } from "./demo/shared";
import { erroAmigavel as erroAmigavelBase } from "./utils";

/** Erro de UI da supervisão — exceções de domínio (raise exception → P0001)
 *  já chegam em pt-BR e passam direto; o resto segue a tradução comum. */
function erroAmigavel(e: { message: string; code?: string }): string {
  if (e.code === "P0001" && e.message) return e.message;
  return erroAmigavelBase(e);
}

async function me() {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const { data } = await supabase
    .from("profiles")
    .select("id, role, nome")
    .eq("user_id", (claimsData?.claims?.sub as string) ?? "")
    .single();
  return { supabase, me: data };
}

/** Registro de sessão de supervisão (0041) — o supervisor loga a conversa
 *  com o mentor: data, resumo e opcionalmente a dupla sobre a qual falaram
 *  ("__geral"/vazio = sessão geral). O pareamento é regra de negócio —
 *  validado aqui, não em CHECK: o mentor precisa estar numa dupla ativa ou
 *  pausada que EU supervisiono (a policy garante autoria; o escopo é da
 *  aplicação). O mentor é notificado — ele lê data e resumo (transparência). */
export async function registrarSupervisao(formData: FormData) {
  if (await demoAtivo()) return { error: DEMO_MSG };
  const { supabase, me: eu } = await me();
  if (!eu) return { error: "Sessão expirada. Entre de novo." };
  if (eu.role !== "supervisor") {
    return { error: "Só o supervisor registra sessões de supervisão." };
  }

  const mentorId = String(formData.get("mentor_id") ?? "");
  const duplaRaw = String(formData.get("dupla_id") ?? "");
  const duplaId = duplaRaw && duplaRaw !== "__geral" ? duplaRaw : null;
  const data = String(formData.get("data") ?? "").trim();
  const resumo = String(formData.get("resumo") ?? "").trim();

  if (!mentorId) return { error: "Escolha o mentor da sessão." };
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(data) ||
    isNaN(new Date(`${data}T12:00:00`).getTime())
  ) {
    return { error: "Confira a data da sessão." };
  }
  // a sessão registra algo que já aconteceu — data futura não faz sentido
  if (data > toDateStr(new Date())) {
    return { error: "A data da sessão não pode ser no futuro." };
  }
  if (resumo.length < 10 || resumo.length > 4000) {
    return { error: "O resumo precisa de 10 a 4.000 caracteres." };
  }

  // elegibilidade: mentor de dupla ativa/pausada que eu supervisiono —
  // a mesma lista que alimenta os selects do dialog (getSupervisaoAlvos)
  const { data: duplasSup, error: eSup } = await supabase
    .from("duplas")
    .select(
      `id, mentorado:mentorados!duplas_mentorado_id_fkey(nome)`
    )
    .eq("supervisor_id", eu.id)
    .eq("mentor_id", mentorId)
    .in("status", ["ativa", "pausada"]);
  if (eSup) return { error: erroAmigavel(eSup) };
  const elegiveis = duplasSup ?? [];
  if (!elegiveis.length) {
    return {
      error:
        "Esse mentor não está numa dupla ativa ou pausada que você supervisiona.",
    };
  }
  let mentoradoNome: string | null = null;
  if (duplaId) {
    const d = elegiveis.find((x) => x.id === duplaId);
    if (!d) {
      return { error: "Essa dupla não é supervisionada por você." };
    }
    const md = Array.isArray(d.mentorado) ? d.mentorado[0] : d.mentorado;
    mentoradoNome = (md as { nome: string } | null | undefined)?.nome ?? null;
  }

  // supervisor_id é a autoria — a policy exige = my_profile_id(); o trigger
  // carimba created_by do token
  const { error } = await supabase.from("supervisoes").insert({
    supervisor_id: eu.id,
    mentor_id: mentorId,
    dupla_id: duplaId,
    data,
    resumo,
  });
  if (error) return { error: erroAmigavel(error) };

  // o mentor lê a sessão (transparência) — o ping fecha o ciclo; falha de
  // notificação não desfaz o registro (notificar só loga)
  const dataBr = data.split("-").reverse().join("/");
  await notificar(
    supabase,
    [
      {
        profile_id: mentorId,
        tipo: "supervisao_registrada",
        titulo: "Sessão de supervisão registrada",
        corpo: mentoradoNome
          ? `${eu.nome} registrou a supervisão de ${dataBr} sobre a dupla com ${mentoradoNome}. O resumo está na ficha da dupla.`
          : `${eu.nome} registrou a supervisão de ${dataBr} · sessão geral.`,
        href: duplaId ? `/duplas/${duplaId}` : null,
      },
    ],
    eu.id
  );

  revalidatePath("/");
  if (duplaId) revalidatePath(`/duplas/${duplaId}`);
  revalidatePath(`/pessoas/${mentorId}`);
  return { ok: true };
}

/** Moderação da coordenação — a policy garante o papel; o delete devolve a
 *  row pra revalidar a ficha da dupla e o perfil do mentor. */
export async function excluirSupervisao(id: string) {
  if (await demoAtivo()) return { error: DEMO_MSG };
  const { supabase, me: eu } = await me();
  if (!eu) return { error: "Sessão expirada. Entre de novo." };
  if (eu.role !== "coordenacao") {
    return { error: "Só a coordenação pode excluir uma sessão de supervisão." };
  }
  const { data, error } = await supabase
    .from("supervisoes")
    .delete()
    .eq("id", id)
    .select("id, dupla_id, mentor_id");
  if (error) return { error: erroAmigavel(error) };
  if (!data?.length) {
    return {
      error: "Não foi possível concluir. Recarregue a página e tente de novo.",
    };
  }
  const apagada = data[0];
  revalidatePath("/");
  if (apagada.dupla_id) revalidatePath(`/duplas/${apagada.dupla_id}`);
  if (apagada.mentor_id) revalidatePath(`/pessoas/${apagada.mentor_id}`);
  return { ok: true };
}
