// Recorte do corpus RAG em seções e chunks — funções puras extraídas de
// scripts/ingerir-guias.mjs e corrigidas (auditoria .auditoria-rag/A-pipeline.md):
//
//   P2 — "###" dentro de um "##" vira seção própria, com
//        secao = "<título do ##> › <título do ###>". O texto entre o ##
//        e o primeiro ### (a introdução) fica numa seção só com o
//        título do ##.
//   P3 — o texto do chunk não embute a linha de título (##/###): ela já
//        está na coluna `secao`. Seção de corpo vazio é descartada.
//   P4 — parágrafo maior que MAX é fatiado em frases (fim [.!?] seguido
//        de espaço/quebra, ":" no fim da linha e item de lista "- "), acumuladas até ~ALVO;
//        só uma frase única >MAX é cortada, no último espaço antes de
//        MAX. Nada de janela de caracteres (cortava no meio de palavra)
//        nem "… " falso no primeiro pedaço.
//   P5 — overlap entre chunks = a última frase completa do anterior
//        (quando cabe em 2×OVERLAP), marcada com "… "; nunca meia frase.

const NATUREZAS = new Set(["transcrito", "consolidado", "sintese-operacional"]);

// até aqui (chars) a intro de um ## com ### é contexto, não seção própria
export const INTRO_CONTEXTO = 300;

// Âncora estável da seção: sufixo # do link /materiais/documento/<slug>
// que a citação da Liza monta. Slugify: minúsculas, NFD sem diacríticos,
// [^a-z0-9]+→"-", trim "-".
// keep in sync with src/lib/materiais/corpus-anchor.ts
export function secaoAnchor(secao) {
  return secao
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// ---------- front-matter + seções ----------

export function parseDoc(nome, raw) {
  const fm = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/.exec(raw);
  if (!fm) throw new Error(`${nome}: sem frontmatter`);
  const meta = Object.fromEntries(
    fm[1].split("\n")
      .map((l) => /^([a-z_]+):\s*(.*)$/.exec(l.trim()))
      .filter(Boolean)
      .map(([, k, v]) => [k, v.replace(/\s+/g, " ").trim()])
  );
  for (const req of ["fonte", "titulo", "material", "natureza"]) {
    if (!meta[req]) throw new Error(`${nome}: frontmatter sem '${req}'`);
  }
  if (!NATUREZAS.has(meta.natureza)) {
    throw new Error(
      `${nome}: natureza '${meta.natureza}' inválida — use uma de ${[...NATUREZAS].join(", ")}`
    );
  }
  if (meta.fonte.length > 80) {
    throw new Error(`${nome}: fonte > 80 chars (limite da coluna guia)`);
  }

  const partes = fm[2].split(/^## /m).map((s) => s.trim()).filter(Boolean);
  const secoes = [];
  let i = 0;

  // primeira parte = h1 do doc + o que vier antes do primeiro ##: vira
  // seção com o título do doc só se tiver corpo — o h1 sozinho era um
  // chunk sem conteúdo que vencia a busca pelo título e não respondia
  // nada. Se o doc não abre com h1, a parte cai no fluxo normal de ##.
  if (partes[0]?.startsWith("# ")) {
    const { cab, corpo } = cabecalho(partes[0]);
    if (corpo) secoes.push({ secao: cab.replace(/^# /, "").trim(), texto: corpo });
    i = 1;
  }

  for (; i < partes.length; i++) {
    const { cab: titulo, corpo } = cabecalho(partes[i]);
    // corpo do ## → intro + uma sub por ###; ### sem corpo é descartado
    const [intro, ...subs] = corpo.split(/^### /m).map((s) => s.trim());
    const comSubs = subs.some((s) => cabecalho(s).corpo);
    // intro curta ("O 12º encontro tem três momentos…") sozinha virava
    // chunk de uma frase que vencia pelo título e não respondia nada: vai
    // como contexto na frente de cada ### do bloco. Intro longa é
    // conteúdo próprio e segue como seção.
    const contexto = comSubs && intro.length <= INTRO_CONTEXTO ? intro : "";
    if (intro && !contexto) secoes.push({ secao: titulo, texto: intro });
    for (const s of subs) {
      const { cab: sub, corpo: texto } = cabecalho(s);
      if (!texto) continue;
      secoes.push({
        secao: `${titulo} › ${sub}`,
        texto: contexto ? `${contexto}\n\n${texto}` : texto,
      });
    }
  }
  return {
    fonte: meta.fonte,
    titulo: meta.titulo,
    material: meta.material,
    natureza: meta.natureza,
    // a âncora sai da seção inteira, não da `secao` truncada do insert —
    // tem que bater com o id que a página põe no ##/###
    secoes: secoes.map((s) => ({ ...s, secao_anchor: secaoAnchor(s.secao) })),
  };
}

// primeira linha (título do bloco) x resto do bloco
function cabecalho(bloco) {
  const nl = bloco.indexOf("\n");
  return {
    cab: (nl === -1 ? bloco : bloco.slice(0, nl)).trim(),
    corpo: nl === -1 ? "" : bloco.slice(nl + 1).trim(),
  };
}

// ---------- chunking ----------

export const ALVO = 800;
export const MAX = 900;
export const OVERLAP = 120;

// Pontos onde uma frase começa dentro de um parágrafo: logo depois de
// [.!?] seguido de espaço/quebra, de ":" no fim da linha, e no "- " que
// abre item de lista. O ":" no meio da linha ("4º encontro (…): validação")
// não corta: partia o item de lista ao meio.
function limitesFrase(p) {
  const ls = [];
  for (const m of p.matchAll(/[.!?]\s|:\n/g)) ls.push(m.index + 1);
  for (const m of p.matchAll(/^- /gm)) if (m.index > 0) ls.push(m.index);
  return [...new Set(ls)].sort((a, b) => a - b);
}

// Frases de um parágrafo. Cada uma carrega `sep`, o espaço original que
// a separava da anterior — juntar com sep + t reproduz o texto sem
// achatar quebra de linha de lista.
function frases(p) {
  const out = [];
  let ini = 0,
    rabo = "";
  for (const c of [...limitesFrase(p), p.length]) {
    const bruto = p.slice(ini, c);
    const t = bruto.trim();
    if (t)
      out.push({
        t,
        sep: rabo + bruto.slice(0, bruto.length - bruto.trimStart().length),
      });
    rabo = bruto.slice(bruto.trimEnd().length);
    ini = c;
  }
  return out;
}

// Última frase do texto — o candidato a overlap do próximo chunk.
function ultimaFrase(t) {
  const ls = limitesFrase(t);
  return (ls.length ? t.slice(ls[ls.length - 1]) : t).trim();
}

export function fatiar(texto) {
  if (texto.length <= MAX) return [texto];
  const paras = texto.split(/\n{2,}/).filter((p) => p.trim());
  const chunks = [];
  let buf = ""; // chunk em formação — já inclui o overlap ("… frase")
  let seed = ""; // o overlap que buf carrega sozinho
  let completo = true; // buf termina num fim de frase natural?

  const emit = () => {
    const t = buf.trim();
    if (!t) {
      buf = seed = "";
      completo = true;
      return;
    }
    if (t !== seed) {
      chunks.push(t);
      const u = completo ? ultimaFrase(t) : "";
      seed = u && u.length <= OVERLAP * 2 ? `… ${u}` : "";
    }
    // buf = só o seed: overlap sem conteúdo nunca vira chunk próprio
    buf = seed;
    completo = true;
  };

  const junta = (pedaco, sep = " ") => {
    if (buf === seed && seed && buf.length + sep.length + pedaco.length > MAX) {
      // o overlap não cabe junto com o pedaço — o chunk sai sem ele
      buf = seed = "";
    }
    buf = buf ? buf + sep + pedaco : pedaco;
  };

  for (const p of paras) {
    if (p.length <= MAX) {
      if (buf.length + p.length + 2 > MAX) emit();
      junta(p, "\n\n");
      completo = true;
      continue;
    }
    // parágrafo gigante: fatiado em frases, acumuladas até ~ALVO. Continua
    // o chunk em formação (o "…uma camada de cada vez:" que abre a lista
    // fica junto dela); a 1ª frase entra separada por parágrafo.
    let primeira = true;
    for (const f of frases(p)) {
      if (primeira && buf) f.sep = "\n\n";
      primeira = false;
      if (f.t.length > MAX) {
        // frase única gigante: corta no último espaço antes de MAX
        emit();
        let resto = f.t;
        while (resto.length > MAX - (buf ? buf.length + 1 : 0)) {
          const disp = MAX - (buf ? buf.length + 1 : 0);
          let c = Math.max(
            resto.lastIndexOf(" ", disp),
            resto.lastIndexOf("\n", disp)
          );
          if (c <= 0) c = disp; // sem espaço antes do limite: corta duro
          junta(resto.slice(0, c));
          completo = false;
          emit();
          resto = resto.slice(c).trimStart();
        }
        if (resto.trim()) {
          junta(resto.trim());
          completo = false; // buf termina no meio da frase — sem overlap
        }
        continue;
      }
      if (buf && buf.length + f.sep.length + f.t.length > ALVO) emit();
      junta(f.t, f.sep || " ");
      completo = true;
    }
  }
  emit();
  return chunks.length ? chunks : [texto.slice(0, MAX)];
}
