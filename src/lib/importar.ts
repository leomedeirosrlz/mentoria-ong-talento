import type { AppRole, CorRaca, DadosCivis, Escolaridade, Genero, PrefGeneroPar } from "./types";
import { UFS, parseDisponibilidade } from "./ciclo";
import { capitalizar, nomeProprio } from "./utils";

export const MAX_INTERESSES = 20;
export const INTERESSE_MAX_CHARS = 60;

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
  // ---------- intake real (0054) ----------
  cor_raca: string;
  linkedin: string;
  bio: string;
  /** JSON {"dias":["seg"],"periodos":["noite"]} — grade semanal. */
  disponibilidade: string;
  /** JSON objeto — payload integral do form de origem. */
  form_bruto: string;
  /** ISO datetime — carimbo do consentimento LGPD (só profiles). */
  consent_lgpd_em: string;
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
  cor_raca: "",
  linkedin: "",
  bio: "",
  disponibilidade: "",
  form_bruto: "",
  consent_lgpd_em: "",
};

export function semAcento(s: string): string {
  return s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().trim();
}

/** Normaliza header pra casar com o alias exato: sem acento, pontuação
 *  interna vira espaço e a pontuação final do Google Forms ("...:", "...?")
 *  some — "E-mail:" e "E-mail" são a mesma coluna. */
function normHeader(h: string): string {
  return semAcento(h)
    .replace(/[,.;:!?()[\]]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Headers reais dos Google Forms do intake (matching mentores/mentorados,
 *  cadastro Brasil Participativo) — exatos, conferidos antes do fuzzy pra
 *  não caírem em padrão genérico ("documento de identidade oficial" no nome
 *  civil pegaria `rg`; "foto de perfil" pegaria `papel`). null = coluna
 *  ignorada de propósito (anexo, carimbo, pergunta sim/não auxiliar). */
const ALIAS_EXATO: Record<string, keyof LinhaImportada | null> = {
  // headers canônicos com "_" — \b não dispara depois de underscore (é \w),
  // então "cor_raca" caía em null e perdia o campo inteiro na importação
  cor_raca: "cor_raca",
  consent_lgpd_em: "consent_lgpd_em",
  "carimbo de data/hora": null,
  "nome completo civil como esta no seu documento de identidade oficial": "nome",
  "nome completo": "nome",
  "nome social": "nome_social",
  "nome social se houver": "nome_social",
  "data de nascimento": "data_nascimento",
  "como voce se identifica em relacao a genero": "genero",
  "como voce se identifica em relacao a cor/raca": "cor_raca",
  "autodeclaracao marque todas as opcoes que se aplicam": "cor_raca",
  "estado/municipio de residencia": "cidade",
  "uf estado": "uf",
  "voce tem preferencia de ser mentor para mentorado homem ou mulher": "pref_genero_par",
  "voce tem preferencia de ser mentorando por um mentor homem ou mulher": "pref_genero_par",
  "perfil no linkedin": "linkedin",
  "perfil no linkedin opcional": "linkedin",
  // "empresa/instituição" pegaria `ong` (instituicao) antes de empresa
  "empresa/instituicao": "empresa",
  // S/N auxiliar — a descrição que vale é a coluna seguinte
  "possui experiencia previa no trabalho como mentor": null,
  "caso possua experiencia previa como mentor por favor descreva-a": "experiencia_previa",
  "possui a formacao no metodo mentoring autentico dada pela erlich mentoring": "formacao_externa",
  "autorizacao de uso dos dados lgpd": "consent_lgpd_em",
  // bio = a descrição em 1º pessoa; a 3ª pessoa (esposa/amigos) fica no form_bruto
  "por favor faca uma descricao de voce mesmo em um paragrafo inserindo suas caracteristicas mais marcantes": "bio",
  "se a sua esposa ou seu marido ou seu companheiro a fossem fazer uma breve descricao de voce como eles lhe descreveriam": null,
  "se seus amigos/familiares fossem fazer uma breve descricao de voce como eles lhe descreveriam": null,
  // Brasil Participativo cru: "Tipo de conta bancária" casaria `tipo`->papel
  // e pulava a linha ("papel não reconhecido"); "CPF - documento" é upload
  // (link Drive) e escaparia do guard de anexo por não dizer "anexo"
  "tipo de conta bancaria": null,
  "cpf - documento": null,
};

/** header da planilha -> campo canônico (colunas desconhecidas são ignoradas).
 *  \b só no início da palavra: aceita plurais ("notas", "organizações")
 *  sem sequestrar substrings ("longo" não é ong, "sobrenome" não é nome).
 *  Ordem importa: alias exato do intake primeiro; depois anexos (uma coluna
 *  de upload nunca é campo de texto); padrões mais específicos (nome_social,
 *  pref_genero_par) vêm antes dos genéricos (nome, genero). */
function canonHeader(h: string): keyof LinhaImportada | null {
  const exato = normHeader(h);
  if (exato in ALIAS_EXATO) return ALIAS_EXATO[exato];
  const n = semAcento(h);
  // coluna de arquivo (link do Drive) nunca é campo de texto — "Anexo do RG"
  // pegaria rg, "CPF - documento" pegaria cpf, "foto de perfil" pegaria papel
  if (/\banex|\barquivo|upload|\bfoto\b|curriculo|comprovante|frente e verso|adicione/.test(n))
    return null;
  // grade de horários do form ("disponibilidade de agenda: [09h às 10h]")
  // são N colunas — o transform funde num JSON só; aqui ignora, não quebra
  if (/disponibilidade.*\d{1,2}h/.test(n)) return null;
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
  if (/\bpref.*genero|\bgenero.*pref|\bpreferencia.*(homem|mulher|mentor)/.test(n)) return "pref_genero_par";
  if (/\braca|\betnia|autodeclar/.test(n)) return "cor_raca";
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
  if (/linkedin/.test(n)) return "linkedin";
  if (/\bbio\b|descricao de voce|autodescri/.test(n)) return "bio";
  if (/\bdisponibilidade/.test(n)) return "disponibilidade";
  if (/\bform_bruto|\bpayload|\bresposta bruta/.test(n)) return "form_bruto";
  if (/\blgpd|consentimento|autorizacao.*dados|uso dos dados/.test(n)) return "consent_lgpd_em";
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
 *  Com "+" no input o número já vem com DDI — nunca prefixar 55.
 *  Planilha corrompe número em notação científica ("1.1984788783E10") —
 *  expande antes de extrair os dígitos, senão o "E10" vira dígito extra. */
export function normWhatsapp(s: string): string | null {
  const v = s.trim();
  if (/^\d+(\.\d+)?[eE]\+?\d+$/.test(v)) {
    s = Number(v).toFixed(0);
  }
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

/** "dd/mm/aaaa", "dd-mm-aaaa", ISO "aaaa-mm-dd" ou serial de planilha
 *  ("30762" — o Excel/Google Forms exporta data como número de dias desde
 *  1899-12-30; 5 dígitos cobre 1927–2127, suficiente pra nascimento)
 *  -> ISO; null = inválida/vazia. */
export function normData(s: string): string | null {
  const v = s.trim();
  if (!v) return null;
  const serialM = /^(\d{5})(\.\d+)?$/.exec(v);
  const isoM = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v);
  const brM = /^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})$/.exec(v);
  const iso = serialM
    ? new Date(Date.UTC(1899, 11, 30) + Math.floor(Number(serialM[1])) * 86400000)
        .toISOString().slice(0, 10)
    : isoM
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
  // ordem importa: "prefiro não dizer" e "não binário" antes dos binários,
  // e cis/transgênero resolve pelo núcleo ("cisgênero feminino" -> feminino)
  if (/prefiro/.test(n)) return "prefiro_nao_dizer";
  if (/nao.?bin|nb\b/.test(n)) return "nao_binario";
  if (/fem|mulher/.test(n)) return "feminino";
  if (/masc|homem/.test(n)) return "masculino";
  if (/outro/.test(n)) return "outro";
  return null;
}

export function mapPrefGenero(s: string): PrefGeneroPar | null {
  const n = semAcento(s);
  if (!n) return null;
  if (/indiferente|tanto faz|qualquer|sem pref|nao tenho pref/.test(n)) return "indiferente";
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

// ---------- intake real (0054) ----------

/** Autodeclaração de cor/raça -> vocabulário do CHECK. Campo de texto livre
 *  no form (gente coloca sobrenome, resposta torta) — não reconhecido vira
 *  null e o valor cru fica preservado no form_bruto, nunca derruba a linha. */
export function mapCorRaca(s: string): CorRaca | null {
  const n = semAcento(s);
  if (!n) return null;
  if (/prefiro/.test(n)) return "prefiro_nao_dizer";
  if (/branc/.test(n)) return "branca";
  if (/negr|pret/.test(n)) return "negra";
  if (/pard/.test(n)) return "parda";
  if (/amarel/.test(n)) return "amarela";
  if (/indig/.test(n)) return "indigena";
  if (/outro/.test(n)) return "outro";
  return null;
}

/** LinkedIn -> URL http(s) (CHECK profiles_linkedin_http). Sem scheme ganha
 *  https://; o que não virar URL com domínio volta null — texto solto
 *  ("não tenho") não derruba a linha, fica só no form_bruto. */
export function normLinkedin(s: string): string | null {
  const v = s.trim();
  if (!v) return null;
  const com = /^https?:\/\//i.test(v) ? v : `https://${v.replace(/^\/+/, "")}`;
  try {
    const u = new URL(com);
    return u.hostname.includes(".") ? com.slice(0, 300) : null;
  } catch {
    return null;
  }
}

/** Campo de documento/endereço corrompido pela planilha: notação científica
 *  ("2.2849975893E10" -> "22849975893") e float de número de casa ("207.0"
 *  -> "207"). Texto misto ("4075010-8 /SEDS/AL") passa intacto — órgão
 *  emissor junto do RG é informação, não ruído. */
function numDoc(s: string): string {
  const v = s.trim();
  if (/^\d+(\.\d+)?[eE]\+?\d+$/.test(v)) return Number(v).toFixed(0);
  const m = /^(\d+)\.0+$/.exec(v);
  return m ? m[1] : v;
}

/** Papel que declara "sem papel na plataforma" (cadastro Brasil Participativo
 *  importado como registro, não como usuário) — role null, não linha pulada. */
export function papelNulo(s: string): boolean {
  return /^(nenhum|sem papel|voluntari[oa]s?|cadastro)$/i.test(semAcento(s));
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
  const vazio = (s: string) => s || null;
  const dados: DadosCivis = {
    nome_civil: vazio(fixos.nome_civil ?? "") ?? vazio(nomeProprio(g("nome"))),
    rg: vazio(numDoc(g("rg"))),
    cpf: vazio(numDoc(g("cpf")).replace(/\D/g, "")),
    data_nascimento: fixos.data_nascimento ?? normData(g("nascimento")),
    endereco: {
      logradouro: vazio(nomeProprio(g("logradouro"))),
      numero: vazio(numDoc(g("numero"))),
      complemento: g("complemento") || null,
      bairro: vazio(nomeProprio(g("bairro"))),
      cidade: vazio(fixos.cidade ?? "") ?? vazio(nomeProprio(g("cidade"))),
      uf: vazio(fixos.uf ?? "") ?? normUf(g("uf")),
      cep: vazio(numDoc(g("cep")).replace(/\D/g, "")),
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

/** Mesma validação da ficha, mas sobre uma linha da planilha — valor bruto
 *  preenchido e irreconhecível devolve motivo pra pular a linha (em vez de
 *  gravar null ou estourar no CHECK do insert em lote). Vive aqui (e não em
 *  actions.ts) porque o script de import real (scripts/importar-intake.ts)
 *  roda fora do Next e precisa montar o mesmo registro. */
export function fichaLinha(
  l: LinhaImportada,
  de: "pessoa" | "mentorado"
): Record<string, unknown> | { error: string } {
  const out: Record<string, unknown> = {};
  const texto = (campo: keyof LinhaImportada, col: string, max: number, rotulo: string) => {
    const v = normNome(String(l[campo] ?? ""));
    if (v.length > max) return `${rotulo} passa de ${max} caracteres`;
    out[col] = v || null;
    return null;
  };
  const specs: [keyof LinhaImportada, string, number, string][] = [
    ["nome_social", "nome_social", 150, "nome social"],
    ["cidade", "cidade", 100, "cidade"],
    ["origem", "origem", 300, "origem"],
    ["motivacao", "motivacao", 2000, "motivação"],
    ...(de === "pessoa"
      ? [["cargo", "cargo", 120, "cargo"], ["empresa", "empresa", 150, "empresa"]] as [keyof LinhaImportada, string, number, string][]
      : [["objetivos", "objetivos", 2000, "objetivos"]] as [keyof LinhaImportada, string, number, string][]),
  ];
  for (const [campo, col, max, rotulo] of specs) {
    const erro = texto(campo, col, max, rotulo);
    if (erro) return { error: erro };
  }

  const nasc = normData(String(l.data_nascimento ?? ""));
  if (String(l.data_nascimento ?? "").trim() && !nasc)
    return { error: "data de nascimento inválida (use dd/mm/aaaa)" };
  out.data_nascimento = nasc;

  const genero = mapGenero(String(l.genero ?? ""));
  if (String(l.genero ?? "").trim() && !genero) return { error: "gênero não reconhecido" };
  out.genero = genero;

  const uf = normUf(String(l.uf ?? ""));
  if (String(l.uf ?? "").trim() && (!uf || !(UFS as readonly string[]).includes(uf)))
    return { error: "UF inválida (use a sigla, ex.: SP)" };
  out.uf = uf;

  const interesses = normLista(String(l.interesses ?? ""));
  if (interesses.length > MAX_INTERESSES) return { error: `mais de ${MAX_INTERESSES} interesses` };
  if (interesses.some((t) => t.length > INTERESSE_MAX_CHARS))
    return { error: `interesse com mais de ${INTERESSE_MAX_CHARS} caracteres` };
  out.interesses = interesses;

  const pref = mapPrefGenero(String(l.pref_genero_par ?? ""));
  if (String(l.pref_genero_par ?? "").trim() && !pref)
    return { error: "preferência de gênero do par não reconhecida" };
  out.pref_genero_par = pref;

  // cor/raça é texto livre no form de intake — irreconhecível vira null
  // (o cru fica preservado no form_bruto), não derruba a linha
  out.cor_raca = mapCorRaca(String(l.cor_raca ?? ""));

  // payload integral do form (0054) — objeto JSON, teto de 32 KB
  const fb = String(l.form_bruto ?? "").trim();
  if (fb) {
    if (fb.length > 32_768) return { error: "form_bruto passa de 32 KB" };
    try {
      const obj: unknown = JSON.parse(fb);
      if (!obj || typeof obj !== "object" || Array.isArray(obj))
        return { error: "form_bruto deve ser um objeto JSON" };
      out.form_bruto = obj;
    } catch {
      return { error: "form_bruto não é JSON válido" };
    }
  }

  if (de === "pessoa") {
    // linkedin/bio são colunas de profiles (0030); texto que não vira URL
    // e cor/raça torta não derrubam a linha — o cru fica no form_bruto
    out.linkedin = normLinkedin(String(l.linkedin ?? ""));
    const bio = String(l.bio ?? "").trim();
    if (bio.length > 1000) return { error: "bio passa de 1.000 caracteres" };
    out.bio = bio || null;
    const lgpd = String(l.consent_lgpd_em ?? "").trim();
    if (lgpd) {
      const t = new Date(lgpd);
      out.consent_lgpd_em = isNaN(t.getTime()) ? null : t.toISOString();
    }
  }

  if (de === "mentorado") {
    const esc = mapEscolaridade(String(l.escolaridade ?? ""));
    if (String(l.escolaridade ?? "").trim() && !esc)
      return { error: "escolaridade não reconhecida" };
    out.escolaridade = esc;

    // grade semanal do jovem (0038) — JSON {"dias":[],"periodos":[]}
    const disp = parseDisponibilidade(String(l.disponibilidade ?? ""));
    if (disp && "error" in disp) return { error: disp.error };
    out.disponibilidade = disp;

    const resp = civisImportado(l, "resp_");
    const parentesco = capitalizar(String(l.resp_parentesco ?? ""));
    if (resp) out.responsavel = { ...resp, parentesco: parentesco || null };
  }

  // dados civis (0046) — as colunas de documento/endereço viram o jsonb que
  // preenche os termos; nome/nascimento/cidade/UF vêm da própria ficha
  const civis = civisImportado(l, "", {
    nome_civil: nomeProprio(l.nome),
    data_nascimento: out.data_nascimento as string | null,
    cidade: (out.cidade as string | null) ?? "",
    uf: (out.uf as string | null) ?? "",
  });
  if (civis) out.dados_civis = civis;

  return out;
}
