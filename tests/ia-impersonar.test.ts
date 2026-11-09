// clientImpersonado — o supabase-js é mockado na fronteira (createClient);
// o que se prova aqui é a ESTRATÉGIA de sessão, não o GoTrue:
//   · cache vazio minta via generateLink + verifyOtp (1 sessão por user);
//   · dentro da validade responde do cache — zero chamadas de auth;
//   · access token perto de expirar renova com refreshSession, SEM gerar
//     magic link novo (mint queimava o link de login que a pessoa pediu
//     por e-mail e criava uma sessão extra em auth.sessions);
//   · refresh morto cai no mint; mint também falhando devolve null —
//     a rota MCP decide o erro (fail-closed, nunca service-role).
// O cache é de módulo: cada teste re-importa com resetModules pra não
// vazar sessão entre casos.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  createClient: vi.fn(),
  getUserById: vi.fn(),
  generateLink: vi.fn(),
  verifyOtp: vi.fn(),
  refreshSession: vi.fn(),
}));

vi.mock("@supabase/supabase-js", () => ({ createClient: m.createClient }));

const ENV = {
  NEXT_PUBLIC_SUPABASE_URL: "https://sb.test",
  SUPABASE_SERVICE_ROLE_KEY: "svc-teste",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-teste",
};

/** expires_at é em SEGUNDOS — o módulo multiplica por 1000. */
const emSegundos = (msFuturo: number) =>
  Math.floor((Date.now() + msFuturo) / 1000);

function sessao(over: Record<string, unknown> = {}) {
  return {
    access_token: "jwt-1",
    refresh_token: "rt-1",
    expires_at: emSegundos(3_600_000), // +1h — dentro da validade
    ...over,
  };
}

async function carregar() {
  const mod = await import("@/lib/ia/impersonar");
  return mod.clientImpersonado;
}

/** Mint feliz completo: usuário com e-mail → link → sessão válida. */
function mintOk(over: Record<string, unknown> = {}) {
  m.getUserById.mockResolvedValue({
    data: { user: { email: "pessoa@exemplo.org" } },
    error: null,
  });
  m.generateLink.mockResolvedValue({
    data: { properties: { hashed_token: "hash-1" } },
    error: null,
  });
  m.verifyOtp.mockResolvedValue({ data: { session: sessao(over) }, error: null });
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.resetModules();
  // os caminhos de falha logam console.error de propósito — não é ruído
  // do teste, é o comportamento; silencia pra saída ficar legível
  vi.spyOn(console, "error").mockImplementation(() => {});
  for (const [k, v] of Object.entries(ENV)) vi.stubEnv(k, v);
  // um createClient só atende os três papéis do módulo: service-role vira
  // admin (getUserById/generateLink), anon com Bearer vira o client das
  // queries (sentinel { bearer } guarda o JWT pra asserção) e anon puro
  // é o client de auth (verifyOtp/refreshSession)
  m.createClient.mockImplementation(
    (
      _url: string,
      key: string,
      opts?: { global?: { headers?: Record<string, string> } }
    ) => {
      const bearer = opts?.global?.headers?.Authorization;
      if (bearer) return { bearer };
      if (key === ENV.SUPABASE_SERVICE_ROLE_KEY) {
        return {
          auth: {
            admin: {
              getUserById: m.getUserById,
              generateLink: m.generateLink,
            },
          },
        };
      }
      return {
        auth: { verifyOtp: m.verifyOtp, refreshSession: m.refreshSession },
      };
    }
  );
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("clientImpersonado", () => {
  it("cache vazio minta via generateLink + verifyOtp e devolve o client do JWT", async () => {
    mintOk();
    const clientImpersonado = await carregar();

    const client = await clientImpersonado("user-1");
    expect(client).toEqual({ bearer: "Bearer jwt-1" });
    expect(m.getUserById).toHaveBeenCalledWith("user-1");
    expect(m.generateLink).toHaveBeenCalledWith({
      type: "magiclink",
      email: "pessoa@exemplo.org",
    });
    expect(m.verifyOtp).toHaveBeenCalledWith({
      token_hash: "hash-1",
      type: "magiclink",
    });
  });

  it("dentro da validade responde do cache sem chamar auth de novo", async () => {
    mintOk();
    const clientImpersonado = await carregar();

    const c1 = await clientImpersonado("user-1");
    const c2 = await clientImpersonado("user-1");
    expect(c2).toBe(c1);
    expect(m.getUserById).toHaveBeenCalledTimes(1);
    expect(m.generateLink).toHaveBeenCalledTimes(1);
    expect(m.verifyOtp).toHaveBeenCalledTimes(1);
    expect(m.refreshSession).not.toHaveBeenCalled();
  });

  it("perto de expirar renova com refreshSession sem mintar link novo", async () => {
    // a sessão mintada já nasce quase vencendo — a 2ª chamada cai no refresh
    mintOk({ expires_at: emSegundos(30_000) });
    const clientImpersonado = await carregar();
    await clientImpersonado("user-1");
    expect(m.generateLink).toHaveBeenCalledTimes(1);

    m.refreshSession.mockResolvedValue({
      data: {
        session: sessao({ access_token: "jwt-2", refresh_token: "rt-2" }),
      },
      error: null,
    });
    const c2 = await clientImpersonado("user-1");
    expect(m.refreshSession).toHaveBeenCalledWith({ refresh_token: "rt-1" });
    expect(m.generateLink).toHaveBeenCalledTimes(1); // mint não rodou de novo
    expect(c2).toEqual({ bearer: "Bearer jwt-2" });

    // o cache guardou a sessão renovada — a 3ª chamada não toca em auth
    const c3 = await clientImpersonado("user-1");
    expect(c3).toBe(c2);
    expect(m.refreshSession).toHaveBeenCalledTimes(1);
  });

  it("refresh falhando cai no generateLink (mint de novo)", async () => {
    const clientImpersonado = await carregar();
    mintOk();
    // 1ª sessão quase vencida — a próxima chamada tenta refresh primeiro
    m.verifyOtp.mockResolvedValueOnce({
      data: { session: sessao({ expires_at: emSegundos(30_000) }) },
      error: null,
    });
    // o re-mint devolve uma sessão nova (token distinto prova que não é cache)
    m.verifyOtp.mockResolvedValue({
      data: { session: sessao({ access_token: "jwt-3", refresh_token: "rt-3" }) },
      error: null,
    });
    await clientImpersonado("user-1");

    m.refreshSession.mockResolvedValue({
      data: { session: null },
      error: new Error("refresh_token inválido"),
    });
    const c2 = await clientImpersonado("user-1");
    expect(m.refreshSession).toHaveBeenCalledWith({ refresh_token: "rt-1" });
    expect(m.generateLink).toHaveBeenCalledTimes(2);
    expect(c2).toEqual({ bearer: "Bearer jwt-3" });
  });

  it("mint quebrado devolve null — fail-closed, nunca service-role", async () => {
    const clientImpersonado = await carregar();
    // usuário inexistente
    m.getUserById.mockResolvedValue({
      data: { user: null },
      error: new Error("não achou"),
    });
    expect(await clientImpersonado("user-1")).toBeNull();

    // usuário ok mas verifyOtp recusa o token
    mintOk();
    m.verifyOtp.mockResolvedValue({
      data: { session: null },
      error: new Error("token expirado"),
    });
    expect(await clientImpersonado("user-1")).toBeNull();
  });

  it("refresh morto E mint quebrado também devolve null", async () => {
    const clientImpersonado = await carregar();
    mintOk({ expires_at: emSegundos(30_000) });
    await clientImpersonado("user-1"); // cache existe, mas já vencendo

    m.refreshSession.mockResolvedValue({
      data: { session: null },
      error: new Error("refresh revogado"),
    });
    m.generateLink.mockResolvedValue({
      data: { properties: {} },
      error: new Error("generateLink indisponível"),
    });
    expect(await clientImpersonado("user-1")).toBeNull();
  });
});
