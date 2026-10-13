"use client";

import { useMemo, useState } from "react";
import { Check, Copy, DownloadSimple, Link as LinkIcon } from "@phosphor-icons/react";
import { RelatorioCanvas } from "@/components/relatorio-canvas";
import {
  catalogoDe,
  configParaSearch,
  montarLinhas,
  type DuplaFonte,
  type GranularidadeRelatorio,
  type PessoaFonte,
  type RelatorioConfig,
} from "@/lib/relatorio";
import { RESUMO_SLUG_T2 } from "@/lib/relatorio";
import { cn } from "@/lib/utils";

function csvDownload(nome: string, header: string[], linhas: string[][]) {
  const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const csv = "﻿" + [header, ...linhas].map((l) => l.map(esc).join(";")).join("\r\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const a = Object.assign(document.createElement("a"), { href: url, download: nome });
  a.click();
  URL.revokeObjectURL(url);
}

export function RelatorioBuilder({
  turmas,
  duplas,
  profs,
  mentorados,
}: {
  turmas: string[];
  duplas: DuplaFonte[];
  profs: PessoaFonte[];
  mentorados: PessoaFonte[];
}) {
  const [turma, setTurma] = useState<string>("T2 · 2026/2027");
  const [gran, setGran] = useState<GranularidadeRelatorio>("pessoas");
  const [colunas, setColunas] = useState<string[]>(() => catalogoDe("pessoas").map((c) => c.id));
  const [copiado, setCopiado] = useState(false);

  const catalogo = catalogoDe(gran);
  const cfg: RelatorioConfig = {
    turma: turma === "todas" ? null : turma,
    granularidade: gran,
    colunas,
  };
  const profsMap = useMemo(() => new Map(profs.map((p) => [p.id, p])), [profs]);
  const mentsMap = useMemo(() => new Map(mentorados.map((m) => [m.id, m])), [mentorados]);
  // ~60 linhas — reordenar/montar direto no render é ínfimo
  const linhas = montarLinhas(cfg, duplas, profsMap, mentsMap);
  const colVisiveis = catalogo.filter((c) => colunas.includes(c.id));

  const trocarGran = (g: GranularidadeRelatorio) => {
    setGran(g);
    setColunas(catalogoDe(g).map((c) => c.id));
  };

  const toggleCol = (id: string) =>
    setColunas((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]
    );

  const linkCompartilhavel = `/resumo/${RESUMO_SLUG_T2}?${configParaSearch(cfg)}`;

  const copiarLink = async () => {
    try {
      await navigator.clipboard.writeText(`${location.origin}${linkCompartilhavel}`);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 1800);
    } catch {}
  };

  return (
    <div className="space-y-5">
      {/* barra de configuração */}
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-muted-foreground">Turma</span>
          {["T2 · 2026/2027", ...turmas.filter((t) => t !== "T2 · 2026/2027"), "todas"].map((t) => (
            <button
              key={t}
              onClick={() => setTurma(t)}
              className={cn(
                "min-h-8 rounded-full border px-3 text-xs font-medium transition-colors",
                turma === t
                  ? "border-[var(--brand-lime)] bg-[var(--brand-lime)]/15 text-foreground"
                  : "border-border bg-card text-muted-foreground hover:bg-accent"
              )}
            >
              {t === "todas" ? "Todas" : t}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-muted-foreground">Linhas</span>
          {(["pessoas", "duplas"] as const).map((g) => (
            <button
              key={g}
              onClick={() => trocarGran(g)}
              className={cn(
                "min-h-8 rounded-full border px-3 text-xs font-medium transition-colors",
                gran === g
                  ? "border-[var(--brand-lime)] bg-[var(--brand-lime)]/15 text-foreground"
                  : "border-border bg-card text-muted-foreground hover:bg-accent"
              )}
            >
              {g === "pessoas" ? "Uma por pessoa" : "Uma por dupla"}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <span className="mr-1 text-xs font-medium text-muted-foreground">Colunas</span>
          {catalogo.map((c) => {
            const on = colunas.includes(c.id);
            return (
              <button
                key={c.id}
                onClick={() => toggleCol(c.id)}
                aria-pressed={on}
                className={cn(
                  "inline-flex min-h-8 items-center gap-1.5 rounded-full border px-2.5 text-xs transition-colors",
                  on
                    ? "border-foreground/25 bg-foreground/5 text-foreground"
                    : "border-dashed border-border text-muted-foreground hover:bg-accent"
                )}
              >
                <span
                  className={cn(
                    "grid size-3.5 place-items-center rounded-sm border",
                    on ? "border-[var(--brand-lime)] bg-[var(--brand-lime)] text-[var(--brand-ink)]" : "border-border"
                  )}
                >
                  {on && <Check size={9} weight="bold" aria-hidden />}
                </span>
                {c.label}
              </button>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() =>
              csvDownload(
                `relatorio-${turma === "todas" ? "todas" : "turma2"}-${gran}.csv`,
                colVisiveis.map((c) => c.label),
                linhas.map((l) => colVisiveis.map((c) => l[c.id] ?? ""))
              )
            }
            className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-border bg-card px-3 text-xs font-medium hover:bg-accent"
          >
            <DownloadSimple size={14} aria-hidden /> Baixar CSV
          </button>
          <button
            onClick={copiarLink}
            className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-border bg-card px-3 text-xs font-medium hover:bg-accent"
          >
            {copiado ? <Check size={14} aria-hidden /> : <LinkIcon size={14} aria-hidden />}
            {copiado ? "Link copiado" : "Copiar link de compartilhamento"}
          </button>
          <a
            href={linkCompartilhavel}
            target="_blank"
            rel="noreferrer"
            className="inline-flex min-h-9 items-center gap-1.5 rounded-lg px-3 text-xs text-muted-foreground underline decoration-border underline-offset-2 hover:text-foreground"
          >
            <Copy size={13} aria-hidden /> Abrir a versão pública
          </a>
        </div>
      </div>

      {/* canvas livre */}
      <div className="-mx-4 border-y border-border bg-card/40 px-4 py-3 sm:-mx-6 sm:px-6">
        <RelatorioCanvas
          key={`${turma}-${gran}`}
          colunas={colVisiveis}
          linhas={linhas}
          storageKey={`${turma}-${gran}`}
        />
      </div>
    </div>
  );
}
