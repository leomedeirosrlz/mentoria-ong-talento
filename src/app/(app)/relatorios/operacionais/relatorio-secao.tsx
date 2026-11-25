import type { CSSProperties, ReactNode } from "react";
import Link from "next/link";
import { CaretRight, DownloadSimple } from "@phosphor-icons/react/dist/ssr";
import { buttonVariants } from "@/components/ui/button";
import {
  PILL_SITUACAO,
  PONTO_SITUACAO,
  type TomSituacao,
} from "@/components/dupla-linha";
import { cn } from "@/lib/utils";

/** A transição de altura das colapsáveis das seções — o mesmo token que
 *  SecaoEncerramento/SecaoAderencia usam local. */
export const COLAPSIVEL_PANEL =
  "h-[var(--collapsible-panel-height)] overflow-hidden transition-[height] duration-150 data-ending-style:h-0 data-starting-style:h-0 [&[hidden]:not([hidden='until-found'])]:hidden";

/** Seção de /relatorios/operacionais (REALIZA-178): título + descrição +
 *  tabela completa das MESMAS linhas do CSV (o dados.ts compartilhado
 *  garante a paridade — a leitura in-app dispensou o download) + link de
 *  download que carrega o recorte ativo (turma e cronograma vêm na
 *  querystring). Sem estado — server component.
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
  csvHref,
}: {
  titulo: string;
  descricao: string;
  colunas: string[];
  /** Células já formatadas (dd/mm/aaaa etc.) — o recorte inteiro. */
  linhas: string[][];
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
      <RelatorioTabela colunas={colunas} linhas={linhas} />
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
        prefetch={false}
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
}: {
  colunas: string[];
  /** O recorte inteiro — o scroller interno segura tabelas grandes. */
  linhas: string[][];
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
      {linhas.length > 8 && (
        <p className="mt-2 text-xs text-muted-foreground">
          {linhas.length} linhas no recorte.
        </p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------
// RelatorioLinha — a linha acionável das seções de relatório (REALIZA-389).
// A gramática da DuplaLinha aplicada a entidade única (pessoa, pedido,
// link, gesto): [situação] · quem/o quê · contexto que decide a ação ·
// ação contextual + chevron. O card inteiro é o link esticado (1 tab);
// ausência de href (fato órfão) rende a linha sem link — honesta.
// ---------------------------------------------------------------------

export type RelatorioLinhaProps = {
  situacao: { rotulo: string; tom: TomSituacao };
  /** nome da pessoa/entidade — quebra linha, não trunca. */
  titulo: ReactNode;
  /** linha fina sob o título ("papel · emitido em…"). */
  meta?: string | null;
  /** o contexto que decide a ação, em até duas linhas. */
  detalhe?: ReactNode;
  /** a UMA ação contextual (botão) — sobe pra z-20 acima do link. */
  acao?: ReactNode;
  /** ficha/destino do link esticado; sem href a linha não é clicável. */
  href?: string;
  hrefLabel?: string;
  i?: number;
};

export function RelatorioLinha({
  situacao,
  titulo,
  meta,
  detalhe,
  acao,
  href,
  hrefLabel = "Abrir",
  i = 0,
}: RelatorioLinhaProps) {
  return (
    <div className="@container">
      <div
        style={{ "--i": Math.min(i, 10) } as CSSProperties}
        className={cn(
          "relative animate-enter flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-border bg-card p-3 transition-colors",
          href && "hover:bg-muted/50",
          "@4xl:grid @4xl:grid-cols-[148px_minmax(160px,1.1fr)_minmax(140px,1.3fr)_auto] @4xl:items-center @4xl:gap-x-3 @4xl:rounded-none @4xl:border-0 @4xl:bg-transparent @4xl:px-5 @4xl:py-3"
        )}
      >
        {href && (
          <Link
            href={href}
            prefetch={false}
            aria-label={hrefLabel}
            className="absolute inset-0 z-10 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring @4xl:rounded-none"
          />
        )}
        <div className="order-1 @4xl:order-none">
          <span
            className={cn(
              "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-1 text-[11px] font-semibold leading-none",
              PILL_SITUACAO[situacao.tom]
            )}
          >
            {PONTO_SITUACAO[situacao.tom] && (
              <span
                aria-hidden
                className={cn(
                  "size-1.5 rounded-full",
                  PONTO_SITUACAO[situacao.tom]
                )}
              />
            )}
            {situacao.rotulo}
          </span>
        </div>
        <div className="order-3 min-w-0 basis-full @4xl:order-none @4xl:basis-auto">
          <p className="text-sm font-semibold leading-snug">{titulo}</p>
          {meta && (
            <p className="mt-0.5 text-xs text-muted-foreground">{meta}</p>
          )}
        </div>
        <div className="order-4 min-w-0 basis-full text-[13px] leading-snug @4xl:order-none @4xl:basis-auto">
          <p className="line-clamp-2">{detalhe}</p>
        </div>
        <div className="order-2 ml-auto flex items-center gap-1.5 @4xl:order-none @4xl:ml-0 @4xl:justify-end">
          {acao != null && <span className="relative z-20">{acao}</span>}
          {href && (
            <CaretRight
              aria-hidden
              size={16}
              weight="bold"
              className="shrink-0 text-muted-foreground"
            />
          )}
        </div>
      </div>
    </div>
  );
}

/** A casca de lista das seções acionáveis: cards no estreito, linhas
 *  divididas no largo — mesma moldura do <ul> da DuplaLinha. */
export function RelatorioLista({ children }: { children: ReactNode }) {
  return (
    <div className="@container">
      <ul className="space-y-3 @4xl:space-y-0 @4xl:divide-y @4xl:divide-border/60 @4xl:overflow-hidden @4xl:rounded-xl @4xl:bg-card @4xl:shadow-[var(--shadow-border)]">
        {children}
      </ul>
    </div>
  );
}
