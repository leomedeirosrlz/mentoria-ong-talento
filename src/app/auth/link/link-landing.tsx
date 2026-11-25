"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CircleNotch, SignIn, WarningCircle } from "@phosphor-icons/react";
import { createAuthClient } from "@/lib/supabase/client";
import { limparCookiesDemo } from "@/lib/demo/shared";
import { pathInterno } from "@/lib/utils";
import { Button } from "@/components/ui/button";

// pouso do magic link implícito — rota própria, não /login: usuário logado no
// navegador do e-mail seria redirecionado pelo middleware antes desta página
// carregar e o #access_token morreria no caminho (o handoff nunca rodava).
// Com ?h= esta aba só publica os tokens no handoff: quem entra é a aba que
// pediu. Sem ?h= (link antigo ou cliente de e-mail que cortou a query) o
// link não prova que veio do pedido feito aqui — a sessão NUNCA entra sozinha
// (fixação): o gesto explícito "Entrar como {email}" confirma que a pessoa
// quer ESTA conta neste aparelho, mesmo padrão do /auth/confirm.

type TokensPendentes = { access: string; refresh: string; next: string };

/** claim `email` do JWT — display-only (o card mostra quem vai entrar); a
 *  validação de verdade acontece no setSession. */
function emailDoJwt(token: string): string | null {
  try {
    const payload = JSON.parse(
      atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/"))
    ) as { email?: unknown };
    return typeof payload.email === "string" && payload.email.length > 0
      ? payload.email
      : null;
  } catch {
    return null;
  }
}

export function LinkLanding() {
  const router = useRouter();
  const supabase = useMemo(() => createAuthClient(), []);
  const [falhou, setFalhou] = useState(false);
  // tokens de um link sem ?h= aguardando o gesto — saem da URL pro state e
  // só viram sessão no clique
  const [pendente, setPendente] = useState<TokensPendentes | null>(null);
  const [emailPendente, setEmailPendente] = useState<string | null>(null);
  const [entrando, setEntrando] = useState(false);
  // StrictMode remonta o efeito em dev — o link é de uso único, roda uma vez
  const rodou = useRef(false);

  useEffect(() => {
    if (rodou.current) return;
    rodou.current = true;
    // location.search, não useSearchParams: em página estática os params do
    // Next podem hidratar depois do efeito — o h= sairia null e o aviso de
    // falha nunca chegaria na aba que pediu
    const q = new URLSearchParams(location.search);
    const next = pathInterno(q.get("next")) ?? "/";
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

    // sem nonce não dá pra devolver os tokens à aba que pediu — em vez de
    // descartar o link (o furo: pedido feito no MESMO aparelho perdia o
    // login), segura os tokens e oferece o gesto explícito. O e-mail vem do
    // JWT pra pessoa saber qual conta está entrando; decode falho cai no
    // card de falha — melhor um link morto honesto que sessão cega
    const segurar = (access: string, refresh: string) => {
      const email = emailDoJwt(access);
      if (!email) {
        falhar();
        return;
      }
      setPendente({ access, refresh, next });
      setEmailPendente(email);
    };

    const frag = new URLSearchParams(location.hash.slice(1));
    const access_token = frag.get("access_token");
    const refresh_token = frag.get("refresh_token");
    const linkQueimado = location.hash.startsWith("#error=");

    // tokens E nonce fora da barra/histórico antes de qualquer await
    history.replaceState(null, "", location.pathname);

    if (linkQueimado || !access_token || !refresh_token) {
      falhar();
      return;
    }

    if (!handoff) {
      segurar(access_token, refresh_token);
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
        router.replace(`/auth/confirmado?next=${encodeURIComponent(next)}`);
      });
  }, [supabase, router]);

  // gesto explícito do caminho sem ?h=: só aqui os tokens viram sessão.
  // Mesmo desfecho do login normal — primeiro acesso passa pelo onboarding
  // de senha, senão vai direto pro destino do link
  async function entrarAqui() {
    if (!pendente) return;
    setEntrando(true);
    try {
      const { data, error } = await supabase.auth.setSession({
        access_token: pendente.access,
        refresh_token: pendente.refresh,
      });
      if (error || !data.session) {
        setPendente(null);
        setFalhou(true);
        return;
      }
      limparCookiesDemo();
      const meta = data.session.user.user_metadata;
      const resolveuSenha = !!meta?.senha_em || !!meta?.senha_dispensada;
      router.replace(
        resolveuSenha
          ? pendente.next
          : `/auth/definir-senha?next=${encodeURIComponent(pendente.next)}`
      );
    } catch {
      setPendente(null);
      setFalhou(true);
    } finally {
      setEntrando(false);
    }
  }

  if (falhou) {
    return (
      <div className="min-h-[100dvh] grid place-items-center bg-background px-4 pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))]">
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

  if (pendente) {
    return (
      <div className="min-h-[100dvh] grid place-items-center bg-background px-4 pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))]">
        <div className="max-w-xs text-center">
          <div className="mx-auto grid size-10 place-items-center rounded-full bg-muted text-foreground">
            <SignIn size={20} weight="bold" aria-hidden="true" />
          </div>
          <p className="mt-4 font-semibold">
            Entrar como {emailPendente} neste aparelho?
          </p>
          <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
            Ao continuar, a sessão é criada aqui. Se você pediu este link em
            outro navegador ou app de e-mail, volte pra página que fez o
            pedido. Ela entra sozinha.
          </p>
          <Button
            type="button"
            className="mt-5 w-full"
            disabled={entrando}
            onClick={() => void entrarAqui()}
          >
            {entrando ? (
              <span className="flex items-center justify-center gap-2">
                <CircleNotch size={15} className="animate-spin" aria-hidden="true" />
                Entrando…
              </span>
            ) : (
              "Entrar neste aparelho"
            )}
          </Button>
          <a
            href="/login"
            className="mt-2 inline-flex min-h-11 items-center text-sm text-muted-foreground underline underline-offset-2 transition-colors hover:text-foreground"
          >
            Voltar para o login
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] grid place-items-center bg-background px-4 pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))]">
      <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground">
        <CircleNotch size={16} className="animate-spin" aria-hidden="true" />
        Confirmando…
      </p>
    </div>
  );
}
