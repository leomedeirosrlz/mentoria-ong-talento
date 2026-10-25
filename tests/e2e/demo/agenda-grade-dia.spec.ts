import { entrarNaDemo, expect, test } from "../helpers";

// REALIZA-163 (superfície demo) — a agenda ganha a visão "Dia" (o detalhe
// do dia selecionado em largura cheia, navegando dia a dia). O editor de
// grade que morava aqui saiu na REALIZA-207: horários do especialista se
// editam no perfil (ver agenda-especialista.spec.ts). Público, sem writes.

test.describe("REALIZA-163 — visão Dia do calendário (demo)", () => {
  test.use({ timezoneId: "America/Sao_Paulo" });

  test("mentor demo: chip Dia abre a data cheia e 'Agendar neste dia' vai pros Horários", async ({
    page,
  }) => {
    await entrarNaDemo(page, "mentor_dpp");
    await page.goto("/agenda?aba=calendario");

    // o chip "Dia" entra no switcher do mentor (dia/mês/semana/horários)
    const chipDia = page.locator("label", {
      has: page.locator('input[name="agenda-visao"][value="dia"]'),
    });
    await expect(chipDia).toBeVisible();
    await chipDia.click();

    // a visão abre no dia selecionado: chrome navegando por dia + a data
    // por extenso ("Terça-feira, 27 de outubro") como heading
    await expect(
      page.getByRole("button", { name: "Dia anterior" })
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Próximo dia" })
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: /, \d{1,2} de / })
    ).toBeVisible();

    // navegar anda de um dia — o rótulo live-region acompanha
    const rotulo = page.locator("#agenda-mes-rotulo");
    const antes = await rotulo.textContent();
    await page.getByRole("button", { name: "Próximo dia" }).click();
    await expect(rotulo).not.toHaveText(antes ?? "");

    // o atalho de agendamento do mentor pousa na grade de horários da
    // semana do dia — a mesma troca do chip "Horários"
    await page
      .getByRole("button", { name: "Agendar neste dia" })
      .click();
    await expect(
      page.locator("div[class*='grid-cols-[2.5rem']")
    ).toBeVisible();
  });

  test("coordenação demo: chip Dia existe e renderiza o detalhe do dia", async ({
    page,
  }) => {
    await entrarNaDemo(page, "coordenacao");
    await page.goto("/agenda?aba=calendario");

    const chipDia = page.locator("label", {
      has: page.locator('input[name="agenda-visao"][value="dia"]'),
    });
    await expect(chipDia).toBeVisible();
    await chipDia.click();

    await expect(
      page.getByRole("button", { name: "Dia anterior" })
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: /, \d{1,2} de / })
    ).toBeVisible();
    // coord não agenda — o atalho de mentor não aparece pra ela
    await expect(
      page.getByRole("button", { name: "Agendar neste dia" })
    ).toHaveCount(0);
  });
});
