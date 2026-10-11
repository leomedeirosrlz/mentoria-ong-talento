import { describe, expect, it } from "vitest";
import { slotsLivresEspecialista } from "@/lib/demo/agenda";

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
