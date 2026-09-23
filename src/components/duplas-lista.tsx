"use client";

import { type CSSProperties, useState } from "react";
import Link from "next/link";
import { MagnifyingGlass, Users } from "@phosphor-icons/react";
import { maxEncontros, saudadeDaDupla, TRILHA_LABEL } from "@/lib/ciclo";
import type { CicloEvento, Dupla } from "@/lib/types";
import { normaliza } from "@/lib/utils";
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
                ? "Monte a primeira dupla do programa escolhendo mentor e mentorado."
                : "A coordenação monta as duplas — elas aparecem aqui."}
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
