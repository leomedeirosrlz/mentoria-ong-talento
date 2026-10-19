// ---------- agenda do especialista — projeção demo da RPC 0073 ----------
// Espelho fiel de `especialista_slots_livres`: sessões de 1h com inícios a
// cada 30min dentro da grade semanal + exceções `extra`, menos bloqueios
// datados e encontros agendado/remarcado do especialista (qualquer trilha —
// a agenda física dele é uma só; a disponibilidade do JOVEM só entra na
// proposta da 112). Manter alinhada ao SQL se a RPC mudar.

import { toDateStr } from "../ciclo";

/** "HH:mm[:ss]" → minutos desde meia-noite (PostgREST devolve time com
 *  segundos; o terceiro pedaço é ignorado). */
const paraMin = (hora: string): number => {
  const [h, m] = hora.split(":").map(Number);
  return h * 60 + m;
};

const paraHora = (min: number): string =>
  `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;

// `desde`/`ate` chegam como instantes (`new Date()` no caller) — `toDateStr`
// lê a data de calendário SP, a mesma régua da grade e das exceções. UTC e
// máquina local são arbitrários; ancorar neles desloca "hoje" perto da
// meia-noite BRT (ou o dia inteiro em fusos extremos).
const DIA_MS = 24 * 3600 * 1000;
const addDias = (d: Date, n: number): Date => new Date(d.getTime() + n * DIA_MS);
const ymd = (d: Date): string => toDateStr(d);
/** dow Postgres (0=dom) do dia de calendário "YYYY-MM-DD" — sem fuso. */
const dowDaData = (dataStr: string): number =>
  new Date(`${dataStr}T12:00:00Z`).getUTCDay();
/** Dia + "HH:mm" no fuso do programa — o `at time zone 'America/Sao_Paulo'`
 *  do SQL (SP não tem DST desde 2019, -03:00 fixo). */
const instanteSP = (d: Date, hora: string): Date =>
  new Date(`${ymd(d)}T${hora}:00-03:00`);

export type JanelaSemanal = {
  dia_semana: number;
  hora_inicio: string;
  hora_fim: string;
};

export type ExcecaoAgenda = {
  data: string;
  hora_inicio: string;
  hora_fim: string;
  tipo: "bloqueio" | "extra";
};

/** Slots de início livres entre `desde` e `ate` (dias inclusivos, como os
 *  params date da RPC). `ocupados` = encontros agendado/remarcado do
 *  especialista já convertidos pra epoch ms (início e fim com duração).
 *  Retorna instantes ISO asc, como o PostgREST serializa timestamptz. */
export function slotsLivresEspecialista(o: {
  grade: JanelaSemanal[];
  excecoes: ExcecaoAgenda[];
  ocupados: { inicio: number; fim: number }[];
  desde: Date;
  ate: Date;
  agora?: number;
}): string[] {
  const agora = o.agora ?? Date.now();
  const bloqueios = new Map<string, { ini: number; fim: number }[]>();
  const extras = new Map<string, { ini: number; fim: number }[]>();
  for (const x of o.excecoes) {
    const mapa = x.tipo === "bloqueio" ? bloqueios : extras;
    const lista = mapa.get(x.data) ?? [];
    lista.push({ ini: paraMin(x.hora_inicio), fim: paraMin(x.hora_fim) });
    mapa.set(x.data, lista);
  }
  const slots: string[] = [];
  for (
    let dia = new Date(o.desde);
    ymd(dia) <= ymd(o.ate);
    dia = addDias(dia, 1)
  ) {
    const dataStr = ymd(dia);
    const minutos = new Set<number>(); // distinct, como o SQL
    for (const j of o.grade) {
      if (j.dia_semana !== dowDaData(dataStr)) continue;
      for (
        let m = paraMin(j.hora_inicio);
        m + 60 <= paraMin(j.hora_fim);
        m += 30
      )
        minutos.add(m);
    }
    for (const x of extras.get(dataStr) ?? []) {
      for (let m = x.ini; m + 60 <= x.fim; m += 30) minutos.add(m);
    }
    for (const m of [...minutos].sort((a, b) => a - b)) {
      const inicio = instanteSP(dia, paraHora(m)).getTime();
      const fim = inicio + 60 * 60 * 1000;
      if (inicio <= agora) continue;
      // bloqueio: [inicio, +60) toca [b.ini, b.fim) no mesmo dia-local
      if (
        (bloqueios.get(dataStr) ?? []).some((b) => m < b.fim && m + 60 > b.ini)
      )
        continue;
      // encontro marcado: [inicio, +60) toca [e.inicio, e.fim)
      if (o.ocupados.some((e) => e.inicio < fim && e.fim > inicio)) continue;
      slots.push(new Date(inicio).toISOString());
    }
  }
  return slots;
}
