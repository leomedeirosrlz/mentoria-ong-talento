"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { updateCapacidadeMentor } from "@/lib/actions";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/** Ajuste fino da capacidade do mentor (REALIZA-116) — um campo só,
 *  aberto pelo "aumentar capacidade →" de onde o par certo apareceu cheio
 *  (sugestão de remanejo, NovaDuplaDialog, board de matching) ou pelo
 *  "ajustar" da ficha/lista. O mínimo é o que a pessoa já cuida em
 *  andamento (ativas + pausadas, a régua do trigger 0025/0073): abaixo
 *  disso o X/Y ficaria invertido e o "sem vaga" continuaria valendo. */
export function CapacidadeMentorDialog({
  mentorId,
  nome,
  atual,
  emUso,
  trilha,
  trigger,
  onSaved,
}: {
  mentorId: string;
  nome: string;
  /** Teto atual da pool da trilha (capacidade ou capacidade_especialista). */
  atual: number;
  /** Duplas em andamento (ativa + pausada) — piso do ajuste. */
  emUso: number;
  /** Pool ajustada (WP6b): sem ela o server escreve a da trilha do papel
   *  primário — o híbrido tem as duas e precisa escolher qual. */
  trilha?: "dpp" | "especialista";
  trigger: React.ReactElement;
  /** Callback pro pai atualizar estado local (ex.: o mapa de capacidade
   *  do NovaDuplaDialog) sem depender só do refresh. */
  onSaved?: (capacidade: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const [cap, setCap] = useState(atual);
  const [erro, setErro] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();
  const minimo = Math.max(1, emUso);
  const primeiro = nome.split(" ")[0];

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErro(null);
    start(async () => {
      try {
        const res = await updateCapacidadeMentor(mentorId, cap, trilha);
        if (res?.error) {
          setErro(res.error);
          return;
        }
        toast.success(
          `Capacidade de ${primeiro} agora é ${cap} ${cap === 1 ? "dupla" : "duplas"}.`
        );
        onSaved?.(cap);
        setOpen(false);
        router.refresh();
      } catch {
        setErro("Sem conexão. Tente de novo.");
      }
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) {
          // estado fresco por abertura — a prop pode ter mudado desde a
          // última vez (a ficha re-renderizou com a capacidade nova)
          setCap(atual);
          setErro(null);
        }
      }}
    >
      <DialogTrigger render={trigger} />
      {/* sm explícito — o default md da base é largo demais pra 1 campo */}
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle>Capacidade de {primeiro}</DialogTitle>
          <DialogDescription>
            Quantas duplas {primeiro} pode cuidar ao mesmo tempo. Ativas e
            pausadas contam: pausada volta a andar e segura a vaga.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="cap-mentor">Duplas simultâneas</Label>
            <Input
              id="cap-mentor"
              type="number"
              min={minimo}
              max={10}
              required
              value={cap}
              onChange={(e) => setCap(Number(e.target.value))}
            />
            <p className="text-xs text-muted-foreground">
              {emUso > 0
                ? `Cuida de ${emUso} ${emUso === 1 ? "dupla" : "duplas"} em andamento. O mínimo é ${minimo}.`
                : "Sem dupla em andamento: qualquer valor a partir de 1."}
            </p>
          </div>
          {erro && (
            <p
              role="alert"
              className="rounded-lg border border-[var(--danger)]/40 bg-[var(--danger)]/5 px-3.5 py-3 text-sm"
            >
              {erro}
            </p>
          )}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={pending || cap < minimo}>
              {pending ? "Salvando…" : "Salvar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
