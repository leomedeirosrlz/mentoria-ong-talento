import Link from "next/link";
import { Fragment, type ReactNode } from "react";
import {
  ArrowLeft,
  BookOpen,
  Buildings,
  Calendar,
  CaretDown,
  ChartBar,
  Chats,
  ChatsCircle,
  Compass,
  EnvelopeOpen,
  Files,
  Flag,
  FlagCheckered,
  GraduationCap,
  Handshake,
  Info,
  ListBullets,
  ListChecks,
  MapTrifold,
  MonitorPlay,
  Question,
  Sparkle,
  SteeringWheel,
  Target,
  Toolbox,
  UserCheck,
  Users,
  UsersThree,
} from "@phosphor-icons/react/dist/ssr";
import type {
  CorpusDoc,
  CorpusGrupo,
  CorpusJornada,
  CorpusSecao,
} from "@/lib/materiais/corpus-doc";
import {
  gruposCorpus,
  jornadaCorpus,
  normTitulo,
  tomDeFase,
  tomSemantico,
} from "@/lib/materiais/corpus-doc";
import type { DocTom } from "@/lib/materiais-documentos";
import { cn } from "@/lib/utils";
import {
  DocBlocos,
  DocumentoHero,
  LinkSecao,
  TOM_DOC,
} from "./material-documento";

// RAG corpus document (docs/rag/*.md) rendered natively — the PDF guide's
// visual grammar: ink hero, keyword icons and the full-width lime rule on
// h2, rotating phase bands for the journey's month groups, the clickable
// 16-dot journey strip, encounter cards, callouts, charcoal tables and a
// TOC with tone markers + dotted leader (sticky collapsible pill below xl,
// sticky rail at xl on long guides). The per-section anchor (id = secaoAnchor)
// is the same slug the assistant uses to cite the source — headings link
// to their own anchor, no JS.

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

// h2 icon by exact keyword in the normalized title (word boundary) — the
// first match wins; a title with no keyword keeps no icon, never a
// placeholder. Mirrors the PDF's chapter pictograms.
const H2_ICONE: [RegExp, typeof Info][] = [
  [/\bcarta\b/, EnvelopeOpen],
  [/\binstituto\b/, Buildings],
  [/\bintroducao\b/, Compass],
  [/\bjornada\b/, MapTrifold],
  [/\bplataforma\b/, MonitorPlay],
  [/\bfuncoes\b/, Sparkle],
  [/\binstrumentos\b/, Toolbox],
  [/\bperguntas\b/, Question],
  [/\bfeedback\b/, ChatsCircle],
  [/\b(?:pdm|plano)\b/, Target],
  [/\b(?:visao|metas)\b/, Flag],
  [/\broda\b/, SteeringWheel],
  [/\b(?:matching|duplas)\b/, Handshake],
  [/\b(?:cronograma|ritmo)\b/, Calendar],
  [/\bencontros\b/, UsersThree],
  [/\b(?:ferramentas|comunicacao)\b/, Chats],
  [/\b(?:avaliacao|suporte)\b/, ChartBar],
  [/\b(?:conteudo|complementar)\b/, BookOpen],
  [/\b(?:consideracoes|finais)\b/, FlagCheckered],
  [/\btemplates\b/, Files],
  [/\bchecklist\b/, ListChecks],
  [/\b(?:pre-requisitos|equipe)\b/, Users],
  [/\b(?:dedicacao|formacao)\b/, GraduationCap],
  [/\bperfil\b/, UserCheck],
];

// returns the node, not the type — JSX on a render-scope variable trips
// react-hooks/static-components (property lookups are the project's
// workaround everywhere else; a regex scan needs the function instead)
function iconeTitulo(titulo: string, className: string): ReactNode {
  const t = normTitulo(titulo);
  for (const [re, Icone] of H2_ICONE) {
    if (re.test(t)) {
      return <Icone size={20} aria-hidden className={className} />;
    }
  }
  return null;
}

/** The guide's h2 in two shapes: phase sections (grupo.fase) render as the
 *  PDF's full-width band — tinted bg of the rotating tone + caps eyebrow +
 *  icon + title + the tone's accent bar; regular sections keep the caps
 *  lime eyebrow + navy bold title + the full-width lime rule. */
function TituloGrupo({ grupo, num }: { grupo: CorpusGrupo; num: number }) {
  const { eyebrow, resto } = eyebrowDe(grupo.titulo);
  const tom = grupo.fase != null ? TOM_DOC[tomDeFase(grupo.fase)] : null;
  // número do capítulo na posição do eyebrow — "05 · PDM" ou só "05"
  const rotulo = `${String(num).padStart(2, "0")}${eyebrow ? ` · ${eyebrow}` : ""}`;
  const titulo = (
    <>
      {iconeTitulo(
        grupo.titulo,
        cn("shrink-0", tom ? tom.forte : "text-[var(--ring)]")
      )}
      <a
        href={`#${grupo.anchor}`}
        className="decoration-muted-foreground/40 underline-offset-4 hover:underline"
      >
        {resto}
      </a>
      <LinkSecao anchor={grupo.anchor} titulo={grupo.titulo} />
    </>
  );
  if (tom) {
    return (
      <h2 id={grupo.anchor} className="group scroll-mt-20 md:scroll-mt-8">
        <div className={cn("rounded-xl px-4 py-4 sm:px-5", tom.banda)}>
          <span
            className={cn(
              "mb-1 block text-[11px] font-bold uppercase tracking-[0.14em]",
              tom.forte
            )}
          >
            {rotulo}
          </span>
          <span className="flex items-center gap-2.5 text-lg font-semibold tracking-tight text-foreground sm:text-xl">
            {titulo}
          </span>
          <span
            aria-hidden
            className={cn("mt-3 block h-[3px] w-12 rounded-full", tom.barra)}
          />
        </div>
      </h2>
    );
  }
  return (
    <h2 id={grupo.anchor} className="group scroll-mt-20 md:scroll-mt-8">
      <span className="mb-1 block text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--ring)]">
        {rotulo}
      </span>
      <span className="flex items-center gap-2.5 border-b-2 border-[var(--brand-lime)] pb-2 text-lg font-semibold tracking-tight text-foreground sm:text-xl">
        {titulo}
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

function GrupoSecao({
  grupo,
  num,
  trilha,
}: {
  grupo: CorpusGrupo;
  num: number;
  trilha?: ReactNode;
}) {
  // semantic tone of the numbered chips (the PDF's pill diagram) — the sub
  // inherits the parent section's tone when it has no dimension of its own
  const tomGrupo = tomSemantico(grupo.titulo) ?? undefined;
  return (
    <section>
      <TituloGrupo grupo={grupo} num={num} />
      {trilha}
      {grupo.intro ? (
        <div className="mt-3 space-y-3">
          <DocBlocos blocos={grupo.intro.blocos} tom={tomGrupo} />
        </div>
      ) : null}
      {grupo.subs.map((s) => {
        const tomSub = tomSemantico(s.titulo) ?? tomGrupo;
        return (
          <section key={s.anchor} className="mt-5">
            {s.blocos[0]?.kind === "encontro" ? (
              // encounter section: the card itself carries heading + anchor
              <DocBlocos blocos={s.blocos} tom={tomSub} />
            ) : (
              <>
                <TituloSub s={s} />
                <div className="mt-2 space-y-3">
                  <DocBlocos blocos={s.blocos} tom={tomSub} />
                </div>
              </>
            )}
          </section>
        );
      })}
    </section>
  );
}

/** TOC item: tone marker (the phase's own color on bands, lime elsewhere)
 *  + title + dotted leader — the guide's printed TOC rite. */
function SumarioItem({
  anchor,
  titulo,
  sub,
  tom,
  num,
}: {
  anchor: string;
  titulo: string;
  sub?: boolean;
  tom?: DocTom;
  num?: number;
}) {
  return (
    <a
      href={`#${anchor}`}
      className={cn(
        "flex items-baseline gap-2.5 rounded-md py-1 text-sm hover:bg-muted/60",
        sub ? "px-2 py-0.5 text-[13px] text-muted-foreground hover:text-foreground" : "px-2"
      )}
    >
      {num != null ? (
        // capítulo: número no lugar do marcador (subs mantêm o ponto)
        <span
          aria-hidden
          className={cn(
            "w-6 shrink-0 text-[11px] font-bold tabular-nums",
            tom ? TOM_DOC[tom].forte : "text-[var(--ring)]"
          )}
        >
          {String(num).padStart(2, "0")}
        </span>
      ) : (
        <span
          aria-hidden
          className={cn(
            "shrink-0 self-center rounded-full",
            sub ? "size-1" : "size-1.5",
            tom ? TOM_DOC[tom].barra : "bg-[var(--brand-lime)]"
          )}
        />
      )}
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
      {grupos.map((g, i) => (
        <li key={g.anchor}>
          <SumarioItem
            anchor={g.anchor}
            titulo={g.titulo}
            num={i + 1}
            tom={g.fase != null ? tomDeFase(g.fase) : undefined}
          />
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

/** Sumário colapsável (<details> nativo, mesmo padrão da agenda) com os dois
 *  níveis — pill sticky sob o header do shell no mobile (em md+ não há
 *  header, sobe pra top-3). Escondido no xl (o rail lateral assume) e no
 *  print, onde as seções já saem abertas. */
function Sumario({ grupos, total }: { grupos: CorpusGrupo[]; total: number }) {
  return (
    <details className="group sticky top-[calc(env(safe-area-inset-top)+4rem)] z-30 mt-6 overflow-hidden rounded-full bg-card/95 shadow-[var(--shadow-border)] backdrop-blur open:rounded-2xl md:top-3 xl:hidden print:hidden">
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
        className="scroll-fina max-h-[60dvh] overflow-y-auto border-t border-border/60 px-3 py-3"
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

/** The clickable journey map the PDF doesn't have: one numbered dot per
 *  encounter card, grouped and colored by phase band, connected by a line.
 *  Each dot links to the card's own anchor (the same secaoAnchor the
 *  citations use). Scrolls horizontally on mobile, hidden in print. */
function JornadaStrip({ jornada }: { jornada: CorpusJornada }) {
  return (
    <nav
      aria-label={`Mapa dos ${jornada.total} encontros`}
      className="mt-4 overflow-x-auto rounded-xl border border-border/60 bg-card px-4 py-3.5 shadow-[var(--shadow-border)] print:hidden"
    >
      <ol className="flex w-max items-start">
        {jornada.fases.map((f, i) => {
          const t = TOM_DOC[f.tom];
          return (
            <li key={f.rotulo} className="flex items-start">
              {i > 0 ? (
                // mt-[15px] = center of the size-8 dot row, so the link
                // between phase groups sits on the same line as the
                // intra-group connectors
                <span
                  aria-hidden
                  className="mx-2.5 mt-[15px] h-0.5 w-3.5 shrink-0 rounded-full bg-border"
                />
              ) : null}
              <div>
                <ol className="flex items-center">
                  {f.pontos.map((p, j) => (
                    <li key={p.anchor} className="flex items-center">
                      {j > 0 ? (
                        <span
                          aria-hidden
                          className={cn(
                            "h-0.5 w-2.5 rounded-full",
                            t.trilho
                          )}
                        />
                      ) : null}
                      <a
                        href={`#${p.anchor}`}
                        title={`${p.numero}º encontro · ${p.titulo}`}
                        aria-label={`${p.numero}º encontro · ${p.titulo}`}
                        className={cn(
                          "grid size-8 shrink-0 place-items-center rounded-full border-2 text-xs font-bold transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                          t.dot
                        )}
                      >
                        {p.numero}
                      </a>
                    </li>
                  ))}
                </ol>
                <p
                  className={cn(
                    "mt-1.5 text-[11px] font-semibold uppercase tracking-[0.08em]",
                    t.forte
                  )}
                >
                  {f.rotulo}
                </p>
              </div>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

/** Document body: lede + TOC + sections. Exported apart from the shell
 *  (without the "back" Link) for direct render in tests. */
export function CorpusDocBody({ doc }: { doc: CorpusDoc }) {
  const grupos = gruposCorpus(doc.secoes);
  const jornada = jornadaCorpus(grupos);
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
          {grupos.map((g, i) => (
            <Fragment key={g.anchor}>
              {jornada && !jornada.home && jornada.inicio === g.anchor ? (
                <JornadaStrip jornada={jornada} />
              ) : null}
              <GrupoSecao
                grupo={g}
                num={i + 1}
                trilha={
                  jornada && jornada.home === g.anchor ? (
                    <JornadaStrip jornada={jornada} />
                  ) : undefined
                }
              />
            </Fragment>
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
        // wider reading surface on desktop — long docs also carry a 15rem
        // TOC rail inside this container
        doc.secoes.length <= TOC_MINIMO && "xl:max-w-4xl",
        doc.secoes.length > TOC_MINIMO && "xl:max-w-6xl 2xl:max-w-7xl"
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
        Fonte: {doc.fonte}.
      </footer>
    </main>
  );
}
