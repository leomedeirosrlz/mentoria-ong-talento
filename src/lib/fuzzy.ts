import { normaliza } from "@/lib/utils";

// Fuzzy match compartilhado das buscas (REALIZA-391): além do substring
// normalizado de antes, tolera ordem das palavras, letras puladas
// (subsequência) e erro leve de digitação (1 edição em token ≥4 letras).
// O score ranqueia: substring > subsequência > typo — match exato nunca
// perde a dianteira. Os `trechos` são faixas [início, fim) no TEXTO
// ORIGINAL (não no normalizado) pro <mark> do HighlightText.

export type Trechos = [number, number][];

export type FuzzyHit = {
  score: number;
  trechos: Trechos;
};

/** Texto normalizado + mapa de volta: a i-ésima letra do normalizado veio
 *  do índice `mapa[i]` do original. NFD separa "ã" em "a~", então só as
 *  letras que sobram após tirar as marcas entram no mapa — o highlight
 *  cobre o glifo original inteiro. */
function mapaNormalizado(texto: string): { norm: string; mapa: number[] } {
  const mapa: number[] = [];
  let norm = "";
  for (let i = 0; i < texto.length; i++) {
    for (const ch of texto[i].normalize("NFD")) {
      if (/\p{M}/u.test(ch)) continue;
      norm += ch.toLowerCase();
      mapa.push(i);
    }
  }
  return { norm, mapa };
}

const ehBordaDePalavra = (norm: string, pos: number) =>
  pos === 0 || /[^a-z0-9]/.test(norm[pos - 1]);

/** Palavras do texto normalizado com a posição de cada uma — o typo
 *  compara token contra palavra, não contra o texto inteiro. */
function palavras(norm: string): { inicio: number; fim: number }[] {
  const ps: { inicio: number; fim: number }[] = [];
  for (const m of norm.matchAll(/[a-z0-9]+/g)) {
    ps.push({ inicio: m.index, fim: m.index + m[0].length });
  }
  return ps;
}

/** Damerau-Levenshtein (OSA) com corte — distância de edição contando
 *  transposição de vizinhos como 1 ("marai"→"maria"). `max` limita o
 *  trabalho: retorna max+1 assim que passa. */
function damerau(a: string, b: string, max: number): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  const da: number[][] = [Array.from({ length: b.length + 1 }, (_, j) => j)];
  for (let i = 1; i <= a.length; i++) {
    const linha = [i];
    let menor = i;
    for (let j = 1; j <= b.length; j++) {
      const custo = a[i - 1] === b[j - 1] ? 0 : 1;
      let v = Math.min(
        da[i - 1][j] + 1,
        linha[j - 1] + 1,
        da[i - 1][j - 1] + custo
      );
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        v = Math.min(v, da[i - 2][j - 2] + 1);
      }
      linha[j] = v;
      if (v < menor) menor = v;
    }
    if (menor > max) return max + 1;
    da.push(linha);
  }
  return da[a.length][b.length];
}

type MatchToken = { score: number; // maior é melhor
  /** posições casadas no texto normalizado — viram `trechos` no original */
  pos: number[] };

/** Melhor casamento de UM token no texto normalizado, na hierarquia
 *  substring → subsequência → typo. Null quando nada bate. */
function matchToken(
  token: string,
  norm: string,
  palavrasNorm: { inicio: number; fim: number }[]
): MatchToken | null {
  // 1) substring — o match de sempre: todo ponto de ocorrência é
  // candidato, o mais cedo na palavra vence
  let melhor: MatchToken | null = null;
  let pos = norm.indexOf(token);
  while (pos !== -1) {
    const score =
      100 + (ehBordaDePalavra(norm, pos) ? 20 : 0) - pos * 0.1;
    if (!melhor || score > melhor.score) {
      melhor = {
        score,
        pos: Array.from({ length: token.length }, (_, k) => pos + k),
      };
    }
    pos = norm.indexOf(token, pos + 1);
  }
  if (melhor) return melhor;

  // 2) subsequência — letras na ordem com espaços entre elas ("mra" acha
  // "Maria", "js" acha "João Silva"). Menor span vence (run apertado
  // vale mais que letras espalhadas pelo texto).
  let melhorIdx: number[] | null = null;
  let melhorSpan = Infinity;
  for (let i = 0; i <= norm.length - token.length; i++) {
    if (norm[i] !== token[0]) continue;
    const idx = [i];
    let j = i;
    for (let k = 1; k < token.length; k++) {
      j = norm.indexOf(token[k], j + 1);
      if (j === -1) break;
      idx.push(j);
    }
    if (idx.length !== token.length) continue;
    const span = idx[idx.length - 1] - idx[0] + 1;
    if (span < melhorSpan) {
      melhorSpan = span;
      melhorIdx = idx;
    }
  }
  if (melhorIdx) {
    const cobertura = token.length / melhorSpan;
    return {
      score:
        40 +
        cobertura * 25 +
        (ehBordaDePalavra(norm, melhorIdx[0]) ? 5 : 0) -
        melhorIdx[0] * 0.1,
      pos: melhorIdx,
    };
  }

  // 3) typo — token ≥4 letras a 1 edição de uma palavra do texto
  // ("marai"→"Maria", "vitoria"→"Vitória"). Marca a palavra inteira.
  if (token.length >= 4) {
    let melhorTypo: { score: number; pos: number[] } | null = null;
    for (const p of palavrasNorm) {
      const palavra = norm.slice(p.inicio, p.fim);
      if (Math.abs(palavra.length - token.length) > 1) continue;
      const dist = damerau(token, palavra, 1);
      if (dist > 1) continue;
      const score = 30 - dist * 5 - p.inicio * 0.1;
      if (!melhorTypo || score > melhorTypo.score) {
        melhorTypo = {
          score,
          pos: Array.from({ length: p.fim - p.inicio }, (_, k) => p.inicio + k),
        };
      }
    }
    if (melhorTypo) return melhorTypo;
  }
  return null;
}

/** O char em `i` continua o grafema anterior: marca combinante (o acento
 *  de um texto decomposto — import CSV pode chegar NFD) ou a metade baixa
 *  de um surrogate pair (emoji). Um trecho nunca corta no meio disso —
 *  acento solto vira glifo órfão e surrogate partido renderiza mojibake. */
const ehExtensaoGrafema = (texto: string, i: number): boolean => {
  const cp = texto.codePointAt(i);
  if (cp === undefined) return false;
  if (cp >= 0xdc00 && cp <= 0xdfff) return true;
  return /\p{M}/u.test(String.fromCodePoint(cp));
};

/** Posições normalizadas → trechos [início, fim) do texto ORIGINAL,
 *  fundidas quando adjacentes e estendidas até a borda do grafema. */
function paraTrechos(pos: number[], mapa: number[], texto: string): Trechos {
  const ordenadas = [...new Set(pos)].sort((a, b) => a - b);
  const trechos: Trechos = [];
  for (const p of ordenadas) {
    const inicio = mapa[p];
    let fim = mapa[p] + 1;
    while (fim < texto.length && ehExtensaoGrafema(texto, fim)) fim++;
    const ultima = trechos[trechos.length - 1];
    if (ultima && inicio <= ultima[1]) ultima[1] = Math.max(ultima[1], fim);
    else trechos.push([inicio, fim]);
  }
  return trechos;
}

/** Match estrito: TODO token da busca precisa bater em algum lugar do
 *  texto (a ordem entre tokens é livre). Null = o item sai da lista. */
export function fuzzyMatch(query: string, texto: string): FuzzyHit | null {
  const tokens = normaliza(query).split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return null;
  const { norm, mapa } = mapaNormalizado(texto);
  if (!norm) return null;
  const ps = palavras(norm);
  let score = 0;
  const pos: number[] = [];
  for (const t of tokens) {
    const m = matchToken(t, norm, ps);
    if (!m) return null;
    score += m.score;
    pos.push(...m.pos);
  }
  // bônus de coesão: a query inteira como substring (os tokens colados na
  // ordem digitada) e o texto começando por ela — "maria s" digitado
  // certinho vale mais que duas palavras soltas casadas ao acaso
  const q = tokens.join(" ");
  if (norm.includes(q)) score += 60;
  if (norm.startsWith(q)) score += 25;
  return { score, trechos: paraTrechos(pos, mapa, texto) };
}

/** Trechos tolerantes pro highlight: devolve as faixas dos tokens que
 *  bateram NESTE texto mesmo que outros tokens tenham casado em outro
 *  campo do item (título × descrição, nome × e-mail). Vazio = nada a
 *  marcar — o item pode ter entrado por outro campo. */
export function fuzzyTrechos(query: string, texto: string): Trechos {
  const tokens = normaliza(query).split(/\s+/).filter(Boolean);
  if (tokens.length === 0 || !texto) return [];
  const { norm, mapa } = mapaNormalizado(texto);
  if (!norm) return [];
  const ps = palavras(norm);
  const pos: number[] = [];
  for (const t of tokens) {
    const m = matchToken(t, norm, ps);
    if (m) pos.push(...m.pos);
  }
  return paraTrechos(pos, mapa, texto);
}
