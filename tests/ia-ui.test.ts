// genUI direto (lib/ia/ui.ts): o projetor recorta o resultado da tool ao
// que o card mostra. Aqui se prova o contrato que a rota emite — lista
// vazia não vira card, lookup intermediário não vira card, o jovem não
// recebe semáforo, e os cortes (≤5 destaques, ≤12 encontros…) seguram o
// payload pequeno.

import { describe, expect, it } from "vitest";
import { juntarUi, uiDaTool, uiDosInstrumentos, type UiBloco } from "@/lib/ia/ui";
import { systemPromptIa } from "@/lib/ia/prompts";

const dupla = (i: number, extra: Record<string, unknown> = {}) => ({
  dupla_id: `d-${i}`,
  mentor: `Mentor ${i}`,
  mentorado: `Jovem ${i}`,
  trilha: "dpp",
  status: "ativa",
  semaforo: "ok",
  motivo: null,
  apoio: { aberto: false },
  esperado: 5,
  feitos: 5,
  ...extra,
});

describe("resumo_semana → saude", () => {
  const saude = { em_andamento: 8, risco: 2, atencao: 3, em_dia: 3, apoio: 1, pausadas: 1, concluidas: 2, encerradas: 2 };

  it("contagem vem pronta da tool e destaques só pegam quem pede ação", () => {
    const duplas = [
      dupla(1, { apoio: { aberto: true } }),
      dupla(2, { semaforo: "risco", motivo: "2 encontros atrasados" }),
      dupla(3, { semaforo: "atencao" }),
      dupla(4),
    ];
    const b = uiDaTool("resumo_semana", { saude, duplas });
    expect(b?.kind).toBe("saude");
    if (b?.kind !== "saude") return;
    expect(b.contagem).toEqual(saude);
    expect(b.pedem_acao).toBe(3);
    expect(b.destaques.map((d) => d.id)).toEqual(["d-1", "d-2", "d-3"]);
    expect(b.destaques[0].apoio).toBe(true);
  });

  it("corta em 5 destaques mas conta todas", () => {
    const duplas = Array.from({ length: 9 }, (_, i) => dupla(i, { semaforo: "risco" }));
    const b = uiDaTool("resumo_semana", { saude, duplas });
    if (b?.kind !== "saude") throw new Error("sem card");
    expect(b.destaques).toHaveLength(5);
    expect(b.pedem_acao).toBe(9);
  });

  it("sem duplas não vira card", () => {
    expect(uiDaTool("resumo_semana", { saude, duplas: [] })).toBeNull();
  });
});

describe("ficha_dupla → dupla", () => {
  const base = {
    dupla_id: "d-1",
    trilha: "dpp",
    status: "ativa",
    turma: "T1",
    mentor: "Ana",
    mentorado: "Bia",
    supervisor: "Cris",
    encontros: [
      { numero: 1, status: "realizado", tem_registro: true },
      { numero: 2, status: "agendado", tem_registro: false },
    ],
    proximo_encontro: { numero: 2, data_hora: "2026-11-03T22:00:00Z" },
  };

  it("staff recebe situação e apoio", () => {
    const b = uiDaTool("ficha_dupla", {
      ...base,
      semaforo: "atencao",
      motivo: "registro pendente",
      apoio: { aberto: true },
      registro_pendente: true,
      esperado: 2,
      feitos: 1,
    });
    if (b?.kind !== "dupla") throw new Error("sem card");
    expect(b.semaforo).toBe("atencao");
    expect(b.apoio).toBe(true);
    expect(b.feitos).toBe(1);
    expect(b.proximo).toEqual({ numero: 2, data_hora: "2026-11-03T22:00:00Z" });
  });

  it("jovem (sem semáforo na tool) não recebe situação no card", () => {
    const b = uiDaTool("ficha_dupla", base);
    if (b?.kind !== "dupla") throw new Error("sem card");
    expect(b).not.toHaveProperty("semaforo");
    expect(b).not.toHaveProperty("apoio");
    expect(b.feitos).toBe(1); // derivado dos encontros realizados
  });

  it("dupla fora do alcance (null) não vira card", () => {
    expect(uiDaTool("ficha_dupla", null)).toBeNull();
  });
});

describe("demais tools", () => {
  it("agenda corta em 12 e guarda o total", () => {
    const encontros = Array.from({ length: 20 }, (_, i) => ({
      dupla_id: `d-${i}`,
      mentor: "A",
      mentorado: "B",
      numero: 3,
      status: "agendado",
      data_hora: `2026-11-0${(i % 9) + 1}T22:00:00Z`,
    }));
    const b = uiDaTool("agenda_do_periodo", { desde: "a", ate: "b", total: 20, encontros });
    if (b?.kind !== "agenda") throw new Error("sem card");
    expect(b.encontros).toHaveLength(12);
    expect(b.total).toBe(20);
  });

  it("capacidade ordena pelos mais ocupados", () => {
    const b = uiDaTool("capacidade_mentores", {
      mentores: [
        { mentor_id: "1", nome: "Livre", trilha: "dpp", em_uso: 0, capacidade: 2 },
        { mentor_id: "2", nome: "Cheio", trilha: "dpp", em_uso: 2, capacidade: 2 },
      ],
    });
    if (b?.kind !== "capacidade") throw new Error("sem card");
    expect(b.mentores.map((m) => m.nome)).toEqual(["Cheio", "Livre"]);
  });

  it("chamados vêm mais recentes primeiro", () => {
    const b = uiDaTool("chamados_resumo", {
      aberto: 1,
      em_atendimento: 1,
      chamados: [
        { numero: "C-1", categoria: "agenda", assunto: "x", status: "aberto", criado_em: "2026-10-01" },
        { numero: "C-2", categoria: "outro", assunto: "y", status: "em_atendimento", criado_em: "2026-10-20" },
      ],
    });
    if (b?.kind !== "chamados") throw new Error("sem card");
    expect(b.chamados[0].numero).toBe("C-2");
  });

  it("guia limpa o trecho, corta na frase e nunca leva a pagina sintética", () => {
    const b = uiDaTool("guia_consulta", {
      fontes: [
        {
          guia: "guia-mentor-dpp",
          secao: "10",
          pagina: 42, // id do chunk — não pode vazar pro card
          trecho: `<b>Preserve</b> a **dupla** | segue ${"x".repeat(400)}`,
        },
      ],
    });
    if (b?.kind !== "fontes") throw new Error("sem card");
    expect(b.fontes[0].trecho.length).toBeLessThanOrEqual(320);
    expect(b.fontes[0].trecho).toContain("Preserve a dupla · segue");
    expect(b.fontes[0].trecho).not.toMatch(/<b>|\*\*|\|/);
    expect("pagina" in b.fontes[0]).toBe(false);
  });

  it("lookup intermediário e tool sem card não viram card", () => {
    expect(uiDaTool("duplas_do_usuario", { duplas: [{ dupla_id: "x" }] })).toBeNull();
    expect(uiDaTool("tool_que_nao_existe", { a: 1 })).toBeNull();
    expect(uiDaTool("pessoas_busca", { pessoas: [] })).toBeNull();
  });

  it("instrumentos contam entregas por status", () => {
    const b = uiDosInstrumentos("d-1", [
      {
        sistema: "roda_da_vida",
        titulo: "Roda da Vida",
        entregas: [{ status: "respondido" }, { status: "pendente" }, { status: "expirado" }],
      },
    ]);
    expect(b?.itens[0]).toEqual({
      sistema: "roda_da_vida",
      titulo: "Roda da Vida",
      respondidos: 1,
      pendentes: 1,
    });
    expect(uiDosInstrumentos("d-1", [])).toBeNull();
  });
});

describe("juntarUi", () => {
  it("mesmo kind: o último vence, ordem de chegada preservada", () => {
    const a = { kind: "pessoas", pessoas: [] } as UiBloco;
    const b = { kind: "fila", mentorados: [], mentores: [], total_mentorados: 0, total_mentores: 0 } as UiBloco;
    const a2 = { kind: "pessoas", pessoas: [{ id: "1", nome: "X", papel: null }] } as UiBloco;
    expect(juntarUi(juntarUi(juntarUi([], a), b), a2)).toEqual([b, a2]);
  });
});

describe("prompt v3", () => {
  it("apresenta a Liza e manda não repetir o card", () => {
    const p = systemPromptIa(["coordenacao"]);
    expect(p).toContain("Liza");
    expect(p).toContain("Não repita a lista");
    for (const tag of ["sugestoes", "escolha", "rascunho", "passos", "destaque"])
      expect(p).toContain(`\`\`\`${tag}`);
  });

  it("ficha da dupla aberta vira contexto de 'esta dupla'", () => {
    const id = "11111111-2222-3333-4444-555555555555";
    expect(systemPromptIa(["mentor_dpp"], `/duplas/${id}`)).toContain(
      `ficha da dupla ${id}`
    );
    expect(systemPromptIa(["mentor_dpp"])).not.toContain("está agora na página");
  });
});

// ---------- mentorado (pacote liza nov/2026) ----------
// As tools do jovem projetam sem vazar instrumento de equipe: a dupla dele
// não tem semáforo/motivo, os pedidos saem com rótulo próprio e a ajuda
// vira citação "Ajuda do Realiza" no card de fontes.

describe("tools do mentorado → cards", () => {
  it("minha_dupla → dupla sem semáforo (ramo jovem)", () => {
    const b = uiDaTool("minha_dupla", {
      dupla_id: "d-1",
      trilha: "dpp",
      status: "ativa",
      turma: "T1",
      mentor: "Ana",
      supervisor: "Paulo",
      encontros: [
        { numero: 1, status: "realizado", data_hora: "2026-01-10T19:00:00Z" },
        { numero: 2, status: "agendado", data_hora: "2026-01-20T19:00:00Z" },
      ],
    });
    expect(b?.kind).toBe("dupla");
    if (b?.kind !== "dupla") return;
    expect(b.semaforo).toBeUndefined();
    expect(b.feitos).toBe(1);
    expect(b.proximo).toEqual({ numero: 2, data_hora: "2026-01-20T19:00:00Z" });
    expect(b.encontros.every((e) => !e.tem_registro)).toBe(true);
  });

  it("minha_dupla → remarcado conta como próximo (mesma regra da agenda)", () => {
    const b = uiDaTool("minha_dupla", {
      dupla_id: "d-1",
      trilha: "dpp",
      status: "ativa",
      turma: "T1",
      mentor: "Ana",
      supervisor: "Paulo",
      encontros: [
        { numero: 1, status: "realizado", data_hora: "2026-01-10T19:00:00Z" },
        { numero: 2, status: "remarcado", data_hora: "2026-01-22T19:00:00Z" },
      ],
    });
    if (b?.kind !== "dupla") throw new Error("sem card");
    expect(b.proximo).toEqual({ numero: 2, data_hora: "2026-01-22T19:00:00Z" });
  });

  it("ficha_dupla no ramo jovem usa o mentorado que a tool emite (\"Você\")", () => {
    const b = uiDaTool("ficha_dupla", {
      dupla_id: "d-1",
      trilha: "dpp",
      status: "ativa",
      turma: "T1",
      mentor: "Ricardo",
      mentorado: "Você",
      encontros: [{ numero: 1, status: "realizado" }],
      proximo_encontro: { numero: 2, data_hora: "2026-02-03T19:00:00Z" },
    });
    if (b?.kind !== "dupla") throw new Error("sem card");
    expect(b.mentorado).toBe("Você");
    expect(b.proximo).toEqual({ numero: 2, data_hora: "2026-02-03T19:00:00Z" });
    expect(b).not.toHaveProperty("semaforo");
  });

  it("minha_agenda → agenda só com próximos", () => {
    const b = uiDaTool("minha_agenda", {
      proximos: [
        { dupla_id: "d-1", numero: 3, data_hora: "2026-02-03T19:00:00Z", status: "agendado" },
        { dupla_id: "d-1", numero: 4, data_hora: "2026-02-10T19:00:00Z", status: "agendado" },
      ],
      ultimos_realizados: [{ numero: 2, realizado_em: "2026-01-27T19:00:00Z" }],
    });
    expect(b?.kind).toBe("agenda");
    if (b?.kind !== "agenda") return;
    expect(b.encontros).toHaveLength(2);
    expect(b.encontros[0].mentor).toBeNull();
  });

  it("meus_combinados → combinados pendente + feito", () => {
    const b = uiDaTool("meus_combinados", {
      pendentes: [{ texto: "Atualizar o PDM", prazo: "2026-02-05", criado_em: "x" }],
      feitos_recentes: [{ texto: "Responder a Visão" }],
    });
    expect(b?.kind).toBe("combinados");
    if (b?.kind !== "combinados") return;
    expect(b.pendentes[0].texto).toBe("Atualizar o PDM");
    expect(b.feitos).toEqual(["Responder a Visão"]);
  });

  it("meu_progresso → jornada com esteira respondido × pendente", () => {
    const b = uiDaTool("meu_progresso", {
      dupla_id: "d-1",
      instrumentos: [
        { sistema: "visao", titulo: "Visão", respondidos: 1, pendentes: 0 },
        { sistema: "pdm", titulo: "PDM", respondidos: 0, pendentes: 1 },
      ],
      total_respondidos: 1,
      total_pendentes: 1,
    });
    expect(b?.kind).toBe("jornada");
    if (b?.kind !== "jornada") return;
    expect(b.instrumentos).toHaveLength(2);
    expect(b.total_respondidos).toBe(1);
  });

  it("meus_pedidos → pedidos até 5, sem campos internos", () => {
    const b = uiDaTool("meus_pedidos", {
      pedidos: [
        { especialista: "Dra. Lia", sobre: "carreira", status: "aberta", criado_em: "2026-01-01" },
      ],
    });
    expect(b?.kind).toBe("pedidos");
    if (b?.kind !== "pedidos") return;
    expect(b.pedidos[0].especialista).toBe("Dra. Lia");
    expect("mentorado_id" in b.pedidos[0]).toBe(false);
  });

  it("ajuda_faq → fontes com rótulo da Ajuda", () => {
    const b = uiDaTool("ajuda_faq", {
      respostas: [
        { pergunta: "Quem marca os encontros?", resposta: "Você e seu mentor…", links: [] },
      ],
    });
    expect(b?.kind).toBe("fontes");
    if (b?.kind !== "fontes") return;
    expect(b.fontes[0].guia).toBe("Ajuda do Realiza");
  });

  it("lista vazia não vira card (minha_dupla sem dupla, agenda sem encontro)", () => {
    expect(uiDaTool("minha_dupla", null)).toBeNull();
    expect(uiDaTool("minha_agenda", { proximos: [] })).toBeNull();
    expect(uiDaTool("meus_combinados", { pendentes: [], feitos_recentes: [] })).toBeNull();
  });
});
