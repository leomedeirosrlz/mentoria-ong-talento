// Fase 0 da camada de IA — o registry é a fronteira: zod valida args, o
// gate de papel corre ANTES da leitura, a allowlist é construção (o que não
// passa no select não existe pra tool) e toda chamada grava ia_eventos.
// O supabase fake é chainable no mínimo que as queries usam — as linhas
// voltam prontas (a RLS real não roda aqui; o que se testa é a tool).

import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  executarTool,
  IA_TOOLS,
  IA_TOOL_CATALOGO,
  IA_TOOL_NOMES,
} from "@/lib/ia/tools";
import { IA_REGISTRO_SELECT, IA_SAUDE_SELECT } from "@/lib/ia/queries";
import {
  CICLO_16,
  encRealizado,
  mkDupla,
  mkEncaminhamento,
} from "./helpers";

// uuid v4 + variante 8 — z.uuid() do zod 4 exige o formato RFC (versão no
// 3º grupo, variante no 4º), igual aos gen_random_uuid() do banco
const UUID = "11111111-2222-4333-8444-555555555555";

type Opts = {
  papel?: string | null;
  tabelas?: Record<string, unknown[]>;
  rpcData?: Record<string, unknown>;
  rpcErro?: Record<string, { message: string }>;
};

function supaFake({
  papel = "coordenacao",
  tabelas = {},
  rpcData = {},
  rpcErro = {},
}: Opts = {}) {
  const auditCalls: Record<string, unknown>[] = [];
  const fromCalls: string[] = [];
  // o rpc do supabase-js é lazy: chamar sem await nunca chega no PostgREST.
  // O flag vira só quando o retorno é awaited — prova de que executarTool
  // espera a auditoria, não só dispara.
  let auditAwaited = false;

  const builder = (tabela: string) => {
    const rows = () => tabelas[tabela] ?? [];
    const b: Record<string, unknown> = {
      select: () => b,
      in: () => b,
      eq: () => b,
      gte: () => b,
      lte: () => b,
      order: () => b,
      limit: () => b,
      maybeSingle: () =>
        Promise.resolve({ data: rows()[0] ?? null, error: null }),
      then: (
        res: (v: unknown) => unknown,
        rej?: (e: unknown) => unknown
      ) => Promise.resolve({ data: rows(), error: null }).then(res, rej),
    };
    return b;
  };

  const supabase = {
    from: (tabela: string) => {
      fromCalls.push(tabela);
      return builder(tabela);
    },
    rpc: (nome: string, args?: Record<string, unknown>) => {
      // o gate virou my_papeis (0085) — o papel do fixture volta como o
      // conjunto efetivo de 1 elemento
      if (nome === "my_papeis")
        return { data: papel ? [papel] : [], error: null };
      if (nome === "registrar_ia_evento") {
        auditCalls.push(args ?? {});
        const erro = rpcErro[nome] ?? null;
        return {
          error: erro,
          then(res: (v: unknown) => unknown) {
            auditAwaited = true;
            return Promise.resolve(res({ error: erro }));
          },
        };
      }
      return { data: rpcData[nome] ?? null, error: rpcErro[nome] ?? null };
    },
  };
  return {
    supabase: supabase as unknown as SupabaseClient,
    auditCalls,
    fromCalls,
    auditAwaited: () => auditAwaited,
  };
}

const dadosDe = (r: Awaited<ReturnType<typeof executarTool>>) => {
  if (!r.ok) throw new Error(`esperava ok, veio erro: ${r.erro}`);
  return r.dados as Record<string, unknown>;
};

describe("registry", () => {
  it("declara as 8 tools da fase 1 com descrição pt-BR e papéis", () => {
    expect(IA_TOOL_NOMES.sort()).toEqual(
      [
        "agenda_do_periodo",
        "aguardando_par",
        "capacidade_mentores",
        "duplas_do_usuario",
        "ficha_dupla",
        "instrumentos_da_dupla",
        "registros_da_dupla",
        "resumo_semana",
      ].sort()
    );
    for (const t of IA_TOOL_CATALOGO) {
      expect(t.descricao.length).toBeGreaterThan(20);
      expect(t.roles.length).toBeGreaterThan(0);
      expect(t.schema).toBeTruthy();
    }
    // aguardando_par e capacidade_mentores são coord-only por desenho
    expect(IA_TOOLS.aguardando_par.roles).toEqual(["coordenacao"]);
    expect(IA_TOOLS.capacidade_mentores.roles).toEqual(["coordenacao"]);
    // resumo_semana: coord + auxiliar executivo (supervisor)
    expect(IA_TOOLS.resumo_semana.roles).toEqual([
      "coordenacao",
      "supervisor",
    ]);
    // jovem nunca lê follow-up estruturado do mentor
    expect(IA_TOOLS.registros_da_dupla.roles).not.toContain("mentorado");
    // o índice de duplas e a agenda ignoram mentorado: sem grant em
    // `duplas` (a ficha dele vem da view) e uma só dupla não pede índice
    expect(IA_TOOLS.duplas_do_usuario.roles).not.toContain("mentorado");
    expect(IA_TOOLS.agenda_do_periodo.roles).not.toContain("mentorado");
  });
});

describe("executarTool — validação zod", () => {
  it("rejeita uuid malformado antes de ler nada (e audita a falha)", async () => {
    const { supabase, auditCalls, fromCalls, auditAwaited } = supaFake();
    const r = await executarTool(
      "ficha_dupla",
      { dupla_id: "isso-não-é-uuid" },
      supabase,
      "chat"
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.erro).toContain("dupla_id");
    expect(fromCalls).toHaveLength(0);
    expect(auditCalls).toHaveLength(1);
    expect(auditCalls[0]).toMatchObject({
      p_canal: "chat",
      p_tool: "ficha_dupla",
      p_ok: false,
    });
    expect(auditAwaited()).toBe(true);
  });

  it("rejeita limite fora da faixa e campos fora do schema", async () => {
    const { supabase } = supaFake();
    const r1 = await executarTool(
      "registros_da_dupla",
      { dupla_id: UUID, limite: 0 },
      supabase,
      "chat"
    );
    expect(r1.ok).toBe(false);
    const r2 = await executarTool(
      "ficha_dupla",
      { dupla_id: UUID, include: "tudo" },
      supabase,
      "chat"
    );
    expect(r2.ok).toBe(false);
  });

  it("tool inexistente também falha e vai pro log", async () => {
    const { supabase, auditCalls } = supaFake();
    const r = await executarTool("drop_tables", {}, supabase, "chat");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.erro).toContain("drop_tables");
    expect(auditCalls[0].p_ok).toBe(false);
  });
});

describe("executarTool — gate de papel", () => {
  it("mentor não chama aguardando_par — a tool nem chega a ler", async () => {
    const { supabase, fromCalls, auditCalls } = supaFake({
      papel: "mentor_dpp",
    });
    const r = await executarTool("aguardando_par", {}, supabase, "chat");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.erro).toContain("papel");
    expect(fromCalls).toHaveLength(0);
    expect(auditCalls[0].p_ok).toBe(false);
  });

  it("supervisor não chama capacidade_mentores; jovem não chama registros", async () => {
    const a = supaFake({ papel: "supervisor" });
    const r1 = await executarTool(
      "capacidade_mentores",
      {},
      a.supabase,
      "chat"
    );
    expect(r1.ok).toBe(false);
    expect(a.fromCalls).toHaveLength(0);

    const b = supaFake({ papel: "mentorado" });
    const r2 = await executarTool(
      "registros_da_dupla",
      { dupla_id: UUID },
      b.supabase,
      "chat"
    );
    expect(r2.ok).toBe(false);
    expect(b.fromCalls).toHaveLength(0);
  });

  it("sem papel (sessão quebrada) nada roda", async () => {
    const { supabase, fromCalls } = supaFake({ papel: null });
    const r = await executarTool("resumo_semana", {}, supabase, "mcp");
    expect(r.ok).toBe(false);
    expect(fromCalls).toHaveLength(0);
  });
});

describe("executarTool — allowlist", () => {
  it("o select de registros nem pede os campos de texto livre", () => {
    for (const campo of [
      "reflexoes",
      "observacoes",
      "dificuldade_detalhe",
      "proximo_passo_detalhe",
      "tema",
      "ferramenta",
    ]) {
      expect(IA_REGISTRO_SELECT).not.toContain(campo);
    }
    // a projeção do semáforo também só pede os campos estruturados
    for (const campo of ["reflexoes", "observacoes", "dificuldade_detalhe"])
      expect(IA_SAUDE_SELECT).not.toContain(campo);
  });

  it("registros_da_dupla devolve só os campos estruturados", async () => {
    const linhaSuja = {
      id: "r-1",
      atividades: ["revisão do plano"],
      avaliacao: "boa",
      dificuldade: "nenhuma",
      precisa_apoio: false,
      proximo_passo: "combinado",
      created_at: "2025-11-05T10:00:00-03:00",
      encontro: {
        numero: 5,
        data_hora: "2025-11-04T19:00:00-03:00",
        realizado_em: "2025-11-04T20:00:00-03:00",
      },
      // sujeira que um select * traria — a tool descarta por construção
      reflexoes: "texto livre do mentor",
      observacoes: "mais texto livre",
      dificuldade_detalhe: "detalhe sensível",
      tema: "assunto livre",
      ferramenta: "livre",
      proximo_passo_detalhe: "livre",
    };
    const { supabase } = supaFake({
      tabelas: { registros: [linhaSuja] },
    });
    const r = await executarTool(
      "registros_da_dupla",
      { dupla_id: UUID, limite: 5 },
      supabase,
      "chat"
    );
    const dados = dadosDe(r) as {
      dupla_id: string;
      registros: Record<string, unknown>[];
    };
    expect(dados.dupla_id).toBe(UUID);
    expect(dados.registros).toHaveLength(1);
    const item = dados.registros[0];
    expect(item).toMatchObject({
      encontro_numero: 5,
      avaliacao: "boa",
      dificuldade: "nenhuma",
      atividades: ["revisão do plano"],
      precisa_apoio: false,
      proximo_passo: "combinado",
    });
    for (const campo of [
      "reflexoes",
      "observacoes",
      "dificuldade_detalhe",
      "proximo_passo_detalhe",
      "tema",
      "ferramenta",
      "id",
    ]) {
      expect(item).not.toHaveProperty(campo);
    }
    // nem serializado escondido
    expect(JSON.stringify(dados)).not.toContain("texto livre");
  });
});

describe("executarTool — tools", () => {
  it("resumo_semana devolve o semáforo por dupla, risco primeiro", async () => {
    // CICLO_16 terminou em jan/2026 — sem encontros são 16 atrasos (risco),
    // trilha especialista sem calendário fica "Em dia"
    const emRisco = mkDupla({ id: "d-1", encontros: [] });
    const emDia = mkDupla({ id: "d-2", trilha: "especialista", encontros: [] });
    const { supabase } = supaFake({
      tabelas: {
        duplas: [emDia, emRisco], // ordem invertida de propósito
        ciclo_eventos: CICLO_16,
      },
    });
    const r = await executarTool("resumo_semana", {}, supabase, "chat");
    const dados = dadosDe(r) as {
      total: number;
      duplas: {
        dupla_id: string;
        semaforo: string;
        motivo: string;
        mentor: string | null;
      }[];
    };
    expect(dados.total).toBe(2);
    expect(dados.duplas[0].semaforo).toBe("risco");
    expect(dados.duplas[0].dupla_id).toBe("d-1");
    expect(dados.duplas[0].motivo).toContain("atraso");
    expect(dados.duplas[1].semaforo).toBe("ok");
  });

  it("ficha_dupla junta semáforo + encontros pro adulto", async () => {
    const dupla = mkDupla({
      id: UUID,
      encontros: [encRealizado(1, "2025-10-07")],
      encaminhamentos: [mkEncaminhamento({ status: "pendente" })],
    });
    const { supabase } = supaFake({
      tabelas: { duplas: [dupla], ciclo_eventos: CICLO_16 },
    });
    const r = await executarTool(
      "ficha_dupla",
      { dupla_id: UUID },
      supabase,
      "chat"
    );
    const dados = dadosDe(r) as Record<string, unknown>;
    expect(dados.dupla_id).toBe(UUID);
    expect(dados.mentor).toBe("Mentora Teste");
    expect(dados.encaminhamentos_pendentes).toBe(1);
    expect(dados.semaforo).toBeDefined();
    const encontros = dados.encontros as { numero: number; tem_registro: boolean }[];
    expect(encontros[0]).toMatchObject({ numero: 1, tem_registro: true });
  });

  it("ficha_dupla pro jovem vem da view escopada, sem semáforo", async () => {
    const { supabase } = supaFake({
      papel: "mentorado",
      tabelas: {
        jovem_duplas: [
          {
            id: UUID,
            trilha: "dpp",
            status: "ativa",
            turma: "2025/2026",
            iniciada_em: null,
            demanda: "carreira",
            mentor_nome: "Ana",
            supervisor_nome: "Bia",
          },
        ],
        encontros: [
          {
            numero: 2,
            status: "agendado",
            data_hora: "2026-02-10T19:00:00-03:00",
            realizado_em: null,
            link: "https://meet/x",
          },
        ],
      },
    });
    const r = await executarTool(
      "ficha_dupla",
      { dupla_id: UUID },
      supabase,
      "chat"
    );
    const dados = dadosDe(r) as Record<string, unknown>;
    expect(dados.mentor).toBe("Ana");
    expect(dados.supervisor).toBe("Bia");
    expect(dados).not.toHaveProperty("semaforo");
    expect(dados.encontros).toHaveLength(1);
  });

  it("ficha_dupla de dupla fora do alcance devolve null honesto", async () => {
    const { supabase } = supaFake({
      tabelas: { duplas: [], ciclo_eventos: CICLO_16 },
    });
    const r = await executarTool(
      "ficha_dupla",
      { dupla_id: UUID },
      supabase,
      "chat"
    );
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.dados).toBeNull();
  });

  it("aguardando_par deriva a fila sem vazar contato", async () => {
    const { supabase } = supaFake({
      tabelas: {
        profiles: [
          {
            id: "p-1",
            nome: "Mentor Livre",
            role: "mentor_dpp",
            ativo: true,
            origem: "indicação",
            consent_lgpd_em: "2025-01-05T00:00:00-03:00",
            created_at: "2025-01-05T00:00:00-03:00",
          },
        ],
        mentorados: [
          {
            id: "m-1",
            nome: "Jovem Fila",
            ong_origem: "ONG X",
            origem: null,
            situacao: "ativo",
            created_at: "2025-01-02T00:00:00-03:00",
          },
        ],
        profiles_pessoal: [],
        mentorados_pessoal: [],
        duplas: [],
        mentor_profiles: [],
      },
    });
    const r = await executarTool("aguardando_par", {}, supabase, "chat");
    const dados = dadosDe(r) as {
      mentorados: Record<string, unknown>[];
      mentores: Record<string, unknown>[];
    };
    expect(dados.mentorados).toHaveLength(1);
    expect(dados.mentorados[0].nome).toBe("Jovem Fila");
    expect(dados.mentores).toHaveLength(1);
    expect(dados.mentores[0].vagas).toBe(1);
    for (const item of [...dados.mentorados, ...dados.mentores]) {
      expect(item).not.toHaveProperty("whatsapp");
      expect(item).not.toHaveProperty("email");
    }
  });

  it("capacidade_mentores devolve o X/Y por trilha e ignora inativos", async () => {
    const { supabase } = supaFake({
      tabelas: {
        profiles: [
          { id: "p-1", nome: "M Dpp", role: "mentor_dpp", ativo: true },
          {
            id: "p-2",
            nome: "M Esp",
            role: "mentor_especialista",
            ativo: true,
          },
          { id: "p-3", nome: "Inativo", role: "mentor_dpp", ativo: false },
          { id: "p-4", nome: "Coord", role: "coordenacao", ativo: true },
        ],
        duplas: [
          { mentor_id: "p-1", status: "ativa" },
          { mentor_id: "p-1", status: "encerrada" }, // encerrada não conta
        ],
        mentor_profiles: [
          {
            profile_id: "p-2",
            tipo: "especialista",
            capacidade: 2,
            capacidade_especialista: 3,
          },
        ],
      },
    });
    const r = await executarTool("capacidade_mentores", {}, supabase, "chat");
    const dados = dadosDe(r) as {
      mentores: {
        mentor_id: string;
        trilha: string;
        em_uso: number;
        capacidade: number;
      }[];
    };
    expect(dados.mentores).toHaveLength(2);
    // sem linha em mentor_profiles vale teto 1 — a mesma régua do trigger
    // check_mentor_capacidade (p-1 tá no limite: 1/1)
    const dpp = dados.mentores.find((m) => m.mentor_id === "p-1")!;
    expect(dpp).toMatchObject({ trilha: "dpp", em_uso: 1, capacidade: 1 });
    const esp = dados.mentores.find((m) => m.mentor_id === "p-2")!;
    expect(esp).toMatchObject({
      trilha: "especialista",
      em_uso: 0,
      capacidade: 3,
    });
  });

  it("duplas_do_usuario devolve o índice com ids, sem contato", async () => {
    const { supabase } = supaFake({
      tabelas: {
        duplas: [
          {
            id: "d-1",
            trilha: "dpp",
            status: "ativa",
            turma: "T1",
            mentor: { nome: "Ana" },
            mentorado: { nome: "Luisa" },
            // sujeira de select-* que não pode vazar
            whatsapp: "119999",
            demanda_interna: "x",
          },
        ],
      },
    });
    const r = await executarTool("duplas_do_usuario", {}, supabase, "chat");
    const dados = dadosDe(r) as {
      total: number;
      duplas: Record<string, unknown>[];
    };
    expect(dados.total).toBe(1);
    expect(dados.duplas[0]).toMatchObject({
      dupla_id: "d-1",
      mentor: "Ana",
      mentorado: "Luisa",
      status: "ativa",
    });
    expect(dados.duplas[0]).not.toHaveProperty("whatsapp");
    expect(dados.duplas[0]).not.toHaveProperty("demanda_interna");
  });

  it("agenda_do_periodo devolve encontros da janela com a dupla", async () => {
    const { supabase } = supaFake({
      tabelas: {
        encontros: [
          {
            numero: 6,
            status: "agendado",
            data_hora: new Date(Date.now() + 5 * 86_400_000).toISOString(),
            realizado_em: null,
            dupla: {
              id: "d-1",
              mentor: { nome: "Ana" },
              mentorado: { nome: "Luisa" },
            },
          },
        ],
      },
    });
    const r = await executarTool("agenda_do_periodo", {}, supabase, "chat");
    const dados = dadosDe(r) as {
      total: number;
      encontros: Record<string, unknown>[];
    };
    expect(dados.total).toBe(1);
    expect(dados.encontros[0]).toMatchObject({
      dupla_id: "d-1",
      numero: 6,
      mentorado: "Luisa",
    });
  });

  it("agenda_do_periodo rejeita janela fora da faixa", async () => {
    const { supabase, fromCalls } = supaFake();
    const r = await executarTool(
      "agenda_do_periodo",
      { dias: 365 },
      supabase,
      "chat"
    );
    expect(r.ok).toBe(false);
    expect(fromCalls).toHaveLength(0);
  });

  it("instrumentos_da_dupla repassa a RPC e propaga o erro de escopo", async () => {
    const instrumentos = [
      { tipo: "visao", respondido: true, respostas: { sonho: "x" } },
    ];
    const a = supaFake({ rpcData: { instrumentos_da_dupla: instrumentos } });
    const r1 = await executarTool(
      "instrumentos_da_dupla",
      { dupla_id: UUID },
      a.supabase,
      "chat"
    );
    expect(r1.ok).toBe(true);
    if (r1.ok) expect(r1.dados).toEqual(instrumentos);

    const b = supaFake({
      rpcErro: {
        instrumentos_da_dupla: {
          message: "sem permissão pra ver instrumentos desta dupla",
        },
      },
    });
    const r2 = await executarTool(
      "instrumentos_da_dupla",
      { dupla_id: UUID },
      b.supabase,
      "mcp"
    );
    expect(r2.ok).toBe(false);
    if (!r2.ok) expect(r2.erro).toContain("sem permissão");
    expect(b.auditCalls[0]).toMatchObject({
      p_canal: "mcp",
      p_tool: "instrumentos_da_dupla",
      p_ok: false,
    });
  });
});

describe("executarTool — auditoria", () => {
  it("sucesso registra p_ok true e os args canônicos (zod-aplicados)", async () => {
    const { supabase, auditCalls, auditAwaited } = supaFake({
      tabelas: { registros: [] },
    });
    const r = await executarTool(
      "registros_da_dupla",
      { dupla_id: UUID, limite: 3 },
      supabase,
      "chat"
    );
    expect(r.ok).toBe(true);
    expect(auditCalls).toHaveLength(1);
    expect(auditCalls[0]).toMatchObject({
      p_canal: "chat",
      p_tool: "registros_da_dupla",
      p_args: { dupla_id: UUID, limite: 3 },
      p_ok: true,
      p_erro: null,
    });
    expect(typeof auditCalls[0].p_duracao_ms).toBe("number");
    expect(auditAwaited()).toBe(true);
  });

  it("falha na auditoria não derruba a resposta da tool", async () => {
    const { supabase } = supaFake({
      tabelas: { registros: [] },
      rpcErro: { registrar_ia_evento: { message: "banco fora" } },
    });
    const consoleSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});
    const r = await executarTool(
      "registros_da_dupla",
      { dupla_id: UUID },
      supabase,
      "chat"
    );
    expect(r.ok).toBe(true);
    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });
});
