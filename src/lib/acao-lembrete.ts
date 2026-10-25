import { lembreteBloqueadoAte, type DuplaSaude } from "@/lib/ciclo";
import { msgsContato } from "@/lib/whatsapp-msgs";
import type { Dupla, Encontro } from "@/lib/types";
import type { Interacao } from "@/lib/interacoes";
import type { NudgeWA } from "@/components/dupla-wa-acao";

// Regra única "Lembrar | Chamar" da linha de dupla: a lista de /duplas, a fila
// da agenda e a ficha usam a mesma mensagem, o mesmo destino e o mesmo cap de
// 48h. Devolve as props do DuplaWaAcao; o componente só apresenta.

/** Pendência de registro mais antiga: realizado sem registro, ou agendado
 *  cuja data já passou. É o destino do "Registrar encontro N". */
export function encontroPendente(d: Dupla, hoje: Date): Encontro | undefined {
  return [...d.encontros]
    .sort((a, b) => a.numero - b.numero)
    .find(
      (e) =>
        !e.registro &&
        (e.status === "realizado" ||
          (e.status === "agendado" &&
            e.data_hora != null &&
            new Date(e.data_hora) < hoje))
    );
}

function casoLembrete(
  d: Dupla,
  s: DuplaSaude,
  hoje: Date,
  origem?: string
): string {
  // pedido de apoio do mentor responde antes da régua (mesma prioridade do
  // card do dashboard); o do jovem nem chega aqui, troca a ponta inteira
  if (s.pediuApoio)
    return "Vi seu pedido de apoio no registro. O que está rolando? Pode contar comigo.";
  const pendente = encontroPendente(d, hoje);
  // o texto sai pro WhatsApp e pra notificação: o link só entra ABSOLUTO
  // (sem origem, omite o trecho)
  const link =
    pendente && origem
      ? `${origem}/duplas/${d.id}#registrar-${pendente.id}`
      : null;
  const tipo = s.sinais[0]?.tipo;
  if (pendente?.status === "agendado")
    return `O ${pendente.numero}º encontro estava agendado e já passou. Rolou?${
      link
        ? ` Se rolou, o registro é por aqui: ${link}`
        : " Se rolou, o registro é na ficha da dupla."
    }`;
  if (tipo === "registro_pendente")
    return `Vi que o último encontro rolou, mas ainda falta o registro. Consegue preencher hoje?${link ? ` É direto por aqui: ${link}` : ""}`;
  if (tipo === "atraso")
    return "Os encontros estão atrasados. Posso ajudar a replanejar?";
  if (tipo === "preventivo")
    return "O próximo encontro do calendário já está perto e ainda não foi agendado. Posso ajudar a encaixar?";
  return "Vi que o último encontro teve pontos de atenção. Posso ajudar em algo?";
}

/** Props do DuplaWaAcao pra linha de dupla. "Lembrar" quando há pendência
 *  apontável em dupla ativa (notificação + wa.me, cap de 48h); "Chamar" nas
 *  demais. Pendência operacional vai pro mentor (a operação é dever dele: o
 *  mentorado nunca é cobrado por agendar ou registrar); o pedido de apoio do
 *  JOVEM troca a ponta inteira e fala com ele. */
export function acaoWhatsAppDupla({
  dupla,
  saude,
  hoje,
  ultimoNudge,
  meuNome,
  tituloNudge,
  origem,
}: {
  dupla: Dupla;
  saude: DuplaSaude;
  hoje: Date;
  /** última interação `nudge` da dupla: alimenta o cap de 48h */
  ultimoNudge: Interacao | null;
  /** primeiro nome de quem opera: assina o texto */
  meuNome?: string;
  /** título da notificação do Lembrar (coord × supervisão) */
  tituloNudge: string;
  /** proto+host do deploy: monta o link absoluto dentro do texto */
  origem?: string;
}): {
  duplaId: string;
  destNome: string;
  telefone: string | null | undefined;
  mensagem: string;
  nudge: NudgeWA | undefined;
} {
  const apoioJovem =
    saude.apoio.aberto &&
    (saude.apoio.origem === "mentorado" || saude.apoio.origem === "ambos");
  const nomeMentorado = dupla.mentorado.nome_social || dupla.mentorado.nome;
  // apoio aberto é pendência apontável (trabalho a fazer, não falha da dupla)
  const temPendencia =
    dupla.status === "ativa" && (saude.sinais.length > 0 || saude.apoio.aberto);
  const mensagem = apoioJovem
    ? (msgsContato("apoio_jovem", {
        mentoradoNome: nomeMentorado,
        autorNome: meuNome,
      }).mentorado ?? "")
    : (msgsContato(
        {
          eu: meuNome,
          mentorNome: dupla.mentor.nome.split(" ")[0],
          mentoradoNome: nomeMentorado,
        },
        temPendencia
          ? { casoMentor: casoLembrete(dupla, saude, hoje, origem) }
          : // sem caso: o fecho neutro "Como estão as coisas?" (contato livre)
            {}
      ).mentor ?? "");

  const nudge: NudgeWA | undefined = temPendencia
    ? {
        destino: apoioJovem ? "mentorado" : "mentor",
        titulo: apoioJovem ? "A equipe quer te ouvir" : tituloNudge,
        href: apoioJovem ? "/jovem/agenda" : `/duplas/${dupla.id}`,
        // responder um pedido do jovem é "Chamar", nunca cobrança
        rotulo: apoioJovem ? "Chamar" : undefined,
        bloqueadoAte: lembreteBloqueadoAte(ultimoNudge, hoje),
      }
    : undefined;

  return {
    duplaId: dupla.id,
    destNome: apoioJovem ? nomeMentorado : dupla.mentor.nome,
    telefone: apoioJovem ? dupla.mentorado.whatsapp : dupla.mentor.whatsapp,
    mensagem,
    nudge,
  };
}
