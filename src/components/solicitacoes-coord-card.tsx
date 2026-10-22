"use client";

import { useState, useTransition } from "react";
import { UserCheck, XCircle } from "@phosphor-icons/react";
import { toast } from "sonner";
import {
  cancelarSolicitacao,
  reconhecerSolicitacao,
} from "@/lib/actions-especialista";
import type { SolicitacaoEspecialista } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ConfirmDeleteButton } from "@/components/confirm-delete-button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SolicitacaoStatusChip } from "@/components/solicitacao-status-chip";
import { rotuloSlot, tempoRelativo } from "@/lib/ciclo";



function corta(texto: string, max = 110): string {
  return texto.length > max ? `${texto.slice(0, max).trimEnd()}…` : texto;
}

/** O que o pedido conta em uma linha — a demanda do staff ou o motivo do
 *  pedido do jovem; os dois são null só no pedido de sessão seguinte (aí a
 *  dupla já formada é o contexto). */
function textoDo(s: SolicitacaoEspecialista): string | null {
  return s.demanda ?? s.motivo;
}

/** Status que pedem ação ou atenção da coordenação no dashboard. */
const ACIONAVEIS = new Set([
  "aguardando_coord",
  "aberta",
  "contra_proposta",
  "expirada",
]);

function efetivoDe(s: SolicitacaoEspecialista) {
  return s.status_efetivo ?? s.status;
}

/** Linha de triagem: pedido do jovem sem dupla DPP. Liberar vira 'aberta';
 *  a turma é opcional (pool global de especialistas, 0101) — definida aqui
 *  ou resolvida na efetivação pelo cronograma vigente. */
function TriagemItem({
  s,
  turmas,
  agoraMs,
}: {
  s: SolicitacaoEspecialista;
  turmas: string[];
  agoraMs: number;
}) {
  const [turma, setTurma] = useState<string | null>(null);
  const [pendente, start] = useTransition();
  return (
    <li className="space-y-2 py-3 first:pt-0 last:pb-0">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1 space-y-0.5">
          <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm font-medium">
            {s.mentorado?.nome}
            <Badge variant="secondary">do jovem</Badge>
          </p>
          {s.motivo && (
            <p className="text-sm text-muted-foreground">{corta(s.motivo)}</p>
          )}
          <p className="text-xs text-muted-foreground">
            {s.solicitante?.nome ? `por ${s.solicitante.nome} · ` : ""}
            {tempoRelativo(s.created_at, agoraMs)}
          </p>
        </div>
        <ConfirmDeleteButton
          titulo="Cancelar solicitação?"
          descricao={`O pedido${s.mentorado?.nome ? ` de ${s.mentorado.nome}` : ""} sai da fila sem chegar aos especialistas. Quem pediu é avisado.`}
          acao="Cancelar"
          sucesso="Solicitação cancelada."
          onConfirm={() => cancelarSolicitacao(s.id)}
          trigger={
            <Button
              variant="ghost"
              size="sm"
              className="shrink-0 text-muted-foreground"
            >
              <XCircle size={15} />
              Cancelar
            </Button>
          }
        />
      </div>
      <div className="flex items-center gap-2">
        <div className="min-w-0 flex-1">
          <Select
            value={turma}
            onValueChange={(v) => setTurma(v as string)}
            items={Object.fromEntries(turmas.map((t) => [t, t]))}
          >
            <SelectTrigger size="sm" aria-label="Turma da sessão">
              <SelectValue placeholder="Turma (opcional)" />
            </SelectTrigger>
            <SelectContent>
              {turmas.map((t) => (
                <SelectItem key={t} value={t}>
                  {t}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button
          size="sm"
          disabled={pendente}
          onClick={() =>
            start(async () => {
              const r = await reconhecerSolicitacao(s.id, turma);
              if (r.error) toast.error(r.error);
              else toast.success("Pedido liberado para os especialistas.");
            })
          }
        >
          <UserCheck size={15} />
          Liberar
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        Sem turma definida, a dupla herda a turma do jovem (ou o cronograma
        vigente) na efetivação.
      </p>
    </li>
  );
}

/** Card do dashboard da coordenação: pedidos de especialista que pedem
 *  atenção — a fila de triagem (pedidos do jovem sem dupla DPP; a turma é
 *  opcional desde a 0101) e os pedidos em aberto/em negociação, com estado
 *  honesto e cancelamento. A lista chega por prop com o escopo da query.
 *  Sem nada acionável o card não renderiza (empty state honesto).
 *  `className` recebe o placement do grid da home (rail, sob os avisos). */
export function SolicitacoesCoordCard({
  solicitacoes,
  turmas,
  className,
}: {
  solicitacoes: SolicitacaoEspecialista[];
  /** Labels de turma pra triagem — vêm dos cronogramas (0061); opcional
   *  desde a 0101 (pool global). */
  turmas: string[];
  /** placement no grid da home — merge no <Card> raiz */
  className?: string;
}) {
  const [agoraMs] = useState(() => Date.now());
  const triagem = solicitacoes.filter(
    (s) => efetivoDe(s) === "aguardando_coord"
  );
  const abertas = solicitacoes.filter((s) =>
    ["aberta", "contra_proposta", "expirada"].includes(efetivoDe(s))
  );
  const acionaveis = solicitacoes.filter((s) => ACIONAVEIS.has(efetivoDe(s)));
  if (acionaveis.length === 0) return null;

  const visiveisAbertas = abertas.slice(0, Math.max(0, 3 - triagem.length));
  const restantes = acionaveis.length - triagem.length - visiveisAbertas.length;

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          Pedidos de especialista
          <Badge variant="secondary">{acionaveis.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {triagem.length > 0 && (
          <>
            <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
              Aguardando triagem
            </p>
            <ul className="divide-y divide-border/60">
              {triagem.slice(0, 3).map((s) => (
                <TriagemItem
                  key={s.id}
                  s={s}
                  turmas={turmas}
                  agoraMs={agoraMs}
                />
              ))}
            </ul>
          </>
        )}
        {visiveisAbertas.length > 0 && (
          <ul
            className={`divide-y divide-border/60${triagem.length > 0 ? " mt-2 border-t border-border/60" : ""}`}
          >
            {visiveisAbertas.map((s) => {
              const texto = textoDo(s);
              return (
                <li
                  key={s.id}
                  className="flex items-start gap-3 py-3 first:pt-2 last:pb-0"
                >
                  <div className="min-w-0 flex-1 space-y-0.5">
                    <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm font-medium">
                      {s.mentorado?.nome}
                      <SolicitacaoStatusChip solicitacao={s} />
                      {s.origem === "jovem" && (
                        <Badge variant="secondary">do jovem</Badge>
                      )}
                    </p>
                    {texto && (
                      <p className="text-sm text-muted-foreground">
                        {corta(texto)}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground">
                      {s.solicitante?.nome ? `por ${s.solicitante.nome} · ` : ""}
                      {tempoRelativo(s.created_at, agoraMs)}
                      {s.especialista_desejado_id
                        ? ` · para ${s.desejado?.nome ?? "especialista"}`
                        : ""}
                      {s.slot_proposto
                        ? ` · ${rotuloSlot(s.slot_proposto)}`
                        : ""}
                    </p>
                  </div>
                  <ConfirmDeleteButton
                    titulo="Cancelar solicitação?"
                    descricao={`O pedido${s.mentorado?.nome ? ` de ${s.mentorado.nome}` : ""} sai da lista dos especialistas. Quem pediu é avisado.`}
                    acao="Cancelar"
                    sucesso="Solicitação cancelada."
                    onConfirm={() => cancelarSolicitacao(s.id)}
                    trigger={
                      <Button
                        variant="ghost"
                        size="sm"
                        className="shrink-0 text-muted-foreground"
                      >
                        <XCircle size={15} />
                        Cancelar
                      </Button>
                    }
                  />
                </li>
              );
            })}
          </ul>
        )}
        {restantes > 0 && (
          <p className="pt-3 text-xs text-muted-foreground">
            e mais {restantes} {restantes === 1 ? "pedido" : "pedidos"}…
          </p>
        )}
      </CardContent>
    </Card>
  );
}
