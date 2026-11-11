import Link from "next/link";
import { DownloadSimple } from "@phosphor-icons/react/dist/ssr";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Seção do hub /relatorios (REALIZA-178): título + descrição + prévia
 *  tabular das MESMAS linhas do CSV (o dados.ts compartilhado garante a
 *  paridade) + link de download que carrega o recorte ativo (turma e
 *  cronograma vêm na querystring). Sem estado — server component. */
export function RelatorioSecao({
  titulo,
  descricao,
  colunas,
  linhas,
  total,
  csvHref,
}: {
  titulo: string;
  descricao: string;
  colunas: string[];
  /** Células já formatadas (dd/mm/aaaa etc.) — até 8 linhas. */
  linhas: string[][];
  /** Total de linhas do recorte — a prévia mostra no máximo 8. */
  total: number;
  /** /api/export?tipo=…&turma=…&cronograma=… — mesmo recorte da prévia. */
  csvHref: string;
}) {
  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div>
          <h2 className="text-base font-semibold">{titulo}</h2>
          <p className="mt-0.5 max-w-2xl text-sm text-muted-foreground">
            {descricao}
          </p>
        </div>
        <Link
          href={csvHref}
          className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
        >
          <DownloadSimple aria-hidden />
          Baixar CSV completo
        </Link>
      </div>

      {linhas.length === 0 ? (
        <p className="rounded-xl bg-card px-4 py-6 text-sm text-muted-foreground shadow-[var(--shadow-border)]">
          Nada no recorte selecionado.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl bg-card shadow-[var(--shadow-border)]">
          <table className="w-full min-w-[36rem] text-left text-sm">
            <thead>
              <tr className="border-b border-border/70">
                {colunas.map((c) => (
                  <th
                    key={c}
                    scope="col"
                    className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground"
                  >
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {linhas.map((cells, i) => (
                <tr key={i}>
                  {cells.map((c, j) => (
                    <td
                      key={j}
                      className={cn(
                        "px-4 py-2.5",
                        j === 0 ? "font-medium" : "text-muted-foreground"
                      )}
                    >
                      {c || "—"}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          {total > linhas.length && (
            <p className="border-t border-border/60 px-4 py-2 text-xs text-muted-foreground">
              Prévia de {linhas.length} de {total} linhas — o CSV completo
              traz todas.
            </p>
          )}
        </div>
      )}
    </section>
  );
}
