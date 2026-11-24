import { escapeDocHtml } from "./doc-bloco-schema";
import type { DocBloco } from "./materiais-documentos";
import type { CorpusDoc } from "./materiais/corpus-doc";
import {
  diaCurto,
  diaMes,
  rotuloSessao,
  sessoesDoEscopo,
  type PlanoCombinado,
} from "./plano-combinado";
import type {
  DuplaPlano,
  DuplaPlanoEscopo,
  DuplaPlanoRoteiro,
} from "./types";

/** Montagem determinística dos documentos do plano (020 — REALIZA-521):
 *  roteiro semanal (corpus + ajustes + contexto) e doc do combinado
 *  (render do escopo). Sem Liza nesta fatia — só domínio puro, testável
 *  sem banco nem fs. */

/** Status de encontro que já ocupa calendário (row viva na agenda). */
export const ENCONTROS_MARCADOS = new Set([
  "agendado",
  "remarcado",
  "nao_aconteceu",
]);

export function numerosMarcadosDe(encontros: readonly { numero: number; status: string }[]): number[] {
  return encontros
    .filter((e) => ENCONTROS_MARCADOS.has(e.status))
    .map((e) => e.numero);
}

export function numerosRealizadosDe(encontros: readonly { numero: number; status: string }[]): number[] {
  return encontros.filter((e) => e.status === "realizado").map((e) => e.numero);
}

/** Semanas que já nascem roteiro (lazy, FR-003): 1ª semana quando há
 *  encontro marcado; a seguinte quando a anterior concluiu — nunca N+2.
 *  Encontro já realizado não ganha roteiro (a semana já passou). */
export function roteirosDevidos(input: {
  numeros: readonly number[];
  marcados: readonly number[];
  realizados: readonly number[];
}): number[] {
  const marc = new Set(input.marcados);
  const fe = new Set(input.realizados);
  return [...new Set(input.numeros)]
    .sort((a, b) => a - b)
    .filter((n) => !fe.has(n) && (marc.has(n) || fe.has(n - 1)));
}

/** Slug do corpus do roteiro da semana (roteiro-encontro-01…16). */
export function slugRoteiro(numero: number): string {
  return `roteiro-encontro-${String(numero).padStart(2, "0")}`;
}

export type RoteiroContexto = {
  numero: number;
  /** passo do escopo correspondente (data sugerida, sessão) — null sem passo */
  passo?: {
    data?: string | null;
    sessao?: string | null;
    duracao_min?: number | null;
  } | null;
  /** números que dividem a mesma sessão (fusão 018) — null/≤1 sem fusão */
  sessaoGrupo?: readonly number[] | null;
  ajustes?: readonly { sugestao: string; justificativa: string }[] | null;
  /** recesso que cobre a data do passo (usa === true) — null fora de recesso */
  recesso?: { titulo: string } | null;
};

const RE_PREFIXO_ENCONTRO = /^\d+º encontro ·\s*/;

/** Roteiro da semana: contexto do plano + ajustes da dupla + corpo do
 *  corpus (## → subtítulo, ### → subtítulo nivel 3). Corpus ausente (fs
 *  fora do bundle) vira só o contexto — nunca quebra. */
export function montarRoteiro(
  doc: CorpusDoc | null,
  ctx: RoteiroContexto
): DocBloco[] {
  const blocos: DocBloco[] = [];
  const planoBits: string[] = [];
  if (ctx.passo?.data) planoBits.push(`sugestão ${diaCurto(ctx.passo.data)}`);
  if (ctx.sessaoGrupo && ctx.sessaoGrupo.length > 1) {
    planoBits.push(
      rotuloSessao(ctx.numero, ctx.sessaoGrupo) +
        (ctx.passo?.duracao_min ? `, sessão de ${ctx.passo.duracao_min} min` : "")
    );
  }
  if (ctx.recesso)
    planoBits.push(`${ctx.recesso.titulo} no caminho: vocês seguem se encontrando`);
  if (planoBits.length)
    blocos.push({
      kind: "callout",
      tom: "tip",
      html: `<b>Do plano de vocês:</b> ${escapeDocHtml(planoBits.join(" · "))}.`,
    });
  if (ctx.ajustes && ctx.ajustes.length > 0) {
    blocos.push({
      kind: "callout",
      tom: "info",
      html: "<b>Guia ajustado pra vocês:</b> este roteiro absorve as adaptações combinadas pela dupla.",
    });
    blocos.push({
      kind: "lista",
      itens: ctx.ajustes.map(
        (a) =>
          `${escapeDocHtml(a.sugestao)} <i>${escapeDocHtml(a.justificativa)}</i>`
      ),
    });
  }
  for (const s of doc?.secoes ?? []) {
    blocos.push({
      kind: "subtitulo",
      texto:
        s.nivel === 2 ? s.titulo.replace(RE_PREFIXO_ENCONTRO, "") : s.titulo,
      nivel: s.nivel,
    });
    blocos.push(...s.blocos);
  }
  return blocos;
}

/** Status legível do roteiro na lista da ficha. */
export function rotuloStatusRoteiro(r: DuplaPlanoRoteiro): string {
  return r.status === "publicado"
    ? "Vigente"
    : r.status === "rascunho"
      ? "Rascunho"
      : "Versão anterior";
}

/** Row é de versão anterior do plano (o escopo mudou depois da geração). */
export function roteiroForaDeVersao(
  r: Pick<DuplaPlanoRoteiro, "plano_versao">,
  plano: Pick<DuplaPlano, "versao">
): boolean {
  return r.plano_versao !== plano.versao;
}

/** Substitui (ou não) o link do roteiro do corpus pelos roteiros do
 *  plano na disclosure "Roteiro e materiais" da SuaSemana. `href` é o
 *  do roteiro vigente quando existe — os rascunhos não entram (a lista
 *  da ficha é a superfície deles). */
export function materiaisComRoteiroPlano(
  materiais: { href: string; titulo: string }[],
  vigente: { numero: number; href: string } | null
): { href: string; titulo: string }[] {
  const slug = vigente ? slugRoteiro(vigente.numero) : null;
  const semCorpus = slug
    ? materiais.filter((m) => !m.href.includes(slug))
    : materiais;
  return vigente
    ? [{ href: vigente.href, titulo: `Roteiro do ${vigente.numero}º encontro` }, ...semCorpus]
    : semCorpus;
}

const STATUS_DOC: Record<string, string> = {
  proposto: "a proposta espera um aceite da dupla pra entrar em vigor",
  aceito: "a proposta foi aceita: vale como combinado",
  ativo: "o combinado está em prática",
  contestado: "a proposta foi contestada e esta versão encerrou",
  expirado: "a proposta expirou sem aceite",
  concluido: "o combinado foi concluído",
};

/** Doc do combinado: render determinístico do escopo — cabeçalho de
 *  proposta, ritmo, encontros (com sessão fusa e estado), recessos e a
 *  regra do aceite. Um por versão: o escopo mudou, o doc muda. */
export function montarDocCombinado(input: {
  status: string;
  versao: number;
  propostoEm?: string | null;
  quemPropos?: string | null;
  escopo?: DuplaPlanoEscopo | null;
  aceites?: { mentor: boolean; mentorado: boolean } | null;
  nomes?: { mentor: string; mentorado: string } | null;
  recessos?:
    | readonly { titulo: string; inicio: string; fim: string; usa: boolean | null }[]
    | null;
  /** numero → data ISO agendada (passos aplicados no combinado) */
  marcados?: ReadonlyMap<number, string> | null;
  realizados?: readonly number[] | null;
}): DocBloco[] {
  const blocos: DocBloco[] = [];
  const e = input.escopo;
  if (!e?.numeros?.length) {
    return [
      {
        kind: "callout",
        tom: "info",
        html: "Esta versão não guardou os detalhes do combinado.",
      },
    ];
  }

  // proposta
  const intro =
    input.quemPropos || input.propostoEm
      ? `<b>${escapeDocHtml(input.quemPropos ?? "A proposta")}${input.quemPropos ? " propôs" : " foi feita"}</b>` +
        (input.propostoEm ? ` em ${escapeDocHtml(diaMes(input.propostoEm.slice(0, 10)))}` : "") +
        (input.versao > 1 ? `, na versão ${input.versao}` : "") +
        `. ${STATUS_DOC[input.status] ? escapeDocHtml(`Agora, ${STATUS_DOC[input.status]}.`) : ""}`
      : `${escapeDocHtml(`Versão ${input.versao} do combinado.`)}` +
        (STATUS_DOC[input.status] ? ` ${escapeDocHtml(`Agora, ${STATUS_DOC[input.status]}.`)}` : "");
  blocos.push({ kind: "par", html: intro });

  // ritmo
  blocos.push({ kind: "subtitulo", texto: "O ritmo", nivel: 2 });
  const ritmo = e.ritmo ?? 1;
  const ritmoBits: string[] = [
    `até ${ritmo} encontro${ritmo > 1 ? "s" : ""} por semana`,
  ];
  if (e.janela?.inicio || e.janela?.fim)
    ritmoBits.push(
      `de ${e.janela?.inicio ? diaCurto(e.janela.inicio) : "agora"} a ${e.janela?.fim ? diaCurto(e.janela.fim) : "sem teto"}`
    );
  if (e.decisoes?.sem_grade)
    ritmoBits.push("combinado sem a grade de disponibilidade");
  if (e.decisoes?.ajuste_no_aceite)
    ritmoBits.push("a data do primeiro encontro fecha no aceite");
  blocos.push({ kind: "par", html: `${escapeDocHtml(ritmoBits.join(", "))}.` });

  // encontros
  blocos.push({ kind: "subtitulo", texto: "Os encontros", nivel: 2 });
  const grupos = sessoesDoEscopo(e.passos ?? []);
  const grupoDe = new Map<number, number[]>();
  for (const nums of grupos.values())
    for (const n of nums) grupoDe.set(n, nums);
  const marc = input.marcados ?? new Map<number, string>();
  const fe = new Set(input.realizados ?? []);
  blocos.push({
    kind: "lista",
    itens: e.numeros.map((n) => {
      const passo = e.passos?.find((p) => p.numero === n);
      const bits: string[] = [`<b>${n}º encontro</b>`];
      if (passo?.data) bits.push(`sugestão ${escapeDocHtml(diaCurto(passo.data))}`);
      const g = grupoDe.get(n);
      if (g && g.length > 1) bits.push(escapeDocHtml(rotuloSessao(n, g)));
      if (passo?.acao === "remarcar") bits.push("remarcação");
      if (fe.has(n)) bits.push("feito");
      else if (marc.has(n))
        bits.push(`marcado pra ${escapeDocHtml(diaCurto(marc.get(n)!))}`);
      return bits.join(" · ");
    }),
  });

  // recessos
  const recessos = (input.recessos ?? []).filter(Boolean);
  if (recessos.length > 0) {
    blocos.push({ kind: "subtitulo", texto: "Recessos no caminho", nivel: 2 });
    blocos.push({
      kind: "lista",
      itens: recessos.map(
        (r) =>
          `${escapeDocHtml(r.titulo)}: de ${escapeDocHtml(diaCurto(r.inicio))} a ${escapeDocHtml(diaCurto(r.fim))} · ` +
          (r.usa === true
            ? "vocês seguem se encontrando"
            : r.usa === false
              ? "pausa combinada"
              : "decisão pendente")
      ),
    });
  }

  // regra do aceite
  blocos.push({ kind: "subtitulo", texto: "Como vale", nivel: 2 });
  const regras: string[] = [];
  if (input.status === "proposto") {
    regras.push(
      "Um aceite da dupla coloca o combinado em vigor e avisa o outro lado.",
      "Se não servir, a contestação encerra esta versão. Um acordo novo nasce como versão nova.",
      "O combinado só vale depois do aceite, mesmo com encontro já marcado."
    );
  } else if (input.status === "aceito" || input.status === "ativo") {
    regras.push(
      "O combinado vale enquanto a dupla seguir nele. Pra mudar, nasce uma versão nova.",
      "Os roteiros das semanas nascem a partir deste combinado.",
      "Encontro feito é feito: versão nova não desmarca o que já aconteceu."
    );
  } else {
    regras.push(
      "Esta versão não está mais em vigor. Um acordo novo nasce como versão nova."
    );
  }
  if (input.aceites && input.nomes) {
    const { mentor, mentorado } = input.nomes;
    regras.push(
      `Aceites: ${mentor} ${input.aceites.mentor ? "aceitou" : "ainda não respondeu"} · ${mentorado} ${input.aceites.mentorado ? "aceitou" : "ainda não respondeu"}.`
    );
  }
  blocos.push({ kind: "lista", itens: regras.map(escapeDocHtml) });
  return blocos;
}

/** Resumo do contexto de um passo pra montagem do roteiro (sessão fusa +
 *  recesso cobrindo a data). Resolve tudo o que a montagem precisa do
 *  escopo a partir dos dados da dupla. */
export function contextoRoteiro(
  plano: PlanoCombinado | DuplaPlano,
  numero: number,
  extras: {
    ajustes?: readonly { sugestao: string; justificativa: string }[] | null;
    recessos?:
      | readonly { titulo: string; inicio: string; fim: string; usa: boolean | null }[]
      | null;
  } = {}
): RoteiroContexto {
  const passo = plano.escopo?.passos?.find((p) => p.numero === numero) ?? null;
  const grupo =
    [...sessoesDoEscopo(plano.escopo?.passos ?? []).values()].find((g) =>
      g.includes(numero)
    ) ?? null;
  const recesso =
    passo?.data && extras.recessos
      ? (extras.recessos.find(
          (r) => r.usa === true && r.inicio <= passo.data! && passo.data! <= r.fim
        ) ?? null)
      : null;
  return {
    numero,
    passo,
    sessaoGrupo: grupo && grupo.length > 1 ? grupo : null,
    ajustes: extras.ajustes ?? null,
    recesso: recesso ? { titulo: recesso.titulo } : null,
  };
}
