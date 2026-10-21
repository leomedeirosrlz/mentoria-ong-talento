import Link from "next/link";
import {
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
import { lembreteBloqueadoAte, TRILHA_LEN } from "@/lib/ciclo";
import type { Interacao } from "@/lib/interacoes";
import {
  atrasadasPainel,
  ESTACAO_CHAVES,
  ESTACOES,
  estacoesPainelDupla,
  painelTurmaCtx,
  type EstacaoChave,
  type EstacaoPainelEstado,
  type PainelJornadaLinha,
} from "@/lib/jornada";
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

type LinhaResolvida = {
  linha: PainelJornadaLinha;
  encVigente: number;
  estados: Record<EstacaoChave, EstacaoPainelEstado>;
  atrasadas: Set<EstacaoChave>;
};

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
  const titulo =
    estado === "trancada"
      ? `${label} · abre no enc. ${ESTACOES[chave].encIni}`
      : atrasada
        ? `${label} · fora da janela do guia`
        : `${label} · ${
            {
              respondido: "respondido",
              pendente: "link enviado, aguardando",
              expirado: "link expirado",
              nao_enviado: "ainda não enviado",
              trancada: "ainda não abriu",
            }[estado]
          }`;
  return (
    <span
      title={titulo}
      className={cn(
        "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium tabular-nums",
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
    </span>
  );
}

/** Barra empilhada "feitos × em andamento × a fazer × trancada" — o
 *  retrato agregado da estação entre as duplas do escopo. */
function BarraEstacao({
  chave,
  linhasResolvidas,
}: {
  chave: EstacaoChave;
  linhasResolvidas: LinhaResolvida[];
}) {
  const contas = { respondido: 0, pendente: 0, aberto: 0, trancada: 0, fora: 0 };
  let feitas = 0;
  let realizados = 0;
  for (const r of linhasResolvidas) {
    if (chave === "avaliacao_encontro") {
      feitas += r.linha.avaliacoes_encontro.feitas;
      realizados += r.linha.avaliacoes_encontro.realizados;
    }
    const e = r.estados[chave];
    if (e === "respondido") contas.respondido++;
    else if (e === "pendente") contas.pendente++;
    else if (e === "trancada") contas.trancada++;
    else contas.aberto++; // expirado + nao_enviado = "a fazer"
    if (r.atrasadas.has(chave)) contas.fora++;
  }
  const meta = ESTACOES[chave];
  const total = linhasResolvidas.length;
  return (
    <li className="space-y-1.5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3">
        <p className="text-sm font-medium">
          {meta.titulo}
          <span className="ml-2 text-xs font-normal text-muted-foreground">
            janela {meta.chipLabel}
          </span>
        </p>
        {contas.fora > 0 && (
          <span className="inline-flex items-center gap-1 text-xs font-medium text-[var(--warn-text)]">
            <Warning size={12} weight="fill" aria-hidden />
            {contas.fora} fora da janela
          </span>
        )}
      </div>
      {chave === "avaliacao_encontro" ? (
        <p className="text-xs text-muted-foreground">
          <strong className="font-semibold text-foreground">
            {feitas} de {realizados}
          </strong>{" "}
          avaliações de encontro respondidas — recorrente, nunca “fecha”
        </p>
      ) : contas.trancada === total ? (
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <LockSimple size={12} aria-hidden />
          Ainda não abriu — a primeira janela é o enc. {meta.encIni}
        </p>
      ) : (
        <>
          <div
            className="flex h-2.5 overflow-hidden rounded-full bg-muted"
            role="img"
            aria-label={`${contas.respondido} feitos, ${contas.pendente} em andamento, ${contas.aberto} a fazer${contas.trancada ? `, ${contas.trancada} ainda não abertas` : ""}`}
          >
            {contas.respondido > 0 && (
              <span
                className="h-full bg-[var(--ok)]"
                style={{ flex: contas.respondido }}
              />
            )}
            {contas.pendente > 0 && (
              <span
                className="h-full bg-[var(--warn)]"
                style={{ flex: contas.pendente }}
              />
            )}
            {contas.aberto > 0 && (
              <span
                className="h-full bg-border"
                style={{ flex: contas.aberto }}
              />
            )}
            {contas.trancada > 0 && (
              <span
                className="h-full bg-muted"
                style={{ flex: contas.trancada }}
              />
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            <strong className="font-semibold text-foreground">
              {contas.respondido}
            </strong>{" "}
            feitos ·{" "}
            <strong className="font-semibold text-foreground">
              {contas.pendente}
            </strong>{" "}
            em andamento ·{" "}
            <strong className="font-semibold text-foreground">
              {contas.aberto}
            </strong>{" "}
            a fazer
            {contas.trancada > 0 && ` · ${contas.trancada} ainda não abriu`}
          </p>
        </>
      )}
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
  /** status + whatsapp do mentor por dupla — o painel agregado não traz
   *  (fatos de jornada apenas); o Lembrar precisa dos dois pra ser honesto
   *  (pausada não recebe nudge; o wa.me só abre com telefone real). */
  duplasInfo: Map<
    string,
    { status: string; mentorWhatsapp: string | null }
  >;
  meuNome: string;
  /** supervisor = escopo supervisionado; a copy explica a diferença. */
  ehSupervisor: boolean;
}) {
  if (!linhas.length) return null;

  const resolvidas: LinhaResolvida[] = linhas.map((linha) => {
    const ctx = painelTurmaCtx(eventos, linha.cronograma_id);
    // a régua "janela aberta / fora da janela" é a da dupla, não só a da
    // coorte — dupla tardia/atrasada tem a janela ainda aberta do lado dela
    const encCorrDupla = Math.min(
      TRILHA_LEN.dpp,
      (linha.avaliacoes_encontro.max_numero ?? 0) + 1
    );
    const estados = estacoesPainelDupla(linha, ctx, encCorrDupla);
    return {
      linha,
      encVigente: ctx.encVigente,
      estados,
      atrasadas: new Set(atrasadasPainel(estados, ctx, encCorrDupla)),
    };
  });

  // KPIs — contagens honestas: pendência é tudo que a janela já abriu e
  // não foi respondido (link vivo, expirado ou nem enviado + avaliação)
  let respondidas = 0;
  let pendencias = 0;
  let foraDaJanela = 0;
  for (const r of resolvidas) {
    for (const chave of ESTACAO_CHAVES) {
      const e = r.estados[chave];
      if (e === "respondido") respondidas++;
      else if (e !== "trancada") pendencias++;
    }
    foraDaJanela += r.atrasadas.size;
  }

  // agrupa por turma (o texto já vem da linha; "Sem turma" defensivo)
  const turmas = new Map<string, LinhaResolvida[]>();
  for (const r of resolvidas) {
    const t = r.linha.turma ?? "Sem turma";
    turmas.set(t, [...(turmas.get(t) ?? []), r]);
  }
  const foraLista = resolvidas.filter((r) => r.atrasadas.size > 0);

  return (
    <section className="space-y-5 rounded-xl bg-card p-4 shadow-[var(--shadow-border)] sm:p-5">
      <div>
        <h2 className="flex items-center gap-2 font-semibold">
          Progresso da jornada
        </h2>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
          {ehSupervisor ? (
            <>
              <strong className="text-foreground">Você vê:</strong> o estado
              de cada instrumento — feito, em andamento, a fazer — nas duplas
              DPP que você supervisiona.{" "}
              <strong className="text-foreground">Você não vê:</strong> o
              conteúdo das respostas, os links, nem duplas de outros
              supervisores. Não há botão de enviar ou preencher — quem
              entrega o instrumento ao jovem é o mentor.
            </>
          ) : (
            <>
              <strong className="text-foreground">Você vê:</strong> o estado
              de cada instrumento de todas as duplas DPP ativas e pausadas.{" "}
              <strong className="text-foreground">Você não vê aqui:</strong>{" "}
              respostas e links — eles ficam na ficha da dupla, que é onde o
              detalhe mora. A ação é lembrar o mentor; quem envia o link ao
              jovem é ele.
            </>
          )}
        </p>
      </div>

      {/* KPIs */}
      <ul className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[
          { n: String(linhas.length), l: "duplas no painel" },
          { n: String(respondidas), l: "estações respondidas" },
          { n: String(pendencias), l: "pendências na janela" },
          { n: String(foraDaJanela), l: "fora da janela do guia" },
        ].map((k) => (
          <li
            key={k.l}
            className="rounded-lg border border-border/70 px-3 py-2.5"
          >
            <p className="text-xl font-bold tabular-nums leading-none">
              {k.n}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">{k.l}</p>
          </li>
        ))}
      </ul>

      {/* progresso por instrumento */}
      <div>
        <h3 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          Por instrumento
        </h3>
        <ul className="mt-2 space-y-3">
          {ESTACAO_CHAVES.map((chave) => (
            <BarraEstacao
              key={chave}
              chave={chave}
              linhasResolvidas={resolvidas}
            />
          ))}
        </ul>
      </div>

      {/* a lista de ação — fora da janela do guia */}
      {foraLista.length > 0 && (
        <div>
          <h3 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--warn-text)]">
            Fora da janela do guia
          </h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            O instrumento não fecha sozinho — vale lembrar o mentor de
            enviar o link na ficha da dupla. A avaliação do encontro é da
            jovem: o link nasce sozinho quando o encontro vira realizado.
          </p>
          <ul className="mt-2 divide-y divide-border/60">
            {foraLista.map((r) => {
              const { linha } = r;
              const info = duplasInfo.get(linha.dupla_id);
              const nudge =
                nudges[linha.dupla_id]?.tipo === "nudge"
                  ? nudges[linha.dupla_id]
                  : null;
              const falta = ESTACAO_CHAVES.filter((c) =>
                r.atrasadas.has(c)
              )
                .map((c) =>
                  c === "avaliacao_encontro"
                    ? `avaliação de encontro (${linha.avaliacoes_encontro.feitas} de ${linha.avaliacoes_encontro.realizados})`
                    : ESTACOES[c].titulo
                )
                .join(" · ");
              const lembrar =
                info?.status === "ativa" ? (
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
                          casoMentor: `A jornada de ${linha.jovem_nome.split(" ")[0]} tem pendências fora da janela do guia (${falta}). O link vai pro jovem pela ficha da dupla.`,
                        }
                      ).mentor ?? ""
                    }
                    href={`/duplas/${linha.dupla_id}`}
                    bloqueadoAte={lembreteBloqueadoAte(nudge)}
                  />
                ) : (
                  <Badge variant="secondary">dupla pausada</Badge>
                );
              return (
                <li
                  key={linha.dupla_id}
                  className="flex flex-wrap items-center gap-x-4 gap-y-2 py-2.5"
                >
                  <div className="min-w-40 flex-1">
                    <p className="text-sm font-medium">
                      {linha.jovem_nome}
                      <span className="ml-2 text-xs font-normal text-muted-foreground">
                        {linha.turma} · enc. {r.encVigente || "—"} · mentor{" "}
                        {linha.mentor_nome}
                      </span>
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {falta}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Link
                      href={`/duplas/${linha.dupla_id}`}
                      className={buttonVariants({
                        variant: "outline",
                        size: "sm",
                      })}
                    >
                      <Eye aria-hidden />
                      Ver ficha
                    </Link>
                    {lembrar}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {/* o retrato por turma — as células de estado por dupla */}
      {[...turmas.entries()].map(([turma, rs]) => (
        <div key={turma}>
          <h3 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            {turma}
            <span className="ml-2 font-normal normal-case tracking-normal">
              · encontro {rs[0]?.encVigente ?? 0} do calendário
            </span>
          </h3>
          <ul className="mt-2 divide-y divide-border/60">
            {rs.map((r) => (
              <li
                key={r.linha.dupla_id}
                className="flex flex-wrap items-center gap-x-4 gap-y-2 py-2.5"
              >
                <div className="min-w-40 flex-1">
                  <p className="text-sm font-medium">{r.linha.jovem_nome}</p>
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
                            : "Aval. —"
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

      {/* legenda */}
      <p className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-border/60 pt-3 text-[11px] text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <Check size={11} weight="bold" className="text-[var(--ok-text)]" aria-hidden />
          respondido
        </span>
        <span className="inline-flex items-center gap-1">
          <Clock size={11} className="text-[var(--warn-text)]" aria-hidden />
          link enviado, aguardando
        </span>
        <span className="inline-flex items-center gap-1">
          <CircleDashed size={11} aria-hidden />
          a fazer / link expirado
        </span>
        <span className="inline-flex items-center gap-1">
          <LockSimple size={11} aria-hidden />
          ainda não abriu na turma
        </span>
        <span className="inline-flex items-center gap-1">
          <Warning size={11} weight="fill" className="text-[var(--warn-text)]" aria-hidden />
          fora da janela do guia
        </span>
      </p>
    </section>
  );
}
