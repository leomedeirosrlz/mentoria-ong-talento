/*
 * Dataset demo da engine de formulários (migrações 0036 e 0042).
 *
 * Mesmo contrato de ./data: módulo puro (nada de next/* nem supabase),
 * evergreen — timestamps derivam de `new Date()`. Consumido pelas queries do
 * módulo de forms (src/lib/forms/queries.ts) quando o cookie demo_role está
 * ativo; como /formularios é coord-only, os dados só saem pro papel
 * "coordenacao".
 *
 * Além dos forms da coordenação, o dataset carrega os 3 instrumentos
 * oficiais do guia (sistema: anamnese / avaliacao_360 / autoavaliacao_mentor
 * — campos verbatim da 0042), com links e respostas que alimentam a ficha
 * da pessoa (anamnese) e o checklist de encerramento (360º).
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
  dandaraAnamnese: "demo-tok-anamnese-dandara1",
  eduardoAnamnese: "demo-tok-anamnese-eduardo1",
  isabelaAnamnese: "demo-tok-anamnese-isabela1",
  genericoInscricao: "demo-tok-inscric-generico",
  genericoInscricaoVivo: "demo-tok-inscric-vivo-000",
  // instrumentos oficiais (0042)
  anaAnamneseOficial: "demo-tok-anamnese-ana-ofic",
  eduardoAnamneseOficial: "demo-tok-anamnese-edu-ofic",
  luizaAvaliacao360: "demo-tok-360-luiza-oficial1",
  isabelaAvaliacao360: "demo-tok-360-isabela-oficia",
  ricardoAvaliacao360: "demo-tok-360-ricardo-ofici",
  luizaAutoavaliacao: "demo-tok-autoav-luiza-ofici",
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

export type DemoFormularios = {
  formularios: Formulario[];
  links: FormularioLink[];
  respostas: FormularioResposta[];
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

  // ---------- 2. anamnese social (ativa, resposta parcial) ----------
  const fAnamnese: Formulario = {
    id: uid(0x4002),
    titulo: "Anamnese social · família e contexto",
    descricao:
      "Ficha de conhecimento do contexto do jovem, preenchida com a família no início do acompanhamento.",
    campos: [
      { id: "moradia", tipo: "texto", label: "Quem mora com o jovem?", obrigatorio: true },
      { id: "nascimento", tipo: "data", label: "Data de nascimento do jovem", obrigatorio: true },
      {
        id: "estudo", tipo: "select", label: "Situação de estudo e trabalho",
        obrigatorio: true,
        opcoes: [
          "Só estuda",
          "Estuda e trabalha",
          "Só trabalha",
          "Não estuda nem trabalha",
        ],
      },
      {
        id: "apoios", tipo: "multi_select", label: "Apoios que a família já recebe",
        obrigatorio: false,
        opcoes: ["Nenhum", "Bolsa Família", "CRAS", "Acompanhamento de saúde", "Outros"],
      },
      { id: "confirma", tipo: "checkbox", label: "Confirmo que as informações acima são verdadeiras", obrigatorio: true },
      { id: "observacoes", tipo: "texto_longo", label: "Algo mais que queiram contar?", obrigatorio: false },
    ],
    ativo: true,
    versao: 2,
    created_by: marina,
    created_at: haDias(30),
    updated_at: haDias(6),
  };

  // ---------- 3. inscrição (encerrada — cobre o estado inativo) ----------
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

  const fAnamneseOficial: Formulario = {
    id: uid(0x4004),
    titulo: "Anamnese Social",
    descricao:
      "Ficha de conhecimento do(a) jovem, respondida antes do início da mentoria: quem você é, como é sua vida e o que espera do programa. Ajuda a coordenação no pareamento e orienta o trabalho do(a) mentor(a).",
    sistema: "anamnese",
    campos: [
      { id: "quem_mora", tipo: "texto_longo", label: "Quem mora com você? Como é a convivência em casa?", obrigatorio: true },
      { id: "territorio", tipo: "texto", label: "Em que bairro ou comunidade você mora?", obrigatorio: true },
      { id: "estuda", tipo: "sim_nao", label: "Você está estudando atualmente?", obrigatorio: true },
      { id: "trabalha", tipo: "sim_nao", label: "Você está trabalhando atualmente?", obrigatorio: true },
      { id: "onde_estuda_trabalha", tipo: "texto", label: "Onde você estuda ou trabalha? (escola, curso, emprego)", obrigatorio: false },
      { id: "rotina", tipo: "texto_longo", label: "Como é um dia comum na sua semana?", obrigatorio: false },
      {
        id: "rede_apoio", tipo: "multi_select", label: "Quem são as pessoas que te apoiam hoje?",
        obrigatorio: true,
        opcoes: ["Família", "Amigos", "Professores", "Pessoas da ONG ou projeto social", "Líderes religiosos ou comunitários", "Outros"],
      },
      { id: "gosta", tipo: "texto_longo", label: "O que você mais gosta de fazer? (hobbies, esportes, programas)", obrigatorio: false },
      { id: "te_descreveriam", tipo: "texto_longo", label: "Se seus amigos ou familiares fossem te descrever, o que diriam?", obrigatorio: false },
      { id: "expectativas", tipo: "texto_longo", label: "O que você espera da mentoria? O que quer conquistar com ela?", obrigatorio: true },
      {
        id: "pref_genero_mentor", tipo: "select", label: "Você tem preferência sobre o gênero da pessoa que vai te mentorar?",
        obrigatorio: true,
        opcoes: ["Sem preferência", "Mulher", "Homem"],
      },
      { id: "algo_mais", tipo: "texto_longo", label: "Tem algo mais que a gente deveria saber sobre você?", obrigatorio: false },
    ],
    ativo: true,
    versao: 1,
    created_by: null,
    created_at: haDias(240, "09:00"),
    updated_at: haDias(240, "09:00"),
  };

  const fAvaliacao360: Formulario = {
    id: uid(0x4005),
    titulo: "Avaliação 360º",
    descricao:
      "A avaliação formal de encerramento do ciclo, respondida por mentor(a) e mentorado(a): o vínculo construído, a evolução do(a) jovem, os resultados do PDM e da Roda da Vida e a experiência com o programa.",
    sistema: "avaliacao_360",
    campos: [
      { id: "vinculo", tipo: "escala_1_5", label: "Como você avalia o vínculo construído entre vocês ao longo da jornada?", obrigatorio: true },
      { id: "evolucao_jovem", tipo: "escala_1_5", label: "Quanto o(a) jovem evoluiu nos objetivos pessoais e profissionais durante o ciclo?", obrigatorio: true },
      { id: "pdm_roda", tipo: "escala_1_5", label: "Que diferença o PDM e a Roda da Vida fizeram no desenvolvimento?", obrigatorio: true },
      { id: "regularidade", tipo: "sim_nao", label: "Os encontros aconteceram com a regularidade combinada?", obrigatorio: true },
      { id: "experiencia_programa", tipo: "escala_1_5", label: "Como foi a sua experiência com o Programa de Mentoria Social?", obrigatorio: true },
      { id: "apoio_coordenacao", tipo: "escala_1_5", label: "Como você avalia o apoio da coordenação durante a jornada?", obrigatorio: false },
      { id: "o_que_leva", tipo: "texto_longo", label: "O que você leva dessa jornada? (aprendizados, conquistas, marcas)", obrigatorio: true },
      { id: "melhorar", tipo: "texto_longo", label: "O que o programa poderia melhorar?", obrigatorio: false },
      { id: "disponivel_proximo_ciclo", tipo: "sim_nao", label: "Se você é o(a) mentor(a): segue disponível pro próximo ciclo?", obrigatorio: false },
      { id: "capacidade_proximo_ciclo", tipo: "texto", label: "Se você é o(a) mentor(a): quantos jovens consegue acompanhar no próximo ciclo?", obrigatorio: false },
    ],
    ativo: true,
    versao: 1,
    created_by: null,
    created_at: haDias(240, "09:00"),
    updated_at: haDias(240, "09:00"),
  };

  const fAutoavaliacao: Formulario = {
    id: uid(0x4006),
    titulo: "Autoavaliação do mentor",
    descricao:
      "A reflexão de fim de ciclo do guia (cap. 14), respondida pelo(a) mentor(a) no encerramento da jornada.",
    sistema: "autoavaliacao_mentor",
    campos: [
      { id: "funcionou", tipo: "texto_longo", label: "O que eu fiz nesta mentoria que funcionou bem e quero repetir?", obrigatorio: true },
      { id: "falei_mais", tipo: "texto_longo", label: "Em que momentos eu falei mais do que escutei?", obrigatorio: true },
      { id: "competencias", tipo: "texto_longo", label: "Que competência do checklist evoluiu ao longo do ciclo? Qual ainda preciso desenvolver?", obrigatorio: true },
      { id: "aprendi", tipo: "texto_longo", label: "O que aprendi com este(a) jovem?", obrigatorio: true },
      { id: "faria_diferente", tipo: "texto_longo", label: "O que eu faria diferente em um próximo ciclo?", obrigatorio: true },
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

  const fMetas: Formulario = {
    id: uid(0x4008),
    titulo: "Definindo Minhas Metas",
    descricao:
      "Template do mentorado da sequência da Visão (PDF oficial): da Declaração de Visão para 3 a 5 metas com o porquê de cada uma — a dupla revisa no encontro seguinte com o modelo SMART.",
    sistema: "metas",
    campos: [
      { id: "s_visao", tipo: "secao", label: "Minha visão de futuro", obrigatorio: false, descricao: "No encontro anterior você construiu sua Declaração de Visão. Agora o passo é pensar: quais conquistas preciso alcançar para tornar essa visão realidade?" },
      { id: "declaracao_visao", tipo: "texto_longo", label: "Minha Declaração de Visão (copie ou reescreva a frase que você criou)", obrigatorio: true },
      { id: "preciso_criar", tipo: "texto", label: "Para me aproximar da minha visão, o que eu preciso CRIAR?", obrigatorio: false },
      { id: "preciso_aprender", tipo: "texto", label: "O que eu preciso APRENDER?", obrigatorio: false },
      { id: "preciso_melhorar", tipo: "texto", label: "O que eu preciso MELHORAR?", obrigatorio: false },
      { id: "preciso_eliminar", tipo: "texto", label: "O que eu preciso ELIMINAR?", obrigatorio: false },
      { id: "s_metas", tipo: "secao", label: "Minhas metas", obrigatorio: false, descricao: "Preencha de 3 a 5 metas. Dica: comece cada meta com um verbo de ação." },
      { id: "meta_1", tipo: "texto", label: "Minha meta 1", obrigatorio: true },
      { id: "porque_1", tipo: "texto_longo", label: "Por que a meta 1 é importante pra mim?", obrigatorio: true },
      { id: "meta_2", tipo: "texto", label: "Minha meta 2", obrigatorio: true },
      { id: "porque_2", tipo: "texto_longo", label: "Por que a meta 2 é importante pra mim?", obrigatorio: true },
      { id: "meta_3", tipo: "texto", label: "Minha meta 3", obrigatorio: true },
      { id: "porque_3", tipo: "texto_longo", label: "Por que a meta 3 é importante pra mim?", obrigatorio: true },
      { id: "meta_4", tipo: "texto", label: "Minha meta 4", obrigatorio: false },
      { id: "porque_4", tipo: "texto_longo", label: "Por que a meta 4 é importante pra mim?", obrigatorio: false },
      { id: "meta_5", tipo: "texto", label: "Minha meta 5", obrigatorio: false },
      { id: "porque_5", tipo: "texto_longo", label: "Por que a meta 5 é importante pra mim?", obrigatorio: false },
      { id: "s_revisao", tipo: "secao", label: "Antes do nosso próximo encontro…", obrigatorio: false, descricao: "Revise suas metas e marque. No próximo encontro vocês revisam juntos com o modelo SMART." },
      { id: "rev_ajudam", tipo: "sim_nao", label: "Minhas metas realmente me ajudam a chegar onde quero?", obrigatorio: true },
      { id: "rev_importantes", tipo: "sim_nao", label: "Elas são importantes pra mim?", obrigatorio: true },
      { id: "rev_claras", tipo: "sim_nao", label: "Consigo explicar claramente o que quero alcançar?", obrigatorio: true },
      { id: "meta_principal", tipo: "select", label: "Qual dessas metas é mais importante pra você neste momento?", obrigatorio: true, opcoes: ["Meta 1", "Meta 2", "Meta 3", "Meta 4", "Meta 5"] },
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
    // anamnese: dandara respondeu; eduardo e isabela pendentes
    {
      id: uid(0x4206), formulario_id: fAnamnese.id, token: DEMO_TOKENS.dandaraAnamnese,
      dest_profile_id: null, dest_mentorado_id: ment("Dandara"),
      dupla_id: duplaDe("Fernanda", "Dandara"), contexto: {},
      usado_em: haDias(4, "18:32"), expira_em: null, created_by: marina, created_at: haDias(6),
    },
    {
      id: uid(0x4207), formulario_id: fAnamnese.id, token: DEMO_TOKENS.eduardoAnamnese,
      dest_profile_id: null, dest_mentorado_id: ment("Eduardo"),
      dupla_id: duplaDe("João Pedro", "Eduardo"), contexto: {},
      usado_em: null, expira_em: null, created_by: marina, created_at: haDias(6),
    },
    {
      id: uid(0x4208), formulario_id: fAnamnese.id, token: DEMO_TOKENS.isabelaAnamnese,
      dest_profile_id: null, dest_mentorado_id: ment("Isabela"),
      dupla_id: duplaDe("Luiza", "Isabela"), contexto: {},
      usado_em: null, expira_em: null, created_by: marina, created_at: haDias(6),
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
    // anamnese oficial (0042): a Ana respondeu ao entrar (a notificação
    // formulario_respondido da Marina aponta pra este form); o Eduardo tem
    // link vigente pendente — a ficha dele mostra "reenviar/copiar" em vez
    // de "enviar"
    {
      id: uid(0x4210), formulario_id: fAnamneseOficial.id, token: DEMO_TOKENS.anaAnamneseOficial,
      dest_profile_id: null, dest_mentorado_id: ment("Ana"),
      dupla_id: duplaDe("Ricardo", "Ana"), contexto: { origem: "ficha" },
      usado_em: haDias(33, "19:12"), expira_em: null, created_by: marina, created_at: haDias(36),
    },
    {
      id: uid(0x4211), formulario_id: fAnamneseOficial.id, token: DEMO_TOKENS.eduardoAnamneseOficial,
      dest_profile_id: null, dest_mentorado_id: ment("Eduardo"),
      dupla_id: duplaDe("João Pedro", "Eduardo"), contexto: { origem: "ficha" },
      usado_em: null, expira_em: null, created_by: marina, created_at: haDias(6),
    },
    // 360º oficial: respondida pela Luiza no encerramento da dupla do ciclo
    // anterior (carimba checklist.avaliacao_360_enviada no encerramento
    // demo); o link da Isabela expirou sem resposta — a UI mostra o estado
    {
      id: uid(0x4212), formulario_id: fAvaliacao360.id, token: DEMO_TOKENS.luizaAvaliacao360,
      dest_profile_id: porNome("Luiza"), dest_mentorado_id: null,
      dupla_id: duplaDe("Luiza", "Isabela"), contexto: { origem: "ficha" },
      usado_em: haDias(233, "20:10"), expira_em: null, created_by: marina, created_at: haDias(238),
    },
    {
      id: uid(0x4213), formulario_id: fAvaliacao360.id, token: DEMO_TOKENS.isabelaAvaliacao360,
      dest_profile_id: null, dest_mentorado_id: ment("Isabela"),
      dupla_id: duplaDe("Luiza", "Isabela"), contexto: { origem: "ficha" },
      usado_em: null, expira_em: haDias(208), created_by: marina, created_at: haDias(238),
    },
    // autoavaliação oficial: a Luiza respondeu — é o que preencheu
    // encerramentos.autoavaliacao_mentor da dupla d-fim
    {
      id: uid(0x4214), formulario_id: fAutoavaliacao.id, token: DEMO_TOKENS.luizaAutoavaliacao,
      dest_profile_id: porNome("Luiza"), dest_mentorado_id: null,
      dupla_id: duplaDe("Luiza", "Isabela"), contexto: { origem: "ficha" },
      usado_em: haDias(235, "21:40"), expira_em: null, created_by: marina, created_at: haDias(238),
    },
    // 360º do encerramento em andamento (d-ok): o Ricardo respondeu — é o
    // que carimba checklist.avaliacao_360_enviada na fixture parcial
    {
      id: uid(0x4216), formulario_id: fAvaliacao360.id, token: DEMO_TOKENS.ricardoAvaliacao360,
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
      id: uid(0x4403), link_id: uid(0x4206),
      respostas: {
        moradia: "Mãe, padrasto e dois irmãos",
        nascimento: "2009-04-17",
        estudo: "Só estuda",
        apoios: ["Bolsa Família", "CRAS"],
        confirma: true,
        observacoes: "A família topa participar dos encontros de pais.",
      },
      respondido_em: haDias(4, "18:32"),
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
    // anamnese oficial da Ana — as chaves são os ids estáveis do instrumento
    {
      id: uid(0x4405), link_id: uid(0x4210),
      respostas: {
        quem_mora: "Moro com a minha mãe e meu irmão mais novo. A casa é pequena, mas a gente se ajuda — minha mãe trabalha o dia todo e eu cuido do meu irmão depois da escola.",
        territorio: "Vila Esperança, perto da quadra da ONG.",
        estuda: "sim",
        trabalha: "nao",
        onde_estuda_trabalha: "Escola Estadual Dom Paulo — 2º ano do ensino médio.",
        rotina: "Aula de manhã, almoço em casa, tarde ajudando meu irmão e fazendo lição. À noite vejo série com a minha mãe.",
        rede_apoio: ["Família", "Professores", "Pessoas da ONG ou projeto social"],
        gosta: "Desenhar e jogar vôlei na quadra.",
        te_descreveriam: "Que sou quieta no começo, mas que quando pego confiança não paro de falar.",
        expectativas: "Quero me preparar pro ENEM e entender qual carreira combina comigo.",
        pref_genero_mentor: "Mulher",
        algo_mais: "Fico nervosa de falar em público.",
      },
      respondido_em: haDias(33, "19:12"),
    },
    // 360º da Luiza — fim de jornada da dupla encerrada
    {
      id: uid(0x4406), link_id: uid(0x4212),
      respostas: {
        vinculo: 5,
        evolucao_jovem: 4,
        pdm_roda: 4,
        regularidade: "sim",
        experiencia_programa: 5,
        apoio_coordenacao: 5,
        o_que_leva: "A Isa me ensinou que constância vale mais que intensidade. Levo a amizade, as metas pequenas que viraram hábito e a certeza de que mentoria muda os dois lados.",
        melhorar: "Um encontro de troca entre mentores no meio do ciclo ajudaria a não me sentir sozinha nas dúvidas.",
        disponivel_proximo_ciclo: "sim",
        capacidade_proximo_ciclo: "1 jovem",
      },
      respondido_em: haDias(233, "20:10"),
    },
    // autoavaliação da Luiza — as 5 perguntas do cap. 14; é o texto que o
    // encerramento consolidou em autoavaliacao_mentor
    {
      id: uid(0x4407), link_id: uid(0x4214),
      respostas: {
        funcionou: "As metas pequenas da Isabela — cada semana com uma vitória visível manteve o ritmo.",
        falei_mais: "Nos primeiros encontros eu falei demais; quando passei a perguntar antes de sugerir, ela se abriu.",
        competencias: "Evoluiu a escuta ativa. A desenvolver: pedir feedback do jovem com mais frequência.",
        aprendi: "Com a Isa aprendi que persistência silenciosa vence talento com pressa.",
        faria_diferente: "Começaria o PDM já no primeiro encontro e revisaria a Roda da Vida a cada mês, não só no meio do ciclo.",
      },
      respondido_em: haDias(235, "21:40"),
    },
    // 360º do Ricardo — encerramento em andamento da d-ok (checklist
    // parcial: a autoavaliação e a decisão ainda não chegaram)
    {
      id: uid(0x4408), link_id: uid(0x4216),
      respostas: {
        vinculo: 4,
        evolucao_jovem: 4,
        pdm_roda: 3,
        regularidade: "sim",
        experiencia_programa: 5,
        apoio_coordenacao: 5,
        o_que_leva: "A Ana chegou travada com matemática e hoje monta o próprio cronograma. Levo a disciplina de metas pequenas — funciona com cliente também.",
        melhorar: "O registro semanal podia lembrar de responder as perguntas do encontro anterior — às vezes eu esqueço um combinado.",
        disponivel_proximo_ciclo: "sim",
        capacidade_proximo_ciclo: "1 jovem",
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
  ];

  return {
    formularios: [
      fAvaliacao,
      fAnamnese,
      fInscricao,
      fAnamneseOficial,
      fAvaliacao360,
      fAutoavaliacao,
      fVisao,
      fMetas,
      fPdm,
      fRodaVida,
      fAvaliacaoEsp,
    ],
    links,
    respostas,
  };
}

// ---------- derivações dos instrumentos oficiais (0042) ----------
// Mesma lógica das queries reais, sobre o dataset: as policies das 3 tabelas
// são coord-only, então os callers conferem o papel antes de chamar.

/** Estado da Anamnese Social de um mentorado — idem getAnamneseMentorado:
 *  última resposta ou link vigente pendente (o atalho da ficha reusa). */
export function demoAnamneseMentorado(
  role: AppRole,
  mentoradoId: string
): { formularioId: string; respondida_em: string | null; linkPendente: boolean } | null {
  if (role !== "coordenacao") return null; // RLS coord-only → null na real
  const { formularios, links, respostas } = getDemoFormularios();
  const form = formularios.find((f) => f.sistema === "anamnese");
  if (!form) return null;
  const agora = Date.now();
  let respondida_em: string | null = null;
  let linkPendente = false;
  for (const l of links
    .filter(
      (x) => x.formulario_id === form.id && x.dest_mentorado_id === mentoradoId
    )
    .sort((a, b) => b.created_at.localeCompare(a.created_at))) {
    if (l.usado_em) {
      respondida_em =
        respondida_em ??
        respostas.find((r) => r.link_id === l.id)?.respondido_em ??
        l.usado_em;
    } else if (!l.expira_em || new Date(l.expira_em).getTime() > agora) {
      linkPendente = true;
    }
  }
  return { formularioId: form.id, respondida_em, linkPendente };
}

/** Data da resposta 360º mais recente da dupla — idem
 *  getAvaliacao360DaDupla (join resposta ← link ← form oficial). */
export function demoAvaliacao360DaDupla(
  role: AppRole,
  duplaId: string
): string | null {
  if (role !== "coordenacao") return null;
  const { formularios, links, respostas } = getDemoFormularios();
  const form = formularios.find((f) => f.sistema === "avaliacao_360");
  if (!form) return null;
  const linkIds = new Set(
    links
      .filter((l) => l.formulario_id === form.id && l.dupla_id === duplaId)
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

  const form360 = getDemoFormularios().formularios.find(
    (f) => f.sistema === "avaliacao_360"
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
  const sistemasPainel = new Set([
    "visao",
    "metas",
    "pdm",
    "roda_vida",
    "avaliacao_360",
  ]);
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
        const s = f.sistema as keyof PainelJornadaLinha["entregas"];
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
