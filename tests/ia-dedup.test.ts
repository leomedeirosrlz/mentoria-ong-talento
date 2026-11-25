// Dedup de resultado por sessão (opcoes.dedupKey do executarTool): a
// mesma conversa repetindo uma tool de leitura com os mesmos args serve
// o resultado guardado (TTL 90s) em vez de re-rodar a query — marcando
// args.cache no evento pra telemetria contar as poupadas. Tool de
// escrita e guia_consulta ficam fora por contrato.
// O supabase fake é o mesmo chainable mínimo do ia-tools.test.ts: o que
// se conta aqui é quantas vezes a tool leu (from) ou chamou RPC.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  executarTool,
  limparDedupTools,
  type EventoIa,
} from "@/lib/ia/tools";
import { limparCacheIaConfig } from "@/lib/ia/config";
import { limparCacheGuias } from "@/lib/ia/guias";
import type { AppRole } from "@/lib/types";

const UUID = "11111111-2222-4333-8444-555555555555";
const CID = "99999999-8888-4777-8666-555555555555";
const PAPEIS: AppRole[] = ["coordenacao"];

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
  const fromCalls: string[] = [];
  const rpcCalls: string[] = [];

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
      then: (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) =>
        Promise.resolve({ data: rows(), error: null }).then(res, rej),
    };
    return b;
  };

  const supabase = {
    from: (tabela: string) => {
      fromCalls.push(tabela);
      return builder(tabela);
    },
    rpc: (nome: string) => {
      rpcCalls.push(nome);
      if (nome === "my_papeis")
        return { data: papel ? [papel] : [], error: null };
      if (nome === "registrar_ia_evento") {
        const erro = rpcErro[nome] ?? null;
        return {
          error: erro,
          then(res: (v: unknown) => unknown) {
            return Promise.resolve(res({ error: erro }));
          },
        };
      }
      return { data: rpcData[nome] ?? null, error: rpcErro[nome] ?? null };
    },
  };
  return {
    supabase: supabase as unknown as SupabaseClient,
    fromCalls,
    rpcCalls,
  };
}

/** Atalho: chat com dedup de sessão + coleta do evento de auditoria. */
const exec = (
  nome: string,
  args: unknown,
  supabase: SupabaseClient,
  opts: {
    dedupKey?: string;
    canal?: "chat" | "mcp";
    eventos?: EventoIa[];
  } = {}
) =>
  executarTool(nome, args, supabase, opts.canal ?? "chat", PAPEIS, undefined, "req-t", {
    dedupKey: opts.dedupKey ?? "sessao-1",
    coletarEvento: (ev) => opts.eventos?.push(ev),
  });

beforeEach(() => {
  // caches por módulo: dedup + os internos de config/guias
  limparDedupTools();
  limparCacheIaConfig();
  limparCacheGuias();
});
afterEach(() => vi.useRealTimers());

describe("dedup por sessão", () => {
  it("a 2ª chamada idêntica devolve o mesmo objeto sem re-rodar a query", async () => {
    const { supabase, fromCalls } = supaFake({
      tabelas: {
        duplas: [
          { id: "d-1", trilha: "dpp", status: "ativa", turma: "T1",
            mentor: { nome: "Ana" }, mentorado: { nome: "Luisa" } },
        ],
      },
    });
    const eventos: EventoIa[] = [];
    const r1 = await exec("duplas_do_usuario", {}, supabase, { eventos });
    const n1 = fromCalls.length;
    const r2 = await exec("duplas_do_usuario", {}, supabase, { eventos });

    expect(r1.ok && r2.ok).toBe(true);
    if (r1.ok && r2.ok) expect(r2.dados).toBe(r1.dados); // MESMO objeto
    expect(fromCalls.length).toBe(n1); // nenhuma leitura nova
    // telemetria: o hit sai marcado, o miss não
    expect(eventos[0].args).not.toHaveProperty("cache");
    expect(eventos[1].args).toMatchObject({ cache: true });
    expect(eventos[1].duracao_ms ?? 99).toBeLessThan(10); // ~0: hit não mede query
  });

  it("args com chaves em ordem diferente batem na mesma chave", async () => {
    const { supabase, fromCalls } = supaFake({
      tabelas: { registros: [] },
    });
    const r1 = await exec(
      "registros_da_dupla",
      { dupla_id: UUID, limite: 3 },
      supabase
    );
    const n1 = fromCalls.length;
    const r2 = await exec(
      "registros_da_dupla",
      { limite: 3, dupla_id: UUID }, // ordem invertida
      supabase
    );
    expect(r2.ok && r1.ok).toBe(true);
    if (r1.ok && r2.ok) expect(r2.dados).toBe(r1.dados);
    expect(fromCalls.length).toBe(n1);
  });

  it("outra sessão não divide a entrada", async () => {
    const { supabase, fromCalls } = supaFake({ tabelas: { duplas: [] } });
    const r1 = await exec("duplas_do_usuario", {}, supabase, {
      dedupKey: "sessao-A",
    });
    const r2 = await exec("duplas_do_usuario", {}, supabase, {
      dedupKey: "sessao-B",
    });
    expect(fromCalls).toHaveLength(2);
    if (r1.ok && r2.ok) expect(r2.dados).not.toBe(r1.dados);
  });

  it("chamadas simultâneas idênticas dividem uma execução só", async () => {
    const { supabase, fromCalls } = supaFake({ tabelas: { duplas: [] } });
    const eventos: EventoIa[] = [];
    const [r1, r2] = await Promise.all([
      exec("duplas_do_usuario", {}, supabase, { eventos }),
      exec("duplas_do_usuario", {}, supabase, { eventos }),
    ]);
    expect(fromCalls).toHaveLength(1); // o in-flight da CacheTtl coalesce
    if (r1.ok && r2.ok) expect(r2.dados).toBe(r1.dados);
    // quem rodou sai sem marca; quem dividiu a promessa conta como cache
    expect(eventos.map((e) => e.args.cache ?? false).sort()).toEqual([
      false,
      true,
    ]);
  });

  it("falha não fica guardada — a chamada seguinte tenta de novo", async () => {
    const { supabase, rpcCalls } = supaFake({
      rpcErro: { instrumentos_da_dupla: { message: "banco fora" } },
    });
    const erroSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const r1 = await exec("instrumentos_da_dupla", { dupla_id: UUID }, supabase);
    const r2 = await exec("instrumentos_da_dupla", { dupla_id: UUID }, supabase);
    expect(r1.ok).toBe(false);
    expect(r2.ok).toBe(false);
    expect(rpcCalls.filter((n) => n === "instrumentos_da_dupla")).toHaveLength(2);
    erroSpy.mockRestore();
  });

  it("passado o TTL a query roda de novo", async () => {
    vi.useFakeTimers();
    const { supabase, fromCalls } = supaFake({ tabelas: { duplas: [] } });
    await exec("duplas_do_usuario", {}, supabase);
    vi.advanceTimersByTime(89_999);
    await exec("duplas_do_usuario", {}, supabase);
    expect(fromCalls).toHaveLength(1); // ainda dentro dos 90s
    vi.advanceTimersByTime(2);
    await exec("duplas_do_usuario", {}, supabase);
    expect(fromCalls).toHaveLength(2);
  });
});

describe("dedup — fora do contrato", () => {
  it("tool de escrita não deduplica: cada chamada grava a própria prévia", async () => {
    const { supabase, rpcCalls } = supaFake({
      rpcData: { ia_confirmacao_criar: CID },
    });
    const args = { chamado_id: UUID, resumo: "x" };
    const r1 = await exec("resolver_chamado", args, supabase, { canal: "mcp" });
    const r2 = await exec("resolver_chamado", args, supabase, { canal: "mcp" });
    expect(r1.ok && r2.ok).toBe(true);
    // duas prévias distintas — deduplicar escrita quebraria o 2-passos
    expect(rpcCalls.filter((n) => n === "ia_confirmacao_criar")).toHaveLength(2);
  });

  it("guia_consulta não deduplica — a route já limita a uma busca por resposta", async () => {
    const { supabase } = supaFake({ rpcData: { match_ia_chunks: [] } });
    const eventos: EventoIa[] = [];
    const args = { pergunta: "o que é a Roda da Vida?" };
    const r1 = await exec("guia_consulta", args, supabase, { eventos });
    const r2 = await exec("guia_consulta", args, supabase, { eventos });
    expect(r1.ok && r2.ok).toBe(true);
    // o run executou nas duas (envelope novo); o que segue cacheado é o
    // cache interno de guias.ts — a fontes volta pelo dedup dele
    if (r1.ok && r2.ok) {
      expect(r2.dados).not.toBe(r1.dados);
      const d1 = r1.dados as { fontes: unknown };
      const d2 = r2.dados as { fontes: unknown };
      expect(d2.fontes).toBe(d1.fontes);
    }
    expect(eventos[1].args).not.toHaveProperty("cache");
  });

  it("sem dedupKey (caminho do MCP) nada fica guardado", async () => {
    const { supabase, fromCalls } = supaFake({ tabelas: { duplas: [] } });
    await executarTool("duplas_do_usuario", {}, supabase, "mcp", PAPEIS);
    await executarTool("duplas_do_usuario", {}, supabase, "mcp", PAPEIS);
    expect(fromCalls).toHaveLength(2);
    // e nem semeou a chave da sessão seguinte
    await exec("duplas_do_usuario", {}, supabase);
    expect(fromCalls).toHaveLength(3);
  });
});
