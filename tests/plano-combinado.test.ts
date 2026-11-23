import { describe, expect, it } from "vitest";
import { datasDoPasso, sugestaoPasso } from "../src/lib/plano-combinado";
import {
  perfilDeEncontros,
  type EncontroHistorico,
} from "../src/lib/sugestoes-encontro";

// REALIZA-482 — a sugestão pré-preenchida de cada passo do combinado:
// data do passo clampada na janela, horário do histórico com 19:00 de
// padrão, min/max alimentando o input do "Outra data".
const HOJE = "2026-11-21"; // sábado
const AGORA = new Date("2026-11-21T12:00:00-03:00");
const JANELA = { inicio: "2026-11-21", fim: "2026-12-19" };

const enc = (iso: string): EncontroHistorico => ({
  data_hora: iso,
  status: "realizado",
});

// a Bia da demo: realizados sempre terça 19:00
const PERFIL_TERCAS = perfilDeEncontros(
  [
    enc("2026-11-17T22:00:00Z"),
    enc("2026-11-10T22:00:00Z"),
    enc("2026-11-03T22:00:00Z"),
  ],
  AGORA
);

describe("sugestaoPasso", () => {
  it("data do passo + horário do histórico, min/max da janela", () => {
    const s = sugestaoPasso({
      dataPasso: "2026-12-01",
      hoje: HOJE,
      janela: JANELA,
      perfil: PERFIL_TERCAS,
    });
    expect(s).toMatchObject({
      data: "2026-12-01",
      hora: "19:00",
      min: "2026-11-21",
      max: "2026-12-19",
    });
  });

  it("sem histórico cai no 19:00 de padrão", () => {
    const s = sugestaoPasso({
      dataPasso: "2026-12-01",
      hoje: HOJE,
      janela: JANELA,
    });
    expect(s).toMatchObject({ data: "2026-12-01", hora: "19:00" });
  });

  it("min é hoje quando a janela já abriu; início quando ela abre depois", () => {
    const dentro = sugestaoPasso({
      dataPasso: "2026-12-01",
      hoje: HOJE,
      janela: { inicio: "2026-11-10", fim: "2026-12-19" },
    });
    expect(dentro?.min).toBe("2026-11-21");
    const futura = sugestaoPasso({
      dataPasso: "2026-12-05",
      hoje: HOJE,
      janela: { inicio: "2026-12-01", fim: "2026-12-19" },
    });
    expect(futura?.min).toBe("2026-12-01");
  });

  it("clampa a data do passo nas pontas da janela", () => {
    const antes = sugestaoPasso({
      dataPasso: "2026-11-15",
      hoje: HOJE,
      janela: { inicio: "2026-11-25", fim: "2026-12-19" },
    });
    expect(antes?.data).toBe("2026-11-25");
    const depois = sugestaoPasso({
      dataPasso: "2026-12-30",
      hoje: HOJE,
      janela: JANELA,
    });
    expect(depois?.data).toBe("2026-12-19");
  });

  it("janela fechada não promete gesto que o banco recusaria", () => {
    const s = sugestaoPasso({
      dataPasso: "2026-11-20",
      hoje: HOJE,
      janela: { inicio: "2026-11-01", fim: "2026-11-15" },
    });
    expect(s).toBeNull();
  });

  it("data torta cai no min; horário em choque pula pro livre", () => {
    const s = sugestaoPasso({
      dataPasso: "lixo",
      hoje: HOJE,
      janela: JANELA,
      perfil: PERFIL_TERCAS,
      ocupados: ["2026-11-21T22:00:00.000Z"], // sáb 19:00 SP ocupado
    });
    expect(s?.data).toBe("2026-11-21");
    expect(s?.hora).not.toBe("19:00");
  });

  // 507 — dois passos clampados no mesmo dia não podem sair com o mesmo
  // instante: sem horário livre o dia anda até achar um
  it("dia sem horário livre anda pro seguinte com vaga", () => {
    const ocupados = ["19:00", "19:30", "20:00"].map(
      (h) => `2026-12-01T${h}:00-03:00`
    );
    const s = sugestaoPasso({
      dataPasso: "2026-12-01",
      hoje: HOJE,
      janela: JANELA,
      ocupados,
    });
    expect(s?.data).toBe("2026-12-02");
    expect(s?.hora).toBe("19:00");
  });

  it("janela inteira ocupada devolve null — não promete instante que choca", () => {
    const ocupados: string[] = [];
    // cobre os dois pools de candidatos (semana 19-20h, fds 09-11h) —
    // cada um num intervalo de 60 min pra frente do início
    const horas = ["09:00", "10:00", "11:00", "19:00", "19:30", "20:00"];
    for (let d = 1; d <= 19; d++) {
      const dia = `2026-12-${String(d).padStart(2, "0")}`;
      for (const h of horas) ocupados.push(`${dia}T${h}:00-03:00`);
    }
    const s = sugestaoPasso({
      dataPasso: "2026-12-01",
      hoje: HOJE,
      janela: JANELA,
      ocupados,
    });
    expect(s).toBeNull();
  });
});

describe("datasDoPasso", () => {
  it("a data do passo vem primeiro, marcada como passo_do_plano", () => {
    const ds = datasDoPasso({
      dataPasso: "2026-12-01",
      hoje: HOJE,
      janela: JANELA,
      ritmo: 2,
      perfil: PERFIL_TERCAS,
    });
    expect(ds.length).toBeGreaterThan(0);
    expect(ds[0]).toMatchObject({
      data: "2026-12-01",
      origem: "passo_do_plano",
    });
    expect(ds.length).toBeLessThanOrEqual(5);
    // tudo dentro da janela
    for (const d of ds) {
      expect(d.data >= JANELA.inicio && d.data <= JANELA.fim).toBe(true);
    }
  });
});
