"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CalendarPlus } from "@phosphor-icons/react";
import { toast } from "sonner";
import { agendarEncontro } from "@/lib/actions";
import type { Encontro } from "@/lib/types";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

export function AgendarEncontroDialog({
  duplaId,
  numero,
  atual,
}: {
  duplaId: string;
  numero: number;
  atual: Encontro | null;
}) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const router = useRouter();

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    fd.set("dupla_id", duplaId);
    fd.set("numero", String(numero));
    start(async () => {
      const res = await agendarEncontro(fd);
      if (res?.error) toast.error(res.error);
      else {
        toast.success(`${numero}o encontro agendado.`);
        setOpen(false);
        router.refresh();
      }
    });
  }

  const defaultValue = atual?.data_hora
    ? new Date(atual.data_hora).toISOString().slice(0, 16)
    : "";

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={
        <Button variant={atual ? "outline" : "default"} size="sm">
          <CalendarPlus size={16} />
          {atual ? "Remarcar" : "Agendar encontro"}
        </Button>
      } />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{numero}o encontro</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="data_hora">Data e horario</Label>
            <Input id="data_hora" name="data_hora" type="datetime-local" required defaultValue={defaultValue} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="origem">Onde foi marcado</Label>
            <Select name="origem" defaultValue="plataforma">
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="plataforma">Aqui na plataforma</SelectItem>
                <SelectItem value="externo">Na plataforma oficial (Top2You) ou WhatsApp</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="link">Link da chamada (opcional)</Label>
            <Input id="link" name="link" type="url" placeholder="https://meet.google.com/..." defaultValue={atual?.link ?? ""} />
          </div>
          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? "Salvando..." : "Confirmar agendamento"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
