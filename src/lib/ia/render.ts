/** UI generativa v1 (REALIZA-281/302) — parsing das convenções de texto
 *  que o modelo emite dentro do markdown da resposta. Só parsing e
 *  validação, sem React: a bolha (MdLite e a fileira de ações) consome
 *  estas funções pra decidir o que renderiza. O system prompt referencia
 *  estas convenções — mudou aqui, muda em prompts.ts.
 *
 *  Convenção 1 — bloco de indicadores ` ```stats `:
 *      ```stats
 *      [{"valor":"12","rotulo":"duplas em risco","tom":"danger"}]
 *      ```
 *    O fence é reconhecido pela tag `stats` (linha só com ```stats,
 *    case-insensitive, espaços em volta ok). O conteúdo é um array JSON de
 *    1 a 4 itens: `valor` (≤16 chars — número solto é coagido), `rotulo`
 *    (≤48), `tom` ∈ danger|warn|ok|info|neutro (omitiu = neutro) e
 *    `detalhe` opcional (≤90). Chaves a mais no objeto são ignoradas.
 *    - Bloco válido sai do texto e vira fileira de cartões.
 *    - Bloco inválido (JSON quebrado, schema fora, fence sem fechar) FICA
 *      no texto e renderiza como code block comum: a informação não some
 *      e o deslize fica visível pra iterar o prompt.
 *    - Mais de um bloco válido concatena em `stats` (cada bloco ≤4; a UI
 *      fatia se precisar). O scanner usa a mesma regra de fence do
 *      MdLite — qualquer linha ` ``` ` fecha — então a leitura nunca
 *      diverge do que a tela mostra.
 *
 *  Convenção 2 — tabela pipe (GFM estrito):
 *      | Coluna A | Coluna B |
 *      |---|---:|
 *      | 1 | 2 |
 *    Pipes externos obrigatórios; a 2ª linha é o separador — uma célula
 *    `-+` com `:` opcional nas pontas (alinhamento) por coluna do
 *    cabeçalho, mesmo número de colunas. Fora disso parseTabelaMd devolve
 *    null e as linhas seguem como texto comum. Linhas de corpo são
 *    ajustadas ao cabeçalho (célula a mais trunca, a menos vira "") e a
 *    tabela termina na primeira linha não-pipe. `\|` dentro da célula é
 *    pipe literal. `ehTabelaMd` só diz se UMA linha tem cara de linha
 *    pipe (o MdLite usa pra achar o bloco); quem decide se é tabela de
 *    verdade é parseTabelaMd.
 *
 *  Convenção 3 — fonte de guia inline:
 *    o modelo cita documento com link comum [rótulo](/materiais/documento/<slug>).
 *    extrairFontesTexto devolve {slug, rotulo} dos links cujo href começa
 *    com /materiais/ (slug = último segmento do path; dedup por slug,
 *    ordem de citação preservada) — a UI usa pra fileira "Fontes",
 *    separada dos chips de ação. Fontes são subconjunto dos links
 *    internos: quem monta as ações decide se filtra os /materiais/ pra
 *    não renderizar o mesmo link duas vezes.
 *
 *  Convenção 4 — bloco de gráfico ` ```grafico ` (genUI v2):
 *      ```grafico
 *      {"tipo":"barras","titulo":"Encontros por semana",
 *       "dados":[{"rotulo":"S1","valor":12,"tom":"ok"}]}
 *      ```
 *    O fence é reconhecido pela tag `grafico` (mesma regra do stats). O
 *    conteúdo é UM objeto JSON: `tipo` ∈ barras|barras-h|linha|area|
 *    rosca|progresso, `titulo` opcional (≤60), `dados` = 1–10 itens
 *    {rotulo ≤40, valor ≥0, tom opcional ∈ danger|warn|ok|info|pausa,
 *    detalhe opcional ≤80} e `total` opcional (o M do "N de M" do
 *    progresso). Chaves a mais são ignoradas.
 *    - Bloco VÁLIDO vira uma linha-marca `\u0000grafico:<i>\u0000` no
 *      texto devolvido — o gráfico fica na POSIÇÃO em que o modelo o
 *      escreveu, não numa faixa separada como os stats. O MdLite troca a
 *      marca pelo componente (`MARCA_GRAFICO` reconhece a linha).
 *    - Bloco inválido ou fence sem fechar SAI do texto sem deixar marca:
 *      diferente do stats (que fica visível pra iterar o prompt), spec
 *      de gráfico cru é JSON de visualização — mostrar é ruído, não
 *      informação. O usuário nunca vê o JSON quebrado.
 */

import { z } from "zod";

// ---------- convenção 1: bloco ```stats ----------

const tomSchema = z.enum(["danger", "warn", "ok", "info", "neutro"]);
export type StatTom = z.infer<typeof tomSchema>;

// limites de UI: o cartão é denso — valor cabe em destaque, rótulo numa
// linha, detalhe em duas. Fora disso o bloco não é stats válido.
const statSchema = z.object({
  valor: z.coerce.string().trim().min(1).max(16),
  rotulo: z.string().trim().min(1).max(48),
  tom: tomSchema.default("neutro"),
  detalhe: z.string().trim().min(1).max(90).optional(),
});
export type Stat = z.infer<typeof statSchema>;

const statsSchema = z.array(statSchema).min(1).max(4);

// a linha do fence é só ```stats — qualquer coisa a mais é fence comum
const ABRE_STATS = /^\s*```\s*stats\s*$/i;
// fechar fence: mesma regra do MdLite — qualquer linha abrindo com ```
const FENCE = /^\s*```/;

export function extrairStats(texto: string): {
  stats: Stat[];
  textoSemBloco: string;
} {
  const linhas = texto.split("\n");
  const saida: string[] = [];
  const stats: Stat[] = [];
  let emFence = false; // fence comum (qualquer tag ≠ stats) passa direto
  let i = 0;
  while (i < linhas.length) {
    const linha = linhas[i];
    if (emFence) {
      saida.push(linha);
      if (FENCE.test(linha)) emFence = false;
      i++;
      continue;
    }
    if (ABRE_STATS.test(linha)) {
      // sem fence de fechamento o bloco ainda está chegando (stream) —
      // fica como código, igual o MdLite mostra o parcial
      let fecha = -1;
      for (let j = i + 1; j < linhas.length; j++) {
        if (FENCE.test(linhas[j])) {
          fecha = j;
          break;
        }
      }
      let valido = false;
      if (fecha !== -1) {
        try {
          const parsed = statsSchema.safeParse(
            JSON.parse(linhas.slice(i + 1, fecha).join("\n"))
          );
          if (parsed.success) {
            stats.push(...parsed.data);
            valido = true;
          }
        } catch {
          // JSON quebrado: cai no caminho inválido e fica como código
        }
      }
      if (!valido) {
        // inválido NÃO é removido — vira code block comum e o conteúdo
        // não desaparece da resposta
        const fim = fecha === -1 ? linhas.length : fecha + 1;
        for (; i < fim; i++) saida.push(linhas[i]);
        continue;
      }
      // bloco removido: colapsa o vazio em volta — no máximo uma linha em
      // branco separando o antes do depois, nada pendurado nas pontas
      let j = fecha + 1;
      while (j < linhas.length && linhas[j].trim() === "") j++;
      while (saida.length && saida[saida.length - 1].trim() === "") saida.pop();
      if (saida.length && j < linhas.length) saida.push("");
      i = j;
      continue;
    }
    if (FENCE.test(linha)) emFence = true;
    saida.push(linha);
    i++;
  }
  return { stats, textoSemBloco: saida.join("\n").trim() };
}

// ---------- convenção 4: bloco ```grafico ----------

const graficoTomSchema = z.enum(["danger", "warn", "ok", "info", "pausa"]);
export type GraficoTom = z.infer<typeof graficoTomSchema>;

// limites de UI: o gráfico é inline na bolha — rótulo curto, detalhe de
// uma linha, até 10 fatias (o prompt recomenda ≤8). valor é número real
// ≥0 (a escala do eixo resolve a proporção; inteiro não é exigido).
const graficoDadoSchema = z.object({
  rotulo: z.string().trim().min(1).max(40),
  valor: z.number().finite().min(0),
  tom: graficoTomSchema.optional(),
  detalhe: z.string().trim().min(1).max(80).optional(),
});
export type GraficoDado = z.infer<typeof graficoDadoSchema>;

const graficoSchema = z.object({
  tipo: z.enum(["barras", "barras-h", "linha", "area", "rosca", "progresso"]),
  titulo: z.string().trim().min(1).max(60).optional(),
  dados: z.array(graficoDadoSchema).min(1).max(10),
  total: z.number().finite().positive().optional(),
});
export type Grafico = z.infer<typeof graficoSchema>;
export type GraficoTipo = Grafico["tipo"];

// a linha do fence é só ```grafico — qualquer coisa a mais é fence comum
const ABRE_GRAFICO = /^\s*```\s*grafico\s*$/i;

// linha-marca que substitui o bloco válido no texto devolvido: \u0000 não
// aparece em texto do modelo, então a marca nunca colide com conteúdo.
// O MdLite reconhece a linha inteira e renderiza graficos[i] no lugar.
export const MARCA_GRAFICO = /^\u0000grafico:(\d+)\u0000$/;
const marca = (i: number) => `\u0000grafico:${i}\u0000`;

/** Extrai os blocos ```grafico do texto. O válido deixa uma linha-marca
 *  na posição original (o componente resolve pela lista `graficos`); o
 *  inválido/parcial sai de fininho — spec cru não é informação pro
 *  usuário. Mesmo scanner do extrairStats: qualquer linha ``` fecha um
 *  fence, então a leitura nunca diverge do MdLite. */
export function extrairGraficos(texto: string): {
  graficos: Grafico[];
  textoSemBloco: string;
} {
  const linhas = texto.split("\n");
  const saida: string[] = [];
  const graficos: Grafico[] = [];
  let emFence = false; // fence comum (qualquer tag ≠ grafico) passa direto
  let i = 0;
  while (i < linhas.length) {
    const linha = linhas[i];
    if (emFence) {
      saida.push(linha);
      if (FENCE.test(linha)) emFence = false;
      i++;
      continue;
    }
    if (ABRE_GRAFICO.test(linha)) {
      // sem fence de fechamento o spec ainda está chegando (stream) —
      // tudo depois da tag é conteúdo do fence: some por ora e o gráfico
      // entra de uma vez quando o fence fecha
      let fecha = -1;
      for (let j = i + 1; j < linhas.length; j++) {
        if (FENCE.test(linhas[j])) {
          fecha = j;
          break;
        }
      }
      let g: Grafico | null = null;
      if (fecha !== -1) {
        try {
          const parsed = graficoSchema.safeParse(
            JSON.parse(linhas.slice(i + 1, fecha).join("\n"))
          );
          if (parsed.success) g = parsed.data;
        } catch {
          // JSON quebrado: g segue null → o bloco some sem marca
        }
      }
      // colapsa o vazio pendurado antes do bloco
      while (saida.length && saida[saida.length - 1].trim() === "") saida.pop();
      if (g) {
        if (saida.length) saida.push("");
        saida.push(marca(graficos.length));
        graficos.push(g);
      }
      if (fecha === -1) break;
      // pula o vazio depois do fence — uma linha em branco separa a marca
      // (ou o texto) do que vem a seguir, nada pendurado nas pontas
      let j = fecha + 1;
      while (j < linhas.length && linhas[j].trim() === "") j++;
      if (saida.length && j < linhas.length) saida.push("");
      i = j;
      continue;
    }
    if (FENCE.test(linha)) emFence = true;
    saida.push(linha);
    i++;
  }
  return { graficos, textoSemBloco: saida.join("\n").trim() };
}

// ---------- convenção 2: tabela pipe ----------

export type TabelaMd = { cab: string[]; linhas: string[][] };

// separador GFM: -, :-, -:, :-: (alinhamento) — quantos hífens for
const CEL_SEPARADOR = /^:?-+:?$/;

/** Uma linha tem cara de linha pipe-table: pipes externos e pelo menos
 *  uma célula (a própria linha separadora também passa — quem decide se o
 *  bloco é tabela é parseTabelaMd, que exige o separador na posição 2). */
export function ehTabelaMd(linha: string): boolean {
  const t = linha.trim();
  return t.length > 1 && t.startsWith("|") && t.endsWith("|");
}

function dividirLinhaPipe(linha: string): string[] {
  // \| é pipe literal dentro da célula — troca por sentinela antes de
  // dividir pra não quebrar coluna (o modelo escapa quando precisa)
  const t = linha.trim().replace(/\\\|/g, "\u0000");
  // ehTabelaMd garantiu os pipes externos — tira as pontas e divide
  return t
    .slice(1, -1)
    .split("|")
    .map((c) => c.replace(/\u0000/g, "|").trim());
}

/** Consome o bloco pipe-table começando em linhas[0]: cabeçalho +
 *  separador + corpo enquanto a linha for pipe. Devolve null quando não é
 *  tabela — as linhas seguem como texto comum no MdLite. */
export function parseTabelaMd(linhas: string[]): TabelaMd | null {
  if (linhas.length < 2) return null;
  if (!ehTabelaMd(linhas[0]) || !ehTabelaMd(linhas[1])) return null;
  const cab = dividirLinhaPipe(linhas[0]);
  const sep = dividirLinhaPipe(linhas[1]);
  // separador tem que fechar uma célula por coluna — "| a | b |" seguido
  // de "|---|" é texto com pipes, não tabela
  if (sep.length !== cab.length || !sep.every((c) => CEL_SEPARADOR.test(c)))
    return null;
  const corpo: string[][] = [];
  for (const l of linhas.slice(2)) {
    if (!ehTabelaMd(l)) break; // a tabela acaba na primeira linha não-pipe
    const cel = dividirLinhaPipe(l);
    // normaliza ao cabeçalho: célula a mais trunca, a menos completa ""
    cel.length = Math.min(cel.length, cab.length);
    while (cel.length < cab.length) cel.push("");
    corpo.push(cel);
  }
  return { cab, linhas: corpo };
}

// ---------- convenção 3: fonte de guia inline ----------

export type FonteTexto = { slug: string; rotulo: string; href: string };

// mesmo shape do LINK_INTERNO de mensagens.ts, restrito a /materiais/ —
// são as citações de guia, não as ações de navegação
const LINK_MATERIAIS = /\[([^\]]+)\]\((\/materiais\/[^)\s]+)\)/g;

export function extrairFontesTexto(texto: string): FonteTexto[] {
  const fontes: FonteTexto[] = [];
  const vistos = new Set<string>();
  for (const m of texto.matchAll(LINK_MATERIAIS)) {
    // slug = último segmento do path — "/materiais/documento/<slug>" cita
    // um guia, "/materiais/biblioteca" cita a seção; query/hash e barra
    // final não fazem parte do slug
    const path = m[2].split(/[?#]/)[0].replace(/\/+$/, "");
    const slug = path.slice(path.lastIndexOf("/") + 1);
    if (!slug || vistos.has(slug)) continue;
    vistos.add(slug);
    fontes.push({ slug, rotulo: m[1], href: m[2] });
  }
  return fontes;
}
