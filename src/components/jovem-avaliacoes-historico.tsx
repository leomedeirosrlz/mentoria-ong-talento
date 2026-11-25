"use client";

import { useState } from "react";
import { Star } from "@phosphor-icons/react";
import { Estrelas } from "@/components/estrelas";
import {
  VerAvaliacaoButton,
  type AvaliacaoFeita,
} from "@/components/jovem-avaliacoes";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatDiaMes } from "@/lib/ciclo";

function instante(iso: string | null | undefined): number {
  return iso ? Date.parse(iso) || 0 : 0;
}

/** O histórico da avaliação recorrente — as respostas que o jovem já
 *  enviou, encontro a encontro, cada uma abrindo no dialog de leitura de
 *  sempre (VerAvaliacaoButton). Vive atrás de um ghost button no banner
 *  de pendência e na linha do título quando não há o que avaliar: a
 *  estante fica pra instrumentos de entrega única, o hábito fica aqui. */
export function AvaliacoesHistoricoDialog({
  feitas,
}: {
  feitas: AvaliacaoFeita[];
}) {
  const [open, setOpen] = useState(false);
  const ordenadas = [...feitas].sort(
    (a, b) =>
      instante(b.encontro?.realizado_em ?? b.created_at) -
      instante(a.encontro?.realizado_em ?? a.created_at)
  );
  return (
    <>
      <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>
        Suas avaliações ({feitas.length})
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        {/* xl: lista de leitura — cada registro reabre o dialog de
            detalhe por cima (VerAvaliacaoButton monta o próprio) */}
        <DialogContent size="xl">
          <DialogHeader>
            <DialogTitle>Suas avaliações dos encontros</DialogTitle>
            <DialogDescription>
              Uma nota e um comentário por encontro. Toque pra rever o que
              você escreveu.
            </DialogDescription>
          </DialogHeader>
          <ul className="divide-y divide-border/60">
            {ordenadas.map((a) => (
              <li key={a.id} className="flex items-center gap-3 py-3">
                <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-[var(--inst-avaliacao-t)] text-[var(--inst-avaliacao)]">
                  <Star size={17} weight="fill" aria-hidden />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-x-2 text-sm font-medium">
                    {a.rotulo ??
                      (a.encontro?.numero
                        ? `${a.encontro.numero}º encontro`
                        : "Encontro")}
                    <Estrelas n={a.estrelas} size={12} />
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {formatDiaMes(a.encontro?.realizado_em ?? a.created_at)}
                  </p>
                </div>
                <VerAvaliacaoButton avaliacao={a} />
              </li>
            ))}
          </ul>
        </DialogContent>
      </Dialog>
    </>
  );
}
