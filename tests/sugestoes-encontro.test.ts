import { describe, expect, it } from "vitest";
import { diaSemanaDe, diffDias } from "../src/lib/ciclo";
import {
  gapDiasParaRitmo,
  ocupadoEmChoque,
  partesSP,
  perfilDeEncontros,
  principalDe,
  rotuloOrigem,
  sugerirDatas,
  sugerirHorarios,
  type EncontroHistorico,
} from "../src/lib/sugestoes-encontro";
import { ocupadosDoJovem } from "../src/lib/sugestoes-encontro-server";
import type { JovemEncontro } from "../src/lib/queries-jovem";
import type { JovemDupla } from "../src/lib/types";

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

  it("data com todos os horários em choque sai da lista", () => {
    // seg 23/11 só tem os 3 slots padrão; os três ocupados cobrem todos
    const ocupados = [
      "2026-11-23T19:00:00-03:00",
      "2026-11-23T19:30:00-03:00",
      "2026-11-23T20:00:00-03:00",
    ];
    const out = sugerirDatas({ agora: AGORA, perfil: VAZIO, ocupados });
    expect(out.map((s) => s.data)).not.toContain("2026-11-23");
    expect(out).toHaveLength(5);
    expect(out[0].data).toBe("2026-11-24");
  });

  it("data do passo em choque total também não é forçada", () => {
    const ocupados = [
      "2026-11-23T19:00:00-03:00",
      "2026-11-23T19:30:00-03:00",
      "2026-11-23T20:00:00-03:00",
    ];
    const out = sugerirDatas({
      agora: AGORA,
      perfil: VAZIO,
      dataSugerida: "2026-11-23",
      ocupados,
    });
    expect(out.every((s) => s.data !== "2026-11-23")).toBe(true);
    expect(out.every((s) => s.origem !== "passo_do_plano")).toBe(true);
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

  const perfilTer19 = () =>
    perfilDeEncontros(
      [enc("2026-11-10T22:00:00Z"), enc("2026-11-17T22:00:00Z")], // ter 19:00
      AGORA
    );

  it("slot em choque ⇒ conflito: true, livres na frente, nada removido", () => {
    const out = sugerirHorarios({
      data: "2026-11-24", // terça
      perfil: perfilTer19(),
      ocupados: ["2026-11-24T19:00:00-03:00"],
    });
    // ocupado [19:00,20:00): 19:00 bate de cheio e 19:30 (dur 60 ⇒ até
    // 20:30) cobre a última meia hora — só 20:00 encosta e fica livre
    expect(out.map((s) => s.hora)).toEqual(["20:00", "19:00", "19:30"]);
    expect(out[0].conflito).toBeUndefined();
    expect(out[1]).toMatchObject({ hora: "19:00", conflito: true });
    expect(out[2]).toMatchObject({ hora: "19:30", conflito: true });
  });

  it("duracaoMin 90 ⇒ o choque alcança também o slot seguinte", () => {
    const out = sugerirHorarios({
      data: "2026-11-24",
      perfil: perfilTer19(),
      duracaoMin: 90,
      ocupados: ["2026-11-24T19:00:00-03:00"],
    });
    // [19:30,21:00) sobrepõe [19:00,20:00) — a janela maior do candidato
    // pega o ocupado mesmo começando depois dele
    expect(out.find((s) => s.hora === "19:30")?.conflito).toBe(true);
    expect(out.find((s) => s.hora === "19:00")?.conflito).toBe(true);
    expect(out[0]).toMatchObject({ hora: "20:00" });
    expect(out[0].conflito).toBeUndefined();
  });

  it("ocupado em UTC (Z) compara o mesmo instante", () => {
    const out = sugerirHorarios({
      data: "2026-11-24",
      perfil: perfilTer19(),
      ocupados: ["2026-11-24T22:00:00Z"], // = 19:00 em SP
    });
    expect(out.find((s) => s.hora === "19:00")?.conflito).toBe(true);
    expect(out[0].conflito).toBeUndefined();
  });

  it("ocupados null/vazio/inválido ⇒ resultado idêntico ao de hoje", () => {
    const perfil = perfilTer19();
    const base = sugerirHorarios({ data: "2026-11-24", perfil });
    for (const ocupados of [
      null,
      [],
      ["lixo", "", "2026-11-24"],
      [42, null] as never,
    ])
      expect(
        sugerirHorarios({ data: "2026-11-24", perfil, ocupados })
      ).toEqual(base);

    const datasBase = sugerirDatas({ agora: AGORA, perfil });
    for (const ocupados of [null, [], ["não é iso"]])
      expect(
        sugerirDatas({ agora: AGORA, perfil, ocupados })
      ).toEqual(datasBase);
  });

  it("encontro encostado (fim == início) não conflita", () => {
    const perfil = perfilTer19();
    // ocupado [18:00,19:00) encosta no candidato 19:00 pelo fim
    const peloFim = sugerirHorarios({
      data: "2026-11-24",
      perfil,
      ocupados: ["2026-11-24T18:00:00-03:00"],
    });
    expect(
      peloFim.find((s) => s.hora === "19:00")?.conflito
    ).toBeUndefined();
    // candidato [19:00,20:00) encosta no ocupado [20:00,21:00) pelo início
    const peloInicio = sugerirHorarios({
      data: "2026-11-24",
      perfil,
      ocupados: ["2026-11-24T20:00:00-03:00"],
    });
    expect(
      peloInicio.find((s) => s.hora === "19:00")?.conflito
    ).toBeUndefined();
    expect(peloInicio.find((s) => s.hora === "20:00")?.conflito).toBe(
      true
    );
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

// ---------- 481: choque rotulado, sugestão principal e ocupados do jovem ----------

describe("ocupadoEmChoque", () => {
  const OCUP = {
    inicio: "2026-11-24T22:00:00Z", // ter 24/11 19:00 em SP
    rotulo: "6º encontro com Ricardo",
    rotuloArtigo: "o 6º encontro com Ricardo",
  };

  it("bate de cheio ⇒ devolve o ocupado com o rótulo pra mensagem", () => {
    expect(ocupadoEmChoque(new Date("2026-11-24T22:00:00Z"), [OCUP])).toEqual(
      OCUP
    );
  });

  it("sobreposição parcial conta; encostado (fim == início) não", () => {
    // 19:30 (dur 60 ⇒ até 20:30) cobre a última meia hora do ocupado
    expect(
      ocupadoEmChoque(new Date("2026-11-24T22:30:00Z"), [OCUP])
    ).not.toBeNull();
    // 20:00 encosta pelo fim do ocupado [19:00,20:00)
    expect(
      ocupadoEmChoque(new Date("2026-11-24T23:00:00Z"), [OCUP])
    ).toBeNull();
    // 18:00 encosta pelo início do candidato
    expect(
      ocupadoEmChoque(new Date("2026-11-24T21:00:00Z"), [OCUP])
    ).toBeNull();
  });

  it("entrada torta ⇒ null; string cru volta com rótulos vazios", () => {
    expect(ocupadoEmChoque(new Date("lixo"), [OCUP])).toBeNull();
    expect(
      ocupadoEmChoque(new Date("2026-11-24T22:00:00Z"), null)
    ).toBeNull();
    expect(
      ocupadoEmChoque(new Date("2026-11-24T22:00:00Z"), ["não-iso"])
    ).toBeNull();
    expect(
      ocupadoEmChoque(new Date("2026-11-24T22:00:00Z"), [
        "2026-11-24T22:00:00Z",
      ])
    ).toMatchObject({ rotulo: "", rotuloArtigo: "" });
  });
});

describe("principalDe", () => {
  const perfilTer19 = () =>
    perfilDeEncontros(
      [enc("2026-11-10T22:00:00Z"), enc("2026-11-17T22:00:00Z")], // ter 19:00
      AGORA
    );

  it("primeira data + primeiro horário livre, origem da evidência", () => {
    const perfil = perfilTer19();
    const datas = sugerirDatas({ agora: AGORA, perfil });
    expect(principalDe({ datas, perfil })).toMatchObject({
      data: "2026-11-24",
      hora: "19:00",
      origem: "historico",
    });
  });

  it("a data do guia fala mais alto na origem", () => {
    const perfil = perfilTer19();
    const datas = sugerirDatas({
      agora: AGORA,
      perfil,
      dataSugerida: "2026-12-01",
    });
    expect(principalDe({ datas, perfil })).toMatchObject({
      data: "2026-12-01",
      origem: "passo_do_plano",
    });
  });

  it("primeiro horário em choque ⇒ o par salta pro próximo livre", () => {
    const perfil = perfilTer19();
    const datas = sugerirDatas({ agora: AGORA, perfil });
    expect(
      principalDe({
        datas,
        perfil,
        ocupados: ["2026-11-24T19:00:00-03:00"],
      })
    ).toMatchObject({ data: "2026-11-24", hora: "20:00" });
  });

  it("sem datas ⇒ null (o cartão não promete gesto impossível)", () => {
    expect(principalDe({ datas: [], perfil: perfilTer19() })).toBeNull();
  });
});

describe("ocupadosDoJovem", () => {
  const dupla = (
    id: string,
    trilha: string | null,
    mentor: string,
    social: string | null = null
  ) =>
    ({
      id,
      trilha,
      mentor_nome: mentor,
      mentor_nome_social: social,
    }) as unknown as JovemDupla;
  const enc = (
    dupla_id: string,
    numero: number,
    data_hora: string | null,
    status: JovemEncontro["status"] = "agendado"
  ): JovemEncontro => ({
    id: `${dupla_id}-${numero}`,
    dupla_id,
    numero,
    data_hora,
    realizado_em: null,
    duracao_min: 60,
    status,
    link: null,
    motivo_reagendamento: null,
  });

  it("rótulo por trilha: DPP 'Nº encontro com', esp 'sessão com' + artigo", () => {
    const out = ocupadosDoJovem(
      [
        enc("d-dpp", 6, "2026-11-24T22:00:00Z"),
        enc("d-esp", 3, "2026-11-25T13:00:00Z"),
      ],
      [
        dupla("d-dpp", "dpp", "Ricardo Santos", "Ricardo"),
        dupla("d-esp", "especialista", "Helena Prado"),
      ]
    );
    expect(out).toEqual([
      {
        inicio: "2026-11-24T22:00:00Z",
        rotulo: "6º encontro com Ricardo",
        rotuloArtigo: "o 6º encontro com Ricardo",
      },
      {
        inicio: "2026-11-25T13:00:00Z",
        rotulo: "sessão com Helena",
        rotuloArtigo: "uma sessão com Helena",
      },
    ]);
  });

  it("só agendado/remarcado com data entra; a trilha vem da dupla, não do encontro", () => {
    const out = ocupadosDoJovem(
      [
        enc("d-dpp", 5, "2026-11-17T22:00:00Z", "realizado"), // fora
        enc("d-dpp", 6, null), // sem data: fora
        enc("d-esp", 2, "2026-11-25T13:00:00Z", "remarcado"),
      ],
      [
        dupla("d-dpp", "dpp", "Ricardo"),
        dupla("d-esp", "especialista", "Helena"),
      ]
    );
    expect(out).toHaveLength(1);
    expect(out[0].rotulo).toBe("sessão com Helena");
  });

  it("encontro de dupla fora do mapa cai no rótulo genérico", () => {
    const out = ocupadosDoJovem(
      [enc("d-x", 4, "2026-11-24T22:00:00Z")],
      []
    );
    expect(out[0]).toMatchObject({
      rotulo: "4º encontro com seu mentor",
      rotuloArtigo: "o 4º encontro com seu mentor",
    });
  });
});
