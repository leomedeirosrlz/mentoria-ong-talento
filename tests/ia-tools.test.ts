// Fase 0 da camada de IA — o registry é a fronteira: zod valida args, o
// gate de papel corre ANTES da leitura, a allowlist é construção (o que não
// passa no select não existe pra tool) e toda chamada grava ia_eventos.
// O supabase fake é chainable no mínimo que as queries usam — as linhas
// voltam prontas (a RLS real não roda aqui; o que se testa é a tool).

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  executarTool,
  IA_TOOLS,
  IA_TOOL_CATALOGO,
  IA_TOOL_NOMES,
} from "@/lib/ia/tools";
import {
  IA_INSIGHTS_SELECT,
  IA_REGISTRO_SELECT,
  IA_SAUDE_SELECT,
} from "@/lib/ia/queries";import { limparCacheIaConfig } from "@/lib/ia/config";
import { limparCacheGuias } from "@/lib/ia/guias";
import {
  CICLO_16,
  CRON_T1,
  encRealizado,
  mkDupla,
  mkEncaminhamento,
  mkRegistro,
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
  // papéis efetivos quando diferem do primário (híbrido coord+mentor)
  papeis?: string[] | null;
  tabelas?: Record<string, unknown[]>;
  // count exato por tabela — o índice de duplas pede { count: "exact" } pra
  // sinalizar truncamento; null = sem cabeçalho (o que a query tolera)
  contagens?: Record<string, number>;
  rpcData?: Record<string, unknown>;
  rpcErro?: Record<string, { message: string }>;
};

function supaFake({
  papel = "coordenacao",
  papeis = null,
  tabelas = {},
  contagens = {},
  rpcData = {},
  rpcErro = {},
}: Opts = {}) {
  const auditCalls: Record<string, unknown>[] = [];
  const fromCalls: string[] = [];
  // escritas observadas por tabela — prova de que a tool executou de fato
  const escritas: { tabela: string; op: string; payload: unknown }[] = [];
  // args capturados por builder — prova de que a query pede o filtro/
  // projeção certa pro PostgREST (a RLS em si não roda no fake)
  const selectCalls: { tabela: string; sel: unknown }[] = [];
  const eqCalls: { tabela: string; campo: string; valor: unknown }[] = [];
  const orderCalls: { tabela: string; campo: string; op: unknown }[] = [];
  const limitCalls: { tabela: string; n: number }[] = [];
  // o rpc do supabase-js é lazy: chamar sem await nunca chega no PostgREST.
  // O flag vira só quando o retorno é awaited — prova de que executarTool
  // espera a auditoria, não só dispara.
  let auditAwaited = false;

  const builder = (tabela: string) => {
    const rows = () => tabelas[tabela] ?? [];
    const b: Record<string, unknown> = {
      select: (sel?: unknown) => {
        selectCalls.push({ tabela, sel });
        return b;
      },
      in: () => b,
      or: () => b,
      eq: (campo: string, valor: unknown) => {
        eqCalls.push({ tabela, campo, valor });
        return b;
      },
      neq: () => b,
      gt: () => b,
      gte: () => b,
      lte: () => b,
      order: (campo: string, op?: unknown) => {
        orderCalls.push({ tabela, campo, op });
        return b;
      },
      limit: (n: number) => {
        limitCalls.push({ tabela, n });
        return b;
      },
      insert: (p: unknown) => {
        escritas.push({ tabela, op: "insert", payload: p });
        return b;
      },
      update: (p: unknown) => {
        escritas.push({ tabela, op: "update", payload: p });
        return b;
      },
      delete: () => {
        escritas.push({ tabela, op: "delete", payload: null });
        return b;
      },
      single: () => Promise.resolve({ data: rows()[0] ?? null, error: null }),
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
      // conjunto efetivo de 1 elemento salvo override explícito
      if (nome === "my_papeis")
        return { data: papeis ?? (papel ? [papel] : []), error: null };
      // os cores de escrita resolvem o ator por estas duas RPCs — o
      // primário é o `papel` do fixture salvo override (híbrido)
      if (nome === "my_role")
        return {
          data: "my_role" in rpcData ? rpcData.my_role : papel,
          error: null,
        };
      if (nome === "my_profile_id")
        return { data: rpcData.my_profile_id ?? "profile-fake", error: null };
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
    escritas,
    selectCalls,
    eqCalls,
    orderCalls,
    limitCalls,
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
        "adocao_caminhos",
        "adocao_coorte",
        "adocao_funil",
        "adocao_por_dia",
        "adocao_por_superficie",
        "agenda_do_periodo",
        "agendar_encontro",
        "aguardando_par",
        "ajuda_faq",
        "assumir_chamado",
        "atribuir_chamado",
        "capacidade_mentores",
        "chamados_resumo",
        "combinados_das_duplas",
        "comentar_chamado",
        "confirmar_sugestao_especialista",
        "contra_propor_solicitacao",
        "declarar_recesso",
        "desmarcar_encontro",
        "devolver_chamado_fila",
        "disponibilidade_semana",
        "duplas_do_usuario",
        "duplas_panorama",
        "editar_campo_pessoa",
        "emitir_link_instrumento",
        "encontros_retroativo",
        "ficha_dupla",
        "guia_ajustar",
        "guia_consulta",
        "guia_limpar",
        "historico_encontros",
        "instrumentos_da_dupla",
        "intervencao_sugerir",
        "jovem_agendar_encontro",
        "jovem_desfazer_retroativo",
        "jovem_marcar_aconteceu",
        "jovem_marcar_combinado",
        "jovem_marcar_nao_aconteceu",
        "jovem_pedir_especialista",
        "jovem_registrar_retroativo",
        "marcar_situacao_mentorado",
        "mensagem_template",
        "meu_plano",
        "meu_progresso",
        "meus_combinados",
        "meus_pedidos",
        "minha_agenda",
        "minha_dupla",
        "mural_especialista",
        "operacional_insights",
        "pedir_reabertura_chamado",
        "pessoas_agregado",
        "pessoas_busca",
        "plano_aplicar_passo",
        "plano_em_dia",
        "plano_propor",
        "plano_responder",
        "publicar_atualizacao_chamado",
        "reabrir_chamado",
        "recusar_solicitacao",
        "registrar_interacao",
        "registros_da_dupla",
        "resolver_chamado",
        "resumo_dupla",
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
    // tools do jovem são só dele — staff nunca as chama (pacote nov/2026 +
    // retroativo da 461)
    for (const n of [
      "minha_dupla",
      "minha_agenda",
      "meus_combinados",
      "meu_progresso",
      "meus_pedidos",
      "ajuda_faq",
      "encontros_retroativo",
      "jovem_registrar_retroativo",
      "jovem_desfazer_retroativo",
    ] as const) {
      expect(IA_TOOLS[n].roles).toEqual(["mentorado"]);
    }
    // 527 — o gesto do combinado é da dupla: recesso e grade são só dos
    // dois lados (a RPC recusa staff), e o jovem propõe como no app
    expect(IA_TOOLS.declarar_recesso.roles).toEqual([
      "mentor_dpp",
      "mentorado",
    ]);
    expect(IA_TOOLS.disponibilidade_semana.roles).toEqual([
      "mentor_dpp",
      "mentorado",
    ]);
    expect(IA_TOOLS.plano_propor.roles).toEqual([
      "coordenacao",
      "supervisor",
      "mentor_dpp",
      "mentorado",
    ]);
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

// ---------- pessoas_agregado (BI demográfico, onda 5) ----------
// Fixture que o PostgREST real devolveria: o .or() da query já tira a
// conta de jovem (role=mentorado) e o .eq("ativo") filtra inativas — o
// fake não aplica filtro, então a semente já vem com o recorte aplicado.
const TABELAS_BI = {
  profiles: [
    {
      id: "p-1",
      nome: "Ana Híbrida",
      nome_social: null,
      role: "mentor_dpp",
      ativo: true,
      uf: "sp",
      profile_papeis: [
        { papel: "mentor_dpp" },
        { papel: "mentor_especialista" },
      ],
    },
    {
      id: "p-2",
      nome: "Beto Coord",
      nome_social: null,
      role: "coordenacao",
      ativo: true,
      uf: "RJ",
      profile_papeis: [{ papel: "coordenacao" }],
    },
  ],
  mentorados: [
    { id: "m-1", nome: "Caio", nome_social: null, situacao: "ativo", uf: "SP", profile_id: null },
    { id: "m-2", nome: "Duda", nome_social: null, situacao: "ativo", uf: "SP", profile_id: "p-9" },
  ],
  profiles_pessoal: [
    { id: "p-1", data_nascimento: "1990-01-01", genero: "feminino" },
    { id: "p-2", data_nascimento: "1980-05-05", genero: "masculino" },
  ],
  mentorados_pessoal: [
    { id: "m-1", data_nascimento: "2008-04-12", genero: "feminino" },
    { id: "m-2", data_nascimento: "2009-08-30", genero: "masculino" },
  ],
  duplas: [
    { mentor_id: "p-1", mentorado_id: "m-1", trilha: "dpp", status: "ativa" },
    { mentor_id: "p-1", mentorado_id: "m-2", trilha: "especialista", status: "pausada" },
  ],
};

describe("executarTool — pessoas_agregado", () => {
  it("coord recebe grupos por estado, título e recorte, sem nascimento no payload", async () => {
    const { supabase } = supaFake({ tabelas: TABELAS_BI });
    const r = await executarTool(
      "pessoas_agregado",
      { dimensao: "estado" },
      supabase,
      "chat"
    );
    const d = dadosDe(r) as {
      titulo: string;
      total_pessoas: number;
      grupos: { chave: string; rotulo: string; pessoas: number }[];
      linhas: Record<string, unknown>[];
    };
    expect(d.titulo).toBe("Pessoas por estado (UF)");
    expect(d.total_pessoas).toBe(4);
    expect(d.grupos.find((g) => g.chave === "SP")?.pessoas).toBe(3);
    expect(d.grupos.find((g) => g.chave === "RJ")?.pessoas).toBe(1);
    // nascimento só virou faixa no servidor — nunca data exata; e a
    // allowlist do select nem pede cor/raça, civis, motivação ou intake
    expect(JSON.stringify(d)).not.toMatch(/\d{4}-\d{2}-\d{2}/);
    for (const campo of [
      "cor_raca",
      "dados_civis",
      "motivacao",
      "form_bruto",
      "whatsapp",
      "email",
      "cpf",
    ])
      expect(JSON.stringify(d)).not.toContain(campo);
  });

  it("trilha conta participação (híbrido nas duas linhas) e marca o flag", async () => {
    const { supabase } = supaFake({ tabelas: TABELAS_BI });
    const r = await executarTool(
      "pessoas_agregado",
      { dimensao: "trilha" },
      supabase,
      "chat"
    );
    const d = dadosDe(r) as {
      participacao_multipla: boolean;
      grupos: { chave: string; pessoas: number }[];
    };
    expect(d.participacao_multipla).toBe(true);
    expect(d.grupos.find((g) => g.chave === "dpp")?.pessoas).toBe(2);
    expect(d.grupos.find((g) => g.chave === "especialista")?.pessoas).toBe(2);
    expect(d.grupos.find((g) => g.chave === "sem_trilha")?.pessoas).toBe(1);
  });

  it("o select das views sensíveis pede só id, nascimento e gênero", async () => {
    const { supabase, selectCalls } = supaFake({ tabelas: TABELAS_BI });
    await executarTool(
      "pessoas_agregado",
      { dimensao: "estado" },
      supabase,
      "chat"
    );
    for (const s of selectCalls.filter(
      (c) => c.tabela === "profiles_pessoal" || c.tabela === "mentorados_pessoal"
    )) {
      expect(s.sel).toBe("id, data_nascimento, genero");
    }
  });

  it("mentor e jovem não chamam — o gate sai antes de ler", async () => {
    for (const papel of ["mentor_dpp", "mentor_especialista", "mentorado"] as const) {
      const { supabase, fromCalls } = supaFake({ papel });
      const r = await executarTool(
        "pessoas_agregado",
        { dimensao: "estado" },
        supabase,
        "chat"
      );
      expect(r.ok).toBe(false);
      expect(fromCalls).toHaveLength(0);
    }
  });

  it("supervisor agrega estado/papel/trilha; gênero e idade são da coordenação", async () => {
    const a = supaFake({ papel: "supervisor", tabelas: TABELAS_BI });
    const ok = await executarTool(
      "pessoas_agregado",
      { dimensao: "estado" },
      a.supabase,
      "chat"
    );
    expect(ok.ok).toBe(true);
    if (ok.ok) {
      const d = ok.dados as { linhas: Record<string, unknown>[] };
      for (const l of d.linhas) {
        expect(l).not.toHaveProperty("genero");
        expect(l).not.toHaveProperty("faixa_idade");
      }
    }

    for (const args of [
      { dimensao: "genero" },
      { dimensao: "faixa_idade" },
      { dimensao: "estado", genero: "feminino" },
      { dimensao: "estado", faixa_idade: "ate_17" },
    ] as const) {
      const b = supaFake({ papel: "supervisor", tabelas: TABELAS_BI });
      const r = await executarTool("pessoas_agregado", args, b.supabase, "chat");
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.erro).toContain("coordenação");
    }
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
    // 018: a projeção do semáforo pede os campos de conteúdo porque a
    // régua registroTemConteudo/cobertosDaDupla lê eles pro booleano
    // "tem registro?" — a tool nunca os serializa pro modelo (a saída
    // projetada campo a campo é o que os testes abaixo garantem)
    for (const campo of [
      "tema",
      "reflexoes",
      "observacoes",
      "atividades",
      "cobertura",
    ])
      expect(IA_SAUDE_SELECT).toContain(campo);
    // os detalhes livres seguem fora — a régua não os lê
    for (const campo of ["dificuldade_detalhe", "proximo_passo_detalhe"])
      expect(IA_SAUDE_SELECT).not.toContain(campo);
  });

  it("a projeção de insights carrega o que a aderência lê", () => {
    // o .replace sobre IA_SAUDE_SELECT precisa casar: se o select do
    // semáforo mudar de forma, o silêncio do replace zeraria o atraso de
    // registro e as remarcações sem nenhum erro
    expect(IA_INSIGHTS_SELECT).toContain(
      "registro:registros(precisa_apoio, avaliacao, dificuldade, tema, reflexoes, observacoes, atividades, cobertura, created_at)"
    );
    expect(IA_INSIGHTS_SELECT).toContain("encontro_remarcacoes");
    // mesma fronteira do semáforo: conteúdo pro booleano, detalhes fora
    for (const campo of ["dificuldade_detalhe", "proximo_passo_detalhe"])
      expect(IA_INSIGHTS_SELECT).not.toContain(campo);
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

  it("combinados_das_duplas devolve contexto da dupla, atraso derivado e totais", async () => {
    // a linha vem do embed duplas!inner — o fake devolve o shape pronto
    const linha = (over: Record<string, unknown>) => ({
      id: "t-1",
      descricao: "Enviar o currículo",
      responsavel: "mentor",
      prazo: "2020-01-05", // passado de longe → atrasado determinístico
      status: "pendente",
      numero: 7,
      feito_em: null,
      created_at: "2025-11-01T00:00:00-03:00",
      dupla: {
        id: "d-1",
        trilha: "dpp",
        turma: "T1",
        status: "ativa",
        mentor: { nome: "Ana", nome_social: null },
        mentorado: { nome: "João", nome_social: "Joca" },
      },
      // colunas que o select não pede — não podem vazar nem serializadas
      registro_id: "r-9",
      created_by: "u-9",
      ...over,
    });
    const { supabase } = supaFake({
      tabelas: {
        encaminhamentos: [
          linha({ id: "t-atrasado" }),
          linha({ id: "t-emdia", prazo: "2999-01-01" }),
          linha({ id: "t-semprazo", prazo: null }),
          linha({
            id: "t-feito",
            status: "feito",
            prazo: "2020-01-05", // vencido mas feito → não conta atraso
            feito_em: "2025-11-02T00:00:00-03:00",
          }),
        ],
      },
    });
    const r = await executarTool(
      "combinados_das_duplas",
      { status: "todos" },
      supabase,
      "chat"
    );
    const dados = dadosDe(r) as {
      total: number;
      vencidos: number;
      combinados: Record<string, unknown>[];
    };
    expect(dados.total).toBe(4);
    expect(dados.vencidos).toBe(1);
    const porId = Object.fromEntries(
      dados.combinados.map((c) => [c.id as string, c])
    );
    expect(porId["t-atrasado"].atrasado).toBe(true);
    expect(porId["t-emdia"].atrasado).toBe(false);
    expect(porId["t-semprazo"].atrasado).toBe(false);
    expect(porId["t-feito"].atrasado).toBe(false);
    expect(porId["t-atrasado"]).toMatchObject({
      dupla_id: "d-1",
      mentor: "Ana",
      mentorado: "Joca", // nome_social ganha do civil
      trilha: "dpp",
      turma: "T1",
      numero: 7,
      texto: "Enviar o currículo",
      responsavel: "mentor",
      prazo: "2020-01-05",
      status: "pendente",
    });
    // o shape é fechado — embed cru e colunas internas ficam fora
    for (const campo of ["dupla", "registro_id", "created_by", "descricao"]) {
      expect(porId["t-atrasado"]).not.toHaveProperty(campo);
    }
    expect(JSON.stringify(dados)).not.toContain("r-9");
  });

  it("combinados_das_duplas aplica dupla_id/status/limite na query", async () => {
    const { supabase, eqCalls, orderCalls, limitCalls, selectCalls } =
      supaFake({ tabelas: { encaminhamentos: [] } });
    const r = await executarTool(
      "combinados_das_duplas",
      { dupla_id: UUID, limite: 5 },
      supabase,
      "chat"
    );
    expect(r.ok).toBe(true);
    const eq = eqCalls.filter((c) => c.tabela === "encaminhamentos");
    // sem status no args o padrão é pendente (o recorte "o que cobrar")
    expect(eq).toEqual(
      expect.arrayContaining([
        { tabela: "encaminhamentos", campo: "dupla_id", valor: UUID },
        { tabela: "encaminhamentos", campo: "status", valor: "pendente" },
      ])
    );
    expect(limitCalls).toContainEqual({ tabela: "encaminhamentos", n: 5 });
    // vencidos primeiro: prazo asc com nulls por último, desempate recente
    expect(orderCalls).toEqual(
      expect.arrayContaining([
        {
          tabela: "encaminhamentos",
          campo: "prazo",
          op: { ascending: true, nullsFirst: false },
        },
        {
          tabela: "encaminhamentos",
          campo: "created_at",
          op: { ascending: false },
        },
      ])
    );
    // o embed !inner é o cinto da RLS — combinado de dupla invisível não sai
    const sel = selectCalls.find((c) => c.tabela === "encaminhamentos")!;
    expect(String(sel.sel)).toContain("duplas!inner");
  });

  it("combinados_das_duplas com status='todos' não filtra por status", async () => {
    const { supabase, eqCalls } = supaFake({
      tabelas: { encaminhamentos: [] },
    });
    await executarTool(
      "combinados_das_duplas",
      { status: "todos" },
      supabase,
      "chat"
    );
    const eq = eqCalls.filter(
      (c) => c.tabela === "encaminhamentos" && c.campo === "status"
    );
    expect(eq).toHaveLength(0);
  });

  it("combinados_das_duplas é staff — jovem é barrado antes de ler", async () => {
    expect(IA_TOOLS.combinados_das_duplas.roles).toEqual([
      "coordenacao",
      "supervisor",
      "mentor_dpp",
      "mentor_especialista",
    ]);
    const { supabase, fromCalls, auditCalls } = supaFake({
      papel: "mentorado",
    });
    const r = await executarTool(
      "combinados_das_duplas",
      {},
      supabase,
      "chat"
    );
    expect(r.ok).toBe(false);
    expect(fromCalls).not.toContain("encaminhamentos");
    expect(auditCalls[0].p_ok).toBe(false);
    // mentor passa o gate — o recorte fino é da RLS (mentor vê só a sua)
    const m = supaFake({ papel: "mentor_dpp", tabelas: { encaminhamentos: [] } });
    const r2 = await executarTool(
      "combinados_das_duplas",
      {},
      m.supabase,
      "chat"
    );
    expect(r2.ok).toBe(true);
    expect(m.fromCalls).toContain("encaminhamentos");
  });
});

describe("operacional_insights (REALIZA-465)", () => {
  const cronogramas = [
    { id: CRON_T1, nome: "Ciclo 2025/2026", turma: "2025/2026" },
  ];

  /** Painel operacional com uma dupla DPP atrasada, um snapshot de risco e
   *  adoção caindo: cada seção tem pelo menos um número pra citar. */
  function painel(over: Opts = {}) {
    return supaFake({
      ...over,
      tabelas: {
        // uma dupla atrasada que também pede apoio: o achado de apoio aponta
        // pra ficha dela, o que prova o recorte por dupla no link
        duplas: [
          mkDupla({
            id: "d-1",
            encontros: [
              encRealizado(
                1,
                "2025-10-07",
                mkRegistro({ precisa_apoio: true })
              ),
            ],
          }),
        ],
        ciclo_eventos: CICLO_16,
        cronogramas,
        dupla_saude_snapshots: [
          {
            dia: new Date().toISOString().slice(0, 10),
            dupla_id: "d-1",
            semaforo: "risco",
          },
        ],
        ...(over.tabelas ?? {}),
      },
      rpcData: {
        adocao_resumo: {
          ativas: 8,
          ativas_prev: 10,
          gestos: 90,
          gestos_prev: 150,
          sups_vivas: 4,
          coletando_desde: null,
        },
        adocao_matriz: [
          { superficie: "duplas", papel: "mentor_dpp", pessoas: 3, gestos: 20 },
        ],
        adocao_coorte: [
          { coorte: "2026-01-05", semana: 1, ativas: 4, total: 10 },
        ],
        ...(over.rpcData ?? {}),
      },
    });
  }

  type Saida = {
    escopo: string;
    secoes: string[];
    indisponiveis: string[];
    total: number;
    achados: {
      fonte: string;
      titulo: string;
      metrica: string;
      acao: { rotulo: string; href: string };
    }[];
  };

  it("responde 'e a adesão' com número, fonte e link de ação", async () => {
    // Arrange
    const { supabase } = painel();

    // Act
    const r = await executarTool(
      "operacional_insights",
      { secao: "aderencia" },
      supabase,
      "chat"
    );

    // Assert
    const d = dadosDe(r) as Saida;
    expect(d.secoes).toEqual(["Aderência"]);
    expect(d.total).toBeGreaterThan(0);
    const atraso = d.achados.find((a) =>
      a.titulo.includes("atrás do calendário")
    );
    expect(atraso).toMatchObject({
      fonte: "Aderência",
      metrica: expect.stringContaining("1 de 1"),
      acao: { rotulo: expect.any(String), href: expect.any(String) },
    });
    expect(atraso!.acao.href.startsWith("/")).toBe(true);
  });

  it("coordenação recebe as três leituras e todo achado ganha fonte e ação", async () => {
    // Arrange
    const { supabase } = painel();

    // Act
    const r = await executarTool("operacional_insights", {}, supabase, "chat");

    // Assert
    const d = dadosDe(r) as Saida;
    expect(d.escopo).toBe("programa");
    expect(d.secoes).toEqual(["Aderência", "Saúde", "Adoção"]);
    expect(new Set(d.achados.map((a) => a.fonte))).toEqual(
      new Set(["Aderência", "Saúde", "Adoção"])
    );
    for (const a of d.achados) {
      expect(a.acao.href.startsWith("/")).toBe(true);
      expect(a.acao.rotulo.length).toBeGreaterThan(0);
    }
  });

  it("mentor recebe só a aderência do próprio escopo, sem leitura de programa", async () => {
    // Arrange
    const f = painel({ papel: "mentor_dpp", papeis: ["mentor_dpp"] });
    const chamadasRpc: string[] = [];
    const orig = f.supabase.rpc.bind(f.supabase);
    vi.spyOn(f.supabase, "rpc").mockImplementation(((n: string, a?: unknown) => {
      chamadasRpc.push(n);
      return orig(n, a as Record<string, unknown>);
    }) as never);

    // Act
    const r = await executarTool("operacional_insights", {}, f.supabase, "chat");

    // Assert
    const d = dadosDe(r) as Saida;
    expect(d.escopo).toBe("duplas do seu escopo");
    expect(d.secoes).toEqual(["Aderência"]);
    expect(d.achados.every((a) => a.fonte === "Aderência")).toBe(true);
    // a leitura de programa inteiro não roda pra quem não é coordenação
    expect(f.fromCalls).not.toContain("dupla_saude_snapshots");
    expect(chamadasRpc).not.toContain("adocao_resumo");
    expect(chamadasRpc).not.toContain("adocao_matriz");
    // o único recorte que chega é o das duplas dele: o apoio linka a ficha
    // que a RLS entregou, nunca uma dupla de fora
    const apoio = d.achados.find((a) => a.titulo.includes("pedido de apoio"));
    expect(apoio?.acao.href).toBe("/duplas/d-1");
  });

  it("mentor pedindo saúde cai na aderência em vez de 'sem acesso'", async () => {
    // Arrange
    const { supabase } = painel({ papel: "mentor_dpp", papeis: ["mentor_dpp"] });

    // Act
    const r = await executarTool(
      "operacional_insights",
      { secao: "saude" },
      supabase,
      "chat"
    );

    // Assert
    const d = dadosDe(r) as Saida;
    expect(d.secoes).toEqual(["Aderência"]);
    expect(d.total).toBeGreaterThan(0);
  });

  it("jovem não alcança a leitura operacional — o gate fecha antes de ler", async () => {
    // Arrange
    expect(IA_TOOLS.operacional_insights.roles).not.toContain("mentorado");
    const { supabase, fromCalls } = supaFake({ papel: "mentorado" });

    // Act
    const r = await executarTool("operacional_insights", {}, supabase, "chat");

    // Assert
    expect(r.ok).toBe(false);
    expect(fromCalls).toHaveLength(0);
  });

  it("uma seção fora não derruba as outras", async () => {
    // Arrange: a adoção falha, aderência e saúde seguem valendo
    const { supabase } = painel({
      rpcErro: { adocao_resumo: { message: "rpc fora" } },
    });
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    // Act
    const r = await executarTool("operacional_insights", {}, supabase, "chat");

    // Assert
    const d = dadosDe(r) as Saida;
    expect(d.secoes).toEqual(["Aderência", "Saúde"]);
    expect(d.indisponiveis).toEqual(["Adoção"]);
    expect(d.total).toBeGreaterThan(0);
    consoleSpy.mockRestore();
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
          // chunk sem a coluna da 0165: âncora na slugify da seção
          ancora: "2-encontro",
          material: null,
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
  afterEach(() => vi.unstubAllEnvs());

  it("escrita no chat devolve o MESMO pendente_confirmacao do MCP (REALIZA-126)", async () => {
    const { supabase, escritas } = supaFake({
      papel: "coordenacao",
      rpcData: { ia_confirmacao_criar: CID },
    });
    const r = await executarTool(
      "resolver_chamado",
      { chamado_id: UUID, resumo: "x" },
      supabase,
      "chat"
    );
    expect(r.ok).toBe(true);
    const d = dadosDe(r).pendente_confirmacao as Record<string, unknown>;
    expect(d.confirmacao_id).toBe(CID);
    expect(d.expira_em_minutos).toBe(10);
    // a prévia não executou nada
    expect(escritas).toHaveLength(0);
  });

  it("IA_ESCRITAS=0 restaura o erro de canal pra TODA escrita no chat", async () => {
    vi.stubEnv("IA_ESCRITAS", "0");
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

  it("IA_ESCRITAS=0 no MCP derruba só as 5 do domínio — chamados/jovem seguem", async () => {
    vi.stubEnv("IA_ESCRITAS", "0");
    const { supabase } = supaFake({
      papel: "coordenacao",
      rpcData: { ia_confirmacao_criar: CID },
    });
    const rDom = await executarTool(
      "registrar_interacao",
      { dupla_id: UUID, tipo: "contato" },
      supabase,
      "mcp"
    );
    expect(rDom.ok).toBe(false);
    if (!rDom.ok) expect(rDom.erro).toContain("não está disponível");
    // as escritas de chamados eram live antes da flag — não quebram
    const rChamado = await executarTool(
      "resolver_chamado",
      { chamado_id: UUID, resumo: "x" },
      supabase,
      "mcp"
    );
    expect(rChamado.ok).toBe(true);
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
    // o resumo nomeia por nome, nunca por id (026/FR-010) — chamado
    // invisível pro fake degrada pro genérico, também sem uuid
    expect(String(d.resumo)).toContain("chamado");
    expect(String(d.resumo)).not.toContain(UUID);
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

describe("escritas do domínio (REALIZA-126)", () => {
  const CID = "99999999-8888-4777-8666-555555555555";
  const FUTURO = "2099-01-05T19:00:00-03:00";
  afterEach(() => vi.unstubAllEnvs());

  const espiaRpc = (supabase: SupabaseClient) => {
    const rpcCalls: string[] = [];
    const orig = supabase.rpc.bind(supabase);
    vi.spyOn(supabase, "rpc").mockImplementation(((n: string, a?: unknown) => {
      rpcCalls.push(n);
      return orig(n, a as Record<string, unknown>);
    }) as never);
    return rpcCalls;
  };

  it("as 5 pedem prévia no chat e NÃO tocam a tabela sem confirmacao_id", async () => {
    const chamadas: [string, Record<string, unknown>][] = [
      ["registrar_interacao", { dupla_id: UUID, tipo: "contato", nota: "ok" }],
      ["marcar_situacao_mentorado", { mentorado_id: UUID, situacao: "concluido" }],
      ["emitir_link_instrumento", { dupla_id: UUID, sistema: "visao" }],
      ["editar_campo_pessoa", { pessoa_id: UUID, campo: "whatsapp", valor: "11987654321" }],
    ];
    for (const [tool, args] of chamadas) {
      const { supabase, escritas } = supaFake({
        papel: "coordenacao",
        rpcData: { ia_confirmacao_criar: CID },
      });
      const r = await executarTool(tool, args, supabase, "chat");
      expect(r.ok).toBe(true);
      const d = dadosDe(r).pendente_confirmacao as Record<string, unknown>;
      expect(d.confirmacao_id).toBe(CID);
      expect(d.tool).toBe(tool);
      // a prévia não executou o domínio
      expect(escritas).toHaveLength(0);
    }
    // agendar_encontro é do mentor, não da coord — idem
    const { supabase, escritas } = supaFake({
      papel: "mentor_dpp",
      rpcData: { ia_confirmacao_criar: CID },
    });
    const r = await executarTool(
      "agendar_encontro",
      { dupla_id: UUID, numero: 6, data_hora: FUTURO },
      supabase,
      "chat"
    );
    expect(r.ok).toBe(true);
    expect(escritas).toHaveLength(0);
  });

  it("registrar_interacao: consumo grava canal in_app e o autor da sessão", async () => {
    const { supabase, escritas } = supaFake({
      papel: "coordenacao",
      tabelas: { interacoes: [{ id: UUID }] },
      rpcData: { ia_confirmacao_consumir: "Registrar contato na dupla" },
    });
    const r = await executarTool(
      "registrar_interacao",
      {
        dupla_id: UUID,
        tipo: "apoio",
        nota: "atendido o pedido",
        confirmacao_id: CID,
      },
      supabase,
      "chat"
    );
    expect(r.ok).toBe(true);
    expect(escritas).toHaveLength(1);
    expect(escritas[0]).toMatchObject({
      tabela: "interacoes",
      op: "insert",
      payload: {
        dupla_id: UUID,
        canal: "in_app",
        tipo: "apoio",
        autor_id: "profile-fake",
        nota: "atendido o pedido",
      },
    });
  });

  it("registrar_interacao: 'nudge' é recusado pelo schema — nem gera prévia", async () => {
    const { supabase } = supaFake({ papel: "coordenacao" });
    const rpcCalls = espiaRpc(supabase);
    const r = await executarTool(
      "registrar_interacao",
      { dupla_id: UUID, tipo: "nudge" },
      supabase,
      "chat"
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.erro).toContain("Argumentos inválidos");
    expect(rpcCalls).not.toContain("ia_confirmacao_criar");
  });

  it("registrar_interacao: mentorado não alcança nem a prévia", async () => {
    const { supabase } = supaFake({ papel: "mentorado" });
    const rpcCalls = espiaRpc(supabase);
    const r = await executarTool(
      "registrar_interacao",
      { dupla_id: UUID, tipo: "contato" },
      supabase,
      "chat"
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.erro).toContain("não está disponível pro seu papel");
    expect(rpcCalls).not.toContain("ia_confirmacao_criar");
  });

  it("marcar_situacao_mentorado: consumo executa e devolve a recusa do core", async () => {
    const { supabase, escritas } = supaFake({
      papel: "coordenacao",
      tabelas: {
        duplas: [{ id: "dupla-viva-1" }], // bloqueia a saída
        mentorados: [{ id: UUID }],
      },
      rpcData: { ia_confirmacao_consumir: "Marcar situação" },
    });
    const r = await executarTool(
      "marcar_situacao_mentorado",
      { mentorado_id: UUID, situacao: "concluido", confirmacao_id: CID },
      supabase,
      "chat"
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.erro).toContain("dupla em andamento");
    // consumo aconteceu, a gravação não — o core recusou
    expect(escritas).toHaveLength(0);
  });

  it("marcar_situacao_mentorado: mentor DPP não alcança a prévia", async () => {
    const { supabase } = supaFake({ papel: "mentor_dpp" });
    const rpcCalls = espiaRpc(supabase);
    const r = await executarTool(
      "marcar_situacao_mentorado",
      { mentorado_id: UUID, situacao: "ativo" },
      supabase,
      "chat"
    );
    expect(r.ok).toBe(false);
    expect(rpcCalls).not.toContain("ia_confirmacao_criar");
  });

  it("emitir_link_instrumento: consumo devolve a URL /f/<token> da RPC", async () => {
    const { supabase } = supaFake({
      papel: "mentor_dpp",
      rpcData: {
        ia_confirmacao_consumir: "Emitir o link",
        emitir_link_instrumento: { token: "tok123", reutilizado: false },
      },
    });
    const r = await executarTool(
      "emitir_link_instrumento",
      { dupla_id: UUID, sistema: "visao", confirmacao_id: CID },
      supabase,
      "chat"
    );
    expect(r.ok).toBe(true);
    expect(dadosDe(r)).toMatchObject({
      url: "/f/tok123",
      reutilizado: false,
    });
  });

  it("agendar_encontro: coord não executa — 'quem agenda é a dupla' no core", async () => {
    // híbrido coord+mentor: o gate de papéis passa por mentor_dpp, mas o
    // core resolve o ator pelo PRIMÁRIO (my_role=coordenacao) e recusa —
    // a regra de domínio não é contornável pelo conjunto de papéis
    const { supabase, escritas } = supaFake({
      papel: "coordenacao",
      papeis: ["coordenacao", "mentor_dpp"],
      tabelas: {
        duplas: [{ status: "ativa", trilha: "dpp", cronograma_id: "c1" }],
      },
      rpcData: {
        ia_confirmacao_consumir: "Agendar",
        my_role: "coordenacao",
        my_profile_id: "coord-1",
      },
    });
    const r = await executarTool(
      "agendar_encontro",
      { dupla_id: UUID, numero: 6, data_hora: FUTURO, confirmacao_id: CID },
      supabase,
      "chat"
    );
    expect(r.ok).toBe(false);
    if (!r.ok)
      expect(r.erro).toBe(
        "Quem agenda é a dupla. A coordenação acompanha o andamento."
      );
    expect(escritas).toHaveLength(0);
  });

  it("agendar_encontro: mentor executa no consumo e grava agendado", async () => {
    const { supabase, escritas } = supaFake({
      papel: "mentor_dpp",
      tabelas: {
        duplas: [{ status: "ativa", trilha: "dpp", cronograma_id: "c1" }],
        ciclo_eventos: [{ numero: 16 }],
      },
      rpcData: {
        ia_confirmacao_consumir: "Agendar",
        my_role: "mentor_dpp",
        my_profile_id: "mentor-1",
      },
    });
    const r = await executarTool(
      "agendar_encontro",
      { dupla_id: UUID, numero: 6, data_hora: FUTURO, confirmacao_id: CID },
      supabase,
      "chat"
    );
    expect(r.ok).toBe(true);
    expect(escritas).toHaveLength(1);
    expect(escritas[0]).toMatchObject({
      tabela: "encontros",
      op: "insert",
      payload: { dupla_id: UUID, numero: 6, status: "agendado" },
    });
  });

  it("editar_campo_pessoa: allowlist do domínio — 'email' morre no schema", async () => {
    const { supabase } = supaFake({ papel: "coordenacao" });
    const rpcCalls = espiaRpc(supabase);
    for (const campo of ["email", "papel", "dados_civis", "nome", "notas"]) {
      const r = await executarTool(
        "editar_campo_pessoa",
        { pessoa_id: UUID, campo, valor: "x" },
        supabase,
        "chat"
      );
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.erro).toContain("Argumentos inválidos");
    }
    expect(rpcCalls).not.toContain("ia_confirmacao_criar");
  });

  it("editar_campo_pessoa: whatsapp normaliza e grava em profiles", async () => {
    const { supabase, escritas } = supaFake({
      papel: "coordenacao",
      tabelas: { profiles: [{ id: UUID }] },
      rpcData: {
        ia_confirmacao_consumir: "Editar whatsapp",
        my_role: "coordenacao",
        my_profile_id: "coord-1",
      },
    });
    const r = await executarTool(
      "editar_campo_pessoa",
      {
        pessoa_id: UUID,
        campo: "whatsapp",
        valor: "11 98765-4321",
        confirmacao_id: CID,
      },
      supabase,
      "chat"
    );
    expect(r.ok).toBe(true);
    expect(escritas[0]).toMatchObject({
      tabela: "profiles",
      op: "update",
      payload: { whatsapp: "5511987654321" },
    });
  });
});

describe("retroativo do jovem — tools da Liza (461, RPCs 0207/0208)", () => {
  const CID = "99999999-8888-4777-8666-555555555555";
  const PASSADO = "2025-10-21T19:00:00-03:00";

  const espiaRpc = (supabase: SupabaseClient) => {
    const rpcCalls: { nome: string; args?: Record<string, unknown> }[] = [];
    const orig = supabase.rpc.bind(supabase);
    vi.spyOn(supabase, "rpc").mockImplementation(((n: string, a?: unknown) => {
      rpcCalls.push({ nome: n, args: a as Record<string, unknown> });
      return orig(n, a as Record<string, unknown>);
    }) as never);
    return rpcCalls;
  };

  // dupla DPP ativa com passos 1–4 vencidos e o 5º (último) futuro; o jovem
  // é autor do retroativo do nº3 e o nº4 já foi registrado pelo mentor
  const retroFake = (over: Opts = {}) =>
    supaFake({
      papel: "mentorado",
      tabelas: {
        jovem_duplas: [{ id: "d-1", trilha: "dpp", status: "ativa" }],
        encontros: [
          {
            id: "e-3",
            numero: 3,
            status: "realizado",
            realizado_em: "2025-10-21T22:00:00Z",
            created_by: "profile-fake",
          },
          {
            id: "e-4",
            numero: 4,
            status: "realizado",
            realizado_em: "2025-10-28T22:00:00Z",
            created_by: "mentor-1",
          },
        ],
      },
      rpcData: {
        jovem_jornada: {
          cronograma: [
            { tipo: "encontro", numero: 1, data: "2025-10-07" },
            { tipo: "encontro", numero: 2, data: "2025-10-14" },
            { tipo: "formacao", numero: null, data: "2025-10-15" },
            { tipo: "encontro", numero: 3, data: "2025-10-21" },
            { tipo: "encontro", numero: 4, data: "2025-10-28" },
            { tipo: "encontro", numero: 5, data: "2099-01-01" },
          ],
        },
        ...over.rpcData,
      },
      ...over,
    });

  it("encontros_retroativo: vencidos sem row entram; ocupados, último e futuro ficam de fora", async () => {
    const { supabase } = retroFake();
    const r = await executarTool("encontros_retroativo", {}, supabase, "chat");
    expect(r.ok).toBe(true);
    const d = dadosDe(r) as {
      dupla_id: string;
      elegiveis: { numero: number }[];
      criados_por_voce: { encontro_id: string; numero: number }[];
    };
    expect(d.dupla_id).toBe("d-1");
    expect(d.elegiveis.map((e) => e.numero)).toEqual([1, 2]);
    expect(d.criados_por_voce).toEqual([
      { encontro_id: "e-3", numero: 3, realizado_em: "2025-10-21T22:00:00Z" },
    ]);
  });

  it("encontros_retroativo: trilha de especialista e dupla encerrada devolvem null", async () => {
    for (const dupla of [
      { id: "d-1", trilha: "especialista", status: "ativa" },
      { id: "d-1", trilha: "dpp", status: "concluida" },
    ]) {
      const { supabase } = supaFake({
        papel: "mentorado",
        tabelas: { jovem_duplas: [dupla] },
      });
      const r = await executarTool("encontros_retroativo", {}, supabase, "chat");
      expect(r.ok).toBe(true);
      expect(dadosDe(r)).toBeNull();
    }
  });

  it("jovem_registrar_retroativo: prévia não toca a RPC; consumo chama com p_*", async () => {
    const { supabase } = retroFake({
      rpcData: { ia_confirmacao_criar: CID },
    });
    const rpcCalls = espiaRpc(supabase);
    const args = { dupla_id: UUID, numero: 2, data_hora: PASSADO };

    const r1 = await executarTool("jovem_registrar_retroativo", args, supabase, "chat");
    expect(r1.ok).toBe(true);
    const p = dadosDe(r1).pendente_confirmacao as Record<string, unknown>;
    expect(p.confirmacao_id).toBe(CID);
    expect(rpcCalls.map((c) => c.nome)).toContain("ia_confirmacao_criar");
    expect(rpcCalls.map((c) => c.nome)).not.toContain("registrar_retroativo_mentorado");

    const { supabase: s2 } = retroFake({
      rpcData: {
        ia_confirmacao_consumir: "Registrar",
        registrar_retroativo_mentorado: { encontro_id: "e-2" },
      },
    });
    const calls2 = espiaRpc(s2);
    const r2 = await executarTool(
      "jovem_registrar_retroativo",
      { ...args, confirmacao_id: CID },
      s2,
      "chat"
    );
    expect(r2.ok).toBe(true);
    const dom = calls2.find((c) => c.nome === "registrar_retroativo_mentorado");
    expect(dom?.args).toEqual({
      p_dupla: UUID,
      p_numero: 2,
      p_data_hora: PASSADO,
    });
  });

  it("jovem_registrar_retroativo: schema barra nº fora do guia e campo extra", async () => {
    const { supabase } = retroFake();
    const rpcCalls = espiaRpc(supabase);
    for (const args of [
      { dupla_id: UUID, numero: 17, data_hora: PASSADO },
      { dupla_id: UUID, numero: 2, data_hora: PASSADO, nota: "livre" },
      { numero: 2, data_hora: PASSADO },
    ]) {
      const r = await executarTool(
        "jovem_registrar_retroativo",
        args,
        supabase,
        "chat"
      );
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.erro).toContain("Argumentos inválidos");
    }
    expect(rpcCalls.map((c) => c.nome)).not.toContain("ia_confirmacao_criar");
  });

  it("jovem_registrar_retroativo: a recusa da RPC sobe em pt-BR", async () => {
    const { supabase } = retroFake({
      rpcData: {
        ia_confirmacao_consumir: "Registrar",
        registrar_retroativo_mentorado: {
          error: "O último encontro fecha a jornada — quem registra é o mentor.",
        },
      },
    });
    const r = await executarTool(
      "jovem_registrar_retroativo",
      { dupla_id: UUID, numero: 16, data_hora: PASSADO, confirmacao_id: CID },
      supabase,
      "chat"
    );
    expect(r.ok).toBe(false);
    if (!r.ok)
      expect(r.erro).toBe(
        "O último encontro fecha a jornada — quem registra é o mentor."
      );
  });

  it("jovem_desfazer_retroativo: consumo chama a RPC com o encontro", async () => {
    const { supabase } = retroFake({
      rpcData: { ia_confirmacao_consumir: "Desfazer" },
    });
    const rpcCalls = espiaRpc(supabase);
    const r = await executarTool(
      "jovem_desfazer_retroativo",
      { encontro_id: UUID, confirmacao_id: CID },
      supabase,
      "chat"
    );
    expect(r.ok).toBe(true);
    const dom = rpcCalls.find((c) => c.nome === "desfazer_retroativo_mentorado");
    expect(dom?.args).toEqual({ p_encontro: UUID });
  });

  it("staff não alcança nem a prévia das tools do retroativo", async () => {
    const { supabase } = supaFake({ papel: "mentor_dpp" });
    const rpcCalls = espiaRpc(supabase);
    for (const [tool, args] of [
      ["encontros_retroativo", {}],
      ["jovem_registrar_retroativo", { dupla_id: UUID, numero: 2, data_hora: PASSADO }],
      ["jovem_desfazer_retroativo", { encontro_id: UUID }],
    ] as const) {
      const r = await executarTool(tool, args, supabase, "chat");
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.erro).toContain("não está disponível pro seu papel");
    }
    expect(rpcCalls.map((c) => c.nome)).not.toContain("ia_confirmacao_criar");
  });
});

// ---------- resumos de confirmação nomeiam por nomes (026/FR-010) ----------
// O card de confirmação mostra o `resumo` — uuid interpolado virava
// texto visível. Agora o resumo é async e recebe o supabase: nomeia por
// nomes e número de encontro ("o 5º encontro de Ana e Ricardo"), e um
// lookup invisível pra RLS cai no genérico sem id. Aqui se prova as duas
// pontas: zero uuid em TODOS os resumos de escrita e os nomes de fato.

const UUID_RE =
  /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

// um valor pra cada campo que algum resumo lê — cada resumo ignora o resto
const ARGS_RESUMO = {
  dupla_id: UUID,
  plano_id: UUID,
  chamado_id: UUID,
  encontro_id: UUID,
  combinado_id: UUID,
  solicitacao_id: UUID,
  mentorado_id: UUID,
  pessoa_id: UUID,
  para: UUID,
  numero: 5,
  data_hora: "2026-12-01T19:00:00-03:00",
  ritmo: 2,
  acao: "aceitar",
  tipo: "contato",
  destino: "a coordenação",
  ajustes: [{ sugestao: "chegar 10 min antes" }],
  categoria: "agenda",
  assunto: "app não abre",
  usa: true,
  feito: true,
  situacao: "desistente",
  sistema: "metas",
  campo: "whatsapp",
  valor: "11999990000",
  slot: "2026-12-02T19:00:00-03:00",
  nota: "falou com o mentor",
};

type ResumoFn = (
  a: never,
  s: SupabaseClient
) => string | Promise<string>;

const resumoDe = (nome: (typeof IA_TOOL_NOMES)[number]) =>
  (IA_TOOLS[nome] as unknown as { resumo?: ResumoFn }).resumo;

const TABELAS_NOMES = {
  duplas: [
    {
      id: UUID,
      mentor_id: null,
      supervisor_id: null,
      mentor: { nome: "Ricardo Alves", nome_social: null },
      mentorado: { nome: "Ana Beatriz", nome_social: null },
    },
  ],
  encontros: [
    {
      numero: 5,
      dupla: {
        id: UUID,
        mentor: { nome: "Ricardo Alves", nome_social: null },
        mentorado: { nome: "Ana Beatriz", nome_social: null },
      },
    },
  ],
  chamados: [{ numero: 7, assunto: "app não abre" }],
  dupla_planos: [{ dupla_id: UUID }],
  solicitacoes_mural: [
    {
      id: UUID,
      mentorado_nome: "Caio Silva",
      mentorado_nome_social: null,
      especialista_nome: null,
      especialista_nome_social: null,
    },
  ],
  jovem_encaminhamentos: [{ texto: "levar o RG" }],
  profiles: [{ nome: "Sara Lima", nome_social: null }],
  mentorados: [{ nome: "Caio Silva", nome_social: null }],
};

describe("resumo de confirmação — zero uuid em texto visível (FR-010)", () => {
  it("todo resumo de tool escreve sai sem id cru", async () => {
    const { supabase } = supaFake({ tabelas: TABELAS_NOMES });
    const semResumo: string[] = [];
    for (const nome of IA_TOOL_NOMES) {
      const t = IA_TOOLS[nome] as unknown as {
        escreve?: boolean;
        resumo?: ResumoFn;
      };
      if (!t.escreve) continue;
      if (!t.resumo) {
        semResumo.push(nome);
        continue;
      }
      const r = await t.resumo(ARGS_RESUMO as never, supabase);
      expect(r, `resumo de ${nome}`).not.toMatch(UUID_RE);
    }
    // o contrato é todas as escritas terem resumo próprio — a contagem
    // trava ferramenta nova sem ele
    expect(semResumo).toEqual([]);
  });

  it("nomeia dupla, encontro, chamado e pessoa pelos nomes", async () => {
    const { supabase } = supaFake({ tabelas: TABELAS_NOMES });
    expect(
      await resumoDe("desmarcar_encontro")!(
        { encontro_id: UUID } as never,
        supabase
      )
    ).toBe("Desmarcar o 5º encontro de Ana Beatriz e Ricardo Alves");
    expect(
      await resumoDe("resolver_chamado")!(
        { chamado_id: UUID } as never,
        supabase
      )
    ).toBe('Resolver o chamado #7 (app não abre)');
    expect(
      await resumoDe("declarar_recesso")!(
        { dupla_id: UUID, usa: false } as never,
        supabase
      )
    ).toBe("Atravessar o recesso na dupla de Ana Beatriz e Ricardo Alves");
    expect(
      await resumoDe("plano_propor")!(
        { dupla_id: UUID } as never,
        supabase
      )
    ).toBe(
      'Propor o plano "ficar em dia" de Ana Beatriz e Ricardo Alves no ritmo mais leve que fecha'
    );
    expect(
      await resumoDe("atribuir_chamado")!(
        { chamado_id: UUID, para: UUID } as never,
        supabase
      )
    ).toBe("Atribuir o chamado #7 (app não abre) para Sara Lima");
    expect(
      await resumoDe("marcar_situacao_mentorado")!(
        { mentorado_id: UUID, situacao: "desistente" } as never,
        supabase
      )
    ).toBe('Marcar situação "desistente" de Sara Lima');
    expect(
      await resumoDe("aceitar_solicitacao")!(
        { solicitacao_id: UUID } as never,
        supabase
      )
    ).toBe("Aceitar o pedido de especialista de Caio Silva");
    expect(
      await resumoDe("jovem_marcar_combinado")!(
        { combinado_id: UUID, feito: true } as never,
        supabase
      )
    ).toBe('Marcar feito o combinado "levar o RG"');
  });

  it("lookup invisível pra RLS degrada pro genérico sem id", async () => {
    const { supabase } = supaFake({ tabelas: {} });
    expect(
      await resumoDe("desmarcar_encontro")!(
        { encontro_id: UUID } as never,
        supabase
      )
    ).toBe("Desmarcar o encontro");
    expect(
      await resumoDe("resolver_chamado")!(
        { chamado_id: UUID } as never,
        supabase
      )
    ).toBe("Resolver o chamado");
    expect(
      await resumoDe("declarar_recesso")!(
        { dupla_id: UUID, usa: true } as never,
        supabase
      )
    ).toBe("Usar o recesso na dupla");
  });

  it("datas nos resumos saem legíveis, nunca ISO cru (527)", async () => {
    const { supabase } = supaFake({ tabelas: TABELAS_NOMES });
    const ISO_RE = /\d{4}-\d{2}-\d{2}T/;
    const casos: [string, Record<string, unknown>][] = [
      [
        "plano_aplicar_passo",
        { plano_id: UUID, numero: 3, data_hora: "2026-12-01T19:00:00-03:00" },
      ],
      [
        "agendar_encontro",
        { dupla_id: UUID, numero: 5, data_hora: "2026-12-01T19:00:00-03:00" },
      ],
      [
        "jovem_agendar_encontro",
        { dupla_id: UUID, numero: 5, data_hora: "2026-12-01T19:00:00-03:00" },
      ],
      [
        "jovem_registrar_retroativo",
        { dupla_id: UUID, numero: 4, data_hora: "2026-11-28T15:00:00-03:00" },
      ],
      [
        "contra_propor_solicitacao",
        { solicitacao_id: UUID, slot: "2026-12-02T19:00:00-03:00" },
      ],
    ];
    for (const [nome, args] of casos) {
      const r = await resumoDe(nome as (typeof IA_TOOL_NOMES)[number])!(
        args as never,
        supabase
      );
      expect(r, `resumo de ${nome}`).not.toMatch(ISO_RE);
      // a data continua presente, só que na forma que a pessoa lê
      expect(r, `resumo de ${nome}`).toMatch(/\d{2}\/\d{2} às \d{2}:\d{2}/);
    }
  });
});
