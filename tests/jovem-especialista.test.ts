import { describe, expect, it } from "vitest";
import {
  efetivoDe,
  nomeEspDoPedido,
  pedidoAbertoComEsp,
  pedidoEmAberto,
  pedidoPrecisaDemanda,
  resumoPedidoJovem,
} from "@/lib/jovem-especialista";
import type {
  JovemEspecialista,
  SolicitacaoEspecialista,
} from "@/lib/types";

// espelho das regras da 0074 no lado do jovem — a dedup lê
// coalesce(especialista_desejado_id, especialista_id) entre os status crus
// em aberto, e o teto de pedidos conta a 'expirada' lazy (a coluna da tabela
// segue 'aberta'/'contra_proposta' até o cancelamento). Se a RPC mudar, este
// arquivo muda junto.

const ESP = "esp-111";
const OUTRO = "esp-222";

let seq = 0;
function sol(
  over: Partial<SolicitacaoEspecialista> = {}
): SolicitacaoEspecialista {
  seq += 1;
  return {
    id: `sol-${seq}`,
    mentorado_id: "ment-1",
    dupla_dpp_id: "dpp-1",
    demanda: null,
    motivo: null,
    slot_proposto: null,
    origem: "jovem",
    turma: "T1 · 2026/2027",
    justificativa_recusa: null,
    especialista_desejado_id: null,
    especialista_id: null,
    dupla_id: null,
    status: "aberta",
    created_by: "jovem-1",
    created_at: "2025-10-14T15:00:00.000Z",
    respondida_em: null,
    ...over,
  };
}

describe("efetivoDe", () => {
  it("o status_efetivo da view ganha do cru quando existe", () => {
    expect(
      efetivoDe(sol({ status: "aberta", status_efetivo: "expirada" }))
    ).toBe("expirada");
    expect(efetivoDe(sol({ status: "contra_proposta" }))).toBe(
      "contra_proposta"
    );
  });
});

describe("pedidoEmAberto", () => {
  it("aberta, triagem, negociação e expirada lazy ainda ocupam a fila", () => {
    for (const s of [
      sol({ status: "aberta" }),
      sol({ status: "aguardando_coord" }),
      sol({ status: "contra_proposta" }),
      // expirada é só view — no banco a linha segue 'aberta' e conta nos
      // tetos da RPC (dedup por par + máx. 3 abertos)
      sol({ status: "aberta", status_efetivo: "expirada" }),
    ]) {
      expect(pedidoEmAberto(s)).toBe(true);
    }
  });

  it("aceita, recusada e cancelada liberam o par", () => {
    for (const status of ["aceita", "recusada", "cancelada"] as const) {
      expect(pedidoEmAberto(sol({ status }))).toBe(false);
    }
  });
});

describe("pedidoPrecisaDemanda — gate da 0074 (por PAR)", () => {
  it("o primeiro pedido (sem nenhuma trilha ativa) exige a demanda", () => {
    expect(pedidoPrecisaDemanda([])).toBe(true);
  });

  it("broadcast com trilha ativa é motivo-curto — qualquer par vivo resolve", () => {
    // o trigger testa `especialista_desejado_id is null or mentor_id =
    // desejado`: sem alvo, basta UMA dupla esp viva do jovem
    expect(pedidoPrecisaDemanda([ESP])).toBe(false);
    expect(pedidoPrecisaDemanda([ESP], null)).toBe(false);
    expect(pedidoPrecisaDemanda([ESP, OUTRO], null)).toBe(false);
  });

  it("dirigido à própria trilha é follow-up — motivo-curto", () => {
    expect(pedidoPrecisaDemanda([ESP], ESP)).toBe(false);
    expect(pedidoPrecisaDemanda([ESP, OUTRO], OUTRO)).toBe(false);
  });

  it("dirigido a um especialista NOVO é primeiro do par — demanda mesmo com outra trilha", () => {
    // o trigger casa mentor_id = desejado: a trilha da Sofia NÃO libera o
    // pedido pra Helena — sem demanda o insert levanta 'pedido novo
    // precisa de demanda' (o bug que este gate em tela evita)
    expect(pedidoPrecisaDemanda([ESP], OUTRO)).toBe(true);
    expect(pedidoPrecisaDemanda([OUTRO], ESP)).toBe(true);
  });
});

describe("pedidoAbertoComEsp — a dedup da RPC na UI", () => {
  it("casa pelo especialista desejado", () => {
    const aberto = sol({ especialista_desejado_id: ESP });
    expect(pedidoAbertoComEsp([aberto], ESP)).toBe(aberto);
    expect(pedidoAbertoComEsp([aberto], OUTRO)).toBeUndefined();
  });

  it("broadcast engajado casa pelo especialista_id — o par amarrou no aceite dele", () => {
    const engajado = sol({
      especialista_desejado_id: null,
      especialista_id: ESP,
      status: "contra_proposta",
    });
    expect(pedidoAbertoComEsp([engajado], ESP)).toBe(engajado);
  });

  it("pedido encerrado não amarra mais o par", () => {
    const fechado = sol({
      especialista_desejado_id: ESP,
      status: "recusada",
    });
    expect(pedidoAbertoComEsp([fechado], ESP)).toBeUndefined();
  });

  it("broadcast aberto não trava nenhum especialista", () => {
    const broadcast = sol({ especialista_desejado_id: null });
    expect(pedidoAbertoComEsp([broadcast], ESP)).toBeUndefined();
    expect(pedidoAbertoComEsp([broadcast], null)).toBeUndefined();
  });
});

describe("nomeEspDoPedido — a costura que a RLS não faz", () => {
  const catalogo: JovemEspecialista[] = [
    {
      id: ESP,
      nome: "Helena Costa",
      nome_social: "Lena",
      avatar_path: null,
      areas: ["oratória"],
      bio: null,
      cargo: null,
      empresa: null,
      cidade: null,
      uf: null,
      voluntariado: null,
      experiencia_previa: null,
      formacao_externa: null,
      grade_resumo: null,
      vagas: 1,
    },
  ];

  it("o engajado usa o embed (a view denormaliza especialista_nome)", () => {
    expect(
      nomeEspDoPedido(
        sol({ especialista: { nome: "Helena Costa" } }),
        catalogo
      )
    ).toBe("Helena Costa");
  });

  it("o direcionado sem embed resolve pelo catálogo — com nome social", () => {
    expect(
      nomeEspDoPedido(
        sol({ especialista_desejado_id: ESP, desejado: null }),
        catalogo
      )
    ).toBe("Lena");
  });

  it("o embed desejado (staff) ainda ganha do catálogo", () => {
    expect(
      nomeEspDoPedido(
        sol({ desejado: { nome: "Helena C." }, especialista_desejado_id: ESP }),
        catalogo
      )
    ).toBe("Helena C.");
  });

  it("broadcast sem engajado não tem nome", () => {
    expect(nomeEspDoPedido(sol(), catalogo)).toBeNull();
  });
});

describe("resumoPedidoJovem — a linha de estado na voz dele", () => {
  it("cada status diz onde a bola está", () => {
    expect(resumoPedidoJovem("aguardando_coord", null)).toContain(
      "coordenação"
    );
    expect(resumoPedidoJovem("aberta", "Lena")).toContain("Lena");
    expect(resumoPedidoJovem("aberta", null)).toContain("mural");
    expect(resumoPedidoJovem("contra_proposta", "Lena")).toContain("Lena");
    expect(resumoPedidoJovem("expirada", "Lena")).toContain("expirou");
    expect(resumoPedidoJovem("recusada", "Lena")).toContain("Lena");
    expect(resumoPedidoJovem("recusada", null)).toContain("recusado");
    expect(resumoPedidoJovem("aceita", "Lena")).toContain("agenda");
    expect(resumoPedidoJovem("cancelada", null)).toContain("cancelado");
  });
});
