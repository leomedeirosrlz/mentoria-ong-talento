"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "@phosphor-icons/react";
import { toast } from "sonner";
import { salvarMaterial } from "@/lib/actions";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

export function NovoMaterialDialog() {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const router = useRouter();

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    start(async () => {
      const res = await salvarMaterial(new FormData(e.currentTarget));
      if (res?.error) toast.error(res.error);
      else {
        toast.success("Material adicionado.");
        setOpen(false);
        router.refresh();
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm"><Plus size={16} /> Novo material</Button>} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Novo material</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="titulo">Titulo</Label>
            <Input id="titulo" name="titulo" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="descricao">Descricao</Label>
            <Textarea id="descricao" name="descricao" rows={2} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Tipo</Label>
              <Select name="tipo" defaultValue="link">
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="guia">Guia</SelectItem>
                  <SelectItem value="template">Template</SelectItem>
                  <SelectItem value="conteudo">Conteudo</SelectItem>
                  <SelectItem value="link">Link</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Audiencia</Label>
              <Select name="audiencia" defaultValue="todos">
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  <SelectItem value="dpp">Mentor DPP</SelectItem>
                  <SelectItem value="especialista">Especialista</SelectItem>
                  <SelectItem value="coordenacao">Coordenacao</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="url">URL (opcional)</Label>
              <Input id="url" name="url" type="url" placeholder="https://..." />
            </div>
            <div className="space-y-2">
              <Label htmlFor="encontro_num">Encontro relacionado</Label>
              <Input id="encontro_num" name="encontro_num" type="number" min={1} max={16} placeholder="-" />
            </div>
          </div>
          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? "Salvando..." : "Adicionar"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
