"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, UserPlus } from "@phosphor-icons/react";
import { toast } from "sonner";
import { createMentorado, createPessoa } from "@/lib/actions";
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

function useSubmit(
  action: (fd: FormData) => Promise<{ error?: string; ok?: boolean }>,
  okMsg: string,
  close: () => void
) {
  const [pending, start] = useTransition();
  const router = useRouter();
  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    start(async () => {
      const res = await action(new FormData(e.currentTarget));
      if (res?.error) toast.error(res.error);
      else {
        toast.success(okMsg);
        close();
        router.refresh();
      }
    });
  };
  return { submit, pending };
}

export function NovaPessoaDialog() {
  const [open, setOpen] = useState(false);
  const { submit, pending } = useSubmit(createPessoa, "Pessoa cadastrada.", () => setOpen(false));

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm"><UserPlus size={16} /> Nova pessoa</Button>} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Cadastrar pessoa</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="nome">Nome</Label>
            <Input id="nome" name="nome" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">E-mail (login por magic link)</Label>
            <Input id="email" name="email" type="email" required />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="whatsapp">WhatsApp</Label>
              <Input id="whatsapp" name="whatsapp" placeholder="5511..." />
            </div>
            <div className="space-y-2">
              <Label>Papel</Label>
              <Select name="role" required defaultValue="mentor_dpp">
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="mentor_dpp">Mentor DPP</SelectItem>
                  <SelectItem value="mentor_especialista">Mentor especialista</SelectItem>
                  <SelectItem value="supervisor">Supervisor</SelectItem>
                  <SelectItem value="coordenacao">Coordenacao</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? "Salvando..." : "Cadastrar"}
          </Button>
          <p className="text-xs text-muted-foreground">
            A pessoa entra com o e-mail por magic link; o papel ja vem definido.
          </p>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function NovoMentoradoDialog() {
  const [open, setOpen] = useState(false);
  const { submit, pending } = useSubmit(createMentorado, "Mentorado(a) cadastrado(a).", () => setOpen(false));

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm" variant="outline"><Plus size={16} /> Novo mentorado</Button>} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Cadastrar mentorado(a)</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="m_nome">Nome</Label>
            <Input id="m_nome" name="nome" required />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="m_whatsapp">WhatsApp</Label>
              <Input id="m_whatsapp" name="whatsapp" placeholder="5511..." />
            </div>
            <div className="space-y-2">
              <Label htmlFor="m_ong">ONG de origem</Label>
              <Input id="m_ong" name="ong_origem" placeholder="Juventude Solidaria" />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="m_email">E-mail (opcional)</Label>
            <Input id="m_email" name="email" type="email" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="m_notas">Notas / referencia da anamnese</Label>
            <Textarea id="m_notas" name="notas" rows={2} />
          </div>
          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? "Salvando..." : "Cadastrar"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
