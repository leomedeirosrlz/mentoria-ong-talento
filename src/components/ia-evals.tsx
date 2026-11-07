"use client";

// Evals persistidos da Liza (0164): a coordenação monta a grade
// casos × modelos × repetições aqui no /ia e o laço executa um item por
// request (POST /executar) — progresso ao vivo, retomável se a aba fechar.
// Métricas (latência, tokens, custo) vêm do evento 'resposta' do chat.

import { useCallback, useEffect, useRef, useState } from "react";
import { CaretDown } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";

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

      {/* runs recentes */}
      {runs && runs.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-4 sm:p-5">
          <h3 className="text-sm font-semibold">Runs recentes</h3>
          <ul className="mt-2 divide-y divide-border/60">
            {runs.map((r) => (
              <li
                key={r.id}
                className="flex flex-wrap items-baseline gap-x-3 py-2.5"
              >
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => void carregarDetalhe(r.id)}
                  className="h-auto min-w-0 flex-1 justify-start p-0 text-left font-normal hover:bg-transparent"
                >
                  <span className="text-sm font-medium">
                    {dataCurta(r.created_at)} · {r.ambiente} ·{" "}
                    {r.papel === "staff" ? "Staff" : "Mentorado"}
                  </span>
                  <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                    {r.modelos.join(", ")} · {r.repeticoes}×
                  </span>
                </Button>
                <span className="text-xs tabular-nums text-muted-foreground">
                  {r.resumo
                    ? `${r.resumo.ok}/${r.resumo.total} ok · ${ms(r.resumo.latencia_media_ms)} · ${usd(r.resumo.custo_usd)}`
                    : r.status}
                </span>
                {r.status !== "concluido" && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      void carregarDetalhe(r.id);
                      void dirigir(r.id);
                    }}
                    className="min-h-11 px-2 text-xs sm:min-h-7"
                  >
                    Continuar
                  </Button>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* detalhe do run */}
      {detalhe && (
        <div className="rounded-xl border border-border bg-card p-4 sm:p-5">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="text-sm font-semibold">
              Run {dataCurta(detalhe.run.created_at)} · {detalhe.run.ambiente}
            </h3>
            <span className="text-xs tabular-nums text-muted-foreground">
              {feitos}/{detalhe.itens.length}
              {driving === detalhe.run.id ? " · rodando…" : ""}
            </span>
          </div>
          <div
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={detalhe.itens.length}
            aria-valuenow={feitos}
            className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted"
          >
            <div
              className="h-full bg-primary transition-all"
              style={{
                width: `${detalhe.itens.length ? (feitos! / detalhe.itens.length) * 100 : 0}%`,
              }}
            />
          </div>
          <ul className="mt-3 divide-y divide-border/60">
            {[...new Set(detalhe.itens.map((i) => i.caso_id))].map(
              (casoId) => (
                <li key={casoId} className="py-2.5">
                  <p className="text-sm font-medium">
                    {detalhe.itens.find((i) => i.caso_id === casoId)?.msg}
                  </p>
                  <p className="text-[11px] text-muted-foreground">{casoId}</p>
                  <ul className="mt-1.5 space-y-1">
                    {detalhe.itens
                      .filter((i) => i.caso_id === casoId)
                      .map((i) => {
                        const s = STATUS_ITEM[i.status];
                        return (
                          <li
                            key={i.id}
                            className="flex flex-wrap items-baseline gap-x-3 text-xs"
                          >
                            <span
                              className={cn(
                                "rounded-full px-2 py-0.5 text-[10px] font-medium",
                                s.cls
                              )}
                            >
                              {s.rotulo}
                            </span>
                            <span className="font-medium">
                              {i.modelo}
                              {i.modelo_usado && i.modelo_usado !== i.modelo && (
                                <span className="text-muted-foreground">
                                  {" "}
                                  → {i.modelo_usado}
                                </span>
                              )}
                            </span>
                            <span className="text-muted-foreground">
                              rep {i.repeticao}
                            </span>
                            <span className="tabular-nums text-muted-foreground">
                              {ms(i.latencia_ms)} ·{" "}
                              {num.format(i.tokens_in ?? 0)}+{num.format(i.tokens_out ?? 0)} tok · {usd(i.custo_usd)}
                            </span>
                            {(i.detalhe || i.resposta_trecho) && (
                              <span
                                className="min-w-0 flex-1 truncate text-muted-foreground"
                                title={i.detalhe ?? i.resposta_trecho ?? ""}
                              >
                                {i.detalhe ?? i.resposta_trecho}
                              </span>
                            )}
                          </li>
                        );
                      })}
                  </ul>
                </li>
              )
            )}
          </ul>
        </div>
      )}
    </section>
  );
}
