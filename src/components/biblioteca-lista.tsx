"use client";

import { useEffect, useId, useMemo, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import {
  ArrowSquareOut,
  Check,
  MagnifyingGlass,
} from "@phosphor-icons/react";
import { AUDIENCIA_LABEL, audienciasDe, hrefMaterial, refDoMaterial } from "@/lib/materiais";
import { LinkComLeitura } from "@/components/material-leitura";
import { trackProduto } from "@/components/produto-telemetry";
import { sistemaDoDoc } from "@/lib/como-conduzir";
import type { Material } from "@/lib/types";
import { cn } from "@/lib/utils";
import { fuzzyMatch } from "@/lib/fuzzy";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { MaterialActions, MaterialMenu } from "@/components/material-actions";
import { MaterialCard, TIPO_ICONE } from "@/components/material-card";
import {
  BibliotecaViewToggle,
  useViewBiblioteca,
} from "@/components/biblioteca-view-toggle";
import { HighlightText } from "@/components/highlight-text";

// Biblioteca em seções por categoria (REALIZA-250): a lista única da
// REALIZA-210 misturava guia, modelo, roteiro e link — a coordenação não
// achava por tipo. Cada material cai em exatamente uma seção derivada de
// `tipo`; o encontro segue meta discreto da linha e a busca filtra dentro
// das seções (a que ficar vazia some). Ordem dentro de cada seção:
// encontro → ordem → título.

// TIPO_ICONE vem do material-card (a mesma anatomia de ícone nas duas
// views); o TIPO_LABEL daqui é a versão capitalizada da meta visível —
// o do card é minúsculo porque só serve ao sr-only
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
  { tipo: "template", rotulo: "Modelos" },
  { tipo: "conteudo", rotulo: "Conteúdos e roteiros" },
  { tipo: "link", rotulo: "Links" },
];

function ordena(a: Material, b: Material): number {
  const ea = a.encontro_num ?? 0;
  const eb = b.encontro_num ?? 0;
  return ea - eb || a.ordem - b.ordem || a.titulo.localeCompare(b.titulo, "pt-BR");
}

/** Contagem ao lado do título da seção: o dígito é decorativo (aria-hidden)
 *  e o leitor de tela ouve "N itens" — sem o sr-only o número colava no
 *  rótulo ("Guias2", "Todos os materiais de apoio33"). O espaço dentro do
 *  sr-only é o separador do nome acessível. */
function ContagemTitulo({ n }: { n: number }) {
  return (
    <span className="ml-1.5 font-normal tabular-nums text-muted-foreground">
      <span aria-hidden>{n}</span>
      <span className="sr-only"> {n === 1 ? "1 item" : `${n} itens`}</span>
    </span>
  );
}

/** "Guia · Encontro 3" — a meta tabular da linha e da linha do card. */
function metaTexto(m: Material): string {
  return [
    TIPO_LABEL[m.tipo],
    m.encontro_num != null ? `Encontro ${m.encontro_num}` : null,
  ]
    .filter(Boolean)
    .join(" · ");
}

/** Selos da meta — "instrumento oficial" (doc de instrumento ao vivo,
 *  REALIZA-386), "desta semana" (encontro vigente do mentor) e "lido"
 *  (0196). Compartilhados entre a linha e a linha do card. */
function SelosMaterial({
  m,
  vigente,
  lido,
}: {
  m: Material;
  vigente: number | null;
  lido: boolean;
}) {
  const ehDoc = m.path?.startsWith("doc:") ?? false;
  const ehInstrumento = ehDoc && sistemaDoDoc(m.path!.slice(4)) != null;
  const desta = vigente != null && m.encontro_num === vigente;
  return (
    <>
      {ehInstrumento && (
        <Badge variant="outline" className="text-[11px]">
          instrumento oficial
        </Badge>
      )}
      {desta && (
        <Badge variant="outline" className="text-[11px]">
          desta semana
        </Badge>
      )}
      {lido && (
        <Badge variant="outline" className="gap-1 text-[11px]">
          <Check size={10} aria-hidden />
          lido
        </Badge>
      )}
    </>
  );
}

/** Selos da coordenação: audiência (quando não é "todos") e "sem
 *  conteúdo" do material sem destino. Na linha ficam antes do ⋯; no
 *  card a audiência entra na meta e o "sem conteúdo" já sai no badge
 *  trailing do próprio card (semDestino) — mostrarDestino=false evita
 *  o selo duplicado. */
function SelosCoord({
  m,
  temDestino,
  mostrarDestino = true,
}: {
  m: Material;
  temDestino: boolean;
  mostrarDestino?: boolean;
}) {
  const aud = audienciasDe(m);
  return (
    <>
      {!aud.includes("todos") && (
        <Badge
          variant="outline"
          className="hidden gap-1 text-xs sm:inline-flex"
        >
          {aud.map((a) => AUDIENCIA_LABEL[a]).join(" · ")}
        </Badge>
      )}
      {mostrarDestino && !temDestino && (
        <Badge variant="outline" className="text-xs text-muted-foreground">
          sem conteúdo
        </Badge>
      )}
    </>
  );
}

export function Linha({
  m,
  ehCoord,
  maxEncontro,
  vigente,
  indice,
  marca,
  lido = false,
  docBase = "/materiais/documento",
  menu = null,
  rastrear = true,
}: {
  m: Material;
  ehCoord: boolean;
  /** teto do select "vincular ao encontro" — só entra quando ehCoord; o
   *  acervo do jovem reutiliza a linha sem régua de publicação. */
  maxEncontro?: number;
  vigente: number | null;
  indice: number;
  /** busca ativa — marca os trechos casados no título e na descrição */
  marca?: string;
  /** leitura já registrada (0196) — estado do item inteiro + selo "lido" */
  lido?: boolean;
  /** casa dos documentos nativos — a do acervo do jovem é outra rota. */
  docBase?: string;
  /** ⋯ de leitura (MaterialMenu) no fim da linha — simétrico ao canto do
   *  card; pra coord o bloco ehCoord + MaterialActions segue valendo. */
  menu?: ReactNode;
  /** marca a leitura no clique (staff); a linha do jovem mantém a âncora
   *  simples, como no card dele. */
  rastrear?: boolean;
}) {
  const Icone = TIPO_ICONE[m.tipo];
  // arquivo oficial ganha da url externa; "doc:<slug>" é documento nativo
  // (página do app); sem os três o material ainda não chegou ("em breve"
  // pro leitor, "sem conteúdo" pra coord que publica)
  const ehDoc = m.path?.startsWith("doc:") ?? false;
  const href = hrefMaterial(m, docBase);
  const meta = metaTexto(m);

  const corpo = (
    <>
      <span
        className={cn(
          "grid size-9 shrink-0 place-items-center rounded-lg bg-muted/70 text-muted-foreground",
          lido && "opacity-60"
        )}
      >
        <Icone size={17} aria-hidden />
      </span>
      <span className={cn("min-w-0 flex-1", lido && "opacity-60")}>
        {/* lido é estado do item inteiro (REALIZA-439): título sublinhado +
            conteúdo com opacidade — nunca só cor nem só o selo na meta */}
        <span
          className={cn(
            "block text-sm font-medium",
            lido &&
              "underline decoration-muted-foreground/40 underline-offset-2"
          )}
        >
          {marca ? <HighlightText texto={m.titulo} query={marca} /> : m.titulo}
        </span>
        {m.descricao && (
          <span className="mt-0.5 line-clamp-2 block text-xs text-muted-foreground">
            {marca ? (
              <HighlightText texto={m.descricao} query={marca} />
            ) : (
              m.descricao
            )}
          </span>
        )}
        <span className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
          {meta}
          <SelosMaterial m={m} vigente={vigente} lido={lido} />
        </span>
      </span>
    </>
  );
  const cls = "flex min-w-0 flex-1 items-center gap-x-3 px-4 py-3 sm:px-5";
  const linkCls = cn(
    cls,
    "rounded-lg transition-colors hover:bg-muted/50 active:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
  );
  const seta = !ehCoord && !ehDoc && (
    <ArrowSquareOut
      size={17}
      aria-hidden
      className="shrink-0 text-muted-foreground"
    />
  );

  return (
    <li
      className="animate-enter flex items-center pr-2 sm:pr-3"
      style={{ "--i": Math.min(indice, 10) } as CSSProperties}
    >
      {href ? (
        rastrear ? (
          <LinkComLeitura
            materialRef={refDoMaterial(m)}
            href={href}
            externo={!ehDoc}
            className={linkCls}
          >
            {corpo}
            {seta}
          </LinkComLeitura>
        ) : (
          <a
            href={href}
            {...(!ehDoc
              ? { target: "_blank", rel: "noopener noreferrer" }
              : {})}
            className={linkCls}
          >
            {corpo}
            {seta}
          </a>
        )
      ) : (
        <div className={cls}>
          {corpo}
          {!ehCoord && (
            <span className="shrink-0 text-xs text-muted-foreground">em breve</span>
          )}
        </div>
      )}
      {ehCoord ? (
        <span className="flex shrink-0 items-center gap-2">
          <SelosCoord m={m} temDestino={href != null} />
          <MaterialActions material={m} maxEncontro={maxEncontro} />
        </span>
      ) : (
        menu
      )}
    </li>
  );
}

export function BibliotecaLista({
  materiais,
  ehCoord = false,
  maxEncontro = 16,
  vigente = null,
  titulo = "Todos os materiais de apoio",
  lidos,
}: {
  materiais: Material[];
  ehCoord?: boolean;
  maxEncontro?: number;
  /** encontro da semana (mentor) — marca as linhas dele. */
  vigente?: number | null;
  titulo?: string;
  /** refs já lidas pelo usuário (0196) — selo "lido" na linha. */
  lidos?: Set<string>;
}) {
  const [busca, setBusca] = useState("");
  const [view] = useViewBiblioteca("staff");
  const baseId = useId();
  const buscaQ = busca.trim();
  // adoção (0197): emite o gesto depois de 800ms parado — cada tecla não é
  // uma busca; o texto nunca sai daqui (só o comprimento, zero conteúdo)
  useEffect(() => {
    if (!buscaQ) return;
    const t = setTimeout(() => trackProduto("busca", { len: buscaQ.length }), 800);
    return () => clearTimeout(t);
  }, [buscaQ]);
  const ordenados = useMemo(() => [...materiais].sort(ordena), [materiais]);
  const qt = buscaQ;
  // busca fuzzy (REALIZA-391): título, descrição e o tipo visível pesquisam;
  // o score do melhor campo ranqueia dentro de cada seção
  const scoreDe = (m: Material) =>
    qt
      ? Math.max(
          ...[m.titulo, m.descricao, TIPO_LABEL[m.tipo]].map(
            (t) => (t ? (fuzzyMatch(qt, t)?.score ?? 0) : 0)
          )
        )
      : 0;
  const visiveis = qt
    ? ordenados
        .filter((m) => scoreDe(m) > 0)
        .sort((a, b) => scoreDe(b) - scoreDe(a) || ordena(a, b))
    : ordenados;

  return (
    <section aria-labelledby="biblioteca-titulo" className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <h2 id="biblioteca-titulo" className="text-base font-semibold">
          {titulo}
          <ContagemTitulo n={materiais.length} />
        </h2>
        <div className="flex w-full items-center gap-2 sm:w-auto">
          <BibliotecaViewToggle superficie="staff" total={materiais.length} />
          {materiais.length > 6 && (
            <label className="relative min-w-0 flex-1 sm:w-72 sm:flex-none">
              <span className="sr-only">Buscar material de apoio</span>
              <MagnifyingGlass
                size={15}
                aria-hidden
                className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground"
              />
              <Input
                type="search"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar material de apoio"
                className="pl-8"
              />
            </label>
          )}
        </div>
      </div>
      {visiveis.length === 0 ? (
        <p className="rounded-xl border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">
          Nenhum material com “{busca.trim()}”.
        </p>
      ) : (
        // re-key na busca e na view: as seções remontam e a entrada anima
        // (convenção de movimento — troca de filtro nunca é repaint seco)
        <div key={`${qt}:${view}`} className="space-y-5">
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
                  <ContagemTitulo n={itens.length} />
                </h3>
                {view === "list" ? (
                  <ul className="divide-y divide-border/60 overflow-hidden rounded-xl bg-card py-1 shadow-[var(--shadow-border)]">
                    {itens.map((m, i) => (
                      <Linha
                        key={m.id}
                        m={m}
                        ehCoord={ehCoord}
                        maxEncontro={maxEncontro}
                        vigente={vigente}
                        indice={i}
                        marca={qt || undefined}
                        lido={lidos?.has(refDoMaterial(m))}
                        menu={<MaterialMenu material={m} />}
                      />
                    ))}
                  </ul>
                ) : (
                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    {itens.map((m, i) => (
                      <MaterialCard
                        key={m.id}
                        m={m}
                        className="animate-enter"
                        style={{ "--i": Math.min(i, 10) } as CSSProperties}
                        marca={qt || undefined}
                        rastrear
                        lido={lidos?.has(refDoMaterial(m))}
                        semDestino={ehCoord ? "sem conteúdo" : "em breve"}
                        acoes={
                          ehCoord ? (
                            <MaterialActions
                              material={m}
                              maxEncontro={maxEncontro}
                            />
                          ) : (
                            <MaterialMenu material={m} />
                          )
                        }
                        acoesSempre={ehCoord}
                        meta={
                          <span className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                            {metaTexto(m)}
                            <SelosMaterial
                              m={m}
                              vigente={vigente}
                              lido={lidos?.has(refDoMaterial(m)) ?? false}
                            />
                            {ehCoord && (
                              <SelosCoord
                                m={m}
                                temDestino={hrefMaterial(m) != null}
                                mostrarDestino={false}
                              />
                            )}
                          </span>
                        }
                      />
                    ))}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      )}
    </section>
  );
}
