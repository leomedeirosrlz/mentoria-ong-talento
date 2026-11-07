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
import type { DocBloco } from "@/lib/materiais-documentos";
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

function blocoPar(texto: string): DocBloco {
  // "**Assunto:** X" — o marcador de e-mail dos templates (subj)
  const mSubj = /^\*\*Assunto:\*\*\s+(.+)$/.exec(texto);
  if (mSubj) return { kind: "subj", texto: mSubj[1].replace(/\*\*/g, "") };
  // *( ... )* — nota editorial do corpus (atualizações de plataforma)
  const mNota = /^\*\(([\s\S]+)\)\*$/.exec(texto);
  if (mNota) return { kind: "nota", html: `<i>${inlineMd(mNota[1])}</i>` };
  return { kind: "par", html: inlineMd(texto) };
}

const RE_ITEM_LISTA = /^(-|\d+\.)\s/;

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
      else blocos.push(...run.map(blocoPar));
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
    blocos.push(blocoPar(par.join(" ")));
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

function mkSecao(
  secao: string,
  titulo: string,
  grupo: string | null,
  nivel: 2 | 3,
  texto: string
): CorpusSecao {
  return {
    secao,
    titulo: tituloLimpo(titulo),
    grupo,
    nivel,
    anchor: secaoAnchor(secao),
    blocos: blocosDeTexto(texto),
  };
}

/** Parse completo de um md do corpus. Exportado puro (slug + conteúdo) pra
 *  teste sem fs — carregarDocCorpus é o wrapper com leitura de arquivo. */
export function montarDocCorpus(slug: string, raw: string): CorpusDoc | null {
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

  for (; i < partes.length; i++) {
    const { cab: t2, corpo: c2 } = cabecalho(partes[i]);
    const [intro, ...subs] = c2.split(/^### /m).map((s) => s.trim());
    if (intro) secoes.push(mkSecao(t2, t2, null, 2, intro));
    for (const s of subs) {
      const { cab: sub, corpo: txt } = cabecalho(s);
      if (!txt) continue; // ### sem corpo não é seção (mesmo corte do ingest)
      secoes.push(mkSecao(`${t2} › ${sub}`, sub, t2, 3, txt));
    }
  }

  return {
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
}

/** Agrupa as seções flat numa árvore de render: ## vira grupo com a intro
 *  como corpo próprio; ### entra no grupo do ## pai. Um ## só de subs (sem
 *  intro) ainda ganha heading/âncora no TOC — secaoAnchor do título dele é
 *  único e não colide com nenhuma seção. */
export function gruposCorpus(secoes: CorpusSecao[]): CorpusGrupo[] {
  const grupos: CorpusGrupo[] = [];
  let atual: CorpusGrupo | null = null;
  for (const s of secoes) {
    if (s.nivel === 2) {
      atual = { titulo: s.titulo, anchor: s.anchor, intro: s, subs: [] };
      grupos.push(atual);
    } else {
      if (!atual || atual.titulo !== s.grupo) {
        atual = {
          titulo: s.grupo ?? s.titulo,
          anchor: secaoAnchor(s.grupo ?? s.secao),
          intro: null,
          subs: [],
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

type EntradaCorpus = { arquivo: string; slug: string; raw: string };

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
      entradas.push({ arquivo: nome, slug, raw });
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
    const doc = Promise.resolve().then(() => montarDocCorpus(ent.slug, ent.raw));
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
