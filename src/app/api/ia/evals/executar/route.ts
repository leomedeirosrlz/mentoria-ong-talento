// POST /api/ia/evals/executar — executa UM item pendente do run (0164).
// A UI chama em laço até `feito`: cada request é um POST real no chat, bem
// abaixo do timeout de função — run grande não morre no meio. Se a aba
// fechar, os itens restantes ficam 'pendente' e o laço retoma quando
// reaberta (o claim é atômico, duas abas não dividem o mesmo item).

import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { executarProximoItem } from "@/lib/ia/evals";

const jsonErro = (mensagem: string, status: number) =>
  NextResponse.json({ error: mensagem }, { status });

const Body = z
  .object({ run_id: z.string().uuid() })
  .strict();

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims?.sub)
    return jsonErro("Sessão expirada. Entre de novo.", 401);
  const { data: papeis } = await supabase.rpc("my_papeis");
  if (!((papeis as string[] | null) ?? []).includes("coordenacao"))
    return jsonErro("Área da coordenação.", 403);

  const body = Body.safeParse(await req.json().catch(() => null));
  if (!body.success) return jsonErro("run_id inválido.", 400);
  const base = new URL(req.url).origin;
  try {
    const r = await executarProximoItem(
      supabase,
      body.data.run_id,
      base
    );
    return NextResponse.json(r);
  } catch (e) {
    return jsonErro(e instanceof Error ? e.message : "Falha ao executar o item.", 500);
  }
}
