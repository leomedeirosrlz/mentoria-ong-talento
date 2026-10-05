"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CircleNotch, WarningCircle } from "@phosphor-icons/react";
import { createAuthClient } from "@/lib/supabase/client";
import { pathInterno } from "@/lib/utils";

// pouso do magic link implícito — rota própria, não /login: usuário logado no
// navegador do e-mail seria redirecionado pelo middleware antes desta página
// carregar e o #access_token morreria no caminho (o handoff nunca rodava).
// Esta aba NUNCA cria sessão: sem o nonce (?h=) o link não prova que veio do
// pedido feito aqui — um redirect_to adulterado plantaria a sessão de outra
// conta neste navegador (fixação). Quem entra é sempre a aba que pediu.
export function LinkLanding() {
  const router = useRouter();
  const supabase = useMemo(() => createAuthClient(), []);
  const [falhou, setFalhou] = useState(false);
  // StrictMode remonta o efeito em dev — o link é de uso único, roda uma vez
  const rodou = useRef(false);

  useEffect(() => {
    if (rodou.current) return;
    rodou.current = true;
    // location.search, não useSearchParams: em página estática os params do
    // Next podem hidratar depois do efeito — o h= sairia null e o aviso de
    // falha nunca chegaria na aba que pediu
    const q = new URLSearchParams(location.search);
    const next = q.get("next");
    const handoff = q.get("h");

    // link queimado/expirado: com ?h= avisa a aba que pediu (ela para de
    // esperar e mostra o estado certo); sem ?h= só informa aqui — "pedir
    // novo link" aqui abriria o login no dispositivo errado
    const falhar = () => {
      if (handoff) {
        // .then() dispara o request — o builder do postgrest é lazy, void
        // sozinho não envia nada; o segundo callback engole a rejeição de um
        // nonce inválido
        void supabase
          .rpc("falhar_login_handoff", { p_nonce: handoff })
          .then(() => {}, () => {});
      }
      setFalhou(true);
    };

    const frag = new URLSearchParams(location.hash.slice(1));
    const access_token = frag.get("access_token");
    const refresh_token = frag.get("refresh_token");
    const linkQueimado = location.hash.startsWith("#error=");

    // tokens E nonce fora da barra/histórico antes de qualquer await
    history.replaceState(null, "", location.pathname);

    if (linkQueimado || !access_token || !refresh_token || !handoff) {
      falhar();
      return;
    }

    // esta aba não grava nada (o refresh_token é de uso único e pertence à
    // aba que pediu) — publica no handoff e confirma. Se a RPC falhar o
    // nonce morre marcado: nunca entra aqui
    void supabase
      .rpc("registrar_login_handoff", {
        p_nonce: handoff,
        p_access: access_token,
        p_refresh: refresh_token,
      })
      .then(({ error }) => {
        if (error) {
          falhar();
          return;
        }
        router.replace(
          `/auth/confirmado?next=${encodeURIComponent(pathInterno(next) ?? "/")}`
        );
      });
  }, [supabase, router]);

  if (falhou) {
    return (
      <div className="min-h-[100dvh] grid place-items-center bg-background px-4">
        <div className="max-w-xs text-center">
          <div
            role="alert"
            className="mx-auto grid size-10 place-items-center rounded-full bg-destructive/10 text-destructive"
          >
            <WarningCircle size={20} weight="bold" aria-hidden="true" />
          </div>
          <p className="mt-4 font-semibold">Link inválido ou expirado</p>
          <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
            Peça um novo link na página onde você pediu.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] grid place-items-center bg-background px-4">
      <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground">
        <CircleNotch size={16} className="animate-spin" aria-hidden="true" />
        Confirmando…
      </p>
    </div>
  );
}
