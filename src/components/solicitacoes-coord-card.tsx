"use client";

import { useState } from "react";
import { XCircle } from "@phosphor-icons/react";
import { cancelarSolicitacao } from "@/lib/actions-especialista";
import type { SolicitacaoEspecialista } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ConfirmDeleteButton } from "@/components/confirm-delete-button";
import { tempoRelativo } from "@/lib/ciclo";



function corta(texto: string, max = 110): string {
  return texto.length > max ? `${texto.slice(0, max).trimEnd()}…` : texto;
}

/** Card do dashboard da coordenação: demandas de especialista esperando
 *  aceite — contagem, as 3 mais recentes e cancelamento com confirmação. A
 *  lista chega por prop (RLS do papel já filtrada pela query). Sem pedido
 *  aberto não há o que dizer: o card não renderiza (empty state honesto).
 *  `className` recebe o placement do grid da home (rail, sob os avisos). */
export function SolicitacoesCoordCard({
  solicitacoes,
  className,
}: {
  solicitacoes: SolicitacaoEspecialista[];
  /** placement no grid da home — merge no <Card> raiz */
  className?: string;
}) {
  const [agoraMs] = useState(() => Date.now());
  const abertas = solicitacoes.filter((s) => s.status === "aberta");
  const visiveis = abertas.slice(0, 3);
  if (abertas.length === 0) return null;

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          Pedidos de especialista
          <Badge variant="secondary">{abertas.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="divide-y divide-border/60">
          {visiveis.map((s) => (
            <li key={s.id} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
              <div className="min-w-0 flex-1 space-y-0.5">
                <p className="text-sm font-medium">
                  {/* nome vem sempre — a view solicitacoes_mural dá
                      mentorado_nome no escopo do papel */}
                  {s.mentorado?.nome}
                </p>
                <p className="text-sm text-muted-foreground">{corta(s.demanda)}</p>
                <p className="text-xs text-muted-foreground">
                  {s.solicitante?.nome ? `por ${s.solicitante.nome} · ` : ""}
                  {tempoRelativo(s.created_at, agoraMs)}
                  {s.especialista_desejado_id ? " · direcionada" : ""}
                </p>
              </div>
              <ConfirmDeleteButton
                titulo="Cancelar solicitação?"
                descricao={`O pedido${s.mentorado?.nome ? ` de ${s.mentorado.nome}` : ""} sai da lista dos especialistas. Quem pediu é avisado.`}
                acao="Cancelar"
                sucesso="Solicitação cancelada."
                onConfirm={() => cancelarSolicitacao(s.id)}
                trigger={
                  <Button variant="ghost" size="sm" className="shrink-0 text-muted-foreground">
                    <XCircle size={15} />
                    Cancelar
                  </Button>
                }
              />
            </li>
          ))}
        </ul>
        {abertas.length > visiveis.length && (
          <p className="pt-3 text-xs text-muted-foreground">
            e mais {abertas.length - visiveis.length}{" "}
            {abertas.length - visiveis.length === 1 ? "aberta" : "abertas"}…
          </p>
        )}
      </CardContent>
    </Card>
  );
}
