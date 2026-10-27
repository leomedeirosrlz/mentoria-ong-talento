"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  ChatsCircle,
  CircleNotch,
  Copy,
  WhatsappLogo,
} from "@phosphor-icons/react";
import { toast } from "sonner";
import { enviarLembrete, type LembreteDestino } from "@/lib/actions-lembrete";
import { formatDiaMes, LEMBRETE_INTERVALO_MS, waLink } from "@/lib/ciclo";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export type NudgeWA = {
  destino: LembreteDestino;
  /** Título da notificação in-app — o corpo é `mensagem`. */
  titulo: string;
  /** Deep-link da notificação pra quem recebe. */
  href: string;
  /** `lembreteBloqueadoAte()` — futuro = cap de 48h em curso. */
  bloqueadoAte: Date | string | null;
  /** Rótulo da primária quando "Lembrar" mente — apoio do jovem vira
   *  "Chamar" (resposta a um pedido, não cobrança; mesma semântica da
   *  fila-acompanhar) e a fila da agenda mantém o caso dominante
   *  ("Lembrar registro"). Continua mandando notificação + wa.me. */
  rotulo?: "Lembrar" | "Lembrar registro" | "Chamar";
};

/** Ação WhatsApp da linha de dupla (REALIZA-255): UMA entrada por card —
 *  o botão abre o texto da mensagem antes de qualquer envio. No preview
 *  moram os dois caminhos distintos, sem botão duplicado:
 *    · "Lembrar pelo app" = só a notificação in-app (`enviar_lembrete`,
 *      cap de 48h por dupla → vira "Lembrada dd/mm" desabilitado), nunca
 *      abre WhatsApp;
 *    · "Abrir WhatsApp" = contato direto wa.me com o mesmo texto (toda
 *      dupla, sem cap — o clique só loga `contato` via /api/nudge).
 *  Sem telefone o wa.me fica desabilitado com o motivo visível; o lembrete
 *  in-app segue (a notificação sai mesmo sem número). */
export function DuplaWaAcao({
  duplaId,
  destNome,
  telefone,
  mensagem,
  nudge,
}: {
  duplaId: string;
  /** Primeiro nome de quem recebe — compõe os aria-labels. */
  destNome: string;
  telefone: string | null | undefined;
  /** Texto pronto — preview, cópia, wa.me e (no Lembrar) a notificação. */
  mensagem: string;
  /** Presente = há pendência apontável (libera o Lembrar in-app); ausente =
   *  contato livre — só WhatsApp/copiar. */
  nudge?: NudgeWA;
}) {
  const [pending, start] = useTransition();
  const [aberto, setAberto] = useState(false);
  const router = useRouter();
  // "agora" congelado na montagem — mesmo contrato do LembreteButton
  const [agoraMs] = useState(() => Date.now());

  const nomeCurto = destNome.split(" ")[0];
  const wa = waLink(telefone, mensagem);
  // "Abrir WhatsApp" loga `contato` — tipo fora do cap de 48h (o cap é dos
  // nudges); sem telefone cai pra null e o item exibe o motivo
  const waContato = wa
    ? `/api/nudge?d=${encodeURIComponent(duplaId)}&to=${encodeURIComponent(wa)}&t=contato`
    : null;

  const ate = nudge?.bloqueadoAte != null ? new Date(nudge.bloqueadoAte) : null;
  const bloqueado = ate != null && ate.getTime() > agoraMs;
  const diaMes = (d: Date) =>
    formatDiaMes(d.toISOString()).replace(/\/\d{4}$/, "");
  const enviadoEm = bloqueado
    ? diaMes(new Date(ate!.getTime() - LEMBRETE_INTERVALO_MS))
    : null;
  const destravaEm = bloqueado ? diaMes(ate!) : null;

  const rotulo = nudge ? (nudge.rotulo ?? "Lembrar") : "Chamar";
  const rotuloPassado = rotulo === "Chamar" ? "Chamada" : "Lembrada";

  function lembrar() {
    if (!nudge) return;
    start(async () => {
      try {
        const res = await enviarLembrete(duplaId, nudge.destino, {
          titulo: nudge.titulo,
          corpo: mensagem,
          href: nudge.href,
        });
        if ("error" in res) {
          toast.error(res.error);
          return;
        }
        // Lembrar é SÓ a notificação in-app (REALIZA-255) — o WhatsApp tem
        // o próprio botão no mesmo preview, nada de canal duplicado
        toast.success(
          res.demo
            ? "Modo demo: nada é enviado de verdade."
            : "Lembrete enviado."
        );
        setAberto(false);
        router.refresh();
      } catch {
        toast.error("Sem conexão. Tente de novo.");
      }
    });
  }

  async function copiar() {
    if (!navigator.clipboard?.writeText) {
      toast.error("Não consegui copiar a mensagem.");
      return;
    }
    try {
      await navigator.clipboard.writeText(mensagem);
      toast.success("Mensagem copiada.");
    } catch {
      toast.error("Não consegui copiar a mensagem.");
    }
  }

  const icone = (
    <WhatsappLogo weight="fill" aria-hidden className="text-[var(--ok-text)]" />
  );

  return (
    <>
      {/* a primária abre o preview — o envio escolhe o canal lá dentro.
          44px no mobile (size icon), rótulo curto no desktop */}
      <Button
        variant="outline"
        size="icon"
        onClick={() => setAberto(true)}
        aria-label={`${rotulo} ${nomeCurto}: ver a mensagem antes de enviar`}
        title={
          waContato
            ? `${rotulo} ${nomeCurto}`
            : `${rotulo} ${nomeCurto} (sem WhatsApp cadastrado)`
        }
        className={cn(
          "md:w-auto md:px-3",
          !waContato && !nudge && "opacity-50"
        )}
      >
        {icone}
        <span className="hidden md:inline">{rotulo}</span>
      </Button>

      {/* o texto antes do envio — a escolha do canal mora aqui, não num
          menu separado: Lembrar é só app, WhatsApp é só wa.me */}
      <Dialog open={aberto} onOpenChange={setAberto}>
        <DialogContent size="md">
          <DialogHeader>
            <DialogTitle>
              {nudge ? `${rotulo} ${nomeCurto}` : `Mensagem pra ${nomeCurto}`}
            </DialogTitle>
            <DialogDescription>
              O mesmo texto pros dois canais — escolhe onde sai.
            </DialogDescription>
          </DialogHeader>
          <p className="whitespace-pre-wrap rounded-lg bg-muted px-3 py-2.5 text-sm leading-relaxed">
            {mensagem}
          </p>
          <DialogFooter>
            <Button variant="ghost" onClick={copiar}>
              <Copy aria-hidden />
              Copiar texto
            </Button>
            {nudge &&
              (bloqueado ? (
                <Button
                  variant="outline"
                  disabled
                  title={`1 lembrete a cada 48h por dupla. Destrava ${destravaEm}`}
                >
                  <ChatsCircle aria-hidden />
                  {rotuloPassado} {enviadoEm}
                </Button>
              ) : (
                <Button
                  variant="outline"
                  onClick={lembrar}
                  disabled={pending}
                  title="Só a notificação dentro do app — não abre WhatsApp"
                >
                  {pending ? (
                    <CircleNotch className="animate-spin" aria-hidden />
                  ) : (
                    <ChatsCircle aria-hidden />
                  )}
                  {pending ? "Enviando…" : "Lembrar pelo app"}
                </Button>
              ))}
            {waContato ? (
              <Button
                render={
                  <a
                    href={waContato}
                    target="_blank"
                    rel="noopener noreferrer"
                  />
                }
              >
                <WhatsappLogo weight="fill" aria-hidden />
                Abrir WhatsApp
              </Button>
            ) : (
              <Button variant="outline" disabled title="Sem WhatsApp cadastrado">
                <WhatsappLogo aria-hidden />
                Sem WhatsApp cadastrado
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
