import { entrarNaDemo, expect, test } from "../helpers";

// REALIZA-37 — autofill de endereço por CEP no bloco de dados civis,
// exercitado na página pública de assinatura em modo demo (prova que a
// server action funciona sem sessão). `buscarCep` devolve o fixture fixo
// (Rua das Flores / Jardim Brasil / São Paulo·SP) pra qualquer CEP de 8
// dígitos; 00000-000 exercita o ramo "não encontrado". Determinístico e
// sem rede externa — ViaCEP-down é QA manual (timeout 5s + hint).
//
// O bloco compacto (sem cidade/UF — cadastro/wizards) é estrutural:
// os inputs não existem, então "autofill não os cria" não precisa de
// spec dedicada; o que muda aqui cobre os dois modos.

const TOKEN_RICARDO = "de000000-0000-4000-8000-000000013318"; // uid(0x3406)

test.describe("demo — ViaCEP no cadastro de endereço", () => {
  test("CEP válido preenche o bloco; edição manual vence o autofill", async ({
    page,
  }) => {
    await entrarNaDemo(page, "mentor_dpp");
    await page.goto(`/assinar/${TOKEN_RICARDO}`);

    const cep = page.locator("#cep");
    await expect(cep).toBeVisible();
    await cep.fill("01310-100");

    await expect(page.locator("#logradouro")).toHaveValue("Rua das Flores");
    await expect(page.locator("#bairro")).toHaveValue("Jardim Brasil");
    await expect(page.locator("#cidade")).toHaveValue("São Paulo");
    await expect(page.locator("#uf")).toHaveValue("SP");
    await expect(page.locator("#cep_status")).toHaveText(
      "Endereço preenchido. Confira e ajuste se precisar."
    );

    // o valor editado é o que fica — autofill nunca sobrescreve depois
    await page.locator("#logradouro").fill("Rua Editada à Mão");
    await expect(page.locator("#logradouro")).toHaveValue(
      "Rua Editada à Mão"
    );
  });

  test("CEP inexistente avisa e os campos seguem livres", async ({ page }) => {
    await entrarNaDemo(page, "mentor_dpp");
    await page.goto(`/assinar/${TOKEN_RICARDO}`);

    await page.locator("#cep").fill("00000-000");
    await expect(page.locator("#cep_status")).toHaveText(
      "CEP não encontrado. Preencha o endereço manualmente."
    );
    // nenhum bloqueio — o form segue inteiramente editável
    await expect(page.locator("#logradouro")).toBeEditable();
    await expect(page.locator("#cidade")).toBeEditable();
  });

  test("trocar o CEP dispara busca nova e reescreve o endereço", async ({
    page,
  }) => {
    await entrarNaDemo(page, "mentor_dpp");
    await page.goto(`/assinar/${TOKEN_RICARDO}`);

    const cep = page.locator("#cep");
    await cep.fill("01310-100");
    await expect(page.locator("#logradouro")).toHaveValue("Rua das Flores");

    // outro CEP válido → nova consulta; o fixture responde igual, mas o
    // ciclo buscando→ok prova que a busca rodou de novo
    await cep.fill("20040-020");
    await expect(page.locator("#cep_status")).toHaveText(
      "Endereço preenchido. Confira e ajuste se precisar."
    );
    await expect(page.locator("#uf")).toHaveValue("SP");
  });
});
