import { CaretDown } from "@phosphor-icons/react/dist/ssr";
import { Collapsible } from "@base-ui/react/collapsible";
import { diffDias } from "@/lib/ciclo";
import { dataHora, dia } from "@/lib/relatorios/csv-core";
import type { ItemForms } from "@/lib/relatorios/dados";
import { BarraSegmentada } from "@/components/viz";
import {
  COLAPSIVEL_PANEL,
  RelatorioLinha,
  RelatorioLista,
  RelatorioSecaoTopo,
  RelatorioTabela,
} from "./relatorio-secao";

// Seção "Formulários" (REALIZA-389): o resumo responde "qual a taxa de
// resposta do recorte e quem ainda deve"; a fila leva ao formulário (onde
// links e respostas se gerenciam). A tabela do export fica embaixo,
// colapsada — as mesmas linhas do CSV.

export function SecaoFormularios({
  itens,
  csvHref,
  hoje,
}: {
  itens: ItemForms[];
  csvHref: string;
  hoje: Date;
}) {
  const hojeDia = hoje.toISOString().slice(0, 10);
  const respondidos = itens.filter((i) => i.respondido);
  // a pendência que pede ação é o link NOMEADO sem resposta; o link de
  // divulgação (intake) não tem destinatário pra cobrar — entra no resumo,
  // não na fila
  const pendentes = itens
    .filter((i) => !i.respondido && i.origem === "manual")
    .sort((a, b) => a.linha.emitido_em.localeCompare(b.linha.emitido_em));
  const restantes = itens
    .filter((i) => i.respondido || i.origem !== "manual")
    .sort((a, b) => b.linha.emitido_em.localeCompare(a.linha.emitido_em));
  const respostasTotal = itens.reduce((s, i) => s + i.linha.respostas, 0);
  const maisAntigoDias = pendentes.length
    ? diffDias(hojeDia, pendentes[0].linha.emitido_em.slice(0, 10))
    : null;
  const taxa = itens.length
    ? Math.round((respondidos.length / itens.length) * 100)
    : null;

  return (
    <section className="space-y-4">
      <RelatorioSecaoTopo
        titulo="Taxa de resposta de formulários"
        descricao="Uma linha por link emitido: respondido/não e quantas respostas chegaram. A taxa se deriva do par."
        csvHref={csvHref}
      />

      {itens.length === 0 ? (
        <p className="rounded-xl bg-card px-4 py-6 text-sm text-muted-foreground shadow-[var(--shadow-border)]">
          Nenhum link de formulário neste recorte.
        </p>
      ) : (
        <>
          <div className="grid gap-3 md:grid-cols-2">
            {/* a régua: emitidos x respondidos */}
            <div className="rounded-xl bg-card p-4 shadow-[var(--shadow-border)]">
              <h3 className="text-base font-semibold">Taxa de resposta</h3>
              <p className="mt-2 text-sm">
                <b className="text-base font-semibold tabular-nums">
                  {respondidos.length}
                </b>
                <span className="text-muted-foreground">
                  {" "}
                  de {itens.length}{" "}
                  {itens.length === 1 ? "link" : "links"} respondidos (
                  {taxa}%)
                </span>
              </p>
              <BarraSegmentada
                className="mt-3"
                altura="md"
                denominador={itens.length}
                animate
                legenda
                segmentos={[
                  {
                    valor: respondidos.length,
                    rotulo:
                      respondidos.length === 1 ? "respondido" : "respondidos",
                    cls: "bg-muted-foreground",
                  },
                  {
                    valor: itens.length - respondidos.length,
                    rotulo: "sem resposta",
                    cls: "bg-[var(--warn)]",
                  },
                ]}
              />
              <p className="mt-3 text-xs text-muted-foreground">
                {respostasTotal}{" "}
                {respostasTotal === 1 ? "resposta chegou" : "respostas chegaram"}{" "}
                no recorte.
              </p>
            </div>

            {/* o que ainda espera resposta */}
            <div className="rounded-xl bg-card p-4 shadow-[var(--shadow-border)]">
              <h3 className="text-base font-semibold">Aguardando resposta</h3>
              {pendentes.length > 0 ? (
                <>
                  <p className="mt-2 text-sm">
                    <b className="text-base font-semibold tabular-nums">
                      {pendentes.length}
                    </b>
                    <span className="text-muted-foreground">
                      {" "}
                      {pendentes.length === 1
                        ? "link sem resposta"
                        : "links sem resposta"}
                    </span>
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {maisAntigoDias === 0
                      ? "o mais antigo foi emitido hoje"
                      : maisAntigoDias === 1
                        ? "o mais antigo espera desde ontem"
                        : `o mais antigo espera há ${maisAntigoDias} dias`}
                  </p>
                </>
              ) : (
                <p className="mt-2 text-sm text-muted-foreground">
                  Nenhum link nomeado aguardando resposta.
                </p>
              )}
            </div>
          </div>

          {/* quem ainda deve */}
          {pendentes.length > 0 && (
            <div>
              <h3 className="mb-2 text-sm font-semibold">
                A cobrar ({pendentes.length})
              </h3>
              <RelatorioLista>
                {pendentes.map((item, i) => (
                  <LinhaFormulario key={item.linkId} item={item} i={i} hojeDia={hojeDia} />
                ))}
              </RelatorioLista>
            </div>
          )}

          {/* respondidos e links de divulgação, colapsados */}
          {restantes.length > 0 && (
            <Collapsible.Root>
              <Collapsible.Trigger className="group flex min-h-11 w-full cursor-pointer items-center gap-1.5 rounded-lg py-2 text-left text-sm font-semibold text-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                Respondidos e divulgação ({restantes.length})
                <CaretDown
                  size={14}
                  aria-hidden
                  className="text-muted-foreground transition-transform group-data-[panel-open]:rotate-180"
                />
              </Collapsible.Trigger>
              <Collapsible.Panel hiddenUntilFound className={COLAPSIVEL_PANEL}>
                <RelatorioLista>
                  {restantes.map((item, i) => (
                    <LinhaFormulario key={item.linkId} item={item} i={i} hojeDia={hojeDia} />
                  ))}
                </RelatorioLista>
              </Collapsible.Panel>
            </Collapsible.Root>
          )}
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
            colunas={[
              "Formulário",
              "Destinatário",
              "Origem",
              "Emitido em",
              "Respondido",
              "Respostas",
            ]}
            linhas={itens.map((i) => [
              i.linha.formulario,
              i.linha.destinatario,
              i.linha.origem,
              dataHora(i.linha.emitido_em) || "—",
              i.linha.respondido,
              String(i.linha.respostas),
            ])}
          />
        </Collapsible.Panel>
      </Collapsible.Root>
    </section>
  );
}

function LinhaFormulario({
  item,
  i,
  hojeDia,
}: {
  item: ItemForms;
  i: number;
  hojeDia: string;
}) {
  const dias = diffDias(hojeDia, item.linha.emitido_em.slice(0, 10));
  const meta = [
    item.linha.formulario,
    item.linha.origem,
    `emitido ${dia(item.linha.emitido_em)}`,
  ]
    .filter(Boolean)
    .join(" · ");
  const detalhe = item.respondido
    ? `${item.linha.respostas} ${
        item.linha.respostas === 1 ? "resposta" : "respostas"
      }${item.linha.respondido_em ? ` · ${dia(item.linha.respondido_em)}` : ""}`
    : dias === 0
      ? "aguardando resposta, emitido hoje"
      : dias === 1
        ? "aguardando resposta há 1 dia"
        : `aguardando resposta há ${dias} dias`;
  return (
    <li>
      <RelatorioLinha
        i={i}
        situacao={
          item.respondido
            ? { rotulo: "Respondido", tom: "pausa" }
            : { rotulo: "Pendente", tom: "atencao" }
        }
        titulo={item.linha.destinatario || "Link genérico"}
        meta={meta}
        detalhe={detalhe}
        href={`/formularios/${item.formularioId}`}
        hrefLabel={`Abrir ${item.linha.formulario}`}
      />
    </li>
  );
}
