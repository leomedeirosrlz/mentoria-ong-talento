"use client";

import { CaretDown, WhatsappLogo } from "@phosphor-icons/react";
import { waLink } from "@/lib/ciclo";
import { NudgeButton } from "@/components/nudge-button";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/** Um destino de WhatsApp: o rótulo da escolha ("Chamar mentor"), o número e
 *  a mensagem pronta. `t` é o tipo gravado em `interacoes` quando o clique
 *  passa por /api/nudge — mentor leva "nudge"/"apoio" e mentorado "contato":
 *  tipos distintos coexistem no dedupe de 60s por (dupla, autor, tipo). */
export type DestinoWA = {
  rotulo: string;
  telefone: string | null | undefined;
  mensagem: string;
  t: "nudge" | "contato" | "apoio";
};

/** Mesma âncora do NudgeButton: com duplaId o clique passa por /api/nudge
 *  (loga o contato) e só então redireciona pro wa.me. */
function hrefDestino(d: DestinoWA, duplaId?: string): string | null {
  const wa = waLink(d.telefone, d.mensagem);
  if (!wa) return null;
  return duplaId
    ? `/api/nudge?d=${encodeURIComponent(duplaId)}&to=${encodeURIComponent(wa)}&t=${encodeURIComponent(d.t)}`
    : wa;
}

/** WhatsApp com vários destinos pra mesma dupla. `compacto` colapsa a
 *  escolha num dropdown único "WhatsApp" — mas só quando a escolha é real:
 *  com zero ou um número viável cai pros NudgeButton enfileirados, que já
 *  mostram inline o "sem WhatsApp cadastrado" em vez de esconder a ação.
 *  O modo demo sai de graça — /api/nudge já trata o cookie antes do log. */
export function WhatsAppRapido({
  duplaId,
  destinos,
  compacto = false,
}: {
  /** Com duplaId os itens passam por /api/nudge (log por tipo `t`). */
  duplaId?: string;
  destinos: DestinoWA[];
  /** Um botão "WhatsApp" abrindo o menu de destinos. */
  compacto?: boolean;
}) {
  const validos = destinos.filter(
    (d) => waLink(d.telefone, d.mensagem) != null
  );
  if (!compacto || validos.length <= 1) {
    return (
      <span className="inline-flex flex-wrap items-center gap-2">
        {destinos.map((d) => (
          <NudgeButton
            key={d.rotulo}
            telefone={d.telefone}
            mensagem={d.mensagem}
            label={d.rotulo}
            duplaId={duplaId}
            t={d.t}
          />
        ))}
      </span>
    );
  }
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="outline"
            size="sm"
            className="text-muted-foreground hover:border-[var(--brand-lime)]/60 hover:bg-[var(--brand-lime)]/15 hover:text-foreground"
          >
            <WhatsappLogo size={15} aria-hidden />
            WhatsApp
            <CaretDown size={13} aria-hidden className="text-muted-foreground" />
          </Button>
        }
      />
      <DropdownMenuContent align="end" className="w-auto min-w-56">
        {destinos.map((d) => {
          const href = hrefDestino(d, duplaId);
          return (
            <DropdownMenuItem
              key={d.rotulo}
              disabled={!href}
              render={
                href ? (
                  <a href={href} target="_blank" rel="noopener noreferrer" />
                ) : undefined
              }
            >
              <WhatsappLogo aria-hidden />
              {d.rotulo}
              {!href && (
                // número ausente fica visível — esconder a opção deixaria a
                // equipe procurando um contato que não existe cadastrado
                <span className="ml-auto pl-3 text-xs text-muted-foreground">
                  sem WhatsApp cadastrado
                </span>
              )}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
