import { appEnvOk, expect, limparEncontrosDaDupla, loginComSenha, test } from "../helpers";

// Backend real (staging ou supabase local do CI): a fixture vem de
// scripts/seed-e2e-staging.mjs — mentor com dupla DPP ativa e senha. Specs
// escrevem de verdade e limpam via service role no afterEach.
const EMAIL = process.env.E2E_MENTOR_EMAIL ?? "";
const SENHA = process.env.E2E_MENTOR_PASSWORD ?? "";
const DUPLA_ID = process.env.E2E_DUPLA_ID ?? "";

test.skip(!appEnvOk(), "sem credenciais de teste (E2E_*) — pula specs de app");

test.describe("mentor DPP — fluxos reais", () => {
  test.beforeEach(async ({ page }) => {
    // o piso cobre o encontro que a fixture do shell /jovem semeia na MESMA
    // dupla (id e2e…00d1): se ele pendura (run morto entre arquivos ou spec
    // rodado solto), a home mostraria "encontro agendado" e o CTA "Agendar
    // encontro" do teste abaixo sumiria — a limpeza prévia parte do zero
    if (DUPLA_ID)
      await limparEncontrosDaDupla(DUPLA_ID);
    await loginComSenha(page, EMAIL, SENHA);
  });

  test.afterEach(async () => {
    // qualquer encontro que o spec criou na dupla fixture — independente do
    // assert ter passado ou não (um leftover "realizado" apaga o CTA "Agendar
    // encontro" da home e quebra o próximo run em cascata)
    if (DUPLA_ID)
      await limparEncontrosDaDupla(DUPLA_ID);
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
    // CTA da home do mentor — o dialog abre com a data oficial sugerida.
    await page.getByRole("button", { name: "Agendar encontro" }).first().click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();

    // a data oficial do seed é fixa e já passou — preencher ela cairia no
    // fluxo retroativo ("Registrar encontro"). O spec força data futura pra
    // exercitar o agendamento de verdade; o cleanup no afterEach desfaz.
    const futuro = new Date(Date.now() + 3 * 86400e3);
    const ymd = `${futuro.getFullYear()}-${String(futuro.getMonth() + 1).padStart(2, "0")}-${String(futuro.getDate()).padStart(2, "0")}`;
    await dialog.locator("#data_hora").fill(`${ymd}T19:00`);

    await dialog
      .getByRole("button", { name: "Confirmar agendamento" })
      .click();

    // toast de sucesso e o dialog fecha — o refresh traz o card novo.
    // O card da home também diz "Nº encontro agendado" (sem ponto) — o \.
    // ancora a regex no toast ("agendado.") pra não resolver 2 elementos.
    await expect(page.getByText(/encontro agendado\./i)).toBeVisible();
    await expect(dialog).not.toBeVisible();
  });
});
