// Rota /api/export — o contrato CSV (BOM, `;`, CRLF, aspas, anti-formula)
// e os tipos da REALIZA-68 provados pela RESPOSTA da rota: route.ts não
// exporta helpers (o Next só aceita verbos), então o teste entra pelo GET
// com a fronteira mockada — createClient devolve um supabase fake cujo
// `from` serve linhas por tabela (a RLS não roda aqui; o que se prova é a
// montagem do CSV, o dispatch e o gate coord-only). O ramo demo é exercido
// com demoRole + getDemoData stubados.

import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "@/app/api/export/route";

const m = vi.hoisted(() => ({
  demoRole: vi.fn(),
  getClaims: vi.fn(),
  from: vi.fn(),
  getDemoData: vi.fn(),
  demoPessoalMap: vi.fn(),
  getDemoFormularios: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    auth: { getClaims: m.getClaims },
    from: m.from,
    rpc: vi.fn(async () => ({ data: null, error: null })),
  })),
}));
vi.mock("@/lib/demo/mode", () => ({ demoRole: m.demoRole }));
vi.mock("@/lib/demo/data", () => ({ getDemoData: m.getDemoData }));
vi.mock("@/lib/demo/queries", () => ({ demoPessoalMap: m.demoPessoalMap }));
vi.mock("@/lib/demo/forms-data", () => ({
  getDemoFormularios: m.getDemoFormularios,
}));

beforeEach(() => {
  vi.resetAllMocks();
  m.demoRole.mockResolvedValue(null);
  m.getClaims.mockResolvedValue({
    data: { claims: { sub: "auth-1" } },
    error: null,
  });
  m.demoPessoalMap.mockReturnValue(new Map());
});

/** `from` chainable: as linhas da tabela voltam prontas em qualquer select
 *  (a RLS real não roda — o gate da rota lê profiles[0] via maybeSingle). */
function supaFake(tabelas: Record<string, unknown[]> = {}) {
  const builder = (tabela: string) => {
    const rows = () => tabelas[tabela] ?? [];
    const b: Record<string, unknown> = {
      select: () => b,
      eq: () => b,
      in: () => b,
      gte: () => b,
      lte: () => b,
      order: () => b,
      limit: () => b,
      maybeSingle: () =>
        Promise.resolve({ data: rows()[0] ?? null, error: null }),
      then: (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) =>
        Promise.resolve({ data: rows(), error: null }).then(res, rej),
    };
    return b;
  };
  m.from.mockImplementation((t: string) => builder(t));
}

const req = (query: string) =>
  new NextRequest(`http://app.test/api/export?${query}`);

const linhasDe = (csv: string) =>
  csv.replace(/^\uFEFF/, "").split("\r\n").filter(Boolean);

/** Response.text() faz UTF-8 decode e ENGOLA o BOM — a prova do \uFEFF é
 *  nos bytes crus da resposta, não no texto. */
async function temBom(res: Response) {
  const bytes = new Uint8Array(await res.arrayBuffer());
  return [...bytes.slice(0, 3)].join(",") === "239,187,191";
}

/** Linha CSV montada no formato da rota: toda célula entre aspas, `""`
 *  escapando aspas internas — a comparação é byte a byte, não por parse. */

const joinCsv = (cells: string[]) =>
  cells.map((c) => `"${c.replace(/"/g, '""')}"`).join(";");

// ---------- fixtures ----------

const CRON = { id: "cron-t1", nome: "Calendário oficial", turma: "T1 · 2026/2027" };

const P_COORD = {
  id: "p-coord",
  nome: "Coord",
  role: "coordenacao",
  ativo: true,
  cidade: null,
  uf: null,
  profile_papeis: [{ papel: "coordenacao" }],
};

const P_HIBRIDO = {
  id: "p-hib",
  nome: "Ana Híbrida",
  role: "mentor_dpp",
  ativo: true,
  cidade: "São Paulo",
  uf: "SP",
  profile_papeis: [{ papel: "mentor_dpp" }, { papel: "mentor_especialista" }],
};

const M_JOAO = {
  id: "m-joao",
  nome: "João Jovem",
  email: "joao@teste.dev",
  whatsapp: null,
  cidade: "São Paulo",
  uf: "SP",
  disponibilidade: { celulas: [{ dia: "seg", periodo: "noite" }] },
  situacao: "ativo",
};

const DUPLA_ATIVIDADES = {
  trilha: "dpp",
  turma: "T1 · 2026/2027",
  cronograma_id: "cron-t1",
  mentor: { nome: "Ana Híbrida" },
  mentorado: { nome: "João Jovem" },
  supervisor: null,
  encontros: [
    {
      numero: 1,
      realizado_em: "2025-10-08T20:00:00-03:00",
      status: "realizado",
      registro: {
        // catálogo + texto livre — o "outro" mora no mesmo array
        // (actions.ts empurra atividade_outro pra cá); o "=cmd" prova a
        // sanitização anti-fórmula na célula livre
        atividades: ["Conversa de acompanhamento", "Leitura", "=cmd"],
        avaliacao: "boa",
        created_at: "2025-10-08T22:00:00-03:00",
      },
    },
    // encontro realizado SEM registro → zero linhas de atividade
    {
      numero: 2,
      realizado_em: "2025-10-15T20:00:00-03:00",
      status: "realizado",
      registro: null,
    },
  ],
};

describe("gate coord-only", () => {
  it("papel não-coord devolve 403 sem tocar em tabela de dado", async () => {
    supaFake({ profiles: [{ id: "p-1", role: "mentor_dpp" }] });
    const res = await GET(req("tipo=matching"));
    expect(res.status).toBe(403);
    expect(m.from).not.toHaveBeenCalledWith("duplas");
  });

  it("demo com papel não-coord devolve 403", async () => {
    m.demoRole.mockResolvedValue("mentor_dpp");
    m.getDemoData.mockReturnValue({});
    const res = await GET(req("tipo=presencas"));
    expect(res.status).toBe(403);
  });
});

describe("encontros — alias puro de ciclo", () => {
  it("devolve byte a byte o mesmo CSV de tipo=ciclo (ramo real)", async () => {
    supaFake({ profiles: [P_COORD], duplas: [DUPLA_ATIVIDADES], cronogramas: [CRON] });
    const ra = await GET(req("tipo=encontros"));
    const rb = await GET(req("tipo=ciclo"));
    // byte a byte de verdade — arrayBuffer não descarta o BOM
    expect(await ra.arrayBuffer()).toEqual(await rb.arrayBuffer());
    // re-GET porque o body já foi consumido — o BOM sai nos bytes crus
    expect(await temBom(await GET(req("tipo=encontros")))).toBe(true);
  });

  it("idem no ramo demo — a normalização corre antes dos dois dispatch", async () => {
    m.demoRole.mockResolvedValue("coordenacao");
    m.getDemoData.mockReturnValue({
      duplas: [DUPLA_ATIVIDADES],
      cronogramas: [CRON],
    });
    const a = await (await GET(req("tipo=encontros"))).text();
    const b = await (await GET(req("tipo=ciclo"))).text();
    expect(a).toBe(b);
  });
});

describe("tipo=atividades", () => {
  it("explode atividades[] por registro com origem catalogo/outro", async () => {
    supaFake({ profiles: [P_COORD], duplas: [DUPLA_ATIVIDADES], cronogramas: [CRON] });
    const res = await GET(req("tipo=atividades"));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/csv");
    const csv = await res.text();
    expect(await temBom(await GET(req("tipo=atividades")))).toBe(true);
    const linhas = linhasDe(csv);
    expect(linhas[0]).toBe(
      "turma;cronograma;trilha;dupla_mentor;dupla_mentorado;encontro_num;realizado_em;atividade;origem;registro_avaliacao"
    );
    // 3 atividades do registro — o encontro 2 (sem registro) não gera linha
    const base = ["T1 · 2026/2027", "Calendário oficial", "DPP", "Ana Híbrida", "João Jovem", "1", "08/10/2025"];
    expect(linhas).toEqual([
      linhas[0],
      joinCsv([...base, "Conversa de acompanhamento", "catalogo", "Boa"]),
      joinCsv([...base, "Leitura", "outro", "Boa"]),
      // celula() prefixa `'` antes do `=` — a planilha não executa
      joinCsv([...base, "'=cmd", "outro", "Boa"]),
    ]);
  });

  it("?turma= recorta a dupla — sem ela sobra só o header", async () => {
    supaFake({ profiles: [P_COORD], duplas: [DUPLA_ATIVIDADES], cronogramas: [CRON] });
    const csv = await (
      await GET(req(`tipo=atividades&turma=${encodeURIComponent("Outra turma")}`))
    ).text();
    expect(linhasDe(csv)).toHaveLength(1);
    const cheio = await (
      await GET(req(`tipo=atividades&turma=${encodeURIComponent("T1 · 2026/2027")}`))
    ).text();
    expect(linhasDe(cheio)).toHaveLength(4);
  });

  it("ramo demo devolve o mesmo CSV (dataset cobre registro)", async () => {
    m.demoRole.mockResolvedValue("coordenacao");
    m.getDemoData.mockReturnValue({
      duplas: [DUPLA_ATIVIDADES],
      cronogramas: [CRON],
    });
    const res = await GET(req("tipo=atividades"));
    expect(res.status).toBe(200);
    expect(linhasDe(await res.text())).toHaveLength(4);
  });
});

describe("tipo=matching", () => {
  const tabelas = {
    profiles: [P_COORD, P_HIBRIDO],
    profiles_contato: [
      { id: "p-hib", email: "ana@teste.dev", whatsapp: "11999990000" },
    ],
    mentorados: [M_JOAO],
    mentor_profiles: [
      {
        profile_id: "p-hib",
        capacidade: 2,
        capacidade_especialista: 3,
        experiencia_previa: "ONG X",
        formacao_externa: "Curso Y",
        disponibilidade: {
          celulas: [
            { dia: "seg", periodo: "noite" },
            { dia: "ter", periodo: "manha" },
          ],
        },
      },
    ],
    profiles_pessoal: [
      { id: "p-hib", pref_genero_par: "feminino", motivacao: "quero ajudar" },
    ],
    mentorados_pessoal: [{ id: "m-joao", pref_genero_par: null, motivacao: "aprender" }],
    turma_inscricoes: [
      { profile_id: "p-hib", mentorado_id: null, turma: "T1 · 2026/2027" },
      { profile_id: "p-hib", mentorado_id: null, turma: "T3" },
      { profile_id: null, mentorado_id: "m-joao", turma: "T1 · 2026/2027" },
    ],
    duplas: [{ mentor_id: "p-hib", mentorado_id: "m-joao" }],
  };

  it("híbrido: trilhas/capacidades das duas pools, em_dupla e fila_turmas", async () => {
    supaFake(tabelas);
    const res = await GET(req("tipo=matching"));
    const csv = await res.text();
    const linhas = linhasDe(csv);
    expect(linhas[0]).toBe(
      "nome;tipo_pessoa;trilhas;email;whatsapp;cidade_uf;capacidade_dpp;capacidade_esp;experiencia_previa;formacao_externa;disponibilidade;pref_genero_par;motivacao;em_dupla;fila_turmas"
    );
    // Ana antes de João (ordenação por nome) — a coord sai do recorte por
    // não ter papel de mentoria
    expect(linhas).toEqual([
      linhas[0],
      joinCsv([
        "Ana Híbrida",
        "Mentor DPP + Mentor especialista",
        "DPP + Especialista",
        "ana@teste.dev",
        "11999990000",
        "São Paulo/SP",
        "2",
        "3",
        "ONG X",
        "Curso Y",
        "seg noite | ter manhã",
        "Feminino",
        "quero ajudar",
        "sim",
        "T1 · 2026/2027 | T3",
      ]),
      joinCsv([
        "João Jovem",
        "Mentorado",
        "",
        "joao@teste.dev",
        "",
        "São Paulo/SP",
        "",
        "",
        "",
        "",
        "seg noite",
        "",
        "aprender",
        "sim",
        "T1 · 2026/2027",
      ]),
    ]);
  });

  it("?turma= filtra por inscrição na fila — efeito recorte+preenche", async () => {
    supaFake(tabelas);
    // a turma T3 só inscreve o híbrido — o mentorado fica de fora
    const csv = await (
      await GET(req(`tipo=matching&turma=${encodeURIComponent("T3")}`))
    ).text();
    const linhas = linhasDe(csv);
    expect(linhas).toHaveLength(2);
    expect(linhas[1]).toContain("Ana Híbrida");
    // turma sem inscritos → header-only, ainda CSV válido
    const vazio = await (
      await GET(req(`tipo=matching&turma=${encodeURIComponent("Sem fila")}`))
    ).text();
    expect(linhasDe(vazio)).toHaveLength(1);
  });

  it("ramo demo monta as mesmas colunas do dataset", async () => {
    m.demoRole.mockResolvedValue("coordenacao");
    m.getDemoData.mockReturnValue({
      profiles: [P_HIBRIDO],
      mentorados: [M_JOAO],
      mentorProfiles: tabelas.mentor_profiles,
      profilePapeis: P_HIBRIDO.profile_papeis.map((p) => ({
        profile_id: "p-hib",
        ...p,
      })),
      turmaInscricoes: tabelas.turma_inscricoes,
      duplas: [
        {
          status: "ativa",
          mentor: { id: "p-hib" },
          mentorado: { id: "m-joao" },
        },
      ],
      cronogramas: [CRON],
    });
    const csv = await (await GET(req("tipo=matching"))).text();
    const linhas = linhasDe(csv);
    expect(linhas).toHaveLength(3);
    expect(linhas[1]).toContain("DPP + Especialista");
    expect(linhas[1]).toContain("T1 · 2026/2027 | T3");
  });
});

describe("tipo=presencas", () => {
  const EV1 = {
    id: "ev-f1",
    titulo: "Formação dia 1",
    data: "2025-09-03",
    cronograma_id: "cron-t1",
    presencas: [
      {
        profile_id: "p-hib",
        presente: false,
        marcado_em: "2025-09-03T20:30:00-03:00",
      },
      {
        profile_id: "p-coord",
        presente: true,
        marcado_em: "2025-09-03T20:30:00-03:00",
      },
    ],
  };
  // evento sem chamada — não sintetiza "faltou"
  const EV2 = {
    id: "ev-f2",
    titulo: "Formação dia 2",
    data: "2025-09-04",
    cronograma_id: "cron-t1",
    presencas: [],
  };
  const tabelas = {
    profiles: [P_COORD, P_HIBRIDO],
    ciclo_eventos: [EV1, EV2],
    cronogramas: [CRON],
    mentor_profiles: [{ profile_id: "p-hib", formacao_ok: false }],
  };

  it("grão (evento × marcado); formacao_ok só pra mentor", async () => {
    supaFake(tabelas);
    const res = await GET(req("tipo=presencas"));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/csv");
    const linhas = linhasDe(await res.text());
    expect(linhas[0]).toBe(
      "evento;data;turma;cronograma;nome;papel;presente;marcado_em;formacao_ok"
    );
    // Ana antes de Coord (data × evento × nome); dia 2 sem marcas → 0 linhas
    expect(linhas).toEqual([
      linhas[0],
      joinCsv([
        "Formação dia 1",
        "03/09/2025",
        "T1 · 2026/2027",
        "Calendário oficial",
        "Ana Híbrida",
        "Mentor DPP",
        "não",
        "03/09/2025 20:30",
        "não",
      ]),
      joinCsv([
        "Formação dia 1",
        "03/09/2025",
        "T1 · 2026/2027",
        "Calendário oficial",
        "Coord",
        "Coordenação",
        "sim",
        "03/09/2025 20:30",
        "", // coord não tem mentor_profiles → célula vazia
      ]),
    ]);
  });

  it("?turma=/?cronograma= casam pelo cronograma do evento", async () => {
    supaFake(tabelas);
    const ok = await (
      await GET(req(`tipo=presencas&turma=${encodeURIComponent("T1 · 2026/2027")}`))
    ).text();
    expect(linhasDe(ok)).toHaveLength(3);
    const outra = await (
      await GET(req(`tipo=presencas&turma=${encodeURIComponent("T9")}`))
    ).text();
    expect(linhasDe(outra)).toHaveLength(1);
    const cron = await (
      await GET(req("tipo=presencas&cronograma=cron-t1"))
    ).text();
    expect(linhasDe(cron)).toHaveLength(3);
  });

  it("ramo demo agrupa as presencas por evento", async () => {
    m.demoRole.mockResolvedValue("coordenacao");
    m.getDemoData.mockReturnValue({
      cicloEventos: [
        { ...EV1, tipo: "formacao" },
        { ...EV2, tipo: "formacao" },
      ],
      presencas: EV1.presencas.map((p, i) => ({
        id: `pr-${i}`,
        ciclo_evento_id: "ev-f1",
        ...p,
      })),
      profiles: [P_COORD, P_HIBRIDO],
      mentorProfiles: tabelas.mentor_profiles,
      cronogramas: [CRON],
    });
    const csv = await (await GET(req("tipo=presencas"))).text();
    expect(linhasDe(csv)).toHaveLength(3);
  });
});
