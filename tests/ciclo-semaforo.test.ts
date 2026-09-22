import { describe, expect, it } from "vitest";
import { saudadeDaDupla } from "@/lib/ciclo";
import type { CicloEvento } from "@/lib/types";
import {
  CICLO_16,
  dt,
  encAgendado,
  encRealizado,
  mkDupla,
  mkEncaminhamento,
  mkEncontro,
  mkRegistro,
} from "./helpers";

// Terças do ciclo de referência: enc 1 = 07/10, enc 2 = 14/10, enc 3 = 21/10,
// enc 4 = 28/10 … "hoje" sempre injetado — a suíte não depende do relógio.

describe("saudadeDaDupla — congelamento por status", () => {
  const hoje = dt("2025-10-28"); // terça do encontro 4: 4 esperados, 0 feitos

  it("dupla pausada fica ok mesmo com encontros em atraso", () => {
    const s = saudadeDaDupla(mkDupla({ status: "pausada" }), CICLO_16, hoje);
    expect(s.semaforo).toBe("ok");
    expect(s.motivo).toBe("Dupla pausada");
    expect(s.esperado).toBe(4);
    expect(s.feitos).toBe(0);
  });

  it("dupla concluída fica ok — 'Jornada concluída'", () => {
    const s = saudadeDaDupla(mkDupla({ status: "concluida" }), CICLO_16, hoje);
    expect(s.motivo).toBe("Jornada concluída");
  });

  it("dupla encerrada fica ok — 'Dupla encerrada'", () => {
    const s = saudadeDaDupla(mkDupla({ status: "encerrada" }), CICLO_16, hoje);
    expect(s.motivo).toBe("Dupla encerrada");
  });
});

describe("saudadeDaDupla — risco", () => {
  it("pedido de apoio marca risco mesmo com a agenda em dia", () => {
    const dupla = mkDupla({
      encontros: [
        encRealizado(1, "2025-10-07", mkRegistro({ precisa_apoio: true })),
        encAgendado(2, "2025-10-21"),
      ],
    });
    const s = saudadeDaDupla(dupla, CICLO_16, dt("2025-10-15"));
    expect(s.semaforo).toBe("risco");
    expect(s.motivo).toBe("Pedido de apoio");
    expect(s.pediuApoio).toBe(true);
  });

  it("pedido de apoio fura o congelamento da dupla pausada", () => {
    const dupla = mkDupla({
      status: "pausada",
      encontros: [
        encRealizado(1, "2025-10-07", mkRegistro({ precisa_apoio: true })),
      ],
    });
    const s = saudadeDaDupla(dupla, CICLO_16, dt("2025-10-15"));
    expect(s.semaforo).toBe("risco");
    expect(s.motivo).toBe("Pedido de apoio");
    expect(s.pediuApoio).toBe(true);
  });

  it("pedido de apoio NÃO fura o fechamento — encerrada segue ok", () => {
    const dupla = mkDupla({
      status: "encerrada",
      encontros: [
        encRealizado(1, "2025-10-07", mkRegistro({ precisa_apoio: true })),
      ],
    });
    const s = saudadeDaDupla(dupla, CICLO_16, dt("2025-10-15"));
    expect(s.semaforo).toBe("ok");
    expect(s.motivo).toBe("Dupla encerrada");
    expect(s.pediuApoio).toBe(false);
  });

  it("≥2 encontros em atraso é risco, com o plural no motivo", () => {
    const s = saudadeDaDupla(mkDupla(), CICLO_16, dt("2025-10-14"));
    expect(s.semaforo).toBe("risco");
    expect(s.motivo).toBe("2 encontros em atraso");
    expect(s.esperado).toBe(2);
    expect(s.feitos).toBe(0);
  });

  it("atraso conta só a janela da dupla (iniciada_em poda o começo do ciclo)", () => {
    // hoje = 28/10: esperados dentro da janela são só os encontros 3 e 4
    const s = saudadeDaDupla(
      mkDupla({ iniciada_em: "2025-10-21" }),
      CICLO_16,
      dt("2025-10-28")
    );
    expect(s.semaforo).toBe("risco");
    expect(s.motivo).toBe("2 encontros em atraso");
    expect(s.esperado).toBe(2);
  });

  it("avaliação baixa + dificuldade no último registro é risco (antes do atraso)", () => {
    const dupla = mkDupla({
      encontros: [
        encRealizado(
          1,
          "2025-10-07",
          mkRegistro({ avaliacao: "baixa", dificuldade: "aprendizagem" })
        ),
      ],
    });
    // 14/10: atraso seria só 1 — o combo avaliação+dificuldade já é risco
    const s = saudadeDaDupla(dupla, CICLO_16, dt("2025-10-14"));
    expect(s.semaforo).toBe("risco");
    expect(s.motivo).toBe(
      "Avaliação baixa e dificuldade de aprendizagem no último encontro"
    );
  });
});

describe("saudadeDaDupla — atenção", () => {
  it("1 encontro em atraso é atenção e aponta o número que faltou", () => {
    const dupla = mkDupla({ encontros: [encRealizado(1, "2025-10-07")] });
    const s = saudadeDaDupla(dupla, CICLO_16, dt("2025-10-14"));
    expect(s.semaforo).toBe("atencao");
    expect(s.motivo).toBe(
      "Encontro 2 ainda não aconteceu (reposição na mesma semana)"
    );
  });

  it("reposição fora de ordem aponta o primeiro número faltante, não o último", () => {
    // fez o 2º mas não o 1º — o motivo é o 1º
    const dupla = mkDupla({ encontros: [encRealizado(2, "2025-10-14")] });
    const s = saudadeDaDupla(dupla, CICLO_16, dt("2025-10-14"));
    expect(s.semaforo).toBe("atencao");
    expect(s.motivo).toBe(
      "Encontro 1 ainda não aconteceu (reposição na mesma semana)"
    );
  });

  it("avaliação baixa (sem dificuldade) é atenção", () => {
    const dupla = mkDupla({
      encontros: [
        encRealizado(
          1,
          "2025-10-07",
          mkRegistro({ avaliacao: "baixa", dificuldade: "nenhuma" })
        ),
      ],
    });
    const s = saudadeDaDupla(dupla, CICLO_16, dt("2025-10-08"));
    expect(s.semaforo).toBe("atencao");
    expect(s.motivo).toBe("Avaliação baixa no último encontro");
  });

  it("dificuldade identificada (avaliação boa) é atenção com o label pt-BR", () => {
    const dupla = mkDupla({
      encontros: [
        encRealizado(
          1,
          "2025-10-07",
          mkRegistro({ avaliacao: "boa", dificuldade: "organizacao" })
        ),
      ],
    });
    const s = saudadeDaDupla(dupla, CICLO_16, dt("2025-10-08"));
    expect(s.semaforo).toBe("atencao");
    expect(s.motivo).toBe(
      "Dificuldade de organização/rotina identificada"
    );
  });

  it("só o ÚLTIMO registro pesa: baixa antiga coberta por uma boa não marca", () => {
    const dupla = mkDupla({
      encontros: [
        encRealizado(
          1,
          "2025-10-07",
          mkRegistro({ avaliacao: "baixa", dificuldade: "nenhuma" })
        ),
        encRealizado(
          2,
          "2025-10-14",
          mkRegistro({ avaliacao: "excelente", dificuldade: "nenhuma" })
        ),
      ],
    });
    const s = saudadeDaDupla(dupla, CICLO_16, dt("2025-10-15"));
    expect(s.semaforo).toBe("ok");
  });
});

describe("saudadeDaDupla — pendência de registro (limbo e >24h)", () => {
  it("agendado que já passou sem registro é limbo: vira pendência, não atraso", () => {
    const dupla = mkDupla({
      encontros: [encAgendado(1, "2025-10-07")], // ontem, sem registro
    });
    const s = saudadeDaDupla(dupla, CICLO_16, dt("2025-10-08"));
    expect(s.semaforo).toBe("atencao");
    expect(s.motivo).toBe("1º encontro agendado já passou — falta o registro");
    // o limbo cobre o evento esperado do seu número: esperado sai de 1 pra 0
    expect(s.esperado).toBe(0);
    expect(s.registroPendente).toBe(true);
  });

  it("realizado há mais de 24h sem registro é pendência", () => {
    const dupla = mkDupla({
      encontros: [encRealizado(1, "2025-10-07", null)],
    });
    const s = saudadeDaDupla(dupla, CICLO_16, dt("2025-10-09"));
    expect(s.semaforo).toBe("atencao");
    expect(s.motivo).toBe("Encontro realizado sem registro");
    expect(s.registroPendente).toBe(true);
  });

  it("realizado há menos de 24h sem registro ainda não é pendência", () => {
    const dupla = mkDupla({
      encontros: [encRealizado(1, "2025-10-07", null)],
    });
    // 17h depois do encontro
    const s = saudadeDaDupla(dupla, CICLO_16, dt("2025-10-08"));
    expect(s.semaforo).toBe("ok");
    expect(s.registroPendente).toBe(false);
  });

  it("a pendência que vira motivo é a de menor número", () => {
    const dupla = mkDupla({
      encontros: [
        encAgendado(2, "2025-10-14"),
        encAgendado(1, "2025-10-07"),
      ],
    });
    const s = saudadeDaDupla(dupla, CICLO_16, dt("2025-10-16"));
    expect(s.semaforo).toBe("atencao");
    expect(s.motivo).toBe("1º encontro agendado já passou — falta o registro");
  });

  it("agendado passado COM registro não é limbo nem pendência", () => {
    const dupla = mkDupla({
      encontros: [
        mkEncontro(1, {
          status: "agendado",
          data_hora: "2025-10-07T19:00:00-03:00",
          registro: mkRegistro(),
        }),
      ],
    });
    const s = saudadeDaDupla(dupla, CICLO_16, dt("2025-10-08"));
    // sem limbo: o encontro 1 conta como esperado e não feito → 1 atraso
    expect(s.semaforo).toBe("atencao");
    expect(s.motivo).toBe(
      "Encontro 1 ainda não aconteceu (reposição na mesma semana)"
    );
  });
});

describe("saudadeDaDupla — preventivo (oficial da semana sem agenda)", () => {
  // semana de 13–19/10 contém o encontro 2 (14/10)
  it("oficial a ≤5 dias sem nada marcado é atenção", () => {
    const dupla = mkDupla({ encontros: [encRealizado(1, "2025-10-07")] });
    const s = saudadeDaDupla(dupla, CICLO_16, dt("2025-10-13"));
    expect(s.semaforo).toBe("atencao");
    expect(s.motivo).toBe(
      "O 2º encontro é terça-feira (14/10) e ainda não foi agendado"
    );
  });

  it("qualquer row do número oficial já cobre o encontro — sem preventivo", () => {
    const dupla = mkDupla({
      encontros: [
        encRealizado(1, "2025-10-07"),
        mkEncontro(2, { status: "nao_aconteceu" }),
      ],
    });
    const s = saudadeDaDupla(dupla, CICLO_16, dt("2025-10-13"));
    expect(s.semaforo).toBe("ok");
    expect(s.motivo).toBe("Em dia");
  });

  it("próximo encontro agendado (outro número) também desliga o preventivo", () => {
    const dupla = mkDupla({
      encontros: [
        encRealizado(1, "2025-10-07"),
        encAgendado(3, "2025-10-21"),
      ],
    });
    const s = saudadeDaDupla(dupla, CICLO_16, dt("2025-10-13"));
    expect(s.semaforo).toBe("ok");
    expect(s.motivo).toContain("Próximo encontro");
    expect(s.proximo?.numero).toBe(3);
  });

  it("oficial a mais de 5 dias não dispara — e a 5 exatos dispara", () => {
    // calendário com semana de gap: encontros em 07/10 e 28/10
    const eventos: CicloEvento[] = [
      { id: "a", tipo: "encontro", numero: 1, data: "2025-10-07", data_fim: null, titulo: "E1", fase: null, instrumentos: [] },
      { id: "b", tipo: "encontro", numero: 2, data: "2025-10-28", data_fim: null, titulo: "E2", fase: null, instrumentos: [] },
    ];
    const dupla = mkDupla({ encontros: [encRealizado(1, "2025-10-07")] });
    // qua 15/10: semana sem encontro; oficial é 28/10, a 13 dias → ok
    expect(saudadeDaDupla(dupla, eventos, dt("2025-10-15")).motivo).toBe("Em dia");
    // qui 23/10: oficial a 5 dias → preventivo
    const s = saudadeDaDupla(dupla, eventos, dt("2025-10-23"));
    expect(s.semaforo).toBe("atencao");
    expect(s.motivo).toBe(
      "O 2º encontro é terça-feira (28/10) e ainda não foi agendado"
    );
  });
});

describe("saudadeDaDupla — combinado vencido e ok", () => {
  const duplaEmDia = () =>
    mkDupla({ encontros: [encRealizado(1, "2025-10-07")] });

  it("combinado pendente com prazo vencido é atenção", () => {
    const dupla = duplaEmDia();
    dupla.encaminhamentos = [
      mkEncaminhamento({ status: "pendente", prazo: "2025-10-07" }),
    ];
    const s = saudadeDaDupla(dupla, CICLO_16, dt("2025-10-08"));
    expect(s.semaforo).toBe("atencao");
    expect(s.motivo).toBe("Combinado com prazo vencido");
  });

  it("prazo no dia não vence (só < hoje) — e combinado feito não vence", () => {
    const dupla = duplaEmDia();
    dupla.encaminhamentos = [
      mkEncaminhamento({ status: "pendente", prazo: "2025-10-08" }),
      mkEncaminhamento({ status: "feito", prazo: "2025-10-01" }),
    ];
    const s = saudadeDaDupla(dupla, CICLO_16, dt("2025-10-08"));
    expect(s.semaforo).toBe("ok");
    expect(s.motivo).toBe("Em dia");
  });

  it("ok com próximo agendado mostra a data no motivo", () => {
    const dupla = mkDupla({
      encontros: [encRealizado(1, "2025-10-07"), encAgendado(2, "2025-10-14")],
    });
    const s = saudadeDaDupla(dupla, CICLO_16, dt("2025-10-08"));
    expect(s.semaforo).toBe("ok");
    expect(s.motivo).toBe("Próximo encontro 14 de out.");
    expect(s.proximo?.numero).toBe(2);
  });
});

describe("saudadeDaDupla — trilha de especialista (sem calendário)", () => {
  const esp = (encontros: ReturnType<typeof encAgendado>[] = []) =>
    mkDupla({ trilha: "especialista", encontros });

  it("nada vence por data: esperado = feitos, atraso sempre zero", () => {
    const s = saudadeDaDupla(esp(), CICLO_16, dt("2025-12-31"));
    expect(s.semaforo).toBe("ok");
    expect(s.esperado).toBe(0);
    expect(s.motivo).toBe("Em dia");
  });

  it("sinais próprios seguem valendo: limbo vira pendência", () => {
    const s = saudadeDaDupla(esp([encAgendado(1, "2025-10-07")]), CICLO_16, dt("2025-10-14"));
    expect(s.semaforo).toBe("atencao");
    expect(s.motivo).toBe("1º encontro agendado já passou — falta o registro");
  });

  it("avaliação baixa + dificuldade também é risco na especialista", () => {
    const dupla = mkDupla({
      trilha: "especialista",
      encontros: [
        encRealizado(1, "2025-10-07", mkRegistro({ avaliacao: "baixa", dificuldade: "outro" })),
      ],
    });
    const s = saudadeDaDupla(dupla, CICLO_16, dt("2025-10-14"));
    expect(s.semaforo).toBe("risco");
    expect(s.motivo).toBe(
      "Avaliação baixa e dificuldade de outra no último encontro"
    );
  });
});
