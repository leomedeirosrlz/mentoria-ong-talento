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
// Retry (REALIZA-307): falha transitória (5xx, 429, rede, timeout)
// ganha UMA segunda tentativa com backoff curto — sem ela um soluço
// do provider derrubava a rodada inteira ou forçava um fallback JSON
// redundante no stream. 4xx nunca retenta (é erro nosso, não do
// provider) e abort do cliente/rota idem — no stream o retry só existe
// antes do primeiro byte útil: depois de token na tela, recomeçar
// duplicaria texto.

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

// ---------- retry (REALIZA-307) ----------

/** Backoff único e curto: dá tempo do soluço passar sem estourar o
 *  orçamento que a rota ainda tem pra rodada. */
const RETRY_BACKOFF_MS = 750;

/** Status que merece segunda tentativa: 5xx (instância do provider
 *  caindo) e 429 (rate limit que libera em seguida). 4xx é erro nosso
 *  — auth, payload — retentar só queima cota. */
const statusRetentavel = (status: number) => status === 429 || status >= 500;

/** Throw transitório do fetch: TypeError = a rede caiu antes de vir
 *  resposta; TimeoutError/AbortError = um signal de timeout estourou.
 *  No stream o signal vem da rota e aborto dele NÃO passa por aqui —
 *  o check de `signal.aborted` corre antes e já corta o retry. */
function erroTransitorio(e: unknown): boolean {
  if (e instanceof TypeError) return true;
  const nome = (e as { name?: unknown } | null)?.name;
  return nome === "TimeoutError" || nome === "AbortError";
}

/** Delay antes da 2ª tentativa: 429 honra Retry-After só quando é um
 *  inteiro pequeno (≤3s — espera longa estoura o orçamento da rota);
 *  todo o resto cai no backoff padrão. */
function delayDoRetry(res: Response): number {
  const ra = res.headers.get("retry-after");
  const seg = ra === null ? NaN : Number(ra);
  return res.status === 429 && Number.isInteger(seg) && seg >= 0 && seg <= 3
    ? seg * 1000
    : RETRY_BACKOFF_MS;
}

/** Sleep que o signal corta no meio: resolve `true` se esperou inteiro,
 *  `false` se abortou — a espera nunca estica o orçamento da rodada. */
function esperar(ms: number, signal?: AbortSignal): Promise<boolean> {
  if (signal?.aborted) return Promise.resolve(false);
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", aoAbortar);
      resolve(true);
    }, ms);
    const aoAbortar = () => {
      clearTimeout(timer);
      resolve(false);
    };
    signal?.addEventListener("abort", aoAbortar, { once: true });
  });
}

/** Uma rodada com o modelo. `sessao` é o id estável da conversa (o Go o
 *  exige pra rotear; outros providers ignoram o header extra). Nunca
 *  lança — erro de rede/timeout/HTTP vira `{ ok: false, erro }` amigável.
 *  REALIZA-307: falha transitória retenta uma vez — aqui o timeout é o
 *  AbortSignal.timeout interno (não vem da rota), então TimeoutError
 *  também vale retry. */
export async function chamarModelo(
  messages: MsgChat[],
  sessao?: string
): Promise<{ ok: true; mensagem: MsgChat } | { ok: false; erro: string }> {
  for (let tentativa = 1; tentativa <= 2; tentativa++) {
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
        if (tentativa === 1 && statusRetentavel(res.status)) {
          await esperar(delayDoRetry(res));
          continue;
        }
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
      // só o transitório retenta — erro de parse/lógica cai direto
      if (tentativa === 1 && erroTransitorio(e)) {
        await esperar(RETRY_BACKOFF_MS);
        continue;
      }
      return { ok: false, erro: IA_MSG_INDISPONIVEL };
    }
  }
  return { ok: false, erro: IA_MSG_INDISPONIVEL };
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
 *  aba interrompe o fetch ao provider na mesma hora. REALIZA-307:
 *  enquanto nenhum byte útil saiu, falha transitória retenta uma vez;
 *  depois do primeiro token na tela, quebra vira fallback como sempre
 *  (recomeçar o stream re-imprimiria texto). */
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
  // retry só vale com a saída ainda limpa — depois de token emitido,
  // recomeçar re-imprime texto na tela do usuário
  let saiuAlgo = false;
  for (let tentativa = 1; tentativa <= 2; tentativa++) {
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
        // o provider recusou ANTES do stream abrir: 5xx/429 retenta — a
        // espera é cancelável e o abort no meio dela sai pelo mesmo
        // mapeamento do catch (cliente → "interrompido", rota → fallback)
        if (tentativa === 1 && statusRetentavel(res.status)) {
          if (await esperar(delayDoRetry(res), opts.signal)) continue;
          return opts.clienteAbortou()
            ? { ok: false, erro: "interrompido", abortado: true }
            : { ok: false, erro: IA_MSG_INDISPONIVEL, fallback: true };
        }
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
          saiuAlgo = true;
          content += delta.content;
          opts.onToken(delta.content);
        }
        if (delta?.tool_calls?.length) {
          saiuAlgo = true;
          aplicarDelta(delta.tool_calls);
        }
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
      // não retenta quando: o signal da rota abortou sem ser o cliente
      // (timeout combinado — o orçamento acabou), já é a 2ª tentativa,
      // byte útil já saiu na tela (repetir duplicaria texto) ou o erro
      // não é transitório — tudo cai no fallback, que a rota refaz em
      // JSON re-enviando só o que ainda não virou token
      if (
        opts.signal.aborted ||
        tentativa === 2 ||
        saiuAlgo ||
        !erroTransitorio(e)
      ) {
        return { ok: false, erro: IA_MSG_INDISPONIVEL, fallback: true };
      }
      // rede/timeout antes do 1º byte útil: espera (cancelável) e repete
      if (await esperar(RETRY_BACKOFF_MS, opts.signal)) continue;
      return opts.clienteAbortou()
        ? { ok: false, erro: "interrompido", abortado: true }
        : { ok: false, erro: IA_MSG_INDISPONIVEL, fallback: true };
    }
  }
  return { ok: false, erro: IA_MSG_INDISPONIVEL, fallback: true };
}
