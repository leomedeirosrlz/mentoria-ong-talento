import {
  DIAS_SEMANA,
  JANELA_PERIODO,
  PERIODOS,
  diaSemanaDe,
  diffDias,
  periodosNoDia,
} from "./ciclo";
import type { DiaSemana, Disponibilidade, Periodo } from "./types";

// ---------- motor de sugestões de encontro (REALIZA-480) ----------
// Puro e determinístico: sem Supabase, sem React, sem Date.now() solto —
// `agora` sempre chega por parâmetro. Toda derivação de dia civil e hora
// passa por partesSP (Intl + timeZone fixo) ou pelas âncoras de meio-dia
// do ciclo.ts; nada lê o fuso da máquina.

export type OrigemSugestao =
  | "historico"
  | "disponibilidade"
  | "passo_do_plano"
  | "padrao";

/** O recorte mínimo que o motor lê do encontro — JovemEncontro e os
 *  embeds da ficha já trazem essas colunas, então a linha entra direto.
 *  `realizado_em` prevalece sobre `data_hora`: é quando o encontro de
 *  fato aconteceu, não quando foi marcado. */
export type EncontroHistorico = {
  data_hora: string | null;
  status: string;
  duracao_min?: number | null;
  realizado_em?: string | null;
};

/** O hábito da dupla destilado dos encontros realizados — pesos já
 *  decaídos por recência, prontos pra ranquear dia e hora. */
export type PerfilEncontros = {
  total: number;
  porDia: Record<DiaSemana, number>;
  /** "HH:mm" → peso acumulado, ordenado por peso desc. */
  porHora: { hora: string; peso: number }[];
  duracaoMedianaMin: number | null;
  /** ISO do encontro mais recente considerado. */
  ultimo: string | null;
};

export type SugestaoData = {
  data: string;
  origem: OrigemSugestao;
  peso: number;
};

export type SugestaoHora = {
  hora: string;
  origem: OrigemSugestao;
  peso: number;
  /** true = o slot bate num horário já ocupado do jovem (encontro de
   *  outra dupla/trilha). Marcado, não removido: a 481 mostra o chip
   *  desabilitado com o motivo. */
  conflito?: boolean;
};

// ---------- fuso ----------

const TZ = "America/Sao_Paulo";

const fmtSP = new Intl.DateTimeFormat("en-CA", {
  timeZone: TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

export type PartesSP = {
  /** "YYYY-MM-DD" civil em SP. */
  data: string;
  /** "HH:mm" civil em SP. */
  horaMin: string;
  hora: number;
  diaSemana: DiaSemana;
};

/** As partes civis de um instante no fuso do programa — a única porta de
 *  entrada de `Date` no motor. Sem ela cada chamada corria o risco de ler
 *  getHours()/getDay() no fuso da máquina e deslocar dia e hora. */
export function partesSP(d: Date): PartesSP | null {
  if (!(d instanceof Date) || Number.isNaN(d.getTime())) return null;
  const p = Object.create(null) as Record<string, string>;
  for (const part of fmtSP.formatToParts(d))
    if (part.type !== "literal") p[part.type] = part.value;
  const data = `${p.year}-${p.month}-${p.day}`;
  return {
    data,
    horaMin: `${p.hour}:${p.minute}`,
    hora: Number(p.hour),
    diaSemana: diaSemanaDe(data),
  };
}

// ---------- datas civis (âncora UTC, independente de TZ local) ----------

const DATA_RE = /^\d{4}-\d{2}-\d{2}$/;
const DIA_MS = 86_400_000;

const dataOk = (s: string | null | undefined): s is string =>
  typeof s === "string" && DATA_RE.test(s);

/** Meio-dia UTC: o dia civil nunca muda por fuso, e a diferença entre
 *  datas sai inteira. Mesma régua da paraData do ciclo.ts. */
const msDe = (iso: string): number =>
  new Date(`${iso}T12:00:00Z`).getTime();

function addDias(iso: string, n: number): string {
  return new Date(msDe(iso) + n * DIA_MS).toISOString().slice(0, 10);
}

/** iso − `meses` no calendário, com o dia clampado no fim do mês alvo
 *  (31/10 − 1 mês vira 30/09, não 01/10). */
function subMeses(iso: string, meses: number): string {
  const [a, m, d] = iso.split("-").map(Number);
  const alvo = new Date(Date.UTC(a, m - 1 - meses, 1));
  const fimMes = new Date(
    Date.UTC(alvo.getUTCFullYear(), alvo.getUTCMonth() + 1, 0)
  ).getUTCDate();
  return new Date(
    Date.UTC(
      alvo.getUTCFullYear(),
      alvo.getUTCMonth(),
      Math.min(d, fimMes)
    )
  )
    .toISOString()
    .slice(0, 10);
}

function mediana(nums: number[]): number | null {
  if (!nums.length) return null;
  const s = [...nums].sort((a, b) => a - b);
  const meio = Math.floor(s.length / 2);
  return s.length % 2 ? s[meio] : (s[meio - 1] + s[meio]) / 2;
}

const inteiroPos = (n: number | undefined, padrao: number): number =>
  typeof n === "number" && Number.isFinite(n) && n > 0
    ? Math.floor(n)
    : padrao;

/** Janela só vale com as duas pontas YYYY-MM-DD e início <= fim —
 *  jsonb torto vira "sem janela", nunca exceção. */
function janelaOk(
  j: { inicio: string; fim: string } | null | undefined
): { inicio: string; fim: string } | null {
  if (!j || !dataOk(j.inicio) || !dataOk(j.fim) || j.inicio > j.fim)
    return null;
  return { inicio: j.inicio, fim: j.fim };
}

// ---------- perfil ----------

const JANELA_HISTORICO_MESES = 6;
const RECENCIA_MEIA_VIDA_DIAS = 120;
const PESO_MIN = 0.05;

/** Destila o hábito da dupla: quais dias da semana e horários os
 *  encontros realizados dos últimos 6 meses ocuparam, com peso decaindo
 *  por recência (meia-vida de 120 dias, piso 0.05 — encontro velho ainda
 *  ensina, mas não manda). Cancelado/não aconteceu/futuro não entra:
 *  sugestão honesta aprende com o que aconteceu, não com o que se marcou. */
export function perfilDeEncontros(
  encontros: EncontroHistorico[],
  agora: Date
): PerfilEncontros {
  const porDia = {} as Record<DiaSemana, number>;
  for (const d of DIAS_SEMANA) porDia[d] = 0;
  const perfil: PerfilEncontros = {
    total: 0,
    porDia,
    porHora: [],
    duracaoMedianaMin: null,
    ultimo: null,
  };
  const hoje = partesSP(agora);
  if (!hoje) return perfil;

  const corte = subMeses(hoje.data, JANELA_HISTORICO_MESES);
  const pesoHora = new Map<string, number>();
  const duracoes: number[] = [];
  let ultimoTs = Number.NEGATIVE_INFINITY;

  for (const e of encontros ?? []) {
    if (e?.status !== "realizado") continue;
    const iso = e.realizado_em ?? e.data_hora;
    if (iso == null) continue;
    const inst = new Date(iso);
    if (Number.isNaN(inst.getTime()) || inst > agora) continue;
    const p = partesSP(inst);
    if (!p || p.data < corte) continue;

    const dias = diffDias(hoje.data, p.data);
    const w = Math.max(PESO_MIN, 0.5 ** (dias / RECENCIA_MEIA_VIDA_DIAS));

    perfil.total += 1;
    porDia[p.diaSemana] += w;
    pesoHora.set(p.horaMin, (pesoHora.get(p.horaMin) ?? 0) + w);
    if (
      typeof e.duracao_min === "number" &&
      Number.isFinite(e.duracao_min) &&
      e.duracao_min > 0
    )
      duracoes.push(e.duracao_min);
    const ts = inst.getTime();
    if (ts > ultimoTs) {
      ultimoTs = ts;
      perfil.ultimo = iso;
    }
  }

  perfil.porHora = [...pesoHora.entries()]
    .map(([hora, peso]) => ({ hora, peso }))
    .sort((a, b) => b.peso - a.peso || a.hora.localeCompare(b.hora));
  perfil.duracaoMedianaMin = mediana(duracoes);
  return perfil;
}

// ---------- choque de agenda (ocupados) ----------

const MIN_MS = 60_000;
/** Faixa assumida de um horário ocupado: quem passa a lista (481) manda
 *  só o instante de início; encontro do programa dura ~1h. */
const OCUPADO_DUR_MS = 60 * MIN_MS;
const HORA_MIN_RE = /^\d{2}:\d{2}$/;

type Faixa = { ini: number; fim: number };

/** Instantes válidos de `ocupados` como faixas [ini, ini+60min) em ms.
 *  Entrada torta (null, item não-string, ISO inválido) é descartada — a
 *  sugestão nunca quebra por causa da lista. */
function faixasOcupadas(
  ocupados: readonly string[] | null | undefined
): Faixa[] {
  if (!Array.isArray(ocupados)) return [];
  const out: Faixa[] = [];
  for (const iso of ocupados) {
    if (typeof iso !== "string") continue;
    const ini = new Date(iso).getTime();
    if (!Number.isFinite(ini)) continue;
    out.push({ ini, fim: ini + OCUPADO_DUR_MS });
  }
  return out;
}

/** Instante (ms) do candidato "data HH:mm" no fuso do programa. -03:00
 *  fixo: o Brasil não tem horário de verão desde 2019, então o civil de
 *  America/Sao_Paulo é sempre UTC-3 — a mesma âncora do TZ do motor. */
function instanteCandidato(data: string, hora: string): number {
  if (!dataOk(data) || !HORA_MIN_RE.test(hora)) return Number.NaN;
  return new Date(`${data}T${hora}:00-03:00`).getTime();
}

// ---------- datas ----------

/** Peso do passo combinado do plano: fica acima de qualquer peso de
 *  hábito (normalizado em (0,1]) — um combinado vale mais que padrão. */
const PESO_PASSO = 2;
/** Peso de horário dentro da grade marcada — evidência forte também. */
const PESO_DISP = 1;
/** Teto da varredura quando a janela do plano é longa — 120 dias bastam
 *  pra preencher qualquer limite razoável com gap de até uma semana. */
const HORIZONTE_MAX_DIAS = 120;

/** Espaçamento mínimo (dias) entre duas datas sugeridas — ritmo de N
 *  encontros/semana ⇒ Math.max(2, floor(7/N)). Sem ritmo declarado não
 *  há restrição de espaçamento (retorna 1, só a dedup por data). */
export function gapDiasParaRitmo(ritmo: number | null | undefined): number {
  if (typeof ritmo !== "number" || !Number.isFinite(ritmo) || ritmo <= 0)
    return 1;
  return Math.max(2, Math.floor(7 / ritmo));
}

export type InputSugerirDatas = {
  agora: Date;
  perfil: PerfilEncontros;
  /** Janela do plano "ficar em dia" — restrição dura enquanto abrange
   *  futuro; uma janela já fechada não zera a lista. */
  janela?: { inicio: string; fim: string } | null;
  /** Data combinada num passo do plano (YYYY-MM-DD) — vem primeiro. */
  dataSugerida?: string | null;
  /** Encontros por semana do combinado (1–4). */
  ritmo?: number | null;
  /** Máximo de sugestões (default 5). */
  limite?: number;
  /** Horizonte de varredura em dias (default 21). */
  dias?: number;
  /** Grade combinada — o teste de viabilidade por data só enxerga os
   *  horários que ela deixa passar quando cobre o dia. */
  disponibilidade?: Disponibilidade | null;
  /** Instantes ISO já ocupados do jovem (encontros de outras
   *  duplas/trilhas) — data cujos horários sugeridos estão todos em
   *  choque sai da lista. */
  ocupados?: readonly string[] | null;
  /** Duração do encontro a marcar, em min — entra na régua de choque
   *  (mesma do sugerirHorarios). */
  duracaoMin?: number | null;
};

/** Sugere datas futuras pro próximo encontro. Ordem de preferência:
 *  passo do plano → dias da semana mais frequentes no histórico
 *  (desempate por proximidade, espaçados pelo ritmo) → próximos dias
 *  úteis seg–sáb. A varredura começa amanhã: hoje só serviria com horário
 *  futuro, e o card do plano prefere amanhã em diante. Nunca vazio com
 *  `agora` válido — janela fechada ou horizonte apertado relaxam antes
 *  de devolver nada. */
export function sugerirDatas(input: InputSugerirDatas): SugestaoData[] {
  const limite = inteiroPos(input?.limite, 5);
  const horizonte = inteiroPos(input?.dias, 21);
  const hoje = partesSP(input?.agora);
  if (!hoje || !limite || !horizonte) return [];

  const primeiro = addDias(hoje.data, 1);
  const ultimo = addDias(hoje.data, horizonte);
  const jan = janelaOk(input?.janela);

  // Com ocupados válidos, "data boa" = data com ao menos um horário
  // sugerido livre — filtro de viabilidade, não de preferência: a ordem
  // entre as viáveis não muda. O Set cacheia: a 2ª passada do gap e o
  // fallback sem histórico re-avaliam as mesmas datas.
  const comOcupados = faixasOcupadas(input?.ocupados).length > 0;
  const semHorarioLivre = new Set<string>();
  const viavel = (iso: string): boolean => {
    if (!comOcupados) return true;
    if (semHorarioLivre.has(iso)) return false;
    const livre = sugerirHorarios({
      data: iso,
      perfil: input?.perfil,
      disponibilidade: input?.disponibilidade,
      ocupados: input?.ocupados,
      duracaoMin: input?.duracaoMin,
    }).some((s) => !s.conflito);
    if (!livre) semHorarioLivre.add(iso);
    return livre;
  };

  let ini = primeiro;
  let fim = ultimo;
  if (jan && jan.fim >= primeiro) {
    ini = jan.inicio > primeiro ? jan.inicio : primeiro;
    // janela que só abre depois do horizonte: aponta os primeiros dias
    // dela em vez de sugerir fora do combinado.
    fim = jan.fim < ultimo ? jan.fim : ultimo;
    if (fim < ini) {
      ini = jan.inicio;
      fim = jan.fim;
    }
    const teto = addDias(ini, HORIZONTE_MAX_DIAS);
    if (fim > teto) fim = teto;
  }

  const out: SugestaoData[] = [];
  const usadas = new Set<string>();

  if (
    dataOk(input?.dataSugerida) &&
    input.dataSugerida >= hoje.data &&
    (!jan ||
      (input.dataSugerida >= jan.inicio && input.dataSugerida <= jan.fim)) &&
    // data do guia sem horário livre não se força — a 481 decide o "sem
    // horário livre" quando toda a lista vier em choque
    viavel(input.dataSugerida)
  ) {
    out.push({
      data: input.dataSugerida,
      origem: "passo_do_plano",
      peso: PESO_PASSO,
    });
    usadas.add(input.dataSugerida);
  }

  const candidatas: string[] = [];
  for (let d = ini; d <= fim; d = addDias(d, 1)) candidatas.push(d);

  if ((input?.perfil?.total ?? 0) > 0) {
    const pesoDia = input.perfil.porDia;
    const maxW = Math.max(...DIAS_SEMANA.map((d) => pesoDia[d] ?? 0), 0);
    const pesoDe = (iso: string) => pesoDia[diaSemanaDe(iso)] ?? 0;
    const ranked = candidatas
      .filter((d) => !usadas.has(d))
      .sort((a, b) => pesoDe(b) - pesoDe(a) || a.localeCompare(b));
    const gap = gapDiasParaRitmo(input?.ritmo);
    const espacada = (d: string) =>
      out.every((s) => Math.abs(diffDias(s.data, d)) >= gap);
    const empurra = (d: string) => {
      if (!viavel(d)) return;
      out.push({
        data: d,
        origem: "historico",
        peso: maxW > 0 ? pesoDe(d) / maxW : 0,
      });
      usadas.add(d);
    };
    for (const d of ranked) {
      if (out.length >= limite) break;
      if (espacada(d)) empurra(d);
    }
    // gap estrito pode não encher a janela — a segunda passada completa
    // o limite mantendo a mesma ordem de preferência.
    for (const d of ranked) {
      if (out.length >= limite) break;
      if (!usadas.has(d)) empurra(d);
    }
  } else {
    // sem histórico: dias úteis (seg–sáb) cronológicos; domingo só entra
    // se a janela não tiver útil bastante.
    const uteis = candidatas.filter((d) => diaSemanaDe(d) !== "dom");
    for (const d of [...uteis, ...candidatas]) {
      if (out.length >= limite) break;
      if (usadas.has(d) || !viavel(d)) continue;
      out.push({ data: d, origem: "padrao", peso: 0 });
      usadas.add(d);
    }
  }
  return out;
}

// ---------- horários ----------

/** Hora-âncora de cada período da grade — o representante civil de
 *  "manhã/tarde/noite" quando o histórico não tem horário que caia na
 *  célula marcada. */
const HORA_ANCORAGEM_PERIODO: Record<Periodo, string> = {
  manha: "09:00",
  tarde: "14:00",
  noite: "19:00",
};

const HORAS_PADRAO_SEMANA = ["19:00", "19:30", "20:00"];
const HORAS_PADRAO_FDS = ["09:00", "10:00", "11:00"];

/** O período da grade que cobre "HH:mm" — fora das três faixas
 *  (madrugada, por exemplo) nenhuma célula cobre, volta null. */
function periodoDaHora(horaMin: string): Periodo | null {
  const h = Number(horaMin.slice(0, 2));
  if (!Number.isFinite(h)) return null;
  for (const p of PERIODOS) {
    const [ini, fim] = JANELA_PERIODO[p];
    if (h >= ini && h < fim) return p;
  }
  return null;
}

export type InputSugerirHorarios = {
  /** "YYYY-MM-DD" — o dia civil escolhido (em SP). */
  data: string;
  perfil: PerfilEncontros;
  /** Grade já combinada dos dois lados (interseção quando ambos
   *  marcaram). null/sem célula no dia = sem restrição por grade. */
  disponibilidade?: Disponibilidade | null;
  /** Máximo de sugestões (default 3). */
  limite?: number;
  /** Instantes ISO já ocupados do jovem (encontros de outras
   *  duplas/trilhas) — o slot que chocar volta com `conflito: true`,
   *  depois dos livres, em vez de sumir. */
  ocupados?: readonly string[] | null;
  /** Duração do encontro a marcar, em min — a janela do candidato no
   *  choque é [início, início+duracaoMin). Default: mediana do perfil,
   *  depois 60. */
  duracaoMin?: number | null;
};

/** Marca `conflito` nos candidatos que sobrepõem [ocupado, ocupado+60min)
 *  — o teste é de intervalo semiaberto, então encontro encostado (fim ==
 *  início do outro) não conta choque. Livres voltam primeiro, com a
 *  ordem interna preservada; sem ocupado válido a lista sai intacta. */
function aplicarOcupados(
  out: SugestaoHora[],
  input: InputSugerirHorarios
): SugestaoHora[] {
  const faixas = faixasOcupadas(input?.ocupados);
  if (!faixas.length) return out;
  const durMs =
    inteiroPos(
      input?.duracaoMin ?? undefined,
      inteiroPos(input?.perfil?.duracaoMedianaMin ?? undefined, 60)
    ) * MIN_MS;
  for (const s of out) {
    const ini = instanteCandidato(input?.data, s.hora);
    if (!Number.isFinite(ini)) continue;
    if (faixas.some((f) => ini < f.fim && f.ini < ini + durMs))
      s.conflito = true;
  }
  const livres = out.filter((s) => !s.conflito);
  return [...livres, ...out.filter((s) => s.conflito)];
}

/** Sugere horários pro dia escolhido. Grade marcada cobrindo o dia ⇒ só
 *  horários dentro das células (hábito que caia na célula primeiro, a
 *  hora-âncora do período depois) — tudo com origem "disponibilidade";
 *  a queda pro histórico/"padrao" quando a grade não cobre o dia já se
 *  sinaliza pela própria origem. Nunca vazio. */
export function sugerirHorarios(input: InputSugerirHorarios): SugestaoHora[] {
  const limite = inteiroPos(input?.limite, 3);
  const dow = dataOk(input?.data) ? diaSemanaDe(input.data) : null;
  const padraoDow =
    dow === "sab" || dow === "dom" ? HORAS_PADRAO_FDS : HORAS_PADRAO_SEMANA;
  const padraoOut = (): SugestaoHora[] =>
    padraoDow.slice(0, limite).map((hora) => ({
      hora,
      origem: "padrao" as const,
      peso: 0,
    }));
  // data ilegível — único caso sem resposta do dia; cai no padrão de
  // semana, estatisticamente mais provável que o de fim de semana.
  if (!dow || !limite) return aplicarOcupados(padraoOut(), input);

  const perfil = input?.perfil;
  const maxHora = Math.max(
    ...(perfil?.porHora ?? []).map((h) => h.peso),
    0
  );
  const pesoHistorico = (peso: number) => (maxHora > 0 ? peso / maxHora : 0);

  const marcados = periodosNoDia(input?.disponibilidade, dow);
  if (marcados.length) {
    const out: SugestaoHora[] = [];
    const usadas = new Set<string>();
    for (const { hora, peso } of perfil?.porHora ?? []) {
      if (out.length >= limite) break;
      const p = periodoDaHora(hora);
      if (!p || !marcados.includes(p) || usadas.has(hora)) continue;
      out.push({
        hora,
        origem: "disponibilidade",
        peso: PESO_DISP + pesoHistorico(peso),
      });
      usadas.add(hora);
    }
    for (const p of marcados) {
      if (out.length >= limite) break;
      const hora = HORA_ANCORAGEM_PERIODO[p];
      if (usadas.has(hora)) continue;
      out.push({ hora, origem: "disponibilidade", peso: PESO_DISP });
      usadas.add(hora);
    }
    // ≥1 garantido: período marcado sempre tem hora-âncora.
    return aplicarOcupados(out, input);
  }

  if (perfil?.porHora?.length) {
    const out: SugestaoHora[] = perfil.porHora
      .slice(0, limite)
      .map(({ hora, peso }) => ({
        hora,
        origem: "historico" as const,
        peso: pesoHistorico(peso),
      }));
    // perfil raso (menos horas que o limite) completa com o padrão do dia.
    const usadas = new Set(out.map((s) => s.hora));
    for (const hora of padraoDow) {
      if (out.length >= limite) break;
      if (usadas.has(hora)) continue;
      out.push({ hora, origem: "padrao", peso: 0 });
    }
    return aplicarOcupados(out, input);
  }

  return aplicarOcupados(padraoOut(), input);
}

// ---------- rótulos ----------

const ROTULO_ORIGEM: Record<OrigemSugestao, string> = {
  historico: "Baseado nos encontros de vocês",
  disponibilidade: "Baseado na disponibilidade",
  passo_do_plano: "Data do guia",
  padrao: "Sugestão do programa",
};

/** A frase de proveniência que o card mostra sob a sugestão — pt-BR do
 *  produto, sem expor mecânica (nunca "algoritmo" ou "score"). */
export function rotuloOrigem(o: OrigemSugestao): string {
  return ROTULO_ORIGEM[o] ?? o;
}

// ---------- sugestão principal e choque rotulado (481) ----------

/** Um instante ocupado com o rótulo que o chip/mensagem mostra — a camada
 *  server monta a partir dos encontros de origem ("6º encontro com
 *  Ricardo", "sessão com Helena"). `rotulo` é a forma curta pra chip;
 *  `rotuloArtigo` cabe numa frase ("o 6º encontro…", "uma sessão…").
 *  O contrato 480b (`ocupados: string[]`) segue aceito — string vira
 *  entrada com rótulos vazios. */
export type OcupadoRotulado = {
  inicio: string;
  rotulo: string;
  rotuloArtigo: string;
};

const inicioDo = (o: string | OcupadoRotulado): string =>
  typeof o === "string" ? o : o.inicio;

/** Ocupado que bate com o candidato `[instante, instante+durMin)` — a janela
 *  do ocupado é `durOcupadoMin` (60 min, mesma régua do motor e da RPC
 *  conflito_encontro). Devolve o ocupado rotulado pra mensagem/chip;
 *  null = livre. */
export function ocupadoEmChoque(
  instante: number | Date,
  ocupados: readonly (string | OcupadoRotulado)[] | null | undefined,
  durMin = OCUPADO_DUR_MS / MIN_MS,
  durOcupadoMin = OCUPADO_DUR_MS / MIN_MS
): OcupadoRotulado | null {
  const ms = typeof instante === "number" ? instante : instante.getTime();
  if (!Number.isFinite(ms)) return null;
  const fim = ms + durMin * MIN_MS;
  for (const o of ocupados ?? []) {
    const inicio = inicioDo(o);
    const ini = new Date(inicio).getTime();
    if (!Number.isFinite(ini)) continue;
    if (ms < ini + durOcupadoMin * MIN_MS && ini < fim) {
      return typeof o === "string"
        ? { inicio: o, rotulo: "", rotuloArtigo: "" }
        : o;
    }
  }
  return null;
}

/** Sugestão principal = primeira data viável + primeiro horário livre dela
 *  (o que o cartão propõe e o seletor pré-seleciona). A origem do par pro
 *  rótulo "Baseado em…": a data do guia fala mais alto; depois a evidência
 *  do horário (hábito/grade), senão a da data. */
export function principalDe({
  datas,
  perfil,
  disponibilidade,
  ocupados,
  duracaoMin,
}: {
  datas: SugestaoData[];
  perfil: PerfilEncontros;
  disponibilidade?: Disponibilidade | null;
  ocupados?: readonly string[] | null;
  duracaoMin?: number;
}): { data: string; hora: string; origem: OrigemSugestao } | null {
  const dia = datas[0];
  if (!dia) return null;
  const horas = sugerirHorarios({
    data: dia.data,
    perfil,
    disponibilidade,
    ocupados,
    duracaoMin,
  });
  const livre = horas.find((h) => !h.conflito) ?? horas[0];
  if (!livre) return null;
  const origem =
    dia.origem === "passo_do_plano"
      ? "passo_do_plano"
      : livre.origem !== "padrao"
        ? livre.origem
        : dia.origem;
  return { data: dia.data, hora: livre.hora, origem };
}
