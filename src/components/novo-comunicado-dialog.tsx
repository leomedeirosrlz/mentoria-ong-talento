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
import { cn } from "@/lib/utils";

// mesma matriz de audiência dos materiais + 'equipe' (coord + supervisores —
// aviso interno sem pingar mentores)
const AUDIENCIA_LABEL = {
  todos: "Todos",
  dpp: "Mentores DPP",
  especialista: "Mentores especialistas",
  equipe: "Coordenação e supervisores",
  coordenacao: "Só a coordenação",
} as const;

// a descrição curta de cada opção ancora o critério — sem ela "urgente"
// vira botão de ênfase e banaliza
const PRIORIDADE_OPCOES = [
  { valor: "normal", rotulo: "Normal", descricao: "informativo" },
  { valor: "importante", rotulo: "Importante", descricao: "pede atenção ou ação" },
  { valor: "urgente", rotulo: "Urgente", descricao: "crítico ou com prazo" },
] as const;

export function NovoComunicadoDialog() {
  const [open, setOpen] = useState(false);
  const [titulo, setTitulo] = useState("");
  const [corpoLen, setCorpoLen] = useState(0);
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
      setCorpoLen(0);
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
            O aviso aparece na home e notifica quem você escolher abaixo.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <div className="flex items-baseline justify-between gap-2">
              <Label htmlFor="aviso-titulo">Título</Label>
              <span aria-hidden className="text-xs tabular-nums text-muted-foreground">
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
            <div className="flex items-baseline justify-between gap-2">
              <Label htmlFor="aviso-corpo">Texto</Label>
              <span aria-hidden className="text-xs tabular-nums text-muted-foreground">
                {corpoLen}/5000
              </span>
            </div>
            <Textarea
              id="aviso-corpo"
              name="corpo"
              required
              rows={4}
              maxLength={5000}
              onChange={(e) => setCorpoLen(e.target.value.length)}
            />
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
          {/* radio nativo (padrão OpcaoPilula de registros-filtros): o input
              sr-only entra no FormData, setas do teclado e leitor de tela
              vêm de graça; o label estiliza via has-checked */}
          <fieldset className="space-y-1.5">
            <legend className="text-sm font-medium leading-none select-none">
              Prioridade
            </legend>
            <div className="grid gap-1.5 sm:grid-cols-3">
              {PRIORIDADE_OPCOES.map((p) => (
                <label
                  key={p.valor}
                  className={cn(
                    "flex min-h-11 cursor-pointer flex-col items-center justify-center rounded-lg border px-2.5 py-1.5 text-center text-sm transition-colors",
                    "hover:bg-muted has-checked:border-foreground has-checked:bg-foreground has-checked:font-medium has-checked:text-background",
                    "has-focus-visible:ring-2 has-focus-visible:ring-ring has-focus-visible:ring-offset-2 has-focus-visible:ring-offset-background"
                  )}
                >
                  <input
                    type="radio"
                    name="prioridade"
                    value={p.valor}
                    defaultChecked={p.valor === "normal"}
                    className="sr-only"
                  />
                  {p.rotulo}
                  <span className="text-[11px] leading-tight font-normal opacity-70">
                    {p.descricao}
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
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
