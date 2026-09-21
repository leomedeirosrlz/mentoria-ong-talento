import { getDemoData, type DemoData } from "./data";
import { registroTardio } from "../ciclo";
import { normaliza } from "../utils";
import type {
  AppRole,
  CicloEvento,
  Comunicado,
  Dupla,
  DuplaResumo,
  EspecialistaEvento,
  Material,
  Mentorado,
  Notificacao,
  PessoaNota,
  Profile,
  RegistroAnexo,
  SolicitacaoEspecialista,
} from "../types";
// Só tipos das queries reais — `import type` é apagado no build, então o
// ciclo queries.ts → demo/queries.ts → queries.ts não existe em runtime.
import type {
  DuplaOpcao,
  DuplaPerfil,
  FiltrosRegistro,
  MentorProfile,
  PessoaPerfil,
  RegistroResumo,
} from "../queries";
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

/** Contato em mentor/supervisor de cada dupla — idem mergeContatoDuplas. */
function comContatoDuplas(
  duplas: Dupla[],
  contatos: Map<string, Contato>
): Dupla[] {
  return duplas.map((d) => ({
    ...d,
    mentor: d.mentor ? comContato(d.mentor, contatos) : d.mentor,
    supervisor: d.supervisor ? comContato(d.supervisor, contatos) : null,
  }));
}

/** Persona do papel + marca de onboarding do cookie demo (o gate do wizard
 *  lê onboarded_em via getMe). */
export function demoMe(role: AppRole, onboarded: boolean): Profile {
  const p = getDemoData().personas[role];
  return comContato(
    { ...p, onboarded_em: onboarded ? new Date().toISOString() : null },
    demoContatosMap(role)
  );
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
    .filter((d) => todas || d.status !== "encerrada")
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

/** /pessoas é coord-only — o mapa de contato dela cobre todos os profiles. */
export function demoPessoas(role: AppRole): Profile[] {
  const contatos = demoContatosMap(role);
  return getDemoData()
    .profiles.map((p) => comContato(p, contatos))
    .sort(porNome);
}

export function demoMentorados(): Mentorado[] {
  return [...getDemoData().mentorados].sort(porNome);
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
    return {
      tipo: "profile",
      pessoa: comContato(p, contatos),
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
    // mentor sem vínculo ao mentorado: a RLS responderia vazio → notFound
    if (!ehStaff && duplas.length === 0) return null;
    return { tipo: "mentorado", pessoa: m, duplas, notas: notasDe("mentorado_id") };
  }
  return null;
}

export function demoMentorProfiles(): MentorProfile[] {
  return getDemoData().mentorProfiles;
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
