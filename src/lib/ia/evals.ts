// Executor dos evals persistidos (0164) — a UI do /ia cria um run (grade
// casos × modelos × repetições) e vai chamando executarProximoItem(): cada
// chamada roda UM item (um POST real no /api/ia/chat), grava as métricas do
// evento 'resposta' correlacionado por request_id e fecha o run quando a
// fila esvazia. Uma request HTTP por item → nunca estoura timeout.
//
// Sessão de teste: EVAL_EMAIL/EVAL_SENHA contra o Supabase do MESMO
// ambiente do app (os envs públicos já são dele) — igual ao eval-ia.mjs.
// O override de modelo só vale com IA_EVAL_KEY no env do servidor.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

// ---------- corpus ----------

export type CasoLive = {
  id: string;
  papel_esperado: "qualquer" | "staff" | "mentorado";
  msg: string;
  pagina?: string;
  tools_esperadas?: string[];
  tools_nao_pode?: string[];
  resposta_contem?: string[];
  resposta_nao_contem?: string[];
};

/** Casos live do corpus — lidos do arquivo a cada chamada (o painel vê o
 *  corpus ATUAL pra montar a grade; o snapshot vai no run, então a edição
 *  posterior não muda o histórico). */
export function listarCasosLive(): CasoLive[] {
  const caminho = join(process.cwd(), "tests", "evals", "casos.json");
  const casos = JSON.parse(readFileSync(caminho, "utf8")) as {
    live?: CasoLive[];
  };
  return casos.live ?? [];
}

// ---------- criação do run ----------

export type ParamsRun = {
  ambiente: string;
  papel: "staff" | "mentorado";
  modelos: string[];
  repeticoes: number;
  casoIds?: string[]; // ausente = todos os casos do papel
};

/** Casos elegíveis pro papel do run (mesma regra do eval-ia.mjs: 'qualquer'
 *  roda nos dois). */
export function casosDoPapel(
  papel: ParamsRun["papel"],
  casoIds?: string[]
): CasoLive[] {
  return listarCasosLive().filter(
    (c) =>
      (c.papel_esperado === "qualquer" || c.papel_esperado === papel) &&
      (!casoIds || casoIds.includes(c.id))
  );
}

/** Insere o run + a grade cartesiana de itens pendentes numa transação
 *  lógica (o insert de itens falhando depois do run deixa órfão — o delete
 *  do run é o rollback barato aqui). */
export async function criarRun(
  supabase: SupabaseClient,
  profileId: string,
  p: ParamsRun
) {
  const casos = casosDoPapel(p.papel, p.casoIds);
  if (!casos.length) throw new Error("nenhum caso do corpus nesse papel");
  const { data: run, error: e1 } = await supabase
    .from("ia_eval_runs")
    .insert({
      created_by: profileId,
      ambiente: p.ambiente.slice(0, 40),
      papel: p.papel,
      modelos: p.modelos,
      repeticoes: p.repeticoes,
      casos,
    })
    .select("id")
    .single();
  if (e1 || !run) throw new Error(e1?.message ?? "falha ao criar o run");
  const itens = casos.flatMap((c) =>
    p.modelos.flatMap((modelo) =>
      Array.from({ length: p.repeticoes }, (_, i) => ({
        run_id: run.id,
        caso_id: c.id,
        msg: c.msg,
        pagina: c.pagina ?? null,
        modelo,
        repeticao: i + 1,
        rubrica: {
          tools_esperadas: c.tools_esperadas,
          tools_nao_pode: c.tools_nao_pode,
          resposta_contem: c.resposta_contem,
          resposta_nao_contem: c.resposta_nao_contem,
        },
      }))
    )
  );
  const { error: e2 } = await supabase.from("ia_eval_itens").insert(itens);
  if (e2) {
    await supabase.from("ia_eval_runs").delete().eq("id", run.id);
    throw new Error(e2.message);
  }
  return { id: run.id as string, itens: itens.length };
}

// ---------- execução de um item ----------

type Rubrica = {
  tools_esperadas?: string[];
  tools_nao_pode?: string[];
  resposta_contem?: string[];
  resposta_nao_contem?: string[];
};

/** Julga a resposta pela rubrica do caso — MESMA lógica do eval-ia.mjs
 *  (regex nas tools vistas no stream e no texto montado). */
export function avaliarRubrica(
  rubrica: Rubrica,
  tools: string[],
  texto: string,
  terminou: boolean,
  erroStream: string | null
): { pass: boolean; detalhe: string | null } {
  const problemas: string[] = [];
  if (!terminou) problemas.push("stream sem done nem error");
  if (erroStream) problemas.push(`erro no stream: ${erroStream}`);
  if (rubrica.tools_esperadas?.length) {
    const re = new RegExp(rubrica.tools_esperadas.join("|"));
    if (!tools.some((t) => re.test(t)))
      problemas.push(
        `nenhuma tool de ${rubrica.tools_esperadas} (viu: ${tools.join(",") || "—"})`
      );
  }
  if (rubrica.tools_nao_pode?.length) {
    const re = new RegExp(rubrica.tools_nao_pode.join("|"));
    const vazou = tools.filter((t) => re.test(t));
    if (vazou.length) problemas.push(`tool proibida: ${vazou.join(",")}`);
  }
  for (const re of rubrica.resposta_contem ?? [])
    if (!new RegExp(re, "i").test(texto))
      problemas.push(`resposta sem /${re}/`);
  for (const re of rubrica.resposta_nao_contem ?? [])
    if (new RegExp(re, "i").test(texto))
      problemas.push(`resposta COM /${re}/`);
  return {
    pass: problemas.length === 0,
    detalhe: problemas.length ? problemas.join("; ") : null,
  };
}

/** Cookie de sessão do formato do app (mesmo jar do eval-ia.mjs): sign-in
 *  por senha no Supabase do ambiente, token vivo só nesta execução. */
async function cookieDeSessao() {
  const email = process.env.EVAL_EMAIL;
  const senha = process.env.EVAL_SENHA;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!email || !senha || !url || !anon)
    throw new Error(
      "eval precisa de EVAL_EMAIL/EVAL_SENHA no env do servidor"
    );
  const jar = new Map<string, string>();
  const sb = createServerClient(url, anon, {
    cookies: {
      getAll: () => [...jar].map(([name, value]) => ({ name, value })),
      setAll: (lista) =>
        lista.forEach(({ name, value }) =>
          value ? jar.set(name, value) : jar.delete(name)
        ),
    },
  });
  const { error } = await sb.auth.signInWithPassword({
    email,
    password: senha,
  });
  if (error) throw new Error(`login do eval falhou: ${error.message}`);
  return [...jar].map(([n, v]) => `${n}=${v}`).join("; ");
}

type SseLido = {
  tools: string[];
  texto: string;
  erro: string | null;
  terminou: boolean;
};

async function lerSse(res: Response): Promise<SseLido> {
  let tools: string[] = [];
  let texto = "";
  let erro: string | null = null;
  let terminou = false;
  const reader = res.body!.getReader();
  const dec = new TextDecoder();
  let buf = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    const linhas = buf.split("\n");
    buf = linhas.pop() ?? "";
    for (const l of linhas) {
      if (!l.startsWith("data:")) continue;
      try {
        const ev = JSON.parse(l.slice(5).trim());
        if (ev.type === "token" && ev.c) texto += ev.c;
        if (ev.type === "reset") texto = "";
        if (ev.type === "done") {
          tools = ev.tools ?? [];
          terminou = true;
        }
        if (ev.type === "error") {
          erro = ev.e ?? "erro";
          terminou = true;
        }
      } catch {
        /* linha parcial */
      }
    }
  }
  return { tools, texto, erro, terminou };
}

export type ItemEval = {
  id: string;
  run_id: string;
  caso_id: string;
  msg: string;
  pagina: string | null;
  modelo: string;
  repeticao: number;
  status: string;
  rubrica: Rubrica | null;
};

/** Claim atômico + execução de UM item do run. Devolve progresso pra UI
 *  dirigir o laço; null = fila vazia (run já fechado). */
export async function executarProximoItem(
  supabase: SupabaseClient,
  runId: string,
  baseUrl: string
): Promise<{ feito: boolean; item?: Record<string, unknown> }> {
  const { data: item, error: eClaim } = await supabase.rpc(
    "ia_eval_pegar_item",
    { p_run: runId }
  );
  if (eClaim) throw new Error(eClaim.message);
  // composite de linha: PostgREST pode devolver objeto ou array de 1
  const it = (Array.isArray(item) ? item[0] : item) as ItemEval | null;
  if (!it?.id) {
    await fecharRun(supabase, runId);
    return { feito: true };
  }

  const t0 = Date.now();
  let status: ItemEval["status"] = "erro";
  let detalhe: string | null = null;
  let requestId: string | null = null;
  let tools: string[] = [];
  let trecho: string | null = null;

  try {
    const cookie = await cookieDeSessao();
    const res = await fetch(`${baseUrl}/api/ia/chat`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie,
        "x-ia-eval-key": process.env.IA_EVAL_KEY ?? "",
      },
      body: JSON.stringify({
        messages: [{ role: "user", content: it.msg }],
        ...(it.pagina ? { pagina: it.pagina } : {}),
        modelo: it.modelo,
      }),
      redirect: "manual",
    });
    const tipo = res.headers.get("content-type") ?? "";
    requestId = res.headers.get("x-ia-request-id");
    if (!res.ok || !tipo.includes("text/event-stream")) {
      detalhe = `HTTP ${res.status}, content-type ${tipo || "vazio"}`;
    } else {
      const lido = await lerSse(res);
      tools = lido.tools;
      trecho = lido.texto.slice(0, 500) || null;
      const julg = avaliarRubrica(
        it.rubrica ?? {},
        lido.tools,
        lido.texto,
        lido.terminou,
        lido.erro
      );
      status = julg.pass ? "ok" : "falhou";
      detalhe = julg.detalhe;
    }
  } catch (e) {
    detalhe = e instanceof Error ? e.message : String(e);
  }
  const latencia = Date.now() - t0;

  // métricas da request: o evento 'resposta' já agregou tudo (sdd D4)
  let uso: {
    tokens_in: number | null;
    tokens_out: number | null;
    custo_usd: number | null;
    modelo: string | null;
  } | null = null;
  if (requestId) {
    const { data } = await supabase
      .from("ia_eventos")
      .select("tokens_in, tokens_out, custo_usd, modelo")
      .eq("request_id", requestId)
      .eq("tool", "resposta")
      .maybeSingle();
    uso = data;
  }

  const { error: eUp } = await supabase
    .from("ia_eval_itens")
    .update({
      status,
      detalhe,
      request_id: requestId,
      latencia_ms: latencia,
      tokens_in: uso?.tokens_in ?? null,
      tokens_out: uso?.tokens_out ?? null,
      custo_usd: uso?.custo_usd ?? null,
      modelo_usado: uso?.modelo ?? null,
      tools_usadas: tools,
      resposta_trecho: trecho,
      executado_em: new Date().toISOString(),
    })
    .eq("id", it.id);
  if (eUp) throw new Error(eUp.message);
  return { feito: false, item: { id: it.id, caso_id: it.caso_id, status } };
}

/** Fecha o run quando a fila esvazia: resumo com agregados prontos pro
 *  painel (pass rate, latência média, custo e tokens totais). */
async function fecharRun(supabase: SupabaseClient, runId: string) {
  const { data: itens } = await supabase
    .from("ia_eval_itens")
    .select("status, latencia_ms, custo_usd, tokens_in, tokens_out")
    .eq("run_id", runId);
  const lista = (itens ?? []) as {
    status: string;
    latencia_ms: number | null;
    custo_usd: number | null;
    tokens_in: number | null;
    tokens_out: number | null;
  }[];
  const n = (k: keyof (typeof lista)[number], f: (v: number) => boolean) =>
    lista.filter((i) => typeof i[k] === "number" && f(i[k] as number));
  const soma = (k: "custo_usd" | "tokens_in" | "tokens_out") =>
    lista.reduce((acc, i) => acc + (Number(i[k]) || 0), 0);
  const lats = n("latencia_ms", () => true).map(
    (i) => i.latencia_ms as number
  );
  const resumo = {
    total: lista.length,
    ok: lista.filter((i) => i.status === "ok").length,
    falhas: lista.filter((i) => i.status === "falhou").length,
    erros: lista.filter((i) => i.status === "erro").length,
    latencia_media_ms: lats.length
      ? Math.round(lats.reduce((a, b) => a + b, 0) / lats.length)
      : null,
    custo_usd: +soma("custo_usd").toFixed(6),
    tokens_in: soma("tokens_in"),
    tokens_out: soma("tokens_out"),
    fim_em: new Date().toISOString(),
  };
  await supabase
    .from("ia_eval_runs")
    .update({ status: "concluido", resumo })
    .eq("id", runId);
  return resumo;
}
