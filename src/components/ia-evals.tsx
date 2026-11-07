"use client";

// Evals persistidos da Liza (0164): a coordenação monta a grade
// casos × modelos × repetições aqui no /ia e o laço executa um item por
// request (POST /executar) — progresso ao vivo, retomável se a aba fechar.
// Métricas (latência, tokens, custo) vêm do evento 'resposta' do chat.

import {
  Fragment,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { CaretDown, CircleNotch, Pause, Play } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import { BarraSegmentada, Sparkline } from "@/components/viz";

type Caso = { id: string; papel_esperado: string; msg: string };
type Run = {
  id: string;
  created_at: string;
  status: "pendente" | "rodando" | "concluido" | "falhou";
  ambiente: string;
  papel: string;
  modelos: string[];
  repeticoes: number;
  resumo: {
    total: number;
    ok: number;
    falhas: number;
    erros: number;
    latencia_media_ms: number | null;
    custo_usd: number;
    tokens_in: number;
    tokens_out: number;
  } | null;
};
type Item = {
  id: string;
  caso_id: string;
  msg: string;
  modelo: string;
  repeticao: number;
  status: "pendente" | "rodando" | "ok" | "falhou" | "erro";
  latencia_ms: number | null;
  tokens_in: number | null;
  tokens_out: number | null;
  custo_usd: number | null;
  modelo_usado: string | null;
  detalhe: string | null;
  resposta_trecho: string | null;
};

const STATUS_ITEM: Record<Item["status"], { rotulo: string; cls: string }> = {
  pendente: { rotulo: "na fila", cls: "bg-muted text-muted-foreground" },
  rodando: { rotulo: "rodando", cls: "bg-[var(--info-bg)] text-[var(--info-text)]" },
  ok: { rotulo: "passou", cls: "bg-[var(--ok-bg)] text-[var(--ok-text)]" },
  falhou: { rotulo: "falhou", cls: "bg-[var(--danger-bg)] text-[var(--danger-text)]" },
  erro: { rotulo: "erro", cls: "bg-[var(--warn-bg)] text-[var(--warn-text)]" },
};

const STATUS_RUN: Record<Run["status"], { rotulo: string; cls: string }> = {
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

/** chip sólido da célula da matriz — a mesma gramática dos marcadores do
 *  app (fill de status + --status-foreground); pendente fica em contorno
 *  tracejado ("ainda não aconteceu") e rodando pulsa em --info. */
const CELULA: Record<Item["status"], string> = {
  pendente:
    "border border-dashed border-muted-foreground/50 text-muted-foreground",
  rodando: "bg-[var(--info)] text-[var(--status-foreground)] animate-pulse",
  ok: "bg-[var(--ok)] text-[var(--status-foreground)]",
  falhou: "bg-[var(--danger)] text-[var(--status-foreground)]",
  erro: "bg-[var(--warn)] text-[var(--status-foreground)]",
};

type FiltroItem = "todos" | "ok" | "falhou" | "erro";

const num = new Intl.NumberFormat("pt-BR");
const usd = (v: number | null) =>
  v == null ? "—" : v === 0 ? "US$ 0" : `US$ ${v.toFixed(4)}`;
const ms = (v: number | null) =>
  v == null ? "—" : v >= 1000 ? `${(v / 1000).toFixed(1)}s` : `${v}ms`;
const dataCurta = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
const diaCurta = (iso: string) =>
  new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
  });
const compacto = new Intl.NumberFormat("pt-BR", {
  notation: "compact",
  maximumFractionDigits: 1,
});
const stagger = (i: number) => ({ "--i": Math.min(i, 10) }) as CSSProperties;
/** leitura de uma execução pro title da célula (hover repete latência +
 *  tokens sem abrir o painel) */
const descItem = (i: Item) =>
  `rep ${i.repeticao}: ${STATUS_ITEM[i.status].rotulo} · ${ms(i.latencia_ms)} · ${num.format(i.tokens_in ?? 0)}+${num.format(i.tokens_out ?? 0)} tok · ${usd(i.custo_usd)}`;

function Chip({
  ativo,
  onClick,
  children,
}: {
  ativo?: boolean;
  onClick?: () => void;
  children: React.ReactNode;
}) {
  return (
    <Button
      type="button"
      variant={ativo ? "default" : "outline"}
      onClick={onClick}
      className={cn(
        "min-h-11 rounded-full px-3 text-xs sm:min-h-7",
        !ativo && "hover:bg-muted"
      )}
    >
      {children}
    </Button>
  );
}

export function IaEvals({ modelosSugeridos }: { modelosSugeridos: string[] }) {
  const [casos, setCasos] = useState<Caso[] | null>(null);
  const [runs, setRuns] = useState<Run[] | null>(null);
  const [detalhe, setDetalhe] = useState<{ run: Run; itens: Item[] } | null>(
    null
  );
  const [form, setForm] = useState({
    ambiente: "staging",
    papel: "staff" as "staff" | "mentorado",
    modelos: [] as string[],
    repeticoes: 1,
    casoIds: null as string[] | null, // null = todos do papel
    modeloInput: "",
  });
  const [erro, setErro] = useState<string | null>(null);
  const [criando, setCriando] = useState(false);
  const [driving, setDriving] = useState<string | null>(null);
  const parar = useRef(false);

  const carregarRuns = useCallback(async () => {
    const r = await fetch("/api/ia/evals");
    if (r.ok) setRuns((await r.json()).runs);
  }, []);
  const carregarDetalhe = useCallback(async (runId: string) => {
    const r = await fetch(`/api/ia/evals?run=${runId}`);
    if (r.ok) setDetalhe(await r.json());
  }, []);

  useEffect(() => {
    let vivo = true;
    fetch("/api/ia/evals?casos")
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (vivo && j) setCasos(j.casos);
      })
      .catch(() => {});
    fetch("/api/ia/evals")
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (vivo && j) setRuns(j.runs);
      })
      .catch(() => {});
    return () => {
      vivo = false;
    };
  }, []);

  // laço executor: uma request por item até a fila esvaziar — pausável,
  // retomável (os itens restantes ficam 'pendente' no run)
  const dirigir = useCallback(
    async (runId: string) => {
      if (driving) return;
      parar.current = false;
      setDriving(runId);
      try {
        for (;;) {
          if (parar.current) break;
          const r = await fetch("/api/ia/evals/executar", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ run_id: runId }),
          });
          const j = await r.json().catch(() => ({}));
          if (!r.ok) {
            setErro(j.error ?? "falha ao executar item");
            break;
          }
          if (j.item?.id)
            setDetalhe((d) =>
              d && d.run.id === runId
                ? {
                    ...d,
                    itens: d.itens.map((i) =>
                      i.id === j.item.id ? { ...i, status: j.item.status } : i
                    ),
                  }
                : d
            );
          if (j.feito) break;
        }
      } finally {
        setDriving(null);
        void carregarDetalhe(runId);
        void carregarRuns();
      }
    },
    [driving, carregarDetalhe, carregarRuns]
  );

  const casosFiltrados = (casos ?? []).filter(
    (c) => c.papel_esperado === "qualquer" || c.papel_esperado === form.papel
  );
  const casosEscolhidos = form.casoIds ?? casosFiltrados.map((c) => c.id);
  const totalGrade =
    casosEscolhidos.length * form.modelos.length * form.repeticoes;
  // grupos pelo prefixo do id ("live-hist-30d" → "live", "hist-*" → "hist")
  const gruposDeCasos = casosFiltrados.reduce<[string, Caso[]][]>(
    (grupos, c) => {
      const grupo = c.id.split("-")[0];
      const g = grupos.find(([nome]) => nome === grupo);
      if (g) g[1].push(c);
      else grupos.push([grupo, [c]]);
      return grupos;
    },
    []
  );

  const criar = async () => {
    setErro(null);
    setCriando(true);
    try {
      const r = await fetch("/api/ia/evals", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ambiente: form.ambiente,
          papel: form.papel,
          modelos: form.modelos,
          repeticoes: form.repeticoes,
          ...(form.casoIds
            ? { casoIds: form.casoIds }
            : {}),
        }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        setErro(j.error ?? "falha ao criar o run");
        return;
      }
      await carregarDetalhe(j.id);
      void dirigir(j.id);
    } finally {
      setCriando(false);
    }
  };

  const feitos = detalhe?.itens.filter(
    (i) => i.status === "ok" || i.status === "falhou" || i.status === "erro"
  ).length;

  return (
    <section aria-labelledby="titulo-evals" className="space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="titulo-evals" className="text-base font-semibold">
          Evals da Liza
        </h2>
        <span className="text-xs text-muted-foreground">
          casos × modelos × repetições · persiste no banco
        </span>
      </div>

      {/* form da grade */}
      <div className="rounded-xl border border-border bg-card p-4 sm:p-5">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-1.5">
            <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
              Ambiente
            </p>
            <div className="flex flex-wrap gap-1.5">
              {["local", "staging", "preview", "prod"].map((a) => (
                <Chip
                  key={a}
                  ativo={form.ambiente === a}
                  onClick={() => setForm({ ...form, ambiente: a })}
                >
                  {a}
                </Chip>
              ))}
            </div>
          </div>
          <div className="space-y-1.5">
            <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
              Papel da conta de teste
            </p>
            <div className="flex flex-wrap gap-1.5">
              {(["staff", "mentorado"] as const).map((p) => (
                <Chip
                  key={p}
                  ativo={form.papel === p}
                  onClick={() => setForm({ ...form, papel: p })}
                >
                  {p === "staff" ? "Staff" : "Mentorado"}
                </Chip>
              ))}
            </div>
            <p className="text-[11px] text-muted-foreground">
              conta do env:{" "}
              {form.papel === "mentorado"
                ? "EVAL_EMAIL_JOVEM"
                : "EVAL_EMAIL"}
            </p>
          </div>
          <div className="space-y-1.5">
            <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
              Repetições por caso
            </p>
            <Input
              type="number"
              min={1}
              max={10}
              value={form.repeticoes}
              onChange={(e) =>
                setForm({
                  ...form,
                  repeticoes: Math.max(
                    1,
                    Math.min(10, Number(e.target.value) || 1)
                  ),
                })
              }
              className="h-11 w-24 rounded-md border border-border bg-background px-3 text-base sm:h-9 sm:text-sm"
            />
          </div>
          <div className="space-y-1.5 sm:col-span-2 lg:col-span-1">
            <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
              Grade
            </p>
            <p className="text-sm font-medium tabular-nums">
              {totalGrade || "—"} execuções
              <span className="ml-1 font-normal text-muted-foreground">
                ({casosEscolhidos.length} × {form.modelos.length || 0} ×{" "}
                {form.repeticoes})
              </span>
            </p>
          </div>
        </div>

        <div className="mt-4 space-y-1.5">
          <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
            Modelos
          </p>
          <div className="flex flex-wrap items-center gap-1.5">
            {form.modelos.map((m) => (
              <Chip
                key={m}
                ativo
                onClick={() =>
                  setForm({
                    ...form,
                    modelos: form.modelos.filter((x) => x !== m),
                  })
                }
              >
                {m} ×
              </Chip>
            ))}
            <Input
              value={form.modeloInput}
              onChange={(e) =>
                setForm({ ...form, modeloInput: e.target.value })
              }
              onKeyDown={(e) => {
                if (e.key !== "Enter") return;
                const m = form.modeloInput.trim();
                if (m && !form.modelos.includes(m))
                  setForm({
                    ...form,
                    modelos: [...form.modelos, m],
                    modeloInput: "",
                  });
              }}
              placeholder="slug do modelo + Enter"
              className="h-11 min-w-44 flex-1 rounded-md border border-border bg-background px-3 text-base sm:h-9 sm:flex-none sm:text-sm"
            />
          </div>
          {modelosSugeridos.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-1">
              {modelosSugeridos
                .filter((m) => !form.modelos.includes(m))
                .map((m) => (
                  <Button
                    key={m}
                    type="button"
                    variant="outline"
                    onClick={() =>
                      setForm({ ...form, modelos: [...form.modelos, m] })
                    }
                    className="min-h-11 rounded-md border-dashed px-2 text-[11px] font-normal text-muted-foreground sm:min-h-7"
                  >
                    + {m}
                  </Button>
                ))}
            </div>
          )}
        </div>

        <div className="mt-4 space-y-1.5">
          <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
            Casos
          </p>
          {casos === null ? (
            <Skeleton className="h-11 w-56" />
          ) : !casosFiltrados.length ? (
            <p className="text-sm text-muted-foreground">
              Nenhum caso live pro papel {form.papel} no corpus
              (tests/evals/casos.json).
            </p>
          ) : (
            <Popover>
              <PopoverTrigger className="inline-flex min-h-11 items-center gap-2 rounded-md border border-border bg-card px-3 text-sm font-medium hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:min-h-9">
                {casosEscolhidos.length === casosFiltrados.length
                  ? `Todos os ${casosFiltrados.length} casos`
                  : `${casosEscolhidos.length} de ${casosFiltrados.length} casos`}
                <CaretDown size={14} aria-hidden className="text-muted-foreground" />
              </PopoverTrigger>
              <PopoverContent
                align="start"
                className="scroll-fina max-h-80 w-[min(26rem,calc(100vw-2rem))] overflow-y-auto p-0"
              >
                <div className="sticky top-0 flex items-center justify-between gap-2 border-b border-border/60 bg-popover px-3 py-2">
                  <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
                    {casosEscolhidos.length} de {casosFiltrados.length}
                  </span>
                  <span className="flex gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() =>
                        setForm({
                          ...form,
                          casoIds: casosFiltrados.map((c) => c.id),
                        })
                      }
                      className="min-h-9 px-2 text-xs sm:min-h-7"
                    >
                      Todas
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => setForm({ ...form, casoIds: [] })}
                      className="min-h-9 px-2 text-xs sm:min-h-7"
                    >
                      Nenhuma
                    </Button>
                  </span>
                </div>
                {gruposDeCasos.map(([grupo, itens]) => (
                  <div key={grupo}>
                    <p className="px-3 pt-2.5 pb-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                      {grupo}
                    </p>
                    <ul>
                      {itens.map((c) => {
                        const marcado = casosEscolhidos.includes(c.id);
                        return (
                          <li key={c.id}>
                            <label className="flex min-h-11 cursor-pointer items-center gap-3 px-3 py-1.5 hover:bg-muted/50">
                              <input
                                type="checkbox"
                                checked={marcado}
                                onChange={() => {
                                  const sel = new Set(casosEscolhidos);
                                  if (marcado) sel.delete(c.id);
                                  else sel.add(c.id);
                                  setForm({ ...form, casoIds: [...sel] });
                                }}
                                className="size-4 shrink-0 accent-primary"
                              />
                              <span className="min-w-0 flex-1">
                                <span className="block truncate text-sm font-medium">
                                  {c.msg}
                                </span>
                                <span className="text-[11px] text-muted-foreground">
                                  {c.id}
                                </span>
                              </span>
                            </label>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ))}
              </PopoverContent>
            </Popover>
          )}
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Button
            onClick={criar}
            disabled={criando || !totalGrade || driving !== null}
          >
            {criando ? "Criando…" : "Rodar eval"}
          </Button>
          {driving && (
            <Button
              variant="outline"
              onClick={() => {
                parar.current = true;
              }}
            >
              Pausar laço
            </Button>
          )}
          {erro && (
            <p role="alert" className="text-sm text-[var(--danger-text)]">
              {erro}
            </p>
          )}
        </div>
      </div>

      {/* histórico de runs + saúde do eval */}
      <FaixaRuns
        runs={runs}
        selecionado={detalhe?.run.id ?? null}
        driving={driving}
        onAbrir={(id) => void carregarDetalhe(id)}
        onContinuar={(id) => {
          void carregarDetalhe(id);
          void dirigir(id);
        }}
      />

      {/* detalhe do run aberto — remonta por run (a entrada animada roda de
          novo) e conserva estado interno durante as atualizações do laço */}
      {detalhe && (
        <DetalheRun
          key={detalhe.run.id}
          run={detalhe.run}
          itens={detalhe.itens}
          feitos={feitos ?? 0}
          driving={driving === detalhe.run.id}
          bloqueado={driving !== null && driving !== detalhe.run.id}
          onContinuar={() => void dirigir(detalhe.run.id)}
          onPausar={() => {
            parar.current = true;
          }}
        />
      )}
    </section>
  );
}

/** Card de KPI do run aberto — número grande tabular + meta embaixo,
 *  entrada com stagger (--i). */
function Kpi({
  rotulo,
  valor,
  meta,
  i,
}: {
  rotulo: string;
  valor: string;
  meta?: string;
  i: number;
}) {
  return (
    <div
      className="animate-enter rounded-xl border border-border bg-card p-3 sm:p-4"
      style={stagger(i)}
    >
      <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
        {rotulo}
      </p>
      <p className="mt-1 text-xl font-semibold tabular-nums tracking-tight sm:text-2xl">
        {valor}
      </p>
      {meta && <p className="mt-0.5 text-xs text-muted-foreground">{meta}</p>}
    </div>
  );
}

/** Faixa de runs: sparkline do pass rate ao longo do tempo (a saúde do
 *  eval) + cards compactos selecionáveis. O run aberto ganha ring; run não
 *  concluído oferece Continuar — o laço é global, um run por vez. */
function FaixaRuns({
  runs,
  selecionado,
  driving,
  onAbrir,
  onContinuar,
}: {
  runs: Run[] | null;
  selecionado: string | null;
  driving: string | null;
  onAbrir: (id: string) => void;
  onContinuar: (id: string) => void;
}) {
  if (!runs?.length) return null;
  // a API devolve desc — o eixo do tempo cresce pra direita, então inverte
  const ultimos = runs.slice(0, 14).reverse();
  const serie = ultimos.map((r) =>
    r.resumo && r.resumo.total > 0
      ? Math.round((r.resumo.ok / r.resumo.total) * 100)
      : null
  );
  const passoRotulo = Math.max(1, Math.ceil(ultimos.length / 7));
  const labelsX = ultimos.map((r, i) =>
    i % passoRotulo === 0 || i === ultimos.length - 1
      ? diaCurta(r.created_at)
      : ""
  );
  return (
    <div className="rounded-xl border border-border bg-card p-4 sm:p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-base font-semibold">Runs recentes</h3>
        <span className="text-xs tabular-nums text-muted-foreground">
          {runs.length} {runs.length === 1 ? "run" : "runs"}
        </span>
      </div>

      {ultimos.length > 1 && serie.some((v) => v != null) && (
        <div className="mt-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            Pass rate ao longo do tempo
          </p>
          <Sparkline
            className="mt-1"
            series={[
              { valores: serie, rotulo: "pass rate", cor: "var(--chart-1)" },
            ]}
            min={0}
            max={100}
            labelsX={labelsX}
            atencaoAbaixoDe={50}
            altura={90}
            formatarValor={(v) => `${Math.round(v)}%`}
          />
        </div>
      )}

      <ul className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {runs.map((r, idx) => {
          const sel = r.id === selecionado;
          const res = r.resumo;
          const naFila = res
            ? res.total - res.ok - res.falhas - res.erros
            : 0;
          return (
            <li
              key={r.id}
              style={stagger(idx)}
              className={cn(
                "animate-enter overflow-hidden rounded-xl border bg-card transition-[border-color,box-shadow] duration-200 ease-snappy",
                sel ? "border-transparent ring-2 ring-ring" : "border-border"
              )}
            >
              <Button
                type="button"
                variant="ghost"
                onClick={() => onAbrir(r.id)}
                aria-current={sel || undefined}
                className="h-auto w-full flex-col items-stretch gap-1.5 rounded-none px-3 py-2.5 text-left font-normal whitespace-normal hover:bg-muted/40"
              >
                <span className="flex items-baseline justify-between gap-2">
                  <span className="text-sm font-medium">
                    {dataCurta(r.created_at)}
                  </span>
                  <span className="shrink-0 text-[11px] text-muted-foreground">
                    {r.ambiente} · {r.papel === "staff" ? "Staff" : "Mentorado"}
                  </span>
                </span>
                <span
                  className="truncate text-xs text-muted-foreground"
                  title={r.modelos.join(", ")}
                >
                  {r.modelos.join(", ")} · {r.repeticoes}× por caso
                </span>
                {res ? (
                  <>
                    <BarraSegmentada
                      className="mt-0.5"
                      altura="sm"
                      denominador={res.total}
                      segmentos={[
                        {
                          valor: res.ok,
                          rotulo: "passou",
                          cls: "bg-[var(--ok)]",
                        },
                        {
                          valor: res.falhas,
                          rotulo: "falhou",
                          cls: "bg-[var(--danger)]",
                        },
                        {
                          valor: res.erros,
                          rotulo: "erro",
                          cls: "bg-[var(--warn)]",
                        },
                        { valor: naFila, rotulo: "na fila" },
                      ]}
                    />
                    <span className="mt-1 flex items-baseline justify-between gap-2">
                      <span className="text-sm font-semibold tabular-nums">
                        {res.total > 0
                          ? `${Math.round((res.ok / res.total) * 100)}%`
                          : "—"}
                        <span className="ml-1 text-xs font-normal text-muted-foreground">
                          passou
                        </span>
                      </span>
                      <span className="text-xs tabular-nums text-muted-foreground">
                        {ms(res.latencia_media_ms)} · {usd(res.custo_usd)}
                      </span>
                    </span>
                  </>
                ) : (
                  <span className="mt-0.5 flex items-center gap-1.5">
                    <span
                      className={cn(
                        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium",
                        STATUS_RUN[r.status].cls
                      )}
                    >
                      {r.status === "rodando" && (
                        <CircleNotch
                          size={11}
                          aria-hidden
                          className="animate-spin"
                        />
                      )}
                      {STATUS_RUN[r.status].rotulo}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      sem resumo ainda
                    </span>
                  </span>
                )}
              </Button>
              {r.status !== "concluido" && (
                <div className="border-t border-border/60 px-2 py-1.5">
                  {driving === r.id ? (
                    <span
                      role="status"
                      className="flex min-h-7 items-center justify-center gap-1.5 text-xs font-medium text-[var(--info-text)]"
                    >
                      <CircleNotch
                        size={12}
                        aria-hidden
                        className="animate-spin"
                      />
                      rodando…
                    </span>
                  ) : (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={driving !== null}
                      onClick={() => onContinuar(r.id)}
                      className="w-full text-xs"
                    >
                      <Play aria-hidden />
                      Continuar
                    </Button>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** Detalhe do run aberto — o painel high-end: faixa-herói com progresso e
 *  composição (BarraSegmentada grande), 4 KPIs, e a matriz caso × modelo
 *  com células clicáveis, painel de detalhe inline (um por vez), filtro por
 *  status e resumo por modelo no rodapé. O laço atualiza só o status dos
 *  itens: os chips mudam de cor com um pop e as barras interpolam. */
function DetalheRun({
  run,
  itens,
  feitos,
  driving,
  bloqueado,
  onContinuar,
  onPausar,
}: {
  run: Run;
  itens: Item[];
  feitos: number;
  driving: boolean;
  bloqueado: boolean;
  onContinuar: () => void;
  onPausar: () => void;
}) {
  const painelId = useId();
  const [filtro, setFiltro] = useState<FiltroItem>("todos");
  const [aberto, setAberto] = useState<{
    caso: string;
    modelo: string;
  } | null>(null);

  // (a animação de troca de status mora no chip: a key `id:status` remonta
  // só o chip que mudou e o .ia-pop do globals dá o pop — zero bookkeeping)

  const stats = useMemo(() => {
    const por = (s: Item["status"]) =>
      itens.filter((i) => i.status === s).length;
    const lats = itens
      .map((i) => i.latencia_ms)
      .filter((v): v is number => v != null)
      .sort((a, b) => a - b);
    const soma = (k: "tokens_in" | "tokens_out" | "custo_usd") =>
      itens.reduce((acc, i) => acc + (i[k] ?? 0), 0);
    return {
      total: itens.length,
      ok: por("ok"),
      falhas: por("falhou"),
      erros: por("erro"),
      rodando: por("rodando"),
      naFila: por("pendente"),
      latMedia: lats.length
        ? lats.reduce((a, b) => a + b, 0) / lats.length
        : null,
      p95: lats.length
        ? lats[Math.min(lats.length - 1, Math.ceil(lats.length * 0.95) - 1)]
        : null,
      tokensIn: soma("tokens_in"),
      tokensOut: soma("tokens_out"),
      custo: soma("custo_usd"),
    };
  }, [itens]);

  // casos e modelos na ordem da grade (itens vêm ordenados por id = ordem
  // de criação do produto cartesiano)
  const casosOrdem = useMemo(() => {
    const vistos = new Map<string, string>();
    for (const i of itens) if (!vistos.has(i.caso_id)) vistos.set(i.caso_id, i.msg);
    return [...vistos].map(([id, msg]) => ({ id, msg }));
  }, [itens]);
  const modelosOrdem = useMemo(() => {
    const vistos = new Set<string>();
    for (const i of itens) vistos.add(i.modelo);
    return [...vistos];
  }, [itens]);
  const grade = useMemo(() => {
    const m = new Map<string, Item[]>();
    for (const i of itens) {
      const k = `${i.caso_id}§${i.modelo}`;
      const arr = m.get(k) ?? [];
      arr.push(i);
      m.set(k, arr);
    }
    return m;
  }, [itens]);
  const porModelo = useMemo(() => {
    const acc = new Map<
      string,
      { n: number; ok: number; falhou: number; erro: number; lats: number[] }
    >();
    for (const i of itens) {
      const e = acc.get(i.modelo) ?? {
        n: 0,
        ok: 0,
        falhou: 0,
        erro: 0,
        lats: [],
      };
      e.n++;
      if (i.status === "ok") e.ok++;
      else if (i.status === "falhou") e.falhou++;
      else if (i.status === "erro") e.erro++;
      if (i.latencia_ms != null) e.lats.push(i.latencia_ms);
      acc.set(i.modelo, e);
    }
    return acc;
  }, [itens]);

  const bate = (i: Item) => filtro === "todos" || i.status === filtro;
  const celula = (casoId: string, modelo: string) =>
    grade.get(`${casoId}§${modelo}`) ?? [];

  return (
    <div className="space-y-3">
      {/* faixa-herói: título, ações, progresso fino e composição por status */}
      <div className="animate-enter rounded-xl border border-border bg-card p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="min-w-0">
            <h3 className="text-base font-semibold">
              Run de {dataCurta(run.created_at)}
              <span className="font-normal text-muted-foreground">
                {" "}
                · {run.ambiente} · {run.papel === "staff" ? "Staff" : "Mentorado"}
              </span>
            </h3>
            <p
              className="mt-0.5 truncate text-xs text-muted-foreground"
              title={run.modelos.join(", ")}
            >
              {run.modelos.join(", ")} · {run.repeticoes}× por caso
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span
              role="status"
              aria-live="polite"
              className="flex items-center gap-1.5 text-xs tabular-nums text-muted-foreground"
            >
              {driving && (
                <CircleNotch size={12} aria-hidden className="animate-spin" />
              )}
              {feitos}/{stats.total}
              {driving
                ? " · rodando…"
                : run.status !== "concluido"
                  ? ` · ${STATUS_RUN[run.status].rotulo}`
                  : ""}
            </span>
            {driving ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onPausar}
              >
                <Pause aria-hidden />
                Pausar
              </Button>
            ) : run.status !== "concluido" ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onContinuar}
                disabled={bloqueado}
              >
                <Play aria-hidden />
                Continuar
              </Button>
            ) : null}
          </div>
        </div>

        <div
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={stats.total}
          aria-valuenow={feitos}
          aria-label="Itens executados"
          className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted"
        >
          <div
            className="relative h-full bg-primary transition-[width] duration-500 ease-snappy"
            style={{
              width: `${stats.total ? (feitos / stats.total) * 100 : 0}%`,
            }}
          >
            {driving && (
              <span
                aria-hidden
                className="absolute inset-0 animate-shimmer bg-[linear-gradient(90deg,transparent_30%,hsl(0_0%_100%/0.5)_50%,transparent_70%)] bg-[length:200%_100%]"
              />
            )}
          </div>
        </div>

        <BarraSegmentada
          className="mt-3"
          altura="lg"
          legenda
          animate
          denominador={stats.total}
          segmentos={[
            { valor: stats.ok, rotulo: "passou", cls: "bg-[var(--ok)]" },
            { valor: stats.falhas, rotulo: "falhou", cls: "bg-[var(--danger)]" },
            { valor: stats.erros, rotulo: "erro", cls: "bg-[var(--warn)]" },
            { valor: stats.rodando, rotulo: "rodando", cls: "bg-[var(--info)]" },
            { valor: stats.naFila, rotulo: "na fila" },
          ]}
        />
      </div>

      {/* KPIs do run aberto */}
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        <Kpi
          i={1}
          rotulo="Pass rate"
          valor={
            stats.total
              ? `${Math.round((stats.ok / stats.total) * 100)}%`
              : "—"
          }
          meta={`${stats.ok} de ${stats.total} itens`}
        />
        <Kpi
          i={2}
          rotulo="Latência média"
          valor={ms(stats.latMedia)}
          meta={stats.p95 != null ? `p95 ${ms(stats.p95)}` : undefined}
        />
        <Kpi
          i={3}
          rotulo="Tokens"
          valor={compacto.format(stats.tokensIn + stats.tokensOut)}
          meta={`${compacto.format(stats.tokensIn)} entrada · ${compacto.format(stats.tokensOut)} saída`}
        />
        <Kpi
          i={4}
          rotulo="Custo"
          valor={usd(stats.custo)}
          meta={
            feitos > 0 ? `${usd(stats.custo / feitos)} por item` : undefined
          }
        />
      </div>

      {/* matriz caso × modelo */}
      <div
        className="animate-enter rounded-xl border border-border bg-card p-4 sm:p-5"
        style={stagger(5)}
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-base font-semibold">Casos × modelos</h3>
          <div
            className="flex flex-wrap gap-1.5"
            role="group"
            aria-label="Filtrar itens por status"
          >
            {(
              [
                ["todos", "Todos", stats.total],
                ["ok", "Passou", stats.ok],
                ["falhou", "Falhou", stats.falhas],
                ["erro", "Erro", stats.erros],
              ] as const
            ).map(([f, rotulo, n]) => (
              <Chip
                key={f}
                ativo={filtro === f}
                onClick={() => setFiltro(f)}
              >
                {rotulo} {n}
              </Chip>
            ))}
          </div>
        </div>

        {!casosOrdem.length ? (
          <p className="mt-3 text-sm text-muted-foreground">
            Sem itens neste run.
          </p>
        ) : (
          <div className="scroll-fina -mx-4 mt-2 overflow-x-auto px-4 pb-1 sm:-mx-5 sm:px-5">
            <table className="w-full min-w-[34rem] border-separate [border-spacing:0_5px]">
              <thead>
                <tr>
                  <th
                    scope="col"
                    className="sticky left-0 z-10 w-[12rem] min-w-[12rem] max-w-[12rem] bg-card py-1 pr-3 text-left align-bottom text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground"
                  >
                    caso
                  </th>
                  {modelosOrdem.map((m) => (
                    <th
                      key={m}
                      scope="col"
                      title={m}
                      className="min-w-[4.5rem] py-1 text-center align-bottom text-[11px] font-semibold text-muted-foreground"
                    >
                      <span className="mx-auto block max-w-[9rem] truncate">
                        {m}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              {/* re-key no filtro: a troca remonta as linhas e re-roda o
                  stagger de entrada, nunca um repaint seco de tabela */}
              <tbody key={filtro}>
                {casosOrdem.map((c, ri) => {
                  const algumBate = itens.some(
                    (i) => i.caso_id === c.id && bate(i)
                  );
                  return (
                    <Fragment key={c.id}>
                      <tr className="animate-enter" style={stagger(ri)}>
                        <th
                          scope="row"
                          className={cn(
                            "sticky left-0 z-10 bg-card py-1 pr-3 text-left align-middle transition-opacity duration-300",
                            !algumBate && "opacity-40"
                          )}
                        >
                          <span
                            className="block truncate text-xs font-medium"
                            title={c.msg}
                          >
                            {c.msg}
                          </span>
                          <span className="block truncate text-[11px] text-muted-foreground">
                            {c.id}
                          </span>
                        </th>
                        {modelosOrdem.map((m) => {
                          const its = celula(c.id, m);
                          const expandida =
                            aberto?.caso === c.id && aberto?.modelo === m;
                          return (
                            <td key={m} className="p-0 align-middle">
                              {its.length ? (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  aria-expanded={expandida}
                                  aria-controls={
                                    expandida ? painelId : undefined
                                  }
                                  aria-label={`${c.id}, modelo ${m}: ${its
                                    .map(
                                      (i) =>
                                        `rep ${i.repeticao} ${STATUS_ITEM[i.status].rotulo}`
                                    )
                                    .join(", ")}`}
                                  title={its.map(descItem).join("\n")}
                                  onClick={() =>
                                    setAberto(
                                      expandida
                                        ? null
                                        : { caso: c.id, modelo: m }
                                    )
                                  }
                                  className={cn(
                                    "h-auto min-h-9 w-full justify-center gap-1 rounded-md px-1 py-1",
                                    expandida &&
                                      "bg-muted shadow-[inset_0_0_0_1px_var(--ring)]"
                                  )}
                                >
                                  {its.map((i) => (
                                    <span
                                      key={`${i.id}:${i.status}`}
                                      aria-hidden
                                      className={cn(
                                        "ia-pop inline-flex size-5 items-center justify-center rounded-[5px] text-[10px] leading-none font-bold transition-[opacity,background-color,border-color] duration-300",
                                        CELULA[i.status],
                                        filtro !== "todos" &&
                                          i.status !== filtro &&
                                          "opacity-25"
                                      )}
                                    >
                                      {its.length > 1 ? i.repeticao : ""}
                                    </span>
                                  ))}
                                </Button>
                              ) : (
                                <span
                                  aria-hidden
                                  className="block text-center text-muted-foreground/30"
                                >
                                  ·
                                </span>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                      {aberto?.caso === c.id && (
                        <tr>
                          <td
                            colSpan={modelosOrdem.length + 1}
                            className="p-0 pb-1"
                          >
                            <div
                              id={painelId}
                              role="region"
                              aria-label={`Detalhe: ${aberto.modelo} em ${aberto.caso}`}
                              className="animate-enter rounded-lg border border-border/70 bg-muted/30 px-3 py-2.5"
                            >
                              <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                                {aberto.modelo} · {c.msg}
                              </p>
                              <ul className="mt-1.5 space-y-2.5">
                                {celula(aberto.caso, aberto.modelo).map((i) => {
                                  const s = STATUS_ITEM[i.status];
                                  return (
                                    <li
                                      key={i.id}
                                      className="border-t border-border/50 pt-2 first:border-t-0 first:pt-0"
                                    >
                                      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                                        <span
                                          className={cn(
                                            "rounded-full px-2 py-0.5 text-[10px] font-medium",
                                            s.cls
                                          )}
                                        >
                                          {s.rotulo}
                                        </span>
                                        <span className="text-xs font-medium">
                                          rep {i.repeticao}
                                          {i.modelo_usado &&
                                            i.modelo_usado !== i.modelo && (
                                              <span className="font-normal text-muted-foreground">
                                                {" "}
                                                · usado {i.modelo_usado}
                                              </span>
                                            )}
                                        </span>
                                        <span className="text-xs tabular-nums text-muted-foreground">
                                          {ms(i.latencia_ms)} ·{" "}
                                          {num.format(i.tokens_in ?? 0)}+
                                          {num.format(i.tokens_out ?? 0)} tok ·{" "}
                                          {usd(i.custo_usd)}
                                        </span>
                                      </div>
                                      {i.detalhe && (
                                        <p
                                          className={cn(
                                            "mt-1 text-xs",
                                            i.status === "falhou" ||
                                              i.status === "erro"
                                              ? "text-[var(--danger-text)]"
                                              : "text-muted-foreground"
                                          )}
                                        >
                                          {i.detalhe}
                                        </p>
                                      )}
                                      {i.resposta_trecho && (
                                        <p className="mt-1 border-l-2 border-border pl-2 text-xs leading-relaxed whitespace-pre-wrap text-muted-foreground">
                                          {i.resposta_trecho}
                                        </p>
                                      )}
                                    </li>
                                  );
                                })}
                              </ul>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
              <tfoot>
                <tr>
                  <th
                    scope="row"
                    className="sticky left-0 z-10 border-t border-border/60 bg-card py-2 pr-3 text-left align-top text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground"
                  >
                    por modelo
                  </th>
                  {modelosOrdem.map((m) => {
                    const e = porModelo.get(m);
                    const media =
                      e && e.lats.length
                        ? e.lats.reduce((a, b) => a + b, 0) / e.lats.length
                        : null;
                    return (
                      <td
                        key={m}
                        className="border-t border-border/60 px-1 py-2 text-center align-top"
                      >
                        <p className="text-xs font-semibold tabular-nums">
                          {e && e.n
                            ? `${Math.round((e.ok / e.n) * 100)}%`
                            : "—"}
                        </p>
                        <BarraSegmentada
                          className="mt-1"
                          altura="sm"
                          denominador={e?.n ?? 0}
                          segmentos={[
                            {
                              valor: e?.ok ?? 0,
                              rotulo: "passou",
                              cls: "bg-[var(--ok)]",
                            },
                            {
                              valor: e?.falhou ?? 0,
                              rotulo: "falhou",
                              cls: "bg-[var(--danger)]",
                            },
                            {
                              valor: e?.erro ?? 0,
                              rotulo: "erro",
                              cls: "bg-[var(--warn)]",
                            },
                          ]}
                        />
                        <p className="mt-1 text-[11px] tabular-nums text-muted-foreground">
                          {ms(media)}
                        </p>
                      </td>
                    );
                  })}
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
