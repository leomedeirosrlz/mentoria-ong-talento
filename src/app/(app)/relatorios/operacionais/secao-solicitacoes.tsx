import { CaretDown } from "@phosphor-icons/react/dist/ssr";
import { Collapsible } from "@base-ui/react/collapsible";
import { diffDias } from "@/lib/ciclo";
import { dataHora, dia } from "@/lib/relatorios/csv-core";
import type { ItemSolicitacao } from "@/lib/relatorios/dados";
import type { SolicitacaoEspecialistaStatus } from "@/lib/types";
import type { TomSituacao } from "@/components/dupla-linha";
import {
  COLAPSIVEL_PANEL,
  RelatorioLinha,
  RelatorioLista,
  RelatorioSecaoTopo,
  RelatorioTabela,
} from "./relatorio-secao";

// Seção "Especialistas" (REALIZA-389): o resumo é o funil do mural — o que
// espera triagem da coordenação, o que espera aceite do especialista e o
// que já decidiu. A fila leva à ficha da dupla DPP (onde a negociação mora)
// ou à ficha do jovem. A tabela do export fica embaixo, colapsada.

/** status que ainda pedem ação de alguém — o resto é decisão registrada. */
const PENDENTES = new Set<SolicitacaoEspecialistaStatus>([
  "aguardando_coord",
  "aberta",
  "contra_proposta",
  "sugerida",
]);

const TOM_STATUS: Record<SolicitacaoEspecialistaStatus, TomSituacao> = {
  aguardando_coord: "atencao",
  contra_proposta: "atencao",
  aberta: "neutro",
  sugerida: "neutro",
  aceita: "neutro",
  recusada: "pausa",
  cancelada: "pausa",
  expirada: "pausa",
};

export function SecaoSolicitacoes({
  itens,
  csvHref,
  hoje,
}: {
  itens: ItemSolicitacao[];
  csvHref: string;
  hoje: Date;
}) {
  const hojeDia = hoje.toISOString().slice(0, 10);
  const pendentes = itens
    .filter((i) => PENDENTES.has(i.statusEfetivo))
    .sort((a, b) => a.linha.criada_em.localeCompare(b.linha.criada_em));
  const decididas = itens
    .filter((i) => !PENDENTES.has(i.statusEfetivo))
    .sort((a, b) => b.linha.criada_em.localeCompare(a.linha.criada_em));

  const porStatus = new Map<SolicitacaoEspecialistaStatus, number>();
  for (const i of itens) {
    porStatus.set(
      i.statusEfetivo,
      (porStatus.get(i.statusEfetivo) ?? 0) + 1
    );
  }
  const aguardandoTriagem = porStatus.get("aguardando_coord") ?? 0;
  const esperandoEspecialista =
    (porStatus.get("aberta") ?? 0) + (porStatus.get("sugerida") ?? 0);
  const emNegociacao = porStatus.get("contra_proposta") ?? 0;
  const aceitas = porStatus.get("aceita") ?? 0;

  // latência média das que já responderam — mesma derivação da coluna do CSV
  const latencias = itens
    .map((i) => i.linha.latencia)
    .filter((l): l is number => l != null);
  const latenciaMedia = latencias.length
    ? Math.round(latencias.reduce((s, l) => s + l, 0) / latencias.length)
    : null;
  const maisAntigoDias = pendentes.length
    ? diffDias(hojeDia, pendentes[0].linha.criada_em.slice(0, 10))
    : null;

  return (
    <section className="space-y-4">
      <RelatorioSecaoTopo
        titulo="Pedidos de especialista"
        descricao="Solicitações do jovem, do mentor e da equipe com o status efetivo (expiração aplicada) e a latência de resposta."
        csvHref={csvHref}
      />

      {itens.length === 0 ? (
        <p className="rounded-xl bg-card px-4 py-6 text-sm text-muted-foreground shadow-[var(--shadow-border)]">
          Nenhum pedido de especialista neste recorte.
        </p>
      ) : (
        <>
          <div className="grid gap-3 md:grid-cols-2">
            {/* o funil do mural */}
            <div className="rounded-xl bg-card p-4 shadow-[var(--shadow-border)]">
              <h3 className="text-base font-semibold">Funil</h3>
              <dl className="mt-3 space-y-1.5">
                {(
                  [
                    ["aguardando triagem", aguardandoTriagem],
                    ["esperando especialista", esperandoEspecialista],
                    ["em negociação", emNegociacao],
                    ["aceitas", aceitas],
                    ["decididas", decididas.length],
                  ] as const
                ).map(([rotulo, n]) => (
                  <div
                    key={rotulo}
                    className="flex items-baseline justify-between gap-3 text-sm"
                  >
                    <dd>{rotulo}</dd>
                    <dd className="font-semibold tabular-nums">{n}</dd>
                  </div>
                ))}
              </dl>
            </div>

            {/* tempo de resposta e o que mais espera */}
            <div className="rounded-xl bg-card p-4 shadow-[var(--shadow-border)]">
              <h3 className="text-base font-semibold">Resposta</h3>
              <p className="mt-2 text-sm">
                <b className="text-base font-semibold tabular-nums">
                  {latenciaMedia == null ? "—" : `${latenciaMedia}d`}
                </b>
                <span className="text-muted-foreground">
                  {" "}
                  latência média de resposta
                </span>
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {pendentes.length === 0
                  ? "nada esperando ação"
                  : maisAntigoDias === 0
                    ? `${pendentes.length} em aberto — a mais antiga é de hoje`
                    : maisAntigoDias === 1
                      ? `${pendentes.length} em aberto — a mais antiga espera desde ontem`
                      : `${pendentes.length} em aberto — a mais antiga espera há ${maisAntigoDias} dias`}
              </p>
            </div>
          </div>

          {/* o que ainda pede ação */}
          {pendentes.length > 0 && (
            <div>
              <h3 className="mb-2 text-sm font-semibold">
                Esperando ação ({pendentes.length})
              </h3>
              <RelatorioLista>
                {pendentes.map((item, i) => (
                  <LinhaSolicitacao key={item.solicitacaoId} item={item} i={i} />
                ))}
              </RelatorioLista>
            </div>
          )}

          {/* o que já decidiu, colapsado */}
          {decididas.length > 0 && (
            <Collapsible.Root>
              <Collapsible.Trigger className="group flex min-h-11 w-full cursor-pointer items-center gap-1.5 rounded-lg py-2 text-left text-sm font-semibold text-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                Decididas ({decididas.length})
                <CaretDown
                  size={14}
                  aria-hidden
                  className="text-muted-foreground transition-transform group-data-[panel-open]:rotate-180"
                />
              </Collapsible.Trigger>
              <Collapsible.Panel hiddenUntilFound className={COLAPSIVEL_PANEL}>
                <RelatorioLista>
                  {decididas.map((item, i) => (
                    <LinhaSolicitacao
                      key={item.solicitacaoId}
                      item={item}
                      i={i}
                    />
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
              "Mentorado",
              "Demanda",
              "Origem",
              "Status",
              "Criada em",
              "Latência",
              "Especialista",
            ]}
            linhas={itens.map((i) => [
              i.linha.mentorado,
              i.linha.demanda,
              i.linha.origem,
              i.linha.status,
              dataHora(i.linha.criada_em) || "—",
              i.linha.latencia == null ? "—" : `${i.linha.latencia}d`,
              i.linha.especialista,
            ])}
          />
        </Collapsible.Panel>
      </Collapsible.Root>
    </section>
  );
}

function LinhaSolicitacao({
  item,
  i,
}: {
  item: ItemSolicitacao;
  i: number;
}) {
  const meta = [
    item.linha.origem,
    `criada ${dia(item.linha.criada_em)}`,
    item.linha.latencia != null ? `resposta em ${item.linha.latencia}d` : null,
    item.linha.especialista || null,
  ]
    .filter(Boolean)
    .join(" · ");
  // a negociação mora na ficha da dupla DPP; o pedido solto do jovem leva
  // à ficha dele
  const href = item.duplaDppId
    ? `/duplas/${item.duplaDppId}`
    : item.mentoradoId
      ? `/pessoas/${item.mentoradoId}`
      : undefined;
  return (
    <li>
      <RelatorioLinha
        i={i}
        situacao={{
          rotulo: item.linha.status,
          tom: TOM_STATUS[item.statusEfetivo] ?? "neutro",
        }}
        titulo={item.linha.mentorado || "Sem mentorado"}
        meta={meta}
        detalhe={item.linha.demanda || "—"}
        href={href}
        hrefLabel={`Ver pedido de ${item.linha.mentorado}`}
      />
    </li>
  );
}
