// A allowlist de rotas públicas (updateSession) protege o que já está em
// circulação: links de instrumento/resumo enviados por WhatsApp e e-mail,
// o cron da Vercel e o servidor MCP. Remover uma entrada "pra endurecer"
// não dá erro em teste nenhum — o cron vira 307 e "para de rodar", os
// links publicados morrem. Este spec testa a allowlist contra a lista
// canônica de portas por token, mais os dois redirecionamentos.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

const m = vi.hoisted(() => ({ claims: vi.fn() }));

// o client é todo mockado: o que se prova aqui é a decisão de rota, não a
// validação do JWT (getClaims devolve o veredito pronto)
vi.mock("@supabase/ssr", () => ({
  createServerClient: () => ({ auth: { getClaims: m.claims } }),
}));

const TOKEN = "a".repeat(32);

const publicas = [
  "/login",
  "/auth/link",
  "/demo",
  `/f/${TOKEN}`,
  `/t/${TOKEN}`,
  `/avaliar/${TOKEN}`,
  "/assinar/1b2ce453-9d2f-4d1f-8f7a-2f0e5b7c6d3e",
  "/api/assinar-token/1b2ce453-9d2f-4d1f-8f7a-2f0e5b7c6d3e",
  "/resumo/turma-2026",
  "/api/jobs/tick",
  "/api/mcp",
  "/privacidade",
];

beforeEach(() => {
  m.claims.mockResolvedValue({ data: { claims: null } });
});

describe("updateSession — allowlist pública por token", () => {
  it("rota pública deslogada nunca cai no /login", async () => {
    for (const p of publicas) {
      const res = await updateSession(new NextRequest(`http://app.test${p}`));
      expect(res.headers.get("location"), `${p} virou redirect`).toBeNull();
    }
  });

  it("rota interna deslogada devolve 307 com o next preservado", async () => {
    const res = await updateSession(new NextRequest("http://app.test/duplas/abc?x=1"));
    expect(res.headers.get("location")).toBe(
      "http://app.test/login?next=%2Fduplas%2Fabc%3Fx%3D1"
    );
  });

  it("logado em /login só aceita next interno", async () => {
    m.claims.mockResolvedValue({ data: { claims: { sub: "u1" } } });

    const externo = await updateSession(
      new NextRequest("http://app.test/login?next=//evil.com")
    );
    expect(externo.headers.get("location")).toBe("http://app.test/");

    const interno = await updateSession(
      new NextRequest("http://app.test/login?next=%2Fduplas")
    );
    expect(interno.headers.get("location")).toBe("http://app.test/duplas");
  });
});

describe("updateSession — sessão quebrada não prende ninguém", () => {
  it("a saída de emergência roda mesmo com getClaims estourando", async () => {
    m.claims.mockRejectedValue(new Error("refresh token not found"));
    const res = await updateSession(
      new NextRequest("http://app.test/auth/sair-limpo")
    );
    expect(res.headers.get("location")).toBeNull();
  });

  it("token quebrado em rota interna limpa o cookie e volta pro login", async () => {
    m.claims.mockRejectedValue(new Error("refresh token not found"));
    const res = await updateSession(
      new NextRequest("http://app.test/duplas/abc", {
        headers: { cookie: "sb-ref-auth-token=velho; outro=1" },
      })
    );
    expect(res.headers.get("location")).toBe(
      "http://app.test/login?motivo=sessao"
    );
    expect(res.headers.getSetCookie().join(";")).toContain(
      "sb-ref-auth-token="
    );
  });

  it("token quebrado em rota pública segue como anônimo", async () => {
    m.claims.mockRejectedValue(new Error("refresh token not found"));
    const res = await updateSession(new NextRequest("http://app.test/login"));
    expect(res.headers.get("location")).toBeNull();
  });
});
