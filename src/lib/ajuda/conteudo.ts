import type { AppRole } from "@/lib/types";

// Conteúdo da Ajuda (REALIZA-345): dados puros, sem JSX — editar aqui não
// pede tocar em componente. Cada item declara os papéis pra quem vale e a
// página filtra pelos papéis efetivos de quem lê (primário + híbrido).
// Convenções de copy: sem travessão, "Material de apoio" pro acervo e
// "Instrumentos" pra PDM/Roda da Vida; voz do programa em 1ª pessoa do
// plural; pro jovem, linguagem simples e nada de telas de staff.

/** Atalhos de público usados nas declarações abaixo. */
const EQUIPE = ["coordenacao", "supervisor"] as const;
const TRILHA_DPP = [...EQUIPE, "mentor_dpp"] as const;
const STAFF = [...TRILHA_DPP, "mentor_especialista"] as const;
const TODOS = [...STAFF, "mentorado"] as const;

export type TemaAjuda =
  | "encontros"
  | "registro"
  | "combinados"
  | "apoio"
  | "materiais"
  | "conta";

/** A ordem do array é a ordem das seções na tela. */
export const TEMAS_AJUDA: { id: TemaAjuda; rotulo: string }[] = [
  { id: "encontros", rotulo: "Encontros e agenda" },
  { id: "registro", rotulo: "Registro do encontro" },
  { id: "combinados", rotulo: "Combinados" },
  { id: "apoio", rotulo: "Chamados e apoio" },
  { id: "materiais", rotulo: "Materiais de apoio e instrumentos" },
  { id: "conta", rotulo: "Conta e privacidade" },
];

/** Atalho direto ao fim da resposta — só quando a resposta manda a pessoa
 *  pra uma tela. `papeis` restringe quando o mesmo destino tem rota
 *  diferente por papel (a Agenda do mentor é /agenda, a do jovem
 *  /jovem/agenda); sem ele o link vale pra todo mundo que vê a pergunta. */
export type LinkAjuda = {
  rotulo: string;
  href: string;
  papeis?: readonly AppRole[];
};

export type PerguntaAjuda = {
  id: string;
  tema: TemaAjuda;
  pergunta: string;
  resposta: string;
  /** Peso dentro do tema: menor = dúvida mais comum, sobe na lista. Quem
   *  não declara fica no neutro (50) e a ordem do array desempata. */
  prioridade?: number;
  links?: LinkAjuda[];
  /** Papéis pra quem o item vale — basta um papel efetivo bater. */
  papeis: readonly AppRole[];
};

export const PERGUNTAS: PerguntaAjuda[] = [
  // ---------- Encontros e agenda ----------
  {
    id: "encontro-quem-marca",
    tema: "encontros",
    pergunta: "Quem marca os encontros?",
    resposta:
      "A própria dupla: o mentor agenda pela Agenda ou pela ficha da dupla e o jovem marca pela agenda dele. A coordenação acompanha tudo e lembra quando algo atrasa, mas não agenda no lugar de vocês.",
    prioridade: 10,
    links: [
      { rotulo: "Agenda", href: "/agenda" },
      { rotulo: "Duplas", href: "/duplas" },
    ],
    papeis: TRILHA_DPP,
  },
  {
    id: "encontro-quem-marca-jovem",
    tema: "encontros",
    pergunta: "Quem marca os encontros?",
    resposta:
      "Você e seu mentor combinam juntos. Na sua Agenda, toque em Agendar encontro e escolha o dia. A equipe acompanha vocês e lembra quando algo atrasa.",
    prioridade: 10,
    links: [{ rotulo: "Agenda", href: "/jovem/agenda" }],
    papeis: ["mentorado"],
  },
  {
    id: "encontro-quantos",
    tema: "encontros",
    pergunta: "Quantos encontros tem a mentoria?",
    resposta:
      "São 16 encontros, um por semana e quase sempre às terças, de cerca de uma hora. O ciclo inteiro dura uns quatro meses, com uma pausa de fim de ano no meio.",
    prioridade: 15,
    papeis: [...TRILHA_DPP, "mentorado"],
  },
  {
    id: "encontro-quantos-esp",
    tema: "encontros",
    pergunta: "Quantas sessões tem a trilha de especialista?",
    resposta:
      "Até 5 sessões de uma hora, dentro de 3 meses e em paralelo à mentoria principal do jovem.",
    prioridade: 15,
    papeis: ["mentor_especialista"],
  },
  {
    id: "encontro-remarcar",
    tema: "encontros",
    pergunta: "Preciso remarcar um encontro. Como faço?",
    resposta:
      "Abra o encontro na sua Agenda e toque em Remarcar pra escolher o novo dia. O combinado do programa é repor na mesma semana, então marquem a nova data logo. Cada mudança fica registrada com o motivo.",
    prioridade: 30,
    links: [
      { rotulo: "Agenda", href: "/agenda", papeis: ["mentor_dpp"] },
      { rotulo: "Agenda", href: "/jovem/agenda", papeis: ["mentorado"] },
    ],
    papeis: ["mentor_dpp", "mentorado"],
  },
  {
    id: "encontro-remarcar-staff",
    tema: "encontros",
    pergunta: "Quem remarca um encontro que não vai dar?",
    resposta:
      "A própria dupla: o mentor ou o jovem abre o encontro na agenda e escolhe outro dia. O programa combina com eles repor na mesma semana e cada mudança fica registrada com o motivo.",
    papeis: EQUIPE,
  },
  {
    id: "encontro-ja-foi",
    tema: "encontros",
    pergunta: "O encontro aconteceu, mas ninguém tinha marcado antes. E agora?",
    resposta:
      "Sem problema: o mentor registra como encontro já realizado. Na ficha da dupla ou na Agenda ele marca a data que já passou e a plataforma já pede o registro na sequência.",
    links: [
      { rotulo: "Agenda", href: "/agenda", papeis: ["mentor_dpp"] },
      { rotulo: "Duplas", href: "/duplas", papeis: ["mentor_dpp"] },
    ],
    papeis: TRILHA_DPP,
  },
  {
    id: "encontro-nao-rolou",
    tema: "encontros",
    pergunta: "E quando o encontro não acontece?",
    resposta:
      "A dupla avisa na agenda e o encontro fica como não aconteceu, com reposição na mesma semana. Falta sem reposição entra no radar da coordenação como atraso.",
    links: [{ rotulo: "Agenda", href: "/agenda", papeis: ["mentor_dpp"] }],
    papeis: TRILHA_DPP,
  },
  {
    id: "encontro-nao-rolou-jovem",
    tema: "encontros",
    pergunta: "E quando o encontro não acontece?",
    resposta:
      "Na sua Agenda você marca que o encontro não aconteceu e combinam outro dia na mesma semana. Avisar seu mentor antes ajuda os dois lados.",
    links: [{ rotulo: "Agenda", href: "/jovem/agenda" }],
    papeis: ["mentorado"],
  },
  {
    id: "encontro-especialista",
    tema: "encontros",
    pergunta: "Como o jovem ganha um mentor especialista?",
    resposta:
      "Pela ficha da dupla, nos botões do topo (no celular, no menu Mais): Solicitar mentor especialista manda o pedido pra equipe e Sugerir especialista pro jovem deixa a escolha com ele. A coordenação conecta o profissional da área e as sessões acontecem em paralelo à mentoria.",
    links: [{ rotulo: "Duplas", href: "/duplas" }],
    papeis: TRILHA_DPP,
  },
  {
    id: "encontro-especialista-jovem",
    tema: "encontros",
    pergunta: "O que são os especialistas?",
    resposta:
      "São mentores de um tema específico, tipo uma profissão ou uma prova. Em Especialistas você vê quem pode te ajudar e pede uma sessão; depois combina os horários pela sua Agenda.",
    links: [{ rotulo: "Especialistas", href: "/jovem/especialistas" }],
    papeis: ["mentorado"],
  },
  {
    id: "encontro-esp-sessao",
    tema: "encontros",
    pergunta: "Como nasce uma sessão com o jovem?",
    resposta:
      "Do pedido aceito: a demanda chega pra você com os horários possíveis e, aceitando, a sessão entra na sua agenda.",
    links: [{ rotulo: "Agenda", href: "/agenda" }],
    papeis: ["mentor_especialista"],
  },
  {
    id: "encontro-online",
    tema: "encontros",
    pergunta: "O encontro é online ou presencial?",
    resposta:
      "Como a dupla combinar: os dois jeitos valem. O link da videochamada fica salvo junto do agendamento pra estar à mão na hora.",
    prioridade: 20,
    papeis: TODOS,
  },

  // ---------- Registro do encontro ----------
  {
    id: "registro-o-que-e",
    tema: "registro",
    pergunta: "O que é o registro do encontro?",
    resposta:
      "O resumo que o mentor escreve depois de cada encontro: o que foi trabalhado, como foi, se apareceu alguma dificuldade e qual o próximo passo combinado. É ele que mantém a equipe por dentro da jornada.",
    prioridade: 15,
    papeis: TRILHA_DPP,
  },
  {
    id: "registro-onde",
    tema: "registro",
    pergunta: "Onde eu faço o registro?",
    resposta:
      "Na ficha da dupla, pelo botão Registrar encontro, ou na sua Agenda, na linha do encontro. Enquanto o resumo não existe, o encontro aparece como pendente de registro.",
    prioridade: 20,
    links: [
      { rotulo: "Agenda", href: "/agenda" },
      { rotulo: "Duplas", href: "/duplas" },
    ],
    papeis: ["mentor_dpp"],
  },
  {
    id: "registro-atraso",
    tema: "registro",
    pergunta: "Esqueci de registrar um encontro. Perdeu?",
    resposta:
      "Não: o registro continua aberto e a pendência fica marcada até você concluir. Quanto mais perto do encontro, mais fiel o resumo.",
    papeis: ["mentor_dpp"],
  },
  {
    id: "registro-quem-le",
    tema: "registro",
    pergunta: "Quem lê o que eu registro?",
    resposta:
      "A coordenação e o auxiliar executivo que acompanha a dupla. O jovem não lê o seu registro e a avaliação que ele faz só chega a você se ele marcar que pode compartilhar.",
    papeis: ["mentor_dpp"],
  },
  {
    id: "registro-jovem",
    tema: "registro",
    pergunta: "O que eu faço depois de cada encontro?",
    resposta:
      "Avalie como foi com as estrelinhas na sua Agenda. Você escolhe se o seu mentor pode ler cada avaliação; sem a sua marca, ele só vê a média. Também vale conferir os seus combinados na página inicial.",
    prioridade: 25,
    links: [
      { rotulo: "Agenda", href: "/jovem/agenda" },
      { rotulo: "Início", href: "/jovem" },
    ],
    papeis: ["mentorado"],
  },

  // ---------- Combinados ----------
  {
    id: "combinados-o-que-sao",
    tema: "combinados",
    pergunta: "O que são os combinados?",
    resposta:
      "O que você ou o jovem precisam fazer, cada item com o responsável e, se quiser, um prazo. Você anota no registro do encontro ou direto no card dele, na aba Encontros da ficha, logo abaixo do registro; dá pra anotar antes do encontro também, como preparo. O jovem vê na página inicial dele os combinados em que ele é o responsável.",
    prioridade: 20,
    links: [{ rotulo: "Duplas", href: "/duplas" }],
    papeis: TRILHA_DPP,
  },
  {
    id: "combinados-o-que-sao-jovem",
    tema: "combinados",
    pergunta: "O que são os combinados?",
    resposta:
      "As tarefas que você e seu mentor combinam pra você fazer até o próximo encontro. Ficam na sua página inicial, em Meus combinados.",
    prioridade: 20,
    links: [{ rotulo: "Início", href: "/jovem" }],
    papeis: ["mentorado"],
  },
  {
    id: "combinados-feito",
    tema: "combinados",
    pergunta: "Como marco um combinado como feito?",
    resposta:
      "Marque a caixinha do item no card do encontro, na aba Encontros da ficha, ou na aba Agora. Dá no mesmo: o que você marca num lugar aparece marcado no outro. O jovem marca os dele na página inicial dele.",
    prioridade: 30,
    links: [{ rotulo: "Duplas", href: "/duplas" }],
    papeis: ["mentor_dpp"],
  },
  {
    id: "combinados-feito-jovem",
    tema: "combinados",
    pergunta: "Como marco um combinado como feito?",
    resposta:
      "Na sua página inicial, em Meus combinados, toque na caixinha da tarefa. Seu mentor acompanha o andamento pelo lado dele.",
    prioridade: 30,
    links: [{ rotulo: "Início", href: "/jovem" }],
    papeis: ["mentorado"],
  },
  {
    id: "afazeres-o-que-sao",
    tema: "combinados",
    pergunta: "O que aconteceu com os afazeres?",
    resposta:
      "Viraram combinados. Os afazeres eram a sua lista de preparo de cada encontro; agora tudo fica numa lista só, no card do encontro, e cada item diz quem faz: você ou o jovem. Os seus o jovem não vê. O que ficou pendente aparece de novo no encontro seguinte, em De antes.",
    links: [{ rotulo: "Duplas", href: "/duplas" }],
    papeis: ["mentor_dpp", "mentor_especialista"],
  },
  {
    id: "afazeres-equipe",
    tema: "combinados",
    pergunta: "Onde ficaram os afazeres do mentor?",
    resposta:
      "Viraram combinados com o mentor como responsável, na mesma lista dos combinados da dupla, no card de cada encontro. A equipe lê na ficha da dupla e pode marcar como feito; o jovem só vê os combinados em que ele é o responsável.",
    links: [{ rotulo: "Duplas", href: "/duplas" }],
    papeis: EQUIPE,
  },

  // ---------- Chamados e apoio ----------
  {
    id: "apoio-pedir",
    tema: "apoio",
    pergunta: "Preciso de ajuda com a dupla. O que faço?",
    resposta:
      "Use o botão Pedir apoio na ficha da dupla. O pedido chega na fila da equipe na hora e você acompanha a resposta em Meus chamados, na sua página inicial.",
    prioridade: 20,
    links: [
      { rotulo: "Duplas", href: "/duplas" },
      { rotulo: "Meus chamados", href: "/chamados" },
    ],
    papeis: ["mentor_dpp", "mentor_especialista"],
  },
  {
    id: "apoio-pedir-jovem",
    tema: "apoio",
    pergunta: "Preciso de ajuda. Com quem eu falo?",
    resposta:
      "Toque em Precisa de ajuda? Fale com a equipe, na sua página inicial, ou chame a coordenação no WhatsApp que fica ao lado. Você acompanha a resposta no seu Perfil, em Meus pedidos de ajuda.",
    prioridade: 20,
    links: [
      { rotulo: "Início", href: "/jovem" },
      { rotulo: "Perfil", href: "/jovem/perfil" },
    ],
    papeis: ["mentorado"],
  },
  {
    id: "apoio-fila",
    tema: "apoio",
    pergunta: "Como funciona a fila de Chamados?",
    resposta:
      "É a caixa de entrada dos pedidos de apoio e de ajuda. Quem assumir primeiro trata e a resposta combinada sai em 1 dia útil. O que está sem dono aparece com o contador no menu.",
    links: [{ rotulo: "Chamados", href: "/chamados" }],
    papeis: EQUIPE,
  },
  {
    id: "apoio-apos",
    tema: "apoio",
    pergunta: "O que acontece depois que eu peço apoio?",
    resposta:
      "A equipe é avisada na hora e o pedido entra na fila: quem assumir primeiro trata, com resposta combinada em 1 dia útil. Você acompanha o andamento em Meus chamados, na sua página inicial.",
    links: [{ rotulo: "Meus chamados", href: "/chamados" }],
    papeis: ["mentor_dpp", "mentor_especialista"],
  },
  {
    id: "apoio-cores",
    tema: "apoio",
    pergunta: "O que significam as cores de situação das duplas?",
    resposta:
      "É a leitura de saúde do acompanhamento: amarelo pede atenção (um atraso, registro pendente ou combinado vencido) e vermelho pede ação (pedido de apoio, avaliação baixa com dificuldade ou dois atrasos). A contagem é a mesma em todas as telas.",
    prioridade: 30,
    papeis: STAFF,
  },

  // ---------- Materiais de apoio e instrumentos ----------
  {
    id: "materiais-onde",
    tema: "materiais",
    pergunta: "Onde estão os guias e materiais de apoio?",
    resposta:
      "Em Materiais de apoio, no menu: a aba Instrumentos mostra a régua da jornada por encontro e a aba Biblioteca tem os guias completos, técnicas e modelos pra consultar quando quiser.",
    prioridade: 20,
    links: [
      { rotulo: "Instrumentos", href: "/materiais?aba=instrumentos" },
      { rotulo: "Biblioteca", href: "/materiais?aba=biblioteca" },
    ],
    papeis: TRILHA_DPP,
  },
  {
    id: "materiais-onde-esp",
    tema: "materiais",
    pergunta: "Onde estão os materiais de apoio?",
    resposta:
      "Em Materiais de apoio, no menu, fica a biblioteca do programa: guias, técnicas e modelos pra consultar quando quiser.",
    prioridade: 20,
    links: [{ rotulo: "Materiais de apoio", href: "/materiais" }],
    papeis: ["mentor_especialista"],
  },
  {
    id: "materiais-onde-jovem",
    tema: "materiais",
    pergunta: "Onde estão meus materiais de apoio?",
    resposta:
      "Em Materiais, em Acervo. É lá que ficam os conteúdos pra ler e consultar quando quiser.",
    prioridade: 20,
    links: [{ rotulo: "Materiais", href: "/jovem/materiais" }],
    papeis: ["mentorado"],
  },
  {
    id: "materiais-instrumentos",
    tema: "materiais",
    pergunta: "Onde ficam o PDM e a Roda da Vida?",
    resposta:
      "São instrumentos da plataforma, preenchidos junto com o jovem: ficam na ficha da dupla, na aba Instrumentos, e a régua de Materiais acompanha o andamento.",
    prioridade: 30,
    links: [
      { rotulo: "Duplas", href: "/duplas" },
      { rotulo: "Instrumentos", href: "/materiais?aba=instrumentos" },
    ],
    papeis: TRILHA_DPP,
  },
  {
    id: "materiais-instrumentos-jovem",
    tema: "materiais",
    pergunta: "Onde ficam meus instrumentos?",
    resposta:
      "Em Materiais, em Meus instrumentos. Cada um abre na hora certa: o seu plano de desenvolvimento no começo da mentoria e a Roda da Vida perto do fim.",
    prioridade: 30,
    links: [{ rotulo: "Materiais", href: "/jovem/materiais" }],
    papeis: ["mentorado"],
  },
  {
    // texto do instrumento-pdm (docs/rag), na voz do jovem
    id: "materiais-pdm-jovem",
    tema: "materiais",
    pergunta: "O que é o PDM?",
    resposta:
      "É o seu Plano de Desenvolvimento: o seu projeto de vida por escrito, feito junto com o seu mentor. No topo vai a sua visão de futuro; embaixo, as suas metas, cada uma com prazo e um jeito de medir se deu certo, quebradas em passos pequenos. Ele nasce nos quatro primeiros encontros e muda com você ao longo do ciclo.",
    links: [{ rotulo: "Meu PDM", href: "/jovem/pdm" }],
    papeis: ["mentorado"],
  },
  {
    id: "materiais-em-breve",
    tema: "materiais",
    pergunta: "Por que tem material marcado como em breve?",
    resposta:
      "A coordenação publica os documentos oficiais ao longo do ciclo. O que ainda não foi liberado aparece como em breve até a publicação.",
    papeis: TRILHA_DPP,
  },
  {
    id: "materiais-360",
    tema: "materiais",
    pergunta: "Onde fica a avaliação final da mentoria?",
    resposta:
      "No fim da jornada a plataforma abre a Avaliação Geral 360º, uma pra cada lado da dupla. O jovem responde na jornada dele, no último encontro; o mentor responde pelo link que a equipe envia. A régua de Instrumentos mostra quem já respondeu.",
    links: [
      { rotulo: "Instrumentos", href: "/materiais?aba=instrumentos" },
    ],
    papeis: TRILHA_DPP,
  },
  {
    id: "materiais-360-jovem",
    tema: "materiais",
    pergunta: "Onde eu respondo a avaliação final?",
    resposta:
      "No último encontro abre a Avaliação Geral 360º em Materiais. É a sua chance de contar como foi a mentoria pra você.",
    links: [{ rotulo: "Materiais", href: "/jovem/materiais" }],
    papeis: ["mentorado"],
  },

  // ---------- Conta e privacidade ----------
  {
    id: "conta-entrar",
    tema: "conta",
    pergunta: "Como entro na plataforma?",
    resposta:
      "Pelo e-mail que a coordenação cadastrou: na tela de entrada você pede um link de acesso e ele chega no seu e-mail. Abra o link e a entrada acontece na tela que pediu, mesmo se o e-mail for aberto em outro navegador ou no celular.",
    prioridade: 10,
    papeis: TODOS,
  },
  {
    id: "conta-link",
    tema: "conta",
    pergunta: "O link de acesso expirou ou não funcionou",
    resposta:
      "Os links valem uma entrada só e têm validade curta. Peça um novo na tela de entrada e o antigo para de valer.",
    prioridade: 30,
    papeis: TODOS,
  },
  {
    id: "conta-senha",
    tema: "conta",
    pergunta: "Preciso de senha?",
    resposta:
      "Não: a entrada do dia a dia é sempre pelo link de e-mail. No primeiro acesso a plataforma oferece criar uma senha, mas dá pra pular.",
    prioridade: 20,
    links: [
      { rotulo: "Perfil", href: "/perfil", papeis: STAFF },
      { rotulo: "Perfil", href: "/jovem/perfil", papeis: ["mentorado"] },
    ],
    papeis: TODOS,
  },
  {
    id: "conta-notificacoes",
    tema: "conta",
    pergunta: "Como fico sabendo das novidades?",
    resposta:
      "O sino no topo da tela acende quando tem algo seu: encontro marcado, resposta de um pedido, material novo. Toque nele pra ver a lista.",
    papeis: TODOS,
  },
  {
    id: "conta-quem-ve",
    tema: "conta",
    pergunta: "Quem vê as minhas informações?",
    resposta:
      "Cada papel vê só o que precisa pra trabalhar: o mentor acompanha a própria dupla, o auxiliar executivo as duplas supervisionadas e a coordenação o programa todo. Dados sensíveis ficam só com a coordenação.",
    papeis: STAFF,
  },
  {
    id: "conta-quem-ve-jovem",
    tema: "conta",
    pergunta: "Quem vê as minhas informações?",
    resposta:
      "Você vê só as suas coisas: seus encontros, suas respostas e seu acervo. Seus dados pessoais ficam com a coordenação e o seu contato só vai pros colegas se você permitir no seu Perfil.",
    links: [{ rotulo: "Perfil", href: "/jovem/perfil" }],
    papeis: ["mentorado"],
  },
  {
    id: "conta-sair",
    tema: "conta",
    pergunta: "Como saio da minha conta?",
    resposta:
      "No computador, o botão Sair fica no fim da barra lateral. No celular, ele fica no Menu, junto do seu nome.",
    papeis: STAFF,
  },
  {
    id: "conta-sair-jovem",
    tema: "conta",
    pergunta: "Como saio da minha conta?",
    resposta: "Toque no ícone de sair no topo da tela. Ele também está no Menu.",
    papeis: ["mentorado"],
  },
];

// ---------- Como funciona ----------

export type ItemComoFunciona = { rotulo: string; texto: string };

export type SecaoComoFunciona = {
  id: string;
  titulo: string;
  intro?: string;
  itens: ItemComoFunciona[];
  /** Papéis pra quem a seção vale — basta um papel efetivo bater. */
  papeis: readonly AppRole[];
};

/** Item do "Onde fica cada coisa" depois do merge por papéis efetivos
 *  (menuDoPapel): o mesmo destino pode carregar a descrição de mais de um
 *  papel — o híbrido lê o que aquele lugar é em cada mundo dele, um texto
 *  por linha, na ordem em que os papéis vieram. */
export type ItemMenuPapel = { rotulo: string; textos: string[] };

export const COMO_FUNCIONA: SecaoComoFunciona[] = [
  {
    id: "jornada",
    titulo: "A jornada do programa",
    intro:
      "A mentoria principal é uma jornada de 16 encontros semanais, quase sempre às terças, em seis fases. No meio do caminho tem uma pausa de fim de ano.",
    itens: [
      {
        rotulo: "Encontros 1 a 4",
        texto:
          "Criar vínculo e construir o plano: visão de futuro, metas e submetas do PDM.",
      },
      {
        rotulo: "Encontros 5 a 7",
        texto:
          "Colocar o plano em prática: as primeiras submetas andam e os obstáculos aparecem.",
      },
      {
        rotulo: "Encontros 8 e 9",
        texto:
          "Consolidar a autonomia: o jovem conduz cada vez mais e a dupla revisa o meio do caminho.",
      },
      {
        rotulo: "Encontros 10 e 11",
        texto:
          "Aprofundar o vínculo e o aprendizado: o papel de modelo e a rede de apoio.",
      },
      {
        rotulo: "Encontros 12 a 14",
        texto:
          "Roda da Vida: as áreas da vida do jovem e o plano de continuidade.",
      },
      {
        rotulo: "Encontros 15 e 16",
        texto:
          "Encerrar e celebrar: revisão da jornada, avaliação final e despedida.",
      },
      {
        rotulo: "Trilha de especialista",
        texto:
          "Em paralelo, até 5 sessões em 3 meses pra uma demanda específica do jovem.",
      },
    ],
    papeis: STAFF,
  },
  {
    id: "jornada-jovem",
    titulo: "Como é a mentoria",
    intro:
      "A mentoria é uma jornada de encontros semanais com o seu mentor, do primeiro papo até a celebração.",
    itens: [
      {
        rotulo: "16 encontros",
        texto:
          "Um por semana, de cerca de uma hora. Vocês marcam juntos o melhor dia.",
      },
      {
        rotulo: "Começo",
        texto:
          "Vocês se conhecem e montam o seu plano de desenvolvimento, com as metas que você escolhe.",
      },
      {
        rotulo: "Meio",
        texto:
          "O plano sai do papel: cada encontro acompanha o que você está fazendo.",
      },
      {
        rotulo: "Fim",
        texto:
          "Você olha pra sua vida inteira na Roda da Vida e fecha a jornada com uma celebração.",
      },
      {
        rotulo: "Especialistas",
        texto:
          "Se surgir uma dúvida específica, você pode ter sessões com um mentor especialista no assunto.",
      },
    ],
    papeis: ["mentorado"],
  },
  {
    id: "papeis",
    titulo: "Quem faz o programa",
    itens: [
      {
        rotulo: "Coordenação",
        texto:
          "Cuida do programa inteiro: seleção, formação das duplas, acompanhamento e avaliação.",
      },
      {
        rotulo: "Auxiliar executivo",
        texto:
          "Acompanha um grupo de duplas de perto e ajuda a destravar o que precisar.",
      },
      {
        rotulo: "Mentor DPP",
        texto:
          "Conduz a jornada semanal do jovem: agenda os encontros, registra e preenche os instrumentos.",
      },
      {
        rotulo: "Mentor especialista",
        texto: "Atende uma demanda específica do jovem em até 5 sessões.",
      },
      {
        rotulo: "Mentorado",
        texto:
          "O jovem, dono do plano: participa dos encontros, responde os instrumentos e avalia como foi cada um.",
      },
    ],
    papeis: STAFF,
  },
  {
    id: "papeis-jovem",
    titulo: "Quem está com você",
    itens: [
      {
        rotulo: "Seu mentor",
        texto: "A pessoa que te acompanha toda semana na jornada.",
      },
      {
        rotulo: "Especialistas",
        texto:
          "Mentores de um tema específico, pra quando você precisar de uma ajuda pontual.",
      },
      {
        rotulo: "Coordenação",
        texto: "A equipe que cuida do programa e de vocês.",
      },
      {
        rotulo: "Auxiliar executivo",
        texto: "Acompanha sua dupla de perto pra ajudar no que precisar.",
      },
    ],
    papeis: ["mentorado"],
  },
  {
    id: "ciclo",
    titulo: "O ciclo de um encontro",
    intro: "O que a agenda mostra de cada encontro, na ordem em que acontece.",
    itens: [
      {
        rotulo: "Semana sugerida",
        texto:
          "O calendário oficial do ciclo marca a semana de cada encontro. É a referência do programa, não um agendamento.",
      },
      {
        rotulo: "Agendado",
        texto:
          "A dupla marcou dia e hora na plataforma. Remarcou? A data anda e o motivo fica registrado.",
      },
      {
        rotulo: "Realizado, falta o registro",
        texto:
          "O encontro aconteceu e o resumo ainda não foi escrito. É a pendência que a agenda destaca.",
      },
      {
        rotulo: "Registrado",
        texto: "Encontro concluído: resumo gravado e combinados atualizados.",
      },
      {
        rotulo: "Não aconteceu",
        texto:
          "A dupla avisou que não rolou e repõe na mesma semana, o combinado do programa.",
      },
    ],
    papeis: TRILHA_DPP,
  },
  {
    id: "ciclo-jovem",
    titulo: "Como é um encontro",
    itens: [
      {
        rotulo: "Antes",
        texto:
          "Vocês marcam juntos pela agenda. A semana de cada encontro já vem sugerida.",
      },
      {
        rotulo: "No dia",
        texto:
          "O encontro acontece online ou presencial, perto de uma hora. Se não der, avisem e remarquem na mesma semana.",
      },
      {
        rotulo: "Depois",
        texto:
          "Você avalia como foi com as estrelinhas e seu mentor registra o resumo. Os combinados ficam na sua página inicial.",
      },
    ],
    papeis: ["mentorado"],
  },
];

/** Mapa do menu por papel — matéria-prima da seção "Onde fica cada coisa"
 *  da aba Como funciona. menuDoPapel mergeia os mapas dos papéis efetivos
 *  na ordem recebida (o primário primeiro), dedup pelo rótulo do destino:
 *  o híbrido não fica preso ao mapa do papel de entrada. */
export const MENU_DO_PAPEL: { papel: AppRole; itens: ItemComoFunciona[] }[] = [
  {
    papel: "coordenacao",
    itens: [
      {
        rotulo: "Visão geral",
        texto:
          "A saúde do programa de cara: duplas por situação, pendências e o que pede atenção.",
      },
      {
        rotulo: "Duplas",
        texto: "A lista de todas as duplas e a ficha de cada uma.",
      },
      {
        rotulo: "Agenda",
        texto: "O monitoramento da semana e o calendário oficial do ciclo.",
      },
      {
        rotulo: "Chamados",
        texto:
          "A fila de pedidos de apoio e ajuda: quem assumir primeiro trata.",
      },
      {
        rotulo: "Materiais de apoio",
        texto: "Os instrumentos da jornada e a biblioteca de materiais de apoio.",
      },
      {
        rotulo: "Formulários",
        texto: "Os formulários do programa e os links de resposta.",
      },
      {
        rotulo: "Turmas",
        texto: "As turmas do ciclo e o trabalho de matching.",
      },
      {
        rotulo: "Registros",
        texto: "Os resumos de encontro escritos pelos mentores.",
      },
      {
        rotulo: "Relatórios",
        texto: "Os relatórios e exportações do programa.",
      },
      {
        rotulo: "Pessoas",
        texto: "O diretório de mentores, mentorados e equipe.",
      },
      {
        rotulo: "Ajuda",
        texto: "Esta página: perguntas frequentes e o mapa do programa.",
      },
    ],
  },
  {
    papel: "supervisor",
    itens: [
      {
        rotulo: "Visão geral",
        texto:
          "Suas duplas de cara: situação, pendências e o que pede atenção.",
      },
      {
        rotulo: "Duplas",
        texto: "As duplas que você acompanha e a ficha de cada uma.",
      },
      {
        rotulo: "Agenda",
        texto: "Sua turma por semana e a visão consolidada.",
      },
      {
        rotulo: "Chamados",
        texto:
          "A fila de pedidos de apoio e ajuda: quem assumir primeiro trata.",
      },
      {
        rotulo: "Materiais de apoio",
        texto: "Os instrumentos da jornada e a biblioteca de materiais de apoio.",
      },
      {
        rotulo: "Registros",
        texto: "Os resumos de encontro das suas duplas.",
      },
      {
        rotulo: "Pessoas",
        texto: "As pessoas das suas duplas.",
      },
      {
        rotulo: "Ajuda",
        texto: "Esta página: perguntas frequentes e o mapa do programa.",
      },
    ],
  },
  {
    papel: "mentor_dpp",
    itens: [
      {
        rotulo: "Visão geral",
        texto:
          "Sua semana de cara: próximos encontros, registros pendentes e novidades.",
      },
      {
        rotulo: "Duplas",
        texto:
          "Suas duplas e a ficha de cada uma: é lá que você agenda, registra e preenche os instrumentos.",
      },
      {
        rotulo: "Agenda",
        texto: "Minha agenda, Por mentorado e o Calendário do ciclo.",
      },
      {
        rotulo: "Materiais de apoio",
        texto: "Os roteiros de cada encontro e a biblioteca de materiais de apoio.",
      },
      {
        rotulo: "Pessoas",
        texto: "As pessoas das suas duplas.",
      },
      {
        rotulo: "Ajuda",
        texto: "Esta página: perguntas frequentes e o mapa do programa.",
      },
    ],
  },
  {
    papel: "mentor_especialista",
    itens: [
      {
        rotulo: "Visão geral",
        texto: "Seus atendimentos e os pedidos em aberto.",
      },
      {
        rotulo: "Duplas",
        texto: "As duplas que você atende e a ficha de cada uma.",
      },
      {
        rotulo: "Agenda",
        texto: "Sua grade de horários e as sessões marcadas.",
      },
      {
        rotulo: "Materiais de apoio",
        texto: "A biblioteca de materiais de apoio.",
      },
      {
        rotulo: "Pessoas",
        texto: "As pessoas das duplas que você atende.",
      },
      {
        rotulo: "Ajuda",
        texto: "Esta página: perguntas frequentes e o mapa do programa.",
      },
    ],
  },
  {
    papel: "mentorado",
    itens: [
      {
        rotulo: "Início",
        texto: "Seu resumo: próximo encontro, combinados e novidades.",
      },
      {
        rotulo: "Agenda",
        texto:
          "Seus encontros marcados, o que já rolou e os horários de especialista.",
      },
      {
        rotulo: "Especialistas",
        texto:
          "O catálogo de mentores de temas específicos pra pedir uma sessão.",
      },
      {
        rotulo: "Pessoas",
        texto: "Seu mentor, a coordenação e seus contatos.",
      },
      {
        rotulo: "Materiais",
        texto: "Seus instrumentos e o acervo de materiais de apoio.",
      },
      {
        rotulo: "Perfil",
        texto: "Seus dados, seus pedidos de ajuda e suas preferências de contato.",
      },
      {
        rotulo: "Ajuda",
        texto: "Esta página: perguntas frequentes e o mapa da mentoria.",
      },
    ],
  },
];
