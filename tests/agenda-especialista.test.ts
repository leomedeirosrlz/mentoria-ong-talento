import { describe, expect, it } from "vitest";
import { slotsLivresEspecialista } from "@/lib/demo/agenda";
import {
  gradeVisualSemana,
  sessoesDaGrade,
  type SessaoEntrada,
} from "@/lib/agenda-especialista";
import type {
  Dupla,
  Encontro,
  ExcecaoEspecialista,
  GradeJanela,
} from "@/lib/types";

// espelho da RPC especialista_slots_livres (0073): os casos cobrem grade,
// extra, bloqueio, ocupado e o filtro de passado — se o SQL mudar, este
// arquivo muda junto (é o contrato que a projeção demo promete).

// terça-feira 14/10/2025 — datas ancoradas no meio-dia local, como data.ts
const TERC = new Date("2025-10-14T12:00:00");
const DOM = new Date("2025-10-19T12:00:00");
// "agora" antes de qualquer slot dos testes — o filtro de passado fica
// exercido num caso próprio
const ANTES = Date.parse("2025-10-13T00:00:00Z");

const GRADE_TERC = [
  { dia_semana: 2, hora_inicio: "18:00", hora_fim: "21:00" },
];

describe("slotsLivresEspecialista — grade semanal", () => {
  it("sessões de 1h com início a cada 30min; o último cabe inteiro na janela", () => {
    const slots = slotsLivresEspecialista({
      grade: GRADE_TERC,
      excecoes: [],
      ocupados: [],
      desde: TERC,
      ate: TERC,
      agora: ANTES,
    });
    // 18:00 → 20:00 (o de 20:30 acabaria 21:30 > fim) — ISO em UTC (-03:00)
    expect(slots).toEqual([
      "2025-10-14T21:00:00.000Z",
      "2025-10-14T21:30:00.000Z",
      "2025-10-14T22:00:00.000Z",
      "2025-10-14T22:30:00.000Z",
      "2025-10-14T23:00:00.000Z",
    ]);
  });

  it("janela de 90min só dá dois inícios; dia fora da grade não gera nada", () => {
    const curta = slotsLivresEspecialista({
      grade: [{ dia_semana: 2, hora_inicio: "18:00:00", hora_fim: "19:30:00" }],
      excecoes: [],
      ocupados: [],
      desde: TERC,
      ate: TERC,
      agora: ANTES,
    });
    expect(curta).toHaveLength(2);
    expect(curta[0]).toBe("2025-10-14T21:00:00.000Z");
    expect(curta[1]).toBe("2025-10-14T21:30:00.000Z");
    // domingo sem grade → nada
    expect(
      slotsLivresEspecialista({
        grade: GRADE_TERC,
        excecoes: [],
        ocupados: [],
        desde: DOM,
        ate: DOM,
        agora: ANTES,
      })
    ).toEqual([]);
  });

  it("o intervalo [desde, ate] é inclusivo nas duas pontas", () => {
    const slots = slotsLivresEspecialista({
      grade: GRADE_TERC,
      excecoes: [],
      ocupados: [],
      desde: new Date("2025-10-13T12:00:00"), // segunda
      ate: TERC, // terça
      agora: ANTES,
    });
    expect(slots).toHaveLength(5); // só a terça gera
  });
});

describe("slotsLivresEspecialista — exceções datadas", () => {
  it("bloqueio remove os inícios que a sessão de 1h tocaria (overlap parcial)", () => {
    const slots = slotsLivresEspecialista({
      grade: GRADE_TERC,
      excecoes: [
        {
          data: "2025-10-14",
          hora_inicio: "19:00",
          hora_fim: "20:00",
          tipo: "bloqueio",
        },
      ],
      ocupados: [],
      desde: TERC,
      ate: TERC,
      agora: ANTES,
    });
    // saem 18:30/19:00/19:30 — a ponta 18:00 sobrevive (acaba no exato início
    // do bloqueio), a de 20:00 também (começa no exato fim)
    expect(slots).toEqual([
      "2025-10-14T21:00:00.000Z",
      "2025-10-14T23:00:00.000Z",
    ]);
  });

  it("extra abre slots fora da grade — inclusive num dia sem janela", () => {
    const slots = slotsLivresEspecialista({
      grade: GRADE_TERC,
      excecoes: [
        {
          data: "2025-10-19", // domingo
          hora_inicio: "10:00",
          hora_fim: "12:00",
          tipo: "extra",
        },
      ],
      ocupados: [],
      desde: DOM,
      ate: DOM,
      agora: ANTES,
    });
    expect(slots).toEqual([
      "2025-10-19T13:00:00.000Z",
      "2025-10-19T13:30:00.000Z",
      "2025-10-19T14:00:00.000Z",
    ]);
  });

  it("extra soma com a grade do mesmo dia; bloqueio morde a soma", () => {
    const slots = slotsLivresEspecialista({
      grade: GRADE_TERC,
      excecoes: [
        {
          data: "2025-10-14",
          hora_inicio: "21:00",
          hora_fim: "22:00",
          tipo: "extra",
        },
        {
          data: "2025-10-14",
          hora_inicio: "21:30",
          hora_fim: "22:30",
          tipo: "bloqueio",
        },
      ],
      ocupados: [],
      desde: TERC,
      ate: TERC,
      agora: ANTES,
    });
    // grade dá 18:00–20:00; extra 21–22 daria 21:00, mas o bloqueio
    // 21:30–22:30 come a sessão que começaria 21:00 (ela terminaria 22:00)
    expect(slots).toHaveLength(5);
    expect(slots).not.toContain("2025-10-15T00:00:00.000Z");
  });
});

describe("slotsLivresEspecialista — encontros ocupados e passado", () => {
  it("encontro marcado remove o overlap; encostar na ponta não remove", () => {
    const slots = slotsLivresEspecialista({
      grade: GRADE_TERC,
      excecoes: [],
      // 19:00–20:00 de SP ocupado por um encontro da trilha DPP — a agenda
      // física é uma só, qualquer trilha bloqueia
      ocupados: [
        {
          inicio: Date.parse("2025-10-14T22:00:00Z"),
          fim: Date.parse("2025-10-14T23:00:00Z"),
        },
      ],
      desde: TERC,
      ate: TERC,
      agora: ANTES,
    });
    expect(slots).toEqual([
      "2025-10-14T21:00:00.000Z", // 18:00 SP — acaba quando o encontro começa
      "2025-10-14T23:00:00.000Z", // 20:00 SP — começa quando o encontro acaba
    ]);
  });

  it("slot já passado não entra na projeção (início <= agora)", () => {
    const slots = slotsLivresEspecialista({
      grade: GRADE_TERC,
      excecoes: [],
      ocupados: [],
      desde: TERC,
      ate: TERC,
      // agora = 18:30 de SP: os inícios 18:00 e 18:30 já não servem mais
      agora: Date.parse("2025-10-14T21:30:00Z"),
    });
    expect(slots).toEqual([
      "2025-10-14T22:00:00.000Z",
      "2025-10-14T22:30:00.000Z",
      "2025-10-14T23:00:00.000Z",
    ]);
  });
});

// ---------- gradeVisualSemana — posicionamento da grade visual ----------
// Contrato da lib pura (WP4-A): semana seg→dom de hojeIso, blocos em
// minutos-do-dia clipados no eixo 8h–20h (480–1200). Instantâneos são ISO
// UTC (o PostgREST serializa timestamptz assim) e SP é -03:00 fixo —
// 19:00 SP = 22:00Z.

const mkJanela = (
  dia_semana: number,
  hora_inicio: string,
  hora_fim: string
): GradeJanela => ({
  id: `j-${dia_semana}-${hora_inicio}`,
  dia_semana,
  hora_inicio,
  hora_fim,
});

const mkExcecao = (
  data: string,
  hora_inicio: string,
  hora_fim: string,
  tipo: "bloqueio" | "extra"
): ExcecaoEspecialista => ({
  id: `x-${data}-${hora_inicio}-${tipo}`,
  data,
  hora_inicio,
  hora_fim,
  tipo,
});

const mkSessao = (
  inicioIso: string,
  over: Partial<SessaoEntrada> = {}
): SessaoEntrada => ({
  inicioIso,
  duracaoMin: 60,
  rotulo: "Ana Beatriz · sessão 4 de 5",
  trilha: "especialista",
  status: "agendado",
  ...over,
});

// quarta 15/10/2025 — a semana calendário vai de seg 13/10 a dom 19/10
const HOJE = "2025-10-15";

const gradeVazia = () =>
  gradeVisualSemana({
    hojeIso: HOJE,
    grade: [],
    excecoes: [],
    sessoes: [],
    slots: [],
  });

describe("gradeVisualSemana — semana e eixo", () => {
  it("devolve os 7 dias seg→dom da semana de hojeIso, com dow do Postgres", () => {
    const dias = gradeVazia();
    expect(dias.map((d) => d.iso)).toEqual([
      "2025-10-13", // seg
      "2025-10-14", // ter
      "2025-10-15", // qua
      "2025-10-16", // qui
      "2025-10-17", // sex
      "2025-10-18", // sáb
      "2025-10-19", // dom
    ]);
    expect(dias.map((d) => d.dow)).toEqual([1, 2, 3, 4, 5, 6, 0]);
  });

  it("ehHoje só no dia de hojeIso", () => {
    const dias = gradeVazia();
    expect(dias.filter((d) => d.ehHoje).map((d) => d.iso)).toEqual([HOJE]);
  });

  it("janela do dow posiciona no dia e clipa no fim do eixo (20h)", () => {
    const dias = gradeVisualSemana({
      hojeIso: HOJE,
      // terça 18:00–21:00 — o fim passa do eixo e clipa em 1200
      grade: [mkJanela(2, "18:00:00", "21:00:00")],
      excecoes: [],
      sessoes: [],
      slots: [],
    });
    const ter = dias[1];
    expect(ter.iso).toBe("2025-10-14");
    expect(ter.janelas).toEqual([
      {
        iniMin: 1080,
        fimMin: 1200,
        tipo: "janela",
        rotulo: "Disponível 18h–20h",
      },
    ]);
  });

  it("janela que cruza o início do eixo clipa pela esquerda (8h)", () => {
    const dias = gradeVisualSemana({
      hojeIso: HOJE,
      // sábado 07:00–09:00 — só 8h–9h aparece
      grade: [mkJanela(6, "07:00:00", "09:00:00")],
      excecoes: [],
      sessoes: [],
      slots: [],
    });
    expect(dias[5].iso).toBe("2025-10-18");
    expect(dias[5].janelas).toEqual([
      {
        iniMin: 480,
        fimMin: 540,
        tipo: "janela",
        rotulo: "Disponível 8h–9h",
      },
    ]);
  });

  it("hora quebrada aparece no rótulo (9h30) e hora cheia fica sem minutos", () => {
    const dias = gradeVisualSemana({
      hojeIso: HOJE,
      grade: [mkJanela(3, "09:30:00", "12:00:00")],
      excecoes: [],
      sessoes: [],
      slots: [],
    });
    expect(dias[2].janelas[0].rotulo).toBe("Disponível 9h30–12h");
  });

  it("janela totalmente fora do eixo é descartada", () => {
    const dias = gradeVisualSemana({
      hojeIso: HOJE,
      grade: [mkJanela(4, "21:00:00", "23:00:00")], // quinta 21–23h
      excecoes: [],
      sessoes: [],
      slots: [],
    });
    expect(dias[3].janelas).toEqual([]);
  });
});

describe("gradeVisualSemana — exceções datadas", () => {
  it("extra na data da semana vira janela tipo extra; fora da semana, ignora", () => {
    const dias = gradeVisualSemana({
      hojeIso: HOJE,
      grade: [],
      excecoes: [
        mkExcecao("2025-10-16", "10:00:00", "12:00:00", "extra"), // quinta
        mkExcecao("2025-10-22", "10:00:00", "12:00:00", "extra"), // quarta seguinte
      ],
      sessoes: [],
      slots: [],
    });
    expect(dias[3].janelas).toEqual([
      {
        iniMin: 600,
        fimMin: 720,
        tipo: "extra",
        rotulo: "Extra 10h–12h",
      },
    ]);
    expect(dias.flatMap((d) => d.janelas)).toHaveLength(1);
  });

  it("bloqueio posiciona no dia certo e não rasga a janela (a projeção já vem líquida)", () => {
    const dias = gradeVisualSemana({
      hojeIso: HOJE,
      grade: [mkJanela(2, "18:00:00", "21:00:00")],
      excecoes: [mkExcecao("2025-10-14", "19:00:00", "20:00:00", "bloqueio")],
      sessoes: [],
      slots: [],
    });
    const ter = dias[1];
    // a janela fica pintada embaixo — o hatch do bloqueio é overlay do componente
    expect(ter.janelas).toHaveLength(1);
    expect(ter.bloqueios).toEqual([{ iniMin: 1140, fimMin: 1200 }]);
  });
});

describe("gradeVisualSemana — sessões", () => {
  it("posiciona pelo dia e minutos de SP, com a duração da sessão", () => {
    const dias = gradeVisualSemana({
      hojeIso: HOJE,
      grade: [],
      excecoes: [],
      // quarta 19:00 SP = 22:00Z; +60min encosta exato no fim do eixo
      sessoes: [mkSessao("2025-10-15T22:00:00.000Z")],
      slots: [],
    });
    expect(dias[2].sessoes).toEqual([
      {
        iniMin: 1140,
        fimMin: 1200,
        tipo: "sessao",
        rotulo: "Ana Beatriz · sessão 4 de 5",
        trilha: "especialista",
        status: "agendado",
      },
    ]);
  });

  it("sessão dpp entra com trilha dpp e o status do caller passa intacto", () => {
    const dias = gradeVisualSemana({
      hojeIso: HOJE,
      grade: [],
      excecoes: [],
      sessoes: [
        mkSessao("2025-10-16T13:00:00.000Z", {
          duracaoMin: 90,
          rotulo: "Bia",
          trilha: "dpp",
          status: "realizado",
        }),
      ],
      slots: [],
    });
    // quinta 10:00 SP + 90min
    expect(dias[3].sessoes).toEqual([
      {
        iniMin: 600,
        fimMin: 690,
        tipo: "sessao",
        rotulo: "Bia",
        trilha: "dpp",
        status: "realizado",
      },
    ]);
  });

  it("sessão fora da semana é ignorada; no fim do eixo, o fim clipa", () => {
    const dias = gradeVisualSemana({
      hojeIso: HOJE,
      grade: [],
      excecoes: [],
      sessoes: [
        mkSessao("2025-10-22T22:00:00.000Z"), // quarta da semana seguinte
        mkSessao("2025-10-17T22:30:00.000Z"), // sexta 19:30 SP → clipa
      ],
      slots: [],
    });
    expect(dias.flatMap((d) => d.sessoes)).toEqual([
      {
        iniMin: 1170,
        fimMin: 1200,
        tipo: "sessao",
        rotulo: "Ana Beatriz · sessão 4 de 5",
        trilha: "especialista",
        status: "agendado",
      },
    ]);
  });
});

describe("gradeVisualSemana — faixas livres", () => {
  it("inícios contíguos a cada 30min mesclam numa faixa única, clipada no eixo", () => {
    const dias = gradeVisualSemana({
      hojeIso: HOJE,
      grade: [],
      excecoes: [],
      sessoes: [],
      // terça 19:00, 19:30 e 20:00 SP — a faixa [1140,1260] clipa em 1200
      slots: [
        "2025-10-14T22:00:00.000Z",
        "2025-10-14T22:30:00.000Z",
        "2025-10-14T23:00:00.000Z",
      ],
    });
    expect(dias[1].livres).toEqual([{ iniMin: 1140, fimMin: 1200 }]);
  });

  it("slot isolado vira faixa de 60min; dia fora da semana é ignorado", () => {
    const dias = gradeVisualSemana({
      hojeIso: HOJE,
      grade: [],
      excecoes: [],
      sessoes: [],
      slots: [
        "2025-10-16T13:00:00.000Z", // quinta 10:00 SP
        "2025-10-22T13:00:00.000Z", // semana seguinte
      ],
    });
    expect(dias[3].livres).toEqual([{ iniMin: 600, fimMin: 660 }]);
    expect(dias.flatMap((d) => d.livres)).toHaveLength(1);
  });

  it("slot no fim do eixo clipa a banda em 1200", () => {
    const dias = gradeVisualSemana({
      hojeIso: HOJE,
      grade: [],
      excecoes: [],
      sessoes: [],
      slots: ["2025-10-17T22:30:00.000Z"], // sexta 19:30 SP → [1170,1230]
    });
    expect(dias[4].livres).toEqual([{ iniMin: 1170, fimMin: 1200 }]);
  });

  it("inícios separados por buraco viram duas faixas", () => {
    const dias = gradeVisualSemana({
      hojeIso: HOJE,
      grade: [],
      excecoes: [],
      sessoes: [],
      // quinta 10:00 e 12:00 SP — sem início entre eles, não mescla
      slots: ["2025-10-16T13:00:00.000Z", "2025-10-16T15:00:00.000Z"],
    });
    expect(dias[3].livres).toEqual([
      { iniMin: 600, fimMin: 660 },
      { iniMin: 720, fimMin: 780 },
    ]);
  });
});

// ---------- sessoesDaGrade — flatten das duplas pra entrada da grade ----------

const mkDuplaMin = (over: {
  trilha?: "dpp" | "especialista";
  nomeSocial?: string | null;
  nome?: string;
  encontros?: Partial<Encontro>[];
}): Dupla =>
  ({
    id: "d-x",
    trilha: over.trilha ?? "especialista",
    mentorado: {
      nome: over.nome ?? "Ana Beatriz Costa",
      nome_social: over.nomeSocial === undefined ? "Bia" : over.nomeSocial,
    },
    encontros: (over.encontros ?? []).map((e, i) => ({
      id: `e-${i}`,
      numero: i + 1,
      status: "agendado",
      data_hora: "2025-10-16T22:00:00.000Z",
      realizado_em: null,
      duracao_min: 60,
      ...e,
    })),
  }) as Dupla;

describe("sessoesDaGrade — flatten das duplas", () => {
  it("esp rotula 'nome · sessão N' e usa nome social; dpp usa o nome seco", () => {
    const out = sessoesDaGrade([
      mkDuplaMin({ encontros: [{ numero: 4 }] }),
      mkDuplaMin({ trilha: "dpp", nomeSocial: null, nome: "Rui Tavares", encontros: [{}] }),
    ]);
    expect(out.map((s) => [s.rotulo, s.trilha])).toEqual([
      ["Bia · sessão 4", "especialista"],
      ["Rui", "dpp"],
    ]);
  });

  it("só agendado/remarcado/realizado ocupam agenda — cancelado e nao_aconteceu não", () => {
    const out = sessoesDaGrade([
      mkDuplaMin({
        encontros: [
          { status: "agendado" },
          { status: "remarcado" },
          { status: "realizado" },
          { status: "cancelado" },
          { status: "nao_aconteceu" },
        ],
      }),
    ]);
    expect(out.map((s) => s.status)).toEqual([
      "agendado",
      "remarcado",
      "realizado",
    ]);
  });

  it("realizado posiciona por realizado_em (não data_hora); sem data_hora não entra", () => {
    const out = sessoesDaGrade([
      mkDuplaMin({
        encontros: [
          {
            status: "realizado",
            data_hora: "2025-10-16T22:00:00.000Z",
            realizado_em: "2025-10-15T21:30:00.000Z",
          },
          { status: "agendado", data_hora: null },
        ],
      }),
    ]);
    expect(out).toHaveLength(1);
    expect(out[0].inicioIso).toBe("2025-10-15T21:30:00.000Z");
  });

  it("duracao_min ausente cai no default de 60min", () => {
    const out = sessoesDaGrade([
      mkDuplaMin({ encontros: [{ duracao_min: null as unknown as number }] }),
    ]);
    expect(out[0].duracaoMin).toBe(60);
  });
});

// ---------- gradeVisualSemana — boundaries ----------

describe("gradeVisualSemana — boundaries do eixo e da semana", () => {
  it("inícios a exatos 60min de distância ainda fundem (ini <= fimMin)", () => {
    const dias = gradeVisualSemana({
      hojeIso: HOJE,
      grade: [],
      excecoes: [],
      sessoes: [],
      // quinta 10:00 e 11:00 SP — o 2º início encosta no fim da 1ª faixa;
      // a união das sessões de 60min é [600,720]
      slots: ["2025-10-16T13:00:00.000Z", "2025-10-16T14:00:00.000Z"],
    });
    expect(dias[3].livres).toEqual([{ iniMin: 600, fimMin: 720 }]);
  });

  it("slot começando no minuto 1200 (20h) é descartado — fora do eixo", () => {
    const dias = gradeVisualSemana({
      hojeIso: HOJE,
      grade: [],
      excecoes: [],
      sessoes: [],
      slots: ["2025-10-16T23:00:00.000Z"], // quinta 20:00 SP
    });
    expect(dias[3].livres).toEqual([]);
  });

  it("sessão cruzando o início do eixo clipa pela esquerda", () => {
    const dias = gradeVisualSemana({
      hojeIso: HOJE,
      grade: [],
      excecoes: [],
      // sáb 07:30 SP + 60min → [450,510] clipa pra [480,510]
      sessoes: [mkSessao("2025-10-18T10:30:00.000Z")],
      slots: [],
    });
    expect(dias[5].sessoes).toEqual([
      {
        iniMin: 480,
        fimMin: 510,
        tipo: "sessao",
        rotulo: "Ana Beatriz · sessão 4 de 5",
        trilha: "especialista",
        status: "agendado",
      },
    ]);
  });

  it("janela em dow=0 (domingo) posiciona no último dia da semana", () => {
    const dias = gradeVisualSemana({
      hojeIso: HOJE,
      grade: [mkJanela(0, "09:00:00", "12:00:00")],
      excecoes: [],
      sessoes: [],
      slots: [],
    });
    expect(dias[6].iso).toBe("2025-10-19");
    expect(dias[6].dow).toBe(0);
    expect(dias[6].janelas).toHaveLength(1);
  });

  it("hojeIso inválido devolve grade vazia em vez de estourar", () => {
    expect(
      gradeVisualSemana({
        hojeIso: "não-é-data",
        grade: [mkJanela(2, "18:00:00", "21:00:00")],
        excecoes: [],
        sessoes: [],
        slots: [],
      })
    ).toEqual([]);
  });

  it("semana de hojeIso=domingo cobre a semana que ACABA nele (não a seguinte)", () => {
    const dias = gradeVisualSemana({
      hojeIso: "2025-10-19", // domingo
      grade: [],
      excecoes: [],
      sessoes: [],
      slots: [],
    });
    expect(dias[0].iso).toBe("2025-10-13");
    expect(dias[6].iso).toBe("2025-10-19");
    expect(dias[6].ehHoje).toBe(true);
  });
});
