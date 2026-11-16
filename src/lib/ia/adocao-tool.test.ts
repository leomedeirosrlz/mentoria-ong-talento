import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { executarTool, type EventoIa } from "./tools";

// REALIZA-417: adocao_por_superficie passa inteira pelo executarTool
// (schema, gate de papel, audit coletada em memória) — só o PostgREST é
// simulado, com as respostas das RPCs adocao_* que a tool delega.

type ChamadaRpc = { fn: string; params: Record<string, unknown> };

function supaRpc(
  respostas: Record<string, unknown>,
  chamadas: ChamadaRpc[] = []
): SupabaseClient {
  return {
    rpc: async (fn: string, params: Record<string, unknown>) => {
      chamadas.push({ fn, params });
      return { data: respostas[fn] ?? null, error: null };
    },
  } as unknown as SupabaseClient;
}

const eventos: EventoIa[] = [];

const rodar = (
  args: unknown,
  supabase: SupabaseClient,
  papeis: ("coordenacao" | "supervisor" | "mentor_dpp" | "mentor_especialista" | "mentorado")[] = ["coordenacao"]
) =>
  executarTool("adocao_por_superficie", args, supabase, "chat", papeis, undefined, undefined, {
    coletarEvento: (ev) => eventos.push(ev),
  });

const RESUMO = {
  ativas: 12,
  ativas_prev: 10,
  gestos: 340,
  gestos_prev: 290,
  sups_vivas: 8,
};

const SUPERFICIES = [
  {
    superficie: "duplas",
    gestos: 120,
    pessoas: 9,
    papeis: ["coordenacao", "supervisor"],
    ultimo: "2026-11-15T10:00:00Z",
  },
  {
    superficie: "agenda",
    gestos: 80,
    pessoas: 11,
    papeis: ["mentor_dpp"],
    ultimo: "2026-11-14T18:00:00Z",
  },
];

describe("adocao_por_superficie — schema e gate", () => {
  it("rejeita papel fora do enum", async () => {
    const r = await rodar({ papel: "admin" }, supaRpc({}));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.erro).toContain("Argumentos inválidos");
  });

  it("rejeita janela acima de 90 dias", async () => {
    const r = await rodar({ dias: 120 }, supaRpc({}));
    expect(r.ok).toBe(false);
  });

  it("fora da coordenação não passa no gate de papel", async () => {
    const r = await rodar({}, supaRpc({}), ["mentor_dpp"]);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.erro).toContain("não está disponível pro seu papel");
  });
});

describe("adocao_por_superficie — dados", () => {
  it("sem recorte devolve superfícies + KPIs do programa", async () => {
    const chamadas: ChamadaRpc[] = [];
    const r = await rodar(
      {},
      supaRpc(
        { adocao_superficies: SUPERFICIES, adocao_resumo: RESUMO },
        chamadas
      )
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const d = r.dados as {
      janela_dias: number;
      papel: string;
      resumo: typeof RESUMO | null;
      total_superficies: number;
      superficies: { superficie: string }[];
    };
    expect(d.janela_dias).toBe(30);
    expect(d.papel).toBe("todos");
    expect(d.resumo).toEqual(RESUMO);
    expect(d.total_superficies).toBe(2);
    expect(d.superficies.map((s) => s.superficie)).toEqual([
      "duplas",
      "agenda",
    ]);
    // resumo e lista consultam a mesma janela
    const desdeLista = chamadas.find(
      (c) => c.fn === "adocao_superficies"
    )?.params.p_desde;
    const desdeResumo = chamadas.find(
      (c) => c.fn === "adocao_resumo"
    )?.params.p_desde;
    expect(desdeResumo).toBe(desdeLista);
  });

  it("com papel o filtro vai pros dois RPCs (recorte único)", async () => {
    const chamadas: ChamadaRpc[] = [];
    const r = await rodar(
      { dias: 7, papel: "mentor_dpp" },
      supaRpc(
        { adocao_superficies: SUPERFICIES, adocao_resumo: RESUMO },
        chamadas
      )
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const d = r.dados as { janela_dias: number; resumo: unknown };
    expect(d.janela_dias).toBe(7);
    expect(d.resumo).toEqual(RESUMO);
    // a RPC recebe p_papel — resumo e lista falam do mesmo recorte
    const lista = chamadas.find((c) => c.fn === "adocao_superficies");
    const resumo = chamadas.find((c) => c.fn === "adocao_resumo");
    expect(lista?.params.p_papel).toBe("mentor_dpp");
    expect(resumo?.params.p_papel).toBe("mentor_dpp");
  });
});
