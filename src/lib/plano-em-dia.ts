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
 *  - double weeks ("semana dupla") are the first compression: ≥2 days
 *    between the pair's encounters, pace bounded by `ritmo`/week; the top
 *    of the ladder is 1 per day (REALIZA-513), where only the generic
 *    2-day floor drops — practice/task spacing still holds
 *  - exige_pratica/exige_tarefa add the guide's spacing between contents;
 *    recesses and the closure event are hard calendar constraints
 *  - "em dia" is a moving target: the projection schedules every official
 *    step still ahead (not just today's backlog) and finds the first date
 *    where covered ≥ due — today's leftovers alone lie, because the
 *    calendar keeps charging while the pair catches up; the steps that
 *    come due during the recovery join the plan list too, otherwise the
 *    persisted plan would leave them without an owner */

import {
  eventosDoCronograma,
  jornadaDaDupla,
  passosDaTrilha,
  toDateStr,
} from "./ciclo";
import { feriadoNacional } from "./feriados";
import type { CicloEvento, Dupla } from "./types";
import {
  GAP_DIAS_EXIGE,
  GAP_MINIMO_DIAS,
  GAP_UM_POR_DIA,
  META_PASSOS_PLANO,
  RITMO_UM_POR_DIA,
  RITMOS_PLANO,
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
  /** Not due today, but comes due during the recovery: the projection only
   *  covers it after the official date, so it belongs to the plan. */
  venceNoCaminho?: boolean;
};

/** Nível nomeado de flexibilização (FR-011, 0219; degraus 3/semana e
 *  1/dia na 513) — o mais leve que recupera a dupla antes do encerramento:
 *  - ritmo_normal: cabe 1 encontro por semana
 *  - semana_dupla: precisa de 2 por semana (a compressão clássica)
 *  - semana_tripla: precisa de 3 por semana
 *  - um_por_dia: só fecha com até 1 por dia
 *  - conversa_coord: nem 1 por dia fecha antes do fim — o plano vira
 *    conversa estruturada com a coordenação, não promessa de agenda. */
export type NivelFlexibilizacao =
  | "ritmo_normal"
  | "semana_dupla"
  | "semana_tripla"
  | "um_por_dia"
  | "conversa_coord";

/** Os três estados que o card, o banner e a Liza contam (REALIZA-513). */
export type EstadoPlano = "em_dia" | "recuperacao" | "conversa";

const NIVEL_DO_RITMO: Record<number, NivelFlexibilizacao> = {
  1: "ritmo_normal",
  2: "semana_dupla",
  3: "semana_tripla",
  [RITMO_UM_POR_DIA]: "um_por_dia",
};

/** O custo do plano em palavras: "1 encontro por semana", "até 3
 *  encontros por semana", "até 1 encontro por dia". */
export function rotuloRitmo(ritmo: number): string {
  if (ritmo >= RITMO_UM_POR_DIA) return "até 1 encontro por dia";
  return ritmo <= 1
    ? "1 encontro por semana"
    : `até ${ritmo} encontros por semana`;
}

const CAMINHOS_COORD =
  "Vale conversar com a coordenação sobre os caminhos: seguir no ritmo possível, rever o pareamento ou encerrar a trilha DPP seguindo com a trilha de especialista.";


export type PlanoEmDia =
  | { aplicavel: false; motivo: string }
  | {
      aplicavel: true;
      /** Nothing owed: every due step is done or already scheduled. */
      emDia: boolean;
      /** em_dia · recuperacao (some pace of the ladder closes before the
       *  closure) · conversa (not even 1 per day closes). */
      estado: EstadoPlano;
      /** Limbo/pending-registro steps — resolve before planning ahead. */
      pendenciasRegistro: PendenciaRegistro[];
      /** Owed, locked and come-due-on-the-way steps in encounter order,
       *  each with its date. */
      passos: PassoPlano[];
      /** Ritmo usado na simulação devolvida (encontros/semana; 7 = 1/dia). */
      ritmo: number;
      /** Date the compressed sequence is back on the official calendar —
       *  the first day where everything the calendar already charged has
       *  an owner (done, locked or planned), counting the officials that
       *  come due DURING the recovery, not just today's backlog. Null when
       *  the plan cannot converge before the closure event. */
      dataRecuperacao: string | null;
      /** The same "em dia" date even when it lands after the closure: what
       *  the conversa state tells the team. Null when nothing is owed or
       *  the walk never converges. */
      dataProjetada: string | null;
      /** Closure-event date the plan was checked against, if the calendar
       *  has one. */
      encerramento: string | null;
      /** At the returned pace, how many of the encounters still ahead fit
       *  until the closure. Null without a closure event. */
      cabemAteEncerramento: { cabem: number; faltam: number } | null;
      /** Nível nomeado de flexibilização (FR-011) — deriva de ritmo ×
       *  atraso × encerramento, não do ritmo pedido na chamada. */
      nivel: NivelFlexibilizacao;
      /** O que fazer, com os números do plano (ritmo, data, encerramento). */
      sugestao: string;
      /** Quando o ritmo pedido não fecha antes do encerramento: o ritmo
       *  maior mais leve que fecharia, com a data. Null quando o ritmo
       *  pedido já converge (ou quando nem 1 por dia fecha). */
      alternativaRitmo: { ritmo: number; data: string } | null;
      /** Recesso no caminho: o ritmo mais leve que fecharia se a dupla
       *  seguisse se encontrando nele, quando isso alivia o plano (ou
       *  quando sem isso nada fecha). A decisão é da dupla; o plano só
       *  mostra o efeito. */
      alternativaRecesso: { ritmo: number; data: string } | null;
      avisos: string[];
    };

export type PlanoAplicavel = Extract<PlanoEmDia, { aplicavel: true }>;

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
  /** Encounters per calendar week to simulate (7 = 1 per day). Omitted:
   *  the lightest pace of `RITMOS_PLANO` that closes before the closure,
   *  i.e. the plan the card shows and proposes; with nothing closing, the
   *  top of the ladder, so the team sees the best case. */
  ritmo?: number;
  hoje?: Date;
}): PlanoEmDia {
  const { dupla } = input;
  const ritmoPedido =
    input.ritmo == null
      ? null
      : Math.min(RITMO_UM_POR_DIA, Math.max(1, Math.floor(input.ritmo)));
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
  const futuros: {
    numero: number;
    encontroId: string | null;
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
    // "futuro" sem row: devido quando a data oficial já passou
    if (no.estado === "futuro" && oficialData && oficialData <= hojeStr) {
      devidos.push({
        numero: no.numero,
        acao: "agendar",
        encontroId: null,
        oficialData,
      });
      continue;
    }
    // passo ainda não vencido: entra na projeção — o cronograma segue
    // cobrando enquanto a dupla recupera e cada um deles disputa o mesmo
    // ritmo semanal. Só vira item do plano se a caminhada o cobrir depois
    // da data oficial (vence no caminho)
    if (
      (no.estado === "futuro" ||
        (no.estado === "agendado" && !no.encontro?.data_hora)) &&
      oficialData &&
      oficialData > hojeStr
    ) {
      futuros.push({
        numero: no.numero,
        encontroId: no.encontro?.id ?? null,
        oficialData,
      });
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

  const passoPorNumero = new Map(passos.map((p) => [p.numero, p]));

  // sequence anchors: locked rows interleave with owed steps by número —
  // the walk consumes them in order so a locked step 9 also pins the gap
  // after it for step 10; future steps join the same walk
  const sequencia = [
    ...devidos.map((d) => ({ ...d, travado: null as null })),
    ...travados.map((t) => ({
      numero: t.numero,
      acao: "travado" as const,
      encontroId: t.encontroId as string | null,
      oficialData: t.oficialData,
      travado: t,
    })),
    ...futuros.map((f) => ({
      numero: f.numero,
      acao: "futuro" as const,
      encontroId: f.encontroId,
      oficialData: f.oficialData,
      travado: null as null,
    })),
  ].sort((a, b) => a.numero - b.numero);

  // A caminhada de datas é pura e roda mais de uma vez: o nível sonda a
  // escada de ritmos (e, com recesso no caminho, a mesma escada sem ele)
  // e só depois o plano devolvido usa o ritmo escolhido. Estado local por
  // simulação.
  const rodar = (r: number, semRecesso: boolean) => {
    const recs = semRecesso ? [] : recessos;
    const dentroRecesso = (d: string) =>
      recs.find((x) => d >= x.ini && d <= x.fim);
    // 1 por dia: só o piso genérico da semana dupla cai; prática e tarefa
    // são conteúdo do guia e seguem valendo
    const pisoGenerico =
      r >= RITMO_UM_POR_DIA ? GAP_UM_POR_DIA : GAP_MINIMO_DIAS;
    const gapApos = (numero: number | null): number => {
      if (numero == null) return 0;
      const exige = META_PASSOS_PLANO[numero]?.exige;
      return exige ? GAP_DIAS_EXIGE[exige] : pisoGenerico;
    };

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
    type Item = PassoPlano & { origem: "devido" | "travado" | "futuro" };
    const itens: Item[] = [];

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
        itens.push({
          ...base,
          origem: "travado",
          acao: "travado",
          encontroId: passo.encontroId,
          data: dataTravado,
          dataOficial: passo.oficialData,
          aviso: avisoTravado,
        });
        continue;
      }

      // earliest slot: tomorrow's cursor, the running gap floor, recess
      // bounds, national holidays, weekly pace and occupied dates
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
        const feriado = feriadoNacional(data);
        if (feriado) {
          motivoAviso =
            motivoAviso ??
            `${fmtData(data).slice(0, 5)} é feriado (${feriado}), a data foi pro dia seguinte.`;
          data = addDias(data, 1);
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
      itens.push({
        ...base,
        origem: passo.acao === "futuro" ? "futuro" : "devido",
        acao:
          passo.acao === "futuro"
            ? passo.encontroId
              ? "remarcar"
              : "agendar"
            : passo.acao,
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

    // o plano lista o devido, o travado e o futuro que vence no caminho —
    // até o último passo coberto atrasado; depois dele a agenda normal
    // cobre cada um na data oficial
    const ultimoAtrasado = itens.reduce(
      (m, i) =>
        i.origem !== "travado" && i.data > i.dataOficial
          ? Math.max(m, i.numero)
          : m,
      0
    );
    const passosPlano: PassoPlano[] = itens
      .filter((i) => i.origem !== "futuro" || i.numero <= ultimoAtrasado)
      .map(({ origem, ...p }) =>
        origem === "futuro" ? { ...p, venceNoCaminho: true } : p
      );

    let dataRecuperacao: string | null = null;
    if (convergiu && alvo > hojeStr) {
      if (encerramento && alvo > encerramento) {
        avisos.push(
          `Nesse ritmo vocês só ficam em dia em ${fmtData(alvo)}, depois do encerramento (${fmtData(encerramento)}).`
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
    const cabemAteEncerramento = encerramento
      ? {
          cabem: itens.filter((i) => i.data <= encerramento).length,
          faltam: itens.length,
        }
      : null;
    return {
      passosPlano,
      avisos,
      dataRecuperacao,
      dataProjetada: convergiu && alvo > hojeStr ? alvo : null,
      cabemAteEncerramento,
    };
  };

  const emDia =
    !devidos.length &&
    !pendenciasRegistro.length &&
    !travados.some((t) => t.oficialData <= hojeStr);

  // A caminhada é pura: cache por (ritmo, recesso) pras sondas não
  // re-fazerem conta
  const cacheRodar = new Map<string, ReturnType<typeof rodar>>();
  const simular = (r: number, semRecesso = false) => {
    const k = `${r}:${semRecesso}`;
    let s = cacheRodar.get(k);
    if (!s) {
      s = rodar(r, semRecesso);
      cacheRodar.set(k, s);
    }
    return s;
  };
  // escada do mais leve ao mais pesado: "em dia" já é ritmo_normal (nada
  // a flexibilizar); o primeiro degrau que fecha nomeia o nível; nenhum
  // degrau fechando vira conversa com a coordenação
  const ritmoQueFecha = (semRecesso: boolean) =>
    RITMOS_PLANO.find((r) => simular(r, semRecesso).dataRecuperacao != null) ??
    null;
  const ritmoLeve = emDia ? null : ritmoQueFecha(false);
  const estado: EstadoPlano = emDia
    ? "em_dia"
    : ritmoLeve != null
      ? "recuperacao"
      : "conversa";
  const nivel: NivelFlexibilizacao =
    estado === "em_dia"
      ? "ritmo_normal"
      : ritmoLeve != null
        ? NIVEL_DO_RITMO[ritmoLeve]
        : "conversa_coord";

  const ritmo =
    ritmoPedido ?? (emDia ? RITMOS_PLANO[0] : (ritmoLeve ?? RITMO_UM_POR_DIA));
  const s = simular(ritmo);
  const avisos = [...s.avisos];

  // o ritmo pedido não fecha: procura o mais leve ACIMA dele que fecharia
  // antes do encerramento — a sugestão honesta é "acelera", não só "avisa"
  let alternativaRitmo: { ritmo: number; data: string } | null = null;
  if (!emDia && s.dataRecuperacao == null) {
    for (const r of RITMOS_PLANO) {
      if (r <= ritmo) continue;
      const alt = simular(r);
      if (alt.dataRecuperacao != null) {
        alternativaRitmo = { ritmo: r, data: alt.dataRecuperacao };
        avisos.push(
          `Com ${rotuloRitmo(r)} daria pra ficar em dia em ${fmtData(alt.dataRecuperacao)}.`
        );
        break;
      }
    }
  }

  // recesso que fica entre a dupla e a recuperação: o efeito de ela seguir
  // se encontrando nele, só quando isso alivia o plano (degrau mais leve)
  // ou salva o que não fecha. Plano que já fecha antes do recesso não
  // ganha a sugestão. A decisão é da dupla, no card
  const dataLeve = ritmoLeve != null ? simular(ritmoLeve).dataRecuperacao : null;
  let alternativaRecesso: { ritmo: number; data: string } | null = null;
  const recessoNoCaminho = recessos.some(
    (r) =>
      r.fim > hojeStr &&
      (!encerramento || r.ini <= encerramento) &&
      (dataLeve == null || dataLeve >= r.ini)
  );
  if (!emDia && recessoNoCaminho) {
    const r = ritmoQueFecha(true);
    if (r != null && (ritmoLeve == null || r < ritmoLeve)) {
      alternativaRecesso = { ritmo: r, data: simular(r, true).dataRecuperacao! };
    }
  }

  const sugestao =
    estado === "em_dia"
      ? "A dupla está em dia: tudo o que o calendário oficial já cobrou está feito ou marcado. Não há recuperação a fazer."
      : estado === "recuperacao"
        ? `Com ${rotuloRitmo(ritmoLeve!)}, a dupla fica em dia em ${fmtData(dataLeve!)}${encerramento ? `, antes do encerramento (${fmtData(encerramento)})` : ""}. Combinem as datas juntos.`
        : `Nem com 1 encontro por dia o plano fecha antes do encerramento${encerramento ? ` (${fmtData(encerramento)})` : ""}. ${CAMINHOS_COORD}`;

  return {
    aplicavel: true,
    emDia,
    estado,
    pendenciasRegistro,
    passos: s.passosPlano,
    ritmo,
    dataRecuperacao: s.dataRecuperacao,
    dataProjetada: s.dataProjetada,
    encerramento,
    cabemAteEncerramento: s.cabemAteEncerramento,
    nivel,
    sugestao,
    alternativaRitmo,
    alternativaRecesso,
    avisos,
  };
}

/** O escopo que `plano_propor` grava (0219/0224). Só "recuperação
 *  possível" vira proposta: dupla em dia não tem o que propor e a conversa
 *  com a coordenação não promete agenda. A janela vai de hoje ao
 *  encerramento (o limite duro), pra dupla poder trocar uma data sem sair
 *  do combinado. Mesma régua pra ficha e pra Liza. */
export type EscopoProposta = {
  numeros: number[];
  ritmo: number;
  nivel: NivelFlexibilizacao;
  janela: { inicio: string; fim: string };
  passos: { numero: number; data: string; acao: "agendar" | "remarcar" }[];
};

export function escopoDaProposta(
  plano: PlanoAplicavel,
  hoje: string
): { escopo: EscopoProposta } | { erro: string } {
  if (plano.estado === "em_dia")
    return { erro: "A dupla está em dia, não há plano pra propor." };
  if (plano.estado === "conversa" || plano.dataRecuperacao == null)
    return {
      erro: "Nesse ritmo o plano não fecha antes do encerramento. O caminho é conversar com a coordenação.",
    };
  const passos = plano.passos.filter(
    (p): p is PassoPlano & { acao: "agendar" | "remarcar" } =>
      p.acao !== "travado"
  );
  if (!passos.length)
    return { erro: "A dupla não tem encontro devido, não há plano pra propor." };
  const ultima = passos.map((p) => p.data).sort().at(-1)!;
  const fim =
    plano.encerramento && plano.encerramento >= ultima
      ? plano.encerramento
      : ultima;
  return {
    escopo: {
      numeros: passos.map((p) => p.numero),
      ritmo: plano.ritmo,
      nivel: plano.nivel,
      janela: { inicio: hoje, fim },
      passos: passos.map((p) => ({
        numero: p.numero,
        data: p.data,
        acao: p.acao,
      })),
    },
  };
}

/** "2026-01-10" → "10/01/2026" — copy pt-BR sem depender de locale. */
function fmtData(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}
