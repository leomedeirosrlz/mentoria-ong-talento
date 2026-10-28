// checarLimiteIa — o teto é uma contagem head-only em ia_eventos, no
// recorte do PRÓPRIO profile nos últimos 60s (o ledger de auditoria já é
// a fonte, não precisa de estrutura nova). O supabase fake é chainable no
// mínimo que a query usa — .from().select().eq().gte() awaited direto —
// e grava os filtros pra provar que o recorte é por profile e por janela.
//
// CONTRATO ASSUMIDO NA ESCRITA DESTE TESTE: erro de contagem é FAIL-CLOSED —
// a função loga e retorna true (a mensagem NÃO passa): em serverless não
// existe estado local confiável pra provar baixa atividade, e liberar com
// o DB degradado abre custo de LLM sem teto. Se a implementação voltar a
// fail-open, o caso "erro de contagem" é o que deve passar a esperar
// `false`. (O arquivo mudou de fail-open pra fail-closed durante a
// escrita desta suíte — o teste segue a implementação atual.)

import { afterEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { checarLimiteIa } from "@/lib/ia/rate-limit";

type Resposta = { count: number | null; error: { message: string } | null };

function supaFake(res: Resposta) {
  const filtros: { metodo: string; args: unknown[] }[] = [];
  const tabelas: string[] = [];

  // builder thenable: a query termina no await direto sobre a cadeia —
  // select/eq/gte só registram a chamada e devolvem o próprio builder
  const builder: Record<string, unknown> = {};
  for (const metodo of ["select", "eq", "gte"]) {
    builder[metodo] = (...args: unknown[]) => {
      filtros.push({ metodo, args });
      return builder;
    };
  }
  builder.then = (
    onOk: (v: unknown) => unknown,
    onErro?: (e: unknown) => unknown
  ) => Promise.resolve({ count: res.count, error: res.error }).then(onOk, onErro);

  const supabase = {
    from: (tabela: string) => {
      tabelas.push(tabela);
      return builder;
    },
  };
  return {
    supabase: supabase as unknown as SupabaseClient,
    filtros,
    tabelas,
  };
}

const filtro = (f: { metodo: string; args: unknown[] }[], m: string) =>
  f.find((x) => x.metodo === m);

describe("checarLimiteIa", () => {
  afterEach(() => vi.restoreAllMocks());

  it("estoura no limite: count igual ao teto já bloqueia", async () => {
    const { supabase } = supaFake({ count: 20, error: null });
    expect(await checarLimiteIa(supabase, "p-1")).toBe(true);
  });

  it("acima do teto também bloqueia", async () => {
    const { supabase } = supaFake({ count: 47, error: null });
    expect(await checarLimiteIa(supabase, "p-1")).toBe(true);
  });

  it("abaixo do teto deixa passar — inclusive zero e count nulo", async () => {
    const a = supaFake({ count: 19, error: null });
    expect(await checarLimiteIa(a.supabase, "p-1")).toBe(false);

    const b = supaFake({ count: 0, error: null });
    expect(await checarLimiteIa(b.supabase, "p-1")).toBe(false);

    // PostgREST sem linhas devolve count null — null não é estouro
    const c = supaFake({ count: null, error: null });
    expect(await checarLimiteIa(c.supabase, "p-1")).toBe(false);
  });

  it("o teto é parâmetro do caller: limite menor estoura antes", async () => {
    const { supabase } = supaFake({ count: 3, error: null });
    expect(await checarLimiteIa(supabase, "p-1", 3)).toBe(true);
    expect(await checarLimiteIa(supabase, "p-1", 4)).toBe(false);
  });

  it("conta só o próprio profile na janela de 60s, head-only", async () => {
    const { supabase, filtros, tabelas } = supaFake({ count: 0, error: null });
    await checarLimiteIa(supabase, "p-42");

    // uma query só, na tabela-ledger — é o eq(profile_id) que mantém o
    // recorte próprio mesmo pra coordenação (que pela RLS lê o de todos)
    expect(tabelas).toEqual(["ia_eventos"]);
    expect(filtro(filtros, "select")?.args[1]).toEqual({
      count: "exact",
      head: true,
    });
    expect(filtro(filtros, "eq")?.args).toEqual(["profile_id", "p-42"]);

    const gte = filtro(filtros, "gte");
    expect(gte?.args[0]).toBe("created_at");
    // a janela é "agora menos 60s" — o carimbo tem que ter acabado de
    // ser derivado do relógio, não ser uma data fixa
    const diff = Date.now() - Date.parse(String(gte?.args[1]));
    expect(diff).toBeGreaterThanOrEqual(60_000);
    expect(diff).toBeLessThan(62_000);
  });

  it("erro de contagem é fail-closed: loga e bloqueia a mensagem", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const { supabase } = supaFake({
      count: null,
      error: { message: "postgrest down" },
    });
    expect(await checarLimiteIa(supabase, "p-1")).toBe(true);
    expect(spy).toHaveBeenCalledWith(
      "checarLimiteIa:",
      expect.objectContaining({ message: "postgrest down" })
    );
  });
});
