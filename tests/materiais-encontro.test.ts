// REALIZA-386/394 — ponte doc↔instrumento e o kit de material por encontro.
// As derivações são puras (ciclo_eventos vira CronogramaEncontros inline);
// o contrato com o corpus real (slugs/títulos/audiências do frontmatter)
// também é testado — docs/rag está no repo.
import { describe, expect, it } from "vitest";
import {
  docDoSistema,
  docsDoEncontro,
  instrumentoDoEncontro,
  sistemaDoDoc,
  type CronogramaEncontros,
} from "@/lib/como-conduzir";
import {
  audienciasDe,
  enriquecerMateriaisPorEncontro,
  hrefMaterial,
} from "@/lib/materiais";
import { listarDocsCorpus } from "@/lib/materiais/corpus-doc";
import type { Material } from "@/lib/types";

// espelho do seed (supabase/seed.sql, ciclo_eventos.instrumentos) — o que a
// turma carrega quando a RPC devolve o cronograma oficial
const CRONOGRAMA_SEED: CronogramaEncontros = [
  { tipo: "encontro", numero: 1, instrumentos: ["Perguntas Eficazes", "Escuta Ativa", "PDM", "Roda da Vida (leitura inicial)"] },
  { tipo: "encontro", numero: 2, instrumentos: ["PDM", "Construindo a sua Visão"] },
  { tipo: "encontro", numero: 3, instrumentos: ["PDM", "Modelo SMART"] },
  { tipo: "encontro", numero: 4, instrumentos: ["PDM", "Perguntas Eficazes"] },
  { tipo: "encontro", numero: 5, instrumentos: ["PDM", "Feedback Construtivo"] },
  { tipo: "encontro", numero: 6, instrumentos: ["PDM", "Feedback Construtivo"] },
  { tipo: "encontro", numero: 7, instrumentos: ["PDM", "Feedback Construtivo"] },
  { tipo: "encontro", numero: 8, instrumentos: ["PDM", "Escuta Ativa"] },
  { tipo: "encontro", numero: 9, instrumentos: ["PDM", "Escuta Ativa"] },
  { tipo: "encontro", numero: 10, instrumentos: ["Papel de modelo", "Escuta Ativa"] },
  { tipo: "encontro", numero: 11, instrumentos: ["Papel de modelo", "Escuta Ativa"] },
  { tipo: "encontro", numero: 12, instrumentos: ["Roda da Vida", "Modelo SMART"] },
  { tipo: "encontro", numero: 13, instrumentos: ["Roda da Vida", "Modelo SMART"] },
  { tipo: "encontro", numero: 14, instrumentos: ["Roda da Vida", "Modelo SMART"] },
  { tipo: "encontro", numero: 15, instrumentos: ["PDM", "Roda da Vida"] },
  { tipo: "encontro", numero: 16, instrumentos: ["Avaliação final"] },
  // recesso/etapa carregam numero null — não viram entrada de encontro
  { tipo: "recesso", numero: null, instrumentos: [] },
  { tipo: "etapa_preparacao", numero: null, instrumentos: [] },
];

const material = (over: Partial<Material>): Material => ({
  id: `m-${Math.random().toString(36).slice(2, 8)}`,
  titulo: "Material",
  descricao: null,
  tipo: "conteudo",
  url: null,
  path: null,
  audiencia: "todos",
  audiencias: null,
  encontro_num: null,
  ordem: 50,
  ...over,
});

// ---------- instrumentoDoEncontro: união evento × janela ----------

describe("instrumentoDoEncontro", () => {
  it("normaliza acento e caixa dos nomes do evento", () => {
    const cron: CronogramaEncontros = [
      { numero: 7, instrumentos: ["VISÃO", "Construindo a sua visão", "roda da vida"] },
    ];
    expect(instrumentoDoEncontro(7, cron)).toEqual(["visao", "roda_vida"]);
  });

  it("a lista editorial do evento manda quando existe", () => {
    // enc. 10 nomeia técnica sem sistema — a janela não cobre o 10º
    expect(instrumentoDoEncontro(10, CRONOGRAMA_SEED)).toEqual([]);
    expect(instrumentoDoEncontro(2, CRONOGRAMA_SEED)).toEqual([
      "visao",
      "metas",
      "pdm",
    ]);
  });

  it("a janela da jornada responde quando o evento não lista", () => {
    expect(instrumentoDoEncontro(12, [])).toEqual(["roda_vida"]);
    // roda_inicial (enc. 1) + visao/pdm (1–4) mesmo sem cronograma
    expect(instrumentoDoEncontro(1, [])).toEqual(["visao", "pdm", "roda_vida"]);
  });

  it("união na ordem canônica INSTRUMENTOS_SISTEMA — não na do evento", () => {
    // o evento do enc. 1 lista PDM e Roda depois das técnicas; a janela
    // completa com visão — a saída segue visao → metas → pdm → roda_vida
    expect(instrumentoDoEncontro(1, CRONOGRAMA_SEED)).toEqual([
      "visao",
      "pdm",
      "roda_vida",
    ]);
    expect(instrumentoDoEncontro(15, CRONOGRAMA_SEED)).toEqual([
      "pdm",
      "roda_vida",
    ]);
  });

  it('"Modelo SMART" e "Papel de modelo" não viram instrumento — são técnica', () => {
    // enc. 12 nomeia "Modelo SMART": se mapeasse pra metas, a janela (só
    // roda_vida em 12–14) não esconderia o vazamento — tem que sair só roda
    expect(instrumentoDoEncontro(12, CRONOGRAMA_SEED)).toEqual(["roda_vida"]);
    expect(instrumentoDoEncontro(10, CRONOGRAMA_SEED)).toEqual([]);
  });
});

// ---------- DOC_DO_SISTEMA: os dois sentidos da ponte ----------

describe("docDoSistema / sistemaDoDoc", () => {
  it("cada instrumento da dupla tem o doc canônico do corpus", () => {
    expect(docDoSistema("visao")).toBe("instrumento-construindo-visao");
    expect(docDoSistema("metas")).toBe("instrumento-definindo-minhas-metas");
    expect(docDoSistema("pdm")).toBe("instrumento-pdm");
    expect(docDoSistema("roda_vida")).toBe("instrumento-roda-da-vida");
    expect(docDoSistema("competencias_mentor")).toBe("checklist-competencias");
  });

  it("a volta resolve só doc de instrumento — roteiro e técnica ficam fora", () => {
    expect(sistemaDoDoc("instrumento-pdm")).toBe("pdm");
    expect(sistemaDoDoc("checklist-competencias")).toBe("competencias_mentor");
    expect(sistemaDoDoc("roteiro-encontro-03")).toBeNull();
    expect(sistemaDoDoc("guia-mentor-dpp")).toBeNull();
    expect(sistemaDoDoc("feedback-construtivo")).toBeNull();
    expect(sistemaDoDoc("nao-existe")).toBeNull();
  });
});

// ---------- docsDoEncontro: o kit de docs de cada encontro ----------

describe("docsDoEncontro", () => {
  const slugsDe = (n: number, cron: CronogramaEncontros = CRONOGRAMA_SEED) =>
    docsDoEncontro(n, cron).map((d) => d.slug);

  it("roteiro + instrumentos na janela + técnicas nomeadas, nessa ordem", () => {
    expect(slugsDe(1)).toEqual([
      "roteiro-encontro-01",
      "instrumento-construindo-visao",
      "instrumento-pdm",
      "instrumento-roda-da-vida",
      "checklist-competencias",
      "perguntas-eficazes",
      "escuta-ativa-e-comunicacao",
    ]);
  });

  it("encontro do meio sem janela leva roteiro + o que o evento nomeia", () => {
    // enc. 5: fora das janelas; o evento nomeia PDM e Feedback
    expect(slugsDe(5)).toEqual([
      "roteiro-encontro-05",
      "instrumento-pdm",
      "feedback-construtivo",
    ]);
  });

  it('"Modelo SMART" e "Papel de modelo" não viram doc — não existe doc deles', () => {
    expect(slugsDe(12)).toEqual([
      "roteiro-encontro-12",
      "instrumento-roda-da-vida",
    ]);
    expect(slugsDe(10)).toEqual([
      "roteiro-encontro-10",
      "escuta-ativa-e-comunicacao",
    ]);
  });

  it("o checklist de competências marca início e fechamento (1º e 16º)", () => {
    expect(slugsDe(16)).toEqual(["roteiro-encontro-16", "checklist-competencias"]);
    expect(slugsDe(9)).not.toContain("checklist-competencias");
  });

  it("fora dos 16 encontros não há kit — trilha especialista e marcos", () => {
    expect(slugsDe(0)).toEqual([]);
    expect(slugsDe(17)).toEqual([]);
  });

  it("a audiência espelha o doc: jovem entra nos 4 de jornada, roteiro fica em staff", () => {
    const enc1 = docsDoEncontro(1);
    const roteiro = enc1.find((d) => d.slug === "roteiro-encontro-01")!;
    const visao = enc1.find((d) => d.slug === "instrumento-construindo-visao")!;
    const checklist = enc1.find((d) => d.slug === "checklist-competencias")!;
    expect(roteiro.audiencias).not.toContain("mentorado");
    expect(visao.audiencias).toContain("mentorado");
    expect(checklist.audiencias).not.toContain("mentorado");
    // feedback-construtivo é de staff/mentores (0167) — nunca do jovem
    const enc5 = docsDoEncontro(5, CRONOGRAMA_SEED);
    expect(
      enc5.find((d) => d.slug === "feedback-construtivo")!.audiencias
    ).not.toContain("mentorado");
  });
});

// ---------- enriquecerMateriaisPorEncontro ----------

describe("enriquecerMateriaisPorEncontro", () => {
  it("a linha real do catálogo vence a sintética do mesmo doc", () => {
    const real = material({
      id: "real-roteiro-01",
      titulo: "Roteiro Semana 1 — Boas-vindas e histórias de vida",
      path: "doc:roteiro-encontro-01",
      encontro_num: 1,
      ordem: 3,
    });
    const mapa = enriquecerMateriaisPorEncontro(
      new Map([[1, [real]]]),
      CRONOGRAMA_SEED
    );
    const lista = mapa.get(1)!;
    // roteiro não duplica; os outros docs entram atrás
    expect(lista.filter((m) => m.path === "doc:roteiro-encontro-01")).toHaveLength(1);
    expect(lista[0]).toBe(real);
    expect(lista.map((m) => m.path)).toContain("doc:instrumento-pdm");
    expect(lista.map((m) => m.path)).toContain("doc:perguntas-eficazes");
  });

  it("encontro sem linha alguma herda o kit inteiro pelo cronograma", () => {
    const mapa = enriquecerMateriaisPorEncontro(new Map(), CRONOGRAMA_SEED);
    expect(mapa.get(5)?.map((m) => m.path)).toEqual([
      "doc:roteiro-encontro-05",
      "doc:instrumento-pdm",
      "doc:feedback-construtivo",
    ]);
    // marcos sem numero (recesso, etapa) não geram lista
    expect(mapa.has(0)).toBe(false);
  });

  it("a linha sintética carrega destino doc: e a audiência do documento", () => {
    const mapa = enriquecerMateriaisPorEncontro(new Map(), CRONOGRAMA_SEED);
    const visaoDoc = mapa.get(2)!.find((m) => m.path === "doc:instrumento-construindo-visao")!;
    expect(hrefMaterial(visaoDoc)).toBe(
      "/materiais/documento/instrumento-construindo-visao"
    );
    expect(audienciasDe(visaoDoc)).toContain("mentorado");
    const roteiro = mapa.get(2)!.find((m) => m.path === "doc:roteiro-encontro-02")!;
    expect(audienciasDe(roteiro)).toContain("mentor_dpp");
    expect(audienciasDe(roteiro)).not.toContain("mentorado");
  });

  it("linhas do catálogo que não são doc ficam intactas e externas", () => {
    const externo = material({
      titulo: "Formação EaD",
      tipo: "link",
      url: "https://ead.realiza.vc",
      encontro_num: 2,
    });
    const mapa = enriquecerMateriaisPorEncontro(
      new Map([[2, [externo]]]),
      CRONOGRAMA_SEED
    );
    const lista = mapa.get(2)!;
    expect(lista[0]).toBe(externo);
    // a url externa continua externa — não vira doc nem /api/material
    expect(hrefMaterial(externo)).toBe("https://ead.realiza.vc");
  });

  it("dedup é por slug dentro do encontro — o mesmo doc entra noutro encontro", () => {
    // a Roda aparece como linha real no enc. 12 do catálogo; nos encontros
    // 13–14 a linha sintética cobre sem duplicar
    const mapa = enriquecerMateriaisPorEncontro(
      new Map(),
      CRONOGRAMA_SEED
    );
    for (const n of [12, 13, 14]) {
      expect(
        mapa.get(n)!.filter((m) => m.path === "doc:instrumento-roda-da-vida")
      ).toHaveLength(1);
    }
  });
});

// ---------- contrato com o corpus real ----------

describe("contrato com docs/rag", () => {
  it("todo slug do mapa existe no corpus — título casa (roteiro é exceção: rótulo curto da linha)", async () => {
    const corpus = await listarDocsCorpus();
    const porSlug = new Map(corpus.map((d) => [d.slug, d]));
    for (const n of [1, 5, 10, 12, 16]) {
      for (const d of docsDoEncontro(n, CRONOGRAMA_SEED)) {
        const doc = porSlug.get(d.slug);
        expect(doc, `doc:${d.slug} existe no corpus`).toBeTruthy();
        // a linha do roteiro usa o rótulo curto do catálogo ("Roteiro
        // Semana N"); o frontmatter carrega o título longo oficial
        if (!d.slug.startsWith("roteiro-encontro-")) {
          expect(doc!.titulo).toBe(d.titulo);
        }
      }
    }
  });

  it("a audiência declarada no mapa bate com o frontmatter", async () => {
    const corpus = await listarDocsCorpus();
    const porSlug = new Map(corpus.map((d) => [d.slug, d]));
    for (const d of docsDoEncontro(1, CRONOGRAMA_SEED)) {
      const doc = porSlug.get(d.slug)!;
      expect([...doc.audiencia].sort()).toEqual([...d.audiencias].sort());
    }
  });
});
