"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { UserPlus } from "@phosphor-icons/react";
import { toast } from "sonner";
import { criarSolicitacao } from "@/lib/actions-especialista";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const QUALQUER = "qualquer";

/** "Ana Souza — finanças, carreira": as áreas (0030) ajudam a escolher pra
 *  quem direcionar — sem áreas cadastradas fica só o nome. */
function rotuloEspecialista(e: { nome: string; areas: string[] | null }) {
  return e.areas?.length ? `${e.nome} — ${e.areas.join(", ")}` : e.nome;
}

/** Botão + dialog "Solicitar mentor especialista" — fica na ficha da dupla
 *  DPP. A demanda é o briefing pro especialista decidir aceitar; o select
 *  direciona pra uma pessoa específica ou deixa aberto pra qualquer um. */
export function SolicitarEspecialistaDialog({
  duplaId,
  especialistas,
  trigger,
}: {
  duplaId: string;
  especialistas: { id: string; nome: string; areas: string[] | null }[];
  /** Elemento do trigger — default é o botão padrão da casa. */
  trigger?: React.ReactElement;
}) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [demandaLen, setDemandaLen] = useState(0);
  const [esp, setEsp] = useState(QUALQUER);
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
        toast.error("Sem conexão — tente de novo.");
      }
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) {
          setDemandaLen(0);
          setEsp(QUALQUER);
        }
      }}
    >
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
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Solicitar mentor especialista</DialogTitle>
          <DialogDescription>
            O pedido aparece na lista dos especialistas — quem aceitar vira uma
            dupla de até 5 encontros com o jovem.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
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
              Descreva a necessidade do jovem — ex.: inglês pra entrevista,
              finanças pessoais, decisão de carreira. Mínimo de 10 caracteres.
            </p>
          </div>
          <div className="space-y-2">
            <Label id="especialista-label">
              Direcionar a um especialista específico (opcional)
            </Label>
            <Select
              value={esp}
              onValueChange={(v) => setEsp(v ?? QUALQUER)}
              items={{
                [QUALQUER]: "Qualquer especialista disponível",
                ...Object.fromEntries(
                  especialistas.map((e) => [e.id, rotuloEspecialista(e)])
                ),
              }}
            >
              <SelectTrigger
                id="especialista-select"
                aria-labelledby="especialista-label especialista-select"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={QUALQUER}>
                  Qualquer especialista disponível
                </SelectItem>
                {especialistas.map((e) => (
                  <SelectItem key={e.id} value={e.id}>
                    {rotuloEspecialista(e)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? "Enviando…" : "Enviar solicitação"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
