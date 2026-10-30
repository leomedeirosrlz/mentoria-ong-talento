import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// chamarModeloStream (REALIZA-244): SSE OpenAI-compatível — buffer entre
// chunks de rede, deltas de content por onToken, tool_calls remontadas por
// index, [DONE], fallback JSON quando o provider recusa o stream.

const ENV = {
  IA_API_BASE: "https://provider.test/v1",
  IA_API_KEY: "key-teste",
  IA_MODEL: "modelo-teste",
};

function streamChunks(parts: string[]) {
  const enc = new TextEncoder();
  return new ReadableStream<Uint8Array>({
    start(c) {
      for (const p of parts) c.enqueue(enc.encode(p));
      c.close();
    },
  });
}

function sseResposta(parts: string[]) {
  return new Response(streamChunks(parts), {
    status: 200,
    headers: { "Content-Type": "text/event-stream" },
  });
}

function sse(...objetos: unknown[]) {
  return (
    objetos.map((o) => `data: ${JSON.stringify(o)}\n\n`).join("") +
    "data: [DONE]\n\n"
  );
}

async function chamar(opts?: {
  tokens?: string[];
  signal?: AbortSignal;
  clienteAbortou?: () => boolean;
  modelo?: string;
  fallbacks?: string[];
}) {
  const { chamarModeloStream } = await import("@/lib/ia/provider");
  return chamarModeloStream(
    [{ role: "user" as const, content: "oi" }],
    {} as never,
    {
      onToken: (t: string) => opts?.tokens?.push(t),
      signal: opts?.signal ?? new AbortController().signal,
      clienteAbortou: opts?.clienteAbortou ?? (() => false),
      modelo: opts?.modelo,
      fallbacks: opts?.fallbacks,
    }
  );
}

describe("chamarModeloStream", () => {
  beforeEach(() => {
    vi.resetModules();
    for (const [k, v] of Object.entries(ENV)) vi.stubEnv(k, v);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("emite deltas de content por onToken e monta o texto final", async () => {
    const tokens: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        sseResposta([
          sse(
            { choices: [{ delta: { content: "Olá " } }] },
            { choices: [{ delta: { content: "mundo" } }] },
            { choices: [{ delta: {} }] }
          ),
        ])
      )
    );

    const res = await chamar({ tokens });
    expect(res).toMatchObject({ ok: true, content: "Olá mundo" });
    expect(tokens).toEqual(["Olá ", "mundo"]);
  });

  it("monta evento SSE dividido entre dois chunks de rede", async () => {
    const tokens: string[] = [];
    const payload = `data: ${JSON.stringify({
      choices: [{ delta: { content: "tudo bem?" } }],
    })}\n\n`;
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          sseResposta([payload.slice(0, 10), payload.slice(10), "data: [DONE]\n\n"])
        )
    );

    const res = await chamar({ tokens });
    expect(res).toMatchObject({ ok: true, content: "tudo bem?" });
  });

  it("remonta tool_calls fragmentadas por index nos deltas", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        sseResposta([
          sse(
            {
              choices: [
                {
                  delta: {
                    tool_calls: [
                      {
                        index: 0,
                        id: "call_1",
                        function: { name: "duplas_risco", arguments: "" },
                      },
                    ],
                  },
                },
              ],
            },
            {
              choices: [
                {
                  delta: {
                    tool_calls: [
                      { index: 0, function: { arguments: '{"limi' } },
                      { index: 0, function: { arguments: 'te":2}' } },
                    ],
                  },
                },
              ],
            }
          ),
        ])
      )
    );

    const res = await chamar();
    expect(res).toMatchObject({ ok: true });
    if (res.ok) {
      expect(res.toolCalls).toEqual([
        {
          id: "call_1",
          type: "function",
          function: { name: "duplas_risco", arguments: '{"limite":2}' },
        },
      ]);
      // arguments remontado é JSON válido — o executor parseia direto
      expect(
        JSON.parse(res.toolCalls[0].function.arguments)
      ).toEqual({ limite: 2 });
    }
  });

  it("devolve fallback quando o provider não responde SSE", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response('{"choices":[]}', {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      )
    );

    const res = await chamar();
    expect(res).toMatchObject({ ok: false, fallback: true });
  });

  it("abort do cliente devolve abortado (não erro)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        sseResposta([
          sse({ choices: [{ delta: { content: "parcial" } }] }),
        ])
      )
    );

    const res = await chamar({ clienteAbortou: () => true });
    expect(res).toMatchObject({ ok: false, abortado: true });
  });
});

describe("chamarModeloStream — retry (REALIZA-307)", () => {
  beforeEach(() => {
    vi.resetModules();
    for (const [k, v] of Object.entries(ENV)) vi.stubEnv(k, v);
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("5xx antes do stream abrir avança pro próximo slug da cadeia", async () => {
    let n = 0;
    const spy = vi.fn<(url: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(() =>
      Promise.resolve(
        n++ === 0
          ? new Response("pau", { status: 503 })
          : sseResposta([sse({ choices: [{ delta: { content: "oi" } }] })])
      )
    );
    vi.stubGlobal("fetch", spy);

    const res = await chamar({ modelo: "primario", fallbacks: ["fb-1"] });
    expect(res).toMatchObject({ ok: true, content: "oi" });
    expect(spy).toHaveBeenCalledTimes(2);
    expect(JSON.parse(String(spy.mock.calls[1]?.[1]?.body)).model).toBe(
      "fb-1"
    );
  });

  it("429 honra Retry-After pequeno antes de pular de modelo", async () => {
    // Retry-After: 0 → delay ~0, mantém o teste rápido
    let n = 0;
    const spy = vi.fn(() =>
      Promise.resolve(
        n++ === 0
          ? new Response("quota", { status: 429, headers: { "Retry-After": "0" } })
          : sseResposta([sse({ choices: [{ delta: { content: "ok" } }] })])
      )
    );
    vi.stubGlobal("fetch", spy);

    const res = await chamar({ modelo: "primario", fallbacks: ["fb-1"] });
    expect(res).toMatchObject({ ok: true, content: "ok" });
    expect(spy).toHaveBeenCalledTimes(2);
  });

  it("erro de rede antes do 1º byte útil avança a cadeia", async () => {
    let n = 0;
    const spy = vi.fn(() =>
      n++ === 0
        ? Promise.reject(new TypeError("fetch failed"))
        : Promise.resolve(
            sseResposta([sse({ choices: [{ delta: { content: "voltou" } }] })])
          )
    );
    vi.stubGlobal("fetch", spy);

    const res = await chamar({ modelo: "primario", fallbacks: ["fb-1"] });
    expect(res).toMatchObject({ ok: true, content: "voltou" });
    expect(spy).toHaveBeenCalledTimes(2);
  });

  it("4xx não retenta — fallback direto", async () => {
    const spy = vi
      .fn()
      .mockResolvedValue(new Response("no", { status: 402 }));
    vi.stubGlobal("fetch", spy);

    const res = await chamar();
    expect(res).toMatchObject({ ok: false, fallback: true });
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it("quebra depois de token emitido NÃO retenta — vira fallback", async () => {
    const enc = new TextEncoder();
    // pull no 1º read entrega o evento do token; no 2º quebra — c.error
    // no start() descartaria o chunk enfileirado antes do read acontecer
    let primeiroRead = true;
    const streamQuebrando = new ReadableStream<Uint8Array>({
      pull(c) {
        if (primeiroRead) {
          primeiroRead = false;
          c.enqueue(
            enc.encode(
              `data: ${JSON.stringify({ choices: [{ delta: { content: "parcial" } }] })}\n\n`
            )
          );
        } else {
          c.error(new TypeError("reset"));
        }
      },
    });
    const spy = vi.fn().mockResolvedValue(
      new Response(streamQuebrando, {
        status: 200,
        headers: { "Content-Type": "text/event-stream" },
      })
    );
    vi.stubGlobal("fetch", spy);

    const tokens: string[] = [];
    const res = await chamar({ tokens });
    expect(tokens).toEqual(["parcial"]);
    expect(res).toMatchObject({ ok: false, fallback: true });
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it("signal da rota abortado (timeout) não retenta", async () => {
    const ctrl = new AbortController();
    ctrl.abort();
    const spy = vi
      .fn()
      .mockRejectedValue(new DOMException("abort", "AbortError"));
    vi.stubGlobal("fetch", spy);

    const res = await chamar({
      signal: ctrl.signal,
      clienteAbortou: () => false,
    });
    expect(res).toMatchObject({ ok: false, fallback: true });
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it("abort no meio do backoff corta a espera (sem 2ª chamada)", async () => {
    const ctrl = new AbortController();
    const spy = vi
      .fn()
      .mockResolvedValue(new Response("pau", { status: 503 }));
    vi.stubGlobal("fetch", spy);

    const p = chamar({ signal: ctrl.signal, clienteAbortou: () => false });
    setTimeout(() => ctrl.abort(), 50);
    const res = await p;
    // abort veio do timeout da rota, não do cliente → fallback, não "abortado"
    expect(res).toMatchObject({ ok: false, fallback: true });
    expect(spy).toHaveBeenCalledTimes(1);
  });
});
