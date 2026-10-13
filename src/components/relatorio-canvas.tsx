"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ColunaRelatorio, LinhaRelatorio } from "@/lib/relatorio";
import { cn } from "@/lib/utils";

const LARGURA_MIN = 56;
const LARGURA_INICIAL = 168;

type Ordem = { col: string; dir: 1 | -1 } | null;

/** Grade livre estilo planilha: colunas redimensionáveis arrastando a borda
 *  do header, ordenação por clique, gutter de nº de linha (sticky à esquerda),
 *  seleção de intervalo e cópia TSV (cola direto no Excel/Sheets). O scroll é
 *  interno (header fixo) e devolve o gesto pra página no limite — sem
 *  overscroll-contain, que engolia a roda do mouse. Sem moldura de card —
 *  o canvas é a página. */
export function RelatorioCanvas({
  colunas,
  linhas,
  storageKey,
}: {
  colunas: ColunaRelatorio[];
  linhas: LinhaRelatorio[];
  /** persiste larguras por relatório (ex.: "t2-pessoas") */
  storageKey?: string;
}) {
  // larguras persistem por relatório — init lazy do localStorage; quem usa
  // deve passar key={storageKey} pra remontar quando o recorte mudar
  const [larguras, setLarguras] = useState<Record<string, number>>(() => {
    if (typeof window === "undefined" || !storageKey) return {};
    try {
      return JSON.parse(localStorage.getItem(`relatorio-w:${storageKey}`) ?? "{}");
    } catch {
      return {};
    }
  });
  const [ordem, setOrdem] = useState<Ordem>(null);
  const [selAncora, setSelAncora] = useState<number | null>(null);
  const [selFim, setSelFim] = useState<number | null>(null);
  const drag = useRef<{ col: string; x0: number; w0: number; wAtual?: number } | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  const ordenadas = useMemo(() => {
    if (!ordem) return linhas;
    return [...linhas].sort(
      (a, b) => (a[ordem.col] ?? "").localeCompare(b[ordem.col] ?? "", "pt-BR") * ordem.dir
    );
  }, [linhas, ordem]);

  const selecionadas = useMemo(() => {
    if (selAncora === null || selFim === null) return null;
    const [a, b] = [Math.min(selAncora, selFim), Math.max(selAncora, selFim)];
    return new Set(ordenadas.slice(a, b + 1).map((_, i) => a + i));
  }, [selAncora, selFim, ordenadas]);

  const paraTsv = useCallback(
    (rows: LinhaRelatorio[]) =>
      [colunas.map((c) => c.label).join("\t"),
        ...rows.map((l) => colunas.map((c) => l[c.id] ?? "").join("\t"))].join("\n"),
    [colunas]
  );

  const copiar = useCallback(async () => {
    const rows =
      selecionadas === null
        ? ordenadas
        : ordenadas.filter((_, i) => selecionadas.has(i));
    try {
      await navigator.clipboard.writeText(paraTsv(rows));
    } catch {}
  }, [ordenadas, selecionadas, paraTsv]);

  // Ctrl+C com seleção ativa copia como TSV (mesmo gesto do Excel)
  useEffect(() => {
    const el = wrapRef.current;
    if (!el || selecionadas === null) return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "c" && selecionadas.size > 0) {
        e.preventDefault();
        void copiar();
      }
    };
    el.addEventListener("keydown", onKey);
    return () => el.removeEventListener("keydown", onKey);
  }, [selecionadas, copiar]);

  const iniciarDrag = (e: React.PointerEvent, col: string) => {
    e.preventDefault();
    drag.current = {
      col,
      x0: e.clientX,
      w0: larguras[col] ?? (e.target as HTMLElement).closest("th")?.offsetWidth ?? LARGURA_INICIAL,
    };
    const move = (ev: PointerEvent) => {
      const d = drag.current;
      if (!d) return;
      const w = Math.max(LARGURA_MIN, d.w0 + ev.clientX - d.x0);
      d.wAtual = w;
      setLarguras((prev) => ({ ...prev, [d.col]: w }));
    };
    const up = () => {
      const d = drag.current;
      if (storageKey && d) {
        setLarguras((prev) => {
          const next = { ...prev, [d.col]: d.wAtual ?? prev[d.col] ?? d.w0 };
          try {
            localStorage.setItem(`relatorio-w:${storageKey}`, JSON.stringify(next));
          } catch {}
          return next;
        });
      }
      drag.current = null;
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
  };

  const clicarHeader = (col: string) => {
    setOrdem((o) =>
      o?.col !== col ? { col, dir: 1 } : o.dir === 1 ? { col, dir: -1 } : null
    );
  };

  // Sticky vai no th/td, não no thead/tr — Safari só respeita sticky em célula.
  // E a borda é por célula via border-separate: em border-collapse a borda não
  // acompanha a célula quando ela "descola". Cada célula desenha só direita +
  // baixo; topo fica com o header, esquerda com o gutter — sem dobras.
  const celula = "border-r border-b border-border";
  const gutter =
    "sticky left-0 border-r border-b border-l border-border bg-muted px-1 py-1 " +
    "text-center text-[10px] tabular-nums text-muted-foreground select-none";

  return (
    <div>
      {/* scroller: overscroll-behavior padrão (auto) — roda/chaining sobem pra
          página quando a grade está no limite; NUNCA overscroll-contain aqui,
          que segura o gesto mesmo sem nada pra rolar */}
      <div
        ref={wrapRef}
        tabIndex={-1}
        className="scroll-fina max-h-[70dvh] overflow-auto overscroll-auto [scrollbar-gutter:stable]"
      >
        <table
          className="border-separate border-spacing-0 text-left text-[13px] leading-snug"
          style={{ tableLayout: "fixed", width: "max-content" }}
        >
          <thead>
            <tr className="bg-muted">
              <th
                aria-hidden
                className={cn(gutter, "sticky top-0 z-30 w-10 border-t font-normal")}
              />
              {colunas.map((c) => {
                const ativo = ordem?.col === c.id;
                return (
                  <th
                    key={c.id}
                    className={cn(
                      celula,
                      "sticky top-0 z-20 border-t bg-muted px-2.5 py-1.5 text-left text-xs font-medium text-foreground select-none",
                      "cursor-pointer hover:bg-accent"
                    )}
                    style={{ width: larguras[c.id] ?? LARGURA_INICIAL }}
                    onClick={() => clicarHeader(c.id)}
                    aria-sort={ativo ? (ordem!.dir === 1 ? "ascending" : "descending") : undefined}
                  >
                    <span className="flex items-center justify-between gap-1">
                      <span className="truncate">{c.label}</span>
                      {ativo && <span aria-hidden className="text-[10px]">{ordem!.dir === 1 ? "↑" : "↓"}</span>}
                    </span>
                    {/* alça de redimensionamento — borda direita, como no Sheets;
                        a linha lime aparece no hover pra entregar a affordance */}
                    <span
                      role="separator"
                      aria-orientation="vertical"
                      aria-label={`Redimensionar ${c.label}`}
                      className="group/hdl absolute inset-y-0 -right-1.5 z-10 w-3 cursor-col-resize touch-none"
                      onPointerDown={(e) => iniciarDrag(e, c.id)}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <span
                        aria-hidden
                        className="absolute inset-y-0 left-1/2 w-0.5 -translate-x-1/2 bg-[var(--brand-lime)] opacity-0 transition-opacity group-hover/hdl:opacity-100 group-active/hdl:opacity-100"
                      />
                    </span>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {ordenadas.map((l, i) => (
              <tr
                key={i}
                className={cn(
                  "hover:bg-[var(--brand-lime)]/8",
                  selecionadas?.has(i) && "bg-[var(--brand-lime)]/15"
                )}
                onClick={(e) => {
                  if (e.shiftKey && selAncora !== null) setSelFim(i);
                  else { setSelAncora(i); setSelFim(i); }
                }}
              >
                <td className={cn(gutter, "z-10")}>
                  {i + 1}
                </td>
                {colunas.map((c) => (
                  <td
                    key={c.id}
                    className={cn(celula, "px-2.5 py-1.5 align-top")}
                    style={{ width: larguras[c.id] ?? LARGURA_INICIAL }}
                  >
                    <span className="block break-words">{l[c.id] || <span className="text-muted-foreground/50">—</span>}</span>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        {ordenadas.length === 0 && (
          <p className="px-4 py-10 text-center text-sm text-muted-foreground">
            Nenhuma linha nesse recorte.
          </p>
        )}
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        Arraste a borda de uma coluna pra redimensionar · clique no título pra ordenar ·
        clique numa linha e Shift+clique em outra pra selecionar — Ctrl+C copia pra planilha.
      </p>
    </div>
  );
}
