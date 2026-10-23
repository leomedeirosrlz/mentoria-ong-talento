import { entrarNaDemo, expect, test } from "../helpers";

// REALIZA-159 — promoção de ex-mentorado a mentor. O item "Promover a
// mentor…" só aparece no ⋮ de quem tem situacao='concluido' (seção "Fora
// do programa" / ficha do jovem); o dialog abre, deixa escolher DPP (com
// turma de escopo) ou especialista, e o submit em demo volta a mensagem de
// demonstração — nada é gravado. Spec de leitura: segura em qualquer
// ambiente.
//
// Locators: o ⋮ da ficha não se chama mais "Ações" — a varredura de a11y
// namespaciou os gatilhos por alvo e o botão lê 'Ações de "<nome>"'
// (aria-label em mentorado-actions.tsx). Outros ⋮ da ficha dividem o
// prefixo ("Ações de \"<documento>\"" em assinaturas/arquivos), então o
// nome precisa ancorar na pessoa. Os itens do menu também mudaram pra
// reticência "…" — /^Promover a mentor/ e /^Marcar saída/ cobrem o label
// novo e o legado sem ela.

const ISABELA = "de000000-0000-4000-8000-000000001029"; // concluída, com e-mail
const GUSTAVO = "de000000-0000-4000-8000-000000001036"; // concluído, sem e-mail
const KAUA = "de000000-0000-4000-8000-000000001030"; // ativo (0x0406)

test.describe("demo — promover ex-mentorado a mentor", () => {
  test("item aparece só em concluído, dialog completo e submit avisa demo", async ({
    page,
  }) => {
    await entrarNaDemo(page, "coordenacao");

    // ficha da concluída — o ⋮ dela oferece a promoção (regex casa o
    // 'Ações de "Isabela Ferreira"' atual e o "Ações" legado)
    await page.goto(`/pessoas/${ISABELA}`);
    await page
      .getByRole("button", { name: /^Ações( de "Isabela Ferreira")?$/ })
      .click();
    const popup = page.locator('[data-slot="dropdown-menu-content"]');
    const item = popup.getByRole("menuitem", { name: /^Promover a mentor/ });
    await expect(item).toBeVisible();
    await item.click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(
      dialog.getByRole("heading", { name: "Promover Isabela a mentor" })
    ).toBeVisible();

    // DPP é o default e pede a turma de escopo (as duas turmas ativas da
    // demo vêm dos cronogramas); especialista esconde o seletor
    const seletor = dialog.getByRole("combobox");
    await expect(seletor).toBeVisible();
    await seletor.click();
    const opcoes = page.getByRole("option");
    await expect(opcoes).toHaveCount(2);
    await opcoes.filter({ hasText: "T2 · 2026/2027" }).click();

    await dialog.getByRole("radio", { name: /Mentor especialista/ }).check();
    await expect(dialog.getByRole("combobox")).toHaveCount(0);
    await dialog.getByRole("radio", { name: /Mentor de jornada/ }).check();
    await expect(dialog.getByRole("combobox")).toBeVisible();

    // submit em demo → a action responde a mensagem de demonstração no
    // alert inline do dialog (nada é gravado)
    await dialog
      .getByRole("button", { name: /Promover pra jornada/ })
      .click();
    await expect(
      dialog.getByRole("alert")
    ).toContainText("Modo demonstração");
  });

  test("sem e-mail o aviso de conta fica no dialog; ativo não tem o item", async ({
    page,
  }) => {
    await entrarNaDemo(page, "coordenacao");

    // Gustavo concluiu mas nunca teve conta nem e-mail — o dialog trava o
    // submit e explica o que falta (a RPC confirmaria com erro claro)
    await page.goto(`/pessoas/${GUSTAVO}`);
    await page
      .getByRole("button", { name: /^Ações( de "Gustavo Batista")?$/ })
      .click();
    await page
      .locator('[data-slot="dropdown-menu-content"]')
      .getByRole("menuitem", { name: /^Promover a mentor/ })
      .click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText("magic link precisa de um e-mail");
    await expect(
      dialog.getByRole("button", { name: /Promover pra/ })
    ).toBeDisabled();
    await page.keyboard.press("Escape");

    // mentorado ativo: promoção não existe no menu — só saída
    await page.goto(`/pessoas/${KAUA}`);
    await page
      .getByRole("button", { name: /^Ações( de "Kauã Rodrigues")?$/ })
      .click();
    const popup = page.locator('[data-slot="dropdown-menu-content"]');
    await expect(
      popup.getByRole("menuitem", { name: /^Promover a mentor/ })
    ).toHaveCount(0);
    await expect(
      popup.getByRole("menuitem", { name: /^Marcar saída/ })
    ).toBeVisible();
  });
});
