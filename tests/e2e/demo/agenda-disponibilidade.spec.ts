import { entrarNaDemo, expect, test } from "../helpers";

// REALIZA-24 — overlay de disponibilidade na agenda do mentor DPP, na
// superfície demo. A persona mentor_dpp (Ricardo) tem grade {ter,qui +
// noite} e a mentorada da dupla ativa dele (Bia) também — as células de
// ter/qui do mês pintam o split diagonal e falam "ambos livres". Público,
// sem writes: vale em qualquer deploy, produção inclusive.

test("agenda do mentor demo: legenda + tinta 'ambos livres' + detalhe do dia", async ({
  page,
}) => {
  await entrarNaDemo(page, "mentor_dpp");
  await page.goto("/agenda");

  // legenda com os três estados — aparece porque os dois lados têm grade
  await expect(page.getByText("Disponibilidade:")).toBeVisible();
  await expect(page.getByText("Você livre", { exact: true })).toBeVisible();
  await expect(
    page.getByText("Mentorado livre", { exact: true })
  ).toBeVisible();
  await expect(
    page.getByText("Ambos livres", { exact: true })
  ).toBeVisible();

  // terças/quintas do mês: dow casa nos dois lados e o período é o mesmo —
  // a célula fala "ambos livres" e veste o gradiente diagonal
  const celAmbos = page
    .getByRole("button", { name: /, ambos livres$/ })
    .first();
  await expect(celAmbos).toBeVisible();
  await expect(
    page
      .locator('div[role="gridcell"] button span[style*="linear-gradient"]')
      .first()
  ).toBeAttached();

  // o detalhe do dia nomeia quem tá livre com o período de cada um
  await celAmbos.click();
  const linha = page
    .locator('section[aria-label="Detalhe do dia selecionado"]')
    .getByText(/Disponível neste dia:/);
  await expect(linha).toBeVisible();
  await expect(linha).toContainText("você");
  await expect(linha).toContainText("Bia");
  await expect(linha).toContainText("à noite");
});

test("agenda demo da coordenação não tem o overlay", async ({ page }) => {
  await entrarNaDemo(page, "coordenacao");
  await page.goto("/agenda");

  // coord aterrissa na visão "semana"; troca pra "mês" — nem assim a grade
  // pinta: o overlay é prop exclusiva do mentor DPP
  await page
    .locator("label", {
      has: page.locator('input[name="agenda-visao"][value="mes"]'),
    })
    .click();
  await expect(page.locator('div[role="grid"]')).toBeVisible();
  await expect(page.getByText("Disponibilidade:")).toHaveCount(0);
  await expect(page.getByRole("button", { name: /livre/ })).toHaveCount(0);
});
