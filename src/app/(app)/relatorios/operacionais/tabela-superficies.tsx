"use client";

import { useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { Sparkline } from "@/components/viz";
import { tempoRelativo } from "@/lib/ciclo";
import {
  PAPEIS_ADOCAO,
  ROTA_SUPERFICIE,
  ROTULO_PAPEL,
  ROTULO_SUPERFICIE,
  type LinhaSuperficie,
} from "@/lib/adocao";

// REALIZA-417 — tabela L3 "Superfícies": a seção é server component,
// então a lista de trabalho (ordenação local + links) mora neste boundary
// client. Os dados chegam prontos por prop — sem refetch, os mesmos
// `linhas` alimentam a <table> (≥sm) e os cards (mobile).

const FMT_INT = new Intl.NumberFormat("pt-BR");

const ORDEM_PAPEL = new Map(PAPEIS_ADOCAO.map((p, i) => [p.id, i]));
const ordenaPapeis = (ids: string[]) =>
  [...ids].sort(
    (a, b) => (ORDEM_PAPEL.get(a) ?? 99) - (ORDEM_PAPEL.get(b) ?? 99)
  );

type ColOrd = "gestos" | "pessoas" | "ultimo";
type Ordem = { col: ColOrd; dir: 1 | -1 };

/** Série diária esparsa da RPC → slots da janela pro Sparkline (dia sem
 *  gesto = 0: a linha assenta no chão, não é buraco — a superfície
 *  existe e ninguém usou). null quando a superfície não tem série. */
function tendenciaParaSerie(
  tendencia: { d: string; g: number }[] | null | undefined,
  janela: number,
  agora: number
): (number | null)[] | null {
  if (!tendencia?.length) return null;
  const porDia = new Map(tendencia.map((t) => [t.d, t.g]));
  return Array.from({ length: janela }, (_, i) => {
    const dt = new Date(agora - (janela - 1 - i) * 86400000);
    return porDia.get(dt.toISOString().slice(0, 10)) ?? 0;
  });
}

/** Δ entre as metades da série já eslotada — a mesma forma que o spark
 *  mostra, então a seta nunca contradiz o traço. null quando não há
 *  base de comparação (zerada nas duas metades). */
function deltaTendencia(valores: (number | null)[] | null): number | null {
  if (!valores?.length) return null;
  const metade = Math.floor(valores.length / 2);
  if (metade === 0) return null;
  const soma = (fatia: (number | null)[]) =>
    fatia.reduce<number>((s, v) => s + (v ?? 0), 0);
  const antes = soma(valores.slice(0, metade));
  const depois = soma(valores.slice(metade));
  if (antes === 0 && depois === 0) return null;
  if (antes === 0) return 1; // saiu do zero — sobe, sem fingir magnitude
  return (depois - antes) / antes;
}

/** Badge da tendência: ↑/↓ com a % quando o movimento importa (|Δ| ≥ 10%,
 *  embaixo disso é ruído); o "→" quieto declara estabilidade sem número —
 *  mostrar "→ 4%" leria como informação onde não há. */
function BadgeTendencia({ delta }: { delta: number | null }) {
  if (delta == null) return null;
  if (Math.abs(delta) < 0.1)
    return (
      <span className="text-muted-foreground" title="estável no período">
        →
      </span>
    );
  const sobe = delta > 0;
  return (
    <span
      className={cn(
        "text-[11px] font-semibold tabular-nums whitespace-nowrap",
        sobe ? "text-[var(--ok-text)]" : "text-[var(--danger-text)]"
      )}
    >
      {sobe ? "↑" : "↓"} {Math.round(Math.abs(delta) * 100)}%
    </span>
  );
}

export function TabelaSuperficies({
  linhas,
  janela,
  agora,
}: {
  linhas: LinhaSuperficie[];
  janela: number;
  /** relógio da seção — o "há N min" e os slots da tendência compartilham
   *  o mesmo agora do resto do painel */
  agora: number;
}) {
  const [ord, setOrd] = useState<Ordem>({ col: "gestos", dir: -1 });

  const clicar = (col: ColOrd) =>
    // coluna nova nasce desc (o topo é o que importa numa lista de
    // trabalho); clicar na ativa inverte
    setOrd((o) =>
      o.col === col ? { col, dir: o.dir === -1 ? 1 : -1 } : { col, dir: -1 }
    );

  const ordenadas = [...linhas].sort((a, b) => {
    const va = ord.col === "ultimo" ? a.ultimo : a[ord.col];
    const vb = ord.col === "ultimo" ? b.ultimo : b[ord.col];
    const cmp = va < vb ? -1 : va > vb ? 1 : 0;
    return cmp * ord.dir;
  });

  const cabecalho = (col: ColOrd, rotulo: string, dica: string) => {
    const ativa = ord.col === col;
    return (
      <button
        type="button"
        onClick={() => clicar(col)}
        // o estado vai no nome acessível — a seta é decorativa
        aria-label={`Ordenar por ${dica}${
          ativa ? `: ${ord.dir === -1 ? "decrescente" : "crescente"}` : ""
        }`}
        title={`Ordenar por ${dica}`}
        className="inline-flex cursor-pointer items-center gap-1 rounded-sm transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {rotulo}
        <span aria-hidden className="w-3 text-[10px]">
          {ativa ? (ord.dir === -1 ? "↓" : "↑") : "↕"}
        </span>
      </button>
    );
  };

  const serieDe = (l: LinhaSuperficie) =>
    tendenciaParaSerie(l.tendencia, janela, agora);

  const spark = (l: LinhaSuperficie, valores: (number | null)[]) => {
    const nome = ROTULO_SUPERFICIE.get(l.superficie) ?? l.superficie;
    return (
      <Sparkline
        series={[
          {
            valores,
            rotulo: `gestos por dia em ${nome}`,
          },
        ]}
        min={0}
        max={Math.max(1, ...valores.map((v) => v ?? 0))}
        eixo={false}
        altura={28}
        compacto
        ariaLabel={`tendência diária de gestos em ${nome}: ${valores
          .map((v) => v ?? 0)
          .join(", ")}`}
      />
    );
  };

  const nomeDe = (l: LinhaSuperficie) =>
    ROTULO_SUPERFICIE.get(l.superficie) ?? l.superficie;

  const nomeSup = (l: LinhaSuperficie, cls?: string) => {
    const nome = nomeDe(l);
    const href = ROTA_SUPERFICIE[l.superficie];
    // só a superfície viva tem destino — evento de área aposentada (fora
    // do mapa de rotas) mostra o nome sem link
    return href ? (
      <Link
        href={href}
        className={cn(
          "underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          cls
        )}
      >
        {nome}
      </Link>
    ) : (
      <span className={cls}>{nome}</span>
    );
  };

  return (
    <>
      <div
        role="region"
        aria-label="Uso por superfície. Role horizontalmente"
        tabIndex={0}
        className="scroll-fina overflow-x-auto focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <table className="hidden w-full text-left text-[13px] sm:table">
          <thead>
            <tr className="text-xs text-muted-foreground">
              <th scope="col" className="py-1 pr-3 font-medium">
                superfície
              </th>
              <th
                scope="col"
                aria-sort={
                  ord.col === "gestos"
                    ? ord.dir === -1
                      ? "descending"
                      : "ascending"
                    : undefined
                }
                className="px-2 py-1 text-right font-medium"
              >
                {cabecalho("gestos", "gestos", "gestos no período")}
              </th>
              <th
                scope="col"
                aria-sort={
                  ord.col === "pessoas"
                    ? ord.dir === -1
                      ? "descending"
                      : "ascending"
                    : undefined
                }
                className="px-2 py-1 text-right font-medium"
              >
                {cabecalho("pessoas", "pessoas", "pessoas únicas")}
              </th>
              <th scope="col" className="px-2 py-1 font-medium">
                papéis
              </th>
              <th scope="col" className="px-2 py-1 text-right font-medium">
                tendência
              </th>
              <th
                scope="col"
                aria-sort={
                  ord.col === "ultimo"
                    ? ord.dir === -1
                      ? "descending"
                      : "ascending"
                    : undefined
                }
                className="py-1 pl-2 text-right font-medium"
              >
                {cabecalho("ultimo", "último uso", "último uso")}
              </th>
            </tr>
          </thead>
          {/* re-key na ordenação: a convenção pede animação em toda troca
              de sort — o remount re-roda o fade (o transform não aplica
              em table-row-group, a opacidade anima) */}
          <tbody key={`${ord.col}-${ord.dir}`} className="animate-enter">
            {ordenadas.map((l) => {
              const valores = serieDe(l);
              return (
                <tr
                  key={l.superficie}
                  className="border-t border-border/50 transition-colors hover:bg-muted/50"
                >
                  <td className="py-1.5 pr-3 font-medium whitespace-nowrap">
                    {nomeSup(l)}
                  </td>
                  <td className="px-2 py-1.5 text-right tabular-nums">
                    {FMT_INT.format(l.gestos)}
                  </td>
                  <td className="px-2 py-1.5 text-right tabular-nums">
                    {FMT_INT.format(l.pessoas)}
                  </td>
                  <td className="px-2 py-1.5">
                    <span className="flex flex-wrap gap-1">
                      {ordenaPapeis(l.papeis).map((p) => (
                        <span
                          key={p}
                          // rounded-md, não pill: o chip carrega dado,
                          // não é controle de filtro
                          className="rounded-md bg-muted px-2 py-0.5 text-[11px] font-medium whitespace-nowrap"
                        >
                          {ROTULO_PAPEL.get(p) ?? p}
                        </span>
                      ))}
                    </span>
                  </td>
                  <td className="px-2 py-1.5">
                    {valores && (
                      <div className="flex items-center justify-end gap-2">
                        <div className="w-20">{spark(l, valores)}</div>
                        <BadgeTendencia delta={deltaTendencia(valores)} />
                      </div>
                    )}
                  </td>
                  <td className="py-1.5 pl-2 text-right text-muted-foreground whitespace-nowrap">
                    {tempoRelativo(l.ultimo, agora)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* mobile: a tabela vira lista — nome (link), gestos·pessoas e a
          meta "N papéis · há N dias" à esquerda; spark+badge à direita.
          Mesmo array, mesmo fetch — só o desenho muda */}
      <ul className="divide-y divide-border/60 sm:hidden">
        {ordenadas.map((l) => {
          const valores = serieDe(l);
          return (
            <li
              key={l.superficie}
              className="relative flex items-center gap-3 py-2.5"
            >
              <div className="min-w-0 flex-1">
                {/* after:inset-0 estica o link pelo card inteiro — o nome
                    com 22px de altura deixaria o único drill mobile do
                    bloco abaixo do alvo de toque */}
                {nomeSup(
                  l,
                  "text-sm font-medium after:absolute after:inset-0"
                )}
                <p className="mt-0.5 text-xs tabular-nums text-muted-foreground">
                  {FMT_INT.format(l.gestos)}{" "}
                  {l.gestos === 1 ? "gesto" : "gestos"} ·{" "}
                  {FMT_INT.format(l.pessoas)}{" "}
                  {l.pessoas === 1 ? "pessoa" : "pessoas"}
                </p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  {l.papeis.length}{" "}
                  {l.papeis.length === 1 ? "papel" : "papéis"} ·{" "}
                  {tempoRelativo(l.ultimo, agora)}
                </p>
              </div>
              {valores && (
                <div className="w-20 shrink-0">
                  {spark(l, valores)}
                  <div className="mt-0.5 text-right">
                    <BadgeTendencia delta={deltaTendencia(valores)} />
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ul>

      {linhas.length === 0 && (
        <p className="py-6 text-center text-sm text-muted-foreground">
          Nenhuma superfície com uso neste recorte.
        </p>
      )}
    </>
  );
}
