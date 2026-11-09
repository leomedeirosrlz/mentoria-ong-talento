// consumirLimiteIa — o limite agora é a RPC consumir_limite_ia (migration
// 0159): check+insert do evento 'mensagem' sob advisory lock por profile,
// o que fecha o TOCTOU do desenho anterior (contava no client, inseria
// dentro do stream — N requests paralelos liam o mesmo count e passavam
// juntos). O supabase fake só precisa de .rpc(): o teste prova o mapeamento
// do veredicto e o request_id que correlaciona os eventos da request.
//
// CONTRATO: erro da RPC é FAIL-CLOSED — a mensagem NÃO passa. Em serverless
// não existe estado local confiável pra provar baixa atividade, e liberar
// com o DB degradado abre custo de LLM sem teto. O 429 é recuperável com
// retry do cliente (a bolha já trata erro genérico).

import { afterEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { consumirLimiteIa, contextoELimiteIa } from "@/lib/ia/rate-limit";

type RespostaRpc = {
  data: unknown;
  error: { message: string } | null;
};

function supaFake(res: RespostaRpc) {
  const chamadas: { fn: string; args: unknown }[] = [];
  const supabase = {
    rpc: (fn: string, args: unknown) => {
      chamadas.push({ fn, args });
      return Promise.resolve({ data: res.data, error: res.error });
    },
  };
  return {
    supabase: supabase as unknown as SupabaseClient,
    chamadas,
  };
}

describe("consumirLimiteIa", () => {
  afterEach(() => vi.restoreAllMocks());

  it("permitido: repassa usados e o request_id da RPC", async () => {
    const { supabase, chamadas } = supaFake({
      data: { permitido: true, usados: 3, request_id: "req-1" },
      error: null,
    });
    const v = await consumirLimiteIa(supabase, { pergunta: "oi" });
    expect(v).toEqual({ permitido: true, usados: 3, requestId: "req-1" });

    // uma RPC só — o check+insert é atômico no banco, não há segunda
    // chamada de insert aqui
    expect(chamadas).toHaveLength(1);
    expect(chamadas[0].fn).toBe("consumir_limite_ia");
    expect(chamadas[0].args).toEqual({
      p_args: { pergunta: "oi" },
      p_limite: 20,
      p_canal: "chat",
    });
  });

  it("negado: limite estourado volta sem request_id", async () => {
    const { supabase } = supaFake({
      data: { permitido: false, usados: 20, request_id: null },
      error: null,
    });
    const v = await consumirLimiteIa(supabase, {});
    expect(v).toEqual({ permitido: false, usados: 20 });
  });

  it("o teto e o canal são parâmetros do caller (MCP compartilha o ledger)", async () => {
    const { supabase, chamadas } = supaFake({
      data: { permitido: false, usados: 3, request_id: null },
      error: null,
    });
    await consumirLimiteIa(supabase, { tool: "ficha_dupla" }, "mcp", 3);
    expect(chamadas[0].args).toEqual({
      p_args: { tool: "ficha_dupla" },
      p_limite: 3,
      p_canal: "mcp",
    });
  });

  it("RPC retornando linha em array também resolve", async () => {
    const { supabase } = supaFake({
      data: [{ permitido: true, usados: 1, request_id: "req-arr" }],
      error: null,
    });
    const v = await consumirLimiteIa(supabase, {});
    expect(v).toEqual({ permitido: true, usados: 1, requestId: "req-arr" });
  });

  it("resposta malformada (data nulo/sem request_id) bloqueia", async () => {
    const a = supaFake({ data: null, error: null });
    expect(await consumirLimiteIa(a.supabase, {})).toEqual({
      permitido: false,
      usados: 20,
    });

    const b = supaFake({
      data: { permitido: true, usados: 1, request_id: null },
      error: null,
    });
    const v = await consumirLimiteIa(b.supabase, {});
    expect(v.permitido).toBe(false);
  });

  it("erro da RPC é fail-closed: loga e bloqueia a mensagem", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const { supabase } = supaFake({
      data: null,
      error: { message: "postgrest down" },
    });
    expect(await consumirLimiteIa(supabase, {})).toEqual({
      permitido: false,
      usados: 20,
    });
    expect(spy).toHaveBeenCalledWith(
      "consumirLimiteIa:",
      expect.objectContaining({ message: "postgrest down" })
    );
  });
});

// contextoELimiteIa — o chat junta identidade (profile ativo, papel, papéis
// efetivos) e a reserva do limite numa RPC só (ia_contexto_e_limite, 0160).
// Mesmo fail-closed do consumirLimiteIa, mas erro vira "negado" (429), não
// "sem_cadastro" (401): banco degradado não deve mandar ninguém pro login.
describe("contextoELimiteIa", () => {
  afterEach(() => vi.restoreAllMocks());

  const LINHA = {
    profile_id: "prof-1",
    role: "mentor_dpp",
    papeis: ["mentor_dpp", "mentorado"],
    permitido: true,
    usados: 2,
    request_id: "req-1",
  };

  it("ok: uma RPC devolve identidade + veredicto + request_id", async () => {
    const { supabase, chamadas } = supaFake({ data: [LINHA], error: null });
    const v = await contextoELimiteIa(supabase, { n_mensagens: 1 });
    expect(v).toEqual({
      status: "ok",
      profileId: "prof-1",
      role: "mentor_dpp",
      papeis: ["mentor_dpp", "mentorado"],
      usados: 2,
      requestId: "req-1",
    });
    expect(chamadas).toEqual([
      {
        fn: "ia_contexto_e_limite",
        args: { p_args: { n_mensagens: 1 }, p_limite: 20, p_canal: "chat" },
      },
    ]);
  });

  it("profile inativo/desconhecido (profile_id null) vira sem_cadastro", async () => {
    const { supabase } = supaFake({
      data: [{ ...LINHA, profile_id: null, permitido: false, request_id: null }],
      error: null,
    });
    expect(await contextoELimiteIa(supabase, {})).toEqual({
      status: "sem_cadastro",
    });
    const vazio = supaFake({ data: [], error: null });
    expect(await contextoELimiteIa(vazio.supabase, {})).toEqual({
      status: "sem_cadastro",
    });
  });

  it("limite estourado vira negado com os usados", async () => {
    const { supabase } = supaFake({
      data: { ...LINHA, permitido: false, usados: 20, request_id: null },
      error: null,
    });
    expect(await contextoELimiteIa(supabase, {})).toEqual({
      status: "negado",
      usados: 20,
    });
  });

  it("papeis nulo vira lista vazia (a rota cai no role)", async () => {
    const { supabase } = supaFake({
      data: [{ ...LINHA, papeis: null }],
      error: null,
    });
    const v = await contextoELimiteIa(supabase, {});
    expect(v.status === "ok" && v.papeis).toEqual([]);
  });

  it("erro da RPC é fail-closed como negado (429), não 401", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const { supabase } = supaFake({
      data: null,
      error: { message: "postgrest down" },
    });
    expect(await contextoELimiteIa(supabase, {})).toEqual({
      status: "negado",
      usados: 20,
    });
    expect(spy).toHaveBeenCalledWith(
      "contextoELimiteIa:",
      expect.objectContaining({ message: "postgrest down" })
    );
  });
});
