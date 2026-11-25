import { entrarNaDemo, expect, test } from "../helpers";

// O gesto/botão de voltar do mobile deve fechar o modal aberto, não sair da
// rota. Fechar pela UI também não pode deixar uma entrada fantasma: o voltar
// seguinte precisa navegar de verdade.

test.use({ viewport: { width: 390, height: 844 } });

test("voltar fecha o dialog e mantém a rota; fechar pela UI limpa o histórico", async ({
  page,
}) => {
  await entrarNaDemo(page, "coordenacao");
  await page.goto("/");
  await page.goto("/pessoas");
  await expect(page.getByRole("heading", { name: "Pessoas" })).toBeVisible();

  const dialog = page.getByRole("dialog");
  await page.getByRole("button", { name: /Nova pessoa/ }).first().click();
  await expect(dialog).toBeVisible();

  await page.goBack();
  await expect(dialog).toHaveCount(0);
  expect(new URL(page.url()).pathname).toBe("/pessoas");

  // fecha pela UI: o history.back() do cleanup não pode comer a próxima rota
  await page.getByRole("button", { name: /Nova pessoa/ }).first().click();
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Fechar" }).click();
  await expect(dialog).toHaveCount(0);

  await page.goBack();
  await page.waitForURL((url) => url.pathname === "/");
});

test("voltar fecha o menu lateral mobile", async ({ page }) => {
  await entrarNaDemo(page, "coordenacao");
  await page.goto("/");

  await page.getByRole("button", { name: /^Menu/ }).first().click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();

  await page.goBack();
  await expect(dialog).toHaveCount(0);
  expect(new URL(page.url()).pathname).toBe("/");
});
