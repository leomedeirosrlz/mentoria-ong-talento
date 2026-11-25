import { NextResponse, type NextRequest } from "next/server";

/** Saída de emergência da sessão: limpa os cookies de auth (e os da demo)
 *  e manda pro login. É rota GET, não server action, de propósito — o
 *  caminho onde ela é usada é justamente o app quebrado (cookie velho
 *  pós-deploy), e uma action depende do RSC que pode estar no chão.
 *
 *  `sb-*` cobre os tokens do Supabase, inclusive os fatiados
 *  (`sb-<ref>-auth-token.0`, `.1`). Path "/" explícito: cookie criado com
 *  outro path não seria apagado pela deleção padrão. */
export function GET(req: NextRequest) {
  const destino = new URL("/login", req.url);
  destino.searchParams.set("motivo", "sessao");
  const res = NextResponse.redirect(destino, { status: 303 });

  for (const c of req.cookies.getAll()) {
    const ehAuth = c.name.startsWith("sb-");
    const ehDemo =
      c.name === "demo_role" || c.name.startsWith("demo_onboarded_");
    if (ehAuth || ehDemo) {
      res.cookies.set(c.name, "", { path: "/", maxAge: 0 });
    }
  }
  return res;
}
