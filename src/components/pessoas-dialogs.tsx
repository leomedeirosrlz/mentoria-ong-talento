"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, UserPlus } from "@phosphor-icons/react";
import { toast } from "sonner";
import { createMentorado, createPessoa } from "@/lib/actions";
import { FotoField } from "@/components/foto-field";
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

// labels dos papéis — registradas no Select pra o trigger fechado não mostrar
// o valor cru do enum ("mentor_dpp")
const PAPEL_LABEL: Record<string, string> = {
  mentor_dpp: "Mentor DPP",
  mentor_especialista: "Mentor especialista",
  supervisor: "Supervisor",
  coordenacao: "Coordenação",
};

function useSubmit(
  action: (fd: FormData) => Promise<{ error?: string; ok?: boolean; aviso?: string }>,
  okMsg: (nome: string) => string,
  close: () => void
) {
  const [pending, start] = useTransition();
  const router = useRouter();
  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const nome = String(fd.get("nome") ?? "").trim().split(" ")[0];
    start(async () => {
      const res = await action(fd);
      if (res?.error) toast.error(res.error);
      else {
        toast.success(okMsg(nome));
        // cadastro salvo mas a foto não subiu → aviso separado, não erro
        if (res?.aviso) toast.warning(res.aviso);
        close();
        router.refresh();
      }
    });
  };
  return { submit, pending };
}

export function NovaPessoaDialog() {
  const [open, setOpen] = useState(false);
  const { submit, pending } = useSubmit(createPessoa, (n) => `Cadastro de ${n} salvo.`, () => setOpen(false));

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
            <Label htmlFor="email">E-mail</Label>
            <Input id="email" name="email" type="email" required />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="whatsapp">WhatsApp</Label>
              <Input id="whatsapp" name="whatsapp" type="tel" inputMode="tel" autoComplete="tel" placeholder="5511…" />
            </div>
            <div className="space-y-2">
              <Label id="papel-label">Papel</Label>
              <Select name="role" required defaultValue="mentor_dpp" items={PAPEL_LABEL}>
                <SelectTrigger id="papel-select" aria-labelledby="papel-label papel-select"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(PAPEL_LABEL).map(([v, l]) => (
                    <SelectItem key={v} value={v}>{l}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <FotoField id="foto" />
          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? "Salvando…" : "Cadastrar"}
          </Button>
          <p className="text-xs text-muted-foreground">
            A pessoa entra com o e-mail por link de acesso; o papel define o que ela vê e pode ser alterado depois na lista.
          </p>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function NovoMentoradoDialog() {
  const [open, setOpen] = useState(false);
  const { submit, pending } = useSubmit(createMentorado, (n) => `Cadastro de ${n} salvo.`, () => setOpen(false));

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm" variant="outline"><Plus size={16} /> Novo mentorado</Button>} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Cadastrar mentorado</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="m_nome">Nome</Label>
            <Input id="m_nome" name="nome" required />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="m_whatsapp">WhatsApp</Label>
              <Input id="m_whatsapp" name="whatsapp" type="tel" inputMode="tel" autoComplete="tel" placeholder="5511…" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="m_ong">ONG de origem</Label>
              <Input id="m_ong" name="ong_origem" placeholder="Juventude Solidária" />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="m_email">E-mail (opcional)</Label>
            <Input id="m_email" name="email" type="email" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="m_notas">Notas / referência da anamnese</Label>
            <Textarea id="m_notas" name="notas" rows={2} />
          </div>
          <FotoField id="m_foto" />
          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? "Salvando…" : "Cadastrar"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
