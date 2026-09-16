"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "@phosphor-icons/react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { createDupla } from "@/lib/actions";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

type Opt = { id: string; nome: string };

export function NovaDuplaDialog() {
  const [open, setOpen] = useState(false);
  const [mentores, setMentores] = useState<Opt[]>([]);
  const [mentorados, setMentorados] = useState<Opt[]>([]);
  const [supervisores, setSupervisores] = useState<Opt[]>([]);
  const [pending, start] = useTransition();
  const router = useRouter();

  useEffect(() => {
    if (!open) return;
    const supabase = createClient();
    supabase
      .from("profiles")
      .select("id, nome, role")
      .in("role", ["mentor_dpp", "supervisor"])
      .then(({ data }) => {
        setMentores((data ?? []).filter((p) => p.role === "mentor_dpp"));
        setSupervisores((data ?? []).filter((p) => p.role === "supervisor"));
      });
    supabase
      .from("mentorados")
      .select("id, nome")
      .then(({ data }) => setMentorados(data ?? []));
  }, [open]);

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    start(async () => {
      const res = await createDupla(new FormData(e.currentTarget));
      if (res?.error) toast.error(res.error);
      else {
        toast.success("Dupla formada.");
        setOpen(false);
        router.refresh();
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm"><Plus size={16} /> Nova dupla</Button>} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Formar dupla</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <Label>Mentor(a) DPP</Label>
            <Select name="mentor_id" required>
              <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
              <SelectContent>
                {mentores.map((m) => (
                  <SelectItem key={m.id} value={m.id}>{m.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Mentorado(a)</Label>
            <Select name="mentorado_id" required>
              <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
              <SelectContent>
                {mentorados.map((m) => (
                  <SelectItem key={m.id} value={m.id}>{m.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Supervisor de relacionamento (opcional)</Label>
            <Select name="supervisor_id">
              <SelectTrigger><SelectValue placeholder="Nenhum" /></SelectTrigger>
              <SelectContent>
                {supervisores.map((m) => (
                  <SelectItem key={m.id} value={m.id}>{m.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="iniciada_em">Inicio da mentoria</Label>
            <Input id="iniciada_em" name="iniciada_em" type="date" />
          </div>
          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? "Salvando..." : "Formar dupla"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
