"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { type Session } from "@supabase/supabase-js";
import { CircleNotch, WarningCircle } from "@phosphor-icons/react";
import { createClient } from "@/lib/supabase/client";
import { pathInterno } from "@/lib/utils";

// pouso do magic link implícito — rota própria, não /login: usuário logado no
// navegador do e-mail seria redirecionado pelo middleware antes desta página
// carregar e o #access_token morreria no caminho (o handoff nunca rodava).
export function LinkLanding() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [falhou, setFalhou] = useState(false);

  useEffect(() => {
    // location.search, não useSearchParams: em página estática os params do
    // Next podem hidratar depois do efeito — o h= sairia null e o aviso de
    // falha nunca chegaria na aba que pediu
    const q = new URLSearchParams(location.search);
    const next = q.get("next");
    const destino = () => pathInterno(next) ?? "/";
    const handoff = q.get("h");

    // link queimado/expirado: com ?h= avisa a aba que pediu (ela para de
    // esperar e mostra o estado certo); sem ?h= só informa aqui — "pedir
    // novo link" aqui abriria o login no dispositivo errado
    const falhar = () => {
      if (handoff) {
        // .then() dispara o request — o builder do postgrest é lazy, void
        // sozinho não envia nada
        void supabase
          .rpc("falhar_login_handoff", { p_nonce: handoff })
          .then(() => {});
      }
      setFalhou(true);
    };

    const frag = new URLSearchParams(location.hash.slice(1));
    const access_token = frag.get("access_token");
    const refresh_token = frag.get("refresh_token");
    if (location.hash.startsWith("#error=") || !access_token || !refresh_token) {
      falhar();
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
            falhar();
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
