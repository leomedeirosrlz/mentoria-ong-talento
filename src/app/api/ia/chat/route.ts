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
//   {"type":"status","t":"consultando dados…"}  → rodada de tool
//   {"type":"token","c":"…"}                    → delta de resposta ao vivo
//   {"type":"done","tools":[…],"interrompido"?} → fim normal ou abort
//   {"type":"error","e":"…"}                    → falha pós-stream
// Provider que não fala SSE (ou stream que quebra no meio) refaz a rodada
// via chamarModelo JSON e re-envia só o que ainda não saiu como token.
//
// Sem transcript: a rota é stateless e nada de conversa vai pro banco — só
// ia_eventos registra o que aconteceu (a ação, não a fala): uma linha por
// mensagem recebida (alimenta o rate limit) + uma por tool call (já dentro
// de executarTool).

import { NextResponse } from "next/server";
import { z } from "zod";
import {
  chamarModelo,
  chamarModeloStream,
  providerConfigurado,
} from "@/lib/ia/provider";
import type { MsgChat } from "@/lib/ia/provider";
import { systemPromptIa } from "@/lib/ia/prompts";
import { checarLimiteIa } from "@/lib/ia/rate-limit";
import { executarTool } from "@/lib/ia/tools";
import { getMe } from "@/lib/queries";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
// loop de tools (≤6 rodadas) + streaming pode passar do default da
// plataforma — mesmo patamar dos jobs (vercel lê o export). O stream se
// limita a STREAM_BUDGET_MS pra sobrar tempo de emitir o evento de
// erro antes de a função morrer aos 60s
export const maxDuration = 60;

// teto de iterações do loop de tools — o modelo que chama tools pra sempre
// para aqui e responde com o que já tem (acceptance: 7 calls → para em 6)
const MAX_ITERACOES = 4;

// orçamento total do stream (REALIZA-304): a plataforma encerra a função
// aos 60s sem avisar — se o teto por rodada fosse o único limite, uma
// rodada lenta morria no meio e nenhum evento de erro chegava ao cliente.
// 50s a partir da abertura do stream deixa ~10s pros gates pré-stream
const ORCAMENTO_STREAM_MS = 50_000;

// orçamento total do stream (REALIZA-304): a plataforma encerra a função
// aos 60s sem avisar — se o teto por rodada fosse o único limite, uma
// rodada lenta morria no meio e nenhum evento de erro chegava ao cliente.
// 50s a partir da abertura do stream deixa ~10s pros gates pré-stream
const STREAM_BUDGET_MS = 50_000;

const MSG_FALHA =
  "Não consegui concluir essa consulta agora — tente perguntar de outra forma.";

const MsgBody = z
  .object({
    role: z.enum(["user", "assistant"]),
    content: z.string().min(1).max(4000),
  })
  .strict();

const Body = z
  .object({ messages: z.array(MsgBody).min(1).max(20) })
  .strict();

export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
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
  const me = await getMe();
  if (!me) {
    return NextResponse.json(
      { error: "Cadastro não encontrado." },
      { status: 401 }
    );
  }

  if (await checarLimiteIa(supabase, me.id)) {
    return NextResponse.json(
      { error: "Muitas mensagens seguidas — aguarde um instante." },
      { status: 429 }
    );
  }

  const body = Body.safeParse(await req.json().catch(() => null));
  if (!body.success) {
    return NextResponse.json(
      { error: "Pedido inválido." },
      { status: 400 }
    );
  }

  // a mensagem recebida é um evento (não o conteúdo dela — só o fato) —
  // é o que faz o rate limit medir mensagens, não só tool calls
  await supabase.rpc("registrar_ia_evento", {
    p_canal: "chat",
    p_tool: "mensagem",
    p_args: { n_mensagens: body.data.messages.length },
    p_ok: true,
    p_duracao_ms: 0,
  });

  const papeis =
    me.papeis && me.papeis.length ? me.papeis : me.role ? [me.role] : [];
  const historico: MsgChat[] = [
    { role: "system", content: systemPromptIa(papeis) },
    ...body.data.messages.map((m) => ({ ...m, content: m.content })),
  ];

  // sessão estável por usuário — o provider Go exige pra rotear/cachear;
  // profile_id é pseudônimo e não revela nada além do que a sessão já diz
  const sessao = me.id;
  // teto por rodada — o orçamento do stream (STREAM_BUDGET_MS) capa
  // esse valor a cada iteração, então na prática o que manda é o que
  // ainda falta pro prazo
  const timeoutRound = Number(process.env.IA_TIMEOUT_MS ?? 20_000) * 4;

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

      const toolsUsadas: string[] = [];
      let concluido = false;
      let guiaChamado = false;
      const prazo = Date.now() + STREAM_BUDGET_MS;

      for (let i = 0; i < MAX_ITERACOES && !req.signal.aborted && !fechado; i++) {
        // sem orçamento, sai do loop — o erro padrão depois do for avisa
        // o cliente em vez de a plataforma cortar a função no silêncio
        const restante = prazo - Date.now();
        if (restante <= 0) break;
        const signal = AbortSignal.any([
          req.signal,
          AbortSignal.timeout(Math.min(timeoutRound, restante)),
        ]);
        let emitido = 0; // tokens da rodada que já saíram pro cliente
        const r = await chamarModeloStream(historico, sessao, {
          signal,
          onToken: (t) => {
            emitido += t.length;
            send({ type: "token", c: t });
          },
          clienteAbortou: () => req.signal.aborted,
        });

        let msg: MsgChat;
        if (r.ok) {
          msg = {
            role: "assistant",
            content: r.content || null,
            tool_calls: r.toolCalls.length ? r.toolCalls : undefined,
          };
        } else if (r.abortado) {
          break; // usuário fechou/stop — sai do loop sem erro
        } else if (r.fallback) {
          // provider recusou SSE ou o stream morreu no meio: a rodada
          // refaz em JSON; só o trecho ainda não enviado sai como token.
          // o abort do prazo também cai aqui — sem orçamento não refaz,
          // a chamada JSON tem relógio próprio e passaria dos 60s
          if (Date.now() >= prazo) break;
          const alt = await chamarModelo(historico, sessao);
          if (!alt.ok) {
            send({ type: "error", e: alt.erro });
            break;
          }
          msg = alt.mensagem;
          if (msg.content && msg.content.length > emitido) {
            send({ type: "token", c: msg.content.slice(emitido) });
          }
        } else {
          send({ type: "error", e: r.erro });
          break;
        }

        historico.push(msg);
        const calls = (msg.tool_calls ?? []).filter(
          (c) => c.type === "function"
        );
        if (!calls.length) {
          send({ type: "done", tools: toolsUsadas });
          concluido = true;
          break;
        }

        send({ type: "status", t: "consultando dados…" });
        for (const tc of calls) {
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
            res = await executarTool(tc.function.name, args, supabase, "chat");
            if (tc.function.name === "guia_consulta") guiaChamado = true;
          }
          toolsUsadas.push(tc.function.name);
          historico.push({
            role: "tool",
            tool_call_id: tc.id,
            name: tc.function.name,
            content: JSON.stringify(res),
          });
        }
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

      if (!concluido && !req.signal.aborted && !fechado) {
        send({ type: "error", e: MSG_FALHA });
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
    },
  });
}
