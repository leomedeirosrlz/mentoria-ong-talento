/** Posicionamento puro da grade visual semanal do especialista (WP4-A):
 *  transforma grade recorrente + exceções datadas + sessões marcadas +
 *  slots livres projetados (RPC `especialista_slots_livres`) em blocos na
 *  semana calendário seg→dom de `hojeIso`, todos clipados no eixo fixo
 *  8h–20h. Sem JSX, sem `Date.now()` — `hojeIso` chega pronto do server e
 *  as conversões de instante usam sempre o fuso do programa (Intl com
 *  timeZone SP, nunca getHours(): a régua não pode depender do fuso da
 *  máquina). O componente só desenha. */
import { toDateStr } from "./ciclo";
import { primeiroNomeDaDupla } from "./agenda-minha";
import type { Dupla, ExcecaoEspecialista, GradeJanela } from "./types";

export const EIXO_INI_MIN = 480; // 8h
export const EIXO_FIM_MIN = 1200; // 20h

export type SessaoEntrada = {
  /** timestamptz ISO do início da sessão. */
  inicioIso: string;
  /** duração em minutos (o domínio usa 60). */
  duracaoMin: number;
  /** rótulo já formatado pelo caller (ex.: "Ana Beatriz · sessão 4 de 5"). */
  rotulo: string;
  trilha: "especialista" | "dpp";
  status: string;
};

export type BlocoPosicionado = { iniMin: number; fimMin: number };
export type BlocoJanela = BlocoPosicionado & {
  tipo: "janela" | "extra";
  rotulo: string;
};
export type BlocoSessao = BlocoPosicionado & {
  tipo: "sessao";
  rotulo: string;
  trilha: "especialista" | "dpp";
  status: string;
};
/** Banda de slots livres contíguos — agregação dos inícios projetados. */
export type FaixaLivre = BlocoPosicionado;

export type DiaGrade = {
  /** "YYYY-MM-DD" do dia da semana (seg→dom). */
  iso: string;
  /** dow do Postgres: 0=domingo … 6=sábado. */
  dow: number;
  ehHoje: boolean;
  /** grade do dow + exceções "extra" da data, clipadas no eixo. */
  janelas: BlocoJanela[];
  /** exceções "bloqueio" da data — posicionadas, não subtraídas (a
   *  projeção de slots já vem líquida; o overlay visual é do componente). */
  bloqueios: BlocoPosicionado[];
  sessoes: BlocoSessao[];
  livres: FaixaLivre[];
};

const fmtHora = new Intl.DateTimeFormat("pt-BR", {
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "America/Sao_Paulo",
});

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/** "HH:mm[:ss]" → minutos desde meia-noite (PostgREST devolve `time` com
 *  segundos; o terceiro pedaço é ignorado — mesmo helper do demo). */
function paraMin(hora: string): number {
  const [h, m] = hora.split(":").map(Number);
  return h * 60 + m;
}

/** Minutos do dia no fuso do programa — mesma técnica do agenda-calendario:
 *  o Intl formata a hora em SP e a régua fala o fuso certo em qualquer
 *  máquina. */
function minutosDoDia(d: Date): number {
  const [h, m] = fmtHora.format(d).split(":").map(Number);
  return h * 60 + m;
}

/** Clipa no eixo 8h–20h; null quando nada sobra dentro (bloco fora do
 *  eixo ou zerado pelo clip). */
function clipEixo(ini: number, fim: number): BlocoPosicionado | null {
  const iniMin = Math.max(ini, EIXO_INI_MIN);
  const fimMin = Math.min(fim, EIXO_FIM_MIN);
  return fimMin > iniMin ? { iniMin, fimMin } : null;
}

/** "14h" / "9h30" — a horaCurta da grade: sem minutos quando redonda. */
function horaCompacta(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${h}h${m ? pad(m) : ""}`;
}

/** O rótulo descreve a extensão pintada — usa os minutos JÁ clipados, pra
 *  uma janela 18h–21h que só aparece até 20h não mentir no texto. */
function rotuloJanela(prefixo: string, pos: BlocoPosicionado): string {
  return `${prefixo} ${horaCompacta(pos.iniMin)}–${horaCompacta(pos.fimMin)}`;
}

function ordemBloco(a: BlocoPosicionado, b: BlocoPosicionado): number {
  return a.iniMin - b.iniMin || a.fimMin - b.fimMin;
}

/** Encontros com instante real viram entrada da grade — o flatten das
 *  duplas do mentor (esp + DPP do híbrido, que ocupa o mesmo calendário
 *  físico e já é descontado da projeção de slots). A whitelist de status
 *  espelha a RPC 0073: cancelado/nao_aconteceu não ocupam agenda. */
export function sessoesDaGrade(duplas: Dupla[]): SessaoEntrada[] {
  const out: SessaoEntrada[] = [];
  for (const d of duplas) {
    const nome = primeiroNomeDaDupla(d) || "Jovem";
    for (const e of d.encontros) {
      const inicio = e.realizado_em ?? e.data_hora;
      if (
        !inicio ||
        (e.status !== "agendado" &&
          e.status !== "remarcado" &&
          e.status !== "realizado")
      )
        continue;
      out.push({
        inicioIso: inicio,
        duracaoMin: e.duracao_min ?? 60,
        rotulo:
          d.trilha === "especialista" ? `${nome} · sessão ${e.numero}` : nome,
        trilha: d.trilha === "especialista" ? "especialista" : "dpp",
        status: e.status,
      });
    }
  }
  return out;
}

export function gradeVisualSemana(opts: {
  /** "YYYY-MM-DD" de hoje — determinístico, vem do server. */
  hojeIso: string;
  grade: GradeJanela[];
  excecoes: ExcecaoEspecialista[];
  sessoes: SessaoEntrada[];
  /** ISO timestamptz dos inícios livres, já projetados pela RPC. */
  slots: string[];
}): DiaGrade[] {
  const { hojeIso, grade, excecoes, sessoes, slots } = opts;

  // os 7 dias seg→dom em espaço de DATA puro (UTC), sem fuso local: o
  // componente é client-side e uma máquina em UTC+10 veria o meio-dia local
  // cair no dia anterior em SP — a semana deslizaria e divergiria do SSR.
  // getUTCDay() já é o dow do Postgres (0=dom).
  const DIA_MS = 86400e3;
  const ancora = Date.parse(`${hojeIso}T12:00:00Z`);
  if (isNaN(ancora)) return [];
  const seg = ancora - ((new Date(ancora).getUTCDay() + 6) % 7) * DIA_MS;
  const dias = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(seg + i * DIA_MS);
    return { iso: d.toISOString().slice(0, 10), dow: d.getUTCDay() };
  });

  const gradePorDow = new Map<number, GradeJanela[]>();
  for (const j of grade) {
    const lista = gradePorDow.get(j.dia_semana) ?? [];
    lista.push(j);
    gradePorDow.set(j.dia_semana, lista);
  }

  const excecoesPorData = new Map<string, ExcecaoEspecialista[]>();
  for (const x of excecoes) {
    const lista = excecoesPorData.get(x.data) ?? [];
    lista.push(x);
    excecoesPorData.set(x.data, lista);
  }

  // sessões e slots agrupam pelo DIA DE SP do instante — um encontro de
  // 22h em SP já virou o dia seguinte em UTC; agrupar pela data do ISO
  // pintaria o bloco na coluna errada
  const sessoesPorDia = new Map<string, BlocoSessao[]>();
  for (const s of sessoes) {
    const t = new Date(s.inicioIso);
    if (isNaN(t.getTime())) continue;
    const ini = minutosDoDia(t);
    const pos = clipEixo(ini, ini + s.duracaoMin);
    if (!pos) continue;
    const lista = sessoesPorDia.get(toDateStr(t)) ?? [];
    lista.push({
      ...pos,
      tipo: "sessao",
      rotulo: s.rotulo,
      trilha: s.trilha,
      status: s.status,
    });
    sessoesPorDia.set(toDateStr(t), lista);
  }

  const iniciosPorDia = new Map<string, number[]>();
  for (const iso of slots) {
    const t = new Date(iso);
    if (isNaN(t.getTime())) continue;
    const dia = toDateStr(t);
    const lista = iniciosPorDia.get(dia) ?? [];
    lista.push(minutosDoDia(t));
    iniciosPorDia.set(dia, lista);
  }

  // inícios a cada 30min de sessões de 60min → bandas contíguas: um início
  // que encosta na faixa corrente a estende por mais 60min
  const livresPorDia = new Map<string, FaixaLivre[]>();
  for (const [dia, inicios] of iniciosPorDia) {
    inicios.sort((a, b) => a - b);
    const faixas: FaixaLivre[] = [];
    for (const ini of inicios) {
      const corrente = faixas[faixas.length - 1];
      if (corrente && ini <= corrente.fimMin) {
        corrente.fimMin = Math.max(corrente.fimMin, ini + 60);
      } else {
        faixas.push({ iniMin: ini, fimMin: ini + 60 });
      }
    }
    livresPorDia.set(
      dia,
      faixas.flatMap((f) => {
        const pos = clipEixo(f.iniMin, f.fimMin);
        return pos ? [pos] : [];
      })
    );
  }

  return dias.map(({ iso, dow }) => {
    const janelas: BlocoJanela[] = [];
    for (const j of gradePorDow.get(dow) ?? []) {
      const pos = clipEixo(paraMin(j.hora_inicio), paraMin(j.hora_fim));
      if (pos) {
        janelas.push({
          ...pos,
          tipo: "janela",
          rotulo: rotuloJanela("Disponível", pos),
        });
      }
    }
    const bloqueios: BlocoPosicionado[] = [];
    for (const x of excecoesPorData.get(iso) ?? []) {
      const pos = clipEixo(paraMin(x.hora_inicio), paraMin(x.hora_fim));
      if (!pos) continue;
      if (x.tipo === "extra") {
        janelas.push({
          ...pos,
          tipo: "extra",
          rotulo: rotuloJanela("Extra", pos),
        });
      } else {
        bloqueios.push(pos);
      }
    }
    janelas.sort(ordemBloco);
    bloqueios.sort(ordemBloco);
    const sessoesDia = (sessoesPorDia.get(iso) ?? []).slice().sort(ordemBloco);
    return {
      iso,
      dow,
      ehHoje: iso === hojeIso,
      janelas,
      bloqueios,
      sessoes: sessoesDia,
      livres: livresPorDia.get(iso) ?? [],
    };
  });
}
