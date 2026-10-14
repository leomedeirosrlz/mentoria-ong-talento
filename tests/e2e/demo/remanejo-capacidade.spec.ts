import { entrarNaDemo, expect, test } from "../helpers";

// REALIZA-115/116 no modo demo — a dupla-risco (Fernanda × Dandara) carrega
// o card de sugestão com o pool real do dataset: Luiza e Carlos têm vaga
// (1/2), André está cheio em 2/2 com a pausada contando (a régua do
// trigger) e a fila traz Rafael e Wendel. Sem writes — spec demo seguro
// em qualquer ambiente, produção inclusa.

const DUPLA_RISCO = "de000000-0000-4000-8000-000000001539";
const ANDRE_ID = "de000000-0000-4000-8000-000000000010";

test.describe("demo — sugestão de remanejo e capacidade", () => {
  test("dupla em risco mostra o card com livres, cheios e a fila", async ({
    page,
  }) => {
    await entrarNaDemo(page, "coordenacao");
    await page.goto(`/duplas/${DUPLA_RISCO}`);

    const card = page.locator(
      'section[aria-labelledby="remanejo-sugerido-titulo"]'
    );
    await expect(card).toBeVisible();
    await expect(card.getByText(/Pedido de apoio/)).toBeVisible();

    // livres primeiro: Luiza (tema em comum "comunicação" com a Dandara)
    // e Carlos, ambos 1/2 — cada um com o Remanejar que abre o dialog
    for (const nome of ["Luiza Campos", "Carlos Menezes"]) {
      const linha = card.locator("li", { hasText: nome });
      await expect(linha.getByText(/1\/2/)).toBeVisible();
      await expect(
        linha.getByRole("button", { name: "Remanejar", exact: true })
      ).toBeVisible();
    }
    // o "porquê" da ordem é legível — motivos em pt-BR nos chips
    await expect(
      card.locator("li", { hasText: "Luiza Campos" }).getByText(/tema em comum/)
    ).toBeVisible();

    // cheios marcados, não escondidos — o André é a vitrine da pausada
    // contando vaga (Pedro pausada + Kauã ativa = 2/2)
    const linhaAndre = card.locator("li", { hasText: "André Rocha" });
    await expect(linhaAndre.getByText(/2\/2 · sem vaga/)).toBeVisible();
    await expect(
      linhaAndre.getByRole("button", { name: /aumentar capacidade/ })
    ).toBeVisible();

    // a fila "Aguardando par" no lado do mentorado — os dois da demo
    for (const nome of ["Rafael Nunes", "Wendel Ferreira"]) {
      await expect(card.locator("li", { hasText: nome })).toBeVisible();
    }
  });

  test("clique na sugestão abre o remanejo com o par já escolhido", async ({
    page,
  }) => {
    await entrarNaDemo(page, "coordenacao");
    await page.goto(`/duplas/${DUPLA_RISCO}`);

    const card = page.locator(
      'section[aria-labelledby="remanejo-sugerido-titulo"]'
    );
    await card
      .locator("li", { hasText: "Luiza Campos" })
      .getByRole("button", { name: "Remanejar", exact: true })
      .click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    // resumo "antes → depois" só aparece com o novo par resolvido — a
    // preseleção da sugestão chegou inteira no dialog de sempre
    await expect(dialog.getByText(/será encerrada/)).toBeVisible({
      timeout: 15_000,
    });
    await expect(dialog.getByText(/Luiza Campos/).first()).toBeVisible();
    await dialog.getByRole("button", { name: "Fechar" }).click();
    await expect(dialog).not.toBeVisible();
  });

  test("ficha do mentor mostra X/Y e o ajuste de capacidade", async ({
    page,
  }) => {
    await entrarNaDemo(page, "coordenacao");
    await page.goto(`/pessoas/${ANDRE_ID}`);

    // stat de capacidade em modo X/Y — cheio fica marcado ("aumentar →")
    await expect(page.getByText(/2\/2 duplas/)).toBeVisible();
    await expect(
      page.getByRole("button", { name: "aumentar →" })
    ).toBeVisible();

    // o dialog de ajuste abre com o piso das duplas em andamento —
    // a action devolve DEMO_MSG no modo demo, mas a UI inteira exercita
    await page.getByRole("button", { name: "aumentar →" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByText(/Capacidade de André/)).toBeVisible();
    await expect(
      dialog.getByText(/Cuida de 2 duplas em andamento — o mínimo é 2/)
    ).toBeVisible();
    await dialog.getByRole("button", { name: "Cancelar" }).click();
  });
});
