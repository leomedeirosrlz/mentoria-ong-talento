// Estrutura interativa dos instrumentos oficiais (0080) — helpers puros,
// sem I/O nem React, compartilhados pelo /f/<token> sob medida
// (src/components/instrumentos), pelo resultado estruturado da ficha e
// pelos testes. Espelha as convenções da migration 0080:
//   · a 'secao' que precede um grupo de escala_1_10 é o quadrante da roda;
//   · meta_N + is_N + prazo_N (PDM) e meta_N + porque_N (Definindo Metas)
//     formam o grupo de uma meta; submetas_N é o desdobramento do PDM.

import {
  INSTRUMENTOS_SISTEMA,
  type FormularioCampo,
  type FormularioSistema,
  type InstrumentoSistema,
} from "./schema";

/** O sistema é um dos 4 instrumentos de jornada (0080) com experiência
 *  sob medida no /f/<token> — 360/avaliação da trilha, intakes e forms
 *  criados pela coordenação seguem no renderer genérico. */
export function ehInstrumento(
  s: FormularioSistema | null | undefined
): s is InstrumentoSistema {
  return !!s && (INSTRUMENTOS_SISTEMA as readonly string[]).includes(s);
}

// ---------- agrupamento por seções ----------

export type BlocoSecao = {
  /** a 'secao' que abre o bloco; null pros campos antes da primeira */
  secao: FormularioCampo | null;
  campos: FormularioCampo[];
};

/** Reparte os campos pelas seções que os abrem — capítulo a capítulo.
 *  O primeiro bloco carrega secao=null quando o form começa direto com
 *  perguntas (não acontece nos oficiais, mas um form editado pode). */
export function agrupaEmSecoes(campos: FormularioCampo[]): BlocoSecao[] {
  const blocos: BlocoSecao[] = [];
  let atual: BlocoSecao | null = null;
  for (const c of campos) {
    if (c.tipo === "secao") {
      atual = { secao: c, campos: [] };
      blocos.push(atual);
      continue;
    }
    if (!atual) {
      atual = { secao: null, campos: [] };
      blocos.push(atual);
    }
    atual.campos.push(c);
  }
  return blocos;
}

// ---------- Roda da Vida ----------

export type QuadranteCampos = {
  /** rótulo da 'secao' do quadrante ("" pra áreas órfãs de seção) */
  nome: string;
  campos: FormularioCampo[];
};

export type EstruturaRoda = {
  /** seções que precedem a primeira escala — texto de instrução
   *  ("Como funciona"), não quadrante */
  intro: FormularioCampo[];
  quadrantes: QuadranteCampos[];
  /** perguntas que não são escala_1_10 (a reflexão final) */
  extras: FormularioCampo[];
};

/** Lê a estrutura da roda a partir da definição: seções introdutórias,
 *  quadrantes com seus campos de escala e as perguntas extras. A regra
 *  espelha extraiRodaDaVida (schema.ts): uma 'secao' é quadrante quando
 *  o bloco dela tem escala_1_10 ("Pessoal"); sem escala, é instrução
 *  ("Como funciona"). Devolve null quando não há nenhuma escala — ou
 *  seja, não é uma roda. */
export function extraiEstruturaRoda(campos: FormularioCampo[]): EstruturaRoda | null {
  const intro: FormularioCampo[] = [];
  const quadrantes: QuadranteCampos[] = [];
  const extras: FormularioCampo[] = [];

  for (const b of agrupaEmSecoes(campos)) {
    const escalas = b.campos.filter((c) => c.tipo === "escala_1_10");
    const outros = b.campos.filter((c) => c.tipo !== "escala_1_10");
    if (escalas.length) {
      // bloco com escala = quadrante (a secao nomeia; sem secao = "")
      quadrantes.push({ nome: b.secao?.label ?? "", campos: escalas });
    } else if (b.secao) {
      // seção sem escala nenhuma = instrução de abertura
      intro.push(b.secao);
    }
    // perguntas de outro tipo (a reflexão final, ou qualquer extra num
    // form editado) nunca somem da tela — sempre vão pra extras
    extras.push(...outros);
  }

  if (!quadrantes.length) return null;
  return { intro, quadrantes, extras };
}

// ---------- geometria do radar (compartilhada form + resultado) ----------

export const RODA_CX = 160;
export const RODA_CY = 160;
export const RODA_RAIO = 118;

/** Ponto do eixo i na fração 0–1 do raio — eixo 0 aponta pra cima. */
export function pontoEixo(
  i: number,
  total: number,
  fracao: number
): { x: number; y: number } {
  const ang = -Math.PI / 2 + (i * 2 * Math.PI) / total;
  return {
    x: RODA_CX + RODA_RAIO * fracao * Math.cos(ang),
    y: RODA_CY + RODA_RAIO * fracao * Math.sin(ang),
  };
}

/** Pontos do polígono de um anel (nível 1–10) ou dos dados (frações por
 *  eixo) — string "x,y x,y …" pronta pro atributo points do <polygon>. */
export function pontosPoligono(total: number, fracoes: number[]): string {
  return fracoes
    .map((f, i) => {
      const p = pontoEixo(i, total, f);
      return `${p.x.toFixed(1)},${p.y.toFixed(1)}`;
    })
    .join(" ");
}

/** Meio do arco de um quadrante — posição do rótulo fora do aro. */
export function rotuloQuadrante(
  inicio: number,
  qtdAreas: number,
  total: number,
  distancia: number
): { x: number; y: number } {
  const meio = inicio + (qtdAreas - 1) / 2;
  const ang = -Math.PI / 2 + (meio * 2 * Math.PI) / total;
  return {
    x: RODA_CX + (RODA_RAIO + distancia) * Math.cos(ang),
    y: RODA_CY + (RODA_RAIO + distancia) * Math.sin(ang),
  };
}

/** Distância além do aro onde nasce a coroa de rótulos de área no modo
 *  desktop (variante A — REALIZA-143): cada eixo ganha o nome da área no
 *  lugar do número 1–16. */
export const RODA_ROTULO_GAP = 16;

/** Quebra o rótulo de uma área da roda em até 2 linhas curtas pra coroar
 *  o desenho no desktop (REALIZA-143, mesmo corte do mock
 *  instrumentos/v1: "Saúde e\ndisposição", "Escola /\nuniversidade").
 *  Preenchimento guloso por palavra com teto de `max` caracteres por
 *  linha; um "/" solto cola na linha corrente, nunca abre a próxima.
 *  Palavra única maior que `max` fica inteira na sua linha; o excedente
 *  de uma 3ª linha fecha na 2ª (rótulo editado gigante estoura a linha
 *  em vez de sumir). */
export function quebraRotuloEixo(label: string, max = 14): string[] {
  const palavras = label.trim().split(/\s+/).filter(Boolean);
  const linhas: string[] = [];
  let atual = "";
  for (const w of palavras) {
    if (w === "/" && atual) {
      atual = `${atual} /`;
      continue;
    }
    const cand = atual ? `${atual} ${w}` : w;
    if (!atual || cand.length <= max) {
      atual = cand;
      continue;
    }
    linhas.push(atual);
    atual = w;
  }
  if (atual) linhas.push(atual);
  return linhas.length <= 2 ? linhas : [linhas[0], linhas.slice(1).join(" ")];
}

export type AlvoPonteiro = {
  /** índice do eixo mais próximo do ângulo apontado */
  indice: number;
  /** nota 1–10 pela distância ao centro (fora do aro continua 10) */
  nota: number;
};

/** Converte um ponto no espaço do viewBox (0–320) em eixo + nota — o
 *  gesto de arrastar na roda. O ângulo escolhe o eixo mais próximo; a
 *  distância ao centro escolhe a nota (centro = 1, aro = 10). */
export function lePonteiro(x: number, y: number, total: number): AlvoPonteiro {
  const dx = x - RODA_CX;
  const dy = y - RODA_CY;
  const passo = (2 * Math.PI) / total;
  // atan2 mede a partir do eixo +x; -π/2 realinha pro eixo 0 apontar pra cima
  const ang = Math.atan2(dy, dx) + Math.PI / 2;
  const bruto = Math.round(ang / passo);
  const indice = ((bruto % total) + total) % total;
  const nota = Math.min(
    10,
    Math.max(1, Math.round((Math.hypot(dx, dy) / RODA_RAIO) * 10))
  );
  return { indice, nota };
}

// ---------- grupos de metas (metas + pdm) ----------

export type GrupoMetaCampos = {
  n: number;
  meta: FormularioCampo;
  /** indicador de sucesso (PDM) */
  is?: FormularioCampo;
  /** prazo ISO (PDM) */
  prazo?: FormularioCampo;
  /** porquê (Definindo Metas) */
  porque?: FormularioCampo;
  /** desdobramento (PDM) */
  submetas?: FormularioCampo;
};

const META_CAMPO_RE = /^meta_(\d+)$/;
const SUB_META_RE = /^(is|prazo|porque|submetas)_(\d+)$/;

/** Agrupa meta_N/is_N/prazo_N/porque_N/submetas_N em grupos por N — a
 *  ordenação segue o número da meta, não a posição no array. Campos que
 *  não seguem a convenção ficam de fora (o renderer decide o resto). */
export function extraiGruposMeta(campos: FormularioCampo[]): GrupoMetaCampos[] {
  const porN = new Map<number, GrupoMetaCampos>();
  for (const c of campos) {
    const m = META_CAMPO_RE.exec(c.id);
    if (m) {
      const n = Number(m[1]);
      porN.set(n, { ...(porN.get(n) ?? { n }), n, meta: c });
      continue;
    }
    const g = SUB_META_RE.exec(c.id);
    if (!g) continue;
    const n = Number(g[2]);
    const atual = porN.get(n) ?? ({ n } as GrupoMetaCampos);
    if (g[1] === "is") atual.is = c;
    else if (g[1] === "prazo") atual.prazo = c;
    else if (g[1] === "porque") atual.porque = c;
    else atual.submetas = c;
    porN.set(n, atual);
  }
  // grupo sem campo meta_N (ex.: submetas_4 sem meta_4) não é meta —
  // renderizaria uma ficha sem título
  return [...porN.values()]
    .filter((g): g is GrupoMetaCampos & { meta: FormularioCampo } =>
      Boolean(g.meta)
    )
    .sort((a, b) => a.n - b.n);
}
