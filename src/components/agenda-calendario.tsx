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
  ArrowUpRight,
  CaretLeft,
  CaretRight,
  ClockCounterClockwise,
  Flag,
  GraduationCap,
  Users,
  VideoCamera,
} from "@phosphor-icons/react";
import { DuplaNomes } from "@/components/dupla-nomes";
import { NotaEncontro } from "@/components/nota-encontro";
import { AgendarEncontroDialog } from "@/components/agendar-encontro-dialog";
import { RegistrarRetroativoDialog } from "@/components/registrar-retroativo-dialog";
import { RegistroForm } from "@/components/registro-form";
import { RevelarApos } from "@/components/revelar-apos";
import { fade, T } from "@/components/motion";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  alvoAgendamento,
  diffDias,
  formatDate,
  formatDateTime,
  formatDiaSemana,
  toDateStr,
} from "@/lib/ciclo";
import type {
  AppRole,
  CicloEvento,
  Dupla,
  Encontro,
  EncontroStatus,
} from "@/lib/types";
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

type ItemDupla = { encontro: Encontro; dupla: Dupla };

const STATUS_ENCONTRO_LABEL: Record<EncontroStatus, string> = {
  agendado: "agendado",
  remarcado: "remarcado",
  realizado: "realizado",
  nao_aconteceu: "não aconteceu",
  cancelado: "cancelado",
};

const STATUS_ENCONTRO_PLURAL: Record<EncontroStatus, string> = {
  agendado: "agendados",
  remarcado: "remarcados",
  realizado: "realizados",
  nao_aconteceu: "não aconteceram",
  cancelado: "cancelados",
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
  return "bg-muted-foreground/40";
}

/** Resumo falado dos encontros de dupla do dia — compõe o aria-label do botão. */
function resumoEncontrosDupla(itens: ItemDupla[]): string {
  if (itens.length === 1)
    return `encontro da dupla ${STATUS_ENCONTRO_LABEL[itens[0].encontro.status]}`;
  const cont = new Map<EncontroStatus, number>();
  for (const { encontro } of itens)
    cont.set(encontro.status, (cont.get(encontro.status) ?? 0) + 1);
  const partes = (Object.keys(STATUS_ENCONTRO_LABEL) as EncontroStatus[])
    .filter((s) => cont.has(s))
    .map(
      (s) =>
        `${cont.get(s)} ${
          cont.get(s) === 1 ? STATUS_ENCONTRO_LABEL[s] : STATUS_ENCONTRO_PLURAL[s]
        }`
    );
  return `${itens.length} encontros de duplas: ${partes.join(", ")}`;
}

/** Cobertura de um encontro oficial entre as duplas visíveis: quantas têm o
 *  encontro `numero` realizado e com registro entregue. */
function coberturaEncontro(
  duplas: Dupla[],
  numero: number
): { registraram: number; total: number } {
  // denominador = duplas ativas — mesmo denominador de resumoSemana (pausada
  // e encerrada não contam cobertura)
  const ativas = duplas.filter((d) => d.status === "ativa");
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
    </span>
  );
}

export function AgendaCalendario({
  eventos,
  hoje,
  semanaId,
  diaInicial,
  duplas,
  role,
}: {
  eventos: CicloEvento[];
  hoje: string;
  semanaId: string | null;
  /** ?dia= da URL — sobrepõe a heurística "semana atual senão hoje". */
  diaInicial: string | null;
  duplas: Dupla[];
  role: AppRole | null;
}) {
  const ehMentor = role === "mentor_dpp" || role === "mentor_especialista";
  const ehCoordSup = role === "coordenacao" || role === "supervisor";
  const router = useRouter();

  // mapa dia → eventos do dia; recesso (e qualquer evento com data_fim) cobre o intervalo todo
  const porDia = useMemo(() => {
    const mapa = new Map<string, CicloEvento[]>();
    for (const e of eventos) {
      const fim = e.data_fim ?? e.data;
      for (let d = e.data; d <= fim; d = proximoDia(d)) {
        mapa.set(d, [...(mapa.get(d) ?? []), e]);
      }
    }
    return mapa;
  }, [eventos]);

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
      eventos
        .filter((e) => e.tipo === "encontro" && e.numero != null)
        .sort((a, b) => (a.numero ?? 0) - (b.numero ?? 0)),
    [eventos]
  );

  // nº → evento oficial — alimenta a "sugestão do guia" do form de registro
  const eventoPorNumero = useMemo(
    () => new Map(encontrosRail.map((e) => [e.numero!, e])),
    [encontrosRail]
  );

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
    const daSemana = semanaId ? eventos.find((e) => e.id === semanaId) : null;
    const candidato = diaInicial ?? daSemana?.data ?? hoje;
    return mesIndice(candidato) === mesInicial
      ? candidato
      : faixaDoMes(mesInicial)[0];
  });
  // direção da última navegação entre meses — alimenta o --dir do .animate-enter-x
  const [direcao, setDirecao] = useState<1 | -1>(1);

  // form de registro inline aberto no detalhe do dia — por encontroId, um só
  // por vez (abrir um fecha o outro). Trocar o dia selecionado fecha: o painel
  // remonta a cada dia e um id vivo reapareceria aberto ao voltar — lê como bug
  const [registroAberto, setRegistroAberto] = useState<string | null>(null);

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

  const eventosDoMes = eventos.filter(
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
            .filter((dupla) => dupla.status === "ativa")
            .flatMap((dupla) =>
              dupla.encontros
                .filter((e) => numerosOficiais.has(e.numero) && !idsNoDia.has(e.id))
                .map((encontro) => ({ encontro, dupla }))
            ),
        ]
      : duplasDoDia;
  // anotações do mentor: uma por dupla ativa no bloco do encontro oficial
  // (âncora no nº — aparece no dia oficial mesmo com a dupla remarcada)
  const duplasAtivas = ehMentor ? duplas.filter((d) => d.status === "ativa") : [];

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
    semanas[s].some((cel) => cel?.eventos.some((e) => e.id === semanaId));
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

  if (eventos.length === 0) return null;

  return (
    <div className="space-y-4 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(300px,340px)] lg:items-start lg:gap-5 lg:space-y-0">
      {/* ===== calendário mensal ===== */}
      <div className="overflow-hidden rounded-xl bg-card shadow-[var(--shadow-border)] lg:col-start-1 lg:row-start-1">
        <div className="flex items-center gap-1 border-b px-2 py-1.5 sm:px-3">
          <button
            type="button"
            aria-label="Mês anterior"
            disabled={mes <= minMes}
            onClick={() => irParaMes(mes - 1)}
            className="grid size-11 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-lime)] disabled:pointer-events-none disabled:opacity-40 md:size-9"
          >
            <CaretLeft size={18} />
          </button>
          <button
            type="button"
            aria-label="Próximo mês"
            disabled={mes >= maxMes}
            onClick={() => irParaMes(mes + 1)}
            className="grid size-11 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-lime)] disabled:pointer-events-none disabled:opacity-40 md:size-9"
          >
            <CaretRight size={18} />
          </button>
          <button
            type="button"
            disabled={mes === mesHoje || !hojeNoAlcance}
            onClick={() => irParaMes(mesHoje)}
            className="ms-0.5 min-h-11 rounded-lg px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-lime)] disabled:pointer-events-none disabled:opacity-40 md:min-h-9"
          >
            Hoje
          </button>
          <p
            id="agenda-mes-rotulo"
            aria-live="polite"
            className="min-w-0 flex-1 truncate px-2.5 text-lg font-semibold tracking-tight"
          >
            {capitalizar(rotuloMes)}
            {faseDoMes && (
              <span className="hidden text-sm font-normal tracking-normal text-muted-foreground sm:inline">
                {" · "}
                {faseDoMes}
              </span>
            )}
          </p>
        </div>

        {/* rail do ciclo — trilha 1—16 dos encontros oficiais; mesma gramática
            de disco das células, conector lime só no trecho já percorrido */}
        {encontrosRail.length >= 2 && (
          <nav
            aria-label="Encontros do ciclo"
            className="border-b px-3 pb-1.5 pt-2 sm:px-4"
          >
            <div className="scroll-fina flex items-center overflow-x-auto pb-1">
              {encontrosRail.map((e, i) => {
                const passou = e.data < hoje;
                const atual = e.id === semanaId;
                const prevPassou = i > 0 && encontrosRail[i - 1].data < hoje;
                const dataFmt = fmtCompleta.format(parseDia(e.data));
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
                      aria-label={`Ir para o ${e.numero}º encontro, ${dataFmt}`}
                      aria-current={atual ? "date" : undefined}
                      onClick={(ev) => {
                        pedirRolarSePonteiro(ev, e.data);
                        moverPara(e.data);
                      }}
                      className={cn(
                        "grid shrink-0 place-items-center rounded-full font-mono text-[11px] font-semibold leading-none tabular-nums transition-[color,background-color,box-shadow] hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-lime)]",
                        atual
                          ? "size-7 bg-[var(--brand-lime)] text-[var(--brand-ink)] ring-2 ring-[var(--brand-lime)]/40 ring-offset-2 ring-offset-card"
                          : passou
                            ? "size-6 bg-[var(--brand-lime)] text-[var(--brand-ink)] sm:size-7"
                            : "size-6 bg-muted text-muted-foreground sm:size-7"
                      )}
                    >
                      {e.numero}
                    </button>
                  </Fragment>
                );
              })}
            </div>
          </nav>
        )}

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
                cel?.eventos.some((e) => e.id === semanaId)
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
                      : `${fmtCompleta.format(parseDia(iso))}, sem eventos do ciclo`) +
                    (duplasDoDia.length > 0
                      ? `, ${resumoEncontrosDupla(duplasDoDia)}`
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
                          setRegistroAberto(null);
                          setSelecionado(iso);
                        }}
                        onKeyDown={(e) => onDiaKeyDown(e, iso)}
                        className={cn(
                          "flex min-h-11 w-full flex-col items-start rounded-lg px-1.5 pb-1 pt-1 transition-[color,background-color,box-shadow] hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-lime)] sm:min-h-12",
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
                                  ? "text-muted-foreground/70"
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
                                  className="grid size-5 place-items-center rounded-full bg-[var(--brand-lime)] text-[11px] font-semibold leading-none tabular-nums text-[var(--brand-ink)]"
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
                          {/* dots de status dos encontros de dupla — cap em 3, "+N" além */}
                          {duplasDoDia.slice(0, 3).map(({ encontro }) => (
                            <span
                              key={encontro.id}
                              className={cn(
                                "size-2 shrink-0 rounded-full",
                                corDotEncontro(encontro)
                              )}
                            />
                          ))}
                          {duplasDoDia.length > 3 && (
                            <span className="text-[11px] font-medium leading-none text-muted-foreground">
                              +{duplasDoDia.length - 3}
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
      </div>

      {/* ===== detalhe do dia selecionado ===== */}
      <section
        ref={refDetalhe}
        aria-label="Detalhe do dia selecionado"
        className="scroll-mt-20 rounded-xl bg-card px-4 py-4 shadow-[var(--shadow-border)] sm:px-5 lg:sticky lg:top-4 lg:col-start-2 lg:row-start-1"
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
                  Nenhum evento do ciclo neste dia.
                </p>
                {proximoDiaIso && (
                  <button
                    type="button"
                    onClick={(e) => {
                      pedirRolarSePonteiro(e, proximoDiaIso);
                      moverPara(proximoDiaIso);
                    }}
                    className="mt-1 block w-full rounded-md py-3 text-left text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-lime)]"
                  >
                    Próximo evento do ciclo:{" "}
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
                  return (
                  <div key={e.id} className="space-y-1.5">
                    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                      <h2 className="text-base font-semibold tracking-tight sm:text-lg">
                        {nomeEvento}
                      </h2>
                      {e.id === semanaId && (
                        <span className="text-xs font-semibold text-[var(--ok-text)]">
                          esta semana
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
                    {/* cobertura do encontro oficial entre as duplas — só coord/supervisor */}
                    {ehCoordSup &&
                      e.tipo === "encontro" &&
                      e.numero != null &&
                      duplas.length > 0 && (
                        <CoberturaEncontro duplas={duplas} numero={e.numero} />
                      )}
                    {/* plano de aula/anotações do mentor — uma por dupla ativa,
                        rotulada pelo mentorado quando ele tem mais de uma */}
                    {e.tipo === "encontro" &&
                      e.numero != null &&
                      duplasAtivas.map((d) => (
                        <NotaEncontro
                          key={d.id}
                          duplaId={d.id}
                          numero={e.numero!}
                          nota={
                            d.notas?.find((n) => n.numero === e.numero)?.texto ?? null
                          }
                          rotulo={
                            duplasAtivas.length > 1 ? d.mentorado.nome : undefined
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
                ciclo (o que o programa diz sobre o dia) */}
            {itensDupla.length > 0 && (
              <div
                className={cn(
                  "rounded-xl bg-muted/40 p-3",
                  eventosSelecionados.length > 0 ? "mt-4" : "mt-3"
                )}
              >
                <h3 className="px-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                  {ehMentor ? "Sua dupla" : "Duplas"}
                </h3>
                {/* chave dos dots de status — contextual, junto de onde eles aparecem */}
                <ChaveDotsDupla className="mt-1 px-2" />
                <ul className="mt-1.5">
                  {itensDupla.map((item, i) => (
                    <EncontroDuplaRow
                      key={item.encontro.id}
                      item={item}
                      selecionado={selecionado}
                      ehMentor={ehMentor}
                      indice={i}
                      evento={
                        eventoPorNumero.get(item.encontro.numero) ?? null
                      }
                      aberto={registroAberto === item.encontro.id}
                      onAlternarRegistro={(abrir) =>
                        setRegistroAberto(abrir ? item.encontro.id : null)
                      }
                      onRegistroSalvo={() => {
                        setRegistroAberto(null);
                        router.refresh();
                      }}
                    />
                  ))}
                </ul>
                {/* encontro agendado fora do dia oficial (nº sem evento do ciclo
                    aqui) não tem bloco próprio acima — a anotação mora sob a
                    linha, rotulada pelo nº (v1: só o mentor escreve) */}
                {ehMentor &&
                  itensDupla
                    .filter((i) => !numerosOficiais.has(i.encontro.numero))
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

      {/* ===== lista do mês ===== */}
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
                {semanaEhAtual(s) && (
                  <span className="text-[var(--ok-text)]"> · esta semana</span>
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
                      "flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--brand-lime)] sm:gap-4 sm:px-5",
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
  // encontro oficial do dia — no máximo 1 (encontros são terças semanais)
  const oficial =
    eventosDoDia.find((e) => e.tipo === "encontro" && e.numero != null) ?? null;
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
  ehMentor,
  indice,
  evento,
  aberto,
  onAlternarRegistro,
  onRegistroSalvo,
}: {
  item: ItemDupla;
  selecionado: string;
  ehMentor: boolean;
  indice: number;
  /** Evento oficial do nº do encontro — sugestão de tema/instrumento do form. */
  evento: CicloEvento | null;
  /** O form de registro desta linha está aberto (um por vez no painel). */
  aberto: boolean;
  onAlternarRegistro: (abrir: boolean) => void;
  onRegistroSalvo: () => void;
}) {
  const { encontro, dupla } = item;
  const iso = isoDoEncontro(encontro);
  // numero-match do mentor pode trazer encontro de outro dia — aí a data aparece completa
  const mesmoDia = diaDoEncontro(encontro) === selecionado;
  // "agora" congelado na montagem (a linha remonta a cada dia selecionado) —
  // Date.now() no render viola pureza; quem cobre a virada do horário numa
  // aba parada é o RevelarApos do bloco de registro
  const [agora] = useState(() => Date.now());
  // agendado cuja hora já passou sem virar realizado nem não-aconteceu — a
  // mesma leitura de "limbo" da trilha (jornadaDaDupla) e da ficha
  const limbo =
    encontro.status === "agendado" &&
    encontro.data_hora != null &&
    new Date(encontro.data_hora).getTime() < agora;
  const registroPendente =
    !encontro.registro && (encontro.status === "realizado" || limbo);
  // mentor com registro pendente cai direto no card do encontro na página da
  // dupla — lá a âncora abre o RegistroInline; aqui o caminho curto é o CTA
  const href =
    ehMentor && registroPendente
      ? `/duplas/${dupla.id}#registrar-${encontro.id}`
      : `/duplas/${dupla.id}`;

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

  // link da chamada é ação própria perto da hora — chip, não texto corrido
  const chamada = encontro.status === "agendado" && encontro.link && (
    <a
      href={encontro.link}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-[var(--ok)]/40 bg-[var(--ok)]/10 px-2.5 text-xs font-medium text-[var(--ok-text)] transition-colors hover:bg-[var(--ok)]/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <VideoCamera size={14} aria-hidden />
      Entrar na chamada
      <span className="sr-only"> (abre em nova aba)</span>
    </a>
  );

  return (
    <li
      className="animate-enter"
      style={{ "--i": Math.min(indice, 10) } as CSSProperties}
    >
      <Link
        href={href}
        className="group flex min-h-11 items-center gap-2.5 rounded-lg px-2 py-2 transition-colors hover:bg-muted/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-lime)]"
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
