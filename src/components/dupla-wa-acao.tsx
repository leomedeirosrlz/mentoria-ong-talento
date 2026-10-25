"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowSquareOut,
  CaretDown,
  ChatsCircle,
  Copy,
  Eye,
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
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/* Verde WhatsApp (#25D366) — cor de marca, não do sistema (decisão consciente
 *  do plano v6a). As variantes suaves seguem os tons do mock. */
const WA_SOFT =
  "border-[hsl(151_55%_40%/0.38)] bg-[hsl(151_60%_42%/0.12)] text-[hsl(151_68%_25%)] hover:bg-[hsl(151_60%_42%/0.2)]";
const WA_SOLID =
  "border border-[hsl(151_60%_32%/0.45)] bg-[#25D366] text-white hover:bg-[#1fb856]";

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
   *  fila-acompanhar). Continua mandando notificação + wa.me. */
  rotulo?: "Lembrar" | "Chamar";
};

/** Ação WhatsApp da linha de dupla (v6a): sempre visível, com a distinção
 *  semântica travada —
 *    · "Chamar" = contato direto wa.me (toda dupla; sem sino, sem cap — o
 *      clique só loga `contato` via /api/nudge)
 *    · "Lembrar" = nudge real (`enviar_lembrete`: notificação in-app + abre
 *      o wa.me com o mesmo texto) — só onde há pendência apontável em dupla
 *      ativa; o cap de 48h por dupla vira "Lembrada dd/mm" desabilitado.
 *  Desktop: split [ação | ▾]. Mobile: quadrado verde 44px cujo menu carrega
 *  a ação como 1º item. O ▾ abre wa.me / copiar / ver texto — a mensagem é
 *  a mesma nas três saídas. Sem telefone: o wa.me fica desabilitado com o
 *  motivo visível; o "Lembrar" segue (a notificação sai mesmo sem wa.me). */
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
  /** Texto pronto — wa.me, cópia, "ver texto" e (no Lembrar) a notificação. */
  mensagem: string;
  /** Presente = modo Lembrar; ausente = modo Chamar (contato livre). */
  nudge?: NudgeWA;
}) {
  const [pending, start] = useTransition();
  const [verTexto, setVerTexto] = useState(false);
  const router = useRouter();
  // "agora" congelado na montagem — mesmo contrato do LembreteButton
  const [agoraMs] = useState(() => Date.now());

  const nomeCurto = destNome.split(" ")[0];
  const wa = waLink(telefone, mensagem);
  // "Abrir wa.me" pelo menu e o "Chamar" logam `contato` — tipo fora do cap
  // de 48h (o cap é dos nudges); sem telefone cai pra null e o item exibe o
  // motivo ("sem WhatsApp cadastrado")
  const waContato = wa
    ? `/api/nudge?d=${encodeURIComponent(duplaId)}&to=${encodeURIComponent(wa)}&t=contato`
    : null;

  const ate = nudge?.bloqueadoAte != null ? new Date(nudge.bloqueadoAte) : null;
  const bloqueado = ate != null && ate.getTime() > agoraMs;
  // a data no rótulo é a do envio (bloqueadoAte − 48h), não a do desbloqueio
  // — "Lembrada 13/10" com a data do desbloqueio mentiria (LembreteButton)
  const diaMes = (d: Date) =>
    formatDiaMes(d.toISOString()).replace(/\/\d{4}$/, "");
  const enviadoEm = bloqueado ? diaMes(new Date(ate.getTime() - LEMBRETE_INTERVALO_MS)) : null;
  const destravaEm = bloqueado ? diaMes(ate) : null;

  const rotulo = nudge ? (nudge.rotulo ?? "Lembrar") : "Chamar";
  // particípio do estado bloqueado pelo cap — "Lembrada 13/10" / "Chamada
  // 13/10" (a dupla foi lembrada/chamada naquela data)
  const rotuloPassado = rotulo === "Chamar" ? "Chamada" : "Lembrada";
  const rotuloLongo = nudge
    ? `${rotulo} ${nomeCurto}: notificação + WhatsApp`
    : `Chamar ${nomeCurto} no WhatsApp`;

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
        if (res.demo) {
          // no demo o número é fictício — a mensagem não abre o wa.me de
          // verdade, só a notificação simulada
          toast.success("Modo demo: nada é enviado de verdade.");
        } else {
          toast.success("Lembrete enviado.");
          if (wa) window.open(wa, "_blank", "noopener,noreferrer");
        }
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

  /** Os itens do menu — `comPrimaria` injeta a ação principal como 1º item
   *  (menu do quadrado verde no mobile: a ação mora aqui dentro). */
  function itensMenu(comPrimaria: boolean) {
    return (
      <>
        {/* o estado do cap aparece no topo de QUALQUER menu — no mobile é
            onde a primária mora; no desktop o split já a mostra, mas o
            item desabilitado explica o "Lembrada" também dentro do ▾ */}
        {nudge && bloqueado && (
          <DropdownMenuItem disabled>
            <ChatsCircle data-icon="inline-start" aria-hidden />
            {rotuloPassado} {enviadoEm}
            <span className="ml-auto pl-3 text-xs text-muted-foreground">
              1 a cada 48h
            </span>
          </DropdownMenuItem>
        )}
        {comPrimaria &&
          !bloqueado &&
          (nudge ? (
            <DropdownMenuItem disabled={pending} onClick={lembrar}>
              <WhatsappLogo data-icon="inline-start" aria-hidden />
              {pending ? "Enviando…" : `${rotulo} ${nomeCurto}`}
              {!wa && (
                <span className="ml-auto pl-3 text-xs text-muted-foreground">
                  só notificação
                </span>
              )}
            </DropdownMenuItem>
          ) : waContato ? (
            <DropdownMenuItem
              render={
                <a href={waContato} target="_blank" rel="noopener noreferrer" />
              }
            >
              <WhatsappLogo data-icon="inline-start" aria-hidden />
              {rotuloLongo}
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem disabled>
              <WhatsappLogo data-icon="inline-start" aria-hidden />
              {rotuloLongo}
              <span className="ml-auto pl-3 text-xs text-muted-foreground">
                sem WhatsApp cadastrado
              </span>
            </DropdownMenuItem>
          ))}
        {waContato ? (
          <DropdownMenuItem
            render={
              <a href={waContato} target="_blank" rel="noopener noreferrer" />
            }
          >
            <ArrowSquareOut data-icon="inline-start" aria-hidden />
            Abrir wa.me com a mensagem
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem disabled>
            <ArrowSquareOut data-icon="inline-start" aria-hidden />
            Abrir wa.me com a mensagem
            <span className="ml-auto pl-3 text-xs text-muted-foreground">
              sem WhatsApp cadastrado
            </span>
          </DropdownMenuItem>
        )}
        <DropdownMenuItem onClick={copiar}>
          <Copy data-icon="inline-start" aria-hidden />
          Copiar mensagem
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setVerTexto(true)}>
          <Eye data-icon="inline-start" aria-hidden />
          Ver texto da mensagem
        </DropdownMenuItem>
        {nudge && (
          <div className="mt-1 border-t border-border px-1.5 pt-1.5 pb-0.5 text-[11px] leading-snug text-muted-foreground">
            <b className="font-semibold text-foreground">{rotulo}</b> envia a
            notificação no app e abre a conversa. No máx. 1 a cada 48h por
            dupla.
          </div>
        )}
      </>
    );
  }

  const menuCls = "w-60";

  return (
    <>
      <span className="inline-flex items-stretch">
        {/* ── desktop (≥sm): split [primária | ▾] ─────────────────── */}
        <span className="hidden md:inline-flex">
          {bloqueado ? (
            <span
              aria-disabled="true"
              title={`1 lembrete a cada 48h por dupla. Destrava ${destravaEm}`}
              className="inline-flex h-7 cursor-not-allowed items-center gap-1 rounded-l-lg border border-dashed border-border bg-card px-2 text-xs font-semibold text-muted-foreground/60"
            >
              <ChatsCircle size={13} aria-hidden />
              {rotuloPassado} {enviadoEm}
            </span>
          ) : nudge ? (
            <button
              type="button"
              onClick={lembrar}
              disabled={pending}
              aria-label={rotuloLongo}
              // sem telefone o Lembrar sai mesmo assim — como notificação
              // pura; o menu já diz "só notificação" e a primária explica
              // por quê (sem WhatsApp cadastrado)
              title={
                wa
                  ? rotuloLongo
                  : `${rotulo} ${nomeCurto}: só notificação (sem WhatsApp cadastrado)`
              }
              className={cn(
                "inline-flex h-7 items-center gap-1 rounded-l-lg border px-2 text-xs font-bold transition-colors focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-60",
                WA_SOFT
              )}
            >
              <WhatsappLogo size={13} weight="fill" aria-hidden />
              {pending ? "Enviando…" : rotulo}
            </button>
          ) : waContato ? (
            <a
              href={waContato}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={rotuloLongo}
              title={rotuloLongo}
              className={cn(
                "inline-flex h-7 items-center gap-1 rounded-l-lg border px-2 text-xs font-bold transition-colors focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                WA_SOFT
              )}
            >
              <WhatsappLogo size={13} weight="fill" aria-hidden />
              {rotulo}
            </a>
          ) : (
            <span
              role="link"
              aria-disabled="true"
              title="Sem WhatsApp cadastrado"
              className={cn(
                "inline-flex h-7 cursor-not-allowed items-center gap-1 rounded-l-lg border border-dashed px-2 text-xs font-bold opacity-60",
                WA_SOFT
              )}
            >
              <WhatsappLogo size={13} weight="fill" aria-hidden />
              {rotulo}
            </span>
          )}
        </span>
        <DropdownMenu>
          <DropdownMenuTrigger
            aria-label="Opções da mensagem"
            title="Opções da mensagem"
            className={cn(
              "hidden h-7 items-center rounded-r-lg border border-l-0 px-1.5 transition-colors focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 md:inline-flex",
              WA_SOFT
            )}
          >
            <CaretDown size={11} weight="bold" aria-hidden />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className={menuCls}>
            {itensMenu(false)}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* ── mobile (<sm): quadrado verde 44px — o menu carrega a ação ── */}
        <DropdownMenu>
          <DropdownMenuTrigger
            aria-label={`${rotuloLongo}: opções da mensagem`}
            className={cn(
              "relative grid size-11 shrink-0 place-items-center rounded-xl transition-colors focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 md:hidden",
              WA_SOLID,
              !waContato && !nudge && "opacity-60"
            )}
          >
            <WhatsappLogo size={19} weight="fill" aria-hidden />
            <CaretDown
              size={9}
              weight="bold"
              aria-hidden
              className="absolute bottom-1 right-1"
            />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className={menuCls}>
            {itensMenu(true)}
          </DropdownMenuContent>
        </DropdownMenu>
      </span>

      {/* "Ver texto da mensagem" — o mesmo texto que vai pro wa.me e pra
          notificação, lido antes de enviar */}
      <Dialog open={verTexto} onOpenChange={setVerTexto}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Texto da mensagem</DialogTitle>
            <DialogDescription>
              {nudge
                ? "O que sai na notificação e abre no WhatsApp."
                : "O que abre no WhatsApp."}
            </DialogDescription>
          </DialogHeader>
          <p className="whitespace-pre-wrap rounded-lg bg-muted px-3 py-2.5 text-sm leading-relaxed">
            {mensagem}
          </p>
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="outline" size="sm" onClick={copiar}>
              <Copy size={14} aria-hidden />
              Copiar mensagem
            </Button>
            {waContato && (
              <Button
                size="sm"
                render={<a href={waContato} target="_blank" rel="noopener noreferrer" />}
              >
                <WhatsappLogo size={14} weight="fill" aria-hidden />
                Abrir wa.me
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
