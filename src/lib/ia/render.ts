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
 *    verdade é parseTabelaMd. Por coluna saem `alinhamento` (do `:` do
 *    separador; sem `:` = esq) e `numerica` (todo valor do corpo é
 *    número, %, fração ou moeda — a UI alinha à direita e usa tabular-nums).
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
 *    - Bloco VÁLIDO vira uma linha-marca no texto devolvido — o gráfico
 *      fica na POSIÇÃO em que o modelo o escreveu, não numa faixa
 *      separada como os stats. extrairGraficos usa `\u0000grafico:<i>\u0000`
 *      (MARCA_GRAFICO); extrairBlocos põe o gráfico na fila comum de
 *      blocos e usa MARCA_BLOCO.
 *    - Bloco inválido ou fence sem fechar SAI do texto sem deixar marca:
 *      diferente do stats (que fica visível pra iterar o prompt), spec
 *      de gráfico cru é JSON de visualização — mostrar é ruído, não
 *      informação. O usuário nunca vê o JSON quebrado.
 *
 *  Convenção 5 — blocos interativos (genUI v3): ver a seção no meio do
 *    arquivo. extrairBlocos é o scanner único de todas as tags de fence
 *    (stats, grafico e os interativos) numa passada; segurarParcial
 *    esconde o rabo ainda incompleto durante o stream.
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

// fechar fence: mesma regra do MdLite — qualquer linha abrindo com ```
const FENCE = /^\s*```/;

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

// linha-marca que substitui o bloco válido no texto devolvido: \u0000 não
// aparece em texto do modelo, então a marca nunca colide com conteúdo.
// O MdLite reconhece a linha inteira e renderiza graficos[i] no lugar.
export const MARCA_GRAFICO = /^\u0000grafico:(\d+)\u0000$/;

// ---------- convenção 5: blocos interativos (genUI v3) ----------
//
// Fences que o modelo escreve, um objeto/array JSON por bloco, mesma regra
// de fence do stats/grafico (linha só com ```<tag>, qualquer ``` fecha):
//
//   ```sugestoes   ["Pergunta curta", …]               1–3, cada ≤60
//                  → chips de continuação no FIM da resposta (tocar envia)
//   ```escolha     {"pergunta","opcoes":[{"rotulo","valor"?}]}  2–5 opções
//                  → botões inline; tocar envia `valor ?? rotulo`
//   ```rascunho    {"canal","para"?,"assunto"?,"texto"}
//                  → mensagem pronta editável + Copiar / Abrir no WhatsApp
//   ```passos      {"titulo"?,"itens":[{"texto","detalhe"?}]}  2–8
//                  → roteiro com checkboxes locais
//   ```destaque    {"tom","titulo"?,"texto","fonte"?:{"rotulo","href"}}
//                  → callout de dica/atenção; href só /materiais/*
//
// Válido → linha-marca inline (MARCA_BLOCO) na posição em que o modelo
// escreveu (sugestoes sai do texto e vai pro fim). Inválido → some, exceto
// rascunho, que fica como code block (o texto da mensagem é informação).
// Com `streaming`, fence aberto vira MARCA_PENDENTE do kind — a UI
// desenha um skeleton do mesmo tamanho do resultado, sem JSON cru.

const sugestoesSchema = z.array(z.string().trim().min(2).max(60)).min(1).max(3);

const escolhaSchema = z.object({
  pergunta: z.string().trim().min(2).max(120),
  opcoes: z
    .array(
      z.object({
        rotulo: z.string().trim().min(1).max(40),
        valor: z.string().trim().min(1).max(120).optional(),
      })
    )
    .min(2)
    .max(5),
});
export type BlocoEscolha = z.infer<typeof escolhaSchema>;

const rascunhoSchema = z.object({
  canal: z.enum(["whatsapp", "email", "texto"]).default("texto"),
  para: z.string().trim().min(1).max(60).optional(),
  // `numero` is separate from `para` (display name): the model copies the
  // contact a tool returned verbatim, and waLink strips non-digits
  numero: z.string().trim().min(4).max(24).optional(),
  assunto: z.string().trim().min(1).max(80).optional(),
  texto: z.string().trim().min(1).max(1200),
});
export type BlocoRascunho = z.infer<typeof rascunhoSchema>;

const passosSchema = z.object({
  titulo: z.string().trim().min(1).max(60).optional(),
  itens: z
    .array(
      z.object({
        texto: z.string().trim().min(1).max(160),
        detalhe: z.string().trim().min(1).max(200).optional(),
      })
    )
    .min(2)
    .max(8),
});
export type BlocoPassos = z.infer<typeof passosSchema>;

const destaqueSchema = z.object({
  tom: z.enum(["dica", "atencao", "info"]).default("info"),
  titulo: z.string().trim().min(1).max(60).optional(),
  texto: z.string().trim().min(1).max(300),
  fonte: z
    .object({
      rotulo: z.string().trim().min(1).max(60),
      href: z.string().startsWith("/materiais"),
    })
    .optional(),
});
export type BlocoDestaque = z.infer<typeof destaqueSchema>;

export const BLOCO_SCHEMAS = {
  sugestoes: sugestoesSchema,
  escolha: escolhaSchema,
  rascunho: rascunhoSchema,
  passos: passosSchema,
  destaque: destaqueSchema,
} as const;

/** Bloco inline renderizável (o gráfico entra na mesma fila de marcas). */
export type BlocoMd =
  | { kind: "grafico"; g: Grafico }
  | { kind: "escolha"; b: BlocoEscolha }
  | { kind: "rascunho"; b: BlocoRascunho }
  | { kind: "passos"; b: BlocoPassos }
  | { kind: "destaque"; b: BlocoDestaque };

/** Tags de fence que a UI conhece — o skeleton de MARCA_PENDENTE usa. */
export type BlocoKind = "stats" | "sugestoes" | BlocoMd["kind"];

export const MARCA_BLOCO = /^\u0000bloco:(\d+)\u0000$/;
export const MARCA_PENDENTE = /^\u0000pendente:([a-z]+)\u0000$/;

const TAGS_BLOCO: readonly BlocoKind[] = [
  "stats",
  "grafico",
  "sugestoes",
  "escolha",
  "rascunho",
  "passos",
  "destaque",
];
const TODAS_AS_TAGS: ReadonlySet<BlocoKind> = new Set(TAGS_BLOCO);

// inválido/sem fechar que FICA como code block: stats (deslize visível pra
// iterar o prompt) e rascunho (o texto da mensagem é informação). O resto
// é JSON de interface — mostrar cru é ruído.
const FICA_COMO_CODIGO: ReadonlySet<BlocoKind> = new Set(["stats", "rascunho"]);

// a linha do fence é só ```<tag> — qualquer coisa a mais é fence comum
const ABRE_BLOCO = /^\s*```\s*([a-z]+)\s*$/i;

function tagDaLinha(
  linha: string,
  aceitas: ReadonlySet<BlocoKind>
): BlocoKind | null {
  const m = ABRE_BLOCO.exec(linha);
  if (!m) return null;
  const tag = m[1].toLowerCase();
  return (aceitas as ReadonlySet<string>).has(tag) ? (tag as BlocoKind) : null;
}

type Validado =
  | { tipo: "stats"; stats: Stat[] }
  | { tipo: "sugestoes"; sugestoes: string[] }
  | { tipo: "bloco"; bloco: BlocoMd };

function validarBloco(tag: BlocoKind, json: string): Validado | null {
  let dado: unknown;
  try {
    dado = JSON.parse(json);
  } catch {
    return null; // JSON quebrado: quem chama decide se some ou fica como código
  }
  switch (tag) {
    case "stats": {
      const p = statsSchema.safeParse(dado);
      return p.success ? { tipo: "stats", stats: p.data } : null;
    }
    case "sugestoes": {
      const p = sugestoesSchema.safeParse(dado);
      return p.success ? { tipo: "sugestoes", sugestoes: p.data } : null;
    }
    case "grafico": {
      const p = graficoSchema.safeParse(dado);
      return p.success
        ? { tipo: "bloco", bloco: { kind: "grafico", g: p.data } }
        : null;
    }
    case "escolha": {
      const p = escolhaSchema.safeParse(dado);
      return p.success
        ? { tipo: "bloco", bloco: { kind: "escolha", b: p.data } }
        : null;
    }
    case "rascunho": {
      const p = rascunhoSchema.safeParse(dado);
      return p.success
        ? { tipo: "bloco", bloco: { kind: "rascunho", b: p.data } }
        : null;
    }
    case "passos": {
      const p = passosSchema.safeParse(dado);
      return p.success
        ? { tipo: "bloco", bloco: { kind: "passos", b: p.data } }
        : null;
    }
    case "destaque": {
      const p = destaqueSchema.safeParse(dado);
      return p.success
        ? { tipo: "bloco", bloco: { kind: "destaque", b: p.data } }
        : null;
    }
  }
}

// chave de dedup das sugestões: caixa e espaço repetido não contam
const chaveSugestao = (s: string) =>
  s.toLocaleLowerCase("pt-BR").replace(/\s+/g, " ");

const MAX_SUGESTOES = 3;

type Escaneado = {
  stats: Stat[];
  blocos: BlocoMd[];
  sugestoes: string[];
  textoSemBloco: string;
};

/** Scanner único das tags de fence. `aceitas` limita quais tags contam
 *  (as outras passam como fence comum, conteúdo intacto) — é o que deixa
 *  extrairStats/extrairGraficos seguirem com o comportamento de antes. */
function escanear(
  texto: string,
  aceitas: ReadonlySet<BlocoKind>,
  streaming: boolean,
  marca: (i: number) => string
): Escaneado {
  const linhas = texto.split("\n");
  const saida: string[] = [];
  const stats: Stat[] = [];
  const blocos: BlocoMd[] = [];
  const sugestoes: string[] = [];
  const vistas = new Set<string>();
  // colapsa o vazio pendurado antes do que sai/entra no lugar do bloco
  const soltarVazio = () => {
    while (saida.length && saida[saida.length - 1].trim() === "") saida.pop();
  };
  let emFence = false; // fence comum (tag fora de `aceitas`) passa direto
  let i = 0;
  while (i < linhas.length) {
    const linha = linhas[i];
    if (emFence) {
      saida.push(linha);
      if (FENCE.test(linha)) emFence = false;
      i++;
      continue;
    }
    const tag = tagDaLinha(linha, aceitas);
    if (tag) {
      let fecha = -1;
      for (let j = i + 1; j < linhas.length; j++) {
        if (FENCE.test(linhas[j])) {
          fecha = j;
          break;
        }
      }
      if (fecha === -1) {
        // sem fechamento o fence engole até o fim do texto
        if (streaming) {
          // ainda chegando: uma marca de pendente no lugar (a UI desenha o
          // skeleton do kind) — nada de JSON cru piscando na bolha
          soltarVazio();
          if (saida.length) saida.push("");
          saida.push(`\u0000pendente:${tag}\u0000`);
        } else if (FICA_COMO_CODIGO.has(tag)) {
          saida.push(...linhas.slice(i));
        } else {
          soltarVazio();
        }
        break;
      }
      const v = validarBloco(tag, linhas.slice(i + 1, fecha).join("\n"));
      if (!v && FICA_COMO_CODIGO.has(tag)) {
        // inválido NÃO é removido — vira code block comum
        saida.push(...linhas.slice(i, fecha + 1));
        i = fecha + 1;
        continue;
      }
      soltarVazio();
      if (v?.tipo === "bloco") {
        if (saida.length) saida.push("");
        saida.push(marca(blocos.length));
        blocos.push(v.bloco);
      } else if (v?.tipo === "stats") {
        stats.push(...v.stats);
      } else if (v?.tipo === "sugestoes") {
        for (const s of v.sugestoes) {
          const k = chaveSugestao(s);
          if (sugestoes.length >= MAX_SUGESTOES || vistas.has(k)) continue;
          vistas.add(k);
          sugestoes.push(s);
        }
      }
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
  return { stats, blocos, sugestoes, textoSemBloco: saida.join("\n").trim() };
}

const marcaBloco = (i: number) => `\u0000bloco:${i}\u0000`;
const marcaGrafico = (i: number) => `\u0000grafico:${i}\u0000`;

/** Extrai todos os blocos de fence numa passada: stats vão pro topo
 *  (sem marca), sugestoes vão pro fim (sem marca, dedup, até 3) e os
 *  inline (grafico, escolha, rascunho, passos, destaque) deixam
 *  MARCA_BLOCO na posição original — o índice da marca aponta pra
 *  `blocos`. Com `streaming`, fence conhecido ainda aberto vira
 *  MARCA_PENDENTE da tag no lugar do resto do texto. */
export function extrairBlocos(
  texto: string,
  opts?: { streaming?: boolean }
): {
  stats: Stat[];
  blocos: BlocoMd[];
  sugestoes: string[];
  textoSemBloco: string;
} {
  return escanear(texto, TODAS_AS_TAGS, opts?.streaming ?? false, marcaBloco);
}

const SO_STATS: ReadonlySet<BlocoKind> = new Set(["stats"]);
const SO_GRAFICO: ReadonlySet<BlocoKind> = new Set(["grafico"]);

/** Só os ```stats (as outras tags passam como fence comum). Inválido ou
 *  sem fechar fica no texto como código. */
export function extrairStats(texto: string): {
  stats: Stat[];
  textoSemBloco: string;
} {
  const { stats, textoSemBloco } = escanear(texto, SO_STATS, false, marcaBloco);
  return { stats, textoSemBloco };
}

/** Só os ```grafico: o válido deixa MARCA_GRAFICO na posição original (o
 *  componente resolve pela lista `graficos`); o inválido/parcial sai de
 *  fininho — spec cru não é informação pro usuário. */
export function extrairGraficos(texto: string): {
  graficos: Grafico[];
  textoSemBloco: string;
} {
  const { blocos, textoSemBloco } = escanear(
    texto,
    SO_GRAFICO,
    false,
    marcaGrafico
  );
  const graficos = blocos.flatMap((b) => (b.kind === "grafico" ? [b.g] : []));
  return { graficos, textoSemBloco };
}

// ---------- stream: segurar o rabo incompleto ----------

// separador sendo digitado: só pipe, hífen, dois-pontos e espaço
const SEP_PARCIAL = /^\|[\s:|-]*$/;
// 1 ou 2 crases sozinhas na linha: começo de um ``` que ainda não chegou
const CRASE_PARCIAL = /^\s*`{1,2}\s*$/;
// linha de separador hr completa: 3+ do mesmo char (-, * ou _) colado —
// a regra que o MdLite usa pra desenhar o <hr>
export const HR_LINHA = /^\s*([-*_])\1{2,}\s*$/;
// separador hr se formando: 1-2 chars de -, * ou _ na última linha —
// segura até o 3º completar a linha (ou virar outra coisa: "- " abre
// item de lista, "**a" abre negrito)
const HR_PARCIAL = /^[-*_]{1,2}\s*$/;

/** Posição inicial do construto inline ainda aberto no fim da linha
 *  (-1 = nada a segurar): link "[" sem "]" ou "](" sem ")", negrito "**"
 *  sem o par de fechar e crase "`" de contagem ímpar. Cada um vira
 *  sintaxe crua visível enquanto o modelo digita o resto — segurar até
 *  fechar é o que impede "](/materiais" de piscar como texto. */
function inicioInlineParcial(linha: string): number {
  // link: "[" sem "]" depois; "]" exatamente no fim (o "(" pode ser o
  // próximo token); ou "](" sem o ")" fechando
  const abreLink = linha.lastIndexOf("[");
  if (abreLink >= 0) {
    const depois = linha.slice(abreLink);
    if (
      !depois.includes("]") ||
      depois.endsWith("]") ||
      /\]\([^)\s]*$/.test(depois)
    )
      return abreLink;
  }
  // "**texto" sem o "**" de fechar — conta os pares ANTES do último:
  // par = ele abre um bold novo (segura), ímpar = ele é o fechar de um
  // bold já aberto ("**a** x" não segura nada)
  const abreBold = linha.lastIndexOf("**");
  if (abreBold >= 0 && !linha.slice(abreBold + 2).includes("**")) {
    const paresAntes = linha.slice(0, abreBold).split("**").length - 1;
    if (paresAntes % 2 === 0) return abreBold;
  }
  // "`code" sem fechar: contagem ímpar de crases — desconta a run de
  // fence na abertura da linha ("```grafico" tem 3 e já foi tratado)
  const semFence = linha.replace(/^\s*`{3,}/, "");
  const crases = semFence.split("`").length - 1;
  if (crases % 2 === 1) return linha.lastIndexOf("`");
  return -1;
}

/** Durante o stream, tira do FIM do texto o pedaço que ainda não dá pra
 *  renderizar direito: cabeçalho de tabela sem separador completo (senão
 *  pisca como parágrafo de pipes e vira tabela um token depois), linha de
 *  corpo ainda sem o pipe final, e abertura de fence sendo digitada
 *  ("```gra"). Conservador: só mexe na última linha/bloco, nunca em
 *  tabela completa, texto comum ou conteúdo de fence aberto. Só faz
 *  sentido com o stream em andamento — no texto final não chame. */
export function segurarParcial(texto: string): string {
  const linhas = texto.split("\n");
  // dentro[i]: a linha i está dentro de um fence aberto antes dela (é
  // conteúdo ou fechamento) — mesma regra de toggle do MdLite
  const dentro: boolean[] = [];
  let emFence = false;
  for (const l of linhas) {
    dentro.push(emFence);
    if (FENCE.test(l)) emFence = !emFence;
  }
  const corta = (n: number) => linhas.slice(0, n).join("\n").trimEnd();
  const n = linhas.length;
  const ultima = linhas[n - 1];

  // abertura de fence ainda chegando (sem quebra de linha depois). A tag
  // conhecida inteira fica: o extrairBlocos já troca por pendente.
  if (!dentro[n - 1]) {
    if (FENCE.test(ultima) && !tagDaLinha(ultima, TODAS_AS_TAGS))
      return corta(n - 1);
    if (CRASE_PARCIAL.test(ultima)) return corta(n - 1);
  }

  // última posição vazia = a linha anterior chegou inteira (com "\n")
  let fim = n;
  if (ultima.trim() === "") fim--;
  const novaLinha = fim < n;
  // linha parcial (ainda sem "\n"): segura inline aberto — "[", "](" sem
  // ")", "**" e "`" aparecem como sintaxe crua enquanto o modelo digita.
  // Só revelam quando fecham; se nunca fechar, o texto final mostra cru
  // (segurarParcial só vale no stream, nunca esconde conteúdo do fim)
  if (!novaLinha && !dentro[n - 1]) {
    // "-" / "--" / "__" no fim: espera o 3º char do hr ou o texto que
    // desqualifica (item de lista) — senão pisca como parágrafo solto
    if (HR_PARCIAL.test(ultima)) return corta(n - 1);
    // hr já completo passa direto: "***" cairia no filtro de bold parcial
    // ("**" aberto no fim) e sairia como "*" até a próxima linha
    if (!HR_LINHA.test(ultima)) {
      const corte = inicioInlineParcial(ultima);
      if (corte >= 0)
        return [...linhas.slice(0, n - 1), ultima.slice(0, corte)]
          .join("\n")
          .trimEnd();
    }
  }
  // corrida final de linhas pipe fora de fence
  let k = fim;
  while (k > 0 && !dentro[k - 1] && linhas[k - 1].trim().startsWith("|")) k--;
  if (k === fim) return texto;

  const bloco = linhas.slice(k, fim);
  // só o cabeçalho: o separador ainda não chegou
  if (bloco.length === 1) return corta(k);
  const tabela = parseTabelaMd(bloco);
  if (tabela) {
    // tabela de verdade fica; só a linha de corpo ainda sem pipe final
    // espera (senão sai da tabela e pisca como texto embaixo dela)
    const ult = bloco[bloco.length - 1];
    if (bloco.length > 2 && !novaLinha && !ehTabelaMd(ult)) return corta(fim - 1);
    return texto;
  }
  // separador sendo digitado (ainda sem a última célula ou o pipe final)
  if (bloco.length === 2 && !novaLinha && SEP_PARCIAL.test(bloco[1].trim()))
    return corta(k);
  return texto;
}

// ---------- convenção 2: tabela pipe ----------

export type AlinhamentoColuna = "esq" | "dir" | "centro";

export type TabelaMd = {
  cab: string[];
  linhas: string[][];
  alinhamento: AlinhamentoColuna[];
  numerica: boolean[];
};

// separador GFM: -, :-, -:, :-: (alinhamento) — quantos hífens for
const CEL_SEPARADOR = /^:?-+:?$/;

function alinhamentoDe(sep: string): AlinhamentoColuna {
  const esq = sep.startsWith(":");
  const dir = sep.endsWith(":");
  if (esq && dir) return "centro";
  return dir ? "dir" : "esq";
}

// número em pt-BR ou en: sinal, moeda (R$, US$, $, €), milhar/decimal com
// . ou , (ou espaço fino), % no fim; ou fração "3/16"
const CEL_NUMERO =
  /^[+\-−]?(?:(?:R\$|US\$|\$|€)\s?)?[+\-−]?\d+(?:[.,\u00a0\u202f]\d+)*\s?%?$/;
const CEL_FRACAO = /^\d+(?:[.,]\d+)?\s?\/\s?\d+(?:[.,]\d+)?$/;
// travessão/hífen sozinho é "sem dado" na coluna numérica — não desqualifica
const CEL_VAZIA = /^[-–—]?$/;

function celulaNumerica(c: string): boolean {
  // o modelo às vezes destaca o número (**12**, `12`) — a ênfase não conta
  const t = c.replace(/^(\*\*|__|\*|_|`)(.*)\1$/, "$2").trim();
  return CEL_NUMERO.test(t) || CEL_FRACAO.test(t);
}

function colunasNumericas(cab: string[], corpo: string[][]): boolean[] {
  return cab.map((_, col) => {
    let algum = false;
    for (const l of corpo) {
      const c = l[col].trim();
      if (CEL_VAZIA.test(c)) continue;
      if (!celulaNumerica(c)) return false;
      algum = true;
    }
    return algum;
  });
}

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
  return {
    cab,
    linhas: corpo,
    alinhamento: sep.map(alinhamentoDe),
    numerica: colunasNumericas(cab, corpo),
  };
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
