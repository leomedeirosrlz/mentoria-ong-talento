import { entrarNaDemo, expect, test } from "../helpers";

// REALIZA-157 — o menu "Mais" da ficha tinha itens híbridos
// (Dialog.Trigger render={Menu.Item}) que não preenchiam a largura do
// popup e exigiam o Portal keepMounted. Agora cada item é um menuitem
// comum: preenche a linha inteira, abre o dialog irmão e devolve o foco
// pro "Mais" ao fechar. Spec demo — leitura só, segura em qualquer
// ambiente (o "Enviar formulário" abre o dialog; nada é submetido).

const DUPLA_OK = "de000000-0000-4000-8000-000000001537"; // Ricardo × Ana

test.describe("demo — menu Mais da ficha", () => {
  test("itens preenchem o popup, dialog abre e foco volta pro Mais", async ({
    page,
  }) => {
    await entrarNaDemo(page, "coordenacao");
    await page.goto(`/duplas/${DUPLA_OK}`);

    const mais = page.getByRole("button", { name: "Mais" });
    await mais.click();
    const popup = page.locator('[data-slot="dropdown-menu-content"]');
    await expect(popup).toBeVisible();
    // coord em dupla ativa: "Enviar formulário" + "Solicitar mentor
    // especialista" (as solicitações da d-ok estão todas aceitas)
    const itens = popup.getByRole("menuitem");
    await expect(itens).toHaveCount(2);

    // assert positivo do fix: cada item é a linha inteira do popup —
    // p-1 do container desconta os 8px de respiro lateral
    const box = await popup.boundingBox();
    expect(box).not.toBeNull();
    for (const item of await itens.all()) {
      const b = await item.boundingBox();
      expect(Math.abs(b!.width - (box!.width - 8))).toBeLessThan(2);
    }

    // a largura vira hit-target: o clique abre o dialog controlado e o
    // Esc devolve o foco pro "Mais" — o ciclo que o keepMounted quebrava
    await popup
      .getByRole("menuitem", { name: "Enviar formulário" })
      .click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(dialog).not.toBeVisible();
    await expect(mais).toBeFocused();

    // reabrir mostra o mesmo menu — o estado dos dialogs não vaza
    await mais.click();
    await expect(popup.getByRole("menuitem")).toHaveCount(2);
  });
});
