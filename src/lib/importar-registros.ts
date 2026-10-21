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
 *  Match: scoreLinha — confiança 0–100 por dupla plausível. Cada lado
 *  (mentor/mentorado) tira nota própria contra o cadastro (exato,
 *  subset de tokens, prefixo, typo ≤1/≤2 edições, apelido derivado do
 *  roster, token único com unicidade); o par vale o elo mais fraco e
 *  contexto (data oficial do cronograma, nº da trilha, encontro já
 *  existente, dupla única, duplicata no lote) soma ou desconta — nunca
 *  lava lado fraco pra auto. 'auto' exige score ≥90 com os DOIS lados
 *  ≥80 e sem ambiguidade; 60+ vira 'provável' (sugestão pré-selecionada
 *  pra um clique); abaixo disso 'manual'. Empate técnico e placeholder
 *  ("Mentorada") nunca fecham auto. Toda decisão carrega evidencias
 *  pt-BR — a prévia explica o porquê de cada linha.
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
  /** contexto opcional do universo — afina o score (data oficial,
   *  início da dupla). Ausente, o match usa só os nomes. */
  cronograma_id?: string | null;
  iniciada_em?: string | null;
  /** nota da hipótese no scoreLinha — preenchido nos candidatos */
  score?: number;
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
  /** confiança do match 0–100 + nível + a trilha de sinais que a
   *  compuseram — null nas linhas 'ignorar' (match nem roda). */
  score: number | null;
  nivel: NivelMatch | null;
  evidencias: Evidencia[];
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
    score: null,
    nivel: null,
    evidencias: [],
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

// ---------- match de dupla: score de confiança ----------

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
  /** cronograma_id → numero → data oficial (ciclo_eventos). Contexto
   *  opcional — afina o score quando o universo o traz. */
  calendario?: Map<string, Map<number, string>>;
  /** dupla_id → numero → encontro existente — corrobora a hipótese. */
  encontros?: Map<string, Map<number, { status: string; data: string | null }>>;
};

/** Nível de confiança do match: 'auto' fecha sozinho · 'provável'
 *  pré-seleciona a sugestão pra um clique · 'manual' exige escolha. */
export type NivelMatch = "auto" | "provavel" | "manual";

/** Um sinal que compôs (ou descontou) o score — vai direto pra prévia,
 *  é a resposta de "por que essa dupla?". `peso` = nota do lado (0–100)
 *  nos itens de nome, delta no resto. */
export type Evidencia = {
  icone:
    | "user" | "users" | "id-badge" | "sparkle" | "link" | "calendar"
    | "hash" | "check" | "copy" | "minus" | "warning" | "question";
  texto: string;
  peso: number;
  lado?: "mentor" | "mentorado" | "par" | "contexto";
};

const chaveNome = (s: string) => semAcentoReg(normTexto(s));
const tokensDe = (s: string) =>
  chaveNome(s)
    .split(" ")
    .filter((t) => t.length >= 2);

/** Distância de edição Damerau-Levenshtein (transposição conta 1
 *  edição — "nicloly"→"nicolly"). Usada nos tiers de typo. */
function distEd(a: string, b: string): number {
  if (a === b) return 0;
  const la = a.length,
    lb = b.length;
  if (Math.abs(la - lb) > 2) return 3;
  const dp: number[][] = [];
  for (let i = 0; i <= la; i++) dp[i] = [i];
  for (let j = 1; j <= lb; j++) dp[0][j] = j;
  for (let i = 1; i <= la; i++) {
    for (let j = 1; j <= lb; j++) {
      const custo = a[i - 1] === b[j - 1] ? 0 : 1;
      let v = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + custo
      );
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        v = Math.min(v, dp[i - 2][j - 2] + custo);
      }
      dp[i][j] = v;
    }
  }
  return dp[la][lb];
}

/** Qualidade token-a-token: 1 exato · .95 prefixo firme (razão ≥.7 —
 *  "fernando"~"fernan") · .75 typo ≤1 edição ("nucolly"~"nicolly",
 *  "stuanni"~"stuani") · .60 prefixo curto ou apelido derivado · .50
 *  typo ≤2 em token longo · 0 sem casa. "guto" NÃO é prefixo de
 *  "gustavo" (3ª letra diverge) — fica de fora, como sempre foi. */
function qualToken(q: string, c: string): number {
  if (q === c) return 1;
  const [s, l] = q.length <= c.length ? [q, c] : [c, q];
  if (l.startsWith(s)) {
    if (s.length / l.length >= 0.7) return 0.95;
    return s.length >= 3 ? 0.6 : 0;
  }
  if (s.length >= 4 && l.length >= 4) {
    const d = distEd(q, c);
    if (d <= 1) return 0.75;
    if (d <= 2 && s.length >= 7 && l.length >= 7) return 0.5;
  }
  return 0;
}

/** Apelidos deriváveis do PRÓPRIO cadastro (diminutivos pt-BR do 1º
 *  nome + iniciais): "fernando"→"fernandinho", iniciais de nome com 3+
 *  tokens. Nada de dicionário externo — só o que o roster autoriza, e
 *  morre com o cadastro. */
function apelidosDe(p: PessoaRef): Set<string> {
  const out = new Set<string>();
  for (const nome of [p.nome, p.nome_social ?? ""].filter((s) => s?.trim())) {
    const toks = tokensDe(nome);
    const f = toks[0];
    if (f && f.length >= 4) {
      const base = f.replace(/[aeiou]+$/, "");
      for (const sfx of ["inho", "inha", "zinho", "zinha"]) {
        out.add(base + sfx);
        out.add(f + sfx);
      }
    }
    if (toks.length >= 3) out.add(toks.map((t) => t[0]).join(""));
  }
  return out;
}

/** Rótulos genéricos digitados no lugar do nome ("Mentorada", "o
 *  menino") — lado ausente: resolve por eliminação via dupla do outro
 *  lado, nunca como nome. */
const PLACEHOLDER_NOME = new Set([
  "mentor", "mentora", "mentorado", "mentorada", "mentorando", "mentoranda",
  "jovem", "aluno", "aluna", "pupilo", "pupila", "aprendiz",
  "menino", "menina", "garoto", "garota", "crianca", "rapaz", "moco", "moca",
  "nome", "teste", "sem nome", "na", "n a", "xx", "xxx",
]);
/** Artigos/possessivos que precedem o rótulo — "o menino", "minha
 *  mentorada". Sem eles o rótulo seria sobrenome ("João Menino" é nome). */
const ARTIGO_NOME = new Set([
  "o", "a", "os", "as", "um", "uma", "meu", "minha", "meus", "minhas",
  "seu", "sua", "este", "esta", "esse", "essa", "aquele", "aquela",
]);
const ehPlaceholder = (v: string): boolean => {
  const t = v.trim();
  if (!t || /^[-—?.]+$/.test(t)) return true;
  const partes = chaveNome(t).split(" ");
  return (
    PLACEHOLDER_NOME.has(partes.join(" ")) ||
    (partes.length >= 2 &&
      ARTIGO_NOME.has(partes[0]) &&
      PLACEHOLDER_NOME.has(partes.slice(1).join(" ")))
  );
};

type AvalNome = {
  /** |q|≥2 → nota do tier; |q|==1 → qualidade crua 0–1 (pool decide). */
  score: number;
  via: string;
  social: boolean;
  /** matches imperfeitos (qualidade <1) pra compor a evidência */
  casados: { q: string; c: string; qk: number }[];
};

/** Busca × uma variante de nome (nome ou nome_social) de UMA pessoa. */
function avaliaNome(
  q: string,
  qtok: string[],
  nome: string,
  apelidos: Set<string>,
  social: boolean
): AvalNome {
  const zero: AvalNome = { score: 0, via: "zero", social, casados: [] };
  const cheio = chaveNome(nome);
  if (!cheio) return zero;
  if (cheio === q) return { ...zero, score: 100, via: "exato" };
  // busca sem token útil ("A", "J", "1") não pontua ninguém — sem esse
  // guard, matched===qtok.length (0===0) premiava 68 no pool inteiro
  if (!qtok.length) return zero;
  const ctok = tokensDe(nome);
  const quals: number[] = [];
  const casados: AvalNome["casados"] = [];
  let apelidoTok = "";
  for (const t of qtok) {
    let best = 0,
      bc = "";
    for (const c of ctok) {
      const qk = qualToken(t, c);
      if (qk > best) {
        best = qk;
        bc = c;
      }
    }
    if (best < 0.6 && apelidos.has(t)) {
      best = 0.6;
      bc = ctok[0] ?? t;
      apelidoTok = t;
    }
    quals.push(best);
    if (best > 0 && best < 1) casados.push({ q: t, c: bc, qk: best });
  }
  if (qtok.length === 1) {
    return {
      score: quals[0] ?? 0,
      via: apelidoTok ? "apelido" : "token",
      social,
      casados,
    };
  }
  const matched = quals.filter((x) => x > 0).length;
  const weakest = quals.length ? Math.min(...quals) : 0;
  if (matched === qtok.length) {
    const score =
      weakest >= 1 ? 95 : weakest >= 0.95 ? 92 : weakest >= 0.75 ? 78 : weakest >= 0.6 ? 74 : 68;
    const via =
      weakest >= 1
        ? "subset"
        : weakest >= 0.95
          ? "subset_prefixo"
          : weakest >= 0.75
            ? "subset_typo"
            : weakest >= 0.6
              ? "subset_apelido"
              : "subset_frac";
    return { score, via, social, casados };
  }
  const first = quals[0] > 0,
    last = quals[quals.length - 1] > 0;
  if (first && last) return { score: 65, via: "ancora", social, casados };
  if (
    matched / qtok.length >= 0.5 &&
    ctok.length > 0 &&
    qualToken(qtok[0], ctok[0]) > 0
  ) {
    return { score: 55, via: "parcial_1nome", social, casados };
  }
  if (matched > 0) return { score: 40, via: "parcial", social, casados };
  return zero;
}

type Lado = {
  /** nota do melhor candidato do pool (0–100) */
  score: number;
  /** melhor pessoa se única no topo (empate → null) */
  pessoa: PessoaRef | null;
  via: string;
  evidencias: Evidencia[];
  /** pessoa.id → nota — base das hipóteses de dupla */
  porPessoa: Map<string, number>;
  /** pessoas com nota ≥40, desc — alimentam o Select */
  plausiveis: PessoaRef[];
  placeholder: boolean;
};

const ddmm = (iso: string) =>
  `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;

/** Busca × pool do lado (mentores ou mentorados). Resolve a nota de
 *  cada pessoa — incluindo o tier de unicidade pra busca de 1 token —
 *  e monta a evidência legível do melhor resultado. */
function scoreLado(
  valor: string,
  pessoas: PessoaRef[],
  apelidosPool: Map<string, Set<string>>,
  papel: "mentor" | "mentorado"
): Lado {
  const vazio: Lado = {
    score: 0,
    pessoa: null,
    via: "zero",
    evidencias: [],
    porPessoa: new Map(),
    plausiveis: [],
    placeholder: false,
  };
  const rotulo = papel === "mentor" ? "mentor(a)" : "mentorado(a)";
  if (ehPlaceholder(valor)) {
    return {
      ...vazio,
      via: "placeholder",
      placeholder: true,
      evidencias: valor.trim()
        ? [
            {
              icone: "question" as const,
              texto: `"${normTexto(valor)}" não é nome — rótulo genérico`,
              peso: 0,
              lado: papel,
            },
          ]
        : [],
    };
  }
  const q = chaveNome(valor);
  const qtok = tokensDe(valor);
  const avalPorPessoa = pessoas.map((p) => {
    const ap = apelidosPool.get(p.id) ?? new Set<string>();
    const variantes = [
      { n: p.nome, social: false },
      ...(p.nome_social?.trim() ? [{ n: p.nome_social, social: true }] : []),
    ];
    let best: AvalNome = { score: 0, via: "zero", social: false, casados: [] };
    for (const v of variantes) {
      const a = avaliaNome(q, qtok, v.n, ap, v.social);
      if (a.score > best.score) best = a;
    }
    return { p, best };
  });

  const porPessoa = new Map<string, number>();
  if (qtok.length === 1) {
    // token único: força vem da UNICIDADE no pool, não do comprimento
    const plaus = avalPorPessoa.filter((x) => x.best.score >= 0.5);
    for (const { p, best } of avalPorPessoa) {
      const qk = best.score;
      if (qk < 0.5) continue;
      const unico = plaus.filter((x) => x.best.score >= 0.6).length <= 1;
      porPessoa.set(
        p.id,
        qk >= 1
          ? unico
            ? 85
            : 45
          : qk >= 0.95
            ? unico
              ? 80
              : 45
            : qk >= 0.75
              ? unico
                ? 62
                : 45
              : qk >= 0.6
                ? unico
                  ? 72
                  : 45
                : unico
                  ? 50
                  : 40
      );
    }
  } else {
    for (const { p, best } of avalPorPessoa) {
      if (best.score > 0) porPessoa.set(p.id, best.score);
    }
  }

  const ordenados = [...porPessoa.entries()].sort((a, b) => b[1] - a[1]);
  const plausiveis = ordenados
    .filter(([, s]) => s >= 40)
    .slice(0, 4)
    .map(([id]) => pessoas.find((p) => p.id === id)!)
    .filter(Boolean);
  const top = ordenados[0];
  if (!top || top[1] <= 0) {
    return {
      ...vazio,
      evidencias: [
        {
          icone: "question" as const,
          texto: `${rotulo} "${normTexto(valor)}" não consta no cadastro`,
          peso: 0,
          lado: papel,
        },
      ],
    };
  }
  const [topId, topScore] = top;
  const empate = ordenados.length > 1 && ordenados[1][1] === topScore;
  const pessoa = empate ? null : (pessoas.find((p) => p.id === topId) ?? null);
  const best = avalPorPessoa.find((x) => x.p.id === topId)!.best;

  // evidência do lado — string única, pt-BR, pronta pra prévia. O nome
  // citado é o do CANDIDATO pontuado (mesmo em empate — pessoa só zera
  // a unicidade, não a exibição).
  const nom = (pessoas.find((p) => p.id === topId) ?? pessoa)?.nome ?? "?";
  const detalhe = best.casados
    .filter((x) => x.q !== x.c)
    .map((x) =>
      x.qk >= 0.95
        ? `"${x.q}" ≈ início de "${x.c}"`
        : x.qk >= 0.75
          ? `"${x.q}" ≈ "${x.c}" (grafia)`
          : `"${x.q}" ≈ "${x.c}"`
    )
    .join(" · ");
  let texto: string;
  switch (best.via) {
    case "exato":
      texto = `"${normTexto(valor)}" — ${best.social ? "nome social exato" : "nome exato"}`;
      break;
    case "subset":
      texto = `"${normTexto(valor)}" ⊆ "${nom}"`;
      break;
    case "subset_prefixo":
    case "subset_typo":
    case "subset_apelido":
    case "subset_frac":
      texto = detalhe ? `${detalhe} ⊆ "${nom}"` : `"${normTexto(valor)}" ⊆ "${nom}"`;
      break;
    case "token":
      texto = `"${normTexto(valor)}" — único(a) ${rotulo} com esse nome`;
      break;
    case "apelido":
      texto = `"${normTexto(valor)}" ≈ apelido de "${nom}"`;
      break;
    case "ancora":
      texto = `"${normTexto(valor)}" ~ "${nom}" (1º e último nome)`;
      break;
    case "parcial_1nome":
      texto = `só "${qtok[0]}" aparece em "${nom}"`;
      break;
    default:
      texto = detalhe ? `${detalhe} em "${nom}"` : `pedaço de "${normTexto(valor)}" ≈ "${nom}"`;
  }
  return {
    score: topScore,
    pessoa,
    via: best.via,
    evidencias: [{ icone: best.social ? "id-badge" : "user", texto, peso: topScore, lado: papel }],
    porPessoa,
    plausiveis,
    placeholder: false,
  };
}

export type ScoreLinha = {
  /** melhor hipótese — pré-selecionada quando nivel ≥ 'provavel' */
  top: DuplaCandidata | null;
  score: number;
  nivel: NivelMatch;
  motivo: string | null;
  evidencias: Evidencia[];
  candidatos: DuplaCandidata[];
  mentorNome: string | null;
  mentoradoNome: string | null;
};

const rotuloDupla = (d: DuplaCandidata) =>
  `${d.mentoradoNome} × ${d.mentorNome}`;

const TRILHA_MAX = (trilha: string) => (trilha === "especialista" ? 5 : 16);

/** Núcleo do match: pontua cada dupla plausível e devolve a melhor com
 *  a trilha de evidência. O par vale pelo elo mais fraco (min dos dois
 *  lados); contexto (data oficial, nº, encontro existente, dupla única,
 *  lote) soma ±19 — corrobora, nunca lava um lado fraco pra auto. */
export function scoreLinha(
  mentorTxt: string,
  mentoradoTxt: string,
  numero: number | null,
  dataIso: string | null,
  universo: UniversoReg,
  ctx?: { claimed?: Map<string, number>; hoje?: string }
): ScoreLinha {
  const apelidosPool = new Map<string, Set<string>>();
  for (const p of [...universo.mentores, ...universo.mentorados]) {
    apelidosPool.set(p.id, apelidosDe(p));
  }
  const ladoM = scoreLado(mentorTxt, universo.mentores, apelidosPool, "mentor");
  const ladoD = scoreLado(mentoradoTxt, universo.mentorados, apelidosPool, "mentorado");

  const diffDias = (a: string, b: string) =>
    Math.abs(Date.parse(a) - Date.parse(b)) / 86400000;
  const unicas = (p: PessoaRef | null, campo: "mentor_id" | "mentorado_id") =>
    p ? universo.duplas.filter((x) => x[campo] === p.id) : [];

  type Hip = {
    d: DuplaCandidata;
    sM: number;
    sD: number;
    score: number;
    ev: Evidencia[];
    /** lado ausente resolvido por eliminação — nunca auto */
    especial: "placeholder" | "desconhecido" | null;
  };
  const hips: Hip[] = [];
  for (const d of universo.duplas) {
    const sM = ladoM.porPessoa.get(d.mentor_id) ?? 0;
    const sD = ladoD.porPessoa.get(d.mentorado_id) ?? 0;
    if (sM <= 0 && sD <= 0) continue;
    const ev: Evidencia[] = [];
    let base: number,
      especial: Hip["especial"] = null;
    if (sM > 0 && sD > 0) {
      base = Math.min(sM, sD);
    } else {
      // um lado ausente — a dupla do lado resolvido responde por
      // eliminação; rótulo genérico tem prior, nome desconhecido não.
      // Mas "ausente" é GLOBAL: lado que resolveu outra pessoa real do
      // cadastro não é ausente — essa dupla simplesmente não é do par
      // escrito (cai no semPar lá embaixo, não vira hipótese).
      const ladoAusente = sM > 0 ? ladoD : ladoM;
      if (!ladoAusente.placeholder && ladoAusente.score > 0) continue;
      const outro = Math.max(sM, sD);
      if (ladoAusente.placeholder) {
        base = Math.round(0.55 * outro) + 25;
        especial = "placeholder";
      } else {
        base = Math.round(0.55 * outro) - 10;
        especial = "desconhecido";
      }
    }
    let score = base;
    // data × calendário oficial da dupla (bônus só — atraso não refuta)
    const oficial =
      numero != null && d.cronograma_id
        ? universo.calendario?.get(d.cronograma_id)?.get(numero)
        : undefined;
    if (oficial && dataIso) {
      const dd = diffDias(oficial, dataIso);
      const b = dd <= 4 ? 8 : dd <= 10 ? 5 : dd <= 21 ? 2 : 0;
      if (b) {
        score += b;
        ev.push({
          icone: "calendar",
          texto: `${numero}º oficial era ${ddmm(oficial)} — data informada ${ddmm(dataIso)} (±${Math.round(dd)}d)`,
          peso: b,
          lado: "contexto",
        });
      }
    }
    if (numero != null) {
      const max = d.cronograma_id
        ? (universo.calendario?.get(d.cronograma_id)?.size ?? TRILHA_MAX(d.trilha))
        : TRILHA_MAX(d.trilha);
      if (numero <= max) {
        score += 3;
        ev.push({
          icone: "hash",
          texto: `${numero}º dentro da trilha (máx ${max})`,
          peso: 3,
          lado: "contexto",
        });
      } else {
        score -= 10;
        ev.push({
          icone: "warning",
          texto: `${numero}º excede a trilha (máx ${max})`,
          peso: -10,
          lado: "contexto",
        });
      }
    }
    // lado resolvido com exatamente uma dupla no universo → só pode ser ela
    if (!especial) {
      const uniM = unicas(ladoM.pessoa, "mentor_id");
      const uniD = unicas(ladoD.pessoa, "mentorado_id");
      const quem =
        uniM.length === 1 && uniM[0].id === d.id
          ? ladoM.pessoa
          : uniD.length === 1 && uniD[0].id === d.id
            ? ladoD.pessoa
            : null;
      if (quem) {
        score += 4;
        ev.push({
          icone: "link",
          texto: `única dupla de "${quem.nome}"`,
          peso: 4,
          lado: "par",
        });
      }
    }
    // encontro (dupla, numero) já existente corrobora a hipótese
    const enc =
      numero != null ? universo.encontros?.get(d.id)?.get(numero) : undefined;
    if (enc) {
      const dd = enc.data && dataIso ? diffDias(enc.data.slice(0, 10), dataIso) : 999;
      const b = dd <= 10 ? 4 : 2;
      score += b;
      ev.push({
        icone: "check",
        texto: `encontro ${numero}º já existe pra essa dupla (${enc.status})`,
        peso: b,
        lado: "contexto",
      });
    }
    // penalidades
    if (dataIso && ctx?.hoje && dataIso > ctx.hoje) {
      score -= 8;
      ev.push({
        icone: "warning",
        texto: `data ${ddmm(dataIso)} está no futuro`,
        peso: -8,
        lado: "contexto",
      });
    }
    if (dataIso && d.iniciada_em) {
      const lim = new Date(`${d.iniciada_em.slice(0, 10)}T00:00:00`);
      lim.setDate(lim.getDate() - 7);
      const limIso = `${lim.getFullYear()}-${String(lim.getMonth() + 1).padStart(2, "0")}-${String(lim.getDate()).padStart(2, "0")}`;
      if (dataIso < limIso) {
        score -= 8;
        ev.push({
          icone: "warning",
          texto: `data anterior ao início da dupla (${ddmm(d.iniciada_em.slice(0, 10))})`,
          peso: -8,
          lado: "contexto",
        });
      }
    }
    const claim = numero != null ? ctx?.claimed?.get(`${d.id}|${numero}`) : undefined;
    if (claim != null) {
      score -= 12;
      ev.push({
        icone: "copy",
        texto: `linha ${claim} já aponta essa dupla no ${numero}º encontro`,
        peso: -12,
        lado: "contexto",
      });
    }
    hips.push({
      d,
      sM,
      sD,
      // score interno SEM o cap de exibição — capar aqui saturava duas
      // hipóteses em 100 e fabricava empate onde o contexto diferenciava
      score: Math.max(0, Math.round(score)),
      ev,
      especial,
    });
  }
  hips.sort((a, b) => b.score - a.score);

  // desconto de ambiguidade — empate técnico nunca fecha auto. O gap que
  // decide ambig/forcaManual é o PRÉ-desconto: medir depois transformava
  // 100/100 em 90/100 e a cara-ou-coroa ia pro ar como "confiança 100".
  let ambig = false,
    forcaManual = false;
  const diffTop =
    hips[0] && hips[1] ? hips[0].score - hips[1].score : Infinity;
  if (hips[0] && hips[1] && hips[1].score >= 55 && diffTop <= 15) {
    hips[0].score = Math.max(0, hips[0].score - 10);
    ambig = true;
    hips.sort((a, b) => b.score - a.score);
  }
  if (hips[0] && hips[1] && hips[1].score >= 55 && diffTop <= 8) {
    forcaManual = true;
  }
  const top = hips[0] ?? null;

  // par sem dupla: os dois lados se resolvem mas nenhuma dupla os junta
  const semPar =
    hips.length === 0 &&
    !ladoM.placeholder &&
    !ladoD.placeholder &&
    ladoM.score >= 80 &&
    ladoD.score >= 80;

  let nivel: NivelMatch = "manual";
  if (!semPar && top) {
    if (
      top.score >= 90 &&
      top.sM >= 80 &&
      top.sD >= 80 &&
      !ambig &&
      !forcaManual &&
      !top.especial
    ) {
      nivel = "auto";
    } else if (top.score >= 60 && !forcaManual) {
      nivel = "provavel";
    }
  }

  // candidatos pro Select: hipóteses por score → duplas dos plausíveis
  const vistos = new Set<string>();
  const candidatos: DuplaCandidata[] = [];
  const push = (d: DuplaCandidata, score?: number) => {
    if (vistos.has(d.id)) return;
    vistos.add(d.id);
    candidatos.push(score != null ? { ...d, score } : d);
  };
  for (const h of hips) push(h.d, Math.min(100, h.score));
  for (const p of ladoM.plausiveis)
    universo.duplas.filter((d) => d.mentor_id === p.id).forEach((d) => push(d));
  for (const p of ladoD.plausiveis)
    universo.duplas.filter((d) => d.mentorado_id === p.id).forEach((d) => push(d));

  const evidencias = [
    ...ladoM.evidencias,
    ...ladoD.evidencias,
    ...(top?.ev ?? []),
    ...(ambig && hips[1]
      ? [
          {
            icone: "minus" as const,
            texto: `outra dupla plausível: ${rotuloDupla(hips[1].d)} (${Math.min(100, hips[1].score)})`,
            peso: -10,
            lado: "par" as const,
          },
        ]
      : []),
    ...(semPar
      ? [
          {
            icone: "warning" as const,
            texto: `"${normTexto(mentorTxt)}" × "${normTexto(mentoradoTxt)}" se resolvem, mas não formam dupla cadastrada`,
            peso: 0,
            lado: "par" as const,
          },
        ]
      : []),
  ];

  const motivos: string[] = [];
  if (semPar) {
    motivos.push("o par se resolve, mas não forma dupla cadastrada — escolha");
  } else {
    for (const [txt, lado, rot] of [
      [mentorTxt, ladoM, "mentor"],
      [mentoradoTxt, ladoD, "mentorado(a)"],
    ] as const) {
      if (lado.placeholder) {
        motivos.push(
          txt.trim()
            ? `${rot} "${normTexto(txt)}" não é nome — rótulo genérico`
            : `${rot} em branco`
        );
      } else if (!lado.placeholder && lado.score === 0) {
        motivos.push(
          lado.plausiveis.length
            ? `${rot} "${normTexto(txt)}" não bate 100% (parecidos: ${lado.plausiveis
                .slice(0, 3)
                .map((p) => p.nome)
                .join(", ")})`
            : `${rot} "${normTexto(txt)}" não encontrado`
        );
      }
    }
    if (forcaManual) motivos.push("duplas plausíveis empatadas — escolha");
    else if (ambig) motivos.push("mais de uma dupla plausível — escolha");
    else if (nivel === "provavel" && !motivos.length) {
      motivos.push(
        `match provável (confiança ${Math.min(100, top!.score)}) — confira a sugestão`
      );
    }
  }

  return {
    top: top?.d ?? null,
    score: top ? Math.min(100, top.score) : 0,
    nivel,
    motivo: motivos.join(" · ") || (nivel === "manual" ? "dupla não identificada — escolha" : null),
    evidencias,
    candidatos,
    mentorNome: ladoM.pessoa && ladoM.score >= 55 ? ladoM.pessoa.nome : null,
    mentoradoNome: ladoD.pessoa && ladoD.score >= 55 ? ladoD.pessoa.nome : null,
  };
}

// ---------- compat: API antiga por cima do scorer ----------

export type MatchDupla = {
  dupla: DuplaCandidata | null;
  candidatos: DuplaCandidata[];
  mentorNome: string | null;
  mentoradoNome: string | null;
  motivo: string | null;
};

/** Compat com a API anterior: só devolve dupla quando o scorer fecha
 *  'auto' sem contexto de encontro/data. O caminho real é scoreLinha. */
export function matchDupla(
  mentorTxt: string,
  mentoradoTxt: string,
  universo: UniversoReg
): MatchDupla {
  const s = scoreLinha(mentorTxt, mentoradoTxt, null, null, universo);
  return {
    dupla: s.nivel === "auto" ? s.top : null,
    candidatos: s.candidatos,
    mentorNome: s.mentorNome,
    mentoradoNome: s.mentoradoNome,
    motivo: s.motivo,
  };
}

/** Lista de nomes parecidos de um lado — forte = nota ≥85 (exato,
 *  subset, token único); fraco = o resto acima de zero. Mantida pra
 *  usos que só querem o universo de nomes, sem o par. */
export function candidatosDeNome(
  valor: string,
  pessoas: PessoaRef[]
): { fortes: PessoaRef[]; fracos: PessoaRef[] } {
  const apelidosPool = new Map<string, Set<string>>();
  for (const p of pessoas) apelidosPool.set(p.id, apelidosDe(p));
  const lado = scoreLado(valor, pessoas, apelidosPool, "mentor");
  const fortes: PessoaRef[] = [];
  const fracos: PessoaRef[] = [];
  for (const p of pessoas) {
    const s = lado.porPessoa.get(p.id) ?? 0;
    if (s >= 85) fortes.push(p);
    else if (s > 0) fracos.push(p);
  }
  return { fortes, fracos };
}

// ---------- linha + universo → LinhaReg final ----------

/** Pipeline completo: normaliza cada linha, pontua o match da dupla e
 *  fixa o status. 'ok' só quando o scorer fecha 'auto' e não há flag de
 *  campo/data; 'revisar' cobre 'provável' (sugestão pré-selecionada) e
 *  'manual' (Select de dupla na UI); 'ignorar' = sem número de encontro. */
export function processaLinhas(
  linhas: LinhaRegCsv[],
  universo: UniversoReg,
  hoje = new Date()
): { linhas: LinhaReg[]; stats: { ok: number; revisar: number; ignorar: number } } {
  const stats = { ok: 0, revisar: 0, ignorar: 0 };
  const hojeIso = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}-${String(hoje.getDate()).padStart(2, "0")}`;
  // (duplaId|numero) → linha que reivindicou primeiro — flaga resposta
  // duplicada dentro do próprio arquivo (upsert sobrescreveria quieto)
  const claimed = new Map<string, number>();
  const out = linhas.map((l) => {
    const r = normalizaLinhaReg(l, hoje);
    const motivos: string[] = [];
    if (r.numero == null) {
      r.status = "ignorar";
      stats.ignorar++;
      return r;
    }
    const m = scoreLinha(r.mentorTxt, r.mentoradoTxt, r.numero, r.dataIso, universo, {
      claimed,
      hoje: hojeIso,
    });
    r.score = m.score;
    r.nivel = m.nivel;
    r.evidencias = m.evidencias;
    r.mentorNome = m.mentorNome;
    r.mentoradoNome = m.mentoradoNome;
    r.candidatos = m.candidatos;
    // a sugestão só pré-seleciona quando não é 'manual' — manual começa
    // com o Select vazio pra escolha ser de fato explícita (empate não
    // tem palpite de cara-cara). O claim também só nasce daí: uma linha
    // não resolvida não pode travar a dupla pras próximas.
    const dupClaim = m.top ? claimed.get(`${m.top.id}|${r.numero}`) : undefined;
    if (m.top && m.nivel !== "manual") {
      r.duplaId = m.top.id;
      r.mentorNome = m.top.mentorNome;
      r.mentoradoNome = m.top.mentoradoNome;
      claimed.set(`${m.top.id}|${r.numero}`, r.n);
    }
    if (m.nivel !== "auto") motivos.push(m.motivo!);
    if (dupClaim != null)
      motivos.push(`linha ${dupClaim} já aponta essa dupla no ${r.numero}º encontro`);
    if (!r.dataIso && r.dataTxt) motivos.push("data ilegível");
    if (!r.dataTxt) motivos.push("sem data do encontro");
    if (r.dataIso && r.dataIso > hojeIso) motivos.push("data no futuro — conferir");
    if (r.diffs.some((d) => d.revisar) && m.top)
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
  const posNumOrNull = (v: unknown) => {
    const n = numOrNull(v);
    return n != null && n > 0 ? n : null;
  };
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
    numero: posNumOrNull(l.numero),
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
    score: numOrNull(l.score),
    nivel:
      l.nivel === "auto" || l.nivel === "provavel" || l.nivel === "manual"
        ? l.nivel
        : null,
    evidencias: Array.isArray(l.evidencias) ? l.evidencias : [],
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
