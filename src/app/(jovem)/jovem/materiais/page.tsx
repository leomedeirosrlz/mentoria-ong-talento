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
import { formatDate, linkSeguro } from "@/lib/ciclo";
import { formularioPorToken } from "@/lib/forms/queries";
import {
  estacoesJornada,
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

  // Fallbacks do plano §WP7: sem jornada (RPC null/erro), sem dupla ou sem
  // cronograma → biblioteca plana, exatamente como a página sempre foi.
  const dupla =
    jornada != null
      ? (duplas.find((d) => d.id === jornada.dupla_id) ?? null)
      : null;
  if (!jornada || !dupla || !(jornada.cronograma?.length ?? 0)) {
    return <BibliotecaJovem materiais={materiais} />;
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
  if (!estacoes.length) return <BibliotecaJovem materiais={materiais} />;

  // "encontro corrente" — mesma âncora da home e da lib: o maior nº de
  // encontro realizado + 1, teto 16 (realizado, não agendado futuro).
  const encontroCorrente = Math.min(
    16,
    encontrosDpp
      .filter((e) => e.status === "realizado")
      .reduce((m, e) => Math.max(m, e.numero), 0) + 1
  );

  const passosGuia = jornada.cronograma
    .filter(
      (e): e is EventoJornada & { numero: number } =>
        e.tipo === "encontro" && e.numero != null
    )
    .sort((a, b) => a.numero - b.numero);
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
  const visiveis = lista.filter((l) => l.est.estado !== "trancada");
  const trancadas = lista.filter((l) => l.est.estado === "trancada");

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
                encontro {encontroCorrente} de 16
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

      {/* ---------- a trilha (v3): estações numeradas na linha ---------- */}
      <section
        id="jornada"
        aria-label="Sua jornada"
        className="scroll-mt-28 md:scroll-mt-14"
      >
        <ol>
          {visiveis.map((l, i) => (
            <EstacaoItem
              key={l.est.chave}
              est={l.est}
              n={l.n}
              lado={i % 2}
              primeiro={i === 0}
              pendenteAvaliacao={
                l.est.chave === "avaliacao_encontro" ? pendenteAvaliacao : null
              }
              ultimaAvaliacao={
                l.est.chave === "avaliacao_encontro" ? ultimaAvaliacao : null
              }
              primeiroNome={primeiroNome}
              sistema={
                l.est.chave === "avaliacao_360"
                  ? "avaliacao_360"
                  : (SISTEMA_DA_ESTACAO[l.est.chave] ?? null)
              }
              campos={
                l.est.chave === "avaliacao_360"
                  ? campos360
                  : l.est.chave === "avaliacao_encontro"
                    ? []
                    : (camposPorSistema.get(
                        SISTEMA_DA_ESTACAO[l.est.chave] ?? ""
                      ) ?? [])
              }
            />
          ))}
          {trancadas.length > 0 && (
            <TrancadasItem
              itens={trancadas}
              lado={visiveis.length % 2}
              primeiro={visiveis.length === 0}
            />
          )}
          <FimItem
            numero={eventoFim?.numero ?? null}
            data={eventoFim?.data ?? null}
            primeiro={visiveis.length === 0 && trancadas.length === 0}
          />
        </ol>
      </section>

      {/* ---------- acervo: a biblioteca de sempre, inalterada ---------- */}
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
        <MateriaisLista materiais={materiais} />
      </section>
    </div>
  );
}

// ---------- a trilha ----------

/** Segmento vertical da linha — cada <li> desenha o seu, então a linha muda
 *  de estado junto com a estação (v3): lime sólido no percorrido/aberto e
 *  tracejado no que está por vir. No mobile desce pela esquerda; no desktop
 *  pelo centro, com os cards alternando lados. */
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
        "absolute inset-y-0 left-6 -translate-x-1/2 border-l-2 md:left-1/2",
        primeiro && "top-11",
        trancada ? "border-dashed border-border" : "border-[var(--brand-lime)]"
      )}
    />
  );
}

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
        className="absolute left-6 top-4 z-10 grid size-11 -translate-x-1/2 place-items-center rounded-full border-2 border-dashed border-border bg-card text-muted-foreground md:left-1/2"
      >
        <LockSimple size={18} aria-hidden />
      </span>
    );
  }
  return (
    <span
      aria-hidden
      className="absolute left-6 top-4 z-10 grid size-11 -translate-x-1/2 place-items-center rounded-full bg-[var(--brand-lime)] text-[var(--brand-ink)] ring-4 ring-background md:left-1/2"
    >
      <span className="text-sm font-bold">{n}</span>
      {estado === "feito" && (
        <span className="absolute -bottom-0.5 -right-0.5 grid size-4.5 place-items-center rounded-full border-2 border-[var(--brand-lime)] bg-card text-[var(--ok-text)]">
          <Check size={10} weight="bold" aria-hidden />
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

function EstacaoItem({
  est,
  n,
  lado,
  primeiro,
  pendenteAvaliacao,
  ultimaAvaliacao,
  primeiroNome,
  sistema,
  campos,
}: {
  est: Estacao;
  n: number;
  /** 0 = card à esquerda / 1 = à direita no desktop (mobile é sempre fluxo). */
  lado: number;
  primeiro: boolean;
  pendenteAvaliacao: AvaliacaoPendente | null;
  ultimaAvaliacao: AvaliacaoFeita | null;
  primeiroNome: string;
  sistema: FormularioSistema | null;
  campos: FormularioCampo[];
}) {
  const acao = (() => {
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
        <ReverRespostaDialog
          titulo={est.titulo}
          respondidoEm={est.respondidoEm}
          sistema={sistema}
          campos={campos}
          respostas={est.respostas as Record<string, RespostaValor>}
        />
      );
    }
    if (est.estado === "a_fazer" && est.token) {
      return (
        <Link
          href={`/f/${est.token}`}
          className={buttonVariants({ size: "sm" })}
        >
          Continuar
          <ArrowRight size={15} data-icon="inline-end" aria-hidden />
        </Link>
      );
    }
    return null;
  })();

  return (
    <li className="relative pb-12 pl-16 md:pl-0">
      <SegmentoLinha primeiro={primeiro} />
      <NoEstacao n={n} estado={est.estado} />
      <article
        className={cn(
          "rounded-xl bg-card p-4 shadow-[var(--shadow-border)] sm:p-5 md:w-[calc(50%-3.25rem)]",
          lado === 1 && "md:ml-auto"
        )}
      >
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
          {est.estado === "feito" ? (
            <Badge className="bg-[var(--ok)]/15 text-[var(--ok-text)]">
              <CheckCircle data-icon="inline-start" aria-hidden />
              Feito
            </Badge>
          ) : est.token ? (
            // "em andamento" é overlay client-side: o rascunho vive no
            // localStorage deste aparelho — o pill troca depois do mount
            <JornadaRascunho token={est.token}>
              <PillAFazer />
            </JornadaRascunho>
          ) : (
            <PillAFazer />
          )}
        </div>
        {est.respondidoEm && (
          <p className="mt-2 flex items-center gap-1.5 text-xs font-medium text-[var(--ok-text)]">
            <CalendarCheck size={14} aria-hidden />
            Respondido em {formatDate(est.respondidoEm)}
          </p>
        )}
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          {est.descricao}
        </p>
        {est.snippet && (
          <div className="mt-3 rounded-r-xl border-l-[3px] border-[var(--brand-lime)] bg-[var(--brand-lime)]/10 px-3.5 py-3">
            <span className="block text-[10px] font-bold uppercase tracking-[0.08em] text-[var(--ok-text)]">
              {est.snippet.tag}
            </span>
            <blockquote className="mt-1 text-sm italic leading-relaxed">
              “{est.snippet.texto}”
            </blockquote>
          </div>
        )}
        {est.detalhe && (
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
      </article>
    </li>
  );
}

/** Estações trancadas — nunca cards normais: ficam recolhidas no <details>
 *  "Daqui pra frente", com nomes+datas no summary (anti-extensão mobile). */
function TrancadasItem({
  itens,
  lado,
  primeiro,
}: {
  itens: { est: Estacao; n: number }[];
  lado: number;
  primeiro: boolean;
}) {
  return (
    <li className="relative pb-12 pl-16 md:pl-0">
      <SegmentoLinha trancada primeiro={primeiro} />
      <NoEstacao n={0} estado="trancada" />
      <details
        className={cn(
          "group rounded-xl border border-dashed border-border bg-card/60 md:w-[calc(50%-3.25rem)]",
          lado === 1 && "md:ml-auto"
        )}
      >
        <summary className="flex cursor-pointer list-none flex-wrap items-center gap-x-3 gap-y-1 p-4 outline-none marker:hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset sm:p-5 [&::-webkit-details-marker]:hidden">
          <span className="min-w-0 flex-1">
            <span className="block text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              Daqui pra frente · {itens.length}{" "}
              {itens.length === 1 ? "estação" : "estações"}
            </span>
            <span className="mt-1 block text-sm font-medium">
              {itens
                .map((l) => `${l.est.titulo} (${quandoAbre(l.est)})`)
                .join(" · ")}
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
    <li className="relative pl-16 md:pl-0">
      <span
        aria-hidden
        className={cn(
          "absolute left-6 top-0 h-6 -translate-x-1/2 border-l-2 border-dashed border-border md:left-1/2",
          primeiro && "h-0"
        )}
      />
      <span
        aria-hidden
        className="absolute left-6 top-0 z-10 grid size-10 -translate-x-1/2 place-items-center rounded-full border-2 border-dashed border-border bg-card text-muted-foreground md:left-1/2"
      >
        <Flag size={18} aria-hidden />
      </span>
      <p className="pt-12 text-xs leading-relaxed text-muted-foreground md:text-center">
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

function MateriaisLista({ materiais }: { materiais: Material[] }) {
  const grupos = agrupar(materiais);
  if (grupos.length === 0) {
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
          <div className="divide-y divide-border/60 overflow-hidden rounded-xl bg-card shadow-[var(--shadow-border)]">
            {itens.map((m) => {
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
                </>
              );
              return (
                <div
                  key={m.id}
                  className={cn(
                    "flex items-center pr-3 transition-colors",
                    href && "hover:bg-muted/50"
                  )}
                >
                  {href ? (
                    <a
                      href={href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex min-w-0 flex-1 items-center gap-x-4 px-5 py-3.5 outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
                    >
                      {interno}
                    </a>
                  ) : (
                    <div className="flex min-w-0 flex-1 items-center gap-x-4 px-5 py-3.5">
                      {interno}
                    </div>
                  )}
                  {m.path ? (
                    <File
                      size={15}
                      className="shrink-0 text-muted-foreground"
                      aria-hidden
                    />
                  ) : urlOk ? (
                    <ArrowSquareOut
                      size={15}
                      className="shrink-0 text-muted-foreground"
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
                </div>
              );
            })}
          </div>
        </section>
      ))}
    </>
  );
}

/** Fallback §WP7 — a página exatamente como era: biblioteca plana, header
 *  "Materiais" e nada de trilha. Renderiza quando a RPC falha/vem vazia,
 *  quando o jovem não tem dupla ou quando a turma não tem cronograma. */
function BibliotecaJovem({ materiais }: { materiais: Material[] }) {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Materiais</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Os guias e conteúdos oficiais do programa.
        </p>
      </header>
      <MateriaisLista materiais={materiais} />
    </div>
  );
}
