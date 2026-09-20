"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { DotsThree, PencilSimple, Prohibit, Trash } from "@phosphor-icons/react";
import { toast } from "sonner";
import { deletePessoa, setPessoaAtivo, updatePessoa } from "@/lib/actions";
import { createClient } from "@/lib/supabase/client";
import { avatarPublicUrl } from "@/lib/avatar";
import { FotoField } from "@/components/foto-field";
import type { Profile } from "@/lib/types";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type MentorProfile = {
  capacidade: number;
  areas: string[];
  termo_ok: boolean;
  formacao_ok: boolean;
} | null;

export function PessoaActions({ pessoa, podeExcluir }: { pessoa: Profile; podeExcluir: boolean }) {
  const [editOpen, setEditOpen] = useState(false);
  const [delOpen, setDelOpen] = useState(false);
  const [mp, setMp] = useState<MentorProfile | undefined>(undefined);
  const [pending, start] = useTransition();
  const router = useRouter();
  const ehMentor = pessoa.role === "mentor_dpp" || pessoa.role === "mentor_especialista";
  const primeiroNome = pessoa.nome.split(" ")[0];

  useEffect(() => {
    if (!editOpen || !ehMentor) return;
    createClient()
      .from("mentor_profiles")
      .select("capacidade, areas, termo_ok, formacao_ok")
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
        toast.error("Sem conexão — tente de novo.");
      }
    });
  }

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
                  else {
                    toast.success(
                      pessoa.ativo
                        ? `Cadastro de ${primeiroNome} desativado — acesso cortado na hora.`
                        : `Cadastro de ${primeiroNome} reativado — acesso liberado na hora.`
                    );
                    router.refresh();
                  }
                } catch {
                  toast.error("Sem conexão — tente de novo.");
                }
              })
            }
          >
            <Prohibit /> {pessoa.ativo ? "Desativar" : "Reativar"}
          </DropdownMenuItem>
          {/* efeito declarado antes do clique — ação reversível mas de alto impacto */}
          <p className="px-2 pb-1 text-[11px] leading-snug text-muted-foreground">
            {pessoa.ativo
              ? "Corta o acesso à plataforma na hora; dá pra reativar depois."
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

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Editar {primeiroNome}</DialogTitle>
          </DialogHeader>
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="e_nome">Nome</Label>
              <Input id="e_nome" name="nome" required defaultValue={pessoa.nome} />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="e_whatsapp">WhatsApp</Label>
                <Input
                  id="e_whatsapp" name="whatsapp"
                  type="tel" inputMode="tel" autoComplete="tel"
                  defaultValue={pessoa.whatsapp ?? ""}
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

            {ehMentor && mp !== undefined && (
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
            )}

            <FotoField
              id="e_foto"
              defaultUrl={pessoa.avatar_path ? avatarPublicUrl(pessoa.avatar_path) : null}
            />

            <DocumentoPessoa
              tipo="profile"
              id={pessoa.id}
              documentoPath={pessoa.documento_path}
            />

            <Button type="submit" className="w-full" disabled={pending}>
              {pending ? "Salvando..." : "Salvar"}
            </Button>
          </form>
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
    </>
  );
}
