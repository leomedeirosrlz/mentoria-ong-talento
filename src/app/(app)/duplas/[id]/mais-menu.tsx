"use client";

// Ações secundárias + overflow "⋯" do header da ficha (REALIZA-157,
// revisto na onda 1125b): a primária mora fora, até duas ações de rotina
// ficam visíveis aqui e o resto entra no menu — rotina antes, gestão depois
// do separador. Cada item continua sendo só o gatilho controlado do dialog
// certo. A composição anterior (Dialog.Trigger render={Menu.Item}) era o
// defeito: o item híbrido não preenchia a largura do popup e obrigava o
// Portal keepMounted hand-rolled pra não desmontar o dialog junto do menu.
// Com os dialogs fora do popup o menu volta ao DropdownMenuContent padrão —
// fill, setas e devolução de foco vêm de graça do Menu.
//
// Cada prop-grupo presente = uma ação + o dialog dela, sempre montado (fecha
// com animação e abre limpo — os dialogs resetam na borda de subida do
// `open`, mesmo padrão do RemanejarDuplaDialog). Sem ação nenhuma, some.
// Estado de pedido de especialista NÃO entra aqui como item desabilitado:
// ele mora num lugar só, o card "Pedidos em aberto" (review #9).

import { useState } from "react";
import {
  ArrowsLeftRight,
  CalendarBlank,
  CalendarPlus,
  DotsThree,
  FlagCheckered,
  HandHeart,
  PaperPlaneTilt,
  PencilSimple,
  Sparkle,
  UserPlus,
} from "@phosphor-icons/react";
import type { Dupla, Encontro, JovemEspecialista } from "@/lib/types";
import {
  EnviarFormularioDialog,
  type FormularioOpcao,
  type PessoaDestino,
} from "@/components/enviar-formulario-dialog";
import { AgendarEncontroDialog } from "@/components/agendar-encontro-dialog";
import { EditarDuplaDialog } from "@/components/editar-dupla-dialog";
import { PedirApoioDialog } from "@/components/pedir-apoio-dialog";
import { SolicitarEspecialistaDialog } from "@/components/solicitar-especialista-dialog";
import { SugerirEspecialistaDialog } from "@/components/sugerir-especialista-dialog";
import { EncerrarTrilhaDialog } from "@/components/encerrar-trilha-dialog";
import { RemanejarDuplaDialog } from "@/components/remanejar-dupla-dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type DialogId =
  | "agendar"
  | "remarcar"
  | "apoio"
  | "form"
  | "solicitar"
  | "sugerir"
  | "editar"
  | "encerrar"
  | "remanejar";

/** Ações de rotina que podem sair do menu e ficar visíveis na barra. */
export type AcaoSecundariaDupla =
  | "agendar"
  | "remarcar"
  | "apoio"
  | "form"
  | "solicitar"
  | "sugerir";

// ícones do Mais: tamanho e cor explícitos — é o que alinha o texto do item
// com o da linha (REALIZA-157); sem o size-4 o svg herdava o tamanho do texto
const ICONE = "size-4 shrink-0 text-muted-foreground";

// a seleção de especialista dos dialogs é por cards do catálogo rico (023)
type EspecialistaOpcao = JovemEspecialista;

export function DuplaMaisMenu({
  duplaId,
  agendar,
  remarcar,
  pedirApoio,
  formulario,
  solicitar,
  sugerir,
  editar,
  encerrar,
  remanejar,
  secundarias = [],
  primarioPresente = true,
}: {
  duplaId: string;
  /** "Agendar Nº encontro" — ação de primeira classe quando a primária já
   *  é o registrar (REALIZA-97); no ⋯ ela continua a um clique. */
  agendar?: {
    numero: number;
    atual: Encontro | null;
    sugerido?: string;
    piso?: string;
    jovemNome?: string;
    item: string;
  } | null;
  /** "Remarcar Nº · data" (DPP) ou "Remarcar sessão" (trilha esp) — mesma
   *  dialog de agendar, já com a row atual. */
  remarcar?: {
    numero: number;
    atual: Encontro;
    piso?: string;
    jovemNome?: string;
    /** Como a sessão aparece no título/toasts da dialog ("sessão de
     *  especialista"); ausente no DPP. */
    rotulo?: string;
    item: string;
  } | null;
  /** "Pedir apoio" — o chamado do mentor com a dupla já fixada. */
  pedirApoio?: boolean;
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
  /** "Editar dupla" — cadastro da dupla (coordenação). */
  editar?: Dupla | null;
  /** "Encerrar trilha" — fechamento da trilha especialista aberta. */
  encerrar?: boolean;
  /** "Remanejar" — troca um lado da dupla viva (coordenação). */
  remanejar?: Dupla | null;
  /** Até duas ações de rotina visíveis antes do ⋯, na ordem recebida. */
  secundarias?: readonly AcaoSecundariaDupla[];
  /** Sem primária no cabeçalho, a primeira secundária assume o peso visual
   *  de decisão pra barra não virar um ⋯ solto. */
  primarioPresente?: boolean;
}) {
  const [aberto, setAberto] = useState<DialogId | null>(null);

  const acoes = [
    agendar && {
      id: "agendar",
      Icone: CalendarPlus,
      rotulo: agendar.item,
      grupo: "rotina",
    },
    remarcar && {
      id: "remarcar",
      Icone: CalendarBlank,
      rotulo: remarcar.item,
      grupo: "rotina",
    },
    pedirApoio && {
      id: "apoio",
      Icone: HandHeart,
      rotulo: "Pedir apoio",
      grupo: "rotina",
    },
    formulario && {
      id: "form",
      Icone: PaperPlaneTilt,
      rotulo: "Enviar formulário",
      grupo: "rotina",
    },
    solicitar && {
      id: "solicitar",
      Icone: UserPlus,
      rotulo: "Solicitar mentor especialista",
      grupo: "rotina",
    },
    sugerir && {
      id: "sugerir",
      Icone: Sparkle,
      rotulo: "Sugerir especialista pro jovem",
      grupo: "rotina",
    },
    editar && {
      id: "editar",
      Icone: PencilSimple,
      rotulo: "Editar dupla",
      grupo: "gestao",
    },
    remanejar && {
      id: "remanejar",
      Icone: ArrowsLeftRight,
      rotulo: "Remanejar dupla",
      grupo: "gestao",
    },
    encerrar && {
      id: "encerrar",
      Icone: FlagCheckered,
      rotulo: "Encerrar trilha",
      grupo: "gestao",
    },
  ].filter(Boolean) as {
    id: DialogId;
    Icone: typeof UserPlus;
    rotulo: string;
    grupo: "rotina" | "gestao";
  }[];
  const porId = new Map(acoes.map((a) => [a.id, a]));
  const visiveis = secundarias
    .map((id) => porId.get(id))
    .filter((a): a is NonNullable<typeof a> => a != null)
    .slice(0, 2);
  const idsVisiveis = new Set(visiveis.map((a) => a.id));
  const noMenu = acoes.filter((a) => !idsVisiveis.has(a.id));
  const rotina = noMenu.filter((a) => a.grupo === "rotina");
  const gestao = noMenu.filter((a) => a.grupo === "gestao");
  const temMenu = rotina.length + gestao.length > 0;
  if (visiveis.length === 0 && !temMenu) return null;

  const itemMenu = ({ id, Icone, rotulo }: (typeof acoes)[number]) => (
    <DropdownMenuItem
      key={id}
      aria-haspopup="dialog"
      onClick={() => setAberto(id)}
    >
      <Icone aria-hidden className={ICONE} />
      {rotulo}
    </DropdownMenuItem>
  );

  return (
    <>
      {visiveis.map(({ id, Icone, rotulo }, i) => (
        <Button
          key={id}
          type="button"
          variant={!primarioPresente && i === 0 ? "default" : "outline"}
          size="sm"
          aria-haspopup="dialog"
          onClick={() => setAberto(id)}
        >
          <Icone aria-hidden />
          {rotulo}
        </Button>
      ))}
      {temMenu && (
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button variant="outline" size="sm" aria-label="Mais ações da dupla">
                <DotsThree weight="bold" aria-hidden className="size-4" />
                Mais
              </Button>
            }
          />
          {/* w-56: o popup é mais largo que o trigger — a âncora ficaria
              apertada pros labels de ação (o default é w-(--anchor-width)) */}
          <DropdownMenuContent align="end" className="w-56">
            {rotina.map(itemMenu)}
            {rotina.length > 0 && gestao.length > 0 && <DropdownMenuSeparator />}
            {gestao.map(itemMenu)}
          </DropdownMenuContent>
        </DropdownMenu>
      )}

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
      {remarcar && (
        <AgendarEncontroDialog
          duplaId={duplaId}
          numero={remarcar.numero}
          atual={remarcar.atual}
          piso={remarcar.piso}
          jovemNome={remarcar.jovemNome}
          rotulo={remarcar.rotulo}
          trigger={null}
          open={aberto === "remarcar"}
          onOpenChange={(o) => setAberto(o ? "remarcar" : null)}
        />
      )}
      {pedirApoio && (
        <PedirApoioDialog
          duplaId={duplaId}
          trigger={null}
          open={aberto === "apoio"}
          onOpenChange={(o) => setAberto(o ? "apoio" : null)}
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
      {editar && (
        <EditarDuplaDialog
          dupla={editar}
          trigger={null}
          open={aberto === "editar"}
          onOpenChange={(o) => setAberto(o ? "editar" : null)}
        />
      )}
      {remanejar && (
        <RemanejarDuplaDialog
          dupla={remanejar}
          trigger={null}
          open={aberto === "remanejar"}
          onOpenChange={(o) => setAberto(o ? "remanejar" : null)}
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
