import { CaretDown } from "@phosphor-icons/react/dist/ssr";
import { Collapsible } from "@base-ui/react/collapsible";
import { dataHora } from "@/lib/relatorios/csv-core";
import type { ItemInteracao } from "@/lib/relatorios/dados";
import {
  COLAPSIVEL_PANEL,
  RelatorioLinha,
  RelatorioLista,
  RelatorioSecaoTopo,
  RelatorioTabela,
} from "./relatorio-secao";

// Seção "Interações" (REALIZA-389): o resumo responde "quanto a equipe
// registrou no recorte e por onde"; a lista leva à ficha da dupla do gesto.
// A tabela do export fica embaixo, colapsada — as mesmas linhas do CSV.

const MS_DIA = 86400000;

export function SecaoInteracoes({
  itens,
  csvHref,
  hoje,
}: {
  itens: ItemInteracao[];
  csvHref: string;
  hoje: Date;
}) {
  const agora = hoje.getTime();
  const ultimos7 = itens.filter(
    (i) => agora - new Date(i.linha.data).getTime() < 7 * MS_DIA
  ).length;

  const porTipo = new Map<string, number>();
  const porCanal = new Map<string, number>();
  for (const i of itens) {
    porTipo.set(i.linha.tipo, (porTipo.get(i.linha.tipo) ?? 0) + 1);
    porCanal.set(i.linha.canal, (porCanal.get(i.linha.canal) ?? 0) + 1);
  }
  const tipos = [...porTipo.entries()].sort((a, b) => b[1] - a[1]);
  const canais = [...porCanal.entries()].sort((a, b) => b[1] - a[1]);

  // o log se lê do mais recente — mesma ordem do csvInteracoes
  const lista = [...itens].sort((a, b) =>
    b.linha.data.localeCompare(a.linha.data)
  );

  return (
    <section className="space-y-4">
      <RelatorioSecaoTopo
        titulo="Interações"
        descricao="Log de nudges, contatos e apoios registrados pela coordenação — o rastro de acompanhamento por dupla."
        csvHref={csvHref}
      />

      {itens.length === 0 ? (
        <p className="rounded-xl bg-card px-4 py-6 text-sm text-muted-foreground shadow-[var(--shadow-border)]">
          Nenhuma interação registrada neste recorte.
        </p>
      ) : (
        <>
          <div className="grid gap-3 md:grid-cols-2">
            {/* o volume de trabalho de acompanhamento */}
            <div className="rounded-xl bg-card p-4 shadow-[var(--shadow-border)]">
              <h3 className="text-base font-semibold">Gestos registrados</h3>
              <p className="mt-2 text-sm">
                <b className="text-base font-semibold tabular-nums">
                  {itens.length}
                </b>
                <span className="text-muted-foreground">
                  {" "}
                  {itens.length === 1 ? "interação" : "interações"} no
                  recorte
                </span>
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {ultimos7 === 0
                  ? "nenhuma na última semana"
                  : `${ultimos7} na última semana`}
              </p>
              {canais.length > 0 && (
                <dl className="mt-4 space-y-1.5 border-t border-border/60 pt-3">
                  <dt className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
                    por canal
                  </dt>
                  {canais.map(([canal, n]) => (
                    <div
                      key={canal}
                      className="flex items-baseline justify-between gap-3 text-sm"
                    >
                      <dd>{canal}</dd>
                      <dd className="font-semibold tabular-nums">{n}</dd>
                    </div>
                  ))}
                </dl>
              )}
            </div>

            {/* o tipo de gesto que domina */}
            <div className="rounded-xl bg-card p-4 shadow-[var(--shadow-border)]">
              <h3 className="text-base font-semibold">Por tipo</h3>
              <dl className="mt-3 space-y-1.5">
                {tipos.map(([tipo, n]) => (
                  <div
                    key={tipo}
                    className="flex items-baseline justify-between gap-3 text-sm"
                  >
                    <dd className="min-w-0">{tipo}</dd>
                    <dd className="font-semibold tabular-nums">{n}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </div>

          {/* o log, mais recente primeiro */}
          <div>
            <h3 className="mb-2 text-sm font-semibold">
              Registro ({lista.length})
            </h3>
            <RelatorioLista>
              {lista.map((item, i) => (
                <li key={item.interacaoId}>
                  <RelatorioLinha
                    i={i}
                    situacao={{ rotulo: item.linha.tipo, tom: "neutro" }}
                    titulo={item.linha.dupla || "Dupla removida"}
                    meta={`${item.linha.canal} · ${item.linha.autor} · ${dataHora(item.linha.data)}`}
                    detalhe={item.linha.nota || "sem nota"}
                    href={
                      item.duplaId ? `/duplas/${item.duplaId}` : undefined
                    }
                    hrefLabel="Ver ficha da dupla"
                  />
                </li>
              ))}
            </RelatorioLista>
          </div>
        </>
      )}

      {/* a tabela do export, colapsada */}
      <Collapsible.Root>
        <Collapsible.Trigger className="group flex min-h-11 w-full cursor-pointer items-center gap-1.5 rounded-lg py-2 text-left text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          Prévia do export ({itens.length}{" "}
          {itens.length === 1 ? "linha" : "linhas"})
          <CaretDown
            size={14}
            aria-hidden
            className="transition-transform group-data-[panel-open]:rotate-180"
          />
        </Collapsible.Trigger>
        <Collapsible.Panel hiddenUntilFound className={COLAPSIVEL_PANEL}>
          <RelatorioTabela
            colunas={["Dupla", "Tipo", "Canal", "Autor", "Data", "Nota"]}
            linhas={lista.map((i) => [
              i.linha.dupla,
              i.linha.tipo,
              i.linha.canal,
              i.linha.autor,
              dataHora(i.linha.data) || "—",
              i.linha.nota,
            ])}
          />
        </Collapsible.Panel>
      </Collapsible.Root>
    </section>
  );
}
