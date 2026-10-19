import { describe, expect, it } from "vitest";
import { painelTrilhasCoord } from "@/lib/trilhas-coord";
import type {
  Dupla,
  SolicitacaoEspecialista,
} from "@/lib/types";
import {
  dt,
  dth,
  encAgendado,
  encRealizado,
  mkDupla,
  mkEncontro,
  mkMentorado,
  mkProfile,
} from "./helpers";

// Âncora: quarta 07/10/2026 meio-dia SP. O painel é read-only — nada aqui
// escreve; os fixtures só precisam das datas certas.
const HOJE = dt("2026-10-07");

let seq = 0;
function sol(
  over: Partial<SolicitacaoEspecialista> = {}
): SolicitacaoEspecialista {
  seq += 1;
  return {
    id: `sol-${seq}`,
    mentorado_id: "ment-1",
    dupla_dpp_id: "dpp-1",
    demanda: "Finanças e primeiro emprego",
    motivo: null,
    slot_proposto: null,
    origem: "jovem",
    turma: "T2",
    justificativa_recusa: null,
    especialista_desejado_id: null,
    especialista_id: null,
    dupla_id: null,
    status: "aberta",
    created_by: "jovem-1",
    created_at: "2026-09-30T15:00:00-03:00",
    respondida_em: null,
    ...over,
  };
}

function trilhaEsp(over: Partial<Dupla> = {}): Dupla {
  seq += 1;
  return mkDupla({
    id: `esp-d-${seq}`,
    trilha: "especialista",
    cronograma_id: null,
    turma: "T2",
    iniciada_em: "2026-09-19",
    mentor: mkProfile({ nome: "Luísa Prado", role: "mentor_especialista" }),
    mentorado: mkMentorado({ nome: "Ana Souza" }),
    ...over,
  });
}

describe("painelTrilhasCoord — linhas de trilha", () => {
  it("sessões feitas = realizadas; esperadas soma as marcadas já vencidas", () => {
    const d = trilhaEsp({
      encontros: [
        encRealizado(1, "2026-09-26"),
        encRealizado(2, "2026-10-03"),
        // marcada e vencida — já deveria ter acontecido
        encAgendado(3, "2026-10-05"),
        // futura — ainda não é dívida, é a próxima
        encAgendado(4, "2026-10-20"),
        // vencida mas com desfecho — não é pendente nem esperada
        mkEncontro(5, {
          status: "nao_aconteceu",
          data_hora: dth("2026-10-06").toISOString(),
        }),
        mkEncontro(6, {
          status: "cancelado",
          data_hora: dth("2026-10-06").toISOString(),
        }),
      ],
    });
    const { trilhas } = painelTrilhasCoord({
      duplas: [d],
      solicitacoes: [],
      hoje: HOJE,
    });
    expect(trilhas).toHaveLength(1);
    expect(trilhas[0].sessoesFeitas).toBe(2);
    expect(trilhas[0].sessoesEsperadas).toBe(3);
    expect(trilhas[0].proximaSessao).toBe(dth("2026-10-20").toISOString());
    // prazo ~3 meses do início (19 set → 19 dez)
    expect(trilhas[0].prazo).toBe("2026-12-19");
  });

  it("proximaSessao pega a menor futura — remarcado compete igual agendado", () => {
    const d = trilhaEsp({
      encontros: [
        encAgendado(1, "2026-10-20"),
        mkEncontro(2, {
          status: "remarcado",
          data_hora: dth("2026-10-15").toISOString(),
        }),
      ],
    });
    const { trilhas } = painelTrilhasCoord({
      duplas: [d],
      solicitacoes: [],
      hoje: HOJE,
    });
    expect(trilhas[0].proximaSessao).toBe(dth("2026-10-15").toISOString());
  });

  it("nomes vêm do nome de uso (nome_social) quando existe", () => {
    const d = trilhaEsp({
      mentor: mkProfile({
        nome: "Luísa Prado",
        nome_social: "Lena",
        role: "mentor_especialista",
      }),
      mentorado: mkMentorado({ nome: "Ana Souza", nome_social: "Aninha" }),
    });
    const { trilhas } = painelTrilhasCoord({
      duplas: [d],
      solicitacoes: [],
      hoje: HOJE,
    });
    expect(trilhas[0].jovemNome).toBe("Aninha");
    expect(trilhas[0].espNome).toBe("Lena");
  });

  it("ordena por prazo crescente; sem início (sem marco) por último", () => {
    const tardia = trilhaEsp({ id: "t1", iniciada_em: "2026-10-01" }); // prazo 01 jan
    const urgente = trilhaEsp({ id: "t2", iniciada_em: "2026-07-10" }); // prazo 10 out
    const semMarco = trilhaEsp({ id: "t3", iniciada_em: null });
    const { trilhas } = painelTrilhasCoord({
      duplas: [tardia, semMarco, urgente],
      solicitacoes: [],
      hoje: HOJE,
    });
    expect(trilhas.map((t) => t.duplaId)).toEqual(["t2", "t1", "t3"]);
    expect(trilhas[2].prazo).toBeNull();
  });
});

describe("painelTrilhasCoord — KPIs", () => {
  it("conta só trilha esp: ativas+pausadas vivas, concluídas+encerradas fechadas", () => {
    const duplas = [
      trilhaEsp({ status: "ativa", encontros: [encRealizado(1, "2026-09-26")] }),
      trilhaEsp({ status: "pausada" }),
      trilhaEsp({ status: "encerrada", encontros: [encRealizado(1, "2026-08-01")] }),
      mkDupla({ id: "dpp-1" }), // trilha dpp — fora do painel
    ];
    const { kpis, trilhas } = painelTrilhasCoord({
      duplas,
      solicitacoes: [],
      hoje: HOJE,
    });
    expect(trilhas).toHaveLength(3);
    expect(kpis.trilhasAtivas).toBe(2);
    expect(kpis.concluidas).toBe(1);
    expect(kpis.sessoesFeitas).toBe(2);
    expect(kpis.pedidosParados).toBe(0);
  });
});

describe("painelTrilhasCoord — alertas de pedido parado", () => {
  it("entra quem passou do limite de dias no mural — borda inclusiva", () => {
    const noLimite = sol({ created_at: "2026-10-02T10:00:00-03:00" }); // 5 dias
    const passou = sol({ created_at: "2026-09-30T10:00:00-03:00" }); // 7 dias
    const fresco = sol({ created_at: "2026-10-04T10:00:00-03:00" }); // 3 dias
    const { alertas, kpis } = painelTrilhasCoord({
      duplas: [],
      solicitacoes: [fresco, noLimite, passou],
      hoje: HOJE,
    });
    expect(alertas.map((a) => a.solicitacaoId)).toEqual([
      passou.id,
      noLimite.id,
    ]);
    // mais parado primeiro
    expect(alertas[0].diasParado).toBe(7);
    expect(alertas[1].diasParado).toBe(5);
    expect(kpis.pedidosParados).toBe(2);
  });

  it("aguardando_coord também é pedido parado — a triagem é parte da espera", () => {
    const { alertas } = painelTrilhasCoord({
      duplas: [],
      solicitacoes: [
        sol({ status: "aguardando_coord", created_at: "2026-09-25T10:00:00-03:00" }),
      ],
      hoje: HOJE,
    });
    expect(alertas).toHaveLength(1);
    expect(alertas[0].diasParado).toBe(12);
  });

  it("sugerida e contra_proposta nunca são 'paradas' — uma espera o jovem, a outra está em mesa", () => {
    const velho = "2026-09-01T10:00:00-03:00"; // 36 dias — muito além do limite
    const { alertas } = painelTrilhasCoord({
      duplas: [],
      solicitacoes: [
        sol({ status: "sugerida", origem: "mentor", created_at: velho }),
        sol({ status: "contra_proposta", especialista_id: "e-1", created_at: velho }),
        sol({ status: "aceita", created_at: velho }),
        sol({ status: "cancelada", created_at: velho }),
      ],
      hoje: HOJE,
    });
    expect(alertas).toEqual([]);
  });

  it("expirada lazy alerta — o slot vencido trava dedup e teto até alguém cancelar", () => {
    const velho = "2026-09-25T10:00:00-03:00";
    const { alertas } = painelTrilhasCoord({
      duplas: [],
      solicitacoes: [
        sol({ status: "aberta", status_efetivo: "expirada", created_at: velho }),
        sol({ status: "aguardando_coord", created_at: velho }),
        sol({ status: "aberta", created_at: velho }),
      ],
      hoje: HOJE,
    });
    // o 'onde' distingue o lugar de cada parada pro rótulo do painel
    expect(alertas.map((a) => a.onde).sort()).toEqual([
      "expirada",
      "mural",
      "triagem",
    ]);
  });

  it("o alerta leva jovem, turma, demanda e a preferência quando dirigida", () => {
    const dirigido = sol({
      especialista_desejado_id: "e-1",
      desejado: { nome: "Tomás Ribeiro" },
      mentorado: { nome: "Caio Martins" },
      motivo: "organizar o dinheiro do estágio",
      created_at: "2026-09-30T10:00:00-03:00",
    });
    const broadcast = sol({
      mentorado: { nome: "Bia Ramos" },
      demanda: null,
      motivo: "quero montar meu currículo",
      created_at: "2026-09-28T10:00:00-03:00",
    });
    const { alertas } = painelTrilhasCoord({
      duplas: [],
      solicitacoes: [dirigido, broadcast],
      hoje: HOJE,
    });
    // ordenado por diasParado desc: broadcast (9d) vem antes do dirigido (7d)
    expect(alertas[0].jovemNome).toBe("Bia Ramos");
    expect(alertas[1].jovemNome).toBe("Caio Martins");
    expect(alertas[1].turma).toBe("T2");
    expect(alertas[1].preferenciaNome).toBe("Tomás Ribeiro");
    // broadcast não tem preferência — honesto é null, não inventar
    expect(alertas[0].preferenciaNome).toBeNull();
    // demanda cai pro motivo quando a coluna rica não existe
    expect(alertas[0].demanda).toBe("quero montar meu currículo");
  });
});
