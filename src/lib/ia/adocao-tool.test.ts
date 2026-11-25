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

// As demais tools de adoção (mesma exposição via MCP — catalogo filtra por
// roles): cada uma delega na mesma RPC/query que a aba usa.

const rodarTool = (
  nome: string,
  args: unknown,
  supabase: SupabaseClient,
  papeis: ("coordenacao" | "mentor_dpp")[] = ["coordenacao"]
) =>
  executarTool(nome, args, supabase, "chat", papeis, undefined, undefined, {
    coletarEvento: (ev) => eventos.push(ev),
  });

describe("adocao_por_dia", () => {
  it("delega em adocao_serie_dia com janela e papel", async () => {
    const chamadas: ChamadaRpc[] = [];
    const r = await rodarTool(
      "adocao_por_dia",
      { dias: 7, papel: "mentorado" },
      supaRpc({ adocao_serie_dia: [{ dia: "2026-11-15", gestos: 4 }] }, chamadas)
    );
    expect(r.ok).toBe(true);
    const c = chamadas.find((x) => x.fn === "adocao_serie_dia");
    expect(c?.params.p_papel).toBe("mentorado");
  });

  it("fora da coordenação não passa", async () => {
    const r = await rodarTool("adocao_por_dia", {}, supaRpc({}), ["mentor_dpp"]);
    expect(r.ok).toBe(false);
  });
});

describe("adocao_caminhos", () => {
  it("passa top/papel pra RPC e rejeita top fora do range", async () => {
    const chamadas: ChamadaRpc[] = [];
    const r = await rodarTool(
      "adocao_caminhos",
      { top: 3, papel: "supervisor" },
      supaRpc({ adocao_caminhos: [] }, chamadas)
    );
    expect(r.ok).toBe(true);
    const c = chamadas.find((x) => x.fn === "adocao_caminhos");
    expect(c?.params.p_top).toBe(3);
    expect(c?.params.p_papel).toBe("supervisor");

    const r2 = await rodarTool("adocao_caminhos", { top: 99 }, supaRpc({}));
    expect(r2.ok).toBe(false);
  });
});

describe("adocao_coorte", () => {
  it("delega em adocao_coorte com semanas e não recorta papel", async () => {
    const chamadas: ChamadaRpc[] = [];
    const r = await rodarTool(
      "adocao_coorte",
      { semanas: 4 },
      supaRpc({ adocao_coorte: [] }, chamadas)
    );
    expect(r.ok).toBe(true);
    const c = chamadas.find((x) => x.fn === "adocao_coorte");
    expect(c?.params.p_semanas).toBe(4);
    expect("p_papel" in (c?.params ?? {})).toBe(false);
  });

  it("rejeita semanas acima de 12", async () => {
    const r = await rodarTool("adocao_coorte", { semanas: 30 }, supaRpc({}));
    expect(r.ok).toBe(false);
  });
});

describe("adocao_funil", () => {
  // o funil não é RPC — lê avaliacao_links + formulario_links via .from()
  function supaFrom(linhas: Record<string, unknown[]>): SupabaseClient {
    // cadeia thenable: qualquer método (eq/in/gte/or/…) devolve o mesmo
    // objeto e o await resolve linhas[t] — o stub não filtra por
    // argumento, então consultas diferentes à mesma tabela (link manual
    // × campanha) recebem o mesmo conjunto
    return {
      from: (t: string) => {
        const fim = Promise.resolve({
          data: linhas[t] ?? [],
          error: null,
        });
        const cadeia: object = new Proxy(
          {},
          {
            get: (_o, k) =>
              k === "then" ? fim.then.bind(fim) : () => cadeia,
          }
        );
        return { select: () => cadeia };
      },
    } as unknown as SupabaseClient;
  }

  it("agrega emitidos/respondidos por instrumento com janela de 14d", async () => {
    const r = await rodarTool(
      "adocao_funil",
      { dias: 30 },
      supaFrom({
        avaliacao_links: [
          {
            status: "respondido",
            respondido_em: new Date().toISOString(),
            expira_em: null,
            created_at: new Date().toISOString(),
          },
          {
            status: "pendente",
            respondido_em: null,
            expira_em: null,
            created_at: new Date().toISOString(),
          },
        ],
        formulario_links: [],
      })
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const d = r.dados as {
      conversao_dias: number;
      instrumentos: {
        instrumento: string;
        emitidos: number;
        respondidos: number;
        pendentes: number;
      }[];
    };
    expect(d.conversao_dias).toBe(14);
    const aval = d.instrumentos.find((i) =>
      i.instrumento.toLowerCase().includes("avalia")
    );
    expect(aval?.emitidos).toBe(2);
    expect(aval?.respondidos).toBe(1);
    expect(aval?.pendentes).toBe(1);
  });
});
