import { describe, expect, it } from "vitest";
import {
  efetivoDe,
  nomeEspDoPedido,
  pedidoAbertoComEsp,
  pedidoEmAberto,
  pedidoPrecisaDemanda,
  resumoPedidoJovem,
  stepperCicloDeVida,
  varianteDoCard,
} from "@/lib/jovem-especialista";
import type {
  Dupla,
  JovemEspecialista,
  SolicitacaoEspecialista,
} from "@/lib/types";
import {
  dt,
  encAgendado,
  encRealizado,
  mkDupla,
  mkProfile,
} from "./helpers";

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

// ---------- WP6-R2: variante do card + stepper do ciclo de vida ----------

const HOJE = dt("2025-10-15"); // quarta — mesmo eixo dos fixtures do ciclo

const VAZIO = { trilhasAtivas: [], pedidosAbertos: [] };

function esp(over: Partial<JovemEspecialista> = {}): JovemEspecialista {
  return {
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
    grade_resumo: ["seg à tarde"],
    vagas: 2,
    ...over,
  };
}

describe("varianteDoCard — uma variante por card do cardápio", () => {
  it("'andamento' ganha de 'sua': trilha viva + pedido follow-up em aberto pro mesmo par", () => {
    // "Pedir próxima sessão" aqui morreria na dedup da RPC — a resposta
    // honesta é "seu pedido tá na mesa", não um CTA que sempre falha
    expect(
      varianteDoCard(esp({ vagas: 0, grade_resumo: null }), {
        trilhasAtivas: [ESP],
        pedidosAbertos: [sol({ especialista_desejado_id: ESP })],
      })
    ).toBe("andamento");
  });

  it("'sua' = trilha viva com ele e nenhum pedido aberto no par", () => {
    // o CTA "Pedir próxima sessão" existe — e funciona (a RPC o teto de
    // trilhas não aplica no follow-up de par já vivo, 0095)
    expect(
      varianteDoCard(esp({ vagas: 0, grade_resumo: null }), {
        trilhasAtivas: [ESP],
        pedidosAbertos: [],
      })
    ).toBe("sua");
  });

  it("'andamento' = pedido em aberto amarrado a ele — dirigido ou broadcast que ele já engajou", () => {
    // a dedup da RPC é coalesce(desejado, engajado): os dois lados amarram
    expect(
      varianteDoCard(esp(), {
        trilhasAtivas: [],
        pedidosAbertos: [sol({ especialista_desejado_id: ESP })],
      })
    ).toBe("andamento");
    // contra_proposta de broadcast: o par já existe na mesa — ganha de
    // sem_vagas (não é "pedir de novo", é esperar a negociação)
    expect(
      varianteDoCard(esp({ vagas: 0 }), {
        trilhasAtivas: [],
        pedidosAbertos: [
          sol({ especialista_id: ESP, status: "contra_proposta" }),
        ],
      })
    ).toBe("andamento");
  });

  it("'sem_vagas' = capacidade cheia — e precede a agenda fechada", () => {
    expect(
      varianteDoCard(esp({ vagas: 0, grade_resumo: null }), VAZIO)
    ).toBe("sem_vagas");
  });

  it("'sem_agenda' = vagas livres mas nenhuma janela publicada (null ou vazia)", () => {
    expect(
      varianteDoCard(esp({ vagas: 1, grade_resumo: null }), VAZIO)
    ).toBe("sem_agenda");
    expect(
      varianteDoCard(esp({ vagas: 1, grade_resumo: [] }), VAZIO)
    ).toBe("sem_agenda");
  });

  it("'disponivel' = vagas + grade publicada, sem vínculo nem pedido", () => {
    expect(varianteDoCard(esp(), VAZIO)).toBe("disponivel");
    // o que é de OUTRO especialista não afeta este card
    expect(
      varianteDoCard(esp(), {
        trilhasAtivas: [OUTRO],
        pedidosAbertos: [sol({ especialista_desejado_id: OUTRO })],
      })
    ).toBe("disponivel");
    // pedido morto não segura a variante
    expect(
      varianteDoCard(esp(), {
        trilhasAtivas: [],
        pedidosAbertos: [
          sol({ especialista_desejado_id: ESP, status: "recusada" }),
        ],
      })
    ).toBe("disponivel");
  });
});

/** Trilha de especialista pronta — a dupla que nasce do aceite atômico. */
function trilha(over: Partial<Dupla> = {}): Dupla {
  return mkDupla({
    trilha: "especialista",
    cronograma_id: null,
    status: "ativa",
    iniciada_em: "2025-09-19",
    solicitacao_id: "sol-1",
    mentor: mkProfile({ nome: "Luísa Prado", role: "mentor_especialista" }),
    ...over,
  });
}

describe("stepperCicloDeVida — o ol.life do mock v6", () => {
  it("pedido aberto: Pedido feito, No mural atual, o resto futuro", () => {
    const passos = stepperCicloDeVida({
      solicitacao: sol({ created_at: "2025-09-30T15:00:00-03:00" }),
      dupla: null,
      hoje: HOJE,
    });
    expect(passos.map((p) => p.rotulo)).toEqual([
      "Pedido",
      "No mural",
      "Especialista aceita",
      "Em andamento",
      "Concluída + devolutiva",
    ]);
    expect(passos.map((p) => p.estado)).toEqual([
      "feito",
      "atual",
      "futuro",
      "futuro",
      "futuro",
    ]);
    // a data do passo "No mural" é a entrada no mural = created_at
    expect(passos[0].data).toBe("30 set");
    expect(passos[1].data).toBe("30 set");
    expect(passos[2].data).toBeNull();
    expect(passos[4].data).toBeNull();
  });

  it("aguardando_coord relê o nó do mural como 'Em triagem'", () => {
    const passos = stepperCicloDeVida({
      solicitacao: sol({ status: "aguardando_coord" }),
      dupla: null,
      hoje: HOJE,
    });
    expect(passos[1]).toMatchObject({ rotulo: "Em triagem", estado: "atual" });
  });

  it("sugerida: 'Sugestão do mentor' é o nó vivo e o mural fica futuro", () => {
    const passos = stepperCicloDeVida({
      solicitacao: sol({ status: "sugerida", origem: "mentor" }),
      dupla: null,
      hoje: HOJE,
    });
    expect(passos[0]).toMatchObject({
      rotulo: "Sugestão do mentor",
      estado: "atual",
      data: "14 out",
    });
    // sugerida não vai pro mural até o jovem confirmar — sem data de entrada
    expect(passos[1]).toMatchObject({
      rotulo: "No mural",
      estado: "futuro",
      data: null,
    });
    expect(passos.slice(2).every((p) => p.estado === "futuro")).toBe(true);
  });

  it("contra_proposta ainda espera o aceite — o mural segue o nó vivo", () => {
    const passos = stepperCicloDeVida({
      solicitacao: sol({ status: "contra_proposta", especialista_id: ESP }),
      dupla: null,
      hoje: HOJE,
    });
    expect(passos[1].estado).toBe("atual");
    expect(passos[2].estado).toBe("futuro");
  });

  it("trilha ativa com sessões: aceite feito, 'Em andamento' atual com 'sessão N'", () => {
    const passos = stepperCicloDeVida({
      solicitacao: sol({
        status: "aceita",
        created_at: "2025-09-12T15:00:00-03:00",
        respondida_em: "2025-09-19T14:00:00-03:00",
        especialista_id: "esp-luisa",
      }),
      dupla: trilha({
        encontros: [
          encRealizado(1, "2025-09-26"),
          encRealizado(2, "2025-10-03"),
          encAgendado(3, "2025-10-24"),
        ],
      }),
      hoje: HOJE,
    });
    expect(passos.map((p) => p.estado)).toEqual([
      "feito",
      "feito",
      "feito",
      "atual",
      "futuro",
    ]);
    expect(passos[0].data).toBe("12 set");
    // "Luísa aceitou" na data do respondida_em do aceite
    expect(passos[2]).toMatchObject({ rotulo: "Luísa aceitou", data: "19 set" });
    // início da dupla + a sessão em jogo = o rank da próxima tentativa
    // (2 realizadas cobriram os passos 1 e 2 → a 3ª é a corrente)
    expect(passos[3].data).toBe("19 set · sessão 3");
    // o último passo projeta o marco de ~3 meses do início
    expect(passos[4].data).toBe("19 dez");
  });

  it("aceite fresco sem sessão: o nó vivo é o aceite, andamento futuro", () => {
    const passos = stepperCicloDeVida({
      solicitacao: sol({
        status: "aceita",
        respondida_em: "2025-10-14T19:00:00-03:00",
      }),
      dupla: trilha({ iniciada_em: "2025-10-14" }),
      hoje: HOJE,
    });
    expect(passos[2].estado).toBe("atual");
    expect(passos[3]).toMatchObject({ estado: "futuro", data: "14 out" });
  });

  it("trilha encerrada: tudo feito, o fim na data do encerrada_em", () => {
    const passos = stepperCicloDeVida({
      solicitacao: sol({ status: "aceita" }),
      dupla: trilha({
        status: "encerrada",
        encerrada_em: "2025-11-20",
        encontros: [1, 2, 3, 4, 5].map((n) =>
          encRealizado(n, `2025-10-0${n}`)
        ),
      }),
      hoje: HOJE,
    });
    expect(passos.map((p) => p.estado)).toEqual([
      "feito",
      "feito",
      "feito",
      "feito",
      "feito",
    ]);
    expect(passos[4].data).toBe("20 nov");
  });

  it("trilha encerrada antes do fim não diz 'Concluída' — o último nó é honesto", () => {
    const passos = stepperCicloDeVida({
      solicitacao: sol({ status: "aceita" }),
      dupla: trilha({ status: "encerrada", encerrada_em: "2025-10-30" }),
      hoje: HOJE,
    });
    expect(passos[4].rotulo).toBe("Encerrada");
    // e 'concluida' (o desfecho bom) mantém o rótulo completo
    const concluida = stepperCicloDeVida({
      solicitacao: sol({ status: "aceita" }),
      dupla: trilha({ status: "concluida", encerrada_em: "2025-10-30" }),
      hoje: HOJE,
    });
    expect(concluida[4].rotulo).toBe("Concluída + devolutiva");
  });

  it("aceita sem dupla carregada: o aceite é o nó vivo — nada some", () => {
    // a view pode entregar o pedido aceito um tick antes da dupla existir —
    // o stepper mostra o marco vivo em vez de tudo feito sem nada em curso
    const passos = stepperCicloDeVida({
      solicitacao: sol({
        status: "aceita",
        respondida_em: "2025-10-14T19:00:00-03:00",
      }),
      dupla: null,
      hoje: HOJE,
    });
    expect(passos.map((p) => p.estado)).toEqual([
      "feito",
      "feito",
      "atual",
      "futuro",
      "futuro",
    ]);
    expect(passos[2].data).toBe("14 out");
  });

  it("expirada lazy segue no mural — o nó vivo não morre com o slot", () => {
    const passos = stepperCicloDeVida({
      solicitacao: sol({ status: "aberta", status_efetivo: "expirada" }),
      dupla: null,
      hoje: HOJE,
    });
    expect(passos[1].estado).toBe("atual");
    expect(passos[2].estado).toBe("futuro");
  });

  it("sem pedido nem trilha nada aconteceu — todos futuros", () => {
    const passos = stepperCicloDeVida({
      solicitacao: null,
      dupla: null,
      hoje: HOJE,
    });
    expect(passos).toHaveLength(5);
    expect(passos.every((p) => p.estado === "futuro")).toBe(true);
    expect(passos.every((p) => p.data === null)).toBe(true);
  });
});
