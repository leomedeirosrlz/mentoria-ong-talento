"use client";

import { type CSSProperties, useState } from "react";
import Link from "next/link";
import { ArrowRight, Funnel, MagnifyingGlass } from "@phosphor-icons/react";
import { comparaNome, eventosDoCronograma, ORDEM_SEMAFORO, saudadeDaDupla, totalDaTrilha, TRILHA_LABEL } from "@/lib/ciclo";
import type { CicloEvento, Dupla } from "@/lib/types";
import { cn, normaliza } from "@/lib/utils";
import { DuplaAvatares } from "@/components/dupla-avatares";
import { DuplaNomes } from "@/components/dupla-nomes";
import { SemaforoDot } from "@/components/semaforo";
import { NovaDuplaDialog } from "@/components/nova-dupla-dialog";
import { ImportarCsvDialog } from "@/components/importar-csv-dialog";
import { Button } from "@/components/ui/button";
import { filterChipCls } from "@/components/ui/filter-chip";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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


const ORDEM_STATUS = { ativa: 0, pausada: 1, concluida: 2, encerrada: 3 } as const;

type Ordem = "prioridade" | "mentor" | "mentorado" | "progresso";

const ORDEM_LABEL: Record<Ordem, string> = {
  prioridade: "Prioridade",
  mentor: "Mentor A–Z",
  mentorado: "Mentorado A–Z",
  progresso: "Progresso",
};

/** progresso = encontros realizados / total do cronograma da dupla (0061) */
function progressoDe(d: Dupla, eventos: CicloEvento[]): number {
  const total = totalDaTrilha(d.trilha, eventosDoCronograma(eventos, d.cronograma_id));
  if (total <= 0) return 0;
  return d.encontros.filter((e) => e.status === "realizado").length / total;
}

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
  const [ordem, setOrdem] = useState<Ordem>("prioridade");
  const [turmaSel, setTurmaSel] = useState<string | null>(null);
  const hoje = new Date(agora);

  // turmas presentes na lista — com T1+T2 paralelas a coord precisa recortar
  // por turma (0061); com uma só, o filtro não agrega nada e não aparece
  const turmas = [
    ...new Set(lista.map((d) => d.turma).filter((t): t is string => !!t)),
  ].sort((a, b) => a.localeCompare(b, "pt-BR"));

  // saúde calculada uma vez por dupla — ordenação, chips e a linha leem daqui
  const saudePorId = new Map(lista.map((d) => [d.id, saudadeDaDupla(d, eventos, hoje)]));
  // o nível que a linha mostra: pro mentor, o próprio pedido de apoio vira
  // "solicitado" (atenção), não risco — a prioridade ordena pelo que se vê
  const nivelDe = (d: Dupla) => {
    const s = saudePorId.get(d.id)!;
    return paraMentor && s.pediuApoio ? "atencao" : s.semaforo;
  };
  // a ordem default é pendências primeiro (risco → atenção → em dia; ativas
  // antes de pausadas/encerradas) — a lista é radar; as demais ordens
  // desempatam por ela pra não parecerem aleatórias
  const porPrioridade = (a: Dupla, b: Dupla) =>
    ORDEM_SEMAFORO[nivelDe(a)] - ORDEM_SEMAFORO[nivelDe(b)] ||
    (ORDEM_STATUS[a.status] ?? 4) - (ORDEM_STATUS[b.status] ?? 4) ||
    comparaNome(a.mentor.nome, b.mentor.nome) ||
    comparaNome(a.mentorado.nome, b.mentorado.nome);
  const ordenadas = [...lista].sort(
    ordem === "mentor"
      ? (a, b) => comparaNome(a.mentor.nome, b.mentor.nome) || porPrioridade(a, b)
      : ordem === "mentorado"
        ? (a, b) => comparaNome(a.mentorado.nome, b.mentorado.nome) || porPrioridade(a, b)
        : ordem === "progresso"
          ? (a, b) => progressoDe(b, eventos) - progressoDe(a, eventos) || porPrioridade(a, b)
          : porPrioridade
  );

  const q = normaliza(busca.trim());
  const base = ordenadas.filter(
    (d) =>
      (!turmaSel || d.turma === turmaSel) &&
      (!q ||
        normaliza(d.mentor.nome).includes(q) ||
        normaliza(d.mentorado.nome).includes(q))
  );
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
        {/* ordenar é de toda a lista — visível pra coord/supervisor/mentor,
            escondido só quando não há o que ordenar */}
        {lista.length > 1 && (
          <Select
            value={ordem}
            onValueChange={(v) => setOrdem(v as Ordem)}
            items={ORDEM_LABEL}
          >
            <SelectTrigger
              size="sm"
              aria-label="Ordenar"
              className="w-auto sm:w-40"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent alignItemWithTrigger={false}>
              {(Object.entries(ORDEM_LABEL) as [Ordem, string][]).map(
                ([v, l]) => (
                  <SelectItem key={v} value={v}>
                    {l}
                  </SelectItem>
                )
              )}
            </SelectContent>
          </Select>
        )}
        {podeCriar && (
          <>
            {/* pareamento em lote: o CSV de mentor×mentorado entra por aqui,
                no mesmo dialog de importação de pessoas */}
            <ImportarCsvDialog tipoInicial="duplas" />
            <NovaDuplaDialog />
          </>
        )}
      </div>

      {/* turmas em paralelo: o recorte por turma é dimensão própria — semáforo
          filtra dentro dela (ex.: "em risco da T2"). Os dois grupos levam
          rótulo visível ("Turma" / "Situação") — duas fileiras de chips
          idênticas sem nome eram indistinguíveis */}
      {turmas.length > 1 && (
        <div
          role="group"
          aria-labelledby="flt-turma"
          className="mt-2 flex flex-wrap items-center gap-1.5"
        >
          <span
            id="flt-turma"
            className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground"
          >
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
                  turmaSel === t
                    ? "text-background/70"
                    : "text-muted-foreground/70"
                )}
              >
                {lista.filter((d) => d.turma === t).length}
              </span>
            </button>
          ))}
        </div>
      )}

      {/* semáforo/status como chips — um toque filtra, um toque no ativo volta;
          contagens sobre o mesmo universo da busca */}
      {mostrarChips && (
        <div
          role="group"
          aria-labelledby="flt-situacao"
          className="mt-2 flex flex-wrap items-center gap-1.5"
        >
          <span
            id="flt-situacao"
            className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground"
          >
            Situação
          </span>
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
                className={filterChipCls(ativo)}
              >
                {c.dot && (
                  <span aria-hidden className={cn("size-1.5 rounded-full", c.dot)} />
                )}
                {c.label}
                <span
                  className={cn(
                    "text-[11px] tabular-nums",
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

      <div className="mt-4 rounded-xl bg-card divide-y divide-border/60 overflow-hidden shadow-[var(--shadow-border)]">
        {lista.length === 0 && (
          <div className="px-5 py-12 text-center">
            {/* a dupla vazia usa o próprio símbolo: os dois discos sobrepostos
                (mentor em lime à frente, mentorado atrás) */}
            <div aria-hidden className="flex justify-center">
              <span className="size-8 rounded-full bg-[var(--brand-lime)]" />
              <span className="-ml-2.5 size-8 rounded-full bg-[var(--role-mentorado)]" />
            </div>
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
            <span className="mx-auto grid size-11 place-items-center rounded-full bg-muted text-muted-foreground">
              <MagnifyingGlass aria-hidden size={18} weight="regular" />
            </span>
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
            <span className="mx-auto grid size-11 place-items-center rounded-full bg-muted text-muted-foreground">
              <Funnel aria-hidden size={18} weight="regular" />
            </span>
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
          // denominador do cronograma da dupla — duas turmas podem ter
          // totais diferentes; especialista/legada caem no teto canônico
          const totalDaDupla = totalDaTrilha(
            d.trilha,
            eventosDoCronograma(eventos, d.cronograma_id)
          );
          const progresso = totalDaDupla > 0 ? Math.min(feitos / totalDaDupla, 1) : 0;
          // dupla fora do radar (pausada/encerrada sem pedido de apoio): o motivo
          // é literalmente o status — o chip da coluna-meta já o diz; o "Mentor
          // pediu apoio" da pausada-com-apoio (risco) precisa ficar (CC-5)
          const motivo =
            d.status !== "ativa" && saude.semaforo === "ok" ? null : saude.motivo;
          // pedido de apoio do próprio mentor: apoio solicitado, não alarme
          // (mesma regra do nivelDe usado na ordenação por prioridade)
          const apoioProprio = paraMentor && saude.pediuApoio;
          const nivel = nivelDe(d);
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
              className="group animate-enter flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-4 transition-colors hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
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
                  {/* com turmas em paralelo a turma diferencia "2/16 da T1"
                      de "2/16 da T2" sem abrir a ficha — contexto tipográfico
                      (sufixo muted), não pill: pill é só pra flag (trilha) */}
                  {turmas.length > 1 && d.turma && (
                    <span className="min-w-0 truncate text-xs font-normal text-muted-foreground">
                      · {d.turma}
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
                    className="fill-grow h-full rounded-full bg-[var(--brand-lime)]"
                    style={{ width: `${progresso * 100}%` }}
                  />
                </div>
                <span className="text-xs text-muted-foreground capitalize">
                  {STATUS_LABEL[d.status] ?? d.status}
                </span>
              </div>
              {/* affordance de navegação — nudge sutil no hover da linha */}
              <ArrowRight
                size={15}
                aria-hidden
                className="shrink-0 text-muted-foreground/60 transition-transform group-hover:translate-x-0.5"
              />
            </Link>
          );
        })}
      </div>
    </>
  );
}
