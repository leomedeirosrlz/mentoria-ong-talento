import { cookies, headers } from "next/headers";
import type { AppRole } from "@/lib/types";
import {
  DEMO_ROLE_COOKIE,
  DEMO_ROLES,
  DEMO_TERMO_COOKIE,
  demoObCookie,
  papelDemoValido,
  type TermoSimulado,
} from "./shared";

// Helpers server-only do modo demo. A leitura é por cookie — as queries
// reais (src/lib/queries*.ts) checam `demoRole()` antes de bater no Supabase,
// então a demo inteira roda sem sessão e sem tocar no banco.

// Secure follows the real request scheme, not NODE_ENV: a prod build over
// LAN HTTP (phone QA at 192.168.x.x:3100) silently drops Secure cookies —
// /demo exited the moment a papel was picked. Vercel sets x-forwarded-proto
// https, so prod keeps Secure.
const cookieOpts = async () => ({
  path: "/",
  maxAge: 60 * 60 * 24 * 30,
  sameSite: "lax" as const,
  secure:
    process.env.NODE_ENV === "production" &&
    (await headers()).get("x-forwarded-proto") === "https",
});

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
  (await cookies()).set(DEMO_ROLE_COOKIE, papel, await cookieOpts());
}

export async function marcarOnboardingDemo(papel: AppRole) {
  (await cookies()).set(demoObCookie(papel), "1", await cookieOpts());
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
    await cookieOpts()
  );
}

/** "Lidas" é estado da sessão — entrar na demo de novo recomeça zerado. */
export async function limparDemoLidas() {
  (await cookies()).delete(DEMO_LIDAS_COOKIE);
}

/** Assinatura simulada do termo nesta sessão demo (o writer client é
 *  gravarTermoSimulado, shared.ts). Os espelhos leem daqui pra virar a
 *  pendência da persona em "assinado" com o snapshot que ela digitou. */
export async function demoTermoSimulado(): Promise<TermoSimulado | null> {
  const raw = (await cookies()).get(DEMO_TERMO_COOKIE)?.value;
  if (!raw) return null;
  try {
    const t = JSON.parse(decodeURIComponent(raw)) as TermoSimulado;
    return t?.papel && t?.nome && t?.civis && t?.em ? t : null;
  } catch {
    return null;
  }
}

/** Estado de sessão como as lidas: zerada na entrada da demo e na saída —
 *  trocar de papel mantém (a assinatura é da persona, não do papel ativo). */
export async function limparTermoSimulado() {
  (await cookies()).delete(DEMO_TERMO_COOKIE);
}

export async function limparDemo() {
  const store = await cookies();
  store.delete(DEMO_ROLE_COOKIE);
  store.delete(DEMO_LIDAS_COOKIE);
  store.delete(DEMO_TERMO_COOKIE);
  await resetarOnboardingDemo();
}
