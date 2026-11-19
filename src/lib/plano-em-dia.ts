/** "Para ficar em dia" — pure deterministic catch-up planner for DPP pairs
 *  (REALIZA-397). Consumes `jornadaDaDupla` over `passosDaTrilha` — the same
 *  state machine the journey track uses — so the ficha card and the Liza
 *  tool can never disagree. Devidos are the FULL backlog (official steps
 *  before the pair's entry included): the semáforo's count differs for
 *  late-entry pairs by design — it paces, the plan enumerates.
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
 *    recesses and the closure event are hard calendar constraints
 *  - "em dia" is a moving target: the projection schedules every official
 *    step still ahead (not just today's backlog) and finds the first date
 *    where covered ≥ due — today's leftovers alone lie, because the
 *    calendar keeps charging while the pair catches up */

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

/** Nível nomeado de flexibilização (FR-011, 0219) — o mais leve que
 *  recupera a dupla antes do encerramento:
 *  - ritmo_normal: cabe 1 encontro por semana
 *  - semana_dupla: precisa de 2 por semana (a compressão clássica)
 *  - conversa_coord: nem semana dupla fecha antes do fim — o plano vira
 *    conversa estruturada com a coordenação, não promessa de agenda. */
export type NivelFlexibilizacao =
  | "ritmo_normal"
  | "semana_dupla"
  | "conversa_coord";

export const SUGESTAO_NIVEL: Record<NivelFlexibilizacao, string> = {
  ritmo_normal:
    "Um encontro por semana já recupera. Combinem as datas nos horários de sempre.",
  semana_dupla:
    "Pra ficar em dia antes do fim do ciclo, precisam de duas semanas com dois encontros. Combinem os dias juntos.",
  conversa_coord:
    "No ritmo máximo o plano não fecha antes do encerramento. Vale conversar com a coordenação sobre os caminhos: continuar no ritmo possível, rever o pareamento ou encerrar a trilha DPP seguindo com a trilha de especialista.",
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
      /** Ritmo usado na simulação devolvida (encontros/semana). */
      ritmo: number;
      /** Date the compressed sequence is back on the official calendar —
       *  the first day where everything the calendar already charged has
       *  an owner (done, locked or planned), counting the officials that
       *  come due DURING the recovery, not just today's backlog. Null when
       *  the plan cannot converge before the closure event. */
      dataRecuperacao: string | null;
      /** Closure-event date the plan was checked against, if the calendar
       *  has one. */
      encerramento: string | null;
      /** Nível nomeado de flexibilização (FR-011) — deriva de ritmo ×
       *  atraso × encerramento, não do ritmo pedido na chamada. */
      nivel: NivelFlexibilizacao;
      /** Ação sugerida pro nível — o que fazer com o plano. */
      sugestao: string;
      /** Quando o ritmo pedido não fecha antes do encerramento: o ritmo
       *  maior mais leve que fecharia, com a data. Null quando o ritmo
       *  pedido já converge (ou quando nenhum até 4/semana fecha). */
      alternativaRitmo: { ritmo: number; data: string } | null;
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
  // lifecycle gate: a plan proposes future meetings — meaningless for a
  // pair that paused, closed or desisted (scheduling is refused anyway)
  if (dupla.status !== "ativa") {
    return {
      aplicavel: false,
      motivo:
        "A dupla não está em andamento no momento, então não existe plano de recuperação.",
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
  const futuros: { numero: number; oficialData: string }[] = [];

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
    // scheduled row without a date ("a combinar") whose official window
    // already passed: owed — the same row gets a real date, never a new one
    // (unique(dupla_id, numero) would refuse a duplicate)
    if (
      no.estado === "agendado" &&
      oficialData &&
      oficialData <= hojeStr &&
      no.encontro &&
      !no.encontro.data_hora
    ) {
      devidos.push({
        numero: no.numero,
        acao: "remarcar",
        encontroId: no.encontro.id,
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
      continue;
    }
    // passo ainda não vencido: fora da LISTA do plano, mas dentro da
    // projeção — o cronograma segue cobrando enquanto a dupla recupera e
    // cada um deles disputa o mesmo ritmo semanal
    if (
      (no.estado === "futuro" ||
        (no.estado === "agendado" && !no.encontro?.data_hora)) &&
      oficialData &&
      oficialData > hojeStr
    ) {
      futuros.push({ numero: no.numero, oficialData });
    }
  }

  // recesso que a dupla declarou atravessar (462, usa=false) deixa de ser
  // restrição PRA ELA — só pra ela; o calendário oficial não muda
  const recessoOptOut = new Set(
    (dupla.recessos ?? [])
      .filter((r) => !r.usa)
      .map((r) => r.ciclo_evento_id)
  );
  const recessos = eventos
    .filter(
      (e) => e.tipo === "recesso" && e.data != null && !recessoOptOut.has(e.id)
    )
    .map((e) => ({ ini: e.data!, fim: e.data_fim ?? e.data! }));
  const encerramento =
    eventos
      .filter((e) => e.tipo === "evento_encerramento" && e.data != null)
      .sort((a, b) => a.data!.localeCompare(b.data!))
      .at(-1)?.data ?? null;

  const dentroRecesso = (d: string) =>
    recessos.find((r) => d >= r.ini && d <= r.fim);

  const gapApos = (numero: number | null): number => {
    if (numero == null) return 0;
    const exige = META_PASSOS_PLANO[numero]?.exige;
    return exige ? GAP_DIAS_EXIGE[exige] : GAP_MINIMO_DIAS;
  };

  const passoPorNumero = new Map(passos.map((p) => [p.numero, p]));

  // sequence anchors: locked rows interleave with owed steps by número —
  // the walk consumes them in order so a locked step 9 also pins the gap
  // after it for step 10. `futuros` entra na mesma caminhada: só alimenta
  // a projeção de convergência (não vira passo do plano)
  const sequencia = [
    ...devidos.map((d) => ({ ...d, travado: null as null })),
    ...travados.map((t) => ({
      numero: t.numero,
      acao: "travado" as const,
      encontroId: t.encontroId,
      oficialData: t.oficialData,
      travado: t,
    })),
    ...futuros.map((f) => ({
      numero: f.numero,
      acao: "futuro" as const,
      encontroId: null as string | null,
      oficialData: f.oficialData,
      travado: null as null,
    })),
  ].sort((a, b) => a.numero - b.numero);

  // A caminhada de datas é pura e roda mais de uma vez: o nível FR-011
  // sonda ritmo 1 e 2 pra nomear o mínimo que fecha, e só depois o plano
  // devolvido usa o ritmo pedido. Estado local por simulação.
  const rodar = (r: number) => {
    // locked rows pin their week before the walk starts — the pace cap
    // counts them, and no planned step may reuse their date
    const ocupados = new Set(travados.map((t) => t.data));
    const porSemana = new Map<string, number>();
    const somarSemana = (d: string) => {
      const k = segundaDaSemana(d);
      porSemana.set(k, (porSemana.get(k) ?? 0) + 1);
    };
    for (const t of travados) somarSemana(t.data);

    const avisos: string[] = [];
    const passosPlano: PassoPlano[] = [];

    // gap floor: a step can't come sooner than every earlier item's
    // required spacing — a running max (item.data + gapApos(item.numero)),
    // so an out-of-order locked row can warn without pulling the floor
    // back. Seeded by the pair's last realized/pending/limbo encounter:
    // meeting the 4º (practice week) yesterday doesn't unlock the 5º
    // tomorrow.
    // typed init via `as`: a literal `= null` narrows the var to `null`
    // and mutations inside the sobePiso closure stay invisible to CFA
    let pisoGap = null as string | null;
    let pisoNumero = null as number | null;
    const sobePiso = (numero: number, data: string) => {
      const limite = addDias(data, gapApos(numero));
      if (!pisoGap || limite > pisoGap) {
        pisoGap = limite;
        pisoNumero = numero;
      }
    };
    // cobertura por passo (nº → data em que fica coberto): o já realizado
    // conta pela data dele; o resto a caminhada preenche com a data
    // planejada — devido, travado ou futuro
    const cobertura = new Map<number, string>();
    for (const no of jornada.nos) {
      if (
        no.estado === "realizado_completo" ||
        no.estado === "pendente_registro" ||
        no.estado === "limbo"
      ) {
        const quando = no.encontro?.realizado_em ?? no.encontro?.data_hora;
        if (quando) {
          const dia = toDateStr(new Date(quando));
          sobePiso(no.numero, dia);
          cobertura.set(no.numero, dia);
        }
      }
    }

    let cursor = addDias(hojeStr, 1);
    // the server refuses dates before the pair's start — the plan obeys too
    if (dupla.iniciada_em && dupla.iniciada_em > cursor)
      cursor = dupla.iniciada_em;
    // previous item in sequence order (número): the out-of-order warning
    // compares each locked row against the step right before it
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
        const dataTravado = passo.travado!.data;
        // locked row: the sequence can't cross it — a future official step
        // scheduled before today's leftovers get a warning, not a move
        if (prevData && dataTravado <= prevData) {
          avisos.push(
            `O encontro ${passo.numero} está marcado pra ${fmtData(dataTravado)}, antes da data sugerida pro ${prevNumero}º, então vale remarcar pra manter a ordem do guia.`
          );
        }
        const avisoTravado = dentroRecesso(dataTravado)
          ? "A data cai dentro do recesso do programa."
          : undefined;
        sobePiso(passo.numero, dataTravado);
        cobertura.set(passo.numero, dataTravado);
        prevNumero = passo.numero;
        prevData = dataTravado;
        passosPlano.push({
          ...base,
          acao: "travado",
          encontroId: passo.encontroId,
          data: dataTravado,
          dataOficial: passo.oficialData,
          aviso: avisoTravado,
        });
        continue;
      }

      // earliest slot: tomorrow's cursor, the running gap floor, recess
      // bounds, weekly pace and occupied dates — in that order
      let data = cursor;
      if (pisoGap && pisoGap > data) data = pisoGap;
      let motivoAviso: string | undefined;
      if (
        data === pisoGap &&
        pisoNumero != null &&
        META_PASSOS_PLANO[pisoNumero]?.exige === "pratica"
      ) {
        motivoAviso = `O ${pisoNumero}º pede tempo de prática entre um encontro e outro, por isso a semana de espera.`;
      }
      for (;;) {
        const r2 = dentroRecesso(data);
        if (r2) {
          data = addDias(r2.fim, 1);
          motivoAviso = motivoAviso ?? "A data cairia no recesso do programa, foi empurrada pro fim dele.";
          continue;
        }
        const semana = segundaDaSemana(data);
        if ((porSemana.get(semana) ?? 0) >= r) {
          data = addDias(semana, 7);
          motivoAviso = motivoAviso ?? "Já tem encontros demais nessa semana, a data foi pra próxima.";
          continue;
        }
        if (ocupados.has(data)) {
          data = addDias(data, 1);
          motivoAviso = motivoAviso ?? "Esse dia já tem encontro marcado, foi pro dia seguinte.";
          continue;
        }
        break;
      }
      ocupados.add(data);
      somarSemana(data);

      sobePiso(passo.numero, data);
      cobertura.set(passo.numero, data);
      prevNumero = passo.numero;
      prevData = data;
      cursor = addDias(data, 1);
      // passo futuro só alimenta a projeção — não vira item do plano
      if (passo.acao === "futuro") continue;
      passosPlano.push({
        ...base,
        acao: passo.acao,
        encontroId: passo.encontroId,
        data,
        dataOficial: passo.oficialData,
        aviso: motivoAviso,
      });
    }

    // "em dia" = fim do último intervalo de atraso: cada passo coberto
    // DEPOIS da data oficial deixa a dupla devendo entre oficial→cobertura;
    // enquanto ela recupera, os oficiais seguintes continuam vencendo e
    // entram na conta — o cronograma não para de cobrar. Contar só o
    // backlog de hoje mente (o caso dos 10 atrasos "em dia" em janeiro
    // que já devia o 14º). Coberto ≤ oficial nunca gera atraso.
    let alvo = hojeStr;
    let convergiu = true;
    for (const no of jornada.nos) {
      const oficial = no.evento.data;
      if (oficial == null) continue;
      const coberto = cobertura.get(no.numero);
      if (coberto == null) {
        // passo oficial sem cobertura nenhuma — não devia acontecer; se
        // acontecer, "em dia" nunca chega (falha segura, não data errada)
        convergiu = false;
        break;
      }
      if (coberto > oficial && coberto > alvo) alvo = coberto;
    }

    let dataRecuperacao: string | null = null;
    if (convergiu && alvo > hojeStr) {
      if (encerramento && alvo > encerramento) {
        avisos.push(
          `Nesse ritmo vocês só ficam em dia em ${fmtData(alvo)}, depois do encerramento (${fmtData(encerramento)}). Vale combinar datas mais próximas ou rever o plano com a coordenação.`
        );
        for (const p of passosPlano) {
          if (p.data > encerramento)
            p.aviso = p.aviso ?? "A data sugerida passa do encerramento do ciclo.";
        }
      } else {
        dataRecuperacao = alvo;
      }
    } else if (!convergiu) {
      avisos.push(
        "Com esse ritmo o plano não fecha: sempre sobra encontro devido no caminho."
      );
    }
    return { passosPlano, avisos, dataRecuperacao, alvo };
  };

  const emDia =
    !devidos.length &&
    !pendenciasRegistro.length &&
    !travados.some((t) => t.oficialData <= hojeStr);

  // FR-011: sonda do ritmo mais leve ao mais pesado — "em dia" já é
  // ritmo_normal (nada a flexibilizar); atraso que fecha com 1/semana
  // não pede semana dupla; atraso que nem 2/semana fecha vira conversa.
  // A caminhada é pura — cache por ritmo pras sondas não re-fazerem conta.
  const cacheRodar = new Map<number, ReturnType<typeof rodar>>();
  const simular = (r: number) => {
    let s = cacheRodar.get(r);
    if (!s) {
      s = rodar(r);
      cacheRodar.set(r, s);
    }
    return s;
  };
  const nivel: NivelFlexibilizacao = emDia
    ? "ritmo_normal"
    : simular(1).dataRecuperacao != null
      ? "ritmo_normal"
      : simular(2).dataRecuperacao != null
        ? "semana_dupla"
        : "conversa_coord";

  const { passosPlano, dataRecuperacao } = simular(ritmo);
  const avisos = [...simular(ritmo).avisos];

  // o ritmo pedido não fecha: procura o mais leve ACIMA dele que fecharia
  // antes do encerramento — a sugestão honesta é "acelera", não só "avisa"
  let alternativaRitmo: { ritmo: number; data: string } | null = null;
  if (!emDia && dataRecuperacao == null) {
    for (let r = ritmo + 1; r <= 4; r++) {
      const s = simular(r);
      if (s.dataRecuperacao != null) {
        alternativaRitmo = { ritmo: r, data: s.dataRecuperacao };
        avisos.push(
          `Com ${r} encontros por semana daria pra ficar em dia em ${fmtData(s.dataRecuperacao)}.`
        );
        break;
      }
    }
  }

  return {
    aplicavel: true,
    emDia,
    pendenciasRegistro,
    passos: passosPlano,
    ritmo,
    dataRecuperacao,
    encerramento,
    nivel,
    sugestao: SUGESTAO_NIVEL[nivel],
    alternativaRitmo,
    avisos,
  };
}

/** "2026-01-10" → "10/01/2026" — copy pt-BR sem depender de locale. */
function fmtData(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}
