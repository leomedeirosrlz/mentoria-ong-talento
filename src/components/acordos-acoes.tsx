"use client";

import { useState, useTransition } from "react";
import { rotuloIntervencao } from "@/lib/intervencoes";
import {
  abrirChamadoIntervencao,
  fecharIntervencao,
  limparGuiaAjuste,
} from "@/lib/actions-plano";
import { Button } from "@/components/ui/button";

/** "Voltar ao guia" (0220): apaga os ajustes do encontro e o guia
 *  oficial volta a valer sozinho. */
export function VoltarGuiaButton({
  duplaId,
  numero,
}: {
  duplaId: string;
  numero: number;
}) {
  const [pendente, iniciar] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  return (
    <span className="inline-flex items-center gap-2">
      <Button
        variant="outline"
        size="sm"
        disabled={pendente}
        onClick={() =>
          iniciar(async () => {
            const r = await limparGuiaAjuste(duplaId, numero);
            if ("error" in r) setErro(r.error);
          })
        }
      >
        Voltar ao guia oficial
      </Button>
      {erro && <span className="text-xs text-destructive">{erro}</span>}
    </span>
  );
}

/** Ações da intervenção sugerida (0220): a saída real é humana — abrir
 *  chamado pra coordenação, resolver com mensagem ou descartar. */
export function IntervencaoAcoes({
  intervencaoId,
  duplaId,
  tipo,
  motivo,
}: {
  intervencaoId: string;
  duplaId: string;
  tipo: string;
  motivo: string | null;
}) {
  const [pendente, iniciar] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  const agir = (fn: () => Promise<{ ok: true } | { error: string }>) => {
    setErro(null);
    iniciar(async () => {
      const r = await fn();
      if ("error" in r) setErro(r.error);
    });
  };
  return (
    <span className="flex flex-wrap items-center gap-1.5">
      <Button
        variant="outline"
        size="sm"
        disabled={pendente}
        onClick={() =>
          agir(() =>
            abrirChamadoIntervencao(
              intervencaoId,
              duplaId,
              "metodologia",
              `Intervenção sugerida: ${rotuloIntervencao(tipo)}`,
              motivo ?? undefined
            )
          )
        }
      >
        Abrir chamado
      </Button>
      <Button
        variant="ghost"
        size="sm"
        disabled={pendente}
        onClick={() => agir(() => fecharIntervencao(intervencaoId, duplaId, "mensagem"))}
      >
        Resolver com mensagem
      </Button>
      <Button
        variant="ghost"
        size="sm"
        disabled={pendente}
        onClick={() => agir(() => fecharIntervencao(intervencaoId, duplaId, "descartada"))}
      >
        Descartar
      </Button>
      {erro && <span className="text-xs text-destructive">{erro}</span>}
    </span>
  );
}


