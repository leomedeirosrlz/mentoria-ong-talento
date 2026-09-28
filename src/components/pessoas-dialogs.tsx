"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  DownloadSimple,
  DotsThree,
  FileArrowUp,
  Plus,
  UserPlus,
} from "@phosphor-icons/react";
import { toast } from "sonner";
import { createMentorado, createPessoa } from "@/lib/actions";
import { DadosCivisFields } from "@/components/assinatura-form";
import { FotoField } from "@/components/foto-field";
import { ImportarCsvDialog } from "@/components/importar-csv-dialog";
import {
  CampoConsentimento,
  CampoDisponibilidade,
  CampoEscolaridade,
  CampoGenero,
  CampoInteresses,
  CampoNascimento,
  CampoPrefGenero,
  CampoUf,
  WizardFicha,
  type PassoFicha,
} from "@/components/campos-pessoais";
import type { Disponibilidade } from "@/lib/types";
import { maskWhatsApp } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
      try {
        const res = await action(fd);
        if (res?.error) toast.error(res.error);
        else {
          toast.success(okMsg(nome));
          // cadastro salvo mas a foto não subiu → aviso separado, não erro
          if (res?.aviso) toast.warning(res.aviso);
          close();
          router.refresh();
        }
      } catch {
        toast.error("Sem conexão. Tente de novo.");
      }
    });
  };
  return { submit, pending };
}

/** "Mais ações" do header de /pessoas — importação e backups ficam recolhidos
 *  pra criação (Nova pessoa / Novo mentorado) ser a primária visível. Os
 *  exports são <a> de verdade dentro do menu (href real, download direto). */
export function PessoasMaisAcoes() {
  const [importarOpen, setImportarOpen] = useState(false);
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button size="sm" variant="outline">
              <DotsThree size={16} weight="bold" /> Mais ações
            </Button>
          }
        />
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuItem onClick={() => setImportarOpen(true)}>
            <FileArrowUp /> Importar CSV
          </DropdownMenuItem>
          <DropdownMenuItem render={<a href="/api/export?tipo=pessoas" />}>
            <DownloadSimple /> Exportar CSV
          </DropdownMenuItem>
          <DropdownMenuItem
            render={<a href="/api/export?tipo=assinaturas" />}
            title="Planilha das assinaturas: status, evidências e link do PDF. Aceita ?status= e ?documento= na URL"
          >
            <DownloadSimple /> Exportar assinaturas (CSV)
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <ImportarCsvDialog open={importarOpen} onOpenChange={setImportarOpen} />
    </>
  );
}

export function NovaPessoaDialog() {
  const [open, setOpen] = useState(false);
  const [role, setRole] = useState("mentor_dpp");
  const [interesses, setInteresses] = useState<string[]>([]);
  const [disponibilidade, setDisponibilidade] = useState<Disponibilidade | null>(null);
  const { submit, pending } = useSubmit(createPessoa, (n) => `Cadastro de ${n} salvo.`, () => setOpen(false));
  const ehMentor = role === "mentor_dpp" || role === "mentor_especialista";

  // um passo por SecaoFicha — a parede de campos virava um scroll só; a
  // "Ficha de mentor" entra/sai com o papel escolhido no passo 1
  const passos: PassoFicha[] = [
    {
      titulo: "Identificação",
      conteudo: (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="nome">Nome civil</Label>
              <Input id="nome" name="nome" required autoComplete="off" autoCapitalize="words" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="n_social">Nome social</Label>
              <Input id="n_social" name="nome_social" maxLength={150} autoCapitalize="words" placeholder="Nome de uso, se diferente" />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="email">E-mail</Label>
              <Input id="email" name="email" type="email" required autoComplete="email" autoCapitalize="none" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="whatsapp">WhatsApp</Label>
              <Input
                id="whatsapp" name="whatsapp" type="tel" inputMode="tel"
                autoComplete="tel" maxLength={15} placeholder="(11) 99999-9999"
                onInput={(e) => { e.currentTarget.value = maskWhatsApp(e.currentTarget.value); }}
              />
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
        </>
      ),
    },
    {
      titulo: "Localização e perfil",
      conteudo: (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="n_cidade">Cidade</Label>
              <Input id="n_cidade" name="cidade" maxLength={100} />
            </div>
            <CampoUf />
          </div>
          <CampoInteresses value={interesses} onChange={setInteresses} />
        </>
      ),
    },
    {
      titulo: "Trabalho e origem",
      conteudo: (
        <>
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
        </>
      ),
    },
    {
      titulo: "Motivação e pareamento",
      conteudo: (
        <>
          <div className="space-y-2">
            <Label htmlFor="n_motivacao">Motivação</Label>
            <Textarea id="n_motivacao" name="motivacao" rows={2} maxLength={2000} placeholder="O que traz a pessoa ao programa" />
          </div>
          <CampoPrefGenero />
        </>
      ),
    },
    ...(ehMentor
      ? [{
          titulo: "Ficha de mentor",
          conteudo: (
            <>
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
          ),
        }]
      : []),
    {
      titulo: "Documentos (termo de adesão)",
      conteudo: (
        <>
          <DadosCivisFields prefix="civis_" opcional compacto />
          <p className="text-xs text-muted-foreground">
            RG, CPF e endereço preenchem o termo de adesão automaticamente: a pessoa só confere e assina.
          </p>
        </>
      ),
    },
    {
      titulo: "Foto e consentimento",
      conteudo: (
        <>
          <FotoField id="foto" />
          <CampoConsentimento />
          <p className="text-xs text-muted-foreground">
            A pessoa entra com o e-mail por link de acesso; o papel define o que ela vê e pode ser alterado depois na lista.
            Nascimento, gênero, cor/raça, motivação e preferência de par ficam visíveis só pra coordenação.
          </p>
        </>
      ),
    },
  ];

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
        <WizardFicha
          passos={passos}
          pending={pending}
          submitLabel="Cadastrar"
          onSubmit={submit}
        />
      </DialogContent>
    </Dialog>
  );
}

export function NovoMentoradoDialog() {
  const [open, setOpen] = useState(false);
  const [interesses, setInteresses] = useState<string[]>([]);
  const [disponibilidade, setDisponibilidade] = useState<Disponibilidade | null>(null);
  const { submit, pending } = useSubmit(createMentorado, (n) => `Cadastro de ${n} salvo.`, () => setOpen(false));

  // um passo por SecaoFicha — o form tinha 9 seções seguidas de scroll
  const passos: PassoFicha[] = [
    {
      titulo: "Identificação",
      conteudo: (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="m_nome">Nome civil</Label>
              <Input id="m_nome" name="nome" required autoComplete="off" autoCapitalize="words" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="m_social">Nome social</Label>
              <Input id="m_social" name="nome_social" maxLength={150} autoCapitalize="words" placeholder="Nome de uso, se diferente" />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="m_whatsapp">WhatsApp</Label>
              <Input
                id="m_whatsapp" name="whatsapp" type="tel" inputMode="tel"
                autoComplete="tel" maxLength={15} placeholder="(11) 99999-9999"
                onInput={(e) => { e.currentTarget.value = maskWhatsApp(e.currentTarget.value); }}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="m_email">E-mail (opcional)</Label>
              <Input id="m_email" name="email" type="email" autoComplete="email" autoCapitalize="none" />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <CampoNascimento id="m_nasc" />
            <CampoGenero />
          </div>
        </>
      ),
    },
    {
      titulo: "Onde vive e origem",
      conteudo: (
        <>
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
        </>
      ),
    },
    {
      titulo: "Interesses e objetivos",
      conteudo: (
        <>
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
        </>
      ),
    },
    {
      titulo: "Disponibilidade semanal",
      conteudo: (
        <CampoDisponibilidade value={disponibilidade} onChange={setDisponibilidade} />
      ),
    },
    {
      titulo: "Documentos do(a) jovem (termo de participação)",
      conteudo: (
        <>
          <DadosCivisFields prefix="civis_" opcional compacto />
          <p className="text-xs text-muted-foreground">
            Preenchem o termo de participação: o(a) jovem assina por link, sem precisar de conta.
          </p>
        </>
      ),
    },
    {
      titulo: "Responsável legal (autorização de menor)",
      conteudo: (
        <>
          <div className="space-y-2">
            <Label htmlFor="m_parentesco">Parentesco com o(a) jovem</Label>
            <Input id="m_parentesco" name="resp_parentesco" maxLength={60} autoCapitalize="sentences" placeholder="Mãe, pai, avó, tio…" />
          </div>
          <DadosCivisFields prefix="resp_" opcional />
        </>
      ),
    },
    {
      titulo: "Anamnese e foto",
      conteudo: (
        <>
          <div className="space-y-2">
            <Label htmlFor="m_notas">Notas / referência da anamnese</Label>
            <Textarea id="m_notas" name="notas" rows={2} />
          </div>
          <FotoField id="m_foto" />
          <p className="text-xs text-muted-foreground">
            Nascimento, gênero, cor/raça, motivação e preferência de par ficam visíveis só pra coordenação.
          </p>
        </>
      ),
    },
  ];

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
        <WizardFicha
          passos={passos}
          pending={pending}
          submitLabel="Cadastrar"
          onSubmit={submit}
        />
      </DialogContent>
    </Dialog>
  );
}
