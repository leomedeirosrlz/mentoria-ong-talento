"use client";

import { useState, useTransition } from "react";
import { CircleNotch, EnvelopeSimple } from "@phosphor-icons/react";
import { toast } from "sonner";
import {
  enviarMaterialEmail,
  reenviarComunicadoEmail,
} from "@/lib/actions-email";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

// mesmas audiências dos materiais — cada uma vira um grupo de papéis lá no
// action (ROLES_POR_AUDIENCIA, @/lib/email)
const GRUPOS = [
  { valor: "todos", rotulo: "Todos", detalhe: "coordenação, supervisores e mentores" },
  { valor: "dpp", rotulo: "Mentores DPP", detalhe: "a trilha principal do programa" },
  { valor: "especialista", rotulo: "Mentores especialistas", detalhe: "a trilha temática" },
  { valor: "coordenacao", rotulo: "Coordenação", detalhe: "só a equipe do programa" },
] as const;

/** Toast do resultado real do disparo — total e falhas vêm do resumo que o
 *  action devolve (parciais acontecem: endereço inválido não derruba o lote). */
function toastResultado(r: {
  error?: string;
  enviados?: number;
  destinatarios?: number;
  falhas?: string[];
}) {
  const enviados = r.enviados ?? 0;
  const falhas = r.falhas?.length ?? 0;
  const total = r.destinatarios ?? enviados + falhas;
  if (falhas) {
    toast.warning(
      `E-mail enviado para ${enviados} de ${total} — ${falhas} ${
        falhas === 1 ? "falhou" : "falharam"
      }.`
    );
  } else {
    toast.success(
      `E-mail enviado para ${enviados} ${enviados === 1 ? "pessoa" : "pessoas"}.`
    );
  }
}

/** Envio manual de um material por e-mail — a coordenação escolhe os grupos
 *  (a audiência natural do material já vem marcada, mas dá pra alcançar
 *  outra trilha ou reenviar pra quem entrou depois). */
export function EnviarEmailDialog({
  materialId,
  tituloMaterial,
  audienciaPadrao,
  open,
  onOpenChange,
}: {
  materialId: string;
  tituloMaterial: string;
  audienciaPadrao: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [pending, start] = useTransition();
  // remarcar a audiência natural a cada abertura — não dá pra usar
  // defaultChecked num dialog que sobrevive entre materiais/aberturas
  const [selecionados, setSelecionados] = useState<string[]>([]);

  function onToggle(valor: string, marcado: boolean) {
    setSelecionados((atual) =>
      marcado ? [...atual, valor] : atual.filter((v) => v !== valor)
    );
  }

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    fd.set("material_id", materialId);
    start(async () => {
      try {
        const r = await enviarMaterialEmail(fd);
        if (r.error) {
          toast.error(r.error);
          return;
        }
        toastResultado(r);
        onOpenChange(false);
      } catch {
        toast.error("Sem conexão. Tente de novo.");
      }
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (v) setSelecionados([audienciaPadrao]);
        onOpenChange(v);
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Enviar material por e-mail</DialogTitle>
          <DialogDescription>
            “{tituloMaterial}” vai para os e-mails cadastrados dos grupos
            marcados.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <fieldset className="space-y-1.5">
            <legend className="text-sm font-medium leading-none select-none">
              Quem recebe
            </legend>
            <div className="grid gap-1.5">
              {GRUPOS.map((g) => (
                <label
                  key={g.valor}
                  className="flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2.5 transition-colors hover:bg-muted has-checked:border-foreground/40 has-checked:bg-muted has-focus-visible:ring-2 has-focus-visible:ring-ring has-focus-visible:ring-offset-2 has-focus-visible:ring-offset-background"
                >
                  <input
                    type="checkbox"
                    name="audiencia"
                    value={g.valor}
                    checked={selecionados.includes(g.valor)}
                    onChange={(e) => onToggle(g.valor, e.target.checked)}
                    className="size-4 shrink-0 accent-foreground"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium">{g.rotulo}</span>
                    <span className="block text-xs text-muted-foreground">
                      {g.detalhe}
                    </span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
          <DialogFooter>
            <Button type="submit" disabled={pending || !selecionados.length}>
              {pending ? "Enviando…" : "Enviar e-mail"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Reenvio manual do e-mail de um aviso — a publicação já dispara pro
 *  destinatários; isso cobre quem entrou depois ou perdeu o primeiro envio. */
export function ReenviarComunicadoEmailButton({
  comunicadoId,
}: {
  comunicadoId: string;
}) {
  const [pending, start] = useTransition();
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className="text-muted-foreground"
      disabled={pending}
      aria-busy={pending}
      onClick={() =>
        start(async () => {
          try {
            const fd = new FormData();
            fd.set("comunicado_id", comunicadoId);
            const r = await reenviarComunicadoEmail(fd);
            if (r.error) toast.error(r.error);
            else toastResultado(r);
          } catch {
            toast.error("Sem conexão. Tente de novo.");
          }
        })
      }
    >
      {pending ? (
        <CircleNotch size={14} className="animate-spin" />
      ) : (
        <EnvelopeSimple size={14} />
      )}
      Reenviar por e-mail
    </Button>
  );
}
