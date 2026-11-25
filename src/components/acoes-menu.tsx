"use client";

// O ⋯ data-driven das fileiras de ação (REALIZA-530): o caller descreve os
// itens e o menu monta trigger + popup — mesmo visual do ⋯ da dupla
// (DuplaLinhaMenu): outline sm, "Ações" a partir do md, popup w-56 ancorado
// no fim. Item com `href` rende <a> de verdade pelo render do Base UI (Cmd/
// middle-click e nova aba funcionam — mesmo padrão do whatsapp-rapido); com
// `onEscolher` o item avisa que abre dialog (aria-haspopup). Sem item rende
// nada — a decisão do vazio é do caller.

import { DotsThree } from "@phosphor-icons/react";
import { buttonVariants } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

export type AcaoMenuItem = {
  id: string;
  rotulo: string;
  icone?: React.ReactNode;
  /** link externo/da chamada — renderiza <a> dentro do item */
  href?: string;
  /** abre dialog — o item leva aria-haspopup="dialog" */
  onEscolher?: () => void;
};

export function AcoesMenu({
  itens,
  label = "Ações",
  className,
}: {
  itens: AcaoMenuItem[];
  /** aria-label do trigger — no md+ o texto "Ações" aparece, mas o nome
   *  acessível específico segue valendo pros dois */
  label?: string;
  className?: string;
}) {
  if (itens.length === 0) return null;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={label}
        className={cn(
          buttonVariants({ variant: "ghost", size: "sm" }),
          "w-11 shrink-0 px-0 text-muted-foreground hover:bg-muted/60 md:w-auto md:px-2.5",
          className
        )}
      >
        <DotsThree weight="bold" aria-hidden />
        <span className="hidden whitespace-nowrap md:inline">Ações</span>
      </DropdownMenuTrigger>
      {/* w-56: o popup é mais largo que o trigger — a âncora ficaria
          apertada pros labels de ação (mesma norma do ⋯ da dupla) */}
      <DropdownMenuContent align="end" className="w-56">
        {itens.map((it) => (
          <DropdownMenuItem
            key={it.id}
            aria-haspopup={it.onEscolher ? "dialog" : undefined}
            onClick={it.onEscolher}
            render={
              it.href ? (
                <a href={it.href} target="_blank" rel="noopener noreferrer" />
              ) : undefined
            }
          >
            {it.icone}
            {it.rotulo}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
