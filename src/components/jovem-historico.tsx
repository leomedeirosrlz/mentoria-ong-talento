"use client";

import { useState, type ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { FilterChipRow, filterChipCls } from "@/components/ui/filter-chip";

/** Histórico da agenda do jovem (REALIZA-488): denso e escaneável — uma
 *  linha por encontro, agrupado pelo mês em que ele rolou, e só os 5 mais
 *  recentes abertos de cara ("Ver histórico completo" abre o resto). As
 *  linhas chegam prontas do server: este componente só recorta e agrupa —
 *  por isso recebe ReactNode, não dados crus. Quando há trilha de
 *  especialista junto da mentoria, os chips de origem separam os dois. */

export type ItemHistorico = {
  id: string;
  /** "dpp" | "especialista" — alimenta os chips de origem. */
  trilha: string;
  /** "novembro de 2025" — cabeçalho do grupo, já calculado no server. */
  mes: string;
  node: ReactNode;
};

const VISIVEIS = 5;

type Filtro = "tudo" | "dpp" | "especialista";

/** O recorte puro do histórico — filtra por trilha, limita aos mais
 *  recentes e agrupa por mês na ordem de chegada (o server já ordena do
 *  mais novo). Exportado pros testes: o componente só desenha o resultado. */
export function recorteHistorico(
  itens: ItemHistorico[],
  filtro: Filtro,
  completo: boolean
): {
  filtrados: ItemHistorico[];
  ocultos: number;
  grupos: { mes: string; linhas: ItemHistorico[] }[];
} {
  const filtrados = itens.filter(
    (i) =>
      filtro === "tudo" ||
      (filtro === "especialista"
        ? i.trilha === "especialista"
        : i.trilha !== "especialista")
  );
  const visiveis = completo ? filtrados : filtrados.slice(0, VISIVEIS);
  const grupos: { mes: string; linhas: ItemHistorico[] }[] = [];
  for (const i of visiveis) {
    const g = grupos[grupos.length - 1];
    if (g && g.mes === i.mes) g.linhas.push(i);
    else grupos.push({ mes: i.mes, linhas: [i] });
  }
  return { filtrados, ocultos: filtrados.length - visiveis.length, grupos };
}

export function JovemHistorico({
  itens,
  rodape,
}: {
  itens: ItemHistorico[];
  /** Link "Encontro que não aparece aqui?" — fica no pé do card. */
  rodape?: ReactNode;
}) {
  const [filtro, setFiltro] = useState<Filtro>("tudo");
  const [completo, setCompleto] = useState(false);
  const temEsp = itens.some((i) => i.trilha === "especialista");
  const temDpp = itens.some((i) => i.trilha !== "especialista");
  const { filtrados, ocultos, grupos } = recorteHistorico(
    itens,
    filtro,
    completo
  );

  return (
    <>
      {temEsp && temDpp && (
        <FilterChipRow
          role="group"
          aria-label="Filtrar o histórico por origem"
          className="gap-1.5"
        >
          {(
            [
              ["tudo", "Tudo"],
              ["dpp", "Mentoria"],
              ["especialista", "Especialistas"],
            ] as const
          ).map(([id, rotulo]) => (
            <button
              key={id}
              type="button"
              aria-pressed={filtro === id}
              onClick={() => {
                setFiltro(id);
                // o chip troca o conjunto — o "ver completo" fecha pra
                // não ficar aberto num recorte que a pessoa nem viu
                setCompleto(false);
              }}
              className={filterChipCls(filtro === id)}
            >
              {rotulo}
            </button>
          ))}
        </FilterChipRow>
      )}
      <Card>
        <CardContent className="divide-y divide-border/60 p-0">
          {grupos.map((g) => (
            <div key={g.mes}>
              <h3 className="px-4 pb-1 pt-2.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground sm:px-5">
                {g.mes}
              </h3>
              <div className="divide-y divide-border/60">
                {g.linhas.map((i) => (
                  <div key={i.id}>{i.node}</div>
                ))}
              </div>
            </div>
          ))}
          {filtrados.length > VISIVEIS && (
            <button
              type="button"
              onClick={() => setCompleto((c) => !c)}
              aria-expanded={completo}
              className="flex w-full items-center justify-center gap-1 px-4 py-2.5 text-sm font-medium text-primary transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring sm:px-5"
            >
              {completo
                ? "Mostrar só os mais recentes"
                : `Ver histórico completo (${ocultos} a mais)`}
            </button>
          )}
          {rodape}
        </CardContent>
      </Card>
    </>
  );
}
