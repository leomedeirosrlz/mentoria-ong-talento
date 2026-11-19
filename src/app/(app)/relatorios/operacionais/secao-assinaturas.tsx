import { CaretDown } from "@phosphor-icons/react/dist/ssr";
import { Collapsible } from "@base-ui/react/collapsible";
import { diffDias } from "@/lib/ciclo";
import { dia } from "@/lib/relatorios/csv-core";
import type { ItemAssinatura } from "@/lib/relatorios/dados";
import { BarraSegmentada } from "@/components/viz";
import {
  COLAPSIVEL_PANEL,
  RelatorioLinha,
  RelatorioLista,
  RelatorioSecaoTopo,
  RelatorioTabela,
} from "./relatorio-secao";

// Seção "Assinaturas" (REALIZA-389): o resumo responde "quantas pendências,
// quantas já expiraram e onde se concentram"; a fila leva à ficha da pessoa
// (onde a reemissão do link mora). A tabela do export fica embaixo,
// colapsada — as mesmas linhas que o CSV baixa.

export function SecaoAssinaturas({
  itens,
  csvHref,
  hoje,
}: {
  itens: ItemAssinatura[];
  csvHref: string;
  hoje: Date;
}) {
  const hojeDia = hoje.toISOString().slice(0, 10);
  const expiradas = itens.filter((i) => i.status === "expirado").length;
  const pendentes = itens.length - expiradas;
  const maisAntigoDias = itens.length
    ? Math.max(
        ...itens.map((i) =>
          diffDias(hojeDia, i.linha.emitido_em.slice(0, 10))
        )
      )
    : null;
  const porDocumento = new Map<string, number>();
  for (const i of itens) {
    const doc = i.linha.documento || "Documento";
    porDocumento.set(doc, (porDocumento.get(doc) ?? 0) + 1);
  }
  const docs = [...porDocumento.entries()].sort((a, b) => b[1] - a[1]);

  // a fila: expirado primeiro (reemissão), depois o mais antigo
  const fila = [...itens].sort(
    (a, b) =>
      (a.status === "expirado" ? 0 : 1) - (b.status === "expirado" ? 0 : 1) ||
      a.linha.emitido_em.localeCompare(b.linha.emitido_em)
  );

  return (
    <section className="space-y-4">
      <RelatorioSecaoTopo
        titulo="Assinaturas pendentes"
        descricao="Documento emitido × pessoa sem assinado_em — inclui os links expirados que ainda contam como pendência. A reemissão mora na ficha da pessoa."
        csvHref={csvHref}
      />

      {itens.length === 0 ? (
        <p className="rounded-xl bg-card px-4 py-6 text-sm text-muted-foreground shadow-[var(--shadow-border)]">
          Nenhuma pendência de assinatura neste recorte.
        </p>
      ) : (
        <>
          <div className="grid gap-3 md:grid-cols-2">
            {/* a régua: pendências x expiradas */}
            <div className="rounded-xl bg-card p-4 shadow-[var(--shadow-border)]">
              <h3 className="text-base font-semibold">Pendências</h3>
              <p className="mt-2 text-sm">
                <b className="text-base font-semibold tabular-nums">
                  {itens.length}
                </b>
                <span className="text-muted-foreground">
                  {" "}
                  {itens.length === 1
                    ? "documento aguardando"
                    : "documentos aguardando"}
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
                    valor: pendentes,
                    rotulo: pendentes === 1 ? "pendente" : "pendentes",
                    cls: "bg-muted-foreground",
                  },
                  {
                    valor: expiradas,
                    rotulo: expiradas === 1 ? "expirada" : "expiradas",
                    cls: "bg-[var(--warn)]",
                  },
                ]}
              />
              <p className="mt-3 text-xs text-muted-foreground">
                {maisAntigoDias === 0
                  ? "a mais antiga foi emitida hoje"
                  : maisAntigoDias === 1
                    ? "a mais antiga espera desde ontem"
                    : `a mais antiga espera há ${maisAntigoDias} dias`}
              </p>
            </div>

            {/* onde as pendências se concentram */}
            <div className="rounded-xl bg-card p-4 shadow-[var(--shadow-border)]">
              <h3 className="text-base font-semibold">Por documento</h3>
              <dl className="mt-3 space-y-1.5">
                {docs.map(([doc, n]) => (
                  <div
                    key={doc}
                    className="flex items-baseline justify-between gap-3 text-sm"
                  >
                    <dd className="min-w-0">{doc}</dd>
                    <dd className="font-semibold tabular-nums">{n}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </div>

          {/* a fila por pessoa */}
          <div>
            <h3 className="mb-2 text-sm font-semibold">
              A cobrar ({fila.length})
            </h3>
            <RelatorioLista>
              {fila.map((item, i) => (
                <li key={`${item.pessoaId}:${item.linha.documento}`}>
                  <RelatorioLinha
                    i={i}
                    situacao={
                      item.status === "expirado"
                        ? { rotulo: "Expirado", tom: "atencao" }
                        : { rotulo: "Pendente", tom: "neutro" }
                    }
                    titulo={item.linha.nome || "Sem nome"}
                    meta={`${item.linha.papel} · emitido ${dia(item.linha.emitido_em)}`}
                    detalhe={
                      item.status === "expirado"
                        ? `${item.linha.documento} — link expirou ${dia(item.linha.expira_em)}; reemitir na ficha`
                        : `${item.linha.documento} — expira ${dia(item.linha.expira_em)}`
                    }
                    href={
                      item.pessoaId ? `/pessoas/${item.pessoaId}` : undefined
                    }
                    hrefLabel={`Ver ficha de ${item.linha.nome}`}
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
            colunas={[
              "Nome",
              "Papel",
              "Documento",
              "Status",
              "Emitido em",
              "Expira em",
            ]}
            linhas={itens.map((i) => [
              i.linha.nome,
              i.linha.papel,
              i.linha.documento,
              i.linha.status,
              dia(i.linha.emitido_em) || "—",
              dia(i.linha.expira_em) || "—",
            ])}
          />
        </Collapsible.Panel>
      </Collapsible.Root>
    </section>
  );
}
