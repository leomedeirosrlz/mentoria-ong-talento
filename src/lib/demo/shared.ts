import type { AppRole } from "@/lib/types";

// Núcleo isomórfico do modo demo — SEM imports de next/* nem do dataset:
// este módulo entra no bundle do browser (stub de src/lib/supabase/client.ts)
// e no middleware (edge). Cookies legíveis no client de propósito.

export const DEMO_ROLE_COOKIE = "demo_role";
/** Cookie de onboarding por papel (`demo_onboarded_mentor_dpp=1`): a
 *  apresentação de cada persona aparece só no primeiro acesso DELA — trocar
 *  de papel mostra o wizard do novo, voltar pro já visto cai direto no app. */
export const demoObCookie = (role: AppRole) => `demo_onboarded_${role}`;

/** Toast único das mutations bloqueadas — actions retornam `{ error: DEMO_MSG }`. */
export const DEMO_MSG =
  "Modo demonstração. Nada é gravado de verdade.";

export const DEMO_ROLES: readonly AppRole[] = [
  "coordenacao",
  "supervisor",
  "mentor_dpp",
  "mentor_especialista",
];

export function papelDemoValido(v: string | undefined | null): AppRole | null {
  return v != null && (DEMO_ROLES as readonly string[]).includes(v)
    ? (v as AppRole)
    : null;
}

/** Papel da demo lido do document.cookie — par client dos helpers server de
 *  ./mode. Serve pra desligar persistência local (rascunhos em localStorage)
 *  na demo: nada que o visitante digita pode sobreviver pro próximo. */
export function demoRoleClient(): AppRole | null {
  if (typeof document === "undefined") return null;
  const raw = document.cookie
    .split("; ")
    .find((c) => c.startsWith(`${DEMO_ROLE_COOKIE}=`));
  return papelDemoValido(
    decodeURIComponent(raw?.slice(raw.indexOf("=") + 1) ?? "")
  );
}

export function demoAtivoClient(): boolean {
  return demoRoleClient() != null;
}

// par client do mesmo nome em mode.ts (módulo server — não importa aqui)
const DEMO_LIDAS_COOKIE = "demo_lidas";

/** Login real venceu: sai do modo demo apagando no browser o papel, os
 *  "já vi" das personas e o mural-lidas local. Sem isso o cookie demo_role
 *  (30 dias) seguiria desviando a navegação e todo createClient() do app
 *  continuaria preso no stub mesmo autenticado. */
export function limparCookiesDemo() {
  if (typeof document === "undefined") return;
  for (const nome of [
    DEMO_ROLE_COOKIE,
    DEMO_LIDAS_COOKIE,
    ...DEMO_ROLES.map(demoObCookie),
  ]) {
    document.cookie = `${nome}=;path=/;max-age=0`;
  }
}
