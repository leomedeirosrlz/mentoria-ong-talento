// REALIZA-34 — camada 2: normalização determinística do conteúdo extraído
// pro schema canônico (EventoRascunho). Puro, sem Next/Supabase — testável
// com fixtures. Nunca inventa data: o que não tem data vai com data=null e
// aviso pra revisão humana decidir (nunca grava).
import type { EventoRascunho } from "@/lib/gerador-cronograma";
import { ENCONTROS_DPP_OFICIAL } from "@/lib/gerador-cronograma";
import type { Extraido } from "./extrair";

export type RascunhoImportacao = {
  turma: string | null;
  nome: string | null;
  eventos: EventoRascunho[];
  avisos: string[];
  /** 0..1 — < 0.6 sugere o fallback de IA na UI. */
  confianca: number;
  viaIa: boolean;
};

const MESES: Record<string, number> = {
  janeiro: 0, fevereiro: 1, "março": 2, marco: 2, abril: 3, maio: 4,
  junho: 5, julho: 6, agosto: 7, setembro: 8, outubro: 9, novembro: 10,
  dezembro: 11,
};

const iso = (d: number, m: number, a: number) =>
  `${a}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

const ajustaAno = (d: number, m: number, a: number) =>
  a < 100 ? (a >= 70 ? 1900 + a : 2000 + a) : a;

/** Todas as datas da linha como {iso, temAno}: dd/mm(/aa|aaaa),
 *  "dd de mês de aaaa" e ISO aaaa-mm-dd. Datas sem ano vêm como
 *  "0000-mm-dd" e são completadas por infereAnos. */
export function datasDaLinha(linha: string): { data: string; temAno: boolean }[] {
  const achadas: { data: string; temAno: boolean }[] = [];
  let m: RegExpExecArray | null;
  const semAno = (d: number, mo: number) =>
    `0000-${String(mo + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

  const reIso = /(\d{4})-(\d{2})-(\d{2})/g;
  // mascara ISO antes do numérico — senão "2026-06-24" vira "26-06-24"
  const mascarada = linha.replace(reIso, (s) => " ".repeat(s.length));
  while ((m = reIso.exec(linha)))
    achadas.push({ data: `${m[1]}-${m[2]}-${m[3]}`, temAno: true });

  const reExtenso =
    /(\d{1,2})[º°]?\s+de\s+([a-záàâãéêíóôõúç]+)(?:\s+de\s+(\d{2,4}))?/giu;
  while ((m = reExtenso.exec(mascarada))) {
    const mes =
      MESES[m[2].toLowerCase()] ??
      MESES[m[2].toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")];
    if (mes === undefined) continue;
    achadas.push({
      data: m[3]
        ? iso(+m[1], mes, ajustaAno(+m[1], mes, +m[3]))
        : semAno(+m[1], mes),
      temAno: !!m[3],
    });
  }

  const reNum = /(?<!\d)(\d{1,2})[/\-.](\d{1,2})(?:[/\-.](\d{2,4}))?(?![\d/\-.])/g;
  while ((m = reNum.exec(mascarada))) {
    const d = +m[1], mo = +m[2] - 1;
    if (d < 1 || d > 31 || mo < 0 || mo > 11) continue;
    achadas.push({
      data: m[3] ? iso(d, mo, ajustaAno(d, mo, +m[3])) : semAno(d, mo),
      temAno: !!m[3],
    });
  }

  // dedup por data, preservando ordem
  const vistos = new Set<string>();
  return achadas.filter((a) => !vistos.has(a.data) && (vistos.add(a.data), true));
}

/** Completa datas sem ano ("0000-mm-dd") com a âncora do documento; se o
 *  resultado ficar antes do evento anterior da sequência, vira ano+1 —
 *  um cronograma é uma sequência contígua. */
function infereAnos(
  itens: { data: string; temAno: boolean }[],
  anoBase: number,
  ultimaData: string
): string[] {
  return itens.map((i) => {
    if (i.temAno) return i.data;
    let data = `${anoBase}${i.data.slice(4)}`;
    if (ultimaData && data < ultimaData)
      data = `${+data.slice(0, 4) + 1}${data.slice(4)}`;
    return data;
  });
}

const RE_ENCONTRO = /encontro\s*(?:n[ºo°]?\.?\s*)?(\d{1,2})/i;
const RE_TIPO = {
  recesso: /recesso|férias|ferias|recesso\s+de/i,
  formacao: /formação|formacao|capacitação|capacitacao|treinamento/i,
  encerramento: /encerramento|formatura|celebração|celebracao|festa\s+de\s+encerramento/i,
};

function classifica(linha: string, numero: number | null): EventoRascunho["tipo"] {
  if (numero !== null || /^encontro\b/i.test(linha.trim())) return "encontro";
  if (RE_TIPO.recesso.test(linha)) return "recesso";
  if (RE_TIPO.encerramento.test(linha)) return "evento_encerramento";
  if (RE_TIPO.formacao.test(linha)) return "formacao";
  return "etapa_preparacao";
}

/** Título sem o prefixo "Encontro N", data e pontuação solta. A ISO sai
 *  ANTES do padrão numérico — senão "2026-06-24" perde só "26-06-24". */
function limpaTitulo(linha: string): string {
  return linha
    .replace(/\d{4}-\d{2}-\d{2}/g, " ")
    .replace(/\d{1,2}[º°]?\s+de\s+[a-záàâãéêíóôõúç]+(\s+de\s+\d{2,4})?/giu, " ")
    .replace(/\d{1,2}[/\-.]\d{1,2}([/\-.]\d{2,4})?/g, " ")
    .replace(/^encontro\s*(?:n[ºo°]?\.?\s*)?\d{1,2}\s*[-–—:.)]?\s*/i, "")
    .replace(/\s{2,}/g, " ")
    .replace(/^[-–—:.;,\s]+|[-–—:.;,\s]+$/g, "")
    .replace(/\s+(e|de|a)\s*$/i, "")
    .trim();
}

function rascunho(
  linha: string,
  datas: string[],
  avisos: string[]
): EventoRascunho | null {
  if (!linha.trim()) return null;
  const mEnc = linha.match(RE_ENCONTRO);
  const numero = mEnc ? +mEnc[1] : null;
  const tipo = classifica(linha, numero);
  const titulo = limpaTitulo(linha) || linha.trim().slice(0, 60);
  const data = datas[0] ?? null;
  const dataFim = tipo === "recesso" || tipo === "etapa_preparacao"
    ? datas[1] ?? null
    : null;
  if (!data)
    avisos.push(`"${titulo.slice(0, 50)}" ficou sem data — preencha na revisão.`);

  return {
    tipo,
    numero: tipo === "encontro" ? numero : null,
    data,
    data_fim: dataFim,
    titulo,
    fase: null,
    instrumentos: [],
    status: "pendente",
    observacao: null,
  };
}

/** Encontro com nº 1..16 herda fase/instrumentos/obs do guia DPP oficial —
 *  o currículo é do encontro, não do título que veio no arquivo. */
function enriqueceDpp(ev: EventoRascunho) {
  if (ev.tipo !== "encontro" || !ev.numero) return;
  const oficial = ENCONTROS_DPP_OFICIAL[ev.numero - 1];
  if (!oficial) return;
  ev.fase = oficial.fase;
  ev.instrumentos = [...oficial.instrumentos];
  ev.observacao = oficial.observacao;
}

function detectaTurma(texto: string): string | null {
  const m = texto.match(/turma\s*(\d{1,2})/i);
  if (m) return `Turma ${+m[1]}`;
  const c = texto.match(/\b(20\d\d)\s*[/\-.]\s*(20\d\d)\b/);
  if (c) return `${c[1]}/${c[2]}`;
  return null;
}

/** Converte linhas brutas (texto ou grade) na sequência canônica. */
function parseLinhas(linhas: string[], avisos: string[]): EventoRascunho[] {
  // primeira passada: quais linhas viram evento e quais datas trazem
  const candidatos = linhas
    .map((linha) => {
      const s = linha.trim();
      if (s.length < 3) return null;
      const datasBrutas = datasDaLinha(s);
      const pareceEvento =
        datasBrutas.length > 0 ||
        RE_ENCONTRO.test(s) ||
        Object.values(RE_TIPO).some((r) => r.test(s)) ||
        /inscriç|triagem|onboarding|kick[- ]?off|início do ciclo|inicio do ciclo|pareamento|matching/i.test(s);
      return pareceEvento ? { s, datasBrutas } : null;
    })
    .filter((c): c is { s: string; datasBrutas: { data: string; temAno: boolean }[] } => c !== null);

  // âncora global de ano: o ano mais citado com ano no documento (senão
  // o corrente) — "Encontro 5 — 28/07" herda o ano da série, não o de hoje
  const contagemAnos = new Map<number, number>();
  for (const c of candidatos)
    for (const d of c.datasBrutas)
      if (d.temAno)
        contagemAnos.set(+d.data.slice(0, 4), (contagemAnos.get(+d.data.slice(0, 4)) ?? 0) + 1);
  const anoBase =
    [...contagemAnos.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ??
    new Date().getFullYear();

  const eventos: EventoRascunho[] = [];
  let ultimaData = "";
  for (const { s, datasBrutas } of candidatos) {
    const datas = infereAnos(datasBrutas, anoBase, ultimaData);
    const ev = rascunho(s, datas, avisos);
    if (ev) {
      eventos.push(ev);
      if (ev.data && ev.data > ultimaData) ultimaData = ev.data;
    }
  }
  // pós-passo: renumera encontros sem nº explícito e anexa conteúdo DPP
  let n = 0;
  for (const ev of eventos) {
    if (ev.tipo !== "encontro") continue;
    if (!ev.numero) ev.numero = ++n;
    else n = ev.numero;
    enriqueceDpp(ev);
  }
  return eventos;
}

/** Normaliza o conteúdo extraído pro rascunho canônico + diagnóstico. */
export function normalizarCronograma(extraido: Extraido): RascunhoImportacao {
  const avisos: string[] = [];
  let turma: string | null = null;
  let nome: string | null = null;
  let eventos: EventoRascunho[] = [];

  if (extraido.formato === "tabela") {
    // cada linha vira um candidato a evento, células unidas por " — "
    const linhas = extraido.linhas
      .map((r) => r.filter(Boolean).join(" — "))
      .filter((l) => l.trim().length > 0);
    turma = detectaTurma(linhas.slice(0, 5).join(" "));
    eventos = parseLinhas(linhas, avisos);
  } else {
    const linhas = extraido.texto.split(/\r?\n/);
    turma = detectaTurma(extraido.texto.slice(0, 2000));
    const mNome = extraido.texto.match(/cronograma\s+([^\n.]{3,60})/i);
    nome = mNome ? `Calendário ${mNome[1].trim()}` : null;
    // PDF devolve uma linha por página — re-segmenta por data/encontro
    const texto = linhas.join("\n");
    const segmentos = texto
      .split(/(?=\bencontro\s*(?:n[ºo°]?\.?\s*)?\d|(?<=[.;:])\s+(?=\d{1,2}[/\-.]\d{1,2}))/i)
      .flatMap((s) => s.split("\n"));
    eventos = parseLinhas(segmentos, avisos);
  }

  const encontros = eventos.filter((e) => e.tipo === "encontro");
  const semData = eventos.filter((e) => !e.data).length;
  if (eventos.length === 0)
    avisos.push("Nenhum evento reconhecido. Revise o texto extraído ou tente com a IA.");
  if (encontros.length > 0 && encontros.length !== 16)
    avisos.push(
      `Foram reconhecidos ${encontros.length} encontros (o guia DPP prevê 16). Confira a numeração na prévia.`
    );
  if (semData > 0)
    avisos.push(`${semData} evento(s) sem data. Complete antes de gravar.`);
  if (!turma)
    avisos.push("A turma não foi identificada no arquivo. Informe o nome antes de gravar.");

  const confianca = Math.max(
    0,
    Math.min(
      1,
      (encontros.length ? 0.3 : 0) +
        (encontros.length >= 10 ? 0.4 : encontros.length * 0.04) +
        (encontros.length && encontros.every((e) => e.data) ? 0.2 : 0) +
        (turma ? 0.1 : 0)
    )
  );

  return { turma, nome, eventos, avisos, confianca, viaIa: false };
}
