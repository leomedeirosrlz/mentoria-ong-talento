// Rota /api/ia/confirmacao — o approve determinístico das escritas da IA
// (REALIZA-126). Zero LLM no caminho: o Confirmar do card bate aqui com
// sessão cookie e a rota reusa 100% do envelope chamando executarTool com
// confirmacao_id (o ramo de consumo). O que se prova:
//   · mesma flag da bolha — sem IA_BOLHA o endpoint nem existe;
//   · sessão cookie antes de tudo — sem getClaims válido, nada roda;
//   · body .strict() — confirmacao_id uuid, tool snake_case, args record;
//   · o dispatch junta args+confirmacao_id numa chamada só, canal chat;
//   · o retorno espelha ResultadoTool: {ok,dados} ou {ok:false,erro} —
//     200 nos dois desfechos de negócio (o card lê o corpo).

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/ia/confirmacao/route";

const m = vi.hoisted(() => ({
  getClaims: vi.fn(),
  rpc: vi.fn(),
  from: vi.fn(),
  executarTool: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    auth: { getClaims: m.getClaims },
    rpc: m.rpc,
    from: m.from,
  })),
}));
vi.mock("@/lib/ia/tools", () => ({ executarTool: m.executarTool }));

const CID = "99999999-8888-4777-8666-555555555555";

const req = (body: unknown) =>
  new Request("http://app.test/api/ia/confirmacao", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });

const autenticado = () =>
  m.getClaims.mockResolvedValue({
    data: { claims: { sub: "auth-1" } },
    error: null,
  });

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("IA_BOLHA", "1");
  autenticado();
});
afterEach(() => vi.unstubAllEnvs());

describe("gates", () => {
  it("IA_BOLHA desligada devolve 404 antes de autenticar", async () => {
    vi.stubEnv("IA_BOLHA", "0");
    const res = await POST(req({ confirmacao_id: CID, tool: "x", args: {} }));
    expect(res.status).toBe(404);
    expect(m.getClaims).not.toHaveBeenCalled();
    expect(m.executarTool).not.toHaveBeenCalled();
  });

  it("sem sessão devolve 401 e não toca a tool", async () => {
    m.getClaims.mockResolvedValue({ data: { claims: null }, error: null });
    const res = await POST(req({ confirmacao_id: CID, tool: "x", args: {} }));
    expect(res.status).toBe(401);
    await expect(res.json()).resolves.toEqual({
      error: expect.stringContaining("Sessão"),
    });
    expect(m.executarTool).not.toHaveBeenCalled();
  });

  it("body inválido devolve 400 — uuid, snake_case e .strict()", async () => {
    const bodies: unknown[] = [
      {}, // faltam os campos obrigatórios
      { confirmacao_id: "não-uuid", tool: "agendar_encontro", args: {} },
      { confirmacao_id: CID, tool: "Agendar_Encontro!", args: {} }, // regex
      { confirmacao_id: CID, tool: "agendar_encontro", args: {}, extra: 1 }, // strict
      "não é json",
      { confirmacao_id: CID, tool: "agendar_encontro", args: "string" }, // args não-record
    ];
    for (const b of bodies) {
      const res = await POST(req(b));
      expect(res.status).toBe(400);
      await res.json();
    }
    expect(m.executarTool).not.toHaveBeenCalled();
  });
});

describe("dispatch", () => {
  const body = {
    confirmacao_id: CID,
    tool: "agendar_encontro",
    args: { dupla_id: CID, numero: 6 },
  };

  it("junta args+confirmacao_id numa chamada só, no canal chat", async () => {
    m.executarTool.mockResolvedValue({ ok: true, dados: { id: "enc-1" } });
    const res = await POST(req(body));
    expect(res.status).toBe(200);
    expect(m.executarTool).toHaveBeenCalledWith(
      "agendar_encontro",
      { dupla_id: CID, numero: 6, confirmacao_id: CID },
      expect.anything(), // o client da sessão — user-scoped, nunca service
      "chat",
      undefined,
      undefined,
      undefined // sem request_id no body
    );
    await expect(res.json()).resolves.toEqual({
      ok: true,
      dados: { id: "enc-1" },
    });
  });

  it("request_id do body chega ao executarTool — o par de eventos correla", async () => {
    m.executarTool.mockResolvedValue({ ok: true, dados: {} });
    const res = await POST(req({ ...body, request_id: "req-msg-9" }));
    expect(res.status).toBe(200);
    expect(m.executarTool).toHaveBeenCalledWith(
      "agendar_encontro",
      { dupla_id: CID, numero: 6, confirmacao_id: CID },
      expect.anything(),
      "chat",
      undefined,
      undefined,
      "req-msg-9"
    );
  });

  it("recusa de negócio sai como {ok:false,erro} com 200 — o card decide", async () => {
    // consumir devolveu falso (expirada, usada, de outra pessoa, hash
    // divergente): a tool falha fechado e a mensagem volta pro card
    m.executarTool.mockResolvedValue({
      ok: false,
      erro: "Confirmação inválida, expirada ou já utilizada (ou os argumentos mudaram) — peça a prévia de novo.",
    });
    const res = await POST(req(body));
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      ok: false,
      erro: expect.stringContaining("Confirmação inválida"),
    });
  });

  it("args vazio usa o default {} — a tool valida o schema de verdade", async () => {
    m.executarTool.mockResolvedValue({ ok: false, erro: "Argumentos inválidos" });
    const res = await POST(
      req({ confirmacao_id: CID, tool: "resolver_chamado" })
    );
    expect(res.status).toBe(200);
    expect(m.executarTool).toHaveBeenCalledWith(
      "resolver_chamado",
      { confirmacao_id: CID },
      expect.anything(),
      "chat",
      undefined,
      undefined,
      undefined
    );
  });
});
