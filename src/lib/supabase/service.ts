import { createClient } from "@supabase/supabase-js";

/** Client de service role sem sessão — existe só pras leituras de referência
 *  do programa dentro de unstable_cache (ciclo_eventos, cronogramas,
 *  materiais): o resultado é idêntico pra qualquer papel, então bypassar
 *  RLS é neutro, e cookies() é proibido dentro de função cacheada. Nunca
 *  usar em dado escopado por usuário. */
export function createServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
}
