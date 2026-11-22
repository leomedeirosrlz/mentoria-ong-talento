import { entrarNaDemo, expect, test } from "../helpers";

// REALIZA-495 — a mutation bloqueada da demo volta com DEMO_MSG e a tela
// chama toast.error() com ela; o wrapper de @/lib/toast desvia só essa
// mensagem pra info. O aviso "nada foi gravado" não pode sair vermelho.
// O Sonner marca cada toast com data-type — é o tipo real renderizado,
// não um seletor inventado.
const DEMO_MSG = "Modo demonstração. Nada é gravado de verdade.";

test.describe("demo — toast neutro da mutation bloqueada (REALIZA-495)", () => {
  test("salvar o perfil devolve DEMO_MSG como info, nunca erro", async ({
    page,
  }) => {
    await entrarNaDemo(page, "mentor_dpp");
    await page.goto("/perfil");

    // lápis do card "Perfil público" → Salvar bate em updateMeuPerfil,
    // que na demo responde { error: DEMO_MSG }
    await page
      .getByRole("button", { name: "Editar perfil público" })
      .click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Salvar" })
      .click();

    const neutro = page.locator('[data-sonner-toast][data-type="info"]', {
      hasText: DEMO_MSG,
    });
    await expect(neutro).toBeVisible({ timeout: 15_000 });
    await expect(
      page.locator('[data-sonner-toast][data-type="error"]', {
        hasText: DEMO_MSG,
      })
    ).toHaveCount(0);
  });
});
