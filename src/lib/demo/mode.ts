import { cookies } from "next/headers";
import type { AppRole } from "@/lib/types";
import {
  DEMO_OB_COOKIE,
  DEMO_ROLE_COOKIE,
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

/** Onboarding da demo já concluído — cookie separado pra "rever o onboarding"
 *  sem precisar trocar de papel. */
export async function demoOnboarded(): Promise<boolean> {
  const store = await cookies();
  return store.get(DEMO_OB_COOKIE)?.value === "1";
}

export async function definirPapelDemo(papel: AppRole) {
  (await cookies()).set(DEMO_ROLE_COOKIE, papel, COOKIE_OPTS);
}

export async function marcarOnboardingDemo() {
  (await cookies()).set(DEMO_OB_COOKIE, "1", COOKIE_OPTS);
}

export async function desmarcarOnboardingDemo() {
  (await cookies()).delete(DEMO_OB_COOKIE);
}

export async function limparDemo() {
  const store = await cookies();
  store.delete(DEMO_ROLE_COOKIE);
  store.delete(DEMO_OB_COOKIE);
}
