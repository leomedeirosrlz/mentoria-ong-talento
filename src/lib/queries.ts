import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { CicloEvento, Comunicado, Dupla, DuplaResumo, DuplaStatus, Material, Mentorado, Notificacao, PessoaNota, Profile } from "./types";

// getClaims valida o JWT localmente (sem round-trip); RLS segue valendo no banco.
export const getMe = cache(async (): Promise<Profile | null> => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const sub = data?.claims?.sub;
  if (!sub) return null;
  // maybeSingle: profile ainda não criado (ou removido) -> null -> layout manda pro login
  const { data: profile, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("user_id", sub)
    .maybeSingle();
  if (error) throw error;
  return profile;
});

export const getCicloEventos = cache(async (): Promise<CicloEvento[]> => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("ciclo_eventos")
    .select("*")
    .order("data", { ascending: true });
  if (error) throw error;
  return data ?? [];
});

const DUPLA_SELECT = `
  *,
  mentor:profiles!duplas_mentor_id_fkey(*),
  mentorado:mentorados(*),
  supervisor:profiles!duplas_supervisor_id_fkey(*),
  encontros(*, registro:registros(*, autor:profiles!registros_created_by_fkey(nome))),
  encaminhamentos(*),
  notas:encontro_notas(*)
`;

export const getDuplas = cache(async (): Promise<Dupla[]> => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("duplas")
    .select(DUPLA_SELECT)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data as unknown as Dupla[]) ?? [];
});

export const getDupla = cache(async (id: string): Promise<Dupla | null> => {
  const supabase = await createClient();
  // maybeSingle: id inexistente -> null -> page chama notFound()
  const { data, error } = await supabase
    .from("duplas")
    .select(DUPLA_SELECT)
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return (data as unknown as Dupla) ?? null;
});

export const getMinhasDuplas = cache(async (): Promise<Dupla[]> => {
  const me = await getMe();
  if (!me) return [];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("duplas")
    .select(DUPLA_SELECT)
    .or(`mentor_id.eq.${me.id},supervisor_id.eq.${me.id}`)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data as unknown as Dupla[]) ?? [];
});

/** Só os vínculos — pra checar "está em dupla" sem arrastar encontros/registros. */
export const getDuplasResumo = cache(async (): Promise<DuplaResumo[]> => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("duplas")
    .select("id,mentor_id,mentorado_id,supervisor_id")
    .neq("status", "encerrada");
  if (error) throw error;
  return data ?? [];
});

/** Vínculos de qualquer status (inclusive encerrada) — espelha a guarda de
 *  exclusão das actions, que bloqueia pessoa/mentorado com QUALQUER dupla. */
export const getDuplasResumoTodas = cache(async (): Promise<DuplaResumo[]> => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("duplas")
    .select("id,mentor_id,mentorado_id,supervisor_id");
  if (error) throw error;
  return data ?? [];
});

/** Só a contagem (head: true, sem rows) — alimenta o checklist de setup da home. */
export const getContagemPessoas = cache(async (): Promise<number> => {
  const supabase = await createClient();
  const [profiles, mentorados] = await Promise.all([
    supabase.from("profiles").select("*", { count: "exact", head: true }),
    supabase.from("mentorados").select("*", { count: "exact", head: true }),
  ]);
  if (profiles.error) throw profiles.error;
  if (mentorados.error) throw mentorados.error;
  return (profiles.count ?? 0) + (mentorados.count ?? 0);
});

// a collation do banco ordena acentos depois de Z (Álvaro no fim da lista) —
// a ordenação final é sempre pt-BR no app
const porNome = (a: { nome: string }, b: { nome: string }) =>
  a.nome.localeCompare(b.nome, "pt-BR");

export const getPessoas = cache(async (): Promise<Profile[]> => {
  const supabase = await createClient();
  const { data, error } = await supabase.from("profiles").select("*").order("nome");
  if (error) throw error;
  return (data ?? []).sort(porNome);
});

export const getMentorados = cache(async (): Promise<Mentorado[]> => {
  const supabase = await createClient();
  const { data, error } = await supabase.from("mentorados").select("*").order("nome");
  if (error) throw error;
  return (data ?? []).sort(porNome);
});

/** Card de dupla na página de perfil — nomes e status, sem a árvore de encontros. */
export type DuplaPerfil = {
  id: string;
  status: DuplaStatus;
  iniciada_em: string | null;
  mentor: { id: string; nome: string; avatar_path?: string | null; email?: string | null } | null;
  mentorado: { id: string; nome: string; avatar_path?: string | null } | null;
};

export type PessoaPerfil =
  | { tipo: "profile"; pessoa: Profile }
  | { tipo: "mentorado"; pessoa: Mentorado };

/** Perfil público interno (/pessoas/[id]) — resolve profile OU mentorado pelo
 *  id, traz as duplas da pessoa e o mural de notas. O RLS já limita: mentor
 *  que consulta mentorado fora da própria dupla recebe null → notFound. */
export const getPessoaPerfil = cache(async (id: string): Promise<
  (PessoaPerfil & { duplas: DuplaPerfil[]; notas: PessoaNota[] }) | null
> => {
  const supabase = await createClient();
  const DUPLA_PERFIL_SELECT = `
    id, status, iniciada_em,
    mentor:profiles!duplas_mentor_id_fkey(id, nome, avatar_path, email),
    mentorado:mentorados(id, nome, avatar_path)
  `;
  // notas são privadas do autor (0017) — só voltam as minhas; embed de autor
  // seria sempre eu mesmo, então não vale o join
  const NOTA_SELECT = `id, profile_id, mentorado_id, texto, created_by, created_at`;

  const [{ data: p }, { data: m }] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", id).maybeSingle(),
    supabase.from("mentorados").select("*").eq("id", id).maybeSingle(),
  ]);
  if (p) {
    const [{ data: duplas }, { data: notas }] = await Promise.all([
      supabase.from("duplas").select(DUPLA_PERFIL_SELECT)
        .or(`mentor_id.eq.${id},supervisor_id.eq.${id}`)
        .order("created_at", { ascending: false }),
      supabase.from("pessoa_notas").select(NOTA_SELECT)
        .eq("profile_id", id).order("created_at", { ascending: false }),
    ]);
    return {
      tipo: "profile",
      pessoa: p as Profile,
      duplas: (duplas as unknown as DuplaPerfil[]) ?? [],
      notas: (notas as unknown as PessoaNota[]) ?? [],
    };
  }
  if (m) {
    const [{ data: duplas }, { data: notas }] = await Promise.all([
      supabase.from("duplas").select(DUPLA_PERFIL_SELECT)
        .eq("mentorado_id", id)
        .order("created_at", { ascending: false }),
      supabase.from("pessoa_notas").select(NOTA_SELECT)
        .eq("mentorado_id", id).order("created_at", { ascending: false }),
    ]);
    return {
      tipo: "mentorado",
      pessoa: m as Mentorado,
      duplas: (duplas as unknown as DuplaPerfil[]) ?? [],
      notas: (notas as unknown as PessoaNota[]) ?? [],
    };
  }
  return null;
});

export const getMateriais = cache(async (): Promise<Material[]> => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("materiais")
    .select("*")
    .order("ordem", { ascending: true });
  if (error) throw error;
  return data ?? [];
});

/** mentor_profiles — tipo local porque a tabela ainda não está em types.ts. */
export type MentorProfile = {
  profile_id: string;
  tipo: "dpp" | "especialista";
  areas: string[];
  capacidade: number;
  termo_ok: boolean;
  formacao_ok: boolean;
};

export const getMentorProfiles = cache(async (): Promise<MentorProfile[]> => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("mentor_profiles")
    .select("profile_id,tipo,areas,capacidade,termo_ok,formacao_ok");
  if (error) throw error;
  return (data as unknown as MentorProfile[]) ?? [];
});

/** Notificações do usuário logado — as 15 mais recentes + contagem exata de
 *  não-lidas (o badge pode passar de 15 mesmo com a lista paginada). */
export const getNotificacoes = cache(
  async (): Promise<{ itens: Notificacao[]; naoLidas: number }> => {
    const supabase = await createClient();
    const [{ data, error }, { count, error: e2 }] = await Promise.all([
      supabase
        .from("notificacoes")
        .select("id, tipo, titulo, corpo, href, lida_em, created_at")
        .order("created_at", { ascending: false })
        .limit(15),
      supabase
        .from("notificacoes")
        .select("*", { count: "exact", head: true })
        .is("lida_em", null),
    ]);
    if (error) throw error;
    if (e2) throw e2;
    return { itens: (data ?? []) as Notificacao[], naoLidas: count ?? 0 };
  }
);

/** Comunicados visíveis pro usuário — a RLS já filtra por audiência. */
export const getComunicados = cache(async (): Promise<Comunicado[]> => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("comunicados")
    .select("id, titulo, corpo, audiencia, created_by, created_at, autor:profiles!created_by(nome)")
    .order("created_at", { ascending: false })
    .limit(5);
  if (error) throw error;
  return (data ?? []).map((c) => ({
    ...c,
    // supabase-js tipa join 1:1 como array — normaliza pra objeto
    autor: Array.isArray(c.autor) ? (c.autor[0] ?? null) : c.autor,
  })) as Comunicado[];
});
