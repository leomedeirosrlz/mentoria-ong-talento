"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export function Confirmado({ next }: { next: string }) {
  const statusRef = useRef<HTMLDivElement>(null);
  const supabase = useMemo(() => createClient(), []);
  // "Continuar para o app" só aparece quando a aba TEM sessão — no handoff
  // entre navegadores a aba do e-mail fica sem sessão de propósito (o login
  // acontece na aba que pediu o link), e mostrar o link ali mandaria a
  // pessoa pra um app deslogado no dispositivo errado
  const [temSessao, setTemSessao] = useState(false);

  useEffect(() => {
    // a página é só um status: foco nele garante o anúncio mesmo se a aba fechar
    // antes do leitor de tela terminar a navegação
    statusRef.current?.focus();
    // window.close só fecha janelas abertas por script — o clique no e-mail
    // abre uma aba comum e o browser bloqueia na maioria dos casos; se falhar,
    // a página fica com a instrução e o link de continuar
    const t = setTimeout(() => window.close(), 5000);
    supabase.auth.getSession().then(({ data }) => {
      setTemSessao(Boolean(data.session));
    });
    return () => clearTimeout(t);
  }, [supabase]);

  return (
    <div className="min-h-[100dvh] grid place-items-center bg-background px-4">
      <div className="max-w-xs text-center">
        <div ref={statusRef} tabIndex={-1} role="status" className="outline-none">
          <svg viewBox="0 0 52 52" className="mx-auto h-16 w-16" aria-hidden="true">
            <circle cx="26" cy="26" r="25" fill="var(--brand-lime)" className="confirm-pop" />
            <path
              d="M15 27l7.5 7.5L37 19"
              fill="none"
              stroke="var(--brand-ink)"
              strokeWidth="4"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="confirm-draw"
            />
          </svg>
          <p className="mt-4 font-semibold">E-mail confirmado</p>
          <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
            Já pode voltar pra aba onde você pediu o link: esta aqui fecha
            sozinha.
          </p>
        </div>
        {temSessao && (
          <a
            href={next}
            className="mt-2 inline-flex min-h-11 items-center text-sm text-muted-foreground underline underline-offset-2 transition-colors hover:text-foreground"
          >
            Continuar para o app
          </a>
        )}
      </div>
    </div>
  );
}
