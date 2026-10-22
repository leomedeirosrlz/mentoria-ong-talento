import { describe, expect, it } from "vitest";
import { scrubSentryEvent, scrubSentrySpan } from "@/lib/sentry-scrub";
import type { Event } from "@sentry/nextjs";

// O contrato de privacidade do Sentry: bearer tokens do app moram no PATH
// (/f/, /t/, /assinar/, /avaliar/, /resumo/, /api/assinar-token/) — nenhum
// campo do evento pode carregar o segredo pra fora do processo.

describe("scrubSentryEvent", () => {
  const base = (): Event => ({
    request: {
      url: "https://realizavc.vercel.app/f/t0k3nabc123?x=1",
      headers: { Referer: "https://realizavc.vercel.app/t/segredo99" },
    },
    transaction: "/assinar/tokenxyz789",
    breadcrumbs: [
      { data: { url: "https://app/t/abc123", to: "/avaliar/zzz" } },
      { data: { url: "https://app/pessoas" } },
    ],
  });

  it("redacta tokens em request.url, referer, transaction e breadcrumbs", () => {
    const e = scrubSentryEvent(base());
    expect(e.request?.url).toBe("https://realizavc.vercel.app/f/[redacted]?x=1");
    expect(e.request?.headers?.Referer).toBe(
      "https://realizavc.vercel.app/t/[redacted]"
    );
    expect(e.transaction).toBe("/assinar/[redacted]");
    expect(e.breadcrumbs?.[0].data?.url).toBe("https://app/t/[redacted]");
    expect(e.breadcrumbs?.[0].data?.to).toBe("/avaliar/[redacted]");
  });

  it("cobre todos os prefixos de bearer path do app", () => {
    for (const p of [
      "/f/",
      "/t/",
      "/assinar/",
      "/avaliar/",
      "/resumo/",
      "/api/assinar-token/",
    ]) {
      const e = scrubSentryEvent({ request: { url: `https://x${p}segredo` } });
      expect(e.request?.url).toBe(`https://x${p}[redacted]`);
    }
  });

  it("não toca em URLs sem token nem em paths parecidos", () => {
    const e = scrubSentryEvent({
      request: {
        url: "https://x/formularios/123?t=abc",
        headers: { Referer: "https://x/assinar" },
      },
      transaction: "/formularios/[id]",
    });
    expect(e.request?.url).toBe("https://x/formularios/123?t=abc");
    expect(e.request?.headers?.Referer).toBe("https://x/assinar");
    expect(e.transaction).toBe("/formularios/[id]");
  });

  it("tolera evento mínimo", () => {
    expect(scrubSentryEvent({})).toEqual({});
  });

  it("remove fragmento inteiro — tokens do magic link moram no hash", () => {
    const e = scrubSentryEvent({
      request: {
        url: "https://x/auth/link#access_token=eyJ.aa&refresh_token=bb",
      },
    });
    expect(e.request?.url).toBe("https://x/auth/link");
  });

  it("redacta params credenciais do query (h, code, token_hash, next, to)", () => {
    const e = scrubSentryEvent({
      request: {
        url: "https://x/auth/confirm?h=uuid-1&code=pkce&token_hash=th&ok=1",
      },
    });
    const url = e.request?.url;
    expect(url).toBe(
      "https://x/auth/confirm?h=[redacted]&code=[redacted]&token_hash=[redacted]&ok=1"
    );
    const e2 = scrubSentryEvent({
      request: { url: "https://x/login?next=%2Ff%2Ftoken&to=wa.me%2F5511" },
    });
    expect(e2.request?.url).toBe(
      "https://x/login?next=[redacted]&to=[redacted]"
    );
  });

  it("cobre request.query_string, message, crumb.message e exception.value", () => {
    const e = scrubSentryEvent({
      request: { query_string: "h=uuid-1&x=2" },
      message: "erro em /f/abc123",
      breadcrumbs: [{ message: "fetch /t/seg falhou", data: {} }],
      exception: {
        values: [{ value: 'invalid input syntax for type uuid: "/f/xyz"' }],
      },
    });
    expect(e.request?.query_string).toBe("h=[redacted]&x=2");
    expect(e.message).toBe("erro em /f/[redacted]");
    expect(e.breadcrumbs?.[0].message).toBe("fetch /t/[redacted] falhou");
    expect(e.exception?.values?.[0].value).toBe(
      'invalid input syntax for type uuid: "/f/[redacted]"'
    );
  });
});

describe("scrubSentrySpan", () => {
  it("redacta name e atributos http do span", () => {
    const s = scrubSentrySpan({
      name: "GET /f/t0k3n",
      attributes: {
        "http.target": "/t/segredo?a=1",
        "url.full": "https://x/resumo/slugv",
        other: 42,
      },
    });
    expect(s.name).toBe("GET /f/[redacted]");
    expect(s.attributes?.["http.target"]).toBe("/t/[redacted]?a=1");
    expect(s.attributes?.["url.full"]).toBe("https://x/resumo/[redacted]");
    expect(s.attributes?.other).toBe(42);
  });
});
