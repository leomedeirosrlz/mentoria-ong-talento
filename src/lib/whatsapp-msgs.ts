// Catálogo único das mensagens de WhatsApp que a coordenação/supervisão manda
// pra dupla — antes viviam espalhadas em 3 lugares com textos divergentes
// (dashboard, agenda, ficha). Cada contexto rende uma mensagem por
// destinatário; a 1ª pessoa é quem envia (autorNome — sem ele, "a equipe do
// Realiza.vc", que cobre coordenação e supervisão sem mentir o papel).
//
// Tom por destinatário:
//   · mentor — cobrança direta e cordial sobre a anomalia (agendar, registrar,
//     confirmar): a operação da mentoria é dever dele
//   · mentorado — check-in gentil ("tudo bem? passando pra ver se precisa de
//     algo") com o contexto em versão leve: o jovem não é cobrado pela
//     operação, mas é canal seguro quando a dupla some

export type ContextoWA =
  | "apoio"
  | "limbo"
  | "registro_pendente"
  | "sem_encontro"
  | "combinado"
  | "atencao"
  | "generico";

export type InfoWA = {
  mentorNome?: string;
  mentoradoNome?: string;
  /** Nome de quem envia — vira "Aqui é {nome}, da equipe do Realiza.vc". */
  autorNome?: string;
  /** Complemento do contexto — ex.: "3º" do encontro, o combinado vencido. */
  extra?: string;
};

/** Par de mensagens prontas pra uma dupla. Os campos são opcionais: um
 *  contexto pode não justificar mensagem pra uma das pontas e o chamador
 *  decide o que renderiza (número ausente também pode zerar o destino). */
export type MsgsContato = {
  mentor?: string;
  mentorado?: string;
};

/** Check-in da fila "Aguardando par" (REALIZA-101) — quem se inscreveu e
 *  ainda não tem par. O catálogo acima é por dupla (as mensagens falam "da
 *  mentoria com fulano"); aqui a pessoa está sozinha — jovem recebe
 *  acolhida com promessa de retorno, mentor da reserva recebe uma
 *  confirmação de disponibilidade. `autorNome` assina como no catálogo. */
export function msgAguardandoPar(
  lado: "mentor" | "mentorado",
  nome: string,
  autorNome?: string
): string {
  const oi = pn(nome) ? `Oi ${pn(nome)}` : "Oi";
  return lado === "mentorado"
    ? `${oi}, tudo bem? ${autoria(autorNome)}. Sua inscrição no Programa de Mentoria já está com a gente — estamos cuidando do seu pareamento e te aviso assim que fechar. Precisa de algo por aí?`
    : `${oi}, tudo bem? ${autoria(autorNome)}. Passando pra confirmar: você segue na reserva de mentores pra próxima dupla. A disponibilidade continua a mesma?`;
}

/** Forma alternativa de chamada (saudação neutra + caso em texto livre por
 *  ponta) — cobre o que o catálogo ainda não expressa, como fecho com link
 *  direto pro registro embutido na mensagem. Preferir o catálogo por
 *  contexto quando o caso cabe num ContextoWA. */
export type CtxWhatsApp = {
  /** Primeiro nome de quem envia (coord/supervisor). Assina a mensagem pro
   *  mentorado; sem ele, a assinatura é "a equipe". */
  eu?: string;
  /** Primeiro nome do mentor. */
  mentorNome: string;
  /** Primeiro nome do mentorado. */
  mentoradoNome: string;
};

const pn = (nome: string | undefined): string =>
  nome?.trim().split(/\s+/)[0] ?? "";

const oiM = (i: InfoWA): string => (pn(i.mentorNome) ? `Oi ${pn(i.mentorNome)}` : "Oi");
const oiMd = (i: InfoWA): string => (pn(i.mentoradoNome) ? `Oi ${pn(i.mentoradoNome)}` : "Oi");
const comMd = (i: InfoWA): string => (pn(i.mentoradoNome) ? ` com ${pn(i.mentoradoNome)}` : "");
const comM = (i: InfoWA): string => (pn(i.mentorNome) ? ` com ${pn(i.mentorNome)}` : "");
const oExtra = (i: InfoWA): string => (i.extra ? `${i.extra} ` : "");

const autoria = (autorNome: string | undefined): string =>
  pn(autorNome)
    ? `Aqui é ${pn(autorNome)}, da equipe do Realiza.vc`
    : "Aqui é a equipe do Realiza.vc";

type Msgs = { mentor?: (i: InfoWA) => string; mentorado?: (i: InfoWA) => string };

const CATALOGO: Record<ContextoWA, Msgs> = {
  // o pedido de apoio partiu do mentor — só ele recebe; o mentorado não é
  // canal de resposta pra um pedido que não é dele
  apoio: {
    mentor: (i) =>
      `${oiM(i)}, tudo bem? ${autoria(i.autorNome)}. Vi o seu pedido de apoio no registro da mentoria${comMd(i)}. O que está rolando? Pode contar comigo.`,
  },
  // agendado vencido sem virar realizado — a pergunta honesta é "rolou?"
  limbo: {
    mentor: (i) =>
      `${oiM(i)}, tudo bem? ${autoria(i.autorNome)}. O ${oExtra(i)}encontro de vocês estava agendado e já passou. Rolou? Se rolou, dá pra registrar como foi; se não, vale remarcar.`,
    mentorado: (i) =>
      `${oiMd(i)}, tudo bem? ${autoria(i.autorNome)}. Passando pra ver se precisa de algo. O encontro${comM(i)} estava marcado pra esses dias. Rolou direitinho?`,
  },
  // realizado sem follow-up — o registro é do mentor
  registro_pendente: {
    mentor: (i) =>
      `${oiM(i)}, tudo bem? ${autoria(i.autorNome)}. Vi que o encontro${comMd(i)} rolou, mas ainda falta o registro. Consegue preencher hoje? Leva poucos minutos.`,
    mentorado: (i) =>
      `${oiMd(i)}, tudo bem? ${autoria(i.autorNome)}. Passando pra ver como foi o encontro${comM(i)} e se precisa de algo por aqui.`,
  },
  // a coorte invisível: a semana oficial abriu e a dupla ainda não marcou
  sem_encontro: {
    mentor: (i) =>
      `${oiM(i)}! ${autoria(i.autorNome)}. Passando pra lembrar de marcar o ${oExtra(i)}encontro de vocês${comMd(i)}. A semana oficial já está aberta. Qualquer coisa me chama :)`,
    mentorado: (i) =>
      `${oiMd(i)}, tudo bem? ${autoria(i.autorNome)}. Passando pra ver se precisa de algo. A agenda do ${oExtra(i)}encontro${comM(i)} ainda está livre. Vale combinar um horário.`,
  },
  // encaminhamento aberto/vencido — os dois lados podem destravar a tarefa
  combinado: {
    mentor: (i) =>
      `${oiM(i)}, tudo bem? ${autoria(i.autorNome)}. Passando pra lembrar dos combinados em aberto${i.extra ? ` (${i.extra})` : ""}. Precisa de uma mão com algum deles?`,
    mentorado: (i) =>
      `${oiMd(i)}, tudo bem? ${autoria(i.autorNome)}. Passando pra ver se os combinados do encontro estão caminhando e se precisa de ajuda com algo.`,
  },
  // semáforo em atenção — houve sinal no último registro
  atencao: {
    mentor: (i) =>
      `${oiM(i)}, tudo bem? ${autoria(i.autorNome)}. Vi que o último encontro${comMd(i)} teve pontos de atenção. Posso ajudar em algo?`,
    mentorado: (i) =>
      `${oiMd(i)}, tudo bem? ${autoria(i.autorNome)}. Passando pra ver como você está e como vai a mentoria${comM(i)}. Precisa de algo?`,
  },
  // contato neutro — check-in de rotina sem anomalia
  generico: {
    mentor: (i) =>
      `${oiM(i)}, tudo bem? ${autoria(i.autorNome)}. Passando pra acompanhar a mentoria${comMd(i)}. Como estão as coisas?`,
    mentorado: (i) =>
      `${oiMd(i)}, tudo bem? ${autoria(i.autorNome)}. Como está indo a mentoria${comM(i)}?`,
  },
};

/** Mensagens prontas do contexto — a forma do catálogo. Chaves ausentes não
 *  têm destinatário natural (ex.: "apoio" só fala com o mentor, que pediu). */
export function msgsContato(ctx: ContextoWA, info: InfoWA): MsgsContato;
/** Forma de texto livre: saudações neutras + `casoMentor`/`casoMentorado`
 *  fechando a mensagem — pro caso que o catálogo ainda não cobre. */
export function msgsContato(
  ctx: CtxWhatsApp,
  info?: { casoMentor?: string; casoMentorado?: string }
): MsgsContato;
export function msgsContato(
  ctx: ContextoWA | CtxWhatsApp,
  info: InfoWA | { casoMentor?: string; casoMentorado?: string } = {}
): MsgsContato {
  if (typeof ctx === "string") {
    const entrada = CATALOGO[ctx];
    const i = info as InfoWA;
    return {
      ...(entrada.mentor && { mentor: entrada.mentor(i) }),
      ...(entrada.mentorado && { mentorado: entrada.mentorado(i) }),
    };
  }
  // texto livre — o chamador traz o fecho contextual de cada ponta (ex.: o
  // "É direto por aqui: {link}" do card de registro pendente)
  const quem = ctx.eu ? `${pn(ctx.eu)}, da equipe` : "a equipe";
  const livre = info as { casoMentor?: string; casoMentorado?: string };
  return {
    mentor: `Oi ${pn(ctx.mentorNome)}, tudo bem? Passando pra acompanhar a mentoria com ${pn(ctx.mentoradoNome)}. ${
      livre.casoMentor ?? "Como estão as coisas?"
    }`,
    mentorado: `Oi ${pn(ctx.mentoradoNome)}, tudo bem? Aqui é ${quem} do Realiza.vc. ${
      livre.casoMentorado ??
      `Passando pra saber como está indo a mentoria com ${pn(ctx.mentorNome)} e se precisa de algo.`
    }`,
  };
}
