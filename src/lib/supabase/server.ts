import { createServerClient } from "@supabase/ssr";
import { cookies, headers } from "next/headers";

// Secure follows the real request scheme, not NODE_ENV: a prod build over
// LAN HTTP (192.168.x.x / Tailscale QA) silently drops Secure cookies and
// the session never persists — same rule as the demo cookie (demo/mode.ts).
// Vercel sets x-forwarded-proto=https, so real prod keeps Secure.
const cookieOpts = async () => ({
  secure:
    process.env.NODE_ENV === "production" &&
    (await headers()).get("x-forwarded-proto") === "https",
  sameSite: "lax",
}) as const;

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookieOptions: await cookieOpts(),
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
