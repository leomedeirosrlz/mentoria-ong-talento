"use client";

import { useId, useMemo, useState } from "react";
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
import { AUDIENCIA_LABEL, audienciasDe } from "@/lib/materiais";
import type { Material } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { MaterialActions } from "@/components/material-actions";

// Biblioteca em seções por categoria (REALIZA-250): a lista única da
// REALIZA-210 misturava guia, modelo, roteiro e link — a coordenação não
// achava por tipo. Cada material cai em exatamente uma seção derivada de
// `tipo`; o encontro segue meta discreto da linha e a busca filtra dentro
// das seções (a que ficar vazia some). Ordem dentro de cada seção:
// encontro → ordem → título.

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

/** Seções da biblioteca na ordem de leitura — todo `tipo` tem uma casa:
 *  o material aparece em exatamente uma categoria, sem sobrar fora. */
const CATEGORIAS: { tipo: Material["tipo"]; rotulo: string }[] = [
  { tipo: "guia", rotulo: "Guias" },
  { tipo: "template", rotulo: "Modelos e instrumentos" },
  { tipo: "conteudo", rotulo: "Conteúdos e roteiros" },
  { tipo: "link", rotulo: "Links" },
];

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
  // arquivo oficial ganha da url externa; "doc:<slug>" é documento nativo
  // (página do app); sem os três o material ainda não chegou ("em breve"
  // pro leitor, "sem conteúdo" pra coord que publica)
  const urlOk = linkSeguro(m.url);
  const ehDoc = m.path?.startsWith("doc:") ?? false;
  const href = ehDoc
    ? `/materiais/documento/${m.path!.slice(4)}`
    : m.path
      ? `/api/material/${m.id}`
      : urlOk;
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
          {...(ehDoc ? {} : { target: "_blank", rel: "noopener noreferrer" })}
          className={cn(
            cls,
            "rounded-lg transition-colors hover:bg-muted/50 active:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
          )}
        >
          {corpo}
          {!ehCoord && !ehDoc && (
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
          {(() => {
            const aud = audienciasDe(m);
            if (aud.includes("todos")) return null;
            return (
              <Badge variant="outline" className="hidden gap-1 text-xs sm:inline-flex">
                {aud.map((a) => AUDIENCIA_LABEL[a]).join(" · ")}
              </Badge>
            );
          })()}
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
  const baseId = useId();
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
        // re-key na busca: as seções remontam e a entrada anima (convenção
        // de movimento — troca de filtro nunca é repaint seco)
        <div key={q} className="space-y-5">
          {CATEGORIAS.map(({ tipo, rotulo }) => {
            const itens = visiveis.filter((m) => m.tipo === tipo);
            if (itens.length === 0) return null;
            return (
              <section key={tipo} aria-labelledby={`${baseId}-${tipo}`}>
                <h3
                  id={`${baseId}-${tipo}`}
                  className="mb-2 text-sm font-semibold"
                >
                  {rotulo}
                  <span className="ml-1.5 font-normal tabular-nums text-muted-foreground">
                    {itens.length}
                  </span>
                </h3>
                <ul className="divide-y divide-border/60 overflow-hidden rounded-xl bg-card py-1 shadow-[var(--shadow-border)]">
                  {itens.map((m, i) => (
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
              </section>
            );
          })}
        </div>
      )}
    </section>
  );
}
