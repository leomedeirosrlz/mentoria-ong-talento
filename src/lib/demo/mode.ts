import { cookies } from "next/headers";
import type { AppRole } from "@/lib/types";
import {
  DEMO_ROLE_COOKIE,
  DEMO_ROLES,
  demoObCookie,
  papelDemoValido,
} from "./shared";

// Helpers server-only do modo demo. A leitura é por cookie — as queries
// reais (src/lib/queries*.ts) checam `demoRole()` antes de bater no Supabase,
// então a demo inteira roda sem sessão e sem tocar no banco.

const COOKIE_OPTS = {
  path: "/",
  maxAge: 60 * 60 * 24 * 30,
  sameSite: "lax",
} as const;

/** Papel ativo da demo — null = sessão normal (autenticada ou não). */
export async function demoRole(): Promise<AppRole | null> {
  const store = await cookies();
  return papelDemoValido(store.get(DEMO_ROLE_COOKIE)?.value);
}

export async function demoAtivo(): Promise<boolean> {
  return (await demoRole()) != null;
}

/** Onboarding da persona já visto — um cookie por papel (demoObCookie):
 *  "rever a apresentação" desmarca só a ativa e trocar de papel mostra o
 *  wizard de cada uma na primeira vez. */
export async function demoOnboarded(papel: AppRole): Promise<boolean> {
  const store = await cookies();
  return store.get(demoObCookie(papel))?.value === "1";
}

export async function definirPapelDemo(papel: AppRole) {
  (await cookies()).set(DEMO_ROLE_COOKIE, papel, COOKIE_OPTS);
}

export async function marcarOnboardingDemo(papel: AppRole) {
  (await cookies()).set(demoObCookie(papel), "1", COOKIE_OPTS);
}

export async function desmarcarOnboardingDemo(papel: AppRole) {
  (await cookies()).delete(demoObCookie(papel));
}

/** Zera os "já vistos" de todas as personas — entrar na demo é sessão nova:
 *  cada papel passa pelo wizard de novo, uma vez por entrada. */
export async function resetarOnboardingDemo() {
  const store = await cookies();
  for (const papel of DEMO_ROLES) store.delete(demoObCookie(papel));
}

export async function limparDemo() {
  const store = await cookies();
  store.delete(DEMO_ROLE_COOKIE);
  await resetarOnboardingDemo();
}
