// Fase 0 da camada de IA — o registry é a fronteira: zod valida args, o
// gate de papel corre ANTES da leitura, a allowlist é construção (o que não
// passa no select não existe pra tool) e toda chamada grava ia_eventos.
// O supabase fake é chainable no mínimo que as queries usam — as linhas
// voltam prontas (a RLS real não roda aqui; o que se testa é a tool).

import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  executarTool,
  IA_TOOLS,
  IA_TOOL_CATALOGO,
  IA_TOOL_NOMES,
} from "@/lib/ia/tools";
import { IA_REGISTRO_SELECT, IA_SAUDE_SELECT } from "@/lib/ia/queries";
import { limparCacheIaConfig } from "@/lib/ia/config";
import { limparCacheGuias } from "@/lib/ia/guias";
import {
  CICLO_16,
  encRealizado,
  mkDupla,
  mkEncaminhamento,
} from "./helpers";

// config e guias têm cache por módulo: sem limpar, um teste herdava o
// que o anterior leu
beforeEach(() => {
  limparCacheIaConfig();
  limparCacheGuias();
});

// uuid v4 + variante 8 — z.uuid() do zod 4 exige o formato RFC (versão no
// 3º grupo, variante no 4º), igual aos gen_random_uuid() do banco
const UUID = "11111111-2222-4333-8444-555555555555";

type Opts = {
  papel?: string | null;
  tabelas?: Record<string, unknown[]>;
  // count exato por tabela — o índice de duplas pede { count: "exact" } pra
  // sinalizar truncamento; null = sem cabeçalho (o que a query tolera)
  contagens?: Record<string, number>;
  rpcData?: Record<string, unknown>;
  rpcErro?: Record<string, { message: string }>;
};

function supaFake({
  papel = "coordenacao",
  tabelas = {},
  contagens = {},
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
      ) =>
        Promise.resolve({
          data: rows(),
          error: null,
          count: contagens[tabela] ?? null,
        }).then(res, rej),
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
  it("declara as tools com descrição pt-BR e papéis", () => {
    expect(IA_TOOL_NOMES.sort()).toEqual(
      [
        "abrir_chamado",
        "acrescentar_info_chamado",
        "aceitar_solicitacao",
        "agenda_do_periodo",
        "aguardando_par",
        "ajuda_faq",
        "assumir_chamado",
        "atribuir_chamado",
        "capacidade_mentores",
        "chamados_resumo",
        "comentar_chamado",
        "confirmar_sugestao_especialista",
        "contra_propor_solicitacao",
        "desmarcar_encontro",
        "devolver_chamado_fila",
        "duplas_do_usuario",
        "ficha_dupla",
        "guia_consulta",
        "historico_encontros",
        "instrumentos_da_dupla",
        "jovem_agendar_encontro",
        "jovem_marcar_aconteceu",
        "jovem_marcar_combinado",
        "jovem_marcar_nao_aconteceu",
        "jovem_pedir_especialista",
        "meu_progresso",
        "meus_combinados",
        "meus_pedidos",
        "minha_agenda",
        "minha_dupla",
        "mural_especialista",
        "pedir_reabertura_chamado",
        "pessoas_busca",
        "publicar_atualizacao_chamado",
        "reabrir_chamado",
        "recusar_solicitacao",
        "registros_da_dupla",
        "resolver_chamado",
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
    // tools do jovem são só dele — staff nunca as chama (pacote nov/2026)
    for (const n of [
      "minha_dupla",
      "minha_agenda",
      "meus_combinados",
      "meu_progresso",
      "meus_pedidos",
      "ajuda_faq",
    ] as const) {
      expect(IA_TOOLS[n].roles).toEqual(["mentorado"]);
    }
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

  it("staff não chama tool do jovem — o gate fecha dos dois lados", async () => {
    for (const papel of ["coordenacao", "supervisor", "mentor_dpp"] as const) {
      const { supabase, fromCalls } = supaFake({ papel });
      const r = await executarTool("minha_dupla", {}, supabase, "chat");
      expect(r.ok).toBe(false);
      expect(fromCalls).toHaveLength(0);
    }
  });

  it("ajuda_faq responde sem tocar no banco (FAQ é estático)", async () => {
    const { supabase, fromCalls } = supaFake({ papel: "mentorado" });
    const r = await executarTool(
      "ajuda_faq",
      { topico: "quem marca o encontro" },
      supabase,
      "chat"
    );
    expect(r.ok).toBe(true);
    const d = dadosDe(r) as { respostas: { pergunta: string }[] };
    expect(d.respostas.length).toBeGreaterThan(0);
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
      truncado: boolean;
      duplas: Record<string, unknown>[];
    };
    expect(dados.total).toBe(1);
    expect(dados.truncado).toBe(false);
    expect(dados.duplas[0]).toMatchObject({
      dupla_id: "d-1",
      mentor: "Ana",
      mentorado: "Luisa",
      status: "ativa",
    });
    expect(dados.duplas[0]).not.toHaveProperty("whatsapp");
    expect(dados.duplas[0]).not.toHaveProperty("demanda_interna");
  });

  it("duplas_do_usuario sinaliza lista parcial quando o escopo passa do limite", async () => {
    // o índice corta em 60 — o count exato da query denuncia o corte e o
    // modelo recebe truncado:true em vez de responder com dados parciais
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
          },
        ],
      },
      contagens: { duplas: 73 },
    });
    const r = await executarTool("duplas_do_usuario", {}, supabase, "chat");
    const dados = dadosDe(r) as {
      total: number;
      truncado: boolean;
      duplas: Record<string, unknown>[];
    };
    expect(dados.total).toBe(73);
    expect(dados.truncado).toBe(true);
    expect(dados.duplas).toHaveLength(1);
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

  it("historico_encontros agrega esperados × realizados por dupla na janela", async () => {
    const ontem = new Date(Date.now() - 86_400_000).toISOString();
    const anteontem = new Date(Date.now() - 2 * 86_400_000).toISOString();
    const amanha = new Date(Date.now() + 86_400_000).toISOString();
    const dupla = (id: string) => ({
      id,
      trilha: "dpp",
      mentor: { nome: "Ana", nome_social: null },
      mentorado: { nome: "Luisa", nome_social: "Lu" },
    });
    const enc = (status: string, data_hora: string | null, id = "d-1") => ({
      numero: 1,
      status,
      data_hora,
      realizado_em: null,
      dupla: dupla(id),
    });
    const { supabase } = supaFake({
      tabelas: {
        encontros: [
          enc("realizado", ontem),
          enc("nao_aconteceu", ontem),
          enc("agendado", anteontem), // vencido → atrasado
          enc("remarcado", anteontem), // idem
          enc("agendado", amanha), // futuro
          enc("cancelado", ontem), // fora dos esperados
          enc("realizado", ontem, "d-2"),
        ],
      },
    });
    const r = await executarTool("historico_encontros", {}, supabase, "chat");
    const dados = dadosDe(r) as {
      resumo: Record<string, number>;
      por_dupla: Record<string, unknown>[];
    };
    expect(dados.resumo).toMatchObject({
      duplas: 2,
      esperados: 5,
      realizados: 2,
      nao_aconteceu: 1,
      atrasados: 2,
      futuros: 1,
      cancelados: 1,
    });
    const d1 = dados.por_dupla.find((d) => d.dupla_id === "d-1")!;
    expect(d1).toMatchObject({
      esperados: 4,
      mentor: "Ana",
      mentorado: "Lu", // nome_social ganha
      atrasados: 2,
    });
  });

  it("historico_encontros é tool de staff — jovem não agrega o programa", async () => {
    expect(IA_TOOLS.historico_encontros.roles).not.toContain("mentorado");
    const { supabase } = supaFake({ papel: "mentorado" });
    const r = await executarTool("historico_encontros", {}, supabase, "chat");
    expect(r.ok).toBe(false);
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

  it("default (sem coletarEvento) segue gravando na hora — caminho do MCP", async () => {
    const { supabase, auditCalls, auditAwaited } = supaFake({
      tabelas: { registros: [] },
    });
    await executarTool(
      "registros_da_dupla",
      { dupla_id: UUID },
      supabase,
      "mcp",
      ["coordenacao"],
      "prof-autor",
      "req-1"
    );
    expect(auditCalls).toHaveLength(1);
    expect(auditCalls[0]).toMatchObject({
      p_canal: "mcp",
      p_profile_id: "prof-autor",
      p_request_id: "req-1",
    });
    expect(auditAwaited()).toBe(true);
  });

  it("coletarEvento devolve o evento ao caller em vez de gravar", async () => {
    const { supabase, auditCalls } = supaFake({
      tabelas: { registros: [] },
    });
    const coletados: Record<string, unknown>[] = [];
    const r = await executarTool(
      "registros_da_dupla",
      { dupla_id: UUID, limite: 3 },
      supabase,
      "chat",
      ["coordenacao"],
      undefined,
      "req-2",
      { coletarEvento: (ev) => coletados.push(ev) }
    );
    expect(r.ok).toBe(true);
    // nenhuma escrita avulsa: o chat manda tudo no lote do fim
    expect(auditCalls).toHaveLength(0);
    expect(coletados).toEqual([
      {
        canal: "chat",
        tool: "registros_da_dupla",
        args: { dupla_id: UUID, limite: 3 },
        ok: true,
        erro: null,
        duracao_ms: expect.any(Number),
        request_id: "req-2",
      },
    ]);
  });

  it("evento coletado mantém a minimização de args (texto livre vira hash)", async () => {
    const { supabase } = supaFake({ rpcData: { match_ia_chunks: [] } });
    const coletados: { args: Record<string, unknown>; ok: boolean }[] = [];
    await executarTool(
      "guia_consulta",
      { pergunta: "como falar com a Ana sobre faltas?" },
      supabase,
      "chat",
      ["coordenacao"],
      undefined,
      "req-3",
      { coletarEvento: (ev) => coletados.push(ev) }
    );
    expect(coletados).toHaveLength(1);
    expect(coletados[0].args.pergunta).toEqual({
      n: "como falar com a Ana sobre faltas?".length,
      hash12: expect.stringMatching(/^[0-9a-f]{12}$/),
    });
  });

  it("erro de validação também sai no evento coletado", async () => {
    const { supabase, auditCalls } = supaFake();
    const coletados: { ok: boolean; erro?: string | null }[] = [];
    const r = await executarTool(
      "registros_da_dupla",
      { dupla_id: "nao-e-uuid" },
      supabase,
      "chat",
      ["coordenacao"],
      undefined,
      "req-4",
      { coletarEvento: (ev) => coletados.push(ev) }
    );
    expect(r.ok).toBe(false);
    expect(auditCalls).toHaveLength(0);
    expect(coletados[0]).toMatchObject({ ok: false });
    expect(coletados[0].erro).toContain("Argumentos inválidos");
  });

  it("guia_consulta devolve trechos citáveis limpos, sem score nem pagina", async () => {
    const { supabase } = supaFake({
      rpcData: {
        match_ia_chunks: [
          {
            guia: "guia-mentor-dpp",
            secao: "2º encontro",
            pagina: 12, // id sintético do chunk — nunca chega ao modelo
            trecho: "Apresente os <b>resultados</b> consolidados…",
            score: 0.42,
          },
        ],
      },
    });
    const r = await executarTool(
      "guia_consulta",
      { pergunta: "como conduzir o segundo encontro?" },
      supabase,
      "chat"
    );
    expect(dadosDe(r)).toEqual({
      fontes: [
        {
          guia: "guia-mentor-dpp",
          secao: "2º encontro",
          trecho: "Apresente os resultados consolidados…",
        },
      ],
      guias: [],
    });
  });

  it("guia_consulta é pra todo papel — até o jovem pergunta de guia", async () => {
    const { supabase } = supaFake({
      papel: "mentorado",
      rpcData: { match_ia_chunks: [] },
    });
    const r = await executarTool(
      "guia_consulta",
      { pergunta: "o que é a Roda da Vida?" },
      supabase,
      "chat"
    );
    expect(r.ok).toBe(true);
  });
});

describe("tools de escrita — canal e confirmação (0163)", () => {
  const CID = "99999999-8888-4777-8666-555555555555";

  it("tool de escrita não roda no chat — a Liza interna segue leitura", async () => {
    const { supabase } = supaFake({ papel: "coordenacao" });
    const r = await executarTool(
      "resolver_chamado",
      { chamado_id: UUID, resumo: "x" },
      supabase,
      "chat"
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.erro).toContain("não está disponível neste canal");
  });

  it("1ª chamada MCP devolve pendente_confirmacao SEM tocar a RPC de domínio", async () => {
    const rpcCalls: string[] = [];
    const { supabase } = supaFake({
      papel: "coordenacao",
      rpcData: { ia_confirmacao_criar: CID },
    });
    // espia as RPCs chamadas
    const orig = supabase.rpc.bind(supabase);
    vi.spyOn(supabase, "rpc").mockImplementation(((n: string, a?: unknown) => {
      rpcCalls.push(n);
      return orig(n, a as Record<string, unknown>);
    }) as never);

    const r = await executarTool(
      "resolver_chamado",
      { chamado_id: UUID, resumo: "combinamos novo horário" },
      supabase,
      "mcp"
    );
    expect(r.ok).toBe(true);
    const d = dadosDe(r).pendente_confirmacao as Record<string, unknown>;
    expect(d.confirmacao_id).toBe(CID);
    expect(d.tool).toBe("resolver_chamado");
    expect(String(d.resumo)).toContain(UUID);
    // gravou a prévia; NUNCA chamou a RPC que muta
    expect(rpcCalls).toContain("ia_confirmacao_criar");
    expect(rpcCalls).not.toContain("resolver_chamado");
  });

  it("2ª chamada consome a confirmação e executa a RPC de domínio", async () => {
    const rpcCalls: string[] = [];
    const { supabase } = supaFake({
      papel: "coordenacao",
      rpcData: { ia_confirmacao_consumir: "Resolver o chamado", resolver_chamado: null },
    });
    const orig = supabase.rpc.bind(supabase);
    vi.spyOn(supabase, "rpc").mockImplementation(((n: string, a?: unknown) => {
      rpcCalls.push(n);
      return orig(n, a as Record<string, unknown>);
    }) as never);

    const r = await executarTool(
      "resolver_chamado",
      { chamado_id: UUID, resumo: "combinamos novo horário", confirmacao_id: CID },
      supabase,
      "mcp"
    );
    expect(r.ok).toBe(true);
    expect(rpcCalls).toContain("ia_confirmacao_consumir");
    expect(rpcCalls).toContain("resolver_chamado");
  });

  it("confirmacao inválida/expirada/divergente (consumir=null) não executa", async () => {
    const rpcCalls: string[] = [];
    const { supabase } = supaFake({ papel: "coordenacao" });
    const orig = supabase.rpc.bind(supabase);
    vi.spyOn(supabase, "rpc").mockImplementation(((n: string, a?: unknown) => {
      rpcCalls.push(n);
      return orig(n, a as Record<string, unknown>);
    }) as never);

    const r = await executarTool(
      "resolver_chamado",
      { chamado_id: UUID, resumo: "x", confirmacao_id: CID },
      supabase,
      "mcp"
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.erro).toContain("Confirmação inválida");
    expect(rpcCalls).not.toContain("resolver_chamado");
  });

  it("gate de papel corre antes da prévia — jovem não resolve chamado", async () => {
    const rpcCalls: string[] = [];
    const { supabase } = supaFake({ papel: "mentorado" });
    const orig = supabase.rpc.bind(supabase);
    vi.spyOn(supabase, "rpc").mockImplementation(((n: string, a?: unknown) => {
      rpcCalls.push(n);
      return orig(n, a as Record<string, unknown>);
    }) as never);

    const r = await executarTool(
      "resolver_chamado",
      { chamado_id: UUID, resumo: "x" },
      supabase,
      "mcp"
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.erro).toContain("não está disponível pro seu papel");
    expect(rpcCalls).not.toContain("ia_confirmacao_criar");
  });

  it("tool do jovem passa pelo mesmo envelope (marcar combinado)", async () => {
    const { supabase } = supaFake({
      papel: "mentorado",
      rpcData: { ia_confirmacao_criar: CID },
    });
    const r = await executarTool(
      "jovem_marcar_combinado",
      { combinado_id: UUID, feito: true },
      supabase,
      "mcp"
    );
    expect(r.ok).toBe(true);
    const d = dadosDe(r).pendente_confirmacao as Record<string, unknown>;
    expect(d.tool).toBe("jovem_marcar_combinado");
  });

  it("especialista aceita pedido: envelope → consumo → aceitar_solicitacao", async () => {
    const rpcCalls: string[] = [];
    const { supabase } = supaFake({
      papel: "mentor_especialista",
      rpcData: { ia_confirmacao_consumir: "Aceitar", aceitar_solicitacao: UUID },
    });
    const orig = supabase.rpc.bind(supabase);
    vi.spyOn(supabase, "rpc").mockImplementation(((n: string, a?: unknown) => {
      rpcCalls.push(n);
      return orig(n, a as Record<string, unknown>);
    }) as never);

    const r = await executarTool(
      "aceitar_solicitacao",
      { solicitacao_id: UUID, confirmacao_id: CID },
      supabase,
      "mcp"
    );
    expect(r.ok).toBe(true);
    expect(rpcCalls).toContain("aceitar_solicitacao");
  });
});
