"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChatsCircle } from "@phosphor-icons/react";
import { toast } from "sonner";
import { enviarLembrete, type LembreteDestino } from "@/lib/actions-lembrete";
import { formatDiaMes, LEMBRETE_INTERVALO_MS, waLink } from "@/lib/ciclo";
import { Button } from "@/components/ui/button";

/** "Lembrar" universal (D5): a notificação in-app sai pela RPC
 *  `enviar_lembrete` (cap de 1 lembrete por dupla a cada 48h, qualquer
 *  autor) e o WhatsApp abre junto quando há telefone — a mensagem é a
 *  mesma dos dois lados. Com `bloqueadoAte` no futuro o botão já renderiza
 *  desabilitado ("Lembrada dd/mm"), o mesmo contrato do resto do app:
 *  razão visível + title, nunca click-mudo. */
export function LembreteButton({
  duplaId,
  destino,
  rotulo,
  telefone,
  titulo,
  corpo,
  href,
  bloqueadoAte,
  size = "sm",
}: {
  duplaId: string;
  destino: LembreteDestino;
  /** Texto do botão — "Lembrar", "Lembrar registro", "Lembrar Ana". */
  rotulo: string;
  /** WhatsApp do destinatário; null = só a notificação in-app sai. */
  telefone: string | null;
  /** Título/corpo da notificação — o corpo é também o texto do wa.me. */
  titulo: string;
  corpo: string;
  /** Deep-link da notificação pra quem recebe. */
  href: string;
  /** `lembreteBloqueadoAte()` calculado no server — futuro = cap em curso.
   *  Chega Date (RSC serializa) ou string ISO. */
  bloqueadoAte: Date | string | null;
  size?: "sm" | "default";
}) {
  const [pending, start] = useTransition();
  const router = useRouter();
  // "agora" congelado na montagem — Date.now() solto no render viola pureza
  // (mesma convenção do `agoraMs` do calendário)
  const [agoraMs] = useState(() => Date.now());

  const ate = bloqueadoAte != null ? new Date(bloqueadoAte) : null;
  if (ate && ate.getTime() > agoraMs) {
    // o rótulo diz quando o lembrete FOI (bloqueadoAte − 48h), não quando
    // destrava — "Lembrada 13/10" com a data do desbloqueio mentia
    const enviado = new Date(ate.getTime() - LEMBRETE_INTERVALO_MS);
    return (
      <Button
        variant="outline"
        size={size}
        disabled
        title={`1 lembrete a cada 48h por dupla — destrava ${formatDiaMes(ate.toISOString()).replace(/\/\d{4}$/, "")}`}
      >
        <ChatsCircle size={14} aria-hidden />
        Lembrada {formatDiaMes(enviado.toISOString()).replace(/\/\d{4}$/, "")}
      </Button>
    );
  }

  function onClick() {
    start(async () => {
      try {
        const res = await enviarLembrete(duplaId, destino, {
          titulo,
          corpo,
          href,
        });
        if ("error" in res) {
          toast.error(res.error);
          return;
        }
        if (res.demo) {
          // no demo o número é fictício — a mensagem não abre o wa.me de
          // verdade, só a notificação simulada
          toast.success("Modo demo — nada é enviado de verdade.");
        } else {
          toast.success("Lembrete enviado.");
          const wa = waLink(telefone, corpo);
          if (wa) window.open(wa, "_blank", "noopener,noreferrer");
        }
        router.refresh();
      } catch {
        toast.error("Sem conexão. Tente de novo.");
      }
    });
  }

  return (
    <Button variant="outline" size={size} onClick={onClick} disabled={pending}>
      <ChatsCircle size={14} aria-hidden />
      {pending ? "Enviando…" : rotulo}
    </Button>
  );
}
