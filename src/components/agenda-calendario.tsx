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
  CalendarBlank,
  CalendarPlus,
  CaretDown,
  CaretLeft,
  CaretRight,
  CheckCircle,
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
import { NaoAconteceuButton } from "@/components/nao-aconteceu-button";
import { NotaEncontro } from "@/components/nota-encontro";
import { WhatsAppRapido, type DestinoWA } from "@/components/whatsapp-rapido";
import { AgendarEncontroDialog } from "@/components/agendar-encontro-dialog";
import { EditarLinkDialog } from "@/components/editar-link-dialog";
import { RegistrarRetroativoDialog } from "@/components/registrar-retroativo-dialog";
import { RegistroForm } from "@/components/registro-form";
import { EncontroDetalheDialog } from "@/components/encontro-detalhe-dialog";
import { RevelarApos } from "@/components/revelar-apos";
import { fade, T } from "@/components/motion";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { filterChipCls } from "@/components/ui/filter-chip";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
  cruzamentoDisponibilidade,
  cruzamentoDisponibilidadeHora,
  diaSemanaDe,
  diffDias,
  disponibilidadeNoDia,
  disponibilidadeTexto,
  disponibilidadeVazia,
  duplasSemEncontroDoNumero,
  eventoDaSemana,
  eventosDoCronograma,
  formatDate,
  formatDateTime,
  formatDiaSemana,
  JANELA_PERIODO,
  linkSeguro,
  coberturaEncontro,
  periodosNoDia,
  passosDaTrilha,
  resumoSemanaDe,
  semanaBounds,
  toDateStr,
  type AlvoAgendamento,
  type BucketsEncontro,
  type EventoDatado,
  type ItemEncontroDupla,
  type PassoGuia,
} from "@/lib/ciclo";
import { limboAberto } from "@/lib/agenda-minha";
import { turmaLonga } from "@/lib/turma";
import type { MentorChamada } from "@/lib/queries-presenca";
import { temPapel } from "@/lib/types";
import type {
  AppRole,
  CicloEvento,
  Cronograma,
  Disponibilidade,
  Dupla,
  Encontro,
  EncontroStatus,
  EspecialistaEvento,
  Material,
} from "@/lib/types";
import { guiaDoEncontro } from "@/lib/como-conduzir";
import { msgsContato } from "@/lib/whatsapp-msgs";
import { cn, normaliza } from "@/lib/utils";
import { BarraSegmentada } from "@/components/viz";
import { itensDaSemanaPrograma } from "@/lib/agenda-coordenacao";
import { SemanaDoPrograma } from "@/components/semana-do-programa";

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

const TIPO_PALAVRA: Record<CicloEvento["tipo"], string> = {
  etapa_preparacao: "etapa de preparação",
  encontro: "encontro",
  recesso: "recesso",
  evento_encerramento: "encerramento",
  formacao: "formação",
};

// ===== overlay de disponibilidade (REALIZA-24) =====
// Tinta de fundo da célula: verde-claro do mentor (--ok), amarelo-claro do
// mentorado (--role-mentorado) e split diagonal quando os dois cruzam com
// período em comum. Grade dow×período — faixa de hora é da visão de grade
// futura (REALIZA-25), aqui o dia inteiro carrega o cruzamento.

/** Split do dia "ambos livres" — as duas cores lado a lado, não uma terceira
 *  cor: lê-se a sobreposição literal das grades. Inline style — o
 *  color-mix dentro do linear-gradient não sai legível em arbitrary value. */
const GRADIENTE_AMBOS_DISPONIVEIS =
  "linear-gradient(135deg, color-mix(in oklab, var(--ok) 12%, transparent) 50%, color-mix(in oklab, var(--role-mentorado) 22%, transparent) 50%)";

/** Tinta dos estados simples — translúcida pra conviver com hatch-recesso
 *  (bg-image por cima da tinta) e com o anel do dia selecionado. */
const TINTA_DISPONIBILIDADE = {
  mentor: "bg-[var(--ok)]/8",
  jovem: "bg-[var(--role-mentorado)]/16",
} as const;

/** Swatch de ~20px da legenda: o mesmo matiz da célula com alfa mais denso
 *  (num retângulo miúdo o alfa da célula some no branco — a chave precisa
 *  ser legível sem mentir a cor). */
const TINTA_LEGENDA = {
  mentor: "bg-[var(--ok)]/16",
  jovem: "bg-[var(--role-mentorado)]/28",
} as const;
const GRADIENTE_AMBOS_LEGENDA =
  "linear-gradient(135deg, color-mix(in oklab, var(--ok) 20%, transparent) 50%, color-mix(in oklab, var(--role-mentorado) 34%, transparent) 50%)";

/** Primeiro nome de uso do mentorado — nome social quando existe ("Bia"),
 *  senão o primeiro do civil. Pro aria-label do dia e a linha do detalhe. */
function primeiroNomeMentorado(m: Dupla["mentorado"]): string {
  return (m?.nome_social ?? m?.nome ?? "").split(" ")[0] ?? "";
}

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
    case "etapa_preparacao":
      // discreto: a etapa é contexto operacional, não o protagonista do dia
      return (
        <span className={cls}>
          <CheckCircle aria-hidden size={13} weight="bold" />
          {palavra}
        </span>
      );
    case "evento_encerramento":
      return (
        <span className={cls}>
          <Flag aria-hidden size={13} weight="fill" className="text-[var(--ok-text)]" />
          {palavra}
        </span>
      );
  }
}

/** Contagem por segmento da barra-resumo — a mesma leitura dos buckets (limbo
 *  conta no âmbar: pendência de registro, não "agendado"). Extraída pra a
 *  legenda nomear exatamente os números que a barra pinta. */
function contagemEncontros(itens: ItemDupla[], agora: number) {
  const cont = { ok: 0, warn: 0, agendado: 0, apagado: 0 };
  for (const { encontro } of itens) {
    if (encontro.status === "realizado")
      cont[encontro.registro ? "ok" : "warn"]++;
    else if (encontro.status === "agendado" || encontro.status === "remarcado")
      cont[limboAberto(encontro, agora) ? "warn" : "agendado"]++;
    else cont.apagado++;
  }
  return cont;
}

/** Barra segmentada por status — a cobertura visual do encontro oficial no
 *  board da semana e na lista do ciclo. Delegada à BarraSegmentada do kit:
 *  `total` é o denominador LITERAL (as ativas do cronograma) — quem não tem
 *  row do número aparece como segmento neutro "sem data" em vez de sumir
 *  do trilho (a barra mentia ~90% cheia no "4/10" — o bug que a
 *  BarraSegmentada nasceu pra matar). Sem `total` (leitura por data, sem
 *  encontro oficial) o denominador segue sendo os itens exibidos. */
function ResumoEncontrosDupla({
  itens,
  total,
  agora,
}: {
  itens: ItemDupla[];
  /** denominador único — as ativas do recorte (resumoSemanaDe.total). */
  total?: number;
  /** Date.now() congelado na montagem do calendário — mesma régua dos buckets. */
  agora: number;
}) {
  const cont = contagemEncontros(itens, agora);
  const semData = total != null ? Math.max(0, total - itens.length) : 0;
  return (
    <BarraSegmentada
      className="min-w-4 flex-1"
      altura="sm"
      denominador={total ?? itens.length}
      segmentos={[
        {
          valor: cont.ok,
          rotulo: "realizados com registro",
          cls: "bg-[var(--ok)]",
        },
        {
          valor: cont.warn,
          rotulo: "pendentes de registro",
          cls: "bg-[var(--warn)]",
        },
        {
          valor: cont.agendado,
          rotulo: "agendados",
          cls: "bg-muted-foreground/30",
        },
        {
          valor: cont.apagado,
          rotulo: "não aconteceram",
          cls: "bg-muted-foreground/50",
        },
        { valor: semData, rotulo: "sem data" },
      ]}
    />
  );
}

/** Legenda nomeada da barra-resumo — cor → significado → número, só os
 *  segmentos não-zero, na mesma ordem do Object.keys(cont) da barra. O
 *  "sem data" fecha a conta do denominador (`total`) com swatch neutro. */
function LegendaEncontrosDupla({
  itens,
  total,
  agora,
}: {
  itens: ItemDupla[];
  /** denominador único — quando declarado, "N sem data" entra na legenda. */
  total?: number;
  agora: number;
}) {
  const cont = contagemEncontros(itens, agora);
  const semData = total != null ? Math.max(0, total - itens.length) : 0;
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
      {semData > 0 && (
        <span className={item}>
          <span aria-hidden className="viz-hatch size-2 rounded-full" />
          {semData} sem data
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
  janelaInicial = null,
  duplas,
  role,
  mentores = [],
  presencas = {},
  mentorDisponibilidade,
  papeis = null,
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
  /** ?jw= da URL (REALIZA-195): a janela temporal de coord/sup —
   *  "semana" (lista detalhada), "mes" (a grade atual) ou "ciclo"
   *  (timeline agregada). Param PRÓPRIO — `?visao=` é a troca de
   *  superfície entre papéis e não se recicla; `?dia=` continua
   *  forçando contexto mês quando presente. */
  janelaInicial?: "semana" | "mes" | "ciclo" | null;
  duplas: Dupla[];
  role: AppRole | null;
  /** Mentores ativos do ciclo — a lista da chamada de formação. Só vem
   *  preenchida pra coordenação (a page nem busca pros demais papéis). */
  mentores?: MentorChamada[];
  /** Presenças marcadas: ciclo_evento_id → profile_id → presente. Idem —
   *  coordenação only; ausência de row = não marcado (não "ausente"). */
  presencas?: Record<string, Record<string, boolean>>;
  /** Grade semanal do mentor logado (REALIZA-24): com ela, as células do
   *  mês ganham a tinta de quem pode naquele dia — a dele × a dos
   *  mentorados das duplas ativas. `undefined` desliga o overlay (coord/
   *  sup/jovem renderizam como antes); `null` = overlay ligado com o lado
   *  do mentor nunca livre (ele ainda não preencheu a grade). */
  mentorDisponibilidade?: Disponibilidade | null;
  /** Papéis efetivos (WP6b) — o híbrido esp-primário também é mentor nas
   *  duplas DPP dele; sem a prop cai no role primário (comportamento antigo) */
  papeis?: AppRole[] | null;
}) {
  const ehMentor = temPapel({ role, papeis }, "mentor_dpp") ||
    temPapel({ role, papeis }, "mentor_especialista");
  const ehCoordSup = role === "coordenacao" || role === "supervisor";
  const ehCoord = role === "coordenacao";
  // staff+mentor: a superfície de equipe vence dentro do calendário — os
  // recursos de mentor (linhas de dupla com ação, "Sua dupla", grade de
  // horários, voz do guia, cronogramas filtrados pelas dele) são da visão
  // mentor e ficam atrás do ?visao=dpp; na aba de equipe seria vazamento
  // de coorte (blocker REALIZA-195: papel staff decide o vocabulário)
  const ehMentorUi = ehMentor && !ehCoordSup;
  const router = useRouter();

  // ===== cronograma selecionado (0061) =====
  // Opções por papel: coord/sup veem todos os cronogramas; o mentor vê os das
  // próprias duplas DPP (sem dupla, o vigente — o calendário "do programa"
  // que ele já veria). Um cronograma só = sem seletor, a tela segue direta.
  const opcoesCron = useMemo(() => {
    const ordenados = cronogramasOpcoes(cronogramas);
    // staff+mentor na superfície de equipe: todos os cronogramas, não o
    // recorte das duplas dele (a filtragem é recurso da visão mentor)
    if (!ehMentorUi) return ordenados;
    const meus = new Set(
      duplas
        .filter((d) => d.trilha !== "especialista")
        .map((d) => d.cronograma_id)
    );
    const dasDuplas = ordenados.filter((c) => meus.has(c.id));
    return dasDuplas.length ? dasDuplas : ordenados;
  }, [cronogramas, duplas, ehMentorUi]);
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

  // mapa dia → eventos do dia; recesso (e qualquer evento com data_fim) cobre
  // o intervalo todo. Etapa concluída sem data (0062) não entra no grid —
  // ela mora no painel "Etapas de preparação"
  const porDia = useMemo(() => {
    const mapa = new Map<string, CicloEvento[]>();
    for (const e of eventosSel) {
      if (e.data == null) continue;
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

  // ===== overlay de disponibilidade (REALIZA-24) =====
  // undefined = desligado (coord/sup/jovem renderizam como antes). As grades
  // do outro lado são as dos mentorados das duplas DPP ativas — a trilha
  // especialista tem o próprio sistema de janelas (0073) e o calendário dela
  // não pinta célula por dow. Nome junto: o aria-label e o detalhe nomeiam
  // quem tá livre, não só a cor.
  const overlayDispo = mentorDisponibilidade !== undefined;
  const jovensDispo = useMemo(
    () =>
      overlayDispo
        ? duplas
            .filter((d) => d.status === "ativa" && d.trilha !== "especialista")
            .map((d) => ({
              primeiroNome: primeiroNomeMentorado(d.mentorado),
              disp: d.mentorado?.disponibilidade ?? null,
            }))
        : [],
    [duplas, overlayDispo]
  );
  // a legenda só aparece se ALGUM lado tiver grade — dupla de grade vazia
  // nunca pinta a célula e a chave solta seria decorativa
  const legendaDispo =
    overlayDispo &&
    (!disponibilidadeVazia(mentorDisponibilidade) ||
      jovensDispo.some((j) => !disponibilidadeVazia(j.disp)));

  // trilha do ciclo: só os encontros oficiais (1–16), em ordem — alimenta o
  // rail. O guard de data refina pro tipo datado (o CHECK exige data em
  // encontro, mas o tipo declara null por causa da etapa concluída)
  const encontrosRail = useMemo(
    () =>
      eventosSel
        .filter(
          (e): e is EventoDatado =>
            e.tipo === "encontro" && e.numero != null && e.data != null
        )
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
  // a régua da navegação por dia (visão "dia"): os dias dentro dos meses do
  // ciclo — do 1º dia do primeiro mês ao último do último
  const minDia = faixaDoMes(minMes)[0];
  const maxDia = faixaDoMes(maxMes)[1];

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

  // ===== visão da agenda =====
  // coord/sup (REALIZA-195): dia | semana | mes | ciclo — as três janelas
  // temporais do v8b ("Semana" é a lista detalhada do board, "Mês" a
  // grade atual preservada, "Ciclo" a timeline agregada) + o "dia"
  // (REALIZA-163) é o detalhe do dia selecionado promovido a visão
  // cheia. Mentor (REALIZA-25+163): mes | semana | horarios + dia —
  // a grade estilo calendário onde marcar o encontro vira gesto
  // primário. Jovem/papel sem grade própria fica sempre no mês.
  // ?dia= aponta um dia específico → todos abrem no mês (o deep-link pede
  // a célula do dia); ?jw= escolhe a janela inicial de coord/sup.
  const [visao, setVisao] = useState<
    "dia" | "semana" | "mes" | "ciclo" | "horarios"
  >(() =>
    diaInicial || !ehCoordSup
      ? "mes"
      : janelaInicial === "ciclo" || janelaInicial === "mes"
        ? janelaInicial
        : "semana"
  );
  // sanitiza pro conjunto do papel — os chips só emitem valores válidos, mas
  // o estado sobreviveria a uma troca de contexto (defesa, não caminho real)
  const visaoEfetiva = ehCoordSup
    ? visao === "horarios"
      ? "mes"
      : visao
    : ehMentorUi
      ? visao === "ciclo"
        ? "mes"
        : visao
      : "mes";
  // a semana compacta e a grade de horários do mentor navegam por semana —
  // o mesmo chrome (prev/next/Hoje/range) e o mesmo gesto do rail; a visão
  // "dia" navega de dia em dia sobre a seleção — a unidade menor do chrome
  const navegaPorSemana =
    visaoEfetiva === "semana" || visaoEfetiva === "horarios";
  const navegaPorDia = visaoEfetiva === "dia";
  // o painel "detalhe do dia" é âncora do mês em todos os papéis e da semana
  // compacta do mentor; a grade de horários agenda direto no clique e a
  // lista da coordenação é full-width — nenhum dos dois o usa. A visão "dia"
  // também não: ela É o próprio detalhe ampliado
  const comDetalheDia =
    visaoEfetiva === "mes" || (ehMentorUi && visaoEfetiva === "semana");

  // "agora" congelado na montagem — a mesma régua de limbo pros buckets, a
  // contagem da célula e o resumo falado (Date.now() solto no render viola
  // pureza e deixaria cada leitura com um "agora" diferente)
  const [agoraMs] = useState(() => Date.now());

  // janela de semanas navegáveis: da semana do 1º evento do cronograma à do
  // último (mesmo recorte dos minMes/maxMes do modo mensal). Evento sem data
  // (etapa concluída, 0062) não abre janela — e data_fim estende o fim, pra
  // recesso/etapa multi-dia não cortar na semana de início
  const { minSemana, maxSemana } = useMemo(() => {
    let min = "",
      max = "";
    for (const e of eventosSel) {
      if (e.data == null) continue;
      if (!min || e.data < min) min = e.data;
      const fim = e.data_fim ?? e.data;
      if (fim > max) max = fim;
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
      if (e.data == null) continue; // etapa sem data não abre mês/semana
      if (!min || e.data < min) min = e.data;
      const fim = e.data_fim ?? e.data;
      if (fim > max) max = fim;
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

  /** Navega pra um dia (visão "dia") lembrando a direção — e mantém semana e
   *  mês sincronizados pra troca de visão pousar onde a pessoa estava. */
  function irParaDia(iso: string) {
    const alvo = mesIndice(iso);
    if (alvo < minMes || alvo > maxMes || iso === selecionado) return;
    setRegistroAberto(null);
    irParaSemana(semanaBounds(parseDia(iso)).seg);
    irParaMes(alvo);
    setDirecao(iso > selecionado ? 1 : -1);
    setSelecionado(iso);
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

  /** Clique numa coluna da semana compacta do mentor: seleciona o dia pro
   *  painel de detalhe — mesma rotina da célula do mês (rolagem por ponteiro,
   *  fecha o registro inline ao trocar de dia). */
  function selecionarDiaNaSemana(iso: string, e: { detail: number }) {
    pedirRolarSePonteiro(e, iso);
    if (iso !== selecionado) setRegistroAberto(null);
    setSelecionado(iso);
  }

  /** Abrir a visão "dia": o dia selecionado é a âncora quando ele cai na
   *  semana em exibição; vindo de fora (semana compacta, horários, lista)
   *  com seleção fora dela, ancora na segunda da semana — a mesma regra de
   *  contexto do mudarVisaoMentor. */
  function abrirDia() {
    const { seg, dom } = semanaBounds(parseDia(semanaIso));
    if (visaoEfetiva !== "mes" && (selecionado < seg || selecionado > dom)) {
      // a segunda da semana exibida — ou o dia alcançável mais perto se ela
      // começar antes da janela do ciclo
      irParaDia(seg < minDia ? minDia : seg > maxDia ? maxDia : seg);
    }
    setVisao("dia");
  }

  /** Troca de visão do mentor mantém o contexto temporal — "semana"/
   *  "horarios" pousam na semana do dia selecionado, "mes" pousa no mês da
   *  semana em exibição, "dia" abre no dia selecionado (âncora do mês) ou na
   *  segunda da semana exibida. Sem isso o chip parecia "resetar" a agenda:
   *  navegar pra dezembro nos horários e abrir o mês mostraria setembro. */
  function mudarVisaoMentor(v: "dia" | "mes" | "semana" | "horarios") {
    if (v === "dia") return abrirDia();
    if (v === "mes") {
      irParaMes(mesIndice(semanaIso));
    } else {
      // a semana alvo é a do dia selecionado — a âncora visual que o mentor
      // tinha no mês vira a semana que a grade abre
      irParaSemana(semanaBounds(parseDia(selecionado)).seg);
    }
    setVisao(v);
  }

  /** Encontro retroativo criado a partir da agenda: fica na agenda — navega
   *  pro dia em que ele caiu (o refresh do dialog já traz a linha nova) e abre
   *  o form de registro nela. Dia fora da janela do ciclo a agenda não alcança
   *  — aí cai no caminho antigo: ficha da dupla com o card aberto. Na grade de
   *  horários o painel do dia nem existe — o form abre na ficha direto. */
  function encontroCriado(duplaId: string, encontroId: string, dia: string) {
    const idx = mesIndice(dia);
    if (idx >= minMes && idx <= maxMes && visaoEfetiva !== "horarios") {
      // na visão "dia" a navegação é por dia — irParaDia também mantém a
      // semana/mês de contexto sincronizados
      if (navegaPorDia) irParaDia(dia);
      else moverPara(dia);
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
    (e): e is EventoDatado =>
      e.data != null &&
      e.data <= ultimoIso &&
      (e.data_fim ?? e.data) >= primeiroIso
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
    ehMentorUi && numerosOficiais.size > 0
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
  const duplasAtivas = ehMentorUi ? duplas.filter((d) => d.status === "ativa") : [];
  const duplasAtivasDpp = duplasAtivas.filter((d) => d.trilha !== "especialista");

  // alvos de agendamento por dupla ativa — proximoNumero + row alvo que a
  // grade de horários (REALIZA-25) lê a cada clique sem recomputar. Mesma
  // derivação do AcaoDiaMentor; `eventos` completo porque alvoAgendamento
  // recorta pelo cronograma DA DUPLA internamente
  const alvosPorDupla = useMemo(() => {
    const mapa = new Map<string, AlvoAgendamento>();
    if (!ehMentorUi) return mapa;
    const base = parseDia(hoje);
    for (const d of duplas)
      if (d.status === "ativa")
        mapa.set(d.id, alvoAgendamento(d, eventos, base));
    return mapa;
  }, [ehMentorUi, duplas, eventos, hoje]);
  // o clique numa coluna vazia só propõe slot pra dupla com encontro
  // pendente — cicloCompleto apaga a dupla do gesto; na trilha especialista
  // sem row alvo a action recusaria criar do zero (a sessão nasce de pedido
  // aceito, não da grade), então ela nem entra no gesto
  const duplasAgendaveis = duplasAtivas.filter((d) => {
    const alvo = alvosPorDupla.get(d.id);
    if (!alvo || alvo.cicloCompleto) return false;
    return d.trilha !== "especialista" || alvo.encontroAlvo != null;
  });

  // linha "Disponível neste dia" do detalhe — quem tá livre no dia da semana
  // selecionado, com a grade inteira de cada lado (a célula diz o dia; aqui
  // aparece o PERÍODO que ela não carrega). Só lados livres entram — dia sem
  // ninguém disponível não rende linha.
  const dowSelecionado = overlayDispo ? diaSemanaDe(selecionado) : null;
  const dispoDoSel: { quem: string; texto: string | null }[] = !dowSelecionado
    ? []
    : [
        ...(disponibilidadeNoDia(mentorDisponibilidade, dowSelecionado)
          ? [
              {
                quem: "você",
                texto: disponibilidadeTexto(mentorDisponibilidade),
              },
            ]
          : []),
        ...jovensDispo
          .filter((j) => disponibilidadeNoDia(j.disp, dowSelecionado))
          .map((j) => ({
            quem: j.primeiroNome,
            texto: disponibilidadeTexto(j.disp),
          })),
      ];

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
    // a semana pode ter DOIS encontros oficiais (quinta dupla da T2, 0062) —
    // o rótulo nomeia todos; o âncora dos agregados segue o menor nº
    const nums = evs
      .filter((e) => e.tipo === "encontro" && e.numero != null)
      .map((e) => e.numero!)
      .sort((a, b) => a - b);
    if (nums.length === 1) return `Semana do ${nums[0]}º encontro`;
    if (nums.length > 1)
      return `Semana dos encontros ${nums.slice(0, -1).join(", ")} e ${nums.at(-1)}`;
    if (evs.some((e) => e.tipo === "evento_encerramento"))
      return "Semana de encerramento";
    if (evs.some((e) => e.tipo === "recesso")) return "Semana de recesso";
    if (evs.some((e) => e.tipo === "formacao")) return "Semana de formação";
    if (evs.some((e) => e.tipo === "etapa_preparacao"))
      return "Semana de preparação";
    return "Semana sem eventos";
  };
  const gruposDoMes = new Map<number, EventoDatado[]>();
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

  // pacote compartilhado das grades do mentor (semana compacta e horários,
  // REALIZA-25) — um objeto só porque os dois leem o mesmo conjunto
  const ctxGradesMentor: GradeMentorCtx = {
    hoje,
    agoraMs,
    porDia,
    duplasPorDia,
    overlayDispo,
    mentorDisponibilidade,
    jovensDispo,
    multiDupla: duplasAtivas.length > 1,
    eventoSemanaId: eventoSemanaSel?.id,
    marcaSemanaA11y,
  };

  // encontros oficiais da semana exibida — critério estrito do
  // encontrosDaSemana (a data cai em seg–dom), sem o fallback "próximo" do
  // eventoDaSemana: o board só fala da semana real. A semana pode ter DOIS
  // (quinta de encontro duplo da T2, 0062) — ordenados por numero, o âncora
  // dos agregados é o menor nº.
  const oficiaisSemana = eventosSel
    .filter(
      (e): e is EventoDatado =>
        e.tipo === "encontro" &&
        e.numero != null &&
        e.data != null &&
        e.data >= segSel &&
        e.data <= domSel
    )
    .sort((a, b) => (a.numero ?? 0) - (b.numero ?? 0));
  const oficialSemana = oficiaisSemana[0] ?? null;

  // seção 1 do cronograma oficial (0062): as etapas de preparação em `ordem`.
  // As sem data (entregues "Concluída" pela ONG parceira) não entram na
  // grade — este painel é a única superfície delas na agenda.
  const etapasPreparacao = eventosSel
    .filter((e) => e.tipo === "etapa_preparacao")
    .sort((a, b) => a.ordem - b.ordem);
  const etapasConcluidas = etapasPreparacao.filter(
    (e) => e.status === "concluida"
  ).length;

  // formação/recesso/etapa/encerramento que tocam a semana — linha-meta
  // informativa, fora dos agregados de encontro. Etapa concluída sem data
  // (0062) não toca semana nenhuma — mora no painel "Etapas de preparação".
  const outrosDaSemana = eventosSel.filter(
    (e): e is EventoDatado =>
      !(e.tipo === "encontro" && e.numero != null) &&
      e.data != null &&
      e.data <= domSel &&
      (e.data_fim ?? e.data) >= segSel
  );

  // itens encontro↔dupla por número oficial — a unidade do board e da lista.
  // Só trilha DPP e só do cronograma selecionado: o nº 1–5 da especialista
  // colidiria com os oficiais, e o encontro 5 de outra turma não é o desta —
  // unir itensPorNumero de todas as turmas misturaria "encontro 5" de T1
  // com "encontro 5" de T2 no mesmo balde (decisão v8b: o board "semana" e
  // a timeline "ciclo" leem UM calendário oficial por vez, como o mês — a
  // turma troca no seletor, nunca se mistura). Dupla DPP sem cronograma
  // (dado inválido pré-0061) entra em qualquer recorte — invisível pra
  // coordenação seria pior que duplicada
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
  // antes do encontro oficial "X de Y realizaram" ainda não é a pergunta — o
  // denominador útil é quem já marcou
  const oficialPassou = oficialSemana != null && oficialSemana.data <= hoje;
  const espAtivas = duplas.filter(
    (d) => d.status === "ativa" && d.trilha === "especialista"
  ).length;

  // ===== janela "ciclo" (REALIZA-195): timeline dos encontros oficiais +
  // acumulado honesto. Só conta o que já era pra ter acontecido: eventos
  // `encontro` com data oficial <= hoje (a âncora `hoje` do server — a
  // mesma régua do agoraMs). Recesso estende por data_fim na janela
  // navegável e etapa de preparação sem data nunca vira célula — ambos
  // ficam de fora do agregado por não serem encontro.
  const encontrosCiclo = useMemo(
    () =>
      eventosSel
        .filter((e) => e.tipo === "encontro" && e.numero != null)
        .sort((a, b) => a.ordem - b.ordem),
    [eventosSel]
  );
  const acumCiclo = useMemo(() => {
    const a = {
      esperados: 0,
      comRegistro: 0,
      aguardando: 0,
      agendados: 0,
      naoAconteceram: 0,
      semData: 0,
    };
    for (const e of encontrosCiclo) {
      if (e.data == null || e.data > hoje) continue; // acumulado = passado
      const resumoN = resumoSemanaDe(duplas, e);
      const itensN = itensPorNumero.get(e.numero!) ?? [];
      const b = bucketsDoEncontro(itensN, agoraMs);
      const total = resumoN?.total ?? 0;
      a.esperados += total;
      a.comRegistro += b.realizados.length;
      a.aguardando += b.pendentes.length;
      a.agendados += b.agendados.length;
      a.naoAconteceram += b.naoAconteceram.length;
      a.semData += Math.max(0, total - itensN.length);
    }
    return a;
  }, [encontrosCiclo, itensPorNumero, duplas, hoje, agoraMs]);

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
      ehMentor={ehMentorUi}
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

  // "nada marcado" cobre o dia completamente vazio (sem oficial nem encontro
  // de dupla); com itens o vazio é só do calendário oficial e a cópia fica
  // precisa — mesma leitura no painel lateral e na visão "dia"
  const diaVazio =
    eventosSelecionados.length === 0 &&
    itensDupla.length === 0 &&
    faltantesDoDia.length === 0;

  // ===== corpo do detalhe do dia — compartilhado entre o painel lateral
  // (visões "mes" e "semana" do mentor) e a visão "dia" cheia (REALIZA-163).
  // O que muda entre os dois é só o cabeçalho editorial (o da "dia" é a data
  // por extenso + o CTA "Agendar neste dia"); o corpo é idêntico =====
  const corpoDetalheDia = (
    <>
      {/* a célula pinta o dia; a linha detalha o PERÍODO de quem tá
          livre nesse dia da semana (REALIZA-24). Só entra lado livre —
          dia sem ninguém disponível não rende linha */}
      {dispoDoSel.length > 0 && (
        <p className="mt-3 text-sm text-muted-foreground">
          Disponível neste dia:{" "}
          {dispoDoSel.map((s, i) => (
            <Fragment key={`${s.quem}-${i}`}>
              {i > 0 && " · "}
              <span className="text-foreground">{s.quem}</span>
              {s.texto ? ` (${s.texto})` : ""}
            </Fragment>
          ))}
        </p>
      )}
      {/* encontros das duplas no dia vêm ANTES do oficial — quem abre o
          dia procura primeiro "qual encontro eu registrei/marquei aqui"
          (K5); o que o ciclo marca pro dia fecha o painel. A superfície
          tinta separa "seu" (linhas + ações) do oficial do ciclo. Pra
          coord/sup o bloco também hospeda a coorte invisível do
          encontro oficial do dia, então ela sozinha já abre a
          superfície */}
      {(itensDupla.length > 0 || faltantesDoDia.length > 0) && (
        <div className="mt-3 rounded-xl bg-muted/50 p-3 shadow-[var(--shadow-inset)]">
          {itensDupla.length > 0 && (
            <>
              <h3 className="px-2 text-xs sm:text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                {ehMentorUi ? "Sua dupla" : "Duplas"}
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
          {ehMentorUi &&
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
              <p className="px-2 pb-0.5 pt-2 text-xs sm:text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
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
      {eventosSelecionados.length === 0 ? (
        <div
          className={
            itensDupla.length > 0 || faltantesDoDia.length > 0
              ? "mt-4"
              : "mt-3"
          }
        >
          <p className="text-sm text-muted-foreground">
            {diaVazio
              ? "Nada marcado neste dia."
              : "Nenhum evento oficial neste dia."}
          </p>
          {proximoDiaIso && (
            <button
              type="button"
              onClick={(e) => {
                pedirRolarSePonteiro(e, proximoDiaIso);
                if (navegaPorDia) irParaDia(proximoDiaIso);
                else moverPara(proximoDiaIso);
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
        <div
          className={cn(
            "space-y-4",
            itensDupla.length > 0 || faltantesDoDia.length > 0
              ? "mt-4"
              : "mt-3"
          )}
        >
          {/* rótulo do bloco oficial — só quando há itens de dupla
              acima: separa "o que o programa marca pro dia" do "seu"
              na ordem nova do painel (K5) */}
          {(itensDupla.length > 0 || faltantesDoDia.length > 0) && (
            <h3 className="text-xs sm:text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              {eventosSelecionados.length > 1
                ? "Eventos oficiais"
                : "Evento oficial"}
            </h3>
          )}
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
              {e.data != null && e.data_fim && (
                <p className="text-sm text-muted-foreground">
                  de {diaCompacto(e.data)} a {diaCompacto(e.data_fim)}
                </p>
              )}
              {/* nota operacional do cronograma (0062) — "Reposição na
                  mesma semana", feriado, encontro duplo */}
              {e.observacao && (
                <p className="text-sm text-muted-foreground">
                  {e.observacao}
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
              {/* guia do encontro (REALIZA-195): "como conduzir" pra quem
                  conduz (mentor), "o que cobre" pra quem monitora (coord/
                  sup/aux) — <details> nativo, a mesma gramática do card
                  da faixa. Null fora da trilha DPP canônica (1..16) */}
              {e.tipo === "encontro" &&
                e.numero != null &&
                (() => {
                  const guia = guiaDoEncontro(e.numero);
                  if (!guia) return null;
                  // staff+mentor na superfície de equipe lê a voz do
                  // monitor ("o que cobre") — "como conduzir" é da visão
                  // mentor dele, atrás do ?visao=dpp
                  const texto = ehMentorUi ? guia.conduzir : guia.cobre;
                  const rotulo = ehMentorUi ? "Como conduzir" : "O que cobre";
                  return (
                    <details className="group rounded-lg transition-colors hover:bg-muted/40">
                      <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-md px-1 text-sm font-medium text-muted-foreground select-none hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:min-h-8 [&::-webkit-details-marker]:hidden">
                        <CaretDown
                          aria-hidden
                          size={14}
                          className="shrink-0 transition-transform group-open:rotate-180"
                        />
                        {rotulo}
                      </summary>
                      <p className="px-1 pb-1 text-sm leading-relaxed text-muted-foreground">
                        {texto}
                      </p>
                    </details>
                  );
                })()}
              {/* materiais que o guia pede pro encontro — sem material,
                  o bloco não renderiza (nada de seção vazia) */}
              {materiaisDoEncontro.length > 0 && (
                <div className="pt-1.5">
                  <h3 className="text-xs sm:text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
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
                  <CoberturaEncontro duplas={duplas} evento={e} />
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
    </>
  );

  if (eventosSel.length === 0) return null;

  return (
    <div className="space-y-4">
      {/* faixa "Semana do programa" compartilhada (REALIZA-195 · v8b) — a
          mesma estrutura do monitoramento; no calendário o recorte é o
          cronograma selecionado (o board é por turma) e supervisões ficam
          na mesa de monitoramento — aqui só os oficiais. A faixa NÃO
          depende de `materiais` (fetch tardio) — usa o evento + guia.
          Fora do grid do painel pra não disputar a linha 1 */}
      {ehCoordSup && (
        <SemanaDoPrograma
          itens={itensDaSemanaPrograma(
            eventos.filter(
              (e) =>
                cronogramaSel == null || e.cronograma_id === cronogramaSel
            ),
            cronogramas,
            [],
            new Date(agoraMs),
            // meta "N duplas" do encontro — o escopo que o RLS entrega
            // (coorte pra coord; supervisionadas + própria pro híbrido)
            duplas
          )}
          hoje={hoje}
          modo="coord"
          // "Abrir chamada" é da coordenação — o painel de presença é dela
          // (sup+mentor lê a faixa mas nunca tem o CTA)
          podeChamada={ehCoord}
          titulo="Semana do programa"
          ariaLabel="Semana do programa"
        />
      )}

      <div
        className={cn(
          "space-y-4",
          // o grid de duas colunas (calendário + painel) existe nas visões
          // com detalhe do dia; horarios e ciclo são coluna única full-width
          comDetalheDia &&
            "lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(300px,340px)] lg:items-start lg:gap-5 lg:space-y-0"
        )}
      >
      {/* ===== calendário / board da semana / lista do ciclo ===== */}
      <div className="overflow-hidden rounded-xl bg-card shadow-[var(--shadow-border)] lg:col-start-1 lg:row-start-1">
        {/* etapas de preparação (0062) — contexto do cronograma, não
            protagonista: colapsável no topo, com status. As concluídas sem
            data (ONG parceira) só existem aqui — fora da grade e da semana */}
        {etapasPreparacao.length > 0 && (
          <details className="group border-b">
            <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 px-4 py-2.5 text-sm text-muted-foreground transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring sm:min-h-8 sm:px-5 [&::-webkit-details-marker]:hidden">
              <CaretDown
                aria-hidden
                size={14}
                className="transition-transform group-open:rotate-180"
              />
              <span className="font-medium">Etapas de preparação</span>
              <span className="text-xs tabular-nums">
                {etapasConcluidas} de {etapasPreparacao.length} concluídas
              </span>
            </summary>
            <ul className="divide-y divide-border/60 border-t px-4 sm:px-5">
              {etapasPreparacao.map((e) => (
                <li
                  key={e.id}
                  className="flex items-baseline gap-x-3 py-2 text-sm"
                >
                  <span className="w-24 shrink-0 text-xs tabular-nums text-muted-foreground">
                    {e.data
                      ? e.data_fim
                        ? `${diaCompacto(e.data)}–${diaCompacto(e.data_fim)}`
                        : diaCompacto(e.data)
                      : "—"}
                  </span>
                  <span className="min-w-0 flex-1">
                    {e.titulo}
                    {e.observacao && (
                      <span className="block truncate text-xs text-muted-foreground">
                        {e.observacao}
                      </span>
                    )}
                  </span>
                  <span
                    className={cn(
                      "inline-flex shrink-0 items-center gap-1.5 text-xs font-medium",
                      e.status === "concluida"
                        ? "text-[var(--ok-text)]"
                        : "text-muted-foreground"
                    )}
                  >
                    {e.status === "concluida" && (
                      <CheckCircle aria-hidden size={13} weight="bold" />
                    )}
                    {e.status === "concluida" ? "Concluída" : "Pendente"}
                  </span>
                </li>
              ))}
            </ul>
          </details>
        )}
        {/* chrome do card, uma faixa só: "como olhar" à esquerda (visão —
            coord/sup alternam dia/semana/mês/ciclo — a unidade de trabalho
            delas é a semana; o mentor alterna dia/mês/semana/horários,
            REALIZA-25/163) + "o que olhar" à direita (turma, quando há
            mais de um cronograma aplicável) */}
        {(ehCoordSup || ehMentorUi || opcoesCron.length > 1) && (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 border-b px-2 py-1.5 sm:px-3">
            {/* escolha exclusiva → radio nativo (padrão OpcaoPilula): setas do
                teclado e "selecionado" na leitura de tela saem de graça; a
                pill ativa veste a língua do filter-chip (bg-foreground) em vez
                do bg-muted que sumia na barra */}
            {ehCoordSup && (
              <fieldset className="flex items-center gap-1">
                <legend className="sr-only">Visão da agenda</legend>
                {(
                  [
                    ["dia", "Dia"],
                    ["semana", "Semana"],
                    ["mes", "Mês"],
                    ["ciclo", "Ciclo"],
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
                      onChange={() => (v === "dia" ? abrirDia() : setVisao(v))}
                      className="sr-only"
                    />
                    {rotulo}
                  </label>
                ))}
              </fieldset>
            )}
            {ehMentorUi && (
              <fieldset className="flex items-center gap-1">
                <legend className="sr-only">Visão da agenda</legend>
                {(
                  [
                    ["dia", "Dia"],
                    ["mes", "Mês"],
                    ["semana", "Semana"],
                    ["horarios", "Horários"],
                  ] as const
                ).map(([v, rotulo]) => (
                  <label
                    key={v}
                    className={cn(
                      filterChipCls(visao === v),
                      "flex-1 cursor-pointer justify-center sm:flex-none",
                      "has-focus-visible:ring-2 has-focus-visible:ring-ring"
                    )}
                  >
                    <input
                      type="radio"
                      name="agenda-visao"
                      value={v}
                      checked={visao === v}
                      onChange={() => mudarVisaoMentor(v)}
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
                diferentes. O VALUE é o id do cronograma (nunca a string de
                turma — duplicatas não colidem); o label vai na forma
                narrativa canônica e o nome do calendário desambigua quando
                duas opções têm a mesma turma */}
            {opcoesCron.length > 1 && (
              <div className="ms-auto flex items-center gap-2">
                <Label
                  htmlFor="agenda-cronograma"
                  className="shrink-0 text-xs sm:text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground"
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
                        ? `${turmaLonga(c.turma)} · ${c.nome}`
                        : turmaLonga(c.turma),
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
                            {turmaLonga(c.turma)}
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

        {/* chrome de navegação — por-visão: dias na "dia", meses no "mes",
            semanas na "semana" e nos "horarios"; o "ciclo" é a visão geral
            e não navega */}
        {visaoEfetiva !== "ciclo" && (
          <div className="flex items-center gap-1 border-b px-2 py-1.5 sm:px-3">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={
                navegaPorDia
                  ? "Dia anterior"
                  : navegaPorSemana
                    ? "Semana anterior"
                    : "Mês anterior"
              }
              disabled={
                navegaPorDia
                  ? selecionado <= minDia
                  : navegaPorSemana
                    ? semanaIso <= minSemana
                    : mes <= minMes
              }
              onClick={() =>
                navegaPorDia
                  ? irParaDia(paraISO(somarDias(dataSel, -1)))
                  : navegaPorSemana
                    ? irParaSemana(paraISO(somarDias(parseDia(semanaIso), -7)))
                    : irParaMes(mes - 1)
              }
              className="text-muted-foreground"
            >
              <CaretLeft aria-hidden />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={
                navegaPorDia
                  ? "Próximo dia"
                  : navegaPorSemana
                    ? "Próxima semana"
                    : "Próximo mês"
              }
              disabled={
                navegaPorDia
                  ? selecionado >= maxDia
                  : navegaPorSemana
                    ? semanaIso >= maxSemana
                    : mes >= maxMes
              }
              onClick={() =>
                navegaPorDia
                  ? irParaDia(paraISO(somarDias(dataSel, 1)))
                  : navegaPorSemana
                    ? irParaSemana(paraISO(somarDias(parseDia(semanaIso), 7)))
                    : irParaMes(mes + 1)
              }
              className="text-muted-foreground"
            >
              <CaretRight aria-hidden />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={
                navegaPorDia
                  ? selecionado === hoje || !hojeNoAlcance
                  : navegaPorSemana
                    ? semanaIso === segHojeClamped
                    : mes === mesHoje || !hojeNoAlcance
              }
              onClick={() =>
                navegaPorDia
                  ? irParaDia(hoje)
                  : navegaPorSemana
                    ? irParaSemana(segHoje)
                    : irParaMes(mesHoje)
              }
              className="ms-0.5 text-muted-foreground"
            >
              Hoje
            </Button>
            <p
              id="agenda-mes-rotulo"
              aria-live="polite"
              className="min-w-0 flex-1 truncate px-2.5 text-lg font-semibold tracking-tight"
            >
              {navegaPorDia ? (
                <>
                  {/* o mesmo recorte mobile/desktop do rótulo de mês —
                      "ter 27 out" na 390px, a data completa no sm+ */}
                  <span className="sm:hidden">
                    {diaCompacto(selecionado)}
                  </span>
                  <span className="hidden sm:inline">
                    {capitalizar(fmtCompleta.format(dataSel))}
                  </span>
                </>
              ) : navegaPorSemana ? (
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
            No "mes" o toque abre o dia; nas visões de semana ("semana",
            "horarios") navega pra semana dele; na "dia", pro dia dele. */}
        {visaoEfetiva !== "ciclo" && encontrosRail.length >= 2 && (
          <nav
            aria-label="Encontros da jornada"
            className="border-b px-3 pb-1.5 pt-2 sm:px-4"
          >
            <div className="scroll-fina flex items-center overflow-x-auto pb-1">
              {encontrosRail.map((e, i) => {
                const passou = e.data < hoje;
                const atual = e.id === eventoSemanaSel?.id;
                // semana exibida nas grades ≠ semana atual: o disco ganha o
                // anel de seleção (mesma gramática do dia selecionado no grid)
                const exibida =
                  navegaPorSemana &&
                  oficialSemana?.id === e.id &&
                  !atual;
                const prevPassou = i > 0 && encontrosRail[i - 1].data < hoje;
                const dataFmt = fmtCompleta.format(parseDia(e.data));
                // nó passado carrega a cobertura falada pra quem monitora —
                // o rail vira mapa de monitoramento sem ganhar ruído visual
                const cobertura =
                  ehCoordSup && passou ? resumoSemanaDe(duplas, e) : null;
                const rotuloBase =
                  navegaPorSemana
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
                        if (navegaPorSemana) {
                          irParaSemana(semanaBounds(parseDia(e.data)).seg);
                        } else if (navegaPorDia) {
                          irParaDia(e.data);
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
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pt-1 pb-1 text-xs sm:text-[11px] text-muted-foreground">
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
                className="py-2 text-center text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground"
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

                  // tinta de disponibilidade do dia da semana da célula
                  // (REALIZA-24) — passados também pintam: o planejamento
                  // retrocede semanas inteiras, não só pra frente
                  const dowCel = overlayDispo ? diaSemanaDe(iso) : null;
                  const tintaDispo = dowCel
                    ? cruzamentoDisponibilidade(
                        mentorDisponibilidade,
                        jovensDispo.map((j) => j.disp),
                        dowCel
                      )
                    : "nenhum";
                  const jovensLivresCel = dowCel
                    ? jovensDispo.filter((j) =>
                        disponibilidadeNoDia(j.disp, dowCel)
                      )
                    : [];
                  const dispoA11y = dispoTextoDia(tintaDispo, jovensLivresCel);

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
                      : "") +
                    dispoA11y;

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
                          "relative flex min-h-11 w-full flex-col items-start rounded-lg px-1.5 pb-1 pt-1 transition-[color,background-color,box-shadow] hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:min-h-12",
                          temRecesso && "hatch-recesso",
                          ehSelecionado && "ring-2 ring-foreground/30"
                        )}
                      >
                        {/* tinta de disponibilidade — atrás do conteúdo mas
                            na frente do bg do botão: o hatch do recesso
                            segue por baixo e o anel do selecionado por fora */}
                        {tintaDispo !== "nenhum" && (
                          <span
                            aria-hidden
                            // locator estável das specs — o gradiente inline
                            // era o único jeito de achar a tinta "ambos"
                            data-tinta={tintaDispo}
                            className={cn(
                              "absolute inset-0 rounded-lg",
                              tintaDispo === "ambos"
                                ? undefined
                                : TINTA_DISPONIBILIDADE[tintaDispo]
                            )}
                            style={
                              tintaDispo === "ambos"
                                ? { backgroundImage: GRADIENTE_AMBOS_DISPONIVEIS }
                                : undefined
                            }
                          />
                        )}
                        <span
                          aria-hidden
                          className="relative flex w-full items-center justify-between gap-1"
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
                            <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
                              Recesso
                            </span>
                          )}
                        </span>
                        <span
                          aria-hidden
                          className="relative mt-auto flex w-full items-center gap-1"
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
                            if (e.tipo === "etapa_preparacao")
                              // discreto: contexto operacional, não o
                              // protagonista do dia (espelha MarcadorTipo)
                              return (
                                <CheckCircle
                                  key={e.id}
                                  size={13}
                                  weight="bold"
                                  className="text-muted-foreground"
                                />
                              );
                            if (e.tipo === "evento_encerramento")
                              return (
                                <Flag
                                  key={e.id}
                                  size={14}
                                  weight="fill"
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
                                    limboAberto(encontro, agoraMs)
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
        <LegendaAgenda
          temDotsDupla={temDotsDuplaNoMes}
          legendaDispo={legendaDispo}
        />
        </>
        )}

        {/* ===== visão "semana" do mentor (REALIZA-25): a semana em grade
            compacta — blocos empilhados por hora + o mesmo painel de
            detalhe do dia embaixo/ao lado ===== */}
        {visaoEfetiva === "semana" && ehMentorUi && (
          <SemanaMentor
            semanaIso={semanaIso}
            selecionado={selecionado}
            direcao={direcao}
            onSelecionar={selecionarDiaNaSemana}
            legendaDispo={legendaDispo}
            ctx={ctxGradesMentor}
          />
        )}

        {/* ===== visão "horarios" do mentor (REALIZA-25): a grade estilo
            calendário — clicar no vazio agenda, blocos levam à ficha ===== */}
        {visaoEfetiva === "horarios" && ehMentorUi && (
          <HorariosMentor
            semanaIso={semanaIso}
            direcao={direcao}
            ctx={ctxGradesMentor}
            duplasAgendaveis={duplasAgendaveis}
            alvosPorDupla={alvosPorDupla}
            legendaDispo={legendaDispo}
            onEncontroCriado={encontroCriado}
          />
        )}

        {/* ===== visão "dia" (REALIZA-163): o detalhe do dia selecionado
            promovido a visão cheia — o mesmo corpo do painel lateral, sem o
            calendário ao lado. O chrome do card navega dia a dia sobre a
            seleção; o rótulo live-region já anuncia a data inteira ===== */}
        {visaoEfetiva === "dia" && (
          <div
            key={selecionado}
            className="animate-enter-x px-4 py-4 sm:px-5"
            style={{ "--dir": `${direcao * 8}px` } as CSSProperties}
          >
            <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
              <h2 className="text-base font-semibold tracking-tight sm:text-lg">
                {capitalizar(formatDiaSemana(selecionado))}, {diaSel} de{" "}
                {mesSelLongo}
                {anoSuffix}
                <span className="ml-1.5 text-sm font-normal text-muted-foreground">
                  · {relSel}
                </span>
              </h2>
              {/* atalho de agendamento do mentor: cai na grade de horários
                  ancorada na semana deste dia — a mesma troca do chip, com
                  a intenção no rótulo */}
              {ehMentorUi && duplasAgendaveis.length > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => mudarVisaoMentor("horarios")}
                >
                  <CalendarPlus size={16} aria-hidden />
                  Agendar neste dia
                </Button>
              )}
            </div>
            {corpoDetalheDia}
          </div>
        )}

        {/* ===== visão "semana" (coord/sup): o board do encontro oficial ===== */}
        {visaoEfetiva === "semana" && ehCoordSup && (
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
                  {oficiaisSemana.length > 1
                    ? // semana de encontro duplo (T2): a manchete nomeia os
                      // dois — espelha rotuloSemana
                      `Semana dos encontros ${oficiaisSemana
                        .slice(0, -1)
                        .map((e) => e.numero)
                        .join(", ")} e ${oficiaisSemana.at(-1)!.numero}`
                    : oficialSemana?.numero != null
                      ? `Semana do ${oficialSemana.numero}º encontro`
                      : outrosDaSemana.some(
                            (e) => e.tipo === "evento_encerramento"
                          )
                        ? "Semana de encerramento"
                        : outrosDaSemana.some((e) => e.tipo === "recesso")
                          ? "Semana de recesso"
                          : outrosDaSemana.some((e) => e.tipo === "formacao")
                            ? "Semana de formação"
                            : outrosDaSemana.some(
                                  (e) => e.tipo === "etapa_preparacao"
                                )
                              ? "Semana de preparação"
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
              {/* semana dupla: o 2º encontro ganha linha-meta própria — os
                  agregados seguem ancorados no 1º (menor nº) */}
              {oficiaisSemana.slice(1).map((e) => (
                <p
                  key={e.id}
                  className="mt-0.5 text-sm text-muted-foreground"
                >
                  {e.numero}º encontro · {e.titulo} · {diaCompacto(e.data)}
                </p>
              ))}
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
                      {/* denominador único: as ativas do cronograma — quem
                          não tem row do oficial vira segmento "sem data" */}
                      <ResumoEncontrosDupla
                        itens={itensBoard}
                        total={resumoOficial?.total}
                        agora={agoraMs}
                      />
                    </div>
                    {/* legenda nomeada — nenhum dígito solto perto da barra */}
                    <LegendaEncontrosDupla
                      itens={itensBoard}
                      total={resumoOficial?.total}
                      agora={agoraMs}
                    />
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
                    <p className="px-2 pb-0.5 pt-2 text-xs sm:text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
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

        {/* ===== visão "ciclo" (coord/sup · v8b): timeline dos encontros
            oficiais (altura da célula = cobertura) + acumulado honesto
            dos passados + a linha-a-linha completa atrás de <details>.
            Não navega no tempo — o clique na célula/linha salta pra
            semana do encontro ===== */}
        {visaoEfetiva === "ciclo" && (
          <div>
            <p className="px-4 pb-1 pt-3 text-xs sm:text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground sm:px-5">
              Encontros do ciclo: cobertura por número
            </p>
            {/* timeline: uma célula por encontro oficial, altura = fração
                realizada sobre as ativas daquela semana (denominador do
                resumoSemanaDe — honesto por semana). Futuras = contorno
                tracejado sem preenchimento */}
            <div
              role="region"
              aria-label="Timeline dos encontros do ciclo. Role horizontalmente"
              tabIndex={0}
              className="scroll-fina overflow-x-auto px-4 pt-2 sm:px-5"
            >
              <ol className="flex min-w-[34rem] items-end gap-1">
                {encontrosCiclo.map((e) => {
                  const resumoN = resumoSemanaDe(duplas, e);
                  const passouN = e.data != null && e.data <= hoje;
                  const total = resumoN?.total ?? 0;
                  const feitos = resumoN?.realizaram ?? 0;
                  const pct =
                    passouN && total > 0
                      ? Math.min(100, Math.round((feitos / total) * 100))
                      : 0;
                  const rotulo = `${e.numero}º encontro${
                    e.data ? `, ${diaCompacto(e.data)}` : ", sem data"
                  }: ${
                    passouN
                      ? `${feitos} de ${total} realizaram`
                      : "ainda não chegou"
                  }`;
                  return (
                    <li key={e.id} className="flex-1">
                      <button
                        type="button"
                        disabled={e.data == null}
                        onClick={() => {
                          if (e.data == null) return;
                          irParaSemana(semanaBounds(parseDia(e.data)).seg);
                          setVisao("semana");
                        }}
                        aria-label={rotulo}
                        className={cn(
                          "flex w-full flex-col items-stretch gap-1 rounded-md p-1 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                          e.data != null && "hover:bg-muted/50"
                        )}
                      >
                        <span
                          aria-hidden
                          className={cn(
                            "relative h-16 overflow-hidden rounded-[4px] bg-muted",
                            // encontro futuro: moldura tracejada via border
                            // (ring-dashed não existe no Tailwind v4 — o
                            // tracejado sumia e o slot futuro ficava nu)
                            !passouN &&
                              "border border-dashed border-muted-foreground/35 bg-transparent"
                          )}
                        >
                          {passouN && (
                            <span
                              className="absolute inset-x-0 bottom-0 bg-[var(--brand-lime)] transition-[height] duration-500 ease-snappy"
                              style={{ height: `${pct}%` }}
                            />
                          )}
                          {passouN && total > 0 && feitos < total && (
                            <span className="viz-hatch absolute inset-x-0 top-0" style={{ height: `${100 - pct}%` }} />
                          )}
                        </span>
                        <span
                          className={cn(
                            "text-center text-[10px] font-medium tabular-nums",
                            passouN
                              ? "text-muted-foreground"
                              : "text-muted-foreground/60"
                          )}
                        >
                          {e.numero}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ol>
            </div>

            {/* acumulado do ciclo — soma das semanas já passadas, um
                denominador só (Σ das ativas de cada semana oficial) */}
            <div className="mx-4 mt-3 rounded-lg bg-muted/40 px-3 py-2.5 sm:mx-5">
              <p className="text-xs text-muted-foreground">
                <b className="font-semibold text-foreground tabular-nums">
                  {acumCiclo.comRegistro} de {acumCiclo.esperados}
                </b>{" "}
                encontros oficiais com registro · acumulado do ciclo
              </p>
              {acumCiclo.esperados > 0 && (
                <BarraSegmentada
                  className="mt-1.5"
                  altura="md"
                  denominador={acumCiclo.esperados}
                  legenda
                  segmentos={[
                    {
                      valor: acumCiclo.comRegistro,
                      rotulo: "com registro",
                      cls: "bg-[var(--ok)]",
                    },
                    {
                      valor: acumCiclo.aguardando,
                      rotulo: "pendentes de registro",
                      cls: "bg-[var(--warn)]",
                    },
                    {
                      valor: acumCiclo.agendados,
                      rotulo: "agendados",
                      cls: "bg-muted-foreground/40",
                    },
                    {
                      valor: acumCiclo.naoAconteceram,
                      rotulo: "não aconteceram",
                      cls: "bg-muted-foreground/25",
                    },
                    { valor: acumCiclo.semData, rotulo: "sem data" },
                  ]}
                />
              )}
            </div>

            {/* a linha-a-linha completa fica atrás de <details> — a
                timeline responde "e o ciclo?", a lista prova cada número */}
            <details className="group mt-2" open>
              <summary className="mx-4 flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-md py-2 text-xs font-medium text-muted-foreground select-none hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:mx-5 sm:min-h-8 [&::-webkit-details-marker]:hidden">
                <CaretDown
                  aria-hidden
                  size={13}
                  className="shrink-0 transition-transform group-open:rotate-180"
                />
                Linha a linha do ciclo
              </summary>
            <ul className="divide-y divide-border/60 pb-1">
              {[...eventosSel]
                // a sequência do PDF é `ordem` (0062), não a data — etapa
                // concluída sem data ficaria depois do encerramento
                .sort((a, b) => a.ordem - b.ordem)
                .map((e) => {
                  const ehEncontro = e.tipo === "encontro" && e.numero != null;
                  const itensN = ehEncontro
                    ? (itensPorNumero.get(e.numero!) ?? [])
                    : [];
                  const resumoN = ehEncontro ? resumoSemanaDe(duplas, e) : null;
                  const passouN = e.data != null && e.data <= hoje;
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
                        // etapa concluída sem data (0062) não tem semana pra
                        // saltar — a linha vira leitura, não navegação
                        disabled={e.data == null}
                        onClick={() => {
                          if (e.data == null) return;
                          // a linha inteira salta pra semana do evento — a
                          // visão "semana" é onde a cobertura se trabalha
                          irParaSemana(semanaBounds(parseDia(e.data)).seg);
                          setVisao("semana");
                        }}
                        className={cn(
                          "flex w-full flex-wrap items-center gap-x-3 gap-y-1.5 px-4 py-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring sm:px-5",
                          e.data != null && "hover:bg-muted/50",
                          // a linha do encontro da semana corrente ganha o
                          // fundo lime — mesma faixa da linha de semana no mês
                          e.id === eventoSemanaSel?.id &&
                            "bg-[var(--brand-lime)]/8"
                        )}
                      >
                        <span className="w-20 shrink-0 whitespace-nowrap text-sm tabular-nums text-muted-foreground">
                          {/* etapa entregue pela ONG sem data: o status é a
                              informação, não o dia */}
                          {e.data ? diaCompacto(e.data) : "Concluída"}
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
                                total={resumoN?.total}
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
            </details>
          </div>
        )}

        {/* trilha especialista: fora de todos os agregados por-cronograma (os
            encontros dela não seguem o calendário oficial) — nota de rodapé no card,
            visível nas três visões; a saída é a lista de duplas, não um
            número aqui */}
        {espAtivas > 0 && (
          <p className="border-t px-4 py-2.5 text-xs text-muted-foreground sm:px-5">
            <Link
              href="/duplas"
              className="inline-flex items-center gap-1 rounded-md py-0.5 transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {espAtivas} {espAtivas === 1 ? "dupla" : "duplas"} em trilha
              especialista, fora do calendário oficial
              <ArrowUpRight aria-hidden size={12} />
            </Link>
          </p>
        )}
      </div>

      {/* ===== detalhe do dia selecionado — âncora do mês e da semana
          compacta do mentor (REALIZA-25); a grade de horários agenda
          direto no clique e não o hospeda. A visão "dia" (REALIZA-163)
          renderiza o mesmo corpo (corpoDetalheDia) full-width no card ===== */}
      {comDetalheDia && (
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
            {corpoDetalheDia}
          </motion.div>
        </AnimatePresence>
      </section>
      )}

      {/* ===== lista do mês — acompanhamento empilhado da visão "mes"; pra
          coord/sup a leitura de conjunto virou a visão "Ciclo" (timeline
          dentro do card), e nas grades do mentor ela não repete o que a
          grade mostra */}
      {!ehCoordSup && visaoEfetiva === "mes" && (
      <section
        aria-label={`Todos os eventos de ${rotuloMes}`}
        className="lg:col-span-2"
      >
        <h2 className="mb-3 px-1 text-base font-semibold">
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
                    ? coberturaEncontro(duplas, e)
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
    </div>
  );
}

/** "X de Y duplas registraram" — cobertura agregada do encontro oficial no
 *  detalhe do dia (coord/supervisor). */
function CoberturaEncontro({ duplas, evento }: { duplas: Dupla[]; evento: CicloEvento }) {
  const { registraram, total } = coberturaEncontro(duplas, evento);
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
 *  ("Sua dupla"), sem depender deste bloco.
 *  K3: quando o dia já tem encontro desta dupla (linha em "Sua dupla"), o
 *  retroativo nunca pode ler como ação sobre ela — dia resolvido
 *  (realizado+registro) ganha a nota de "outro que ficou faltando" e o
 *  rótulo nomeia o alvo; qualquer outra linha no dia já força "outro
 *  encontro"/"o Nº encontro" no rótulo. */
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
  // encontro oficial do dia — no máximo 1 por cronograma (a semana dupla da
  // T2 é terça+quinta, dois dias; e aqui o recorte é o cronograma da dupla).
  // Na trilha especialista não existe oficial: o CTA cai sempre no ramo
  // "próximo encontro pendente", sem importar o nº do calendário DPP. E o
  // oficial precisa ser do cronograma DA DUPLA — com duas turmas, o encontro
  // 5 do dia na tela pode ser de outro cronograma que o dela
  const oficial =
    dupla.trilha === "especialista"
      ? null
      : (eventosDoDia.find(
          (e): e is EventoDatado =>
            e.tipo === "encontro" &&
            e.numero != null &&
            e.data != null &&
            e.cronograma_id === dupla.cronograma_id
        ) ?? null);
  const rowOficial = oficial
    ? (dupla.encontros.find((e) => e.numero === oficial.numero) ?? null)
    : null;

  // encontro desta dupla caindo no dia selecionado aparece em "Sua dupla"
  // acima — o realizado COM registro "resolve" o dia (K3): o botão
  // "Registrar encontro" solto embaixo lia como ação sobre essa linha
  // ("o encontro não foi registrado"). Regra: dia resolvido ⇒ a nota
  // ancora o gesto (é outro encontro, em qualquer data) e o rótulo nomeia
  // o alvo; dia com outro encontro qualquer ⇒ o rótulo já diz "outro".
  const encontrosNoDia = dupla.encontros.some(
    (e) => diaDoEncontro(e) === selecionado
  );
  const diaResolvido = dupla.encontros.some(
    (e) =>
      e.status === "realizado" &&
      e.registro != null &&
      diaDoEncontro(e) === selecionado
  );
  const notaResolvido = diaResolvido ? (
    <p className="w-full text-xs text-muted-foreground">
      O encontro deste dia já tem registro. Aqui você registra outro que
      ficou faltando.
    </p>
  ) : null;

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
            jovemNome={dupla.mentorado.nome.split(" ")[0]}
            onCreated={onEncontroCriado}
          />
        );
      } else if (alvo.faltantes.some((f) => f.numero === oficial.numero)) {
        // K3: com encontro da dupla no dia, o rótulo nomeia o nº faltante —
        // nunca um "Registrar encontro" genérico que pareça se referir à
        // linha de "Sua dupla"; e com o dia resolvido a nota ancora o gesto
        acao = (
          <>
            {notaResolvido}
            <RegistrarRetroativoDialog
              duplaId={dupla.id}
              faltantes={alvo.faltantes}
              numeroInicial={oficial.numero}
              quandoPadrao={oficial.data}
              onCreated={onEncontroCriado}
              trigger={
                <Button variant="outline" size="sm">
                  <ClockCounterClockwise size={16} />
                  {encontrosNoDia
                    ? `Registrar o ${oficial.numero}º encontro`
                    : "Registrar encontro"}
                </Button>
              }
            />
          </>
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
          jovemNome={dupla.mentorado.nome.split(" ")[0]}
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
          jovemNome={dupla.mentorado.nome.split(" ")[0]}
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
        // K3: o CTA retroativo do dia genérico também obedece à regra do
        // dia resolvido — "outro encontro" (qualquer data) com a nota, e
        // nunca botão isolado sob a linha de um encontro já registrado
        acao = (
          <>
            {notaResolvido}
            <RegistrarRetroativoDialog
              duplaId={dupla.id}
              faltantes={opcoes}
              quandoPadrao={selecionado}
              onCreated={onEncontroCriado}
              trigger={
                <Button variant="outline" size="sm">
                  <ClockCounterClockwise size={16} />
                  {encontrosNoDia
                    ? "Registrar outro encontro"
                    : "Registrar encontro"}
                </Button>
              }
            />
          </>
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
  const limbo = limboAberto(encontro, agora);
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
        className={buttonVariants({ variant: "outline", size: "sm" })}
      >
        <VideoCamera aria-hidden />
        Entrar na chamada
        <span className="sr-only"> (abre em nova aba)</span>
      </a>
    ) : (
      <CopiarChamada url={linkChamada} icone />
    );

  // trocar o link sem remarcar — gesto do mentor sobre o encontro agendado.
  // Independe de linkChamada: o agendado SEM link é justamente quem precisa
  // do "adicionar" — o lápis ocupa o lugar do chip quando ele não existe.
  // Coord/sup copiam o link, nunca editam (regra da action, não só daqui)
  const editarLink =
    ehMentor && encontro.status === "agendado" ? (
      <EditarLinkDialog encontroId={encontro.id} linkAtual={encontro.link} />
    ) : null;

  // limbo (agendado vencido sem registro — K4): "remarcar" e "não aconteceu"
  // a um toque da linha, mesmo par de gestos da ficha. O follow-up do CTA
  // resolve o "rolou"; estes resolvem "não rolou" e "rola noutra data" —
  // a remarcação abre o AgendarEncontroDialog em modo edição (a action
  // move o agendado passado pra um alvo futuro)
  const acoesLimbo =
    ehMentor && limbo ? (
      <>
        <AgendarEncontroDialog
          duplaId={dupla.id}
          numero={encontro.numero}
          atual={encontro}
          piso={dupla.iniciada_em ?? undefined}
          jovemNome={dupla.mentorado.nome.split(" ")[0]}
          rotulo={
            dupla.trilha === "especialista"
              ? "sessão de especialista"
              : undefined
          }
          trigger={
            <Button variant="outline" size="sm">
              <CalendarBlank size={16} />
              Remarcar
            </Button>
          }
        />
        <NaoAconteceuButton encontroId={encontro.id} duplaId={dupla.id} />
      </>
    ) : null;

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
          <DialogContent size="2xl">
            <DialogHeader>
              <DialogTitle>
                Como foi o {encontro.numero}º encontro
              </DialogTitle>
              <DialogDescription>
                O follow-up do encontro: atividades, avaliação, dificuldades
                e próximo passo.
              </DialogDescription>
            </DialogHeader>
            <RegistroForm
              embutido
              encontroId={encontro.id}
              duplaId={dupla.id}
              evento={evento}
              trilha={dupla.trilha}
              combinadosPendentes={combinadosPendentes}
              onSaved={onRegistroSalvo}
              // telemetria (REALIZA-217): encontro "externo" é o catch-up
              // retroativo (criado já realizado), não um follow-up novo
              origem={encontro.origem === "externo" ? "retroativo" : "novo"}
            />
          </DialogContent>
        </Dialog>
      )}
      {(ctaRegistro || chamada || editarLink || acoesLimbo) && (
        <div className="flex flex-wrap items-center gap-2 px-2 pb-1.5">
          {encontro.status === "realizado"
            ? ctaRegistro
            : ctaRegistro && (
                <RevelarApos from={encontro.data_hora!}>{ctaRegistro}</RevelarApos>
              )}
          {chamada}
          {editarLink}
          {acoesLimbo}
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
  const classeRow = "flex min-h-11 min-w-0 items-center gap-2.5 rounded-lg px-2 py-2";
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
      // D5: nudge pro jovem também conta no cap de 48h da dupla — um
      // lembrete por dupla, seja por qual canal/ponta chegar
      t: "nudge",
    },
  ];
  return (
    <li className="flex items-center gap-1 rounded-lg py-1 pr-1 pl-3 transition-colors hover:bg-muted/50 sm:pl-4">
      <Link
        href={`/duplas/${dupla.id}`}
        className="flex min-h-11 min-w-0 flex-1 items-center truncate rounded-sm text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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

/* =========================== legenda compartilhada =========================== */

/** Legenda única das grades do calendário — mesma gramática de swatches no
 *  mês, na semana compacta e na grade de horários (REALIZA-25 reusa nas
 *  três). "Duplas:" só aparece quando há dots no período exibido; a chave de
 *  disponibilidade (REALIZA-24) só com overlay ligado e algum lado com grade. */
function LegendaAgenda({
  temDotsDupla,
  legendaDispo,
}: {
  temDotsDupla: boolean;
  legendaDispo: boolean;
}) {
  return (
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
      {temDotsDupla && (
        <span className="flex flex-wrap items-center gap-x-3 gap-y-1 border-l border-border pl-4">
          <span className="text-xs font-medium text-muted-foreground">
            Duplas:
          </span>
          <ChaveDotsDupla />
        </span>
      )}
      {/* swatches usam os alfas da legenda (TINTA_LEGENDA), mais densos que
          o da célula — num retângulo miúdo o alfa da célula some no branco */}
      {legendaDispo && (
        <span className="flex flex-wrap items-center gap-x-3 gap-y-1 border-l border-border pl-4">
          <span className="text-xs font-medium text-muted-foreground">
            Disponibilidade:
          </span>
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span
              aria-hidden
              className={cn(
                "h-3.5 w-5 rounded-[3px] ring-1 ring-inset ring-border",
                TINTA_LEGENDA.mentor
              )}
            />
            Você livre
          </span>
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span
              aria-hidden
              className={cn(
                "h-3.5 w-5 rounded-[3px] ring-1 ring-inset ring-border",
                TINTA_LEGENDA.jovem
              )}
            />
            Mentorado livre
          </span>
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span
              aria-hidden
              className="h-3.5 w-5 rounded-[3px] ring-1 ring-inset ring-border"
              style={{ backgroundImage: GRADIENTE_AMBOS_LEGENDA }}
            />
            Ambos livres
          </span>
        </span>
      )}
    </div>
  );
}

/* =========================== grades do mentor (REALIZA-25) =========================== */

/** O que as grades do mentor (semana compacta e hora a hora) leem do pai —
 *  um objeto só porque as duas compartilham o mesmo pacote de derivações. */
type GradeMentorCtx = {
  hoje: string;
  /** Date.now() congelado na montagem — mesma régua de limbo do painel. */
  agoraMs: number;
  porDia: Map<string, CicloEvento[]>;
  duplasPorDia: Map<string, ItemDupla[]>;
  /** Overlay REALIZA-24 ligado (mentor DPP com a prop) — tintas por dia/hora. */
  overlayDispo: boolean;
  mentorDisponibilidade: Disponibilidade | null | undefined;
  jovensDispo: {
    primeiroNome: string;
    disp: Disponibilidade | null | undefined;
  }[];
  /** Mais de uma dupla ativa — os blocos nomeiam o mentorado pra desambiguar. */
  multiDupla: boolean;
  eventoSemanaId: string | undefined;
  marcaSemanaA11y: string | null;
};

/** Sufixo falado do cruzamento do dia — a cor entra no nome acessível da
 *  célula/coluna ("ambos" = mesmo critério da tinta: período em comum). */
function dispoTextoDia(
  tinta: "nenhum" | "mentor" | "jovem" | "ambos",
  jovensLivres: { primeiroNome: string }[]
): string {
  if (tinta === "ambos") return ", ambos livres";
  if (tinta === "mentor") return ", você livre";
  if (tinta === "jovem")
    return jovensLivres.length === 1
      ? `, ${jovensLivres[0].primeiroNome} livre`
      : ", mentorado livre";
  return "";
}

/** "19h"/"19h30" — hora compacta no fuso do programa pros blocos da grade. */
function horaCurta(d: Date): string {
  const [h, m] = fmtHora.format(d).split(":").map(Number);
  return `${h}h${m ? pad(m) : ""}`;
}

/** Minutos do dia no fuso do programa — a régua vertical da grade horária
 *  e o instante do encontro falam o mesmo fuso dos formatters do arquivo
 *  (TZ = São Paulo); getHours() leria o fuso do browser e abriria a grade
 *  torta pra quem acessa de outro. */
function minutosDoDia(d: Date): number {
  const [h, m] = fmtHora.format(d).split(":").map(Number);
  return h * 60 + m;
}

/** Destino do bloco de encontro nas grades do mentor: ficha da dupla; com
 *  pendência de registro (realizado sem registro ou agendado vencido/limbo)
 *  cai direto no card do encontro — mesmo critério do link da linha do
 *  detalhe do dia. */
function hrefEncontroMentor(item: ItemDupla, agora: number): string {
  const { encontro, dupla } = item;
  const pendente =
    !encontro.registro &&
    (encontro.status === "realizado" || limboAberto(encontro, agora));
  return pendente
    ? `/duplas/${dupla.id}#registrar-${encontro.id}`
    : `/duplas/${dupla.id}`;
}

/** Marcador compacto do evento do ciclo na coluna do dia — glifo + palavra
 *  numa linha fina; o encontro oficial carrega o nº no disco lime (mesma
 *  gramática das células do mês, encolhida pra caber em ~68px). */
function MarcadorDiaSemana({
  e,
  eventoSemanaId,
}: {
  e: CicloEvento;
  eventoSemanaId: string | undefined;
}) {
  // o nº já mora no disco — a palavra só repõe o tipo quando o título não diz
  const rotulo =
    e.tipo === "encontro" && e.numero != null ? "encontro" : e.titulo;
  return (
    <span
      title={e.titulo}
      className="flex min-w-0 items-center gap-1 text-[10px] leading-5 text-muted-foreground"
    >
      {e.tipo === "encontro" ? (
        <span
          aria-hidden
          className={cn(
            "grid size-3.5 shrink-0 place-items-center rounded-full bg-[var(--brand-lime)] text-[10px] font-semibold leading-none tabular-nums text-[var(--brand-ink)]",
            e.id === eventoSemanaId &&
              "ring-2 ring-[var(--brand-lime)]/60 ring-offset-1 ring-offset-card"
          )}
        >
          {e.numero ?? "•"}
        </span>
      ) : e.tipo === "formacao" ? (
        <GraduationCap
          aria-hidden
          size={11}
          weight="bold"
          className="shrink-0 text-[var(--warn-text)]"
        />
      ) : e.tipo === "evento_encerramento" ? (
        <Flag
          aria-hidden
          size={10}
          weight="fill"
          className="shrink-0 text-[var(--ok-text)]"
        />
      ) : e.tipo === "recesso" ? (
        <span
          aria-hidden
          className="hatch-recesso h-2 w-3 shrink-0 rounded-[2px] ring-1 ring-inset ring-border"
        />
      ) : (
        <CheckCircle
          aria-hidden
          size={10}
          weight="bold"
          className="shrink-0"
        />
      )}
      <span className="truncate">{rotulo}</span>
    </span>
  );
}

/** Bloco de encontro da dupla nas grades do mentor — o chip elevado flutua
 *  sobre a tinta de disponibilidade: dot de status + "19h · 3º encontro"
 *  (+ primeiro nome do mentorado quando há mais de uma dupla). O destino
 *  segue a linha do detalhe: pendência de registro cai no card da ficha. */
function BlocoEncontro({
  item,
  agora,
  multiDupla,
  className,
  style,
}: {
  item: ItemDupla;
  /** Date.now() congelado — mesma régua de limbo do ctx. */
  agora: number;
  multiDupla: boolean;
  className?: string;
  style?: CSSProperties;
}) {
  const { encontro, dupla } = item;
  const instante = instanteDoEncontro(encontro);
  const iso = isoDoEncontro(encontro);
  return (
    <Link
      href={hrefEncontroMentor(item, agora)}
      title={`${encontro.numero}º encontro · ${STATUS_ENCONTRO_LABEL[encontro.status].toLowerCase()}${iso ? `, ${formatDateTime(iso)}` : ""}`}
      className={cn(
        // o bloco flutua sobre a superfície clicável da coluna — o clique nele
        // é navegação pra ficha, nunca dispara o agendamento
        "pointer-events-auto flex min-w-0 items-center gap-1 rounded-md bg-card px-1.5 py-1 text-[11px] leading-tight shadow-[var(--shadow-border)] transition-shadow hover:shadow-[var(--shadow-border-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        className
      )}
      style={style}
    >
      <span
        aria-hidden
        className={cn("size-1.5 shrink-0 rounded-full", corDotEncontro(encontro))}
      />
      <span className="min-w-0 truncate font-medium">
        {instante && `${horaCurta(instante)} · `}
        {encontro.numero}º encontro
        {multiDupla && ` · ${primeiroNomeMentorado(dupla.mentorado)}`}
        <span className="sr-only">
          , {STATUS_ENCONTRO_LABEL[encontro.status].toLowerCase()}
        </span>
      </span>
    </Link>
  );
}

/** Semana compacta do mentor (visão "semana", REALIZA-25): 7 colunas
 *  seg→dom com blocos de encontro empilhados por hora, marcadores finos dos
 *  eventos do ciclo e a tinta de disponibilidade por dia. Clicar na coluna
 *  seleciona o dia — o mesmo painel de detalhe do mês abre embaixo/ao lado. */
function SemanaMentor({
  semanaIso,
  selecionado,
  direcao,
  onSelecionar,
  legendaDispo,
  ctx,
}: {
  semanaIso: string;
  selecionado: string;
  direcao: 1 | -1;
  onSelecionar: (iso: string, e: { detail: number }) => void;
  legendaDispo: boolean;
  ctx: GradeMentorCtx;
}) {
  const {
    hoje,
    agoraMs,
    porDia,
    duplasPorDia,
    overlayDispo,
    mentorDisponibilidade,
    jovensDispo,
    multiDupla,
    eventoSemanaId,
    marcaSemanaA11y,
  } = ctx;
  // seg..dom da semana exibida — a segunda abre a semana de trabalho do
  // programa (semanaBounds), não o domingo do grid mensal de calendário
  const dias = Array.from({ length: 7 }, (_, i) =>
    paraISO(somarDias(parseDia(semanaIso), i))
  );
  const temDots = dias.some((d) => (duplasPorDia.get(d) ?? []).length > 0);

  return (
    <div
      key={semanaIso}
      className="animate-enter-x"
      style={{ "--dir": `${direcao * 8}px` } as CSSProperties}
    >
      <div
        role="region"
        aria-label="Grade da semana. Role horizontalmente"
        tabIndex={0}
        className="scroll-fina overflow-x-auto"
      >
        <div role="grid" aria-labelledby="agenda-mes-rotulo">
          <div role="row" className="grid min-w-[32rem] grid-cols-7">
          {dias.map((iso) => {
            const d = parseDia(iso);
            const doDia = porDia.get(iso) ?? [];
            const itens = duplasPorDia.get(iso) ?? [];
            const temRecesso = doDia.some((e) => e.tipo === "recesso");
            const ehHoje = iso === hoje;
            const ehSelecionado = iso === selecionado;
            const passou = iso < hoje;

            // tinta de disponibilidade por DIA — a mesma leitura das células
            // do mês; na grade horária ela afunila pra hora (visão "horarios")
            const dow = diaSemanaDe(iso);
            const tintaDispo = overlayDispo
              ? cruzamentoDisponibilidade(
                  mentorDisponibilidade,
                  jovensDispo.map((j) => j.disp),
                  dow
                )
              : "nenhum";
            const jovensLivres = overlayDispo
              ? jovensDispo.filter((j) => disponibilidadeNoDia(j.disp, dow))
              : [];

            // mesmo rótulo falado das células do mês — descrições oficiais
            // primeiro, depois data, encontros e quem tá livre
            const rotuloCol =
              (doDia.length > 0
                ? `${doDia.map(descricaoEvento).join(" e ")}, ${fmtCompleta.format(d)}`
                : `${fmtCompleta.format(d)}, sem eventos oficiais`) +
              (doDia.some((e) => e.id === eventoSemanaId) && marcaSemanaA11y
                ? `, ${marcaSemanaA11y}`
                : "") +
              (itens.length > 0
                ? `, ${resumoEncontrosDupla(itens, agoraMs)}`
                : "") +
              dispoTextoDia(tintaDispo, jovensLivres);

            return (
              <div
                role="gridcell"
                key={iso}
                className={cn(
                  "relative flex min-h-36 flex-col border-l border-border/60 first:border-l-0 sm:min-h-44",
                  ehSelecionado && "ring-2 ring-inset ring-foreground/30"
                )}
              >
                {/* camadas de fundo: tinta → hatch (recesso vence, como no
                    mês) → superfície clicável → conteúdo. Os overlays são
                    pointer-events-none: o clique sempre chega no botão */}
                {tintaDispo !== "nenhum" && (
                  <span
                    aria-hidden
                    data-tinta={tintaDispo}
                    className={cn(
                      "pointer-events-none absolute inset-0",
                      tintaDispo === "ambos"
                        ? undefined
                        : TINTA_DISPONIBILIDADE[tintaDispo]
                    )}
                    style={
                      tintaDispo === "ambos"
                        ? { backgroundImage: GRADIENTE_AMBOS_DISPONIVEIS }
                        : undefined
                    }
                  />
                )}
                {temRecesso && (
                  <span
                    aria-hidden
                    className="hatch-recesso pointer-events-none absolute inset-0"
                  />
                )}
                {/* a coluna inteira é UM botão/tab stop (não um por região) —
                    7 paradas por semana; clicar seleciona o dia pro painel */}
                <button
                  type="button"
                  aria-label={rotuloCol}
                  aria-pressed={ehSelecionado}
                  aria-current={ehHoje ? "date" : undefined}
                  onClick={(e) => onSelecionar(iso, e)}
                  className="absolute inset-0 transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                />
                <div className="pointer-events-none relative flex flex-1 flex-col">
                  {/* header do dia — dow + número; hoje veste a pill ink,
                      mesma gramática das células do mês */}
                  <div className="flex items-center justify-between gap-1 px-2 pb-1 pt-2">
                    <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
                      {DIAS_SEMANA[d.getDay()]}
                    </span>
                    <span
                      className={cn(
                        "grid size-6 place-items-center text-[13px] font-medium tabular-nums",
                        ehHoje
                          ? "rounded-full bg-[var(--brand-ink)] text-white"
                          : passou
                            ? "text-muted-foreground"
                            : "text-foreground"
                      )}
                    >
                      {d.getDate()}
                    </span>
                  </div>
                  {/* eventos oficiais como marcadores finos — a ligação pro
                      detalhe completo é o clique na coluna */}
                  {doDia.length > 0 && (
                    <div className="flex flex-col gap-0.5 px-1.5 pb-1">
                      {doDia.map((e) => (
                        <MarcadorDiaSemana
                          key={e.id}
                          e={e}
                          eventoSemanaId={eventoSemanaId}
                        />
                      ))}
                    </div>
                  )}
                  {/* encontros das duplas empilhados por hora (o mapa já chega
                      ordenado por instante) */}
                  {itens.length > 0 && (
                    <div className="mt-auto flex flex-col gap-0.5 px-1 pb-1 pt-1">
                      {itens.map((item) => (
                        <BlocoEncontro
                          key={item.encontro.id}
                          item={item}
                          agora={agoraMs}
                          multiDupla={multiDupla}
                        />
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
          </div>
        </div>
      </div>
      <LegendaAgenda temDotsDupla={temDots} legendaDispo={legendaDispo} />
    </div>
  );
}

// ===== grade de horários (visão "horarios" do mentor) =====

/** Altura de 1h na grade — snap de clique de 30min equivale a HORA_PX/2. */
const HORA_PX = 48;

type BlocoPosicionado = {
  item: ItemDupla;
  /** minutos do dia do início (hora local do instante do encontro). */
  ini: number;
  /** minutos do dia do fim — início + duracao_min (o encontro padrão é 1h). */
  fim: number;
  /** Faixa horizontal dentro do cluster de overlap — 0..lanes-1. */
  lane: number;
  /** Quantas faixas o cluster do bloco tem — 2 blocos sobrepostos = 50% cada. */
  lanes: number;
};

/** Posiciona os encontros do dia na régua vertical, no gesto do Google
 *  Agenda: itens que se sobrepõem (transitivamente) dividem a coluna em
 *  faixas lado a lado — nunca um em cima do outro. */
function layoutDiaHorario(itens: ItemDupla[]): BlocoPosicionado[] {
  const comMin = itens.flatMap((item) => {
    const t = instanteDoEncontro(item.encontro);
    if (!t) return [];
    const ini = minutosDoDia(t);
    return [
      {
        item,
        ini,
        fim: ini + (item.encontro.duracao_min || 60),
        lane: 0,
        lanes: 1,
      },
    ];
  });
  comMin.sort((a, b) => a.ini - b.ini || a.fim - b.fim);
  // cluster = grupo de blocos que se tocam em cadeia (a transita com b, b
  // com c → a,b,c dividem a mesma coluna mesmo que a e c não se toquem)
  let cluster: BlocoPosicionado[] = [];
  let fimCluster = -1;
  const fechar = () => {
    if (!cluster.length) return;
    const fimLanes: number[] = [];
    for (const b of cluster) {
      const lane = fimLanes.findIndex((f) => f <= b.ini);
      if (lane === -1) {
        b.lane = fimLanes.length;
        fimLanes.push(b.fim);
      } else {
        b.lane = lane;
        fimLanes[lane] = b.fim;
      }
    }
    for (const b of cluster) b.lanes = fimLanes.length;
    cluster = [];
    fimCluster = -1;
  };
  for (const b of comMin) {
    if (cluster.length > 0 && b.ini >= fimCluster) fechar();
    cluster.push(b);
    fimCluster = Math.max(fimCluster, b.fim);
  }
  fechar();
  return comMin;
}

/** Grade horária do mentor (visão "horarios", REALIZA-25) — o gesto do
 *  Google Agenda: colunas seg→dom × linhas de hora, blocos posicionados pelo
 *  `data_hora` real, linha do "agora" na coluna de hoje e área vazia que
 *  agenda direto (snap de 30min no clique, 19h/primeira janela no Enter). */
function HorariosMentor({
  semanaIso,
  direcao,
  ctx,
  duplasAgendaveis,
  alvosPorDupla,
  legendaDispo,
  onEncontroCriado,
}: {
  semanaIso: string;
  direcao: 1 | -1;
  ctx: GradeMentorCtx;
  /** Duplas ativas com encontro pendente — as candidatas do clique vazio. */
  duplasAgendaveis: Dupla[];
  alvosPorDupla: Map<string, AlvoAgendamento>;
  legendaDispo: boolean;
  onEncontroCriado: (duplaId: string, encontroId: string, dia: string) => void;
}) {
  const {
    hoje,
    agoraMs,
    porDia,
    duplasPorDia,
    overlayDispo,
    mentorDisponibilidade,
    jovensDispo,
    multiDupla,
    eventoSemanaId,
  } = ctx;
  // slot clicado → dialog controlado (um só, remontado por key a cada slot)
  const [slotAgendar, setSlotAgendar] = useState<{
    duplaId: string;
    sugerido: string;
  } | null>(null);

  const dias = Array.from({ length: 7 }, (_, i) =>
    paraISO(somarDias(parseDia(semanaIso), i))
  );
  const jovensDisps = jovensDispo.map((j) => j.disp);

  // janela vertical: de min(8, menor hora de encontro da semana) a max(22,
  // maior hora+1) — cobre manhã/tarde/noite por padrão e estica só quando a
  // semana tem encontro fora dela
  const minutosMarcados = dias.flatMap((d) =>
    (duplasPorDia.get(d) ?? []).flatMap(({ encontro }) => {
      const t = instanteDoEncontro(encontro);
      return t ? [minutosDoDia(t)] : [];
    })
  );
  const horaIni = Math.min(
    8,
    ...minutosMarcados.map((m) => Math.floor(m / 60))
  );
  const horaFim = Math.max(
    22,
    ...minutosMarcados.map((m) => Math.floor(m / 60) + 1)
  );
  const totalMin = (horaFim - horaIni) * 60;
  const alturaPx = (totalMin / 60) * HORA_PX;
  const pxDoMin = (minDia: number) => ((minDia - horaIni * 60) / 60) * HORA_PX;

  /** "…T19:30" — o clique vira datetime naïve pro dialog; o snap de 30min
   *  resolve o gesto "mais ou menos aqui" sem inventar horários quebrados
   *  (19:13) — o encontro padrão de 1h encaixa exato na régua de meia hora. */
  function slotDoClique(iso: string, offsetY: number): string {
    const bruto = horaIni * 60 + (offsetY / alturaPx) * totalMin;
    const snapped = Math.round(bruto / 30) * 30;
    const clamped = Math.min(
      Math.max(snapped, horaIni * 60),
      horaFim * 60 - 30
    );
    return `${iso}T${pad(Math.floor(clamped / 60))}:${pad(clamped % 60)}`;
  }

  /** Slot do Enter (sem coordenada): o primeiro período livre do mentor
   *  nesse dia da semana vira a sugestão; sem grade no dia, 19h — o horário
   *  típico do encontro semanal. */
  function slotPadrao(iso: string): string {
    const dow = diaSemanaDe(iso);
    const periodos = overlayDispo
      ? periodosNoDia(mentorDisponibilidade, dow)
      : [];
    const h = periodos.length ? JANELA_PERIODO[periodos[0]][0] : 19;
    const clamped = Math.min(
      Math.max(h * 60, horaIni * 60),
      horaFim * 60 - 30
    );
    return `${iso}T${pad(Math.floor(clamped / 60))}:${pad(clamped % 60)}`;
  }

  // a linha do "agora" só nasce se a semana exibida contém hoje e a hora
  // cai dentro da janela — o agoraMs é o congelado da montagem, mesma régua
  const agoraMin = minutosDoDia(new Date(agoraMs));
  const mostrarAgora =
    dias.includes(hoje) &&
    agoraMin >= horaIni * 60 &&
    agoraMin <= horaFim * 60;

  const temDots = dias.some((d) => (duplasPorDia.get(d) ?? []).length > 0);

  const duplaSlot = slotAgendar
    ? (duplasAgendaveis.find((d) => d.id === slotAgendar.duplaId) ?? null)
    : null;
  const alvoSlot = duplaSlot ? alvosPorDupla.get(duplaSlot.id) : null;

  return (
    <div
      key={semanaIso}
      className="animate-enter-x"
      style={{ "--dir": `${direcao * 8}px` } as CSSProperties}
    >
      {/* gutter das horas (2.5rem) + 7 colunas com piso de ~72px — no mobile
          o conjunto rola horizontal em vez de esmagar os blocos */}
      <div
        role="region"
        aria-label="Grade da semana. Role horizontalmente"
        tabIndex={0}
        className="scroll-fina overflow-x-auto"
      >
        <div className="grid grid-cols-[2.5rem_repeat(7,minmax(4.5rem,1fr))]">
          {/* header: canto do gutter vazio + dow/dia por coluna */}
          <span aria-hidden className="border-b border-border/60" />
          {dias.map((iso) => {
            const d = parseDia(iso);
            const ehHoje = iso === hoje;
            return (
              <span
                key={iso}
                className="flex items-baseline justify-between gap-1 border-b border-l border-border/60 px-1.5 py-1.5 sm:px-2"
              >
                <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
                  {DIAS_SEMANA[d.getDay()]}
                </span>
                <span
                  className={cn(
                    "grid size-6 place-items-center text-[13px] font-medium tabular-nums",
                    ehHoje
                      ? "rounded-full bg-[var(--brand-ink)] text-white"
                      : iso < hoje
                        ? "text-muted-foreground"
                        : "text-foreground"
                  )}
                >
                  {d.getDate()}
                </span>
              </span>
            );
          })}
          {/* faixa "all-day": os eventos oficiais são marcadores finos no topo
              do dia, nunca blocos na grade — eles não têm horário */}
          <span aria-hidden className="border-b border-border/60" />
          {dias.map((iso) => {
            const doDia = porDia.get(iso) ?? [];
            return (
              <div
                key={iso}
                className="flex min-h-7 min-w-0 flex-col gap-0.5 border-b border-l border-border/60 px-0.5 py-0.5"
              >
                {doDia.map((e) => (
                  <MarcadorDiaSemana
                    key={e.id}
                    e={e}
                    eventoSemanaId={eventoSemanaId}
                  />
                ))}
              </div>
            );
          })}
          {/* corpo: gutter com o rótulo de cada linha de hora + as 7 colunas */}
          <div aria-hidden className="relative" style={{ height: alturaPx }}>
            {/* a hora marca a LINHA do topo da faixa — as das bordas (a de
                abertura e a de fechamento) ficariam clipadas pela metade, o
                gutter pula elas (mesmo recorte do calendário referência) */}
            {Array.from(
              { length: Math.max(0, horaFim - horaIni - 1) },
              (_, i) => horaIni + 1 + i
            ).map((h) => (
              <span
                key={h}
                className="absolute right-1 -translate-y-1/2 text-[10px] font-medium tabular-nums text-muted-foreground"
                style={{ top: (h - horaIni) * HORA_PX }}
              >
                {h}h
              </span>
            ))}
          </div>
          {dias.map((iso) => (
            <ColunaHorario
              key={iso}
              iso={iso}
              itens={duplasPorDia.get(iso) ?? []}
              doDia={porDia.get(iso) ?? []}
              alturaPx={alturaPx}
              horaIni={horaIni}
              horaFim={horaFim}
              pxDoMin={pxDoMin}
              overlayDispo={overlayDispo}
              mentorDisponibilidade={mentorDisponibilidade}
              jovensDisps={jovensDisps}
              agendaveis={duplasAgendaveis}
              temAlvo={(id) => alvosPorDupla.get(id)?.encontroAlvo != null}
              multiDupla={multiDupla}
              agoraMs={agoraMs}
              mostrarAgora={mostrarAgora && iso === hoje}
              agoraMin={agoraMin}
              slotPadrao={slotPadrao}
              slotDoClique={slotDoClique}
              onAgendar={(duplaId, sugerido) =>
                setSlotAgendar({ duplaId, sugerido })
              }
            />
          ))}
        </div>
      </div>
      <LegendaAgenda temDotsDupla={temDots} legendaDispo={legendaDispo} />

      {/* o dialog é um só, controlado: key por (dupla, slot) remonta e
          recarrega a sugestão; sem trigger embutido — a coluna é quem abre */}
      {duplaSlot && alvoSlot && slotAgendar && (
        <AgendarEncontroDialog
          key={`${duplaSlot.id}:${slotAgendar.sugerido}`}
          open
          trigger={null}
          onOpenChange={(o) => {
            if (!o) setSlotAgendar(null);
          }}
          duplaId={duplaSlot.id}
          numero={alvoSlot.proximoNumero}
          atual={alvoSlot.encontroAlvo}
          sugerido={slotAgendar.sugerido}
          piso={duplaSlot.iniciada_em ?? undefined}
          jovemNome={duplaSlot.mentorado.nome.split(" ")[0]}
          rotulo={
            duplaSlot.trilha === "especialista"
              ? "sessão de especialista"
              : undefined
          }
          onCreated={(encontroId, dia) =>
            onEncontroCriado(duplaSlot.id, encontroId, dia)
          }
        />
      )}
    </div>
  );
}

/** Uma coluna de dia da grade horária: trama de linhas + tinta por hora +
 *  hatch de recesso + a superfície de agendamento + os blocos posicionados +
 *  a linha do agora. */
function ColunaHorario({
  iso,
  itens,
  doDia,
  alturaPx,
  horaIni,
  horaFim,
  pxDoMin,
  overlayDispo,
  mentorDisponibilidade,
  jovensDisps,
  agendaveis,
  temAlvo,
  multiDupla,
  agoraMs,
  mostrarAgora,
  agoraMin,
  slotPadrao,
  slotDoClique,
  onAgendar,
}: {
  iso: string;
  itens: ItemDupla[];
  doDia: CicloEvento[];
  alturaPx: number;
  horaIni: number;
  horaFim: number;
  pxDoMin: (minDia: number) => number;
  overlayDispo: boolean;
  mentorDisponibilidade: Disponibilidade | null | undefined;
  jovensDisps: (Disponibilidade | null | undefined)[];
  agendaveis: Dupla[];
  /** A dupla já tem row do próximo encontro → o dialog vira "Remarcar" —
   *  o item do menu diz isso, não "Agendar" que prometeria criar do zero. */
  temAlvo: (duplaId: string) => boolean;
  multiDupla: boolean;
  agoraMs: number;
  mostrarAgora: boolean;
  agoraMin: number;
  slotPadrao: (iso: string) => string;
  slotDoClique: (iso: string, offsetY: number) => string;
  onAgendar: (duplaId: string, sugerido: string) => void;
}) {
  const dow = diaSemanaDe(iso);
  const temRecesso = doDia.some((e) => e.tipo === "recesso");
  const blocos = layoutDiaHorario(itens);
  // o slot do gesto atual — o clique na coluna preenche, os itens do menu
  // leem (menu multi-dupla: a escolha "com quem" reusa a hora já resolvida)
  const slotRef = useRef<string>(slotPadrao(iso));
  const rotuloColuna = `Agendar encontro na ${fmtCompleta.format(parseDia(iso))}`;

  /** Ponteiro resolve a hora pelo offsetY; teclado/leitor (detail 0) cai no
   *  slot padrão — a régua do clique não existe numa ativação sem mouse. */
  function capturar(e: { detail: number; nativeEvent: { offsetY: number } }) {
    slotRef.current =
      e.detail === 0 ? slotPadrao(iso) : slotDoClique(iso, e.nativeEvent.offsetY);
  }

  const superficie =
    // a coluna inteira é UM botão/tab stop — não um por célula de hora: 7
    // paradas por semana em vez de ~200 pra atravessar a grade no teclado;
    // o clique livre resolve a hora, o Enter cai no slot padrão do dia
    agendaveis.length === 1 ? (
      <button
        type="button"
        aria-label={rotuloColuna}
        onClick={capturarClickUnico}
        className="absolute inset-0 transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
      />
    ) : agendaveis.length > 1 ? (
      // com 2+ duplas pendentes o clique vazio resolve dia+hora mas falta
      // dizer COM QUEM — o menu curto pergunta antes do dialog (o candidato
      // não se deduz: "próximo encontro" é por-dupla, não por semana). O
      // trigger é um <button> que cobre a coluna; o clique abre o menu e
      // grava o slot (teclado cai no padrão via detail 0, como o botão único)
      <DropdownMenu>
        <DropdownMenuTrigger
          aria-label={rotuloColuna}
          onClick={capturar}
          className="absolute inset-0 transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
        />
        <DropdownMenuContent className="min-w-44">
          {agendaveis.map((d) => (
            <DropdownMenuItem
              key={d.id}
              onClick={() => onAgendar(d.id, slotRef.current)}
            >
              {temAlvo(d.id) ? "Remarcar com" : "Agendar com"}{" "}
              {primeiroNomeMentorado(d.mentorado)}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    ) : null;

  function capturarClickUnico(e: {
    detail: number;
    nativeEvent: { offsetY: number };
  }) {
    capturar(e);
    onAgendar(agendaveis[0].id, slotRef.current);
  }

  return (
    <div
      className="relative overflow-hidden border-l border-border/60"
      style={{ height: alturaPx }}
    >
      {/* trama das linhas de hora — uma imagem repetida por coluna */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage: `repeating-linear-gradient(to bottom, transparent 0 ${HORA_PX - 1}px, var(--border) ${HORA_PX - 1}px ${HORA_PX}px)`,
        }}
      />
      {/* tinta por hora cheia — a leitura da grade de disponibilidade
          afunilada por faixa (JANELA_PERIODO); atrás de todo o conteúdo */}
      {overlayDispo &&
        Array.from({ length: horaFim - horaIni }, (_, i) => horaIni + i).map(
          (h) => {
            const tinta = cruzamentoDisponibilidadeHora(
              mentorDisponibilidade,
              jovensDisps,
              dow,
              h
            );
            if (tinta === "nenhum") return null;
            return (
              <span
                key={h}
                aria-hidden
                data-tinta={tinta}
                className={cn(
                  "pointer-events-none absolute inset-x-0",
                  tinta === "ambos" ? undefined : TINTA_DISPONIBILIDADE[tinta]
                )}
                style={{
                  top: (h - horaIni) * HORA_PX,
                  height: HORA_PX,
                  ...(tinta === "ambos"
                    ? { backgroundImage: GRADIENTE_AMBOS_DISPONIVEIS }
                    : {}),
                }}
              />
            );
          }
        )}
      {/* recesso cobre a coluna inteira por cima da tinta — mesma ordem do
          mês: o hatch é o estado dominante do dia */}
      {temRecesso && (
        <span
          aria-hidden
          className="hatch-recesso pointer-events-none absolute inset-0"
        />
      )}
      {superficie}
      {/* blocos — acima da superfície clicável: o clique neles navega pra
          ficha, nunca dispara o agendamento */}
      {blocos.map((b) => {
        const topo = pxDoMin(b.ini);
        // encontro que passa do fim da janela clipa na borda da coluna
        const fundo = Math.min(pxDoMin(b.fim), alturaPx);
        return (
          <BlocoEncontro
            key={b.item.encontro.id}
            item={b.item}
            agora={agoraMs}
            multiDupla={multiDupla}
            className="absolute"
            style={{
              top: topo,
              height: Math.max(fundo - topo, 18),
              left: `calc(${(b.lane / b.lanes) * 100}% + 1px)`,
              width: `calc(${100 / b.lanes}% - 3px)`,
            }}
          />
        );
      })}
      {/* linha do "agora" — só na coluna de hoje; --danger porque o âmbar do
          --warn já fala "pendência" no resto do arquivo */}
      {mostrarAgora && (
        <span
          aria-hidden
          className="pointer-events-none absolute inset-x-0 z-10 h-0.5 bg-[var(--danger)]"
          style={{ top: pxDoMin(agoraMin) }}
        />
      )}
    </div>
  );
}
