import { describe, expect, it } from "vitest";
import {
  chamadoPendencia,
  derivarPendencias,
  type AvaliacaoPendencia,
  type AvisoPendencia,
  type ChamadoPendencia,
  type CombinadoPendencia,
  type DocumentoPendencia,
  type EncontroPendencia,
  type EntradaPendencias,
  type PendenciaJovem,
  type SugestaoPendencia,
} from "@/lib/pendencias-jovem";

// Âncora dos testes: sábado 21/11/2026 (TZ=America/Sao_Paulo no vitest).
// Instantes sempre com offset explícito pra não depender do fuso da máquina.
const HOJE = "2026-11-21";
const PASSADO = "2026-11-17"; // terça
const FUTURO = "2026-11-25";

const entradaVazia: EntradaPendencias = {
  hoje: HOJE,
  encontros: [],
  avaliacoes: [],
  documentos: [],
  combinados: [],
  sugestoes: [],
  avisos: [],
  retro: [],
};

function entrada(over: Partial<EntradaPendencias>): EntradaPendencias {
  return { ...entradaVazia, ...over };
}

function enc(over: Partial<EncontroPendencia>): EncontroPendencia {
  return {
    id: `e-${Math.random().toString(36).slice(2, 8)}`,
    numero: 5,
    status: "agendado",
    dataHora: `${PASSADO}T19:00:00-03:00`,
    comQuem: "Ricardo",
    ...over,
  };
}

function tipoUnico(lista: PendenciaJovem[]) {
  return lista[0]?.tipo;
}

describe("derivarPendencias — encontro sem desfecho", () => {
  it("encontro futuro não vira pendência; passado agendado vira, e é o 1º", () => {
    const lista = derivarPendencias(
      entrada({
        encontros: [
          enc({ id: "e-futuro", dataHora: `${FUTURO}T19:00:00-03:00` }),
          enc({ id: "e-passado", numero: 5 }),
        ],
        combinados: [
          { id: "c1", descricao: "resolver os 10 exercícios", prazo: HOJE, status: "pendente" },
        ],
      })
    );
    expect(lista.map((p) => p.acao.alvoId)).not.toContain("e-futuro");
    expect(lista[0].tipo).toBe("encontro_sem_desfecho");
    expect(lista[0].destaque).toBe(true);
    expect(lista[0].titulo).toBe("O 5º encontro era em 17/11. Aconteceu?");
    expect(lista[0].contexto).toBe("com Ricardo");
    expect(lista[0].acao).toEqual({
      tipo: "responder_encontro",
      rotulo: "Aconteceu",
      alvoId: "e-passado",
    });
    expect(lista[0].acaoSecundaria).toEqual({
      tipo: "remarcar",
      rotulo: "Remarcar",
      alvoId: "e-passado",
    });
  });

  it("hoje com hora passada conta quando o chamador manda `agora`; sem ele, não", () => {
    const mesmo19h = enc({ id: "e-hoje", dataHora: `${HOJE}T19:00:00-03:00` });
    // sem `agora` a régua é conservadora: não acusa o que ainda pode rolar
    expect(
      derivarPendencias(entrada({ encontros: [mesmo19h] }))
    ).toEqual([]);
    // às 20h a sessão das 19h já era — vira pendência
    const depois = derivarPendencias(
      entrada({
        agora: `${HOJE}T20:00:00-03:00`,
        encontros: [mesmo19h],
      })
    );
    expect(tipoUnico(depois)).toBe("encontro_sem_desfecho");
    // e às 18h ainda não — o encontro sequer começou
    expect(
      derivarPendencias(
        entrada({
          agora: `${HOJE}T18:00:00-03:00`,
          encontros: [mesmo19h],
        })
      )
    ).toEqual([]);
  });

  it("sessão de especialista usa 'sessão' no título", () => {
    const lista = derivarPendencias(
      entrada({ encontros: [enc({ numero: 3, sessao: true })] })
    );
    expect(lista[0].titulo).toBe("A 3ª sessão era em 17/11. Aconteceu?");
  });

  it("o 'com quem' entra inteiro no contexto — a frase de fallback não vira 'com seu'", () => {
    const lista = derivarPendencias(
      entrada({ encontros: [enc({ comQuem: "seu mentor" })] })
    );
    expect(lista[0].contexto).toBe("com seu mentor");
    const esp = derivarPendencias(
      entrada({
        encontros: [enc({ sessao: true, comQuem: "seu especialista" })],
      })
    );
    expect(esp[0].contexto).toBe("com seu especialista");
  });

  it.each(["realizado", "nao_aconteceu", "cancelado", "remarcado"])(
    "encontro %s passado não vira pendência",
    (status) => {
      expect(
        derivarPendencias(entrada({ encontros: [enc({ status })] }))
      ).toEqual([]);
    }
  );
});

describe("derivarPendencias — termo e combinado", () => {
  it("termo pendente aparece com ação 'Assinar'", () => {
    const doc: DocumentoPendencia = {
      id: "a1",
      slug: "termo-mentorando",
      titulo: "Termo de Adesão e Participação no Programa de Mentoria Social",
      status: "pendente",
      token: "tok123",
      tokenExpiraEm: "2026-12-10T00:00:00-03:00",
    };
    const lista = derivarPendencias(entrada({ documentos: [doc] }));
    expect(lista).toHaveLength(1);
    expect(lista[0].tipo).toBe("termo");
    expect(lista[0].prioridade).toBe(85);
    expect(lista[0].titulo).toBe("Assine o termo de participação");
    expect(lista[0].acao.rotulo).toBe("Assinar");
    expect(lista[0].acao.href).toBe("/assinar/tok123");
    expect(lista[0].contexto).toBe("vale até 10/12/2026");
  });

  it("assinado e link já expirado não viram pendência", () => {
    const base: DocumentoPendencia = {
      id: "a1",
      slug: "termo-mentorando",
      titulo: null,
      status: "pendente",
      token: "tok",
      tokenExpiraEm: null,
    };
    expect(
      derivarPendencias(
        entrada({ documentos: [{ ...base, status: "assinado" }] })
      )
    ).toEqual([]);
    expect(
      derivarPendencias(
        entrada({
          documentos: [
            { ...base, tokenExpiraEm: `${PASSADO}T23:59:00-03:00` },
          ],
        })
      )
    ).toEqual([]);
  });

  it("combinado vence em 2 dias entra; em 10 não; vencido entra marcando atraso", () => {
    const comb = (id: string, prazo: string): CombinadoPendencia => ({
      id,
      descricao: "resolver os 10 exercícios",
      prazo,
      status: "pendente",
    });
    const em2 = derivarPendencias(
      entrada({ combinados: [comb("c-2", "2026-11-23")] })
    );
    expect(em2).toHaveLength(1);
    expect(em2[0].tipo).toBe("combinado");
    expect(em2[0].prioridade).toBe(80);
    expect(em2[0].titulo).toBe("resolver os 10 exercícios · até 23/11");
    expect(em2[0].acao).toMatchObject({
      tipo: "marcar_combinado",
      rotulo: "Marcar feito",
      alvoId: "c-2",
    });
    expect(em2[0].contexto).toBeUndefined();

    expect(
      derivarPendencias(entrada({ combinados: [comb("c-10", "2026-12-01")] }))
    ).toEqual([]);

    const vencido = derivarPendencias(
      entrada({ combinados: [comb("c-v", "2026-11-19")] })
    );
    expect(vencido).toHaveLength(1);
    expect(vencido[0].contexto).toContain("passou do prazo");
  });

  it("combinado sem prazo ou feito não entra", () => {
    expect(
      derivarPendencias(
        entrada({
          combinados: [
            { id: "c1", descricao: "x", prazo: null, status: "pendente" },
            { id: "c2", descricao: "y", prazo: HOJE, status: "feito" },
          ],
        })
      )
    ).toEqual([]);
  });
});

describe("derivarPendencias — avaliações, sugestão, aviso, chamado", () => {
  it("6 avaliações viram 1 item agrupado com a contagem e a ação avaliar", () => {
    const avaliacoes: AvaliacaoPendencia[] = Array.from(
      { length: 6 },
      (_, i) => ({
        id: `e-${i + 1}`,
        realizadoEm: `2026-11-${String(10 + i).padStart(2, "0")}T19:00:00-03:00`,
      })
    );
    const lista = derivarPendencias(entrada({ avaliacoes }));
    expect(lista).toHaveLength(1);
    expect(lista[0].tipo).toBe("avaliacao");
    expect(lista[0].prioridade).toBe(70);
    expect(lista[0].titulo).toBe("6 encontros esperando sua avaliação");
    expect(lista[0].contexto).toBe("1 min cada");
    expect(lista[0].acao).toMatchObject({
      tipo: "avaliar",
      rotulo: "Avaliar em sequência",
      // alvo = encontro mais recente — o primeiro da sequência
      alvoId: "e-6",
    });
  });

  it("avaliações de sessão esp contam 'sessões' no título agrupado", () => {
    const avaliacoes: AvaliacaoPendencia[] = [1, 2].map((i) => ({
      id: `e-${i}`,
      realizadoEm: `2026-11-${10 + i}T19:00:00-03:00`,
      sessao: true,
    }));
    const lista = derivarPendencias(entrada({ avaliacoes }));
    expect(lista[0].titulo).toBe("2 sessões esperando sua avaliação");
  });

  it("avaliações mistas (encontro + sessão) nomeiam os dois", () => {
    const avaliacoes: AvaliacaoPendencia[] = [
      { id: "e-1", realizadoEm: "2026-11-11T19:00:00-03:00" },
      {
        id: "e-2",
        realizadoEm: "2026-11-12T19:00:00-03:00",
        sessao: true,
      },
    ];
    const lista = derivarPendencias(entrada({ avaliacoes }));
    expect(lista[0].titulo).toBe(
      "2 encontros e sessões esperando sua avaliação"
    );
  });

  it("sugestão, aviso urgente e chamado com resposta entram; aviso normal não", () => {
    const sugestao: SugestaoPendencia = {
      id: "s1",
      sugeridoPor: "Ricardo Andrade",
      especialistaNome: "Sofia Lima",
      criadoEm: "2026-11-20T10:00:00-03:00",
    };
    const urgente: AvisoPendencia = {
      id: "av1",
      titulo: "Encontro coletivo sábado",
      prioridade: "urgente",
      criadoEm: "2026-11-21T08:00:00-03:00",
    };
    const normal: AvisoPendencia = {
      id: "av2",
      titulo: "Recado da coordenação",
      prioridade: "normal",
      criadoEm: "2026-11-20T08:00:00-03:00",
    };
    const chamado: ChamadoPendencia = {
      id: "ch1",
      assunto: "Falta material do encontro",
      andamento: "resposta",
      respondeuNome: "Marina Duarte",
      atualizadoEm: "2026-11-21T09:00:00-03:00",
    };
    const semResposta: ChamadoPendencia = {
      id: "ch2",
      assunto: "Outro pedido",
      andamento: null,
      atualizadoEm: "2026-11-21T09:00:00-03:00",
    };
    const lista = derivarPendencias(
      entrada({
        sugestoes: [sugestao],
        avisos: [urgente, normal],
        chamados: [chamado, semResposta],
      })
    );
    const porTipo = Object.fromEntries(lista.map((p) => [p.tipo, p]));
    expect(Object.keys(porTipo).sort()).toEqual([
      "aviso",
      "chamado",
      "especialista",
    ]);
    expect(porTipo.especialista.titulo).toBe(
      "Ricardo sugeriu um especialista"
    );
    expect(porTipo.especialista.prioridade).toBe(60);
    expect(porTipo.aviso.prioridade).toBe(55);
    expect(porTipo.aviso.acao.tipo).toBe("ler_aviso");
    expect(porTipo.chamado.titulo).toBe("Marina respondeu seu pedido");
    expect(porTipo.chamado.acao).toMatchObject({
      tipo: "abrir_chamado",
      href: "/jovem?c=ch1#apoio",
    });
  });
});

describe("chamadoPendencia — projeção linha do chamado (504)", () => {
  it("aberto sem dono não vira pendência — espera, não tarefa", () => {
    const p = chamadoPendencia({
      id: "c1",
      assunto: "Não consigo anexar a foto",
      status: "aberto",
      atribuido_a: null,
      atribuido_nome: null,
      updated_at: "2026-11-20T14:40:00-03:00",
    });
    expect(p).toEqual({
      id: "c1",
      assunto: "Não consigo anexar a foto",
      andamento: null,
      respondeuNome: null,
      atualizadoEm: "2026-11-20T14:40:00-03:00",
    });
    expect(derivarPendencias(entrada({ chamados: [p] }))).toEqual([]);
  });

  it("em atendimento com dono e SEM resposta pública é 'cuidando' — nunca promete resposta", () => {
    const p = chamadoPendencia({
      id: "c2",
      assunto: "O guia não abre no celular",
      status: "em_atendimento",
      atribuido_a: "marina-id",
      atribuido_nome: "Marina Duarte",
      tem_resposta_equipe: false,
      updated_at: "2026-11-21T08:10:00-03:00",
    });
    expect(p.andamento).toBe("cuidando");
    // sem resposta não há "quem respondeu" — o nome não migra pro título
    expect(p.respondeuNome).toBeNull();
    const lista = derivarPendencias(entrada({ chamados: [p] }));
    expect(lista).toHaveLength(1);
    expect(lista[0].titulo).toBe("A equipe está cuidando do seu pedido");
    expect(lista[0].acao).toMatchObject({
      tipo: "abrir_chamado",
      rotulo: "Ver andamento",
      href: "/jovem?c=c2#apoio",
    });
  });

  it("aberto já com dono sem resposta também é 'cuidando'", () => {
    const p = chamadoPendencia({
      id: "c3",
      status: "aberto",
      atribuido_a: "marina-id",
      atribuido_nome: "Marina Duarte",
      tem_resposta_equipe: false,
    });
    expect(p.andamento).toBe("cuidando");
  });

  it("resposta pública da equipe vira 'resposta' — com o primeiro nome de quem cuida", () => {
    const p = chamadoPendencia({
      id: "c4",
      assunto: "O encontro pode cair no feriado?",
      status: "em_atendimento",
      atribuido_a: "marina-id",
      atribuido_nome: "Marina Duarte",
      tem_resposta_equipe: true,
      updated_at: "2026-11-21T09:45:00-03:00",
    });
    expect(p.andamento).toBe("resposta");
    expect(p.respondeuNome).toBe("Marina Duarte");
    const lista = derivarPendencias(entrada({ chamados: [p] }));
    expect(lista).toHaveLength(1);
    expect(lista[0].titulo).toBe("Marina respondeu seu pedido");
    expect(lista[0].acao).toMatchObject({
      rotulo: "Ver resposta",
      href: "/jovem?c=c4#apoio",
    });
  });

  it.each(["resolvido", "cancelado"] as const)(
    "status %s nunca vira pendência — nem com resposta pública nem dono",
    (status) => {
      const p = chamadoPendencia({
        id: "c5",
        status,
        atribuido_a: "marina-id",
        atribuido_nome: "Marina Duarte",
        tem_resposta_equipe: true,
      });
      expect(p.andamento).toBeNull();
      expect(p.respondeuNome).toBeNull();
      expect(derivarPendencias(entrada({ chamados: [p] }))).toEqual([]);
    }
  );

  it("resposta sem nome de responsável cai pra 'A equipe' — nunca inventa nome", () => {
    const p = chamadoPendencia({
      id: "c6",
      status: "em_atendimento",
      atribuido_a: "alguem-id",
      atribuido_nome: null,
      tem_resposta_equipe: true,
    });
    expect(p.respondeuNome).toBeNull();
    const [item] = derivarPendencias(entrada({ chamados: [p] }));
    expect(item.titulo).toBe("A equipe respondeu seu pedido");
  });
});

describe("derivarPendencias — retroativo", () => {
  it("retroativo elegível entra com registrar_retroativo e a semana do guia", () => {
    // dataOficial 12/11 (quinta) → semana de 09/11 (seg)
    const lista = derivarPendencias(
      entrada({ retro: [{ numero: 4, dataOficial: "2026-11-12" }] })
    );
    expect(lista).toHaveLength(1);
    expect(lista[0].tipo).toBe("registro_retroativo");
    expect(lista[0].prioridade).toBe(90);
    expect(lista[0].titulo).toBe(
      "O 4º encontro era na semana de 09/11 e não está na agenda. Vocês se encontraram?"
    );
    expect(lista[0].acao).toMatchObject({
      tipo: "registrar_retroativo",
      rotulo: "Sim, registrar",
      alvoId: "4",
    });
  });
});

describe("derivarPendencias — ordenação e robustez", () => {
  it("ordem determinística (prioridade, quando, id) e destaque só no 1º", () => {
    const fonte = entrada({
      avisos: [
        { id: "av1", titulo: "Urgente", prioridade: "urgente", criadoEm: null },
        { id: "av2", titulo: "Importante", prioridade: "importante", criadoEm: null },
      ],
      encontros: [
        enc({ id: "e-1", numero: 6, dataHora: "2026-11-19T19:00:00-03:00" }),
        enc({ id: "e-2", numero: 5, dataHora: "2026-11-17T19:00:00-03:00" }),
      ],
      combinados: [
        { id: "c1", descricao: "x", prazo: "2026-11-22", status: "pendente" },
      ],
    });
    const a = derivarPendencias(fonte);
    // mesma saída com a entrada embaralhada — a ordem não depende da ordem
    // dos arrays de entrada
    const b = derivarPendencias(
      entrada({
        combinados: fonte.combinados,
        encontros: [...fonte.encontros].reverse(),
        avisos: [...fonte.avisos].reverse(),
        avaliacoes: [],
        documentos: [],
        sugestoes: [],
        retro: [],
      })
    );
    expect(b.map((p) => p.id)).toEqual(a.map((p) => p.id));

    // prioridade desc; dentro dela, quando asc (o encontro mais antigo 1º)
    expect(a.map((p) => p.prioridade)).toEqual([100, 100, 80, 55, 45]);
    expect(a[0].acao.alvoId).toBe("e-2");
    expect(a[1].acao.alvoId).toBe("e-1");
    // destaque é do topo e de mais ninguém
    expect(a.filter((p) => p.destaque)).toHaveLength(1);
    expect(a[0].destaque).toBe(true);
  });

  it("entradas vazias → []; campos nulos ignorados", () => {
    expect(derivarPendencias(entrada({}))).toEqual([]);
    const lista = derivarPendencias(
      entrada({
        encontros: [
          enc({ dataHora: null }),
          enc({ dataHora: "não-é-data" }),
        ],
        combinados: [
          { id: "c1", descricao: "x", prazo: "32/13", status: "pendente" },
        ],
        documentos: [
          { id: "a1", slug: null, titulo: null, status: null },
        ],
        sugestoes: [{ id: "s1" }],
        avisos: [{ id: "av", titulo: "  ", prioridade: "urgente" }],
        retro: [{ numero: 4, dataOficial: "ontem" }],
      })
    );
    // só a sugestão e o retroativo sobrevivem — nada explode
    expect(lista.map((p) => p.tipo).sort()).toEqual([
      "especialista",
      "registro_retroativo",
    ]);
    // retro (90) ordena antes da sugestão (60)
    expect(lista[0].titulo).toBe(
      "O 4º encontro não está na agenda. Vocês se encontraram?"
    );
  });

  it("nenhum item duplicado — mesmo alvo duas vezes na entrada vira um só", () => {
    const lista = derivarPendencias(
      entrada({
        encontros: [enc({ id: "e-1" }), enc({ id: "e-1" })],
        avisos: [
          { id: "av1", titulo: "Urgente", prioridade: "urgente", criadoEm: null },
          { id: "av1", titulo: "Urgente", prioridade: "urgente", criadoEm: null },
        ],
      })
    );
    expect(lista).toHaveLength(2);
    expect(new Set(lista.map((p) => p.id)).size).toBe(lista.length);
  });
});
