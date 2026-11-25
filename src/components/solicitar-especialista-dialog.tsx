"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Collapsible } from "@base-ui/react/collapsible";
import { UserPlus } from "@phosphor-icons/react";
import { toast } from "@/lib/toast";
import { criarSolicitacao } from "@/lib/actions-especialista";
import { EspecialistaSeletor } from "@/components/especialista-seletor";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { JovemEspecialista } from "@/lib/types";

const QUALQUER = "qualquer";

/** Botão + dialog "Solicitar mentor especialista" — fica na ficha da dupla
 *  DPP. A demanda é o briefing pro especialista decidir aceitar; o select
 *  direciona pra uma pessoa específica ou deixa aberto pra qualquer um. */
export function SolicitarEspecialistaDialog({
  duplaId,
  especialistas,
  trigger,
  open: openProp,
  onOpenChange: onOpenChangeProp,
}: {
  duplaId: string;
  // catálogo rico (especialistas_catalogo, 0239) — a escolha é por cards
  especialistas: JovemEspecialista[];
  /** Elemento do trigger — default é o botão padrão da casa. `null` suprime:
   *  o menu "Mais" da ficha abre o dialog controlado (REALIZA-157). */
  trigger?: React.ReactElement | null;
  /** Modo controlado (opcional): o pai segura o estado. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const [openInt, setOpenInt] = useState(false);
  const open = openProp ?? openInt;
  const setOpen = onOpenChangeProp ?? setOpenInt;
  const [pending, start] = useTransition();
  const [demandaLen, setDemandaLen] = useState(0);
  const [esp, setEsp] = useState(QUALQUER);
  // 526: pool aberto → o campo respondido cede pra dar área útil à lista;
  // nunca cede com a demanda vazia (obrigatório escondido não se explica)
  const [poolAberto, setPoolAberto] = useState(false);
  const topoCede = poolAberto && demandaLen >= 10;
  const router = useRouter();

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    fd.set("dupla_dpp_id", duplaId);
    // o select usa a sentinela "qualquer" (item não pode ter value vazio)
    fd.set("especialista_desejado_id", esp === QUALQUER ? "" : esp);
    start(async () => {
      try {
        const res = await criarSolicitacao(fd);
        if (res?.error) {
          toast.error(res.error);
          return;
        }
        toast.success("Solicitação enviada aos especialistas.");
        setOpen(false);
        router.refresh();
      } catch {
        toast.error("Sem conexão. Tente de novo.");
      }
    });
  }

  // estado fresco por abertura — ajuste na borda de subida do `open`: no
  // modo controlado a abertura vem da prop e o Base UI não reemite
  // onOpenChange (mesmo padrão do RemanejarDuplaDialog)
  const [abertoAntes, setAbertoAntes] = useState(open);
  if (open !== abertoAntes) {
    setAbertoAntes(open);
    if (open) {
      setDemandaLen(0);
      setEsp(QUALQUER);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger !== null && (
        <DialogTrigger
          render={
            trigger ?? (
              <Button variant="outline" size="sm">
                <UserPlus size={16} />
                Solicitar mentor especialista
              </Button>
            )
          }
        />
      )}
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>Solicitar mentor especialista</DialogTitle>
          <DialogDescription>
            O pedido aparece na lista dos especialistas. Quem aceitar vira uma
            dupla de até 5 encontros com o jovem.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          {/* topo cedendo (526): keepMounted segura o FormData do textarea
              não-controlado enquanto o campo recolhe */}
          <Collapsible.Root open={!topoCede}>
            <Collapsible.Panel
              keepMounted
              className="h-[var(--collapsible-panel-height)] overflow-hidden transition-[height] duration-150 data-ending-style:h-0 data-starting-style:h-0 [&[hidden]:not([hidden='until-found'])]:hidden"
            >
              <div className="space-y-2">
                <div className="flex items-baseline justify-between gap-2">
                  <Label htmlFor="demanda">Contexto</Label>
                  <span
                    aria-hidden
                    className="text-xs tabular-nums text-muted-foreground"
                  >
                    {demandaLen}/1.000
                  </span>
                </div>
                <Textarea
                  id="demanda"
                  name="demanda"
                  required
                  minLength={10}
                  maxLength={1000}
                  rows={4}
                  onChange={(e) => setDemandaLen(e.target.value.length)}
                  placeholder="ex.: o jovem precisa de inglês pra entrevista de emprego"
                />
                <p className="text-xs text-muted-foreground">
                  O especialista lê esse contexto pra decidir se aceita.
                  Mínimo de 10 caracteres.
                </p>
              </div>
            </Collapsible.Panel>
          </Collapsible.Root>
          <EspecialistaSeletor
            idBase="especialista-seletor"
            label="Direcionar a um especialista específico (opcional)"
            rotuloQualquer="Qualquer especialista disponível"
            descricaoQualquer="O pedido aparece na lista de todos os especialistas."
            catalogo={especialistas}
            selecionado={esp === QUALQUER ? null : esp}
            onSelecionar={(id) => setEsp(id ?? QUALQUER)}
            linkPerfil={(e) => `/pessoas/${e.id}`}
            onAbertoChange={setPoolAberto}
          />
          <DialogFooter sticky>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Enviando…" : "Enviar solicitação"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
