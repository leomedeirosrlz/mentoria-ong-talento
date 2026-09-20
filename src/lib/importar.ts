import type { AppRole } from "./types";

export type LinhaImportada = {
  nome: string;
  email: string;
  whatsapp: string;
  papel: string;
  ong: string;
  notas: string;
};

const VAZIA: LinhaImportada = { nome: "", email: "", whatsapp: "", papel: "", ong: "", notas: "" };

function semAcento(s: string): string {
  return s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().trim();
}

/** header da planilha -> campo canônico (colunas desconhecidas são ignoradas).
 *  \b só no início da palavra: aceita plurais ("notas", "organizações")
 *  sem sequestrar substrings ("longo" não é ong, "sobrenome" não é nome). */
function canonHeader(h: string): keyof LinhaImportada | null {
  const n = semAcento(h);
  if (/\b(e-?mail|correio)/.test(n)) return "email";
  if (/\b(whats|telefone|celular|fone|phone)/.test(n)) return "whatsapp";
  if (/\b(papel|role|funcao|perfil|tipo)/.test(n)) return "papel";
  if (/\b(ong|origem|organizacao|instituicao)/.test(n)) return "ong";
  if (/\b(nota|obs)/.test(n)) return "notas";
  if (/\b(nome|name)/.test(n)) return "nome";
  return null;
}

function splitLinha(linha: string, delim: string): string[] {
  const out: string[] = [];
  let cur = "", aspas = false;
  for (let i = 0; i < linha.length; i++) {
    const c = linha[i];
    if (aspas) {
      if (c === '"') {
        if (linha[i + 1] === '"') { cur += '"'; i++; }
        else aspas = false;
      } else cur += c;
    } else if (c === '"') aspas = true;
    else if (c === delim) { out.push(cur); cur = ""; }
    else cur += c;
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

/** Quebra o texto em registros respeitando aspas — campo entre aspas pode ter quebra de linha. */
function splitRegistros(text: string): string[] {
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
    } else {
      cur += c;
    }
  }
  if (cur.trim()) registros.push(cur);
  return registros;
}

/** Conta delimitadores fora de aspas — delimitador dentro de campo não vale. */
function contaDelim(linha: string, delim: string): number {
  let n = 0, aspas = false;
  for (let i = 0; i < linha.length; i++) {
    const c = linha[i];
    if (c === '"') {
      if (aspas && linha[i + 1] === '"') i++;
      else aspas = !aspas;
    } else if (!aspas && c === delim) n++;
  }
  return n;
}

/** CSV/TSV com cabeçalho na 1ª linha; detecta ; (Excel BR), , ou tab. */
export function parseCsv(text: string): { linhas: LinhaImportada[]; ignoradas: number } {
  const registros = splitRegistros(text);
  if (registros.length < 2) return { linhas: [], ignoradas: 0 };

  const header = registros[0];
  const delim = [";", ",", "\t"].reduce((a, b) =>
    contaDelim(header, b) > contaDelim(header, a) ? b : a
  );
  const mapa = splitLinha(header, delim).map(canonHeader);
  if (!mapa.includes("nome")) return { linhas: [], ignoradas: registros.length };

  let ignoradas = 0;
  const parsed = registros.slice(1).flatMap((l) => {
    const celulas = splitLinha(l, delim);
    // header multi-coluna mas a linha veio sem o delimitador (outro separador) — não é dado válido
    if (mapa.length > 1 && celulas.length === 1) { ignoradas++; return []; }
    const row = { ...VAZIA };
    mapa.forEach((campo, i) => {
      if (campo && !row[campo]) row[campo] = celulas[i] ?? "";
    });
    if (!row.nome.trim()) { ignoradas++; return []; }
    return [row];
  });
  return { linhas: parsed, ignoradas };
}

export const normNome = (s: string) => s.trim().replace(/\s+/g, " ");
export const normEmail = (s: string) => s.trim().toLowerCase();
export const emailValido = (s: string) =>
  /^[^\s@.][^\s@]*@[^\s@.]+\.[^\s@.]{2,}$/.test(s) && !s.includes("..");

/** whatsapp -> só dígitos; completa 55 quando vem DD+número BR (0800/curto não é whatsapp).
 *  Com "+" no input o número já vem com DDI — nunca prefixar 55. */
export function normWhatsapp(s: string): string | null {
  const d = s.replace(/\D/g, "");
  if (d.length < 10 || d.startsWith("0")) return null;
  if (s.includes("+")) return d;
  if (d.length <= 11) return `55${d}`;
  return d;
}

export function mapRole(s: string): AppRole | null {
  const n = semAcento(s);
  if (!n) return null;
  if (/coord/.test(n)) return "coordenacao";
  if (/supervis/.test(n)) return "supervisor";
  if (/especial/.test(n)) return "mentor_especialista";
  if (/mentor|dpp/.test(n)) return "mentor_dpp";
  return null;
}
