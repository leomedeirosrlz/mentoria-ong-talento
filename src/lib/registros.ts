// Domínio puro de /registros — o agrupamento da timeline (?grupo=). Roda no
// server render e no vitest; os itens já chegam completos da query, então o
// custo é só o particionamento em memória (zero round-trip a mais).

import {
  AVALIACAO_LABEL,
  formatDiaMes,
  semanaBounds,
} from "@/lib/ciclo";
import type { AvaliacaoJovem } from "@/lib/types";

/** Eixos de agrupamento do `?grupo=` — "dupla" é o default implícito e não
 *  viaja na URL. */
export const GRUPOS_REGISTROS = ["dupla", "semana", "avaliacao"] as const;
export type GrupoRegistros = (typeof GRUPOS_REGISTROS)[number];

/** Rótulos do segmented control — "Agrupar: por dupla · por semana · por
 *  avaliação". */
export const GRUPO_REGISTROS_OPCAO: Record<GrupoRegistros, string> = {
  dupla: "por dupla",
  semana: "por semana",
  avaliacao: "por avaliação",
};

/** `?grupo=` validado — lixo na URL cai no default em vez de quebrar a lista. */
export function grupoRegistrosDe(v: string | undefined): GrupoRegistros {
  return (GRUPOS_REGISTROS as readonly string[]).includes(v ?? "")
    ? (v as GrupoRegistros)
    : "dupla";
}

/** O mínimo que o agrupamento lê de cada item — `RegistroResumo` satisfaz
 *  estruturalmente (campos a mais sobram). Manter o tipo estrutural deixa a
 *  função testável sem montar a árvore inteira da query. */
export type RegistroAgrupavel = {
  created_at: string;
  avaliacao: AvaliacaoJovem | null;
  encontro: {
    dupla: {
      id: string;
      mentor: { nome: string } | null;
      mentorado: { nome: string } | null;
    } | null;
  } | null;
};

export type BlocoRegistros<T> = {
  /** chave estável do grupo — id da dupla, segunda ISO da semana, valor do
   *  enum de avaliação. */
  chave: string;
  /** cabeçalho pronto da seção ("Dupla: Ana × Bia", "Semana de 13/10/2025",
   *  "Avaliação: Baixa"). A contagem ("· K registros") é acoplada no render. */
  rotulo: string;
  itens: T[];
};

/** Chave residual de quem não tem dupla identificável (encontro órfão ou
 *  dupla removida) — sempre fecha a lista, nunca abre. */
const SEM_DUPLA = "__sem-dupla__";
const SEM_DATA = "__sem-data__";

/** Eixo semana = a segunda-feira calendário (seg–dom, mesma regra de
 *  `semanaBounds`) da data em que o registro foi ENTREGUE — `created_at`,
 *  não a data do encontro: agrupa "o que reportaram esta semana", que é a
 *  leitura de follow-up. Data inválida cai num balde residual no fim. */
function semanaDe(createdAt: string): string {
  const d = new Date(createdAt);
  if (Number.isNaN(d.getTime())) return SEM_DATA;
  return semanaBounds(d).seg;
}

/** Baixa → regular → boa → excelente: a escala vira triagem — quem pede
 *  olho abre a lista (a mesma lógica do `scoreAlerta` da página). "Sem
 *  avaliação" fecha, por ser o balde menos informativo. */
const ORDEM_AVALIACAO: (AvaliacaoJovem | "")[] = [
  "baixa",
  "regular",
  "boa",
  "excelente",
  "",
];

/** Particiona `itens` em blocos com cabeçalho, SEM reordenar dentro de cada
 *  grupo — a ordem corrente (recentes/antigas/prioridade) segue valendo de
 *  item a item. Ordem entre grupos:
 *  - dupla/semana: primeira aparição na lista (adaptive — o grupo do item
 *    mais relevante abre, seja ele o mais novo em "recentes" ou o mais
 *    antigo em "antigas");
 *  - avaliacao: ordem fixa de severidade (ORDEM_AVALIACAO);
 *  - baldes residuais (sem dupla, sem data) sempre por último. */
export function agruparRegistros<T extends RegistroAgrupavel>(
  itens: T[],
  grupo: GrupoRegistros
): BlocoRegistros<T>[] {
  if (grupo === "avaliacao") {
    return ORDEM_AVALIACAO.map((av) => ({
      chave: av || "sem-avaliacao",
      rotulo: av ? `Avaliação: ${AVALIACAO_LABEL[av]}` : "Sem avaliação",
      itens: itens.filter((r) => (r.avaliacao ?? "") === av),
    })).filter((b) => b.itens.length > 0);
  }

  const blocos = new Map<string, BlocoRegistros<T>>();
  for (const r of itens) {
    let chave: string;
    let rotulo: string;
    if (grupo === "dupla") {
      const d = r.encontro?.dupla;
      chave = d?.id ?? SEM_DUPLA;
      rotulo = d
        ? `Dupla: ${d.mentor?.nome ?? "—"} × ${d.mentorado?.nome ?? "—"}`
        : "Dupla removida";
    } else {
      // grupo === "semana"
      const seg = semanaDe(r.created_at);
      chave = seg;
      rotulo =
        seg === SEM_DATA ? "Sem data" : `Semana de ${formatDiaMes(seg)}`;
    }
    let b = blocos.get(chave);
    if (!b) {
      b = { chave, rotulo, itens: [] };
      blocos.set(chave, b);
    }
    b.itens.push(r);
  }
  // residuais por último — sort estável preserva a ordem de 1ª aparição
  const residual = (b: BlocoRegistros<T>) =>
    b.chave === SEM_DUPLA || b.chave === SEM_DATA ? 1 : 0;
  return [...blocos.values()].sort((a, b) => residual(a) - residual(b));
}
