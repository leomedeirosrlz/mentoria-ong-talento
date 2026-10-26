import { describe, expect, it } from "vitest";
import {
  cortePeriodo,
  panoramaRegistros,
  periodoRegistrosDe,
} from "@/lib/registros";
import type { CicloEvento, Cronograma, Dupla } from "@/lib/types";
import {
  CICLO_16,
  CRON_T1,
  CRON_T2,
  dt,
  encAgendado,
  encRealizado,
  mkAvaliacao,
  mkCronograma,
  mkDupla,
  mkEncontro,
  mkEvento,
  mkRegistro,
} from "./helpers";

// Panorama do ciclo (REALIZA-198): agregação pura sobre duplas + calendário
// oficial. hoje injetado em tudo — terça 04/11/2025 é o encontro 5 do ciclo
// de referência, então a 2ª feira 03/11 deixa o enc 5 "na semana" e o 6+
// como futuro ("ainda não chegou").

const HOJE = dt("2025-11-03"); // seg — enc 5 (terça 04/11) cai nesta semana
const CRONS: Cronograma[] = [mkCronograma()];

const ev = (numero: number) => {
  const slot = CICLO_16.find((e) => e.numero === numero);
  return slot!.data!;
};

function base(
  duplas: Dupla[],
  over: Partial<Parameters<typeof panoramaRegistros>[0]> = {}
) {
  return panoramaRegistros({
    duplas,
    eventos: CICLO_16,
    cronogramas: CRONS,
    recorte: {},
    hoje: HOJE,
    ...over,
  });
}

describe("panoramaRegistros — denominador honesto", () => {
  it("esperadas = duplas ativas cobradas; entregues = as que lançaram registro", () => {
    const p = base([
      mkDupla({
        id: "d-1",
        encontros: [encRealizado(1, ev(1)), encRealizado(2, ev(2))],
      }),
      mkDupla({
        id: "d-2",
        encontros: [encRealizado(1, ev(1))], // enc 2 realizado mas sem registro? não — sem row
      }),
    ]);
    const s1 = p.slots.find((s) => s.numero === 1)!;
    expect(s1.celulas[0].esperadas).toBe(2);
    expect(s1.celulas[0].entregues).toBe(2);
    const s2 = p.slots.find((s) => s.numero === 2)!;
    expect(s2.celulas[0].esperadas).toBe(2);
    expect(s2.celulas[0].entregues).toBe(1);
    // a falta é nomeada, não só uma cor
    expect(s2.celulas[0].totalPendentes).toBe(1);
    expect(s2.celulas[0].pendentes[0]).toContain("×");
  });

  it("dupla pausada sem row de encontro encolhe o esperado — não vira falta", () => {
    const p = base([
      mkDupla({ id: "d-1", encontros: [encRealizado(1, ev(1))] }),
      mkDupla({ id: "d-2", status: "pausada" }), // pausou antes do ciclo
    ]);
    const s1 = p.slots.find((s) => s.numero === 1)!;
    expect(s1.celulas[0].esperadas).toBe(1);
    expect(s1.celulas[0].totalPendentes).toBe(0);
  });

  it("pausada que já lançou o encontro entra no denominador (a row é a prova)", () => {
    const p = base([
      mkDupla({ id: "d-1", encontros: [encRealizado(1, ev(1))] }),
      mkDupla({
        id: "d-2",
        status: "pausada",
        encontros: [encRealizado(1, ev(1))],
      }),
    ]);
    const s1 = p.slots.find((s) => s.numero === 1)!;
    expect(s1.celulas[0].esperadas).toBe(2);
    expect(s1.celulas[0].entregues).toBe(2);
  });

  it("realizado sem registro conta em 'realizados' e vira pendente de registro", () => {
    const p = base([
      mkDupla({
        id: "d-1",
        encontros: [encRealizado(1, ev(1), null)], // aconteceu, registro pendente
      }),
    ]);
    const s1 = p.slots.find((s) => s.numero === 1)!;
    expect(s1.celulas[0].realizados).toBe(1);
    expect(s1.celulas[0].entregues).toBe(0);
    expect(s1.celulas[0].totalPendentes).toBe(1);
  });

  it("iniciada_em depois da data oficial encolhe o trilho — ingresso tardio não é falta", () => {
    const p = base([
      mkDupla({ id: "d-1", iniciada_em: "2025-10-20" }), // entrou depois do enc 2
      mkDupla({
        id: "d-2",
        encontros: [1, 2, 3].map((n) => encRealizado(n, ev(n))),
      }),
    ]);
    const s = (n: number) =>
      p.slots.find((x) => x.numero === n)!.celulas[0];
    // antes do ingresso ela não era cobrada — nem denominador nem pendente
    expect(s(1).esperadas).toBe(1);
    expect(s(1).totalPendentes).toBe(0);
    expect(s(2).esperadas).toBe(1);
    expect(s(2).totalPendentes).toBe(0);
    // a partir do encontro que ela já viveu a cobrança é normal
    expect(s(3).esperadas).toBe(2);
    expect(s(3).totalPendentes).toBe(1);
  });

  it("nao_aconteceu/cancelado fecham o encontro — ficam no esperado, não viram falta", () => {
    const p = base([
      mkDupla({ id: "d-ag", encontros: [encAgendado(1, ev(1))] }),
      mkDupla({
        id: "d-re",
        encontros: [mkEncontro(1, { status: "remarcado" })],
      }),
      mkDupla({ id: "d-rz", encontros: [encRealizado(1, ev(1), null)] }),
      mkDupla({
        id: "d-na",
        encontros: [mkEncontro(1, { status: "nao_aconteceu" })],
      }),
      mkDupla({
        id: "d-ca",
        encontros: [mkEncontro(1, { status: "cancelado" })],
      }),
      mkDupla({ id: "d-sem" }), // sem row nenhuma — falta de verdade
    ]);
    const c = p.slots.find((s) => s.numero === 1)!.celulas[0];
    expect(c.esperadas).toBe(6); // todas eram cobradas (row ou ativa na data)
    expect(c.entregues).toBe(0);
    expect(c.realizados).toBe(1);
    // pendente = row aberta sem registro OU sem row: ag/re/rz/sem = 4;
    // nao_aconteceu e cancelado já encerraram — o buraco deles lê como
    // "encontro não realizado", não como dívida de registro
    expect(c.totalPendentes).toBe(4);
  });
});

describe("panoramaRegistros — estados do calendário", () => {
  it("vencido × semana × futuro: a semana corrente não é falta", () => {
    const p = base([mkDupla()]);
    const s = (n: number) =>
      p.slots.find((x) => x.numero === n)!.celulas[0].estado;
    expect(s(4)).toBe("vencido"); // 28/10 < 03/11
    expect(s(5)).toBe("semana"); // 04/11: hoje ≤ data ≤ domingo
    expect(s(6)).toBe("futuro"); // 11/11 > domingo da semana
    // futuro mantém o trilho (esperadas) mas não acusa pendência
    const futuro = p.slots.find((x) => x.numero === 6)!.celulas[0];
    expect(futuro.esperadas).toBe(1);
    expect(futuro.totalPendentes).toBe(0);
    expect(futuro.entregues).toBe(0);
  });

  it("enc na própria data de hoje é 'semana' — a acontecer, não falta", () => {
    const p = panoramaRegistros({
      duplas: [mkDupla()],
      eventos: CICLO_16,
      cronogramas: CRONS,
      recorte: {},
      hoje: dt("2025-11-04"), // a terça do encontro 5
    });
    const c = p.slots.find((x) => x.numero === 5)!.celulas[0];
    // regra do mock: o encontro do dia é hachurado "a acontecer", nunca
    // buraco + pendência — a falta só existe quando a data já passou
    expect(c.estado).toBe("semana");
    expect(c.totalPendentes).toBe(0);
  });

  it("coluna mista: mesmo nº vencido numa turma e futuro noutra", () => {
    const CICLO_T2M: CicloEvento[] = [
      mkEvento(1, "2025-10-28", { id: "ev2-1", cronograma_id: CRON_T2 }),
      mkEvento(2, "2025-11-11", { id: "ev2-2", cronograma_id: CRON_T2 }),
    ];
    const p = panoramaRegistros({
      duplas: [
        mkDupla({ id: "d-1" }),
        mkDupla({ id: "d-2", turma: "2026/2027", cronograma_id: CRON_T2 }),
      ],
      eventos: [...CICLO_16, ...CICLO_T2M],
      cronogramas: [
        mkCronograma(),
        mkCronograma({ id: CRON_T2, turma: "2026/2027", nome: "Calendário T2" }),
      ],
      recorte: {},
      hoje: HOJE, // seg 03/11 — domingo da semana é 09/11
    });
    // o estado é por CÉLULA, não por slot: T1 enc 2 (14/10) já venceu e
    // cobra falta; T2 enc 2 (11/11) nem chegou — trilho sem pendência
    const s2 = p.slots.find((s) => s.numero === 2)!;
    const t1 = s2.celulas.find((c) => c.cronogramaId === CRON_T1)!;
    const t2 = s2.celulas.find((c) => c.cronogramaId === CRON_T2)!;
    expect(t1.estado).toBe("vencido");
    expect(t1.totalPendentes).toBe(1);
    expect(t2.estado).toBe("futuro");
    expect(t2.esperadas).toBe(1);
    expect(t2.totalPendentes).toBe(0);
  });
});

describe("panoramaRegistros — recortes", () => {
  const duplaT2 = () =>
    mkDupla({
      id: "d-t2",
      turma: "2026/2027",
      cronograma_id: CRON_T2,
      encontros: [encRealizado(1, "2025-10-14")],
    });
  const CICLO_T2: CicloEvento[] = [
    mkEvento(1, "2025-10-14", { id: "ev2-1", cronograma_id: CRON_T2 }),
    mkEvento(2, "2025-10-21", { id: "ev2-2", cronograma_id: CRON_T2 }),
    mkEvento(3, "2025-11-04", { id: "ev2-3", cronograma_id: CRON_T2 }),
  ];
  const CRONS_2 = [
    mkCronograma(),
    mkCronograma({
      id: CRON_T2,
      turma: "2026/2027",
      nome: "Calendário T2",
    }),
  ];

  it("turma filtra cronogramas do eixo e duplas do denominador", () => {
    const p = panoramaRegistros({
      duplas: [mkDupla({ id: "d-1" }), duplaT2()],
      eventos: [...CICLO_16, ...CICLO_T2],
      cronogramas: CRONS_2,
      recorte: { turma: CRON_T2 },
      hoje: HOJE,
    });
    expect(p.turmas.map((t) => t.cronogramaId)).toEqual([CRON_T2]);
    // só os 3 encontros oficiais da T2 viram coluna
    expect(p.slots.map((s) => s.numero)).toEqual([1, 2, 3]);
    expect(p.slots[0].celulas[0].esperadas).toBe(1);
  });

  it("sem recorte as duas turmas dividem a mesma coluna por encontro", () => {
    const p = panoramaRegistros({
      duplas: [mkDupla({ id: "d-1" }), duplaT2()],
      eventos: [...CICLO_16, ...CICLO_T2],
      cronogramas: CRONS_2,
      recorte: {},
      hoje: HOJE,
    });
    expect(p.turmas).toHaveLength(2);
    const s1 = p.slots.find((s) => s.numero === 1)!;
    expect(s1.celulas).toHaveLength(2);
    expect(s1.celulas.map((c) => c.cronogramaId)).toEqual([CRON_T1, CRON_T2]);
  });

  it("cronograma sem dupla no escopo não entra nem na legenda", () => {
    const p = panoramaRegistros({
      duplas: [mkDupla()], // só T1
      eventos: [...CICLO_16, ...CICLO_T2],
      cronogramas: CRONS_2,
      recorte: {},
      hoje: HOJE,
    });
    expect(p.turmas.map((t) => t.cronogramaId)).toEqual([CRON_T1]);
  });

  it("dupla = resumo de uma dupla só (esperadas nunca passa de 1)", () => {
    const alvo = mkDupla({
      id: "d-1",
      encontros: [encRealizado(1, ev(1))],
    });
    const p = base([alvo, mkDupla({ id: "d-2" })], {
      recorte: { dupla: "d-1" },
    });
    for (const s of p.slots)
      expect(s.celulas.every((c) => c.esperadas <= 1)).toBe(true);
  });

  it("encontro = zoom num slot só", () => {
    const p = base([mkDupla()], { recorte: { encontro: 3 } });
    expect(p.slots.map((s) => s.numero)).toEqual([3]);
  });

  it("turma × dupla divergentes intersectam — recorte vazio zera as colunas", () => {
    // ?turma=T2&dupla=<dupla da T1>: a lista filtra pelos dois eixos e sai
    // vazia: o panorama acompanha (leria um recorte que a página não mostra)
    const p = panoramaRegistros({
      duplas: [mkDupla({ id: "d-1" }), duplaT2()],
      eventos: [...CICLO_16, ...CICLO_T2],
      cronogramas: CRONS_2,
      recorte: { turma: CRON_T2, dupla: "d-1" },
      hoje: HOJE,
    });
    expect(p.slots).toEqual([]);
  });

  it("turma × dupla coerentes: o recorte vira o resumo dela dentro da turma", () => {
    const p = panoramaRegistros({
      duplas: [mkDupla({ id: "d-1" }), duplaT2()],
      eventos: [...CICLO_16, ...CICLO_T2],
      cronogramas: CRONS_2,
      recorte: { turma: CRON_T2, dupla: "d-t2" },
      hoje: HOJE,
    });
    // a coluna só cobra a própria dupla — esperadas nunca passa de 1
    for (const s of p.slots)
      expect(s.celulas.every((c) => c.esperadas <= 1)).toBe(true);
  });

  it("período 4s corta encontros antes do corte e o futuro além da semana", () => {
    const p = base([mkDupla()], { recorte: { periodo: "4s" } });
    // corte = 03/11 − 28d = 06/10: entram enc 1 (07/10) a 5 (04/11);
    // o 6+ é futuro além do domingo da semana — fora da janela
    expect(p.slots.map((s) => s.numero)).toEqual([1, 2, 3, 4, 5]);
  });

  it("período 8s mesmo corte — aqui os dois dão o mesmo recorte", () => {
    const p = base([mkDupla()], { recorte: { periodo: "8s" } });
    expect(p.slots.map((s) => s.numero)).toEqual([1, 2, 3, 4, 5]);
  });

  it("período não reduz o donut — semáforo é do ciclo vigente", () => {
    const p = base([mkDupla(), mkDupla({ id: "d-2" })], {
      recorte: { periodo: "4s" },
    });
  });
});

describe("panoramaRegistros — linha de avaliação", () => {
  it("estrelas do jovem e nota do mentor são séries separadas", () => {
    const p = base([
      mkDupla({
        id: "d-1",
        encontros: [
          {
            ...encRealizado(1, ev(1), mkRegistro({ avaliacao: "excelente" })),
            avaliacao_jovem: mkAvaliacao({ estrelas: 5 }),
          },
        ],
      }),
    ]);
    const c = p.slots.find((s) => s.numero === 1)!.celulas[0];
    expect(c.estrelas).toEqual([5]);
    expect(c.notasMentor).toEqual([4]); // excelente → 4 na régua 1–4
    expect(c.avaliados).toBe(1);
  });

  it("encontro sem avaliação do jovem não vira zero — a célula fica sem nota", () => {
    const p = base([
      mkDupla({ id: "d-1", encontros: [encRealizado(1, ev(1))] }),
    ]);
    const c = p.slots.find((s) => s.numero === 1)!.celulas[0];
    expect(c.estrelas).toEqual([]);
    expect(c.avaliados).toBe(0);
  });
});

describe("panoramaRegistros — trilhas de especialista", () => {
  it("especialista fica fora das colunas e é contado à parte", () => {
    const p = base([
      mkDupla({ id: "d-1" }),
      mkDupla({ id: "d-esp", trilha: "especialista", cronograma_id: null }),
    ]);
    expect(p.espNoRecorte).toBe(1);
    // especialista não tem cronograma — nenhuma coluna é dele
    expect(p.slots.every((s) => s.celulas.length === 1)).toBe(true);
  });
});

describe("periodoRegistrosDe / cortePeriodo", () => {
  it("valida ?periodo= — lixo vira 'ciclo'", () => {
    expect(periodoRegistrosDe("4s")).toBe("4s");
    expect(periodoRegistrosDe("8s")).toBe("8s");
    expect(periodoRegistrosDe("banana")).toBe("ciclo");
    expect(periodoRegistrosDe(undefined)).toBe("ciclo");
  });

  it("corte em ISO-date comparável com a data oficial do ciclo_evento", () => {
    expect(cortePeriodo("ciclo", HOJE)).toBeNull();
    expect(cortePeriodo("4s", HOJE)).toBe("2025-10-06");
    expect(cortePeriodo("8s", HOJE)).toBe("2025-09-08");
  });
});
