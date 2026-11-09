"use client";

// O ⋯ real da linha de dupla (DuplaLinha): um dropdown Base UI com as
// ações que o contexto do caller sustenta. "Ver ficha" é sempre o 1º item
// — a linha inteira já navega pelo link esticado, mas o menu explicita o
// destino pra quem abre procurando ação. Os demais itens só aparecem
// quando os dados do caller dão conta: o catálogo de formulários carrega
// do banco na 1ª abertura (a linha não pagava um fetch por card), e
// remanejar/encerrar leem status e trilha da própria dupla.
//
// O trigger replica o ⋯ decorativo que substitui (outline sm, "Ações" a
// partir do md) e o wrapper no DuplaLinha o põe em z-20, acima do link
// esticado: o clique abre o menu, nunca navega. Os dialogs ficam fora do
// popup, controlados por estado — mesmo padrão do "Mais" da ficha
// (REALIZA-157): fechar o menu não os desmonta e o foco volta pro ⋯.

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  ArrowsLeftRight,
  DotsThree,
  FlagCheckered,
  PaperPlaneTilt,
} from "@phosphor-icons/react";
import { toast } from "sonner";
import type { Dupla } from "@/lib/types";
import { createClient } from "@/lib/supabase/client";
import type { FormularioSistema } from "@/lib/forms/schema";
import {
  EnviarFormularioDialog,
  type FormularioOpcao,
} from "@/components/enviar-formulario-dialog";
import { EncerrarTrilhaDialog } from "@/components/encerrar-trilha-dialog";
import { RemanejarDuplaDialog } from "@/components/remanejar-dupla-dialog";
import { buttonVariants } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

type DialogId = "form" | "remanejar" | "encerrar";

// tamanho e cor explícitos — é o que alinha o texto do item com o da linha
// (mesma norma do ICONE do Mais da ficha)
const ICONE = "size-4 shrink-0 text-muted-foreground";

export function DuplaLinhaMenu({
  dupla,
  fichaHref,
  formulario = false,
  remanejar = false,
  encerrar = false,
}: {
  dupla: Dupla;
  /** destino do "Ver ficha" — o mesmo do link esticado da linha */
  fichaHref: string;
  /** "Enviar formulário" (dupla viva) — o catálogo dos ativos carrega na
   *  1ª abertura do dialog, sem fetch na montagem da linha */
  formulario?: boolean;
  /** "Remanejar dupla" (dupla viva) — a troca de ponta da coordenação */
  remanejar?: boolean;
  /** "Encerrar trilha" — o caller decide (trilha de especialista ainda
   *  aberta); o dialog trava motivo e devolutiva */
  encerrar?: boolean;
}) {
  const router = useRouter();
  const [aberto, setAberto] = useState<DialogId | null>(null);
  const [forms, setForms] = useState<FormularioOpcao[] | null>(null);
  const [carregandoForms, setCarregandoForms] = useState(false);

  // formulário e remanejo são de dupla viva; encerrar trilha já chega
  // decidido (o caller conhece a trilha e o encerrada_em)
  const viva = dupla.status === "ativa" || dupla.status === "pausada";
  const temForm = formulario && viva;
  const temRemanejar = remanejar && viva;

  async function carregarFormularios() {
    setCarregandoForms(true);
    try {
      const { data, error } = await createClient()
        .from("formularios")
        .select("id, titulo, sistema")
        .eq("ativo", true)
        .order("created_at", { ascending: false });
      if (error) {
        toast.error("Não consegui carregar os formulários.");
        return;
      }
      setForms(
        (data ?? []).map((f) => ({
          id: f.id,
          titulo: f.titulo,
          sistema: f.sistema as FormularioSistema | null,
        }))
      );
    } finally {
      setCarregandoForms(false);
    }
  }

  function abrir(id: DialogId) {
    setAberto(id);
    // o catálogo não veio no payload da linha — busca só quando pedem e
    // guarda pras próximas aberturas
    if (id === "form" && forms == null && !carregandoForms) {
      void carregarFormularios();
    }
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          aria-label="Ações da dupla"
          className={cn(
            buttonVariants({ variant: "outline", size: "sm" }),
            "w-11 shrink-0 px-0 text-muted-foreground md:w-auto md:px-2.5"
          )}
        >
          <span className="hidden whitespace-nowrap md:inline">Ações</span>
          <DotsThree weight="bold" aria-hidden />
        </DropdownMenuTrigger>
        {/* w-56: o popup é mais largo que o trigger — a âncora ficaria
            apertada pros labels de ação (mesma norma do Mais da ficha) */}
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuItem onClick={() => router.push(fichaHref)}>
            <ArrowRight aria-hidden className={ICONE} />
            Ver ficha
          </DropdownMenuItem>
          {(temForm || temRemanejar || encerrar) && <DropdownMenuSeparator />}
          {temForm && (
            <DropdownMenuItem
              aria-haspopup="dialog"
              onClick={() => abrir("form")}
            >
              <PaperPlaneTilt aria-hidden className={ICONE} />
              Enviar formulário
            </DropdownMenuItem>
          )}
          {temRemanejar && (
            <DropdownMenuItem
              aria-haspopup="dialog"
              onClick={() => abrir("remanejar")}
            >
              <ArrowsLeftRight aria-hidden className={ICONE} />
              Remanejar dupla
            </DropdownMenuItem>
          )}
          {encerrar && (
            <DropdownMenuItem
              aria-haspopup="dialog"
              onClick={() => abrir("encerrar")}
            >
              <FlagCheckered aria-hidden className={ICONE} />
              Encerrar trilha
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* fora do popup, controlados — fechar o menu não desmonta o dialog
          e o foco volta pro ⋯ ao sair */}
      {temForm && (
        <EnviarFormularioDialog
          formularios={forms ?? []}
          carregando={carregandoForms && forms == null}
          duplaId={dupla.id}
          mentor={{
            id: dupla.mentor.id,
            nome: dupla.mentor.nome_social ?? dupla.mentor.nome,
            whatsapp: dupla.mentor.whatsapp,
          }}
          mentorado={{
            id: dupla.mentorado.id,
            nome: dupla.mentorado.nome_social ?? dupla.mentorado.nome,
            whatsapp: dupla.mentorado.whatsapp,
          }}
          trigger={null}
          open={aberto === "form"}
          onOpenChange={(o) => setAberto(o ? "form" : null)}
        />
      )}
      {temRemanejar && (
        <RemanejarDuplaDialog
          dupla={dupla}
          trigger={null}
          open={aberto === "remanejar"}
          onOpenChange={(o) => setAberto(o ? "remanejar" : null)}
        />
      )}
      {encerrar && (
        <EncerrarTrilhaDialog
          duplaId={dupla.id}
          trigger={null}
          open={aberto === "encerrar"}
          onOpenChange={(o) => setAberto(o ? "encerrar" : null)}
        />
      )}
    </>
  );
}
