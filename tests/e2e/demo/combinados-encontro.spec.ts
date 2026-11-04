import { entrarNaDemo, expect, test } from "../helpers";

// Combinados do encontro (0157: os afazeres viraram combinados) — uma
// lista só por nº do guia, logo abaixo do registro, com o responsável em
// cada item. Fixture d-ok (Ricardo × Ana, uid 0x0601): no 5º, um pendente
// e um feito do preparo; "De antes" traz o pendente do preparo do 3º e o
// combinado do registro do 4º. A demo não escreve: criar/marcar/remover
// rolam no estado local do componente e nenhum toast DEMO_MSG dispara.
// Read-only de backend — seguro em qualquer deploy, produção inclusa.

const DUPLA_OK = "de000000-0000-4000-8000-000000001537"; // d-ok
const DEMO_MSG = "Modo demonstração. Nada é gravado de verdade.";

// trechos dos textos do fixture (assert por substring — o texto inteiro
// é do data.ts e pode crescer sem quebrar o spec)
const CARRY = "Pedir o contato do professor de matemática";
const DO_REGISTRO = "Revisar as duas primeiras submetas";
const PENDENTE = "Revisar as submetas do PDM";
const FEITO = "Enviar o vídeo da Roda da Vida";

test.describe("demo — combinados do encontro (0157)", () => {
  test("lista única com carry-over, responsável e mutação local", async ({
    page,
  }) => {
    await entrarNaDemo(page, "mentor_dpp");
    await page.goto(`/duplas/${DUPLA_OK}?aba=encontros`);

    // a âncora #combinados-5 existe no card do 5º encontro e nasce aberta
    // (tem itens); 3 pendentes = 1 do 5º + 2 de antes (3º e 4º)
    const bloco = page.locator("#combinados-5");
    const trigger = bloco.getByRole("button", { name: /^Combinados/ });
    await expect(trigger).toContainText("3 pendentes");
    await expect(bloco.getByText(PENDENTE)).toBeVisible();

    // itens do 5º: pendente desmarcado, feito riscado e com checked
    await expect(
      bloco.locator("label", { hasText: PENDENTE }).getByRole("checkbox")
    ).not.toBeChecked();
    await expect(
      bloco.locator("label", { hasText: FEITO }).getByRole("checkbox")
    ).toBeChecked();
    await expect(bloco.getByText(FEITO)).toHaveClass(/line-through/);

    // de antes: o do preparo (Você) e o do registro do 4º (Ana, com prazo)
    await expect(bloco.getByText("De antes")).toBeVisible();
    await expect(
      bloco.getByText(new RegExp(`do 3º encontro · ${CARRY}`))
    ).toBeVisible();
    const doRegistro = bloco.locator("label", { hasText: DO_REGISTRO });
    await expect(doRegistro).toContainText("do 4º encontro");
    await expect(doRegistro).toContainText(/Ana · até \d{2}\/\d{2}\/\d{4}/);

    // criar com o mentorado como responsável: o item nasce com o nome dele
    const novo = "E2E · trazer o boletim";
    await bloco
      .getByRole("textbox", { name: "Novo combinado do 5º encontro" })
      .fill(novo);
    await bloco.getByRole("button", { name: "Ana", exact: true }).click();
    await bloco.getByRole("button", { name: "Adicionar" }).click();
    await expect(bloco.locator("label", { hasText: novo })).toContainText("Ana");
    await expect(trigger).toContainText("4 pendentes");

    // marcar: o clique honesto é no label (o checkbox é sr-only)
    await bloco.locator("label", { hasText: novo }).click();
    await expect(
      bloco.locator("label", { hasText: novo }).getByRole("checkbox")
    ).toBeChecked();
    await expect(trigger).toContainText("3 pendentes");

    // de antes marcado sai da lista na hora (o recorte é pendente) —
    // equivale ao desaparecimento pós-refresh do app real
    await bloco.locator("label", { hasText: CARRY }).click();
    await expect(bloco.getByText(CARRY)).toHaveCount(0);
    await expect(trigger).toContainText("2 pendentes");

    // remover: só no item em questão — o botão × é o icon-button do li
    await bloco
      .locator("li", { hasText: novo })
      .getByRole("button", { name: "Remover combinado" })
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

    // uma linha só por dupla — contagem + nº mais antigo, sem texto de
    // item; o aviso usa o nome social (Bia)
    await expect(
      page.getByText(/Combinados seus em aberto · Bia/).first()
    ).toBeVisible();
    await expect(
      page.getByText(/2 itens · o mais antigo é do 3º encontro\./)
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Ver combinados" }).first()
    ).toHaveAttribute("href", `/duplas/${DUPLA_OK}#combinados-3`);
  });

  test("coordenação marca feito, mas não cria nem remove", async ({
    page,
  }) => {
    await entrarNaDemo(page, "coordenacao");
    await page.goto(`/duplas/${DUPLA_OK}?aba=encontros`);

    const bloco = page.locator("#combinados-5");
    await expect(bloco.getByText(PENDENTE)).toBeVisible();
    await expect(bloco.getByText(CARRY)).toBeVisible();
    // o responsável do mentor lê "Mentor" pra quem não é ele
    await expect(bloco.locator("label", { hasText: PENDENTE })).toContainText(
      "Mentor"
    );
    await expect(bloco.getByRole("checkbox").first()).toBeVisible();
    await expect(
      bloco.getByRole("textbox", { name: /Novo combinado/ })
    ).toHaveCount(0);
    await expect(
      bloco.getByRole("button", { name: "Remover combinado" })
    ).toHaveCount(0);
  });
});
