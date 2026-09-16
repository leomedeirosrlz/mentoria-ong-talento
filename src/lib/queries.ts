import { createClient } from "@/lib/supabase/server";
import type { CicloEvento, Dupla, Material, Mentorado, Profile } from "./types";

export async function getMe(): Promise<Profile | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase.from("profiles").select("*").eq("user_id", user.id).single();
  return data;
}

export async function getCicloEventos(): Promise<CicloEvento[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("ciclo_eventos")
    .select("*")
    .order("data", { ascending: true });
  return data ?? [];
}

const DUPLA_SELECT = `
  *,
  mentor:profiles!duplas_mentor_id_fkey(*),
  mentorado:mentorados(*),
  supervisor:profiles!duplas_supervisor_id_fkey(*),
  encontros(*, registro:registros(*)),
  encaminhamentos(*)
`;

export async function getDuplas(): Promise<Dupla[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("duplas")
    .select(DUPLA_SELECT)
    .order("created_at", { ascending: true });
  return (data as unknown as Dupla[]) ?? [];
}

export async function getDupla(id: string): Promise<Dupla | null> {
  const supabase = await createClient();
  const { data } = await supabase.from("duplas").select(DUPLA_SELECT).eq("id", id).single();
  return (data as unknown as Dupla) ?? null;
}

export async function getMinhasDuplas(): Promise<Dupla[]> {
  const me = await getMe();
  if (!me) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("duplas")
    .select(DUPLA_SELECT)
    .or(`mentor_id.eq.${me.id},supervisor_id.eq.${me.id}`)
    .order("created_at", { ascending: true });
  return (data as unknown as Dupla[]) ?? [];
}

export async function getPessoas(): Promise<Profile[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("profiles").select("*").order("nome");
  return data ?? [];
}

export async function getMentorados(): Promise<Mentorado[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("mentorados").select("*").order("nome");
  return data ?? [];
}

export async function getMateriais(): Promise<Material[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("materiais")
    .select("*")
    .order("ordem", { ascending: true });
  return data ?? [];
}
