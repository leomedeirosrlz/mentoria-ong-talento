// Labels de turma — helper ÚNICO (rodada feedback-ux-2026-10 / turmas.md).
// Antes o `partesTurma` morava no ciclo e cada lib de agenda tinha o seu
// `turmaCurta` privado; aqui fica a gramática inteira.
//
// `turma` é TEXTO livre (cronogramas.turma) e snapshot textual
// (duplas.turma, relatorio_links.turma, turma_inscricoes.turma,
// profile_papeis.escopo_turma): estas funções só derivam RÓTULO de
// exibição — nunca reescrevem nem normalizam o valor. O padrão novo é
// "T<N> · <período>" ("T1 · 2026/2027", semeado na 0111); legado e texto
// livre ("2026/2027", "Turma E2E", "E2E Turma de teste") devolvem o
// valor cru — dado do usuário não é reescrito à força.
//
// Filtro/recorte NÃO casa label-com-label (REALIZA-223): `duplas.turma`
// é selo que congela no pareamento; quem compara resolve o rótulo vivo
// via `turmaDaDupla`.
//
// Domínio puro (só import type): espelha a disciplina do ciclo.ts.

import type { Cronograma } from "./types";

/** "T1 · 2026/2027" → { nome: "Turma 1", ano: "2026/2027" } — o rótulo
 *  curto vira o nome forte e o ano perde peso visual (decisão REALIZA-151).
 *  Turma sem o padrão ("2025/2026", texto livre) devolve o valor inteiro
 *  como nome. */
export function partesTurma(
  turma: string
): { nome: string; ano: string | null } {
  const m = turma.match(/^T(\d+)\s*[·\-.]?\s*(.+)$/);
  if (m) return { nome: `Turma ${m[1]}`, ano: m[2].trim() };
  // sigla solta ("T1", saída da própria turmaCurta) também vira "Turma 1"
  // — a leitura longa não exige o par sigla+período
  const so = turma.match(/^T(\d+)$/i);
  if (so) return { nome: `Turma ${so[1]}`, ano: null };
  return { nome: turma, ano: null };
}

/** Sigla da turma — "T1 · 2026/2027" → "T1". Sem padrão, o valor inteiro
 *  (primeiro trecho antes de "·"); null/vazio → "". */
export function turmaCurta(turma: string | null | undefined): string {
  return (turma ?? "").split("·")[0]?.trim() ?? "";
}

/** Nome de exibição — "T1 · 2026/2027" → "Turma 1". É o `nome` do
 *  partesTurma: sigla solta também resolve ("T1" → "Turma 1", então
 *  turmaLonga(turmaCurta(t)) faz o round-trip); fora do padrão devolve
 *  o valor cru. */
export function turmaLonga(turma: string | null | undefined): string {
  return partesTurma((turma ?? "").trim()).nome;
}

/** Metadado secundário — "T1 · 2026/2027" → "2026/2027"; sem padrão →
 *  null (o caller omite, nunca mostra "null"). */
export function turmaAno(turma: string | null | undefined): string | null {
  return partesTurma((turma ?? "").trim()).ano;
}

/** Só o número — "T1 · 2026/2027" → "1". Equivale à sigla sem o prefixo
 *  T: valor fora do padrão devolve a si mesmo ("E2E Turma" → "E2E
 *  Turma"), null/vazio → "" — o caller decide o fallback de leitura. */
export function turmaNumero(turma: string | null | undefined): string {
  return turmaCurta(turma).replace(/^t/i, "");
}

/** O label VIVO da turma da dupla (REALIZA-223). `duplas.turma` é o selo
 *  gravado no pareamento — congela quando a coordenação renomeia
 *  `cronogramas.turma`, e quem filtra por label cru some com a dupla
 *  ("turma nova aparece vazia"). Com `cronograma_id` o rótulo vem da
 *  linha do cronograma; sem cronograma (trilha especialista) ou com
 *  cronograma fora da lista recebida, resta o selo — a dupla nunca
 *  perde o dado que tem. */
export function turmaDaDupla(
  dupla: { cronograma_id?: string | null; turma?: string | null },
  cronogramas: readonly Pick<Cronograma, "id" | "turma">[]
): string | null {
  if (dupla.cronograma_id) {
    const turma = cronogramas.find(
      (c) => c.id === dupla.cronograma_id
    )?.turma;
    if (turma != null) return turma;
  }
  return dupla.turma ?? null;
}
