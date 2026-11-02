import { entrarNaDemo, expect, test } from "../helpers";

// REALIZA-21 — checklist de intenções do mentor por encontro, na ficha da
// dupla. Fixture (d-ok · Ricardo × Ana, uid 0x0601): um pendente do 3º
// encontro (carry-over "De antes" nos cards seguintes e o aviso
// "Intenções em aberto" da agenda), um pendente e um feito no 5º. A demo
// não escreve: criar/marcar/remover rolam no estado local do componente e
// nenhum toast DEMO_MSG dispara. Read-only de backend — seguro em
// qualquer deploy, produção inclusa.

const DUPLA_OK = "de000000-0000-4000-8000-000000001537"; // d-ok
const DEMO_MSG = "Modo demonstração. Nada é gravado de verdade.";

// trechos dos textos do fixture (assert por substring — o texto inteiro
// é do data.ts e pode crescer sem quebrar o spec)
const CARRY = "Pedir o contato do professor de matemática";
const PENDENTE = "Revisar as submetas do PDM";
const FEITO = "Enviar o vídeo da Roda da Vida";

test.describe("demo — intenções do encontro (REALIZA-21)", () => {
  test("checklist renderiza com carry-over e muta só em estado local", async ({
    page,
  }) => {
    await entrarNaDemo(page, "mentor_dpp");
    await page.goto(`/duplas/${DUPLA_OK}?aba=encontros`);

    // a âncora #intencoes-5 existe no card do 5º encontro; 2 pendentes na
    // soma do trigger (1 do 5º + 1 carry-over do 3º)
    const bloco = page.locator("#intencoes-5");
    const trigger = bloco.getByRole("button", { name: /Afazeres/ });
    await expect(trigger).toContainText("2 pendentes");
    await trigger.click();

    // itens do 5º: pendente desmarcado, feito riscado e com checked
    await expect(bloco.getByText(PENDENTE)).toBeVisible();
    await expect(
      bloco.locator("label", { hasText: PENDENTE }).getByRole("checkbox")
    ).not.toBeChecked();
    await expect(
      bloco.locator("label", { hasText: FEITO }).getByRole("checkbox")
    ).toBeChecked();
    await expect(bloco.getByText(FEITO)).toHaveClass(/line-through/);

    // carry-over: seção "De antes" com a tag de origem antes do texto
    await expect(bloco.getByText("De antes")).toBeVisible();
    await expect(
      bloco.getByText(new RegExp(`do 3º encontro · ${CARRY}`))
    ).toBeVisible();

    // criar: Enter no input adiciona o item na hora (estado local da demo)
    const novo = "E2E — perguntar do ENEM";
    await bloco
      .getByRole("textbox", { name: "Novo afazer do 5º encontro" })
      .fill(novo);
    await page.keyboard.press("Enter");
    await expect(bloco.getByText(novo)).toBeVisible();
    await expect(trigger).toContainText("3 pendentes");

    // marcar: o clique honesto é no label (o checkbox é sr-only) — o item
    // criado risca e o contador volta pra 2
    await bloco.locator("label", { hasText: novo }).click();
    await expect(
      bloco.locator("label", { hasText: novo }).getByRole("checkbox")
    ).toBeChecked();
    await expect(trigger).toContainText("2 pendentes");

    // carry-over marcado sai do "De antes" na hora (o recorte é !feito) —
    // equivale ao desaparecimento pós-refresh do app real
    await bloco.locator("label", { hasText: CARRY }).click();
    await expect(bloco.getByText(CARRY)).toHaveCount(0);
    await expect(trigger).toContainText("1 pendente");

    // remover: só no item em questão — o botão × é o icon-button do li
    await bloco
      .locator("li", { hasText: novo })
      .getByRole("button", { name: "Remover afazer" })
      .click();
    await expect(bloco.getByText(novo)).toHaveCount(0);

    // nenhum gesto disparou action — o toast DEMO_MSG nunca aparece
    await expect(page.getByText(DEMO_MSG)).toHaveCount(0);
  });

  test("aviso agregado na Minha agenda deep-linka pra ficha", async ({
    page,
  }) => {
    await entrarNaDemo(page, "mentor_dpp");
    await page.goto("/agenda");

    // uma linha só por dupla — contagem + nº mais antigo, sem texto de item
    await expect(
      page.getByText(/Afazeres em aberto · Ana/).first()
    ).toBeVisible();
    await expect(
      page.getByText(/2 itens · o mais antigo é do 3º encontro\./)
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Ver afazeres" })
    ).toHaveAttribute("href", `/duplas/${DUPLA_OK}#intencoes-3`);
  });

  test("coordenação lê sem editar — sem checkbox, input nem remover", async ({
    page,
  }) => {
    await entrarNaDemo(page, "coordenacao");
    await page.goto(`/duplas/${DUPLA_OK}?aba=encontros`);

    const bloco = page.locator("#intencoes-5");
    // read-only é lista plana (sem collapse): os itens já aparecem
    await expect(bloco.getByText(PENDENTE)).toBeVisible();
    await expect(bloco.getByText(FEITO)).toBeVisible();
    await expect(bloco.getByText(CARRY)).toBeVisible();
    await expect(bloco.getByRole("checkbox")).toHaveCount(0);
    await expect(
      bloco.getByRole("textbox", { name: /Novo afazer/ })
    ).toHaveCount(0);
    await expect(
      bloco.getByRole("button", { name: "Remover afazer" })
    ).toHaveCount(0);
  });
});
