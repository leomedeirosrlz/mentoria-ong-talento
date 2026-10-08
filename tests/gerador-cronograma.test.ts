// Testes do gerador de cronograma (REALIZA-103): a configuração "oficial"
// reproduz o seed da T1 ao pé da letra — 7 rows de preparação, 16 encontros
// de terça com a folga do 8º→9º, recesso de fim de ano e o encerramento.
import { describe, expect, it } from "vitest";
import {
  ENCONTROS_DPP_OFICIAL,
  gerarEventos,
  normalizaEvento,
  totaisCronograma,
  validaEvento,
  validaEventos,
  type ConfigGerador,
  type EventoRascunho,
} from "@/lib/gerador-cronograma";

/** Config que espelha o calendário oficial da T1 (seed.sql): 1º encontro em
 *  08/set/2026 (terça), folga de 14 dias após o 8º, recesso 16/dez→04/jan. */
const CFG_T1: ConfigGerador = {
  primeiroEncontro: "2026-09-08",
  intervalos: [{ apos: 8, dias: 14 }],
  recessos: [
    { apos: 14, inicio: "2026-12-16", fim: "2027-01-04", titulo: "Recesso de fim de ano" },
  ],
};

function gerados(cfg: ConfigGerador = CFG_T1): EventoRascunho[] {
  const r = gerarEventos(cfg);
  if ("error" in r) throw new Error(r.error);
  return r.eventos;
}

const encontros = (evs: EventoRascunho[]) =>
  evs.filter((e) => e.tipo === "encontro");

describe("gerarEventos — calendário oficial T1", () => {
  it("gera as 3 seções do PDF na sequência canônica", () => {
    const evs = gerados();
    // 7 preparação + 16 encontros + 1 recesso + 1 encerramento
    expect(evs.length).toBe(25);
    expect(evs.slice(0, 7).map((e) => e.titulo)).toEqual([
      "Inscrições",
      "Triagem e matching",
      "Onboarding de mentores",
      "Encontro inicial de formação de mentores",
      "Encontro final de formação de mentores",
      "Onboarding de mentorados",
      "Início",
    ]);
    expect(evs[7].titulo).toBe("Boas-vindas, histórias de vida e abertura");
    expect(evs.at(-1)?.tipo).toBe("evento_encerramento");
    // o recesso entra entre o 14º e o 15º encontro — a posição é a do PDF
    const iRecesso = evs.findIndex((e) => e.tipo === "recesso");
    expect(evs[iRecesso - 1].numero).toBe(14);
    expect(evs[iRecesso + 1].numero).toBe(15);
  });

  it("reproduz as datas do seed: preparação, folga do 8º→9º e retomada", () => {
    const evs = gerados();
    expect(evs[0]).toMatchObject({
      titulo: "Inscrições",
      data: "2026-07-30",
      data_fim: "2026-08-19",
    });
    expect(evs[2]).toMatchObject({
      titulo: "Onboarding de mentores",
      data: "2026-09-03",
      data_fim: "2026-09-04",
    });
    const enc = encontros(evs);
    expect(enc[0].data).toBe("2026-09-08"); // 1º — terça
    expect(enc[7].data).toBe("2026-10-27"); // 8º
    expect(enc[8].data).toBe("2026-11-10"); // 9º — +14d (folga das submetas)
    expect(enc[13].data).toBe("2026-12-15"); // 14º
    expect(enc[14].data).toBe("2027-01-05"); // 15º — 1ª terça após o recesso
    expect(enc[15].data).toBe("2027-01-12"); // 16º
    expect(evs.at(-1)?.data).toBe("2027-01-15"); // encerramento +3d
    // conteúdo oficial completo nos 16 encontros
    expect(enc.map((e) => e.numero)).toEqual(
      Array.from({ length: 16 }, (_, i) => i + 1)
    );
    expect(enc[0].instrumentos).toContain("PDM");
    expect(enc[15].instrumentos).toEqual([
      "Avaliação 360º",
      "Autoavaliação do mentor",
    ]);
  });

  it("a lista gerada passa na própria validação (CHECKs 0062)", () => {
    expect(validaEventos(gerados())).toBeNull();
    expect(totaisCronograma(gerados())).toEqual({
      inicio_em: "2026-07-30",
      fim_em: "2027-01-15",
      encontros_esperados: 16,
    });
  });
});

describe("gerarEventos — variações", () => {
  it("sem preparação/encerramento gera só os encontros", () => {
    const evs = gerados({
      primeiroEncontro: "2026-10-06",
      preparacao: false,
      encerramento: false,
    });
    expect(evs.length).toBe(16);
    expect(evs.every((e) => e.tipo === "encontro")).toBe(true);
  });

  it("intervalos explícitos fazem a semana de encontro duplo da T2", () => {
    // T2 real: depois do 5º de terça, o 6º cai na quinta (+2d) e o 7º volta
    // pra terça (+5d) — a semana fica com dois encontros
    const evs = gerados({
      primeiroEncontro: "2026-10-06",
      intervalos: [
        { apos: 5, dias: 2 },
        { apos: 6, dias: 5 },
      ],
      preparacao: false,
      encerramento: false,
    });
    const enc = encontros(evs);
    expect(enc[5].data).toBe("2026-11-05"); // 6º na quinta
    expect(enc[6].data).toBe("2026-11-10"); // 7º de volta na terça
  });

  it("conteúdo copiado de outro cronograma casa pelo nº; faltante vira genérico", () => {
    const fonte = [
      { numero: 1, titulo: "Abertura custom", fase: "Fase X",
        instrumentos: ["PDM"], observacao: "obs" },
      { numero: 2, titulo: "Segundo custom", fase: "Fase X",
        instrumentos: [], observacao: null },
    ];
    const evs = gerados({
      primeiroEncontro: "2026-10-06",
      totalEncontros: 4,
      conteudo: { fonte: "copiar", encontros: fonte },
      preparacao: false,
      encerramento: false,
    });
    expect(encontros(evs)[0].titulo).toBe("Abertura custom");
    expect(encontros(evs)[3].titulo).toBe("Encontro 4");
  });

  it("conteúdo 'vazio' gera títulos genéricos sem fase", () => {
    const evs = gerados({
      primeiroEncontro: "2026-10-06",
      totalEncontros: 3,
      conteudo: { fonte: "vazio" },
      preparacao: false,
      encerramento: false,
    });
    expect(encontros(evs).map((e) => e.titulo)).toEqual([
      "Encontro 1",
      "Encontro 2",
      "Encontro 3",
    ]);
    expect(encontros(evs)[0].fase).toBeNull();
  });

  it("além dos 16 oficiais, encontro extra sai genérico", () => {
    const evs = gerados({
      primeiroEncontro: "2026-09-08",
      totalEncontros: 17,
      preparacao: false,
      encerramento: false,
    });
    expect(encontros(evs)[16]).toMatchObject({
      numero: 17,
      titulo: "Encontro 17",
      data: "2026-12-29",
    });
    // o template oficial tem exatamente 16
    expect(ENCONTROS_DPP_OFICIAL.length).toBe(16);
  });

  it("rejeita config inválida com mensagem clara", () => {
    expect(gerarEventos({ primeiroEncontro: "08/09/2026" })).toHaveProperty("error");
    expect(
      gerarEventos({ primeiroEncontro: "2026-09-08", totalEncontros: 0 })
    ).toHaveProperty("error");
    expect(
      gerarEventos({
        primeiroEncontro: "2026-09-08",
        intervalos: [{ apos: 16, dias: 7 }],
      })
    ).toHaveProperty("error");
    expect(
      gerarEventos({
        primeiroEncontro: "2026-09-08",
        recessos: [{ apos: 4, inicio: "2026-12-16", fim: "2026-12-01" }],
      })
    ).toHaveProperty("error");
  });
});

describe("normalizaEvento", () => {
  it("campos que só valem pra encontro zeram nos outros tipos", () => {
    const r = normalizaEvento({
      tipo: "recesso",
      numero: 4,
      data: "2026-12-16",
      data_fim: "2027-01-04",
      titulo: "  Recesso  ",
      fase: "Roda da Vida",
      instrumentos: ["PDM"],
      status: "concluida",
      observacao: "  ",
    });
    expect(r).toMatchObject({
      numero: null,
      fase: null,
      instrumentos: [],
      status: "pendente",
      titulo: "Recesso",
      observacao: null,
    });
  });

  it("etapa concluída preserva status e data null; data_fim sem data sai", () => {
    const r = normalizaEvento({
      tipo: "etapa_preparacao",
      numero: null,
      data: null,
      data_fim: "2026-08-19",
      titulo: "Triagem e matching",
      fase: null,
      instrumentos: [],
      status: "concluida",
      observacao: "Entregue pela ONG parceira",
    });
    expect(r).toMatchObject({ status: "concluida", data: null, data_fim: null });
    expect(validaEvento(r)).toBeNull();
  });
});

describe("validaEvento — espelho dos CHECKs da 0062", () => {
  const base: EventoRascunho = {
    tipo: "encontro",
    numero: 1,
    data: "2026-09-08",
    data_fim: null,
    titulo: "Encontro de abertura",
    fase: null,
    instrumentos: [],
    status: "pendente",
    observacao: null,
  };

  it("encontro exige numero inteiro ≥1 e data", () => {
    expect(validaEvento({ ...base, numero: null })).toBeTruthy();
    expect(validaEvento({ ...base, numero: 0 })).toBeTruthy();
    expect(validaEvento({ ...base, data: null })).toBeTruthy();
    expect(validaEvento({ ...base, data: "2026-02-31" })).toBeTruthy();
    expect(validaEvento(base)).toBeNull();
  });

  it("numero em tipo que não é encontro falha", () => {
    expect(
      validaEvento({ ...base, tipo: "formacao", numero: 1 })
    ).toBeTruthy();
  });

  it("data null só vale pra etapa concluída — etapa pendente exige data", () => {
    const etapa: EventoRascunho = {
      tipo: "etapa_preparacao",
      numero: null,
      data: null,
      data_fim: null,
      titulo: "Triagem e matching",
      fase: null,
      instrumentos: [],
      status: "concluida",
      observacao: null,
    };
    expect(validaEvento(etapa)).toBeNull();
    expect(validaEvento({ ...etapa, status: "pendente" })).toBeTruthy();
  });

  it("data_fim exige data e não vem antes dela", () => {
    const etapa = (data: string | null, data_fim: string | null): EventoRascunho => ({
      tipo: "etapa_preparacao",
      numero: null,
      data,
      data_fim,
      titulo: "Inscrições",
      fase: null,
      instrumentos: [],
      status: "pendente",
      observacao: null,
    });
    expect(validaEvento(etapa("2026-07-30", "2026-08-19"))).toBeNull();
    expect(validaEvento(etapa("2026-07-30", "2026-07-29"))).toBeTruthy();
    expect(validaEvento(etapa(null, "2026-08-19"))).toBeTruthy();
  });
});

describe("validaEventos — regras da lista", () => {
  it("nº de encontro duplicado é recusado (índice único do banco)", () => {
    const evs = gerados();
    const copia = { ...evs[7] }; // encontro 1 duplicado
    expect(validaEventos([...evs, copia])).toContain("número 1");
  });

  it("precisa de ao menos um encontro oficial", () => {
    const soEtapa: EventoRascunho = {
      tipo: "etapa_preparacao",
      numero: null,
      data: "2026-09-08",
      data_fim: null,
      titulo: "Início",
      fase: null,
      instrumentos: [],
      status: "pendente",
      observacao: null,
    };
    expect(validaEventos([soEtapa])).toBeTruthy();
    expect(validaEventos([])).toBeTruthy();
  });

  it("o erro nomeia a posição na sequência", () => {
    const evs = gerados();
    const quebrado = { ...evs[3], titulo: "" };
    const lista = [...evs.slice(0, 3), quebrado, ...evs.slice(4)];
    expect(validaEventos(lista)).toMatch(/^Item 4 /);
  });
});

describe("totaisCronograma", () => {
  it("deriva início, fim e esperados como o backfill da 0061", () => {
    expect(totaisCronograma(gerados())).toEqual({
      inicio_em: "2026-07-30",
      fim_em: "2027-01-15",
      encontros_esperados: 16,
    });
  });

  it("lista sem datas devolve nulls e zero", () => {
    expect(
      totaisCronograma([
        { tipo: "etapa_preparacao", data: null, data_fim: null },
      ])
    ).toEqual({ inicio_em: null, fim_em: null, encontros_esperados: 0 });
  });
});
