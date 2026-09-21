"use client";

import { useEffect, useRef, useState } from "react";
import { CircleNotch, WhatsappLogo } from "@phosphor-icons/react";
import { waLink } from "@/lib/ciclo";

// min-h-11 = alvo de toque ≥44px no mobile; desktop compacta (mesma gramática size-11 → md:h-8)
const CLASSES =
  "inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset md:min-h-8";

export function NudgeButton({
  telefone,
  mensagem,
  label = "Chamar no WhatsApp",
  duplaId,
  t,
}: {
  telefone: string | null | undefined;
  mensagem: string;
  label?: string;
  /** Com duplaId o clique passa por /api/nudge (log do contato) antes de abrir o wa.me. */
  duplaId?: string;
  /** Tipo registrado em `interacoes` — nudge | contato | apoio (default nudge). */
  t?: string;
}) {
  // o clique abre /api/nudge numa nova aba (log + redirect pro wa.me) — o ack
  // visual cobre esse salto de rede, que hoje acontece sem feedback na página
  const [abrindo, setAbrindo] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(null);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  function onClick() {
    setAbrindo(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setAbrindo(false), 1600);
  }

  const wa = waLink(telefone, mensagem);
  const href =
    wa && duplaId
      ? `/api/nudge?d=${encodeURIComponent(duplaId)}&to=${encodeURIComponent(wa)}&t=${encodeURIComponent(t ?? "nudge")}`
      : wa;
  if (!href) {
    // desabilitado explica por quê inline — no toque não existe hover/tooltip
    // (o title fica como redundância desktop). Sem aria-label: o nome do
    // controle continua sendo "{label}" e a razão vem do texto ao lado —
    // rotular o link com a razão anunciaria a mesma frase duas vezes e
    // esconderia a ação
    return (
      <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-1">
        <span
          role="link"
          aria-disabled="true"
          tabIndex={0}
          title="Sem WhatsApp cadastrado"
          className={`${CLASSES} cursor-not-allowed border-dashed text-muted-foreground/50`}
        >
          <WhatsappLogo size={15} aria-hidden />
          {label}
        </span>
        <span className="text-xs text-muted-foreground">sem WhatsApp cadastrado</span>
      </span>
    );
  }
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onClick={onClick}
      className={`${CLASSES} text-muted-foreground hover:bg-[var(--brand-lime)]/15 hover:text-foreground hover:border-[var(--brand-lime)]/60`}
    >
      {abrindo ? (
        <CircleNotch size={15} className="animate-spin" aria-hidden />
      ) : (
        <WhatsappLogo size={15} aria-hidden />
      )}
      {label}
    </a>
  );
}
