"use client";

import { type CSSProperties, useState } from "react";
import Link from "next/link";
import { Funnel, MagnifyingGlass, Users } from "@phosphor-icons/react";
import { maxEncontros, saudadeDaDupla, TRILHA_LABEL } from "@/lib/ciclo";
import type { CicloEvento, Dupla } from "@/lib/types";
import { cn, normaliza } from "@/lib/utils";
import { DuplaAvatares } from "@/components/dupla-avatares";
import { DuplaNomes } from "@/components/dupla-nomes";
import { SemaforoDot } from "@/components/semaforo";
import { NovaDuplaDialog } from "@/components/nova-dupla-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const STATUS_LABEL: Record<string, string> = {
  ativa: "Ativa",
  pausada: "Pausada",
  concluida: "Concluída",
  encerrada: "Encerrada",
};

type Filtro = "todas" | "risco" | "atencao" | "pausada" | "andamento";

const CHIPS: { id: Filtro; label: string; dot: string | null }[] = [
  { id: "todas", label: "Todas", dot: null },
  { id: "risco", label: "Risco", dot: "bg-[var(--danger)]" },
  { id: "atencao", label: "Atenção", dot: "bg-[var(--warn)]" },
  { id: "pausada", label: "Pausadas", dot: "bg-muted-foreground/40" },
  { id: "andamento", label: "Em andamento", dot: "bg-[var(--ok)]" },
];

function chipBate(f: Filtro, d: Dupla, semaforo: string): boolean {
  switch (f) {
    case "todas":
      return true;
    case "risco":
      return semaforo === "risco";
    case "atencao":
      return semaforo === "atencao";
    case "pausada":
      return d.status === "pausada";
    case "andamento":
      return d.status === "ativa" && semaforo === "ok";
  }
}

const ORDEM_SEMAFORO = { risco: 0, atencao: 1, ok: 2 } as const;
const ORDEM_STATUS = { ativa: 0, pausada: 1, concluida: 2, encerrada: 3 } as const;

export function DuplasLista({
  lista,
  eventos,
  agora,
  podeCriar = false,
  mostrarSupervisor = true,
  paraMentor = false,
}: {
  lista: Dupla[];
  eventos: CicloEvento[];
  /** ISO timestamp vindo do server — hidratação idêntica ao render do servidor. */
  agora: string;
  podeCriar?: boolean;
  /** false na visão do supervisor: a lista já é filtrada por ele, então
   *  "Supervisor: {ele mesmo}" seria prefixo constante em toda linha. */
  mostrarSupervisor?: boolean;
  /** true na visão do mentor: o próprio pedido de apoio não é "risco" —
   *  pra quem pediu, o estado é "solicitado" e a resposta vem da coordenação */
  paraMentor?: boolean;
}) {
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState<Filtro>("todas");
  const hoje = new Date(agora);

  // saúde calculada uma vez por dupla — ordenação, chips e a linha leem daqui
  const saudePorId = new Map(lista.map((d) => [d.id, saudadeDaDupla(d, eventos, hoje)]));
  // pra coordenação a ordem default é pendências primeiro (risco → atenção →
  // em dia; ativas antes de pausadas/encerradas) — a lista dela é radar
  const ordenadas = podeCriar
    ? [...lista].sort(
        (a, b) =>
          ORDEM_SEMAFORO[saudePorId.get(a.id)!.semaforo] -
            ORDEM_SEMAFORO[saudePorId.get(b.id)!.semaforo] ||
          (ORDEM_STATUS[a.status] ?? 4) - (ORDEM_STATUS[b.status] ?? 4)
      )
    : lista;

  const q = normaliza(busca.trim());
  const base = q
    ? ordenadas.filter(
        (d) =>
          normaliza(d.mentor.nome).includes(q) ||
          normaliza(d.mentorado.nome).includes(q)
      )
    : ordenadas;
  // o chip filtra sobre o mesmo universo da busca — e o contador dele é o
  // "quantas do que estou vendo entram nesse estado"
  const exibidas = base.filter((d) =>
    chipBate(filtro, d, saudePorId.get(d.id)!.semaforo)
  );
  const mostrarChips = !paraMentor && lista.length > 1;

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-0 flex-1 basis-full sm:basis-0 sm:max-w-sm">
          <MagnifyingGlass
            aria-hidden
            size={16}
            className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            type="search"
            aria-label="Buscar dupla"
            placeholder="Buscar por mentor ou mentorado"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="pl-8"
          />
        </div>
        {podeCriar && <NovaDuplaDialog />}
      </div>

      {/* semáforo/status como chips — um toque filtra, um toque no ativo volta;
          contagens sobre o mesmo universo da busca */}
      {mostrarChips && (
        <div
          role="group"
          aria-label="Filtrar por situação"
          className="mt-2 flex flex-wrap items-center gap-1.5"
        >
          {CHIPS.map((c) => {
            const n = base.filter((d) =>
              chipBate(c.id, d, saudePorId.get(d.id)!.semaforo)
            ).length;
            const ativo = filtro === c.id;
            return (
              <button
                key={c.id}
                type="button"
                aria-pressed={ativo}
                onClick={() => setFiltro(ativo ? "todas" : c.id)}
                className={cn(
                  "flex min-h-9 items-center gap-1.5 rounded-full px-3 text-sm transition-colors",
                  ativo
                    ? "bg-foreground text-background"
                    : "bg-muted text-muted-foreground hover:text-foreground"
                )}
              >
                {c.dot && (
                  <span aria-hidden className={cn("size-1.5 rounded-full", c.dot)} />
                )}
                {c.label}
                <span
                  className={cn(
                    "text-[11px]",
                    ativo ? "text-background/70" : "text-muted-foreground/70"
                  )}
                >
                  {n}
                </span>
              </button>
            );
          })}
        </div>
      )}

      <div className="mt-4 rounded-xl bg-card divide-y divide-border overflow-hidden shadow-[var(--shadow-border)]">
        {lista.length === 0 && (
          <div className="px-5 py-12 text-center">
            <Users
              aria-hidden
              size={32}
              weight="regular"
              className="mx-auto text-muted-foreground"
            />
            <p className="mt-3 font-medium text-foreground">Nenhuma dupla formada ainda.</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {podeCriar
                ? "Monte a primeira dupla do programa escolhendo mentor e mentorado."
                : "A coordenação monta as duplas; elas aparecem aqui."}
            </p>
            {/* vazio não é beco: o CTA real mora aqui, não só no topo da página */}
            {podeCriar && (
              <div className="mt-4 flex justify-center">
                <NovaDuplaDialog />
              </div>
            )}
          </div>
        )}
        {lista.length > 0 && base.length === 0 && (
          <div className="px-5 py-12 text-center">
            <MagnifyingGlass
              aria-hidden
              size={32}
              weight="regular"
              className="mx-auto text-muted-foreground"
            />
            <p className="mt-3 font-medium text-foreground">
              Nenhum resultado para “{busca.trim()}”.
            </p>
            {/* o placeholder acima já diz que a busca cobre mentor e mentorado */}
            <p className="mt-1 text-sm text-muted-foreground">Tente outro nome.</p>
            <Button
              variant="outline"
              size="sm"
              className="mt-4"
              onClick={() => setBusca("")}
            >
              Limpar busca
            </Button>
          </div>
        )}
        {lista.length > 0 && base.length > 0 && exibidas.length === 0 && (
          <div className="px-5 py-12 text-center">
            <Funnel
              aria-hidden
              size={32}
              weight="regular"
              className="mx-auto text-muted-foreground"
            />
            <p className="mt-3 font-medium text-foreground">
              Nenhuma dupla nessa situação.
            </p>
            <Button
              variant="outline"
              size="sm"
              className="mt-4"
              onClick={() => setFiltro("todas")}
            >
              Limpar filtro
            </Button>
          </div>
        )}
        {exibidas.map((d, i) => {
          const saude = saudePorId.get(d.id)!;
          const feitos = d.encontros.filter((e) => e.status === "realizado").length;
          // denominador da trilha da dupla — 16 no DPP, 5 no especialista
          const totalDaDupla = maxEncontros(d.trilha);
          const progresso = totalDaDupla > 0 ? Math.min(feitos / totalDaDupla, 1) : 0;
          // dupla fora do radar (pausada/encerrada sem pedido de apoio): o motivo
          // é literalmente o status — o chip da coluna-meta já o diz; o "Mentor
          // pediu apoio" da pausada-com-apoio (risco) precisa ficar (CC-5)
          const motivo =
            d.status !== "ativa" && saude.semaforo === "ok" ? null : saude.motivo;
          // pedido de apoio do próprio mentor: apoio solicitado, não alarme
          const apoioProprio = paraMentor && saude.pediuApoio;
          const nivel = apoioProprio ? "atencao" : saude.semaforo;
          const motivoExibido = apoioProprio ? "Apoio solicitado" : motivo;
          const sub = [
            mostrarSupervisor && d.supervisor ? `Supervisor: ${d.supervisor.nome}` : null,
            motivoExibido,
          ]
            .filter(Boolean)
            .join(" · ");
          return (
            <Link
              key={d.id}
              href={`/duplas/${d.id}`}
              style={{ "--i": Math.min(i, 10) } as CSSProperties}
              className="animate-enter flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-4 transition-colors hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
            >
              <SemaforoDot nivel={nivel} />
              {/* o par de discos é a identidade da dupla — reforça quem são
                  antes do nome (o link inteiro já leva à ficha) */}
              <DuplaAvatares mentor={d.mentor} mentorado={d.mentorado} size={36} />
              <div className="min-w-0 flex-1">
                <p className="flex min-w-0 items-center gap-1 font-semibold">
                  <DuplaNomes truncar mentor={d.mentor.nome} mentorado={d.mentorado.nome} />
                  {/* especialista é a exceção à escala /16 — a marca evita
                      ler "2/5" como erro de dado */}
                  {d.trilha === "especialista" && (
                    <span className="shrink-0 rounded-full bg-muted px-1.5 py-px text-[10px] font-medium text-muted-foreground">
                      {TRILHA_LABEL[d.trilha]}
                    </span>
                  )}
                </p>
                {sub && (
                  <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>
                )}
              </div>
              {/* uma zona de meta só: n/N + barra + status empilham à direita;
                  no mobile caem pra linha própria sob os nomes (pl-20 ≈ dot
                  10 + gap 16 + avatar 36 + gap 16 = 78px) */}
              <div className="flex w-16 shrink-0 flex-col items-end gap-1 max-sm:order-4 max-sm:basis-full max-sm:w-full max-sm:flex-row max-sm:items-center max-sm:gap-2 max-sm:pl-20 sm:w-20">
                <span className="font-mono text-xs text-muted-foreground tabular-nums">
                  {feitos}/{totalDaDupla}
                </span>
                <div
                  role="progressbar"
                  aria-valuenow={feitos}
                  aria-valuemin={0}
                  aria-valuemax={totalDaDupla}
                  aria-label={`${feitos} de ${totalDaDupla} encontros`}
                  className="h-1 w-full overflow-hidden rounded-full bg-muted"
                >
                  <div
                    className="h-full rounded-full bg-[var(--brand-lime)]"
                    style={{ width: `${progresso * 100}%` }}
                  />
                </div>
                <span className="text-xs text-muted-foreground capitalize">
                  {STATUS_LABEL[d.status] ?? d.status}
                </span>
              </div>
            </Link>
          );
        })}
      </div>
    </>
  );
}
