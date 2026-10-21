"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  dimensoesDoItem,
  type DimensaoBadge,
  type DimensoesItem,
  type ItemParaAcompanhar,
} from "@/lib/agenda-coordenacao";
import { formatDiaMes, LEMBRETE_INTERVALO_MS } from "@/lib/ciclo";
import { cn, normaliza } from "@/lib/utils";
import type { LembreteDestino } from "@/lib/actions-lembrete";
import { LembreteButton } from "@/components/lembrete-button";
import { PillTurma, Tag } from "@/components/agenda-partes";
import { filterChipCls } from "@/components/ui/filter-chip";
import { Input } from "@/components/ui/input";

// ============================================================
// A fila "Para acompanhar" interativa (REALIZA-161): chips de filtro,
// busca por nome e o agrupamento críticas × demais — mais o estado
// "aguardando a dupla" das linhas dentro do cap D5. Recebe as linhas já
// enriquecidas do server (lembrete e telefone resolvidos lá): Dupla e
// CicloEvento não cruzam a boundary.
// ============================================================

/** Uma linha da fila pronta pra render. */
export type LinhaFila = {
  item: ItemParaAcompanhar;
  /** Quem recebe o nudge — "mentorado" quando o pedido de apoio partiu do
   *  jovem (a resposta certa é chamar ele, nunca o mentor). */
  destino: LembreteDestino;
  /** Rótulo do botão — "Lembrar", "Lembrar registro" ou "Chamar". */
  rotulo: string;
  /** Título/corpo do nudge — calculado no server (lembreteDaDupla /
   *  msgsContato pro caso apoio_jovem). */
  lembrete: { titulo: string; corpo: string };
  /** WhatsApp do destinatário — null = o nudge sai só como notificação
   *  in-app. */
  telefone: string | null;
};

type LinhaComDimensoes = LinhaFila & { dimensoes: DimensoesItem };

type FiltroFila = "todas" | "criticas" | "sem_data" | "registro_pendente";

const FILTROS: { id: FiltroFila; rotulo: string }[] = [
  { id: "todas", rotulo: "Todas" },
  { id: "criticas", rotulo: "Críticas" },
  { id: "sem_data", rotulo: "Sem data" },
  { id: "registro_pendente", rotulo: "Registro pendente" },
];

/** O predicado de cada chip — "crítica" é a dimensão acompanhamento em
 *  danger (a única que pode chegar a vermelho). */
const MATCH_FILTRO: Record<FiltroFila, (l: LinhaComDimensoes) => boolean> = {
  todas: () => true,
  criticas: (l) => l.dimensoes.acompanhamento?.tom === "danger",
  sem_data: (l) => l.item.motivos.includes("sem_data"),
  registro_pendente: (l) => l.item.motivos.includes("registro_pendente"),
};

export function FilaAcompanhar({ linhas }: { linhas: LinhaFila[] }) {
  const [filtro, setFiltro] = useState<FiltroFila>("todas");
  const [busca, setBusca] = useState("");

  // as dimensões derivam uma vez por render — a mesma régua alimenta os
  // badges da linha, os counts dos chips e o agrupamento
  const itens = useMemo<LinhaComDimensoes[]>(
    () => linhas.map((l) => ({ ...l, dimensoes: dimensoesDoItem(l.item) })),
    [linhas]
  );

  // a busca só filtra enquanto o input existe — um router.refresh() pode
  // encolher a fila pra ≤10 e desmontar o controle, e um `q` órfão ia
  // continuar escondendo linhas sem jeito de limpar
  const q = linhas.length > 10 ? normaliza(busca.trim()) : "";
  const visiveis = itens.filter(
    (l) => MATCH_FILTRO[filtro](l) && (!q || normaliza(l.item.nomes).includes(q))
  );

  // sem seleção ativa a fila se divide: quem precisa de intervenção em cima,
  // o resto abaixo (a ordem risco→atenção do paraAcompanhar se mantém dentro
  // de cada grupo). Um grupo só não ganha cabeçalho — seria só ruído.
  const semSelecao = filtro === "todas" && q === "";
  const criticas = visiveis.filter(MATCH_FILTRO.criticas);
  const demais = visiveis.filter((l) => !MATCH_FILTRO.criticas(l));
  const dividir = semSelecao && criticas.length > 0 && demais.length > 0;

  return (
    <>
      <div
        role="group"
        aria-label="Filtrar a fila de acompanhamento"
        className="mt-3 flex flex-wrap items-center gap-2"
      >
        {FILTROS.map((f) => {
          const n = itens.filter(MATCH_FILTRO[f.id]).length;
          return (
            <button
              key={f.id}
              type="button"
              aria-pressed={filtro === f.id}
              onClick={() => setFiltro(f.id)}
              className={filterChipCls(filtro === f.id)}
            >
              {f.rotulo} · <span className="tabular-nums">{n}</span>
            </button>
          );
        })}
        {/* a busca só aparece quando a fila é longa — com poucas linhas ela é
            controle a mais sem ganho */}
        {linhas.length > 10 && (
          <Input
            type="search"
            aria-label="Buscar dupla pelo nome"
            placeholder="Buscar por nome"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="ml-auto w-52"
          />
        )}
      </div>

      {visiveis.length === 0 ? (
        <p className="mt-3 rounded-xl border border-dashed px-4 py-3 text-sm text-muted-foreground">
          Nenhuma dupla nesse recorte.
        </p>
      ) : dividir ? (
        <div className="mt-3 space-y-4">
          <GrupoFila
            titulo={`Precisam de intervenção (${criticas.length})`}
            linhas={criticas}
          />
          {/* "Demais duplas", não "Acompanhamento" — o nome de grupo não
              pode colidir com a dimensão de badge de mesmo nome */}
          <GrupoFila
            titulo={`Demais duplas (${demais.length})`}
            linhas={demais}
          />
        </div>
      ) : (
        <ul className="mt-3 divide-y divide-border/60 overflow-hidden rounded-xl border bg-card">
          {visiveis.map((l) => (
            <LinhaAcompanhar key={l.item.duplaId} linha={l} />
          ))}
        </ul>
      )}
    </>
  );
}

function GrupoFila({
  titulo,
  linhas,
}: {
  titulo: string;
  linhas: LinhaComDimensoes[];
}) {
  return (
    <div>
      <h3 className="mb-1.5 text-xs font-semibold text-muted-foreground">
        {titulo}
      </h3>
      <ul className="divide-y divide-border/60 overflow-hidden rounded-xl border bg-card">
        {linhas.map((l) => (
          <LinhaAcompanhar key={l.item.duplaId} linha={l} />
        ))}
      </ul>
    </div>
  );
}

function LinhaAcompanhar({ linha }: { linha: LinhaComDimensoes }) {
  const { item, dimensoes, lembrete, telefone } = linha;
  const badges = [
    dimensoes.acompanhamento,
    dimensoes.cronograma,
    dimensoes.operacional,
  ].filter((b): b is DimensaoBadge => b != null);
  // cap D5 em curso = "aguardando a dupla": o lembrete saiu há <48h e a
  // próxima ação é dela — a linha esmaece e diz isso (o botão já mostra
  // "Lembrada dd/mm"). `bloqueadoAte` não-null ⟺ bloqueada no render do
  // server — sem re-derivar relógio aqui.
  const ate = item.bloqueadoAte != null ? new Date(item.bloqueadoAte) : null;
  const enviadoEm = ate ? new Date(ate.getTime() - LEMBRETE_INTERVALO_MS) : null;
  const [headline = "", ...resto] = item.contextoPartes;
  return (
    <li className="flex flex-wrap items-center gap-3 px-4 py-3">
      <div className={cn("min-w-0 flex-1 basis-56", ate && "opacity-60")}>
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm font-semibold">
          {item.nomes}
          <PillTurma turma={item.turma} />
        </p>
        <p className="mt-0.5 text-[13px] leading-snug text-foreground">
          {headline}
        </p>
        {resto.length > 0 && (
          <p className="mt-0.5 text-xs leading-snug text-muted-foreground">
            {resto.join(" · ")}
          </p>
        )}
        {enviadoEm && (
          <p className="mt-0.5 text-xs leading-snug text-muted-foreground">
            lembrete enviado{" "}
            {formatDiaMes(enviadoEm.toISOString()).replace(/\/\d{4}$/, "")} —
            aguardando a dupla
          </p>
        )}
      </div>
      {badges.map((b) => (
        <span
          key={b.rotulo}
          title={b.detalhe}
          className="inline-flex"
        >
          <Tag tom={b.tom}>
            {b.rotulo}
            {/* o detalhe (ex.: "pedido do jovem") não pode viver só no
                title — inalcançável por teclado/leitor de tela */}
            {b.detalhe && <span className="sr-only"> — {b.detalhe}</span>}
          </Tag>
        </span>
      ))}
      <LembreteButton
        duplaId={item.duplaId}
        destino={linha.destino}
        rotulo={linha.rotulo}
        telefone={telefone}
        titulo={lembrete.titulo}
        corpo={lembrete.corpo}
        href={
          linha.destino === "mentorado"
            ? "/jovem/agenda"
            : `/duplas/${item.duplaId}`
        }
        bloqueadoAte={item.bloqueadoAte}
      />
      <Link
        href={`/duplas/${item.duplaId}`}
        className="inline-flex min-h-9 items-center rounded-lg px-2 text-xs font-semibold text-foreground/80 transition-colors hover:bg-muted hover:text-foreground"
      >
        Ver ficha ›
      </Link>
    </li>
  );
}
