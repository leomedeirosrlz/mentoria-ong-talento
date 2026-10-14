/** Import das respostas do form semanal externo ("Avaliação semanal das
 *  Mentorias" — Google Forms, pt-BR) pra dentro da plataforma.
 *
 *  Núcleo PURO e autocontido: nenhum import de runtime — `import type` é
 *  apagado na transpilação, então este arquivo carrega igual no app
 *  (preview/action), no vitest e no Node 22+ pelos scripts CLI
 *  (`scripts/importar-registros.mjs` importa direto, sem transpilador).
 *  A máquina de CSV e os normalizadores repetem a régua de
 *  `importar.ts`/`forms/normaliza.ts` — reimplementados aqui (em vez de
 *  importados) justamente pra manter o arquivo self-contained.
 *
 *  Destino de cada coluna do form:
 *    "O que foi realizado neste encontro?"  → registros.reflexoes
 *      (a pergunta é narrativa livre — irmã do "Principais reflexões" do
 *      form da plataforma; `atividades` é checklist fechado de tags, texto
 *      corrido não cabe ali)
 *    "Observações do mentor"                → registros.observacoes
 *    "Como você avalia…"                    → registros.avaliacao (enum)
 *    "Foi identificada alguma dificuldade…" → registros.dificuldade (+detalhe)
 *    "Qual será o próximo passo…"           → registros.proximo_passo (+detalhe)
 *    "Nome" / "Nome do Mentorando"          → chave do match da dupla
 *    "Qual encontro/semana…"                → encontros.numero
 *    "Data do encontro"                     → encontros.data_hora/realizado_em
 *    documento/foto (link Drive)            → ignorada, com diff auditável
 *    carimbo/pontuação/apoio                → ignoradas
 *    precisa_apoio nunca é preenchido — pedido de apoio é gesto explícito
 *    do mentor na plataforma, import não infere (o semáforo já acende pela
 *    dificuldade/avaliação).
 *
 *  Match: score por overlap de tokens normalizados — exato e subset
 *  ("Fernando Toledo" ⊆ "Fernando Toledo Martins") resolvem sozinhos;
 *  overlap parcial e fuzzy de token (typo — "Nucolly") só alimentam a
 *  lista de candidatos pra coordenação decidir. Ambíguo ou sem match →
 *  status 'revisar', nunca chute.
 */

import type { AvaliacaoJovem, Dificuldade, ProximoPasso } from "./types";

// ---------- CSV (mesma máquina do importar.ts) ----------

function splitLinha(linha: string, delim: string): string[] {
  const out: string[] = [];
  let cur = "",
    aspas = false;
  for (let i = 0; i < linha.length; i++) {
    const c = linha[i];
    if (aspas) {
      if (c === '"') {
        if (linha[i + 1] === '"') {
          cur += '"';
          i++;
        } else aspas = false;
      } else cur += c;
    } else if (c === '"') aspas = true;
    else if (c === delim) {
      out.push(cur);
      cur = "";
    } else cur += c;
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

function splitRegistros(text: string): string[] {
  const registros: string[] = [];
  let cur = "",
    aspas = false;
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

function contaDelim(linha: string, delim: string): number {
  let n = 0,
    aspas = false;
  for (let i = 0; i < linha.length; i++) {
    const c = linha[i];
    if (c === '"') {
      if (aspas && linha[i + 1] === '"') i++;
      else aspas = !aspas;
    } else if (!aspas && c === delim) n++;
  }
  return n;
}

// ---------- normalização local (régua do forms/normaliza) ----------

/** sem acento + minúscula + trim — mesma chave dos matches do repo. */
export function semAcentoReg(s: string): string {
  return s
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();
}

const normTexto = (s: string) => s.trim().replace(/\s+/g, " ");

/** dd/mm/aaaa, dd-mm-aaaa, dd.mm.aaaa, ISO e serial de planilha → ISO
 *  "aaaa-mm-dd"; null = irreconhecível. Subconjunto do normalizaData — o
 *  form manda dd/mm/aaaa de verdade; serial/ISO entram por tolerância. */
function dataIso(s: string): string | null {
  const cru = s.trim();
  if (!cru) return null;
  let iso: string | null = null;
  const serialM = /^(\d{5})(\.\d+)?$/.exec(cru);
  const isoM = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/.exec(cru);
  const brM = /^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4}|\d{2})/.exec(cru);
  if (serialM) {
    iso = new Date(Date.UTC(1899, 11, 30) + Math.floor(Number(serialM[1])) * 86400000)
      .toISOString()
      .slice(0, 10);
  } else if (isoM) {
    iso = `${isoM[1]}-${isoM[2].padStart(2, "0")}-${isoM[3].padStart(2, "0")}`;
  } else if (brM) {
    let ano = brM[3];
    if (ano.length === 2) ano = `20${ano}`;
    iso = `${ano}-${brM[2].padStart(2, "0")}-${brM[1].padStart(2, "0")}`;
  }
  if (!iso) return null;
  const d = new Date(`${iso}T12:00:00`);
  const re = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  return !isNaN(d.getTime()) && re === iso ? iso : null;
}

// ---------- cabeçalho → campo ----------

/** Campos reconhecidos do form semanal. `anexo`/`apoio` são ignorados de
 *  propósito — mas viram diff auditável quando a célula tem conteúdo. */
export type CampoReg =
  | "mentor"
  | "mentorado"
  | "numero"
  | "data"
  | "duracao"
  | "feito"
  | "tema"
  | "ferramenta"
  | "atividades"
  | "avaliacao"
  | "dificuldade"
  | "proximo"
  | "obs"
  | "anexo"
  | "apoio";

/** Normaliza o header como o normHeader do importar.ts: sem acento,
 *  pontuação interna vira espaço, espaços colapsados. */
export function normHeaderReg(h: string): string {
  return semAcentoReg(h)
    .replace(/[,.;:!?()[\]°ºª/\\_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Header do form → campo. Ordem importa: carimbo/pontuação e os lados do
 *  par (mentorando antes de mentor — "mentor" é substring de "mentorando")
 *  vêm primeiro; o "nome" genérico fica por último. Colunas sem campo
 *  dedicado (carimbo, pontuação, "você precisa de apoio?" etc.) retornam
 *  null e são ignoradas — as que merecem rastro (`anexo`, `apoio`) têm
 *  campo próprio só pra gerar o diff. */
export function canonHeaderReg(h: string): CampoReg | null {
  const n = normHeaderReg(h);
  if (!n) return null;
  if (/carimbo|timestamp/.test(n)) return null;
  if (/pontuacao|score|pontos/.test(n)) return null;
  // lados do par — mentorado antes de mentor ("jovem" só conta com
  // "nome" junto: "participação do jovem" é a pergunta da avaliação)
  if (/mentorad|mentorand|\bmentee|\bpupil/.test(n)) return "mentorado";
  if (/\bjovem\b/.test(n) && /\bnome\b/.test(n)) return "mentorado";
  // número da semana antes de qualquer "avalia" genérico
  if (/qual encontro|encontro semana|encontro.*\b(n|num|numero|ordem)\b|\bnumero.*encontro|n.*encontro.*(avaliad|realiz)|semana.*avaliad|^semana/.test(n))
    return "numero";
  // "Data do encontro" — depois do carimbo (que já saiu)
  if (/\bdata\b/.test(n)) return "data";
  if (/duracao|dura|quanto tempo/.test(n)) return "duracao";
  // narrativa do encontro → reflexoes (antes de "atividades")
  if (/o que foi realizado|realizado neste|o que aconteceu|resumo do encontro|reflex|relato|como foi o encontro/.test(n))
    return "feito";
  if (/instrumento|ferramenta/.test(n)) return "ferramenta";
  if (/\btema\b|assunto/.test(n)) return "tema";
  // checklist de atividades — depois de "realizado" pra não sequestrar
  if (/atividade|o que foi feito/.test(n)) return "atividades";
  if (/desempenho|participac|avalia|nota do encontro|como foi o jovem/.test(n))
    return "avaliacao";
  if (/dificuldade/.test(n)) return "dificuldade";
  if (/proximo passo|proximos passos|encaminhamento/.test(n)) return "proximo";
  if (/observac|\bobs\b|comentario/.test(n)) return "obs";
  if (/documento|foto|anex|arquivo|enviar|comprovante|importancia/.test(n))
    return "anexo";
  // apoio não se importa — decisão de produto: o pedido é gesto do mentor
  // na plataforma. Campo próprio só pra rastrear a célula preenchida.
  if (/apoio|ajuda|suporte|socorro/.test(n)) return "apoio";
  // "Nome"/"Seu nome"/"Nome do mentor" — o genérico por último
  if (/nome|mentor/.test(n)) return "mentor";
  return null;
}

/** Linha crua do CSV — campos canonizados + posição 1-based entre os
 *  dados, pra prévia e o relatório apontarem a mesma linha. */
export type LinhaRegCsv = Record<CampoReg, string> & { n: number };

const REG_VAZIO: Record<CampoReg, string> = {
  mentor: "",
  mentorado: "",
  numero: "",
  data: "",
  duracao: "",
  feito: "",
  tema: "",
  ferramenta: "",
  atividades: "",
  avaliacao: "",
  dificuldade: "",
  proximo: "",
  obs: "",
  anexo: "",
  apoio: "",
};

/** CSV/TSV do Google Forms com header na 1ª linha. Exige mentor +
 *  mentorado + numero pra aceitar o arquivo; linha sem nenhum dos dois
 *  nomes nem número é ignorada. */
export function parseCsvRegistros(text: string): {
  linhas: LinhaRegCsv[];
  ignoradas: number;
} {
  const registros = splitRegistros(text.replace(/^﻿/, ""));
  if (registros.length < 2) return { linhas: [], ignoradas: 0 };
  const header = registros[0];
  const delim = [";", ",", "\t"].reduce((a, b) =>
    contaDelim(header, b) > contaDelim(header, a) ? b : a
  );
  const mapa = splitLinha(header, delim).map(canonHeaderReg);
  const exigidas: CampoReg[] = ["mentor", "mentorado", "numero"];
  if (!exigidas.every((e) => mapa.includes(e))) {
    return { linhas: [], ignoradas: registros.length };
  }
  let ignoradas = 0;
  const linhas = registros.slice(1).flatMap((l, i) => {
    const celulas = splitLinha(l, delim);
    if (mapa.length > 1 && celulas.length === 1) {
      ignoradas++;
      return [];
    }
    const row = { ...REG_VAZIO, n: i + 1 } as LinhaRegCsv;
    mapa.forEach((campo, j) => {
      if (campo && !row[campo]) row[campo] = celulas[j] ?? "";
    });
    if (!row.mentor && !row.mentorado && !row.numero) {
      ignoradas++;
      return [];
    }
    return [row];
  });
  return { linhas, ignoradas };
}

// ---------- diff auditável (mesmo formato do DiffNormalizacao) ----------

export type DiffReg = {
  campo: string;
  label: string;
  de: string;
  para: string;
  revisar: boolean;
  aviso: string | null;
};

// ---------- enums do registro ----------

const MAP_AVALIACAO: readonly (readonly [RegExp, AvaliacaoJovem])[] = [
  [/excel|otim|excepcional/, "excelente"],
  [/bom|boa/, "boa"],
  [/regular|medi|ok\b|razoavel|normal/, "regular"],
  [/baix|ruim|frac|insatisfat/, "baixa"],
];

export function mapAvaliacao(v: string): AvaliacaoJovem | null {
  const n = semAcentoReg(v);
  if (!n) return null;
  for (const [re, val] of MAP_AVALIACAO) {
    if (re.test(n)) return val;
  }
  return null;
}

const NEGACAO_DIFICULDADE =
  /^(nao|nenhuma|nada|nope|sem|ninguem|n\s?\/?a)\b|nenhuma dificuldade|nao (?:houve|foi|identific|tive)|sem dificuldade|nada a (?:relatar|declarar)/;

/** "Não"/vazio → 'nenhuma'; texto que casa uma categoria do CHECK → o
 *  enum; qualquer outro → 'outro' + detalhe = texto integral (as palavras
 *  do mentor não se perdem). */
export function mapDificuldade(v: string): {
  dificuldade: Dificuldade;
  detalhe: string | null;
} {
  const t = semAcentoReg(v);
  const txt = normTexto(v);
  if (!t || NEGACAO_DIFICULDADE.test(t)) {
    return { dificuldade: "nenhuma", detalhe: null };
  }
  if (/organizac|rotina|horario|pontualidade|atraso|falta|agenda|frequencia|compromiss|calendario/.test(t))
    return { dificuldade: "organizacao", detalhe: null };
  if (/comportament/.test(t))
    return { dificuldade: "comportamental", detalhe: null };
  if (/aprendiz|aprender|estudo|escolar|licao|tarefa|prova|materia|nota/.test(t))
    return { dificuldade: "aprendizagem", detalhe: null };
  if (/participa|engaj|intera|comunica|timid|desinteress|respost/.test(t))
    return { dificuldade: "participacao", detalhe: null };
  return { dificuldade: "outro", detalhe: txt || v.trim() };
}

/** Opções do form semanal ≈ PROXIMO_PASSO_LABEL da plataforma — casa por
 *  palavra-chave; texto livre vira 'outro' + detalhe. */
export function mapProximoPasso(v: string): {
  proximo_passo: ProximoPasso | null;
  detalhe: string | null;
} {
  const t = semAcentoReg(v);
  const txt = normTexto(v);
  if (!t) return { proximo_passo: null, detalhe: null };
  if (/continuar|manter|seguir|dar sequencia|continuidade|mesmo caminho/.test(t))
    return { proximo_passo: "continuar", detalhe: null };
  if (/reforcar|reforco|revisar|repetir/.test(t))
    return { proximo_passo: "reforcar", detalhe: null };
  if (/feedback|devolutiva/.test(t))
    return { proximo_passo: "novo_feedback", detalhe: null };
  if (/de perto|mais proximo|monitor|seguir de perto|acompanhar/.test(t))
    return { proximo_passo: "acompanhar_de_perto", detalhe: null };
  if (/individual|particular|sozinho|a sós|a sos|conversar com/.test(t))
    return { proximo_passo: "conversa_individual", detalhe: null };
  if (/^outr/.test(t) && !txt.slice(5).trim())
    return { proximo_passo: "outro", detalhe: null };
  return { proximo_passo: "outro", detalhe: txt || v.trim() };
}

/** Duração do encontro → a faixa do CHECK (30/45/60/90/120) ou null.
 *  Aceita "60", "60 min", "1h", "1h30", "1,5h", "2 horas". */
export function mapDuracao(v: string): number | null {
  const t = semAcentoReg(v).replace(/\s+/g, "");
  if (!t) return null;
  let min: number | null = null;
  const hm = /^(\d{1,2})[h:](\d{1,2})/.exec(t); // "1h30", "1:30"
  const h = /^(\d{1,2}(?:[.,]\d+)?)h/.exec(t); // "2h", "1,5h"
  const m = /^(\d{1,3})/.exec(t); // "45", "45 min"
  if (hm) min = Number(hm[1]) * 60 + Number(hm[2]);
  else if (h) min = Math.round(Number(h[1].replace(",", ".")) * 60);
  else if (m) min = Number(m[1]);
  return min != null && [30, 45, 60, 90, 120].includes(min) ? min : null;
}

// ---------- linha → payload ----------

/** O que vai pro registro do encontro — espelha os campos mapeados da RPC
 *  `importar_registros` (precisa_apoio deliberadamente fora). */
export type RegistroPayload = {
  tema: string | null;
  ferramenta: string | null;
  reflexoes: string | null;
  observacoes: string | null;
  atividades: string[];
  avaliacao: AvaliacaoJovem | null;
  dificuldade: Dificuldade | null;
  dificuldade_detalhe: string | null;
  proximo_passo: ProximoPasso | null;
  proximo_passo_detalhe: string | null;
};

export type StatusLinha = "ok" | "revisar" | "ignorar";

/** Candidato a dupla pro Select da linha 'revisar' — com nome resolvido
 *  dos dois lados pro humano decidir sem abrir outra aba. */
export type DuplaCandidata = {
  id: string;
  mentor_id: string;
  mentorado_id: string;
  status: string;
  trilha: string;
  mentorNome: string;
  mentoradoNome: string;
};

/** Linha processada — o que a prévia exibe e o que `executar` manda pra
 *  RPC depois da aprovação. */
export type LinhaReg = {
  n: number;
  mentorTxt: string;
  mentoradoTxt: string;
  numeroTxt: string;
  dataTxt: string;
  numero: number | null;
  /** ISO aaaa-mm-dd — já com o ano absurdo corrigido quando flagado. */
  dataIso: string | null;
  /** timestamptz pronto pra RPC (19h BRT — horário típico do encontro). */
  dataHora: string | null;
  duracaoMin: number | null;
  status: StatusLinha;
  /** por que pede revisão/ignora — pt-BR, direto pro humano */
  motivo: string | null;
  duplaId: string | null;
  mentorNome: string | null;
  mentoradoNome: string | null;
  candidatos: DuplaCandidata[];
  diffs: DiffReg[];
  payload: RegistroPayload;
};

/** "1º Encontro", "Encontro 4", "Semana 2", "3" → número. */
export function numeroEncontro(v: string): number | null {
  const m = /(\d{1,2})/.exec(semAcentoReg(v));
  return m ? Number(m[1]) : null;
}

const DATA_HORA_SUFIJO = "T19:00:00-03:00"; // encontros acontecem à noite (BRT fixo)

/** Data do encontro → ISO + flag de ano absurdo. Ano <2020 ou >ano+1 é
 *  typo clássico de teclado ("16/09/1960") — corrige pro ano corrente e
 *  manda pra revisão humana em vez de gravar 1960 no banco. */
export function parseDataEncontro(
  v: string,
  hoje = new Date()
): { iso: string | null; anoSuspeito: boolean } {
  const iso = dataIso(v);
  if (!iso) return { iso: null, anoSuspeito: false };
  const ano = Number(iso.slice(0, 4));
  const corrente = hoje.getFullYear();
  if (ano < 2020 || ano > corrente + 1) {
    // mesmo dia/mês no ano corrente — a dupla existe agora, não em 1960
    return { iso: `${corrente}${iso.slice(4)}`, anoSuspeito: true };
  }
  return { iso, anoSuspeito: false };
}

/** Linha crua → linha processada com payload + diffs (a resolução da
 *  dupla vem depois, em matchDupla). Nunca joga a linha fora — sem número
 *  ela vira 'ignorar' com motivo, não some em silêncio. */
export function normalizaLinhaReg(
  l: LinhaRegCsv,
  hoje = new Date()
): LinhaReg {
  const diffs: DiffReg[] = [];
  const push = (
    campo: string,
    label: string,
    de: string,
    para: string,
    revisar = false,
    aviso: string | null = null
  ) => {
    if (de.trim() || para) diffs.push({ campo, label, de: de.trim(), para, revisar, aviso });
  };

  const numero = numeroEncontro(l.numero);
  if (numero != null && (numero < 1 || numero > 24)) {
    push("numero", "encontro", l.numero, "", true, "nº fora da faixa 1–24");
  }
  const numeroOk = numero != null && numero >= 1 && numero <= 24 ? numero : null;

  const { iso, anoSuspeito } = parseDataEncontro(l.data, hoje);
  if (l.data.trim() && !iso) {
    push("data", "data", l.data, "", true, "data ilegível — descartada");
  } else if (iso && anoSuspeito) {
    push("data", "data", l.data, `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`, true, "ano improvável — conferir");
  } else if (iso && l.data.trim() !== iso) {
    push("data", "data", l.data, `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`);
  }

  const duracaoMin = mapDuracao(l.duracao);
  if (l.duracao.trim() && duracaoMin == null) {
    push("duracao", "duração", l.duracao, "", true, "duração não reconhecida — ficou 60 min");
  }

  const avaliacao = mapAvaliacao(l.avaliacao);
  if (l.avaliacao.trim() && !avaliacao) {
    push("avaliacao", "avaliação", l.avaliacao, "", true, "não reconhecida — ficou em branco");
  }
  const dif = mapDificuldade(l.dificuldade);
  const prox = mapProximoPasso(l.proximo);

  const atividades = l.atividades
    .split(/[;,|\n]+/)
    .map((a) => normTexto(a))
    .filter((a) => a.length > 1);
  const unicas = atividades.filter(
    (a, i) => atividades.findIndex((b) => semAcentoReg(b) === semAcentoReg(a)) === i
  );

  if (l.anexo.trim()) {
    push("anexo", "anexo", l.anexo, "", true, "anexo ignorado (link externo)");
  }
  if (l.apoio.trim()) {
    push("apoio", "apoio", l.apoio, "", true, "pedido de apoio não se importa — ele é feito pela plataforma");
  }

  const txt = (s: string, cap: number, campo: string, label: string) => {
    const t = normTexto(s);
    if (t.length > cap) {
      push(campo, label, t, `${t.slice(0, cap - 1)}…`, true, `cortado em ${cap} caracteres`);
      return t.slice(0, cap - 1);
    }
    return t || null;
  };

  return {
    n: l.n,
    mentorTxt: normTexto(l.mentor),
    mentoradoTxt: normTexto(l.mentorado),
    numeroTxt: normTexto(l.numero),
    dataTxt: normTexto(l.data),
    numero: numeroOk,
    dataIso: iso,
    dataHora: iso ? `${iso}${DATA_HORA_SUFIJO}` : null,
    duracaoMin,
    status: numeroOk ? "ok" : "ignorar",
    motivo: numeroOk ? null : "nº do encontro não identificado",
    duplaId: null,
    mentorNome: null,
    mentoradoNome: null,
    candidatos: [],
    diffs,
    payload: {
      tema: txt(l.tema, 500, "tema", "tema"),
      ferramenta: txt(l.ferramenta, 500, "ferramenta", "ferramenta"),
      reflexoes: txt(l.feito, 20000, "feito", "o que foi realizado"),
      observacoes: txt(l.obs, 20000, "obs", "observações"),
      atividades: unicas,
      avaliacao,
      dificuldade: dif.dificuldade,
      dificuldade_detalhe: dif.detalhe ? txt(dif.detalhe, 2000, "dificuldade", "dificuldade") : null,
      proximo_passo: prox.proximo_passo,
      proximo_passo_detalhe: prox.detalhe ? txt(prox.detalhe, 2000, "proximo", "próximo passo") : null,
    },
  };
}

// ---------- match de dupla ----------

/** O mínimo que o match precisa de cada pessoa. */
export type PessoaRef = {
  id: string;
  nome: string;
  nome_social?: string | null;
};

export type UniversoReg = {
  /** profiles com papel de mentor (dpp/especialista) */
  mentores: PessoaRef[];
  mentorados: PessoaRef[];
  duplas: DuplaCandidata[];
};

const chaveNome = (s: string) => semAcentoReg(normTexto(s));
const tokensDe = (s: string) =>
  chaveNome(s)
    .split(" ")
    .filter((t) => t.length >= 2);

/** Distância de edição ≤ 2 pra tokens de 4+ letras — só pra tier fraco
 *  (dica visual), nunca resolve sozinho. */
function dist1(a: string, b: string): boolean {
  if (Math.abs(a.length - b.length) > 1) return false;
  const dp = b.split("").map((_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    let prev = dp[0];
    dp[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const t = dp[j];
      dp[j] = Math.min(dp[j] + 1, dp[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = t;
    }
  }
  return dp[b.length] <= 1;
}

const casaToken = (q: string, c: string): boolean =>
  q === c ||
  (q.length >= 4 && (q.startsWith(c) || c.startsWith(q)));

/** Candidatos de um lado do par.
 *   fortes — todo token da busca casa (exato ou prefixo 4+) algum token do
 *            cadastro: "Fernando Toledo" ⊆ "Fernando Toledo Martins".
 *            Resolvem sozinhos quando únicos.
 *   fracos — overlap parcial ou typo (edição ≤1 — "Stuanni"→"Stuani",
 *            "Nucolly"→"Nicolly"): alimentam o Select da revisão,
 *            nunca fecham o match — grafia errada não é certeza. */
export function candidatosDeNome(
  valor: string,
  pessoas: PessoaRef[]
): { fortes: PessoaRef[]; fracos: PessoaRef[] } {
  const q = chaveNome(valor);
  if (!q) return { fortes: [], fracos: [] };
  const qtok = tokensDe(valor);
  const nomesDe = (p: PessoaRef) =>
    [p.nome, p.nome_social ?? ""].filter((s) => s.trim()).map((n) => ({
      cheio: chaveNome(n),
      tokens: tokensDe(n),
    }));

  const exatos = pessoas.filter((p) => nomesDe(p).some((n) => n.cheio === q));
  if (exatos.length) return { fortes: exatos, fracos: [] };

  const fortes = pessoas.filter((p) =>
    nomesDe(p).some((n) => {
      const alvo = new Set(n.tokens);
      return qtok.length > 0 && qtok.every((t) => [...alvo].some((c) => casaToken(t, c)));
    })
  );
  if (fortes.length) return { fortes, fracos: [] };

  const fracos = pessoas.filter((p) =>
    nomesDe(p).some((n) => {
      const alvo = n.tokens;
      const comuns = qtok.filter((t) => alvo.includes(t));
      if (comuns.length > 0) return true;
      // typo de token: algum token da busca a ≤1 edição de algum cadastrado
      return qtok.some(
        (t) => t.length >= 4 && alvo.some((c) => c.length >= 4 && dist1(t, c))
      );
    })
  );
  return { fortes: [], fracos };
}

export type MatchDupla = {
  dupla: DuplaCandidata | null;
  candidatos: DuplaCandidata[];
  mentorNome: string | null;
  mentoradoNome: string | null;
  motivo: string | null;
};

/** Resolve (mentorTxt, mentoradoTxt) → dupla. 1 dupla forte = match;
 *  qualquer outra configuração → null + candidatos pra UI mostrar e a
 *  coordenação escolher. Ordem dos candidatos: par resolvido nos dois
 *  lados → duplas do mentor achado → duplas do mentorado achado → vazio. */
export function matchDupla(
  mentorTxt: string,
  mentoradoTxt: string,
  universo: UniversoReg
): MatchDupla {
  const cm = candidatosDeNome(mentorTxt, universo.mentores);
  const cmd = candidatosDeNome(mentoradoTxt, universo.mentorados);
  const mentorNome = cm.fortes.length === 1 ? cm.fortes[0].nome : null;
  const mentoradoNome = cmd.fortes.length === 1 ? cmd.fortes[0].nome : null;

  const idsM = new Set(cm.fortes.map((p) => p.id));
  const idsMd = new Set(cmd.fortes.map((p) => p.id));
  const fortes = universo.duplas.filter(
    (d) => idsM.has(d.mentor_id) && idsMd.has(d.mentorado_id)
  );
  if (fortes.length === 1) {
    return {
      dupla: fortes[0],
      candidatos: [],
      mentorNome: fortes[0].mentorNome,
      mentoradoNome: fortes[0].mentoradoNome,
      motivo: null,
    };
  }
  if (fortes.length > 1) {
    return {
      dupla: null,
      candidatos: fortes,
      mentorNome,
      mentoradoNome,
      motivo: `${fortes.length} duplas possíveis pro par — escolha`,
    };
  }

  // nenhum par forte: monta a trilha de pistas pro Select
  const idsMf = new Set([...cm.fortes, ...cm.fracos].map((p) => p.id));
  const idsMdf = new Set([...cmd.fortes, ...cmd.fracos].map((p) => p.id));
  const porPar = universo.duplas.filter(
    (d) => idsMf.has(d.mentor_id) && idsMdf.has(d.mentorado_id)
  );
  // lado com UM forte — ou um único fraco (typo tipo "stuanni"/"nucolly",
  // provavelmente é ele mesmo) — traz as duplas dele como prováveis
  const provM =
    cm.fortes.length === 1 ? cm.fortes[0] : cm.fracos.length === 1 ? cm.fracos[0] : null;
  const provMd =
    cmd.fortes.length === 1 ? cmd.fortes[0] : cmd.fracos.length === 1 ? cmd.fracos[0] : null;
  const doMentor = provM ? universo.duplas.filter((d) => d.mentor_id === provM.id) : [];
  const doMentorado = provMd ? universo.duplas.filter((d) => d.mentorado_id === provMd.id) : [];
  const vistos = new Set<string>();
  const candidatos = [...porPar, ...doMentor, ...doMentorado].filter((d) => {
    if (vistos.has(d.id)) return false;
    vistos.add(d.id);
    return true;
  });

  const motivos: string[] = [];
  if (!mentorTxt.trim() && !mentoradoTxt.trim()) motivos.push("sem nomes na linha");
  else {
    if (cm.fortes.length === 0)
      motivos.push(
        cm.fracos.length
          ? `mentor "${mentorTxt}" não bate 100% (parecidos: ${cm.fracos.slice(0, 3).map((p) => p.nome).join(", ")})`
          : `mentor "${mentorTxt}" não encontrado`
      );
    if (cmd.fortes.length === 0)
      motivos.push(
        cmd.fracos.length
          ? `mentorado(a) "${mentoradoTxt}" não bate 100% (parecidos: ${cmd.fracos.slice(0, 3).map((p) => p.nome).join(", ")})`
          : `mentorado(a) "${mentoradoTxt}" não encontrado(a)`
      );
    if (cm.fortes.length === 1 && cmd.fortes.length === 1)
      motivos.push("o par não forma nenhuma dupla cadastrada — escolha");
  }
  return {
    dupla: null,
    candidatos,
    mentorNome,
    mentoradoNome,
    motivo: motivos.join(" · ") || "dupla não identificada — escolha",
  };
}

// ---------- linha + universo → LinhaReg final ----------

/** Pipeline completo: normaliza cada linha, tenta o match da dupla e
 *  fixa o status. 'ok' só quando a dupla fechou e não há flag de data;
 *  'revisar' pede olho humano (Select de dupla na UI); 'ignorar' = sem
 *  número de encontro, não há como gravar. */
export function processaLinhas(
  linhas: LinhaRegCsv[],
  universo: UniversoReg,
  hoje = new Date()
): { linhas: LinhaReg[]; stats: { ok: number; revisar: number; ignorar: number } } {
  const stats = { ok: 0, revisar: 0, ignorar: 0 };
  const out = linhas.map((l) => {
    const r = normalizaLinhaReg(l, hoje);
    const motivos: string[] = [];
    if (r.numero == null) {
      r.status = "ignorar";
      stats.ignorar++;
      return r;
    }
    const m = matchDupla(r.mentorTxt, r.mentoradoTxt, universo);
    r.mentorNome = m.mentorNome;
    r.mentoradoNome = m.mentoradoNome;
    r.candidatos = m.candidatos;
    if (m.dupla) {
      r.duplaId = m.dupla.id;
      r.mentorNome = m.dupla.mentorNome;
      r.mentoradoNome = m.dupla.mentoradoNome;
    } else {
      motivos.push(m.motivo!);
    }
    if (!r.dataIso && r.dataTxt) motivos.push("data ilegível");
    if (!r.dataTxt) motivos.push("sem data do encontro");
    if (r.diffs.some((d) => d.revisar) && m.dupla)
      motivos.push("campos marcados pra conferir");
    if (motivos.length) {
      r.status = "revisar";
      r.motivo = motivos.filter(Boolean).join(" · ");
      stats.revisar++;
    } else {
      r.status = "ok";
      stats.ok++;
    }
    return r;
  });
  return { linhas: out, stats };
}

// ---------- payload pra RPC ----------

/** Item da RPC `importar_registros` — montado só pra linha aprovada
 *  (duplaId presente, numero válido). */
export type ItemRpc = {
  dupla_id: string;
  numero: number;
  data_hora: string | null;
  duracao_min: number | null;
  registro: RegistroPayload;
};

export function itemRpc(l: LinhaReg): ItemRpc | null {
  if (!l.duplaId || l.numero == null) return null;
  return {
    dupla_id: l.duplaId,
    numero: l.numero,
    data_hora: l.dataHora,
    duracao_min: l.duracaoMin,
    registro: l.payload,
  };
}

/** Saneia a linha vinda do client pro execute — a fronteira da action não
 *  confia na forma (mesmo padrão do saneiaLinhaPar). Aceita a linha da
 *  prévia com duplaId possivelmente escolhido à mão na UI. */
export function saneiaLinhaReg(l: Partial<LinhaReg>, i: number): LinhaReg {
  const s = (v: unknown) => (typeof v === "string" ? v : "");
  const strOrNull = (v: unknown) => (typeof v === "string" && v.trim() ? v : null);
  const numOrNull = (v: unknown) =>
    typeof v === "number" && Number.isInteger(v) ? v : null;
  const payload = (l.payload ?? {}) as Partial<RegistroPayload>;
  const lista = Array.isArray(payload.atividades)
    ? payload.atividades.filter((a): a is string => typeof a === "string")
    : [];
  return {
    n: typeof l.n === "number" && l.n > 0 ? l.n : i + 1,
    mentorTxt: s(l.mentorTxt),
    mentoradoTxt: s(l.mentoradoTxt),
    numeroTxt: s(l.numeroTxt),
    dataTxt: s(l.dataTxt),
    numero: numOrNull(l.numero),
    dataIso: strOrNull(l.dataIso),
    dataHora: strOrNull(l.dataHora),
    duracaoMin: numOrNull(l.duracaoMin),
    status:
      l.status === "ok" || l.status === "revisar" || l.status === "ignorar"
        ? l.status
        : "revisar",
    motivo: strOrNull(l.motivo),
    duplaId: strOrNull(l.duplaId),
    mentorNome: strOrNull(l.mentorNome),
    mentoradoNome: strOrNull(l.mentoradoNome),
    candidatos: Array.isArray(l.candidatos) ? l.candidatos : [],
    diffs: Array.isArray(l.diffs) ? l.diffs : [],
    payload: {
      tema: strOrNull(payload.tema),
      ferramenta: strOrNull(payload.ferramenta),
      reflexoes: strOrNull(payload.reflexoes),
      observacoes: strOrNull(payload.observacoes),
      atividades: lista,
      avaliacao: strOrNull(payload.avaliacao) as AvaliacaoJovem | null,
      dificuldade: strOrNull(payload.dificuldade) as Dificuldade | null,
      dificuldade_detalhe: strOrNull(payload.dificuldade_detalhe),
      proximo_passo: strOrNull(payload.proximo_passo) as ProximoPasso | null,
      proximo_passo_detalhe: strOrNull(payload.proximo_passo_detalhe),
    },
  };
}
