"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { type EmailOtpType } from "@supabase/supabase-js";
import { CircleNotch, SignIn, WarningCircle } from "@phosphor-icons/react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";

// /auth/confirm sem ?h=: o link não prova que foi pedido nesta aba, então o
// token só é consumido depois do gesto explícito — um GET que já plantasse a
// sessão deixaria um link alheio logar a vítima no navegador dela (fixação)
export function ConfirmarAqui({
  code,
  tokenHash,
  type,
  next,
}: {
  code: string | null;
  tokenHash: string | null;
  type: EmailOtpType | null;
  next: string;
}) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [entrando, setEntrando] = useState(false);
  const [falhou, setFalhou] = useState(false);

  async function entrar() {
    setEntrando(true);
    try {
      // o client do browser persiste a sessão aqui — é o gesto que faltava
      // no GET. pkce sem verifier (link pedido em outro navegador) falha e
      // cai no card de link inválido
      const { data, error } = code
        ? await supabase.auth.exchangeCodeForSession(code)
        : await supabase.auth.verifyOtp({
            type: type!,
            token_hash: tokenHash!,
          });
      if (error || !data.session) {
        setFalhou(true);
        return;
      }
      // primeiro acesso passa pelo onboarding de senha, senão vai pro destino
      const meta = data.session.user.user_metadata;
      const resolveuSenha = !!meta?.senha_em || !!meta?.senha_dispensada;
      router.replace(
        resolveuSenha ? next : `/auth/definir-senha?next=${encodeURIComponent(next)}`
      );
    } catch {
      setFalhou(true);
    } finally {
      setEntrando(false);
    }
  }

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
            Peça um novo link pra entrar.
          </p>
          <Button
            type="button"
            className="mt-5 w-full"
            onClick={() => router.replace("/login")}
          >
            Pedir novo link
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] grid place-items-center bg-background px-4">
      <div className="max-w-xs text-center">
        <div className="mx-auto grid size-10 place-items-center rounded-full bg-muted text-foreground">
          <SignIn size={20} weight="bold" aria-hidden="true" />
        </div>
        <p className="mt-4 font-semibold">Entrar neste navegador?</p>
        <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
          Ao continuar, a sessão é criada aqui. Se você pediu este link em
          outro navegador ou app de e-mail, volte pra página que fez o pedido
          — ela entra sozinha.
        </p>
        <Button
          type="button"
          className="mt-5 w-full"
          disabled={entrando}
          onClick={() => void entrar()}
        >
          {entrando ? (
            <span className="flex items-center justify-center gap-2">
              <CircleNotch size={15} className="animate-spin" aria-hidden="true" />
              Entrando…
            </span>
          ) : (
            "Entrar neste navegador"
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
