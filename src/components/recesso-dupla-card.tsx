"use client";

import { useState, useTransition } from "react";
import { Check, SunHorizon } from "@phosphor-icons/react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { declararRecesso } from "@/lib/actions-recesso";

// REALIZA-462/518 — a decisão de recesso é da dupla e por período:
// usa=true = os encontros pausam no período; usa=false = a dupla segue
// se encontrando. Tri-estado
// da 518: sem row em dupla_recessos = PENDENTE ("a dupla ainda não
// decidiu"), nunca default silencioso. Só mentor e mentorado declaram
// (a RPC 0225 revalida no banco); staff acompanha e cobra — "a decisão
// é da dupla". O calendário oficial não muda; o que muda é como planner
// e agendas tratam a janela pra esta dupla.

export type RecessoDaFicha = {
  cicloEventoId: string;
  titulo: string;
  /** "YYYY-MM-DD" — período oficial do cronograma. */
  inicio: string;
  fim: string;
  /** Decisão vigente; null = a dupla ainda não decidiu (sem row). */
  usa: boolean | null;
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
  /** lado da dupla (mentor/jovem) — a RPC revalida na gravação; staff
   *  lê o estado sem botão */
  podeDeclarar: boolean;
  souMentor: boolean;
}) {
  if (recessos.length === 0) return null;

  return (
    // âncora estável da fila do staff (019): sem card de plano na tela é
    // este quem existe — o mesmo id vai no bloco dentro do PlanoEmDiaCard
    // (as duas superfícies nunca montam juntas)
    <Card id="recesso-dupla" className="scroll-mt-20">
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
                ? "Vocês combinam juntos se pausam os encontros ou seguem se encontrando. Qualquer um dos dois pode responder pela dupla."
                : "A decisão é da dupla. A equipe acompanha e cobra, não responde por eles."}
            </p>
          </div>
        </div>

        <RecessoDecisao
          duplaId={duplaId}
          recessos={recessos}
          podeDeclarar={podeDeclarar}
        />
      </CardContent>
    </Card>
  );
}

/** As linhas de decisão por período — reutilizadas dentro do card "Para
 *  ficar em dia" (lá só leitura: a resposta mora no Combinar o plano) e
 *  na central de acordos, onde a decisão muda a proposta. `onDecisao`
 *  avisa o pai quando uma resposta nova grava — o aceite com recesso
 *  repensado precisa das decisões frescas, não das props (518, US3.5). */
export function RecessoDecisao({
  duplaId,
  recessos,
  podeDeclarar,
  onDecisao,
}: {
  duplaId: string;
  recessos: RecessoDaFicha[];
  podeDeclarar: boolean;
  onDecisao?: (cicloEventoId: string, usa: boolean) => void;
}) {
  const [pendente, start] = useTransition();
  const [erro, setErro] = useState<string | null>(null);

  const declarar = (cicloEventoId: string, usa: boolean) => {
    setErro(null);
    start(async () => {
      const r = await declararRecesso(duplaId, cicloEventoId, usa);
      if ("error" in r) {
        setErro(r.error);
        return;
      }
      onDecisao?.(cicloEventoId, usa);
    });
  };

  return (
    <>
      {recessos.map((r) => {
        const decidido = r.declaradoEm != null && r.usa != null;
        return (
          <div
            key={r.cicloEventoId}
            className="rounded-lg bg-muted/50 px-3.5 py-3 shadow-[var(--shadow-inset)]"
          >
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
              <p className="text-sm font-medium">
                {r.titulo} · {janela(r.inicio, r.fim)}
              </p>
              <p className="text-xs text-muted-foreground">
                {decidido
                  ? r.usa
                    ? "vão pausar os encontros"
                    : "seguem se encontrando"
                  : "a dupla ainda não decidiu"}
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
                  variant={decidido && r.usa === true ? "default" : "outline"}
                  disabled={pendente}
                  onClick={() => declarar(r.cicloEventoId, true)}
                >
                  {decidido && r.usa === true && (
                    <Check size={14} aria-hidden />
                  )}
                  Vamos pausar os encontros
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={decidido && r.usa === false ? "default" : "outline"}
                  disabled={pendente}
                  onClick={() => declarar(r.cicloEventoId, false)}
                >
                  {decidido && r.usa === false && (
                    <Check size={14} aria-hidden />
                  )}
                  Vamos seguir nos encontrando
                </Button>
              </div>
            )}
          </div>
        );
      })}
      {erro && (
        <p role="status" className="text-xs text-[var(--warn-text)]">
          {erro}
        </p>
      )}
    </>
  );
}
