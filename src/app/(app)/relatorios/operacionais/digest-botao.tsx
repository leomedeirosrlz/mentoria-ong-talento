"use client";

import { useState, useTransition } from "react";
import { PaperPlaneTilt } from "@phosphor-icons/react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { enviarDigestSemanal } from "@/lib/actions-email";

/** Disparo manual do digest semanal — mesmo conteúdo do cron de segunda,
 *  sem o dedup (o clique é a intenção). Feedback inline: o retorno da
 *  action traz enviados/destinatários ou o erro honesto. */
export function DigestBotao() {
  const [msg, setMsg] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function disparar() {
    setMsg(null);
    setErro(null);
    startTransition(async () => {
      const r = await enviarDigestSemanal();
      if (r.error) {
        setErro(r.error);
      } else {
        setMsg(
          r.destinatarios
            ? `Enviado para ${r.enviados ?? 0} de ${r.destinatarios} da coordenação.`
            : "Nenhum e-mail de coordenação cadastrado — nada enviado."
        );
      }
    });
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={disparar}
        disabled={pending}
        className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
      >
        <PaperPlaneTilt aria-hidden />
        {pending ? "Enviando…" : "Enviar digest agora"}
      </button>
      {msg && <p className="text-xs text-muted-foreground">{msg}</p>}
      {erro && <p className="text-xs text-[var(--danger-text)]">{erro}</p>}
    </div>
  );
}
