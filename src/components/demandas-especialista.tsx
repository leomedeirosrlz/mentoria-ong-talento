"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  ArrowRight,
  CheckCircle,
  HandHeart,
  MagnifyingGlass,
} from "@phosphor-icons/react";
import { formatDate, rotuloSlot } from "@/lib/ciclo";
import { ERRO_JA_ACEITA } from "@/lib/utils";
import type {
  SolicitacaoEspecialista,
  SolicitacaoProposta,
} from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { filterChipCls } from "@/components/ui/filter-chip";
import { SolicitacaoNegociacao } from "@/components/solicitacao-negociacao";

/** Busca/filtro sem acento nem caixa — "fração" acha "fracao" e vice-versa;
 *  o mural é texto livre, então o match honesto é substring normalizada. */
const norm = (v: string) =>
  v
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

/** A RPC não devolve um erro dedicado pra "outro especialista aceitou antes"
 *  — a corrida de aceite termina no status, então "não está mais aberta" é
 *  o sinal. Erros de slot/negociação NÃO entram: pedido parado na mesa de
 *  negociação ainda pode fechar. */

/** Chip de filtro do mural: "todos" desliga, "combina" cruza a demanda com
 *  as áreas do especialista logado, e cada área vira um chip de texto —
 *  sem taxonomia inventada: o que filtra é o que está na ficha dele. */
type FiltroMural = "todos" | "combina" | string;

/** Mural da home do mentor especialista: os pedidos abertos/em negociação
 *  que ele pode atender (broadcast ou direcionados — a RLS já esconde o
 *  pedido dirigido a outro; o filtro fica como cinto da demo) e as sessões
 *  que ele acabou de confirmar. Aceitar/contra-propor/recusar mora no bloco
 *  de negociação — o slot sempre sai da própria agenda. `slots` = os
 *  horários livres do especialista logado (especialista_slots_livres). */
export function DemandasEspecialista({
  solicitacoes,
  propostas,
  slots,
  meuId,
  minhasAreas,
  mentoradosProprios,
}: {
  solicitacoes: SolicitacaoEspecialista[];
  /** solicitacao_id → thread — só as negociações em andamento vêm da query. */
  propostas: Record<string, SolicitacaoProposta[]>;
  slots: string[];
  meuId: string;
  /** Áreas do especialista logado (profiles.areas) — alimentam o chip
   *  "Combina com você" e os chips de tema; vazio esconde a fileira. */
  minhasAreas?: string[];
  /** mentorado_ids das duplas DPP vivas do visitante — repassado à mesa
   *  de negociação pra esconder o lado especialista no pedido do próprio
   *  mentorado (a RPC 0097 barra o aceite; aqui a mesa nem oferece). */
  mentoradosProprios?: string[];
}) {
  const router = useRouter();
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState<FiltroMural>("todos");
  /** Pedidos que a corrida de aceite levou — o card fica no lugar (a RPC já
   *  respondeu "não está mais aberta") mas sem ações, até o refresh tirar
   *  ele do mural. */
  const [tomadas, setTomadas] = useState<ReadonlySet<string>>(new Set());

  const emAberto = solicitacoes.filter((s) => {
    const efetivo = s.status_efetivo ?? s.status;
    if (efetivo !== "aberta" && efetivo !== "contra_proposta") return false;
    // pedido dirigido a outro especialista não é meu (a RLS nem devolve —
    // a demo pode trazer; omitir é a UX certa: agir daria erro de domínio)
    return (
      !s.especialista_desejado_id ||
      s.especialista_desejado_id === meuId ||
      s.especialista_id === meuId ||
      s.created_by === meuId
    );
  });

  const areas = minhasAreas ?? [];
  const buscaNorm = norm(busca.trim());

  const textoPedido = (s: SolicitacaoEspecialista) =>
    norm(`${s.mentorado?.nome ?? ""} ${s.demanda ?? ""} ${s.motivo ?? ""}`);

  const visiveis = emAberto.filter((s) => {
    if (buscaNorm && !textoPedido(s).includes(buscaNorm)) return false;
    if (filtro === "todos") return true;
    // a demanda/motivo são o que o pedido declara — o match com a área é
    // por fronteira de palavra no texto normalizado: substring crua fazia
    // a área "IA" casar dentro de "família" (sem inventar categoria a
    // partir de texto livre — só o casamento é mais estrito)
    const temas = norm(`${s.demanda ?? ""} ${s.motivo ?? ""}`);
    const menciona = (a: string) =>
      a.trim().length >= 2 &&
      new RegExp(`(?:^|\\s)${norm(a).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`).test(temas);
    if (filtro === "combina") {
      return areas.some(menciona);
    }
    return menciona(filtro);
  });

  const aceitas = solicitacoes.filter(
    (s) =>
      (s.status_efetivo ?? s.status) === "aceita" &&
      s.especialista_id === meuId
  );

  const marcarTomada = (id: string) => (mensagem: string) => {
    if (!ERRO_JA_ACEITA.test(mensagem)) return;
    setTomadas((atual) => new Set(atual).add(id));
    // o refresh relê o mural — o pedido aceito some sozinho; o estado
    // inline cobre a janela até a resposta chegar
    router.refresh();
  };

  return (
    <section aria-label="Pedidos de mentoria especializada" className="space-y-3">
      <h2 className="flex items-center gap-2 text-lg font-semibold tracking-tight">
        <HandHeart aria-hidden className="size-5 text-muted-foreground" />
        Pedidos de especialista
      </h2>

      {/* a busca é o filtro principal — demanda/motivo são texto livre, então
          chip algum descreve o mural melhor do que o que o especialista
          digitou. Os chips são atalhos honestos: as próprias áreas dele. */}
      {emAberto.length > 0 && (
        <div className="space-y-2">
          <div className="relative">
            <MagnifyingGlass
              aria-hidden
              size={15}
              className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              value={busca}
              onChange={(e) => setBusca(e.currentTarget.value)}
              placeholder="Buscar por jovem, demanda ou motivo…"
              aria-label="Buscar pedidos"
              className="pl-8"
            />
          </div>
          {areas.length > 0 && (
            <div
              role="group"
              aria-label="Filtrar pedidos"
              className="flex flex-wrap gap-1.5"
            >
              <button
                type="button"
                onClick={() => setFiltro("todos")}
                className={filterChipCls(filtro === "todos")}
              >
                Todos
              </button>
              <button
                type="button"
                onClick={() => setFiltro("combina")}
                className={filterChipCls(filtro === "combina")}
              >
                Combina com você
              </button>
              {areas.map((a) => (
                <button
                  key={a}
                  type="button"
                  onClick={() => setFiltro(a)}
                  className={filterChipCls(filtro === a)}
                >
                  {a}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {emAberto.length === 0 && aceitas.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-8 text-center">
            <span className="grid size-11 place-items-center rounded-full bg-muted text-muted-foreground">
              <HandHeart aria-hidden size={18} />
            </span>
            <p className="text-sm text-muted-foreground">
              Nenhum pedido aberto no momento.
            </p>
          </CardContent>
        </Card>
      ) : emAberto.length > 0 && visiveis.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Nenhum pedido bate com a busca — limpa o filtro pra ver o mural
          inteiro.
        </p>
      ) : (
        <ul className="space-y-3">
          {visiveis.map((s) => {
            const praMim = s.especialista_desejado_id === meuId;
            const negociando =
              (s.status_efetivo ?? s.status) === "contra_proposta";
            const tomada = tomadas.has(s.id);
            return (
              <li key={s.id}>
                <Card>
                  <CardContent className="space-y-3 py-4">
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium">
                          {/* nome vem sempre — a view solicitacoes_mural dá
                              mentorado_nome no escopo do papel */}
                          {s.mentorado?.nome}
                        </span>
                        {praMim && (
                          <Badge
                            variant="outline"
                            className="border-[var(--warn)]/60 text-[var(--warn-text)]"
                          >
                            Direcionada a você
                          </Badge>
                        )}
                        {s.origem === "jovem" && (
                          <Badge variant="secondary">pedido do jovem</Badge>
                        )}
                        {negociando && (
                          <Badge variant="secondary">em negociação</Badge>
                        )}
                      </div>
                      {(s.demanda ?? s.motivo) && (
                        <p className="text-sm">{s.demanda ?? s.motivo}</p>
                      )}
                      <p className="text-xs text-muted-foreground">
                        Solicitado por {s.solicitante?.nome ?? "—"} ·{" "}
                        {formatDate(s.created_at)}
                      </p>
                    </div>
                    {/* a corrida de aceite termina no servidor — quando a RPC
                        responde "não está mais aberta", o card fica honesto e
                        sem ações até o refresh tirá-lo do mural */}
                    {tomada ? (
                      <p className="text-sm text-muted-foreground">
                        Já foi aceita por outro especialista.
                      </p>
                    ) : (
                      <SolicitacaoNegociacao
                        s={s}
                        propostas={propostas[s.id] ?? []}
                        slots={slots}
                        meuId={meuId}
                        papel="mentor_especialista"
                        mentoradosProprios={mentoradosProprios}
                        onAceito={(duplaId) => {
                          if (duplaId) router.push(`/duplas/${duplaId}`);
                        }}
                        onErro={marcarTomada(s.id)}
                      />
                    )}
                  </CardContent>
                </Card>
              </li>
            );
          })}
        </ul>
      )}

      {aceitas.length > 0 && (
        <Card>
          <CardContent className="space-y-1 py-4">
            <p className="pb-1 text-xs font-medium tracking-wide text-muted-foreground uppercase">
              Sessões confirmadas
            </p>
            <ul className="divide-y divide-border/60">
              {aceitas.slice(0, 3).map((s) => (
                <li key={s.id} className="py-2 first:pt-0 last:pb-0">
                  <Link
                    href={s.dupla_id ? `/duplas/${s.dupla_id}` : "/agenda"}
                    className="group flex items-center gap-2 text-sm"
                  >
                    <CheckCircle
                      aria-hidden
                      size={15}
                      className="shrink-0 text-[var(--ok-text)]"
                    />
                    <span className="min-w-0 flex-1">
                      Sessão com {s.mentorado?.nome ?? "o jovem"}
                      {s.slot_proposto
                        ? ` · ${rotuloSlot(s.slot_proposto)}`
                        : ""}
                    </span>
                    <ArrowRight
                      aria-hidden
                      size={14}
                      className="shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5"
                    />
                  </Link>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </section>
  );
}
