// Provider da camada de IA — cliente OpenAI-compatible genérico sobre
// fetch nativo (decisão sdd §10.1: SDK de vendor acopla; a retenção zero
// é contratual, não técnica — qualquer endpoint chat.completions serve).
// Hoje: opencode Go (IA_API_BASE=https://opencode.ai/zen/go/v1) — plano
// de assinatura; o modelo default (mimo-v2.6-flash) tem retenção 0 dias
// e não treina com os dados, requisito LGPD dos dados de menores.
// O endpoint Go pede dois headers próprios: x-opencode-session (id
// estável por conversa, pra roteamento/cache) e um User-Agent do cliente.
//
// Envs server-only — sem NEXT_PUBLIC_: a chave nunca sai do servidor.
// Não-streaming na v1 (decisão sdd §10.2): o tool-loop re-monta calls no
// meio do stream; a bolha "pensando" cobre a espera típica.

import { z } from "zod";
import { IA_TOOLS } from "./tools";

/** Mensagem no formato chat.completions — `tool_calls`/`tool_call_id` são
 *  o que o provider devolve/exige no loop de tools. */
export type MsgChat = {
  role: "system" | "user" | "assistant" | "tool";
  content: string | null;
  tool_calls?: IaToolCall[];
  tool_call_id?: string;
  name?: string;
};

export type IaToolCall = {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
};

export const IA_MSG_INDISPONIVEL =
  "O assistente está indisponível no momento — tente de novo em instantes.";

/** Flag honesta: sem as três envs o assistente se esconde em vez de falhar
 *  em runtime (rollback = unset IA_API_KEY, plan §Rollback). */
export function providerConfigurado(): boolean {
  return Boolean(
    process.env.IA_API_BASE && process.env.IA_API_KEY && process.env.IA_MODEL
  );
}

// zod 4 tem toJSONSchema nativo — o registry vira function-calling sem dep
let toolsCache: unknown[] | null = null;
function toolsPayload() {
  if (!toolsCache) {
    toolsCache = Object.values(IA_TOOLS).map((t) => ({
      type: "function",
      function: {
        name: t.nome,
        description: t.descricao,
        parameters: z.toJSONSchema(t.schema),
      },
    }));
  }
  return toolsCache;
}

/** Uma rodada com o modelo. `sessao` é o id estável da conversa (o Go o
 *  exige pra rotear; outros providers ignoram o header extra). Nunca
 *  lança — erro de rede/timeout/HTTP vira `{ ok: false, erro }` amigável. */
export async function chamarModelo(
  messages: MsgChat[],
  sessao?: string
): Promise<{ ok: true; mensagem: MsgChat } | { ok: false; erro: string }> {
  try {
    const res = await fetch(`${process.env.IA_API_BASE}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.IA_API_KEY}`,
        "Content-Type": "application/json",
        "User-Agent": "realiza-app/1.0",
        ...(sessao ? { "x-opencode-session": sessao } : {}),
      },
      body: JSON.stringify({
        model: process.env.IA_MODEL,
        messages,
        tools: toolsPayload(),
        tool_choice: "auto",
      }),
      signal: AbortSignal.timeout(Number(process.env.IA_TIMEOUT_MS ?? 20_000)),
    });
    if (!res.ok) {
      const corpo = await res.text().catch(() => "");
      console.error(`chamarModelo: HTTP ${res.status}`, corpo.slice(0, 300));
      return { ok: false, erro: IA_MSG_INDISPONIVEL };
    }
    const msg = (await res.json())?.choices?.[0]?.message as
      | MsgChat
      | undefined;
    if (!msg || (msg.content == null && !msg.tool_calls?.length)) {
      console.error("chamarModelo: resposta sem mensagem utilizável");
      return { ok: false, erro: IA_MSG_INDISPONIVEL };
    }
    return { ok: true, mensagem: msg };
  } catch (e) {
    console.error("chamarModelo:", e);
    return { ok: false, erro: IA_MSG_INDISPONIVEL };
  }
}
