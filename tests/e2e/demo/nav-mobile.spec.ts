import { entrarNaDemo, expect, test } from "../helpers";

// REALIZA-221 — navegação do celular: 4 destinos fixos por papel + Menu,
// que abre a navegação inteira num painel lateral (o drop-up "Mais" saiu).
// Público, sem writes.

test.describe("navegação do celular", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("coordenação: Chamados na barra e o resto no menu lateral", async ({
    page,
  }) => {
    await entrarNaDemo(page, "coordenacao");
    await page.goto("/");

    const barra = page.getByRole("navigation", { name: "Navegação principal" }).last();
    for (const nome of ["Início", "Duplas", "Chamados", "Agenda"]) {
      await expect(barra.getByRole("link", { name: new RegExp(`^${nome}`) })).toBeVisible();
    }
    await expect(barra.getByRole("link", { name: /^Pessoas/ })).toHaveCount(0);

    await barra.getByRole("button", { name: /^Menu/ }).click();
    const menu = page.getByRole("dialog", { name: "Menu" });
    await expect(menu).toBeVisible();
    // a navegação inteira, agrupada como na sidebar, + perfil e sair
    await expect(menu.getByText("Dados", { exact: true })).toBeVisible();
    await expect(menu.getByRole("button", { name: /Sair/ })).toBeVisible();

    // navegar fecha o painel e o Menu acende (a rota mora nele)
    await menu.getByRole("link", { name: "Registros" }).click();
    await page.waitForURL(/\/registros/);
    await expect(menu).toBeHidden();
    await expect(barra.getByRole("button", { name: /seção atual fora da barra/ })).toBeVisible();
  });

  test("mentor: Materiais na barra; Esc fecha o menu", async ({ page }) => {
    await entrarNaDemo(page, "mentor_dpp");
    await page.goto("/");
    const barra = page.getByRole("navigation", { name: "Navegação principal" }).last();
    await expect(barra.getByRole("link", { name: /^Materiais/ })).toBeVisible();
    await barra.getByRole("button", { name: /^Menu/ }).click();
    const menu = page.getByRole("dialog", { name: "Menu" });
    await expect(menu.getByRole("link", { name: "Pessoas" })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(menu).toBeHidden();
  });

  test("jovem: Especialistas e Jornada na barra", async ({ page }) => {
    await entrarNaDemo(page, "mentorado");
    await page.goto("/jovem");
    const barra = page.getByRole("navigation", { name: "Navegação principal" }).last();
    for (const nome of ["Início", "Especialistas", "Jornada", "Agenda"]) {
      await expect(barra.getByRole("link", { name: nome, exact: true })).toBeVisible();
    }
    await barra.getByRole("button", { name: /^Menu/ }).click();
    const menu = page.getByRole("dialog", { name: "Menu" });
    await expect(menu.getByRole("link", { name: "Perfil" })).toBeVisible();
    await expect(menu.getByRole("link", { name: "Pessoas" })).toBeVisible();
  });
});
