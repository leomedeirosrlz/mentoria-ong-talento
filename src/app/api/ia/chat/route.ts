// Transporte interno da camada de IA (sdd §3): a sessão cookie é a auth —
// /api/ia/* NÃO entra na lista pública do proxy, então sem sessão o POST
// vira redirect pra /login antes de chegar aqui (o 401 abaixo cobre sessão
// quebrada/expirada que passou).
//
// Resposta SSE (REALIZA-244): todos os gates respondem JSON ANTES do stream
// abrir — status e header ficam comprometidos depois do primeiro byte, então
// auth/provider/rate-limit/body continuam NextResponse.json (o e2e lê esse
// contrato). Abrido o stream, tudo vira evento data: {type} — o cliente lê
// com getReader + TextDecoder:
//   {"type":"status","t":"Abrindo a agenda…"}   → tool rodando (rótulo por tool)
//   {"type":"ui","b":UiBloco}                   → card direto da tool (lib/ia/ui.ts)
//   {"type":"token","c":"…"}                    → delta de resposta ao vivo
//   {"type":"done","tools":[…],"interrompido"?} → fim normal ou abort
//   {"type":"error","e":"…"}                    → falha pós-stream
// Provider que não fala SSE (ou stream que quebra no meio) refaz a rodada
// via chamarModelo JSON e re-envia só o que ainda não saiu como token.
//
// Sem transcript: a rota é stateless e nada de conversa vai pro banco — só
// ia_eventos registra o que aconteceu (a ação, não a fala): uma linha por
// mensagem recebida (alimenta o rate limit, gravada na reserva) + uma por
// tool call + o resumo 'resposta' — esses dois últimos vão juntos numa
// escrita só no fim do stream (registrar_ia_eventos_lote).

import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import {
  chamarModelo,
  chamarModeloStream,
  providerConfigurado,
} from "@/lib/ia/provider";
import type { MsgChat, UsoIa } from "@/lib/ia/provider";
import { systemPromptIa } from "@/lib/ia/prompts";
import {
  esforcoDoTier,
  fallbacksDoTier,
  getIaConfig,
  modeloDoTier,
} from "@/lib/ia/config";
import {
  papelDecisivo,
  rotearTier,
  tarefaDaPergunta,
} from "@/lib/ia/roteador";
import { contextoELimiteIa } from "@/lib/ia/rate-limit";
import type { FonteIa } from "@/lib/ia/fontes";
import {
  executarTool,
  type EventoIa,
  type ResultadoTool,
} from "@/lib/ia/tools";
import { STATUS_TOOL, uiDaTool, uiDosInstrumentos } from "@/lib/ia/ui";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
// loop de tools (≤6 rodadas) + streaming pode passar do default da
// plataforma — mesmo patamar dos jobs (vercel lê o export). O stream se
// limita a STREAM_BUDGET_MS pra sobrar tempo de emitir o evento de
// erro antes de a função morrer aos 60s
export const maxDuration = 60;

// teto de iterações do loop de tools — o modelo que chama tools pra sempre
// para aqui e responde com o que já tem (acceptance: 7 calls → para em 6)
const MAX_ITERACOES = 6;

// orçamento total do stream (REALIZA-304): a plataforma encerra a função
// aos 60s sem avisar — se o teto por rodada fosse o único limite, uma
// rodada lenta morria no meio e nenhum evento de erro chegava ao cliente.
// 55s a partir da abertura do stream deixa ~5s pros gates pré-stream e
// pro lote de telemetria (awaited antes do close). O teto de tokens subiu
// junto (REALIZA-397): resposta de 12000 tokens precisa de mais janela
const STREAM_BUDGET_MS = 55_000;

// espelha o teto do registrar_ia_eventos_lote (0160)
const MAX_EVENTOS_LOTE = 50;

const MSG_FALHA =
  "Não consegui concluir essa consulta agora. Tente perguntar de outra forma.";

const MsgBody = z
  .object({
    role: z.enum(["user", "assistant"]),
    content: z.string().min(1).max(4000),
  })
  .strict();

const Body = z
  .object({
    messages: z.array(MsgBody).min(1).max(20),
    // rota em que a pessoa está (só o path) — o prompt usa pra entender
    // "esta dupla"/"esta semana"; query e hash ficam no cliente
    pagina: z
      .string()
      .max(200)
      .regex(/^\/[\w\-/]*$/)
      .optional(),
    // override de modelo — SÓ vale com o header x-ia-eval-key batendo o env
    // IA_EVAL_KEY (evals do /ia). Sem a chave o campo é ignorado: um usuário
    // qualquer não escolhe o modelo que queima o plano
    modelo: z
      .string()
      .min(2)
      .max(80)
      .regex(/^[\w.\-/:]+$/)
      .optional(),
  })
  .strict();

export async function POST(req: Request) {
  // a rota mora atrás da MESMA flag da bolha (IA_BOLHA, gate dos dois
  // layouts): sem ela o endpoint nem existe — 404 antes de autenticar ou
  // gastar limite. O modo demo não passa por aqui (responderDemoIa roda
  // no cliente), então o gate não muda nada pra ele
  if (process.env.IA_BOLHA !== "1") {
    return NextResponse.json({ error: "Não encontrado." }, { status: 404 });
  }
  const supabase = await createClient();
  // getClaims valida o JWT local — getUser era uma RTT remota redundante
  // (o middleware já revalidou a sessão pra chegar até aqui)
  const { data: claims } = await supabase.auth.getClaims();
  const sub = claims?.claims?.sub;
  if (!sub) {
    return NextResponse.json(
      { error: "Sessão expirada — entre de novo." },
      { status: 401 }
    );
  }
  if (!providerConfigurado()) {
    return NextResponse.json(
      { error: "O assistente está indisponível no momento." },
      { status: 503 }
    );
  }
  // body antes da identidade+limite: request malformado não gasta slot
  const body = Body.safeParse(await req.json().catch(() => null));
  if (!body.success) {
    return NextResponse.json(
      { error: "Pedido inválido." },
      { status: 400 }
    );
  }

  // identidade + limite numa RPC (ia_contexto_e_limite, 0160): profile
  // ativo, papel e papéis efetivos + a reserva atômica do slot 'mensagem'
  // sob advisory lock (sdd D3). Identidade = JWT, sempre: getMe() respeitava
  // o cookie demo_role (persona fake derrubava o rate limit e mentia o
  // papel no prompt). O request_id correla os eventos desta request.
  // A config viva (ia_config) vem em paralelo — sem RTT extra.
  const [ctx, iaCfg] = await Promise.all([
    contextoELimiteIa(supabase, { n_mensagens: body.data.messages.length }),
    getIaConfig(supabase),
  ]);
  if (ctx.status === "sem_cadastro") {
    return NextResponse.json(
      { error: "Cadastro não encontrado." },
      { status: 401 }
    );
  }
  if (ctx.status === "negado") {
    return NextResponse.json(
      { error: "Muitas mensagens seguidas — aguarde um instante." },
      { status: 429 }
    );
  }
  const requestId = ctx.requestId;

  const papeis = ctx.papeis.length ? ctx.papeis : ctx.role ? [ctx.role] : [];
  const system = systemPromptIa(papeis, body.data.pagina);
  const historico: MsgChat[] = [
    { role: "system", content: system },
    ...body.data.messages.map((m) => ({ ...m, content: m.content })),
  ];
  // hash curto do prompt montado: permite comparar métricas antes/depois
  // de mexer no prompt sem versionar o texto inteiro nos eventos
  const promptV = createHash("sha256").update(system).digest("hex").slice(0, 8);

  // tier da pergunta (REALIZA-329/299): roteador determinístico —
  // tarefa derivada do formato da mensagem × papel efetivo (staff faz
  // análise no forte; mentor/jovem capam no balanceado); desligado na
  // config = sempre balanceado. tarefa e papelDecisivo saem daqui já
  // calculados porque o evento 'resposta' grava os mesmos valores em
  // args.roteador — uma derivação só, auditável sem coluna nova.
  // Slug ausente cai no IA_MODEL do ambiente, então config vazia não
  // quebra nada
  const ultimaPergunta =
    [...body.data.messages].reverse().find((m) => m.role === "user")
      ?.content ?? "";
  const tarefa = tarefaDaPergunta(ultimaPergunta);
  const papelRota = papelDecisivo(papeis);
  const tier = iaCfg.roteamento
    ? rotearTier(ultimaPergunta, { papel: papeis, tarefa })
    : "balanceado";
  // eval (0164): o runner do /ia manda x-ia-eval-key + modelo e mede aquele
  // slug — a cadeia de fallback sai do caminho senão a métrica mente (o
  // 'resposta' grava o modelo REAL usado, mas um fallback esconderia a
  // falha do modelo testado). Sem a chave o campo nem é lido.
  const evalKey = req.headers.get("x-ia-eval-key");
  const evalOverride =
    process.env.IA_EVAL_KEY && evalKey === process.env.IA_EVAL_KEY
      ? body.data.modelo
      : undefined;
  const chamada = {
    modelo: evalOverride ?? modeloDoTier(iaCfg, tier),
    esforco: esforcoDoTier(iaCfg, tier),
    fallbacks: evalOverride ? [] : fallbacksDoTier(iaCfg, tier),
    // REALIZA-333: o payload de tools sai filtrado por papel — não anunciar
    // pro modelo o que ele não pode rodar (ele papagaiava a descrição das
    // tools coord-only ao explicar a negação). Tier rapido (saudação,
    // fora de escopo — nunca consulta dados) sai SEM tools: ~2k tokens
    // de schema economizados por rodada
    papeis: tier === "rapido" ? [] : papeis,
  };

  // sessão estável por usuário — o provider Go exige pra rotear/cachear;
  // profile_id é pseudônimo e não revela nada além do que a sessão já diz
  const sessao = ctx.profileId;
  // teto por rodada — o orçamento do stream (STREAM_BUDGET_MS) capa
  // esse valor a cada iteração, então na prática o que manda é o que
  // ainda falta pro prazo
  const timeoutRound = Number(process.env.IA_TIMEOUT_MS ?? 45_000) * 4;

  const stream = new ReadableStream({
    async start(controller) {
      const enc = new TextEncoder();
      let fechado = false;
      const send = (obj: unknown) => {
        if (fechado) return;
        try {
          controller.enqueue(enc.encode(`data: ${JSON.stringify(obj)}\n\n`));
        } catch {
          fechado = true; // cliente desconectou — para de produzir
        }
      };
      // primeiro byte cedo: comentário SSE vence o buffer de 1KB do Safari
      // e confirma o canal antes da primeira rodada do provider
      try {
        controller.enqueue(enc.encode(": ok\n\n"));
      } catch {
        return;
      }

      // o evento 'mensagem' já foi gravado pela reserva do limite
      // (ia_contexto_e_limite) — regravar aqui duplicaria a contagem
      const toolsUsadas: string[] = [];
      // auditoria das tools fica em memória e sai no lote do fim
      const eventos: EventoIa[] = [];
      // teto do lote na RPC é 50: acima disso o insert inteiro falharia,
      // então o excedente de tools cai fora e o resumo sempre entra
      const coletarEvento = (ev: EventoIa) => {
        if (eventos.length < MAX_EVENTOS_LOTE - 1) eventos.push(ev);
      };
      // fontes que a guia_consulta trouxe — sobem no done pra UI renderizar
      // a fileira "Fontes" (dedupe por guia+secao)
      const fontes = new Map<string, FonteIa>();
      let concluido = false;
      // telemetria da request (sdd D4): tokens/custo somados das rodadas;
      // modelo = slug que produziu a resposta (último vencedor da cadeia —
      // quando o fallback aciona, o primário não é o que respondeu)
      const t0 = Date.now();
      const uso = {
        in: 0, out: 0, reasoning: 0, cache: 0,
        custo: 0, allowance: 0, listCost: 0,
        billing: undefined as string | undefined,
      };
      let modeloUsado: string | undefined;
      const somarUso = (u?: UsoIa, modelo?: string) => {
        if (modelo) modeloUsado = modelo;
        if (!u) return;
        uso.in += u.prompt_tokens ?? u.opencode?.tokens?.input ?? 0;
        uso.out += u.completion_tokens ?? u.opencode?.tokens?.output ?? 0;
        uso.reasoning += u.opencode?.tokens?.reasoning ?? 0;
        uso.cache += u.opencode?.tokens?.cache_read ?? 0;
        uso.custo += u.cost ?? 0;
        uso.allowance += u.opencode?.allowance ?? 0;
        uso.listCost += u.opencode?.list_cost ?? 0;
        if (u.opencode?.billing_source) uso.billing = u.opencode.billing_source;
      };
      let erroEmitido = false;
      // a resposta final saiu cortada mesmo com a continuação interna do
      // provider — vai na telemetria do 'resposta' pra medir quanto o
      // teto de tokens ainda aperta
      let truncouFinal = false;
      const sendErro = (e: string, dormindo?: boolean) => {
        // dormindo: falha do provider (429/cota/5xx/timeout) → o cliente
        // mostra a Liza dormindo em vez do erro genérico (REALIZA-363)
        send({ type: "error", e, ...(dormindo ? { dormindo: true } : {}) });
        erroEmitido = true;
      };
      // o último resultado do provider decide a cara do erro de orçamento
      // esgotado: provider lento/atolado dorme, ferramenta nossa lenta não
      let dormindoUltimo = false;
      let guiaChamado = false;
      const prazo = Date.now() + STREAM_BUDGET_MS;
      let iteracoes = 0;

      for (let i = 0; i < MAX_ITERACOES && !req.signal.aborted && !fechado; i++) {
        iteracoes = i + 1;
        // sem orçamento, sai do loop — o erro padrão depois do for avisa
        // o cliente em vez de a plataforma cortar a função no silêncio
        const restante = prazo - Date.now();
        if (restante <= 0) break;
        const signal = AbortSignal.any([
          req.signal,
          AbortSignal.timeout(Math.min(timeoutRound, restante)),
        ]);
        let emitido = 0; // tokens da rodada que já saíram pro cliente
        // o provider cortou no teto de tokens mesmo depois da continuação
        // interna — se esta rodada vira a resposta final, o cliente ganha
        // o chip "continuar" em vez de um texto quebrado em silêncio
        let truncadoMsg = false;
        const r = await chamarModeloStream(historico, sessao, {
          signal,
          onToken: (t) => {
            emitido += t.length;
            send({ type: "token", c: t });
          },
          clienteAbortou: () => req.signal.aborted,
          ...chamada,
        });

        let msg: MsgChat;
        if (r.ok) {
          somarUso(r.usage, r.modelo);
          truncadoMsg = Boolean(r.truncado);
          msg = {
            role: "assistant",
            content: r.content || null,
            tool_calls: r.toolCalls.length ? r.toolCalls : undefined,
          };
        } else if (r.abortado) {
          break; // usuário fechou/stop — sai do loop sem erro
        } else if (r.fallback) {
          dormindoUltimo = Boolean(r.dormindo);
          // provider recusou SSE ou o stream morreu no meio: a rodada
          // refaz em JSON — mas é uma GERAÇÃO NOVA, sem prefixo comum com
          // o que já saiu. Se algo já foi emitido, `reset` manda a bolha
          // recomeçar (emendar o rabo de outra resposta corrompia o texto)
          const restanteJson = prazo - Date.now();
          if (restanteJson <= 0) break;
          const alt = await chamarModelo(historico, sessao, {
            ...chamada,
            // o fallback JSON não corre contra o `signal` combinado — o
            // timeoutMs é o cap dele; ~1.5s fica pra emitir token + done
            timeoutMs: Math.max(restanteJson - 1_500, 500),
          });
          if (!alt.ok) {
            sendErro(alt.erro, alt.dormindo);
            break;
          }
          somarUso(alt.usage, alt.modelo);
          truncadoMsg = Boolean(alt.truncado);
          msg = alt.mensagem;
          if (msg.content) {
            if (emitido > 0) send({ type: "reset" });
            send({ type: "token", c: msg.content });
          }
        } else {
          sendErro(r.erro, r.dormindo);
          break;
        }

        historico.push(msg);
        const calls = (msg.tool_calls ?? []).filter(
          (c) => c.type === "function"
        );
        if (!calls.length) {
          // saiu cortada: em vez de um texto quebrado no ar, o chip
          // ```sugestoes oferece retomar — o histórico já carrega o
          // parcial, então a próxima rodada continua de onde parou
          if (truncadoMsg) {
            truncouFinal = true;
            send({
              type: "token",
              c: '\n\n```sugestoes\n["Continuar de onde parei"]\n```',
            });
          }
          send({
            type: "done",
            tools: toolsUsadas,
            fontes: fontes.size ? [...fontes.values()] : undefined,
          });
          concluido = true;
          break;
        }

        for (const tc of calls) {
          // orçamento segue valendo entre tools — uma query lenta do
          // Supabase não pode matar a função aos 60s sem evento de erro
          if (req.signal.aborted || fechado) break;
          const restanteTc = prazo - Date.now();
          if (restanteTc <= 0) break;
          // status por tool: a pessoa lê o que está acontecendo ("Abrindo
          // a agenda…") em vez de um "consultando" genérico
          send({
            type: "status",
            t: STATUS_TOOL[tc.function.name] ?? "Consultando dados…",
          });
          // guia_consulta: no máximo uma chamada por resposta — se o modelo
          // tentar de novo, devolve "já busquei" em vez de reconsultar, pra
          // forçar a resposta com os trechos que já tem (mimo-v2.6-flash
          // tinha o hábito de re-buscar até estourar iterações)
          let res: unknown;
          if (tc.function.name === "guia_consulta" && guiaChamado) {
            res = {
              fontes: [],
              nota: "busca já realizada nesta resposta — responda com os trechos anteriores",
            };
          } else {
            let args: unknown = {};
            try {
              args = JSON.parse(tc.function.arguments || "{}");
            } catch {
              // JSON quebrado vira {} — a validação zod da tool devolve o
              // erro pro modelo reformular, mesmo caminho de arg inválido
            }
            // race contra o prazo — a tool continua em bg mas a resposta
            // emite o erro dentro do orçamento em vez de morrer calada
            let timerPrazo: ReturnType<typeof setTimeout> | undefined;
            res = await Promise.race([
              executarTool(
                tc.function.name,
                args,
                supabase,
                "chat",
                // papéis já resolvidos no começo da request: sem eles a
                // tool refazia o my_papeis a cada chamada
                papeis,
                undefined,
                requestId,
                // dedup por sessão: mesma tool+args na conversa serve o
                // resultado guardado (90s) em vez de re-rodar a query
                { coletarEvento, dedupKey: sessao }
              ),
              new Promise<never>((_, rej) => {
                timerPrazo = setTimeout(() => rej(new Error("prazo")), restanteTc);
              }),
            ])
              .catch((e) => {
                if (e instanceof Error && e.message === "prazo") {
                  sendErro(MSG_FALHA);
                  return null;
                }
                throw e;
              })
              .finally(() => clearTimeout(timerPrazo));
            if (res === null) break;
            const resTool = res as ResultadoTool;
            if (resTool.ok) {
              // escrita em prévia (REALIZA-126): o envelope vai pro card
              // do usuário — a única via de approve — e o tool-result que
              // o modelo recebe é o marcador sanitizado. O confirmacao_id
              // NUNCA entra no histórico: com ele na mão, a tool se
              // auto-aprovaria e o portão humano viraria decorativo.
              const pend = (
                resTool.dados as
                  | { pendente_confirmacao?: Record<string, unknown> }
                  | null
                  | undefined
              )?.pendente_confirmacao;
              if (pend && typeof pend === "object") {
                send({
                  type: "ui",
                  b: {
                    kind: "confirmacao",
                    confirmacao_id: pend.confirmacao_id,
                    tool: pend.tool,
                    args: pend.args ?? {},
                    resumo: pend.resumo,
                    expira_em_minutos: pend.expira_em_minutos,
                    // correlaciona o evento da execução com o da prévia —
                    // o endpoint repassa no dispatch
                    request_id: requestId,
                  },
                });
                res = {
                  ok: true,
                  dados: {
                    status: "aguardando_confirmacao_humana",
                    resumo: pend.resumo,
                  },
                };
              } else {
                // genUI direto: o card sai já — antes da próxima rodada
                // do modelo, que ainda vai pensar e escrever por cima
                const bloco =
                  tc.function.name === "instrumentos_da_dupla"
                    ? uiDosInstrumentos(
                        String(
                          (args as { dupla_id?: unknown } | null)?.dupla_id ?? ""
                        ),
                        resTool.dados
                      )
                    : uiDaTool(tc.function.name, resTool.dados);
                if (bloco) send({ type: "ui", b: bloco });
              }
            }
            if (tc.function.name === "guia_consulta") {
              // envelope ResultadoTool — os dados moram em .dados; só
              // marca guiaChamado quando a busca rodou (falha permite
              // re-tentativa com args corrigidos em vez de travar a tool)
              const r = res as
                | { ok: true; dados: { fontes?: FonteIa[] } }
                | { ok: false; erro: string };
              if (r.ok) {
                guiaChamado = true;
                for (const f of r.dados.fontes ?? [])
                  fontes.set(`${f.guia}|${f.secao ?? ""}`, f);
              }
            }
          }
          // tool negada por papel não vira "fonte" da resposta — a meta
          // listava o nome cru da função que falhou (REALIZA-333)
          const env = res as { ok?: boolean } | null;
          if (!env || env.ok !== false) toolsUsadas.push(tc.function.name);
          historico.push({
            role: "tool",
            tool_call_id: tc.id,
            name: tc.function.name,
            content: JSON.stringify(res),
          });
        }
        if (erroEmitido || req.signal.aborted || fechado) break;
        if (Date.now() >= prazo) break;
        // nudge: a partir da 2ª rodada, força o modelo a responder com o
        // que já tem em vez de seguir chamando ferramentas
        if (i >= 1 && !concluido) {
          historico.push({
            role: "user",
            content:
              "Responda agora com base no que você já encontrou. Não chame mais ferramentas.",
          });
        }
      }

      if (!concluido && !erroEmitido && !req.signal.aborted && !fechado) {
        sendErro(MSG_FALHA, dormindoUltimo);
      }

      // evento-resumo da request (sdd D4): um 'resposta' por mensagem com
      // telemetria agregada — correlaciona com 'mensagem' e as tools pelo
      // request_id. Sai no MESMO lote das tools (uma RPC por mensagem).
      // Awaited antes do close: fire-and-forget morria quando a função
      // congelava depois do stream e a telemetria se perdia
      eventos.push({
        canal: "chat",
        tool: "resposta",
        args: {
          tools: toolsUsadas,
          list_cost: uso.listCost || undefined,
          prompt_v: promptV,
          // decisão do roteador auditável no jsonb já existente
          // (REALIZA-299): por que essa mensagem caiu nesse tier
          roteador: { tier, tarefa, papel: papelRota },
          truncado: truncouFinal || undefined,
        },
        ok: concluido,
        erro: erroEmitido ? "erro" : null,
        duracao_ms: Date.now() - t0,
        modelo: modeloUsado ?? null,
        tier,
        tokens_in: uso.in || null,
        tokens_out: uso.out || null,
        tokens_reasoning: uso.reasoning || null,
        cache_read: uso.cache || null,
        custo_usd: uso.custo || null,
        allowance_usd: uso.allowance || null,
        billing_source: uso.billing ?? null,
        request_id: requestId,
        iteracoes,
      });
      try {
        const { error: erroLote } = await supabase.rpc(
          "registrar_ia_eventos_lote",
          { p_eventos: eventos }
        );
        if (erroLote) console.error("registrar_ia_eventos_lote:", erroLote);
      } catch (e) {
        console.error("registrar_ia_eventos_lote:", e);
      }
      try {
        controller.close();
      } catch {
        // já fechado pelo disconnect
      }
    },
    cancel() {
      // client soltou o reader — req.signal aborta o fetch do provider
      // (AbortSignal.any liga os dois); nada mais a fazer aqui
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      // proxies reverso bufferizam SSE por padrão (docs streaming do Next)
      "X-Accel-Buffering": "no",
      // o eval correla a request com o evento 'resposta' (tokens/custo)
      // — uuid opaco, já gravado em ia_eventos desta request
      "x-ia-request-id": requestId,
    },
  });
}
