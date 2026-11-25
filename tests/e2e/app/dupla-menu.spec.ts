import { test, expect } from "@playwright/test";
import { agirComConfirma } from "../helpers";

async function loginCoord(page: import("@playwright/test").Page) {
  await page.goto("/login");
  const opcaoSenha = page.locator("label", {
    has: page.locator('input[name="modo-login"][value="senha"]'),
  });
  await agirComConfirma(
    () => opcaoSenha.click(),
    () => page.locator("#senha").isVisible()
  );
  await page.locator("#email").fill("coord@realiza.test");
  await page.locator("#senha").fill("realiza123");
  await page.getByRole("button", { name: "Entrar" }).click();
  await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 30_000 });
}

async function itensMenu(page: import("@playwright/test").Page) {
  await page.waitForTimeout(400);
  const itens = await page.getByRole("menuitem").allInnerTexts();
  await page.keyboard.press("Escape");
  await page.waitForTimeout(200);
  return itens;
}

// a saudação da Liza nasce aberta no canto ~3s depois da navegação e cobre
// o ⋯ das linhas baixas — espera a janela dela e dispensa antes de clicar,
// senão o hit acerta o popover em vez do menu
async function dispensarLiza(page: import("@playwright/test").Page) {
  const btn = page.getByRole("button", {
    name: "Dispensar mensagem da Liza",
  });
  await btn.waitFor({ state: "visible", timeout: 6_000 }).catch(() => {});
  if (await btn.isVisible()) await btn.click();
}

test("menu ⋯ em dupla ativa mostra Editar + Enviar formulário + Remanejar", async ({ page }) => {
  await loginCoord(page);
  await page.goto("/duplas?recorte=ativa");
  await page.waitForTimeout(2500);
  await dispensarLiza(page);
  const botoes = page.getByRole("button", { name: "Ações da dupla" });
  expect(await botoes.count()).toBeGreaterThan(0);
  await botoes.first().click({ force: true });
  const itens = await itensMenu(page);
  expect(itens).toContain("Editar dupla");
  expect(itens).toContain("Enviar formulário");
  expect(itens).toContain("Remanejar dupla");
});

test("menu ⋯ em dupla encerrada mostra Editar + Enviar formulário", async ({ page }) => {
  await loginCoord(page);
  await page.goto("/duplas?recorte=encerrada");
  await page.waitForTimeout(2500);
  await dispensarLiza(page);
  const botoes = page.getByRole("button", { name: "Ações da dupla" });
  const n = await botoes.count();
  expect(n).toBeGreaterThan(0);
  for (let i = 0; i < n; i++) {
    await botoes.nth(i).click({ force: true });
    const itens = await itensMenu(page);
    expect(itens).toContain("Editar dupla");
    expect(itens).toContain("Enviar formulário");
  }
});

test("menu ⋯ em rito decidido (encerramento) mostra Editar + Enviar formulário", async ({ page }) => {
  await loginCoord(page);
  await page.goto("/relatorios/operacionais?aba=encerramento");
  await page.waitForTimeout(2500);
  const decididos = page.getByRole("button", { name: /Decididos/ });
  if (await decididos.isVisible()) await decididos.click();
  await page.waitForTimeout(600);
  await dispensarLiza(page);
  const botoes = page.getByRole("button", { name: "Ações da dupla" });
  const n = await botoes.count();
  expect(n).toBeGreaterThan(0);
  await botoes.first().click({ force: true });
  const itens = await itensMenu(page);
  expect(itens).toContain("Editar dupla");
  expect(itens).toContain("Enviar formulário");
});
