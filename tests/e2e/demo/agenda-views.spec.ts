import { entrarNaDemo, expect, test } from "../helpers";

// REALIZA-25 (superfície demo) — as mesmas visões novas do mentor, mas sobre
// o dataset evergreen: Ricardo (mentor_dpp) com {ter,qui}/{noite} × Bia
// {ter,qui}/{noite} → ter/qui pintam "ambos" nas duas grades. Tudo lê, nada
// escreve: a action devolve o toast do modo demo ("Modo demonstração. Nada
// é gravado de verdade.") e o dataset não muda.
const DEMO_MSG = "Modo demonstração. Nada é gravado de verdade.";

test.describe("agenda demo — visões Semana e Horários (REALIZA-25)", () => {
  test.use({ timezoneId: "America/Sao_Paulo" });

  test("mentor demo: chips, tinta na grade de horas e slot abre o diálogo", async ({
    page,
  }) => {
    await entrarNaDemo(page, "mentor_dpp");
    await page.goto("/agenda");

    // três chips do mentor — horários incluído (a coord não tem esse)
    for (const v of ["mes", "semana", "horarios"])
      await expect(
        page.locator(`input[name="agenda-visao"][value="${v}"]`)
      ).toBeAttached();

    await page
      .locator("label", {
        has: page.locator('input[name="agenda-visao"][value="horarios"]'),
      })
      .click();

    // o grid horário — o template de colunas distingue do rail (ambos usam
    // .scroll-fina); a tinta "ambos" assina linear-gradient(135deg — a trama
    // de linhas é repeating-linear-gradient e ficaria num contains largo
    const grade = page.locator("div[class*='grid-cols-[2.5rem']");
    // a régua de horas cobre a noite inteira
    await expect(grade.getByText("19h", { exact: true })).toBeVisible();

    // Ricardo × Bia cruzam à noite de ter/qui — o split "ambos" pinta as
    // quatro faixas 18–21h nos dois dias (diagonal, como na visão real)
    await expect(
      grade.locator('span[style*="linear-gradient(135deg"]')
    ).toHaveCount(8);

    // clique num slot vazio (quarta ~10h — fora da tinta e longe do bloco do
    // 5º encontro, que fica na terça às 19h) abre o diálogo de agendamento
    const qua = page.getByRole("button", {
      name: /^Agendar encontro na quarta-feira/,
    });
    await expect(qua).toBeVisible();
    const box = await qua.boundingBox();
    if (!box) throw new Error("coluna sem bounding box");
    await qua.click({
      position: { x: box.width / 2, y: box.height * 0.25 },
    });

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    // a dupla demo já tem alvo → o diálogo abre em modo remarcação
    await expect(
      dialog.getByRole("heading", { name: /º encontro/ })
    ).toBeVisible();
    await expect(dialog.locator("#data_hora")).toBeVisible();
    await page.screenshot({ path: "/tmp/realiza25-demo-dialog.png" });

    // submit não persiste: a action responde o toast do modo demo
    await dialog
      .getByRole("button", { name: /^Confirmar/ })
      .click();
    await expect(page.getByText(DEMO_MSG)).toBeVisible();
  });

  test("coordenação demo não tem a visão de horários", async ({ page }) => {
    await entrarNaDemo(page, "coordenacao");
    await page.goto("/agenda");

    for (const v of ["semana", "mes", "lista"])
      await expect(
        page.locator(`input[name="agenda-visao"][value="${v}"]`)
      ).toBeAttached();
    await expect(
      page.locator('input[name="agenda-visao"][value="horarios"]')
    ).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: /^Agendar encontro na / })
    ).toHaveCount(0);
  });
});
