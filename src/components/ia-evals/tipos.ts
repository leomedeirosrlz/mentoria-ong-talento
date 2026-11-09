// Shared types + pure helpers of the evals panel (0164). The item type
// mirrors ia_eval_itens in full (select("*")) — the runner's per-item
// payload patches state without a refetch. The `detalhe` failure string
// has a closed vocabulary ("; "-separated) that maps 1:1 onto rubrica
// asserts — assertsDoItem turns it back into a checklist.

import { rotuloTool } from "@/lib/ia/fontes";
import type { CSSProperties } from "react";

// ---------- API shapes ----------

export type Rubrica = {
  tools_esperadas?: string[];
  tools_nao_pode?: string[];
  resposta_contem?: string[];
  resposta_nao_contem?: string[];
};

/** Live corpus case for the new-run form (?casos). */
export type Caso = {
  id: string;
  papel_esperado: string;
  msg: string;
  pagina: string | null;
  rubrica: Rubrica;
};

/** Case as snapshotted on the run row (CasoLive shape, corpus order —
 *  the matrix rows follow this order, not the items' id order). */
export type CasoSnapshot = {
  id: string;
  papel_esperado?: string;
  msg: string;
  pagina?: string | null;
} & Rubrica;

export type ResumoRun = {
  total: number;
  ok: number;
  falhas: number;
  erros: number;
  latencia_media_ms: number | null;
  custo_usd: number;
  tokens_in: number;
  tokens_out: number;
  fim_em?: string;
};

export type Run = {
  id: string;
  created_at: string;
  status: "pendente" | "rodando" | "concluido" | "falhou";
  ambiente: string;
  papel: "staff" | "mentorado";
  modelos: string[];
  repeticoes: number;
  resumo: ResumoRun | null;
};

export type RunDetalhe = Run & { casos: CasoSnapshot[] };

export type StatusItem = "pendente" | "rodando" | "ok" | "falhou" | "erro";

export type Item = {
  id: string;
  caso_id: string;
  msg: string;
  pagina: string | null;
  modelo: string;
  repeticao: number;
  status: StatusItem;
  rubrica: Rubrica | null;
  request_id: string | null;
  latencia_ms: number | null;
  tokens_in: number | null;
  tokens_out: number | null;
  custo_usd: number | null;
  modelo_usado: string | null;
  tools_usadas: string[] | null;
  resposta_trecho: string | null;
  detalhe: string | null;
  executado_em: string | null;
};

/** First pending item in claim order (?proximo) — lets the UI light the
 *  exact cell in flight before POST /executar answers. */
export type ProximoItem = {
  id: string;
  caso_id: string;
  modelo: string;
  repeticao: number;
  msg: string;
};

export type FiltroItem = "todos" | "ok" | "falhou" | "erro";

// ---------- status grammar ----------

export const STATUS_ITEM: Record<StatusItem, { rotulo: string; cls: string }> = {
  pendente: { rotulo: "na fila", cls: "bg-muted text-muted-foreground" },
  rodando: {
    rotulo: "rodando",
    cls: "bg-[var(--info-bg)] text-[var(--info-text)]",
  },
  ok: { rotulo: "passou", cls: "bg-[var(--ok-bg)] text-[var(--ok-text)]" },
  falhou: {
    rotulo: "falhou",
    cls: "bg-[var(--danger-bg)] text-[var(--danger-text)]",
  },
  erro: {
    rotulo: "erro",
    cls: "bg-[var(--warn-bg)] text-[var(--warn-text)]",
  },
};

export const STATUS_RUN: Record<Run["status"], { rotulo: string; cls: string }> =
  {
    pendente: { rotulo: "na fila", cls: "bg-muted text-muted-foreground" },
    rodando: {
      rotulo: "rodando",
      cls: "bg-[var(--info-bg)] text-[var(--info-text)]",
    },
    concluido: {
      rotulo: "concluído",
      cls: "bg-[var(--ok-bg)] text-[var(--ok-text)]",
    },
    falhou: {
      rotulo: "falhou",
      cls: "bg-[var(--danger-bg)] text-[var(--danger-text)]",
    },
  };

/** Solid fill of a matrix pip — same grammar as the app's status markers
 *  (status fill + --status-foreground); pendente stays dashed outline
 *  ("hasn't happened") and rodando pulses in --info. */
export const CELULA: Record<StatusItem, string> = {
  pendente:
    "border border-dashed border-muted-foreground/50 text-muted-foreground",
  rodando: "bg-[var(--info)] text-[var(--status-foreground)] animate-pulse",
  ok: "bg-[var(--ok)] text-[var(--status-foreground)]",
  falhou: "bg-[var(--danger)] text-[var(--status-foreground)]",
  erro: "bg-[var(--warn)] text-[var(--status-foreground)]",
};

/** Fill for segments of the >3-reps micro-bar: pendente keeps a quiet
 *  ghost block (the cell exists in the grid, it just hasn't run). */
export const CELULA_BARRA: Record<StatusItem, string> = {
  pendente: "bg-muted-foreground/25",
  rodando: "bg-[var(--info)] animate-pulse",
  ok: "bg-[var(--ok)]",
  falhou: "bg-[var(--danger)]",
  erro: "bg-[var(--warn)]",
};

// ---------- formatters ----------

export const num = new Intl.NumberFormat("pt-BR");
export const compacto = new Intl.NumberFormat("pt-BR", {
  notation: "compact",
  maximumFractionDigits: 1,
});
export const usd = (v: number | null) =>
  v == null ? "—" : v === 0 ? "US$ 0" : `US$ ${v.toFixed(4)}`;
export const ms = (v: number | null) =>
  v == null ? "—" : v >= 1000 ? `${(v / 1000).toFixed(1)}s` : `${v}ms`;
export const dataCurta = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
export const diaCurta = (iso: string) =>
  new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
export const stagger = (i: number) => ({ "--i": Math.min(i, 10) }) as CSSProperties;

/** Item reading for aria/title — hover already repeats latency + tokens. */
export const descItem = (i: Item) =>
  `rep ${i.repeticao}: ${STATUS_ITEM[i.status].rotulo} · ${ms(i.latencia_ms)} · ${num.format(i.tokens_in ?? 0)}+${num.format(i.tokens_out ?? 0)} tok · ${usd(i.custo_usd)}`;

/** "live-hist-30d" → "live" — case groups by id prefix. */
export const grupoDoCaso = (id: string) => id.split("-")[0];

/** "a, b ou c" with tool labels resolved. */
export function listaTools(tools: string[]): string {
  const rotulos = tools.map(rotuloTool);
  if (rotulos.length <= 1) return rotulos[0] ?? "";
  return `${rotulos.slice(0, -1).join(", ")} ou ${rotulos[rotulos.length - 1]}`;
}

const reEscape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// ---------- rubrica asserts ----------

export type Assert = {
  id: string;
  rotulo: string;
  /** null = not evaluated yet (item still pending/running, or infra died
   *  before this assert could be judged). */
  ok: boolean | null;
  /** raw fragment when the assert failed ("viu: x,y", "HTTP 502…"). */
  detalhe?: string;
};

/** Rebuilds the rubrica checklist for one item from its `detalhe` string.
 *  Each vocabulary fragment maps to one assert; an item that passed has
 *  every assert green, and an infra error marks rubrica asserts as
 *  "not evaluated" instead of lying red. Unparsed fragments (future
 *  vocabulary) still surface verbatim at the end. */
export function assertsDoItem(item: Item): Assert[] {
  const r = item.rubrica ?? {};
  const restante = new Set((item.detalhe ?? "").split("; ").filter(Boolean));
  const pendente = item.status === "pendente" || item.status === "rodando";
  const acha = (re: RegExp) => {
    const p = [...restante].find((x) => re.test(x));
    if (p) restante.delete(p);
    return p;
  };
  const avaliado = !pendente;
  // status "erro" = infra (HTTP non-SSE ou exceção) — a rubrica nunca chegou
  // a julgar nada; "falhou" já passou pelo avaliarRubrica mesmo com stream
  // quebrado, então cada assert tem veredito de verdade
  const julgado = avaliado && item.status !== "erro";
  const asserts: Assert[] = [];

  const pInfra = acha(/^HTTP |^stream sem done|^erro no stream/);
  asserts.push({
    id: "resposta",
    rotulo: "resposta completou",
    ok: !avaliado ? null : !pInfra && item.status !== "erro",
    detalhe: pInfra,
  });
  const juizo = (p: string | undefined): boolean | null =>
    !julgado ? null : !p;

  if (r.tools_esperadas?.length) {
    const p = acha(/^nenhuma tool de /);
    asserts.push({
      id: "tools-esperadas",
      rotulo: `chama ${listaTools(r.tools_esperadas)}`,
      ok: juizo(p),
      detalhe: p ? p.replace(/^nenhuma tool de \S+ ?/, "") : undefined,
    });
  }
  if (r.tools_nao_pode?.length) {
    const p = acha(/^tool proibida: /);
    asserts.push({
      id: "tools-proibidas",
      rotulo: `não chama ${listaTools(r.tools_nao_pode)}`,
      ok: juizo(p),
      detalhe: p?.replace(/^tool proibida: /, "chamou "),
    });
  }
  (r.resposta_contem ?? []).forEach((re, idx) => {
    const p = acha(new RegExp(`^resposta sem /${reEscape(re)}/$`));
    asserts.push({
      id: `contem-${idx}`,
      rotulo: `resposta contém /${re}/`,
      ok: juizo(p),
    });
  });
  (r.resposta_nao_contem ?? []).forEach((re, idx) => {
    const p = acha(new RegExp(`^resposta COM /${reEscape(re)}/$`));
    asserts.push({
      id: `nao-contem-${idx}`,
      rotulo: `resposta evita /${re}/`,
      ok: juizo(p),
    });
  });
  for (const p of restante) {
    asserts.push({
      id: `extra-${p}`,
      rotulo: p,
      ok: pendente ? null : false,
    });
  }
  return asserts;
}
