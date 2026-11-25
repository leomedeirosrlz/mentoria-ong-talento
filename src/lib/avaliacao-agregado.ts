import { PESO_AVALIACAO } from "./encerramento";
import type {
  AvaliacaoEncontro,
  AvaliacaoJovem,
  Dificuldade,
  Registro,
} from "./types";

// Agregado de fim de ciclo (REALIZA-71) — DERIVADO na leitura sobre as duas
// coletas existentes (avaliacoes_encontro do jovem, registros do mentor).
// Nada aqui se grava nem vira coluna; a régua de privacidade da 0071 decide
// QUEM recebe cada fatia antes desta função rodar — pedir_apoio, comentario,
// sentimento/temas individuais não entram na saída por construção.

/** Contagem (chave → n) em ordem desc — usada pra sentimentos, temas e
 *  dificuldades. Empate ordena pela chave pra saída estável. */
function contaChaves<T extends string>(itens: (T | null | undefined)[]) {
  const map = new Map<T, number>();
  for (const k of itens) if (k) map.set(k, (map.get(k) ?? 0) + 1);
  return [...map.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([chave, n]) => ({ chave, n }));
}

/** As duas séries do ciclo, agregadas. `null` onde não há dado — o card
 *  omite a fatia em vez de mostrar "0" que mentiria média. */
export type AgregadoAvaliacoes = {
  /** Lado do jovem (avaliacoes_encontro) — escala 1–5. */
  jovem: {
    n: number;
    /** Média crua das estrelas — a fatia completa (coord/sup/jovem). O
     *  mentor DPP nunca recebe esta: o corte dele é `mediaQuantizadaDpp`. */
    mediaEstrelas: number | null;
    /** % 0–100 de avancei='sim' sobre quem respondeu o campo — null quando
     *  ninguém respondeu (não confundir "0%" com "sem dado"). */
    pctAvanceiSim: number | null;
    avancei: { sim: number; um_pouco: number; nao: number };
    /** Distribuição dos chips de sentimento, mais citados primeiro. */
    sentimentos: { chave: string; n: number }[];
    /** Temas mais citados (multiescolha — soma pode passar de n). */
    temas: { chave: string; n: number }[];
  };
  /** Lado do mentor (registros) — escala 1–4 via PESO_AVALIACAO. */
  mentor: {
    n: number;
    media: number | null;
    dificuldades: { chave: Dificuldade; n: number }[];
  };
};

/** agregaAvaliacoes — pura: encontro sem avaliação/registro simplesmente
 *  não entra (a lacuna não conta nem distorce a média). `avaliacoes` deve
 *  chegar já filtrada pelo recorte de privacidade do leitor — a função não
 *  decide quem vê o quê. */
export function agregaAvaliacoes(
  avaliacoes: Pick<
    AvaliacaoEncontro,
    "estrelas" | "avancei" | "sentimento" | "temas"
  >[],
  registros: Pick<Registro, "avaliacao" | "dificuldade">[]
): AgregadoAvaliacoes {
  const nJovem = avaliacoes.length;
  const mediaEstrelas = nJovem
    ? avaliacoes.reduce((s, a) => s + a.estrelas, 0) / nJovem
    : null;

  const resp = { sim: 0, um_pouco: 0, nao: 0 };
  for (const a of avaliacoes) if (a.avancei) resp[a.avancei]++;
  const totalAvancei = resp.sim + resp.um_pouco + resp.nao;

  const notas = registros
    .map((r) => r.avaliacao)
    .filter((a): a is AvaliacaoJovem => a != null);

  return {
    jovem: {
      n: nJovem,
      mediaEstrelas,
      pctAvanceiSim:
        totalAvancei > 0 ? (resp.sim / totalAvancei) * 100 : null,
      avancei: resp,
      sentimentos: contaChaves(avaliacoes.map((a) => a.sentimento)),
      temas: contaChaves(avaliacoes.flatMap((a) => a.temas ?? [])),
    },
    mentor: {
      n: notas.length,
      media: notas.length
        ? notas.reduce((s, a) => s + PESO_AVALIACAO[a], 0) / notas.length
        : null,
      dificuldades: contaChaves(registros.map((r) => r.dificuldade)),
    },
  };
}

/** The young-person cut consumed by the journey-summary tile and the 360
 *  checklist line. `media` null means the viewer's rule did not release a
 *  number yet (mentor batch <3) — the surface shows n + the rule, never a
 *  fabricated value. `trajetoria`/`temasTop` only exist for viewers of the
 *  raw series: the mentor never receives per-encontro data. */
export type AvaliacaoJovemResumo = {
  n: number;
  /** estrelas mean (1–5), 1 decimal. */
  media: number | null;
  /** first→last estrelas by encontro number — ≥2 evals only. */
  trajetoria: { primeiro: number; ultimo: number } | null;
  /** top-3 tema keys by citation count. */
  temasTop: string[];
};

/** resumoAvaliacaoJovem — the summary-tile model over the series the
 *  caller is allowed to read (already privacy-filtered, same contract as
 *  agregaAvaliacoes). Returns null on an empty series: the tile hides. */
export function resumoAvaliacaoJovem(
  avaliacoes: { numero: number; estrelas: number; temas?: string[] | null }[]
): AvaliacaoJovemResumo | null {
  if (!avaliacoes.length) return null;
  const ordenadas = [...avaliacoes].sort((a, b) => a.numero - b.numero);
  const n = ordenadas.length;
  return {
    n,
    media:
      Math.round(
        (ordenadas.reduce((s, a) => s + a.estrelas, 0) / n) * 10
      ) / 10,
    trajetoria:
      n >= 2
        ? {
            primeiro: ordenadas[0].estrelas,
            ultimo: ordenadas[n - 1].estrelas,
          }
        : null,
    temasTop: contaChaves(ordenadas.flatMap((a) => a.temas ?? []))
      .slice(0, 3)
      .map((t) => t.chave),
  };
}

/** Média do jovem pro mentor DPP — a régua da 0071: só libera em lote ≥3
 *  sobre as k primeiras por created_at (uma avaliação nova não reabre a
 *  conta sobre o mesmo lote) e arredonda em 0,5. `estrelasPorData` vem
 *  ORDENADA por created_at — mesma ordem do LIMIT k da RPC
 *  avaliacao_media_quantizada (0191). */
export function mediaQuantizadaDpp(estrelasPorData: number[]): {
  n: number;
  liberado: boolean;
  media?: number;
  base?: number;
} {
  const n = estrelasPorData.length;
  const k = Math.floor(n / 3) * 3;
  if (k < 3) return { n, liberado: false };
  const media =
    Math.round(
      (estrelasPorData.slice(0, k).reduce((s, x) => s + x, 0) / k) * 2
    ) / 2;
  return { n, liberado: true, media, base: k };
}
