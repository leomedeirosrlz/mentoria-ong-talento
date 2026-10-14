import type {
  CicloEvento,
  CorRaca,
  Cronograma,
  DiaSemana,
  Dificuldade,
  Disponibilidade,
  DocumentoPessoa,
  Dupla,
  Encontro,
  Escolaridade,
  EspecialistaEvento,
  Genero,
  Periodo,
  PrefGeneroPar,
  Registro,
  SituacaoMentorado,
  Trilha,
} from "./types";

export type Semaforo = "ok" | "atencao" | "risco";

// ---------- trilhas (0027) ----------

/** Encontros por trilha: DPP = 16 (calendário oficial), especialista
 *  = 5 (até 3 meses, sem datas fixas — o especialista agenda). */
export const TRILHA_LEN: Record<Trilha, number> = { dpp: 16, especialista: 5 };

/** Teto de encontros da dupla — null/undefined cai em DPP (todas as duplas
 *  anteriores à 0027 são DPP). */
export function maxEncontros(trilha: Trilha | null | undefined): number {
  return TRILHA_LEN[trilha ?? "dpp"];
}

export const TRILHA_LABEL: Record<Trilha, string> = {
  dpp: "DPP",
  especialista: "Especialista",
};

/** Passo do guia de uma trilha — forma unificada do CicloEvento (DPP, com
 *  data oficial no calendário) e do EspecialistaEvento (sem data: a dupla
 *  combina os 5 encontros dentro dos 3 meses). É o que a jornada, a ficha e
 *  a "sugestão do guia" do registro consomem. */
export type PassoGuia = {
  id: string;
  numero: number;
  titulo: string;
  /** Data oficial do ciclo (YYYY-MM-DD) — null na trilha especialista. */
  data: string | null;
  fase: string | null;
  /** Instrumentos sugeridos pelo guia (DPP) — vazio na especialista. */
  instrumentos: string[];
  /** Foco do encontro (trilha especialista) — complementa a sugestão do guia. */
  foco?: string | null;
  /** Nota operacional do cronograma oficial (0062) — só DPP tem. */
  observacao?: string | null;
};

/** Normaliza os passos da trilha: DPP vem de `ciclo_eventos` (encontros
 *  numerados, com data); especialista vem de `especialista_eventos` (sempre
 *  sem data — nunca inventar uma). */
export function passosDaTrilha(
  trilha: Trilha | null | undefined,
  eventos: CicloEvento[],
  especialista: EspecialistaEvento[] = []
): PassoGuia[] {
  if (trilha === "especialista") {
    return [...especialista]
      .sort((a, b) => a.numero - b.numero)
      .map((e) => ({
        id: `esp-${e.numero}`,
        numero: e.numero,
        titulo: e.titulo,
        data: null,
        fase: null,
        instrumentos: [],
        foco: e.foco,
      }));
  }
  return eventos
    .filter((e) => e.tipo === "encontro" && e.numero != null)
    .sort((a, b) => a.numero! - b.numero!)
    .map((e) => ({
      id: e.id,
      numero: e.numero!,
      titulo: e.titulo,
      data: e.data,
      fase: e.fase,
      instrumentos: e.instrumentos,
      observacao: e.observacao,
    }));
}

// opções do form "Avaliação de Encontro Semanal - Mentores"
export const ATIVIDADES_ENCONTRO = [
  "Conversa de acompanhamento",
  "Orientação individual",
  "Atividade prática",
  "Desenvolvimento de competência",
  "Acompanhamento de atividade/tarefa",
  "Identificação de dificuldades",
  "Orientação profissional",
] as const;

export const AVALIACAO_LABEL: Record<string, string> = {
  excelente: "Excelente",
  boa: "Boa",
  regular: "Regular",
  baixa: "Baixa",
};

export const DIFICULDADE_LABEL: Record<Dificuldade, string> = {
  nenhuma: "Nenhuma",
  aprendizagem: "aprendizagem",
  participacao: "participação",
  comportamental: "comportamental",
  organizacao: "organização/rotina",
  outro: "outra",
};

export const PROXIMO_PASSO_LABEL: Record<string, string> = {
  continuar: "Continuar o acompanhamento normalmente",
  reforcar: "Reforçar o conteúdo/atividade",
  novo_feedback: "Realizar novo feedback",
  acompanhar_de_perto: "Fazer um acompanhamento mais próximo",
  conversa_individual: "Conversar individualmente com o mentorado",
  outro: "Outro",
};

// ---------- avaliação estrela do jovem (0071 / D4) ----------
// Vocabulário do app — o banco guarda chaves estáveis (avancei tem CHECK;
// sentimento/temas são texto livre lá, mas a única escritora é a action,
// então fechar o léxico aqui mantém leitura e agregados consistentes).
// NÃO misturar com registros.avaliacao (4-pt do mentor) nem avaliacao_360.

/** "Como você se sentiu no encontro?" — escala de conforto, não de nota:
 *  a estrela já cobre o julgamento; aqui o jovem nomeia a sensação. */
export const SENTIMENTO_AVALIACAO = [
  { value: "muito_bem", label: "Muito bem" },
  { value: "bem", label: "Bem" },
  { value: "mais_ou_menos", label: "Mais ou menos" },
  { value: "desconfortavel", label: "Desconfortável" },
  { value: "mal", label: "Mal" },
] as const;

export const SENTIMENTO_AVALIACAO_LABEL: Record<string, string> =
  Object.fromEntries(SENTIMENTO_AVALIACAO.map((o) => [o.value, o.label]));

/** "Você sente que avançou no que combinou?" — os 3 valores são o CHECK
 *  avancei do banco (0071). */
export const AVANCEI_AVALIACAO = [
  { value: "sim", label: "Sim, avancei" },
  { value: "um_pouco", label: "Um pouco" },
  { value: "nao", label: "Ainda não" },
] as const;

export const AVANCEI_AVALIACAO_LABEL: Record<string, string> =
  Object.fromEntries(AVANCEI_AVALIACAO.map((o) => [o.value, o.label]));

/** "Sobre o que vocês conversaram?" — multiescolha dos temas do PDM e do
 *  cotidiano. `outro` cobre o que a lista não prevê (o comentário detalha). */
export const TEMAS_AVALIACAO = [
  { value: "pdm", label: "Projeto de vida (PDM)" },
  { value: "estudos", label: "Escola e estudos" },
  { value: "carreira", label: "Carreira e futuro" },
  { value: "familia", label: "Família" },
  { value: "relacionamentos", label: "Amizades e relacionamentos" },
  { value: "bem_estar", label: "Saúde e bem-estar" },
  { value: "dinheiro", label: "Dinheiro" },
  { value: "hobbies", label: "Tempo livre e hobbies" },
  { value: "outro", label: "Outro assunto" },
] as const;

export const TEMA_AVALIACAO_LABEL: Record<string, string> =
  Object.fromEntries(TEMAS_AVALIACAO.map((o) => [o.value, o.label]));

/** Texto curto da nota em estrelas — aria-label e resumo pra quem lê a
 *  avaliação (coord, jovem, especialista). "3 de 5 estrelas". */
export const estrelasTexto = (n: number): string =>
  `${n} de 5 ${n === 1 ? "estrela" : "estrelas"}`;

/** Motivos de remarcação — `value` é a chave estável do form; `label` é o texto
 *  canônico gravado em encontros.motivo_reagendamento (auditável, sem enum no banco). */
export const MOTIVOS_REAGENDAMENTO = [
  { value: "ausencia_mentorado", label: "Ausência do mentorado" },
  { value: "ausencia_mentor", label: "Ausência do mentor" },
  { value: "conflito", label: "Conflito de agenda" },
  { value: "imprevisto", label: "Doença ou imprevisto" },
  { value: "outro", label: "Outro motivo" },
] as const;

// ---------- remanejamento de dupla (0063/0064) ----------

/** Lado da dupla que sai no remanejo — o mesmo vocabulário do RPC
 *  rematch_dupla (0064). A action valida antes de chamar. */
export type LadoRemanejo = "mentor" | "mentorado";

/** Categorias de motivo do select do dialog — "outro" exige o detalhe
 *  (uma categoria vazia não diz nada na ficha de quem sai). O texto que vai
 *  pro banco é composto por `motivoRemanejo`, não pelo value. */
export const MOTIVOS_REMANEJO = [
  { value: "desistencia", label: "Desistência" },
  { value: "remanejo", label: "Remanejo pra outra dupla" },
  { value: "realinhamento", label: "Realinhamento do programa" },
  { value: "outro", label: "Outro motivo" },
] as const;

/** Texto do motivo gravado na nota de saída (o RPC prefixa data +
 *  "remanejamento"). Categoria conhecida vira "Rótulo — detalhe" (ou só o
 *  rótulo sem detalhe); "outro" e categoria desconhecida mandam o texto
 *  livre — vazio devolve null, que o dialog/action tratam como "falta o
 *  porquê". */
export function motivoRemanejo(
  categoria: string,
  detalhe: string
): string | null {
  const texto = detalhe.trim();
  const cat = MOTIVOS_REMANEJO.find((m) => m.value === categoria);
  if (!cat || cat.value === "outro") return texto || null;
  return texto ? `${cat.label} — ${texto}` : cat.label;
}

/** Resumo do que o remanejo faz — "Ana + Bia → Ana + Célia" — exibido no
 *  dialog ANTES de confirmar (a troca é irreversível: a dupla antiga
 *  encerra). Null até o novo membro estar escolhido. */
export function resumoRemanejo(
  nomes: { mentor: string; mentorado: string },
  lado: LadoRemanejo,
  novoNome: string | null | undefined
): { antes: string; depois: string } | null {
  if (!novoNome) return null;
  const antes = `${nomes.mentor} + ${nomes.mentorado}`;
  const depois =
    lado === "mentor"
      ? `${novoNome} + ${nomes.mentorado}`
      : `${nomes.mentor} + ${novoNome}`;
  return { antes, depois };
}

// ---------- saída de mentorado (0077) ----------

/** Rótulo da situação do cadastro. 'ativo' quase nunca é exibido (é o
 *  normal); os chips/badges usam os outros dois valores. */
export const SITUACAO_MENTORADO_LABEL: Record<SituacaoMentorado, string> = {
  ativo: "No programa",
  desistente: "Desistente",
  concluido: "Concluiu o programa",
};

/** Fora do programa = saiu antes do fim ou concluiu a jornada (0077).
 *  Tolerante a campo ausente — select parcial/persona demo sem a coluna
 *  lê como 'ativo'. */
export const foraDoPrograma = (m: {
  situacao?: SituacaoMentorado | null;
}): boolean => m.situacao != null && m.situacao !== "ativo";

/** Motivos de saída do select do dialog — `value` é a chave estável do
 *  form; `label` é o texto canônico gravado em mentorados.motivo_saida
 *  (auditável, sem enum no banco — mesmo esquema do motivoRemanejo).
 *  'concluido' não tem preset: a conclusão se explica sozinha, o campo
 *  vira detalhe livre opcional. */
export const MOTIVOS_SAIDA = [
  { value: "desistencia", label: "Desistiu do programa" },
  { value: "mudou_cidade", label: "Mudou de cidade" },
  { value: "sem_contato", label: "Perdemos o contato" },
  { value: "pessoal_familiar", label: "Motivos pessoais ou familiares" },
  { value: "outro", label: "Outro motivo" },
] as const;

/** Texto gravado em motivo_saida. Categoria conhecida vira "Rótulo —
 *  detalhe" (ou só o rótulo sem detalhe); "outro" e categoria desconhecida
 *  mandam o texto livre — vazio devolve null, que o dialog trata como
 *  "falta o porquê" (desistente exige motivo; concluído não). */
export function motivoSaida(
  categoria: string,
  detalhe: string
): string | null {
  const texto = detalhe.trim();
  const cat = MOTIVOS_SAIDA.find((m) => m.value === categoria);
  if (!cat || cat.value === "outro") return texto || null;
  return texto ? `${cat.label} — ${texto}` : cat.label;
}

// ---------- matching/cadastro (0034) ----------
// labels dos enums novos — espelham os CHECKs da migration 0034

/** Vocabulário fechado dos CHECKs da 0034 — a mesma lista serve pra validar
 *  no server action antes de gravar (erro claro em vez de 23514). */
export const GENEROS = [
  "feminino", "masculino", "nao_binario", "outro", "prefiro_nao_dizer",
] as const satisfies readonly Genero[];
export const PREF_GENEROS = ["feminino", "masculino", "indiferente"] as const satisfies readonly PrefGeneroPar[];
export const ESCOLARIDADES = [
  "fundamental", "medio", "tecnico", "superior_incompleto", "superior", "pos",
] as const satisfies readonly Escolaridade[];
export const COR_RACAS = [
  "branca", "negra", "parda", "amarela", "indigena", "outro",
  "prefiro_nao_dizer",
] as const satisfies readonly CorRaca[];
export const DIAS_SEMANA = ["seg", "ter", "qua", "qui", "sex", "sab", "dom"] as const satisfies readonly DiaSemana[];
export const PERIODOS = ["manha", "tarde", "noite"] as const satisfies readonly Periodo[];

export const GENERO_LABELS: Record<Genero, string> = {
  feminino: "Feminino",
  masculino: "Masculino",
  nao_binario: "Não-binário",
  outro: "Outro",
  prefiro_nao_dizer: "Prefiro não dizer",
};

/** Preferência de gênero do par — "indiferente" vira "Sem preferência" na UI. */
export const PREF_GENERO_LABELS: Record<PrefGeneroPar, string> = {
  feminino: "Feminino",
  masculino: "Masculino",
  indiferente: "Sem preferência",
};

export const ESCOLARIDADE_LABELS: Record<Escolaridade, string> = {
  fundamental: "Ensino fundamental",
  medio: "Ensino médio",
  tecnico: "Ensino técnico",
  superior_incompleto: "Superior incompleto",
  superior: "Superior completo",
  pos: "Pós-graduação",
};

export const COR_RACA_LABELS: Record<CorRaca, string> = {
  branca: "Branca",
  negra: "Negra",
  parda: "Parda",
  amarela: "Amarela",
  indigena: "Indígena",
  outro: "Outro",
  prefiro_nao_dizer: "Prefiro não dizer",
};

/** Tipos de documento do intake (documentos_pessoa, 0054). */
export const DOCUMENTO_PESSOA_TIPOS = [
  "rg", "cpf", "comprovante_residencia", "comprovante_bancario",
  "curriculo", "outro",
] as const satisfies readonly DocumentoPessoa["tipo"][];

export const DOCUMENTO_PESSOA_TIPO_LABELS: Record<DocumentoPessoa["tipo"], string> = {
  rg: "RG / CNH",
  cpf: "CPF",
  comprovante_residencia: "Comprovante de residência",
  comprovante_bancario: "Comprovante bancário",
  curriculo: "Currículo",
  outro: "Outro",
};

/** Grade de disponibilidade (mentor_profiles.disponibilidade) — dias na
 *  ordem seg→dom pra iterar direto no checkbox/grade semanal. */
export const DIAS_SEMANA_LABELS: Record<DiaSemana, string> = {
  seg: "Segunda",
  ter: "Terça",
  qua: "Quarta",
  qui: "Quinta",
  sex: "Sexta",
  sab: "Sábado",
  dom: "Domingo",
};

export const PERIODOS_LABELS: Record<Periodo, string> = {
  manha: "Manhã",
  tarde: "Tarde",
  noite: "Noite",
};

/** Siglas pra select de UF — o banco guarda char(2) maiúsculo (CHECK). */
export const UFS = [
  "AC", "AL", "AM", "AP", "BA", "CE", "DF", "ES", "GO", "MA", "MG", "MS",
  "MT", "PA", "PB", "PE", "PI", "PR", "RJ", "RN", "RO", "RR", "RS", "SC",
  "SE", "SP", "TO",
] as const;

/** Sugestões do TagInput de interesses (ficha da coordenação, onboarding e
 *  /perfil) — mistura de temas de jovem e de mentor, o campo aceita digitação
 *  livre. O teto (20 itens / 60 chars por tag) é o CHECK interesses_ok (0034). */
export const INTERESSES_SUGESTOES = [
  "esportes",
  "música",
  "leitura",
  "jogos e games",
  "tecnologia",
  "arte e desenho",
  "empreendedorismo",
  "finanças pessoais",
  "educação",
  "carreira",
  "idiomas",
  "escrita",
  "voluntariado",
  "ciência",
  "culinária",
];

/** Grade semanal do grid de chips (JSON {"dias":[],"periodos":[]}) — valida
 *  contra o mesmo vocabulário do CHECK disponibilidade_ok. Vazio ou grade
 *  sem nada marcado vira null ("não informado"), nunca esqueleto vazio. */
export function parseDisponibilidade(
  raw: string
): Disponibilidade | null | { error: string } {
  const v = raw.trim();
  if (!v) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(v);
  } catch {
    return { error: "A disponibilidade chegou num formato inválido." };
  }
  const d = parsed as { dias?: unknown; periodos?: unknown };
  const dias = (Array.isArray(d?.dias) ? d.dias.map(String) : []).filter(
    (x): x is DiaSemana => (DIAS_SEMANA as readonly string[]).includes(x)
  );
  const periodos = (
    Array.isArray(d?.periodos) ? d.periodos.map(String) : []
  ).filter((x): x is Periodo =>
    (PERIODOS as readonly string[]).includes(x)
  );
  return dias.length || periodos.length ? { dias, periodos } : null;
}

/** "ter e qui à noite" — grade semanal do mentor em frase curta (ficha de
 *  pessoa, board de matching). Grade vazia/ausente devolve null. */
export function disponibilidadeTexto(d: Disponibilidade | null | undefined): string | null {
  if (!d || (!d.dias?.length && !d.periodos?.length)) return null;
  const dias = (d.dias ?? []).map((dia) => DIAS_SEMANA_LABELS[dia] ?? dia);
  const periodos = (d.periodos ?? []).map(
    (p) => PERIODOS_LABELS[p]?.toLocaleLowerCase("pt-BR") ?? p
  );
  const junta = (l: string[]) =>
    l.length <= 1 ? (l[0] ?? "") : `${l.slice(0, -1).join(", ")} e ${l.at(-1)}`;
  // plural de cada período: "às tardes e noites" (não "às tarde e noite")
  const PERIODO_PLURAL: Record<string, string> = {
    manhã: "manhãs",
    tarde: "tardes",
    noite: "noites",
  };
  const partes = [
    dias.length ? junta(dias) : null,
    periodos.length === 1
      ? `à ${periodos[0]}`
      : periodos.length
        ? `às ${junta(periodos.map((x) => PERIODO_PLURAL[x] ?? x))}`
        : null,
  ].filter(Boolean);
  return partes.length ? partes.join(" ") : null;
}

/** "seg".."dom" de uma data "YYYY-MM-DD" — o DiaSemana da grade de
 *  disponibilidade. Âncora no meio-dia, mesma regra de paraData: sem ela o
 *  fuso podia devolver o dia anterior. */
export function diaSemanaDe(iso: string): DiaSemana {
  // getDay() 0=dom — DIAS_SEMANA é seg=0, então +6 % 7 realinha (sem o mapa
  // paralelo "dom" caía fora do enum)
  return DIAS_SEMANA[(new Date(`${iso}T12:00:00`).getDay() + 6) % 7];
}

/** O dia da semana está marcado como livre na grade? Só `dias` decide —
 *  `periodos` qualifica a faixa, não o dia. Grade nula/sem dias = não livre. */
export function disponibilidadeNoDia(
  d: Disponibilidade | null | undefined,
  dow: DiaSemana
): boolean {
  return (d?.dias ?? []).includes(dow);
}

/** A grade não serve pro cruzamento? (REALIZA-114) — vazia = null ou sem
 *  nenhum dia marcado: períodos sem dia nunca casam em disponibilidadeNoDia,
 *  então a agenda cai em "nenhum horário em comum" como se não existisse.
 *  Dias sem período contam como preenchida ("qualquer horário" é coringa).
 *  É a régua do lembrete permanente no /jovem e do badge "pendente" do
 *  /jovem/perfil. */
export function disponibilidadeVazia(
  d: Disponibilidade | null | undefined
): boolean {
  return !(d?.dias?.length);
}

/** Períodos em comum entre duas grades — lista vazia vale "qualquer
 *  período" (a pessoa marcou dias sem recortar horário): cruza com tudo.
 *  Exportada pro score de afinidade do remanejo sugerido (REALIZA-115),
 *  mesma régua do overlay da agenda. */
export function periodosCruzam(
  a: Periodo[] | null | undefined,
  b: Periodo[] | null | undefined
): boolean {
  if (!a?.length || !b?.length) return true;
  return a.some((p) => b.includes(p));
}

/** Cruzamento das grades do mentor × mentorados num dia da semana — a regra
 *  do overlay da agenda (REALIZA-24). "ambos" exige encaixe honesto: o
 *  mentor E algum jovem livres no dia E com período em comum — mentor livre
 *  qui de manhã e jovem livre qui à noite não se encontram. O jovem livre
 *  sem encaixe ainda conta como "jovem" (ele está livre, só incompatível).
 *  Ordem: ambos > mentor > jovem > nenhum. */
export function cruzamentoDisponibilidade(
  mentor: Disponibilidade | null | undefined,
  jovens: (Disponibilidade | null | undefined)[],
  dow: DiaSemana
): "nenhum" | "mentor" | "jovem" | "ambos" {
  const mentorLivre = disponibilidadeNoDia(mentor, dow);
  const jovensLivres = jovens.filter((j) => disponibilidadeNoDia(j, dow));
  if (
    mentorLivre &&
    jovensLivres.some((j) => periodosCruzam(mentor?.periodos, j?.periodos))
  )
    return "ambos";
  if (mentorLivre) return "mentor";
  if (jovensLivres.length > 0) return "jovem";
  return "nenhum";
}

/** Janela horária de cada período da grade — convenção do programa, não
 *  dado do banco: "manhã/tarde/noite" vira faixas fixas de hora pra visão de
 *  grade (REALIZA-25) pintar o cruzamento por horário, não só por dia.
 *  [início, fim) em horas — quem marca "noite" cobre 18h–21h59, não as 22h. */
export const JANELA_PERIODO: Record<Periodo, [number, number]> = {
  manha: [8, 12],
  tarde: [12, 18],
  noite: [18, 22],
};

/** O lado tá livre naquele dia da semana NAQUELA hora cheia? `dias` decide o
 *  dia; `periodos` afunila pra faixa — vazia = "qualquer horário" (mesmo
 *  coringa do cruzamento por dia). `hora` é a hora inteira local (0–23). */
export function disponibilidadeNaHora(
  d: Disponibilidade | null | undefined,
  dow: DiaSemana,
  hora: number
): boolean {
  if (!disponibilidadeNoDia(d, dow)) return false;
  const periodos = d?.periodos ?? [];
  if (periodos.length === 0) return true;
  return periodos.some((p) => {
    const [ini, fim] = JANELA_PERIODO[p];
    return hora >= ini && hora < fim;
  });
}

/** Cruzamento por HORA — a versão da grade horária (REALIZA-25) do
 *  cruzamentoDisponibilidade por dia. "ambos" exige os dois livres na mesma
 *  hora: mentor livre às 9h e jovem só à noite não se encontram — a janela
 *  resolve o encaixe que o dia inteiro não resolve. */
export function cruzamentoDisponibilidadeHora(
  mentor: Disponibilidade | null | undefined,
  jovens: (Disponibilidade | null | undefined)[],
  dow: DiaSemana,
  hora: number
): "nenhum" | "mentor" | "jovem" | "ambos" {
  const mentorLivre = disponibilidadeNaHora(mentor, dow, hora);
  const jovemLivre = jovens.some((j) => disponibilidadeNaHora(j, dow, hora));
  if (mentorLivre && jovemLivre) return "ambos";
  if (mentorLivre) return "mentor";
  if (jovemLivre) return "jovem";
  return "nenhum";
}

/** Idade em anos a partir de "YYYY-MM-DD" — âncora no meio-dia pra não voltar
 *  um dia no fuso; null quando a data é inválida. */
export function idade(iso: string | null | undefined): number | null {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  const nasc = new Date(`${iso}T12:00:00`);
  if (isNaN(nasc.getTime())) return null;
  const hoje = new Date(`${toDateStr(new Date())}T12:00:00`);
  let anos = hoje.getFullYear() - nasc.getFullYear();
  const aniversarioPassou =
    hoje.getMonth() > nasc.getMonth() ||
    (hoje.getMonth() === nasc.getMonth() && hoje.getDate() >= nasc.getDate());
  if (!aniversarioPassou) anos--;
  return anos >= 0 ? anos : null;
}

/** Registro mais recente da dupla (pelo número do encontro). */
export function ultimoRegistro(dupla: Dupla): Registro | null {
  return (
    dupla.encontros
      .filter((e) => e.registro)
      .sort((a, b) => b.numero - a.numero)[0]?.registro ?? null
  );
}

export type DuplaSaude = {
  semaforo: Semaforo;
  motivo: string;
  esperado: number;
  feitos: number;
  proximo: Encontro | null;
  registroPendente: boolean;
  /** Pedido de apoio do MENTOR, marcado no registro do encontro. */
  pediuApoio: boolean;
  /** Pedido de ajuda do JOVEM, marcado na avaliação estrela (0071) — canal
   *  de segurança que pode ser sobre o próprio mentor: a resposta certa é
   *  chamar o jovem, nunca o mentor. Sinal separado de propósito. */
  apoioJovem: boolean;
  /** Realizados ainda sem a avaliação do jovem. Só significa algo pra
   *  coordenação/supervisão — o mentor DPP enxerga só as avaliações que o
   *  jovem autorizou, então pra ele este número mente (contaria invisíveis
   *  como "pendentes"). Nunca exibir fora do radar da equipe. */
  avaliacaoJovemPendente: number;
};

/** Total de encontros do ciclo — trilha DPP tem 16, especialista terá menos. */
export function totalEncontros(eventos: CicloEvento[]): number {
  return eventos.filter((e) => e.tipo === "encontro").length;
}

/** Maior nº de encontro entre os cronogramas (0061): `totalEncontros` conta
 *  LINHAS — com duas turmas daria 32; o teto de um seletor/filtro por nº é o
 *  maior numero existente, não a soma das listas. */
export function maxNumeroEncontro(eventos: CicloEvento[]): number {
  return eventos.reduce(
    (m, e) => (e.tipo === "encontro" && e.numero != null ? Math.max(m, e.numero) : m),
    0
  );
}

/** Teto da dupla pelo calendário DELA (0061): o nº de encontros do cronograma
 *  vinculado — duas turmas podem ter totais diferentes. `eventos` deve ser o
 *  recorte já feito por `eventosDoCronograma`; lista vazia (especialista ou
 *  DPP legada sem vínculo) cai no teto canônico da trilha. */
export function totalDaTrilha(
  trilha: Trilha | null | undefined,
  eventos: CicloEvento[]
): number {
  if (trilha === "especialista") return TRILHA_LEN.especialista;
  return totalEncontros(eventos) || TRILHA_LEN.dpp;
}

// ---------- cronogramas (0061) ----------
// O calendário oficial é POR cronograma: duas turmas com datas diferentes não
// podem se misturar no semáforo, na agenda ou na trilha. A identidade de um
// encontro oficial é (cronograma_id, numero) — numero solto não identifica.

/** Recorte do calendário oficial de uma dupla, na ordem do PDF (0062):
 *  `ordem` é a chave — etapas de preparação concluídas sem data vêm antes
 *  dos encontros, onde `data nulls last` as jogaria depois do encerramento.
 *  Sem cronograma (especialista, histórica antiga) devolve [] — trilha
 *  livre, nada vence "por data". */
export function eventosDoCronograma(
  eventos: CicloEvento[],
  cronogramaId: string | null | undefined
): CicloEvento[] {
  if (!cronogramaId) return [];
  return eventos
    .filter((e) => e.cronograma_id === cronogramaId)
    .sort((a, b) => a.ordem - b.ordem);
}

/** Encontro oficial com data garantida — o CHECK do banco exige data em todo
 *  tipo ≠ etapa_preparacao-concluída, então o filtro `data != null` refina o
 *  tipo sem custo. É o retorno dos helpers de semana: quem consome não
 *  precisa re-guardar `data`. */
export type EventoDatado = CicloEvento & { data: string };

/** Guard de tipo compartilhado: encontro oficial COM data. Etapas sem data,
 *  recessos, formações e o encerramento ficam fora de qualquer conta de
 *  encontro — o denominador do ciclo é só `tipo = 'encontro'`. */
function encontroDatado(e: CicloEvento): e is EventoDatado {
  return e.tipo === "encontro" && e.data != null;
}

/** Cronograma vigente pra abrir telas: ativo cuja faixa cobre hoje (dois
 *  ativos sobrepostos desempatam pelo início mais antigo, depois created_at,
 *  depois nome — determinístico); sem cobertura, o próximo a começar; sem
 *  futuro, o encerrado mais recente. Null sem cronogramas. */
export function cronogramaVigente(
  cronogramas: Cronograma[],
  hoje = new Date()
): Cronograma | null {
  if (!cronogramas.length) return null;
  const hojeStr = toDateStr(hoje);
  const porInicio = (a: Cronograma, b: Cronograma) =>
    (a.inicio_em ?? "").localeCompare(b.inicio_em ?? "") ||
    a.created_at.localeCompare(b.created_at) ||
    a.nome.localeCompare(b.nome, "pt-BR");
  const cobrindo = cronogramas
    .filter(
      (c) =>
        c.status === "ativo" &&
        (c.inicio_em == null || c.inicio_em <= hojeStr) &&
        (c.fim_em == null || c.fim_em >= hojeStr)
    )
    .sort(porInicio);
  if (cobrindo.length) return cobrindo[0];
  const futuros = cronogramas
    .filter((c) => c.inicio_em != null && c.inicio_em > hojeStr)
    .sort(porInicio);
  if (futuros.length) return futuros[0];
  return [...cronogramas].sort(
    (a, b) => (b.fim_em ?? "").localeCompare(a.fim_em ?? "") || porInicio(a, b)
  )[0];
}

/** Opções do seletor de cronograma — ordenadas por turma e nome. */
export function cronogramasOpcoes(cronogramas: Cronograma[]): Cronograma[] {
  return [...cronogramas].sort(
    (a, b) =>
      a.turma.localeCompare(b.turma, "pt-BR") ||
      a.nome.localeCompare(b.nome, "pt-BR")
  );
}

/** Label curto do seletor: "2026/2027 · Calendário oficial". */
export function rotuloCronograma(c: Cronograma): string {
  return `${c.turma} · ${c.nome}`;
}

/** Encontros esperados = datas de encontro já passadas (ou hoje) desde o início da dupla. */
export function encontroEsperado(eventos: CicloEvento[], hoje: Date, desde?: string | null): number {
  const hojeStr = toDateStr(hoje);
  return eventos.filter(
    (e) => encontroDatado(e) && e.data <= hojeStr && (!desde || e.data >= desde)
  ).length;
}

/** Número do 1º encontro esperado (data <= hoje, >= início da dupla) sem `realizado`
 *  correspondente em dupla.encontros — é o encontro que "ainda não aconteceu".
 *  `limbo` exclui numeros agendados vencidos: eles são pendência de registro,
 *  não falta confirmada. */
function primeiroEncontroFaltante(
  dupla: Dupla,
  eventos: CicloEvento[],
  hoje: Date,
  limbo: ReadonlySet<number> = new Set()
): number | null {
  const hojeStr = toDateStr(hoje);
  const feitos = new Set(
    dupla.encontros.filter((e) => e.status === "realizado").map((e) => e.numero)
  );
  const faltante = eventos
    .filter(
      (e): e is EventoDatado =>
        encontroDatado(e) &&
        e.numero != null &&
        e.data <= hojeStr &&
        (!dupla.iniciada_em || e.data >= dupla.iniciada_em)
    )
    .sort((a, b) => a.data.localeCompare(b.data))
    .find((e) => e.numero != null && !feitos.has(e.numero) && !limbo.has(e.numero));
  return faltante?.numero ?? null;
}

/** Bounds "YYYY-MM-DD" da semana calendário (seg–dom) que contém `hoje`.
 *  Âncora no meio-dia pra o dia da semana não depender do fuso do servidor. */
export function semanaBounds(hoje: Date): { seg: string; dom: string } {
  const hojeData = new Date(`${toDateStr(hoje)}T12:00:00`);
  const dow = (hojeData.getDay() + 6) % 7; // seg=0 … dom=6
  const seg = new Date(hojeData);
  seg.setDate(hojeData.getDate() - dow);
  const dom = new Date(seg);
  dom.setDate(seg.getDate() + 6);
  return { seg: toDateStr(seg), dom: toDateStr(dom) };
}

/** TODOS os encontros oficiais cuja data cai na semana calendário (seg–dom)
 *  de `hoje`, ordenados por numero — a semana pode ter dois (a quinta de
 *  encontro duplo da T2, 0062). Eventos sem data e de outros tipos nunca
 *  entram: etapa concluída, recesso, formação e encerramento não são
 *  encontro. */
export function encontrosDaSemana(
  eventos: CicloEvento[],
  hoje: Date
): EventoDatado[] {
  const { seg, dom } = semanaBounds(hoje);
  return eventos
    .filter(
      (e): e is EventoDatado =>
        encontroDatado(e) && e.data >= seg && e.data <= dom
    )
    .sort((a, b) => (a.numero ?? 0) - (b.numero ?? 0));
}

/** O encontro oficial da semana (singular) — com dois na mesma semana é o de
 *  MENOR numero: a regra é numero, não a coincidência data asc ≡ numero asc
 *  (0062). `encontrosDaSemana` devolve a lista completa pro board. */
export function eventoDaSemana(eventos: CicloEvento[], hoje: Date): EventoDatado | null {
  const ordenados = eventos
    .filter(encontroDatado)
    .sort((a, b) => a.data.localeCompare(b.data));
  // "semana do encontro N" = a semana calendário (seg–dom) que contém a data do
  // encontro — depois do dia do encontro (terça ou quinta) ainda é a semana
  // que rolou (janela de registro), não da próxima.
  const { dom } = semanaBounds(hoje);
  const daSemana = encontrosDaSemana(eventos, hoje)[0];
  if (daSemana) return daSemana;
  // semana sem encontro (recesso/gap): aponta o próximo; depois do ciclo, o último
  return ordenados.find((e) => e.data > dom) ?? ordenados.at(-1) ?? null;
}

export type ResumoSemana = {
  /** evento oficial da semana (o mesmo do chip da agenda) */
  evento: CicloEvento;
  /** duplas ativas — denominador da semana */
  total: number;
  /** duplas com encontro da semana realizado */
  realizaram: number;
  /** desses, com registro entregue */
  comRegistro: number;
  /** realizaram mas ainda não registraram */
  aguardandoRegistro: number;
  /** duplas ativas sem encontro realizado da semana */
  naoAconteceram: number;
  /** das que não fizeram o oficial, as que se encontraram mesmo assim —
   *  repuseram outro encontro dentro da semana calendário */
  reposicao: number;
};

/** O mesmo recorte do resumoSemana ancorado num evento específico — é o que o
 *  board da agenda usa pra semanas que não são a corrente. `semana` ({seg,
 *  dom}) define a janela da reposição; default = a semana calendário da data
 *  oficial do próprio evento. Null quando o evento não tem número. */
export function resumoSemanaDe(
  duplas: Dupla[],
  evento: CicloEvento,
  semana?: { seg: string; dom: string }
): ResumoSemana | null {
  if (evento.numero == null) return null;
  // sem `semana` explícita a janela deriva da data oficial — evento sem data
  // (etapa concluída) não tem semana pra medir
  if (evento.data == null && semana == null) return null;
  const { seg, dom } =
    semana ?? semanaBounds(new Date(`${evento.data}T12:00:00`));
  // semana oficial é métrica da trilha DPP — duplas de especialista não seguem
  // o calendário oficial e ficariam sempre "sem encontro esta semana". O
  // denominador é SÓ do cronograma do evento (0061): com duas turmas ativas,
  // a semana de uma não conta as duplas da outra.
  const ativas = duplas.filter(
    (d) =>
      d.status === "ativa" &&
      d.trilha !== "especialista" &&
      d.cronograma_id === evento.cronograma_id
  );
  const oficialRealizado = (d: Dupla) =>
    d.encontros.find((e) => e.numero === evento.numero && e.status === "realizado");
  const feitos = ativas.map(oficialRealizado).filter((e): e is Encontro => !!e);
  const comRegistro = feitos.filter((e) => e.registro).length;
  // reposição: sem `realizado` do numero oficial, mas com algum encontro
  // realizado dentro da semana calendário — ex.: a dupla pulou a semana do
  // encontro 2 e repôs na semana do 3. Ela SE encontrou; contar como
  // "sem encontro" mentiria na faixa.
  const rolouNaSemana = (e: Encontro) => {
    if (e.status !== "realizado") return false;
    const quando = e.realizado_em ?? e.data_hora;
    if (!quando) return false;
    const dia = toDateStr(new Date(quando));
    return dia >= seg && dia <= dom;
  };
  const reposicao = ativas.filter(
    (d) => !oficialRealizado(d) && d.encontros.some(rolouNaSemana)
  ).length;
  return {
    evento,
    total: ativas.length,
    realizaram: feitos.length,
    comRegistro,
    aguardandoRegistro: feitos.length - comRegistro,
    naoAconteceram: ativas.length - feitos.length,
    reposicao,
  };
}

/** Conta-gotas da semana pra faixa do dashboard — só duplas ativas entram na conta.
 *  Null quando não há evento da semana (fora de janela) ou o evento não tem número. */
export function resumoSemana(
  duplas: Dupla[],
  eventos: CicloEvento[],
  agora: Date
): ResumoSemana | null {
  const evento = eventoDaSemana(eventos, agora);
  if (!evento) return null;
  return resumoSemanaDe(duplas, evento, semanaBounds(agora));
}

/** Par encontro↔dupla achatado — a unidade que os boards/buckets da agenda
 *  consomem (um encontro pertence a uma dupla, mas a leitura é por encontro). */
export type ItemEncontroDupla = { encontro: Encontro; dupla: Dupla };

/** "Limbo": agendado cuja data já passou e ainda não tem registro — pode ter
 *  rolado ou não; a ambiguidade exige ação do mentor (registrar, remarcar ou
 *  marcar não-aconteceu), então conta como pendência de registro, não atraso.
 *  Única definição — semáforo, trilha e agenda liam a mesma regra duplicada. */
export function emLimbo(e: Encontro, agoraMs: number): boolean {
  return (
    e.status === "agendado" &&
    !e.registro &&
    e.data_hora != null &&
    new Date(e.data_hora).getTime() < agoraMs
  );
}

export type BucketsEncontro = {
  /** realizado sem registro + agendado vencido (limbo) — o que pede ação. */
  pendentes: ItemEncontroDupla[];
  /** agendados/remarcados ainda por vir. */
  agendados: ItemEncontroDupla[];
  /** realizados com registro entregue — fechados. */
  realizados: ItemEncontroDupla[];
  /** nao_aconteceu/cancelado — fechados sem encontro. */
  naoAconteceram: ItemEncontroDupla[];
};

/** Distribui os itens nos 4 buckets de status acionável — a mesma leitura da
 *  célula do mês (pendente = realizado sem registro OU limbo). */
export function bucketsDoEncontro(
  itens: ItemEncontroDupla[],
  agoraMs: number
): BucketsEncontro {
  const b: BucketsEncontro = {
    pendentes: [],
    agendados: [],
    realizados: [],
    naoAconteceram: [],
  };
  for (const item of itens) {
    const e = item.encontro;
    if (e.status === "realizado")
      (e.registro ? b.realizados : b.pendentes).push(item);
    else if (e.status === "agendado" || e.status === "remarcado")
      (emLimbo(e, agoraMs) ? b.pendentes : b.agendados).push(item);
    else b.naoAconteceram.push(item);
  }
  return b;
}

/** A "coorte invisível" do encontro oficial: duplas ativas da trilha DPP **do
 *  cronograma do evento** cuja janela já alcançou a data oficial
 *  (`iniciada_em` ausente ou <= data oficial) e que não têm nenhuma row do
 *  número — qualquer row (agendada, realizada, cancelada) já cobre o
 *  encontro, mesmo critério do preventivo do semáforo. */
export function duplasSemEncontroDoNumero(
  duplas: Dupla[],
  evento: CicloEvento
): Dupla[] {
  if (evento.numero == null || evento.data == null) return [];
  const numero = evento.numero;
  const dataOficial = evento.data;
  return duplas.filter(
    (d) =>
      d.status === "ativa" &&
      d.trilha !== "especialista" &&
      d.cronograma_id === evento.cronograma_id &&
      (!d.iniciada_em || d.iniciada_em <= dataOficial) &&
      !d.encontros.some((e) => e.numero === numero)
  );
}

/** Texto da faixa "Esta semana" pronto pra WhatsApp da equipe.
 *  `emRisco` recebe strings prontas tipo "Ana & João (2 atrasos)"; `etiqueta`
 *  é o rótulo do cronograma — com duas turmas o número sozinho é ambíguo. */
export function textoResumoSemana(
  resumo: ResumoSemana,
  emRisco: string[] = [],
  etiqueta?: string
): string {
  const semEncontro = resumo.naoAconteceram - resumo.reposicao;
  const linhas = [
    `Semana do ${resumo.evento.numero}º encontro (${formatDiaMes(resumo.evento.data)}) · Mentoria Social` +
      (etiqueta ? ` · ${etiqueta}` : ""),
    `✔ ${resumo.realizaram} de ${resumo.total} ${resumo.total === 1 ? "dupla" : "duplas"} já realizaram`,
    `✎ ${resumo.comRegistro} ${resumo.comRegistro === 1 ? "registro entregue" : "registros entregues"} · ${resumo.aguardandoRegistro} aguardando`,
    `⚠ ${semEncontro} ${semEncontro === 1 ? "dupla" : "duplas"} sem encontro esta semana` +
      (resumo.reposicao > 0 ? ` · ↺ ${resumo.reposicao} em reposição` : ""),
  ];
  if (emRisco.length > 0) linhas.push(`Em risco: ${emRisco.join(" · ")}`);
  return linhas.join("\n");
}

export function saudadeDaDupla(dupla: Dupla, eventos: CicloEvento[], hoje = new Date()): DuplaSaude {
  // a dupla corre contra o calendário DELA (0061) — caller pode passar a lista
  // global que aqui vira o recorte do cronograma dela (especialista → [])
  eventos = eventosDoCronograma(eventos, dupla.cronograma_id);
  const hojeStr = toDateStr(hoje);
  // trilha especialista não tem calendário oficial: nada vence "por data", o
  // semáforo dela é feito só dos sinais que a própria dupla emite (pedido de
  // apoio, avaliação/dificuldade, registro pendente, agendado vencido,
  // combinado vencido, estagnação de 90 dias). "Esperado = feitos" mantém o
  // atraso zerado.
  const ehEspecialista = dupla.trilha === "especialista";
  // limbo (agendado vencido sem registro) cobre o evento esperado do seu
  // número — sai da conta de atraso enquanto a pendência estiver aberta
  const limbo = new Set(
    dupla.encontros.filter((e) => emLimbo(e, hoje.getTime())).map((e) => e.numero)
  );
  const feitos = dupla.encontros.filter((e) => e.status === "realizado").length;
  // um encontro em limbo cobre o evento esperado do seu número — sai da conta
  // de atraso enquanto a pendência estiver aberta
  const numerosEsperados = ehEspecialista
    ? new Set<number>()
    : new Set(
        eventos
          .filter(
            (e) =>
              encontroDatado(e) &&
              e.numero != null &&
              e.data <= hojeStr &&
              (!dupla.iniciada_em || e.data >= dupla.iniciada_em)
          )
          .map((e) => e.numero)
      );
  const esperado = ehEspecialista
    ? feitos
    : encontroEsperado(eventos, hoje, dupla.iniciada_em) -
      [...limbo].filter((n) => numerosEsperados.has(n)).length;
  const proximo =
    dupla.encontros
      .filter((e) => e.status === "agendado" && e.data_hora && new Date(e.data_hora) >= hoje)
      .sort((a, b) => new Date(a.data_hora!).getTime() - new Date(b.data_hora!).getTime())[0] ??
    null;

  const pediuApoio = dupla.encontros.some((e) => e.registro?.precisa_apoio);
  // o "preciso de ajuda" da avaliação estrela (0071) é o outro canal de
  // segurança — vem do JOVEM e pode ser sobre o próprio mentor: nunca
  // fundir com pediuApoio (quem responde e pra quem é diferente)
  const apoioJovem = dupla.encontros.some(
    (e) => e.avaliacao_jovem?.pedir_apoio
  );
  // realizado sem a estrela do jovem — o link já nasce mintado pelo
  // trigger; a pendência é dele, não do mentor (não é registro pendente)
  const avaliacaoJovemPendente = dupla.encontros.filter(
    (e) => e.status === "realizado" && !e.avaliacao_jovem
  ).length;
  // pendência de registro: realizado há >24h sem registro, ou agendado em
  // limbo — a de menor número vira o motivo e o alvo dos deep links
  const pendencia =
    dupla.encontros
      .filter(
        (e) =>
          !e.registro &&
          ((e.status === "realizado" &&
            hoje.getTime() - new Date(e.data_hora ?? 0).getTime() > 24 * 3600 * 1000) ||
            emLimbo(e, hoje.getTime()))
      )
      .sort((a, b) => a.numero - b.numero)[0] ?? null;
  const registroPendente = pendencia != null;
  const atraso = esperado - feitos;
  const encaminhamentoVencido = dupla.encaminhamentos.some(
    (t) => t.status === "pendente" && t.prazo && t.prazo < toDateStr(hoje)
  );
  const ultimoReg = ultimoRegistro(dupla);
  const avaliacaoBaixa = ultimoReg?.avaliacao === "baixa";
  const comDificuldade = !!ultimoReg?.dificuldade && ultimoReg.dificuldade !== "nenhuma";
  // campos comuns a todo retorno — os sinais novos (apoio do jovem,
  // avaliações pendentes) acompanham o objeto em qualquer faixa
  const base = { esperado, feitos, proximo, registroPendente, apoioJovem, avaliacaoJovemPendente };

  if ((pediuApoio || apoioJovem) && (dupla.status === "ativa" || dupla.status === "pausada"))
    // motivo em locução nominal — quem lê pode ser o próprio mentor ("Mentor
    // pediu apoio" em 3ª pessoa lê como se fosse sobre outra pessoa)
    return {
      semaforo: "risco",
      motivo:
        pediuApoio && apoioJovem
          ? "Pedidos de apoio em aberto"
          : apoioJovem
            ? "Pedido de ajuda do mentorado"
            : "Pedido de apoio",
      ...base,
      pediuApoio,
    };
  // pedido de apoio fura o congelamento da pausada, mas não do fechamento —
  // dupla concluída ou encerrada é capítulo encerrado
  if (dupla.status !== "ativa")
    return {
      semaforo: "ok",
      motivo:
        dupla.status === "pausada"
          ? "Dupla pausada"
          : dupla.status === "concluida"
            ? "Jornada concluída"
            : "Dupla encerrada",
      ...base,
      pediuApoio: dupla.status === "pausada" && pediuApoio,
      apoioJovem: dupla.status === "pausada" && apoioJovem,
    };
  if (avaliacaoBaixa && comDificuldade)
    return {
      semaforo: "risco",
      motivo: `Avaliação baixa e dificuldade de ${DIFICULDADE_LABEL[ultimoReg!.dificuldade!] ?? ultimoReg!.dificuldade} no último encontro`,
      ...base,
      pediuApoio,
    };
  // atraso só existe contra um calendário — na especialista esperado = feitos
  if (!ehEspecialista && atraso >= 2)
    return { semaforo: "risco", motivo: `${atraso} encontros em atraso`, ...base, pediuApoio };
  if (!ehEspecialista && atraso === 1)
    return {
      semaforo: "atencao",
      motivo: `Encontro ${primeiroEncontroFaltante(dupla, eventos, hoje, limbo) ?? esperado} ainda não aconteceu (reposição na mesma semana)`,
      ...base,
      pediuApoio,
    };
  if (avaliacaoBaixa)
    return {
      semaforo: "atencao",
      motivo: "Avaliação baixa no último encontro",
      ...base,
      pediuApoio,
    };
  if (comDificuldade)
    return {
      semaforo: "atencao",
      motivo: `Dificuldade de ${DIFICULDADE_LABEL[ultimoReg!.dificuldade!] ?? ultimoReg!.dificuldade} identificada`,
      ...base,
      pediuApoio,
    };
  // preventivo: encontro oficial da semana bate em ≤5 dias e a dupla ainda não marcou nada
  // (qualquer row com esse numero — agendada, realizada, cancelada — já cobre o encontro).
  // Só DPP: a especialista não tem data oficial — "ainda não agendou" não é sinal.
  if (!ehEspecialista) {
    const oficial = eventoDaSemana(eventos, hoje);
    const diasAteOficial = oficial ? diffDias(oficial.data, toDateStr(hoje)) : null;
    const oficialNaDupla =
      oficial?.numero != null && dupla.encontros.some((e) => e.numero === oficial.numero);
    if (
      oficial?.numero != null &&
      diasAteOficial != null &&
      diasAteOficial >= 0 &&
      diasAteOficial <= 5 &&
      !proximo &&
      !oficialNaDupla
    )
      return {
        semaforo: "atencao",
        motivo: `O ${oficial.numero}º encontro é ${formatDiaSemanaMes(oficial.data)} e ainda não foi agendado`,
        ...base,
        pediuApoio,
      };
  }
  if (pendencia)
    return {
      semaforo: "atencao",
      motivo:
        pendencia.status === "agendado"
          ? `${pendencia.numero}º encontro agendado já passou: falta o registro`
          : "Encontro realizado sem registro",
      ...base,
      pediuApoio,
    };
  if (encaminhamentoVencido)
    return { semaforo: "atencao", motivo: "Combinado com prazo vencido", ...base, pediuApoio };
  // estagnação da trilha especialista (0073): sem calendário oficial, o
  // "parou no tempo" não aparece em atraso — 90 dias de trilha aberta sem
  // sessão recente nem agendada é o nudge do guia pra revisar o fit.
  const NOVENTA_DIAS = 90 * 86400000;
  if (
    ehEspecialista &&
    dupla.iniciada_em &&
    hoje.getTime() - new Date(`${dupla.iniciada_em}T12:00:00`).getTime() >= NOVENTA_DIAS &&
    !dupla.encontros.some((e) => {
      const quando = e.realizado_em ?? e.data_hora;
      return (
        e.status === "realizado" &&
        quando != null &&
        hoje.getTime() - new Date(quando).getTime() < NOVENTA_DIAS
      );
    }) &&
    !dupla.encontros.some(
      (e) =>
        (e.status === "agendado" || e.status === "remarcado") &&
        e.data_hora != null &&
        new Date(e.data_hora).getTime() >= hoje.getTime()
    )
  )
    return {
      semaforo: "atencao",
      motivo: "Trilha com 3 meses sem sessão nova — checar se segue fazendo sentido",
      ...base,
      pediuApoio,
    };
  return {
    semaforo: "ok",
    motivo: proximo ? `Próximo encontro ${formatDate(proximo.data_hora)}` : "Em dia",
    ...base,
    pediuApoio,
  };
}

/** Encontro da trilha ainda sem row em `encontros` — candidato a "aconteceu
 *  sem agendar" (registro retroativo). DPP: só oficiais já vencidos na janela
 *  da dupla, com a data oficial como sugestão. Especialista: qualquer passo
 *  ainda não coberto — sem data sugerida (não existe calendário pra sugerir). */
export type EncontroFaltante = { numero: number; dataSugerida: string | null };

// ---------- trilha especialista: numero = tentativa, passo = rank (0074) ----
// Desde a 0074 o `numero` do encontro numa dupla de especialista é o ORDINAL
// DA TENTATIVA (1, 2, 3… a cada pedido aceito) — um nao_aconteceu não queima
// passo do guia. O passo que cada sessão cobre é o rank dela entre os
// realizados; pra uma tentativa pendente/falha é onde ela cairia se rolasse.

/** Passo do guia (1..5) que uma tentativa cobre — `encontros` deve ser a
 *  lista da MESMA dupla. Clampa no teto da trilha: um hipotético 6º
 *  realizado continua contando o 5º (o budget do banco barra antes). */
export function passoEsp(
  encontro: Pick<Encontro, "numero" | "status">,
  encontros: Pick<Encontro, "numero" | "status">[]
): number {
  const realizadosAntes = encontros.filter(
    (e) => e.status === "realizado" && e.numero < encontro.numero
  ).length;
  return Math.min(
    Math.max(1 + realizadosAntes, 1),
    TRILHA_LEN.especialista
  );
}

/** O encontro que representa um passo do guia numa dupla de especialista:
 *  o realizado que o cobriu (rank único), senão a tentativa mais recente
 *  mirando nele — o nó mostra a última cartada, não o rastro de falhas. */
export function encontroDoPassoEsp(
  encontros: Encontro[],
  passo: number
): Encontro | null {
  let alvo: Encontro | null = null;
  for (const e of encontros) {
    if (passoEsp(e, encontros) !== passo) continue;
    if (
      !alvo ||
      e.status === "realizado" ||
      (alvo.status !== "realizado" && e.numero > alvo.numero)
    ) {
      alvo = e;
    }
  }
  return alvo;
}

/** O que a superfície de agendamento precisa saber da dupla — derivação única
 *  usada pela ficha, pela home do mentor e pela agenda (era copiada em cada). */
export type AlvoAgendamento = {
  /** saude.proximo?.numero ?? primeiro nº ainda não realizado (teto = total). */
  proximoNumero: number;
  /** A row real do nº alvo — agendada, não-aconteceu… — é o que o dialog edita. */
  encontroAlvo: Encontro | null;
  /** Data oficial do nº alvo no calendário do ciclo (YYYY-MM-DD). */
  sugeridoProximo?: string;
  /** Oficiais vencidos dentro da janela da dupla e sem row em encontros. */
  faltantes: EncontroFaltante[];
  /** Todos os encontros do ciclo já realizados — desliga o CTA de agendar. */
  cicloCompleto: boolean;
};

export function alvoAgendamento(
  dupla: Dupla,
  eventos: CicloEvento[],
  hoje = new Date()
): AlvoAgendamento {
  // mesmo recorte do semáforo — os faltantes/sugestões saem do calendário dela
  eventos = eventosDoCronograma(eventos, dupla.cronograma_id);
  const saude = saudadeDaDupla(dupla, eventos, hoje);
  const ehEspecialista = dupla.trilha === "especialista";
  const encontroEventos = eventos.filter(encontroDatado);
  // DPP mede contra os encontros do ciclo; a especialista tem o teto próprio.
  // DPP sem cronograma (estado inválido — o CHECK do banco barra, mas dado
  // legado pode chegar): total 0 marcaria cicloCompleto e apagaria os CTAs;
  // o fallback pro teto canônico mantém a dupla agendável até a correção.
  const total = ehEspecialista
    ? TRILHA_LEN.especialista
    : encontroEventos.length
      ? encontroEventos.length
      : TRILHA_LEN.dpp;
  let proximoNumero: number;
  let encontroAlvo: Encontro | null;
  if (ehEspecialista) {
    // numero é tentativa (0074): proximoNumero fala em PASSO — o do agendado
    // futuro se houver, senão o primeiro passo sem realizado que o cubra
    proximoNumero = saude.proximo
      ? passoEsp(saude.proximo, dupla.encontros)
      : Math.min(saude.feitos + 1, total);
    // a row alvo é a tentativa que representa o passo — com agendado futuro
    // é ele mesmo; senão, a última tentativa do passo (nao_aconteceu pode
    // ser remarcada — a action edita a row existente)
    encontroAlvo =
      saude.proximo ?? encontroDoPassoEsp(dupla.encontros, proximoNumero);
  } else {
    // primeiro número ainda não realizado — reposição deixa buracos na
    // sequência (ex.: fez o 4º antes do 3º), então "feitos + 1" podia cair
    // num realizado
    const numerosFeitos = new Set(
      dupla.encontros.filter((e) => e.status === "realizado").map((e) => e.numero)
    );
    let primeiroFaltante = 1;
    while (numerosFeitos.has(primeiroFaltante)) primeiroFaltante++;
    proximoNumero = saude.proximo?.numero ?? Math.min(primeiroFaltante, total);
    // a row real desse número é o que o dialog edita; saude.proximo só cobre
    // agendados futuros
    encontroAlvo = dupla.encontros.find((e) => e.numero === proximoNumero) ?? null;
  }
  // sem calendário oficial não há data a sugerir — o dialog abre em branco.
  // A data oficial é a do PDF como ela é — quinta-feira numa semana de
  // encontro duplo sugere quinta, não terça.
  const sugeridoProximo = ehEspecialista
    ? undefined
    : encontroEventos.find((e) => e.numero === proximoNumero)?.data ?? undefined;

  const hojeStr = toDateStr(hoje);
  const comEncontro = new Set(dupla.encontros.map((e) => e.numero));
  // passo com tentativa ainda em aberto (agendada/remarcada) não é faltante:
  // "rolou mesmo assim" se resolve marcando ESSA row, não criando outra
  const passosEmAberto = ehEspecialista
    ? new Set(
        dupla.encontros
          .filter((e) => e.status === "agendado" || e.status === "remarcado")
          .map((e) => passoEsp(e, dupla.encontros))
      )
    : null;
  const faltantes: EncontroFaltante[] = ehEspecialista
    ? // passo ainda não coberto por um realizado nem mirado por uma
      // tentativa em aberto — "aconteceu sem agendar" registra a tentativa
      // nova; o passo é o rank, não o numero da row
      Array.from(
        { length: Math.max(0, total - saude.feitos) },
        (_, i) => saude.feitos + i + 1
      )
        .filter((p) => !passosEmAberto!.has(p))
        .map((numero) => ({ numero, dataSugerida: null }))
    : encontroEventos.flatMap((e) =>
        e.numero != null &&
        e.data <= hojeStr &&
        (!dupla.iniciada_em || e.data >= dupla.iniciada_em) &&
        !comEncontro.has(e.numero)
          ? [{ numero: e.numero, dataSugerida: e.data }]
          : []
      );

  return {
    proximoNumero,
    encontroAlvo,
    sugeridoProximo,
    faltantes,
    cicloCompleto: saude.feitos >= total,
  };
}

/** Situação de um passo na trilha de jornada — mesma gramática dos dots da
 *  agenda: fill = aconteceu (lime com registro, âmbar sem), anel = futuro ou
 *  incerteza, apagado = não rolou. */
export type EstadoNoJornada =
  | "realizado_completo"   // realizado + registro entregue
  | "pendente_registro"    // realizado sem registro — o âmbar que a coordenação monitora
  | "limbo"                // agendado vencido sem registro — pode ter rolado
  | "agendado"             // agendado/remarcado ainda por vir
  | "nao_aconteceu"        // nao_aconteceu/cancelado
  | "futuro";              // sem row — a caminho

export type MarcoJornada = "primeiro" | "metade" | "reta_final" | "completo";

export type NoJornada = {
  /** 1..total dentro da janela da dupla (não é o nº oficial do encontro). */
  posicao: number;
  numero: number;
  /** Passo do guia — data null na trilha especialista. */
  evento: PassoGuia;
  estado: EstadoNoJornada;
  encontro: Encontro | null;
  /** Marco cuja posição-limiar é este nó — só setado depois de atingido. */
  marco: MarcoJornada | null;
};

export type JornadaDupla = {
  nos: NoJornada[];
  /** Encontros oficiais na janela (pode ser < 16 em dupla de meio de ciclo). */
  total: number;
  feitos: number;
  comRegistro: number;
  /** pendente_registro + limbo — o que ainda pede confirmação. */
  pendentesRegistro: number;
  /** Nº oficial do 1º passo ainda não realizado — o "você está aqui" (anel na
   *  trilha). O estado do nó segue verdadeiro: um limbo ou nao_aconteceu como
   *  passo atual continua mostrando que pede ação. Null quando completa ou a
   *  dupla não está ativa (trilha congela — nada pede ação). */
  proximoNumero: number | null;
  faseAtual: { indice: number; total: number; nome: string } | null;
  completa: boolean;
  /** iniciada_em podou encontros do início do ciclo — a trilha começa depois. */
  janelaCortada: boolean;
};

/** Limiares dos marcos sobre `feitos` — por posição na janela, nunca por nº
 *  oficial (a jornada pode começar no meio do ciclo). `reta_final` se
 *  auto-exclui em trilhas curtas (na de 5, total−3 ≤ metade). */
function limiaresMarcos(total: number): [MarcoJornada, number][] {
  const metade = Math.ceil(total / 2);
  const l: [MarcoJornada, number][] = [["primeiro", 1], ["metade", metade]];
  if (total - 3 > metade) l.push(["reta_final", total - 3]);
  l.push(["completo", total]);
  return l;
}

/** Marcos cujo limiar foi cruzado entre `antes` e `depois` realizados — o
 *  notifier dispara só o que é novo (e só o mais alto da leva). */
export function marcosEntre(antes: number, depois: number, total: number): MarcoJornada[] {
  if (depois <= antes || total <= 0) return [];
  return limiaresMarcos(total)
    .filter(([, p]) => p > antes && p <= depois)
    .map(([m]) => m);
}

/** Mapa de progresso da dupla: os passos da trilha (`passosDaTrilha`) como
 *  nós numerados. Derivação pura — o estado já está gravado nas rows; nada
 *  aqui persiste. Passos oficiais anteriores ao início da dupla não entram:
 *  buraco no começo leria como perda, e a trilha é só-positiva. Na trilha
 *  especialista os passos não têm data — `janela` é sempre o guia inteiro. */
export function jornadaDaDupla(
  dupla: Dupla,
  passos: PassoGuia[],
  hoje = new Date()
): JornadaDupla {
  const oficiais = [...passos].sort((a, b) => a.numero - b.numero);
  const janela = dupla.iniciada_em
    ? oficiais.filter((e) => e.data == null || e.data >= dupla.iniciada_em!)
    : oficiais;
  const total = janela.length;
  // DPP: numero é a identidade do passo. Especialista (0074): numero é a
  // tentativa — o passo é o rank entre realizados; várias tentativas miram o
  // mesmo passo e o nó mostra a última (o realizado sempre vence).
  const ehEsp = dupla.trilha === "especialista";
  const porNumero = new Map(dupla.encontros.map((e) => [e.numero, e]));
  const encontroDoPasso = (numero: number): Encontro | null =>
    ehEsp
      ? encontroDoPassoEsp(dupla.encontros, numero)
      : (porNumero.get(numero) ?? null);

  const nos: NoJornada[] = janela.map((evento, i) => {
    const encontro = encontroDoPasso(evento.numero);
    let estado: EstadoNoJornada;
    if (!encontro) estado = "futuro";
    else if (encontro.status === "realizado")
      estado = encontro.registro ? "realizado_completo" : "pendente_registro";
    else if (emLimbo(encontro, hoje.getTime()))
      estado = "limbo";
    else if (encontro.status === "agendado" || encontro.status === "remarcado")
      estado = "agendado";
    else estado = "nao_aconteceu";
    return { posicao: i + 1, numero: evento.numero, evento, estado, encontro, marco: null };
  });

  const realizado = (n: NoJornada) =>
    n.estado === "realizado_completo" || n.estado === "pendente_registro";
  const feitos = nos.filter(realizado).length;
  const ativa = dupla.status === "ativa";

  // "você está aqui" = primeiro passo ainda não realizado — pode ser um atraso
  // a recuperar (limbo/nao_aconteceu), não só um futuro. O nó não muda de
  // estado: o anel marca posição, a cor segue dizendo o que falta.
  const noAtual = ativa && feitos < total ? (nos.find((n) => !realizado(n)) ?? null) : null;

  // o marco mora na posição do limiar e só aparece depois de cruzado — marco
  // futuro não vira cadeado ("locked" é framing de falta)
  for (const [marco, pos] of limiaresMarcos(total)) {
    const no = nos[pos - 1];
    if (no && feitos >= pos) no.marco = marco;
  }

  // fase corrente = a do passo atual; congelada/completa, a do último passo
  // não realizado (onde a trilha parou) ou do último nó
  const noFase = noAtual ?? nos.find((n) => !realizado(n)) ?? nos[total - 1] ?? null;
  const fases = [...new Set(janela.map((e) => e.fase).filter((f): f is string => !!f))];
  const nomeFase = noFase?.evento.fase ?? null;
  const faseAtual =
    nomeFase && fases.includes(nomeFase)
      ? { indice: fases.indexOf(nomeFase) + 1, total: fases.length, nome: nomeFase }
      : null;

  return {
    nos,
    total,
    feitos,
    comRegistro: nos.filter((n) => n.estado === "realizado_completo").length,
    pendentesRegistro: nos.filter(
      (n) => n.estado === "pendente_registro" || n.estado === "limbo"
    ).length,
    proximoNumero: noAtual?.numero ?? null,
    faseAtual,
    completa: total > 0 && feitos >= total,
    janelaCortada: janela.length < oficiais.length,
  };
}

/** Default de `duplas.iniciada_em` quando a coordenação não informa: uma semana
 *  antes do 1º encontro oficial — a dupla nasce "antes do ciclo", então os
 *  encontros contam desde o 1º (inclusive) sem depender de default = hoje. */
export function inicioDefaultDupla(
  eventos: Pick<CicloEvento, "tipo" | "data">[]
): string | null {
  const primeiro = eventos
    .filter(
      (e): e is Pick<CicloEvento, "tipo"> & { data: string } =>
        e.tipo === "encontro" && e.data != null
    )
    .sort((a, b) => a.data.localeCompare(b.data))[0];
  if (!primeiro) return null;
  const d = new Date(`${primeiro.data}T12:00:00`);
  d.setDate(d.getDate() - 7);
  return toDateStr(d);
}



const TZ = "America/Sao_Paulo";

const fmtDia = new Intl.DateTimeFormat("en-CA", {
  timeZone: TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** "hoje" no fuso do programa — en-CA formata YYYY-MM-DD. */
export function toDateStr(d: Date): string {
  return fmtDia.format(d);
}

export function diffDias(a: string, b: string): number {
  return Math.round((new Date(a).getTime() - new Date(b).getTime()) / 86400000);
}

/** "YYYY-MM-DD" é dia de calendário, não instante · âncora no meio-dia pra não voltar um dia no fuso. */
function paraData(iso: string): Date {
  return /^\d{4}-\d{2}-\d{2}$/.test(iso) ? new Date(`${iso}T12:00:00`) : new Date(iso);
}

// o ciclo cruza a virada do ano ("2026/2027" = out→jun) — "15 de jan." sem
// ano é ambíguo em registro e log, então os formatos de prosa levam ano
// sempre; os compactos de grid/trilha (diaCompacto, formatDiaNum) ficam sem
export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "a definir";
  const d = paraData(iso);
  if (isNaN(d.getTime())) return "a definir";
  return d.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: TZ,
  });
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "a definir";
  const d = paraData(iso);
  if (isNaN(d.getTime())) return "a definir";
  return d.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: TZ,
  });
}

/** "15/10 às 19:00" — compacto sem ano; é o formato do corpo das
 *  notificações de agenda (0072) e do aviso de encontro sobreposto. */
export function formatDiaHora(iso: string | null | undefined): string {
  if (!iso) return "a definir";
  const d = paraData(iso);
  if (isNaN(d.getTime())) return "a definir";
  const dia = d.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    timeZone: TZ,
  });
  const hora = d.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: TZ,
  });
  return `${dia} às ${hora}`;
}

/** "06/10/2026" — dia, mês e ano numerados. */
export function formatDiaMes(iso: string | null | undefined): string {
  if (!iso) return "a definir";
  const d = paraData(iso);
  if (isNaN(d.getTime())) return "a definir";
  return d.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: TZ,
  });
}

/** "3,4 MB" / "218 KB" — pt-BR com vírgula decimal. */
export function formatTamanho(bytes: number): string {
  if (bytes >= 1024 * 1024) {
    const mb = bytes / (1024 * 1024);
    return `${mb >= 10 ? Math.round(mb) : mb.toFixed(1).replace(".", ",")} MB`;
  }
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

/** "15" — só o dia, pro nó da timeline de /registros. */
export function formatDiaNum(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = paraData(iso);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString("pt-BR", { day: "2-digit", timeZone: TZ });
}

/** "set" — mês abreviado sem o ponto que o Intl pt-BR devolve ("set."). */
export function formatMesAbrev(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = paraData(iso);
  if (isNaN(d.getTime())) return "";
  return d
    .toLocaleDateString("pt-BR", { month: "short", timeZone: TZ })
    .replace(/\.$/, "");
}

/** "set de 2025" — mês abreviado sem ponto + ano ("no programa desde…"). */
export function formatMesAno(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = paraData(iso);
  if (isNaN(d.getTime())) return "";
  return d
    .toLocaleDateString("pt-BR", { month: "short", year: "numeric", timeZone: TZ })
    .replace(/\./, "");
}

const TRES_DIAS_MS = 3 * 86400000;

/** Registro tardio: entregue mais de 3 dias depois de o encontro acontecer.
 *  Sem `realizado_em` cai na `data_hora` agendada; sem nenhuma das duas não dá
 *  pra atrasar → false. (Antes essa conta vivia duplicada em 3 componentes.) */
export function registroTardio(
  registro: { created_at: string },
  encontro?: { realizado_em: string | null; data_hora: string | null } | null
): boolean {
  const quando = encontro?.realizado_em ?? encontro?.data_hora;
  return (
    quando != null &&
    new Date(registro.created_at).getTime() - new Date(quando).getTime() >
      TRES_DIAS_MS
  );
}

/** Dias inteiros entre o encontro e a entrega do registro (0 quando não tardio). */
export function diasAtrasoRegistro(
  registro: { created_at: string },
  encontro?: { realizado_em: string | null; data_hora: string | null } | null
): number {
  const quando = encontro?.realizado_em ?? encontro?.data_hora;
  if (quando == null) return 0;
  const dias = Math.round(
    (new Date(registro.created_at).getTime() - new Date(quando).getTime()) /
      86400000
  );
  return Math.max(0, dias);
}

/** "terça-feira" — dia da semana por extenso; "" se a data for inválida. */
export function formatDiaSemana(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = paraData(iso);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString("pt-BR", { weekday: "long", timeZone: TZ });
}

/** "terça-feira (06/10)" — cai pra "06/10" se o dia da semana não resolver. */
export function formatDiaSemanaMes(iso: string | null | undefined): string {
  const dia = formatDiaSemana(iso);
  const dm = formatDiaMes(iso);
  return dia ? `${dia} (${dm})` : dm;
}

/** "terça 06/10 às 19:00" — o rótulo de um slot da agenda do especialista
 *  nos pickers de aceite/contra-proposta (mesma gramática do preview da
 *  grade em /agenda). */
export function rotuloSlot(iso: string): string {
  return `${formatDiaSemana(iso).replace("-feira", "")} ${formatDiaHora(iso)}`;
}

/** Sugestões do TagInput de áreas de atuação (onboarding + /perfil + ficha da
 *  coordenação) — o campo aceita digitação livre; a lista só acelera o toque.
 *  Teto de 10 itens / 40 chars por área é o CHECK profiles_areas_ok (0030). */
export const AREAS_SUGESTOES = [
  "tecnologia",
  "finanças",
  "carreira",
  "design",
  "marketing",
  "comunicação",
  "empreendedorismo",
  "educação",
  "dados",
  "direito",
  "saúde",
  "vendas",
  "produto",
  "RH",
  "projetos sociais",
];

/** Rótulo do papel — mora aqui (não em app-shell) pra server components poderem usar. */
export function papelLabel(role: string | null | undefined) {
  switch (role) {
    case "coordenacao": return "Coordenação";
    case "supervisor": return "Supervisor de relacionamento";
    case "mentor_dpp": return "Mentor DPP";
    case "mentor_especialista": return "Mentor especialista";
    case "mentorado": return "Mentorado";
    default: return "Sem papel definido";
  }
}

/** Versão curta do papel — cabe nos ~80-140px da pill do header mobile e da
 *  DemoBar ("Supervisor de relacionamento" truncaria ali). */
export function papelCurto(role: string | null | undefined) {
  switch (role) {
    case "coordenacao": return "Coordenação";
    case "supervisor": return "Supervisor";
    case "mentor_dpp": return "Mentor DPP";
    case "mentor_especialista": return "Especialista";
    case "mentorado": return "Mentorado";
    case null:
    case undefined:
    case "": return "";
    default: return papelLabel(role);
  }
}

/** Quem pode ser `supervisor_id` de uma dupla: o papel supervisor e a
 *  coordenação — na operação real os supervisores ativos são da equipe
 *  executiva. Uma régua só pros selects de dupla e pras actions; o banco
 *  não olha papel (as policies trabalham com o vínculo supervisor_id). */
export function podeSupervisionar(role: string | null | undefined): boolean {
  return role === "supervisor" || role === "coordenacao";
}

export function waLink(phone: string | null | undefined, mensagem: string): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  // dado legado/edição manual pode ter caractere mas zero dígito ("-", "abc")
  // — wa.me/ vazio abre a página de erro do WhatsApp, então falha aqui
  if (!digits.length) return null;
  return `https://wa.me/${digits}?text=${encodeURIComponent(mensagem)}`;
}

/** WhatsApp cru (`5511987654003`) → exibição `(11) 98765-4003`. Só mascara
 *  BR ("55" + 10/11 dígitos) — número estrangeiro volta cru, máscara errada
 *  é pior que nenhuma. Round-trip garantido: normWhatsapp re-normaliza. */
export function formatWhatsApp(d: string | null | undefined): string {
  if (!d) return "";
  const digits = d.replace(/\D/g, "");
  if (digits.startsWith("55") && (digits.length === 12 || digits.length === 13)) {
    const dd = digits.slice(2, 4);
    const rest = digits.slice(4);
    const split = rest.length === 9 ? 5 : 4;
    return `(${dd}) ${rest.slice(0, split)}-${rest.slice(split)}`;
  }
  return d;
}

/** href seguro: só http(s). O CHECK do banco (0023) barra a escrita; este
 *  guard cobre dado pré-constraint e qualquer escrita fora do app. */
export function linkSeguro(url: string | null | undefined): string | null {
  return url != null && /^https?:\/\//i.test(url) ? url : null;
}

/** nomes pt-BR — cedilha/acento na ordem alfabética certa, case-insensitive.
 *  Mesma régua pra listas server e client (a collation do Postgres põe
 *  acentos depois de Z, então a ordenação final é sempre no app). */
export const comparaNome = (a: string, b: string) =>
  a.localeCompare(b, "pt-BR", { sensitivity: "base" });

/** Ordenação por urgência do semáforo — risco → atenção → ok. */
export const ORDEM_SEMAFORO: Record<Semaforo, number> = {
  risco: 0,
  atencao: 1,
  ok: 2,
} as const;

/** "há N min/h/d" — `agoraMs` vem congelado do chamador (useState(() =>
 *  Date.now()) no client ou Date.now() no server) pra não divergir entre
 *  SSR e hidratação. */
export function tempoRelativo(iso: string, agoraMs: number): string {
  const diff = agoraMs - new Date(iso).getTime();
  const min = Math.floor(diff / 60_000);
  if (min < 1) return "agora";
  if (min < 60) return `há ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `há ${h} h`;
  const d = Math.floor(h / 24);
  if (d === 1) return "ontem";
  if (d < 7) return `há ${d} d`;
  return formatDate(iso);
}
