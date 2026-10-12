"use client";

import { SignOut } from "@phosphor-icons/react";
import { signOut } from "@/lib/actions";
import { CampoInteresses, CampoUf } from "@/components/campos-pessoais";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatWhatsApp } from "@/lib/ciclo";
import { maskWhatsApp } from "@/lib/utils";
import {
  BotaoLapis,
  ChipsTags,
  ContaLinha,
  DialogoEmail,
  DialogoSenha,
  FormSecao,
  Linha,
} from "@/app/(app)/perfil/perfil-form";
import { useState } from "react";
import type { Profile } from "@/lib/types";

/** Perfil do jovem no desenho do /perfil de staff — mesmos primitivos
 *  (Linha, lápis→Dialog, ContaLinha): a diferença honesta é o escopo —
 *  o que ele edita é contato/nome de uso/cidade/interesses (profiles é o
 *  canônico), a ficha do programa é leitura mantida pela coordenação. */
function DialogoDados({ me }: { me: Profile }) {
  const [open, setOpen] = useState(false);
  const [interesses, setInteresses] = useState<string[]>(me.interesses ?? []);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <BotaoLapis label="Editar seus dados" className="-mr-1.5 -my-1.5" />
        }
      />
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Seus dados</DialogTitle>
          <DialogDescription>
            É daqui que seu mentor e a coordenação falam com você — cidade e
            interesses também aparecem pros colegas da turma em Pessoas.
          </DialogDescription>
        </DialogHeader>
        <FormSecao aoSalvar={() => setOpen(false)}>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="jf-nome-social">Como quer ser chamado(a)</Label>
              <Input
                id="jf-nome-social"
                name="nome_social"
                maxLength={150}
                defaultValue={me.nome_social ?? ""}
                placeholder="Apelido ou nome social"
                autoComplete="nickname"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="jf-whatsapp">Seu WhatsApp</Label>
              <Input
                id="jf-whatsapp"
                name="whatsapp"
                inputMode="tel"
                autoComplete="tel"
                maxLength={15}
                defaultValue={formatWhatsApp(me.whatsapp)}
                onInput={(e) => {
                  e.currentTarget.value = maskWhatsApp(e.currentTarget.value);
                }}
                placeholder="(11) 91234-5678"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="jf-cidade">Cidade</Label>
              <Input
                id="jf-cidade"
                name="cidade"
                maxLength={100}
                defaultValue={me.cidade ?? ""}
                autoComplete="address-level2"
              />
            </div>
            <CampoUf defaultValue={me.uf ?? ""} />
          </div>
          <CampoInteresses value={interesses} onChange={setInteresses} />
        </FormSecao>
      </DialogContent>
    </Dialog>
  );
}

/** Corpo do /jovem/perfil — as duas seções que são dele: "Seus dados"
 *  (preview + edição por Dialog, o gesto da ficha de staff) e "Conta"
 *  (e-mail, senha e saída — as mesmas linhas do perfil de todo mundo). */
export function JovemPerfilForm({ me }: { me: Profile }) {
  return (
    <>
      <section className="rounded-xl bg-card p-6 shadow-[var(--shadow-border)]">
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <h2 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              Seus dados
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              É daqui que seu mentor e a coordenação falam com você.
            </p>
          </div>
          <DialogoDados me={me} />
        </div>
        <dl className="mt-4 space-y-4">
          <Linha
            rotulo="Nome social"
            valor={me.nome_social?.trim() || "—"}
          />
          <Linha rotulo="WhatsApp" valor={formatWhatsApp(me.whatsapp) || "—"} />
          <div className="grid gap-4 sm:grid-cols-3">
            <Linha
              rotulo="Cidade"
              valor={me.cidade?.trim() || "—"}
              className="sm:col-span-2"
            />
            <Linha rotulo="UF" valor={me.uf?.trim() || "—"} />
          </div>
          <Linha
            rotulo="Interesses"
            valor={
              me.interesses?.length ? (
                <ChipsTags itens={me.interesses} />
              ) : (
                "—"
              )
            }
          />
        </dl>
      </section>

      {/* conta — as mesmas linhas de credencial do perfil de staff:
          e-mail, senha e saída, cada uma abrindo seu Dialog/form real */}
      <section className="rounded-xl bg-card shadow-[var(--shadow-border)]">
        <h2 className="px-6 pt-5 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          Conta
        </h2>
        <ContaLinha
          titulo="E-mail"
          descricao={me.email}
          acao={<DialogoEmail email={me.email} />}
        />
        <ContaLinha
          titulo="Senha"
          descricao="O link de e-mail continua valendo mesmo com senha definida."
          acao={<DialogoSenha email={me.email} />}
          borda
        />
        <ContaLinha
          titulo="Sessão"
          descricao="Encerra o acesso da sua conta neste dispositivo."
          acao={
            <Button
              type="submit"
              form="form-sair"
              variant="outline"
              size="sm"
            >
              <SignOut size={15} aria-hidden />
              Sair
            </Button>
          }
          borda
        />
      </section>

      {/* o Sair usa um form real com server action; o botão se liga por
          form= pra não precisar de estado */}
      <form id="form-sair" action={signOut} className="hidden" />
    </>
  );
}

