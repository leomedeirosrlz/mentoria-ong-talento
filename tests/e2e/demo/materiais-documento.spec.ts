import { entrarNaDemo, expect, test } from "../helpers";

// REALIZA-490 — o sumário do documento nativo expõe o 2º nível: os ### do
// corpus (encontros, momentos) viram itens clicáveis sob o ## do grupo e a
// contagem "N seções" casa com os links renderizados. Cada página de
// documento tem um único <main> (o landmark é do shell, não do documento).
// Read-only; roda contra qualquer ambiente.

test.describe("demo — sumário do documento nativo (REALIZA-490)", () => {
  test("guia DPP: 16 encontros clicáveis no rail, contagem coerente, main único", async ({
    page,
  }) => {
    await entrarNaDemo(page, "coordenacao");
    await page.goto("/materiais/documento/guia-mentor-dpp");

    // landmark único — o <main> é o do shell; o documento não aninha outro
    await expect(page.getByRole("main")).toHaveCount(1);

    // no xl o rail é o único nav "Sumário" na árvore (a pill é xl:hidden)
    const rail = page.getByRole("navigation", {
      name: "Sumário do documento",
    });
    await expect(rail).toBeVisible();
    await expect(rail).toContainText("61 seções");

    // 35 capítulos + 26 subs = 61 itens — a contagem casa com os links
    await expect(rail.getByRole("link")).toHaveCount(61);

    // 2º nível: um item por card de encontro ("Nº encontro · Título")
    const itensEncontro = rail.getByRole("link", { name: /º encontro ·/ });
    await expect(itensEncontro).toHaveCount(16);

    // clique no 5º encontro rola até o card na âncora "grupo › sub"
    await rail
      .getByRole("link", { name: /^5º encontro ·/ })
      .click();
    await expect(page).toHaveURL(/#encontros-5-a-7/);
    await expect(
      page.getByRole("heading", {
        name: /5º encontro · Primeiros resultados/,
      })
    ).toBeInViewport();
  });

  test("guia DPP mobile: pill do sumário abre os mesmos 16 encontros", async ({
    page,
  }) => {
    await entrarNaDemo(page, "coordenacao");
    await page.goto("/materiais/documento/guia-mentor-dpp");
    await page.setViewportSize({ width: 390, height: 844 });

    // fora do xl o rail some e a pill sticky assume — mesma lista de 2 níveis
    await page
      .getByRole("button", { name: /Neste documento.*61 seções/ })
      .click();
    const pill = page.getByRole("navigation", {
      name: "Sumário do documento",
    });
    await expect(pill.getByRole("link", { name: /º encontro ·/ })).toHaveCount(
      16
    );

    // a pill fecha sozinha ao navegar e a âncora leva ao 16º encontro
    await pill.getByRole("link", { name: /16º encontro ·/ }).click();
    await expect(page).toHaveURL(/#encontros-15-e-16/);
    await expect(
      page.getByRole("heading", {
        name: /16º encontro · Encerramento e celebração/,
      })
    ).toBeInViewport();
    await expect(page.getByRole("main")).toHaveCount(1);
  });

  test("guia do especialista: grupos sem intro entram no sumário e na contagem", async ({
    page,
  }) => {
    await entrarNaDemo(page, "coordenacao");
    await page.goto("/materiais/documento/guia-mentor-especialista");

    // 14 ## + 33 ### = 47 itens — os grupos sem intro contam porque o h2
    // ancora mesmo sem virar seção de conteúdo. Aqui os 5 encontros são
    // cards inline ("**Nº ENCONTRO: T.**"), não ### — chegam pelo capítulo.
    const rail = page.getByRole("navigation", {
      name: "Sumário do documento",
    });
    await expect(rail).toContainText("47 seções");
    await expect(rail.getByRole("link")).toHaveCount(47);

    await rail
      .getByRole("link", { name: /Os encontros da trilha/ })
      .click();
    await expect(page).toHaveURL(/#10-os-encontros-da-trilha/);
    await expect(page.getByRole("main")).toHaveCount(1);
  });
});
