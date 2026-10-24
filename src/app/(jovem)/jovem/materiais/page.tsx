import type { Metadata } from "next";
import type { CSSProperties } from "react";
import Link from "next/link";
import {
  ArrowRight,
  ArrowSquareOut,
  BookOpen,
  CalendarCheck,
  CaretDown,
  CaretRight,
  CheckCircle,
  CircleDashed,
  File,
  FileText,
  Flag,
  FolderOpen,
  LinkSimple,
  LockSimple,
  MapPin,
  PuzzlePiece,
} from "@phosphor-icons/react/dist/ssr";
import {
  AvaliarPendenteButton,
  VerAvaliacaoButton,
  type AvaliacaoFeita,
  type AvaliacaoPendente,
} from "@/components/jovem-avaliacoes";
import {
  InstrumentoIcone,
  instrumentoVars,
} from "@/components/instrumento-icone";
import { JornadaRascunho } from "@/components/jornada-rascunho";
import { ReverRespostaDialog } from "@/components/jornada-rever";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { formatDate, linkSeguro, TRILHA_LEN } from "@/lib/ciclo";
import { formularioPorToken } from "@/lib/forms/queries";
import {
  encCorrenteDe,
  estacoesJornada,
  materialLiberadoParaJovem,
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
  getJovemEncontros,
  getJovemJornada,
} from "@/lib/queries-jovem";
import { getConsolidadoTerceirosJovem } from "@/lib/terceiros/queries";
import { MaterialMenu } from "@/components/material-actions";
import { PreviewLink } from "@/components/material-preview-pdf";
import { MaterialThumb } from "@/components/material-thumb";
import type { Material } from "@/lib/types";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Minha jornada" };

// WP7 (REALIZA-140) + REALIZA-194 (spec v5c): /jovem/materiais é o hub
// "Minha jornada" — os 7 instrumentos oficiais da régua do guia viram a
// estante de cards-produto (capa símbolo + janela + estado honesto, o
// card inteiro = gesto) com a devolutiva de terceiros entre eles, e a
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
    ? encCorrenteDe(encontros.filter((e) => e.dupla_id === duplaDppViva.id))
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
    });
  } catch {
    estacoes = [];
  }
  if (!estacoes.length)
    return (
      <BibliotecaJovem materiais={materiais} encCorrente={encAcervo} />
    );

  // "encontro corrente" — a âncora compartilhada (lib): o maior nº de
  // encontro realizado + 1, teto 16 (realizado, não agendado futuro).
  const encontroCorrente = encCorrenteDe(encontrosDpp);

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
  // getJovemAvaliacoes ordena por created_at desc — [0] é a mais recente
  const ultimaAvaliacao: AvaliacaoFeita | null = avaliacoesDpp[0]
    ? { ...avaliacoesDpp[0], trilha: "dpp" }
    : null;
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
   *  antigo fazia inline (avaliação do encontro usa o fluxo 0071; 360º lê
   *  os campos pelo token; os 4 instrumentos pelos campos do sistema). */
  const propsEstacao = (chave: EstacaoChave) => ({
    pendenteAvaliacao:
      chave === "avaliacao_encontro" ? pendenteAvaliacao : null,
    ultimaAvaliacao:
      chave === "avaliacao_encontro" ? ultimaAvaliacao : null,
    sistema:
      chave === "avaliacao_360"
        ? ("avaliacao_360" as FormularioSistema)
        : (SISTEMA_DA_ESTACAO[chave] ?? null),
    campos:
      chave === "avaliacao_360"
        ? campos360
        : chave === "avaliacao_encontro"
          ? []
          : (camposPorSistema.get(SISTEMA_DA_ESTACAO[chave] ?? "") ?? []),
  });

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
                {dupla.turma ? `${dupla.turma} · ` : ""}
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
                {resumo.proxima.detalhe ? ` — ${resumo.proxima.detalhe}` : ""}
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
                Você completou os {resumo.total} instrumentos da jornada —{" "}
                <strong className="font-semibold text-foreground">
                  parabéns por chegar até aqui.
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

      {/* ---------- "Meus instrumentos" — os cards-produto do v5c ----------
          Cada instrumento da régua vira um card com capa símbolo + janela +
          estado honesto; o card inteiro é o gesto (link pro /f/<token>
          quando há o que continuar — sem botão redundante). Trancados
          seguem visíveis dessaturados com a data de liberação, nunca
          card mudo. Sem snippets de resposta — a resposta mora na tela
          do instrumento e no Rever, não na estante. */}
      <section
        id="jornada"
        aria-labelledby="meus-instrumentos-titulo"
        className="scroll-mt-28 space-y-4 md:scroll-mt-14"
      >
        <div>
          <h2 id="meus-instrumentos-titulo" className="font-semibold">
            Meus instrumentos
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Cada instrumento tem um encontro-alvo no guia — toque no card
            pra abrir ou continuar. O que está por vir abre sozinho no
            encontro certo.
          </p>
          {/* escopo honesto do v5c — o que a jovem vê e o que ela não vê,
              dito antes da estante (privacidade por desenho, explicada) */}
          <div className="mt-3 rounded-xl border border-border bg-muted/40 px-4 py-3 text-sm">
            <p>
              <strong className="font-semibold">Você vê:</strong> os seus
              instrumentos, as suas respostas e o acervo de apoio.
            </p>
            <p className="mt-1 text-muted-foreground">
              <strong className="font-semibold text-foreground">
                Você não vê:
              </strong>{" "}
              respostas de outros jovens, nem quem disse o quê na avaliação
              por terceiros — ela chega como consolidado anônimo.
            </p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {/* ordem do guia: as 4 de construção, a devolutiva de terceiros,
              a recorrente e as duas de fechamento */}
          {estacoes.slice(0, 4).map((est) => (
            <InstrumentoCard
              key={est.chave}
              est={est}
              primeiroNome={primeiroNome}
              {...propsEstacao(est.chave)}
            />
          ))}
          <TerceirosCard consolidado={consolidadoTerc != null} />
          {estacoes.slice(4).map((est) => (
            <InstrumentoCard
              key={est.chave}
              est={est}
              primeiroNome={primeiroNome}
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
            className="flex items-center gap-2 font-semibold"
          >
            <FolderOpen
              size={18}
              className="text-muted-foreground"
              aria-hidden
            />
            Acervo
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Para ler e consultar quando quiser — não conta no seu progresso.
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
  avaliacao_360: "e autoavaliação",
};

/** Props compartilhadas dos cards — o que a página resolve por chave
 *  (avaliação do encontro × instrumentos × 360º) e passa pra estante. */
type EstacaoProps = {
  est: Estacao;
  pendenteAvaliacao: AvaliacaoPendente | null;
  ultimaAvaliacao: AvaliacaoFeita | null;
  primeiroNome: string;
  sistema: FormularioSistema | null;
  campos: FormularioCampo[];
};

function TagAFazer() {
  return (
    <Badge variant="outline" className="border-[var(--input)]">
      <CircleDashed data-icon="inline-start" aria-hidden />
      A fazer
    </Badge>
  );
}

/** A tag de estado do card — "Feito" verdinho, "A fazer" (com a troca
 *  "Em andamento" do rascunho local quando há token) ou "trancada" nos
 *  que ainda não abriram. Mesmo componente nos dois formatos de card. */
function EstadoTag({ est }: { est: Estacao }) {
  if (est.estado === "feito") {
    return (
      <Badge className="bg-[var(--ok)]/15 text-[var(--ok-text)]">
        <CheckCircle data-icon="inline-start" aria-hidden />
        Feito
      </Badge>
    );
  }
  if (est.estado === "trancada") {
    return (
      <Badge variant="outline" className="text-muted-foreground">
        <LockSimple data-icon="inline-start" aria-hidden />
        trancada
      </Badge>
    );
  }
  return est.token ? (
    // "em andamento" é overlay client-side: o rascunho vive no
    // localStorage deste aparelho — a tag troca depois do mount
    <JornadaRascunho token={est.token}>
      <TagAFazer />
    </JornadaRascunho>
  ) : (
    <TagAFazer />
  );
}

/** A ação dos cards-article (feito, a fazer sem gesto único, avaliação) —
 *  quando o card inteiro já é o link pro /f/<token> nada aqui renderiza:
 *  dois gestos no mesmo card seria redundância, não clareza. */
function EstacaoAcao({
  est,
  pendenteAvaliacao,
  ultimaAvaliacao,
  primeiroNome,
  sistema,
  campos,
}: EstacaoProps) {
  // o PDM virou documento vivo (REALIZA-181): a estação dele sempre
  // oferece o atalho pro plano — a resposta do instrumento alimenta o doc,
  // mas é aqui que o jovem co-edita com o mentor
  const linkPdm =
    est.chave === "pdm" ? (
      <Link
        href="/jovem/pdm"
        className={buttonVariants({ variant: "outline", size: "sm" })}
      >
        Abrir o plano
        <ArrowRight size={15} data-icon="inline-end" aria-hidden />
      </Link>
    ) : null;
  // a estação recorrente usa o fluxo real de avaliação (0071): pendente →
  // dialog do form; feita → a última resposta (o toggle "meu mentor lê"
  // continua lá dentro, onde sempre morou)
  if (est.chave === "avaliacao_encontro") {
    if (est.estado === "a_fazer" && pendenteAvaliacao) {
      return (
        <AvaliarPendenteButton
          pendente={pendenteAvaliacao}
          primeiroNome={primeiroNome}
        />
      );
    }
    if (est.estado === "feito" && ultimaAvaliacao) {
      return (
        <VerAvaliacaoButton
          avaliacao={ultimaAvaliacao}
          label="Rever última avaliação"
        />
      );
    }
    return null;
  }
  // "feito" com resposta na mão vira gatilho no card inteiro
  // (InstrumentoCard) — aqui só sobra o feito sem resposta, que cai no
  // `return linkPdm` do fim
  if (est.estado === "a_fazer" && est.token) {
    // re-emissão (revisão do PDM): o card continua clicável — mas com a
    // resposta anterior consultável o gesto único quebraria: aqui o card
    // vira article com o Rever + o Continuar lado a lado. `campos` vazio
    // não impede o Rever — a leitura degrada pro recorte cru da resposta
    return (
      <>
        {est.respostas && (
          <ReverRespostaDialog
            titulo={est.titulo}
            respondidoEm={est.respondidoEm}
            sistema={sistema}
            campos={campos}
            respostas={est.respostas as Record<string, RespostaValor>}
            label="Rever resposta anterior"
          />
        )}
        <Link
          href={`/f/${est.token}`}
          className={buttonVariants({ size: "sm" })}
        >
          Continuar
          <ArrowRight size={15} data-icon="inline-end" aria-hidden />
        </Link>
        {linkPdm}
      </>
    );
  }
  // estação do PDM feita mas sem resposta/campos na mão: o atalho segue
  return linkPdm;
}

/** O card-produto do instrumento (o `.pcard` do v5c): capa símbolo na cor
 *  do instrumento, título + sub, descrição curta e a linha de estado —
 *  chip da janela do guia + tag + chevron quando o card inteiro é o link.
 *  Trancada é dessaturada e explica a data de liberação; nunca card mudo. */
function InstrumentoCard(props: EstacaoProps) {
  const { est, campos, sistema } = props;
  const trancada = est.estado === "trancada";
  // gesto único: a_fazer + token vira <a> inteiro — a menos que haja uma
  // resposta anterior pra rever (re-emissão): aí o card é article com os
  // dois gestos listados, porque <button> dentro de <a> é HTML inválido
  const linkavel =
    est.estado === "a_fazer" && !!est.token && !est.respostas;
  // "feito" com a resposta na mão: o card INTEIRO é o gatilho do Rever —
  // a estante clicável do v5c (44px sem depender de botão miúdo). A
  // recorrente fica de fora: o gesto dela é o "Rever última avaliação"
  // do fluxo próprio (0071). `campos` vazio não segura: o dialog degrada
  // pro recorte cru das respostas
  const reveravel =
    est.estado === "feito" &&
    !!est.respostas &&
    est.chave !== "avaliacao_encontro";
  const acao =
    linkavel || trancada || reveravel ? null : <EstacaoAcao {...props} />;

  const conteudo = (
    <>
      {/* capa símbolo — tinta do instrumento de fundo, glifo grande no
          centro; trancada troca a tinta pelo neutro (o glifo já sai
          neutro) e ganha o cadeado flutuante */}
      <span
        className={cn(
          "relative grid h-24 shrink-0 place-items-center",
          trancada
            ? "bg-muted text-muted-foreground"
            : "bg-[var(--ict)] text-[var(--ic)]"
        )}
      >
        <InstrumentoIcone
          instrumento={est.chave}
          size={44}
          neutro={trancada}
        />
        {trancada && (
          <span className="absolute right-2 top-2 grid size-6 place-items-center rounded-md bg-card/90 text-muted-foreground">
            <LockSimple size={13} aria-hidden />
          </span>
        )}
      </span>
      <span className="flex flex-1 flex-col gap-1.5 p-3.5">
        <h3 className="text-sm font-semibold leading-snug tracking-tight">
          {est.titulo}
          <span className="block text-[11px] font-normal text-muted-foreground">
            {SUB_ESTACAO[est.chave]}
          </span>
        </h3>
        <p className="line-clamp-3 text-xs leading-relaxed text-muted-foreground">
          {est.descricao}
        </p>
        <span className="mt-auto flex flex-wrap items-center gap-x-2 gap-y-1 pt-2">
          <span className="rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">
            {est.janela.label}
          </span>
          <EstadoTag est={est} />
          {(linkavel || reveravel) && (
            <CaretRight
              size={16}
              aria-hidden
              className="ml-auto shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-foreground"
            />
          )}
        </span>
        {est.respondidoEm && (
          <span className="flex items-center gap-1.5 text-[11px] font-medium text-[var(--ok-text)]">
            <CalendarCheck size={12} aria-hidden />
            Respondido em {formatDate(est.respondidoEm)}
          </span>
        )}
        {est.detalhe && (
          <span className="text-[11px] leading-snug text-muted-foreground">
            {est.detalhe}
          </span>
        )}
        {acao && (
          <span className="mt-1 flex flex-wrap items-center gap-2">
            {acao}
          </span>
        )}
      </span>
    </>
  );

  const shell = cn(
    "group relative flex flex-col overflow-hidden rounded-xl bg-card shadow-[var(--shadow-border)]",
    trancada && "border border-dashed border-border bg-card/60 text-muted-foreground"
  );
  if (linkavel) {
    return (
      <Link
        href={`/f/${est.token}`}
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
    // o card é o gatilho (render prop + nativeButton=false dentro do
    // ReverRespostaDialog): role=button + tabstop pela base. Nada
    // interativo pode morar dentro — por isso `acao` é null aqui e o
    // atalho do PDM vive embaixo do card, não dentro dele
    const card = (
      <article
        style={instrumentoVars(est.chave)}
        aria-label={`Rever resposta — ${est.titulo}`}
        className={cn(
          shell,
          "w-full cursor-pointer text-left outline-none transition-shadow hover:ring-2 hover:ring-[var(--ic)]/50 focus-visible:ring-2 focus-visible:ring-ring"
        )}
      >
        {conteudo}
      </article>
    );
    const dialog = (
      <ReverRespostaDialog
        titulo={est.titulo}
        respondidoEm={est.respondidoEm}
        sistema={sistema}
        campos={campos}
        respostas={est.respostas as Record<string, RespostaValor>}
        trigger={card}
      />
    );
    if (est.chave === "pdm") {
      return (
        <div className="flex flex-col gap-2">
          {dialog}
          <Link
            href="/jovem/pdm"
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            Abrir o plano
            <ArrowRight size={15} data-icon="inline-end" aria-hidden />
          </Link>
        </div>
      );
    }
    return dialog;
  }
  return (
    <article style={instrumentoVars(est.chave)} className={shell}>
      {conteudo}
    </article>
  );
}

/** O card de terceiros (0103) — instrumento oficial que não é estação da
 *  régua: a jovem nunca emite link e nunca vê respostas individuais; o
 *  card explica o formato e, com o consolidado publicado, vira o link
 *  pra síntese anonimizada na home. */
function TerceirosCard({ consolidado }: { consolidado: boolean }) {
  const conteudo = (
    <>
      <span className="relative grid h-24 shrink-0 place-items-center bg-[var(--ict)] text-[var(--ic)]">
        <InstrumentoIcone instrumento="avaliacao_terceiros" size={44} />
      </span>
      <span className="flex flex-1 flex-col gap-1.5 p-3.5">
        <h3 className="text-sm font-semibold leading-snug tracking-tight">
          Avaliação por terceiros
          <span className="block text-[11px] font-normal text-muted-foreground">
            devolutiva
          </span>
        </h3>
        <p className="line-clamp-3 text-xs leading-relaxed text-muted-foreground">
          Pessoas próximas respondem 2 perguntas — vira um consolidado,
          sem quem disse o quê.
        </p>
        <span className="mt-auto flex flex-wrap items-center gap-x-2 gap-y-1 pt-2">
          <span className="rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">
            Antes do enc. 1 · devolutiva enc. 2
          </span>
          {consolidado ? (
            <Badge className="bg-[var(--ok)]/15 text-[var(--ok-text)]">
              <CheckCircle data-icon="inline-start" aria-hidden />
              Devolutiva no ar
            </Badge>
          ) : (
            <Badge variant="outline" className="text-muted-foreground">
              em coleta
            </Badge>
          )}
          {consolidado && (
            <CaretRight
              size={16}
              aria-hidden
              className="ml-auto shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-foreground"
            />
          )}
        </span>
        <span className="text-[11px] leading-snug text-muted-foreground">
          {consolidado
            ? "Síntese que seu mentor publicou — quem respondeu fica anônimo."
            : "Seu mentor publica a síntese no encontro 2."}
        </span>
      </span>
    </>
  );
  const shell =
    "group relative flex flex-col overflow-hidden rounded-xl bg-card shadow-[var(--shadow-border)]";
  if (consolidado) {
    return (
      <Link
        href="/jovem#terceiros-titulo"
        style={instrumentoVars("avaliacao_terceiros")}
        className={cn(
          shell,
          "outline-none transition-shadow hover:ring-2 hover:ring-[var(--ic)]/50 focus-visible:ring-2 focus-visible:ring-ring"
        )}
      >
        {conteudo}
      </Link>
    );
  }
  return (
    <article
      style={instrumentoVars("avaliacao_terceiros")}
      className={shell}
    >
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
  const href = m.path ? `/api/material/${m.id}` : urlOk;
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
            ? " · arquivo"
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
  // leitura, não de estante); só url → faixa de link externo com o
  // domínio; sem destino ("em breve") não chega aqui como card
  // clicável — vive no grupo "A caminho" embaixo
  const capa = m.path ? <MaterialThumb m={m} /> : <PreviewLink m={m} />;
  return (
    <div className="relative overflow-hidden rounded-xl bg-card shadow-[var(--shadow-border)]">
      {href ? (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
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
          <MaterialMenu material={m} />
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
