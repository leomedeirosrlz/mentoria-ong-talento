"use client";

import { type CSSProperties, useState } from "react";
import Link from "next/link";
import { MagnifyingGlass, Users } from "@phosphor-icons/react";
import { saudadeDaDupla, totalEncontros } from "@/lib/ciclo";
import type { CicloEvento, Dupla } from "@/lib/types";
import { normaliza } from "@/lib/utils";
import { DuplaNomes } from "@/components/dupla-nomes";
import { SemaforoDot } from "@/components/semaforo";
import { NovaDuplaDialog } from "@/components/nova-dupla-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const STATUS_LABEL: Record<string, string> = {
  ativa: "Ativa",
  pausada: "Pausada",
  encerrada: "Encerrada",
};

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
  const hoje = new Date(agora);
  const total = totalEncontros(eventos);

  const q = normaliza(busca.trim());
  const filtradas = q
    ? lista.filter(
        (d) =>
          normaliza(d.mentor.nome).includes(q) ||
          normaliza(d.mentorado.nome).includes(q)
      )
    : lista;

  return (
    <>
      <div className="flex items-center gap-2">
        <div className="relative min-w-0 flex-1 sm:max-w-sm">
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

      <div className="rounded-xl bg-card divide-y divide-border overflow-hidden shadow-[var(--shadow-border)]">
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
                ? "Monte a primeira dupla do ciclo escolhendo mentor e mentorado."
                : "A coordenação forma as duplas no matching — elas aparecem aqui."}
            </p>
            {/* vazio não é beco: o CTA real mora aqui, não só no topo da página */}
            {podeCriar && (
              <div className="mt-4 flex justify-center">
                <NovaDuplaDialog />
              </div>
            )}
          </div>
        )}
        {lista.length > 0 && filtradas.length === 0 && (
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
        {filtradas.map((d, i) => {
          const saude = saudadeDaDupla(d, eventos, hoje);
          const feitos = d.encontros.filter((e) => e.status === "realizado").length;
          const progresso = total > 0 ? Math.min(feitos / total, 1) : 0;
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
              className="animate-enter flex items-center gap-4 px-5 py-4 transition-colors hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
            >
              <SemaforoDot nivel={nivel} />
              <div className="min-w-0 flex-1">
                <p className="font-semibold truncate">
                  <DuplaNomes mentor={d.mentor.nome} mentorado={d.mentorado.nome} />
                </p>
                {sub && (
                  <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>
                )}
              </div>
              {/* uma zona de meta só: n/N + barra + status empilham à direita */}
              <div className="flex w-16 shrink-0 flex-col items-end gap-1 sm:w-20">
                <span className="font-mono text-xs text-muted-foreground tabular-nums">
                  {feitos}/{total}
                </span>
                <div
                  role="progressbar"
                  aria-valuenow={feitos}
                  aria-valuemin={0}
                  aria-valuemax={total}
                  aria-label={`${feitos} de ${total} encontros`}
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
