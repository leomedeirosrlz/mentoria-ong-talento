"use client";

import Link from "next/link";
import { Collapsible } from "@base-ui/react/collapsible";
import {
  CalendarDots,
  CaretDown,
  CheckCircle,
  ClockCounterClockwise,
  HandHeart,
  ListChecks,
  Megaphone,
  ShareNetwork,
  Signature,
  Sparkle,
  Star,
} from "@phosphor-icons/react";
import { maxEncontros } from "@/lib/ciclo";
import type { PendenciaJovem, TipoPendencia } from "@/lib/pendencias-jovem";
import type { JovemEncontro } from "@/lib/queries-jovem";
import {
  AvaliarPendenteButton,
  type AvaliacaoPendente,
} from "@/components/jovem-avaliacoes";
import {
  AconteceuJovem,
  NaoAconteceuJovem,
} from "@/components/jovem-encontro-acoes";
import { JovemAgendarDialog } from "@/components/jovem-agendar-dialog";
import { JovemRetroativoDialog } from "@/components/jovem-retroativo-dialog";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/** Contexto que a página resolve por encontro — a pendência carrega só o
 *  id; os gestos (desfecho, remarcação) precisam da row e da dupla. */
export type EncontroCtx = {
  e: JovemEncontro;
  /** Dupla 'ativa' — as RPCs do jovem exigem; sem ela o gesto não renderiza
   *  (botão que falha é promessa quebrada). */
  ativa: boolean;
  /** Trilha de especialista — remarcar por aqui é DPP-only (a RPC recusa). */
  esp: boolean;
};

const ICONE: Record<
  TipoPendencia,
  { Icone: typeof Star; cls: string }
> = {
  encontro_sem_desfecho: {
    Icone: CalendarDots,
    cls: "bg-[var(--warn)]/15 text-[var(--warn-text)]",
  },
  registro_retroativo: {
    Icone: ClockCounterClockwise,
    cls: "bg-[var(--brand-lime)]/20 text-foreground",
  },
  termo: { Icone: Signature, cls: "bg-muted text-muted-foreground" },
  combinado: { Icone: ListChecks, cls: "bg-muted text-muted-foreground" },
  avaliacao: {
    Icone: Star,
    cls: "bg-[var(--brand-lime)]/20 text-foreground",
  },
  especialista: { Icone: Sparkle, cls: "bg-muted text-muted-foreground" },
  aviso: { Icone: Megaphone, cls: "bg-muted text-muted-foreground" },
  chamado: { Icone: HandHeart, cls: "bg-muted text-muted-foreground" },
};

/** Lista única de pendências do jovem (REALIZA-493): a ordem vem pronta do
 *  motor (`derivarPendencias`) — 3 à vista e o resto em "e mais N". O
 *  primeiro item (destaque do motor) ganha a única ação preenchida; os
 *  demais ficam em outline/ghost. Mesma peça da home ("Para fazer agora")
 *  e do topo da agenda ("Precisa de você"). */
export function JovemParaFazer({
  pendencias,
  encontros,
  pendentes,
  retro,
  primeiroNome,
  titulo = "Para fazer agora",
  id = "fazer-titulo",
  maxVisiveis = 3,
  mediaPorDupla,
}: {
  pendencias: PendenciaJovem[];
  /** alvoId → row + régua da dupla (só encontros viram gesto na tela). */
  encontros: Record<string, EncontroCtx>;
  /** Avaliações abertas — resolve o alvoId do item "avaliacao". */
  pendentes: AvaliacaoPendente[];
  /** Retroativo do jovem (0207): candidatos do dialog do item retro. */
  retro: { duplaId: string | null; numeros: number[] };
  primeiroNome: string;
  titulo?: string;
  /** id do h2 pro aria-labelledby da seção. */
  id?: string;
  /** Itens à vista antes do "e mais N" (o motor já ordenou). */
  maxVisiveis?: number;
  /** dupla_id → lote da média já existe (≥3 respostas) — a copy do
   *  dialog de avaliar não promete média que não existe (027/FR-003). */
  mediaPorDupla?: ReadonlyMap<string, boolean>;
}) {
  const visiveis = pendencias.slice(0, maxVisiveis);
  const resto = pendencias.slice(maxVisiveis);
  const ctxItem = { encontros, pendentes, retro, primeiroNome, mediaPorDupla };

  return (
    <section aria-labelledby={id} className="space-y-3">
      <h2 id={id} className="font-semibold">
        {titulo}
      </h2>
      <Card className="animate-enter" style={{ "--i": 1 } as React.CSSProperties}>
        <CardContent className="p-0">
          {pendencias.length === 0 ? (
            <p className="flex items-center gap-3 px-5 py-3.5 text-sm text-muted-foreground">
              <CheckCircle
                size={18}
                weight="fill"
                className="shrink-0 text-[var(--ok-text)]"
                aria-hidden
              />
              Nada pendente por agora. Bom trabalho!
            </p>
          ) : (
            <>
              <ul className="divide-y divide-border/60">
                {visiveis.map((p) => (
                  <PendenciaItem key={p.id} p={p} {...ctxItem} />
                ))}
              </ul>
              {resto.length > 0 && (
                <Collapsible.Root>
                  <Collapsible.Trigger className="group flex min-h-11 w-full items-center gap-1 border-t border-border/60 px-5 text-left text-xs font-medium text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-3 focus-visible:ring-inset focus-visible:ring-ring/50">
                    e mais {resto.length}
                    <CaretDown
                      size={14}
                      aria-hidden
                      className="transition-transform group-aria-expanded:rotate-180"
                    />
                  </Collapsible.Trigger>
                  <Collapsible.Panel>
                    <ul className="divide-y divide-border/60 border-t border-border/60">
                      {resto.map((p) => (
                        <PendenciaItem key={p.id} p={p} {...ctxItem} />
                      ))}
                    </ul>
                  </Collapsible.Panel>
                </Collapsible.Root>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </section>
  );
}

function PendenciaItem({
  p,
  encontros,
  pendentes,
  retro,
  primeiroNome,
  mediaPorDupla,
}: {
  p: PendenciaJovem;
  encontros: Record<string, EncontroCtx>;
  pendentes: AvaliacaoPendente[];
  retro: { duplaId: string | null; numeros: number[] };
  primeiroNome: string;
  mediaPorDupla?: ReadonlyMap<string, boolean>;
}) {
  const { Icone, cls } = ICONE[p.tipo];
  const acoes = acoesPendencia({ p, encontros, pendentes, retro, primeiroNome, mediaPorDupla });
  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-2 px-5 py-3">
      <span
        aria-hidden
        className={cn(
          "grid size-9 shrink-0 place-items-center rounded-full",
          cls
        )}
      >
        <Icone size={16} />
      </span>
      <div className="min-w-0 flex-1 basis-44">
        <p className="text-sm font-medium">{p.titulo}</p>
        {p.contexto && (
          <p className="mt-0.5 text-xs text-muted-foreground">{p.contexto}</p>
        )}
      </div>
      {acoes && (
        <div className="ms-auto flex flex-wrap items-center justify-end gap-2">
          {acoes}
        </div>
      )}
    </li>
  );
}

/** Uma ação por pendência — o `destaque` do motor (só o 1º item) decide a
 *  única variante preenchida; os demais gestos ficam em outline/ghost. */
function acoesPendencia({
  p,
  encontros,
  pendentes,
  retro,
  primeiroNome,
  mediaPorDupla,
}: {
  p: PendenciaJovem;
  encontros: Record<string, EncontroCtx>;
  pendentes: AvaliacaoPendente[];
  retro: { duplaId: string | null; numeros: number[] };
  primeiroNome: string;
  mediaPorDupla?: ReadonlyMap<string, boolean>;
}) {
  const cheio = p.destaque ? "default" : "outline";

  switch (p.tipo) {
    case "encontro_sem_desfecho": {
      const ctx = p.acao.alvoId ? encontros[p.acao.alvoId] : undefined;
      // sem a row ou com a dupla parada não há gesto honesto a oferecer —
      // as RPCs (0072/0121) recusariam na hora
      if (!ctx?.ativa) return null;
      const encerramento = ctx.e.numero >= maxEncontros(ctx.esp ? "especialista" : "dpp");
      return (
        <>
          {!encerramento && (
            <AconteceuJovem encontroId={ctx.e.id} variant={cheio} />
          )}
          {!ctx.esp && (
            <JovemAgendarDialog
              duplaId={ctx.e.dupla_id}
              numero={ctx.e.numero}
              atual={ctx.e}
              trigger={
                <Button variant="ghost" size="sm">
                  <CalendarDots size={15} aria-hidden />
                  Remarcar
                </Button>
              }
            />
          )}
          <NaoAconteceuJovem encontroId={ctx.e.id} />
        </>
      );
    }

    case "registro_retroativo":
      if (retro.duplaId == null) return null;
      return (
        <JovemRetroativoDialog
          duplaId={retro.duplaId}
          numeros={retro.numeros}
          trigger={
            <Button variant={cheio} size="sm">
              <ClockCounterClockwise size={15} aria-hidden />
              {p.acao.rotulo}
            </Button>
          }
        />
      );

    case "termo":
      // token nulo = link que não existe — o estado honesto é o pedido de
      // um novo, nunca um botão morto
      if (!p.acao.href) {
        return (
          <span className="text-xs text-muted-foreground">
            Peça um novo link à coordenação
          </span>
        );
      }
      return (
        <Link href={p.acao.href} className={buttonVariants({ variant: cheio, size: "sm" })}>
          {p.acao.rotulo === "Encaminhar" ? (
            <ShareNetwork size={15} aria-hidden />
          ) : (
            <Signature size={15} aria-hidden />
          )}
          {p.acao.rotulo}
        </Link>
      );

    case "combinado":
      return (
        <Link
          href={p.acao.href ?? "/jovem#combinados-titulo"}
          className={buttonVariants({ variant: cheio, size: "sm" })}
        >
          Ver combinado
        </Link>
      );

    case "avaliacao": {
      const alvo = pendentes.find((a) => a.encontroId === p.acao.alvoId);
      if (!alvo) return null;
      return (
        <AvaliarPendenteButton
          pendente={alvo}
          primeiroNome={primeiroNome}
          variant={cheio}
          temMedia={
            // dupla conhecida fora do mapa = zero respostas → sem lote,
            // a copy não promete média; sem duplaId o default otimista vale
            alvo.duplaId ? (mediaPorDupla?.get(alvo.duplaId) ?? false) : undefined
          }
        />
      );
    }

    case "especialista":
    case "aviso":
    case "chamado":
      if (!p.acao.href) return null;
      return (
        <Link href={p.acao.href} className={buttonVariants({ variant: cheio, size: "sm" })}>
          {p.acao.rotulo}
        </Link>
      );

    default:
      // tipos novos do motor sem gesto mapeado: link simples quando há href
      return p.acao.href ? (
        <Link
          href={p.acao.href}
          className="inline-flex min-h-11 items-center gap-1 text-sm font-medium underline-offset-4 outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          {p.acao.rotulo}
        </Link>
      ) : null;
  }
}
