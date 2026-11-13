// Ramo demo da API de evals (0164, REALIZA-382): o painel /ia?aba=evals
// funciona inteiro sem sessão — corpus live (o arquivo é dado, não
// segredo), histórico de runs prontos e um run "na fila" que o visitante
// dirige de verdade: cada POST /executar marca a próxima célula com um
// resultado plausível e o progresso mora no cookie demo_eval (índices
// executados por run + defs dos runs criados + lápides do histórico).
// Determinístico por (run, índice): reabrir o detalhe mostra o mesmo
// veredito, como no banco real.

import { cookies } from "next/headers";
import { casosDoPapel, type CasoLive, type ParamsRun } from "@/lib/ia/evals";
import { DEMO_EVAL_COOKIE } from "./shared";
import { demoCookieOpts } from "./mode";
import { demoRng, uid } from "./ia-eventos";
import type { Item, ResumoRun, Run, RunDetalhe } from "@/components/ia-evals/tipos";

const COOKIE = DEMO_EVAL_COOKIE;

// grade pequena o bastante pra caber no cookie e pra assistir ao laço
const MAX_ITENS = 36;
const MAX_DEFS_SESSAO = 3;

/** Def do run criado no painel: casos por id (o objeto sai do corpus —
 *  guardar o snapshot inteiro estouraria o cookie). */
type DefSlim = {
  a: string;
  p: "staff" | "mentorado";
  m: string[];
  r: number;
  c: string[];
  t: string;
};

type Sessao = {
  defs?: Record<string, DefSlim>;
  /** índices (na ordem da grade) já executados por run */
  exec?: Record<string, number[]>;
  /** runs prontos "apagados" nesta sessão */
  del?: string[];
};

type RunDef = {
  id: string;
  created_at: string;
  ambiente: string;
  papel: "staff" | "mentorado";
  modelos: string[];
  repeticoes: number;
  casos: CasoLive[];
  /** histórico de fábrica: todos os itens nascem executados */
  fechado?: boolean;
};

function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

const DIA_MS = 86_400_000;
const atras = (dias: number, horas = 0) =>
  new Date(Date.now() - dias * DIA_MS - horas * 3_600_000).toISOString();

/** Runs prontos da demo: um histórico staff com rubricas reprovadas, um
 *  de mentorado quase limpo e um "na fila" — o botão Continuar do painel
 *  o executa de verdade via cookie. */
function runsFixos(): RunDef[] {
  const staff = casosDoPapel("staff");
  const jovem = casosDoPapel("mentorado");
  return [
    {
      id: uid(97101),
      created_at: atras(0, 1),
      papel: "staff",
      ambiente: "staging",
      modelos: ["deepseek-v4.1-flash", "glm-5.3-flash"],
      repeticoes: 1,
      casos: staff.slice(7, 12),
    },
    {
      id: uid(97201),
      created_at: atras(2, 3),
      papel: "staff",
      ambiente: "staging",
      modelos: ["deepseek-v4.1-flash", "glm-5.3-flash"],
      repeticoes: 1,
      casos: staff.slice(0, 6),
      fechado: true,
    },
    {
      id: uid(97301),
      created_at: atras(9, 5),
      papel: "mentorado",
      ambiente: "staging",
      modelos: ["deepseek-v4.1-flash"],
      repeticoes: 2,
      casos: jovem.slice(0, 4),
      fechado: true,
    },
  ];
}

function defDaSessao(id: string, slim: DefSlim): RunDef {
  const casos = casosDoPapel(slim.p);
  const porId = new Map(casos.map((c) => [c.id, c]));
  return {
    id,
    created_at: slim.t,
    ambiente: slim.a,
    papel: slim.p,
    modelos: slim.m,
    repeticoes: slim.r,
    casos: slim.c
      .map((cid) => porId.get(cid))
      .filter((c): c is CasoLive => Boolean(c)),
  };
}

async function lerSessao(): Promise<Sessao> {
  try {
    const v = (await cookies()).get(COOKIE)?.value;
    return v ? (JSON.parse(v) as Sessao) : {};
  } catch {
    return {};
  }
}

async function gravarSessao(s: Sessao) {
  (await cookies()).set(COOKIE, JSON.stringify(s), await demoCookieOpts());
}

async function todosDefs(): Promise<{ fixos: RunDef[]; sessao: Sessao; defs: RunDef[] }> {
  const sessao = await lerSessao();
  const fixos = runsFixos();
  const criados = Object.entries(sessao.defs ?? {}).map(([id, slim]) =>
    defDaSessao(id, slim)
  );
  return { fixos, sessao, defs: [...criados, ...fixos] };
}

function acharDef(defs: RunDef[], runId: string): RunDef | null {
  return defs.find((d) => d.id === runId) ?? null;
}

/** Grade na mesma ordem do criarRun real (casos → modelos → repetições). */
function itensBase(def: RunDef): Item[] {
  let idx = 0;
  return def.casos.flatMap((c) =>
    def.modelos.flatMap((modelo) =>
      Array.from({ length: def.repeticoes }, (_, rep) => {
        const i = idx++;
        return {
          id: `${def.id}-i${i}`,
          caso_id: c.id,
          msg: c.msg,
          pagina: c.pagina ?? null,
          modelo,
          repeticao: rep + 1,
          status: "pendente" as const,
          rubrica: {
            tools_esperadas: c.tools_esperadas,
            tools_nao_pode: c.tools_nao_pode,
            resposta_contem: c.resposta_contem,
            resposta_nao_contem: c.resposta_nao_contem,
          },
          request_id: null,
          latencia_ms: null,
          tokens_in: null,
          tokens_out: null,
          custo_usd: null,
          modelo_usado: null,
          tools_usadas: [],
          resposta_trecho: null,
          detalhe: null,
          executado_em: null,
        };
      })
    )
  );
}

const EXECUTADOS_VAZIO = new Set<number>();

/** Índices executados: cookie pra runs vivos/criados, tudo pros fixos
 *  fechados que ainda não foram mexidos. */
function executados(def: RunDef, sessao: Sessao): Set<number> {
  const gravado = sessao.exec?.[def.id];
  if (gravado) return new Set(gravado);
  if (def.fechado) return new Set(itensBase(def).map((_, i) => i));
  return EXECUTADOS_VAZIO;
}

/** Trechos plausíveis por família de caso — o dossiê lê a resposta como
 *  a Liza falaria, sem fingir conteúdo de um chat que não rodou. */
const TRECHOS: [RegExp, string][] = [
  [/recusa/, "Não escrevo código — sou a Liza, a assistente do programa de mentoria. Posso ajudar com as duplas, a agenda e os guias oficiais."],
  [/hist/, "Nos últimos 30 dias foram 46 encontros registrados, com taxa de realização de 78%. A dupla que mais furou foi a da Ana Beatriz."],
  [/agenda/, "Esta semana há 3 encontros marcados nas suas duplas: terça a dupla da Luísa e quinta as da Ana e do Pedro."],
  [/saude|fonte|atencao/, "Duas duplas pedem atenção agora: uma com pedido de apoio aberto e outra com dois encontros atrasados."],
  [/registro/, "Há 5 registros de encontro em atraso no ciclo, a maioria de duplas DPP da segunda quinzena."],
  [/trilhas|fila/, "A fila de pareamento tem 4 jovens aguardando: 2 pedem trilha especialista e 2 aguardam dupla DPP."],
  [/chamado/, "Há 2 chamados abertos agora, um pedido de apoio do mentor Ricardo e uma dúvida de formação."],
  [/pedidos/, "Você tem um pedido de especialista em análise — a coordenação já foi avisada e retorna em breve."],
  [/mentor|dupla/, "Sua mentora é a Camila e o supervisor da sua dupla é o Paulo. A dupla está ativa desde o início do ciclo."],
  [/proximo/, "Seu próximo encontro é o nº 7, na terça-feira à noite, com a Camila."],
  [/jornada|progresso/, "Sua esteira mostra 4 instrumentos respondidos e 2 pendentes — a roda da vida fecha esta semana."],
  [/sec-/, "Esse pedido sai do que eu posso ver — só falo da sua dupla e dos guias do programa. Posso ajudar com os seus próximos passos?"],
];

function trechoDoCaso(caso: CasoLive): string {
  for (const [re, t] of TRECHOS) if (re.test(caso.id)) return t;
  return "Os dados do recorte estão acima. Se quiser, eu detalho por dupla, por semana ou por etapa do ciclo.";
}

/** Resultado simulado da célula — determinístico por (run, índice), com a
 *  mesma gramática de `detalhe` que o avaliarRubrica real produz (o
 *  checklist do painel parseia de volta esses fragmentos). */
function resultadoDoItem(def: RunDef, idx: number): Partial<Item> {
  const item = itensBase(def)[idx];
  const caso = def.casos.find((c) => c.id === item.caso_id) as CasoLive;
  const r = demoRng(hashStr(`${def.id}#${idx}`));
  const pro = /pro|max|opus|grok/.test(item.modelo);
  const flash = /flash|haiku|mini|lite|spark/.test(item.modelo);
  const lat = Math.round(
    flash ? 1500 + r() * 3200 : pro ? 7000 + r() * 7500 : 3200 + r() * 4800
  );
  const tin = Math.round(
    flash ? 1400 + r() * 2600 : pro ? 14000 + r() * 26000 : 4200 + r() * 8400
  );
  const tout = Math.round(tin * (0.06 + r() * 0.2));
  const custo = +(
    flash ? 0.0005 + r() * 0.003 : pro ? 0.04 + r() * 0.18 : 0.006 + r() * 0.04
  ).toFixed(6);
  const executado_em = new Date(
    Date.parse(def.created_at) + (idx + 1) * 9_000
  ).toISOString();
  const request_id = uid(80000 + (hashStr(def.id) % 5000) + idx);

  const ferramentas = (caso.tools_esperadas ?? []).map(
    (t) => t.split("|")[hashStr(`${idx}:${t}`) % t.split("|").length]
  );
  const v = r();
  const erro = v < 0.06;
  const falhou = !erro && v < 0.19;
  if (erro) {
    return {
      status: "erro",
      detalhe: "HTTP 502, content-type text/html",
      request_id,
      latencia_ms: Math.round(lat / 3),
      tokens_in: null,
      tokens_out: null,
      custo_usd: null,
      modelo_usado: null,
      tools_usadas: [],
      resposta_trecho: null,
      executado_em,
    };
  }
  // a resposta "roda": tools esperadas + às vezes uma consulta extra
  const tools = r() < 0.2 ? [...ferramentas, "guia_consulta"] : ferramentas;
  const usado =
    r() < 0.08 ? "mimo-v2.6-flash" : item.modelo; // reserva assumiu — aparece no dossiê
  if (falhou) {
    const opcoes: { detalhe: string; tools: string[] }[] = [];
    if (caso.tools_esperadas?.length)
      opcoes.push({
        detalhe: `nenhuma tool de ${caso.tools_esperadas} (viu: guia_consulta)`,
        tools: ["guia_consulta"],
      });
    if (caso.tools_nao_pode?.length)
      opcoes.push({
        detalhe: `tool proibida: ${caso.tools_nao_pode[0]}`,
        tools: [...tools, caso.tools_nao_pode[0]],
      });
    for (const re of caso.resposta_contem ?? [])
      opcoes.push({ detalhe: `resposta sem /${re}/`, tools });
    for (const re of caso.resposta_nao_contem ?? [])
      opcoes.push({ detalhe: `resposta COM /${re}/`, tools });
    const escolhido = opcoes[hashStr(`${idx}f`) % opcoes.length] ?? {
      detalhe: "stream sem done nem error",
      tools,
    };
    return {
      status: "falhou",
      detalhe: escolhido.detalhe,
      request_id,
      latencia_ms: lat,
      tokens_in: tin,
      tokens_out: tout,
      custo_usd: custo,
      modelo_usado: usado,
      tools_usadas: escolhido.tools,
      resposta_trecho: trechoDoCaso(caso).slice(0, 500),
      executado_em,
    };
  }
  return {
    status: "ok",
    detalhe: null,
    request_id,
    latencia_ms: lat,
    tokens_in: tin,
    tokens_out: tout,
    custo_usd: custo,
    modelo_usado: usado,
    tools_usadas: tools,
    resposta_trecho: trechoDoCaso(caso).slice(0, 500),
    executado_em,
  };
}

function itensDoRun(def: RunDef, sessao: Sessao): Item[] {
  const exec = executados(def, sessao);
  return itensBase(def).map((base, idx) =>
    exec.has(idx) ? { ...base, ...resultadoDoItem(def, idx) } : base
  );
}

function resumoDoRun(itens: Item[], fimEm: string | null): ResumoRun | null {
  const feitos = itens.filter((i) => i.executado_em != null);
  if (!feitos.length) return null;
  const lats = feitos
    .map((i) => i.latencia_ms)
    .filter((v): v is number => typeof v === "number");
  return {
    total: itens.length,
    ok: itens.filter((i) => i.status === "ok").length,
    falhas: itens.filter((i) => i.status === "falhou").length,
    erros: itens.filter((i) => i.status === "erro").length,
    latencia_media_ms: lats.length
      ? Math.round(lats.reduce((a, b) => a + b, 0) / lats.length)
      : null,
    custo_usd: +feitos.reduce((a, i) => a + (i.custo_usd ?? 0), 0).toFixed(6),
    tokens_in: feitos.reduce((a, i) => a + (i.tokens_in ?? 0), 0),
    tokens_out: feitos.reduce((a, i) => a + (i.tokens_out ?? 0), 0),
    ...(fimEm ? { fim_em: fimEm } : {}),
  };
}

function projetaRun(def: RunDef, itens: Item[]): Run {
  const total = itens.length;
  const exec = itens.filter((i) => i.executado_em != null).length;
  const status: Run["status"] =
    exec === 0 ? "pendente" : exec === total ? "concluido" : "rodando";
  const ultimo = itens
    .map((i) => i.executado_em)
    .filter((t): t is string => t != null)
    .sort()
    .at(-1);
  return {
    id: def.id,
    created_at: def.created_at,
    status,
    ambiente: def.ambiente,
    papel: def.papel,
    modelos: def.modelos,
    repeticoes: def.repeticoes,
    resumo:
      status === "concluido" ? resumoDoRun(itens, ultimo ?? null) : null,
  };
}

// ---------- endpoints (mesmos contratos da rota real) ----------

export async function demoEvalRuns(): Promise<Run[]> {
  const { sessao, defs } = await todosDefs();
  const mortos = new Set(sessao.del ?? []);
  return defs
    .filter((d) => !mortos.has(d.id))
    .map((d) => projetaRun(d, itensDoRun(d, sessao)))
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export async function demoEvalDetalhe(
  runId: string
): Promise<{ run: RunDetalhe; itens: Item[] } | null> {
  const { sessao, defs } = await todosDefs();
  const def = acharDef(defs, runId);
  if (!def || (sessao.del ?? []).includes(runId)) return null;
  const itens = itensDoRun(def, sessao);
  return { run: { ...projetaRun(def, itens), casos: def.casos }, itens };
}

/** Próximo item pendente na ordem da grade (?proximo). */
export async function demoEvalProximo(runId: string) {
  const { sessao, defs } = await todosDefs();
  const def = acharDef(defs, runId);
  if (!def) return { proximo: null };
  const exec = executados(def, sessao);
  const itens = itensBase(def);
  const idx = itens.findIndex((_, i) => !exec.has(i));
  if (idx === -1) return { proximo: null };
  const i = itens[idx];
  return {
    proximo: {
      id: i.id,
      caso_id: i.caso_id,
      modelo: i.modelo,
      repeticao: i.repeticao,
      msg: i.msg,
    },
  };
}

/** POST /executar demo: "roda" a próxima célula — o veredito é o mesmo
 *  em qualquer reabertura, mas o avanço é real dentro da sessão. Uma
 *  pausa curta imita o tempo da pergunta sem arrastar o laço (o teste
 *  unitário zera via opts — a rota nunca passa). */
export async function demoEvalExecutar(
  runId: string,
  opts?: { semDelay?: boolean }
) {
  const { sessao, defs } = await todosDefs();
  const def = acharDef(defs, runId);
  if (!def) return { feito: true };
  const itens = itensBase(def);
  const exec = new Set(executados(def, sessao));
  const idx = itens.findIndex((_, i) => !exec.has(i));
  if (idx === -1) return { feito: true };
  if (!opts?.semDelay)
    await new Promise((r) =>
      setTimeout(r, 380 + (hashStr(itens[idx].id) % 620))
    );
  const resultado = resultadoDoItem(def, idx);
  exec.add(idx);
  sessao.exec = { ...(sessao.exec ?? {}), [runId]: [...exec] };
  await gravarSessao(sessao);
  const i = itens[idx];
  return {
    feito: false,
    item: {
      id: i.id,
      caso_id: i.caso_id,
      modelo: i.modelo,
      repeticao: i.repeticao,
      ...resultado,
    },
  };
}

/** POST /evals demo: monta a grade do corpus live (o mesmo casosDoPapel
 *  do real), corta os casos pra caber o laço e guarda a def no cookie. */
export async function demoEvalCriar(body: ParamsRun) {
  const casos = casosDoPapel(body.papel, body.casoIds);
  if (!casos.length) throw new Error("nenhum caso do corpus nesse papel");
  const porCaso = body.modelos.length * body.repeticoes;
  const efetivos = casos.slice(
    0,
    Math.max(1, Math.floor(MAX_ITENS / Math.max(1, porCaso)))
  );
  // id em formato uuid (como os dos runs prontos) — os zod das rotas
  // validam run_id como uuid tanto no ramo real quanto no demo
  const id = uid(Date.now() % 0xffffffffffff);
  const sessao = await lerSessao();
  const defs = { ...(sessao.defs ?? {}) };
  defs[id] = {
    a: body.ambiente.slice(0, 40),
    p: body.papel,
    m: body.modelos,
    r: body.repeticoes,
    c: efetivos.map((c) => c.id),
    t: new Date().toISOString(),
  };
  const ids = Object.keys(defs);
  while (ids.length > MAX_DEFS_SESSAO) delete defs[ids.shift() as string];
  sessao.defs = defs;
  await gravarSessao(sessao);
  return { id, itens: efetivos.length * porCaso };
}

/** PATCH /evals demo: devolve as falhas/erros à fila — mesmo recorte do
 *  PATCH real (falhou, erro e o zumbi rodando). */
export async function demoEvalReagendar(runId: string) {
  const { sessao, defs } = await todosDefs();
  const def = acharDef(defs, runId);
  if (!def) return { reagendados: 0 };
  const itens = itensBase(def);
  const exec = new Set(executados(def, sessao));
  const voltam = itens
    .map((_, idx) => idx)
    .filter((idx) => {
      if (!exec.has(idx)) return false;
      const st = resultadoDoItem(def, idx).status;
      return st === "falhou" || st === "erro";
    });
  for (const idx of voltam) exec.delete(idx);
  sessao.exec = { ...(sessao.exec ?? {}), [runId]: [...exec] };
  await gravarSessao(sessao);
  return { reagendados: voltam.length };
}

/** DELETE /evals demo: run da sessão some do cookie; run pronto fica
 *  lápide nesta sessão — "apagou fica apagado" como no banco, e o
 *  fixture volta só quando a demo reinicia (limparDemoEval). */
export async function demoEvalApagar(runId: string | null) {
  const sessao = await lerSessao();
  let apagados = 0;
  if (runId) {
    if (sessao.defs?.[runId]) {
      delete sessao.defs[runId];
      if (sessao.exec) delete sessao.exec[runId];
      apagados = 1;
    } else if (runsFixos().some((d) => d.id === runId)) {
      sessao.del = [...new Set([...(sessao.del ?? []), runId])];
      if (sessao.exec) delete sessao.exec[runId];
      apagados = 1;
    }
  } else {
    apagados = Object.keys(sessao.defs ?? {}).length + runsFixos().length;
    sessao.defs = {};
    sessao.exec = {};
    sessao.del = runsFixos().map((d) => d.id);
  }
  await gravarSessao(sessao);
  return { apagados };
}
