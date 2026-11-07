/** Documentos nativos de Materiais — os templates do cap. 14 do guia DPP
 *  renderizados pelo app em /materiais/documento/<slug> (não são arquivo nem
 *  link: o mentor copia o texto direto da página). O material aponta pra eles
 *  pela convenção `path = "doc:<slug>"` — a biblioteca resolve o href, sem
 *  passar pelo storage. */

export type DocBloco =
  | { kind: "par"; html: string }
  // ordenada=false → <ul> (listas "-" do corpus); ausente/true → <ol>
  | { kind: "lista"; itens: string[]; ordenada?: boolean }
  | { kind: "pergunta"; texto: string }
  | { kind: "subj"; texto: string }
  | { kind: "nota"; html: string }
  // marcacao: colunas > 0 desenham checkbox vazio (fichas de marcação do
  // cap. 14); sem a flag, toda célula renderiza o próprio conteúdo (tabelas
  // de dados do corpus)
  | {
      kind: "tabela";
      cabecalho: string[];
      linhas: string[][];
      marcacao?: boolean;
    };

export type MaterialDocumento = {
  slug: string;
  titulo: string;
  kicker: string;
  rotulo: string;
  objetivo: string;
  blocos: DocBloco[];
};

export const MATERIAIS_DOCUMENTOS: Record<string, MaterialDocumento> = {
  // cap. 14, item 1 — as 10 competências com as duas colunas de marcação;
  // com marcacao: true o renderer desenha o checkbox em toda coluna > 0,
  // então as células de "Já faço bem" / "Preciso desenvolver" vão vazias;
  // texto do corpus sanitizado em 04/11/2026, docs/rag/checklist-competencias.md
  "checklist-competencias": {
    slug: "checklist-competencias",
    titulo: "Checklist de competências do mentor",
    kicker: "INSTRUMENTO",
    rotulo: "início e fechamento do ciclo",
    objetivo:
      "Dez competências de escuta e condução para você marcar o que já faz bem e o que quer desenvolver, no início do ciclo e de novo no fechamento.",
    blocos: [
      { kind: "par", html: "Marque no início do ciclo o que já faz bem e o que quer desenvolver, e revisite a lista no fechamento." },
      {
        kind: "nota",
        html: "Marque como prioritário aquilo que você quer desenvolver e exercite esses pontos no dia a dia, com amigos, família e no trabalho, antes de aplicá-los na mentoria.",
      },
      {
        kind: "tabela",
        marcacao: true,
        cabecalho: ["Competência", "Já faço bem", "Preciso desenvolver"],
        linhas: [
          ["Escutar sem interromper e sem antecipar conclusões", "", ""],
          ["Fazer perguntas abertas em vez de dar respostas prontas", "", ""],
          ["Sustentar o silêncio quando o outro está pensando", "", ""],
          ["Dar feedback focado no comportamento, não na pessoa", "", ""],
          ["Reconhecer e nomear progressos concretos", "", ""],
          ["Admitir quando não sei algo", "", ""],
          ["Manter postura não julgadora diante de escolhas diferentes das minhas", "", ""],
          ["Cumprir combinados e avisar com antecedência quando preciso remarcar", "", ""],
          ["Separar o meu projeto de vida do projeto do(a) jovem", "", ""],
          ["Perceber quando uma questão extrapola o meu papel e acionar apoio", "", ""],
        ],
      },
    ],
  },
  // modelo de fala e cuidados do guia (cap. 07, "Feedback construtivo");
  // texto do corpus sanitizado em 04/11/2026, docs/rag/feedback-construtivo.md
  "feedback-construtivo": {
    slug: "feedback-construtivo",
    titulo: "Feedback Construtivo",
    kicker: "INSTRUMENTO",
    rotulo: "uso contínuo · encontros 5 a 8",
    objetivo:
      "Como dar um retorno que desenvolve: o modelo de fala do guia e os cuidados para feedback sobre comportamento negativo.",
    blocos: [
      {
        kind: "par",
        html: "O Feedback Construtivo melhora a autoconsciência, contribui para o aumento da autoconfiança, estimula a aprendizagem, eleva a motivação e incrementa o desempenho. Mesmo quando for necessário apontar aspectos negativos, o feedback deve ser construtivo. <b>Não precisa ser agendado:</b> pode surgir espontaneamente no decorrer de um encontro, desde que feito com responsabilidade e respeito.",
      },
      {
        kind: "nota",
        html: "<b>Modelo sugerido:</b> “Olha, quando acontece determinada situação, eu me sinto <i>(descreva como você se sente)</i>, porque <i>(explique o motivo)</i>. Eu gostaria que você considerasse <i>(apresente uma sugestão ou alternativa)</i>.” Em seguida, pergunte: “O que você pensa sobre o que acabei de dizer?”",
      },
      {
        kind: "par",
        html: "<b>Feedback sobre comportamento negativo:</b> mantenha o mesmo clima de acolhimento de todo o processo.",
      },
      {
        kind: "lista",
        itens: [
          "Aja com atitude não julgadora, confiança e respeito.",
          "Faça relatos baseados no que você realmente viu, percebeu ou sabe com segurança.",
          "Não rotule negativamente o(a) mentorado(a).",
          "Foque no comportamento, no fato ou no resultado, não na pessoa. Em vez de “Você não conseguiu concluir o trabalho”, diga “Percebi que o trabalho ainda não foi concluído”.",
          "Cuidado com palavras absolutas: tudo, nada, sempre, nunca.",
          "Pergunte o que ele(a) entendeu e abra espaço para discussão: “Você poderia resumir o que entendeu?”, “O que você acha sobre isso?”.",
          "Demonstre atenção à reação emocional: “Como você está se sentindo?”.",
        ],
      },
      {
        kind: "par",
        html: "Todo feedback deve resultar em uma <b>ação relevante</b> para o desenvolvimento do(a) jovem. Antes de encerrar, converse sobre isso: “Como a nossa conversa contribuiu para o que você precisa alcançar?”, “O que você vai fazer agora?”.",
      },
    ],
  },
  // template do guia (cap. 14, "Mensagem de preparação"); texto do corpus
  // sanitizado em 04/11/2026, docs/rag/mensagem-preparacao.md
  "mensagem-preparacao": {
    slug: "mensagem-preparacao",
    titulo: "Mensagem de preparação do(a) mentorado(a)",
    kicker: "TEMPLATE · MENSAGEM",
    rotulo: "antes do 1º encontro",
    objetivo: "Envie antes do primeiro encontro, assim que a dupla for formada.",
    blocos: [
      {
        kind: "nota",
        html: "<b>Dica:</b> adapte a linguagem ao seu jeito de escrever e à realidade do(a) jovem. É um ponto de partida, não um formulário obrigatório.",
      },
      { kind: "subj", texto: "Vamos começar a nossa mentoria!" },
      { kind: "par", html: "[Nome], seja muito bem-vindo(a) à mentoria!" },
      {
        kind: "par",
        html: "Muito prazer, meu nome é [seu nome] e vou ser seu(sua) mentor(a) ao longo do ciclo, com 16 encontros. Estou animado(a) com essa jornada e espero que a gente faça um bom trabalho junto.",
      },
      { kind: "par", html: "Para o nosso primeiro encontro, preciso de três coisas:" },
      {
        kind: "lista",
        itens: [
          "Os nomes e contatos de pelo menos <b>três amigos e três familiares</b> (e três colegas de trabalho, se você estiver trabalhando). Vou enviar a cada uma um link para responder duas perguntas rápidas sobre você. Avise essas pessoas de que o link vai chegar.",
          "Um <b>resumo da sua história de vida</b>, pessoal e profissional. Sugiro listar em ordem cronológica os fatos que foram importantes para você, formando uma linha do tempo. Não precisa me enviar: guarde para conversarmos no encontro.",
          "A sua <b>Roda da Vida</b> respondida na plataforma, com uma reflexão sobre as áreas que você mais gostaria de melhorar.",
        ],
      },
      {
        kind: "par",
        html: "Faça as tarefas em um lugar tranquilo, que permita refletir com calma. Tudo o que você compartilhar comigo é confidencial e fica entre nós, como será em todo o processo.",
      },
      { kind: "par", html: "Qualquer dúvida, é só me chamar. Até logo!" },
    ],
  },
  // template do guia (cap. 14, "Mensagem às pessoas indicadas"); na
  // plataforma a avaliação por terceiros roda por link, na ficha da dupla;
  // texto do corpus sanitizado em 04/11/2026, docs/rag/mensagem-indicadas.md
  "mensagem-indicadas": {
    slug: "mensagem-indicadas",
    titulo: "Mensagem às pessoas indicadas",
    kicker: "TEMPLATE · MENSAGEM",
    rotulo: "antes do 1º encontro",
    objetivo:
      "Envie a cada pessoa que o(a) jovem indicou o link dela, gerado na ficha da dupla na plataforma.",
    blocos: [
      {
        kind: "nota",
        html: "<b>Importante:</b> as respostas alimentam a avaliação inicial e ninguém saberá quem disse o quê. Diga isso com clareza, como no modelo.",
      },
      {
        kind: "subj",
        texto: "Sua contribuição para a mentoria de [nome do(a) jovem]",
      },
      { kind: "par", html: "Prezado(a) [nome]," },
      {
        kind: "par",
        html: "Meu nome é [seu nome]. [Nome do(a) jovem] está participando do Programa de Mentoria Social do Instituto Realiza.vc e eu sou o(a) mentor(a) que vai acompanhá-lo(a) nessa jornada.",
      },
      {
        kind: "par",
        html: "Para ajudar nesse trabalho, peço a sua colaboração respondendo a <b>duas perguntas rápidas</b> pelo link: [link]. Se puder, até [data].",
      },
      {
        kind: "par",
        html: "O seu nome foi indicado pelo(a) próprio(a) [nome do(a) jovem]. Não há obrigação de responder, mas a sua contribuição ajuda muito.",
      },
      {
        kind: "par",
        html: "As respostas serão lidas apenas por mim. Ao comentá-las com [nome do(a) jovem], <b>não indicarei quem disse o quê</b> e vou evitar expressões que possam identificar quem respondeu. Fique à vontade para responder com sinceridade.",
      },
      {
        kind: "pergunta",
        texto:
          "1. O que você considera pontos fortes de [nome], na vida pessoal e profissional? Por favor, explique.",
      },
      {
        kind: "pergunta",
        texto:
          "2. Em quais aspectos ele(a) precisaria melhorar para obter mais resultados na vida e no trabalho? Por favor, explique.",
      },
    ],
  },
  // template do guia (cap. 14, "Mensagem de encaminhamento entre encontros");
  // texto do corpus sanitizado em 04/11/2026, docs/rag/mensagem-encaminhamento.md
  "mensagem-encaminhamento": {
    slug: "mensagem-encaminhamento",
    titulo: "Mensagem de encaminhamento entre encontros",
    kicker: "TEMPLATE · MENSAGEM",
    rotulo: "entre todos os encontros",
    objetivo:
      "Uma mensagem curta depois de cada encontro mantém o vínculo vivo e deixa a tarefa clara.",
    blocos: [
      { kind: "subj", texto: "Sobre o nosso encontro" },
      { kind: "par", html: "[Nome]," },
      {
        kind: "par",
        html: "Gostei muito da nossa conversa de hoje. A sua abertura vai fazer diferença no nosso trabalho.",
      },
      {
        kind: "par",
        html: "Sempre que a conversa gerar alguma reflexão, anote e traga no próximo encontro. Se for algo urgente, me chame antes.",
      },
      {
        kind: "par",
        html: "<b>Próxima tarefa:</b> [descrever]. <b>Prazo:</b> [data].",
      },
      {
        kind: "par",
        html: "<b>Nosso próximo encontro:</b> [data e horário], já agendado na plataforma.",
      },
      { kind: "par", html: "Abraço!" },
    ],
  },
};

export function materialDocumento(slug: string): MaterialDocumento | null {
  return MATERIAIS_DOCUMENTOS[slug] ?? null;
}
