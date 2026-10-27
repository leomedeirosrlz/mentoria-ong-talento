// Hub de turmas da home (REALIZA-73): um card por turma navegável — a
// entrada pro contexto de turma (`?turma=<label>`). `TurmaHubCard` é a
// versão leve do `TurmaCard` (sem banner ink/dial): nome canônico +
// sigla + ano, cronograma vigente + status e as contagens do recorte
// (mesma `saudeDoRecorte` de sempre — nenhum número novo nasce aqui).
// Com foco ativo, a faixa "Mostrando: …" (role=status) anuncia o recorte
// e entrega a saída óbvia; o card da turma em foco leva ring +
// aria-current. O hub fica sempre visível quando há mais de uma turma —
// é o mapa do programa, não um estado (design.md).

import Link from "next/link";
import type { CSSProperties } from "react";
import {
  cronogramaVigente,
  eventoDaSemana,
  eventosDoCronograma,
  formatDiaSemanaMes,
} from "@/lib/ciclo";
import { saudeDoRecorte } from "@/lib/agenda-coordenacao";
import { turmaAno, turmaDaDupla, turmaLonga } from "@/lib/turma";
import type { CicloEvento, Cronograma, Dupla } from "@/lib/types";
import { cn } from "@/lib/utils";
import { StatusBadge } from "@/components/cronograma-editor";
import { SiglaTurma } from "@/components/turma-card";

/** A faixa "Mostrando: Turma N · ver todas" — role=status anuncia o
 *  recorte ativo e entrega a saída óbvia; sem ela o foco "gruda"
 *  invisível (o "cadê a T1?" do plan.md). Só renderiza com foco ativo.
 *  `hrefTodas` decide pra onde o "ver todas" aponta — a home é o hub, mas
 *  página que honra `?turma=` própria (a /duplas) limpa em lugar. */
export function FaixaTurmaFoco({
  foco,
  hrefTodas = "/?turma=todas",
}: {
  foco: string | null;
  hrefTodas?: string;
}) {
  if (foco == null) return null;
  return (
    <p role="status" className="text-sm text-muted-foreground">
      Mostrando:{" "}
      <b className="font-semibold text-foreground">
        {turmaLonga(foco)}
        {turmaAno(foco) ? ` · ${turmaAno(foco)}` : ""}
      </b>
      {" · "}
      <Link
        href={hrefTodas}
        className="rounded-sm font-semibold text-foreground underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        ver todas
      </Link>
    </p>
  );
}

/** Auxiliar mono-turma (design.md §permissão): sem escolha a fazer, a faixa
 *  só nomeia o contexto dele — "Sua turma: Turma 2 · 2026/2027", sem saída. */
export function FaixaTurmaEscopo({ turma }: { turma: string }) {
  return (
    <p className="text-sm text-muted-foreground">
      Sua turma:{" "}
      <b className="font-semibold text-foreground">
        {turmaLonga(turma)}
        {turmaAno(turma) ? ` · ${turmaAno(turma)}` : ""}
      </b>
    </p>
  );
}

export function TurmaHub({
  turmas,
  foco,
  cronogramas,
  duplas,
  eventos,
  agora,
}: {
  /** labels do hub — as navegáveis + a turma em foco quando ela não é
   *  navegável (encerrada com contexto ativo continua visível). */
  turmas: readonly string[];
  /** label em foco — null = "todas" (nenhum card marcado). */
  foco: string | null;
  cronogramas: Cronograma[];
  /** duplas do ESCOPO da página (todas as da coordenação / as do
   *  auxiliar) — o card conta o recorte da turma dentro dele. */
  duplas: Dupla[];
  eventos: CicloEvento[];
  /** ISO vindo do server — o mesmo instante do resto da página. */
  agora: string;
}) {
  const hoje = new Date(agora);
  return (
    <section aria-label="Turmas" className="animate-enter space-y-3">
      <FaixaTurmaFoco foco={foco} />
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {turmas.map((t, i) => (
          <li key={t} className="min-w-0">
            <TurmaHubCard
              turma={t}
              cronogramas={cronogramas.filter((c) => c.turma === t)}
              duplas={duplas.filter(
                (d) => turmaDaDupla(d, cronogramas) === t
              )}
              eventos={eventos}
              hoje={hoje}
              ativa={foco === t}
              i={i}
            />
          </li>
        ))}
      </ul>
    </section>
  );
}

export function TurmaHubCard({
  turma,
  cronogramas,
  duplas,
  eventos,
  hoje,
  ativa = false,
  i = 0,
}: {
  /** label cru (`cronogramas.turma`) — a turma do recorte. As duplas
   *  chegam filtradas por `turmaDaDupla` (rótulo vivo), não pelo selo. */
  turma: string;
  /** cronogramas já filtrados pra turma (uma turma pode ter dois). */
  cronogramas: Cronograma[];
  /** duplas já filtradas pra turma. */
  duplas: Dupla[];
  eventos: CicloEvento[];
  hoje: Date;
  /** card do contexto ativo — ring + aria-current. */
  ativa?: boolean;
  /** índice do stagger de entrada (--i). */
  i?: number;
}) {
  const vigente = cronogramaVigente(cronogramas, hoje);
  const vig =
    vigente?.status === "ativo"
      ? eventoDaSemana(eventosDoCronograma(eventos, vigente.id), hoje)
      : null;
  const saude = saudeDoRecorte(duplas, eventos, hoje);
  const ano = turmaAno(turma);
  const nome = turmaLonga(turma);

  return (
    <Link
      href={`/?turma=${encodeURIComponent(turma)}`}
      aria-current={ativa ? "page" : undefined}
      aria-label={`${nome}${ano ? ` · ${ano}` : ""}, ${saude.emAndamento} ${
        saude.emAndamento === 1 ? "dupla ativa" : "duplas ativas"
      }`}
      style={{ "--i": Math.min(i, 10) } as CSSProperties}
      className={cn(
        "animate-enter group flex h-full flex-col rounded-xl bg-card px-4 py-3.5 shadow-[var(--shadow-border)] transition-[box-shadow,translate] duration-200 ease-snappy hover:-translate-y-px hover:shadow-[var(--shadow-border-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:px-5",
        ativa && "ring-2 ring-[var(--brand-lime)]"
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <p className="min-w-0 font-semibold tracking-tight">
          {nome}
          <SiglaTurma turma={turma} className="ml-1.5" />
        </p>
        {vigente && <StatusBadge status={vigente.status} />}
      </div>
      <p className="mt-0.5 text-xs text-muted-foreground">
        {[ano ? `Ciclo ${ano}` : null, vigente?.nome ?? null]
          .filter(Boolean)
          .join(" · ") || "Sem cronograma"}
      </p>
      {vig?.numero != null && (
        <p className="mt-1.5 text-sm text-muted-foreground">
          Semana do encontro {vig.numero} · {formatDiaSemanaMes(vig.data)}
        </p>
      )}
      <p className="mt-1.5 text-sm text-muted-foreground">
        <b className="font-semibold tabular-nums text-foreground">
          {saude.emAndamento}
        </b>{" "}
        {saude.emAndamento === 1 ? "dupla ativa" : "duplas ativas"}
        {saude.pausadas + saude.concluidas > 0 &&
          ` · ${saude.pausadas + saude.concluidas} pausadas ou concluídas`}
        {saude.risco > 0 && (
          <span className="font-semibold text-[var(--danger-text)]">
            {" "}
            · {saude.risco} em risco
          </span>
        )}
        {saude.atencao > 0 && (
          <span className="font-semibold text-[var(--warn-text)]">
            {" "}
            · {saude.atencao} em atenção
          </span>
        )}
        {saude.apoio > 0 && (
          <span className="font-semibold text-[var(--info-text)]">
            {" "}
            · {saude.apoio} apoio aberto
          </span>
        )}
      </p>
    </Link>
  );
}
