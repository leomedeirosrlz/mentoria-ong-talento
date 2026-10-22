"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Sparkle, X } from "@phosphor-icons/react";
import { toast } from "sonner";
import {
  confirmarSugestaoEspecialista,
  dispensarSugestaoEspecialista,
} from "@/lib/actions-jovem";
import { avatarPublicUrl } from "@/lib/avatar";
import type { JovemEspecialista, SolicitacaoEspecialista } from "@/lib/types";
import { Avatar } from "@/components/avatar";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
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

/** Card da sugestão registrada pelo mentor DPP (WP6): a demanda é do jovem —
 *  confirmar vira pedido de verdade ('aberta', entra nos tetos e no mural);
 *  dispensar cancela e some. Antes de confirmar ele pode ajustar tema,
 *  objetivo e o especialista de destino. */
export function SugestaoEspecialistaCard({
  s,
  catalogo,
}: {
  s: SolicitacaoEspecialista;
  catalogo: JovemEspecialista[];
}) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [demanda, setDemanda] = useState(s.demanda ?? "");
  const [objetivo, setObjetivo] = useState(s.motivo ?? "");
  const [esp, setEsp] = useState(s.especialista_desejado_id ?? QUALQUER);
  const router = useRouter();

  const autor = s.solicitante?.nome ?? "Seu mentor";
  const escolhido = catalogo.find((e) => e.id === esp);

  function confirmar() {
    start(async () => {
      try {
        const res = await confirmarSugestaoEspecialista({
          id: s.id,
          especialistaId: esp === QUALQUER ? null : esp,
          demanda,
          objetivo,
        });
        if (res?.error) {
          toast.error(res.error);
          return;
        }
        toast.success("Pedido enviado — o especialista já pode responder.");
        setOpen(false);
        router.refresh();
      } catch {
        toast.error("Sem conexão. Tente de novo.");
      }
    });
  }

  function dispensar() {
    start(async () => {
      try {
        const res = await dispensarSugestaoEspecialista(s.id);
        if (res?.error) {
          toast.error(res.error);
          return;
        }
        toast.success("Sugestão dispensada.");
        router.refresh();
      } catch {
        toast.error("Sem conexão. Tente de novo.");
      }
    });
  }

  return (
    <div className="rounded-xl border border-[var(--role-mentorado)]/40 bg-[var(--role-mentorado)]/10 p-4">
      <div className="flex items-start gap-3">
        <span
          aria-hidden
          className="grid size-9 shrink-0 place-items-center rounded-full bg-[var(--role-mentorado)] text-[var(--brand-ink)]"
        >
          <Sparkle size={18} weight="fill" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">
            {autor} sugeriu um especialista pra você
          </p>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
            {s.demanda}
          </p>
          {s.motivo && (
            <p className="mt-1.5 text-sm leading-relaxed">
              <span className="font-medium">Objetivo:</span> {s.motivo}
            </p>
          )}
          {s.desejado?.nome && (
            <p className="mt-1.5 text-sm">
              <span className="font-medium">Pensando em:</span>{" "}
              {s.desejado.nome}
            </p>
          )}
          <div className="mt-3 flex flex-wrap gap-2">
            <Button size="sm" onClick={() => setOpen(true)} disabled={pending}>
              <Check size={15} aria-hidden />
              Quero seguir
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={dispensar}
              disabled={pending}
            >
              <X size={15} aria-hidden />
              Agora não
            </Button>
          </div>
        </div>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Confirmar pedido de especialista</DialogTitle>
            <DialogDescription>
              A sugestão é do seu mentor, mas a demanda é sua — ajuste o que
              quiser antes de enviar.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="sug-demanda">Tema</Label>
              <Textarea
                id="sug-demanda"
                value={demanda}
                onChange={(e) => setDemanda(e.target.value)}
                minLength={10}
                maxLength={1000}
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sug-objetivo">Objetivo (opcional)</Label>
              <Textarea
                id="sug-objetivo"
                value={objetivo}
                onChange={(e) => setObjetivo(e.target.value)}
                maxLength={500}
                rows={2}
                placeholder="O que você quer destravar com essa trilha?"
              />
            </div>
            <div className="space-y-2">
              <Label id="sug-esp-label">Especialista (opcional)</Label>
              <Select
                value={esp}
                onValueChange={(v) => setEsp(v ?? QUALQUER)}
                items={{
                  [QUALQUER]: "Qualquer especialista disponível",
                  ...Object.fromEntries(
                    catalogo.map((e) => [e.id, e.nome_social || e.nome])
                  ),
                }}
              >
                <SelectTrigger
                  id="sug-esp"
                  aria-labelledby="sug-esp-label sug-esp"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={QUALQUER}>
                    Qualquer especialista disponível
                  </SelectItem>
                  {catalogo.map((e) => (
                    <SelectItem key={e.id} value={e.id}>
                      <span className="flex items-center gap-2">
                        <Avatar
                          nome={e.nome_social || e.nome}
                          src={
                            e.avatar_path ? avatarPublicUrl(e.avatar_path) : null
                          }
                          size={20}
                        />
                        {e.nome_social || e.nome}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {escolhido && (
                <p className="text-xs text-muted-foreground">
                  O pedido vai direto pra {escolhido.nome_social || escolhido.nome}.
                </p>
              )}
            </div>
            <Button
              className="w-full"
              onClick={confirmar}
              disabled={pending || demanda.trim().length < 10}
            >
              {pending ? "Enviando…" : "Enviar pedido"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
