import type { AppRole } from "@/lib/types";

// Núcleo isomórfico do modo demo — SEM imports de next/* nem do dataset:
// este módulo entra no bundle do browser (stub de src/lib/supabase/client.ts)
// e no middleware (edge). Cookies legíveis no client de propósito.

export const DEMO_ROLE_COOKIE = "demo_role";
export const DEMO_OB_COOKIE = "demo_onboarded";

/** Toast único das mutations bloqueadas — actions retornam `{ error: DEMO_MSG }`. */
export const DEMO_MSG =
  "Modo demonstração — nada é gravado de verdade.";

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
