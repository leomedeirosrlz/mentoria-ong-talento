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
  // dev local é http — Secure só em produção (https)
  secure: process.env.NODE_ENV === "production",
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

/** Notificações marcadas como lidas nesta sessão demo — cookie com os ids
 *  (dataset compartilhado é imutável; o "lida" é estado do navegador, não
 *  do dado). Zera junto com o resto no sair/entrar. */
const DEMO_LIDAS_COOKIE = "demo_lidas";
// teto folgado: uuid+aspa ≈ 39B/id, 4KB de cookie cobre ~100 — a demo não
// chega perto; o slice é só proteção contra crescimento sem fim
const DEMO_LIDAS_MAX = 90;

export async function demoLidas(): Promise<Set<string>> {
  const raw = (await cookies()).get(DEMO_LIDAS_COOKIE)?.value;
  if (!raw) return new Set();
  try {
    const parsed: unknown = JSON.parse(raw);
    return new Set(Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === "string") : []);
  } catch {
    return new Set();
  }
}

export async function marcarDemoLidas(ids: string[]) {
  const lidas = await demoLidas();
  for (const id of ids) lidas.add(id);
  (await cookies()).set(
    DEMO_LIDAS_COOKIE,
    JSON.stringify([...lidas].slice(-DEMO_LIDAS_MAX)),
    COOKIE_OPTS
  );
}

/** "Lidas" é estado da sessão — entrar na demo de novo recomeça zerado. */
export async function limparDemoLidas() {
  (await cookies()).delete(DEMO_LIDAS_COOKIE);
}

export async function limparDemo() {
  const store = await cookies();
  store.delete(DEMO_ROLE_COOKIE);
  store.delete(DEMO_LIDAS_COOKIE);
  await resetarOnboardingDemo();
}
