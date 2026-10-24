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
  lembreteBloqueadoAte,
  ORDEM_SEMAFORO,
  saudadeDaDupla,
  toDateStr,
  totalDaTrilha,
  TRILHA_LABEL,
  ultimoRegistro,
} from "@/lib/ciclo";
import { prazoTrilhaEspecialista } from "@/lib/encerramento";
import { rotuloDiaAgenda } from "@/lib/agenda-minha";
import { msgsContato } from "@/lib/whatsapp-msgs";
import type { Interacao } from "@/lib/interacoes";
import type { SupervisaoAlvo } from "@/lib/queries-supervisao";
import type {
  CicloEvento,
  Dupla,
  EspecialistaEvento,
} from "@/lib/types";
import { cn, normaliza } from "@/lib/utils";
import { DuplaAvatares } from "@/components/dupla-avatares";
import { DuplaNomes } from "@/components/dupla-nomes";
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
  risco: "bg-[var(--danger)]/10 text-[var(--danger)]",
  atencao: "bg-[var(--warn)]/20 text-[var(--warn-text)]",
  ok: "bg-[var(--ok)]/15 text-[var(--ok-text)]",
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
  ok: { label: "Em andamento", tom: "ok" },
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

/** "último encontro há 26 dias" — a recência que fecha a coluna de sinais. */
function recenciaUltimo(d: Dupla, hojeStr: string): string | null {
  const u = ultimoRealizado(d);
  if (!u) return null;
  const rel = haDiasTxt(u.realizado_em ?? u.data_hora, hojeStr);
  return rel ? `último encontro ${rel}` : null;
}

/** Pendência de registro apontável — agendado já passado sem registro ou
 *  realizado sem registro. É o destino do "Registrar encontro N". */
function encontroPendente(d: Dupla, hoje: Date) {
  return [...d.encontros]
    .sort((a, b) => a.numero - b.numero)
    .find(
      (e) =>
        !e.registro &&
        (e.status === "realizado" ||
          (e.status === "agendado" &&
            e.data_hora != null &&
            new Date(e.data_hora) < hoje))
    );
}

/** A linha de sinais da coluna: cada critério aceso com seu detalhe,
 *  mais a recência do último encontro; "jornada em dia" quando nada aceso.
 *  Fora da régua (pausada/concluída/encerrada) s.sinais é [] por definição —
 *  o texto é o rótulo do status em saude.motivos, nunca um "em dia" que
 *  contradiz a pill ao lado. */
function textoSinais(d: Dupla, saude: Saude, hojeStr: string) {
  const partes =
    d.status !== "ativa"
      ? [...saude.motivos]
      : saude.sinais.map(
          (s) =>
            s.texto +
            (s.detalhe ? (s.detalhe.startsWith("há") ? ` ${s.detalhe}` : ` (${s.detalhe})`) : "")
        );
  if (partes.length === 0) {
    partes.push(saude.proximo ? "em dia" : "em dia, nada agendado");
    if (saude.proximo)
      partes.push(`próximo ${formatDateTime(saude.proximo.data_hora)}`);
  }
  const rec = recenciaUltimo(d, hojeStr);
  if (rec) partes.push(rec);
  return partes;
}

const APOIO_ORIGEM_LABEL = {
  mentor: "pedido pelo mentor",
  mentorado: "pedido pelo mentorado",
  ambos: "pedido pelo mentor e pelo mentorado",
} as const;

// ---------- a linha densa (v1 → v5) ----------

const GRID_COLS =
  "lg:grid-cols-[96px_minmax(190px,1.2fr)_minmax(140px,0.85fr)_minmax(195px,1.35fr)_120px_minmax(118px,0.55fr)]";

function LinhaDupla({
  d,
  saude,
  eventos,
  hojeStr,
  mostrarSupervisor,
  wa,
  menu,
  i,
}: {
  d: Dupla;
  saude: Saude;
  eventos: CicloEvento[];
  hojeStr: string;
  mostrarSupervisor: boolean;
  /** ação WhatsApp sempre visível — "Lembrar" onde há pendência apontável
   *  em dupla ativa, "Chamar" nas demais (o DuplaWaAcao resolve o resto:
   *  menu ▾, cap 48h, sem telefone). */
  wa: React.ReactNode;
  /** menu ⋮ das ações secundárias do papel — ex.: "Registrar supervisão"
   *  (auxiliar). A coord não tem secundária: a linha fica WA + Ver ficha. */
  menu?: React.ReactNode;
  i: number;
}) {
  const estado = estadoDaDupla(d, saude);
  const feitos = d.encontros.filter((e) => e.status === "realizado").length;
  const total = totalDaTrilha(
    d.trilha,
    eventosDoCronograma(eventos, d.cronograma_id)
  );
  const ehEsp = d.trilha === "especialista";
  const esperadoPct = !ehEsp && total > 0 ? Math.min(saude.esperado / total, 1) : null;
  const realizados = new Set(
    d.encontros.filter((e) => e.status === "realizado").map((e) => e.numero)
  );
  const ultimoReg = ultimoRegistro(d);
  const encontroDoReg = ultimoReg
    ? d.encontros.find((e) => e.registro?.id === ultimoReg.id)
    : null;
  const sinais = textoSinais(d, saude, hojeStr);
  const recencia = recenciaUltimo(d, hojeStr);
  const apoioTxt = saude.apoio.aberto
    ? `apoio aberto (${APOIO_ORIGEM_LABEL[saude.apoio.origem ?? "mentor"]})`
    : null;
  // o texto completo vai pro title — a linha nunca quebra a altura da
  // tabela; o detalhe integral vive na ficha (title é a degradação desktop)
  const tituloSinais = [apoioTxt, sinais.join(" · ")]
    .filter(Boolean)
    .join(" · ");
  const tomSinais =
    estado.tom === "risco"
      ? "text-[hsl(0_62%_36%)]"
      : estado.tom === "atencao"
        ? "text-[var(--warn-text)]"
        : d.status !== "ativa"
          ? "text-muted-foreground"
          : "text-foreground/80";
  // cor dos segmentos preenchidos — segue o semáforo da linha (mock:
  // .s-risco/.s-atencao/.s-pausa recolorem os "on", não a trilha inteira)
  const segOn =
    estado.tom === "risco"
      ? "bg-[var(--danger)] shadow-none"
      : estado.tom === "atencao"
        ? "bg-[var(--warn)] shadow-none"
        : d.status !== "ativa"
          ? "bg-muted-foreground/40 shadow-none"
          : "bg-[var(--ok)] shadow-none";

  return (
    <div
      style={{ "--i": Math.min(i, 10) } as CSSProperties}
      className={cn(
        "animate-enter transition-colors",
        // mobile: card wrap — pílulas e ações no TOPO (order), conteúdo
        // embaixo. Nunca uma faixa de ações no fim do card (a faixa-footer
        // morta que o Léo marcou no screenshot)
        "flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-border bg-card p-3",
        // desktop: a grade densa (as orders viram grid em ordem de DOM)
        "lg:grid lg:items-center lg:gap-x-4 lg:gap-y-0 lg:rounded-none lg:border-0 lg:px-5 lg:py-2.5 lg:hover:bg-muted/50",
        GRID_COLS,
        saude.apoio.aberto && "bg-[var(--info-bg)]/60 lg:hover:bg-[var(--info-bg)]"
      )}
    >
      {/* estado + apoio (eixo separado — pill azul sobre o estado real) */}
      <div className="order-1 flex flex-wrap items-center gap-1.5 lg:order-none lg:flex-col lg:items-start lg:gap-1">
        <Pill tom={estado.tom}>
          <span aria-hidden className="size-1.5 rounded-full bg-current" />
          {estado.label}
        </Pill>
        {saude.apoio.aberto && (
          <Link
            href={`/duplas/${d.id}`}
            className="rounded-full focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <Pill tom="apoio">
              <Lifebuoy size={12} aria-hidden />
              Apoio
            </Pill>
          </Link>
        )}
      </div>

      {/* ações consolidadas: WhatsApp sempre + ⋮ quando há secundária +
          "Ver ficha". No mobile ficam no topo à direita; no desktop a
          célula empilha WA sobre [⋮ + Ver ficha] — ~2 linhas de altura
          dentro da própria linha, sem faixa-footer */}
      <div className="order-2 ml-auto flex items-center gap-1.5 lg:order-6 lg:ml-0 lg:flex-col lg:items-end lg:justify-center lg:gap-0.5">
        {wa}
        <span className="contents lg:flex lg:items-center lg:gap-1 lg:justify-end">
          {menu}
          <Link
            href={`/duplas/${d.id}`}
            aria-label={`Ver ficha da dupla de ${d.mentorado.nome.split(" ")[0]}`}
            title="Ver ficha"
            className="inline-grid size-11 shrink-0 place-items-center rounded-xl border border-border bg-card text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 md:size-auto md:h-8 md:min-w-0 md:rounded-lg md:border-0 md:bg-transparent md:px-1.5 md:text-xs md:font-semibold md:text-foreground/80 md:hover:bg-muted md:hover:text-foreground lg:h-auto lg:py-0.5"
          >
            <span className="hidden md:inline whitespace-nowrap">Ver ficha ›</span>
            <CaretRight size={15} weight="bold" aria-hidden className="md:hidden" />
          </Link>
        </span>
      </div>

      {/* a dupla */}
      <div className="order-3 flex min-w-0 basis-full items-center gap-2.5 lg:order-none lg:basis-auto">
        <DuplaAvatares mentor={d.mentor} mentorado={d.mentorado} size={32} />
        <div className="min-w-0">
          <p className="flex min-w-0 items-center gap-1 text-sm font-semibold">
            <DuplaNomes truncar mentor={d.mentor.nome} mentorado={d.mentorado.nome} />
            {ehEsp && (
              <span className="shrink-0 rounded-full bg-muted px-1.5 py-px text-[10px] font-medium text-muted-foreground">
                {TRILHA_LABEL[d.trilha]}
              </span>
            )}
          </p>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">
            {[
              d.turma || null,
              mostrarSupervisor &&
                (d.supervisor ? `sup. ${d.supervisor.nome}` : "sem supervisor"),
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>
      </div>

      {/* encontros em segmentos 1–N — cada quadrado é um encontro do
          ciclo; o traço marca onde o calendário da turma já esperava
          estar. "4/16" nunca aparece como texto solto (mock v6a) */}
      <div className="order-4 min-w-0 basis-full max-w-md lg:order-none lg:basis-auto lg:max-w-none">
        <div className="mb-1 flex items-baseline justify-between text-[11px] text-muted-foreground">
          <b className="text-xs font-semibold text-foreground">
            {feitos} de {total}
          </b>
          <span>
            {d.status === "pausada"
              ? "em pausa"
              : ehEsp
                ? "sessões"
                : `esperado: ${saude.esperado}`}
          </span>
        </div>
        <div className="relative">
          <div
            role="img"
            aria-label={`${feitos} de ${total} encontros realizados${
              esperadoPct != null ? `, esperados ${saude.esperado} até hoje` : ""
            }`}
            className="flex h-2 gap-px"
          >
            {Array.from({ length: total }, (_, n) => (
              <span
                key={n}
                className={cn(
                  "min-w-0 flex-1 rounded-[2px] bg-muted shadow-[inset_0_0_0_1px_hsl(75_6%_84%)]",
                  realizados.has(n + 1) && segOn
                )}
              />
            ))}
          </div>
          {/* o traço do esperado só corre em dupla ativa — fora da régua
              não existe "onde o calendário esperava estar". O -translate-x-1/2
              centraliza o marcador na posição (sem ele o tick sobrava 2px
              pra direita do ponto real) */}
          {esperadoPct != null && d.status === "ativa" && (
            <span
              aria-hidden
              className="absolute -top-1 -bottom-1 w-0.5 -translate-x-1/2 rounded bg-foreground/50"
              style={{ left: `${esperadoPct * 100}%` }}
            />
          )}
        </div>
      </div>

      {/* sinais — todos os critérios acesos, com recência; sempre 1 linha
          (title carrega o texto inteiro, a ficha tem o detalhe) */}
      <div
        className={cn(
          "order-5 min-w-0 basis-[55%] text-[11px] leading-normal lg:order-none lg:basis-auto",
          tomSinais
        )}
      >
        <p className="truncate" title={tituloSinais}>
          {/* texto integral pro leitor de tela — o truncate é só visual e
              o title não chega em toque/teclado */}
          <span className="sr-only">{tituloSinais}</span>
          <span aria-hidden>
            {apoioTxt && (
              <span className="font-medium text-[var(--info-text)]">
                {apoioTxt}
                {" · "}
              </span>
            )}
            {sinais.map((parte, j) => (
              <span key={j}>
                {j > 0 && " · "}
                <span className={j === sinais.length - 1 && recencia ? "text-muted-foreground" : undefined}>
                  {parte}
                </span>
              </span>
            ))}
          </span>
        </p>
      </div>

      {/* última avaliação do mentor */}
      <div
        className={cn(
          "order-6 ml-auto flex items-center gap-2 lg:order-none lg:ml-0 lg:flex-col lg:items-start lg:gap-1",
          d.status !== "ativa" && "opacity-60"
        )}
      >
        {ultimoReg?.avaliacao ? (
          <>
            <AvaliacaoBadge avaliacao={ultimoReg.avaliacao} />
            <span className="text-[11px] leading-tight text-muted-foreground">
              nota do mentor
              {encontroDoReg ? ` · ${encontroDoReg.numero}º encontro` : ""}
            </span>
          </>
        ) : (
          <span className="text-[11px] text-muted-foreground/70">—</span>
        )}
      </div>
    </div>
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
      className="animate-enter grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 border-t border-border/60 px-3 py-2 text-[13px] lg:grid-cols-[minmax(190px,1.4fr)_150px_minmax(150px,1fr)_auto_auto] lg:px-5 lg:py-2.5"
    >
      <span className="flex min-w-0 items-center gap-1.5 font-medium">
        <DuplaNomes truncar mentor={d.mentor.nome} mentorado={d.mentorado.nome} />
        {d.turma && (
          <span className="rounded border border-border px-1 text-[10px] font-bold text-muted-foreground">
            {d.turma}
          </span>
        )}
      </span>
      <span className="hidden items-center gap-1.5 lg:inline-flex">
        {/* mini-barra com o tick do esperado — substitui o "7×7 em dia"
            solto (mock: .m-prog); o número fica no texto ao lado */}
        <span
          role="img"
          aria-label={`${feitos} de ${total} encontros realizados`}
          className="relative h-1.5 w-14 rounded-full bg-muted"
        >
          <span
            aria-hidden
            className="absolute inset-y-0 left-0 rounded-full bg-[var(--ok)]"
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
        <span className="whitespace-nowrap text-xs font-semibold text-[var(--ok-text)]">
          {feitos}/{total} · esp. {saude.esperado}
        </span>
      </span>
      <span className="hidden truncate text-xs text-muted-foreground lg:inline">
        {rec}
      </span>
      {/* no desktop o span some (lg:contents) e WA+ficha ocupam as duas
          colunas `auto` do fim do grid; no mobile ele é a célula de
          ações inteira (nomes à esquerda, ações à direita) */}
      <span className="flex items-center gap-1.5 lg:contents">
        {wa}
        <Link
          href={`/duplas/${d.id}`}
          aria-label={`Ver ficha da dupla de ${d.mentorado.nome.split(" ")[0]}`}
          title="Ver ficha"
          className="inline-grid size-11 shrink-0 place-items-center rounded-xl border border-border bg-card text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 md:size-auto md:h-8 md:rounded md:border-0 md:bg-transparent md:px-1 md:py-1 md:text-xs md:font-semibold md:hover:bg-muted md:hover:text-foreground lg:h-7 lg:py-0.5"
        >
          <span className="hidden md:inline whitespace-nowrap">Ver ficha ›</span>
          <CaretRight size={15} weight="bold" aria-hidden className="md:hidden" />
        </Link>
      </span>
    </div>
  );
}

/** O header de coluna da tabela densa — coord e auxiliar compartilham a
 *  mesma régua. O `title` no "Feito × esperado" carrega a única explicação
 *  que a antiga legenda `<details>` tinha a mais que os chips de categoria:
 *  o traço na barra = esperado do calendário. */
function CabecalhoColunas() {
  return (
    <div
      aria-hidden
      className={cn(
        "hidden border-b border-border px-5 py-2.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground lg:grid lg:gap-x-4",
        GRID_COLS
      )}
    >
      <span>Status</span>
      <span>Dupla</span>
      <span title="Cada quadrado é um encontro do ciclo; o traço marca quantos o calendário da turma já esperava até hoje">
        Encontros
      </span>
      <span>Sinais</span>
      <span>Avaliação do mentor</span>
      <span />
    </div>
  );
}

// ---------- chips de categoria com régua (a assinatura da v1) ----------

type FiltroCat = "todas" | "risco" | "atencao" | "andamento" | "pausada" | "apoio";

const CATS: { id: FiltroCat; nome: string; regua: string; dot: string | null }[] = [
  { id: "todas", nome: "Todas", regua: "todas as duplas do ciclo, em qualquer estado", dot: "bg-[var(--brand-lime)]" },
  { id: "risco", nome: "Em risco", regua: "2+ encontros atrasados, ou avaliação baixa + dificuldade", dot: "bg-[var(--danger)]" },
  { id: "atencao", nome: "Atenção", regua: "1 atraso, avaliação baixa, dificuldade ou pendência de registro/encaminhamento", dot: "bg-[var(--warn)]" },
  { id: "andamento", nome: "Em andamento", regua: "jornada dentro do previsto, sem pendências", dot: "bg-[var(--ok)]" },
  { id: "pausada", nome: "Pausadas", regua: "jornada congelada — sem encontros nem cobrança", dot: "bg-muted-foreground/50" },
];

function chipBate(f: FiltroCat, d: Dupla, s: Saude): boolean {
  switch (f) {
    case "todas":
      return true;
    case "risco":
      return s.semaforo === "risco";
    case "atencao":
      return s.semaforo === "atencao";
    case "andamento":
      return d.status === "ativa" && s.semaforo === "ok";
    case "pausada":
      return d.status === "pausada";
    case "apoio":
      return s.apoio.aberto;
  }
}

function CatChip({
  cat,
  n,
  ativo,
  onClick,
}: {
  cat: (typeof CATS)[number];
  n: number;
  ativo: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={ativo}
      onClick={onClick}
      className={cn(
        "flex min-h-11 flex-1 basis-[150px] flex-col gap-1 rounded-xl border p-3 text-left transition-[border-color,transform] hover:-translate-y-px hover:border-[var(--input)] focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
        ativo
          ? "border-foreground bg-foreground text-background shadow-md"
          : "border-border bg-card"
      )}
    >
      <span className="flex items-center gap-1.5">
        {cat.dot && (
          <span aria-hidden className={cn("size-2 shrink-0 rounded-full", cat.dot)} />
        )}
        <span className="text-sm font-semibold">{cat.nome}</span>
        <span
          className={cn(
            "ml-auto rounded-full px-2 py-0.5 text-[11px] font-bold tabular-nums",
            ativo ? "bg-background/15 text-background" : "bg-muted text-muted-foreground"
          )}
        >
          {n}
        </span>
      </span>
      <span
        className={cn(
          "text-xs leading-snug",
          ativo ? "text-background/60" : "text-muted-foreground"
        )}
      >
        {cat.regua}
      </span>
    </button>
  );
}

// ---------- cabeçalho + resumo vivo ----------

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
    cont.andamento > 0 && { texto: `${cont.andamento} em andamento` },
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

// ---------- resumo agregado no topo (v6a: .sum) ----------

/** Barra proporcional do semáforo + posição de cada turma no cronograma.
 *  Na coordenação os segmentos são botões que filtram a lista (espelham os
 *  chips de categoria); na auxiliar ficam informativos — ela não tem chips.
 *  Concluída/encerrada somam na barra mas não filtram: não existe chip
 *  "encerrada" pra espelhar. */
function ResumoSemaforo({
  lista,
  saudePorId,
  eventos,
  hojeStr,
  titulo,
  onFiltrar,
}: {
  lista: Dupla[];
  saudePorId: Map<string, Saude>;
  eventos: CicloEvento[];
  hojeStr: string;
  /** "Semáforo — 26 duplas" · "Semáforo — 6 supervisionadas" */
  titulo: string;
  onFiltrar?: (cat: FiltroCat) => void;
}) {
  const cont = { risco: 0, atencao: 0, andamento: 0, pausada: 0, concluida: 0, encerrada: 0, apoio: 0 };
  for (const d of lista) {
    const s = saudePorId.get(d.id)!;
    if (s.apoio.aberto) cont.apoio++;
    if (d.status === "ativa")
      cont[s.semaforo === "ok" ? "andamento" : s.semaforo]++;
    else if (d.status === "pausada") cont.pausada++;
    else if (d.status === "concluida") cont.concluida++;
    else cont.encerrada++;
  }

  const segs = [
    { n: cont.risco, cls: "bg-[var(--danger)]", dot: "bg-[var(--danger)]", label: `${cont.risco} em risco`, cat: "risco" as const },
    { n: cont.atencao, cls: "bg-[var(--warn)]", dot: "bg-[var(--warn)]", label: `${cont.atencao} em atenção`, cat: "atencao" as const },
    { n: cont.andamento, cls: "bg-[var(--ok)]", dot: "bg-[var(--ok)]", label: `${cont.andamento} em andamento`, cat: "andamento" as const },
    { n: cont.pausada, cls: "bg-muted-foreground/50", dot: "bg-muted-foreground/50", label: `${cont.pausada} pausada${cont.pausada > 1 ? "s" : ""}`, cat: "pausada" as const },
    { n: cont.concluida, cls: "bg-muted-foreground/40", dot: "bg-muted-foreground/40", label: `${cont.concluida} concluída${cont.concluida > 1 ? "s" : ""}`, cat: null },
    { n: cont.encerrada, cls: "bg-muted-foreground/30", dot: "bg-muted-foreground/30", label: `${cont.encerrada} encerrada${cont.encerrada > 1 ? "s" : ""}`, cat: null },
  ].filter((s) => s.n > 0);

  // posição de cada turma no próprio cronograma — encontros que o
  // calendário já esperava até hoje (T2 começa depois e não é atraso)
  const porCron = new Map<string, { turma: string; n: number; evs: CicloEvento[] }>();
  for (const d of lista) {
    if (!d.cronograma_id) continue; // trilha especialista não corre o calendário
    const g = porCron.get(d.cronograma_id);
    if (g) g.n++;
    else
      porCron.set(d.cronograma_id, {
        turma: d.turma || "Sem turma",
        n: 1,
        evs: eventosDoCronograma(eventos, d.cronograma_id),
      });
  }
  const crons = [...porCron.values()].map((g) => {
    const esperados = g.evs.filter(
      (e) => e.tipo === "encontro" && e.data != null && e.data <= hojeStr
    ).length;
    const total = g.evs.filter((e) => e.tipo === "encontro").length;
    const inicio = g.evs
      .filter((e) => e.data != null)
      .map((e) => e.data as string)
      .sort()[0];
    return { ...g, esperados, total, inicio: inicio ?? null };
  });
  crons.sort((a, b) => a.turma.localeCompare(b.turma, "pt-BR"));
  const primeiroInicio = crons
    .map((c) => c.inicio)
    .filter((v): v is string => v != null)
    .sort()[0];
  // "T2 começou N semanas depois" — o contexto que impede ler defasagem
  // como atraso
  const notasAtraso: string[] = [];
  if (primeiroInicio) {
    for (const c of crons) {
      if (!c.inicio) continue;
      const dias = diffDias(c.inicio, primeiroInicio);
      if (dias >= 7)
        notasAtraso.push(
          `${c.turma} começou ${Math.round(dias / 7)} sem. depois — não é atraso`
        );
    }
  }

  const labelBarra = `${lista.length} ${lista.length === 1 ? "dupla" : "duplas"}: ${segs.map((s) => s.label).join(", ")}`;

  return (
    <section
      aria-label="Resumo do semáforo e do cronograma"
      className="mt-5 grid gap-2.5 rounded-xl border border-border bg-card px-4 py-3 sm:grid-cols-[minmax(0,1.55fr)_minmax(230px,0.9fr)] sm:gap-x-6"
    >
      <div className="min-w-0">
        <div className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-0.5 text-[11px] font-bold uppercase tracking-[0.05em] text-muted-foreground">
          <span>{titulo}</span>
          {cont.apoio > 0 && (
            <span className="inline-flex items-center gap-1 font-semibold normal-case tracking-normal text-[var(--info-text)]">
              <Lifebuoy size={12} aria-hidden />+ {cont.apoio} apoio aberto
              (eixo separado)
            </span>
          )}
        </div>
        {/* o resumo da barra vive em texto sr-only (a linha de legenda
            abaixo agrega o mesmo pros olhos) — role="img" no container
            interativo podava os segmentos da árvore mas eles seguiam
            focáveis: o teclado pousava em controle sem nome */}
        <span className="sr-only">{labelBarra}</span>
        <div className="mt-1.5 flex h-5 gap-0.5 overflow-hidden rounded-full">
          {segs.map((seg) =>
            seg.cat && onFiltrar ? (
              <button
                key={seg.label}
                type="button"
                onClick={() => seg.cat && onFiltrar(seg.cat)}
                aria-label={`${seg.label} — filtrar a lista`}
                title={`${seg.label} — filtrar a lista`}
                style={{ flexGrow: seg.n }}
                className={cn(
                  "grid min-w-5 place-items-center text-[10px] font-bold text-white transition-[filter] hover:brightness-110 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                  seg.cls
                )}
              >
                {seg.n}
              </button>
            ) : (
              <span
                key={seg.label}
                aria-hidden
                title={seg.label}
                style={{ flexGrow: seg.n }}
                className={cn(
                  "grid min-w-5 place-items-center text-[10px] font-bold text-white",
                  seg.cls
                )}
              >
                {seg.n}
              </span>
            )
          )}
        </div>
        <p className="mt-1.5 flex flex-wrap gap-x-3.5 gap-y-0.5 text-[11px] text-muted-foreground">
          {segs.map((seg) => (
            <span key={seg.label}>
              <span
                aria-hidden
                className={cn("mr-1 inline-block size-2 rounded-full", seg.dot)}
              />
              <b className="font-semibold text-foreground">{seg.n}</b>{" "}
              {seg.label.replace(/^\d+ /, "")}
            </span>
          ))}
        </p>
      </div>
      {crons.length > 0 && (
        <div className="grid min-w-0 content-center gap-1.5 sm:border-l sm:border-border sm:pl-5">
          {crons.map((c) => (
            <span
              key={c.turma}
              className="flex items-center gap-2 text-xs text-muted-foreground"
            >
              <span className="font-bold text-foreground">{c.turma}</span>
              encontro{" "}
              <b className="font-semibold text-foreground">
                {c.esperados} de {c.total}
              </b>
              <span className="relative h-[7px] max-w-28 flex-1 overflow-hidden rounded-full bg-muted">
                <span
                  aria-hidden
                  className="absolute inset-y-0 left-0 rounded-full bg-[var(--ok)]"
                  style={{
                    width: `${c.total > 0 ? Math.min((c.esperados / c.total) * 100, 100) : 0}%`,
                  }}
                />
              </span>
              {c.n} {c.n === 1 ? "dupla" : "duplas"}
            </span>
          ))}
          {notasAtraso.map((n) => (
            <span key={n} className="text-[11px] text-muted-foreground">
              {n}
            </span>
          ))}
        </div>
      )}
    </section>
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

// ---------- nudge da coordenação ----------

function casoLembrete(
  d: Dupla,
  s: Saude,
  hoje: Date,
  origem?: string
): string {
  // pedido de apoio do mentor: responde o pedido antes da régua (a mesma
  // prioridade do card do dashboard) — o do jovem nem chega aqui: troca
  // a ponta inteira no waAcaoDaDupla
  if (s.pediuApoio)
    return "Vi seu pedido de apoio no registro. O que está rolando? Pode contar comigo.";
  const pendente = encontroPendente(d, hoje);
  // o texto vai pro WhatsApp e pra notificação — path relativo ali é texto
  // morto: o link só entra ABSOLUTO (origem = proto+host via headers na
  // page, mesma técnica do dashboard); sem origem, omite o trecho
  const link =
    pendente && origem
      ? `${origem}/duplas/${d.id}#registrar-${pendente.id}`
      : null;
  const tipo = s.sinais[0]?.tipo;
  if (pendente?.status === "agendado")
    return `O ${pendente.numero}º encontro estava agendado e já passou. Rolou?${
      link
        ? ` Se rolou, o registro é por aqui: ${link}`
        : " Se rolou, o registro é na ficha da dupla."
    }`;
  if (tipo === "registro_pendente")
    return `Vi que o último encontro rolou, mas ainda falta o registro. Consegue preencher hoje?${link ? ` É direto por aqui: ${link}` : ""}`;
  if (tipo === "atraso")
    return "Os encontros estão atrasados. Posso ajudar a replanejar?";
  if (tipo === "preventivo")
    return "O próximo encontro do calendário já está perto e ainda não foi agendado. Posso ajudar a encaixar?";
  return "Vi que o último encontro teve pontos de atenção. Posso ajudar em algo?";
}

/** O WhatsApp sempre visível da linha (v6a): "Lembrar" só onde há
 *  pendência apontável em dupla ativa — aí é nudge de verdade
 *  (notificação + wa.me, cap 48h). Toda as outras — em dia, pausada,
 *  encerrada — viram "Chamar": contato direto, sem sino e sem cap.
 *  A mesma mensagem serve de notificação, wa.me, cópia e "ver texto".
 *  O destino é por contexto: pendência operacional vai pro mentor (a
 *  operação é dever dele — o mentorado nunca é cobrado por agendar ou
 *  registrar), mas o pedido de apoio do JOVEM troca a ponta inteira —
 *  pode ser sobre o próprio mentor, então a resposta é chamar ele com a
 *  mensagem `apoio_jovem` (o caso que a fila-acompanhar sempre tratou). */
function waAcaoDaDupla({
  d,
  s,
  hoje,
  ultimoNudge,
  meuNome,
  tituloNudge,
  origem,
}: {
  d: Dupla;
  s: Saude;
  hoje: Date;
  /** última interação `nudge` da dupla — alimenta o cap de 48h */
  ultimoNudge: Interacao | null;
  /** primeiro nome de quem opera — assina o texto */
  meuNome?: string;
  /** título da notificação do Lembrar (coord × supervisão) */
  tituloNudge: string;
  /** proto+host do deploy — monta o link absoluto dentro do texto do
   *  lembrete; sem ele o trecho de link sai da mensagem */
  origem?: string;
}) {
  // pedido de apoio que partiu do jovem (avaliacao_jovem.pedir_apoio) —
  // origem "ambos" também resolve pra ele: o canal de segurança do jovem
  // é o que não pode esperar
  const apoioJovem =
    s.apoio.aberto &&
    (s.apoio.origem === "mentorado" || s.apoio.origem === "ambos");
  const nomeMentorado = d.mentorado.nome_social || d.mentorado.nome;
  // apoio aberto É pendência apontável (trabalho a fazer, não falha da
  // dupla) — entra no CTA junto com os sinais da régua
  const temPendencia =
    d.status === "ativa" && (s.sinais.length > 0 || s.apoio.aberto);
  const mensagem = apoioJovem
    ? (msgsContato("apoio_jovem", {
        mentoradoNome: nomeMentorado,
        autorNome: meuNome,
      }).mentorado ?? "")
    : (msgsContato(
        {
          eu: meuNome,
          mentorNome: d.mentor.nome.split(" ")[0],
          mentoradoNome: nomeMentorado,
        },
        temPendencia
          ? { casoMentor: casoLembrete(d, s, hoje, origem) }
          : // sem caso: o fecho neutro "Como estão as coisas?" (contato livre)
            {}
      ).mentor ?? "");
  return (
    <DuplaWaAcao
      duplaId={d.id}
      destNome={apoioJovem ? nomeMentorado : d.mentor.nome}
      telefone={apoioJovem ? d.mentorado.whatsapp : d.mentor.whatsapp}
      mensagem={mensagem}
      nudge={
        temPendencia
          ? {
              destino: apoioJovem ? "mentorado" : "mentor",
              titulo: apoioJovem ? "A equipe quer te ouvir" : tituloNudge,
              href: apoioJovem ? "/jovem/agenda" : `/duplas/${d.id}`,
              // responder um pedido do jovem é "Chamar", nunca cobrança —
              // a mesma etiqueta que a fila-acompanhar dá a esse caso
              rotulo: apoioJovem ? "Chamar" : undefined,
              bloqueadoAte: lembreteBloqueadoAte(ultimoNudge, hoje),
            }
          : undefined
      }
    />
  );
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
  const base = [...lista].sort(porPrioridade).filter(
    (d) =>
      (!turmaSel || d.turma === turmaSel) &&
      (supSel === "todas" ||
        (supSel === "nenhum" ? !d.supervisor : d.supervisor?.id === supSel)) &&
      (!mentorSel || d.mentor.id === mentorSel) &&
      (!q ||
        normaliza(d.mentor.nome).includes(q) ||
        normaliza(d.mentorado.nome).includes(q))
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
  const waDa = (d: Dupla, s: Saude) =>
    waAcaoDaDupla({
      d,
      s,
      hoje,
      // o cap de 48h conta só interações tipo nudge — um "contato" manual
      // (Chamar) nunca bloqueia o Lembrar
      ultimoNudge: nudges[d.id]?.tipo === "nudge" ? nudges[d.id] : null,
      meuNome,
      tituloNudge: "Lembrete da coordenação",
      origem,
    });

  const linha = (d: Dupla, i: number) => {
    const s = saudePorId.get(d.id)!;
    return (
      <LinhaDupla
        key={d.id}
        d={d}
        saude={s}
        eventos={eventos}
        hojeStr={hojeStr}
        mostrarSupervisor
        wa={waDa(d, s)}
        i={i}
      />
    );
  };

  return (
    <>
      {/* page-head: título + resumo vivo à esquerda; busca e ações à direita */}
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Duplas</h1>
          {/* contexto temporal (o "quando" da leitura) — as contagens já
              moram no ResumoSemaforo logo abaixo; repeti-las aqui era eco */}
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

      {/* resumo agregado no topo (v6a .sum): barra proporcional do semáforo
          clicável (espelha os chips) + posição de cada turma no calendário */}
      {lista.length > 0 && (
        <ResumoSemaforo
          lista={lista}
          saudePorId={saudePorId}
          eventos={eventos}
          hojeStr={hojeStr}
          titulo={`Semáforo — ${lista.length} ${lista.length === 1 ? "dupla" : "duplas"}`}
          onFiltrar={setFiltro}
        />
      )}

      {/* chips de categoria com a régua de cada estado; apoio vem depois do
          divisor — é eixo separado, não grau do semáforo */}
      {lista.length > 0 && (
        <div className="mt-5 flex flex-wrap gap-2 max-sm:grid max-sm:grid-cols-2" role="group" aria-label="Filtrar por categoria">
          {CATS.map((c) => (
            <CatChip
              key={c.id}
              cat={c}
              n={base.filter((d) => chipBate(c.id, d, saudePorId.get(d.id)!)).length}
              ativo={filtro === c.id}
              onClick={() => setFiltro(filtro === c.id ? "todas" : c.id)}
            />
          ))}
          <span aria-hidden className="mx-1 w-px self-stretch bg-border max-sm:hidden" />
          <button
            type="button"
            aria-pressed={filtro === "apoio"}
            onClick={() => setFiltro(filtro === "apoio" ? "todas" : "apoio")}
            className={cn(
              "flex min-h-11 flex-[1.15] basis-[165px] flex-col gap-1 rounded-xl border p-3 text-left transition-[border-color,transform] hover:-translate-y-px focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 max-sm:col-span-2",
              filtro === "apoio"
                ? "border-[var(--info-text)] bg-[var(--info-text)] text-white shadow-md"
                : "border-[var(--info-border)] bg-[var(--info-bg)] hover:border-[var(--info)]"
            )}
          >
            <span className="flex items-center gap-1.5">
              <Lifebuoy
                size={14}
                aria-hidden
                className={filtro === "apoio" ? "text-white" : "text-[var(--info-text)]"}
              />
              <span
                className={cn(
                  "text-sm font-semibold",
                  filtro !== "apoio" && "text-[var(--info-text)]"
                )}
              >
                Apoio
              </span>
              <span
                className={cn(
                  "ml-auto rounded-full px-2 py-0.5 text-[11px] font-bold tabular-nums",
                  filtro === "apoio"
                    ? "bg-white/20 text-white"
                    : "bg-[var(--info)]/15 text-[var(--info-text)]"
                )}
              >
                {base.filter((d) => saudePorId.get(d.id)!.apoio.aberto).length}
              </span>
            </span>
            <span
              className={cn(
                "text-xs leading-snug",
                filtro === "apoio" ? "text-white/75" : "text-muted-foreground"
              )}
            >
              chamado aberto — não é falha da dupla
            </span>
          </button>
        </div>
      )}

      {/* filtros em linha única: turma + supervisão + "+ mentor" */}
      {(turmas.length > 1 || supervisores.length > 0) && (
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
          {turmas.length > 1 && (
            <span className="flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
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
                >
                  {t}
                  <span
                    className={cn(
                      "text-[11px] tabular-nums",
                      turmaSel === t ? "text-background/70" : "text-muted-foreground/70"
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
              <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
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
                <button
                  type="button"
                  onClick={() => setMentorAberto(true)}
                  className="min-h-11 rounded px-1 text-[13px] font-semibold text-muted-foreground underline underline-offset-[3px] hover:text-foreground sm:min-h-8"
                >
                  + mentor
                </button>
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
            className="overflow-hidden rounded-xl bg-card shadow-[var(--shadow-border)] max-sm:contents"
          >
            <CabecalhoColunas />
            {/* filtros DISCRETOS sempre animam (convenção registrada no
                AGENTS.md): a re-key remonta as linhas e o animate-enter
                re-roda com o stagger do --i. A busca fica fora da key de
                propósito — cada tecla remontava ~26 linhas, recolhia o
                <details> da massa e matava dialogs abertos */}
            <div
              key={`${filtro}|${turmaSel ?? ""}|${supSel}|${mentorSel ?? ""}`}
              className="divide-y divide-border/60 max-sm:space-y-3 max-sm:divide-y-0"
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
          {/* idem coordenação: contexto temporal — a contagem já está no
              "Semáforo — N supervisionadas" logo abaixo */}
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

      {/* resumo agregado (v6a .sum) — semáforo das supervisionadas; a
          auxiliar não tem chips de categoria, a barra é só informativa */}
      {lista.length > 0 && (
        <ResumoSemaforo
          lista={lista}
          saudePorId={saudePorId}
          eventos={eventos}
          hojeStr={hojeStr}
          titulo={`Semáforo — ${lista.length} supervisionada${lista.length > 1 ? "s" : ""}`}
        />
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
          className="overflow-hidden rounded-xl bg-card shadow-[var(--shadow-border)] max-sm:contents"
        >
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
                      "flex flex-wrap items-baseline gap-x-2 gap-y-0.5 bg-muted px-5 py-2 text-xs font-bold text-foreground max-sm:rounded-xl max-sm:border max-sm:border-border",
                      gi > 0 && "border-t border-border"
                    )}
                  >
                    {turma}
                    <small className="font-medium text-muted-foreground">
                      {oficial?.numero != null
                        ? `encontro ${oficial.numero} ${formatDiaSemanaMes(oficial.data)}`
                        : null}
                    </small>
                  </div>
                  <div className="divide-y divide-border/60 max-sm:space-y-3 max-sm:divide-y-0 max-sm:pt-3">
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
                          hojeStr={hojeStr}
                          mostrarSupervisor={false}
                          wa={waAcaoDaDupla({
                            d,
                            s,
                            hoje,
                            ultimoNudge:
                              nudges[d.id]?.tipo === "nudge"
                                ? nudges[d.id]
                                : null,
                            meuNome,
                            tituloNudge: "Lembrete da supervisão",
                            origem,
                          })}
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
          className="grid size-11 shrink-0 place-items-center rounded-xl border border-border bg-card text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:size-7 md:rounded-lg lg:size-6"
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
            const tomCard =
              d.status !== "ativa"
                ? "border-l-muted-foreground/40"
                : s.semaforo === "risco"
                  ? "border-l-[var(--danger)]"
                  : s.semaforo === "atencao" || apoioProprio
                    ? "border-l-[var(--warn)]"
                    : "border-l-[var(--ok)]";
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
                className={cn(
                  "animate-enter grid grid-cols-1 gap-2 rounded-xl border border-border border-l-4 bg-card p-3 shadow-[var(--shadow-border)]",
                  tomCard
                )}
              >
                <header className="flex flex-wrap items-center justify-between gap-2">
                  <p className="flex min-w-0 items-center gap-1.5 font-semibold">
                    <DuplaAvatares mentor={d.mentor} mentorado={d.mentorado} size={28} />
                    <DuplaNomes truncar mentor={d.mentor.nome} mentorado={d.mentorado.nome} />
                    {d.turma && (
                      <span className="rounded border border-border px-1 text-[10px] font-bold text-muted-foreground">
                        {d.turma}
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
                            : "bg-[var(--ok)]"
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
                    <span className="block text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                      Próximo passo
                    </span>
                    <b className="block">
                      {pendente
                        ? `Registrar o ${pendente.numero}º encontro`
                        : s.proximo?.data_hora
                          ? `Encontro ${s.proximo.numero} — ${formatDateTime(s.proximo.data_hora)}`
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
                  <span className="block text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
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
                            Apoio solicitado — a coordenação entra em contato com você
                          </li>
                        )}
                      </>
                    )}
                  </ul>
                </div>

                {/* sem footer de ações — "Registrar" mora no "Próximo
                    passo", "Abrir ficha" no header (a faixa inferior do
                    item morreu na v6a; o rodapé global é outra coisa) */}
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
                className="animate-enter grid gap-2 rounded-xl border border-border border-l-4 border-l-[var(--brand-lime)] bg-card p-3 shadow-[var(--shadow-border)]"
              >
                <header className="flex flex-wrap items-center justify-between gap-2">
                  {/* a trilha é dela × o jovem — ela é a constante, o nome da
                      linha é o mentorado (dot amarelo = papel dele) */}
                  <p className="flex min-w-0 items-center gap-1.5 font-semibold">
                    <span
                      aria-hidden
                      className="size-2.5 shrink-0 rounded-full bg-[var(--role-mentorado)] ring-1 ring-black/10"
                    />
                    <span className="truncate">{d.mentorado.nome}</span>
                    {d.turma && (
                      <span className="rounded border border-border px-1 text-[10px] font-bold text-muted-foreground">
                        {d.turma}
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
                                ? "border-2 border-[var(--ok)] bg-[var(--brand-lime)]/15 text-[var(--ok-text)]"
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
                    <span className="block text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
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
