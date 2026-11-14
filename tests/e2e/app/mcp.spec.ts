// Servidor MCP /api/mcp (REALIZA-297) — o contrato JSON-RPC inteiro pelo
// request do Playwright, sem SDK: handshake, auth (401/403), catálogo
// filtrado por papel, gate por tool e a prova de que a execução roda sob
// a RLS do dono do PAT (conteúdo, não status — se fosse service-role, o
// mentor veria a dupla do mentorReserva). Os PATs são os determinísticos
// do seed (helpers.MCP_PAT ↔ MCP_PAT_FIXTURES de scripts/seed-e2e-staging).

import { appEnvOk, expect, MCP_PAT, test } from "../helpers";
import type { Page } from "@playwright/test";

// ids das fixtures do seed — mesma convenção dos demais specs (redeclarar;
// E2E_DUPLA_ID pode sobrepor a dupla primária)
const DUPLA_ID =
  process.env.E2E_DUPLA_ID ?? "e2e00000-0000-4000-8000-000000000030";
const DUPLA2_ID =
  process.env.E2E_DUPLA2_ID ?? "e2e00000-0000-4000-8000-000000000070";

// corpo solto do JSON-RPC — cada resposta traz um subconjunto: erro de
// auth é string, erro de protocolo é {code,message}, result é o payload
interface RpcBody {
  error?: string | { code: number; message: string };
  result?: {
    serverInfo?: { name: string };
    protocolVersion?: string;
    instructions?: string;
    tools?: { name: string }[];
    isError?: boolean;
    content?: { text: string }[];
  };
}

type RpcResp = { status: number; body: RpcBody };

/** Um JSON-RPC contra /api/mcp. `token` null = sem Authorization (caso do
 *  401). O bypass do Vercel entra explícito: page.request não passa pelo
 *  page.route que injeta o header nas navegações (mesmo gap do apiGetApp). */
async function rpc(
  page: Page,
  token: string | null,
  data: Record<string, unknown>
): Promise<RpcResp> {
  const bypass = process.env.VERCEL_AUTOMATION_BYPASS;
  const res = await page.request.post("/api/mcp", {
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(bypass ? { "x-vercel-protection-bypass": bypass } : {}),
    },
    data: { jsonrpc: "2.0", ...data },
  });
  const texto = await res.text();
  // notification 204 has no body — the cast keeps the JSON-RPC paths typed
  return {
    status: res.status(),
    body: (texto ? JSON.parse(texto) : null) as RpcBody,
  };
}

/** O payload da tool mora em content[0].text como JSON stringificado. */
function dadosTool(body: RpcBody) {
  const texto = body.result?.content?.[0]?.text;
  return texto ? JSON.parse(texto) : undefined;
}

test.describe("servidor MCP (/api/mcp)", () => {
  test.skip(
    !appEnvOk(),
    "sem credenciais de teste (E2E_*) — pula specs de app"
  );

  test("initialize com PAT de mentor: handshake completo", async ({ page }) => {
    const { status, body } = await rpc(page, MCP_PAT.mentor, {
      id: 1,
      method: "initialize",
    });
    expect(status).toBe(200);
    expect(body.error).toBeUndefined();
    expect(body.result?.serverInfo?.name).toBe("realiza-mcp");
    expect(body.result?.protocolVersion).toBe("2025-03-26");
    expect(typeof body.result?.instructions).toBe("string");
    expect(body.result?.instructions?.length).toBeGreaterThan(0);
  });

  test("tools/list do mentor: catálogo de staff, sem tools de jovem", async ({
    page,
  }) => {
    const { status, body } = await rpc(page, MCP_PAT.mentor, {
      id: 2,
      method: "tools/list",
    });
    expect(status).toBe(200);
    const nomes = (body.result?.tools ?? []).map((t) => t.name);
    for (const t of [
      "ficha_dupla",
      "duplas_do_usuario",
      "guia_consulta",
      "agenda_do_periodo",
      "plano_em_dia",
    ])
      expect(nomes).toContain(t);
    // staff de coord/sup e a praia do mentorado ficam de fora
    for (const t of [
      "aguardando_par",
      "capacidade_mentores",
      "resumo_semana",
      "minha_dupla",
      "meu_progresso",
    ])
      expect(nomes).not.toContain(t);
  });

  test("tools/list do jovem: catálogo de mentorado, sem tools de staff", async ({
    page,
  }) => {
    const { status, body } = await rpc(page, MCP_PAT.jovem, {
      id: 3,
      method: "tools/list",
    });
    expect(status).toBe(200);
    const nomes = (body.result?.tools ?? []).map((t) => t.name);
    for (const t of [
      "minha_dupla",
      "minha_agenda",
      "meus_combinados",
      "meu_progresso",
      "guia_consulta",
      "ficha_dupla",
      "instrumentos_da_dupla",
    ])
      expect(nomes).toContain(t);
    for (const t of [
      "resumo_semana",
      "duplas_do_usuario",
      "aguardando_par",
      "pessoas_busca",
      "registros_da_dupla",
      "plano_em_dia",
    ])
      expect(nomes).not.toContain(t);
  });

  test("sem Bearer → 401 'Token ausente'; PAT inválido → 401", async ({
    page,
  }) => {
    const sem = await rpc(page, null, { id: 4, method: "initialize" });
    expect(sem.status).toBe(401);
    expect(sem.body.error).toContain("Token ausente");

    const lixo = await rpc(page, "rlz_mcp_lixo", {
      id: 4,
      method: "initialize",
    });
    expect(lixo.status).toBe(401);
    expect(lixo.body.error).toContain("Token inválido ou revogado");
  });

  test("PAT de perfil sem papel → 403", async ({ page }) => {
    const { status, body } = await rpc(page, MCP_PAT.semPapel, {
      id: 5,
      method: "initialize",
    });
    expect(status).toBe(403);
    expect(body.error).toContain(
      "acesso por IA externa ainda não está disponível"
    );
  });

  test("RLS: duplas_do_usuario do mentor só traz a própria dupla", async ({
    page,
  }) => {
    const { status, body } = await rpc(page, MCP_PAT.mentor, {
      id: 6,
      method: "tools/call",
      params: { name: "duplas_do_usuario", arguments: {} },
    });
    expect(status).toBe(200);
    expect(body.error).toBeUndefined();
    const dados = dadosTool(body);
    const ids = dados.duplas.map((d: { dupla_id: string }) => d.dupla_id);
    // a prova é de conteúdo: service-role traria …070 (mentorReserva) junto
    expect(ids).toContain(DUPLA_ID);
    expect(ids).not.toContain(DUPLA2_ID);
  });

  test("RLS: ficha_dupla de dupla alheia devolve null sem isError", async ({
    page,
  }) => {
    const { status, body } = await rpc(page, MCP_PAT.mentor, {
      id: 7,
      method: "tools/call",
      params: { name: "ficha_dupla", arguments: { dupla_id: DUPLA2_ID } },
    });
    expect(status).toBe(200);
    expect(body.error).toBeUndefined();
    expect(body.result?.isError).toBeUndefined();
    expect(dadosTool(body)).toBeNull();
  });

  test("guia_consulta acha o chunk guia-e2e (PAT coord — fora do manifest é coord-only)", async ({
    page,
  }) => {
    const { status, body } = await rpc(page, MCP_PAT.coord, {
      id: 8,
      method: "tools/call",
      params: {
        name: "guia_consulta",
        arguments: { pergunta: "repescagem e2e" },
      },
    });
    expect(status).toBe(200);
    expect(body.error).toBeUndefined();
    const dados = dadosTool(body);
    expect(dados.fontes.map((f: { guia: string }) => f.guia)).toContain(
      "guia-e2e"
    );
    expect(dados.guias).toContain("guia-e2e");
  });

  test("plano_em_dia do mentor na própria dupla: envelope aplicavel", async ({
    page,
  }) => {
    const { status, body } = await rpc(page, MCP_PAT.mentor, {
      id: 10,
      method: "tools/call",
      params: {
        name: "plano_em_dia",
        arguments: { dupla_id: DUPLA_ID },
      },
    });
    expect(status).toBe(200);
    expect(body.error).toBeUndefined();
    const dados = dadosTool(body);
    // a fixture decide se há plano: aplicavel=true traz os passos com ação
    // e data; false explica o motivo — o contrato vale pros dois ramos
    expect(dados).not.toBeNull();
    expect(typeof dados.aplicavel).toBe("boolean");
    if (dados.aplicavel) {
      expect(Array.isArray(dados.passos)).toBe(true);
      for (const p of dados.passos) {
        expect(["agendar", "remarcar", "travado"]).toContain(p.acao);
        expect(typeof p.data_sugerida).toBe("string");
      }
    } else {
      expect(typeof dados.motivo).toBe("string");
    }
  });

  test("plano_em_dia de dupla alheia ao mentor devolve null (RLS)", async ({
    page,
  }) => {
    const { status, body } = await rpc(page, MCP_PAT.mentor, {
      id: 11,
      method: "tools/call",
      params: {
        name: "plano_em_dia",
        arguments: { dupla_id: DUPLA2_ID },
      },
    });
    expect(status).toBe(200);
    expect(body.error).toBeUndefined();
    expect(body.result?.isError).toBeUndefined();
    expect(dadosTool(body)).toBeNull();
  });

  test("gate por tool: jovem chama plano_em_dia → erro JSON-RPC -32000", async ({
    page,
  }) => {
    const { status, body } = await rpc(page, MCP_PAT.jovem, {
      id: 12,
      method: "tools/call",
      params: {
        name: "plano_em_dia",
        arguments: { dupla_id: DUPLA_ID },
      },
    });
    expect(status).toBe(200);
    expect(body.result).toBeUndefined();
    const erro = body.error as { code: number; message: string };
    expect(erro.code).toBe(-32000);
    expect(erro.message).toContain("não está disponível pro seu papel");
  });

  test("gate por tool: jovem chama resumo_semana → erro JSON-RPC -32000", async ({
    page,
  }) => {
    // comportamento real: o gate de papel da rota (:172) responde no
    // envelope `error` com code -32000 — não um result com isError:true
    const { status, body } = await rpc(page, MCP_PAT.jovem, {
      id: 9,
      method: "tools/call",
      params: { name: "resumo_semana", arguments: {} },
    });
    expect(status).toBe(200);
    expect(body.result).toBeUndefined();
    const erro = body.error as { code: number; message: string };
    expect(erro.code).toBe(-32000);
    expect(erro.message).toContain("não está disponível pro seu papel");
  });

  test("GET /api/mcp → 405 com Allow: POST", async ({ page }) => {
    const bypass = process.env.VERCEL_AUTOMATION_BYPASS;
    const res = await page.request.get("/api/mcp", {
      headers: bypass ? { "x-vercel-protection-bypass": bypass } : undefined,
    });
    expect(res.status()).toBe(405);
    expect(res.headers()["allow"]).toBe("POST");
  });

  test("notifications/initialized sem id → 204", async ({ page }) => {
    const { status, body } = await rpc(page, MCP_PAT.mentor, {
      method: "notifications/initialized",
    });
    expect(status).toBe(204);
    expect(body).toBeNull();
  });
});
