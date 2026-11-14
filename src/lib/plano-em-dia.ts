/** "Para ficar em dia" — pure deterministic catch-up planner for DPP pairs
 *  (REALIZA-397). Consumes the SAME derivations the semáforo and the
 *  journey track already use (`jornadaDaDupla` over `passosDaTrilha`), so
 *  the ficha card and the Liza tool can never disagree with the agenda.
 *
 *  Domain rules encoded here (all reviewed against the official guides):
 *  - the pair schedules its own encounters; the plan only proposes dates
 *  - a scheduled future row is locked: never rescheduled, occupies its
 *    date and counts toward the weekly pace
 *  - `nao_aconteceu` is never skipped: the same row is rescheduled
 *  - a past scheduled row without a registro is a limbo — a step-0
 *    pendência (registrar ou marcar "não aconteceu"), not a date slot
 *  - double weeks ("semana dupla") are the primary compression: ≥2 days
 *    between the pair's encounters, pace bounded by `ritmo`/week
 *  - exige_pratica/exige_tarefa add the guide's spacing between contents;
 *    recesses and the closure event are hard calendar constraints */

import {
  eventosDoCronograma,
  jornadaDaDupla,
  passosDaTrilha,
  toDateStr,
} from "./ciclo";
import type { CicloEvento, Dupla } from "./types";
import {
  GAP_DIAS_EXIGE,
  GAP_MINIMO_DIAS,
  META_PASSOS_PLANO,
} from "./plano-em-dia.data";

export type PendenciaRegistro = {
  numero: number;
  encontroId: string;
  /** limbo = agendado venceu sem registro; pendente = realizado sem registro */
  estado: "limbo" | "pendente_registro";
  dataHora: string | null;
};

export type PassoPlano = {
  numero: number;
  /** agendar = new row · remarcar = same nao_aconteceu row moves ·
   *  travado = future scheduled row the plan keeps untouched */
  acao: "agendar" | "remarcar" | "travado";
  /** Row to edit on remarcar/travado — null when a new row is created. */
  encontroId: string | null;
  /** Suggested/locked date (YYYY-MM-DD). */
  data: string;
  /** Official calendar date of the step. */
  dataOficial: string;
  titulo: string;
  fase: string | null;
  marco: boolean;
  /** External prerequisite surfaced on the step (Roda da Vida, 360º…). */
  precondicao?: string;
  /** Why this date isn't sooner — practice gap, recess, weekly pace… */
  aviso?: string;
};

export type PlanoEmDia =
  | { aplicavel: false; motivo: string }
  | {
      aplicavel: true;
      /** Nothing owed: every due step is done or already scheduled —
       *  the card hides, the tool still explains. */
      emDia: boolean;
      /** Limbo/pending-registro steps — resolve before planning ahead. */
      pendenciasRegistro: PendenciaRegistro[];
      /** Owed + locked steps in encounter order, each with its date. */
      passos: PassoPlano[];
      /** Date the compressed sequence is back on the official calendar —
       *  the day the last currently-owed step is scheduled. Null when the
       *  plan cannot finish before the closure event. */
      dataRecuperacao: string | null;
      /** Closure-event date the plan was checked against, if the calendar
       *  has one. */
      encerramento: string | null;
      avisos: string[];
    };

const DIA_MS = 86_400_000;

const addDias = (iso: string, n: number) =>
  toDateStr(new Date(new Date(`${iso}T12:00:00`).getTime() + n * DIA_MS));

/** ISO week key (the Monday the date belongs to) — weekly pace counts. */
function segundaDaSemana(iso: string): string {
  const d = new Date(`${iso}T12:00:00`);
  const dow = (d.getDay() + 6) % 7; // seg=0 … dom=6
  return addDias(iso, -dow);
}

export function montarPlanoEmDia(input: {
  dupla: Dupla;
  eventos: CicloEvento[];
  /** Encounters per calendar week — default 2 ("semana dupla"). The guide's
   *  own accelerated pace (~2.5) is the derived ceiling, not a hardcoded
   *  pair whitelist: any adjacent steps may share a week when the spacing
   *  rules allow. */
  ritmo?: number;
  hoje?: Date;
}): PlanoEmDia {
  const { dupla } = input;
  const ritmo = Math.max(1, Math.floor(input.ritmo ?? 2));
  const hoje = input.hoje ?? new Date();
  const hojeStr = toDateStr(hoje);

  if (dupla.trilha === "especialista") {
    return {
      aplicavel: false,
      motivo:
        "A trilha de especialista combina os encontros livremente, não existe calendário oficial pra ficar em dia.",
    };
  }
  const eventos = eventosDoCronograma(input.eventos, dupla.cronograma_id);
  if (!eventos.some((e) => e.tipo === "encontro")) {
    return {
      aplicavel: false,
      motivo: "A dupla está sem calendário oficial vinculado.",
    };
  }

  const passos = passosDaTrilha(dupla.trilha, eventos);
  const jornada = jornadaDaDupla(dupla, passos, hoje);

  const pendenciasRegistro: PendenciaRegistro[] = [];
  type Devido = {
    numero: number;
    acao: "agendar" | "remarcar";
    encontroId: string | null;
    oficialData: string;
  };
  const devidos: Devido[] = [];
  const travados: {
    numero: number;
    encontroId: string;
    data: string;
    oficialData: string;
  }[] = [];

  for (const no of jornada.nos) {
    const oficialData = no.evento.data;
    if (no.estado === "limbo" || no.estado === "pendente_registro") {
      pendenciasRegistro.push({
        numero: no.numero,
        encontroId: no.encontro!.id,
        estado: no.estado,
        dataHora: no.encontro!.data_hora,
      });
      continue;
    }
    if (no.estado === "nao_aconteceu" && oficialData) {
      devidos.push({
        numero: no.numero,
        acao: "remarcar",
        encontroId: no.encontro!.id,
        oficialData,
      });
      continue;
    }
    if (no.estado === "agendado" && oficialData && no.encontro?.data_hora) {
      travados.push({
        numero: no.numero,
        encontroId: no.encontro.id,
        data: toDateStr(new Date(no.encontro.data_hora)),
        oficialData,
      });
      continue;
    }
    // "futuro" sem row: devido quando a data oficial já passou — passos ainda
    // não vencidos ficam fora do plano (a agenda normal cobre na hora)
    if (no.estado === "futuro" && oficialData && oficialData <= hojeStr) {
      devidos.push({
        numero: no.numero,
        acao: "agendar",
        encontroId: null,
        oficialData,
      });
    }
  }

  const recessos = eventos
    .filter((e) => e.tipo === "recesso" && e.data != null)
    .map((e) => ({ ini: e.data!, fim: e.data_fim ?? e.data! }));
  const encerramento =
    eventos
      .filter((e) => e.tipo === "evento_encerramento" && e.data != null)
      .sort((a, b) => a.data!.localeCompare(b.data!))
      .at(-1)?.data ?? null;

  const dentroRecesso = (d: string) =>
    recessos.find((r) => d >= r.ini && d <= r.fim);

  // locked rows pin their week before the walk starts — the pace cap counts
  // them, and no planned step may reuse their date
  const ocupados = new Set(travados.map((t) => t.data));
  const porSemana = new Map<string, number>();
  const somarSemana = (d: string) => {
    const k = segundaDaSemana(d);
    porSemana.set(k, (porSemana.get(k) ?? 0) + 1);
  };
  for (const t of travados) somarSemana(t.data);

  const gapApos = (numero: number | null): number => {
    if (numero == null) return 0;
    const exige = META_PASSOS_PLANO[numero]?.exige;
    return exige ? GAP_DIAS_EXIGE[exige] : GAP_MINIMO_DIAS;
  };

  const avisos: string[] = [];
  const passosPlano: PassoPlano[] = [];
  const passoPorNumero = new Map(passos.map((p) => [p.numero, p]));

  // sequence anchors: locked rows interleave with owed steps by número —
  // the walk consumes them in order so a locked step 9 also pins the gap
  // after it for step 10
  const sequencia = [
    ...devidos.map((d) => ({ ...d, travado: null as null })),
    ...travados.map((t) => ({
      numero: t.numero,
      acao: "travado" as const,
      encontroId: t.encontroId,
      oficialData: t.oficialData,
      travado: t,
    })),
  ].sort((a, b) => a.numero - b.numero);

  let cursor = addDias(hojeStr, 1);
  let prevNumero: number | null = null;
  let prevData: string | null = null;

  for (const passo of sequencia) {
    const meta = META_PASSOS_PLANO[passo.numero];
    const guia = passoPorNumero.get(passo.numero);
    const base = {
      numero: passo.numero,
      titulo: guia?.titulo ?? `Encontro ${passo.numero}`,
      fase: guia?.fase ?? null,
      marco: Boolean(meta?.marco),
      precondicao: meta?.precondicao,
    };

    if (passo.acao === "travado") {
      // locked row: the sequence can't cross it — a future official step
      // scheduled before today's leftovers get a warning, not a move
      if (prevData && passo.travado!.data <= prevData) {
        avisos.push(
          `O encontro ${passo.numero} está marcado pra ${fmtData(passo.travado!.data)}, antes do plano do ${prevNumero}º, então vale remarcar pra manter a ordem do guia.`
        );
      }
      prevNumero = passo.numero;
      prevData = passo.travado!.data;
      passosPlano.push({
        ...base,
        acao: "travado",
        encontroId: passo.encontroId,
        data: passo.travado!.data,
        dataOficial: passo.oficialData,
      });
      continue;
    }

    // earliest slot: tomorrow's cursor, the previous step's required gap,
    // recess bounds, weekly pace and occupied dates — in that order
    let data = cursor;
    if (prevData) {
      const comGap = addDias(prevData, gapApos(prevNumero));
      if (comGap > data) data = comGap;
    }
    let motivoAviso: string | undefined;
    const exigePrev = prevNumero != null ? META_PASSOS_PLANO[prevNumero]?.exige : undefined;
    if (prevData && exigePrev === "pratica" && data === addDias(prevData, GAP_DIAS_EXIGE.pratica)) {
      motivoAviso = `O ${prevNumero}º pede tempo de prática entre um encontro e outro, por isso a semana de espera.`;
    }
    for (;;) {
      const r = dentroRecesso(data);
      if (r) {
        data = addDias(r.fim, 1);
        motivoAviso = motivoAviso ?? "A data cairia no recesso do programa, foi empurrada pro fim dele.";
        continue;
      }
      const semana = segundaDaSemana(data);
      if ((porSemana.get(semana) ?? 0) >= ritmo) {
        data = addDias(semana, 7);
        continue;
      }
      if (ocupados.has(data)) {
        data = addDias(data, 1);
        continue;
      }
      break;
    }
    ocupados.add(data);
    somarSemana(data);

    prevNumero = passo.numero;
    prevData = data;
    cursor = addDias(data, 1);
    passosPlano.push({
      ...base,
      acao: passo.acao,
      encontroId: passo.encontroId,
      data,
      dataOficial: passo.oficialData,
      aviso: motivoAviso,
    });
  }

  // "em dia" = the day every currently-owed step is scheduled: the latest
  // among planned leftover dates and locked rows already past their
  // official date. Null when the closure event comes first.
  const devidosPlanejados = passosPlano.filter((p) => p.acao !== "travado");
  const travadosAtrasados = passosPlano.filter(
    (p) => p.acao === "travado" && p.dataOficial <= hojeStr
  );
  const ultimaCobranca = [...devidosPlanejados, ...travadosAtrasados]
    .map((p) => p.data)
    .sort()
    .at(-1);

  let dataRecuperacao: string | null = null;
  if (ultimaCobranca) {
    if (encerramento && ultimaCobranca > encerramento) {
      avisos.push(
        `Com esse ritmo a última reposição cai depois do encerramento (${fmtData(encerramento)}). Vale combinar datas mais próximas ou rever o plano com a coordenação.`
      );
      for (const p of passosPlano) {
        if (p.data > encerramento)
          p.aviso = p.aviso ?? "A data sugerida passa do encerramento do ciclo.";
      }
    } else {
      dataRecuperacao = ultimaCobranca;
    }
  }

  const emDia =
    !devidosPlanejados.length &&
    !travadosAtrasados.length &&
    !pendenciasRegistro.length;

  return {
    aplicavel: true,
    emDia,
    pendenciasRegistro,
    passos: passosPlano,
    dataRecuperacao,
    encerramento,
    avisos,
  };
}

/** "2026-01-10" → "10/01/2026" — copy pt-BR sem depender de locale. */
function fmtData(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}
