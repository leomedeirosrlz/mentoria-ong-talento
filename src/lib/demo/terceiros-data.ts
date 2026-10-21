/*
 * Dataset demo da avaliação por terceiros (0103 — guia DPP semana 1→2).
 *
 * Mesmo contrato de ./forms-data: módulo puro, evergreen — timestamps
 * derivam de `new Date()`. Amarrado na dupla "saudável" do dataset
 * (Ricardo × Ana, uid 0x0601): no papel mentor/coord/supervisor o painel
 * mostra o fluxo quase completo (convites pendentes, um expirado, três
 * respondidos com texto identificado e a consolidação publicada — que é o
 * que a Ana lê na área dela no papel jovem). O /t/<token> demo abre um
 * convite pendente em leitura; o submit cai no DEMO_MSG da action.
 */

import type {
  TerceiroConsolidacao,
  TerceiroContato,
  TerceiroPublico,
  TerceirosDaDupla,
} from "../terceiros/queries";

const uid = (n: number): string =>
  `de000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

const DUPLA_OK = uid(0x0601);
const DIA_MS = 24 * 3600 * 1000;
const HOJE = new Date();
const haDias = (n: number, hhmm = "11:00"): string =>
  new Date(
    `${new Date(HOJE.getTime() - n * DIA_MS).toISOString().slice(0, 10)}T${hhmm}:00-03:00`
  ).toISOString();

const contato = (
  n: number,
  nome: string,
  vinculo: TerceiroContato["vinculo"],
  status: TerceiroContato["status"],
  diasAtras: number,
  resposta?: { pontos_fortes: string; a_melhorar: string }
): TerceiroContato => ({
  id: uid(0x2400 + n),
  dupla_id: DUPLA_OK,
  nome,
  vinculo,
  whatsapp: "1198888" + String(4000 + n),
  token: `demo-tok-tercero-${nome.toLowerCase().replace(/\W+/g, "")}`.padEnd(24, "0"),
  expira_em: status === "expirado" ? haDias(2) : haDias(-20),
  status,
  respondido_em: resposta ? haDias(diasAtras) : null,
  created_at: haDias(diasAtras + 4),
  resposta: resposta
    ? {
        id: uid(0x2500 + n),
        contato_id: uid(0x2400 + n),
        respondido_em: haDias(diasAtras),
        ...resposta,
      }
    : null,
});

const CONTATOS: TerceiroContato[] = [
  contato(1, "Carolina Reis", "amigo", "respondido", 3, {
    pontos_fortes:
      "Ela nunca desiste no meio — quando começa, entrega. E é a amiga que todo mundo procura quando precisa de ideia boa.",
    a_melhorar:
      "Às vezes some quando está atolada e a gente fica sem notícia. E podia pedir ajuda antes de travar.",
  }),
  contato(2, "Tio Marcos Reis", "familiar", "respondido", 2, {
    pontos_fortes:
      "Muito responsável com os irmãos mais novos e criativa de verdade — resolve as coisas do jeito dela.",
    a_melhorar:
      "Teimosa quando alguém aponta caminho. Poderia ouvir mais antes de decidir sozinha.",
  }),
  contato(3, "Prof. Helena Moura", "colega", "respondido", 1, {
    pontos_fortes:
      "Curiosa e persistente: pergunta até entender. No trabalho em grupo puxa a parte difícil.",
    a_melhorar:
      "Prazo apertado deixa ela ansiosa — poderia se organizar antes em vez de correr no fim.",
  }),
  contato(4, "Bruno Andrade", "amigo", "pendente", -2),
  contato(5, "Vó Marta", "familiar", "pendente", -2),
  contato(6, "Diego Fontes", "colega", "expirado", 12),
];

const CONSOLIDACAO: TerceiroConsolidacao = {
  dupla_id: DUPLA_OK,
  consolidado:
    "O que mais apareceu: persistência (você entrega o que começa), criatividade pra resolver do seu jeito e ser a pessoa que os outros procuram. O que pediram pra olhar: sumir quando aperta — avisar e pedir ajuda antes de travar — e se organizar antes do prazo apertar.",
  publicado_em: haDias(1),
  escrito_por: uid(0x0003),
  updated_at: haDias(1),
};

export function demoTerceirosDaDupla(duplaId: string): TerceirosDaDupla {
  if (duplaId !== DUPLA_OK) return { contatos: [], consolidacao: null };
  return { contatos: CONTATOS, consolidacao: CONSOLIDACAO };
}

export function demoTerceiroPorToken(token: string): TerceiroPublico | null {
  const c = CONTATOS.find((x) => x.token === token);
  if (!c) return null;
  // o status real viaja — o /t demo mostra "já respondeu"/"expirou" nos
  // convites não-pendentes, igual ao banco
  return {
    status: c.status,
    convidado: { nome: c.nome },
    alvo: { jovem_nome: "Ana Beatriz" },
  };
}

export function demoConsolidadoTerceirosJovem(): {
  consolidado: string;
  publicado_em: string;
} | null {
  return {
    consolidado: CONSOLIDACAO.consolidado!,
    publicado_em: CONSOLIDACAO.publicado_em!,
  };
}
