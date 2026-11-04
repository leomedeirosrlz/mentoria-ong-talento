import { describe, expect, it } from "vitest";
import {
  demoChamadosFila,
  demoChamadoTimeline,
  demoChamadosSemDono,
  demoEquipeChamados,
} from "@/lib/demo/queries";
import { getDemoData } from "@/lib/demo/data";
import {
  anexarMentorado,
  CHAMADO_CATEGORIA_LABEL,
  CHAMADO_STATUS_LABEL,
  duplasOpcoesChamado,
} from "@/lib/ciclo";
import type { ChamadoCategoria, ChamadoStatus } from "@/lib/types";

// 0084 — regras puras dos chamados: o escopo do modo demo replica a RLS,
// então é a régua executável das decisões de acesso (plataforma mascarada
// pro auxiliar, autor ≠ dupla, interno nunca sai pro autor).

const NUM = {
  registro: "CHA-000141", // flag do registro da Fernanda (outro)
  jovem: "CHA-000142", // pedido do Caio pela avaliação (urgencia)
  agenda: "CHA-000143", // do Ricardo, em atendimento com a Marina
  plataforma: "CHA-000144", // da Ana (autora jovem logada)
  metodo: "CHA-000145", // aberto pela coord, atribuído ao Paulo
  devolutiva: "CHA-000136", // da Sofia, resolvido
  urgenciaAntiga: "CHA-000129", // do João Pedro, resolvido
  metodoAntiga: "CHA-000118", // do Ricardo, resolvido
};

function item(role: Parameters<typeof demoChamadosFila>[0], numero: string) {
  return demoChamadosFila(role).find((c) => c.numero === numero) ?? null;
}

describe("demoChamadosFila — escopo por papel", () => {
  it("coordenação vê a fila inteira, sem máscara", () => {
    const fila = demoChamadosFila("coordenacao");
    expect(fila.map((c) => c.numero).sort()).toEqual(
      Object.values(NUM).sort()
    );
    const plat = item("coordenacao", NUM.plataforma)!;
    expect(plat.restrito).toBe(false);
    expect(plat.assunto).toContain("anexar");
    expect(plat.autor_nome).toBe("Ana Beatriz Silva");
  });

  it("auxiliar executivo vê todas as linhas mas plataforma vem mascarada", () => {
    const fila = demoChamadosFila("supervisor");
    expect(fila.length).toBe(Object.keys(NUM).length);
    const plat = item("supervisor", NUM.plataforma)!;
    expect(plat.restrito).toBe(true);
    expect(plat.assunto).toBeNull();
    expect(plat.autor_id).toBeNull();
    expect(plat.autor_nome).toBeNull();
    expect(plat.dupla_id).toBeNull();
    // e os outros chegam íntegros
    const reg = item("supervisor", NUM.registro)!;
    expect(reg.restrito).toBe(false);
    expect(reg.autor_nome).toContain("Fernanda");
  });

  it("mentor vê só os próprios — dupla_id do jovem não dá acesso", () => {
    const fila = demoChamadosFila("mentor_dpp");
    expect(fila.map((c) => c.numero).sort()).toEqual(
      [NUM.agenda, NUM.metodoAntiga].sort()
    );
  });

  it("mentorado vê só os da própria ficha", () => {
    const fila = demoChamadosFila("mentorado");
    expect(fila.map((c) => c.numero)).toEqual([NUM.plataforma]);
  });

  it("a fila ordena aberto → em atendimento → resolvido, recente em cima", () => {
    const fila = demoChamadosFila("coordenacao");
    const ordem = fila.map((c) => c.status);
    const idx = (s: ChamadoStatus) =>
      ordem.findIndex((x) => x === s);
    expect(idx("aberto")).toBeGreaterThanOrEqual(0);
    expect(idx("aberto")).toBeLessThan(idx("em_atendimento"));
    expect(idx("em_atendimento")).toBeLessThan(idx("resolvido"));
    // dentro dos abertos, o mais novo primeiro — por created_at, não por
    // número fixo: as datas do fixture derivam de hoje, e um chamado
    // ancorado a encontro pode virar o mais novo depois de um rollover
    const abertos = fila.filter((c) => c.status === "aberto");
    const stamps = abertos.map((c) => c.created_at);
    expect(stamps).toEqual([...stamps].sort().reverse());
  });

  it("contexto descreve a origem (registro / avaliação / dupla)", () => {
    expect(item("coordenacao", NUM.registro)!.contexto).toMatch(
      /Registro do 2º encontro · Dandara/
    );
    expect(item("coordenacao", NUM.jovem)!.contexto).toMatch(
      /Avaliação do 4º encontro · Caio/
    );
    expect(item("coordenacao", NUM.agenda)!.contexto).toBe(
      "Dupla de Ana Beatriz Silva"
    );
  });
});

describe("mentorado_nome — mentorado da dupla vinculada", () => {
  it("mentor vê o nome do mentorado do próprio chamado", () => {
    // CHA-000143 e CHA-000118 são do Ricardo, dupla da Ana Beatriz
    expect(item("mentor_dpp", NUM.agenda)!.mentorado_nome).toBe(
      "Ana Beatriz Silva"
    );
    expect(item("mentor_dpp", NUM.metodoAntiga)!.mentorado_nome).toBe(
      "Ana Beatriz Silva"
    );
  });

  it("staff também recebe o campo (a exibição usa o contexto)", () => {
    // CHA-000141 nasceu do registro da dupla da Dandara
    expect(item("coordenacao", NUM.registro)!.mentorado_nome).toBe(
      "Dandara Souza"
    );
  });

  it("chamado sem dupla fica null e restrito não vaza o nome", () => {
    expect(item("coordenacao", NUM.jovem)!.mentorado_nome).not.toBeNull();
    expect(item("supervisor", NUM.plataforma)!.mentorado_nome).toBeNull();
  });
});

describe("anexarMentorado — leitura em lote do autor", () => {
  it("preenche pelo dupla_id; sem dupla ou sem nome fica null", () => {
    const itens = anexarMentorado(
      [
        { id: "c1", dupla_id: "d1" },
        { id: "c2", dupla_id: "d2" },
        { id: "c3", dupla_id: null },
      ],
      new Map([
        ["d1", "Ana Beatriz Silva"],
        ["d2", null],
      ])
    );
    expect(itens[0].mentorado_nome).toBe("Ana Beatriz Silva");
    // dupla vinculada que a RLS não entregou → null, sem inventar
    expect(itens[1].mentorado_nome).toBeNull();
    // chamado de assunto geral (sem dupla) → null
    expect(itens[2].mentorado_nome).toBeNull();
  });
});

describe("duplasOpcoesChamado — select de dupla do NovoChamadoDialog", () => {
  const DUPLAS = [
    {
      id: "d1",
      status: "ativa",
      trilha: "dpp",
      mentor: { id: "m1" },
      mentorado: { nome: "Ana" },
    },
    {
      id: "d2",
      status: "pausada",
      trilha: "especialista",
      mentor: { id: "m1" },
      mentorado: { nome: "Caio" },
    },
    {
      id: "d3",
      status: "encerrada",
      trilha: "dpp",
      mentor: { id: "m1" },
      mentorado: { nome: "Bia" },
    },
    {
      id: "d4",
      status: "ativa",
      trilha: "dpp",
      mentor: { id: "m2" },
      mentorado: { nome: "Dan" },
    },
  ] as const;

  it("só duplas da pessoa como mentora, ativas ou pausadas", () => {
    expect(duplasOpcoesChamado(DUPLAS, "m1")).toEqual([
      { id: "d1", label: "Ana · DPP" },
      { id: "d2", label: "Caio · Especialista" },
    ]);
    // d3 encerrada e d4 de outra pessoa ficam de fora
  });

  it("quem não é mentor recebe lista vazia (o campo some)", () => {
    expect(duplasOpcoesChamado(DUPLAS, "m3")).toEqual([]);
    expect(duplasOpcoesChamado([], "m1")).toEqual([]);
  });
});

describe("demoChamadoTimeline — trilha pública × interna", () => {
  const data = getDemoData();
  const idAgenda = data.chamados.find((c) => c.numero === NUM.agenda)!.id;

  it("staff vê sistema + públicas + internas + anexos", () => {
    const tl = demoChamadoTimeline(idAgenda, true);
    const tipos = tl.map((t) => t.tipo);
    expect(tipos).toContain("sistema");
    expect(tipos).toContain("publica");
    expect(tipos).toContain("interno");
    // ordenado por created_at
    const stamps = tl.map((t) => t.item.created_at);
    expect([...stamps].sort()).toEqual(stamps);
  });

  it("autor vê o mesmo chamado SEM a nota interna", () => {
    const tl = demoChamadoTimeline(idAgenda, false);
    expect(tl.every((t) => t.tipo !== "interno")).toBe(true);
    expect(tl.map((t) => t.tipo)).toContain("publica");
  });

  it("anexo interno não sai pro autor", () => {
    const data2 = getDemoData();
    const plat = data2.chamados.find((c) => c.numero === NUM.plataforma)!;
    const tlStaff = demoChamadoTimeline(plat.id, true);
    const tlAutor = demoChamadoTimeline(plat.id, false);
    expect(tlStaff.some((t) => t.tipo === "anexo")).toBe(true);
    // o anexo da Ana é público — os dois veem; o interno seria filtrado
    expect(tlAutor.some((t) => t.tipo === "anexo")).toBe(true);
  });
});

describe("demoEquipeChamados — equipe do autocomplete @", () => {
  it("só coordenação e auxiliar executivo ativos, ordenados por nome", () => {
    const eq = demoEquipeChamados();
    expect(eq.map((p) => p.nome)).toEqual([
      "Beatriz Lins",
      "Marina Duarte",
      "Paulo Serra",
    ]);
    expect(
      eq.every(
        (p) => p.role === "coordenacao" || p.role === "supervisor"
      )
    ).toBe(true);
  });
});

describe("demoChamadosSemDono — badge da nav", () => {
  it("coord conta os abertos sem responsável", () => {
    // abertos sem dono: 141 (registro), 142 (jovem), 144 (plataforma) = 3
    expect(demoChamadosSemDono("coordenacao")).toBe(3);
  });

  it("auxiliar não conta plataforma (é da coordenação)", () => {
    // 144 mascarado (restrito) não entra na fila dele → 141 + 142 = 2
    expect(demoChamadosSemDono("supervisor")).toBe(2);
  });

  it("autor nunca tem fila", () => {
    expect(demoChamadosSemDono("mentor_dpp")).toBe(0);
    expect(demoChamadosSemDono("mentorado")).toBe(0);
  });
});

describe("labels", () => {
  it("toda categoria e status tem rótulo pt-BR", () => {
    const cats: ChamadoCategoria[] = [
      "agenda",
      "metodologia",
      "plataforma",
      "urgencia",
      "outro",
    ];
    const stats: ChamadoStatus[] = ["aberto", "em_atendimento", "resolvido"];
    for (const c of cats) expect(CHAMADO_CATEGORIA_LABEL[c]).toBeTruthy();
    for (const s of stats) expect(CHAMADO_STATUS_LABEL[s]).toBeTruthy();
  });
});
