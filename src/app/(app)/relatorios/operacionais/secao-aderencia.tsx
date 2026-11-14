import { CaretDown } from "@phosphor-icons/react/dist/ssr";
import { Collapsible } from "@base-ui/react/collapsible";
import {
  eventosDoCronograma,
  totalDaTrilha,
} from "@/lib/ciclo";
import { situacaoDaDupla, SITUACAO_DUPLA_LABEL } from "@/lib/dupla-desfecho";
import { acaoWhatsAppDupla } from "@/lib/acao-lembrete";
import { turmaDaDupla, turmaLonga } from "@/lib/turma";
import type { Interacao } from "@/lib/interacoes";
import type { CicloEvento, Cronograma } from "@/lib/types";
import type {
  ItemAderencia,
  ResumoAderencia,
} from "@/lib/relatorios/operacional";
import { BarraSegmentada } from "@/components/viz";
import { SaudePrograma } from "@/components/saude-programa";
import { DuplaLinha, type TomSituacao } from "@/components/dupla-linha";
import { DuplaLinhaMenu } from "@/components/dupla-linha-menu";
import { DuplaWaAcao } from "@/components/dupla-wa-acao";
import { cn } from "@/lib/utils";
import { RelatorioSecaoTopo, RelatorioTabela } from "./relatorio-secao";

// Seção "Aderência ao ciclo" (REALIZA-389): o resumo responde "o que pede
// ação agora" — saúde canônica do recorte, régua do calendário e a fila
// das duplas com sinal — e a tabela do export fica disponível embaixo,
// colapsada (as linhas são as MESMAS do CSV: uma derivação só).
//
// As linhas seguem a anatomia do /duplas: situação + apoio, dupla,
// motivo, quadrados do plano, a métrica da seção (aderência %), UMA ação
// contextual (Lembrar/Chamar) e o ⋯ real.

const SEMAFORO: Record<
  "risco" | "atencao" | "ok",
  { rotulo: string; tom: TomSituacao }
> = {
  risco: { rotulo: "Em risco", tom: "risco" },
  atencao: { rotulo: "Atenção", tom: "atencao" },
  ok: { rotulo: "Em dia", tom: "neutro" },
};

const APOIO_ORIGEM_LABEL = {
  mentor: "pedido pelo mentor",
  mentorado: "pedido pelo mentorado",
  ambos: "pedido pelo mentor e pelo mentorado",
} as const;

const COLAPSIVEL_PANEL =
  "h-[var(--collapsible-panel-height)] overflow-hidden transition-[height] duration-150 data-ending-style:h-0 data-starting-style:h-0 [&[hidden]:not([hidden='until-found'])]:hidden";

export function SecaoAderencia({
  resumo,
  csvHref,
  eventos,
  crons,
  nudges,
  meuNome,
  origem,
  hoje,
}: {
  resumo: ResumoAderencia;
  /** /api/export?tipo=aderencia&… — com o recorte ativo. */
  csvHref: string;
  eventos: CicloEvento[];
  crons: readonly Pick<Cronograma, "id" | "nome" | "turma">[];
  /** última interação `nudge` por dupla — alimenta o cap de 48h do Lembrar */
  nudges: Record<string, Interacao>;
  meuNome: string;
  origem: string;
  hoje: Date;
}) {
  const linhas = resumo.itens.map((i) => i.linha);

  return (
    <section className="space-y-4">
      <RelatorioSecaoTopo
        titulo="Aderência ao ciclo"
        descricao="Quem está no ritmo do calendário, quem pede ação e o que fazer — a mesma régua que o CSV resume linha a linha."
        csvHref={csvHref}
      />

      {resumo.itens.length === 0 ? (
        <p className="rounded-xl bg-card px-4 py-6 text-sm text-muted-foreground shadow-[var(--shadow-border)]">
          Nenhuma dupla neste recorte.
        </p>
      ) : (
        <>
          {/* resumo: saúde canônica + régua do calendário + registros */}
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            <div className="rounded-xl bg-card p-4 shadow-[var(--shadow-border)] md:col-span-2 xl:col-span-1">
              <SaudePrograma
                saude={resumo.saude}
                nivel="h3"
                linkBase="/duplas"
              />
            </div>

            <div className="rounded-xl bg-card p-4 shadow-[var(--shadow-border)]">
              <h3 className="text-base font-semibold">Encontros devidos</h3>
              {resumo.esperados > 0 ? (
                <>
                  <p className="mt-2 text-sm">
                    <b className="text-base font-semibold tabular-nums">
                      {resumo.realizadosNoPrazo}
                    </b>
                    <span className="text-muted-foreground">
                      {" "}
                      de {resumo.esperados} até hoje
                    </span>
                  </p>
                  <BarraSegmentada
                    className="mt-3"
                    altura="md"
                    denominador={resumo.esperados}
                    animate
                    legenda
                    segmentos={[
                      {
                        valor: resumo.realizadosNoPrazo,
                        rotulo: "realizados",
                        cls: "bg-[var(--ok)]",
                      },
                      {
                        valor: resumo.emAtraso,
                        rotulo: "em atraso",
                        cls: "bg-[var(--warn)]",
                      },
                    ]}
                  />
                  <p className="mt-3 text-xs text-muted-foreground">
                    {resumo.atrasDoCalendario === 1
                      ? "1 dupla atrás do calendário"
                      : `${resumo.atrasDoCalendario} duplas atrás do calendário`}
                    {resumo.adiantados > 0 &&
                      ` · +${resumo.adiantados} ${
                        resumo.adiantados === 1
                          ? "adiantado ou em reposição"
                          : "adiantados ou em reposição"
                      }`}
                  </p>
                </>
              ) : (
                <p className="mt-2 text-sm text-muted-foreground">
                  Nada devido pelo calendário até hoje.
                </p>
              )}
            </div>

            <div className="rounded-xl bg-card p-4 shadow-[var(--shadow-border)]">
              <h3 className="text-base font-semibold">Registros</h3>
              <dl className="mt-3 grid grid-cols-3 gap-x-3">
                <Stat
                  rotulo="com pendência"
                  valor={resumo.registrosPendentes}
                  destaque={resumo.registrosPendentes > 0}
                  titulo="Duplas ativas com registro pendente ou agendamento vencido sem registro"
                />
                <Stat
                  rotulo="atraso médio"
                  valor={
                    resumo.atrasoMedioRegistro != null
                      ? `${resumo.atrasoMedioRegistro.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}d`
                      : "—"
                  }
                  titulo="Média dos dias entre realizado e registro, ponderada pelos registros do recorte"
                />
                <Stat
                  rotulo="remarcações"
                  valor={resumo.remarcacoes}
                  titulo="Reagendamentos somados do ciclo"
                />
              </dl>
            </div>
          </div>

          {/* a fila: duplas ativas com sinal ou apoio, por urgência */}
          {resumo.fila.length > 0 ? (
            <div>
              <h3 className="mb-2 text-sm font-semibold">
                Precisa de ação ({resumo.fila.length})
              </h3>
              {/* o @container da lista: os @4xl: do ul respondem à largura
                  dele, não da tela */}
              <div className="@container">
                <ul
                  key={resumo.fila.map((i) => i.dupla.id).join("|")}
                  className="space-y-3 @4xl:space-y-0 @4xl:divide-y @4xl:divide-border/60 @4xl:overflow-hidden @4xl:rounded-xl @4xl:bg-card @4xl:shadow-[var(--shadow-border)]"
                >
                  {resumo.fila.map((item, i) => (
                    <li key={item.dupla.id}>
                      <LinhaAderencia
                        item={item}
                        eventos={eventos}
                        crons={crons}
                        nudges={nudges}
                        meuNome={meuNome}
                        origem={origem}
                        hoje={hoje}
                        i={i}
                      />
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ) : (
            <p className="rounded-xl bg-card px-4 py-4 text-sm text-muted-foreground shadow-[var(--shadow-border)]">
              Nada pedindo ação entre as duplas ativas do recorte.
            </p>
          )}

          {/* a massa do recorte: mesma linha, colapsada */}
          {resumo.demais.length > 0 && (
            <Collapsible.Root>
              <Collapsible.Trigger className="group flex min-h-11 w-full cursor-pointer items-center gap-1.5 rounded-lg py-2 text-left text-sm font-semibold text-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                Demais duplas do recorte ({resumo.demais.length})
                <CaretDown
                  size={14}
                  aria-hidden
                  className="text-muted-foreground transition-transform group-data-[panel-open]:rotate-180"
                />
              </Collapsible.Trigger>
              <Collapsible.Panel hiddenUntilFound className={COLAPSIVEL_PANEL}>
                <div className="@container">
                  <ul
                    key={resumo.demais.map((i) => i.dupla.id).join("|")}
                    className="space-y-3 @4xl:space-y-0 @4xl:divide-y @4xl:divide-border/60 @4xl:overflow-hidden @4xl:rounded-xl @4xl:bg-card @4xl:shadow-[var(--shadow-border)]"
                  >
                    {resumo.demais.map((item, i) => (
                      <li key={item.dupla.id}>
                        <LinhaAderencia
                          item={item}
                          eventos={eventos}
                          crons={crons}
                          nudges={nudges}
                          meuNome={meuNome}
                          origem={origem}
                          hoje={hoje}
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

      {/* a tabela do export, colapsada: as mesmas linhas que o CSV baixa */}
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
              "Mentorado",
              "Mentor",
              "Turma",
              "Esperados",
              "Realizados",
              "Aderência",
              "Semáforo",
              "Motivos",
            ]}
            linhas={linhas.slice(0, 8).map((l) => [
              l.mentorado,
              l.mentor,
              l.turma || "—",
              String(l.esperados),
              String(l.realizados),
              l.aderencia == null ? "—" : `${l.aderencia}%`,
              l.semaforo,
              l.motivos || "—",
            ])}
            total={linhas.length}
          />
        </Collapsible.Panel>
      </Collapsible.Root>
    </section>
  );
}

function Stat({
  rotulo,
  valor,
  titulo,
  destaque = false,
}: {
  rotulo: string;
  valor: number | string;
  titulo: string;
  destaque?: boolean;
}) {
  return (
    <div title={titulo}>
      <dt className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
        {rotulo}
      </dt>
      <dd
        className={cn(
          "mt-0.5 text-lg font-semibold tabular-nums",
          destaque && "text-[var(--warn-text)]"
        )}
      >
        {valor}
      </dd>
    </div>
  );
}

/** O motivo da linha na régua da aderência: os sinais acesos (como no
 *  /duplas) ou o trabalho a fazer quando a régua está limpa. */
function motivoDaItem(item: ItemAderencia): string | null {
  const d = item.dupla;
  if (d.status === "pausada") return "Jornada congelada, sem cobrança";
  if (d.status !== "ativa") return null;
  if (item.saude.sinais.length === 0)
    return item.saude.apoio.aberto ? "Pedido de apoio em aberto" : null;
  return item.saude.sinais
    .map(
      (s) =>
        s.texto +
        (s.detalhe
          ? s.detalhe.startsWith("há")
            ? ` ${s.detalhe}`
            : ` (${s.detalhe})`
          : "")
    )
    .join(" · ");
}

function LinhaAderencia({
  item,
  eventos,
  crons,
  nudges,
  meuNome,
  origem,
  hoje,
  i,
}: {
  item: ItemAderencia;
  eventos: CicloEvento[];
  crons: readonly Pick<Cronograma, "id" | "nome" | "turma">[];
  nudges: Record<string, Interacao>;
  meuNome: string;
  origem: string;
  hoje: Date;
  i: number;
}) {
  const d = item.dupla;
  const saude = item.saude;
  const ehEsp = d.trilha === "especialista";
  const ativa = d.status === "ativa";
  const total = totalDaTrilha(
    d.trilha,
    eventosDoCronograma(eventos, d.cronograma_id)
  );
  const realizados = d.encontros
    .filter((e) => e.status === "realizado")
    .map((e) => e.numero);
  const turma = turmaDaDupla(d, crons);
  const meta = [
    ehEsp ? "Trilha de especialista" : null,
    turma ? turmaLonga(turma) : null,
  ]
    .filter(Boolean)
    .join(" · ");
  const situacao = ativa
    ? SEMAFORO[saude.semaforo]
    : {
        rotulo: SITUACAO_DUPLA_LABEL[situacaoDaDupla(d)],
        tom: "pausa" as TomSituacao,
      };

  return (
    <DuplaLinha
      i={i}
      mentor={d.mentor}
      mentorado={d.mentorado}
      situacao={situacao}
      apoio={
        saude.apoio.aberto
          ? { detalhe: APOIO_ORIGEM_LABEL[saude.apoio.origem ?? "mentor"] }
          : null
      }
      meta={meta || null}
      motivo={motivoDaItem(item)}
      progresso={{
        total,
        realizados,
        esperado: !ehEsp && ativa ? saude.esperado : null,
        legenda:
          d.status === "pausada"
            ? "em pausa"
            : ativa
              ? ehEsp
                ? "sessões"
                : `esperado ${saude.esperado}`
              : SITUACAO_DUPLA_LABEL[situacaoDaDupla(d)].toLowerCase(),
      }}
      nota={
        item.linha.aderencia != null ? (
          <span
            className="whitespace-nowrap"
            title="Aderência ao calendário: realizados ÷ devidos até hoje"
          >
            <b className="text-sm font-semibold tabular-nums">
              {item.linha.aderencia}%
            </b>
            <span className="ml-1 text-xs text-muted-foreground">
              do esperado
            </span>
          </span>
        ) : (
          <span
            className="whitespace-nowrap text-xs text-muted-foreground"
            title={
              ehEsp
                ? "A trilha de especialista não tem régua de calendário"
                : "Nada devido pelo calendário até hoje"
            }
          >
            {ehEsp ? "Sem régua" : "Nada devido"}
          </span>
        )
      }
      acao={
        <DuplaWaAcao
          {...acaoWhatsAppDupla({
            dupla: d,
            saude,
            hoje,
            ultimoNudge:
              nudges[d.id]?.tipo === "nudge" ? nudges[d.id] : null,
            meuNome,
            tituloNudge: "Lembrete da coordenação",
            origem,
          })}
        />
      }
      menu={
        <DuplaLinhaMenu
          dupla={d}
          editar
          formulario
          remanejar
          encerrar={
            ehEsp &&
            !d.encerrada_em &&
            (d.status === "ativa" || d.status === "pausada")
          }
        />
      }
      fichaHref={`/duplas/${d.id}`}
      fichaNome={d.mentorado.nome_social ?? d.mentorado.nome}
    />
  );
}
