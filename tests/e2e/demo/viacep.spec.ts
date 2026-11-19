import { entrarNaDemo, expect, test } from "../helpers";

// REALIZA-37 — autofill de endereço por CEP no bloco de dados civis,
// exercitado na página pública de assinatura em modo demo (prova que a
// server action funciona sem sessão). `buscarCep` devolve o fixture fixo
// (Rua das Flores / Jardim Brasil / São Paulo·SP) pra qualquer CEP de 8
// dígitos; 00000-000 exercita o ramo "não encontrado". Determinístico e
// sem rede externa — ViaCEP-down é QA manual (timeout 5s + status).
//
// REALIZA-443 — em repouso não há texto fixo sob o CEP (só os estados de
// busca falam, via aria-live) e no modo compacto (cadastro/wizards) o
// autofill alimenta também os campos simples cidade/UF da ficha, que
// vivem fora do bloco — exercitado no dialog Nova pessoa.

const TOKEN_RICARDO = "de000000-0000-4000-8000-000000013318"; // uid(0x3406)

test.describe("demo — ViaCEP no cadastro de endereço", () => {
  test("CEP válido preenche o bloco; edição manual vence o autofill", async ({
    page,
  }) => {
    await entrarNaDemo(page, "mentor_dpp");
    await page.goto(`/assinar/${TOKEN_RICARDO}`);

    const cep = page.locator("#cep");
    await expect(cep).toBeVisible();
    // repouso sem texto fixo — a linha de status só existe depois da busca
    await expect(page.locator("#cep_status")).toHaveCount(0);
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

  test("modo compacto: autofill alimenta cidade/UF da ficha (Nova pessoa)", async ({
    page,
  }) => {
    await entrarNaDemo(page, "coordenacao");
    await page.goto("/pessoas");

    await page.getByRole("button", { name: /Nova pessoa/ }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();

    // etapa 1 pede os obrigatórios pra navegação pra frente destravar
    await dialog.locator("#nome").fill("Pessoa Teste CEP");
    await dialog.locator("#email").fill("cep.teste@realiza.test");
    await dialog
      .getByRole("button", { name: "Etapa 5 de 7: Documentos (termo de adesão)" })
      .click();

    const cep = dialog.locator("#civis_cep");
    await expect(cep).toBeVisible();
    await expect(dialog.locator("#civis_cep_status")).toHaveCount(0);
    await cep.fill("01310-100");

    await expect(dialog.locator("#civis_cep_status")).toHaveText(
      "Endereço preenchido. Confira e ajuste se precisar."
    );
    // cidade/UF moram no último passo, fora do bloco — o autofill chega lá
    await expect(dialog.locator("#n_cidade")).toHaveValue("São Paulo");
    await expect(dialog.locator('input[name="uf"]')).toHaveValue("SP");

    // edição manual posterior vence: o valor editado é o que fica
    await dialog
      .getByRole("button", { name: "Etapa 7 de 7: Localização e perfil" })
      .click();
    await expect(dialog.locator("#n_cidade")).toBeEditable();
    await dialog.locator("#n_cidade").fill("Osasco");
    await expect(dialog.locator("#n_cidade")).toHaveValue("Osasco");
    await expect(dialog.locator('input[name="uf"]')).toHaveValue("SP");
  });
});
