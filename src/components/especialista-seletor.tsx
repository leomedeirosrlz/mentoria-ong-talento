"use client";

import { useState, type CSSProperties } from "react";
import { Collapsible } from "@base-ui/react/collapsible";
import {
  CaretDown,
  Check,
  CheckCircle,
  Circle,
  Megaphone,
} from "@phosphor-icons/react";
import { EspecialistaCatalogoCard } from "@/components/especialista-catalogo-card";
import { Button } from "@/components/ui/button";
import { FadeTroca } from "@/components/ui/etapa";
import { Label } from "@/components/ui/label";
import type { JovemEspecialista } from "@/lib/types";
import { cn } from "@/lib/utils";

/** Pool de seleção por cards do catálogo staff (023): substitui o Select
 *  de nomes dos forms de sugestão/solicitação — a anatomia rica do
 *  EspecialistaCatalogoCard, seleção por card-radio (borda/fundo primary
 *  + CheckCircle + aria-pressed — sem selo "Selecionado", REALIZA-526) e
 *  o card "qualquer" no topo da lista. `selecionado = null` é a escolha
 *  sem nome (mural/direcionamento). O topo do form pode ceder quando a
 *  lista abre (`onAbertoChange`) — a superfície decide. */
export function EspecialistaSeletor({
  catalogo,
  selecionado,
  onSelecionar,
  label,
  rotuloQualquer,
  descricaoQualquer,
  idBase,
  linkPerfil,
  onAbertoChange,
}: {
  catalogo: JovemEspecialista[];
  selecionado: string | null;
  onSelecionar: (id: string | null) => void;
  label: string;
  rotuloQualquer: string;
  descricaoQualquer?: string;
  idBase: string;
  /** Ficha da pessoa — o bloco nome/avatar dos cards vira link (o jovem
   *  conhece quem escolhe; no staff abre a /pessoas/[id] da pessoa). */
  linkPerfil?: (e: JovemEspecialista) => string;
  /** Avisa quando o pool abre/fecha — a superfície que cede o topo
   *  (REALIZA-526) escuta daqui. */
  onAbertoChange?: (aberto: boolean) => void;
}) {
  const [aberto, setAberto] = useState(false);
  const espSel = selecionado
    ? (catalogo.find((e) => e.id === selecionado) ?? null)
    : null;

  const mudaAberto = (o: boolean) => {
    setAberto(o);
    onAbertoChange?.(o);
  };

  const escolher = (id: string | null) => {
    onSelecionar(id === selecionado ? null : id);
    mudaAberto(false);
  };

  return (
    <div className="space-y-2">
      <Label id={`${idBase}-label`}>{label}</Label>
      {/* resumo ↔ gatilho: troca de estado no mesmo lugar = crossfade do
          kit, sem direção (028) */}
      <FadeTroca chave={espSel && !aberto ? "resumo" : "gatilho"}>
        {espSel && !aberto ? (
          // resumo da escolha: o card completo da pessoa escolhida já
          // veste a borda de seleção (o estado é o da escolha, não um selo)
          <div className="[&_[data-slot=card]]:border-primary [&_[data-slot=card]]:bg-primary/5">
            <EspecialistaCatalogoCard
              e={espSel}
              href={linkPerfil?.(espSel)}
              rodape={
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="w-full"
                  onClick={() => mudaAberto(true)}
                  aria-expanded={false}
                  aria-controls={`${idBase}-pool`}
                >
                  Trocar
                </Button>
              }
            />
          </div>
        ) : (
          <button
            type="button"
            aria-expanded={aberto}
            aria-controls={`${idBase}-pool`}
            aria-labelledby={`${idBase}-label ${idBase}-valor`}
            onClick={() => mudaAberto(!aberto)}
            className="flex min-h-11 w-full items-center justify-between gap-2 rounded-md border border-input bg-transparent px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted/50"
          >
            <span id={`${idBase}-valor`} className="truncate text-left">
              {aberto ? "Fechar a lista" : rotuloQualquer}
            </span>
            <CaretDown
              size={14}
              className={cn(
                "shrink-0 transition-transform",
                aberto && "rotate-180"
              )}
            />
          </button>
        )}
      </FadeTroca>
      {/* a lista abre por height (a exceção canonizada do Collapsible);
          os cards entram em cascata .animate-enter + --i (028) */}
      <Collapsible.Root open={aberto} onOpenChange={mudaAberto}>
        <Collapsible.Panel className="h-[var(--collapsible-panel-height)] overflow-hidden transition-[height] duration-150 data-ending-style:h-0 data-starting-style:h-0 [&[hidden]:not([hidden='until-found'])]:hidden">
          <ul
            id={`${idBase}-pool`}
            role="list"
            className="mt-2 max-h-96 space-y-3 overflow-y-auto rounded-lg border border-border/60 bg-muted/20 p-2"
          >
            <li
              className="animate-enter"
              style={{ "--i": 0 } as CSSProperties}
            >
              {/* o "qualquer" é a linha-card clicável inteira: alvo único
                  grande, sem selo — o estado é a borda + o indicador +
                  o aria-pressed */}
              <button
                type="button"
                aria-pressed={selecionado === null}
                onClick={() => escolher(null)}
                className={cn(
                  "flex min-h-11 w-full items-center gap-3 rounded-lg border px-3 py-3 text-left transition-colors",
                  selecionado === null
                    ? "border-primary bg-primary/5"
                    : "border-border bg-card hover:bg-muted"
                )}
              >
                <span className="grid size-10 shrink-0 place-items-center rounded-full bg-muted text-muted-foreground">
                  <Megaphone size={18} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium">
                    {rotuloQualquer}
                  </span>
                  {descricaoQualquer && (
                    <span className="mt-0.5 block text-xs text-muted-foreground">
                      {descricaoQualquer}
                    </span>
                  )}
                </span>
                {selecionado === null ? (
                  <CheckCircle
                    size={20}
                    weight="fill"
                    aria-hidden
                    className="shrink-0 text-primary"
                  />
                ) : (
                  <Circle
                    size={20}
                    aria-hidden
                    className="shrink-0 text-muted-foreground/60"
                  />
                )}
              </button>
            </li>
            {catalogo.map((e, i) => {
              const sel = selecionado === e.id;
              return (
                <li
                  key={e.id}
                  className="animate-enter"
                  style={{ "--i": Math.min(i + 1, 10) } as CSSProperties}
                >
                  {/* seleção por card-radio: a borda+fundo primary vestem o
                      card inteiro; o alvo de seleção é o botão do rodapé
                      (nome/avatar segue link pro perfil — sem nested) */}
                  <div
                    className={cn(
                      "[&_[data-slot=card]]:transition-colors",
                      sel &&
                        "[&_[data-slot=card]]:border-primary [&_[data-slot=card]]:bg-primary/5"
                    )}
                  >
                    <EspecialistaCatalogoCard
                      e={e}
                      href={linkPerfil?.(e)}
                      rodape={
                        <Button
                          type="button"
                          size="sm"
                          variant={sel ? "default" : "outline"}
                          className="w-full"
                          aria-pressed={sel}
                          onClick={() => escolher(e.id)}
                        >
                          {sel ? (
                            <>
                              <Check size={14} /> Escolhido
                            </>
                          ) : (
                            "Selecionar"
                          )}
                        </Button>
                      }
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        </Collapsible.Panel>
      </Collapsible.Root>
    </div>
  );
}
