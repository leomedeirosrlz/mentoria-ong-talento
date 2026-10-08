import { expect, test } from "@playwright/test";
import { appEnvOk, limparViaServiceRole, loginComSenha } from "../helpers";

// Backend real (staging): a fixture vem de scripts/seed-e2e-staging.mjs —
// mentor com dupla DPP ativa e senha definida. Specs escrevem de verdade e
// limpam via service role no fim.
const EMAIL = process.env.E2E_MENTOR_EMAIL ?? "";
const SENHA = process.env.E2E_MENTOR_PASSWORD ?? "";
const DUPLA_ID = process.env.E2E_DUPLA_ID ?? "";

test.skip(!appEnvOk(), "sem credenciais de staging (E2E_*) — pula specs de app");

test.describe("mentor DPP — fluxos reais", () => {
  test.beforeEach(async ({ page }) => {
    await loginComSenha(page, EMAIL, SENHA);
  });

  test("login cai na home do mentor, não no onboarding", async ({ page }) => {
    await expect(page).not.toHaveURL(/\/login|\/auth\/definir-senha/);
    // home do mentor: o próximo passo da dupla é o protagonista
    await expect(page.getByText(/encontro/i).first()).toBeVisible();
  });

  test("agenda renderiza a semana e o cronograma oficial", async ({ page }) => {
    await page.goto("/agenda");
    await expect(
      page.getByText(/Semana do \d+º|Semana dos encontros|Semana/).first()
    ).toBeVisible();
  });

  test("agendar encontro pela home persiste de verdade", async ({ page }) => {
    // CTA da home do mentor — o dialog abre com a data oficial sugerida
    await page.getByRole("button", { name: "Agendar encontro" }).first().click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    // a sugestão pré-preenche o datetime — sem mexer, sem motivo
    await dialog
      .getByRole("button", { name: "Confirmar agendamento" })
      .click();

    // toast de sucesso e o dialog fecha — o refresh traz o card novo
    await expect(page.getByText(/encontro agendado/i)).toBeVisible();
    await expect(dialog).not.toBeVisible();

    // limpeza: encontros criados pela fixture de teste (dupla e2e)
    const numero = 1;
    await limparViaServiceRole(
      "encontros",
      `dupla_id=eq.${DUPLA_ID}&numero=eq.${numero}`
    );
  });
});
