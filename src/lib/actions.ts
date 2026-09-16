"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

async function me() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("id, role")
    .eq("user_id", (await supabase.auth.getUser()).data.user?.id ?? "")
    .single();
  return { supabase, me: data };
}

// ---------- pessoas & duplas (coordenacao) ----------

export async function createPessoa(formData: FormData) {
  const { supabase } = await me();
  const role = String(formData.get("role"));
  const nome = String(formData.get("nome")).trim();
  const email = String(formData.get("email")).trim().toLowerCase();
  const whatsapp = String(formData.get("whatsapp") ?? "").trim() || null;
  if (!nome || !email) return { error: "Nome e e-mail sao obrigatorios." };

  const { data: profile, error } = await supabase
    .from("profiles")
    .insert({ nome, email, whatsapp, role })
    .select("id")
    .single();
  if (error) return { error: error.message };

  if (role === "mentor_dpp" || role === "mentor_especialista") {
    await supabase.from("mentor_profiles").insert({
      profile_id: profile.id,
      tipo: role === "mentor_dpp" ? "dpp" : "especialista",
      capacidade: Number(formData.get("capacidade") || 1),
    });
  }
  revalidatePath("/pessoas");
  return { ok: true };
}

export async function createMentorado(formData: FormData) {
  const { supabase } = await me();
  const nome = String(formData.get("nome")).trim();
  if (!nome) return { error: "Nome e obrigatorio." };
  const { error } = await supabase.from("mentorados").insert({
    nome,
    email: String(formData.get("email") ?? "").trim() || null,
    whatsapp: String(formData.get("whatsapp") ?? "").trim() || null,
    ong_origem: String(formData.get("ong_origem") ?? "").trim() || null,
    notas: String(formData.get("notas") ?? "").trim() || null,
  });
  if (error) return { error: error.message };
  revalidatePath("/pessoas");
  return { ok: true };
}

export async function createDupla(formData: FormData) {
  const { supabase } = await me();
  const mentor_id = String(formData.get("mentor_id"));
  const mentorado_id = String(formData.get("mentorado_id"));
  const supervisor_id = String(formData.get("supervisor_id") || "") || null;
  if (!mentor_id || !mentorado_id) return { error: "Escolha mentor e mentorado." };
  const { error } = await supabase.from("duplas").insert({
    mentor_id,
    mentorado_id,
    supervisor_id,
    iniciada_em: String(formData.get("iniciada_em") || "") || null,
  });
  if (error) return { error: error.message };
  revalidatePath("/duplas");
  revalidatePath("/");
  return { ok: true };
}

export async function setPessoaRole(profileId: string, role: string) {
  const { supabase } = await me();
  const { error } = await supabase.from("profiles").update({ role }).eq("id", profileId);
  if (error) return { error: error.message };
  revalidatePath("/pessoas");
  return { ok: true };
}

// ---------- encontros (mentor da dupla) ----------

export async function agendarEncontro(formData: FormData) {
  const { supabase, me: eu } = await me();
  const dupla_id = String(formData.get("dupla_id"));
  const numero = Number(formData.get("numero"));
  const data_hora = String(formData.get("data_hora"));
  const link = String(formData.get("link") ?? "").trim() || null;
  const origem = String(formData.get("origem") || "plataforma");
  if (!dupla_id || !numero || !data_hora) return { error: "Data e horario sao obrigatorios." };

  const { error } = await supabase.from("encontros").upsert(
    {
      dupla_id,
      numero,
      data_hora: new Date(data_hora).toISOString(),
      link,
      origem,
      status: "agendado",
      created_by: eu?.id,
    },
    { onConflict: "dupla_id,numero" }
  );
  if (error) return { error: error.message };
  revalidatePath("/");
  revalidatePath(`/duplas/${dupla_id}`);
  return { ok: true };
}

export async function marcarNaoAconteceu(encontroId: string, duplaId: string) {
  const { supabase } = await me();
  const { error } = await supabase
    .from("encontros")
    .update({ status: "nao_aconteceu" })
    .eq("id", encontroId);
  if (error) return { error: error.message };
  revalidatePath("/");
  revalidatePath(`/duplas/${duplaId}`);
  return { ok: true };
}

// ---------- registro (follow-up) ----------

export async function salvarRegistro(formData: FormData) {
  const { supabase, me: eu } = await me();
  const encontro_id = String(formData.get("encontro_id"));
  const dupla_id = String(formData.get("dupla_id"));
  if (!encontro_id) return { error: "Encontro invalido." };

  const { data: registro, error } = await supabase
    .from("registros")
    .upsert(
      {
        encontro_id,
        tema: String(formData.get("tema") ?? "").trim() || null,
        ferramenta: String(formData.get("ferramenta") ?? "").trim() || null,
        reflexoes: String(formData.get("reflexoes") ?? "").trim() || null,
        observacoes: String(formData.get("observacoes") ?? "").trim() || null,
        precisa_apoio: formData.get("precisa_apoio") === "on",
        created_by: eu?.id,
      },
      { onConflict: "encontro_id" }
    )
    .select("id")
    .single();
  if (error) return { error: error.message };

  await supabase.from("encontros").update({ status: "realizado" }).eq("id", encontro_id);

  // encaminhamentos novos vêm como linhas "desc|responsavel|prazo"
  const enc = formData.getAll("encaminhamento").map(String).filter(Boolean);
  if (enc.length) {
    const rows = enc.map((line) => {
      const [descricao, responsavel, prazo] = line.split("|");
      return {
        dupla_id,
        registro_id: registro.id,
        descricao,
        responsavel: responsavel === "mentor" ? "mentor" : "mentorado",
        prazo: prazo || null,
      };
    });
    await supabase.from("encaminhamentos").insert(rows);
  }

  revalidatePath("/");
  revalidatePath(`/duplas/${dupla_id}`);
  return { ok: true };
}

export async function toggleEncaminhamento(id: string, feito: boolean, duplaId: string) {
  const { supabase } = await me();
  const { error } = await supabase
    .from("encaminhamentos")
    .update({ status: feito ? "feito" : "pendente" })
    .eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/");
  revalidatePath(`/duplas/${duplaId}`);
  return { ok: true };
}

export async function resolverApoio(registroId: string, duplaId: string) {
  const { supabase } = await me();
  const { error } = await supabase
    .from("registros")
    .update({ precisa_apoio: false })
    .eq("id", registroId);
  if (error) return { error: error.message };
  revalidatePath("/");
  revalidatePath(`/duplas/${duplaId}`);
  return { ok: true };
}

// ---------- materiais ----------

export async function salvarMaterial(formData: FormData) {
  const { supabase } = await me();
  const titulo = String(formData.get("titulo")).trim();
  if (!titulo) return { error: "Titulo e obrigatorio." };
  const { error } = await supabase.from("materiais").insert({
    titulo,
    descricao: String(formData.get("descricao") ?? "").trim() || null,
    tipo: String(formData.get("tipo") || "link"),
    url: String(formData.get("url") ?? "").trim() || null,
    audiencia: String(formData.get("audiencia") || "todos"),
    encontro_num: formData.get("encontro_num") ? Number(formData.get("encontro_num")) : null,
  });
  if (error) return { error: error.message };
  revalidatePath("/materiais");
  return { ok: true };
}

// ---------- auth ----------

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
