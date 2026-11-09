"use client";

// Persisted evals of the Liza (0164) — the /ia panel for coordination.
// A run = casos × modelos × repetições; the drive loop executes one item
// per request (POST /executar) and each answer carries the full item
// payload, so KPIs, cost and the matrix move item by item without a
// refetch. Before every POST, GET ?proximo returns the exact item the
// claim will pick (same order by id) — the cell pulses optimistically.
// The run is resumable (pending items live in the bank) and ?eval=<id>
// deep-links straight into a run. Blocks live in ./ia-evals/*.

import { useCallback, useEffect, useRef, useState } from "react";
import { Flask, Info, Plus } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { HistoricoRuns } from "./ia-evals/historico";
import { NovoRunDialog, type FormGrade } from "./ia-evals/novo-run";
import { DetalheRun } from "./ia-evals/detalhe";
import type {
  Caso,
  Item,
  ProximoItem,
  Run,
  RunDetalhe,
} from "./ia-evals/tipos";

type Detalhe = { run: RunDetalhe; itens: Item[] };

const COMO_CALCULAMOS = [
  {
    termo: "O que um run testa",
    texto:
      "Uma grade casos × modelos × repetições. Cada célula é uma pergunta real ao chat da Liza, com a conta de teste do papel escolhido; a repetição mede a variância do modelo.",
  },
  {
    termo: "Status dos itens",
    texto:
      "Na fila → rodando → passou, falhou ou erro. Falhou é a rubrica reprovada (tool errada, trecho proibido na resposta). Erro é infra (HTTP ou stream quebrado): vale reexecutar e não conta como erro de raciocínio do modelo.",
  },
  {
    termo: "Rubrica",
    texto:
      "Cada caso do corpus declara as ferramentas que a Liza deve chamar, as que não pode e os trechos obrigatórios ou proibidos na resposta. O checklist do item mostra cada um com ✓ ou ✗.",
  },
  {
    termo: "Latência, tokens e custo",
    texto:
      "A latência cobre a pergunta inteira (modelo + ferramentas). Tokens e custo vêm do evento 'resposta' que a própria request do chat grava, correlacionado pelo id da request.",
  },
  {
    termo: "Retomável",
    texto:
      "Os itens pendentes ficam no banco: fechar a aba não perde nada. Continuar retoma de onde parou e Reexecutar falhas devolve só os itens com falha ou erro pra fila.",
  },
];

export function IaEvals({ modelosSugeridos }: { modelosSugeridos: string[] }) {
  const [casos, setCasos] = useState<Caso[] | null>(null);
  const [runs, setRuns] = useState<Run[] | null>(null);
  const [detalhe, setDetalhe] = useState<Detalhe | null>(null);
  const [form, setForm] = useState<FormGrade>({
    ambiente: "staging",
    papel: "staff",
    modelos: [],
    repeticoes: 1,
    casoIds: null,
    modeloInput: "",
  });
  const [dialogAberto, setDialogAberto] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [criando, setCriando] = useState(false);
  const [driving, setDriving] = useState<string | null>(null);
  const [atual, setAtual] = useState<ProximoItem | null>(null);
  const [feed, setFeed] = useState<Item[]>([]);
  // runId that just closed inside this session — the close-out moment
  const [fechado, setFechado] = useState<string | null>(null);
  const [limpando, setLimpando] = useState(false);
  const [reexecutando, setReexecutando] = useState(false);
  const [apagando, setApagando] = useState(false);
  const parar = useRef(false);
  // ref twin of `driving`: the loop body reads it, the state renders it
  const dirigindo = useRef<string | null>(null);

  // ?eval=<id> via replaceState — never router.push (no server re-render)
  const escreverEvalUrl = useCallback((id: string | null) => {
    const url = new URL(window.location.href);
    if (id) url.searchParams.set("eval", id);
    else url.searchParams.delete("eval");
    // evals live on their own tab — the deep link stays coherent
    url.searchParams.set("aba", "evals");
    window.history.replaceState(null, "", url);
  }, []);

  const carregarRuns = useCallback(async () => {
    const r = await fetch("/api/ia/evals");
    if (r.ok) setRuns((await r.json()).runs);
  }, []);

  const carregarDetalhe = useCallback(
    async (runId: string) => {
      const r = await fetch(`/api/ia/evals?run=${runId}`);
      if (!r.ok) return false;
      setDetalhe(await r.json());
      escreverEvalUrl(runId);
      return true;
    },
    [escreverEvalUrl]
  );

  const abrirRun = useCallback(
    (id: string) => {
      setFechado(null);
      setFeed([]);
      return carregarDetalhe(id);
    },
    [carregarDetalhe]
  );

  const fecharDetalhe = useCallback(() => {
    setDetalhe(null);
    setFeed([]);
    setFechado(null);
    escreverEvalUrl(null);
  }, [escreverEvalUrl]);

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
        // deep-link: open the run pointed by ?eval=<id>
        const ev = new URLSearchParams(window.location.search).get("eval");
        if (ev) void carregarDetalhe(ev);
      })
      .catch(() => {});
    return () => {
      vivo = false;
    };
  }, [carregarDetalhe]);

  const limparHistorico = useCallback(async () => {
    setLimpando(true);
    setErro(null);
    try {
      const r = await fetch("/api/ia/evals", { method: "DELETE" });
      if (!r.ok) {
        const j = await r.json().catch(() => null);
        setErro(j?.error ?? "Não consegui limpar os resultados.");
        return false;
      }
      setRuns([]);
      fecharDetalhe();
      return true;
    } finally {
      setLimpando(false);
    }
  }, [fecharDetalhe]);

  const apagarRun = useCallback(
    async (runId: string) => {
      setApagando(true);
      setErro(null);
      try {
        const r = await fetch(`/api/ia/evals?run=${runId}`, {
          method: "DELETE",
        });
        if (!r.ok) {
          const j = await r.json().catch(() => null);
          setErro(j?.error ?? "Não consegui apagar o run.");
          return false;
        }
        setRuns((rs) => rs?.filter((x) => x.id !== runId) ?? rs);
        if (detalhe?.run.id === runId) fecharDetalhe();
        return true;
      } finally {
        setApagando(false);
      }
    },
    [detalhe?.run.id, fecharDetalhe]
  );

  /** The drive loop: one POST per item until the queue empties — pausable
   *  (parar ref between iterations) and resumable. `?proximo` marks the
   *  exact in-flight cell before the claim, then the item payload patches
   *  the state (no refetch per item). */
  const dirigir = useCallback(
    async (runId: string) => {
      if (dirigindo.current) return;
      parar.current = false;
      dirigindo.current = runId;
      setDriving(runId);
      setFechado(null);
      setFeed([]);
      try {
        for (;;) {
          if (parar.current) break;
          let prox: ProximoItem | null = null;
          try {
            const rp = await fetch(`/api/ia/evals?proximo=${runId}`);
            if (rp.ok) prox = ((await rp.json()).proximo ?? null) as ProximoItem | null;
          } catch {
            /* optimism is best-effort — the POST below still drives */
          }
          if (parar.current) break;
          setAtual(prox);
          if (prox) {
            const pid = prox.id;
            setDetalhe((d) =>
              d && d.run.id === runId
                ? {
                    ...d,
                    itens: d.itens.map((i) =>
                      i.id === pid ? { ...i, status: "rodando" as const } : i
                    ),
                  }
                : d
            );
          }
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
          if (j.item?.id) {
            const pronto = j.item as Partial<Item> & { id: string };
            setFeed((f) =>
              [pronto as Item, ...f.filter((x) => x.id !== pronto.id)].slice(0, 6)
            );
            setDetalhe((d) =>
              d && d.run.id === runId
                ? {
                    ...d,
                    itens: d.itens.map((i) =>
                      i.id === pronto.id ? { ...i, ...pronto } : i
                    ),
                  }
                : d
            );
          }
          if (j.feito) {
            setFechado(runId);
            break;
          }
        }
      } finally {
        dirigindo.current = null;
        setDriving(null);
        setAtual(null);
        void carregarDetalhe(runId);
        void carregarRuns();
      }
    },
    [carregarDetalhe, carregarRuns]
  );

  /** PATCH — failed/error/zombie items back to pendente and the run
   *  reopens 'rodando'; the loop resumes right after. */
  const reexecutar = useCallback(
    async (runId: string) => {
      if (dirigindo.current) return;
      setReexecutando(true);
      setErro(null);
      try {
        const r = await fetch("/api/ia/evals", {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ run_id: runId }),
        });
        const j = await r.json().catch(() => ({}));
        if (!r.ok) {
          setErro(j.error ?? "Não consegui reagendar as falhas.");
          return;
        }
        // mirror of the server reset — clean result, back to the queue
        setDetalhe((d) =>
          d && d.run.id === runId
            ? {
                run: { ...d.run, status: "rodando" as const },
                itens: d.itens.map((i) =>
                  i.status === "falhou" ||
                  i.status === "erro" ||
                  i.status === "rodando"
                    ? {
                        ...i,
                        status: "pendente" as const,
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
                      }
                    : i
                ),
              }
            : d
        );
        setFechado(null);
        void dirigir(runId);
      } finally {
        setReexecutando(false);
      }
    },
    [dirigir]
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
          ...(form.casoIds ? { casoIds: form.casoIds } : {}),
        }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        setErro(j.error ?? "falha ao criar o run");
        return;
      }
      setDialogAberto(false);
      void carregarRuns();
      await abrirRun(j.id);
      void dirigir(j.id);
    } finally {
      setCriando(false);
    }
  };

  /** "Repetir esta grade" — the list payload has no casos, so the caso
   *  ids come from the detail endpoint before opening the form. */
  const repetirGrade = useCallback(
    async (runId: string) => {
      const fonte =
        detalhe?.run.id === runId
          ? detalhe.run
          : await (async () => {
              const r = await fetch(`/api/ia/evals?run=${runId}`);
              return r.ok ? ((await r.json()).run as RunDetalhe) : null;
            })();
      if (!fonte) return;
      setForm((f) => ({
        ...f,
        ambiente: fonte.ambiente,
        papel: fonte.papel,
        modelos: [...fonte.modelos],
        repeticoes: fonte.repeticoes,
        casoIds: (fonte.casos ?? []).map((c) => c.id),
      }));
      setDialogAberto(true);
    },
    [detalhe]
  );

  const ultimoComResumo =
    runs?.find((r) => r.resumo && r.resumo.total > 0) ?? null;

  return (
    <section aria-labelledby="titulo-evals" className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <h2 id="titulo-evals" className="text-base font-semibold">
            Evals da Liza
          </h2>
          <Popover>
            <PopoverTrigger
              aria-label="Como calculamos os evals"
              className="grid min-h-11 min-w-11 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:min-h-8 sm:min-w-8"
            >
              <Info size={15} aria-hidden />
            </PopoverTrigger>
            <PopoverContent
              align="start"
              className="scroll-fina max-h-96 w-[min(22rem,calc(100vw-2rem))] overflow-y-auto p-4"
            >
              <p className="text-sm font-semibold">Como calculamos</p>
              <dl className="mt-3 grid gap-3 text-sm">
                {COMO_CALCULAMOS.map((r) => (
                  <div key={r.termo}>
                    <dt className="font-medium">{r.termo}</dt>
                    <dd className="mt-0.5 text-muted-foreground">{r.texto}</dd>
                  </div>
                ))}
              </dl>
            </PopoverContent>
          </Popover>
          <span className="hidden text-xs text-muted-foreground sm:inline">
            casos × modelos × repetições
          </span>
        </div>
        <Button size="sm" onClick={() => setDialogAberto(true)}>
          <Plus aria-hidden />
          Novo run
        </Button>
      </div>

      {erro && (
        <p
          role="alert"
          className="rounded-lg border border-[var(--danger-border)] bg-[var(--danger-bg)] px-3 py-2 text-sm text-[var(--danger-text)]"
        >
          {erro}
        </p>
      )}

      {runs === null ? (
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
      ) : runs.length === 0 ? (
        <div className="animate-enter rounded-xl border border-dashed border-border bg-card p-6 text-center sm:p-10">
          <div className="mx-auto grid size-12 place-items-center rounded-full bg-muted text-muted-foreground">
            <Flask size={24} aria-hidden />
          </div>
          <h3 className="mt-4 text-base font-semibold">
            Teste a Liza de verdade
          </h3>
          <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
            Um eval faz perguntas reais ao chat, como um usuário faria, e
            confere o que voltou: as ferramentas que a Liza chamou e o texto
            da resposta, caso a caso.
          </p>
          <ul className="mx-auto mt-4 grid max-w-md gap-1.5 text-left text-sm text-muted-foreground">
            <li className="flex gap-2">
              <span aria-hidden className="text-foreground">·</span>
              A grade repete cada pergunta nos modelos que você escolher.
            </li>
            <li className="flex gap-2">
              <span aria-hidden className="text-foreground">·</span>
              Você vê cada célula executando ao vivo, com custo correndo.
            </li>
            <li className="flex gap-2">
              <span aria-hidden className="text-foreground">·</span>
              Pausar não perde nada: os itens na fila ficam no banco.
            </li>
          </ul>
          <Button className="mt-5" onClick={() => setDialogAberto(true)}>
            <Plus aria-hidden />
            Criar o primeiro run
          </Button>
        </div>
      ) : (
        <>
          <HistoricoRuns
            runs={runs}
            detalhe={detalhe}
            driving={driving}
            limpando={limpando}
            onLimpar={limparHistorico}
            onAbrir={abrirRun}
            onContinuar={(id) => {
              void carregarDetalhe(id);
              void dirigir(id);
            }}
            onRepetir={repetirGrade}
          />
          {detalhe && (
            <DetalheRun
              key={detalhe.run.id}
              run={detalhe.run}
              itens={detalhe.itens}
              driving={driving === detalhe.run.id}
              bloqueado={driving !== null && driving !== detalhe.run.id}
              atual={driving === detalhe.run.id ? atual : null}
              feed={driving === detalhe.run.id || fechado === detalhe.run.id ? feed : []}
              celebrar={fechado === detalhe.run.id}
              reexecutando={reexecutando}
              apagando={apagando}
              onContinuar={() => void dirigir(detalhe.run.id)}
              onPausar={() => {
                parar.current = true;
              }}
              onReexecutar={() => void reexecutar(detalhe.run.id)}
              onApagar={() => void apagarRun(detalhe.run.id)}
              onFechar={fecharDetalhe}
            />
          )}
        </>
      )}

      <NovoRunDialog
        open={dialogAberto}
        onOpenChange={setDialogAberto}
        form={form}
        onForm={setForm}
        casos={casos}
        modelosSugeridos={modelosSugeridos}
        ultimoComResumo={ultimoComResumo}
        criando={criando}
        bloqueado={driving !== null}
        onCriar={criar}
      />
    </section>
  );
}
