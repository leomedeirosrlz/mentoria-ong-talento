import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  BookOpen,
  CaretLeft,
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
  estadoDeEntregas,
  resolveLinhasPainel,
  SISTEMA_DA_ESTACAO,
  entregasDoMomento,
  parRoda,
  type EstacaoPainelEstado,
  type PainelJornadaLinha,
} from "@/lib/jornada";
import {
  avaliacaoCobreNumero,
  AVANCEI_AVALIACAO_LABEL,
  formatDate,
  SENTIMENTO_AVALIACAO_LABEL,
  TEMA_AVALIACAO_LABEL,
  estrelasTexto,
} from "@/lib/ciclo";
import {
  extraiMetas,
  extraiRodaDaVida,
  INSTRUMENTOS_DUPLA_SISTEMA,
  respostaFormatada,
  type FormularioCampo,
  type InstrumentoDuplaSistema,
  type RespostaValor,
} from "@/lib/forms/schema";
import { docDoSistema } from "@/lib/como-conduzir";
import {
  carregarDocCorpus,
  normTitulo,
  type CorpusSecao,
} from "@/lib/materiais/corpus-doc";
import { DocBlocos } from "@/components/material-documento";
import type { InstrumentoDupla } from "@/lib/forms/queries";
import { turmaCurta } from "@/lib/turma";
import {
  InstrumentoEmblema,
  instrumentoVars,
} from "@/components/instrumento-icone";
import { InstrumentoResultado } from "@/components/instrumento-resultado";
import { BadgeEstado } from "@/components/instrumento-estado";
import { FadeX } from "@/components/fade-x";
import { RespostaLista } from "@/components/resposta-lista";
import { RespostaToggle } from "@/components/resposta-toggle";
import { MentoradoSeletor } from "@/components/mentorado-seletor";
import { RodaSvg } from "@/components/instrumentos/roda-svg";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
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

/** Resumo visual da última resposta da dupla — a linha já conta o
 *  resultado antes do "Ver resposta" (REALIZA-440): a mini-roda com
 *  média pra roda (fantasma da inicial na formal), a declaração pra
 *  visão, a contagem pra metas/PDM. */
function ResumoResposta({
  sistema,
  campos,
  respostas,
  respostasAnterior = null,
}: {
  sistema: InstrumentoDuplaSistema;
  campos: FormularioCampo[];
  respostas: Record<string, RespostaValor>;
  respostasAnterior?: Record<string, RespostaValor> | null;
}) {
  if (sistema === "roda_vida") {
    const roda = extraiRodaDaVida(campos, respostas);
    if (!roda) return null;
    const anterior = respostasAnterior
      ? extraiRodaDaVida(campos, respostasAnterior)
      : null;
    return (
      <div className="@container flex items-center gap-3">
        {/* mini-roda no estreito; em linha larga a moldura cresce e
            ganha a coroa de nomes dos eixos (010 — altura de leitura) */}
        <RodaSvg
          roda={roda}
          anterior={anterior}
          className="size-24 shrink-0 @[34rem]:hidden"
        />
        <RodaSvg
          roda={roda}
          anterior={anterior}
          rotuloEixos
          className="hidden w-full max-w-[340px] shrink-0 @[34rem]:block"
        />
        <p className="text-sm leading-snug">
          Média geral{" "}
          <strong className="tabular-nums">
            {roda.media?.toLocaleString("pt-BR") ?? "—"}
          </strong>
          /10
          <span className="mt-0.5 block text-xs text-muted-foreground">
            {roda.respondidas} de {roda.total} áreas respondidas
          </span>
        </p>
      </div>
    );
  }
  if (sistema === "visao") {
    const declaracao = respostaFormatada(
      campos.find((c) => c.id === "declaracao_visao"),
      respostas["declaracao_visao"]
    );
    if (!declaracao.trim() || declaracao === "—") return null;
    return (
      <blockquote className="border-l-2 border-[var(--ic,var(--border))] pl-2.5">
        <p className="line-clamp-2 text-sm leading-snug">“{declaracao}”</p>
      </blockquote>
    );
  }
  if (sistema === "metas" || sistema === "pdm") {
    const metas = extraiMetas(campos, respostas);
    if (!metas.length) return null;
    return (
      <p className="text-sm leading-snug">
        <strong className="tabular-nums">{metas.length}</strong>{" "}
        {metas.length === 1 ? "meta definida" : "metas definidas"}
        <span className="mt-0.5 line-clamp-1 block text-xs text-muted-foreground">
          {metas[0]!.meta}
        </span>
      </p>
    );
  }
  return null;
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
          prefetch={false}
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
    <RespostaToggle
      rotulo="Ver avaliações"
      rotuloAberto="Fechar avaliações"
      className="mt-1.5"
    >
      <ul className="mt-2 divide-y divide-border/60 border-t border-border/60">
        {realizados.map((e) => {
          // sessão combinada (018/0228): a avaliação do jovem é uma por
          // sessão, na âncora — `cobertura` dela traz todos os números, e
          // o coberto mostra a da sessão
          const av =
            e.avaliacao_jovem ??
            realizados.find((x) =>
              avaliacaoCobreNumero(x.avaliacao_jovem, e)
            )?.avaliacao_jovem ??
            null;
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
    </RespostaToggle>
  );
}

/** Respostas do form 360º por dupla — leitura coord-only: a lista
 *  pergunta → resposta compartilhada (mesma do acordeão de /formularios). */
function Detalhe360({
  campos,
  respostas,
}: {
  campos: FormularioCampo[];
  respostas: Record<string, RespostaValor>;
}) {
  return (
    <RespostaLista
      campos={campos}
      respostas={respostas}
      className="mt-2 border-t border-border/60 pt-3"
    />
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
  searchParams,
}: {
  params: Promise<{ chave: string }>;
  searchParams: Promise<{ dupla?: string }>;
}) {
  const [{ chave }, { dupla: duplaParam }] = await Promise.all([
    params,
    searchParams,
  ]);
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
  // ponte instrumento → doc (REALIZA-386): os 4 de jornada têm guia nativo
  const docGuia =
    sistema && (INSTRUMENTOS_DUPLA_SISTEMA as readonly string[]).includes(sistema)
      ? docDoSistema(sistema as InstrumentoDuplaSistema)
      : null;

  // síntese do instrumento (REALIZA-414): "O que é" + a seção de jornada
  // do guia nativo — pra que serve, quem responde e quando entra — com o
  // link pro doc completo. Os docs seguem o mesmo gabarito de seções.
  const docCorpus = docGuia ? await carregarDocCorpus(docGuia) : null;
  const secoesSintese = docCorpus
    ? [/\bo que e\b/, /jornada|aplicacoes|encontros/]
        .map((re) =>
          docCorpus.secoes.find(
            (s) => s.nivel === 2 && re.test(normTitulo(s.titulo))
          )
        )
        .filter((s): s is CorpusSecao => s != null)
    : [];

  // tudo sobe numa leva só: o filtro "duplas DPP vivas do mentor" repete a
  // expressão das linhas pra destravar a RPC por dupla (definer — uma por
  // dupla, em paralelo, sem esperar o resto); o detalhe do 360º encadeia
  // getFormularios→getFormulario (React.cache deduplica o getDuplas)
  const duplasPromise = getDuplas();
  const [eventos, duplas, painel, instrumentosMentorPares, formDetalhe] =
    await Promise.all([
      getCicloEventos(),
      duplasPromise,
      vePainel ? getPainelInstrumentosJornada() : Promise.resolve([]),
      ehMentorDpp && ehForm
        ? duplasPromise.then((ds) =>
            Promise.all(
              ds
                .filter(
                  (d) =>
                    d.trilha !== "especialista" &&
                    (d.status === "ativa" || d.status === "pausada")
                )
                .map(
                  async (d) =>
                    [d.id, await getInstrumentosDaDupla(d.id)] as const
                )
            )
          )
        : Promise.resolve([] as (readonly [string, InstrumentoDupla[]])[]),
      // 360º: o detalhe mora no form oficial — coord-only (o RLS das
      // tabelas de forms não deixa os outros papéis lerem resposta de
      // terceiros)
      ehCoord && eh360 && card.sistemaForm
        ? getFormularios()
            .then((fs) => {
              const f = fs.find((x) => x.sistema === card.sistemaForm);
              return f ? getFormulario(f.id) : null;
            })
            .catch(() => null)
        : Promise.resolve(null),
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
  const instrumentosMentor = new Map(instrumentosMentorPares);

  // mentorado em foco (?dupla=<id>) — a régua linka a dupla escolhida e
  // a página filtra as linhas; param inválido ou fora do escopo cai no
  // "Todas". Só vale pro mentor: staff não tem seletor aqui (o filtro de
  // coorte é a busca da ficha)
  const selecionada =
    duplaParam != null && duplasMentor.some((d) => d.id === duplaParam)
      ? duplaParam
      : null;
  const fichasSeletor = duplasMentor.map((d) => ({
    id: d.id,
    jovemNome: d.mentorado.nome_social || d.mentorado.nome,
    pausada: d.status === "pausada",
  }));
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
          estado = estadoDeEntregas(entregas);
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
                // sessão combinada (0228): a avaliação mora na âncora e a
                // `cobertura` dela cobre todos os números da sessão
                feitas: (d.encontros ?? []).filter(
                  (e) =>
                    e.status === "realizado" &&
                    (d.encontros ?? []).some((x) =>
                      avaliacaoCobreNumero(x.avaliacao_jovem, e)
                    )
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
  const linhasVisiveis =
    !vePainel && selecionada
      ? linhas.filter((l) => l.duplaId === selecionada)
      : linhas;

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
      <FadeX
        tag="nav"
        aria-label="Trocar de instrumento"
        className="-mx-1 overflow-x-auto overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        <ul className="flex items-center gap-1 px-1 pb-1">
          {CARDS.map((c) => (
            <li key={c.chave} className="shrink-0">
              <Link
                href={`/materiais/instrumentos/${c.chave}${
                  selecionada ? `?dupla=${selecionada}` : ""
                }`}
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
      </FadeX>

      {/* sinopse do instrumento (010): até 3 parágrafos curtos — 2 do
          "O que é" + 1 do "quando na jornada" — e o CTA do guia em
          ação de primeira leitura, não um link perdido no cabeçalho */}
      {secoesSintese.length > 0 && docGuia && (
        <section
          aria-label="Sobre o instrumento"
          className="rounded-xl bg-card px-4 py-4 shadow-[var(--shadow-border)] sm:px-5"
          style={instrumentoVars(card.chave)}
        >
          {secoesSintese.map((s, i) => {
            // só parágrafos — listas e callouts ficam pro guia completo;
            // a 1ª seção rende 2 parágrafos, a 2ª um (teto de 3 no todo)
            const blocos = s.blocos
              .filter((b) => b.kind === "par")
              .slice(0, i === 0 ? 2 : 1);
            if (!blocos.length) return null;
            return (
              <div key={s.anchor} className={i > 0 ? "mt-4" : undefined}>
                <h2 className="text-sm font-semibold">
                  {s.titulo.split("·").pop()!.trim()}
                </h2>
                <div className="mt-2 space-y-3">
                  <DocBlocos blocos={blocos} />
                </div>
              </div>
            );
          })}
          <Link
            href={`/materiais/documento/${docGuia}`}
            prefetch={false}
            className={cn(
              buttonVariants({ variant: "outline", size: "sm" }),
              "mt-4"
            )}
          >
            <BookOpen size={15} aria-hidden />
            Ler o guia completo
          </Link>
        </section>
      )}

      {/* o nome do mentorado vira o controle (REALIZA-440): pills até 3
          duplas, dropdown acima; "Todas" devolve a lista inteira. A
          escolha chega por ?dupla= da régua e sobrevive à troca de
          instrumento (os pills do topo carregam o param) */}
      {!vePainel && (
        <MentoradoSeletor
          fichas={fichasSeletor}
          selecionada={selecionada}
          hrefBase={`/materiais/instrumentos/${chave}`}
          comTodas
        />
      )}

      <section
        aria-label={`Duplas: ${card.titulo}`}
        className="overflow-hidden rounded-xl bg-card shadow-[var(--shadow-border)]"
        style={instrumentoVars(card.chave)}
      >
        {linhasVisiveis.length === 0 ? (
          <p className="px-4 py-6 text-sm text-muted-foreground sm:px-5">
            Nenhuma dupla no seu escopo pra este instrumento.
          </p>
        ) : (
          <ul className="divide-y divide-border/60">
            {linhasVisiveis.map((l) => {
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
                    <RespostaToggle className="mt-1.5">
                      <Detalhe360
                        campos={formDetalhe.formulario.campos}
                        respostas={resp.respostas}
                      />
                    </RespostaToggle>
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
                  // mentor: já veio eager no carregamento da página — a
                  // linha resume o resultado e o "Ver resposta" abre o
                  // estruturado completo (REALIZA-440/441)
                  const inst = (instrumentosMentor.get(l.duplaId) ?? []).find(
                    (i) => i.sistema === sistema
                  );
                  const mentoradoEntregas = (inst?.entregas ?? []).filter(
                    (e) => e.destino === "mentorado" && e.status === "respondido" && e.respostas
                  );
                  const entregas =
                    sistema === "roda_vida"
                      ? entregasDoMomento(
                          mentoradoEntregas,
                          chave === "roda_inicial" ? "inicial" : "formal"
                        )
                      : mentoradoEntregas;
                  const ultima = [...entregas].sort((a, b) =>
                    (b.respondido_em ?? "").localeCompare(a.respondido_em ?? "")
                  )[0];
                  // roda formal carrega o antes×depois que a ficha já
                  // mostra (o ghost da mini-roda e a RodaComparada)
                  const anterior =
                    sistema === "roda_vida" && chave === "roda_formal"
                      ? (parRoda(mentoradoEntregas).inicial?.respostas ?? null)
                      : null;
                  if (inst && ultima?.respostas) {
                    detalhe = (
                      <div className="mt-2.5">
                        <ResumoResposta
                          sistema={inst.sistema}
                          campos={inst.campos}
                          respostas={ultima.respostas}
                          respostasAnterior={anterior}
                        />
                        <RespostaToggle className="mt-1.5">
                          <div className="mt-2 border-t border-border/60 pt-3">
                            <InstrumentoResultado
                              sistema={inst.sistema}
                              campos={inst.campos}
                              respostas={ultima.respostas}
                              respostasAnterior={anterior}
                            />
                          </div>
                        </RespostaToggle>
                      </div>
                    );
                  } else if (inst?.sistema === "roda_vida") {
                    // FR-003: instrumento enviado e ainda sem resposta —
                    // o mentor lê a moldura vazia (eixos + pontos mudos)
                    // em vez de uma linha que parece vazia por acidente
                    const rodaVazia = extraiRodaDaVida(inst.campos, {});
                    if (rodaVazia) {
                      detalhe = (
                        <div className="@container mt-2.5 flex items-center gap-3">
                          <RodaSvg
                            roda={rodaVazia}
                            className="size-24 shrink-0 @[34rem]:hidden"
                          />
                          <RodaSvg
                            roda={rodaVazia}
                            rotuloEixos
                            className="hidden w-full max-w-[340px] shrink-0 @[34rem]:block"
                          />
                          <p className="text-sm leading-snug text-muted-foreground">
                            <strong className="font-medium text-foreground">
                              Ainda sem resposta.
                            </strong>{" "}
                            A moldura mostra os eixos que a nota preenche.
                          </p>
                        </div>
                      );
                    }
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
          As respostas dos 360º são leitura da coordenação. O que chega pra
          você é o estado de cada dupla.
        </p>
      )}
    </div>
  );
}
