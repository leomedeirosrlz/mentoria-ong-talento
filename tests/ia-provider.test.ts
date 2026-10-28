// Provider da camada de IA — fetch real é stubado; o que se prova é o
// contrato: envs → flag, body OpenAI-compatible com tools em JSON Schema,
// erros mapeados pra mensagem amigável e a mensagem/tool_calls passando.

import { afterEach, describe, expect, it, vi } from "vitest";
import {
  chamarModelo,
  IA_MSG_INDISPONIVEL,
  providerConfigurado,
} from "@/lib/ia/provider";

const ENV = {
  IA_API_BASE: "https://ia.test/v1",
  IA_API_KEY: "sk-teste",
  IA_MODEL: "modelo-x",
};

function stubFetch(impl: (init: RequestInit) => Response | Promise<Response>) {
  const spy = vi.fn((url: string | URL, init?: RequestInit) =>
    Promise.resolve(impl(init ?? {}))
  );
  vi.stubGlobal("fetch", spy);
  return spy;
}

function respostaOpenAi(message: unknown, status = 200) {
  return new Response(JSON.stringify({ choices: [{ message }] }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("providerConfigurado", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("só liga com base+key+model", () => {
    vi.stubEnv("IA_API_BASE", "");
    vi.stubEnv("IA_API_KEY", "");
    vi.stubEnv("IA_MODEL", "");
    expect(providerConfigurado()).toBe(false);
    vi.stubEnv("IA_API_BASE", ENV.IA_API_BASE);
    vi.stubEnv("IA_API_KEY", ENV.IA_API_KEY);
    vi.stubEnv("IA_MODEL", ENV.IA_MODEL);
    expect(providerConfigurado()).toBe(true);
  });
});

describe("chamarModelo", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("monta body chat.completions com as tools do registry", async () => {
    for (const [k, v] of Object.entries(ENV)) vi.stubEnv(k, v);
    const spy = stubFetch(() =>
      respostaOpenAi({ role: "assistant", content: "Tudo certo." })
    );
    const r = await chamarModelo([{ role: "user", content: "oi" }]);
    expect(r).toEqual({
      ok: true,
      mensagem: { role: "assistant", content: "Tudo certo." },
    });

    const [url, init] = spy.mock.calls[0];
    expect(String(url)).toBe("https://ia.test/v1/chat/completions");
    expect((init?.headers as Record<string, string>).Authorization).toBe(
      "Bearer sk-teste"
    );
    const body = JSON.parse(String(init?.body));
    expect(body.model).toBe("modelo-x");
    expect(body.messages).toEqual([{ role: "user", content: "oi" }]);
    // as tools saem em JSON Schema — function.name/description/parameters
    const nomes = body.tools.map((t: { function: { name: string } }) => t.function.name);
    expect(nomes).toContain("resumo_semana");
    const resumo = body.tools.find(
      (t: { function: { name: string } }) => t.function.name === "ficha_dupla"
    );
    expect(resumo.function.parameters.type).toBe("object");
    expect(resumo.function.parameters.properties.dupla_id).toBeTruthy();
  });

  it("tool_calls do assistente passam intactas pro loop", async () => {
    for (const [k, v] of Object.entries(ENV)) vi.stubEnv(k, v);
    stubFetch(() =>
      respostaOpenAi({
        role: "assistant",
        content: null,
        tool_calls: [
          {
            id: "call_1",
            type: "function",
            function: { name: "resumo_semana", arguments: "{}" },
          },
        ],
      })
    );
    const r = await chamarModelo([{ role: "user", content: "resumo?" }]);
    if (!r.ok) throw new Error("esperava ok");
    expect(r.mensagem.tool_calls?.[0].function.name).toBe("resumo_semana");
  });

  it("HTTP não-2xx e rede caída viram a mensagem amigável", async () => {
    for (const [k, v] of Object.entries(ENV)) vi.stubEnv(k, v);
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    stubFetch(() => new Response("quota", { status: 402 }));
    const r1 = await chamarModelo([{ role: "user", content: "oi" }]);
    expect(r1).toEqual({ ok: false, erro: IA_MSG_INDISPONIVEL });

    stubFetch(() => Promise.reject(new Error("socket")) as never);
    const r2 = await chamarModelo([{ role: "user", content: "oi" }]);
    expect(r2).toEqual({ ok: false, erro: IA_MSG_INDISPONIVEL });
    consoleSpy.mockRestore();
  });
});

describe("chamarModelo — retry (REALIZA-307)", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("5xx retenta uma vez e devolve ok se a 2ª tentativa passa", async () => {
    for (const [k, v] of Object.entries(ENV)) vi.stubEnv(k, v);
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    let chamadas = 0;
    const spy = stubFetch(() =>
      chamadas++ === 0
        ? new Response("pau", { status: 503 })
        : respostaOpenAi({ role: "assistant", content: "foi" })
    );
    const r = await chamarModelo([{ role: "user", content: "oi" }]);
    expect(r).toEqual({
      ok: true,
      mensagem: { role: "assistant", content: "foi" },
    });
    expect(spy).toHaveBeenCalledTimes(2);
    consoleSpy.mockRestore();
  });

  it("429 honra Retry-After pequeno; sem ele/4xx não muda o contrato", async () => {
    for (const [k, v] of Object.entries(ENV)) vi.stubEnv(k, v);
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    // Retry-After: 0 → delay ~0, mantém o teste rápido
    let n = 0;
    const spy = stubFetch(() =>
      n++ === 0
        ? new Response("quota", { status: 429, headers: { "Retry-After": "0" } })
        : respostaOpenAi({ role: "assistant", content: "ok" })
    );
    const r = await chamarModelo([{ role: "user", content: "oi" }]);
    expect(r.ok).toBe(true);
    expect(spy).toHaveBeenCalledTimes(2);

    // 4xx definitivo — uma chamada só, erro amigável na hora
    const spy4xx = stubFetch(() => new Response("no", { status: 402 }));
    const r2 = await chamarModelo([{ role: "user", content: "oi" }]);
    expect(r2).toEqual({ ok: false, erro: IA_MSG_INDISPONIVEL });
    expect(spy4xx).toHaveBeenCalledTimes(1);
    consoleSpy.mockRestore();
  });

  it("rede caída e timeout interno retentam; esgotada a 2ª vira erro", async () => {
    for (const [k, v] of Object.entries(ENV)) vi.stubEnv(k, v);
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    // TypeError (fetch failed) sempre → 2 chamadas e desiste
    const spy = stubFetch(
      () => Promise.reject(new TypeError("fetch failed")) as never
    );
    const r = await chamarModelo([{ role: "user", content: "oi" }]);
    expect(r).toEqual({ ok: false, erro: IA_MSG_INDISPONIVEL });
    expect(spy).toHaveBeenCalledTimes(2);

    // TimeoutError do AbortSignal interno → transitório, retenta
    let n = 0;
    stubFetch(() =>
      n++ === 0
        ? (Promise.reject(new DOMException("estourou", "TimeoutError")) as never)
        : respostaOpenAi({ role: "assistant", content: "ok" })
    );
    const r2 = await chamarModelo([{ role: "user", content: "oi" }]);
    expect(r2.ok).toBe(true);
    consoleSpy.mockRestore();
  });

  it("erro não-transitório não retenta", async () => {
    for (const [k, v] of Object.entries(ENV)) vi.stubEnv(k, v);
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const spy = stubFetch(
      () => Promise.reject(new Error("socket")) as never
    );
    const r = await chamarModelo([{ role: "user", content: "oi" }]);
    expect(r).toEqual({ ok: false, erro: IA_MSG_INDISPONIVEL });
    expect(spy).toHaveBeenCalledTimes(1);
    consoleSpy.mockRestore();
  });
});
