import { describe, expect, it } from "vitest";
import {
  contextoDuplaAux,
  duplasPorTurma,
  itensConsolidados,
} from "@/lib/agenda-auxiliar";
import type {
  CicloEvento,
  Cronograma,
  Dupla,
  Encontro,
  MentoradoPar,
  Profile,
  Supervisao,
} from "@/lib/types";

// Âncora: quarta 07/10/2026 meio-dia SP — semana seg 05/10 → dom 11/10,
// janela da consolidada até dom 18/10. AGORA_SEG = segunda da mesma semana
// (antes da terça oficial) pros estados "em dia" do contexto.
const AGORA = new Date("2026-10-07T12:00:00-03:00");
const AGORA_SEG = new Date("2026-10-05T12:00:00-03:00");

function mkProfile(nome: string): Profile {
  return {
    id: `p-${nome}`,
    user_id: null,
    nome,
    email: `${nome}@x.test`,
    whatsapp: null,
    role: "mentor_dpp",
    ativo: true,
    bio: null,
    linkedin: null,
    areas: null,
    voluntariado: null,
    onboarded_em: null,
  };
}

function mkMentorado(nome: string, nome_social: string | null = null): MentoradoPar {
  return {
    id: `m-${nome}`,
    nome,
    nome_social,
    avatar_path: null,
    whatsapp: null,
    email: null,
    ong_origem: null,
    cidade: null,
    uf: null,
    interesses: [],
    disponibilidade: null,
    situacao: "ativo",
  };
}

function mkEncontro(over: Partial<Encontro>): Encontro {
  return {
    id: `e-${Math.random().toString(36).slice(2, 8)}`,
    dupla_id: "d1",
    numero: 1,
    data_hora: null,
    realizado_em: null,
    duracao_min: 60,
    status: "agendado",
    origem: "plataforma",
    link: null,
    motivo_reagendamento: null,
    registro: null,
    ...over,
  };
}

function mkDupla(over: Partial<Dupla> = {}): Dupla {
  return {
    id: "d1",
    turma: "T1",
    cronograma_id: "c1",
    status: "ativa",
    iniciada_em: "2026-09-01",
    trilha: "dpp",
    demanda: null,
    solicitacao_id: null,
    mentor: mkProfile("André Lima"),
    mentorado: mkMentorado("Ana Souza"),
    supervisor: null,
    encontros: [],
    encaminhamentos: [],
    ...over,
  };
}

function mkEvento(
  numero: number | null,
  data: string | null,
  tipo: CicloEvento["tipo"] = "encontro",
  cronogramaId = "c1",
  over: Partial<CicloEvento> = {}
): CicloEvento {
  return {
    id: `ev-${cronogramaId}-${tipo}-${numero ?? data}`,
    cronograma_id: cronogramaId,
    tipo,
    numero,
    data,
    data_fim: null,
    status: "pendente",
    observacao: null,
    ordem: numero ?? 90,
    titulo: numero != null ? `Encontro ${numero}` : "Evento",
    fase: null,
    instrumentos: [],
    ...over,
  };
}

function mkCronograma(over: Partial<Cronograma> = {}): Cronograma {
  return {
    id: "c1",
    nome: "Calendário oficial",
    turma: "T1",
    trilha: "dpp",
    inicio_em: "2026-09-01",
    fim_em: "2027-06-30",
    encontros_esperados: 16,
    status: "ativo",
    created_by: null,
    created_at: "2026-01-01T00:00:00Z",
    ...over,
  };
}

const COM_REGISTRO = { id: "r1" } as Encontro["registro"];

// realizado fechado (com registro) num dia dado — o "em dia" da dupla
function realizado(duplaId: string, numero: number, dia: string): Encontro {
  return mkEncontro({
    dupla_id: duplaId,
    numero,
    status: "realizado",
    data_hora: `2026-${dia}T22:00:00Z`,
    realizado_em: `2026-${dia}T22:00:00Z`,
    registro: COM_REGISTRO,
  });
}

// ---- calendário: T1 terças (6→22/09 … 8→06/10 vigente, 9→13/10, 10→20/10);
// T2 quartas (4→30/09, 5→07/10 vigente, 6→14/10); T3 só o 1 (13/10);
// T5 ativo sem eventos; C4 rascunho com evento (dupla órfã vira "Sem turma").
const C1 = mkCronograma({ id: "c1", turma: "T1" });
const C2 = mkCronograma({ id: "c2", turma: "T2" });
const C3 = mkCronograma({ id: "c3", turma: "T3" });
const C4 = mkCronograma({ id: "c4", turma: "T4", status: "rascunho" });
const C5 = mkCronograma({ id: "c5", turma: "T5" });

const EVENTOS = [
  mkEvento(6, "2026-09-22"),
  mkEvento(7, "2026-09-29"),
  mkEvento(8, "2026-10-06"),
  mkEvento(9, "2026-10-13"),
  mkEvento(10, "2026-10-20"),
  mkEvento(4, "2026-09-30", "encontro", "c2"),
  mkEvento(5, "2026-10-07", "encontro", "c2"),
  mkEvento(6, "2026-10-14", "encontro", "c2"),
  mkEvento(1, "2026-10-13", "encontro", "c3"),
  mkEvento(1, "2026-10-06", "encontro", "c4"),
];

// ---- duplas ----
const dOk = mkDupla({
  id: "dOk",
  encontros: [
    realizado("dOk", 6, "09-22"),
    realizado("dOk", 7, "09-29"),
    mkEncontro({
      dupla_id: "dOk",
      numero: 8,
      status: "realizado",
      data_hora: "2026-10-06T22:00:00Z",
      realizado_em: "2026-10-06T22:00:00Z",
      registro: COM_REGISTRO,
    }),
  ],
});
const dAgendada = mkDupla({
  id: "dAg",
  mentor: mkProfile("Bruno Paz"),
  mentorado: mkMentorado("Beatriz Reis"),
  encontros: [
    realizado("dAg", 6, "09-22"),
    realizado("dAg", 7, "09-29"),
    mkEncontro({ dupla_id: "dAg", numero: 8, data_hora: "2026-10-08T22:00:00Z" }),
  ],
});
const dSem = mkDupla({
  id: "dSem",
  mentor: mkProfile("Caio Melo"),
  mentorado: mkMentorado("Clara Dias"),
});
const dPaus = mkDupla({ id: "dPaus", status: "pausada" });
const dT2 = mkDupla({
  id: "dT2",
  turma: "T2",
  cronograma_id: "c2",
  mentor: mkProfile("Érica Fontes"),
  mentorado: mkMentorado("Elisa Nunes"),
  encontros: [
    mkEncontro({ dupla_id: "dT2", numero: 5, data_hora: "2026-10-07T22:00:00Z" }),
  ],
});
const dT3 = mkDupla({ id: "dT3", turma: "T3", cronograma_id: "c3" });
const dOrfa = mkDupla({ id: "dOrfa", turma: "T4", cronograma_id: "c4" }); // cronograma rascunho
const dNull = mkDupla({ id: "dNull", turma: "", cronograma_id: null });
const dT5 = mkDupla({ id: "dT5", turma: "T5", cronograma_id: "c5" });

// ============================================================
describe("duplasPorTurma", () => {
  it("agrupa por cronograma ativo na ordem de turma; resto cai em 'Sem turma' no fim", () => {
    const grupos = duplasPorTurma(
      [dOk, dAgendada, dSem, dPaus, dT2, dT3, dOrfa, dNull, dT5],
      [C5, C3, C2, C1, C4], // fora de ordem de propósito
      EVENTOS,
      AGORA
    );
    expect(grupos.map((g) => g.turma)).toEqual(["T1", "T2", "T3", "T5", ""]);
    expect(grupos[4]).toMatchObject({
      cronogramaId: null,
      rotulo: "Sem turma",
      encontroVigente: null,
    });
    // T4 é rascunho → a dupla órfã cai junto com a sem-cronograma
    expect(grupos[4].duplas.map((d) => d.id).sort()).toEqual(["dNull", "dOrfa"]);
  });

  it("rótulo com dia/hora do vigente; cronograma sem eventos tem meta vazia", () => {
    const grupos = duplasPorTurma(
      [dOk, dAgendada, dT3, dT5],
      [C1, C3, C5],
      EVENTOS,
      AGORA
    );
    expect(grupos[0].rotulo).toBe("Turma 1 · terças 19h");
    expect(grupos[0].encontroVigente).toBe(8);
    // T3 tem vigente mas nenhum agendado → só o dia
    expect(grupos[1].rotulo).toBe("Turma 3 · terças");
    expect(grupos[1].encontroVigente).toBe(1);
    // T5 não tem evento nenhum → meta vazia, vigente null
    expect(grupos[2].rotulo).toBe("Turma 5");
    expect(grupos[2].encontroVigente).toBeNull();
  });

  it("dentro do grupo ordena por semáforo (risco primeiro) e inclui pausadas", () => {
    const grupos = duplasPorTurma(
      [dOk, dAgendada, dSem, dPaus],
      [C1],
      EVENTOS,
      AGORA
    );
    const ids = grupos[0].duplas.map((d) => d.id);
    // dSem (3 oficiais vencidos, nada feito) é risco; dAgendada (1 atraso)
    // é atenção; dOk e a pausada são ok — pausada entra no grupo mesmo assim
    expect(ids[0]).toBe("dSem");
    expect(ids[1]).toBe("dAg");
    expect(ids).toContain("dPaus");
    // concluída fica de fora — e grupo sem duplas não nasce
    const comConcluida = duplasPorTurma(
      [mkDupla({ id: "dX", status: "concluida" })],
      [C1],
      EVENTOS,
      AGORA
    );
    expect(comConcluida).toHaveLength(0);
  });

  it("sem cronogramas correspondentes tudo vira 'Sem turma'; vazia sai vazia", () => {
    const g = duplasPorTurma([dOk, dAgendada], [], EVENTOS, AGORA);
    expect(g).toHaveLength(1);
    expect(g[0].rotulo).toBe("Sem turma");
    expect(g[0].duplas).toHaveLength(2);
    expect(duplasPorTurma([], [C1], EVENTOS, AGORA)).toEqual([]);
  });
});

// ============================================================
describe("itensConsolidados", () => {
  const dEsp = mkDupla({
    id: "dEsp",
    turma: "Esp",
    cronograma_id: null,
    trilha: "especialista",
    demanda: "Transição de carreira",
    mentor: mkProfile("Luísa Prado"),
    mentorado: mkMentorado("Bia Campos"),
    encontros: [
      mkEncontro({
        dupla_id: "dEsp",
        numero: 1,
        data_hora: "2026-10-09T21:00:00Z", // sex 18h
      }),
      realizado("dEsp", 1, "09-30"), // semana passada — fora
    ],
  });
  const sup: Supervisao = {
    id: "s1",
    supervisor_id: "ps",
    mentor_id: "pm",
    dupla_id: "dOk",
    data: "2026-10-07",
    resumo: "Alinhou o plano do 8º encontro com o mentor.",
    created_by: null,
    created_at: "2026-10-07T15:00:00Z",
    supervisor: { id: "ps", nome: "Paula Nunes" },
    mentor: { id: "pm", nome: "André Lima" },
  };
  const supFora: Supervisao = { ...sup, id: "s2", data: "2026-10-13" }; // semana que vem
  const oficiais = [
    mkEvento(null, "2026-10-09", "evento_encerramento", "c1", {
      titulo: "Festa de encerramento",
    }),
    mkEvento(null, "2026-10-10", "formacao", "c1", {
      titulo: "Formação de mentores",
    }),
    mkEvento(null, "2026-10-11", "recesso", "c2", { titulo: "Recesso" }),
    mkEvento(null, null, "etapa_preparacao", "c1"), // sem data → fora
  ];

  function consolidada() {
    return itensConsolidados(
      [dOk, dAgendada, dSem, dPaus, dT2, dT3, dOrfa, dEsp],
      [sup, supFora],
      [...EVENTOS, ...oficiais],
      AGORA
    );
  }

  it("encontro da dupla: 'Jovem com Mentor', pill da turma, convidado=false", () => {
    const itens = consolidada();
    const enc = itens.find((i) => i.id.startsWith("enc-") && i.duplaId === "dOk")!;
    expect(enc).toMatchObject({
      tipo: "encontro",
      diaKey: "2026-10-06",
      titulo: "Ana com André",
      detalhe: "Encontro 8 · Turma 1",
      convidado: false,
      pill: "T1",
      href: "/duplas/dOk",
    });
  });

  it("sessão de especialista é convidada com pill 'Esp'", () => {
    const esp = consolidada().find((i) => i.tipo === "sessao_esp")!;
    expect(esp).toMatchObject({
      diaKey: "2026-10-09",
      titulo: "Bia × Luísa Prado: Transição de carreira",
      detalhe: "Trilha de especialista · sessão 1 de 5",
      convidado: true,
      pill: "Esp",
    });
  });

  it("supervisão da semana entra com pill 'Você'; a da próxima semana não", () => {
    const itens = consolidada();
    const s = itens.find((i) => i.id === "sup-s1")!;
    expect(s).toMatchObject({
      tipo: "supervisao",
      diaKey: "2026-10-07",
      titulo: "Supervisão · Paula Nunes × André Lima",
      convidado: false,
      pill: "Você",
      href: "/duplas/dOk",
    });
    expect(itens.find((i) => i.id === "sup-s2")).toBeUndefined();
  });

  it("evento oficial datado na janela é convidado com pill vazia", () => {
    const itens = consolidada();
    const ofs = itens.filter((i) => i.tipo === "oficial");
    expect(ofs.map((o) => o.titulo)).toEqual([
      "Festa de encerramento",
      "Formação de mentores",
      "Recesso",
    ]);
    expect(ofs.every((o) => o.convidado && o.pill === "")).toBe(true);
  });

  it("'a_agendar' sintético: só do encontro VIGENTE, no dia oficial, href da ficha", () => {
    const ags = consolidada().filter((i) => i.tipo === "a_agendar");
    // vigentes: T1→enc8 (06/10), T2→enc5 (07/10), T3→enc1 (13/10), T4→enc1 (06/10)
    // dSem sem row do 8; dOrfa sem row do enc1 de T4; dT3 sem row do enc1 de T3.
    // O enc9/enc10 da T1 NÃO geram itens — não são o vigente.
    expect(ags.map((a) => `${a.duplaId}:${a.diaKey}`).sort()).toEqual([
      "dOrfa:2026-10-06",
      "dSem:2026-10-06",
      "dT3:2026-10-13",
    ]);
    const sem = ags.find((a) => a.duplaId === "dSem")!;
    expect(sem).toMatchObject({
      titulo: "Encontro 8 a agendar",
      convidado: false,
      pill: "T1",
      href: "/duplas/dSem",
    });
  });

  it("ordena por início e respeita a janela (semana + 7 dias; realizados só na semana)", () => {
    const itens = consolidada();
    const chaves = itens.map((i) => `${i.diaKey}:${i.tipo}`);
    expect(chaves).toEqual([
      "2026-10-06:a_agendar",
      "2026-10-06:a_agendar",
      "2026-10-06:encontro",
      "2026-10-07:supervisao",
      "2026-10-07:encontro",
      "2026-10-08:encontro",
      "2026-10-09:oficial",
      "2026-10-09:sessao_esp",
      "2026-10-10:oficial",
      "2026-10-11:oficial",
      "2026-10-13:a_agendar",
    ]);
    // agendado além da janela (19/10) e realizado fora da semana (12/10) saem
    const dBordas = mkDupla({
      id: "dBordas",
      encontros: [
        ...[6, 7, 8].map((n) =>
          realizado("dBordas", n, n === 6 ? "09-22" : n === 7 ? "09-29" : "10-06")
        ),
        mkEncontro({ dupla_id: "dBordas", numero: 9, data_hora: "2026-10-19T22:00:00Z" }),
        mkEncontro({ dupla_id: "dBordas", numero: 10, data_hora: "2026-10-12T22:00:00Z" }),
        mkEncontro({
          dupla_id: "dBordas",
          numero: 11,
          status: "cancelado",
          data_hora: "2026-10-08T22:00:00Z",
        }),
      ],
    });
    const itensB = itensConsolidados([dBordas], [], EVENTOS, AGORA);
    // só o realizado do 8 (06/10) — o agendado 12/10 entra (dentro da janela),
    // o 19/10 (além) e o cancelado ficam fora
    expect(itensB.map((i) => i.diaKey)).toEqual(["2026-10-06", "2026-10-12"]);
  });

  it("zero duplas / zero eventos sai vazio", () => {
    expect(itensConsolidados([], [], [], AGORA)).toEqual([]);
    // sem eventos oficiais, ainda assim saem os encontros das duplas
    const so = itensConsolidados([dOk], [], [], AGORA);
    expect(so).toHaveLength(1);
    expect(so[0].tipo).toBe("encontro");
  });
});

// ============================================================
describe("contextoDuplaAux", () => {
  it("em dia: encontro de hoje com link vira 'hoje, 19h, online' + próximo previsto", () => {
    const d = mkDupla({
      encontros: [
        realizado("d1", 6, "09-22"),
        realizado("d1", 7, "09-29"),
        mkEncontro({
          numero: 8,
          data_hora: "2026-10-05T22:00:00Z", // hoje 19h (segunda)
          link: "https://meet.google.com/abc-defg",
        }),
      ],
    });
    expect(contextoDuplaAux(d, EVENTOS, AGORA_SEG)).toEqual({
      texto:
        "Encontro 8 da Turma 1: hoje, 19h, online. Próximo previsto: encontro 9 em ter 13.",
      problema: false,
    });
  });

  it("agendado pra amanhã: 'amanhã (ter 6), 19h'", () => {
    const d = mkDupla({
      encontros: [
        realizado("d1", 6, "09-22"),
        realizado("d1", 7, "09-29"),
        mkEncontro({ numero: 8, data_hora: "2026-10-06T22:00:00Z" }),
      ],
    });
    const { texto, problema } = contextoDuplaAux(d, EVENTOS, AGORA_SEG);
    expect(texto).toBe(
      "Encontro 8 da Turma 1: amanhã (ter 6), 19h. Próximo previsto: encontro 9 em ter 13."
    );
    expect(problema).toBe(false);
  });

  it("sem data do vigente (em dia até agora): 'Sem encontro agendado nesta semana'", () => {
    const d = mkDupla({
      encontros: [realizado("d1", 6, "09-22"), realizado("d1", 7, "09-29")],
    });
    expect(contextoDuplaAux(d, EVENTOS, AGORA_SEG)).toEqual({
      texto:
        "Encontro 8 da Turma 1. Sem encontro agendado nesta semana (prazo: dom 11).",
      problema: true,
    });
  });

  it("atraso de 1 encontro: 'Encontro 7 da Turma 1 atrasado (1 encontro)'", () => {
    const d = mkDupla({ encontros: [realizado("d1", 6, "09-22")] });
    expect(contextoDuplaAux(d, EVENTOS, AGORA_SEG)).toEqual({
      texto:
        "Encontro 7 da Turma 1 atrasado (1 encontro). Sem encontro agendado para o 8.",
      problema: true,
    });
  });

  it("atraso de 2+: lista os números — 'Encontros 6 e 7 da Turma 1 atrasados'", () => {
    const d = mkDupla({ id: "dZ" });
    expect(contextoDuplaAux(d, EVENTOS, AGORA_SEG)).toEqual({
      texto:
        "Encontros 6 e 7 da Turma 1 atrasados (2 encontros). Sem encontro agendado para o 8.",
      problema: true,
    });
  });

  it("limbo: agendado vencido sem registro vira problema próprio", () => {
    const d = mkDupla({
      encontros: [
        realizado("d1", 6, "09-22"),
        mkEncontro({ numero: 7, data_hora: "2026-09-29T22:00:00Z" }), // venceu
        mkEncontro({ numero: 8, data_hora: "2026-10-08T22:00:00Z" }),
      ],
    });
    const { texto, problema } = contextoDuplaAux(d, EVENTOS, AGORA_SEG);
    expect(texto).toBe(
      "Encontro 7 da Turma 1: agendado já passou e segue sem registro. Aconteceu?"
    );
    expect(problema).toBe(true);
  });

  it("registro pendente fecha a linha quando o resto está em dia", () => {
    const d = mkDupla({
      encontros: [
        mkEncontro({
          numero: 6,
          status: "realizado",
          data_hora: "2026-09-22T22:00:00Z",
          realizado_em: "2026-09-22T22:00:00Z",
        }), // sem registro → pendente
        realizado("d1", 7, "09-29"),
        mkEncontro({ numero: 8, data_hora: "2026-10-06T22:00:00Z" }),
      ],
    });
    const { texto, problema } = contextoDuplaAux(d, EVENTOS, AGORA_SEG);
    expect(texto).toBe(
      "Encontro 8 da Turma 1: amanhã (ter 6), 19h. Próximo previsto: encontro 9 em ter 13. Registro do encontro 6 pendente."
    );
    expect(problema).toBe(false);
  });

  it("pausada não é problema: devolve o rótulo do status", () => {
    expect(contextoDuplaAux(dPaus, EVENTOS, AGORA)).toEqual({
      texto: "Dupla pausada",
      problema: false,
    });
  });
});
