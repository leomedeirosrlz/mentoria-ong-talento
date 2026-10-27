/*
 * Dataset demo da engine de formulários (migrações 0036 e 0042).
 *
 * Mesmo contrato de ./data: módulo puro (nada de next/* nem supabase),
 * evergreen — timestamps derivam de `new Date()`. Consumido pelas queries do
 * módulo de forms (src/lib/forms/queries.ts) quando o cookie demo_role está
 * ativo; como /formularios é coord-only, os dados só saem pro papel
 * "coordenacao".
 *
 * Além dos forms da coordenação, o dataset carrega os instrumentos oficiais
 * ainda vivos (avaliação 360º, trilha de especialista, intake e desfecho —
 * campos verbatim das migrations), com links e respostas que alimentam o
 * checklist de encerramento (360º) e o painel da jornada. A Anamnese Social
 * e a Autoavaliação do mentor saíram do programa na REALIZA-236.
 *
 * Os links apontam pras personas e mentorados reais do dataset (getDemoData)
 * — nomes e WhatsApp resolvem pelo id, então a tela de links exibe os mesmos
 * contatos que o resto da demo.
 */

import { getDemoData } from "./data";
import type { AppRole, Dupla } from "../types";
import type {
  Formulario,
  FormularioLink,
  FormularioResposta,
  RespostaValor,
} from "../forms/schema";
import type {
  Entrega360,
  EntregaJornada,
  EventoJornada,
  InstrumentoJornada,
  JovemJornadaDados,
  PainelJornadaLinha,
} from "../jornada";

const uid = (n: number): string =>
  `de000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

const DIA_MS = 24 * 3600 * 1000;
const HOJE = new Date();
/** Há n dias (ou daqui a n, com n negativo) — mesmo estilo de data.ts. */
const haDias = (n: number, hhmm = "10:00"): string =>
  new Date(
    `${new Date(HOJE.getTime() - n * DIA_MS).toISOString().slice(0, 10)}T${hhmm}:00-03:00`
  ).toISOString();

// tokens legíveis (≥20 chars, base64url) — fáceis de reconhecer na tela
export const DEMO_TOKENS = {
  ricardoAvaliacao: "demo-tok-avalia-ricardo-xx",
  carlosAvaliacao: "demo-tok-avalia-carlos-xxx",
  fernandaAvaliacao: "demo-tok-avalia-fernanda-x",
  joaoPedroAvaliacao: "demo-tok-avalia-joaopedro",
  genericoAvaliacao: "demo-tok-avalia-generico1",
  genericoInscricao: "demo-tok-inscric-generico",
  genericoInscricaoVivo: "demo-tok-inscric-vivo-000",
  // instrumentos oficiais (0042)
  luizaAvaliacao360: "demo-tok-360-luiza-oficial1",
  isabelaAvaliacao360: "demo-tok-360-isabela-oficia",
  ricardoAvaliacao360: "demo-tok-360-ricardo-ofici",
  // instrumentos da jornada (0080) — dupla Ricardo×Ana
  anaVisao: "demo-tok-visao-ana-00000001",
  anaMetas: "demo-tok-metas-ana-00000001",
  anaPdm: "demo-tok-pdm-ana-0000000001",
  anaRoda: "demo-tok-roda-ana-0000000001",
  eduardoVisao: "demo-tok-visao-eduardo-00001",
  eduardoRoda: "demo-tok-roda-eduardo-000001",
  // WP7 — o painel da jornada precisa de entregas nas outras duplas DPP:
  // a T2 em começo de ciclo (visão/roda inicial abertas, metas ainda
  // trancada) e a pausada com link vencido — cada estado na vitrine
  kauaVisao: "demo-tok-visao-kaua-0000001",
  kauaRoda: "demo-tok-roda-kaua-00000001",
  matheusVisao: "demo-tok-visao-matheus-0001",
  matheusRoda: "demo-tok-roda-matheus-00001",
  pedroVisao: "demo-tok-visao-pedro-0000001",
  dandaraVisao: "demo-tok-visao-dandara-00001",
  // avaliação geral da trilha de especialista (0104) — emitida no
  // fechamento; Helena responde pelo link (especialista logada)
  helenaAvaliacaoEsp: "demo-tok-avalesp-helena-0001",
} as const;

/** Metadados de upload do intake no dataset (mesma forma de
 *  FormularioAnexo em forms/queries — tipo local pra não criar ciclo). */
export type DemoFormularioAnexo = {
  id: string;
  link_id: string;
  campo_id: string;
  path: string;
  nome: string;
  tamanho: number;
  created_at: string;
};

export type DemoFormularios = {
  formularios: Formulario[];
  links: FormularioLink[];
  respostas: FormularioResposta[];
  anexos: DemoFormularioAnexo[];
};

/** Monta o trio formularios/links/respostas da demo. Os ids de destino e
 *  dupla vêm do dataset principal pra coerência total (trocar um nome em
 *  data.ts reflete aqui). */
export function getDemoFormularios(): DemoFormularios {
  const d = getDemoData();
  const porNome = (nome: string) =>
    d.profiles.find((p) => p.nome.startsWith(nome))!.id;
  const ment = (nome: string) =>
    d.mentorados.find((m) => m.nome.startsWith(nome))!.id;
  const duplaDe = (mentorNome: string, mentoradoNome: string) =>
    d.duplas.find(
      (x) => x.mentor?.id === porNome(mentorNome) && x.mentorado?.id === ment(mentoradoNome)
    )?.id ?? null;

  const marina = porNome("Marina");

  // ---------- 1. avaliação do encontro (ativa, com respostas) ----------
  const fAvaliacao: Formulario = {
    id: uid(0x4001),
    titulo: "Avaliação do encontro",
    descricao:
      "Conte pra gente como foi o encontro desta semana. Leva menos de 2 minutos e ajuda a coordenação a acompanhar a dupla.",
    campos: [
      { id: "nota", tipo: "escala_1_5", label: "Numa escala de 1 a 5, como foi o encontro?", obrigatorio: true },
      { id: "participou", tipo: "sim_nao", label: "O mentorado participou ativamente?", obrigatorio: true },
      {
        id: "destaques", tipo: "multi_select", label: "O que funcionou bem?",
        obrigatorio: false,
        opcoes: [
          "Conversa em profundidade",
          "Atividade do guia",
          "Planejamento dos próximos passos",
          "Conexão pessoal",
        ],
      },
      { id: "comentarios", tipo: "texto_longo", label: "Algo a destacar ou pedir de apoio?", obrigatorio: false },
    ],
    ativo: true,
    versao: 1,
    created_by: marina,
    created_at: haDias(12),
    updated_at: haDias(12),
  };

  // ---------- 2. inscrição (encerrada — cobre o estado inativo) ----------
  const fInscricao: Formulario = {
    id: uid(0x4003),
    titulo: "Inscrição · ciclo 2026/2027",
    descricao: "Formulário de inscrição de jovens pro ciclo 2026/2027 do programa.",
    campos: [
      { id: "nome", tipo: "texto", label: "Nome completo", obrigatorio: true },
      { id: "whatsapp", tipo: "texto", label: "WhatsApp com DDD", obrigatorio: true, formato: "telefone" },
      {
        id: "origem", tipo: "select", label: "Como conheceu o programa?",
        obrigatorio: true,
        opcoes: ["ONG parceira", "Escola", "Indicação", "Redes sociais"],
      },
      { id: "motivacao", tipo: "texto_longo", label: "Por que quer participar?", obrigatorio: false },
    ],
    ativo: false,
    versao: 1,
    created_by: marina,
    created_at: haDias(200),
    updated_at: haDias(60),
  };

  // ---------- 4-6. instrumentos oficiais (0042 — campos verbatim da
  // migration; created_by null porque nasceram por SQL versionado) ----------

  // avaliação final do mentorado (REALIZA-230, 0130) — é ela que ocupa a
  // estação do encontro 16 (o slot `avaliacao_360` da jornada/painel)
  const fAvaliacaoFinalMentorado: Formulario = {
    id: uid(0x4005),
    titulo: "Avaliação final da mentoria · mentorado",
    descricao:
      "O fechamento da jornada pelo lado do jovem: expectativas, processo, o mentor, o impacto percebido e o depoimento. A coordenação envia o link no encerramento da dupla.",
    sistema: "avaliacao_final_mentorado",
    campos: [
      { id: "sec_expectativas", tipo: "secao", label: "Atingimento das expectativas", obrigatorio: false },
      { id: "expectativa_atendida", tipo: "escala_1_5", label: "Em uma escala de 1 a 5, o quanto a mentoria atendeu às suas expectativas?", obrigatorio: true },
      {
        id: "expectativas", tipo: "multi_select", label: "O que você esperava alcançar na mentoria?", obrigatorio: true,
        opcoes: ["Desenvolvimento profissional", "Melhorar habilidades técnicas", "Aumentar networking", "Obter insights sobre o mercado"],
        permite_outro: true,
      },
      { id: "sec_processo", tipo: "secao", label: "Avaliação do processo de mentoria", obrigatorio: false },
      {
        id: "estrutura_programa", tipo: "select", label: "Como você avalia a estrutura do programa de mentoria?", obrigatorio: true,
        opcoes: ["Excelente", "Boa", "Regular", "Ruim", "Péssima"],
      },
      {
        id: "aspectos_uteis", tipo: "multi_select", label: "Quais aspectos da mentoria você considerou mais úteis?", obrigatorio: true,
        opcoes: ["Sessões individuais com o mentor", "Materiais de apoio fornecidos", "Exercícios práticos", "Feedback recebido", "Troca de experiências com outros mentorados"],
      },
      {
        id: "melhorar_opcoes", tipo: "multi_select", label: "O que poderia ser melhorado na mentoria?", obrigatorio: true,
        opcoes: ["Frequência dos encontros", "Maior clareza nos objetivos da mentoria", "Melhor comunicação com o mentor", "Inclusão de conteúdos mais práticos"],
        permite_outro: true,
      },
      { id: "sec_mentor", tipo: "secao", label: "Avaliação do mentor", obrigatorio: false },
      {
        id: "avaliacao_mentor", tipo: "select", label: "Como você avalia a comunicação e o suporte do seu mentor?", obrigatorio: true,
        opcoes: ["Excelente", "Boa", "Regular", "Ruim", "Péssima"],
      },
      {
        id: "mentor_ajudou", tipo: "select", label: "O mentor ajudou a esclarecer suas dúvidas e a desenvolver suas habilidades?", obrigatorio: true,
        opcoes: ["Sim", "Parcialmente", "Não"],
      },
      {
        id: "recomendaria_mentor", tipo: "select", label: "Você recomendaria este mentor para outros mentorados?", obrigatorio: true,
        opcoes: ["Sim", "Não"],
      },
      { id: "sec_impacto", tipo: "secao", label: "Impacto e mudanças realizadas", obrigatorio: false },
      { id: "mudancas_realizadas", tipo: "sim_nao", label: "Você realizou mudanças na sua vida profissional ou pessoal por causa da mentoria?", obrigatorio: true },
      {
        id: "quais_mudancas", tipo: "multi_select", label: "Se sim, quais mudanças você realizou?", obrigatorio: true,
        opcoes: ["Mudei minha forma de buscar emprego ou oportunidades", "Aprimorei minhas habilidades profissionais", "Consegui um novo emprego ou promoção", "Ampliei meu networking"],
        permite_outro: true,
        visible_if: { campo: "mudancas_realizadas", em: ["sim"] },
      },
      {
        id: "mais_preparado", tipo: "select", label: "Você se sente mais preparado para enfrentar desafios depois da mentoria?", obrigatorio: true,
        opcoes: ["Sim", "Parcialmente", "Não"],
      },
      { id: "sec_criticas", tipo: "secao", label: "Críticas e sugestões", obrigatorio: false },
      {
        id: "melhorias_programa", tipo: "multi_select", label: "Quais pontos podem ser melhorados no programa de mentoria?", obrigatorio: true,
        opcoes: ["Melhor estruturação dos encontros", "Maior diversidade de mentores", "Mais materiais complementares", "Melhor acompanhamento do progresso"],
        permite_outro: true,
      },
      { id: "sec_depoimento", tipo: "secao", label: "Depoimento final", obrigatorio: false },
      { id: "depoimento_texto", tipo: "texto_longo", label: "Você gostaria de deixar um depoimento sobre sua experiência?", obrigatorio: true },
      {
        id: "depoimento", tipo: "select", label: "Podemos divulgar seu depoimento em nossos materiais de comunicação?", obrigatorio: true,
        opcoes: ["Sim, com meu nome", "Sim, mas de forma anônima", "Não"],
      },
    ],
    ativo: true,
    versao: 1,
    created_by: null,
    created_at: haDias(240, "09:00"),
    updated_at: haDias(240, "09:00"),
  };

  // avaliação final do mentor (o outro lado da 0130) — mora na prateleira
  // "Instrumentos do sistema"; a resposta dele aparece na ficha da dupla
  const fAvaliacaoFinalMentor: Formulario = {
    id: uid(0x400e),
    titulo: "Avaliação final da mentoria · mentor",
    descricao:
      "O fechamento da jornada pelo lado de quem mentora: estrutura e processo, dificuldades, suporte do Realiza.vc, continuidade e depoimento.",
    sistema: "avaliacao_final_mentor",
    campos: [
      { id: "sec_processo", tipo: "secao", label: "Avaliação do processo de mentoria", obrigatorio: false },
      {
        id: "estrutura_programa", tipo: "select", label: "Como você avalia a estrutura do programa de mentoria?", obrigatorio: true,
        opcoes: ["Excelente", "Boa", "Regular", "Ruim", "Péssima"],
      },
      { id: "melhorar_processo", tipo: "texto_longo", label: "Você acha que tem algo que poderia ser melhorado no processo de mentoria?", obrigatorio: true },
      { id: "dificuldade_material", tipo: "texto_longo", label: "Seu mentorado teve dificuldades ligadas a questões materiais para participar da mentoria (acesso a computadores, internet, local com privacidade)? Se sim, especifique.", obrigatorio: true },
      { id: "dificuldade_agenda", tipo: "texto_longo", label: "Você teve dificuldades de agendar horários ou realizar os encontros com seu mentorado? Se sim, descreva os principais motivos.", obrigatorio: true },
      { id: "dificuldade_metodologia", tipo: "texto_longo", label: "Você sentiu dificuldade em realizar alguma parte específica da metodologia com seu mentorado? Se sim, conte a respeito.", obrigatorio: true },
      { id: "instrumentos_problematicos", tipo: "texto_longo", label: "Algum dos instrumentos ou atividades da metodologia se mostrou problemático, ou foi difícil fazer o mentorado chegar a uma resposta a contento? Se sim, conte mais.", obrigatorio: true },
      { id: "melhorias_metodologia", tipo: "texto_longo", label: "Tem algum outro aspecto da metodologia que não funcionou bem ou que pode ser aprimorado?", obrigatorio: true },
      { id: "sec_suporte", tipo: "secao", label: "Suporte do Realiza.vc", obrigatorio: false },
      {
        id: "avaliacao_suporte", tipo: "select", label: "Como você avalia o suporte recebido do Realiza.vc ao longo do ciclo?", obrigatorio: true,
        opcoes: ["Excelente", "Boa", "Regular", "Ruim", "Péssima"],
      },
      { id: "sugestao_suporte", tipo: "texto_longo", label: "Tem algum suporte ou atividade que você considera importante o Realiza disponibilizar ou aprimorar?", obrigatorio: true },
      { id: "sec_mentoria", tipo: "secao", label: "A mentoria", obrigatorio: false },
      { id: "dificuldades_mentoria", tipo: "texto_longo", label: "Quais foram as principais dificuldades e desafios enfrentados na mentoria?", obrigatorio: true },
      { id: "consideracoes", tipo: "texto_longo", label: "Espaço livre para considerações e sugestões sobre a metodologia, o programa, o instituto — o que desejar.", obrigatorio: false },
      { id: "sec_continuidade", tipo: "secao", label: "Próximo ciclo", obrigatorio: false },
      { id: "continua_proximo_ciclo", tipo: "sim_nao", label: "Você quer continuar como mentor ou mentora no próximo ciclo?", obrigatorio: true },
      { id: "sec_espaco_mentor", tipo: "secao", label: "Espaço do mentor", obrigatorio: false },
      { id: "comentarios_mentorado", tipo: "texto_longo", label: "Compartilhe seus comentários sobre o mentorado.", obrigatorio: false },
      { id: "experiencia_processo", tipo: "texto_longo", label: "Compartilhe sua experiência com o processo, críticas e sugestões.", obrigatorio: false },
      { id: "sec_depoimento", tipo: "secao", label: "Depoimento", obrigatorio: false },
      {
        id: "depoimento", tipo: "select", label: "Podemos divulgar seu depoimento em nossos materiais de comunicação?", obrigatorio: true,
        opcoes: ["Sim, com meu nome", "Sim, mas de forma anônima", "Não"],
      },
    ],
    ativo: true,
    versao: 1,
    created_by: null,
    created_at: haDias(240, "09:00"),
    updated_at: haDias(240, "09:00"),
  };

  // ---------- 7-10. instrumentos da jornada (0080 — campos verbatim da
  // migration; a 'secao' antes de um grupo de escala_1_10 é o quadrante da
  // roda e meta_N/is_N/prazo_N/porque_N é a convenção estruturante) ----------

  const fVisao: Formulario = {
    id: uid(0x4007),
    titulo: "Construindo a sua Visão",
    descricao:
      "Exercício de imaginação e projeção entregue ao(à) jovem ao final do primeiro encontro (guia DPP §5): o \"filme\" da vida ideal vira a Declaração de Visão, o norte de toda a mentoria.",
    sistema: "visao",
    campos: [
      { id: "s_antes", tipo: "secao", label: "Antes de responder", obrigatorio: false, descricao: "Acomode-se com conforto e respire fundo algumas vezes, até se sentir tranquilo(a). Agora imagine um filme em que você é o personagem principal, vivendo a situação ideal que sonha para a sua vida pessoal e profissional." },
      { id: "filme", tipo: "texto_longo", label: "Descreva o que está acontecendo com você nessa situação ideal. Narre as cenas desse filme.", obrigatorio: true },
      { id: "aspectos", tipo: "texto_longo", label: "Quais são os aspectos mais significativos dessa situação ideal?", obrigatorio: true },
      { id: "ser_fazer", tipo: "texto_longo", label: "Nessa situação, o que você está conseguindo ser ou fazer que tanto desejava?", obrigatorio: true },
      { id: "deixou", tipo: "texto_longo", label: "O que você deixou de fazer, ou o que não está mais acontecendo, que tanto lhe desagradava?", obrigatorio: true },
      { id: "valoriza", tipo: "texto_longo", label: "O que você mais valoriza nessa situação ideal?", obrigatorio: true },
      { id: "s_declaracao", tipo: "secao", label: "Sua Declaração de Visão", obrigatorio: false, descricao: "Uma frase que resuma o que você deseja ser, alcançar ou conquistar. Comece por um verbo no futuro e inclua um prazo." },
      { id: "declaracao_visao", tipo: "texto_longo", label: "Minha Declaração de Visão", obrigatorio: true },
    ],
    ativo: true,
    versao: 1,
    created_by: null,
    created_at: haDias(240, "09:00"),
    updated_at: haDias(240, "09:00"),
  };

  // shape pós-0118 do oficial: o desdobramento (submetas_N) acompanha
  // cada meta e o fechamento de revisão saiu do template na 0109 — as
  // respostas antigas ainda guardam rev_*/meta_principal no snapshot
  const fMetas: Formulario = {
    id: uid(0x4008),
    titulo: "Definindo Minhas Metas",
    descricao:
      "Template do mentorado da sequência da Visão (PDF oficial): da Declaração de Visão para 3 a 5 metas com o porquê de cada uma e o desdobramento em submetas — a dupla revisa no encontro seguinte com o modelo SMART.",
    sistema: "metas",
    campos: [
      { id: "s_visao", tipo: "secao", label: "Minha visão de futuro", obrigatorio: false, descricao: "No encontro anterior você construiu sua Declaração de Visão. Agora o passo é pensar: quais conquistas preciso alcançar para tornar essa visão realidade?" },
      { id: "declaracao_visao", tipo: "texto_longo", label: "Minha Declaração de Visão (copie ou reescreva a frase que você criou)", obrigatorio: true },
      { id: "preciso_criar", tipo: "texto", label: "Para me aproximar da minha visão, o que eu preciso CRIAR?", obrigatorio: false },
      { id: "preciso_aprender", tipo: "texto", label: "O que eu preciso APRENDER?", obrigatorio: false },
      { id: "preciso_melhorar", tipo: "texto", label: "O que eu preciso MELHORAR?", obrigatorio: false },
      { id: "preciso_eliminar", tipo: "texto", label: "O que eu preciso ELIMINAR?", obrigatorio: false },
      { id: "s_metas", tipo: "secao", label: "Minhas metas", obrigatorio: false, descricao: "Preencha de 3 a 5 metas, da mais importante pra menos importante. Dica: comece cada meta com um verbo de ação. Se já souber os primeiros passos de uma meta, anote no desdobramento — uma submeta por linha." },
      { id: "meta_1", tipo: "texto", label: "Minha meta 1 (a mais importante)", obrigatorio: true },
      { id: "porque_1", tipo: "texto_longo", label: "Por que a meta 1 é importante pra mim?", obrigatorio: true },
      { id: "submetas_1", tipo: "texto_longo", label: "Desdobramento — submetas (uma por linha)", obrigatorio: false },
      { id: "meta_2", tipo: "texto", label: "Minha meta 2", obrigatorio: true },
      { id: "porque_2", tipo: "texto_longo", label: "Por que a meta 2 é importante pra mim?", obrigatorio: true },
      { id: "submetas_2", tipo: "texto_longo", label: "Desdobramento — submetas (uma por linha)", obrigatorio: false },
      { id: "meta_3", tipo: "texto", label: "Minha meta 3", obrigatorio: true },
      { id: "porque_3", tipo: "texto_longo", label: "Por que a meta 3 é importante pra mim?", obrigatorio: true },
      { id: "submetas_3", tipo: "texto_longo", label: "Desdobramento — submetas (uma por linha)", obrigatorio: false },
      { id: "meta_4", tipo: "texto", label: "Minha meta 4", obrigatorio: false },
      { id: "porque_4", tipo: "texto_longo", label: "Por que a meta 4 é importante pra mim?", obrigatorio: false },
      { id: "submetas_4", tipo: "texto_longo", label: "Desdobramento — submetas (uma por linha)", obrigatorio: false },
      { id: "meta_5", tipo: "texto", label: "Minha meta 5", obrigatorio: false },
      { id: "porque_5", tipo: "texto_longo", label: "Por que a meta 5 é importante pra mim?", obrigatorio: false },
      { id: "submetas_5", tipo: "texto_longo", label: "Desdobramento — submetas (uma por linha)", obrigatorio: false },
    ],
    ativo: true,
    versao: 1,
    created_by: null,
    created_at: haDias(240, "09:00"),
    updated_at: haDias(240, "09:00"),
  };

  const fPdm: Formulario = {
    id: uid(0x4009),
    titulo: "Plano de Desenvolvimento do Mentorado (PDM)",
    descricao:
      "O documento central da mentoria (guia DPP §6): a Declaração de Visão com as três metas principais — cada uma com indicador de sucesso (IS) e prazo (P) — e o mapa de desdobramento em submetas.",
    sistema: "pdm",
    campos: [
      { id: "s_visao", tipo: "secao", label: "Visão e metas", obrigatorio: false, descricao: "O norte da mentoria: a Declaração de Visão e as metas principais. Cada meta leva um indicador de sucesso (IS) e um prazo (P)." },
      { id: "declaracao_visao", tipo: "texto_longo", label: "Declaração de Visão", obrigatorio: true },
      { id: "meta_1", tipo: "texto", label: "Meta 1", obrigatorio: true },
      { id: "is_1", tipo: "texto", label: "Indicador de sucesso (IS) da meta 1", obrigatorio: true },
      { id: "prazo_1", tipo: "data", label: "Prazo (P) da meta 1", obrigatorio: true },
      { id: "meta_2", tipo: "texto", label: "Meta 2", obrigatorio: false },
      { id: "is_2", tipo: "texto", label: "Indicador de sucesso (IS) da meta 2", obrigatorio: false },
      { id: "prazo_2", tipo: "data", label: "Prazo (P) da meta 2", obrigatorio: false },
      { id: "meta_3", tipo: "texto", label: "Meta 3", obrigatorio: false },
      { id: "is_3", tipo: "texto", label: "Indicador de sucesso (IS) da meta 3", obrigatorio: false },
      { id: "prazo_3", tipo: "data", label: "Prazo (P) da meta 3", obrigatorio: false },
      { id: "s_submetas", tipo: "secao", label: "Mapa de submetas", obrigatorio: false, descricao: "Para cada meta, pergunte \"o que eu preciso fazer para conseguir isso?\". As respostas são as submetas." },
      { id: "submetas_1", tipo: "texto_longo", label: "Desdobramento da meta 1 (submetas, indicadores e prazos)", obrigatorio: false },
      { id: "submetas_2", tipo: "texto_longo", label: "Desdobramento da meta 2", obrigatorio: false },
      { id: "submetas_3", tipo: "texto_longo", label: "Desdobramento da meta 3", obrigatorio: false },
    ],
    ativo: true,
    versao: 1,
    created_by: null,
    created_at: haDias(240, "09:00"),
    updated_at: haDias(240, "09:00"),
  };

  const fRodaVida: Formulario = {
    id: uid(0x400a),
    titulo: "Roda da Vida",
    descricao:
      "Aplicada a partir do 5º mês (guia DPP §8): de 1 a 10, o grau de satisfação do(a) jovem em cada uma das 16 áreas da vida, nos quatro quadrantes. O desenho das notas vira a roda.",
    sistema: "roda_vida",
    campos: [
      { id: "s_como", tipo: "secao", label: "Como funciona", obrigatorio: false, descricao: "De 1 a 10, qual é o seu grau de satisfação com cada área da sua vida neste momento? Não existe resposta certa." },
      { id: "s_pessoal", tipo: "secao", label: "Pessoal", obrigatorio: false },
      { id: "p_saude", tipo: "escala_1_10", label: "Saúde e disposição", obrigatorio: true },
      { id: "p_intelecto", tipo: "escala_1_10", label: "Intelecto e cultura", obrigatorio: true },
      { id: "p_equilibrio", tipo: "escala_1_10", label: "Equilíbrio emocional", obrigatorio: true },
      { id: "p_independencia", tipo: "escala_1_10", label: "Independência", obrigatorio: true },
      { id: "s_profissional", tipo: "secao", label: "Profissional", obrigatorio: false },
      { id: "pr_carreira", tipo: "escala_1_10", label: "Carreira e trabalho", obrigatorio: true },
      { id: "pr_financas", tipo: "escala_1_10", label: "Finanças", obrigatorio: true },
      { id: "pr_escola", tipo: "escala_1_10", label: "Escola / universidade", obrigatorio: true },
      { id: "pr_contribuicao", tipo: "escala_1_10", label: "Contribuição social", obrigatorio: true },
      { id: "s_relacionamentos", tipo: "secao", label: "Relacionamentos", obrigatorio: false },
      { id: "r_familia", tipo: "escala_1_10", label: "Família", obrigatorio: true },
      { id: "r_amigos", tipo: "escala_1_10", label: "Amigos", obrigatorio: true },
      { id: "r_amoroso", tipo: "escala_1_10", label: "Relacionamento amoroso", obrigatorio: true },
      { id: "r_social", tipo: "escala_1_10", label: "Vida social", obrigatorio: true },
      { id: "s_qualidade", tipo: "secao", label: "Qualidade de vida", obrigatorio: false },
      { id: "q_hobbies", tipo: "escala_1_10", label: "Hobbies e diversão", obrigatorio: true },
      { id: "q_atividade", tipo: "escala_1_10", label: "Atividade física", obrigatorio: true },
      { id: "q_realizacao", tipo: "escala_1_10", label: "Realização e felicidade", obrigatorio: true },
      { id: "q_espiritualidade", tipo: "escala_1_10", label: "Espiritualidade", obrigatorio: true },
      { id: "reflexao", tipo: "texto_longo", label: "Olhando pra sua roda: quais áreas você mais gostaria de melhorar? Por quê?", obrigatorio: true },
    ],
    ativo: true,
    versao: 1,
    created_by: null,
    created_at: haDias(240, "09:00"),
    updated_at: haDias(240, "09:00"),
  };

  // ---------- 11. avaliação geral da trilha de especialista (0104 —
  // campos verbatim da migration; emitida sozinha no fechamento da
  // trilha, respondida pelo especialista logado) ----------

  const fAvaliacaoEsp: Formulario = {
    id: uid(0x400b),
    titulo: "Avaliação geral da trilha de especialista",
    descricao:
      "A avaliação final do guia do especialista (§13), respondida ao concluir o acompanhamento de um(a) jovem: como foi a trilha e percepções sobre o programa e o trabalho da coordenação.",
    sistema: "avaliacao_especialista",
    campos: [
      { id: "s1", tipo: "secao", label: "A trilha", obrigatorio: false },
      { id: "experiencia", tipo: "escala_1_5", label: "No geral, como você avalia a experiência desta mentoria especialista?", obrigatorio: true },
      { id: "atendeu_demanda", tipo: "escala_1_5", label: "O quanto a trilha respondeu à demanda do(a) jovem?", obrigatorio: true },
      { id: "resultados", tipo: "texto_longo", label: "Quais resultados ou avanços você percebeu no(a) jovem?", obrigatorio: true },
      { id: "melhorar_trilha", tipo: "texto_longo", label: "O que poderia ter sido melhor na condução da trilha?", obrigatorio: false },
      { id: "s2", tipo: "secao", label: "O programa e a coordenação", obrigatorio: false },
      { id: "apoio_coordenacao", tipo: "escala_1_5", label: "Como você avalia o suporte da coordenação durante a trilha?", obrigatorio: true },
      { id: "percepcoes", tipo: "texto_longo", label: "Percepções sobre o programa e o trabalho da coordenação — o que vale registrar?", obrigatorio: false },
      { id: "participaria_outra", tipo: "sim_nao", label: "Você participaria de outra trilha como especialista?", obrigatorio: false },
    ],
    ativo: true,
    versao: 1,
    created_by: null,
    created_at: haDias(240, "09:00"),
    updated_at: haDias(240, "09:00"),
  };

  // ---------- 12. inscrição de mentores (intake oficial, 0115 — campos
  // verbatim do seed: uma grade de horários só, "Outro" em cor/raça,
  // pergunta condicional de experiência, uploads privados) ----------
  const fIntakeMentor: Formulario = {
    id: uid(0x400c),
    titulo: "Inscrição de mentores · Matching de Mentores",
    descricao:
      "Inscrição pra quem quer ser mentor(a) no próximo ciclo. Recebemos a sua candidatura por um link público; a coordenação revisa cada inscrição antes do cadastro.",
    sistema: "intake_mentor",
    campos: [
      { id: "sec_dados", tipo: "secao", label: "Dados pessoais", obrigatorio: false },
      { id: "nome_civil", tipo: "texto", label: "Nome completo civil", obrigatorio: true },
      { id: "nome_social", tipo: "texto", label: "Nome social", obrigatorio: false },
      { id: "nascimento", tipo: "data", label: "Data de nascimento", obrigatorio: true },
      {
        id: "genero", tipo: "select", label: "Gênero", obrigatorio: true,
        opcoes: ["Cisgênero feminino", "Cisgênero masculino", "Transgênero", "Não binário", "Prefiro não informar"],
      },
      {
        id: "cor_raca", tipo: "select", label: "Cor/raça", obrigatorio: true,
        opcoes: ["Negra", "Branca", "Amarela", "Parda", "Indígena"],
        permite_outro: true,
      },
      { id: "cidade", tipo: "texto", label: "Estado/município de residência", obrigatorio: true },
      { id: "sec_trajetoria", tipo: "secao", label: "Trajetória pessoal e profissional", obrigatorio: false },
      { id: "hobbies", tipo: "texto_longo", label: "Hobbies", obrigatorio: true, descricao: "Até 3 hobbies" },
      { id: "esportes", tipo: "texto_longo", label: "Esportes", obrigatorio: true, descricao: "Assistir ou praticar" },
      { id: "inspiracoes", tipo: "texto_longo", label: "Inspirações", obrigatorio: true, descricao: "Até 3 inspirações" },
      { id: "valores", tipo: "texto_longo", label: "Valores", obrigatorio: true, descricao: "Até 3 valores" },
      { id: "realizacoes", tipo: "texto_longo", label: "Principais realizações", obrigatorio: true, descricao: "Pessoais ou profissionais" },
      { id: "auto_descricao", tipo: "texto_longo", label: "Auto-descrição em parágrafo", obrigatorio: true },
      { id: "companheiro", tipo: "texto_longo", label: "Como esposa/marido/companheiro(a) lhe descreveria?", obrigatorio: true },
      { id: "sec_trabalho", tipo: "secao", label: "Trabalho e emprego", obrigatorio: false },
      { id: "cargo", tipo: "texto", label: "Cargo", obrigatorio: true },
      { id: "empresa", tipo: "texto", label: "Empresa/instituição", obrigatorio: true },
      { id: "curriculo", tipo: "arquivo", label: "Currículo", obrigatorio: true, max_mb: 10 },
      { id: "linkedin", tipo: "texto", label: "LinkedIn", obrigatorio: false, formato: "url" },
      { id: "sec_contato", tipo: "secao", label: "Dados de contato", obrigatorio: false },
      { id: "email", tipo: "texto", label: "E-mail", obrigatorio: true, formato: "email" },
      { id: "telefone", tipo: "texto", label: "Telefone", obrigatorio: true, formato: "telefone" },
      { id: "sec_mentoria", tipo: "secao", label: "A mentoria", obrigatorio: false },
      { id: "formacao_erlich", tipo: "sim_nao", label: "Formação Erlich Mentoring", obrigatorio: true },
      { id: "experiencia_previa", tipo: "sim_nao", label: "Experiência prévia como mentor", obrigatorio: true },
      {
        id: "experiencia_descricao", tipo: "texto_longo",
        label: "Caso possua experiência prévia, descreva-a", obrigatorio: false,
        visible_if: { campo: "experiencia_previa", em: ["sim"] },
      },
      { id: "objetivos", tipo: "texto_longo", label: "Objetivos/expectativa", obrigatorio: true },
      {
        id: "pref_genero_mentorado", tipo: "select", label: "Preferência de gênero do mentorado",
        obrigatorio: true,
        opcoes: ["Mentorado homem", "Mentorada mulher", "Sem preferência"],
      },
      { id: "foto", tipo: "arquivo", label: "Foto de perfil", obrigatorio: true, max_mb: 10 },
      { id: "disponibilidade", tipo: "grid_disponibilidade", label: "Disponibilidade", obrigatorio: true },
      {
        id: "sec_comprovantes", tipo: "secao", label: "Comprovantes", obrigatorio: false,
        descricao: "Documentos para conferência da coordenação — ficam privados na plataforma.",
      },
      { id: "doc_identidade", tipo: "arquivo", label: "Anexo do RG ou CNH", obrigatorio: true, max_mb: 10 },
      { id: "comprovante_residencia", tipo: "arquivo", label: "Comprovante de residência", obrigatorio: true, max_mb: 10 },
    ],
    ativo: true,
    versao: 1,
    created_by: null,
    created_at: haDias(20, "09:00"),
    updated_at: haDias(20, "09:00"),
  };

  // ---------- 13. inscrição de mentorados (intake oficial, 0129 — as
  // perguntas do Google Form de origem; sem grade e sem documentos) ----------
  const fIntakeMentorado: Formulario = {
    id: uid(0x400d),
    titulo: "Inscrição de mentorados · Matching de Mentorados",
    descricao:
      "Inscrição de quem quer ser mentorado(a) no próximo ciclo. A coordenação revisa cada inscrição antes de cadastrar e parear.",
    sistema: "intake_mentorado",
    campos: [
      { id: "sec_dados", tipo: "secao", label: "Dados pessoais", obrigatorio: false },
      { id: "nome_civil", tipo: "texto", label: "Nome completo civil", obrigatorio: true },
      { id: "nome_social", tipo: "texto", label: "Nome social", obrigatorio: false },
      { id: "nascimento", tipo: "data", label: "Data de nascimento", obrigatorio: true },
      {
        id: "genero", tipo: "select", label: "Gênero", obrigatorio: true,
        opcoes: ["Cisgênero feminino", "Cisgênero masculino", "Transgênero", "Não binário", "Prefiro não informar"],
      },
      {
        id: "cor_raca", tipo: "select", label: "Cor/raça", obrigatorio: true,
        opcoes: ["Negra", "Branca", "Amarela", "Parda", "Indígena"],
        permite_outro: true,
      },
      { id: "cidade", tipo: "texto", label: "Estado/município de residência", obrigatorio: true },
      { id: "sec_sobre", tipo: "secao", label: "Sobre você", obrigatorio: false },
      { id: "hobbies", tipo: "texto_longo", label: "Hobbies", obrigatorio: true, descricao: "Conte um pouco sobre eles" },
      { id: "gostos", tipo: "texto_longo", label: "Coisas de que você mais gosta", obrigatorio: true },
      { id: "esportes", tipo: "texto_longo", label: "Esportes", obrigatorio: true, descricao: "Assistir ou também praticar" },
      { id: "auto_descricao", tipo: "texto_longo", label: "Auto-descrição em um parágrafo", obrigatorio: true, descricao: "Suas características mais marcantes" },
      { id: "terceiros", tipo: "texto_longo", label: "Como amigos e familiares lhe descreveriam?", obrigatorio: true },
      { id: "sec_contato", tipo: "secao", label: "Dados de contato", obrigatorio: false },
      { id: "email", tipo: "texto", label: "E-mail", obrigatorio: true, formato: "email" },
      { id: "telefone", tipo: "texto", label: "Telefone", obrigatorio: true, formato: "telefone" },
      { id: "sec_mentoria", tipo: "secao", label: "A mentoria", obrigatorio: false },
      { id: "objetivos", tipo: "texto_longo", label: "Objetivos e expectativa com o programa", obrigatorio: true },
      {
        id: "pref_genero_mentor", tipo: "select", label: "Preferência de gênero do mentor", obrigatorio: true,
        opcoes: ["Mentor homem", "Mentor mulher", "Sem preferência"],
      },
      { id: "curriculo", tipo: "arquivo", label: "Currículo", obrigatorio: true, max_mb: 10 },
    ],
    ativo: true,
    versao: 1,
    created_by: null,
    created_at: haDias(20, "09:00"),
    updated_at: haDias(20, "09:00"),
  };

  // ---------- links ----------
  const links: FormularioLink[] = [
    // avaliação: ricardo e carlos já responderam; fernanda pendente;
    // joão pedro com link vencido (coord vê o estado "expirado")
    {
      id: uid(0x4201), formulario_id: fAvaliacao.id, token: DEMO_TOKENS.ricardoAvaliacao,
      dest_profile_id: porNome("Ricardo"), dest_mentorado_id: null,
      dupla_id: duplaDe("Ricardo", "Ana"), contexto: { encontro: 4 },
      usado_em: haDias(3, "21:14"), expira_em: null, created_by: marina, created_at: haDias(5),
    },
    {
      id: uid(0x4202), formulario_id: fAvaliacao.id, token: DEMO_TOKENS.carlosAvaliacao,
      dest_profile_id: porNome("Carlos"), dest_mentorado_id: null,
      dupla_id: duplaDe("Carlos", "Caio"), contexto: { encontro: 4 },
      usado_em: haDias(2, "08:47"), expira_em: null, created_by: marina, created_at: haDias(5),
    },
    {
      id: uid(0x4203), formulario_id: fAvaliacao.id, token: DEMO_TOKENS.fernandaAvaliacao,
      dest_profile_id: porNome("Fernanda"), dest_mentorado_id: null,
      dupla_id: duplaDe("Fernanda", "Dandara"), contexto: { encontro: 4 },
      usado_em: null, expira_em: haDias(-9), created_by: marina, created_at: haDias(5),
    },
    {
      id: uid(0x4204), formulario_id: fAvaliacao.id, token: DEMO_TOKENS.joaoPedroAvaliacao,
      dest_profile_id: porNome("João Pedro"), dest_mentorado_id: null,
      dupla_id: duplaDe("João Pedro", "Eduardo"), contexto: { encontro: 4 },
      usado_em: null, expira_em: haDias(1), created_by: marina, created_at: haDias(5),
    },
    {
      id: uid(0x4205), formulario_id: fAvaliacao.id, token: DEMO_TOKENS.genericoAvaliacao,
      dest_profile_id: null, dest_mentorado_id: null, dupla_id: null,
      contexto: {}, usado_em: null, expira_em: null, created_by: marina, created_at: haDias(5),
    },
    // inscrição: um genérico respondido antes do encerramento + um pendente
    // — link vivo num form inativo mostra o estado "Formulário encerrado"
    // no /f/<token>
    {
      id: uid(0x4209), formulario_id: fInscricao.id, token: DEMO_TOKENS.genericoInscricao,
      dest_profile_id: null, dest_mentorado_id: null, dupla_id: null,
      contexto: {}, usado_em: haDias(70, "14:05"), expira_em: null,
      created_by: marina, created_at: haDias(75),
    },
    {
      id: uid(0x4215), formulario_id: fInscricao.id, token: DEMO_TOKENS.genericoInscricaoVivo,
      dest_profile_id: null, dest_mentorado_id: null, dupla_id: null,
      contexto: {}, usado_em: null, expira_em: null,
      created_by: marina, created_at: haDias(75),
    },
    // avaliação final (0130): a Luiza (mentora) respondeu no encerramento da
    // dupla do ciclo anterior; o link da Isabela (mentorada) expirou sem
    // resposta — a UI mostra o estado
    {
      id: uid(0x4212), formulario_id: fAvaliacaoFinalMentor.id, token: DEMO_TOKENS.luizaAvaliacao360,
      dest_profile_id: porNome("Luiza"), dest_mentorado_id: null,
      dupla_id: duplaDe("Luiza", "Isabela"), contexto: { origem: "ficha" },
      usado_em: haDias(233, "20:10"), expira_em: null, created_by: marina, created_at: haDias(238),
    },
    {
      id: uid(0x4213), formulario_id: fAvaliacaoFinalMentorado.id, token: DEMO_TOKENS.isabelaAvaliacao360,
      dest_profile_id: null, dest_mentorado_id: ment("Isabela"),
      dupla_id: duplaDe("Luiza", "Isabela"), contexto: { origem: "ficha" },
      usado_em: null, expira_em: haDias(208), created_by: marina, created_at: haDias(238),
    },
    // avaliação final do encerramento em andamento (d-ok): o Ricardo
    // respondeu — é o que carimba checklist.avaliacao_360_enviada na
    // fixture parcial
    {
      id: uid(0x4216), formulario_id: fAvaliacaoFinalMentor.id, token: DEMO_TOKENS.ricardoAvaliacao360,
      dest_profile_id: porNome("Ricardo"), dest_mentorado_id: null,
      dupla_id: duplaDe("Ricardo", "Ana"), contexto: { origem: "ficha" },
      usado_em: haDias(3, "21:05"), expira_em: null, created_by: marina, created_at: haDias(6),
    },
    // instrumentos da jornada (0080), dupla Ricardo×Ana — a história da
    // jornada: visão, metas e PDM respondidos; Roda da Vida ainda não
    // entregue (entra no 5º mês). No Eduardo (dupla João Pedro) a visão
    // saiu e aguarda resposta — a seção mostra cada estado: respondido,
    // pendente e não enviado
    {
      id: uid(0x4217), formulario_id: fVisao.id, token: DEMO_TOKENS.anaVisao,
      dest_profile_id: null, dest_mentorado_id: ment("Ana"),
      dupla_id: duplaDe("Ricardo", "Ana"), contexto: { origem: "instrumentos" },
      usado_em: haDias(28, "20:03"), expira_em: null, created_by: porNome("Ricardo"), created_at: haDias(30),
    },
    {
      id: uid(0x4218), formulario_id: fMetas.id, token: DEMO_TOKENS.anaMetas,
      dest_profile_id: null, dest_mentorado_id: ment("Ana"),
      dupla_id: duplaDe("Ricardo", "Ana"), contexto: { origem: "instrumentos" },
      usado_em: haDias(21, "18:44"), expira_em: null, created_by: porNome("Ricardo"), created_at: haDias(23),
    },
    {
      id: uid(0x4219), formulario_id: fPdm.id, token: DEMO_TOKENS.anaPdm,
      dest_profile_id: null, dest_mentorado_id: ment("Ana"),
      dupla_id: duplaDe("Ricardo", "Ana"), contexto: { origem: "instrumentos" },
      usado_em: haDias(7, "19:26"), expira_em: null, created_by: porNome("Ricardo"), created_at: haDias(9),
    },
    {
      id: uid(0x4220), formulario_id: fVisao.id, token: DEMO_TOKENS.eduardoVisao,
      dest_profile_id: null, dest_mentorado_id: ment("Eduardo"),
      dupla_id: duplaDe("João Pedro", "Eduardo"), contexto: { origem: "instrumentos" },
      usado_em: null, expira_em: null, created_by: porNome("João Pedro"), created_at: haDias(2),
    },
    // roda pendente pro Eduardo — é o link que o /f/<token> da demo abre
    // pra mostrar a escala 1–10. O `momento` ausente cai no recorte por
    // data: criado agora, muito antes do enc. 12 da T1 → leitura inicial
    {
      id: uid(0x4221), formulario_id: fRodaVida.id, token: DEMO_TOKENS.eduardoRoda,
      dest_profile_id: null, dest_mentorado_id: ment("Eduardo"),
      dupla_id: duplaDe("João Pedro", "Eduardo"), contexto: { origem: "instrumentos" },
      usado_em: null, expira_em: null, created_by: porNome("João Pedro"), created_at: haDias(1),
    },
    // roda da Ana — a leitura inicial do 1º encontro, já respondida (o
    // contexto.momento marca a aplicação; sem ele a data anterior ao enc.
    // 12 resolveria igual). Fecha o desenho "jornada completa na janela"
    // dela no painel da coordenação
    {
      id: uid(0x4222), formulario_id: fRodaVida.id, token: DEMO_TOKENS.anaRoda,
      dest_profile_id: null, dest_mentorado_id: ment("Ana"),
      dupla_id: duplaDe("Ricardo", "Ana"),
      contexto: { origem: "instrumentos", momento: "inicial" },
      usado_em: haDias(33, "20:41"), expira_em: null, created_by: porNome("Ricardo"), created_at: haDias(35),
    },
    // WP7 · T2 (começo de ciclo — janela do enc. 1 aberta): o Kauã já fez
    // a roda inicial e tem a visão pendente; o Matheus respondeu a visão e
    // tem a roda pendente; a Dandara (T1 em risco) só respondeu a visão —
    // metas/PDM/roda dela saem "não enviado" fora da janela no painel; o
    // Pedro (pausada) mostra o link expirado sem resposta
    {
      id: uid(0x4223), formulario_id: fRodaVida.id, token: DEMO_TOKENS.kauaRoda,
      dest_profile_id: null, dest_mentorado_id: ment("Kauã"),
      dupla_id: duplaDe("André", "Kauã"),
      contexto: { origem: "instrumentos", momento: "inicial" },
      usado_em: haDias(4, "19:33"), expira_em: null, created_by: porNome("André"), created_at: haDias(6),
    },
    {
      id: uid(0x4224), formulario_id: fVisao.id, token: DEMO_TOKENS.kauaVisao,
      dest_profile_id: null, dest_mentorado_id: ment("Kauã"),
      dupla_id: duplaDe("André", "Kauã"), contexto: { origem: "instrumentos" },
      usado_em: null, expira_em: null, created_by: porNome("André"), created_at: haDias(1),
    },
    {
      id: uid(0x4225), formulario_id: fVisao.id, token: DEMO_TOKENS.matheusVisao,
      dest_profile_id: null, dest_mentorado_id: ment("Matheus"),
      dupla_id: duplaDe("Ricardo", "Matheus"), contexto: { origem: "instrumentos" },
      usado_em: haDias(11, "21:09"), expira_em: null, created_by: porNome("Ricardo"), created_at: haDias(13),
    },
    {
      id: uid(0x4226), formulario_id: fRodaVida.id, token: DEMO_TOKENS.matheusRoda,
      dest_profile_id: null, dest_mentorado_id: ment("Matheus"),
      dupla_id: duplaDe("Ricardo", "Matheus"), contexto: { origem: "instrumentos" },
      usado_em: null, expira_em: null, created_by: porNome("Ricardo"), created_at: haDias(3),
    },
    {
      id: uid(0x4227), formulario_id: fVisao.id, token: DEMO_TOKENS.dandaraVisao,
      dest_profile_id: null, dest_mentorado_id: ment("Dandara"),
      dupla_id: duplaDe("Fernanda", "Dandara"), contexto: { origem: "instrumentos" },
      usado_em: haDias(32, "20:15"), expira_em: null, created_by: porNome("Fernanda"), created_at: haDias(34),
    },
    {
      id: uid(0x4228), formulario_id: fVisao.id, token: DEMO_TOKENS.pedroVisao,
      dest_profile_id: null, dest_mentorado_id: ment("Pedro"),
      dupla_id: duplaDe("André", "Pedro"), contexto: { origem: "instrumentos" },
      // venceu sem resposta — o painel mostra "expirado", a ficha "Reenviar"
      usado_em: null, expira_em: haDias(16), created_by: porNome("André"), created_at: haDias(30),
    },
    // avaliação geral da trilha de especialista (0104) — a trilha da
    // Helena com a Bia concluiu há 5 dias; o link espera a resposta dela
    {
      id: uid(0x4229), formulario_id: fAvaliacaoEsp.id, token: DEMO_TOKENS.helenaAvaliacaoEsp,
      dest_profile_id: porNome("Helena"), dest_mentorado_id: null,
      dupla_id: duplaDe("Helena", "Ana"), contexto: { origem: "auto", trilha: "especialista" },
      usado_em: null, expira_em: null, created_by: porNome("Helena"), created_at: haDias(5),
    },
    // link de inscrição do intake (0115): UM endereço público, N
    // respostas anônimas — usado_em fica null pra sempre, a contagem sai
    // das respostas. A identidade da candidata vem do conteúdo, não do link.
    {
      id: uid(0x4230), formulario_id: fIntakeMentor.id, token: "demo-tok-intake-mentores-001",
      dest_profile_id: null, dest_mentorado_id: null, dupla_id: null,
      contexto: {}, multi_uso: true, origem: "intake",
      usado_em: null, expira_em: null, created_by: marina, created_at: haDias(18),
    },
    // o par do lado do jovem (0129) — mesmo desenho: um link só, N respostas
    {
      id: uid(0x4231), formulario_id: fIntakeMentorado.id, token: "demo-tok-intake-mentorados-001",
      dest_profile_id: null, dest_mentorado_id: null, dupla_id: null,
      contexto: {}, multi_uso: true, origem: "intake",
      usado_em: null, expira_em: null, created_by: marina, created_at: haDias(18),
    },
  ];

  // ---------- respostas ----------
  const respostas: FormularioResposta[] = [
    {
      id: uid(0x4401), link_id: uid(0x4201),
      respostas: {
        nota: 5, participou: "sim",
        destaques: ["Conversa em profundidade", "Conexão pessoal"],
        comentarios: "A Ana abriu sobre a pressão da escola — encontro muito bom.",
      },
      respondido_em: haDias(3, "21:14"),
    },
    {
      id: uid(0x4402), link_id: uid(0x4202),
      respostas: {
        nota: 4, participou: "sim",
        destaques: ["Atividade do guia", "Planejamento dos próximos passos"],
        comentarios: "O Caio travou na parte de metas — pedi material de apoio no registro.",
      },
      respondido_em: haDias(2, "08:47"),
    },
    {
      id: uid(0x4404), link_id: uid(0x4209),
      respostas: {
        nome: "Exemplo de inscrito",
        whatsapp: "5511999990000",
        origem: "ONG parceira",
        motivacao: "Quero me preparar pro primeiro emprego.",
      },
      respondido_em: haDias(70, "14:05"),
    },
    // avaliação final da Luiza — fim de jornada da dupla encerrada
    {
      id: uid(0x4406), link_id: uid(0x4212),
      respostas: {
        estrutura_programa: "Excelente",
        melhorar_processo: "Um encontro de troca entre mentores no meio do ciclo ajudaria a não me sentir sozinha nas dúvidas.",
        dificuldade_material: "Não. A Isa tinha internet e um canto quieto pra estudar.",
        dificuldade_agenda: "Não. Terça à noite funcionou o ciclo inteiro.",
        dificuldade_metodologia: "A Roda da Vida no início foi difícil de explicar sem parecer teste de revista — depois engatou.",
        instrumentos_problematicos: "O PDM ficou longo demais pra uma sessão só; a gente terminou em duas.",
        melhorias_metodologia: "Sugerir um recorte do PDM em duas sessões para quem está no primeiro ciclo.",
        avaliacao_suporte: "Ótima",
        sugestao_suporte: "Um plantão mensal de dúvidas com a coordenação, mesmo que de 30 minutos.",
        dificuldades_mentoria: "O começo foi travado: ela não acreditava que daria conta da escola. Levei três encontros pra virar a chave.",
        consideracoes: "A mentoria mudou a minha forma de escutar antes de sugerir.",
        continua_proximo_ciclo: "sim",
        comentarios_mentorado: "A Isa é constante e curiosa. Quando confia, entrega muito.",
        experiencia_processo: "Processo sólido, material bom, e o registro semanal me ajudou a não perder o fio.",
        depoimento: "Sim, com meu nome",
      },
      respondido_em: haDias(233, "20:10"),
    },
    // avaliação final do Ricardo — encerramento em andamento da d-ok
    // (checklist parcial: a decisão da coordenação ainda não chegou)
    {
      id: uid(0x4408), link_id: uid(0x4216),
      respostas: {
        estrutura_programa: "Boa",
        melhorar_processo: "O registro semanal podia lembrar de responder as perguntas do encontro anterior — às vezes eu esqueço um combinado.",
        dificuldade_material: "Não. Ela usa o computador da escola pra estudar.",
        dificuldade_agenda: "Duas remarcações por causa do horário dela na escola, mas nada que atrapalhasse.",
        dificuldade_metodologia: "Não. O guia deixou claro o que fazer em cada encontro.",
        instrumentos_problematicos: "As metas SMART demoraram a fazer sentido pra ela; só na terceira tentativa saiu algo concreto.",
        melhorias_metodologia: "Um exemplo pronto de meta SMART no material ajudaria a explicar mais rápido.",
        avaliacao_suporte: "Boa",
        sugestao_suporte: "Um resumo do ciclo em uma página pra eu me situar antes de cada encontro.",
        dificuldades_mentoria: "A Ana chegou travada com matemática e hoje monta o próprio cronograma. Levo a disciplina de metas pequenas — funciona com cliente também.",
        consideracoes: "",
        continua_proximo_ciclo: "sim",
        comentarios_mentorado: "Ela é autônoma e organizada, e agora pede ajuda sem esperar a sessão.",
        experiencia_processo: "Aprendi a não resolver pela pessoa. Isso mudou meu jeito de liderar também.",
        depoimento: "Sim, mas de forma anônima",
      },
      respondido_em: haDias(3, "21:05"),
    },
    // instrumentos da Ana (0080) — o conteúdo que a seção Instrumentos e a
    // aba Respostas transformam em visão/metas estruturadas
    {
      id: uid(0x4409), link_id: uid(0x4217),
      respostas: {
        filme: "No filme eu me vejo formada, trabalhando num lugar onde as pessoas me respeitam. Acordo cedo sem medo do dia. Ajudo minha mãe com as contas e ainda sobra tempo pra desenhar.",
        aspectos: "Ter meu próprio dinheiro, um trabalho que eu goste e a minha família tranquila.",
        ser_fazer: "Estou sendo alguém que termina o que começa — passei no vestibular e me sustento com o meu trabalho.",
        deixou: "Não preciso mais pedir dinheiro emprestado no fim do mês e não tenho mais medo de falar em público.",
        valoriza: "A liberdade de escolher e o orgulho da minha mãe.",
        declaracao_visao: "Em até 3 anos, serei uma profissional formada e independente, sustentando meus estudos e ajudando minha família.",
      },
      respondido_em: haDias(28, "20:03"),
    },
    {
      id: uid(0x4410), link_id: uid(0x4218),
      respostas: {
        declaracao_visao: "Em até 3 anos, serei uma profissional formada e independente, sustentando meus estudos e ajudando minha família.",
        preciso_criar: "Um cronograma de estudos que eu consiga seguir",
        preciso_aprender: "Matemática básica pro ENEM e a falar melhor em público",
        preciso_melhorar: "Minha organização com os prazos da escola",
        preciso_eliminar: "O hábito de deixar tudo pra última hora",
        meta_1: "Concluir o ensino médio com notas suficientes pro ENEM",
        porque_1: "É a porta de entrada pra faculdade — sem isso o resto não acontece.",
        meta_2: "Conseguir um jovem aprendiz até o fim do ano",
        porque_2: "Quero minha própria renda e experiência de trabalho de verdade.",
        meta_3: "Melhorar minhas notas de matemática em 2 pontos",
        porque_3: "É a matéria que mais me atrapalha no simulado.",
        meta_4: "Apresentar um trabalho sem ler os slides",
        porque_4: "Falar em público me trava — vencer isso muda tudo.",
        submetas_1: "Passar na recuperação de matemática do 3º bimestre\nFechar a lista de exercícios do professor Renan toda semana\nLevar as dúvidas pro encontro com o mentor",
        submetas_2: "Me inscrever nos programas de jovem aprendiz da cidade\nMontar o currículo com a Luana da ONG\nTreinar entrevista com o Ricardo",
        submetas_4: "Ensaiar a apresentação em casa 3 vezes",
        // rev_*/meta_principal — chaves do template pré-0109, preservadas
        // no snapshot mesmo depois da saída do form (contrato histórico)
        rev_ajudam: "sim",
        rev_importantes: "sim",
        rev_claras: "sim",
        meta_principal: "Meta 2",
      },
      respondido_em: haDias(21, "18:44"),
    },
    {
      id: uid(0x4411), link_id: uid(0x4219),
      respostas: {
        declaracao_visao: "Em até 3 anos, serei uma profissional formada e independente, sustentando meus estudos e ajudando minha família.",
        meta_1: "Conseguir um jovem aprendiz até dezembro",
        is_1: "Contrato assinado num programa de jovem aprendiz",
        prazo_1: "2026-12-15",
        meta_2: "Subir a média de matemática pra 7,0",
        is_2: "Média 7,0 ou mais no boletim do 3º bimestre",
        prazo_2: "2026-10-30",
        meta_3: "Fazer o simulado completo do ENEM sem zerar nenhuma área",
        is_3: "Simulado completo com nota mínima 500 em cada área",
        prazo_3: "2026-11-20",
        submetas_1: "1. Montar o currículo com a Luana da ONG (até sexta). 2. Me inscrever nos 3 programas de aprendiz da cidade (até 15/09). 3. Treinar entrevista com o Ricardo (encontro 6).",
        submetas_2: "1. 30 min de exercícios toda terça e quinta. 2. Levar as dúvidas pro encontro com o mentor. 3. Refazer a prova do 2º bimestre em casa.",
      },
      respondido_em: haDias(7, "19:26"),
    },
    // roda inicial da Ana (enc. 1) — as 16 áreas do 1–10 + a reflexão
    // livre; o recorte "inicial" vem do contexto.momento do link
    {
      id: uid(0x4412), link_id: uid(0x4222),
      respostas: {
        p_saude: 7, p_intelecto: 6, p_equilibrio: 5, p_independencia: 6,
        pr_carreira: 3, pr_financas: 4, pr_escola: 6, pr_contribuicao: 5,
        r_familia: 8, r_amigos: 7, r_amoroso: 5, r_social: 6,
        q_hobbies: 8, q_atividade: 5, q_realizacao: 6, q_espiritualidade: 7,
        reflexao: "Carreira e finanças são as que mais me preocupam — é por isso que quero o jovem aprendiz. Família e amigos são o que me segura.",
      },
      respondido_em: haDias(33, "20:41"),
    },
    // roda inicial do Kauã — T2 em começo de ciclo
    {
      id: uid(0x4413), link_id: uid(0x4223),
      respostas: {
        p_saude: 6, p_intelecto: 7, p_equilibrio: 6, p_independencia: 5,
        pr_carreira: 4, pr_financas: 3, pr_escola: 7, pr_contribuicao: 6,
        r_familia: 9, r_amigos: 8, r_amoroso: 4, r_social: 7,
        q_hobbies: 7, q_atividade: 8, q_realizacao: 6, q_espiritualidade: 5,
        reflexao: "Finanças é o que mais pesa — ajudo em casa no fim de semana. Quero aprender a organizar melhor meu tempo.",
      },
      respondido_em: haDias(4, "19:33"),
    },
    // visão do Matheus — respondida entre o enc. 1 e o 2 da T2
    {
      id: uid(0x4414), link_id: uid(0x4225),
      respostas: {
        filme: "No filme eu estou trabalhando com tecnologia, numa equipe pequena, e ainda tenho tempo pra jogar com meus amigos no fim de semana.",
        aspectos: "Trabalhar com o que eu gosto e ganhar meu próprio dinheiro.",
        ser_fazer: "Consigo programar projetos de verdade e ajudar em casa sem apertar.",
        deixou: "Parei de depender de bico e de ficar sem saber o que fazer da vida.",
        valoriza: "Liberdade de escolha e estabilidade.",
        declaracao_visao: "Em 2 anos, serei desenvolvedor júnior numa empresa de tecnologia, ajudando minha família.",
      },
      respondido_em: haDias(11, "21:09"),
    },
    // visão da Dandara — respondida no enc. 1, antes da dupla entrar em
    // risco; o painel da coord mostra a estação feita num contexto de
    // parada — é o desenho "feito mas fora do ritmo"
    {
      id: uid(0x4415), link_id: uid(0x4227),
      respostas: {
        filme: "Eu me vejo enfermeira, de jaleco, num hospital da cidade. Minha mãe me conta pras amigas com orgulho.",
        aspectos: "Cuidar das pessoas e ter um salário fixo.",
        ser_fazer: "Ser referência pra minha irmã menor — a primeira da família com profissão.",
        deixou: "Não fico mais trocando de emprego informal toda hora.",
        valoriza: "Rotina estável e respeito.",
        declaracao_visao: "Em 3 anos, serei técnica de enfermagem empregada.",
      },
      respondido_em: haDias(32, "20:15"),
    },
    // candidata já promovida — a resposta carimba o profile criado (a
    // Luiza, que hoje é mentora DPP na base demo)
    {
      id: uid(0x4416), link_id: uid(0x4230),
      promovido_profile_id: porNome("Luiza"),
      respostas: {
        nome_civil: "Luiza Campos Ribeiro",
        nome_social: "Luiza",
        nascimento: "1989-03-14",
        genero: "Cisgênero feminino",
        cor_raca: "Branca",
        cidade: "São Paulo/SP",
        hobbies: "Corrida de rua, cerâmica e clubes de leitura",
        esportes: "Corro 10km aos domingos",
        inspiracoes: "Minha avó, que alfabetizou mulheres na roça",
        valores: "Honestidade, curiosidade e presença",
        realizacoes: "Abri duas clínicas de fisioterapia e formei 30 estagiários",
        auto_descricao: "Sou objetiva, gosto de gente e acredito que constância pequena vence plano grande.",
        companheiro: "Que sou teimosa no bom sentido — quando decido, vou até o fim.",
        cargo: "Sócia-fundadora",
        empresa: "Clínica Movimento",
        curriculo: { path: `${uid(0x4230)}/cv-luiza.pdf`, nome: "curriculo-luiza.pdf", tamanho: 184320 },
        linkedin: "linkedin.com/in/luizacampos",
        email: "luiza.campos@exemplo.com",
        telefone: "(11) 98877-1234",
        formacao_erlich: "sim",
        experiencia_previa: "sim",
        experiencia_descricao: "Mentorei jovens da periferia por 2 anos num projeto da faculdade.",
        objetivos: "Quero devolver pra um jovem o que a mentoria fez por mim na faculdade.",
        pref_genero_mentorado: "Mentorada mulher",
        foto: { path: `${uid(0x4230)}/foto-luiza.jpg`, nome: "foto-luiza.jpg", tamanho: 921600 },
        disponibilidade: {
          celulas: [
            { dia: "seg", periodo: "noite" },
            { dia: "qua", periodo: "noite" },
            { dia: "sex", periodo: "tarde" },
          ],
          horas: [
            { dia: "seg", hora: 18 }, { dia: "seg", hora: 19 },
            { dia: "qua", hora: 18 }, { dia: "qua", hora: 19 },
            { dia: "sex", hora: 14 }, { dia: "sex", hora: 15 },
          ],
        },
        doc_identidade: { path: `${uid(0x4230)}/rg-luiza.pdf`, nome: "rg-luiza.pdf", tamanho: 512000 },
        comprovante_residencia: { path: `${uid(0x4230)}/comprovante-luiza.pdf`, nome: "comprovante-luiza.pdf", tamanho: 402432 },
      },
      respondido_em: haDias(16, "20:41"),
    },
    // candidato na fila — ainda não revisado (o botão "Revisar e cadastrar"
    // abre o prefill da promoção a partir dessa resposta)
    {
      id: uid(0x4417), link_id: uid(0x4230),
      respostas: {
        nome_civil: "Maurício Ferraz de Almeida",
        nascimento: "1984-11-02",
        genero: "Cisgênero masculino",
        cor_raca: "Parda",
        cidade: "Campinas - SP",
        hobbies: "Xadrez e fotografia de rua",
        esportes: "Futebol society às quintas",
        inspiracoes: "Um professor que me tirou da reprovação",
        valores: "Palavra dada, trabalho e família",
        realizacoes: "Construí a área de dados da empresa do zero",
        auto_descricao: "Engenheiro, pai de duas meninas, acredito em educação como alavanca.",
        companheiro: "Que sou calmo por fora e competitivo por dentro.",
        cargo: "Head de Dados",
        empresa: "Varejo S.A.",
        curriculo: { path: `${uid(0x4230)}/cv-mauricio.pdf`, nome: "cv-mauricio-ferraz.pdf", tamanho: 256000 },
        email: "mauricio.ferraz@exemplo.com",
        telefone: "(19) 97766-4321",
        formacao_erlich: "nao",
        experiencia_previa: "nao",
        objetivos: "Ensinar um jovem a olhar pro futuro com método — foi o que faltou pra mim.",
        pref_genero_mentorado: "Sem preferência",
        foto: { path: `${uid(0x4230)}/foto-mauricio.jpg`, nome: "foto-mauricio.jpg", tamanho: 838860 },
        disponibilidade: {
          celulas: [
            { dia: "ter", periodo: "noite" },
            { dia: "qui", periodo: "noite" },
          ],
          horas: [
            { dia: "ter", hora: 18 }, { dia: "ter", hora: 19 },
            { dia: "qui", hora: 18 }, { dia: "qui", hora: 19 },
          ],
        },
        doc_identidade: { path: `${uid(0x4230)}/rg-mauricio.pdf`, nome: "rg-mauricio.pdf", tamanho: 499712 },
        comprovante_residencia: { path: `${uid(0x4230)}/comprovante-mauricio.pdf`, nome: "comprovante-mauricio.pdf", tamanho: 376832 },
      },
      respondido_em: haDias(6, "19:03"),
    },
    // inscrição de mentorado na fila (0129) — o botão "Revisar e cadastrar"
    // abre o prefill da via de mentorado
    {
      id: uid(0x4418), link_id: uid(0x4231),
      respostas: {
        nome_civil: "Beatriz Nunes de Oliveira",
        nascimento: "2007-05-22",
        genero: "Cisgênero feminino",
        cor_raca: "Parda",
        cidade: "Guarulhos/SP",
        hobbies: "Dança no coletivo do bairro e desenho",
        gostos: "Música, festas da família e conversar com gente mais velha",
        esportes: "Vôlei na escola, só prática",
        auto_descricao: "Sou curiosa e falo pouco até pegar confiança; quando pego, não paro.",
        terceiros: "Que sou esforçada e cuido dos meus irmãos mais novos.",
        email: "beatriz.nunes@exemplo.com",
        telefone: "(11) 96655-2044",
        objetivos: "Quero terminar o ensino médio e decidir o que estudar sem medo de errar.",
        pref_genero_mentor: "Mentor mulher",
        curriculo: { path: `${uid(0x4231)}/cv-beatriz.pdf`, nome: "curriculo-beatriz.pdf", tamanho: 148480 },
      },
      respondido_em: haDias(4, "17:28"),
    },
    // inscrição de mentorado já promovida — o carimbo aponta pra mentorada
    // que hoje está na base demo
    {
      id: uid(0x4419), link_id: uid(0x4231),
      promovido_mentorado_id: ment("Ana"),
      respostas: {
        nome_civil: "Ana Clara Souza Lima",
        nome_social: "Ana",
        nascimento: "2006-09-08",
        genero: "Cisgênero feminino",
        cor_raca: "Negra",
        cidade: "São Paulo/SP",
        hobbies: "Leitura e handebol",
        gostos: "Livros de fantasia e cozinhar com a mãe",
        esportes: "Handebol, prática e assiste",
        auto_descricao: "Sou observadora, gosto de entender o porquê das coisas antes de opinar.",
        terceiros: "Que sou determinada e um pouco teimosa.",
        email: "ana.clara@exemplo.com",
        telefone: "(11) 95544-8123",
        objetivos: "Quero entrar numa universidade pública e ser a primeira da família a se formar.",
        pref_genero_mentor: "Sem preferência",
        curriculo: { path: `${uid(0x4231)}/cv-ana.pdf`, nome: "curriculo-ana.pdf", tamanho: 132096 },
      },
      respondido_em: haDias(30, "15:02"),
    },
  ];

  // ---------- anexos do intake (0115) ----------
  // metadados espelhando os {path} das respostas — /api/form-anexo/<id>
  // serve PDF placeholder na demo, igual aos anexos de registro
  const anexos: DemoFormularioAnexo[] = [
    { id: uid(0x4601), link_id: uid(0x4230), campo_id: "curriculo", path: `${uid(0x4230)}/cv-luiza.pdf`, nome: "curriculo-luiza.pdf", tamanho: 184320, created_at: haDias(16, "20:40") },
    { id: uid(0x4602), link_id: uid(0x4230), campo_id: "foto", path: `${uid(0x4230)}/foto-luiza.jpg`, nome: "foto-luiza.jpg", tamanho: 921600, created_at: haDias(16, "20:40") },
    { id: uid(0x4603), link_id: uid(0x4230), campo_id: "doc_identidade", path: `${uid(0x4230)}/rg-luiza.pdf`, nome: "rg-luiza.pdf", tamanho: 512000, created_at: haDias(16, "20:40") },
    { id: uid(0x4604), link_id: uid(0x4230), campo_id: "comprovante_residencia", path: `${uid(0x4230)}/comprovante-luiza.pdf`, nome: "comprovante-luiza.pdf", tamanho: 402432, created_at: haDias(16, "20:40") },
    { id: uid(0x4605), link_id: uid(0x4230), campo_id: "curriculo", path: `${uid(0x4230)}/cv-mauricio.pdf`, nome: "cv-mauricio-ferraz.pdf", tamanho: 256000, created_at: haDias(6, "19:02") },
    { id: uid(0x4606), link_id: uid(0x4230), campo_id: "foto", path: `${uid(0x4230)}/foto-mauricio.jpg`, nome: "foto-mauricio.jpg", tamanho: 838860, created_at: haDias(6, "19:02") },
    { id: uid(0x4607), link_id: uid(0x4230), campo_id: "doc_identidade", path: `${uid(0x4230)}/rg-mauricio.pdf`, nome: "rg-mauricio.pdf", tamanho: 499712, created_at: haDias(6, "19:02") },
    { id: uid(0x4608), link_id: uid(0x4230), campo_id: "comprovante_residencia", path: `${uid(0x4230)}/comprovante-mauricio.pdf`, nome: "comprovante-mauricio.pdf", tamanho: 376832, created_at: haDias(6, "19:02") },
  ];

  return {
    formularios: [
      fAvaliacao,
      fInscricao,
      fAvaliacaoFinalMentorado,
      fAvaliacaoFinalMentor,
      fVisao,
      fMetas,
      fPdm,
      fRodaVida,
      fAvaliacaoEsp,
      fIntakeMentor,
      fIntakeMentorado,
    ],
    links,
    respostas,
    anexos,
  };
}

// ---------- derivações dos instrumentos oficiais (0042) ----------
// Mesma lógica das queries reais, sobre o dataset: as policies das 3 tabelas
// são coord-only, então os callers conferem o papel antes de chamar.

/** Data da resposta da avaliação final mais recente da dupla — idem
 *  getAvaliacao360DaDupla (join resposta ← link ← form oficial). */
export function demoAvaliacao360DaDupla(
  role: AppRole,
  duplaId: string
): string | null {
  if (role !== "coordenacao") return null;
  const { formularios, links, respostas } = getDemoFormularios();
  // depois da 0130 são dois instrumentos (um por lado): vale a resposta
  // mais recente de qualquer um
  const forms = new Set(
    formularios
      .filter(
        (f) =>
          f.sistema === "avaliacao_final_mentorado" ||
          f.sistema === "avaliacao_final_mentor"
      )
      .map((f) => f.id)
  );
  if (!forms.size) return null;
  const linkIds = new Set(
    links
      .filter((l) => forms.has(l.formulario_id) && l.dupla_id === duplaId)
      .map((l) => l.id)
  );
  const maisRecente = respostas
    .filter((r) => linkIds.has(r.link_id))
    .map((r) => r.respondido_em)
    .sort()
    .at(-1);
  return maisRecente ?? null;
}

// ---------- instrumentos da dupla (0080) + jornada (0096) ----------

/** Entrega no superset da 0096 — `EntregaJornada` (contexto/datas é o que
 *  separa Roda inicial da formal) com `respostas` estreito o bastante pra
 *  servir também de `InstrumentoEntrega` na ficha da dupla. */
type EntregaDemo = Omit<EntregaJornada, "respostas"> & {
  respostas: Record<string, RespostaValor> | null;
};

/** Instrumento no shape compartilhado: satisfaz `InstrumentoDupla` (ficha)
 *  e `InstrumentoJornada` (jornada do jovem) — os dois tipos divergem só
 *  em detalhe de campo, a derivação é uma só. */
type InstrumentoDemo = Omit<
  import("../forms/queries").InstrumentoDupla,
  "entregas"
> & { entregas: EntregaDemo[] };

const ORDEM_JORNADA = { visao: 1, metas: 2, pdm: 3, roda_vida: 4 } as const;

/** link → entrega: status deriva de usado_em/expira_em (o mesmo CASE das
 *  três RPCs da 0096) e `destino` separa o lado do mentor do lado do
 *  jovem — o painel e a jornada dependem da distinção. */
function linkParaEntrega(
  l: FormularioLink,
  r: FormularioResposta | undefined,
  dupla: Dupla,
  agora: number
): EntregaDemo {
  return {
    link_id: l.id,
    token: l.token,
    destino: l.dest_mentorado_id
      ? "mentorado"
      : l.dest_profile_id === dupla.mentor?.id
        ? "mentor"
        : "outro",
    status: l.usado_em
      ? "respondido"
      : l.expira_em && new Date(l.expira_em).getTime() < agora
        ? "expirado"
        : "pendente",
    respondido_em: r?.respondido_em ?? l.usado_em,
    respostas: r?.respostas ?? null,
    contexto: l.contexto ?? null,
    created_at: l.created_at,
    usado_em: l.usado_em,
    expira_em: l.expira_em,
  };
}

/** Os 4 instrumentos da jornada com as entregas DA dupla — a projeção da
 *  RPC instrumentos_da_dupla, sem o gate de papel (cada mirror aplica o
 *  seu: ficha por vínculo, jornada pelo mentorado, painel por escopo). */
function instrumentosDaDuplaRaw(dupla: Dupla): InstrumentoDemo[] {
  const { formularios, links, respostas } = getDemoFormularios();
  const agora = Date.now();
  return formularios
    .filter((f) => f.sistema && f.sistema in ORDEM_JORNADA)
    .sort(
      (a, b) =>
        ORDEM_JORNADA[a.sistema as keyof typeof ORDEM_JORNADA] -
        ORDEM_JORNADA[b.sistema as keyof typeof ORDEM_JORNADA]
    )
    .map((f) => ({
      sistema:
        f.sistema as import("../forms/schema").InstrumentoSistema,
      formulario_id: f.id,
      titulo: f.titulo,
      descricao: f.descricao,
      ativo: f.ativo,
      campos: f.campos,
      entregas: links
        .filter(
          (l) =>
            l.formulario_id === f.id &&
            l.dupla_id === dupla.id &&
            (l.dest_mentorado_id === dupla.mentorado?.id ||
              l.dest_profile_id === dupla.mentor?.id)
        )
        .map((l) =>
          linkParaEntrega(
            l,
            respostas.find((x) => x.link_id === l.id),
            dupla,
            agora
          )
        ),
    }));
}

/** WP7 — mirror de `jovem_jornada()` (0096): a dupla DPP mais recente do
 *  persona mentorado + o cronograma da turma + os 4 instrumentos + os
 *  links 360º endereçados a ela. Null → a página cai na biblioteca plana
 *  (mesmo fallback da RPC sem dupla). */
export function demoJovemJornada(role: AppRole): JovemJornadaDados | null {
  if (role !== "mentorado") return null;
  const data = getDemoData();
  const eu = data.personas[role];
  const ment = data.mentorados.find((m) => m.profile_id === eu.id);
  if (!ment) return null;
  const dupla = data.duplas
    .filter((d) => d.mentorado?.id === ment.id && d.trilha !== "especialista")
    .sort((a, b) => (b.iniciada_em ?? "").localeCompare(a.iniciada_em ?? ""))
    .at(0);
  if (!dupla) return null;

  // o RPC emite e.tipo cru; EventoJornada declara o rótulo da jornada —
  // etapas de preparação e o evento de encerramento viram 'marco' (a lib
  // só lê 'encontro' pras recortes de janela, como na real)
  const tipoEvento: Record<string, EventoJornada["tipo"]> = {
    encontro: "encontro",
    formacao: "formacao",
    recesso: "recesso",
  };
  const cronograma: EventoJornada[] = data.cicloEventos
    .filter((e) => e.cronograma_id === dupla.cronograma_id)
    .sort((a, b) => (a.data ?? "￿").localeCompare(b.data ?? "￿"))
    .map((e) => ({
      numero: e.numero,
      data: e.data ?? "",
      tipo: tipoEvento[e.tipo] ?? "marco",
      fase: e.fase,
      instrumentos: e.instrumentos,
    }));

  // a estação do encontro 16 é a entrega do jovem (chave `avaliacao_360` do
  // payload, como na RPC 0096)
  const form360 = getDemoFormularios().formularios.find(
    (f) => f.sistema === "avaliacao_final_mentorado"
  );
  const { links, respostas } = getDemoFormularios();
  const agora = Date.now();
  const avaliacao_360: Entrega360[] = form360
    ? links
        .filter(
          (l) =>
            l.formulario_id === form360.id &&
            l.dest_mentorado_id === ment.id &&
            (l.dupla_id === dupla.id || l.dupla_id === null)
        )
        .map((l) => {
          const e = linkParaEntrega(
            l,
            respostas.find((x) => x.link_id === l.id),
            dupla,
            agora
          );
          // Entrega360 não carrega destino/usado_em (o lado é sempre o
          // mentorado; a resposta basta no respondido_em)
          return {
            link_id: e.link_id,
            token: e.token,
            status: e.status,
            respondido_em: e.respondido_em,
            respostas: e.respostas,
            contexto: e.contexto,
            created_at: e.created_at,
            expira_em: e.expira_em,
          };
        })
    : [];

  const instrumentos: InstrumentoJornada[] = instrumentosDaDuplaRaw(dupla);
  return {
    dupla_id: dupla.id,
    cronograma,
    instrumentos,
    avaliacao_360,
  };
}

/** WP7 — mirror de `painel_instrumentos_jornada()` (0096): por dupla DPP
 *  viva do escopo do papel (coord todas, supervisor as supervisionadas —
 *  trilhas de especialista fora por regra da RPC), as entregas por
 *  sistema SEM respostas/tokens + a contagem de avaliações de encontro
 *  (feitas = row em avaliacoes_encontro sobre encontro realizado). */
export function demoPainelInstrumentosJornada(
  role: AppRole
): PainelJornadaLinha[] {
  if (role !== "coordenacao" && role !== "supervisor") return [];
  const data = getDemoData();
  const eu = data.personas[role];
  const { formularios, links } = getDemoFormularios();
  const agora = Date.now();
  // espelha a RPC: a avaliação final do mentorado alimenta o slot
  // `avaliacao_360` do painel (o lado do mentor não entra na jornada)
  const sistemasPainel = new Set([
    "visao",
    "metas",
    "pdm",
    "roda_vida",
    "avaliacao_final_mentorado",
  ]);
  const chavePainel = (s: string) =>
    s === "avaliacao_final_mentorado" ? "avaliacao_360" : s;
  const formPorId = new Map(formularios.map((f) => [f.id, f]));

  return data.duplas
    .filter(
      (d) =>
        d.trilha !== "especialista" &&
        (d.status === "ativa" || d.status === "pausada")
    )
    .filter(
      (d) => role === "coordenacao" || d.supervisor?.id === eu.id
    )
    .map((d) => {
      const entregas: PainelJornadaLinha["entregas"] = {};
      for (const l of links) {
        if (l.dupla_id !== d.id) continue;
        const f = formPorId.get(l.formulario_id);
        if (!f?.sistema || !sistemasPainel.has(f.sistema)) continue;
        const proMentorado = l.dest_mentorado_id === d.mentorado?.id;
        if (!proMentorado && l.dest_profile_id !== d.mentor?.id) continue;
        const s = chavePainel(f.sistema) as keyof PainelJornadaLinha["entregas"];
        (entregas[s] ??= []).push({
          status: l.usado_em
            ? "respondido"
            : l.expira_em && new Date(l.expira_em).getTime() < agora
              ? "expirado"
              : "pendente",
          created_at: l.created_at,
          destino: proMentorado ? "mentorado" : "mentor",
        });
      }
      for (const k of Object.keys(entregas) as (keyof typeof entregas)[]) {
        entregas[k]!.sort((a, b) => a.created_at.localeCompare(b.created_at));
      }
      const realizados = new Set(
        (d.encontros ?? [])
          .filter((e) => e.status === "realizado")
          .map((e) => e.id)
      );
      return {
        dupla_id: d.id,
        turma: d.turma,
        cronograma_id: d.cronograma_id ?? "",
        mentor_id: d.mentor?.id ?? "",
        mentor_nome: d.mentor?.nome_social ?? d.mentor?.nome ?? "",
        mentorado_id: d.mentorado?.id ?? "",
        jovem_nome: d.mentorado?.nome_social ?? d.mentorado?.nome ?? "",
        entregas,
        avaliacoes_encontro: {
          feitas: data.avaliacoes.filter(
            (a) => a.dupla_id === d.id && realizados.has(a.encontro_id)
          ).length,
          realizados: realizados.size,
          max_numero:
            (d.encontros ?? [])
              .filter((e) => e.status === "realizado")
              .reduce((m, e) => Math.max(m, e.numero), 0) || null,
        },
      };
    })
    .sort(
      (a, b) =>
        (a.turma ?? "").localeCompare(b.turma ?? "") ||
        a.jovem_nome.localeCompare(b.jovem_nome)
    );
}

/** Idem a RPC instrumentos_da_dupla: escopo da dupla (coord; mentor,
 *  supervisor e mentorado DELA) e payload já estruturado — token junto,
 *  respostas só nas entregas respondidas, metadados do link (contexto e
 *  datas) desde a 0096. */
export function demoInstrumentosDaDupla(
  role: AppRole,
  duplaId: string
): import("../forms/queries").InstrumentoDupla[] {
  const data = getDemoData();
  const dupla = data.duplas.find((d) => d.id === duplaId);
  if (!dupla) return [];
  const eu = data.personas[role];
  const souMentorado =
    role === "mentorado" &&
    data.mentorados.some(
      (m) => m.id === dupla.mentorado?.id && m.profile_id === eu.id
    );
  const podeVer =
    role === "coordenacao" ||
    dupla.mentor?.id === eu.id ||
    dupla.supervisor?.id === eu.id ||
    souMentorado;
  if (!podeVer) return [];
  return instrumentosDaDuplaRaw(dupla);
}

/** Estado do link da avaliação geral da trilha de especialista (0104) —
 *  idem a RPC avaliacao_esp_da_dupla: a especialista recebe o token pra
 *  responder de novo (a notificação pode se perder); a coord vê só o
 *  estado. */
export function demoAvaliacaoEspDaDupla(
  role: AppRole,
  duplaId: string
): {
  respondido: boolean;
  respondido_em: string | null;
  formulario_id?: string;
  token?: string;
} | null {
  const data = getDemoData();
  const dupla = data.duplas.find((d) => d.id === duplaId);
  if (!dupla || dupla.trilha !== "especialista") return null;
  const eu = data.personas[role];
  if (role !== "coordenacao" && dupla.mentor?.id !== eu.id) return null;
  const { formularios, links } = getDemoFormularios();
  const formIds = new Set(
    formularios.filter((f) => f.sistema === "avaliacao_especialista").map((f) => f.id)
  );
  const link = links.find(
    (l) => l.dupla_id === duplaId && formIds.has(l.formulario_id)
  );
  if (!link) return null;
  return {
    respondido: link.usado_em != null,
    respondido_em: link.usado_em,
    formulario_id: link.formulario_id,
    token: dupla.mentor?.id === eu.id ? link.token : undefined,
  };
}
