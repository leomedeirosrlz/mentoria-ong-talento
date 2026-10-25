"use client";

import { useMemo, useState } from "react";
import type { CSSProperties } from "react";
import {
  ArrowSquareOut,
  BookOpen,
  FileText,
  LinkSimple,
  MagnifyingGlass,
  PuzzlePiece,
} from "@phosphor-icons/react";
import { linkSeguro } from "@/lib/ciclo";
import type { Material } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { MaterialActions } from "@/components/material-actions";

// Biblioteca em lista única (REALIZA-210): todos os materiais num card só,
// sem agrupar por encontro, tipo ou público — o agrupamento adicionava
// atrito (abrir dropdown pra achar um arquivo). O encontro vira um meta
// discreto na linha; a busca resolve o "onde está". Ordem: referência do
// programa primeiro (guias e modelos sem encontro), depois por encontro.

const TIPO_ICONE = {
  guia: BookOpen,
  template: FileText,
  conteudo: PuzzlePiece,
  link: LinkSimple,
} as const;

const TIPO_LABEL = {
  guia: "Guia",
  template: "Modelo",
  conteudo: "Conteúdo",
  link: "Link",
} as const;

const AUDIENCIA_LABEL = {
  todos: "todos",
  dpp: "mentores DPP",
  especialista: "especialistas",
  coordenacao: "coordenação",
} as const;

/** sem acento e minúsculo — "visao" acha "Visão". */
function normaliza(s: string): string {
  return s
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

function ordena(a: Material, b: Material): number {
  const ea = a.encontro_num ?? 0;
  const eb = b.encontro_num ?? 0;
  return ea - eb || a.ordem - b.ordem || a.titulo.localeCompare(b.titulo, "pt-BR");
}

function Linha({
  m,
  ehCoord,
  maxEncontro,
  vigente,
  indice,
}: {
  m: Material;
  ehCoord: boolean;
  maxEncontro: number;
  vigente: number | null;
  indice: number;
}) {
  const Icone = TIPO_ICONE[m.tipo];
  // arquivo oficial ganha da url externa; sem os dois o material ainda não
  // chegou ("em breve" pro leitor, "sem conteúdo" pra coord que publica)
  const urlOk = linkSeguro(m.url);
  const href = m.path ? `/api/material/${m.id}` : urlOk;
  const meta = [
    TIPO_LABEL[m.tipo],
    m.encontro_num != null ? `Encontro ${m.encontro_num}` : null,
  ]
    .filter(Boolean)
    .join(" · ");
  const desta = vigente != null && m.encontro_num === vigente;

  const corpo = (
    <>
      <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-muted/70 text-muted-foreground">
        <Icone size={17} aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium">{m.titulo}</span>
        {m.descricao && (
          <span className="mt-0.5 line-clamp-2 block text-xs text-muted-foreground">
            {m.descricao}
          </span>
        )}
        <span className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
          {meta}
          {desta && <Badge variant="outline" className="text-[11px]">desta semana</Badge>}
        </span>
      </span>
    </>
  );
  const cls = "flex min-w-0 flex-1 items-center gap-x-3 px-4 py-3 sm:px-5";

  return (
    <li
      className="animate-enter flex items-center pr-2 sm:pr-3"
      style={{ "--i": Math.min(indice, 10) } as CSSProperties}
    >
      {href ? (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className={cn(
            cls,
            "rounded-lg transition-colors hover:bg-muted/50 active:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
          )}
        >
          {corpo}
          {!ehCoord && (
            <ArrowSquareOut size={17} aria-hidden className="shrink-0 text-muted-foreground" />
          )}
        </a>
      ) : (
        <div className={cls}>
          {corpo}
          {!ehCoord && (
            <span className="shrink-0 text-xs text-muted-foreground">em breve</span>
          )}
        </div>
      )}
      {ehCoord && (
        <span className="flex shrink-0 items-center gap-2">
          {m.audiencia !== "todos" && (
            <Badge variant="outline" className="hidden text-xs sm:inline-flex">
              {AUDIENCIA_LABEL[m.audiencia]}
            </Badge>
          )}
          {!href && (
            <Badge variant="outline" className="text-xs text-muted-foreground">
              sem conteúdo
            </Badge>
          )}
          <MaterialActions material={m} maxEncontro={maxEncontro} />
        </span>
      )}
    </li>
  );
}

export function BibliotecaLista({
  materiais,
  ehCoord = false,
  maxEncontro = 16,
  vigente = null,
  titulo = "Todos os materiais",
}: {
  materiais: Material[];
  ehCoord?: boolean;
  maxEncontro?: number;
  /** encontro da semana (mentor) — marca as linhas dele. */
  vigente?: number | null;
  titulo?: string;
}) {
  const [busca, setBusca] = useState("");
  const ordenados = useMemo(() => [...materiais].sort(ordena), [materiais]);
  const q = normaliza(busca.trim());
  const visiveis = q
    ? ordenados.filter((m) =>
        normaliza(`${m.titulo} ${m.descricao ?? ""} ${TIPO_LABEL[m.tipo]}`).includes(q)
      )
    : ordenados;

  return (
    <section aria-labelledby="biblioteca-titulo" className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <h2 id="biblioteca-titulo" className="text-base font-semibold">
          {titulo}
          <span className="ml-1.5 font-normal text-muted-foreground tabular-nums">
            {materiais.length}
          </span>
        </h2>
        {materiais.length > 6 && (
          <label className="relative w-full sm:w-72">
            <span className="sr-only">Buscar material</span>
            <MagnifyingGlass
              size={15}
              aria-hidden
              className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              type="search"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar material"
              className="pl-8"
            />
          </label>
        )}
      </div>
      {visiveis.length === 0 ? (
        <p className="rounded-xl border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">
          Nenhum material com “{busca.trim()}”.
        </p>
      ) : (
        // re-key na busca: a lista remonta e a entrada anima (convenção de
        // movimento — troca de filtro nunca é repaint seco)
        <ul
          key={q}
          className="divide-y divide-border/60 overflow-hidden rounded-xl bg-card py-1 shadow-[var(--shadow-border)]"
        >
          {visiveis.map((m, i) => (
            <Linha
              key={m.id}
              m={m}
              ehCoord={ehCoord}
              maxEncontro={maxEncontro}
              vigente={vigente}
              indice={i}
            />
          ))}
        </ul>
      )}
    </section>
  );
}
