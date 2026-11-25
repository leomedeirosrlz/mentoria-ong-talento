import { entrarNaDemo, expect, test } from "../helpers";

// REALIZA-454 — os painéis fixos da aba Adoção na demo: o cru fabricado
// (dadosAdocaoEventosDemo) cobre permanencia/rolagem/clique com alvo,
// então os três painéis e a jornada têm dado de verdade pra ler — não
// o estado "acumulando" do app recém-nascido.

test.describe("demo — aba Adoção, painéis ricos", () => {
  test.beforeEach(async ({ page }) => {
    await entrarNaDemo(page, "coordenacao");
    await page.goto("/relatorios/operacionais?aba=adocao");
  });

  test("heatmap de toques com grade e seletor de superfície", async ({
    page,
  }) => {
    await expect(
      page.getByRole("heading", { name: "Como usam" })
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Onde tocam" })
    ).toBeVisible();
    // a régua de superfícies: pelo menos dois chips com toque na demo
    const chips = page.getByRole("group", {
      name: "Superfície do mapa de toques",
    });
    await expect(chips.getByRole("button").first()).toBeVisible();
    // a grade 10×10 é tabela de verdade — o número mora na célula
    const grade = page.getByRole("region", {
      name: /Grade de toques de/,
    });
    await expect(grade).toBeVisible();
    await expect(grade.locator("td").nth(99)).toBeAttached();
    // trocar de superfície re-deriva a grade e o denominador declarado
    const segundo = chips.getByRole("button").nth(1);
    const rotulo = await segundo.textContent();
    await segundo.click();
    await expect(segundo).toHaveAttribute("aria-pressed", "true");
    await expect(
      page.getByRole("region", {
        name: new RegExp(`Grade de toques de ${rotulo}`),
      })
    ).toBeVisible();
    await expect(page.getByText(/toques de \d+ pessoas?/)).toBeVisible();
  });

  test("tempo por tela com mediana e denominador de estadias", async ({
    page,
  }) => {
    await expect(
      page.getByRole("heading", { name: "Quanto tempo fica" })
    ).toBeVisible();
    const tabela = page.getByRole("region", {
      name: /Tempo de permanência por superfície/,
    });
    await expect(tabela).toBeVisible();
    // mediana formatada (s ou min) e a coluna do denominador
    await expect(
      tabela.locator("tbody td", { hasText: /\d+s|\d+min/ }).first()
    ).toBeVisible();
    await expect(tabela.locator("th", { hasText: "estadias" })).toBeVisible();
  });

  test("profundidade com os 4 marcos e visitas roláveis", async ({ page }) => {
    await expect(
      page.getByRole("heading", { name: "Até onde lê" })
    ).toBeVisible();
    const tabela = page.getByRole("region", {
      name: /Profundidade de rolagem por superfície/,
    });
    await expect(tabela).toBeVisible();
    for (const m of ["25%", "50%", "75%", "100%"]) {
      await expect(
        tabela.locator("thead th", { hasText: m })
      ).toBeVisible();
    }
    await expect(tabela.locator("th", { hasText: "visitas" })).toBeVisible();
  });

  test("jornada de uma pessoa: seletor + trilha em ordem", async ({
    page,
  }) => {
    await expect(
      page.getByRole("heading", { name: "A jornada de uma pessoa" })
    ).toBeVisible();
    const seletor = page.getByRole("combobox", {
      name: "Pessoa da jornada",
    });
    await expect(seletor).toBeVisible();
    // a trilha lista gestos com verbo de ação — permanencia lê "ficou em"
    await expect(
      page.getByText(/ficou em|visitou|clicou em/).first()
    ).toBeVisible();
  });

  test("o recorte de papel atravessa os painéis", async ({ page }) => {
    // o chip da régua filtra o cru — os denominadores dos painéis mudam
    await page
      .getByRole("group", { name: "Papel" })
      .getByRole("link", { name: "Mentor DPP" })
      .click();
    await expect(page).toHaveURL(/papel=mentor_dpp/);
    await expect(
      page.getByRole("heading", { name: "Como usam" })
    ).toBeVisible();
    await expect(
      page.getByText(/só Mentor DPP/).first()
    ).toBeVisible();
  });

  // spec 028 — o explorador troca de ESTADO (fechado→preparando→…) pelo
  // crossfade do kit; o contrato de foco: "preparando" é fase de espera
  // que se resolve sozinha e não recebe foco (roubar foco no meio dela
  // largaria a pessoa num painel vazio), fechado recebe de volta
  test("explorador: abrir não rouba foco na espera; fechar devolve ao painel", async ({
    page,
  }) => {
    await page.getByRole("button", { name: "Abrir o explorador" }).click();

    // a fase de espera entrou pelo crossfade — e o foco NÃO viajou pra
    // ela (o botão que disparou desmontou; foco cai no body, não no
    // painel vazio). O boot do DuckDB não precisa terminar pro contrato
    await expect(
      page.getByText(/Preparando o motor de consulta|Baixando o motor de consulta/).first()
    ).toBeVisible();
    expect(
      await page.evaluate(
        () =>
          document.activeElement === document.body ||
          document.activeElement === document.documentElement
      )
    ).toBe(true);

    // fechar volta pro estado fechado — aí sim o painel entrante recebe
    // o foco (quem abriu pelo teclado não fica órfão)
    await page.getByRole("button", { name: "Fechar" }).click();
    await expect(
      page.getByRole("button", { name: "Abrir o explorador" })
    ).toBeVisible();
    await expect(page.locator("div:focus")).toContainText(
      "Console SQL sobre os gestos"
    );
  });
});
