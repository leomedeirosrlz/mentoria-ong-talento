/*
 * Dataset do modo demonstração.
 *
 * Monta um ciclo inteiro em memória — pessoas, duplas, encontros, registros e
 * demais tabelas — pra demo rodar sem sessão nem Supabase. É consumido por
 * `demo/queries.ts` (server components, quando o cookie `demo_role` está
 * ativo) e por `demo/client-stub.ts` (browser, pro stub do supabase-js) —
 * por isso este módulo não pode importar nada server-only (next/*, react,
 * @/lib/supabase/*) — `import type` é apagado no build e módulos puros de
 * domínio (`../ciclo`) seguem seguros no browser.
 *
 * Evergreen: nenhuma data é fixa. Os calendários oficiais (16 encontros de
 * terça-feira, formação, recesso, marco — cópia fiel do seed.sql) vivem em
 * `cronogramas` (0061): a T1 é deslocada pra que o 5º encontro caia na terça
 * da semana corrente e a T2 começa 4 semanas depois dela, com as 3 quintas
 * de sessão dupla do plano real. Todos os timestamps derivam de `new Date()`.
 * Abrir a demo daqui a meses continua contando a mesma história: semana 5
 * da T1 e semana 1 da T2, dupla saudável, uma com registro pendente e sem
 * data pro encontro vigente (o "sem_data" do "Para acompanhar" da WP5), uma
 * em risco, uma com atraso, uma encerrada do ciclo anterior, três trilhas de
 * especialista (duas na mesma mentora — a Sofia) e a fila "Aguardando par"
 * com dois mentorados inscritos (Rafael e Wendel) e um especialista de
 * reserva com vagas (o Marcos). WP3: o Ricardo ganhou uma 2ª dupla DPP na
 * T2 (o Matheus — 1 registro entregue, 1 pendente, 1 encontro em limbo e um
 * pedido de especialista aberto no mural), pra agenda do mentor exercitar
 * as visões "Minha agenda" e "Por mentorado" com dois jovens.
 */

import type {
  AppRole,
  Assinatura,
  AvaliacaoEncontro,
  AvaliacaoJovem,
  AvaliacaoLink,
  Chamado,
  ChamadoAnexo,
  ChamadoAtualizacao,
  ChamadoComentario,
  CicloEvento,
  Comunicado,
  Cronograma,
  DocumentoPessoa,
  DocumentoTemplate,
  Dupla,
  Encaminhamento,
  Encontro,
  EspecialistaEvento,
  ExcecaoEspecialista,
  GradeJanela,
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
  SolicitacaoProposta,
  Supervisao,
  TurmaInscricao,
} from "@/lib/types";
import type { Interacao } from "@/lib/interacoes";
import { disponibilidadeDeConjuntos, toDateStr } from "../ciclo";

// ---------- tabelas da rodada de telas finais (ainda sem migration) ----------
// Espelhos do plano `docs/planos/implementacao-telas-finais.md` — os WPs
// criam os tipos canônicos em ../types quando as migrations aterrissarem;
// até lá a demo usa estes formatos mínimos (ajustar ao schema final de 0084+).

/** `profile_papeis` (WP0b · REALIZA-105): papel por programa — a linha
 *  primária espelha `profiles.role`; o híbrido carrega uma linha extra. */
export type ProfilePapel = {
  profile_id: string;
  papel: AppRole;
  /** null = papel vale pro programa todo; preenchido = só naquela turma. */
  escopo_turma: string | null;
  primario: boolean;
  criado_em?: string;
};

/** `devolutivas` (WP6) — feed datado por trilha; a última entrega continua
 *  sendo a que marca o encerramento (devolutiva_pdm vira projeção dela). */
export type DemoDevolutiva = {
  id: string;
  dupla_id: string;
  autor_id: string;
  texto: string;
  created_at: string;
};

export type DemoData = {
  personas: Record<AppRole, Profile>;
  profiles: Profile[];
  mentorados: Mentorado[];
  mentorProfiles: MentorProfile[];
  duplas: Dupla[];
  anexos: RegistroAnexo[];
  cronogramas: Cronograma[];
  cicloEventos: CicloEvento[];
  especialistaEventos: EspecialistaEvento[];
  /** Agenda real do especialista (0073) — grade semanal + exceções datadas,
   *  por profile_id (a policy escopa a leitura da tabela crua ao dono/coord;
   *  pro jovem só chegam os slots derivados). */
  especialistaGrade: (GradeJanela & { profile_id: string })[];
  especialistaExcecoes: (ExcecaoEspecialista & { profile_id: string })[];
  /** Papel por programa (WP0b · REALIZA-105) — `profiles.role` segue como
   *  primário de compatibilidade enquanto a migration não sai. */
  profilePapeis: ProfilePapel[];
  /** Feed datado de devolutivas por trilha (WP6). */
  devolutivas: DemoDevolutiva[];
  materiais: Material[];
  comunicados: Comunicado[];
  solicitacoes: SolicitacaoEspecialista[];
  /** Thread de propostas da negociação (0074) — append-only, por solicitação. */
  solicitacaoPropostas: SolicitacaoProposta[];
  pessoaNotas: PessoaNota[];
  interacoes: Interacao[];
  /** 0084 — chamados unificados: a fila + trilha pública + internos. */
  chamados: Chamado[];
  chamadoAtualizacoes: ChamadoAtualizacao[];
  chamadoComentarios: ChamadoComentario[];
  chamadoAnexos: ChamadoAnexo[];
  notificacoes: Record<AppRole, Notificacao[]>;
  documentoTemplates: DocumentoTemplate[];
  assinaturas: Assinatura[];
  presencas: Presenca[];
  supervisoes: Supervisao[];
  documentosPessoa: DocumentoPessoa[];
  avaliacoes: AvaliacaoEncontro[];
  avaliacaoLinks: AvaliacaoLink[];
  /** turma_inscricoes (0111 · REALIZA-167) — quem é da turma sem estar em
   *  dupla; alimenta a linha "Sem dupla" do relatório no modo demo. */
  turmaInscricoes: TurmaInscricao[];
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
// assinatura: 34xx · presencas: 36xx · supervisoes: 38xx ·
// avaliacao_links: 42xx · avaliacoes_encontro: 44xx ·
// documentos_pessoa: 46xx · cronogramas: 50xx · especialista_grade: 52xx ·
// especialista_excecoes: 54xx · chamados: 58xx · chamado_atualizacoes: 60xx ·
// chamado_comentarios: 62xx · chamado_anexos: 64xx · devolutivas: 66xx ·
// turma_inscricoes: 68xx.
// user_id fake: f0xx.
// especialista_eventos e profile_papeis não tem id.
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
  // login da Ana (mentorada) — a persona existe no dataset mesmo sem card na
  // /demo: /pessoas mostra "Mentorado" e o vínculo com a ficha dela fecha
  anaLogin: 0x000f,
  // contas dos colegas de turma da Bia (0076) — profile_id é o que os torna
  // visíveis no diretório /jovem/pessoas
  caioLogin: 0x0010,
  dandaraLogin: 0x0011,
  // personas "sem conta" que autora pedidos no mural (0066): profiles sem
  // user_id — o convite segue pendente; created_by aponta pra pessoa certa
  kauaLogin: 0x0013,
  wendelLogin: 0x0014,
  // especialista com a capacidade zerada pro ciclo — o card "Sem vagas" do
  // cardápio do jovem precisa de alguém nessa variante (os de sempre ou são
  // trilha da Bia ou são pedido dela)
  camila: 0x0012,
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
  rafael: 0x0409, // intake da T2, aguarda matching
  wendel: 0x040a, // veio pelo formulário, aguarda matching (fila)
  matheus: 0x040b, // T2 — a 2ª dupla DPP do Ricardo (WP3)
  gustavo: 0x040c, // ciclo 2025/2026 — a concluída do Ricardo com rito aberto
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
  pausa: 0x0609,
  esp4: 0x060a,
  t2a: 0x060b,
  t2b: 0x060c,
  t2c: 0x060d, // Ricardo × Matheus — a 2ª dupla DPP do híbrido (WP3)
  rito: 0x060e, // Ricardo × Gustavo — concluída com o rito de encerramento aberto
} as const;

// cronogramas (0061) — um por turma; a T2 é a turma que começou um mês depois
const CRON = { t1: 0x5001, t2: 0x5002 } as const;

const S = {
  aceita1: 0x2401, aceita2: 0x2402, direcionada: 0x2403, livre: 0x2404,
  cancelada: 0x2405, aceita3: 0x2406, aceita4: 0x2407,
  sess2: 0x2408, sess3: 0x2409, sess4: 0x240a,
  pedidoJovem: 0x240b, triagem: 0x240c,
  biaNeg: 0x240d, biaMural: 0x240e,
  biaSug: 0x240f,
  t2cPedido: 0x2410,
} as const;

// propostas da negociação (solicitacao_propostas, 0074)
const PROP = { s1: 0x5601, s2: 0x5602, s3: 0x5603 } as const;

const MEET = "https://meet.google.com/demo-realiza";

// ---------- datas ----------

const DIA_MS = 24 * 3600 * 1000;
const HORA_MS = 3600 * 1000;

const addDias = (d: Date, n: number): Date => new Date(d.getTime() + n * DIA_MS);

/** "YYYY-MM-DD" do dia de um Date — data de calendário SP, a mesma régua da
 *  grade visual e das exceções. Os Date aqui nascem ancorados no meio-dia
 *  UTC (ver HOJE), então a data SP é a data UTC do instante; pra instantes
 *  soltos, ler o fuso do programa também é o comportamento certo. */
const ymd = (d: Date): string => toDateStr(d);

/** Instante ISO de um dia + horário no fuso do programa (America/Sao_Paulo)
 *  — "19:00" de uma terça vira "T22:00:00.000Z", como o Postgres devolveria. */
const em = (d: Date, hhmm: string): string =>
  new Date(`${ymd(d)}T${hhmm}:00-03:00`).toISOString();

/** Há n dias (ou daqui a n, com n negativo), num horário plausível. */
const haDias = (n: number, hhmm = "10:00"): string =>
  em(addDias(HOJE, -n), hhmm);

/** Serial do "Carimbo de data/hora" do Google Forms (época 1899-12-30) —
 *  o formato cru que a planilha exporta e o form_bruto guarda. */
const serialExcel = (iso: string): string =>
  ((new Date(iso).getTime() - Date.UTC(1899, 11, 30)) / DIA_MS).toFixed(7);

/** created_at de registro: algumas horas depois de o encontro acontecer. */
const depoisDe = (iso: string, horas: number): string =>
  new Date(new Date(iso).getTime() + horas * HORA_MS).toISOString();

/** "hoje" ancorado no meio-dia UTC do dia de calendário SP — todas as datas
 *  relativas partem daqui. UTC-date space é o único plano neutro: meio-dia
 *  local numa máquina UTC+10…+14 seria o dia anterior em SP, e ler campos
 *  locais dessa âncora volta a depender do fuso do servidor. */
const HOJE = new Date(`${toDateStr(new Date())}T12:00:00Z`);

/** Terça-feira da semana corrente — âncora do 5º encontro do ciclo. */
const TERCA_ENCONTRO_5 = addDias(HOJE, ((2 - HOJE.getUTCDay()) + 7) % 7);

/** Dia oficial do encontro n do ciclo (espelha o seed/cronograma oficial):
 *  1–8 semanais a partir da âncora; 15 dias entre o 8º e o 9º (tempo de
 *  prática das submetas); 9–14 semanais; recesso de ~3 semanas; 15–16. */
function diaEncontro(n: number): Date {
  if (n <= 8) return addDias(TERCA_ENCONTRO_5, (n - 5) * 7);
  if (n <= 14) return addDias(TERCA_ENCONTRO_5, (n - 5) * 7 + 7); // folga 8º→9º
  if (n === 15) return addDias(TERCA_ENCONTRO_5, 91); // 14 + 21d (recesso)
  return addDias(TERCA_ENCONTRO_5, 98); // 15 + 7d
}

/** Encontros da T2 — a turma que começa ~1 mês depois (o 1º encontro dela é
 *  a terça da semana corrente, mesma data do 5º da T1) e corre às terças,
 *  exceto nas 3 semanas de sessão dupla do plano real: depois dos encontros
 *  5, 10 e 12 de terça, o seguinte cai na quinta (+2d) e a semana fica com
 *  os dois — é o que comprime o calendário pra T2 terminar junto da T1.
 *  Sem a folga de 15 dias do 8º→9º da T1 e com o mesmo recesso de ~3 semanas
 *  entre o 14º e o 15º — a conta fecha e o 16º das duas turmas cai na mesma
 *  semana, como no calendário real. */
const QUINTA_DUPLA_T2 = new Set([6, 11, 13]); // nºs que caem na quinta

const diaEncontroT2 = (n: number): Date => {
  // 1º encontro da T2 = 5º da T1 (a terça-âncora da semana corrente)
  let d = diaEncontro(5);
  for (let i = 2; i <= n; i++) {
    // +2 = a quinta da sessão dupla; +5 = a terça da semana seguinte a ela;
    // +21 = recesso de fim de ano entre o 14º e o 15º; senão semanal
    d = addDias(
      d,
      i === 15 ? 21 : QUINTA_DUPLA_T2.has(i) ? 2 : QUINTA_DUPLA_T2.has(i - 1) ? 5 : 7
    );
  }
  return d;
};

// ---------- calendário oficial (conteúdo do seed.sql, datas deslocadas) ----------

// As 4 seções do cronograma oficial (0062): preparação (etapas — datadas ou
// "Concluída" sem data), mentoria ativa (16 encontros + recesso), encerramento
// (evento) e observações operacionais (observacao). `ordem` é explícita — a
// sequência do PDF, não a da data (etapa concluída sem data vem antes dos
// encontros; `data nulls last` a jogaria depois do encerramento).

type EtapaSpec = {
  titulo: string;
  /** null = etapa concluída sem data (entregue pela ONG parceira). */
  data: Date | null;
  dataFim?: Date | null;
  observacao?: string | null;
};

/** Preparação da T1 — tudo pela coordenação, tudo datado e já concluído (o
 *  ciclo dela está na semana do 5º encontro). */
const etapasT1 = (dia: (n: number) => Date): EtapaSpec[] => [
  { titulo: "Inscrições", data: addDias(dia(1), -40), dataFim: addDias(dia(1), -20) },
  { titulo: "Triagem e matching", data: addDias(dia(1), -19), dataFim: addDias(dia(1), -6) },
  { titulo: "Onboarding de mentores", data: addDias(dia(1), -5), dataFim: addDias(dia(1), -4) },
  {
    titulo: "Onboarding de mentorados",
    data: addDias(dia(1), -4),
    observacao: "Encontro de abertura com a coordenação",
  },
  { titulo: "Início", data: dia(1) },
];

/** Preparação da T2 — a ONG parceira Cidadão Pró-Mundo entregou inscrições e
 *  triagem/matching prontos: são "Concluída" sem data, com a proveniência na
 *  observação (o que o PDF marca como "Concluídos"). */
const etapasT2 = (dia: (n: number) => Date): EtapaSpec[] => [
  {
    titulo: "Inscrições",
    data: null,
    observacao: "Inscrição e indicação pela ONG parceira Cidadão Pró-Mundo",
  },
  {
    titulo: "Triagem e matching",
    data: null,
    observacao: "Entregue concluída pela ONG parceira Cidadão Pró-Mundo",
  },
  { titulo: "Onboarding de mentores", data: addDias(dia(1), -5), dataFim: addDias(dia(1), -4) },
  {
    titulo: "Onboarding de mentorados",
    data: addDias(dia(1), -4),
    observacao: "Encontro de abertura com a coordenação",
  },
  { titulo: "Início", data: dia(1) },
];

/** Monta os eventos dos dois cronogramas — cada evento carrega o
 *  `cronograma_id` do dono (0061): a identidade do encontro oficial é
 *  (cronograma, numero), numero solto não identifica mais nada. */
function buildCicloEventos(cronogramaT1: string, cronogramaT2: string): CicloEvento[] {
  let i = 0;
  // ordem é por cronograma: o contador reinicia a cada turma (sequência do PDF)
  const seq = new Map<string, number>();
  const ev = (
    cronogramaId: string,
    tipo: CicloEvento["tipo"],
    numero: number | null,
    data: Date | null,
    titulo: string,
    fase: string | null = null,
    instrumentos: string[] = [],
    dataFim: Date | null = null,
    extra: { status?: CicloEvento["status"]; observacao?: string | null } = {}
  ): CicloEvento => {
    const ordem = (seq.get(cronogramaId) ?? 0) + 1;
    seq.set(cronogramaId, ordem);
    return {
      id: uid(0x1800 + ++i),
      cronograma_id: cronogramaId,
      tipo,
      numero,
      data: data ? ymd(data) : null,
      data_fim: dataFim ? ymd(dataFim) : null,
      status: extra.status ?? "pendente",
      observacao: extra.observacao ?? null,
      ordem,
      titulo,
      fase,
      instrumentos,
    };
  };

  const F1 = "Criar vínculo e construir o PDM";
  const F2 = "Colocar o plano em prática";
  const F3 = "Consolidar a autonomia";
  const F4 = "Aprofundar o vínculo e o aprendizado";
  const F5 = "Roda da Vida";
  const F6 = "Encerrar e celebrar";

  /** As linhas do calendário oficial na ordem do PDF (`ordem`), parametrizadas
   *  por `dia` — T1 e T2 rodam a mesma trilha DPP (títulos/fases/instrumentos
   *  iguais), cada uma no seu cronograma: a formação é por turma, então a T2
   *  repete os dois encontros de formação nas datas dela. `quintasDuplas` =
   *  os nºs de encontro que caem na quinta da semana dupla (só T2 — ver
   *  diaEncontroT2); a terça e a quinta da mesma semana carregam nºs
   *  consecutivos. */
  const turma = (
    cronogramaId: string,
    dia: (n: number) => Date,
    etapas: EtapaSpec[],
    quintasDuplas: ReadonlySet<number> = new Set()
  ): CicloEvento[] => [
    // seção 1 — preparação: as 5 etapas do PDF. `status: 'concluida'` nos
    // dois cronogramas — as duas turmas já estão em mentoria ativa. A
    // formação é sessão com chamada (tipo 'formacao'): na `ordem` ela cai
    // dentro da janela da etapa "onboarding de mentores" que a embrulha.
    ...etapas.slice(0, 3).map((e) =>
      ev(cronogramaId, "etapa_preparacao", null, e.data, e.titulo, null, [],
        e.dataFim ?? null, { status: "concluida", observacao: e.observacao })
    ),
    ev(cronogramaId, "formacao", null, addDias(dia(1), -5), "Encontro inicial de formação de mentores"),
    ev(cronogramaId, "formacao", null, addDias(dia(1), -4), "Encontro final de formação de mentores"),
    ...etapas.slice(3).map((e) =>
      ev(cronogramaId, "etapa_preparacao", null, e.data, e.titulo, null, [],
        e.dataFim ?? null, { status: "concluida", observacao: e.observacao })
    ),
    // seção 2 — mentoria ativa. Encontro 1 documenta a regra de reposição;
    // a quinta dupla e o gap 8º→9º vão na observação, como no PDF.
    ev(cronogramaId, "encontro", 1, dia(1), "Boas-vindas, histórias de vida e abertura", F1, ["Perguntas Eficazes", "Escuta Ativa", "PDM", "Roda da Vida (leitura inicial)"], null,
      { observacao: "Reposição na mesma semana" }),
    ev(cronogramaId, "encontro", 2, dia(2), "Avaliação por terceiros e visão de futuro", F1, ["PDM", "Construindo a sua Visão"]),
    ev(cronogramaId, "encontro", 3, dia(3), "Declaração de Visão e metas SMART", F1, ["PDM", "Modelo SMART"]),
    ev(cronogramaId, "encontro", 4, dia(4), "Fechamento da construção do PDM", F1, ["PDM", "Perguntas Eficazes"]),
    ev(cronogramaId, "encontro", 5, dia(5), "Acompanhamento das primeiras submetas", F2, ["PDM", "Feedback Construtivo"]),
    ev(cronogramaId, "encontro", 6, dia(6), "Superação de obstáculos", F2, ["PDM", "Feedback Construtivo"], null,
      quintasDuplas.has(6) ? { observacao: "Encontro duplo" } : {}),
    ev(cronogramaId, "encontro", 7, dia(7), "Ajustes de prazos e desdobramentos", F2, ["PDM", "Feedback Construtivo"]),
    // títulos/fases/instrumentos 8–16 = a correção da 0035 (guia DPP oficial):
    // 8 monitora e já transfere a condução; 9 é a revisão de meio de percurso
    ev(cronogramaId, "encontro", 8, dia(8), "Monitoramento e responsabilidade", F3, ["PDM", "Escuta Ativa"]),
    ev(cronogramaId, "encontro", 9, dia(9), "Revisão de meio de percurso", F3, ["PDM", "Escuta Ativa"], null,
      // o gap 8º→9º existe na T1; na T2 os encontros são comprimidos — a nota
      // só entra quando o intervalo real é maior que uma semana
      (dia(9).getTime() - dia(8).getTime()) / DIA_MS > 7
        ? { observacao: "15 dias desde o 8º encontro — tempo de prática das submetas" }
        : {}),
    ev(cronogramaId, "encontro", 10, dia(10), "O mentor como espelho", F4, ["Papel de modelo", "Escuta Ativa"]),
    ev(cronogramaId, "encontro", 11, dia(11), "Rede de apoio e novos espaços", F4, ["Papel de modelo", "Escuta Ativa"], null,
      quintasDuplas.has(11) ? { observacao: "Encontro duplo" } : {}),
    ev(cronogramaId, "encontro", 12, dia(12), "Aplicação e leitura da Roda da Vida", F5, ["Roda da Vida", "Modelo SMART"]),
    ev(cronogramaId, "encontro", 13, dia(13), "Metas das áreas prioritárias", F5, ["Roda da Vida", "Modelo SMART"], null,
      quintasDuplas.has(13) ? { observacao: "Encontro duplo" } : {}),
    ev(cronogramaId, "encontro", 14, dia(14), "Desdobramento e plano de continuidade", F5, ["Roda da Vida", "Modelo SMART"]),
    ev(cronogramaId, "recesso", null, addDias(dia(14), 1), "Recesso de fim de ano", null, [], addDias(dia(14), 18),
      { observacao: "Sem encontros — retomada na 1ª semana de janeiro" }),
    ev(cronogramaId, "encontro", 15, dia(15), "Reflexão e reconhecimento", F6, ["PDM", "Roda da Vida"]),
    ev(cronogramaId, "encontro", 16, dia(16), "Encerramento e celebração", F6, ["Avaliação 360º", "Autoavaliação do mentor"]),
    // seção 3 — encerramento: evento compartilhável pelas turmas, mas cada
    // cronograma guarda a própria row (cronograma_id é NOT NULL): 15/01 no
    // real, +3d após o 16º encontro de cada uma
    ev(cronogramaId, "evento_encerramento", null, addDias(dia(16), 3), "Evento de encerramento do programa"),
  ];

  return [
    ...turma(cronogramaT1, diaEncontro, etapasT1(diaEncontro)),
    // WP5 — roda de casos da T1 no domingo da semana corrente: as formações
    // do onboarding (enc1-5d/-4d) já passaram e a agenda precisa de uma
    // sessão 'formacao' viva — a "Semana no programa" da coordenação lista
    // os oficiais do seg–dom e o "Do programa" do mentor só mostra eventos
    // com data >= hoje. O domingo cobre os dois filtros em qualquer dia do
    // run (a ordem auto-incrementa pra depois do encerramento — sessão
    // continuada anexada ao calendário, sem reescrever a sequência do PDF)
    ev(
      cronogramaT1, "formacao", null,
      addDias(HOJE, (7 - HOJE.getUTCDay()) % 7),
      "Roda de casos — formação continuada de mentores", null, [], null,
      { observacao: "Sessão quinzenal de casos com a supervisão — a chamada abre no dia" }
    ),
    ...turma(cronogramaT2, diaEncontroT2, etapasT2(diaEncontroT2), QUINTA_DUPLA_T2),
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
    // a coluna é NOT NULL (default now()) — a view jovem_encaminhamentos a
    // expõe e a ordenação dos combinados a usa como desempate. Na vida real
    // o combinado nasce junto do registro do encontro; aqui o fixture
    // aproxima: "cobrado ~1 semana antes do prazo"
    created_at: prazo ? em(addDias(prazo, -7), "20:30") : haDias(14, "20:30"),
  });

  // ---------- pessoas ----------

  // created_at alimenta o "no programa desde" do /perfil

  // Personas: perfil profissional vazio de propósito — o onboarding da demo
  // pergunta bio/áreas/voluntariado, e `onboarded_em` é sempre null (a camada
  // de queries injeta o valor do cookie demo_onboarded por cima).
  const marina: Profile = {
    id: uid(P.marina), user_id: uid(0xf001), nome: "Marina Duarte",
    email: "marina.duarte@realiza.vc", whatsapp: "5511987654001",
    role: "coordenacao", ativo: true, avatar_path: "demo/avatars/marina.svg",
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
    role: "supervisor", ativo: true, avatar_path: "demo/avatars/paulo.svg",
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
    role: "mentor_dpp", ativo: true, avatar_path: "demo/avatars/ricardo.svg",
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
    role: "mentor_especialista", ativo: true, avatar_path: "demo/avatars/sofia.svg",
    created_at: haDias(55),
    documento_path: "documentos/termo-sofia-nogueira.pdf",
    // áreas = a matéria-prima dos chips do mural ("Combina com você" e um
    // chip por tema): inglês é o que fez o Carlos direcionar o pedido do
    // Caio pra ela; matemática é a base das trilhas que ela já carrega
    bio: null, linkedin: null,
    areas: ["inglês", "matemática", "redação"],
    voluntariado: null, onboarded_em: null,
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
    role: "supervisor", ativo: true, avatar_path: "demo/avatars/beatriz.svg",
    created_at: haDias(95),
    documento_path: "documentos/termo-beatriz-lins.pdf",
    bio: "Psicóloga organizacional, 12 anos em programas de desenvolvimento de jovens.",
    linkedin: "https://linkedin.com/in/beatriz-lins",
    areas: ["projetos sociais", "educação", "RH"],
    voluntariado: "Auxiliar executiva de duplas desde o primeiro ciclo do programa.",
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
    role: "mentor_dpp", ativo: true, avatar_path: "demo/avatars/carlos.svg",
    created_at: haDias(70),
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
    role: "mentor_dpp", ativo: true, avatar_path: "demo/avatars/fernanda.svg",
    created_at: haDias(70),
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
    role: "mentor_dpp", ativo: true, avatar_path: "demo/avatars/joaoPedro.svg",
    created_at: haDias(45),
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
    role: "mentor_dpp", ativo: true, avatar_path: "demo/avatars/luiza.svg",
    created_at: haDias(210),
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
    role: "mentor_dpp", ativo: true, avatar_path: "demo/avatars/andre.svg",
    created_at: haDias(35),
    documento_path: "documentos/termo-andre-rocha.pdf",
    bio: "Empreendedor, fundou duas pequenas empresas de serviço.",
    linkedin: "https://linkedin.com/in/andrerocha",
    areas: ["empreendedorismo", "finanças", "vendas"],
    voluntariado: "Mentor do Pedro — a dupla pausou a pedido da família; retorno combinado pro próximo mês.",
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
    role: "mentor_especialista", ativo: true, avatar_path: "demo/avatars/helena.svg",
    created_at: haDias(52),
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
    role: "mentor_especialista", ativo: true, avatar_path: "demo/avatars/marcos.svg",
    created_at: haDias(28),
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
  // especialista com a agenda publicada mas a capacidade zerada neste ciclo
  // (capacidade_especialista: 0 no mentor_profile — a coord segurou a vaga
  // dela): o cardápio do jovem a mostra "Sem vagas" — o pedido dirigido não
  // aterrissa, então o CTA honesto é "Pedir pro mural"
  const camila: Profile = {
    id: uid(P.camila), user_id: uid(0xf012), nome: "Camila Ferraz",
    email: "camila.ferraz@realiza.vc", whatsapp: "5511987654015",
    role: "mentor_especialista", ativo: true, avatar_path: "demo/avatars/camila.svg",
    created_at: haDias(40),
    documento_path: "documentos/termo-camila-ferraz.pdf",
    bio: "Contadora, migrou pra educação financeira — dá trilhas curtas de finanças pessoais.",
    linkedin: "https://linkedin.com/in/camilaferraz",
    areas: ["finanças", "empreendedorismo"],
    voluntariado: "Especialista de finanças pessoais desde o ciclo passado.",
    onboarded_em: haDias(35),
    nome_social: null, data_nascimento: "1991-03-22", genero: "feminino",
    cidade: "São Paulo", uf: "SP",
    interesses: ["educação financeira", "empreendedorismo"],
    motivacao: "Jovem que aprende a fechar o mês no azul muda a vida da casa inteira.",
    pref_genero_par: "indiferente",
    cargo: "Contadora", empresa: "Escritório próprio",
    origem: "Formação de voluntários", consent_lgpd_em: haDias(35),
  };
  // cadastro recebido, ainda não entrou: user_id null + ativo — a badge da
  // lista de pessoas deriva disso, não de flag própria
  const renata: Profile = {
    id: uid(P.renata), user_id: null, nome: "Renata Costa",
    email: "renata.costa@realiza.vc", whatsapp: "5511987654013",
    role: null, ativo: true, avatar_path: "demo/avatars/renata.svg",
    created_at: haDias(3),
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
    role: "mentor_dpp", ativo: false, avatar_path: "demo/avatars/patricia.svg",
    created_at: haDias(300),
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

  // login da Ana — o profile do jovem é a identidade de acesso (role
  // 'mentorado'); os dados de programa ficam na ficha dela em `mentorados`,
  // que aponta de volta por profile_id (0066). Sem card na /demo ainda.
  const anaLogin: Profile = {
    id: uid(P.anaLogin), user_id: uid(0xf00f), nome: "Ana Beatriz Silva",
    email: "anabeatriz.silva@gmail.com", whatsapp: "5511976123001",
    role: "mentorado", ativo: true, avatar_path: "demo/avatars/ana.svg",
    created_at: haDias(45),
    documento_path: null,
    bio: null, linkedin: null, areas: null, voluntariado: null,
    onboarded_em: haDias(40),
    nome_social: "Bia", data_nascimento: "2008-04-12", genero: "feminino",
    cidade: "São Paulo", uf: "SP",
    interesses: ["pedagogia", "ENEM", "leitura"],
    motivacao: null, pref_genero_par: null,
    cargo: null, empresa: null,
    origem: "Oficina de projetos da ONG Horizonte",
    consent_lgpd_em: haDias(45),
  };

  // contas dos colegas de turma (0076): sem elas o mentorado não aparece no
  // diretório do jovem — Eduardo e Pedro seguem sem login de propósito
  const caioLogin: Profile = {
    id: uid(P.caioLogin), user_id: uid(0xf010), nome: "Caio Henrique Oliveira",
    email: "caiohenrique.oliveira@gmail.com", whatsapp: "5511976123002",
    role: "mentorado", ativo: true, avatar_path: "demo/avatars/caio.svg",
    created_at: haDias(45),
    bio: null, linkedin: null, areas: null, voluntariado: null,
    onboarded_em: haDias(40),
    nome_social: null, cidade: "São Paulo", uf: "SP",
    interesses: ["tecnologia", "inglês", "intercâmbio"],
    origem: "Projeto Semente",
    consent_lgpd_em: haDias(45),
  };
  const dandaraLogin: Profile = {
    id: uid(P.dandaraLogin), user_id: uid(0xf011), nome: "Dandara Souza",
    email: "dandara.souza@gmail.com", whatsapp: "5511976123003",
    role: "mentorado", ativo: true, avatar_path: "demo/avatars/dandara.svg",
    created_at: haDias(45),
    bio: null, linkedin: null, areas: null, voluntariado: null,
    onboarded_em: haDias(40),
    nome_social: null, cidade: "São Paulo", uf: "SP",
    interesses: ["jovem aprendiz", "comunicação", "redação"],
    origem: "Casa do Saber",
    consent_lgpd_em: haDias(45),
  };

  // Kauã e Wendel pediram especialista pelo mural (solicitacoes abaixo) —
  // o created_by precisa ser DELES: profiles sem user_id, convite pendente
  // (não entram no diretório de colegas — profile_id do mentorado fica null)
  const kauaLogin: Profile = {
    id: uid(P.kauaLogin), user_id: null, nome: "Kauã Rodrigues",
    email: "kaua.rodrigues@gmail.com", whatsapp: "5511976123006",
    role: "mentorado", ativo: true, avatar_path: "demo/avatars/kaua.svg",
    created_at: haDias(20),
    bio: null, linkedin: null, areas: null, voluntariado: null,
    onboarded_em: null,
    nome_social: null, cidade: "São Paulo", uf: "SP",
    interesses: ["empreendedorismo", "primeiro emprego", "vendas"],
    origem: "Projeto Semente",
    consent_lgpd_em: null,
  };
  const wendelLogin: Profile = {
    id: uid(P.wendelLogin), user_id: null, nome: "Wendel Ferreira",
    email: "wendel.ferreira@realiza.test", whatsapp: "5511976123010",
    role: "mentorado", ativo: true, avatar_path: null,
    created_at: haDias(6),
    bio: null, linkedin: null, areas: null, voluntariado: null,
    onboarded_em: null,
    nome_social: null, cidade: "São Paulo", uf: "SP",
    interesses: ["futebol", "música"],
    origem: "Formulário de matching",
    consent_lgpd_em: null,
  };

  const profiles: Profile[] = [
    marina, paulo, ricardo, sofia, beatriz, carlos, fernanda, joaoPedro,
    luiza, andre, helena, marcos, camila, renata, patricia, anaLogin,
    caioLogin, dandaraLogin, kauaLogin, wendelLogin,
  ];

  const personas: Record<AppRole, Profile> = {
    coordenacao: marina,
    supervisor: paulo,
    mentor_dpp: ricardo,
    mentor_especialista: sofia,
    mentorado: anaLogin,
  };

  // ---------- profile_papeis (WP0b · REALIZA-105) ----------
  // Backfill da demo: todo profiles.role vira uma linha primária de escopo
  // global (escopo_turma null), como a migration do WP0b fará em prod. As
  // linhas extras materializam os híbridos do domínio (guia DPP §5: o pool
  // de especialistas inclui mentores voluntários) — Ricardo e André levam
  // mentor_dpp + mentor_especialista ao mesmo tempo, sem trocar o primário.
  // Enquanto a tabela não existe no banco, este dataset é o que as queries
  // demo usam pra exercitar o filtro por papel (ver papeisDe em queries.ts).
  const profilePapeis: ProfilePapel[] = profiles.flatMap((p) =>
    p.role
      ? [
          {
            profile_id: p.id,
            papel: p.role,
            escopo_turma: null,
            primario: true,
            criado_em: p.created_at ?? undefined,
          },
        ]
      : []
  );
  for (const p of [ricardo, andre]) {
    profilePapeis.push({
      profile_id: p.id,
      papel: "mentor_especialista",
      escopo_turma: null,
      primario: false,
      criado_em: p.created_at ?? undefined,
    });
  }

  const mentorProfiles: MentorProfile[] = [
    // Ricardo sem termo_ok: persona mentor_dpp entra na demo com o banner
    // "termo pendente" — é o que demonstra o fluxo de assinatura.
    // capacidade_especialista 1: ele é um dos híbridos da demo (WP0b) — DPP
    // da Bia E voluntário no pool de especialistas, como prevê o guia DPP
    // ("o pool inclui mentores voluntários") — mas ainda sem grade aberta.
    // capacidade 2 (WP3): a dupla da T2 com o Matheus usa a 2ª vaga — 2/2
    // o coloca entre os "cheios" do remanejo, como o André
    { profile_id: ricardo.id, tipo: "dpp", areas: ["carreira", "educação"], capacidade: 2, capacidade_especialista: 1, termo_ok: false, formacao_ok: true,
      experiencia_previa: "Primeiro ciclo como mentor — concluiu a formação e participou de duas rodas de conversa como ouvinte.",
      formacao_externa: "Trilha de liderança e feedback da empresa.",
      disponibilidade: disponibilidadeDeConjuntos(["ter", "qui"], ["noite"]) },
    // Carlos capacidade 2: veterano da formação com 1 dupla em andamento —
    // 1/2 deixa uma vaga pra sugestão de remanejo/board sem inflar a lotação
    { profile_id: carlos.id, tipo: "dpp", areas: ["tecnologia", "carreira"], capacidade: 2, termo_ok: true, formacao_ok: true,
      experiencia_previa: "Foi monitor em cursinho comunitário por dois anos.",
      formacao_externa: "Mentor de novos devs no programa interno da fintech.",
      disponibilidade: disponibilidadeDeConjuntos(["seg", "qua"], ["noite"]) },
    { profile_id: fernanda.id, tipo: "dpp", areas: ["educação", "projetos sociais"], capacidade: 1, termo_ok: true, formacao_ok: true,
      experiencia_previa: "Coordena projeto de reforço escolar com 40 alunos na rede pública.",
      formacao_externa: null,
      disponibilidade: disponibilidadeDeConjuntos(["ter", "qui"], ["tarde", "noite"]) },
    // João Pedro é o mentor novo que ainda não concluiu a formação — é o que
    // faz o board de matching mostrar o badge "sem formação"
    { profile_id: joaoPedro.id, tipo: "dpp", areas: ["dados", "finanças"], capacidade: 1, termo_ok: true, formacao_ok: false,
      experiencia_previa: null,
      formacao_externa: null,
      disponibilidade: disponibilidadeDeConjuntos(["sab"], ["manha"]) },
    // Luiza capacidade 2: voltou de um ciclo completo — 1/2 com a dupla da
    // T2. A "comunicação" dela é o tema em comum com a Dandara que a
    // sugestão de remanejo usa pra ranquear
    { profile_id: luiza.id, tipo: "dpp", areas: ["design", "comunicação"], capacidade: 2, termo_ok: true, formacao_ok: true,
      experiencia_previa: "Mentora no ciclo anterior — a dupla concluiu o PDM inteiro.",
      formacao_externa: "Workshops de portfólio pra estudantes de design.",
      disponibilidade: disponibilidadeDeConjuntos(["qua", "sex"], ["tarde"]) },
    // André é o híbrido funcional (WP0b): DPP da dupla pausada do Pedro e
    // especialista disponível no pool — capacidade_especialista 1, nenhuma
    // trilha ainda, e a grade dele abre a janela de seg à tarde abaixo
    { profile_id: andre.id, tipo: "dpp", areas: ["empreendedorismo", "finanças"], capacidade: 2, capacidade_especialista: 1, termo_ok: true, formacao_ok: true,
      experiencia_previa: "Empreende há 8 anos; concluiu a formação e abriu a primeira dupla — pausada a pedido da família.",
      formacao_externa: "Mentorias do Sebrae pra pequenos negócios.",
      disponibilidade: disponibilidadeDeConjuntos(["seg", "ter", "qua", "qui", "sex"], ["manha", "tarde"]) },
    // Sofia carrega 2 trilhas ativas (Bia + Eduardo) — pool de especialista
    // separado do DPP desde a 0073; o DPP fica no default informativo
    { profile_id: sofia.id, tipo: "especialista", areas: ["educação", "dados"], capacidade: 1, capacidade_especialista: 2, termo_ok: true, formacao_ok: true,
      experiencia_previa: "Professora de matemática há 10 anos, com aulas particulares focadas em ENEM.",
      formacao_externa: "Especialização em avaliação educacional.",
      disponibilidade: disponibilidadeDeConjuntos(["sab", "dom"], ["manha", "tarde"]) },
    { profile_id: helena.id, tipo: "especialista", areas: ["comunicação", "carreira"], capacidade: 1, capacidade_especialista: 1, termo_ok: true, formacao_ok: true,
      experiencia_previa: "Treina equipes e executivos em apresentações e entrevistas.",
      formacao_externa: "Formação em coaching de oratória.",
      disponibilidade: disponibilidadeDeConjuntos(["ter", "qui"], ["manha", "noite"]) },
    // Marcos é o especialista de reserva com vagas — 2 no pool, nenhuma em uso
    { profile_id: marcos.id, tipo: "especialista", areas: ["tecnologia", "dados"], capacidade: 2, capacidade_especialista: 2, termo_ok: true, formacao_ok: true,
      experiencia_previa: "Professor de curso técnico aos sábados; engenheiro de dados durante a semana.",
      formacao_externa: null,
      disponibilidade: disponibilidadeDeConjuntos(["seg", "qua", "sab"], ["manha", "noite"]) },
    // Camila: vagas zeradas pro ciclo (capacidade_especialista 0) — a grade
    // segue publicada, mas o cardápio do jovem a pinta "Sem vagas" e o
    // pedido dirigido a ela vira proposta pro mural
    { profile_id: camila.id, tipo: "especialista", areas: ["finanças", "empreendedorismo"], capacidade: 0, capacidade_especialista: 0, termo_ok: true, formacao_ok: true,
      experiencia_previa: "Contadora; educação financeira em ONGs há 4 anos.",
      formacao_externa: null,
      disponibilidade: disponibilidadeDeConjuntos(["seg"], ["noite"]) },
    // Patrícia afastada: ficha existe mas sem disponibilidade — o board de
    // matching a mostra como indisponível
    { profile_id: patricia.id, tipo: "dpp", areas: ["RH", "carreira"], capacidade: 1, termo_ok: true, formacao_ok: true,
      experiencia_previa: "Mentora em dois ciclos anteriores.",
      formacao_externa: null,
      disponibilidade: null },
  ];

  // ---------- agenda real do especialista (0073) ----------
  // Grade semanal da Sofia: noites de ter/qui + manhã de sábado — onde as
  // sessões dela caem (Eduardo qui 19:30, Bia sáb 10:00; a terça livre é a
  // que a semana de provas bloqueia). A Helena tem a
  // dela; o Marcos ainda não preencheu — o editor dele abre no empty state.
  const especialistaGrade: (GradeJanela & { profile_id: string })[] = [
    { id: uid(0x5201), profile_id: sofia.id, dia_semana: 2, hora_inicio: "18:00", hora_fim: "21:00" },
    { id: uid(0x5202), profile_id: sofia.id, dia_semana: 4, hora_inicio: "18:00", hora_fim: "21:00" },
    { id: uid(0x5203), profile_id: sofia.id, dia_semana: 6, hora_inicio: "09:00", hora_fim: "12:00" },
    { id: uid(0x5204), profile_id: helena.id, dia_semana: 2, hora_inicio: "19:00", hora_fim: "21:00" },
    { id: uid(0x5205), profile_id: helena.id, dia_semana: 4, hora_inicio: "19:00", hora_fim: "21:00" },
    // André — a janela que ele abriu pro papel de especialista (híbrido):
    // seg à tarde, dentro da disponibilidade que ele já tinha como DPP
    { id: uid(0x5206), profile_id: andre.id, dia_semana: 1, hora_inicio: "14:00", hora_fim: "17:00" },
    // Camila — grade publicada, capacidade zerada: "Atende:" no card com o
    // badge "Sem vagas" (vagas 0 = agenda cheia pro ciclo)
    { id: uid(0x5207), profile_id: camila.id, dia_semana: 1, hora_inicio: "19:00", hora_fim: "21:00" },
  ];

  // Exceções datadas — sempre dentro da janela de ~3 semanas da projeção:
  // um bloqueio na próxima terça (semana de provas na escola, a noite inteira
  // da grade cai) e um horário extra no próximo domingo (abre manhã fora da
  // grade). `|| 7` empurra pro ciclo seguinte quando hoje já é o dia.
  const proximaTerca = addDias(HOJE, ((2 - HOJE.getUTCDay()) + 7) % 7 || 7);
  const proximoDomingo = addDias(HOJE, ((7 - HOJE.getUTCDay()) + 7) % 7 || 7);
  // slots da negociação demo — dentro das grades (Sofia qui 18-21/sáb 9-12,
  // Helena qui 19-21) e sempre no futuro, senão o pedido "expira" na leitura
  const proximaQuinta = addDias(HOJE, ((4 - HOJE.getUTCDay()) + 7) % 7 || 7);
  const proximoSabado = addDias(HOJE, ((6 - HOJE.getUTCDay()) + 7) % 7 || 7);
  const especialistaExcecoes: (ExcecaoEspecialista & { profile_id: string })[] = [
    { id: uid(0x5401), profile_id: sofia.id, data: ymd(proximaTerca), hora_inicio: "18:00", hora_fim: "21:00", tipo: "bloqueio" },
    { id: uid(0x5402), profile_id: sofia.id, data: ymd(proximoDomingo), hora_inicio: "10:00", hora_fim: "12:00", tipo: "extra" },
    // WP4: a grade visual só desenha a semana corrente — exceção datada em
    // semana futura (terça/domingo acima) nunca aparece nela. Estas duas,
    // ancoradas em HOJE, renderizam o hatch de bloqueio e a janela "extra"
    // (7h–9h clipada no eixo 8h) todo dia da semana.
    { id: uid(0x5403), profile_id: sofia.id, data: ymd(HOJE), hora_inicio: "07:00", hora_fim: "09:00", tipo: "extra" },
    { id: uid(0x5404), profile_id: sofia.id, data: ymd(HOJE), hora_inicio: "12:00", hora_fim: "14:00", tipo: "bloqueio" },
  ];

  // ---------- mentorados ----------

  const ana: Mentorado = {
    id: uid(M.ana), nome: "Ana Beatriz Silva",
    email: "anabeatriz.silva@gmail.com", whatsapp: "5511976123001",
    profile_id: uid(P.anaLogin), // login próprio da jovem (0066)
    ong_origem: "ONG Horizonte",
    notas: "3º ano do ensino médio. Quer prestar ENEM pra pedagogia; mora com a mãe e dois irmãos. Veio pela oficina de projetos da ONG.",
    avatar_path: "demo/avatars/ana.svg", documento_path: "documentos/autorizacao-ana-beatriz.pdf",
    nome_social: "Bia", data_nascimento: "2008-04-12", genero: "feminino",
    cidade: "São Paulo", uf: "SP",
    interesses: ["pedagogia", "ENEM", "leitura"],
    motivacao: "Quero ser a primeira da família na faculdade e dar aula pra crianças.",
    pref_genero_par: "feminino",
    objetivos: "Passar no ENEM pra pedagogia e montar um plano de estudos que eu consiga seguir.",
    escolaridade: "medio", origem: "Oficina de projetos da ONG Horizonte",
    disponibilidade: disponibilidadeDeConjuntos(["ter", "qui"], ["noite"]),
    created_at: haDias(60),
    // a Bia compartilha o contato dela de volta (0076) — o toggle do Perfil
    // dela abre ligado na demo
    contato_compartilhado: true,
    // sync-back da autorização assinada — a mãe dela ficou na ficha (0046)
    responsavel: {
      nome_civil: "Cleusa Maria Silva", rg: "22.334.556-7",
      cpf: "32165498791", data_nascimento: "1979-06-30", parentesco: "Mãe",
      endereco: { logradouro: "Rua das Flores", numero: "88", complemento: null, bairro: "Jardim Brasil", cidade: "São Paulo", uf: "SP", cep: "08410250" },
    },
    // currículo veio como link do Drive no form de matching (0081)
    curriculo_url: "https://drive.google.com/file/d/demo-cv-ana-beatriz/view",
  };
  const caio: Mentorado = {
    id: uid(M.caio), nome: "Caio Henrique Oliveira",
    email: "caiohenrique.oliveira@gmail.com", whatsapp: "5511976123002",
    profile_id: uid(P.caioLogin), // tem conta → aparece no diretório da Bia
    // opt-in ligado: o WhatsApp dele chega aos colegas de turma (0076)
    contato_compartilhado: true,
    ong_origem: "Projeto Semente",
    notas: "1º ano. Interesse em tecnologia e intercâmbio; tímido no primeiro contato, engajado depois que pega confiança.",
    avatar_path: "demo/avatars/caio.svg", documento_path: "documentos/autorizacao-caio.pdf",
    nome_social: null, data_nascimento: "2009-08-30", genero: "masculino",
    cidade: "São Paulo", uf: "SP",
    interesses: ["tecnologia", "inglês", "intercâmbio"],
    motivacao: "Sonho em fazer intercâmbio e trabalhar com tecnologia.",
    pref_genero_par: "indiferente",
    objetivos: "Conquistar a bolsa de intercâmbio da escola e destravar o inglês instrumental.",
    escolaridade: "medio", origem: "Projeto Semente",
    disponibilidade: disponibilidadeDeConjuntos(["sab"], ["manha"]),
    created_at: haDias(60),
    // a coordenação já subiu o PDF recebido pro bucket (0081) — a outra
    // forma do campo: arquivo, não link externo
    curriculo_path: "documentos/curriculo-caio-henrique.pdf",
  };
  const dandara: Mentorado = {
    id: uid(M.dandara), nome: "Dandara Souza",
    email: "dandara.souza@gmail.com", whatsapp: "5511976123003",
    profile_id: uid(P.dandaraLogin), // tem conta → listada, mas sem WhatsApp:
    // contato_compartilhado fica no default false (opt-out, 0076)
    ong_origem: "Casa do Saber",
    notas: "2º ano. Voltou a trabalhar fins de semana — agenda apertada. Sonha com vaga de jovem aprendiz.",
    avatar_path: "demo/avatars/dandara.svg", documento_path: "documentos/autorizacao-dandara.pdf",
    nome_social: null, data_nascimento: "2008-12-03", genero: "feminino",
    cidade: "São Paulo", uf: "SP",
    interesses: ["jovem aprendiz", "comunicação", "redação"],
    motivacao: "Trabalho no fim de semana e quero uma vaga de jovem aprendiz pra ajudar em casa.",
    pref_genero_par: "feminino",
    objetivos: "Conseguir a vaga de jovem aprendiz e melhorar a redação pro ENEM.",
    escolaridade: "medio", origem: "Casa do Saber",
    disponibilidade: disponibilidadeDeConjuntos(["ter", "qua"], ["noite"]),
    created_at: haDias(60),
    // supervisionada pela Beatriz — o CV dela é coord-only pro Paulo (0081):
    // ele nem abre a ficha dela (RLS), quanto mais o documento
    curriculo_url: "https://drive.google.com/file/d/demo-cv-dandara/view",
  };
  const eduardo: Mentorado = {
    id: uid(M.eduardo), nome: "Eduardo Lima",
    email: null, whatsapp: "5511976123004",
    ong_origem: "ONG Horizonte",
    notas: null, avatar_path: "demo/avatars/eduardo.svg", documento_path: null,
    // ficha mínima — cadastro antigo, a coordenação ainda não enriqueceu
    nome_social: null, data_nascimento: "2009-01-20", genero: "masculino",
    cidade: "São Paulo", uf: "SP", interesses: [],
    motivacao: null, pref_genero_par: null, objetivos: null,
    escolaridade: "medio", origem: null,
    disponibilidade: null,
    created_at: haDias(58),
  };
  const isabela: Mentorado = {
    id: uid(M.isabela), nome: "Isabela Ferreira",
    email: "isabela.ferreira@gmail.com", whatsapp: "5511976123005",
    ong_origem: "Instituto Alavanca",
    notas: "Ciclo 2025/2026 concluído — fechou o PDM inteiro e entrou no curso técnico que planejava.",
    avatar_path: "demo/avatars/isabela.svg", documento_path: "documentos/autorizacao-isabela.pdf",
    nome_social: null, data_nascimento: "2007-02-14", genero: "feminino",
    cidade: "São Paulo", uf: "SP",
    interesses: ["curso técnico", "administração"],
    motivacao: "Fechei o PDM inteiro — agora é terminar o técnico e estagiar.",
    pref_genero_par: "feminino",
    objetivos: "Concluir o técnico em administração e conseguir estágio na área.",
    escolaridade: "tecnico", origem: "Instituto Alavanca",
    disponibilidade: disponibilidadeDeConjuntos(["seg", "qua"], ["tarde"]),
    // ciclo anterior fechado (a dupla com a Luiza é a "concluida" do
    // dataset) — a saída do programa da 0077 já vem marcada: ela povoa a
    // seção "Fora do programa" da /pessoas e some da fila/pareamento
    situacao: "concluido",
    saiu_em: haDias(228, "18:00"),
    motivo_saida: "Ciclo 2025/2026 — concluiu a jornada e o PDM",
    created_at: haDias(400),
  };
  const kaua: Mentorado = {
    id: uid(M.kaua), nome: "Kauã Rodrigues",
    email: "kaua.rodrigues@gmail.com", whatsapp: "5511976123006",
    ong_origem: "Projeto Semente",
    notas: "3º ano. Entrou na T2 (a turma que começou agora) — o match com o André fechou no empreendedorismo. Interesse em primeiros empregos e no negócio da família.",
    avatar_path: "demo/avatars/kaua.svg", documento_path: "documentos/autorizacao-kaua.pdf",
    nome_social: null, data_nascimento: "2008-07-19", genero: "masculino",
    cidade: "São Paulo", uf: "SP",
    interesses: ["empreendedorismo", "primeiro emprego", "vendas"],
    motivacao: "Quero aprender a transformar a produção de doces da minha família num negócio.",
    pref_genero_par: "masculino",
    objetivos: "Conseguir o primeiro emprego e montar um plano realista pra microempresa da família.",
    escolaridade: "medio", origem: "Projeto Semente",
    disponibilidade: disponibilidadeDeConjuntos(["ter", "qui"], ["noite"]),
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
    created_at: haDias(32),
  };
  const laura: Mentorado = {
    id: uid(M.laura), nome: "Laura Mendes",
    email: null, whatsapp: "5511976123007",
    ong_origem: "Casa do Saber",
    notas: "1º ano. Entrou na T2 com a Luiza — a família pediu reforço em rotina de estudos.",
    avatar_path: "demo/avatars/laura.svg", documento_path: null,
    nome_social: null, data_nascimento: "2009-11-25", genero: "feminino",
    cidade: "São Paulo", uf: "SP",
    interesses: ["rotina de estudos", "vestibular"],
    motivacao: "A família pediu acompanhamento — quero passar de ano direto.",
    pref_genero_par: "feminino",
    objetivos: "Organizar a rotina de estudos e subir as notas de exatas.",
    escolaridade: "medio", origem: "Casa do Saber",
    disponibilidade: disponibilidadeDeConjuntos(["ter", "qui"], ["tarde", "noite"]),
    created_at: haDias(32),
  };
  const pedro: Mentorado = {
    id: uid(M.pedro), nome: "Pedro Henrique Almeida",
    email: null, whatsapp: "5511976123008",
    ong_origem: "ONG Horizonte",
    notas: null, avatar_path: "demo/avatars/pedro.svg", documento_path: null,
    // ficha mínima, como a do Eduardo
    nome_social: null, data_nascimento: "2008-05-08", genero: "masculino",
    cidade: "São Paulo", uf: "SP", interesses: [],
    motivacao: null, pref_genero_par: null, objetivos: null,
    escolaridade: "medio", origem: null, disponibilidade: null,
    created_at: haDias(58),
  };

  // ficha mínima da leva da T2: veio pela ONG parceira da turma nova e
  // aguarda matching — mantém o board com um mentorado sem dupla. O
  // carimbo cru do form (serial Excel, como a planilha exporta) mostra a
  // fonte real da "espera" da fila — mais antiga que o created_at do cadastro
  const rafael: Mentorado = {
    id: uid(M.rafael), nome: "Rafael Nunes",
    email: null, whatsapp: "5511976123009",
    ong_origem: "Cidadão Pró-Mundo",
    notas: "2º ano. Chegou na leva da T2 (parceria Cidadão Pró-Mundo) — aguarda o pareamento.",
    avatar_path: "demo/avatars/rafael.svg", documento_path: null,
    nome_social: null, data_nascimento: "2009-02-11", genero: "masculino",
    cidade: "São Paulo", uf: "SP", interesses: [],
    motivacao: null, pref_genero_par: null, objetivos: null,
    escolaridade: "medio", origem: "ONG Cidadão Pró-Mundo",
    disponibilidade: null,
    created_at: haDias(16),
    form_bruto: { "Carimbo de data/hora": serialExcel(haDias(22, "14:30")) },
  };
  // o caso real da fila (Vinícius/Wendel entraram pelo formulário e ficaram
  // invisíveis): inscrição direta, sem ONG no meio, carimbo recente
  const wendel: Mentorado = {
    id: uid(M.wendel), nome: "Wendel Ferreira",
    email: null, whatsapp: "5511976123010",
    ong_origem: "Cidadão Pró-Mundo",
    notas: "1º ano. Inscreveu pelo formulário de matching — a ONG parceira encaminhou a ficha completa.",
    avatar_path: null, documento_path: null,
    nome_social: null, data_nascimento: "2009-09-02", genero: "masculino",
    cidade: "São Paulo", uf: "SP", interesses: ["futebol", "música"],
    motivacao: "Quero um emprego melhor que o da minha mãe — ela se mata em dois turnos.",
    pref_genero_par: "masculino",
    objetivos: "Organizar os estudos e descobrir uma profissão que eu goste.",
    escolaridade: "medio", origem: "Formulário de matching",
    disponibilidade: disponibilidadeDeConjuntos(["ter", "qui"], ["noite"]),
    created_at: haDias(4),
    form_bruto: { "Carimbo de data/hora": serialExcel(haDias(6, "20:15")) },
  };
  // a 2ª dupla DPP do Ricardo (WP3): veio na mesma leva da T2 que o Kauã —
  // a ONG parceira entregou o matching pronto e o mentor assumiu a segunda
  // vaga da capacidade dele. A grade repete a do Ricardo (ter/qui à noite) —
  // encaixe que o matching usou, e que mantém o overlay "ambos livres" da
  // agenda nos mesmos dias da Bia
  const matheus: Mentorado = {
    id: uid(M.matheus), nome: "Matheus Gonçalves",
    email: "matheus.goncalves@gmail.com", whatsapp: "5511976123011",
    ong_origem: "Cidadão Pró-Mundo",
    notas: "2º ano. Entrou na T2 — o match com o Ricardo fechou em tecnologia e carreira; quer montar portfólio pra concorrer a estágio.",
    avatar_path: "demo/avatars/matheus.svg", documento_path: null,
    nome_social: null, data_nascimento: "2009-06-03", genero: "masculino",
    cidade: "São Paulo", uf: "SP",
    interesses: ["tecnologia", "carreira", "primeiro emprego"],
    motivacao: "Quero um estágio em tecnologia ainda no ensino médio — portfólio é o que me falta.",
    pref_genero_par: "masculino",
    objetivos: "Montar um portfólio com 2 projetos e conseguir o primeiro estágio.",
    escolaridade: "medio", origem: "ONG Cidadão Pró-Mundo",
    disponibilidade: disponibilidadeDeConjuntos(["ter", "qui"], ["noite"]),
    created_at: haDias(32),
  };
  // o mentorado do ciclo 2025/2026 do Ricardo — concluiu a jornada e já
  // consta "fora do programa", mas o rito de encerramento da dupla segue
  // aberto (a pendência que a agenda da coordenação cobra, REALIZA-172:
  // a linha "concluir na ficha" e a autoavaliação que o mentor ainda deve)
  const gustavo: Mentorado = {
    id: uid(M.gustavo), nome: "Gustavo Batista",
    email: null, whatsapp: "5511976123012",
    ong_origem: "Instituto Alavanca",
    notas: "Ciclo 2025/2026 concluído com o Ricardo — a jornada fechou; o rito de encerramento segue aberto na ficha.",
    avatar_path: null, documento_path: null,
    nome_social: null, data_nascimento: "2007-08-02", genero: "masculino",
    cidade: "São Paulo", uf: "SP",
    interesses: ["elétrica", "curso técnico"],
    motivacao: null, pref_genero_par: null, objetivos: null,
    escolaridade: "medio", origem: "Instituto Alavanca",
    disponibilidade: null,
    created_at: haDias(390),
    situacao: "concluido",
    saiu_em: haDias(24, "18:00"),
    motivo_saida: "Ciclo 2025/2026 — concluiu a jornada e o PDM",
  };

  const mentorados = [ana, caio, dandara, eduardo, isabela, kaua, laura, pedro, rafael, wendel, matheus, gustavo];

  // ---------- fila por turma (0111 · REALIZA-167) ----------
  // O Rafael e o Wendel são os dois mentorados da T2 que ainda não têm par —
  // a inscrição `aguardando` é o que faz a linha "Sem dupla" deles aparecer
  // no relatório da turma (antes era array hardcoded no código).
  const turmaInscricoes: TurmaInscricao[] = [
    { id: uid(0x6801), turma: "T2 · 2026/2027", profile_id: null,
      mentorado_id: rafael.id, papel_esperado: "mentorado",
      status: "aguardando", nota: "Veio na leva da ONG Cidadão Pró-Mundo",
      created_by: marina.id, created_at: haDias(16) },
    { id: uid(0x6802), turma: "T2 · 2026/2027", profile_id: null,
      mentorado_id: wendel.id, papel_esperado: "mentorado",
      status: "aguardando", nota: "Inscrição direta pelo formulário de matching",
      created_by: marina.id, created_at: haDias(4) },
  ];

  // ---------- solicitações de especialista (0074 — pedido por sessão) ----
  // (montadas antes das duplas: as duplas de especialista referenciam a
  // solicitação que as originou — e CADA encontro da trilha nasce de um
  // pedido aceito, então a esp1 acumula quatro)

  const solicitacoes: SolicitacaoEspecialista[] = [
    {
      id: uid(S.cancelada),
      mentorado_id: eduardo.id,
      dupla_dpp_id: uid(D.atraso),
      demanda:
        "O Eduardo pediu apoio com oratória pra uma apresentação na ONG, mas a agenda dele fechou com a escola — cancelamos por ora e retomamos depois.",
      motivo: null,
      slot_proposto: null,
      origem: "staff",
      turma: "T1 · 2026/2027",
      justificativa_recusa: null,
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
      especialista_nome: null,
    },
    {
      id: uid(S.aceita2),
      mentorado_id: dandara.id,
      dupla_dpp_id: uid(D.risco),
      demanda:
        "A Dandara quer concorrer a uma vaga de jovem aprendiz e precisa de ajuda com currículo e entrevista — foge da minha área, um especialista de comunicação/RH faria toda a diferença.",
      motivo: null,
      slot_proposto: em(addDias(HOJE, -18), "20:00"),
      origem: "staff",
      turma: "T1 · 2026/2027",
      justificativa_recusa: null,
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
      especialista_nome: helena.nome,
    },
    {
      id: uid(S.aceita3),
      mentorado_id: eduardo.id,
      dupla_dpp_id: uid(D.atraso),
      demanda:
        "O Eduardo trava em matemática básica (frações e razão) e isso derruba o resto das notas do 1º ano — a Sofia é professora de exatas e topou pegar uma segunda trilha.",
      motivo: null,
      slot_proposto: em(addDias(HOJE, -6), "19:30"),
      origem: "staff",
      turma: "T1 · 2026/2027",
      justificativa_recusa: null,
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
      especialista_nome: sofia.nome,
      desejado: { nome: sofia.nome },
    },
    {
      // a Bia já fechou uma trilha antes da de matemática — oratória com a
      // Helena, pra apresentação do projeto dela. É a segunda devolutiva que
      // chega ao PDM da d-ok (a seção agrega todas as trilhas do jovem)
      id: uid(S.aceita4),
      mentorado_id: ana.id,
      dupla_dpp_id: uid(D.ok),
      demanda:
        "A Bia vai apresentar o projeto dela num evento da ONG e trava pra falar em público — uma trilha de oratória com a Helena destrava a meta do PDM.",
      motivo: null,
      slot_proposto: em(addDias(HOJE, -28), "19:00"),
      origem: "staff",
      turma: "T1 · 2026/2027",
      justificativa_recusa: null,
      especialista_desejado_id: helena.id,
      especialista_id: helena.id,
      dupla_id: uid(D.esp4),
      status: "aceita",
      created_by: ricardo.id,
      created_at: haDias(33, "20:30"),
      respondida_em: haDias(31, "09:00"),
      mentorado: { nome: ana.nome },
      solicitante: { nome: ricardo.nome },
      especialista: { nome: helena.nome },
      especialista_nome: helena.nome,
      desejado: { nome: helena.nome },
    },
    {
      // sessões seguintes da mesma trilha (sessões 2-4 da d-esp1): slot-only,
      // sem demanda — cada uma aponta pra dupla já formada
      id: uid(S.aceita1),
      mentorado_id: ana.id,
      dupla_dpp_id: uid(D.ok),
      demanda:
        "A Bia quer prestar ENEM no fim do ano e trava em matemática — faltou base de frações e funções. Um especialista em exatas ajudaria a destravar a meta do PDM.",
      motivo: null,
      slot_proposto: em(addDias(HOJE, -12), "18:30"),
      origem: "staff",
      turma: "T1 · 2026/2027",
      justificativa_recusa: null,
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
      especialista_nome: sofia.nome,
      desejado: { nome: sofia.nome },
    },
    {
      // a 2ª sessão — pedida pela própria Bia (pedido do jovem com dupla DPP
      // nasce 'aberta'); a sessão furou (encontro 2 = nao_aconteceu)
      id: uid(S.sess2),
      mentorado_id: ana.id,
      dupla_dpp_id: uid(D.ok),
      demanda: null,
      motivo: "Quero continuar a trilha de matemática com a Sofia.",
      slot_proposto: em(addDias(HOJE, -8), "18:30"),
      origem: "jovem",
      turma: "T1 · 2026/2027",
      justificativa_recusa: null,
      especialista_desejado_id: sofia.id,
      especialista_id: sofia.id,
      dupla_id: uid(D.esp1),
      status: "aceita",
      created_by: anaLogin.id,
      created_at: haDias(10, "20:10"),
      respondida_em: haDias(9, "18:00"),
      mentorado: { nome: ana.nome },
      solicitante: { nome: anaLogin.nome_social ?? anaLogin.nome },
      especialista: { nome: sofia.nome },
      especialista_nome: sofia.nome,
      desejado: { nome: sofia.nome },
    },
    {
      // a 3ª — nova negociação depois da falta (passo 2 coberto na tentativa 3)
      id: uid(S.sess3),
      mentorado_id: ana.id,
      dupla_dpp_id: uid(D.ok),
      demanda: null,
      motivo: "Remarcar a sessão que não rolou.",
      slot_proposto: em(addDias(HOJE, -5), "18:30"),
      origem: "jovem",
      turma: "T1 · 2026/2027",
      justificativa_recusa: null,
      especialista_desejado_id: sofia.id,
      especialista_id: sofia.id,
      dupla_id: uid(D.esp1),
      status: "aceita",
      created_by: anaLogin.id,
      created_at: haDias(7, "12:00"),
      respondida_em: haDias(6, "19:00"),
      mentorado: { nome: ana.nome },
      solicitante: { nome: anaLogin.nome_social ?? anaLogin.nome },
      especialista: { nome: sofia.nome },
      especialista_nome: sofia.nome,
      desejado: { nome: sofia.nome },
    },
    {
      // a 4ª — a sessão agendada pro próximo sábado 10:00 nasceu deste
      // pedido (WP4: o slot aceito casa com o encontro ancorado na grade)
      id: uid(S.sess4),
      mentorado_id: ana.id,
      dupla_dpp_id: uid(D.ok),
      demanda: null,
      motivo: "Próxima sessão da trilha.",
      slot_proposto: em(proximoSabado, "10:00"),
      origem: "jovem",
      turma: "T1 · 2026/2027",
      justificativa_recusa: null,
      especialista_desejado_id: sofia.id,
      especialista_id: sofia.id,
      dupla_id: uid(D.esp1),
      status: "aceita",
      created_by: anaLogin.id,
      created_at: haDias(3, "21:00"),
      respondida_em: haDias(2, "08:30"),
      mentorado: { nome: ana.nome },
      solicitante: { nome: anaLogin.nome_social ?? anaLogin.nome },
      especialista: { nome: sofia.nome },
      especialista_nome: sofia.nome,
      desejado: { nome: sofia.nome },
    },
    {
      // em negociação: direcionada à Sofia, que engajou propondo sábado — o
      // Carlos devolveu pedindo terça (thread em solicitacaoPropostas). A
      // última proposta é do autor → a Sofia decide agora
      id: uid(S.direcionada),
      mentorado_id: caio.id,
      dupla_dpp_id: uid(D.pend),
      demanda:
        "O Caio vai concorrer a um programa de intercâmbio e precisa de inglês instrumental — entrevista e leitura de edital. Penso na Sofia, se ela tiver disponibilidade.",
      motivo: null,
      slot_proposto: em(proximaTerca, "19:30"),
      origem: "staff",
      turma: "T1 · 2026/2027",
      justificativa_recusa: null,
      especialista_desejado_id: sofia.id,
      especialista_id: sofia.id,
      dupla_id: null,
      status: "contra_proposta",
      created_by: carlos.id,
      created_at: haDias(4, "21:00"),
      respondida_em: null,
      mentorado: { nome: caio.nome },
      solicitante: { nome: carlos.nome },
      especialista: { nome: sofia.nome },
      especialista_nome: sofia.nome,
      desejado: { nome: sofia.nome },
    },
    {
      id: uid(S.livre),
      mentorado_id: dandara.id,
      dupla_dpp_id: uid(D.risco),
      demanda:
        "A Dandara voltou mais participativa depois do apoio, mas pediu ajuda com redação pro ENEM — foge totalmente da minha área. Aberta pra qualquer especialista.",
      motivo: null,
      slot_proposto: null,
      origem: "staff",
      turma: "T1 · 2026/2027",
      justificativa_recusa: null,
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
      especialista_nome: null,
    },
    {
      // pedido do Kauã com dupla DPP ativa: nasce 'aberta' já com o slot que
      // ele sugeriu — vai direto pra Helena, que não é persona (a demo mostra
      // o estado pro coord e pro mentor DPP, não pra quem negocia)
      id: uid(S.pedidoJovem),
      mentorado_id: kaua.id,
      dupla_dpp_id: uid(D.t2a),
      demanda: null,
      motivo: "Quero treinar apresentação em inglês pro processo da faculdade.",
      slot_proposto: em(proximaQuinta, "20:00"),
      origem: "jovem",
      turma: "T2 · 2026/2027",
      justificativa_recusa: null,
      especialista_desejado_id: helena.id,
      especialista_id: null,
      dupla_id: null,
      status: "aberta",
      created_by: kauaLogin.id,
      created_at: haDias(1, "18:40"),
      respondida_em: null,
      mentorado: { nome: kaua.nome },
      solicitante: { nome: "Kauã" },
      especialista: null,
      especialista_nome: null,
      desejado: { nome: helena.nome },
    },
    {
      // pedido do Wendel SEM dupla DPP: entra na fila de triagem da
      // coordenação — liberar exige definir a turma (reconhecer_solicitacao)
      id: uid(S.triagem),
      mentorado_id: wendel.id,
      dupla_dpp_id: null,
      demanda: null,
      motivo: "Preciso de ajuda com matemática financeira pro negócio da família.",
      slot_proposto: null,
      origem: "jovem",
      turma: null,
      justificativa_recusa: null,
      especialista_desejado_id: null,
      especialista_id: null,
      dupla_id: null,
      status: "aguardando_coord",
      created_by: wendelLogin.id,
      // 6 dias parado: o limiar do alerta do painel da coordenação é 5 —
      // o Wendel aparece nos "Pedidos parados" como o caso de triagem
      created_at: haDias(6, "09:15"),
      respondida_em: null,
      mentorado: { nome: wendel.nome },
      solicitante: { nome: wendel.nome },
      especialista: null,
      especialista_nome: null,
    },
    {
      // a Bia pedindo a Helena de volta: a trilha de oratória (d-esp4)
      // concluiu, então não tem dupla ativa pra apontar — mas como ela já tem
      // a de matemática aberta, o pedido é motivo-curto (o gate da demanda é
      // do primeiro pedido). A Helena engajou e devolveu com terça 19h —
      // o slot na mesa é o dela e a vez é da Bia (aceita ou contra-propõe)
      id: uid(S.biaNeg),
      mentorado_id: ana.id,
      dupla_dpp_id: uid(D.ok),
      demanda: null,
      motivo:
        "Quero voltar a treinar oratória pra apresentação do seminário de pedagogia.",
      slot_proposto: em(proximaTerca, "19:00"),
      origem: "jovem",
      turma: "T1 · 2026/2027",
      justificativa_recusa: null,
      especialista_desejado_id: helena.id,
      especialista_id: helena.id,
      dupla_id: null,
      status: "contra_proposta",
      created_by: anaLogin.id,
      created_at: haDias(1, "21:10"),
      respondida_em: null,
      mentorado: { nome: ana.nome },
      solicitante: { nome: anaLogin.nome_social ?? anaLogin.nome },
      especialista: { nome: helena.nome },
      especialista_nome: helena.nome,
      desejado: { nome: helena.nome },
    },
    {
      // pedido em broadcast da Bia — "qualquer especialista": sem alvo nem
      // slot, fica no mural até alguém engajar. Dois abertos ao mesmo tempo
      // (dedup é por par; o teto dela é 3)
      id: uid(S.biaMural),
      mentorado_id: ana.id,
      dupla_dpp_id: uid(D.ok),
      demanda: null,
      motivo:
        "Tô em dúvida entre pedagogia e psicologia — queria conversar com alguém que já passou por isso.",
      slot_proposto: null,
      origem: "jovem",
      turma: "T1 · 2026/2027",
      justificativa_recusa: null,
      especialista_desejado_id: null,
      especialista_id: null,
      dupla_id: null,
      status: "aberta",
      created_by: anaLogin.id,
      created_at: haDias(0, "12:40"),
      respondida_em: null,
      mentorado: { nome: ana.nome },
      solicitante: { nome: anaLogin.nome_social ?? anaLogin.nome },
      especialista: null,
      especialista_nome: null,
      desejado: null,
    },
    {
      // WP6 — o Ricardo (DPP da Bia) registrou uma sugestão: nasce 'sugerida',
      // fora dos tetos e do mural, e espera a resposta dela na página de
      // especialistas (confirmar edita/aceita; dispensar cancela)
      id: uid(S.biaSug),
      mentorado_id: ana.id,
      dupla_dpp_id: uid(D.ok),
      demanda:
        "A Bia mencionou que quer aprender a editar vídeo pro projeto dela — uma trilha curta com alguém de audiovisual destrava a entrega.",
      motivo: "Quero aprender edição de vídeo pra entregar o projeto do semestre.",
      slot_proposto: null,
      origem: "mentor",
      turma: "T1 · 2026/2027",
      justificativa_recusa: null,
      // o Ricardo apontou o Marcos — alimenta o "Pensando em:" do card de
      // sugestão na página de especialistas do jovem
      especialista_desejado_id: marcos.id,
      especialista_id: null,
      dupla_id: null,
      status: "sugerida",
      created_by: ricardo.id,
      created_at: haDias(0, "16:20"),
      respondida_em: null,
      mentorado: { nome: ana.nome },
      solicitante: { nome: ricardo.nome },
      especialista: null,
      especialista_nome: null,
      desejado: { nome: marcos.nome },
    },
    {
      // WP3 — pedido aberto da 2ª dupla do Ricardo: é o que alimenta o
      // stepper "Pedido → No mural → Aceite → Trilha" do card do Matheus na
      // visão Por mentorado (o jovem ainda não tem trilha). Broadcast — sem
      // alvo nem slot — pra mostrar o estado "ninguém aceitou ainda"
      id: uid(S.t2cPedido),
      mentorado_id: matheus.id,
      dupla_dpp_id: uid(D.t2c),
      demanda:
        "O Matheus quer montar um portfólio de projetos pra concorrer a estágio em tecnologia — foge da minha área, um especialista de produto/carreira destrava.",
      motivo: null,
      slot_proposto: null,
      origem: "staff",
      turma: "T2 · 2026/2027",
      justificativa_recusa: null,
      especialista_desejado_id: null,
      especialista_id: null,
      dupla_id: null,
      status: "aberta",
      created_by: ricardo.id,
      created_at: haDias(2, "18:00"),
      respondida_em: null,
      mentorado: { nome: matheus.nome },
      solicitante: { nome: ricardo.nome },
      especialista: null,
      especialista_nome: null,
      desejado: null,
    },
  ];

  // thread de propostas do pedido do Caio (0074) — append-only: a Sofia
  // engajou oferecendo sábado e o Carlos devolveu pedindo terça. O slot na
  // mesa é o da última proposta (do autor — a vez é da Sofia)
  const solicitacaoPropostas: SolicitacaoProposta[] = [
    {
      id: uid(PROP.s1),
      solicitacao_id: uid(S.direcionada),
      autor_id: sofia.id,
      slot_proposto: em(proximoSabado, "10:00"),
      mensagem: "Aceito o pedido — mas semana de prova, só consigo sábado de manhã.",
      created_at: haDias(3, "20:00"),
      autor: { nome: sofia.nome },
    },
    {
      id: uid(PROP.s2),
      solicitacao_id: uid(S.direcionada),
      autor_id: carlos.id,
      slot_proposto: em(proximaTerca, "19:30"),
      mensagem: "Sábado o Caio tem curso — pode na terça à noite?",
      created_at: haDias(2, "09:30"),
      autor: { nome: carlos.nome },
    },
    {
      // a Helena devolveu o pedido da Bia: a jovem propôs quinta 20h, a
      // especialista só consegue terça 19h — o slot na mesa é o dela e a
      // vez é da Bia (o rail mostra Aceitar / Propor outro / Cancelar)
      id: uid(PROP.s3),
      solicitacao_id: uid(S.biaNeg),
      autor_id: helena.id,
      slot_proposto: em(proximaTerca, "19:00"),
      mensagem:
        "Peguei seu pedido! Quinta 20h não rola pra mim — terça às 19h pode?",
      created_at: haDias(1, "08:20"),
      autor: { nome: helena.nome },
    },
  ];

  // ---------- cronogramas (0061) ----------

  // Dois calendários oficiais ativos, um por turma: a T1 corre a semana 5 do
  // ciclo e a T2 acabou de começar — a turma que entra ~1 mês depois e
  // comprime o calendário com as 3 quintas de sessão dupla pra terminar
  // junto (ver diaEncontroT2). inicio/fim/esperados derivam dos eventos —
  // mesma conta do backfill da 0061 (min(data), max(data|data_fim), count
  // dos 'encontro').
  const cronogramaT1 = uid(CRON.t1);
  const cronogramaT2 = uid(CRON.t2);
  const cicloEventos = buildCicloEventos(cronogramaT1, cronogramaT2);

  const cronogramaDe = (
    id: string,
    nome: string,
    turma: string,
    criadoDias: number
  ): Cronograma => {
    const evs = cicloEventos.filter((e) => e.cronograma_id === id);
    // data nullable (0062): etapas concluídas sem data ficam fora do min/max
    const datas = evs.flatMap((e) => (e.data ? [e.data] : []));
    const fins = evs.flatMap((e) => {
      const f = e.data_fim ?? e.data;
      return f ? [f] : [];
    });
    return {
      id,
      nome,
      turma,
      trilha: "dpp",
      inicio_em: datas.length ? datas.reduce((a, b) => (a < b ? a : b)) : null,
      fim_em: fins.length ? fins.reduce((a, b) => (a > b ? a : b)) : null,
      encontros_esperados: evs.filter((e) => e.tipo === "encontro").length,
      status: "ativo",
      created_by: marina.id,
      created_at: haDias(criadoDias),
    };
  };

  const cronogramas: Cronograma[] = [
    cronogramaDe(cronogramaT1, "Calendário oficial · T1", "T1 · 2026/2027", 60),
    cronogramaDe(cronogramaT2, "Calendário oficial · T2", "T2 · 2026/2027", 32),
  ];

  // ---------- duplas ----------

  const inicioCiclo = ymd(addDias(diaEncontro(1), -7));
  // a T2 começou agora: o 1º encontro oficial dela é a terça desta semana
  const inicioCicloT2 = ymd(addDias(diaEncontroT2(1), -7));
  const diaE1T2 = diaEncontroT2(1);
  const e1T2Passou = diaE1T2.getTime() < HOJE.getTime();

  // d-ok · Ricardo × Ana Beatriz — a dupla saudável: 4 encontros no calendário
  // oficial com registro bom, 5º agendado pra terça corrente e o 6º já
  // marcado pra semana seguinte (agenda livre: sempre há um agendado futuro
  // DPP na mão da persona jovem — remarcar/desmarcar renderizam na /jovem)
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
    agendado(uid(D.ok), 6, diaEncontro(6), { link: MEET }),
  ];

  const regD1E1 = encD1[0].registro!;
  const regD1E3 = encD1[2].registro!;
  const regD1E4 = encD1[3].registro!;

  const duplaOk: Dupla = {
    id: uid(D.ok),
    turma: "T1 · 2026/2027",
    cronograma_id: cronogramaT1,
    status: "ativa",
    iniciada_em: inicioCiclo,
    trilha: "dpp",
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
  // que o semáforo cobra) + um registro tardio no histórico + o 5º oficial
  // sem row nenhuma: é a dupla do motivo "sem data" no "Para acompanhar"
  // (WP5) — a Marina já mandou nudge há 5 dias (log de interações) e o par
  // segue sem marcar. Mantida no lugar de uma dupla nova pra não mexer nos
  // denominadores: T1 segue com 4 ativas, o Carlos continua 1/2 e a lista
  // supervisionada do Paulo intocada.
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
    // sem enc 5 — a janela do oficial vigente tá aberta e a dupla não marcou
  ];

  const regD2E1 = encD2[0].registro!;
  const regD2E3 = encD2[2].registro!;

  const duplaPend: Dupla = {
    id: uid(D.pend),
    turma: "T1 · 2026/2027",
    cronograma_id: cronogramaT1,
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
    turma: "T1 · 2026/2027",
    cronograma_id: cronogramaT1,
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
    turma: "T1 · 2026/2027",
    cronograma_id: cronogramaT1,
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

  // d-pausa · André × Pedro — a dupla pausada: engatou nos 2 primeiros
  // encontros, aí a família pediu pausa (a mãe do Pedro adoeceu e ele assumiu
  // o cuidado do irmão). O 3º ficou agendado no passado e o semáforo congela
  // em "Dupla pausada" — sai das cobranças sem virar risco.
  const encDPausa: Encontro[] = [
    comRegistro(
      realizado(uid(D.pausa), 1, diaEncontro(1), { duracao: 60 }),
      andre, "Pedro", "dpp"
    ),
    comRegistro(
      realizado(uid(D.pausa), 2, diaEncontro(2), { duracao: 60, origem: "externo" }),
      andre, "Pedro", "dpp",
      {
        avaliacao: "regular",
        dificuldade: "outro",
        dificuldade_detalhe:
          "Contexto familiar: a mãe do Pedro adoeceu e ele assumiu o irmão menor depois da escola — a rotina apertou de repente.",
        proximo_passo: "acompanhar_de_perto",
      }
    ),
    agendado(uid(D.pausa), 3, diaEncontro(3), {}),
  ];

  const duplaPausa: Dupla = {
    id: uid(D.pausa),
    turma: "T1 · 2026/2027",
    cronograma_id: cronogramaT1,
    status: "pausada",
    iniciada_em: inicioCiclo,
    trilha: "dpp",
    demanda: null,
    solicitacao_id: null,
    mentor: andre,
    mentorado: pedro,
    supervisor: beatriz,
    encontros: encDPausa,
    encaminhamentos: [
      encaminhamento(uid(D.pausa), encDPausa[1].registro!.id,
        "Ligar pra família no dia 10 pra combinar a retomada",
        "mentor", addDias(HOJE, 10), "pendente"),
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
    // histórica do ciclo anterior: turma é só o label — cronograma_id null
    // exercita o fallback da ficha (a trilha renderiza pelos encontros reais)
    turma: "2025/2026",
    cronograma_id: null,
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

  // d-rito · Ricardo × Gustavo — a outra dupla do ciclo 2025/2026 do
  // Ricardo: entrou na metade do ciclo e a jornada esticou com remarcações,
  // então o último encontro caiu semanas atrás — a dupla virou 'concluida'
  // e o Gustavo já consta fora do programa, mas o rito de encerramento
  // segue aberto (tipo null no encerramento-data). É o caso que a agenda
  // da coordenação cobra (REALIZA-172): a pendência vira linha "concluir
  // na ficha" no monitoramento e "falta sua autoavaliação" no card do
  // mentor — a d-fim NÃO serve aqui porque o rito dela já foi decidido.
  const FIM_DUPLA_RITO = addDias(HOJE, -24);
  const encRito: Encontro[] = Array.from({ length: 16 }, (_, i) => {
    const n = i + 1;
    const enc = realizado(uid(D.rito), n, addDias(FIM_DUPLA_RITO, (n - 16) * 7), {
      duracao: n % 4 === 0 ? 60 : 75,
      origem: n % 5 === 0 ? "externo" : "plataforma",
    });
    return comRegistro(enc, ricardo, "Gustavo", "dpp", {});
  });

  const duplaRito: Dupla = {
    id: uid(D.rito),
    // histórica como a d-fim: sem cronograma vivo — a turma é só o label
    turma: "2025/2026",
    cronograma_id: null,
    status: "concluida",
    iniciada_em: ymd(addDias(FIM_DUPLA_RITO, -15 * 7 - 7)),
    trilha: "dpp",
    demanda: null,
    solicitacao_id: null,
    mentor: ricardo,
    mentorado: gustavo,
    supervisor: beatriz, // o Paulo supervisiona a d-fim; a Beatriz cobre esta
    encontros: encRito,
    encaminhamentos: [
      encaminhamento(uid(D.rito), encRito[15].registro!.id,
        "Manter o plano do curso de elétrica vivo depois do programa",
        "mentorado", addDias(FIM_DUPLA_RITO, 30), "feito"),
    ],
    notas: [],
  };

  // d-esp1 · Sofia × Ana Beatriz — trilha de especialista (5 passos, sem
  // calendário oficial), nascida da solicitação aceita do Ricardo.
  // numero = TENTATIVA (0074): a 2ª furou (a Bia teve prova surpresa e a
  // sessão virou um novo pedido), então o que é passo 2 pra jornada mora
  // na tentativa 3 — cada sessão aceita é uma solicitação própria.
  const encD6: Encontro[] = [
    comRegistro(
      realizado(uid(D.esp1), 1, addDias(HOJE, -12), { hora: "18:30", duracao: 60 }),
      sofia, "Bia", "especialista",
      {
        observacoes:
          "Foco da trilha: base de frações e funções pra chegar inteira no ENEM.",
      }
    ),
    naoAconteceu(uid(D.esp1), 2, addDias(HOJE, -8), { hora: "18:30" }),
    comRegistro(
      realizado(uid(D.esp1), 3, addDias(HOJE, -5), { hora: "18:30", duracao: 60 }),
      sofia, "Bia", "especialista",
      {
        reflexoes:
          "Diagnóstico fechado: Bia trava em fração e função, não em matemática como um todo. Listas curtas de exercício funcionaram melhor que explicação longa.",
        observacoes:
          "Combinado: lista de 10 exercícios de fração progressiva até o próximo encontro.",
      }
    ),
    // WP4: ancorada no próximo sábado 10:00 — sempre dentro da janela de
    // sábado 9–12 da grade, nunca cai na terça bloqueada nem flutua de dow
    agendado(uid(D.esp1), 4, proximoSabado, { hora: "10:00" }),
  ];

  const duplaEsp1: Dupla = {
    id: uid(D.esp1),
    // especialista não tem cronograma (trilha livre) — carrega só a turma
    turma: "T1 · 2026/2027",
    cronograma_id: null,
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
      encaminhamento(uid(D.esp1), encD6[2].registro!.id,
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
    turma: "T1 · 2026/2027",
    cronograma_id: null,
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
    // WP4: ancorada em HOJE — a grade visual só desenha a semana corrente
    // (seg–dom), e "próxima quinta" fugia dela de sex a dom. Hoje 19:30 cai
    // dentro da janela em ter/qui e vira "sessão combinada fora da grade"
    // nos outros dias — os dois casos renderizam.
    agendado(uid(D.esp3), 2, HOJE, { hora: "19:30" }),
  ];

  const duplaEsp3: Dupla = {
    id: uid(D.esp3),
    turma: "T1 · 2026/2027",
    cronograma_id: null,
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

  // d-esp4 · Helena × Ana — trilha de especialista CONCLUÍDA (os 5 encontros
  // rodaram e a devolutiva já foi pro PDM). É a segunda trilha da Bia: a de
  // matemática (esp1) segue aberta; esta, de oratória, fechou — o mentor DPP
  // vê as duas devolutivas na ficha, e a Helena vê a trilha concluída na
  // home dela
  const encD9: Encontro[] = [
    comRegistro(
      realizado(uid(D.esp4), 1, addDias(HOJE, -28), { hora: "19:00", duracao: 60 }),
      helena, "Bia", "especialista",
      {
        observacoes:
          "Diagnóstico de oratória: ela decora o texto e trava se esquece uma frase — vamos trabalhar estrutura no lugar de script.",
      }
    ),
    comRegistro(
      realizado(uid(D.esp4), 2, addDias(HOJE, -22), { hora: "19:00", duracao: 60 }),
      helena, "Bia", "especialista",
      {
        reflexoes:
          "Exercício de fala livre sobre o projeto: 2 minutos sem notas. Travou no meio, mas se recuperou sozinha — boa base.",
      }
    ),
    comRegistro(
      realizado(uid(D.esp4), 3, addDias(HOJE, -16), { hora: "19:00", duracao: 60 }),
      helena, "Bia", "especialista"
    ),
    comRegistro(
      realizado(uid(D.esp4), 4, addDias(HOJE, -10), { hora: "19:00", duracao: 75 }),
      helena, "Bia", "especialista",
      {
        observacoes:
          "Ensaio geral com plateia simulada (mãe + irmã assistindo). Postura e pausas saíram; falta só responder pergunta de improviso.",
      }
    ),
    comRegistro(
      realizado(uid(D.esp4), 5, addDias(HOJE, -6), { hora: "19:00", duracao: 75 }),
      helena, "Bia", "especialista",
      {
        reflexoes:
          "Apresentação completa pro grupo de 20 pessoas da ONG — respondeu as três perguntas finais de improviso, sem notas.",
        observacoes:
          "Trilha batida: a meta da solicitação (destravar a apresentação do projeto) foi cumprida.",
      }
    ),
  ];

  const duplaEsp4: Dupla = {
    id: uid(D.esp4),
    turma: "T1 · 2026/2027",
    cronograma_id: null,
    status: "concluida",
    trilha: "especialista",
    iniciada_em: ymd(addDias(HOJE, -30)),
    demanda:
      "Oratória pra apresentação do projeto da Bia no evento da ONG.",
    solicitacao_id: uid(S.aceita4),
    mentor: helena,
    mentorado: ana,
    supervisor: paulo, // o mesmo supervisor da dupla DPP da Bia
    encontros: encD9,
    encaminhamentos: [],
    notas: [],
    encerrada_em: ymd(addDias(HOJE, -5)),
    motivo_encerramento:
      "Trilha concluída — os 5 encontros aconteceram e a meta da solicitação foi batida.",
    devolutiva_pdm:
      "A Bia apresentou o projeto dela pra uma plateia de 20 pessoas na última sessão — saiu do texto decorado e respondeu as três perguntas finais de improviso, sem notas. Pro PDM: vale colocar ela pra apresentar os próprios resultados nos encontros da dupla — exposição curta e frequente consolidou mais do que treino longo.",
  };

  // ---------- duplas da T2 (turma que começou 1 mês depois da T1) ----------
  // O 1º encontro oficial da T2 é a terça da semana corrente — as duplas
  // estão começando agora. É o caso que exercita o isolamento do semáforo:
  // medidas contra o calendário da T1 elas pareceriam atrasadas; contra o
  // próprio cronograma, estão saudáveis.

  // d-t2a · André × Kauã — o André tem capacidade 2 no mentor_profiles: com a
  // dupla do Pedro pausada, assumiu o Kauã na T2 (o encaixe de
  // empreendedorismo era bom demais pra esperar)
  const encT2a: Encontro[] = [
    // a terça já passou, o encontro rolou e tem registro; senão fica
    // agendado — a demo conta a mesma história em qualquer dia da semana
    e1T2Passou
      ? comRegistro(
          realizado(uid(D.t2a), 1, diaE1T2, { duracao: 75 }),
          andre, "Kauã", "dpp",
          {
            reflexoes:
              "Primeiro encontro da T2 — o Kauã chegou tímido mas se soltou quando o assunto foi a produção de doces da família. Leitura inicial da Roda da Vida feita; ele já enxerga o negócio como meta.",
            observacoes:
              "Combinado: o Kauã lista as pessoas pra avaliação por terceiros e pensa numa primeira meta pro negócio da família.",
          }
        )
      : agendado(uid(D.t2a), 1, diaE1T2, { link: MEET }),
    agendado(uid(D.t2a), 2, diaEncontroT2(2), {}),
  ];

  const duplaT2a: Dupla = {
    id: uid(D.t2a),
    turma: "T2 · 2026/2027",
    cronograma_id: cronogramaT2,
    status: "ativa",
    iniciada_em: inicioCicloT2,
    trilha: "dpp",
    demanda: null,
    solicitacao_id: null,
    mentor: andre,
    mentorado: kaua,
    supervisor: beatriz,
    encontros: encT2a,
    encaminhamentos: e1T2Passou
      ? [
          encaminhamento(uid(D.t2a), encT2a[0].registro!.id,
            "Listar 3 pessoas pra avaliação por terceiros e enviar o questionário",
            "mentorado", diaEncontroT2(2), "pendente"),
        ]
      : [],
    notas: [],
  };

  // d-t2b · Luiza × Laura — o "segundo ciclo" que a bio dela anuncia: depois
  // de concluir a jornada com a Isabela, voltou mentora na turma nova
  const encT2b: Encontro[] = [
    agendado(uid(D.t2b), 1, diaE1T2, { link: MEET }),
    agendado(uid(D.t2b), 2, diaEncontroT2(2), {}),
  ];

  const duplaT2b: Dupla = {
    id: uid(D.t2b),
    turma: "T2 · 2026/2027",
    cronograma_id: cronogramaT2,
    status: "ativa",
    iniciada_em: inicioCicloT2,
    trilha: "dpp",
    demanda: null,
    solicitacao_id: null,
    mentor: luiza,
    mentorado: laura,
    supervisor: paulo,
    encontros: encT2b,
    encaminhamentos: [],
    notas: [],
  };

  // d-t2c · Ricardo × Matheus — a SEGUNDA dupla DPP do híbrido (WP3). O
  // matching da T2 fechou no tema tecnologia/carreira e ele assumiu a 2ª
  // vaga da capacidade — a agenda do mentor DPP precisava de um 2º jovem
  // pra visão "Por mentorado" renderizar dois cards. A dupla começou ~2-3
  // semanas antes de hoje (matching entregue pronto pela ONG), então já
  // correu dois encontros: o 1º com registro entregue, o 2º realizado sem
  // registro (a pendência "Registro do encontro" deep-linkável que o
  // warnrow da Minha agenda aponta), o 3º agendado no passado sem registro
  // (limbo — exercita o "remarcar/não aconteceu") e o 4º já marcado pra
  // semana seguinte.
  const encT2c: Encontro[] = [
    comRegistro(
      realizado(uid(D.t2c), 1, addDias(HOJE, -14), { duracao: 75 }),
      ricardo, "Matheus", "dpp"
    ),
    realizado(uid(D.t2c), 2, addDias(HOJE, -6), { duracao: 60, origem: "externo" }),
    agendado(uid(D.t2c), 3, addDias(HOJE, -1), {}),
    // âncora na terça (não em HOJE+n): a segunda da próxima semana é
    // sempre segunda — com HOJE+n o dia varia com o dia da build e um
    // "agendado pra semana seguinte" podia cair no domingo da semana
    // corrente (o strip "Sua semana" contava ele como item próprio a mais)
    agendado(uid(D.t2c), 4, addDias(TERCA_ENCONTRO_5, 6), {}),
  ];

  const regT2cE1 = encT2c[0].registro!;

  const duplaT2c: Dupla = {
    id: uid(D.t2c),
    turma: "T2 · 2026/2027",
    cronograma_id: cronogramaT2,
    status: "ativa",
    iniciada_em: ymd(addDias(HOJE, -18)),
    trilha: "dpp",
    demanda: null,
    solicitacao_id: null,
    mentor: ricardo,
    mentorado: matheus,
    supervisor: paulo,
    encontros: encT2c,
    encaminhamentos: [
      encaminhamento(uid(D.t2c), regT2cE1.id,
        "Preencher a Roda da Vida e mandar foto antes do próximo encontro",
        "mentorado", addDias(HOJE, 4), "pendente"),
    ],
    notas: [],
  };

  const duplas = [duplaOk, duplaPend, duplaRisco, duplaAtraso, duplaFim, duplaRito, duplaEsp1, duplaEsp2, duplaEsp3, duplaEsp4, duplaPausa, duplaT2a, duplaT2b, duplaT2c];

  // ---------- devolutivas (WP6) ----------
  // Feed datado por trilha — a última entrega continua sendo o que marca a
  // conclusão (a devolutiva_pdm da dupla vira projeção desse feed). A trilha
  // concluída da Helena × Bia ganha as duas entregas do caminho; a da Sofia ×
  // Bia mostra o feed em andamento.
  const devolutivas: DemoDevolutiva[] = [
    {
      id: uid(0x6601),
      dupla_id: duplaEsp4.id,
      autor_id: helena.id,
      texto:
        "Meio da trilha: a Bia já fala 2 minutos sem notas e respira pausado. Próximo passo — responder pergunta de improviso sem travar.",
      created_at: haDias(16, "20:30"),
    },
    {
      id: uid(0x6602),
      dupla_id: duplaEsp4.id,
      autor_id: helena.id,
      texto: duplaEsp4.devolutiva_pdm ?? "",
      created_at: haDias(5, "19:00"),
    },
    {
      id: uid(0x6603),
      dupla_id: duplaEsp1.id,
      autor_id: sofia.id,
      texto:
        "Diagnóstico fechado: o buraco é fração e função. Roteiro de 5 sessões desenhado; se o ritmo segurar, sobra sessão pra revisão.",
      created_at: haDias(8, "21:00"),
    },
  ];

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
    {
      // encontro 4: um segundo registro com anexo — a seção "Arquivos da
      // dupla" mostra a agregação cruzando encontros
      id: uid(0x1603),
      registro_id: regD1E4.id,
      path: `${regD1E4.id}/${uid(0x1603)}-cronograma-enem.png`,
      nome: "cronograma-enem.png",
      tamanho: 921_600,
      mime: "image/png",
      created_by: ricardo.id,
      created_at: depoisDe(regD1E4.created_at, 1),
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
  // D5/WP5 — o "Para acompanhar" cobre os dois estados do lembrete (cap de
  // 48h por dupla, medido sobre o ÚLTIMO nudge — contato de outro tipo não
  //  destrava nem bloqueia):
  //  · pend (sem_data + registro): nudge de 5d atrás → livre, "Lembrar"
  //  · atraso (limbo):             nudge de 4d atrás → livre
  //  · risco (atraso):             nudge de ~20h     → bloqueado ("Lembrada")
  //  · t2c  (limbo na T2):         nudge de 6d atrás → livre, turma nova
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
    {
      dupla_id: uid(D.risco),
      tipo: "nudge",
      canal: "whatsapp",
      // ~20h atrás — dentro do cap de 48h em qualquer dia/hora de execução
      created_at: new Date(Date.now() - 20 * HORA_MS).toISOString(),
      autor: { nome: marina.nome },
    },
    {
      dupla_id: uid(D.t2c),
      tipo: "nudge",
      canal: "whatsapp",
      created_at: haDias(6, "10:30"),
      autor: { nome: marina.nome },
    },
  ];

  // ---------- catálogos ----------
  // (cicloEventos foi montado na seção de cronogramas — as duplas já
  //  precisavam dos ids lá em cima)

  // os 5 encontros do guia do especialista — verbatim da migration 0027
  const especialistaEventos: EspecialistaEvento[] = [
    { numero: 1, titulo: "Acolhimento, vínculo e identificação da demanda", foco: "Escuta das demandas e desafios do jovem; identificação do tema da mentoria considerando o PDM" },
    { numero: 2, titulo: "Orientação, proteção e aconselhamento", foco: "Fortalecimento da confiança; retomada das metas do PDM; consolidação da direção do processo" },
    { numero: 3, titulo: "Definição e alinhamento das metas", foco: "Metas SMART; primeiras aplicações práticas; registro no PDM" },
    { numero: 4, titulo: "Acompanhamento do plano de metas", foco: "Avanços no plano de metas e submetas; ajuste de estratégias; antecipação de obstáculos" },
    { numero: 5, titulo: "Encerramento, reflexão e celebração", foco: "Reflexão sobre aprendizados; desafios futuros; feedback do jovem; registro final no PDM" },
  ];

  // os 13 materiais do seed.sql verbatim — com uma diferença proposital:
  // dois materiais de encontro têm path (servidos como PDF placeholder pela
  // rota demo), senão a trilha de cobertura do /materiais (REALIZA-173) não
  // teria nenhuma célula "com material" pra exibir. Os demais continuam sem
  // destino e renderizam "em breve" — estado legítimo (materiais chegam ao
  // longo do ciclo)
  const materiais: Material[] = [
    { id: uid(0x2001), titulo: "Guia do Mentor DPP", descricao: "Metodologia completa: jornada, 16 encontros, instrumentos e templates.", tipo: "guia", url: null, path: "materiais/guia-dpp.pdf", audiencia: "dpp", encontro_num: null, ordem: 1 },
    { id: uid(0x2002), titulo: "Guia do Mentor Especialista", descricao: "Metodologia da mentoria com especialista: 5 encontros e cinco funções.", tipo: "guia", url: null, path: "materiais/guia-especialista.pdf", audiencia: "especialista", encontro_num: null, ordem: 2 },
    { id: uid(0x2003), titulo: "Mensagem de preparação do mentorado", descricao: "Modelo para enviar antes do 1º encontro: história de vida, Roda da Vida e contatos para avaliação.", tipo: "template", url: null, path: "materiais/preparacao-mentorado.pdf", audiencia: "dpp", encontro_num: 1, ordem: 10 },
    { id: uid(0x2004), titulo: "Instrumento: Construindo a sua Visão", descricao: "Tarefa individual entre o 1º e o 2º encontro; origina a Declaração de Visão.", tipo: "template", url: null, path: null, audiencia: "dpp", encontro_num: 1, ordem: 11 },
    { id: uid(0x2005), titulo: "Mensagem às pessoas indicadas", descricao: "Modelo de contato para a avaliação por terceiros (duas perguntas).", tipo: "template", url: null, path: null, audiencia: "dpp", encontro_num: 1, ordem: 12 },
    { id: uid(0x2006), titulo: "Consolidação da avaliação por terceiros", descricao: "Quadro para agrupar pontos fortes e de melhoria sem identificar quem respondeu.", tipo: "template", url: null, path: "materiais/consolidacao-avaliacao.pdf", audiencia: "dpp", encontro_num: 2, ordem: 13 },
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
        // 0084: a flag do registro da Fernanda abriu o CHA-000141 — o sino
        // aponta pro chamado, não mais pra ficha da dupla
        id: uid(0x3002),
        tipo: "chamado_aberto",
        titulo: "Chamado CHA-000141 aberto",
        corpo:
          "Fernanda marcou 'preciso de apoio' no registro do 2º encontro: participação da mentorada caiu e ela não consegue contato.",
        href: `/chamados?c=${uid(0x5829)}`,
        lida_em: null,
        created_at: depoisDe(regD3E2.created_at, 1),
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
      {
        // canal de segurança do jovem → CHA-000142 (urgência, sem login:
        // autor pela ficha do Caio). O sino aponta pro chamado — o caso
        // não se perde mais no meio dos registros
        id: uid(0x3005),
        tipo: "chamado_aberto",
        titulo: "Pedido de ajuda · CHA-000142",
        corpo:
          "Caio avaliou o 4º encontro com 2 estrelas e marcou 'preciso de ajuda'. Combinado do programa: responder em 1 dia útil.",
        href: `/chamados?c=${uid(0x582a)}`,
        lida_em: null,
        created_at: depoisDe(encD2[3].realizado_em!, 6),
      },
    ],
    supervisor: [
      {
        // a coord atribuiu o chamado de metodologia ao Paulo (persona
        // supervisor) — a notificação própria da atribuição
        id: uid(0x3010),
        tipo: "chamado_atribuido",
        titulo: "Chamado CHA-000145 com você",
        corpo: "Guia do encontro 7: adaptar o roteiro pra dupla online",
        href: `/chamados?c=${uid(0x582d)}`,
        lida_em: null,
        created_at: haDias(3, "11:06"),
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
      {
        // o supervisor do Carlos recebe o chamado do jovem igual recebia o
        // apoio_jovem — urgência da dupla supervisionada chega aos dois
        id: uid(0x3012),
        tipo: "chamado_aberto",
        titulo: "Pedido de ajuda · CHA-000142",
        corpo:
          "Caio marcou 'preciso de ajuda' na avaliação do 4º encontro. A coordenação foi notificada e encaminha o caso.",
        href: `/chamados?c=${uid(0x582a)}`,
        lida_em: null,
        created_at: depoisDe(encD2[3].realizado_em!, 6),
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
      {
        // a Marina respondeu o chamado de agenda do Ricardo (CHA-000143)
        id: uid(0x3023),
        tipo: "chamado_atualizacao",
        titulo: "Atualização no chamado CHA-000143",
        corpo: "Oi, Ricardo! Conversei com a Ana — quinta funciona pra ela. Pode remarcar os dois encontros.",
        href: `/chamados?c=${uid(0x582b)}`,
        lida_em: null,
        created_at: haDias(1, "10:05"),
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
      {
        // a devolutiva errada da Sofia foi resolvida (CHA-000136)
        id: uid(0x3033),
        tipo: "chamado_resolvido",
        titulo: "Chamado CHA-000136 resolvido",
        corpo: "Sua solicitação foi respondida pela equipe: Roteado certo — a devolutiva era da trilha DPP e seguiu pro Ricardo.",
        href: `/chamados?c=${uid(0x5824)}`,
        lida_em: null,
        created_at: haDias(4, "16:20"),
      },
    ],
    // a persona mentorada (card /demo → /jovem): o aviso 'todos' que a RLS
    // de comunicados entrega pra ela — href '/#avisos' ancora na seção da
    // home depois que o redirect do (app) devolve o mentorado pro /jovem
    mentorado: [
      {
        // WP6 — o sol_notificar da sugerir_especialista_mentor: avisa a Bia
        // que o Ricardo registrou a sugestão (mesmo instante da biaSug) e
        // leva direto pra página de especialistas confirmar/dispensar
        id: uid(0x3042),
        tipo: "sugestao_especialista",
        // texto espelha o sol_notificar da sugerir_especialista_mentor
        titulo: "Seu mentor sugeriu um especialista",
        corpo:
          "Ele registrou um tema pra você — confirme ou ajuste na página de especialistas.",
        href: "/jovem/especialistas",
        lida_em: null,
        created_at: haDias(0, "16:20"),
      },
      {
        id: uid(0x3040),
        tipo: "comunicado",
        titulo: "Encontro de formação dos jovens no sábado",
        corpo: "Turma: a formação dos mentorados é sábado às 10h, no Meet de sempre.",
        href: "/#avisos",
        lida_em: null,
        created_at: haDias(2, "18:00"),
      },
      {
        // o trigger que minta o link avisa o jovem logado (0071) — o href
        // aponta direto pro formulário público, igual à notificação real
        id: uid(0x3041),
        tipo: "avaliacao_pendente",
        titulo: "Como foi seu encontro?",
        corpo: "Conte em 1 minuto como foi. Pro seu mentor, a nota só aparece na média.",
        href: `/avaliar/demo-aval-${encD6[2].id.slice(-12)}`,
        lida_em: null,
        created_at: haDias(4, "21:00"),
      },
      {
        // WP6 — espelha a devolutiva 0x6603 da trilha Sofia × Bia (mesma
        // data do postar_devolutiva, que notifica na mesma transação)
        id: uid(0x3043),
        tipo: "devolutiva_especialista",
        titulo: "Nova devolutiva da trilha",
        corpo: "Sofia Nogueira registrou uma devolutiva pra você.",
        href: "/jovem/especialistas",
        lida_em: haDias(7, "09:00"),
        created_at: haDias(8, "21:00"),
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
    // dados_civis na ficha → pendência com "falta:" no checklist.
    // REALIZA-172: como ela não tem login (nenhuma persona aponta pra ela),
    // o token 0x3407 resolve 'outra_pessoa' pra QUALQUER papel demo — é o
    // token-fixture determinístico do ramo "Este link é de outra pessoa"
    { id: uid(0x3207), template_id: uid(0x3303), profile_id: null, mentorado_id: isabela.id,
      status: "pendente", dados_snapshot: null, token: uid(0x3407),
      token_expira_em: haDias(-28),
      assinatura_texto: null, assinado_em: null, ip: null, user_agent: null,
      hash_documento: null, created_by: marina.id, created_at: haDias(2, "11:31"),
      template: tplTermoMentorando },
    // Ana (persona mentorado): o termo dela saiu na mesma leva — pendente é
    // o que faz o card "Documentos" da home do /jovem ter o botão Assinar.
    // O link 0x3409 abre /assinar/<token> já no passo de dados+assinatura
    // (menor de idade: a autorização da mãe — 0x3203 — já está assinada)
    { id: uid(0x3209), template_id: uid(0x3303), profile_id: null, mentorado_id: ana.id,
      status: "pendente", dados_snapshot: null, token: uid(0x3409),
      token_expira_em: haDias(-28),
      assinatura_texto: null, assinado_em: null, ip: null, user_agent: null,
      hash_documento: null, created_by: marina.id, created_at: haDias(2, "11:32"),
      template: tplTermoMentorando },
    // Laura: a autorização foi emitida na mesma leva, mas a família nunca
    // abriu — o prazo venceu e o link morreu. Pendente com expira_em no
    // passado: a RPC faz o flip lazy pra 'expirado' no primeiro acesso e a
    // ficha já mostra o badge expirado (reemissão fica a um clique)
    { id: uid(0x3208), template_id: uid(0x3302), profile_id: null, mentorado_id: laura.id,
      status: "pendente", dados_snapshot: null, token: uid(0x3408),
      token_expira_em: haDias(10), // emitido há 40 dias, validade 30 → venceu há 10
      assinatura_texto: null, assinado_em: null, ip: null, user_agent: null,
      hash_documento: null, created_by: marina.id, created_at: haDias(40, "11:33"),
      template: tplAutorizacao },
  ];

  // ---------- documentos do intake (0054) ----------
  // RG/comprovante/currículo anexados pela coordenação na ficha da pessoa —
  // coord-only ponta a ponta (RLS + bucket). O path é simbólico: o download
  // em /api/documento?tipo=doc devolve o PDF placeholder da demo.
  const documentosPessoa: DocumentoPessoa[] = [
    { id: uid(0x4601), profile_id: marina.id, mentorado_id: null, tipo: "rg",
      path: "documentos/demo-rg-marina.pdf", nome: "rg-marina.pdf",
      created_by: marina.id, created_at: haDias(37, "09:05") },
    { id: uid(0x4602), profile_id: marina.id, mentorado_id: null, tipo: "comprovante_residencia",
      path: "documentos/demo-comprovante-marina.pdf", nome: "comprovante-marina.pdf",
      created_by: marina.id, created_at: haDias(37, "09:07") },
    { id: uid(0x4603), profile_id: ricardo.id, mentorado_id: null, tipo: "rg",
      path: "documentos/demo-rg-ricardo.pdf", nome: "rg-ricardo.pdf",
      created_by: marina.id, created_at: haDias(40, "14:22") },
    { id: uid(0x4604), profile_id: ricardo.id, mentorado_id: null, tipo: "curriculo",
      path: "documentos/demo-curriculo-ricardo.pdf", nome: "curriculo-ricardo.pdf",
      created_by: marina.id, created_at: haDias(40, "14:25") },
    { id: uid(0x4605), profile_id: null, mentorado_id: ana.id, tipo: "rg",
      path: "documentos/demo-rg-ana.pdf", nome: "rg-ana.pdf",
      created_by: marina.id, created_at: haDias(36, "10:40") },
    // Eduardo: o intake tem só o comprovante — combina com a autorização do
    // responsável ainda pendente (documento oficial, campo à parte)
    { id: uid(0x4606), profile_id: null, mentorado_id: eduardo.id, tipo: "comprovante_residencia",
      path: "documentos/demo-comprovante-eduardo.pdf", nome: "comprovante-eduardo.pdf",
      created_by: marina.id, created_at: haDias(6, "11:15") },
  ];

  // ---------- presenças na formação (0040) ----------

  // A formação é por TURMA (0061) — cada cronograma tem seus próprios
  // eventos 'formacao' e a chamada de um não cobre o outro. Quem responde a
  // cada chamada: os mentores com dupla naquele cronograma + os
  // especialistas — a trilha deles não tem cronograma próprio, então eles
  // formam junto de cada turma (DPP e especialista formam juntos).
  // História: chamada completa no 1º dia; no 2º o João Pedro faltou —
  // presente=false é a ausência explícita que explica o formacao_ok=false
  // dele no mentor_profiles (a sync do 0040 só acende a flag com cobertura
  // total). Os demais mentores ativos (dpp + especialista) foram nos dois
  // dias da turma deles.
  const mentoresAtivos = profiles.filter(
    (p) =>
      p.ativo && (p.role === "mentor_dpp" || p.role === "mentor_especialista")
  );
  const ehEspecialista = (profileId: string) =>
    mentorProfiles.find((mp) => mp.profile_id === profileId)?.tipo ===
    "especialista";
  const chamadaDe = (cronogramaId: string): Profile[] =>
    mentoresAtivos.filter(
      (p) =>
        duplas.some(
          (d) => d.cronograma_id === cronogramaId && d.mentor?.id === p.id
        ) || ehEspecialista(p.id)
    );
  let seqPres = 0;
  const presencas: Presenca[] = [cronogramaT1, cronogramaT2].flatMap((cid) =>
    cicloEventos
      .filter((e) => e.tipo === "formacao" && e.cronograma_id === cid)
      .flatMap((ev, diaIdx) =>
        chamadaDe(cid).map((p) => ({
          id: uid(0x3600 + ++seqPres),
          ciclo_evento_id: ev.id,
          profile_id: p.id,
          // a ausência do João Pedro é no 2º dia da T1 (a dupla dele é lá)
          presente: !(cid === cronogramaT1 && diaIdx === 1 && p.id === joaoPedro.id),
          marcado_por: marina.id, // a chamada é da coordenação
          // carimbo da noite do evento — como o trigger stamp_presenca faria
          marcado_em: em(new Date(`${ev.data}T12:00:00Z`), "20:30"),
        }))
      )
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
      // WP5 — domingo da semana corrente (seg–dom): dentro da janela da
      // "Consolidada" do auxiliar e da "Semana no programa" da coordenação,
      // e ≥ hoje pra entrar na agenda do mentor como sessão recebida ("Do
      // programa" filtra data >= hoje — qualquer dia do run cobre)
      data: ymd(addDias(HOJE, (7 - HOJE.getUTCDay()) % 7)),
      resumo:
        "Supervisão da semana com o Ricardo — a dupla engatou rápido: a Bia já fechou o PDM e entrou na execução das submetas. Ponto pra domingo: ela tende a abraçar metas demais — vale segurar uma submeta por vez e revisar o ritmo no registro semanal. Combinado de ele trazer as dúvidas de condução.",
      created_by: paulo.id,
      created_at: haDias(6, "18:40"),
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

  // ---------- avaliação do encontro FEITA PELO JOVEM (0071) ----------
  // Três canais distintos dos registros do mentor — a RLS real é replicada
  // nas queries demo: coord/sup leem tudo, o jovem as próprias, o mentor
  // DPP só a média em lote (e a avaliação solta quando a jovem libera), o
  // especialista só as estrelas das próprias sessões.
  //
  // História contada:
  // · duplaOk (Ricardo × Ana): 4 avaliações → média liberada em lote de 3
  //   (4,5★) com a 4ª esperando o próximo lote — a Ana liberou a 1ª pro
  //   Ricardo ler na íntegra. A 4ª veio pelo token (respondido_por null).
  // · duplaEsp1 (Sofia × Ana): enc 1 avaliado → a Sofia vê só a estrela.
  //   enc 2 SEM avaliação → pendência da persona mentorada no /jovem e o
  //   link pendente que a coord compartilha no WhatsApp.
  // · duplaPend (Carlos × Caio): 2★ com "preciso de ajuda" — a avaliação
  //   contesta o encontro (registro do mentor diz que rolou; a jovem diz
  //   que não). É o canal de disputa desenhado no D4 e empurra a dupla
  //   pro semáforo de risco por outro caminho.
  const avaliacoes: AvaliacaoEncontro[] = [
    {
      id: uid(0x4401), dupla_id: duplaOk.id, encontro_id: encD1[0].id,
      estrelas: 5, sentimento: "muito_bem", avancei: "sim",
      temas: ["pdm", "carreira"],
      comentario:
        "O Ricardo me ajudou a destravar o PDM — saí do encontro sabendo exatamente o próximo passo.",
      pedir_apoio: false, avaliacao_visivel_mentor: true,
      respondido_por_profile_id: anaLogin.id,
      created_at: depoisDe(encD1[0].realizado_em!, 3),
    },
    {
      id: uid(0x4402), dupla_id: duplaOk.id, encontro_id: encD1[1].id,
      estrelas: 4, sentimento: "bem", avancei: "sim",
      temas: ["estudos"], comentario: null,
      pedir_apoio: false, avaliacao_visivel_mentor: false,
      respondido_por_profile_id: anaLogin.id,
      created_at: depoisDe(encD1[1].realizado_em!, 2),
    },
    {
      id: uid(0x4403), dupla_id: duplaOk.id, encontro_id: encD1[2].id,
      estrelas: 5, sentimento: "muito_bem", avancei: "um_pouco",
      temas: ["pdm", "familia"],
      comentario:
        "Conversamos sobre encaixar as metas na rotina da casa. Ficou mais leve do que eu imaginava.",
      pedir_apoio: false, avaliacao_visivel_mentor: false,
      respondido_por_profile_id: anaLogin.id,
      created_at: depoisDe(encD1[2].realizado_em!, 4),
    },
    {
      // respondida pelo link do WhatsApp — respondido_por null, que é o
      // dado que diferencia "jovem logada" de "jovem sem login" pra coord
      id: uid(0x4404), dupla_id: duplaOk.id, encontro_id: encD1[3].id,
      estrelas: 4, sentimento: "bem", avancei: "sim",
      temas: ["carreira"], comentario: null,
      pedir_apoio: false, avaliacao_visivel_mentor: false,
      respondido_por_profile_id: null,
      created_at: depoisDe(encD1[3].realizado_em!, 30),
    },
    {
      id: uid(0x4405), dupla_id: duplaEsp1.id, encontro_id: encD6[0].id,
      estrelas: 5, sentimento: "muito_bem", avancei: "sim",
      temas: ["estudos"], comentario: null,
      pedir_apoio: false, avaliacao_visivel_mentor: false,
      respondido_por_profile_id: anaLogin.id,
      created_at: depoisDe(encD6[0].realizado_em!, 5),
    },
    {
      // O pedido de ajuda DO JOVEM — distinto do "preciso de apoio" que o
      // mentor marca no registro: chega por notificação própria, resolve
      // só na coordenação e empurra a dupla pro risco por caminho próprio
      id: uid(0x4406), dupla_id: duplaPend.id, encontro_id: encD2[3].id,
      estrelas: 2, sentimento: "desconfortavel", avancei: "nao",
      temas: ["familia"],
      comentario:
        "O encontro não rolou direito — a gente trocou o tema na hora e eu saí sem saber o que fazer da semana.",
      pedir_apoio: true, avaliacao_visivel_mentor: false,
      respondido_por_profile_id: null, // Caio não tem login — veio pelo token
      created_at: depoisDe(encD2[3].realizado_em!, 6),
    },
  ];

  // O trigger real minta um link por encontro realizado — a demo replica:
  // respondido onde existe avaliação, pendente enquanto válido (o link do
  // enc 2 da trilha da Sofia é o que a coord manda pra Ana) e expirado
  // nos realizados antigos sem resposta (a dupla concluída do ciclo
  // passado mostra o estado natural do funil).
  let seqLink = 0;
  const avaliacaoLinks: AvaliacaoLink[] = duplas.flatMap((d) =>
    (d.encontros ?? [])
      .filter((e) => e.status === "realizado")
      .map((e) => {
        const aval = avaliacoes.find((a) => a.encontro_id === e.id);
        const mintado = e.realizado_em ?? e.data_hora ?? "";
        const expiraEm = depoisDe(mintado, 60 * 24); // trigger: now()+60d
        return {
          id: uid(0x4200 + ++seqLink),
          // ≥20 chars alfanum+_-, no formato que a página pública valida
          token: `demo-aval-${e.id.slice(-12)}`,
          encontro_id: e.id,
          dupla_id: d.id,
          status: aval
            ? "respondido"
            : new Date(expiraEm) < new Date()
              ? "expirado"
              : "pendente",
          expira_em: expiraEm,
          respondido_em: aval?.created_at ?? null,
          // respondida logada carrega o profile; por token, null
          respondido_por_profile_id:
            (aval && aval.respondido_por_profile_id) ?? null,
          created_at: mintado,
        };
      })
  );

  // ---------- chamados unificados (0084) ----------
  // 8 casos cobrindo origem, categoria e estado — a fila da coordenação e
  // os "meus chamados" de mentor e jovem saem do mesmo dataset. Os dois
  // nascidos de flag têm a flag ainda acesa na origem (dual-run coerente).
  const ch = (o: Partial<Chamado> & Pick<Chamado, "numero" | "categoria" | "assunto" | "created_at">): Chamado => ({
    id: uid(0x5800 + parseInt(o.numero.slice(-3), 10) - 100),
    autor_id: null,
    autor_mentorado_id: null,
    dupla_id: null,
    descricao_outro: null,
    mensagem: null,
    status: "aberto",
    atribuido_a: null,
    origem: "manual",
    registro_id: null,
    avaliacao_id: null,
    updated_at: o.created_at,
    resolvido_em: null,
    resolvido_por: null,
    resolucao_resumo: null,
    ...o,
  });
  const chamados: Chamado[] = [
    // a fila pede um chamado por flag — o registro da Fernanda é o 0084 real
    ch({
      numero: "CHA-000141", categoria: "outro",
      descricao_outro: "Pedido de apoio marcado no registro do 2º encontro",
      assunto: "Pedido de apoio no registro — 2º encontro",
      mensagem: "Dandara faltou aos dois últimos combinados e responde pouco no WhatsApp — a mãe contou que ela voltou a trabalhar aos fins de semana.",
      autor_id: fernanda.id, dupla_id: duplaRisco.id, origem: "registro",
      registro_id: regD3E2.id,
      created_at: depoisDe(regD3E2.created_at, 1),
    }),
    // canal de segurança do jovem — Caio não tem login, autor pela ficha
    ch({
      numero: "CHA-000142", categoria: "urgencia",
      assunto: "Preciso de ajuda — avaliação do 4º encontro",
      mensagem: "O encontro não rolou direito — a gente trocou o tema na hora e eu saí sem saber o que fazer da semana.",
      autor_mentorado_id: caio.id, dupla_id: duplaPend.id,
      origem: "avaliacao_jovem", avaliacao_id: uid(0x4406),
      created_at: depoisDe(encD2[3].realizado_em!, 6),
    }),
    // mentor DPP pedindo ajuste de agenda — em atendimento com a Marina
    ch({
      numero: "CHA-000143", categoria: "agenda",
      assunto: "Trocar o encontro de terça pra quinta nas próximas duas semanas",
      mensagem: "Entrei num projeto no trabalho e terça virou dia de reunião até o fim do mês. A Ana topa quinta.",
      autor_id: ricardo.id, dupla_id: duplaOk.id,
      status: "em_atendimento", atribuido_a: marina.id,
      created_at: haDias(1, "09:12"),
    }),
    // jovem logada abrindo chamado de plataforma — pro auxiliar executivo a
    // linha aparece mascarada na fila (restrito à coordenação)
    ch({
      numero: "CHA-000144", categoria: "plataforma",
      assunto: "Não consigo anexar a foto do combinado",
      mensagem: "Quando escolho a foto no celular a tela fecha sozinha.",
      autor_id: anaLogin.id, autor_mentorado_id: ana.id, dupla_id: duplaOk.id,
      created_at: haDias(2, "14:40"),
    }),
    // coordenação abrindo em nome de — trilha metodologia com o Paulo
    ch({
      numero: "CHA-000145", categoria: "metodologia",
      assunto: "Guia do encontro 7: adaptar o roteiro pra dupla online",
      mensagem: "A Fernanda pediu sugestões — a dupla anda fazendo os encontros por vídeo.",
      autor_id: marina.id, dupla_id: duplaRisco.id,
      status: "em_atendimento", atribuido_a: paulo.id,
      created_at: haDias(3, "11:05"),
    }),
    // especialista com pedido resolvido — devolutiva PDM (outro + descrição)
    ch({
      numero: "CHA-000136", categoria: "outro", descricao_outro: "Devolutiva PDM",
      assunto: "Devolutiva do PDM chegou pro mentor errado",
      mensagem: "A devolutiva da sessão 3 caiu pra outra dupla — a Ana não é minha mentorada na trilha que conta.",
      autor_id: sofia.id, dupla_id: duplaEsp1.id,
      status: "resolvido", atribuido_a: marina.id,
      resolvido_em: haDias(4, "16:20"), resolvido_por: marina.id,
      resolucao_resumo: "Roteado certo — a devolutiva era da trilha DPP e seguiu pro Ricardo.",
      created_at: haDias(6, "10:15"),
    }),
    // urgência antiga resolvida — trilha completa pro autor ver
    ch({
      numero: "CHA-000129", categoria: "urgencia",
      assunto: "Fiquei sem contato com o Eduardo",
      mensagem: "Faz uma semana que ele não responde e faltou ao último encontro.",
      autor_id: joaoPedro.id, dupla_id: duplaAtraso.id,
      status: "resolvido", atribuido_a: marina.id,
      resolvido_em: haDias(12, "18:00"), resolvido_por: marina.id,
      resolucao_resumo: "A família confirmou a mudança de turno; a dupla repactuou o horário pros sábados.",
      created_at: haDias(15, "08:30"),
    }),
    // metodologia resolvida antiga — fim do funil na fila
    ch({
      numero: "CHA-000118", categoria: "metodologia",
      assunto: "O roteiro do encontro 4 não abria no app",
      mensagem: "O link do guia voltava pra lista de materiais.",
      autor_id: ricardo.id, dupla_id: duplaOk.id,
      status: "resolvido", atribuido_a: marina.id,
      resolvido_em: haDias(22, "09:00"), resolvido_por: marina.id,
      resolucao_resumo: "Era o link antigo do material — já corrigi na biblioteca.",
      created_at: haDias(24, "15:45"),
    }),
  ];
  const chamadoAtualizacoes: ChamadoAtualizacao[] = [
    { id: uid(0x6001), chamado_id: uid(0x5829), autor_id: null, tipo: "sistema",
      texto: "Chamado aberto automaticamente — o mentor marcou “preciso de apoio” no registro.",
      created_at: depoisDe(regD3E2.created_at, 1) },
    { id: uid(0x6002), chamado_id: uid(0x582a), autor_id: null, tipo: "sistema",
      texto: "Chamado aberto — a pessoa mentorada marcou “preciso de ajuda” na avaliação do encontro.",
      created_at: depoisDe(encD2[3].realizado_em!, 6) },
    { id: uid(0x6003), chamado_id: uid(0x582b), autor_id: null, tipo: "sistema",
      texto: "Chamado aberto por Ricardo Salles.", created_at: haDias(1, "09:12") },
    { id: uid(0x6004), chamado_id: uid(0x582b), autor_id: null, tipo: "sistema",
      texto: "Chamado assumido por Marina Duarte.", created_at: haDias(1, "10:02") },
    { id: uid(0x6005), chamado_id: uid(0x582b), autor_id: marina.id, tipo: "publica",
      texto: "Oi, Ricardo! Conversei com a Ana — quinta funciona pra ela. Pode remarcar os dois encontros.",
      created_at: haDias(1, "10:05") },
    { id: uid(0x6006), chamado_id: uid(0x582c), autor_id: null, tipo: "sistema",
      texto: "Chamado aberto por Ana Beatriz Silva.", created_at: haDias(2, "14:40") },
    { id: uid(0x6007), chamado_id: uid(0x5824), autor_id: null, tipo: "sistema",
      texto: "Chamado resolvido — Roteado certo — a devolutiva era da trilha DPP e seguiu pro Ricardo.",
      created_at: haDias(4, "16:20") },
    { id: uid(0x6008), chamado_id: uid(0x581d), autor_id: marina.id, tipo: "publica",
      texto: "Falamos com a família do Eduardo — ele mudou de turno no trabalho e os sábados passam a ser o melhor dia.",
      created_at: haDias(12, "17:30") },
    { id: uid(0x6009), chamado_id: uid(0x581d), autor_id: null, tipo: "sistema",
      texto: "Chamado resolvido — A família confirmou a mudança de turno; a dupla repactuou o horário pros sábados.",
      created_at: haDias(12, "18:00") },
  ];
  const chamadoComentarios: ChamadoComentario[] = [
    { id: uid(0x6201), chamado_id: uid(0x5829), autor_id: marina.id,
      texto: "@Beatriz esse cruza com o risco da dupla — faltas + apoio. Posso puxar as duas coisas juntas?",
      created_at: depoisDe(regD3E2.created_at, 5) },
    { id: uid(0x6202), chamado_id: uid(0x582a), autor_id: marina.id,
      texto: "Caso sensível — o comentário do Caio diz que o encontro não rolou como o registro marca. Vou falar com ele antes de abordar o Carlos.",
      created_at: depoisDe(encD2[3].realizado_em!, 8) },
    { id: uid(0x6203), chamado_id: uid(0x582b), autor_id: marina.id,
      texto: "Remarcação simples — só alinhar com a Ana e validar a agenda.",
      created_at: haDias(1, "10:03") },
  ];
  const chamadoAnexos: ChamadoAnexo[] = [
    { id: uid(0x6401), chamado_id: uid(0x582c),
      path: `${uid(0x582c)}/demo-print-anexo.png`, nome: "print-do-erro.png",
      tamanho: 184_320, mime: "image/png", interno: false,
      created_by: anaLogin.id, created_at: haDias(2, "14:45") },
  ];

  return {
    personas,
    profiles,
    mentorados,
    mentorProfiles,
    duplas,
    anexos,
    cronogramas,
    cicloEventos,
    especialistaEventos,
    especialistaGrade,
    especialistaExcecoes,
    profilePapeis,
    devolutivas,
    materiais,
    comunicados,
    solicitacoes,
    solicitacaoPropostas,
    pessoaNotas,
    interacoes,
    notificacoes,
    documentoTemplates,
    assinaturas,
    presencas,
    supervisoes,
    documentosPessoa,
    avaliacoes,
    avaliacaoLinks,
    turmaInscricoes,
    chamados,
    chamadoAtualizacoes,
    chamadoComentarios,
    chamadoAnexos,
  };
}

// montado uma vez por processo — o dataset é imutável durante a sessão demo
// (mutations retornam DEMO_MSG antes de chegar aqui). TTL de 6h: sem ele um
// server dev/preview de vida longa congela as âncoras relativas e "o nudge
// de ontem" vira semana passada — datas evergreen precisam expirar.
const DEMO_TTL_MS = 6 * 60 * 60 * 1000;
let cache: { at: number; data: DemoData } | null = null;

export function getDemoData(): DemoData {
  if (!cache || Date.now() - cache.at > DEMO_TTL_MS)
    cache = { at: Date.now(), data: build() };
  return cache.data;
}
