/*
 * Dataset do modo demonstração.
 *
 * Monta um ciclo inteiro em memória — pessoas, duplas, encontros, registros e
 * demais tabelas — pra demo rodar sem sessão nem Supabase. É consumido por
 * `demo/queries.ts` (server components, quando o cookie `demo_role` está
 * ativo) e por `demo/client-stub.ts` (browser, pro stub do supabase-js) —
 * por isso este módulo não pode importar nada server-only (next/*, react,
 * @/lib/supabase/*): só `import type`, apagado no build.
 *
 * Evergreen: nenhuma data é fixa. O calendário oficial do ciclo (16 encontros
 * de terça-feira, formação, recesso, marco — cópia fiel do seed.sql) é
 * deslocado pra que o 5º encontro caia na terça da semana corrente, e todos
 * os timestamps derivam de `new Date()`. Abrir a demo daqui a meses continua
 * contando a mesma história: semana 5 do ciclo, dupla saudável, uma com
 * registro pendente, uma em risco, uma com atraso, uma encerrada do ciclo
 * anterior e três trilhas de especialista (duas na mesma mentora — a Sofia).
 */

import type {
  AppRole,
  Assinatura,
  AvaliacaoJovem,
  CicloEvento,
  Comunicado,
  DocumentoTemplate,
  Dupla,
  Encaminhamento,
  Encontro,
  EspecialistaEvento,
  Material,
  Mentorado,
  MentorProfile,
  Notificacao,
  PessoaNota,
  Presenca,
  Profile,
  ProximoPasso,
  Registro,
  RegistroAnexo,
  SolicitacaoEspecialista,
  Supervisao,
} from "@/lib/types";
import type { Interacao } from "@/lib/interacoes";

export type DemoData = {
  personas: Record<AppRole, Profile>;
  profiles: Profile[];
  mentorados: Mentorado[];
  mentorProfiles: MentorProfile[];
  duplas: Dupla[];
  anexos: RegistroAnexo[];
  cicloEventos: CicloEvento[];
  especialistaEventos: EspecialistaEvento[];
  materiais: Material[];
  comunicados: Comunicado[];
  solicitacoes: SolicitacaoEspecialista[];
  pessoaNotas: PessoaNota[];
  interacoes: Interacao[];
  notificacoes: Record<AppRole, Notificacao[]>;
  documentoTemplates: DocumentoTemplate[];
  assinaturas: Assinatura[];
  presencas: Presenca[];
  supervisoes: Supervisao[];
};

// ---------- ids ----------

/** Uuids válidos (só hex) com faixa fixa por entidade — regexes do app
 *  validam o formato, e ids legíveis ajudam a depurar a demo ("0807 é
 *  encontro", "2402 é solicitação"). */
const uid = (n: number): string =>
  `de000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

// profiles: 00xx · mentorados: 04xx · duplas: 06xx · encontros: 08xx ·
// registros: 10xx · encaminhamentos: 12xx · encontro_notas: 14xx ·
// anexos: 16xx · ciclo_eventos: 18xx · materiais: 20xx · comunicados: 22xx ·
// solicitacoes: 24xx · pessoa_notas: 26xx · interacoes: 28xx ·
// notificacoes: 30xx · assinaturas: 32xx · doc_templates: 33xx · tokens de
// assinatura: 34xx · presencas: 36xx · supervisoes: 38xx. user_id fake:
// f0xx. especialista_eventos não tem id.
const P = {
  marina: 0x0001, // persona coordenação
  paulo: 0x0002, // persona supervisor
  ricardo: 0x0003, // persona mentor_dpp
  sofia: 0x0004, // persona mentor_especialista
  beatriz: 0x0005,
  carlos: 0x0006,
  fernanda: 0x0007,
  joaoPedro: 0x0008,
  luiza: 0x0009,
  andre: 0x000a,
  helena: 0x000b,
  marcos: 0x000c,
  renata: 0x000d, // cadastro novo, sem papel
  patricia: 0x000e, // inativa
} as const;

const M = {
  ana: 0x0401,
  caio: 0x0402,
  dandara: 0x0403,
  eduardo: 0x0404,
  isabela: 0x0405,
  kaua: 0x0406,
  laura: 0x0407,
  pedro: 0x0408,
} as const;

const D = {
  ok: 0x0601,
  pend: 0x0602,
  risco: 0x0603,
  atraso: 0x0604,
  fim: 0x0605,
  esp1: 0x0606,
  esp2: 0x0607,
  esp3: 0x0608,
} as const;

const S = { aceita1: 0x2401, aceita2: 0x2402, direcionada: 0x2403, livre: 0x2404, cancelada: 0x2405, aceita3: 0x2406 } as const;

const MEET = "https://meet.google.com/demo-realiza";

// ---------- datas ----------

const DIA_MS = 24 * 3600 * 1000;
const HORA_MS = 3600 * 1000;

const addDias = (d: Date, n: number): Date => new Date(d.getTime() + n * DIA_MS);

/** "YYYY-MM-DD" do dia de um Date — os Date aqui nascem ancorados no
 *  meio-dia local, então a virada de dia/fuso não desloca a data. */
const ymd = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;

/** Instante ISO de um dia + horário no fuso do programa (America/Sao_Paulo)
 *  — "19:00" de uma terça vira "T22:00:00.000Z", como o Postgres devolveria. */
const em = (d: Date, hhmm: string): string =>
  new Date(`${ymd(d)}T${hhmm}:00-03:00`).toISOString();

/** Há n dias (ou daqui a n, com n negativo), num horário plausível. */
const haDias = (n: number, hhmm = "10:00"): string =>
  em(addDias(HOJE, -n), hhmm);

/** created_at de registro: algumas horas depois de o encontro acontecer. */
const depoisDe = (iso: string, horas: number): string =>
  new Date(new Date(iso).getTime() + horas * HORA_MS).toISOString();

/** "hoje" ancorado no meio-dia — todas as datas relativas partem daqui. */
const AGORA = new Date();
const HOJE = new Date(
  AGORA.getFullYear(),
  AGORA.getMonth(),
  AGORA.getDate(),
  12
);

/** Terça-feira da semana corrente — âncora do 5º encontro do ciclo. */
const TERCA_ENCONTRO_5 = addDias(HOJE, ((2 - HOJE.getDay()) + 7) % 7);

/** Dia oficial do encontro n do ciclo (espelha o seed/cronograma oficial):
 *  1–8 semanais a partir da âncora; 15 dias entre o 8º e o 9º (tempo de
 *  prática das submetas); 9–14 semanais; recesso de ~3 semanas; 15–16. */
function diaEncontro(n: number): Date {
  if (n <= 8) return addDias(TERCA_ENCONTRO_5, (n - 5) * 7);
  if (n <= 14) return addDias(TERCA_ENCONTRO_5, (n - 5) * 7 + 7); // folga 8º→9º
  if (n === 15) return addDias(TERCA_ENCONTRO_5, 91); // 14 + 21d (recesso)
  return addDias(TERCA_ENCONTRO_5, 98); // 15 + 7d
}

// ---------- calendário oficial (conteúdo do seed.sql, datas deslocadas) ----------

function buildCicloEventos(): CicloEvento[] {
  let i = 0;
  const ev = (
    tipo: CicloEvento["tipo"],
    numero: number | null,
    data: Date,
    titulo: string,
    fase: string | null = null,
    instrumentos: string[] = [],
    dataFim: Date | null = null
  ): CicloEvento => ({
    id: uid(0x1800 + ++i),
    tipo,
    numero,
    data: ymd(data),
    data_fim: dataFim ? ymd(dataFim) : null,
    titulo,
    fase,
    instrumentos,
  });

  const F1 = "Criar vínculo e construir o PDM";
  const F2 = "Colocar o plano em prática";
  const F3 = "Consolidar a autonomia";
  const F4 = "Aprofundar o vínculo e o aprendizado";
  const F5 = "Roda da Vida";
  const F6 = "Encerrar e celebrar";

  return [
    // pré-ciclo no cronograma oficial: inscrições -40→-20d, triagem -19→-14d,
    // matching -13→-6d, formação -5/-4 e abertura -4 (tudo antes do encontro 1)
    ev("marco", null, addDias(diaEncontro(1), -40), "Inscrições e seleção", null, [], addDias(diaEncontro(1), -20)),
    ev("marco", null, addDias(diaEncontro(1), -19), "Triagem e preparação do matching", null, [], addDias(diaEncontro(1), -14)),
    ev("marco", null, addDias(diaEncontro(1), -13), "Matching das duplas", null, [], addDias(diaEncontro(1), -6)),
    ev("formacao", null, addDias(diaEncontro(1), -5), "Encontro inicial de formação de mentores"),
    ev("formacao", null, addDias(diaEncontro(1), -4), "Encontro final de formação de mentores"),
    ev("marco", null, addDias(diaEncontro(1), -4), "Encontro de abertura com a coordenação"),
    ev("encontro", 1, diaEncontro(1), "Boas-vindas, histórias de vida e abertura", F1, ["Perguntas Eficazes", "Escuta Ativa", "PDM", "Roda da Vida (leitura inicial)"]),
    ev("encontro", 2, diaEncontro(2), "Avaliação por terceiros e visão de futuro", F1, ["PDM", "Construindo a sua Visão"]),
    ev("encontro", 3, diaEncontro(3), "Declaração de Visão e metas SMART", F1, ["PDM", "Modelo SMART"]),
    ev("encontro", 4, diaEncontro(4), "Fechamento da construção do PDM", F1, ["PDM", "Perguntas Eficazes"]),
    ev("encontro", 5, diaEncontro(5), "Acompanhamento das primeiras submetas", F2, ["PDM", "Feedback Construtivo"]),
    ev("encontro", 6, diaEncontro(6), "Superação de obstáculos", F2, ["PDM", "Feedback Construtivo"]),
    ev("encontro", 7, diaEncontro(7), "Ajustes de prazos e desdobramentos", F2, ["PDM", "Feedback Construtivo"]),
    // títulos/fases/instrumentos 8–16 = a correção da 0035 (guia DPP oficial):
    // 8 monitora e já transfere a condução; 9 é a revisão de meio de percurso
    ev("encontro", 8, diaEncontro(8), "Monitoramento e responsabilidade", F3, ["PDM", "Escuta Ativa"]),
    ev("encontro", 9, diaEncontro(9), "Revisão de meio de percurso", F3, ["PDM", "Escuta Ativa"]),
    ev("encontro", 10, diaEncontro(10), "O mentor como espelho", F4, ["Papel de modelo", "Escuta Ativa"]),
    ev("encontro", 11, diaEncontro(11), "Rede de apoio e novos espaços", F4, ["Papel de modelo", "Escuta Ativa"]),
    ev("encontro", 12, diaEncontro(12), "Aplicação e leitura da Roda da Vida", F5, ["Roda da Vida", "Modelo SMART"]),
    ev("encontro", 13, diaEncontro(13), "Metas das áreas prioritárias", F5, ["Roda da Vida", "Modelo SMART"]),
    ev("encontro", 14, diaEncontro(14), "Desdobramento e plano de continuidade", F5, ["Roda da Vida", "Modelo SMART"]),
    ev("recesso", null, addDias(diaEncontro(14), 1), "Recesso de fim de ano", null, [], addDias(diaEncontro(14), 18)),
    ev("encontro", 15, diaEncontro(15), "Reflexão e reconhecimento", F6, ["PDM", "Roda da Vida"]),
    ev("encontro", 16, diaEncontro(16), "Encerramento e celebração", F6, ["Avaliação 360º", "Autoavaliação do mentor"]),
    // evento de encerramento: 15/01 no cronograma (+3d após o 16º encontro)
    ev("marco", null, addDias(diaEncontro(16), 3), "Evento de encerramento do programa"),
  ];
}

// ---------- textos de registro ----------

// Um "roteiro" por nº de encontro, alinhado ao tema do guia (títulos do
// seed). As duplas instanciam com o nome do mentorado + overrides de
// avaliação/dificuldade — é o que deixa cada registro com cara de ter sido
// escrito por um mentor diferente em vez de lorem repetido.
// Os valores de `atividades` espelham ATIVIDADES_ENCONTRO (src/lib/ciclo.ts)
// — duplicados aqui de propósito: este módulo não pode importar runtime.

type RegTmpl = {
  tema: string;
  ferramenta: string;
  atividades: string[];
  avaliacao: AvaliacaoJovem;
  proximo: ProximoPasso;
  reflexoes: (j: string) => string;
  observacoes?: (j: string) => string;
};

const REG_DPP: Record<number, RegTmpl> = {
  1: {
    tema: "Boas-vindas e histórias de vida",
    ferramenta: "Roda da Vida",
    atividades: ["Conversa de acompanhamento", "Orientação individual"],
    avaliacao: "boa",
    proximo: "continuar",
    reflexoes: (j) =>
      `Encontro de abertura, clima leve. ${j} contou da rotina, da família e do que espera do programa — falou com brilho no olho quando o assunto foi o futuro. Fizemos a leitura inicial da Roda da Vida pra mapear os quadrantes.`,
    observacoes: (j) =>
      `Combinado: ${j} repensa a Roda da Vida em casa e lista as pessoas pra avaliação por terceiros.`,
  },
  2: {
    tema: "Avaliação por terceiros e visão de futuro",
    ferramenta: "Construindo a sua Visão",
    atividades: ["Conversa de acompanhamento", "Desenvolvimento de competência"],
    avaliacao: "boa",
    proximo: "continuar",
    reflexoes: (j) =>
      `Lemos juntos o consolidado das avaliações — ${j} se surpreendeu com os pontos fortes que as pessoas citaram. O exercício de visão destravou depois disso.`,
    observacoes: () =>
      "Ficou de terminar a redação da visão até o próximo encontro.",
  },
  3: {
    tema: "Declaração de Visão e metas SMART",
    ferramenta: "Modelo SMART",
    atividades: ["Atividade prática", "Desenvolvimento de competência"],
    avaliacao: "boa",
    proximo: "continuar",
    reflexoes: (j) =>
      `${j} chegou com a Declaração de Visão quase pronta — texto forte, em primeira pessoa. Desdobramos em metas SMART e abrimos a primeira em submetas semanais.`,
    observacoes: () =>
      "Revisar as datas das submetas antes de fechar o PDM no próximo encontro.",
  },
  4: {
    tema: "Fechamento da construção do PDM",
    ferramenta: "PDM",
    atividades: ["Atividade prática", "Acompanhamento de atividade/tarefa"],
    avaliacao: "excelente",
    proximo: "continuar",
    reflexoes: (j) =>
      `Fechamos o PDM completo: visão, metas, indicadores e mapa de submetas. ${j} saiu dizendo que "agora é pra valer" — o documento virou algo concreto, não um papel.`,
    observacoes: () =>
      "A partir daqui o foco é a execução das primeiras submetas.",
  },
  5: {
    tema: "Acompanhamento das primeiras submetas",
    ferramenta: "PDM",
    atividades: ["Acompanhamento de atividade/tarefa", "Conversa de acompanhamento"],
    avaliacao: "boa",
    proximo: "reforcar",
    reflexoes: (j) =>
      `Revisão das primeiras duas semanas de execução — uma submeta já saiu do papel. Em outra ${j} travou, e quebrar em passos menores ajudou a destravar.`,
  },
  6: {
    tema: "Superação de obstáculos",
    ferramenta: "Feedback Construtivo",
    atividades: ["Identificação de dificuldades", "Conversa de acompanhamento"],
    avaliacao: "regular",
    proximo: "reforcar",
    reflexoes: (j) =>
      `Semana difícil: ${j} faltou a um compromisso da meta e pensou em desistir dela. Trabalhamos o feedback construtivo e replanejamos a semana com margem.`,
  },
  7: {
    tema: "Ajustes de prazos e desdobramentos",
    ferramenta: "PDM",
    atividades: ["Acompanhamento de atividade/tarefa"],
    avaliacao: "regular",
    proximo: "continuar",
    reflexoes: (j) =>
      `Semana de provas — pouco avanço nas submetas. Repactuamos prazos no PDM sem cortar metas; ${j} saiu com o plano realista de novo.`,
  },
  // 8–16 realinhados aos títulos oficiais do guia (mesma correção da 0035):
  // o 8º já inclui a transferência gradual da condução e a revisão de meio
  // de percurso é o 9º; 12–14 são os três momentos da Roda da Vida.
  8: {
    tema: "Monitoramento e responsabilidade",
    ferramenta: "PDM",
    atividades: ["Acompanhamento de atividade/tarefa", "Conversa de acompanhamento"],
    avaliacao: "boa",
    proximo: "continuar",
    reflexoes: (j) =>
      `Monitoramento das metas com mais responsabilidade nas mãos de ${j} — dessa vez quem pautou o encontro e conduziu a revisão do PDM foi a pessoa mentorada, quase sem minha ajuda. A autonomia está aparecendo.`,
  },
  9: {
    tema: "Revisão de meio de percurso",
    ferramenta: "Escuta Ativa",
    atividades: ["Conversa de acompanhamento"],
    avaliacao: "boa",
    proximo: "novo_feedback",
    reflexoes: (j) =>
      `Metade do caminho: relemos a Declaração de Visão e ${j} notou quanto já mudou desde o 1º encontro. Revisão honesta do que andou e do que ficou pelo caminho.`,
  },
  10: {
    tema: "O mentor como espelho",
    ferramenta: "Papel de modelo",
    atividades: ["Conversa de acompanhamento", "Orientação profissional"],
    avaliacao: "boa",
    proximo: "continuar",
    reflexoes: (j) =>
      `Contei minha trajetória, incluindo os tropeços. ${j} perguntou bastante sobre o primeiro emprego e as viradas de carreira — as histórias funcionaram como espelho pras próprias escolhas.`,
  },
  11: {
    tema: "Rede de apoio e novos espaços",
    ferramenta: "Papel de modelo",
    atividades: ["Desenvolvimento de competência", "Orientação profissional"],
    avaliacao: "boa",
    proximo: "continuar",
    reflexoes: (j) =>
      `${j} voltou da feira de profissões da ONG com três cursos pra pesquisar. Mapeamos a rede de apoio — quem pode abrir portas e apresentar espaços novos — e ficou de conversar com alguém da área antes de decidir.`,
  },
  12: {
    tema: "Aplicação e leitura da Roda da Vida",
    ferramenta: "Roda da Vida",
    atividades: ["Atividade prática"],
    avaliacao: "boa",
    proximo: "continuar",
    reflexoes: (j) =>
      `Aplicamos a Roda da Vida completa — ${j} marcou saúde e lazer mais baixos e conectou isso com a rotina pesada de estudos.`,
  },
  13: {
    tema: "Metas das áreas prioritárias",
    ferramenta: "Roda da Vida",
    atividades: ["Conversa de acompanhamento", "Identificação de dificuldades"],
    avaliacao: "boa",
    proximo: "reforcar",
    reflexoes: (j) =>
      `Fundo na área prioritária do quadrante de desenvolvimento pessoal. ${j} percebeu sozinho que a meta de leitura estava parada e propôs 20 minutos por dia, sem eu sugerir.`,
  },
  14: {
    tema: "Desdobramento e plano de continuidade",
    ferramenta: "Modelo SMART",
    atividades: ["Atividade prática", "Desenvolvimento de competência"],
    avaliacao: "excelente",
    proximo: "continuar",
    reflexoes: (j) =>
      `Da Roda pro plano: desdobramento das metas das áreas prioritárias em submetas novas no PDM — dessa vez quem escreveu foi ${j}. Fechamos com o plano de continuidade pro recesso.`,
  },
  15: {
    tema: "Reflexão e reconhecimento",
    ferramenta: "Roda da Vida",
    atividades: ["Conversa de acompanhamento"],
    avaliacao: "excelente",
    proximo: "continuar",
    reflexoes: (j) =>
      `Voltamos ao primeiro registro e relemos a Roda da Vida inicial — ${j} listou por conta própria onde cresceu: autonomia, constância e clareza do que quer. Reconhecimento merecido.`,
  },
  16: {
    tema: "Encerramento e celebração",
    ferramenta: "Avaliação 360º",
    atividades: ["Conversa de acompanhamento"],
    avaliacao: "excelente",
    proximo: "outro",
    reflexoes: (j) =>
      `Encontro de encerramento — ${j} releu a Declaração de Visão e reconheceu cada meta cumprida. Preenchemos a avaliação final e fechamos combinando o que continua depois do programa.`,
    observacoes: () => "Ciclo encerrado com todos os combinados cumpridos.",
  },
};

const REG_ESP: Record<number, RegTmpl> = {
  1: {
    tema: "Acolhimento e identificação da demanda",
    ferramenta: "PDM",
    atividades: ["Conversa de acompanhamento", "Identificação de dificuldades"],
    avaliacao: "boa",
    proximo: "continuar",
    reflexoes: (j) =>
      `Primeiro encontro da trilha. Retomamos o PDM da mentoria DPP e ${j} apontou onde a demanda mais aperta — fechamos o foco pra esses 5 encontros.`,
    observacoes: () => "Combinado: trazer um exemplo concreto da dificuldade pro próximo encontro.",
  },
  2: {
    tema: "Orientação e aconselhamento",
    ferramenta: "Escuta Ativa",
    atividades: ["Conversa de acompanhamento", "Orientação individual"],
    avaliacao: "boa",
    proximo: "continuar",
    reflexoes: (j) =>
      `Aprofundamos a demanda do 1º encontro. ${j} já tinha feito a tarefa combinada e a confiança tá crescendo — agora dá pra partir pra meta.`,
  },
  3: {
    tema: "Definição e alinhamento das metas",
    ferramenta: "Modelo SMART",
    atividades: ["Atividade prática", "Acompanhamento de atividade/tarefa"],
    avaliacao: "boa",
    proximo: "reforcar",
    reflexoes: () =>
      `Transformamos a demanda em uma meta SMART dentro do PDM, com as primeiras aplicações práticas combinadas pra rodar entre os encontros.`,
  },
  4: {
    tema: "Acompanhamento do plano de metas",
    ferramenta: "PDM",
    atividades: ["Acompanhamento de atividade/tarefa"],
    avaliacao: "boa",
    proximo: "continuar",
    reflexoes: (j) =>
      `Revisão dos avanços no plano de metas — ajustamos a estratégia num ponto em que ${j} travou e antecipamos os obstáculos da reta final.`,
  },
  5: {
    tema: "Encerramento, reflexão e celebração",
    ferramenta: "PDM",
    atividades: ["Conversa de acompanhamento"],
    avaliacao: "excelente",
    proximo: "continuar",
    reflexoes: (j) =>
      `Encontro de fechamento: ${j} refletiu sobre o que aprendeu, demos feedback mútuo e registramos no PDM o que continua com a mentoria DPP.`,
  },
};

// ---------- builders ----------

type RegOverride = Partial<
  Pick<
    Registro,
    | "tema"
    | "ferramenta"
    | "reflexoes"
    | "observacoes"
    | "precisa_apoio"
    | "atividades"
    | "avaliacao"
    | "dificuldade"
    | "dificuldade_detalhe"
    | "proximo_passo"
    | "proximo_passo_detalhe"
    | "created_at"
  >
>;

function build(): DemoData {
  let seqEnc = 0;
  let seqReg = 0;
  let seqEncam = 0;
  let seqNota = 0;

  type EncOpts = {
    /** Dia em que aconteceu de fato — default = dia agendado. */
    realizadoDia?: Date;
    hora?: string;
    duracao?: number;
    origem?: "plataforma" | "externo";
    link?: string | null;
    motivo?: string | null;
  };

  const agendado = (dupla: string, numero: number, dia: Date, o: EncOpts = {}): Encontro => ({
    id: uid(0x0800 + ++seqEnc),
    dupla_id: dupla,
    numero,
    data_hora: em(dia, o.hora ?? "19:00"),
    realizado_em: null,
    duracao_min: o.duracao ?? 60,
    status: "agendado",
    origem: o.origem ?? "plataforma",
    link: o.link ?? MEET,
    motivo_reagendamento: o.motivo ?? null,
    registro: null,
  });

  const realizado = (dupla: string, numero: number, dia: Date, o: EncOpts = {}): Encontro => ({
    id: uid(0x0800 + ++seqEnc),
    dupla_id: dupla,
    numero,
    data_hora: em(dia, o.hora ?? "19:00"),
    realizado_em: em(o.realizadoDia ?? dia, o.hora ?? "19:00"),
    duracao_min: o.duracao ?? 75,
    status: "realizado",
    origem: o.origem ?? "plataforma",
    link: o.link ?? (o.origem === "externo" ? null : MEET),
    motivo_reagendamento: o.motivo ?? null,
    registro: null,
  });

  const naoAconteceu = (dupla: string, numero: number, dia: Date, o: EncOpts = {}): Encontro => ({
    id: uid(0x0800 + ++seqEnc),
    dupla_id: dupla,
    numero,
    data_hora: em(dia, o.hora ?? "19:00"),
    realizado_em: null,
    duracao_min: o.duracao ?? 60,
    status: "nao_aconteceu",
    origem: o.origem ?? "plataforma",
    link: o.link ?? MEET,
    motivo_reagendamento: o.motivo ?? null,
    registro: null,
  });

  /** Registro do encontro — texto vem do roteiro do nº (DPP ou especialista),
   *  overrides carregam o que a história da dupla pede (apoio, dificuldade,
   *  tardio...). */
  const comRegistro = (
    enc: Encontro,
    mentor: Profile,
    jovem: string,
    trilha: "dpp" | "especialista",
    over: RegOverride = {}
  ): Encontro => {
    const t = (trilha === "especialista" ? REG_ESP : REG_DPP)[enc.numero];
    const reg: Registro = {
      id: uid(0x1000 + ++seqReg),
      encontro_id: enc.id,
      tema: t.tema,
      ferramenta: t.ferramenta,
      reflexoes: t.reflexoes(jovem),
      observacoes: t.observacoes ? t.observacoes(jovem) : null,
      precisa_apoio: false,
      atividades: [...t.atividades],
      avaliacao: t.avaliacao,
      dificuldade: "nenhuma",
      dificuldade_detalhe: null,
      proximo_passo: t.proximo,
      proximo_passo_detalhe:
        t.proximo === "outro" ? "Manter contato pela ONG depois do programa." : null,
      created_by: mentor.id,
      created_at: depoisDe(enc.realizado_em ?? enc.data_hora ?? "", 4),
      autor: { nome: mentor.nome },
      ...over,
    };
    return { ...enc, registro: reg };
  };

  const encaminhamento = (
    dupla: string,
    registro: string | null,
    descricao: string,
    responsavel: "mentor" | "mentorado",
    prazo: Date | null,
    status: Encaminhamento["status"]
  ): Encaminhamento => ({
    id: uid(0x1200 + ++seqEncam),
    dupla_id: dupla,
    registro_id: registro,
    descricao,
    responsavel,
    prazo: prazo ? ymd(prazo) : null,
    status,
  });

  // ---------- pessoas ----------

  // created_at alimenta o "no programa desde" do /perfil

  // Personas: perfil profissional vazio de propósito — o onboarding da demo
  // pergunta bio/áreas/voluntariado, e `onboarded_em` é sempre null (a camada
  // de queries injeta o valor do cookie demo_onboarded por cima).
  const marina: Profile = {
    id: uid(P.marina), user_id: uid(0xf001), nome: "Marina Duarte",
    email: "marina.duarte@realiza.vc", whatsapp: "5511987654001",
    role: "coordenacao", ativo: true, avatar_path: null,
    created_at: haDias(400),
    documento_path: "documentos/termo-marina-duarte.pdf",
    bio: null, linkedin: null, areas: null, voluntariado: null, onboarded_em: null,
    nome_social: null, data_nascimento: "1988-03-15", genero: "feminino",
    cidade: "São Paulo", uf: "SP",
    interesses: ["gestão de programas sociais", "educação", "mentoria"],
    motivacao: "Coordena o programa desde o primeiro ciclo — acredita em mentoria como alavanca de mobilidade.",
    pref_genero_par: "indiferente",
    cargo: "Coordenadora de programas", empresa: "Instituto Realiza",
    origem: "Equipe fundadora", consent_lgpd_em: haDias(400),
    // sync-back da assinatura (0046): quem assinou tem a ficha preenchida
    dados_civis: {
      nome_civil: "Marina Duarte Ferreira", rg: "34.567.890-1",
      cpf: "12345678909", data_nascimento: "1988-03-15",
      endereco: { logradouro: "Rua Vergueiro", numero: "1200", complemento: null, bairro: "Liberdade", cidade: "São Paulo", uf: "SP", cep: "01504001" },
    },
  };
  const paulo: Profile = {
    id: uid(P.paulo), user_id: uid(0xf002), nome: "Paulo Serra",
    email: "paulo.serra@realiza.vc", whatsapp: "5511987654002",
    role: "supervisor", ativo: true, avatar_path: null,
    created_at: haDias(400),
    documento_path: "documentos/termo-paulo-serra.pdf",
    bio: null, linkedin: null, areas: null, voluntariado: null, onboarded_em: null,
    nome_social: null, data_nascimento: "1979-06-22", genero: "masculino",
    cidade: "São Paulo", uf: "SP",
    interesses: ["psicologia", "adolescência", "supervisão de grupos"],
    motivacao: "Psicólogo há 20 anos; entrou pra dar suporte técnico às duplas.",
    pref_genero_par: "indiferente",
    cargo: "Psicólogo", empresa: "Consultório próprio",
    origem: "Indicação da coordenação", consent_lgpd_em: haDias(400),
  };
  const ricardo: Profile = {
    id: uid(P.ricardo), user_id: uid(0xf003), nome: "Ricardo Tavares",
    email: "ricardo.tavares@realiza.vc", whatsapp: "5511987654003",
    role: "mentor_dpp", ativo: true, avatar_path: null,
    created_at: haDias(45),
    documento_path: "documentos/termo-ricardo-tavares.pdf",
    bio: null, linkedin: null, areas: null, voluntariado: null, onboarded_em: null,
    nome_social: null, data_nascimento: "1990-01-18", genero: "masculino",
    cidade: "São Paulo", uf: "SP",
    interesses: ["carreira", "produto", "tecnologia"],
    motivacao: "Tive um mentor no começo da carreira que mudou minha trajetória — quero fazer o mesmo por alguém.",
    pref_genero_par: "indiferente",
    cargo: "Product manager", empresa: "Fintech",
    origem: "Post no LinkedIn", consent_lgpd_em: haDias(45),
    // cadastro trouxe os civis — o /assinar dele chega preenchido e a demo
    // mostra o prefill sem precisar digitar nada além do aceite
    dados_civis: {
      nome_civil: "Ricardo Tavares Lima", rg: "41.208.776-5",
      cpf: "28694751011", data_nascimento: "1990-01-18",
      endereco: { logradouro: "Rua Augusta", numero: "2210", complemento: "ap 71", bairro: "Consolação", cidade: "São Paulo", uf: "SP", cep: "01412100" },
    },
  };
  const sofia: Profile = {
    id: uid(P.sofia), user_id: uid(0xf004), nome: "Sofia Nogueira",
    email: "sofia.nogueira@realiza.vc", whatsapp: "5511987654004",
    role: "mentor_especialista", ativo: true, avatar_path: null,
    created_at: haDias(55),
    documento_path: "documentos/termo-sofia-nogueira.pdf",
    bio: null, linkedin: null, areas: null, voluntariado: null, onboarded_em: null,
    nome_social: null, data_nascimento: "1992-09-05", genero: "feminino",
    cidade: "São Paulo", uf: "SP",
    interesses: ["matemática", "ENEM", "educação"],
    motivacao: "Sou professora — sei destravar exatas pra quem trava na base.",
    pref_genero_par: "indiferente",
    cargo: "Professora de matemática", empresa: "Colégio particular",
    origem: "Voluntária desde o ciclo anterior", consent_lgpd_em: haDias(50),
  };

  const beatriz: Profile = {
    id: uid(P.beatriz), user_id: uid(0xf005), nome: "Beatriz Lins",
    email: "beatriz.lins@realiza.vc", whatsapp: "5511987654005",
    role: "supervisor", ativo: true, avatar_path: null,
    documento_path: "documentos/termo-beatriz-lins.pdf",
    bio: "Psicóloga organizacional, 12 anos em programas de desenvolvimento de jovens.",
    linkedin: "https://linkedin.com/in/beatriz-lins",
    areas: ["projetos sociais", "educação", "RH"],
    voluntariado: "Supervisora de duplas desde o primeiro ciclo do programa.",
    onboarded_em: haDias(90),
    nome_social: null, data_nascimento: "1984-04-09", genero: "feminino",
    cidade: "São Paulo", uf: "SP",
    interesses: ["desenvolvimento de jovens", "RH", "projetos sociais"],
    motivacao: "12 anos em programas de jovens — supervisão é onde mais contribuo.",
    pref_genero_par: "indiferente",
    cargo: "Psicóloga organizacional", empresa: "Consultoria própria",
    origem: "Rede da coordenação", consent_lgpd_em: haDias(90),
  };
  const carlos: Profile = {
    id: uid(P.carlos), user_id: uid(0xf006), nome: "Carlos Menezes",
    email: "carlos.menezes@realiza.vc", whatsapp: "5511987654006",
    role: "mentor_dpp", ativo: true, avatar_path: null,
    documento_path: "documentos/termo-carlos-menezes.pdf",
    bio: "Engenheiro de software há 15 anos, hoje líder técnico em fintech.",
    linkedin: "https://linkedin.com/in/carlosmenezes",
    areas: ["tecnologia", "carreira"],
    voluntariado: "Mentor voluntário desde 2024; antes, monitor em cursinho comunitário.",
    onboarded_em: haDias(60),
    nome_social: null, data_nascimento: "1985-11-02", genero: "masculino",
    cidade: "São Paulo", uf: "SP",
    interesses: ["tecnologia", "carreira", "dados"],
    motivacao: "Mentor desde 2024 — comecei como monitor em cursinho comunitário.",
    pref_genero_par: "indiferente",
    cargo: "Líder técnico", empresa: "Fintech",
    origem: "Indicação de outro mentor", consent_lgpd_em: haDias(60),
  };
  const fernanda: Profile = {
    id: uid(P.fernanda), user_id: uid(0xf007), nome: "Fernanda Alves",
    email: "fernanda.alves@realiza.vc", whatsapp: "5511987654007",
    role: "mentor_dpp", ativo: true, avatar_path: null,
    documento_path: "documentos/termo-fernanda-alves.pdf",
    bio: "Pedagoga, coordena projetos de reforço escolar na rede pública.",
    linkedin: "https://linkedin.com/in/fernanda-alves",
    areas: ["educação", "projetos sociais"],
    voluntariado: "Primeira vez como mentora; voluntariado anterior em alfabetização de adultos.",
    onboarded_em: haDias(60),
    nome_social: null, data_nascimento: "1991-07-27", genero: "feminino",
    cidade: "Guarulhos", uf: "SP",
    interesses: ["educação", "reforço escolar", "projetos sociais"],
    motivacao: "Trabalho com reforço escolar na rede pública — a mentoria é o próximo passo natural.",
    pref_genero_par: "feminino",
    cargo: "Pedagoga", empresa: "Prefeitura de Guarulhos",
    origem: "ONG parceira", consent_lgpd_em: haDias(60),
  };
  const joaoPedro: Profile = {
    id: uid(P.joaoPedro), user_id: uid(0xf008), nome: "João Pedro Vital",
    email: "joaopedro.vital@realiza.vc", whatsapp: "5511987654008",
    role: "mentor_dpp", ativo: true, avatar_path: null,
    documento_path: "documentos/termo-joao-pedro-vital.pdf",
    bio: "Analista de dados recém-formado, primeiro emprego em banco.",
    linkedin: "https://linkedin.com/in/joaopedrovital",
    areas: ["dados", "finanças"],
    voluntariado: null,
    onboarded_em: haDias(45),
    nome_social: null, data_nascimento: "1999-03-11", genero: "masculino",
    cidade: "São Paulo", uf: "SP",
    interesses: ["dados", "finanças", "primeiro emprego"],
    motivacao: "Fui mentorado na faculdade; agora quero retribuir.",
    pref_genero_par: "indiferente",
    cargo: "Analista de dados", empresa: "Banco",
    origem: "Post no LinkedIn", consent_lgpd_em: haDias(45),
  };
  const luiza: Profile = {
    id: uid(P.luiza), user_id: uid(0xf009), nome: "Luiza Campos",
    email: "luiza.campos@realiza.vc", whatsapp: "5511987654009",
    role: "mentor_dpp", ativo: true, avatar_path: null,
    documento_path: "documentos/termo-luiza-campos.pdf",
    bio: "Designer de produto, passou por agências e hoje é freelancer.",
    linkedin: "https://linkedin.com/in/luizacampos",
    areas: ["design", "comunicação"],
    voluntariado: "Mentora no ciclo anterior; voltou pra um segundo ciclo.",
    onboarded_em: haDias(200),
    nome_social: null, data_nascimento: "1993-12-08", genero: "feminino",
    cidade: "São Paulo", uf: "SP",
    interesses: ["design", "comunicação", "portfólio"],
    motivacao: "Segundo ciclo como mentora — a troca com o jovem me ensina tanto quanto ensino.",
    pref_genero_par: "feminino",
    cargo: "Designer de produto", empresa: "Freelancer",
    origem: "Voltou do ciclo anterior", consent_lgpd_em: haDias(200),
  };
  const andre: Profile = {
    id: uid(P.andre), user_id: uid(0xf00a), nome: "André Rocha",
    email: "andre.rocha@realiza.vc", whatsapp: "5511987654010",
    role: "mentor_dpp", ativo: true, avatar_path: null,
    documento_path: "documentos/termo-andre-rocha.pdf",
    bio: "Empreendedor, fundou duas pequenas empresas de serviço.",
    linkedin: "https://linkedin.com/in/andrerocha",
    areas: ["empreendedorismo", "finanças", "vendas"],
    voluntariado: "Quer assumir uma dupla — fez a formação e aguarda matching.",
    onboarded_em: haDias(30),
    nome_social: null, data_nascimento: "1987-05-16", genero: "masculino",
    cidade: "Osasco", uf: "SP",
    interesses: ["empreendedorismo", "vendas", "finanças"],
    motivacao: "Abri duas empresas do zero; quero ajudar um jovem a enxergar que também pode.",
    pref_genero_par: "indiferente",
    cargo: "Empreendedor", empresa: "Negócio próprio",
    origem: "Evento da ONG Horizonte", consent_lgpd_em: haDias(30),
  };
  const helena: Profile = {
    id: uid(P.helena), user_id: uid(0xf00b), nome: "Helena Prado",
    email: "helena.prado@realiza.vc", whatsapp: "5511987654011",
    role: "mentor_especialista", ativo: true, avatar_path: null,
    documento_path: "documentos/termo-helena-prado.pdf",
    bio: "Head de comunicação em varejo; especialista em apresentação e entrevistas.",
    linkedin: "https://linkedin.com/in/helenaprado",
    areas: ["comunicação", "carreira"],
    voluntariado: "Mentora especialista — trilhas curtas de demanda pontual.",
    onboarded_em: haDias(50),
    nome_social: null, data_nascimento: "1986-08-21", genero: "feminino",
    cidade: "São Paulo", uf: "SP",
    interesses: ["comunicação", "entrevistas", "apresentações"],
    motivacao: "Destravo gente pra entrevista e apresentação — é o que faço todo dia.",
    pref_genero_par: "feminino",
    cargo: "Head de comunicação", empresa: "Varejo",
    origem: "Indicação de uma mentora especialista", consent_lgpd_em: haDias(50),
  };
  const marcos: Profile = {
    id: uid(P.marcos), user_id: uid(0xf00c), nome: "Marcos Vinícius",
    email: "marcos.vinicius@realiza.vc", whatsapp: "5511987654012",
    role: "mentor_especialista", ativo: true, avatar_path: null,
    documento_path: "documentos/termo-marcos-vinicius.pdf",
    bio: "Engenheiro de dados, professor em curso técnico aos sábados.",
    linkedin: "https://linkedin.com/in/marcosvinicius",
    areas: ["tecnologia", "dados", "educação"],
    voluntariado: "Disponível pra aceitar demandas do mural de especialistas.",
    onboarded_em: haDias(25),
    nome_social: null, data_nascimento: "1989-02-14", genero: "masculino",
    cidade: "São Paulo", uf: "SP",
    interesses: ["tecnologia", "dados", "ensino técnico"],
    motivacao: "Dou aula técnica aos sábados — a trilha curta encaixa na minha rotina.",
    pref_genero_par: "indiferente",
    cargo: "Engenheiro de dados", empresa: "Consultoria",
    origem: "Post no LinkedIn", consent_lgpd_em: haDias(25),
  };
  // cadastro recebido, ainda não entrou: user_id null + ativo — a badge da
  // lista de pessoas deriva disso, não de flag própria
  const renata: Profile = {
    id: uid(P.renata), user_id: null, nome: "Renata Costa",
    email: "renata.costa@realiza.vc", whatsapp: "5511987654013",
    role: null, ativo: true, avatar_path: null,
    documento_path: "documentos/termo-renata-costa.pdf",
    bio: null, linkedin: null, areas: null, voluntariado: null, onboarded_em: null,
    // cadastro prévio pela coordenação — ficha de matching quase vazia e
    // sem consentimento: ela ainda não entrou na plataforma pra aceitar
    nome_social: null, data_nascimento: null, genero: null,
    cidade: "São Paulo", uf: "SP", interesses: [],
    motivacao: null, pref_genero_par: null,
    cargo: null, empresa: null,
    origem: "Formulário de inscrição", consent_lgpd_em: null,
  };
  const patricia: Profile = {
    id: uid(P.patricia), user_id: uid(0xf00e), nome: "Patrícia Gomes",
    email: "patricia.gomes@realiza.vc", whatsapp: "5511987654014",
    role: "mentor_dpp", ativo: false, avatar_path: null,
    documento_path: "documentos/termo-patricia-gomes.pdf",
    bio: "Gerente de RH, foi mentora em ciclos anteriores.",
    linkedin: "https://linkedin.com/in/patriciagomes",
    areas: ["RH", "carreira"],
    voluntariado: "Afastada do programa neste ciclo.",
    onboarded_em: haDias(300),
    nome_social: null, data_nascimento: "1982-10-30", genero: "feminino",
    cidade: "São Paulo", uf: "SP",
    interesses: ["RH", "carreira"],
    motivacao: "Foi mentora em ciclos anteriores.",
    pref_genero_par: "indiferente",
    cargo: "Gerente de RH", empresa: "Indústria",
    origem: "Ciclos anteriores", consent_lgpd_em: haDias(300),
  };

  const profiles: Profile[] = [
    marina, paulo, ricardo, sofia, beatriz, carlos, fernanda, joaoPedro,
    luiza, andre, helena, marcos, renata, patricia,
  ];

  const personas: Record<AppRole, Profile> = {
    coordenacao: marina,
    supervisor: paulo,
    mentor_dpp: ricardo,
    mentor_especialista: sofia,
  };

  const mentorProfiles: MentorProfile[] = [
    // Ricardo sem termo_ok: persona mentor_dpp entra na demo com o banner
    // "termo pendente" — é o que demonstra o fluxo de assinatura
    { profile_id: ricardo.id, tipo: "dpp", areas: ["carreira", "educação"], capacidade: 1, termo_ok: false, formacao_ok: true,
      experiencia_previa: "Primeiro ciclo como mentor — concluiu a formação e participou de duas rodas de conversa como ouvinte.",
      formacao_externa: "Trilha de liderança e feedback da empresa.",
      disponibilidade: { dias: ["ter", "qui"], periodos: ["noite"] } },
    { profile_id: carlos.id, tipo: "dpp", areas: ["tecnologia", "carreira"], capacidade: 1, termo_ok: true, formacao_ok: true,
      experiencia_previa: "Foi monitor em cursinho comunitário por dois anos.",
      formacao_externa: "Mentor de novos devs no programa interno da fintech.",
      disponibilidade: { dias: ["seg", "qua"], periodos: ["noite"] } },
    { profile_id: fernanda.id, tipo: "dpp", areas: ["educação", "projetos sociais"], capacidade: 1, termo_ok: true, formacao_ok: true,
      experiencia_previa: "Coordena projeto de reforço escolar com 40 alunos na rede pública.",
      formacao_externa: null,
      disponibilidade: { dias: ["ter", "qui"], periodos: ["tarde", "noite"] } },
    // João Pedro é o mentor novo que ainda não concluiu a formação — é o que
    // faz o board de matching mostrar o badge "sem formação"
    { profile_id: joaoPedro.id, tipo: "dpp", areas: ["dados", "finanças"], capacidade: 1, termo_ok: true, formacao_ok: false,
      experiencia_previa: null,
      formacao_externa: null,
      disponibilidade: { dias: ["sab"], periodos: ["manha"] } },
    { profile_id: luiza.id, tipo: "dpp", areas: ["design", "comunicação"], capacidade: 1, termo_ok: true, formacao_ok: true,
      experiencia_previa: "Mentora no ciclo anterior — a dupla concluiu o PDM inteiro.",
      formacao_externa: "Workshops de portfólio pra estudantes de design.",
      disponibilidade: { dias: ["qua", "sex"], periodos: ["tarde"] } },
    { profile_id: andre.id, tipo: "dpp", areas: ["empreendedorismo", "finanças"], capacidade: 2, termo_ok: true, formacao_ok: true,
      experiencia_previa: "Empreende há 8 anos; concluiu a formação e aguarda a primeira dupla.",
      formacao_externa: "Mentorias do Sebrae pra pequenos negócios.",
      disponibilidade: { dias: ["seg", "ter", "qua", "qui", "sex"], periodos: ["manha", "tarde"] } },
    { profile_id: sofia.id, tipo: "especialista", areas: ["educação", "dados"], capacidade: 1, termo_ok: true, formacao_ok: true,
      experiencia_previa: "Professora de matemática há 10 anos, com aulas particulares focadas em ENEM.",
      formacao_externa: "Especialização em avaliação educacional.",
      disponibilidade: { dias: ["sab", "dom"], periodos: ["manha", "tarde"] } },
    { profile_id: helena.id, tipo: "especialista", areas: ["comunicação", "carreira"], capacidade: 1, termo_ok: true, formacao_ok: true,
      experiencia_previa: "Treina equipes e executivos em apresentações e entrevistas.",
      formacao_externa: "Formação em coaching de oratória.",
      disponibilidade: { dias: ["ter", "qui"], periodos: ["manha", "noite"] } },
    { profile_id: marcos.id, tipo: "especialista", areas: ["tecnologia", "dados"], capacidade: 2, termo_ok: true, formacao_ok: true,
      experiencia_previa: "Professor de curso técnico aos sábados; engenheiro de dados durante a semana.",
      formacao_externa: null,
      disponibilidade: { dias: ["seg", "qua", "sab"], periodos: ["manha", "noite"] } },
    // Patrícia afastada: ficha existe mas sem disponibilidade — o board de
    // matching a mostra como indisponível
    { profile_id: patricia.id, tipo: "dpp", areas: ["RH", "carreira"], capacidade: 1, termo_ok: true, formacao_ok: true,
      experiencia_previa: "Mentora em dois ciclos anteriores.",
      formacao_externa: null,
      disponibilidade: null },
  ];

  // ---------- mentorados ----------

  const ana: Mentorado = {
    id: uid(M.ana), nome: "Ana Beatriz Silva",
    email: "anabeatriz.silva@gmail.com", whatsapp: "5511976123001",
    ong_origem: "ONG Horizonte",
    notas: "3º ano do ensino médio. Quer prestar ENEM pra pedagogia; mora com a mãe e dois irmãos. Veio pela oficina de projetos da ONG.",
    avatar_path: null, documento_path: "documentos/autorizacao-ana-beatriz.pdf",
    nome_social: "Bia", data_nascimento: "2008-04-12", genero: "feminino",
    cidade: "São Paulo", uf: "SP",
    interesses: ["pedagogia", "ENEM", "leitura"],
    motivacao: "Quero ser a primeira da família na faculdade e dar aula pra crianças.",
    pref_genero_par: "feminino",
    objetivos: "Passar no ENEM pra pedagogia e montar um plano de estudos que eu consiga seguir.",
    escolaridade: "medio", origem: "Oficina de projetos da ONG Horizonte",
    disponibilidade: { dias: ["ter", "qui"], periodos: ["noite"] },
    // sync-back da autorização assinada — a mãe dela ficou na ficha (0046)
    responsavel: {
      nome_civil: "Cleusa Maria Silva", rg: "22.334.556-7",
      cpf: "32165498791", data_nascimento: "1979-06-30", parentesco: "Mãe",
      endereco: { logradouro: "Rua das Flores", numero: "88", complemento: null, bairro: "Jardim Brasil", cidade: "São Paulo", uf: "SP", cep: "08410250" },
    },
  };
  const caio: Mentorado = {
    id: uid(M.caio), nome: "Caio Henrique Oliveira",
    email: "caiohenrique.oliveira@gmail.com", whatsapp: "5511976123002",
    ong_origem: "Projeto Semente",
    notas: "1º ano. Interesse em tecnologia e intercâmbio; tímido no primeiro contato, engajado depois que pega confiança.",
    avatar_path: null, documento_path: "documentos/autorizacao-caio.pdf",
    nome_social: null, data_nascimento: "2009-08-30", genero: "masculino",
    cidade: "São Paulo", uf: "SP",
    interesses: ["tecnologia", "inglês", "intercâmbio"],
    motivacao: "Sonho em fazer intercâmbio e trabalhar com tecnologia.",
    pref_genero_par: "indiferente",
    objetivos: "Conquistar a bolsa de intercâmbio da escola e destravar o inglês instrumental.",
    escolaridade: "medio", origem: "Projeto Semente",
    disponibilidade: { dias: ["sab"], periodos: ["manha"] },
  };
  const dandara: Mentorado = {
    id: uid(M.dandara), nome: "Dandara Souza",
    email: "dandara.souza@gmail.com", whatsapp: "5511976123003",
    ong_origem: "Casa do Saber",
    notas: "2º ano. Voltou a trabalhar fins de semana — agenda apertada. Sonha com vaga de jovem aprendiz.",
    avatar_path: null, documento_path: "documentos/autorizacao-dandara.pdf",
    nome_social: null, data_nascimento: "2008-12-03", genero: "feminino",
    cidade: "São Paulo", uf: "SP",
    interesses: ["jovem aprendiz", "comunicação", "redação"],
    motivacao: "Trabalho no fim de semana e quero uma vaga de jovem aprendiz pra ajudar em casa.",
    pref_genero_par: "feminino",
    objetivos: "Conseguir a vaga de jovem aprendiz e melhorar a redação pro ENEM.",
    escolaridade: "medio", origem: "Casa do Saber",
    disponibilidade: { dias: ["ter", "qua"], periodos: ["noite"] },
  };
  const eduardo: Mentorado = {
    id: uid(M.eduardo), nome: "Eduardo Lima",
    email: null, whatsapp: "5511976123004",
    ong_origem: "ONG Horizonte",
    notas: null, avatar_path: null, documento_path: null,
    // ficha mínima — cadastro antigo, a coordenação ainda não enriqueceu
    nome_social: null, data_nascimento: "2009-01-20", genero: "masculino",
    cidade: "São Paulo", uf: "SP", interesses: [],
    motivacao: null, pref_genero_par: null, objetivos: null,
    escolaridade: "medio", origem: null,
    disponibilidade: null,
  };
  const isabela: Mentorado = {
    id: uid(M.isabela), nome: "Isabela Ferreira",
    email: "isabela.ferreira@gmail.com", whatsapp: "5511976123005",
    ong_origem: "Instituto Alavanca",
    notas: "Ciclo 2025/2026 concluído — fechou o PDM inteiro e entrou no curso técnico que planejava.",
    avatar_path: null, documento_path: "documentos/autorizacao-isabela.pdf",
    nome_social: null, data_nascimento: "2007-02-14", genero: "feminino",
    cidade: "São Paulo", uf: "SP",
    interesses: ["curso técnico", "administração"],
    motivacao: "Fechei o PDM inteiro — agora é terminar o técnico e estagiar.",
    pref_genero_par: "feminino",
    objetivos: "Concluir o técnico em administração e conseguir estágio na área.",
    escolaridade: "tecnico", origem: "Instituto Alavanca",
    disponibilidade: { dias: ["seg", "qua"], periodos: ["tarde"] },
  };
  const kaua: Mentorado = {
    id: uid(M.kaua), nome: "Kauã Rodrigues",
    email: "kaua.rodrigues@gmail.com", whatsapp: "5511976123006",
    ong_origem: "Projeto Semente",
    notas: "3º ano. Sem dupla ainda — interesse em empreendedorismo e primeiros empregos.",
    avatar_path: null, documento_path: "documentos/autorizacao-kaua.pdf",
    nome_social: null, data_nascimento: "2008-07-19", genero: "masculino",
    cidade: "São Paulo", uf: "SP",
    interesses: ["empreendedorismo", "primeiro emprego", "vendas"],
    motivacao: "Quero aprender a transformar a produção de doces da minha família num negócio.",
    pref_genero_par: "masculino",
    objetivos: "Conseguir o primeiro emprego e montar um plano realista pra microempresa da família.",
    escolaridade: "medio", origem: "Projeto Semente",
    disponibilidade: { dias: ["ter", "qui"], periodos: ["noite"] },
    // ficha do responsável veio da planilha da ONG — a autorização pendente
    // dele (token 0x3404) já abre o link preenchido, só falta a mãe assinar
    responsavel: {
      nome_civil: "Sandra Regina Rodrigues", rg: "35.882.014-2",
      cpf: "41866273043", data_nascimento: "1984-02-11", parentesco: "Mãe",
      endereco: { logradouro: "Rua do Bosque", numero: "147", complemento: null, bairro: "Vila Esperança", cidade: "São Paulo", uf: "SP", cep: "03345020" },
    },
    dados_civis: {
      nome_civil: "Kauã Rodrigues de Jesus", rg: "58.201.447-3",
      cpf: null, data_nascimento: "2008-07-19",
      endereco: { logradouro: "Rua do Bosque", numero: "147", complemento: null, bairro: "Vila Esperança", cidade: "São Paulo", uf: "SP", cep: "03345020" },
    },
  };
  const laura: Mentorado = {
    id: uid(M.laura), nome: "Laura Mendes",
    email: null, whatsapp: "5511976123007",
    ong_origem: "Casa do Saber",
    notas: "1º ano. Aguarda matching — família pediu reforço em rotina de estudos.",
    avatar_path: null, documento_path: null,
    nome_social: null, data_nascimento: "2009-11-25", genero: "feminino",
    cidade: "São Paulo", uf: "SP",
    interesses: ["rotina de estudos", "vestibular"],
    motivacao: "A família pediu acompanhamento — quero passar de ano direto.",
    pref_genero_par: "feminino",
    objetivos: "Organizar a rotina de estudos e subir as notas de exatas.",
    escolaridade: "medio", origem: "Casa do Saber",
    disponibilidade: { dias: ["ter", "qui"], periodos: ["tarde", "noite"] },
  };
  const pedro: Mentorado = {
    id: uid(M.pedro), nome: "Pedro Henrique Almeida",
    email: null, whatsapp: "5511976123008",
    ong_origem: "ONG Horizonte",
    notas: null, avatar_path: null, documento_path: null,
    // ficha mínima, como a do Eduardo
    nome_social: null, data_nascimento: "2008-05-08", genero: "masculino",
    cidade: "São Paulo", uf: "SP", interesses: [],
    motivacao: null, pref_genero_par: null, objetivos: null,
    escolaridade: "medio", origem: null, disponibilidade: null,
  };

  const mentorados = [ana, caio, dandara, eduardo, isabela, kaua, laura, pedro];

  // ---------- solicitações de especialista ----------
  // (montadas antes das duplas: as duplas de especialista referenciam a
  // solicitação que as originou)

  const solicitacoes: SolicitacaoEspecialista[] = [
    {
      id: uid(S.cancelada),
      mentorado_id: eduardo.id,
      dupla_dpp_id: uid(D.atraso),
      demanda:
        "O Eduardo pediu apoio com oratória pra uma apresentação na ONG, mas a agenda dele fechou com a escola — cancelamos por ora e retomamos depois.",
      especialista_desejado_id: null,
      especialista_id: null,
      dupla_id: null,
      status: "cancelada",
      created_by: joaoPedro.id,
      created_at: haDias(31, "15:00"),
      respondida_em: haDias(30, "09:00"),
      mentorado: { nome: eduardo.nome },
      solicitante: { nome: joaoPedro.nome },
      especialista: null,
    },
    {
      id: uid(S.aceita2),
      mentorado_id: dandara.id,
      dupla_dpp_id: uid(D.risco),
      demanda:
        "A Dandara quer concorrer a uma vaga de jovem aprendiz e precisa de ajuda com currículo e entrevista — foge da minha área, um especialista de comunicação/RH faria toda a diferença.",
      especialista_desejado_id: null,
      especialista_id: helena.id,
      dupla_id: uid(D.esp2),
      status: "aceita",
      created_by: fernanda.id,
      created_at: haDias(24, "11:00"),
      respondida_em: haDias(20, "18:00"),
      mentorado: { nome: dandara.nome },
      solicitante: { nome: fernanda.nome },
      especialista: { nome: helena.nome },
    },
    {
      id: uid(S.aceita3),
      mentorado_id: eduardo.id,
      dupla_dpp_id: uid(D.atraso),
      demanda:
        "O Eduardo trava em matemática básica (frações e razão) e isso derruba o resto das notas do 1º ano — a Sofia é professora de exatas e topou pegar uma segunda trilha.",
      especialista_desejado_id: sofia.id,
      especialista_id: sofia.id,
      dupla_id: uid(D.esp3),
      status: "aceita",
      created_by: joaoPedro.id,
      created_at: haDias(12, "20:30"),
      respondida_em: haDias(9, "09:00"),
      mentorado: { nome: eduardo.nome },
      solicitante: { nome: joaoPedro.nome },
      especialista: { nome: sofia.nome },
    },
    {
      id: uid(S.aceita1),
      mentorado_id: ana.id,
      dupla_dpp_id: uid(D.ok),
      demanda:
        "A Bia quer prestar ENEM no fim do ano e trava em matemática — faltou base de frações e funções. Um especialista em exatas ajudaria a destravar a meta do PDM.",
      especialista_desejado_id: sofia.id,
      especialista_id: sofia.id,
      dupla_id: uid(D.esp1),
      status: "aceita",
      created_by: ricardo.id,
      created_at: haDias(17, "20:00"),
      respondida_em: haDias(14, "09:30"),
      mentorado: { nome: ana.nome },
      solicitante: { nome: ricardo.nome },
      especialista: { nome: sofia.nome },
    },
    {
      id: uid(S.direcionada),
      mentorado_id: caio.id,
      dupla_dpp_id: uid(D.pend),
      demanda:
        "O Caio vai concorrer a um programa de intercâmbio e precisa de inglês instrumental — entrevista e leitura de edital. Penso na Sofia, se ela tiver disponibilidade.",
      especialista_desejado_id: sofia.id,
      especialista_id: null,
      dupla_id: null,
      status: "aberta",
      created_by: carlos.id,
      created_at: haDias(4, "21:00"),
      respondida_em: null,
      mentorado: { nome: caio.nome },
      solicitante: { nome: carlos.nome },
      especialista: null,
    },
    {
      id: uid(S.livre),
      mentorado_id: dandara.id,
      dupla_dpp_id: uid(D.risco),
      demanda:
        "A Dandara voltou mais participativa depois do apoio, mas pediu ajuda com redação pro ENEM — foge totalmente da minha área. Aberta pra qualquer especialista.",
      especialista_desejado_id: null,
      especialista_id: null,
      dupla_id: null,
      status: "aberta",
      created_by: fernanda.id,
      created_at: haDias(2, "19:30"),
      respondida_em: null,
      mentorado: { nome: dandara.nome },
      solicitante: { nome: fernanda.nome },
      especialista: null,
    },
  ];

  // ---------- duplas ----------

  const inicioCiclo = ymd(addDias(diaEncontro(1), -7));

  // d-ok · Ricardo × Ana Beatriz — a dupla saudável: 4 encontros no calendário
  // oficial com registro bom, 5º agendado pra terça corrente
  const encD1: Encontro[] = [
    comRegistro(
      realizado(uid(D.ok), 1, diaEncontro(1), { duracao: 75, origem: "externo" }),
      ricardo, "Ana", "dpp"
    ),
    comRegistro(
      realizado(uid(D.ok), 2, diaEncontro(2), { duracao: 90 }),
      ricardo, "Ana", "dpp"
    ),
    comRegistro(
      realizado(uid(D.ok), 3, diaEncontro(3), { duracao: 60, origem: "externo" }),
      ricardo, "Ana", "dpp"
    ),
    comRegistro(
      realizado(uid(D.ok), 4, diaEncontro(4), { duracao: 75 }),
      ricardo, "Ana", "dpp"
    ),
    agendado(uid(D.ok), 5, diaEncontro(5), { link: MEET }),
  ];

  const regD1E1 = encD1[0].registro!;
  const regD1E3 = encD1[2].registro!;
  const regD1E4 = encD1[3].registro!;

  const duplaOk: Dupla = {
    id: uid(D.ok),
    ciclo: "2026/2027",
    status: "ativa",
    iniciada_em: inicioCiclo,
    trilha: "dpp",
    pdm_url: "https://docs.google.com/document/d/1aBcDeFgHiJkLmNoPqRsTuVwXyZ/edit",
    demanda: null,
    solicitacao_id: null,
    mentor: ricardo,
    mentorado: ana,
    supervisor: paulo,
    encontros: encD1,
    encaminhamentos: [
      encaminhamento(uid(D.ok), regD1E1.id,
        "Listar 3 pessoas pra avaliação por terceiros e enviar o questionário",
        "mentorado", diaEncontro(2), "feito"),
      encaminhamento(uid(D.ok), regD1E3.id,
        "Enviar rascunho da Declaração de Visão pro mentor revisar",
        "mentorado", diaEncontro(4), "feito"),
      encaminhamento(uid(D.ok), regD1E4.id,
        "Revisar as duas primeiras submetas e marcar o que já dá pra riscar do plano",
        "mentorado", addDias(HOJE, 10), "pendente"),
    ],
    notas: [
      {
        id: uid(0x1400 + ++seqNota),
        dupla_id: uid(D.ok),
        numero: 5,
        texto:
          "Lembrar de revisar as submetas antes de propor novas metas — a Bia tende a querer abraçar tudo de uma vez. Levar o print da Roda da Vida dela.",
        created_by: ricardo.id,
        created_at: haDias(1, "08:30"),
        updated_at: haDias(1, "08:30"),
      },
    ],
  };

  // d-pend · Carlos × Caio — encontro 4 realizado sem registro (a pendência
  // que o semáforo cobra) + um registro tardio no histórico
  const encD2: Encontro[] = [
    comRegistro(
      realizado(uid(D.pend), 1, diaEncontro(1), { duracao: 60 }),
      carlos, "Caio", "dpp"
    ),
    comRegistro(
      realizado(uid(D.pend), 2, diaEncontro(2), { duracao: 75, origem: "externo" }),
      carlos, "Caio", "dpp",
      {
        avaliacao: "regular",
        dificuldade: "organizacao",
        dificuldade_detalhe:
          "Caio perdeu o prazo da tarefa duas semanas seguidas — estamos testando agenda no papel junto com o celular.",
        proximo_passo: "reforcar",
      }
    ),
    comRegistro(
      realizado(uid(D.pend), 3, diaEncontro(3), { duracao: 60 }),
      carlos, "Caio", "dpp",
      // registro entregue 5 dias depois — fura o corte de 3d do "tardio"
      { created_at: depoisDe(em(diaEncontro(3), "19:00"), 24 * 5 + 3) }
    ),
    realizado(uid(D.pend), 4, diaEncontro(4), { duracao: 60, origem: "externo" }),
    agendado(uid(D.pend), 5, diaEncontro(5), {}),
  ];

  const regD2E1 = encD2[0].registro!;
  const regD2E3 = encD2[2].registro!;

  const duplaPend: Dupla = {
    id: uid(D.pend),
    ciclo: "2026/2027",
    status: "ativa",
    iniciada_em: inicioCiclo,
    trilha: "dpp",
    demanda: null,
    solicitacao_id: null,
    mentor: carlos,
    mentorado: caio,
    supervisor: paulo,
    encontros: encD2,
    encaminhamentos: [
      encaminhamento(uid(D.pend), regD2E1.id,
        "Separar o histórico escolar pra comparar com as metas do PDM",
        "mentorado", diaEncontro(3), "feito"),
      encaminhamento(uid(D.pend), regD2E3.id,
        "Montar cronograma de estudos pros sábados",
        "mentorado", addDias(HOJE, 7), "pendente"),
    ],
    notas: [],
  };

  // d-risco · Fernanda × Dandara — pedido de apoio no 2º encontro + 2 encontros
  // esperados que não aconteceram + combinado com prazo vencido
  const encD3: Encontro[] = [
    comRegistro(
      realizado(uid(D.risco), 1, diaEncontro(1), { duracao: 75 }),
      fernanda, "Dandara", "dpp"
    ),
    comRegistro(
      realizado(uid(D.risco), 2, diaEncontro(2), { duracao: 60, origem: "externo" }),
      fernanda, "Dandara", "dpp",
      {
        avaliacao: "baixa",
        precisa_apoio: true,
        dificuldade: "participacao",
        dificuldade_detalhe:
          "Dandara faltou aos dois últimos combinados e responde pouco no WhatsApp — a mãe contou que ela voltou a trabalhar aos fins de semana.",
        proximo_passo: "acompanhar_de_perto",
        observacoes:
          "Preciso de ajuda da coordenação pra pensar como repactuar o horário sem perder o vínculo.",
      }
    ),
    // encontros 3 e 4: esperados pelo calendário, sem row — é o que conta o atraso
    agendado(uid(D.risco), 5, diaEncontro(5), {}),
  ];

  const regD3E2 = encD3[1].registro!;

  const duplaRisco: Dupla = {
    id: uid(D.risco),
    ciclo: "2026/2027",
    status: "ativa",
    iniciada_em: inicioCiclo,
    trilha: "dpp",
    demanda: null,
    solicitacao_id: null,
    mentor: fernanda,
    mentorado: dandara,
    supervisor: beatriz,
    encontros: encD3,
    encaminhamentos: [
      encaminhamento(uid(D.risco), regD3E2.id,
        "Confirmar com a escola o retorno às aulas presenciais",
        "mentorado", addDias(HOJE, -6), "pendente"),
      encaminhamento(uid(D.risco), null,
        "Falar com a família sobre os turnos de fim de semana",
        "mentor", addDias(HOJE, -10), "feito"),
    ],
    notas: [],
  };

  // d-atraso · João Pedro × Eduardo — encontro remarcado (realizado em dia
  // diferente do agendado), um "não aconteceu" e um agendado já vencido
  const encD4: Encontro[] = [
    comRegistro(
      realizado(uid(D.atraso), 1, diaEncontro(1), { duracao: 60 }),
      joaoPedro, "Eduardo", "dpp"
    ),
    comRegistro(
      // foi remarcado uma vez e ainda assim rolou noutro dia — data_hora
      // oficial de terça, realizado_em na sexta; a UI conta "remarcado:
      // Conflito de agenda · realizado em …"
      realizado(uid(D.atraso), 2, diaEncontro(2), {
        duracao: 75,
        origem: "externo",
        motivo: "Conflito de agenda",
        realizadoDia: addDias(diaEncontro(2), 3),
      }),
      joaoPedro, "Eduardo", "dpp",
      {
        avaliacao: "regular",
        dificuldade: "organizacao",
        dificuldade_detalhe:
          "Eduardo esqueceu da remarcação — reforçamos o combinado de confirmar no dia anterior.",
        proximo_passo: "novo_feedback",
      }
    ),
    comRegistro(
      realizado(uid(D.atraso), 3, diaEncontro(3), { duracao: 60 }),
      joaoPedro, "Eduardo", "dpp"
    ),
    naoAconteceu(uid(D.atraso), 4, diaEncontro(4), {}),
    // agendado que já passou sem registro — pendência ("limbo"), não atraso
    agendado(uid(D.atraso), 5, addDias(diaEncontro(5), -7), {}),
  ];

  const duplaAtraso: Dupla = {
    id: uid(D.atraso),
    ciclo: "2026/2027",
    status: "ativa",
    iniciada_em: inicioCiclo,
    trilha: "dpp",
    demanda: null,
    solicitacao_id: null,
    mentor: joaoPedro,
    mentorado: eduardo,
    supervisor: beatriz,
    encontros: encD4,
    encaminhamentos: [
      encaminhamento(uid(D.atraso), null,
        "Reenviar o link da videochamada no grupo da família",
        "mentor", addDias(HOJE, -12), "feito"),
    ],
    notas: [],
  };

  // d-fim · Luiza × Isabela — ciclo anterior completo: 16 encontros semanais
  // com registro, avaliação subindo ao longo da jornada. Serve pra trajetória
  // completa na ficha e pro export CSV.
  const FIM_CICLO_ANTERIOR = addDias(HOJE, -240); // encontro 16 ~8 meses atrás
  const AVAL_FIM: AvaliacaoJovem[] = [
    "regular", "regular", "boa", "boa", "boa", "boa", "regular", "boa",
    "boa", "excelente", "boa", "boa", "excelente", "excelente", "excelente", "excelente",
  ];
  const encD5: Encontro[] = Array.from({ length: 16 }, (_, i) => {
    const n = i + 1;
    const dia = addDias(FIM_CICLO_ANTERIOR, (n - 16) * 7);
    const enc = realizado(uid(D.fim), n, dia, {
      duracao: n % 3 === 0 ? 60 : 75,
      origem: n % 4 === 0 ? "externo" : "plataforma",
    });
    const over: RegOverride = { avaliacao: AVAL_FIM[i] };
    // uma dificuldade de rotina no meio da jornada — o gráfico de trajetória
    // conta a retomada depois dela
    if (n === 7) {
      over.dificuldade = "organizacao";
      over.dificuldade_detalhe =
        "Rotina apertada com o fim do semestre — quase não sobrou tempo pras submetas.";
      over.proximo_passo = "reforcar";
    }
    return comRegistro(enc, luiza, "Isabela", "dpp", over);
  });

  const duplaFim: Dupla = {
    id: uid(D.fim),
    ciclo: "2025/2026",
    status: "concluida",
    iniciada_em: ymd(addDias(FIM_CICLO_ANTERIOR, -15 * 7 - 7)),
    trilha: "dpp",
    demanda: null,
    solicitacao_id: null,
    mentor: luiza,
    mentorado: isabela,
    supervisor: paulo,
    encontros: encD5,
    encaminhamentos: [
      encaminhamento(uid(D.fim), encD5[0].registro!.id,
        "Preencher a Roda da Vida e mandar foto antes do 2º encontro",
        "mentorado", addDias(FIM_CICLO_ANTERIOR, -14 * 7), "feito"),
      encaminhamento(uid(D.fim), encD5[10].registro!.id,
        "Inscrever-se no processo seletivo do curso técnico",
        "mentorado", addDias(FIM_CICLO_ANTERIOR, -4 * 7), "feito"),
      encaminhamento(uid(D.fim), encD5[15].registro!.id,
        "Manter o plano de estudos vivo depois do programa",
        "mentorado", addDias(FIM_CICLO_ANTERIOR, 30), "feito"),
    ],
    notas: [],
  };

  // d-esp1 · Sofia × Ana Beatriz — trilha de especialista (5 encontros, sem
  // calendário oficial), nascida da solicitação aceita do Ricardo
  const encD6: Encontro[] = [
    comRegistro(
      realizado(uid(D.esp1), 1, addDias(HOJE, -12), { hora: "18:30", duracao: 60 }),
      sofia, "Bia", "especialista",
      {
        observacoes:
          "Foco da trilha: base de frações e funções pra chegar inteira no ENEM.",
      }
    ),
    comRegistro(
      realizado(uid(D.esp1), 2, addDias(HOJE, -5), { hora: "18:30", duracao: 60 }),
      sofia, "Bia", "especialista",
      {
        reflexoes:
          "Diagnóstico fechado: Bia trava em fração e função, não em matemática como um todo. Listas curtas de exercício funcionaram melhor que explicação longa.",
        observacoes:
          "Combinado: lista de 10 exercícios de fração progressiva até o próximo encontro.",
      }
    ),
    agendado(uid(D.esp1), 3, addDias(HOJE, 4), { hora: "18:30" }),
  ];

  const duplaEsp1: Dupla = {
    id: uid(D.esp1),
    ciclo: "2026/2027",
    status: "ativa",
    trilha: "especialista",
    iniciada_em: ymd(addDias(HOJE, -14)),
    demanda: "Dificuldade em matemática — preparação pro ENEM (frações e funções).",
    solicitacao_id: uid(S.aceita1),
    mentor: sofia,
    mentorado: ana,
    supervisor: paulo,
    encontros: encD6,
    encaminhamentos: [
      encaminhamento(uid(D.esp1), encD6[1].registro!.id,
        "Resolver os 10 exercícios de fração da lista",
        "mentorado", addDias(HOJE, 4), "pendente"),
    ],
    notas: [
      {
        id: uid(0x1400 + ++seqNota),
        dupla_id: uid(D.esp1),
        numero: 3,
        texto:
          "Separar exercícios de função do 1º grau — começar pelo gráfico, que ela visualiza melhor.",
        created_by: sofia.id,
        created_at: haDias(2, "19:00"),
        updated_at: haDias(2, "19:00"),
      },
    ],
  };

  // d-esp2 · Helena × Dandara — trilha de especialista recém-nascida da
  // solicitação aceita da dupla 3
  const encD7: Encontro[] = [
    comRegistro(
      realizado(uid(D.esp2), 1, addDias(HOJE, -18), { hora: "20:00", duracao: 60 }),
      helena, "Dandara", "especialista",
      {
        reflexoes:
          "Acolhimento bom — a Dandara chegou desconfiada e saiu animada com o plano de jovem aprendiz. Mapeamos: currículo pronto, mas nunca fez entrevista.",
        observacoes: "Combinado: ela me manda o currículo atual pra eu marcar ajustes.",
      }
    ),
    agendado(uid(D.esp2), 2, addDias(HOJE, 3), { hora: "20:00" }),
  ];

  const duplaEsp2: Dupla = {
    id: uid(D.esp2),
    ciclo: "2026/2027",
    status: "ativa",
    iniciada_em: ymd(addDias(HOJE, -20)),
    trilha: "especialista",
    demanda: "Preparação pra processos de jovem aprendiz — currículo e entrevistas.",
    solicitacao_id: uid(S.aceita2),
    mentor: helena,
    mentorado: dandara,
    supervisor: beatriz,
    encontros: encD7,
    encaminhamentos: [],
    notas: [],
  };

  // d-esp3 · Sofia × Eduardo — a segunda trilha da mesma especialista (o
  // mentor_especialista carrega N duplas). Estado distinto da esp1 de
  // propósito: o 1º encontro rolou e segue sem registro — pendência que o
  // semáforo marca "atenção" e joga esta dupla no topo da home dela
  const encD8: Encontro[] = [
    realizado(uid(D.esp3), 1, addDias(HOJE, -6), { hora: "19:30", duracao: 60 }),
    agendado(uid(D.esp3), 2, addDias(HOJE, 3), { hora: "19:30" }),
  ];

  const duplaEsp3: Dupla = {
    id: uid(D.esp3),
    ciclo: "2026/2027",
    status: "ativa",
    trilha: "especialista",
    iniciada_em: ymd(addDias(HOJE, -9)),
    demanda: "Reforço de matemática básica — frações e razão pra destravar o 1º ano.",
    solicitacao_id: uid(S.aceita3),
    mentor: sofia,
    mentorado: eduardo,
    supervisor: beatriz, // mesma supervisora da dupla DPP do Eduardo
    encontros: encD8,
    encaminhamentos: [
      encaminhamento(uid(D.esp3), null,
        "Trazer o caderno de exercícios da escola pro diagnóstico",
        "mentorado", addDias(HOJE, 3), "pendente"),
    ],
    notas: [
      {
        id: uid(0x1400 + ++seqNota),
        dupla_id: uid(D.esp3),
        numero: 2,
        texto:
          "Preparar uma progressão de frações com exemplos visuais — o Eduardo responde melhor a desenho do que a conta abstrata.",
        created_by: sofia.id,
        created_at: haDias(4, "20:00"),
        updated_at: haDias(4, "20:00"),
      },
    ],
  };

  const duplas = [duplaOk, duplaPend, duplaRisco, duplaAtraso, duplaFim, duplaEsp1, duplaEsp2, duplaEsp3];

  // ---------- anexos de evidência ----------

  const anexos: RegistroAnexo[] = [
    {
      id: uid(0x1601),
      registro_id: regD1E1.id,
      path: `${regD1E1.id}/${uid(0x1601)}-roda-da-vida-preenchida.jpg`,
      nome: "roda-da-vida-preenchida.jpg",
      tamanho: 1_438_720,
      mime: "image/jpeg",
      created_by: ricardo.id,
      created_at: depoisDe(regD1E1.created_at, 1),
      autor: { nome: ricardo.nome },
    },
    {
      id: uid(0x1602),
      registro_id: regD1E1.id,
      path: `${regD1E1.id}/${uid(0x1602)}-pdm-rascunho.pdf`,
      nome: "pdm-rascunho.pdf",
      tamanho: 284_160,
      mime: "application/pdf",
      created_by: ricardo.id,
      created_at: depoisDe(regD1E1.created_at, 1.5),
      autor: { nome: ricardo.nome },
    },
  ];

  // ---------- comunicados ----------

  const comunicados: Comunicado[] = [
    {
      id: uid(0x2201),
      titulo: "Reunião de supervisão na quinta",
      corpo:
        "Equipe: reunião de supervisão quinta às 19h, no Meet de sempre. Vamos passar pelos casos de atenção da semana — tragam o que estiverem vendo nas duplas.",
      audiencia: "equipe",
      prioridade: "importante",
      created_by: marina.id,
      created_at: haDias(1, "09:00"),
      autor: { nome: marina.nome },
    },
    {
      id: uid(0x2202),
      titulo: "Mural de demandas atualizado",
      corpo:
        "Especialistas: o mural tem duas demandas abertas esperando aceite — uma delas direcionada. Quem tiver disponibilidade, dê uma olhada na plataforma.",
      audiencia: "especialista",
      prioridade: "normal",
      created_by: marina.id,
      created_at: haDias(2, "14:00"),
      autor: { nome: marina.nome },
    },
    {
      id: uid(0x2203),
      titulo: "Registro do encontro fecha na sexta",
      corpo:
        "Mentores DPP: o registro do encontro da semana fecha na sexta. Sem ele, o encontro conta como atraso no semáforo da dupla. Se não aconteceu, marquem 'não aconteceu' em vez de deixar pendente.",
      audiencia: "dpp",
      prioridade: "urgente",
      created_by: marina.id,
      created_at: haDias(3, "10:00"),
      autor: { nome: marina.nome },
    },
    {
      id: uid(0x2204),
      titulo: "Relatório do ciclo pro board",
      corpo:
        "Vou consolidar o relatório mensal do programa pro board até sexta — revisem os dados das suas áreas na plataforma e me chamem se algo estiver estranho.",
      audiencia: "coordenacao",
      prioridade: "normal",
      created_by: marina.id,
      created_at: haDias(5, "16:00"),
      autor: { nome: marina.nome },
    },
    {
      id: uid(0x2205),
      titulo: "Gravação da formação disponível",
      corpo:
        "A gravação dos dois dias de formação de mentores já está na biblioteca de materiais. Quem faltou ou quer revisar um trecho, é só acessar pela plataforma.",
      audiencia: "todos",
      prioridade: "normal",
      created_by: marina.id,
      created_at: haDias(10, "11:00"),
      autor: { nome: marina.nome },
    },
  ];

  // ---------- pessoa_notas (privadas do autor — cada papel vê só as suas) ----------

  const pessoaNotas: PessoaNota[] = [
    {
      id: uid(0x2601),
      profile_id: fernanda.id,
      mentorado_id: null,
      texto:
        "Fernanda pediu apoio no 2º encontro — combinar com a Beatriz uma proposta de repactuação de horário antes de escalar.",
      created_by: marina.id,
      created_at: haDias(3, "10:00"),
      autor: { id: marina.id, nome: marina.nome },
    },
    {
      id: uid(0x2602),
      profile_id: null,
      mentorado_id: dandara.id,
      texto:
        "Ver com a Casa do Saber se rola apoio de transporte — o turno de fim de semana é o que está quebrando a rotina da dupla.",
      created_by: marina.id,
      created_at: haDias(2, "11:30"),
      autor: { id: marina.id, nome: marina.nome },
    },
    {
      id: uid(0x2603),
      profile_id: null,
      mentorado_id: caio.id,
      texto:
        "Caio mencionou interesse em intercâmbio no último check-in — conectar com a solicitação de inglês que o Carlos abriu.",
      created_by: paulo.id,
      created_at: haDias(4, "15:00"),
      autor: { id: paulo.id, nome: paulo.nome },
    },
    {
      id: uid(0x2604),
      profile_id: null,
      mentorado_id: ana.id,
      texto:
        "Bia floresceu na declaração de visão — resgatar esse texto quando bater a dúvida no meio do percurso.",
      created_by: ricardo.id,
      created_at: haDias(6, "20:00"),
      autor: { id: ricardo.id, nome: ricardo.nome },
    },
    {
      id: uid(0x2605),
      profile_id: null,
      mentorado_id: ana.id,
      texto:
        "Bia trava em frações e funções — preparar material de revisão progressiva antes do 3º encontro.",
      created_by: sofia.id,
      created_at: haDias(1, "18:00"),
      autor: { id: sofia.id, nome: sofia.nome },
    },
  ];

  // ---------- interacoes (log de nudges/contatos da coordenação) ----------

  const interacoes: Interacao[] = [
    {
      dupla_id: uid(D.pend),
      tipo: "nudge",
      canal: "whatsapp",
      created_at: haDias(5, "10:00"),
      autor: { nome: marina.nome },
    },
    {
      dupla_id: uid(D.atraso),
      tipo: "nudge",
      canal: "whatsapp",
      created_at: haDias(4, "09:30"),
      autor: { nome: beatriz.nome },
    },
    {
      dupla_id: uid(D.risco),
      tipo: "contato",
      canal: "whatsapp",
      created_at: haDias(3, "16:00"),
      autor: { nome: paulo.nome },
    },
    {
      dupla_id: uid(D.risco),
      tipo: "apoio",
      canal: "whatsapp",
      created_at: haDias(2, "14:00"),
      autor: { nome: marina.nome },
    },
  ];

  // ---------- catálogos ----------

  const cicloEventos = buildCicloEventos();

  // os 5 encontros do guia do especialista — verbatim da migration 0027
  const especialistaEventos: EspecialistaEvento[] = [
    { numero: 1, titulo: "Acolhimento, vínculo e identificação da demanda", foco: "Escuta das demandas e desafios do jovem; identificação do tema da mentoria considerando o PDM" },
    { numero: 2, titulo: "Orientação, proteção e aconselhamento", foco: "Fortalecimento da confiança; retomada das metas do PDM; consolidação da direção do processo" },
    { numero: 3, titulo: "Definição e alinhamento das metas", foco: "Metas SMART; primeiras aplicações práticas; registro no PDM" },
    { numero: 4, titulo: "Acompanhamento do plano de metas", foco: "Avanços no plano de metas e submetas; ajuste de estratégias; antecipação de obstáculos" },
    { numero: 5, titulo: "Encerramento, reflexão e celebração", foco: "Reflexão sobre aprendizados; desafios futuros; feedback do jovem; registro final no PDM" },
  ];

  // os 13 materiais do seed.sql verbatim — só os dois guias têm arquivo
  // oficial (path): os demais são templates sem upload ou links, e renderizam
  // "em breve" — estado legítimo no app (materiais chegam ao longo do ciclo)
  const materiais: Material[] = [
    { id: uid(0x2001), titulo: "Guia do Mentor DPP", descricao: "Metodologia completa: jornada, 16 encontros, instrumentos e templates.", tipo: "guia", url: null, path: "materiais/guia-dpp.pdf", audiencia: "dpp", encontro_num: null, ordem: 1 },
    { id: uid(0x2002), titulo: "Guia do Mentor Especialista", descricao: "Metodologia da mentoria com especialista: 5 encontros e cinco funções.", tipo: "guia", url: null, path: "materiais/guia-especialista.pdf", audiencia: "especialista", encontro_num: null, ordem: 2 },
    { id: uid(0x2003), titulo: "Mensagem de preparação do mentorado", descricao: "Modelo para enviar antes do 1º encontro: história de vida, Roda da Vida e contatos para avaliação.", tipo: "template", url: null, path: null, audiencia: "dpp", encontro_num: 1, ordem: 10 },
    { id: uid(0x2004), titulo: "Instrumento: Construindo a sua Visão", descricao: "Tarefa individual entre o 1º e o 2º encontro; origina a Declaração de Visão.", tipo: "template", url: null, path: null, audiencia: "dpp", encontro_num: 1, ordem: 11 },
    { id: uid(0x2005), titulo: "Mensagem às pessoas indicadas", descricao: "Modelo de contato para a avaliação por terceiros (duas perguntas).", tipo: "template", url: null, path: null, audiencia: "dpp", encontro_num: 1, ordem: 12 },
    { id: uid(0x2006), titulo: "Consolidação da avaliação por terceiros", descricao: "Quadro para agrupar pontos fortes e de melhoria sem identificar quem respondeu.", tipo: "template", url: null, path: null, audiencia: "dpp", encontro_num: 2, ordem: 13 },
    { id: uid(0x2007), titulo: "Plano de Desenvolvimento do Mentorado (PDM)", descricao: "Documento central da dupla: visão, metas SMART, indicadores e mapa de submetas.", tipo: "template", url: null, path: null, audiencia: "dpp", encontro_num: 2, ordem: 14 },
    { id: uid(0x2008), titulo: "Mensagem de encaminhamento entre encontros", descricao: "Modelo curto para manter o vínculo e deixar a próxima tarefa clara.", tipo: "template", url: null, path: null, audiencia: "dpp", encontro_num: null, ordem: 15 },
    { id: uid(0x2009), titulo: "Roda da Vida: roteiro de aplicação", descricao: "Aplicação em três momentos a partir do 5º mês: explicação, discussão e validação.", tipo: "template", url: null, path: null, audiencia: "dpp", encontro_num: 12, ordem: 16 },
    { id: uid(0x2010), titulo: "Checklist de competências do mentor", descricao: "Autoavaliação antes do ciclo e novamente no 16º encontro.", tipo: "template", url: null, path: null, audiencia: "todos", encontro_num: null, ordem: 17 },
    { id: uid(0x2011), titulo: "Autoavaliação do mentor", descricao: "Cinco perguntas de reflexão para o encerramento do ciclo.", tipo: "template", url: null, path: null, audiencia: "todos", encontro_num: 16, ordem: 18 },
    { id: uid(0x2012), titulo: "Plataforma de mentoria", descricao: "Onde os encontros oficiais são agendados e avaliados.", tipo: "link", url: "https://mentoria.realiza.vc", path: null, audiencia: "todos", encontro_num: null, ordem: 20 },
    { id: uid(0x2013), titulo: "Formação EaD gratuita", descricao: "Trilha opcional com certificado para mentores.", tipo: "link", url: "https://ead.realiza.vc", path: null, audiencia: "todos", encontro_num: null, ordem: 21 },
  ];

  // ---------- notificações por papel ----------
  // 2-3 por persona; algumas não lidas pra badge do sino sair de zero

  const notificacoes: Record<AppRole, Notificacao[]> = {
    coordenacao: [
      {
        id: uid(0x3001),
        tipo: "comunicado",
        titulo: "Reunião de supervisão na quinta",
        corpo: "Equipe: reunião de supervisão quinta às 19h, no Meet de sempre.",
        href: "/#avisos",
        lida_em: null,
        created_at: haDias(1, "09:00"),
      },
      {
        id: uid(0x3002),
        tipo: "pedido_apoio",
        titulo: "Pedido de apoio · Fernanda & Dandara",
        corpo:
          "Fernanda marcou 'preciso de apoio' no registro do 2º encontro: participação da mentorada caiu e ela não consegue contato.",
        href: `/duplas/${uid(D.risco)}`,
        lida_em: haDias(19, "08:00"),
        created_at: haDias(21, "22:30"),
      },
      {
        id: uid(0x3003),
        tipo: "dupla_formada",
        titulo: "Dupla de especialista formada · Helena & Dandara",
        corpo: "Helena Prado aceitou a solicitação da dupla Fernanda & Dandara.",
        href: `/duplas/${uid(D.esp2)}`,
        lida_em: haDias(19, "08:00"),
        created_at: haDias(20, "18:05"),
      },
      // formulario_respondido (0042) — a RPC de submit avisa a coordenação;
      // aqui é a resposta da anamnese oficial da Ana (ver forms-data.ts)
      {
        id: uid(0x3004),
        tipo: "formulario_respondido",
        titulo: "Resposta de formulário",
        corpo: 'Ana Beatriz Silva respondeu "Anamnese Social"',
        // uid(0x4004) = Anamnese Social oficial (forms-data) — id decimal,
        // não o hex cru
        href: `/formularios/${uid(0x4004)}`,
        lida_em: haDias(31, "09:00"),
        created_at: haDias(33, "19:12"),
      },
    ],
    supervisor: [
      {
        id: uid(0x3010),
        tipo: "apoio_resolvido",
        titulo: "Pedido de apoio resolvido · Fernanda & Dandara",
        corpo: "A coordenação encaminhou o caso e marcou o pedido de apoio como resolvido.",
        href: `/duplas/${uid(D.risco)}`,
        lida_em: null,
        created_at: haDias(2, "15:00"),
      },
      {
        id: uid(0x3011),
        tipo: "comunicado",
        titulo: "Gravação da formação disponível",
        corpo: "A gravação dos dois dias de formação já está na biblioteca.",
        href: "/#avisos",
        lida_em: haDias(9, "12:00"),
        created_at: haDias(10, "11:00"),
      },
    ],
    mentor_dpp: [
      {
        id: uid(0x3020),
        tipo: "comunicado",
        titulo: "Lembrete: registro do encontro até sexta",
        corpo: "O registro semanal do encontro fica aberto na plataforma.",
        href: "/#avisos",
        lida_em: null,
        created_at: haDias(3, "10:00"),
      },
      {
        id: uid(0x3021),
        tipo: "dupla_formada",
        titulo: "Dupla de especialista formada · Sofia & Ana Beatriz",
        corpo: "Sofia Nogueira aceitou a sua solicitação de especialista.",
        href: `/duplas/${uid(D.esp1)}`,
        lida_em: haDias(13, "07:00"),
        created_at: haDias(14, "09:35"),
      },
      // supervisao_registrada (0041) — o mentor lê data e resumo da sessão
      // que o supervisor registrou sobre ele (transparência)
      {
        id: uid(0x3022),
        tipo: "supervisao_registrada",
        titulo: "Sessão de supervisão registrada",
        corpo: `Paulo Serra registrou a supervisão de ${ymd(addDias(HOJE, -13)).split("-").reverse().join("/")} sobre a dupla com Ana Beatriz Silva. O resumo está na ficha da dupla.`,
        href: `/duplas/${uid(D.ok)}`,
        lida_em: haDias(12, "08:00"),
        created_at: haDias(13, "18:40"),
      },
    ],
    mentor_especialista: [
      {
        id: uid(0x3030),
        tipo: "comunicado",
        titulo: "Mural de demandas atualizado",
        corpo: "O mural tem duas demandas abertas esperando aceite.",
        href: "/#avisos",
        lida_em: null,
        created_at: haDias(2, "14:00"),
      },
      {
        id: uid(0x3031),
        tipo: "dupla_formada",
        titulo: "Você agora é mentora de Ana Beatriz",
        corpo: "Sua trilha de especialista com a Ana Beatriz foi formada. O primeiro encontro já pode ser agendado.",
        href: `/duplas/${uid(D.esp1)}`,
        lida_em: haDias(13, "10:00"),
        created_at: haDias(14, "09:35"),
      },
      {
        id: uid(0x3032),
        tipo: "dupla_formada",
        titulo: "Você agora é mentora de Eduardo",
        corpo: "Sua segunda trilha de especialista foi formada — desta vez com o Eduardo Lima. O primeiro encontro já pode ser agendado.",
        href: `/duplas/${uid(D.esp3)}`,
        lida_em: null,
        created_at: haDias(9, "09:05"),
      },
    ],
  };

  // ---------- documentos & assinaturas (0033) ----------

  const documentoTemplates: DocumentoTemplate[] = [
    { id: uid(0x3301), slug: "termo-voluntario", titulo: "Termo de Adesão ao Trabalho Voluntário", versao: 1, signatario: "profile", ativo: true, created_at: haDias(400) },
    { id: uid(0x3302), slug: "autorizacao-responsavel", titulo: "Autorização do Responsável", versao: 1, signatario: "mentorado", ativo: true, created_at: haDias(400) },
    { id: uid(0x3303), slug: "termo-mentorando", titulo: "Termo de Adesão e Participação no Programa de Mentoria Social", versao: 1, signatario: "mentorado", ativo: true, created_at: haDias(5) },
  ];

  const tplTermo = { slug: "termo-voluntario", titulo: "Termo de Adesão ao Trabalho Voluntário", versao: 1, signatario: "profile" as const };
  const tplAutorizacao = { slug: "autorizacao-responsavel", titulo: "Autorização do Responsável", versao: 1, signatario: "mentorado" as const };
  const tplTermoMentorando = { slug: "termo-mentorando", titulo: "Termo de Adesão e Participação no Programa de Mentoria Social", versao: 1, signatario: "mentorado" as const };

  const dadosMarina = {
    nome_civil: "Marina Duarte Ferreira",
    rg: "34.567.890-1", cpf: "12345678909", data_nascimento: "1988-03-15",
    endereco: { logradouro: "Rua Vergueiro", numero: "1200", complemento: null, bairro: "Liberdade", cidade: "São Paulo", uf: "SP", cep: "01504001" },
  };
  const dadosCarlos = {
    nome_civil: "Carlos Eduardo Menezes",
    rg: "28.765.432-0", cpf: "98765432100", data_nascimento: "1985-11-02",
    endereco: { logradouro: "Av. Paulista", numero: "900", complemento: "cj 42", bairro: "Bela Vista", cidade: "São Paulo", uf: "SP", cep: "01310100" },
  };

  const assinaturas: Assinatura[] = [
    // Marina e Carlos já assinaram o termo — evidências preenchidas
    { id: uid(0x3201), template_id: uid(0x3301), profile_id: marina.id, mentorado_id: null,
      status: "assinado", dados_snapshot: dadosMarina, token: uid(0x3401), token_expira_em: null,
      assinatura_texto: "Marina Duarte Ferreira", assinado_em: haDias(35, "09:12"),
      ip: "187.44.12.90", user_agent: "Mozilla/5.0 (Macintosh) Chrome/126",
      hash_documento: "9f2c1a…demo", created_by: null, created_at: haDias(35, "09:12"),
      template: tplTermo },
    { id: uid(0x3202), template_id: uid(0x3301), profile_id: carlos.id, mentorado_id: null,
      status: "assinado", dados_snapshot: dadosCarlos, token: uid(0x3402), token_expira_em: null,
      assinatura_texto: "Carlos Eduardo Menezes", assinado_em: haDias(60, "20:40"),
      ip: "177.92.4.11", user_agent: "Mozilla/5.0 (iPhone) Safari/17",
      hash_documento: "77aa10…demo", created_by: null, created_at: haDias(60, "20:40"),
      template: tplTermo },
    // Ana: autorização do responsável já assinada via link tokenizado
    { id: uid(0x3203), template_id: uid(0x3302), profile_id: null, mentorado_id: ana.id,
      status: "assinado",
      dados_snapshot: {
        mentorado_nome: ana.nome,
        responsavel: { nome_civil: "Cleusa Maria Silva", rg: "22.334.556-7", cpf: "32165498791", data_nascimento: "1979-06-30", parentesco: "Mãe", endereco: { logradouro: "Rua das Flores", numero: "88", complemento: null, bairro: "Jardim Brasil", cidade: "São Paulo", uf: "SP", cep: "08410250" } },
      },
      token: uid(0x3403), token_expira_em: haDias(-35 + 30), // expirou depois de assinada — não importa
      assinatura_texto: "Cleusa Maria Silva", assinado_em: haDias(35, "19:02"),
      ip: "191.33.208.44", user_agent: "Mozilla/5.0 (Android) Chrome/125",
      hash_documento: "be4410…demo", created_by: marina.id, created_at: haDias(37, "10:00"),
      template: tplAutorizacao },
    // Kauã: autorização pendente — o link /assinar/<uid(0x3404)> abre a tela pública
    { id: uid(0x3204), template_id: uid(0x3302), profile_id: null, mentorado_id: kaua.id,
      status: "pendente", dados_snapshot: null, token: uid(0x3404),
      token_expira_em: haDias(-30), // 30 dias no futuro
      assinatura_texto: null, assinado_em: null, ip: null, user_agent: null,
      hash_documento: null, created_by: marina.id, created_at: haDias(2),
      template: tplAutorizacao },
    // Patrícia (inativa): termo revogado quando saiu do programa
    { id: uid(0x3205), template_id: uid(0x3301), profile_id: patricia.id, mentorado_id: null,
      status: "revogado", dados_snapshot: null, token: uid(0x3405), token_expira_em: null,
      assinatura_texto: null, assinado_em: null, ip: null, user_agent: null,
      hash_documento: null, created_by: marina.id, created_at: haDias(200),
      template: tplTermo },
    // Ricardo (persona mentor_dpp): a coord emitiu o link do termo por
    // e-mail — pendente. O token 0x3406 abre /assinar/<token> com o termo
    // de voluntário já preenchido (a ficha dele tem dados_civis do
    // cadastro — badge "falta:" segue aparecendo pra quem não tem)
    { id: uid(0x3206), template_id: uid(0x3301), profile_id: ricardo.id, mentorado_id: null,
      status: "pendente", dados_snapshot: null, token: uid(0x3406),
      token_expira_em: haDias(-28),
      assinatura_texto: null, assinado_em: null, ip: null, user_agent: null,
      hash_documento: null, created_by: marina.id, created_at: haDias(2, "11:30"),
      template: tplTermo },
    // Isabela: é maior de idade — o doc dela é o termo de participação,
    // emitido em lote junto com a autorização do Kauã (0x3404). Sem
    // dados_civis na ficha → pendência com "falta:" no checklist
    { id: uid(0x3207), template_id: uid(0x3303), profile_id: null, mentorado_id: isabela.id,
      status: "pendente", dados_snapshot: null, token: uid(0x3407),
      token_expira_em: haDias(-28),
      assinatura_texto: null, assinado_em: null, ip: null, user_agent: null,
      hash_documento: null, created_by: marina.id, created_at: haDias(2, "11:31"),
      template: tplTermoMentorando },
  ];

  // ---------- presenças na formação (0040) ----------

  // Os dois encontros 'formacao' do calendário já passaram (semana pré-ciclo).
  // História: chamada completa no 1º dia; no 2º o João Pedro faltou —
  // presente=false é a ausência explícita que explica o formacao_ok=false
  // dele no mentor_profiles (a sync do 0040 só acende a flag com cobertura
  // total). Os demais mentores ativos (dpp + especialista) foram nos dois.
  const formacaoEvts = cicloEventos.filter((e) => e.tipo === "formacao");
  const mentoresAtivos = profiles.filter(
    (p) =>
      p.ativo && (p.role === "mentor_dpp" || p.role === "mentor_especialista")
  );
  let seqPres = 0;
  const presencas: Presenca[] = formacaoEvts.flatMap((ev, diaIdx) =>
    mentoresAtivos.map((p) => ({
      id: uid(0x3600 + ++seqPres),
      ciclo_evento_id: ev.id,
      profile_id: p.id,
      presente: !(diaIdx === 1 && p.id === joaoPedro.id),
      marcado_por: marina.id, // a chamada é da coordenação
      // carimbo da noite do evento — como o trigger stamp_presenca faria
      marcado_em: em(new Date(`${ev.data}T12:00:00`), "20:30"),
    }))
  );

  // ---------- sessões de supervisão (0041) ----------

  // Ritual supervisor ↔ mentor do guia. As linhas já carregam os embeds do
  // select da query real (supervisor/mentor/dupla>mentorado) — o stub e as
  // queries demo consomem direto, sem resolver FK.
  const supervisoes: Supervisao[] = [
    {
      id: uid(0x3801),
      supervisor_id: paulo.id,
      mentor_id: ricardo.id,
      dupla_id: duplaOk.id,
      data: ymd(addDias(HOJE, -13)),
      resumo:
        "Primeira supervisão do ciclo com o Ricardo. A dupla engatou rápido: a Bia já fechou o PDM e entrou na execução das submetas. Ponto trabalhado: ela tende a abraçar metas demais — combinamos segurar uma submeta por vez e revisar o ritmo no registro semanal. Ele sai com o combinado de trazer as dúvidas de condução na próxima sessão.",
      created_by: paulo.id,
      created_at: haDias(13, "18:40"),
      supervisor: { id: paulo.id, nome: paulo.nome },
      mentor: { id: ricardo.id, nome: ricardo.nome },
      dupla: { id: duplaOk.id, mentorado: { nome: ana.nome } },
    },
    {
      id: uid(0x3802),
      supervisor_id: paulo.id,
      mentor_id: sofia.id,
      dupla_id: null, // sessão geral — não atada a uma dupla
      data: ymd(addDias(HOJE, -5)),
      resumo:
        "Conversa geral sobre a trilha de especialista com a Bia: o diagnóstico de frações e funções saiu no 2º encontro e a Sofia já roda listas progressivas. Reforçamos o cuidado de registrar no PDM o que continua depois dos 5 encontros, pra mentoria DPP retomar o fio sem perder o ganho.",
      created_by: paulo.id,
      created_at: haDias(5, "19:10"),
      supervisor: { id: paulo.id, nome: paulo.nome },
      mentor: { id: sofia.id, nome: sofia.nome },
      dupla: null,
    },
    {
      id: uid(0x3803),
      supervisor_id: beatriz.id,
      mentor_id: fernanda.id,
      dupla_id: duplaRisco.id,
      data: ymd(addDias(HOJE, -2)),
      resumo:
        "Sessão sobre a queda de participação da Dandara: a Fernanda contou que a jovem voltou a trabalhar nos fins de semana e responde pouco no WhatsApp. Combinamos repactuar o horário com a família antes de escalar — o pedido de apoio do 2º encontro já foi encaminhado pra coordenação.",
      created_by: beatriz.id,
      created_at: haDias(2, "20:15"),
      supervisor: { id: beatriz.id, nome: beatriz.nome },
      mentor: { id: fernanda.id, nome: fernanda.nome },
      dupla: { id: duplaRisco.id, mentorado: { nome: dandara.nome } },
    },
  ];

  return {
    personas,
    profiles,
    mentorados,
    mentorProfiles,
    duplas,
    anexos,
    cicloEventos,
    especialistaEventos,
    materiais,
    comunicados,
    solicitacoes,
    pessoaNotas,
    interacoes,
    notificacoes,
    documentoTemplates,
    assinaturas,
    presencas,
    supervisoes,
  };
}

// montado uma vez por processo — o dataset é imutável durante a sessão demo
// (mutations retornam DEMO_MSG antes de chegar aqui)
let cache: DemoData | null = null;

export function getDemoData(): DemoData {
  cache ??= build();
  return cache;
}
