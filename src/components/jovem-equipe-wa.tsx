"use client";

import { WhatsappLogo } from "@phosphor-icons/react";
import { avatarPublicUrl } from "@/lib/avatar";
import { waLink } from "@/lib/ciclo";
import type { JovemContato } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Avatar } from "@/components/avatar";
import { buttonVariants } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

/** "Falar com a equipe" do jovem: o canal direto com a coordenação. Cada
 *  membro ativo aparece com o próprio WhatsApp — não há grupo único do
 *  programa, então a pessoa escolhe com quem abrir a conversa. Quem não
 *  tem número cadastrado aparece sem o botão (a linha dela vale pra
 *  mostrar que a equipe existe). */
export function EquipeWaDialog({
  trigger,
  equipe,
  nomeJovem,
}: {
  /** Elemento do trigger — cada ponto da UI escolhe a aparência. */
  trigger: React.ReactElement;
  /** Contatos com papel coordenação (jovem_contatos) — já filtrados. */
  equipe: JovemContato[];
  /** Primeiro nome do mentorado — assina a mensagem pré-preenchida. */
  nomeJovem: string;
}) {
  const comWa = equipe.filter((c) => waLink(c.whatsapp, ""));
  return (
    <Dialog>
      <DialogTrigger render={trigger} />
      <DialogContent size="sm" className="gap-3">
        <DialogHeader>
          <DialogTitle>Falar com a equipe</DialogTitle>
          <DialogDescription>
            Escolha com quem conversar no WhatsApp — a mensagem já sai com a
            sua apresentação.
          </DialogDescription>
        </DialogHeader>
        <ul className="divide-y divide-border/60">
          {equipe.map((c) => {
            const nome = c.nome_social || c.nome || "Equipe";
            const wa = waLink(
              c.whatsapp,
              `Olá! Sou ${nomeJovem}, mentorado(a) do programa Realiza.vc.`
            );
            return (
              <li key={c.id ?? nome} className="flex items-center gap-2 py-2">
                <Avatar
                  nome={nome}
                  src={c.avatar_path ? avatarPublicUrl(c.avatar_path) : null}
                  size={32}
                />
                <p className="min-w-0 flex-1 text-sm">
                  <span className="font-medium">{nome}</span>
                  <span className="text-muted-foreground">
                    {" "}
                    · Coordenação
                  </span>
                </p>
                {wa && (
                  <a
                    href={wa}
                    target="_blank"
                    rel="noopener noreferrer"
                    title="Conversar no WhatsApp"
                    aria-label={`Conversar com ${nome} no WhatsApp (abre em nova aba)`}
                    className={cn(
                      buttonVariants({ variant: "outline", size: "icon" }),
                      "shrink-0"
                    )}
                  >
                    <WhatsappLogo size={18} aria-hidden />
                  </a>
                )}
              </li>
            );
          })}
        </ul>
        {!comWa.length && (
          <p className="text-sm text-muted-foreground">
            A equipe ainda não tem WhatsApp cadastrado — registre sua dúvida
            em Precisa de ajuda e a coordenação responde pela plataforma.
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}
