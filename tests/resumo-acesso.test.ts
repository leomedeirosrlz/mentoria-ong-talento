// Pseudônimo de acesso do /resumo (src/lib/resumo-acesso.ts) — a única
// defesa LGPD da auditoria do link público. O contrato que este spec
// trava: o ip_hash é SHA-256(salt:ip) determinístico; o salt vem da env
// e fora de produção cai no DEV_SALT conhecido; em produção SEM a env a
// linha vai com ip_hash null — nunca com um salt inventado (um literal
// de fallback em prod reintroduziria hash quebrável por dicionário, o
// espaço de IPv4 é pequeno) — e a falha sai visível: console.error a
// cada acesso, Sentry uma vez por instância. O user-agent trunca no
// tamanho da coluna (500).
// Os três pontos de fronteira (headers, ipCliente, Sentry) ficam
// mockados; resetModules+import dinâmico isolam o flag "avisado" por
// teste — ele é estado de módulo de propósito (o aviso não pode
// inundar o Sentry a cada request).

import { createHash } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  headersGet: vi.fn(),
  ipCliente: vi.fn(),
  captureException: vi.fn(),
}));

vi.mock("next/headers", () => ({
  headers: vi.fn(async () => ({ get: m.headersGet })),
}));
vi.mock("@/lib/ip", () => ({ ipCliente: m.ipCliente }));
vi.mock("@sentry/nextjs", () => ({
  captureException: m.captureException,
}));

const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");

// DEV_SALT não é exportado — o literal aqui é o contrato: o fallback
// só existe fora de prod e é este, documentado no próprio módulo.
const DEV_SALT = "realiza-resumo-acesso-dev";

async function carregar() {
  return import("@/lib/resumo-acesso");
}

beforeEach(() => {
  vi.resetModules();
  vi.resetAllMocks();
  m.headersGet.mockImplementation(() => null);
  m.ipCliente.mockResolvedValue(null);
});

afterEach(() => vi.unstubAllEnvs());

describe("hashIpAcesso — pseudônimo determinístico", () => {
  it("mesmo IP+salt dá o mesmo hash de 64 hex; salt diferente dá outro", async () => {
    const { hashIpAcesso } = await carregar();
    const a = hashIpAcesso("203.0.113.10", "sal-1");
    expect(a).toBe(sha256("sal-1:203.0.113.10"));
    expect(a).toMatch(/^[0-9a-f]{64}$/);
    expect(hashIpAcesso("203.0.113.10", "sal-1")).toBe(a);
    expect(hashIpAcesso("203.0.113.10", "sal-2")).not.toBe(a);
    expect(hashIpAcesso("203.0.113.11", "sal-1")).not.toBe(a);
  });
});

describe("rastroAcesso — decisão do salt", () => {
  const IP = "203.0.113.10";

  it("produção sem RESUMO_ACESSO_SALT grava ip_hash null e avisa uma vez", async () => {
    vi.stubEnv("APP_ENV", "production");
    vi.stubEnv("RESUMO_ACESSO_SALT", "");
    const erro = vi.spyOn(console, "error").mockImplementation(() => {});
    m.ipCliente.mockResolvedValue(IP);

    const { rastroAcesso } = await carregar();
    const r1 = await rastroAcesso();
    const r2 = await rastroAcesso();

    // a linha vai sem hash — melhor nulo que pseudônimo previsível
    expect(r1.ipHash).toBeNull();
    expect(r2.ipHash).toBeNull();
    // console.error a cada acesso (log da Vercel), Sentry só na primeira
    expect(erro).toHaveBeenCalledTimes(2);
    expect(m.captureException).toHaveBeenCalledTimes(1);
  });

  it("produção com a env usa o salt real, sem aviso", async () => {
    vi.stubEnv("APP_ENV", "production");
    vi.stubEnv("RESUMO_ACESSO_SALT", "salt-de-prod");
    m.ipCliente.mockResolvedValue(IP);

    const { rastroAcesso } = await carregar();
    const r = await rastroAcesso();
    expect(r.ipHash).toBe(sha256(`salt-de-prod:${IP}`));
    expect(m.captureException).not.toHaveBeenCalled();
  });

  it("fora de produção cai no salt dev fixo", async () => {
    vi.stubEnv("APP_ENV", "development");
    vi.stubEnv("VERCEL_ENV", "development");
    vi.stubEnv("RESUMO_ACESSO_SALT", "");
    m.ipCliente.mockResolvedValue(IP);

    const { rastroAcesso } = await carregar();
    const r = await rastroAcesso();
    expect(r.ipHash).toBe(sha256(`${DEV_SALT}:${IP}`));
    expect(m.captureException).not.toHaveBeenCalled();
  });

  it("sem IP derivável grava null mesmo com salt (nunca inventa)", async () => {
    vi.stubEnv("APP_ENV", "development");
    m.ipCliente.mockResolvedValue(null);

    const { rastroAcesso } = await carregar();
    expect((await rastroAcesso()).ipHash).toBeNull();
  });

  it("user-agent trunca em 500 e ausente vira null", async () => {
    const { rastroAcesso } = await carregar();
    m.headersGet.mockImplementation((k: string) =>
      k === "user-agent" ? "x".repeat(600) : null
    );
    expect((await rastroAcesso()).ua).toHaveLength(500);
    m.headersGet.mockImplementation(() => null);
    expect((await rastroAcesso()).ua).toBeNull();
  });
});
