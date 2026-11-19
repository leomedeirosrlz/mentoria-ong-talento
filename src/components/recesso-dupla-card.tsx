"use client";

import { useState, useTransition } from "react";
import { Check, SunHorizon } from "@phosphor-icons/react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { declararRecesso } from "@/lib/actions-recesso";

// REALIZA-462 — a decisão de recesso é da dupla e por período: "vamos
// usar o recesso" (default, igual ao comportamento de sempre) ou "vamos
// seguir nos encontrando". O calendário oficial não muda; o que muda é
// como planner e agendas tratam a janela pra esta dupla.

export type RecessoDaFicha = {
  cicloEventoId: string;
  titulo: string;
  /** "YYYY-MM-DD" — janela oficial do cronograma. */
  inicio: string;
  fim: string;
  /** Decisão vigente; default true (ausência de declaração = usa o recesso). */
  usa: boolean;
  declaradoEm: string | null;
  autorNome: string | null;
};

const fmtDia = new Intl.DateTimeFormat("pt-BR", {
  day: "numeric",
  month: "short",
  timeZone: "UTC", // as datas chegam como YYYY-MM-DD — âncora no UTC como o resto do app
});

function janela(inicio: string, fim: string): string {
  const a = `${inicio}T12:00:00Z`;
  const b = `${fim}T12:00:00Z`;
  return inicio === fim
    ? fmtDia.format(new Date(a))
    : `${fmtDia.format(new Date(a))} a ${fmtDia.format(new Date(b))}`;
}

function autoria(r: RecessoDaFicha): string | null {
  if (!r.declaradoEm) return null;
  const quem = r.autorNome ? ` por ${r.autorNome.split(" ")[0]}` : "";
  const quando = new Date(r.declaradoEm).toLocaleDateString("pt-BR", {
    day: "numeric",
    month: "short",
    timeZone: "America/Sao_Paulo",
  });
  return `decidido${quem} em ${quando}`;
}

export function RecessoDuplaCard({
  duplaId,
  recessos,
  podeDeclarar,
  souMentor,
}: {
  duplaId: string;
  recessos: RecessoDaFicha[];
  /** mentor da dupla ou coordenação — a RPC revalida na gravação. */
  podeDeclarar: boolean;
  souMentor: boolean;
}) {
  const [pendente, start] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  if (recessos.length === 0) return null;

  const declarar = (cicloEventoId: string, usa: boolean) => {
    setErro(null);
    start(async () => {
      const r = await declararRecesso(duplaId, cicloEventoId, usa);
      if ("error" in r) setErro(r.error);
    });
  };

  return (
    <Card>
      <CardContent className="space-y-3 p-5">
        <div className="flex items-start gap-3">
          <span
            aria-hidden
            className="grid size-8 shrink-0 place-items-center rounded-full bg-muted text-muted-foreground"
          >
            <SunHorizon size={16} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">
              {recessos.length > 1 ? "Recessos do programa" : "Recesso do programa"}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {souMentor
                ? "Vocês combinam juntos se param ou seguem se encontrando."
                : "A dupla combina se para ou segue se encontrando."}
            </p>
          </div>
        </div>

        {recessos.map((r) => (
          <div
            key={r.cicloEventoId}
            className="rounded-lg bg-muted/50 px-3.5 py-3 shadow-[var(--shadow-inset)]"
          >
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
              <p className="text-sm font-medium">
                {r.titulo} · {janela(r.inicio, r.fim)}
              </p>
              <p className="text-xs text-muted-foreground">
                {r.declaradoEm
                  ? r.usa
                    ? "vão usar o recesso"
                    : "seguem se encontrando"
                  : "usando o recesso (padrão)"}
              </p>
            </div>
            {autoria(r) && (
              <p className="mt-1 text-xs text-muted-foreground">{autoria(r)}</p>
            )}
            {podeDeclarar && (
              <div
                className="mt-2.5 flex flex-wrap gap-2"
                role="group"
                aria-label={`Decisão sobre ${r.titulo}`}
              >
                <Button
                  type="button"
                  size="sm"
                  variant={r.usa ? "default" : "outline"}
                  disabled={pendente}
                  onClick={() => declarar(r.cicloEventoId, true)}
                >
                  {r.usa && r.declaradoEm && <Check size={14} aria-hidden />}
                  Vamos usar o recesso
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={!r.usa ? "default" : "outline"}
                  disabled={pendente}
                  onClick={() => declarar(r.cicloEventoId, false)}
                >
                  {!r.usa && <Check size={14} aria-hidden />}
                  Vamos seguir nos encontrando
                </Button>
              </div>
            )}
          </div>
        ))}
        {erro && <p className="text-xs text-[var(--warn-text)]">{erro}</p>}
      </CardContent>
    </Card>
  );
}
