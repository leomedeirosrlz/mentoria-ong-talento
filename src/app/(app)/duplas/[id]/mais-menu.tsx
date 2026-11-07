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
  ArrowsLeftRight,
  DotsThree,
  FlagCheckered,
  PaperPlaneTilt,
  Sparkle,
  UserPlus,
} from "@phosphor-icons/react";
import type { Dupla } from "@/lib/types";
import {
  EnviarFormularioDialog,
  type FormularioOpcao,
  type PessoaDestino,
} from "@/components/enviar-formulario-dialog";
import { SolicitarEspecialistaDialog } from "@/components/solicitar-especialista-dialog";
import { SugerirEspecialistaDialog } from "@/components/sugerir-especialista-dialog";
import { EncerrarTrilhaDialog } from "@/components/encerrar-trilha-dialog";
import { RemanejarDuplaDialog } from "@/components/remanejar-dupla-dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type DialogId = "form" | "solicitar" | "sugerir" | "encerrar" | "remanejar";

// ícones do Mais: tamanho e cor explícitos — é o que alinha o texto do item
// com o da linha (REALIZA-157); sem o size-4 o svg herdava o tamanho do texto
const ICONE = "size-4 shrink-0 text-muted-foreground";

type EspecialistaOpcao = {
  id: string;
  nome: string;
  nome_social?: string | null;
  areas: string[] | null;
};

export function DuplaMaisMenu({
  duplaId,
  formulario,
  solicitar,
  sugerir,
  solicitarEstado,
  sugerirEstado,
  encerrar,
  remanejar,
}: {
  duplaId: string;
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
  /** Quando "Solicitar" não vale agora (já há pedido em andamento), o
   *  lugar do botão diz por quê — desabilitado, no mesmo ponto: as duas
   *  duplas do mentor mostram os mesmos botões (feedback da mentora). */
  solicitarEstado?: string | null;
  /** Idem pro "Sugerir" com a sugestão já enviada esperando o jovem. */
  sugerirEstado?: string | null;
  /** "Encerrar trilha" — fechamento da trilha especialista aberta. */
  encerrar?: boolean;
  /** "Remanejar" — troca um lado da dupla viva (coordenação). */
  remanejar?: Dupla | null;
}) {
  const [aberto, setAberto] = useState<DialogId | null>(null);

  // uma lista só alimenta as duas apresentações: em linha a partir do sm
  // (o cabeçalho tem espaço e a ação fica à vista, sem caçar no Mais) e o
  // menu no celular, onde a linha de botões quebraria em três andares
  const itens = [
    formulario && { id: "form", Icone: PaperPlaneTilt, rotulo: "Enviar formulário" },
    solicitar
      ? { id: "solicitar", Icone: UserPlus, rotulo: "Solicitar mentor especialista" }
      : solicitarEstado
        ? { id: "solicitar", Icone: UserPlus, rotulo: solicitarEstado, desabilitado: true }
        : null,
    sugerir
      ? { id: "sugerir", Icone: Sparkle, rotulo: "Sugerir especialista pro jovem" }
      : sugerirEstado
        ? { id: "sugerir", Icone: Sparkle, rotulo: sugerirEstado, desabilitado: true }
        : null,
    remanejar && { id: "remanejar", Icone: ArrowsLeftRight, rotulo: "Remanejar dupla" },
    encerrar && { id: "encerrar", Icone: FlagCheckered, rotulo: "Encerrar trilha" },
  ].filter(Boolean) as {
    id: DialogId;
    Icone: typeof UserPlus;
    rotulo: string;
    desabilitado?: boolean;
  }[];
  if (itens.length === 0) return null;

  return (
    <>
      {itens.map(({ id, Icone, rotulo, desabilitado }) => (
        <Button
          key={id}
          variant="outline"
          size="sm"
          className="hidden sm:inline-flex"
          aria-haspopup={desabilitado ? undefined : "dialog"}
          disabled={desabilitado}
          onClick={() => setAberto(id)}
        >
          <Icone aria-hidden />
          {rotulo}
        </Button>
      ))}
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              variant="outline"
              size="sm"
              className="sm:hidden"
              aria-label="Mais ações da dupla"
            >
              <DotsThree weight="bold" aria-hidden className="size-4" />
              Mais
            </Button>
          }
        />
        {/* w-56: o popup é mais largo que o trigger — a âncora ficaria
            apertada pros labels de ação (o default é w-(--anchor-width)) */}
        <DropdownMenuContent align="end" className="w-56">
          {itens.map(({ id, Icone, rotulo, desabilitado }) => (
            <DropdownMenuItem
              key={id}
              aria-haspopup={desabilitado ? undefined : "dialog"}
              disabled={desabilitado}
              onClick={() => setAberto(id)}
            >
              <Icone aria-hidden className={ICONE} />
              {rotulo}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {remanejar && (
        <RemanejarDuplaDialog
          dupla={remanejar}
          trigger={null}
          open={aberto === "remanejar"}
          onOpenChange={(o) => setAberto(o ? "remanejar" : null)}
        />
      )}

      {/* os dialogs ficam no nível do botão, controlados — fechar o menu
          não os desmonta e o foco volta pro "Mais" ao sair */}
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
