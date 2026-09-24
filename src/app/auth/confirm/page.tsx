import { type EmailOtpType, type Session } from "@supabase/supabase-js";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClientDescartavel } from "@/lib/supabase/server";
import { pathInterno } from "@/lib/utils";
import { Confirmado } from "../confirmado/confirmado";
import { ConfirmarAqui } from "./confirmar";

export const metadata: Metadata = {
  title: "Entrando",
};

export default async function ConfirmPage({
  searchParams,
}: {
  searchParams: Promise<{
    h?: string;
    next?: string;
    code?: string;
    token_hash?: string;
    type?: string;
  }>;
}) {
  const { h, next: rawNext, code, token_hash, type } = await searchParams;
  // só caminhos internos — "//host" e "/\host" seriam open redirect
  const next = pathInterno(rawNext) ?? "/";
  const erroLink = `/login?erro=link-invalido&next=${encodeURIComponent(next)}`;

  // com ?h= o link pertence à aba que pediu: consome o token num client que
  // não grava cookie nenhum e deposita os tokens no handoff — esta aba NUNCA
  // cria sessão (um redirect_to adulterado plantaria a conta de outra pessoa
  // neste navegador). O code_verifier do pkce chega pelos cookies do request.
  if (h) {
    const supabase = await createClientDescartavel();
    let session: Session | null = null;
    if (code) {
      const { data } = await supabase.auth.exchangeCodeForSession(code);
      session = data.session;
    } else if (token_hash && type) {
      const { data } = await supabase.auth.verifyOtp({
        type: type as EmailOtpType,
        token_hash,
      });
      session = data.session;
    }
    if (session?.access_token && session.refresh_token) {
      const { error } = await supabase.rpc("registrar_login_handoff", {
        p_nonce: h,
        p_access: session.access_token,
        p_refresh: session.refresh_token,
      });
      if (!error) return <Confirmado next={next} />;
    }
    // queimou no consumo ou no depósito — marca o nonce pra aba que pediu
    // parar de esperar e falha aqui
    await supabase.rpc("falhar_login_handoff", { p_nonce: h });
    redirect(erroLink);
  }

  // sem ?h= não dá pra saber se o link foi pedido nesta aba — o token NÃO é
  // consumido no GET: a página pede um gesto explícito antes de plantar a
  // sessão neste navegador
  const consumivel = Boolean(code) || Boolean(token_hash && type);
  if (!consumivel) redirect(erroLink);
  return (
    <ConfirmarAqui
      code={code ?? null}
      tokenHash={token_hash ?? null}
      type={(type ?? null) as EmailOtpType | null}
      next={next}
    />
  );
}
