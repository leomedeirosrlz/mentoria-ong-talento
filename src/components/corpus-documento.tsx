import Link from "next/link";
import {
  ArrowLeft,
  CaretDown,
  ListBullets,
} from "@phosphor-icons/react/dist/ssr";
import type {
  CorpusDoc,
  CorpusGrupo,
  CorpusSecao,
} from "@/lib/materiais/corpus-doc";
import { gruposCorpus } from "@/lib/materiais/corpus-doc";
import { cn } from "@/lib/utils";
import { DocBlocos, DocumentoHero, LinkSecao } from "./material-documento";

// RAG corpus document (docs/rag/*.md) rendered natively — the PDF guide's
// visual grammar: ink hero, navy h2 with the full-width lime rule, caps
// eyebrow on the "X · Título" prefix, encounter cards, callouts, charcoal
// tables and a TOC with lime marker + dotted leader (collapsible on
// mobile, sticky rail at xl on long guides). The per-section anchor
// (id = secaoAnchor) is the same slug the assistant uses to cite the
// source — headings link to their own anchor, no JS.

const TOC_MINIMO = 8; // above 8 sections the TOC shows at the top

const TIPO_ROTULO: Record<string, string> = {
  guia: "Guia",
  operacao: "Operação",
  instrumento: "Instrumento",
  conteudo: "Conteúdo",
  template: "Template",
  termo: "Termo",
};

const NATUREZA_ROTULO: Record<string, string> = {
  transcrito: "Documento oficial transcrito",
  consolidado: "Consolidado dos guias do programa",
  "sintese-operacional": "Síntese operacional da plataforma",
};

function capitalizar(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** "PDM · Onde fica na plataforma" → eyebrow "PDM" + title "Onde fica na
 *  plataforma". The corpus ` · ` separator always marks parent·child
 *  (phase, instrument, chapter); a title without it has no eyebrow. */
function eyebrowDe(titulo: string): { eyebrow: string | null; resto: string } {
  const m = /^(.{1,40}?)\s+·\s+(.+)$/.exec(titulo);
  return m ? { eyebrow: m[1], resto: m[2] } : { eyebrow: null, resto: titulo };
}

/** The guide's h2: caps lime eyebrow (when the title carries "X · ") +
 *  navy bold title + the full-width lime rule below — the guide's
 *  signature. */
function TituloGrupo({ grupo }: { grupo: CorpusGrupo }) {
  const { eyebrow, resto } = eyebrowDe(grupo.titulo);
  return (
    <h2 id={grupo.anchor} className="group scroll-mt-20 md:scroll-mt-8">
      {eyebrow ? (
        <span className="mb-1 block text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--ring)]">
          {eyebrow}
        </span>
      ) : null}
      <span className="block border-b-2 border-[var(--brand-lime)] pb-2 text-lg font-semibold tracking-tight text-foreground sm:text-xl">
        <a
          href={`#${grupo.anchor}`}
          className="decoration-muted-foreground/40 underline-offset-4 hover:underline"
        >
          {resto}
        </a>
        <LinkSecao anchor={grupo.anchor} titulo={grupo.titulo} />
      </span>
    </h2>
  );
}

/** h3: navy bold, no rule (the eyebrow applies here too — "Momento N · …"
 *  and the routes' "Nº encontro · …" come out in caps lime). */
function TituloSub({ s }: { s: CorpusSecao }) {
  const { eyebrow, resto } = eyebrowDe(s.titulo);
  return (
    <h3 id={s.anchor} className="group scroll-mt-20 md:scroll-mt-8">
      {eyebrow ? (
        <span className="mb-0.5 block text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--ring)]">
          {eyebrow}
        </span>
      ) : null}
      <a
        href={`#${s.anchor}`}
        className="text-[15px] font-semibold decoration-muted-foreground/40 underline-offset-4 hover:underline sm:text-base"
      >
        {resto}
      </a>
      <LinkSecao anchor={s.anchor} titulo={s.titulo} />
    </h3>
  );
}

function GrupoSecao({ grupo }: { grupo: CorpusGrupo }) {
  return (
    <section>
      <TituloGrupo grupo={grupo} />
      {grupo.intro ? (
        <div className="mt-3 space-y-3">
          <DocBlocos blocos={grupo.intro.blocos} />
        </div>
      ) : null}
      {grupo.subs.map((s) => (
        <section key={s.anchor} className="mt-5">
          {s.blocos[0]?.kind === "encontro" ? (
            // encounter section: the card itself carries heading + anchor
            <DocBlocos blocos={s.blocos} />
          ) : (
            <>
              <TituloSub s={s} />
              <div className="mt-2 space-y-3">
                <DocBlocos blocos={s.blocos} />
              </div>
            </>
          )}
        </section>
      ))}
    </section>
  );
}

/** TOC item: lime marker + title + dotted leader — the guide's printed
 *  TOC rite. */
function SumarioItem({
  anchor,
  titulo,
  sub,
}: {
  anchor: string;
  titulo: string;
  sub?: boolean;
}) {
  return (
    <a
      href={`#${anchor}`}
      className={cn(
        "flex items-baseline gap-2.5 rounded-md py-1 text-sm hover:bg-muted/60",
        sub ? "px-2 py-0.5 text-[13px] text-muted-foreground hover:text-foreground" : "px-2"
      )}
    >
      <span
        aria-hidden
        className={cn(
          "shrink-0 self-center rounded-full bg-[var(--brand-lime)]",
          sub ? "size-1" : "size-1.5"
        )}
      />
      <span className="min-w-0">{titulo}</span>
      <span
        aria-hidden
        className="ml-1 min-w-4 flex-1 border-b border-dotted border-muted-foreground/40"
      />
    </a>
  );
}

function SumarioLista({ grupos }: { grupos: CorpusGrupo[] }) {
  return (
    <ol className="space-y-0.5">
      {grupos.map((g) => (
        <li key={g.anchor}>
          <SumarioItem anchor={g.anchor} titulo={g.titulo} />
          {g.subs.length > 0 ? (
            <ol className="mb-1.5 ml-4 mt-0.5 space-y-0.5 border-l border-border/60 pl-3">
              {g.subs.map((s) => (
                <li key={s.anchor}>
                  <SumarioItem anchor={s.anchor} titulo={s.titulo} sub />
                </li>
              ))}
            </ol>
          ) : null}
        </li>
      ))}
    </ol>
  );
}

/** Collapsible TOC (native <details>, same pattern as the agenda) with both
 *  section levels — links to the anchors. Hidden at xl (the side rail takes
 *  over) and in print: sections already come out open on paper. */
function Sumario({ grupos, total }: { grupos: CorpusGrupo[]; total: number }) {
  return (
    <details className="group mt-6 overflow-hidden rounded-xl bg-card shadow-[var(--shadow-border)] xl:hidden print:hidden">
      <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2.5 px-4 py-3 text-sm font-medium select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
        <ListBullets
          size={16}
          className="shrink-0 text-muted-foreground"
          aria-hidden
        />
        Neste documento
        <span className="ml-1 text-xs font-normal text-muted-foreground">
          {total} seções
        </span>
        <CaretDown
          size={14}
          className="ml-auto shrink-0 text-muted-foreground transition-transform group-open:rotate-180"
          aria-hidden
        />
      </summary>
      <nav
        aria-label="Sumário do documento"
        className="scroll-fina max-h-96 overflow-y-auto border-t border-border/60 px-3 py-3"
      >
        <SumarioLista grupos={grupos} />
      </nav>
    </details>
  );
}

/** Side TOC rail on long guides — sticky, always open, xl only (below that
 *  the top <details> takes over). */
function SumarioRail({
  grupos,
  total,
}: {
  grupos: CorpusGrupo[];
  total: number;
}) {
  return (
    <nav
      aria-label="Sumário do documento"
      className="scroll-fina sticky top-14 hidden max-h-[calc(100vh-4.5rem)] self-start overflow-y-auto pb-4 xl:block print:hidden"
    >
      <p className="px-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
        Neste documento
        <span className="ml-1 font-normal normal-case tracking-normal">
          {total} seções
        </span>
      </p>
      <div className="mt-3">
        <SumarioLista grupos={grupos} />
      </div>
    </nav>
  );
}

/** Document body: lede + TOC + sections. Exported apart from the shell
 *  (without the "back" Link) for direct render in tests. */
export function CorpusDocBody({ doc }: { doc: CorpusDoc }) {
  const grupos = gruposCorpus(doc.secoes);
  const longo = doc.secoes.length > TOC_MINIMO;
  return (
    <div className={cn("mt-5", longo && "xl:grid xl:grid-cols-[15rem_minmax(0,1fr)] xl:gap-10")}>
      {longo ? <SumarioRail grupos={grupos} total={doc.secoes.length} /> : null}
      <div className="min-w-0">
        {doc.lede.length > 0 ? (
          <section
            id={doc.ledeAnchor ?? undefined}
            aria-label="Introdução"
            className="space-y-3"
          >
            <DocBlocos blocos={doc.lede} />
          </section>
        ) : null}

        {longo ? <Sumario grupos={grupos} total={doc.secoes.length} /> : null}

        <div className="mt-6 space-y-8">
          {grupos.map((g) => (
            <GrupoSecao key={g.anchor} grupo={g} />
          ))}
        </div>
      </div>
    </div>
  );
}

export function CorpusDocumento({
  doc,
  voltar,
}: {
  doc: CorpusDoc;
  voltar: { href: string; rotulo: string };
}) {
  const meta = [
    // the frontmatter version carries parenthesized editorial notes
    // ("documento nativo em /materiais/...") — meta shows only the status
    doc.versao ? capitalizar(doc.versao.replace(/\s*\([^)]*\)/g, "").trim()) : null,
    doc.natureza ? (NATUREZA_ROTULO[doc.natureza] ?? null) : null,
    `${doc.secoes.length} seções`,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <main
      className={cn(
        "mx-auto max-w-3xl px-4 py-6 print:px-0",
        // long guides get the TOC rail — make room for the column
        doc.secoes.length > TOC_MINIMO && "xl:max-w-5xl"
      )}
    >
      <Link
        href={voltar.href}
        className="mb-4 inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground print:hidden"
      >
        <ArrowLeft size={13} aria-hidden />
        {voltar.rotulo}
      </Link>

      <DocumentoHero
        kicker={TIPO_ROTULO[doc.tipo ?? ""] ?? "Documento"}
        titulo={doc.titulo}
        meta={meta}
      />

      <CorpusDocBody doc={doc} />

      <footer className="mt-8 border-t border-border/60 pt-3 text-xs text-muted-foreground">
        {doc.origem ?? `Fonte: ${doc.fonte}.`}
      </footer>
    </main>
  );
}
