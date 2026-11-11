import type { Metadata } from "next";
import type { CSSProperties } from "react";
import Link from "next/link";
import {
  ArrowSquareOut,
  BookOpen,
  CaretDown,
  CaretRight,
  CheckCircle,
  File,
  FileText,
  Flag,
  FolderOpen,
  LinkSimple,
  LockSimple,
  MapPin,
  PuzzlePiece,
  UsersThree,
} from "@phosphor-icons/react/dist/ssr";
import {
  AvaliarPendenteButton,
  type AvaliacaoFeita,
  type AvaliacaoPendente,
} from "@/components/jovem-avaliacoes";
import { AvaliacoesHistoricoDialog } from "@/components/jovem-avaliacoes-historico";
import {
  InstrumentoIcone,
  instrumentoVars,
} from "@/components/instrumento-icone";
import { JornadaRascunho } from "@/components/jornada-rascunho";
import { ReverRespostaDialog } from "@/components/jornada-rever";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { formatDate, linkSeguro, TRILHA_LEN } from "@/lib/ciclo";
import { turmaLonga } from "@/lib/turma";
import { formularioPorToken } from "@/lib/forms/queries";
import {
  datasOficiaisDe,
  encCorrenteDe,
  estacoesJornada,
  materialLiberadoParaJovem,
  parRoda,
  resumoJornada,
  SISTEMA_DA_ESTACAO,
  type Estacao,
  type EstacaoChave,
  type EventoJornada,
} from "@/lib/jornada";
import type {
  FormularioCampo,
  FormularioSistema,
  RespostaValor,
} from "@/lib/forms/schema";
import { getMateriais, getMe } from "@/lib/queries";
import { getJovemAvaliacoes } from "@/lib/queries-avaliacao";
import {
  getJovemDuplas,
  getJovemEncaminhamentos,
  getJovemEncontros,
  getJovemJornada,
} from "@/lib/queries-jovem";
import { getPdmResumo } from "@/lib/queries-pdm";
import { dadosRetrospectivaJovem } from "@/lib/retrospectiva";
import { RetrospectivaJornada } from "@/components/retrospectiva-jornada";
import { getConsolidadoTerceirosJovem } from "@/lib/terceiros/queries";
import { MaterialMenu } from "@/components/material-actions";
import { PreviewLink } from "@/components/material-preview-pdf";
import { MaterialThumb } from "@/components/material-thumb";
import type { Material, Trilha } from "@/lib/types";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Minha jornada" };

// WP7 (REALIZA-140) + REALIZA-194 (spec v5c): /jovem/materiais é o hub
// "Minha jornada" — os 7 instrumentos oficiais da régua do guia viram a
// estante de cards-produto (capa símbolo + janela + estado honesto, o
// card inteiro = gesto), e a
// biblioteca de sempre continua embaixo como "Acervo". As datas saem do
// cronograma da turma DELA (RPC jovem_jornada, 0096) — T1 e T2 veem janelas
// diferentes pro mesmo encontro. Fallback decidido no plano: RPC fora,
// sem dupla ou cronograma vazio → a biblioteca plana renderiza intacta.

const TIPO_ICONE = {
  guia: BookOpen,
  template: FileText,
  conteudo: PuzzlePiece,
  link: LinkSimple,
} as const;

const TIPO_LABEL = {
  guia: "guia",
  template: "modelo",
  conteudo: "conteúdo",
  link: "link",
} as const;

const GRUPO_TIPO = {
  guia: "Guias",
  template: "Modelos",
  conteudo: "Conteúdos",
  link: "Links",
} as const;

// estação → sistema do instrumento: SISTEMA_DA_ESTACAO canônico
// (jornada.ts, 0080/0096) — avaliacao_encontro vive no fluxo próprio
// (0071) e o 360º chega por `jornada.avaliacao_360`: os dois não têm
// item em `instrumentos`.

function agrupar(materiais: Material[]): [string, Material[]][] {
  const mapa = new Map<string, Material[]>();
  for (const m of materiais) {
    const rotulo =
      m.encontro_num != null ? `Encontro ${m.encontro_num}` : GRUPO_TIPO[m.tipo];
    mapa.set(rotulo, [...(mapa.get(rotulo) ?? []), m]);
  }
  const peso = (r: string) =>
    r === "Guias"
      ? -1
      : r.startsWith("Encontro")
        ? Number(r.split(" ")[1])
        : r === "Modelos"
          ? 100
          : r === "Conteúdos"
            ? 101
            : 102;
  return [...mapa.entries()].sort(([a], [b]) => peso(a) - peso(b));
}

/** "4 de nov." — compacto pro summary do <details> das estações futuras. */
function diaMesCurto(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = /^\d{4}-\d{2}-\d{2}$/.test(iso)
    ? new Date(`${iso}T12:00:00`)
    : new Date(iso);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString("pt-BR", {
    day: "numeric",
    month: "short",
    timeZone: "America/Sao_Paulo",
  });
}

export default async function JovemMateriais() {
  const [me, jornada, encontros, avaliacoes, duplas, materiais, consolidadoTerc] =
    await Promise.all([
      getMe(),
      // a RPC fora do ar devolve a página ao formato anterior — nunca quebra
      getJovemJornada().catch(() => null),
      getJovemEncontros(),
      getJovemAvaliacoes(),
      getJovemDuplas(),
      getMateriais(),
      // o consolidado de terceiros publicado — cache()ada, a home já chama
      getConsolidadoTerceirosJovem().catch(() => null),
    ]);
  if (!me) return null; // o layout já barra — convenção das páginas

  // Régua do acervo progressivo (REALIZA-160): fallback pra quando a RPC
  // da jornada falha — a posição da dupla DPP viva derivada dos encontros.
  // Com a RPC no ar a régua sai de `jornada.dupla_id` (mesma dupla que a
  // trilha mostra, uma âncora só). Sem DPP viva não há cronograma pra
  // esperar → null = acervo todo livre.
  const duplaDppViva =
    duplas.find(
      (d) =>
        d.id != null &&
        (d.trilha ?? "dpp") !== "especialista" &&
        (d.status === "ativa" || d.status === "pausada")
    ) ?? null;
  const encAcervo = duplaDppViva
    ? encCorrenteDe(encontros.filter((e) => e.dupla_id === duplaDppViva.id), {
        // a rede de segurança da data oficial (0123) só se aplica quando o
        // cronograma da RPC é DESTA dupla — a régua nunca empresta data de
        // cronograma alheio
        datasOficiais:
          jornada?.dupla_id === duplaDppViva.id
            ? datasOficiaisDe(jornada.cronograma)
            : undefined,
        ativa: duplaDppViva.status === "ativa",
        inicio: duplaDppViva.iniciada_em,
      })
    : null;

  // Fallbacks do plano §WP7: sem jornada (RPC null/erro), sem dupla ou sem
  // cronograma → biblioteca plana, exatamente como a página sempre foi.
  const dupla =
    jornada != null
      ? (duplas.find((d) => d.id === jornada.dupla_id) ?? null)
      : null;
  if (!jornada || !dupla || !(jornada.cronograma?.length ?? 0)) {
    return (
      <BibliotecaJovem materiais={materiais} encCorrente={encAcervo} />
    );
  }

  const encontrosDpp = encontros.filter((e) => e.dupla_id === jornada.dupla_id);
  const avaliacoesDpp = avaliacoes.filter(
    (a) => a.dupla_id === jornada.dupla_id
  );

  let estacoes: Estacao[];
  try {
    estacoes = estacoesJornada({
      cronograma: jornada.cronograma,
      instrumentos: jornada.instrumentos ?? [],
      avaliacao360: jornada.avaliacao_360 ?? [],
      encontros: encontrosDpp.map((e) => ({
        id: e.id,
        numero: e.numero,
        status: e.status,
        data: e.realizado_em ?? e.data_hora,
      })),
      avaliacoesFeitas: avaliacoesDpp.map((a) => a.encontro_id),
      ativa: dupla.status === "ativa",
      inicio: dupla.iniciada_em,
    });
  } catch {
    estacoes = [];
  }
  if (!estacoes.length)
    return (
      <BibliotecaJovem materiais={materiais} encCorrente={encAcervo} />
    );

  // "encontro corrente" — a âncora compartilhada (lib): o maior nº de
  // encontro realizado + 1, teto 16, com a rede de segurança da data
  // oficial (0123) — o calendário da turma destrava a régua quando o
  // registro do mentor atrasa mais de uma semana
  const encontroCorrente = encCorrenteDe(encontrosDpp, {
    datasOficiais: datasOficiaisDe(jornada.cronograma),
    ativa: dupla.status === "ativa",
    inicio: dupla.iniciada_em,
  });

  const passosGuia = jornada.cronograma
    .filter(
      (e): e is EventoJornada & { numero: number } =>
        e.tipo === "encontro" && e.numero != null
    )
    .sort((a, b) => a.numero - b.numero);
  // numero → data oficial da turma dela, pro "libera em dd/mm" do acervo
  const dataPorNumero = new Map(
    passosGuia
      .filter((e) => e.data != null)
      .map((e) => [e.numero, e.data!])
  );
  // a fase REAL do hero vem do passo corrente — a mais próxima pra trás se o
  // cronograma não cobre o nº exato (turma encurtada)
  const eventoCorrente =
    passosGuia.find((e) => e.numero === encontroCorrente) ??
    passosGuia.filter((e) => e.numero < encontroCorrente).at(-1) ??
    passosGuia[0] ??
    null;
  const fase = eventoCorrente?.fase ?? null;
  const eventoFim =
    passosGuia.find((e) => e.numero === 16) ?? passosGuia.at(-1) ?? null;

  const resumo = resumoJornada(estacoes);
  const progresso = resumo.total > 0 ? (resumo.feitas / resumo.total) * 100 : 0;

  // estação "avaliação do encontro": o fluxo real é o da home — pendente é
  // o realizado mais antigo sem a estrela dela; o "rever" abre a última.
  const avaliados = new Set(avaliacoesDpp.map((a) => a.encontro_id));
  const maisAntigoSemAvaliacao = encontrosDpp
    .filter((e) => e.status === "realizado" && !avaliados.has(e.id))
    .sort((a, b) => a.numero - b.numero)[0];
  const pendenteAvaliacao: AvaliacaoPendente | null = maisAntigoSemAvaliacao
    ? {
        encontroId: maisAntigoSemAvaliacao.id,
        numero: maisAntigoSemAvaliacao.numero,
        realizado_em: maisAntigoSemAvaliacao.realizado_em,
        trilha: "dpp",
      }
    : null;
  // o histórico da recorrente alimenta o dialog "Suas avaliações" —
  // pendente ou não, os registros ficam a um toque de distância
  const feitasDpp: AvaliacaoFeita[] = avaliacoesDpp.map((a) => ({
    ...a,
    trilha: "dpp",
  }));
  const primeiroNome = (me.nome_social || me.nome).split(" ")[0];

  const camposPorSistema = new Map<string, FormularioCampo[]>();
  for (const inst of jornada.instrumentos ?? []) {
    camposPorSistema.set(
      inst.sistema,
      (inst.campos as FormularioCampo[] | null) ?? []
    );
  }

  // 360º respondida: o payload da RPC não carrega os campos do form — a
  // leitura "Rever resposta" busca pelo próprio link dela (token de posse,
  // gate 0070) pra rotular pergunta a pergunta.
  const tem360Feita = estacoes.some(
    (e) => e.chave === "avaliacao_360" && e.estado === "feito" && e.respostas
  );
  let campos360: FormularioCampo[] = [];
  if (tem360Feita) {
    const respondida = (jornada.avaliacao_360 ?? [])
      .filter((e) => e.status === "respondido" && e.token)
      .at(-1);
    if (respondida?.token) {
      const r = await formularioPorToken(respondida.token).catch(() => null);
      if (r?.kind === "ok" && r.info.formulario) {
        campos360 = r.info.formulario.campos;
      }
    }
  }

  /** Props da ação de cada estação — o mesmo recorte por chave que o mapa
   *  antigo fazia inline (360º lê os campos pelo token; os 4 instrumentos
   *  pelos campos do sistema). A recorrente saiu da estante: ela vive no
   *  banner de pendência e no histórico, não como produto de entrega
   *  única. */
  // REALIZA-18 — o par inicial × formal das entregas dela: o Rever da
  // estação roda_formal vira o antes × depois (o ghost da leitura inicial
  // por baixo do polígono, como na ficha)
  const rodaPar = parRoda(
    (jornada.instrumentos ?? []).find((i) => i.sistema === "roda_vida")
      ?.entregas ?? []
  );

  const propsEstacao = (chave: EstacaoChave) => ({
    sistema:
      chave === "avaliacao_360"
        ? ("avaliacao_final_mentorado" as FormularioSistema)
        : (SISTEMA_DA_ESTACAO[chave] ?? null),
    campos:
      chave === "avaliacao_360"
        ? campos360
        : (camposPorSistema.get(SISTEMA_DA_ESTACAO[chave] ?? "") ?? []),
    respostasAnterior:
      chave === "roda_formal"
        ? ((rodaPar.inicial?.respostas ?? null) as Record<
            string,
            RespostaValor
          > | null)
        : null,
  });

  // ---------- retrospectiva (REALIZA-359) ----------
  // destravada pela RPC (16º realizado ou dupla fechada); as fontes são as
  // que já são dela — a timeline do payload, os encontros/combinados das
  // views dela e o PDM (a RPC dele também escopa por papel). O checklist
  // do mentor nem chega no payload — a autoavaliação é recorte de staff.
  const retroAberto = jornada.retrospectiva?.desbloqueada === true;
  const [combinadosJovem, pdmResumo] = retroAberto
    ? await Promise.all([
        getJovemEncaminhamentos(),
        getPdmResumo(jornada.dupla_id).catch(() => null),
      ])
    : [null, null];
  const retroJovem = retroAberto
    ? dadosRetrospectivaJovem({
        dupla: {
          trilha: (dupla.trilha ?? "dpp") as Trilha,
          status: dupla.status!,
          iniciada_em: dupla.iniciada_em,
          encerrada_em: dupla.encerrada_em,
          mentorNome:
            dupla.mentor_nome_social ?? dupla.mentor_nome ?? "Seu mentor",
        },
        mentoradoNome: me.nome_social || me.nome,
        cronograma: jornada.cronograma,
        encontros: encontrosDpp,
        temas: jornada.retrospectiva?.encontros ?? [],
        combinados: (combinadosJovem ?? []).filter(
          (c) => c.dupla_id === jornada.dupla_id
        ),
        instrumentos: (jornada.instrumentos ?? []).map((i) => ({
          sistema: i.sistema,
          campos: (i.campos as FormularioCampo[] | null) ?? [],
          entregas: i.entregas,
        })),
        pdm: pdmResumo,
        desbloqueada: true,
      })
    : null;

  return (
    <div className="space-y-6">
      {/* ---------- hero slim (anti-extensão mobile): um card só ---------- */}
      <Card className="animate-enter">
        <CardContent className="space-y-4 pt-5">
          <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
            <div className="min-w-0">
              <h1 className="text-2xl font-semibold tracking-tight">
                Minha jornada
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                {dupla.turma ? `${turmaLonga(dupla.turma)} · ` : ""}
                encontro {encontroCorrente} de {TRILHA_LEN.dpp}
              </p>
              {fase && (
                <p className="mt-1.5">
                  <Badge variant="secondary" className="font-medium">
                    Fase · {fase}
                  </Badge>
                </p>
              )}
            </div>
            <div className="text-right">
              <p className="text-3xl font-bold leading-none tabular-nums">
                {resumo.feitas}
                <span className="text-lg font-semibold text-muted-foreground">
                  /{resumo.total}
                </span>
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                entregas feitas
              </p>
            </div>
          </div>
          <div
            className="h-2.5 overflow-hidden rounded-full bg-muted"
            role="img"
            aria-label={`${resumo.feitas} de ${resumo.total} entregas feitas`}
          >
            <div
              className="h-full rounded-full bg-[var(--brand-lime)]"
              style={{ width: `${progresso}%` }}
            />
          </div>
          {resumo.proxima ? (
            <p className="flex items-start gap-2 border-t border-border/60 pt-3 text-sm text-muted-foreground">
              <MapPin
                size={16}
                className="mt-0.5 shrink-0 text-[var(--ok)]"
                aria-hidden
              />
              <span>
                Próxima parada:{" "}
                <strong className="font-semibold text-foreground">
                  {resumo.proxima.titulo}
                </strong>
                {resumo.proxima.detalhe ? ` · ${resumo.proxima.detalhe}` : ""}
              </span>
            </p>
          ) : (
            <p className="flex items-start gap-2 border-t border-border/60 pt-3 text-sm text-muted-foreground">
              <CheckCircle
                size={16}
                className="mt-0.5 shrink-0 text-[var(--ok)]"
                aria-hidden
              />
              <span>
                Você completou os {resumo.total} instrumentos da jornada.{" "}
                <strong className="font-semibold text-foreground">
                  Parabéns por chegar até aqui.
                </strong>
              </span>
            </p>
          )}
        </CardContent>
      </Card>

      {/* ---------- sub-nav de página ---------- */}
      <nav
        aria-label="Nesta página"
        className="sticky top-14 z-30 -mx-4 flex gap-1 border-b border-border bg-background/90 px-4 backdrop-blur sm:-mx-6 sm:px-6 md:top-0"
      >
        <a
          href="#jornada"
          className="inline-flex min-h-11 items-center rounded-full px-4 text-sm font-semibold text-muted-foreground transition-colors outline-none hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
        >
          Jornada
        </a>
        <a
          href="#acervo"
          className="inline-flex min-h-11 items-center rounded-full px-4 text-sm font-semibold text-muted-foreground transition-colors outline-none hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
        >
          Acervo
        </a>
      </nav>

      {/* ---------- "Meus instrumentos" — a estante v6a ----------
          Cada instrumento da régua vira um card com capa desenhada na cor
          do instrumento + UMA linha de estado; o card inteiro é o gesto
          (link pro /f/<token> ou dialog de leitura — nunca dois botões
          por card: a ação secundária mora dentro do destino). Trancados
          seguem visíveis com a data de liberação em texto — marco futuro
          não vira cadeado. A avaliação do encontro não é produto de
          entrega única: pendente vira banner aqui em cima, histórico vive
          no dialog "Suas avaliações". */}
      <section
        id="jornada"
        aria-labelledby="meus-instrumentos-titulo"
        className="scroll-mt-28 space-y-4 md:scroll-mt-14"
      >
        <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
          <div>
            <h2 id="meus-instrumentos-titulo" className="text-base font-semibold">
              Meus instrumentos
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              O que está por vir abre sozinho no encontro certo.
            </p>
          </div>
          {/* histórico da recorrente — com pendência o acesso mora no
              banner; sem ela, quieto aqui na linha do título */}
          {!pendenteAvaliacao && feitasDpp.length > 0 && (
            <AvaliacoesHistoricoDialog feitas={feitasDpp} />
          )}
        </div>
        {/* banner da avaliação pendente — recorrente, não é card da
            estante; some quando não há nada pra avaliar */}
        {pendenteAvaliacao && (
          <div className="animate-enter flex flex-wrap items-center gap-x-3 gap-y-2.5 rounded-xl border border-[var(--inst-avaliacao)]/35 bg-[var(--inst-avaliacao-t)] px-4 py-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[var(--inst-avaliacao)] text-[var(--inst-avaliacao-t)]">
              <InstrumentoIcone
                instrumento="avaliacao_encontro"
                size={22}
                neutro
              />
            </span>
            <div className="min-w-0 flex-1 basis-44">
              <p className="text-sm font-semibold">Avaliação do encontro</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Falta a nota do encontro {pendenteAvaliacao.numero}: como
                foi pra você?
              </p>
            </div>
            <span className="flex items-center gap-1.5">
              {feitasDpp.length > 0 && (
                <AvaliacoesHistoricoDialog feitas={feitasDpp} />
              )}
              <AvaliarPendenteButton
                pendente={pendenteAvaliacao}
                primeiroNome={primeiroNome}
              />
            </span>
          </div>
        )}
        <div className="grid grid-cols-1 items-start gap-2 sm:grid-cols-2 sm:gap-3 lg:grid-cols-4">
          {/* ordem do guia: as 4 de construção e as duas de fechamento —
              a recorrente mora no banner/histórico, não aqui */}
          {estacoes
            .filter((est) => est.chave !== "avaliacao_encontro")
            .map((est) => (
              <InstrumentoCard
                key={est.chave}
                est={est}
                {...propsEstacao(est.chave)}
              />
            ))}
        </div>
        {/* a bandeira terminal — o encontro 16 da turma dela */}
        <p className="flex items-center gap-2 pt-1 text-xs text-muted-foreground">
          <Flag size={14} className="shrink-0" aria-hidden />
          {eventoFim?.numero != null && eventoFim.data != null
            ? `Encontro ${eventoFim.numero} · ${formatDate(eventoFim.data)}`
            : "Encontro 16"}
          <span className="font-semibold text-foreground">
            Celebração da jornada
          </span>
        </p>
      </section>

      {/* REALIZA-359 — a retrospectiva DELA: mesma tela derivada da
          ficha, alimentada só pelo recorte mentee (sem notas do mentor,
          sem a autoavaliação dele — o bloco nem renderiza) */}
      {retroJovem && <RetrospectivaJornada dados={retroJovem} />}

      {/* Como as pessoas próximas te veem (0103): a síntese anônima que o
          mentor publica. A coleta ficou fora da plataforma (decisão Leo,
          out/2026) — o que mora aqui é só a devolutiva já consolidada */}
      {consolidadoTerc && (
        <section
          aria-labelledby="terceiros-titulo"
          className="scroll-mt-28 space-y-3 md:scroll-mt-14"
        >
          <h2 id="terceiros-titulo" className="flex items-center gap-2 text-base font-semibold">
            <UsersThree size={18} className="text-muted-foreground" aria-hidden />
            Como as pessoas próximas te veem
          </h2>
          <Card className="animate-enter">
            <CardContent>
              <p className="whitespace-pre-wrap text-sm leading-relaxed">
                {consolidadoTerc.consolidado}
              </p>
              <p className="mt-3 border-t border-border/60 pt-2 text-xs text-muted-foreground">
                Síntese que seu mentor fez das respostas. Quem respondeu fica
                anônimo.
              </p>
            </CardContent>
          </Card>
        </section>
      )}

      {/* ---------- acervo: a biblioteca, agora progressiva (REALIZA-160 —
          material com encontro_num libera quando a jornada alcança) ------- */}
      <section
        id="acervo"
        aria-labelledby="acervo-titulo"
        className="scroll-mt-28 space-y-4 md:scroll-mt-14"
      >
        <div>
          <h2
            id="acervo-titulo"
            className="flex items-center gap-2 text-base font-semibold"
          >
            <FolderOpen
              size={18}
              className="text-muted-foreground"
              aria-hidden
            />
            Acervo
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Para ler e consultar quando quiser. Não conta no seu progresso.
          </p>
        </div>
        <MateriaisLista
          materiais={materiais}
          encCorrente={encontroCorrente}
          datasEnc={dataPorNumero}
        />
      </section>
    </div>
  );
}

// ---------- "Meus instrumentos" — os cards-produto (v5c) ----------

/** Sub-rótulo do título — a linha curta do mock v5c que situa o formato
 *  sem repetir o nome ("leitura inicial", "modelo SMART"). */
const SUB_ESTACAO: Record<EstacaoChave, string> = {
  roda_inicial: "leitura inicial",
  visao: "5 perguntas",
  metas: "modelo SMART",
  pdm: "Plano de Desenvolvimento",
  avaliacao_encontro: "nota + comentário",
  roda_formal: "aplicação formal",
  avaliacao_360: "mentor e mentorado",
};

/** Props compartilhadas dos cards — o que a página resolve por chave
 *  (360º × instrumentos) e passa pra estante. */
type EstacaoProps = {
  est: Estacao;
  sistema: FormularioSistema | null;
  campos: FormularioCampo[];
  /** aplicação anterior do mesmo instrumento (REALIZA-18 — roda inicial
   *  alimenta a comparação do Rever da formal) */
  respostasAnterior?: Record<string, RespostaValor> | null;
};

function TagAFazer() {
  return (
    <Badge variant="outline" className="border-[var(--input)]">
      A fazer
    </Badge>
  );
}

/** A linha única de estado do card: um rótulo + a informação que falta.
 *  "Feito · 1 de out." carrega a data na tag (o ✓ mora no selo da capa);
 *  "A fazer" traz a janela do guia do lado ("Em andamento" troca pelo
 *  rascunho local quando existe); trancada dispensa tag — a liberação em
 *  texto é a resposta (marco futuro não vira cadeado). */
function EstadoLinha({ est }: { est: Estacao }) {
  if (est.estado === "feito") {
    return (
      <Badge className="bg-[var(--ok)]/15 text-[var(--ok-text)]">
        Feito{est.respondidoEm ? ` · ${diaMesCurto(est.respondidoEm)}` : ""}
      </Badge>
    );
  }
  if (est.estado === "trancada") {
    return (
      <span className="text-xs text-muted-foreground">
        {est.detalhe ?? "Mais adiante na jornada"}
      </span>
    );
  }
  return (
    <>
      {est.token ? (
        // "em andamento" é overlay client-side: o rascunho vive no
        // localStorage deste aparelho — a tag troca depois do mount
        <JornadaRascunho token={est.token}>
          <TagAFazer />
        </JornadaRascunho>
      ) : (
        <TagAFazer />
      )}
      <span className="text-xs text-muted-foreground sm:text-[11px]">
        {est.detalhe ?? est.janela.label}
      </span>
    </>
  );
}

/** O card do instrumento na estante v6a: capa desenhada na cor do
 *  instrumento (wash de luz + glifo sangrando + marca-app sólida + selo
 *  de feito), título + sub, descrição de 2 linhas e UMA linha de estado.
 *  UM gesto por card — nunca dois botões: a_fazer limpo vira link pro
 *  /f/<token>; feito (ou re-emissão) com resposta abre o dialog Rever —
 *  e é lá dentro que mora a ação secundária ("Abrir o plano" no PDM,
 *  "Continuar" na re-emissão). No mobile cada card é uma linha: lombada
 *  na cor + marca + título + estado + chevron. Trancada mantém a tinta
 *  em sussurro e a liberação em texto, nunca laje cinza nem cadeado. */
function InstrumentoCard({
  est,
  sistema,
  campos,
  respostasAnterior = null,
}: EstacaoProps) {
  const trancada = est.estado === "trancada";
  const linkavel =
    est.estado === "a_fazer" && !!est.token && !est.respostas;
  // "feito" ou a re-emissão (a_fazer com resposta anterior) — o gesto é o
  // dialog de leitura; a ação secundária entra como rodapé dele
  const reveravel =
    !!est.respostas &&
    est.chave !== "avaliacao_encontro" &&
    (est.estado === "feito" || (est.estado === "a_fazer" && !!est.token));
  // PDM sem resposta consultável: o plano vivo é o destino que sobra
  const pdmSolto =
    est.chave === "pdm" && !linkavel && !reveravel && !trancada;
  const gesto = linkavel || reveravel || pdmSolto;

  const conteudo = (
    <>
      {/* capa: lombada de 56px no mobile, capa desenhada h-24 no desktop */}
      <span
        aria-hidden
        className={cn(
          "relative flex w-14 shrink-0 items-center justify-center bg-[var(--ict)] sm:block sm:h-24 sm:w-auto",
          trancada && "opacity-75"
        )}
      >
        {/* wash de luz — só a capa desktop (na lombada o sólido basta) */}
        <span className="absolute inset-0 hidden bg-[radial-gradient(circle_at_30%_15%,rgba(255,255,255,0.12),transparent_62%)] sm:block" />
        {/* glifo gigante sangrando pelo canto */}
        <span className="absolute -right-4 -top-4 hidden text-[var(--ic)] opacity-[0.22] sm:block">
          <InstrumentoIcone instrumento={est.chave} size={104} neutro />
        </span>
        {/* a marca-app: chip sólido na cor do instrumento, glifo na tinta */}
        <span
          className={cn(
            "relative grid size-9 place-items-center rounded-[26%] sm:absolute sm:bottom-3 sm:left-3 sm:size-10",
            trancada
              ? "text-muted-foreground"
              : "bg-[var(--ic)] text-[var(--ict)]"
          )}
        >
          <InstrumentoIcone instrumento={est.chave} size={21} neutro />
        </span>
        {/* o selo de feito — a capa carimba, a tag carrega a data */}
        {est.estado === "feito" && (
          <span className="absolute right-3 top-3 hidden text-[var(--ok)] sm:block">
            <CheckCircle weight="fill" size={20} />
          </span>
        )}
      </span>
      <span className="flex min-w-0 flex-1 flex-col p-3 sm:p-3.5">
        <h3 className="text-sm font-semibold leading-snug tracking-tight">
          {est.titulo}
          <span className="mt-0.5 block text-xs font-normal text-muted-foreground sm:text-[11px]">
            {SUB_ESTACAO[est.chave]}
          </span>
        </h3>
        <p className="mt-1 hidden line-clamp-2 text-xs leading-relaxed text-muted-foreground sm:block">
          {est.descricao}
        </p>
        <span className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 sm:mt-auto sm:pt-2">
          <EstadoLinha est={est} />
          {gesto && (
            <CaretRight
              size={16}
              className="ml-auto shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-foreground"
            />
          )}
        </span>
      </span>
    </>
  );

  const shell = cn(
    "group relative flex min-w-0 overflow-hidden rounded-xl bg-card shadow-[var(--shadow-border)] sm:flex-col",
    trancada && "border border-dashed border-border/70"
  );

  if (linkavel) {
    return (
      <Link
        href={`/f/${est.token}`}
        prefetch={false}
        style={instrumentoVars(est.chave)}
        className={cn(
          shell,
          "outline-none transition-shadow hover:ring-2 hover:ring-[var(--ic)]/50 focus-visible:ring-2 focus-visible:ring-ring"
        )}
      >
        {conteudo}
      </Link>
    );
  }
  if (pdmSolto) {
    return (
      <Link
        href="/jovem/pdm"
        prefetch={false}
        style={instrumentoVars(est.chave)}
        className={cn(
          shell,
          "outline-none transition-shadow hover:ring-2 hover:ring-[var(--ic)]/50 focus-visible:ring-2 focus-visible:ring-ring"
        )}
      >
        {conteudo}
      </Link>
    );
  }
  if (reveravel) {
    // a secundária mora no rodapé do dialog, não no card — é assim que a
    // estante fica uniforme: todo card é um gesto só pra um destino
    const acao =
      est.chave === "pdm" && est.estado === "feito"
        ? { rotulo: "Abrir o plano", href: "/jovem/pdm" }
        : est.estado === "a_fazer" && est.token
          ? { rotulo: "Continuar", href: `/f/${est.token}` }
          : undefined;
    const card = (
      <article
        style={instrumentoVars(est.chave)}
        aria-label={`Rever resposta: ${est.titulo}`}
        className={cn(
          shell,
          "w-full cursor-pointer text-left outline-none transition-shadow hover:ring-2 hover:ring-[var(--ic)]/50 focus-visible:ring-2 focus-visible:ring-ring"
        )}
      >
        {conteudo}
      </article>
    );
    return (
      <ReverRespostaDialog
        titulo={est.titulo}
        respondidoEm={est.respondidoEm}
        sistema={sistema}
        campos={campos}
        respostas={est.respostas as Record<string, RespostaValor>}
        respostasAnterior={respostasAnterior}
        trigger={card}
        acao={acao}
      />
    );
  }
  return (
    <article style={instrumentoVars(est.chave)} className={shell}>
      {conteudo}
    </article>
  );
}

// ---------- acervo (a página anterior, intacta como fallback e seção) ----------

/** Card do acervo — a linha de sempre virada peça de grid: capa borda-a-
 *  borda no topo (1ª página do PDF lazy / imagem / faixa de link externo
 *  quando não há arquivo) e a linha embaixo. O card INTEIRO é o link
 *  quando há destino — a capa parece clicável e antes era zona morta (o
 *  iframe/img do preview já são pointer-events-none, não engolem o
 *  toque). O ⋯ das secundárias fica fora do <a>, flutuando no canto da
 *  capa — botão dentro de link seria HTML inválido e comeria o toque. */
function MaterialCard({ m }: { m: Material }) {
  const Icone = TIPO_ICONE[m.tipo];
  const urlOk = linkSeguro(m.url);
  // "doc:<slug>" é documento nativo — abre na casa do jovem (a rota do app
  // expulsa o papel mentorado) e navega na mesma aba, sem ícone de saída
  const ehDoc = m.path?.startsWith("doc:") ?? false;
  const href = ehDoc
    ? `/jovem/materiais/documento/${m.path!.slice(4)}`
    : m.path
      ? `/api/material/${m.id}`
      : urlOk;
  const interno = (
    <>
      <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-muted/70 text-muted-foreground">
        <Icone size={17} aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{m.titulo}</p>
        {m.descricao && (
          <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
            {m.descricao}
          </p>
        )}
        <span className="sr-only">
          {TIPO_LABEL[m.tipo]}
          {m.path
            ? ehDoc
              ? " · documento"
              : " · arquivo"
            : urlOk && m.tipo !== "link"
              ? " · link externo"
              : ""}
        </span>
      </div>
      {m.path ? (
        <File
          size={15}
          className="shrink-0 text-muted-foreground"
          aria-hidden
        />
      ) : urlOk ? (
        <ArrowSquareOut
          size={15}
          className="shrink-0 text-muted-foreground transition-colors group-hover:text-foreground"
          aria-hidden
        />
      ) : (
        <Badge
          variant="outline"
          className="shrink-0 text-xs text-muted-foreground"
        >
          em breve
        </Badge>
      )}
    </>
  );
  // a capa: arquivo → thumb curta (crop do topo da 1ª página, ≤96px —
  // MaterialThumb é o contrato global; o preview grande h-36 é de
  // leitura, não de estante); documento nativo → faixa na mesma régua com
  // o ícone de documento; só url → faixa de link externo com o domínio;
  // sem destino ("em breve") não chega aqui como card clicável — vive no
  // grupo "A caminho" embaixo
  const capa = ehDoc ? (
    <div
      aria-hidden
      className="grid h-24 place-items-center bg-muted/60 text-muted-foreground"
    >
      <span className="flex flex-col items-center gap-1.5">
        <FileText size={20} weight="duotone" aria-hidden />
        <span className="text-[11px] font-medium">documento</span>
      </span>
    </div>
  ) : m.path ? (
    <MaterialThumb m={m} />
  ) : (
    <PreviewLink m={m} />
  );
  return (
    <div className="relative overflow-hidden rounded-xl bg-card shadow-[var(--shadow-border)]">
      {href ? (
        <a
          href={href}
          {...(ehDoc ? {} : { target: "_blank", rel: "noopener noreferrer" })}
          className="group flex h-full flex-col outline-none transition-colors hover:bg-muted/50 active:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
        >
          {capa}
          <div className="flex flex-1 items-center gap-x-4 px-5 py-3.5">
            {interno}
          </div>
        </a>
      ) : (
        <div className="flex h-full flex-col">
          {capa}
          <div className="flex flex-1 items-center gap-x-4 px-5 py-3.5">
            {interno}
          </div>
        </div>
      )}
      {/* ⋯ das secundárias — sibling do <a> (nada de botão dentro de
          link): chip com backdrop pra ler sobre qualquer capa */}
      {href && (
        <div className="absolute right-2 top-2 z-10 rounded-lg bg-background/75 backdrop-blur-sm">
          <MaterialMenu material={m} docBase="/jovem/materiais/documento" />
        </div>
      )}
    </div>
  );
}

function MateriaisLista({
  materiais,
  encCorrente = null,
  datasEnc = null,
}: {
  materiais: Material[];
  /** régua do acervo progressivo (REALIZA-160): nº do encontro corrente da
   *  dupla viva. null = sem jornada em curso → tudo liberado. */
  encCorrente?: number | null;
  /** numero → data oficial da turma dela (cronograma), pro "libera em
   *  dd/mm" dos trancados. null no fallback sem cronograma. */
  datasEnc?: Map<number, string> | null;
}) {
  // REALIZA-162: o que já dá pra abrir vira grid; o "em breve" (sem path e
  // sem url — material real que a coordenação ainda não subiu) sai da
  // vitrine e fecha o acervo no grupo apagado "A caminho" — de-emphasized,
  // nunca escondido.
  // REALIZA-160: o material marcado com encontro futuro vira o terceiro
  // bucket — recolhido no <details> "Mais adiante na jornada", mesmo
  // tratamento das estações trancadas da trilha.
  const prontos: Material[] = [];
  const aCaminho: Material[] = [];
  const trancados: Material[] = [];
  for (const m of materiais) {
    if (!materialLiberadoParaJovem(m, encCorrente)) trancados.push(m);
    else if (m.path || linkSeguro(m.url)) prontos.push(m);
    else aCaminho.push(m);
  }
  trancados.sort((a, b) => (a.encontro_num ?? 0) - (b.encontro_num ?? 0));
  const grupos = agrupar(prontos);
  if (grupos.length === 0 && aCaminho.length === 0 && trancados.length === 0) {
    return (
      <div className="flex flex-col items-center gap-1.5 rounded-xl bg-card px-5 py-10 text-center shadow-[var(--shadow-border)]">
        <span className="grid size-11 place-items-center rounded-full bg-muted text-muted-foreground">
          <FolderOpen size={18} aria-hidden />
        </span>
        <p className="text-sm font-medium">Nenhum material por aqui ainda</p>
        <p className="text-sm text-muted-foreground">
          Os guias e conteúdos do programa aparecem quando a coordenação
          publicar.
        </p>
      </div>
    );
  }
  return (
    <>
      {grupos.map(([rotulo, itens], i) => (
        <section
          key={rotulo}
          className="animate-enter space-y-2"
          style={{ "--i": Math.min(i, 10) } as CSSProperties}
        >
          <h3 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            {rotulo}
          </h3>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {itens.map((m) => (
              <MaterialCard key={m.id} m={m} />
            ))}
          </div>
        </section>
      ))}
      {aCaminho.length > 0 && (
        <section
          className="animate-enter space-y-2"
          style={{ "--i": Math.min(grupos.length, 10) } as CSSProperties}
        >
          <h3 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            A caminho
          </h3>
          <div className="divide-y divide-border/60 overflow-hidden rounded-xl border border-dashed border-border bg-card/60">
            {aCaminho.map((m) => {
              const Icone = TIPO_ICONE[m.tipo];
              return (
                <div
                  key={m.id}
                  className="flex items-center gap-x-4 px-5 py-3 text-muted-foreground"
                >
                  <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-muted/70">
                    <Icone size={17} aria-hidden />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground/80">
                      {m.titulo}
                    </p>
                    <span className="sr-only">{TIPO_LABEL[m.tipo]}</span>
                  </div>
                  <Badge
                    variant="outline"
                    className="shrink-0 text-xs text-muted-foreground"
                  >
                    em breve
                  </Badge>
                </div>
              );
            })}
          </div>
        </section>
      )}
      {trancados.length > 0 && (
        <details
          className="group animate-enter rounded-xl border border-dashed border-border bg-card/60"
          style={
            {
              "--i": Math.min(grupos.length + (aCaminho.length ? 1 : 0), 10),
            } as CSSProperties
          }
        >
          {/* summary admite heading direto (phrasing + heading content) —
              mesmo padrão das estações: o grupo inteiro lê como seção */}
          <summary className="flex cursor-pointer list-none flex-wrap items-center gap-x-3 gap-y-1 p-4 outline-none marker:hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset sm:p-5 [&::-webkit-details-marker]:hidden">
            <span className="min-w-0 flex-1">
              <h3 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                Mais adiante na jornada · {trancados.length}{" "}
                {trancados.length === 1 ? "material" : "materiais"}
              </h3>
              <span className="mt-1 block text-sm font-medium">
                {trancados
                  .slice(0, 2)
                  .map((m) => `${m.titulo} (enc. ${m.encontro_num})`)
                  .join(" · ")}
                {trancados.length > 2 && ` · +${trancados.length - 2}`}
              </span>
              <span className="mt-0.5 block text-xs text-muted-foreground">
                Cada um abre sozinho quando a jornada chega no encontro.
              </span>
            </span>
            <CaretDown
              size={16}
              className="shrink-0 text-muted-foreground transition-transform group-open:rotate-180"
              aria-hidden
            />
          </summary>
          <ul className="divide-y divide-border/60 border-t border-dashed border-border px-4 sm:px-5">
            {trancados.map((m) => {
              const Icone = TIPO_ICONE[m.tipo];
              const data =
                m.encontro_num != null
                  ? diaMesCurto(datasEnc?.get(m.encontro_num))
                  : "";
              return (
                <li
                  key={m.id}
                  className="flex items-center gap-x-4 py-3 text-muted-foreground"
                >
                  <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-muted/70">
                    <Icone size={17} aria-hidden />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground/80">
                      {m.titulo}
                    </p>
                    <p className="mt-0.5 flex items-center gap-1.5 text-xs">
                      <LockSimple
                        size={13}
                        aria-hidden
                        className="shrink-0"
                      />
                      Libera no encontro {m.encontro_num}
                      {/* diaMesCurto já fecha com ponto ("4 de nov.") —
                          sem data a frase precisa dele */}
                      {data ? ` (${data})` : "."}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        </details>
      )}
    </>
  );
}

/** Fallback §WP7 — biblioteca sem trilha: header "Minha jornada" + o
 *  acervo em grade (a trilha só existe com dupla + cronograma). Renderiza
 *  quando a RPC falha/vem vazia, quando o jovem não tem dupla ou quando a
 *  turma não tem cronograma. `encCorrente` segue valendo aqui — a régua do
 *  acervo é derivada dos encontros, não da RPC (REALIZA-160). */
function BibliotecaJovem({
  materiais,
  encCorrente = null,
}: {
  materiais: Material[];
  encCorrente?: number | null;
}) {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Minha jornada</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Os guias e conteúdos oficiais do programa.
        </p>
      </header>
      <MateriaisLista materiais={materiais} encCorrente={encCorrente} />
    </div>
  );
}
