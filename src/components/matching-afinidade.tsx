"use client";

import Link from "next/link";
import { useState } from "react";
import { CaretDown, Check, Warning } from "@phosphor-icons/react";
import { Collapsible } from "@base-ui/react/collapsible";
import {
  celulasComuns,
  celulasDe,
  disponibilidadeTexto,
  COR_RACA_LABELS,
  DIAS_SEMANA,
  DIAS_SEMANA_CURTOS,
  DIAS_SEMANA_LABELS,
  ESCOLARIDADE_LABELS,
  GENERO_LABELS,
  idade,
  PERIODOS,
  PERIODOS_LABELS,
} from "@/lib/ciclo";
import type {
  CorRaca,
  Disponibilidade,
  Escolaridade,
  Genero,
  PrefGeneroPar,
  Trilha,
} from "@/lib/types";
import { cn, normaliza } from "@/lib/utils";

// Board de afinidade da coordenação (modo "Parear" do card Aguardando par
// em /pessoas) e painel embutido no NovaDuplaDialog. Os campos sensíveis
// (gênero, cor/raça, preferência de par, motivação) chegam já mergeados
// pelas views *_pessoal — só a coordenação recebe valor; fora dela vêm
// null e o painel simplesmente omite.
//
// Hierarquia (review out/2026): a primeira vista responde três perguntas —
// o que RESTRINGE o par, o que APROXIMA e por que ele foi sugerido. Nada
// de score artificial: só evidência que cruza. O inventário de cada lado
// (meta, agendas inteiras, interesses, motivações) vai no "Ver detalhes",
// em duas colunas comparáveis.

export type LadoAfinidade = {
  /** alimenta o link "Regularizar" da restrição de documento */
  id?: string;
  nome: string;
  interesses: string[] | null | undefined;
  cidade?: string | null;
  uf?: string | null;
  genero: Genero | null;
  cor_raca?: CorRaca | null;
  pref_genero_par: PrefGeneroPar | null;
  motivacao: string | null;
};

/** Documento do jovem pro pareamento, do resumo de assinaturas +
 *  documento_path (mesma regra de pendênciasMentorado). `null` = o
 *  chamador não tem o resumo à mão (NovaDuplaDialog) — a restrição cai
 *  no texto genérico. */
export type DocJovemStatus = "assinado" | "enviado" | "nao_emitido";

const primeiroNome = (n: string) => n.split(" ")[0];

/** Interesses que batem dos dois lados — comparados normalizados (caixa/
 *  acento), destacados com a grafia original de cada lista. */
function emComum(a: string[], b: string[]): Set<string> {
  const nb = new Set(b.map(normaliza));
  return new Set(a.filter((i) => nb.has(normaliza(i))).map(normaliza));
}

type Restricao = { nivel: "alerta" | "info"; texto: string; href?: string };

/** Preferência de gênero de um lado contra o gênero informado do outro.
 *  `papel` diz quem prefere (mentorado prefere "mentora"; mentor prefere
 *  "mentorada"). null/indiferente não gera nada; gênero ausente ou
 *  "prefiro não dizer" vira nota discreta, não alarme. */
function restricaoGenero(
  quem: LadoAfinidade,
  outro: LadoAfinidade,
  papel: "mentor" | "mentorado"
): Restricao | null {
  const pref = quem.pref_genero_par;
  if (!pref || pref === "indiferente") return null;
  const rotulo =
    papel === "mentorado"
      ? pref === "feminino"
        ? "mentora"
        : "mentor"
      : pref === "feminino"
        ? "mentorada"
        : "mentorado";
  const nomeQuem = primeiroNome(quem.nome);
  const nomeOutro = primeiroNome(outro.nome);
  const g = outro.genero;
  if (!g || g === "prefiro_nao_dizer") {
    return {
      nivel: "info",
      texto: `${nomeQuem} prefere ${rotulo}. ${nomeOutro} ${
        g === "prefiro_nao_dizer"
          ? "preferiu não informar o gênero"
          : "não informou o gênero"
      }. Confirme antes de formar.`,
    };
  }
  if (g !== pref) {
    return {
      nivel: "alerta",
      texto: `${nomeQuem} prefere ${rotulo}. ${nomeOutro} se cadastrou com gênero “${GENERO_LABELS[g].toLocaleLowerCase("pt-BR")}”.`,
    };
  }
  return null;
}

/** true quando a preferência explícita de um lado bate com o gênero do
 *  outro — sinal positivo, vira evidência de compatibilidade. */
function prefAtendida(quem: LadoAfinidade, outro: LadoAfinidade): boolean {
  const pref = quem.pref_genero_par;
  return Boolean(
    pref && pref !== "indiferente" && outro.genero === pref
  );
}

const local = (l: LadoAfinidade) =>
  [l.cidade, l.uf].filter(Boolean).join("/");

/** Cor/raça como declarado — "prefiro não dizer" não é informação de
 *  matching, então a linha omite em vez de exibir a opção como dado. */
const raca = (l: LadoAfinidade) =>
  l.cor_raca && l.cor_raca !== "prefiro_nao_dizer"
    ? COR_RACA_LABELS[l.cor_raca]
    : null;

function ChipInteresse({ texto, destaque }: { texto: string; destaque: boolean }) {
  return (
    <span
      className={cn(
        "rounded-full border px-2 py-0.5 text-xs leading-5",
        destaque
          ? "border-[var(--brand-lime)]/60 bg-[var(--brand-lime)]/15 text-foreground"
          : "border-border text-muted-foreground"
      )}
    >
      {texto}
    </span>
  );
}

/** Grade da semana — linhas manhã/tarde/noite (rótulo por extenso) ×
 *  colunas seg–dom, com três estados por célula: lima cheio = os dois
 *  podem, lima diluído = só um deles, cinza = nenhum informado. A frase
 *  acima dela já dá a leitura — a grade é evidência, não exercício de
 *  decodificação. */
function GradeAgendaComum({
  mentor: setM,
  jovem: setJ,
}: {
  mentor: ReadonlySet<string>;
  jovem: ReadonlySet<string>;
}) {
  return (
    <div>
      <div
        className="grid max-w-72 grid-cols-[38px_repeat(7,minmax(0,1fr))] gap-x-1 gap-y-0.5"
        aria-hidden
      >
        <span />
        {DIAS_SEMANA.map((dia) => (
          <p
            key={dia}
            className="text-center text-[10px] font-medium uppercase tracking-wide text-muted-foreground/80"
          >
            {DIAS_SEMANA_CURTOS[dia]}
          </p>
        ))}
        {PERIODOS.map((per) => (
          <div key={per} className="contents">
            <p className="self-center text-[10px] font-medium text-muted-foreground/80">
              {PERIODOS_LABELS[per].toLocaleLowerCase("pt-BR")}
            </p>
            {DIAS_SEMANA.map((dia) => {
              const chave = `${dia}:${per}`;
              const ambos = setM.has(chave) && setJ.has(chave);
              const um = setM.has(chave) || setJ.has(chave);
              return (
                <div
                  key={dia}
                  title={`${DIAS_SEMANA_LABELS[dia]} ${PERIODOS_LABELS[per].toLocaleLowerCase("pt-BR")} — ${
                    ambos ? "os dois podem" : um ? "só um deles" : "nenhum informado"
                  }`}
                  className={cn(
                    "h-3.5 rounded-[3px]",
                    ambos
                      ? "bg-[var(--brand-lime)]"
                      : um
                        ? "bg-[var(--brand-lime)]/30"
                        : "bg-muted-foreground/10"
                  )}
                />
              );
            })}
          </div>
        ))}
      </div>
      <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <span aria-hidden className="size-2 rounded-[2px] bg-[var(--brand-lime)]" />
          os dois
        </span>
        <span className="inline-flex items-center gap-1">
          <span aria-hidden className="size-2 rounded-[2px] bg-[var(--brand-lime)]/30" />
          só um
        </span>
        <span className="inline-flex items-center gap-1">
          <span aria-hidden className="size-2 rounded-[2px] bg-muted-foreground/10 ring-1 ring-border" />
          nenhum
        </span>
      </div>
    </div>
  );
}

const NA = (
  <span className="italic text-muted-foreground/80">Não informado</span>
);

/** Coluna de um participante dentro de "Ver detalhes" — mesmas famílias de
 *  campos alinhadas nas duas colunas pra comparação sem esforço. Campos
 *  vazios aparecem como "Não informado" (ausência de informação ≠
 *  ausência de interesse). */
function ColParticipante({
  rotulo,
  lado,
  meta,
  interesses,
  comuns,
  agendaTxt,
  campos,
}: {
  rotulo: string;
  lado: LadoAfinidade;
  /** fragmentos da linha de meta (idade, cidade, escolaridade…) */
  meta: (string | null)[];
  interesses: string[];
  comuns: ReadonlySet<string>;
  agendaTxt: string | null;
  campos: { rotulo: string; valor: string | null | undefined }[];
}) {
  return (
    <div className="space-y-2.5 rounded-md border border-border/60 bg-card/60 p-3">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          {rotulo}
        </p>
        <p className="mt-0.5 text-sm font-semibold">{lado.nome}</p>
        <p className="text-xs text-muted-foreground">
          {meta.filter(Boolean).join(" · ") || "Sem dados de contato"}
        </p>
      </div>
      <div>
        <p className="text-xs font-medium text-muted-foreground">Interesses</p>
        <div className="mt-1 flex flex-wrap gap-1">
          {interesses.length
            ? interesses.map((i) => (
                <ChipInteresse
                  key={i}
                  texto={i}
                  destaque={comuns.has(normaliza(i))}
                />
              ))
            : NA}
        </div>
      </div>
      <div>
        <p className="text-xs font-medium text-muted-foreground">Agenda</p>
        <p className="mt-0.5 text-sm text-muted-foreground">
          {agendaTxt ?? NA}
        </p>
      </div>
      {campos.map((c) => (
        <div key={c.rotulo}>
          <p className="text-xs font-medium text-muted-foreground">
            {c.rotulo}
          </p>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {c.valor ?? NA}
          </p>
        </div>
      ))}
    </div>
  );
}

/** Cartão de comparação mentor × mentorado — a primeira vista mostra
 *  restrições, evidências que cruzam e a explicação da sugestão; o
 *  inventário comparável vai nas duas colunas do "Ver detalhes". Puro de
 *  props: o board e o dialog montam os lados do que já têm carregado. */
export function AfinidadePar({
  mentor,
  mentorado,
  temasMentor,
  temasMentorado,
  docJovem,
  sugeridoSemantico,
}: {
  mentor: LadoAfinidade & {
    disponibilidade: Disponibilidade | null;
    trilha: Trilha;
    areas?: string[] | null;
  };
  mentorado: LadoAfinidade & {
    objetivos?: string | null;
    escolaridade?: Escolaridade | null;
    data_nascimento?: string | null;
    disponibilidade?: Disponibilidade | null;
  };
  /** Tags canônicas extraídas do doc-matching (REALIZA-338) — a camada
   *  explicável do vetor: a interseção vira "temas em comum". Sem a
   *  prop a seção simplesmente não aparece. */
  temasMentor?: string[];
  temasMentorado?: string[];
  /** Status real do documento do jovem (menor → autorização do
   *  responsável; maior → termo de participação). Sem a prop, a
   *  restrição cai no texto genérico. */
  docJovem?: { slug: "autorizacao-responsavel" | "termo-mentorando"; status: DocJovemStatus } | null;
  /** o par saiu do ranqueamento semântico (selo "sugerido") — vira a
   *  primeira linha da explicação */
  sugeridoSemantico?: boolean;
}) {
  const intMentor = mentor.interesses ?? [];
  const intMentorado = mentorado.interesses ?? [];
  const comuns = emComum(intMentorado, intMentor);
  // temas canônicos (matching_perfis) — comparação já é no vocab fechado,
  // então o cruzamento é por igualdade literal, sem normalizar de novo
  const temasComuns = (temasMentorado ?? []).filter((t) =>
    (temasMentor ?? []).includes(t)
  );
  const anos = idade(mentorado.data_nascimento);

  // agenda: três estados por célula — os dois / só um / nenhum
  const setMentor = new Set(
    celulasDe(mentor.disponibilidade).map((c) => `${c.dia}:${c.periodo}`)
  );
  const setJovem = new Set(
    celulasDe(mentorado.disponibilidade ?? null).map(
      (c) => `${c.dia}:${c.periodo}`
    )
  );
  const agendaComum = celulasComuns(
    mentor.disponibilidade,
    mentorado.disponibilidade ?? null
  );
  const temAgenda = setMentor.size + setJovem.size > 0;
  const temSobreposicao = agendaComum.length > 0;
  const agendaTxt = disponibilidadeTexto(mentor.disponibilidade);
  const agendaJovemTxt = disponibilidadeTexto(
    mentorado.disponibilidade ?? null
  );

  // ————— Restrições: tudo que precisa ser resolvido ou confirmado antes
  // de formar — primeiro grupo, sem competir com as evidências
  const restricoes: Restricao[] = [];
  const ehMenor = anos != null && anos < 18;
  if (ehMenor) {
    if (docJovem?.status === "assinado") {
      // resolvido — não é restrição
    } else if (docJovem?.status === "enviado") {
      restricoes.push({
        nivel: "info",
        texto: `${primeiroNome(mentorado.nome)} tem ${anos} anos — o link da autorização do responsável foi enviado e aguarda a assinatura.`,
        href: mentorado.id ? `/pessoas/${mentorado.id}#assinaturas` : undefined,
      });
    } else if (docJovem == null) {
      // chamador sem o resumo (NovaDuplaDialog) — não afirma status
      restricoes.push({
        nivel: "alerta",
        texto: `${primeiroNome(mentorado.nome)} tem ${anos} anos — a autorização do responsável precisa estar assinada.`,
        href: mentorado.id ? `/pessoas/${mentorado.id}#assinaturas` : undefined,
      });
    } else {
      restricoes.push({
        nivel: "alerta",
        texto: `${primeiroNome(mentorado.nome)} tem ${anos} anos — a autorização do responsável ainda não foi emitida.`,
        href: mentorado.id ? `/pessoas/${mentorado.id}#assinaturas` : undefined,
      });
    }
  } else if (docJovem?.slug === "termo-mentorando" && docJovem.status === "nao_emitido") {
    restricoes.push({
      nivel: "info",
      texto: `O termo de participação de ${primeiroNome(mentorado.nome)} ainda não foi emitido.`,
      href: mentorado.id ? `/pessoas/${mentorado.id}#assinaturas` : undefined,
    });
  }
  const ambosTemAgenda = setMentor.size > 0 && setJovem.size > 0;
  // "sem janela" só quando os dois informaram e as grades não batem —
  // quando falta agenda de um lado a nota de preenchimento já explica
  if (ambosTemAgenda && !temSobreposicao) {
    restricoes.push({
      nivel: "alerta",
      texto:
        "Sem janela em comum de dia e período — confirme a agenda dos dois antes de formar.",
    });
  }
  if (temAgenda && !ambosTemAgenda) {
    restricoes.push({
      nivel: "info",
      texto: !agendaTxt
        ? "Agenda do mentor não informada. Confirme antes de formar."
        : "Agenda do jovem não informada — a grade dele pode ser preenchida na ficha.",
    });
  }
  for (const a of [
    restricaoGenero(mentorado, mentor, "mentorado"),
    restricaoGenero(mentor, mentorado, "mentor"),
  ]) {
    if (a) restricoes.push(a);
  }

  // ————— Evidências que cruzam (compatibilidade) — sem score, só fatos
  const generoOk =
    prefAtendida(mentorado, mentor) || prefAtendida(mentor, mentorado);

  // ————— Explicação da sugestão — cada linha sai de um dado real; sem
  // evidência nenhuma a seção diz isso em vez de inventar afinidade
  const motivos: string[] = [];
  if (sugeridoSemantico) {
    motivos.push("Sugerido pelo ranking de afinidade dos perfis.");
  }
  if (temSobreposicao) {
    motivos.push(
      `Agenda em comum: ${disponibilidadeTexto({ celulas: agendaComum })}.`
    );
  }
  if (temasComuns.length) {
    motivos.push(`Temas em comum: ${temasComuns.join(", ")}.`);
  }
  if (comuns.size) {
    motivos.push(
      `Interesses em comum: ${intMentorado
        .filter((i) => comuns.has(normaliza(i)))
        .join(", ")}.`
    );
  }
  if (generoOk) {
    motivos.push("Preferência de gênero atendida nos dois lados.");
  }
  if (!comuns.size && intMentor.length && intMentorado.length) {
    motivos.push(
      "Interesses distintos — não é incompatibilidade: são repertórios diferentes pra trocar."
    );
  }
  if (restricoes.some((r) => r.nivel === "alerta")) {
    motivos.push("Há uma pendência pra resolver antes de formar.");
  }

  const [detalhesAbertos, setDetalhesAbertos] = useState(false);

  return (
    <div className="space-y-4 rounded-lg border border-border bg-muted/30 px-3.5 py-3.5">
      <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
        Afinidade do par
      </p>

      {/* restrições primeiro — o que precisa resolver antes de formar */}
      {restricoes.length > 0 && (
        <ul className="space-y-1.5">
          {restricoes.map((r) => (
            <li
              key={r.texto}
              className={cn(
                "flex items-start gap-1.5 rounded-md px-2.5 py-1.5 text-sm",
                r.nivel === "alerta"
                  ? "bg-[var(--warn)]/10 text-[var(--warn-text)]"
                  : "text-muted-foreground"
              )}
            >
              {r.nivel === "alerta" && (
                <Warning size={14} aria-hidden className="mt-0.5 shrink-0" />
              )}
              <span>
                {r.texto}
                {r.href && (
                  <>
                    {" "}
                    <Link
                      href={r.href}
                      className="font-medium underline underline-offset-2 hover:text-foreground"
                    >
                      Regularizar na ficha →
                    </Link>
                  </>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}

      {/* compatibilidade — evidências que cruzam */}
      <div className="grid gap-4 sm:grid-cols-[minmax(0,17rem)_minmax(0,1fr)]">
        <div className="space-y-1.5">
          <p className="text-xs font-medium text-muted-foreground">
            Disponibilidade em comum
          </p>
          {temAgenda ? (
            <>
              <p className="text-sm">
                {temSobreposicao ? (
                  <>
                    <b className="font-semibold tabular-nums">
                      {agendaComum.length}{" "}
                      {agendaComum.length === 1 ? "janela" : "janelas"}
                    </b>{" "}
                    <span className="text-muted-foreground">
                      · {disponibilidadeTexto({ celulas: agendaComum })}
                    </span>
                  </>
                ) : (
                  <b className="font-semibold">Sem coincidência</b>
                )}
              </p>
              <GradeAgendaComum mentor={setMentor} jovem={setJovem} />
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              Nenhuma agenda informada — os detalhes mostram como preencher.
            </p>
          )}
        </div>

        <div className="space-y-3">
          {temasComuns.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground">
                Temas em comum{" "}
                <b className="font-semibold text-foreground tabular-nums">
                  {temasComuns.length}
                </b>
              </p>
              <div className="flex flex-wrap gap-1">
                {temasComuns.map((t) => (
                  <ChipInteresse key={t} texto={t} destaque />
                ))}
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground">
              Interesses em comum{" "}
              <b className="font-semibold text-foreground tabular-nums">
                {comuns.size}
              </b>
            </p>
            {comuns.size > 0 ? (
              <div className="flex flex-wrap gap-1">
                {intMentorado
                  .filter((i) => comuns.has(normaliza(i)))
                  .map((i) => (
                    <ChipInteresse key={i} texto={i} destaque />
                  ))}
              </div>
            ) : intMentor.length && intMentorado.length ? (
              <p className="text-sm text-muted-foreground">
                Interesses distintos — repertórios diferentes pra trocar.
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">
                Interesses não informados — as listas completas ficam nos
                detalhes.
              </p>
            )}
          </div>

          {generoOk && (
            <p className="flex items-center gap-1.5 text-sm text-[var(--ok-text)]">
              <Check size={14} weight="bold" aria-hidden />
              Preferência de gênero atendida.
            </p>
          )}
        </div>
      </div>

      {/* por que este par — explicação gerada dos critérios reais */}
      {motivos.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-xs font-medium text-muted-foreground">
            Por que este par
          </p>
          <ul className="list-disc space-y-0.5 pl-5 text-sm">
            {motivos.map((m) => (
              <li key={m} className="text-muted-foreground marker:text-foreground/40">
                {m}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* o que não cruza é detalhe: duas colunas comparáveis, um
          participante por lado, campos alinhados */}
      <Collapsible.Root
        open={detalhesAbertos}
        onOpenChange={setDetalhesAbertos}
      >
        <Collapsible.Trigger
          aria-expanded={detalhesAbertos}
          className="flex w-full items-center gap-1 rounded-md py-0.5 text-sm font-medium text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
        >
          Ver detalhes
          <CaretDown
            size={12}
            aria-hidden
            className={cn(
              "transition-transform duration-200",
              detalhesAbertos && "rotate-180"
            )}
          />
        </Collapsible.Trigger>
        <Collapsible.Panel
          keepMounted
          className="h-[var(--collapsible-panel-height)] overflow-hidden transition-[height] duration-200 data-ending-style:h-0 data-starting-style:h-0 [&[hidden]:not([hidden='until-found'])]:hidden"
        >
          <div className="mt-2 grid gap-3 border-t border-border/60 pt-3 sm:grid-cols-2">
            <ColParticipante
              rotulo="Mentorado"
              lado={mentorado}
              meta={[
                anos != null ? `${anos} anos` : null,
                mentorado.genero &&
                mentorado.genero !== "prefiro_nao_dizer"
                  ? GENERO_LABELS[mentorado.genero]
                  : null,
                local(mentorado) || null,
                mentorado.escolaridade
                  ? ESCOLARIDADE_LABELS[mentorado.escolaridade]
                  : null,
                raca(mentorado),
              ]}
              interesses={intMentorado}
              comuns={comuns}
              agendaTxt={agendaJovemTxt}
              campos={[
                { rotulo: "Objetivos", valor: mentorado.objetivos },
                { rotulo: "Motivação", valor: mentorado.motivacao },
              ]}
            />
            <ColParticipante
              rotulo="Mentor"
              lado={mentor}
              meta={[
                mentor.genero && mentor.genero !== "prefiro_nao_dizer"
                  ? GENERO_LABELS[mentor.genero]
                  : null,
                local(mentor) || null,
                raca(mentor),
                mentor.areas?.length
                  ? `atua em ${mentor.areas.join(", ")}`
                  : null,
              ]}
              interesses={intMentor}
              comuns={comuns}
              agendaTxt={agendaTxt}
              campos={[{ rotulo: "Motivação", valor: mentor.motivacao }]}
            />
          </div>
          {mentor.trilha === "dpp" && (
            <p className="mt-3 text-sm text-muted-foreground">
              O cronograma usa terças como referência, mas a dupla agenda no
              dia que combinar.
            </p>
          )}
        </Collapsible.Panel>
      </Collapsible.Root>
    </div>
  );
}
