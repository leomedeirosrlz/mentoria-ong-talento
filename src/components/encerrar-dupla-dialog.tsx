"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FlagCheckered } from "@phosphor-icons/react";
import { toast } from "sonner";
import { registrarEncerramento } from "@/lib/actions-encerramento";
import { CHECKLIST_ENCERRAMENTO } from "@/lib/encerramento";
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
import type { Encerramento } from "@/lib/types";

/** Dialog "Registrar encerramento" — o rito de fechamento da dupla DPP (guia:
 *  feedback final/mútuo, revisão do PDM, avaliação 360) e a decisão: a jornada
 *  foi percorrida até o fim (concluída) ou terminou antes (encerrada). */
export function EncerrarDuplaDialog({
  duplaId,
  encerramento,
  trigger,
  somenteConclusao = false,
}: {
  duplaId: string;
  /** Row atual (pode existir pendente desde o último encontro, 0102). */
  encerramento: Encerramento | null;
  trigger?: React.ReactElement;
  /** Dupla já 'concluida' pelo fechamento automático (0102) — o rito que
   *  falta é só a conclusão; "encerrar antes do fim" deixaria de fazer
   *  sentido (a jornada já terminou) */
  somenteConclusao?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [tipo, setTipo] = useState<"concluida" | "encerrada">("concluida");
  const [pending, start] = useTransition();
  const router = useRouter();

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    start(async () => {
      try {
        const res = await registrarEncerramento(duplaId, fd);
        if (res?.error) {
          toast.error(res.error);
          return;
        }
        toast.success(
          tipo === "concluida"
            ? "Jornada concluída. Encerramento registrado."
            : "Dupla encerrada. Encerramento registrado."
        );
        setOpen(false);
        router.refresh();
      } catch {
        toast.error("Sem conexão. Tente de novo.");
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
              Registrar encerramento
            </Button>
          )
        }
      />
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>Registrar encerramento</DialogTitle>
          <DialogDescription>
            {somenteConclusao
              ? "O último encontro já aconteceu e a dupla concluiu a jornada. Complete o checklist do rito pra registrar o encerramento."
              : "O fechamento do ciclo do guia: o que foi feito, a decisão da coordenação e o resumo da jornada, gerado na hora pra base do relatório final."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">
              Checklist do fechamento
            </legend>
            {CHECKLIST_ENCERRAMENTO.map((item) => (
              <label
                key={item.key}
                className="flex cursor-pointer items-start gap-2.5 rounded-lg bg-muted/40 px-3 py-2.5 text-sm transition-colors hover:bg-muted/70"
              >
                <input
                  type="checkbox"
                  name={item.key}
                  // o que já chegou volta marcado — uma resposta 360º que
                  // entrou pela RPC não pode sumir num resave silencioso
                  defaultChecked={!!encerramento?.checklist?.[item.key]}
                  className="mt-0.5 accent-primary"
                />
                {item.label}
              </label>
            ))}
          </fieldset>

          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">Decisão</legend>
            <label
              className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-border px-3 py-2.5 text-sm transition-colors has-checked:border-[var(--ok)]/60 has-checked:bg-[var(--ok)]/5"
            >
              <input
                type="radio"
                name="tipo"
                value="concluida"
                checked={tipo === "concluida"}
                onChange={() => setTipo("concluida")}
                className="mt-0.5 accent-primary"
              />
              <span>
                <span className="font-medium">Concluir a jornada</span>
                <span className="block text-xs text-muted-foreground">
                  A dupla percorreu o ciclo até o encontro de encerramento.
                  Checklist completo obrigatório.
                </span>
              </span>
            </label>
            {!somenteConclusao && (
              <label
                className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-border px-3 py-2.5 text-sm transition-colors has-checked:border-[var(--warn)]/60 has-checked:bg-[var(--warn)]/5"
              >
                <input
                  type="radio"
                  name="tipo"
                  value="encerrada"
                  checked={tipo === "encerrada"}
                  onChange={() => setTipo("encerrada")}
                  className="mt-0.5 accent-primary"
                />
                <span>
                  <span className="font-medium">Encerrar antes do fim</span>
                  <span className="block text-xs text-muted-foreground">
                    A jornada termina antecipada. O que ficou marcado no
                    checklist entra no registro.
                  </span>
                </span>
              </label>
            )}
          </fieldset>

          <DialogFooter sticky>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={pending}>
              {pending
                ? "Registrando…"
                : tipo === "concluida"
                  ? "Concluir a jornada"
                  : "Encerrar a dupla"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
