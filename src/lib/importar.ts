import type { AppRole, DadosCivis, Escolaridade, Genero, PrefGeneroPar } from "./types";

/** Linha normalizada da planilha — união dos campos de pessoas (profiles +
 *  mentor_profiles) e de mentorados. Campos que não se aplicam ao tipo são
 *  ignorados na gravação; strings vazias viram null. */
export type LinhaImportada = {
  nome: string;
  email: string;
  whatsapp: string;
  papel: string;
  ong: string;
  notas: string;
  nome_social: string;
  data_nascimento: string;
  genero: string;
  cidade: string;
  uf: string;
  interesses: string;
  motivacao: string;
  pref_genero_par: string;
  cargo: string;
  empresa: string;
  origem: string;
  objetivos: string;
  escolaridade: string;
  experiencia_previa: string;
  formacao_externa: string;
  rg: string;
  cpf: string;
  cep: string;
  logradouro: string;
  numero: string;
  complemento: string;
  bairro: string;
  resp_nome: string;
  resp_parentesco: string;
  resp_rg: string;
  resp_cpf: string;
  resp_nascimento: string;
  resp_cidade: string;
  resp_uf: string;
  resp_cep: string;
  resp_logradouro: string;
  resp_numero: string;
  resp_complemento: string;
  resp_bairro: string;
};

const VAZIA: LinhaImportada = {
  nome: "",
  email: "",
  whatsapp: "",
  papel: "",
  ong: "",
  notas: "",
  nome_social: "",
  data_nascimento: "",
  genero: "",
  cidade: "",
  uf: "",
  interesses: "",
  motivacao: "",
  pref_genero_par: "",
  cargo: "",
  empresa: "",
  origem: "",
  objetivos: "",
  escolaridade: "",
  experiencia_previa: "",
  formacao_externa: "",
  rg: "",
  cpf: "",
  cep: "",
  logradouro: "",
  numero: "",
  complemento: "",
  bairro: "",
  resp_nome: "",
  resp_parentesco: "",
  resp_rg: "",
  resp_cpf: "",
  resp_nascimento: "",
  resp_cidade: "",
  resp_uf: "",
  resp_cep: "",
  resp_logradouro: "",
  resp_numero: "",
  resp_complemento: "",
  resp_bairro: "",
};

function semAcento(s: string): string {
  return s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().trim();
}

/** header da planilha -> campo canônico (colunas desconhecidas são ignoradas).
 *  \b só no início da palavra: aceita plurais ("notas", "organizações")
 *  sem sequestrar substrings ("longo" não é ong, "sobrenome" não é nome).
 *  Ordem importa: padrões mais específicos (nome_social, pref_genero_par)
 *  vêm antes dos genéricos (nome, genero) pra não serem engolidos. */
function canonHeader(h: string): keyof LinhaImportada | null {
  const n = semAcento(h);
  // responsável do menor primeiro — "nome do responsável" não pode cair no
  // "nome" genérico; qualquer campo civil seguido de "responsável" é dele.
  // `\bresp[_. ]` cobre os headers crus do modelo CSV (resp_nome, resp_cpf).
  if (/\brespons|\bresp[_. ]/.test(n)) {
    // dentro do bloco os \b não valem: "resp_cpf" tem "_" antes de "cpf" —
    // como a entrada já garante que é campo do responsável, casa substring
    if (/parentesco|grau/.test(n)) return "resp_parentesco";
    if (/\brg\b|_rg\b|registro|identidade/.test(n)) return "resp_rg";
    if (/cpf/.test(n)) return "resp_cpf";
    if (/nascimento|aniversario/.test(n)) return "resp_nascimento";
    if (/cep/.test(n)) return "resp_cep";
    if (/bairro/.test(n)) return "resp_bairro";
    if (/complemento|apto?|bloco/.test(n)) return "resp_complemento";
    if (/cidade|municipio|localidade/.test(n)) return "resp_cidade";
    if (/uf|estado/.test(n)) return "resp_uf";
    if (/endereco|logradouro|rua|avenida/.test(n)) return "resp_logradouro";
    // telefone/e-mail do responsável não entram no bloco civil — não vira nome
    if (/whats|telefone|celular|fone|phone|e-?mail/.test(n)) return null;
    // "resp_nome" não é número: o "no" precisa ser token próprio
    if (/numero|_n[ºo°](_|$)/.test(n)) return "resp_numero";
    return "resp_nome";
  }
  // "parentesco" sozinho também é campo do responsável
  if (/\bparentesco/.test(n)) return "resp_parentesco";
  // dados civis (0046) — documentos e endereço que preenchem os termos
  if (/\brg\b|registro geral|\bidentidade/.test(n)) return "rg";
  if (/\bcpf\b/.test(n)) return "cpf";
  if (/\bcep\b/.test(n)) return "cep";
  if (/\bbairro/.test(n)) return "bairro";
  if (/\bcomplemento|\bapto?\b|\bbloco/.test(n)) return "complemento";
  // "nº" não tem \b depois do símbolo — o lookahead cobre fim de linha
  if ((/\bnumero|\bn[ºo°](?=\s|$)/.test(n)) && !/telefone|celular|whats/.test(n)) return "numero";
  if (/\b(endereco|logradouro)/.test(n)) return "logradouro";
  if (/\b(e-?mail|correio)/.test(n)) return "email";
  if (/\b(whats|telefone|celular|fone|phone)/.test(n)) return "whatsapp";
  if (/\b(nome social|nome_social)/.test(n)) return "nome_social";
  if (/\b(papel|role|funcao|perfil|tipo)\b/.test(n) && !/genero/.test(n)) return "papel";
  if (/\bpref.*genero|\bgenero.*pref/.test(n)) return "pref_genero_par";
  if (/\bgenero|sexo\b/.test(n)) return "genero";
  if (/\b(nascimento|aniversario|data_nascimento)/.test(n)) return "data_nascimento";
  if (/\bcidade|municipio|localidade/.test(n)) return "cidade";
  if (n === "uf" || n === "estado" || /\buf\b/.test(n)) return "uf";
  if (/\binteresse|hobb/.test(n)) return "interesses";
  if (/\bmotivac|por que|porque\b/.test(n)) return "motivacao";
  if (/\b(ong|organizacao|instituicao)/.test(n)) return "ong";
  if (/\b(nota|obs)/.test(n)) return "notas";
  if (/\bobjetivo|\bmeta/.test(n)) return "objetivos";
  if (/\b(escolaridade|instrucao)/.test(n)) return "escolaridade";
  if (/\bexperiencia/.test(n)) return "experiencia_previa";
  if (/\bformacao externa|formacao_externa/.test(n)) return "formacao_externa";
  if (/\bcargo|profissao|ocupacao/.test(n)) return "cargo";
  if (/\bempresa|companhia|\btrabalha em\b/.test(n)) return "empresa";
  if (/\borigem|como conheceu|como chegou/.test(n)) return "origem";
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
  /^[^\s@.][^\s@]*@([^\s@.]+\.)+[^\s@.]{2,}$/.test(s) && !s.includes("..");

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

// ---------- campos do matching (0034) ----------
// mesmos CHECKs do banco, validados aqui pra linha inválida virar skip
// com motivo em pt-BR em vez de erro de banco no meio do import.

/** "dd/mm/aaaa", "dd-mm-aaaa" ou ISO "aaaa-mm-dd" -> ISO; null = inválida/vazia. */
export function normData(s: string): string | null {
  const v = s.trim();
  if (!v) return null;
  const isoM = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v);
  const brM = /^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})$/.exec(v);
  const iso = isoM
    ? `${isoM[1]}-${isoM[2]}-${isoM[3]}`
    : brM
      ? `${brM[3]}-${brM[2].padStart(2, "0")}-${brM[1].padStart(2, "0")}`
      : null;
  if (!iso) return null;
  const d = new Date(`${iso}T12:00:00`);
  // rejeita 31/02, 30/02 etc. — Date normaliza em vez de falhar
  if (isNaN(d.getTime()) || `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}` !== iso)
    return null;
  return iso;
}

/** "sp", "São Paulo - SP" -> "SP"; null = não reconhecida. */
export function normUf(s: string): string | null {
  const m = /\b([A-Za-z]{2})\b/.exec(s.trim());
  return m ? m[1].toUpperCase() : null;
}

/** Lista separada por ; | ou , -> array limpo (interesses na planilha). */
export function normLista(s: string): string[] {
  return s
    .split(/[;|,]/)
    .map((x) => x.trim().replace(/\s+/g, " "))
    .filter(Boolean);
}

export function mapGenero(s: string): Genero | null {
  const n = semAcento(s);
  if (!n) return null;
  if (/^fem|mulher/.test(n)) return "feminino";
  if (/^masc|homem/.test(n)) return "masculino";
  if (/nao.?bin|nb\b/.test(n)) return "nao_binario";
  if (/prefiro/.test(n)) return "prefiro_nao_dizer";
  if (/outro/.test(n)) return "outro";
  return null;
}

export function mapPrefGenero(s: string): PrefGeneroPar | null {
  const n = semAcento(s);
  if (!n) return null;
  if (/indiferente|tanto faz|qualquer|sem pref/.test(n)) return "indiferente";
  if (/fem|mulher/.test(n)) return "feminino";
  if (/masc|homem/.test(n)) return "masculino";
  return null;
}

export function mapEscolaridade(s: string): Escolaridade | null {
  const n = semAcento(s);
  if (!n) return null;
  if (/fund/.test(n)) return "fundamental";
  if (/medio|em\b/.test(n)) return "medio";
  if (/tec/.test(n)) return "tecnico";
  if (/pos|mestrado|doutorado|mba|especializ/.test(n)) return "pos";
  if (/incompleto|cursando|inacabado/.test(n)) return "superior_incompleto";
  if (/superior|graduac|faculdade|bacharel|licenciat/.test(n)) return "superior";
  return null;
}

// ---------- dados civis (0046) ----------

/** Colunas civis da linha → jsonb pra dados_civis / responsavel. `prefix`
 *  "" lê o bloco da própria pessoa, "resp_" o do responsável. `fixos`
 *  injeta o que a ficha já tem (nome/nascimento/cidade/UF) — a planilha só
 *  precisa trazer documento e endereço. Tudo vazio → null (não grava
 *  esqueleto); CPF de planilha não é validado aqui — o termo exige de
 *  novo na hora de assinar, e bloquear a linha inteira por um campo
 *  opcional perderia o cadastro. */
export function civisImportado(
  l: LinhaImportada,
  prefix: "" | "resp_" = "",
  fixos: Partial<Pick<DadosCivis, "nome_civil" | "data_nascimento">> & {
    cidade?: string;
    uf?: string | null;
  } = {}
): DadosCivis | null {
  const g = (k: string) =>
    normNome(String(l[`${prefix}${k}` as keyof LinhaImportada] ?? ""));
  const dados: DadosCivis = {
    nome_civil: fixos.nome_civil ?? g("nome"),
    rg: g("rg"),
    cpf: g("cpf").replace(/\D/g, ""),
    data_nascimento: fixos.data_nascimento ?? normData(g("nascimento")),
    endereco: {
      logradouro: g("logradouro"),
      numero: g("numero"),
      complemento: g("complemento") || null,
      bairro: g("bairro"),
      cidade: fixos.cidade ?? g("cidade"),
      uf: (fixos.uf ?? normUf(g("uf"))) ?? "",
      cep: g("cep").replace(/\D/g, ""),
    },
  };
  const temAlgo =
    dados.rg ||
    dados.cpf ||
    dados.endereco.logradouro ||
    dados.endereco.bairro ||
    dados.endereco.cep ||
    dados.endereco.numero ||
    (!fixos.nome_civil && dados.nome_civil);
  return temAlgo ? dados : null;
}
