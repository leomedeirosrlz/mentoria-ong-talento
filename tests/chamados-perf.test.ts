// Custo por clique e por ação dos chamados. Supabase fake na fronteira
// (registra cada leitura); o que se prova é o formato do acesso:
//   · o detalhe reaproveita a linha da fila (sem reler chamados_fila/
//     chamados nem re-enriquecer) e só cai na leitura avulsa se a fila não
//     trouxe o id;
//   · nomes já em mãos (equipe, eu, autor) não geram leitura de profiles;
//   · nenhuma leitura usa select("*");
//   · abrirChamado responde antes do e-mail; falha no after() só loga.

import { beforeEach, describe, expect, it, vi } from "vitest";

type Leitura = {
  tabela: string;
  select?: string;
  filtros: [string, string, unknown][];
  single: boolean;
};

const m = vi.hoisted(() => ({
  leituras: [] as Leitura[],
  respostas: {} as Record<string, (l: Leitura) => unknown>,
  rpc: vi.fn(),
  getMe: vi.fn(),
  after: vi.fn(),
  enviarEmailsLote: vi.fn(),
  revalidatePath: vi.fn(),
}));

function from(tabela: string) {
  const l: Leitura = { tabela, filtros: [], single: false };
  m.leituras.push(l);
  const q = {
    select: (s: string) => ((l.select = s), q),
    order: () => q,
    eq: (c: string, v: unknown) => (l.filtros.push(["eq", c, v]), q),
    in: (c: string, v: unknown) => (l.filtros.push(["in", c, v]), q),
    is: () => q,
    maybeSingle: () => ((l.single = true), q),
    single: () => ((l.single = true), q),
    then: (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) =>
      Promise.resolve({
        data: m.respostas[tabela]?.(l) ?? (l.single ? null : []),
        error: null,
      }).then(res, rej),
  };
  return q;
}

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    from,
    rpc: m.rpc,
    auth: {
      getClaims: async () => ({ data: { claims: { sub: "user-1" } } }),
    },
  })),
}));
vi.mock("@/lib/demo/mode", () => ({ demoRole: async () => null }));
vi.mock("@/lib/queries", () => ({ getMe: m.getMe }));
vi.mock("next/server", () => ({ after: m.after }));
vi.mock("next/cache", () => ({ revalidatePath: m.revalidatePath }));
vi.mock("@/lib/email", () => ({
  enviarEmailsLote: m.enviarEmailsLote,
  SITE_URL: "https://exemplo.test",
}));

const { getChamadoDetalhe } = await import("@/lib/queries-chamados");
const { abrirChamado, comentarChamado } = await import(
  "@/lib/actions-chamados"
);

const COORD = { id: "p-coord", role: "coordenacao", nome: "Clara", nome_social: null };
const AUX = { id: "p-aux", role: "supervisor", nome: "Marina", nome_social: null };
const AUTOR = { id: "p-autor", role: "mentor_dpp", nome: "Ricardo", nome_social: null };
const JOVEM = "p-jovem";

const C1 = "11111111-1111-4111-8111-111111111111";
const C2 = "22222222-2222-4222-8222-222222222222";

function linha(id: string, extra: Record<string, unknown> = {}) {
  return {
    id,
    numero: "CHA-1",
    autor_id: AUTOR.id,
    autor_mentorado_id: null,
    dupla_id: null,
    categoria: "agenda",
    descricao_outro: null,
    assunto: "Remarcar",
    mensagem: "Preciso remarcar",
    status: "em_atendimento",
    atribuido_a: AUX.id,
    origem: "manual",
    registro_id: null,
    avaliacao_id: null,
    created_at: "2026-11-01T10:00:00Z",
    updated_at: "2026-11-01T10:00:00Z",
    resolvido_em: null,
    resolvido_por: null,
    resolucao_resumo: null,
    ...extra,
  };
}

const lidas = (tabela: string) => m.leituras.filter((l) => l.tabela === tabela);

beforeEach(() => {
  m.leituras.length = 0;
  m.respostas = {
    chamados_fila: (l) =>
      l.single
        ? l.filtros.some(([, c, v]) => c === "id" && v === C2)
          ? linha(C2)
          : null
        : [linha(C1)],
    profiles: (l) => {
      // equipe (filtro por role) ou nomes (filtro por id)
      if (l.filtros.some(([, c]) => c === "role"))
        return [
          { id: COORD.id, nome: COORD.nome, nome_social: null, role: COORD.role },
          { id: AUX.id, nome: AUX.nome, nome_social: null, role: AUX.role },
        ];
      const ids = (l.filtros.find(([, c]) => c === "id")?.[2] ?? []) as string[];
      const todos = [
        { id: AUTOR.id, nome: AUTOR.nome, nome_social: null, role: AUTOR.role },
        { id: AUX.id, nome: AUX.nome, nome_social: null, role: AUX.role },
        { id: JOVEM, nome: "Ana", nome_social: null, role: "mentorado" },
      ];
      return todos.filter((p) => ids.includes(p.id));
    },
    chamado_atualizacoes: () => [
      { id: "a1", chamado_id: C1, autor_id: AUX.id, tipo: "publica", texto: "Oi", created_at: "2026-11-01T11:00:00Z" },
      { id: "a2", chamado_id: C1, autor_id: AUTOR.id, tipo: "publica", texto: "Ok", created_at: "2026-11-01T12:00:00Z" },
    ],
    chamado_comentarios: () => [
      { id: "c1", chamado_id: C1, autor_id: COORD.id, texto: "interno", created_at: "2026-11-01T11:30:00Z" },
    ],
    chamado_anexos: () => [],
  };
  m.rpc.mockReset();
  m.after.mockReset();
  m.enviarEmailsLote.mockReset();
  m.revalidatePath.mockReset();
});

describe("getChamadoDetalhe — reaproveita a fila", () => {
  it("staff: linha vem da fila, trilha em paralelo, nomes sem releitura", async () => {
    m.getMe.mockResolvedValue(COORD);
    const d = await getChamadoDetalhe(C1);

    expect(d.chamado?.id).toBe(C1);
    expect(d.chamado?.autor_nome).toBe("Ricardo");
    // a fila é a única leitura de chamados_fila — nada de .eq("id") avulso
    expect(lidas("chamados_fila")).toHaveLength(1);
    expect(lidas("chamados_fila")[0].single).toBe(false);
    // profiles: 1 do enriquecimento da fila + 1 da equipe; autores da
    // trilha (aux, autor, coord) já estavam em mãos
    expect(lidas("profiles")).toHaveLength(2);
    expect(d.timeline.map((t) => t.item.autor_nome)).toEqual([
      "Marina",
      "Clara",
      "Ricardo",
    ]);
    expect(d.equipe.map((p) => p.id)).toEqual([COORD.id, AUX.id]);
  });

  it("autor fora dos grupos conhecidos ainda é resolvido numa leitura só", async () => {
    m.getMe.mockResolvedValue(COORD);
    const base = m.respostas.chamado_atualizacoes;
    m.respostas.chamado_atualizacoes = (l) => [
      ...(base(l) as object[]),
      { id: "a3", chamado_id: C1, autor_id: JOVEM, tipo: "publica", texto: "eu", created_at: "2026-11-01T13:00:00Z" },
    ];
    const d = await getChamadoDetalhe(C1);
    const nomes = lidas("profiles").filter((l) =>
      l.filtros.some(([, c, v]) => c === "id" && (v as string[]).includes(JOVEM))
    );
    expect(nomes).toHaveLength(1);
    expect(nomes[0].filtros).toContainEqual(["in", "id", [JOVEM]]);
    expect(d.timeline.at(-1)?.item.autor_nome).toBe("Ana");
  });

  it("id fora da fila cai na leitura avulsa (mesma view, mesmo client)", async () => {
    m.getMe.mockResolvedValue(COORD);
    const d = await getChamadoDetalhe(C2);
    expect(d.chamado?.id).toBe(C2);
    const avulsa = lidas("chamados_fila").filter((l) => l.single);
    expect(avulsa).toHaveLength(1);
    expect(avulsa[0].filtros).toContainEqual(["eq", "id", C2]);
  });

  it("chamado invisível pra RLS: nada da trilha volta", async () => {
    m.getMe.mockResolvedValue(COORD);
    const d = await getChamadoDetalhe("33333333-3333-4333-8333-333333333333");
    expect(d.chamado).toBeNull();
    expect(d.timeline).toEqual([]);
    expect(d.equipe).toEqual([]);
  });

  it("autor: lê a tabela base, sem comentários internos nem equipe", async () => {
    m.getMe.mockResolvedValue(AUTOR);
    m.respostas.chamados = () => [linha(C1)];
    const d = await getChamadoDetalhe(C1);
    expect(d.chamado?.id).toBe(C1);
    expect(lidas("chamados_fila")).toHaveLength(0);
    expect(lidas("chamado_comentarios")).toHaveLength(0);
    expect(lidas("profiles").some((l) => l.filtros.some(([, c]) => c === "role"))).toBe(false);
    expect(d.equipe).toEqual([]);
  });

  it("nenhuma leitura usa select('*')", async () => {
    m.getMe.mockResolvedValue(COORD);
    await getChamadoDetalhe(C2);
    m.getMe.mockResolvedValue(AUTOR);
    m.respostas.chamados = () => [linha(C1)];
    await getChamadoDetalhe(C1);
    for (const l of m.leituras) expect(l.select).not.toBe("*");
  });
});

describe("actions — e-mail depois da resposta e revalidação escopada", () => {
  const input = { categoria: "urgencia", assunto: "Ajuda urgente" };

  beforeEach(() => {
    m.respostas.profiles = () => ({ id: AUTOR.id, role: AUTOR.role, nome: AUTOR.nome });
    m.rpc.mockImplementation(async (nome: string) =>
      nome === "abrir_chamado"
        ? {
            data: { id: C1, numero: "CHA-9", destinatarios: [{ email: "coord@x.test" }] },
            error: null,
          }
        : { data: null, error: null }
    );
  });

  it("abrirChamado responde sem esperar o Resend nem o log", async () => {
    const r = await abrirChamado(input);
    expect(r).toMatchObject({ ok: true, id: C1, numero: "CHA-9" });
    expect(m.enviarEmailsLote).not.toHaveBeenCalled();
    expect(m.rpc).toHaveBeenCalledTimes(1);
    expect(m.after).toHaveBeenCalledTimes(1);

    m.enviarEmailsLote.mockResolvedValue({ enviados: 1, falhas: [] });
    await m.after.mock.calls[0][0]();
    expect(m.enviarEmailsLote).toHaveBeenCalledWith(
      expect.objectContaining({ para: ["coord@x.test"] })
    );
    expect(m.rpc).toHaveBeenLastCalledWith(
      "registrar_email_chamado",
      expect.objectContaining({ p_chamado_id: C1, p_enviados: 1 })
    );
  });

  it("falha no envio pós-resposta só loga", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    await abrirChamado(input);
    m.enviarEmailsLote.mockRejectedValue(new Error("resend fora"));
    await expect(m.after.mock.calls[0][0]()).resolves.toBeUndefined();
    expect(log).toHaveBeenCalled();
    log.mockRestore();
  });

  it("revalida só as telas com chamado; /jovem/perfil só pro jovem", async () => {
    await abrirChamado(input);
    expect(m.revalidatePath.mock.calls.map((c) => c[0]).sort()).toEqual([
      "/",
      "/chamados",
    ]);
  });

  it("comentário interno não invalida a home", async () => {
    m.respostas.profiles = () => ({ id: COORD.id, role: COORD.role, nome: COORD.nome });
    await comentarChamado(C1, "olha isso");
    expect(m.revalidatePath.mock.calls.map((c) => c[0])).toEqual(["/chamados"]);
  });
});
