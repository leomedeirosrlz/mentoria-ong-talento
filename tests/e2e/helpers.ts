import { test as base, expect, type Page } from "@playwright/test";

// --- test fixture: bypass do Vercel escopado à origem sob teste ---
// extraHTTPHeaders mandaria o token em TODA request — inclusive chamadas
// browser→supabase do login, vazando o bypass pra edge logs. A route só
// injeta o header quando a origem bate a do baseURL.
export const test = base.extend({
  // (provide = `use` do playwright renomeado — eslint lê `use(` como hook React)
  page: async ({ page }, provide) => {
    const bypass = process.env.VERCEL_AUTOMATION_BYPASS;
    if (bypass) {
      const origin = new URL(process.env.E2E_BASE_URL ?? "http://localhost:3000")
        .origin;
      await page.route(`${origin}/**`, (route) =>
        route.continue({
          headers: {
            ...route.request().headers(),
            "x-vercel-protection-bypass": bypass,
          },
        })
      );
    }
    await provide(page);
  },
});
export { expect };

// --- helpers compartilhados ---

/** Wizard de primeiro acesso: "Pular tudo e começar" só renderiza em passos
 *  com formulário (step>=2) — o(s) primeiro(s) são só "Continuar".
 *  Clique pré-hidratação é no-op silencioso (RSC demora a ligar handlers em
 *  dev/preview frio), então cada clique confirma o avanço no progressbar. */
export async function pularOnboarding(page: Page) {
  const pular = page.getByRole("button", { name: /Pular tudo e começar/ });
  const progress = page.getByRole("progressbar");
  for (let i = 0; i < 12; i++) {
    if (await pular.isVisible().catch(() => false)) break;
    if (!(await progress.isVisible().catch(() => false))) return; // wizard concluiu sozinho
    const label = await progress.getAttribute("aria-label");
    const passoAtual = Number(label?.match(/Passo (\d+)/)?.[1] ?? 0);
    const primario = page.getByRole("button", { name: /^(Continuar|Começar)$/ });
    if (!(await primario.isVisible().catch(() => false))) break;
    await primario.click();
    // se o clique caiu pré-hidratação o passo não avança — o loop clica de
    // novo; avanço real = aria-label do progressbar muda pra Passo N+1
    if (passoAtual > 0) {
      await page
        .getByRole("progressbar", {
          name: new RegExp(`Passo ${passoAtual + 1} `),
        })
        .waitFor({ state: "attached", timeout: 1500 })
        .catch(() => {});
    }
  }
  await pular.click();
}

/** Sessão demo direta por cookie — o que importa pros specs de feature é a
 *  sessão, não o clique. O fluxo de entrada pela UI é testado à parte
 *  (smoke.spec "seleção de papel → onboarding"). `context().addCookies`
 *  precisa da url base da page já carregada — goto("/") antes. */
export async function entrarNaDemo(
  page: Page,
  papel: "coordenacao" | "supervisor" | "mentor_dpp" | "mentor_especialista"
) {
  await page.goto("/demo"); // estabelece a origem pros cookies
  await page.context().addCookies([
    { name: "demo_role", value: papel, url: page.url() },
    {
      name: `demo_onboarded_${papel}`,
      value: "1",
      url: page.url(),
    },
  ]);
}

// --- helpers compartilhados dos specs "app" (backend real) ---

/** Login real por senha (o modo existe só pra teste — magic link não é
 *  automatizável sem ler e-mail). Depois do submit o app decide o destino:
 *  fixture vem com `senha_em` em user_metadata → cai direto no `next`. */
export async function loginComSenha(
  page: Page,
  email: string,
  senha: string
) {
  await page.goto("/login");
  // o input radio é sr-only — clicar nele falha (span do pill intercepta).
  // O label pai é clicável e ativa o input nativamente.
  await page
    .locator("label", { has: page.locator('input[name="modo-login"][value="senha"]') })
    .click();
  // #email, não getByLabel — a página tem mais de um controle com label
  // "E-mail" (strict mode violation)
  await page.locator("#email").fill(email);
  await page.locator("#senha").fill(senha);
  await page.getByRole("button", { name: "Entrar" }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/login"), {
    timeout: 15_000,
  });
}

// Hard-stop: specs "app" escrevem — E2E_* apontando pra prod é config
// errada, não ambiente válido. appEnvOk recusa e o spec pula; o cleanup
// confere de novo (belt & suspenders: service role nunca encosta em prod).
const PROD_REF = "yhjzmxleotahijinjepl";
const supabaseUrl = process.env.E2E_SUPABASE_URL ?? "";

/** Envs do backend real (staging ou supabase local do CI). Sem credenciais
 *  o spec inteiro pula, não falha — o CI de preview pode existir sem staging. */
export function appEnvOk() {
  return !!(
    process.env.E2E_MENTOR_EMAIL &&
    process.env.E2E_MENTOR_PASSWORD &&
    supabaseUrl &&
    !supabaseUrl.includes(PROD_REF) &&
    process.env.E2E_SUPABASE_SERVICE_ROLE_KEY
  );
}

/** DELETE via service role — limpeza do que o spec criou no backend de teste.
 *  `filtro` é a query do PostgREST (ex.: "dupla_id=eq.X&numero=eq.1"). */
export async function limparViaServiceRole(
  tabela: string,
  filtro: string
): Promise<void> {
  if (supabaseUrl.includes(PROD_REF))
    throw new Error("E2E_SUPABASE_URL aponta pra produção — cleanup abortado");
  const url = `${supabaseUrl}/rest/v1/${tabela}?${filtro}`;
  const key = process.env.E2E_SUPABASE_SERVICE_ROLE_KEY!;
  const res = await fetch(url, {
    method: "DELETE",
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  });
  if (!res.ok) throw new Error(`cleanup ${tabela} falhou: ${res.status}`);
}

/** GET via service role — leitura auxiliar pra cleanup/verificação que a UI
 *  não expõe diretamente (ex.: id da row criada, turma da dupla fixture).
 *  Mesmo hard-stop do delete: spec app nunca fala com prod. */
export async function buscarViaServiceRole<T = Record<string, unknown>[]>(
  tabela: string,
  filtro: string
): Promise<T> {
  if (supabaseUrl.includes(PROD_REF))
    throw new Error("E2E_SUPABASE_URL aponta pra produção — leitura abortada");
  const url = `${supabaseUrl}/rest/v1/${tabela}?${filtro}`;
  const key = process.env.E2E_SUPABASE_SERVICE_ROLE_KEY!;
  const res = await fetch(url, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  });
  if (!res.ok) throw new Error(`read ${tabela} falhou: ${res.status}`);
  return (await res.json()) as T;
}

/** PATCH via service role — restaura fixture que o spec alterou de propósito
 *  (ex.: a dupla que o remanejo encerrou volta a "ativa"). `filtro` é a query
 *  do PostgREST; `patch` é o corpo do update. */
export async function atualizarViaServiceRole(
  tabela: string,
  filtro: string,
  patch: Record<string, unknown>
): Promise<void> {
  if (supabaseUrl.includes(PROD_REF))
    throw new Error("E2E_SUPABASE_URL aponta pra produção — cleanup abortado");
  const url = `${supabaseUrl}/rest/v1/${tabela}?${filtro}`;
  const key = process.env.E2E_SUPABASE_SERVICE_ROLE_KEY!;
  const res = await fetch(url, {
    method: "PATCH",
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify(patch),
  });
  if (!res.ok) throw new Error(`patch ${tabela} falhou: ${res.status}`);
}
