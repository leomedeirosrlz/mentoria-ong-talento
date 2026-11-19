// REALIZA-34 — extração determinística de texto/linhas por formato.
// Nada sai da máquina: tudo roda no server action, em memória, e o arquivo
// nunca é salvo (sem bucket — zero cópia do documento, LGPD-friendly).

export const EXTENSOES_ACEITAS = [
  ".pdf",
  ".xlsx",
  ".xls",
  ".csv",
  ".tsv",
  ".docx",
  ".txt",
] as const;

/** Aceito no <input type=file> — imagem NÃO entra (a fatia não mente: o
 *  provider de IA é texto-only; quem enviar imagem por bypass recebe erro
 *  limpo no servidor). */
export const ACCEPT_IMPORT = EXTENSOES_ACEITAS.join(",");

const MAX_BYTES = 8 * 1024 * 1024;
const MAX_PAGINAS_PDF = 40;

export type Extraido =
  | { formato: "texto"; texto: string }
  | { formato: "tabela"; linhas: string[][] };

export type ResultadoExtracao =
  | { ok: true; extraido: Extraido }
  | { ok: false; erro: string };

const extensao = (nome: string) => {
  const i = nome.lastIndexOf(".");
  return i >= 0 ? nome.slice(i).toLowerCase() : "";
};

/** CSV/TSV → grade de células. Mesmas regras do parser de pessoas
 *  (importar.ts): aspas com escape duplo, quebra de linha dentro de campo,
 *  delimitador por heurística do header (; , \t). */
function splitPlanilha(text: string): string[][] {
  const registros: string[] = [];
  let cur = "", aspas = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      cur += c;
      if (aspas && text[i + 1] === '"') cur += text[++i];
      else aspas = !aspas;
    } else if (!aspas && (c === "\n" || c === "\r")) {
      if (c === "\r" && text[i + 1] === "\n") i++;
      if (cur.trim()) registros.push(cur);
      cur = "";
    } else cur += c;
  }
  if (cur.trim()) registros.push(cur);
  if (!registros.length) return [];

  const conta = (linha: string, d: string) => {
    let n = 0, a = false;
    for (let i = 0; i < linha.length; i++) {
      const c = linha[i];
      if (c === '"') {
        if (a && linha[i + 1] === '"') i++;
        else a = !a;
      } else if (!a && c === d) n++;
    }
    return n;
  };
  const delim = [";", ",", "\t"].reduce((a, b) =>
    conta(registros[0], b) > conta(registros[0], a) ? b : a
  );

  return registros.map((linha) => {
    const campos: string[] = [];
    let campo = "", a = false;
    for (let i = 0; i < linha.length; i++) {
      const c = linha[i];
      if (c === '"') {
        if (a && linha[i + 1] === '"') { campo += '"'; i++; }
        else a = !a;
      } else if (!a && c === delim) { campos.push(campo.trim()); campo = ""; }
      else campo += c;
    }
    campos.push(campo.trim());
    return campos;
  });
}

/** Extrai o conteúdo do arquivo pra uma forma única: texto corrido ou
 *  tabela de linhas. Nunca lança — devolve erro legível em pt-BR. */
export async function extrairConteudo(file: File): Promise<ResultadoExtracao> {
  if (!(file instanceof File) || file.size === 0)
    return { ok: false, erro: "Escolha um arquivo de cronograma pra importar." };
  if (file.size > MAX_BYTES)
    return { ok: false, erro: "O arquivo passa de 8 MB. Exporte uma versão mais leve ou divida o cronograma." };

  const ext = extensao(file.name);
  if (!(EXTENSOES_ACEITAS as readonly string[]).includes(ext)) {
    if ([".png", ".jpg", ".jpeg", ".webp", ".heic", ".gif"].includes(ext))
      return { ok: false, erro: "Imagem ainda não é suportada: converta o cronograma em PDF e envie de novo." };
    return { ok: false, erro: `Formato "${ext || file.type || "desconhecido"}" não suportado. Envie PDF, planilha (xlsx, csv), DOCX ou TXT.` };
  }

  try {
    switch (ext) {
      case ".csv":
      case ".tsv":
      case ".txt": {
        const texto = await file.text();
        const linhas = splitPlanilha(texto);
        // .txt com uma "coluna" só é documento de texto, não planilha
        const ehTabela = linhas.some((l) => l.length > 1);
        return {
          ok: true,
          extraido: ehTabela
            ? { formato: "tabela", linhas }
            : { formato: "texto", texto },
        };
      }
      case ".xlsx":
      case ".xls": {
        // CJS → namespace pode vir embrulhado em .default
        const mod = (await import("xlsx")) as unknown as {
          default?: typeof import("xlsx");
        } & typeof import("xlsx");
        const xlsx = mod.default ?? mod;
        const wb = xlsx.read(Buffer.from(await file.arrayBuffer()), { type: "buffer" });
        const linhas: string[][] = [];
        for (const nome of wb.SheetNames) {
          const rows = xlsx.utils.sheet_to_json<string[]>(wb.Sheets[nome], {
            header: 1,
            raw: false,
            defval: "",
          });
          for (const r of rows) linhas.push((r ?? []).map((c) => String(c ?? "").trim()));
        }
        return { ok: true, extraido: { formato: "tabela", linhas } };
      }
      case ".docx": {
        const mod = (await import("mammoth")) as unknown as {
          default?: typeof import("mammoth");
        } & typeof import("mammoth");
        const mammoth = mod.default ?? mod;
        const { value } = await mammoth.extractRawText({
          buffer: Buffer.from(await file.arrayBuffer()),
        });
        return { ok: true, extraido: { formato: "texto", texto: value } };
      }
      case ".pdf": {
        const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
        const doc = await pdfjs.getDocument({
          data: new Uint8Array(await file.arrayBuffer()),
          isEvalSupported: false,
          useSystemFonts: true,
        }).promise;
        if (doc.numPages > MAX_PAGINAS_PDF)
          return { ok: false, erro: `O PDF tem ${doc.numPages} páginas — o limite por importação é ${MAX_PAGINAS_PDF}.` };
        const paginas: string[] = [];
        for (let p = 1; p <= doc.numPages; p++) {
          const page = await doc.getPage(p);
          const tc = await page.getTextContent();
          paginas.push(
            tc.items
              .map((it) => ("str" in it ? it.str : ""))
              .join(" ")
              .replace(/\s+/g, " ")
          );
        }
        return { ok: true, extraido: { formato: "texto", texto: paginas.join("\n") } };
      }
    }
  } catch {
    return { ok: false, erro: "Não consegui ler esse arquivo — ele pode estar corrompido ou protegido por senha." };
  }
  return { ok: false, erro: "Formato não suportado." };
}
