import {
  ORDEM_SEMAFORO,
  comparaNome,
  cronogramasOpcoes,
  diaSemanaDe,
  duplasSemEncontroDoNumero,
  emLimbo,
  eventoDaSemana,
  eventosDoCronograma,
  lembreteBloqueadoAte,
  resumoSemanaDe,
  saudadeDaDupla,
  semanaBounds,
  toDateStr,
  type DuplaSaude,
  type EventoDatado,
} from "./ciclo";
import { primeiroNomeDaDupla } from "./agenda-minha";
import type {
  CicloEvento,
  Cronograma,
  DiaSemana,
  Dupla,
  Encontro,
} from "./types";
import type { Interacao } from "./interacoes";

// ============================================================
// WP5 — agenda da coordenação ("Monitoramento")
// Puro: sem react, sem supabase, sem fuso local — datas em
// "YYYY-MM-DD" de São Paulo via toDateStr/UTC-date space.
// ============================================================

// ---------- helpers de texto (locais — mesma convenção de agenda-minha) ----------

const DOW_CURTO = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"] as const;
const DOW_PLURAL: Record<DiaSemana, string> = {
  seg: "segundas",
  ter: "terças",
  qua: "quartas",
  qui: "quintas",
  sex: "sextas",
  sab: "sábados",
  dom: "domingos",
};
const TZ = "America/Sao_Paulo";
const fmtHoraMin = new Intl.DateTimeFormat("pt-BR", {
  hour: "2-digit",
  minute: "2-digit",
  timeZone: TZ,
});

/** "2026-10-07" → "qua" — âncora no meio-dia, igual parseDia do ciclo. */
function dowCurto(iso: string): string {
  return DOW_CURTO[new Date(`${iso}T12:00:00`).getDay()];
}

/** "2026-10-07" → 7 — só o dia do mês, sem zero. */
function diaNum(iso: string): number {
  return Number(iso.slice(8, 10));
}

/** ISO instant → "19h" / "19h30" em São Paulo. */
function horaCurta(iso: string): string {
  return fmtHoraMin.format(new Date(iso)).replace(":", "h").replace(/h00$/, "h");
}

/** Pill/etiqueta curta da turma — "T1 · 2026/2027" → "T1". */
function turmaCurta(turma: string | null | undefined): string {
  return (turma ?? "").split("·")[0]?.trim() ?? "";
}

/** "hoje, 19h" / "amanhã (qua 8), 19h" / "qua 8, 19h" — relativo a `hoje`. */
function quandoTxt(iso: string, hoje: Date): string {
  const dia = toDateStr(new Date(iso));
  const hojeStr = toDateStr(hoje);
  const amanha = toDateStr(
    new Date(Date.parse(`${hojeStr}T12:00:00Z`) + 86400000)
  );
  const base =
    dia === hojeStr
      ? "hoje"
      : dia === amanha
        ? `amanhã (${dowCurto(dia)} ${diaNum(dia)})`
        : `${dowCurto(dia)} ${diaNum(dia)}`;
  return `${base}, ${horaCurta(iso)}`;
}

/** "terças 19h": o dow vem da data oficial do evento vigente; a hora é a
 *  moda dos horários que as duplas marcaram pro número vigente — o evento
 *  oficial é só data (coluna `date`), não existe "hora oficial". Sem
 *  agendado ainda, fica só o dia ("terças"). */
function metaTurma(duplasAtivas: Dupla[], vig: EventoDatado | null): string {
  if (!vig) return "—";
  const dow = DOW_PLURAL[diaSemanaDe(vig.data)];
  const horas = new Map<string, number>();
  for (const d of duplasAtivas)
    for (const e of d.encontros)
      if (e.numero === vig.numero && e.data_hora) {
        const h = horaCurta(e.data_hora);
        horas.set(h, (horas.get(h) ?? 0) + 1);
      }
  const moda = [...horas.entries()].sort(
    (a, b) => b[1] - a[1] || a[0].localeCompare(b[0])
  )[0]?.[0];
  return moda ? `${dow} ${moda}` : dow;
}

/** A pendência de registro da dupla — MESMO critério do semáforo (agendado
 *  em limbo ou realizado há >24h sem registro, menor número primeiro). O
 *  DuplaSaude expõe o sinal, não a row — o contexto precisa do número. */
function pendenciaDeRegistro(d: Dupla, agoraMs: number): Encontro | null {
  return (
    d.encontros
      .filter(
        (e) =>
          !e.registro &&
          (emLimbo(e, agoraMs) ||
            (e.status === "realizado" &&
              agoraMs - new Date(e.data_hora ?? 0).getTime() > 24 * 3600 * 1000))
      )
      .sort((a, b) => a.numero - b.numero)[0] ?? null
  );
}

function trunca(s: string, n = 90): string {
  return s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s;
}

/** Um passo da régua oficial (os círculos 1..N do mock). */
export type ReguaPasso = {
  numero: number;
  data: string | null;
  estado: "feito" | "atual" | "futuro";
};

/** Card "Encontro N · Tx" — uma entrada por cronograma ATIVO. */
export type ResumoTurmaCard = {
  cronogramaId: string;
  /** "T1" — `cronograma.turma`. */
  turma: string;
  /** "terças 19h" — do dia/hora do evento vigente (ou "—" sem data). */
  meta: string;
  eventoNumero: number | null;
  /** "YYYY-MM-DD" do evento vigente. */
  eventoData: string | null;
  ativas: number;
  pausadas: number;
  realizaram: number;
  /** com row do número vigente mas ainda não realizaram. */
  agendadas: number;
  semAgendamento: number;
  regua: ReguaPasso[];
};

/** Um card por cronograma ativo — os três segmentos da barra são
 *  realizaram / agendadas / semAgendamento (soma = ativas). `hoje` só vem
 *  de Date pra testes; internamente vira data SP. */
export function resumosPorCronograma(
  duplas: Dupla[],
  cronogramas: Cronograma[],
  eventos: CicloEvento[],
  hoje: Date = new Date()
): ResumoTurmaCard[] {
  const semana = semanaBounds(hoje);
  const cards: ResumoTurmaCard[] = [];
  for (const c of cronogramasOpcoes(cronogramas)) {
    if (c.status !== "ativo") continue;
    const evs = eventosDoCronograma(eventos, c.id);
    if (!evs.length) continue;
    const vig = eventoDaSemana(evs, hoje);
    const ativas = duplas.filter(
      (d) =>
        d.cronograma_id === c.id &&
        d.status === "ativa" &&
        d.trilha !== "especialista"
    );
    const pausadas = duplas.filter(
      (d) =>
        d.cronograma_id === c.id &&
        d.status === "pausada" &&
        d.trilha !== "especialista"
    ).length;
    const realizaram = vig
      ? (resumoSemanaDe(duplas, vig, semana)?.realizaram ?? 0)
      : 0;
    // "agendadas" conta direto (row vigente com status de futuro) — a conta
    // por subtração contava dupla nova (iniciada após a data oficial) e
    // cancelado/não-aconteceu como se tivessem marcado, o que elas não têm
    const agendadas = vig
      ? ativas.filter((d) =>
          d.encontros.some(
            (e) =>
              e.numero === vig.numero &&
              (e.status === "agendado" || e.status === "remarcado")
          )
        ).length
      : 0;
    // "sem agendamento" = o resto: sem row (incl. dupla nova), cancelado ou
    // não-aconteceu — pra monitoramento todos significam "não vai rolar sem
    // ação da dupla"
    const semAgendamento = Math.max(0, ativas.length - realizaram - agendadas);
    const regua: ReguaPasso[] = evs
      .filter((e) => e.tipo === "encontro")
      .map((e) => ({
        numero: e.numero ?? 0,
        data: e.data,
        estado:
          vig?.numero == null || e.numero == null
            ? "futuro"
            : e.numero < vig.numero
              ? "feito"
              : e.numero === vig.numero
                ? "atual"
                : "futuro",
      }));
    cards.push({
      cronogramaId: c.id,
      turma: c.turma,
      meta: metaTurma(ativas, vig),
      eventoNumero: vig?.numero ?? null,
      eventoData: vig?.data ?? null,
      ativas: ativas.length,
      pausadas,
      realizaram,
      agendadas,
      semAgendamento,
      regua,
    });
  }
  return cards;
}

// ---------- "Para acompanhar" ----------

export type MotivoAcompanhar =
  | "sem_data"          // sem row do encontro vigente da turma
  | "atraso"            // sinal `atraso` do semáforo
  | "limbo"             // agendado vencido sem registro
  | "registro_pendente";

/** Ordem estável dos motivos dentro do item. A tela escolhe o `caso` do
 *  lembrete por prioridade própria (registro > limbo > atraso > sem_data) —
 *  não assumir que `motivos[0]` assina a mensagem. */
const MOTIVO_ORDEM: Record<MotivoAcompanhar, number> = {
  atraso: 0,
  limbo: 1,
  sem_data: 2,
  registro_pendente: 3,
};

export type ItemParaAcompanhar = {
  duplaId: string;
  /** "Mentorado · Mentor" (primeiroNomeDaDupla + mentor). */
  nomes: string;
  turma: string;
  saude: DuplaSaude;
  motivos: MotivoAcompanhar[];
  /** Linha pronta: "Encontro 8 · T1 — ainda sem data (prazo: dom 12)". */
  contexto: string;
  /** "Lembrar" | "Lembrar registro" — segue o mock. */
  rotuloLembrete: string;
  /** Último `interacoes` tipo nudge da dupla (null = nunca). */
  ultimoNudge: Interacao | null;
  /** `lembreteBloqueadoAte(ultimoNudge)` — null = botão livre. */
  bloqueadoAte: Date | null;
};

/** Linha de contexto do card "Para acompanhar" — as combinações do mock:
 *  sem_data puro ("Encontro 8 · T1 — ainda sem data nesta semana (prazo:
 *  dom 12)"), atraso dominando ("2 encontros atrasados — sem data para o
 *  8"), registro solto ("Encontro 5 · T2 agendado qua 8, 19h — registro do
 *  4 pendente"). */
function contextoAcompanhar(
  d: Dupla,
  saude: DuplaSaude,
  vig: EventoDatado | null,
  motivos: MotivoAcompanhar[],
  hoje: Date
): string {
  const pend = pendenciaDeRegistro(d, hoje.getTime());
  const atraso = Math.max(0, saude.esperado - saude.feitos);
  // detalhe do sinal é "6º e 7º" — vira "enc. 6 e 7" no parentético
  const detAtraso = saude.sinais
    .find((s) => s.tipo === "atraso")
    ?.detalhe?.replaceAll("º", "");
  const partes: string[] = [];
  // trilha de especialista não tem "encontro" — o passo dela é sessão
  const esp = d.trilha === "especialista";
  const rotuloEnc = esp ? "Sessão" : "Encontro";
  // flexões: "sessão agendada"/"da 3ª sessão" vs "encontro agendado"/"do 3º"
  const encLow = esp ? "sessão" : "encontro";
  const encOrd = esp ? "ª" : "º";
  const encFem = esp ? "a" : "o";
  // com 2+ atrasados o lead é a gravidade, não o encontro da semana
  const lead =
    atraso >= 2
      ? `${atraso} ${d.trilha === "especialista" ? "sessões" : "encontros"} atrasados${detAtraso ? ` (enc. ${detAtraso} · ${d.turma})` : ""}`
      : null;

  if (motivos.includes("sem_data") && vig?.numero != null) {
    // dupla formada DEPOIS da data oficial do vigente — não "faltou", o caso
    // é o 1º agendamento dela; copy separada pra não insinuar atraso
    const novaNaTurma = !!d.iniciada_em && d.iniciada_em > vig.data!;
    // o prazo pra agendar é o domingo da semana oficial do próprio evento
    const { dom } = semanaBounds(new Date(`${vig.data}T12:00:00Z`));
    const { seg, dom: domCorrente } = semanaBounds(hoje);
    const nestaSemana = vig.data >= seg && vig.data <= domCorrente;
    partes.push(
      novaNaTurma
        ? `${rotuloEnc} ${vig.numero} · ${d.turma} — dupla nova, 1º agendamento pendente`
        : lead
          ? `sem data para o ${vig.numero}`
          : `${rotuloEnc} ${vig.numero} · ${d.turma} — ainda sem data${
              nestaSemana
                ? " nesta semana"
                : ` para ${vig.data.slice(8, 10)}/${vig.data.slice(5, 7)}`
            } (prazo: ${dowCurto(dom)} ${diaNum(dom)})`
    );
  } else if (saude.proximo?.data_hora) {
    partes.push(
      `${rotuloEnc} ${saude.proximo.numero} · ${d.turma} agendado ${quandoTxt(saude.proximo.data_hora, hoje)}`
    );
  } else if (lead) {
    partes.push(`sem ${encLow} agendad${encFem}`);
  }
  if (atraso === 1) partes.push(`1 ${encLow} atrasad${encFem}`);
  if (pend?.status === "agendado")
    partes.push(
      `${pend.numero}${encOrd} ${encLow} agendad${encFem} já passou — falta o registro`
    );
  else if (pend)
    partes.push(
      `registro d${encFem} ${pend.numero}${encOrd} ${encLow} pendente`
    );

  const corpo = partes.join(" · ") || saude.motivo;
  return lead ? `${lead} — ${corpo}` : corpo;
}

/** União dedup: coorte sem row do vigente de CADA cronograma ativo + duplas
 *  com sinais atraso/limbo/registro_pendente. Ordena risco→atenção→em
 *  andamento (ORDEM_SEMAFORO). `nudges` vem de `getUltimasInteracoes` —
 *  filtrado a tipo==='nudge' aqui dentro (a query devolve o último contato
 *  de qualquer tipo; o cap só conta nudge). */
export function paraAcompanhar(
  duplas: Dupla[],
  eventos: CicloEvento[],
  nudges: Record<string, Interacao>,
  hoje: Date = new Date()
): ItemParaAcompanhar[] {
  const ativas = duplas.filter((d) => d.status === "ativa");

  // sem a lista de cronogramas, "cada cronograma ativo" é o das duplas
  // ativas — turma sem dupla ativa não gera "sem data" pra ninguém
  const vigentePorCronograma = new Map<string, EventoDatado | null>();
  for (const d of ativas) {
    if (d.trilha === "especialista" || d.cronograma_id == null) continue;
    if (!vigentePorCronograma.has(d.cronograma_id))
      vigentePorCronograma.set(
        d.cronograma_id,
        eventoDaSemana(eventosDoCronograma(eventos, d.cronograma_id), hoje)
      );
  }
  const semDataIds = new Set<string>();
  for (const vig of vigentePorCronograma.values())
    if (vig)
      // incluirNovas: a dupla formada depois da data oficial não "faltou",
      // mas o 1º agendamento dela é exatamente o que a fila precisa mostrar
      for (const d of duplasSemEncontroDoNumero(duplas, vig, true))
        semDataIds.add(d.id);

  const itens: ItemParaAcompanhar[] = [];
  for (const d of ativas) {
    const saude = saudadeDaDupla(d, eventos, hoje);
    const motivos = new Set<MotivoAcompanhar>();
    if (semDataIds.has(d.id)) motivos.add("sem_data");
    for (const s of saude.sinais)
      if (
        s.tipo === "atraso" ||
        s.tipo === "limbo" ||
        s.tipo === "registro_pendente"
      )
        motivos.add(s.tipo);
    if (!motivos.size) continue;

    const lista = [...motivos].sort(
      (a, b) => MOTIVO_ORDEM[a] - MOTIVO_ORDEM[b]
    );
    const n1 = primeiroNomeDaDupla(d) || "Jovem";
    const mentorNome = (
      d.mentor?.nome_social ??
      d.mentor?.nome ??
      ""
    ).split(/\s+/)[0];
    const ult = nudges[d.id];
    const ultimoNudge = ult?.tipo === "nudge" ? ult : null;
    itens.push({
      duplaId: d.id,
      nomes: mentorNome ? `${n1} · ${mentorNome}` : n1,
      turma: d.turma,
      saude,
      motivos: lista,
      contexto: contextoAcompanhar(
        d,
        saude,
        d.cronograma_id ? (vigentePorCronograma.get(d.cronograma_id) ?? null) : null,
        lista,
        hoje
      ),
      // "Lembrar registro" sempre que o caso exibido é registro_pendente —
      // mesma prioridade da tela (registro primeiro), não só quando é único
      rotuloLembrete: lista.includes("registro_pendente")
        ? "Lembrar registro"
        : "Lembrar",
      ultimoNudge,
      bloqueadoAte: lembreteBloqueadoAte(ultimoNudge, hoje),
    });
  }
  return itens.sort(
    (a, b) =>
      ORDEM_SEMAFORO[a.saude.semaforo] - ORDEM_SEMAFORO[b.saude.semaforo] ||
      comparaNome(a.nomes, b.nomes)
  );
}

// ---------- "Semana no programa" ----------

export type ItemPrograma = {
  id: string;
  /** "YYYY-MM-DD" pra renderizar o bloco de data. */
  diaKey: string;
  titulo: string;
  /** "19h · 13 duplas (cada dupla marca o seu)" / "10h–12h · Sede". */
  detalhe: string | null;
  tipo: "encontro_oficial" | "formacao" | "evento" | "supervisao";
  /** "turma 1" | "oficial" | "hoje" | "supervisão" — etiqueta da linha. */
  etiqueta: string;
  /** id do evento formacao pra ligar "Abrir chamada"; null nos demais. */
  eventoId: string | null;
};

/** Lista cronológica da semana corrente: todos os `ciclo_eventos` datados
 *  da semana (todos os cronogramas, encontros + formações + especiais) +
 *  supervisões registradas na semana. Chamada só aparece quando o evento
 *  é hoje (o componente decide com `diaKey === hoje`). */
export function itensDaSemanaPrograma(
  eventos: CicloEvento[],
  cronogramas: Cronograma[],
  supervisoes: {
    id: string;
    data: string;
    supervisor?: { nome: string } | null;
    mentor?: { nome: string } | null;
  }[],
  hoje: Date = new Date()
): ItemPrograma[] {
  const { seg, dom } = semanaBounds(hoje);
  const hojeStr = toDateStr(hoje);
  const turmaDo = new Map(cronogramas.map((c) => [c.id, c.turma]));
  const statusDo = new Map(cronogramas.map((c) => [c.id, c.status]));
  const itens: ItemPrograma[] = [];

  for (const ev of eventos) {
    if (ev.data == null || ev.data < seg || ev.data > dom) continue;
    // a semana é do programa ativo — evento de cronograma rascunho/encerrado
    // não entra; cronograma fora da lista passada não se julga aqui
    const st = statusDo.get(ev.cronograma_id);
    if (st != null && st !== "ativo") continue;
    const turma = turmaCurta(turmaDo.get(ev.cronograma_id));
    if (ev.tipo === "encontro") {
      itens.push({
        id: `ev-${ev.id}`,
        diaKey: ev.data,
        titulo:
          ev.numero != null
            ? `Encontro ${ev.numero} · ${turma || ev.titulo}`
            : ev.titulo,
        detalhe: ev.observacao,
        tipo: "encontro_oficial",
        etiqueta: turma ? `turma ${turma.replace(/^t/i, "")}` : "oficial",
        eventoId: null,
      });
    } else {
      itens.push({
        id: `ev-${ev.id}`,
        diaKey: ev.data,
        titulo: ev.titulo,
        detalhe: ev.observacao,
        tipo: ev.tipo === "formacao" ? "formacao" : "evento",
        etiqueta: "oficial",
        eventoId: ev.tipo === "formacao" ? ev.id : null,
      });
    }
  }

  for (const s of supervisoes) {
    if (s.data < seg || s.data > dom) continue;
    // o tipo do parâmetro é o subconjunto que a page lê; `resumo` existe na
    // Supervisao real e entra (truncado) quando presente
    const resumo = (s as { resumo?: string | null }).resumo;
    itens.push({
      id: `sup-${s.id}`,
      diaKey: s.data,
      titulo: `Supervisão · ${s.supervisor?.nome ?? "Auxiliar"} × ${s.mentor?.nome ?? "mentor"}`,
      detalhe: resumo ? trunca(resumo) : null,
      tipo: "supervisao",
      etiqueta: s.data === hojeStr ? "hoje" : "supervisão",
      eventoId: null,
    });
  }

  return itens.sort(
    (a, b) =>
      a.diaKey.localeCompare(b.diaKey) ||
      a.titulo.localeCompare(b.titulo, "pt-BR")
  );
}
