import { entrarNaDemo, expect, test } from "../helpers";

// Paridade demo do 455/456: a Leitura determinística nas abas piloto e o
// card "Perguntar à Liza" com a resposta enlatada por seção — sem provider,
// sem persistência, mesmo componente do real.

test.describe("demo — leitura determinística (455)", () => {
  test("aderência mostra o bloco Leitura com achados e intervenção", async ({
    page,
  }) => {
    await entrarNaDemo(page, "coordenacao");
    await page.goto("/relatorios/operacionais?aba=aderencia");

    const leitura = page.getByRole("region", { name: "Leitura da seção" });
    await expect(leitura).toBeVisible();
    await expect(
      leitura.getByRole("heading", { name: "Leitura" })
    ).toBeVisible();
    // o primeiro achado do dataset demo é o pedido de apoio da d-risco
    await expect(leitura.getByText(/apoio em aberto/).first()).toBeVisible();
    // todo achado carrega métrica com denominador
    await expect(leitura.getByText(/de \d+ duplas/).first()).toBeVisible();
  });

  test("saúde e adoção também têm a Leitura", async ({ page }) => {
    await entrarNaDemo(page, "coordenacao");
    await page.goto("/relatorios/operacionais?aba=visao");
    await expect(
      page.getByRole("region", { name: "Leitura da seção" })
    ).toBeVisible();

    await page.goto("/relatorios/operacionais?aba=adocao");
    await expect(
      page.getByRole("region", { name: "Leitura da seção" })
    ).toBeVisible();
  });
});

test.describe("demo — perguntar à Liza (456)", () => {
  test("botão abre o dialog e gera o card enlatado, sem sair da seção", async ({
    page,
  }) => {
    await entrarNaDemo(page, "coordenacao");
    await page.goto("/relatorios/operacionais?aba=aderencia");

    const bloco = page.getByRole("region", { name: "Perguntar à Liza" });
    await expect(bloco).toBeVisible();
    await expect(
      bloco.getByText(/nunca sobre texto livre/)
    ).toBeVisible();

    await bloco
      .getByRole("button", { name: "Perguntar à Liza" })
      .click();
    // o título do dialog segue "Perguntar à Liza: <aba>" — o separador
    // variou no passe de copy; a regex tolera a pontuação
    await expect(
      page.getByRole("heading", { name: /Perguntar à Liza\s*[:—–-]\s*Aderência/ })
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Gerar resposta" })
      .click();

    // card enlatado renderiza: pergunta padrão + resposta + meta
    await expect(
      bloco.getByRole("blockquote")
    ).toContainText(/pede ação agora/, { timeout: 10_000 });
    await expect(bloco.getByText(/Sugestões:/)).toBeVisible();
    await expect(bloco.getByText(/Gerado em/)).toBeVisible();
    // hash bate com o recorte atual — sem badge de desatualizado
    await expect(bloco.getByText(/Desatualizado/)).toHaveCount(0);
  });

  test("outros papéis nem chegam no hub — a página redireciona", async ({
    page,
  }) => {
    await entrarNaDemo(page, "mentor_dpp");
    await page.goto("/relatorios/operacionais?aba=aderencia");
    await expect(page).toHaveURL(/\/(sua-dupla|agenda|$)/);
  });
});
