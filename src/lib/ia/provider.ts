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
// Streaming (REALIZA-244): chamarModeloStream fala SSE com o provider e
// devolve tokens ao vivo pro caller; a montagem das tool_calls é interna —
// delta.tool_calls chega fatiado por `index` e o arguments é string
// concatenada, então re-montar é obrigação desta camada, não da rota.
// chamarModelo (JSON) segue como caminho de fallback.

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

// ---------- streaming (SSE) ----------

export type ResultadoStream =
  | { ok: true; content: string; toolCalls: IaToolCall[] }
  // fallback=true: o provider recusou o stream (HTTP != 2xx ou corpo que
  // não é SSE) — a rota refaz a rodada via chamarModelo, mesmo contrato
  | { ok: false; erro: string; fallback?: boolean; abortado?: boolean };

/** Delta de tool_call como o OpenAI manda no stream: id/name vêm uma vez,
 *  arguments chega em pedaços — tudo indexado por `index`. */
type DeltaToolCall = {
  index: number;
  id?: string;
  type?: string;
  function?: { name?: string; arguments?: string };
};

/** Uma rodada streamada: `stream:true` + Accept SSE; cada data: vira um
 *  chunk chat.completion — delta.content sai por onToken ao vivo e
 *  delta.tool_calls é acumulado por índice até o [DONE]. Nunca lança:
 *  HTTP != 2xx, body ausente ou JSON quebrado viram ResultadoStream.
 *  `signal` vem da rota (req.signal + timeout) — cliente que fecha a
 *  aba interrompe o fetch ao provider na mesma hora. */
export async function chamarModeloStream(
  messages: MsgChat[],
  sessao: string | undefined,
  opts: {
    onToken: (token: string) => void;
    signal: AbortSignal;
    /** a rota passa `() => req.signal.aborted` — um abort do signal
     *  combinado também dispara por timeout, e timeout não é cancelamento
     *  do usuário: vira fallback (a rodada tenta de novo em JSON) */
    clienteAbortou: () => boolean;
  }
): Promise<ResultadoStream> {
  try {
    const res = await fetch(`${process.env.IA_API_BASE}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.IA_API_KEY}`,
        "Content-Type": "application/json",
        Accept: "text/event-stream",
        "User-Agent": "realiza-app/1.0",
        ...(sessao ? { "x-opencode-session": sessao } : {}),
      },
      body: JSON.stringify({
        model: process.env.IA_MODEL,
        messages,
        tools: toolsPayload(),
        tool_choice: "auto",
        stream: true,
      }),
      signal: opts.signal,
    });
    const tipo = res.headers.get("content-type") ?? "";
    if (!res.ok || !res.body || !tipo.includes("text/event-stream")) {
      const corpo = await res.text().catch(() => "");
      console.error(
        `chamarModeloStream: HTTP ${res.status} tipo=${tipo}`,
        corpo.slice(0, 300)
      );
      return { ok: false, erro: IA_MSG_INDISPONIVEL, fallback: true };
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let content = "";
    const calls = new Map<number, IaToolCall>();
    // token com delay artificial nenhum — onToken é enfileirado direto na
    // resposta da rota; a velocidade de exibição é a da rede do provider

    const aplicarDelta = (deltas: DeltaToolCall[]) => {
      for (const d of deltas) {
        const atual =
          calls.get(d.index) ??
          ({ id: "", type: "function", function: { name: "", arguments: "" } } as IaToolCall);
        if (d.id) atual.id = d.id;
        if (d.function?.name) atual.function.name += d.function.name;
        if (d.function?.arguments) atual.function.arguments += d.function.arguments;
        calls.set(d.index, atual);
      }
    };

    const processarData = (payload: string): boolean => {
      if (payload === "[DONE]") return false;
      let chunk: unknown;
      try {
        chunk = JSON.parse(payload);
      } catch {
        return true; // linha não-JSON (comentário/heartbeat): ignora
      }
      const delta = (chunk as {
        choices?: { delta?: { content?: string | null; tool_calls?: DeltaToolCall[] } }[];
      })?.choices?.[0]?.delta;
      if (delta?.content) {
        content += delta.content;
        opts.onToken(delta.content);
      }
      if (delta?.tool_calls?.length) aplicarDelta(delta.tool_calls);
      return true;
    };

    // SSE: eventos separados por \n\n, campos por linha — chunks de rede
    // NÃO alinham com eventos, então o buffer acumula até o próximo \n\n
    let vivo = true;
    while (vivo) {
      // cliente desistiu no meio do stream: para já — drena o reader e
      // sinaliza abortado (a rota não tenta fallback nem emite erro)
      if (opts.clienteAbortou()) {
        await reader.cancel().catch(() => {});
        return { ok: false, erro: "interrompido", abortado: true };
      }
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let corte: number;
      while ((corte = buffer.indexOf("\n\n")) !== -1) {
        const evento = buffer.slice(0, corte);
        buffer = buffer.slice(corte + 2);
        // um evento pode ter várias linhas data: — concatena (spec SSE)
        const dados = evento
          .split("\n")
          .filter((l) => l.startsWith("data:"))
          .map((l) => l.slice(5).trim());
        for (const d of dados) {
          if (!processarData(d)) vivo = false;
        }
      }
    }
    decoder.decode(); // flush do restante multibyte
    return {
      ok: true,
      content,
      toolCalls: [...calls.entries()].sort(([a], [b]) => a - b).map(([, t]) => t),
    };
  } catch (e) {
    if (opts.clienteAbortou()) {
      return { ok: false, erro: "interrompido", abortado: true };
    }
    console.error("chamarModeloStream:", e);
    // stream que quebrou no meio (rede, timeout) pode ser refeito em JSON —
    // a rota só re-envia o que ainda não saiu como token
    return { ok: false, erro: IA_MSG_INDISPONIVEL, fallback: true };
  }
}
