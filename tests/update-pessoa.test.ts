// updatePessoa — fronteiras mockadas na borda do módulo (createClient do
// servidor, depoisDe/ia, e-mail, demo). O que se prova aqui:
//   · dados_civis vem SÓ do bloco `civis_` (parser canônico do cadastro e
//     do mentorado) — o prefixo `civ_` da etapa duplicada foi removido e
//     um valor velho nele não pode mais sobrescrever a edição
//     (REALIZA-374: o spread ...ficha, ...civis mandava o FormData com os
//     dois blocos e o `civ_` parado ganhava do `civis_` editado);
//   · campos autodeclarados ausentes no FormData não são zerados no patch
//     (REALIZA-370: bio/interesses/motivação & cia saíram da edição da
//     coordenação — camposApresentacao/camposMentor/camposFicha são
//     parciais nessa action).

import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  getClaims: vi.fn(),
  from: vi.fn(),
  rpc: vi.fn(),
  updates: [] as { table: string; payload: Record<string, unknown> }[],
  upserts: [] as { table: string; payload: Record<string, unknown> }[],
  depoisDe: vi.fn(),
  revalidatePath: vi.fn(),
  updateTag: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: m.revalidatePath,
  updateTag: m.updateTag,
}));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getClaims: m.getClaims },
    from: m.from,
    rpc: m.rpc,
    storage: { from: () => ({ upload: vi.fn() }) },
  }),
}));
vi.mock("@/lib/demo/mode", () => ({
  demoAtivo: async () => false,
  demoLidas: async () => [],
  demoRole: async () => null,
  limparDemo: vi.fn(),
  marcarDemoLidas: vi.fn(),
  marcarOnboardingDemo: vi.fn(),
}));
vi.mock("@/lib/demo/data", () => ({ getDemoData: vi.fn(() => null) }));
vi.mock("@/lib/demo/queries", () => ({ demoNotificacoes: vi.fn(() => []) }));
vi.mock("@/lib/ia/matching", () => ({
  depoisDe: m.depoisDe,
  removerMatchingPerfil: vi.fn(),
  sincronizarMatchingPerfilMentorado: vi.fn(),
  sincronizarMatchingPerfilPessoa: vi.fn(),
}));
vi.mock("@/lib/notificar", () => ({ notificar: vi.fn() }));
vi.mock("@/lib/actions-email", () => ({
  dispararComunicadoEmail: vi.fn(),
  dispararMaterialEmail: vi.fn(),
}));
vi.mock("@/lib/email", () => ({ ROLES_POR_AUDIENCIA: {} }));
vi.mock("@/lib/jobs", () => ({ snapshotDuplaHoje: vi.fn() }));

const { updatePessoa } = await import("@/lib/actions");

const EU_COORD = {
  id: "eu-1",
  role: "coordenacao",
  nome: "Clara Coord",
  consent_lgpd_em: null,
  profile_papeis: [{ papel: "coordenacao" }],
};
const PROFILE_ID = "11111111-2222-3333-4444-555555555555";

type Estado = { alvo?: Record<string, unknown> };

/** Fake do PostgREST: profiles por eq(user_id) → eu, eq(id) → alvo;
 *  update/upsert registram o payload enviado. */
function supabaseDe(e: Estado) {
  m.updates.length = 0;
  m.upserts.length = 0;
  m.from.mockImplementation((table: string) => {
    const eqs: [string, unknown][] = [];
    const b: Record<string, unknown> = {};
    b.select = () => b;
    b.eq = (c: string, v: unknown) => (eqs.push([c, v]), b);
    b.order = () => b;
    b.in = () => b;
    b.is = () => b;
    b.maybeSingle = b.single = async () => {
      if (table === "profiles" && eqs[0]?.[0] === "user_id") {
        return { data: EU_COORD, error: null };
      }
      if (table === "profiles") return { data: e.alvo ?? null, error: null };
      return { data: null, error: null };
    };
    b.update = (p: Record<string, unknown>) => {
      m.updates.push({ table, payload: p });
      return b;
    };
    b.upsert = (p: Record<string, unknown>) => {
      m.upserts.push({ table, payload: p });
      return b;
    };
    b.insert = () => b;
    b.delete = () => b;
    // update().eq().select("id") e insert() resolvem com a linha
    b.then = (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) =>
      Promise.resolve({ data: [{ id: PROFILE_ID }], error: null }).then(res, rej);
    return b;
  });
}

function fichaBase(extra: Record<string, string> = {}): FormData {
  const fd = new FormData();
  fd.set("nome", "Marina Duarte");
  fd.set("nome_social", "");
  fd.set("whatsapp", "(11) 99999-9999");
  fd.set("email", "marina@exemplo.org");
  fd.set("data_nascimento", "1990-05-10");
  fd.set("genero", "__nenhum");
  fd.set("cor_raca", "__nenhum");
  fd.set("cidade", "Campinas");
  fd.set("uf", "SP");
  for (const [k, v] of Object.entries(extra)) fd.set(k, v);
  return fd;
}

beforeEach(() => {
  vi.resetAllMocks();
  m.getClaims.mockResolvedValue({ data: { claims: { sub: "user-eu" } } });
  supabaseDe({
    alvo: {
      user_id: null,
      role: "coordenacao",
      email: "marina@exemplo.org",
      dados_civis: null,
      consent_lgpd_em: null,
      profile_papeis: [{ papel: "coordenacao" }],
    },
  });
});

describe("updatePessoa — dados civis (REALIZA-374)", () => {
  const civisNovos = {
    civis_rg: "98.765.432-1",
    civis_cpf: "111.444.777-35",
    civis_cep: "13010-100",
    civis_logradouro: "Rua Nova",
    civis_numero: "123",
    civis_complemento: "",
    civis_bairro: "Centro",
  };

  it("grava dados_civis a partir do bloco civis_ (deFicha junta nome/nascimento/cidade/UF)", async () => {
    const res = await updatePessoa(PROFILE_ID, fichaBase(civisNovos));

    expect(res).toEqual({ ok: true, aviso: undefined });
    const patch = m.updates.find((u) => u.table === "profiles")?.payload;
    expect(patch?.dados_civis).toEqual({
      nome_civil: "Marina Duarte",
      data_nascimento: "1990-05-10",
      rg: "98.765.432-1",
      cpf: "11144477735",
      endereco: {
        logradouro: "Rua Nova",
        numero: "123",
        complemento: null,
        bairro: "Centro",
        cidade: "Campinas",
        uf: "SP",
        cep: "13010100",
      },
    });
  });

  it("o prefixo morto civ_ não sobrescreve nem produz dados_civis", async () => {
    // réplica do FormData do wizard quebrado: as duas cópias montadas, a
    // `civ_` parada com valores velhos e a `civis_` com a edição nova —
    // antes do fix o spread ...civis ganhava e a edição era perdida
    const fd = fichaBase({
      civ_rg: "RG VELHO",
      civ_cpf: "529.982.247-25",
      civ_logradouro: "Rua Velha",
      civ_cep: "01001-000",
      ...civisNovos,
    });

    const res = await updatePessoa(PROFILE_ID, fd);

    expect(res).toEqual({ ok: true, aviso: undefined });
    const patch = m.updates.find((u) => u.table === "profiles")?.payload;
    expect(patch?.dados_civis).toMatchObject({
      rg: "98.765.432-1",
      cpf: "11144477735",
      endereco: { logradouro: "Rua Nova", cep: "13010100" },
    });
  });

  it("só civ_ (client velho) não toca no jsonb — chave ausente preserva", async () => {
    const fd = fichaBase({
      civ_rg: "RG VELHO",
      civ_cpf: "529.982.247-25",
      civ_logradouro: "Rua Velha",
    });

    const res = await updatePessoa(PROFILE_ID, fd);

    expect(res).toEqual({ ok: true, aviso: undefined });
    const patch = m.updates.find((u) => u.table === "profiles")?.payload;
    expect(patch && "dados_civis" in patch).toBe(false);
  });
});

describe("updatePessoa — patch parcial (REALIZA-370)", () => {
  it("campos autodeclarados ausentes no FormData não viram null no patch", async () => {
    // o dialog novo não renderiza bio/linkedin/areas_perfil/voluntariado/
    // interesses/motivação/cargo/empresa/origem — o save não pode zerá-los
    const res = await updatePessoa(PROFILE_ID, fichaBase());

    expect(res).toEqual({ ok: true, aviso: undefined });
    const patch = m.updates.find((u) => u.table === "profiles")?.payload;
    for (const k of [
      "bio",
      "linkedin",
      "areas",
      "voluntariado",
      "interesses",
      "motivacao",
      "cargo",
      "empresa",
      "origem",
      "pref_genero_par",
      "dados_civis",
    ]) {
      expect(patch && k in patch, `patch não pode trazer "${k}"`).toBe(false);
    }
  });

  it("mentor: upsert não zera experiencia_previa/formacao_externa ausentes", async () => {
    supabaseDe({
      alvo: {
        user_id: null,
        role: "mentor_dpp",
        email: "marina@exemplo.org",
        dados_civis: null,
        consent_lgpd_em: null,
        profile_papeis: [{ papel: "mentor_dpp" }],
      },
    });
    // sem capacidade_esp — o form só o renderiza pra híbrido
    const fd = fichaBase({
      capacidade: "3",
      areas: "tecnologia, finanças",
      disponibilidade: '{"celulas":[{"dia":"seg","periodo":"manha"}]}',
      pref_genero_par: "feminino",
      decl_voluntario: "1",
      voluntario: "on",
    });

    const res = await updatePessoa(PROFILE_ID, fd);

    expect(res).toEqual({ ok: true, aviso: undefined });
    const up = m.upserts.find((u) => u.table === "mentor_profiles")?.payload;
    expect(up).toMatchObject({
      profile_id: PROFILE_ID,
      capacidade: 3,
      areas: ["tecnologia", "finanças"],
      disponibilidade: { celulas: [{ dia: "seg", periodo: "manha" }] },
      termo_ok: false,
      formacao_ok: false,
    });
    expect(up && "experiencia_previa" in up).toBe(false);
    expect(up && "formacao_externa" in up).toBe(false);
    // pref_genero_par (profiles, pareamento) segue gravável pela coord
    const patch = m.updates.find((u) => u.table === "profiles")?.payload;
    expect(patch?.pref_genero_par).toBe("feminino");
    expect(patch?.voluntario).toBe(true);
  });
});
