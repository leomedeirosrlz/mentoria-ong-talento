"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, UserPlus } from "@phosphor-icons/react";
import { toast } from "sonner";
import { createMentorado, createPessoa } from "@/lib/actions";
import { FotoField } from "@/components/foto-field";
import {
  CampoConsentimento,
  CampoDisponibilidade,
  CampoEscolaridade,
  CampoGenero,
  CampoInteresses,
  CampoNascimento,
  CampoPrefGenero,
  CampoUf,
  SecaoFicha,
} from "@/components/campos-pessoais";
import type { Disponibilidade } from "@/lib/types";
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
  const [role, setRole] = useState("mentor_dpp");
  const [interesses, setInteresses] = useState<string[]>([]);
  const [disponibilidade, setDisponibilidade] = useState<Disponibilidade | null>(null);
  const { submit, pending } = useSubmit(createPessoa, (n) => `Cadastro de ${n} salvo.`, () => setOpen(false));
  const ehMentor = role === "mentor_dpp" || role === "mentor_especialista";

  return (
    <Dialog
      open={open}
      // os controlados (chips/grade/papel) sobrevivem ao fechar — reabrir
      // mostraria o cadastro anterior; reseta sempre que o dialog abre
      onOpenChange={(o) => {
        setOpen(o);
        if (o) {
          setRole("mentor_dpp");
          setInteresses([]);
          setDisponibilidade(null);
        }
      }}
    >
      <DialogTrigger render={<Button size="sm"><UserPlus size={16} /> Nova pessoa</Button>} />
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Cadastrar pessoa</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <SecaoFicha>Identificação</SecaoFicha>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="nome">Nome civil</Label>
              <Input id="nome" name="nome" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="n_social">Nome social</Label>
              <Input id="n_social" name="nome_social" maxLength={150} placeholder="Nome de uso, se diferente" />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="email">E-mail</Label>
              <Input id="email" name="email" type="email" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="whatsapp">WhatsApp</Label>
              <Input id="whatsapp" name="whatsapp" type="tel" inputMode="tel" autoComplete="tel" placeholder="5511…" />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <CampoNascimento id="n_nasc" />
            <CampoGenero />
            <div className="space-y-2">
              <Label id="papel-label">Papel</Label>
              <Select
                name="role"
                required
                value={role}
                items={PAPEL_LABEL}
                onValueChange={(v) => setRole(v ?? "mentor_dpp")}
              >
                <SelectTrigger id="papel-select" aria-labelledby="papel-label papel-select"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(PAPEL_LABEL).map(([v, l]) => (
                    <SelectItem key={v} value={v}>{l}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <SecaoFicha>Localização e perfil</SecaoFicha>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="n_cidade">Cidade</Label>
              <Input id="n_cidade" name="cidade" maxLength={100} />
            </div>
            <CampoUf />
          </div>
          <CampoInteresses value={interesses} onChange={setInteresses} />

          <SecaoFicha>Trabalho e origem</SecaoFicha>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="n_cargo">Cargo</Label>
              <Input id="n_cargo" name="cargo" maxLength={120} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="n_empresa">Empresa</Label>
              <Input id="n_empresa" name="empresa" maxLength={150} />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="n_origem">Como chegou ao programa</Label>
            <Input id="n_origem" name="origem" maxLength={300} placeholder="Indicação, ONG parceira, rede social…" />
          </div>

          <SecaoFicha>Motivação e pareamento</SecaoFicha>
          <div className="space-y-2">
            <Label htmlFor="n_motivacao">Motivação</Label>
            <Textarea id="n_motivacao" name="motivacao" rows={2} maxLength={2000} placeholder="O que traz a pessoa ao programa" />
          </div>
          <CampoPrefGenero />

          {ehMentor && (
            <>
              <SecaoFicha>Ficha de mentor</SecaoFicha>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="n_cap">Capacidade (duplas)</Label>
                  <Input id="n_cap" name="capacidade" type="number" min={1} max={10} defaultValue={1} required />
                </div>
              </div>
              <CampoDisponibilidade value={disponibilidade} onChange={setDisponibilidade} />
              <div className="space-y-2">
                <Label htmlFor="n_exp">Experiência prévia como mentor</Label>
                <Textarea id="n_exp" name="experiencia_previa" rows={2} maxLength={2000} placeholder="Mentorias anteriores, mediação, ensino…" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="n_form">Formação e certificações externas</Label>
                <Textarea id="n_form" name="formacao_externa" rows={2} maxLength={2000} placeholder="Cursos e certificações relevantes" />
              </div>
            </>
          )}

          <SecaoFicha>Foto e consentimento</SecaoFicha>
          <FotoField id="foto" />
          <CampoConsentimento />

          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? "Salvando…" : "Cadastrar"}
          </Button>
          <p className="text-xs text-muted-foreground">
            A pessoa entra com o e-mail por link de acesso; o papel define o que ela vê e pode ser alterado depois na lista.
            Nascimento, gênero, motivação e preferência de par ficam visíveis só pra coordenação.
          </p>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function NovoMentoradoDialog() {
  const [open, setOpen] = useState(false);
  const [interesses, setInteresses] = useState<string[]>([]);
  const [disponibilidade, setDisponibilidade] = useState<Disponibilidade | null>(null);
  const { submit, pending } = useSubmit(createMentorado, (n) => `Cadastro de ${n} salvo.`, () => setOpen(false));

  return (
    <Dialog
      open={open}
      // mesma razão do NovaPessoaDialog: as chips de interesses são
      // controladas e não podem vazar pro próximo cadastro
      onOpenChange={(o) => {
        setOpen(o);
        if (o) {
          setInteresses([]);
          setDisponibilidade(null);
        }
      }}
    >
      <DialogTrigger render={<Button size="sm" variant="outline"><Plus size={16} /> Novo mentorado</Button>} />
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Cadastrar mentorado</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <SecaoFicha>Identificação</SecaoFicha>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="m_nome">Nome civil</Label>
              <Input id="m_nome" name="nome" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="m_social">Nome social</Label>
              <Input id="m_social" name="nome_social" maxLength={150} placeholder="Nome de uso, se diferente" />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="m_whatsapp">WhatsApp</Label>
              <Input id="m_whatsapp" name="whatsapp" type="tel" inputMode="tel" autoComplete="tel" placeholder="5511…" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="m_email">E-mail (opcional)</Label>
              <Input id="m_email" name="email" type="email" />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <CampoNascimento id="m_nasc" />
            <CampoGenero />
          </div>

          <SecaoFicha>Onde vive e origem</SecaoFicha>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="m_cidade">Cidade</Label>
              <Input id="m_cidade" name="cidade" maxLength={100} />
            </div>
            <CampoUf />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="m_ong">ONG de origem</Label>
              <Input id="m_ong" name="ong_origem" placeholder="Juventude Solidária" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="m_origem">Como chegou ao programa</Label>
              <Input id="m_origem" name="origem" maxLength={300} placeholder="Escola, ONG, indicação…" />
            </div>
          </div>
          <CampoEscolaridade />

          <SecaoFicha>Interesses e objetivos</SecaoFicha>
          <CampoInteresses value={interesses} onChange={setInteresses} />
          <div className="space-y-2">
            <Label htmlFor="m_objetivos">Objetivos com a mentoria</Label>
            <Textarea id="m_objetivos" name="objetivos" rows={2} maxLength={2000} placeholder="O que o jovem quer alcançar no programa" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="m_motivacao">Motivação</Label>
            <Textarea id="m_motivacao" name="motivacao" rows={2} maxLength={2000} placeholder="O que motiva a participação" />
          </div>
          <CampoPrefGenero />

          <SecaoFicha>Disponibilidade semanal</SecaoFicha>
          <CampoDisponibilidade value={disponibilidade} onChange={setDisponibilidade} />

          <SecaoFicha>Anamnese e foto</SecaoFicha>
          <div className="space-y-2">
            <Label htmlFor="m_notas">Notas / referência da anamnese</Label>
            <Textarea id="m_notas" name="notas" rows={2} />
          </div>
          <FotoField id="m_foto" />

          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? "Salvando…" : "Cadastrar"}
          </Button>
          <p className="text-xs text-muted-foreground">
            Nascimento, gênero, motivação e preferência de par ficam visíveis só pra coordenação.
          </p>
        </form>
      </DialogContent>
    </Dialog>
  );
}
