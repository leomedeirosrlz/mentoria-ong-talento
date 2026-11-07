// Servidor MCP do programa (REALIZA-326, plano ia-chatbot-mcp §6) —
// Streamable HTTP num route handler, stateless, sem processo extra.
// Um registry só, dois transportes: as tools são as MESMAS do chat
// (IA_TOOLS/executarTool) — aqui muda a autenticação (PAT no lugar do
// cookie) e o envelope (JSON-RPC no lugar de SSE).
//
// Auth: `Authorization: Bearer rlz_mcp_…` — a RPC ia_mcp_autorizar
// resolve sha256 → profile + papéis. Todos os papéis conectam (fase
// escrita): o gate PAPEIS_MCP cobre o programa inteiro e o allowlist
// fino mora no `roles` de cada tool.
// Execução: JWT-impersonado do dono do PAT (clientImpersonado) — a RLS
// decide o escopo exatamente como no chat; service-role só autentica o
// token. Tools `escreve` passam pelo envelope pendente_confirmacao (0163):
// a 1ª chamada devolve prévia sem efeito, a 2ª consome e executa.
//
// A rota fica FORA da auth do proxy: o middleware só protege páginas;
// /api/* passa direto e quem barra é o Bearer aqui.

import { NextResponse } from "next/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { executarTool, IA_TOOL_CATALOGO } from "@/lib/ia/tools";
import { consumirLimiteIa } from "@/lib/ia/rate-limit";
import { clientImpersonado } from "@/lib/ia/impersonar";
import type { AppRole } from "@/lib/types";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

// todos os papéis conectam via MCP (fase escrita): a execução roda sob o
// JWT real do dono — RLS + allowlist `roles` de cada tool + o envelope
// pendente_confirmacao pra qualquer escrita; este gate passou a ser só
// "tem papel no programa", não mais staff-only
const PAPEIS_MCP: readonly AppRole[] = [
  "coordenacao",
  "supervisor",
  "mentor_dpp",
  "mentor_especialista",
  "mentorado",
];

const Rpc = z.object({
  jsonrpc: z.literal("2.0"),
  id: z.union([z.string(), z.number(), z.null()]).optional(),
  method: z.string(),
  params: z.record(z.string(), z.unknown()).optional(),
});

const PROTOCOLO = "2025-03-26";

function rpcResult(id: unknown, result: unknown) {
  return NextResponse.json({ jsonrpc: "2.0", id: id ?? null, result });
}
function rpcErro(id: unknown, code: number, message: string) {
  return NextResponse.json({
    jsonrpc: "2.0",
    id: id ?? null,
    error: { code, message },
  });
}

/** Service client SÓ pra autenticar o PAT (ia_mcp_autorizar roda antes de
 *  sabermos quem é o dono). A execução das tools usa clientImpersonado —
 *  JWT real do dono, RLS decide o escopo (sdd D1). Service-role bypassaria
 *  a RLS: um PAT de supervisor leria como coordenador — priv-esc por canal
 *  externo com credencial de longa duração. */
function clientServico() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
}

export async function POST(req: Request) {
  // ---- auth: Bearer PAT → profile + papéis (gate coord/staff) ----
  const token = /^Bearer\s+(.+)$/.exec(req.headers.get("authorization") ?? "")
    ?.[1]?.trim();
  if (!token) {
    return NextResponse.json(
      { error: "Token ausente — Authorization: Bearer rlz_mcp_…" },
      { status: 401 }
    );
  }
  const supabase = clientServico();
  const { data: authRows } = await supabase.rpc("ia_mcp_autorizar", {
    p_token: token,
  });
  const autorizado = authRows?.[0] as
    | {
        profile_id: string;
        user_id: string | null;
        papel: AppRole | null;
        papeis: AppRole[];
      }
    | undefined;
  if (!autorizado) {
    return NextResponse.json(
      { error: "Token inválido ou revogado." },
      { status: 401 }
    );
  }
  const papeis: AppRole[] = autorizado.papeis?.length
    ? autorizado.papeis
    : autorizado.papel
      ? [autorizado.papel]
      : [];
  if (!papeis.some((p) => PAPEIS_MCP.includes(p))) {
    return NextResponse.json(
      { error: "O acesso por IA externa ainda não está disponível pro seu papel." },
      { status: 403 }
    );
  }

  // ---- JSON-RPC ----
  const body = await req.json().catch(() => null);
  const msg = Rpc.safeParse(body);
  if (!msg.success) return rpcErro(null, -32700, "Pedido inválido.");
  const { id, method, params } = msg.data;

  // notificações do protocolo (sem id → sem resposta)
  if (id == null && method.startsWith("notifications/")) {
    return new Response(null, { status: 204 });
  }

  switch (method) {
    case "initialize":
      return rpcResult(id, {
        protocolVersion: PROTOCOLO,
        capabilities: { tools: {} },
        serverInfo: { name: "realiza-mcp", version: "1.0.0" },
      });
    case "ping":
      return rpcResult(id, {});
    case "tools/list": {
      const tools = IA_TOOL_CATALOGO.filter((t) =>
        t.roles.some((r) => papeis.includes(r))
      ).map((t) => ({
        name: t.nome,
        description: t.descricao,
        inputSchema: z.toJSONSchema(t.schema),
      }));
      return rpcResult(id, { tools });
    }
    case "tools/call": {
      const nome = params?.name;
      const args = params?.arguments ?? {};
      if (typeof nome !== "string") {
        return rpcErro(id, -32602, "params.name ausente.");
      }
      // execução com o JWT real do dono do PAT (sdd D1): RLS escopa as
      // queries — supervisor vê só o supervisionado, como no chat.
      // Fail-closed: sem sessão mintada a rota não cai de volta pro
      // service-role (seria o priv-esc que estamos fechando)
      if (!autorizado.user_id) {
        return rpcErro(id, -32000, "Conta sem usuário vinculado.");
      }
      const clientExec = await clientImpersonado(autorizado.user_id);
      if (!clientExec) {
        return rpcErro(
          id,
          -32000,
          "Não consegui autenticar a execução — tente de novo."
        );
      }
      // mesmo limite do chat (20/min por pessoa) — a PAT é da pessoa, o
      // dono responde pelo uso dela; a reserva é atômica sob lock
      const limite = await consumirLimiteIa(clientExec, { tool: nome }, "mcp");
      if (!limite.permitido) {
        return rpcErro(
          id,
          -32000,
          "Limite de consultas por minuto atingido — aguarde um instante e tente de novo."
        );
      }
      const r = await executarTool(
        nome,
        args,
        clientExec,
        "mcp",
        papeis,
        undefined,
        limite.requestId
      );
      if (!r.ok) {
        return rpcResult(id, {
          content: [{ type: "text", text: r.erro }],
          isError: true,
        });
      }
      return rpcResult(id, {
        content: [{ type: "text", text: JSON.stringify(r.dados) }],
      });
    }
    default:
      return rpcErro(id, -32601, `Método desconhecido: ${method}`);
  }
}

// Streamable HTTP prevê GET/SSE pra server→client; este servidor não
// emite notificações — 405 documentado em vez de aceitar e calar
export function GET() {
  return NextResponse.json(
    { error: "Somente POST (JSON-RPC)." },
    { status: 405, headers: { Allow: "POST" } }
  );
}
