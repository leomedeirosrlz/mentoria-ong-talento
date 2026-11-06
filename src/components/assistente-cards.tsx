"use client";

// Cards do genUI direto (assistente v3): a rota emite um `UiBloco` assim
// que a tool responde, e o card pinta o dado ANTES do texto do modelo. O
// número vem daqui, a interpretação vem do texto.
//
// Família visual da DuplaLinha/SaudePrograma, recortada pro painel (~260
// a 640px): cada card é o próprio @container e adapta por @md/@lg, nunca
// pela tela. Superfície neutra; cor de status só em pill, ponto e
// quadrado, sempre com rótulo. Dupla em dia é neutra; apoio é pill à
// parte, nunca fatia. Entrada: .animate-enter com --i curto (≤300ms).

import { useId, useState, type CSSProperties, type ReactNode } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import {
  BookOpenText,
  CaretDown,
  CaretRight,
  CheckCircle,
  Clock,
  Lifebuoy,
  WarningCircle,
} from "@phosphor-icons/react";
import type {
  UiAgenda,
  UiBloco,
  UiCapacidade,
  UiChamados,
  UiCombinados,
  UiDupla,
  UiJornada,
  UiPedidos,
  UiDuplaMini,
  UiFila,
  UiFontes,
  UiInstrumentos,
  UiPessoas,
  UiRegistros,
  UiSaude,
} from "@/lib/ia/ui";
import { metaFonte } from "@/lib/ia/fontes";
import {
  AVALIACAO_LABEL,
  CHAMADO_STATUS_LABEL,
  DIFICULDADE_LABEL,
  PROXIMO_PASSO_LABEL,
  TRILHA_LABEL,
  formatDate,
  maxEncontros,
  papelLabel,
  tempoRelativo,
  toDateStr,
  type Semaforo,
} from "@/lib/ciclo";
import { turmaCurta, turmaLonga } from "@/lib/turma";
import type { RecorteFatia } from "@/lib/agenda-coordenacao";
import type {
  AppRole,
  ChamadoStatus,
  DuplaStatus,
  EncontroStatus,
} from "@/lib/types";
import { Avatar, type PapelVisual } from "@/components/avatar";
import { CategoriaBadge } from "@/components/chamados-shared";
import { DuplaNomes } from "@/components/dupla-nomes";
import type { TomSituacao } from "@/components/dupla-linha";
import {
  InstrumentoEmblema,
  ehInstrumentoChave,
} from "@/components/instrumento-icone";
import { T } from "@/components/motion";
import { Button, buttonVariants } from "@/components/ui/button";
import { BarraSegmentada } from "@/components/viz";
import { cn } from "@/lib/utils";

// ---------- vocabulário compartilhado ----------

/** Tons das pills: os quatro da DuplaLinha + ok/info pra estados que não
 *  são situação de dupla (instrumento respondido, encontro realizado). */
type Tom = TomSituacao | "ok" | "info";

const PILL: Record<Tom, string> = {
  risco: "border-[var(--danger-border)] bg-[var(--danger-bg)] text-[var(--danger-text)]",
  atencao: "border-[var(--warn-border)] bg-[var(--warn-bg)] text-[var(--warn-text)]",
  neutro: "border-border bg-muted text-foreground",
  pausa: "border-[var(--pausa-border)] bg-[var(--pausa-bg)] text-[var(--pausa-text)]",
  ok: "border-[var(--ok-border)] bg-[var(--ok-bg)] text-[var(--ok-text)]",
  info: "border-[var(--info-border)] bg-[var(--info-bg)] text-[var(--info-text)]",
};

const PONTO: Partial<Record<Tom, string>> = {
  risco: "bg-[var(--danger)]",
  atencao: "bg-[var(--warn)]",
  pausa: "bg-[var(--pausa)]",
};

/** Cor cheia do quadrado de encontro, por situação (= QUADRADO_ON da
 *  DuplaLinha); em var pro anel do "sem registro" usar a mesma tinta. */
const TINTA: Record<TomSituacao, string> = {
  risco: "var(--danger)",
  atencao: "var(--warn)",
  neutro: "var(--muted-foreground)",
  pausa: "var(--pausa)",
};

const EYEBROW =
  "text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground";
const FOCO =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

/** stagger curto: 180ms + 35ms × 3 fecha em ~285ms, dentro do teto */
const passo = (i: number) => ({ "--i": Math.min(i, 3) }) as CSSProperties;

const plural = (n: number, um: string, varios: string) =>
  `${n} ${n === 1 ? um : varios}`;

const primeiroNome = (n: string | null) => (n ?? "").split(" ")[0] || "dupla";

/** Mesma régua do situacaoDaDupla da home: status fora da jornada manda;
 *  ativa lê a situação. Em dia é neutro, sem cor de status. Na voz do
 *  jovem a dupla encerrada lê "Encerrada" (neutro) — "desistente" é o
 *  vocabulário interno da equipe, nunca sobre ele mesmo. */
function situacao(
  status: DuplaStatus,
  semaforo?: Semaforo,
  jovem = false
): { rotulo: string; tom: TomSituacao } {
  if (status === "concluida") return { rotulo: "Concluída", tom: "pausa" };
  if (status === "encerrada")
    return { rotulo: jovem ? "Encerrada" : "Desistente", tom: "pausa" };
  if (status === "pausada") return { rotulo: "Pausada", tom: "pausa" };
  if (semaforo === "risco") return { rotulo: "Em risco", tom: "risco" };
  if (semaforo === "atencao") return { rotulo: "Atenção", tom: "atencao" };
  return { rotulo: "Em dia", tom: "neutro" };
}

function Pill({
  tom,
  icone,
  title,
  children,
}: {
  tom: Tom;
  icone?: ReactNode;
  title?: string;
  children: ReactNode;
}) {
  return (
    <span
      title={title}
      className={cn(
        "inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2 py-1 text-[11px] font-semibold leading-none",
        PILL[tom]
      )}
    >
      {icone ??
        (PONTO[tom] && (
          <span aria-hidden className={cn("size-1.5 rounded-full", PONTO[tom])} />
        ))}
      {children}
    </span>
  );
}

const PillApoio = () => (
  <Pill tom="info" icone={<Lifebuoy size={12} aria-hidden />}>
    Apoio pedido
  </Pill>
);

/** Moldura de todo card: o container que as @-variants leem, título h3
 *  (o card vive dentro da resposta, abaixo do h2 da tela) e rodapé de
 *  navegação opcional. */
function Cartao({
  titulo,
  meta,
  rodape,
  children,
}: {
  titulo: ReactNode;
  meta?: ReactNode;
  rodape?: ReactNode;
  children: ReactNode;
}) {
  const id = useId();
  return (
    <section
      aria-labelledby={id}
      className="@container animate-enter min-w-0 overflow-hidden rounded-xl border border-border/70 bg-card shadow-[var(--shadow-border)]"
    >
      <header className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 px-3 pt-2.5">
        <h3 id={id} className="min-w-0 text-sm font-semibold leading-snug">
          {titulo}
        </h3>
        {meta != null && (
          <div className="text-xs text-muted-foreground tabular-nums">{meta}</div>
        )}
      </header>
      <div className="px-3 pt-2 pb-3">{children}</div>
      {rodape}
    </section>
  );
}

/** Rodapé com o atalho pra tela de origem — clicar fecha o painel (o pai
 *  cuida), então é Link puro. */
function Rodape({ href, children }: { href: string; children: ReactNode }) {
  return (
    <div className="border-t border-border/60 px-1.5 py-1">
      <Link
        href={href}
        className={cn(
          "inline-flex min-h-11 items-center gap-1 rounded-md px-1.5 text-xs font-semibold transition-colors hover:bg-muted md:min-h-8",
          FOCO
        )}
      >
        {children}
        <CaretRight size={12} weight="bold" aria-hidden />
      </Link>
    </div>
  );
}

/** Linha vazia calma — nunca card em branco. */
const Vazio = ({ children }: { children: ReactNode }) => (
  <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
    <CheckCircle size={16} aria-hidden className="shrink-0" />
    {children}
  </p>
);

// ---------- datas (fuso do programa) ----------

const TZ = "America/Sao_Paulo";
const DIA_MS = 86_400_000;

/** "YYYY-MM-DD" é dia de calendário: âncora no meio-dia pra não voltar um
 *  dia no fuso (mesma razão do paraData do ciclo). */
const quando = (iso: string) =>
  /^\d{4}-\d{2}-\d{2}$/.test(iso) ? new Date(`${iso}T12:00:00`) : new Date(iso);

const valida = (iso: string | null | undefined): iso is string =>
  !!iso && !isNaN(quando(iso).getTime());

const fmtHora = new Intl.DateTimeFormat("pt-BR", {
  timeZone: TZ,
  hour: "2-digit",
  minute: "2-digit",
});
const fmtDiaSemana = new Intl.DateTimeFormat("pt-BR", {
  timeZone: TZ,
  weekday: "short",
  day: "numeric",
  month: "short",
});
const fmtDiaMes = new Intl.DateTimeFormat("pt-BR", {
  timeZone: TZ,
  day: "numeric",
  month: "short",
});

/** O Intl pt-BR devolve "qui., 12 de nov." — o card usa "qui., 12 nov." */
function parte(fmt: Intl.DateTimeFormat, d: Date, tipo: Intl.DateTimeFormatPartTypes) {
  return fmt.formatToParts(d).find((p) => p.type === tipo)?.value ?? "";
}
const diaSemanaCurto = (iso: string) => {
  const d = quando(iso);
  return `${parte(fmtDiaSemana, d, "weekday")}, ${parte(fmtDiaSemana, d, "day")} ${parte(fmtDiaSemana, d, "month")}`;
};
const diaMesCurto = (iso: string) => {
  const d = quando(iso);
  return `${parte(fmtDiaMes, d, "day")} ${parte(fmtDiaMes, d, "month")}`;
};
const hora = (iso: string) => fmtHora.format(quando(iso));

/** "Hoje" / "Amanhã" / "Ontem" / "qui., 12 nov." — comparando o dia no fuso. */
function rotuloDia(iso: string, agora: number): string {
  const dia = toDateStr(quando(iso));
  if (dia === toDateStr(new Date(agora))) return "Hoje";
  if (dia === toDateStr(new Date(agora + DIA_MS))) return "Amanhã";
  if (dia === toDateStr(new Date(agora - DIA_MS))) return "Ontem";
  return diaSemanaCurto(iso);
}

/** O mesmo dia em prosa: "hoje", "amanhã" ou "qui., 12 nov.". */
function quandoTexto(iso: string, agora: number): string {
  const r = rotuloDia(iso, agora);
  return /^(Hoje|Amanhã|Ontem)$/.test(r) ? r.toLowerCase() : r;
}

/** "há 12 dias" — espera na fila, em dias inteiros. */
function haDias(iso: string | null, agora: number): string | null {
  if (!valida(iso)) return null;
  const dias = Math.max(0, Math.floor((agora - quando(iso).getTime()) / DIA_MS));
  return dias === 0 ? "desde hoje" : `há ${plural(dias, "dia", "dias")}`;
}

/** `agora` congelado na montagem: o card não muda de "Hoje" no meio da
 *  leitura e não diverge entre SSR e hidratação. */
const useAgora = () => useState(() => Date.now())[0];

// ---------- dispatcher ----------

/** Rotas por público: o jovem vive em /jovem — o (app) redirecionaria, mas
 *  o link certo poupa o salto e o rótulo fala com ele. */
function rotas(jovem: boolean) {
  return jovem
    ? {
        ficha: () => "/jovem",
        encontros: () => "/jovem/agenda",
        instrumentos: () => "/jovem",
        chamados: "/jovem/perfil",
        agenda: "/jovem/agenda",
      }
    : {
        ficha: (id: string) => `/duplas/${id}`,
        encontros: (id: string) => `/duplas/${id}?aba=encontros`,
        instrumentos: (id: string) => `/duplas/${id}?aba=instrumentos`,
        chamados: "/chamados",
        agenda: "/agenda",
      };
}
type Rotas = ReturnType<typeof rotas>;

/** Um bloco → o card dele. `jovem` troca as rotas pras do mentorado; sem
 *  ele, a ficha sem situação (só o jovem recebe assim) já se identifica. */
export function UiCard({ bloco, jovem }: { bloco: UiBloco; jovem?: boolean }) {
  const ehJovem =
    jovem ?? (bloco.kind === "dupla" && bloco.semaforo === undefined);
  const r = rotas(ehJovem);
  switch (bloco.kind) {
    case "saude":
      return <CardSaude b={bloco} />;
    case "dupla":
      return <CardDupla b={bloco} jovem={ehJovem} r={r} />;
    case "agenda":
      return <CardAgenda b={bloco} r={r} />;
    case "registros":
      return <CardRegistros b={bloco} r={r} />;
    case "fila":
      return <CardFila b={bloco} />;
    case "capacidade":
      return <CardCapacidade b={bloco} />;
    case "pessoas":
      return <CardPessoas b={bloco} />;
    case "chamados":
      return <CardChamados b={bloco} r={r} />;
    case "instrumentos":
      return <CardInstrumentos b={bloco} r={r} />;
    case "fontes":
      return <CardFontes b={bloco} jovem={ehJovem} />;
    case "combinados":
      return <CardCombinados b={bloco} />;
    case "jornada":
      return <CardJornada b={bloco} />;
    case "pedidos":
      return <CardPedidos b={bloco} />;
  }
}

// ---------- saude ----------

export function CardSaude({ b }: { b: UiSaude }) {
  const c = b.contagem;
  // "pedem ação" mistura fatias; com uma só acesa o link já filtra nela,
  // senão cai em "em andamento" (a lista ordena por urgência)
  const acesas = (["risco", "atencao", "apoio"] as const).filter((k) => c[k] > 0);
  const recorteAcao: RecorteFatia = acesas.length === 1 ? acesas[0] : "andamento";
  const resto = b.pedem_acao - b.destaques.length;

  return (
    <Cartao
      titulo="Situação das duplas"
      meta={
        <Link
          href="/duplas?recorte=andamento"
          className={cn("rounded-sm underline-offset-2 hover:underline", FOCO)}
        >
          <b className="font-semibold text-foreground">{c.em_andamento}</b> em
          andamento
        </Link>
      }
      rodape={
        resto > 0 ? (
          <Rodape href={`/duplas?recorte=${recorteAcao}`}>
            Ver todas as {b.pedem_acao} que pedem ação
          </Rodape>
        ) : (
          <Rodape href="/duplas">Abrir duplas</Rodape>
        )
      }
    >
      {c.em_andamento > 0 && (
        <BarraSegmentada
          altura="md"
          animate
          denominador={c.em_andamento}
          // mesma régua do SaudePrograma: risco + atenção + em dia = em andamento
          segmentos={[
            { valor: c.risco, rotulo: "em risco", cls: "bg-[var(--danger)]" },
            { valor: c.atencao, rotulo: "em atenção", cls: "bg-[var(--warn)]" },
            { valor: c.em_dia, rotulo: "em dia", cls: "bg-[var(--ok)]" },
          ]}
          ariaLabel={`${c.em_andamento} em andamento: ${c.risco} em risco, ${c.atencao} em atenção, ${c.em_dia} em dia. ${c.apoio} com apoio aberto.`}
        />
      )}
      <ul className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
        <Contagem n={c.risco} rotulo="em risco" dot="bg-[var(--danger)]" texto="text-[var(--danger-text)]" href="/duplas?recorte=risco" />
        <Contagem n={c.atencao} rotulo="em atenção" dot="bg-[var(--warn)]" texto="text-[var(--warn-text)]" href="/duplas?recorte=atencao" />
        <Contagem n={c.em_dia} rotulo="em dia" dot="bg-[var(--ok)]" texto="text-[var(--ok-text)]" />
        {c.pausadas > 0 && (
          <Contagem
            n={c.pausadas}
            rotulo={c.pausadas === 1 ? "pausada" : "pausadas"}
            dot="bg-[var(--pausa)]"
            texto="text-muted-foreground"
            href="/duplas?recorte=pausada"
          />
        )}
        {c.apoio > 0 && (
          // apoio é sobreposição: pill à parte, não soma nem tira do risco
          <li>
            <Link
              href="/duplas?recorte=apoio"
              className={cn(
                "inline-flex min-h-7 items-center gap-1 rounded-full border px-2 text-xs font-semibold transition-colors hover:brightness-95",
                PILL.info,
                FOCO
              )}
            >
              <Lifebuoy size={13} aria-hidden />
              <span className="tabular-nums">{c.apoio}</span> com apoio aberto
            </Link>
          </li>
        )}
      </ul>

      <div className="mt-3">
        {b.destaques.length ? (
          <>
            <p className={EYEBROW}>Pedem ação</p>
            <ul className="mt-1.5 space-y-1.5">
              {b.destaques.map((d, i) => (
                <DestaqueLinha key={d.id} d={d} i={i + 1} />
              ))}
            </ul>
          </>
        ) : (
          <Vazio>Nenhuma dupla pedindo ação agora</Vazio>
        )}
      </div>
    </Cartao>
  );
}

function Contagem({
  n,
  rotulo,
  dot,
  texto,
  href,
}: {
  n: number;
  rotulo: string;
  dot: string;
  texto: string;
  href?: string;
}) {
  const corpo = (
    <>
      <b className={cn("font-semibold tabular-nums", texto)}>{n}</b>{" "}
      <span className={texto}>{rotulo}</span>
    </>
  );
  return (
    <li className="inline-flex items-center gap-1.5">
      <span aria-hidden className={cn("size-2.5 shrink-0 rounded-full", dot)} />
      {href && n > 0 ? (
        <Link href={href} className={cn("rounded-sm underline-offset-2 hover:underline", FOCO)}>
          {corpo}
        </Link>
      ) : (
        <span>{corpo}</span>
      )}
    </li>
  );
}

/** DuplaLinha de bolso: situação + apoio, nomes que não truncam, motivo
 *  em até duas linhas, n de esperados. O card inteiro abre a ficha. */
function DestaqueLinha({ d, i }: { d: UiDuplaMini; i: number }) {
  const sit = situacao(d.status, d.semaforo);
  return (
    <li
      style={passo(i)}
      className="animate-enter relative rounded-lg border border-border/70 p-2.5 transition-colors hover:bg-muted/50"
    >
      <Link
        href={`/duplas/${d.id}`}
        aria-label={`Ver ficha da dupla de ${primeiroNome(d.mentorado)}`}
        className={cn("absolute inset-0 z-10 rounded-lg", FOCO)}
      />
      <div className="flex flex-wrap items-center gap-1.5">
        <Pill tom={sit.tom}>{sit.rotulo}</Pill>
        {d.apoio && <PillApoio />}
        {/* decorativo: quem navega é o link esticado */}
        <span aria-hidden className="ml-auto inline-flex items-center gap-0.5 text-xs font-semibold text-muted-foreground">
          Ver ficha
          <CaretRight size={11} weight="bold" />
        </span>
      </div>
      <p className="mt-1.5 text-sm font-semibold leading-snug">
        <DuplaNomes mentor={d.mentor ?? "Mentor a definir"} mentorado={d.mentorado ?? "Mentorado a definir"} />
      </p>
      {d.motivo && (
        <p className="mt-0.5 line-clamp-2 text-[13px] leading-snug" title={d.motivo}>
          {d.motivo}
        </p>
      )}
      <p className="mt-1 text-xs text-muted-foreground">
        <b className="font-semibold tabular-nums text-foreground">{d.feitos}</b>
        {d.esperado > 0
          ? ` de ${plural(d.esperado, "encontro esperado", "encontros esperados")}`
          : ` ${d.feitos === 1 ? "encontro realizado" : "encontros realizados"}`}
      </p>
    </li>
  );
}

// ---------- dupla ----------

type EstadoQuadrado = "registro" | "sem_registro" | "agendado" | "nao" | "vazio";

function estadoEncontro(e?: { status: EncontroStatus; tem_registro: boolean }): EstadoQuadrado {
  if (!e) return "vazio";
  if (e.status === "realizado") return e.tem_registro ? "registro" : "sem_registro";
  if (e.status === "agendado" || e.status === "remarcado") return "agendado";
  return "nao"; // nao_aconteceu e o legado cancelado
}

function Quadrado({ estado, tom }: { estado: EstadoQuadrado; tom: TomSituacao }) {
  return (
    <span
      className={cn(
        "block min-w-0 flex-1 rounded-[2px]",
        estado === "vazio" && "bg-muted shadow-[inset_0_0_0_1px_var(--border)]",
        estado === "agendado" && "border border-dashed border-foreground/45",
        estado === "nao" && "viz-hatch"
      )}
      style={
        estado === "registro"
          ? { background: TINTA[tom] }
          : estado === "sem_registro"
            ? { boxShadow: `inset 0 0 0 1.5px ${TINTA[tom]}` }
            : undefined
      }
    />
  );
}

/** Os quadradinhos da trilha, com legenda em texto: realizado com registro
 *  (cheio), sem registro (anel), agendado (tracejado), não aconteceu
 *  (listra). O traço é o esperado até hoje, como na DuplaLinha.
 *  Pro jovem "registro" é conceito interno do mentor — o quadrado cheio
 *  lê "aconteceu" e os anéis nunca aparecem (a tool nem devolve o dado). */
function EncontrosDupla({ b, tom, jovem = false }: { b: UiDupla; tom: TomSituacao; jovem?: boolean }) {
  const por = new Map(b.encontros.map((e) => [e.numero, e]));
  const total = Math.max(maxEncontros(b.trilha), ...b.encontros.map((e) => e.numero), 0);
  const estados = Array.from({ length: total }, (_, k) => {
    const e = por.get(k + 1);
    if (jovem && e?.status === "realizado") return "registro" as EstadoQuadrado;
    return estadoEncontro(e);
  });
  const n = (s: EstadoQuadrado) => estados.filter((x) => x === s).length;
  const feitos = n("registro") + n("sem_registro");
  const esperado = b.esperado != null && b.status === "ativa" ? Math.min(b.esperado, total) : null;
  const itens: { estado: EstadoQuadrado; texto: string }[] = [
    {
      estado: "registro",
      texto: jovem
        ? `${n("registro")} ${n("registro") === 1 ? "aconteceu" : "aconteceram"}`
        : `${n("registro")} com registro`,
    },
    { estado: "sem_registro", texto: `${n("sem_registro")} sem registro` },
    { estado: "agendado", texto: plural(n("agendado"), "agendado", "agendados") },
    { estado: "nao", texto: `${n("nao")} não ${n("nao") === 1 ? "aconteceu" : "aconteceram"}` },
  ];
  const legenda = itens.filter((l) => n(l.estado) > 0);

  return (
    <div className="mt-3">
      <div className="flex items-baseline justify-between gap-2">
        <p className={EYEBROW}>Encontros</p>
        <p className="text-xs">
          <b className="font-semibold tabular-nums">
            {feitos} de {total}
          </b>
          <span className="text-muted-foreground"> realizados</span>
        </p>
      </div>
      {/* a leitura acessível é a legenda em texto; os quadrados são o desenho */}
      <div aria-hidden className="relative mt-1.5">
        <div className="flex h-2.5 gap-[3px]">
          {estados.map((s, k) => (
            <Quadrado key={k} estado={s} tom={tom} />
          ))}
        </div>
        {esperado != null && esperado > 0 && (
          <span
            className="absolute -top-1 -bottom-1 w-0.5 -translate-x-1/2 rounded bg-foreground/50"
            style={{ left: `${(esperado / total) * 100}%` }}
          />
        )}
      </div>
      <ul aria-label="Legenda dos encontros" className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
        {legenda.map((l) => (
          <li key={l.estado} className="inline-flex items-center gap-1.5">
            <span aria-hidden className="flex h-2.5 w-2.5">
              <Quadrado estado={l.estado} tom={tom} />
            </span>
            {l.texto}
          </li>
        ))}
        {esperado != null && esperado > 0 && (
          <li className="inline-flex items-center gap-1.5">
            <span aria-hidden className="h-3 w-0.5 rounded bg-foreground/50" />
            {plural(esperado, "esperado", "esperados")} até hoje
          </li>
        )}
        {!legenda.length && <li>Nenhum encontro marcado ainda</li>}
      </ul>
    </div>
  );
}

export function CardDupla({
  b,
  jovem = b.semaforo === undefined,
  r = rotas(jovem),
}: {
  b: UiDupla;
  jovem?: boolean;
  r?: Rotas;
}) {
  const agora = useAgora();
  const sit = situacao(b.status, b.semaforo, jovem);
  const mentor = b.mentor ?? "Mentor a definir";
  const mentorado = b.mentorado ?? "Mentorado a definir";
  const turma = b.turma ? turmaCurta(b.turma) : null;
  const meta = [b.turma && turmaLonga(b.turma), b.supervisor && `Acompanhada por ${b.supervisor}`]
    .filter(Boolean)
    .join(" · ");
  // pro jovem só aparece o status quando a jornada saiu do ritmo normal
  const mostraSituacao = !jovem || b.status !== "ativa";

  return (
    <Cartao
      titulo={<DuplaNomes mentor={mentor} mentorado={mentorado} />}
      meta={
        <span className="inline-flex items-center rounded-full border border-border px-2 py-1 text-[11px] font-semibold leading-none text-foreground">
          {TRILHA_LABEL[b.trilha ?? "dpp"]}
          {turma && ` · ${turma}`}
        </span>
      }
    >
      {meta && <p className="-mt-1 text-xs text-muted-foreground">{meta}</p>}
      {(mostraSituacao || b.apoio) && (
        <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
          {mostraSituacao && <Pill tom={sit.tom}>{sit.rotulo}</Pill>}
          {b.apoio && <PillApoio />}
        </div>
      )}
      {b.motivo && <p className="mt-1.5 text-[13px] leading-snug">{b.motivo}</p>}

      <EncontrosDupla b={b} tom={sit.tom} jovem={jovem} />

      {/* próximo passo da jornada: amarelo de destaque, nunca alerta */}
      {b.proximo && (
        <div className="mt-3 flex items-start gap-2 rounded-lg border border-[var(--destaque-borda)] bg-[var(--destaque-suave)] px-2.5 py-2 text-sm text-foreground">
          <Clock size={16} aria-hidden className="mt-0.5 shrink-0" />
          <p className="min-w-0">
            <span className="block font-semibold">Próximo: encontro {b.proximo.numero}</span>
            <span className="block text-xs">
              {valida(b.proximo.data_hora)
                ? `${quandoTexto(b.proximo.data_hora, agora)} às ${hora(b.proximo.data_hora)}`
                : "Data ainda a combinar"}
            </span>
          </p>
        </div>
      )}

      <Link
        href={r.ficha(b.id)}
        className={cn(buttonVariants({ size: "sm" }), "mt-3 w-full @sm:w-auto")}
      >
        {jovem ? "Ver minha jornada" : "Abrir ficha"}
      </Link>
    </Cartao>
  );
}

// ---------- agenda ----------

const STATUS_ENCONTRO: Record<EncontroStatus, { rotulo: string; tom: Tom }> = {
  agendado: { rotulo: "Agendado", tom: "neutro" },
  remarcado: { rotulo: "Remarcado", tom: "neutro" },
  realizado: { rotulo: "Realizado", tom: "ok" },
  nao_aconteceu: { rotulo: "Não aconteceu", tom: "pausa" },
  cancelado: { rotulo: "Cancelado", tom: "pausa" },
};

export function CardAgenda({ b, r = rotas(false) }: { b: UiAgenda; r?: Rotas }) {
  const agora = useAgora();
  // agrupa por dia no fuso; sem data vai pro fim
  const grupos: { chave: string; rotulo: string; itens: UiAgenda["encontros"] }[] = [];
  for (const e of b.encontros) {
    const chave = valida(e.data_hora) ? toDateStr(quando(e.data_hora)) : "9999-12-31";
    let g = grupos.find((x) => x.chave === chave);
    if (!g) {
      g = { chave, rotulo: valida(e.data_hora) ? rotuloDia(e.data_hora, agora) : "Sem data", itens: [] };
      grupos.push(g);
    }
    g.itens.push(e);
  }
  grupos.sort((a, b2) => a.chave.localeCompare(b2.chave));
  // índice do stagger contínuo entre os grupos, calculado antes do JSX
  const inicio: number[] = [];
  for (let g = 0, acc = 0; g < grupos.length; acc += grupos[g].itens.length, g++)
    inicio.push(acc);
  const periodo =
    valida(b.desde) && valida(b.ate)
      ? b.desde === b.ate
        ? diaMesCurto(b.desde)
        : `${diaMesCurto(b.desde)} a ${diaMesCurto(b.ate)}`
      : null;

  return (
    <Cartao
      titulo="Agenda"
      meta={[periodo, plural(b.total, "encontro", "encontros")].filter(Boolean).join(" · ")}
      rodape={
        <Rodape href={r.agenda}>
          {b.total > b.encontros.length ? `Ver os ${b.total} na agenda` : "Abrir agenda"}
        </Rodape>
      }
    >
      {grupos.length ? (
        <ul className="space-y-3">
          {grupos.map((g, gi) => (
            <li key={g.chave}>
              <p className={EYEBROW}>{g.rotulo}</p>
              <ul className="mt-1 divide-y divide-border/60">
                {g.itens.map((e, ei) => {
                  const st = STATUS_ENCONTRO[e.status];
                  return (
                    <li key={`${e.dupla_id}-${e.numero}`} style={passo(inicio[gi] + ei + 1)} className="animate-enter">
                      <Link
                        href={r.encontros(e.dupla_id)}
                        className={cn(
                          "-mx-1.5 grid grid-cols-[2.75rem_minmax(0,1fr)] items-start gap-x-2 rounded-md px-1.5 py-2 transition-colors hover:bg-muted/60",
                          FOCO
                        )}
                      >
                        <span className="pt-px text-sm font-semibold tabular-nums">
                          {valida(e.data_hora) ? hora(e.data_hora) : "--:--"}
                        </span>
                        <span className="min-w-0">
                          <span className="block text-sm font-medium leading-snug">
                            <DuplaNomes mentor={e.mentor ?? "Mentor a definir"} mentorado={e.mentorado ?? "Mentorado a definir"} />
                          </span>
                          <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                            Encontro {e.numero}
                            {e.status !== "agendado" && <Pill tom={st.tom}>{st.rotulo}</Pill>}
                          </span>
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </li>
          ))}
        </ul>
      ) : (
        <Vazio>Nenhum encontro marcado no período</Vazio>
      )}
    </Cartao>
  );
}

// ---------- registros ----------

export function CardRegistros({ b, r = rotas(false) }: { b: UiRegistros; r?: Rotas }) {
  return (
    <Cartao
      titulo="Registros dos encontros"
      meta={
        b.total > b.itens.length
          ? `${b.itens.length} mais recentes de ${b.total}`
          : plural(b.total, "registro", "registros")
      }
      rodape={<Rodape href={r.encontros(b.dupla_id)}>Ver encontros na ficha</Rodape>}
    >
      {b.itens.length ? (
        <ul className="divide-y divide-border/60">
          {b.itens.map((it, i) => {
            const dif = it.dificuldade && it.dificuldade !== "nenhuma" ? it.dificuldade : null;
            return (
              <li key={it.encontro_numero} style={passo(i + 1)} className="animate-enter py-2 first:pt-0 last:pb-0">
                <div className="flex flex-wrap items-baseline justify-between gap-x-2">
                  <p className="text-sm font-semibold">Encontro {it.encontro_numero}</p>
                  {valida(it.realizado_em) && (
                    <p className="text-xs text-muted-foreground">{formatDate(it.realizado_em)}</p>
                  )}
                </div>
                {(it.avaliacao || dif || it.precisa_apoio) && (
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {it.avaliacao && (
                      <Pill tom={it.avaliacao === "baixa" ? "atencao" : "neutro"}>
                        Avaliação {AVALIACAO_LABEL[it.avaliacao]?.toLowerCase() ?? it.avaliacao}
                      </Pill>
                    )}
                    {dif && <Pill tom="atencao">Dificuldade: {DIFICULDADE_LABEL[dif]}</Pill>}
                    {it.precisa_apoio && (
                      <Pill tom="info" icone={<Lifebuoy size={12} aria-hidden />}>
                        Pediu apoio
                      </Pill>
                    )}
                  </div>
                )}
                {it.proximo_passo && (
                  <p className="mt-1.5 text-xs">
                    <span className="text-muted-foreground">Próximo passo: </span>
                    {PROXIMO_PASSO_LABEL[it.proximo_passo] ?? it.proximo_passo}
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      ) : (
        <Vazio>Nenhum registro entregue ainda</Vazio>
      )}
    </Cartao>
  );
}

// ---------- fila ----------

function LinhaPessoa({
  href,
  nome,
  meta,
  i,
}: {
  href: string;
  nome: string;
  meta: string | null;
  i: number;
}) {
  return (
    <li style={passo(i)} className="animate-enter">
      <Link
        href={href}
        className={cn("-mx-1.5 block rounded-md px-1.5 py-1.5 transition-colors hover:bg-muted/60", FOCO)}
      >
        <span className="block text-sm font-medium leading-snug">{nome}</span>
        {meta && <span className="mt-0.5 block text-xs text-muted-foreground">{meta}</span>}
      </Link>
    </li>
  );
}

export function CardFila({ b }: { b: UiFila }) {
  const agora = useAgora();
  const coluna = (
    titulo: string,
    total: number,
    mostrados: number,
    vazio: string,
    linhas: ReactNode
  ) => (
    <div className="min-w-0">
      <p className={cn(EYEBROW, "flex items-baseline justify-between gap-2")}>
        {titulo}
        <span className="tabular-nums">{total}</span>
      </p>
      {total ? (
        <>
          <ul className="mt-1 divide-y divide-border/60">{linhas}</ul>
          {total > mostrados && (
            <p className="mt-1 text-xs text-muted-foreground">e mais {total - mostrados}</p>
          )}
        </>
      ) : (
        <p className="mt-1.5 text-sm text-muted-foreground">{vazio}</p>
      )}
    </div>
  );

  return (
    <Cartao
      titulo="Fila de pareamento"
      meta={`${b.total_mentorados} esperando · ${plural(b.total_mentores, "mentor com vaga", "mentores com vaga")}`}
      rodape={<Rodape href="/pessoas">Abrir Pessoas</Rodape>}
    >
      {/* duas colunas quando cabe; empilha no painel estreito */}
      <div className="grid gap-x-5 gap-y-4 @md:grid-cols-2">
        {coluna(
          "Mentorados esperando",
          b.total_mentorados,
          b.mentorados.length,
          "Ninguém esperando par",
          b.mentorados.map((m, i) => {
            const ha = haDias(m.desde, agora);
            return (
              <LinhaPessoa
                key={m.id}
                href={`/pessoas/${m.id}`}
                nome={m.nome}
                meta={ha && (ha === "desde hoje" ? "Entrou na fila hoje" : `Esperando ${ha}`)}
                i={i + 1}
              />
            );
          })
        )}
        {coluna(
          "Mentores com vaga",
          b.total_mentores,
          b.mentores.length,
          "Nenhum mentor com vaga livre",
          b.mentores.map((m, i) => {
            const ha = haDias(m.desde, agora);
            return (
              <LinhaPessoa
                key={m.id}
                href={`/pessoas/${m.id}`}
                nome={m.nome}
                meta={[plural(m.vagas, "vaga livre", "vagas livres"), ha && `com vaga ${ha}`]
                  .filter(Boolean)
                  .join(" · ")}
                i={i + 1}
              />
            );
          })
        )}
      </div>
    </Cartao>
  );
}

// ---------- capacidade ----------

export function CardCapacidade({ b }: { b: UiCapacidade }) {
  const lotados = b.mentores.filter((m) => m.capacidade > 0 && m.em_uso >= m.capacidade).length;
  return (
    <Cartao
      titulo="Ocupação dos mentores"
      meta={[
        lotados > 0 && `${lotados} sem vaga`,
        b.total > b.mentores.length
          ? `${b.mentores.length} mais ocupados de ${b.total}`
          : plural(b.total, "mentor", "mentores"),
      ]
        .filter(Boolean)
        .join(" · ")}
      rodape={<Rodape href="/pessoas">Abrir Pessoas</Rodape>}
    >
      <ul className="space-y-2.5">
        {b.mentores.map((m, i) => {
          const cheio = m.capacidade > 0 && m.em_uso >= m.capacidade;
          const acima = m.capacidade > 0 && m.em_uso > m.capacidade;
          return (
            <li key={m.id} style={passo(i + 1)} className="animate-enter">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <Link
                  href={`/pessoas/${m.id}`}
                  className={cn("rounded-sm text-sm font-medium underline-offset-2 hover:underline", FOCO)}
                >
                  {m.nome}
                </Link>
                <span className="rounded-full border border-border px-1.5 py-0.5 text-[10px] font-semibold leading-none text-muted-foreground">
                  {TRILHA_LABEL[m.trilha]}
                </span>
                <span className="ml-auto inline-flex items-center gap-1.5 text-xs">
                  {acima ? (
                    <Pill tom="atencao">Acima da capacidade</Pill>
                  ) : (
                    cheio && <span className="font-semibold">Sem vaga</span>
                  )}
                  <span className="tabular-nums text-muted-foreground">
                    {m.capacidade > 0 ? `${m.em_uso} de ${m.capacidade}` : `${m.em_uso} em uso`}
                  </span>
                </span>
              </div>
              {m.capacidade > 0 ? (
                <BarraSegmentada
                  className="mt-1.5"
                  altura="sm"
                  animate
                  i={Math.min(i, 3)}
                  denominador={m.capacidade}
                  segmentos={[
                    {
                      valor: m.em_uso,
                      rotulo: "em uso",
                      cls: cheio ? "bg-foreground" : "bg-muted-foreground",
                    },
                  ]}
                  ariaLabel={`${m.nome}: ${m.em_uso} de ${m.capacidade} vagas em uso`}
                />
              ) : (
                <p className="mt-0.5 text-xs text-muted-foreground">Capacidade não definida</p>
              )}
            </li>
          );
        })}
      </ul>
    </Cartao>
  );
}

// ---------- pessoas ----------

function papelVisual(p: AppRole | null): PapelVisual | undefined {
  if (p === "mentor_dpp" || p === "mentor_especialista") return "mentor";
  if (p === "mentorado") return "mentorado";
  if (p === "coordenacao" || p === "supervisor") return "equipe";
  return undefined;
}

export function CardPessoas({ b }: { b: UiPessoas }) {
  return (
    <Cartao
      titulo="Pessoas encontradas"
      meta={plural(b.pessoas.length, "pessoa", "pessoas")}
    >
      <ul className="grid gap-1 @md:grid-cols-2">
        {b.pessoas.map((p, i) => (
          <li key={p.id} style={passo(i + 1)} className="animate-enter">
            <Link
              href={`/pessoas/${p.id}`}
              className={cn(
                "-mx-1.5 flex items-center gap-2.5 rounded-lg px-1.5 py-1.5 transition-colors hover:bg-muted/60",
                FOCO
              )}
            >
              <Avatar nome={p.nome} papel={papelVisual(p.papel)} size={32} />
              <span className="min-w-0">
                <span className="block text-sm font-medium leading-snug">{p.nome}</span>
                <span className="block text-xs text-muted-foreground">{papelLabel(p.papel)}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </Cartao>
  );
}

// ---------- chamados ----------

const STATUS_CHAMADO: Record<ChamadoStatus, { tom: Tom; icone: ReactNode }> = {
  aberto: { tom: "risco", icone: <WarningCircle size={12} aria-hidden /> },
  em_atendimento: { tom: "atencao", icone: <Clock size={12} aria-hidden /> },
  resolvido: { tom: "ok", icone: <CheckCircle size={12} aria-hidden /> },
};

export function CardChamados({ b, r = rotas(false) }: { b: UiChamados; r?: Rotas }) {
  const agora = useAgora();
  return (
    <Cartao titulo="Chamados" rodape={<Rodape href={r.chamados}>Abrir chamados</Rodape>}>
      <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
        <Contagem n={b.aberto} rotulo={b.aberto === 1 ? "aberto" : "abertos"} dot="bg-[var(--danger)]" texto="text-[var(--danger-text)]" />
        <Contagem n={b.em_atendimento} rotulo="em atendimento" dot="bg-[var(--warn)]" texto="text-[var(--warn-text)]" />
      </ul>
      {b.chamados.length ? (
        <ul className="mt-2.5 divide-y divide-border/60">
          {b.chamados.map((c, i) => {
            const st = STATUS_CHAMADO[c.status];
            return (
              <li key={c.numero} style={passo(i + 1)} className="animate-enter py-2 first:pt-0 last:pb-0">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="font-mono text-xs text-muted-foreground">{c.numero}</span>
                  <CategoriaBadge categoria={c.categoria} />
                  <span className="ml-auto">
                    <Pill tom={st.tom} icone={st.icone}>
                      {CHAMADO_STATUS_LABEL[c.status]}
                    </Pill>
                  </span>
                </div>
                <p className={cn("mt-1 text-sm leading-snug", c.assunto ? "font-medium" : "text-muted-foreground")}>
                  {c.assunto ?? "Sem assunto"}
                </p>
                {valida(c.criado_em) && (
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Aberto <time dateTime={c.criado_em}>{tempoRelativo(c.criado_em, agora)}</time>
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      ) : (
        <Vazio>Nenhum chamado na fila</Vazio>
      )}
    </Cartao>
  );
}

// ---------- instrumentos ----------

export function CardInstrumentos({ b, r = rotas(false) }: { b: UiInstrumentos; r?: Rotas }) {
  const feitos = b.itens.filter((i) => i.respondidos > 0).length;
  return (
    <Cartao
      titulo="Instrumentos da jornada"
      meta={`${feitos} de ${b.itens.length} respondidos`}
      rodape={<Rodape href={r.instrumentos(b.dupla_id)}>Abrir instrumentos</Rodape>}
    >
      <ul className="divide-y divide-border/60">
        {b.itens.map((it, i) => (
          <li key={it.sistema} style={passo(i + 1)} className="animate-enter flex flex-wrap items-center gap-x-2.5 gap-y-1 py-2 first:pt-0 last:pb-0">
            {ehInstrumentoChave(it.sistema) && <InstrumentoEmblema instrumento={it.sistema} size={28} />}
            <p className="min-w-0 flex-1 text-sm font-medium leading-snug">{it.titulo}</p>
            {it.respondidos > 0 ? (
              <Pill tom="ok" icone={<CheckCircle size={12} aria-hidden />}>
                {it.respondidos > 1 ? `${it.respondidos} respostas` : "Respondido"}
              </Pill>
            ) : it.pendentes > 0 ? (
              <Pill tom="neutro" icone={<Clock size={12} aria-hidden />}>
                Aguardando resposta
              </Pill>
            ) : (
              <span className="text-xs text-muted-foreground">Não enviado</span>
            )}
          </li>
        ))}
      </ul>
    </Cartao>
  );
}

// ---------- fontes ----------

export function CardFontes({ b, jovem }: { b: UiFontes; jovem?: boolean }) {
  return (
    <Cartao
      titulo="Trechos dos guias"
      meta={plural(b.fontes.length, "trecho", "trechos")}
    >
      <ul className="space-y-1.5">
        {b.fontes.map((f, i) => (
          <FonteItem
            key={`${f.guia}-${f.secao}-${i}`}
            f={f}
            i={i + 1}
            jovem={jovem}
          />
        ))}
      </ul>
    </Cartao>
  );
}

function FonteItem({
  f,
  i,
  jovem,
}: {
  f: UiFontes["fontes"][number];
  i: number;
  jovem?: boolean;
}) {
  const [aberto, setAberto] = useState(false);
  const id = useId();
  const meta = metaFonte(f.guia, jovem);
  // rótulos do catálogo podem trazer travessão; na tela vira dois-pontos
  const rotulo = meta.rotulo.replace(/\s+—\s+/g, ": ");
  // a referência citável é guia + seção — o "pagina" do banco era o id
  // sintético do chunk e lia como página que não existe no documento
  const onde = (f.secao ?? "").replace(/\s+—\s+/g, ": ");
  return (
    <li style={passo(i)} className="animate-enter rounded-lg border border-border/70">
      {/* ghost do kit com a forma de linha: altura livre, texto quebra */}
      <Button
        type="button"
        variant="ghost"
        aria-expanded={aberto}
        aria-controls={aberto ? id : undefined}
        onClick={() => setAberto((v) => !v)}
        className="h-auto min-h-11 w-full items-start justify-start gap-2 whitespace-normal px-2.5 py-2 text-left font-normal hover:bg-muted/50 active:not-aria-[haspopup]:scale-100 md:h-auto md:min-h-11"
      >
        <BookOpenText size={16} aria-hidden className="mt-0.5 shrink-0 text-muted-foreground" />
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-medium leading-snug">{rotulo}</span>
          {onde && <span className="mt-0.5 block text-xs text-muted-foreground">{onde}</span>}
        </span>
        <CaretDown
          size={14}
          weight="bold"
          aria-hidden
          className={cn(
            "mt-1 shrink-0 text-muted-foreground transition-transform duration-200 ease-snappy",
            aberto && "rotate-180"
          )}
        />
      </Button>
      {/* continuidade espacial: o trecho abre empurrando o resto, height
          "auto" do vocabulário de motion (T.panel) */}
      <AnimatePresence initial={false}>
        {aberto && (
          <motion.div
            id={id}
            key="trecho"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={T.panel}
            style={{ overflow: "clip" }}
          >
            <div className="border-t border-border/60 px-2.5 py-2">
              <blockquote className="text-[13px] leading-relaxed">“{f.trecho}”</blockquote>
              {meta.href && (
                <Link
                  href={meta.href}
                  className={cn(
                    "mt-1 -ml-1 inline-flex min-h-11 items-center gap-1 rounded-md px-1 text-xs font-semibold underline-offset-2 hover:underline md:min-h-8",
                    FOCO
                  )}
                >
                  {meta.href.endsWith("/agenda") ? "Abrir agenda" : "Abrir em Materiais"}
                  <CaretRight size={11} weight="bold" aria-hidden />
                </Link>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </li>
  );
}

// ---------- mentorado (pacote liza nov/2026) ----------

/** Status de solicitação em voz de jovem — sem jargão interno. */
const PEDIDO_LABEL: Record<string, { rotulo: string; tom: Tom }> = {
  sugerida: { rotulo: "sugerida", tom: "neutro" },
  aberta: { rotulo: "esperando especialista", tom: "info" },
  aguardando_coord: { rotulo: "com a coordenação", tom: "info" },
  contra_proposta: { rotulo: "novo horário proposto", tom: "atencao" },
  aceita: { rotulo: "aceita", tom: "ok" },
  recusada: { rotulo: "não deu certo", tom: "neutro" },
  cancelada: { rotulo: "cancelada", tom: "neutro" },
  expirada: { rotulo: "expirada", tom: "neutro" },
};

/** Checklist dos combinados — pendente em destaque, feito em ok menor. */
export function CardCombinados({ b }: { b: UiCombinados }) {
  return (
    <Cartao titulo="Seus combinados" rodape={<Rodape href="/jovem">Ver na sua página</Rodape>}>
      {b.pendentes.length ? (
        <ul className="divide-y divide-border/60">
          {b.pendentes.map((c, i) => (
            <li
              key={`p-${i}`}
              style={passo(i + 1)}
              className="animate-enter flex items-start gap-2 py-2 first:pt-0 last:pb-0"
            >
              <Clock size={15} weight="bold" aria-hidden className="mt-0.5 shrink-0 text-[var(--warn)]" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium leading-snug">{c.texto}</p>
                {valida(c.prazo) && (
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    até {diaSemanaCurto(c.prazo!)}
                  </p>
                )}
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <Vazio>Nada pendente, tudo feito</Vazio>
      )}
      {b.feitos.length > 0 && (
        <ul className="mt-2 space-y-1 border-t border-border/60 pt-2">
          {b.feitos.map((t, i) => (
            <li
              key={`f-${i}`}
              className="flex items-center gap-1.5 text-xs text-muted-foreground"
            >
              <CheckCircle size={12} weight="fill" aria-hidden className="shrink-0 text-[var(--ok)]" />
              <span className="line-through decoration-border">{t}</span>
            </li>
          ))}
        </ul>
      )}
    </Cartao>
  );
}

/** Esteira da jornada — instrumentos com o que já foi e o que falta;
 *  barra segmentada resume o caminho. */
export function CardJornada({ b }: { b: UiJornada }) {
  const total = b.total_respondidos + b.total_pendentes;
  return (
    <Cartao
      titulo="Sua jornada"
      meta={`${b.total_respondidos} de ${total} feitos`}
      rodape={<Rodape href="/jovem">Abrir sua jornada</Rodape>}
    >
      {total > 0 && (
        <div className="mb-2.5">
          <BarraSegmentada
            altura="md"
            animate
            denominador={total}
            segmentos={[
              { valor: b.total_respondidos, rotulo: "feitos", cls: "bg-[var(--ok)]" },
              { valor: b.total_pendentes, rotulo: "a fazer", cls: "bg-[var(--warn)]" },
            ]}
          />
        </div>
      )}
      <ul className="divide-y divide-border/60">
        {b.instrumentos.map((it, i) => (
          <li
            key={it.sistema}
            style={passo(i + 1)}
            className="animate-enter flex flex-wrap items-center gap-x-2.5 gap-y-1 py-2 first:pt-0 last:pb-0"
          >
            {ehInstrumentoChave(it.sistema) && (
              <InstrumentoEmblema instrumento={it.sistema} size={28} />
            )}
            <p className="min-w-0 flex-1 text-sm font-medium leading-snug">{it.titulo}</p>
            {it.pendentes > 0 ? (
              <Pill tom="atencao" icone={<Clock size={12} aria-hidden />}>
                {it.pendentes > 1 ? `${it.pendentes} pra responder` : "Pra responder"}
              </Pill>
            ) : it.respondidos > 0 ? (
              <Pill tom="ok" icone={<CheckCircle size={12} aria-hidden />}>
                Feito
              </Pill>
            ) : (
              <span className="text-xs text-muted-foreground">Ainda não chegou</span>
            )}
          </li>
        ))}
      </ul>
    </Cartao>
  );
}

/** Pedidos de especialista do jovem — quem, sobre o quê, em que pé. */
export function CardPedidos({ b }: { b: UiPedidos }) {
  const agora = useAgora();
  return (
    <Cartao
      titulo="Seus pedidos de especialista"
      rodape={<Rodape href="/jovem/especialistas">Ver seus pedidos</Rodape>}
    >
      <ul className="divide-y divide-border/60">
        {b.pedidos.map((p, i) => {
          const st = PEDIDO_LABEL[p.status] ?? { rotulo: p.status, tom: "neutro" as Tom };
          return (
            <li key={i} style={passo(i + 1)} className="animate-enter py-2 first:pt-0 last:pb-0">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-sm font-medium">
                  {p.especialista ?? "Especialista a definir"}
                </span>
                <span className="ml-auto">
                  <Pill tom={st.tom}>{st.rotulo}</Pill>
                </span>
              </div>
              {p.sobre && (
                <p className="mt-1 text-sm leading-snug">{p.sobre}</p>
              )}
              {valida(p.criado_em) && (
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Pedido <time dateTime={p.criado_em}>{tempoRelativo(p.criado_em, agora)}</time>
                </p>
              )}
            </li>
          );
        })}
      </ul>
    </Cartao>
  );
}
