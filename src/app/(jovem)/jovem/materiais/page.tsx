import type { Metadata } from "next";
import type { CSSProperties } from "react";
import Link from "next/link";
import {
  ArrowRight,
  ArrowSquareOut,
  BookOpen,
  CalendarCheck,
  CaretDown,
  Check,
  CheckCircle,
  CircleDashed,
  Clock,
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
  type Estacao,
  type EstacaoChave,
  type EventoJornada,
} from "@/lib/jornada";
import type {
  FormularioCampo,
  FormularioSistema,
  InstrumentoSistema,
  RespostaValor,
} from "@/lib/forms/schema";
import { getMateriais, getMe } from "@/lib/queries";
import { getJovemAvaliacoes } from "@/lib/queries-avaliacao";
import {
  getJovemDuplas,
  getJovemEncontros,
  getJovemJornada,
} from "@/lib/queries-jovem";
import { MaterialMenu } from "@/components/material-actions";
import {
  PreviewLink,
  PreviewMaterial,
} from "@/components/material-preview-pdf";
import type { Material } from "@/lib/types";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Minha jornada" };

// WP7 (REALIZA-140, mock v3 narrativa + semântica v4): /jovem/materiais vira
// o hub "Minha jornada" — as 7 estações canônicas do guia numa trilha
// vertical (entregas como recibos com data + a caligrafia do jovem), e a
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

/** Estação → o sistema de instrumento que respalda a resposta (0080/0096).
 *  avaliacao_encontro vive no fluxo próprio (0071) e o 360º chega por
 *  `jornada.avaliacao_360` — os dois não têm item em `instrumentos`. */
const SISTEMA_DA_ESTACAO: Partial<Record<EstacaoChave, InstrumentoSistema>> = {
  roda_inicial: "roda_vida",
  visao: "visao",
  metas: "metas",
  pdm: "pdm",
  roda_formal: "roda_vida",
};

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

/** Quando a estação trancada abre — data da turma quando existe, senão o
 *  número do encontro do guia (turma encurtada pode não cobrir o passo). */
function quandoAbre(e: Estacao): string {
  return (
    diaMesCurto(e.janela.dataIni) ||
    `enc. ${e.janela.encIni}`
  );
}

export default async function JovemMateriais() {
  const [me, jornada, encontros, avaliacoes, duplas, materiais] =
    await Promise.all([
      getMe(),
      // a RPC fora do ar devolve a página ao formato anterior — nunca quebra
      getJovemJornada().catch(() => null),
      getJovemEncontros(),
      getJovemAvaliacoes(),
      getJovemDuplas(),
      getMateriais(),
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

  const lista = estacoes.map((e, i) => ({ est: e, n: i + 1 }));
  // REALIZA-162 (densidade desktop): as abertas saem da trilha e viram o
  // bloco de ação "A fazer agora" logo abaixo do hero — na trilha elas NÃO
  // repetem nem marcador (decisão registrada no PR): duplicar o título
  // criaria heading/texto duplicado na mesma seção e um segundo foco de
  // atenção sem informação nova. A trilha fica sendo o histórico (feitas
  // recolhidas em recibo) + o futuro (trancadas) + a bandeira.
  const afazer = lista.filter((l) => l.est.estado === "a_fazer");
  const feitas = lista.filter((l) => l.est.estado === "feito");
  const trancadas = lista.filter((l) => l.est.estado === "trancada");

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
                Você completou as {resumo.total} estações da jornada —{" "}
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

      {/* ---------- a jornada: ação primeiro, histórico depois ----------
          Fica tudo dentro da mesma <section aria-label="Sua jornada"> —
          contrato dos specs e2e (article = estação, details = trancadas). */}
      <section
        id="jornada"
        aria-label="Sua jornada"
        className="scroll-mt-28 space-y-6 md:scroll-mt-14"
      >
        {/* "A fazer agora" — as estações abertas em cards de ação de linha
            inteira. Some a seção inteira quando não há nada aberto. */}
        {afazer.length > 0 && (
          <section aria-labelledby="afazer-titulo">
            <h2
              id="afazer-titulo"
              className="flex items-center gap-2 font-semibold"
            >
              <CircleDashed
                size={18}
                className="text-muted-foreground"
                aria-hidden
              />
              A fazer agora
            </h2>
            <div className="mt-3 space-y-4">
              {afazer.map((l) => (
                <EstacaoAberta
                  key={l.est.chave}
                  est={l.est}
                  n={l.n}
                  primeiroNome={primeiroNome}
                  {...propsEstacao(l.est.chave)}
                />
              ))}
            </div>
          </section>
        )}

        {/* a trilha compacta — rail esquerdo único (o zigzag saiu na
            densidade): recibos fechados das feitas, o <details> das
            trancadas e a bandeira do enc. 16 */}
        <ol>
          {feitas.map((l, i) => (
            <EstacaoFeita
              key={l.est.chave}
              est={l.est}
              n={l.n}
              primeiro={i === 0}
              primeiroNome={primeiroNome}
              {...propsEstacao(l.est.chave)}
            />
          ))}
          {trancadas.length > 0 && (
            <TrancadasItem itens={trancadas} primeiro={feitas.length === 0} />
          )}
          <FimItem
            numero={eventoFim?.numero ?? null}
            data={eventoFim?.data ?? null}
            primeiro={feitas.length === 0 && trancadas.length === 0}
          />
        </ol>
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

// ---------- a trilha ----------

/** Props compartilhadas das estações — o que a página resolve por chave
 *  (avaliação do encontro × instrumentos × 360º) e passa igual pros dois
 *  formatos: o card de ação ("A fazer agora") e o recibo fechado. */
type EstacaoProps = {
  est: Estacao;
  n: number;
  pendenteAvaliacao: AvaliacaoPendente | null;
  ultimaAvaliacao: AvaliacaoFeita | null;
  primeiroNome: string;
  sistema: FormularioSistema | null;
  campos: FormularioCampo[];
};

/** Segmento vertical da linha — cada <li> desenha o seu, então a linha muda
 *  de estado junto com a estação: lime sólido no percorrido e tracejado no
 *  que está por vir. Rail único à esquerda em todo breakpoint (o zigzag do
 *  desktop saiu na densidade REALIZA-162). */
function SegmentoLinha({
  trancada,
  primeiro,
}: {
  trancada?: boolean;
  primeiro?: boolean;
}) {
  return (
    <span
      aria-hidden
      className={cn(
        "absolute inset-y-0 left-5 -translate-x-1/2 border-l-2",
        primeiro && "top-11",
        trancada ? "border-dashed border-border" : "border-[var(--brand-lime)]"
      )}
    />
  );
}

/** Nó numerado — a mesma linguagem de antes, menor (size-7) pra trilha
 *  compacta: o número identifica a estação, o check lateral o feito. */
function NoEstacao({
  n,
  estado,
}: {
  n: number;
  estado: Estacao["estado"];
}) {
  if (estado === "trancada") {
    return (
      <span
        aria-hidden
        className="absolute left-5 top-4 z-10 grid size-7 -translate-x-1/2 place-items-center rounded-full border-2 border-dashed border-border bg-card text-muted-foreground"
      >
        <LockSimple size={13} aria-hidden />
      </span>
    );
  }
  return (
    <span
      aria-hidden
      className="absolute left-5 top-4 z-10 grid size-7 -translate-x-1/2 place-items-center rounded-full bg-[var(--brand-lime)] text-[var(--brand-ink)] ring-4 ring-background"
    >
      <span className="text-xs font-bold">{n}</span>
      {estado === "feito" && (
        <span className="absolute -bottom-0.5 -right-0.5 grid size-3.5 place-items-center rounded-full border-2 border-[var(--brand-lime)] bg-card text-[var(--ok-text)]">
          <Check size={8} weight="bold" aria-hidden />
        </span>
      )}
    </span>
  );
}

function PillAFazer() {
  return (
    <Badge variant="outline" className="border-[var(--input)]">
      <CircleDashed data-icon="inline-start" aria-hidden />
      A fazer
    </Badge>
  );
}

/** O pill de estado — "Feito" verdinho ou "A fazer" (com a troca "Em
 *  andamento" do rascunho local quando há token). Mesmo nos dois formatos
 *  de estação; no recibo fechado ele mora na linha do summary. */
function EstadoPill({ est }: { est: Estacao }) {
  if (est.estado === "feito") {
    return (
      <Badge className="bg-[var(--ok)]/15 text-[var(--ok-text)]">
        <CheckCircle data-icon="inline-start" aria-hidden />
        Feito
      </Badge>
    );
  }
  return est.token ? (
    // "em andamento" é overlay client-side: o rascunho vive no
    // localStorage deste aparelho — o pill troca depois do mount
    <JornadaRascunho token={est.token}>
      <PillAFazer />
    </JornadaRascunho>
  ) : (
    <PillAFazer />
  );
}

/** A ação da estação — o que muda por estado/chave (a mesma regra do card
 *  antigo, agora compartilhada pelo "A fazer agora" e pelo recibo aberto). */
function EstacaoAcao({
  est,
  pendenteAvaliacao,
  ultimaAvaliacao,
  primeiroNome,
  sistema,
  campos,
}: Omit<EstacaoProps, "n">) {
  // o PDM virou documento vivo (REALIZA-181): a estação dele sempre
  // oferece o atalho pro plano — a resposta do instrumento alimenta o doc,
  // mas é aqui que o jovem co-edita com o mentor
  const linkPdm =
    est.chave === "pdm" ? (
      <Link
        href="/jovem/pdm"
        className={buttonVariants({ variant: "outline" })}
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
  if (est.estado === "feito" && est.respostas && campos.length) {
    return (
      <>
        <ReverRespostaDialog
          titulo={est.titulo}
          respondidoEm={est.respondidoEm}
          sistema={sistema}
          campos={campos}
          respostas={est.respostas as Record<string, RespostaValor>}
        />
        {linkPdm}
      </>
    );
  }
  if (est.estado === "a_fazer" && est.token) {
    return (
      // re-emissão (revisão do PDM): a rodada aberta tem CTA, mas a
      // resposta anterior segue acessível — a estação diz "segue salva"
      // e o Rever prova. (0097: resolveEstacao devolve respostas da
      // última respondida também no a_fazer)
      <div className="flex flex-wrap items-center gap-2">
        {est.respostas && campos.length > 0 && (
          <ReverRespostaDialog
            titulo={est.titulo}
            respondidoEm={est.respondidoEm}
            sistema={sistema}
            campos={campos}
            respostas={est.respostas as Record<string, RespostaValor>}
            label="Rever resposta anterior"
          />
        )}
        <Link href={`/f/${est.token}`} className={buttonVariants()}>
          Continuar
          <ArrowRight size={15} data-icon="inline-end" aria-hidden />
        </Link>
        {linkPdm}
      </div>
    );
  }
  // estação do PDM feita mas sem resposta/campos na mão: o atalho segue
  return linkPdm;
}

/** O corpo do card — data, descrição, "Você escreveu…", detalhe honesto e
 *  ação. No recibo fechado a linha do summary já carrega data+detalhe,
 *  então o corpo aberto os omite (um texto só — duplicar quebraria a
 *  contagem exata dos specs e2e e repetiria informação na tela). */
function EstacaoCorpo({
  est,
  acao,
  mostrarData = true,
  mostrarDetalhe = true,
}: {
  est: Estacao;
  acao: React.ReactNode;
  mostrarData?: boolean;
  mostrarDetalhe?: boolean;
}) {
  return (
    <>
      {mostrarData && est.respondidoEm && (
        <p className="mt-2 flex items-center gap-1.5 text-xs font-medium text-[var(--ok-text)]">
          <CalendarCheck size={14} aria-hidden />
          Respondido em {formatDate(est.respondidoEm)}
        </p>
      )}
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
        {est.descricao}
      </p>
      {est.snippet && est.snippet.texto !== est.detalhe && (
        <div className="mt-3 rounded-r-xl border-l-[3px] border-[var(--brand-lime)] bg-[var(--brand-lime)]/10 px-3.5 py-3">
          <span className="block text-[10px] font-bold uppercase tracking-[0.08em] text-[var(--ok-text)]">
            {est.snippet.tag}
          </span>
          <blockquote className="mt-1 text-sm italic leading-relaxed">
            “{est.snippet.texto}”
          </blockquote>
        </div>
      )}
      {mostrarDetalhe && est.detalhe && (
        <p className="mt-3 flex items-start gap-1.5 rounded-lg bg-muted px-3 py-2 text-xs leading-relaxed text-muted-foreground">
          {est.estado === "feito" ? (
            <CheckCircle
              size={14}
              className="mt-0.5 shrink-0 text-[var(--ok)]"
              aria-hidden
            />
          ) : (
            <Clock size={14} className="mt-0.5 shrink-0" aria-hidden />
          )}
          <span>{est.detalhe}</span>
        </p>
      )}
      {acao && (
        <div className="mt-4 flex flex-wrap items-center gap-2">{acao}</div>
      )}
    </>
  );
}

/** Estação aberta no "A fazer agora" — card de ação de linha inteira (o
 *  conteúdo do card da trilha antiga, sem o <li> do zigzag): o CTA é o
 *  protagonista e o resto explica o que falta. */
function EstacaoAberta(props: EstacaoProps) {
  const { est, n } = props;
  return (
    <article className="rounded-xl bg-card p-4 shadow-[var(--shadow-border)] sm:p-6">
      <p className="flex flex-wrap items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
        Estação {n}
        <span className="rounded-md bg-[var(--brand-ink)] px-1.5 py-0.5 text-[10px] font-semibold normal-case tracking-normal text-white">
          {est.janela.label}
        </span>
      </p>
      <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <h3 className="text-base font-semibold tracking-tight">
          {est.titulo}
        </h3>
        <EstadoPill est={est} />
      </div>
      <EstacaoCorpo est={est} acao={<EstacaoAcao {...props} />} />
    </article>
  );
}

/** Recibo da estação feita — a linha compacta da trilha (nó + Estação N +
 *  título + "Feito" + data/detalhe) que abre no próprio lugar: o <details>
 *  revela a descrição, o "Você escreveu…" e o Rever resposta. O estado
 *  expandido é nativo do elemento — leitor de tela anuncia aberto/fechado
 *  sem aria-expanded manual. */
function EstacaoFeita({
  primeiro,
  ...props
}: EstacaoProps & { primeiro: boolean }) {
  const { est, n } = props;
  return (
    <li className="relative pb-4 pl-12">
      <SegmentoLinha primeiro={primeiro} />
      <NoEstacao n={n} estado={est.estado} />
      <article className="overflow-hidden rounded-xl bg-card shadow-[var(--shadow-border)]">
        <details className="group">
          {/* summary admite heading direto (phrasing + heading content) —
              o h3 mora na linha sem wrapper inválido; o caret vai pro fim
              com ml-auto e o meta data/detalhe quebra a linha no wrap */}
          <summary className="flex min-h-11 cursor-pointer list-none flex-wrap items-center gap-x-2.5 gap-y-1 px-4 py-3 outline-none marker:hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset [&::-webkit-details-marker]:hidden">
            <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              Estação {n}
            </span>
            <span className="rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">
              {est.janela.label}
            </span>
            <h3 className="text-sm font-semibold tracking-tight">
              {est.titulo}
            </h3>
            <EstadoPill est={est} />
            {(est.respondidoEm || est.detalhe) && (
              <span className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                {est.respondidoEm && (
                  <span className="inline-flex items-center gap-1">
                    <CalendarCheck size={12} aria-hidden />
                    Respondido em {formatDate(est.respondidoEm)}
                  </span>
                )}
                {est.detalhe && <span>{est.detalhe}</span>}
              </span>
            )}
            <CaretDown
              size={15}
              className="ml-auto shrink-0 text-muted-foreground transition-transform group-open:rotate-180"
              aria-hidden
            />
          </summary>
          <div className="border-t border-border/60 px-4 pb-4 pt-1">
            <EstacaoCorpo
              est={est}
              mostrarData={false}
              mostrarDetalhe={false}
              acao={<EstacaoAcao {...props} />}
            />
          </div>
        </details>
      </article>
    </li>
  );
}

/** Estações trancadas — nunca cards normais: ficam recolhidas no <details>
 *  "Daqui pra frente", com nomes+datas no summary (anti-extensão mobile). */
function TrancadasItem({
  itens,
  primeiro,
}: {
  itens: { est: Estacao; n: number }[];
  primeiro: boolean;
}) {
  return (
    <li className="relative pb-4 pl-12">
      <SegmentoLinha trancada primeiro={primeiro} />
      <NoEstacao n={0} estado="trancada" />
      <details className="group rounded-xl border border-dashed border-border bg-card/60">
        <summary className="flex cursor-pointer list-none flex-wrap items-center gap-x-3 gap-y-1 p-4 outline-none marker:hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset sm:p-5 [&::-webkit-details-marker]:hidden">
          <span className="min-w-0 flex-1">
            <span className="block text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              Daqui pra frente · {itens.length}{" "}
              {itens.length === 1 ? "estação" : "estações"}
            </span>
            <span className="mt-1 block text-sm font-medium">
              {/* anti-extensão: 2 primeiros + "+N" — a lista cheia tá logo
                  abaixo, no corpo expandido do details */}
              {itens
                .slice(0, 2)
                .map((l) => `${l.est.titulo} (${quandoAbre(l.est)})`)
                .join(" · ")}
              {itens.length > 2 && ` · +${itens.length - 2}`}
            </span>
            <span className="mt-0.5 block text-xs text-muted-foreground">
              Cada uma abre sozinha no encontro certo.
            </span>
          </span>
          <CaretDown
            size={16}
            className="shrink-0 text-muted-foreground transition-transform group-open:rotate-180"
            aria-hidden
          />
        </summary>
        <ul className="divide-y divide-border/60 border-t border-dashed border-border px-4 sm:px-5">
          {itens.map((l) => (
            <li key={l.est.chave} className="py-3">
              <p className="flex flex-wrap items-baseline gap-x-2">
                <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                  Estação {l.n}
                </span>
                <span className="text-sm font-medium">{l.est.titulo}</span>
                <span className="rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">
                  {l.est.janela.label}
                </span>
              </p>
              <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                <LockSimple size={13} aria-hidden className="shrink-0" />
                {l.est.detalhe ?? `Abre no encontro ${l.est.janela.encIni}.`}
              </p>
            </li>
          ))}
        </ul>
      </details>
    </li>
  );
}

/** A bandeira terminal — o encontro 16 da turma dela fecha a trilha. */
function FimItem({
  numero,
  data,
  primeiro,
}: {
  numero: number | null;
  data: string | null;
  primeiro: boolean;
}) {
  return (
    <li className="relative pl-12">
      <span
        aria-hidden
        className={cn(
          "absolute left-5 top-0 h-6 -translate-x-1/2 border-l-2 border-dashed border-border",
          primeiro && "h-0"
        )}
      />
      <span
        aria-hidden
        className="absolute left-5 top-0 z-10 grid size-8 -translate-x-1/2 place-items-center rounded-full border-2 border-dashed border-border bg-card text-muted-foreground"
      >
        <Flag size={14} aria-hidden />
      </span>
      <p className="pt-10 text-xs leading-relaxed text-muted-foreground">
        {numero != null && data && (
          <>
            Encontro {numero} · {formatDate(data)}
            <br />
          </>
        )}
        <strong className="font-semibold text-foreground">
          Celebração da jornada
        </strong>
      </p>
    </li>
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
  // a capa: arquivo → 1ª página do PDF/imagem; só url → faixa de link
  // externo com o domínio; sem destino ("em breve") não chega aqui como
  // card clicável — vive no grupo "A caminho" embaixo
  const capa = m.path ? <PreviewMaterial m={m} /> : <PreviewLink m={m} />;
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
