import { describe, expect, it } from "vitest";
import {
  alvoAgendamento,
  encontroEsperado,
  eventoDaSemana,
  inicioDefaultDupla,
  maxEncontros,
  passosDaTrilha,
  resumoSemana,
  textoResumoSemana,
  totalEncontros,
} from "@/lib/ciclo";
import type { CicloEvento } from "@/lib/types";
import {
  CICLO_16,
  dt,
  encAgendado,
  encRealizado,
  ESP_5,
  mkDupla,
  mkEncontro,
  mkEvento,
} from "./helpers";

describe("maxEncontros / totalEncontros / encontroEsperado", () => {
  it("teto por trilha: dpp 16, especialista 5, null cai em dpp", () => {
    expect(maxEncontros("dpp")).toBe(16);
    expect(maxEncontros("especialista")).toBe(5);
    expect(maxEncontros(null)).toBe(16);
    expect(maxEncontros(undefined)).toBe(16);
  });

  it("totalEncontros ignora formação/recesso do calendário", () => {
    expect(totalEncontros(CICLO_16)).toBe(16);
  });

  it("esperado conta só datas já passadas (inclui hoje) e respeita o início da dupla", () => {
    expect(encontroEsperado(CICLO_16, dt("2025-10-06"))).toBe(0);
    expect(encontroEsperado(CICLO_16, dt("2025-10-07"))).toBe(1); // dia conta
    expect(encontroEsperado(CICLO_16, dt("2025-10-28"))).toBe(4);
    expect(encontroEsperado(CICLO_16, dt("2025-10-28"), "2025-10-21")).toBe(2);
    expect(encontroEsperado(CICLO_16, dt("2026-06-01"))).toBe(16);
  });
});

describe("eventoDaSemana", () => {
  it("a semana do encontro é seg–dom: qua e dom ainda apontam pra terça", () => {
    expect(eventoDaSemana(CICLO_16, dt("2025-10-08"))?.numero).toBe(1);
    expect(eventoDaSemana(CICLO_16, dt("2025-10-12"))?.numero).toBe(1); // domingo
    expect(eventoDaSemana(CICLO_16, dt("2025-10-13"))?.numero).toBe(2); // segunda
    expect(eventoDaSemana(CICLO_16, dt("2025-10-14"))?.numero).toBe(2);
  });

  it("semana sem encontro aponta o próximo; depois do fim, o último", () => {
    const eventos: CicloEvento[] = [
      mkEvento(1, "2025-10-07"),
      mkEvento(2, "2025-10-28"),
    ];
    expect(eventoDaSemana(eventos, dt("2025-10-15"))?.numero).toBe(2);
    expect(eventoDaSemana(eventos, dt("2025-11-10"))?.numero).toBe(2);
  });

  it("sem nenhum encontro no calendário devolve null", () => {
    expect(eventoDaSemana([], dt("2025-10-15"))).toBeNull();
    expect(
      eventoDaSemana(
        [{ id: "f", cronograma_id: "c1", tipo: "formacao", numero: null, data: "2025-10-14", data_fim: null, titulo: "F", fase: null, instrumentos: [] }],
        dt("2025-10-15")
      )
    ).toBeNull();
  });
});

describe("inicioDefaultDupla", () => {
  it("uma semana antes do 1º encontro oficial — formação não conta", () => {
    expect(inicioDefaultDupla(CICLO_16)).toBe("2025-09-30");
  });

  it("sem encontro no calendário devolve null", () => {
    expect(inicioDefaultDupla([])).toBeNull();
    expect(inicioDefaultDupla([{ tipo: "formacao", data: "2025-10-01" }])).toBeNull();
  });
});

describe("passosDaTrilha", () => {
  it("dpp vem dos eventos numerados do ciclo, em ordem e com data", () => {
    const passos = passosDaTrilha("dpp", CICLO_16);
    expect(passos).toHaveLength(16);
    expect(passos[0]).toMatchObject({ numero: 1, data: "2025-10-07", fase: "Fase 1" });
    expect(passos[15].numero).toBe(16);
  });

  it("especialista vem dos passos do guia, sem data e com foco", () => {
    const passos = passosDaTrilha("especialista", CICLO_16, ESP_5);
    expect(passos.map((p) => p.numero)).toEqual([1, 2, 3, 4, 5]);
    expect(passos[0]).toMatchObject({ titulo: "Apresentação", data: null, instrumentos: [] });
    expect(passos[3].foco).toBe("plano de ação");
  });
});

describe("alvoAgendamento", () => {
  it("sem agendado futuro, alvo é o primeiro número não realizado", () => {
    const dupla = mkDupla({ encontros: [encRealizado(1, "2025-10-07")] });
    const a = alvoAgendamento(dupla, CICLO_16, dt("2025-10-15"));
    expect(a.proximoNumero).toBe(2);
    expect(a.encontroAlvo).toBeNull();
    expect(a.sugeridoProximo).toBe("2025-10-14"); // data oficial do nº 2
    // o nº 2 venceu (14/10 <= 15/10) e não tem row → é faltante retroativo
    expect(a.faltantes).toEqual([{ numero: 2, dataSugerida: "2025-10-14" }]);
    expect(a.cicloCompleto).toBe(false);
  });

  it("agendado futuro vira o alvo e a row existente é a editável", () => {
    const dupla = mkDupla({
      encontros: [encRealizado(1, "2025-10-07"), encAgendado(2, "2025-10-16")],
    });
    const a = alvoAgendamento(dupla, CICLO_16, dt("2025-10-13"));
    expect(a.proximoNumero).toBe(2);
    expect(a.encontroAlvo?.numero).toBe(2);
    expect(a.sugeridoProximo).toBe("2025-10-14");
    expect(a.faltantes).toEqual([]); // nº 2 tem row — não é faltante
  });

  it("reposição fora de ordem: fez o 4º antes do 3º — alvo é o primeiro buraco", () => {
    const dupla = mkDupla({
      encontros: [encRealizado(1, "2025-10-07"), encRealizado(4, "2025-10-28")],
    });
    const a = alvoAgendamento(dupla, CICLO_16, dt("2025-10-28"));
    expect(a.proximoNumero).toBe(2); // primeiro número ainda não realizado
    // 2 e 3 vencidos sem row são faltantes, na ordem do calendário
    expect(a.faltantes).toEqual([
      { numero: 2, dataSugerida: "2025-10-14" },
      { numero: 3, dataSugerida: "2025-10-21" },
    ]);
  });

  it("iniciada_em poda faltantes anteriores ao início da dupla", () => {
    const a = alvoAgendamento(
      mkDupla({ iniciada_em: "2025-10-21" }),
      CICLO_16,
      dt("2025-10-28")
    );
    expect(a.faltantes).toEqual([
      { numero: 3, dataSugerida: "2025-10-21" },
      { numero: 4, dataSugerida: "2025-10-28" },
    ]);
  });

  it("ciclo completo: 16 realizados → proximoNumero no teto e CTA desligado", () => {
    const dupla = mkDupla({
      encontros: CICLO_16.filter((e) => e.tipo === "encontro").map((e) =>
        encRealizado(e.numero!, e.data)
      ),
    });
    const a = alvoAgendamento(dupla, CICLO_16, dt("2026-02-01"));
    expect(a.cicloCompleto).toBe(true);
    expect(a.proximoNumero).toBe(16);
    expect(a.encontroAlvo?.status).toBe("realizado");
  });

  it("especialista: teto de 5, sem data sugerida e faltantes sem calendário", () => {
    const dupla = mkDupla({
      trilha: "especialista",
      encontros: [encRealizado(1, "2025-10-07"), encAgendado(3, "2025-10-20")],
    });
    const a = alvoAgendamento(dupla, CICLO_16, dt("2025-10-15"));
    expect(a.proximoNumero).toBe(3); // o agendado futuro
    expect(a.sugeridoProximo).toBeUndefined();
    // qualquer nº sem row pode ter rolado — 2, 4 e 5 são faltantes sem data
    expect(a.faltantes).toEqual([
      { numero: 2, dataSugerida: null },
      { numero: 4, dataSugerida: null },
      { numero: 5, dataSugerida: null },
    ]);
  });
});

describe("resumoSemana + textoResumoSemana", () => {
  // semana de 13–19/10 = semana do encontro 2 (14/10)
  const agora = dt("2025-10-15");

  function cenario() {
    return [
      // d1: fez o oficial com registro
      mkDupla({ id: "d1", encontros: [encRealizado(2, "2025-10-14")] }),
      // d2: fez o oficial, registro ainda não entregue
      mkDupla({
        id: "d2",
        encontros: [encRealizado(2, "2025-10-14", null)],
      }),
      // d3: não fez o oficial, mas se encontrou na semana (reposição)
      mkDupla({
        id: "d3",
        encontros: [
          mkEncontro(1, {
            status: "realizado",
            data_hora: "2025-10-07T19:00:00-03:00",
            realizado_em: "2025-10-15T10:00:00-03:00",
          }),
        ],
      }),
      // d4: não aconteceu
      mkDupla({ id: "d4" }),
      // d5: pausada — fora do denominador
      mkDupla({ id: "d5", status: "pausada" }),
      // d6: especialista — não segue o calendário de terças
      mkDupla({ id: "d6", trilha: "especialista" }),
    ];
  }

  it("conta realizaram/registros/reposição só entre duplas ativas DPP", () => {
    const r = resumoSemana(cenario(), CICLO_16, agora);
    expect(r).not.toBeNull();
    expect(r!.evento.numero).toBe(2);
    expect(r!.total).toBe(4);
    expect(r!.realizaram).toBe(2);
    expect(r!.comRegistro).toBe(1);
    expect(r!.aguardandoRegistro).toBe(1);
    expect(r!.naoAconteceram).toBe(2); // d3 e d4 não fizeram o oficial
    expect(r!.reposicao).toBe(1); // d3 se encontrou na semana mesmo assim
  });

  it("sem evento da semana devolve null", () => {
    expect(resumoSemana(cenario(), [], agora)).toBeNull();
  });

  it("texto sai pronto pro WhatsApp da equipe", () => {
    const r = resumoSemana(cenario(), CICLO_16, agora)!;
    const texto = textoResumoSemana(r, ["Ana & João (2 atrasos)"]);
    expect(texto).toBe(
      [
        "Semana do 2º encontro (14/10/2025) · Mentoria Social",
        "✔ 2 de 4 duplas já realizaram",
        "✎ 1 registro entregue · 1 aguardando",
        "⚠ 1 dupla sem encontro esta semana · ↺ 1 em reposição",
        "Em risco: Ana & João (2 atrasos)",
      ].join("\n")
    );
  });
});
