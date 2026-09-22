"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { PencilSimple } from "@phosphor-icons/react";
import { toast } from "sonner";
import { definirPdmUrl } from "@/lib/actions";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/** Edição do link do PDM pelo mentor da própria dupla (ou coordenação) —
 *  UPDATE em duplas é coord-only, então a escrita é a RPC definir_pdm_url
 *  (0044), que revalida escopo e formato no banco. */
export function PdmUrlDialog({
  duplaId,
  atual,
}: {
  duplaId: string;
  atual: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const router = useRouter();

  function salvar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const url = String(new FormData(e.currentTarget).get("pdm_url") ?? "");
    start(async () => {
      try {
        const res = await definirPdmUrl(duplaId, url);
        if (res?.error) toast.error(res.error);
        else {
          toast.success(
            url.trim()
              ? "Link do PDM salvo — vira o botão “Abrir PDM” na ficha e na sua home."
              : "Link do PDM removido."
          );
          setOpen(false);
          router.refresh();
        }
      } catch {
        toast.error("Sem conexão — tente de novo.");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button variant="ghost" size="sm" className="-my-1 text-muted-foreground">
            <PencilSimple size={14} />
            {atual ? "Editar link do PDM" : "Adicionar link do PDM"}
          </Button>
        }
      />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Link do PDM</DialogTitle>
        </DialogHeader>
        <form onSubmit={salvar} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="pdm_url">Endereço do plano de desenvolvimento</Label>
            <Input
              id="pdm_url"
              name="pdm_url"
              type="url"
              inputMode="url"
              defaultValue={atual ?? ""}
              placeholder="https://docs.google.com/…"
            />
            <p className="text-xs text-muted-foreground">
              Precisa ser um endereço completo (https://…). Deixe em branco pra
              remover o link.
            </p>
          </div>
          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? "Salvando…" : "Salvar"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
