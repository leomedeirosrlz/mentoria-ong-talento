// Actions do import de cronograma — transporte mockado na fronteira
// (createClient, demoAtivo, provider, consumirLimiteIa). O que se prova
// é a ORQUESTRAÇÃO da spec 009 US1:
//   · documento complexo vai ao tier `forte` da ia_config SEM clique —
//     modelo, esforço e fallbacks quentes, max_tokens do cronograma;
//   · documento simples não chama IA por conta própria;
//   · limite/falha devolve o determinístico com aviso, nunca erro fatal;
//   · toda chamada grava ia_eventos canal `importacao` com args
//     minimizados (lote, formato, chars, tier — nunca o documento);
//   · a resposta da IA coexiste com o rascunho do parser pra escolha.
// extrair/normalizar/ia ficam reais de propósito — são puros e provam o
// caminho inteiro do parse ao arguments.

import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  importarCronogramaComIa,
  importarCronogramaRascunho,
} from "@/lib/actions-importar-cronograma";
import { limparCacheIaConfig } from "@/lib/ia/config";
import { TOOL_CHOICE_CRONOGRAMA, TOOL_CRONOGRAMA } from "@/lib/importar-cronograma/ia";
import type { IaToolCall } from "@/lib/ia/provider";

const m = vi.hoisted(() => ({
  getClaims: vi.fn(),
  rpc: vi.fn(),
  from: vi.fn(),
  demoAtivo: vi.fn(),
  providerConfigurado: vi.fn(),
  chamarModelo: vi.fn(),
  consumirLimiteIa: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    auth: { getClaims: m.getClaims },
    rpc: m.rpc,
    from: m.from,
  })),
}));
vi.mock("@/lib/demo/mode", () => ({ demoAtivo: m.demoAtivo }));
vi.mock("@/lib/ia/provider", () => ({
  providerConfigurado: m.providerConfigurado,
  chamarModelo: m.chamarModelo,
}));
vi.mock("@/lib/ia/rate-limit", () => ({
  consumirLimiteIa: m.consumirLimiteIa,
}));

// ia_config viva do cenário: forte com slug próprio + cadeia de fallback
const CFG_ROWS = [
  {
    chave: "modelos",
    valor: {
      rapido: "modelo-leve",
      balanceado: "modelo-medio-y",
      forte: "modelo-forte-x",
      fallbacks: { forte: ["modelo-fallback-z"] },
    },
  },
  { chave: "esforco", valor: { forte: "alto", balanceado: "medio" } },
];

/** Builder de query fake: profiles via .single(); ia_config via await. */
function queryFake(table: string) {
  const q = {
    select: () => q,
    eq: () => q,
    single: () =>
      Promise.resolve({
        data:
          table === "profiles" ? { id: "p1", role: "coordenacao" } : null,
        error: null,
      }),
    then: (res: (v: unknown) => unknown) =>
      Promise.resolve({
        data: table === "ia_config" ? CFG_ROWS : [],
        error: null,
      }).then(res),
  };
  return q;
}

beforeEach(() => {
  limparCacheIaConfig();
  vi.clearAllMocks();
  m.getClaims.mockResolvedValue({
    data: { claims: { sub: "auth-1" } },
    error: null,
  });
  m.from.mockImplementation((table: string) => queryFake(table));
  m.rpc.mockResolvedValue({ data: null, error: null });
  m.demoAtivo.mockResolvedValue(false);
  m.providerConfigurado.mockReturnValue(true);
  m.consumirLimiteIa.mockResolvedValue({
    permitido: true,
    usados: 1,
    requestId: "req-import-1",
  });
});

// ---------- fixtures ----------

const RESPOSTA_IA = {
  turma: "Turma 7",
  nome: "Calendário 2026",
  eventos: [
    { tipo: "encontro", numero: 1, titulo: "Apresentação", data: "2026-06-02" },
    { tipo: "encontro", numero: 2, titulo: "Confiança", data: "2026-06-09" },
    { tipo: "recesso", titulo: "Recesso julho", data: "2026-07-01", data_fim: "2026-07-20" },
  ],
};

const toolCall = (args: unknown) => ({
  ok: true,
  mensagem: {
    role: "assistant" as const,
    content: null,
    tool_calls: [
      {
        id: "tc1",
        type: "function" as const,
        function: {
          name: "entregar_cronograma",
          arguments: typeof args === "string" ? args : JSON.stringify(args),
        },
      } satisfies IaToolCall,
    ],
  },
  modelo: "modelo-forte-x",
  usage: { prompt_tokens: 900, completion_tokens: 400 },
});

function fd(nome: string, conteudo: string, mime = "text/plain") {
  const f = new FormData();
  f.set("arquivo", new File([conteudo], nome, { type: mime }));
  return f;
}

// texto corrido sem estrutura de cronograma: parser sai com 0 eventos,
// confiança 0 — documento complexo
const TXT_COMPLEXO =
  "Orientações gerais do programa de mentoria para a equipe.\n".repeat(8);

// CSV simples que o determinístico resolve sozinho (16 encontros + turma)
const CSV_SIMPLES = [
  "Etapa;Data;Observação",
  "Cronograma da Turma 9;;",
  ...Array.from({ length: 16 }, (_, i) => {
    const d = new Date(Date.UTC(2026, 5, 2 + i * 7));
    return `Encontro ${i + 1};${d.toISOString().slice(0, 10)};`;
  }),
  "Encerramento;20/10/2026;",
].join("\n");

/** Eventos gravados via registrar_ia_eventos_lote. */
const eventosGravados = () =>
  m.rpc.mock.calls
    .filter(([fn]) => fn === "registrar_ia_eventos_lote")
    .flatMap(
      ([, args]) =>
        (args as { p_eventos: Record<string, unknown>[] }).p_eventos
    );

// ---------- auto-disparo (cenário 1 da US1) ----------

describe("documento complexo → IA sem clique", () => {
  it("vai ao tier forte da config viva com a reserva do canal importacao", async () => {
    m.chamarModelo.mockResolvedValue(toolCall(RESPOSTA_IA));
    const res = await importarCronogramaRascunho(fd("cronograma.txt", TXT_COMPLEXO));
    expect("error" in res).toBe(false);
    if ("error" in res) return;

    // uma reserva no canal importacao, ANTES da chamada
    expect(m.consumirLimiteIa).toHaveBeenCalledTimes(1);
    const [, argsLim, canalLim] = m.consumirLimiteIa.mock.calls[0] as [
      unknown,
      Record<string, unknown>,
      string,
    ];
    expect(canalLim).toBe("importacao");
    expect(typeof argsLim.lote).toBe("string");

    // tier forte: modelo/esforço/fallbacks da config, tools forçadas,
    // orçamento do cronograma — nunca IA_MODEL solto
    expect(m.chamarModelo).toHaveBeenCalledTimes(1);
    const [msgs, sessao, opts] = m.chamarModelo.mock.calls[0] as [
      unknown[],
      string,
      Record<string, unknown>,
    ];
    expect(sessao).toBe(argsLim.lote);
    expect(opts.modelo).toBe("modelo-forte-x");
    expect(opts.esforco).toBe("alto");
    expect(opts.fallbacks).toEqual(["modelo-fallback-z", "modelo-medio-y"]);
    expect(opts.tools).toEqual([TOOL_CRONOGRAMA]);
    expect(opts.toolChoice).toEqual(TOOL_CHOICE_CRONOGRAMA);
    expect(opts.maxTokens).toBeGreaterThanOrEqual(16_000);
    expect((msgs[1] as { content: string }).content).toContain(
      "Orientações gerais"
    );

    // rascunho da IA recomendado; o do parser coexiste pra escolha
    const r = res.resultado;
    expect(r.rascunho.viaIa).toBe(true);
    expect(r.rascunho.eventos).toHaveLength(3);
    expect(r.rascunhoAlternativo?.viaIa).toBe(false);
    expect(r.rascunhoAlternativo?.eventos).toHaveLength(0);
    expect(r.iaDisponivel).toBe(true);
  });

  it("auditoria: canal importacao, tool, tier forte, tokens, lote e args minimizados", async () => {
    m.chamarModelo.mockResolvedValue(toolCall(RESPOSTA_IA));
    await importarCronogramaRascunho(fd("cronograma.txt", TXT_COMPLEXO));
    const eventos = eventosGravados();
    expect(eventos).toHaveLength(1);
    const ev = eventos[0];
    expect(ev).toMatchObject({
      canal: "importacao",
      tool: "entregar_cronograma",
      ok: true,
      modelo: "modelo-forte-x",
      tier: "forte",
      tokens_in: 900,
      tokens_out: 400,
      request_id: "req-import-1",
    });
    const args = ev.args as Record<string, unknown>;
    expect(args.formato).toBe("txt");
    expect(args.tier).toBe("forte");
    expect(typeof args.chars).toBe("number");
    expect(typeof args.lote).toBe("string");
    // conteúdo do documento nunca é auditado (FR-004)
    expect(JSON.stringify(args)).not.toContain("Orientações gerais");
  });

  it("saída cortada no modelo: prévia parcial + args.truncado na auditoria", async () => {
    const argsCortados = JSON.stringify(RESPOSTA_IA).slice(0, -55);
    m.chamarModelo.mockResolvedValue(toolCall(argsCortados));
    const res = await importarCronogramaRascunho(fd("cronograma.txt", TXT_COMPLEXO));
    expect("error" in res).toBe(false);
    if ("error" in res) return;
    expect(res.resultado.rascunho.viaIa).toBe(true);
    expect(
      res.resultado.rascunho.avisos.some((a) => a.includes("incompleta"))
    ).toBe(true);
    const ev = eventosGravados()[0];
    expect(ev.ok).toBe(true);
    expect((ev.args as Record<string, unknown>).truncado).toBe(true);
  });
});

// ---------- caminhos que NÃO chamam IA ----------

describe("documento simples resolve no determinístico (cenário 2)", () => {
  it("nenhuma chamada de IA acontece por conta própria", async () => {
    const res = await importarCronogramaRascunho(
      fd("cronograma-t9.csv", CSV_SIMPLES, "text/csv")
    );
    expect("error" in res).toBe(false);
    if ("error" in res) return;
    expect(m.chamarModelo).not.toHaveBeenCalled();
    expect(m.consumirLimiteIa).not.toHaveBeenCalled();
    expect(res.resultado.rascunho.viaIa).toBe(false);
    expect(res.resultado.rascunho.eventos.length).toBeGreaterThanOrEqual(17);
    expect(res.resultado.rascunhoAlternativo).toBeNull();
  });

  it("demo ativo nunca chama provider", async () => {
    m.demoAtivo.mockResolvedValue(true);
    const res = await importarCronogramaRascunho(fd("cronograma.txt", TXT_COMPLEXO));
    expect("error" in res).toBe(false);
    expect(m.chamarModelo).not.toHaveBeenCalled();
    expect(m.consumirLimiteIa).not.toHaveBeenCalled();
  });

  it("provider desconfigurado deixa o determinístico quieto", async () => {
    m.providerConfigurado.mockReturnValue(false);
    const res = await importarCronogramaRascunho(fd("cronograma.txt", TXT_COMPLEXO));
    expect("error" in res).toBe(false);
    if ("error" in res) return;
    expect(m.chamarModelo).not.toHaveBeenCalled();
    expect(res.resultado.iaDisponivel).toBe(false);
    expect(res.resultado.rascunho.viaIa).toBe(false);
  });

  it("documento quase vazio (escaneado) não vai à IA e avisa", async () => {
    const res = await importarCronogramaRascunho(
      fd("escaneado.txt", "   \n  ".repeat(10))
    );
    expect("error" in res).toBe(false);
    if ("error" in res) return;
    expect(m.chamarModelo).not.toHaveBeenCalled();
    expect(
      res.resultado.rascunho.avisos.some((a) => a.includes("Pouco texto"))
    ).toBe(true);
  });
});

// ---------- fallback honesto (cenário 3) ----------

describe("provider indisponível ou limite → determinístico com aviso", () => {
  it("limite estourado: sem chamada, rascunho determinístico + aviso honesto", async () => {
    m.consumirLimiteIa.mockResolvedValue({ permitido: false, usados: 20 });
    const res = await importarCronogramaRascunho(fd("cronograma.txt", TXT_COMPLEXO));
    expect("error" in res).toBe(false);
    if ("error" in res) return;
    expect(m.chamarModelo).not.toHaveBeenCalled();
    expect(res.resultado.rascunho.viaIa).toBe(false);
    expect(
      res.resultado.rascunho.avisos.some((a) => a.includes("limite"))
    ).toBe(true);
    // nenhum evento de chamada é auditado (só a reserva, que a RPC não grava em 429)
    expect(eventosGravados()).toHaveLength(0);
  });

  it("falha do provider: determinístico + aviso + evento ok:false", async () => {
    m.chamarModelo.mockResolvedValue({ ok: false, erro: "indisponível" });
    const res = await importarCronogramaRascunho(fd("cronograma.txt", TXT_COMPLEXO));
    expect("error" in res).toBe(false);
    if ("error" in res) return;
    expect(res.resultado.rascunho.viaIa).toBe(false);
    expect(
      res.resultado.rascunho.avisos.some((a) => a.includes("indisponível"))
    ).toBe(true);
    const eventos = eventosGravados();
    expect(eventos).toHaveLength(1);
    expect(eventos[0]).toMatchObject({ ok: false, tier: "forte" });
  });
});

// ---------- camada 3 a pedido ----------

describe("importarCronogramaComIa (botão)", () => {
  it("sucesso devolve a prévia da IA + o rascunho do parser pra comparar", async () => {
    m.chamarModelo.mockResolvedValue(toolCall(RESPOSTA_IA));
    const res = await importarCronogramaComIa(
      fd("cronograma-t9.csv", CSV_SIMPLES, "text/csv")
    );
    expect("error" in res).toBe(false);
    if ("error" in res) return;
    expect(res.resultado.rascunho.viaIa).toBe(true);
    expect(res.resultado.rascunhoAlternativo?.viaIa).toBe(false);
    expect(
      res.resultado.rascunhoAlternativo?.eventos.length
    ).toBeGreaterThanOrEqual(17);
  });

  it("falha devolve {error} (botão pediu a IA explicitamente)", async () => {
    m.chamarModelo.mockResolvedValue({ ok: false, erro: "indisponível" });
    const res = await importarCronogramaComIa(fd("cronograma.txt", TXT_COMPLEXO));
    expect(res).toEqual({ error: "indisponível" });
  });

  it("sem provider: erro honesto ANTES de gastar reserva ou auditar", async () => {
    m.providerConfigurado.mockReturnValue(false);
    const res = await importarCronogramaComIa(fd("cronograma.txt", TXT_COMPLEXO));
    expect("error" in res).toBe(true);
    if ("error" in res) expect(res.error).toContain("não está configurada");
    expect(m.consumirLimiteIa).not.toHaveBeenCalled();
    expect(m.chamarModelo).not.toHaveBeenCalled();
  });

  it("quase vazio (escaneado) não vai à IA nem a pedido", async () => {
    const res = await importarCronogramaComIa(fd("scan.txt", "  \n ".repeat(6)));
    expect("error" in res).toBe(true);
    if ("error" in res) expect(res.error).toContain("pouco texto");
    expect(m.consumirLimiteIa).not.toHaveBeenCalled();
    expect(m.chamarModelo).not.toHaveBeenCalled();
  });

  it("limite estourado no pedido manual → {error} e nada de chamada", async () => {
    m.consumirLimiteIa.mockResolvedValue({ permitido: false, usados: 20 });
    const res = await importarCronogramaComIa(fd("cronograma.txt", TXT_COMPLEXO));
    expect("error" in res).toBe(true);
    if ("error" in res) expect(res.error).toContain("limite");
    expect(m.chamarModelo).not.toHaveBeenCalled();
    expect(eventosGravados()).toHaveLength(0);
  });

  it("demo recusa antes de qualquer chamada", async () => {
    m.demoAtivo.mockResolvedValue(true);
    const res = await importarCronogramaComIa(fd("cronograma.txt", TXT_COMPLEXO));
    expect("error" in res).toBe(true);
    expect(m.chamarModelo).not.toHaveBeenCalled();
    expect(m.consumirLimiteIa).not.toHaveBeenCalled();
  });
});

// ---------- gate ----------

describe("gate", () => {
  it("papel que não é coordenação é barrado nas duas actions", async () => {
    m.from.mockImplementation((table: string) => ({
      select: () => ({
        eq: () => ({
          single: () =>
            Promise.resolve({
              data: table === "profiles" ? { id: "p2", role: "mentor_dpp" } : null,
              error: null,
            }),
        }),
      }),
      then: (res: (v: unknown) => unknown) =>
        Promise.resolve({ data: [], error: null }).then(res),
    }));
    const a = await importarCronogramaRascunho(fd("a.txt", TXT_COMPLEXO));
    const b = await importarCronogramaComIa(fd("a.txt", TXT_COMPLEXO));
    expect("error" in a).toBe(true);
    expect("error" in b).toBe(true);
    expect(m.chamarModelo).not.toHaveBeenCalled();
  });
});
