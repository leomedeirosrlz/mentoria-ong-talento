"use client";

import { CampoDisponibilidade, CampoInteresses, CampoUf } from "@/components/campos-pessoais";
import { SignOutButton } from "@/components/signout-button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { disponibilidadeTexto, disponibilidadeVazia, formatWhatsApp } from "@/lib/ciclo";
import { maskWhatsApp } from "@/lib/utils";
import { salvarDisponibilidadeJovem } from "@/lib/actions-jovem";
import {
  BotaoLapis,
  ChipsTags,
  ContaLinha,
  DialogoEmail,
  DialogoSenha,
  FormSecao,
  Linha,
} from "@/app/(app)/perfil/perfil-form";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import type { Disponibilidade, Profile } from "@/lib/types";

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

/** "Seus dados" — o análogo do "Perfil público" de staff: preview em
 *  <dl> sempre visível e edição no Dialog do lápis, nunca inline. */
export function DadosSecao({ me }: { me: Profile }) {
  return (
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
        <Linha rotulo="Nome social" valor={me.nome_social?.trim() || "—"} />
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
            me.interesses?.length ? <ChipsTags itens={me.interesses} /> : "—"
          }
        />
      </dl>
    </section>
  );
}

/** Corpo do Dialog da grade — estado próprio (remonta a cada abertura, o
 *  rascunho descartado não vaza) e Salvar que chama a RPC do jovem: a
 *  escrita é em mentorados, não em profiles — por isso não usa FormSecao
 *  (que posta pro updateMeuPerfil). */
function FormDisponibilidade({
  grade,
  aoSalvar,
}: {
  grade: Disponibilidade | null;
  aoSalvar: () => void;
}) {
  const router = useRouter();
  const [disp, setDisp] = useState<Disponibilidade | null>(grade);
  const [pending, start] = useTransition();

  function salvar() {
    start(async () => {
      try {
        const res = await salvarDisponibilidadeJovem(disp);
        if ("error" in res) {
          toast.error(res.error);
          return;
        }
        toast.success("Disponibilidade salva.");
        aoSalvar();
        router.refresh();
      } catch {
        toast.error("Sem conexão. Tente de novo.");
      }
    });
  }

  return (
    <div className="space-y-4">
      <CampoDisponibilidade value={disp} onChange={setDisp} />
      <Button
        type="button"
        className="w-full"
        onClick={salvar}
        disabled={pending}
      >
        {pending ? "Salvando…" : "Salvar"}
      </Button>
    </div>
  );
}

/** "Sua disponibilidade" (REALIZA-114) — o campo que o primeiro acesso
 *  coleta e o lembrete da home aponta. Preview em <dl> sempre visível +
 *  edição no Dialog do lápis, mesmo molde do "Seus dados"; grade vazia
 *  marca o chip "pendente" em vez de esconder a linha. */
export function DisponibilidadeCard({
  grade,
}: {
  grade: Disponibilidade | null;
}) {
  const [open, setOpen] = useState(false);
  const vazia = disponibilidadeVazia(grade);

  return (
    <section className="rounded-xl bg-card p-6 shadow-[var(--shadow-border)]">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            Sua disponibilidade
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Os dias e períodos que costumam ser livres pra você — a agenda
            do seu mentor cruza com eles pra marcar os encontros.
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger
            render={
              <BotaoLapis
                label="Editar sua disponibilidade"
                className="-mr-1.5 -my-1.5"
              />
            }
          />
          <DialogContent className="sm:max-w-xl">
            <DialogHeader>
              <DialogTitle>Sua disponibilidade</DialogTitle>
              <DialogDescription>
                Toque nos dias e períodos em que costuma ter tempo livre.
                Com a sua grade e a do seu mentor, a agenda acha horários
                em comum pros encontros.
              </DialogDescription>
            </DialogHeader>
            <FormDisponibilidade grade={grade} aoSalvar={() => setOpen(false)} />
          </DialogContent>
        </Dialog>
      </div>
      <dl className="mt-4 space-y-4">
        <Linha
          rotulo="Dias e períodos livres"
          valor={disponibilidadeTexto(grade) ?? "—"}
          pendente={vazia}
        />
      </dl>
    </section>
  );
}

/** "Conta" — as mesmas linhas de credencial do perfil de staff:
 *  e-mail, senha e saída, cada uma abrindo seu Dialog/form real. */
export function ContaSecao({ me }: { me: Profile }) {
  return (
    <>
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
            <SignOutButton
              variant="outline"
              size="sm"
              iconSize={15}
              formClassName="contents"
            />
          }
          borda
        />
      </section>
    </>
  );
}

