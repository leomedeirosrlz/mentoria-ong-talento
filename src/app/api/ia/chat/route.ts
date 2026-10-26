// Transporte interno da camada de IA (sdd §3): a sessão cookie é a auth —
// /api/ia/* NÃO entra na lista pública do proxy, então sem sessão o POST
// vira redirect pra /login antes de chegar aqui (o 401 abaixo cobre sessão
// quebrada/expirada que passou). Resposta JSON única, sem streaming na v1.
//
// Sem transcript: a rota é stateless e nada de conversa vai pro banco — só
// ia_eventos registra o que aconteceu (a ação, não a fala): uma linha por
// mensagem recebida (alimenta o rate limit) + uma por tool call (já dentro
// de executarTool).

import { NextResponse } from "next/server";
import { z } from "zod";
import { chamarModelo, providerConfigurado } from "@/lib/ia/provider";
import type { MsgChat } from "@/lib/ia/provider";
import { systemPromptIa } from "@/lib/ia/prompts";
import { checarLimiteIa } from "@/lib/ia/rate-limit";
import { executarTool } from "@/lib/ia/tools";
import { getMe } from "@/lib/queries";
import { createClient } from "@/lib/supabase/server";

// teto de iterações do loop de tools — o modelo que chama tools pra sempre
// para aqui e responde com o que já tem (acceptance: 7 calls → para em 6)
const MAX_ITERACOES = 6;

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
  const toolsUsadas: string[] = [];

  // sessão estável por usuário — o provider Go exige pra rotear/cachear;
  // profile_id é pseudônimo e não revela nada além do que a sessão já diz
  for (let i = 0; i < MAX_ITERACOES; i++) {
    const r = await chamarModelo(historico, me.id);
    if (!r.ok) {
      return NextResponse.json({ error: r.erro }, { status: 503 });
    }
    const msg = r.mensagem;
    historico.push(msg);
    const calls = (msg.tool_calls ?? []).filter((c) => c.type === "function");
    if (!calls.length) {
      return NextResponse.json({
        message: msg.content ?? "",
        toolsUsadas,
      });
    }
    for (const tc of calls) {
      let args: unknown = {};
      try {
        args = JSON.parse(tc.function.arguments || "{}");
      } catch {
        // JSON quebrado vira {} — a validação zod da tool devolve o erro
        // pro modelo reformular, mesmo caminho de qualquer arg inválido
      }
      const res = await executarTool(
        tc.function.name,
        args,
        supabase,
        "chat"
      );
      toolsUsadas.push(tc.function.name);
      historico.push({
        role: "tool",
        tool_call_id: tc.id,
        name: tc.function.name,
        content: JSON.stringify(res),
      });
    }
  }

  return NextResponse.json({
    message:
      "Não consegui concluir essa consulta agora — tente perguntar de outra forma.",
    toolsUsadas,
  });
}
