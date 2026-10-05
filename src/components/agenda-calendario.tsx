"use client";

import {
  type CSSProperties,
  Fragment,
  type KeyboardEvent,
  type ReactNode,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import {
  ArrowSquareOut,
  ArrowUpRight,
  BookOpen,
  CaretDown,
  CaretLeft,
  CaretRight,
  ClockCounterClockwise,
  File,
  FileText,
  Flag,
  GraduationCap,
  LinkSimple,
  PuzzlePiece,
  Users,
  VideoCamera,
} from "@phosphor-icons/react";
import { DuplaNomes } from "@/components/dupla-nomes";
import { CopiarChamada } from "@/components/copiar-chamada";
import { ChamadaFormacao } from "@/components/chamada-formacao";
import { NotaEncontro } from "@/components/nota-encontro";
import { WhatsAppRapido, type DestinoWA } from "@/components/whatsapp-rapido";
import { AgendarEncontroDialog } from "@/components/agendar-encontro-dialog";
import { RegistrarRetroativoDialog } from "@/components/registrar-retroativo-dialog";
import { RegistroForm } from "@/components/registro-form";
import { EncontroDetalheDialog } from "@/components/encontro-detalhe-dialog";
import { RevelarApos } from "@/components/revelar-apos";
import { fade, T } from "@/components/motion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { filterChipCls } from "@/components/ui/filter-chip";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  alvoAgendamento,
  bucketsDoEncontro,
  cronogramaVigente,
  cronogramasOpcoes,
  diffDias,
  duplasSemEncontroDoNumero,
  emLimbo,
  eventoDaSemana,
  eventosDoCronograma,
  formatDate,
  formatDateTime,
  formatDiaSemana,
  linkSeguro,
  passosDaTrilha,
  resumoSemanaDe,
  semanaBounds,
  toDateStr,
  type BucketsEncontro,
  type ItemEncontroDupla,
  type PassoGuia,
} from "@/lib/ciclo";
import type { MentorChamada } from "@/lib/queries-presenca";
import type {
  AppRole,
  CicloEvento,
  Cronograma,
  Dupla,
  Encontro,
  EncontroStatus,
  EspecialistaEvento,
  Material,
} from "@/lib/types";
import { msgsContato } from "@/lib/whatsapp-msgs";
import { cn, normaliza } from "@/lib/utils";

const DIAS_SEMANA = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
const DIAS_SEMANA_COMPLETOS = [
  "domingo",
  "segunda-feira",
  "terça-feira",
  "quarta-feira",
  "quinta-feira",
  "sexta-feira",
  "sábado",
];
const MESES_CURTOS = [
  "jan",
  "fev",
  "mar",
  "abr",
  "mai",
  "jun",
  "jul",
  "ago",
  "set",
  "out",
  "nov",
  "dez",
];
const TZ = "America/Sao_Paulo";

/** Prop estável pra evento de formação sem nenhuma presença marcada — um
 *  `{}` inline novo a cada render dispararia o efeito de reconciliação dos
 *  overrides otimistas da chamada. */
const SEM_PRESENCAS: Record<string, boolean> = {};

const fmtMesAno = new Intl.DateTimeFormat("pt-BR", {
  month: "long",
  year: "numeric",
  timeZone: TZ,
});
const fmtCompleta = new Intl.DateTimeFormat("pt-BR", {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: TZ,
});
const fmtHora = new Intl.DateTimeFormat("pt-BR", {
  hour: "2-digit",
  minute: "2-digit",
  timeZone: TZ,
});
const fmtMesLongo = new Intl.DateTimeFormat("pt-BR", {
  month: "long",
  timeZone: TZ,
});

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/** "YYYY-MM-DD" é dia de calendário — âncora no meio-dia pra o fuso não virar o dia. */
function parseDia(iso: string): Date {
  return new Date(`${iso}T12:00:00`);
}

function paraISO(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function proximoDia(iso: string): string {
  const d = parseDia(iso);
  d.setDate(d.getDate() + 1);
  return paraISO(d);
}

function somarDias(d: Date, n: number): Date {
  const c = new Date(d);
  c.setDate(c.getDate() + n);
  return c;
}

/** Índice absoluto do mês (ano * 12 + mês 0-based) — facilita comparar e navegar. */
function mesIndice(iso: string): number {
  const [y, m] = iso.split("-").map(Number);
  return y * 12 + (m - 1);
}

/** [primeiro, último] dia ("YYYY-MM-DD") do mês apontado pelo índice absoluto. */
function faixaDoMes(idx: number): [string, string] {
  const ano = Math.floor(idx / 12);
  const mesNum = idx % 12;
  const ultimo = new Date(ano, mesNum + 1, 0).getDate();
  return [
    `${ano}-${pad(mesNum + 1)}-01`,
    `${ano}-${pad(mesNum + 1)}-${pad(ultimo)}`,
  ];
}

function capitalizar(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** "ter 27 out" — data compacta pra linhas de lista e captions. */
function diaCompacto(iso: string): string {
  const d = parseDia(iso);
  return `${DIAS_SEMANA[d.getDay()]} ${d.getDate()} ${MESES_CURTOS[d.getMonth()]}`;
}

/** "terça" — dia da semana na forma curta natural (segunda, terça, sábado…). */
function diaSemanaCurto(iso: string): string {
  return formatDiaSemana(iso).replace("-feira", "");
}

/** Rótulo acessível do evento pra compor o aria-label do dia. */
function descricaoEvento(e: CicloEvento): string {
  return e.tipo === "encontro" && e.numero != null ? `${e.numero}º encontro` : e.titulo;
}

// ===== encontros das duplas (agendados pela dupla, não o calendário oficial) =====

type ItemDupla = ItemEncontroDupla;

const STATUS_ENCONTRO_LABEL: Record<EncontroStatus, string> = {
  agendado: "agendado",
  remarcado: "remarcado",
  realizado: "realizado",
  nao_aconteceu: "não aconteceu",
  cancelado: "cancelado",
};

/** O instante que ancora o encontro no grid: quando aconteceu de fato
 *  (realizado_em) se já rolou, senão o horário agendado (data_hora). */
function isoDoEncontro(e: Encontro): string | null {
  return e.status === "realizado" && e.realizado_em ? e.realizado_em : e.data_hora;
}

function instanteDoEncontro(e: Encontro): Date | null {
  const iso = isoDoEncontro(e);
  return iso ? new Date(iso) : null;
}

/** "YYYY-MM-DD" no fuso do programa — mesma chave dos dias do grid. */
function diaDoEncontro(e: Encontro): string | null {
  const d = instanteDoEncontro(e);
  return d ? toDateStr(d) : null;
}

/** Dot de status do encontro da dupla: fill = aconteceu (ok com registro, warn
 *  sem), anel vazio = futuro (agendado/remarcado), apagado = não rolou. */
function corDotEncontro(e: Encontro): string {
  if (e.status === "realizado")
    return e.registro ? "bg-[var(--ok)]" : "bg-[var(--warn)]";
  if (e.status === "agendado" || e.status === "remarcado")
    return "ring-1 ring-muted-foreground/60";
  return "bg-muted-foreground/50";
}

/** Resumo falado dos encontros de dupla do dia — compõe o aria-label do botão.
 *  Mesma leitura dos buckets: limbo (agendado vencido) é pendência de registro,
 *  não "agendado" — a contagem falada não pode discordar da visual. */
function resumoEncontrosDupla(itens: ItemDupla[], agora: number): string {
  const b = bucketsDoEncontro(itens, agora);
  if (itens.length === 1)
    return `encontro da dupla ${
      b.pendentes.length === 1
        ? "pendente de registro"
        : STATUS_ENCONTRO_LABEL[itens[0].encontro.status]
    }`;
  const partes: string[] = [];
  if (b.pendentes.length > 0)
    partes.push(
      `${b.pendentes.length} ${b.pendentes.length === 1 ? "pendente" : "pendentes"} de registro`
    );
  if (b.agendados.length > 0)
    partes.push(
      `${b.agendados.length} ${b.agendados.length === 1 ? "agendado" : "agendados"}`
    );
  if (b.realizados.length > 0)
    partes.push(
      `${b.realizados.length} ${b.realizados.length === 1 ? "realizado" : "realizados"}`
    );
  if (b.naoAconteceram.length > 0)
    partes.push(
      `${b.naoAconteceram.length} não ${b.naoAconteceram.length === 1 ? "aconteceu" : "aconteceram"}`
    );
  return `${itens.length} encontros de duplas: ${partes.join(", ")}`;
}

/** Cobertura de um encontro oficial entre as duplas visíveis: quantas têm o
 *  encontro `numero` realizado e com registro entregue. */
function coberturaEncontro(
  duplas: Dupla[],
  numero: number
): { registraram: number; total: number } {
  // denominador = duplas ativas da trilha do calendário — a especialista não
  // deve o encontro oficial DPP de nº igual (o dela é outra trilha)
  const ativas = duplas.filter(
    (d) => d.status === "ativa" && d.trilha !== "especialista"
  );
  let registraram = 0;
  for (const d of ativas)
    if (
      d.encontros.some(
        (e) => e.numero === numero && e.status === "realizado" && e.registro
      )
    )
      registraram++;
  return { registraram, total: ativas.length };
}

const TIPO_PALAVRA: Record<CicloEvento["tipo"], string> = {
  encontro: "encontro",
  formacao: "formação",
  recesso: "recesso",
  marco: "marco",
};

/** O nome do evento já diz o tipo? ("2º encontro · …", "Recesso de fim de ano",
 *  "…formação de mentores") — quando diz, o marcador fica só no glifo. */
function tipoDitoNoNome(tipo: CicloEvento["tipo"], nome: string): boolean {
  return normaliza(nome).includes(normaliza(TIPO_PALAVRA[tipo]));
}

/** Tipo do evento como marcador tipográfico (dot/ícone + palavra), não pill.
 *  `nome` é o nome completo do evento — a palavra sai quando ele já a carrega. */
function MarcadorTipo({ tipo, nome }: { tipo: CicloEvento["tipo"]; nome: string }) {
  const cls = "inline-flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground";
  const palavra = tipoDitoNoNome(tipo, nome) ? null : TIPO_PALAVRA[tipo];
  switch (tipo) {
    case "encontro":
      return (
        <span className={cls}>
          <span aria-hidden className="size-1.5 rounded-full bg-[var(--brand-lime)]" />
          {palavra}
        </span>
      );
    case "formacao":
      return (
        <span className={cls}>
          <GraduationCap aria-hidden size={13} weight="bold" className="text-[var(--warn-text)]" />
          {palavra}
        </span>
      );
    case "recesso":
      return (
        <span className={cls}>
          <span
            aria-hidden
            className="hatch-recesso h-2.5 w-4 rounded-[3px] ring-1 ring-inset ring-border"
          />
          {palavra}
        </span>
      );
    case "marco":
      return (
        <span className={cls}>
          <Flag aria-hidden size={13} weight="bold" className="text-[var(--ok-text)]" />
          {palavra}
        </span>
      );
  }
}

/** Cores dos segmentos da barra-resumo — mesma semântica dos dots/legenda;
 *  "agendado" é o anel vazio do dot virado segmento claro. */
const COR_SEGMENTO_ENCONTRO = {
  ok: "bg-[var(--ok)]",
  warn: "bg-[var(--warn)]",
  agendado: "bg-muted-foreground/30",
  apagado: "bg-muted-foreground/50",
} as const;

/** Contagem por segmento da barra-resumo — a mesma leitura dos buckets (limbo
 *  conta no âmbar: pendência de registro, não "agendado"). Extraída pra a
 *  legenda nomear exatamente os números que a barra pinta. */
function contagemEncontros(itens: ItemDupla[], agora: number) {
  const cont = { ok: 0, warn: 0, agendado: 0, apagado: 0 };
  for (const { encontro } of itens) {
    if (encontro.status === "realizado")
      cont[encontro.registro ? "ok" : "warn"]++;
    else if (encontro.status === "agendado" || encontro.status === "remarcado")
      cont[emLimbo(encontro, agora) ? "warn" : "agendado"]++;
    else cont.apagado++;
  }
  return cont;
}

/** Barra segmentada por status — a cobertura visual do encontro oficial no
 *  board da semana e na lista do ciclo. O total saiu daqui: número solto sem
 *  rótulo não diz nada (o "N de N" falado já mora na frase de cobertura). */
function ResumoEncontrosDupla({
  itens,
  agora,
}: {
  itens: ItemDupla[];
  /** Date.now() congelado na montagem do calendário — mesma régua dos buckets. */
  agora: number;
}) {
  const cont = contagemEncontros(itens, agora);
  return (
    <span className="flex h-2 min-w-4 flex-1 overflow-hidden rounded-full">
      {(Object.keys(cont) as (keyof typeof cont)[]).map(
        (k) =>
          cont[k] > 0 && (
            <span
              key={k}
              className={COR_SEGMENTO_ENCONTRO[k]}
              style={{ width: `${(cont[k] / itens.length) * 100}%` }}
            />
          )
      )}
    </span>
  );
}

/** Legenda nomeada da barra-resumo — cor → significado → número, só os
 *  segmentos não-zero, na mesma ordem do Object.keys(cont) da barra. */
function LegendaEncontrosDupla({
  itens,
  agora,
}: {
  itens: ItemDupla[];
  agora: number;
}) {
  const cont = contagemEncontros(itens, agora);
  const item = "inline-flex items-center gap-1.5";
  return (
    <span className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
      {cont.ok > 0 && (
        <span className={item}>
          <span aria-hidden className="size-2 rounded-full bg-[var(--ok)]" />
          {cont.ok} {cont.ok === 1 ? "realizado" : "realizados"}
        </span>
      )}
      {cont.warn > 0 && (
        <span className={item}>
          <span aria-hidden className="size-2 rounded-full bg-[var(--warn)]" />
          {cont.warn} {cont.warn === 1 ? "pendente" : "pendentes"} de registro
        </span>
      )}
      {cont.agendado > 0 && (
        <span className={item}>
          <span
            aria-hidden
            className="size-2 rounded-full ring-1 ring-muted-foreground/60"
          />
          {cont.agendado} {cont.agendado === 1 ? "agendado" : "agendados"}
        </span>
      )}
      {cont.apagado > 0 && (
        <span className={item}>
          <span
            aria-hidden
            className="size-2 rounded-full bg-muted-foreground/50"
          />
          {cont.apagado} não {cont.apagado === 1 ? "aconteceu" : "aconteceram"}
        </span>
      )}
    </span>
  );
}

/** Mini-chave dos dots de status dos encontros de dupla (realizado / registro
 *  pendente / agendado) — usada no rodapé do calendário e no detalhe do dia,
 *  sempre junto de onde os dots aparecem (PV-2). */
function ChaveDotsDupla({ className }: { className?: string }) {
  const item = "flex items-center gap-1.5";
  return (
    <span
      className={cn(
        "flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground",
        className
      )}
    >
      <span className={item}>
        <span aria-hidden className="size-2 rounded-full bg-[var(--ok)]" />
        realizado
      </span>
      <span className={item}>
        <span aria-hidden className="size-2 rounded-full bg-[var(--warn)]" />
        registro pendente
      </span>
      <span className={item}>
        <span
          aria-hidden
          className="size-2 rounded-full ring-1 ring-muted-foreground/60"
        />
        agendado
      </span>
      <span className={item}>
        <span
          aria-hidden
          className="size-2 rounded-full bg-muted-foreground/50"
        />
        não aconteceu
      </span>
    </span>
  );
}

/** Meta de segunda linha do seletor de turma: quantas duplas ativas da trilha
 *  DPP aquele cronograma tem (mesmo denominador do board) + onde a turma está
 *  no tempo — "semana do Nº encontro" quando o evento-da-semana cai na semana
 *  corrente, "próximo: Nº encontro em {dia}" quando é futuro, "último: …" no
 *  ciclo já percorrido; rascunho/encerrado seguem o status do cronograma. */
function metaCronograma(
  c: Cronograma,
  duplas: Dupla[],
  eventos: CicloEvento[],
  hoje: string
): string {
  const n = duplas.filter(
    (d) =>
      d.status === "ativa" &&
      d.trilha !== "especialista" &&
      d.cronograma_id === c.id
  ).length;
  const rotuloN = `${n} ${n === 1 ? "dupla" : "duplas"}`;
  if (c.status === "rascunho") return `${rotuloN} · rascunho`;
  if (c.status === "encerrado") return `${rotuloN} · encerrado`;
  const ev = eventoDaSemana(eventosDoCronograma(eventos, c.id), parseDia(hoje));
  if (!ev) return rotuloN;
  const rotuloEv = ev.numero != null ? `${ev.numero}º encontro` : ev.titulo;
  const { seg, dom } = semanaBounds(parseDia(hoje));
  const pos =
    ev.data >= seg && ev.data <= dom
      ? ev.numero != null
        ? `semana do ${rotuloEv}`
        : `esta semana: ${rotuloEv}`
      : ev.data > dom
        ? `próximo: ${rotuloEv} em ${diaCompacto(ev.data)}`
        : `último: ${rotuloEv} em ${diaCompacto(ev.data)}`;
  return `${rotuloN} · ${pos}`;
}

export function AgendaCalendario({
  eventos,
  cronogramas = [],
  espEventos = [],
  materiais = [],
  hoje,
  semanaId,
  diaInicial,
  duplas,
  role,
  mentores = [],
  presencas = {},
}: {
  eventos: CicloEvento[];
  /** Cronogramas do programa (0061) — cada um é um calendário oficial por
   *  turma. Com mais de um aplicável, a tela ganha o seletor e nunca mistura
   *  "encontro nº N" de turmas diferentes no mesmo board. */
  cronogramas?: Cronograma[];
  /** Passos da trilha especialista — resolve a "sugestão do guia" das duplas
   *  dela (o nº 1–5 não bate com nenhum evento do ciclo DPP). */
  espEventos?: EspecialistaEvento[];
  /** Materiais visíveis pro papel (audiência já filtrada na page) — a seção
   *  "Materiais do encontro" do detalhe do dia lê os que têm encontro_num. */
  materiais?: Material[];
  hoje: string;
  semanaId: string | null;
  /** ?dia= da URL — sobrepõe a heurística "semana atual senão hoje". */
  diaInicial: string | null;
  duplas: Dupla[];
  role: AppRole | null;
  /** Mentores ativos do ciclo — a lista da chamada de formação. Só vem
   *  preenchida pra coordenação (a page nem busca pros demais papéis). */
  mentores?: MentorChamada[];
  /** Presenças marcadas: ciclo_evento_id → profile_id → presente. Idem —
   *  coordenação only; ausência de row = não marcado (não "ausente"). */
  presencas?: Record<string, Record<string, boolean>>;
}) {
  const ehMentor = role === "mentor_dpp" || role === "mentor_especialista";
  const ehCoordSup = role === "coordenacao" || role === "supervisor";
  const ehCoord = role === "coordenacao";
  const router = useRouter();

  // ===== cronograma selecionado (0061) =====
  // Opções por papel: coord/sup veem todos os cronogramas; o mentor vê os das
  // próprias duplas DPP (sem dupla, o vigente — o calendário "do programa"
  // que ele já veria). Um cronograma só = sem seletor, a tela segue direta.
  const opcoesCron = useMemo(() => {
    const ordenados = cronogramasOpcoes(cronogramas);
    if (!ehMentor) return ordenados;
    const meus = new Set(
      duplas
        .filter((d) => d.trilha !== "especialista")
        .map((d) => d.cronograma_id)
    );
    const dasDuplas = ordenados.filter((c) => meus.has(c.id));
    return dasDuplas.length ? dasDuplas : ordenados;
  }, [cronogramas, duplas, ehMentor]);
  // turma duplicada no seletor (ex.: dois cronogramas "T1 · 2026/2027") → o
  // nome do calendário entra como sufixo pra desambiguar
  const turmasRepetidas = useMemo(() => {
    const vistas = new Set<string>();
    const repetidas = new Set<string>();
    for (const c of opcoesCron)
      if (vistas.has(c.turma)) repetidas.add(c.turma);
      else vistas.add(c.turma);
    return repetidas;
  }, [opcoesCron]);
  // deep-link de encontro (o card "semana do encontro" da home) vence o
  // vigente: se o evento é de outra turma, a agenda já abre nela
  const [cronogramaSel, setCronogramaSel] = useState<string | null>(() => {
    const deLink = semanaId
      ? eventos.find((e) => e.id === semanaId)?.cronograma_id
      : null;
    if (deLink && opcoesCron.some((c) => c.id === deLink)) return deLink;
    return cronogramaVigente(opcoesCron)?.id ?? opcoesCron[0]?.id ?? null;
  });
  // O calendário oficial da tela é SÓ o do cronograma selecionado — a união
  // dos dois faria o "encontro 5" de T1 e T2 colidirem em número. Sem
  // cronograma nenhum (estado pré-0061) cai no comportamento antigo.
  const eventosSel = useMemo(
    () =>
      cronogramaSel != null
        ? eventosDoCronograma(eventos, cronogramaSel)
        : eventos,
    [eventos, cronogramaSel]
  );

  // "semana atual" é por cronograma: duas turmas podem estar em semanas
  // diferentes do próprio ciclo — o marcador (rail, faixa do mês, badges)
  // re-computa do calendário selecionado, não do vigente que veio do server
  // (a prop semanaId segue só pra inicialização/deep-link)
  const eventoSemanaSel = useMemo(
    () => eventoDaSemana(eventosSel, parseDia(hoje)),
    [eventosSel, hoje]
  );

  // mapa dia → eventos do dia; recesso (e qualquer evento com data_fim) cobre o intervalo todo
  const porDia = useMemo(() => {
    const mapa = new Map<string, CicloEvento[]>();
    for (const e of eventosSel) {
      const fim = e.data_fim ?? e.data;
      for (let d = e.data; d <= fim; d = proximoDia(d)) {
        mapa.set(d, [...(mapa.get(d) ?? []), e]);
      }
    }
    return mapa;
  }, [eventosSel]);

  // mapa dia → encontros das duplas; cada dia em ordem cronológica pro detalhe
  // ler o dia como ele acontece. Só duplas ativas: agendado futuro de dupla
  // pausada/encerrada não é compromisso (mesmo filtro de coberturaEncontro)
  const duplasPorDia = useMemo(() => {
    const mapa = new Map<string, ItemDupla[]>();
    for (const dupla of duplas) {
      if (dupla.status !== "ativa") continue;
      for (const encontro of dupla.encontros) {
        const iso = diaDoEncontro(encontro);
        if (!iso) continue;
        mapa.set(iso, [...(mapa.get(iso) ?? []), { encontro, dupla }]);
      }
    }
    for (const itens of mapa.values())
      itens.sort(
        (a, b) =>
          (instanteDoEncontro(a.encontro)?.getTime() ?? Number.POSITIVE_INFINITY) -
          (instanteDoEncontro(b.encontro)?.getTime() ?? Number.POSITIVE_INFINITY)
      );
    return mapa;
  }, [duplas]);

  // trilha do ciclo: só os encontros oficiais (1–16), em ordem — alimenta o rail
  const encontrosRail = useMemo(
    () =>
      eventosSel
        .filter((e) => e.tipo === "encontro" && e.numero != null)
        .sort((a, b) => (a.numero ?? 0) - (b.numero ?? 0)),
    [eventosSel]
  );

  // nº do encontro → materiais que o guia pede pra ele (na ordem da biblioteca,
  // que já vem por `ordem`); sem encontro_num o material não é de encontro
  const materiaisPorNumero = useMemo(() => {
    const mapa = new Map<number, Material[]>();
    for (const m of materiais)
      if (m.encontro_num != null)
        mapa.set(m.encontro_num, [...(mapa.get(m.encontro_num) ?? []), m]);
    return mapa;
  }, [materiais]);

  // nº → passo do guia por trilha — a "sugestão do guia" do form de registro
  // e do detalhe. Dois níveis de chave: a identidade do passo DPP é
  // (cronograma, nº) — o "encontro 5" de T1 e T2 têm título/data próprios.
  // Especialista (1–5) não bate com nenhum evento de cronograma: lookup só
  // por número, na trilha própria
  const passosDppPorCron = useMemo(() => {
    const grupos = new Map<string, CicloEvento[]>();
    for (const e of eventos)
      if (e.tipo === "encontro")
        grupos.set(e.cronograma_id, [...(grupos.get(e.cronograma_id) ?? []), e]);
    const mapa = new Map<string, Map<number, PassoGuia>>();
    for (const [cron, evs] of grupos)
      mapa.set(
        cron,
        new Map(passosDaTrilha("dpp", evs, []).map((p) => [p.numero, p]))
      );
    return mapa;
  }, [eventos]);
  const passosEspPorNumero = useMemo(
    () =>
      new Map(
        passosDaTrilha("especialista", [], espEventos).map((p) => [
          p.numero,
          p,
        ])
      ),
    [espEventos]
  );
  /** Passo do guia do nº pra esta dupla — DPP sai do cronograma DELA;
   *  especialista sai dos 5 passos próprios (sem data). */
  const passoDe = (dupla: Dupla, numero: number): PassoGuia | null =>
    dupla.trilha === "especialista"
      ? (passosEspPorNumero.get(numero) ?? null)
      : (passosDppPorCron.get(dupla.cronograma_id ?? "")?.get(numero) ?? null);

  // nºs oficiais por cronograma — o selo "fora do dia oficial" de um encontro
  // compara contra o calendário DA DUPLA dele, não o da tela (mentor com
  // dupla em outra turma não ganharia selo errado)
  const oficiaisPorCron = useMemo(() => {
    const mapa = new Map<string, Set<number>>();
    for (const e of eventos)
      if (e.tipo === "encontro" && e.numero != null) {
        if (!mapa.has(e.cronograma_id)) mapa.set(e.cronograma_id, new Set());
        mapa.get(e.cronograma_id)!.add(e.numero);
      }
    return mapa;
  }, [eventos]);
  const numerosOficiaisDe = (dupla: Dupla): Set<number> =>
    oficiaisPorCron.get(dupla.cronograma_id ?? "") ?? new Set();

  const mesesComEventos = useMemo(() => {
    const set = new Set<number>();
    for (const dia of porDia.keys()) set.add(mesIndice(dia));
    return [...set].sort((a, b) => a - b);
  }, [porDia]);

  const minMes = mesesComEventos[0] ?? 0;
  const maxMes = mesesComEventos[mesesComEventos.length - 1] ?? 0;

  // mês inicial: o do ?dia= se aponta pra dentro da janela do ciclo, senão o
  // de hoje se tem eventos, senão o primeiro com eventos
  const mesInicial =
    diaInicial &&
    mesIndice(diaInicial) >= minMes &&
    mesIndice(diaInicial) <= maxMes
      ? mesIndice(diaInicial)
      : mesesComEventos.includes(mesIndice(hoje))
        ? mesIndice(hoje)
        : minMes;
  const [mes, setMes] = useState(mesInicial);
  // seleção inicial: ?dia=, senão o dia do evento da semana, senão hoje —
  // sempre dentro do mês visível (se cair fora, seleciona o 1º dia exibido)
  const [selecionado, setSelecionado] = useState(() => {
    const daSemana = semanaId ? eventosSel.find((e) => e.id === semanaId) : null;
    const candidato = diaInicial ?? daSemana?.data ?? hoje;
    return mesIndice(candidato) === mesInicial
      ? candidato
      : faixaDoMes(mesInicial)[0];
  });
  // direção da última navegação entre meses/semanas — alimenta o --dir do
  // .animate-enter-x
  const [direcao, setDirecao] = useState<1 | -1>(1);

  // ===== visão da agenda (coord/sup: semana | mes | lista; mentor: sempre mes) =====
  // ?dia= aponta um dia específico → abre no mês (o deep-link pede a célula)
  const [visao, setVisao] = useState<"semana" | "mes" | "lista">(() =>
    diaInicial ? "mes" : "semana"
  );
  const visaoEfetiva = ehCoordSup ? visao : "mes";

  // "agora" congelado na montagem — a mesma régua de limbo pros buckets, a
  // contagem da célula e o resumo falado (Date.now() solto no render viola
  // pureza e deixaria cada leitura com um "agora" diferente)
  const [agoraMs] = useState(() => Date.now());

  // janela de semanas navegáveis: da semana do 1º evento do cronograma à do
  // último (mesmo recorte dos minMes/maxMes do modo mensal)
  const { minSemana, maxSemana } = useMemo(() => {
    let min = "",
      max = "";
    for (const e of eventosSel) {
      if (!min || e.data < min) min = e.data;
      if (e.data > max) max = e.data;
    }
    return {
      minSemana: min ? semanaBounds(parseDia(min)).seg : "",
      maxSemana: max ? semanaBounds(parseDia(max)).seg : "9999-12-31",
    };
  }, [eventosSel]);
  const { seg: segHoje, dom: domHoje } = semanaBounds(parseDia(hoje));
  // init: semana de hoje com clamp pros bounds do ciclo
  const [semanaIso, setSemanaIso] = useState(() =>
    segHoje < minSemana ? minSemana : segHoje > maxSemana ? maxSemana : segHoje
  );

  // form de registro inline aberto no detalhe do dia — por encontroId, um só
  // por vez (abrir um fecha o outro). Trocar o dia selecionado fecha: o painel
  // remonta a cada dia e um id vivo reapareceria aberto ao voltar — lê como bug
  const [registroAberto, setRegistroAberto] = useState<string | null>(null);

  // troca de cronograma = reabrir a agenda noutra janela do tempo: reclampa
  // mês/semana/dia pros bounds do calendário novo. É o padrão "ajustar estado
  // na renderização" do React — não effect: setState aqui re-renderiza antes
  // do commit (os useState de navegação nasceram com o cronograma inicial)
  const [cronAnterior, setCronAnterior] = useState(cronogramaSel);
  if (cronAnterior !== cronogramaSel) {
    setCronAnterior(cronogramaSel);
    const meses = new Set<number>();
    let min = "",
      max = "";
    for (const e of eventosSel) {
      if (!min || e.data < min) min = e.data;
      if (e.data > max) max = e.data;
      const fim = e.data_fim ?? e.data;
      for (let d = e.data; d <= fim; d = proximoDia(d)) meses.add(mesIndice(d));
    }
    if (meses.size) {
      const ord = [...meses].sort((a, b) => a - b);
      const mesAlvo = meses.has(mesIndice(hoje)) ? mesIndice(hoje) : ord[0];
      const minS = semanaBounds(parseDia(min)).seg;
      const maxS = semanaBounds(parseDia(max)).seg;
      setDirecao(1);
      setMes(mesAlvo);
      setSemanaIso(segHoje < minS ? minS : segHoje > maxS ? maxS : segHoje);
      setSelecionado(
        mesIndice(hoje) === mesAlvo ? hoje : faixaDoMes(mesAlvo)[0]
      );
    }
    setRegistroAberto(null);
  }

  // roving tabindex: refs dos botões de dia + foco pedido pelo teclado
  const refsDias = useRef(new Map<string, HTMLButtonElement>());
  const focoPendente = useRef<string | null>(null);
  useEffect(() => {
    const iso = focoPendente.current;
    if (!iso) return;
    focoPendente.current = null;
    refsDias.current.get(iso)?.focus();
  });

  // PV-1: no mobile o detalhe do dia fica abaixo da dobra — seleção por
  // ponteiro marca a rolagem aqui e o efeito executa depois do commit, com o
  // painel já atualizado. Teclado não passa por esse caminho (moverPara já
  // leva foco ao dia e o browser cuida da rolagem dele).
  const refDetalhe = useRef<HTMLElement | null>(null);
  const rolarDetalhePendente = useRef(false);
  useEffect(() => {
    if (!rolarDetalhePendente.current) return;
    rolarDetalhePendente.current = false;
    const el = refDetalhe.current;
    if (!el) return;
    // ≥lg o detalhe é coluna lateral sticky — rolar não faz sentido
    if (window.matchMedia("(min-width: 1024px)").matches) return;
    const reduz = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollIntoView({ block: "start", behavior: reduz ? "auto" : "smooth" });
  }, [selecionado]);

  // rail do ciclo: nó "você está aqui" entra na viewport ao montar (o rail
  // rola horizontal no mobile — sem o scroll o nó atual sairia da tela)
  const refRailAtual = useRef<HTMLButtonElement | null>(null);
  useEffect(() => {
    const el = refRailAtual.current;
    if (!el) return;
    const reduz = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollIntoView({
      inline: "center",
      block: "nearest",
      behavior: reduz ? "instant" : "smooth",
    });
  }, []);

  const ano = Math.floor(mes / 12);
  const mesNum = mes % 12; // 0-based
  const primeiroDiaSemana = new Date(ano, mesNum, 1).getDay(); // 0 = domingo
  const diasNoMes = new Date(ano, mesNum + 1, 0).getDate();
  const rotuloMes = fmtMesAno.format(new Date(ano, mesNum, 1, 12));
  const [primeiroIso, ultimoIso] = faixaDoMes(mes);

  // células do grid: padding no início/fim pra fechar semanas de 7 dias
  const celulas: ({ iso: string; dia: number; eventos: CicloEvento[] } | null)[] =
    Array.from({ length: primeiroDiaSemana }, () => null);
  for (let d = 1; d <= diasNoMes; d++) {
    const iso = `${ano}-${pad(mesNum + 1)}-${pad(d)}`;
    celulas.push({ iso, dia: d, eventos: porDia.get(iso) ?? [] });
  }
  while (celulas.length % 7 !== 0) celulas.push(null);
  const semanas: (typeof celulas)[] = [];
  for (let i = 0; i < celulas.length; i += 7) semanas.push(celulas.slice(i, i + 7));

  // dia que recebe o tab stop: o selecionado se estiver visível, senão hoje,
  // senão o 1º dia do mês
  const diaAtivo =
    mesIndice(selecionado) === mes
      ? selecionado
      : mesIndice(hoje) === mes
        ? hoje
        : primeiroIso;

  /** Navega pra um mês (com clamp) lembrando a direção — o grid desliza pra lá. */
  function irParaMes(alvo: number) {
    const clamped = Math.min(maxMes, Math.max(minMes, alvo));
    if (clamped === mes) return;
    setDirecao(clamped > mes ? 1 : -1);
    setMes(clamped);
  }

  /** Navega pra semana cuja seg é `segIso` (com clamp nos bounds do ciclo) —
   *  mesmo protocolo do mensal: lembra a direção pro slide do board. */
  function irParaSemana(segIso: string) {
    const clamped =
      segIso < minSemana ? minSemana : segIso > maxSemana ? maxSemana : segIso;
    if (clamped === semanaIso) return;
    setDirecao(clamped > semanaIso ? 1 : -1);
    setSemanaIso(clamped);
  }

  /** Ativação por ponteiro (mouse/toque emitem `detail > 0`) pede rolagem do
   *  detalhe; clique de teclado/leitor de tela (`detail === 0`) não — esses já
   *  têm o foco no lugar certo e rolar roubaria o contexto deles. Só marca se o
   *  alvo muda a seleção — sem mudança não há commit e a flag ficaria velha. */
  function pedirRolarSePonteiro(e: { detail: number }, iso: string) {
    if (e.detail !== 0 && iso !== selecionado)
      rolarDetalhePendente.current = true;
  }

  /** Move seleção (e foco) pra um dia; se fora do mês visível, navega junto. */
  function moverPara(iso: string) {
    const alvo = mesIndice(iso);
    if (alvo < minMes || alvo > maxMes) return;
    // sem mudança de estado → o dia já está focado, nada a fazer
    if (iso === selecionado && alvo === mes) return;
    setRegistroAberto(null);
    focoPendente.current = iso;
    if (alvo !== mes) irParaMes(alvo);
    setSelecionado(iso);
  }

  /** Encontro retroativo criado a partir da agenda: fica na agenda — navega
   *  pro dia em que ele caiu (o refresh do dialog já traz a linha nova) e abre
   *  o form de registro nela. Dia fora da janela do ciclo a agenda não alcança
   *  — aí cai no caminho antigo: ficha da dupla com o card aberto. */
  function encontroCriado(duplaId: string, encontroId: string, dia: string) {
    const idx = mesIndice(dia);
    if (idx >= minMes && idx <= maxMes) {
      moverPara(dia);
      // depois do clear interno do moverPara — no mesmo batch o último set vence
      setRegistroAberto(encontroId);
    } else {
      router.push(`/duplas/${duplaId}#registrar-${encontroId}`);
      // pushState não dispara hashchange — acorda o RegistroInline da ficha
      window.dispatchEvent(new Event("realiza:hash"));
    }
  }

  function onDiaKeyDown(e: KeyboardEvent<HTMLButtonElement>, iso: string) {
    const d = parseDia(iso);
    let alvo: Date;
    switch (e.key) {
      case "ArrowLeft":
        alvo = somarDias(d, -1);
        break;
      case "ArrowRight":
        alvo = somarDias(d, 1);
        break;
      case "ArrowUp":
        alvo = somarDias(d, -7);
        break;
      case "ArrowDown":
        alvo = somarDias(d, 7);
        break;
      case "Home":
        alvo = somarDias(d, -d.getDay());
        break;
      case "End":
        alvo = somarDias(d, 6 - d.getDay());
        break;
      default:
        return;
    }
    e.preventDefault();
    moverPara(paraISO(alvo));
  }

  const eventosDoMes = eventosSel.filter(
    (e) => e.data <= ultimoIso && (e.data_fim ?? e.data) >= primeiroIso
  );

  const eventosSelecionados = porDia.get(selecionado) ?? [];

  const duplasDoDia = duplasPorDia.get(selecionado) ?? [];
  // mentor: o encontro da própria dupla também entra no detalhe do encontro
  // oficial de mesmo numero, mesmo quando a dupla agendou em outra data —
  // o que conecta os dois é o numero
  const numerosOficiais = new Set(
    eventosSelecionados
      .filter((e) => e.tipo === "encontro" && e.numero != null)
      .map((e) => e.numero!)
  );
  const idsNoDia = new Set(duplasDoDia.map((i) => i.encontro.id));
  const itensDupla =
    ehMentor && numerosOficiais.size > 0
      ? [
          ...duplasDoDia,
          ...duplas
            // numero-match só vale na trilha do calendário e no cronograma
            // exibido: o nº da especialista (1–5) coincide por acidente, e o
            // encontro 5 de outra turma não é o encontro 5 deste dia
            .filter((dupla) =>
              dupla.status === "ativa" &&
              dupla.trilha !== "especialista" &&
              (dupla.cronograma_id == null || dupla.cronograma_id === cronogramaSel)
            )
            .flatMap((dupla) =>
              dupla.encontros
                .filter((e) => numerosOficiais.has(e.numero) && !idsNoDia.has(e.id))
                .map((encontro) => ({ encontro, dupla }))
            ),
        ]
      : duplasDoDia;
  // anotações do mentor: uma por dupla ativa no bloco do encontro oficial
  // (âncora no nº — aparece no dia oficial mesmo com a dupla remarcada).
  // Só DPP: a especialista não tem encontro oficial pra ancorar a nota —
  // a dela aparece sob a própria linha em "Sua dupla"
  const duplasAtivas = ehMentor ? duplas.filter((d) => d.status === "ativa") : [];
  const duplasAtivasDpp = duplasAtivas.filter((d) => d.trilha !== "especialista");

  // "Hoje" só navega quando o mês de hoje está dentro da janela de meses do ciclo
  const mesHoje = mesIndice(hoje);
  const hojeNoAlcance = mesHoje >= minMes && mesHoje <= maxMes;
  // fase do mês — sufixo discreto do título, mas só quando o mês inteiro está
  // numa fase só; mês de virada não ganha rótulo que valha pra metade dele
  const fasesDoMes = new Set(
    eventosDoMes.map((e) => e.fase).filter(Boolean)
  );
  const faseDoMes = fasesDoMes.size === 1 ? [...fasesDoMes][0] : null;

  // ===== agrupamento da lista do mês por linha de semana do grid =====
  const semanaPorData = new Map<string, number>();
  semanas.forEach((sem, s) => {
    for (const cel of sem) if (cel) semanaPorData.set(cel.iso, s);
  });
  const semanaEhAtual = (s: number) =>
    semanas[s].some((cel) =>
      cel?.eventos.some((e) => e.id === eventoSemanaSel?.id)
    );
  /** Eventos que caem na linha de semana `s` do grid (dedup por id — evento
   *  multi-dia ocupa várias células da mesma semana). */
  const eventosDaSemana = (s: number): CicloEvento[] => {
    const vistos = new Map<string, CicloEvento>();
    for (const cel of semanas[s])
      for (const e of cel?.eventos ?? []) vistos.set(e.id, e);
    return [...vistos.values()];
  };
  const rotuloSemana = (s: number): string => {
    const evs = eventosDaSemana(s);
    const enc = evs.find((e) => e.tipo === "encontro" && e.numero != null);
    if (enc) return `Semana do ${enc.numero}º encontro`;
    if (evs.some((e) => e.tipo === "recesso")) return "Semana de recesso";
    if (evs.some((e) => e.tipo === "formacao")) return "Semana de formação";
    if (evs.some((e) => e.tipo === "marco")) return "Semana do marco";
    return "Semana sem eventos";
  };
  const gruposDoMes = new Map<number, CicloEvento[]>();
  for (const e of eventosDoMes) {
    // evento que começou antes do mês ancora no 1º dia visível dele
    const s = semanaPorData.get(e.data < primeiroIso ? primeiroIso : e.data);
    if (s == null) continue;
    gruposDoMes.set(s, [...(gruposDoMes.get(s) ?? []), e]);
  }
  const gruposOrdenados = [...gruposDoMes.entries()].sort((a, b) => a[0] - b[0]);

  // ===== cabeçalho editorial do detalhe =====
  const dataSel = parseDia(selecionado);
  const diaSel = dataSel.getDate();
  const mesSelLongo = fmtMesLongo.format(dataSel);
  const anoSel = dataSel.getFullYear();
  const anoSuffix =
    anoSel !== parseDia(hoje).getFullYear() ? ` de ${anoSel}` : "";
  const diffSel = diffDias(selecionado, hoje);
  const relSel =
    diffSel === 0
      ? "hoje"
      : diffSel > 0
        ? `em ${diffSel} ${diffSel === 1 ? "dia" : "dias"}`
        : `há ${-diffSel} ${diffSel === -1 ? "dia" : "dias"}`;
  // dia vazio → aponta o próximo dia com evento do ciclo (dados já em memória)
  const proximoDiaIso =
    eventosSelecionados.length === 0
      ? ([...porDia.keys()].filter((k) => k > selecionado).sort()[0] ?? null)
      : null;

  // há dots de dupla no mês visível? a mini-chave do rodapé (PV-2) só aparece
  // quando os dots que ela explica estão de fato no grid
  const temDotsDuplaNoMes = [...duplasPorDia.keys()].some(
    (k) => k >= primeiroIso && k <= ultimoIso
  );

  // ===== derivações do board da semana (visão "semana", coord/sup) =====
  const { seg: segSel, dom: domSel } = semanaBounds(parseDia(semanaIso));
  const ehSemanaAtual = segSel === segHoje;
  const segHojeClamped =
    segHoje < minSemana ? minSemana : segHoje > maxSemana ? maxSemana : segHoje;

  // eventoDaSemana tem dois fallbacks fora da semana real: recesso/gap aponta
  // o PRÓXIMO encontro, ciclo encerrado aponta o ÚLTIMO. A marca (banda lime
  // na linha da semana, anel no disco, rótulo) segue o evento em todos os
  // casos, mas o texto nunca diz "esta semana" quando não é — traduz a
  // posição relativa do evento à semana corrente
  const marcaSemana =
    eventoSemanaSel == null
      ? null
      : eventoSemanaSel.data >= segHoje && eventoSemanaSel.data <= domHoje
        ? "esta semana"
        : eventoSemanaSel.data > domHoje
          ? "próximo encontro"
          : "último encontro";
  // forma falada pra aria-labels — "encontro desta semana" lê melhor que o
  // rótulo visual solto no meio do resumo do dia
  const marcaSemanaA11y =
    marcaSemana === "esta semana" ? "encontro desta semana" : marcaSemana;

  // encontro oficial da semana exibida — critério estrito do eventoDaSemana
  // (a data cai em seg–dom), sem o fallback "próximo" dele: o board só fala
  // da semana real
  const oficialSemana =
    eventosSel
      .filter(
        (e) =>
          e.tipo === "encontro" &&
          e.numero != null &&
          e.data >= segSel &&
          e.data <= domSel
      )
      .sort((a, b) => a.data.localeCompare(b.data))[0] ?? null;

  // formação/recesso/marco que tocam a semana — linha-meta informativa, fora
  // dos agregados de encontro
  const outrosDaSemana = eventosSel.filter(
    (e) =>
      !(e.tipo === "encontro" && e.numero != null) &&
      e.data <= domSel &&
      (e.data_fim ?? e.data) >= segSel
  );

  // itens encontro↔dupla por número oficial — a unidade do board e da lista.
  // Só trilha DPP e só do cronograma selecionado: o nº 1–5 da especialista
  // colidiria com os oficiais, e o encontro 5 de outra turma não é o desta.
  // Dupla DPP sem cronograma (dado inválido pré-0061) entra em qualquer
  // recorte — invisível pra coordenação seria pior que duplicada
  const itensPorNumero = useMemo(() => {
    const mapa = new Map<number, ItemDupla[]>();
    for (const dupla of duplas) {
      if (dupla.status !== "ativa" || dupla.trilha === "especialista") continue;
      if (
        dupla.cronograma_id != null &&
        cronogramaSel != null &&
        dupla.cronograma_id !== cronogramaSel
      )
        continue;
      for (const encontro of dupla.encontros) {
        const arr = mapa.get(encontro.numero) ?? [];
        arr.push({ encontro, dupla });
        mapa.set(encontro.numero, arr);
      }
    }
    for (const itens of mapa.values())
      itens.sort(
        (a, b) =>
          (instanteDoEncontro(a.encontro)?.getTime() ??
            Number.POSITIVE_INFINITY) -
          (instanteDoEncontro(b.encontro)?.getTime() ?? Number.POSITIVE_INFINITY)
      );
    return mapa;
  }, [duplas, cronogramaSel]);

  // sem encontro oficial a leitura é por DATA (o que cai na semana, qualquer
  // número); com oficial, por NÚMERO (o que cada dupla deve pra esse encontro).
  // Recorte por data segue o cronograma selecionado: encontro de outra turma
  // na mesma semana não é cobertura desta
  const itensDaSemana = useMemo(() => {
    const itens: ItemDupla[] = [];
    for (let d = segSel; d <= domSel; d = proximoDia(d))
      for (const item of duplasPorDia.get(d) ?? [])
        if (
          item.dupla.trilha !== "especialista" &&
          (item.dupla.cronograma_id == null ||
            item.dupla.cronograma_id === cronogramaSel)
        )
          itens.push(item);
    return itens;
  }, [duplasPorDia, segSel, domSel, cronogramaSel]);
  const itensBoard = oficialSemana?.numero != null
    ? (itensPorNumero.get(oficialSemana.numero) ?? [])
    : itensDaSemana;
  const bucketsSemana = bucketsDoEncontro(itensBoard, agoraMs);

  // a coorte invisível: duplas ativas DPP sem nenhuma row do número oficial
  // (o helper filtra por evento.cronograma_id internamente — mesmo número em
  // outra turma não entra na conta)
  const semEncontroSemana =
    oficialSemana?.numero != null
      ? duplasSemEncontroDoNumero(duplas, oficialSemana)
      : [];
  const resumoOficial = oficialSemana
    ? resumoSemanaDe(duplas, oficialSemana, { seg: segSel, dom: domSel })
    : null;
  // antes da terça oficial "X de Y realizaram" ainda não é a pergunta — o
  // denominador útil é quem já marcou
  const oficialPassou = oficialSemana != null && oficialSemana.data <= hoje;
  const espAtivas = duplas.filter(
    (d) => d.status === "ativa" && d.trilha === "especialista"
  ).length;

  // painel do dia: encontro oficial do dia selecionado + a mesma coorte
  // invisível (seção "Sem encontro do Nº" — só coord/sup)
  const oficialDoDia =
    eventosSelecionados.find(
      (e) => e.tipo === "encontro" && e.numero != null
    ) ?? null;
  const faltantesDoDia =
    ehCoordSup && oficialDoDia?.numero != null
      ? duplasSemEncontroDoNumero(duplas, oficialDoDia)
      : [];
  const bucketsDoDia = bucketsDoEncontro(itensDupla, agoraMs);

  /** Row compartilhada do painel do dia e do board da semana — o `selecionado`
   *  decide se a data aparece completa (na semana ela importa: fora do
   *  alcance, `mesmoDia` é sempre falso). */
  const rowDupla = (item: ItemDupla, i: number, sel: string) => (
    <EncontroDuplaRow
      key={item.encontro.id}
      item={item}
      selecionado={sel}
      agora={agoraMs}
      ehMentor={ehMentor}
      souCoord={ehCoord}
      indice={i}
      evento={passoDe(item.dupla, item.encontro.numero)}
      aberto={registroAberto === item.encontro.id}
      onAlternarRegistro={(abrir) =>
        setRegistroAberto(abrir ? item.encontro.id : null)
      }
      onRegistroSalvo={() => {
        setRegistroAberto(null);
        router.refresh();
      }}
    />
  );

  /** "12–18 jan 2026" / "30 dez–4 jan 2026" — range compacto da semana pro
   *  chrome e pro header do board. */
  function rangeSemana(aIso: string, bIso: string): string {
    const a = parseDia(aIso);
    const b = parseDia(bIso);
    const mesmoMes =
      a.getMonth() === b.getMonth() && a.getFullYear() === b.getFullYear();
    const mesmoAno = a.getFullYear() === b.getFullYear();
    const ladoA = `${a.getDate()}${mesmoMes ? "" : ` ${MESES_CURTOS[a.getMonth()]}`}${mesmoAno ? "" : ` ${a.getFullYear()}`}`;
    return `${ladoA}–${b.getDate()} ${MESES_CURTOS[b.getMonth()]} ${b.getFullYear()}`;
  }
  const rotuloSemanaIso = rangeSemana(segSel, domSel);

  if (eventosSel.length === 0) return null;

  return (
    <div
      className={cn(
        "space-y-4",
        // o grid de duas colunas (calendário + painel) só existe no modo "mes";
        // semana e lista são coluna única full-width
        visaoEfetiva === "mes" &&
          "lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(300px,340px)] lg:items-start lg:gap-5 lg:space-y-0"
      )}
    >
      {/* ===== calendário / board da semana / lista do ciclo ===== */}
      <div className="overflow-hidden rounded-xl bg-card shadow-[var(--shadow-border)] lg:col-start-1 lg:row-start-1">
        {/* chrome do card, uma faixa só: "como olhar" à esquerda (visão,
            só coord/sup — a unidade de trabalho delas é a semana) + "o que
            olhar" à direita (turma, quando há mais de um cronograma
            aplicável). Mentor com um cronograma só não ganha faixa vazia:
            o card abre direto na nav/mês */}
        {(ehCoordSup || opcoesCron.length > 1) && (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 border-b px-2 py-1.5 sm:px-3">
            {ehCoordSup && (
              // escolha exclusiva → radio nativo (padrão OpcaoPilula): setas do
              // teclado e "selecionado" na leitura de tela saem de graça; a
              // pill ativa veste a língua do filter-chip (bg-foreground) em vez
              // do bg-muted que sumia na barra
              <fieldset className="flex items-center gap-1">
                <legend className="sr-only">Visão da agenda</legend>
                {(
                  [
                    ["semana", "Semana"],
                    ["mes", "Mês"],
                    ["lista", "Lista"],
                  ] as const
                ).map(([v, rotulo]) => (
                  <label
                    key={v}
                    className={cn(
                      filterChipCls(visao === v),
                      // o foco cai no input sr-only — o anel via has-focus-visible
                      // é o equivalente do focus-visible do chip
                      "flex-1 cursor-pointer justify-center sm:flex-none",
                      "has-focus-visible:ring-2 has-focus-visible:ring-ring"
                    )}
                  >
                    <input
                      type="radio"
                      name="agenda-visao"
                      value={v}
                      checked={visao === v}
                      onChange={() => setVisao(v)}
                      className="sr-only"
                    />
                    {rotulo}
                  </label>
                ))}
              </fieldset>
            )}

            {/* seletor de turma (0061) — com duas turmas ativas, cada uma tem
                seu calendário oficial: a agenda mostra uma por vez, nunca a
                união. Vale pra coord/sup e pro mentor com duplas em turmas
                diferentes. O valor é a turma ("T1 · 2026/2027", nunca
                trunca); o item carrega a posição da turma no ciclo */}
            {opcoesCron.length > 1 && (
              <div className="ms-auto flex items-center gap-2">
                <Label
                  htmlFor="agenda-cronograma"
                  className="shrink-0 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground"
                >
                  Turma
                </Label>
                <Select
                  value={cronogramaSel ?? undefined}
                  onValueChange={(v) => setCronogramaSel(v)}
                  items={Object.fromEntries(
                    opcoesCron.map((c) => [
                      c.id,
                      turmasRepetidas.has(c.turma)
                        ? `${c.turma} · ${c.nome}`
                        : c.turma,
                    ])
                  )}
                >
                  <SelectTrigger
                    id="agenda-cronograma"
                    className="h-8 w-auto min-w-0 max-w-full font-medium"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent
                    alignItemWithTrigger={false}
                    className="min-w-64"
                  >
                    {opcoesCron.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        <span className="flex flex-col">
                          <span className="font-medium">
                            {c.turma}
                            {turmasRepetidas.has(c.turma) && ` · ${c.nome}`}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {metaCronograma(c, duplas, eventos, hoje)}
                          </span>
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
        )}

        {/* chrome de navegação — por-visão: meses no "mes", semanas na
            "semana"; a "lista" é a visão geral e não navega */}
        {visaoEfetiva !== "lista" && (
          <div className="flex items-center gap-1 border-b px-2 py-1.5 sm:px-3">
            <button
              type="button"
              aria-label={
                visaoEfetiva === "semana" ? "Semana anterior" : "Mês anterior"
              }
              disabled={
                visaoEfetiva === "semana" ? semanaIso <= minSemana : mes <= minMes
              }
              onClick={() =>
                visaoEfetiva === "semana"
                  ? irParaSemana(paraISO(somarDias(parseDia(semanaIso), -7)))
                  : irParaMes(mes - 1)
              }
              className="grid size-11 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-40 md:size-9"
            >
              <CaretLeft size={18} />
            </button>
            <button
              type="button"
              aria-label={
                visaoEfetiva === "semana" ? "Próxima semana" : "Próximo mês"
              }
              disabled={
                visaoEfetiva === "semana" ? semanaIso >= maxSemana : mes >= maxMes
              }
              onClick={() =>
                visaoEfetiva === "semana"
                  ? irParaSemana(paraISO(somarDias(parseDia(semanaIso), 7)))
                  : irParaMes(mes + 1)
              }
              className="grid size-11 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-40 md:size-9"
            >
              <CaretRight size={18} />
            </button>
            <button
              type="button"
              disabled={
                visaoEfetiva === "semana"
                  ? semanaIso === segHojeClamped
                  : mes === mesHoje || !hojeNoAlcance
              }
              onClick={() =>
                visaoEfetiva === "semana"
                  ? irParaSemana(segHoje)
                  : irParaMes(mesHoje)
              }
              className="ms-0.5 min-h-11 rounded-lg px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-40 md:min-h-9"
            >
              Hoje
            </button>
            <p
              id="agenda-mes-rotulo"
              aria-live="polite"
              className="min-w-0 flex-1 truncate px-2.5 text-lg font-semibold tracking-tight"
            >
              {visaoEfetiva === "semana" ? (
                rotuloSemanaIso
              ) : (
                <>
                  {/* a 390px "Setembro de 2026" truncava o ano — mobile lê o
                      formato curto ("set 2026"), sm+ mantém o longo + fase */}
                  <span className="sm:hidden">
                    {MESES_CURTOS[mesNum]} {ano}
                  </span>
                  <span className="hidden sm:inline">
                    {capitalizar(rotuloMes)}
                  </span>
                  {faseDoMes && (
                    <span className="hidden text-sm font-normal tracking-normal text-muted-foreground sm:inline">
                      {" · "}
                      {faseDoMes}
                    </span>
                  )}
                </>
              )}
            </p>
          </div>
        )}

        {/* rail do ciclo — trilha 1—16 dos encontros oficiais; mesma gramática
            de disco das células, conector lime só no trecho já percorrido.
            No "mes" o toque abre o dia; na "semana" navega pra semana dele. */}
        {visaoEfetiva !== "lista" && encontrosRail.length >= 2 && (
          <nav
            aria-label="Encontros da jornada"
            className="border-b px-3 pb-1.5 pt-2 sm:px-4"
          >
            <div className="scroll-fina flex items-center overflow-x-auto pb-1">
              {encontrosRail.map((e, i) => {
                const passou = e.data < hoje;
                const atual = e.id === eventoSemanaSel?.id;
                // semana exibida no board ≠ semana atual: o disco ganha o
                // anel de seleção (mesma gramática do dia selecionado no grid)
                const exibida =
                  visaoEfetiva === "semana" &&
                  oficialSemana?.id === e.id &&
                  !atual;
                const prevPassou = i > 0 && encontrosRail[i - 1].data < hoje;
                const dataFmt = fmtCompleta.format(parseDia(e.data));
                // nó passado carrega a cobertura falada pra quem monitora —
                // o rail vira mapa de monitoramento sem ganhar ruído visual
                const cobertura =
                  ehCoordSup && passou ? resumoSemanaDe(duplas, e) : null;
                const rotuloBase =
                  visaoEfetiva === "semana"
                    ? `Ir para a semana do ${e.numero}º encontro, ${dataFmt}`
                    : `Ir para o ${e.numero}º encontro, ${dataFmt}`;
                return (
                  <Fragment key={e.id}>
                    {i > 0 && (
                      <span
                        aria-hidden
                        className={cn(
                          "h-px min-w-1.5 flex-1",
                          prevPassou && passou
                            ? "bg-[var(--brand-lime)]"
                            : "bg-border"
                        )}
                      />
                    )}
                    <button
                      type="button"
                      ref={atual ? refRailAtual : undefined}
                      title={dataFmt}
                      aria-label={
                        cobertura
                          ? `${rotuloBase}, ${cobertura.realizaram} de ${cobertura.total} ${cobertura.total === 1 ? "dupla realizou" : "duplas realizaram"}`
                          : rotuloBase
                      }
                      aria-current={atual ? "date" : undefined}
                      onClick={(ev) => {
                        if (visaoEfetiva === "semana") {
                          irParaSemana(semanaBounds(parseDia(e.data)).seg);
                        } else {
                          pedirRolarSePonteiro(ev, e.data);
                          moverPara(e.data);
                        }
                      }}
                      className="grid size-11 shrink-0 place-items-center rounded-full font-mono text-[11px] font-semibold leading-none tabular-nums transition-[color,background-color,box-shadow] hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:size-9"
                    >
                      <span
                        className={cn(
                          "grid place-items-center rounded-full",
                          atual
                            ? "size-7 bg-[var(--brand-lime)] text-[var(--brand-ink)] ring-2 ring-[var(--brand-lime)]/40 ring-offset-2 ring-offset-card"
                            : passou
                              ? "size-6 bg-[var(--brand-lime)] text-[var(--brand-ink)] sm:size-7"
                              : "size-6 bg-muted text-muted-foreground sm:size-7",
                          exibida &&
                            "ring-2 ring-foreground/30 ring-offset-2 ring-offset-card"
                        )}
                      >
                        {e.numero}
                      </span>
                    </button>
                  </Fragment>
                );
              })}
            </div>
            {/* legenda do rail — lime = data oficial passada (não
                "realizada"); o anel lime marca a semana corrente. O anel
                cinza de "semana exibida" é affordance de seleção e fica
                fora da legenda, como o dia selecionado do grid */}
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pt-1 pb-1 text-[11px] text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <span
                  aria-hidden
                  className="size-3 rounded-full bg-[var(--brand-lime)]"
                />
                data passada
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span
                  aria-hidden
                  className="size-3 rounded-full bg-[var(--brand-lime)] ring-2 ring-[var(--brand-lime)]/40 ring-offset-1 ring-offset-card"
                />
                semana atual
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span aria-hidden className="size-3 rounded-full bg-muted" />
                por vir
              </span>
            </div>
          </nav>
        )}

        {/* ===== visão "mes": grade de dias + legenda (mentor = sempre esta) ===== */}
        {visaoEfetiva === "mes" && (
        <>
        <div role="grid" aria-labelledby="agenda-mes-rotulo">
          <div role="row" className="grid grid-cols-7 border-b">
            {DIAS_SEMANA.map((d, i) => (
              <span
                role="columnheader"
                key={d}
                aria-label={DIAS_SEMANA_COMPLETOS[i]}
                className="py-2 text-center text-[11px] font-medium uppercase tracking-wider text-muted-foreground"
              >
                {d}
              </span>
            ))}
          </div>

          {/* re-monta a cada mês → slide direcional (--dir = lado de onde veio) */}
          <div
            key={mes}
            role="presentation"
            className="animate-enter-x"
            style={{ "--dir": `${direcao * 8}px` } as CSSProperties}
          >
            {semanas.map((semana, s) => {
              // semana do encontro → faixa lime que atravessa a linha inteira
              const semanaAtual = semana.some((cel) =>
                cel?.eventos.some((e) => e.id === eventoSemanaSel?.id)
              );
              return (
              <div
                role="row"
                key={s}
                className={cn(
                  "grid grid-cols-7",
                  semanaAtual && "bg-[var(--brand-lime)]/8"
                )}
              >
                {semana.map((cel, c) => {
                  if (!cel)
                    return <div role="gridcell" key={`vazio-${s}-${c}`} aria-hidden />;
                  const { iso, dia, eventos: doDia } = cel;
                  const duplasDoDia = duplasPorDia.get(iso) ?? [];
                  const temRecesso = doDia.some((e) => e.tipo === "recesso");
                  const inicioRecesso = doDia.some(
                    (e) => e.tipo === "recesso" && e.data === iso
                  );
                  const ehHoje = iso === hoje;
                  const ehSelecionado = iso === selecionado;
                  const passou = iso < hoje;
                  const fimDeSemana = c === 0 || c === 6;

                  const rotuloDia =
                    (doDia.length > 0
                      ? `${doDia.map(descricaoEvento).join(" e ")}, ${fmtCompleta.format(parseDia(iso))}`
                      : `${fmtCompleta.format(parseDia(iso))}, sem eventos oficiais`) +
                    // o anel lime no disco é cor — a marca temporal precisa
                    // entrar no nome falado do dia ("encontro desta semana")
                    (doDia.some((e) => e.id === eventoSemanaSel?.id) &&
                    marcaSemanaA11y
                      ? `, ${marcaSemanaA11y}`
                      : "") +
                    (duplasDoDia.length > 0
                      ? `, ${resumoEncontrosDupla(duplasDoDia, agoraMs)}`
                      : "");

                  return (
                    <div role="gridcell" key={iso} className="p-0.5">
                      <button
                        ref={(el) => {
                          if (el) refsDias.current.set(iso, el);
                          else refsDias.current.delete(iso);
                        }}
                        type="button"
                        tabIndex={iso === diaAtivo ? 0 : -1}
                        aria-pressed={ehSelecionado}
                        aria-current={ehHoje ? "date" : undefined}
                        aria-label={rotuloDia}
                        onClick={(e) => {
                          pedirRolarSePonteiro(e, iso);
                          // reclicar no dia já aberto não deve derrubar o modal
                          // de registro que está dentro dele
                          if (iso !== selecionado) setRegistroAberto(null);
                          setSelecionado(iso);
                        }}
                        onKeyDown={(e) => onDiaKeyDown(e, iso)}
                        className={cn(
                          "flex min-h-11 w-full flex-col items-start rounded-lg px-1.5 pb-1 pt-1 transition-[color,background-color,box-shadow] hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:min-h-12",
                          temRecesso && "hatch-recesso",
                          ehSelecionado && "ring-2 ring-foreground/30"
                        )}
                      >
                        <span
                          aria-hidden
                          className="flex w-full items-center justify-between gap-1"
                        >
                          <span
                            className={cn(
                              "grid size-6 place-items-center text-[13px] font-medium tabular-nums sm:text-sm",
                              ehHoje
                                ? "rounded-full bg-[var(--brand-ink)] text-white"
                                : fimDeSemana
                                  ? "text-muted-foreground/80"
                                  : passou
                                    ? "text-muted-foreground"
                                    : "text-foreground"
                            )}
                          >
                            {dia}
                          </span>
                          {inicioRecesso && (
                            <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                              Recesso
                            </span>
                          )}
                        </span>
                        <span
                          aria-hidden
                          className="mt-auto flex w-full items-center gap-1"
                        >
                          {doDia.map((e) => {
                            if (e.tipo === "encontro")
                              return (
                                <span
                                  key={e.id}
                                  className={cn(
                                    "grid size-5 place-items-center rounded-full bg-[var(--brand-lime)] text-[11px] font-semibold leading-none tabular-nums text-[var(--brand-ink)]",
                                    // encontro da semana corrente: anel lime
                                    // (mesma gramática do nó "atual" do rail)
                                    e.id === eventoSemanaSel?.id &&
                                      "ring-2 ring-[var(--brand-lime)]/60 ring-offset-1 ring-offset-card"
                                  )}
                                >
                                  {e.numero ?? "•"}
                                </span>
                              );
                            if (e.tipo === "formacao")
                              return (
                                <GraduationCap
                                  key={e.id}
                                  size={15}
                                  weight="bold"
                                  className="text-[var(--warn-text)]"
                                />
                              );
                            if (e.tipo === "marco")
                              return (
                                <Flag
                                  key={e.id}
                                  size={14}
                                  weight="bold"
                                  className="text-[var(--ok-text)]"
                                />
                              );
                            return null; // recesso = hatch + label, sem marcador
                          })}
                          {/* dots individuais até 3 encontros; além disso só
                              a contagem — tingida pelo pior status acionável
                              do dia (pendente = realizado sem registro OU
                              limbo; o detalhe vive no painel e no board) */}
                          {duplasDoDia.length <= 3 ? (
                            duplasDoDia.map(({ encontro }) => (
                              <span
                                key={encontro.id}
                                className={cn(
                                  "size-2 shrink-0 rounded-full",
                                  corDotEncontro(encontro)
                                )}
                              />
                            ))
                          ) : (
                            <span
                              className={cn(
                                "ms-auto text-[11px] font-medium leading-none tabular-nums",
                                duplasDoDia.some(
                                  ({ encontro }) =>
                                    (encontro.status === "realizado" &&
                                      !encontro.registro) ||
                                    emLimbo(encontro, agoraMs)
                                )
                                  ? "text-[var(--warn-text)]"
                                  : "text-muted-foreground"
                              )}
                            >
                              {duplasDoDia.length}
                            </span>
                          )}
                        </span>
                      </button>
                    </div>
                  );
                })}
              </div>
              );
            })}
          </div>
        </div>

        {/* legenda — mesma gramática da célula; com dots de dupla no mês, a
            mini-chave deles entra aqui, perto de onde a cor aparece (PV-2) */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t px-4 py-3">
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span
              aria-hidden
              className="grid size-5 place-items-center rounded-full bg-[var(--brand-lime)] text-[11px] font-semibold leading-none tabular-nums text-[var(--brand-ink)]"
            >
              1
            </span>
            Encontro
          </span>
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span
              aria-hidden
              className="hatch-recesso h-3.5 w-5 rounded-[3px] ring-1 ring-inset ring-border"
            />
            Recesso
          </span>
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span
              aria-hidden
              className="grid size-5 place-items-center rounded-full bg-[var(--brand-ink)] text-[11px] font-semibold leading-none tabular-nums text-white"
            >
              1
            </span>
            Hoje
          </span>
          {temDotsDuplaNoMes && (
            <span className="flex flex-wrap items-center gap-x-3 gap-y-1 border-l border-border pl-4">
              <span className="text-xs font-medium text-muted-foreground">
                Duplas:
              </span>
              <ChaveDotsDupla />
            </span>
          )}
        </div>
        </>
        )}

        {/* ===== visão "semana" (coord/sup): o board do encontro oficial ===== */}
        {visaoEfetiva === "semana" && (
          <div
            key={semanaIso}
            className="animate-enter-x"
            style={{ "--dir": `${direcao * 8}px` } as CSSProperties}
          >
            <header className="px-4 pb-1 pt-4 sm:px-5">
              <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                <h2 className="text-base font-semibold tracking-tight sm:text-lg">
                  {/* o título é só a pergunta da semana — o tema desce pro
                      meta; sem encontro oficial, o tipo dominante nomeia a
                      semana (espelha rotuloSemana) */}
                  {oficialSemana?.numero != null
                    ? `Semana do ${oficialSemana.numero}º encontro`
                    : outrosDaSemana.some((e) => e.tipo === "recesso")
                      ? "Semana de recesso"
                      : outrosDaSemana.some((e) => e.tipo === "formacao")
                        ? "Semana de formação"
                        : outrosDaSemana.some((e) => e.tipo === "marco")
                          ? "Semana do marco"
                          : `Semana de ${rotuloSemanaIso}`}
                </h2>
                {ehSemanaAtual && (
                  <span className="inline-flex items-center gap-1.5 text-xs font-semibold">
                    <span
                      aria-hidden
                      className="size-1.5 rounded-full bg-[var(--brand-lime)]"
                    />
                    esta semana
                  </span>
                )}
              </div>
              {/* meta = tema + dia oficial; o range da semana mora uma vez na
                  nav ("5–11 out 2026") e não se repete aqui */}
              {oficialSemana != null && (
                <p className="mt-0.5 text-sm text-muted-foreground">
                  {oficialSemana.titulo} · {diaCompacto(oficialSemana.data)}
                </p>
              )}
              {/* eventos do ciclo que tocam a semana e não são o encontro
                  oficial — linha-meta informativa, fora dos agregados */}
              {outrosDaSemana.length > 0 && (
                <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-sm text-muted-foreground">
                  {outrosDaSemana.map((e) => (
                    <span key={e.id} className="inline-flex items-center gap-1.5">
                      <MarcadorTipo tipo={e.tipo} nome={e.titulo} />
                      <span>
                        {e.titulo} · {diaCompacto(e.data)}
                        {e.data_fim ? `–${diaCompacto(e.data_fim)}` : ""}
                      </span>
                    </span>
                  ))}
                </p>
              )}
              {/* cobertura do encontro oficial — passada: quem realizou e
                  entregou registro; futura: quem já marcou */}
              {resumoOficial && (
                <div className="mt-3">
                  <p className="text-sm text-muted-foreground">
                    {oficialPassou ? (
                      <>
                        <span className="font-medium text-foreground">
                          {resumoOficial.realizaram} de {resumoOficial.total}
                        </span>{" "}
                        {resumoOficial.total === 1
                          ? "dupla realizou"
                          : "duplas realizaram"}{" "}
                        · {resumoOficial.comRegistro}{" "}
                        {resumoOficial.comRegistro === 1
                          ? "registro entregue"
                          : "registros entregues"}
                        {resumoOficial.reposicao > 0 &&
                          ` · ${resumoOficial.reposicao} em reposição`}
                      </>
                    ) : (
                      <>
                        <span className="font-medium text-foreground">
                          {itensBoard.length -
                            bucketsSemana.naoAconteceram.length}{" "}
                          de {resumoOficial.total}
                        </span>{" "}
                        {resumoOficial.total === 1
                          ? "dupla com encontro"
                          : "duplas com encontro"}{" "}
                        marcado
                      </>
                    )}
                  </p>
                  <div className="mt-1.5">
                    <div className="flex items-center gap-2">
                      <ResumoEncontrosDupla itens={itensBoard} agora={agoraMs} />
                    </div>
                    {/* legenda nomeada — nenhum dígito solto perto da barra */}
                    <LegendaEncontrosDupla itens={itensBoard} agora={agoraMs} />
                  </div>
                </div>
              )}
            </header>

            <div className="px-2 pb-3 pt-1 sm:px-3">
              {itensBoard.length > 0 && (
                <BucketsEncontros
                  buckets={bucketsSemana}
                  renderItem={(item, i) => rowDupla(item, i, "")}
                />
              )}

              {/* a coorte invisível: quem ainda não marcou o encontro oficial
                  — a ferramenta de nudge da coordenação */}
              {oficialSemana?.numero != null &&
                semEncontroSemana.length > 0 && (
                  <div>
                    <p className="px-2 pb-0.5 pt-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                      Sem o {oficialSemana.numero}º encontro marcado (
                      {semEncontroSemana.length})
                    </p>
                    <ul>
                      {semEncontroSemana.map((d) => (
                        <LinhaSemEncontro
                          key={d.id}
                          dupla={d}
                          numero={oficialSemana.numero!}
                        />
                      ))}
                    </ul>
                  </div>
                )}

              {itensBoard.length === 0 && semEncontroSemana.length === 0 && (
                <p className="px-2 py-6 text-sm text-muted-foreground">
                  {oficialSemana
                    ? "Nenhuma dupla ativa neste encontro ainda."
                    : "Nenhum encontro agendado nesta semana."}
                </p>
              )}
            </div>
          </div>
        )}

        {/* ===== visão "lista" (coord/sup): cobertura do ciclo inteiro ===== */}
        {visaoEfetiva === "lista" && (
          <div>
            <p className="px-4 pb-1 pt-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground sm:px-5">
              Cobertura do ciclo
            </p>
            <ul className="divide-y divide-border/60 pb-1">
              {[...eventosSel]
                .sort((a, b) => a.data.localeCompare(b.data))
                .map((e) => {
                  const ehEncontro = e.tipo === "encontro" && e.numero != null;
                  const itensN = ehEncontro
                    ? (itensPorNumero.get(e.numero!) ?? [])
                    : [];
                  const resumoN = ehEncontro ? resumoSemanaDe(duplas, e) : null;
                  const passouN = e.data <= hoje;
                  // "com encontro marcado" = tem row que não seja
                  // não-aconteceu/cancelado — a fração honesta da semana futura
                  const marcaramN =
                    itensN.length -
                    bucketsDoEncontro(itensN, agoraMs).naoAconteceram.length;
                  const nomeEvento = ehEncontro
                    ? `${e.numero}º encontro · ${e.titulo}`
                    : e.titulo;
                  return (
                    <li key={e.id}>
                      <button
                        type="button"
                        onClick={() => {
                          // a linha inteira salta pra semana do evento — a
                          // visão "semana" é onde a cobertura se trabalha
                          irParaSemana(semanaBounds(parseDia(e.data)).seg);
                          setVisao("semana");
                        }}
                        className={cn(
                          "flex w-full flex-wrap items-center gap-x-3 gap-y-1.5 px-4 py-3 text-left transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring sm:px-5",
                          // a linha do encontro da semana corrente ganha o
                          // fundo lime — mesma faixa da linha de semana no mês
                          e.id === eventoSemanaSel?.id &&
                            "bg-[var(--brand-lime)]/8"
                        )}
                      >
                        <span className="w-20 shrink-0 whitespace-nowrap text-sm tabular-nums text-muted-foreground">
                          {diaCompacto(e.data)}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium">
                            {nomeEvento}
                          </span>
                          {(e.fase || e.data_fim) && (
                            <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                              {[
                                e.fase,
                                e.data_fim && `até ${diaCompacto(e.data_fim)}`,
                              ]
                                .filter(Boolean)
                                .join(" · ")}
                            </span>
                          )}
                        </span>
                        {ehEncontro && (
                          <span className="flex basis-full items-center gap-2 sm:basis-56">
                            {itensN.length > 0 ? (
                              <ResumoEncontrosDupla
                                itens={itensN}
                                agora={agoraMs}
                              />
                            ) : (
                              <span
                                aria-hidden
                                className="h-2 min-w-4 flex-1 rounded-full bg-muted"
                              />
                            )}
                            {/* passado: quem realizou; futuro: quem já marcou */}
                            <span
                              title={
                                resumoN && passouN
                                  ? `${resumoN.realizaram} de ${resumoN.total} ${resumoN.total === 1 ? "dupla realizou" : "duplas realizaram"}`
                                  : resumoN
                                    ? `${marcaramN} de ${resumoN.total} ${resumoN.total === 1 ? "dupla com encontro" : "duplas com encontro"} marcado`
                                    : undefined
                              }
                              className="shrink-0 font-mono text-xs text-muted-foreground"
                            >
                              {resumoN &&
                                (passouN
                                  ? `${resumoN.realizaram}/${resumoN.total}`
                                  : `${marcaramN}/${resumoN.total}`)}
                            </span>
                          </span>
                        )}
                        <MarcadorTipo tipo={e.tipo} nome={nomeEvento} />
                        {/* marca do encontro da semana corrente — texto
                            completo entra no nome acessível da linha */}
                        {e.id === eventoSemanaSel?.id && marcaSemana && (
                          <span className="inline-flex shrink-0 items-center gap-1.5 text-xs font-semibold">
                            <span
                              aria-hidden
                              className="size-1.5 rounded-full bg-[var(--brand-lime)]"
                            />
                            {marcaSemana}
                          </span>
                        )}
                      </button>
                    </li>
                  );
                })}
            </ul>
          </div>
        )}

        {/* trilha especialista: fora de todos os agregados por-cronograma (os
            encontros dela não são terças do ciclo) — nota de rodapé no card,
            visível nas três visões; a saída é a lista de duplas, não um
            número aqui */}
        {espAtivas > 0 && (
          <p className="border-t px-4 py-2.5 text-xs text-muted-foreground sm:px-5">
            <Link
              href="/duplas"
              className="inline-flex items-center gap-1 rounded-md py-0.5 transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {espAtivas} {espAtivas === 1 ? "dupla" : "duplas"} em trilha
              especialista — fora do calendário de terças
              <ArrowUpRight aria-hidden size={12} />
            </Link>
          </p>
        )}
      </div>

      {/* ===== detalhe do dia selecionado (visão "mes") ===== */}
      {visaoEfetiva === "mes" && (
      <section
        ref={refDetalhe}
        aria-label="Detalhe do dia selecionado"
        className="scroll-mt-20 scroll-fina rounded-xl bg-card px-4 py-4 shadow-[var(--shadow-border)] sm:px-5 lg:sticky lg:top-4 lg:col-start-2 lg:row-start-1 lg:max-h-[calc(100dvh-2rem)] lg:overflow-y-auto"
      >
        {/* live region enxuta (PV-4): anuncia só data + relativo — a seção
            remonta a cada dia e aria-live nela despejava o painel inteiro */}
        <p aria-live="polite" className="sr-only">
          {capitalizar(fmtCompleta.format(dataSel))}, {relSel}
        </p>
        {/* crossfade entre dias — continuidade espacial onde a saída era corte
            seco; initial=false: o primeiro paint não anima (spec §2/§5) */}
        <AnimatePresence mode="wait" initial={false}>
          <motion.div key={selecionado} {...fade} transition={T.enter}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm text-muted-foreground">
                  {diaSemanaCurto(selecionado)}
                </p>
                <p className="mt-1 flex items-baseline gap-2">
                  <span className="text-3xl font-semibold tracking-tight tabular-nums sm:text-4xl">
                    {diaSel}
                  </span>
                  <span className="text-lg text-muted-foreground">
                    de {mesSelLongo}
                    {anoSuffix}
                  </span>
                </p>
              </div>
              <p
                className={cn(
                  "pt-0.5 text-sm",
                  diffSel === 0
                    ? "font-medium text-foreground"
                    : "text-muted-foreground"
                )}
              >
                {relSel}
              </p>
            </div>
            {eventosSelecionados.length === 0 ? (
              <div className="mt-3">
                <p className="text-sm text-muted-foreground">
                  Nenhum evento oficial neste dia.
                </p>
                {proximoDiaIso && (
                  <button
                    type="button"
                    onClick={(e) => {
                      pedirRolarSePonteiro(e, proximoDiaIso);
                      moverPara(proximoDiaIso);
                    }}
                    className="mt-1 block w-full rounded-md py-3 text-left text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    Próximo evento oficial:{" "}
                    <span className="font-medium text-foreground">
                      {descricaoEvento(porDia.get(proximoDiaIso)![0])} ·{" "}
                      {diaCompacto(proximoDiaIso)}
                    </span>
                  </button>
                )}
              </div>
            ) : (
              <div className="mt-3 space-y-4">
                {eventosSelecionados.map((e) => {
                  const nomeEvento =
                    e.numero != null
                      ? `${e.numero}º encontro · ${e.titulo}`
                      : e.titulo;
                  const tipoJaDito = tipoDitoNoNome(e.tipo, nomeEvento);
                  // materiais que o guia pede pra este encontro (por nº) — a
                  // seção só renderiza quando existe o que mostrar
                  const materiaisDoEncontro =
                    e.tipo === "encontro" && e.numero != null
                      ? (materiaisPorNumero.get(e.numero) ?? [])
                      : [];
                  return (
                  <div key={e.id} className="space-y-1.5">
                    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                      <h2 className="text-base font-semibold tracking-tight sm:text-lg">
                        {nomeEvento}
                      </h2>
                      {e.id === eventoSemanaSel?.id && marcaSemana && (
                        <span className="inline-flex items-center gap-1.5 text-xs font-semibold">
                          <span
                            aria-hidden
                            className="size-1.5 rounded-full bg-[var(--brand-lime)]"
                          />
                          {marcaSemana}
                        </span>
                      )}
                    </div>
                    {/* a linha-meta só existe se tiver o que dizer: palavra do
                        tipo quando o título não a carrega, e/ou a fase */}
                    {(e.fase || !tipoJaDito) && (
                      <p className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-sm text-muted-foreground">
                        <MarcadorTipo tipo={e.tipo} nome={nomeEvento} />
                        {e.fase && (
                          <span>{tipoJaDito ? e.fase : `· ${e.fase}`}</span>
                        )}
                      </p>
                    )}
                    {e.data_fim && (
                      <p className="text-sm text-muted-foreground">
                        de {diaCompacto(e.data)} a {diaCompacto(e.data_fim)}
                      </p>
                    )}
                    {e.instrumentos.length > 0 && (
                      <p className="text-sm text-muted-foreground">
                        Instrumentos:{" "}
                        <span className="text-foreground">
                          {e.instrumentos.join(", ")}
                        </span>
                      </p>
                    )}
                    {/* materiais que o guia pede pro encontro — sem material,
                        o bloco não renderiza (nada de seção vazia) */}
                    {materiaisDoEncontro.length > 0 && (
                      <div className="pt-1.5">
                        <h3 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                          Materiais do encontro
                        </h3>
                        <ul className="mt-0.5">
                          {materiaisDoEncontro.map((m) => (
                            <MaterialDoEncontro key={m.id} m={m} />
                          ))}
                        </ul>
                      </div>
                    )}
                    {/* chamada do encontro de formação — ritual de presença
                        do guia; só a coordenação vê/marca (escopo: formacao,
                        não marco) */}
                    {ehCoord && e.tipo === "formacao" && (
                      <ChamadaFormacao
                        eventoId={e.id}
                        mentores={mentores}
                        presentes={presencas[e.id] ?? SEM_PRESENCAS}
                      />
                    )}
                    {/* cobertura do encontro oficial entre as duplas — só coord/supervisor */}
                    {ehCoordSup &&
                      e.tipo === "encontro" &&
                      e.numero != null &&
                      duplas.length > 0 && (
                        <CoberturaEncontro duplas={duplas} numero={e.numero} />
                      )}
                    {/* plano de aula/anotações do mentor — uma por dupla ativa
                        da trilha DPP, rotulada pelo mentorado quando ele tem
                        mais de uma */}
                    {e.tipo === "encontro" &&
                      e.numero != null &&
                      duplasAtivasDpp.map((d) => (
                        <NotaEncontro
                          key={d.id}
                          duplaId={d.id}
                          numero={e.numero!}
                          nota={
                            d.notas?.find((n) => n.numero === e.numero)?.texto ?? null
                          }
                          rotulo={
                            duplasAtivasDpp.length > 1 ? d.mentorado.nome : undefined
                          }
                        />
                      ))}
                  </div>
                  );
                })}
              </div>
            )}
            {/* encontros das duplas no dia — visível mesmo sem evento oficial.
                A superfície tinta separa "seu" (linhas + ações) do oficial do
                ciclo (o que o programa diz sobre o dia). Pra coord/sup o bloco
                também hospeda a coorte invisível do encontro oficial do dia,
                então ela sozinha já abre a superfície */}
            {(itensDupla.length > 0 || faltantesDoDia.length > 0) && (
              <div
                className={cn(
                  // poço inset — afunda na superfície do painel pra separar
                  // "seu" (linhas + ações) do oficial do ciclo
                  "rounded-xl bg-muted/50 p-3 shadow-[var(--shadow-inset)]",
                  eventosSelecionados.length > 0 ? "mt-4" : "mt-3"
                )}
              >
                {itensDupla.length > 0 && (
                  <>
                    <h3 className="px-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                      {ehMentor ? "Sua dupla" : "Duplas"}
                    </h3>
                    {/* chave dos dots de status — contextual, junto de onde eles aparecem */}
                    <ChaveDotsDupla className="mt-1 px-2" />
                    {/* com muitos itens a leitura é por status (mesmo componente
                        do board da semana); dia leve segue lista plana */}
                    {ehCoordSup && itensDupla.length > 5 ? (
                      <BucketsEncontros
                        buckets={bucketsDoDia}
                        renderItem={(item, i) => rowDupla(item, i, selecionado)}
                      />
                    ) : (
                      <ul className="mt-1.5">
                        {itensDupla.map((item, i) =>
                          rowDupla(item, i, selecionado)
                        )}
                      </ul>
                    )}
                  </>
                )}
                {/* encontro agendado fora do dia oficial (nº sem evento do ciclo
                    aqui) não tem bloco próprio acima — a anotação mora sob a
                    linha, rotulada pelo nº (v1: só o mentor escreve) */}
                {ehMentor &&
                  itensDupla
                    // na trilha especialista o nº nunca tem "dia oficial" — a
                    // nota mora sempre sob a linha do encontro dela. DPP
                    // compara com os oficiais do cronograma DA DUPLA
                    .filter(
                      (i) =>
                        i.dupla.trilha === "especialista" ||
                        !numerosOficiaisDe(i.dupla).has(i.encontro.numero)
                    )
                    .map((i) => (
                      <div key={i.encontro.id} className="px-2">
                        <NotaEncontro
                          duplaId={i.dupla.id}
                          numero={i.encontro.numero}
                          nota={
                            i.dupla.notas?.find((n) => n.numero === i.encontro.numero)
                              ?.texto ?? null
                          }
                          rotulo={`${i.encontro.numero}º encontro`}
                        />
                      </div>
                    ))}
                {/* quem ainda não marcou o encontro oficial do dia — o mesmo
                    recorte do board da semana, com o nudge ao lado */}
                {faltantesDoDia.length > 0 && (
                  <div
                    className={cn(
                      itensDupla.length > 0 &&
                        "mt-2 border-t border-border/70"
                    )}
                  >
                    <p className="px-2 pb-0.5 pt-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                      Sem o {oficialDoDia!.numero}º encontro (
                      {faltantesDoDia.length})
                    </p>
                    <ul>
                      {faltantesDoDia.map((d) => (
                        <LinhaSemEncontro
                          key={d.id}
                          dupla={d}
                          numero={oficialDoDia!.numero!}
                        />
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
            {/* ação do dia pro mentor: agendar (futuro) ou registrar (passado)
                sem sair da agenda — a dupla agenda os próprios encontros, então
                coord/supervisor não veem esses CTAs */}
            {duplasAtivas.map((d) => (
              <AcaoDiaMentor
                key={d.id}
                dupla={d}
                eventos={eventos}
                selecionado={selecionado}
                hoje={hoje}
                eventosDoDia={eventosSelecionados}
                temConteudo={
                  eventosSelecionados.length > 0 || itensDupla.length > 0
                }
                rotulo={duplasAtivas.length > 1 ? d.mentorado.nome : undefined}
                onEncontroCriado={(encontroId, dia) =>
                  encontroCriado(d.id, encontroId, dia)
                }
              />
            ))}
          </motion.div>
        </AnimatePresence>
      </section>
      )}

      {/* ===== lista do mês — só o mentor a vê empilhada; pra coord/sup ela
          virou a visão "Lista" (cobertura do ciclo, dentro do card) ===== */}
      {!ehCoordSup && (
      <section
        aria-label={`Todos os eventos de ${rotuloMes}`}
        className="lg:col-span-2"
      >
        <h2 className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          Todos os eventos de {rotuloMes}
        </h2>
        <div
          key={mes}
          className="animate-enter-x overflow-hidden rounded-xl bg-card shadow-[var(--shadow-border)]"
          style={{ "--dir": `${direcao * 8}px` } as CSSProperties}
        >
          {gruposOrdenados.length === 0 && (
            <p className="px-4 py-6 text-sm text-muted-foreground sm:px-5">
              Nenhum evento neste mês.
            </p>
          )}
          {gruposOrdenados.map(([s, evs], gi) => {
            // nº do encontro que nomeia o grupo — a linha dele não repete o prefixo
            const numeroRotulo = eventosDaSemana(s).find(
              (e) => e.tipo === "encontro" && e.numero != null
            )?.numero ?? null;
            return (
            <div key={s}>
              {/* um hairline por grupo, no cabeçalho — não por linha */}
              <p
                className={cn(
                  "border-t px-4 pb-1 pt-3 text-xs font-medium text-muted-foreground sm:px-5",
                  gi === 0 && "border-t-0 pt-2"
                )}
              >
                {rotuloSemana(s)}
                {semanaEhAtual(s) && marcaSemana && (
                  <span className="text-[var(--ok-text)]"> · {marcaSemana}</span>
                )}
              </p>
              {evs.map((e) => {
                const fim = e.data_fim ?? e.data;
                const passou = fim < hoje;
                // "registraram/total" do encontro oficial que já passou — cue discreto,
                // a cobertura completa fica no detalhe do dia
                const cobertura =
                  ehCoordSup &&
                  e.tipo === "encontro" &&
                  e.numero != null &&
                  passou &&
                  duplas.length > 0
                    ? coberturaEncontro(duplas, e.numero)
                    : null;
                // a fase mora no título do mês e no detalhe do dia — na linha
                // só sobra o intervalo de evento que atravessa dias (recesso)
                const linhaSec = e.data_fim
                  ? `até ${diaCompacto(e.data_fim)}`
                  : "";
                const nomeEvento =
                  e.numero != null
                    ? `${e.numero}º encontro · ${e.titulo}`
                    : e.titulo;
                // o grupo já se chama "Semana do Nº encontro" — o prefixo sai
                // do visual mas fica no nome acessível da linha
                const numeroNoRotulo =
                  e.tipo === "encontro" &&
                  e.numero != null &&
                  e.numero === numeroRotulo;
                return (
                  <button
                    key={e.id}
                    type="button"
                    onClick={(ev) => {
                      // evento que começou antes do mês ancora no 1º dia visível
                      const alvo =
                        e.data < primeiroIso ? primeiroIso : e.data;
                      pedirRolarSePonteiro(ev, alvo);
                      setRegistroAberto(null);
                      setSelecionado(alvo);
                    }}
                    className={cn(
                      "flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring sm:gap-4 sm:px-5",
                      passou && "text-muted-foreground"
                    )}
                  >
                    <span className="w-20 shrink-0 whitespace-nowrap text-sm tabular-nums text-muted-foreground">
                      {diaCompacto(e.data)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">
                        {numeroNoRotulo ? (
                          <span className="sr-only">{e.numero}º encontro · </span>
                        ) : (
                          e.numero != null && `${e.numero}º encontro · `
                        )}
                        {e.titulo}
                      </span>
                      {linhaSec && (
                        <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                          {linhaSec}
                        </span>
                      )}
                    </span>
                    {cobertura && (
                      <span
                        aria-hidden
                        title={`${cobertura.registraram} de ${cobertura.total} ${
                          cobertura.total === 1 ? "dupla registrou" : "duplas registraram"
                        }`}
                        className="shrink-0 font-mono text-xs text-muted-foreground"
                      >
                        {cobertura.registraram}/{cobertura.total}
                      </span>
                    )}
                    <MarcadorTipo tipo={e.tipo} nome={nomeEvento} />
                  </button>
                );
              })}
            </div>
            );
          })}
        </div>
      </section>
      )}
    </div>
  );
}

/** "X de Y duplas registraram" — cobertura agregada do encontro oficial no
 *  detalhe do dia (coord/supervisor). */
function CoberturaEncontro({ duplas, numero }: { duplas: Dupla[]; numero: number }) {
  const { registraram, total } = coberturaEncontro(duplas, numero);
  return (
    <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
      <Users aria-hidden size={14} />
      <span>
        <span className="font-medium text-foreground">
          {registraram} de {total}
        </span>{" "}
        {total === 1 ? "dupla registrou" : "duplas registraram"}
      </span>
    </p>
  );
}

/** CTA contextual do dia pra uma dupla do mentor — o gesto certo aparece onde
 *  a pessoa já está olhando: dia oficial futuro sem row → "Agendar" (o dialog
 *  é dual, data passada registra); oficial passado sem row → "Registrar"
 *  pré-selecionado; row agendada → "Remarcar"; dia qualquer → mesmo critério
 *  pro próximo encontro pendente. Encontro criado aqui fica na agenda:
 *  `onEncontroCriado` navega pro dia dele e abre o registro em modal na linha —
 *  realizado/agendado-vencido sem registro ganha o CTA na própria linha
 *  ("Sua dupla"), sem depender deste bloco. */
function AcaoDiaMentor({
  dupla,
  eventos,
  selecionado,
  hoje,
  eventosDoDia,
  temConteudo,
  rotulo,
  onEncontroCriado,
}: {
  dupla: Dupla;
  eventos: CicloEvento[];
  /** "YYYY-MM-DD" do dia selecionado no calendário. */
  selecionado: string;
  /** "YYYY-MM-DD" de hoje — comparação de string já é cronológica. */
  hoje: string;
  eventosDoDia: CicloEvento[];
  /** Há blocos acima (eventos/encontros) — controla o hairline separador. */
  temConteudo: boolean;
  /** Nome do mentorado quando o mentor tem mais de uma dupla ativa. */
  rotulo?: string;
  /** Retroativo criado pelos dialogs — (id do encontro, "YYYY-MM-DD" dele). */
  onEncontroCriado: (encontroId: string, dia: string) => void;
}) {
  const alvo = alvoAgendamento(dupla, eventos, parseDia(hoje));
  const diaPassou = selecionado < hoje;
  // encontro oficial do dia — no máximo 1 (encontros são terças semanais).
  // Na trilha especialista não existe oficial: o CTA cai sempre no ramo
  // "próximo encontro pendente", sem importar o nº do calendário DPP. E o
  // oficial precisa ser do cronograma DA DUPLA — com duas turmas, o encontro
  // 5 do dia na tela pode ser de outro cronograma que o dela
  const oficial =
    dupla.trilha === "especialista"
      ? null
      : (eventosDoDia.find(
          (e) =>
            e.tipo === "encontro" &&
            e.numero != null &&
            e.cronograma_id === dupla.cronograma_id
        ) ?? null);
  const rowOficial = oficial
    ? (dupla.encontros.find((e) => e.numero === oficial.numero) ?? null)
    : null;

  let acao: ReactNode = null;
  if (oficial?.numero != null) {
    if (!rowOficial) {
      if (!diaPassou) {
        acao = (
          <AgendarEncontroDialog
            duplaId={dupla.id}
            numero={oficial.numero}
            atual={null}
            sugerido={oficial.data}
            piso={dupla.iniciada_em ?? undefined}
            onCreated={onEncontroCriado}
          />
        );
      } else if (alvo.faltantes.some((f) => f.numero === oficial.numero)) {
        acao = (
          <RegistrarRetroativoDialog
            duplaId={dupla.id}
            faltantes={alvo.faltantes}
            numeroInicial={oficial.numero}
            quandoPadrao={oficial.data}
            onCreated={onEncontroCriado}
            trigger={
              <Button variant="outline" size="sm">
                <ClockCounterClockwise size={16} />
                Registrar encontro
              </Button>
            }
          />
        );
      }
      // oficial passado fora da janela da dupla (antes do início) — sem CTA,
      // mas nunca mudo: explica o porquê e o caminho (corrigir o início)
      else if (dupla.iniciada_em && oficial.data < dupla.iniciada_em) {
        acao = (
          <p className="text-xs text-muted-foreground">
            Encontro anterior ao início da dupla ({formatDate(dupla.iniciada_em)}).
            Se vocês já se encontravam, a coordenação corrige a data em
            “Editar dupla”.
          </p>
        );
      }
    } else if (
      rowOficial.status === "agendado" ||
      rowOficial.status === "remarcado" ||
      rowOficial.status === "nao_aconteceu"
    ) {
      acao = (
        <AgendarEncontroDialog
          duplaId={dupla.id}
          numero={oficial.numero}
          atual={rowOficial}
          onCreated={onEncontroCriado}
        />
      );
    }
  } else if (!alvo.cicloCompleto) {
    if (!diaPassou) {
      // dia futuro qualquer — o próprio dia vira a sugestão de data; se o
      // próximo encontro já tem row agendada, o dialog vira "Remarcar"
      acao = (
        <AgendarEncontroDialog
          duplaId={dupla.id}
          numero={alvo.proximoNumero}
          atual={alvo.encontroAlvo}
          sugerido={selecionado}
          piso={dupla.iniciada_em ?? undefined}
          onCreated={onEncontroCriado}
        />
      );
    } else {
      // dia passado qualquer — encontro que rolou sem agendar: o mentor diz
      // qual foi; além dos oficiais vencidos sem row, o próximo pendente
      // também pode ter acontecido antes da data oficial
      const opcoes = [...alvo.faltantes];
      if (
        !alvo.encontroAlvo &&
        !opcoes.some((f) => f.numero === alvo.proximoNumero)
      )
        opcoes.push({
          numero: alvo.proximoNumero,
          dataSugerida: alvo.sugeridoProximo ?? selecionado,
        });
      if (opcoes.length > 0)
        acao = (
          <RegistrarRetroativoDialog
            duplaId={dupla.id}
            faltantes={opcoes}
            quandoPadrao={selecionado}
            onCreated={onEncontroCriado}
            trigger={
              <Button variant="outline" size="sm">
                <ClockCounterClockwise size={16} />
                Registrar encontro
              </Button>
            }
          />
        );
    }
  }

  if (!acao) return null;
  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-x-3 gap-y-2",
        temConteudo && "mt-4 border-t pt-4"
      )}
    >
      {rotulo && (
        <span className="text-xs font-medium text-muted-foreground">
          {rotulo}
        </span>
      )}
      {acao}
    </div>
  );
}

/** Linha do detalhe do dia: status do encontro de uma dupla + link pra ficha.
 *  Pro mentor, encontro realizado sem registro ou agendado já vencido (limbo —
 *  pode ter rolado) ganha o follow-up em modal: o CTA abre o RegistroForm sem
 *  sair da agenda. */
function EncontroDuplaRow({
  item,
  selecionado,
  agora,
  ehMentor,
  souCoord,
  indice,
  evento,
  aberto,
  onAlternarRegistro,
  onRegistroSalvo,
}: {
  item: ItemDupla;
  selecionado: string;
  /** Date.now() congelado na montagem do calendário — mesma régua de limbo
   *  dos buckets; a virada do horário numa aba parada é coberta pelo
   *  RevelarApos do bloco de registro. */
  agora: number;
  ehMentor: boolean;
  souCoord: boolean;
  indice: number;
  /** Passo do guia do nº na trilha da dupla — sugestão de tema/foco do form. */
  evento: PassoGuia | null;
  /** O form de registro desta linha está aberto (um por vez no painel). */
  aberto: boolean;
  onAlternarRegistro: (abrir: boolean) => void;
  onRegistroSalvo: () => void;
}) {
  // coord/sup: a linha abre o "Detalhes do encontro" — registro, plano do
  // mentor e evidências do dia sem sair da agenda
  const [detalheAberto, setDetalheAberto] = useState(false);
  const { encontro, dupla } = item;
  const iso = isoDoEncontro(encontro);
  // numero-match do mentor pode trazer encontro de outro dia — aí a data aparece completa
  const mesmoDia = diaDoEncontro(encontro) === selecionado;
  // agendado cuja hora já passou sem virar realizado nem não-aconteceu — a
  // mesma leitura de "limbo" da trilha (jornadaDaDupla) e da ficha
  const limbo = emLimbo(encontro, agora);
  const registroPendente =
    !encontro.registro && (encontro.status === "realizado" || limbo);
  // nudge da coord/sup sobre a pendência — os dois lados da dupla; limbo
  // pergunta "rolou?", realizado cobra o registro (tipos nudge/contato
  // coexistem no dedupe de 60s do /api/nudge)
  const waPendentes = useMemo<DestinoWA[]>(() => {
    if (!registroPendente) return [];
    const msgs = msgsContato(limbo ? "limbo" : "registro_pendente", {
      mentorNome: dupla.mentor.nome,
      mentoradoNome: dupla.mentorado.nome,
      extra: `${encontro.numero}º`,
    });
    return [
      {
        rotulo: "Chamar mentor",
        telefone: dupla.mentor.whatsapp,
        mensagem: msgs.mentor ?? "",
        t: "nudge",
      },
      {
        rotulo: "Chamar mentorado",
        telefone: dupla.mentorado.whatsapp,
        mensagem: msgs.mentorado ?? "",
        t: "contato",
      },
    ];
  }, [registroPendente, limbo, dupla, encontro.numero]);
  // mentor com registro pendente cai direto no card do encontro na página da
  // dupla — lá a âncora abre o RegistroInline; aqui o caminho curto é o CTA.
  // (só usado no ramo ehMentor — coord/sup abrem o detalhe em modal)
  const href =
    ehMentor && !registroPendente
      ? `/duplas/${dupla.id}`
      : `/duplas/${dupla.id}#registrar-${encontro.id}`;

  // combinados ainda abertos — mesmo recorte da ficha (por prazo), alimenta o
  // "marcar como feito" do form
  const combinadosPendentes = (dupla.encaminhamentos ?? [])
    .filter((e) => e.status !== "feito")
    .sort((a, b) => (a.prazo ?? "9999").localeCompare(b.prazo ?? "9999"));

  // candidato ao follow-up inline: realizado sem registro, ou agendado com
  // horário (quando ele vence vira limbo — o RevelarApos abaixo segura o
  // "já passou?" no tempo, então o bloco monta mesmo com a hora por vir)
  const podeTerRegistro =
    ehMentor &&
    !encontro.registro &&
    (encontro.status === "realizado" ||
      (encontro.status === "agendado" && encontro.data_hora != null));

  // CTA do follow-up. "Aconteceu?" no limbo porque a pergunta é real: o
  // encontro agendado pode não ter rolado — remarcar segue no bloco do dia.
  const ctaRegistro = podeTerRegistro && (
    <Button
      type="button"
      variant={encontro.status === "realizado" ? "default" : "outline"}
      size="sm"
      onClick={() => onAlternarRegistro(true)}
    >
      {encontro.status === "realizado"
        ? "Registrar como foi"
        : "Aconteceu? Registre como foi"}
    </Button>
  );

  // link da chamada perto da hora — o "entrar" é gesto da dupla (chip lime
  // pro mentor); coord/sup monitoram e repassam o link, então copiam — um
  // "abrir" acidental na call da dupla é pior que a fricção de colar
  const linkChamada =
    encontro.status === "agendado" ? linkSeguro(encontro.link) : null;
  const chamada =
    linkChamada == null ? null : ehMentor ? (
      <a
        href={linkChamada}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-[var(--ok)]/40 bg-[var(--ok)]/10 px-2.5 text-xs font-medium text-[var(--ok-text)] transition-colors hover:bg-[var(--ok)]/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:min-h-9"
      >
        <VideoCamera size={14} aria-hidden />
        Entrar na chamada
        <span className="sr-only"> (abre em nova aba)</span>
      </a>
    ) : (
      <CopiarChamada url={linkChamada} icone />
    );

  return (
    <li
      className="animate-enter"
      style={{ "--i": Math.min(indice, 10) } as CSSProperties}
    >
      {ehMentor ? (
        <Link
          href={href}
          className="group flex min-h-11 items-center gap-2.5 rounded-lg px-2 py-2 transition-colors hover:bg-muted/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <span
            aria-hidden
            className={cn("size-2 shrink-0 rounded-full", corDotEncontro(encontro))}
          />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium">
              <DuplaNomes mentor={dupla.mentor.nome} mentorado={dupla.mentorado.nome} />
            </span>
            <span className="block truncate text-xs text-muted-foreground">
              {encontro.numero}º encontro · {STATUS_ENCONTRO_LABEL[encontro.status].toLowerCase()}
              {iso
                ? `, ${mesmoDia ? `às ${fmtHora.format(new Date(iso))}` : formatDateTime(iso)}`
                : ", data a definir"}
              {encontro.status === "realizado" &&
                (encontro.registro ? (
                  <span className="text-[var(--ok-text)]">, registro entregue</span>
                ) : (
                  <span className="text-[var(--warn-text)]">, registro pendente</span>
                ))}
            </span>
          </span>
          <span className="inline-flex shrink-0 items-center gap-0.5 text-xs font-medium text-muted-foreground transition-colors group-hover:text-foreground">
            <span className="hidden sm:inline">Abrir dupla</span>
            <ArrowUpRight aria-hidden size={13} />
          </span>
        </Link>
      ) : (
        // coord/sup não escrevem no encontro — a linha abre o detalhe do dia
        // (registro, plano do mentor, evidências) num modal. Com pendência
        // de registro a linha também carrega o menu de nudge dos dois lados
        <div className="flex items-center gap-1">
          <button
            type="button"
            aria-haspopup="dialog"
            onClick={() => setDetalheAberto(true)}
            className="group flex min-h-11 min-w-0 flex-1 items-center gap-2.5 rounded-lg px-2 py-2 text-left transition-colors hover:bg-muted/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <span
              aria-hidden
              className={cn("size-2 shrink-0 rounded-full", corDotEncontro(encontro))}
            />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium">
                <DuplaNomes mentor={dupla.mentor.nome} mentorado={dupla.mentorado.nome} />
              </span>
              <span className="block truncate text-xs text-muted-foreground">
                {encontro.numero}º encontro · {STATUS_ENCONTRO_LABEL[encontro.status].toLowerCase()}
                {iso
                  ? `, ${mesmoDia ? `às ${fmtHora.format(new Date(iso))}` : formatDateTime(iso)}`
                  : ", data a definir"}
                {encontro.status === "realizado" &&
                  (encontro.registro ? (
                    <span className="text-[var(--ok-text)]">, registro entregue</span>
                  ) : (
                    <span className="text-[var(--warn-text)]">, registro pendente</span>
                  ))}
              </span>
            </span>
            <span className="inline-flex shrink-0 items-center gap-0.5 text-xs font-medium text-muted-foreground transition-colors group-hover:text-foreground">
              <span className="hidden sm:inline">Detalhes</span>
              <ArrowUpRight aria-hidden size={13} />
            </span>
          </button>
          {waPendentes.length > 0 && (
            <WhatsAppRapido
              icone
              duplaId={dupla.id}
              destinos={waPendentes}
            />
          )}
        </div>
      )}
      {!ehMentor && (
        <EncontroDetalheDialog
          encontro={encontro}
          dupla={dupla}
          evento={evento}
          souCoord={souCoord}
          open={detalheAberto}
          onOpenChange={setDetalheAberto}
        />
      )}
      {/* realizado libera na hora; agendado só vira limbo quando a hora passa —
          RevelarApos cobre a aba deixada aberta atravessando o encontro, sem
          depender de re-render (mesmo padrão da ficha). O gate por
          podeTerRegistro evita montar o timer em linhas sem follow-up.
          O wizard abre em Dialog: o painel lateral é estreito demais pra ele e
          o modal já é responsivo por si (mobile ocupa a tela útil inteira) */}
      {podeTerRegistro && (
        <Dialog open={aberto} onOpenChange={onAlternarRegistro}>
          <DialogContent className="sm:max-w-xl">
            <DialogHeader>
              <DialogTitle>
                Como foi o {encontro.numero}º encontro
              </DialogTitle>
            </DialogHeader>
            <RegistroForm
              embutido
              encontroId={encontro.id}
              duplaId={dupla.id}
              evento={evento}
              combinadosPendentes={combinadosPendentes}
              onSaved={onRegistroSalvo}
            />
          </DialogContent>
        </Dialog>
      )}
      {(ctaRegistro || chamada) && (
        <div className="flex flex-wrap items-center gap-2 px-2 pb-1.5">
          {encontro.status === "realizado"
            ? ctaRegistro
            : ctaRegistro && (
                <RevelarApos from={encontro.data_hora!}>{ctaRegistro}</RevelarApos>
              )}
          {chamada}
        </div>
      )}
    </li>
  );
}

// ===== materiais do encontro (detalhe do dia) =====

const MATERIAL_ICONE = {
  guia: BookOpen,
  template: FileText,
  conteudo: PuzzlePiece,
  link: LinkSimple,
} as const;

// nome legível do tipo — os ícones são decorativos, este texto é o
// equivalente pra leitor de tela (mesma convenção de /materiais)
const MATERIAL_TIPO_LABEL = {
  guia: "guia",
  template: "modelo",
  conteudo: "conteúdo",
  link: "link",
} as const;

/** Linha de material no detalhe do dia — mesma gramática da row de
 *  /materiais (ícone por tipo, arquivo oficial > url externa > "em breve"),
 *  enxuta pro painel estreito. Duplicada de propósito: a row de /materiais
 *  carrega badge de audiência e ações de coordenação que não pertencem aqui. */
function MaterialDoEncontro({ m }: { m: Material }) {
  const Icone = MATERIAL_ICONE[m.tipo];
  // arquivo oficial ganha da url externa; sem os dois, o material ainda não
  // chegou. linkSeguro: o CHECK do banco exige http(s), este guard cobre
  // escrita fora do app — url insegura cai no estado "sem destino"
  const urlOk = linkSeguro(m.url);
  const href = m.path ? `/api/material/${m.id}` : urlOk;
  const inner = (
    <>
      <Icone size={16} className="shrink-0 text-muted-foreground" aria-hidden />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">{m.titulo}</span>
        {m.descricao && (
          <span className="mt-0.5 line-clamp-2 block text-xs text-muted-foreground">
            {m.descricao}
          </span>
        )}
        <span className="sr-only">
          {MATERIAL_TIPO_LABEL[m.tipo]}
          {m.path ? " · arquivo" : urlOk && m.tipo !== "link" ? " · link externo" : ""}
          {href ? " (abre em nova aba)" : ""}
        </span>
      </span>
      {m.path ? (
        // path aceita imagem além de PDF — ícone genérico de arquivo
        <File size={14} className="shrink-0 text-muted-foreground" aria-hidden />
      ) : urlOk ? (
        <ArrowSquareOut size={14} className="shrink-0 text-muted-foreground" aria-hidden />
      ) : (
        // sem destino: "a caminho" é estado legítimo — a row não vira link
        // nem ganha hover pra não parecer clicável/quebrado
        <Badge variant="outline" className="shrink-0 text-xs text-muted-foreground">
          em breve
        </Badge>
      )}
    </>
  );
  const classeRow = "flex min-w-0 items-center gap-2.5 rounded-lg px-2 py-2";
  return (
    <li>
      {href ? (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className={cn(
            classeRow,
            "transition-colors hover:bg-muted/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          )}
        >
          {inner}
        </a>
      ) : (
        <div className={classeRow}>{inner}</div>
      )}
    </li>
  );
}

/* =========================== buckets de status (coord/sup) =========================== */

/** A gramática de status da visão semanal (e do painel do dia cheio): quatro
 *  fatias fixas, "Pendentes de registro" aberto por padrão porque é onde a
 *  semana pede ação. <details> nativo — disclosure com caret, foco e sem
 *  estado próprio.
 *  Ordem fixa é a apresentação, não o dado: a fileira inteira não renderiza
 *  quando está vazia. */
const ROTULOS_BUCKETS: {
  chave: keyof BucketsEncontro;
  rotulo: string;
  dot: string;
  aberto: boolean;
}[] = [
  { chave: "pendentes", rotulo: "Pendentes de registro", dot: "bg-[var(--warn)]", aberto: true },
  // anel vazio — mesma gramática de corDotEncontro (agendado é futuro)
  { chave: "agendados", rotulo: "Agendados", dot: "ring-1 ring-inset ring-muted-foreground/60", aberto: false },
  { chave: "realizados", rotulo: "Realizados", dot: "bg-[var(--ok)]", aberto: false },
  {
    chave: "naoAconteceram",
    rotulo: "Não aconteceram",
    dot: "bg-muted-foreground/40",
    aberto: false,
  },
];

function BucketsEncontros({
  buckets,
  renderItem,
}: {
  buckets: BucketsEncontro;
  renderItem: (item: ItemEncontroDupla, i: number) => ReactNode;
}) {
  return (
    <div className="space-y-0.5">
      {ROTULOS_BUCKETS.filter(({ chave }) => buckets[chave].length > 0).map(
        ({ chave, rotulo, dot, aberto }) => (
          <BucketEncontros
            key={chave}
            rotulo={rotulo}
            dot={dot}
            itens={buckets[chave]}
            abertoInicial={aberto}
            renderItem={renderItem}
          />
        )
      )}
    </div>
  );
}

function BucketEncontros({
  rotulo,
  dot,
  itens,
  abertoInicial,
  renderItem,
}: {
  rotulo: string;
  dot: string;
  itens: ItemEncontroDupla[];
  abertoInicial: boolean;
  renderItem: (item: ItemEncontroDupla, i: number) => ReactNode;
}) {
  return (
    <details
      open={abertoInicial}
      className="group rounded-lg transition-colors hover:bg-muted/50"
    >
      <summary className="mx-2 flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-md px-1 py-2 select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:min-h-9 [&::-webkit-details-marker]:hidden">
        <CaretDown
          aria-hidden
          size={14}
          className="shrink-0 text-muted-foreground transition-transform group-open:rotate-180"
        />
        <span aria-hidden className={cn("size-2 shrink-0 rounded-full", dot)} />
        <span className="text-sm font-medium">{rotulo}</span>
        <span className="text-sm tabular-nums text-muted-foreground">
          {itens.length}
        </span>
      </summary>
      <ul className="pb-1 pl-1">{itens.map(renderItem)}</ul>
    </details>
  );
}

/* =========================== coorte sem encontro =========================== */

/** Linha da coorte invisível: dupla ativa que ainda não marcou o encontro
 *  oficial do recorte. Ferramenta de nudge — o link leva à ficha e o menu
 *  "WhatsApp" abre a conversa dos dois lados (mentor agenda; o mentorado é
 *  canal quando a dupla some). Sem cor de alarme: não marcar ainda é estado
 *  normal, não falha. */
function LinhaSemEncontro({ dupla, numero }: { dupla: Dupla; numero: number }) {
  const msgs = msgsContato("sem_encontro", {
    mentorNome: dupla.mentor.nome,
    mentoradoNome: dupla.mentorado.nome,
    extra: `${numero}º`,
  });
  const destinos: DestinoWA[] = [
    {
      rotulo: "Chamar mentor",
      telefone: dupla.mentor.whatsapp,
      mensagem: msgs.mentor ?? "",
      t: "nudge",
    },
    {
      rotulo: "Chamar mentorado",
      telefone: dupla.mentorado.whatsapp,
      mensagem: msgs.mentorado ?? "",
      t: "contato",
    },
  ];
  return (
    <li className="flex items-center gap-1 rounded-lg py-1 pr-1 pl-3 transition-colors hover:bg-muted/50 sm:pl-4">
      <Link
        href={`/duplas/${dupla.id}`}
        className="min-w-0 flex-1 truncate rounded-sm py-1 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <DuplaNomes
          mentor={dupla.mentor.nome}
          mentorado={dupla.mentorado.nome}
          truncar
        />
      </Link>
      <WhatsAppRapido icone duplaId={dupla.id} destinos={destinos} />
    </li>
  );
}
