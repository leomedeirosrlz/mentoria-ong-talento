import { entrarNaDemo, expect, test } from "../helpers";

// REALIZA-482 — "O combinado" na agenda do jovem: a janela e o ritmo do
// plano ficam visíveis, cada passo vira uma linha com sugestão
// pré-preenchida (data do passo + horário do histórico, 19:00 de padrão)
// que o jovem só confirma — ou troca dia/hora no seletor compartilhado.
// O plano demo da Bia/Ana (d-ok) tem o 5º aplicado e o 6º pendente.

const card = (page: Parameters<typeof entrarNaDemo>[0]) =>
  page.locator("div.rounded-xl", {
    has: page.getByRole("heading", { name: "O combinado" }),
  });

const D_OK = "de000000-0000-4000-8000-000000001537";

test.describe("o combinado — jovem confirma a sugestão", () => {
  test("janela, ritmo e linhas por passo; confirmar em um toque", async ({
    page,
  }) => {
    await entrarNaDemo(page, "mentorado");
    await page.goto("/jovem/agenda");
    const c = card(page);
    await expect(c).toBeVisible();
    // a janela do plano e o ritmo no cabeçalho do card
    await expect(
      c.getByText(/De \d{2}\/\d{2} a \d{2}\/\d{2}/)
    ).toBeVisible();
    await expect(c.getByText("até 2 encontros por semana")).toBeVisible();
    // passo aplicado lê a data marcada e não volta a formulário
    await expect(c.getByText("5º encontro")).toBeVisible();
    await expect(
      c.getByText(/marcado pra \w{3} \d{2}\/\d{2} às \d{2}:\d{2}/)
    ).toBeVisible();
    // passo pendente: sugestão pré-preenchida (a Bia se encontra às 19:00)
    // — a data é evergreen (HOJE+9), então o recorte é o formato civil
    const linha6 = c.locator("li").filter({ hasText: "6º encontro" });
    await expect(linha6).toContainText(
      /sugestão \w{3} \d{2}\/\d{2} às 19:00/
    );
    // um toque: Confirma sem digitar nada → a linha vira "Marcado pra…"
    await c.getByRole("button", { name: "Confirmar" }).click();
    await expect(
      c.getByText(/Marcado pra \w{3} \d{2}\/\d{2} às 19:00/)
    ).toBeVisible();
    await expect(
      c.getByRole("button", { name: "Confirmar" })
    ).toHaveCount(0);
  });

  test("Outra data abre o seletor de dia e hora, sem datetime-local", async ({
    page,
  }) => {
    await entrarNaDemo(page, "mentorado");
    await page.goto("/jovem/agenda");
    const c = card(page);
    await c.getByRole("button", { name: "Outra data" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(
      dialog.getByRole("radiogroup", { name: "Dia do encontro" })
    ).toBeVisible();
    await expect(
      dialog.locator('input[type="datetime-local"]')
    ).toHaveCount(0);
    // a grade só oferece 19:00; troca pela saída rara "Outro horário"
    await dialog
      .getByRole("radio", { name: /Outro horário/ })
      .click();
    await dialog.getByLabel("Escolher outro horário").fill("19:30");
    await expect(
      dialog.getByRole("button", { name: "Confirmar data" })
    ).toBeEnabled();
    await dialog.getByRole("button", { name: "Confirmar data" }).click();
    await expect(
      c.getByText(/Marcado pra \w{3} \d{2}\/\d{2} às 19:30/)
    ).toBeVisible();
  });
});

test.describe("o combinado — staff", () => {
  test("mentor lê a ficha com a mesma linha e pode confirmar", async ({
    page,
  }) => {
    await entrarNaDemo(page, "mentor_dpp");
    await page.goto(`/duplas/${D_OK}`);
    const regiao = page.getByRole("region", {
      name: "Acordos e intervenções",
    });
    await expect(
      regiao.getByText(/De \d{2}\/\d{2} a \d{2}\/\d{2}/)
    ).toBeVisible();
    await expect(regiao.getByText("6º encontro")).toBeVisible();
    await expect(
      regiao.getByRole("button", { name: "Confirmar" })
    ).toBeVisible();
  });

  test("coordenação lê o combinado sem CTA de aplicar passo", async ({
    page,
  }) => {
    await entrarNaDemo(page, "coordenacao");
    await page.goto(`/duplas/${D_OK}`);
    const regiao = page.getByRole("region", {
      name: "Acordos e intervenções",
    });
    await expect(regiao.getByText("6º encontro")).toBeVisible();
    await expect(
      regiao.getByText(/sugestão \w{3} \d{2}\/\d{2} às \d{2}:\d{2}/)
    ).toBeVisible();
    await expect(
      regiao.getByRole("button", { name: "Confirmar" })
    ).toHaveCount(0);
  });
});

test.describe("o combinado — 390px", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("card cabe na tela e o Confirmar segue acessível", async ({ page }) => {
    await entrarNaDemo(page, "mentorado");
    await page.goto("/jovem/agenda");
    const c = card(page);
    await expect(c).toBeVisible();
    await expect(c.getByText(/De \d{2}\/\d{2} a/)).toBeVisible();
    await expect(
      c.getByRole("button", { name: "Confirmar" })
    ).toBeVisible();
    const scrollWidth = await page.evaluate(
      () => document.documentElement.scrollWidth
    );
    expect(scrollWidth).toBeLessThanOrEqual(390);
  });
});
