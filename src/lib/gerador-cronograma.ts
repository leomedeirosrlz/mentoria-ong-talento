// Gerador e validação de cronogramas (REALIZA-103) — módulo puro, sem I/O.
//
// O wizard de /turmas/novo materializa o calendário oficial de uma turma a
// partir de parâmetros (1º encontro, cadência, exceções) + o conteúdo do guia
// DPP ou de um cronograma existente. O resultado é uma lista de rascunhos que
// a coordenação revisa/ajusta antes de gravar — cada rascunho vira uma row de
// ciclo_eventos com `ordem` explícita (a sequência do PDF, não da data: etapa
// de preparação concluída pode ficar sem data e ainda assim vem primeiro).
//
// As regras de validação espelham os CHECKs da 0062 — o banco é a última
// palavra, mas validar aqui devolve mensagem útil em vez de erro genérico.

import type { CicloEvento } from "./types";

export type TipoEvento = CicloEvento["tipo"];

/** Rascunho de evento do cronograma — a row de ciclo_eventos sem as colunas
 *  que o banco preenche (id, cronograma_id) e sem `ordem` (a posição no array
 *  vira a ordem na gravação). */
export type EventoRascunho = {
  tipo: TipoEvento;
  /** Nº do encontro oficial — só faz sentido em tipo=encontro. */
  numero: number | null;
  /** "YYYY-MM-DD"; null só vale em etapa_preparacao concluída (CHECK 0062). */
  data: string | null;
  /** Fim de período — exige `data`; usado por etapas e recessos. */
  data_fim: string | null;
  titulo: string;
  /** Fase do guia — só encontros carregam (o currículo é deles). */
  fase: string | null;
  instrumentos: string[];
  /** 'concluida' só tem efeito em etapa_preparacao (marco entregue). */
  status: "pendente" | "concluida";
  observacao: string | null;
};

export const TIPO_EVENTO_LABEL: Record<TipoEvento, string> = {
  etapa_preparacao: "Etapa de preparação",
  encontro: "Encontro",
  recesso: "Recesso",
  formacao: "Formação",
  evento_encerramento: "Encerramento",
};

/** As fases do guia DPP, na ordem do percurso — sugestões do campo "Fase". */
export const FASES_DPP = [
  "Criar vínculo e construir o PDM",
  "Colocar o plano em prática",
  "Consolidar a autonomia",
  "Aprofundar o vínculo e o aprendizado",
  "Roda da Vida",
  "Encerrar e celebrar",
] as const;

type ConteudoEncontro = Pick<
  EventoRascunho,
  "titulo" | "fase" | "instrumentos" | "observacao"
>;

/** Conteúdo oficial dos 16 encontros do guia DPP — verbatim do seed.sql
 *  (fonte: cronograma oficial "Mentoria · Plataforma Juventude Solidária"). */
export const ENCONTROS_DPP_OFICIAL: ConteudoEncontro[] = [
  { titulo: "Boas-vindas, histórias de vida e abertura", fase: FASES_DPP[0],
    instrumentos: ["Perguntas Eficazes", "Escuta Ativa", "PDM", "Roda da Vida (leitura inicial)"],
    observacao: "Reposição na mesma semana" },
  { titulo: "Avaliação por terceiros e visão de futuro", fase: FASES_DPP[0],
    instrumentos: ["PDM", "Construindo a sua Visão"], observacao: null },
  { titulo: "Declaração de Visão e metas SMART", fase: FASES_DPP[0],
    instrumentos: ["PDM", "Modelo SMART"], observacao: null },
  { titulo: "Fechamento da construção do PDM", fase: FASES_DPP[0],
    instrumentos: ["PDM", "Perguntas Eficazes"], observacao: null },
  { titulo: "Acompanhamento das primeiras submetas", fase: FASES_DPP[1],
    instrumentos: ["PDM", "Feedback Construtivo"], observacao: null },
  { titulo: "Superação de obstáculos", fase: FASES_DPP[1],
    instrumentos: ["PDM", "Feedback Construtivo"], observacao: null },
  { titulo: "Ajustes de prazos e desdobramentos", fase: FASES_DPP[1],
    instrumentos: ["PDM", "Feedback Construtivo"], observacao: null },
  { titulo: "Monitoramento e responsabilidade", fase: FASES_DPP[2],
    instrumentos: ["PDM", "Escuta Ativa"], observacao: null },
  { titulo: "Revisão de meio de percurso", fase: FASES_DPP[2],
    instrumentos: ["PDM", "Escuta Ativa"], observacao: null },
  { titulo: "O mentor como espelho", fase: FASES_DPP[3],
    instrumentos: ["Papel de modelo", "Escuta Ativa"], observacao: null },
  { titulo: "Rede de apoio e novos espaços", fase: FASES_DPP[3],
    instrumentos: ["Papel de modelo", "Escuta Ativa"], observacao: null },
  { titulo: "Aplicação e leitura da Roda da Vida", fase: FASES_DPP[4],
    instrumentos: ["Roda da Vida", "Modelo SMART"], observacao: null },
  { titulo: "Metas das áreas prioritárias", fase: FASES_DPP[4],
    instrumentos: ["Roda da Vida", "Modelo SMART"], observacao: null },
  { titulo: "Desdobramento e plano de continuidade", fase: FASES_DPP[4],
    instrumentos: ["Roda da Vida", "Modelo SMART"], observacao: null },
  { titulo: "Reflexão e reconhecimento", fase: FASES_DPP[5],
    instrumentos: ["PDM", "Roda da Vida"], observacao: null },
  { titulo: "Encerramento e celebração", fase: FASES_DPP[5],
    instrumentos: ["Avaliação 360º", "Autoavaliação do mentor"], observacao: null },
];

// ---------- datas ----------

export const ISO_DATA = /^\d{4}-\d{2}-\d{2}$/;

/** "YYYY-MM-DD" válido de calendário (regex + componentes batem — 31/02 não
 *  passa). Devolve o Date ancorado no meio-dia pra nenhuma virada de fuso
 *  deslocar o dia. */
function parseData(iso: string): Date | null {
  if (!ISO_DATA.test(iso)) return null;
  const d = new Date(`${iso}T12:00:00`);
  if (isNaN(d.getTime())) return null;
  if (`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}` !== iso)
    return null;
  return d;
}

export function dataIsoOk(iso: string | null | undefined): iso is string {
  return iso != null && parseData(iso) != null;
}

const DIA_MS = 24 * 3600 * 1000;

function addDias(iso: string, n: number): string {
  const d = parseData(iso)!;
  return paraIso(new Date(d.getTime() + n * DIA_MS));
}

function paraIso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Primeiro `diaSemana` (0=dom…6=sáb) estritamente depois de `iso` — a
 *  retomada pós-recesso do PDF ("1ª terça de janeiro"). */
function proximoDiaSemana(iso: string, diaSemana: number): string {
  const d = parseData(iso)!;
  const delta = ((diaSemana - d.getDay()) % 7 + 7) % 7 || 7;
  return paraIso(new Date(d.getTime() + delta * DIA_MS));
}

// ---------- configuração ----------

/** Intervalo explícito entre o encontro N e o N+1, em dias — sobrescreve a
 *  cadência (a folga de 15 dias do 8º→9º da T1 é {apos:8, dias:14}; a quinta
 *  de sessão dupla da T2 é {apos:5, dias:2} seguida de {apos:6, dias:5}). */
export type IntervaloEncontro = { apos: number; dias: number };

/** Recesso materializado na sequência — fica entre o encontro `apos` e o
 *  seguinte; sem intervalo explícito o próximo encontro cai no primeiro
 *  dia-da-semana depois do fim. */
export type RecessoEntrada = {
  apos: number;
  inicio: string;
  fim: string;
  titulo?: string;
  observacao?: string;
};

export type ConfigGerador = {
  /** "YYYY-MM-DD" do 1º encontro — também define o dia da semana do ciclo. */
  primeiroEncontro: string;
  /** Encontros oficiais da trilha — default 16 (DPP canônico). */
  totalEncontros?: number;
  /** Cadência base em dias — default 7 (semanal). */
  cadenciaDias?: number;
  intervalos?: IntervaloEncontro[];
  recessos?: RecessoEntrada[];
  /** Conteúdo dos encontros: guia oficial, cópia de outro cronograma ou
   *  títulos genéricos ("Encontro N"). */
  conteudo?:
    | { fonte: "guia_dpp" }
    | { fonte: "copiar"; encontros: (ConteudoEncontro & { numero?: number | null })[] }
    | { fonte: "vazio" };
  /** Etapas de pré-ciclo do guia (5 etapas + 2 formações) — default true. */
  preparacao?: boolean;
  /** Evento de encerramento 3 dias após o último encontro — default true. */
  encerramento?: boolean;
};

const TOTAL_MAX = 30;

function conteudoDoEncontro(
  n: number,
  conteudo: NonNullable<ConfigGerador["conteudo"]>
): ConteudoEncontro {
  if (conteudo.fonte === "guia_dpp") {
    const oficial = ENCONTROS_DPP_OFICIAL[n - 1];
    if (oficial) return oficial;
  } else if (conteudo.fonte === "copiar") {
    // o nº é a identidade do encontro — casa por numero; fonte sem o nº
    // (cronograma mais curto) cai no rótulo genérico
    const fonte = conteudo.encontros.find((e) => e.numero === n);
    if (fonte)
      return {
        titulo: fonte.titulo,
        fase: fonte.fase,
        instrumentos: [...fonte.instrumentos],
        observacao: fonte.observacao,
      };
  }
  return { titulo: `Encontro ${n}`, fase: null, instrumentos: [], observacao: null };
}

/** Materializa o calendário: preparação → encontros (+recessos intercalados)
 *  → encerramento, já na sequência do PDF (ordem = índice + 1 na gravação).
 *  Datas derivam do 1º encontro; etapas/formações usam os offsets do guia. */
export function gerarEventos(
  cfg: ConfigGerador
): { eventos: EventoRascunho[] } | { error: string } {
  const total = cfg.totalEncontros ?? 16;
  const cadencia = cfg.cadenciaDias ?? 7;
  const conteudo = cfg.conteudo ?? { fonte: "guia_dpp" };

  const d1 = parseData(cfg.primeiroEncontro);
  if (!d1) return { error: "Informe a data do 1º encontro." };
  if (!Number.isInteger(total) || total < 1 || total > TOTAL_MAX)
    return { error: `O número de encontros precisa ser entre 1 e ${TOTAL_MAX}.` };
  if (!Number.isInteger(cadencia) || cadencia < 1 || cadencia > 28)
    return { error: "A cadência padrão precisa ser entre 1 e 28 dias." };

  const intervalos = new Map<number, number>();
  for (const iv of cfg.intervalos ?? []) {
    if (!Number.isInteger(iv.apos) || iv.apos < 1 || iv.apos >= total)
      return { error: `Intervalo inválido: "após o encontro ${iv.apos}".` };
    if (!Number.isInteger(iv.dias) || iv.dias < 1 || iv.dias > 90)
      return { error: "O intervalo excepcional precisa ser entre 1 e 90 dias." };
    if (intervalos.has(iv.apos))
      return { error: `Há dois intervalos após o encontro ${iv.apos}.` };
    intervalos.set(iv.apos, iv.dias);
  }

  const recessos = new Map<number, RecessoEntrada>();
  for (const r of cfg.recessos ?? []) {
    if (!Number.isInteger(r.apos) || r.apos < 1 || r.apos >= total)
      return { error: `O recesso precisa ficar após um encontro de 1 a ${total - 1}.` };
    if (!dataIsoOk(r.inicio)) return { error: "Confira o início do recesso." };
    if (!dataIsoOk(r.fim)) return { error: "Confira o fim do recesso." };
    if (r.fim < r.inicio)
      return { error: "O recesso termina antes de começar." };
    if (recessos.has(r.apos))
      return { error: `Há dois recessos após o encontro ${r.apos}.` };
    recessos.set(r.apos, r);
  }

  const diaSemana = d1.getDay();

  // datas dos encontros — cadeia a partir do 1º; recesso desloca pro
  // primeiro dia-da-semana depois do fim (a "retomada" do PDF)
  const datas: string[] = ["", cfg.primeiroEncontro]; // índice = nº do encontro
  for (let n = 2; n <= total; n++) {
    const intervalo = intervalos.get(n - 1);
    const recesso = recessos.get(n - 1);
    if (intervalo != null) {
      datas[n] = addDias(datas[n - 1], intervalo);
    } else if (recesso) {
      const retomada = proximoDiaSemana(recesso.fim, diaSemana);
      datas[n] = retomada <= datas[n - 1] ? addDias(retomada, 7) : retomada;
    } else {
      datas[n] = addDias(datas[n - 1], cadencia);
    }
  }

  const eventos: EventoRascunho[] = [];
  const push = (e: EventoRascunho) => eventos.push(normalizaEvento(e));

  // seção 1 — preparação (offsets do PDF em relação ao 1º encontro):
  // inscrições −40→−20d · triagem/matching −19→−6d · onboarding de mentores
  // −5→−4d com as duas sessões de formação dentro da janela · onboarding de
  // mentorados −4d · marco "Início" no dia do 1º encontro.
  if (cfg.preparacao ?? true) {
    const ini = cfg.primeiroEncontro;
    push({ tipo: "etapa_preparacao", numero: null, data: addDias(ini, -40),
      data_fim: addDias(ini, -20), titulo: "Inscrições", fase: null,
      instrumentos: [], status: "pendente", observacao: null });
    push({ tipo: "etapa_preparacao", numero: null, data: addDias(ini, -19),
      data_fim: addDias(ini, -6), titulo: "Triagem e matching", fase: null,
      instrumentos: [], status: "pendente", observacao: null });
    push({ tipo: "etapa_preparacao", numero: null, data: addDias(ini, -5),
      data_fim: addDias(ini, -4), titulo: "Onboarding de mentores", fase: null,
      instrumentos: [], status: "pendente", observacao: null });
    push({ tipo: "formacao", numero: null, data: addDias(ini, -5),
      data_fim: null, titulo: "Encontro inicial de formação de mentores",
      fase: null, instrumentos: [], status: "pendente", observacao:
      "Apresentação do programa, cronograma, guias, termo de voluntariado e cadastro na plataforma" });
    push({ tipo: "formacao", numero: null, data: addDias(ini, -4),
      data_fim: null, titulo: "Encontro final de formação de mentores",
      fase: null, instrumentos: [], status: "pendente",
      observacao: "Tira-dúvidas e considerações finais" });
    push({ tipo: "etapa_preparacao", numero: null, data: addDias(ini, -4),
      data_fim: null, titulo: "Onboarding de mentorados", fase: null,
      instrumentos: [], status: "pendente",
      observacao: "Encontro de abertura com a coordenação" });
    push({ tipo: "etapa_preparacao", numero: null, data: ini, data_fim: null,
      titulo: "Início", fase: null, instrumentos: [], status: "pendente",
      observacao: null });
  }

  // seção 2 — mentoria ativa: encontros numerados + recessos na posição
  for (let n = 1; n <= total; n++) {
    const c = conteudoDoEncontro(n, conteudo);
    push({ tipo: "encontro", numero: n, data: datas[n], data_fim: null,
      titulo: c.titulo, fase: c.fase, instrumentos: c.instrumentos,
      status: "pendente", observacao: c.observacao });
    const recesso = recessos.get(n);
    if (recesso)
      push({ tipo: "recesso", numero: null, data: recesso.inicio,
        data_fim: recesso.fim, titulo: recesso.titulo?.trim() || "Recesso",
        fase: null, instrumentos: [], status: "pendente",
        observacao: recesso.observacao?.trim() || null });
  }

  // seção 3 — encerramento: o PDF marca o evento ~3 dias após o 16º encontro
  if (cfg.encerramento ?? true)
    push({ tipo: "evento_encerramento", numero: null,
      data: addDias(datas[total], 3), data_fim: null,
      titulo: "Evento de encerramento do programa", fase: null,
      instrumentos: [], status: "pendente", observacao: null });

  return { eventos };
}

// ---------- normalização e validação ----------

/** Coerção pelo tipo: nº só existe em encontro; fase/instrumentos idem;
 *  status ≠ pendente só em etapa; data_fim some sem data. Roda no submit do
 *  dialog e na saída do gerador — o caller não precisa conhecer as regras. */
export function normalizaEvento(e: EventoRascunho): EventoRascunho {
  const encontro = e.tipo === "encontro";
  const etapa = e.tipo === "etapa_preparacao";
  return {
    tipo: e.tipo,
    numero: encontro ? e.numero : null,
    data: e.data,
    data_fim: e.data ? e.data_fim : null,
    titulo: e.titulo.trim(),
    fase: encontro ? e.fase?.trim() || null : null,
    instrumentos: encontro ? e.instrumentos.map((i) => i.trim()).filter(Boolean) : [],
    status: etapa ? e.status : "pendente",
    observacao: e.observacao?.trim() || null,
  };
}

/** Validação de um rascunho — espelha os CHECKs da 0062 com mensagens de UI. */
export function validaEvento(e: EventoRascunho): string | null {
  const tipos: TipoEvento[] = [
    "etapa_preparacao",
    "encontro",
    "recesso",
    "formacao",
    "evento_encerramento",
  ];
  if (!tipos.includes(e.tipo)) return "Tipo de evento inválido.";
  if (e.titulo.trim().length < 3 || e.titulo.trim().length > 160)
    return "O título precisa ter entre 3 e 160 caracteres.";
  if (e.tipo === "encontro") {
    if (!Number.isInteger(e.numero) || (e.numero ?? 0) < 1)
      return "Encontro oficial precisa de um número válido.";
  } else if (e.numero != null) {
    return "Só encontros oficiais têm número.";
  }
  if (e.status !== "pendente" && e.status !== "concluida")
    return "Status inválido.";
  if (e.data != null && !dataIsoOk(e.data)) return "Confira a data do evento.";
  // data null só vale pra etapa já entregue (CHECK ciclo_eventos_data_check)
  if (e.data == null && !(e.tipo === "etapa_preparacao" && e.status === "concluida"))
    return "Só uma etapa de preparação concluída pode ficar sem data.";
  if (e.data_fim != null) {
    if (e.data == null) return "O fim do período precisa de uma data de início.";
    if (!dataIsoOk(e.data_fim)) return "Confira o fim do período.";
    if (e.data_fim < e.data) return "O período termina antes de começar.";
  }
  if (e.observacao != null && e.observacao.length > 300)
    return "A observação passa de 300 caracteres.";
  if (e.fase != null && e.fase.length > 120)
    return "A fase passa de 120 caracteres.";
  if (e.instrumentos.length > 10 || e.instrumentos.some((i) => i.length > 60))
    return "Revise os instrumentos (até 10, de no máx. 60 caracteres).";
  return null;
}

/** Validação da lista inteira — além das regras por evento, a identidade
 *  (cronograma, numero) exige nºs de encontro únicos e a trilha precisa de
 *  ao menos 1 encontro pra ser calendário. */
export function validaEventos(eventos: EventoRascunho[]): string | null {
  if (!eventos.length) return "O cronograma precisa de pelo menos um evento.";
  const numeros = new Set<number>();
  let encontros = 0;
  for (let i = 0; i < eventos.length; i++) {
    const e = eventos[i];
    const erro = validaEvento(e);
    if (erro) return `Item ${i + 1} (“${e.titulo.slice(0, 40)}…”): ${erro}`;
    if (e.tipo === "encontro") {
      encontros++;
      if (numeros.has(e.numero!))
        return `Há dois encontros com o número ${e.numero}.`;
      numeros.add(e.numero!);
    }
  }
  if (!encontros)
    return "O cronograma precisa de pelo menos um encontro oficial.";
  return null;
}

/** Campos derivados do cronograma (0061 backfill usa a mesma conta):
 *  início = 1ª data com evento; fim = último data/data_fim; esperados =
 *  contagem de rows tipo=encontro. Recalculado a cada mutação de evento. */
export function totaisCronograma(
  eventos: Pick<EventoRascunho, "tipo" | "data" | "data_fim">[]
): { inicio_em: string | null; fim_em: string | null; encontros_esperados: number } {
  let inicio: string | null = null;
  let fim: string | null = null;
  let esperados = 0;
  for (const e of eventos) {
    if (e.tipo === "encontro") esperados++;
    if (e.data != null) {
      if (inicio == null || e.data < inicio) inicio = e.data;
      if (fim == null || e.data > fim) fim = e.data;
    }
    if (e.data_fim != null && (fim == null || e.data_fim > fim)) fim = e.data_fim;
  }
  return { inicio_em: inicio, fim_em: fim, encontros_esperados: esperados };
}
