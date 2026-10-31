"use client";

import { Check, Warning } from "@phosphor-icons/react";
import {
  celulasComuns,
  disponibilidadeTexto,
  COR_RACA_LABELS,
  ESCOLARIDADE_LABELS,
  GENERO_LABELS,
  idade,
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
// (gênero, cor/raça, preferência
// de par, motivação) chegam já mergeados pelas views *_pessoal — só a
// coordenação recebe valor; fora dela vêm null e o painel simplesmente omite.

export type LadoAfinidade = {
  nome: string;
  interesses: string[] | null | undefined;
  cidade?: string | null;
  uf?: string | null;
  genero: Genero | null;
  cor_raca?: CorRaca | null;
  pref_genero_par: PrefGeneroPar | null;
  motivacao: string | null;
};

const primeiroNome = (n: string) => n.split(" ")[0];

/** Interesses que batem dos dois lados — comparados normalizados (caixa/
 *  acento), destacados com a grafia original de cada lista. */
function emComum(a: string[], b: string[]): Set<string> {
  const nb = new Set(b.map(normaliza));
  return new Set(a.filter((i) => nb.has(normaliza(i))).map(normaliza));
}

type Alerta = { nivel: "alerta" | "info"; texto: string };

/** Preferência de gênero de um lado contra o gênero informado do outro.
 *  `papel` diz quem prefere (mentorado prefere "mentora"; mentor prefere
 *  "mentorada"). null/indiferente não gera nada; gênero ausente ou
 *  "prefiro não dizer" vira nota discreta, não alarme. */
function alertaGenero(
  quem: LadoAfinidade,
  outro: LadoAfinidade,
  papel: "mentor" | "mentorado"
): Alerta | null {
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
        "rounded-full border px-2 py-0.5 text-[11px] leading-5",
        destaque
          ? "border-[var(--brand-lime)]/60 bg-[var(--brand-lime)]/15 text-foreground"
          : "border-border text-muted-foreground"
      )}
    >
      {texto}
    </span>
  );
}

/** Cartão de comparação mentor × mentorado — interesses, preferência de
 *  gênero, agenda e motivação/objetivos. Puro de props: o board e o dialog
 *  montam os lados do que já têm carregado. */
export function AfinidadePar({
  mentor,
  mentorado,
  temasMentor,
  temasMentorado,
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
}) {
  const intMentor = mentor.interesses ?? [];
  const intMentorado = mentorado.interesses ?? [];
  const comuns = emComum(intMentorado, intMentor);
  // temas canônicos (matching_perfis) — comparação já é no vocab fechado,
  // então o cruzamento é por igualdade literal, sem normalizar de novo
  const temasA = new Set(temasMentorado ?? []);
  const temasB = new Set(temasMentor ?? []);
  const temasComuns = [...temasA].filter((t) => temasB.has(t));
  const anos = idade(mentorado.data_nascimento);
  const alertas = [
    alertaGenero(mentorado, mentor, "mentorado"),
    alertaGenero(mentor, mentorado, "mentor"),
    anos != null && anos < 18
      ? {
          nivel: "alerta" as const,
          texto: `${primeiroNome(mentorado.nome)} tem ${anos} anos. Menor: a autorização do responsável precisa estar assinada.`,
        }
      : null,
  ].filter((a): a is Alerta => a !== null);

  const agendaTxt = disponibilidadeTexto(mentor.disponibilidade);
  const agendaJovemTxt = disponibilidadeTexto(mentorado.disponibilidade ?? null);
  // células em comum (mesmo dia E mesmo período) — a frase do "coincidem"
  // é a própria disponibilidadeTexto aplicada à interseção
  const agendaComum = celulasComuns(
    mentor.disponibilidade,
    mentorado.disponibilidade ?? null
  );
  const temSobreposicao = agendaComum.length > 0;
  const temInteresses = intMentor.length + intMentorado.length > 0;
  const temMotivacao =
    mentorado.motivacao || mentorado.objetivos || mentor.motivacao;

  return (
    <div className="space-y-3 rounded-lg border border-border bg-muted/30 px-3.5 py-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
        Afinidade do par
      </p>

      {/* meta: cidade/UF, idade, escolaridade e cor/raça — o contexto de
          proximidade que pesa na escolha manual */}
      <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-muted-foreground">
        <span>
          {primeiroNome(mentorado.nome)}
          {local(mentorado) ? ` · ${local(mentorado)}` : ""}
          {anos != null ? ` · ${anos} anos` : ""}
          {mentorado.escolaridade
            ? ` · ${ESCOLARIDADE_LABELS[mentorado.escolaridade]}`
            : ""}
          {raca(mentorado) ? ` · ${raca(mentorado)}` : ""}
        </span>
        <span>
          {primeiroNome(mentor.nome)}
          {local(mentor) ? ` · ${local(mentor)}` : ""}
          {raca(mentor) ? ` · ${raca(mentor)}` : ""}
          {mentor.areas?.length ? ` · atua em ${mentor.areas.join(", ")}` : ""}
        </span>
      </div>

      {alertas.map((a) => (
        <p
          key={a.texto}
          className={cn(
            "flex items-start gap-1.5 rounded-md px-2.5 py-1.5 text-xs",
            a.nivel === "alerta"
              ? "bg-[var(--warn)]/10 text-[var(--warn-text)]"
              : "text-muted-foreground"
          )}
        >
          {a.nivel === "alerta" && (
            <Warning size={13} aria-hidden className="mt-0.5 shrink-0" />
          )}
          {a.texto}
        </p>
      ))}

      {temasComuns.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-[11px] font-medium text-muted-foreground">
            Temas em comum · {temasComuns.length}
          </p>
          <div className="flex flex-wrap gap-1">
            {temasComuns.map((t) => (
              <ChipInteresse key={t} texto={t} destaque />
            ))}
          </div>
        </div>
      )}

      {temInteresses && (
        <div className="space-y-1.5">
          <p className="text-[11px] font-medium text-muted-foreground">
            Interesses
            {comuns.size
              ? ` · ${comuns.size} em comum`
              : " · nenhum em comum"}
          </p>
          <div className="space-y-1">
            {(
              [
                { nome: mentorado.nome, lista: intMentorado },
                { nome: mentor.nome, lista: intMentor },
              ] as const
            ).map((lado) => (
              <div
                key={lado.nome}
                className="flex flex-wrap items-center gap-1 text-xs"
              >
                <span className="w-20 shrink-0 truncate text-muted-foreground">
                  {primeiroNome(lado.nome)}
                </span>
                {lado.lista.length ? (
                  lado.lista.map((i) => (
                    <ChipInteresse
                      key={i}
                      texto={i}
                      destaque={comuns.has(normaliza(i))}
                    />
                  ))
                ) : (
                  <span className="italic text-muted-foreground">
                    sem interesses cadastrados
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-1 text-xs">
        <p className="text-[11px] font-medium text-muted-foreground">Agenda</p>
        {agendaTxt ? (
          <p>Mentor: {agendaTxt}</p>
        ) : (
          <p className="text-muted-foreground">
            Agenda do mentor não informada. Confirme antes de formar.
          </p>
        )}
        {mentor.trilha === "dpp" && (
          <p className="text-muted-foreground">
            O cronograma usa terças como referência, mas a dupla agenda no
            dia que combinar.
          </p>
        )}
        {mentor.trilha === "especialista" && (
          <p className="text-muted-foreground">
            Datas combinadas pela dupla, sem dia fixo.
          </p>
        )}
        {agendaJovemTxt ? (
          <>
            <p>Mentorado: {agendaJovemTxt}</p>
            {agendaTxt &&
              (temSobreposicao ? (
                <p className="flex items-center gap-1.5 text-[var(--ok-text)]">
                  <Check size={12} weight="bold" aria-hidden />
                  Coincidem em {disponibilidadeTexto({ celulas: agendaComum })}.
                </p>
              ) : (
                <p className="flex items-start gap-1.5 text-[var(--warn-text)]">
                  <Warning size={12} aria-hidden className="mt-0.5 shrink-0" />
                  Sem sobreposição de dia e período. Confirme a agenda dos
                  dois antes de formar.
                </p>
              ))}
          </>
        ) : (
          <p className="text-muted-foreground">
            Agenda do jovem não informada. A grade dele pode ser preenchida
            na ficha do mentorado.
          </p>
        )}
      </div>

      {temMotivacao && (
        <dl className="space-y-1.5 text-xs">
          {mentorado.motivacao && (
            <div>
              <dt className="font-medium text-muted-foreground">
                Motivação · {primeiroNome(mentorado.nome)}
              </dt>
              <dd
                className="mt-0.5 line-clamp-4 text-muted-foreground"
                title={mentorado.motivacao}
              >
                {mentorado.motivacao}
              </dd>
            </div>
          )}
          {mentorado.objetivos && (
            <div>
              <dt className="font-medium text-muted-foreground">Objetivos</dt>
              <dd
                className="mt-0.5 line-clamp-4 text-muted-foreground"
                title={mentorado.objetivos}
              >
                {mentorado.objetivos}
              </dd>
            </div>
          )}
          {mentor.motivacao && (
            <div>
              <dt className="font-medium text-muted-foreground">
                Motivação · {primeiroNome(mentor.nome)}
              </dt>
              <dd
                className="mt-0.5 line-clamp-4 text-muted-foreground"
                title={mentor.motivacao}
              >
                {mentor.motivacao}
              </dd>
            </div>
          )}
        </dl>
      )}
    </div>
  );
}

