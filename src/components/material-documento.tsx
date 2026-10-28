import Link from "next/link";
import { ArrowLeft } from "@phosphor-icons/react/dist/ssr";
import { materialDocumento } from "@/lib/materiais-documentos";
import { cn } from "@/lib/utils";

// Documento nativo de /materiais — os templates do cap. 14 do guia DPP vivem
// em src/lib/materiais-documentos.ts e são renderizados pelo app (material com
// path "doc:<slug>" aponta pra cá). Texto copiável, mesma linguagem dos
// roteiros em PDF: hero escuro, kicker amarelo, callouts creme/verde. O
// componente serve às duas casas — /materiais/documento (staff/mentor) e
// /jovem/materiais/documento (mentorado) — cada rota passa o seu "voltar".

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

      {/* hero — a mesma gramática do roteiro em PDF: bloco escuro, kicker
          amarelo, acento lima no título e borda do objetivo */}
      <header className="rounded-2xl bg-zinc-900 p-6 text-zinc-100 sm:p-7">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--destaque)] before:mr-2.5 before:inline-block before:h-[3px] before:w-6 before:rounded-full before:bg-[var(--destaque)] before:align-middle before:content-['']">
          {doc.kicker}
        </p>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight text-balance text-white">
          {doc.titulo}
        </h1>
        <p className="mt-3 border-l-[3px] border-[var(--brand-lime)] pl-3 text-sm text-zinc-300">
          <b className="font-semibold text-white">Quando usar:</b>{" "}
          {doc.objetivo}
        </p>
        <p className="mt-2 text-[11px] font-medium uppercase tracking-[0.12em] text-zinc-500">
          {doc.rotulo}
        </p>
      </header>

      <div className="mt-5 space-y-3">
        {doc.blocos.map((b, i) => {
          switch (b.kind) {
            case "subj":
              return (
                <p
                  key={i}
                  className="rounded-lg bg-muted px-4 py-2.5 text-sm"
                >
                  <b className="font-semibold text-muted-foreground">
                    Assunto:
                  </b>{" "}
                  {b.texto}
                </p>
              );
            case "nota":
              return (
                <p
                  key={i}
                  className="rounded-xl bg-[var(--destaque-suave)] px-4 py-3 text-sm"
                  dangerouslySetInnerHTML={{ __html: b.html }}
                />
              );
            case "par":
              return (
                <p
                  key={i}
                  className="px-1 text-sm leading-relaxed"
                  dangerouslySetInnerHTML={{ __html: b.html }}
                />
              );
            case "lista":
              return (
                <ol
                  key={i}
                  className="list-decimal space-y-1.5 px-1 pl-6 text-sm leading-relaxed"
                >
                  {b.itens.map((it, j) => (
                    <li key={j} dangerouslySetInnerHTML={{ __html: it }} />
                  ))}
                </ol>
              );
            case "pergunta":
              return (
                <p
                  key={i}
                  className="rounded-r-lg rounded-l-md border-l-[3px] border-[var(--brand-lime)] bg-[var(--ok-bg)] px-4 py-2.5 text-sm"
                >
                  {b.texto}
                </p>
              );
            case "tabela":
              return (
                <div
                  key={i}
                  className="overflow-x-auto rounded-xl bg-card shadow-[var(--shadow-border)]"
                >
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b-2 border-foreground/80 text-left">
                        {b.cabecalho.map((h, j) => (
                          <th
                            key={j}
                            className={cn(
                              "px-4 py-2.5 text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground",
                              j > 0 && "w-28 text-center"
                            )}
                          >
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/60">
                      {b.linhas.map((ln, j) => (
                        <tr key={j}>
                          {ln.map((cel, k) => (
                            <td
                              key={k}
                              className={cn("px-4 py-2.5", k > 0 && "text-center")}
                            >
                              {k === 0 ? (
                                cel
                              ) : (
                                <span className="inline-block size-4 rounded border-[1.5px] border-muted-foreground/50" />
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
        })}
      </div>

      <footer className="mt-8 border-t border-border/60 pt-3 text-xs text-muted-foreground">
        Template do guia do programa — adapte ao seu jeito de escrever.
      </footer>
    </main>
  );
}
