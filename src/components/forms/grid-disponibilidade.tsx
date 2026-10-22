"use client";

// Grade horária do intake (REALIZA-70): colunas seg–sex, linhas 09h–19h
// (faixas de 1h cobrindo 09h–20h). Emite RespostaGrid — `horas` verbatim
// + `celulas` canônicas (0100) — pro input hidden do form. Mesma mecânica
// de pintura da CampoDisponibilidade (drag, cabeçalhos alternam, roving
// tabindex) em escala 5×11.

import { useEffect, useRef, useState } from "react";
import { Check } from "@phosphor-icons/react";
import {
  GRID_DIAS,
  GRID_DIA_LABEL,
  GRID_DIA_LABEL_LONGA,
  GRID_HORAS,
  gridParaResposta,
  respostaParaHoras,
  type GridDia,
} from "@/lib/forms/intake";
import type { RespostaGrid, RespostaValor } from "@/lib/forms/schema";
import { cn } from "@/lib/utils";

const chave = (dia: GridDia, hora: number) => `${dia}:${hora}`;

const GRADE_COLS =
  "grid grid-cols-[2.6rem_repeat(5,minmax(0,1fr))] gap-1";

export function GridDisponibilidade({
  name,
  value,
  onChange,
}: {
  /** nome do input hidden que carrega o JSON da resposta */
  name: string;
  /** RespostaGrid atual (ou null) — rascunho reidrata por aqui */
  value: RespostaValor | null;
  onChange: (v: RespostaGrid | null) => void;
}) {
  const marcadas = new Set(
    respostaParaHoras(value ?? undefined).map((h) => chave(h.dia, h.hora))
  );
  const [foco, setFoco] = useState(0);
  const celulasRef = useRef<(HTMLButtonElement | null)[]>([]);
  // gesto de pintura: modo fixado pela célula âncora, conjunto de trabalho
  // fora do state — pointerenter não espera re-render
  const pintura = useRef<{ alvo: boolean; set: Set<string> } | null>(null);

  useEffect(() => {
    const fim = () => {
      pintura.current = null;
    };
    window.addEventListener("pointerup", fim);
    window.addEventListener("pointercancel", fim);
    return () => {
      window.removeEventListener("pointerup", fim);
      window.removeEventListener("pointercancel", fim);
    };
  }, []);

  const emitir = (set: Set<string>) => {
    const marcas = [...set].map((k) => {
      const [dia, hora] = k.split(":");
      return { dia: dia as GridDia, hora: Number(hora) };
    });
    onChange(marcas.length ? gridParaResposta(marcas) : null);
  };

  const comCelula = (base: Set<string>, dia: GridDia, hora: number, ligado: boolean) => {
    const n = new Set(base);
    const k = chave(dia, hora);
    if (ligado) n.add(k);
    else n.delete(k);
    return n;
  };

  const down =
    (dia: GridDia, hora: number, idx: number) =>
    (e: React.PointerEvent<HTMLButtonElement>) => {
      if (e.button !== 0 || !e.isPrimary) return;
      e.preventDefault();
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
      e.currentTarget.focus();
      setFoco(idx);
      const alvo = !marcadas.has(chave(dia, hora));
      const set = comCelula(marcadas, dia, hora, alvo);
      pintura.current = { alvo, set };
      emitir(set);
    };

  const enter = (dia: GridDia, hora: number) => () => {
    const p = pintura.current;
    if (!p) return;
    if (p.set.has(chave(dia, hora)) === p.alvo) return;
    p.set = comCelula(p.set, dia, hora, p.alvo);
    emitir(p.set);
  };

  const alternar =
    (dia: GridDia, hora: number) =>
    (e: React.MouseEvent<HTMLButtonElement>) => {
      if (e.detail !== 0) return;
      emitir(comCelula(marcadas, dia, hora, !marcadas.has(chave(dia, hora))));
    };

  const alternarColuna = (dia: GridDia) => {
    const ligado = !GRID_HORAS.every((h) => marcadas.has(chave(dia, h)));
    const set = new Set(marcadas);
    for (const h of GRID_HORAS) {
      if (ligado) set.add(chave(dia, h));
      else set.delete(chave(dia, h));
    }
    emitir(set);
  };

  const alternarLinha = (hora: number) => {
    const ligado = !GRID_DIAS.every((d) => marcadas.has(chave(d, hora)));
    const set = new Set(marcadas);
    for (const d of GRID_DIAS) {
      if (ligado) set.add(chave(d, hora));
      else set.delete(chave(d, hora));
    }
    emitir(set);
  };

  const setas = (di: number, hi: number) => (e: React.KeyboardEvent) => {
    const passo: Record<string, [number, number]> = {
      ArrowLeft: [0, -1],
      ArrowRight: [0, 1],
      ArrowUp: [-1, 0],
      ArrowDown: [1, 0],
    };
    const d = passo[e.key];
    if (!d) return;
    e.preventDefault();
    const idx =
      ((hi + d[0] + GRID_HORAS.length) % GRID_HORAS.length) * GRID_DIAS.length +
      ((di + d[1] + GRID_DIAS.length) % GRID_DIAS.length);
    setFoco(idx);
    celulasRef.current[idx]?.focus();
  };

  return (
    <fieldset className="space-y-2">
      <input
        type="hidden"
        name={name}
        value={JSON.stringify(value ?? { celulas: [], horas: [] })}
      />
      <legend className="sr-only">Disponibilidade semanal por faixa de horário</legend>
      <div
        role="grid"
        aria-label="Dias e faixas de horário livres na semana"
        className="touch-none select-none space-y-1"
      >
        <div role="row" className={GRADE_COLS}>
          <span role="columnheader" aria-hidden />
          {GRID_DIAS.map((d) => (
            <span role="columnheader" key={d} className="min-w-0">
              <button
                type="button"
                onClick={() => alternarColuna(d)}
                aria-label={`Alternar ${GRID_DIA_LABEL_LONGA[d]} inteira`}
                className="w-full rounded-md px-1 py-1 text-center text-[11px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
              >
                {GRID_DIA_LABEL[d]}
              </button>
            </span>
          ))}
        </div>
        {GRID_HORAS.map((h, hi) => (
          <div role="row" key={h} className={GRADE_COLS}>
            <span role="rowheader" className="min-w-0">
              <button
                type="button"
                onClick={() => alternarLinha(h)}
                aria-label={`Alternar faixa das ${h}h inteira`}
                className="flex h-full w-full items-center rounded-md px-1.5 text-[11px] font-medium tabular-nums text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
              >
                {String(h).padStart(2, "0")}h
              </button>
            </span>
            {GRID_DIAS.map((d, di) => {
              const idx = hi * GRID_DIAS.length + di;
              const ativo = marcadas.has(chave(d, h));
              return (
                <span role="gridcell" key={d} className="min-w-0">
                  <button
                    ref={(el) => {
                      celulasRef.current[idx] = el;
                    }}
                    type="button"
                    tabIndex={idx === foco ? 0 : -1}
                    aria-pressed={ativo}
                    aria-label={`${GRID_DIA_LABEL_LONGA[d]} às ${h}h`}
                    onPointerDown={down(d, h, idx)}
                    onPointerEnter={enter(d, h)}
                    onClick={alternar(d, h)}
                    onKeyDown={setas(di, hi)}
                    onFocus={() => setFoco(idx)}
                    className={cn(
                      "grid h-8 w-full place-items-center rounded-md border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
                      ativo
                        ? "border-primary/40 bg-primary/15 text-primary"
                        : "border-border bg-card text-muted-foreground hover:bg-muted"
                    )}
                  >
                    {ativo ? <Check size={12} weight="bold" aria-hidden /> : null}
                  </button>
                </span>
              );
            })}
          </div>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">
        Marque as faixas em que você tem disponibilidade (segunda a sexta,
        9h às 20h). Arraste pra marcar vários de uma vez.
      </p>
    </fieldset>
  );
}
