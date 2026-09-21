"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  ArrowsCounterClockwise,
  Binoculars,
  CaretUp,
  Check,
  Flask,
  Handshake,
  MapTrifold,
  SignOut,
  UsersThree,
  type Icon,
} from "@phosphor-icons/react";
import { papelLabel } from "@/lib/ciclo";
import {
  reverOnboardingDemo,
  sairDaDemo,
  trocarPapelDemo,
} from "@/lib/demo/actions";
import { DEMO_ROLES } from "@/lib/demo/shared";
import type { AppRole } from "@/lib/types";
import {
  Popover,
  PopoverContent,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

/** Ícone por papel — o mesmo da landing /demo, pra leitura "ver como X". */
const PAPEL_ICON: Record<AppRole, Icon> = {
  coordenacao: Binoculars,
  supervisor: UsersThree,
  mentor_dpp: MapTrifold,
  mentor_especialista: Handshake,
};

/** Pill fixa do modo demo — montada pelo layout do (app) quando o cookie
 *  demo_role está ativo, inclusive por cima do OnboardingFlow. As actions já
 *  navegam (redirect na server action); aqui só fecha o popover e toasta erro. */
export function DemoBar({
  papel,
  personas,
}: {
  papel: AppRole;
  personas: Record<AppRole, string>;
}) {
  const [aberto, setAberto] = useState(false);
  const [pending, start] = useTransition();

  function executar(acao: () => Promise<{ error: string } | void>) {
    start(async () => {
      setAberto(false);
      const res = await acao();
      if (res?.error) toast.error(res.error);
    });
  }

  return (
    // acima do bottom nav mobile (z-40) e do footer fixo do onboarding —
    // a pill não pode ficar escondida em nenhum estado da demo
    <div className="fixed right-4 bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-50 md:bottom-6">
      <Popover open={aberto} onOpenChange={setAberto}>
        {/* inversão de marca (ink sobre lime) = "modo alternativo", não chrome do app */}
        <PopoverTrigger
          aria-label="Controles da demonstração"
          className="flex items-center gap-2 rounded-full bg-[var(--brand-ink)] px-4 py-2.5 text-sm font-semibold text-[var(--brand-lime)] shadow-lg ring-1 ring-foreground/10 outline-none transition-transform hover:scale-[1.03] focus-visible:ring-2 focus-visible:ring-[var(--brand-lime)] active:scale-[0.97]"
        >
          <Flask size={15} weight="fill" aria-hidden />
          Demo · {papelLabel(papel)}
          <CaretUp
            size={13}
            weight="bold"
            aria-hidden
            className={cn(
              "transition-transform duration-200",
              aberto && "rotate-180"
            )}
          />
        </PopoverTrigger>
        <PopoverContent
          side="top"
          align="end"
          sideOffset={8}
          className="w-72 max-w-[calc(100vw-2rem)] p-0"
        >
          <div className="border-b border-border px-4 py-3">
            <PopoverTitle className="text-sm font-semibold">
              Modo demonstração
            </PopoverTitle>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Dados fictícios — nada é gravado.
            </p>
          </div>

          <p className="px-4 pt-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            Ver como
          </p>
          <div className="mt-1 pb-1.5">
            {DEMO_ROLES.map((role) => {
              const Icone = PAPEL_ICON[role];
              const ativo = role === papel;
              return (
                <button
                  key={role}
                  type="button"
                  disabled={pending}
                  aria-current={ativo || undefined}
                  onClick={() => executar(() => trocarPapelDemo(role))}
                  className="flex w-full items-center gap-3 px-4 py-2.5 text-left outline-none transition-colors hover:bg-muted/60 focus-visible:bg-muted/60 disabled:pointer-events-none disabled:opacity-50"
                >
                  <span className="grid size-8 shrink-0 place-items-center rounded-full bg-[var(--brand-lime)] text-[var(--brand-ink)]">
                    <Icone size={15} weight="fill" aria-hidden />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">
                      {papelLabel(role)}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {personas[role]}
                    </span>
                  </span>
                  {ativo && (
                    <Check
                      size={16}
                      weight="bold"
                      aria-hidden
                      className="shrink-0"
                    />
                  )}
                </button>
              );
            })}
          </div>

          <div className="border-t border-border py-1.5">
            <button
              type="button"
              disabled={pending}
              onClick={() => executar(reverOnboardingDemo)}
              className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm outline-none transition-colors hover:bg-muted/60 focus-visible:bg-muted/60 disabled:pointer-events-none disabled:opacity-50"
            >
              <ArrowsCounterClockwise
                size={16}
                aria-hidden
                className="shrink-0 text-muted-foreground"
              />
              Rever apresentação inicial
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => executar(sairDaDemo)}
              className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm text-muted-foreground outline-none transition-colors hover:bg-muted/60 hover:text-destructive focus-visible:bg-muted/60 disabled:pointer-events-none disabled:opacity-50"
            >
              <SignOut size={16} aria-hidden className="shrink-0" />
              Sair da demonstração
            </button>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
