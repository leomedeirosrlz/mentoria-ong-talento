import { type EmailOtpType } from "@supabase/supabase-js";
import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { pathInterno } from "@/lib/utils";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  // só caminhos internos — "//host" e "/\host" seriam open redirect
  const next = pathInterno(searchParams.get("next")) ?? "/";
  const supabase = await createClient();

  // sucesso → quem nunca definiu senha cai no onboarding de senha; quem já
  // tem vê "confirmado" e a aba se fecha — em ambos, a aba original do login
  // detecta a sessão e entra sozinha no destino
  const confirmado = (temSenha: boolean) =>
    NextResponse.redirect(
      new URL(
        `${temSenha ? "/auth/confirmado" : "/auth/definir-senha"}?next=${encodeURIComponent(next)}`,
        request.url,
      ),
    );

  // links novos não passam por aqui: o magic link implícito cai direto em
  // /login com #access_token (resolvido via setSession no client). Esta rota
  // fica pra token_hash (template com {{ .TokenHash }}) e os links pkce já
  // enviados antes da mudança — o ?code= deles só troca no mesmo navegador.
  const code = searchParams.get("code");
  if (code) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return confirmado(!!data.user?.user_metadata?.senha_em);
    }
  }

  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  if (token_hash && type) {
    const { data, error } = await supabase.auth.verifyOtp({ type, token_hash });
    if (!error) {
      return confirmado(!!data.user?.user_metadata?.senha_em);
    }
  }

  // link inválido/expirado — preserva o next pra tentativa seguinte não perder o destino
  return NextResponse.redirect(
    new URL(`/login?erro=link-invalido&next=${encodeURIComponent(next)}`, request.url),
  );
}
