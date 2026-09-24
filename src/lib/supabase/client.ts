import { createBrowserClient } from "@supabase/ssr";
import {
  createClient as createSupabaseClient,
  type SupabaseClient,
} from "@supabase/supabase-js";
import { DEMO_ROLE_COOKIE, papelDemoValido } from "@/lib/demo/shared";
import { createDemoClient } from "@/lib/demo/client-stub";

export function createClient() {
  // modo demo: sem sessão real — devolve um client falso sobre o dataset
  // local (src/lib/demo/data.ts). Leituras resolvem do dataset; escritas
  // voltam com DEMO_MSG pra UI avisar que nada foi gravado.
  if (typeof document !== "undefined") {
    const raw = document.cookie
      .split("; ")
      .find((c) => c.startsWith(`${DEMO_ROLE_COOKIE}=`));
    if (papelDemoValido(decodeURIComponent(raw?.split("=")[1] ?? ""))) {
      return createDemoClient() as unknown as SupabaseClient;
    }
  }
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    // mesmo Secure dos cookies server-side — o client grava a sessão via
    // document.cookie no login/refresh e sem isso derrubaria a flag
    { cookieOptions: { secure: true, sameSite: "lax" } }
  );
}

/** Client dedicado ao pedido de magic link. O client ssr força flowType
 *  pkce e ignora a opção — o code_verifier mora no browser que pede, e um
 *  link aberto em outro navegador/app de e-mail quebrava a troca em
 *  /auth/confirm. Um client implícito descartável manda o link sem
 *  code_challenge: a sessão chega no hash (#access_token) e qualquer
 *  navegador resolve. persistSession desligado — quem grava a sessão é o
 *  client principal via setSession no landing. */
export function createOtpClient(): SupabaseClient {
  if (typeof document !== "undefined") {
    const raw = document.cookie
      .split("; ")
      .find((c) => c.startsWith(`${DEMO_ROLE_COOKIE}=`));
    if (papelDemoValido(decodeURIComponent(raw?.split("=")[1] ?? ""))) {
      return createDemoClient() as unknown as SupabaseClient;
    }
  }
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        flowType: "implicit",
        persistSession: false,
        detectSessionInUrl: false,
        autoRefreshToken: false,
      },
    }
  );
}
