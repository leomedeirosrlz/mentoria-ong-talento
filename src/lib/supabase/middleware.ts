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
