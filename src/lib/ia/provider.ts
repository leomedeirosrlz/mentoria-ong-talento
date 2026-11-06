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
// Cadeia de modelos (REALIZA-328/329): cada chamada leva o primário +
// fallbacks ordenados por tier (ia_config). Falha transitória (5xx,
// 429, 402, rede, timeout), 404 ou 400 "model unavailable" avança pro
// próximo slug — slugs e cotas do Zen mudam rápido e a cadeia absorve
// sem deploy. Retry no MESMO slug não existe: repetiria o mesmo ponto
// de falha; a exceção é o 400 de reasoning_effort, retry grátis sem o
// campo no mesmo modelo. No stream, avançar só vale antes do primeiro
// byte útil: depois de token na tela, recomeçar duplicaria texto.

import { z } from "zod";
import type { AppRole } from "@/lib/types";
import type { EsforcoIa } from "./config";
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

// zod 4 tem toJSONSchema nativo — o registry vira function-calling sem dep.
// O payload é filtrado por papel (REALIZA-333): anunciar tool que o papel
// não pode rodar só ensinava o modelo a chamar e papagaia a descrição da
// negação na resposta — mentor lia "fila de pareamento, ocupação dos
// mentores" de tools coord-only. Cache por conjunto de papéis.
const toolsCache = new Map<string, unknown[]>();
function toolsPayload(papeis: AppRole[] | undefined) {
  const chave = papeis ? [...papeis].sort().join("|") : "*";
  let cached = toolsCache.get(chave);
  if (!cached) {
    cached = Object.values(IA_TOOLS)
      .filter((t) => !papeis || t.roles.some((r) => papeis.includes(r)))
      .map((t) => ({
        type: "function",
        function: {
          name: t.nome,
          description: t.descricao,
          parameters: z.toJSONSchema(t.schema),
        },
      }));
    toolsCache.set(chave, cached);
  }
  return cached;
}

// ---------- retry (REALIZA-307) ----------

/** Backoff único e curto: dá tempo do soluço passar sem estourar o
 *  orçamento que a rota ainda tem pra rodada. */
const RETRY_BACKOFF_MS = 750;

/** Status que merece segunda tentativa: 5xx (instância do provider
 *  caindo), 429 (rate limit que libera em seguida) e 402 (cota/janela
 *  estourada — o Zen cobra por janelas de 5h). */
const statusRetentavel = (status: number) =>
  status === 429 || status === 402 || status >= 500;

/** Falha que avança a cadeia de fallback: além do transitório, 404 e
 *  400 com cara de indisponibilidade do modelo — slugs mudam rápido
 *  no Zen ("Model is unavailable" chega como 400) e a cadeia existe
 *  exatamente pra isso. 400 genérico (payload nosso) para a rodada. */
function avancaCadeia(status: number, corpo: string): boolean {
  if (statusRetentavel(status) || status === 404) return true;
  if (status !== 400) return false;
  return /unavailable|model|quota|limit/i.test(corpo);
}

/** [primário, ...fallbacks] dedup'd; cadeia vazia cai no IA_MODEL do
 *  ambiente (undefined → montarBody resolve). Cada modelo tenta uma
 *  vez — retry no MESMO slug só repetiria o mesmo ponto de falha. */
function cadeiaDeModelos(
  primario: string | undefined,
  fallbacks?: string[]
): (string | undefined)[] {
  const unicos = [
    ...new Set(
      [primario, ...(fallbacks ?? [])].filter(
        (s): s is string => Boolean(s && s.trim())
      )
    ),
  ];
  return unicos.length ? unicos : [undefined];
}

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

// ---------- esforço (REALIZA-328) ----------

const EFFORT = { baixo: "low", medio: "medium", alto: "high" } as const;

/** Corpo compartilhado das duas chamadas: tier de modelo vem do roteador
 *  (ia_config), não do env direto — slug ausente cai no IA_MODEL de
 *  sempre. reasoning_effort só entra quando configurado; provider que
 *  desconhece o campo devolve 400 e a chamada refaz sem ele (uma vez,
 *  flag `mandarEsforco` no caller). */
function montarBody(
  messages: MsgChat[],
  modelo: string | undefined,
  esforco: EsforcoIa | undefined,
  stream: boolean,
  papeis: AppRole[] | undefined
) {
  return JSON.stringify({
    model: modelo || process.env.IA_MODEL,
    messages,
    tools: toolsPayload(papeis),
    tool_choice: "auto",
    ...(esforco ? { reasoning_effort: EFFORT[esforco] } : {}),
    ...(stream ? { stream: true } : {}),
  });
}

/** Uma rodada com o modelo. `sessao` é o id estável da conversa (o Go o
 *  exige pra rotear; outros providers ignoram o header extra). Nunca
 *  lança — erro de rede/timeout/HTTP vira `{ ok: false, erro }` amigável.
 *  REALIZA-307: falha transitória retenta uma vez — aqui o timeout é o
 *  AbortSignal.timeout interno (não vem da rota), então TimeoutError
 *  também vale retry. REALIZA-328: modelo/esforço por chamada —
 *  400 com reasoning_effort refaz a rodada sem o campo. */
export async function chamarModelo(
  messages: MsgChat[],
  sessao?: string,
  opts?: {
    modelo?: string;
    esforco?: EsforcoIa;
    fallbacks?: string[];
    papeis?: AppRole[];
  }
): Promise<{ ok: true; mensagem: MsgChat } | { ok: false; erro: string }> {
  const cadeia = cadeiaDeModelos(opts?.modelo, opts?.fallbacks);
  let esperaMs = 0; // Retry-After de um 429 carrega pro próximo modelo
  for (let i = 0; i < cadeia.length; i++) {
    const ultimo = i === cadeia.length - 1;
    if (esperaMs) {
      await esperar(esperaMs);
      esperaMs = 0;
    }
    // flag por modelo: o próximo da cadeia merece sua própria chance
    // com reasoning_effort (um que recusa não fala pelos outros)
    let mandarEsforco = Boolean(opts?.esforco);
    for (;;) {
      try {
        const res = await fetch(`${process.env.IA_API_BASE}/chat/completions`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${process.env.IA_API_KEY}`,
            "Content-Type": "application/json",
            "User-Agent": "realiza-app/1.0",
            ...(sessao ? { "x-opencode-session": sessao } : {}),
          },
          body: montarBody(
            messages,
            cadeia[i],
            mandarEsforco ? opts?.esforco : undefined,
            false,
            opts?.papeis
          ),
          signal: AbortSignal.timeout(Number(process.env.IA_TIMEOUT_MS ?? 20_000)),
        });
        if (!res.ok) {
          // provider que não conhece reasoning_effort: tira o campo e
          // refaz no MESMO modelo — retry grátis, não consome a cadeia
          if (res.status === 400 && mandarEsforco) {
            mandarEsforco = false;
            continue;
          }
          const corpo = await res.text().catch(() => "");
          console.error(
            `chamarModelo: ${cadeia[i] ?? "env"} HTTP ${res.status}`,
            corpo.slice(0, 300)
          );
          if (!ultimo && avancaCadeia(res.status, corpo)) {
            esperaMs = delayDoRetry(res);
            break;
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
        console.error(`chamarModelo: ${cadeia[i] ?? "env"}`, e);
        if (!ultimo && erroTransitorio(e)) {
          esperaMs = RETRY_BACKOFF_MS;
          break;
        }
        return { ok: false, erro: IA_MSG_INDISPONIVEL };
      }
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
    /** tier/esforço resolvidos pela rota (ia_config + roteador) */
    modelo?: string;
    esforco?: EsforcoIa;
    /** cadeia ordenada de fallback por tier — cada slug tenta uma vez,
     *  sempre ANTES do primeiro byte útil sair na tela */
    fallbacks?: string[];
    /** papéis do usuário — o payload de tools já sai filtrado por eles
     *  (REALIZA-333); ausente = todas (MCP/tests que não têm papel) */
    papeis?: AppRole[];
  }
): Promise<ResultadoStream> {
  // retry só vale com a saída ainda limpa — depois de token emitido,
  // recomeçar (mesmo em outro modelo) re-imprime texto na tela
  let saiuAlgo = false;
  const cadeia = cadeiaDeModelos(opts.modelo, opts.fallbacks);
  let esperaMs = 0;
  for (let i = 0; i < cadeia.length; i++) {
    const ultimo = i === cadeia.length - 1;
    if (esperaMs) {
      if (!(await esperar(esperaMs, opts.signal)))
        return opts.clienteAbortou()
          ? { ok: false, erro: "interrompido", abortado: true }
          : { ok: false, erro: IA_MSG_INDISPONIVEL, fallback: true };
      esperaMs = 0;
    }
    let mandarEsforco = Boolean(opts.esforco);
    for (;;) {
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
        body: montarBody(
          messages,
          cadeia[i],
          mandarEsforco ? opts.esforco : undefined,
          true,
          opts.papeis
        ),
        signal: opts.signal,
      });
      const tipo = res.headers.get("content-type") ?? "";
      if (!res.ok || !res.body || !tipo.includes("text/event-stream")) {
        // 400 por reasoning_effort desconhecido: tira e refaz no mesmo
        // modelo — o campo é opcional e não pode derrubar a rodada
        if (res.status === 400 && mandarEsforco) {
          mandarEsforco = false;
          continue;
        }
        const corpo = await res.text().catch(() => "");
        console.error(
          `chamarModeloStream: ${cadeia[i] ?? "env"} HTTP ${res.status} tipo=${tipo}`,
          corpo.slice(0, 300)
        );
        // o provider recusou ANTES do stream abrir: avança a cadeia —
        // a espera é cancelável e o abort no meio dela sai pelo mesmo
        // mapeamento do catch (cliente → "interrompido", rota → fallback)
        if (!ultimo && avancaCadeia(res.status, corpo)) {
          esperaMs = delayDoRetry(res);
          break;
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
      console.error(`chamarModeloStream: ${cadeia[i] ?? "env"}`, e);
      // não avança quando: o signal da rota abortou sem ser o cliente
      // (timeout combinado — o orçamento acabou), é o último modelo da
      // cadeia, byte útil já saiu na tela (repetir duplicaria texto) ou
      // o erro não é transitório — tudo cai no fallback, que a rota
      // refaz em JSON re-enviando só o que ainda não virou token
      if (
        opts.signal.aborted ||
        ultimo ||
        saiuAlgo ||
        !erroTransitorio(e)
      ) {
        return { ok: false, erro: IA_MSG_INDISPONIVEL, fallback: true };
      }
      esperaMs = RETRY_BACKOFF_MS;
      break;
    }
    }
  }
  return { ok: false, erro: IA_MSG_INDISPONIVEL, fallback: true };
}
