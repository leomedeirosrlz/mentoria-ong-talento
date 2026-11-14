import { entrarNaDemo, expect, test } from "../helpers";

// REALIZA-386 no modo demo — a ponte doc↔instrumento nos dois sentidos:
// o doc nativo carrega ?dupla=<id> — "Ler o guia" na linha do instrumento
// e "Abrir instrumento" no documento voltam pra mesma ficha. Doc navega
// na mesma aba; arquivo/url externa segue em aba nova.
// Read-only — seguro em qualquer ambiente.

const DUPLA_OK = "de000000-0000-4000-8000-000000001537"; // Ricardo × Ana (T1)

test.describe("demo — ponte instrumento ↔ documento (REALIZA-386)", () => {
  test("ficha: 'Ler o guia' por linha de instrumento, doc volta pra ficha", async ({
    page,
  }) => {
    await entrarNaDemo(page, "coordenacao");
    await page.goto(`/duplas/${DUPLA_OK}?aba=instrumentos`);

    const sec = page.locator("section", { hasText: "Instrumentos da jornada" });
    // os 5 da régua da dupla — inclusive o não-semeado recebe o guia
    await expect(
      sec.getByRole("link", { name: "Ler o guia" })
    ).toHaveCount(5);

    const pdm = sec.locator("li", {
      hasText: "Plano de Desenvolvimento do Mentorado",
    });
    const guia = pdm.getByRole("link", { name: "Ler o guia" });
    await expect(guia).toHaveAttribute(
      "href",
      `/materiais/documento/instrumento-pdm?dupla=${DUPLA_OK}`
    );
    await guia.click();
    await expect(page).toHaveURL(
      `/materiais/documento/instrumento-pdm?dupla=${DUPLA_OK}`
    );

    // a ponte do doc nomeia o instrumento e devolve a ficha, aba certa —
    // o card é o pai do "Abrir instrumento" (o h1 e o corpo do doc
    // repetem o nome — assert dentro do card, não na página)
    const ponte = page
      .getByRole("link", { name: "Abrir instrumento" })
      .locator("..");
    await expect(ponte).toContainText("PDM");
    await expect(ponte).toContainText("instrumento ao vivo");
    await page.getByRole("link", { name: "Abrir instrumento" }).click();
    await expect(page).toHaveURL(
      `/duplas/${DUPLA_OK}?aba=instrumentos#instrumentos`
    );
  });

  test("doc sem contexto aponta a régua; o card da régua aponta o guia", async ({
    page,
  }) => {
    await entrarNaDemo(page, "coordenacao");
    // biblioteca/bibliografia direta: sem ?dupla a ponte cai na régua
    await page.goto("/materiais/documento/instrumento-roda-da-vida");
    const ver = page.getByRole("link", { name: "Ver instrumentos" });
    await expect(ver).toHaveAttribute("href", "/materiais?aba=instrumentos");

    // a página do instrumento no painel também linka o guia nativo
    await page.goto("/materiais/instrumentos/visao");
    const guia = page.getByRole("link", { name: "Ler o guia" });
    await expect(guia).toHaveAttribute(
      "href",
      "/materiais/documento/instrumento-construindo-visao"
    );
    // instrumento sem doc nativo (avaliação recorrente) não ganha o link
    await page.goto("/materiais/instrumentos/avaliacao_encontro");
    await expect(
      page.getByRole("link", { name: "Ler o guia" })
    ).toHaveCount(0);
  });

  test("biblioteca: selo 'instrumento oficial' só nos docs com instrumento ao vivo", async ({
    page,
  }) => {
    await entrarNaDemo(page, "coordenacao");
    await page.goto("/materiais?aba=biblioteca");

    const roda = page.getByRole("link", {
      name: /Roda da Vida \(instrumento\)/,
    });
    await expect(roda.getByText("instrumento oficial")).toBeVisible();
    // roteiros e técnicas não têm instrumento ao vivo — sem selo
    const roteiro = page.getByRole("link", { name: /Roteiro Semana 5/ });
    await expect(roteiro.getByText("instrumento oficial")).toHaveCount(0);
    const feedback = page.getByRole("link", { name: /Feedback Construtivo/ });
    await expect(feedback.getByText("instrumento oficial")).toHaveCount(0);
  });
});

test.describe("demo — jornada do mentorado (REALIZA-386)", () => {
  test("'Ler o guia' nas estações e o doc devolve a jornada", async ({
    page,
  }) => {
    await entrarNaDemo(page, "mentorado");
    await page.goto("/jovem/materiais");

    const trilha = page.locator(
      'section[aria-labelledby="meus-instrumentos-titulo"]'
    );
    // as 5 estações com instrumento de sistema da dupla (as duas rodas
    // apontam o mesmo doc); avaliação recorrente e 360º não têm guia
    const guias = trilha.getByRole("link", { name: "Ler o guia" });
    await expect(guias).toHaveCount(5);
    await expect(
      trilha.getByRole("link", {
        name: "Ler o guia",
      }).first()
    ).toHaveAttribute(
      "href",
      "/jovem/materiais/documento/instrumento-roda-da-vida"
    );

    // o doc serve o jovem (audiência mentorado) e a ponte devolve a estante
    await trilha
      .getByRole("link", { name: "Ler o guia" })
      .first()
      .click();
    await expect(page).toHaveURL(
      "/jovem/materiais/documento/instrumento-roda-da-vida"
    );
    const voltar = page.getByRole("link", { name: "Abrir na jornada" });
    await expect(voltar).toHaveAttribute("href", "/jovem/materiais#jornada");
    await voltar.click();
    await expect(page).toHaveURL("/jovem/materiais#jornada");

    // doc de staff segue fechado pro jovem — o gate é honesto, não link morto
    await page.goto("/jovem/materiais/documento/roteiro-encontro-05");
    await expect(
      page.getByText(/não encontrada|not found/i).first()
    ).toBeVisible();
  });
});
