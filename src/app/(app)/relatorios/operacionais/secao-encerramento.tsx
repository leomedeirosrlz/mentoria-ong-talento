import Link from "next/link";
import { CaretDown } from "@phosphor-icons/react/dist/ssr";
import { Collapsible } from "@base-ui/react/collapsible";
import {
  eventosDoCronograma,
  formatDiaMes,
  totalDaTrilha,
} from "@/lib/ciclo";
import { situacaoDaDupla, SITUACAO_DUPLA_LABEL } from "@/lib/dupla-desfecho";
import {
  CHECKLIST_ENCERRAMENTO,
  encerramentoDecidido,
} from "@/lib/encerramento";
import { turmaDaDupla, turmaLonga } from "@/lib/turma";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { CicloEvento, Cronograma } from "@/lib/types";
import {
  CHECKLIST_CURTO,
  fichaRitoHref,
  type ItemEncerramento,
  type ResumoEncerramento,
} from "@/lib/relatorios/operacional";
import { ENCERRAMENTO_TIPO_LABEL } from "@/lib/relatorios/dados";
import type { LinhaEncerramento } from "@/lib/relatorios/csv";
import { BarraSegmentada } from "@/components/viz";
import { DuplaLinha, type TomSituacao } from "@/components/dupla-linha";
import { DuplaLinhaMenu } from "@/components/dupla-linha-menu";
import { RelatorioSecaoTopo, RelatorioTabela } from "./relatorio-secao";

// Seção "Encerramentos" (REALIZA-389): o resumo responde "quantos ritos
// esperam decisão da coordenação e o que falta neles"; a fila leva direto
// ao passo do rito na ficha. A tabela do export fica embaixo, colapsada —
// as mesmas linhas que o CSV baixa.

const COLAPSIVEL_PANEL =
  "h-[var(--collapsible-panel-height)] overflow-hidden transition-[height] duration-150 data-ending-style:h-0 data-starting-style:h-0 [&[hidden]:not([hidden='until-found'])]:hidden";

export function SecaoEncerramento({
  resumo,
  linhas,
  csvHref,
  eventos,
  crons,
}: {
  resumo: ResumoEncerramento;
  /** linhas do CSV já no recorte — a prévia colapsada lê daqui */
  linhas: LinhaEncerramento[];
  csvHref: string;
  eventos: CicloEvento[];
  crons: readonly Pick<Cronograma, "id" | "nome" | "turma">[];
}) {
  const decididos = resumo.concluidas + resumo.encerradas;

  return (
    <section className="space-y-4">
      <RelatorioSecaoTopo
        titulo="Encerramentos"
        descricao="O rito de fechamento de cada dupla: o que já foi decidido, o que espera a coordenação e o checklist de cada pendência."
        csvHref={csvHref}
      />

      {resumo.total === 0 ? (
        <p className="rounded-xl bg-card px-4 py-6 text-sm text-muted-foreground shadow-[var(--shadow-border)]">
          Nenhum rito de encerramento neste recorte.
        </p>
      ) : (
        <>
          <div className="grid gap-3 md:grid-cols-2">
            {/* a régua do ciclo: decididos × pendentes */}
            <div className="rounded-xl bg-card p-4 shadow-[var(--shadow-border)]">
              <h3 className="text-base font-semibold">Decisão do rito</h3>
              <p className="mt-2 text-sm">
                <b className="text-base font-semibold tabular-nums">
                  {decididos}
                </b>
                <span className="text-muted-foreground">
                  {" "}
                  de {resumo.total} decididos
                </span>
              </p>
              <BarraSegmentada
                className="mt-3"
                altura="md"
                denominador={resumo.total}
                animate
                legenda
                segmentos={[
                  {
                    valor: resumo.pendentes.length,
                    rotulo: "sem decisão",
                    cls: "bg-[var(--warn)]",
                  },
                  {
                    valor: resumo.concluidas,
                    rotulo:
                      resumo.concluidas === 1 ? "concluída" : "concluídas",
                    cls: "bg-muted-foreground",
                  },
                  {
                    valor: resumo.encerradas,
                    rotulo:
                      resumo.encerradas === 1 ? "encerrada" : "encerradas",
                    cls: "bg-muted-foreground/40",
                  },
                ]}
              />
              <p className="mt-3 text-xs text-muted-foreground">
                A decisão é da coordenação e fecha o ciclo na ficha da dupla.
              </p>
            </div>

            {/* o trabalho pendente: quantos, o mais antigo, o que falta */}
            <div className="rounded-xl bg-card p-4 shadow-[var(--shadow-border)]">
              <h3 className="text-base font-semibold">Aguardando decisão</h3>
              {resumo.pendentes.length > 0 ? (
                <>
                  <p className="mt-2 text-sm">
                    <b className="text-base font-semibold tabular-nums">
                      {resumo.pendentes.length}
                    </b>
                    <span className="text-muted-foreground">
                      {" "}
                      {resumo.pendentes.length === 1
                        ? "rito sem decisão"
                        : "ritos sem decisão"}
                    </span>
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {resumo.maisAntigoDias === 0
                      ? "o mais antigo foi aberto hoje"
                      : resumo.maisAntigoDias === 1
                        ? "o mais antigo espera desde ontem"
                        : `o mais antigo espera há ${resumo.maisAntigoDias} dias`}
                  </p>
                  {resumo.faltantes.length > 0 && (
                    <dl className="mt-4 space-y-1.5 border-t border-border/60 pt-3">
                      <dt className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
                        itens do checklist em aberto
                      </dt>
                      {resumo.faltantes.map((f) => (
                        <div
                          key={f.key}
                          className="flex items-baseline justify-between gap-3 text-sm"
                          title={
                            CHECKLIST_ENCERRAMENTO.find(
                              (i) => i.key === f.key
                            )?.label
                          }
                        >
                          <dd>{CHECKLIST_CURTO[f.key]}</dd>
                          <dd className="font-semibold tabular-nums">
                            {f.n}
                          </dd>
                        </div>
                      ))}
                    </dl>
                  )}
                </>
              ) : (
                <p className="mt-2 text-sm text-muted-foreground">
                  Nenhum rito esperando decisão.
                </p>
              )}
            </div>
          </div>

          {/* a fila: ritos sem decisão, mais antigos primeiro */}
          {resumo.pendentes.length > 0 && (
            <div>
              <h3 className="mb-2 text-sm font-semibold">
                A concluir ({resumo.pendentes.length})
              </h3>
              <div className="@container">
                <ul
                  key={resumo.pendentes.map((i) => i.enc.id).join("|")}
                  className="space-y-3 @4xl:space-y-0 @4xl:divide-y @4xl:divide-border/60 @4xl:overflow-hidden @4xl:rounded-xl @4xl:bg-card @4xl:shadow-[var(--shadow-border)]"
                >
                  {resumo.pendentes.map((item, i) => (
                    <li key={item.enc.id}>
                      <LinhaRito
                        item={item}
                        eventos={eventos}
                        crons={crons}
                        i={i}
                      />
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {/* o histórico: decisões já registradas, colapsadas */}
          {resumo.decididos.length > 0 && (
            <Collapsible.Root>
              <Collapsible.Trigger className="group flex min-h-11 w-full cursor-pointer items-center gap-1.5 rounded-lg py-2 text-left text-sm font-semibold text-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                Decididos ({resumo.decididos.length})
                <CaretDown
                  size={14}
                  aria-hidden
                  className="text-muted-foreground transition-transform group-data-[panel-open]:rotate-180"
                />
              </Collapsible.Trigger>
              <Collapsible.Panel hiddenUntilFound className={COLAPSIVEL_PANEL}>
                <div className="@container">
                  <ul
                    key={resumo.decididos.map((i) => i.enc.id).join("|")}
                    className="space-y-3 @4xl:space-y-0 @4xl:divide-y @4xl:divide-border/60 @4xl:overflow-hidden @4xl:rounded-xl @4xl:bg-card @4xl:shadow-[var(--shadow-border)]"
                  >
                    {resumo.decididos.map((item, i) => (
                      <li key={item.enc.id}>
                        <LinhaRito
                          item={item}
                          eventos={eventos}
                          crons={crons}
                          i={i}
                        />
                      </li>
                    ))}
                  </ul>
                </div>
              </Collapsible.Panel>
            </Collapsible.Root>
          )}
        </>
      )}

      {/* a tabela do export, colapsada */}
      <Collapsible.Root>
        <Collapsible.Trigger className="group flex min-h-11 w-full cursor-pointer items-center gap-1.5 rounded-lg py-2 text-left text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          Prévia do export ({linhas.length}{" "}
          {linhas.length === 1 ? "linha" : "linhas"})
          <CaretDown
            size={14}
            aria-hidden
            className="transition-transform group-data-[panel-open]:rotate-180"
          />
        </Collapsible.Trigger>
        <Collapsible.Panel hiddenUntilFound className={COLAPSIVEL_PANEL}>
          <RelatorioTabela
            colunas={[
              "Mentor",
              "Mentorado",
              "Tipo",
              "Checklist",
              "Decidido por",
              "Resumo",
              "Criado em",
            ]}
            linhas={linhas.slice(0, 8).map((l) => [
              l.mentor,
              l.mentorado,
              l.tipo,
              l.checklist,
              l.decidido_por || "—",
              l.resumo_jornada,
              formatDiaMes(l.created_at),
            ])}
            total={linhas.length}
          />
        </Collapsible.Panel>
      </Collapsible.Root>
    </section>
  );
}

function LinhaRito({
  item,
  eventos,
  crons,
  i,
}: {
  item: ItemEncerramento;
  eventos: CicloEvento[];
  crons: readonly Pick<Cronograma, "id" | "nome" | "turma">[];
  i: number;
}) {
  const { enc, dupla: d, feitos, total, faltantes, diasAberto } = item;
  const decidido = encerramentoDecidido(enc);

  // sem a dupla carregada o rito vira linha de fato (o CSV a cobre) — sem
  // ficha não há linha canônica pra montar
  if (!d) return null;

  const situacao: { rotulo: string; tom: TomSituacao } = decidido
    ? {
        rotulo:
          (ENCERRAMENTO_TIPO_LABEL[enc.tipo] ?? enc.tipo).replace(
            /^./,
            (c) => c.toUpperCase()
          ),
        tom: "pausa",
      }
    : { rotulo: "Rito pendente", tom: "atencao" };
  const turma = turmaDaDupla(d, crons);
  const meta = [
    turma ? turmaLonga(turma) : null,
    `aberto em ${formatDiaMes(enc.created_at)}`,
  ]
    .filter(Boolean)
    .join(" · ");
  const decisorNome = enc.decidido?.nome_social ?? enc.decidido?.nome;
  const motivo = decidido
    ? [
        decisorNome ? `decidido por ${decisorNome}` : "sem decisor registrado",
        `checklist ${feitos} de ${total}`,
        enc.resumo_jornada ? "resumo gravado" : "sem resumo da jornada",
      ].join(" · ")
    : [
        `checklist ${feitos} de ${total}`,
        faltantes.length > 0
          ? `falta: ${faltantes.map((k) => CHECKLIST_CURTO[k]).join(", ")}`
          : "completo, falta decidir",
      ].join(" · ");

  return (
    <DuplaLinha
      i={i}
      mentor={d.mentor}
      mentorado={d.mentorado}
      situacao={situacao}
      meta={meta}
      motivo={motivo}
      progresso={{
        total: totalDaTrilha(
          d.trilha,
          eventosDoCronograma(eventos, d.cronograma_id)
        ),
        realizados: d.encontros
          .filter((e) => e.status === "realizado")
          .map((e) => e.numero),
        esperado: null,
        legenda: SITUACAO_DUPLA_LABEL[situacaoDaDupla(d)].toLowerCase(),
      }}
      nota={
        decidido ? null : (
          <span
            className="whitespace-nowrap text-xs tabular-nums text-muted-foreground"
            title="Tempo desde a abertura do rito"
          >
            {diasAberto === 0
              ? "aberto hoje"
              : diasAberto === 1
                ? "há 1 dia"
                : `há ${diasAberto} dias`}
          </span>
        )
      }
      acao={
        decidido ? null : (
          <Link
            href={fichaRitoHref(d, eventos)}
            className={cn(buttonVariants({ size: "sm" }))}
          >
            Concluir rito
          </Link>
        )
      }
      menu={<DuplaLinhaMenu dupla={d} editar formulario />}
      fichaHref={fichaRitoHref(d, eventos)}
      fichaNome={(d.mentorado.nome_social ?? d.mentorado.nome).split(" ")[0]}
    />
  );
}
