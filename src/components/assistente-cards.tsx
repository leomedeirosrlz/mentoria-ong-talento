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

import { useEffect, useId, useState, type CSSProperties, type ReactNode } from "react";
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
  WhatsappLogo,
} from "@phosphor-icons/react";
import type {
  UiAgenda,
  UiBloco,
  UiCapacidade,
  UiChamados,
  UiCombinados,
  UiConfirmacao,
  UiDupla,
  UiDuplas,
  UiJornada,
  UiPedidos,
  UiPlano,
  UiPlanoJovem,
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
  CHAMADO_CATEGORIA_LABEL,
  CHAMADO_STATUS_LABEL,
  DIFICULDADE_LABEL,
  PROXIMO_PASSO_LABEL,
  TRILHA_LABEL,
  formatDate,
  maxEncontros,
  papelLabel,
  passoEsp,
  progressoTrilha,
  tempoRelativo,
  toDateStr,
  type Semaforo,
} from "@/lib/ciclo";
import { turmaCurta, turmaLonga } from "@/lib/turma";
import type { RecorteFatia } from "@/lib/agenda-coordenacao";
import {
  rotaChamados,
  rotaDupla,
  rotaDuplas,
  rotaPessoa,
} from "@/lib/ia/rotas";
import {
  situacaoDaDupla,
  SITUACAO_DUPLA_LABEL,
  type DuplaDesfecho,
} from "@/lib/dupla-desfecho";
import { rotuloRitmo } from "@/lib/plano-em-dia";
import type {
  AppRole,
  ChamadoStatus,
  DuplaStatus,
  EncontroStatus,
} from "@/lib/types";
import { Avatar, type PapelVisual } from "@/components/avatar";
import { DuplaNomes } from "@/components/dupla-nomes";
import type { TomSituacao } from "@/components/dupla-linha";
import {
  InstrumentoEmblema,
  ehInstrumentoChave,
} from "@/components/instrumento-icone";
import { T } from "@/components/motion";
import { Button, buttonVariants } from "@/components/ui/button";
import { BarraSegmentada } from "@/components/viz";
import { CopiarLink } from "@/components/forms/copiar-link";
import {
  msgLinkWhatsApp,
  msgLinkWhatsAppRepasse,
  primeiroNome as primeiroNomeLink,
} from "@/components/forms/link-shared";
import { useOrigem } from "@/components/forms/use-origem";
import { DocBlocos } from "@/components/material-documento";
import { INSTRUMENTO_INFO } from "@/lib/forms/schema";
import { waLink } from "@/lib/ciclo";
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

/** Mesma régua do situacaoLinha da home: fechada lê a situação canônica
 *  (dupla-desfecho), ativa lê o semáforo. Em dia é neutro, sem cor de
 *  status. Na voz do jovem a dupla encerrada lê "Encerrada" (neutro) —
 *  "desistente" é o vocabulário interno da equipe, nunca sobre ele mesmo. */
function situacao(
  d: { status: DuplaStatus; desfecho?: DuplaDesfecho | null },
  semaforo?: Semaforo,
  jovem = false
): { rotulo: string; tom: TomSituacao } {
  if (d.status !== "ativa") {
    // desfecho separa Desistente × Encerrada pra equipe; pro jovem a
    // palavra neutra cobre qualquer fechamento cedo (pausada e
    // concluída seguem lendo o próprio nome)
    const sit = situacaoDaDupla(d);
    const rotulo =
      jovem && (sit === "desistente" || sit === "encerrada")
        ? SITUACAO_DUPLA_LABEL.encerrada
        : SITUACAO_DUPLA_LABEL[sit];
    return { rotulo, tom: "pausa" };
  }
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
        // "Meus pedidos" mora na âncora #apoio da home do jovem
        chamados: (c?: string) => `/jovem${c ? `?c=${c}` : ""}#apoio`,
        agenda: "/jovem/agenda",
      }
    : {
        // os builders de ia/rotas centralizam o vocabulário de params —
        // link com filtro errado abria a tela sem aplicar (REALIZA-396)
        ficha: (id: string) => rotaDupla(id),
        encontros: (id: string) => rotaDupla(id, "encontros"),
        instrumentos: (id: string) => rotaDupla(id, "instrumentos"),
        chamados: (id?: string) => rotaChamados(id),
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
    case "duplas":
      return <CardDuplas b={bloco} />;
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
    case "plano":
      return <CardPlano b={bloco} r={r} />;
    case "plano_jovem":
      return <CardPlanoJovem b={bloco} />;
    case "confirmacao":
      return <CardConfirmacao b={bloco} />;
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
          href={rotaDuplas({ recorte: "andamento" })}
          className={cn("rounded-sm underline-offset-2 hover:underline", FOCO)}
        >
          <b className="font-semibold text-foreground">{c.em_andamento}</b> em
          andamento
        </Link>
      }
      rodape={
        resto > 0 ? (
          <Rodape href={rotaDuplas({ recorte: recorteAcao })}>
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
        <Contagem n={c.risco} rotulo="em risco" dot="bg-[var(--danger)]" texto="text-[var(--danger-text)]" href={rotaDuplas({ recorte: "risco" })} />
        <Contagem n={c.atencao} rotulo="em atenção" dot="bg-[var(--warn)]" texto="text-[var(--warn-text)]" href={rotaDuplas({ recorte: "atencao" })} />
        <Contagem n={c.em_dia} rotulo="em dia" dot="bg-[var(--ok)]" texto="text-[var(--ok-text)]" />
        {c.pausadas > 0 && (
          <Contagem
            n={c.pausadas}
            rotulo={c.pausadas === 1 ? "pausada" : "pausadas"}
            dot="bg-[var(--pausa)]"
            texto="text-muted-foreground"
            href={rotaDuplas({ recorte: "pausada" })}
          />
        )}
        {c.concluidas > 0 && (
          <Contagem
            n={c.concluidas}
            rotulo={c.concluidas === 1 ? "concluída" : "concluídas"}
            dot="bg-muted-foreground"
            texto="text-foreground"
            href={rotaDuplas({ recorte: "concluida" })}
          />
        )}
        {c.encerradas > 0 && (
          <Contagem
            n={c.encerradas}
            rotulo={c.encerradas === 1 ? "encerrada" : "encerradas"}
            dot="bg-muted-foreground/40"
            texto="text-muted-foreground"
            href={rotaDuplas({ recorte: "encerrada" })}
          />
        )}
        {c.apoio > 0 && (
          // apoio é sobreposição: pill à parte, não soma nem tira do risco
          <li>
            <Link
              href={rotaDuplas({ recorte: "apoio" })}
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
 *  em até duas linhas, n de esperados e o próximo encontro. O card
 *  inteiro abre a ficha. */
function DestaqueLinha({ d, i }: { d: UiDuplaMini; i: number }) {
  const agora = useAgora();
  const sit = situacao(d, d.semaforo);
  return (
    <li
      style={passo(i)}
      className="animate-enter relative rounded-lg border border-border/70 p-2.5 transition-colors hover:bg-muted/50"
    >
      <Link
        href={rotaDupla(d.id)}
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
      {d.proximo && (
        <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
          <Clock size={12} aria-hidden className="shrink-0" />
          Próximo: {d.proximo.numero}º encontro
          {valida(d.proximo.data_hora)
            ? ` · ${quandoTexto(d.proximo.data_hora!, agora)}`
            : " · data a combinar"}
        </p>
      )}
    </li>
  );
}

// ---------- duplas (panorama) ----------

/** "Como estão minhas duplas?" — as linhas-mini com situação, progresso
 *  e próximo encontro; o radar completo segue em /duplas. */
export function CardDuplas({ b }: { b: UiDuplas }) {
  return (
    <Cartao
      titulo="Suas duplas"
      meta={
        b.truncado
          ? `${b.itens.length} de ${b.total}`
          : plural(b.total, "dupla", "duplas")
      }
      rodape={
        b.truncado ? (
          <Rodape href="/duplas">Ver todas as {b.total} duplas</Rodape>
        ) : (
          <Rodape href="/duplas">Abrir duplas</Rodape>
        )
      }
    >
      <ul className="space-y-1.5">
        {b.itens.map((d, i) => (
          <DestaqueLinha key={d.id} d={d} i={i + 1} />
        ))}
      </ul>
    </Cartao>
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
  const ehEsp = b.trilha === "especialista";
  // um quadrado por passo do guia: no DPP o nº oficial já é o passo; na
  // trilha esp a tentativa que mira o passo (realizado preferido, senão a
  // mais recente) — a régua é passoEsp, o numero cru de tentativa não vaza
  // nem estufa o total (REALIZA-498, mesma regra do encontroDoPassoEsp)
  const representanteEsp = (passo: number) => {
    let alvo: (typeof b.encontros)[number] | undefined;
    for (const e of b.encontros) {
      if (passoEsp(e, b.encontros) !== passo) continue;
      if (
        !alvo ||
        e.status === "realizado" ||
        (alvo.status !== "realizado" && e.numero > alvo.numero)
      )
        alvo = e;
    }
    return alvo;
  };
  const por = new Map(b.encontros.map((e) => [e.numero, e]));
  const total = ehEsp
    ? maxEncontros(b.trilha)
    : Math.max(maxEncontros(b.trilha), ...b.encontros.map((e) => e.numero), 0);
  const estados = Array.from({ length: total }, (_, k) => {
    const e = ehEsp ? representanteEsp(k + 1) : por.get(k + 1);
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
        <p className={EYEBROW}>{ehEsp ? "Sessões" : "Encontros"}</p>
        <p className="text-xs">
          <b className="font-semibold tabular-nums">
            {progressoTrilha({ esp: ehEsp, feitos, total, curta: true })}
          </b>
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
  const sit = situacao(b, b.semaforo, jovem);
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
        {jovem ? "Ver meu início" : "Abrir ficha"}
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
  // agrupa por dia no fuso; sem agendamento vai pro fim
  const grupos: { chave: string; rotulo: string; itens: UiAgenda["encontros"] }[] = [];
  for (const e of b.encontros) {
    const chave = valida(e.data_hora) ? toDateStr(quando(e.data_hora)) : "9999-12-31";
    let g = grupos.find((x) => x.chave === chave);
    if (!g) {
      g = { chave, rotulo: valida(e.data_hora) ? rotuloDia(e.data_hora, agora) : "Sem agendamento", itens: [] };
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

// ---------- plano em dia (REALIZA-397) ----------

const ACAO_PLANO: Record<UiPlano["passos"][number]["acao"], string> = {
  agendar: "sugestão",
  remarcar: "remarcar pra",
  travado: "marcado pra",
};

/** Dobra inicial do card (026): o resto dos passos mora sob o toggle. */
const PASSOS_DOBRA = 4;

/** O custo do plano em pill — o nível nomeado vira o rótulo em palavras
 *  (rotuloRitmo, o mesmo do card da ficha); conversa_coord nomeia o
 *  caminho, não o ritmo. */
const NIVEL_PLANO: Record<
  NonNullable<UiPlano["nivel"]>,
  { rotulo: (ritmo: number | null) => string; tom: Tom }
> = {
  ritmo_normal: { rotulo: (r) => rotuloRitmo(r ?? 1), tom: "neutro" },
  semana_dupla: { rotulo: (r) => rotuloRitmo(r ?? 2), tom: "atencao" },
  semana_tripla: { rotulo: (r) => rotuloRitmo(r ?? 3), tom: "atencao" },
  um_por_dia: { rotulo: (r) => rotuloRitmo(r ?? 7), tom: "atencao" },
  conversa_coord: { rotulo: () => "Conversa com a coordenação", tom: "risco" },
};

/** A leitura da grade semanal (518): quem já marcou e o que falta — o
 *  sinal pra pedir a grade no chat antes de propor (dias_comuns 0 com os
 *  dois lados marcados = grades não se cruzam, a saída é sem_grade). */
function gradeTexto(g: NonNullable<UiPlano["grade"]>): string | null {
  if (g.sem_grade) return "Plano sem a grade de disponibilidade.";
  if (!g.mentor && !g.jovem)
    return "Nenhum lado marcou a disponibilidade semanal ainda: dá pra pedir no chat ou combinar sem ela.";
  if (!g.mentor || !g.jovem)
    return `Só ${g.mentor ? "o mentor" : "o jovem"} marcou a grade: sem a outra as datas não cruzam.`;
  if (g.dias_comuns === 0)
    return "As grades dos dois não se cruzam em nenhum dia: dá pra combinar sem ela.";
  return null;
}

/** O plano de recuperação sai pronto do planner — o card nomeia a dupla,
 *  resume o custo numa dobra e guarda o detalhe a um toque (527): os
 *  bloqueios do combinado (recesso sem decisão, grade faltando) leem
 *  junto do plano e o rascunho do documento abre sob "Ler o combinado",
 *  pra dupla revisar antes de pedir pra publicar. Combinado gravado
 *  vira pill com o aceite único. Quem agenda é a dupla, por isso o
 *  rodapé leva à ficha (a Liza propõe, nunca grava cronograma). */
export function CardPlano({ b, r = rotas(false) }: { b: UiPlano; r?: Rotas }) {
  const agora = useAgora();
  const [aberto, setAberto] = useState(false);
  const [docAberto, setDocAberto] = useState(false);
  const passosId = useId();
  const docId = useId();
  const estado = b.estado ?? (b.em_dia ? "em_dia" : "recuperacao");
  const conversa = estado === "conversa";
  const marcados = b.passos.filter((p) => p.acao === "travado").length;
  const aMarcar = b.passos.length - marcados;
  const resto = b.passos.slice(PASSOS_DOBRA);

  const meta =
    estado === "em_dia"
      ? "em dia"
      : conversa
        ? "não fecha até o encerramento"
        : b.data_recuperacao && valida(b.data_recuperacao)
          ? `em dia ${quandoTexto(b.data_recuperacao, agora)}`
          : undefined;

  const resumo = [
    aMarcar > 0 && plural(aMarcar, "passo a marcar", "passos a marcar"),
    marcados > 0 && `${marcados} já ${marcados === 1 ? "marcado" : "marcados"}`,
    b.pendencias.length > 0 &&
      plural(
        b.pendencias.length,
        "pendência pra resolver antes",
        "pendências pra resolver antes"
      ),
  ]
    .filter(Boolean)
    .join(" · ");

  const passoLi = (p: UiPlano["passos"][number], i: number) => (
    <li
      key={p.numero}
      style={passo(i + 1)}
      className="animate-enter flex items-start gap-2.5 py-2 first:pt-0 last:pb-0"
    >
      <span
        aria-hidden
        className={cn(
          "grid size-7 shrink-0 place-items-center rounded-full font-mono text-[11px] font-semibold tabular-nums",
          p.acao === "travado"
            ? "bg-[var(--ok-bg)] text-[var(--ok-text)] ring-1 ring-[var(--ok-border)]"
            : "bg-[var(--destaque)]/25 text-foreground"
        )}
      >
        {p.numero}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium leading-snug">
          {p.titulo}
        </span>
        <span className="mt-0.5 block text-xs text-muted-foreground">
          {ACAO_PLANO[p.acao]}{" "}
          {valida(p.data) ? diaSemanaCurto(p.data) : "a definir"}
          {valida(p.data_oficial) && p.data_oficial !== p.data
            ? ` · oficial era ${diaMesCurto(p.data_oficial)}`
            : ""}
          {p.vence_no_caminho ? " · vence no caminho" : ""}
        </span>
        {(p.precondicao || p.aviso) && (
          <span className="mt-0.5 block text-xs text-muted-foreground">
            {p.precondicao ? `Precisa antes: ${p.precondicao}` : p.aviso}
          </span>
        )}
      </span>
    </li>
  );

  return (
    <Cartao
      titulo="Para ficar em dia"
      meta={meta}
      rodape={
        <Rodape href={`${r.encontros(b.dupla_id)}#plano-em-dia`}>
          {b.plano ? "Ver o plano na ficha" : "Combinar o plano na ficha"}
        </Rodape>
      }
    >
      {/* a dupla do plano — o card diz de quem é e leva à ficha (026) */}
      <Link
        href={r.ficha(b.dupla_id)}
        className={cn(
          "-mx-1.5 block rounded-md px-1.5 py-1 text-sm font-semibold leading-snug transition-colors hover:bg-muted/60",
          FOCO
        )}
      >
        <DuplaNomes
          mentor={b.mentor ?? "Mentor a definir"}
          mentorado={b.mentorado ?? "Mentorado a definir"}
        />
      </Link>

      {/* resumo do custo sempre visível: nível em pill, conta dos passos
          e das pendências — ninguém descobre pré-requisito só ao abrir */}
      {(b.nivel || resumo) && (
        <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1">
          {b.nivel && (
            <Pill tom={NIVEL_PLANO[b.nivel].tom}>
              {NIVEL_PLANO[b.nivel].rotulo(b.ritmo)}
            </Pill>
          )}
          {resumo && (
            <p className="text-xs text-muted-foreground tabular-nums">{resumo}</p>
          )}
        </div>
      )}

      {conversa && (
        <div className="mt-2 rounded-lg bg-muted/50 px-2.5 py-2">
          <p className="text-sm font-semibold leading-snug">
            {b.data_projetada && valida(b.data_projetada)
              ? `Em dia só em ${formatDate(b.data_projetada)}`
              : "Nem com 1 encontro por dia fecha"}
            {b.encerramento && valida(b.encerramento)
              ? `, depois do encerramento (${formatDate(b.encerramento)})`
              : ""}
            .
          </p>
          {b.cabem_ate_encerramento && (
            <p className="mt-1 text-xs text-muted-foreground tabular-nums">
              Cabem {b.cabem_ate_encerramento.cabem} dos{" "}
              {b.cabem_ate_encerramento.faltam} encontros que faltam
              {b.encerramento && valida(b.encerramento)
                ? " até o encerramento"
                : ""}
              .
            </p>
          )}
        </div>
      )}

      {b.pendencias.length > 0 && (
        <p className="mt-2 rounded-lg bg-muted/50 px-2.5 py-2 text-xs text-muted-foreground">
          Antes do plano: {b.pendencias.map((p) => (
            `${p.numero}º ${p.estado === "limbo" ? "(confirmar se aconteceu)" : "(falta o registro)"}`
          )).join(", ")}.
        </p>
      )}

      {/* o que trava a proposta (527): recesso sem decisão e grade
          faltando leem junto do plano — a plano_propor recusa os dois */}
      {b.recessos_pendentes.length > 0 && (
        <div className="mt-2 rounded-lg bg-[var(--warn-bg)] px-2.5 py-2">
          <p className="text-xs font-semibold text-[var(--warn-text)]">
            A dupla decide sobre{" "}
            {plural(b.recessos_pendentes.length, "o recesso", "os recessos")}{" "}
            antes de propor
          </p>
          <ul className="mt-1 space-y-0.5">
            {b.recessos_pendentes.map((rec) => (
              <li
                key={rec.ciclo_evento_id}
                className="text-xs text-muted-foreground"
              >
                {rec.titulo}
                {valida(rec.inicio)
                  ? `, ${diaMesCurto(rec.inicio)} a ${valida(rec.fim) ? diaMesCurto(rec.fim) : "?"}`
                  : ""}
                : pausa ou segue nos encontros?
              </li>
            ))}
          </ul>
        </div>
      )}

      {b.grade && gradeTexto(b.grade) && (
        <p className="mt-2 flex items-start gap-1.5 text-xs text-muted-foreground">
          <Clock size={13} aria-hidden className="mt-0.5 shrink-0" />
          {gradeTexto(b.grade)}
        </p>
      )}

      {/* rascunho do combinado — a dupla lê o que a proposta grava antes
          de pedir pra publicar (mesma montagem do wizard da aba Agora) */}
      {b.doc && b.doc.length > 0 && (
        <div className="mt-2">
          <AnimatePresence initial={false}>
            {docAberto && (
              <motion.div
                id={docId}
                key="doc"
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={T.panel}
                style={{ overflow: "clip" }}
                className="space-y-3 rounded-lg border border-border/60 bg-background px-3 py-2.5 text-sm"
              >
                <DocBlocos blocos={b.doc} />
              </motion.div>
            )}
          </AnimatePresence>
          <Button
            type="button"
            variant="ghost"
            aria-expanded={docAberto}
            aria-controls={docAberto ? docId : undefined}
            onClick={() => setDocAberto((v) => !v)}
            className="h-auto min-h-11 w-full items-center justify-between gap-2 px-2.5 py-2 text-left text-xs font-semibold hover:bg-muted/50 active:not-aria-[haspopup]:scale-100 md:min-h-11"
          >
            {docAberto ? "Fechar o plano" : "Ler o plano"}
            <CaretDown
              size={14}
              weight="bold"
              aria-hidden
              className={cn(
                "shrink-0 text-muted-foreground transition-transform duration-200 ease-snappy",
                docAberto && "rotate-180"
              )}
            />
          </Button>
        </div>
      )}

      {b.passos.length > 0 && (
        <ol className="mt-1 divide-y divide-border/60">
          {b.passos.slice(0, PASSOS_DOBRA).map(passoLi)}
        </ol>
      )}
      {resto.length > 0 && (
        <>
          {/* o molde do FonteItem: botão real com aria e o painel em
              height auto — reduced-motion sai pelo guard global */}
          <AnimatePresence initial={false}>
            {aberto && (
              <motion.ol
                id={passosId}
                key="resto"
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={T.panel}
                style={{ overflow: "clip" }}
                className="divide-y divide-border/60"
              >
                {resto.map(passoLi)}
              </motion.ol>
            )}
          </AnimatePresence>
          <Button
            type="button"
            variant="ghost"
            aria-expanded={aberto}
            aria-controls={aberto ? passosId : undefined}
            onClick={() => setAberto((v) => !v)}
            className="h-auto min-h-11 w-full items-center justify-between gap-2 px-2.5 py-2 text-left text-xs font-semibold hover:bg-muted/50 active:not-aria-[haspopup]:scale-100 md:min-h-11"
          >
            {aberto ? "Ver menos" : `Ver mais ${resto.length} passos`}
            <CaretDown
              size={14}
              weight="bold"
              aria-hidden
              className={cn(
                "shrink-0 text-muted-foreground transition-transform duration-200 ease-snappy",
                aberto && "rotate-180"
              )}
            />
          </Button>
        </>
      )}
      {b.passos.length === 0 && (
        <Vazio>Nada a marcar: a dupla segue o calendário</Vazio>
      )}

      {b.sugestao && (
        <p className="mt-2 border-t border-border/60 pt-2 text-xs text-muted-foreground">
          {b.sugestao}
        </p>
      )}
      {b.plano && (
        <div className="mt-2 flex flex-wrap items-center gap-1.5 border-t border-border/60 pt-2">
          <Pill tom={TOM_PLANO[b.plano.status] ?? "neutro"}>
            Plano {STATUS_PLANO[b.plano.status] ?? b.plano.status}
          </Pill>
          <span className="text-xs text-muted-foreground">
            {b.plano.versao > 1 ? `v${b.plano.versao}` : ""}
            {b.plano.status === "proposto"
              ? // aceite ÚNICO (0225): um aceite da dupla já põe pra valer —
                // `falta` nomeia quem pode carimbar e os booleans cobrem o
                // row legado da era bilateral (proposto com um carimbo só)
                b.plano.falta === "mentor" ||
                  (b.plano.falta == null && b.plano.aceito_mentorado && !b.plano.aceito_mentor)
                ? " · o aceite do mentor põe pra valer"
                  : b.plano.falta === "mentorado" ||
                      (b.plano.falta == null && b.plano.aceito_mentor && !b.plano.aceito_mentorado)
                    ? " · o aceite do jovem põe pra valer"
                    : `${b.plano.versao > 1 ? " · " : ""}um aceite da dupla põe pra valer`
              : ""}
          </span>
        </div>
      )}
      {b.avisos.length > 0 && (
        <ul className="mt-2 space-y-1 border-t border-border/60 pt-2">
          {b.avisos.map((a) => (
            <li
              key={a}
              className="flex items-start gap-1.5 text-xs text-muted-foreground"
            >
              <WarningCircle size={13} aria-hidden className="mt-0.5 shrink-0" />
              {a}
            </li>
          ))}
        </ul>
      )}
    </Cartao>
  );
}

const STATUS_PLANO: Record<string, string> = {
  proposto: "proposto",
  aceito: "aceito",
  ativo: "em andamento",
  concluido: "concluído",
  expirado: "expirado",
  contestado: "contestado",
};

/** Tom da pill do combinado — proposto pede o aceite (info), o que já
 *  vale lê ok e o que espera revisão lê atenção. */
const TOM_PLANO: Record<string, Tom> = {
  proposto: "info",
  aceito: "ok",
  ativo: "ok",
  contestado: "atencao",
};

// ---------- plano do jovem ----------

/** O combinado como o jovem o vê (0219 — meu_plano): status, ritmo e as
 *  datas — sem semáforo nem motivos internos (o recorte é da RPC). */
export function CardPlanoJovem({ b }: { b: UiPlanoJovem }) {
  const aplicados = new Map(b.passos_aplicados.map((p) => [p.numero, p]));
  return (
    <Cartao
      titulo="O plano"
      meta={STATUS_PLANO[b.status] ?? b.status}
    >
      <p className="text-xs text-muted-foreground">
        {b.ritmo === 1
          ? "1 encontro por semana."
          : `Até ${b.ritmo ?? 2} encontros por semana.`}{" "}
        Confirmem as datas juntos.
      </p>
      <ol className="mt-2 divide-y divide-border/60">
        {b.passos.map((p, i) => {
          const aplicado = aplicados.get(p.numero);
          return (
            <li
              key={p.numero}
              style={passo(i + 1)}
              className="animate-enter flex items-center gap-2.5 py-2 first:pt-0 last:pb-0"
            >
              <span
                aria-hidden
                className={cn(
                  "grid size-7 shrink-0 place-items-center rounded-full font-mono text-[11px] font-semibold tabular-nums",
                  aplicado
                    ? "bg-[var(--ok-bg)] text-[var(--ok-text)] ring-1 ring-[var(--ok-border)]"
                    : "bg-[var(--destaque)]/25 text-foreground"
                )}
              >
                {p.numero}
              </span>
              <span className="min-w-0 flex-1 text-sm">
                {p.numero}º encontro ·{" "}
                <span className="text-muted-foreground">
                  {aplicado
                    ? `marcado pra ${valida(aplicado.data_nova) ? diaSemanaCurto(aplicado.data_nova) : "a definir"}`
                    : `sugestão ${valida(p.data) ? diaSemanaCurto(p.data) : "a definir"}`}
                </span>
              </span>
            </li>
          );
        })}
      </ol>
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
                href={rotaPessoa(m.id)}
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
                href={rotaPessoa(m.id)}
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
                  href={rotaPessoa(m.id)}
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
              href={rotaPessoa(p.id)}
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
    <Cartao titulo="Chamados" rodape={<Rodape href={r.chamados()}>Abrir chamados</Rodape>}>
      <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
        <Contagem n={b.aberto} rotulo={b.aberto === 1 ? "aberto" : "abertos"} dot="bg-[var(--danger)]" texto="text-[var(--danger-text)]" />
        <Contagem n={b.em_atendimento} rotulo="em atendimento" dot="bg-[var(--warn)]" texto="text-[var(--warn-text)]" />
      </ul>
      {b.chamados.length ? (
        <ul className="mt-2.5 divide-y divide-border/60">
          {b.chamados.map((c, i) => {
            const st = STATUS_CHAMADO[c.status];
            return (
              <li key={c.id ?? c.numero} style={passo(i + 1)} className="animate-enter py-2 first:pt-0 last:pb-0">
                <Link
                  href={r.chamados(c.id)}
                  className="-mx-2 block rounded-md px-2 py-0.5 transition-colors hover:bg-muted/60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                >
                  <span className="flex flex-wrap items-center gap-1.5">
                    {/* assunto primeiro, como nas filas — o número CHA não
                        aparece (ruído de protocolo, e o card vai pro jovem
                        também) */}
                    <span className={cn("min-w-0 flex-1 break-words text-sm font-medium leading-snug", !c.assunto && "font-normal text-muted-foreground")}>
                      {c.assunto ?? "Sem assunto"}
                    </span>
                    <Pill tom={st.tom} icone={st.icone}>
                      {CHAMADO_STATUS_LABEL[c.status]}
                    </Pill>
                  </span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">
                    {CHAMADO_CATEGORIA_LABEL[c.categoria]}
                    {valida(c.criado_em) && (
                      <>
                        {" · Aberto "}
                        <time dateTime={c.criado_em}>{tempoRelativo(c.criado_em, agora)}</time>
                      </>
                    )}
                  </span>
                </Link>
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
  // material/ancora do chunk (0165) resolvem documento/<slug>#seção;
  // sem eles cai no destino base do guia
  const meta = metaFonte(f.guia, jovem, f);
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
  aguardando_coord: { rotulo: "no mural", tom: "info" }, // legado da triagem (0158)
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
      meta={`${b.total_respondidos} de ${total} instrumentos`}
      rodape={<Rodape href="/jovem">Abrir sua jornada</Rodape>}
    >
      {total > 0 && (
        <div className="mb-2.5">
          <BarraSegmentada
            altura="md"
            animate
            legenda
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

// ---------- confirmacao (escritas REALIZA-126) ----------

/** Prévia de escrita aguardando o "sim" humano — o card é a ÚNICA via de
 *  approve (o confirmacao_id nunca vai pro modelo, então só este botão
 *  executa). Confirmar chama o endpoint determinístico e o resultado da
 *  escrita fica inline; Cancelar descarta e a prévia expira sozinha.
 *  Uso único: confirmado, recusado, cancelado ou expirado, o card trava. */
/** O que a emitir_link_instrumento devolve além do url (527): quem recebe
 *  e a ponte de WhatsApp pra o card virar o gesto de envio completo. */
type DocFeito = {
  token: string;
  sistema: string;
  url: string;
  remetente: "mentor" | "equipe";
  jovem: { nome: string | null; whatsapp: string | null } | null;
  mentor: { nome: string | null; whatsapp: string | null } | null;
};

export function CardConfirmacao({ b }: { b: UiConfirmacao }) {
  type Estado =
    | "pendente"
    | "enviando"
    | "feito"
    | "erro"
    | "cancelado"
    | "expirado";
  const [estado, setEstado] = useState<Estado>("pendente");
  const [detalhe, setDetalhe] = useState<string | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [doc, setDoc] = useState<DocFeito | null>(null);
  const origem = useOrigem();
  // o prazo visual espelha o do banco (a linha tem expira_em) — vencer
  // aqui poupa um clique fadado a falhar no servidor
  const [expiraEm] = useState(() => Date.now() + b.expira_em_minutos * 60_000);
  useEffect(() => {
    if (estado !== "pendente") return;
    const t = setTimeout(
      () => setEstado("expirado"),
      Math.max(expiraEm - Date.now(), 0)
    );
    return () => clearTimeout(t);
  }, [estado, expiraEm]);

  async function confirmar() {
    setEstado("enviando");
    setDetalhe(null);
    try {
      const res = await fetch("/api/ia/confirmacao", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          confirmacao_id: b.confirmacao_id,
          tool: b.tool,
          args: b.args,
          request_id: b.request_id,
        }),
      });
      const j = (await res.json().catch(() => null)) as
        | {
            ok?: boolean;
            erro?: string;
            dados?: ({ url?: string | null } & Partial<DocFeito>) | null;
          }
        | null;
      if (!res.ok || !j) {
        // falha de transporte não consumiu a prévia — volta pra tentar
        setDetalhe("Não consegui concluir. Tente de novo.");
        setEstado("pendente");
        return;
      }
      if (j.ok) {
        const dados = j.dados;
        setUrl(dados?.url ?? null);
        // card de documento (527): token+sistema = emitir_link_instrumento
        setDoc(
          dados?.token && dados.sistema && dados.url
            ? {
                token: dados.token,
                sistema: dados.sistema,
                url: dados.url,
                remetente: dados.remetente === "mentor" ? "mentor" : "equipe",
                jovem: dados.jovem ?? null,
                mentor: dados.mentor ?? null,
              }
            : null
        );
        setEstado("feito");
      } else {
        // o servidor é quem sabe: recusa de domínio consumiu a prévia e
        // inválida/expirada/usada já não prestava — as duas encerram o card
        setDetalhe(j.erro ?? "Não foi possível confirmar.");
        setEstado("erro");
      }
    } catch {
      setDetalhe("Falha de rede. Tente de novo.");
      setEstado("pendente");
    }
  }

  return (
    <Cartao
      titulo="Confirmação pendente"
      meta={
        estado === "pendente" || estado === "enviando"
          ? `expira em ${b.expira_em_minutos} min`
          : undefined
      }
    >
      <p className="text-sm leading-snug">{b.resumo}</p>
      {estado === "feito" && doc ? (
        <BlocoDocFeito doc={doc} origem={origem} />
      ) : estado === "feito" ? (
        <div className="mt-2.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm font-medium text-[var(--ok-text)]">
          <CheckCircle size={16} aria-hidden className="shrink-0" />
          Feito.
          {url && (
            <a
              href={url}
              target="_blank"
              rel="noreferrer"
              className={cn(
                "rounded-sm font-semibold text-foreground underline-offset-2 hover:underline",
                FOCO
              )}
            >
              {url}
            </a>
          )}
        </div>
      ) : estado === "erro" ? (
        <p className="mt-2.5 flex items-start gap-1.5 text-sm text-[var(--danger-text)]">
          <WarningCircle size={16} aria-hidden className="mt-0.5 shrink-0" />
          {detalhe}
        </p>
      ) : estado === "cancelado" ? (
        <p className="mt-2.5 text-sm text-muted-foreground">
          Cancelado. Nada foi alterado.
        </p>
      ) : estado === "expirado" ? (
        <p className="mt-2.5 flex items-center gap-1.5 text-sm text-muted-foreground">
          <Clock size={16} aria-hidden className="shrink-0" />
          A prévia expirou. Peça a ação de novo.
        </p>
      ) : (
        <>
          <div className="mt-2.5 flex items-center gap-2">
            <Button
              size="sm"
              onClick={confirmar}
              disabled={estado === "enviando"}
            >
              {estado === "enviando" ? "Confirmando…" : "Confirmar"}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setEstado("cancelado")}
              disabled={estado === "enviando"}
            >
              Cancelar
            </Button>
          </div>
          {detalhe && (
            <p className="mt-2 text-xs text-[var(--danger-text)]">{detalhe}</p>
          )}
        </>
      )}
    </Cartao>
  );
}

/** O link emitido pronto pra sair (527): o título do instrumento, a URL
 *  pra copiar e o WhatsApp já com a mensagem — direto pro jovem quando
 *  ele tem número; repasse pelo mentor quando não tem (a mensagem pede a
 *  ponte, como o lote da ficha); sem nenhum número, só o copiar. */
function BlocoDocFeito({ doc, origem }: { doc: DocFeito; origem: string }) {
  const titulo =
    INSTRUMENTO_INFO[doc.sistema as keyof typeof INSTRUMENTO_INFO]?.titulo ??
    doc.sistema;
  const wa = doc.jovem?.whatsapp
    ? {
        href: waLink(
          doc.jovem.whatsapp,
          msgLinkWhatsApp(
            titulo,
            doc.jovem.nome,
            doc.token,
            origem,
            doc.remetente === "mentor"
              ? (doc.mentor?.nome ?? undefined)
              : undefined
          )
        ),
        repasse: false,
      }
    : doc.mentor?.whatsapp && doc.jovem
      ? {
          href: waLink(
            doc.mentor.whatsapp,
            msgLinkWhatsAppRepasse(
              titulo,
              doc.mentor.nome,
              doc.jovem.nome,
              doc.token,
              origem
            )
          ),
          repasse: true,
        }
      : null;
  return (
    <div className="mt-2.5">
      <p className="flex items-start gap-1.5 text-sm font-medium text-[var(--ok-text)]">
        <CheckCircle size={16} aria-hidden className="mt-0.5 shrink-0" />
        Link de &quot;{titulo}&quot; pronto
        {doc.jovem?.nome ? ` pra ${primeiroNomeLink(doc.jovem.nome)}` : ""}.
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <code className="rounded-md bg-muted px-1.5 py-1 font-mono text-xs">
          {doc.url}
        </code>
        <CopiarLink token={doc.token} />
        {wa?.href && (
          <a
            href={wa.href}
            target="_blank"
            rel="noreferrer"
            className={cn(
              buttonVariants({ variant: "outline", size: "sm" }),
              "gap-1.5"
            )}
          >
            <WhatsappLogo aria-hidden />
            WhatsApp{wa.repasse ? " pro mentor" : ""}
          </a>
        )}
      </div>
      {wa?.repasse && doc.jovem?.nome && (
        <p className="mt-1.5 text-xs text-muted-foreground">
          {primeiroNomeLink(doc.jovem.nome)} não tem WhatsApp cadastrado: a
          mensagem pede o repasse.
        </p>
      )}
      {!wa && (
        <p className="mt-1.5 text-xs text-muted-foreground">
          Sem WhatsApp cadastrado na dupla: copie o link e envie pelo canal
          de sempre.
        </p>
      )}
    </div>
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
