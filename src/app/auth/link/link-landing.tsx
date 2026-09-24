"use client";

import { useEffect, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { type Session } from "@supabase/supabase-js";
import { CircleNotch } from "@phosphor-icons/react";
import { createClient } from "@/lib/supabase/client";
import { pathInterno } from "@/lib/utils";

// pouso do magic link implícito — rota própria, não /login: usuário logado no
// navegador do e-mail seria redirecionado pelo middleware antes desta página
// carregar e o #access_token morreria no caminho (o handoff nunca rodava).
export function LinkLanding() {
  const router = useRouter();
  const params = useSearchParams();
  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    const next = params.get("next");
    const destino = () => pathInterno(next) ?? "/";
    const urlErro = `/login?erro=link-invalido${next ? `&next=${encodeURIComponent(next)}` : ""}`;

    // verify falhou (otp expirado/usado) → despeja #error= aqui; vai pro card
    // dedicado do login em vez de cair num beco
    if (location.hash.startsWith("#error=")) {
      router.replace(urlErro);
      return;
    }

    const frag = new URLSearchParams(location.hash.slice(1));
    const access_token = frag.get("access_token");
    const refresh_token = frag.get("refresh_token");
    const handoff = params.get("h");
    if (!access_token || !refresh_token) {
      router.replace("/login");
      return;
    }

    // tokens fora da barra/histórico antes de qualquer await
    history.replaceState(null, "", location.pathname + location.search);

    const entrar = (session: Session | null) => {
      const meta = session?.user?.user_metadata;
      const resolveuSenha = !!meta?.senha_em || !!meta?.senha_dispensada;
      router.replace(
        resolveuSenha ? destino() : `/auth/definir-senha?next=${encodeURIComponent(destino())}`
      );
    };
    const entrarAqui = () =>
      supabase.auth
        .setSession({ access_token, refresh_token })
        .then(async ({ error }) => {
          if (error) {
            router.replace(urlErro);
            return;
          }
          const { data } = await supabase.auth.getSession();
          entrar(data.session);
        });

    if (handoff) {
      // esta aba não grava nada (o refresh_token é de uso único e pertence à
      // aba que pediu) — publica no handoff e confirma. Se a RPC falhar,
      // entra aqui mesmo: melhor sessão nesta aba do que nenhuma
      void supabase
        .rpc("registrar_login_handoff", {
          p_nonce: handoff,
          p_access: access_token,
          p_refresh: refresh_token,
        })
        .then(({ error }) => {
          if (error) {
            void entrarAqui();
            return;
          }
          router.replace(`/auth/confirmado?next=${encodeURIComponent(destino())}`);
        });
    } else {
      void entrarAqui();
    }
  }, [supabase, params, router]);

  return (
    <div className="min-h-[100dvh] grid place-items-center bg-background px-4">
      <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground">
        <CircleNotch size={16} className="animate-spin" aria-hidden="true" />
        Confirmando…
      </p>
    </div>
  );
}
