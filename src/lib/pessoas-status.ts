import { idade } from "./ciclo";
import { temPapel } from "./types";
import type { AppRole, Mentorado, Profile } from "./types";

// Vocabulário de status e filiação por turma do /pessoas (REALIZA-39).
// Tudo aqui é PURO: entradas = os mapas que a página já carrega (duplas,
// turma_inscricoes, profile_papeis escopado, assinaturas, faltantes,
// último acesso da view profiles_acesso/0192); saída = status primário +
// secundários e a lista de turmas com papel contextual.

// ---------- status ----------

/** Vocabulário fechado — os únicos badges de status do /pessoas. A ordem
 *  declarativa É a precedência do primário (inativo sempre ganha). */
export type StatusPessoa =
  | "inativo"
  | "convidado"
  | "nao_acessou"
  | "termo_pendente"
  | "docs_pendentes"
  | "ativo";

export const STATUS_PESSOA_LABEL: Record<StatusPessoa, string> = {
  inativo: "inativo",
  convidado: "convidado",
  nao_acessou: "não acessou",
  termo_pendente: "termo pendente",
  docs_pendentes: "documentos pendentes",
  ativo: "ativo",
};

/** Janela operacional do "não acessou": quem entrou mas não volta há mais
 *  de 30 dias precisa de nudge — abaixo disso o silêncio é normal (encontros
 *  quinzenais não pedem login semanal). */
export const ACESSO_STALE_DIAS = 30;

/** O que o status precisa saber — derivado dos mapas da página, não de
 *  novas colunas. O chamador resolve `termoOk`/`docsFaltantes` com a mesma
 *  régua dos badges atuais (pendenciasPessoa/pendenciasMentorado). */
export type SinaisStatusPessoa = {
  /** profile.ativo / !foraDoPrograma(mentorado). */
  ativo: boolean;
  /** profiles.user_id set / mentorados.profile_id set. */
  contaVinculada: boolean;
  onboardedEm: string | null;
  /** profiles_acesso.ultimo_acesso_em (0192) — com onboarded_em set, null
   *  vale "nunca acessou" (o auth não registra primeiro acesso pré-track). */
  ultimoAcessoEm: string | null;
  termoOk: boolean;
  /** labels de civis faltantes do documento devido — vazio quando completo. */
  docsFaltantes: string[];
  agora?: Date;
};

export type StatusPessoas = {
  primario: StatusPessoa;
  /** pendências que coexistem com o primário — "convidado" e "não
   *  acessou" podem carregar termo/docs; "inativo" não acusa nada. */
  secundarios: StatusPessoa[];
};

/** Primário pela precedência da spec (inativo > convidado > não acessou >
 *  termo > docs > ativo) + secundários de pendência. O "não acessou" exige
 *  o sinal real da 0192: onboarded + último acesso nulo/antigo. Sem
 *  onboarded_em o "não acessou" não se fabrica de nada — convidado cobre
 *  quem tem conta esperando e quem nem conta tem cai no resto da régua. */
export function statusDePessoa(s: SinaisStatusPessoa): StatusPessoas {
  const secundarios: StatusPessoa[] = [];
  const pendTermo = !s.termoOk;
  const pendDocs = s.docsFaltantes.length > 0;

  if (!s.ativo) return { primario: "inativo", secundarios };

  let primario: StatusPessoa;
  if (s.contaVinculada && !s.onboardedEm) {
    primario = "convidado";
  } else if (
    s.onboardedEm &&
    (!s.ultimoAcessoEm ||
      new Date(s.ultimoAcessoEm).getTime() <
        (s.agora ?? new Date()).getTime() - ACESSO_STALE_DIAS * 86400e3)
  ) {
    primario = "nao_acessou";
  } else if (pendTermo) {
    primario = "termo_pendente";
  } else if (pendDocs) {
    primario = "docs_pendentes";
  } else {
    primario = "ativo";
  }

  if (pendTermo && primario !== "termo_pendente")
    secundarios.push("termo_pendente");
  if (pendDocs && primario !== "docs_pendentes")
    secundarios.push("docs_pendentes");
  return { primario, secundarios };
}

// ---------- régua de termo compartilhada (insumo do status) ----------

/** Forma mínima do DocsPessoa da página — o status só precisa saber se o
 *  slug assinou; o id/em ficam na camada de UI. */
export type DocsResumo = {
  assinado: Record<string, unknown>;
  pendente: string[];
};

/** termoOk do profile — a mesma régua dos badges: não-voluntário e conta
 *  de jovem não devem; mentor responde via mentor_profiles.termo_ok;
 *  demais pela assinatura por link ou o documento_path direto. */
export function termoOkProfile(
  p: Pick<Profile, "role" | "papeis"> & {
    voluntario?: boolean | null;
    documento_path?: string | null;
  },
  mp: { termo_ok?: boolean | null } | undefined,
  docs: DocsResumo | undefined
): boolean {
  if (p.voluntario === false || p.role === "mentorado") return true;
  if (temPapel(p, "mentor_dpp") || temPapel(p, "mentor_especialista"))
    return Boolean(mp?.termo_ok);
  return (
    docs?.assinado["termo-voluntario"] !== undefined ||
    Boolean(p.documento_path)
  );
}

/** O documento devido do jovem depende da idade (0046): menor assina via
 *  autorização do responsável (link ou upload); maior, o termo de
 *  participação. Slug do doc devido — insumo dos faltantes do status. */
export function slugDocMentorado(
  m: Pick<Mentorado, "data_nascimento">
): "autorizacao-responsavel" | "termo-mentorando" {
  const anos = idade(m.data_nascimento);
  return anos != null && anos < 18
    ? "autorizacao-responsavel"
    : "termo-mentorando";
}

export function termoOkMentorado(
  m: Pick<Mentorado, "data_nascimento" | "documento_path">,
  docs: DocsResumo | undefined
): boolean {
  const slug = slugDocMentorado(m);
  return slug === "autorizacao-responsavel"
    ? Boolean(m.documento_path) || docs?.assinado[slug] !== undefined
    : docs?.assinado[slug] !== undefined;
}

// ---------- filiação por turma ----------

/** Papel contextual dentro da turma — o que a pessoa faz NAQUELA turma,
 *  não o profiles.role global. O label é o vocabulário da spec: mentor
 *  distingue a trilha, staff escopado é auxiliar, fila é aguardando par. */
export type PapelTurma =
  | "mentor_dpp"
  | "mentor_especialista"
  | "mentorado"
  | "auxiliar"
  | "aguardando"
  | "equipe";

export const PAPEL_TURMA_LABEL: Record<PapelTurma, string> = {
  mentor_dpp: "Mentor DPP",
  mentor_especialista: "Especialista",
  mentorado: "Mentorado(a)",
  auxiliar: "Auxiliar executivo",
  aguardando: "Aguardando par",
  equipe: "Equipe",
};

export type TurmaPapel = { turma: string; papel: PapelTurma };

/** Inscrição de turma mínima — qualquer status: `aguardando` marca o
 *  papel "Aguardando par"; formada/desistiu seguem a regra da dupla/
 *  situação (a filiação à turma segue valendo). */
export type InscricaoTurma = {
  turma: string;
  profile_id: string | null;
  mentorado_id: string | null;
  papel_esperado: "mentor" | "mentorado";
  status: "aguardando" | "formada" | "desistiu";
};

/** Grant escopado de profile_papeis (0085/0125): papel staff numa turma
 *  sem passar por dupla — supervisor/auxiliar escopado, coord de turma. */
export type PapelEscopo = {
  profile_id: string;
  papel: AppRole | string;
  escopo_turma: string;
};

/** Dupla mínima pra filiação — todas as duplas entram (o vínculo à turma
 *  é histórico, não morre com o encerramento). */
export type DuplaTurma = {
  mentor_id: string;
  mentorado_id: string;
  supervisor_id: string | null;
  trilha: "dpp" | "especialista" | string;
  turma: string | null;
};

export type MapasTurma = {
  duplas: DuplaTurma[];
  inscricoes?: InscricaoTurma[];
  papeisEscopo?: PapelEscopo[];
};

function papelDoEscopo(papel: string): PapelTurma | null {
  if (papel === "supervisor") return "auxiliar";
  if (papel === "coordenacao") return "equipe";
  if (papel === "mentor_dpp") return "mentor_dpp";
  if (papel === "mentor_especialista") return "mentor_especialista";
  return null;
}

/** As turmas da pessoa com papel contextual — por ordem de evidência:
 *  dupla formada (duplas.turma, papel pela trilha/vínculo), turma_inscricoes
 *  (aguardando marca o papel), escopo_turma do grant staff. Sem dedução de
 *  partição: quem é mentor DPP na T1 e especialista na T2 aparece nas
 *  DUAS; quem tem dois papéis na mesma turma devolve as duas linhas. */
export function turmasDePessoa(
  alvo: { tipo: "profile" | "mentorado"; id: string },
  mapas: MapasTurma
): TurmaPapel[] {
  const out: TurmaPapel[] = [];
  const push = (turma: string | null | undefined, papel: PapelTurma) => {
    if (!turma) return;
    if (!out.some((x) => x.turma === turma && x.papel === papel))
      out.push({ turma, papel });
  };

  for (const d of mapas.duplas) {
    if (alvo.tipo === "profile" && d.mentor_id === alvo.id)
      push(
        d.turma,
        d.trilha === "especialista" ? "mentor_especialista" : "mentor_dpp"
      );
    if (alvo.tipo === "mentorado" && d.mentorado_id === alvo.id)
      push(d.turma, "mentorado");
    if (alvo.tipo === "profile" && d.supervisor_id === alvo.id)
      push(d.turma, "auxiliar");
  }

  for (const i of mapas.inscricoes ?? []) {
    const dela =
      alvo.tipo === "profile"
        ? i.profile_id === alvo.id
        : i.mentorado_id === alvo.id;
    if (!dela) continue;
    if (i.status === "aguardando") push(i.turma, "aguardando");
    else
      push(
        i.turma,
        i.papel_esperado === "mentor" ? "mentor_dpp" : "mentorado"
      );
  }

  for (const pp of mapas.papeisEscopo ?? []) {
    if (alvo.tipo !== "profile" || pp.profile_id !== alvo.id) continue;
    const papel = papelDoEscopo(pp.papel);
    if (papel) push(pp.escopo_turma, papel);
  }

  return out;
}

/** Os papéis da pessoa NUMA turma — o card lista todos quando >1 (o
 *  híbrido DPP+auxiliar não escolhe um rótulo só). */
export function papeisNaTurma(
  alvo: { tipo: "profile" | "mentorado"; id: string },
  turma: string,
  mapas: MapasTurma
): PapelTurma[] {
  return turmasDePessoa(alvo, mapas)
    .filter((t) => t.turma === turma)
    .map((t) => t.papel);
}

/** Papel principal da pessoa na turma — primeiro por ordem de evidência
 *  (participação em dupla pesa mais que escopo/fila). Null = não é da turma. */
export function papelNaTurma(
  alvo: { tipo: "profile" | "mentorado"; id: string },
  turma: string,
  mapas: MapasTurma
): PapelTurma | null {
  return papeisNaTurma(alvo, turma, mapas)[0] ?? null;
}

/** Ordem da subseção dentro da turma (spec: mentorados, mentores, staff) —
 *  "aguardando" ranqueia pelo lado da inscrição (jovem aguardando é
 *  mentorado, mentor aguardando é mentor). */
export function rankNaTurma(
  papeis: PapelTurma[],
  tipo: "profile" | "mentorado"
): number {
  if (papeis.includes("mentorado")) return 0;
  if (tipo === "mentorado" && papeis.includes("aguardando")) return 0;
  if (papeis.includes("mentor_dpp") || papeis.includes("mentor_especialista"))
    return 1;
  if (tipo === "profile" && papeis.includes("aguardando")) return 1;
  return 2;
}
