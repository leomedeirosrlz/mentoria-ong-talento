// Approve determinístico das escritas da IA (REALIZA-126): o Confirmar do
// card de confirmação bate aqui — sessão cookie, zero LLM no caminho. O
// endpoint reusa 100% do envelope: chama a tool com confirmacao_id, a RPC
// ia_confirmacao_consumir valida dono + tool + hash dos args + validade +
// uso único atomicamente, e só então a escrita executa.
//
// "Cancelar" não chama nada — a prévia expira em 10min sozinha. O MCP não
// usa esta rota (aprova no client e re-chama a tool com confirmacao_id);
// mesma família de auth do /api/ia/chat — /api/ia/* fica fora da lista
// pública do proxy, então sem sessão nem chega aqui.

import { NextResponse } from "next/server";
import { z } from "zod";
import { executarTool } from "@/lib/ia/tools";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const Body = z
  .object({
    confirmacao_id: z.uuid(),
    tool: z.string().min(1).max(80).regex(/^[a-z_]+$/),
    args: z.record(z.string(), z.unknown()).default({}),
    // request_id da mensagem que propôs — opcional (o card ecoa; cliente
    // externo simplesmente omite). Correla pro par de eventos ia_eventos
    request_id: z.string().max(64).optional(),
  })
  .strict();

export async function POST(req: Request) {
  // mesma flag da bolha: sem o chat o endpoint nem existe
  if (process.env.IA_BOLHA !== "1") {
    return NextResponse.json({ error: "Não encontrado." }, { status: 404 });
  }
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims?.sub) {
    return NextResponse.json(
      { error: "Sessão expirada — entre de novo." },
      { status: 401 }
    );
  }
  const body = Body.safeParse(await req.json().catch(() => null));
  if (!body.success) {
    return NextResponse.json({ error: "Pedido inválido." }, { status: 400 });
  }

  // o confirmacao_id sai do body e entra como arg — executarTool despacha
  // o ramo de consumo: inválido/expirado/usado/divergente/outra pessoa
  // falha fechado sem tocar a escrita. A auditoria (a 2ª linha do par
  // "proposto × aprovado") sai pelo caminho normal de ia_eventos.
  const r = await executarTool(
    body.data.tool,
    { ...body.data.args, confirmacao_id: body.data.confirmacao_id },
    supabase,
    "chat",
    undefined,
    undefined,
    // sai no evento da execução — mesmo request_id da prévia: o par
    // "proposto × aprovado" fica correlacionado na auditoria
    body.data.request_id
  );
  // 200 nos dois desfechos de negócio — o card lê ok/erro do corpo; os
  // status de infra (401/404/400) ficam pros gates acima
  return r.ok
    ? NextResponse.json({ ok: true, dados: r.dados })
    : NextResponse.json({ ok: false, erro: r.erro });
}
