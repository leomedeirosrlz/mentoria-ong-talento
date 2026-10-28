"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  dimensoesDoItem,
  type DimensoesItem,
  type ItemParaAcompanhar,
} from "@/lib/agenda-coordenacao";
import { formatDiaMes, LEMBRETE_INTERVALO_MS } from "@/lib/ciclo";
import { turmaLonga } from "@/lib/turma";
import { normaliza } from "@/lib/utils";
import type { LembreteDestino } from "@/lib/actions-lembrete";
import { DuplaWaAcao } from "@/components/dupla-wa-acao";
import {
  DuplaLinha,
  type PessoaLinha,
  type ProgressoDupla,
  type TomSituacao,
} from "@/components/dupla-linha";
import { buttonVariants } from "@/components/ui/button";
import { filterChipCls } from "@/components/ui/filter-chip";
import { Input } from "@/components/ui/input";

// ============================================================
// A fila "Para acompanhar" interativa (REALIZA-161): chips de filtro,
// busca por nome e o agrupamento urgentes × demais. Cada linha é a
// mesma linha canônica de /duplas (DuplaLinha): situação pela régua da
// dupla, apoio em pill à parte, motivo em uma linha e UMA ação. Recebe
// as linhas já enriquecidas do server: Dupla e CicloEvento não cruzam a
// boundary.
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
  /** "ficha" = a pendência é da coordenação, não da dupla — o CTA vira
   *  link pra ficha (rito de encerramento), sem LembreteButton. Default
   *  "lembrete". */
  acao?: "lembrete" | "ficha";
  mentor: PessoaLinha;
  mentorado: PessoaLinha;
  progresso: ProgressoDupla;
};

type LinhaComDimensoes = LinhaFila & { dimensoes: DimensoesItem };

type FiltroFila = "todas" | "urgentes" | "sem_data" | "registro_pendente";

const FILTROS: { id: FiltroFila; rotulo: string }[] = [
  { id: "todas", rotulo: "Todas" },
  { id: "urgentes", rotulo: "Urgentes" },
  { id: "sem_data", rotulo: "Sem data" },
  { id: "registro_pendente", rotulo: "Registro pendente" },
];

/** O predicado de cada chip. "Urgente" é o pedido de apoio ou a avaliação
 *  baixa com dificuldade: as únicas linhas que a coordenação atende antes
 *  de qualquer outra. */
const MATCH_FILTRO: Record<FiltroFila, (l: LinhaComDimensoes) => boolean> = {
  todas: () => true,
  urgentes: (l) => l.dimensoes.acompanhamento?.tom === "danger",
  sem_data: (l) => l.item.motivos.includes("sem_data"),
  registro_pendente: (l) => l.item.motivos.includes("registro_pendente"),
};

/** A situação da linha: a mesma régua de /duplas. O rito de encerramento
 *  é de dupla concluída, então o rótulo é o da jornada fechada. */
function situacaoDaFila(item: ItemParaAcompanhar): { rotulo: string; tom: TomSituacao } {
  if (item.motivos.includes("encerramento"))
    return { rotulo: "Concluída", tom: "pausa" };
  if (item.saude.semaforo === "risco") return { rotulo: "Em risco", tom: "risco" };
  if (item.saude.semaforo === "atencao") return { rotulo: "Atenção", tom: "atencao" };
  return { rotulo: "Em dia", tom: "neutro" };
}

const ORIGEM_APOIO: Record<string, string> = {
  mentor: "pedido do mentor",
  mentorado: "pedido do jovem",
  ambos: "pedido do mentor e do jovem",
};

export function FilaAcompanhar({ linhas }: { linhas: LinhaFila[] }) {
  const [filtro, setFiltro] = useState<FiltroFila>("todas");
  const [busca, setBusca] = useState("");

  // as dimensões derivam uma vez por render — a mesma régua alimenta os
  // counts dos chips e o agrupamento
  const itens = useMemo<LinhaComDimensoes[]>(
    () => linhas.map((l) => ({ ...l, dimensoes: dimensoesDoItem(l.item) })),
    [linhas]
  );

  // a busca só filtra enquanto o input existe — um router.refresh() pode
  // encolher a fila pra ≤10 e desmontar o controle, e um `q` órfão ia
  // continuar escondendo linhas sem jeito de limpar
  const q = linhas.length > 10 ? normaliza(busca.trim()) : "";
  const visiveis = itens.filter(
    (l) => MATCH_FILTRO[filtro](l) && (!q || normaliza(l.mentorado.nome).includes(q) || normaliza(l.mentor.nome).includes(q))
  );

  // sem seleção ativa a fila se divide: quem precisa de intervenção em cima,
  // o resto abaixo (a ordem risco→atenção do paraAcompanhar se mantém dentro
  // de cada grupo). Um grupo só não ganha cabeçalho — seria só ruído.
  const semSelecao = filtro === "todas" && q === "";
  const urgentes = visiveis.filter(MATCH_FILTRO.urgentes);
  const demais = visiveis.filter((l) => !MATCH_FILTRO.urgentes(l));
  const dividir = semSelecao && urgentes.length > 0 && demais.length > 0;

  return (
    <>
      <div
        role="group"
        aria-label="Filtrar a fila de acompanhamento"
        className="mt-3 flex flex-wrap items-center gap-2"
      >
        {FILTROS.map((f) => {
          const n = itens.filter(MATCH_FILTRO[f.id]).length;
          // chip com 0 resultado não filtra nada — esconde (o ativo fica
          // pra não prender a pessoa num filtro sem saída)
          if (f.id !== "todas" && n === 0 && filtro !== f.id) return null;
          return (
            <button
              key={f.id}
              type="button"
              aria-pressed={filtro === f.id}
              onClick={() => setFiltro(filtro === f.id && f.id !== "todas" ? "todas" : f.id)}
              className={filterChipCls(filtro === f.id)}
            >
              {f.rotulo}
              <span className={filtro === f.id ? "text-background/70 tabular-nums" : "tabular-nums text-muted-foreground"}>
                {n}
              </span>
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
            className="w-full sm:ml-auto sm:w-52"
          />
        )}
      </div>

      {visiveis.length === 0 ? (
        <p className="mt-3 rounded-xl border border-dashed px-4 py-3 text-sm text-muted-foreground">
          Nenhuma dupla nesse recorte.
        </p>
      ) : dividir ? (
        <div className="mt-3 space-y-5">
          <GrupoFila
            titulo={`Urgentes (${urgentes.length})`}
            linhas={urgentes}
            chave={`${filtro}|${q}|u`}
          />
          <GrupoFila
            titulo={`Demais duplas (${demais.length})`}
            linhas={demais}
            chave={`${filtro}|${q}|d`}
          />
        </div>
      ) : (
        <div className="mt-3">
          <ListaFila linhas={visiveis} chave={`${filtro}|${q}`} />
        </div>
      )}
    </>
  );
}

function GrupoFila({
  titulo,
  linhas,
  chave,
}: {
  titulo: string;
  linhas: LinhaComDimensoes[];
  chave: string;
}) {
  return (
    <div>
      <h3 className="mb-2 text-sm font-semibold">{titulo}</h3>
      <ListaFila linhas={linhas} chave={chave} />
    </div>
  );
}

/** A lista de linhas. Filtro e busca trocam a `key`, então a entrada anima
 *  de novo (convenção de movimento do AGENTS.md). */
function ListaFila({ linhas, chave }: { linhas: LinhaComDimensoes[]; chave: string }) {
  return (
    <section
      aria-label="Duplas para acompanhar"
      className="@container"
    >
      <ul
        key={chave}
        className="space-y-3 @4xl:space-y-0 @4xl:divide-y @4xl:divide-border/60 @4xl:overflow-hidden @4xl:rounded-xl @4xl:bg-card @4xl:shadow-[var(--shadow-border)]"
      >
        {linhas.map((l) => (
          <li key={l.item.duplaId}>
            <LinhaAcompanhar linha={l} />
          </li>
        ))}
      </ul>
    </section>
  );
}

function LinhaAcompanhar({ linha }: { linha: LinhaComDimensoes }) {
  const { item, lembrete, telefone } = linha;
  // cap D5 em curso = "aguardando a dupla": o lembrete saiu há <48h e a
  // próxima ação é dela. `bloqueadoAte` não-null ⟺ bloqueada no render do
  // server — sem re-derivar relógio aqui.
  const ate = item.bloqueadoAte != null ? new Date(item.bloqueadoAte) : null;
  const enviadoEm = ate ? new Date(ate.getTime() - LEMBRETE_INTERVALO_MS) : null;
  const aguardando = enviadoEm
    ? `lembrete enviado ${formatDiaMes(enviadoEm.toISOString()).replace(/\/\d{4}$/, "")}, aguardando a dupla`
    : null;
  const meta = [turmaLonga(item.turma), aguardando].filter(Boolean).join(" · ");
  const [headline = "", ...resto] = item.contextoPartes;
  const motivo = [headline, ...resto].filter(Boolean).join(" · ");
  const situacao = situacaoDaFila(item);
  const origem = item.saude.apoio.origem ?? "mentor";

  return (
    <DuplaLinha
      mentor={linha.mentor}
      mentorado={linha.mentorado}
      situacao={situacao}
      apoio={item.saude.apoio.aberto ? { detalhe: ORIGEM_APOIO[origem] } : null}
      meta={meta || null}
      motivo={motivo || null}
      progresso={linha.progresso}
      acao={
        linha.acao === "ficha" ? (
          // pendência da coordenação (rito de encerramento): o Lembrar seria
          // nudge pra dupla errada — a ação mora na ficha, que já carrega o
          // checklist inteiro
          <Link
            href={`/duplas/${item.duplaId}`}
            className={buttonVariants({ size: "sm" })}
          >
            {linha.rotulo}
          </Link>
        ) : (
          <DuplaWaAcao
            duplaId={item.duplaId}
            destNome={
              linha.destino === "mentorado"
                ? linha.mentorado.nome
                : (linha.mentor?.nome ?? "mentor")
            }
            telefone={telefone}
            mensagem={lembrete.corpo}
            nudge={{
              destino: linha.destino,
              titulo: lembrete.titulo,
              href:
                linha.destino === "mentorado"
                  ? "/jovem/agenda"
                  : `/duplas/${item.duplaId}`,
              bloqueadoAte: item.bloqueadoAte,
              // o rótulo já vem resolvido do server (agenda-coordenacao):
              // "Chamar" no pedido de apoio do jovem, "Lembrar registro"
              // quando o caso dominante é a pendência de registro, "Lembrar"
              // no resto — "Concluir rito" nunca chega aqui (é link)
              rotulo:
                linha.rotulo === "Chamar" || linha.rotulo === "Lembrar registro"
                  ? linha.rotulo
                  : undefined,
            }}
          />
        )
      }
      fichaHref={`/duplas/${item.duplaId}`}
      fichaNome={linha.mentorado.nome.split(" ")[0]}
    />
  );
}
