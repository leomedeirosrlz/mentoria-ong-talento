import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowLeft } from "@phosphor-icons/react/dist/ssr";
import { materialDocumento } from "@/lib/materiais-documentos";
import type { CalloutTom, DocBloco } from "@/lib/materiais-documentos";
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
                    <span className="inline-block size-4 rounded border-[1.5px] border-muted-foreground/50" />
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

// tone → border+background pair (the app's status tokens cover the guide's
// 4 tones: info teal, warn amber, tip lime/pale green, note italic gray)
const CALLOUT_TOM: Record<CalloutTom, string> = {
  info: "border-[var(--info)] bg-[var(--info-bg)]",
  warn: "border-[var(--warn)] bg-[var(--warn-bg)]",
  tip: "border-[var(--brand-lime)] bg-[var(--ok-bg)]",
  note: "border-[var(--pausa-border)] bg-muted italic text-muted-foreground",
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
          "block text-[11px] font-bold uppercase tracking-[0.14em]",
          encerramento ? "text-[var(--warn-text)]" : "text-[var(--ring)]"
        )}
      >
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
        <div className="mt-3.5 space-y-1.5 border-t border-border/60 pt-3 text-sm">
          {b.tarefa ? (
            <p>
              <b className="font-semibold">Tarefa:</b>{" "}
              <span dangerouslySetInnerHTML={{ __html: `${b.tarefa}.` }} />
            </p>
          ) : null}
          {b.roteiro ? (
            <p>
              <b className="font-semibold text-[var(--warn-text)]">
                Passo a passo:
              </b>{" "}
              <Link
                href={`/materiais/documento/${b.roteiro.slug}`}
                className="font-medium underline decoration-muted-foreground/50 underline-offset-4 hover:decoration-foreground"
              >
                {b.roteiro.rotulo}
              </Link>
            </p>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}

function DocBlocoView({ b }: { b: DocBloco }) {
  switch (b.kind) {
    case "subj":
      return (
        <p className="rounded-lg bg-muted px-4 py-2.5 text-sm">
          <b className="font-semibold text-muted-foreground">Assunto:</b>{" "}
          {b.texto}
        </p>
      );
    case "callout":
      return (
        <p
          className={cn(
            "rounded-r-xl rounded-l-md border-l-4 px-4 py-3 text-sm leading-relaxed print:shadow-none",
            CALLOUT_TOM[b.tom]
          )}
          dangerouslySetInnerHTML={{ __html: b.html }}
        />
      );
    case "numero":
      return (
        <div className="flex gap-2.5 px-1 text-sm leading-relaxed">
          <span
            aria-hidden
            className="shrink-0 font-bold text-[var(--ring)]"
          >
            {b.numero}.
          </span>
          <p>
            <b className="font-semibold">{b.titulo}.</b>{" "}
            <span dangerouslySetInnerHTML={{ __html: b.html }} />
          </p>
        </div>
      );
    case "quote":
      return (
        <blockquote className="rounded-r-xl border-l-4 border-[var(--brand-lime)] bg-card px-4 py-3 shadow-[var(--shadow-border)] print:shadow-none">
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

/** Fileira de blocos do documento — espaçamento entre irmãos fica por conta
 *  do container (`space-y-3`), igual ao corpo do documento nativo. */
export function DocBlocos({ blocos }: { blocos: DocBloco[] }) {
  return (
    <>
      {blocos.map((b, i) => (
        <DocBlocoView key={i} b={b} />
      ))}
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
    <main className="mx-auto max-w-3xl px-4 py-6 print:px-0">
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
