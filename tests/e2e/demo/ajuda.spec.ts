import { entrarNaDemo, expect, test } from "../helpers";

// REALIZA-345 — Ajuda no modo demo: FAQ pesquisável + "Como funciona", tudo
// conteúdo estático filtrado por papel (sem IA, sem dados). Sem writes —
// spec seguro em qualquer ambiente, produção inclusa.

test.describe("demo — ajuda", () => {
  test("mentor DPP vê a aba Perguntas e acha uma pergunta pela busca", async ({
    page,
  }) => {
    await entrarNaDemo(page, "mentor_dpp");
    await page.goto("/ajuda");

    await expect(
      page.getByRole("heading", { name: "Ajuda", level: 1 })
    ).toBeVisible();
    await expect(
      page.getByRole("tab", { name: "Perguntas frequentes" })
    ).toHaveAttribute("aria-selected", "true");

    // as dúvidas mais comuns abrem o tema: "Quem marca os encontros?" é a
    // primeira pergunta da lista, antes de "Quantos encontros..."
    await expect(
      page.locator("summary").first()
    ).toContainText("Quem marca os encontros?");

    // link direto na resposta aponta pra tela de verdade — e a rota
    // escopada por papel manda o mentor pra /agenda (não /jovem/agenda)
    const remarcar = page.locator("details", {
      hasText: "Preciso remarcar um encontro",
    });
    await remarcar.locator("summary").click();
    await expect(
      remarcar.getByRole("link", { name: "Agenda" })
    ).toHaveAttribute("href", "/agenda");

    // busca client-side: "registro" acha a pergunta do registro e esconde
    // o que não combina
    await page.getByRole("searchbox").fill("registro");
    await expect(page.getByText("Onde eu faço o registro?")).toBeVisible();
    await expect(
      page.getByText("Quantos encontros tem a mentoria?")
    ).toHaveCount(0);

    // a segunda aba por URL — o mapa do menu é o do mentor (Minha agenda),
    // não a fila da equipe
    await page.getByRole("tab", { name: "Como funciona" }).click();
    await expect(page).toHaveURL(/aba=como-funciona/);
    await expect(
      page.getByRole("heading", { name: "A jornada do programa" })
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Onde fica cada coisa" })
    ).toBeVisible();
    await expect(page.getByText("Minha agenda")).toBeVisible();
  });

  test("jovem acessa a própria ajuda e não vê pergunta exclusiva de staff", async ({
    page,
  }) => {
    await entrarNaDemo(page, "mentorado");
    await page.goto("/jovem/ajuda");

    await expect(
      page.getByRole("heading", { name: "Ajuda", level: 1 })
    ).toBeVisible();
    // pergunta do jovem visível…
    await expect(page.getByText("O que são os especialistas?")).toBeVisible();

    // o link da resposta aponta pra rota dele, não pra de staff
    const materiais = page.locator("details", {
      hasText: "Onde estão meus materiais de apoio?",
    });
    await materiais.locator("summary").click();
    await expect(
      materiais.getByRole("link", { name: "Jornada" })
    ).toHaveAttribute("href", "/jovem/materiais");

    // …e a pergunta exclusiva de staff fica de fora do FAQ dele — nem a
    // busca a ressuscita
    await expect(
      page.getByText("Como funciona a fila de Chamados?")
    ).toHaveCount(0);
    await page.getByRole("searchbox").fill("chamados");
    await expect(
      page.getByText("Nenhuma pergunta com “chamados”.")
    ).toBeVisible();

    // o "Como funciona" fala a linguagem dele — e o mapa do menu é o da
    // nav do jovem (Jornada), não o /materiais de staff
    await page.goto("/jovem/ajuda?aba=como-funciona");
    await expect(
      page.getByRole("heading", { name: "Como é a mentoria" })
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Onde fica cada coisa" })
    ).toBeVisible();
    // <dt> não ganha nome acessível do conteúdo no Chromium — o termo é
    // achado pelo texto exato dentro da lista de definições
    await expect(
      page.locator("dt").getByText("Jornada", { exact: true })
    ).toBeVisible();
  });
});
