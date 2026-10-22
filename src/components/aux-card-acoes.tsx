"use client";

// ⋯ das secundárias do card de atenção da agenda do auxiliar (REALIZA-186):
// com o "Lembrar" visível o rodapé virava supervisão + ficha + nudge — as
// duas secundárias vão pro menu e a primária segue mostrando o cap de 48h
// ("Lembrada dd/mm" só existe como botão visível). Sem nudge ou sem
// supervisão, os botões soltos de antes voltam (≤2 controles no total).

import { useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  ChatsCircle,
  DotsThreeVertical,
} from "@phosphor-icons/react";
import type { SupervisaoAlvo } from "@/lib/queries-supervisao";
import { SupervisaoDialog } from "@/components/supervisao-dialog";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

const LINK_FICHA =
  "inline-flex min-h-11 items-center rounded-lg px-2 text-xs font-semibold text-foreground/80 transition-colors hover:bg-muted hover:text-foreground sm:min-h-8";

export function AuxCardAcoes({
  alvos,
  href,
  nome,
  menu,
}: {
  /** alvo do dialog de supervisão — vazio/ausente quando eu não
   *  supervisiono o mentor da dupla */
  alvos?: SupervisaoAlvo[];
  /** "Ver ficha" da dupla */
  href: string;
  /** nome do jovem — compõe o aria-label do ⋯ */
  nome: string;
  /** true quando a primária ("Lembrar") também está visível — aí as
   *  secundárias viram ⋯; false = botões soltos como antes */
  menu: boolean;
}) {
  const [supOpen, setSupOpen] = useState(false);
  const podeSup = !!alvos?.length;

  if (menu && podeSup) {
    return (
      <>
        <DropdownMenu>
          <DropdownMenuTrigger
            aria-label={`Mais ações da dupla de ${nome}`}
            className={cn(
              buttonVariants({ variant: "ghost", size: "icon" }),
              "size-11 shrink-0 sm:size-8"
            )}
          >
            <DotsThreeVertical size={18} weight="bold" aria-hidden />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuItem onClick={() => setSupOpen(true)}>
              <ChatsCircle size={16} data-icon="inline-start" aria-hidden />
              Registrar supervisão
            </DropdownMenuItem>
            <DropdownMenuItem render={<Link href={href} />}>
              <ArrowRight size={16} data-icon="inline-start" aria-hidden />
              Ver ficha
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        {/* dialog controlado fora do popup — o Select interno recomeça do
            primeiro alvo a cada abertura (contrato do SupervisaoDialog) */}
        <SupervisaoDialog
          alvos={alvos}
          open={supOpen}
          onOpenChange={setSupOpen}
        />
      </>
    );
  }

  return (
    <>
      {podeSup && (
        <SupervisaoDialog
          alvos={alvos}
          trigger={
            <Button variant="outline" size="sm">
              <ChatsCircle size={14} aria-hidden />
              Registrar supervisão
            </Button>
          }
        />
      )}
      <Link href={href} className={LINK_FICHA}>
        Ver ficha ›
      </Link>
    </>
  );
}
