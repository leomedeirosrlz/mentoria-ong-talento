import Link from "next/link";
import { DownloadSimple } from "@phosphor-icons/react/dist/ssr";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Seção de /relatorios/operacionais (REALIZA-178): título + descrição +
 *  prévia tabular das MESMAS linhas do CSV (o dados.ts compartilhado
 *  garante a paridade) + link de download que carrega o recorte ativo
 *  (turma e cronograma vêm na querystring). Sem estado — server component.
 *
 *  A tabela veste a mesma pele do RelatorioCanvas (grade livre, 375):
 *  faixa border-y sangrando o padding da página, scroller interno,
 *  header bg-muted sticky, gutter de nº à esquerda e borda por célula.
 *
 *  Desde a REALIZA-389 o topo e a tabela também valem soltos: as seções
 *  redesenhadas (aderência, encerramento) montam o resumo acionável no
 *  meio e deixam a prévia do export colapsada embaixo. */
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
      <RelatorioSecaoTopo
        titulo={titulo}
        descricao={descricao}
        csvHref={csvHref}
      />
      <RelatorioTabela colunas={colunas} linhas={linhas} total={total} />
    </section>
  );
}

export function RelatorioSecaoTopo({
  titulo,
  descricao,
  csvHref,
}: {
  titulo: string;
  descricao: string;
  csvHref: string;
}) {
  return (
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
  );
}

export function RelatorioTabela({
  colunas,
  linhas,
  total,
}: {
  colunas: string[];
  linhas: string[][];
  total: number;
}) {
  // mesmas constantes de célula do canvas: borda por célula (border-separate
  // segura o sticky) e gutter fixo de número de linha
  const celula = "border-r border-b border-border";
  const gutter =
    "sticky left-0 z-10 w-10 border-l border-r border-b border-border bg-muted " +
    "px-1 py-1 text-center text-[10px] tabular-nums text-muted-foreground select-none";

  return (
    <div className="-mx-4 border-y border-border bg-card/40 px-4 py-3 sm:-mx-6 sm:px-6">
      <div className="scroll-fina max-h-[70dvh] overflow-auto [scrollbar-gutter:stable]">
        <table className="w-full min-w-max border-separate border-spacing-0 text-left text-[13px] leading-snug">
          <thead>
            <tr className="bg-muted">
              <th
                aria-hidden
                className={cn(gutter, "sticky top-0 z-30 border-t")}
              />
              {colunas.map((c) => (
                <th
                  key={c}
                  scope="col"
                  className={cn(
                    celula,
                    "sticky top-0 z-20 max-w-72 border-t bg-muted px-2.5 py-1.5 text-left text-xs font-medium text-foreground"
                  )}
                >
                  <span className="break-words">{c}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {linhas.map((cells, i) => (
              <tr key={i} className="hover:bg-[var(--brand-lime)]/8">
                <td className={gutter}>{i + 1}</td>
                {cells.map((c, j) => (
                  <td
                    key={j}
                    className={cn(
                      celula,
                      "max-w-72 px-2.5 py-1.5 align-top"
                    )}
                  >
                    {c ? (
                      <span className="break-words">{c}</span>
                    ) : (
                      <span className="text-muted-foreground/50">—</span>
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        {linhas.length === 0 && (
          <p className="px-4 py-10 text-center text-sm text-muted-foreground">
            Nada no recorte selecionado.
          </p>
        )}
      </div>
      {total > linhas.length && (
        <p className="mt-2 text-xs text-muted-foreground">
          Prévia de {linhas.length} de {total} linhas. O CSV completo traz
          todas.
        </p>
      )}
    </div>
  );
}
