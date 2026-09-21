import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { registroTardio } from "./ciclo";
import type { AvaliacaoJovem, CicloEvento, Comunicado, Dupla, DuplaResumo, DuplaStatus, EncontroStatus, Material, Mentorado, Notificacao, PessoaNota, Profile, Registro } from "./types";

/** Colunas de profiles legíveis por qualquer autenticado — grant de coluna
 *  da 0026 (Postgres não tem RLS por coluna). email/whatsapp/documento_path
 *  ficam de fora: pedir qualquer uma delas em profiles dá permission denied. */
const PROFILE_COLS_PUBLICAS =
  "id, user_id, nome, role, ativo, avatar_path, created_at";

/** Contato de uma pessoa, como devolvido pela view profiles_contato. */
type Contato = {
  email: string | null;
  whatsapp: string | null;
  documento_path: string | null;
};

/** id → contato visível pro papel (view profiles_contato, 0026): coordenação
 *  vê todos (com documento_path), supervisor vê os mentores das duplas
 *  ativas/pausadas que supervisiona (nudge por WhatsApp), qualquer um vê a
 *  própria linha. Quem não está no mapa fica sem contato — nome e avatar
 *  seguem visíveis pelas colunas públicas. */
const getContatos = cache(async (): Promise<Map<string, Contato>> => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles_contato")
    .select("id, email, whatsapp, documento_path");
  if (error) {
    // contato enriquece a tela — sem a view a página segue com os campos
    // vazios (gravatar cai nas iniciais), mas o erro não pode sumir
    console.error("getContatos:", error);
    return new Map();
  }
  return new Map(
    (data ?? []).map((c: { id: string } & Contato) => [c.id, c])
  );
});

/** Merge do contato da view numa linha de profiles, por id. Os campos
 *  sensíveis ficam ""/null quando o papel não os alcança: email "" e whatsapp
 *  null são falsy — o Avatar cai nas iniciais e o nudge fica desabilitado. */
function comContato<P extends { id: string }>(
  p: P,
  contatos: Map<string, Contato>
): P & { email: string; whatsapp: string | null; documento_path: string | null } {
  const c = contatos.get(p.id);
  return {
    ...p,
    email: c?.email ?? "",
    whatsapp: c?.whatsapp ?? null,
    documento_path: c?.documento_path ?? null,
  };
}

// getClaims valida o JWT localmente (sem round-trip); RLS segue valendo no banco.
export const getMe = cache(async (): Promise<Profile | null> => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const sub = data?.claims?.sub;
  if (!sub) return null;
  // maybeSingle: profile ainda não criado (ou removido) -> null -> layout manda pro login
  const [{ data: profile, error }, contatos] = await Promise.all([
    supabase
      .from("profiles")
      .select(PROFILE_COLS_PUBLICAS)
      .eq("user_id", sub)
      .maybeSingle(),
    // o self-scope da view garante a própria linha — email/whatsapp voltam
    // pro Gravatar do shell e pro form de /perfil
    getContatos(),
  ]);
  if (error) throw error;
  return profile ? comContato(profile, contatos) : null;
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
  mentor:profiles!duplas_mentor_id_fkey(${PROFILE_COLS_PUBLICAS}),
  mentorado:mentorados(*),
  supervisor:profiles!duplas_supervisor_id_fkey(${PROFILE_COLS_PUBLICAS}),
  encontros(*, registro:registros(*, autor:profiles!registros_created_by_fkey(nome))),
  encaminhamentos(*),
  notas:encontro_notas(*)
`;

/** Contato da view mergeado em mentor/supervisor de cada dupla — o nudge por
 *  WhatsApp (coord/supervisor) e o Gravatar do mentor dependem disso. Quem o
 *  papel não alcança (ex.: supervisor de dupla encerrada) fica sem contato. */
function mergeContatoDuplas(
  duplas: Dupla[],
  contatos: Map<string, Contato>
): Dupla[] {
  return duplas.map((d) => ({
    ...d,
    // embed to-one pode vir null se a row referenciada sumir — preserva
    mentor: d.mentor ? comContato(d.mentor, contatos) : d.mentor,
    supervisor: d.supervisor ? comContato(d.supervisor, contatos) : null,
  }));
}

export const getDuplas = cache(async (): Promise<Dupla[]> => {
  const supabase = await createClient();
  const [{ data, error }, contatos] = await Promise.all([
    supabase
      .from("duplas")
      .select(DUPLA_SELECT)
      .order("created_at", { ascending: true }),
    getContatos(),
  ]);
  if (error) throw error;
  return mergeContatoDuplas((data as unknown as Dupla[]) ?? [], contatos);
});

export const getDupla = cache(async (id: string): Promise<Dupla | null> => {
  const supabase = await createClient();
  // maybeSingle: id inexistente -> null -> page chama notFound()
  const [{ data, error }, contatos] = await Promise.all([
    supabase
      .from("duplas")
      .select(DUPLA_SELECT)
      .eq("id", id)
      .maybeSingle(),
    getContatos(),
  ]);
  if (error) throw error;
  return data ? mergeContatoDuplas([data as unknown as Dupla], contatos)[0] : null;
});

export const getMinhasDuplas = cache(async (): Promise<Dupla[]> => {
  const me = await getMe();
  if (!me) return [];
  const supabase = await createClient();
  const [{ data, error }, contatos] = await Promise.all([
    supabase
      .from("duplas")
      .select(DUPLA_SELECT)
      .or(`mentor_id.eq.${me.id},supervisor_id.eq.${me.id}`)
      .order("created_at", { ascending: true }),
    getContatos(),
  ]);
  if (error) throw error;
  return mergeContatoDuplas((data as unknown as Dupla[]) ?? [], contatos);
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
    // select=* falharia até no head:true — o * expande pras colunas sem
    // grant (0026) e a query inteira dá permission denied; id basta pra contar
    supabase.from("profiles").select("id", { count: "exact", head: true }),
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
  const [{ data, error }, contatos] = await Promise.all([
    supabase.from("profiles").select(PROFILE_COLS_PUBLICAS).order("nome"),
    getContatos(),
  ]);
  if (error) throw error;
  // a tela (/pessoas) é da coordenação — a view devolve email/whatsapp/
  // documento_path de todos; pra outro papel só a própria linha teria contato
  return ((data ?? []) as { id: string; nome: string }[])
    .map((p) => comContato(p, contatos))
    .sort(porNome) as Profile[];
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
  // email não entra no embed de profiles (grant de coluna, 0026) — vem do
  // merge com a view quando o papel alcança; o gravatar cai nas iniciais senão
  const DUPLA_PERFIL_SELECT = `
    id, status, iniciada_em,
    mentor:profiles!duplas_mentor_id_fkey(id, nome, avatar_path),
    mentorado:mentorados(id, nome, avatar_path)
  `;
  // notas são privadas do autor (0017) — só voltam as minhas; embed de autor
  // seria sempre eu mesmo, então não vale o join
  const NOTA_SELECT = `id, profile_id, mentorado_id, texto, created_by, created_at`;

  const [{ data: p }, { data: m }, contatos] = await Promise.all([
    supabase.from("profiles").select(PROFILE_COLS_PUBLICAS).eq("id", id).maybeSingle(),
    supabase.from("mentorados").select("*").eq("id", id).maybeSingle(),
    getContatos(),
  ]);
  const comEmail = (d: DuplaPerfil): DuplaPerfil => ({
    ...d,
    mentor: d.mentor
      ? { ...d.mentor, email: contatos.get(d.mentor.id)?.email ?? null }
      : null,
  });
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
      pessoa: comContato(p, contatos) as Profile,
      duplas: ((duplas as unknown as DuplaPerfil[]) ?? []).map(comEmail),
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
      duplas: ((duplas as unknown as DuplaPerfil[]) ?? []).map(comEmail),
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
    // tabela ausente/falha de leitura degrada pra lista vazia em vez de
    // derrubar a página inteira — mas loga: erro silencioso esconde bug
    if (error || e2) {
      console.error("getNotificacoes:", error ?? e2);
      return { itens: [], naoLidas: 0 };
    }
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
  // idem: avisos somem em vez de quebrar a home — com log
  if (error) {
    console.error("getComunicados:", error);
    return [];
  }
  return (data ?? []).map((c) => ({
    ...c,
    // supabase-js tipa join 1:1 como array — normaliza pra objeto
    autor: Array.isArray(c.autor) ? (c.autor[0] ?? null) : c.autor,
  })) as Comunicado[];
});

// ---------- /registros — leitura de conteúdo do form semanal (coord/sup) ----------

export type RegistroResumo = Registro & {
  encontro: {
    id: string;
    numero: number;
    data_hora: string | null;
    realizado_em: string | null;
    status: EncontroStatus;
    dupla: {
      id: string;
      status: DuplaStatus;
      mentor: { id: string; nome: string; email: string | null; avatar_path: string | null } | null;
      mentorado: { id: string; nome: string; avatar_path: string | null } | null;
    } | null;
  } | null;
  encaminhamentos: { id: string }[];
  anexos: { id: string }[];
};

export type FiltrosRegistro = {
  encontro?: number;
  avaliacao?: AvaliacaoJovem;
  apoio?: boolean;
  /** enum de dificuldade ou "com" = qualquer uma ≠ nenhuma. */
  dificuldade?: string;
  dupla?: string;
  /** busca em tema/reflexões/observações — já sanitizada. */
  q?: string;
  /** created_at > realizado_em ?? data_hora + 3d — PostgREST não compara
   *  colunas, então esse filtro é aplicado em JS sobre o resultado completo. */
  tardio?: boolean;
  /** cumulativa: página 2 devolve as 2 primeiras páginas (grupos não quebram). */
  pagina: number;
};

export const REGISTROS_PAGINA = 100;

const REGISTRO_RESUMO_SELECT = `
  id, tema, ferramenta, reflexoes, observacoes, precisa_apoio,
  atividades, avaliacao, dificuldade, dificuldade_detalhe,
  proximo_passo, proximo_passo_detalhe, created_at, encontro_id,
  autor:profiles!registros_created_by_fkey(nome),
  encaminhamentos(id),
  anexos:registro_anexos(id),
  encontro:encontros!registros_encontro_id_fkey!inner(
    id, numero, data_hora, realizado_em, status,
    dupla:duplas!encontros_dupla_id_fkey(
      id, status,
      mentor:profiles!duplas_mentor_id_fkey(id, nome, avatar_path),
      mentorado:mentorados!duplas_mentorado_id_fkey(id, nome, avatar_path)
    )
  )`;

/** Registros visíveis pelo papel (RLS: coord = todos, supervisor = suas duplas). */
export async function getRegistros(
  f: FiltrosRegistro
): Promise<{ itens: RegistroResumo[]; total: number }> {
  const supabase = await createClient();
  let q = supabase
    .from("registros")
    .select(REGISTRO_RESUMO_SELECT, { count: "exact" })
    // o !inner no encontro é o que permite filtrar/ordenar por coluna do
    // embed — to-one ordena com `encontro(col)` (referencedTable seria
    // ignorado: ordena dentro de embed to-many, não o top-level). A timeline
    // de /registros conta a história por data do encontro, não por número.
    .order("encontro(realizado_em)", { ascending: false, nullsFirst: false })
    .order("encontro(data_hora)", { ascending: false })
    .order("created_at", { ascending: false });
  // com f.tardio o corte é em JS (comparação entre colunas não existe em
  // PostgREST) — pedir range aqui paginaria o conjunto errado
  if (!f.tardio) q = q.range(0, f.pagina * REGISTROS_PAGINA - 1);
  if (f.encontro) q = q.eq("encontro.numero", f.encontro);
  if (f.dupla) q = q.eq("encontro.dupla_id", f.dupla);
  if (f.avaliacao) q = q.eq("avaliacao", f.avaliacao);
  if (f.apoio) q = q.eq("precisa_apoio", true);
  if (f.dificuldade === "com") q = q.neq("dificuldade", "nenhuma");
  else if (f.dificuldade) q = q.eq("dificuldade", f.dificuldade);
  if (f.q)
    q = q.or(
      `tema.ilike.%${f.q}%,reflexoes.ilike.%${f.q}%,observacoes.ilike.%${f.q}%`
    );
  const [{ data, error, count }, contatos] = await Promise.all([
    q,
    getContatos(),
  ]);
  if (error) throw error;
  const norm = (v: unknown) => (Array.isArray(v) ? (v[0] ?? null) : v);
  let itens = ((data ?? []) as unknown as RegistroResumo[]).map((r) => {
    const dupla = norm(r.encontro?.dupla) ?? null;
    return {
      ...r,
      autor: norm(r.autor),
      encontro: r.encontro
        ? {
            ...r.encontro,
            // email do mentor vem da view (grant de coluna, 0026) — coord vê
            // todos; supervisor só perde o email quando a dupla já encerrou
            dupla: dupla && {
              ...dupla,
              mentor: dupla.mentor
                ? {
                    ...dupla.mentor,
                    email: contatos.get(dupla.mentor.id)?.email ?? null,
                  }
                : null,
            },
          }
        : null,
    };
  });
  if (f.tardio) {
    itens = itens.filter((r) => registroTardio(r, r.encontro));
    // o count do PostgREST ignorou o filtro JS — o total real é o que sobrou
    return { itens, total: itens.length };
  }
  return { itens, total: count ?? 0 };
}

/** Contadores de triagem do topo — globais ao papel, não seguem os filtros. */
export async function getAlertasRegistros(): Promise<{
  apoio: number;
  baixa: number;
  comDificuldade: number;
  tardios: number;
}> {
  const supabase = await createClient();
  const head = { count: "exact" as const, head: true };
  const [apoio, baixa, dif, tData] = await Promise.all([
    supabase.from("registros").select("*", head).eq("precisa_apoio", true),
    supabase.from("registros").select("*", head).eq("avaliacao", "baixa"),
    supabase.from("registros").select("*", head).neq("dificuldade", "nenhuma"),
    // tardio compara created_at com a data do encontro — head:true não
    // comporta isso, então esse é um select real de colunas mínimas (RLS
    // já limita ao escopo; volume ≈ 16 × nº de duplas por ciclo)
    supabase
      .from("registros")
      .select("created_at, encontro:encontros!inner(realizado_em, data_hora)"),
  ]);
  const err = apoio.error ?? baixa.error ?? dif.error ?? tData.error;
  if (err) console.error("getAlertasRegistros:", err);
  const tardios = (tData.data ?? []).filter((r) => {
    const enc = Array.isArray(r.encontro) ? r.encontro[0] : r.encontro;
    return registroTardio(r, enc);
  }).length;
  return {
    apoio: apoio.count ?? 0,
    baixa: baixa.count ?? 0,
    comDificuldade: dif.count ?? 0,
    tardios,
  };
}

/** Opções do filtro de dupla — RLS devolve só o escopo do papel. */
export type DuplaOpcao = {
  id: string;
  mentor: { nome: string } | null;
  mentorado: { nome: string } | null;
};

export const getDuplasOpcoes = cache(async (): Promise<DuplaOpcao[]> => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("duplas")
    .select(
      "id, mentor:profiles!duplas_mentor_id_fkey(nome), mentorado:mentorados!duplas_mentorado_id_fkey(nome)"
    )
    .order("created_at", { ascending: true });
  if (error) throw error;
  const norm = (v: unknown) => (Array.isArray(v) ? (v[0] ?? null) : v);
  return ((data ?? []) as unknown as DuplaOpcao[])
    .map((d) => ({ ...d, mentor: norm(d.mentor), mentorado: norm(d.mentorado) }))
    .sort((a, b) =>
      (a.mentor?.nome ?? "").localeCompare(b.mentor?.nome ?? "", "pt-BR")
    );
});
