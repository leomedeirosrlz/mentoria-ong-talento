import { entrarNaDemo, expect, test } from "../helpers";

// REALIZA-157 — o menu "Mais" da ficha tinha itens híbridos
// (Dialog.Trigger render={Menu.Item}) que não preenchiam a largura do
// popup e exigiam o Portal keepMounted. Agora cada item é um menuitem
// comum: preenche a linha inteira, abre o dialog irmão e devolve o foco
// pro "Mais" ao fechar. Spec demo — leitura só, segura em qualquer
// ambiente (o "Enviar formulário" abre o dialog; nada é submetido).

// A prova pede uma dupla DPP ativa SEM solicitação de especialista em
// aberto. A d-ok (Ricardo × Ana) não serve mais: o dataset ganhou pedidos
// vivos pra ela ("contra_proposta" + "aberta" em data.ts) e a ficha
// esconde "Solicitar mentor especialista" enquanto um pedido ocupa a vaga
// (solEmAberto em duplas/[id]/page.tsx). A d-t2b (Luiza × Laura, T2
// ativa, nenhuma solicitação no fixture) preserva o recorte medido aqui.
//
// Rodada out/2026: "Remanejar" saiu do header e virou item do "Mais" —
// pra coordenação em dupla ativa são TRÊS itens (Enviar formulário +
// Solicitar mentor especialista + Remanejar dupla).
const DUPLA_SEM_PEDIDO = "de000000-0000-4000-8000-000000001548"; // Luiza × Laura

test.describe("demo — menu Mais da ficha", () => {
  test("itens preenchem o popup, dialog abre e foco volta pro Mais", async ({
    page,
  }) => {
    await entrarNaDemo(page, "coordenacao");
    await page.goto(`/duplas/${DUPLA_SEM_PEDIDO}`);

    const mais = page.getByRole("button", { name: "Mais ações da dupla" });
    await mais.click();
    const popup = page.locator('[data-slot="dropdown-menu-content"]');
    await expect(popup).toBeVisible();
    // coord em dupla ativa sem pedido aberto: "Enviar formulário" +
    // "Solicitar mentor especialista" + "Remanejar dupla" (out/2026)
    const itens = popup.getByRole("menuitem");
    await expect(itens).toHaveCount(3);
    await expect(
      itens.getByText("Enviar formulário", { exact: true })
    ).toBeVisible();
    await expect(
      itens.getByText("Solicitar mentor especialista", { exact: true })
    ).toBeVisible();
    await expect(
      itens.getByText("Remanejar dupla", { exact: true })
    ).toBeVisible();

    // assert positivo do fix: cada item é a linha inteira do popup —
    // p-1 do container desconta os 8px de respiro lateral. A medição é uma
    // evaluate só: o popup entra com zoom-in-95 (~150ms) e medir popup e
    // item em awaits separados lia dois scales da animação (a diferença
    // entre as fases estourava a régua de 2px em preview frio). Na mesma
    // chamada o scale cancela exato — 8·(1-s) nunca passa de 0.4px.
    const diffs = await popup.evaluate((el) =>
      [...el.querySelectorAll('[role="menuitem"]')].map((item) =>
        Math.abs(
          item.getBoundingClientRect().width -
            (el.getBoundingClientRect().width - 8)
        )
      )
    );
    expect(diffs).toHaveLength(3);
    for (const d of diffs) expect(d).toBeLessThan(2);

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
    await expect(popup.getByRole("menuitem")).toHaveCount(3);
  });
});
