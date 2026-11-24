/** Derivação pura da aba "Minha agenda" do mentor DPP (WP3 — mock v6):
 *  transforma duplas + trilhas de especialista dos jovens +
 *  calendário oficial na lista cronológica Hoje/Amanhã/Próximos, nos avisos
 *  de pendência no topo do dia e no rail (resumo da semana + semáforo das
 *  duplas). Sem JSX e sem efeitos — a tela só desenha. `hoje` e `agora`
 *  chegam por parâmetro pra derivação ser determinística e testável. */

import {
  alvoAgendamento,
  cobertosDaDupla,
  emLimbo,
  encontroTemConteudo,
  eventosDoCronograma,
  formatDiaHora,
  formatDiaSemana,
  formatDiaMes,
  linkSeguro,
  ORDEM_SEMAFORO,
  passoEsp,
  registroTemConteudo,
  saudadeDaDupla,
  semanaBounds,
  toDateStr,
  TRILHA_LEN,
  type DuplaSaude,
} from "./ciclo";
import type {
  CicloEvento,
  Cronograma,
  Dupla,
  Encontro,
  EncontroStatus,
  TrilhaJovem,
} from "./types";
import { turmaLonga } from "./turma";

// ---------- escopo ----------

/** Identidade de um chip de escopo: "eu" (formação do mentor) ou
 *  `dupla:{id}` (encontros, sessões do jovem e eventos oficiais da turma).
 *  "tudo" existe só como filtro selecionado — nenhum item nasce nele. */
export type EscopoId = "eu" | `dupla:${string}`;
export type EscopoAgenda = "tudo" | EscopoId;

export type ChipEscopo = { id: EscopoAgenda; rotulo: string };

// ---------- item ----------

export type AgendaItemTipo =
  | "encontro"    // linha real da dupla (agendado/remarcado/realizado/não aconteceu)
  | "sessao_esp"  // sessão da trilha de especialista do jovem — convidado
  | "programa"    // evento oficial do cronograma (formação, encerramento…)
  | "a_agendar";  // passo oficial ainda sem row — a dupla agenda

export type AgendaAcaoTipo =
  | "entrar"    // chamada acontecendo agora + link válido
  | "registrar" // deep-link pra ficha (#registrar-{encontroId})
  | "remarcar"  // AgendarEncontroDialog com `atual` = a row
  | "agendar";  // AgendarEncontroDialog sem row (passo previsto)

export type AgendaTom = "ok" | "warn" | "danger" | "info" | "muted";

/** Carimbo do item que veio do calendário oficial — alimenta o merge da
 *  visão "tudo": o MESMO evento (mesmo título/data/observação) aparece uma
 *  vez por dupla/turma porque a agenda é por par; o chip Tudo funde num
 *  item só ("Turmas 1 e 2", "agenda de Bia e Caio"). `chave` é o que liga
 *  os irmãos — eventos distintos com local/hora própria não fundem. */
export type OficialRef = {
  chave: string;
  /** Rótulo sem turma — "Evento oficial do ciclo", "Formação de mentores". */
  base: string;
  /** Turma no rótulo (evento do ciclo, recesso) ou na meta (formação). */
  turmaNoRotulo: boolean;
  turmas: string[];
  jovens: string[];
  /** Sufixo da tag convidado — "evento oficial"; null quando não é dela. */
  notaTipo: string | null;
};

export type AgendaItem = {
  id: string;
  escopo: EscopoId;
  tipo: AgendaItemTipo;
  /** "YYYY-MM-DD" do item — null = previsto sem data oficial (cai no grupo
   *  "a agendar" no fim de Próximos). */
  dia: string | null;
  /** epoch ms pra ordenação dentro do dia; null ordena depois dos horários. */
  ts: number | null;
  hora: string | null; // "19:00"
  fim: string | null;  // "20:00" = início + duracao_min
  /** Linha de classificação: "Encontro 8 · 2026/2027" — nº nunca sai sem a turma. */
  rotulo: string;
  titulo: string;
  /** Label honesto do status ("agendado", "não aconteceu"…); null em previsto. */
  estado: string | null;
  /** Linhas de contexto (quem conduz, motivo da remarcação, tema da trilha…). */
  meta: string[];
  tom: AgendaTom | null;
  /** Item é da agenda de outra pessoa (sessão esp / evento do jovem). */
  convidado: boolean;
  /** Texto da tag de escopo — "agenda de Ana — você não participa". */
  notaConvidado: string | null;
  duplaId: string | null;
  encontro: Encontro | null;
  /** Nº do passo DPP — alimenta o AgendarEncontroDialog do "a agendar". */
  numero: number | null;
  /** Data oficial sugerida (YYYY-MM-DD) pro passo previsto. */
  sugeridoDia: string | null;
  /** CicloEvento.id quando o item veio do calendário oficial — a contagem da
   *  semana dedup por ele (um encerramento rende um item por dupla, mas é
   *  o MESMO evento). */
  eventoId: string | null;
  /** Link da chamada já validado por linkSeguro; null quando não há/inseguro. */
  link: string | null;
  acoes: AgendaAcaoTipo[];
  /** Programa oficial — só itens do calendário do ciclo o carregam. */
  oficial: OficialRef | null;
};

// ---------- aviso (warnrow do topo do "Hoje") ----------

export type AvisoAgenda = {
  id: string;
  escopo: EscopoId;
  duplaId: string;
  /** A row do encontro quando a pendência é de registro/limbo — o componente
   *  usa pra montar o "Remarcar" com o AgendarEncontroDialog existente. */
  encontro: Encontro | null;
  titulo: string;
  detalhe: string;
  href: string;
  /** Rótulo do botão do aviso — "Preencher registro" pra pendência de
   *  registro, "Resolver combinado" pra encaminhamento vencido (o href é o
   *  mesmo destino, o verbo é o que muda). */
  cta: string;
  /** Limbo (agendado vencido): além de registrar, a dupla pode remarcar. */
  remarcar: boolean;
};

// ---------- seções ----------

export type AgendaGrupo = {
  /** null = o grupo "a agendar" sem data — sempre o último de Próximos. */
  dia: string | null;
  /** null quando a seção inteira é um dia só (Hoje/Amanhã já nomeiam). */
  rotulo: string | null;
  itens: AgendaItem[];
};

export type AgendaSecao = {
  id: "hoje" | "amanha" | "proximos";
  titulo: string;
  /** "terça-feira, 7 de outubro" sob o título de seção de dia único. */
  sub: string | null;
  grupos: AgendaGrupo[];
};

// ---------- rail ----------

export type ResumoSemana = {
  /** Bounds seg–dom ("YYYY-MM-DD") da semana que contém `hoje`. */
  seg: string;
  dom: string;
  encontros: number;
  realizados: number;
  /** "ter 19h (2026/2027), qua 19h (2026/2028)" — compacto, máx. 3. */
  encontrosDetalhe: string | null;
  sessoesEsp: number;
  sessoesEspDetalhe: string | null;
  programas: number;
  /** Avisos abertos — mesma conta dos warnrows, pra não discordar da lista. */
  pendencias: number;
};

export type DuplaResumo = {
  id: string;
  nome: string;
  primeiroNome: string;
  turma: string;
  status: Dupla["status"];
  saude: DuplaSaude;
  /** `mentorado.avatar_path` cru — a URL pública é resolvida na tela. */
  avatarPath: string | null;
  /** "encontro 9 · 15/10 às 19:00" ou "sem encontro marcado". */
  proximoTexto: string | null;
};

export type AgendaMinhaDerivada = {
  chips: ChipEscopo[];
  avisos: AvisoAgenda[];
  secoes: AgendaSecao[];
  semana: ResumoSemana;
  duplasRail: DuplaResumo[];
  /** Itens de dias já fechados DESTA semana (seg até ontem) — fora da
   *  lista, serve só pra faixa "Sua semana" não chamar de "livre" um dia
   *  que teve compromisso. */
  passadosSemana: AgendaItem[];
};

// ---------- constantes internas ----------

const TZ = "America/Sao_Paulo";
const DIA_MS = 24 * 3600 * 1000;
/** Margem de antecedência do "Entrar": abre um pouco antes da hora marcada —
 *  esperar o minuto exato puniria quem entra pra testar a câmera. */
const JANELA_ENTRAR_MS = 15 * 60 * 1000;

const fmtHora = new Intl.DateTimeFormat("pt-BR", {
  hour: "2-digit",
  minute: "2-digit",
  timeZone: TZ,
});
const fmtDiaLongo = new Intl.DateTimeFormat("pt-BR", {
  weekday: "long",
  day: "numeric",
  month: "long",
  timeZone: TZ,
});
const DIAS_SEMANA = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];

const STATUS_ENCONTRO_LABEL: Record<EncontroStatus, string> = {
  agendado: "agendado",
  remarcado: "remarcado",
  realizado: "realizado",
  nao_aconteceu: "não aconteceu",
  cancelado: "cancelado",
};

// ---------- helpers de data/texto ----------

/** "YYYY-MM-DD" é dia de calendário — âncora no meio-dia (mesma convenção de
 *  ciclo.ts) pra o fuso da máquina não virar o dia. */
function parseDia(iso: string): Date {
  return new Date(`${iso}T12:00:00`);
}

function diaSeguinte(iso: string): string {
  const d = parseDia(iso);
  d.setDate(d.getDate() + 1);
  return toDateStr(d);
}

/** "terça-feira, 7 de outubro" — subheader de dia (sem ano: a agenda é curta). */
export function rotuloDiaAgenda(iso: string): string {
  const txt = fmtDiaLongo.format(parseDia(iso));
  return txt.charAt(0).toUpperCase() + txt.slice(1);
}

/** "ter" — dia da semana curto pra caption da semana. */
function diaSemanaCurto(iso: string): string {
  return DIAS_SEMANA[parseDia(iso).getDay()];
}

function capitalizar(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Primeiro nome de uso do mentorado — nome social quando existe ("Bia"),
 *  senão o primeiro token do civil (mesma régua do resto do app). */
export function primeiroNomeDaDupla(d: Dupla): string {
  return (d.mentorado?.nome_social ?? d.mentorado?.nome ?? "")
    .split(/\s+/)[0] ?? "";
}

/** Rótulo do chip do jovem: "Ana · Turma 1" — 1º nome + nome da turma (o cru
 *  "T1 · 2026/2027" quebrava o chip). Dupla sem
 *  turma fica só o nome — nada de separador pendurado ("Ana · "). */
export function rotuloChipDupla(d: Dupla): string {
  const nome = primeiroNomeDaDupla(d) || "Jovem";
  const turma = turmaLonga(d.turma);
  return turma ? `${nome} · ${turma}` : nome;
}

// ---------- derivações ----------

export function chipsDaAgenda(duplas: Dupla[]): ChipEscopo[] {
  return [
    ...duplas.map((d) => ({ id: `dupla:${d.id}` as const, rotulo: rotuloChipDupla(d) })),
    { id: "eu" as const, rotulo: "Eu" },
    { id: "tudo" as const, rotulo: "Tudo" },
  ];
}

/** O instante que ancora o encontro: quando aconteceu de fato se já rolou,
 *  senão o horário agendado (mesma régua do calendário). */
function isoDoEncontro(e: Pick<Encontro, "status" | "realizado_em" | "data_hora">): string | null {
  return e.status === "realizado" && e.realizado_em ? e.realizado_em : e.data_hora;
}

function diaDoIso(iso: string | null): string | null {
  return iso ? toDateStr(new Date(iso)) : null;
}

/** Limbo "aberto" no recorte da agenda: hoje é o próprio `emLimbo`
 *  canônico — o status legado "remarcado" entrou na definição única quando
 *  o semáforo foi unificado (antes um remarcado vencido virava "atraso" no
 *  semáforo enquanto a agenda já o tratava como limbo). Alias mantida: o
 *  nome aberto/fechado é o vocabulário da agenda. */
export function limboAberto(
  e: Encontro,
  agoraMs: number,
  /** Sessão combinada (018): o coberto já tem conteúdo via âncora — sem o
   *  mapa ele entraria como limbo pra sempre. */
  cobertos?: Map<number, number>
): boolean {
  return emLimbo(e, agoraMs, cobertos);
}

/** Limbo "fechado": vencido E o horário previsto já acabou. Enquanto
 *  a chamada está rolando o encontro segue ITEM na agenda — é ali que o
 *  botão "Entrar" mora; a cobrança ("rolou?") só aparece depois do fim. */
export function limboFechado(
  e: Encontro,
  agoraMs: number,
  cobertos?: Map<number, number>
): boolean {
  if (!limboAberto(e, agoraMs, cobertos)) return false;
  const inicio = new Date(e.data_hora!).getTime();
  return inicio + Math.max(e.duracao_min, 0) * 60_000 < agoraMs;
}

/** Pendência de registro na régua do semáforo: agendado em limbo fechado
 *  (passou de vez, nada registrado) ou realizado há mais de 24h sem registro.
 *  O realizado recém-terminado ainda não é cobrança — vira item do dia com
 *  a ação "Registrar como foi". `cobertos` (018) é o mapa da dupla — o
 *  encontro coberto pela sessão combinada já tem conteúdo, nunca é pendência. */
export function ehPendenciaRegistro(
  e: Encontro,
  agoraMs: number,
  cobertos?: Map<number, number>
): boolean {
  if (encontroTemConteudo(e, cobertos)) return false;
  if (limboFechado(e, agoraMs, cobertos)) return true;
  if (e.status !== "realizado") return false;
  const iso = isoDoEncontro(e);
  return iso != null && agoraMs - new Date(iso).getTime() > DIA_MS;
}

/** Aviso no topo do "Hoje": registro a fazer ou combinado vencido — a tarefa
 *  é de hoje mesmo quando o evento já passou. */
function avisosDaDupla(d: Dupla, hoje: string, agoraMs: number): AvisoAgenda[] {
  if (d.status !== "ativa") return [];
  const nome1 = primeiroNomeDaDupla(d) || "Jovem";
  const escopo: EscopoId = `dupla:${d.id}`;
  const avisos: AvisoAgenda[] = [];
  // sessão combinada (018): um mapa por dupla alimenta a régua — o coberto
  // já tem conteúdo via âncora e não pode aparecer como "falta registrar"
  const cobertos = cobertosDaDupla(d.encontros);

  for (const e of [...d.encontros].sort((a, b) => a.numero - b.numero)) {
    if (!ehPendenciaRegistro(e, agoraMs, cobertos)) continue;
    const limbo =
      (e.status === "agendado" || e.status === "remarcado") &&
      limboAberto(e, agoraMs, cobertos);
    avisos.push({
      id: `reg-${e.id}`,
      escopo,
      duplaId: d.id,
      encontro: e,
      titulo: `Registro do encontro ${e.numero} · ${nome1} · ${turmaLonga(d.turma)}`,
      detalhe: limbo
        ? `Marcado para ${formatDiaHora(e.data_hora)} e sem registro. Aconteceu? Confirme como foi ou remarque.`
        : "Pendente. Preencha atividades, avaliação e próximo passo.",
      href: `/duplas/${d.id}#registrar-${e.id}`,
      cta: "Preencher registro",
      remarcar: limbo,
    });
  }

  for (const enc of [...(d.encaminhamentos ?? [])].sort((a, b) =>
    (a.prazo ?? "").localeCompare(b.prazo ?? "")
  )) {
    const vencido =
      (enc.status === "pendente" || enc.status === "atrasado") &&
      enc.prazo != null &&
      enc.prazo < hoje;
    if (!vencido) continue;
    avisos.push({
      id: `enc-${enc.id}`,
      escopo,
      duplaId: d.id,
      encontro: null,
      titulo: `Combinado vencido · ${nome1} · ${turmaLonga(d.turma)}`,
      detalhe: `${enc.descricao}. O prazo era ${formatDiaMes(enc.prazo)}${
        enc.responsavel === "mentor" ? "" : " (combinado do mentorado)"
      }.`,
      href: `/duplas/${d.id}#combinado-${enc.id}`,
      cta: "Ver combinado",
      remarcar: false,
    });
  }

  // combinados em aberto, dos dois lados (o antigo afazer, 0157 — o mentor
  // acompanha também os do jovem): uma linha resumida, não um aviso por
  // item — a contagem por lado e o nº mais antigo bastam pra decidir abrir
  // a ficha. O vencido já saiu acima com aviso próprio; o texto dos itens
  // não sai da ficha (LGPD: pode citar o jovem)
  const emAberto = (d.encaminhamentos ?? []).filter(
    (enc) =>
      enc.numero != null &&
      enc.status !== "feito" &&
      !(enc.prazo != null && enc.prazo < hoje)
  );
  if (emAberto.length > 0) {
    const maisAntigo = Math.min(...emAberto.map((enc) => enc.numero!));
    const total = emAberto.length;
    const seus = emAberto.filter((enc) => enc.responsavel === "mentor").length;
    const doJovem = total - seus;
    // "de {nome}" sem artigo — neutro de gênero como "agenda de {nome}"
    const contagem =
      seus > 0 && doJovem > 0
        ? `${total} ${total === 1 ? "item" : "itens"} (${seus} ${seus === 1 ? "seu" : "seus"}, ${doJovem} de ${nome1})`
        : seus > 0
          ? `${total} ${total === 1 ? "item seu" : "itens seus"}`
          : `${total} ${total === 1 ? `item de ${nome1}` : `itens de ${nome1}`}`;
    avisos.push({
      id: `int-${d.id}`,
      escopo,
      duplaId: d.id,
      encontro: null,
      titulo: `Combinados em aberto · ${nome1} · ${turmaLonga(d.turma)}`,
      detalhe: `${contagem} · o mais antigo é do ${maisAntigo}º encontro.`,
      href: `/duplas/${d.id}#combinados-${maisAntigo}`,
      cta: "Ver combinados",
      remarcar: false,
    });
  }

  return avisos;
}

/** Itens da lista: o que está por vir OU acontece hoje depois — encontros
 *  da dupla, sessões da trilha de especialista do jovem (convidado, nunca
 *  com botão de entrar) e o passo oficial ainda sem data (tracejado). */
function itensDaDupla(
  d: Dupla,
  trilhasJovem: TrilhaJovem[],
  eventos: CicloEvento[],
  hoje: string,
  hojeData: Date,
  agoraMs: number
): AgendaItem[] {
  const itens: AgendaItem[] = [];
  const nome1 = primeiroNomeDaDupla(d) || "Jovem";
  const nomeCompleto = d.mentorado?.nome ?? nome1;
  const escopo: EscopoId = `dupla:${d.id}`;
  const evCronograma = eventosDoCronograma(eventos, d.cronograma_id);
  const total = evCronograma.filter((e) => e.tipo === "encontro" && e.numero != null)
    .length || TRILHA_LEN.dpp;
  // sessão combinada (018): o mapa da dupla decide "tem conteúdo?" uma vez —
  // coberto não vira "registrar" nem "ainda não preenchido"
  const cobertos = cobertosDaDupla(d.encontros);

  // --- encontros reais da dupla ---
  for (const e of d.encontros) {
    const iso = isoDoEncontro(e);
    const dia = diaDoIso(iso);
    // pendência mora no aviso do topo — listar aqui duplicaria o sinal
    if (ehPendenciaRegistro(e, agoraMs, cobertos)) continue;
    // agendado/remarcado SEM data_hora (dado legado/importado): não pode
    // virar item de dia nem sumir — cai no grupo "a agendar" com remarcar,
    // que é a ação correta pra uma row que precisa de nova data
    if (
      dia == null &&
      (e.status === "agendado" || e.status === "remarcado") &&
      d.status === "ativa"
    ) {
      itens.push({
        id: `enc-${e.id}`,
        escopo,
        tipo: "a_agendar",
        dia: null,
        ts: null,
        hora: null,
        fim: null,
        rotulo: `Encontro ${e.numero} · ${turmaLonga(d.turma)}`,
        titulo: `Encontro ${e.numero} de ${total} com ${nomeCompleto}`,
        estado: "a agendar",
        meta: ["marcado sem horário: escolha uma nova data"],
        tom: "muted",
        convidado: false,
        notaConvidado: null,
        duplaId: d.id,
        encontro: e,
        numero: e.numero,
        sugeridoDia: null,
        eventoId: null,
        link: null,
        acoes: ["remarcar"],
        oficial: null,
      });
      continue;
    }
    // a agenda é pra frente: dia já fechado não entra (limbo/cobrança já
    // saíram acima; realizados com registro e não-acontecidos de ontem são
    // história da ficha, não do "o que eu tenho")
    if (dia == null || dia < hoje) continue;

    const inicio = iso ? new Date(iso).getTime() : null;
    const fim =
      inicio != null && e.duracao_min > 0
        ? new Date(inicio + e.duracao_min * 60_000)
        : null;
    const link = linkSeguro(e.link);
    const acontecendo =
      inicio != null &&
      inicio - JANELA_ENTRAR_MS <= agoraMs &&
      agoraMs <= inicio + Math.max(e.duracao_min, 0) * 60_000;

    const acoes: AgendaAcaoTipo[] = [];
    // dupla pausada/encerrada: o item fica visível (histórico honesto) mas
    // sem ação — não faz sentido "Entrar" num encontro de jornada parada
    if (d.status === "ativa") {
      if (e.status === "agendado" || e.status === "remarcado") {
        if (link && acontecendo) acoes.push("entrar");
        // remarcar segue disponível em qualquer agendado futuro — o mesmo
        // AgendarEncontroDialog da ficha/agenda semanal, não um fluxo novo
        acoes.push("remarcar");
      } else if (e.status === "realizado" && !encontroTemConteudo(e, cobertos)) {
        acoes.push("registrar");
      } else if (e.status === "nao_aconteceu" || e.status === "cancelado") {
        // fechado mas com data futura (marcou não-aconteceu/cancelou antes
        // da hora): a row existe e o dialog remarca ela — mesmo caminho do
        // item "a agendar" abaixo, só que aqui o dia ainda está por vir
        acoes.push("remarcar");
      }
    }

    const meta: string[] = [];
    const registrado = encontroTemConteudo(e, cobertos);
    if (e.motivo_reagendamento) meta.push(`Remarcado: ${e.motivo_reagendamento}`);
    if (e.status === "realizado" && registrado) meta.push("registro entregue");
    if (e.status === "realizado" && !registrado)
      meta.push("registro ainda não preenchido");

    itens.push({
      id: `enc-${e.id}`,
      escopo,
      tipo: "encontro",
      dia,
      ts: inicio,
      hora: inicio != null ? fmtHora.format(new Date(inicio)) : null,
      fim: fim ? fmtHora.format(fim) : null,
      rotulo: `Encontro ${e.numero} · ${turmaLonga(d.turma)}`,
      titulo: `Encontro ${e.numero} de ${total} com ${nomeCompleto}`,
      estado: STATUS_ENCONTRO_LABEL[e.status],
      meta,
      tom:
        e.status === "realizado"
          ? registrado
            ? "ok"
            : "warn"
          : e.status === "nao_aconteceu" || e.status === "cancelado"
            ? "muted"
            : null,
      convidado: false,
      notaConvidado: null,
      duplaId: d.id,
      encontro: e,
      numero: e.numero,
      sugeridoDia: null,
      eventoId: null,
      link,
      acoes,
      oficial: null,
    });
  }

  // --- passos oficiais ainda por agendar — "a agendar" (tracejado) ---
  // Dois sabores: sem row nenhuma (previsto → dialog cria) e com row falha
  // (nao_aconteceu/cancelado → dialog edita a própria row — remarcar pede
  // motivo e o campo só existe com `atual`). Passo com row agendada já é
  // item acima; o limbo já está no warnrow — nenhum duplica aqui.
  if (d.status === "ativa") {
    const alvo = alvoAgendamento(d, eventos, hojeData);
    const alvoFalhou =
      alvo.encontroAlvo != null &&
      (alvo.encontroAlvo.status === "nao_aconteceu" ||
        alvo.encontroAlvo.status === "cancelado");
    // official date of the step in the dupla's cronograma — what the meta
    // line reports ("a data oficial já passou"), even when it's a defasado
    const dataOficialDe = (n: number) =>
      evCronograma.find(
        (e) => e.tipo === "encontro" && e.numero === n && e.data != null
      )?.data ?? null;
    // a defasado's official date predates the dupla — passing it to the
    // dialog clamps to `piso` (already past) and opens "Registrar" on an
    // "a agendar" item. Blank opens "Agendar", which is the item's action
    const sugestaoAgenda = (oficial: string | null) =>
      oficial != null && (!d.iniciada_em || oficial >= d.iniciada_em)
        ? oficial
        : null;
    const previstos = new Map<
      number,
      { dia: string | null; sugerido: string | null; encontro: Encontro | null }
    >();
    if (!alvo.cicloCompleto && (alvo.encontroAlvo == null || alvoFalhou))
      previstos.set(alvo.proximoNumero, {
        dia: dataOficialDe(alvo.proximoNumero),
        sugerido: alvo.sugeridoProximo ?? null,
        encontro: alvoFalhou ? alvo.encontroAlvo : null,
      });
    for (const f of alvo.faltantes)
      if (!previstos.has(f.numero))
        previstos.set(f.numero, {
          dia: dataOficialDe(f.numero),
          sugerido: sugestaoAgenda(dataOficialDe(f.numero)),
          encontro: null,
        });
    // TODA row falha segue acionável, não só a do alvo: dois nao_aconteceu
    // seguidos deixavam o segundo sem nenhum caminho aqui (a data já passou,
    // então ele nem entra como item de dia) — a ficha já remarcava, a
    // agenda não
    for (const e of d.encontros)
      if (
        (e.status === "nao_aconteceu" || e.status === "cancelado") &&
        !previstos.has(e.numero)
      )
        previstos.set(e.numero, { dia: null, sugerido: null, encontro: e });

    for (const [numero, p] of [...previstos].sort((a, b) => a[0] - b[0])) {
      // data oficial já passada não senta no dia dela — cai no grupo "a
      // agendar" no fim de Próximos; a data aparece como contexto na meta
      const dia = p.dia != null && p.dia >= hoje ? p.dia : null;
      const meta: string[] = [];
      if (p.encontro)
        meta.push(
          `o encontro ${numero} foi marcado como "${STATUS_ENCONTRO_LABEL[p.encontro.status]}": combine uma nova data`
        );
      meta.push(
        dia != null
          ? `data oficial: ${capitalizar(formatDiaSemana(dia))} ${formatDiaMes(dia)}`
          : p.dia != null
            ? `a data oficial (${formatDiaMes(p.dia)}) já passou: combine um novo horário`
            : "sem dia oficial no calendário: a dupla agenda"
      );
      itens.push({
        id: `prev-${d.id}-${numero}`,
        escopo,
        tipo: "a_agendar",
        dia,
        ts: null,
        hora: null,
        fim: null,
        rotulo: `Encontro ${numero} · ${turmaLonga(d.turma)}`,
        titulo: `Encontro ${numero} de ${total} com ${nomeCompleto}`,
        estado: "a agendar",
        meta,
        tom: "muted",
        convidado: false,
        notaConvidado: null,
        duplaId: d.id,
        encontro: p.encontro,
        numero,
        sugeridoDia: p.sugerido,
        eventoId: null,
        link: null,
        acoes: p.encontro ? ["remarcar"] : ["agendar"],
        oficial: null,
      });
    }
  }

  // --- sessões da trilha de especialista do jovem (convidado) ---
  for (const trilha of trilhasJovem) {
    for (const s of trilha.sessoes ?? []) {
      const iso =
        s.status === "realizado" && s.realizado_em ? s.realizado_em : s.data_hora;
      const dia = diaDoIso(iso);
      if (dia == null || dia < hoje) continue;
      const inicio = iso ? new Date(iso).getTime() : null;
      const fim =
        inicio != null && s.duracao_min != null && s.duracao_min > 0
          ? new Date(inicio + s.duracao_min * 60_000)
          : null;
      const passo = passoEsp(s, trilha.sessoes);
      const meta: string[] = [];
      if (trilha.especialista_nome) meta.push(`com ${trilha.especialista_nome}`);
      if (trilha.demanda) meta.push(trilha.demanda);
      if (s.status === "realizado" && registroTemConteudo(s.registro))
        meta.push("registro entregue");

      itens.push({
        id: `esp-${s.id}`,
        escopo,
        tipo: "sessao_esp",
        dia,
        ts: inicio,
        hora: inicio != null ? fmtHora.format(new Date(inicio)) : null,
        fim: fim ? fmtHora.format(fim) : null,
        rotulo: `Trilha de especialista · sessão ${passo} de ${TRILHA_LEN.especialista} · ${turmaLonga(d.turma)}`,
        titulo: trilha.especialista_nome
          ? `Sessão com ${trilha.especialista_nome}`
          : "Sessão de especialista",
        estado: STATUS_ENCONTRO_LABEL[s.status],
        meta,
        tom: s.status === "realizado" ? "ok" : null,
        convidado: true,
        // a projeção não traz link de propósito — o mentor acompanha, a
        // sessão é do jovem com o especialista. Nunca entra ação de chamada.
        notaConvidado: `agenda de ${nome1}: você não participa`,
        duplaId: d.id,
        encontro: null,
        numero: s.numero,
        sugeridoDia: null,
        eventoId: null,
        link: null,
        acoes: [],
        oficial: null,
      });
    }
  }

  return itens;
}

/** Chave de identidade de um evento oficial pra merge — título+data+obs
 *  é o que faz dois eventos serem "o mesmo" mesmo em cronogramas
 *  diferentes; local/hora distintos (na observação) não fundem. */
function chaveOficial(ev: CicloEvento): string {
  return `${ev.titulo}|${ev.data ?? ""}|${ev.observacao ?? ""}`;
}

/** Eventos oficiais fora do eixo encontro-a-encontro: formação é do mentor
 *  ("eu"); encerramento/roda e recesso entram na agenda de cada jovem do
 *  cronograma — a turma é deles, o mentor acompanha por ali.
 *  `janela` abre o recorte só-pra-frente: a faixa "Sua semana" precisa
 *  também dos eventos de dias já fechados DESTA semana (`desde`/`ateExcl`),
 *  senão ela marca "livre" um dia que teve programa. */
function itensPrograma(
  duplas: Dupla[],
  eventos: CicloEvento[],
  cronogramas: Cronograma[],
  hoje: string,
  janela?: { desde: string; ateExcl: string }
): AgendaItem[] {
  const turmaDo = new Map(cronogramas.map((c) => [c.id, c.turma]));
  const duplasPorCronograma = new Map<string, Dupla[]>();
  for (const d of duplas) {
    if (!d.cronograma_id) continue;
    const l = duplasPorCronograma.get(d.cronograma_id) ?? [];
    l.push(d);
    duplasPorCronograma.set(d.cronograma_id, l);
  }

  const itens: AgendaItem[] = [];
  for (const ev of eventos) {
    if (!ev.data || ev.data < (janela?.desde ?? hoje)) continue;
    if (janela && ev.data >= janela.ateExcl) continue;
    const turma = turmaDo.get(ev.cronograma_id) ?? null;
    const comum = {
      dia: ev.data,
      ts: null,
      hora: null,
      fim: null,
      titulo: ev.titulo,
      estado: null,
      tom: null as AgendaTom | null,
      duplaId: null,
      encontro: null,
      numero: null,
      sugeridoDia: null,
      eventoId: ev.id,
      link: null,
      acoes: [] as AgendaAcaoTipo[],
    };
    if (ev.tipo === "formacao") {
      // só a formação de turma do próprio mentor interessa — a de outra
      // turma não é compromisso dele
      if (!duplasPorCronograma.has(ev.cronograma_id)) continue;
      const t = turma ? turmaLonga(turma) : null;
      itens.push({
        ...comum,
        id: `prog-${ev.id}`,
        escopo: "eu",
        tipo: "programa",
        rotulo: "Formação de mentores",
        meta: t ? [t] : [],
        convidado: false,
        notaConvidado: null,
        oficial: {
          chave: chaveOficial(ev),
          base: "Formação de mentores",
          turmaNoRotulo: false,
          turmas: t ? [t] : [],
          jovens: [],
          notaTipo: null,
        },
      });
    } else if (ev.tipo === "evento_encerramento") {
      for (const d of duplasPorCronograma.get(ev.cronograma_id) ?? []) {
        const nome1 = primeiroNomeDaDupla(d) || "Jovem";
        const t = turmaLonga(d.turma);
        itens.push({
          ...comum,
          id: `prog-${ev.id}-${d.id}`,
          escopo: `dupla:${d.id}`,
          tipo: "programa",
          rotulo: `Evento oficial do ciclo · ${t}`,
          meta: [],
          convidado: true,
          notaConvidado: `agenda de ${nome1} · evento oficial`,
          duplaId: d.id,
          oficial: {
            chave: chaveOficial(ev),
            base: "Evento oficial do ciclo",
            turmaNoRotulo: true,
            turmas: [t],
            jovens: [nome1],
            notaTipo: "evento oficial",
          },
        });
      }
    } else if (ev.tipo === "recesso") {
      // o recesso é do cronograma, não da dupla — mas a NOTA é por par:
      // quem declarou "seguir se encontrando" ganha a linha que lembra isso
      for (const d of duplasPorCronograma.get(ev.cronograma_id) ?? []) {
        const nome1 = primeiroNomeDaDupla(d) || "Jovem";
        const segue = (d.recessos ?? []).some(
          (r) => r.ciclo_evento_id === ev.id && !r.usa
        );
        const t = turmaLonga(d.turma);
        itens.push({
          ...comum,
          id: `prog-${ev.id}-${d.id}`,
          escopo: `dupla:${d.id}`,
          tipo: "programa",
          rotulo: `Recesso do programa · ${t}`,
          meta: segue ? [`${nome1} segue se encontrando durante o recesso`] : [],
          convidado: false,
          notaConvidado: null,
          duplaId: d.id,
          oficial: {
            chave: chaveOficial(ev),
            base: "Recesso do programa",
            turmaNoRotulo: true,
            turmas: [t],
            jovens: [nome1],
            notaTipo: null,
          },
        });
      }
    }
  }
  return itens;
}

/** Encontros/sessões de dias já fechados DESTA semana — a lista é
 *  só-pra-frente (a ficha conta essa história), mas a faixa "Sua semana"
 *  monta as 7 células de seg–dom: sem este recorte ela chamava de "livre"
 *  um dia que já passou com encontro. Sem ações — nada a fazer num dia
 *  fechado; limbo/cobrança já vivem nos warnrows. */
function itensPassadosDaDupla(
  d: Dupla,
  trilhasJovem: TrilhaJovem[],
  eventos: CicloEvento[],
  desde: string,
  hoje: string
): AgendaItem[] {
  const itens: AgendaItem[] = [];
  const nome1 = primeiroNomeDaDupla(d) || "Jovem";
  const nomeCompleto = d.mentorado?.nome ?? nome1;
  const escopo: EscopoId = `dupla:${d.id}`;
  const total = eventosDoCronograma(eventos, d.cronograma_id).filter(
    (e) => e.tipo === "encontro" && e.numero != null
  ).length || TRILHA_LEN.dpp;

  for (const e of d.encontros) {
    if (e.status === "cancelado") continue;
    const iso = isoDoEncontro(e);
    const dia = diaDoIso(iso);
    if (dia == null || dia < desde || dia >= hoje) continue;
    const inicio = iso ? new Date(iso).getTime() : null;
    const fim =
      inicio != null && e.duracao_min > 0
        ? new Date(inicio + e.duracao_min * 60_000)
        : null;
    itens.push({
      id: `enc-${e.id}`,
      escopo,
      tipo: "encontro",
      dia,
      ts: inicio,
      hora: inicio != null ? fmtHora.format(new Date(inicio)) : null,
      fim: fim ? fmtHora.format(fim) : null,
      rotulo: `Encontro ${e.numero} · ${turmaLonga(d.turma)}`,
      titulo: `Encontro ${e.numero} de ${total} com ${nomeCompleto}`,
      estado: STATUS_ENCONTRO_LABEL[e.status],
      meta: [],
      tom:
        e.status === "realizado"
          ? "ok"
          : e.status === "nao_aconteceu"
            ? "muted"
            : null,
      convidado: false,
      notaConvidado: null,
      duplaId: d.id,
      encontro: e,
      numero: e.numero,
      sugeridoDia: null,
      eventoId: null,
      link: null,
      acoes: [],
      oficial: null,
    });
  }

  for (const trilha of trilhasJovem) {
    for (const s of trilha.sessoes ?? []) {
      if (s.status === "cancelado") continue;
      const iso =
        s.status === "realizado" && s.realizado_em ? s.realizado_em : s.data_hora;
      const dia = diaDoIso(iso);
      if (dia == null || dia < desde || dia >= hoje) continue;
      const inicio = iso ? new Date(iso).getTime() : null;
      const fim =
        inicio != null && s.duracao_min != null && s.duracao_min > 0
          ? new Date(inicio + s.duracao_min * 60_000)
          : null;
      const passo = passoEsp(s, trilha.sessoes);
      itens.push({
        id: `esp-${s.id}`,
        escopo,
        tipo: "sessao_esp",
        dia,
        ts: inicio,
        hora: inicio != null ? fmtHora.format(new Date(inicio)) : null,
        fim: fim ? fmtHora.format(fim) : null,
        rotulo: `Trilha de especialista · sessão ${passo} de ${TRILHA_LEN.especialista} · ${turmaLonga(d.turma)}`,
        titulo: trilha.especialista_nome
          ? `Sessão com ${trilha.especialista_nome}`
          : "Sessão de especialista",
        estado: STATUS_ENCONTRO_LABEL[s.status],
        meta: [],
        tom: s.status === "realizado" ? "ok" : "muted",
        convidado: true,
        notaConvidado: `agenda de ${nome1}: você não participa`,
        duplaId: d.id,
        encontro: null,
        numero: s.numero,
        sugeridoDia: null,
        eventoId: null,
        link: null,
        acoes: [],
        oficial: null,
      });
    }
  }

  return itens;
}

// ---------- bucketing ----------

/** Ordem estável dentro do dia: com horário primeiro (por hora), depois os
 *  sem hora (evento do programa é por dia), "a agendar" por
 *  último — é intenção, não compromisso marcado. */
function cmpItens(a: AgendaItem, b: AgendaItem): number {
  const rank = (i: AgendaItem) =>
    i.tipo === "a_agendar" ? 2 : i.ts == null ? 1 : 0;
  const ra = rank(a);
  const rb = rank(b);
  if (ra !== rb) return ra - rb;
  if (a.ts != null && b.ts != null && a.ts !== b.ts) return a.ts - b.ts;
  // numeric: "prev-…-2" antes de "prev-…-10" no grupo "a agendar"
  return a.id.localeCompare(b.id, undefined, { numeric: true });
}

function grupoDo(dia: string | null, itens: AgendaItem[], rotulo: string | null): AgendaGrupo {
  return { dia, rotulo, itens: [...itens].sort(cmpItens) };
}

export function secoesDaAgenda(itens: AgendaItem[], hoje: string): AgendaSecao[] {
  const amanha = diaSeguinte(hoje);
  const deHoje = itens.filter((i) => i.dia === hoje);
  const deAmanha = itens.filter((i) => i.dia === amanha);
  const futuros = itens.filter((i) => i.dia != null && i.dia > amanha);
  // previstos sem data (oficial vencida ou inexistente) — grupo próprio no
  // fim de Próximos. Um dia passado que escape da derivação aterrissa aqui
  // também: melhor no "a agendar" do que sumido da agenda.
  const semDia = itens.filter((i) => i.dia == null || i.dia < hoje);

  const porDia = new Map<string, AgendaItem[]>();
  for (const i of futuros) {
    const l = porDia.get(i.dia!) ?? [];
    l.push(i);
    porDia.set(i.dia!, l);
  }
  const diasOrdenados = [...porDia.keys()].sort();

  const proximos: AgendaGrupo[] = diasOrdenados.map((dia) =>
    grupoDo(dia, porDia.get(dia)!, rotuloDiaAgenda(dia))
  );
  if (semDia.length > 0)
    proximos.push(
      grupoDo(null, semDia.sort(cmpItens), "A agendar, ainda sem agendamento")
    );

  return [
    {
      id: "hoje",
      titulo: "Hoje",
      sub: rotuloDiaAgenda(hoje),
      grupos: deHoje.length ? [grupoDo(hoje, deHoje, null)] : [],
    },
    {
      id: "amanha",
      titulo: "Amanhã",
      sub: rotuloDiaAgenda(amanha),
      grupos: deAmanha.length ? [grupoDo(amanha, deAmanha, null)] : [],
    },
    { id: "proximos", titulo: "Próximos", sub: null, grupos: proximos },
  ];
}

// ---------- rail ----------

function resumoDaSemana(
  duplas: Dupla[],
  trilhas: Record<string, TrilhaJovem[]>,
  eventos: CicloEvento[],
  cronogramas: Cronograma[],
  avisos: AvisoAgenda[],
  hoje: string
): ResumoSemana {
  const { seg, dom } = semanaBounds(parseDia(hoje));
  // "esta semana" conta o que a semana TEM — encontro/formação de segunda já
  // realizado continua sendo compromisso da semana, mesmo com hoje = quarta.
  // Por isso a conta sai das FONTES (encontros/sessões/eventos)
  // e não da lista de itens, que é só-pra-frente.
  const naSemana = (dia: string | null) => dia != null && dia >= seg && dia <= dom;
  const cronogramasDasDuplas = new Set(
    duplas.map((d) => d.cronograma_id).filter((c): c is string => c != null)
  );

  const encontros = duplas
    .flatMap((d) =>
      d.encontros
        .filter((e) => e.status !== "cancelado" && naSemana(diaDoIso(isoDoEncontro(e))))
        .map((e) => ({ e, d }))
    )
    .sort((a, b) => {
      const ta = new Date(isoDoEncontro(a.e)!).getTime();
      const tb = new Date(isoDoEncontro(b.e)!).getTime();
      return ta - tb;
    });
  const sessoes = duplas.flatMap((d) =>
    (trilhas[d.id] ?? [])
      .flatMap((t) => t.sessoes ?? [])
      .filter(
        (s) =>
          s.status !== "cancelado" &&
          naSemana(
            diaDoIso(
              s.status === "realizado" && s.realizado_em ? s.realizado_em : s.data_hora
            )
          )
      )
      .map((s) => ({ s, d }))
  );

  return {
    seg,
    dom,
    encontros: encontros.length,
    realizados: encontros.filter(({ e }) => e.status === "realizado").length,
    encontrosDetalhe:
      encontros
        .slice(0, 3)
        .map(({ e, d }) => {
          const iso = isoDoEncontro(e)!;
          const dia = diaDoIso(iso)!;
          return `${diaSemanaCurto(dia)} ${fmtHora.format(new Date(iso))} (${turmaLonga(d.turma)})`;
        })
        .join(", ") || null,
    sessoesEsp: sessoes.length,
    sessoesEspDetalhe:
      sessoes
        .filter(({ s }) => s.data_hora != null)
        .slice(0, 3)
        .map(({ s, d }) => {
          const dia = diaDoIso(s.data_hora)!;
          const nome1 = primeiroNomeDaDupla(d) || "Jovem";
          return `${diaSemanaCurto(dia)} ${fmtHora.format(new Date(s.data_hora!))} (${nome1})`;
        })
        .join(", ") || null,
    // eventos oficiais da semana nos cronogramas das próprias duplas —
    // são os tipos que a agenda lista (formação, encerramento, recesso).
    // Conta pela MESMA chave do merge da lista: um encerramento cobrindo
    // as turmas 1 e 2 é um evento só aqui e um item só no "tudo".
    programas: new Set(
      eventos
        .filter(
          (ev) =>
            (ev.tipo === "formacao" ||
              ev.tipo === "evento_encerramento" ||
              ev.tipo === "recesso") &&
            naSemana(ev.data) &&
            cronogramasDasDuplas.has(ev.cronograma_id)
        )
        .map(chaveOficial)
    ).size,
    pendencias: avisos.length,
  };
}

function resumoDupla(d: Dupla, eventos: CicloEvento[], hojeData: Date): DuplaResumo {
  const saude = saudadeDaDupla(d, eventos, hojeData);
  const prox = saude.proximo;
  return {
    id: d.id,
    nome: d.mentorado?.nome ?? "Jovem",
    primeiroNome: primeiroNomeDaDupla(d) || "Jovem",
    turma: d.turma,
    status: d.status,
    avatarPath: d.mentorado?.avatar_path ?? null,
    saude,
    proximoTexto:
      d.status !== "ativa"
        ? null
        : prox?.data_hora
          ? `encontro ${prox.numero} · ${formatDiaHora(prox.data_hora)}`
          : "sem encontro marcado",
  };
}

// ---------- ponto de entrada ----------

export function deriveAgendaMinha({
  duplas,
  trilhas,
  eventos,
  cronogramas,
  hoje,
  agora,
}: {
  duplas: Dupla[];
  trilhas: Record<string, TrilhaJovem[]>;
  eventos: CicloEvento[];
  cronogramas: Cronograma[];
  /** "YYYY-MM-DD" — dia de referência; o componente passa o hoje do server. */
  hoje: string;
  /** epoch ms do instante atual — decide limbo e "Entrar"; default Date.now(). */
  agora?: number;
}): AgendaMinhaDerivada {
  const agoraMs = agora ?? Date.now();
  const hojeData = parseDia(hoje);
  const { seg } = semanaBounds(hojeData);

  const avisos = duplas.flatMap((d) => avisosDaDupla(d, hoje, agoraMs));
  const programaItens = itensPrograma(duplas, eventos, cronogramas, hoje);
  const itens: AgendaItem[] = [
    ...duplas.flatMap((d) =>
      itensDaDupla(d, trilhas[d.id] ?? [], eventos, hoje, hojeData, agoraMs)
    ),
    ...programaItens,
  ];
  const passadosSemana: AgendaItem[] = [
    ...duplas.flatMap((d) =>
      itensPassadosDaDupla(d, trilhas[d.id] ?? [], eventos, seg, hoje)
    ),
    ...itensPrograma(duplas, eventos, cronogramas, hoje, {
      desde: seg,
      ateExcl: hoje,
    }),
  ];

  return {
    chips: chipsDaAgenda(duplas),
    avisos,
    secoes: secoesDaAgenda(itens, hoje),
    semana: resumoDaSemana(
      duplas, trilhas, eventos, cronogramas, avisos, hoje
    ),
    passadosSemana,
    // rail na mesma régua do Por mentorado: risco → atenção → ok
    duplasRail: duplas
      .map((d) => resumoDupla(d, eventos, hojeData))
      .sort(
        (a, b) =>
          ORDEM_SEMAFORO[a.saude.semaforo] - ORDEM_SEMAFORO[b.saude.semaforo] ||
          a.primeiroNome.localeCompare(b.primeiroNome)
      ),
  };
}

// ---------- filtro de escopo ----------

export function itemNoEscopo(item: { escopo: EscopoId }, escopo: EscopoAgenda): boolean {
  return escopo === "tudo" || item.escopo === escopo;
}

/** "Turma 1" fica assim; ["Turma 1","Turma 2"] vira "Turmas 1 e 2" — a
 *  forma plural é o que o review pede pra um evento oficial cobrindo
 *  turmas diferentes ("Turmas 1, 2 e 3" no máximo visto). */
export function rotuloTurmas(turmas: string[]): string {
  if (turmas.length <= 1) return turmas[0] ?? "";
  const nums = turmas.map((t) => t.replace(/^Turma\s+/, ""));
  return `Turmas ${nums.join(", ").replace(/, ([^,]+)$/, " e $1")}`;
}

/** Funde dois itens do MESMO evento oficial (chave idêntica): turmas e
 *  jovens somam, e o rótulo/tag refletem a união — o encerramento das
 *  turmas 1 e 2 é um item só, não dois cards iguais. */
function fundirPrograma(a: AgendaItem, b: AgendaItem): AgendaItem {
  const oa = a.oficial!;
  const ob = b.oficial!;
  const oficial: OficialRef = {
    ...oa,
    turmas: [...new Set([...oa.turmas, ...ob.turmas])],
    jovens: [...new Set([...oa.jovens, ...ob.jovens])],
  };
  const rotulo =
    oficial.turmaNoRotulo && oficial.turmas.length
      ? `${oficial.base} · ${rotuloTurmas(oficial.turmas)}`
      : oficial.base;
  // formação carrega a turma na meta, não no rótulo — o merge reescreve a
  // 1ª linha e preserva o resto; recesso une as notas "X segue se
  // encontrando" das duplas que declararam
  const meta = oficial.turmaNoRotulo
    ? [...new Set([...a.meta, ...b.meta])]
    : [rotuloTurmas(oficial.turmas), ...a.meta.slice(1), ...b.meta.slice(1)].filter(
        Boolean
      );
  const notaConvidado =
    oficial.notaTipo != null && oficial.jovens.length > 1
      ? `agenda de ${oficial.jovens.join(" e ")} · ${oficial.notaTipo}`
      : a.notaConvidado;
  return { ...a, rotulo, meta, notaConvidado, oficial };
}

/** Recorte da agenda por chip — itens E avisos são do escopo (o warnrow do
 *  Caio some no chip da Ana, mas não no "Tudo"). Em "tudo" o MESMO evento
 *  oficial de duplas/turmas diferentes funde num item só ("Turmas 1 e 2");
 *  nos chips de dupla cada escopo segue vendo o item da própria agenda.
 *  Estrutura preservada: seções e grupos vazios saem pra a tela não
 *  desenhar cabeçalho órfão. */
export function filtraAgenda(
  agenda: AgendaMinhaDerivada,
  escopo: EscopoAgenda
): { avisos: AvisoAgenda[]; secoes: AgendaSecao[] } {
  const avisos = agenda.avisos.filter((a) => itemNoEscopo(a, escopo));
  const secoes = agenda.secoes.map((s) => ({
    ...s,
    grupos: s.grupos
      .map((g) => {
        // merge por chave dentro do grupo (a chave inclui a data — irmãos
        // do mesmo evento sempre sentam no mesmo dia)
        const posicoes = new Map<string, number>();
        const itens: AgendaItem[] = [];
        for (const i of g.itens) {
          if (!itemNoEscopo(i, escopo)) continue;
          if (escopo === "tudo" && i.oficial != null) {
            const idx = posicoes.get(i.oficial.chave);
            if (idx == null) {
              posicoes.set(i.oficial.chave, itens.length);
              itens.push(i);
            } else {
              itens[idx] = fundirPrograma(itens[idx]!, i);
            }
            continue;
          }
          itens.push(i);
        }
        return { ...g, itens };
      })
      .filter((g) => g.itens.length > 0),
  }));
  return { avisos, secoes };
}
