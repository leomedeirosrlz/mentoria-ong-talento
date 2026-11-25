import type { Metadata } from "next";
import Link from "next/link";
import {
  BookOpen,
  CaretRight,
  CheckCircle,
  Flag,
  FolderOpen,
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
import { formatDate, diaMesCurto, TRILHA_LEN } from "@/lib/ciclo";
import { turmaLonga } from "@/lib/turma";
import { formularioPorToken } from "@/lib/forms/queries";
import {
  datasOficiaisDe,
  encCorrenteDe,
  estacoesJornada,
  momentoRefazerRoda,
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
  InstrumentoDuplaSistema,
  RespostaValor,
} from "@/lib/forms/schema";
import { INSTRUMENTOS_DUPLA_SISTEMA } from "@/lib/forms/schema";
import { docDoSistema } from "@/lib/como-conduzir";
import { conquistasDoJovem } from "@/lib/conquistas";
import { MarcosACaminho } from "./marcos-a-caminho";
import {
  corpusServeJovem,
  listarDocsCorpus,
} from "@/lib/materiais/corpus-doc";
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
import { MateriaisLista } from "@/components/materiais-jovem-lista";
import { BibliotecaViewToggle } from "@/components/biblioteca-view-toggle";
import type { Material, Trilha } from "@/lib/types";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Materiais" };

// WP7 (REALIZA-140) + REALIZA-194 (spec v5c) + FR-007 (010): o hub do
// jovem se chama Materiais — os 7 instrumentos oficiais da régua do
// guia viram a
// estante de cards-produto (capa símbolo + janela + estado honesto, o
// card inteiro = gesto), e a
// biblioteca de sempre continua embaixo como "Acervo". As datas saem do
// cronograma da turma DELA (RPC jovem_jornada, 0096) — T1 e T2 veem janelas
// diferentes pro mesmo encontro. Fallback decidido no plano: RPC fora,
// sem dupla ou cronograma vazio → a biblioteca plana renderiza intacta.

// estação → sistema do instrumento: SISTEMA_DA_ESTACAO canônico
// (jornada.ts, 0080/0096) — avaliacao_encontro vive no fluxo próprio
// (0071) e o 360º chega por `jornada.avaliacao_360`: os dois não têm
// item em `instrumentos`.

export default async function JovemMateriais() {
  const [
    me,
    jornada,
    encontros,
    avaliacoes,
    duplas,
    materiais,
    consolidadoTerc,
    // os combinados dela — a faixa "Próximo marco" e a retrospectiva leem do
    // mesmo cache() sem query a mais
    encaminhamentos,
  ] = await Promise.all([
    getMe(),
    // a RPC fora do ar devolve a página ao formato anterior — nunca quebra
    getJovemJornada().catch(() => null),
    getJovemEncontros(),
    getJovemAvaliacoes(),
    getJovemDuplas(),
    getMateriais(),
    // o consolidado de terceiros publicado — cache()ada, a home já chama
    getConsolidadoTerceirosJovem().catch(() => null),
    getJovemEncaminhamentos(),
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
  // a faixa "Próximo marco" (485/515) nasce da mesma derivação do perfil — mesmos
  // dados já lidos; sem dupla `marcos` vem vazio e a faixa não renderiza.
  // Derivação antes dos fallbacks: sem RPC/estação ela sobrevive do mesmo
  // jeito que a estante sobrevive no perfil
  const conq = conquistasDoJovem({
    encontros,
    duplas,
    jornada,
    avaliacoes,
    encaminhamentos,
  });
  if (!jornada || !dupla || !(jornada.cronograma?.length ?? 0)) {
    return (
      <div className="space-y-6">
        <MarcosACaminho marcos={conq.marcos} />
        <BibliotecaJovem materiais={materiais} encCorrente={encAcervo} />
      </div>
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
      <div className="space-y-6">
        <MarcosACaminho marcos={conq.marcos} />
        <BibliotecaJovem materiais={materiais} encCorrente={encAcervo} />
      </div>
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
        duplaId: jornada.dupla_id,
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

  // REALIZA-386 — "Ler o guia" por estação: só quando o doc nativo do
  // instrumento existe E serve o jovem (corpusServeJovem — doc de staff
  // não vira link morto na casa dele). Estações sem instrumento de
  // sistema (avaliação recorrente, 360º) não têm guia pra ler.
  const corpusPorSlug = new Map(
    (await listarDocsCorpus()).map((d) => [d.slug, d])
  );
  const guiaPorEstacao = new Map<EstacaoChave, string>();
  for (const est of estacoes) {
    const s = SISTEMA_DA_ESTACAO[est.chave];
    if (!s || !(INSTRUMENTOS_DUPLA_SISTEMA as readonly string[]).includes(s))
      continue;
    const doc = corpusPorSlug.get(docDoSistema(s as InstrumentoDuplaSistema));
    if (doc && corpusServeJovem(doc)) {
      guiaPorEstacao.set(est.chave, `/jovem/materiais/documento/${doc.slug}`);
    }
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
  const rodaEntregas =
    (jornada.instrumentos ?? []).find((i) => i.sistema === "roda_vida")
      ?.entregas ?? [];
  const rodaPar = parRoda(rodaEntregas);
  // o momento que o "Refazer" mintaria agora (0209 → 486): a RPC herda o
  // momento do último link usado — na inicial o botão só aparece quando
  // o link gerado é mesmo o 'inicial'
  const momentoRefazer = momentoRefazerRoda(rodaEntregas);

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
    guiaHref: guiaPorEstacao.get(chave) ?? null,
    rodaMomentoRefazer:
      chave === "roda_inicial" || chave === "roda_formal"
        ? momentoRefazer
        : undefined,
  });

  // ---------- retrospectiva (REALIZA-359) ----------
  // destravada pela RPC (16º realizado ou dupla fechada); as fontes são as
  // que já são dela — a timeline do payload, os encontros/combinados das
  // views dela e o PDM (a RPC dele também escopa por papel). O checklist
  // do mentor nem chega no payload — a autoavaliação é recorte de staff.
  const retroAberto = jornada.retrospectiva?.desbloqueada === true;
  const pdmResumo = retroAberto
    ? await getPdmResumo(jornada.dupla_id).catch(() => null)
    : null;
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
        // as estrelas dela alimentam a sparkline + o tile "Avaliação do
        // jovem" da retrospectiva (378) — dados que já são dela
        avaliacoes: avaliacoesDpp.flatMap((a) =>
          a.encontro?.numero != null
            ? [
                {
                  numero: a.encontro.numero,
                  estrelas: a.estrelas,
                  temas: a.temas,
                },
              ]
            : []
        ),
        combinados: encaminhamentos.filter(
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
      {/* ---------- hero slim (anti-extensão mobile): UM card só ----------
          528: o "Próximo marco" virou zona embutida aqui dentro — hero +
          faixa eram dois cards seguidos (~390px de dobra no mobile). */}
      <Card className="animate-enter">
        <CardContent className="space-y-3 pt-2 sm:space-y-4 sm:pt-5">
          <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
            <div className="min-w-0">
              <h1 className="text-2xl font-semibold tracking-tight">
                Materiais
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                {dupla.turma ? `${turmaLonga(dupla.turma)} · ` : ""}
                você está no encontro {encontroCorrente} de {TRILHA_LEN.dpp}
              </p>
              {fase && (
                <p className="mt-1.5">
                  <Badge variant="secondary" className="font-medium">
                    Fase · {fase}
                  </Badge>
                </p>
              )}
            </div>
            {/* no mobile a contagem desce pra ponta da barra — o bloco
                text-3xl só existe no desktop, onde ele nunca embrulha */}
            <div className="hidden text-right sm:block">
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
          <div className="flex items-center gap-3">
            <div
              className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted sm:h-2.5"
              role="img"
              aria-label={`${resumo.feitas} de ${resumo.total} entregas feitas`}
            >
              <div
                className="h-full rounded-full bg-[var(--brand-lime)]"
                style={{ width: `${progresso}%` }}
              />
            </div>
            <p className="text-xs font-semibold tabular-nums text-muted-foreground sm:hidden">
              {resumo.feitas}
              <span className="font-normal">/{resumo.total}</span>
            </p>
          </div>
          {/* ---------- "Próximo marco" (485/515 + 528 embutido) — só o
              próximo marco de ação ainda não ganho; é a linha de próximo
              passo do card (a "Próxima parada" morreu na 528: a estante
              logo abaixo já mostra a estação trancada com a mesma data).
              Os ganhos moram na estante do perfil e a faixa só aponta
              pra ela. Sem gesto próprio: não compete com o
              agendar/registrar da home. ---------- */}
          <MarcosACaminho marcos={conq.marcos} embutido />
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
          Meus instrumentos
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
              Os próximos abrem no encontro certo.
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
                temMedia={avaliacoesDpp.length >= 3}
              />
            </span>
          </div>
        )}
        <div className="grid grid-cols-1 items-start gap-2 sm:grid-cols-2 sm:gap-3 lg:grid-cols-4">
          {/* ordem do guia: as 4 de construção e as duas de fechamento —
              a recorrente mora no banner/histórico, não aqui. O "Ler o
              guia" é a tira de rodapé dentro da borda do card (486) —
              leitura em hierarquia secundária, um gesto por card segue */}
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
        <div className="flex items-start justify-between gap-3">
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
          <BibliotecaViewToggle superficie="jovem" total={materiais.length} />
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

/** Consequência do "Refazer" por estação (486) — qual leitura a resposta
 *  nova substitui. Nas rodas a frase nomeia a ponta da comparação que o
 *  link novo reescreve; nos outros instrumentos entra a linha padrão do
 *  dialog ("passa a valer no lugar desta"). */
const REFAZER_NOTA: Partial<Record<EstacaoChave, string>> = {
  roda_inicial:
    "Ela vira a sua leitura inicial, a roda 'antes' da comparação com a aplicação formal.",
  roda_formal:
    "Ela vira a sua aplicação formal, a roda 'depois' da comparação com a leitura inicial.",
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
  /** doc nativo do instrumento quando serve o jovem — a tira "Ler o
   *  guia" do rodapé do card */
  guiaHref?: string | null;
  /** momento que a RPC de refazer mintaria agora (0209) — o "Refazer" da
   *  estação só aparece quando é o momento DELA */
  rodaMomentoRefazer?: "inicial" | "formal" | null;
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
 *  "Responder a nova rodada" na re-emissão). No mobile cada card é uma
 *  linha: lombada na cor + marca + título + estado + chevron. Trancada
 *  mantém a tinta em sussurro e a liberação em texto, nunca laje cinza
 *  nem cadeado. */
function InstrumentoCard({
  est,
  sistema,
  campos,
  respostasAnterior = null,
  guiaHref = null,
  rodaMomentoRefazer,
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
              className="ml-auto shrink-0 text-muted-foreground transition-transform group-hover/gesto:translate-x-0.5 group-hover/gesto:text-foreground"
            />
          )}
        </span>
      </span>
    </>
  );

  // a borda mora no container; dentro, a área do gesto (link ou o
  // trigger do Rever) cobre o corpo e o "Ler o guia" fecha como tira de
  // rodapé — dois alvos separados, sem botão dentro de link (486). O
  // hover/focus contorna o card INTEIRO (010): o contorno vive no shell e
  // o foco do gesto acende ele via has-[:focus-visible]; trancada não
  // promete ação, então não ganha anel nenhum. O mecanismo é outline com
  // offset negativo (022/US1): sombra ring-inset pinta ABAIXO dos filhos
  // opacos e a capa/lombada cobriam o anel — outline sai por cima deles e
  // segue o radius
  const shell = cn(
    "relative flex min-w-0 flex-col overflow-hidden rounded-xl bg-card shadow-[var(--shadow-border)]",
    trancada && "border border-dashed border-border/70",
    gesto &&
      "hover:outline-2 hover:-outline-offset-2 hover:outline-[var(--ic)]/50 has-[.gesto:focus-visible]:outline-2 has-[.gesto:focus-visible]:-outline-offset-2 has-[.gesto:focus-visible]:outline-ring"
  );
  const gestoCls = cn(
    "gesto group/gesto flex min-w-0 outline-none sm:flex-col"
  );
  const guia = guiaHref ? (
    <Link
      href={guiaHref}
      prefetch={false}
      className="flex min-h-11 items-center gap-1.5 border-t border-border/60 px-3 text-xs font-medium text-muted-foreground outline-none transition-colors hover:bg-muted/50 hover:text-foreground focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring sm:px-3.5"
    >
      <BookOpen size={13} aria-hidden />
      Ler o guia
    </Link>
  ) : null;

  if (linkavel || pdmSolto) {
    return (
      <div style={instrumentoVars(est.chave)} className={shell}>
        <Link
          href={linkavel ? `/f/${est.token}` : "/jovem/pdm"}
          prefetch={false}
          className={gestoCls}
        >
          {conteudo}
        </Link>
        {guia}
      </div>
    );
  }
  if (reveravel) {
    // a secundária do instrumento mora no rodapé do dialog, não no card —
    // é assim que a estante fica uniforme: todo card é um gesto só pra
    // um destino
    const acao =
      est.chave === "pdm" && est.estado === "feito"
        ? { rotulo: "Abrir o plano", href: "/jovem/pdm" }
        : est.estado === "a_fazer" && est.token
          ? // 515 — "nova rodada" só quando a re-emissão foi decidida de
            // verdade; um link mintado sem decisão (rematch, auto-cura)
            // abre com o CTA neutro
            {
              rotulo: est.reemissao ? "Responder a nova rodada" : "Responder",
              href: `/f/${est.token}`,
            }
          : undefined;
    const card = (
      <article
        aria-label={`Rever resposta: ${est.titulo}`}
        className={cn(gestoCls, "w-full cursor-pointer text-left")}
      >
        {conteudo}
      </article>
    );
    return (
      <div style={instrumentoVars(est.chave)} className={shell}>
        <ReverRespostaDialog
          titulo={est.titulo}
          respondidoEm={est.respondidoEm}
          sistema={sistema}
          campos={campos}
          respostas={est.respostas as Record<string, RespostaValor>}
          respostasAnterior={respostasAnterior}
          trigger={card}
          acao={acao}
          refazerSistema={
            est.estado === "feito" &&
            sistema != null &&
            ["visao", "metas", "pdm", "roda_vida"].includes(sistema) &&
            // a RPC minta o momento do último link usado (0209) — o
            // "Refazer" só é honesto quando o link gerado é o da estação
            (sistema !== "roda_vida" ||
              rodaMomentoRefazer ===
                (est.chave === "roda_inicial" ? "inicial" : "formal"))
              ? sistema
              : undefined
          }
          refazerNota={REFAZER_NOTA[est.chave]}
        />
        {guia}
      </div>
    );
  }
  return (
    <div style={instrumentoVars(est.chave)} className={shell}>
      <article className="flex min-w-0 sm:flex-col">{conteudo}</article>
      {guia}
    </div>
  );
}

/** Fallback §WP7 — biblioteca sem trilha: header "Materiais" + o
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
      <header className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Materiais</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Os guias e conteúdos oficiais do programa.
          </p>
        </div>
        <BibliotecaViewToggle superficie="jovem" total={materiais.length} />
      </header>
      <MateriaisLista materiais={materiais} encCorrente={encCorrente} />
    </div>
  );
}
