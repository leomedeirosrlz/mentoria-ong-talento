// Evals da Liza (0164) — coord-only como o /ia inteiro. GET lista runs
// (?run=<id> detalha com itens; ?casos devolve o corpus live pra montar a
// grade); POST cria o run com a grade cartesiana de itens pendentes.
// A execução em si é uma request por item em /executar — a UI dirige o laço.

import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { criarRun, listarCasosLive } from "@/lib/ia/evals";
import { demoRole } from "@/lib/demo/mode";
import {
  demoEvalApagar,
  demoEvalCriar,
  demoEvalDetalhe,
  demoEvalProximo,
  demoEvalReagendar,
  demoEvalRuns,
} from "@/lib/demo/ia-evals";

const jsonErro = (mensagem: string, status: number) =>
  NextResponse.json({ error: mensagem }, { status });

const casosJson = () =>
  NextResponse.json({
    casos: listarCasosLive().map((c) => ({
      id: c.id,
      papel_esperado: c.papel_esperado,
      msg: c.msg,
      pagina: c.pagina ?? null,
      rubrica: {
        tools_esperadas: c.tools_esperadas,
        tools_nao_pode: c.tools_nao_pode,
        resposta_contem: c.resposta_contem,
        resposta_nao_contem: c.resposta_nao_contem,
      },
    })),
  });

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
  const url = new URL(req.url);
  const runId = url.searchParams.get("run");
  const proximoRun = url.searchParams.get("proximo");
  // demo: mesmos contratos, dados determinísticos do dataset (lib/demo/
  // ia-evals) — o painel renderiza e o laço dirige de verdade via cookie
  const demo = await demoRole();
  if (demo) {
    if (demo !== "coordenacao") return jsonErro("Área da coordenação.", 403);
    if (url.searchParams.has("casos")) return casosJson();
    if (proximoRun) return NextResponse.json(await demoEvalProximo(proximoRun));
    if (runId) {
      const d = await demoEvalDetalhe(runId);
      if (!d) return jsonErro("Run não encontrado.", 404);
      return NextResponse.json(d);
    }
    return NextResponse.json({ runs: await demoEvalRuns() });
  }

  const supabase = await createClient();
  const g = await gateCoord(supabase);
  if (g.erro === "sessao")
    return jsonErro("Sessão expirada. Entre de novo.", 401);
  if (!g.ok) return jsonErro("Área da coordenação.", 403);

  if (url.searchParams.has("casos")) {
    return casosJson();
  }
  // primeiro pendente na MESMA ordem do claim (order by id) — a UI marca a
  // célula em voo antes do POST /executar responder
  if (proximoRun) {
    const { data: prox } = await supabase
      .from("ia_eval_itens")
      .select("id, caso_id, modelo, repeticao, msg")
      .eq("run_id", proximoRun)
      .eq("status", "pendente")
      .order("id")
      .limit(1)
      .maybeSingle();
    return NextResponse.json({ proximo: prox ?? null });
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
  const body = CriarBody.safeParse(await req.json().catch(() => null));
  if (!body.success) return jsonErro("Parâmetros inválidos.", 400);
  const demo = await demoRole();
  if (demo) {
    if (demo !== "coordenacao") return jsonErro("Área da coordenação.", 403);
    try {
      const r = await demoEvalCriar(body.data);
      return NextResponse.json(r, { status: 201 });
    } catch (e) {
      return jsonErro(
        e instanceof Error ? e.message : "Falha ao criar o run.",
        400
      );
    }
  }
  const supabase = await createClient();
  const g = await gateCoord(supabase);
  if (g.erro === "sessao")
    return jsonErro("Sessão expirada. Entre de novo.", 401);
  if (!g.ok || !g.profileId)
    return jsonErro("Área da coordenação.", 403);
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

/** ?run=<id> deletes one run; no param wipes the whole history — items
 *  cascade inside the ia_eval_limpar RPC (0166). Panel indicators go
 *  through a different button (DELETE /api/ia/eventos): independent
 *  wipes, by coordination's decision. */
export async function DELETE(req: Request) {
  const runId = new URL(req.url).searchParams.get("run");
  const demo = await demoRole();
  if (demo) {
    if (demo !== "coordenacao") return jsonErro("Área da coordenação.", 403);
    if (runId && !z.string().uuid().safeParse(runId).success) {
      return jsonErro("Run inválido.", 400);
    }
    const { apagados } = await demoEvalApagar(runId);
    return NextResponse.json({ ok: true, apagados });
  }
  const supabase = await createClient();
  const g = await gateCoord(supabase);
  if (g.erro === "sessao")
    return jsonErro("Sessão expirada. Entre de novo.", 401);
  if (!g.ok) return jsonErro("Área da coordenação.", 403);
  if (runId && !z.string().uuid().safeParse(runId).success) {
    return jsonErro("Run inválido.", 400);
  }
  const { data: apagados, error } = await supabase.rpc("ia_eval_limpar", {
    p_run: runId,
  });
  if (error) return jsonErro("Não consegui apagar — tente de novo.", 500);
  return NextResponse.json({ ok: true, apagados: apagados ?? 0 });
}

const ReagendarBody = z.object({ run_id: z.string().uuid() }).strict();

/** PATCH {run_id} — requeues the run's failed/stuck items: falhou/erro
 *  (and zombie rodando from a dead session) go back to 'pendente' with
 *  cleared results, and the run reopens as 'rodando' for the loop to
 *  resume. Direct update — coord's `for all` policy already covers (0164). */
export async function PATCH(req: Request) {
  const body = ReagendarBody.safeParse(await req.json().catch(() => null));
  if (!body.success) return jsonErro("run_id inválido.", 400);
  const demo = await demoRole();
  if (demo) {
    if (demo !== "coordenacao") return jsonErro("Área da coordenação.", 403);
    const { reagendados } = await demoEvalReagendar(body.data.run_id);
    return NextResponse.json({ ok: true, reagendados });
  }
  const supabase = await createClient();
  const g = await gateCoord(supabase);
  if (g.erro === "sessao")
    return jsonErro("Sessão expirada. Entre de novo.", 401);
  if (!g.ok) return jsonErro("Área da coordenação.", 403);

  const { data: reagendados, error } = await supabase
    .from("ia_eval_itens")
    .update({
      status: "pendente",
      detalhe: null,
      request_id: null,
      latencia_ms: null,
      tokens_in: null,
      tokens_out: null,
      custo_usd: null,
      modelo_usado: null,
      tools_usadas: [],
      resposta_trecho: null,
      executado_em: null,
    })
    .eq("run_id", body.data.run_id)
    .in("status", ["falhou", "erro", "rodando"])
    .select("id");
  if (error) return jsonErro("Não consegui reagendar — tente de novo.", 500);
  if (reagendados?.length)
    await supabase
      .from("ia_eval_runs")
      .update({ status: "rodando" })
      .eq("id", body.data.run_id);
  return NextResponse.json({ ok: true, reagendados: reagendados?.length ?? 0 });
}
