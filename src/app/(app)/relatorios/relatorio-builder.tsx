"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowSquareOut, Check, DownloadSimple, Link as LinkIcon, PencilSimple } from "@phosphor-icons/react";
import { RelatorioCanvas } from "@/components/relatorio-canvas";
import { salvarCampoRelatorio } from "@/lib/actions";
import {
  catalogoDe,
  configParaSearch,
  montarLinhas,
  textoCelula,
  type AlvoRelatorio,
  type DuplaFonte,
  type GranularidadeRelatorio,
  type PessoaFonte,
  type RelatorioConfig,
} from "@/lib/relatorio";
import { RESUMO_SLUG_T2 } from "@/lib/relatorio";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { filterChipCls } from "@/components/ui/filter-chip";

function csvDownload(nome: string, header: string[], linhas: string[][]) {
  const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const csv = "﻿" + [header, ...linhas].map((l) => l.map(esc).join(";")).join("\r\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const a = Object.assign(document.createElement("a"), { href: url, download: nome });
  a.click();
  URL.revokeObjectURL(url);
}

/** Saída animada de coluna: o id segue em `colunas` ~170ms marcado como
 *  "saindo" pro fade-out do canvas rodar antes da remoção real. Um pouco
 *  maior que o duration-150 da saída — a célula some já transparente.
 *  ENTRADA marca o id só durante o fade+slide (200ms) — a classe precisa
 *  estar na célula no mount, e sair depois não replaya nada. */
const SAIDA_COLUNA_MS = 170;
const ENTRADA_COLUNA_MS = 220;

/** Rótulo de grupo de filtros — o mesmo overline de /duplas ("Turma",
 *  "Situação"), com id próprio pro role="group" referenciar. */
function GrupoLabel({ id, children }: { id: string; children: string }) {
  return (
    <span
      id={id}
      className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground"
    >
      {children}
    </span>
  );
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
  // colunas em transição animada — "entrando" monta com fade+slide (a marca
  // cai depois da animação), "saindo" segue na grade até o fade-out terminar
  const [saindo, setSaindo] = useState<ReadonlySet<string>>(new Set());
  const [entrando, setEntrando] = useState<ReadonlySet<string>>(new Set());
  const colTimers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const [editando, setEditando] = useState(false);
  const [copiado, setCopiado] = useState(false);
  // edições gravadas aplicadas por cima dos dados do server — a célula
  // atualiza na hora e o overlay sobrevive até a revalidação trazer o
  // mesmo valor de volta (sobrescrever o server com o que acabou de gravar
  // é convergente, não otimista)
  const [editLocal, setEditLocal] = useState<Map<string, Partial<PessoaFonte>>>(new Map());

  const catalogo = catalogoDe(gran);
  const cfg: RelatorioConfig = {
    turma: turma === "todas" ? null : turma,
    granularidade: gran,
    colunas,
  };
  const profsMap = useMemo(
    () =>
      new Map(
        profs.map((p) => {
          const e = editLocal.get(`profiles:${p.id}`);
          return [p.id, e ? { ...p, ...e } : p];
        })
      ),
    [profs, editLocal]
  );
  const mentsMap = useMemo(
    () =>
      new Map(
        mentorados.map((m) => {
          const e = editLocal.get(`mentorados:${m.id}`);
          return [m.id, e ? { ...m, ...e } : m];
        })
      ),
    [mentorados, editLocal]
  );
  // ~60 linhas — reordenar/montar direto no render é ínfimo. paraApp traz os
  // metadados internos (__alvos/__links) que o resumo público nunca recebe.
  const linhas = montarLinhas(cfg, duplas, profsMap, mentsMap, { paraApp: true });
  const colVisiveis = catalogo.filter((c) => colunas.includes(c.id));

  // timers de transição de coluna pendentes morrem junto com o componente
  useEffect(
    () => () => {
      for (const t of colTimers.current.values()) clearTimeout(t);
    },
    []
  );

  const limparTimerCol = (id: string) => {
    const t = colTimers.current.get(id);
    if (t) clearTimeout(t);
    colTimers.current.delete(id);
  };

  const trocarGran = (g: GranularidadeRelatorio) => {
    // transições em curso pertencem ao catálogo antigo — zeram junto
    for (const t of colTimers.current.values()) clearTimeout(t);
    colTimers.current.clear();
    setSaindo(new Set());
    setEntrando(new Set());
    setGran(g);
    setColunas(catalogoDe(g).map((c) => c.id));
    setEditando(false);
  };

  const toggleCol = (id: string) => {
    limparTimerCol(id);
    if (saindo.has(id)) {
      // clicar durante a saída cancela a remoção — a coluna fica
      setSaindo((s) => {
        const n = new Set(s);
        n.delete(id);
        return n;
      });
      return;
    }
    if (colunas.includes(id)) {
      // sai: se ainda estava entrando, a marca de entrada cai junto — as
      // classes de entrada e saída disputariam a mesma propriedade
      setEntrando((s) => {
        const n = new Set(s);
        n.delete(id);
        return n;
      });
      setSaindo((s) => new Set(s).add(id));
      colTimers.current.set(
        id,
        setTimeout(() => {
          colTimers.current.delete(id);
          setColunas((prev) => prev.filter((c) => c !== id));
          setSaindo((s) => {
            const n = new Set(s);
            n.delete(id);
            return n;
          });
        }, SAIDA_COLUNA_MS)
      );
    } else {
      // entra: monta já com a classe de fade+slide; a marca cai depois da
      // animação — remover a classe pós-mount não replaya nada
      setEntrando((s) => new Set(s).add(id));
      setColunas((prev) => [...prev, id]);
      colTimers.current.set(
        id,
        setTimeout(() => {
          colTimers.current.delete(id);
          setEntrando((s) => {
            const n = new Set(s);
            n.delete(id);
            return n;
          });
        }, ENTRADA_COLUNA_MS)
      );
    }
  };

  const linkCompartilhavel = `/resumo/${RESUMO_SLUG_T2}?${configParaSearch(cfg)}`;

  const copiarLink = async () => {
    try {
      await navigator.clipboard.writeText(`${location.origin}${linkCompartilhavel}`);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 1800);
    } catch {}
  };

  /** Ponte canvas → action: devolve a mensagem de erro (toast na célula) ou
   *  null — no sucesso o valor normalizado entra no overlay local e o
   *  montarLinhas do próximo render já mostra o gravado em toda célula que
   *  deriva dele (o `par` do colega, o contato composto…). */
  const salvarCampo = useCallback(
    async (alvo: AlvoRelatorio, novo: string): Promise<string | null> => {
      try {
        const res = await salvarCampoRelatorio(alvo.tabela, alvo.id, alvo.campo, novo);
        if ("error" in res) return res.error ?? "Não foi possível concluir. Tente de novo.";
        setEditLocal((prev) => {
          const next = new Map(prev);
          const k = `${alvo.tabela}:${alvo.id}`;
          next.set(k, { ...next.get(k), [alvo.campo]: res.valor ?? null });
          return next;
        });
        return null;
      } catch {
        return "Sem conexão. Tente de novo.";
      }
    },
    []
  );

  return (
    <div className="space-y-5">
      {/* barra de configuração — mesma língua dos filtros de /duplas e
          /pessoas: grupos com rótulo overline + chips filterChipCls */}
      <div className="space-y-4">
        <div role="group" aria-labelledby="flt-turma" className="flex flex-wrap items-center gap-1.5">
          <GrupoLabel id="flt-turma">Turma</GrupoLabel>
          {["T2 · 2026/2027", ...turmas.filter((t) => t !== "T2 · 2026/2027"), "todas"].map((t) => (
            <button
              key={t}
              type="button"
              aria-pressed={turma === t}
              onClick={() => setTurma(t)}
              className={filterChipCls(turma === t)}
            >
              {t === "todas" ? "Todas" : t}
            </button>
          ))}
        </div>

        <div role="group" aria-labelledby="flt-linhas" className="flex flex-wrap items-center gap-1.5">
          <GrupoLabel id="flt-linhas">Linhas</GrupoLabel>
          {(["pessoas", "duplas"] as const).map((g) => (
            <button
              key={g}
              type="button"
              aria-pressed={gran === g}
              onClick={() => trocarGran(g)}
              className={filterChipCls(gran === g)}
            >
              {g === "pessoas" ? "Uma por pessoa" : "Uma por dupla"}
            </button>
          ))}
        </div>

        <div role="group" aria-labelledby="flt-colunas" className="flex flex-wrap items-center gap-1.5">
          <GrupoLabel id="flt-colunas">Colunas</GrupoLabel>
          {catalogo.map((c) => {
            // saindo já lê como desligado — a coluna desmonta quando o
            // fade termina, mas o chip vira "off" no clique
            const on = colunas.includes(c.id) && !saindo.has(c.id);
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => toggleCol(c.id)}
                aria-pressed={on}
                className={cn(filterChipCls(on), !on && "border-dashed")}
              >
                <span
                  className={cn(
                    "grid size-3.5 place-items-center rounded-sm border",
                    on ? "border-background/40 bg-background/20" : "border-border"
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
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              csvDownload(
                `relatorio-${turma === "todas" ? "todas" : "turma2"}-${gran}.csv`,
                colVisiveis.map((c) => c.label),
                linhas.map((l) => colVisiveis.map((c) => textoCelula(l, c.id)))
              )
            }
          >
            <DownloadSimple size={14} aria-hidden /> Baixar CSV
          </Button>
          <Button variant="outline" size="sm" onClick={copiarLink}>
            {copiado ? <Check size={14} aria-hidden /> : <LinkIcon size={14} aria-hidden />}
            {copiado ? "Link copiado" : "Copiar link de compartilhamento"}
          </Button>
          <Button
            variant="link"
            size="sm"
            render={
              <a href={linkCompartilhavel} target="_blank" rel="noreferrer" />
            }
          >
            <ArrowSquareOut size={13} aria-hidden /> Abrir a versão pública
          </Button>
          {/* modo edição: toggle no padrão chip de filtro, jogado pra direita
              como o "Ordenar" de /pessoas — separa "o que a grade mostra" de
              "o que ela deixa mexer". Ligado vira "Concluir edição" (chip
              preenchido) e traz o lembrete do gesto junto. */}
          <div className="ml-auto flex flex-wrap items-center justify-end gap-x-3 gap-y-1">
            {editando && (
              <span className="animate-in fade-in text-xs text-muted-foreground duration-150">
                Clique numa célula pra editar — Enter confirma, Esc desfaz
              </span>
            )}
            <button
              type="button"
              aria-pressed={editando}
              title="Corrige nome, e-mail, WhatsApp, cidade e UF direto nas células"
              onClick={() => setEditando((v) => !v)}
              className={filterChipCls(editando)}
            >
              {editando ? (
                <Check size={13} aria-hidden />
              ) : (
                <PencilSimple size={13} aria-hidden />
              )}
              {editando ? "Concluir edição" : "Editar cadastros"}
            </button>
          </div>
        </div>
      </div>

      {/* canvas livre */}
      <div className="-mx-4 border-y border-border bg-card/40 px-4 py-3 sm:-mx-6 sm:px-6">
        <RelatorioCanvas
          key={`${turma}-${gran}`}
          colunas={colVisiveis}
          linhas={linhas}
          storageKey={`${turma}-${gran}`}
          editavel={editando}
          colunasEntrando={entrando}
          colunasSaindo={saindo}
          onSalvarCampo={salvarCampo}
        />
      </div>
    </div>
  );
}
