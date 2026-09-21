"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Megaphone } from "@phosphor-icons/react";
import { toast } from "sonner";
import { publicarComunicado } from "@/lib/actions";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

// mesma matriz de audiência dos materiais + 'equipe' (coord + supervisores —
// aviso interno sem pingar mentores)
const AUDIENCIA_LABEL = {
  todos: "Todos",
  dpp: "Mentores DPP",
  especialista: "Mentores especialistas",
  equipe: "Coordenação e supervisores",
  coordenacao: "Só a coordenação",
} as const;

export function NovoComunicadoDialog() {
  const [open, setOpen] = useState(false);
  const [titulo, setTitulo] = useState("");
  const [pending, start] = useTransition();
  const router = useRouter();

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    start(async () => {
      const r = await publicarComunicado(fd);
      if (r.error) {
        toast.error(r.error);
        return;
      }
      toast.success("Aviso publicado.");
      setTitulo("");
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm" />}>
        <Megaphone size={15} aria-hidden />
        Novo aviso
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Novo aviso</DialogTitle>
          <DialogDescription>
            O aviso aparece no mural e notifica quem você escolher abaixo.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <div className="flex items-baseline justify-between gap-2">
              <Label htmlFor="aviso-titulo">Título</Label>
              <span className="text-xs text-muted-foreground">
                {titulo.length}/140
              </span>
            </div>
            <Input
              id="aviso-titulo"
              name="titulo"
              required
              maxLength={140}
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="aviso-corpo">Texto</Label>
            <Textarea id="aviso-corpo" name="corpo" required rows={4} maxLength={5000} />
          </div>
          <div className="space-y-1.5">
            <Label id="audiencia-label">Quem recebe</Label>
            <Select name="audiencia" defaultValue="todos">
              <SelectTrigger
                id="audiencia-select"
                aria-labelledby="audiencia-label audiencia-select"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(AUDIENCIA_LABEL).map(([v, l]) => (
                  <SelectItem key={v} value={v}>{l}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? "Publicando…" : "Publicar aviso"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
