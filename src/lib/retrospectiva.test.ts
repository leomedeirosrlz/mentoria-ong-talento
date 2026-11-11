import { describe, expect, it } from "vitest";
import {
  dadosRetrospectiva,
  dadosRetrospectivaJovem,
  linhaChecklistResumo,
} from "./retrospectiva";
import {
  parChecklist,
  parRoda,
  momentoChecklist,
  entregasDoMomentoChecklist,
} from "./jornada";
import {
  extraiRodaDaVida,
  mesmasAreas,
  type FormularioCampo,
  type RodaDaVida,
} from "./forms/schema";
import type { PassoGuia } from "./ciclo";
import type { PdmResumo } from "./pdm";
import type { Dificuldade, ProximoPasso } from "./types";

// REALIZA-18/-359 — o par antes × depois (roda e checklist) e a derivação
// da retrospectiva: destrava, recorte por papel e degradação sem dados.

const HOJE = new Date("2026-07-01T12:00:00-03:00");
const dataEnc = (n: number): string => {
  const d = new Date("2026-03-03T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + (n - 1) * 7);
  return d.toISOString().slice(0, 10);
};

const CAMPOS_RODA: FormularioCampo[] = [
  { id: "s_pessoal", tipo: "secao", label: "Pessoal", obrigatorio: false },
  { id: "p_saude", tipo: "escala_1_10", label: "Saúde", obrigatorio: true },
  { id: "p_equilibrio", tipo: "escala_1_10", label: "Equilíbrio", obrigatorio: true },
  { id: "s_prof", tipo: "secao", label: "Profissional", obrigatorio: false },
  { id: "pr_carreira", tipo: "escala_1_10", label: "Carreira", obrigatorio: true },
  { id: "reflexao", tipo: "texto_longo", label: "Reflexão", obrigatorio: false },
];

const roda = (over: Partial<RodaDaVida> = {}): RodaDaVida => ({
  quadrantes: [
    {
      nome: "Pessoal",
      areas: [
        { id: "p_saude", label: "Saúde", nota: 5 },
        { id: "p_equilibrio", label: "Equilíbrio", nota: 6 },
      ],
    },
    {
      nome: "Profissional",
      areas: [{ id: "pr_carreira", label: "Carreira", nota: 4 }],
    },
  ],
  media: 5,
  respondidas: 3,
  total: 3,
  ...over,
});

// ---------- mesmasAreas ----------

describe("mesmasAreas", () => {
  it("mesma sequência de ids → true", () => {
    expect(mesmasAreas(roda(), roda())).toBe(true);
  });
  it("id divergente ou quantidade diferente → false (ghost desliga)", () => {
    const outro = roda();
    outro.quadrantes[0].areas = [
      { id: "p_saude", label: "Saúde", nota: 5 },
      { id: "outro_id", label: "Outra", nota: 6 },
    ];
    expect(mesmasAreas(roda(), outro)).toBe(false);
    const cortada = roda({ quadrantes: [roda().quadrantes[0]] });
    expect(mesmasAreas(roda(), cortada)).toBe(false);
  });
});

// ---------- parRoda / parChecklist ----------

const entrega = (over: Record<string, unknown> = {}) => ({
  link_id: `l-${Math.random().toString(36).slice(2)}`,
  created_at: "2026-03-04T10:00:00-03:00",
  respondido_em: null,
  respostas: null,
  contexto: null,
  ...over,
});

const respondida = (
  created: string,
  respostas: Record<string, unknown> = { comp_1: "Já faço bem" },
  contexto: Record<string, unknown> | null = null
) =>
  entrega({
    created_at: created,
    respondido_em: created,
    respostas,
    contexto,
  });

describe("parRoda", () => {
  it("sem marca: a primeira respondida é a inicial, a seguinte é a formal", () => {
    const par = parRoda([
      respondida("2026-03-04T10:00:00-03:00"),
      respondida("2026-05-20T10:00:00-03:00"),
    ]);
    expect(par.inicial?.created_at).toBe("2026-03-04T10:00:00-03:00");
    expect(par.formal?.created_at).toBe("2026-05-20T10:00:00-03:00");
  });
  it("marca explícita vence a ordem cronológica", () => {
    const par = parRoda([
      respondida("2026-03-04T10:00:00-03:00", { x: 1 }, { momento: "formal" }),
      respondida("2026-05-20T10:00:00-03:00"),
    ]);
    expect(par.formal?.created_at).toBe("2026-03-04T10:00:00-03:00");
    expect(par.inicial?.created_at).toBe("2026-05-20T10:00:00-03:00");
  });
  it("sem marca, a primeira ENTREGA é a inicial — respondida ou não", () => {
    // regra documentada: a primeira roda da dupla é a leitura inicial; a
    // pendente segura o bucket — a respondida seguinte lê como formal e
    // a comparação degrada pra roda única (inicial sem resposta = null)
    const par = parRoda([
      entrega({ created_at: "2026-03-04T10:00:00-03:00" }),
      respondida("2026-05-20T10:00:00-03:00"),
    ]);
    expect(par.inicial).toBeNull();
    expect(par.formal?.created_at).toBe("2026-05-20T10:00:00-03:00");
  });
});

describe("momentoChecklist / parChecklist", () => {
  it("marca explícita inicio/final vence", () => {
    expect(
      momentoChecklist({ contexto: { momento: "final" } }, true)
    ).toBe("final");
    expect(momentoChecklist({ contexto: { momento: "inicio" } }, false)).toBe(
      "inicio"
    );
  });
  it("sem marca: a primeira é o início; as seguintes são o final", () => {
    const sem = entregaDoMomentoFixture();
    expect(entregasDoMomentoChecklist(sem, "inicio")).toHaveLength(1);
    expect(entregasDoMomentoChecklist(sem, "final")).toHaveLength(1);
  });
  it("par devolve a respondida mais recente de cada ponta", () => {
    const par = parChecklist([
      respondida("2026-03-04T10:00:00-03:00", { comp_1: "Preciso desenvolver" }),
      respondida("2026-06-20T10:00:00-03:00", { comp_1: "Já faço bem" }),
    ]);
    expect(par.inicio?.respostas).toMatchObject({
      comp_1: "Preciso desenvolver",
    });
    expect(par.final?.respostas).toMatchObject({ comp_1: "Já faço bem" });
  });
});

function entregaDoMomentoFixture() {
  return [
    respondida("2026-03-04T10:00:00-03:00"),
    respondida("2026-06-20T10:00:00-03:00"),
  ];
}

// ---------- dadosRetrospectiva ----------

const PASSOS: PassoGuia[] = Array.from({ length: 16 }, (_, i) => ({
  id: `p-${i + 1}`,
  numero: i + 1,
  titulo: `Encontro ${i + 1}`,
  data: dataEnc(i + 1),
  fase: null,
  instrumentos: [],
}));

const EVENTOS = PASSOS.map((p) => ({ tipo: "encontro" as const, data: p.data }));

const duplaBase = (over: Record<string, unknown> = {}) => ({
  trilha: "dpp" as const,
  status: "ativa" as const,
  iniciada_em: "2026-03-03",
  mentor: { nome: "Mentor" },
  mentorado: { nome: "Jovem" },
  encontros: [] as {
    numero: number;
    status: "realizado" | "agendado" | "remarcado" | "nao_aconteceu";
    data_hora: string | null;
    realizado_em: string | null;
    registro?: {
      tema: string | null;
      avaliacao: "baixa" | "regular" | "boa" | "excelente" | null;
      atividades?: string[];
      reflexoes?: string | null;
      observacoes?: string | null;
      dificuldade?: Dificuldade | null;
      proximo_passo?: ProximoPasso | null;
      precisa_apoio?: boolean;
    } | null;
  }[],
  encaminhamentos: [] as {
    descricao: string;
    responsavel?: "mentor" | "mentorado";
    numero?: number | null;
    prazo: string | null;
    status: "pendente" | "feito";
    feito_em?: string | null;
    created_at: string;
  }[],
  ...over,
});

const enc = (
  numero: number,
  registro: Record<string, unknown> | null = null
) => ({
  numero,
  status: "realizado" as const,
  data_hora: `${dataEnc(numero)}T19:00:00-03:00`,
  realizado_em: `${dataEnc(numero)}T19:00:00-03:00`,
  registro: registro as never,
});

const PDM: PdmResumo = {
  total: 3,
  atingidas: 2,
  atingidasLista: [
    { titulo: "Passar no ENEM", atingidaEm: "2026-05-01" },
    { titulo: "Jovem aprendiz", atingidaEm: "2026-06-01" },
  ],
};

const baseRetro = (over: Record<string, unknown> = {}) => ({
  passos: PASSOS,
  eventos: EVENTOS,
  fim: null,
  hoje: HOJE,
  comNotasInternas: true,
  ...over,
});

describe("dadosRetrospectiva — destrava", () => {
  it("16º encontro realizado abre mesmo com dupla ativa", () => {
    const d = dadosRetrospectiva({
      ...baseRetro(),
      dupla: duplaBase({ encontros: [enc(16)] }),
    });
    expect(d.desbloqueada).toBe(true);
  });
  it("dupla fechada abre sem o 16º", () => {
    const d = dadosRetrospectiva({
      ...baseRetro(),
      dupla: duplaBase({ status: "concluida", encontros: [enc(8)] }),
    });
    expect(d.desbloqueada).toBe(true);
  });
  it("ativa sem o 16º fica fechada", () => {
    const d = dadosRetrospectiva({
      ...baseRetro(),
      dupla: duplaBase({ encontros: [enc(8)] }),
    });
    expect(d.desbloqueada).toBe(false);
  });
  it("trilha especialista abre quando o prazo de 3 meses passou", () => {
    const d = dadosRetrospectiva({
      ...baseRetro(),
      dupla: duplaBase({
        trilha: "especialista",
        iniciada_em: "2026-01-10", // 3 meses já passaram em 2026-07-01
        encontros: [enc(3)],
      }),
    });
    expect(d.desbloqueada).toBe(true);
  });
  it("trilha especialista dentro do prazo segue fechada", () => {
    const d = dadosRetrospectiva({
      ...baseRetro(),
      dupla: duplaBase({
        trilha: "especialista",
        iniciada_em: "2026-06-01",
        encontros: [enc(3)],
      }),
    });
    expect(d.desbloqueada).toBe(false);
  });
});

describe("dadosRetrospectiva — conteúdo e recorte", () => {
  const registroCompleto = {
    tema: "Metas SMART",
    avaliacao: "boa" as const,
    atividades: ["Revisão de metas", "Mapa de submetas"],
    proximo_passo: "continuar" as const,
    reflexoes: "Ela floresceu quando a meta ficou dela.",
    dificuldade: "organizacao" as const,
    observacoes: "Família passando por aperto financeiro.",
    precisa_apoio: true,
  };

  it("timeline completa com trechos internos no recorte mentor/staff", () => {
    const d = dadosRetrospectiva({
      ...baseRetro(),
      dupla: duplaBase({
        status: "concluida",
        encontros: [enc(2), enc(1, registroCompleto)],
      }),
    });
    expect(d.encontros.map((e) => e.numero)).toEqual([1, 2]);
    const rotulos = d.encontros[0].trechos.map((t) => t.rotulo);
    expect(rotulos).toEqual(
      expect.arrayContaining([
        "O que rolou",
        "Próximo passo",
        "Reflexões",
        "Dificuldade",
        "Observações",
        "Apoio",
      ])
    );
  });

  it("comNotasInternas=false não carrega os campos internos", () => {
    const d = dadosRetrospectiva({
      ...baseRetro({ comNotasInternas: false }),
      dupla: duplaBase({
        status: "concluida",
        encontros: [enc(1, registroCompleto)],
      }),
    });
    const rotulos = d.encontros[0].trechos.map((t) => t.rotulo);
    // públicos seguem: atividades e próximo passo não são internos
    expect(rotulos).toContain("O que rolou");
    expect(rotulos).toContain("Próximo passo");
    // internos nunca
    expect(rotulos).not.toContain("Reflexões");
    expect(rotulos).not.toContain("Observações");
    expect(rotulos).not.toContain("Apoio");
    expect(rotulos).not.toContain("Dificuldade");
  });

  it("combinados: ordenação por encontro, e a linha da jovem sem colunas", () => {
    const d = dadosRetrospectiva({
      ...baseRetro(),
      dupla: duplaBase({
        status: "concluida",
        encontros: [enc(16)],
        encaminhamentos: [
          {
            descricao: "Mandar foto da roda",
            responsavel: "mentorado",
            numero: 2,
            prazo: "2026-03-20",
            status: "feito",
            feito_em: "2026-03-18",
            created_at: "2026-03-10T10:00:00-03:00",
          },
          // view jovem_encaminhamentos: sem responsavel/numero/feito_em
          {
            descricao: "Ler o guia do encontro 4",
            prazo: null,
            status: "pendente",
            created_at: "2026-03-11T10:00:00-03:00",
          },
        ],
      }),
    });
    expect(d.combinados).toHaveLength(2);
    expect(d.combinados[0].numero).toBe(2);
    expect(d.combinados[0].feitoEm).toBe("2026-03-18");
    expect(d.combinados[1].responsavel).toBeNull();
    expect(d.combinados[1].numero).toBeNull();
  });

  it("roda: par inicial × formal pelas marcas do contexto", () => {
    const respostasIni = { p_saude: 4, p_equilibrio: 5, pr_carreira: 3 };
    const respostasFor = { p_saude: 7, p_equilibrio: 6, pr_carreira: 7 };
    const d = dadosRetrospectiva({
      ...baseRetro(),
      dupla: duplaBase({ status: "concluida", encontros: [enc(16)] }),
      instrumentos: [
        {
          sistema: "roda_vida",
          campos: CAMPOS_RODA,
          entregas: [
            respondida("2026-03-04T10:00:00-03:00", respostasIni, {
              momento: "inicial",
            }),
            respondida("2026-05-20T10:00:00-03:00", respostasFor, {
              momento: "formal",
            }),
          ],
        },
      ],
    });
    expect(d.roda?.inicial?.respostas).toMatchObject(respostasIni);
    expect(d.roda?.formal?.respostas).toMatchObject(respostasFor);
    // e o parser estrutura a roda do par pro componente
    expect(extraiRodaDaVida(CAMPOS_RODA, d.roda!.formal!.respostas)?.media).toBe(
      6.7
    );
  });

  it("checklist: par início × final com vocabulário próprio", () => {
    const d = dadosRetrospectiva({
      ...baseRetro(),
      dupla: duplaBase({ status: "concluida", encontros: [enc(16)] }),
      instrumentos: [
        {
          sistema: "competencias_mentor",
          campos: [
            {
              id: "comp_1",
              tipo: "select",
              label: "Escutar",
              obrigatorio: true,
              opcoes: ["Já faço bem", "Preciso desenvolver"],
            } as FormularioCampo,
          ],
          entregas: [
            respondida("2026-03-04T10:00:00-03:00", { comp_1: "Preciso desenvolver" }, { momento: "inicio" }),
            respondida("2026-06-20T10:00:00-03:00", { comp_1: "Já faço bem" }, { momento: "final" }),
          ],
        },
      ],
    });
    expect(d.checklist?.inicio?.respostas).toMatchObject({
      comp_1: "Preciso desenvolver",
    });
    expect(d.checklist?.final?.respostas).toMatchObject({
      comp_1: "Já faço bem",
    });
  });

  it("sem instrumentos/PDM degrada pra null — a UI omite os blocos", () => {
    const d = dadosRetrospectiva({
      ...baseRetro(),
      dupla: duplaBase({ status: "concluida", encontros: [enc(16)] }),
    });
    expect(d.desbloqueada).toBe(true);
    expect(d.roda).toBeNull();
    expect(d.checklist).toBeNull();
    expect(d.pdm).toBeNull();
  });

  it("pdm passa direto pro bloco do plano", () => {
    const d = dadosRetrospectiva({
      ...baseRetro({ pdm: PDM }),
      dupla: duplaBase({ status: "concluida", encontros: [enc(16)] }),
    });
    expect(d.pdm?.atingidas).toBe(2);
  });
});

describe("linhaChecklistResumo", () => {
  const aplic = (nBem: number) => ({
    respostas: Object.fromEntries(
      Array.from({ length: 10 }, (_, i) => [
        `comp_${i + 1}`,
        i < nBem ? "Já faço bem" : "Preciso desenvolver",
      ])
    ),
    respondidoEm: "2026-06-20T10:00:00-03:00",
  });
  it("par completo conta o antes × depois", () => {
    expect(
      linhaChecklistResumo({ inicio: aplic(6), final: aplic(9) })
    ).toContain("6 → 9");
  });
  it("marcação única diz que é uma só", () => {
    expect(
      linhaChecklistResumo({ inicio: aplic(6), final: null })
    ).toContain("uma marcação");
  });
  it("sem marcação devolve null", () => {
    expect(linhaChecklistResumo({ inicio: null, final: null })).toBeNull();
  });
});

// ---------- recorte da jovem ----------

describe("dadosRetrospectivaJovem", () => {
  const base = {
    dupla: {
      trilha: "dpp" as const,
      status: "concluida" as const,
      iniciada_em: "2026-03-03",
      encerrada_em: "2026-07-01",
      mentorNome: "Mentor",
    },
    mentoradoNome: "Jovem",
    cronograma: PASSOS.map((p) => ({
      numero: p.numero,
      data: p.data,
      tipo: "encontro",
      fase: null,
      instrumentos: [],
    })),
    encontros: [
      {
        numero: 1,
        status: "realizado",
        data_hora: "2026-03-03T19:00:00-03:00",
        realizado_em: "2026-03-03T19:00:00-03:00",
      },
      {
        numero: 16,
        status: "realizado",
        data_hora: "2026-06-23T19:00:00-03:00",
        realizado_em: "2026-06-23T19:00:00-03:00",
      },
    ],
    temas: [
      { numero: 1, tema: "Boas-vindas" },
      { numero: 16, tema: "Celebração" },
    ],
    combinados: [],
    desbloqueada: true,
    hoje: HOJE,
  };

  it("destrava segue a régua da RPC (flag, não derivação local)", () => {
    const d = dadosRetrospectivaJovem({ ...base, desbloqueada: false });
    expect(d.desbloqueada).toBe(false);
    const d2 = dadosRetrospectivaJovem(base);
    expect(d2.desbloqueada).toBe(true);
  });

  it("timeline: nº/data/tema — sem trechos nem campos internos", () => {
    const d = dadosRetrospectivaJovem(base);
    expect(d.encontros.map((e) => e.numero)).toEqual([1, 16]);
    expect(d.encontros[0].tema).toBe("Boas-vindas");
    expect(d.encontros.every((e) => e.trechos.length === 0)).toBe(true);
  });

  it("o checklist do mentor não chega — nem quando o payload traz o sistema", () => {
    const d = dadosRetrospectivaJovem({
      ...base,
      instrumentos: [
        {
          sistema: "competencias_mentor",
          campos: [],
          entregas: [
            respondida("2026-03-04T10:00:00-03:00", { comp_1: "Já faço bem" }),
          ],
        },
      ],
    });
    expect(d.checklist).toBeNull();
  });
});
