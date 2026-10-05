import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { comparaNome, registroTardio } from "./ciclo";
import { demoLidas, demoOnboarded, demoRole } from "./demo/mode";
import {
  demoAlertasRegistros,
  demoCicloEventos,
  demoCronogramas,
  demoComunicados,
  demoContagemPessoas,
  demoContatosMap,
  demoDocumentosPessoa,
  demoDupla,
  demoDuplas,
  demoDuplasOpcoes,
  demoDuplasResumo,
  demoEspecialistaEventos,
  demoMateriais,
  demoMe,
  demoMentorados,
  demoMentorProfiles,
  demoMeuMentorProfile,
  demoMeusDadosPessoais,
  demoMinhasDuplas,
  demoNotificacoes,
  demoPessoalMap,
  demoPessoaPerfil,
  demoPessoas,
  demoRegistros,
} from "./demo/queries";
import type { AvaliacaoJovem, CicloEvento, Comunicado, CorRaca, Cronograma, DadosCivis, DocumentoPessoa, Dupla, DuplaResumo, DuplaStatus, EncontroStatus, EspecialistaEvento, Genero, Material, Mentorado, MentorProfile, Notificacao, PessoaNota, PrefGeneroPar, Profile, Registro, ResponsavelCivis, Trilha } from "./types";

/** mentor_profiles — re-export do tipo canônico (types.ts): os callers da
 *  página de pessoas/board importam daqui historicamente. */
export type { MentorProfile } from "./types";

/** Colunas de profiles legíveis por qualquer autenticado — grant de coluna
 *  da 0026 (Postgres não tem RLS por coluna), ampliado pela 0030 com os
 *  campos de apresentação (bio/linkedin/areas/voluntariado), pela 0031 com
 *  a marca de onboarding (onboarded_em — o gate do wizard lê via getMe) e
 *  pela 0034 com a ficha interna de matching (nome_social/cidade/uf/
 *  interesses/cargo/empresa/origem/consent_lgpd_em).
 *  email/whatsapp/documento_path ficam de fora, assim como os sensíveis da
 *  0034 (data_nascimento/genero/pref_genero_par/motivacao): pedir qualquer
 *  um deles em profiles dá permission denied. */
const PROFILE_COLS_PUBLICAS =
  "id, user_id, nome, role, ativo, avatar_path, created_at, bio, linkedin, areas, voluntariado, onboarded_em, nome_social, cidade, uf, interesses, cargo, empresa, origem, consent_lgpd_em";

/** Colunas de mentorados legíveis por qualquer autenticado — a 0034 tirou o
 *  SELECT table-level e voltou grant por coluna (as sensíveis ficam de fora).
 *  `select("*")` expandiria pras colunas revogadas e derrubaria a query
 *  inteira com permission denied — a lista é sempre explícita. */
const MENTORADO_COLS_PUBLICAS =
  "id, nome, email, whatsapp, ong_origem, notas, avatar_path, documento_path, created_at, nome_social, cidade, uf, interesses, objetivos, escolaridade, origem, disponibilidade";

/** Os 4 sensíveis da 0034 + dados civis da 0046, idênticos em profiles e
 *  mentorados — fora do grant de coluna; só a coordenação os lê, pelas
 *  views *_pessoal. `responsavel` só existe em mentorados (null em
 *  profiles). Exportado como tipo: a camada demo espelha o mesmo shape. */
export type DadosPessoais = {
  data_nascimento: string | null;
  genero: Genero | null;
  cor_raca: CorRaca | null;
  pref_genero_par: PrefGeneroPar | null;
  motivacao: string | null;
  dados_civis: DadosCivis | null;
  responsavel: ResponsavelCivis | null;
  form_bruto: Record<string, unknown> | null;
};

/** id → dados sensíveis, como devolvido pelas views profiles_pessoal /
 *  mentorados_pessoal (0034): o WHERE da view devolve zero linhas pra
 *  qualquer papel ≠ coordenação — o gate por papel está no banco; aqui a
 *  query nem é disparada pra não-coord (getMe já está em cache). Falha de
 *  leitura degrada pra mapa vazio com log — a tela segue sem os campos.
 *  Exportado pro /perfil da coordenação, que pré-preenche os sensíveis do
 *  próprio cadastro (getMe nunca os traz — nem pra coord). */
export const getPessoalMap = cache(
  async (
    tabela: "profiles_pessoal" | "mentorados_pessoal"
  ): Promise<Map<string, DadosPessoais>> => {
    // modo demo: replica o WHERE da view — só a coordenação recebe linhas
    const demo = await demoRole();
    if (demo) return demoPessoalMap(demo, tabela);
    const me = await getMe();
    if (me?.role !== "coordenacao") return new Map();
    const supabase = await createClient();
    // responsavel só existe em mentorados — a select é por tabela pra não
    // pedir coluna que a view profiles_pessoal não expõe
    const cols =
      "id, data_nascimento, genero, cor_raca, pref_genero_par, motivacao, dados_civis, form_bruto" +
      (tabela === "mentorados_pessoal" ? ", responsavel" : "");
    const { data, error } = await supabase.from(tabela).select(cols);
    if (error) {
      console.error(`getPessoalMap(${tabela}):`, error);
      return new Map();
    }
    return new Map(
      ((data ?? []) as unknown as ({ id: string } & DadosPessoais)[]).map(
        (r) => [r.id, { ...r, responsavel: r.responsavel ?? null }]
      )
    );
  }
);

/** Merge dos sensíveis numa linha de profiles/mentorados, por id — fora da
 *  coordenação o mapa vem vazio e os campos ficam null (falsy), como a
 *  ausência de coluna no grant faria. */
function comPessoal<P extends { id: string }>(
  p: P,
  pessoal: Map<string, DadosPessoais>
): P & DadosPessoais {
  const d = pessoal.get(p.id);
  return {
    ...p,
    data_nascimento: d?.data_nascimento ?? null,
    genero: d?.genero ?? null,
    cor_raca: d?.cor_raca ?? null,
    pref_genero_par: d?.pref_genero_par ?? null,
    motivacao: d?.motivacao ?? null,
    dados_civis: d?.dados_civis ?? null,
    responsavel: d?.responsavel ?? null,
    form_bruto: d?.form_bruto ?? null,
  };
}

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
  // modo demo: o escopo da view profiles_contato é replicado sobre o dataset
  const demo = await demoRole();
  if (demo) return demoContatosMap(demo);
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

/** Documentos do intake da pessoa (documentos_pessoa, 0054) — RLS coord-only;
 *  pra qualquer outro papel a query nem dispara. Falha degrada pra [] com
 *  log — a ficha segue sem a lista. */
export const getDocumentosPessoa = cache(
  async (
    tipo: "profile" | "mentorado",
    id: string
  ): Promise<DocumentoPessoa[]> => {
    // modo demo: documentos do intake existem no dataset — coord-only, como a RLS
    const demo = await demoRole();
    if (demo) return demoDocumentosPessoa(demo, tipo, id);
    const me = await getMe();
    if (me?.role !== "coordenacao") return [];
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("documentos_pessoa")
      .select("id, profile_id, mentorado_id, tipo, path, nome, created_by, created_at")
      .eq(tipo === "mentorado" ? "mentorado_id" : "profile_id", id)
      .order("created_at", { ascending: true });
    if (error) {
      console.error("getDocumentosPessoa:", error);
      return [];
    }
    return (data ?? []) as DocumentoPessoa[];
  }
);

// getClaims valida o JWT localmente (sem round-trip); RLS segue valendo no banco.
export const getMe = cache(async (): Promise<Profile | null> => {
  // modo demo: persona do papel + "já vi o wizard" do cookie daquele papel
  const demo = await demoRole();
  if (demo) return demoMe(demo, await demoOnboarded(demo));
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
  const demo = await demoRole();
  if (demo) return demoCicloEventos();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("ciclo_eventos")
    .select("*")
    .order("data", { ascending: true });
  if (error) throw error;
  return data ?? [];
});

/** Todos os cronogramas (0061) — leitura livre pra qualquer papel, como os
 *  eventos: o seletor de turma/calendário é a régua que escopa o recorte. */
export const getCronogramas = cache(async (): Promise<Cronograma[]> => {
  const demo = await demoRole();
  if (demo) return demoCronogramas();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("cronogramas")
    .select("*")
    .order("turma")
    .order("nome");
  if (error) throw error;
  return data ?? [];
});

const DUPLA_SELECT = `
  *,
  mentor:profiles!duplas_mentor_id_fkey(${PROFILE_COLS_PUBLICAS}),
  mentorado:mentorados(${MENTORADO_COLS_PUBLICAS}),
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
  const demo = await demoRole();
  if (demo) return demoDuplas(demo);
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
  // modo demo: id fora do escopo do papel -> null -> page chama notFound()
  const demo = await demoRole();
  if (demo) return demoDupla(demo, id);
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
  const demo = await demoRole();
  if (demo) return demoMinhasDuplas(demo);
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
  const demo = await demoRole();
  if (demo) return demoDuplasResumo(demo, false);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("duplas")
    .select("id,mentor_id,mentorado_id,supervisor_id")
    // "está em dupla" = ocupa vaga — concluída e encerrada já liberaram
    .in("status", ["ativa", "pausada"]);
  if (error) throw error;
  return data ?? [];
});

/** Vínculos de qualquer status (inclusive encerrada) — espelha a guarda de
 *  exclusão das actions, que bloqueia pessoa/mentorado com QUALQUER dupla. */
export const getDuplasResumoTodas = cache(async (): Promise<DuplaResumo[]> => {
  const demo = await demoRole();
  if (demo) return demoDuplasResumo(demo, true);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("duplas")
    .select("id,mentor_id,mentorado_id,supervisor_id");
  if (error) throw error;
  return data ?? [];
});

/** Só a contagem (head: true, sem rows) — alimenta o checklist de setup da home. */
export const getContagemPessoas = cache(async (): Promise<number> => {
  const demo = await demoRole();
  if (demo) return demoContagemPessoas();
  const supabase = await createClient();
  const [profiles, mentorados] = await Promise.all([
    // select=* falharia até no head:true — o * expande pras colunas sem
    // grant (0026 em profiles, 0034 em mentorados) e a query inteira dá
    // permission denied; id basta pra contar
    supabase.from("profiles").select("id", { count: "exact", head: true }),
    supabase.from("mentorados").select("id", { count: "exact", head: true }),
  ]);
  if (profiles.error) throw profiles.error;
  if (mentorados.error) throw mentorados.error;
  return (profiles.count ?? 0) + (mentorados.count ?? 0);
});

// a collation do banco ordena acentos depois de Z (Álvaro no fim da lista) —
// a ordenação final é sempre pt-BR no app, mesma régua das listas client
const porNome = (a: { nome: string }, b: { nome: string }) =>
  comparaNome(a.nome, b.nome);

export const getPessoas = cache(async (): Promise<Profile[]> => {
  const demo = await demoRole();
  if (demo) return demoPessoas(demo);
  const supabase = await createClient();
  const [{ data, error }, contatos, pessoal] = await Promise.all([
    supabase.from("profiles").select(PROFILE_COLS_PUBLICAS).order("nome"),
    getContatos(),
    getPessoalMap("profiles_pessoal"),
  ]);
  if (error) throw error;
  // /pessoas é diretório pra todos os papéis — o contato vem da view
  // escopada: coordenação recebe email/whatsapp/documento_path de todos,
  // supervisor só dos mentores que supervisiona, mentor só a própria linha
  // (o resto fica ""/null e os chips nem renderizam).
  // Os sensíveis (nascimento/gênero/pref./motivação) só preenchem pra coord.
  return ((data ?? []) as { id: string; nome: string }[])
    .map((p) => comPessoal(comContato(p, contatos), pessoal))
    .sort(porNome) as unknown as Profile[];
});

export const getMentorados = cache(async (): Promise<Mentorado[]> => {
  const demo = await demoRole();
  if (demo) return demoMentorados(demo);
  const supabase = await createClient();
  const [{ data, error }, pessoal] = await Promise.all([
    supabase.from("mentorados").select(MENTORADO_COLS_PUBLICAS).order("nome"),
    getPessoalMap("mentorados_pessoal"),
  ]);
  if (error) throw error;
  return ((data ?? []) as { id: string; nome: string }[])
    .map((m) => comPessoal(m, pessoal))
    .sort(porNome) as unknown as Mentorado[];
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
  | { tipo: "profile"; pessoa: Profile; mentorProfile: MentorProfile | null }
  | { tipo: "mentorado"; pessoa: Mentorado };

/** Perfil público interno (/pessoas/[id]) — resolve profile OU mentorado pelo
 *  id, traz as duplas da pessoa e o mural de notas. O RLS já limita: mentor
 *  que consulta mentorado fora da própria dupla recebe null → notFound. */
export const getPessoaPerfil = cache(async (id: string): Promise<
  (PessoaPerfil & { duplas: DuplaPerfil[]; notas: PessoaNota[] }) | null
> => {
  // modo demo: fora do escopo do papel -> null -> a page dá notFound() igual
  const demo = await demoRole();
  if (demo) return demoPessoaPerfil(demo, id);
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

  const [{ data: p }, { data: m }, contatos, pessoalProf, pessoalMent] =
    await Promise.all([
      supabase.from("profiles").select(PROFILE_COLS_PUBLICAS).eq("id", id).maybeSingle(),
      supabase.from("mentorados").select(MENTORADO_COLS_PUBLICAS).eq("id", id).maybeSingle(),
      getContatos(),
      getPessoalMap("profiles_pessoal"),
      getPessoalMap("mentorados_pessoal"),
    ]);
  const comEmail = (d: DuplaPerfil): DuplaPerfil => ({
    ...d,
    mentor: d.mentor
      ? { ...d.mentor, email: contatos.get(d.mentor.id)?.email ?? null }
      : null,
  });
  if (p) {
    // mentor_profiles é legível por autenticado (grant table-level) — a ficha
    // de mentor (disponibilidade/experiência/formação) entra no perfil dele
    const ehMentor = p.role === "mentor_dpp" || p.role === "mentor_especialista";
    const [{ data: duplas }, { data: notas }, { data: mp }] = await Promise.all([
      supabase.from("duplas").select(DUPLA_PERFIL_SELECT)
        .or(`mentor_id.eq.${id},supervisor_id.eq.${id}`)
        .order("created_at", { ascending: false }),
      supabase.from("pessoa_notas").select(NOTA_SELECT)
        .eq("profile_id", id).order("created_at", { ascending: false }),
      ehMentor
        ? supabase.from("mentor_profiles").select(MENTOR_PROFILE_COLS)
            .eq("profile_id", id).maybeSingle()
        : Promise.resolve({ data: null }),
    ]);
    return {
      tipo: "profile",
      pessoa: comPessoal(comContato(p, contatos), pessoalProf) as Profile,
      mentorProfile: (mp as MentorProfile | null) ?? null,
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
      pessoa: comPessoal(m, pessoalMent) as Mentorado,
      duplas: ((duplas as unknown as DuplaPerfil[]) ?? []).map(comEmail),
      notas: (notas as unknown as PessoaNota[]) ?? [],
    };
  }
  return null;
});

export const getMateriais = cache(async (): Promise<Material[]> => {
  const demo = await demoRole();
  if (demo) return demoMateriais();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("materiais")
    .select("*")
    .order("ordem", { ascending: true });
  if (error) throw error;
  return data ?? [];
});

/** mentor_profiles é table-level legível por autenticado (0001) — a lista
 *  completa inclui a ficha de matching da 0034 (disponibilidade jsonb,
 *  experiência prévia, formação externa); o tipo canônico é o de types.ts. */
const MENTOR_PROFILE_COLS =
  "profile_id, tipo, areas, capacidade, termo_ok, formacao_ok, experiencia_previa, formacao_externa, disponibilidade";

export const getMentorProfiles = cache(async (): Promise<MentorProfile[]> => {
  const demo = await demoRole();
  if (demo) return demoMentorProfiles();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("mentor_profiles")
    .select(MENTOR_PROFILE_COLS);
  if (error) throw error;
  return (data as unknown as MentorProfile[]) ?? [];
});

/** mentor_profile do usuário logado — /perfil (o mentor edita a própria
 *  ficha: a self_update policy cobre as colunas novas; o guard da 0004 trava
 *  só termo_ok/formacao_ok/capacidade/tipo). null pra quem não é mentor. */
export const getMeuMentorProfile = cache(
  async (): Promise<MentorProfile | null> => {
    const demo = await demoRole();
    if (demo) return demoMeuMentorProfile(demo);
    const me = await getMe();
    if (!me || (me.role !== "mentor_dpp" && me.role !== "mentor_especialista"))
      return null;
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("mentor_profiles")
      .select(MENTOR_PROFILE_COLS)
      .eq("profile_id", me.id)
      .maybeSingle();
    if (error) {
      console.error("getMeuMentorProfile:", error);
      return null;
    }
    return (data as MentorProfile | null) ?? null;
  }
);

/** Os 4 sensíveis do PRÓPRIO cadastro (RPC meus_dados_pessoais, 0048) —
 *  alimenta o prefill do onboarding/perfil. A RPC é self-scoped por
 *  my_profile_id(): terceiros nunca entram na resposta. */
export const getMeusDadosPessoais = cache(
  async (): Promise<Pick<
    DadosPessoais,
    "data_nascimento" | "genero" | "pref_genero_par" | "motivacao"
  > | null> => {
    const demo = await demoRole();
    if (demo) return demoMeusDadosPessoais(demo);
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("meus_dados_pessoais");
    if (error) {
      console.error("getMeusDadosPessoais:", error);
      return null;
    }
    return data;
  }
);

/** Notificações do usuário logado — as 15 mais recentes + contagem exata de
 *  não-lidas (o badge pode passar de 15 mesmo com a lista paginada). */
export const getNotificacoes = cache(
  async (): Promise<{ itens: Notificacao[]; naoLidas: number }> => {
    const demo = await demoRole();
    if (demo) return demoNotificacoes(demo, await demoLidas());
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
  const demo = await demoRole();
  if (demo) return demoComunicados(demo);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("comunicados")
    .select("id, titulo, corpo, audiencia, prioridade, created_by, created_at, autor:profiles!created_by(nome)")
    // prioridade antes de recência: um urgente antigo ainda ganha o top-5
    // de um informativo novo. prioridade_ord é coluna gerada (0055) — o
    // PostgREST ordena por ela mesmo fora do select
    .order("prioridade_ord")
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
      trilha: Trilha;
      cronograma_id: string | null;
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
      id, status, trilha, cronograma_id,
      mentor:profiles!duplas_mentor_id_fkey(id, nome, avatar_path),
      mentorado:mentorados!duplas_mentorado_id_fkey(id, nome, avatar_path)
    )
  )`;

/** Registros visíveis pelo papel (RLS: coord = todos, supervisor = suas duplas). */
export async function getRegistros(
  f: FiltrosRegistro
): Promise<{ itens: RegistroResumo[]; total: number }> {
  const demo = await demoRole();
  if (demo) return demoRegistros(demo, f);
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
  const demo = await demoRole();
  if (demo) return demoAlertasRegistros(demo);
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

/** Opções do filtro de dupla — RLS devolve só o escopo do papel.
 *  `cronograma_id` precisa vir junto: o filtro "encontro nº N" de /registros
 *  resolve o máximo no cronograma da dupla escolhida (0061). */
export type DuplaOpcao = {
  id: string;
  cronograma_id: string | null;
  mentor: { nome: string } | null;
  mentorado: { nome: string } | null;
};

export const getDuplasOpcoes = cache(async (): Promise<DuplaOpcao[]> => {
  const demo = await demoRole();
  if (demo) return demoDuplasOpcoes(demo);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("duplas")
    .select(
      "id, cronograma_id, mentor:profiles!duplas_mentor_id_fkey(nome), mentorado:mentorados!duplas_mentorado_id_fkey(nome)"
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

// ---------- trilha de especialista (0027) ----------

/** Os 5 encontros do guia do especialista — título + foco, na ordem. */
export const getEspecialistaEventos = cache(
  async (): Promise<EspecialistaEvento[]> => {
    const demo = await demoRole();
    if (demo) return demoEspecialistaEventos();
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("especialista_eventos")
      .select("numero, titulo, foco")
      .order("numero");
    if (error) throw error;
    return data ?? [];
  }
);


