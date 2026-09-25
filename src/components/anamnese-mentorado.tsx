"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Check,
  CircleNotch,
  CopySimple,
  ClipboardText,
  PaperPlaneTilt,
} from "@phosphor-icons/react";
import { toast } from "sonner";
import { enviarAnamneseMentorado } from "@/lib/actions-formularios";
import { formatDiaMes } from "@/lib/ciclo";
import { NudgeButton } from "@/components/nudge-button";
import { urlPublica } from "@/components/forms/link-shared";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { AnamneseMentorado } from "@/lib/forms/queries";

/** Bloco "Anamnese Social" da ficha do mentorado — instrumento oficial
 *  (sistema='anamnese', 0042) que o(a) jovem responde sem login pelo link
 *  /f/<token>. Três estados: respondida (data + atalho pras respostas), link
 *  vigente pendente (o botão reenvia o mesmo token) e nunca enviada. */
export function AnamneseMentoradoChip({
  mentoradoId,
  nome,
  whatsapp,
  anamnese,
}: {
  mentoradoId: string;
  nome: string;
  whatsapp: string | null;
  anamnese: AnamneseMentorado;
}) {
  const [token, setToken] = useState<string | null>(null);
  const [reutilizado, setReutilizado] = useState(false);
  const [pending, start] = useTransition();
  const router = useRouter();
  const primeiroNome = nome.split(" ")[0];

  function enviar() {
    start(async () => {
      try {
        const r = await enviarAnamneseMentorado(mentoradoId);
        if ("error" in r) {
          toast.error(r.error);
          return;
        }
        setReutilizado(r.reutilizado);
        setToken(r.token);
        // link pendente agora existe — o chip passa a dizer isso no refresh
        router.refresh();
      } catch {
        toast.error("Sem conexão. Tente de novo.");
      }
    });
  }

  async function copiar() {
    if (!token) return;
    try {
      await navigator.clipboard.writeText(urlPublica(token));
      toast.success("Link copiado.");
    } catch {
      toast.error("Não consegui copiar. Selecione o link manualmente.");
    }
  }

  if (anamnese.respondida_em) {
    return (
      <div className="mt-4 border-t border-border pt-3">
        <h3 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          Anamnese Social
        </h3>
        <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
          <Check size={13} weight="bold" aria-hidden className="text-[var(--ok-text)]" />
          Respondida em {formatDiaMes(anamnese.respondida_em)} ·{" "}
          <Link
            href={`/formularios/${anamnese.formularioId}`}
            className="-my-2 inline-flex min-h-11 items-center underline underline-offset-2 transition-colors hover:text-foreground sm:my-0 sm:min-h-0"
          >
            ver respostas
          </Link>
        </p>
      </div>
    );
  }

  return (
    <div className="mt-4 border-t border-border pt-3">
      <h3 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
        Anamnese Social
      </h3>
      <p className="mt-2 text-xs text-muted-foreground">
        {anamnese.linkPendente
          ? "Já existe um link válido esperando resposta. O botão devolve o mesmo."
          : "A ficha de conhecimento do(a) jovem ainda não foi enviada."}
      </p>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="mt-2"
        onClick={enviar}
        disabled={pending}
      >
        {pending ? (
          <CircleNotch className="animate-spin" aria-hidden />
        ) : (
          <PaperPlaneTilt aria-hidden />
        )}
        {anamnese.linkPendente ? "Ver link da anamnese" : "Enviar anamnese"}
      </Button>

      <Dialog open={!!token} onOpenChange={(o) => !o && setToken(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Anamnese pra {primeiroNome}</DialogTitle>
            <DialogDescription>
              {reutilizado
                ? "Esse link já estava gerado. Segue válido, é só reenviar."
                : "Link único e de uso único. A resposta fica vinculada a essa ficha."}
            </DialogDescription>
          </DialogHeader>
          {token && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 rounded-lg border border-border px-3 py-2.5">
                <ClipboardText size={15} aria-hidden className="shrink-0 text-muted-foreground" />
                <p className="min-w-0 flex-1 truncate font-mono text-xs text-muted-foreground">
                  /f/{token.slice(0, 14)}…
                </p>
                <Button type="button" variant="outline" size="sm" onClick={copiar}>
                  <CopySimple aria-hidden />
                  Copiar
                </Button>
              </div>
              <NudgeButton
                telefone={whatsapp}
                mensagem={`Olá, ${primeiroNome}! A equipe Realiza.vc te convida pra responder a Anamnese Social. Leva poucos minutos e ajuda a gente a te conhecer antes da mentoria: ${urlPublica(token)}`}
                label="Enviar no WhatsApp"
              />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
