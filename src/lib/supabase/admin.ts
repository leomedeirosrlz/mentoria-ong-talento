import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/** Service role — bypassa RLS e tem acesso a auth.admin.*. Só existe pra
 *  operações que o JWT do usuário não alcança (ex.: updateUserById na troca
 *  de e-mail verificada por senha). SERVER ONLY — nunca importar em
 *  componente client nem em arquivo que um client bundle possa puxar. */
export function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    }
  );
}
