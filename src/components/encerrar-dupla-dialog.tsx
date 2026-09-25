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
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import type { Encerramento } from "@/lib/types";

/** Dialog "Registrar encerramento" — o rito de fechamento da dupla DPP (guia:
 *  feedback final/mútuo, revisão do PDM, avaliação 360, autoavaliação do
 *  mentor) e a decisão: a jornada foi percorrida até o fim (concluída) ou
 *  terminou antes (encerrada). A autoavaliação não é checkbox manual — deriva
 *  do texto que o mentor já enviou pela ficha. */
export function EncerrarDuplaDialog({
  duplaId,
  encerramento,
  trigger,
}: {
  duplaId: string;
  /** Row atual (pode existir só com a autoavaliação do mentor). */
  encerramento: Encerramento | null;
  trigger?: React.ReactElement;
}) {
  const [open, setOpen] = useState(false);
  const [tipo, setTipo] = useState<"concluida" | "encerrada">("concluida");
  const [pending, start] = useTransition();
  const router = useRouter();

  const autoavaliacaoRecebida = !!encerramento?.autoavaliacao_mentor;

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
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Registrar encerramento</DialogTitle>
          <DialogDescription>
            O fechamento do ciclo do guia: o que foi feito, a decisão da
            coordenação e o resumo da jornada, gerado na hora pra base do
            relatório final.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">
              Checklist do fechamento
            </legend>
            {CHECKLIST_ENCERRAMENTO.map((item) =>
              item.derivado ? (
                // derivado dos dados — não vira checkbox: a autoavaliação é
                // texto do mentor, não um clique da coordenação
                <p
                  key={item.key}
                  className="flex items-start gap-2.5 rounded-lg bg-muted/40 px-3 py-2.5 text-sm text-muted-foreground"
                >
                  <input
                    type="checkbox"
                    checked={autoavaliacaoRecebida}
                    readOnly
                    disabled
                    aria-hidden
                    tabIndex={-1}
                    className="mt-0.5 accent-primary"
                  />
                  <span>
                    {item.label}
                    {autoavaliacaoRecebida
                      ? " · já está aqui embaixo"
                      : " · ainda não chegou"}
                  </span>
                </p>
              ) : (
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
              )
            )}
            {autoavaliacaoRecebida && (
              <blockquote className="rounded-lg border-l-2 border-[var(--brand-lime)] bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                <p className="mb-1 font-medium text-foreground">
                  Autoavaliação do mentor
                </p>
                <p className="whitespace-pre-line line-clamp-4">
                  {encerramento!.autoavaliacao_mentor}
                </p>
                <p className="mt-1">
                  {encerramento!.disponivel_proximo_ciclo
                    ? "Disponível pro próximo ciclo."
                    : "Não segue no próximo ciclo."}
                </p>
              </blockquote>
            )}
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
          </fieldset>

          <Button type="submit" className="w-full" disabled={pending}>
            {pending
              ? "Registrando…"
              : tipo === "concluida"
                ? "Concluir a jornada"
                : "Encerrar a dupla"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
