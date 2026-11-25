"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

/** Recuperação de sessão (pós-deploy): o cookie do Supabase pode ficar
 *  apontando pra um token que o servidor não renova mais — o layout estoura
 *  e o error boundary só oferecia "tentar de novo", prendendo a pessoa num
 *  loop. Aqui a gente descarta os cookies de auth (e os da demo) ANTES de
 *  qualquer chamada de rede: não depende do refresh token estar válido. */
export async function recuperarSessao() {
  const jar = await cookies();
  for (const c of jar.getAll()) {
    const ehAuth = c.name.startsWith("sb-");
    const ehDemo =
      c.name === "demo_role" || c.name.startsWith("demo_onboarded_");
    if (ehAuth || ehDemo) jar.delete(c.name);
  }
  redirect("/login?motivo=sessao");
}
