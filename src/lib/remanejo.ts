// Sugestão de remanejo (REALIZA-115) — quando a dupla entra em risco, a
// pergunta operacional da coordenação é "se for pra trocar um lado, com
// quem?". Os pools e a ordem saem daqui, puros e testáveis:
//
// - mentores: mesmo papel da trilha da dupla, ativos, menos quem já está
//   nela. Cheio NÃO sai da lista — desce marcado ("sem vaga") porque a
//   saída dele é ajustar a capacidade, não procurar outro nome.
// - mentorados: a fila "Aguardando par" (filaMentorados) — quem nunca
//   teve dupla e segue no programa; a ordem da fila é o desempate, porque
//   a fila é uma promessa por ordem de chegada.
//
// A ordem usa a mesma matéria do AfinidadePar (interesses — com as áreas
// do mentor contando como tema dele —, agenda, cidade/UF, preferência de
// gênero do par). O score ordena, os motivos explicam o porquê da ordem;
// quem decide é sempre a coordenação, e o write segue sendo o
// remanejarDupla/rematch_dupla de sempre.

import {
  comparaNome,
  DIAS_SEMANA_LABELS,
  GENERO_LABELS,
  periodosCruzam,
} from "./ciclo";
import { tetoMentor, type FilaItem } from "./fila";
import { normaliza } from "./utils";
import type {
  Disponibilidade,
  Genero,
  Mentorado,
  MentorProfile,
  PrefGeneroPar,
  Profile,
} from "./types";

/** Um lado de um par hipotético — os campos de afinidade que o
 *  AfinidadePar já cruza, menos os sensíveis que fora da coordenação
 *  chegam null e simplesmente não pontuam. */
export type LadoMatching = {
  nome?: string | null;
  /** Quem é o lado — a preferência de gênero do mentorado pede
   *  "mentora"/"mentor", a do mentor pede "mentorada"/"mentorado". */
  papel?: "mentor" | "mentorado";
  interesses?: string[] | null;
  /** Áreas de atuação — só mentor tem (mentor_profiles.areas). */
  areas?: string[] | null;
  cidade?: string | null;
  uf?: string | null;
  genero?: Genero | null;
  pref_genero_par?: PrefGeneroPar | null;
  disponibilidade?: Disponibilidade | null;
};

export type Pontuacao = {
  /** Número puro de ordenação — agenda pesa mais (encontro que não encaixa
   *  derruba a dupla), depois temas em comum, depois proximidade. */
  score: number;
  /** Sinais positivos em pt-BR — o "por que" da posição, chip a chip. */
  motivos: string[];
  /** Fricções pra confirmar antes de fechar — preferência de par que não
   *  casa ou que não dá pra conferir (gênero não informado). */
  alertas: string[];
};

const primeiroNome = (n?: string | null) => (n ?? "?").split(" ")[0];

/** O lado de um mentor (profile + ficha mentor_profiles) pro cruzamento —
 *  a disponibilidade e as áreas moram na ficha, não no cadastro. */
export function ladoDeMentor(
  p: Pick<
    Profile,
    | "nome"
    | "interesses"
    | "areas"
    | "cidade"
    | "uf"
    | "genero"
    | "pref_genero_par"
  >,
  mp?: Pick<MentorProfile, "areas" | "disponibilidade"> | null
): LadoMatching {
  return {
    nome: p.nome,
    papel: "mentor",
    interesses: p.interesses ?? null,
    // as áreas da ficha de matching são o dado do AfinidadePar; a do
    // perfil público é apresentação — só entra se a ficha estiver vazia
    areas: mp?.areas?.length ? mp.areas : (p.areas ?? null),
    cidade: p.cidade ?? null,
    uf: p.uf ?? null,
    genero: p.genero ?? null,
    pref_genero_par: p.pref_genero_par ?? null,
    disponibilidade: mp?.disponibilidade ?? null,
  };
}

/** Idem pro lado do mentorado — aceita tanto o cadastro completo (coord,
 *  com os sensíveis mergeados) quanto o embed da dupla (sem eles). */
export function ladoDeMentorado(
  m: Pick<
    Mentorado,
    | "nome"
    | "interesses"
    | "cidade"
    | "uf"
    | "genero"
    | "pref_genero_par"
    | "disponibilidade"
  >
): LadoMatching {
  return {
    nome: m.nome,
    papel: "mentorado",
    interesses: m.interesses ?? null,
    cidade: m.cidade ?? null,
    uf: m.uf ?? null,
    genero: m.genero ?? null,
    pref_genero_par: m.pref_genero_par ?? null,
    disponibilidade: m.disponibilidade ?? null,
  };
}

/** Temas que batem nos dois lados — as áreas do mentor contam como tema
 *  dele: "atua em comunicação" casa com "curte comunicação" (o vocabulário
 *  da 0034 é o mesmo dos dois lados). Comparados normalizados (caixa/
 *  acento); devolvidos com a grafia original do lado `a`, pra exibição. */
function temasComuns(a: LadoMatching, b: LadoMatching): string[] {
  const nb = new Set(
    [...(b.interesses ?? []), ...(b.areas ?? [])].map(normaliza)
  );
  const vistos = new Set<string>();
  const comuns: string[] = [];
  for (const t of [...(a.interesses ?? []), ...(a.areas ?? [])]) {
    const n = normaliza(t);
    if (!n || vistos.has(n) || !nb.has(n)) continue;
    vistos.add(n);
    comuns.push(t);
  }
  return comuns;
}

/** Preferência de gênero de um lado contra o gênero declarado do outro —
 *  a mesma régua do alertaGenero do AfinidadePar. Mismatch explícito
 *  penaliza o score; gênero não informado vira só nota (confirma, não
 *  desempata — preferir não dizer é direito, não defeito). */
function checkPrefGenero(
  quem: LadoMatching,
  outro: LadoMatching
): { texto: string; penaliza: boolean } | null {
  const pref = quem.pref_genero_par;
  if (!pref || pref === "indiferente") return null;
  const rotulo =
    quem.papel === "mentorado"
      ? pref === "feminino"
        ? "mentora"
        : "mentor"
      : pref === "feminino"
        ? "mentorada"
        : "mentorado";
  const q = primeiroNome(quem.nome);
  const o = primeiroNome(outro.nome);
  const g = outro.genero;
  if (!g || g === "prefiro_nao_dizer") {
    return {
      penaliza: false,
      texto: `${q} prefere ${rotulo}; ${o} ${
        g === "prefiro_nao_dizer"
          ? "preferiu não informar o gênero"
          : "não informou o gênero"
      }.`,
    };
  }
  if (g !== pref) {
    return {
      penaliza: true,
      texto: `${q} prefere ${rotulo}; ${o} se cadastrou como ${GENERO_LABELS[g].toLocaleLowerCase("pt-BR")}.`,
    };
  }
  return null;
}

/** Afinidade entre dois lados de um par hipotético. O número só ordena —
 *  os motivos/alertas são o que a coordenação lê de fato. Pesos: agenda
 *  (+4) porque encontro que não encaixa derruba a dupla; cada tema em
 *  comum +2; mesma cidade +2 / mesmo estado +1; preferência de par não
 *  atendida −3 (penaliza, não exclui — a decisão é humana). */
export function afinidadeScore(a: LadoMatching, b: LadoMatching): Pontuacao {
  let score = 0;
  const motivos: string[] = [];
  const alertas: string[] = [];

  const dias = (a.disponibilidade?.dias ?? []).filter((d) =>
    (b.disponibilidade?.dias ?? []).includes(d)
  );
  if (
    dias.length > 0 &&
    periodosCruzam(a.disponibilidade?.periodos, b.disponibilidade?.periodos)
  ) {
    score += 4;
    motivos.push(
      `agendas se cruzam (${dias.map((d) => DIAS_SEMANA_LABELS[d]).join(", ")})`
    );
  }

  const comuns = temasComuns(a, b);
  if (comuns.length > 0) {
    score += comuns.length * 2;
    motivos.push(
      comuns.length === 1
        ? `tema em comum: ${comuns[0]}`
        : `${comuns.length} temas em comum: ${comuns.slice(0, 3).join(", ")}${comuns.length > 3 ? ` +${comuns.length - 3}` : ""}`
    );
  }

  if (a.cidade && b.cidade && normaliza(a.cidade) === normaliza(b.cidade)) {
    score += 2;
    motivos.push(`mesma cidade (${a.cidade})`);
  } else if (a.uf && b.uf && normaliza(a.uf) === normaliza(b.uf)) {
    score += 1;
    motivos.push(`mesmo estado (${a.uf})`);
  }

  // a preferência vale nos dois sentidos — o lado que fica e o que entra
  // podem ter pedido um par que o outro não é
  for (const check of [checkPrefGenero(a, b), checkPrefGenero(b, a)]) {
    if (!check) continue;
    alertas.push(check.texto);
    if (check.penaliza) score -= 3;
  }

  return { score, motivos, alertas };
}

/** Ocupação do mentor na régua do trigger (0073): duplas ativas/pausadas
 *  dele contra o teto da pool da própria trilha. */
export type OcupacaoMentor = { usadas: number; teto: number };

export function ocupacaoMentor(
  p: Pick<Profile, "role">,
  mp: MentorProfile | undefined,
  usadas: number | undefined
): OcupacaoMentor {
  return { usadas: usadas ?? 0, teto: tetoMentor(p, mp) };
}

export type CandidatoMentor = {
  profile: Profile;
  usadas: number;
  teto: number;
  /** false = sem vaga — fica marcado na lista porque a saída dele é
   *  "aumentar capacidade", não desaparecer da conversa. */
  livre: boolean;
  pontuacao: Pontuacao;
};

/** Mentores candidatos a assumir o par: mesmo papel da trilha (mentor
 *  DPP nunca vira par de trilha especialista e vice-versa), ativos, menos
 *  quem já está na dupla. Livres primeiro por afinidade; os cheios descem
 *  ao fim marcados — o remanejo exige vaga, mas a ficha mostra quem
 *  faltaria só um ajuste de capacidade. */
export function ranquearMentores(
  pessoas: Profile[],
  papel: "mentor_dpp" | "mentor_especialista",
  mentorProfiles: Record<string, MentorProfile>,
  usadas: Record<string, number>,
  par: LadoMatching,
  excluirId?: string
): CandidatoMentor[] {
  return pessoas
    .filter((p) => p.role === papel && p.ativo && p.id !== excluirId)
    .map((p) => {
      const o = ocupacaoMentor(p, mentorProfiles[p.id], usadas[p.id]);
      return {
        profile: p,
        usadas: o.usadas,
        teto: o.teto,
        livre: o.usadas < o.teto,
        pontuacao: afinidadeScore(
          ladoDeMentor(p, mentorProfiles[p.id]),
          par
        ),
      };
    })
    .sort(
      (a, b) =>
        Number(b.livre) - Number(a.livre) ||
        b.pontuacao.score - a.pontuacao.score ||
        comparaNome(a.profile.nome, b.profile.nome)
    );
}

export type CandidatoMentorado = {
  mentorado: Mentorado;
  /** Início da espera na fila (carimbo do filaMentorados) — contextualiza
   *  a sugestão ("há 40 dias esperando") e desempata. */
  desde: string | null;
  pontuacao: Pontuacao;
};

/** Mentorados da fila "Aguardando par" ranqueados por afinidade com quem
 *  fica na dupla. A entrada já é a fila pura — fora-do-programa, ocupados
 *  e quem já teve dupla nunca chegam aqui — então a ordem da fila é o
 *  desempate honesto (mais antigo primeiro). */
export function ranquearMentorados(
  fila: FilaItem[],
  mentorados: Mentorado[],
  par: LadoMatching
): CandidatoMentorado[] {
  const porId = new Map(mentorados.map((m) => [m.id, m]));
  const espera = new Map(fila.map((f, i) => [f.id, i]));
  return fila
    .flatMap((f) => {
      const m = porId.get(f.id);
      if (!m) return [];
      return [
        {
          mentorado: m,
          desde: f.desde,
          pontuacao: afinidadeScore(ladoDeMentorado(m), par),
        },
      ];
    })
    .sort(
      (a, b) =>
        b.pontuacao.score - a.pontuacao.score ||
        (espera.get(a.mentorado.id) ?? Infinity) -
          (espera.get(b.mentorado.id) ?? Infinity) ||
        comparaNome(a.mentorado.nome, b.mentorado.nome)
    );
}
