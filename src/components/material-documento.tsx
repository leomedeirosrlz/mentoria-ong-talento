import Link from "next/link";
import type { ReactNode } from "react";
import {
  ArrowLeft,
  ArrowRight,
  CalendarCheck,
  ChatCenteredDots,
  EnvelopeSimple,
  Info,
  Lightbulb,
  MapTrifold,
  Quotes,
  Warning,
} from "@phosphor-icons/react/dist/ssr";
import { linhasDoc, materialDocumento } from "@/lib/materiais-documentos";
import type {
  CalloutTom,
  DocBloco,
  DocItem,
  DocTom,
} from "@/lib/materiais-documentos";
import { cn } from "@/lib/utils";

// Documento nativo de /materiais — os templates do cap. 14 do guia DPP vivem
// em src/lib/materiais-documentos.ts e são renderizados pelo app (material com
// path "doc:<slug>" aponta pra cá). Texto copiável, mesma linguagem dos
// roteiros em PDF: hero escuro, kicker amarelo, callouts creme/verde. O
// componente serve às duas casas — /materiais/documento (staff/mentor) e
// /jovem/materiais/documento (mentorado) — cada rota passa o seu "voltar".
// DocumentoHero + DocBlocos são exportados: o documento do corpus
// (corpus-documento.tsx) monta as seções sobre as mesmas peças.

/** Discreet "#" on the heading — the section's copyable link (the heading
 *  itself links to the anchor too). Only shows on hover/focus. */
export function LinkSecao({ anchor, titulo }: { anchor: string; titulo: string }) {
  return (
    <a
      href={`#${anchor}`}
      aria-label={`Link direto para a seção ${titulo}`}
      title="Link direto para esta seção"
      className="ml-2 align-middle text-sm font-normal text-muted-foreground/50 no-underline opacity-0 transition-opacity hover:text-foreground focus-visible:opacity-100 group-hover:opacity-100 print:hidden"
    >
      #
    </a>
  );
}

/** Shared dark hero — the PDF guide's grammar: ink panel with the lime
 *  glow (capa-doc), caps kicker, title and the lime→teal accent bar. */
export function DocumentoHero({
  kicker,
  titulo,
  destaque,
  meta,
}: {
  kicker: string;
  titulo: string;
  /** linha em destaque sob o título (ex.: "Quando usar" dos templates) */
  destaque?: ReactNode;
  /** linha de metadados em caixa-alta (rótulo de uso, versão…) */
  meta?: ReactNode;
}) {
  return (
    <header className="capa-doc relative overflow-hidden rounded-2xl p-6 text-zinc-100 sm:p-7 print:[-webkit-print-color-adjust:exact] print:[print-color-adjust:exact]">
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--destaque)] before:mr-2.5 before:inline-block before:h-[3px] before:w-6 before:rounded-full before:bg-[var(--destaque)] before:align-middle before:content-['']">
        {kicker}
      </p>
      <h1 className="mt-3 text-2xl font-semibold tracking-tight text-balance text-white">
        {titulo}
      </h1>
      <div
        aria-hidden
        className="mt-4 h-[3px] w-14 rounded-full bg-gradient-to-r from-[var(--brand-lime)] to-[var(--info)]"
      />
      {destaque ? (
        <p className="mt-3 border-l-[3px] border-[var(--brand-lime)] pl-3 text-sm text-zinc-300">
          {destaque}
        </p>
      ) : null}
      {meta ? (
        <p className="mt-2 text-[11px] font-medium uppercase tracking-[0.12em] text-zinc-400">
          {meta}
        </p>
      ) : null}
    </header>
  );
}

function DocTabela({
  b,
}: {
  b: Extract<DocBloco, { kind: "tabela" }>;
}) {
  const marcacao = b.marcacao === true;
  return (
    <div
      role="region"
      aria-label="Tabela do documento. Role horizontalmente"
      tabIndex={0}
      className="scroll-fina overflow-x-auto rounded-xl bg-card shadow-[var(--shadow-border)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <table className="w-full text-sm">
        {/* charcoal thead + zebra + highlighted first column — the guide's
            table; in print the header loses the dark bg (bg won't print) */}
        <thead>
          <tr className="bg-zinc-800 text-left print:bg-transparent">
            {b.cabecalho.map((h, j) => (
              <th
                key={j}
                className={cn(
                  "px-4 py-2.5 text-[11px] font-semibold uppercase tracking-[0.1em] text-zinc-100 print:text-foreground",
                  marcacao && j > 0 && "w-28 text-center"
                )}
                dangerouslySetInnerHTML={{ __html: h }}
              />
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border/60">
          {b.linhas.map((ln, j) => (
            <tr key={j} className="even:bg-muted/50">
              {ln.map((cel, k) => (
                <td
                  key={k}
                  className={cn(
                    "px-4 py-2.5",
                    k === 0 && "font-medium",
                    marcacao && k > 0 && "text-center"
                  )}
                >
                  {marcacao && k > 0 ? (
                    // ficha de marcação real — o mentor marca no app; sem
                    // estado persistido, é affordance de leitura (imprime
                    // marcado, diferente do quadrado vazio do PDF)
                    <input
                      type="checkbox"
                      aria-label={`${ln[0].replace(/<[^>]+>/g, "")} — ${b.cabecalho[k].replace(/<[^>]+>/g, "")}`}
                      className="size-4 cursor-pointer accent-[var(--ring)] print:[-webkit-print-color-adjust:exact]"
                    />
                  ) : (
                    <span dangerouslySetInnerHTML={{ __html: cel }} />
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// tone → class set: tinted band, strong text/icon color, accent bar,
// numbered chip, journey dot and connector. Only existing tokens: lime =
// brand, destaque = journey amber, info = support teal — the trio the PDF
// rotates on its chapter bands.
export const TOM_DOC: Record<
  DocTom,
  {
    banda: string;
    forte: string;
    barra: string;
    chip: string;
    dot: string;
    trilho: string;
  }
> = {
  lima: {
    banda: "bg-[var(--brand-lime)]/16",
    forte: "text-[var(--ring)]",
    barra: "bg-[var(--brand-lime)]",
    chip: "bg-[var(--brand-lime)] text-[var(--brand-ink)]",
    dot: "border-[var(--ring)]/45 bg-[var(--brand-lime)]/15 text-[var(--ring)]",
    trilho: "bg-[var(--ring)]/35",
  },
  destaque: {
    banda: "bg-[var(--destaque-suave)]",
    forte: "text-[var(--warn-text)]",
    barra: "bg-[var(--destaque)]",
    chip: "bg-[var(--destaque)] text-[var(--destaque-foreground)]",
    dot: "border-[var(--destaque-borda)] bg-[var(--destaque-suave)] text-[var(--warn-text)]",
    trilho: "bg-[var(--destaque-borda)]",
  },
  info: {
    banda: "bg-[var(--info)]/12",
    forte: "text-[var(--info)]",
    barra: "bg-[var(--info)]",
    chip: "bg-[var(--info)] text-[var(--status-foreground)]",
    dot: "border-[var(--info)]/45 bg-[var(--info-bg)] text-[var(--info)]",
    trilho: "bg-[var(--info-border)]",
  },
};

// tone → border+background+icon (the app's status tokens cover the guide's
// 4 tones: info teal, warn amber, tip lime/pale green, note italic gray).
// Tints sit a step above the pale -bg tokens so the boxes read colored.
const CALLOUT_TOM: Record<
  CalloutTom,
  { box: string; Icone: typeof Info; iconeCls: string }
> = {
  info: {
    box: "border-[var(--info)] bg-[var(--info)]/12",
    Icone: Info,
    iconeCls: "text-[var(--info)]",
  },
  warn: {
    box: "border-[var(--warn)] bg-[var(--warn)]/12",
    Icone: Warning,
    iconeCls: "text-[var(--warn)]",
  },
  tip: {
    box: "border-[var(--brand-lime)] bg-[var(--brand-lime)]/20",
    Icone: Lightbulb,
    iconeCls: "text-[var(--ring)]",
  },
  note: {
    box: "border-[var(--pausa-border)] bg-muted italic text-muted-foreground",
    Icone: ChatCenteredDots,
    iconeCls: "text-[var(--pausa-text)]",
  },
};

/** The guide's encounter card — thick lime side bar (amber on the 16th,
 *  the closing), "Nº ENCONTRO" eyebrow, title, body and the footer with
 *  the Tarefa / Passo a passo slots (link to the native route). */
function EncontroCard({ b }: { b: Extract<DocBloco, { kind: "encontro" }> }) {
  const encerramento = b.numero === "16";
  const heading = (
    <>
      <span
        className={cn(
          "flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.14em]",
          encerramento ? "text-[var(--warn-text)]" : "text-[var(--ring)]"
        )}
      >
        <CalendarCheck size={13} aria-hidden />
        {b.numero}º encontro
      </span>
      <span className="mt-0.5 block text-base font-semibold tracking-tight">
        {b.titulo}
      </span>
    </>
  );
  return (
    <article
      className={cn(
        "rounded-xl border-l-[6px] bg-card px-4 py-4 shadow-[var(--shadow-border)] sm:px-5",
        encerramento ? "border-[var(--destaque)]" : "border-[var(--brand-lime)]"
      )}
    >
      {b.anchor ? (
        <h3 id={b.anchor} className="group scroll-mt-20 md:scroll-mt-8">
          <a
            href={`#${b.anchor}`}
            className="decoration-muted-foreground/40 underline-offset-4 hover:underline"
          >
            {heading}
          </a>
          <LinkSecao
            anchor={b.anchor}
            titulo={`${b.numero}º encontro · ${b.titulo}`}
          />
        </h3>
      ) : (
        <h3>{heading}</h3>
      )}
      {b.corpo.length > 0 ? (
        <div className="mt-2.5 space-y-2.5">
          <DocBlocos blocos={b.corpo} />
        </div>
      ) : null}
      {b.tarefa || b.roteiro ? (
        <div className="mt-3.5 space-y-2 border-t border-border/60 pt-3 text-sm">
          {b.tarefa ? (
            <label className="flex cursor-pointer items-start gap-2">
              <input
                type="checkbox"
                aria-label={`Marcar tarefa como feita: ${b.tarefa.replace(/<[^>]+>/g, "")}`}
                className="peer mt-0.5 size-4 shrink-0 cursor-pointer accent-[var(--ring)]"
              />
              <span className="peer-checked:text-muted-foreground peer-checked:line-through">
                <b className="font-semibold">Tarefa:</b>{" "}
                <span dangerouslySetInnerHTML={{ __html: `${b.tarefa}.` }} />
              </span>
            </label>
          ) : null}
          {b.roteiro ? (
            <p>
              {/* the guide's "Passo a passo" slot as an amber chip-link */}
              <Link
                href={`/materiais/documento/${b.roteiro.slug}`}
                aria-label={`Passo a passo: ${b.roteiro.rotulo}`}
                className="inline-flex items-center gap-1.5 rounded-full border border-[var(--warn-border)] bg-[var(--warn-bg)] px-3 py-1 text-xs font-semibold text-[var(--warn-text)] transition-colors hover:border-[var(--warn)]"
              >
                <MapTrifold size={14} aria-hidden />
                {b.roteiro.rotulo}
                <ArrowRight size={13} aria-hidden />
              </Link>
            </p>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}

/** The guide's numbered item as a card — colored numeric chip + bold title
 *  + body (the semantic pill diagram of the PDF). Renders solo or inside
 *  the `nums` grid (DocItemView); `tom` is the section's semantic color. */
function NumeroCard({
  b,
  tom,
}: {
  b: Extract<DocBloco, { kind: "numero" }>;
  tom: DocTom;
}) {
  return (
    <div className="rounded-xl border border-border/60 bg-card p-3.5 shadow-[var(--shadow-border)]">
      <div className="flex items-center gap-2.5">
        <span
          aria-hidden
          className={cn(
            "grid size-7 shrink-0 place-items-center rounded-lg text-xs font-bold",
            TOM_DOC[tom].chip
          )}
        >
          {b.numero}
        </span>
        <b className="text-sm font-semibold">{b.titulo}</b>
      </div>
      <p
        className="mt-1.5 text-sm leading-relaxed"
        dangerouslySetInnerHTML={{ __html: b.html }}
      />
    </div>
  );
}

function DocBlocoView({ b, tom }: { b: DocBloco; tom: DocTom }) {
  switch (b.kind) {
    case "subj":
      // stray subject outside a card (linhasDoc wraps every subj — fallback)
      return (
        <p className="flex items-center gap-2 rounded-lg bg-muted px-4 py-2.5 text-sm">
          <EnvelopeSimple
            size={16}
            aria-hidden
            className="shrink-0 text-[var(--ring)]"
          />
          <span>
            <b className="font-semibold">Assunto:</b> {b.texto}
          </span>
        </p>
      );
    case "callout": {
      const { box, Icone, iconeCls } = CALLOUT_TOM[b.tom];
      return (
        <div
          className={cn(
            "flex gap-2.5 rounded-r-xl rounded-l-md border-l-4 px-4 py-3 text-sm leading-relaxed print:shadow-none",
            box
          )}
        >
          <Icone
            size={18}
            aria-hidden
            className={cn("mt-0.5 shrink-0", iconeCls)}
          />
          <p dangerouslySetInnerHTML={{ __html: b.html }} />
        </div>
      );
    }
    case "numero":
      return <NumeroCard b={b} tom={tom} />;
    case "quote":
      return (
        <blockquote className="rounded-r-xl border-l-4 border-[var(--brand-lime)] bg-card px-4 py-3 shadow-[var(--shadow-border)] print:shadow-none">
          <Quotes
            size={18}
            weight="fill"
            aria-hidden
            className="mb-1 text-[var(--ring)]"
          />
          <p
            className="text-sm italic leading-relaxed"
            dangerouslySetInnerHTML={{ __html: b.html }}
          />
          {b.fonte ? (
            <footer className="mt-1.5 text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
              {b.fonte}
            </footer>
          ) : null}
        </blockquote>
      );
    case "encontro":
      return <EncontroCard b={b} />;
    case "par":
      return (
        <p
          className="px-1 text-sm leading-relaxed"
          dangerouslySetInnerHTML={{ __html: b.html }}
        />
      );
    case "lista": {
      if (b.check) {
        // lista de marcação (fichas "Antes do encontro", checklist): linha
        // clicável com checkbox — label envolve input+texto e o traçado é
        // o peer-checked, sem JS
        return (
          <ul className="space-y-2 px-1 text-sm leading-relaxed">
            {b.itens.map((it, j) => (
              <li key={j}>
                <label className="flex cursor-pointer items-start gap-2.5 rounded-md px-1 py-1 hover:bg-muted/60">
                  <input
                    type="checkbox"
                    className="peer mt-0.5 size-4 shrink-0 cursor-pointer accent-[var(--ring)]"
                  />
                  <span
                    className="peer-checked:text-muted-foreground peer-checked:line-through"
                    dangerouslySetInnerHTML={{ __html: it }}
                  />
                </label>
              </li>
            ))}
          </ul>
        );
      }
      const Tag = b.ordenada === false ? "ul" : "ol";
      return (
        <Tag
          className={cn(
            "space-y-1.5 px-1 pl-6 text-sm leading-relaxed",
            // lime markers — the signature of the guide's lists
            b.ordenada === false
              ? "list-disc marker:text-[var(--brand-lime)]"
              : "list-decimal marker:font-semibold marker:text-[var(--ring)]"
          )}
        >
          {b.itens.map((it, j) => (
            <li key={j} dangerouslySetInnerHTML={{ __html: it }} />
          ))}
        </Tag>
      );
    }
    case "pergunta":
      return (
        <p className="rounded-r-lg rounded-l-md border-l-[3px] border-[var(--brand-lime)] bg-[var(--ok-bg)] px-4 py-2.5 text-sm">
          {b.texto}
        </p>
      );
    case "tabela":
      return <DocTabela b={b} />;
  }
}

function DocItemView({ item, tom }: { item: DocItem; tom: DocTom }) {
  if (item.kind === "nums") {
    return (
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {item.itens.map((n) => (
          <NumeroCard key={n.numero} b={n} tom={tom} />
        ))}
      </div>
    );
  }
  return <DocBlocoView b={item} tom={tom} />;
}

/** The message templates of cap. 14 as an e-mail: gray card with the lime
 *  side bar, "Assunto:" as the header line (envelope icon + bold) and the
 *  message body below — reads like a real message, ready to copy. */
function EmailCard({
  assunto,
  corpo,
  tom,
}: {
  assunto: string;
  corpo: DocItem[];
  tom: DocTom;
}) {
  return (
    <div className="overflow-hidden rounded-xl border-l-4 border-[var(--brand-lime)] bg-muted/60 shadow-[var(--shadow-border)] print:shadow-none">
      <p className="flex items-center gap-2 border-b border-border/60 px-4 py-2.5 text-sm">
        <EnvelopeSimple
          size={16}
          aria-hidden
          className="shrink-0 text-[var(--ring)]"
        />
        <span className="min-w-0">
          <b className="font-semibold">Assunto:</b>{" "}
          <span className="font-medium">{assunto}</span>
        </span>
      </p>
      <div className="space-y-2.5 px-4 py-3.5">
        {corpo.map((item, i) => (
          <DocItemView key={i} item={item} tom={tom} />
        ))}
      </div>
    </div>
  );
}

/** Fileira de blocos do documento — espaçamento entre irmãos fica por conta
 *  do container (`space-y-3`), igual ao corpo do documento nativo. `subj`
 *  abre o card de e-mail (até o próximo `subj` ou o fim); sequências de
 *  `numero` viram grade de cards; `tom` colore os chips numéricos. */
export function DocBlocos({
  blocos,
  tom = "lima",
}: {
  blocos: DocBloco[];
  tom?: DocTom;
}) {
  return (
    <>
      {linhasDoc(blocos).map((l, i) =>
        l.kind === "email" ? (
          <EmailCard key={i} assunto={l.assunto} corpo={l.corpo} tom={tom} />
        ) : (
          <DocItemView key={i} item={l.item} tom={tom} />
        )
      )}
    </>
  );
}

export function MaterialDocumento({
  slug,
  voltar,
}: {
  slug: string;
  voltar: { href: string; rotulo: string };
}) {
  const doc = materialDocumento(slug);
  if (!doc) return null;

  return (
    <main className="mx-auto max-w-3xl px-4 py-6 print:px-0 lg:max-w-4xl xl:max-w-5xl">
      <Link
        href={voltar.href}
        className="mb-4 inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground print:hidden"
      >
        <ArrowLeft size={13} aria-hidden />
        {voltar.rotulo}
      </Link>

      <DocumentoHero
        kicker={doc.kicker}
        titulo={doc.titulo}
        destaque={
          <>
            <b className="font-semibold text-white">Quando usar:</b>{" "}
            {doc.objetivo}
          </>
        }
        meta={doc.rotulo}
      />

      <div className="mt-5 space-y-3">
        <DocBlocos blocos={doc.blocos} />
      </div>

      <footer className="mt-8 border-t border-border/60 pt-3 text-xs text-muted-foreground">
        Template do guia do programa — adapte ao seu jeito de escrever.
      </footer>
    </main>
  );
}
