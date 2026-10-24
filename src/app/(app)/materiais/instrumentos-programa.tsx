import Link from "next/link";
import { Eye, LockSimple } from "@phosphor-icons/react/dist/ssr";
import { EnviarInstrumentoLote } from "@/components/enviar-instrumento-lote";
import {
  InstrumentoEmblema,
  instrumentoVars,
  type InstrumentoChave,
} from "@/components/instrumento-icone";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import type { FormularioSistema } from "@/lib/forms/schema";
import {
  agrupaPorTurma,
  elegiveisLote,
  ESTACOES,
  liberaCopia,
  resolveLinhasPainel,
  SISTEMA_DA_ESTACAO,
  type EstacaoChave,
  type PainelJornadaLinha,
} from "@/lib/jornada";
import type { CicloEvento } from "@/lib/types";
import { cn } from "@/lib/utils";

// REALIZA-194 (v5c) — "Instrumentos do programa": a régua oficial da
// jornada DPP, separada da biblioteca (guias/modelos/links continuam na
// seção de baixo). São os 8 cards do mock na ordem de jornada — os 7
// instrumentos da régua + a avaliação por terceiros (0103), que não é
// formulário `sistema` mas é instrumento do programa (o "quem disse o
// quê" nunca aparece: o consolidado anonimizado mora na ficha).
//
// Os estados são agregados das MESMAS linhas do painel (resolveLinhas-
// Painel + estacoesPainelDupla) — janela aberta × trancado com a data de
// liberação por turma, deduplicados: a contagem "x de y" fica na faixa do
// painel, o card carrega janela, estado e a ação do papel. Coord envia
// em lote nas 5 estações emissíveis (roda inicial e formal dividem
// `roda_vida` — o momento certo por dupla é o que o core resolve) e abre
// as respostas no formulário oficial; supervisor e mentor veem o catálogo
// (estado/ação por dupla fica na ficha — sem reimplementar a ficha aqui).

type Papel = "coordenacao" | "supervisor" | "mentor";

type CardSpec = {
  chave: InstrumentoChave;
  titulo: string;
  descricao: string;
  /** chips da janela do guia (a linha .jw do mock). */
  chips: string[];
  /** estação da régua quando o card é um dos 7 — ativa estado/lote. */
  estacao?: EstacaoChave;
  /** formulario.sistema pra "Ver respostas" — avaliacao_encontro e
   *  terceiros não têm página de respostas (o detalhe é por dupla). */
  sistemaForm?: FormularioSistema;
};

const CARDS: CardSpec[] = [
  {
    chave: "roda_inicial",
    titulo: ESTACOES.roda_inicial.titulo,
    descricao:
      "Satisfação 1–10 nas 16 áreas da vida — o ponto de partida que a aplicação formal compara.",
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
    chave: "avaliacao_terceiros",
    titulo: "Avaliação por terceiros",
    descricao:
      "Amigos e família respondem 2 perguntas; o programa consolida sem mostrar quem disse o quê. O mentor convida as pessoas.",
    chips: ["Antes do enc. 1", "Devolutiva enc. 2"],
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
      "O jovem refaz as 16 notas e a dupla vê o antes × depois sobre a leitura inicial.",
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

/** A linha de estado do card — a tag da janela (.jw do mock): "janela
 *  aberta" quando ao menos uma turma já alcançou o encIni, "trancado"
 *  quando nenhuma alcançou (aí o card esmaece e a ação vira a data de
 *  liberação por turma). A avaliação do encontro é recorrente — não tranca
 *  e não tem "janela": a tag dela diz o formato, não o estado. */
function TagJanela({
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
        className="border-transparent bg-muted text-[11px] font-semibold text-muted-foreground"
      >
        <LockSimple data-icon="inline-start" size={11} aria-hidden />
        trancado
      </Badge>
    );
  }
  if (recorrente) {
    return (
      <Badge className="bg-[var(--ok)]/15 text-[11px] font-semibold text-[var(--ok-text)]">
        recorrente
      </Badge>
    );
  }
  return (
    <Badge className="bg-[var(--ok)]/15 text-[11px] font-semibold text-[var(--ok-text)]">
      janela aberta
    </Badge>
  );
}

export function InstrumentosPrograma({
  papel,
  linhas,
  eventos,
  duplasInfo,
  formIds,
  envioLiberado,
  fichasMentor = [],
}: {
  papel: Papel;
  /** as mesmas linhas do painel — vazio pro mentor (o painel é staff-only;
   *  o card dele vira catálogo sem estado agregado). */
  linhas: PainelJornadaLinha[];
  eventos: CicloEvento[];
  /** flags de e-mail/status das duplas — só a prévia do lote usa (coord). */
  duplasInfo: Map<
    string,
    { jovemTemEmail: boolean; mentorTemEmail: boolean }
  >;
  /** sistema → id do formulário oficial (getFormularios) — monta o
   *  "Ver respostas"; vazio pra não-coord (RLS do form é coord-only). */
  formIds: Map<FormularioSistema, string>;
  envioLiberado: boolean;
  /** mentor: as duplas DPP vivas dele — o rodapé linka cada ficha (o
   *  estado por instrumento continua lá, não duplicamos as ações). */
  fichasMentor?: { id: string; jovemNome: string }[];
}) {
  const ehCoord = papel === "coordenacao";
  const resolvidas = resolveLinhasPainel(linhas, eventos);
  const grupos = agrupaPorTurma(resolvidas);
  const temEscopo = resolvidas.length > 0;

  return (
    <section aria-labelledby="instrumentos-titulo">
      <h2 id="instrumentos-titulo" className="font-semibold">
        Instrumentos do programa
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        {ehCoord
          ? "Os instrumentos oficiais da jornada DPP. Cada um entra num encontro-alvo do guia — antes da janela abrir fica trancado com a data de liberação."
          : "Os instrumentos oficiais da jornada DPP — o que cada um é e quando entra. Estado e envio por dupla ficam na ficha dela."}
      </p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {CARDS.map((card) => {
          const estacao = card.estacao;
          // trancado = TODA a coorte abaixo do encIni (sem linhas — mentor —
          // nunca tranca: o card é catálogo, não espelho de janela)
          const trancado =
            temEscopo &&
            estacao != null &&
            estacao !== "avaliacao_encontro" &&
            resolvidas.every(
              (r) => r.estados[estacao] === "trancada"
            );
          const sistemaLote = estacao ? SISTEMA_DA_ESTACAO[estacao] : null;
          const elegiveis =
            ehCoord && sistemaLote && temEscopo && estacao != null
              ? elegiveisLote(resolvidas, estacao, duplasInfo)
              : [];
          const formId = card.sistemaForm
            ? formIds.get(card.sistemaForm)
            : undefined;

          return (
            <article
              key={card.chave}
              style={{
                ...instrumentoVars(card.chave),
                borderTopColor: trancado
                  ? "var(--border)"
                  : "var(--ic)",
              }}
              className={cn(
                "flex flex-col gap-2 rounded-xl border border-border/70 border-t-[3px] bg-card p-3.5",
                trancado && "bg-muted/40"
              )}
            >
              <div className="flex items-start gap-2.5">
                <InstrumentoEmblema
                  instrumento={card.chave}
                  trancado={trancado}
                />
                <div className="min-w-0">
                  <h3
                    className={cn(
                      "text-sm font-semibold leading-snug tracking-tight",
                      trancado && "text-muted-foreground"
                    )}
                  >
                    {card.titulo}
                  </h3>
                  <p className="mt-1 flex flex-wrap items-center gap-1.5">
                    {card.chips.map((chip) => (
                      <span
                        key={chip}
                        className="rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground"
                      >
                        {chip}
                      </span>
                    ))}
                    {/* estado da janela — só com o retrato do escopo (a
                        avaliação do encontro é recorrente: nunca tranca e
                        a tag diz "recorrente", não "janela aberta") */}
                    {temEscopo && estacao && (
                      <TagJanela
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

              {/* ações do papel — a data de liberação é leitura pública do
                  programa (todo staff a vê, não só a coord); emitir em lote
                  e ler respostas seguem coord-only; o mentor tem o deep
                  link pra ficha de cada dupla dele */}
              {(trancado && estacao) ||
              ehCoord ||
              (papel === "mentor" && fichasMentor.length > 0) ? (
                <div className="mt-auto flex flex-wrap items-center gap-2 pt-1">
                  {trancado && estacao ? (
                    // a convenção "desabilitado explica o porquê": o pill
                    // carrega a data de liberação por turma
                    <span className="inline-flex items-center gap-1.5 rounded-md bg-muted px-2 py-1 text-[11px] font-semibold text-muted-foreground">
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
                        <span className="text-[11px] text-muted-foreground">
                          {temEscopo
                            ? "Nada a enviar agora — as duplas já receberam ou já responderam."
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
                      <span className="text-[11px] text-muted-foreground">
                        A coordenação emite na ficha de cada dupla.
                      </span>
                    )
                  ) : null}
                  {ehCoord && formId && !trancado && (
                    <Link
                      href={`/formularios/${formId}`}
                      className={buttonVariants({
                        variant: "outline",
                        size: "sm",
                      })}
                    >
                      <Eye aria-hidden />
                      Ver respostas
                    </Link>
                  )}
                  {/* mentor — deep link pra seção de instrumentos da ficha
                      de cada dupla dele; com várias duplas, um link por
                      ficha rotulado pelo nome do jovem */}
                  {papel === "mentor" &&
                    fichasMentor.length === 1 && (
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
                        className="text-[11px] font-medium underline underline-offset-2 hover:text-foreground"
                      >
                        {f.jovemNome}
                      </Link>
                    ))}
                </div>
              ) : null}
            </article>
          );
        })}
      </div>
      {/* mentor: a ficha continua sendo a casa do instrumento por dupla —
          o rodapé linka direto em vez de reimplementar estado/ação aqui
          (decisão do plano: deep link, não duplicação) */}
      {papel === "mentor" && fichasMentor.length > 0 && (
        <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
          O estado e o envio de cada instrumento ficam na ficha da dupla:{" "}
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
      {/* coord-only: os forms de bordo (anamnese, intakes, autoavaliação)
          moram em /formularios — a régua aqui é só dos instrumentos da
          jornada */}
      {ehCoord && (
        <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
          Anamnese, intakes e autoavaliação ficam em{" "}
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
