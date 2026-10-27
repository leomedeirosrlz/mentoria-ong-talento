import Link from "next/link";
import { Check, Clock, Eye, LockSimple, Warning } from "@phosphor-icons/react/dist/ssr";
import {
  EnviarDesfechoLote,
  EnviarInstrumentoLote,
  type DuplaLote,
} from "@/components/enviar-instrumento-lote";
import { LembreteButton } from "@/components/lembrete-button";
import {
  InstrumentoEmblema,
  type InstrumentoChave,
} from "@/components/instrumento-icone";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import type { FormularioSistema } from "@/lib/forms/schema";
import {
  agrupaPorTurma,
  elegiveisLote,
  ESTACAO_CHAVES,
  ESTACOES,
  liberaCopia,
  resolveLinhasPainel,
  SISTEMA_DA_ESTACAO,
  type EstacaoChave,
  type LinhaResolvida,
  type PainelJornadaLinha,
} from "@/lib/jornada";
import { lembreteBloqueadoAte } from "@/lib/ciclo";
import type { Interacao } from "@/lib/interacoes";
import { turmaCurta } from "@/lib/turma";
import type { CicloEvento } from "@/lib/types";
import { cn } from "@/lib/utils";

// Aba "Instrumentos" de /materiais: a régua oficial da jornada DPP — os 7
// instrumentos da régua + a avaliação por terceiros (0103), que não é
// formulário `sistema` mas é instrumento do programa (o "quem disse o quê"
// nunca aparece: o consolidado anonimizado mora na ficha). Pra staff cada
// card resume a coorte em 3 estados (responderam · aguardando · atrasados)
// e a lista abaixo é a única fila de ação: jovem com instrumento fora do
// prazo do guia, lembrado direto (o link já está na jornada dele, emitido
// sozinho — 0099). O estado fino por dupla (link enviado, expirado…) mora
// na ficha. Coord envia em lote e abre as respostas; o mentor vê o
// catálogo com o atalho pra ficha.

type Papel = "coordenacao" | "supervisor" | "mentor";

type CardSpec = {
  chave: InstrumentoChave;
  titulo: string;
  descricao: string;
  /** chips do momento do guia (ex.: "Enc. 1"). */
  chips: string[];
  /** estação da régua quando o card é um dos 7 — ativa estado/lote. */
  estacao?: EstacaoChave;
  /** formulario.sistema pra "Ver respostas" — avaliacao_encontro e
   *  terceiros não têm página de respostas (o detalhe é por dupla). */
  sistemaForm?: FormularioSistema;
};

const CARDS: CardSpec[] = [
  {
    chave: "avaliacao_terceiros",
    titulo: "Avaliação por terceiros",
    descricao:
      "Amigos e família respondem 2 perguntas; o programa consolida sem mostrar quem disse o quê. O mentor convida as pessoas.",
    chips: ["Antes do enc. 1", "Devolutiva enc. 2"],
  },
  {
    chave: "roda_inicial",
    titulo: ESTACOES.roda_inicial.titulo,
    descricao:
      "Satisfação 1–10 nas 16 áreas da vida: o ponto de partida que a aplicação formal compara.",
    chips: ["Enc. 1"],
    estacao: "roda_inicial",
    sistemaForm: "roda_vida",
  },
  {
    chave: "visao",
    titulo: ESTACOES.visao.titulo,
    descricao:
      "5 perguntas pra imaginar o futuro. Vira a Declaração de Visão no topo do PDM.",
    chips: ["Enc. 1–4"],
    estacao: "visao",
    sistemaForm: "visao",
  },
  {
    chave: "metas",
    titulo: ESTACOES.metas.titulo,
    descricao:
      "3–5 metas com o porquê de cada uma; a dupla revisa com o modelo SMART.",
    chips: ["Enc. 2–3"],
    estacao: "metas",
    sistemaForm: "metas",
  },
  {
    chave: "pdm",
    titulo: ESTACOES.pdm.titulo,
    descricao:
      "Documento vivo: Visão no topo, metas com indicador de sucesso e prazo, mapa de submetas.",
    chips: ["Construir 1–4", "Revisar enc. 9"],
    estacao: "pdm",
    sistemaForm: "pdm",
  },
  {
    chave: "avaliacao_encontro",
    titulo: ESTACOES.avaliacao_encontro.titulo,
    descricao:
      "Nota de 1 a 5 + comentário depois de cada encontro. O link nasce sozinho quando o encontro vira realizado.",
    chips: ["Todo encontro"],
    estacao: "avaliacao_encontro",
  },
  {
    chave: "roda_formal",
    titulo: ESTACOES.roda_formal.titulo,
    descricao:
      "O jovem refaz as 16 notas e a dupla vê o antes e o depois sobre a leitura inicial.",
    chips: ["Enc. 12–14"],
    estacao: "roda_formal",
    sistemaForm: "roda_vida",
  },
  {
    chave: "avaliacao_360",
    titulo: "Avaliação 360º e autoavaliação",
    descricao:
      "O fechamento do ciclo: como o jovem se vê e como te veem. Marca o checklist de encerramento.",
    chips: ["Enc. 16"],
    estacao: "avaliacao_360",
    sistemaForm: "avaliacao_360",
  },
];

/** Estado do card: "ainda não abriu" enquanto nenhuma turma alcançou o
 *  encontro de abertura (o card fica esmaecido e a ação vira a data de
 *  liberação por turma); "liberado" quando ao menos uma turma já chegou.
 *  A avaliação do encontro é recorrente: a tag diz o formato, não o estado. */
function TagEstado({
  trancado,
  recorrente = false,
}: {
  trancado: boolean;
  recorrente?: boolean;
}) {
  if (trancado) {
    return (
      <Badge
        variant="outline"
        className="bg-muted text-xs font-medium text-muted-foreground"
      >
        <LockSimple data-icon="inline-start" size={11} aria-hidden />
        ainda não abriu
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="text-xs font-medium">
      {recorrente ? "a cada encontro" : "liberado"}
    </Badge>
  );
}


/** Os 3 estados da coorte num instrumento — o resto (enviado × expirado ×
 *  a fazer) é detalhe de ficha. Atrasado ganha de aguardando. */
function contas(resolvidas: LinhaResolvida[], chave: EstacaoChave) {
  let responderam = 0;
  let aguardando = 0;
  let atrasados = 0;
  for (const r of resolvidas) {
    const e = r.estados[chave];
    if (e === "trancada") continue;
    if (r.atrasadas.has(chave)) atrasados++;
    else if (e === "respondido") responderam++;
    else aguardando++;
  }
  return { responderam, aguardando, atrasados };
}

function LinhaEstados({
  resolvidas,
  chave,
}: {
  resolvidas: LinhaResolvida[];
  chave: EstacaoChave;
}) {
  const c = contas(resolvidas, chave);
  // a avaliação do encontro é recorrente: o retrato é avaliações feitas
  // sobre encontros realizados, não duplas
  const recorrente = chave === "avaliacao_encontro";
  const feitas = resolvidas.reduce(
    (n, r) => n + r.linha.avaliacoes_encontro.feitas,
    0
  );
  const realizados = resolvidas.reduce(
    (n, r) => n + r.linha.avaliacoes_encontro.realizados,
    0
  );
  return (
    <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
      {recorrente ? (
        <span className="inline-flex items-center gap-1">
          <Check size={12} weight="bold" aria-hidden className="text-[var(--ok-text)]" />
          <b className="font-semibold tabular-nums">{feitas}</b> de {realizados} avaliados
        </span>
      ) : (
        <>
          <span className="inline-flex items-center gap-1">
            <Check size={12} weight="bold" aria-hidden className="text-[var(--ok-text)]" />
            <b className="font-semibold tabular-nums">{c.responderam}</b> responderam
          </span>
          <span className="inline-flex items-center gap-1 text-muted-foreground">
            <Clock size={12} aria-hidden />
            <b className="font-semibold tabular-nums text-foreground">{c.aguardando}</b> aguardando
          </span>
        </>
      )}
      {c.atrasados > 0 && (
        <span className="inline-flex items-center gap-1 text-[var(--warn-text)]">
          <Warning size={12} weight="fill" aria-hidden />
          <b className="font-semibold tabular-nums">{c.atrasados}</b>{" "}
          {c.atrasados === 1 ? "atrasado" : "atrasados"}
        </span>
      )}
    </p>
  );
}

/** Linha da fila "atrasados": quem é, o que falta, e o lembrete direto
 *  pro jovem — o link mora na jornada dele, não depende do mentor. */
function LinhaAtrasado({
  r,
  info,
  nudge,
  meuNome,
}: {
  r: LinhaResolvida;
  info: { status: string; jovemWhatsapp: string | null } | undefined;
  nudge: Interacao | null;
  meuNome: string;
}) {
  const { linha } = r;
  const nomes = ESTACAO_CHAVES.filter((c) => r.atrasadas.has(c)).map((c) =>
    c === "avaliacao_encontro"
      ? "avaliação do encontro"
      : ESTACOES[c].titulo
  );
  const primeiro = linha.jovem_nome.split(" ")[0];
  const turma = linha.turma ? turmaCurta(linha.turma) : null;
  const lista =
    nomes.length === 1
      ? nomes[0]
      : `${nomes.slice(0, -1).join(", ")} e ${nomes[nomes.length - 1]}`;
  const eu = meuNome.split(" ")[0];
  return (
    <li className="flex flex-wrap items-center gap-x-4 gap-y-2 py-2.5">
      <div className="min-w-40 flex-1">
        <p className="text-sm font-medium">
          {linha.jovem_nome}
          <span className="ml-2 text-xs font-normal text-muted-foreground">
            {[turma, `mentor ${linha.mentor_nome}`].filter(Boolean).join(" · ")}
          </span>
        </p>
        <p className="mt-0.5 text-xs text-muted-foreground">{lista}</p>
      </div>
      <div className="flex items-center gap-2">
        <Link
          href={`/duplas/${linha.dupla_id}#instrumentos`}
          className={buttonVariants({ variant: "ghost", size: "sm" })}
        >
          Ver ficha
        </Link>
        {info?.status === "ativa" ? (
          <LembreteButton
            duplaId={linha.dupla_id}
            destino="mentorado"
            rotulo={`Lembrar ${primeiro}`}
            telefone={info.jovemWhatsapp}
            titulo="Sua jornada tem atividade esperando"
            corpo={`Oi ${primeiro}, tudo bem? Aqui é ${eu}, da equipe do Realiza.vc. ${
              nomes.length === 1 ? "Uma atividade" : "Algumas atividades"
            } da sua jornada ${nomes.length === 1 ? "está" : "estão"} esperando por você: ${lista}. É só abrir Minha jornada no app.`}
            href="/jovem/materiais"
            bloqueadoAte={lembreteBloqueadoAte(nudge)}
          />
        ) : (
          <Badge variant="secondary">dupla pausada</Badge>
        )}
      </div>
    </li>
  );
}

export function InstrumentosPrograma({
  papel,
  linhas,
  eventos,
  duplasInfo,
  formIds,
  envioLiberado,
  desfechoElegiveis = [],
  fichasMentor = [],
  nudges = {},
  meuNome = "",
}: {
  papel: Papel;
  /** as mesmas linhas do painel — vazio pro mentor (o painel é staff-only;
   *  o card dele vira catálogo sem estado agregado). */
  linhas: PainelJornadaLinha[];
  eventos: CicloEvento[];
  /** flags de e-mail das duplas — só a prévia do lote usa (coord). */
  duplasInfo: Map<
    string,
    {
      status: string;
      jovemWhatsapp: string | null;
      jovemTemEmail: boolean;
      mentorTemEmail: boolean;
    }
  >;
  /** sistema → id do formulário oficial (getFormularios) — monta o
   *  "Ver respostas"; vazio pra não-coord (RLS do form é coord-only). */
  formIds: Map<FormularioSistema, string>;
  envioLiberado: boolean;
  /** a fila do "Depois da mentoria · 6 meses" — concluídas há ≥180 dias
   *  sem link 6m (desfecho_elegiveis_6m, 0124); só preenchida pra coord. */
  desfechoElegiveis?: DuplaLote[];
  /** mentor: as duplas DPP vivas dele — o rodapé linka cada ficha. */
  fichasMentor?: { id: string; jovemNome: string }[];
  /** último nudge por dupla — o cap de 48h do Lembrar. */
  nudges?: Record<string, Interacao>;
  meuNome?: string;
}) {
  const ehCoord = papel === "coordenacao";
  const resolvidas = resolveLinhasPainel(linhas, eventos);
  const grupos = agrupaPorTurma(resolvidas);
  const temEscopo = resolvidas.length > 0;
  const atrasados = resolvidas
    .filter((r) => r.atrasadas.size > 0)
    .sort(
      (a, b) =>
        b.atrasadas.size - a.atrasadas.size ||
        a.linha.jovem_nome.localeCompare(b.linha.jovem_nome, "pt-BR")
    );

  return (
    <section aria-labelledby="instrumentos-titulo" className="space-y-3">
      <h2 id="instrumentos-titulo" className="text-base font-semibold">
        Instrumentos do programa
      </h2>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {CARDS.map((card) => {
          const estacao = card.estacao;
          // trancado = TODA a coorte abaixo do encIni (sem linhas — mentor —
          // nunca tranca: o card é catálogo, não espelho de janela)
          const trancado =
            temEscopo &&
            estacao != null &&
            estacao !== "avaliacao_encontro" &&
            resolvidas.every((r) => r.estados[estacao] === "trancada");
          const sistemaLote = estacao ? SISTEMA_DA_ESTACAO[estacao] : null;
          const elegiveis =
            ehCoord && sistemaLote && temEscopo && estacao != null
              ? elegiveisLote(resolvidas, estacao, duplasInfo)
              : [];
          const formId = card.sistemaForm
            ? formIds.get(card.sistemaForm)
            : undefined;
          // REALIZA-233: o card inteiro abre as respostas — stretched link
          // cobre o article e a linha de ações sobe com relative pra seguir
          // clicável. Só onde há página de respostas (coord + form ativo).
          const verRespostas = ehCoord && formId && !trancado;

          return (
            <article
              key={card.chave}
              className={cn(
                "relative flex flex-col gap-2.5 rounded-xl bg-card p-3.5 shadow-[var(--shadow-border)]",
                verRespostas &&
                  "transition-shadow hover:shadow-[var(--shadow-border-hover)]"
              )}
            >
              {verRespostas && (
                <Link
                  href={`/formularios/${formId}`}
                  aria-label={`Ver respostas — ${card.titulo}`}
                  className="absolute inset-0 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              )}
              <div className="flex items-start gap-2.5">
                <InstrumentoEmblema
                  instrumento={card.chave}
                  trancado={trancado}
                />
                <div className="min-w-0">
                  <h3
                    className={cn(
                      "text-sm font-semibold leading-snug",
                      trancado && "text-muted-foreground"
                    )}
                  >
                    {card.titulo}
                  </h3>
                  <p className="mt-1 flex flex-wrap items-center gap-1.5">
                    {card.chips.map((chip) => (
                      <span
                        key={chip}
                        className="rounded-md bg-muted px-1.5 py-0.5 text-xs font-medium text-muted-foreground sm:text-[11px]"
                      >
                        {chip}
                      </span>
                    ))}
                    {temEscopo && estacao && (
                      <TagEstado
                        trancado={trancado}
                        recorrente={estacao === "avaliacao_encontro"}
                      />
                    )}
                  </p>
                </div>
              </div>
              <p className="text-xs leading-relaxed text-muted-foreground">
                {card.descricao}
              </p>
              {temEscopo && estacao && !trancado && (
                <LinhaEstados resolvidas={resolvidas} chave={estacao} />
              )}

              {/* ações do papel — a data de liberação é leitura pública do
                  programa (todo staff a vê); emitir em lote e ler respostas
                  seguem coord-only; o mentor tem o deep link da ficha */}
              {(trancado && estacao) ||
              ehCoord ||
              (papel === "mentor" && fichasMentor.length > 0) ? (
                <div className="relative mt-auto flex flex-wrap items-center gap-2 pt-1">
                  {trancado && estacao ? (
                    <span className="inline-flex items-center gap-1.5 rounded-md bg-muted px-2 py-1 text-xs font-medium text-muted-foreground">
                      <LockSimple size={12} aria-hidden />
                      {liberaCopia(estacao, grupos)}
                    </span>
                  ) : ehCoord ? (
                    sistemaLote ? (
                      elegiveis.length > 0 ? (
                        <EnviarInstrumentoLote
                          sistema={sistemaLote}
                          estacaoTitulo={card.titulo}
                          linhas={elegiveis}
                          envioLiberado={envioLiberado}
                          contador={elegiveis.length}
                        />
                      ) : (
                        <span className="text-xs text-muted-foreground">
                          {temEscopo
                            ? "Nada a enviar agora: as duplas já receberam ou já responderam."
                            : "Sem duplas no escopo ainda."}
                        </span>
                      )
                    ) : estacao === "avaliacao_encontro" ||
                      card.chave === "avaliacao_terceiros" ? (
                      <Link
                        href="/duplas"
                        className={buttonVariants({
                          variant: "outline",
                          size: "sm",
                        })}
                      >
                        <Eye aria-hidden />
                        Ver por dupla
                      </Link>
                    ) : (
                      // 360º — a emissão é manual de encerramento, por dupla
                      <span className="text-xs text-muted-foreground">
                        A coordenação emite na ficha de cada dupla.
                      </span>
                    )
                  ) : null}
                  {/* "Ver respostas" virou o próprio card (stretched link
                      acima) — a ação explícita saía daqui (REALIZA-233) */}
                  {/* mentor — deep link pra seção de instrumentos da ficha
                      de cada dupla dele; com várias duplas, um link por
                      ficha rotulado pelo nome do jovem */}
                  {papel === "mentor" && fichasMentor.length === 1 && (
                    <Link
                      href={`/duplas/${fichasMentor[0]!.id}#instrumentos`}
                      className={buttonVariants({
                        variant: "outline",
                        size: "sm",
                      })}
                    >
                      <Eye aria-hidden />
                      Na ficha
                    </Link>
                  )}
                  {papel === "mentor" &&
                    fichasMentor.length > 1 &&
                    fichasMentor.map((f) => (
                      <Link
                        key={f.id}
                        href={`/duplas/${f.id}#instrumentos`}
                        className="text-xs font-medium underline underline-offset-2 hover:text-foreground"
                      >
                        {f.jovemNome}
                      </Link>
                    ))}
                </div>
              ) : null}
            </article>
          );
        })}
        {/* desfecho (0124): o card do 6 meses é coord-only — a régua é o
            tempo de conclusão, não a janela do guia, e a emissão é gesto
            humano em lote (nunca automático) */}
        {ehCoord && (
          <article
            className={cn(
              "relative flex flex-col gap-2.5 rounded-xl bg-card p-3.5 shadow-[var(--shadow-border)]",
              formIds.get("desfecho") &&
                "transition-shadow hover:shadow-[var(--shadow-border-hover)]"
            )}
          >
            {formIds.get("desfecho") && (
              <Link
                href={`/formularios/${formIds.get("desfecho")}`}
                aria-label="Ver respostas — Depois da mentoria · 6 meses"
                className="absolute inset-0 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            )}
            <div className="flex items-start gap-2.5">
              <InstrumentoEmblema instrumento="desfecho" />
              <div className="min-w-0">
                <h3 className="text-sm font-semibold leading-snug">
                  Depois da mentoria · 6 meses
                </h3>
                <p className="mt-1 flex flex-wrap items-center gap-1.5">
                  <span className="rounded-md bg-muted px-1.5 py-0.5 text-xs font-medium text-muted-foreground sm:text-[11px]">
                    6 meses depois
                  </span>
                  <Badge variant="outline" className="text-xs font-medium">
                    sob demanda
                  </Badge>
                </p>
              </div>
            </div>
            <p className="text-xs leading-relaxed text-muted-foreground">
              O jovem conta como está depois da jornada: estudando,
              trabalhando ou empreendendo. Vai pra quem concluiu há pelo
              menos 6 meses e ainda não respondeu.
            </p>
            <div className="relative mt-auto flex flex-wrap items-center gap-2 pt-1">
              {desfechoElegiveis.length > 0 ? (
                <EnviarDesfechoLote
                  linhas={desfechoElegiveis}
                  envioLiberado={envioLiberado}
                  contador={desfechoElegiveis.length}
                />
              ) : (
                <span className="text-xs text-muted-foreground">
                  Nenhuma dupla chegou aos 6 meses sem resposta.
                </span>
              )}
            </div>
          </article>
        )}
      </div>
      {atrasados.length > 0 && (
        <section
          aria-labelledby="atrasados-titulo"
          className="rounded-xl bg-card px-4 pt-3.5 pb-1.5 shadow-[var(--shadow-border)] sm:px-5"
        >
          <h3 id="atrasados-titulo" className="text-sm font-semibold">
            Atrasados no prazo do guia
            <span className="ml-1.5 font-normal text-muted-foreground">
              {atrasados.length}
            </span>
          </h3>
          <ul className="mt-1 divide-y divide-border/60">
            {atrasados.map((r) => (
              <LinhaAtrasado
                key={r.linha.dupla_id}
                r={r}
                info={duplasInfo.get(r.linha.dupla_id)}
                nudge={
                  nudges[r.linha.dupla_id]?.tipo === "nudge"
                    ? nudges[r.linha.dupla_id]!
                    : null
                }
                meuNome={meuNome}
              />
            ))}
          </ul>
        </section>
      )}
      {/* mentor: o estado e o envio ficam na ficha da dupla — o rodapé linka
          direto em vez de reimplementar estado/ação aqui */}
      {papel === "mentor" && fichasMentor.length > 0 && (
        <p className="text-xs leading-relaxed text-muted-foreground">
          Estado e envio por dupla na ficha:{" "}
          {fichasMentor.map((f, i) => (
            <span key={f.id}>
              {i > 0 && " · "}
              <Link
                href={`/duplas/${f.id}#instrumentos`}
                className="font-medium underline underline-offset-2 hover:text-foreground"
              >
                {f.jovemNome}
              </Link>
            </span>
          ))}
        </p>
      )}
      {/* coord-only: intakes, avaliação da trilha e desfecho moram em /formularios */}
      {ehCoord && (
        <p className="text-xs leading-relaxed text-muted-foreground">
          Intakes, avaliação da trilha e desfecho ficam em{" "}
          <Link
            href="/formularios"
            className="font-medium underline underline-offset-2 hover:text-foreground"
          >
            Formulários
          </Link>
          .
        </p>
      )}
    </section>
  );
}
