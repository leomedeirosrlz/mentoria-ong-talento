import { describe, expect, it } from "vitest";
import {
  alvoAgendamento,
  encontroDoPassoEsp,
  encontroEsperado,
  eventoDaSemana,
  inicioDefaultDupla,
  jornadaDaDupla,
  maxEncontros,
  passoEsp,
  passosDaTrilha,
  resumoSemana,
  textoResumoSemana,
  totalEncontros,
} from "@/lib/ciclo";
import type { CicloEvento } from "@/lib/types";
import {
  CICLO_16,
  dt,
  dth,
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
        [{ id: "f", cronograma_id: "c1", tipo: "formacao", numero: null, data: "2025-10-14", data_fim: null, status: "pendente", observacao: null, ordem: 1, titulo: "F", fase: null, instrumentos: [] }],
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
        encRealizado(e.numero!, e.data!)
      ),
    });
    const a = alvoAgendamento(dupla, CICLO_16, dt("2026-02-01"));
    expect(a.cicloCompleto).toBe(true);
    expect(a.proximoNumero).toBe(16);
    expect(a.encontroAlvo?.status).toBe("realizado");
  });

  it("especialista: numero é tentativa — o alvo fala em passo, sem data sugerida", () => {
    const dupla = mkDupla({
      trilha: "especialista",
      encontros: [encRealizado(1, "2025-10-07"), encAgendado(3, "2025-10-20")],
    });
    const a = alvoAgendamento(dupla, CICLO_16, dt("2025-10-15"));
    // 1 realizado → a tentativa 3 agendada cobre o passo 2; a row editável é ela
    expect(a.proximoNumero).toBe(2);
    expect(a.encontroAlvo?.numero).toBe(3);
    expect(a.sugeridoProximo).toBeUndefined();
    // passos 3–5 seguem abertos ao retroativo; o 2 já tem tentativa mirando
    expect(a.faltantes).toEqual([
      { numero: 3, dataSugerida: null },
      { numero: 4, dataSugerida: null },
      { numero: 5, dataSugerida: null },
    ]);
  });
});

describe("especialista — numero = tentativa, passo = rank (0074)", () => {
  const encNaoAconteceu = (numero: number, dia: string) =>
    mkEncontro(numero, {
      status: "nao_aconteceu",
      data_hora: dth(dia).toISOString(),
    });
  const encCancelado = (numero: number, dia: string) =>
    mkEncontro(numero, {
      status: "cancelado",
      data_hora: dth(dia).toISOString(),
    });

  it("passoEsp conta só realizados anteriores — falha não queima passo", () => {
    const encontros = [
      encRealizado(1, "2025-10-07"),
      encNaoAconteceu(2, "2025-10-10"),
      encRealizado(3, "2025-10-14"),
      encAgendado(4, "2025-10-20"),
    ];
    // tentativa 3 cobriu o passo 2 porque a 2 não aconteceu
    expect(passoEsp(encontros[0], encontros)).toBe(1);
    expect(passoEsp(encontros[1], encontros)).toBe(2); // mirava o 2
    expect(passoEsp(encontros[2], encontros)).toBe(2); // cobriu o 2
    expect(passoEsp(encontros[3], encontros)).toBe(3); // próximo passo
  });

  it("passoEsp clampa no teto da trilha", () => {
    const encontros = Array.from({ length: 6 }, (_, i) =>
      encRealizado(i + 1, `2025-10-${String(i + 7).padStart(2, "0")}`)
    );
    expect(passoEsp(encontros[5], encontros)).toBe(5);
  });

  it("encontroDoPassoEsp prefere o realizado; sem ele, a última tentativa", () => {
    const encontros = [
      encRealizado(1, "2025-10-07"),
      encNaoAconteceu(2, "2025-10-10"),
      encRealizado(3, "2025-10-14"),
      encAgendado(4, "2025-10-20"),
    ];
    // passo 2 teve duas tentativas — o nó mostra a que rolou (a 3)
    expect(encontroDoPassoEsp(encontros, 1)?.numero).toBe(1);
    expect(encontroDoPassoEsp(encontros, 2)?.numero).toBe(3);
    expect(encontroDoPassoEsp(encontros, 3)?.numero).toBe(4);
    expect(encontroDoPassoEsp(encontros, 4)).toBeNull();

    // sem realizado no passo, a tentativa mais recente representa — o nó
    // conta a última cartada, não o rastro de falhas
    const falhando = [
      encRealizado(1, "2025-10-07"),
      encNaoAconteceu(2, "2025-10-10"),
      encNaoAconteceu(3, "2025-10-12"),
    ];
    expect(encontroDoPassoEsp(falhando, 2)?.numero).toBe(3);
  });

  it("nao_aconteceu não avança o guia: a 3ª tentativa ainda mira o passo 2", () => {
    const dupla = mkDupla({
      trilha: "especialista",
      encontros: [
        encRealizado(1, "2025-10-07"),
        encNaoAconteceu(2, "2025-10-10"),
        encCancelado(3, "2025-10-11"),
      ],
    });
    const a = alvoAgendamento(dupla, [], dt("2025-10-15"));
    // só 1 realizado → próximo passo é o 2; a row alvo é a tentativa mais
    // recente mirando nele (a 3, cancelada — desfazer/remarcar edita ela)
    expect(a.proximoNumero).toBe(2);
    expect(a.encontroAlvo?.numero).toBe(3);
    expect(a.cicloCompleto).toBe(false);
    expect(a.faltantes.map((f) => f.numero)).toEqual([2, 3, 4, 5]);
  });

  it("jornada multi-tentativa: a falha aparece no passo até a reposição rolar", () => {
    const passos = passosDaTrilha("especialista", [], ESP_5);
    const tentou = mkDupla({
      trilha: "especialista",
      encontros: [
        encRealizado(1, "2025-10-07"),
        encNaoAconteceu(2, "2025-10-10"),
      ],
    });
    let j = jornadaDaDupla(tentou, passos, dt("2025-10-15"));
    expect(j.feitos).toBe(1);
    expect(j.nos[1].estado).toBe("nao_aconteceu");
    expect(j.nos[1].encontro?.numero).toBe(2);
    expect(j.proximoNumero).toBe(2);

    // a tentativa 3 aconteceu — cobre o passo 2 e a trilha anda
    const reposta = mkDupla({
      trilha: "especialista",
      encontros: [
        encRealizado(1, "2025-10-07"),
        encNaoAconteceu(2, "2025-10-10"),
        encRealizado(3, "2025-10-14"),
      ],
    });
    j = jornadaDaDupla(reposta, passos, dt("2025-10-15"));
    expect(j.feitos).toBe(2);
    expect(j.nos[1].encontro?.numero).toBe(3);
    expect(j.nos[1].estado).toBe("realizado_completo");
    expect(j.proximoNumero).toBe(3);
  });

  it("cicloCompleto conta realizados, não tentativas — 5 tentativas com falha não fecham", () => {
    const dupla = mkDupla({
      trilha: "especialista",
      encontros: [
        encRealizado(1, "2025-10-07"),
        encNaoAconteceu(2, "2025-10-09"),
        encRealizado(3, "2025-10-14"),
        encRealizado(4, "2025-10-21"),
        encRealizado(5, "2025-10-28"),
      ],
    });
    const a = alvoAgendamento(dupla, [], dt("2025-11-01"));
    expect(a.cicloCompleto).toBe(false); // 4 realizados de 5 passos
    expect(a.proximoNumero).toBe(5);
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
