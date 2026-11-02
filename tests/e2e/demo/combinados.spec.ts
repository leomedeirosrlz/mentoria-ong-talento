import { entrarNaDemo, expect, test } from "../helpers";

// REALIZA-339 — combinados do registro: o corpo expandido do registro na
// ficha lista os itens (antes: só o detalhe da agenda lia) e o "Editar
// registro" reidrata a etapa 3 com eles (antes: nascia vazia e salvar
// duplicava). Fixture d-ok (Ricardo × Ana, uid 0x0601): 4º encontro tem 1
// pendente ("Revisar as duas primeiras submetas…"), 1º e 3º têm um feito
// cada. A demo não escreve — o salvar devolve DEMO_MSG; o teste cobre
// leitura + hidratação, não persistência.

const DUPLA_OK = "de000000-0000-4000-8000-000000001537"; // d-ok
const DEMO_MSG = "Modo demonstração. Nada é gravado de verdade.";

// trechos dos textos do fixture (assert por substring — o texto inteiro é
// do data.ts e pode crescer sem quebrar o spec)
const PENDENTE = "Revisar as duas primeiras submetas";
const FEITO = "Listar 3 pessoas pra avaliação por terceiros";

test.describe("demo — combinados do registro (REALIZA-339)", () => {
  test("registro expandido lista os combinados do encontro", async ({
    page,
  }) => {
    await entrarNaDemo(page, "mentor_dpp");
    await page.goto(`/duplas/${DUPLA_OK}?aba=encontros`);

    // 4º encontro — tema do registro no resumo do disclosure
    const card4 = page
      .locator('[id^="registrar-"]')
      .filter({ hasText: "Fechamento da construção do PDM" });
    await card4
      .getByRole("button", { name: /Fechamento da construção do PDM/ })
      .click();

    await expect(
      card4.getByText("Combinados", { exact: true })
    ).toBeVisible();
    const item = card4.locator("li", { hasText: PENDENTE });
    await expect(item).toBeVisible();
    await expect(item).toContainText("Mentorado");
    await expect(item).toContainText(/até \d{2} de \w{3}\. de \d{4}/);
    // pendente não vem riscado
    await expect(item.getByText(PENDENTE)).not.toHaveClass(/line-through/);

    // 1º encontro — o combinado feito aparece riscado
    const card1 = page
      .locator('[id^="registrar-"]')
      .filter({ hasText: "Boas-vindas e histórias de vida" });
    await card1
      .getByRole("button", { name: /Boas-vindas e histórias de vida/ })
      .click();
    await expect(
      card1.getByText(FEITO)
    ).toBeVisible();
    await expect(card1.getByText(FEITO)).toHaveClass(/line-through/);
  });

  test("edição reidrata os combinados e o salvar bate na action", async ({
    page,
  }) => {
    await entrarNaDemo(page, "mentor_dpp");
    await page.goto(`/duplas/${DUPLA_OK}?aba=encontros`);

    const card4 = page
      .locator('[id^="registrar-"]')
      .filter({ hasText: "Fechamento da construção do PDM" });
    await card4
      .getByRole("button", { name: /Fechamento da construção do PDM/ })
      .click();
    await card4.getByRole("button", { name: "Editar registro" }).click();

    // wizard: a etapa 3 só abre depois dos dois "Avançar" (a avaliação já
    // vem marcada no registro, então o portão da etapa 1 passa direto)
    await expect(
      card4.getByRole("heading", { name: /Passo 1 de 3/ })
    ).toBeVisible();
    await card4.getByRole("button", { name: "Avançar" }).click();
    await expect(
      card4.getByRole("heading", { name: /Passo 2 de 3/ })
    ).toBeVisible();
    await card4.getByRole("button", { name: "Avançar" }).click();
    await expect(
      card4.getByRole("heading", { name: /Passo 3 de 3/ })
    ).toBeVisible();

    // a linha nasce hidratada com o combinado gravado (o id do banco vai
    // junto no submit — é ele que casa o update no servidor)
    const linha = card4.getByRole("textbox", {
      name: "Descrição do combinado",
    });
    await expect(linha).toHaveCount(1);
    await expect(linha).toHaveValue(new RegExp(PENDENTE));
    await expect(
      card4.getByRole("combobox", { name: "Responsável" })
    ).toContainText("Mentorado");
    await expect(card4.getByLabel("Prazo")).toHaveValue(/\d{4}-\d{2}-\d{2}/);

    // adicionar/remover seguem editáveis — a remoção do item hidratado é o
    // que vira DELETE no servidor
    await card4.getByRole("button", { name: "Adicionar" }).click();
    await expect(linha).toHaveCount(2);
    await card4
      .getByRole("button", { name: "Remover combinado" })
      .last()
      .click();
    await expect(linha).toHaveCount(1);
    await expect(linha).toHaveValue(new RegExp(PENDENTE));

    // o submit chega na action — a demo devolve o aviso no lugar da gravação
    await card4.getByRole("button", { name: "Salvar alterações" }).click();
    await expect(page.getByText(DEMO_MSG)).toBeVisible();
  });
});
