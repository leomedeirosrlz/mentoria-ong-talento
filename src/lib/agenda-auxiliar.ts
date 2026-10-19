import {
  ORDEM_SEMAFORO,
  TRILHA_LEN,
  comparaNome,
  cronogramasOpcoes,
  diaSemanaDe,
  duplasSemEncontroDoNumero,
  emLimbo,
  eventoDaSemana,
  eventosDoCronograma,
  linkSeguro,
  passoEsp,
  saudadeDaDupla,
  semanaBounds,
  toDateStr,
  type EventoDatado,
} from "./ciclo";
import { primeiroNomeDaDupla } from "./agenda-minha";
import type {
  CicloEvento,
  Cronograma,
  DiaSemana,
  Dupla,
  Encontro,
  Supervisao,
} from "./types";

// ============================================================
// WP5 — agenda do auxiliar executivo (role "supervisor")
// Puro, mesma disciplina de fuso do agenda-coordenacao.
// ============================================================

// ---------- helpers de texto (mesmos de agenda-coordenacao — locais pra
// não acoplar os dois módulos) ----------

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
const fmtHoraMin = new Intl.DateTimeFormat("pt-BR", {
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "America/Sao_Paulo",
});

/** "2026-10-07" → "qua" — âncora no meio-dia, convenção do ciclo. */
function dowCurto(iso: string): string {
  return DOW_CURTO[new Date(`${iso}T12:00:00`).getDay()];
}

/** "2026-10-07" → 7. */
function diaNum(iso: string): number {
  return Number(iso.slice(8, 10));
}

/** ISO instant → "19h" / "19h30" em São Paulo. */
function horaCurta(iso: string): string {
  return fmtHoraMin.format(new Date(iso)).replace(":", "h").replace(/h00$/, "h");
}

/** Pill curta da turma — "T1 · 2026/2027" → "T1". */
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

/** "terças 19h" do cabeçalho de turma — dow da data oficial + hora modal
 *  dos agendamentos das duplas pro número vigente (o evento é só data). */
function metaTurma(duplasAtivas: Dupla[], vig: EventoDatado | null): string {
  if (!vig) return "";
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
 *  em limbo ou realizado há >24h sem registro, menor número primeiro). */
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

/** Oficiais já vencidos na janela da dupla sem `realizado` correspondente —
 *  espelho do `faltantes` do semáforo (o detalhe "6º e 7º" do sinal atraso).
 *  Limbo conta como faltante aqui (tem row, não tem realizado); o semáforo
 *  já o tirou do `esperado`, então nem sempre faltantes.length == atraso. */
function encontrosFaltantes(d: Dupla, evs: CicloEvento[], hoje: Date): number[] {
  const hojeStr = toDateStr(hoje);
  return evs
    .filter(
      (e) =>
        e.tipo === "encontro" &&
        e.numero != null &&
        e.data != null &&
        e.data <= hojeStr &&
        (!d.iniciada_em || e.data >= d.iniciada_em) &&
        !d.encontros.some(
          (x) => x.numero === e.numero && x.status === "realizado"
        )
    )
    .map((e) => e.numero!)
    .sort((a, b) => a - b);
}

/** "3 e 4" / "3, 4 e 5" — lista de números em prosa. */
function juntaNums(nums: number[]): string {
  if (nums.length <= 1) return String(nums[0] ?? "");
  return `${nums.slice(0, -1).join(", ")} e ${nums[nums.length - 1]}`;
}

function trunca(s: string, n = 90): string {
  return s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s;
}

/** Grupo "Por turma" — as supervisionadas agrupadas por cronograma. */
export type TurmaGrupo = {
  cronogramaId: string | null;
  /** "T1" */
  turma: string;
  /** "Turma 1 · terças 19h · encontro 8 esta semana" — as partes prontas. */
  rotulo: string;
  encontroVigente: number | null;
  /** Duplas ativas+pausadas do cronograma, já na ordem de exibição. */
  duplas: Dupla[];
};

/** Agrupa as supervisionadas por cronograma (ordem dos cronogramas ativos;
 *  duplas sem cronograma caem num grupo "Sem turma" no fim — o componente
 *  re-rotula pra "Trilhas de especialista" quando o grupo é todo de
 *  trilhas, o que é quase sempre). */
export function duplasPorTurma(
  duplas: Dupla[],
  cronogramas: Cronograma[],
  eventos: CicloEvento[],
  hoje: Date = new Date()
): TurmaGrupo[] {
  const correndo = duplas.filter(
    (d) => d.status === "ativa" || d.status === "pausada"
  );
  // saúde pré-calculada — o sort dentro do grupo ordena semáforo → nome
  const saudeDe = new Map(
    correndo.map((d) => [d.id, saudadeDaDupla(d, eventos, hoje)])
  );
  const ordena = (ds: Dupla[]) =>
    [...ds].sort(
      (a, b) =>
        ORDEM_SEMAFORO[saudeDe.get(a.id)!.semaforo] -
          ORDEM_SEMAFORO[saudeDe.get(b.id)!.semaforo] ||
        comparaNome(
          primeiroNomeDaDupla(a) || a.mentorado?.nome || "",
          primeiroNomeDaDupla(b) || b.mentorado?.nome || ""
        )
    );

  const grupos: TurmaGrupo[] = [];
  const vistos = new Set<string>();
  for (const c of cronogramasOpcoes(
    cronogramas.filter((c) => c.status === "ativo")
  )) {
    const ds = correndo.filter((d) => d.cronograma_id === c.id);
    if (!ds.length) continue;
    for (const d of ds) vistos.add(d.id);
    const vig = eventoDaSemana(eventosDoCronograma(eventos, c.id), hoje);
    const curta = turmaCurta(c.turma).replace(/^t/i, "");
    // cronograma sem eventos/vigente → meta vazia, rótulo é só "Turma N"
    const meta = vig
      ? ` · ${metaTurma(ds.filter((d) => d.status === "ativa"), vig)}`
      : "";
    grupos.push({
      cronogramaId: c.id,
      turma: c.turma,
      rotulo: `Turma ${curta || c.turma}${meta}`,
      encontroVigente: vig?.numero ?? null,
      duplas: ordena(ds),
    });
  }
  const resto = correndo.filter((d) => !vistos.has(d.id));
  if (resto.length)
    grupos.push({
      cronogramaId: null,
      turma: "",
      rotulo: "Sem turma",
      encontroVigente: null,
      duplas: ordena(resto),
    });
  return grupos;
}

/** Item da aba "Consolidada" — lista única por dia. */
export type ItemConsolidado = {
  id: string;
  /** "YYYY-MM-DD" — agrupa nos subtítulos de dia. */
  diaKey: string;
  inicio: string;
  tipo: "supervisao" | "encontro" | "sessao_esp" | "oficial" | "a_agendar";
  /** "Ana Souza com André Lima" / "Formação de mentores". */
  titulo: string;
  detalhe: string | null;
  /** guest âmbar ("só acompanhamento") — sem ação pro auxiliar. */
  convidado: boolean;
  duplaId: string | null;
  /** "Você" pra supervisão própria; "T1"/"T2" pra encontro; "" senão. */
  pill: string;
  /** href do "Ver ficha" / destino principal. */
  href: string | null;
};

/** Consolidada: encontros das supervisionadas (semana + próxima) +
 *  supervisões que o auxiliar registrou na semana + eventos oficiais
 *  (convidado) + sessões esp das duplas visíveis (convidado) + encontros
 *  futuros do cronograma ainda sem data ("a_agendar", tracejado). */
export function itensConsolidados(
  duplas: Dupla[],
  supervisoes: Supervisao[],
  eventos: CicloEvento[],
  hoje: Date = new Date()
): ItemConsolidado[] {
  const { seg, dom } = semanaBounds(hoje);
  // semana corrente + próximos 7 dias → domingo da semana seguinte
  const fim = toDateStr(
    new Date(Date.parse(`${dom}T12:00:00Z`) + 7 * 86400000)
  );
  const naSemana = (dia: string) => dia >= seg && dia <= dom;
  const naJanela = (dia: string) => dia >= seg && dia <= fim;
  const itens: ItemConsolidado[] = [];

  for (const d of duplas) {
    const nomeJovem = primeiroNomeDaDupla(d) || "Jovem";
    const mentorNome = d.mentor?.nome ?? "mentor";
    const mentor1 = (
      d.mentor?.nome_social ??
      d.mentor?.nome ??
      ""
    ).split(/\s+/)[0];
    const esp = d.trilha === "especialista";
    for (const e of d.encontros) {
      const iso =
        e.status === "realizado"
          ? (e.realizado_em ?? e.data_hora)
          : e.data_hora;
      if (!iso) continue;
      const dia = toDateStr(new Date(iso));
      // agendados cobrem semana + próximos 7d; realizados só a semana
      // corrente (um "realizado" futuro não existe); falhas não entram
      if (e.status === "realizado") {
        if (!naSemana(dia)) continue;
      } else if (e.status === "agendado" || e.status === "remarcado") {
        if (!naJanela(dia)) continue;
      } else continue;
      itens.push({
        id: `enc-${e.id}`,
        diaKey: dia,
        inicio: iso,
        tipo: esp ? "sessao_esp" : "encontro",
        titulo: esp
          ? `${nomeJovem} × ${mentorNome}${d.demanda ? ` — ${d.demanda}` : ""}`
          : `${nomeJovem} com ${mentor1 || "mentor"}`,
        detalhe: esp
          ? `Trilha de especialista · sessão ${passoEsp(e, d.encontros)} de ${TRILHA_LEN.especialista}`
          : `Encontro ${e.numero} · ${d.turma}`,
        convidado: esp,
        duplaId: d.id,
        pill: esp ? "Esp" : turmaCurta(d.turma),
        href: `/duplas/${d.id}`,
      });
    }
  }

  for (const s of supervisoes) {
    if (!naSemana(s.data)) continue;
    itens.push({
      id: `sup-${s.id}`,
      diaKey: s.data,
      inicio: s.data,
      tipo: "supervisao",
      titulo: `Supervisão · ${s.supervisor?.nome ?? "Auxiliar"} × ${s.mentor?.nome ?? "mentor"}`,
      detalhe: s.resumo ? trunca(s.resumo) : null,
      convidado: false,
      duplaId: s.dupla_id,
      pill: "Você",
      href: s.dupla_id ? `/duplas/${s.dupla_id}` : null,
    });
  }

  // eventos oficiais fora do eixo encontro-a-encontro — o auxiliar é
  // convidado (formação, encerramento, recesso datado)
  for (const ev of eventos) {
    if (ev.tipo === "encontro" || ev.data == null || !naJanela(ev.data))
      continue;
    itens.push({
      id: `of-${ev.id}`,
      diaKey: ev.data,
      inicio: ev.data,
      tipo: "oficial",
      titulo: ev.titulo,
      detalhe: ev.observacao,
      convidado: true,
      duplaId: null,
      pill: "",
      href: null,
    });
  }

  // item sintético por dupla sem row do encontro VIGENTE do cronograma —
  // só o vigente importa (oficiais de semanas futuras ainda não são prazo)
  const vigentes = new Map<string, EventoDatado>();
  for (const ev of eventos) {
    if (ev.tipo !== "encontro" || vigentes.has(ev.cronograma_id)) continue;
    const vig = eventoDaSemana(
      eventosDoCronograma(eventos, ev.cronograma_id),
      hoje
    );
    if (vig) vigentes.set(ev.cronograma_id, vig);
  }
  for (const vig of vigentes.values()) {
    if (!naJanela(vig.data)) continue;
    // incluirNovas: dupla formada depois da data oficial também precisa do
    // 1º agendamento — sem a flag ela não aparece pra quem supervisiona
    for (const d of duplasSemEncontroDoNumero(duplas, vig, true)) {
      const nome1 = primeiroNomeDaDupla(d) || "Jovem";
      const nova = !!d.iniciada_em && d.iniciada_em > vig.data!;
      itens.push({
        id: `ag-${d.id}-${vig.numero}`,
        diaKey: vig.data,
        inicio: vig.data,
        tipo: "a_agendar",
        titulo: nova ? `enc. ${vig.numero} — dupla nova, a agendar` : `enc. ${vig.numero} a agendar`,
        detalhe: `${nome1} com ${d.mentor?.nome ?? "mentor"} · ${d.turma}`,
        convidado: false,
        duplaId: d.id,
        pill: turmaCurta(d.turma),
        href: `/duplas/${d.id}`,
      });
    }
  }

  return itens.sort(
    (a, b) =>
      Date.parse(a.inicio) - Date.parse(b.inicio) ||
      a.titulo.localeCompare(b.titulo, "pt-BR")
  );
}

/** Linha de contexto do card da dupla (aba Por turma):
 *  "Encontro 8 · T1 — hoje, 19h, online. Próximo: enc. 9 em ter 14." ou
 *  "sem encontro agendado" / "atrasado (1 encontro)" em tom de problema. */
export function contextoDuplaAux(
  dupla: Dupla,
  eventos: CicloEvento[],
  hoje: Date = new Date()
): { texto: string; problema: boolean } {
  // o caller já passa o recorte do cronograma; refiltrar é idempotente
  const evs = eventosDoCronograma(eventos, dupla.cronograma_id);
  const saude = saudadeDaDupla(dupla, evs, hoje);
  if (dupla.status !== "ativa")
    return { texto: saude.motivo, problema: false };

  const turma = dupla.turma;
  const rotuloEnc = dupla.trilha === "especialista" ? "Sessão" : "Encontro";
  const tag = (n: number) => `${rotuloEnc} ${n}${turma ? ` · ${turma}` : ""}`;
  const agoraMs = hoje.getTime();
  const vig = eventoDaSemana(evs, hoje);
  const pend = pendenciaDeRegistro(dupla, agoraMs);
  const atraso = Math.max(0, saude.esperado - saude.feitos);
  const prox = saude.proximo;
  const semData =
    vig?.numero != null &&
    (!dupla.iniciada_em || dupla.iniciada_em <= vig.data) &&
    !dupla.encontros.some((e) => e.numero === vig.numero);
  const pendTxt = (p: Encontro) =>
    p.status === "agendado"
      ? `O ${p.numero}º agendado passou sem registro.`
      : `Registro do encontro ${p.numero} pendente.`;

  // atraso domina a linha — "Encontros 3 e 4 · T2 atrasados (2 encontros)"
  if (atraso > 0) {
    const falt = encontrosFaltantes(dupla, evs, hoje);
    const nums = falt.length === atraso ? falt : [];
    const lead =
      atraso === 1
        ? `${tag(nums[0] ?? falt[0] ?? vig?.numero ?? saude.esperado)} atrasado`
        : `Encontros ${juntaNums(nums)}${turma ? ` · ${turma}` : ""} atrasados`;
    const tail =
      pend?.status === "agendado"
        ? `o ${pend.numero}º agendado já passou sem registro`
        : prox?.data_hora
          ? `o ${prox.numero}º está agendado para ${quandoTxt(prox.data_hora, hoje)}`
          : vig?.numero != null
            ? `sem encontro agendado para o ${vig.numero}`
            : "sem encontro agendado";
    return {
      texto: `${lead} (${atraso} ${atraso === 1 ? "encontro" : "encontros"}) — ${tail}.`,
      problema: true,
    };
  }

  // limbo: agendado vencido sem registro — "rolou?" antes de cobrar data
  if (pend?.status === "agendado")
    return {
      texto:
        `${tag(pend.numero)} — agendado já passou e segue sem registro (rolou?).` +
        (semData && vig?.numero != null
          ? ` E o ${vig.numero}º ainda não tem data.`
          : ""),
      problema: true,
    };

  if (semData && vig?.numero != null) {
    const { dom } = semanaBounds(new Date(`${vig.data}T12:00:00Z`));
    const { seg, dom: domCorrente } = semanaBounds(hoje);
    const nestaSemana = vig.data >= seg && vig.data <= domCorrente;
    return {
      texto:
        `${tag(vig.numero)} — sem encontro agendado${
          nestaSemana ? " nesta semana" : ""
        } (prazo: ${dowCurto(dom)} ${diaNum(dom)}).` +
        (pend ? ` ${pendTxt(pend)}` : ""),
      problema: true,
    };
  }

  // em dia: próximo agendado (com "Próximo previsto" do calendário) ou o
  // vigente já realizado — e a pendência de registro como fecho quando há
  let t: string;
  if (prox?.data_hora) {
    t = `${tag(prox.numero)} — ${quandoTxt(prox.data_hora, hoje)}${linkSeguro(prox.link) ? ", online" : ""}.`;
    const proxEv = evs
      .filter(
        (e): e is EventoDatado =>
          e.tipo === "encontro" &&
          e.data != null &&
          e.numero != null &&
          e.numero > prox.numero
      )
      .sort((a, b) => a.ordem - b.ordem)[0];
    if (proxEv)
      t += ` Próximo previsto: enc. ${proxEv.numero} em ${dowCurto(proxEv.data)} ${diaNum(proxEv.data)}.`;
  } else if (vig?.numero != null) {
    const rowVig = dupla.encontros.find((e) => e.numero === vig.numero);
    t =
      rowVig?.status === "realizado"
        ? `${tag(vig.numero)} — realizado.`
        : `${tag(vig.numero)} — previsto para ${dowCurto(vig.data)} ${diaNum(vig.data)}.`;
  } else {
    t = saude.motivo;
  }
  if (pend) t += ` ${pendTxt(pend)}`;
  return { texto: t, problema: false };
}
