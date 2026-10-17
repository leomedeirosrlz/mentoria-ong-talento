import { getDemoData, type DemoData } from "./data";
import { registroTardio, toDateStr } from "../ciclo";
import { slotsLivresEspecialista } from "./agenda";
import { normaliza } from "../utils";
import type {
  AppRole,
  Assinatura,
  AssinaturaResumo,
  AssinaturaVia,
  ChamadoFilaItem,
  ChamadoTimelineItem,
  AvaliacaoLink,
  CicloEvento,
  ColegaTurma,
  Comunicado,
  Cronograma,
  DadosCivis,
  DocumentoPessoa,
  Dupla,
  DuplaResumo,
  Encontro,
  EspecialistaAvaliacao,
  EspecialistaEvento,
  ExcecaoEspecialista,
  GradeJanela,
  JovemAssinatura,
  JovemContato,
  JovemDupla,
  JovemEncaminhamento,
  JovemEspecialista,
  JovemPerfil,
  Material,
  Mentorado,
  MentoradoPar,
  Notificacao,
  PessoaNota,
  Presenca,
  Profile,
  RegistroAnexo,
  SolicitacaoEspecialista,
  SolicitacaoEspecialistaStatus,
  SolicitacaoProposta,
  Supervisao,
} from "../types";
// Só tipos das queries reais — `import type` é apagado no build, então o
// ciclo queries.ts → demo/queries.ts → queries.ts não existe em runtime.
import type {
  CurriculoMentorado,
  DadosPessoais,
  DuplaOpcao,
  DuplaPerfil,
  FiltrosRegistro,
  MentorProfile,
  PessoaPerfil,
  RegistroResumo,
} from "../queries";
import type { ResumoFormacao } from "../queries-presenca";
import type { JovemEncontro } from "../queries-jovem";
import type {
  AvaliacaoMediaDpp,
  AvaliacaoTokenInfo,
  JovemAvaliacao,
} from "../queries-avaliacao";
import type { FormularioPublico } from "../forms/queries";
import { getDemoFormularios } from "./forms-data";
import type { Interacao } from "../interacoes";

// Camada de leitura do modo demo: replica o escopo que o RLS aplicaria a
// cada papel sobre o dataset fixo de getDemoData() — coordenação vê tudo,
// supervisor as duplas que supervisiona, mentor/especialista as próprias.
// As queries reais (src/lib/queries*.ts) chamam estas funções quando o
// cookie demo_role está presente, então a demo inteira roda sem banco.

/** Contato como a view profiles_contato devolve (0026). */
type Contato = {
  email: string | null;
  whatsapp: string | null;
  documento_path: string | null;
};

/** Mesmo corte de REGISTROS_PAGINA em ../queries — duplicado de propósito:
 *  importar o valor criaria dependência de runtime circular. */
const REGISTROS_PAGINA = 100;

const porNome = (a: { nome: string }, b: { nome: string }) =>
  a.nome.localeCompare(b.nome, "pt-BR");

/** Dupla não declara created_at no tipo (a UI ordena pelo banco) — o dataset
 *  pode carregar a coluna crua; sem ela, iniciada_em é o proxy mais próximo
 *  (a dupla do ciclo anterior abre a lista asc, como no created_at do real). */
const criadoEm = (d: Dupla) =>
  (d as Dupla & { created_at?: string }).created_at ?? d.iniciada_em ?? "";

/** Escopo de vínculo do papel — o mesmo das policies duplas_select: coord
 *  tudo; supervisor as supervisionadas; mentor/especialista as mentoradas. */
function duplasDoPapel(data: DemoData, role: AppRole): Dupla[] {
  const eu = data.personas[role];
  if (role === "coordenacao") return data.duplas;
  if (role === "supervisor")
    return data.duplas.filter((d) => d.supervisor?.id === eu.id);
  return data.duplas.filter((d) => d.mentor?.id === eu.id);
}

/** profiles_select pós-0076: a CONTA de um jovem (profile role='mentorado')
 *  só é legível pra coordenação, pro próprio dono e pra adulto de uma dupla
 *  dele (jovem_relacionado — mentor ou supervisor, em qualquer status).
 *  Profiles de adulto seguem visíveis a qualquer staff, como sempre. */
function jovemProfileVisivel(
  data: DemoData,
  role: AppRole,
  profile: Profile
): boolean {
  if (role === "coordenacao" || profile.role !== "mentorado") return true;
  const eu = data.personas[role];
  if (profile.id === eu.id) return true;
  const ficha = data.mentorados.find((m) => m.profile_id === profile.id);
  if (!ficha) return false;
  return data.duplas.some(
    (d) =>
      d.mentorado?.id === ficha.id &&
      (d.mentor?.id === eu.id || d.supervisor?.id === eu.id)
  );
}

/** Mapa id → contato, espelhando a view profiles_contato: coordenação vê
 *  todos (inclusive documento_path); supervisor vê os mentores das duplas
 *  ativas/pausadas que supervisiona; todo papel vê a própria linha.
 *  documento_path é CASE'd pra null fora da coordenação — até na linha própria. */
export function demoContatosMap(role: AppRole): Map<string, Contato> {
  const data = getDemoData();
  const eu = data.personas[role];
  const ids = new Set<string>([eu.id]);
  if (role === "coordenacao") {
    for (const p of data.profiles) ids.add(p.id);
  } else if (role === "supervisor") {
    for (const d of data.duplas) {
      if (d.supervisor?.id === eu.id && d.status !== "encerrada" && d.mentor) {
        ids.add(d.mentor.id);
      }
    }
  }
  const mapa = new Map<string, Contato>();
  for (const p of data.profiles) {
    if (!ids.has(p.id)) continue;
    mapa.set(p.id, {
      email: p.email ?? null,
      whatsapp: p.whatsapp ?? null,
      documento_path: role === "coordenacao" ? (p.documento_path ?? null) : null,
    });
  }
  return mapa;
}

/** Merge do contato numa linha de profiles — idem comContato de queries.ts:
 *  sem contato no escopo, email "" e whatsapp/documento_path null (falsy —
 *  o Avatar cai nas iniciais e o nudge fica desabilitado). */
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

/** Os 4 sensíveis da 0034 — fora do grant por coluna de profiles/mentorados,
 *  só voltam pra coordenação (views *_pessoal). O dataset carrega tudo; o
 *  strip aqui reproduz a fronteira real: ninguém ≠ coord recebe esses campos
 *  de terceiros, e nenhum papel os recebe via embed de dupla (o select
 *  embutido da query real pede só as colunas públicas). */
const CAMPOS_PESSOAIS = [
  "data_nascimento",
  "genero",
  "cor_raca",
  "pref_genero_par",
  "motivacao",
  "dados_civis",
  "responsavel",
  "form_bruto",
  // currículo (0081) sai do objeto pra todo mundo que não é coordenação —
  // o auxiliar executivo o recebe de volta pelo mapa dedicado
  // (demoCurriculoMap), no mesmo modelo do grant+view do banco
  "curriculo_path",
  "curriculo_url",
] as const;

function semPessoal<P>(p: P): P {
  const q = { ...(p as Record<string, unknown>) };
  for (const k of CAMPOS_PESSOAIS) delete q[k];
  return q as P;
}

/** Embed mentorado:* das duplas (0076): só as colunas do par DPP — a
 *  whitelist de MENTORADO_COLS_PAR aplicada no dataset, que guarda o
 *  Mentorado inteiro. Notas, documento, ficha e sensíveis ficam fora pra
 *  qualquer papel; a ficha real segue na rota própria, escopada pela RLS. */
const COLS_MENTORADO_PAR: (keyof MentoradoPar)[] = [
  "id",
  "nome",
  "nome_social",
  "avatar_path",
  "whatsapp",
  "email",
  "ong_origem",
  "cidade",
  "uf",
  "interesses",
  "disponibilidade",
];

function mentoradoPar(m: MentoradoPar): MentoradoPar {
  const q = {} as Record<string, unknown>;
  for (const k of COLS_MENTORADO_PAR)
    q[k] = (m as Record<string, unknown>)[k];
  return q as MentoradoPar;
}

/** Contato em mentor/supervisor de cada dupla — idem mergeContatoDuplas.
 *  O embed real lista só colunas públicas: o strip dos sensíveis vale pra
 *  TODO papel, inclusive coordenação (a ficha dela vem pelas views). O
 *  mentorado desce pro recorte PAR desde a 0076. */
function comContatoDuplas(
  duplas: Dupla[],
  contatos: Map<string, Contato>
): Dupla[] {
  return duplas.map((d) => ({
    ...d,
    mentor: d.mentor ? semPessoal(comContato(d.mentor, contatos)) : d.mentor,
    mentorado: d.mentorado ? mentoradoPar(d.mentorado) : d.mentorado,
    supervisor: d.supervisor ? semPessoal(comContato(d.supervisor, contatos)) : null,
  }));
}

/** Persona do papel + marca de onboarding do cookie demo (o gate do wizard
 *  lê onboarded_em via getMe). */
export function demoMe(role: AppRole, onboarded: boolean): Profile {
  const p = getDemoData().personas[role];
  const base = comContato(
    { ...p, onboarded_em: onboarded ? new Date().toISOString() : null },
    demoContatosMap(role)
  );
  // getMe real nunca traz os sensíveis (grant de coluna) — nem do próprio
  // usuário e nem pra coordenação, que os lê de volta via getPessoaPerfil
  return semPessoal(base);
}

/** Sensíveis do PRÓPRIO cadastro (espelha a RPC meus_dados_pessoais — a
 *  persona é o "eu" do papel, então a leitura self-scoped volta cheia). */
export function demoMeusDadosPessoais(
  role: AppRole
): Pick<DadosPessoais, "data_nascimento" | "genero" | "pref_genero_par" | "motivacao"> {
  const p = getDemoData().personas[role];
  return {
    data_nascimento: p.data_nascimento ?? null,
    genero: p.genero ?? null,
    pref_genero_par: p.pref_genero_par ?? null,
    motivacao: p.motivacao ?? null,
  };
}

// ---------- catálogo — igual pra todos os papéis ----------

export function demoCicloEventos(): CicloEvento[] {
  // todos os eventos, dos dois cronogramas — quem consome filtra pelo
  // cronograma_id do recorte (a real devolve a tabela inteira igual).
  // A ordenação é `ordem` (0062), igual à real — data é nullable.
  return [...getDemoData().cicloEventos].sort((a, b) => a.ordem - b.ordem);
}

/** Idem getCronogramas (0061) — leitura livre pra todo papel, ordenada por
 *  turma e nome como o .order("turma").order("nome") da real. */
export function demoCronogramas(): Cronograma[] {
  return [...getDemoData().cronogramas].sort(
    (a, b) =>
      a.turma.localeCompare(b.turma, "pt-BR") ||
      a.nome.localeCompare(b.nome, "pt-BR")
  );
}

export function demoEspecialistaEventos(): EspecialistaEvento[] {
  return [...getDemoData().especialistaEventos].sort(
    (a, b) => a.numero - b.numero
  );
}

// ---------- agenda do especialista (0073) ----------

/** especialista_grade da persona — o select real filtra por profile_id da
 *  sessão (a policy devolveria só o dono mesmo sem o eq). */
export function demoMinhaGrade(role: AppRole): GradeJanela[] {
  const eu = getDemoData().personas[role];
  return getDemoData()
    .especialistaGrade.filter((g) => g.profile_id === eu.id)
    // tira profile_id — GradeJanela é a projeção do select real
    .map((g) => ({
      id: g.id,
      dia_semana: g.dia_semana,
      hora_inicio: g.hora_inicio,
      hora_fim: g.hora_fim,
    }))
    .sort(
      (a, b) =>
        a.dia_semana - b.dia_semana || a.hora_inicio.localeCompare(b.hora_inicio)
    );
}

/** Exceções atuais/futuras da persona — o real filtra data >= hoje. */
export function demoMinhasExcecoes(role: AppRole): ExcecaoEspecialista[] {
  const eu = getDemoData().personas[role];
  const hoje = toDateStr(new Date());
  return getDemoData()
    .especialistaExcecoes.filter(
      (x) => x.profile_id === eu.id && x.data >= hoje
    )
    // tira profile_id — ExcecaoEspecialista é a projeção do select real
    .map((x) => ({
      id: x.id,
      data: x.data,
      hora_inicio: x.hora_inicio,
      hora_fim: x.hora_fim,
      tipo: x.tipo,
    }))
    .sort(
      (a, b) => a.data.localeCompare(b.data) || a.hora_inicio.localeCompare(b.hora_inicio)
    );
}

/** Projeção demo da RPC especialista_slots_livres — mesma regra do SQL
 *  (demo/agenda.ts), alimentada pelo dataset. Qualquer autenticado consulta
 *  os slots de qualquer especialista — é a oferta pública do catálogo. */
export function demoSlotsLivres(profileId: string, dias = 21): string[] {
  const data = getDemoData();
  const ocupados = data.duplas
    .filter((d) => d.mentor?.id === profileId)
    .flatMap((d) => d.encontros)
    .filter(
      (e) =>
        (e.status === "agendado" || e.status === "remarcado") &&
        e.data_hora != null
    )
    .map((e) => {
      const inicio = new Date(e.data_hora!).getTime();
      return { inicio, fim: inicio + (e.duracao_min ?? 60) * 60 * 1000 };
    });
  const hoje = new Date();
  return slotsLivresEspecialista({
    grade: data.especialistaGrade.filter((g) => g.profile_id === profileId),
    excecoes: data.especialistaExcecoes.filter(
      (x) => x.profile_id === profileId
    ),
    ocupados,
    desde: hoje,
    ate: new Date(hoje.getTime() + dias * 86400000),
  });
}

/** Policy materiais_select (0065): 'todos' alcança qualquer papel — inclusive
 *  o mentorado; 'dpp'/'especialista' só o papel homônimo; coordenação vê tudo. */
export function demoMateriais(role: AppRole): Material[] {
  return getDemoData()
    .materiais.filter(
      (m) =>
        m.audiencia === "todos" ||
        role === "coordenacao" ||
        (m.audiencia === "dpp" && role === "mentor_dpp") ||
        (m.audiencia === "especialista" && role === "mentor_especialista")
    )
    .sort((a, b) => a.ordem - b.ordem);
}

// ---------- duplas ----------

export function demoDuplas(role: AppRole): Dupla[] {
  const data = getDemoData();
  return comContatoDuplas(
    comAvaliacaoJovem(
      [...duplasDoPapel(data, role)].sort((a, b) =>
        criadoEm(a).localeCompare(criadoEm(b))
      ),
      role,
      data
    ),
    demoContatosMap(role)
  );
}

/** null fora do escopo — a página real cai em notFound() igual. */
export function demoDupla(role: AppRole, id: string): Dupla | null {
  return demoDuplas(role).find((d) => d.id === id) ?? null;
}

/** mentor_id = eu OR supervisor_id = eu — getMinhasDuplas não ramifica por
 *  papel, então pra coordenação devolve as duplas em que ela é parte (nenhuma
 *  no dataset típico — a home dela usa getDuplas). */
export function demoMinhasDuplas(role: AppRole): Dupla[] {
  const data = getDemoData();
  const eu = data.personas[role];
  const minhas = data.duplas.filter(
    (d) => d.mentor?.id === eu.id || d.supervisor?.id === eu.id
  );
  return comContatoDuplas(
    comAvaliacaoJovem(
      [...minhas].sort((a, b) => criadoEm(a).localeCompare(criadoEm(b))),
      role,
      data
    ),
    demoContatosMap(role)
  );
}

/** Só os vínculos — `todas` inclui encerradas (espelha a guarda de exclusão
 *  das actions, que bloqueia pessoa/mentorado com QUALQUER dupla). */
export function demoDuplasResumo(role: AppRole, todas: boolean): DuplaResumo[] {
  return duplasDoPapel(getDemoData(), role)
    .filter((d) => todas || ["ativa", "pausada"].includes(d.status))
    .map((d) => ({
      id: d.id,
      mentor_id: d.mentor.id,
      mentorado_id: d.mentorado.id,
      supervisor_id: d.supervisor?.id ?? null,
    }));
}

// ---------- pessoas ----------

export function demoContagemPessoas(): number {
  const data = getDemoData();
  return data.profiles.length + data.mentorados.length;
}

/** /pessoas lista os profiles legíveis pelo papel (profiles_select,
 *  0026/0076): contas de jovem fora da dupla dele não aparecem pra staff.
 *  O contato vem do mapa escopado por papel e os sensíveis
 *  (profiles_pessoal) só entram pra coordenação, como na real. */
export function demoPessoas(role: AppRole): Profile[] {
  const data = getDemoData();
  const contatos = demoContatosMap(role);
  return data.profiles
    .filter((p) => jovemProfileVisivel(data, role, p))
    .map((p) => {
      const c = comContato(p, contatos);
      return role === "coordenacao" ? c : semPessoal(c);
    })
    .sort(porNome);
}

export function demoMentorados(role: AppRole): Mentorado[] {
  const data = getDemoData();
  // mentorados_select (0023): coordenação lê todos; mentor e supervisor só
  // os mentorados das duplas em que são parte — o vínculo vale em qualquer
  // status (dupla concluída/encerrada mantém o histórico legível)
  const vinculados =
    role === "coordenacao"
      ? null
      : new Set(duplasDoPapel(data, role).map((d) => d.mentorado.id));
  // grant por coluna da 0034: nascimento/gênero/pref./motivação ficam de fora
  // pra qualquer papel ≠ coordenação (a real lê pela view mentorados_pessoal)
  return data.mentorados
    .filter((m) => !vinculados || vinculados.has(m.id))
    .map((m) => (role === "coordenacao" ? m : semPessoal(m)))
    .sort(porNome);
}

/** Mapa id → sensíveis, espelhando o WHERE das views profiles_pessoal /
 *  mentorados_pessoal (0034): coordenação recebe todas as linhas, qualquer
 *  outro papel recebe mapa vazio — a real nem dispara a query. O /perfil da
 *  coordenação usa a própria linha daqui pra pré-preencher o form. */
export function demoPessoalMap(
  role: AppRole,
  tabela: "profiles_pessoal" | "mentorados_pessoal"
): Map<string, DadosPessoais> {
  const mapa = new Map<string, DadosPessoais>();
  if (role !== "coordenacao") return mapa;
  const data = getDemoData();
  const fonte: (Profile | Mentorado)[] =
    tabela === "profiles_pessoal" ? data.profiles : data.mentorados;
  for (const p of fonte) {
    mapa.set(p.id, {
      data_nascimento: p.data_nascimento ?? null,
      genero: p.genero ?? null,
      cor_raca: p.cor_raca ?? null,
      pref_genero_par: p.pref_genero_par ?? null,
      motivacao: p.motivacao ?? null,
      dados_civis: p.dados_civis ?? null,
      responsavel: "responsavel" in p ? (p.responsavel ?? null) : null,
      form_bruto: p.form_bruto ?? null,
    });
  }
  return mapa;
}

/** Mapa id → currículo, espelhando o WHERE da view mentorados_curriculo
 *  (0081): coordenação recebe todas as linhas; o auxiliar executivo só os
 *  mentorados das duplas que supervisiona (o recorte de duplasDoPapel); os
 *  demais papéis recebem mapa vazio — a real nem dispara a query. */
export function demoCurriculoMap(
  role: AppRole
): Map<string, CurriculoMentorado> {
  const mapa = new Map<string, CurriculoMentorado>();
  const data = getDemoData();
  // o embed mentorado da dupla é o shape público (MentoradoPar) — o
  // currículo vem da linha cheia, resolvida por id, como a view faz
  const supervisionados =
    role === "supervisor"
      ? new Set(duplasDoPapel(data, role).map((d) => d.mentorado?.id))
      : null;
  const escopo =
    role === "coordenacao"
      ? data.mentorados
      : supervisionados != null
        ? data.mentorados.filter((m) => supervisionados.has(m.id))
        : [];
  for (const m of escopo) {
    mapa.set(m.id, {
      curriculo_path: m.curriculo_path ?? null,
      curriculo_url: m.curriculo_url ?? null,
    });
  }
  return mapa;
}

/** Card de dupla da página de perfil — id, status, início e o par. */
function duplaPerfil(
  d: Dupla,
  contatos: Map<string, Contato>
): DuplaPerfil {
  return {
    id: d.id,
    status: d.status,
    iniciada_em: d.iniciada_em,
    mentor: d.mentor
      ? {
          id: d.mentor.id,
          nome: d.mentor.nome,
          avatar_path: d.mentor.avatar_path ?? null,
          // email não é coluna pública (0026) — vem da view quando o papel alcança
          email: contatos.get(d.mentor.id)?.email ?? null,
        }
      : null,
    mentorado: d.mentorado
      ? {
          id: d.mentorado.id,
          nome: d.mentorado.nome,
          avatar_path: d.mentorado.avatar_path ?? null,
        }
      : null,
  };
}

/** Perfil público interno (/pessoas/[id]) — resolve profile OU mentorado.
 *  Profile abre pra qualquer papel (a ficha do colega é o diretório interno;
 *  a page redireciona a própria pra /perfil). Mentorado aparece pra staff
 *  sempre (RLS de mentorados libera coord/sup) e pro mentor só se estiver
 *  numa dupla dele — a lista vem do escopo, igual à RLS. Notas são privadas
 *  do autor (0017) — só as da persona voltam. */
export function demoPessoaPerfil(
  role: AppRole,
  id: string
): (PessoaPerfil & { duplas: DuplaPerfil[]; notas: PessoaNota[] }) | null {
  const data = getDemoData();
  const eu = data.personas[role];
  const contatos = demoContatosMap(role);
  const escopo = duplasDoPapel(data, role);
  const desc = (a: Dupla, b: Dupla) => criadoEm(b).localeCompare(criadoEm(a));
  const notasDe = (campo: "profile_id" | "mentorado_id") =>
    data.pessoaNotas
      .filter((n) => n[campo] === id && n.created_by === eu.id)
      .sort((a, b) => b.created_at.localeCompare(a.created_at));

  const p = data.profiles.find((x) => x.id === id);
  if (p) {
    // conta de jovem fora da dupla do papel — profiles_select (0076) nega a
    // linha inteira e a página cai em notFound, como na real
    if (!jovemProfileVisivel(data, role, p)) return null;
    const ehMentor = p.role === "mentor_dpp" || p.role === "mentor_especialista";
    return {
      tipo: "profile",
      pessoa: role === "coordenacao" ? comContato(p, contatos) : semPessoal(comContato(p, contatos)),
      mentorProfile: ehMentor
        ? (data.mentorProfiles.find((mp) => mp.profile_id === id) ?? null)
        : null,
      duplas: escopo
        .filter((d) => d.mentor?.id === id || d.supervisor?.id === id)
        .sort(desc)
        .map((d) => duplaPerfil(d, contatos)),
      notas: notasDe("profile_id"),
    };
  }
  const m = data.mentorados.find((x) => x.id === id);
  if (m) {
    const duplas = escopo
      .filter((d) => d.mentorado?.id === id)
      .sort(desc)
      .map((d) => duplaPerfil(d, contatos));
    // mentor/supervisor sem vínculo ao mentorado: a RLS responderia vazio →
    // notFound (supervisor só lê mentorados de duplas que supervisiona — 0023)
    if (role !== "coordenacao" && duplas.length === 0) return null;
    // currículo (0081): sai do objeto pelo strip (CAMPOS_PESSOAIS) e volta
    // pelo mapa escopado — coord vê de todos, aux só das supervisionadas
    const cv = demoCurriculoMap(role).get(m.id);
    return {
      tipo: "mentorado",
      pessoa: {
        ...(role === "coordenacao" ? m : semPessoal(m)),
        curriculo_path: cv?.curriculo_path ?? null,
        curriculo_url: cv?.curriculo_url ?? null,
      },
      duplas,
      notas: notasDe("mentorado_id"),
    };
  }
  return null;
}

export function demoMentorProfiles(): MentorProfile[] {
  return getDemoData().mentorProfiles;
}

/** mentor_profile da persona — a real só devolve pra mentor_dpp/especialista. */
export function demoMeuMentorProfile(role: AppRole): MentorProfile | null {
  if (role !== "mentor_dpp" && role !== "mentor_especialista") return null;
  const data = getDemoData();
  const eu = data.personas[role];
  return data.mentorProfiles.find((mp) => mp.profile_id === eu.id) ?? null;
}

// ---------- avisos e notificações ----------

/** As 15 mais recentes do papel + contagem de não-lidas (o badge pode passar
 *  de 15 mesmo com a lista paginada). `lidas` são os ids que o visitante
 *  marcou nesta sessão (cookie demo_lidas) — viram lida_em derivado, porque
 *  o dataset em si não muda. */
export function demoNotificacoes(
  role: AppRole,
  lidas: ReadonlySet<string> = new Set()
): {
  itens: Notificacao[];
  naoLidas: number;
} {
  const agora = new Date().toISOString();
  const lista = [...(getDemoData().notificacoes[role] ?? [])]
    .map((n) =>
      n.lida_em == null && lidas.has(n.id) ? { ...n, lida_em: agora } : n
    )
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
  return {
    itens: lista.slice(0, 15),
    naoLidas: lista.filter((n) => n.lida_em == null).length,
  };
}

/** Audiência da policy comunicados_select (0019): 'todos' pra todo papel;
 *  coord vê tudo (inclusive 'coordenacao' e 'equipe'); 'dpp'/'especialista'
 *  por trilha; 'equipe' chega aos supervisores. */
export function demoComunicados(role: AppRole): Comunicado[] {
  const visivel = (c: Comunicado) =>
    c.audiencia === "todos" ||
    role === "coordenacao" ||
    (c.audiencia === "dpp" && role === "mentor_dpp") ||
    (c.audiencia === "especialista" && role === "mentor_especialista") ||
    (c.audiencia === "equipe" && role === "supervisor");
  // espelha prioridade_ord da coluna gerada (0055): prioridade antes de
  // recência, urgente antigo ganha o top-5 de informativo novo
  const ord: Record<Comunicado["prioridade"], number> = {
    urgente: 0,
    importante: 1,
    normal: 2,
  };
  return getDemoData()
    .comunicados.filter(visivel)
    .sort(
      (a, b) =>
        ord[a.prioridade] - ord[b.prioridade] ||
        b.created_at.localeCompare(a.created_at)
    )
    .slice(0, 5);
}

// ---------- /jovem — as views jovem_* do definer (0067 + 0070) ----------
// O escopo real é security definer filtrado por my_mentorado_id() — aqui o
// "eu" é a ficha mentorados vinculada ao profile da persona. Cada função
// projeta SÓ as colunas da view correspondente: o que a view não expõe
// (notas, documento_path, form_bruto, registro_id, evidências de assinatura)
// não atravessa a fronteira nem na demo.

/** Ficha mentorados da persona jovem — o my_mentorado_id() da demo. Fora
 *  do papel mentorado (ou sem vínculo profile→ficha) devolve null, como a
 *  view faz com o WHERE my_role()='mentorado'. */
function mentoradoDaPersona(data: DemoData, role: AppRole): Mentorado | null {
  if (role !== "mentorado") return null;
  const eu = data.personas[role];
  return data.mentorados.find((m) => m.profile_id === eu.id) ?? null;
}

/** jovem_perfil (0067): a própria ficha — inclui os sensíveis DELA (a view é
 *  definer e self-scoped), mas nunca notas/documento_path/form_bruto. */
export function demoJovemPerfil(role: AppRole): JovemPerfil | null {
  const m = mentoradoDaPersona(getDemoData(), role);
  if (!m) return null;
  return {
    id: m.id,
    nome: m.nome,
    nome_social: m.nome_social ?? null,
    email: m.email,
    whatsapp: m.whatsapp,
    avatar_path: m.avatar_path ?? null,
    data_nascimento: m.data_nascimento ?? null,
    genero: m.genero ?? null,
    cidade: m.cidade ?? null,
    uf: m.uf ?? null,
    interesses: m.interesses ?? null,
    motivacao: m.motivacao ?? null,
    objetivos: m.objetivos ?? null,
    escolaridade: m.escolaridade ?? null,
    origem: m.origem ?? null,
    ong_origem: m.ong_origem,
    pref_genero_par: m.pref_genero_par ?? null,
    disponibilidade: m.disponibilidade ?? null,
    dados_civis: m.dados_civis ?? null,
    responsavel: m.responsavel ?? null,
    cor_raca: m.cor_raca ?? null,
    created_at: m.created_at ?? null,
    contato_compartilhado: m.contato_compartilhado ?? false,
  };
}

/** jovem_duplas (0067): as duplas DELA com mentor/supervisor planeados —
 *  sem solicitacao_id/remanejada_de/devolutiva_pdm. Ordenação da query
 *  real: iniciada_em desc. */
export function demoJovemDuplas(role: AppRole): JovemDupla[] {
  const data = getDemoData();
  const m = mentoradoDaPersona(data, role);
  if (!m) return [];
  return data.duplas
    .filter((d) => d.mentorado?.id === m.id)
    .map((d) => ({
      id: d.id,
      trilha: d.trilha,
      status: d.status,
      turma: d.turma,
      cronograma_id: d.cronograma_id,
      iniciada_em: d.iniciada_em,
      encerrada_em: d.encerrada_em ?? null,
      motivo_encerramento: d.motivo_encerramento ?? null,
      pdm_url: d.pdm_url ?? null,
      demanda: d.demanda,
      mentor_id: d.mentor?.id ?? null,
      mentor_nome: d.mentor?.nome ?? null,
      mentor_nome_social: d.mentor?.nome_social ?? null,
      mentor_avatar_path: d.mentor?.avatar_path ?? null,
      supervisor_id: d.supervisor?.id ?? null,
      supervisor_nome: d.supervisor?.nome ?? null,
      supervisor_nome_social: d.supervisor?.nome_social ?? null,
      supervisor_avatar_path: d.supervisor?.avatar_path ?? null,
    }))
    .sort((a, b) => (b.iniciada_em ?? "").localeCompare(a.iniciada_em ?? ""));
}

/** jovem_contatos (0067/0076): mentor + supervisor de CADA dupla dela
 *  (union all — o mesmo adulto repete por dupla, como a view faz) +
 *  coordenação ativa com dupla_id null. O papel deriva da trilha (0076):
 *  na dupla de especialista o mentor_id é o especialista e o rótulo certo
 *  é 'especialista' — não 'mentor'. Nome, contato e foto — nada de civis. */
export function demoJovemContatos(role: AppRole): JovemContato[] {
  const data = getDemoData();
  const m = mentoradoDaPersona(data, role);
  if (!m) return [];
  const contato = (
    dupla_id: string | null,
    papel: string,
    p: Profile | null | undefined
  ): JovemContato | null =>
    p && p.ativo
      ? {
          dupla_id,
          papel,
          id: p.id,
          nome: p.nome,
          nome_social: p.nome_social ?? null,
          avatar_path: p.avatar_path ?? null,
          whatsapp: p.whatsapp ?? null,
          email: p.email ?? null,
          role: p.role,
        }
      : null;
  const dela = data.duplas.filter((d) => d.mentorado?.id === m.id);
  return [
    ...dela.map((d) =>
      contato(
        d.id,
        d.trilha === "especialista" ? "especialista" : "mentor",
        d.mentor
      )
    ),
    ...dela.map((d) => contato(d.id, "supervisor", d.supervisor)),
    ...data.profiles
      .filter((p) => p.role === "coordenacao")
      .map((p) => contato(null, "coordenacao", p)),
  ].filter((c): c is JovemContato => c !== null);
}

/** mentorados_turma (0076): colegas COM CONTA (profile_id) que dividem a
 *  turma de alguma dupla dela — turma é texto, então a coorte vale até por
 *  dupla concluída, como a view. O whatsapp só sai atrás do opt-in
 *  (contato_compartilhado); Eduardo e Pedro ficam fora porque não têm
 *  login — mesmo recorte do WHERE da view. */
export function demoJovemColegas(role: AppRole): ColegaTurma[] {
  const data = getDemoData();
  const m = mentoradoDaPersona(data, role);
  if (!m) return [];
  const minhasTurmas = new Set(
    data.duplas
      .filter((d) => d.mentorado?.id === m.id && d.turma != null)
      .map((d) => d.turma as string)
  );
  if (minhasTurmas.size === 0) return [];
  return data.mentorados
    .filter(
      (c) =>
        c.id !== m.id &&
        c.profile_id != null &&
        data.duplas.some(
          (d) =>
            d.mentorado?.id === c.id &&
            d.turma != null &&
            minhasTurmas.has(d.turma)
        )
    )
    .map((c) => ({
      id: c.id,
      nome: c.nome,
      nome_social: c.nome_social ?? null,
      avatar_path: c.avatar_path ?? null,
      cidade: c.cidade ?? null,
      uf: c.uf ?? null,
      interesses: c.interesses ?? null,
      whatsapp: c.contato_compartilhado ? c.whatsapp : null,
    }))
    .sort((a, b) =>
      (a.nome_social || a.nome || "").localeCompare(
        b.nome_social || b.nome || "",
        "pt-BR"
      )
    );
}

/** jovem_encaminhamentos (0070): só os combinados DELA (responsavel =
 *  'mentorado'), sem registro_id. Ordenação da query real: status asc,
 *  prazo asc (nulls por último), created_at desc. */
export function demoJovemEncaminhamentos(role: AppRole): JovemEncaminhamento[] {
  const data = getDemoData();
  const m = mentoradoDaPersona(data, role);
  if (!m) return [];
  return data.duplas
    .filter((d) => d.mentorado?.id === m.id)
    .flatMap((d) => d.encaminhamentos ?? [])
    .filter((e) => e.responsavel === "mentorado")
    .map((e) => ({
      id: e.id,
      dupla_id: e.dupla_id,
      descricao: e.descricao,
      prazo: e.prazo,
      status: e.status,
      created_at: e.created_at,
    }))
    .sort(
      (a, b) =>
        a.status.localeCompare(b.status) ||
        Number(a.prazo == null) - Number(b.prazo == null) ||
        (a.prazo ?? "").localeCompare(b.prazo ?? "") ||
        b.created_at.localeCompare(a.created_at)
    );
}

/** jovem_assinaturas (0070): id/template + slug/título por join + estado do
 *  link — sem dados_snapshot, IP, user agent nem hash (evidência fica de
 *  fora da view). Ordenação da query real: created_at desc. */
export function demoJovemAssinaturas(role: AppRole): JovemAssinatura[] {
  const data = getDemoData();
  const m = mentoradoDaPersona(data, role);
  if (!m) return [];
  return data.assinaturas
    .filter((a) => a.mentorado_id === m.id)
    .map((a) => ({
      id: a.id,
      template_id: a.template_id,
      slug: a.template?.slug ?? null,
      titulo: a.template?.titulo ?? null,
      status: a.status,
      token: a.token,
      token_expira_em: a.token_expira_em,
      assinado_em: a.assinado_em,
      created_at: a.created_at,
    }))
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
}

/** Encontros das duplas dela — a query real lê a tabela encontros com a
 *  projeção explícita de 9 colunas (sem registro/anexo/encaminhamento).
 *  Ordenação: data_hora asc, nulls por último (pendentes de agendar). */
export function demoJovemEncontros(role: AppRole): JovemEncontro[] {
  const data = getDemoData();
  const m = mentoradoDaPersona(data, role);
  if (!m) return [];
  return data.duplas
    .filter((d) => d.mentorado?.id === m.id)
    .flatMap((d) => d.encontros ?? [])
    .map((e) => ({
      id: e.id,
      dupla_id: e.dupla_id,
      numero: e.numero,
      data_hora: e.data_hora,
      realizado_em: e.realizado_em,
      duracao_min: e.duracao_min,
      status: e.status,
      link: e.link,
      motivo_reagendamento: e.motivo_reagendamento,
    }))
    .sort(
      (a, b) =>
        Number(a.data_hora == null) - Number(b.data_hora == null) ||
        (a.data_hora ?? "").localeCompare(b.data_hora ?? "")
    );
}

// ---------- /registros — conteúdo do form semanal (coord/sup) ----------

/** Achata encontros das duplas do escopo em RegistroResumo — a árvore do
 *  dataset já tem registro.autor; encaminhamentos/anexos vêm por registro_id. */
export function demoRegistros(
  role: AppRole,
  f: FiltrosRegistro
): { itens: RegistroResumo[]; total: number } {
  const data = getDemoData();
  const contatos = demoContatosMap(role);
  const anexosPorRegistro: Record<string, { id: string }[]> = {};
  for (const a of data.anexos) {
    (anexosPorRegistro[a.registro_id] ??= []).push({ id: a.id });
  }

  let itens: RegistroResumo[] = [];
  for (const d of duplasDoPapel(data, role)) {
    for (const e of d.encontros ?? []) {
      const reg = e.registro;
      if (!reg) continue;
      itens.push({
        ...reg,
        encontro: {
          id: e.id,
          numero: e.numero,
          data_hora: e.data_hora,
          realizado_em: e.realizado_em,
          status: e.status,
          dupla: {
            id: d.id,
            status: d.status,
            trilha: d.trilha,
            cronograma_id: d.cronograma_id,
            mentor: d.mentor
              ? {
                  id: d.mentor.id,
                  nome: d.mentor.nome,
                  avatar_path: d.mentor.avatar_path ?? null,
                  email: contatos.get(d.mentor.id)?.email ?? null,
                }
              : null,
            mentorado: d.mentorado
              ? {
                  id: d.mentorado.id,
                  nome: d.mentorado.nome,
                  avatar_path: d.mentorado.avatar_path ?? null,
                }
              : null,
          },
        },
        encaminhamentos: (d.encaminhamentos ?? [])
          .filter((x) => x.registro_id === reg.id)
          .map((x) => ({ id: x.id })),
        anexos: anexosPorRegistro[reg.id] ?? [],
      });
    }
  }

  // mesmos filtros da query real
  if (f.encontro) itens = itens.filter((r) => r.encontro?.numero === f.encontro);
  if (f.dupla) itens = itens.filter((r) => r.encontro?.dupla?.id === f.dupla);
  if (f.avaliacao) itens = itens.filter((r) => r.avaliacao === f.avaliacao);
  if (f.apoio) itens = itens.filter((r) => r.precisa_apoio);
  // neq do PostgREST exclui NULL — "com dificuldade" não conta registro sem o campo
  if (f.dificuldade === "com")
    itens = itens.filter(
      (r) => r.dificuldade != null && r.dificuldade !== "nenhuma"
    );
  else if (f.dificuldade)
    itens = itens.filter((r) => r.dificuldade === f.dificuldade);
  if (f.q) {
    const q = normaliza(f.q);
    itens = itens.filter((r) =>
      [r.tema, r.reflexoes, r.observacoes].some((v) =>
        normaliza(v).includes(q)
      )
    );
  }

  // a timeline conta a história por data do encontro, não por número —
  // realizado_em ?? data_hora desc, created_at desc desempata
  itens.sort(
    (a, b) =>
      (b.encontro?.realizado_em ?? b.encontro?.data_hora ?? "").localeCompare(
        a.encontro?.realizado_em ?? a.encontro?.data_hora ?? ""
      ) || b.created_at.localeCompare(a.created_at)
  );

  if (f.tardio) {
    // comparação entre colunas não existe em PostgREST — na real o corte é
    // em JS sem range; aqui igual, e o total é o que sobrou do filtro
    itens = itens.filter((r) => registroTardio(r, r.encontro));
    return { itens, total: itens.length };
  }
  // paginação cumulativa: página N devolve as N primeiras páginas
  const total = itens.length;
  return { itens: itens.slice(0, f.pagina * REGISTROS_PAGINA), total };
}

/** Contadores de triagem do topo de /registros — globais ao papel. */
export function demoAlertasRegistros(role: AppRole): {
  apoio: number;
  baixa: number;
  comDificuldade: number;
  tardios: number;
} {
  const data = getDemoData();
  let apoio = 0,
    baixa = 0,
    comDificuldade = 0,
    tardios = 0;
  for (const d of duplasDoPapel(data, role)) {
    for (const e of d.encontros ?? []) {
      const r = e.registro;
      if (!r) continue;
      if (r.precisa_apoio) apoio++;
      if (r.avaliacao === "baixa") baixa++;
      if (r.dificuldade != null && r.dificuldade !== "nenhuma") comDificuldade++;
      if (registroTardio(r, e)) tardios++;
    }
  }
  return { apoio, baixa, comDificuldade, tardios };
}

/** Opções do filtro de dupla de /registros — só o escopo do papel. */
export function demoDuplasOpcoes(role: AppRole): DuplaOpcao[] {
  return duplasDoPapel(getDemoData(), role)
    .map((d) => ({
      id: d.id,
      cronograma_id: d.cronograma_id,
      mentor: d.mentor ? { nome: d.mentor.nome } : null,
      mentorado: d.mentorado ? { nome: d.mentorado.nome } : null,
    }))
    .sort((a, b) =>
      (a.mentor?.nome ?? "").localeCompare(b.mentor?.nome ?? "", "pt-BR")
    );
}

// ---------- trilha de especialista (0027/0074) ----------

/** status_efetivo da view (0074) — a expiração é lazy: pedido/proposta
 *  pendente com o slot no passado lê 'expirada' sem writer. */
function efetivo(s: SolicitacaoEspecialista): SolicitacaoEspecialistaStatus {
  return (s.status === "aberta" || s.status === "contra_proposta") &&
    s.slot_proposto != null &&
    s.slot_proposto <= new Date().toISOString()
    ? "expirada"
    : s.status;
}

/** Devolve a solicitação como a view solicitacoes_mural — com status_efetivo
 *  computado na leitura (a coluna só existe na view, não no dataset). */
function comEfetivo(s: SolicitacaoEspecialista): SolicitacaoEspecialista {
  return { ...s, status_efetivo: efetivo(s) };
}

/** Todas as solicitações da dupla DPP, mais recentes primeiro — só se a dupla
 *  estiver no escopo do papel (sol_select: mentor/supervisor da dupla de
 *  origem). Um jovem pode ter várias trilhas no ciclo — a seção de
 *  devolutivas lista todas, o chip usa a primeira. */
export function demoSolicitacoesDaDupla(
  role: AppRole,
  duplaDppId: string
): SolicitacaoEspecialista[] {
  const data = getDemoData();
  const noEscopo = duplasDoPapel(data, role).some((d) => d.id === duplaDppId);
  if (!noEscopo) return [];
  return data.solicitacoes
    .filter((s) => s.dupla_dpp_id === duplaDppId)
    .map(comEfetivo)
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
}

/** Última solicitação da dupla DPP (qualquer status). */
export function demoSolicitacaoDaDupla(
  role: AppRole,
  duplaDppId: string
): SolicitacaoEspecialista | null {
  return demoSolicitacoesDaDupla(role, duplaDppId)[0] ?? null;
}

/** O que o papel vê no mural (sol_select v2, 0074): coord tudo; especialista
 *  as abertas/em negociação broadcast-ou-direcionadas + as que engajou ou
 *  criou; mentor/supervisor as das próprias duplas; mentorado os próprios
 *  pedidos. Ordenação da real: status_efetivo asc + created_at desc. */
export function demoSolicitacoesVisiveis(
  role: AppRole
): SolicitacaoEspecialista[] {
  const data = getDemoData();
  const eu = data.personas[role];
  let lista: SolicitacaoEspecialista[];
  if (role === "coordenacao") {
    lista = data.solicitacoes;
  } else if (role === "mentor_especialista") {
    lista = data.solicitacoes.filter(
      (s) =>
        ((s.status === "aberta" || s.status === "contra_proposta") &&
          (s.especialista_desejado_id == null ||
            s.especialista_desejado_id === eu.id)) ||
        s.especialista_id === eu.id ||
        s.created_by === eu.id
    );
  } else if (role === "mentorado") {
    // a policy compara mentorado_id com my_mentorado_id() — a ficha do
    // mentorado, não o profile dele
    const meuMentorado = data.mentorados.find((m) => m.profile_id === eu.id)?.id;
    lista = data.solicitacoes
      .filter((s) => s.mentorado_id === meuMentorado)
      // os embeds de profiles não passam pela RLS do papel — o mural só
      // denormaliza `especialista_nome` (engajado); o direcionado e o
      // autor resolvem do catálogo no getJovemPedidosEspecialista
      .map((s) => ({
        ...s,
        solicitante:
          s.created_by === eu.id
            ? { nome: eu.nome_social || eu.nome }
            : null,
        especialista: s.especialista_nome
          ? { nome: s.especialista_nome }
          : null,
        desejado: null,
      }));
  } else {
    const ids = new Set(duplasDoPapel(data, role).map((d) => d.id));
    lista = data.solicitacoes.filter(
      (s) => s.dupla_dpp_id != null && ids.has(s.dupla_dpp_id)
    );
  }
  return lista
    .map(comEfetivo)
    .sort(
      (a, b) =>
        (a.status_efetivo ?? a.status).localeCompare(
          b.status_efetivo ?? b.status
        ) || b.created_at.localeCompare(a.created_at)
    );
}

/** Thread de uma negociação, cronológica — prop_select libera as partes da
 *  solicitação pai: quem vê a solicitação lê a thread. O embed `autor`
 *  segue o profiles_select pós-0076: staff lê profile de adulto sempre e
 *  de jovem só se da dupla dele (jovem_relacionado); pro papel mentorado
 *  só a própria linha resolve — os nomes voltam pela solicitação pai. */
export function demoPropostas(
  role: AppRole,
  solicitacaoId: string
): SolicitacaoProposta[] {
  const data = getDemoData();
  const sol = data.solicitacoes.find((s) => s.id === solicitacaoId);
  if (!sol) return [];
  const visivel = demoSolicitacoesVisiveis(role).some((s) => s.id === sol.id);
  if (!visivel) return [];
  const autorVisivel = (autorId: string): boolean => {
    // papel mentorado: profiles_select devolve só a própria linha — os
    // nomes do outro lado chegam achatados (solicitação) ou pelo catálogo
    if (role === "mentorado") return autorId === data.personas.mentorado.id;
    const p = data.profiles.find((x) => x.id === autorId);
    return p ? jovemProfileVisivel(data, role, p) : false;
  };
  return data.solicitacaoPropostas
    .filter((p) => p.solicitacao_id === solicitacaoId)
    .map((p) => (autorVisivel(p.autor_id) ? p : { ...p, autor: null }))
    .sort((a, b) => a.created_at.localeCompare(b.created_at));
}

/** Encontros mínimos de um conjunto de duplas (o que getEncontrosPorDuplas
 *  seleciona) — o passo do guia esp deriva do histórico todo; o escopo é o
 *  mesmo enc_select: só enxerga encontro de dupla que o papel vê. */
export function demoEncontrosPorDuplas(
  role: AppRole,
  duplaIds: string[]
): Pick<Encontro, "id" | "dupla_id" | "numero" | "status">[] {
  const data = getDemoData();
  const ids = new Set(duplaIds);
  return duplasDoPapel(data, role)
    .filter((d) => ids.has(d.id))
    .flatMap((d) => d.encontros ?? [])
    .map((e) => ({
      id: e.id,
      dupla_id: e.dupla_id,
      numero: e.numero,
      status: e.status,
    }));
}

/** Especialistas ativos — pro select "direcionar a um especialista" do dialog. */
export function demoEspecialistas(): {
  id: string;
  nome: string;
  areas: string[] | null;
}[] {
  return getDemoData()
    .profiles.filter((p) => p.role === "mentor_especialista" && p.ativo)
    .map((p) => ({ id: p.id, nome: p.nome, areas: p.areas ?? null }))
    .sort(porNome);
}

/** O catálogo da view jovem_especialistas (0075) — os especialistas ativos,
 *  projetados no que o jovem pode ver (nome/social/avatar/áreas, sem contato).
 *  Só faz sentido pro papel mentorado. */
export function demoJovemEspecialistas(role: AppRole): JovemEspecialista[] {
  if (role !== "mentorado") return [];
  return getDemoData()
    .profiles.filter((p) => p.role === "mentor_especialista" && p.ativo)
    .map((p) => ({
      id: p.id,
      nome: p.nome,
      nome_social: p.nome_social ?? null,
      avatar_path: p.avatar_path ?? null,
      areas: p.areas ?? null,
    }))
    .sort(porNome);
}

// ---------- interações e anexos ----------

/** Último contato por dupla — restrito aos ids pedidos (já vêm escopados
 *  pelo caller, que passa as próprias duplas). */
export function demoUltimasInteracoes(
  role: AppRole,
  duplaIds: string[]
): Record<string, Interacao> {
  if (duplaIds.length === 0) return {};
  const ids = new Set(duplaIds);
  const ultimas: Record<string, Interacao> = {};
  for (const i of [...getDemoData().interacoes]
    .filter((x) => ids.has(x.dupla_id))
    .sort((a, b) => b.created_at.localeCompare(a.created_at))) {
    // a lista vem desc — a primeira ocorrência de cada dupla é a mais recente
    ultimas[i.dupla_id] ??= i;
  }
  return ultimas;
}

/** Anexos agrupados por registro_id — created_at asc como a real. */
export function demoAnexosPorRegistros(
  role: AppRole,
  registroIds: string[]
): Record<string, RegistroAnexo[]> {
  if (registroIds.length === 0) return {};
  const ids = new Set(registroIds);
  const mapa: Record<string, RegistroAnexo[]> = {};
  for (const a of [...getDemoData().anexos]
    .filter((x) => ids.has(x.registro_id))
    .sort((a, b) => a.created_at.localeCompare(b.created_at))) {
    (mapa[a.registro_id] ??= []).push(a);
  }
  return mapa;
}

// ---------- documentos & assinaturas (0033) ----------

/** A assinatura de termo mais recente da persona — o banner do home e a
 *  página /assinar decidem a partir dela. Ricardo não tem → pendente. */
export function demoMinhaAssinaturaTermo(role: AppRole): Assinatura | null {
  const data = getDemoData();
  const eu = data.personas[role];
  return (
    [...data.assinaturas]
      .filter(
        (a) => a.profile_id === eu.id && a.template?.slug === "termo-voluntario"
      )
      .sort((a, b) => b.created_at.localeCompare(a.created_at))[0] ?? null
  );
}

/** Espelha meus_dados_civis() (0046): civis da persona + nome/nascimento da
 *  ficha quando o jsonb não os repete. null pra papel sem profile (não há). */
export function demoMeusDadosCivis(role: AppRole): DadosCivis | null {
  const data = getDemoData();
  const eu = data.personas[role];
  const p = data.profiles.find((x) => x.id === eu.id);
  if (!p) return null;
  const base = p.dados_civis ?? null;
  return {
    nome_civil: base?.nome_civil || p.nome,
    rg: base?.rg ?? "",
    cpf: base?.cpf ?? "",
    data_nascimento: base?.data_nascimento ?? p.data_nascimento ?? null,
    endereco: base?.endereco ?? {
      logradouro: "", numero: "", complemento: null,
      bairro: "", cidade: "", uf: "", cep: "",
    },
  };
}

/** Uma assinatura por id — escopo da policy: dono ou coordenação. */
export function demoAssinatura(role: AppRole, id: string): Assinatura | null {
  const data = getDemoData();
  const a = data.assinaturas.find((x) => x.id === id) ?? null;
  if (!a) return null;
  const eu = data.personas[role];
  if (a.profile_id === eu.id || role === "coordenacao") return a;
  return null;
}

/** Resumo por pessoa pra aba /pessoas — mesmo escopo da policy (coord vê
 *  tudo; signatário só as próprias linhas). */
export function demoAssinaturasResumo(role: AppRole): AssinaturaResumo[] {
  const data = getDemoData();
  const eu = data.personas[role];
  return data.assinaturas
    .filter((a) => role === "coordenacao" || a.profile_id === eu.id)
    .map((a) => ({
      id: a.id,
      profile_id: a.profile_id,
      mentorado_id: a.mentorado_id,
      status: a.status,
      assinado_em: a.assinado_em,
      token_expira_em: a.token_expira_em,
      slug: a.template?.slug ?? "",
    }));
}

/** Histórico de assinaturas da ficha — dado coord-only: pros demais papéis
 *  a página nem dispara (o card "Documentos e assinaturas" não renderiza). */
export function demoAssinaturasPessoa(
  role: AppRole,
  tipo: "profile" | "mentorado",
  id: string
): Assinatura[] {
  if (role !== "coordenacao") return [];
  const col = tipo === "profile" ? "profile_id" : "mentorado_id";
  return [...getDemoData().assinaturas]
    .filter((a) => a[col] === id)
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
}

/** Público da demo: o que assinatura_por_token devolveria — usado pela
 *  página /assinar/<token> quando o cookie demo está ativo. */
export function demoAssinaturaPorToken(token: string) {
  const a = getDemoData().assinaturas.find((x) => x.token === token);
  if (!a) return null;
  const data = getDemoData();
  const profile = a.profile_id
    ? data.profiles.find((p) => p.id === a.profile_id)
    : null;
  const mentorado = a.mentorado_id
    ? data.mentorados.find((m) => m.id === a.mentorado_id)
    : null;
  const nome = profile?.nome ?? mentorado?.nome;
  // espelha a RPC (0046+0053): o prefill muda por template E só existe
  // enquanto o link está assinável — depois de assinado/expirado/revogado
  // a PII não sai mais
  const slug = a.template?.slug ?? "";
  // flip lazy da RPC (0033/0053): pendente com prazo vencido responde
  // 'expirado' — na demo o dataset é imutável, então o flip é derivado
  const status =
    a.status === "pendente" &&
    a.token_expira_em !== null &&
    a.token_expira_em <= new Date().toISOString()
      ? "expirado"
      : a.status;
  const assinavel =
    status === "pendente" &&
    (!a.token_expira_em || a.token_expira_em > new Date().toISOString());
  let civis = !assinavel
    ? null
    : slug === "autorizacao-responsavel"
      ? mentorado?.responsavel ?? null
      : profile?.dados_civis ?? mentorado?.dados_civis ?? null;
  // mesmo fallback da RPC (0053): nome/nascimento da ficha caem no prefill
  // quando o civis não trouxe — o form não abre 100% vazio
  if (assinavel && slug !== "autorizacao-responsavel") {
    const entidade = profile ?? mentorado;
    if (entidade) {
      const d = { ...(civis ?? {}) } as Record<string, unknown>;
      if (!d.nome_civil) d.nome_civil = entidade.nome;
      if (!d.data_nascimento && entidade.data_nascimento)
        d.data_nascimento = entidade.data_nascimento;
      civis = d as typeof civis;
    }
  }
  return {
    id: a.id,
    status,
    assinado_em: a.assinado_em,
    // 0070 — demo não tem sessão autenticada: o link sempre segue o fluxo
    identidade: "anon" as const,
    template: a.template ?? { slug: "", titulo: "", versao: 1 },
    alvo: { nome: nome ?? "" },
    civis,
  };
}

/** Via assinada por token (demo) — só aparece depois de assinada e com o
 *  mesmo recorte da RPC (0053): evidência + template, sem token nem ids
 *  internos. */
export function demoAssinaturaCompletaPorToken(token: string): AssinaturaVia | null {
  const a = getDemoData().assinaturas.find(
    (x) => x.token === token && x.status === "assinado"
  );
  if (!a) return null;
  return {
    id: a.id,
    status: a.status,
    dados_snapshot: a.dados_snapshot,
    assinatura_texto: a.assinatura_texto,
    assinado_em: a.assinado_em,
    ip: a.ip,
    user_agent: a.user_agent,
    hash_documento: a.hash_documento,
    template: a.template,
  };
}

// ---------- presenças na formação (0040) ----------

/** Escopo da policy presencas_select: coordenação lê tudo; a pessoa lê a
 *  própria linha; supervisor lê a dos mentores de duplas ativas/pausadas
 *  que supervisiona (mesmo recorte de profiles_contato). */
function presencaVisivel(data: DemoData, role: AppRole, p: Presenca): boolean {
  const eu = data.personas[role];
  if (role === "coordenacao" || p.profile_id === eu.id) return true;
  if (role !== "supervisor") return false;
  return data.duplas.some(
    (d) =>
      d.supervisor?.id === eu.id &&
      d.mentor?.id === p.profile_id &&
      (d.status === "ativa" || d.status === "pausada")
  );
}

/** Linhas da chamada pros eventos dados — idem getPresencas. */
export function demoPresencas(role: AppRole, eventoIds: string[]): Presenca[] {
  const ids = new Set(eventoIds);
  return getDemoData().presencas.filter(
    (p) => ids.has(p.ciclo_evento_id) && presencaVisivel(getDemoData(), role, p)
  );
}

/** "N de M encontros de formação" da ficha — idem getResumoFormacao (0061):
 *  formação é da TURMA. O denominador são os eventos 'formacao' dos
 *  cronogramas da turma do mentor — a turma dos cronogramas das duplas dele
 *  (a mais recente quando ele tem dupla nas duas); mentor sem dupla cai na
 *  turma da formação mais recente publicada. Fora do escopo de leitura o
 *  count zera — como a RLS devolveria. */
export function demoResumoFormacao(
  role: AppRole,
  profileId: string
): ResumoFormacao {
  const data = getDemoData();
  const evs = data.cicloEventos
    .filter((e) => e.tipo === "formacao")
    .sort((a, b) => (a.data ?? "").localeCompare(b.data ?? ""));
  const turmaPorCron = new Map(data.cronogramas.map((c) => [c.id, c.turma]));
  // turma do mentor: a do cronograma mais recente dentre as suas duplas
  const cronsDoMentor = new Set(
    data.duplas
      .filter((d) => d.mentor?.id === profileId && d.cronograma_id != null)
      .map((d) => d.cronograma_id as string)
  );
  const maisRecente = data.cronogramas
    .filter((c) => cronsDoMentor.has(c.id))
    .sort((a, b) => (b.inicio_em ?? "").localeCompare(a.inicio_em ?? ""))[0];
  const vigente =
    maisRecente?.turma ??
    turmaPorCron.get(evs.at(-1)?.cronograma_id ?? "");
  const ids = evs
    .filter((e) => turmaPorCron.get(e.cronograma_id) === vigente)
    .map((e) => e.id);
  const presentes = data.presencas.filter(
    (p) =>
      p.profile_id === profileId &&
      p.presente &&
      ids.includes(p.ciclo_evento_id) &&
      presencaVisivel(data, role, p)
  ).length;
  return { presentes, total: ids.length };
}

// ---------- sessões de supervisão (0041) ----------

/** Escopo da policy supervisoes_select: coordenação tudo; o supervisor
 *  autor; o mentor sobre quem é a sessão; e o supervisor das sessões
 *  vinculadas a duplas que ele supervisiona. */
function demoSupervisoesEscopo(role: AppRole): Supervisao[] {
  const data = getDemoData();
  if (role === "coordenacao") return data.supervisoes;
  const eu = data.personas[role];
  const supervisionadas = new Set(
    data.duplas.filter((d) => d.supervisor?.id === eu.id).map((d) => d.id)
  );
  return data.supervisoes.filter(
    (s) =>
      s.supervisor_id === eu.id ||
      s.mentor_id === eu.id ||
      (s.dupla_id != null && supervisionadas.has(s.dupla_id))
  );
}

/** Últimas sessões no escopo do papel — ordenação da real (data desc,
 *  created_at desc) + limit. */
export function demoSupervisoesRecentes(
  role: AppRole,
  limite = 6
): Supervisao[] {
  return [...demoSupervisoesEscopo(role)]
    .sort(
      (a, b) =>
        b.data.localeCompare(a.data) || b.created_at.localeCompare(a.created_at)
    )
    .slice(0, limite);
}

/** Sessões da dupla + as "gerais" do mentor dela — idem
 *  getSupervisoesDaDupla (or dupla_id.eq.X,and(mentor_id.eq.Y,dupla_id.is.null)). */
export function demoSupervisoesDaDupla(
  role: AppRole,
  duplaId: string,
  mentorId: string
): Supervisao[] {
  return demoSupervisoesEscopo(role)
    .filter(
      (s) =>
        s.dupla_id === duplaId ||
        (s.mentor_id === mentorId && s.dupla_id == null)
    )
    .sort((a, b) => b.data.localeCompare(a.data));
}

/** Sessões da pessoa — conduzidas (supervisor) ou recebidas (mentor),
 *  cap de 30 como a real. */
export function demoSupervisoesDaPessoa(
  role: AppRole,
  profileId: string
): Supervisao[] {
  return demoSupervisoesEscopo(role)
    .filter((s) => s.supervisor_id === profileId || s.mentor_id === profileId)
    .sort((a, b) => b.data.localeCompare(a.data))
    .slice(0, 30);
}

/** Documentos do intake da pessoa — coord-only como a real (a página da
 *  ficha já não monta a seção pra outros papéis; o [] aqui é o mesmo
 *  resultado que a RLS daria). */
export function demoDocumentosPessoa(
  role: AppRole,
  tipo: "profile" | "mentorado",
  id: string
): DocumentoPessoa[] {
  if (role !== "coordenacao") return [];
  return getDemoData().documentosPessoa.filter(
    (d) => (tipo === "mentorado" ? d.mentorado_id : d.profile_id) === id
  );
}

// ---------- formulários: leitura pública por token (0036/0042) ----------

/** O que a RPC formulario_por_token devolveria — usado pelo stub do client
 *  quando algum componente chama rpc() no browser. O status replica o CASE
 *  da função: respondido > inativo > expirado > pendente. */
export function demoFormularioPorToken(
  token: string
): FormularioPublico | null {
  const { formularios, links } = getDemoFormularios();
  const l = links.find((x) => x.token === token);
  if (!l) return null;
  const f = formularios.find((x) => x.id === l.formulario_id);
  if (!f) return null;
  const data = getDemoData();
  const destinatario = l.dest_profile_id
    ? (data.profiles.find((p) => p.id === l.dest_profile_id)?.nome ?? null)
    : l.dest_mentorado_id
      ? (data.mentorados.find((m) => m.id === l.dest_mentorado_id)?.nome ?? null)
      : null;
  const status: FormularioPublico["status"] = l.usado_em
    ? "respondido"
    : !f.ativo
      ? "inativo"
      : l.expira_em && new Date(l.expira_em).getTime() < Date.now()
        ? "expirado"
        : "pendente";
  return {
    status,
    expira_em: l.expira_em,
    respondido_em: l.usado_em,
    destinatario,
    formulario: {
      id: f.id,
      titulo: f.titulo,
      descricao: f.descricao,
      campos: f.campos,
      versao: f.versao,
      sistema: f.sistema ?? null,
    },
  };
}

// ---------- avaliação estrela do jovem (0071) ----------
// Replica a mesma fronteira do RLS real — a demo precisa mostrar os três
// cortes de privacidade pra vender a decisão do produto:
//   · embed avaliacao_jovem na dupla → coord/sup tudo; mentor DPP só as
//     linhas que o jovem liberou; especialista nada (a view dele é outra)
//   · média DPP → mesma regra de lote/quantização da RPC
//   · especialista → só estrelas das próprias sessões
//   · jovem → as próprias linhas; links → só coordenação

/** Embed `avaliacao_jovem` por papel — idem avaliacoes_select (0071).
 *  Aplicada depois do escopo de duplasDoPapel: pro supervisor, "as
 *  supervisionadas" já veio no filtro de cima — aqui dentro vale tudo. */
function comAvaliacaoJovem(
  duplas: Dupla[],
  role: AppRole,
  data: DemoData
): Dupla[] {
  const eu = data.personas[role];
  const porEncontro = new Map(
    data.avaliacoes.map((a) => [a.encontro_id, a])
  );
  // a ficha guarda o profile_id do login dela (0066) — fora do pick da
  // dupla (0076), então resolve pelo cadastro de mentorados
  const meuMentorado = data.mentorados.find(
    (m) => m.profile_id === eu.id
  )?.id;
  return duplas.map((d) => ({
    ...d,
    encontros: (d.encontros ?? []).map((e) => {
      const a = porEncontro.get(e.id) ?? null;
      const visivel =
        role === "coordenacao" ||
        role === "supervisor" ||
        (role === "mentor_dpp" && !!a?.avaliacao_visivel_mentor) ||
        // jovem lê as próprias — branch exists(jovem_duplas) da policy
        (role === "mentorado" && d.mentorado?.id === meuMentorado);
      return { ...e, avaliacao_jovem: visivel ? a : null };
    }),
  }));
}

/** O que avaliacao_por_token devolve — sem sessão na demo, identidade é
 *  sempre 'anon' (o ramo 'outra_pessoa' não existe sem login concorrente).
 *  Expiração lazy: pendente vencido conta como expirado, igual à RPC. */
export function demoAvaliacaoPorToken(
  token: string
): AvaliacaoTokenInfo | null {
  const data = getDemoData();
  const l = data.avaliacaoLinks.find((x) => x.token === token);
  if (!l) return null;
  const status: AvaliacaoTokenInfo["status"] =
    l.status === "pendente" && new Date(l.expira_em) < new Date()
      ? "expirado"
      : l.status;
  const d = data.duplas.find((x) => x.id === l.dupla_id);
  const enc = d?.encontros?.find((e) => e.id === l.encontro_id);
  return {
    status,
    identidade: "anon",
    respondida: data.avaliacoes.some((a) => a.encontro_id === l.encontro_id),
    encontro: enc
      ? {
          numero: enc.numero,
          data_hora: enc.data_hora,
          realizado_em: enc.realizado_em,
        }
      : undefined,
    mentor: d?.mentor
      ? { nome: d.mentor.nome.split(/\s+/)[0] ?? "" }
      : undefined,
    alvo: { jovem_nome: d?.mentorado?.nome ?? "" },
  };
}

/** Idem linkAvaliacaoMeta real — a trilha resolve se o toggle "mentor pode
 *  ler" aparece no form público (na especialista ele seria inerte). */
export function demoAvaliacaoLinkMeta(
  token: string
): { encontro_id: string; dupla_id: string; trilha: string } | null {
  const data = getDemoData();
  const l = data.avaliacaoLinks.find((x) => x.token === token);
  if (!l) return null;
  const d = data.duplas.find((x) => x.id === l.dupla_id);
  return {
    encontro_id: l.encontro_id,
    dupla_id: l.dupla_id,
    trilha: d?.trilha ?? "dpp",
  };
}

/** As avaliações que a persona mentorada enviou — branch exists(jovem_duplas)
 *  da policy; histórico (dupla concluída) incluído, como a real. */
export function demoJovemAvaliacoes(role: AppRole): JovemAvaliacao[] {
  if (role !== "mentorado") return [];
  const data = getDemoData();
  const m = mentoradoDaPersona(data, role);
  if (!m) return [];
  const duplaIds = new Set(
    data.duplas.filter((d) => d.mentorado?.id === m.id).map((d) => d.id)
  );
  const encPorId = new Map(
    data.duplas.flatMap((d) => (d.encontros ?? []).map((e) => [e.id, e]))
  );
  return data.avaliacoes
    .filter((a) => duplaIds.has(a.dupla_id))
    .map((a) => {
      const enc = encPorId.get(a.encontro_id);
      return {
        ...a,
        encontro: enc
          ? { numero: enc.numero, realizado_em: enc.realizado_em }
          : null,
      };
    })
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
}

/** Links da dupla — policy avaliacao_links_select é coord-only; [] pro
 *  resto, igual à tabela invisível da real. */
export function demoAvaliacaoLinks(
  role: AppRole,
  duplaId: string
): AvaliacaoLink[] {
  if (role !== "coordenacao") return [];
  return getDemoData()
    .avaliacaoLinks.filter((l) => l.dupla_id === duplaId)
    .sort((a, b) => a.created_at.localeCompare(b.created_at));
}

/** Média quantizada do DPP — mesmo desenho da RPC: lote de ≥3 (snapshot
 *  das k primeiras por created_at) + round(avg*2)/2. Fora do papel a RPC
 *  levanta exceção; aqui null fecha o mesmo "sem dados" da página. */
export function demoMediaDpp(
  role: AppRole,
  duplaId: string
): AvaliacaoMediaDpp | null {
  const data = getDemoData();
  const eu = data.personas[role];
  const d = data.duplas.find((x) => x.id === duplaId);
  if (
    role !== "mentor_dpp" ||
    !d ||
    d.trilha !== "dpp" ||
    d.mentor?.id !== eu.id
  )
    return null;
  const avaliacoes = data.avaliacoes
    .filter((a) => a.dupla_id === duplaId)
    .sort((a, b) => a.created_at.localeCompare(b.created_at));
  const n = avaliacoes.length;
  const k = Math.floor(n / 3) * 3;
  if (k < 3) return { n, liberado: false };
  const media =
    Math.round(
      (avaliacoes.slice(0, k).reduce((s, a) => s + a.estrelas, 0) / k) * 2
    ) / 2;
  return { n, liberado: true, media, base: k };
}

/** Linhas da view especialista_avaliacoes (0071) — SÓ estrelas das
 *  sessões da própria trilha de especialista; qualquer campo a mais
 *  identificaria o único avaliador possível. */
export function demoEspecialistaAvaliacoes(
  role: AppRole,
  duplaId: string
): EspecialistaAvaliacao[] {
  const data = getDemoData();
  const eu = data.personas[role];
  const d = data.duplas.find((x) => x.id === duplaId);
  if (
    role !== "mentor_especialista" ||
    !d ||
    d.trilha !== "especialista" ||
    d.mentor?.id !== eu.id
  )
    return [];
  const encPorId = new Map((d.encontros ?? []).map((e) => [e.id, e]));
  return data.avaliacoes
    .filter((a) => a.dupla_id === duplaId)
    .map((a) => ({
      id: a.id,
      dupla_id: a.dupla_id,
      encontro_id: a.encontro_id,
      estrelas: a.estrelas,
      numero: encPorId.get(a.encontro_id)?.numero ?? 0,
      realizado_em: encPorId.get(a.encontro_id)?.realizado_em ?? null,
      created_at: a.created_at,
    }))
    .sort((a, b) => a.numero - b.numero);
}

// ---------- chamados unificados (0084) ----------

// replica o escopo do RLS: coord vê tudo; auxiliar executivo vê tudo com
// plataforma mascarada (restrito); mentor/especialista/jovem só os próprios
// (autor_id ou autor_mentorado_id → nada vaza pelo dupla_id).
export function demoChamadosFila(role: AppRole): ChamadoFilaItem[] {
  const data = getDemoData();
  const eu = data.personas[role];
  const nome = (id: string | null | undefined) =>
    (id && (data.profiles.find((p) => p.id === id)?.nome ?? null)) || null;
  const nomeMentorado = (id: string | null | undefined) =>
    (id && (data.mentorados.find((m) => m.id === id)?.nome ?? null)) || null;
  const encontroNumero = (registroId: string | null, avaliacaoId: string | null) => {
    for (const d of data.duplas) {
      for (const e of d.encontros ?? []) {
        if (registroId && e.registro?.id === registroId) return e.numero;
        if (avaliacaoId && data.avaliacoes.some((a) => a.id === avaliacaoId && a.encontro_id === e.id))
          return e.numero;
      }
    }
    return null;
  };
  const staff = role === "coordenacao" || role === "supervisor";
  return data.chamados
    .filter((c) => {
      if (staff) return true;
      if (c.autor_id === eu.id) return true;
      const meuMentorado = data.mentorados.find((m) => m.profile_id === eu.id);
      return meuMentorado ? c.autor_mentorado_id === meuMentorado.id : false;
    })
    .map((c) => {
      const restrito = role === "supervisor" && c.categoria === "plataforma";
      const nEnc = encontroNumero(c.registro_id, c.avaliacao_id);
      const mNome = c.dupla_id
        ? (data.duplas.find((d) => d.id === c.dupla_id)?.mentorado?.nome ?? null)
        : null;
      const contexto = restrito
        ? null
        : c.registro_id
          ? `Registro do ${nEnc}º encontro${mNome ? ` · ${mNome}` : ""}`
          : c.avaliacao_id
            ? `Avaliação do ${nEnc}º encontro${mNome ? ` · ${mNome}` : ""}`
            : mNome
              ? `Dupla de ${mNome}`
              : null;
      return {
        ...(restrito
          ? {
              ...c,
              assunto: null, mensagem: null, descricao_outro: null,
              autor_id: null, autor_mentorado_id: null, dupla_id: null,
              atribuido_a: null, resolvido_por: null, resolucao_resumo: null,
              registro_id: null, avaliacao_id: null,
            }
          : c),
        restrito,
        autor_nome: restrito
          ? null
          : (nome(c.autor_id) ?? nomeMentorado(c.autor_mentorado_id)),
        autor_papel: c.autor_id
          ? (data.profiles.find((p) => p.id === c.autor_id)?.role ?? null)
          : "mentorado",
        atribuido_nome: restrito ? null : nome(c.atribuido_a),
        contexto,
      } as ChamadoFilaItem;
    })
    .sort((a, b) => {
      const ord = { aberto: 0, em_atendimento: 1, resolvido: 2 } as const;
      const d = ord[a.status] - ord[b.status];
      return d !== 0 ? d : b.created_at.localeCompare(a.created_at);
    });
}

export function demoChamadoTimeline(
  chamadoId: string,
  staff: boolean
): ChamadoTimelineItem[] {
  const data = getDemoData();
  const nome = (id: string | null | undefined) =>
    (id && (data.profiles.find((p) => p.id === id)?.nome ?? null)) || null;
  const out: ChamadoTimelineItem[] = data.chamadoAtualizacoes
    .filter((u) => u.chamado_id === chamadoId)
    .map((u) => ({
      tipo: u.tipo,
      item: { ...u, autor_nome: nome(u.autor_id) },
    }));
  if (staff) {
    for (const c of data.chamadoComentarios.filter(
      (x) => x.chamado_id === chamadoId
    )) {
      out.push({ tipo: "interno", item: { ...c, autor_nome: nome(c.autor_id) } });
    }
  }
  for (const a of data.chamadoAnexos.filter(
    (x) => x.chamado_id === chamadoId && (!x.interno || staff)
  )) {
    out.push({ tipo: "anexo", item: { ...a, autor_nome: nome(a.created_by) } });
  }
  return out.sort((a, b) => a.item.created_at.localeCompare(b.item.created_at));
}

export function demoChamadosSemDono(role: AppRole): number {
  if (role !== "coordenacao" && role !== "supervisor") return 0;
  return demoChamadosFila(role).filter(
    (c) => c.status === "aberto" && !c.atribuido_a && !c.restrito
  ).length;
}
