import Link from "next/link";
import {
  ArrowLeft,
  CaretDown,
  ListBullets,
} from "@phosphor-icons/react/dist/ssr";
import type {
  CorpusDoc,
  CorpusGrupo,
} from "@/lib/materiais/corpus-doc";
import { gruposCorpus } from "@/lib/materiais/corpus-doc";
import { DocBlocos, DocumentoHero } from "./material-documento";

// Documento do corpus RAG (docs/rag/*.md) renderizado nativamente — mesma
// gramática visual dos templates (DocumentoHero + DocBlocos), mas com a
// estrutura do documento: lede, seções ##/### agrupadas, âncora por seção
// (id = secaoAnchor, o mesmo slug que o assistente usa pra citar a fonte) e
// sumário colapsável nos guias longos.

const TOC_MINIMO = 8; // acima de 8 seções o sumário aparece no topo

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

/** "#" discreto no heading — vira o link copiável da seção (o heading em si
 *  também é link pra própria âncora). Só aparece no hover/focus. */
function LinkSecao({ anchor, titulo }: { anchor: string; titulo: string }) {
  return (
    <a
      href={`#${anchor}`}
      aria-label={`Link direto para a seção ${titulo}`}
      title="Link direto para esta seção"
      className="ml-2 text-sm font-normal text-muted-foreground/50 no-underline opacity-0 transition-opacity hover:text-foreground focus-visible:opacity-100 group-hover:opacity-100 print:hidden"
    >
      #
    </a>
  );
}

function GrupoSecao({ grupo }: { grupo: CorpusGrupo }) {
  return (
    <section>
      <h2
        id={grupo.anchor}
        className="group scroll-mt-20 text-base font-semibold tracking-tight sm:text-lg md:scroll-mt-8"
      >
        <a
          href={`#${grupo.anchor}`}
          className="decoration-muted-foreground/40 underline-offset-4 hover:underline"
        >
          {grupo.titulo}
        </a>
        <LinkSecao anchor={grupo.anchor} titulo={grupo.titulo} />
      </h2>
      {grupo.intro ? (
        <div className="mt-3 space-y-3">
          <DocBlocos blocos={grupo.intro.blocos} />
        </div>
      ) : null}
      {grupo.subs.map((s) => (
        <section key={s.anchor} className="mt-5">
          <h3
            id={s.anchor}
            className="group scroll-mt-20 text-sm font-semibold md:scroll-mt-8"
          >
            <a
              href={`#${s.anchor}`}
              className="decoration-muted-foreground/40 underline-offset-4 hover:underline"
            >
              {s.titulo}
            </a>
            <LinkSecao anchor={s.anchor} titulo={s.titulo} />
          </h3>
          <div className="mt-2 space-y-3">
            <DocBlocos blocos={s.blocos} />
          </div>
        </section>
      ))}
    </section>
  );
}

/** Sumário colapsável (<details> nativo, mesmo padrão da agenda) com os dois
 *  níveis de seção — linka nas âncoras. Some no print: as seções já saem
 *  abertas no papel. */
function Sumario({ grupos, total }: { grupos: CorpusGrupo[]; total: number }) {
  return (
    <details className="group mt-6 overflow-hidden rounded-xl bg-card shadow-[var(--shadow-border)] print:hidden">
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
        <ol className="space-y-0.5">
          {grupos.map((g) => (
            <li key={g.anchor}>
              <a
                href={`#${g.anchor}`}
                className="block rounded-md px-2 py-1 text-sm hover:bg-muted/60"
              >
                {g.titulo}
              </a>
              {g.subs.length > 0 ? (
                <ol className="mb-1.5 ml-4 mt-0.5 space-y-0.5 border-l border-border/60 pl-3">
                  {g.subs.map((s) => (
                    <li key={s.anchor}>
                      <a
                        href={`#${s.anchor}`}
                        className="block rounded-md px-2 py-0.5 text-[13px] text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                      >
                        {s.titulo}
                      </a>
                    </li>
                  ))}
                </ol>
              ) : null}
            </li>
          ))}
        </ol>
      </nav>
    </details>
  );
}

/** Corpo do documento: lede + sumário + seções. Exportado separado do shell
 *  (sem o Link de "voltar") pra render direto em teste. */
export function CorpusDocBody({ doc }: { doc: CorpusDoc }) {
  const grupos = gruposCorpus(doc.secoes);
  return (
    <>
      {doc.lede.length > 0 ? (
        <section
          id={doc.ledeAnchor ?? undefined}
          aria-label="Introdução"
          className="mt-5 space-y-3"
        >
          <DocBlocos blocos={doc.lede} />
        </section>
      ) : null}

      {doc.secoes.length > TOC_MINIMO ? (
        <Sumario grupos={grupos} total={doc.secoes.length} />
      ) : null}

      <div className="mt-6 space-y-8">
        {grupos.map((g) => (
          <GrupoSecao key={g.anchor} grupo={g} />
        ))}
      </div>
    </>
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
    // versao no frontmatter carrega notas editoriais entre parenteses
    // ("documento nativo em /materiais/...") — a meta exibe so o status
    doc.versao ? capitalizar(doc.versao.replace(/\s*\([^)]*\)/g, "").trim()) : null,
    doc.natureza ? (NATUREZA_ROTULO[doc.natureza] ?? null) : null,
    `${doc.secoes.length} seções`,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <main className="mx-auto max-w-3xl px-4 py-6 print:px-0">
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
