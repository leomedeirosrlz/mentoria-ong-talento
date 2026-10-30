import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  CaretLeft,
  Check,
  LockSimple,
  Warning,
} from "@phosphor-icons/react/dist/ssr";
import {
  getCicloEventos,
  getDuplas,
  getMe,
  getPainelInstrumentosJornada,
} from "@/lib/queries";
import { getFormulario, getFormularios, getInstrumentosDaDupla } from "@/lib/forms/queries";
import { temPapel } from "@/lib/types";
import type { Dupla } from "@/lib/types";
import {
  ESTACOES,
  resolveLinhasPainel,
  SISTEMA_DA_ESTACAO,
  entregasDoMomento,
  type EstacaoPainelEstado,
  type PainelJornadaLinha,
} from "@/lib/jornada";
import {
  AVANCEI_AVALIACAO_LABEL,
  formatDate,
  SENTIMENTO_AVALIACAO_LABEL,
  TEMA_AVALIACAO_LABEL,
  estrelasTexto,
} from "@/lib/ciclo";
import {
  respostaFormatada,
  type FormularioCampo,
  type RespostaValor,
} from "@/lib/forms/schema";
import type { InstrumentoEntrega } from "@/lib/forms/queries";
import { turmaCurta } from "@/lib/turma";
import {
  InstrumentoEmblema,
  instrumentoVars,
} from "@/components/instrumento-icone";
import { InstrumentoResultado } from "@/components/instrumento-resultado";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { CARDS } from "../../instrumentos-programa";
import { DetalheInstrumentoLazy } from "./detalhe-instrumento-lazy";

// Página por instrumento (REALIZA-331): /materiais/instrumentos/<chave> —
// a régua da aba Instrumentos virada em superfície única pra todos os
// papéis. O seletor do topo troca de instrumento sem sair da leitura; cada
// linha é uma dupla do escopo com o estado da estação e, onde o papel
// alcança, a resposta estruturada. Detalhe por tipo: os 4 instrumentos de
// formulário carregam a resposta sob demanda (RPC instrumentos_da_dupla —
// escopo da RPC decide quem lê); a avaliação de encontro mostra nota +
// comentário do embed das duplas (RLS recorta sozinha); os 360º leem o
// form oficial, coord-only (os outros papéis veem o estado, não o texto).

const ehChave360 = (chave: string) =>
  chave === "avaliacao_final_mentorado" || chave === "avaliacao_final_mentor";

const ORDEM_ESTADO: Record<EstacaoPainelEstado, number> = {
  respondido: 0,
  pendente: 1,
  expirado: 2,
  nao_enviado: 3,
  trancada: 4,
};

function BadgeEstado({ estado }: { estado: EstacaoPainelEstado }) {
  switch (estado) {
    case "respondido":
      return (
        <Badge className="bg-[var(--ok)]/15 text-[var(--ok-text)]">
          <Check size={11} weight="bold" data-icon="inline-start" aria-hidden />
          respondido
        </Badge>
      );
    case "pendente":
      return (
        <Badge className="bg-[var(--warn)]/15 text-[var(--warn-text)]">
          link enviado
        </Badge>
      );
    case "expirado":
      return <Badge variant="secondary">link expirado</Badge>;
    case "trancada":
      return (
        <Badge
          variant="outline"
          className="bg-muted text-xs font-medium text-muted-foreground"
        >
          <LockSimple size={11} data-icon="inline-start" aria-hidden />
          ainda não abriu
        </Badge>
      );
    default:
      return <Badge variant="secondary">não enviado</Badge>;
  }
}

/** Estado do lado específico do 360º (mentor ou mentorado) — a estação do
 *  painel filtra só "mentorado", o lado do mentor resolve aqui com a
 *  mesma ordem de regras de estacoesPainelDupla. */
function estado360(
  linha: PainelJornadaLinha,
  destino: "mentor" | "mentorado",
  encCorrDupla: number
): EstacaoPainelEstado {
  const entregas = (linha.entregas.avaliacao_360 ?? []).filter(
    (e) => e.destino === destino
  );
  if (entregas.some((e) => e.status === "respondido")) return "respondido";
  if (encCorrDupla < ESTACOES.avaliacao_360.encIni) return "trancada";
  if (entregas.some((e) => e.status === "pendente")) return "pendente";
  if (entregas.length) return "expirado";
  return "nao_enviado";
}

/** Mesma régua de estado da ficha (estadoAtual): respondido vence, depois
 *  pendente, expirado e "não enviado" — usada nas linhas do mentor, que
 *  não têm painel pra resolver janela (a ficha também não trava). */
function estadoDe(entregas: InstrumentoEntrega[]): EstacaoPainelEstado {
  if (entregas.some((e) => e.status === "respondido")) return "respondido";
  if (entregas.some((e) => e.status === "pendente")) return "pendente";
  if (entregas.length) return "expirado";
  return "nao_enviado";
}

type LinhaSpec = {
  duplaId: string;
  jovemNome: string;
  meta: string;
  estado: EstacaoPainelEstado;
  atrasada: boolean;
  /** a avaliação do encontro é recorrente — a linha mostra a contagem de
   *  encontros avaliados em vez do pill de estado dos outros instrumentos */
  contagem?: { feitas: number; realizados: number };
};

function LinhaDupla({ l, children }: { l: LinhaSpec; children?: React.ReactNode }) {
  return (
    <li className="px-4 py-3 sm:px-5">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">{l.jovemNome}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">{l.meta}</p>
        </div>
        {l.atrasada && (
          <Badge className="bg-[var(--warn)]/15 text-[var(--warn-text)]">
            <Warning size={11} weight="fill" data-icon="inline-start" aria-hidden />
            fora do prazo
          </Badge>
        )}
        {l.contagem ? (
          <Badge variant="secondary" className="tabular-nums">
            {l.contagem.feitas} de {l.contagem.realizados} avaliados
          </Badge>
        ) : (
          <BadgeEstado estado={l.estado} />
        )}
        <Link
          href={`/duplas/${l.duplaId}?aba=instrumentos#instrumentos`}
          className="inline-flex min-h-8 items-center rounded-md text-xs font-medium text-muted-foreground underline-offset-2 transition-colors hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          Ficha
        </Link>
      </div>
      {children}
    </li>
  );
}

/** As avaliações do encontro de uma dupla — nota + sentimento + avancei +
 *  temas + comentário por encontro realizado (o embed já chega recortado
 *  pela RLS: o mentor vê só o que a jovem liberou). */
function DetalheAvaliacoes({ dupla }: { dupla: Dupla }) {
  const realizados = (dupla.encontros ?? [])
    .filter((e) => e.status === "realizado")
    .sort((a, b) => a.numero - b.numero);
  if (!realizados.length) return null;
  return (
    <details className="group/av mt-1.5">
      <summary className="inline-flex min-h-8 cursor-pointer list-none items-center gap-1.5 rounded-md text-xs font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
        Ver avaliações
      </summary>
      <ul className="mt-2 divide-y divide-border/60 border-t border-border/60">
        {realizados.map((e) => {
          const av = e.avaliacao_jovem;
          return (
            <li key={e.id} className="py-2.5">
              <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                <p className="text-xs font-medium">
                  Encontro {e.numero}
                  {(e.realizado_em ?? e.data_hora) && (
                    <span className="font-normal text-muted-foreground">
                      {" · "}
                      {formatDate(e.realizado_em ?? e.data_hora)}
                    </span>
                  )}
                </p>
                {av ? (
                  <>
                    <span className="text-xs font-semibold tabular-nums" title={estrelasTexto(av.estrelas)}>
                      {av.estrelas}★
                    </span>
                    {av.pedir_apoio && (
                      <Badge className="bg-[var(--warn)]/15 text-[var(--warn-text)]">
                        pediu apoio
                      </Badge>
                    )}
                    {av.sentimento && (
                      <span className="text-xs text-muted-foreground">
                        {SENTIMENTO_AVALIACAO_LABEL[av.sentimento] ?? av.sentimento}
                      </span>
                    )}
                    {av.avancei && (
                      <span className="text-xs text-muted-foreground">
                        {AVANCEI_AVALIACAO_LABEL[av.avancei] ?? av.avancei}
                      </span>
                    )}
                  </>
                ) : (
                  <span className="text-xs text-muted-foreground">
                    sem avaliação
                  </span>
                )}
              </div>
              {av?.temas?.length ? (
                <p className="mt-1 text-xs text-muted-foreground">
                  {av.temas.map((t) => TEMA_AVALIACAO_LABEL[t] ?? t).join(" · ")}
                </p>
              ) : null}
              {av?.comentario && (
                <p className="mt-1 text-sm leading-relaxed whitespace-pre-wrap">
                  {av.comentario}
                </p>
              )}
            </li>
          );
        })}
      </ul>
    </details>
  );
}

/** Respostas do form 360º por dupla — leitura coord-only: o dl genérico
 *  de respostas-section (pergunta → resposta formatada). */
function Detalhe360({
  campos,
  respostas,
}: {
  campos: FormularioCampo[];
  respostas: Record<string, RespostaValor>;
}) {
  const ordem = new Map(campos.map((c, i) => [c.id, i]));
  const campoPorId = new Map(campos.map((c) => [c.id, c]));
  return (
    <dl className="mt-2 space-y-3 border-t border-border/60 pt-3">
      {Object.entries(respostas)
        .sort(
          ([a], [b]) =>
            (ordem.get(a) ?? Number.MAX_SAFE_INTEGER) -
            (ordem.get(b) ?? Number.MAX_SAFE_INTEGER)
        )
        .map(([campoId, valor]) => {
          const campo = campoPorId.get(campoId);
          return (
            <div key={campoId}>
              <dt className="text-xs font-medium text-muted-foreground">
                {campo?.label ?? "pergunta removida do formulário"}
              </dt>
              <dd className="mt-0.5 text-sm leading-relaxed whitespace-pre-wrap">
                {respostaFormatada(campo, valor)}
              </dd>
            </div>
          );
        })}
    </dl>
  );
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ chave: string }>;
}): Promise<Metadata> {
  const { chave } = await params;
  const card = CARDS.find((c) => c.chave === chave);
  return { title: card ? `${card.titulo} · Instrumentos` : "Instrumentos" };
}

export default async function InstrumentoPage({
  params,
}: {
  params: Promise<{ chave: string }>;
}) {
  const { chave } = await params;
  const card = CARDS.find((c) => c.chave === chave);
  if (!card) notFound();

  const me = await getMe();
  const ehCoord = temPapel(me, "coordenacao");
  const vePainel = me != null && (ehCoord || temPapel(me, "supervisor"));
  const ehMentorDpp = me != null && temPapel(me, "mentor_dpp");
  // a régua é de quem a vê em /materiais — fora desses papéis volta pra
  // página-mãe (especialista tem trilha própria, jovem tem a área dele)
  if (!vePainel && !ehMentorDpp) redirect("/materiais");

  const ehAvaliacaoEncontro = chave === "avaliacao_encontro";
  const eh360 = ehChave360(chave);
  const ehForm = !ehAvaliacaoEncontro && !eh360;
  const estacao = card.estacao;
  const sistema = estacao ? SISTEMA_DA_ESTACAO[estacao] : undefined;

  const [eventos, duplas, painel] = await Promise.all([
    getCicloEventos(),
    getDuplas(),
    vePainel ? getPainelInstrumentosJornada() : Promise.resolve([]),
  ]);
  const resolvidas = resolveLinhasPainel(painel, eventos);
  const duplaPorId = new Map(duplas.map((d) => [d.id, d]));

  // mentor DPP: as duplas DPP vivas dele (o RLS já recortou o getDuplas
  // pro escopo dele) — eager porque são poucas e o estado + resposta saem
  // da mesma RPC, sem lazy
  const duplasMentor = ehMentorDpp
    ? duplas.filter(
        (d) =>
          d.trilha !== "especialista" &&
          (d.status === "ativa" || d.status === "pausada")
      )
    : [];
  const instrumentosMentor = new Map(
    ehMentorDpp && ehForm && duplasMentor.length
      ? await Promise.all(
          duplasMentor.map(
            async (d) => [d.id, await getInstrumentosDaDupla(d.id)] as const
          )
        )
      : []
  );

  // 360º: o detalhe mora no form oficial — coord-only (o RLS das tabelas
  // de forms não deixa os outros papéis lerem resposta de terceiros)
  const formDetalhe =
    ehCoord && eh360 && card.sistemaForm
      ? await getFormularios()
          .then((fs) => {
            const f = fs.find((x) => x.sistema === card.sistemaForm);
            return f ? getFormulario(f.id) : null;
          })
          .catch(() => null)
      : null;
  const respostaPorDupla = new Map<
    string,
    { respostas: Record<string, RespostaValor>; respondidoEm: string | null }
  >();
  for (const l of formDetalhe?.links ?? []) {
    if (!l.dupla?.id || !l.resposta) continue;
    const ant = respostaPorDupla.get(l.dupla.id);
    if (
      !ant ||
      (l.resposta.respondido_em ?? "") > (ant.respondidoEm ?? "")
    ) {
      respostaPorDupla.set(l.dupla.id, {
        respostas: l.resposta.respostas,
        respondidoEm: l.resposta.respondido_em,
      });
    }
  }

  // linhas: staff vem do painel resolvido; o mentor monta das duplas dele
  const linhas: LinhaSpec[] = vePainel
    ? resolvidas.map((r) => {
        const estado = eh360
          ? estado360(
              r.linha,
              chave === "avaliacao_final_mentor" ? "mentor" : "mentorado",
              r.encCorrDupla
            )
          : estacao
            ? r.estados[estacao]
            : "nao_enviado";
        return {
          duplaId: r.linha.dupla_id,
          jovemNome: r.linha.jovem_nome,
          meta: [
            r.linha.turma ? turmaCurta(r.linha.turma) : null,
            `mentor ${r.linha.mentor_nome}`,
          ]
            .filter(Boolean)
            .join(" · "),
          estado,
          atrasada: estacao != null && r.atrasadas.has(estacao),
          contagem: ehAvaliacaoEncontro
            ? r.linha.avaliacoes_encontro
            : undefined,
        };
      })
    : duplasMentor.map((d) => {
        const nome = d.mentorado.nome_social || d.mentorado.nome;
        let estado: EstacaoPainelEstado = "nao_enviado";
        if (eh360) {
          estado = "nao_enviado"; // o estado do 360º não chega ao mentor
        } else if (ehForm) {
          const inst = (instrumentosMentor.get(d.id) ?? []).find(
            (i) => i.sistema === sistema
          );
          let entregas = (inst?.entregas ?? []).filter(
            (e) => e.destino === "mentorado"
          );
          if (sistema === "roda_vida") {
            entregas = entregasDoMomento(
              entregas,
              chave === "roda_inicial" ? "inicial" : "formal"
            );
          }
          estado = estadoDe(entregas);
        }
        return {
          duplaId: d.id,
          jovemNome: nome,
          meta: [d.turma ? turmaCurta(d.turma) : null, "sua dupla"]
            .filter(Boolean)
            .join(" · "),
          estado,
          atrasada: false,
          contagem: ehAvaliacaoEncontro
            ? {
                feitas: (d.encontros ?? []).filter(
                  (e) => e.status === "realizado" && e.avaliacao_jovem
                ).length,
                realizados: (d.encontros ?? []).filter(
                  (e) => e.status === "realizado"
                ).length,
              }
            : undefined,
        };
      });
  linhas.sort(
    (a, b) =>
      ORDEM_ESTADO[a.estado] - ORDEM_ESTADO[b.estado] ||
      a.jovemNome.localeCompare(b.jovemNome, "pt-BR")
  );

  return (
    <div className="space-y-5">
      <Link
        href="/materiais?aba=instrumentos"
        className="inline-flex min-h-8 items-center gap-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <CaretLeft size={13} aria-hidden />
        Instrumentos
      </Link>

      <PageHeader
        title={card.titulo}
        meta={
          <span className="mt-1.5 flex flex-wrap items-center gap-1.5">
            {card.chips.map((c) => (
              <span
                key={c}
                className="rounded-md bg-muted px-1.5 py-0.5 text-xs font-medium text-muted-foreground"
              >
                {c}
              </span>
            ))}
            <span>{card.descricao}</span>
          </span>
        }
      />

      {/* o seletor é a troca sem fricção do pedido: manter a leitura por
          instrumento e saltar entre eles sem voltar pra régua */}
      <nav aria-label="Trocar de instrumento" className="-mx-1 overflow-x-auto">
        <ul className="scroll-fina flex items-center gap-1 px-1 pb-1">
          {CARDS.map((c) => (
            <li key={c.chave} className="shrink-0">
              <Link
                href={`/materiais/instrumentos/${c.chave}`}
                aria-current={c.chave === chave ? "page" : undefined}
                className={cn(
                  "inline-flex min-h-9 items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  c.chave === chave
                    ? "bg-foreground text-background"
                    : "bg-muted text-muted-foreground hover:text-foreground"
                )}
              >
                <InstrumentoEmblema instrumento={c.chave} size={20} />
                {c.titulo}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      <section
        aria-label={`Duplas — ${card.titulo}`}
        className="overflow-hidden rounded-xl bg-card shadow-[var(--shadow-border)]"
        style={instrumentoVars(card.chave)}
      >
        {linhas.length === 0 ? (
          <p className="px-4 py-6 text-sm text-muted-foreground sm:px-5">
            Nenhuma dupla no seu escopo pra este instrumento.
          </p>
        ) : (
          <ul className="divide-y divide-border/60">
            {linhas.map((l) => {
              // o conteúdo da linha por tipo de instrumento — o estado já
              // tá na linha; aqui mora só o detalhe sob demanda
              let detalhe: React.ReactNode = null;
              if (ehAvaliacaoEncontro) {
                const dupla = duplaPorId.get(l.duplaId);
                if (dupla) detalhe = <DetalheAvaliacoes dupla={dupla} />;
              } else if (eh360) {
                const resp = respostaPorDupla.get(l.duplaId);
                if (resp && formDetalhe) {
                  detalhe = (
                    <details className="group/av mt-1.5">
                      <summary className="inline-flex min-h-8 cursor-pointer list-none items-center gap-1.5 rounded-md text-xs font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
                        Ver respostas
                      </summary>
                      <Detalhe360
                        campos={formDetalhe.formulario.campos}
                        respostas={resp.respostas}
                      />
                    </details>
                  );
                }
              } else if (ehForm) {
                if (vePainel) {
                  // staff: a resposta carrega sob demanda — a RPC por
                  // dupla não roda pra coorte inteira de uma vez
                  if (l.estado === "respondido") {
                    detalhe = (
                      <DetalheInstrumentoLazy
                        duplaId={l.duplaId}
                        chave={chave}
                        jovemNome={l.jovemNome}
                      />
                    );
                  }
                } else {
                  // mentor: já veio eager no carregamento da página
                  const inst = (instrumentosMentor.get(l.duplaId) ?? []).find(
                    (i) => i.sistema === sistema
                  );
                  let entregas = (inst?.entregas ?? []).filter(
                    (e) => e.destino === "mentorado" && e.status === "respondido" && e.respostas
                  );
                  if (sistema === "roda_vida") {
                    entregas = entregasDoMomento(
                      entregas,
                      chave === "roda_inicial" ? "inicial" : "formal"
                    );
                  }
                  const ultima = [...entregas].sort((a, b) =>
                    (b.respondido_em ?? "").localeCompare(a.respondido_em ?? "")
                  )[0];
                  if (inst && ultima?.respostas) {
                    detalhe = (
                      <details className="group/av mt-1.5">
                        <summary className="inline-flex min-h-8 cursor-pointer list-none items-center gap-1.5 rounded-md text-xs font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
                          Ver respostas
                        </summary>
                        <div className="mt-2 border-t border-border/60 pt-3">
                          <InstrumentoResultado
                            sistema={inst.sistema}
                            campos={inst.campos}
                            respostas={ultima.respostas}
                          />
                        </div>
                      </details>
                    );
                  }
                }
              }
              return (
                <LinhaDupla key={l.duplaId} l={l}>
                  {detalhe}
                </LinhaDupla>
              );
            })}
          </ul>
        )}
      </section>

      {eh360 && !ehCoord && (
        <p className="text-xs text-muted-foreground">
          As respostas dos 360º são leitura da coordenação — o que chega pra
          você é o estado de cada dupla.
        </p>
      )}
    </div>
  );
}
