"use client";

import { XCircle } from "@phosphor-icons/react";
import { cancelarSolicitacao } from "@/lib/actions-especialista";
import type { SolicitacaoEspecialista } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ConfirmDeleteButton } from "@/components/confirm-delete-button";

/** "agora" → "há X min/h/d" → data — mesmo formato do sino de notificações. */
function tempoRelativo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60_000);
  if (min < 1) return "agora";
  if (min < 60) return `há ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `há ${h} h`;
  const d = Math.floor(h / 24);
  if (d === 1) return "ontem";
  if (d < 7) return `há ${d} d`;
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "numeric",
    month: "short",
    timeZone: "America/Sao_Paulo",
  });
}

function corta(texto: string, max = 110): string {
  return texto.length > max ? `${texto.slice(0, max).trimEnd()}…` : texto;
}

/** Card do dashboard da coordenação: demandas de especialista esperando
 *  aceite — contagem, as 3 mais recentes e cancelamento com confirmação. A
 *  lista chega por prop (RLS do papel já filtrada pela query). */
export function SolicitacoesCoordCard({
  solicitacoes,
}: {
  solicitacoes: SolicitacaoEspecialista[];
}) {
  const abertas = solicitacoes.filter((s) => s.status === "aberta");
  const visiveis = abertas.slice(0, 3);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          Demandas de especialista
          {abertas.length > 0 && (
            <Badge variant="secondary">{abertas.length}</Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {abertas.length === 0 ? (
          <p className="py-2 text-sm text-muted-foreground">
            Nenhuma demanda aberta no momento.
          </p>
        ) : (
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
                    por {s.solicitante?.nome ?? "—"} · {tempoRelativo(s.created_at)}
                    {s.especialista_desejado_id ? " · direcionada" : ""}
                  </p>
                </div>
                <ConfirmDeleteButton
                  titulo="Cancelar solicitação?"
                  descricao={`A demanda${s.mentorado?.nome ? ` de ${s.mentorado.nome}` : ""} sai do mural dos especialistas. Quem pediu é avisado.`}
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
        )}
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
