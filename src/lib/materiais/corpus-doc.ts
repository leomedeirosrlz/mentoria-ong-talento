// Leitura server-side do corpus RAG (docs/rag/*.md) pra render nativo em
// /materiais/documento/<slug> e /jovem/materiais/documento/<slug>. A página
// renderiza por request (o layout é dinâmico por auth), então os md precisam
// chegar ao bundle de produção — o outputFileTracingIncludes do next.config
// cobre as duas rotas. Se o diretório não estiver no artefato (misconfig), o
// loader devolve null/vazio e a rota cai em notFound em vez de 500.
//
// O fatiamento é port do parseDoc de scripts/lib/rag-chunks.mjs (.mjs, não
// importável) COM UMA diferença deliberada: lá a intro curta de um ## vira
// contexto embutido em cada ### (boa pra chunk); aqui ela renderiza uma vez,
// sob o h2 — duplicar o texto em todas as subs leria quebrado na página. Os
// nomes de seção ("<##> › <###>") são idênticos nos dois lados, então
// secaoAnchor(secao) bate com a citação.

import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { cache } from "react";
import type { CalloutTom, DocBloco, DocTom } from "@/lib/materiais-documentos";
import { veMaterial } from "@/lib/materiais";
import type { AppRole } from "@/lib/types";
import { secaoAnchor } from "./corpus-anchor";

export type CorpusSecao = {
  /** "##" ou "## › ###" — idêntico à coluna secao de ia_chunks. */
  secao: string;
  /** texto do heading exibido (último nível do caminho, sem marcadores md). */
  titulo: string;
  /** título do ## pai (só ###); null pra seção de nível 2. */
  grupo: string | null;
  nivel: 2 | 3;
  /** secaoAnchor(secao) — id do heading na página. */
  anchor: string;
  /** índice da fase (0-based) quando o ## casa FASE_RE e renderiza como
   *  banda colorida — os grupos de mês da jornada e as seções que abrem
   *  grandes partes do guia. null nos ## comuns e em toda ###. */
  fase: number | null;
  blocos: DocBloco[];
};

export type CorpusDoc = {
  /** slug da URL — o `material` do frontmatter (fallback fonte/arquivo). */
  slug: string;
  fonte: string;
  titulo: string;
  tipo: string | null;
  natureza: string | null;
  versao: string | null;
  origem: string | null;
  /** papéis do frontmatter normalizados pros do catálogo (dpp→mentor_dpp). */
  audiencia: string[];
  /** conteúdo entre o h1 e o primeiro ## (lede/intro do doc). */
  lede: DocBloco[];
  /** âncora da seção que o RAG indexa com o título do doc (o lede). */
  ledeAnchor: string | null;
  secoes: CorpusSecao[];
};

/** Grupo de render: um ## + sua intro (seção de nível 2, quando existe) +
 *  as subs ### em ordem. */
export type CorpusGrupo = {
  titulo: string;
  anchor: string;
  intro: CorpusSecao | null;
  subs: CorpusSecao[];
  /** mesma numeração de fase das seções — propagada pela intro ou
   *  re-derivada do título quando o ## não gerou seção (só subs). */
  fase: number | null;
};

const DIR = () => path.join(process.cwd(), "docs", "rag");

// ---------- front-matter ----------

type Frontmatter = Record<string, string>;

/** Chaves na coluna 0; continuações indentadas dobram com espaço (o `origem`
 *  do corpus é multi-linha). Aspas externas saem do valor. O parseDoc do
 *  ingest exige os campos; aqui tolera — o que faltar cai em fallback na
 *  render, sem derrubar a página. */
function frontmatter(raw: string): { meta: Frontmatter; corpo: string } | null {
  const fm = /^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/.exec(raw);
  if (!fm) return null;
  const meta: Frontmatter = {};
  let chave: string | null = null;
  for (const linha of fm[1].split("\n")) {
    const m = /^([a-z_]+):\s*(.*)$/.exec(linha);
    if (m) {
      chave = m[1];
      meta[chave] = m[2].trim();
    } else if (chave && /^\s+\S/.test(linha)) {
      meta[chave] = `${meta[chave]} ${linha.trim()}`.replace(/\s+/g, " ").trim();
    }
  }
  for (const k of Object.keys(meta)) {
    meta[k] = meta[k].replace(/^"([^"]*)"\s*$/, "$1");
  }
  return { meta, corpo: fm[2] };
}

// a audiência do corpus usa também os valores legados de coluna única
// (audienciasDe em materiais.ts): dpp = mentor_dpp, especialista = mentor_esp.
const PAPEL_LEGADO: Record<string, string> = {
  dpp: "mentor_dpp",
  especialista: "mentor_especialista",
};

function audienciaDe(meta: Frontmatter): string[] {
  const bruto = meta["audiencia"];
  if (!bruto) return [];
  return bruto
    .replace(/^\[/, "")
    .replace(/\]$/, "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((a) => PAPEL_LEGADO[a] ?? a);
}

// ---------- markdown → DocBloco ----------

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** inline mínimo do corpus: **negrito** e *itálico* sobre texto escapado.
 *  Não tem link, código inline nem imagem no corpus (auditoria 11/2026). */
function inlineMd(s: string): string {
  return escapeHtml(s)
    .replace(/\*\*([^*]+)\*\*/g, "<b>$1</b>")
    .replace(/\*([^*]+)\*/g, "<i>$1</i>");
}

function celulasTabela(linha: string): string[] {
  return linha
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((c) => c.trim());
}

function blocoTabela(linhas: string[]): DocBloco | null {
  if (linhas.length < 2) return null;
  // sem a linha separadora |---| não é tabela de verdade — vira parágrafo
  if (!celulasTabela(linhas[1]).every((c) => /^:?-+:?$/.test(c))) return null;
  const cabecalho = celulasTabela(linhas[0]);
  const dados = linhas.slice(2).map(celulasTabela);
  // ficha de marcação (checklist do cap. 14): toda célula além da primeira
  // coluna vem vazia — o renderer desenha o checkbox no lugar
  const marcacao =
    cabecalho.length > 1 &&
    dados.length > 0 &&
    dados.every((ln) => ln.slice(1).every((c) => c === ""));
  return {
    kind: "tabela",
    cabecalho: cabecalho.map(inlineMd),
    linhas: dados.map((ln) => ln.map(inlineMd)),
    ...(marcacao ? { marcacao: true } : {}),
  };
}

// ---------- the guide's visual vocabulary ----------
// The corpus carries the PDF block semantics as explicit markdown:
// `*(…)*` alone (or closing a paragraph) → callout with keyword-derived
// tone; `*"…" (source)*` → quote; `**N. Título.**` → numbered item;
// `### Nº encontro` and `**Nº ENCONTRO: T.**` → encounter card with task
// and route slots. Everything else stays a paragraph with **bold**/*italic*.

const RE_ENCONTRO_TITULO = /^(\d+)º encontro · (.+)$/;
const RE_ENCONTRO_PAR = /^\*\*(\d+)º\s+encontro\s*:\s*([^*]+?)\.\*\*\s+([\s\S]+)$/i;
const RE_NUMERO_PAR = /^\*\*(\d+)\.\s*([^*]+?)\.\*\*\s+([\s\S]+)$/;
const RE_QUOTE_PAR = /^\*"([\s\S]+?)"\s*\(([^()]+)\)\*$/;
const RE_CALLOUT_PAR = /^\*\(([\s\S]+)\)\*$/;
const RE_CALLOUT_FINAL = /^([\s\S]+?)\s*\*\(([^*]+)\)\*$/;
const RE_PASSO_FIM = /\s*Passo a passo:\s*Roteiro do (\d+)º encontro\.?\s*$/;
const RE_TAREFA_FIM =
  /(?:\b[Dd]aqui\s+sai\s+)?(?:\b[Aa]\s+)?[Tt]arefa\s*(?::|é)\s+([\s\S]+?)\.\s*$/;

// callout tone from the note's opening word (the corpus always labels it):
// Atualização/Nota → info; Atenção/Importante/Cuidado → warn; Dica/Sugestão
// → tip; no keyword → editorial reflection (note, italic gray)
const TOM_CALLOUT: [RegExp, CalloutTom][] = [
  [/^(atualiza|nota)\b/i, "info"],
  [/^(aten|importante|cuidado)\b/i, "warn"],
  [/^(dica|sugest)\b/i, "tip"],
];

function tomCallout(inner: string): CalloutTom {
  const t = inner.trim().toLowerCase();
  for (const [re, tom] of TOM_CALLOUT) if (re.test(t)) return tom;
  return "note";
}

/** Callout html: the leading keyword ("Atualização:", "Dica:"…) becomes a
 *  bold label for scanning. */
function htmlCallout(inner: string): string {
  return inlineMd(inner).replace(/^([^:]{1,30}:)\s/, "<b>$1</b> ");
}

/** Splits the trailing slots off an encounter body: "Passo a passo:
 *  Roteiro do Nº encontro." becomes a route link; "Tarefa: X." /
 *  "a tarefa é X." becomes the task slot. */
function extrairSlotsEncontro(html: string): {
  html: string;
  tarefa?: string;
  roteiro?: { slug: string; rotulo: string };
} {
  let tarefa: string | undefined;
  let roteiro: { slug: string; rotulo: string } | undefined;
  const mPasso = RE_PASSO_FIM.exec(html);
  if (mPasso) {
    roteiro = {
      slug: `roteiro-encontro-${mPasso[1].padStart(2, "0")}`,
      rotulo: `Roteiro do ${mPasso[1]}º encontro`,
    };
    html = html.slice(0, mPasso.index);
  }
  const mTarefa = RE_TAREFA_FIM.exec(html);
  if (mTarefa) {
    tarefa = mTarefa[1].trim();
    html = html.slice(0, mTarefa.index);
  }
  // the task usually comes from a "; a tarefa é …" clause — leftover ";"
  return { html: html.replace(/[;:]\s*$/, ".").trimEnd(), tarefa, roteiro };
}

function mkEncontro(
  numero: string,
  titulo: string,
  anchor: string | undefined,
  corpoHtml: string,
  resto: DocBloco[]
): DocBloco {
  const { html, tarefa, roteiro } = extrairSlotsEncontro(corpoHtml);
  const corpo: DocBloco[] = html ? [{ kind: "par", html }] : [];
  corpo.push(...resto);
  return {
    kind: "encontro",
    numero,
    titulo,
    ...(anchor ? { anchor } : {}),
    corpo,
    ...(tarefa ? { tarefa } : {}),
    ...(roteiro ? { roteiro } : {}),
  };
}

function blocoPar(texto: string): DocBloco[] {
  // "**Assunto:** X" — the e-mail subject marker of the templates (subj)
  const mSubj = /^\*\*Assunto:\*\*\s+(.+)$/.exec(texto);
  if (mSubj) return [{ kind: "subj", texto: mSubj[1].replace(/\*\*/g, "") }];
  // *"…" (source)* — blockquote
  const mQuote = RE_QUOTE_PAR.exec(texto);
  if (mQuote) {
    return [
      {
        kind: "quote",
        html: inlineMd(`"${mQuote[1]}"`),
        fonte: mQuote[2].trim(),
      },
    ];
  }
  // whole *( … )* — the corpus editorial note (platform updates)
  const mCallout = RE_CALLOUT_PAR.exec(texto);
  if (mCallout) {
    return [
      { kind: "callout", tom: tomCallout(mCallout[1]), html: htmlCallout(mCallout[1]) },
    ];
  }
  // "**Nº ENCONTRO: T.** …" — inline encounter card (specialist track)
  const mEnc = RE_ENCONTRO_PAR.exec(texto);
  if (mEnc) {
    return [mkEncontro(mEnc[1], mEnc[2].trim(), undefined, inlineMd(mEnc[3]), [])];
  }
  // "**N. Título.** …" — numbered item (the nine mentor functions)
  const mNum = RE_NUMERO_PAR.exec(texto);
  if (mNum) {
    return [
      {
        kind: "numero",
        numero: mNum[1],
        titulo: mNum[2].trim(),
        html: inlineMd(mNum[3]),
      },
    ];
  }
  // *( … )* closing the paragraph — the note leaves the body as a callout
  const mFinal = RE_CALLOUT_FINAL.exec(texto);
  if (mFinal) {
    return [
      { kind: "par", html: inlineMd(mFinal[1]) },
      {
        kind: "callout",
        tom: tomCallout(mFinal[2]),
        html: htmlCallout(mFinal[2]),
      },
    ];
  }
  return [{ kind: "par", html: inlineMd(texto) }];
}

const RE_ITEM_LISTA = /^(-|\d+\.)\s/;

// ---------- fases, tons e a trilha de encontros ----------
// The PDF rotates full-width chapter bands (lime/amber/teal): `##` matching
// FASE_RE renders as a tinted band and gets a phase index in doc order —
// the "Encontros N a M" month groups plus the sections opening big parts.

/** `##` que vira banda: grupos de mês da jornada ("Encontros 1 a 4",
 *  "Encontros 8 e 9"), a abertura "Os 16 encontros" e o apêndice de
 *  templates/modelos. Âncora no início — "Depois de cada encontro" não é
 *  banda. */
const FASE_RE =
  /^(?:encontros\s+\d+\s+[ae]\s+\d+|os\s+16\s+encontros\b|(?:templates|modelos)\s+e\s+instrumentos)/i;

/** Rotação de tons das bandas — a sequência do PDF (lima → âmbar → teal). */
const FASE_TONS: DocTom[] = ["lima", "destaque", "info"];

export function tomDeFase(fase: number): DocTom {
  return FASE_TONS[((fase % FASE_TONS.length) + FASE_TONS.length) % FASE_TONS.length];
}

/** Title normalized for keyword checks: lowercase, no diacritics. */
export function normTitulo(t: string): string {
  return t
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

// semantic tone of the PDF's pill diagram: the dimension named in the
// section title colors the numbered-item chips (trabalho e carreira → teal,
// socioemocional → amber, modelar → lime). No match → default lime.
const TOM_SECAO: [RegExp, DocTom][] = [
  [/trabalho e carreira/, "info"],
  [/socioemocional/, "destaque"],
  [/modelar/, "lima"],
];

/** Tom semântico da seção pros chips dos itens numerados — null quando o
 *  título não casa a dimensão (o render cai no lime default). */
export function tomSemantico(titulo: string): DocTom | null {
  const t = normTitulo(titulo);
  for (const [re, tom] of TOM_SECAO) if (re.test(t)) return tom;
  return null;
}

// ---------- jornada (trilha clicável dos encontros) ----------

export type JornadaPonto = { numero: string; titulo: string; anchor: string };
export type JornadaFase = {
  /** rótulo do grupo de fase ("Encontros 1 a 4" — o texto antes do "·"). */
  rotulo: string;
  tom: DocTom;
  pontos: JornadaPonto[];
};

export type CorpusJornada = {
  fases: JornadaFase[];
  total: number;
  /** anchor do grupo "Os 16 encontros" — a trilha pendura sob o heading
   *  dele; sem esse grupo, ela entra ANTES do grupo `inicio`. */
  home: string | null;
  /** anchor do primeiro grupo que contribui dots. */
  inicio: string | null;
};

const RE_JORNADA_HOME = /^os 16 encontros\b/i;
const JORNADA_MINIMA = 4;

/** O mini-mapa da jornada: dots numerados pros cards de encontro COM âncora
 *  (os ### "Nº encontro · Título" — cards inline do guia especialista não
 *  têm âncora e ficam fora). Agrupados por fase na cor da banda. null abaixo
 *  de JORNADA_MINIMA pontos ou quando nenhum card tem âncora. */
export function jornadaCorpus(grupos: CorpusGrupo[]): CorpusJornada | null {
  const fases: JornadaFase[] = [];
  let inicio: string | null = null;
  let home: string | null = null;
  let total = 0;
  for (const g of grupos) {
    if (RE_JORNADA_HOME.test(g.titulo)) home = g.anchor;
    const corpo = [
      ...(g.intro?.blocos ?? []),
      ...g.subs.flatMap((s) => s.blocos),
    ];
    const pontos: JornadaPonto[] = [];
    for (const b of corpo) {
      if (b.kind === "encontro" && b.anchor) {
        pontos.push({ numero: b.numero, titulo: b.titulo, anchor: b.anchor });
      }
    }
    if (pontos.length === 0) continue;
    if (!inicio) inicio = g.anchor;
    total += pontos.length;
    fases.push({
      rotulo: g.titulo.split("·")[0].trim(),
      // fora de banda (doc sem fases) a cor segue a ordem da própria trilha
      tom: tomDeFase(g.fase ?? fases.length),
      pontos,
    });
  }
  if (total < JORNADA_MINIMA) return null;
  return { fases, total, home, inicio };
}

/** Corpo de seção → blocos. Linha vazia fecha o segmento; dentro de um mesmo
 *  trecho, linha abrindo com "|", "- " ou "N. " inicia segmento novo —
 *  o corpus também usa lista colada no parágrafo sem linha em branco. */
function blocosDeTexto(texto: string): DocBloco[] {
  const blocos: DocBloco[] = [];
  const linhas = texto.split("\n");
  let i = 0;
  while (i < linhas.length) {
    const l = linhas[i].trim();
    i++;
    if (!l) continue;
    if (l.startsWith("|")) {
      const run = [l];
      while (i < linhas.length && linhas[i].trim().startsWith("|"))
        run.push(linhas[i++].trim());
      const tabela = blocoTabela(run);
      if (tabela) blocos.push(tabela);
      else blocos.push(...run.flatMap(blocoPar));
      continue;
    }
    const mItem = /^(-|\d+\.)\s+/.exec(l);
    if (mItem) {
      const ordenada = mItem[1] !== "-";
      const reItem = ordenada ? /^\d+\.\s+(.*)$/ : /^-\s+(.*)$/;
      const itens: string[] = [];
      const m = reItem.exec(l);
      if (m) itens.push(inlineMd(m[1]));
      while (i < linhas.length) {
        const mi = reItem.exec(linhas[i].trim());
        if (!mi) break;
        itens.push(inlineMd(mi[1]));
        i++;
      }
      blocos.push({ kind: "lista", itens, ordenada });
      continue;
    }
    const par = [l];
    while (
      i < linhas.length &&
      linhas[i].trim() &&
      !linhas[i].trim().startsWith("|") &&
      !RE_ITEM_LISTA.test(linhas[i].trim())
    ) {
      par.push(linhas[i++].trim());
    }
    blocos.push(...blocoPar(par.join(" ")));
  }
  return blocos;
}

// ---------- seções (port de parseDoc, sem o merge de contexto) ----------

function cabecalho(bloco: string): { cab: string; corpo: string } {
  const nl = bloco.indexOf("\n");
  return {
    cab: (nl === -1 ? bloco : bloco.slice(0, nl)).trim(),
    corpo: nl === -1 ? "" : bloco.slice(nl + 1).trim(),
  };
}

function tituloLimpo(t: string): string {
  return t.replace(/\*\*/g, "").trim();
}

/** "### Nº encontro · Título" becomes a single encontro block: the heading
 *  carries the anchor and the card holds number, title, body and the
 *  trailing slots (Tarefa / Passo a passo→route link). The section's
 *  remaining blocks go inside the card body. */
function blocosEncontro(
  numero: string,
  titulo: string,
  anchor: string,
  blocos: DocBloco[]
): DocBloco[] {
  const [b0, ...resto] = blocos;
  const corpoHtml = b0?.kind === "par" ? b0.html : "";
  const fora = b0?.kind === "par" ? resto : blocos;
  return [mkEncontro(numero, titulo, anchor, corpoHtml, fora)];
}

// seções cujas listas são de marcação (a ficha "Antes do encontro" dos
// roteiros, o checklist de competências, blocos de preparação) — itens
// viram linhas de checkbox no render
const CHECKLIST_RE = /checklist|antes do encontro|preparacao|preparar/;

function mkSecao(
  secao: string,
  titulo: string,
  grupo: string | null,
  nivel: 2 | 3,
  texto: string,
  fase: number | null = null
): CorpusSecao {
  const limpo = tituloLimpo(titulo);
  const anchor = secaoAnchor(secao);
  let blocos = blocosDeTexto(texto);
  const mEnc = nivel === 3 ? RE_ENCONTRO_TITULO.exec(limpo) : null;
  if (mEnc) blocos = blocosEncontro(mEnc[1], mEnc[2].trim(), anchor, blocos);
  if (CHECKLIST_RE.test(normTitulo(limpo))) {
    for (const b of blocos) if (b.kind === "lista") b.check = true;
  }
  return {
    secao,
    titulo: limpo,
    grupo,
    nivel,
    anchor,
    fase,
    blocos,
  };
}

// ---------- referências internas (`documento X`, `seção "Y"`) ----------
// O corpus referencia outros materiais por nome ("documento Mensagem de
// encaminhamento", "o instrumento Construindo a sua Visão") e seções do
// próprio doc por título (seção "Depois de cada encontro"). linkRefs
// injeta <a> no html já escapado: link de documento é `./<slug>` relativo
// — resolve /materiais/documento/ no app e /jovem/materiais/documento/ no
// shell do jovem (o layout do app redireciona mentorado pra /jovem, e o
// mesmo doc parseado serve as duas rotas); link de seção aponta a âncora
// local — navegação por <a> real mantém o histórico, então "voltar"
// retorna ao ponto de leitura.

/** Referência navegável a outro doc do corpus: slug + título oficial + as
 *  formas como o texto o cita (título curto sem sufixo/parênteses, alias). */
export type CorpusDocRef = {
  slug: string;
  titulo: string;
  formas: string[];
};

// alias editorial do corpus: formas curtas que não derivam do título
// (o texto diz "documento PDM", o título é "PDM: Plano de Desenvolvimento…")
const ALIAS_REF: [RegExp, string[]][] = [
  [/^pdm\b/i, ["PDM"]],
  [/^guia do mentor de desenvolvimento/i, ["Guia do Mentor DPP"]],
];

/** Formas citáveis de um doc: título integral, título sem ": sufixo" e sem
 *  "(parênteses)" + aliases do ALIAS_REF. Formas derivadas pedem ≥ 4 chars
 *  (truncar demais vira falso positivo); alias curado entra sempre — "PDM"
 *  tem 3 letras e é justamente a forma como o texto o cita. */
function formasRef(titulo: string): string[] {
  const curtas = new Set<string>([titulo]);
  const semDois = titulo.split(":")[0].trim();
  const semParen = titulo.replace(/\s*\([^)]*\)\s*/g, " ").trim();
  if (semDois.length >= 4) curtas.add(semDois);
  if (semParen.length >= 4) curtas.add(semParen);
  const derivadas = [...curtas].filter((f) => f.length >= 4);
  for (const [re, alias] of ALIAS_REF) {
    if (re.test(titulo)) derivadas.push(...alias);
  }
  return [...new Set(derivadas)];
}

/** Catálogo de refs a partir das entradas lidas (lerCorpus já traz o
 *  título do frontmatter — não reparsa corpo). */
export function refsDeEntradas(
  entradas: { slug: string; titulo: string }[]
): CorpusDocRef[] {
  return entradas.map((e) => ({
    slug: e.slug,
    titulo: e.titulo,
    formas: formasRef(e.titulo),
  }));
}

const LINK_REF_CLS =
  "font-medium text-[var(--ring)] underline decoration-[var(--ring)]/40 underline-offset-2 transition-colors hover:decoration-[var(--ring)]";

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** lookup do candidato capturado após `documento|instrumento`: casa forma
 *  exata ou título que comece pelo candidato + fronteira de palavra
 *  ("Mensagem de encaminhamento" → "Mensagem de encaminhamento entre
 *  encontros"). Retorna o slug ou null. */
function lookupDocRef(refs: CorpusDocRef[], cand: string): string | null {
  const norm = normTitulo(cand).replace(/&amp;/g, "&");
  if (norm.length < 2) return null;
  for (const r of refs) {
    for (const f of r.formas) {
      if (normTitulo(f) === norm) return r.slug;
    }
    if (normTitulo(r.titulo).startsWith(`${norm} `)) return r.slug;
  }
  return null;
}

type RefCtx = {
  refs: CorpusDocRef[];
  /** normTitulo(titulo de seção) → anchor local. */
  secoes: Map<string, string>;
};

function linkRefs(html: string, ctx: RefCtx): string {
  // `seção "X"` / `capítulo "X"` → âncora do próprio documento
  html = html.replace(
    /(seção|capítulo)\s+"([^"]+)"/g,
    (m, kw: string, cand: string) => {
      const a = ctx.secoes.get(normTitulo(cand));
      return a
        ? `${kw} "<a class="${LINK_REF_CLS}" href="#${a}">${cand}</a>"`
        : m;
    }
  );
  // `Roteiro do Nº encontro` → roteiro nativo (só quando o doc existe)
  html = html.replace(
    /\bRoteiro do (\d+)º encontro\b/g,
    (m, n: string) => {
      const slug = `roteiro-encontro-${n.padStart(2, "0")}`;
      return ctx.refs.some((r) => r.slug === slug)
        ? `<a class="${LINK_REF_CLS}" href="./${slug}">${m}</a>`
        : m;
    }
  );
  // `documento|instrumento <forma exata>` — alternância das formas citáveis
  // (maior primeiro) resolve referência no meio da frase, sem delimitador
  const formas = ctx.refs
    .flatMap((r) => r.formas.map((f) => ({ f, slug: r.slug })))
    .sort((a, b) => b.f.length - a.f.length);
  if (formas.length > 0) {
    const alt = formas.map(({ f }) => escapeRegExp(escapeHtml(f))).join("|");
    const re = new RegExp(
      `\\b(documento|instrumento)\\s+("?)(${alt})\\b\\2`,
      "gi"
    );
    const mapa = new Map(formas.map(({ f, slug }) => [normTitulo(f), slug]));
    html = html.replace(
      re,
      (m, kw: string, q: string, cand: string) =>
        `${kw} ${q}<a class="${LINK_REF_CLS}" href="./${mapa.get(normTitulo(cand.replace(/&amp;/g, "&")))}">${cand}</a>${q}`
    );
  }
  // `documento|instrumento <candidato solto>` — o candidato para em
  // delimitador de frase/tag. Lookup direto primeiro (forma exata ou
  // título que comece pelo candidato); se não casar, tenta a forma como
  // prefixo DO candidato e linka só o trecho que casa ("documento
  // Mensagem de encaminhamento no encontro" → linka até "encontro")
  const porForma = formas
    .map(({ f, slug }) => ({
      slug,
      re: new RegExp(`^${escapeRegExp(escapeHtml(f))}\\b`, "i"),
    }))
    .sort((a, b) => b.re.source.length - a.re.source.length);
  html = html.replace(
    /(documento|instrumento)\s+("[^"]+"|[^"(),;.<]{3,70})/g,
    (m, kw: string, cand: string) => {
      const limpo = cand.replace(/^"|"$/g, "").trim();
      const slug = lookupDocRef(ctx.refs, limpo);
      if (slug) {
        return `${kw} <a class="${LINK_REF_CLS}" href="./${slug}">${limpo}</a>`;
      }
      for (const { slug: s, re } of porForma) {
        const mm = re.exec(limpo);
        if (mm) {
          return `${kw} <a class="${LINK_REF_CLS}" href="./${s}">${mm[0]}</a>${limpo.slice(mm[0].length)}`;
        }
      }
      return m;
    }
  );
  return html;
}

function linkBloco(b: DocBloco, ctx: RefCtx): void {
  switch (b.kind) {
    case "par":
    case "callout":
    case "numero":
    case "quote":
      b.html = linkRefs(b.html, ctx);
      break;
    case "lista":
      b.itens = b.itens.map((it) => linkRefs(it, ctx));
      break;
    case "tabela":
      b.linhas = b.linhas.map((ln) => ln.map((c) => linkRefs(c, ctx)));
      break;
    case "encontro":
      for (const interno of b.corpo) linkBloco(interno, ctx);
      if (b.tarefa) b.tarefa = linkRefs(b.tarefa, ctx);
      break;
  }
}

/** Injeta os links de referência no doc já montado. Índice de seções por
 *  título (## e ###) + o lede com o título do próprio doc. */
function aplicarRefs(doc: CorpusDoc, refs: CorpusDocRef[]): void {
  const secoes = new Map<string, string>();
  for (const s of doc.secoes) {
    secoes.set(normTitulo(s.titulo), s.anchor);
    secoes.set(normTitulo(s.secao), s.anchor);
  }
  if (doc.ledeAnchor) secoes.set(normTitulo(doc.titulo), doc.ledeAnchor);
  // o próprio doc sai do mapa de documentos — referência a si mesmo cai no
  // lookup de seções (título do doc → lede) em vez de linkar a própria URL
  const ctx: RefCtx = { refs: refs.filter((r) => r.slug !== doc.slug), secoes };
  for (const b of doc.lede) linkBloco(b, ctx);
  for (const s of doc.secoes) for (const b of s.blocos) linkBloco(b, ctx);
}

/** Parse completo de um md do corpus. Exportado puro (slug + conteúdo) pra
 *  teste sem fs — carregarDocCorpus é o wrapper com leitura de arquivo.
 *  `refs` (catálogo título→slug do corpus) ativa os links internos;
 *  omitido, o texto sai sem âncoras de documento. */
export function montarDocCorpus(
  slug: string,
  raw: string,
  refs?: CorpusDocRef[]
): CorpusDoc | null {
  const fm = frontmatter(raw);
  if (!fm) return null;
  const { meta, corpo } = fm;

  const partes = corpo
    .split(/^## /m)
    .map((s) => s.trim())
    .filter(Boolean);
  const secoes: CorpusSecao[] = [];
  let lede: DocBloco[] = [];
  let ledeAnchor: string | null = null;
  let i = 0;

  // h1 + texto antes do primeiro ## → lede do doc; o RAG indexa esse trecho
  // como seção com o título do doc, então o lede leva a âncora do h1
  if (partes[0]?.startsWith("# ")) {
    const { cab, corpo: c } = cabecalho(partes[0]);
    const h1 = tituloLimpo(cab.replace(/^#\s+/, ""));
    if (c) {
      lede = blocosDeTexto(c);
      ledeAnchor = secaoAnchor(h1);
    }
    i = 1;
  }

  let faseIdx = 0; // índice de banda na ordem do doc — conta mesmo ## sem intro
  for (; i < partes.length; i++) {
    const { cab: t2, corpo: c2 } = cabecalho(partes[i]);
    const fase = FASE_RE.test(tituloLimpo(t2)) ? faseIdx++ : null;
    const [intro, ...subs] = c2.split(/^### /m).map((s) => s.trim());
    if (intro) secoes.push(mkSecao(t2, t2, null, 2, intro, fase));
    for (const s of subs) {
      const { cab: sub, corpo: txt } = cabecalho(s);
      if (!txt) continue; // ### sem corpo não é seção (mesmo corte do ingest)
      secoes.push(mkSecao(`${t2} › ${sub}`, sub, t2, 3, txt));
    }
  }

  const doc: CorpusDoc = {
    slug,
    fonte: meta["fonte"] ?? slug,
    titulo: meta["titulo"] ?? slug,
    tipo: meta["tipo"] ?? null,
    natureza: meta["natureza"] ?? null,
    versao: meta["versao"] ?? null,
    origem: meta["origem"] ?? null,
    audiencia: audienciaDe(meta),
    lede,
    ledeAnchor,
    secoes,
  };
  if (refs?.length) aplicarRefs(doc, refs);
  return doc;
}

/** Agrupa as seções flat numa árvore de render: ## vira grupo com a intro
 *  como corpo próprio; ### entra no grupo do ## pai. Um ## só de subs (sem
 *  intro) ainda ganha heading/âncora no TOC — secaoAnchor do título dele é
 *  único e não colide com nenhuma seção. */
export function gruposCorpus(secoes: CorpusSecao[]): CorpusGrupo[] {
  const grupos: CorpusGrupo[] = [];
  let atual: CorpusGrupo | null = null;
  // fase implícita (## sem intro) numera no ponto em que o grupo aparece —
  // s.fase já desconta as bandas anteriores, então o contador só anda em
  // título que casa FASE_RE e se ressincroniza a cada intro numerada
  let proxFase = 0;
  for (const s of secoes) {
    if (s.nivel === 2) {
      atual = {
        titulo: s.titulo,
        anchor: s.anchor,
        intro: s,
        subs: [],
        fase: s.fase,
      };
      if (s.fase != null) proxFase = s.fase + 1;
      grupos.push(atual);
    } else {
      if (!atual || atual.titulo !== s.grupo) {
        const titulo = s.grupo ?? s.titulo;
        atual = {
          titulo,
          anchor: secaoAnchor(s.grupo ?? s.secao),
          intro: null,
          subs: [],
          fase: FASE_RE.test(tituloLimpo(titulo)) ? proxFase++ : null,
        };
        grupos.push(atual);
      }
      atual.subs.push(s);
    }
  }
  return grupos;
}

/** A página do jovem só serve doc cuja audiência cubra o mentorado: `todos`,
 *  `mentorado` explícito ou campo ausente. Papel de staff/mentor → notFound. */
export function corpusServeJovem(doc: CorpusDoc): boolean {
  return (
    doc.audiencia.length === 0 ||
    doc.audiencia.includes("todos") ||
    doc.audiencia.includes("mentorado")
  );
}

/** Gate da rota (app): mesma regra de visibilidade do catálogo (veMaterial —
 *  coordenação vê tudo; `todos` serve a todos; senão o papel precisa constar
 *  na audiência). Audiência ausente serve a todos, como no jovem. */
export function corpusServePapel(
  doc: CorpusDoc,
  pessoa: { role: AppRole | null; papeis?: AppRole[] | null } | null | undefined
): boolean {
  if (doc.audiencia.length === 0) return true;
  return veMaterial(doc.audiencia, pessoa);
}

// ---------- leitura do diretório ----------

type EntradaCorpus = { arquivo: string; slug: string; titulo: string; raw: string };

async function lerCorpus(): Promise<EntradaCorpus[]> {
  let nomes: string[];
  try {
    nomes = await readdir(DIR());
  } catch (e) {
    console.error("[corpus] docs/rag indisponível no bundle (tracing?)", e);
    return [];
  }
  const entradas: EntradaCorpus[] = [];
  for (const nome of nomes
    .filter((n) => n.endsWith(".md") && n !== "README.md")
    .sort()) {
    try {
      const raw = await readFile(path.join(DIR(), nome), "utf8");
      const meta = frontmatter(raw)?.meta;
      const slug =
        meta?.["material"] || meta?.["fonte"] || nome.replace(/\.md$/, "");
      entradas.push({
        arquivo: nome,
        slug,
        titulo: meta?.["titulo"] ?? slug,
        raw,
      });
    } catch (e) {
      console.error(`[corpus] ${nome}: falha de leitura`, e);
    }
  }
  return entradas;
}

// O corpus só muda com deploy — em produção memoiza o diretório e os docs no
// processo; em dev cada request relê (editar o md aparece sem restart). O
// React.cache deduplica chamadas dentro do mesmo render (generateMetadata +
// página + generateStaticParams).
let cacheEntradas: Promise<EntradaCorpus[]> | null = null;
const entradasCorpus = cache((): Promise<EntradaCorpus[]> => {
  if (process.env.NODE_ENV === "production" && cacheEntradas)
    return cacheEntradas;
  const p = lerCorpus();
  if (process.env.NODE_ENV === "production") cacheEntradas = p;
  return p;
});

const cacheDocs = new Map<string, Promise<CorpusDoc | null>>();

/** O doc de corpus cujo `material` (fallback: fonte, nome de arquivo) casa
 *  com o slug da rota — null quando o slug não é do corpus. */
export const carregarDocCorpus = cache(
  async (slug: string): Promise<CorpusDoc | null> => {
    const entradas = await entradasCorpus();
    const ent =
      entradas.find((e) => e.slug === slug) ??
      entradas.find((e) => e.arquivo === `${slug}.md`);
    if (!ent) return null;
    if (process.env.NODE_ENV === "production" && cacheDocs.has(ent.slug))
      return cacheDocs.get(ent.slug)!;
    const refs = refsDeEntradas(entradas);
    const doc = Promise.resolve().then(() =>
      montarDocCorpus(ent.slug, ent.raw, refs)
    );
    if (process.env.NODE_ENV === "production") cacheDocs.set(ent.slug, doc);
    return doc;
  }
);

/** Todos os docs do corpus (um por arquivo .md) — base do
 *  generateStaticParams e da lista do sumário. */
export const listarDocsCorpus = cache(async (): Promise<CorpusDoc[]> => {
  const docs: CorpusDoc[] = [];
  for (const e of await entradasCorpus()) {
    const d = await carregarDocCorpus(e.slug);
    if (d) docs.push(d);
  }
  return docs;
});
