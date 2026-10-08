import { defineConfig } from "@playwright/test";

// e2e roda sempre contra um deploy — nunca sobe servidor local:
//   E2E_BASE_URL  http://localhost:3000 (dev) · preview URL (CI) · produção (nightly)
//   VERCEL_AUTOMATION_BYPASS  token "Protection Bypass for Automation" do
//   projeto no Vercel — previews têm SSO ligado; sem o header vira redirect
//   pro vercel.com/sso-api. Em produção/local pode ficar vazio.
const baseURL = process.env.E2E_BASE_URL ?? "http://localhost:3000";

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 30_000,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : undefined,
  forbidOnly: !!process.env.CI,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL,
    locale: "pt-BR",
    // debugável em CI: trace no retry, screenshot sempre que falhar
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    // demo = superfície pública/stubada — roda contra qualquer ambiente,
    // inclusive produção (nightly). Não escreve nada em banco real.
    { name: "demo", testMatch: "demo/**/*.spec.ts" },
    // app = backend real: login por senha, fluxos com write. Só roda quando
    // há credenciais de teste (preview apontando pro Supabase de staging).
    { name: "app", testMatch: "app/**/*.spec.ts" },
  ],
});
