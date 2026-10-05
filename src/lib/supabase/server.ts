import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// o default do ssr não marca Secure — sem ele um cookie escrito em http
// ficaria solto; em produção tudo é https mesmo (localhost é exceção do spec)
// — mas em dev http+IP/hostname (Tailscale, LAN) o Secure seria descartado
// e a sessão nunca persistiria
const COOKIE_OPTS = {
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax",
} as const;

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookieOptions: COOKIE_OPTS,
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // chamado de Server Component; o middleware cuida do refresh
          }
        },
      },
    }
  );
}

/** Lê os cookies do request (o code_verifier do pkce mora lá) mas descarta
 *  toda escrita: consumir um link de auth com ele resolve a sessão sem
 *  plantá-la neste navegador — usado no handoff do /auth/confirm. */
export async function createClientDescartavel() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll() {},
      },
    }
  );
}
