// Como conduzir (REALIZA-202) — módulo único de "o que o encontro cobre /
// como conduzir", extraído do GUIA_ENCONTRO da ficha da dupla
// (instrumentos-dupla.tsx) e expandido pras demais superfícies: agenda do
// mentor, detalhe do dia no calendário, grupos por encontro de /materiais
// e o card da semana do programa da coordenação.
//
// Dois níveis de copy, duas redações por papel:
//   - por INSTRUMENTO (GUIA_ENCONTRO): `chip` marca a janela do guia no
//     badge; `conduzir` é a voz do mentor (ação: o que fazer); `cobre` é a
//     voz da coordenação (o que o instrumento cobre na jornada);
//   - por ENCONTRO (ENCONTRO_GUIA): condensado do capítulo "Os 16
//     encontros" do Guia do Mentor DPP — fonte canônica do domínio —
//     com `conduzir` pra quem conduz e `cobre` pra quem monitora.
//     Existe pros 16 encontros oficiais, inclusive os que não mapeiam pra
//     instrumento de sistema (10, 11, 16): "o que o encontro cobre" existe
//     mesmo quando nenhum instrumento está em jogo.
//
// CONTRATO DAS FONTES (decisão REALIZA-202) — havia duas fontes
// concorrentes de "o que entra no encontro":
//   1. `ciclo_eventos.instrumentos` (DB): a lista curada do calendário
//      oficial — é a AUTORIDADE editorial do encontro (o que o guia
//      planejou pra aquele dia). Nomes como "Perguntas Eficazes",
//      "Escuta Ativa", "Feedback Construtivo" e "Papel de modelo" são
//      técnicas do guia sem instrumento de sistema — não viram entrada.
//   2. `ESTACOES` (jornada.ts): o modelo de JANELA da jornada — diz o que
//      está aberto/vigente pra dupla naquele nº (ex.: metas vivem no
//      enc. 2–3, a Roda formal no 12–14).
// `instrumentoDoEncontro` devolve a UNIÃO das duas: o evento nomeia o
// alvo editorial e a janela completa o que está em jogo (o enc. 3, por
// exemplo, nomeia "PDM + Modelo SMART" no DB mas a janela diz que
// Visão e Metas também estão abertas — e o título oficial é justamente
// "Declaração de Visão e metas SMART"). Quando o cronograma não tem a
// row ou a lista está vazia (cronograma encurtado/custom, demo), a
// janela responde sozinha — é o fallback documentado.
//
// Regras de uso:
//   - mentor lê `conduzir`; coord/auxiliar/supervisor lê `cobre`;
//   - encontro sem instrumento na união não mostra card de instrumento
//     (regra "não inventar"), mas `guiaDoEncontro(n).cobre` ainda existe —
//     é a superfície coord;
//   - trilha especialista fica fora: os 5 passos têm `foco` próprio
//     (passosDaTrilha) e não passam pelas janelas DPP — intencional;
//   - os textos são fiéis ao guia (docs/fontes/guia-dpp-pdf.txt, cap.
//     "Os 16 encontros") — não expandir com condução inventada.

import {
  INSTRUMENTOS_SISTEMA,
  type InstrumentoSistema,
} from "./forms/schema";
import { ESTACOES, SISTEMA_DA_ESTACAO, type EstacaoChave } from "./jornada";

/** Entrada de guia por instrumento — `chip` alimenta o badge da janela,
 *  `conduzir` o <details> do mentor e `cobre` a leitura da coordenação. */
export type GuiaInstrumento = {
  /** Rótulo curto da janela do guia ("Enc. 1–4") — vai pro Badge. */
  chip: string;
  /** Como conduzir — voz do mentor (ação). */
  conduzir: string;
  /** O que cobre — voz da coordenação (cobertura da jornada). */
  cobre: string;
};

/** Entrada de guia por encontro oficial (1–16) — as duas redações. */
export type GuiaEncontro = {
  /** O que o encontro trata — pra coord/auxiliar/supervisor. */
  cobre: string;
  /** Como conduzir o encontro — pro mentor. */
  conduzir: string;
};

/** Shape mínimo aceito como "cronograma" — cobre `CicloEvento` (DB),
 *  `PassoGuia` (ciclo.ts, sem `tipo`) e `EventoJornada` (jornada.ts).
 *  Quando `tipo` existe e não é "encontro" a row não casa; quando
 *  ausente (PassoGuia, já só-encontros) a row conta pelo `numero`. */
export type CronogramaEncontros = readonly {
  tipo?: string | null;
  numero: number | null;
  instrumentos?: string[] | null;
}[];

/** A janela do guia por instrumento (as mesmas âncoras de ESTACOES na lib
 *  de jornada) + a condução em uma frase + a cobertura pra coordenação.
 *  `chip`/`conduzir` são verbatim do GUIA_ENCONTRO original da ficha —
 *  o spec demo da ficha casa texto solto nesses campos, não reescrever. */
export const GUIA_ENCONTRO: Record<InstrumentoSistema, GuiaInstrumento> = {
  visao: {
    chip: "Enc. 1–4",
    conduzir:
      "Entregue no 1º encontro (a janela do guia vai até o 4º). O exercício pede imaginação: o jovem narra o “filme” da vida ideal e fecha com a Declaração de Visão — uma frase no futuro, com prazo. Releiam juntos no encontro seguinte: a frase é o topo do PDM.",
    cobre:
      "Janela dos encontros 1–4: o exercício de imaginação da vida ideal que vira a Declaração de Visão — o norte de toda a mentoria e o topo do PDM.",
  },
  metas: {
    chip: "Enc. 2–3",
    conduzir:
      "Da Declaração de Visão saem 3 a 5 metas, cada uma com o porquê escrito pelo jovem. Antes de fechar, revisem com o modelo SMART: específica, mensurável, alcançável, relevante e com prazo. A meta prioritária abre o PDM.",
    cobre:
      "Janela dos encontros 2–3: a Visão desdobrada em 3–5 metas, cada uma com o porquê do jovem e a checagem SMART — indicador de sucesso e prazo.",
  },
  pdm: {
    chip: "Construir 1–4 · revisão enc. 9",
    conduzir:
      "Documento vivo construído nos enc. 1–4: Visão no topo, metas com indicador de sucesso (IS) e prazo (P), depois o mapa de submetas — pra cada meta, “o que preciso fazer pra conseguir isso?”. Volta à mesa na revisão de meio de percurso (enc. 9).",
    cobre:
      "O documento central: construído nos encontros 1–4 (visão, metas com IS e prazo, mapa de submetas), acompanha a execução até o fim do ciclo e tem revisão formal de meio de percurso no encontro 9.",
  },
  roda_vida: {
    chip: "Leitura enc. 1 · aplicação enc. 12–14",
    conduzir:
      "Duas aplicações: a leitura inicial no enc. 1 — o ponto de partida — e a aplicação formal nos enc. 12–14, que se compara com a primeira. O jovem dá nota de 1 a 10 nas 16 áreas; o desenho vira a roda e orienta as metas das áreas prioritárias.",
    cobre:
      "Duas aplicações: leitura inicial no encontro 1 (o ponto de partida) e aplicação formal nos encontros 12–14, comparada com a primeira — as 16 áreas orientam as metas do plano de continuidade.",
  },
};

/** O que cada um dos 16 encontros oficiais trata e como conduzir —
 *  condensado do capítulo "Os 16 encontros" do Guia do Mentor DPP
 *  (docs/fontes/guia-dpp-pdf.txt). Cobertura completa proposital: enc.
 *  10/11 não têm instrumento de sistema e o 16 fecha com o 360º — a
 *  coordenação ainda precisa de "o que cobre" neles. Título/fase/data
 *  ficam em `ciclo_eventos` — não duplicar aqui. */
export const ENCONTRO_GUIA: Record<number, GuiaEncontro> = {
  1: {
    cobre:
      "Boas-vindas e acordos de convivência; leitura inicial da Roda da Vida; abertura do PDM (interesses, eventos significativos, autoavaliação). Sai com a tarefa da Declaração de Visão.",
    conduzir:
      "Apresentem-se e troquem histórias de vida — a sua com honestidade, inclusive os tropeços — e construam os acordos de convivência: respeito, confidencialidade e compromisso. Conversem sobre a Roda da Vida que o jovem preencheu: é a leitura inicial, não a aplicação formal. Abram o PDM com os três blocos de perguntas — interesses, eventos significativos e autoavaliação. Tarefa: ele faz o instrumento Construindo a sua Visão e traz a Declaração de Visão pronta.",
  },
  2: {
    cobre:
      "Devolutiva da avaliação por terceiros × autoavaliação; refinamento da Declaração de Visão; início da definição de metas.",
    conduzir:
      "Apresente os resultados consolidados da avaliação por terceiros, sempre preservando o anonimato de quem respondeu, e peça que o jovem os compare com a autoavaliação do encontro anterior. Depois revisem a Declaração de Visão que ele trouxe até ficar clara, inspiradora e com prazo — ela é o norte de toda a mentoria. Na sequência, oriente a criação de metas com as perguntas de foco: competências que já tem e que precisa adquirir, recursos que possui e que precisa obter, e o que precisa criar, aprender, melhorar ou eliminar. Tarefa: definir as metas sozinho, cada frase começando por um verbo de ação.",
  },
  3: {
    cobre:
      "Checagem SMART das metas com indicador de sucesso e prazo; registro de Visão + metas no PDM; ensino do desdobramento em submetas.",
    conduzir:
      "O jovem apresenta as metas que criou — se travou, retome os pontos que ele citou nas conversas (“você mencionou alguns pontos que precisava criar, aprender, melhorar ou eliminar… qual considera mais importante agora?”). Verifiquem cada meta pelo modelo SMART e acrescentem indicador de sucesso e prazo; registrem no PDM a Declaração de Visão e cada meta. Ao final, ensine o desdobramento: “o que eu preciso fazer para conseguir isso?” gera as submetas, nível a nível. Tarefa: desdobrar as metas em submetas com indicador e prazo.",
  },
  4: {
    cobre:
      "Validação da lógica do plano (submetas × metas × prazos) e compromisso de início da execução — fecha a construção do PDM.",
    conduzir:
      "Verifiquem se o plano fecha de forma lógica — se as submetas realmente levam às metas e se os prazos são realistas — e ajustem o que for preciso. Com o plano fechado, passem ao compromisso: por qual submeta ele começa e quando vocês avaliam os primeiros resultados. Se a execução travar, investigue com “o que impede você de colocar essa submeta em prática?” e “até que ponto o desdobramento foi suficiente?”. Este encontro fecha a construção do PDM — daqui em diante os encontros giram em torno da execução. Tarefa: iniciar as primeiras submetas combinadas.",
  },
  5: {
    cobre:
      "Primeiro acompanhamento formal da execução do PDM: avanços, dificuldades e ajustes das primeiras submetas.",
    conduzir:
      "Com o PDM em execução, este encontro abre o acompanhamento formal das ações planejadas. Conduza com escuta ativa, incentivando o jovem a compartilhar avanços, dificuldades e aprendizados das primeiras submetas. Com Perguntas Eficazes e Feedback Construtivo, ajude-o a identificar o que está funcionando e o que precisa de ajuste — o objetivo é reflexão e senso de responsabilidade sobre o próprio progresso.",
  },
  6: {
    cobre:
      "Superação de obstáculos da execução; suporte emocional e revisão do tamanho das submetas quando o obstáculo se repete.",
    conduzir:
      "Apoie o jovem na superação dos obstáculos encontrados na execução — inseguranças, autocríticas e desânimo são comuns nesta etapa e pedem sensibilidade e empatia. Exerça escuta e aconselhamento, oferecendo suporte emocional e reforçando a confiança dele nas próprias capacidades. Quando um obstáculo se repete, vale rever se a submeta está grande demais ou se falta um passo intermediário.",
  },
  7: {
    cobre:
      "Revisão e ajuste do PDM em execução: prazos, indicadores e desdobramentos.",
    conduzir:
      "Revisem juntos o andamento das submetas e ajustem o que for preciso: prazos, indicadores ou o próprio desdobramento — um PDM que não muda ao longo de seis meses provavelmente não está sendo usado. Atue como facilitador, com feedback construtivo sobre a clareza, a coerência e a viabilidade do planejado, estimulando pensamento crítico e autonomia.",
  },
  8: {
    cobre:
      "Monitoramento da execução e transferência progressiva da condução para o mentorado.",
    conduzir:
      "Retomem o mapa de metas e submetas e conversem sobre o que foi concluído desde o último encontro. Valorize o que avançou e trate o que não avançou sem julgamento — o foco é entender o que atrapalhou. Estimule o jovem a assumir progressivamente a condução: que ele traga a pauta, aponte o que quer discutir e proponha os próximos passos.",
  },
  9: {
    cobre:
      "Revisão de meio de percurso do PDM: progresso × visão inicial, conquistas e reformulação de estratégias.",
    conduzir:
      "Metade da jornada é um bom momento para olhar para trás. Analisem as metas atingidas, as submetas em andamento e os aprendizados gerados, comparando com a visão de futuro construída no início. Valorize as conquistas e, quando necessário, apoie a reformulação de estratégias para o plano continuar realista e motivador — é a revisão formal de meio de percurso do PDM.",
  },
  10: {
    cobre:
      "Aprofundamento do vínculo pelo papel modelar do mentor: exemplo, coerência e transparência.",
    conduzir:
      "Encontro de caráter relacional e simbólico: compartilhe experiências de vida, aprendizados e momentos de superação que possam inspirar o jovem — é o exercício do papel modelar, que ensina pelo exemplo, pela coerência e pela transparência. A troca fortalece o vínculo e mostra que mentor e mentorado aprendem mutuamente.",
  },
  11: {
    cobre:
      "Mapeamento e ampliação da rede de apoio do mentorado; conexões com comunidades e projetos sociais. Fecha com a tarefa de preenchimento da Roda da Vida.",
    conduzir:
      "Conversem sobre a rede de apoio do jovem: em quem ele pode contar e que portas ainda não foram exploradas. Sempre que possível, faça pontes — apresente pessoas, indique eventos, comunidades e oportunidades da sua área — e estimule a participação em projetos sociais do entorno (esporte, lazer, música e cultura). Ao final, apresente a Roda da Vida e deixe a tarefa de preenchimento em casa: a discussão ocupa os próximos encontros.",
  },
  12: {
    cobre:
      "Discussão da aplicação formal da Roda da Vida (notas × motivos por quadrante); sai com a tarefa de uma meta SMART por área.",
    conduzir:
      "Discutam os motivos que levaram a cada nota da Roda da Vida, quadrante por quadrante, ajudando o jovem a perceber áreas subestimadas ou superestimadas. Ao final, pergunte se ele está satisfeito com o retrato e o que gostaria de mudar — “que motivos você teria para agradecer o que tem em cada um desses quadrantes?” ajuda a reconhecer o que já existe. Tarefa: criar pelo menos uma meta SMART para cada uma das 16 áreas.",
  },
  13: {
    cobre:
      "Priorização das metas da Roda da Vida: prioridades do mentorado × áreas de menor pontuação.",
    conduzir:
      "Revisem as metas que ele elaborou para cada área, checando prazos e indicadores de sucesso. Em seguida, elejam juntos um subconjunto de metas a detalhar, contemplando as prioridades do jovem e as áreas de menor pontuação — elas reforçam que desenvolvimento profissional está ligado ao equilíbrio pessoal. Tarefa: desdobrar as metas escolhidas em submetas, no mesmo modelo do PDM.",
  },
  14: {
    cobre:
      "Consolidação do desdobramento da Roda em plano de continuidade pós-mentoria; síntese do processo.",
    conduzir:
      "Validem o mapa de metas e submetas que ele elaborou, ajustando prazos e indicadores. Organizem tudo num plano de continuidade que poderá ser seguido depois do fim da mentoria. É um momento de síntese: revisitem os aprendizados do PDM e conectem autoconhecimento, planejamento e execução vividos até aqui.",
  },
  15: {
    cobre:
      "Reflexão sobre a jornada e troca de feedback mútuo; o mentor apresenta a devolutiva final da evolução do mentorado.",
    conduzir:
      "Reflitam juntos sobre toda a jornada percorrida: incentive o jovem a reconhecer conquistas, aprendizagens e mudanças pessoais, e ofereça o seu feedback final sobre a evolução percebida, reforçando o senso de valor e de protagonismo dele. É também o momento da troca de feedback mútuo sobre o impacto da relação construída.",
  },
  16: {
    cobre:
      "Encerramento formal e celebração; revisão final do PDM e da Roda; preenchimento da avaliação final da mentoria (mentor e mentorado).",
    conduzir:
      "Celebrem o percurso e encerrem formalmente a mentoria: revisitem o PDM e a Roda da Vida destacando os avanços alcançados e as perspectivas para o futuro, e conversem sobre as necessidades futuras do jovem e a continuidade do autodesenvolvimento. É aqui que mentor e mentorado preenchem, cada um pelo seu link, a avaliação final da mentoria. Encerre em clima de reconhecimento e gratidão: agradeça a confiança, verbalize as qualidades que você percebeu e pergunte “pelo que você é grato(a) nesta jornada?”.",
  },
};

// ---------- resolução encontro → instrumento ----------

/** Nomes de `ciclo_eventos.instrumentos` → instrumento de sistema. O DB
 *  guarda os nomes editoriais do guia ("Construindo a sua Visão",
 *  "Roda da Vida (leitura inicial)"); a normalização tira acento e caixa.
 *  "Modelo SMART" NÃO mapeia pra `metas`: é a técnica de qualidade dentro
 *  das metas — quem diz que metas está em jogo num encontro é a janela
 *  (enc. 2–3), e mapeá-lo espalharia `metas` pelos enc. 12–14 onde o
 *  SMART reaparece pra metas da Roda. As avaliações finais (mentor e
 *  mentorado) são formulários de sistema mas não instrumentos da dupla. */
const NOME_INSTRUMENTO: Record<string, InstrumentoSistema> = {
  pdm: "pdm",
  "plano de desenvolvimento do mentorado": "pdm",
  "plano de desenvolvimento do mentorado (pdm)": "pdm",
  "construindo a sua visao": "visao",
  visao: "visao",
  "definindo minhas metas": "metas",
  metas: "metas",
  "roda da vida": "roda_vida",
  "roda da vida (leitura inicial)": "roda_vida",
  roda_vida: "roda_vida",
};

// estação → sistema vem do canônico SISTEMA_DA_ESTACAO (jornada.ts) —
// roda inicial e formal dividem `roda_vida`; avaliacao_encontro e
// avaliacao_360 não são instrumentos da dupla (sem entrada no mapa).

function normaNome(nome: string): string {
  return nome
    .normalize("NFD")
    .replace(/\p{M}+/gu, "")
    .trim()
    .toLocaleLowerCase("pt-BR");
}

/** Instrumentos nomeados pelo próprio evento do cronograma (autoridade
 *  editorial). Técnicas sem sistema saem filtradas. */
function doEvento(
  encontroNum: number,
  cronograma: CronogramaEncontros
): InstrumentoSistema[] {
  const ev = cronograma.find(
    (e) =>
      e.numero === encontroNum &&
      (e.tipo == null || e.tipo === "encontro")
  );
  if (!ev?.instrumentos?.length) return [];
  const out: InstrumentoSistema[] = [];
  for (const nome of ev.instrumentos) {
    const s = NOME_INSTRUMENTO[normaNome(nome)];
    if (s && !out.includes(s)) out.push(s);
  }
  return out;
}

/** Instrumentos cuja janela ESTACOES cobre o encontro (modelo de jornada). */
function daJanela(encontroNum: number): InstrumentoSistema[] {
  const out: InstrumentoSistema[] = [];
  for (const chave of Object.keys(ESTACOES) as EstacaoChave[]) {
    const est = ESTACOES[chave];
    if (encontroNum < est.encIni || encontroNum > est.encFim) continue;
    const s = SISTEMA_DA_ESTACAO[chave];
    if (s && !out.includes(s)) out.push(s);
  }
  return out;
}

/** Quais instrumentos de sistema um encontro cobre — a UNIÃO da lista
 *  editorial do evento (`ciclo_eventos.instrumentos`) com a janela da
 *  jornada (ESTACOES), na ordem canônica INSTRUMENTOS_SISTEMA. Sem a row
 *  ou com lista vazia/irreconhecível, a janela responde sozinha (fallback
 *  documentado). Vazio = nada a mostrar (regra "não inventar") — a copy
 *  por encontro de `guiaDoEncontro` ainda existe pra coordenação. */
export function instrumentoDoEncontro(
  encontroNum: number,
  cronograma: CronogramaEncontros = []
): InstrumentoSistema[] {
  const uniao = new Set<InstrumentoSistema>([
    ...doEvento(encontroNum, cronograma),
    ...daJanela(encontroNum),
  ]);
  return INSTRUMENTOS_SISTEMA.filter((s) => uniao.has(s));
}

/** Como conduzir (voz do mentor) do instrumento — null nunca: as 4
 *  chaves são o vocabulário fechado de INSTRUMENTOS_SISTEMA. */
export function conduzirDo(sistema: InstrumentoSistema): string {
  return GUIA_ENCONTRO[sistema].conduzir;
}

/** O que cobre (voz da coordenação) do instrumento. */
export function cobreDo(sistema: InstrumentoSistema): string {
  return GUIA_ENCONTRO[sistema].cobre;
}

/** As duas redações do encontro oficial (1–16) — null fora da trilha
 *  DPP canônica (cronograma estendido, especialista): o caller não
 *  renderiza (regra "não inventar"). */
export function guiaDoEncontro(encontroNum: number): GuiaEncontro | null {
  return ENCONTRO_GUIA[encontroNum] ?? null;
}
