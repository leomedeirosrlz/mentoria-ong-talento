"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, CheckCircle, HandHeart } from "@phosphor-icons/react";
import { formatDate, rotuloSlot } from "@/lib/ciclo";
import type {
  SolicitacaoEspecialista,
  SolicitacaoProposta,
} from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { SolicitacaoNegociacao } from "@/components/solicitacao-negociacao";

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
}: {
  solicitacoes: SolicitacaoEspecialista[];
  /** solicitacao_id → thread — só as negociações em andamento vêm da query. */
  propostas: Record<string, SolicitacaoProposta[]>;
  slots: string[];
  meuId: string;
}) {
  const router = useRouter();

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

  const aceitas = solicitacoes.filter(
    (s) =>
      (s.status_efetivo ?? s.status) === "aceita" &&
      s.especialista_id === meuId
  );

  return (
    <section aria-label="Pedidos de mentoria especializada" className="space-y-3">
      <h2 className="flex items-center gap-2 text-lg font-semibold tracking-tight">
        <HandHeart aria-hidden className="size-5 text-muted-foreground" />
        Pedidos de especialista
      </h2>

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
      ) : (
        <ul className="space-y-3">
          {emAberto.map((s) => {
            const praMim = s.especialista_desejado_id === meuId;
            const negociando =
              (s.status_efetivo ?? s.status) === "contra_proposta";
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
                    <SolicitacaoNegociacao
                      s={s}
                      propostas={propostas[s.id] ?? []}
                      slots={slots}
                      meuId={meuId}
                      papel="mentor_especialista"
                      onAceito={(duplaId) => {
                        if (duplaId) router.push(`/duplas/${duplaId}`);
                      }}
                    />
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
