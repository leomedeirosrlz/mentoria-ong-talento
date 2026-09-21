"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CircleNotch, HandHeart } from "@phosphor-icons/react";
import { toast } from "sonner";
import { aceitarSolicitacao } from "@/lib/actions-especialista";
import { formatDate } from "@/lib/ciclo";
import type { SolicitacaoEspecialista } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

/** Mural da home do mentor especialista: demandas abertas registradas por
 *  mentores DPP. A RLS deixa ver todas as abertas, mas a direcionada a outro
 *  especialista não pode ser aceita por mim — omitir é a UX certa (aceitar
 *  daria erro de domínio na cara). `meuId` = profile.id do especialista. */
export function DemandasEspecialista({
  solicitacoes,
  meuId,
}: {
  solicitacoes: SolicitacaoEspecialista[];
  meuId: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  // qual linha está aceitando — o botão dela mostra o spinner, as outras travam
  const [aceitando, setAceitando] = useState<string | null>(null);

  const abertas = solicitacoes.filter(
    (s) =>
      s.status === "aberta" &&
      (!s.especialista_desejado_id || s.especialista_desejado_id === meuId)
  );

  function aceitar(s: SolicitacaoEspecialista) {
    setAceitando(s.id);
    start(async () => {
      try {
        const res = await aceitarSolicitacao(s.id);
        if (res?.error) {
          toast.error(res.error);
          setAceitando(null);
          return;
        }
        toast.success("Pedido aceito — a dupla foi criada.");
        router.push(`/duplas/${res.duplaId}`);
      } catch {
        toast.error("Sem conexão — tente de novo.");
        setAceitando(null);
      }
    });
  }

  return (
    <section aria-label="Pedidos de mentoria especializada" className="space-y-3">
      <h2 className="flex items-center gap-2 text-lg font-semibold tracking-tight">
        <HandHeart aria-hidden className="size-5 text-muted-foreground" />
        Pedidos de especialista
      </h2>

      {abertas.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            Nenhum pedido aberto no momento.
          </CardContent>
        </Card>
      ) : (
        <ul className="space-y-3">
          {abertas.map((s) => {
            const praMim = s.especialista_desejado_id === meuId;
            return (
              <li key={s.id}>
                <Card>
                  <CardContent className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
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
                      </div>
                      <p className="text-sm">{s.demanda}</p>
                      <p className="text-xs text-muted-foreground">
                        Solicitado por {s.solicitante?.nome ?? "—"} ·{" "}
                        {formatDate(s.created_at)}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      className="shrink-0 self-start sm:self-center"
                      disabled={pending}
                      onClick={() => aceitar(s)}
                    >
                      {pending && aceitando === s.id && (
                        <CircleNotch className="animate-spin" />
                      )}
                      {pending && aceitando === s.id
                        ? "Aceitando…"
                        : "Aceitar pedido"}
                    </Button>
                  </CardContent>
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
