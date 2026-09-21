import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
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
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
