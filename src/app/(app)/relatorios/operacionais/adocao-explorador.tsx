"use client";

import { useEffect, useRef, useState } from "react";
import {
  ArrowClockwise,
  CaretDown,
  Command,
  Play,
  WarningCircle,
  X,
} from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { FadeTroca } from "@/components/ui/etapa";
import { Textarea } from "@/components/ui/textarea";
import { filterChipCls, FilterChipRow } from "@/components/ui/filter-chip";
import { cn } from "@/lib/utils";
import { formatDate } from "@/lib/ciclo";
import {
  CONSULTAS_PRESET,
  LIMITE_LINHAS,
  TABELA_EVENTOS,
  fmtCelula,
  sqlSomenteLeitura,
} from "@/lib/adocao-sql";
import type { BancoEventos, ResultadoConsulta } from "@/lib/adocao-duckdb";

// REALIZA-417 fase B — explorador ad-hoc da aba Adoção (coord-only via
// a página, que já redireciona não-coord). Fechado é só um botão; abrir
// dispara a cadeia: import() do módulo DuckDB (chunk separado, nunca no
// bundle da aba) → selectBundle mvp/eh (sem threads, sem COOP/COEP) →
// fetch do export parquet da janela → registerFileBuffer + view.
//
// O fechamento ENCERRA o worker: ~15MB de heap wasm não fica pendurado
// quando a pessoa colapsa ou sai da aba. Reabrir reinstanteia do arquivo
// em cache do browser — custo ~1s, honesto.

type Fase = "ocioso" | "preparando" | "pronto" | "falha";

export function AdocaoExplorador({ desde }: { desde: string }) {
  const [aberto, setAberto] = useState(false);
  const [fase, setFase] = useState<Fase>("ocioso");
  const [etapa, setEtapa] = useState<"motor" | "dados" | "pronto">("motor");
  const [erroFatal, setErroFatal] = useState<string | null>(null);
  const [info, setInfo] = useState<{
    gestos: number;
    primeiro: Date | null;
    ultimo: Date | null;
  } | null>(null);
  const [sql, setSql] = useState(CONSULTAS_PRESET[0]!.sql);
  const [rodando, setRodando] = useState(false);
  const [resultado, setResultado] = useState<ResultadoConsulta | null>(null);
  const [erroSql, setErroSql] = useState<string | null>(null);
  const [recarregando, setRecarregando] = useState(false);

  const bancoRef = useRef<BancoEventos | null>(null);
  const [versao, setVersao] = useState(0); // retry do bootstrap

  const abrir = () => {
    setAberto(true);
    setFase("preparando");
    setErroFatal(null);
  };

  const tentarDeNovo = () => {
    setVersao((v) => v + 1);
    setFase("preparando");
    setErroFatal(null);
  };

  useEffect(() => {
    if (!aberto) return;
    let vivo = true;
    // dynamic import AQUI: @duckdb/duckdb-wasm (~1MB js + ~10MB wasm no
    // fio) só entra na rede quando a aba vira explorador — as páginas de
    // staff nunca pagam esse bundle
    void import("@/lib/adocao-duckdb")
      .then((m) =>
        m.criarBancoEventos(desde, (e) => {
          if (vivo) setEtapa(e);
        })
      )
      .then(async (banco) => {
        if (!vivo) {
          void banco.fechar();
          return;
        }
        bancoRef.current = banco;
        setInfo(await banco.info());
        setFase("pronto");
      })
      .catch((e: unknown) => {
        if (!vivo) return;
        setErroFatal(mensagemErro(e));
        setFase("falha");
      });
    return () => {
      vivo = false;
      // captura a instância DESTA montagem — fechar via ref aqui podia
      // matar o worker da próxima abertura na corrida
      const b = bancoRef.current;
      bancoRef.current = null;
      void b?.fechar();
      // boot ainda voando: o guard `!vivo` lá em cima fecha ao resolver
    };
  }, [aberto, desde, versao]);

  const rodar = async (texto?: string) => {
    const banco = bancoRef.current;
    if (!banco || rodando) return;
    const v = sqlSomenteLeitura(texto ?? sql);
    if (!v.ok) {
      setErroSql(v.erro);
      setResultado(null);
      return;
    }
    setErroSql(null);
    setRodando(true);
    try {
      setResultado(await banco.consultar(v.sql));
    } catch (e) {
      setErroSql(mensagemErro(e));
      setResultado(null);
    } finally {
      setRodando(false);
    }
  };

  const recarregar = async () => {
    const banco = bancoRef.current;
    if (!banco || recarregando) return;
    setRecarregando(true);
    try {
      await banco.recarregar(desde);
      setInfo(await banco.info());
    } catch (e) {
      setErroSql(mensagemErro(e));
    } finally {
      setRecarregando(false);
    }
  };

  // fechado → preparando → pronto/falha é troca de estado do mesmo
  // bloco: crossfade do kit (spec 028), não corte seco. O foco vai pro
  // painel entrante — o botão que disparou a troca desmonta junto, e sem
  // ele quem abriu pelo teclado ficava órfão. Só o "preparando" não
  // recebe foco: é uma fase de espera que muda sozinha (boot assíncrono)
  // e roubar foco no meio dela largaria a pessoa num painel vazio.
  return (
    <FadeTroca
      chave={!aberto ? "fechado" : fase}
      foco={!aberto || fase !== "preparando"}
      centralizar
    >
      {!aberto ? (
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <p className="text-sm text-muted-foreground">
            Console SQL sobre os gestos do período, rodando no navegador.
            A primeira abertura baixa o motor (~10&nbsp;MB).
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={abrir}
            aria-expanded={false}
          >
            <CaretDown aria-hidden />
            Abrir o explorador
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {/* régua interna: dataset carregado + ações de sessão */}
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
            <p className="text-xs text-muted-foreground">
              {fase === "pronto" && info
                ? info.gestos === 0
                  ? "Nenhum gesto exportado no período."
                  : `${info.gestos.toLocaleString("pt-BR")} gestos` +
                    (info.primeiro && info.ultimo
                      ? ` · ${formatDate(info.primeiro.toISOString().slice(0, 10))} a ${formatDate(info.ultimo.toISOString().slice(0, 10))}`
                      : "") +
                    ` · tabela ${TABELA_EVENTOS}`
                : etapa === "motor"
                  ? "Preparando o motor de consulta…"
                  : "Baixando os gestos do período…"}
            </p>
            <div className="flex items-center gap-2">
              {fase === "pronto" && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => void recarregar()}
                  disabled={recarregando}
                >
                  <ArrowClockwise
                    aria-hidden
                    className={cn(recarregando && "animate-spin")}
                  />
                  Atualizar dados
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setAberto(false)}
                aria-expanded={true}
              >
                <X aria-hidden />
                Fechar
              </Button>
            </div>
          </div>

          {fase === "falha" ? (
            <div
              role="alert"
              className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-3 text-sm"
            >
              <p className="font-medium">Não foi possível abrir o explorador</p>
              <p className="mt-0.5 text-muted-foreground">{erroFatal}</p>
              <Button
                variant="outline"
                size="sm"
                className="mt-2"
                onClick={tentarDeNovo}
              >
                <ArrowClockwise aria-hidden />
                Tentar de novo
              </Button>
            </div>
          ) : fase === "preparando" ? (
            <div className="space-y-1.5 py-2">
              <p className="animate-pulse text-sm text-muted-foreground">
                {etapa === "motor"
                  ? "Baixando o motor de consulta · só na primeira vez…"
                  : "Baixando os gestos do período…"}
              </p>
              <div className="h-1 w-full overflow-hidden rounded-full bg-muted">
                <div className="h-full w-1/3 animate-pulse rounded-full bg-muted-foreground/30" />
              </div>
            </div>
          ) : fase === "pronto" ? (
            <>
              {/* chips de pergunta pronta — cada um injeta a SQL na caixa e
                  roda; a query fica visível e editável (também ensina o
                  esquema: o preset é o exemplo vivo). Mesma pill da régua. */}
              <FilterChipRow role="group" aria-label="Consultas prontas" className="gap-1.5">
                {CONSULTAS_PRESET.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    disabled={rodando}
                    aria-pressed={sql === p.sql}
                    onClick={() => {
                      setSql(p.sql);
                      void rodar(p.sql);
                    }}
                    className={cn(filterChipCls(sql === p.sql), "disabled:opacity-50")}
                  >
                    {p.rotulo}
                  </button>
                ))}
              </FilterChipRow>

              <div className="space-y-2">
                <label htmlFor="adocao-sql" className="sr-only">
                  Consulta SQL
                </label>
                <Textarea
                  id="adocao-sql"
                  value={sql}
                  onChange={(e) => setSql(e.target.value)}
                  onKeyDown={(e) => {
                    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                      e.preventDefault();
                      void rodar();
                    }
                  }}
                  spellCheck={false}
                  rows={5}
                  className="min-h-24 font-mono text-[13px] leading-relaxed"
                  placeholder={`select * from ${TABELA_EVENTOS} limit 20`}
                  aria-invalid={!!erroSql}
                />
                <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
                  <p className="text-[11px] text-muted-foreground">
                    Só leitura (SELECT). <Command aria-hidden className="inline size-3 align-[-1px]" />
                    +Enter roda. Resultado limitado a {LIMITE_LINHAS} linhas.
                  </p>
                  <Button
                    size="sm"
                    onClick={() => void rodar()}
                    disabled={rodando}
                  >
                    <Play aria-hidden />
                    {rodando ? "Rodando…" : "Rodar consulta"}
                  </Button>
                </div>
              </div>

              {erroSql && (
                <div
                  role="alert"
                  className="animate-enter rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2.5"
                >
                  <p className="flex items-center gap-1.5 text-xs font-medium">
                    <WarningCircle aria-hidden className="size-3.5" />
                    A consulta não rodou
                  </p>
                  <pre className="mt-1 whitespace-pre-wrap font-mono text-[11px] leading-relaxed text-muted-foreground">
                    {erroSql}
                  </pre>
                </div>
              )}

              {resultado && (
                <div className="animate-enter space-y-1.5">
                  <p className="text-[11px] tabular-nums text-muted-foreground">
                    {resultado.truncado
                      ? `Mais de ${LIMITE_LINHAS.toLocaleString("pt-BR")} linhas, mostrando as primeiras ${LIMITE_LINHAS} · `
                      : `${resultado.linhas.length.toLocaleString("pt-BR")} ${
                          resultado.linhas.length === 1 ? "linha" : "linhas"
                        } · `}
                    {resultado.ms} ms
                  </p>
                  {resultado.linhas.length === 0 ? (
                    <p className="rounded-lg border border-dashed border-border px-3 py-6 text-center text-sm text-muted-foreground">
                      A consulta voltou sem linhas.
                    </p>
                  ) : (
                    <div className="scroll-fina max-h-[55dvh] overflow-auto rounded-lg border border-border [scrollbar-gutter:stable]">
                      <table className="w-full min-w-max border-separate border-spacing-0 text-left text-[13px] leading-snug">
                        <thead>
                          <tr className="bg-muted">
                            <th
                              aria-hidden
                              className="sticky left-0 top-0 z-30 w-10 border-b border-r border-border px-1 py-1.5 text-center text-[10px] tabular-nums font-normal text-muted-foreground"
                            />
                            {resultado.colunas.map((c) => (
                              <th
                                key={c}
                                scope="col"
                                className="sticky top-0 z-20 max-w-72 border-b border-border bg-muted px-2.5 py-1.5 text-left text-xs font-medium text-foreground"
                              >
                                <span className="break-words">{c}</span>
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {resultado.linhas.map((linha, i) => (
                            <tr key={i} className="hover:bg-[var(--brand-lime)]/8">
                              <td className="sticky left-0 z-10 w-10 border-b border-r border-border bg-card px-1 py-1 text-center text-[10px] tabular-nums text-muted-foreground select-none">
                                {i + 1}
                              </td>
                              {linha.map((v, j) => {
                                const txt = fmtCelula(v);
                                return (
                                  <td
                                    key={j}
                                    className="max-w-72 border-b border-border px-2.5 py-1 align-top tabular-nums"
                                  >
                                    <span
                                      className="block max-w-72 truncate"
                                      title={txt.length > 40 ? txt : undefined}
                                    >
                                      {txt || (
                                        <span className="text-muted-foreground/50">
                                          —
                                        </span>
                                      )}
                                    </span>
                                  </td>
                                );
                              })}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </>
          ) : null}
        </div>
      )}
    </FadeTroca>
  );
}

/** Erro de engine/rede → primeira linha útil (o DuckDB empilha
 *  contexto; o resto ficava gritado na tela). */
function mensagemErro(e: unknown): string {
  const bruto = e instanceof Error ? e.message : String(e);
  const primeira = bruto.split("\n").find((l) => l.trim().length > 0);
  return primeira ?? "Erro inesperado.";
}
