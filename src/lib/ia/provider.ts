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
import { ESCRITAS_DOMINIO, IA_TOOLS } from "./tools";

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

/** Tool ad-hoc fora do registry do chat (ex.: match_semantico da
 *  importação assistida — a saída do modelo chega SÓ por function-call,
 *  nunca por texto livre parseado). Quando o caller a passa, substitui o
 *  payload por papel — não é anunciável no chat. */
export type IaToolDef = {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
};

/** `tool_choice` do chat.completions — "required"/função nomeada forçam a
 *  saída por tool_call (a importação exige: sem call válida a linha fica
 *  como estava). */
export type IaToolChoice =
  | "auto"
  | "none"
  | "required"
  | { type: "function"; function: { name: string } };

/** usage da resposta (sdd D4): OpenAI-compatible estendido pelo Zen — cost
 *  é USD real (≈0 dentro do plano Go), allowance é o que o request descontou
 *  do teto mensal do plano (a métrica de custo real), list_cost o preço de
 *  tabela. Campos opcionais: provider que não estende devolve só os tokens. */
export type UsoIa = {
  prompt_tokens?: number;
  completion_tokens?: number;
  cost?: number;
  opencode?: {
    billing_source?: string;
    list_cost?: number;
    allowance?: number;
    estimated?: boolean;
    tokens?: {
      input?: number;
      output?: number;
      reasoning?: number;
      cache_read?: number;
      cache_write_5m?: number;
      cache_write_1h?: number;
    };
  };
};

export const IA_MSG_INDISPONIVEL =
  "O assistente está indisponível no momento. Tente de novo em instantes.";

/** `dormindo` on a failure = the provider let us down (rate limit/quota,
 *  5xx, dead model slug, timeout, network drop, chain exhausted), so the
 *  UI shows the sleeping-Liza state instead of a generic error
 *  (REALIZA-363). Absent on real faults of ours: generic 400 payloads,
 *  non-transient exceptions — those must not dress up as a nap. */

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
  // as 5 escritas do domínio entram no chat quando IA_ESCRITAS≠0 — o card
  // de confirmação é a via de approve delas; as demais (chamados, jovem_*)
  // seguem não anunciadas aqui e entram por issues próprias. O env entra
  // na chave: o conjunto muda com a flag sem restart em teste
  const escritasChat = process.env.IA_ESCRITAS !== "0";
  const chave = `${papeis ? [...papeis].sort().join("|") : "*"}|${escritasChat ? "1" : "0"}`;
  let cached = toolsCache.get(chave);
  if (!cached) {
    cached = Object.values(IA_TOOLS)
      // escrita fora do lote do domínio nunca entra no payload do chat:
      // anunciar o que o canal não aprovaria só ensinava o modelo a
      // chamar (mesma lógica do filtro por papel — REALIZA-333)
      .filter(
        (t) =>
          !(t as { escreve?: boolean }).escreve ||
          (escritasChat && ESCRITAS_DOMINIO.has(t.nome))
      )
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

// teto de saída por rodada (sdd D3) — depende do esforço porque tokens de
// raciocínio consomem o MESMO max_tokens: em "alto" um teto de 1600 era
// engolido pelo raciocínio e a resposta saía vazia ou cortada. Sem
// reasoning (ou "baixo") segue o 1600 de sempre — cobre folgado o formato
// da casa (resposta curta + blocos GenUI). medio/alto sobem (REALIZA-397):
// plano multi-parte de recuperação precisava de espaço; o finish_reason
// capturado agora permite ver se o corte realmente vinha do teto
const MAX_TOKENS_POR_ESFORCO: Record<EsforcoIa, number> = {
  baixo: 1600,
  medio: 6000,
  alto: 12000,
};

/** Pedido de continuação após finish_reason=length — anexa ao histórico
 *  como user msg; o modelo retoma no ponto de corte em vez de recomeçar. */
const CONTINUAR_MSG =
  "Continue exatamente de onde parou, sem repetir o que já escreveu.";

/** Uma continuação por rodada: o plano inteiro quase sempre cabe em 2× o
 *  teto; além disso o texto segue cortado e a rota emite o affordance de
 *  "continuar" honesto em vez de gastar o orçamento em loop. */
const MAX_CONTINUACOES = 1;

/** Soma o usage de duas rodadas (original + continuação) — a telemetria da
 *  request mede o total real, não só a última chamada. */
function somarUsoIa(a?: UsoIa, b?: UsoIa): UsoIa | undefined {
  if (!a) return b;
  if (!b) return a;
  const num = (x?: number, y?: number) =>
    x != null || y != null ? (x ?? 0) + (y ?? 0) : undefined;
  const tokens = (
    t?: NonNullable<UsoIa["opencode"]>["tokens"],
    u?: NonNullable<UsoIa["opencode"]>["tokens"]
  ) =>
    t || u
      ? {
          input: num(t?.input, u?.input),
          output: num(t?.output, u?.output),
          reasoning: num(t?.reasoning, u?.reasoning),
          cache_read: num(t?.cache_read, u?.cache_read),
          cache_write_5m: num(t?.cache_write_5m, u?.cache_write_5m),
          cache_write_1h: num(t?.cache_write_1h, u?.cache_write_1h),
        }
      : undefined;
  return {
    prompt_tokens: num(a.prompt_tokens, b.prompt_tokens),
    completion_tokens: num(a.completion_tokens, b.completion_tokens),
    cost: num(a.cost, b.cost),
    opencode:
      a.opencode || b.opencode
        ? {
            billing_source:
              b.opencode?.billing_source ?? a.opencode?.billing_source,
            list_cost: num(a.opencode?.list_cost, b.opencode?.list_cost),
            allowance: num(a.opencode?.allowance, b.opencode?.allowance),
            estimated:
              a.opencode?.estimated || b.opencode?.estimated || undefined,
            tokens: tokens(a.opencode?.tokens, b.opencode?.tokens),
          }
        : undefined,
  };
}

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
  papeis: AppRole[] | undefined,
  ferramentas?: { tools: IaToolDef[]; toolChoice?: IaToolChoice }
) {
  // tools ad-hoc ganham do payload por papel — o caller que as passa quer
  // exatamente elas no ar (a filtragem por papel é do registry do chat)
  const tools = ferramentas?.tools ?? toolsPayload(papeis);
  return JSON.stringify({
    model: modelo || process.env.IA_MODEL,
    messages,
    // sem tools (papel sem acesso a nenhuma, ou tier rapido: saudação e
    // fora de escopo não consultam dados) — omite a chave em vez de
    // mandar [], que alguns providers recusam com 400
    ...(tools.length
      ? { tools, tool_choice: ferramentas?.toolChoice ?? ("auto" as const) }
      : {}),
    ...(esforco ? { reasoning_effort: EFFORT[esforco] } : {}),
    max_tokens: MAX_TOKENS_POR_ESFORCO[esforco ?? "baixo"],
    ...(stream
      ? { stream: true, stream_options: { include_usage: true } }
      : {}),
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
    /** tools ad-hoc fora do registry — substituem o payload por papel
     *  (classificação estruturada, ex.: match_semantico da importação) */
    tools?: IaToolDef[];
    /** força a saída por tool_call — par de `tools` ad-hoc */
    toolChoice?: IaToolChoice;
    /** cap da rodada em ms (rota passa o que resta do orçamento do stream —
     *  o fallback JSON não pode estourar o prazo da função) */
    timeoutMs?: number;
  },
  continuacoesRestantes = MAX_CONTINUACOES
): Promise<
  | {
      ok: true;
      mensagem: MsgChat;
      usage?: UsoIa;
      modelo?: string;
      /** finish_reason cru do provider — "length" é o corte de max_tokens */
      finishReason?: string;
      /** a resposta voltou cortada mesmo depois das continuações possíveis */
      truncado?: boolean;
    }
  | { ok: false; erro: string; dormindo?: boolean }
> {
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
            opts?.papeis,
            opts?.tools
              ? { tools: opts.tools, toolChoice: opts.toolChoice }
              : undefined
          ),
          signal: AbortSignal.timeout(
            Number(opts?.timeoutMs ?? process.env.IA_TIMEOUT_MS ?? 45_000)
          ),
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
          return {
            ok: false,
            erro: IA_MSG_INDISPONIVEL,
            dormindo: avancaCadeia(res.status, corpo) || undefined,
          };
        }
        const json = await res.json();
        const msg = json?.choices?.[0]?.message as MsgChat | undefined;
        if (!msg || (msg.content == null && !msg.tool_calls?.length)) {
          console.error("chamarModelo: resposta sem mensagem utilizável");
          return { ok: false, erro: IA_MSG_INDISPONIVEL, dormindo: true };
        }
        const finishReason = json?.choices?.[0]?.finish_reason as
          | string
          | undefined;
        const usage = json?.usage as UsoIa | undefined;
        const modelo = cadeia[i] ?? process.env.IA_MODEL;
        // corte por max_tokens: continua onde parou — ANEXA ao parcial em
        // vez de re-gerar (recomeçar re-imprime texto). Tool_call truncada
        // não continua: o arguments chegou quebrado e não tem remendo
        if (
          finishReason === "length" &&
          !msg.tool_calls?.length &&
          msg.content &&
          continuacoesRestantes > 0
        ) {
          const cont = await chamarModelo(
            [
              ...messages,
              { role: "assistant", content: msg.content },
              { role: "user", content: CONTINUAR_MSG },
            ],
            sessao,
            opts,
            continuacoesRestantes - 1
          );
          if (cont.ok) {
            return {
              ok: true,
              mensagem: {
                ...cont.mensagem,
                content: `${msg.content}${cont.mensagem.content ?? ""}`,
              },
              usage: somarUsoIa(usage, cont.usage),
              modelo: cont.modelo ?? modelo,
              finishReason: cont.finishReason,
              truncado: cont.truncado,
            };
          }
          // a continuação falhou: o parcial segue válido, só sinalizado
          return { ok: true, mensagem: msg, usage, modelo, finishReason, truncado: true };
        }
        return {
          ok: true,
          mensagem: msg,
          usage,
          modelo,
          finishReason,
          truncado: finishReason === "length" || undefined,
        };
      } catch (e) {
        console.error(`chamarModelo: ${cadeia[i] ?? "env"}`, e);
        if (!ultimo && erroTransitorio(e)) {
          esperaMs = RETRY_BACKOFF_MS;
          break;
        }
        return {
          ok: false,
          erro: IA_MSG_INDISPONIVEL,
          dormindo: erroTransitorio(e) || undefined,
        };
      }
    }
  }
  // chain exhausted: every model left on a transient/chain-advancing cause
  return { ok: false, erro: IA_MSG_INDISPONIVEL, dormindo: true };
}

// ---------- streaming (SSE) ----------

export type ResultadoStream =
  | {
      ok: true;
      content: string;
      toolCalls: IaToolCall[];
      usage?: UsoIa;
      modelo?: string;
      /** finish_reason cru do último chunk — "length" é o corte de max_tokens */
      finishReason?: string;
      /** saiu cortado mesmo depois das continuações possíveis */
      truncado?: boolean;
    }
  // fallback=true: o provider recusou o stream (HTTP != 2xx ou corpo que
  // não é SSE) — a rota refaz a rodada via chamarModelo, mesmo contrato.
  // dormindo: falha do lado do provider (429/cota/5xx/timeout) → UI da
  // Liza dormindo; ausente em erro nosso (400 genérico) — REALIZA-363
  | {
      ok: false;
      erro: string;
      fallback?: boolean;
      abortado?: boolean;
      dormindo?: boolean;
    };

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
  },
  continuacoesRestantes = MAX_CONTINUACOES
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
          : {
              ok: false,
              erro: IA_MSG_INDISPONIVEL,
              fallback: true,
              dormindo: true,
            };
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
        return {
          ok: false,
          erro: IA_MSG_INDISPONIVEL,
          fallback: true,
          dormindo: avancaCadeia(res.status, corpo) || undefined,
        };
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let content = "";
      let usage: UsoIa | undefined;
      let finishReason: string | undefined;
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
        const c = chunk as {
          choices?: {
            delta?: { content?: string | null; tool_calls?: DeltaToolCall[] };
            finish_reason?: string | null;
          }[];
          usage?: UsoIa;
        };
        // stream_options.include_usage: o último chunk traz usage e
        // choices vazio (sdd D4) — telemetria da rodada inteira
        if (c.usage) usage = c.usage;
        // "length" = cortou no max_tokens — sinaliza pra continuação anexar
        if (c.choices?.[0]?.finish_reason)
          finishReason = c.choices[0].finish_reason;
        const delta = c.choices?.[0]?.delta;
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
      const toolCalls = [...calls.entries()]
        .sort(([a], [b]) => a - b)
        .map(([, t]) => t);
      const modelo = cadeia[i] ?? process.env.IA_MODEL;
      // corte por max_tokens: a continuação é uma request nova que ANEXA
      // texto (os tokens seguem saindo por onToken — não é retry, não
      // re-imprime). Tool_call truncada não continua: arguments quebrado
      if (
        finishReason === "length" &&
        !toolCalls.length &&
        content &&
        continuacoesRestantes > 0
      ) {
        const cont = await chamarModeloStream(
          [
            ...messages,
            { role: "assistant", content },
            { role: "user", content: CONTINUAR_MSG },
          ],
          sessao,
          opts,
          continuacoesRestantes - 1
        );
        if (cont.ok) {
          return {
            ok: true,
            content: content + cont.content,
            toolCalls: cont.toolCalls,
            usage: somarUsoIa(usage, cont.usage),
            modelo: cont.modelo ?? modelo,
            finishReason: cont.finishReason,
            truncado: cont.truncado,
          };
        }
        // continuação falhou (abort/erro): o parcial emitido é honesto,
        // só sinalizado — a rota oferece o "continuar" ao usuário
        return {
          ok: true,
          content,
          toolCalls,
          usage,
          modelo,
          finishReason,
          truncado: true,
        };
      }
      return {
        ok: true,
        content,
        toolCalls,
        usage,
        modelo,
        finishReason,
        truncado: finishReason === "length" || undefined,
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
        return {
          ok: false,
          erro: IA_MSG_INDISPONIVEL,
          fallback: true,
          // route-side timeout (signal sem ser do cliente) e erro de rede
          // são falha do provider; exceção não-transitória segue erro real
          dormindo:
            erroTransitorio(e) || opts.signal.aborted || undefined,
        };
      }
      esperaMs = RETRY_BACKOFF_MS;
      break;
    }
    }
  }
  return {
    ok: false,
    erro: IA_MSG_INDISPONIVEL,
    fallback: true,
    dormindo: true,
  };
}
