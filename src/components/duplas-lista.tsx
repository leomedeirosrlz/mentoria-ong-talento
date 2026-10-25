"use client";

import { type CSSProperties, useState } from "react";
import Link from "next/link";
import {
  CaretRight,
  ChatsCircle,
  Clock,
  DotsThreeVertical,
  DownloadSimple,
  Funnel,
  Lifebuoy,
  MagnifyingGlass,
} from "@phosphor-icons/react";
import {
  comparaNome,
  diffDias,
  eventoDaSemana,
  eventosDoCronograma,
  formatDateTime,
  formatDiaMes,
  formatDiaSemanaMes,
  ORDEM_SEMAFORO,
  saudadeDaDupla,
  toDateStr,
  totalDaTrilha,
  ultimoRegistro,
} from "@/lib/ciclo";
import { prazoTrilhaEspecialista } from "@/lib/encerramento";
import { saudeDoRecorte } from "@/lib/agenda-coordenacao";
import { turmaLonga } from "@/lib/turma";
import { rotuloDiaAgenda } from "@/lib/agenda-minha";
import { acaoWhatsAppDupla, encontroPendente } from "@/lib/acao-lembrete";
import type { Interacao } from "@/lib/interacoes";
import type { SupervisaoAlvo } from "@/lib/queries-supervisao";
import type { CicloEvento, Dupla, EspecialistaEvento } from "@/lib/types";
import { cn, normaliza } from "@/lib/utils";
import { DuplaAvatares } from "@/components/dupla-avatares";
import { DuplaNomes } from "@/components/dupla-nomes";
import { DuplaLinha, GRID_DUPLA_LG, type TomSituacao } from "@/components/dupla-linha";
import { SaudePrograma } from "@/components/saude-programa";
import { AvaliacaoBadge } from "@/components/semaforo";
import { NovaDuplaDialog } from "@/components/nova-dupla-dialog";
import { ImportarCsvDialog } from "@/components/importar-csv-dialog";
import { DuplaWaAcao } from "@/components/dupla-wa-acao";
import { SupervisaoDialog } from "@/components/supervisao-dialog";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { filterChipCls } from "@/components/ui/filter-chip";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Saude = ReturnType<typeof saudadeDaDupla>;

/** A mesma lista de duplas sob quatro óticas (v5): coordenação (radar com
 *  chips+régua e massa saudável colapsada), auxiliar executivo (só as
 *  supervisionadas, agrupadas por turma), mentor DPP ("Minhas duplas" em
 *  cards) e mentor especialista ("Minhas trilhas" — semáforo DPP não é a
 *  régua dela; passos 1–5 + prazo são). */
export type VisaoDuplas =
  | "coordenacao"
  | "supervisor"
  | "mentor"
  | "especialista"
  /** DPP + especialista ao mesmo tempo (WP6b): as duas seções empilhadas,
   *  a lista dividida por trilha — "Minhas duplas" sobre "Minhas trilhas". */
  | "hibrido";

// ---------- status → pill ----------

const PILL_CLS = {
  risco: "bg-[var(--danger)]/10 text-[var(--danger-text)]",
  atencao: "bg-[var(--warn)]/20 text-[var(--warn-text)]",
  // dupla em dia é neutra: sem cor de status
  ok: "bg-muted text-foreground",
  pausa: "bg-muted text-muted-foreground",
  apoio: "bg-[var(--info-bg)] text-[var(--info-text)] border border-[var(--info-border)]",
} as const;

type TomPill = keyof typeof PILL_CLS;

function Pill({ tom, children }: { tom: TomPill; children: React.ReactNode }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-semibold leading-none",
        PILL_CLS[tom]
      )}
    >
      {children}
    </span>
  );
}

const STATUS_LABEL: Record<string, { label: string; tom: TomPill }> = {
  risco: { label: "Em risco", tom: "risco" },
  atencao: { label: "Atenção", tom: "atencao" },
  ok: { label: "Em dia", tom: "ok" },
  pausada: { label: "Pausada", tom: "pausa" },
  concluida: { label: "Concluída", tom: "pausa" },
  encerrada: { label: "Encerrada", tom: "pausa" },
};

/** O pill de estado da linha: status da dupla fora da régua, senão o
 *  semáforo da jornada. Apoio NÃO vira estado — é pill própria ao lado. */
function estadoDaDupla(
  d: Dupla,
  saude: Saude
): { label: string; tom: TomPill } {
  if (d.status !== "ativa") return STATUS_LABEL[d.status] ?? STATUS_LABEL.pausada;
  return STATUS_LABEL[saude.semaforo];
}

/** Tom do pill de estado na linha canônica — mesma régua, cor da linha. */
function tomDaSituacao(tom: TomPill): TomSituacao {
  if (tom === "risco") return "risco";
  if (tom === "atencao") return "atencao";
  if (tom === "pausa") return "pausa";
  return "neutro";
}

// ---------- helpers de texto ----------

/** "há 8 dias" a partir de um ISO — recência do sinal, sempre em dias
 *  (o tempoRelativo vira data absoluta a partir de 7d e a régua quer
 *  a distância, não o dia). */
function haDiasTxt(iso: string | null | undefined, hojeStr: string): string | null {
  if (!iso) return null;
  const dia = /^\d{4}-\d{2}-\d{2}$/.test(iso)
    ? iso
    : toDateStr(new Date(iso));
  const d = diffDias(hojeStr, dia);
  if (d <= 0) return "hoje";
  if (d === 1) return "ontem";
  return `há ${d} dias`;
}

/** Encontro realizado mais recente da dupla (por data do fato). */
function ultimoRealizado(d: Dupla) {
  return d.encontros
    .filter((e) => e.status === "realizado" && (e.realizado_em ?? e.data_hora))
    .sort(
      (a, b) =>
        new Date(b.realizado_em ?? b.data_hora!).getTime() -
        new Date(a.realizado_em ?? a.data_hora!).getTime()
    )[0];
}

/** "último encontro há 26 dias" — a recência que fecha a linha densa. */
function recenciaUltimo(d: Dupla, hojeStr: string): string | null {
  const u = ultimoRealizado(d);
  if (!u) return null;
  const rel = haDiasTxt(u.realizado_em ?? u.data_hora, hojeStr);
  return rel ? `último encontro ${rel}` : null;
}

/** O motivo da linha, em uma linha: os critérios acesos na ordem de
 *  prioridade. Fora da régua não há critério: pausada diz a jornada
 *  congelada, concluída e encerrada não cobram nada aqui. */
function motivoDaDupla(d: Dupla, saude: Saude): string | null {
  if (d.status === "pausada") return "Jornada congelada, sem cobrança";
  if (d.status !== "ativa") return null;
  if (saude.sinais.length === 0) return null;
  return saude.sinais
    .map(
      (s) =>
        s.texto +
        (s.detalhe ? (s.detalhe.startsWith("há") ? ` ${s.detalhe}` : ` (${s.detalhe})`) : "")
    )
    .join(" · ");
}

const APOIO_ORIGEM_LABEL = {
  mentor: "pedido pelo mentor",
  mentorado: "pedido pelo mentorado",
  ambos: "pedido pelo mentor e pelo mentorado",
} as const;

// ---------- a linha densa (v1 → v5) ----------

/** A linha da dupla em /duplas: monta os dados e entrega à linha canônica.
 *  O WhatsApp e o ⋯ chegam prontos do caller (dependem do papel). */
function LinhaDupla({
  d,
  saude,
  eventos,
  mostrarSupervisor,
  wa,
  menu,
  i,
}: {
  d: Dupla;
  saude: Saude;
  eventos: CicloEvento[];
  mostrarSupervisor: boolean;
  /** ação WhatsApp sempre visível — "Lembrar" onde há pendência apontável
   *  em dupla ativa, "Chamar" nas demais (o DuplaWaAcao resolve o resto). */
  wa: React.ReactNode;
  /** ⋮ das ações secundárias do papel — ex.: "Registrar supervisão". */
  menu?: React.ReactNode;
  i: number;
}) {
  const estado = estadoDaDupla(d, saude);
  const ehEsp = d.trilha === "especialista";
  const total = totalDaTrilha(d.trilha, eventosDoCronograma(eventos, d.cronograma_id));
  const realizados = d.encontros
    .filter((e) => e.status === "realizado")
    .map((e) => e.numero);
  const ultimoReg = ultimoRegistro(d);
  const encontroDoReg = ultimoReg
    ? d.encontros.find((e) => e.registro?.id === ultimoReg.id)
    : null;
  const meta = [
    ehEsp ? "Trilha de especialista" : null,
    d.turma ? turmaLonga(d.turma) : null,
    mostrarSupervisor
      ? d.supervisor
        ? `sup. ${d.supervisor.nome}`
        : "sem supervisor"
      : null,
  ]
    .filter(Boolean)
    .join(" · ");
  const legenda =
    d.status === "pausada"
      ? "em pausa"
      : d.status === "concluida" || d.status === "encerrada"
        ? "jornada fechada"
        : ehEsp
          ? "sessões"
          : `esperado ${saude.esperado}`;

  return (
    <DuplaLinha
      i={i}
      mentor={d.mentor}
      mentorado={d.mentorado}
      situacao={{ rotulo: estado.label, tom: tomDaSituacao(estado.tom) }}
      apoio={
        saude.apoio.aberto
          ? { detalhe: APOIO_ORIGEM_LABEL[saude.apoio.origem ?? "mentor"] }
          : null
      }
      meta={meta || null}
      motivo={motivoDaDupla(d, saude)}
      progresso={{
        total,
        realizados,
        esperado: !ehEsp && d.status === "ativa" ? saude.esperado : null,
        legenda,
      }}
      nota={
        ultimoReg?.avaliacao ? (
          <>
            <AvaliacaoBadge avaliacao={ultimoReg.avaliacao} />
            <span
              className="whitespace-nowrap text-xs leading-tight text-muted-foreground"
              title={
                encontroDoReg
                  ? `Nota do mentor no ${encontroDoReg.numero}º encontro`
                  : "Nota do mentor"
              }
            >
              {encontroDoReg ? `${encontroDoReg.numero}º enc.` : "nota do mentor"}
            </span>
          </>
        ) : (
          <span className="text-xs text-muted-foreground" title="Sem nota do mentor">
            Sem nota
          </span>
        )
      }
      acao={wa}
      menu={menu}
      fichaHref={`/duplas/${d.id}`}
      fichaNome={d.mentorado.nome.split(" ")[0]}
    />
  );
}

/** Linha mínima da massa saudável — nomes + mini-barra de encontros +
 *  recência + WhatsApp ("Chamar" — toda dupla tem contato em 1 toque,
 *  mesmo colapsada) + link. */
function LinhaMini({
  d,
  saude,
  eventos,
  hojeStr,
  wa,
  i,
}: {
  d: Dupla;
  saude: Saude;
  eventos: CicloEvento[];
  hojeStr: string;
  wa: React.ReactNode;
  i: number;
}) {
  const feitos = d.encontros.filter((e) => e.status === "realizado").length;
  const total = totalDaTrilha(
    d.trilha,
    eventosDoCronograma(eventos, d.cronograma_id)
  );
  const ehEsp = d.trilha === "especialista";
  const rec = recenciaUltimo(d, hojeStr);
  return (
    <div
      style={{ "--i": Math.min(i, 10) } as CSSProperties}
      className="animate-enter grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 border-t border-border/60 px-3 py-2 text-[13px] @4xl:grid-cols-[minmax(190px,1.4fr)_150px_minmax(150px,1fr)_auto_auto] @4xl:px-5 @4xl:py-2.5"
    >
      <span className="flex min-w-0 flex-wrap items-center gap-1.5 font-medium">
        <DuplaNomes mentor={d.mentor.nome} mentorado={d.mentorado.nome} />
        {d.turma && (
          <span
            title={d.turma}
            className="rounded border border-border px-1.5 py-px text-[11px] font-semibold text-muted-foreground"
          >
            {turmaLonga(d.turma)}
          </span>
        )}
      </span>
      <span className="hidden items-center gap-1.5 @4xl:inline-flex">
        {/* mini-barra com o tick do esperado — substitui o "7×7 em dia"
            solto (mock: .m-prog); o número fica no texto ao lado */}
        <span
          role="img"
          aria-label={`${feitos} de ${total} encontros realizados`}
          className="relative h-1.5 w-14 rounded-full bg-muted"
        >
          <span
            aria-hidden
            className="absolute inset-y-0 left-0 rounded-full bg-muted-foreground"
            style={{
              width: `${total > 0 ? Math.min((feitos / total) * 100, 100) : 0}%`,
            }}
          />
          {/* idem barra cheia: tick centralizado (-translate-x-1/2) e só
              em dupla ativa — fora da régua não há "esperado até hoje" */}
          {!ehEsp && d.status === "ativa" && (
            <span
              aria-hidden
              className="absolute -top-0.5 -bottom-0.5 w-0.5 -translate-x-1/2 rounded bg-foreground/50"
              style={{
                left: `${total > 0 ? Math.min((saude.esperado / total) * 100, 100) : 0}%`,
              }}
            />
          )}
        </span>
        <span className="whitespace-nowrap text-xs font-semibold text-foreground">
          {feitos}/{total} · esp. {saude.esperado}
        </span>
      </span>
      <span className="hidden truncate text-xs text-muted-foreground @4xl:inline">
        {rec}
      </span>
      {/* na tabela o span some (@4xl:contents) e WA+ficha ocupam as duas
          colunas `auto` do fim do grid; no mobile ele é a célula de
          ações inteira (nomes à esquerda, ações à direita) */}
      <span className="flex items-center gap-1.5 @4xl:contents">
        {wa}
        <Link
          href={`/duplas/${d.id}`}
          aria-label={`Ver ficha da dupla de ${d.mentorado.nome.split(" ")[0]}`}
          title="Ver ficha"
          className={cn(
            buttonVariants({ variant: "ghost", size: "sm" }),
            "w-11 shrink-0 px-0 text-muted-foreground md:w-auto md:px-2.5"
          )}
        >
          <span className="hidden whitespace-nowrap md:inline">Ver ficha</span>
          <CaretRight weight="bold" aria-hidden />
        </Link>
      </span>
    </div>
  );
}

/** O cabeçalho da tabela densa — usa a mesma grade da linha canônica, pra
 *  cada rótulo cair em cima da sua coluna. */
function CabecalhoColunas() {
  return (
    <div
      aria-hidden
      className={cn(
        "hidden border-b border-border px-5 py-2.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground @4xl:grid @4xl:gap-x-3",
        GRID_DUPLA_LG
      )}
    >
      <span>Situação</span>
      <span>Dupla</span>
      <span>Motivo</span>
      <span title="Cada quadrado é um encontro da trilha; o traço marca quantos o calendário já esperava até hoje">
        Encontros
      </span>
      <span>Nota</span>
      <span />
    </div>
  );
}

// ---------- chips de categoria ----------

type FiltroCat =
  | "todas"
  | "risco"
  | "atencao"
  | "andamento"
  | "pausada"
  | "concluida"
  | "apoio";

const CATS: { id: FiltroCat; nome: string; dot: string | null }[] = [
  { id: "todas", nome: "Todas", dot: null },
  { id: "risco", nome: "Em risco", dot: "bg-[var(--danger)]" },
  { id: "atencao", nome: "Atenção", dot: "bg-[var(--warn)]" },
  { id: "andamento", nome: "Em andamento", dot: null },
  { id: "pausada", nome: "Pausadas", dot: null },
  { id: "concluida", nome: "Concluídas", dot: null },
  { id: "apoio", nome: "Apoio", dot: null },
];

/** Cada chip é uma parte da mesma régua do resumo: "Em andamento" são as
 *  ativas (risco e atenção incluídas), "Concluídas" juntam encerradas. */
function chipBate(f: FiltroCat, d: Dupla, s: Saude): boolean {
  switch (f) {
    case "todas":
      return true;
    case "risco":
      return d.status === "ativa" && s.semaforo === "risco";
    case "atencao":
      return d.status === "ativa" && s.semaforo === "atencao";
    case "andamento":
      return d.status === "ativa";
    case "pausada":
      return d.status === "pausada";
    case "concluida":
      return d.status === "concluida" || d.status === "encerrada";
    case "apoio":
      return s.apoio.aberto;
  }
}

function CatChip({
  nome,
  dot,
  n,
  ativo,
  apoio,
  onClick,
}: {
  nome: string;
  dot: string | null;
  n: number;
  ativo: boolean;
  apoio?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={ativo}
      onClick={onClick}
      className={cn(
        filterChipCls(ativo),
        apoio && !ativo && "border-[var(--info-border)] bg-[var(--info-bg)] text-[var(--info-text)] hover:bg-[var(--info-bg)]"
      )}
    >
      {dot && <span aria-hidden className={cn("size-2 shrink-0 rounded-full", dot)} />}
      {apoio && <Lifebuoy size={13} aria-hidden />}
      {nome}
      <span
        className={cn(
          "tabular-nums text-[11px]",
          ativo ? "text-background/70" : "text-muted-foreground"
        )}
      >
        {n}
      </span>
    </button>
  );
}

// ---------- resumo das visões de mentor ----------

function resumoDaLista(
  lista: Dupla[],
  saudePorId: Map<string, Saude>,
  visao: VisaoDuplas
): { n: string; itens: { texto: string; forte?: boolean }[] } {
  const cont = { risco: 0, atencao: 0, andamento: 0, pausada: 0, apoio: 0 };
  for (const d of lista) {
    const s = saudePorId.get(d.id)!;
    if (s.apoio.aberto) cont.apoio++;
    if (d.status === "ativa")
      cont[s.semaforo === "ok" ? "andamento" : s.semaforo]++;
    else if (d.status === "pausada") cont.pausada++;
  }
  const sujeito =
    visao === "especialista"
      ? `${lista.length} ${lista.length === 1 ? "trilha" : "trilhas"}`
      : `${lista.length} ${lista.length === 1 ? "dupla" : "duplas"}`;
  const itens = [
    cont.risco > 0 && { texto: `${cont.risco} em risco`, forte: true },
    cont.atencao > 0 && { texto: `${cont.atencao} em atenção`, forte: true },
    cont.apoio > 0 && { texto: `${cont.apoio} apoio aberto`, forte: true },
    cont.pausada > 0 && { texto: `${cont.pausada} pausada${cont.pausada > 1 ? "s" : ""}` },
    cont.andamento > 0 && { texto: `${cont.andamento} em dia` },
  ].filter(Boolean) as { texto: string; forte?: boolean }[];
  return { n: sujeito, itens };
}

function ResumoLinha({ resumo }: { resumo: ReturnType<typeof resumoDaLista> }) {
  return (
    <p className="mt-1 text-sm text-muted-foreground">
      {resumo.n}
      {resumo.itens.map((it, i) => (
        <span key={i}>
          {" · "}
          {it.forte ? <b className="font-semibold text-foreground">{it.texto}</b> : it.texto}
        </span>
      ))}
    </p>
  );
}

// ---------- estado vazio ----------

function EstadoVazio({
  lista,
  visao,
  podeCriar,
  busca,
  filtroAtivo,
  onLimparBusca,
  onLimparFiltro,
}: {
  lista: Dupla[];
  visao: VisaoDuplas;
  podeCriar: boolean;
  busca: string;
  filtroAtivo: boolean;
  onLimparBusca: () => void;
  onLimparFiltro: () => void;
}) {
  if (lista.length === 0) {
    const texto =
      visao === "coordenacao"
        ? "Monte a primeira dupla do programa escolhendo mentor e mentorado."
        : visao === "supervisor"
          ? "Quando a coordenação atribuir duplas pra você supervisionar, elas aparecem aqui."
          : visao === "especialista"
            ? "Quando você aceitar uma trilha no mural, ela aparece aqui."
            : "A coordenação monta as duplas; elas aparecem aqui.";
    return (
      <div className="animate-enter rounded-xl bg-card px-5 py-12 text-center shadow-[var(--shadow-border)]">
        <div aria-hidden className="flex justify-center">
          <span className="size-8 rounded-full bg-[var(--brand-lime)]" />
          <span className="-ml-2.5 size-8 rounded-full bg-[var(--role-mentorado)]" />
        </div>
        <p className="mt-3 font-medium text-foreground">
          {visao === "especialista"
            ? "Nenhuma trilha ativa ainda."
            : "Nenhuma dupla formada ainda."}
        </p>
        <p className="mt-1 text-sm text-muted-foreground">{texto}</p>
        {podeCriar && (
          <div className="mt-4 flex justify-center">
            <NovaDuplaDialog />
          </div>
        )}
      </div>
    );
  }
  if (busca) {
    return (
      <div className="animate-enter rounded-xl bg-card px-5 py-12 text-center shadow-[var(--shadow-border)]">
        <span className="mx-auto grid size-11 place-items-center rounded-full bg-muted text-muted-foreground">
          <MagnifyingGlass aria-hidden size={18} weight="regular" />
        </span>
        <p className="mt-3 font-medium text-foreground">
          Nenhum resultado para “{busca.trim()}”.
        </p>
        <p className="mt-1 text-sm text-muted-foreground">Tente outro nome.</p>
        <Button variant="outline" size="sm" className="mt-4" onClick={onLimparBusca}>
          Limpar busca
        </Button>
      </div>
    );
  }
  if (filtroAtivo) {
    return (
      <div className="animate-enter rounded-xl bg-card px-5 py-12 text-center shadow-[var(--shadow-border)]">
        <span className="mx-auto grid size-11 place-items-center rounded-full bg-muted text-muted-foreground">
          <Funnel aria-hidden size={18} weight="regular" />
        </span>
        <p className="mt-3 font-medium text-foreground">
          Nenhuma dupla nessa situação.
        </p>
        <Button variant="outline" size="sm" className="mt-4" onClick={onLimparFiltro}>
          Limpar filtro
        </Button>
      </div>
    );
  }
  return null;
}

// =====================================================================
//  COMPONENTE PRINCIPAL
// =====================================================================

export function DuplasLista({
  lista,
  eventos,
  agora,
  visao,
  meuNome,
  supervisaoAlvos = [],
  especialistaEventos = [],
  nudges = {},
  origem,
}: {
  lista: Dupla[];
  eventos: CicloEvento[];
  /** ISO timestamp vindo do server — hidratação idêntica ao render do servidor. */
  agora: string;
  visao: VisaoDuplas;
  /** primeiro nome de quem opera — assina o texto do lembrete */
  meuNome?: string;
  /** visão do auxiliar: os alvos do dialog de supervisão (já escopados a ele). */
  supervisaoAlvos?: SupervisaoAlvo[];
  /** os 5 passos do guia — visão da especialista (e só ela os consome). */
  especialistaEventos?: EspecialistaEvento[];
  /** último contato por dupla — a coordenação lê o cap de 48h do Lembrar */
  nudges?: Record<string, Interacao>;
  /** proto+host do deploy (headers da page) — o texto do Lembrar embute
   *  link de registro ABSOLUTO; sem ele o trecho sai da mensagem */
  origem?: string;
}) {
  const hoje = new Date(agora);
  const hojeStr = toDateStr(hoje);
  const saudePorId = new Map(
    lista.map((d) => [d.id, saudadeDaDupla(d, eventos, hoje)])
  );
  const resumo = resumoDaLista(lista, saudePorId, visao);

  if (visao === "coordenacao")
    return (
      <VisaoCoordenacao
        lista={lista}
        eventos={eventos}
        hoje={hoje}
        hojeStr={hojeStr}
        saudePorId={saudePorId}
        meuNome={meuNome}
        nudges={nudges}
        origem={origem}
      />
    );
  if (visao === "supervisor")
    return (
      <VisaoSupervisor
        lista={lista}
        eventos={eventos}
        hoje={hoje}
        hojeStr={hojeStr}
        saudePorId={saudePorId}
        alvos={supervisaoAlvos}
        meuNome={meuNome}
        nudges={nudges}
        origem={origem}
      />
    );
  if (visao === "especialista")
    return (
      <VisaoEspecialista
        lista={lista}
        hoje={hoje}
        saudePorId={saudePorId}
        resumo={resumo}
        espEventos={especialistaEventos}
      />
    );
  if (visao === "hibrido") {
    const dpp = lista.filter((d) => d.trilha !== "especialista");
    const esp = lista.filter((d) => d.trilha === "especialista");
    if (!dpp.length && !esp.length) {
      return (
        <EstadoVazio
          lista={lista}
          visao="mentor"
          podeCriar={false}
          busca=""
          filtroAtivo={false}
          onLimparBusca={() => {}}
          onLimparFiltro={() => {}}
        />
      );
    }
    // cada seção recebe a fatia da própria trilha (e o resumo dela) — seção
    // sem duplas não aparece: um título "Minhas duplas" sobre zero cards
    // seria ruído, não contexto. Com as duas seções o h1 é da página e elas
    // viram h2 — dois h1 na mesma página quebram a hierarquia do heading
    const duasSecoes = dpp.length > 0 && esp.length > 0;
    return (
      <div className="space-y-10">
        {duasSecoes && (
          <header>
            <h1 className="text-2xl font-semibold tracking-tight">
              Minhas duplas e trilhas
            </h1>
          </header>
        )}
        {dpp.length > 0 && (
          <VisaoMentor
            lista={dpp}
            eventos={eventos}
            hoje={hoje}
            saudePorId={saudePorId}
            resumo={resumoDaLista(dpp, saudePorId, "mentor")}
            nivel={duasSecoes ? "h2" : "h1"}
          />
        )}
        {esp.length > 0 && (
          <VisaoEspecialista
            lista={esp}
            hoje={hoje}
            saudePorId={saudePorId}
            resumo={resumoDaLista(esp, saudePorId, "especialista")}
            espEventos={especialistaEventos}
            nivel={duasSecoes ? "h2" : "h1"}
          />
        )}
      </div>
    );
  }
  return (
    <VisaoMentor
      lista={lista}
      eventos={eventos}
      hoje={hoje}
      saudePorId={saudePorId}
      resumo={resumo}
    />
  );
}

// =====================================================================
//  COORDENAÇÃO — radar denso com chips+régua e massa saudável
// =====================================================================

function VisaoCoordenacao({
  lista,
  eventos,
  hoje,
  hojeStr,
  saudePorId,
  meuNome,
  nudges,
  origem,
}: {
  lista: Dupla[];
  eventos: CicloEvento[];
  hoje: Date;
  hojeStr: string;
  saudePorId: Map<string, Saude>;
  meuNome?: string;
  nudges: Record<string, Interacao>;
  origem?: string;
}) {
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState<FiltroCat>("todas");
  const [turmaSel, setTurmaSel] = useState<string | null>(null);
  const [supSel, setSupSel] = useState<string>("todas");
  const [mentorSel, setMentorSel] = useState<string | null>(null);
  const [mentorAberto, setMentorAberto] = useState(false);

  const limparRecortes = () => {
    setFiltro("todas");
    setTurmaSel(null);
    setSupSel("todas");
    setMentorSel(null);
  };

  const turmas = [
    ...new Set(lista.map((d) => d.turma).filter((t): t is string => !!t)),
  ].sort((a, b) => a.localeCompare(b, "pt-BR"));
  const supervisores = [
    ...new Map(
      lista
        .filter((d) => d.supervisor)
        .map((d) => [d.supervisor!.id, d.supervisor!.nome])
    ).entries(),
  ]
    .map(([id, nome]) => ({ id, nome }))
    .sort((a, b) => comparaNome(a.nome, b.nome));
  const temSemSup = lista.some((d) => !d.supervisor);
  const mentores = [
    ...new Map(lista.map((d) => [d.mentor.id, d.mentor.nome])).entries(),
  ]
    .map(([id, nome]) => ({ id, nome }))
    .sort((a, b) => comparaNome(a.nome, b.nome));

  // o recorte da turma, do supervisor e do mentor: a situação mostrada no
  // resumo é a do que está selecionado (sem recorte, é o programa inteiro)
  const recorte = lista.filter(
    (d) =>
      (!turmaSel || d.turma === turmaSel) &&
      (supSel === "todas" ||
        (supSel === "nenhum" ? !d.supervisor : d.supervisor?.id === supSel)) &&
      (!mentorSel || d.mentor.id === mentorSel)
  );
  const saude = saudeDoRecorte(recorte, eventos, hoje);

  // a ordem default é o radar: apoio (trabalho) → risco → atenção → em
  // andamento → fora da régua (pausada/concluída/encerrada)
  const pesoFila = (d: Dupla) => {
    const s = saudePorId.get(d.id)!;
    if (s.apoio.aberto) return 0;
    if (d.status !== "ativa") return 5;
    return ORDEM_SEMAFORO[s.semaforo] + 1;
  };
  const porPrioridade = (a: Dupla, b: Dupla) =>
    pesoFila(a) - pesoFila(b) ||
    comparaNome(a.mentor.nome, b.mentor.nome) ||
    comparaNome(a.mentorado.nome, b.mentorado.nome);

  const q = normaliza(busca.trim());
  const base = [...recorte].sort(porPrioridade).filter(
    (d) =>
      !q ||
      normaliza(d.mentor.nome).includes(q) ||
      normaliza(d.mentorado.nome).includes(q)
  );
  const exibidas = base.filter((d) =>
    chipBate(filtro, d, saudePorId.get(d.id)!)
  );

  // na visão "todas" sem recortes a massa saudável colapsa — destaques são
  // quem tem encontro batendo nos próximos 3 dias (v5)
  const semRecorte = !q && !turmaSel && supSel === "todas" && !mentorSel;
  const mostrarMassa =
    filtro === "todas" && semRecorte && exibidas.length > 0;
  const LIMITE_MASSA = 5;
  const colapsar = (d: Dupla) => {
    const s = saudePorId.get(d.id)!;
    return (
      d.status === "ativa" &&
      s.semaforo === "ok" &&
      !s.apoio.aberto &&
      !(
        s.proximo?.data_hora &&
        diffDias(toDateStr(new Date(s.proximo.data_hora)), hojeStr) <= 3 &&
        diffDias(toDateStr(new Date(s.proximo.data_hora)), hojeStr) >= 0
      )
    );
  };
  const massaTotal = mostrarMassa
    ? exibidas.filter(colapsar)
    : [];
  const usarMassa = mostrarMassa && massaTotal.length > LIMITE_MASSA;
  const visiveis = usarMassa ? exibidas.filter((d) => !colapsar(d)) : exibidas;
  const massa = usarMassa ? massaTotal : [];

  // fronteira entre "em andamento" e "fora da régua": o details da massa
  // entra antes das pausadas/encerradas (a fila continua debaixo dele)
  const idxForaDaRegua = visiveis.findIndex((d) => d.status !== "ativa");

  // a mesma linha monta a ação WhatsApp uma vez e reusa na linha cheia e
  // na mínima da massa (WhatsApp visível pra TODA dupla — decisão travada)
  const waDa = (d: Dupla, s: Saude) => (
    <DuplaWaAcao
      {...acaoWhatsAppDupla({
        dupla: d,
        saude: s,
        hoje,
        // o cap de 48h conta só interações tipo nudge — um "contato" manual
        // (Chamar) nunca bloqueia o Lembrar
        ultimoNudge: nudges[d.id]?.tipo === "nudge" ? nudges[d.id] : null,
        meuNome,
        tituloNudge: "Lembrete da coordenação",
        origem,
      })}
    />
  );

  const linha = (d: Dupla, i: number) => {
    const s = saudePorId.get(d.id)!;
    return (
      <LinhaDupla
        key={d.id}
        d={d}
        saude={s}
        eventos={eventos}
        mostrarSupervisor
        wa={waDa(d, s)}
        i={i}
      />
    );
  };

  const contagem = (id: FiltroCat) =>
    recorte.filter((d) => chipBate(id, d, saudePorId.get(d.id)!)).length;

  return (
    <>
      {/* page-head: título + contexto à esquerda; busca e ações à direita */}
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Duplas</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            hoje, {rotuloDiaAgenda(hojeStr).toLowerCase()}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 max-sm:w-full">
          <div className="relative min-w-0 flex-1 sm:max-w-xs sm:flex-none">
            <MagnifyingGlass
              aria-hidden
              size={16}
              className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              type="search"
              aria-label="Buscar dupla"
              placeholder="Buscar dupla, mentor ou mentorada…"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="pl-8"
            />
          </div>
          <ImportarCsvDialog tipoInicial="duplas" />
          <NovaDuplaDialog />
          <a
            href="/api/export"
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            <DownloadSimple />
            Exportar
          </a>
        </div>
      </header>

      {/* situação do programa (ou do recorte): o mesmo resumo da agenda */}
      {lista.length > 0 && (
        <div className="mt-5 rounded-xl border border-border bg-card p-4">
          <SaudePrograma saude={saude} nivel="h2" />
        </div>
      )}

      {/* chips por situação com contador; a régua de cada uma está no
          "Como calculamos" do resumo. Clicar de novo desfaz o filtro. */}
      {lista.length > 0 && (
        <div
          className="mt-5 flex gap-2 overflow-x-auto pb-1 sm:flex-wrap"
          role="group"
          aria-label="Filtrar por situação"
        >
          {CATS.map((c) => (
            <CatChip
              key={c.id}
              nome={c.nome}
              dot={c.dot}
              apoio={c.id === "apoio"}
              n={contagem(c.id)}
              ativo={filtro === c.id}
              onClick={() => setFiltro(filtro === c.id ? "todas" : c.id)}
            />
          ))}
        </div>
      )}

      {/* filtros em linha única: turma + supervisão + "+ mentor" */}
      {(turmas.length > 1 || supervisores.length > 0) && (
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
          {turmas.length > 1 && (
            <span className="flex flex-wrap items-center gap-1.5">
              <span className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground sm:text-[11px]">
                Turma
              </span>
              <button
                type="button"
                aria-pressed={turmaSel === null}
                onClick={() => setTurmaSel(null)}
                className={filterChipCls(turmaSel === null)}
              >
                Todas
              </button>
              {turmas.map((t) => (
                <button
                  key={t}
                  type="button"
                  aria-pressed={turmaSel === t}
                  onClick={() => setTurmaSel(turmaSel === t ? null : t)}
                  className={filterChipCls(turmaSel === t)}
                  /* chip mostra o nome; o valor cru segue no estado/
                     comparação e vai no title pra desambiguar colisões
                     ("T1" vs "T1 · 2026/2027") */
                  title={t}
                >
                  {turmaLonga(t)}
                  <span
                    className={cn(
                      "text-[11px] tabular-nums",
                      turmaSel === t ? "text-background/70" : "text-muted-foreground"
                    )}
                  >
                    {lista.filter((d) => d.turma === t).length}
                  </span>
                </button>
              ))}
            </span>
          )}
          {supervisores.length > 0 && (
            <span className="flex items-center gap-1.5">
              <span className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground sm:text-[11px]">
                Supervisão
              </span>
              <Select
                value={supSel}
                onValueChange={(v) => setSupSel(v ?? "todas")}
                items={{
                  todas: "Todas",
                  ...Object.fromEntries(supervisores.map((s) => [s.id, s.nome])),
                  ...(temSemSup ? { nenhum: "Sem supervisor" } : {}),
                }}
              >
                <SelectTrigger size="sm" className="w-auto min-w-36 max-w-56" aria-label="Filtrar por supervisão">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todas">Todas</SelectItem>
                  {supervisores.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.nome}
                    </SelectItem>
                  ))}
                  {temSemSup && (
                    <SelectItem value="nenhum">Sem supervisor</SelectItem>
                  )}
                </SelectContent>
              </Select>
            </span>
          )}
          {mentores.length > 1 && (
            <>
              {!mentorAberto && !mentorSel ? (
                <Button
                  type="button"
                  variant="link"
                  size="sm"
                  onClick={() => setMentorAberto(true)}
                >
                  + mentor
                </Button>
              ) : (
                <Select
                  value={mentorSel ?? "todos"}
                  onValueChange={(v) =>
                    setMentorSel(!v || v === "todos" ? null : v)
                  }
                  items={{
                    todos: "Todos os mentores",
                    ...Object.fromEntries(mentores.map((m) => [m.id, m.nome])),
                  }}
                >
                  <SelectTrigger size="sm" className="w-auto min-w-40 max-w-56" aria-label="Filtrar por mentor">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos os mentores</SelectItem>
                    {mentores.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </>
          )}
        </div>
      )}

      {/* barra da lista: contagem viva + legenda dos dots */}
      <div className="mb-2 mt-5 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <p className="text-[13px] text-muted-foreground">
          <b className="font-semibold text-foreground">
            {exibidas.length}{" "}
            {exibidas.length === 1 ? "dupla" : "duplas"}
          </b>{" "}
          · ordenadas por prioridade
        </p>
        <p className="text-xs text-muted-foreground">
          <span aria-hidden className="mx-1 inline-block size-2 rounded-full bg-[var(--role-mentorado)] align-[-1px] ring-1 ring-black/10" />
          mentorado(a)
          <span aria-hidden className="mx-1 ml-3 inline-block size-2 rounded-full bg-[var(--role-mentor)] align-[-1px] ring-1 ring-black/10" />
          mentor(a)
        </p>
      </div>

      {/* a lista densa */}
      {exibidas.length === 0 ? (
        <EstadoVazio
          lista={lista}
          visao="coordenacao"
          podeCriar
          busca={busca}
          filtroAtivo={
            filtro !== "todas" ||
            !!turmaSel ||
            supSel !== "todas" ||
            !!mentorSel
          }
          onLimparBusca={() => setBusca("")}
          onLimparFiltro={limparRecortes}
        />
      ) : (() => {
        const antes = idxForaDaRegua >= 0 ? visiveis.slice(0, idxForaDaRegua) : visiveis;
        const depois = idxForaDaRegua >= 0 ? visiveis.slice(idxForaDaRegua) : [];
        let i = 0;
        return (
          <section
            aria-label="Lista de duplas"
            className="@container"
          >
            <div className="@4xl:overflow-hidden @4xl:rounded-xl @4xl:bg-card @4xl:shadow-[var(--shadow-border)]">
              <CabecalhoColunas />
              {/* filtro, turma, supervisão e busca sempre animam (convenção do
                  AGENTS.md): a re-key remonta as linhas e o animate-enter re-roda
                  com o stagger do --i. A busca entra na key de propósito. */}
              <div
                key={`${filtro}|${turmaSel ?? ""}|${supSel}|${mentorSel ?? ""}|${q}`}
                className="space-y-3 @4xl:space-y-0 @4xl:divide-y @4xl:divide-border/60"
              >
                {antes.map((d) => linha(d, i++))}
                {usarMassa && (
                  <details className="group/massa border-t border-border/60">
                    <summary className="flex min-h-11 cursor-pointer list-none items-center gap-1.5 px-5 py-3 text-sm font-semibold text-muted-foreground marker:hidden hover:text-foreground [&::-webkit-details-marker]:hidden">
                      <span
                        aria-hidden
                        className="text-[10px] transition-transform group-open/massa:rotate-90"
                      >
                        ▸
                      </span>
                      Mostrar as outras {massa.length}{" "}
                      {massa.length === 1 ? "dupla em andamento" : "duplas em andamento"}
                    </summary>
                    <div>
                      {massa.map((d) => {
                        const s = saudePorId.get(d.id)!;
                        return (
                          <LinhaMini
                            key={d.id}
                            d={d}
                            saude={s}
                            eventos={eventos}
                            hojeStr={hojeStr}
                            wa={waDa(d, s)}
                            i={i++}
                          />
                        );
                      })}
                    </div>
                  </details>
                )}
                {depois.map((d) => linha(d, i++))}
              </div>
            </div>
          </section>
        );
      })()}
    </>
  );
}

// =====================================================================
//  AUXILIAR EXECUTIVO — as supervisionadas, agrupadas por turma
// =====================================================================

function VisaoSupervisor({
  lista,
  eventos,
  hoje,
  hojeStr,
  saudePorId,
  alvos,
  meuNome,
  nudges,
  origem,
}: {
  lista: Dupla[];
  eventos: CicloEvento[];
  hoje: Date;
  hojeStr: string;
  saudePorId: Map<string, Saude>;
  alvos: SupervisaoAlvo[];
  /** primeiro nome de quem opera — assina o texto do Lembrar/Chamar */
  meuNome?: string;
  /** último nudge por dupla — o mesmo cap de 48h da coordenação; a RPC
   *  `enviar_lembrete` já autoriza o supervisor da dupla */
  nudges: Record<string, Interacao>;
  origem?: string;
}) {
  const [busca, setBusca] = useState("");

  const pesoFila = (d: Dupla) => {
    const s = saudePorId.get(d.id)!;
    if (s.apoio.aberto) return 0;
    if (d.status !== "ativa") return 5;
    return ORDEM_SEMAFORO[s.semaforo] + 1;
  };
  const porPrioridade = (a: Dupla, b: Dupla) =>
    pesoFila(a) - pesoFila(b) ||
    comparaNome(a.mentor.nome, b.mentor.nome) ||
    comparaNome(a.mentorado.nome, b.mentorado.nome);

  const q = normaliza(busca.trim());
  const base = [...lista].sort(porPrioridade).filter(
    (d) =>
      !q ||
      normaliza(d.mentor.nome).includes(q) ||
      normaliza(d.mentorado.nome).includes(q)
  );

  // sub-headers por turma dentro da mesma tabela — supervisionadas podem
  // misturar estados dentro da turma, a régua de critérios não se repete
  const grupos = new Map<string, Dupla[]>();
  for (const d of base) {
    const chave = d.turma || "Sem turma";
    grupos.set(chave, [...(grupos.get(chave) ?? []), d]);
  }
  const gruposOrdenados = [...grupos.entries()].sort(([a], [b]) =>
    a.localeCompare(b, "pt-BR")
  );

  let i = 0;
  return (
    <>
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Duplas que você supervisiona
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            hoje, {rotuloDiaAgenda(hojeStr).toLowerCase()}
          </p>
        </div>
        <div className="relative min-w-0 flex-1 sm:max-w-xs sm:flex-none">
          <MagnifyingGlass
            aria-hidden
            size={16}
            className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            type="search"
            aria-label="Buscar dupla"
            placeholder="Buscar dupla…"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="pl-8"
          />
        </div>
      </header>

      {lista.length > 0 && (
        <div className="mt-5 rounded-xl border border-border bg-card p-4">
          <SaudePrograma
            saude={saudeDoRecorte(lista, eventos, hoje)}
            nivel="h2"
          />
        </div>
      )}

      <div className="mb-2 mt-5 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <p className="text-[13px] text-muted-foreground">
          <b className="font-semibold text-foreground">
            {base.length} {base.length === 1 ? "dupla" : "duplas"}
          </b>{" "}
          · agrupadas por turma
        </p>
        <p className="text-xs text-muted-foreground">
          <span aria-hidden className="mx-1 inline-block size-2 rounded-full bg-[var(--role-mentorado)] align-[-1px] ring-1 ring-black/10" />
          mentorado(a)
          <span aria-hidden className="mx-1 ml-3 inline-block size-2 rounded-full bg-[var(--role-mentor)] align-[-1px] ring-1 ring-black/10" />
          mentor(a)
        </p>
      </div>

      {base.length === 0 ? (
        <EstadoVazio
          lista={lista}
          visao="supervisor"
          podeCriar={false}
          busca={busca}
          filtroAtivo={false}
          onLimparBusca={() => setBusca("")}
          onLimparFiltro={() => {}}
        />
      ) : (
        <section
          aria-label="Duplas supervisionadas"
          className="@container"
        >
          <div className="@4xl:overflow-hidden @4xl:rounded-xl @4xl:bg-card @4xl:shadow-[var(--shadow-border)]">
            <CabecalhoColunas />
            {/* sem re-key por busca — remontar a cada tecla recolhia os
                  grupos e matava o dialog de supervisão aberto */}
            <div>
              {gruposOrdenados.map(([turma, duplas], gi) => {
                // o próximo encontro oficial do calendário da turma — o "esta
                // semana é o N" do sub-header (duplas da turma correm o mesmo
                // cronograma; especialista cai fora)
                const cronogramaId = duplas.find((d) => d.cronograma_id)?.cronograma_id;
                const oficial = cronogramaId
                  ? eventoDaSemana(
                      eventosDoCronograma(eventos, cronogramaId),
                      hoje
                    )
                  : null;
                return (
                  <div key={turma}>
                    <div
                      className={cn(
                        "flex flex-wrap items-baseline gap-x-2 gap-y-0.5 bg-muted px-5 py-2 text-sm font-semibold text-foreground max-sm:rounded-xl max-sm:border max-sm:border-border",
                        gi > 0 && "border-t border-border"
                      )}
                    >
                      {turma === "Sem turma" ? turma : turmaLonga(turma)}
                      <small className="text-xs font-medium text-muted-foreground">
                        {oficial?.numero != null
                          ? `encontro ${oficial.numero} ${formatDiaSemanaMes(oficial.data)}`
                          : null}
                      </small>
                    </div>
                    <div className="space-y-3 @4xl:space-y-0 @4xl:divide-y @4xl:divide-border/60 @max-4xl:pt-3">
                      {duplas.map((d) => {
                        const s = saudePorId.get(d.id)!;
                        const alvo = alvos.find((a) => a.dupla_id === d.id);
                        // supervisão registrável em ativa ou pausada; com o
                        // WhatsApp sempre visível a secundária vai pro ⋮ —
                        // mesmo padrão do card de atenção da agenda (186)
                        const menu =
                          (d.status === "ativa" || d.status === "pausada") && alvo ? (
                            <AcoesSupervisor
                              alvo={alvo}
                              nomeDupla={d.mentorado.nome}
                            />
                          ) : undefined;
                        return (
                          <LinhaDupla
                            key={d.id}
                            d={d}
                            saude={s}
                            eventos={eventos}
                            mostrarSupervisor={false}
                            wa={
                              <DuplaWaAcao
                                {...acaoWhatsAppDupla({
                                  dupla: d,
                                  saude: s,
                                  hoje,
                                  ultimoNudge:
                                    nudges[d.id]?.tipo === "nudge"
                                      ? nudges[d.id]
                                      : null,
                                  meuNome,
                                  tituloNudge: "Lembrete da supervisão",
                                  origem,
                                })}
                              />
                            }
                            menu={menu}
                            i={i++}
                          />
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      )}
    </>
  );
}

/** ⋮ da linha supervisionada — "Registrar supervisão" abre o dialog
 *  controlado fora do popup (o Select interno recomeça do alvo a cada
 *  abertura — mesmo contrato do ⋯ do card de atenção da agenda). */
function AcoesSupervisor({
  alvo,
  nomeDupla,
}: {
  alvo: SupervisaoAlvo;
  nomeDupla: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          aria-label={`Mais ações da dupla de ${nomeDupla.split(" ")[0]}`}
          title="Mais ações"
          className="grid size-11 shrink-0 place-items-center rounded-xl border border-border bg-card text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:size-7 md:rounded-lg lg:size-8"
        >
          <DotsThreeVertical size={18} weight="bold" aria-hidden />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuItem onClick={() => setOpen(true)}>
            <ChatsCircle size={16} data-icon="inline-start" aria-hidden />
            Registrar supervisão
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <SupervisaoDialog alvos={[alvo]} open={open} onOpenChange={setOpen} />
    </>
  );
}

// =====================================================================
//  MENTOR DPP — "Minhas duplas" em cards enxutos
// =====================================================================

function VisaoMentor({
  lista,
  eventos,
  hoje,
  saudePorId,
  resumo,
  nivel = "h1",
}: {
  lista: Dupla[];
  eventos: CicloEvento[];
  hoje: Date;
  saudePorId: Map<string, Saude>;
  resumo: ReturnType<typeof resumoDaLista>;
  /** h1 standalone; h2 quando embutida como seção da visão híbrida. */
  nivel?: "h1" | "h2";
}) {
  const ordenadas = [...lista].sort(
    (a, b) =>
      ORDEM_SEMAFORO[saudePorId.get(a.id)!.semaforo] -
        ORDEM_SEMAFORO[saudePorId.get(b.id)!.semaforo] ||
      comparaNome(a.mentorado.nome, b.mentorado.nome)
  );

  // h1 standalone; h2 quando a visão é seção dentro da híbrida (um h1 por página)
  const Titulo = nivel;
  return (
    <>
      <header>
        <Titulo
          className={cn(
            "font-semibold tracking-tight",
            nivel === "h1" ? "text-2xl" : "text-xl"
          )}
        >
          Minhas duplas
        </Titulo>
        <ResumoLinha resumo={resumo} />
      </header>

      {lista.length === 0 ? (
        <EstadoVazio
          lista={lista}
          visao="mentor"
          podeCriar={false}
          busca=""
          filtroAtivo={false}
          onLimparBusca={() => {}}
          onLimparFiltro={() => {}}
        />
      ) : (
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          {ordenadas.map((d, idx) => {
            const s = saudePorId.get(d.id)!;
            const estado = estadoDaDupla(d, s);
            const total = totalDaTrilha(
              d.trilha,
              eventosDoCronograma(eventos, d.cronograma_id)
            );
            const feitos = d.encontros.filter(
              (e) => e.status === "realizado"
            ).length;
            const pendente = encontroPendente(d, hoje);
            // o próprio pedido de apoio não é "risco" — é um pedido já
            // recebido: o tom é "avisamos", não alarme (mesma regra da ficha)
            const apoioProprio = s.apoio.aberto && s.apoio.origem !== "mentorado";
            // pendências = os sinais que pedem ação DELE (registro, agenda,
            // combinado) — avaliação/dificuldade já são dados que ele mesmo
            // registrou, viram contexto no sinal, não tarefa
            const pends = s.sinais
              .filter((x) =>
                [
                  "limbo",
                  "registro_pendente",
                  "atraso",
                  "preventivo",
                  "encaminhamento_vencido",
                ].includes(x.tipo)
              )
              .map((x) => `${x.texto}${x.detalhe ? ` · ${x.detalhe}` : ""}`);
            return (
              <article
                key={d.id}
                style={{ "--i": Math.min(idx, 10) } as CSSProperties}
                className="animate-enter grid grid-cols-1 gap-2 rounded-xl border border-border bg-card p-3 shadow-[var(--shadow-border)]"
              >
                <header className="flex flex-wrap items-center justify-between gap-2">
                  <p className="flex min-w-0 flex-wrap items-center gap-1.5 font-semibold">
                    <DuplaAvatares mentor={d.mentor} mentorado={d.mentorado} size={28} />
                    <DuplaNomes mentor={d.mentor.nome} mentorado={d.mentorado.nome} />
                    {d.turma && (
                      <span
                        title={d.turma}
                        className="rounded border border-border px-1.5 py-px text-[11px] font-semibold text-muted-foreground"
                      >
                        {turmaLonga(d.turma)}
                      </span>
                    )}
                  </p>
                  {/* "Abrir ficha" sempre no header — nada de footer de
                      ações; a pendência ganha botão no "Próximo passo" */}
                  <span className="flex items-center gap-2">
                    {apoioProprio ? (
                      <Pill tom="atencao">
                        <span aria-hidden className="size-1.5 rounded-full bg-current" />
                        Apoio solicitado
                      </Pill>
                    ) : (
                      <Pill tom={estado.tom}>
                        <span aria-hidden className="size-1.5 rounded-full bg-current" />
                        {estado.label}
                      </Pill>
                    )}
                    <Link
                      href={`/duplas/${d.id}`}
                      className={buttonVariants({ size: "sm" })}
                    >
                      Abrir ficha
                    </Link>
                  </span>
                </header>

                {/* feito × esperado com o tick do calendário */}
                <div
                  role="img"
                  aria-label={`${feitos} encontros feitos de ${s.esperado} esperados até hoje, de ${total}`}
                >
                  <div className="relative h-2 rounded-full border border-border bg-muted">
                    <div
                      className={cn(
                        "absolute inset-y-0 left-0 rounded-l-full",
                        s.semaforo === "risco"
                          ? "bg-[var(--danger)]"
                          : s.semaforo === "atencao"
                            ? "bg-[var(--warn)]"
                            : "bg-muted-foreground"
                      )}
                      style={{
                        width: `${total > 0 ? Math.min((feitos / total) * 100, 100) : 0}%`,
                      }}
                    />
                    <span
                      aria-hidden
                      className="absolute -top-1 -bottom-1 w-0.5 -translate-x-1/2 rounded bg-foreground"
                      style={{
                        left: `${total > 0 ? Math.min((s.esperado / total) * 100, 100) : 0}%`,
                      }}
                    />
                  </div>
                  <span className="mt-1.5 block text-xs text-muted-foreground">
                    <b className="text-foreground">{feitos}</b> feitos ×{" "}
                    <b className="text-foreground">{s.esperado}</b> esperados
                  </span>
                </div>

                {/* próximo passo — a pendência ganha o botão aqui dentro:
                    o passo descrito e a ação dele moram no mesmo bloco,
                    sem faixa-footer no fim do card (v6a) */}
                <div className="flex items-start gap-2.5 rounded-[10px] bg-muted px-3 py-2.5 text-sm">
                  <Clock size={15} aria-hidden className="mt-0.5 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <span className="block text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground sm:text-[11px]">
                      Próximo passo
                    </span>
                    <b className="block">
                      {pendente
                        ? `Registrar o ${pendente.numero}º encontro`
                        : s.proximo?.data_hora
                          ? `Encontro ${s.proximo.numero}, ${formatDateTime(s.proximo.data_hora)}`
                          : d.status === "ativa"
                            ? "Agendar o próximo encontro"
                            : estado.label}
                    </b>
                    {pendente && (
                      <Link
                        href={`/duplas/${d.id}#registrar-${pendente.id}`}
                        className={cn(buttonVariants({ size: "sm" }), "mt-2")}
                      >
                        Registrar encontro {pendente.numero}
                      </Link>
                    )}
                  </div>
                </div>

                {/* pendências dele */}
                <div>
                  <span className="block text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground sm:text-[11px]">
                    Pendências
                  </span>
                  <ul className="mt-1 grid gap-1 text-sm">
                    {pends.length === 0 && !apoioProprio ? (
                      <li className="flex items-start gap-2 text-[var(--ok-text)]">
                        <span aria-hidden className="mt-1">✓</span>
                        Nada seu pendente
                      </li>
                    ) : (
                      <>
                        {pends.map((p, j) => (
                          <li key={j} className="flex items-start gap-2 text-[var(--warn-text)]">
                            <Clock size={14} aria-hidden className="mt-0.5 shrink-0" />
                            {p}
                          </li>
                        ))}
                        {apoioProprio && (
                          <li className="flex items-start gap-2 text-muted-foreground">
                            <Lifebuoy size={14} aria-hidden className="mt-0.5 shrink-0" />
                            Apoio solicitado. A coordenação entra em contato com você
                          </li>
                        )}
                      </>
                    )}
                  </ul>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </>
  );
}

// =====================================================================
//  MENTOR ESPECIALISTA — "Minhas trilhas" (passos 1–5 + prazo)
// =====================================================================

function VisaoEspecialista({
  lista,
  hoje,
  saudePorId,
  resumo,
  espEventos,
  nivel = "h1",
}: {
  lista: Dupla[];
  hoje: Date;
  saudePorId: Map<string, Saude>;
  resumo: ReturnType<typeof resumoDaLista>;
  espEventos: EspecialistaEvento[];
  /** h1 standalone; h2 quando embutida como seção da visão híbrida. */
  nivel?: "h1" | "h2";
}) {
  const ordenadas = [...lista].sort((a, b) =>
    comparaNome(a.mentorado.nome, b.mentorado.nome)
  );

  // h1 standalone; h2 quando a visão é seção dentro da híbrida (um h1 por página)
  const Titulo = nivel;
  return (
    <>
      <header>
        <Titulo
          className={cn(
            "font-semibold tracking-tight",
            nivel === "h1" ? "text-2xl" : "text-xl"
          )}
        >
          Minhas trilhas
        </Titulo>
        <ResumoLinha resumo={resumo} />
      </header>

      {lista.length === 0 ? (
        <EstadoVazio
          lista={lista}
          visao="especialista"
          podeCriar={false}
          busca=""
          filtroAtivo={false}
          onLimparBusca={() => {}}
          onLimparFiltro={() => {}}
        />
      ) : (
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          {ordenadas.map((d, idx) => {
            const s = saudePorId.get(d.id)!;
            const realizados = new Set(
              d.encontros
                .filter((e) => e.status === "realizado")
                .map((e) => e.numero)
            );
            const total = espEventos.length || 5;
            const atual = Array.from(
              { length: total },
              (_, i) => i + 1
            ).find((n) => !realizados.has(n));
            const prazo = prazoTrilhaEspecialista(d.iniciada_em, hoje);
            return (
              <article
                key={d.id}
                style={{ "--i": Math.min(idx, 10) } as CSSProperties}
                className="animate-enter grid gap-2 rounded-xl border border-border bg-card p-3 shadow-[var(--shadow-border)]"
              >
                <header className="flex flex-wrap items-center justify-between gap-2">
                  {/* a trilha é dela × o jovem — ela é a constante, o nome da
                      linha é o mentorado (dot amarelo = papel dele) */}
                  <p className="flex min-w-0 flex-wrap items-center gap-1.5 font-semibold">
                    <span
                      aria-hidden
                      className="size-2.5 shrink-0 rounded-full bg-[var(--role-mentorado)] ring-1 ring-black/10"
                    />
                    <span>{d.mentorado.nome}</span>
                    {d.turma && (
                      <span
                        title={d.turma}
                        className="rounded border border-border px-1.5 py-px text-[11px] font-semibold text-muted-foreground"
                      >
                        {turmaLonga(d.turma)}
                      </span>
                    )}
                  </p>
                  {/* "Abrir trilha" é a única ação do card — inline no
                      header, sem footer de botão solto embaixo */}
                  <span className="flex items-center gap-2">
                    <Pill tom={d.status === "ativa" ? "ok" : "pausa"}>
                      <span aria-hidden className="size-1.5 rounded-full bg-current" />
                      {d.status === "ativa"
                        ? "Trilha ativa"
                        : (STATUS_LABEL[d.status]?.label ?? d.status)}
                    </Pill>
                    <Link
                      href={`/duplas/${d.id}`}
                      className={buttonVariants({ size: "sm" })}
                    >
                      Abrir trilha
                    </Link>
                  </span>
                </header>

                {/* o tema que originou a trilha */}
                {d.demanda && (
                  <p className="text-sm font-medium">{d.demanda}</p>
                )}

                {/* os 5 passos do guia */}
                <div>
                  <ol className="mb-1.5 flex gap-1.5">
                    {espEventos.map((ev) => {
                      const done = realizados.has(ev.numero);
                      const cur = ev.numero === atual && d.status === "ativa";
                      return (
                        <li
                          key={ev.numero}
                          title={ev.titulo}
                          aria-label={
                            done
                              ? `Sessão ${ev.numero} (${ev.titulo}) concluída`
                              : cur
                                ? `Sessão ${ev.numero} (${ev.titulo}) atual`
                                : `Sessão ${ev.numero} (${ev.titulo}) pendente`
                          }
                          className={cn(
                            "grid h-7 flex-1 place-items-center rounded-lg border text-xs font-bold",
                            done
                              ? "border-[var(--ok)] bg-[var(--ok)] text-white"
                              : cur
                                ? "border-2 border-[var(--foreground)] bg-card text-foreground"
                                : "border-border bg-card text-muted-foreground"
                          )}
                        >
                          {done ? "✓" : ev.numero}
                        </li>
                      );
                    })}
                  </ol>
                  <p className="text-xs text-muted-foreground">
                    <b className="text-foreground">
                      Sessão {atual ?? total} de {total}
                    </b>{" "}
                    · {realizados.size} concluída
                    {realizados.size === 1 ? "" : "s"}
                    {atual ? ` · a ${atual}ª ${s.proximo ? "agendada" : "a marcar"}` : ""}
                  </p>
                </div>

                {/* próxima sessão */}
                <div className="flex items-start gap-2.5 rounded-[10px] bg-muted px-3 py-2.5 text-sm">
                  <Clock size={15} aria-hidden className="mt-0.5 shrink-0" />
                  <div>
                    <span className="block text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground sm:text-[11px]">
                      Próxima sessão
                    </span>
                    <b className="block">
                      {s.proximo?.data_hora
                        ? formatDateTime(s.proximo.data_hora)
                        : "a combinar com o mentorado"}
                    </b>
                  </div>
                </div>

                {/* prazo da trilha — o marco de 3 meses do guia (não é
                    deadline dura: é o sinal pra revisar/fechar) */}
                {prazo && (
                  <p className="flex items-start gap-2 text-sm">
                    <Clock size={15} aria-hidden className="mt-0.5 shrink-0" />
                    <span>
                      {prazo.estado === "passou" ? (
                        <>
                          <b>3 meses completos</b> · o guia sugere fechar com
                          devolutiva
                        </>
                      ) : (
                        <>
                          <b>Prazo da trilha: até {formatDiaMes(prazo.fim)}</b>{" "}
                          · ~3 meses desde o aceite
                        </>
                      )}
                    </span>
                  </p>
                )}
              </article>
            );
          })}
        </div>
      )}
    </>
  );
}
