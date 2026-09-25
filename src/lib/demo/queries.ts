import { getDemoData, type DemoData } from "./data";
import { registroTardio } from "../ciclo";
import { normaliza } from "../utils";
import type {
  AppRole,
  Assinatura,
  AssinaturaResumo,
  AssinaturaVia,
  CicloEvento,
  Comunicado,
  DadosCivis,
  Dupla,
  DuplaResumo,
  EspecialistaEvento,
  Material,
  Mentorado,
  Notificacao,
  PessoaNota,
  Presenca,
  Profile,
  RegistroAnexo,
  SolicitacaoEspecialista,
  Supervisao,
} from "../types";
// Só tipos das queries reais — `import type` é apagado no build, então o
// ciclo queries.ts → demo/queries.ts → queries.ts não existe em runtime.
import type {
  DadosPessoais,
  DuplaOpcao,
  DuplaPerfil,
  FiltrosRegistro,
  MentorProfile,
  PessoaPerfil,
  RegistroResumo,
} from "../queries";
import type { ResumoFormacao } from "../queries-presenca";
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
] as const;

function semPessoal<P>(p: P): P {
  const q = { ...(p as Record<string, unknown>) };
  for (const k of CAMPOS_PESSOAIS) delete q[k];
  return q as P;
}

/** Contato em mentor/supervisor de cada dupla — idem mergeContatoDuplas.
 *  O embed real lista só colunas públicas: o strip dos sensíveis vale pra
 *  TODO papel, inclusive coordenação (a ficha dela vem pelas views). */
function comContatoDuplas(
  duplas: Dupla[],
  contatos: Map<string, Contato>
): Dupla[] {
  return duplas.map((d) => ({
    ...d,
    mentor: d.mentor ? semPessoal(comContato(d.mentor, contatos)) : d.mentor,
    mentorado: d.mentorado ? semPessoal(d.mentorado) : d.mentorado,
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
  return [...getDemoData().cicloEventos].sort((a, b) =>
    a.data.localeCompare(b.data)
  );
}

export function demoEspecialistaEventos(): EspecialistaEvento[] {
  return [...getDemoData().especialistaEventos].sort(
    (a, b) => a.numero - b.numero
  );
}

export function demoMateriais(): Material[] {
  return [...getDemoData().materiais].sort((a, b) => a.ordem - b.ordem);
}

// ---------- duplas ----------

export function demoDuplas(role: AppRole): Dupla[] {
  const data = getDemoData();
  return comContatoDuplas(
    [...duplasDoPapel(data, role)].sort((a, b) =>
      criadoEm(a).localeCompare(criadoEm(b))
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
    [...minhas].sort((a, b) => criadoEm(a).localeCompare(criadoEm(b))),
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

/** /pessoas é coord-only — o mapa de contato dela cobre todos os profiles;
 *  os sensíveis (profiles_pessoal) só entram pra coordenação, como na real. */
export function demoPessoas(role: AppRole): Profile[] {
  const contatos = demoContatosMap(role);
  return getDemoData()
    .profiles.map((p) => {
      const c = comContato(p, contatos);
      return role === "coordenacao" ? c : semPessoal(c);
    })
    .sort(porNome);
}

export function demoMentorados(role: AppRole): Mentorado[] {
  const lista = [...getDemoData().mentorados].sort(porNome);
  // grant por coluna da 0034: nascimento/gênero/pref./motivação ficam de fora
  // pra qualquer papel ≠ coordenação (a real lê pela view mentorados_pessoal)
  return role === "coordenacao" ? lista : lista.map(semPessoal);
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
 *  Espelha a real + o guard da página: profile de terceiro não abre pra
 *  mentor (a page redireciona o próprio pra /perfil e dá notFound nos demais);
 *  mentorado aparece pra staff sempre (RLS de mentorados libera coord/sup) e
 *  pro mentor só se estiver numa dupla dele. Notas são privadas do autor
 *  (0017) — só as da persona voltam. */
export function demoPessoaPerfil(
  role: AppRole,
  id: string
): (PessoaPerfil & { duplas: DuplaPerfil[]; notas: PessoaNota[] }) | null {
  const data = getDemoData();
  const eu = data.personas[role];
  const contatos = demoContatosMap(role);
  const escopo = duplasDoPapel(data, role);
  const ehStaff = role === "coordenacao" || role === "supervisor";
  const desc = (a: Dupla, b: Dupla) => criadoEm(b).localeCompare(criadoEm(a));
  const notasDe = (campo: "profile_id" | "mentorado_id") =>
    data.pessoaNotas
      .filter((n) => n[campo] === id && n.created_by === eu.id)
      .sort((a, b) => b.created_at.localeCompare(a.created_at));

  const p = data.profiles.find((x) => x.id === id);
  if (p) {
    if (!ehStaff && id !== eu.id) return null;
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
    return {
      tipo: "mentorado",
      pessoa: role === "coordenacao" ? m : semPessoal(m),
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
 *  de 15 mesmo com a lista paginada). */
export function demoNotificacoes(role: AppRole): {
  itens: Notificacao[];
  naoLidas: number;
} {
  const lista = [...(getDemoData().notificacoes[role] ?? [])].sort((a, b) =>
    b.created_at.localeCompare(a.created_at)
  );
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
  return getDemoData()
    .comunicados.filter(visivel)
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, 5);
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
      mentor: d.mentor ? { nome: d.mentor.nome } : null,
      mentorado: d.mentorado ? { nome: d.mentorado.nome } : null,
    }))
    .sort((a, b) =>
      (a.mentor?.nome ?? "").localeCompare(b.mentor?.nome ?? "", "pt-BR")
    );
}

// ---------- trilha de especialista (0027) ----------

/** Última solicitação da dupla DPP (qualquer status) — só se a dupla estiver
 *  no escopo do papel (sol_select: mentor/supervisor da dupla de origem). */
export function demoSolicitacaoDaDupla(
  role: AppRole,
  duplaDppId: string
): SolicitacaoEspecialista | null {
  const data = getDemoData();
  const noEscopo = duplasDoPapel(data, role).some((d) => d.id === duplaDppId);
  if (!noEscopo) return null;
  return (
    data.solicitacoes
      .filter((s) => s.dupla_dpp_id === duplaDppId)
      .sort((a, b) => b.created_at.localeCompare(a.created_at))[0] ?? null
  );
}

/** O que o papel vê no mural (sol_select, 0027): coord tudo; especialista as
 *  abertas + as que aceitou; mentor/supervisor as das próprias duplas.
 *  Ordenação da real: status asc (a ordem alfabética já dá aberta → aceita →
 *  cancelada), created_at desc dentro de cada grupo. */
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
      (s) => s.status === "aberta" || s.especialista_id === eu.id
    );
  } else {
    const ids = new Set(duplasDoPapel(data, role).map((d) => d.id));
    lista = data.solicitacoes.filter((s) => ids.has(s.dupla_dpp_id));
  }
  return [...lista].sort(
    (a, b) =>
      a.status.localeCompare(b.status) ||
      b.created_at.localeCompare(a.created_at)
  );
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

/** Histórico da ficha — só a coordenação abre fichas de terceiros. */
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
  const assinavel =
    a.status === "pendente" &&
    (!a.token_expira_em || a.token_expira_em > new Date().toISOString());
  const civis = !assinavel
    ? null
    : slug === "autorizacao-responsavel"
      ? mentorado?.responsavel ?? null
      : profile?.dados_civis ?? mentorado?.dados_civis ?? null;
  return {
    id: a.id,
    status: a.status,
    assinado_em: a.assinado_em,
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

/** "N de M encontros de formação" da ficha — idem getResumoFormacao. O
 *  dataset demo tem um único ciclo de formação, então o recorte "ciclo
 *  vigente" da real é a lista inteira de eventos 'formacao'. Fora do escopo
 *  de leitura o count zera — como a RLS devolveria. */
export function demoResumoFormacao(
  role: AppRole,
  profileId: string
): ResumoFormacao {
  const data = getDemoData();
  const ids = data.cicloEventos
    .filter((e) => e.tipo === "formacao")
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
