import { type EmailOtpType } from "@supabase/supabase-js";
import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { pathInterno } from "@/lib/utils";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  // só caminhos internos — "//host" e "/\host" seriam open redirect
  const next = pathInterno(searchParams.get("next")) ?? "/";
  const supabase = await createClient();

  // sucesso → a sessão já está nos cookies DESTE navegador — entra direto:
  // primeiro acesso passa pelo onboarding de senha, senão vai pro destino.
  // (A aba que pediu o link entra junto pelo poll quando é o mesmo browser;
  // "só confirmar" não funciona entre navegadores — cookie não atravessa.)
  const destino = (resolveuSenha: boolean) =>
    NextResponse.redirect(
      new URL(
        resolveuSenha
          ? next
          : `/auth/definir-senha?next=${encodeURIComponent(next)}`,
        request.url,
      ),
    );

  // links novos não passam por aqui: o magic link implícito cai direto em
  // /login com #access_token (resolvido via setSession no client). Esta rota
  // fica pra token_hash (template com {{ .TokenHash }}) e os links pkce já
  // enviados antes da mudança — o ?code= deles só troca no mesmo navegador.
  const resolveuSenha = (u: { user_metadata?: Record<string, unknown> } | null) =>
    !!(u?.user_metadata?.senha_em || u?.user_metadata?.senha_dispensada);

  const code = searchParams.get("code");
  if (code) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return destino(resolveuSenha(data.user));
    }
  }

  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  if (token_hash && type) {
    const { data, error } = await supabase.auth.verifyOtp({ type, token_hash });
    if (!error) {
      return destino(resolveuSenha(data.user));
    }
  }

  // link inválido/expirado — preserva o next pra tentativa seguinte não perder o destino
  return NextResponse.redirect(
    new URL(`/login?erro=link-invalido&next=${encodeURIComponent(next)}`, request.url),
  );
}
