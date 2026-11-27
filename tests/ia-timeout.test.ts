// Timeout do provider vira `demorou`, não `dormindo` (1126): a UI troca a
// cara de sono por "A Liza demorou para responder" com tentar de novo.
import { afterEach, describe, expect, it, vi } from "vitest";
import { chamarModeloStream } from "@/lib/ia/provider";

const opts = (signal: AbortSignal) => ({
  onToken: () => {},
  signal,
  clienteAbortou: () => false,
  modelo: "modelo-teste",
});

afterEach(() => vi.unstubAllGlobals());

describe("timeout do provider", () => {
  it("erro TimeoutError sai com demorou e fallback (não é cota)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new DOMException("tempo esgotado", "TimeoutError");
      })
    );
    const r = await chamarModeloStream(
      [{ role: "user", content: "oi" }],
      undefined,
      opts(new AbortController().signal)
    );
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.fallback).toBe(true);
    expect(r.demorou).toBe(true);
  });

  it("abort do orçamento da rota também conta como demora", async () => {
    const ctrl = new AbortController();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        ctrl.abort();
        throw new DOMException("abortado", "AbortError");
      })
    );
    const r = await chamarModeloStream(
      [{ role: "user", content: "oi" }],
      undefined,
      opts(ctrl.signal)
    );
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.demorou).toBe(true);
    expect(r.dormindo).toBe(true);
  });
});
