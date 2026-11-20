import { agirComConfirma, entrarNaDemo, expect, test } from "../helpers";

// REALIZA-473 (A7) — a rota dedicada de registro no modo demo: a superfície
// é a mesma da produção (cabeçalho, contexto, wizard) e o salvar devolve o
// aviso de demonstração em vez de gravar. Nada de rascunho persistido.
//
// Fixture d-T2c (Ricardo × Matheus, uid 0x060d): o 2º encontro está
// realizado sem registro — é a pendência que a home e a ficha cobram.
const DUPLA_T2C = "de000000-0000-4000-8000-00000000060d";
const DEMO_MSG = "Modo demonstração. Nada é gravado de verdade.";

test.describe("demo — rota de registro (REALIZA-473)", () => {
  test("o CTA da ficha abre a rota e salvar devolve o aviso da demo", async ({
    page,
  }) => {
    await entrarNaDemo(page, "mentor_dpp");
    await page.goto(`/duplas/${DUPLA_T2C}?aba=encontros`);

    // CTA primário da ficha já aponta pra rota (PR1)
    await page.getByRole("link", { name: "Registrar 2º encontro" }).click();
    await expect(page).toHaveURL(
      new RegExp(`/duplas/${DUPLA_T2C}/registrar/`)
    );
    await expect(
      page.getByRole("heading", { level: 1, name: "Registrar o 2º encontro" })
    ).toBeVisible();
    // a tarefa é a página: sem abas da ficha
    await expect(page.getByRole("tablist")).toHaveCount(0);

    const form = page.getByTestId("registro-form");
    await form.getByText("Boa", { exact: true }).click();
    await agirComConfirma(
      () => form.getByRole("button", { name: "Avançar" }).click(),
      () => form.getByRole("heading", { name: /Passo 2 de 3/ }).isVisible()
    );
    await agirComConfirma(
      () => form.getByRole("button", { name: "Avançar" }).click(),
      () => form.getByRole("heading", { name: /Passo 3 de 3/ }).isVisible()
    );
    await form.getByRole("button", { name: "Salvar registro" }).click();

    // AC-473.9: mesmo fluxo, sem escrita — o aviso é o retorno da action
    await expect(page.getByText(DEMO_MSG)).toBeVisible({ timeout: 15_000 });

    // a demo não persiste rascunho (nem lê o do visitante anterior)
    const drafts = await page.evaluate(() =>
      Object.keys(localStorage).filter((k) => k.startsWith("registro-draft-"))
    );
    expect(drafts).toEqual([]);
  });
});
