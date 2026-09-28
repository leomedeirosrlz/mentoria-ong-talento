"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { DotsThree, PencilSimple, Prohibit, Trash } from "@phosphor-icons/react";
import { toast } from "sonner";
import { deletePessoa, setPessoaAtivo, updatePessoa } from "@/lib/actions";
import { createClient } from "@/lib/supabase/client";
import { avatarPublicUrl } from "@/lib/avatar";
import { FotoField } from "@/components/foto-field";
import { TagInput } from "@/components/tag-input";
import {
  CampoConsentimento,
  CampoDisponibilidade,
  CampoCorRaca,
  CampoGenero,
  CampoInteresses,
  CampoNascimento,
  CampoPrefGenero,
  CampoUf,
  WizardFicha,
  type PassoFicha,
} from "@/components/campos-pessoais";
import { AREAS_SUGESTOES, formatWhatsApp } from "@/lib/ciclo";
import { maskWhatsApp } from "@/lib/utils";
import type { Disponibilidade, Profile } from "@/lib/types";
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

// subset do mentor_profile que a coordenação edita — inclui a ficha de
// matching da 0034 (experiência/formação/disponibilidade)
type MentorProfile = {
  capacidade: number;
  areas: string[];
  termo_ok: boolean;
  formacao_ok: boolean;
  experiencia_previa: string | null;
  formacao_externa: string | null;
  disponibilidade: Disponibilidade | null;
} | null;

export function PessoaActions({
  pessoa,
  podeExcluir,
}: {
  pessoa: Profile;
  podeExcluir: boolean;
}) {
  const [editOpen, setEditOpen] = useState(false);
  const [delOpen, setDelOpen] = useState(false);
  // desativar com duplas em andamento pede confirmação — o server devolve a
  // contagem num primeiro chamado e esse dialog conclui com forcar=true
  const [duplasEmCurso, setDuplasEmCurso] = useState(0);
  const [mp, setMp] = useState<MentorProfile | undefined>(undefined);
  const [bioLen, setBioLen] = useState(0);
  const [volLen, setVolLen] = useState(0);
  const [areasPerfil, setAreasPerfil] = useState<string[]>(pessoa.areas ?? []);
  const [interesses, setInteresses] = useState<string[]>(pessoa.interesses ?? []);
  const [disponibilidade, setDisponibilidade] = useState<Disponibilidade | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();
  const ehMentor = pessoa.role === "mentor_dpp" || pessoa.role === "mentor_especialista";
  const primeiroNome = (pessoa.nome_social || pessoa.nome).split(" ")[0];

  useEffect(() => {
    if (!editOpen || !ehMentor) return;
    createClient()
      .from("mentor_profiles")
      .select("capacidade, areas, termo_ok, formacao_ok, experiencia_previa, formacao_externa, disponibilidade")
      .eq("profile_id", pessoa.id)
      .maybeSingle()
      .then(({ data, error }) => {
        // falha na leitura mantém a seção escondida — defaults renderizados
        // aqui sobrescreveriam os valores reais no save
        if (error) {
          toast.error("Não foi possível carregar os dados do mentor.");
          return;
        }
        setMp(data);
        setDisponibilidade(data?.disponibilidade ?? null);
      });
  }, [editOpen, ehMentor, pessoa.id]);

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    start(async () => {
      try {
        const res = await updatePessoa(pessoa.id, new FormData(e.currentTarget));
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

  // um passo por SecaoFicha — 8 seções seguidas de scroll viravam parede
  // de campos; a "Ficha de mentor" entra quando o mentor_profiles carrega
  // (salvar antes disso não zera nada: a action só toca o que veio no FormData)
  const passos: PassoFicha[] = [
    {
      titulo: "Identificação e contato",
      conteudo: (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="e_nome">Nome civil</Label>
              <Input id="e_nome" name="nome" required autoCapitalize="words" defaultValue={pessoa.nome} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="e_social">Nome social</Label>
              <Input
                id="e_social" name="nome_social" maxLength={150}
                autoCapitalize="words"
                defaultValue={pessoa.nome_social ?? ""}
                placeholder="Nome de uso, se diferente"
              />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="e_whatsapp">WhatsApp</Label>
              <Input
                id="e_whatsapp" name="whatsapp"
                type="tel" inputMode="tel" autoComplete="tel"
                maxLength={15} placeholder="(11) 99999-9999"
                onInput={(e) => { e.currentTarget.value = maskWhatsApp(e.currentTarget.value); }}
                defaultValue={formatWhatsApp(pessoa.whatsapp)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="e_email">E-mail</Label>
              <Input
                id="e_email"
                name="email"
                type="email"
                defaultValue={pessoa.email}
                disabled={!!pessoa.user_id}
              />
            </div>
          </div>
          {pessoa.user_id && (
            <p className="text-xs text-muted-foreground -mt-2">
              O e-mail é a identidade do link de acesso e não pode mais ser alterado após o primeiro acesso.
            </p>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <CampoNascimento id="e_nasc" defaultValue={pessoa.data_nascimento ?? ""} />
            <CampoGenero defaultValue={pessoa.genero ?? ""} />
          </div>
          <CampoCorRaca defaultValue={pessoa.cor_raca ?? ""} />
        </>
      ),
    },
    {
      titulo: "Localização e interesses",
      conteudo: (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="e_cidade">Cidade</Label>
              <Input id="e_cidade" name="cidade" maxLength={100} defaultValue={pessoa.cidade ?? ""} />
            </div>
            <CampoUf defaultValue={pessoa.uf ?? ""} />
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
              <Label htmlFor="e_cargo">Cargo</Label>
              <Input id="e_cargo" name="cargo" maxLength={120} defaultValue={pessoa.cargo ?? ""} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="e_empresa">Empresa</Label>
              <Input id="e_empresa" name="empresa" maxLength={150} defaultValue={pessoa.empresa ?? ""} />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="e_origem">Como chegou ao programa</Label>
            <Input id="e_origem" name="origem" maxLength={300} defaultValue={pessoa.origem ?? ""} />
          </div>
        </>
      ),
    },
    {
      titulo: "Motivação e pareamento",
      conteudo: (
        <>
          <div className="space-y-2">
            <Label htmlFor="e_motivacao">Motivação</Label>
            <Textarea
              id="e_motivacao" name="motivacao" rows={2} maxLength={2000}
              defaultValue={pessoa.motivacao ?? ""}
              placeholder="O que traz a pessoa ao programa"
            />
          </div>
          <CampoPrefGenero defaultValue={pessoa.pref_genero_par ?? ""} />
        </>
      ),
    },
    {
      // apresentação profissional (0030) — mesmos campos do /perfil; o
      // `areas` do mentor_profile já existe, então o do perfil vai como
      // `areas_perfil` pra não colidir no FormData
      titulo: "Apresentação pública",
      conteudo: (
        <>
          <div className="space-y-2">
            <div className="flex items-baseline justify-between gap-2">
              <Label htmlFor="e_bio">Biografia</Label>
              <span aria-hidden className="text-xs tabular-nums text-muted-foreground">
                {bioLen}/1.000
              </span>
            </div>
            <Textarea
              id="e_bio" name="bio" rows={3} maxLength={1000}
              defaultValue={pessoa.bio ?? ""}
              onChange={(e) => setBioLen(e.target.value.length)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="e_linkedin">LinkedIn</Label>
            <Input
              id="e_linkedin" name="linkedin" type="url" inputMode="url"
              defaultValue={pessoa.linkedin ?? ""}
              placeholder="https://linkedin.com/in/..."
            />
          </div>
          {/* o hidden do TagInput manda JSON — camposApresentacao aceita
              JSON ou vírgula, então os dois formatos continuam valendo */}
          <div className="space-y-2">
            <Label>Áreas de atuação</Label>
            <TagInput
              name="areas_perfil"
              sugestoes={AREAS_SUGESTOES}
              value={areasPerfil}
              onChange={setAreasPerfil}
              inputLabel="Digite uma área e pressione Enter"
            />
          </div>
          <div className="space-y-2">
            <div className="flex items-baseline justify-between gap-2">
              <Label htmlFor="e_voluntariado">Experiência com voluntariado</Label>
              <span aria-hidden className="text-xs tabular-nums text-muted-foreground">
                {volLen}/300
              </span>
            </div>
            <Input
              id="e_voluntariado" name="voluntariado" maxLength={300}
              defaultValue={pessoa.voluntariado ?? ""}
              onChange={(e) => setVolLen(e.target.value.length)}
              placeholder="ex.: 2 anos como voluntário no Projeto X"
            />
          </div>
        </>
      ),
    },
    ...(ehMentor && mp !== undefined
      ? [{
          titulo: "Ficha de mentor",
          conteudo: (
            <div className="space-y-4 rounded-lg bg-muted/40 p-3.5">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="e_cap">Capacidade (duplas)</Label>
                  <Input
                    id="e_cap" name="capacidade" type="number" min={1} max={10}
                    required
                    defaultValue={mp?.capacidade ?? 1}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="e_areas">Áreas (separadas por vírgula)</Label>
                  <Input
                    id="e_areas" name="areas"
                    defaultValue={(mp?.areas ?? []).join(", ")}
                    placeholder="tecnologia, finanças"
                  />
                </div>
              </div>
              <CampoDisponibilidade value={disponibilidade} onChange={setDisponibilidade} />
              <div className="space-y-2">
                <Label htmlFor="e_exp">Experiência prévia como mentor</Label>
                <Textarea
                  id="e_exp" name="experiencia_previa" rows={2} maxLength={2000}
                  defaultValue={mp?.experiencia_previa ?? ""}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="e_form">Formação e certificações externas</Label>
                <Textarea
                  id="e_form" name="formacao_externa" rows={2} maxLength={2000}
                  defaultValue={mp?.formacao_externa ?? ""}
                />
              </div>
              <div className="flex gap-6">
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="checkbox" name="termo_ok" defaultChecked={mp?.termo_ok} className="accent-primary" />
                  Termo assinado
                </label>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="checkbox" name="formacao_ok" defaultChecked={mp?.formacao_ok} className="accent-primary" />
                  Formação concluída
                </label>
              </div>
            </div>
          ),
        }]
      : []),
    {
      titulo: "Documentos (termo de adesão)",
      conteudo: (
        <>
          <DadosCivisFields
            prefix="civis_"
            opcional
            compacto
            defaults={pessoa.dados_civis}
          />
          <p className="text-xs text-muted-foreground">
            Preenchem o termo de adesão automaticamente: a pessoa só confere e assina.
          </p>
        </>
      ),
    },
    {
      titulo: "Arquivos e consentimento",
      conteudo: (
        <>
          <FotoField
            id="e_foto"
            defaultUrl={pessoa.avatar_path ? avatarPublicUrl(pessoa.avatar_path) : null}
          />
          <DocumentoPessoa
            tipo="profile"
            id={pessoa.id}
            documentoPath={pessoa.documento_path}
          />
          <AssinaturasPessoa
            tipo="profile"
            id={pessoa.id}
            nome={pessoa.nome}
            whatsapp={pessoa.whatsapp}
          />
          <CampoConsentimento carimbadoEm={pessoa.consent_lgpd_em} />
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
          <DropdownMenuItem
            disabled={pending}
            onClick={() =>
              start(async () => {
                try {
                  const res = await setPessoaAtivo(pessoa.id, !pessoa.ativo);
                  if (res?.error) toast.error(res.error);
                  else if (res?.pendente) setDuplasEmCurso(res.pendente);
                  else {
                    toast.success(
                      pessoa.ativo
                        ? `Cadastro de ${primeiroNome} desativado. Acesso cortado na hora.`
                        : `Cadastro de ${primeiroNome} reativado. Acesso liberado na hora.`
                    );
                    router.refresh();
                  }
                } catch {
                  toast.error("Sem conexão. Tente de novo.");
                }
              })
            }
          >
            <Prohibit /> {pessoa.ativo ? "Desativar" : "Reativar"}
          </DropdownMenuItem>
          {/* efeito declarado antes do clique — ação reversível mas de alto impacto */}
          <p className="px-2 pb-1 text-[11px] leading-snug text-muted-foreground">
            {pessoa.ativo
              ? "Corta o acesso à plataforma na hora; a pessoa pode ser reativada depois."
              : "Devolve o acesso na hora."}
          </p>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            variant="destructive"
            disabled={!podeExcluir}
            onClick={() => setDelOpen(true)}
          >
            <Trash /> Excluir
          </DropdownMenuItem>
          {!podeExcluir && (
            <p className="px-2 pb-1 text-[11px] leading-snug text-muted-foreground">
              {pessoa.user_id
                ? "Já entrou na plataforma. Desative em vez de excluir."
                : "Tem dupla vinculada. Desative em vez de excluir."}
            </p>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog
        open={editOpen}
        onOpenChange={(o) => {
          setEditOpen(o);
          // contadores e chips acompanham o valor carregado na abertura do dialog
          if (o) {
            setBioLen(pessoa.bio?.length ?? 0);
            setVolLen(pessoa.voluntariado?.length ?? 0);
            setAreasPerfil(pessoa.areas ?? []);
            setInteresses(pessoa.interesses ?? []);
            setDisponibilidade(null);
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
        titulo={`Excluir ${pessoa.nome}?`}
        descricao="Remove o cadastro da plataforma. Só é possível excluir quem nunca entrou e não tem dupla; nos demais casos, desative."
        sucesso={`Cadastro de ${pessoa.nome} excluído.`}
        onConfirm={() => deletePessoa(pessoa.id)}
      />

      {/* confirmação de impacto — desativar mentor/supervisor com duplas em
          andamento deixa elas sem responsável até a coordenação remanejar */}
      <ConfirmDeleteButton
        open={duplasEmCurso > 0}
        onOpenChange={(o) => !o && setDuplasEmCurso(0)}
        titulo={`Desativar ${pessoa.nome}?`}
        descricao={`${primeiroNome} está em ${duplasEmCurso} ${duplasEmCurso === 1 ? "dupla" : "duplas"} em andamento. Desativar corta o acesso e a dupla fica sem o responsável até o remanejo. O histórico e os encontros ficam salvos.`}
        sucesso={`Cadastro de ${primeiroNome} desativado.`}
        acao="Desativar"
        onConfirm={async () => {
          const res = await setPessoaAtivo(pessoa.id, false, true);
          if (!res.error) router.refresh();
          return res;
        }}
      />
    </>
  );
}
