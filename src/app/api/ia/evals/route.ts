// Evals da Liza (0164) — coord-only como o /ia inteiro. GET lista runs
// (?run=<id> detalha com itens; ?casos devolve o corpus live pra montar a
// grade); POST cria o run com a grade cartesiana de itens pendentes.
// A execução em si é uma request por item em /executar — a UI dirige o laço.

import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { criarRun, listarCasosLive } from "@/lib/ia/evals";

const jsonErro = (mensagem: string, status: number) =>
  NextResponse.json({ error: mensagem }, { status });

const CriarBody = z
  .object({
    ambiente: z.string().min(1).max(40),
    papel: z.enum(["staff", "mentorado"]),
    modelos: z
      .array(z.string().min(2).max(80).regex(/^[\w.\-/:]+$/))
      .min(1)
      .max(8),
    repeticoes: z.number().int().min(1).max(10),
    casoIds: z.array(z.string().min(1).max(80)).max(100).optional(),
  })
  .strict();

/** Sessão + coordenação — o profile resolve created_by e o papel efetivo
 *  (my_papeis, 0085) tranca o painel igual à página. */
async function gateCoord(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: claims } = await supabase.auth.getClaims();
  const sub = claims?.claims?.sub;
  if (!sub) return { erro: "sessao" as const, profileId: null, ok: false };
  const { data: papeis } = await supabase.rpc("my_papeis");
  const lista = (papeis as string[] | null) ?? [];
  if (!lista.includes("coordenacao"))
    return { erro: "papel" as const, profileId: null, ok: false };
  const { data: prof } = await supabase
    .from("profiles")
    .select("id")
    .eq("user_id", sub)
    .single();
  return { erro: null, profileId: prof?.id ?? null, ok: true };
}

export async function GET(req: Request) {
  const supabase = await createClient();
  const g = await gateCoord(supabase);
  if (g.erro === "sessao")
    return jsonErro("Sessão expirada. Entre de novo.", 401);
  if (!g.ok) return jsonErro("Área da coordenação.", 403);

  const url = new URL(req.url);
  const runId = url.searchParams.get("run");
  if (url.searchParams.has("casos")) {
    return NextResponse.json({
      casos: listarCasosLive().map((c) => ({
        id: c.id,
        papel_esperado: c.papel_esperado,
        msg: c.msg,
      })),
    });
  }
  if (runId) {
    const [{ data: run }, { data: itens }] = await Promise.all([
      supabase.from("ia_eval_runs").select("*").eq("id", runId).single(),
      supabase
        .from("ia_eval_itens")
        .select("*")
        .eq("run_id", runId)
        .order("id"),
    ]);
    if (!run) return jsonErro("Run não encontrado.", 404);
    return NextResponse.json({ run, itens: itens ?? [] });
  }
  const { data: runs } = await supabase
    .from("ia_eval_runs")
    .select("id, created_at, status, ambiente, papel, modelos, repeticoes, resumo")
    .order("created_at", { ascending: false })
    .limit(20);
  return NextResponse.json({ runs: runs ?? [] });
}

export async function POST(req: Request) {
  const supabase = await createClient();
  const g = await gateCoord(supabase);
  if (g.erro === "sessao")
    return jsonErro("Sessão expirada. Entre de novo.", 401);
  if (!g.ok || !g.profileId)
    return jsonErro("Área da coordenação.", 403);
  const body = CriarBody.safeParse(await req.json().catch(() => null));
  if (!body.success) return jsonErro("Parâmetros inválidos.", 400);
  try {
    const r = await criarRun(supabase, g.profileId, body.data);
    return NextResponse.json(r, { status: 201 });
  } catch (e) {
    return jsonErro(
      e instanceof Error ? e.message : "Falha ao criar o run.",
      400
    );
  }
}

/** ?run=<id> apaga um run; sem param limpa o histórico inteiro. A RPC
 *  ia_eval_limpar (0166) derruba também os ia_eventos dos itens —
 *  request_id correlaciona a cadeia mensagem→tools→resposta, e os
 *  indicadores do painel não ficam sujos com runs superadas. */
export async function DELETE(req: Request) {
  const supabase = await createClient();
  const g = await gateCoord(supabase);
  if (g.erro === "sessao")
    return jsonErro("Sessão expirada. Entre de novo.", 401);
  if (!g.ok) return jsonErro("Área da coordenação.", 403);
  const runId = new URL(req.url).searchParams.get("run");
  const { data: apagados, error } = await supabase.rpc("ia_eval_limpar", {
    p_run: runId,
  });
  if (error) return jsonErro("Não consegui apagar — tente de novo.", 500);
  return NextResponse.json({ ok: true, apagados: apagados ?? 0 });
}
