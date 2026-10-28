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
}) {
  const { chamarModeloStream } = await import("@/lib/ia/provider");
  return chamarModeloStream(
    [{ role: "user" as const, content: "oi" }],
    {} as never,
    {
      onToken: (t: string) => opts?.tokens?.push(t),
      signal: opts?.signal ?? new AbortController().signal,
      clienteAbortou: opts?.clienteAbortou ?? (() => false),
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
