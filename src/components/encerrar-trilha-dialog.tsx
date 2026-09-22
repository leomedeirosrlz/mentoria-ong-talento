"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FlagCheckered } from "@phosphor-icons/react";
import { toast } from "sonner";
import { encerrarTrilhaEspecialista } from "@/lib/actions-encerramento";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

/** "Encerrar trilha" — fechamento da mentoria de especialista (guia: até 5
 *  encontros em até 3 meses; o último é encerramento/reflexão/celebração).
 *  Exige motivo e a devolutiva pro PDM — o que a trilha devolve pro plano do
 *  jovem chega ao mentor DPP pela ficha da dupla dele. Especialista dono da
 *  dupla ou coordenação; o RPC trava corrida e escopo. */
export function EncerrarTrilhaDialog({
  duplaId,
  trigger,
}: {
  duplaId: string;
  trigger?: React.ReactElement;
}) {
  const [open, setOpen] = useState(false);
  const [tipo, setTipo] = useState<"concluida" | "encerrada">("concluida");
  const [devolutivaLen, setDevolutivaLen] = useState(0);
  const [pending, start] = useTransition();
  const router = useRouter();

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    start(async () => {
      try {
        const res = await encerrarTrilhaEspecialista(duplaId, fd);
        if (res?.error) {
          toast.error(res.error);
          return;
        }
        toast.success(
          tipo === "concluida"
            ? "Trilha concluída — a devolutiva chegou ao PDM."
            : "Trilha encerrada — a devolutiva chegou ao PDM."
        );
        setOpen(false);
        router.refresh();
      } catch {
        toast.error("Sem conexão — tente de novo.");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          trigger ?? (
            <Button variant="outline" size="sm">
              <FlagCheckered size={15} />
              Encerrar trilha
            </Button>
          )
        }
      />
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Encerrar a trilha de especialista</DialogTitle>
          <DialogDescription>
            Fecha a mentoria especializada e devolve pro PDM o que segue —
            metas alcançadas, encaminhamentos em aberto e recomendações. O
            mentor DPP lê a devolutiva na ficha da dupla dele.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">Decisão</legend>
            <label className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-border px-3 py-2.5 text-sm transition-colors has-checked:border-[var(--ok)]/60 has-checked:bg-[var(--ok)]/5">
              <input
                type="radio"
                name="tipo"
                value="concluida"
                checked={tipo === "concluida"}
                onChange={() => setTipo("concluida")}
                className="mt-0.5 accent-primary"
              />
              <span>
                <span className="font-medium">Concluir a trilha</span>
                <span className="block text-xs text-muted-foreground">
                  Os objetivos foram alcançados — pode ser antes do 5º
                  encontro, como manda o guia.
                </span>
              </span>
            </label>
            <label className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-border px-3 py-2.5 text-sm transition-colors has-checked:border-[var(--warn)]/60 has-checked:bg-[var(--warn)]/5">
              <input
                type="radio"
                name="tipo"
                value="encerrada"
                checked={tipo === "encerrada"}
                onChange={() => setTipo("encerrada")}
                className="mt-0.5 accent-primary"
              />
              <span>
                <span className="font-medium">Encerrar antes de concluir</span>
                <span className="block text-xs text-muted-foreground">
                  A trilha termina sem os objetivos completos — a devolutiva
                  registra o que ficou em aberto.
                </span>
              </span>
            </label>
          </fieldset>

          <div className="space-y-2">
            <Label htmlFor="trilha-motivo">Motivo</Label>
            <Input
              id="trilha-motivo"
              name="motivo"
              required
              minLength={3}
              maxLength={300}
              placeholder="ex.: objetivos alcançados no 4º encontro"
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-baseline justify-between gap-2">
              <Label htmlFor="trilha-devolutiva">Devolutiva pro PDM</Label>
              <span
                aria-hidden
                className="text-xs tabular-nums text-muted-foreground"
              >
                {devolutivaLen}/4.000
              </span>
            </div>
            <Textarea
              id="trilha-devolutiva"
              name="devolutiva_pdm"
              required
              minLength={10}
              maxLength={4000}
              rows={4}
              onChange={(e) => setDevolutivaLen(e.target.value.length)}
              placeholder="Metas alcançadas, o que segue em aberto e recomendações pro plano do jovem"
            />
            <p className="text-xs text-muted-foreground">
              É o que o guia pede no fechamento: o que a trilha devolve pro
              PDM do jovem. O mentor DPP recebe na ficha da dupla dele.
            </p>
          </div>

          <Button type="submit" className="w-full" disabled={pending}>
            {pending
              ? "Registrando…"
              : tipo === "concluida"
                ? "Concluir a trilha"
                : "Encerrar a trilha"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
