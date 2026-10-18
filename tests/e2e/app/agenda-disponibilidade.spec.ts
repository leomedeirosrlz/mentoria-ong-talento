import {
  appEnvOk,
  expect,
  loginComSenha,
  relogar,
  test,
} from "../helpers";

// REALIZA-24 — overlay "quem pode nesse dia" na agenda do mentor DPP: as
// células do mês ganham tinta por lado livre (verde = mentor, amarelo =
// mentorado, gradiente diagonal = ambos com período em comum), a legenda
// explica as cores e o detalhe do dia nomeia quem tá livre com o período.
//
// Fixture do scripts/seed-e2e-staging.mjs: mentor …0010 com
// mentor_profiles.disponibilidade {ter,qui,sab + noite} e a mentorada
// …0020 da dupla ativa com {ter,qui + noite} — ter/qui pintam "ambos
// livres", sábado "você livre". O seed converge as grades a cada run; o
// spec só lê.
const EMAIL = process.env.E2E_MENTOR_EMAIL ?? "";
const SENHA = process.env.E2E_MENTOR_PASSWORD ?? "";
const COORD_EMAIL = process.env.E2E_COORD_EMAIL ?? "e2e-coord@realiza.test";
const COORD_SENHA = process.env.E2E_COORD_PASSWORD ?? "";

test.skip(!appEnvOk(), "sem credenciais de teste (E2E_*) — pula specs de app");

test.describe("agenda — overlay de disponibilidade do mentor (REALIZA-24)", () => {
  test.beforeEach(async ({ page }) => {
    await loginComSenha(page, EMAIL, SENHA);
  });

  test("mentor vê legenda, células tintas e o detalhe do dia", async ({
    page,
  }) => {
    // WP3: a agenda do mentor abre em "Minha agenda" — o overlay vive na
    // aba calendário
    await page.goto("/agenda?aba=calendario");

    // legenda "Disponibilidade:" com os três estados — só existe porque
    // algum lado tem grade preenchida
    await expect(page.getByText("Disponibilidade:")).toBeVisible();
    await expect(
      page.getByText("Você livre", { exact: true })
    ).toBeVisible();
    await expect(
      page.getByText("Mentorado livre", { exact: true })
    ).toBeVisible();
    await expect(
      page.getByText("Ambos livres", { exact: true })
    ).toBeVisible();

    // células tintas: o aria-label do dia carrega quem tá livre — sábado é
    // só do mentor ("você livre"), ter/qui cruzam com a mentorada
    const celVoce = page
      .getByRole("button", { name: /, você livre$/ })
      .first();
    const celAmbos = page
      .getByRole("button", { name: /, ambos livres$/ })
      .first();
    await expect(celVoce).toBeVisible();
    await expect(celAmbos).toBeVisible();

    // o split "ambos" desenha um gradiente diagonal inline na célula —
    // o swatch da legenda também usa gradiente, então o filtro é a célula
    await expect(
      page
        .locator('div[role="gridcell"] button span[style*="linear-gradient"]')
        .first()
    ).toBeAttached();

    const detalhe = page.locator(
      'section[aria-label="Detalhe do dia selecionado"]'
    );

    // dia "ambos": a linha nomeia os dois lados com o período de cada um
    await celAmbos.click();
    const linhaAmbos = detalhe.getByText(/Disponível neste dia:/);
    await expect(linhaAmbos).toBeVisible();
    await expect(linhaAmbos).toContainText("você");
    await expect(linhaAmbos).toContainText("Mentorada");
    // período da grade — "à noite" (os dois lados marcam só noite)
    await expect(linhaAmbos).toContainText("à noite");

    // dia "só mentor": a linha lista só o lado livre — o nome da mentorada
    // não pode entrar
    await celVoce.click();
    const linhaVoce = detalhe.getByText(/Disponível neste dia:/);
    await expect(linhaVoce).toBeVisible();
    await expect(linhaVoce).toContainText("você");
    await expect(linhaVoce).not.toContainText("Mentorada");
  });

  test("coordenação não vê overlay — nem na visão de mês", async ({
    page,
  }) => {
    await relogar(page, COORD_EMAIL, COORD_SENHA);
    await page.goto("/agenda?aba=calendario");

    // a visão default da coord é "semana"; troca pra "mês" — o overlay é
    // prop só do mentor (undefined pra coord), a grade não pinta pra ela
    await page
      .locator("label", {
        has: page.locator('input[name="agenda-visao"][value="mes"]'),
      })
      .click();

    await expect(page.locator('div[role="grid"]')).toBeVisible();
    await expect(page.getByText("Disponibilidade:")).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: /livre/ })
    ).toHaveCount(0);
    await expect(
      page.locator('div[role="gridcell"] button span[style*="linear-gradient"]')
    ).toHaveCount(0);
  });
});
