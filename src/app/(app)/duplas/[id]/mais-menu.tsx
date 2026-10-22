"use client";

// Overflow "Mais" do header da ficha (REALIZA-157) — cada item é um
// DropdownMenuItem comum com onClick que só escolhe qual dialog abrir.
// A composição anterior (Dialog.Trigger render={Menu.Item}) era o defeito:
// o item híbrido não preenchia a largura do popup e obrigava o Portal
// keepMounted hand-rolled pra não desmontar o dialog junto do menu. Com os
// dialogs fora do popup o menu volta ao DropdownMenuContent padrão — fill,
// setas e devolução de foco vêm de graça do Menu.
//
// Cada prop-grupo presente = um item + o dialog dele, sempre montado (fecha
// com animação e abre limpo — os dialogs resetam na borda de subida do
// `open`, mesmo padrão do RemanejarDuplaDialog). Sem item nenhum, some.

import { useState } from "react";
import {
  CalendarPlus,
  DotsThree,
  FlagCheckered,
  PaperPlaneTilt,
  Sparkle,
  UserPlus,
} from "@phosphor-icons/react";
import type { Encontro } from "@/lib/types";
import { AgendarEncontroDialog } from "@/components/agendar-encontro-dialog";
import {
  EnviarFormularioDialog,
  type FormularioOpcao,
  type PessoaDestino,
} from "@/components/enviar-formulario-dialog";
import { SolicitarEspecialistaDialog } from "@/components/solicitar-especialista-dialog";
import { SugerirEspecialistaDialog } from "@/components/sugerir-especialista-dialog";
import { EncerrarTrilhaDialog } from "@/components/encerrar-trilha-dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type DialogId = "agendar" | "form" | "solicitar" | "sugerir" | "encerrar";

type EspecialistaOpcao = {
  id: string;
  nome: string;
  areas: string[] | null;
};

export function DuplaMaisMenu({
  duplaId,
  agendar,
  formulario,
  solicitar,
  sugerir,
  encerrar,
}: {
  duplaId: string;
  /** "Agendar encontro" — mentor em dupla DPP ativa com pendência de
   *  registro. As props do dialog vêm prontas da página. */
  agendar?: {
    numero: number;
    atual: Encontro | null;
    sugerido?: string;
    piso?: string;
    jovemNome?: string;
  } | null;
  /** "Enviar formulário" — coordenação em dupla viva. */
  formulario?: {
    formularios: FormularioOpcao[];
    mentor: PessoaDestino;
    mentorado: PessoaDestino;
  } | null;
  /** "Solicitar mentor especialista" — pedido direto (mentor DPP ou coord). */
  solicitar?: { especialistas: EspecialistaOpcao[] } | null;
  /** "Sugerir especialista pro jovem" — a sugestão do mentor DPP, que o
   *  jovem confirma antes de virar pedido. */
  sugerir?: {
    mentoradoId: string;
    nomeJovem: string;
    especialistas: EspecialistaOpcao[];
  } | null;
  /** "Encerrar trilha" — fechamento da trilha especialista aberta. */
  encerrar?: boolean;
}) {
  const [aberto, setAberto] = useState<DialogId | null>(null);

  const temItem =
    !!agendar || !!formulario || !!solicitar || !!sugerir || !!encerrar;
  if (!temItem) return null;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button variant="outline" size="sm">
              <DotsThree size={16} weight="bold" /> Mais
            </Button>
          }
        />
        {/* w-56: o popup é mais largo que o trigger — a âncora ficaria
            apertada pros labels de ação (o default é w-(--anchor-width)) */}
        <DropdownMenuContent align="end" className="w-56">
          {agendar && (
            <DropdownMenuItem
              aria-haspopup="dialog"
              onClick={() => setAberto("agendar")}
            >
              <CalendarPlus aria-hidden /> Agendar encontro
            </DropdownMenuItem>
          )}
          {formulario && (
            <DropdownMenuItem
              aria-haspopup="dialog"
              onClick={() => setAberto("form")}
            >
              <PaperPlaneTilt aria-hidden /> Enviar formulário
            </DropdownMenuItem>
          )}
          {solicitar && (
            <DropdownMenuItem
              aria-haspopup="dialog"
              onClick={() => setAberto("solicitar")}
            >
              <UserPlus aria-hidden /> Solicitar mentor especialista
            </DropdownMenuItem>
          )}
          {sugerir && (
            <DropdownMenuItem
              aria-haspopup="dialog"
              onClick={() => setAberto("sugerir")}
            >
              <Sparkle aria-hidden /> Sugerir especialista pro jovem
            </DropdownMenuItem>
          )}
          {encerrar && (
            <DropdownMenuItem
              aria-haspopup="dialog"
              onClick={() => setAberto("encerrar")}
            >
              <FlagCheckered aria-hidden /> Encerrar trilha
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* os dialogs ficam no nível do botão, controlados — fechar o menu
          não os desmonta e o foco volta pro "Mais" ao sair */}
      {agendar && (
        <AgendarEncontroDialog
          duplaId={duplaId}
          numero={agendar.numero}
          atual={agendar.atual}
          sugerido={agendar.sugerido}
          piso={agendar.piso}
          jovemNome={agendar.jovemNome}
          trigger={null}
          open={aberto === "agendar"}
          onOpenChange={(o) => setAberto(o ? "agendar" : null)}
        />
      )}
      {formulario && (
        <EnviarFormularioDialog
          formularios={formulario.formularios}
          duplaId={duplaId}
          mentor={formulario.mentor}
          mentorado={formulario.mentorado}
          trigger={null}
          open={aberto === "form"}
          onOpenChange={(o) => setAberto(o ? "form" : null)}
        />
      )}
      {solicitar && (
        <SolicitarEspecialistaDialog
          duplaId={duplaId}
          especialistas={solicitar.especialistas}
          trigger={null}
          open={aberto === "solicitar"}
          onOpenChange={(o) => setAberto(o ? "solicitar" : null)}
        />
      )}
      {sugerir && (
        <SugerirEspecialistaDialog
          mentoradoId={sugerir.mentoradoId}
          duplaDppId={duplaId}
          especialistas={sugerir.especialistas}
          nomeJovem={sugerir.nomeJovem}
          trigger={null}
          open={aberto === "sugerir"}
          onOpenChange={(o) => setAberto(o ? "sugerir" : null)}
        />
      )}
      {encerrar && (
        <EncerrarTrilhaDialog
          duplaId={duplaId}
          trigger={null}
          open={aberto === "encerrar"}
          onOpenChange={(o) => setAberto(o ? "encerrar" : null)}
        />
      )}
    </>
  );
}
