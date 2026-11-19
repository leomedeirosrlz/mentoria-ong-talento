// Auth do /api/mcp — o ponto mais frágil de auth do app: a rota fica
// FORA do proxy (o middleware só protege páginas), então o Bearer PAT
// é a única rede de segurança. O contrato travado aqui:
//   · sem Authorization → 401 com a mensagem do protocolo (nunca o
//     catálogo vaza num 200 silencioso);
//   · PAT inválido/revogado (RPC sem linha) → 401;
//   · perfil sem papel no programa → 403 antes de executar qualquer
//     tool — e sem reservar slot de rate-limit (chamada negada não
//     queima a cota do dono);
//   · papeis[] manda; o papel primário é só fallback — um PAT híbrido
//     não herda poder do `papel` quando `papeis` veio preenchido.
// O service client e a execução ficam mockados na fronteira: o que se
// prova é o GATE da rota, não a RPC ia_mcp_autorizar (essa é e2e).
// PAPEIS_MCP é importado real — o spec também trava a lista contra a
// união AppRole: os 5 papéis do programa, sem extra e sem duplicata.

import { readFileSync } from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { POST } from "@/app/api/mcp/route";
import { PAPEIS_MCP } from "@/lib/ia/mcp-papeis";

const m = vi.hoisted(() => ({
  rpc: vi.fn(),
  executarTool: vi.fn(),
  clientImpersonado: vi.fn(),
  consumirLimiteIa: vi.fn(),
}));

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({ rpc: m.rpc })),
}));
vi.mock("@/lib/ia/tools", () => ({
  ESCRITAS_DOMINIO: new Set<string>(),
  executarTool: m.executarTool,
  IA_TOOL_CATALOGO: [
    {
      nome: "leitura_coord",
      descricao: "só coordenação",
      schema: z.object({}),
      roles: ["coordenacao"],
    },
    {
      nome: "leitura_jovem",
      descricao: "só mentorado",
      schema: z.object({}),
      roles: ["mentorado"],
    },
    {
      nome: "leitura_geral",
      descricao: "qualquer papel",
      schema: z.object({}),
      roles: [
        "coordenacao",
        "supervisor",
        "mentor_dpp",
        "mentor_especialista",
        "mentorado",
      ],
    },
  ],
}));
vi.mock("@/lib/ia/impersonar", () => ({
  clientImpersonado: m.clientImpersonado,
}));
vi.mock("@/lib/ia/rate-limit", () => ({
  consumirLimiteIa: m.consumirLimiteIa,
}));

const TOKEN = "rlz_mcp_" + "a".repeat(48);

function req(
  body: unknown = { jsonrpc: "2.0", id: 1, method: "initialize" },
  auth: string | null = `Bearer ${TOKEN}`
) {
  return new Request("http://app.test/api/mcp", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(auth ? { authorization: auth } : {}),
    },
    body: JSON.stringify(body),
  });
}

/** Dono do PAT com os papéis que a RPC autorizou. */
function autorizado(papel: string | null, papeis: string[] | null) {
  m.rpc.mockResolvedValue({
    data: [
      { profile_id: "prof-1", user_id: "user-1", papel, papeis },
    ],
    error: null,
  });
}

beforeEach(() => {
  vi.resetAllMocks();
  m.clientImpersonado.mockResolvedValue({ impersonado: true });
  m.consumirLimiteIa.mockResolvedValue({
    permitido: true,
    requestId: "req-1",
  });
});

describe("/api/mcp — Bearer PAT", () => {
  it("sem Authorization devolve 401 com a mensagem do protocolo", async () => {
    const res = await POST(req(undefined, null));
    expect(res.status).toBe(401);
    await expect(res.json()).resolves.toEqual({
      error: expect.stringContaining("Bearer"),
    });
    expect(m.rpc).not.toHaveBeenCalled();
  });

  it.each(["", "Bearer", "Basic abc", "Bearer   "])(
    "header malformado (%j) também é 401",
    async (auth) => {
      const res = await POST(req(undefined, auth));
      expect(res.status).toBe(401);
      expect(m.rpc).not.toHaveBeenCalled();
    }
  );

  it.each([[[]], [null]])(
    "PAT inválido/revogado (RPC devolve %j) → 401",
    async (data) => {
      m.rpc.mockResolvedValue({ data, error: null });
      const res = await POST(req());
      expect(res.status).toBe(401);
      await expect(res.json()).resolves.toEqual({
        error: expect.stringContaining("inválido ou revogado"),
      });
      expect(m.rpc).toHaveBeenCalledWith("ia_mcp_autorizar", {
        p_token: TOKEN,
      });
    }
  );

  it("perfil sem papel no programa → 403 sem executar tool nem reservar cota", async () => {
    autorizado(null, []);
    const res = await POST(
      req({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "leitura_geral", arguments: {} } })
    );
    expect(res.status).toBe(403);
    await expect(res.json()).resolves.toEqual({
      error: expect.stringContaining("seu papel"),
    });
    expect(m.executarTool).not.toHaveBeenCalled();
    expect(m.consumirLimiteIa).not.toHaveBeenCalled();
  });

  it("papel fora do programa → 403 mesmo com PAT válido", async () => {
    autorizado("estagiario", ["estagiario"]);
    const res = await POST(req());
    expect(res.status).toBe(403);
    expect(m.executarTool).not.toHaveBeenCalled();
  });
});

describe("papeis[] manda; papel primário é fallback", () => {
  const listar = async () => {
    const res = await POST(
      req({ jsonrpc: "2.0", id: 1, method: "tools/list" })
    );
    const { result } = await res.json();
    return (result.tools as { name: string }[]).map((t) => t.name);
  };

  it("papeis preenchido governa o catálogo — o papel primário não vaza", async () => {
    // híbrido: papel primário coordenação, papeis efetivo só mentorado —
    // o catálogo tem que ser o do papeis[], não o do papel
    autorizado("coordenacao", ["mentorado"]);
    expect((await listar()).sort()).toEqual(
      ["leitura_geral", "leitura_jovem"].sort()
    );
  });

  it("tools/call respeita papeis[] — tool de papel 'perdido' é negada antes da cota", async () => {
    autorizado("coordenacao", ["mentorado"]);
    const res = await POST(
      req({
        jsonrpc: "2.0",
        id: 1,
        method: "tools/call",
        params: { name: "leitura_coord", arguments: {} },
      })
    );
    const { error } = await res.json();
    expect(error.message).toContain("não está disponível pro seu papel");
    expect(m.consumirLimiteIa).not.toHaveBeenCalled();
    expect(m.executarTool).not.toHaveBeenCalled();
  });

  it.each([[[], "coordenacao"], [null, "coordenacao"]])(
    "papeis %j cai no primário %s",
    async (papeis, papel) => {
      autorizado(papel, papeis as string[] | null);
      expect((await listar()).sort()).toEqual(
        ["leitura_coord", "leitura_geral"].sort()
      );
    }
  );
});

describe("PAPEIS_MCP", () => {
  it("cobre os 5 papéis do programa — sem extra e sem duplicata", () => {
    const fonte = readFileSync(
      path.join(process.cwd(), "src", "lib", "types.ts"),
      "utf8"
    );
    const uniao = /export type AppRole =([\s\S]*?);/.exec(fonte);
    expect(uniao, "união AppRole não achada").toBeTruthy();
    const papeisDoTipo = [...uniao![1].matchAll(/"([^"]+)"/g)].map(
      (m) => m[1]
    );
    expect(new Set(PAPEIS_MCP).size, "duplicata em PAPEIS_MCP").toBe(
      PAPEIS_MCP.length
    );
    expect([...PAPEIS_MCP].sort()).toEqual([...papeisDoTipo].sort());
    expect(PAPEIS_MCP).toHaveLength(5);
  });
});
