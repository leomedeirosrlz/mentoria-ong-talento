import Link from "next/link";
import {
  CaretDown,
  Check,
  CircleDashed,
  Clock,
  Eye,
  LockSimple,
  Warning,
} from "@phosphor-icons/react/dist/ssr";
import { LembreteButton } from "@/components/lembrete-button";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { BarraSegmentada } from "@/components/viz/barra-segmentada";
import { lembreteBloqueadoAte } from "@/lib/ciclo";
import type { Interacao } from "@/lib/interacoes";
import {
  agrupaPorTurma,
  diaMesEvento,
  ESTACAO_CHAVES,
  ESTACOES,
  liberaCopia,
  resolveLinhasPainel,
  type EstacaoChave,
  type EstacaoPainelEstado,
  type GrupoTurma,
  type LinhaResolvida,
  type PainelJornadaLinha,
} from "@/lib/jornada";
import { turmaCurta } from "@/lib/turma";
import type { CicloEvento } from "@/lib/types";
import { msgsContato } from "@/lib/whatsapp-msgs";
import { cn } from "@/lib/utils";

// WP7 — "Progresso da jornada" no topo de /materiais, pra coordenação e
// supervisão. O payload é o da RPC painel_instrumentos_jornada (0096):
// fatos brutos por dupla — sem respostas e sem tokens — resolvidos aqui
// contra o cronograma oficial da turma (as mesmas janelas da jornada do
// jovem). A ficha da dupla continua sendo o detalhe (link, resposta,
// "Ver ficha" leva lá); quem entrega o instrumento é o mentor — a única
// ação daqui é lembrá-lo, respeitando o cap de 48h do enviar_lembrete.
//
// Layout v5c (feedback-ux-2026-10/materiais-coord.md): KPIs quadrados e a
// lista "por instrumento" viraram UMA faixa rolável com um segmento por
// instrumento, cada segmento carregando uma mini-barra por turma (o "14
// de 14 · T1" × "10 de 12 · T2" do mock — denominador honesto por turma,
// nunca um agregado que mistura as duas). A matriz por dupla e a lista
// de ação ficam atrás de gesto: a matriz num <details> agrupado por
// turma e a lista "fora da janela" com teto de 5 + "ver as outras".

/** Rótulo curto da célula por estação — a linha já traz o estado, então o
 *  texto diz O QUE é, não o estado (esse fica no ícone/cor). */
const CELULA_LABEL: Record<EstacaoChave, string> = {
  roda_inicial: "Roda inicial",
  visao: "Visão",
  metas: "Metas",
  pdm: "PDM",
  avaliacao_encontro: "Aval. enc.",
  roda_formal: "Roda formal",
  avaliacao_360: "360º",
};

/** Teto da lista "fora da janela" (v5c): as mais críticas primeiro —
 *  mais instrumentos parados; o resto entra num <details> pra não esticar
 *  a página. A matemática de resolução (linhas, turmas, lote, liberação)
 *  mora em src/lib/jornada.ts — a faixa e os cards de instrumento leem o
 *  mesmo cálculo. */
const TETO_FORA = 5;

/** Contas do retrato por estação dentro de um recorte de linhas — a
 *  mini-barra por turma e a contagem agregada leem a mesma tabela. */
function contasEstacao(
  chave: EstacaoChave,
  linhas: LinhaResolvida[]
): {
  respondido: number;
  pendente: number;
  aberto: number;
  trancada: number;
  fora: number;
  feitas: number;
  realizados: number;
} {
  const c = {
    respondido: 0,
    pendente: 0,
    aberto: 0,
    trancada: 0,
    fora: 0,
    feitas: 0,
    realizados: 0,
  };
  for (const r of linhas) {
    if (chave === "avaliacao_encontro") {
      c.feitas += r.linha.avaliacoes_encontro.feitas;
      c.realizados += r.linha.avaliacoes_encontro.realizados;
    }
    const e = r.estados[chave];
    if (e === "respondido") c.respondido++;
    else if (e === "pendente") c.pendente++;
    else if (e === "trancada") c.trancada++;
    else c.aberto++;
    if (r.atrasadas.has(chave)) c.fora++;
  }
  return c;
}

/** Uma célula de estação — ícone + nome, colorido pelo estado. Atraso é
 *  anel âmbar + title: a linha da dupla carrega o detalhe na lista "fora
 *  da janela", a célula só sinaliza. */
function CelulaEstacao({
  chave,
  estado,
  atrasada,
  aval,
}: {
  chave: EstacaoChave;
  estado: EstacaoPainelEstado;
  atrasada: boolean;
  /** "4/4" da avaliação do encontro — o rótulo conta o X de Y. */
  aval: string | null;
}) {
  const label = aval ?? CELULA_LABEL[chave];
  const estilo = {
    respondido: "bg-[var(--ok)]/15 text-[var(--ok-text)]",
    pendente: "bg-[var(--warn)]/15 text-[var(--warn-text)]",
    expirado: "bg-muted text-muted-foreground",
    nao_enviado: "border border-dashed border-input text-muted-foreground",
    trancada: "bg-muted/60 text-muted-foreground",
  }[estado];
  const detalhe =
    estado === "trancada"
      ? `abre no enc. ${ESTACOES[chave].encIni}`
      : atrasada
        ? "fora do prazo do guia"
        : {
            respondido: "respondido",
            pendente: "link enviado, aguardando",
            expirado: "link expirado",
            nao_enviado: "ainda não enviado",
            trancada: "ainda não abriu",
          }[estado];
  const titulo = `${label} · ${detalhe}`;
  return (
    <span
      title={titulo}
      className={cn(
        "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-medium tabular-nums sm:text-[11px]",
        estilo,
        atrasada && estado !== "trancada" && "ring-1 ring-[var(--warn)]"
      )}
    >
      {estado === "respondido" && <Check size={11} weight="bold" aria-hidden />}
      {estado === "pendente" && <Clock size={11} aria-hidden />}
      {estado === "expirado" && <Clock size={11} aria-hidden />}
      {estado === "nao_enviado" && <CircleDashed size={11} aria-hidden />}
      {estado === "trancada" && <LockSimple size={11} aria-hidden />}
      {atrasada && <Warning size={11} weight="fill" aria-hidden />}
      {label}
      {/* o detalhe do estado não pode viver só no title — inalcançável
          por toque/teclado/leitor de tela */}
      <span className="sr-only"> · {detalhe}</span>
    </span>
  );
}

/** A mini-barra por turma do segmento — "T1 · 14/14" com a barra
 *  segmentada honesta (feitos × em andamento × a fazer; ainda não aberta
 *  fica neutro-hachurado, a posição existe no denominador). A avaliação
 *  do encontro é recorrente: conta feitas/realizados, nunca "fecha". */
function MiniBarraTurma({
  chave,
  grupo,
}: {
  chave: EstacaoChave;
  grupo: GrupoTurma;
}) {
  const c = contasEstacao(chave, grupo.linhas);
  const total = grupo.linhas.length;
  const todasTrancadas =
    chave !== "avaliacao_encontro" && c.trancada === total;
  return (
    <div>
      <p className="flex items-baseline justify-between gap-2 text-xs">
        <span className="font-semibold text-muted-foreground">
          {grupo.sigla}
        </span>
        {chave === "avaliacao_encontro" ? (
          <span className="tabular-nums text-muted-foreground">
            {c.realizados === 0
              ? "a partir do enc. 1"
              : `${c.feitas}/${c.realizados}`}
          </span>
        ) : (
          <span className="tabular-nums font-semibold">
            {c.respondido}/{total}
          </span>
        )}
      </p>
      {todasTrancadas ? (
        <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
          <LockSimple size={11} aria-hidden />
          {diaMesEvento(grupo.ctx.dataEnc(ESTACOES[chave].encIni)) ??
            `enc. ${ESTACOES[chave].encIni}`}
        </p>
      ) : (
        <>
          {/* a recorrente mede avaliações de encontro — o denominador é
              `realizados` (encontros da turma realizados), não o nº de
              duplas: "0/0" seria 0%, mas sem realizado não há nem trilho
              — a linha "a partir do enc. 1" substitui a barra */}
          {chave === "avaliacao_encontro" && c.realizados === 0 ? null : (
            <BarraSegmentada
              altura="sm"
              className="mt-1"
              denominador={
                chave === "avaliacao_encontro" ? c.realizados : total
              }
              ariaLabel={
                chave === "avaliacao_encontro"
                  ? `${grupo.nome}: ${c.feitas} de ${c.realizados} avaliações de encontro`
                  : `${grupo.nome}: ${c.respondido} feitos, ${c.pendente} em andamento, ${c.aberto} a fazer${c.trancada ? `, ${c.trancada} ainda não abertas` : ""}`
              }
              segmentos={
                chave === "avaliacao_encontro"
                  ? [
                      {
                        valor: c.feitas,
                        rotulo: "avaliações respondidas",
                        cls: "bg-[var(--ok)]",
                      },
                    ]
                  : [
                      {
                        valor: c.respondido,
                        rotulo: "feitos",
                        cls: "bg-[var(--ok)]",
                      },
                      {
                        valor: c.pendente,
                        rotulo: "em andamento",
                        cls: "bg-[var(--warn)]",
                      },
                      {
                        valor: c.aberto,
                        rotulo: "a fazer",
                        cls: "bg-border",
                      },
                      // trancada fica de fora como posição neutra — o
                      // denominador deixa o buraco honesto no trilho
                    ]
              }
            />
          )}
          {c.fora > 0 && (
            <p className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-[var(--warn-text)]">
              <Warning size={11} weight="fill" aria-hidden />
              {c.fora} fora do prazo
            </p>
          )}
        </>
      )}
    </div>
  );
}

/** A estação inteira trancada em TODAS as turmas — o segmento mostra a
 *  previsão de abertura em vez de barras vazias (a mesma honestidade do
 *  card trancado: a forma fica visível, a cópia diz quando abre). */
function estacaoTrancadaToda(
  chave: EstacaoChave,
  resolvidas: LinhaResolvida[]
): boolean {
  return (
    chave !== "avaliacao_encontro" &&
    resolvidas.length > 0 &&
    resolvidas.every((r) => r.estados[chave] === "trancada")
  );
}

/** O segmento da faixa — um por instrumento: título + janela do guia +
 *  uma mini-barra por turma (T1 × T2 com fração própria). ≤960px a faixa
 *  rola na horizontal (v5c): min-w e snap no item, não quebra de linha. */
function SegmentoInstrumento({
  chave,
  grupos,
  resolvidas,
}: {
  chave: EstacaoChave;
  grupos: GrupoTurma[];
  resolvidas: LinhaResolvida[];
}) {
  const meta = ESTACOES[chave];
  const trancadaToda = estacaoTrancadaToda(chave, resolvidas);
  return (
    <li className="w-44 shrink-0 snap-start rounded-lg border border-border/70 p-3 lg:w-auto lg:min-w-0 lg:flex-1">
      <p className="text-sm font-semibold leading-snug">{meta.titulo}</p>
      <p className="mt-0.5 text-xs text-muted-foreground">
        {meta.chipLabel}
      </p>
      {trancadaToda ? (
        <p className="mt-3 flex items-start gap-1.5 text-xs font-medium leading-snug text-muted-foreground">
          <LockSimple size={12} aria-hidden className="mt-px shrink-0" />
          {liberaCopia(chave, grupos)}
        </p>
      ) : (
        <div className="mt-2.5 space-y-2.5">
          {grupos.map((g) => (
            <MiniBarraTurma key={g.cronogramaId} chave={chave} grupo={g} />
          ))}
        </div>
      )}
    </li>
  );
}

/** Linha da lista "fora da janela" — a única parte acionável do painel
 *  (v5c): quem a dupla é, o que ficou pra trás e o gesto (Ver ficha +
 *  Lembrar mentor dentro do cap de 48h, ou o badge de dupla pausada). */
function ForaItem({
  r,
  duplasInfo,
  nudges,
  meuNome,
}: {
  r: LinhaResolvida;
  duplasInfo: Map<
    string,
    { status: string; mentorWhatsapp: string | null }
  >;
  nudges: Record<string, Interacao>;
  meuNome: string;
}) {
  const { linha } = r;
  const info = duplasInfo.get(linha.dupla_id);
  const nudge =
    nudges[linha.dupla_id]?.tipo === "nudge" ? nudges[linha.dupla_id] : null;
  const falta = ESTACAO_CHAVES.filter((c) => r.atrasadas.has(c))
    .map((c) =>
      c === "avaliacao_encontro"
        ? `avaliação de encontro (${linha.avaliacoes_encontro.feitas} de ${linha.avaliacoes_encontro.realizados})`
        : ESTACOES[c].titulo
    )
    .join(" · ");
  const turma = linha.turma ? turmaCurta(linha.turma) : null;
  return (
    <li className="flex flex-wrap items-center gap-x-4 gap-y-2 py-2.5">
      <div className="min-w-40 flex-1">
        <p className="text-sm font-medium">
          {linha.jovem_nome}
          <span className="ml-2 text-xs font-normal text-muted-foreground">
            {[turma, `enc. ${r.encCorrDupla}`, `mentor ${linha.mentor_nome}`]
              .filter(Boolean)
              .join(" · ")}
          </span>
        </p>
        <p className="mt-0.5 text-xs text-muted-foreground">{falta}</p>
      </div>
      <div className="flex items-center gap-2">
        <Link
          href={`/duplas/${linha.dupla_id}`}
          className={buttonVariants({ variant: "outline", size: "sm" })}
        >
          <Eye aria-hidden />
          Ver ficha
        </Link>
        {info?.status === "ativa" ? (
          <LembreteButton
            duplaId={linha.dupla_id}
            destino="mentor"
            rotulo={`Lembrar ${linha.mentor_nome.split(" ")[0]}`}
            telefone={info?.mentorWhatsapp ?? null}
            titulo="Instrumentos da jornada"
            corpo={
              msgsContato(
                {
                  eu: meuNome,
                  mentorNome: linha.mentor_nome,
                  mentoradoNome: linha.jovem_nome,
                },
                {
                  casoMentor: `A jornada de ${linha.jovem_nome.split(" ")[0]} tem pendências fora do prazo do guia (${falta}). O link vai pro jovem pela ficha da dupla.`,
                }
              ).mentor ?? ""
            }
            href={`/duplas/${linha.dupla_id}`}
            bloqueadoAte={lembreteBloqueadoAte(nudge)}
          />
        ) : (
          <Badge variant="secondary">dupla pausada</Badge>
        )}
      </div>
    </li>
  );
}

export function PainelJornada({
  linhas,
  eventos,
  nudges,
  duplasInfo,
  meuNome,
  ehSupervisor,
}: {
  linhas: PainelJornadaLinha[];
  eventos: CicloEvento[];
  nudges: Record<string, Interacao>;
  /** status + whatsapp do mentor + flags de e-mail por dupla — o painel
   *  agregado não traz (fatos de jornada apenas). O Lembrar precisa de
   *  status/whatsapp pra ser honesto. */
  duplasInfo: Map<
    string,
    {
      status: string;
      mentorWhatsapp: string | null;
      jovemTemEmail: boolean;
      mentorTemEmail: boolean;
    }
  >;
  meuNome: string;
  /** supervisor = escopo supervisionado; a copy explica a diferença. */
  ehSupervisor: boolean;
}) {
  if (!linhas.length) return null;

  const resolvidas = resolveLinhasPainel(linhas, eventos);
  const grupos = agrupaPorTurma(resolvidas);

  // a lista de ação, ordenada por criticidade (v5c): mais instrumentos
  // parados primeiro, depois ordem alfabética — determinística
  const foraLista = resolvidas
    .filter((r) => r.atrasadas.size > 0)
    .sort(
      (a, b) =>
        b.atrasadas.size - a.atrasadas.size ||
        a.linha.jovem_nome.localeCompare(b.linha.jovem_nome)
    );
  const foraTopo = foraLista.slice(0, TETO_FORA);
  const foraResto = foraLista.slice(TETO_FORA);

  const resumoTurmas = grupos
    .map(
      (g) =>
        `${g.nome}: ${g.linhas.length} ${g.linhas.length === 1 ? "dupla" : "duplas"}, ${g.ctx.encVigente ? `encontro ${g.ctx.encVigente}` : "antes do primeiro encontro"}`
    )
    .join(" · ");

  return (
    <section className="space-y-5 rounded-xl bg-card p-4 shadow-[var(--shadow-border)] sm:p-5">
      <div>
        <h2 className="text-base font-semibold">Progresso da jornada</h2>
        <p className="mt-1 text-xs text-muted-foreground">{resumoTurmas}</p>
        {ehSupervisor && (
          <p className="mt-1 text-xs text-muted-foreground">
            Só as duplas que você supervisiona. Respostas e detalhes ficam na ficha.
          </p>
        )}
      </div>

      {/* a faixa por instrumento — 7 segmentos em trilho rolável (mobile)
          que vira linha única esticada no desktop, cada um com uma
          mini-barra por turma (fração própria por turma, nunca "x de 26"
          agregado). O próprio trilho é região focável: scroll por
          teclado alcança os segmentos escondidos */}
      <ul
        role="region"
        aria-label="Cobertura por instrumento"
        tabIndex={0}
        className="-mx-1 flex snap-x snap-mandatory gap-2.5 overflow-x-auto px-1 pb-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:flex-nowrap lg:overflow-visible"
      >
        {ESTACAO_CHAVES.map((chave) => (
          <SegmentoInstrumento
            key={chave}
            chave={chave}
            grupos={grupos}
            resolvidas={resolvidas}
          />
        ))}
      </ul>

      {/* legenda — os mesmos 5 estados da matriz */}
      <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <Check
            size={11}
            weight="bold"
            className="text-[var(--ok-text)]"
            aria-hidden
          />
          respondido
        </span>
        <span className="inline-flex items-center gap-1">
          <Clock size={11} className="text-[var(--warn-text)]" aria-hidden />
          link enviado, aguardando
        </span>
        <span className="inline-flex items-center gap-1">
          <Clock size={11} className="text-muted-foreground" aria-hidden />
          link expirado
        </span>
        <span className="inline-flex items-center gap-1">
          <CircleDashed size={11} aria-hidden />a fazer
        </span>
        <span className="inline-flex items-center gap-1">
          <LockSimple size={11} aria-hidden />
          ainda não abriu na turma
        </span>
        <span className="inline-flex items-center gap-1">
          <Warning
            size={11}
            weight="fill"
            className="text-[var(--warn-text)]"
            aria-hidden
          />
          fora do prazo do guia
        </span>
      </p>

      {/* a lista de ação — fora da janela do guia, com teto (v5c): as 5
          mais críticas + <details> pro resto */}
      {foraLista.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-[var(--warn-text)]">
            Duplas fora do prazo
          </h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {foraLista.length}{" "}
            {foraLista.length === 1
              ? "dupla com instrumento fora do prazo"
              : "duplas com instrumentos fora do prazo"}
          </p>
          <details className="group mt-1">
            <summary className="inline-flex min-h-11 cursor-pointer list-none items-center text-xs text-muted-foreground underline-offset-2 transition-colors select-none marker:hidden hover:text-foreground hover:underline focus-visible:ring-2 focus-visible:ring-ring sm:min-h-6 [&::-webkit-details-marker]:hidden">
              Como calculamos
            </summary>
            <p className="max-w-prose text-xs leading-relaxed text-muted-foreground">
              Passaram do prazo do guia sem resposta. Vale lembrar o mentor de
              enviar o link pela ficha. A avaliação do encontro nasce sozinha
              quando o encontro vira realizado.
            </p>
          </details>
          <ul className="mt-2 divide-y divide-border/60">
            {foraTopo.map((r) => (
              <ForaItem
                key={r.linha.dupla_id}
                r={r}
                duplasInfo={duplasInfo}
                nudges={nudges}
                meuNome={meuNome}
              />
            ))}
          </ul>
          {foraResto.length > 0 && (
            <details className="group">
              <summary className="flex min-h-11 cursor-pointer list-none items-center gap-1.5 text-xs font-medium text-muted-foreground underline-offset-2 outline-none transition-colors select-none marker:hidden hover:text-foreground hover:underline focus-visible:ring-2 focus-visible:ring-ring sm:min-h-8 [&::-webkit-details-marker]:hidden">
                <CaretDown
                  size={13}
                  aria-hidden
                  className="shrink-0 transition-transform group-open:rotate-180"
                />
                Ver mais {foraResto.length}{" "}
                {foraResto.length === 1 ? "dupla" : "duplas"}
              </summary>
              <ul className="divide-y divide-border/60 border-t border-border/60">
                {foraResto.map((r) => (
                  <ForaItem
                    key={r.linha.dupla_id}
                    r={r}
                    duplasInfo={duplasInfo}
                    nudges={nudges}
                    meuNome={meuNome}
                  />
                ))}
              </ul>
            </details>
          )}
        </div>
      )}

      {/* a matriz por dupla atrás de gesto (v5c) — agrupada por Turma
          1/Turma 2 com o encontro vigente de cada calendário */}
      <details className="group border-t border-border/60 pt-3">
        <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 text-sm font-medium select-none marker:hidden transition-colors hover:text-foreground/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:min-h-9 [&::-webkit-details-marker]:hidden">
          <CaretDown
            size={15}
            aria-hidden
            className="shrink-0 text-muted-foreground transition-transform group-open:rotate-180"
          />
          Ver a matriz por dupla
          <span className="ml-auto text-xs font-normal tabular-nums text-muted-foreground">
            {resolvidas.length}{" "}
            {resolvidas.length === 1 ? "dupla" : "duplas"} · por turma
          </span>
        </summary>
        <div className="mt-2 space-y-5">
          {grupos.map((g) => (
            <div key={g.cronogramaId}>
              <h3 className="text-sm font-semibold">
                {g.nome}
                <span className="ml-2 text-xs font-normal text-muted-foreground">
                  {g.ctx.encVigente
                    ? `encontro ${g.ctx.encVigente} do calendário`
                    : "antes do primeiro encontro"}{" "}
                  ·{" "}
                  {g.linhas.length}{" "}
                  {g.linhas.length === 1 ? "dupla" : "duplas"}
                </span>
              </h3>
              <ul className="mt-2 divide-y divide-border/60">
                {g.linhas.map((r) => (
                  <li
                    key={r.linha.dupla_id}
                    className="flex flex-wrap items-center gap-x-4 gap-y-2 py-2.5"
                  >
                    <div className="min-w-40 flex-1">
                      <p className="text-sm font-medium">
                        {r.linha.jovem_nome}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        mentor {r.linha.mentor_nome}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      {ESTACAO_CHAVES.map((c) => (
                        <CelulaEstacao
                          key={c}
                          chave={c}
                          estado={r.estados[c]}
                          atrasada={r.atrasadas.has(c)}
                          aval={
                            c === "avaliacao_encontro"
                              ? r.linha.avaliacoes_encontro.realizados > 0
                                ? `Aval. ${r.linha.avaliacoes_encontro.feitas}/${r.linha.avaliacoes_encontro.realizados}`
                                : "Aval. sem encontro"
                              : null
                          }
                        />
                      ))}
                      <Link
                        href={`/duplas/${r.linha.dupla_id}`}
                        className={buttonVariants({
                          variant: "ghost",
                          size: "sm",
                        })}
                      >
                        Ver ficha
                      </Link>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </details>
    </section>
  );
}
