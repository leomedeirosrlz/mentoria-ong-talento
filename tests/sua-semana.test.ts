import { describe, expect, it } from "vitest";
import {
  atencaoDaDupla,
  precisaDeVoce,
  quemCombinou,
  recessoSemDecisao,
  suaSemana,
  textoDoMotivo,
} from "@/lib/sua-semana";
import type { PlanoCombinado } from "@/lib/plano-combinado";

// REALIZA-520 — "Sua semana" nas três homes + "O que precisa de você" do
// staff leem a MESMA derivação: vínculo do próximo encontro, ritmo, a
// janela de contestação que a RPC confirma e a régua de atenção do staff.

const base: PlanoCombinado = {
  id: "pl-1",
  status: "ativo",
  versao: 1,
  aprovado_lado: null,
  aceites: { mentor: true, mentorado: true },
  escopo: {
    ritmo: 2,
    passos: [
      { numero: 4, data: "2026-11-24" },
      { numero: 5, data: "2026-11-28" },
      { numero: 6, data: "2026-12-02" },
    ],
  },
};

describe("suaSemana", () => {
  it("plano fechado não é semana", () => {
    expect(
      suaSemana({ plano: { ...base, status: "concluido" }, meuLado: "mentor" })
    ).toBeNull();
  });

  it("plano ativo: vínculo quando o próximo agendado é passo do plano", () => {
    const s = suaSemana({
      plano: base,
      meuLado: "mentor",
      proximoNumero: 4,
    });
    expect(s?.estado).toBe("ativo");
    expect(s?.vinculo).toBe(4);
    expect(s?.ritmo).toBe("até 2 encontros por semana");
  });

  it("próximo encontro fora do plano não carrega vínculo", () => {
    const s = suaSemana({
      plano: base,
      meuLado: "mentor",
      proximoNumero: 9,
    });
    expect(s?.vinculo).toBeNull();
  });

  it("proposta da equipe esperando a dupla: quem lê vê 'falta meu aceite'", () => {
    const s = suaSemana({
      plano: { ...base, status: "proposto", aceites: { mentor: false, mentorado: false } },
      meuLado: "mentorado",
    });
    expect(s?.estado).toBe("proposto_staff_falta_meu");
    expect(s?.resumo.falta).toBe("dupla");
    expect(s?.contestavel).toBe(true);
  });

  it("contestável fecha quando um passo do plano aconteceu depois da proposta", () => {
    const s = suaSemana({
      plano: base,
      meuLado: "mentor",
      realizados: [4],
      realizadosAposProposta: [4],
    });
    expect(s?.contestavel).toBe(false);
  });

  it("encontro de outro número depois da proposta NÃO fecha a janela", () => {
    const s = suaSemana({
      plano: base,
      meuLado: "mentor",
      realizados: [3],
      realizadosAposProposta: [3],
    });
    expect(s?.contestavel).toBe(true);
  });

  it("plano contestado não é semana — quem avisa é a fila do staff", () => {
    expect(
      suaSemana({ plano: { ...base, status: "contestado" }, meuLado: "mentor" })
    ).toBeNull();
  });

  it("em vigor sem o meu carimbo: ativo_sem_minha_ciencia", () => {
    const s = suaSemana({
      plano: {
        ...base,
        status: "aceito",
        aceites: { mentor: true, mentorado: false },
      },
      meuLado: "mentorado",
    });
    expect(s?.estado).toBe("ativo_sem_minha_ciencia");
    // fui avisado, não devo aceite — mas a contestação segue aberta
    expect(s?.contestavel).toBe(true);
  });

  it("ativo_sem_minha_ciencia também vale pra status ativo legado", () => {
    const s = suaSemana({
      plano: {
        ...base,
        status: "ativo",
        aceites: { mentor: true, mentorado: false },
      },
      meuLado: "mentorado",
    });
    expect(s?.estado).toBe("ativo_sem_minha_ciencia");
  });

  it("aceite unilateral lê 'falta o outro' pro lado que já carimbou", () => {
    const s = suaSemana({
      plano: { ...base, status: "proposto", aceites: { mentor: true, mentorado: false } },
      meuLado: "mentor",
    });
    expect(s?.estado).toBe("proposto_staff_falta_outro");
    expect(s?.resumo.falta).toBe("mentorado");
  });
});

describe("quemCombinou", () => {
  it("sem proposto_por → a equipe", () => {
    expect(quemCombinou({ propostoPor: null })).toBe("a equipe");
  });

  it("o próprio lado que propôs vira 'você'", () => {
    expect(
      quemCombinou({ propostoPor: "u-1", euId: "u-1" })
    ).toBe("você");
  });

  it("resolve pelo mapa de ids e pelo mapa alternativo", () => {
    expect(
      quemCombinou({
        propostoPor: "sup-1",
        nomesPorId: new Map([["sup-1", "Paulo"]]),
      })
    ).toBe("Paulo");
    expect(
      quemCombinou({
        propostoPor: "ment-1",
        nomesPorOutroId: new Map([["ment-1", "Ana"]]),
      })
    ).toBe("Ana");
  });

  it("id desconhecido cai na equipe — nunca no uuid cru", () => {
    expect(
      quemCombinou({ propostoPor: "de000000-0000-4000-8000-000000000001" })
    ).toBe("a equipe");
  });
});

describe("atencaoDaDupla — a régua pedindo atenção", () => {
  const hoje = "2026-11-23";

  it("proposta que expira em até 4 dias fala primeiro", () => {
    const a = atencaoDaDupla({
      vivo: { status: "proposto", expira_em: "2026-11-26" },
      hoje,
    });
    expect(a?.motivo.tipo).toBe("expira");
    expect(a?.texto).toBe("proposta expira em 3 dias");
  });

  it("proposta longe do vencimento não vira 'expira' — sobra o aceite", () => {
    const a = atencaoDaDupla({
      vivo: { status: "proposto", expira_em: "2026-12-20" },
      hoje,
    });
    expect(a?.motivo.tipo).toBe("decisao");
    expect(a?.texto).toBe("proposta esperando aceite da dupla");
  });

  it("passo devendo data com o dia combinado no passado sobe na fila", () => {
    const a = atencaoDaDupla({
      vivo: {
        status: "ativo",
        escopo: {
          passos: [
            { numero: 4, data: "2026-11-20" },
            { numero: 5, data: "2026-11-30" },
          ],
        },
      },
      hoje,
    });
    expect(a?.motivo.tipo).toBe("passo_vencido");
    expect(a?.texto).toBe("o 4º encontro passou da data combinada");
  });

  it("passo já realizado ou já reaplicado não conta como vencido", () => {
    const a = atencaoDaDupla({
      vivo: {
        status: "ativo",
        escopo: { passos: [{ numero: 4, data: "2026-11-20" }] },
      },
      hoje,
      realizados: [4],
    });
    expect(a).toBeNull();

    const reaplicado = atencaoDaDupla({
      vivo: {
        status: "ativo",
        escopo: { passos: [{ numero: 4, data: "2026-11-20" }] },
        passos: [{ numero: 4, data_nova: "2026-11-28T22:00:00Z" }],
      },
      hoje,
    });
    expect(reaplicado).toBeNull();
  });

  it("contestado é notícia por uma semana; depois vira histórico", () => {
    const recente = atencaoDaDupla({
      vivo: null,
      contestado: { contestado_em: "2026-11-22T18:40:00Z" },
      hoje,
    });
    expect(recente?.motivo.tipo).toBe("contestado");
    expect(recente?.texto).toBe("plano contestado ontem");

    const velho = atencaoDaDupla({
      vivo: null,
      contestado: { contestado_em: "2026-11-10T18:40:00Z" },
      hoje,
    });
    expect(velho).toBeNull();
  });

  it("expirando ganha de contestado e de aceite pendente", () => {
    const a = atencaoDaDupla({
      vivo: { status: "proposto", expira_em: "2026-11-24" },
      contestado: { contestado_em: "2026-11-22T10:00:00Z" },
      hoje,
    });
    expect(a?.motivo.tipo).toBe("expira");
  });

  it("recesso vigente/futuro sem decisão é motivo — decidido, não", () => {
    expect(
      atencaoDaDupla({ vivo: null, hoje, recessoPendente: true })?.texto
    ).toBe("recesso sem decisão da dupla");
    expect(atencaoDaDupla({ vivo: null, hoje, recessoPendente: false }))
      .toBeNull();
  });

  it("recessoSemDecisao: vigente/futuro sem row, perto ou dentro do plano", () => {
    const eventos = [
      { id: "e1", tipo: "recesso", data: "2026-11-01", data_fim: "2026-11-10" },
      { id: "e2", tipo: "recesso", data: "2026-12-20", data_fim: "2027-01-05" },
      // longe (mais de 45 dias) — a ficha pergunta na hora certa
      { id: "e4", tipo: "recesso", data: "2027-03-01", data_fim: "2027-03-15" },
      { id: "e3", tipo: "encontro", data: "2026-11-25" },
    ];
    // e1 já terminou → fora; e2 perto → conta; e4 longe → fora
    expect(
      recessoSemDecisao({ eventos, decididos: new Set(), hoje })
    ).toBe(1);
    // marcado (true ou false — qualquer row) → decidido
    expect(
      recessoSemDecisao({ eventos, decididos: new Set(["e2"]), hoje })
    ).toBe(0);
    // um plano aberto que cobre o recesso distante traz ele pra fila —
    // a decisão muda as datas do combinado
    expect(
      recessoSemDecisao({
        eventos,
        decididos: new Set(),
        hoje,
        janelaPlano: { inicio: "2026-11-23", fim: "2027-04-01" },
      })
    ).toBe(2);
  });

  it("textoDoMotivo cobre cada forma", () => {
    expect(textoDoMotivo({ tipo: "expira", dias: -1 })).toBe("proposta vencida");
    expect(textoDoMotivo({ tipo: "expira", dias: 0 })).toBe("proposta expira hoje");
    expect(textoDoMotivo({ tipo: "expira", dias: 1 })).toBe("proposta expira amanhã");
    expect(textoDoMotivo({ tipo: "contestado", em: "x", haDias: 0 })).toBe("plano contestado hoje");
    expect(textoDoMotivo({ tipo: "contestado", em: "x", haDias: 3 })).toBe("plano contestado há 3 dias");
  });
});

describe("precisaDeVoce — a fila do staff", () => {
  const hoje = "2026-11-23";
  const d = (over: object) => ({
    id: "d-1",
    status: "ativa",
    trilha: "dpp",
    cronograma_id: "cron-1",
    mentor: { nome: "Carlos Silva" },
    mentorado: { nome: "Caio Souza" },
    planos: [],
    recessos: [],
    encontros: [],
    ...over,
  });

  it("uma linha por dupla, motivo antes do nome, link pra ficha", () => {
    const { itens } = precisaDeVoce({
      hoje,
      eventos: [],
      duplas: [
        d({
          id: "d-exp",
          planos: [
            {
              id: "p1",
              status: "proposto",
              expira_em: "2026-11-25",
              created_at: "2026-11-20T10:00:00Z",
            },
          ],
        }),
      ],
    });
    expect(itens).toHaveLength(1);
    expect(itens[0].nomes).toBe("Carlos × Caio");
    expect(itens[0].motivo.texto).toBe("proposta expira em 2 dias");
    expect(itens[0].acao).toBe("Ver a proposta");
    expect(itens[0].href).toBe("/duplas/d-exp#acordos");
  });

  it("contestado recente vira 'Retomar o plano'", () => {
    const { itens } = precisaDeVoce({
      hoje,
      eventos: [],
      duplas: [
        d({
          planos: [
            {
              id: "p1",
              status: "contestado",
              contestado_em: "2026-11-22T18:40:00Z",
              created_at: "2026-11-10T09:00:00Z",
            },
          ],
        }),
      ],
    });
    expect(itens[0].motivo.texto).toBe("plano contestado ontem");
    expect(itens[0].acao).toBe("Retomar o plano");
  });

  it("trilha especialista e dupla encerrada ficam de fora", () => {
    const plano = {
      id: "p1",
      status: "proposto",
      expira_em: "2026-11-25",
      created_at: "2026-11-20T10:00:00Z",
    };
    const { itens } = precisaDeVoce({
      hoje,
      eventos: [],
      duplas: [
        d({ id: "d-esp", trilha: "especialista", planos: [plano] }),
        d({ id: "d-fim", status: "encerrada", planos: [plano] }),
      ],
    });
    expect(itens).toHaveLength(0);
  });

  it("recesso do cronograma da dupla sem row em dupla_recessos entra na fila", () => {
    const { itens } = precisaDeVoce({
      hoje,
      eventos: [
        {
          id: "ev-rec",
          cronograma_id: "cron-1",
          tipo: "recesso",
          data: "2026-12-20",
          data_fim: "2027-01-05",
        },
        {
          id: "ev-outro",
          cronograma_id: "cron-2",
          tipo: "recesso",
          data: "2026-12-20",
          data_fim: "2027-01-05",
        },
      ],
      duplas: [d({ cronograma_id: "cron-1" })],
    });
    expect(itens).toHaveLength(1);
    expect(itens[0].motivo.texto).toBe("recesso sem decisão da dupla");
    expect(itens[0].acao).toBe("Ver o recesso");
    // âncora estável: existe no card standalone e no bloco do plano
    expect(itens[0].href).toBe("/duplas/d-1#recesso-dupla");
  });

  it("o plano vivo é o mais recente — um expirado mais novo não esconde o ativo antigo", () => {
    const { itens } = precisaDeVoce({
      hoje,
      eventos: [],
      duplas: [
        d({
          planos: [
            {
              id: "p-velho",
              status: "ativo",
              escopo: { passos: [{ numero: 4, data: "2026-11-20" }] },
              created_at: "2026-11-01T10:00:00Z",
            },
            {
              id: "p-novo-fechado",
              status: "expirado",
              created_at: "2026-11-15T10:00:00Z",
            },
          ],
        }),
      ],
    });
    expect(itens[0].motivo.texto).toBe("o 4º encontro passou da data combinada");
  });

  it("corta em 5 e devolve o total real pro 'mais N'", () => {
    const duplas = Array.from({ length: 7 }, (_, i) =>
      d({
        id: `d-${i}`,
        planos: [
          {
            id: `p-${i}`,
            status: "proposto",
            expira_em: "2026-12-20",
            created_at: "2026-11-20T10:00:00Z",
          },
        ],
      })
    );
    const { itens, total } = precisaDeVoce({ hoje, eventos: [], duplas });
    expect(itens).toHaveLength(5);
    expect(total).toBe(7);
  });

  it("o urgente ordena na frente — expirando antes de aceite pendente", () => {
    const { itens } = precisaDeVoce({
      hoje,
      eventos: [],
      duplas: [
        // aceite pendente criado antes — a ordem de entrada não manda
        d({
          id: "d-aceite",
          planos: [
            {
              id: "p-a",
              status: "proposto",
              expira_em: "2026-12-20",
              created_at: "2026-11-20T10:00:00Z",
            },
          ],
        }),
        d({
          id: "d-expira",
          planos: [
            {
              id: "p-e",
              status: "proposto",
              expira_em: "2026-11-24",
              created_at: "2026-11-19T10:00:00Z",
            },
          ],
        }),
      ],
    });
    expect(itens[0].motivo.motivo.tipo).toBe("expira");
    expect(itens[1].motivo.motivo.tipo).toBe("decisao");
  });
});
