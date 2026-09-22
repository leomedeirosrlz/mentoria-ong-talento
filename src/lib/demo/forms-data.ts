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
import type { AppRole } from "../types";
import type {
  Formulario,
  FormularioLink,
  FormularioResposta,
} from "../forms/schema";

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
  // instrumentos oficiais (0042)
  anaAnamneseOficial: "demo-tok-anamnese-ana-ofic",
  eduardoAnamneseOficial: "demo-tok-anamnese-edu-ofic",
  luizaAvaliacao360: "demo-tok-360-luiza-oficial1",
  isabelaAvaliacao360: "demo-tok-360-isabela-oficia",
  luizaAutoavaliacao: "demo-tok-autoav-luiza-ofici",
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
      "Conte pra gente como foi o encontro desta semana — leva menos de 2 minutos e ajuda a coordenação a acompanhar a dupla.",
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
    titulo: "Anamnese social — família e contexto",
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
    titulo: "Inscrição — ciclo 2026/2027",
    descricao: "Formulário de inscrição de jovens pro ciclo 2026/2027 do programa.",
    campos: [
      { id: "nome", tipo: "texto", label: "Nome completo", obrigatorio: true },
      { id: "whatsapp", tipo: "texto", label: "WhatsApp com DDD", obrigatorio: true },
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
      "Ficha de conhecimento do(a) jovem, respondida antes do início da mentoria — quem você é, como é sua vida e o que espera do programa. Ajuda a coordenação no pareamento e orienta o trabalho do(a) mentor(a).",
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
    // inscrição: um genérico respondido antes do encerramento
    {
      id: uid(0x4209), formulario_id: fInscricao.id, token: DEMO_TOKENS.genericoInscricao,
      dest_profile_id: null, dest_mentorado_id: null, dupla_id: null,
      contexto: {}, usado_em: haDias(70, "14:05"), expira_em: null,
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
  ];

  return {
    formularios: [
      fAvaliacao,
      fAnamnese,
      fInscricao,
      fAnamneseOficial,
      fAvaliacao360,
      fAutoavaliacao,
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
