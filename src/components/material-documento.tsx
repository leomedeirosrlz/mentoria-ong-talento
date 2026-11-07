import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowLeft } from "@phosphor-icons/react/dist/ssr";
import { materialDocumento } from "@/lib/materiais-documentos";
import type { DocBloco } from "@/lib/materiais-documentos";
import { cn } from "@/lib/utils";

// Documento nativo de /materiais — os templates do cap. 14 do guia DPP vivem
// em src/lib/materiais-documentos.ts e são renderizados pelo app (material com
// path "doc:<slug>" aponta pra cá). Texto copiável, mesma linguagem dos
// roteiros em PDF: hero escuro, kicker amarelo, callouts creme/verde. O
// componente serve às duas casas — /materiais/documento (staff/mentor) e
// /jovem/materiais/documento (mentorado) — cada rota passa o seu "voltar".
// DocumentoHero + DocBlocos são exportados: o documento do corpus
// (corpus-documento.tsx) monta as seções sobre as mesmas peças.

/** Hero escuro compartilhado — a gramática do roteiro em PDF: bloco escuro,
 *  kicker amarelo, linha de destaque com borda lima (opcional) e meta. */
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
    <header className="rounded-2xl bg-zinc-900 p-6 text-zinc-100 sm:p-7">
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--destaque)] before:mr-2.5 before:inline-block before:h-[3px] before:w-6 before:rounded-full before:bg-[var(--destaque)] before:align-middle before:content-['']">
        {kicker}
      </p>
      <h1 className="mt-3 text-2xl font-semibold tracking-tight text-balance text-white">
        {titulo}
      </h1>
      {destaque ? (
        <p className="mt-3 border-l-[3px] border-[var(--brand-lime)] pl-3 text-sm text-zinc-300">
          {destaque}
        </p>
      ) : null}
      {meta ? (
        <p className="mt-2 text-[11px] font-medium uppercase tracking-[0.12em] text-zinc-500">
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
        <thead>
          <tr className="border-b-2 border-foreground/80 text-left">
            {b.cabecalho.map((h, j) => (
              <th
                key={j}
                className={cn(
                  "px-4 py-2.5 text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground",
                  marcacao && j > 0 && "w-28 text-center"
                )}
                dangerouslySetInnerHTML={{ __html: h }}
              />
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border/60">
          {b.linhas.map((ln, j) => (
            <tr key={j}>
              {ln.map((cel, k) => (
                <td
                  key={k}
                  className={cn(
                    "px-4 py-2.5",
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

function DocBlocoView({ b }: { b: DocBloco }) {
  switch (b.kind) {
    case "subj":
      return (
        <p className="rounded-lg bg-muted px-4 py-2.5 text-sm">
          <b className="font-semibold text-muted-foreground">Assunto:</b>{" "}
          {b.texto}
        </p>
      );
    case "nota":
      return (
        <p
          className="rounded-xl bg-[var(--destaque-suave)] px-4 py-3 text-sm"
          dangerouslySetInnerHTML={{ __html: b.html }}
        />
      );
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
            b.ordenada === false
              ? "list-disc marker:text-muted-foreground/70"
              : "list-decimal"
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
