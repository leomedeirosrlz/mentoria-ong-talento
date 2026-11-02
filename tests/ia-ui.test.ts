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
  const saude = { em_andamento: 8, risco: 2, atencao: 3, em_dia: 3, apoio: 1, pausadas: 1 };

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

  it("guia corta o trecho e mantém a referência", () => {
    const b = uiDaTool("guia_consulta", {
      fontes: [{ guia: "guia-mentor-dpp", secao: "10", pagina: 42, trecho: "x".repeat(500) }],
    });
    if (b?.kind !== "fontes") throw new Error("sem card");
    expect(b.fontes[0].trecho.length).toBeLessThanOrEqual(320);
    expect(b.fontes[0].pagina).toBe(42);
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
  it("apresenta a Rea e manda não repetir o card", () => {
    const p = systemPromptIa(["coordenacao"]);
    expect(p).toContain("Rea");
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
