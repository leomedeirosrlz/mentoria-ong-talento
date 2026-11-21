import { describe, expect, it } from "vitest";
import { diaSemanaDe, diffDias } from "../src/lib/ciclo";
import {
  gapDiasParaRitmo,
  partesSP,
  perfilDeEncontros,
  rotuloOrigem,
  sugerirDatas,
  sugerirHorarios,
  type EncontroHistorico,
} from "../src/lib/sugestoes-encontro";

// Âncora fixa: sábado 21/11/2026 meio-dia em SP — o vitest já roda com
// TZ=America/Sao_Paulo, mas o motor não depende disso: toda derivação é
// via partesSP (Intl + timeZone) ou âncora de meio-dia UTC.
const AGORA = new Date("2026-11-21T12:00:00-03:00");
const HOJE = "2026-11-21"; // sábado

const enc = (
  iso: string,
  extra: Partial<EncontroHistorico> = {}
): EncontroHistorico => ({
  data_hora: iso,
  status: "realizado",
  ...extra,
});

const VAZIO = perfilDeEncontros([], AGORA);

describe("perfilDeEncontros", () => {
  it("destila dia e hora dos realizados recentes, ignorando o resto", () => {
    const perfil = perfilDeEncontros(
      [
        enc("2026-11-14T13:00:00Z"), // sáb 10:00 SP
        enc("2026-11-07T13:00:00Z"),
        enc("2026-10-31T13:00:00Z"),
        enc("2026-10-24T13:00:00Z"),
        enc("2026-11-10T22:00:00Z", { status: "cancelado" }), // fora
        enc("2026-12-05T13:00:00Z"), // futuro: fora
        enc("2026-01-10T13:00:00Z"), // >6 meses: fora
      ],
      AGORA
    );
    expect(perfil.total).toBe(4);
    expect(perfil.porDia.sab).toBeGreaterThan(0);
    for (const d of ["seg", "ter", "qua", "qui", "sex", "dom"] as const)
      expect(perfil.porDia[d]).toBe(0);
    expect(perfil.porHora[0]).toMatchObject({ hora: "10:00" });
    expect(perfil.ultimo).toBe("2026-11-14T13:00:00Z");
  });

  it("prefere realizado_em a data_hora e mediana as durações", () => {
    const perfil = perfilDeEncontros(
      [
        enc("2026-11-10T13:00:00Z", {
          realizado_em: "2026-11-14T13:00:00Z", // sáb 10:00
          duracao_min: 40,
        }),
        enc("2026-11-07T13:00:00Z", { duracao_min: 60 }),
        enc("2026-10-31T13:00:00Z", { duracao_min: 50 }),
      ],
      AGORA
    );
    expect(perfil.porHora[0].hora).toBe("10:00");
    expect(perfil.porDia.seg).toBe(0); // o de terça virou sábado pelo realizado_em
    expect(perfil.duracaoMedianaMin).toBe(50);
  });
});

describe("sugerirDatas", () => {
  const perfilSab = () =>
    perfilDeEncontros(
      [
        enc("2026-11-14T13:00:00Z"),
        enc("2026-11-07T13:00:00Z"),
        enc("2026-10-31T13:00:00Z"),
      ],
      AGORA
    );

  it("histórico de sábados ⇒ primeira data é o próximo sábado", () => {
    const [s] = sugerirDatas({ agora: AGORA, perfil: perfilSab() });
    expect(s.data).toBe("2026-11-28");
    expect(diaSemanaDe(s.data)).toBe("sab");
    expect(s.origem).toBe("historico");
  });

  it("sem histórico ⇒ próximos dias úteis (seg–sáb), origem padrao", () => {
    const out = sugerirDatas({ agora: AGORA, perfil: VAZIO });
    expect(out).toHaveLength(5);
    expect(out.every((s) => s.origem === "padrao")).toBe(true);
    expect(out.every((s) => diaSemanaDe(s.data) !== "dom")).toBe(true);
    expect(out[0].data).toBe("2026-11-23"); // 22 é domingo — salta pra seg
  });

  it("respeita a janela do plano e prioriza a data do passo", () => {
    const janela = { inicio: HOJE, fim: "2026-12-19" };
    const out = sugerirDatas({
      agora: AGORA,
      perfil: perfilSab(),
      janela,
      dataSugerida: "2026-12-05",
    });
    expect(out[0]).toMatchObject({
      data: "2026-12-05",
      origem: "passo_do_plano",
    });
    for (const s of out) {
      expect(s.data >= janela.inicio).toBe(true);
      expect(s.data <= janela.fim).toBe(true);
      expect(s.data > HOJE).toBe(true); // sugestões: amanhã em diante
    }
  });

  it("passo fora da janela não vira sugestão", () => {
    const out = sugerirDatas({
      agora: AGORA,
      perfil: perfilSab(),
      janela: { inicio: HOJE, fim: "2026-12-19" },
      dataSugerida: "2027-01-10",
    });
    expect(out.every((s) => s.origem !== "passo_do_plano")).toBe(true);
  });

  it("ritmo 2 ⇒ gap mínimo de 3 dias entre as escolhidas", () => {
    const perfil = perfilDeEncontros(
      [
        enc("2026-11-16T22:00:00Z"), // seg 19:00
        enc("2026-11-09T22:00:00Z"),
        enc("2026-11-14T13:00:00Z"), // sab 10:00 (menos peso)
      ],
      AGORA
    );
    const out = sugerirDatas({ agora: AGORA, perfil, ritmo: 2 });
    expect(out.length).toBeGreaterThanOrEqual(3);
    for (let i = 0; i < out.length; i++)
      for (let j = i + 1; j < out.length; j++)
        expect(
          Math.abs(diffDias(out[i].data, out[j].data))
        ).toBeGreaterThanOrEqual(3);
    expect(gapDiasParaRitmo(2)).toBe(3);
    expect(gapDiasParaRitmo(1)).toBe(7);
  });
});

describe("sugerirHorarios", () => {
  it("top do perfil sem grade ⇒ hábito com origem historico", () => {
    const perfil = perfilDeEncontros(
      [enc("2026-11-14T13:00:00Z"), enc("2026-11-07T13:00:00Z")],
      AGORA
    );
    const out = sugerirHorarios({ data: "2026-11-28", perfil });
    expect(out[0]).toMatchObject({ hora: "10:00", origem: "historico" });
  });

  it("grade só sab/manhã ⇒ horários de sábado dentro da manhã", () => {
    const perfil = perfilDeEncontros(
      [
        enc("2026-11-14T22:00:00Z"), // 19:00 — fora da manhã
        enc("2026-11-07T13:00:00Z"), // 10:00 — dentro
      ],
      AGORA
    );
    const out = sugerirHorarios({
      data: "2026-11-28", // sábado
      perfil,
      disponibilidade: {
        celulas: [{ dia: "sab", periodo: "manha" }],
      },
    });
    expect(out.length).toBeGreaterThanOrEqual(1);
    for (const s of out) {
      expect(s.origem).toBe("disponibilidade");
      const h = Number(s.hora.slice(0, 2));
      expect(h).toBeGreaterThanOrEqual(8);
      expect(h).toBeLessThan(12);
    }
    expect(out.map((s) => s.hora)).toContain("09:00"); // âncora da manhã
    expect(out.map((s) => s.hora)).not.toContain("19:00");
  });

  it("grade sem célula no dia ⇒ cai pro perfil e sinaliza pela origem", () => {
    const perfil = perfilDeEncontros([enc("2026-11-14T13:00:00Z")], AGORA);
    const out = sugerirHorarios({
      data: "2026-11-23", // segunda — grade só tem sábado
      perfil,
      disponibilidade: {
        celulas: [{ dia: "sab", periodo: "manha" }],
      },
    });
    expect(out[0]).toMatchObject({ hora: "10:00", origem: "historico" });
  });

  it("sem histórico ⇒ padrão do programa por dia da semana", () => {
    const seg = sugerirHorarios({ data: "2026-11-23", perfil: VAZIO });
    expect(seg.map((s) => s.hora)).toEqual(["19:00", "19:30", "20:00"]);
    expect(seg.every((s) => s.origem === "padrao")).toBe(true);

    const sab = sugerirHorarios({ data: "2026-11-28", perfil: VAZIO });
    expect(sab.map((s) => s.hora)).toEqual(["09:00", "10:00", "11:00"]);
  });
});

describe("fuso", () => {
  it("mesmo instante com offsets distintos ⇒ mesmas partes civis em SP", () => {
    // Janeiro: quando o Brasil ainda tinha horário de verão, -02:00 e Z
    // descreviam o mesmo instante — a leitura civil não pode deslocar.
    const a = partesSP(new Date("2026-01-10T12:00:00Z"));
    const b = partesSP(new Date("2026-01-10T10:00:00-02:00"));
    for (const p of [a, b]) {
      expect(p).toMatchObject({
        data: "2026-01-10",
        horaMin: "09:00",
        hora: 9,
        diaSemana: "sab",
      });
    }
  });
});

describe("robustez", () => {
  it("entradas inválidas ou vazias não explodem e caem no fallback", () => {
    expect(
      perfilDeEncontros(null as unknown as EncontroHistorico[], AGORA).total
    ).toBe(0);
    expect(
      perfilDeEncontros(
        [
          enc("não-é-data"),
          enc(null as unknown as string),
          { data_hora: "2026-11-14T13:00:00Z", status: "agendado" },
        ],
        AGORA
      ).total
    ).toBe(0);
    expect(
      perfilDeEncontros([enc("2026-11-14T13:00:00Z")], new Date("lixo"))
        .total
    ).toBe(0);

    expect(sugerirDatas({ agora: new Date("lixo"), perfil: VAZIO })).toEqual(
      []
    );
    // janela inválida é ignorada, não trava a lista
    const comJanelaQuebrada = sugerirDatas({
      agora: AGORA,
      perfil: VAZIO,
      janela: { inicio: "x", fim: "y" },
    });
    expect(comJanelaQuebrada.length).toBeGreaterThan(0);

    const horas = sugerirHorarios({ data: "lixo", perfil: VAZIO });
    expect(horas.length).toBeGreaterThan(0);
    expect(horas.every((s) => s.origem === "padrao")).toBe(true);

    // grade com vocabulário fora do enum: celulasDe descarta, cai no padrão
    const gradeEstranha = sugerirHorarios({
      data: "2026-11-28",
      perfil: VAZIO,
      disponibilidade: {
        celulas: [{ dia: "sab", periodo: "madrugada" }],
      } as never,
    });
    expect(gradeEstranha.length).toBeGreaterThan(0);
  });

  it("rotuloOrigem cobre as quatro origens", () => {
    expect(rotuloOrigem("historico")).toBe("Baseado nos encontros de vocês");
    expect(rotuloOrigem("disponibilidade")).toBe("Baseado na disponibilidade");
    expect(rotuloOrigem("passo_do_plano")).toBe("Data do guia");
    expect(rotuloOrigem("padrao")).toBe("Sugestão do programa");
  });
});
