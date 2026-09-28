"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { DotsThree, PencilSimple, Trash } from "@phosphor-icons/react";
import { toast } from "sonner";
import { deleteMentorado, updateMentorado } from "@/lib/actions";
import { avatarPublicUrl } from "@/lib/avatar";
import { FotoField } from "@/components/foto-field";
import {
  CampoDisponibilidade,
  CampoCorRaca,
  CampoEscolaridade,
  CampoGenero,
  CampoInteresses,
  CampoNascimento,
  CampoPrefGenero,
  CampoUf,
  WizardFicha,
  type PassoFicha,
} from "@/components/campos-pessoais";
import { formatWhatsApp } from "@/lib/ciclo";
import { maskWhatsApp } from "@/lib/utils";
import type { Disponibilidade, Mentorado } from "@/lib/types";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ConfirmDeleteButton } from "@/components/confirm-delete-button";
import { DocumentoPessoa } from "@/components/documento-pessoa";
import { AssinaturasPessoa } from "@/components/assinaturas-pessoa";
import { DadosCivisFields } from "@/components/assinatura-form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export function MentoradoActions({
  mentorado,
  temDupla,
}: {
  mentorado: Mentorado;
  temDupla: boolean;
}) {
  const [editOpen, setEditOpen] = useState(false);
  const [delOpen, setDelOpen] = useState(false);
  const [interesses, setInteresses] = useState<string[]>(mentorado.interesses ?? []);
  const [disponibilidade, setDisponibilidade] = useState<Disponibilidade | null>(mentorado.disponibilidade ?? null);
  const [pending, start] = useTransition();
  const router = useRouter();
  const primeiroNome = (mentorado.nome_social || mentorado.nome).split(" ")[0];

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    start(async () => {
      try {
        const res = await updateMentorado(mentorado.id, new FormData(e.currentTarget));
        if (res?.error) toast.error(res.error);
        else {
          toast.success(`Cadastro de ${primeiroNome} atualizado.`);
          if (res?.aviso) toast.warning(res.aviso);
          setEditOpen(false);
          router.refresh();
        }
      } catch {
        toast.error("Sem conexão. Tente de novo.");
      }
    });
  }

  // um passo por SecaoFicha — 7 seções seguidas de scroll viravam parede
  // de campos (docs do jovem e do responsável ficam perto do fim)
  const passos: PassoFicha[] = [
    {
      titulo: "Identificação e contato",
      conteudo: (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="em_nome">Nome civil</Label>
              <Input id="em_nome" name="nome" required autoCapitalize="words" defaultValue={mentorado.nome} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="em_social">Nome social</Label>
              <Input
                id="em_social" name="nome_social" maxLength={150}
                autoCapitalize="words"
                defaultValue={mentorado.nome_social ?? ""}
                placeholder="Nome de uso, se diferente"
              />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="em_whatsapp">WhatsApp</Label>
              <Input
                id="em_whatsapp" name="whatsapp"
                type="tel" inputMode="tel" autoComplete="tel"
                maxLength={15} placeholder="(11) 99999-9999"
                onInput={(e) => { e.currentTarget.value = maskWhatsApp(e.currentTarget.value); }}
                defaultValue={formatWhatsApp(mentorado.whatsapp)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="em_email">E-mail</Label>
              <Input id="em_email" name="email" type="email" defaultValue={mentorado.email ?? ""} />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <CampoNascimento id="em_nasc" defaultValue={mentorado.data_nascimento ?? ""} />
            <CampoGenero defaultValue={mentorado.genero ?? ""} />
          </div>
          <CampoCorRaca defaultValue={mentorado.cor_raca ?? ""} />
        </>
      ),
    },
    {
      titulo: "Onde vive e origem",
      conteudo: (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="em_cidade">Cidade</Label>
              <Input id="em_cidade" name="cidade" maxLength={100} defaultValue={mentorado.cidade ?? ""} />
            </div>
            <CampoUf defaultValue={mentorado.uf ?? ""} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="em_ong">ONG de origem</Label>
              <Input id="em_ong" name="ong_origem" defaultValue={mentorado.ong_origem ?? ""} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="em_origem">Como chegou ao programa</Label>
              <Input
                id="em_origem" name="origem" maxLength={300}
                defaultValue={mentorado.origem ?? ""}
                placeholder="Escola, ONG, indicação…"
              />
            </div>
          </div>
          <CampoEscolaridade defaultValue={mentorado.escolaridade ?? ""} />
        </>
      ),
    },
    {
      titulo: "Interesses e objetivos",
      conteudo: (
        <>
          <CampoInteresses value={interesses} onChange={setInteresses} />
          <div className="space-y-2">
            <Label htmlFor="em_objetivos">Objetivos com a mentoria</Label>
            <Textarea
              id="em_objetivos" name="objetivos" rows={2} maxLength={2000}
              defaultValue={mentorado.objetivos ?? ""}
              placeholder="O que o jovem quer alcançar no programa"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="em_motivacao">Motivação</Label>
            <Textarea
              id="em_motivacao" name="motivacao" rows={2} maxLength={2000}
              defaultValue={mentorado.motivacao ?? ""}
              placeholder="O que motiva a participação"
            />
          </div>
          <CampoPrefGenero defaultValue={mentorado.pref_genero_par ?? ""} />
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
        <DadosCivisFields
          prefix="civis_"
          opcional
          compacto
          defaults={mentorado.dados_civis}
        />
      ),
    },
    {
      titulo: "Responsável legal (autorização de menor)",
      conteudo: (
        <>
          <div className="space-y-2">
            <Label htmlFor="em_parentesco">Parentesco com o(a) jovem</Label>
            <Input
              id="em_parentesco" name="resp_parentesco" maxLength={60}
              autoCapitalize="sentences" placeholder="Mãe, pai, avó, tio…"
              defaultValue={mentorado.responsavel?.parentesco ?? ""}
            />
          </div>
          <DadosCivisFields
            prefix="resp_"
            opcional
            defaults={mentorado.responsavel}
          />
        </>
      ),
    },
    {
      titulo: "Anamnese e arquivos",
      conteudo: (
        <>
          <div className="space-y-2">
            <Label htmlFor="em_notas">Notas / referência da anamnese</Label>
            <Textarea id="em_notas" name="notas" rows={2} defaultValue={mentorado.notas ?? ""} />
          </div>
          <FotoField
            id="em_foto"
            defaultUrl={mentorado.avatar_path ? avatarPublicUrl(mentorado.avatar_path) : null}
          />
          <DocumentoPessoa
            tipo="mentorado"
            id={mentorado.id}
            documentoPath={mentorado.documento_path}
          />
          <AssinaturasPessoa
            tipo="mentorado"
            id={mentorado.id}
            nome={mentorado.nome}
            whatsapp={mentorado.whatsapp}
          />
          <p className="text-xs text-muted-foreground">
            Nascimento, gênero, cor/raça, motivação e preferência de par ficam visíveis só pra coordenação.
          </p>
        </>
      ),
    },
  ];

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button variant="ghost" size="icon" aria-label="Ações">
              <DotsThree size={18} weight="bold" />
            </Button>
          }
        />
        <DropdownMenuContent align="end" className="w-44">
          <DropdownMenuItem onClick={() => setEditOpen(true)}>
            <PencilSimple /> Editar
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            variant="destructive"
            disabled={temDupla}
            onClick={() => setDelOpen(true)}
          >
            <Trash /> Excluir
          </DropdownMenuItem>
          {temDupla && (
            <p className="px-2 pb-1 text-[11px] leading-snug text-muted-foreground">
              Tem dupla no histórico: cadastro vinculado a uma dupla, mesmo encerrada, não pode ser excluído.
            </p>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog
        open={editOpen}
        onOpenChange={(o) => {
          setEditOpen(o);
          if (o) {
            setInteresses(mentorado.interesses ?? []);
            setDisponibilidade(mentorado.disponibilidade ?? null);
          }
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Editar {primeiroNome}</DialogTitle>
          </DialogHeader>
          <WizardFicha
            passos={passos}
            pending={pending}
            submitLabel="Salvar"
            onSubmit={submit}
          />
        </DialogContent>
      </Dialog>

      <ConfirmDeleteButton
        open={delOpen}
        onOpenChange={setDelOpen}
        titulo={`Excluir ${mentorado.nome}?`}
        descricao="Remove o cadastro do mentorado. Só é possível excluir quem nunca teve dupla: o vínculo fica no histórico mesmo depois de encerrada."
        sucesso={`Cadastro de ${mentorado.nome} excluído.`}
        onConfirm={() => deleteMentorado(mentorado.id)}
      />
    </>
  );
}
