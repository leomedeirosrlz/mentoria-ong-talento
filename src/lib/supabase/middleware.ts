import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { pathInterno } from "@/lib/utils";
import { DEMO_ROLE_COOKIE, papelDemoValido } from "@/lib/demo/shared";

export async function updateSession(request: NextRequest) {
  // modo demo: o cookie demo_role dispensa sessão de verdade — a navegação
  // inteira (inclusive /login e /demo) passa sem auth nem refresh de token
  if (papelDemoValido(request.cookies.get(DEMO_ROLE_COOKIE)?.value)) {
    return NextResponse.next({ request });
  }

  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      // o default do ssr não marca Secure — produção é https de ponta a ponta
      // (localhost é exceção do spec e aceita Secure em http)
      cookieOptions: { secure: true, sameSite: "lax" },
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const { data } = await supabase.auth.getClaims();
  const user = data?.claims ? { id: data.claims.sub as string } : null;

  const p = request.nextUrl.pathname;
  const isPublic =
    p === "/login" || p.startsWith("/login/") ||
    p === "/auth" || p.startsWith("/auth/") ||
    // a landing da demo precisa abrir sem cookie nenhum (ela é quem SETA o
    // cookie); com cookie o bypass acima já resolveu antes daqui
    p === "/demo" || p.startsWith("/demo/") ||
    // /assinar/<token> é a página pública do responsável pelo mentorado —
    // o token na URL é o fator de posse (RPC anon), não a sessão. `/assinar`
    // sozinho segue protegido: é o fluxo logado do termo do voluntário.
    p.startsWith("/assinar/") ||
    // a via assinada em PDF também é baixada pelo token, sem login
    p.startsWith("/api/assinar-token/") ||
    // formulários públicos por token (/f/<token>) — o destinatário responde
    // sem login; a segurança é a RPC (anon não tem grant de tabela, 0034)
    p.startsWith("/f/") ||
    p === "/privacidade";

  if (!user && !isPublic) {
    const url = request.nextUrl.clone();
    // preserva o destino (path+query) pro login devolver depois do magic link —
    // ex.: nudge do WhatsApp pousa em /duplas/{id} deslogado e volta pra lá
    const destino = p + request.nextUrl.search;
    url.pathname = "/login";
    url.search = `?next=${encodeURIComponent(destino)}`;
    return NextResponse.redirect(url);
  }

  if (user && request.nextUrl.pathname === "/login") {
    const next = request.nextUrl.searchParams.get("next");
    const destino = pathInterno(next) ?? "/";
    return NextResponse.redirect(new URL(destino, request.url));
  }

  return supabaseResponse;
}
