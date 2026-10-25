"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CircleNotch, Link as LinkIcon } from "@phosphor-icons/react";
import {
  desativarLinkIntake,
  gerarLinkIntake,
} from "@/lib/forms/actions";
import type { LinkResolvido } from "@/lib/forms/queries";
import { CopiarLink } from "@/components/forms/copiar-link";
import { urlPublica } from "@/components/forms/link-shared";
import { useOrigem } from "@/components/forms/use-origem";
import { ConfirmDeleteButton } from "@/components/confirm-delete-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

// Seção "Link de inscrição" (REALIZA-70): os forms oficiais de intake não
// usam o fluxo de links individuais — UM link multi_uso aceita inscrições
// anônimas até a coordenação desativar. O card mostra o endereço, o
// estado e a contagem de candidatos; desativar mata o token na hora
// (expira_em=now()), e gerar de novo cria um endereço novo.

export function IntakeLinkSection({
  formularioId,
  formularioAtivo,
  links,
}: {
  formularioId: string;
  formularioAtivo: boolean;
  links: LinkResolvido[];
}) {
  const [pending, start] = useTransition();
  const router = useRouter();
  const origem = useOrigem();
  // "agora" congelado na montagem — Date.now() solto no render viola
  // pureza; a régua do estado do link é a de quando a tela abriu
  const [agoraMs] = useState(() => Date.now());
  const intake = links.find((l) => l.origem === "intake" && l.multi_uso);
  const ativo = intake
    ? !intake.expira_em || new Date(intake.expira_em).getTime() > agoraMs
    : false;
  const nRespostas = intake?.respostas.length ?? 0;

  return (
    <div className="space-y-3">
      {intake && ativo ? (
        <div className="rounded-xl bg-card p-4 shadow-[var(--shadow-border)] sm:p-5">
          <div className="flex flex-wrap items-center gap-2">
            <Badge className="bg-[var(--ok)]/15 text-[var(--ok-text)]">
              Recebendo inscrições
            </Badge>
            <Badge variant="secondary">
              {nRespostas}{" "}
              {nRespostas === 1 ? "inscrição recebida" : "inscrições recebidas"}
            </Badge>
            {!formularioAtivo && (
              <Badge variant="secondary">formulário encerrado</Badge>
            )}
          </div>
          {/* o endereço completo em texto — é a URL que vai pro e-mail,
              WhatsApp e Instagram da campanha */}
          <p className="mt-3 break-all rounded-lg bg-muted px-3 py-2 font-mono text-xs leading-relaxed">
            {urlPublica(intake.token, origem)}
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <CopiarLink token={intake.token} />
            <ConfirmDeleteButton
              titulo="Desativar o link de inscrição?"
              descricao="O endereço deixa de aceitar inscrições na hora. Quem abrir vê “link expirado”. As respostas já recebidas ficam salvas. Gerar de novo cria um endereço diferente (o antigo não volta)."
              acao="Desativar"
              sucesso="Link de inscrição desativado."
              onConfirm={() => desativarLinkIntake(intake.id, formularioId)}
              trigger={
                <Button variant="outline" size="sm">
                  Desativar link
                </Button>
              }
            />
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-border p-5 text-center">
          <p className="mx-auto max-w-md text-sm leading-relaxed text-muted-foreground">
            {intake
              ? "O link de inscrição está desativado. Ninguém se inscreve por ele agora."
              : "Nenhum link de inscrição ainda. Ele é um endereço público único que aceita várias inscrições anônimas."}
          </p>
          <Button
            className="mt-3"
            size="sm"
            disabled={pending}
            onClick={() =>
              start(async () => {
                const r = await gerarLinkIntake(formularioId);
                if (r.error) {
                  toast.error(r.error);
                  return;
                }
                try {
                  await navigator.clipboard.writeText(urlPublica(r.token!));
                  toast.success("Link de inscrição gerado e copiado.");
                } catch {
                  toast.success("Link de inscrição gerado. Copie abaixo.");
                }
                router.refresh();
              })
            }
          >
            {pending ? (
              <CircleNotch className="animate-spin" aria-hidden />
            ) : (
              <LinkIcon aria-hidden />
            )}
            {intake ? "Gerar novo link de inscrição" : "Gerar link de inscrição"}
          </Button>
        </div>
      )}
      {/* contexto pra quem opera: diferente dos links individuais, este é
          pra divulgação — cada inscrição vira uma linha na fila abaixo */}
      <p className="text-xs leading-relaxed text-muted-foreground">
        Um só endereço, várias respostas: cada envio vira uma inscrição na
        seção Respostas. Links individuais pra pessoas cadastradas seguem
        existindo em outros formulários.
      </p>
    </div>
  );
}
