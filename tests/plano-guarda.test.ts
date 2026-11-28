import { describe, expect, it } from "vitest";
import {
  datasCitadas,
  datasPermitidas,
  respostaDeterministica,
  validarRespostaPlano,
} from "@/lib/ia/plano-guarda";

// payload no formato do plano_em_dia (recorte do caso real Jhonatan × Rogério)
const PLANO = {
  dupla_id: "d1",
  mentor: "Rogério",
  mentorado: "Jhonatan",
  aplicavel: true,
  estado: "conversa",
  encerramento: "2027-01-15",
  data_projetada: "2027-01-29",
  alternativa_recesso: { data: "2027-01-11", ritmo: 7 },
  grade: { mentor: true, jovem: true, dias_comuns: 2 },
  recessos_pendentes: [
    {
      ciclo_evento_id: "r1",
      titulo: "Recesso de fim de ano",
      inicio: "2026-12-16",
      fim: "2027-01-04",
    },
  ],
  melhor: {
    id: "recesso_segue_fusao",
    rotulo: "recesso: seguir · fusão em pares",
    viavel: true,
    estado: "recuperacao",
    data: "2026-12-28",
    cabem: { cabem: 12, faltam: 12 },
    sessoes: 6,
    fusao: [
      [6, 7],
      [8, 9],
    ],
    decisaoRecesso: "segue",
    praticaFlex: null,
  },
  cenarios: [
    {
      id: "recesso_segue_fusao",
      rotulo: "recesso: seguir · fusão em pares",
      viavel: true,
      estado: "recuperacao",
      data: "2026-12-28",
      cabem: { cabem: 12, faltam: 12 },
      sessoes: 6,
      fusao: [
        [6, 7],
        [8, 9],
      ],
      decisaoRecesso: "segue",
      praticaFlex: null,
    },
    {
      id: "fusao_pares",
      rotulo: "fusão em pares",
      viavel: true,
      estado: "recuperacao",
      data: "2027-01-05",
      cabem: { cabem: 12, faltam: 12 },
      sessoes: 6,
      fusao: [
        [6, 7],
        [8, 9],
      ],
      decisaoRecesso: null,
      praticaFlex: null,
    },
    {
      id: "recesso_segue",
      rotulo: "recesso: seguir",
      viavel: true,
      estado: "recuperacao",
      data: "2027-01-11",
      cabem: { cabem: 12, faltam: 12 },
      sessoes: 11,
      fusao: [],
      decisaoRecesso: "segue",
      praticaFlex: null,
    },
    {
      id: "base",
      rotulo: "como está",
      viavel: false,
      estado: "conversa",
      data: "2027-01-29",
      cabem: { cabem: 11, faltam: 12 },
      sessoes: 12,
      fusao: [],
      decisaoRecesso: null,
      praticaFlex: null,
    },
  ],
  passos: [
    { numero: 5, acao: "travado", data_sugerida: "2026-11-27" },
    { numero: 6, acao: "agendar", data_sugerida: "2026-12-28" },
  ],
};

describe("guarda numérica do plano", () => {
  it("lê as datas do payload em qualquer profundidade", () => {
    const d = datasPermitidas(PLANO, new Date("2026-11-27T12:00:00-03:00"));
    expect(d.has("2027-01-15")).toBe(true);
    expect(d.has("15/01/2027")).toBe(true);
    expect(d.has("28/12/2026")).toBe(true);
    expect(d.has("27/11/2026")).toBe(true); // hoje
  });

  it("extrai dd/mm/aaaa, dd/mm e ISO do texto", () => {
    expect(datasCitadas("fecha em 28/12/2026 e o 5º em 27/11 às 14:00").map((x) => x.chave)).toEqual([
      "28/12/2026",
      "27/11",
    ]);
    expect(datasCitadas("encerra 2027-01-15").map((x) => x.chave)).toEqual([
      "2027-01-15",
    ]);
  });

  it("aceita a resposta que só usa datas do payload", () => {
    const texto =
      "O melhor caminho é recesso: seguir · fusão em pares, com recuperação em 28/12/2026. Sem fusão, a projeção vai para 29/01/2027 e não fecha antes de 15/01/2027.";
    expect(validarRespostaPlano(texto, PLANO).ok).toBe(true);
  });

  it("recusa a resposta com data inventada (caso 14/01)", () => {
    const texto =
      "Fundindo em pares, a dupla fica em dia em 14/01/2027, um dia antes do encerramento (15/01/2027).";
    const v = validarRespostaPlano(texto, PLANO);
    expect(v.ok).toBe(false);
    expect(v.datasInvalidas).toContain("14/01/2027");
  });

  it("recusa 'único caminho' quando há quatro viáveis", () => {
    const v = validarRespostaPlano(
      "Esse é o único caminho viável, com recuperação em 05/01/2027.",
      PLANO
    );
    expect(v.ok).toBe(false);
    expect(v.unicoIndevido).toBe(true);
  });

  it("recusa 'não fecha' quando o payload tem caminho viável", () => {
    const v = validarRespostaPlano(
      "Com essa fusão não fecha antes do encerramento.",
      PLANO
    );
    expect(v.ok).toBe(false);
    expect(v.naoFechaIndevido).toBe(true);
    // condicional ("sem fusão, não fecha") é verdade e passa
    expect(
      validarRespostaPlano(
        "Sem fusão, não fecha antes de 15/01/2027.",
        PLANO
      ).naoFechaIndevido
    ).toBe(false);
  });

  it("recusa dizer que recesso e fusão dão a mesma data", () => {
    const v = validarRespostaPlano(
      "Seguir no recesso com a mesma fusão dá a mesma data: 05/01/2027.",
      PLANO
    );
    expect(v.ok).toBe(false);
    expect(v.mesmaDataIndevida).toBe(true);
  });

  it("a resposta determinística usa só datas do payload", () => {
    const texto = respostaDeterministica(PLANO);
    expect(texto).toContain("28/12/2026");
    expect(texto).toContain("recesso: seguir · fusão em pares");
    expect(texto).toContain("16/12/2026");
    expect(validarRespostaPlano(texto, PLANO).ok).toBe(true);
  });

  it("recesso pendente: pra dupla pede a decisão, pra equipe avisa que a proposta já pode ir com pausa (0245)", () => {
    // sem lado no payload (payload antigo) o texto trata como dupla —
    // a pendência continua sendo a decisão autoral dela
    expect(respostaDeterministica(PLANO)).toContain(
      "Falta a dupla decidir sobre Recesso de fim de ano (16/12/2026 a 04/01/2027)"
    );
    const dupla = respostaDeterministica({ ...PLANO, lado: "mentor" });
    expect(dupla).toContain("Falta a dupla decidir");
    const staff = respostaDeterministica({ ...PLANO, lado: "staff" });
    expect(staff).toContain(
      "A proposta pode ir com pausa no recesso (16/12/2026 a 04/01/2027)"
    );
    expect(staff).toContain("a dupla confirma ou troca no aceite");
    expect(staff).not.toContain("Falta a dupla decidir");
  });

  it("sem caminho viável, a determinística diz que é coordenação", () => {
    const semCaminho = {
      ...PLANO,
      melhor: null,
      cenarios: PLANO.cenarios.map((c) => ({ ...c, viavel: false })),
      data_projetada: "2027-02-25",
      passos: [{ numero: 5, acao: "agendar", data_sugerida: "2027-02-25" }],
    };
    const texto = respostaDeterministica(semCaminho);
    expect(texto).toContain("Nenhum jeito fecha");
    expect(texto).toContain("15/01/2027");
    expect(validarRespostaPlano(texto, semCaminho).ok).toBe(true);
  });
});
