"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Megaphone } from "@phosphor-icons/react";
import { tempoRelativo } from "@/lib/ciclo";
import { efetivoDe, resumoPedidoJovem } from "@/lib/jovem-especialista";
import type {
  Disponibilidade,
  JovemContato,
  SolicitacaoEspecialista,
  SolicitacaoProposta,
} from "@/lib/types";
import { avatarPublicUrl } from "@/lib/avatar";
import { Avatar } from "@/components/avatar";
import { SolicitacaoNegociacao } from "@/components/solicitacao-negociacao";

/** A mesa do pedido do jovem — rail de negociação (aceitar a proposta do
 *  especialista, contra-propor, cancelar). O item da home usa dentro da
 *  linha; a agenda usa direto no card da trilha. */
export function PedidoJovemMesa({
  s,
  propostas,
  slots,
  meuId,
  equipe,
  nomeJovem,
  disponibilidade,
}: {
  s: SolicitacaoEspecialista;
  propostas: SolicitacaoProposta[];
  slots: string[];
  meuId: string;
  equipe: JovemContato[];
  nomeJovem: string;
  /** Grade do próprio jovem — pinta "encaixa com você" nos slots da
   *  contra-proposta; null/undefined = mesa sem o destaque. */
  disponibilidade?: Disponibilidade | null;
}) {
  const router = useRouter();
  return (
    <SolicitacaoNegociacao
      s={s}
      propostas={propostas}
      slots={slots}
      meuId={meuId}
      papel="mentorado"
      equipe={equipe}
      nomeJovem={nomeJovem}
      disponibilidade={disponibilidade}
      onAceito={() => router.refresh()}
    />
  );
}

/** Linha de um pedido de especialista do jovem na home — quem é o alvo (ou
 *  "qualquer"), onde o pedido está na voz dele e a mesa de negociação. */
export function PedidoJovemItem({
  s,
  propostas,
  slots,
  meuId,
  equipe,
  nomeJovem,
  alvo,
  disponibilidade,
}: {
  s: SolicitacaoEspecialista;
  propostas: SolicitacaoProposta[];
  slots: string[];
  meuId: string;
  equipe: JovemContato[];
  nomeJovem: string;
  /** O especialista da mesa (engajado ?? direcionado) — nome/foto vindos do
   *  catálogo jovem_especialistas; null = pedido em broadcast. */
  alvo: { nome: string; avatar_path: string | null } | null;
  /** Grade do jovem — a mesa marca os slots que encaixam nela. */
  disponibilidade?: Disponibilidade | null;
}) {
  const [agoraMs] = useState(() => Date.now());
  const efetivo = efetivoDe(s);
  const nomeEsp = alvo?.nome ?? null;
  const primeiro = nomeEsp?.split(" ")[0] ?? null;
  const recado = s.motivo ?? s.demanda;

  return (
    <li className="flex items-start gap-3 px-(--card-spacing) py-4">
      {alvo ? (
        <Avatar
          nome={alvo.nome}
          src={alvo.avatar_path ? avatarPublicUrl(alvo.avatar_path) : null}
          size={36}
          className="mt-0.5 shrink-0"
        />
      ) : (
        <span
          aria-hidden
          className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-full bg-muted text-muted-foreground"
        >
          <Megaphone size={15} />
        </span>
      )}
      <div className="min-w-0 flex-1 space-y-1.5">
        <div>
          <p className="text-sm font-medium">
            {primeiro ? `Sessão com ${primeiro}` : "Pedido no mural"}
          </p>
          <p className="text-xs text-muted-foreground">
            {resumoPedidoJovem(efetivo, primeiro)} ·{" "}
            {tempoRelativo(s.created_at, agoraMs)}
          </p>
          {recado && (
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
              “{recado}”
            </p>
          )}
        </div>

        <PedidoJovemMesa
          s={s}
          propostas={propostas}
          slots={slots}
          meuId={meuId}
          equipe={equipe}
          nomeJovem={nomeJovem}
          disponibilidade={disponibilidade}
        />
      </div>
    </li>
  );
}
