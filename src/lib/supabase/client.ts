import { createBrowserClient } from "@supabase/ssr";
import {
  createClient as createSupabaseClient,
  type SupabaseClient,
} from "@supabase/supabase-js";
import { demoRoleClient } from "@/lib/demo/shared";
import { createDemoClient } from "@/lib/demo/client-stub";

// Secure só em produção: dev roda em http — localhost aceita Secure por
// exceção do spec, mas http+IP/hostname (Tailscale, LAN) o browser descarta
// e a sessão nunca persiste (login "não entra"). Mesma régua dos cookies
// do modo demo (src/lib/demo/mode.ts).
const SECURE = process.env.NODE_ENV === "production";

function realClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    // mesmo Secure dos cookies server-side — o client grava a sessão via
    // document.cookie no login/refresh e sem isso derrubaria a flag
    { cookieOptions: { secure: SECURE, sameSite: "lax" } }
  );
}

export function createClient() {
  // modo demo: sem sessão real — devolve um client falso sobre o dataset
  // local (src/lib/demo/data.ts). Leituras resolvem do dataset; escritas
  // voltam com DEMO_MSG pra UI avisar que nada foi gravado.
  if (demoRoleClient()) {
    return createDemoClient() as unknown as SupabaseClient;
  }
  return realClient();
}

/** Client de fluxos de autenticação — NUNCA desvia pra demo: quem está em
 *  /login ou /auth/* quer sessão de verdade, mesmo com o cookie demo_role
 *  ativo (o middleware limpa o cookie demo quando a sessão real valida). */
export function createAuthClient() {
  return realClient();
}

/** Client dedicado ao pedido de magic link. O client ssr força flowType
 *  pkce e ignora a opção — o code_verifier mora no browser que pede, e um
 *  link aberto em outro navegador/app de e-mail quebrava a troca em
 *  /auth/confirm. Um client implícito descartável manda o link sem
 *  code_challenge: a sessão chega no hash (#access_token) e qualquer
 *  navegador resolve. persistSession desligado — quem grava a sessão é o
 *  client principal via setSession no landing. */
export function createOtpClient(): SupabaseClient {
  // auth é sempre real — com demo_role ativo o stub retornava falha e o
  // magic link nunca era enviado
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
